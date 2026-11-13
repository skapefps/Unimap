#!/usr/bin/env node
/**
 * Runner de migrations.
 *
 * Aplica em ordem alfabética todo .sql deste diretório que ainda não foi
 * aplicado, registrando os aplicados em `schema_migrations`. Idempotente:
 * rodar duas vezes não repete nada.
 *
 * Cada arquivo roda dentro de uma transação — se qualquer statement
 * falhar, o arquivo inteiro é revertido e o processo sai com código 1,
 * para o deploy não subir com schema pela metade.
 *
 * Uso: npm run migrate
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const DIRETORIO = __dirname;

async function main() {
    const { DATABASE_URL } = process.env;

    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL ausente. Preencha o .env.');
        process.exit(1);
    }

    const client = new Client({
        connectionString: DATABASE_URL,
        // Neon exige TLS; Postgres local de teste não tem certificado.
        ssl: /localhost|127\.0\.0\.1|\/tmp/.test(DATABASE_URL)
            ? false
            : { rejectUnauthorized: true }
    });

    await client.connect();
    console.log('📊 Conectado ao Postgres');

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                nome       TEXT PRIMARY KEY,
                checksum   TEXT NOT NULL,
                aplicada_em TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        const arquivos = fs.readdirSync(DIRETORIO)
            .filter((f) => f.endsWith('.sql'))
            .sort();

        if (arquivos.length === 0) {
            console.log('ℹ️  Nenhum arquivo .sql encontrado.');
            return;
        }

        const { rows } = await client.query('SELECT nome, checksum FROM schema_migrations');
        const aplicadas = new Map(rows.map((r) => [r.nome, r.checksum]));

        let novas = 0;

        for (const arquivo of arquivos) {
            const sql = fs.readFileSync(path.join(DIRETORIO, arquivo), 'utf8');
            const checksum = crypto.createHash('sha256').update(sql).digest('hex');

            if (aplicadas.has(arquivo)) {
                // Migration já aplicada que mudou de conteúdo: avisa, mas não
                // reaplica — reaplicar sobrescreveria estado de produção.
                if (aplicadas.get(arquivo) !== checksum) {
                    console.warn(`⚠️  ${arquivo} já aplicada, mas o conteúdo mudou.`);
                    console.warn('    Crie uma migration nova em vez de editar esta.');
                }
                continue;
            }

            console.log(`🔄 Aplicando ${arquivo}...`);

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (nome, checksum) VALUES ($1, $2)',
                    [arquivo, checksum]
                );
                await client.query('COMMIT');
                console.log(`✅ ${arquivo}`);
                novas++;
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ ${arquivo} falhou: ${err.message}`);
                throw err;
            }
        }

        const { rows: tabelas } = await client.query(`
            SELECT COUNT(*)::int AS total
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);

        console.log(
            novas > 0
                ? `✅ ${novas} migration(s) aplicada(s). ${tabelas[0].total} tabelas no schema.`
                : `✅ Schema já atualizado. ${tabelas[0].total} tabelas.`
        );
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('❌ Migração falhou:', err.message);
    process.exit(1);
});
