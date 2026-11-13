const request = require('supertest');
const h = require('./helpers/app');

const { app, SENHA_PADRAO } = h;

beforeAll(async () => {
    await h.aguardarSchema();
    await h.seed();
}, 40000);

afterAll(() => h.limpar());

describe('POST /api/auth/login', () => {
    test('com senha correta devolve token e usuário', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'aluno@teste.unimap', senha: SENHA_PADRAO });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(0);
        expect(res.body.user.email).toBe('aluno@teste.unimap');
        expect(res.body.user.tipo).toBe('aluno');
        // A senha nunca volta na resposta.
        expect(res.body.user.senha_hash).toBeUndefined();
    });

    test('aceita login por matrícula', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ matricula: 'T000001', senha: SENHA_PADRAO });

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe('aluno@teste.unimap');
    });

    test('com senha errada devolve 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'aluno@teste.unimap', senha: 'senhaErrada' });

        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    test('sem senha devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'aluno@teste.unimap' });

        expect(res.status).toBe(400);
    });

    test('sem email nem matrícula devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ senha: SENHA_PADRAO });

        expect(res.status).toBe(400);
    });

    test('com email inexistente devolve 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'naoexiste@teste.unimap', senha: SENHA_PADRAO });

        expect(res.status).toBe(401);
    });
});

describe('POST /api/auth/register', () => {
    test('cria usuário novo', async () => {
        const email = `novo-${Date.now()}@teste.unimap`;
        const res = await request(app)
            .post('/api/auth/register')
            .send({ nome: 'Novo Aluno', email, senha: 'outraSenha123', matricula: `M${Date.now()}` });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // E consegue logar em seguida.
        const login = await request(app)
            .post('/api/auth/login')
            .send({ email, senha: 'outraSenha123' });
        expect(login.status).toBe(200);
    });

    test('com email duplicado devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ nome: 'Duplicado', email: 'aluno@teste.unimap', senha: 'qualquerSenha123' });

        expect(res.status).toBe(400);
    });

    test('sem nome devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: `sem-nome-${Date.now()}@teste.unimap`, senha: 'qualquerSenha123' });

        expect(res.status).toBe(400);
    });
});

describe('Proteção de rotas', () => {
    test('rota protegida sem header Authorization devolve 401', async () => {
        const res = await request(app).get('/api/usuarios');
        expect(res.status).toBe(401);
    });

    test('rota protegida com token lixo devolve 401 ou 403', async () => {
        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', 'Bearer isso-nao-e-um-token');
        expect([401, 403]).toContain(res.status);
    });

    test('aluno autenticado não acessa rota de admin', async () => {
        const token = await h.loginAs('aluno');
        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    test('admin autenticado acessa rota de admin', async () => {
        const token = await h.loginAs('admin');
        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    test('GET /api/usuarios/perfil devolve o próprio usuário', async () => {
        const token = await h.loginAs('aluno');
        const res = await request(app)
            .get('/api/usuarios/perfil')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('aluno@teste.unimap');
    });
});

describe('POST /api/auth/forgot-password', () => {
    test('com email inexistente devolve 200 sem revelar que não existe', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'ninguem@teste.unimap' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        // Mensagem genérica: não confirma nem nega a existência do email.
        expect(res.body.message).toMatch(/se o email existir/i);
    });

    test('sem email devolve 400', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({});
        expect(res.status).toBe(400);
    });
});

describe('GET /api/auth/verify-reset-token/:token', () => {
    test('token inexistente devolve 400', async () => {
        const res = await request(app).get('/api/auth/verify-reset-token/token-que-nao-existe');
        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/reset-password', () => {
    test('token inválido devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'invalido', novaSenha: 'novaSenha123' });
        expect(res.status).toBe(400);
    });

    test('sem novaSenha devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'qualquer' });
        expect(res.status).toBe(400);
    });
});
