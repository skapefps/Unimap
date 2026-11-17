#!/usr/bin/env node
/**
 * Importa os locais reais do site de infraestrutura da UNIPAM.
 *
 * Origem: https://infraestrutura.unipam.edu.br — 390 locais com bloco,
 * telefone e responsáveis, publicados pela própria universidade.
 *
 * MOTIVO
 *
 * A tabela `salas` tinha 2.912 linhas que eram dados de teste gerados:
 * só 703 números distintos, cada um repetido até 5 vezes com tipo e
 * capacidade diferentes. "A001" existia ao mesmo tempo como
 * Laboratório, Sala de Reunião, Sala de Aula e Auditório. Nenhum aluno
 * acharia uma sala com isso.
 *
 * O QUE O SCRIPT FAZ
 *
 *   1. Copia a tabela atual para `salas_antigas_backup`.
 *   2. Insere os locais reais.
 *   3. Remapeia `aulas.sala_id` casando bloco e número; o que não casar
 *      fica NULL e é listado na saída.
 *   4. Remove as linhas antigas.
 *
 * Uso:
 *   node scripts/importa-infraestrutura.js --dry-run
 *   node scripts/importa-infraestrutura.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const simulacao = process.argv.includes('--dry-run');
const ARQUIVO = path.join(__dirname, 'unipam_real.json');

/** "Bloco F" -> "F". Locais sem letra viram uma sigla curta. */
function codigoDoBloco(nome) {
    const m = /^Bloco\s+(.+)$/i.exec(nome || '');
    if (m) return m[1].trim().toUpperCase();

    const sigla = /\(([A-Z]{2,6})\)\s*$/.exec(nome || '');
    if (sigla) return sigla[1];

    return (nome || 'OUTRO').split(/\s+/).map((p) => p[0]).join('').slice(0, 5).toUpperCase();
}

/**
 * Extrai o número da sala do nome do local.
 *
 * Os nomes variam: "Sala de Informática Azul A - 115 F",
 * "Sala de Tutoria 301 A", "Sala de Aula - 402 N e 404 N". O número é
 * o primeiro grupo de 2 a 4 dígitos; o resto do nome é preservado.
 */
function extrairNumero(nome) {
    const m = /(\d{2,4})/.exec(nome || '');
    return m ? m[1] : null;
}

/** O primeiro dígito do número é o piso: 412 fica no 4º. */
function andarDoNumero(numero) {
    if (!numero) return 0;
    const n = numero.length >= 3 ? Number(numero[0]) : 0;
    return Number.isFinite(n) && n >= 0 && n <= 9 ? n : 0;
}

/** Tipo do site -> vocabulário já usado pelo sistema. */
const TIPO = {
    'Salas de Aula Multidisciplinares': 'Sala de Aula',
    'Salas de Informática': 'Laboratório de Informática',
    'Laboratórios e Ambientes para Práticas Didáticas': 'Laboratório',
    'Auditórios': 'Auditório',
    'Clínicas e Centros Clínicos': 'Clínica',
    'Espaços de Convivência e de Alimentação': 'Convivência',
    'Órgãos Acadêmico-Administrativos e de Apoio': 'Administrativo'
};

function criarPool() {
    const { DATABASE_URL } = process.env;
    if (!DATABASE_URL) { console.error('❌ DATABASE_URL ausente.'); process.exit(1); }

    const local = /localhost|127\.0\.0\.1|\/tmp/.test(DATABASE_URL);

    if (!local && process.env.MIGRATE_VIA_HTTP === '1' && /neon\.tech/.test(DATABASE_URL)) {
        const { neon } = require('@neondatabase/serverless');
        const sql = neon(DATABASE_URL);
        console.log('🌐 Conectando por HTTPS\n');
        return {
            query: async (t, v) => {
                const linhas = await sql.query(t, v);
                return { rows: linhas, rowCount: Array.isArray(linhas) ? linhas.length : 0 };
            },
            end: async () => {}
        };
    }

    return new Pool({
        connectionString: DATABASE_URL,
        ssl: local ? false : { rejectUnauthorized: true }
    });
}

