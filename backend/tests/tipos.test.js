/**
 * Coerção de tipos nas rotas.
 *
 * O SQLite aceita tipo frouxo: gravar a string "5" numa coluna INTEGER
 * funciona. O Postgres é estrito e devolve erro 22P02
 * (invalid_text_representation). Como o frontend manda tudo via JSON de
 * formulário, onde números costumam chegar como string, estes testes
 * fixam o comportamento esperado: converter o que é convertível e
 * responder 400 — não 500 — no que não é.
 */
const request = require('supertest');
const h = require('./helpers/app');

const { app } = h;

let adminToken;

beforeAll(async () => {
    await h.aguardarSchema();
    await h.resetDb();
    await h.seed();
    adminToken = await h.loginAs('admin');
}, 40000);

afterAll(() => h.limpar());

const comoAdmin = (req) => req.set('Authorization', `Bearer ${adminToken}`);
const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

describe('Números chegando como string', () => {
    test('POST /api/turmas com periodo "5" string é aceito', async () => {
        const res = await comoAdmin(request(app).post('/api/turmas'))
            .send({ nome: `Turma Str ${uniq()}`, curso: 'Sistemas de Informação', periodo: '5', ano: '2026' });

        expect([200, 201]).toContain(res.status);
    });

    test('POST /api/salas com andar e capacidade string é aceito', async () => {
        const res = await comoAdmin(request(app).post('/api/salas'))
            .send({ numero: `S${uniq()}`, bloco: 'Z', andar: '2', tipo: 'Sala de Aula', capacidade: '40' });

        expect([200, 201]).toContain(res.status);
    });

    test('POST /api/cursos com duracao string é aceito', async () => {
        const res = await comoAdmin(request(app).post('/api/cursos'))
            .send({ nome: `Curso Str ${uniq()}`, duracao: '8', turno: 'Noturno', total_periodos: '8' });

        expect([200, 201]).toContain(res.status);
    });
});

describe('Valores não numéricos devolvem 400, não 500', () => {
    test('POST /api/turmas com periodo "abc"', async () => {
        const res = await comoAdmin(request(app).post('/api/turmas'))
            .send({ nome: `Turma Ruim ${uniq()}`, curso: 'Sistemas de Informação', periodo: 'abc', ano: 2026 });

        expect(res.status).toBe(400);
        expect(res.status).not.toBe(500);
    });

    test('POST /api/salas com andar "primeiro"', async () => {
        const res = await comoAdmin(request(app).post('/api/salas'))
            .send({ numero: `S${uniq()}`, bloco: 'Z', andar: 'primeiro', tipo: 'Sala de Aula', capacidade: 40 });

        expect(res.status).toBe(400);
    });

    test('POST /api/cursos com duracao "muitos anos"', async () => {
        const res = await comoAdmin(request(app).post('/api/cursos'))
            .send({ nome: `Curso Ruim ${uniq()}`, duracao: 'muitos anos', turno: 'Noturno' });

        expect(res.status).toBe(400);
    });

    test('GET /api/cursos/:id com id não numérico devolve 400 ou 404', async () => {
        const res = await comoAdmin(request(app).get('/api/cursos/abc'));
        expect([400, 404]).toContain(res.status);
        expect(res.status).not.toBe(500);
    });

    test('DELETE /api/salas/:id com id não numérico devolve 400 ou 404', async () => {
        const res = await comoAdmin(request(app).delete('/api/salas/xyz'));
        expect([400, 404]).toContain(res.status);
        expect(res.status).not.toBe(500);
    });
});

describe('Nulos e vazios', () => {
    test('POST /api/salas sem capacidade (opcional) é aceito', async () => {
        const res = await comoAdmin(request(app).post('/api/salas'))
            .send({ numero: `S${uniq()}`, bloco: 'Z', andar: 1, tipo: 'Sala de Aula' });

        expect([200, 201]).toContain(res.status);
    });

    test('POST /api/cursos com nome só de espaços devolve 400', async () => {
        const res = await comoAdmin(request(app).post('/api/cursos'))
            .send({ nome: '   ', duracao: 8, turno: 'Noturno' });

        expect(res.status).toBe(400);
    });
});
