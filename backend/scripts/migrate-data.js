#!/usr/bin/env node
/**
 * Migração dos dados do SQLite para o Postgres.
 *
 * Preserva os ids originais — há FKs apontando para eles e o frontend
 * guarda ids em links e localStorage. Depois dos inserts, reposiciona
 * cada sequence em MAX(id) para que novos registros não colidam com os
 * migrados.
 *
 * Idempotente por ON CONFLICT (id) DO NOTHING: rodar duas vezes não
 * duplica. Para refazer do zero, limpe as tabelas antes.
 *
 * Não migra:
 *   - password_reset_tokens — os 9 tokens existentes estavam num
 *     repositório público; devem ser considerados comprometidos
 *   - salas_backup_cleanup, aulas_backup_cleanup, matriculas — lixo de
 *     desenvolvimento, sem referência no código
 *
 * Uso:
 *   node scripts/migrate-data.js [caminho/do/unimap.db]
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');

const origem = process.argv[2] || path.join(__dirname, '..', 'unimap.db');

/**
 * Ordem de inserção, respeitando as chaves estrangeiras.
 * `colunas` é a lista que vai no INSERT, na ordem dos valores.
 */
const TABELAS = [
    { nome: 'usuarios',              colunas: ['id', 'nome', 'email', 'matricula', 'tipo', 'curso', 'periodo', 'senha_hash', 'ativo', 'data_cadastro'] },
    { nome: 'blocos',                colunas: ['id', 'letra', 'nome'] },
    { nome: 'cursos',                colunas: ['id', 'nome', 'duracao', 'turno', 'ativo', 'total_periodos'] },
    { nome: 'professores',           colunas: ['id', 'nome', 'email', 'ativo'] },
    { nome: 'disciplinas',           colunas: ['id', 'nome', 'curso_id', 'periodo', 'carga_horaria', 'ativa'] },
    { nome: 'turmas',                colunas: ['id', 'nome', 'curso_id', 'periodo', 'ano', 'ativa', 'quantidade_alunos', 'curso'] },
    { nome: 'salas',                 colunas: ['id', 'numero', 'bloco', 'andar', 'tipo', 'capacidade', 'recursos', 'ativa', 'campus', 'telefone', 'email'] },
    { nome: 'horarios',              colunas: ['id', 'nome', 'horario_inicio', 'horario_fim'] },
    { nome: 'aulas',                 colunas: ['id', 'disciplina', 'professor_id', 'sala_id', 'curso', 'turma', 'horario_inicio', 'horario_fim', 'data_aula', 'periodo', 'dia_semana', 'data_criacao', 'ativa'] },
    { nome: 'aluno_turmas',          colunas: ['id', 'aluno_id', 'turma_id', 'data_matricula', 'status'] },
    { nome: 'professores_favoritos', colunas: ['id', 'aluno_id', 'professor_id', 'data_adicao'] }
];

/** Tabelas cuja sequence precisa ser reposicionada ao fim. */
const SEQUENCES = TABELAS.map((t) => t.nome);

function lerSqlite(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
}

/** Colunas que o schema declara como numéricas. */
const COLUNAS_NUMERICAS = new Set([
    'id', 'periodo', 'ano', 'andar', 'capacidade', 'duracao', 'total_periodos',
    'carga_horaria', 'quantidade_alunos', 'dia_semana', 'ativo', 'ativa', 'used',
    'curso_id', 'sala_id', 'professor_id', 'aluno_id', 'turma_id', 'user_id'
]);

/** Correções aplicadas, para relatar ao fim. */
const correcoes = [];

/**
 * Normaliza valores do SQLite para o Postgres.
 *
 * O SQLite tem tipagem frouxa: uma coluna declarada INTEGER aceita
 * texto. Esse banco tem exatamente um caso — `aulas.periodo` com
 * "5º Período" em vez de 5, provavelmente o rótulo da interface gravado
 * no lugar do valor. O Postgres recusa. Aqui o número é extraído e a
 * correção fica registrada, em vez de a migração parar ou o dado ser
 * descartado em silêncio.
 */
function normalizar(valor, coluna, tabela, id) {
    if (valor === undefined) return null;

    if (valor === '') {
        return COLUNAS_NUMERICAS.has(coluna) || coluna.startsWith('data_') ? null : '';
    }

    if (COLUNAS_NUMERICAS.has(coluna) && typeof valor === 'string') {
        const digitos = valor.match(/-?\d+/);

        if (!digitos) {
            correcoes.push({ tabela, id, coluna, de: valor, para: null, motivo: 'sem dígitos' });
            return null;
        }

        const numero = Number(digitos[0]);
        correcoes.push({ tabela, id, coluna, de: valor, para: numero, motivo: 'texto em coluna numérica' });
        return numero;
    }

    return valor;
}

