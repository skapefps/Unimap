/**
 * Identidade unificada de professor.
 *
 * Antes: `professores` era uma segunda tabela de identidade, com senha
 * própria e sequence própria. Consequências: nenhum professor tinha
 * senha, a recuperação de senha (escrita para `usuarios`) não os
 * alcançava, e o id colidente abria uma escalação de privilégio.
 *
 * Agora: a conta vive em `usuarios`, como a de todo mundo. `professores`
 * guarda só o vínculo acadêmico — é para o id dela que `aulas` e
 * `professores_favoritos` apontam — e ganha `usuario_id` ligando as
 * duas. Login, senha e recuperação passam a ter um caminho só.
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const h = require('./helpers/app');
const { ORIGEM } = require('../config/jwt');

const { app, SENHA_PADRAO } = h;

let contadorIp = 0;
const ipUnico = () => `198.18.0.${(contadorIp++ % 250) + 1}`;

beforeAll(async () => {
    await h.aguardarSchema();
    await h.resetDb();
    await h.seed();
}, 40000);

afterAll(() => h.limpar());

/** Cria uma conta de professor completa: usuário + vínculo acadêmico. */
async function criarProfessor(nome, email, senha = SENHA_PADRAO) {
    const hash = await bcrypt.hash(senha, 10);
    const u = await h.run(
        `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
         VALUES (?, ?, ?, 'professor', 1)`,
        [nome, email, hash]
    );
    const p = await h.run(
        'INSERT INTO professores (nome, email, usuario_id, ativo) VALUES (?, ?, ?, 1)',
        [nome, email, u.lastID]
    );
    return { usuarioId: u.lastID, professorId: p.lastID, email, senha };
}

describe('Schema', () => {
    test('professores tem usuario_id ligando a usuarios', async () => {
        const col = await h.get(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'professores' AND column_name = 'usuario_id'`);
        expect(col).toBeDefined();
    });

    test('professores não guarda mais senha', async () => {
        const col = await h.get(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'professores' AND column_name = 'senha_hash'`);
        expect(col).toBeUndefined();
    });
});

describe('Login de professor pelo caminho único', () => {
    test('professor entra pelo /api/auth/login normal', async () => {
        const p = await criarProfessor('Prof Unificado', `pu-${Date.now()}@teste.unimap`);

        const res = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: p.email, senha: p.senha });

        expect(res.status).toBe(200);
        expect(res.body.user.tipo).toBe('professor');
        expect(jwt.decode(res.body.token).src).toBe(ORIGEM.USUARIOS);
    });

    test('a resposta do login traz o professor_id do vínculo acadêmico', async () => {
        const p = await criarProfessor('Prof Com Vinculo', `pcv-${Date.now()}@teste.unimap`);

        const res = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: p.email, senha: p.senha });

        // O frontend precisa disso para buscar as aulas, que apontam
        // para professores.id, não para usuarios.id.
        expect(res.body.user.professor_id).toBe(p.professorId);
    });

    test('aluno não recebe professor_id', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: 'aluno@teste.unimap', senha: SENHA_PADRAO });

        expect(res.body.user.professor_id).toBeFalsy();
    });
});

describe('Recuperação de senha agora alcança o professor', () => {
    test('forgot-password encontra o professor e gera token', async () => {
        const p = await criarProfessor('Prof Esqueceu', `pe-${Date.now()}@teste.unimap`);

        const res = await request(app)
            .post('/api/auth/forgot-password')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: p.email });

        expect(res.status).toBe(200);

        // A prova real: o token foi gravado para aquele usuário.
        const token = await h.get(
            'SELECT token FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC',
            [p.usuarioId]
        );
        expect(token).toBeDefined();
    });

    test('professor redefine a senha e entra com ela', async () => {
        const p = await criarProfessor('Prof Redefine', `pr-${Date.now()}@teste.unimap`);

        await request(app)
            .post('/api/auth/forgot-password')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: p.email });

        const { token } = await h.get(
            'SELECT token FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC',
            [p.usuarioId]
        );

        const reset = await request(app)
            .post('/api/auth/reset-password')
            .set('X-Forwarded-For', ipUnico())
            .send({ token, novaSenha: 'novaSenhaProf123' });

        expect(reset.status).toBe(200);

        const login = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: p.email, senha: 'novaSenhaProf123' });

        expect(login.status).toBe(200);
    });
});

describe('Autorização de professor', () => {
    test('token de professor acessa rota de professor', async () => {
        const p = await criarProfessor('Prof Autoriza', `pa-${Date.now()}@teste.unimap`);

        const login = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: p.email, senha: p.senha });

        const res = await request(app)
            .get('/api/professores/meu-perfil')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${login.body.token}`);

        expect(res.status).toBe(200);
        expect(res.body.id ?? res.body.data?.id).toBe(p.professorId);
    });

    test('aluno não acessa rota de professor', async () => {
        const token = await h.loginAs('aluno');

        const res = await request(app)
            .get('/api/professores/meu-perfil')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });

    test('professor continua sem acessar rota de admin', async () => {
        const p = await criarProfessor('Prof Nao Admin', `pna-${Date.now()}@teste.unimap`);

        const login = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: p.email, senha: p.senha });

        const res = await request(app)
            .get('/api/usuarios')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${login.body.token}`);

        expect(res.status).toBe(403);
    });

    test('usuário tipo=professor sem vínculo acadêmico recebe 403, não 500', async () => {
        // Conta marcada como professor que ninguém ligou a um registro
        // em `professores`. Precisa falhar de forma limpa.
        const hash = await bcrypt.hash(SENHA_PADRAO, 10);
        const email = `orfao-${Date.now()}@teste.unimap`;
        await h.run(
            `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
             VALUES (?, ?, ?, 'professor', 1)`,
            ['Professor Orfao', email, hash]
        );

        const login = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email, senha: SENHA_PADRAO });

        expect(login.status).toBe(200);

        const res = await request(app)
            .get('/api/professores/meu-perfil')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${login.body.token}`);

        expect(res.status).toBe(403);
        expect(res.status).not.toBe(500);
    });
});

describe('Dados acadêmicos seguem intactos', () => {
    test('aulas continuam apontando para professores.id', async () => {
        const p = await criarProfessor('Prof Com Aula', `pca-${Date.now()}@teste.unimap`);

        await h.run(
            `INSERT INTO aulas (disciplina, professor_id, horario_inicio, horario_fim, data_aula, ativa)
             VALUES (?, ?, '19:00', '20:40', '2026-03-10', 1)`,
            ['Algoritmos', p.professorId]
        );

        const aula = await h.get(
            'SELECT disciplina FROM aulas WHERE professor_id = ?',
            [p.professorId]
        );
        expect(aula.disciplina).toBe('Algoritmos');
    });
});