async function main() {
    if (!fs.existsSync(ARQUIVO)) {
        console.error(`❌ ${ARQUIVO} não encontrado.`);
        process.exit(1);
    }

    const { blocos, tipos, locais } = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));

    // Monta as linhas a inserir.
    const salas = [];
    const semNumero = [];

    for (const l of locais) {
        const nomeLocalizacao = blocos[l.IdLocalizacao];
        if (!nomeLocalizacao) continue;

        const bloco = codigoDoBloco(nomeLocalizacao);
        const numero = extrairNumero(l.Nome);

        if (!numero) semNumero.push(`${l.Nome} (${nomeLocalizacao})`);

        salas.push({
            numero: numero || l.Nome,
            bloco,
            andar: andarDoNumero(numero),
            tipo: TIPO[tipos[l.IdTipoLocal]] || 'Outro',
            // O nome completo do site vai para recursos: é onde está a
            // informação que distingue "Sala Amarela A" de "Azul B".
            recursos: l.Nome,
            telefone: l.Telefone || null,
            email: l.Email || null
        });
    }

    // Uma linha por (bloco, numero): o site repete alguns números em
    // tipos diferentes, e o sistema trata número como identificador.
    const unicas = new Map();
    for (const s of salas) {
        const chave = `${s.bloco}|${s.numero}`;
        if (!unicas.has(chave)) unicas.set(chave, s);
    }

    console.log(`📖 ${locais.length} locais no site`);
    console.log(`📦 ${unicas.size} salas únicas por (bloco, número)`);
    console.log(`ℹ️  ${semNumero.length} sem número no nome (viram o próprio nome)\n`);

    const porBloco = {};
    for (const s of unicas.values()) porBloco[s.bloco] = (porBloco[s.bloco] || 0) + 1;
    console.log('Por bloco:', Object.entries(porBloco)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([b, n]) => `${b}:${n}`).join('  '));

    if (simulacao) {
        console.log('\n🔎 Simulação: nada foi gravado.');
        console.log('\nPrimeiras 5 salas que seriam criadas:');
        for (const s of [...unicas.values()].slice(0, 5)) {
            console.log(`  ${s.bloco}-${s.numero} (${s.andar}º) ${s.tipo} — ${s.recursos.slice(0, 40)}`);
        }
        return;
    }

    const pool = criarPool();

    try {
        // 1. Backup
        await pool.query('DROP TABLE IF EXISTS salas_antigas_backup');
        await pool.query('CREATE TABLE salas_antigas_backup AS SELECT * FROM salas');
        const { rows: bkp } = await pool.query('SELECT COUNT(*)::int AS n FROM salas_antigas_backup');
        console.log(`\n💾 Backup: ${bkp[0].n} linhas em salas_antigas_backup`);

        // 2. Guarda o par (bloco, numero) de cada aula, para remapear.
        const { rows: aulas } = await pool.query(`
            SELECT a.id, s.bloco, s.numero
              FROM aulas a JOIN salas s ON s.id = a.sala_id
             WHERE a.sala_id IS NOT NULL
        `);
        console.log(`🔗 ${aulas.length} aula(s) com sala para remapear`);

        // 3. Insere as novas com ids novos, acima do maior id atual.
        const { rows: max } = await pool.query('SELECT COALESCE(MAX(id), 0)::int AS m FROM salas');
        let proximo = max[0].m + 1;

        const novas = new Map();
        const lote = [...unicas.values()];
        const TAM = 100;

        for (let i = 0; i < lote.length; i += TAM) {
            const fatia = lote.slice(i, i + TAM);
            const valores = [];
            const grupos = fatia.map((s, j) => {
                const id = proximo++;
                novas.set(`${s.bloco}|${s.numero}`, id);
                const base = j * 9;
                valores.push(id, s.numero, s.bloco, s.andar, s.tipo, s.recursos, s.telefone, s.email, 1);
                return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
            });

            await pool.query(
                `INSERT INTO salas (id, numero, bloco, andar, tipo, recursos, telefone, email, ativa)
                 VALUES ${grupos.join(',')}`,
                valores
            );
        }
        console.log(`✅ ${unicas.size} salas reais inseridas`);

        // 4. Remapeia as aulas
        let casadas = 0;
        const orfas = [];
        for (const a of aulas) {
            const id = novas.get(`${a.bloco}|${a.numero}`)
                // Número antigo "A308" -> bloco A, número 308
                ?? novas.get(`${a.bloco}|${String(a.numero).replace(/^[A-Z]+/, '')}`);

            if (id) {
                await pool.query('UPDATE aulas SET sala_id = $1 WHERE id = $2', [id, a.id]);
                casadas++;
            } else {
                await pool.query('UPDATE aulas SET sala_id = NULL WHERE id = $1', [a.id]);
                orfas.push(`aula ${a.id} (sala antiga ${a.bloco}-${a.numero})`);
            }
        }
        console.log(`🔗 ${casadas} aula(s) remapeada(s), ${orfas.length} sem sala correspondente`);
        for (const o of orfas) console.log(`     ${o}`);

        // 5. Remove as antigas
        const { rowCount } = await pool.query('DELETE FROM salas WHERE id <= $1', [max[0].m]);
        console.log(`🗑️  ${rowCount} linha(s) antiga(s) removida(s)`);

        await pool.query("SELECT setval(pg_get_serial_sequence('salas','id'), (SELECT MAX(id) FROM salas))");

        const { rows: fim } = await pool.query(
            'SELECT COUNT(*)::int AS n, COUNT(DISTINCT (bloco, numero))::int AS d FROM salas'
        );
        console.log(`\n✅ Agora: ${fim[0].n} salas, ${fim[0].d} pares (bloco, número) distintos`);
        if (fim[0].n !== fim[0].d) {
            console.error('❌ Ainda há duplicatas.');
            process.exitCode = 1;
        }
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('❌ Importação falhou:', err.message);
    if (err.detail) console.error('  ', err.detail);
    process.exit(1);
});
