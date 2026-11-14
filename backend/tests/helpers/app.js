/**
 * Helper compartilhado pelos testes.
 *
 * Roda contra um Postgres real — não um mock e não SQLite. A migração de
 * banco só está provada se este mesmo conjunto de testes, que passava em
 * SQLite, continuar passando aqui.
 *
 * Espera um Postgres acessível em DATABASE_URL (padrão: instância local
 * na porta 5433) com as migrations já aplicadas.
 */
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL
    || 'postgresql://postgres@localhost:5433/unimap_test';
process.env.JWT_SECRET = process.env.JWT_SECRET
    || 'segredo-de-teste-com-mais-de-32-caracteres-para-passar-na-validacao';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:3000';

const app = require('../../server');
const db = require('../../config/database');

const SENHA_PADRAO = 'senhaTeste123';

const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this && this.lastID, changes: this && this.changes });
        });
    });

const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });

/**
 * Confere que as migrations rodaram. Falha com mensagem útil em vez de
 * deixar cada teste quebrar com "relation does not exist".
 */
async function aguardarSchema() {
    const { TABELAS_ESPERADAS, verificarSchema } = require('../../utils/databaseInit');
    const { ok, faltando } = await verificarSchema();

    if (!ok) {
        throw new Error(
            `Schema de teste incompleto. Faltam: ${faltando.join(', ')}.\n` +
            `Rode: DATABASE_URL="${process.env.DATABASE_URL}" npm run migrate`
        );
    }
    return TABELAS_ESPERADAS;
}

/**
 * Esvazia as tabelas de dados, reiniciando as sequences.
 *
 * CASCADE é necessário por causa das FKs; RESTART IDENTITY devolve os
 * ids ao início para os testes poderem prever valores.
 */
async function resetDb() {
    await db.pool.query(`
        TRUNCATE
            professores_favoritos,
            aluno_turmas,
            password_reset_tokens,
            aulas,
            turmas,
            disciplinas,
            salas,
            professores,
            cursos,
            blocos,
            horarios,
            usuarios
        RESTART IDENTITY CASCADE
    `);
}

/** IDs dos usuários semeados, preenchidos por seed(). */
const usuarios = { admin: null, professor: null, aluno: null };

async function seed() {
    const hash = await bcrypt.hash(SENHA_PADRAO, 10);

    await run(`DELETE FROM usuarios WHERE email LIKE '%@teste.unimap'`);

    const criar = async (nome, email, tipo, extras = {}) => {
        const { lastID } = await run(
            `INSERT INTO usuarios (nome, email, matricula, curso, periodo, senha_hash, tipo, ativo)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [nome, email, extras.matricula || null, extras.curso || null,
             extras.periodo || null, hash, tipo]
        );
        return lastID;
    };

    usuarios.admin = await criar('Admin Teste', 'admin@teste.unimap', 'admin');
    usuarios.professor = await criar('Professor Teste', 'professor@teste.unimap', 'professor');
    usuarios.aluno = await criar('Aluno Teste', 'aluno@teste.unimap', 'aluno', {
        matricula: 'T000001', curso: 'Sistemas de Informação', periodo: 5
    });

    return usuarios;
}

/**
 * Faz login de verdade pela API e devolve o token.
 * Não gera o token localmente de propósito: o fluxo real é o que importa.
 */
async function loginAs(tipo) {
    const request = require('supertest');
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `${tipo}@teste.unimap`, senha: SENHA_PADRAO });

    if (!res.body || !res.body.token) {
        throw new Error(`Login de ${tipo} falhou: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.token;
}

/** Fecha o pool para o Jest não ficar com handle aberto. */
async function limpar() {
    try {
        await db.pool.end();
    } catch {
        // Pool já encerrado por outro arquivo de teste.
    }
}

module.exports = {
    app, db, run, get, all,
    aguardarSchema, resetDb, seed, loginAs, limpar,
    usuarios, SENHA_PADRAO
};