async function main() {
    if (!fs.existsSync(origem)) {
        console.error(`❌ Banco SQLite não encontrado: ${origem}`);
        console.error('   Passe o caminho: node scripts/migrate-data.js /caminho/unimap.db');
        process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL ausente.');
        process.exit(1);
    }

    console.log(`📖 Origem:  ${origem}`);
    console.log(`📝 Destino: Postgres\n`);

    const sqlite = new sqlite3.Database(origem, sqlite3.OPEN_READONLY);

    // Duas formas de falar com o Postgres:
    //
    //   - `pg` sobre a porta 5432, o caminho normal;
    //   - driver serverless do Neon sobre HTTPS, para quando a 5432
    //     estiver bloqueada pela rede (foi o caso no ambiente onde esta
    //     migração rodou pela primeira vez). Só serve para Neon.
    //
    // MIGRATE_VIA_HTTP=1 força o segundo.
    const viaHttp = process.env.MIGRATE_VIA_HTTP === '1'
        && /neon\.tech/.test(process.env.DATABASE_URL);

    let pool;
    if (viaHttp) {
        const { neon } = require('@neondatabase/serverless');
        const sqlHttp = neon(process.env.DATABASE_URL);
        console.log('🌐 Conectando por HTTPS (driver serverless do Neon)\n');

        // Mesma superfície que o código abaixo usa do Pool.
        pool = {
            query: async (texto, valores) => {
                const linhas = await sqlHttp.query(texto, valores);
                return { rows: linhas, rowCount: Array.isArray(linhas) ? linhas.length : 0 };
            },
            end: async () => {}
        };
    } else {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: /localhost|127\.0\.0\.1|\/tmp/.test(process.env.DATABASE_URL)
                ? false
                : { rejectUnauthorized: true }
        });
    }

    const resumo = [];

    try {
        for (const { nome, colunas } of TABELAS) {
            let linhas;
            try {
                linhas = await lerSqlite(sqlite, `SELECT ${colunas.join(', ')} FROM ${nome}`);
            } catch (err) {
                console.log(`⏭️  ${nome}: não existe na origem (${err.message})`);
                resumo.push({ tabela: nome, origem: 0, destino: 0, pulado: true });
                continue;
            }

            if (linhas.length === 0) {
                console.log(`⏭️  ${nome}: vazia na origem`);
                resumo.push({ tabela: nome, origem: 0, destino: 0 });
                continue;
            }

            const listaColunas = colunas.join(', ');
            let inseridos = 0;

            // Lotes para não montar um statement gigante com 2912 salas.
            const LOTE = 200;
            for (let i = 0; i < linhas.length; i += LOTE) {
                const fatia = linhas.slice(i, i + LOTE);
                const valores = [];
                const grupos = [];

                fatia.forEach((linha, idx) => {
                    const ph = colunas.map((_, c) => `$${idx * colunas.length + c + 1}`);
                    grupos.push(`(${ph.join(', ')})`);
                    colunas.forEach((col) => valores.push(normalizar(linha[col], col, nome, linha.id)));
                });

                const res = await pool.query(
                    `INSERT INTO ${nome} (${listaColunas})
                     VALUES ${grupos.join(', ')}
                     ON CONFLICT (id) DO NOTHING`,
                    valores
                );
                inseridos += res.rowCount || 0;
            }

            const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM ${nome}`);
            console.log(`✅ ${nome.padEnd(22)} ${String(linhas.length).padStart(5)} na origem → ${String(rows[0].total).padStart(5)} no destino`);
            resumo.push({ tabela: nome, origem: linhas.length, destino: rows[0].total, inseridos });
        }

        // Sequences: sem isso o próximo insert automático começaria em 1 e
        // colidiria com os ids migrados.
        console.log('\n🔢 Reposicionando sequences...');
        for (const tabela of SEQUENCES) {
            await pool.query(`
                SELECT setval(
                    pg_get_serial_sequence('${tabela}', 'id'),
                    COALESCE((SELECT MAX(id) FROM ${tabela}), 1),
                    (SELECT COUNT(*) > 0 FROM ${tabela})
                )
            `);
        }
        console.log('✅ Sequences alinhadas com MAX(id)');

        // Conferência final
        console.log('\n📊 Resultado:');
        let divergencias = 0;
        for (const r of resumo) {
            if (r.pulado) continue;
            const ok = r.destino >= r.origem;
            if (!ok) divergencias++;
            console.log(`   ${ok ? '✓' : '✗'} ${r.tabela.padEnd(22)} origem ${String(r.origem).padStart(5)} | destino ${String(r.destino).padStart(5)}`);
        }

        if (correcoes.length > 0) {
            console.log(`\n🔧 ${correcoes.length} valor(es) corrigido(s) na passagem:`);
            for (const c of correcoes) {
                console.log(`   ${c.tabela}.${c.coluna} (id ${c.id}): ${JSON.stringify(c.de)} → ${JSON.stringify(c.para)}  [${c.motivo}]`);
            }
        }

        if (divergencias > 0) {
            console.error(`\n❌ ${divergencias} tabela(s) com menos linhas no destino.`);
            process.exitCode = 1;
        } else {
            console.log('\n✅ Migração concluída. Nenhuma divergência.');
        }
    } finally {
        sqlite.close();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('❌ Migração falhou:', err.message);
    if (err.detail) console.error('   detalhe:', err.detail);
    process.exit(1);
});
