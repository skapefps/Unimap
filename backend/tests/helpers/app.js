/**
 * Helper compartilhado pelos testes.
 *
 * Isola o banco (SQLITE_PATH aponta para arquivo temporário), espera o
 * initializeDatabase() terminar — ele é fire-and-forget com callbacks
 * encadeados e não expõe conclusão — e semeia usuários com senhas conhecidas.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');

const SENHA_PADRAO = 'senhaTeste123';

// Precisa ser definido antes de require('../../server'), que carrega o banco.
const dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'unimap-test-')),
    'test.db'
);
process.env.SQLITE_PATH = dbFile;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET
    || 'segredo-de-teste-com-mais-de-32-caracteres-para-passar-na-validacao';
process.env.APP_URL = 'http://localhost:3000';

const app = require('../../server');
const db = require('../../config/database');

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

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * initializeDatabase() cria 12 tabelas mas NÃO cria `usuarios` — bug
 * pré-existente que deixa o sistema inoperante em banco novo. O schema
 * abaixo é o de database/script.sql, que é o que roda em produção hoje.
 * A correção definitiva são as migrations SQL (Task 4); aqui só
 * destravamos os testes contra SQLite.
 */
const SCHEMA_USUARIOS = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        nome          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        matricula     TEXT UNIQUE,
        tipo          TEXT DEFAULT 'aluno',
        curso         TEXT,
        periodo       INTEGER,
        senha_hash    TEXT NOT NULL,
        ativo         BOOLEAN DEFAULT 1,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;

/**
 * O schema é criado de forma assíncrona na importação do server.
 * Espera até que as tabelas que os testes usam existam.
 */
async function aguardarSchema(timeoutMs = 20000) {
    const tabelas = ['usuarios', 'cursos', 'salas', 'turmas', 'disciplinas', 'professores', 'aulas'];
    const limite = Date.now() + timeoutMs;

    await run(SCHEMA_USUARIOS);

    while (Date.now() < limite) {
        try {
            const presentes = await all(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${tabelas.map(() => '?').join(',')})`,
                tabelas
            );
            if (presentes.length === tabelas.length) {
                // O seed do initializeDatabase ainda pode estar em voo; dá uma folga.
                await esperar(500);
                return;
            }
        } catch {
            // Banco ainda inicializando.
        }
        await esperar(200);
    }
    throw new Error('Timeout esperando o schema do banco de testes');
}

/** IDs dos usuários semeados, preenchidos por seed(). */
const usuarios = { admin: null, professor: null, aluno: null };

async function seed() {
    const hash = await bcrypt.hash(SENHA_PADRAO, 10);

    // Remove usuários de teste anteriores sem tocar nos seeds do initializeDatabase.
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
 * Deliberadamente não gera o token localmente: queremos exercitar o fluxo real.
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

function limpar() {
    try {
        fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
    } catch {
        // Diretório temporário; falha na limpeza não importa.
    }
}

module.exports = {
    app, db, run, get, all,
    aguardarSchema, seed, loginAs, limpar,
    usuarios, SENHA_PADRAO, dbFile
};
