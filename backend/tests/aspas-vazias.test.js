/**
 * No SQLite, "" é uma string vazia. No Postgres, aspas duplas delimitam
 * um IDENTIFICADOR, e "" é um identificador de tamanho zero — erro de
 * sintaxe que derruba a consulta inteira:
 *
 *   zero-length delimited identifier at or near """"
 *
 * Foi o que quebrou a tela de salas do admin: quatro consultas filtravam
 * com `coluna != ""`. Um identificador vazio nunca é SQL válido, então
 * traduzir "" para '' é sempre seguro.
 */
const request = require('supertest');
const { toPg } = require('../config/sql-translate');
const {
    app, aguardarSchema, resetDb, seed, loginAs, limpar
} = require('./helpers/app');

describe('toPg: aspas duplas vazias', () => {
    it('troca "" por string vazia', () => {
        expect(toPg('SELECT 1 WHERE bloco != ""'))
            .toContain("!= ''");
    });

    it('não sobra nenhuma aspa dupla vazia', () => {
        const saida = toPg('SELECT DISTINCT bloco FROM salas WHERE bloco != "" ORDER BY bloco');
        expect(saida).not.toContain('""');
    });

    it('preserva identificador com nome de verdade', () => {
        expect(toPg('SELECT "numero" FROM salas')).toContain('"numero"');
    });

    it('não mexe em "" dentro de um literal de texto', () => {
        const saida = toPg(`SELECT * FROM salas WHERE recursos = 'aspas "" literais'`);
        expect(saida).toContain(`'aspas "" literais'`);
    });
});

describe('nenhuma rota compara com aspas duplas vazias', () => {
    it('não há `!= ""` nem `= ""` em routes/', () => {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '..', 'routes');

        const culpados = [];
        for (const arquivo of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
            const texto = fs.readFileSync(path.join(dir, arquivo), 'utf8');
            texto.split('\n').forEach((linha, i) => {
                if (/(!=|<>|=)\s*""/.test(linha)) culpados.push(`${arquivo}:${i + 1}`);
            });
        }
        expect(culpados).toEqual([]);
    });
});

describe('GET /api/admin/salas/todos', () => {
    let token;

    beforeAll(async () => {
        await aguardarSchema();
        await resetDb();
        await seed();
        token = await loginAs('admin');
    });

    afterAll(limpar);

    it('responde 200, não 500', async () => {
        const res = await request(app)
            .get('/api/admin/salas/todos?page=1&limit=10&andar=todos&ativo=todos&busca=')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    it('devolve os valores distintos para os filtros', async () => {
        const res = await request(app)
            .get('/api/admin/salas/todos?page=1&limit=10')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.salas)).toBe(true);

        // As quatro listas de filtro vinham das consultas que quebravam.
        const filtros = res.body.data.filters;
        for (const chave of ['blocos', 'andares', 'tipos', 'campi']) {
            expect(Array.isArray(filtros[chave])).toBe(true);
        }
    });

    it('com salas cadastradas, o filtro de blocos vem preenchido', async () => {
        const { run } = require('./helpers/app');
        await run(
            `INSERT INTO salas (numero, bloco, andar, tipo, capacidade, ativa)
             VALUES (?, ?, ?, ?, ?, 1)`,
            ['301', 'Z', 3, 'Sala de Aula', 40]
        );

        const res = await request(app)
            .get('/api/admin/salas/todos?page=1&limit=10')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.filters.blocos).toContain('Z');
    });
});
