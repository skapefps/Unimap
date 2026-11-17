#!/usr/bin/env node
/**
 * Liga cada registro de `professores` a uma conta em `usuarios`.
 *
 * Roda uma vez, depois da migration 002. Idempotente: só preenche
 * `usuario_id` onde ainda está nulo.
 *
 * Regras, nesta ordem:
 *
 *   1. Existe usuário com o mesmo email → liga a ele.
 *   2. Não existe → cria um, sem senha, `ativo` igual ao do registro de
 *      professor. Sem senha ele não entra por senha; o primeiro acesso
 *      é pela recuperação de senha, que agora o alcança.
 *   3. `tipo` do usuário vira 'professor' apenas quando o registro de
 *      professor está ativo E o usuário não é admin. Um admin que
 *      também dá aula continua admin; um registro de professor inativo
 *      não rebaixa a conta de ninguém.
 *
 * Uso: node scripts/unifica-professores.js [--dry-run]
 */
require('dotenv').config();

const { Pool } = require('pg');

const simulacao = process.argv.includes('--dry-run');

function criarPool() {
    const { DATABASE_URL } = process.env;
    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL ausente.');
        process.exit(1);
    }

    const local = /localhost|127\.0\.0\.1|\/tmp/.test(DATABASE_URL);

    if (!local && process.env.MIGRATE_VIA_HTTP === '1' && /neon\.tech/.test(DATABASE_URL)) {
        const { neon } = require('@neondatabase/serverless');
        const sql = neon(DATABASE_URL);
        console.log('🌐 Conectando por HTTPS (driver serverless do Neon)\n');
        return {
            query: async (texto, valores) => {
                const linhas = await sql.query(texto, valores);
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
    const pool = criarPool();

    if (simulacao) console.log('🔎 Simulação: nada será gravado.\n');

    try {
        const { rows: professores } = await pool.query(`
            SELECT p.id, p.nome, p.email, p.ativo, p.usuario_id,
                   u.id AS usuario_existente, u.tipo AS tipo_atual, u.nome AS usuario_nome
              FROM professores p
              LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(p.email)
             ORDER BY p.id
        `);

        if (professores.length === 0) {
            console.log('Nenhum professor cadastrado.');
            return;
        }

        let ligados = 0, criados = 0, promovidos = 0, jaOk = 0;

        for (const p of professores) {
            if (p.usuario_id) {
                console.log(`⏭️  ${p.nome} (prof ${p.id}): já ligado ao usuário ${p.usuario_id}`);
                jaOk++;
                continue;
            }

            let usuarioId = p.usuario_existente;
            let tipoAtual = p.tipo_atual;

            if (!usuarioId) {
                if (simulacao) {
                    console.log(`➕ ${p.nome} (prof ${p.id}): criaria usuário para ${p.email}`);
                    criados++;
                    continue;
                }

                // Sem senha: o primeiro acesso é pela recuperação de senha.
                const { rows } = await pool.query(
                    `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
                     VALUES ($1, $2, '', 'professor', $3)
                     RETURNING id`,
                    [p.nome, p.email.toLowerCase(), p.ativo]
                );
                usuarioId = rows[0].id;
                tipoAtual = 'professor';
                criados++;
                console.log(`➕ ${p.nome} (prof ${p.id}): usuário ${usuarioId} criado, sem senha`);
            } else {
                console.log(`🔗 ${p.nome} (prof ${p.id}): ligado ao usuário ${usuarioId} (${tipoAtual})`);
                ligados++;
            }

            if (!simulacao) {
                await pool.query('UPDATE professores SET usuario_id = $1 WHERE id = $2', [usuarioId, p.id]);
            }

            // Promove só quando o vínculo está ativo e a conta não é admin.
            const devePromover = p.ativo === 1 && tipoAtual !== 'admin' && tipoAtual !== 'professor';
            if (devePromover) {
                if (!simulacao) {
                    await pool.query("UPDATE usuarios SET tipo = 'professor' WHERE id = $1", [usuarioId]);
                }
                promovidos++;
                console.log(`   ↳ tipo: ${tipoAtual} → professor`);
            } else if (tipoAtual === 'admin') {
                console.log('   ↳ tipo mantido: admin (um admin que dá aula continua admin)');
            } else if (p.ativo !== 1) {
                console.log(`   ↳ tipo mantido: ${tipoAtual} (vínculo de professor inativo)`);
            }
        }

        console.log(`\n📊 ${professores.length} registro(s): ${jaOk} já ok, ${ligados} ligado(s), ${criados} usuário(s) criado(s), ${promovidos} promovido(s).`);

        if (!simulacao) {
            const { rows: pendentes } = await pool.query(
                'SELECT COUNT(*)::int AS n FROM professores WHERE usuario_id IS NULL'
            );
            if (pendentes[0].n > 0) {
                console.error(`\n❌ ${pendentes[0].n} professor(es) seguem sem usuário.`);
                process.exitCode = 1;
            } else {
                console.log('✅ Todos os professores têm conta em usuarios.');
            }
        }
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('❌ Falhou:', err.message);
    if (err.detail) console.error('  ', err.detail);
    process.exit(1);
});
