/**
 * Testes de hardening.
 *
 * Cada teste usa um X-Forwarded-For próprio: com `trust proxy` ligado,
 * o rate limit conta por aquele IP, então um teste que estoura o limite
 * não derruba os outros.
 */
const request = require('supertest');
const h = require('./helpers/app');

const { app, SENHA_PADRAO } = h;

/** IP falso único por teste, para isolar as contagens do rate limit. */
let contadorIp = 0;
const ipUnico = () => `203.0.113.${(contadorIp++ % 250) + 1}`;

beforeAll(async () => {
    await h.aguardarSchema();
    await h.resetDb();
    await h.seed();
}, 40000);

afterAll(() => h.limpar());

describe('Headers de segurança (helmet)', () => {
    test('resposta traz x-content-type-options', async () => {
        const res = await request(app).get('/api/status');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('resposta traz x-frame-options ou CSP com frame-ancestors', async () => {
        const res = await request(app).get('/api/status');
        const temFrameOptions = Boolean(res.headers['x-frame-options']);
        const csp = res.headers['content-security-policy'] || '';
        expect(temFrameOptions || csp.includes('frame-ancestors')).toBe(true);
    });

    test('não revela o servidor no header x-powered-by', async () => {
        const res = await request(app).get('/api/status');
        expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('CSP permite o Google Identity Services, usado no login', async () => {
        const res = await request(app).get('/login.html');
        const csp = res.headers['content-security-policy'];

        if (csp) {
            expect(csp).toMatch(/accounts\.google\.com|gstatic|googleapis/);
        }
    });
});

describe('Rate limit', () => {
    test('6ª tentativa de login no mesmo IP devolve 429', async () => {
        const ip = ipUnico();

        for (let i = 1; i <= 5; i++) {
            const res = await request(app)
                .post('/api/auth/login')
                .set('X-Forwarded-For', ip)
                .send({ email: 'aluno@teste.unimap', senha: 'senhaErrada' });
            expect(res.status).toBe(401);
        }

        const sexta = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ip)
            .send({ email: 'aluno@teste.unimap', senha: 'senhaErrada' });

        expect(sexta.status).toBe(429);
    });

    test('o limite é por IP: outro IP continua passando', async () => {
        const ipBloqueado = ipUnico();
        const ipLivre = ipUnico();

        for (let i = 0; i < 6; i++) {
            await request(app)
                .post('/api/auth/login')
                .set('X-Forwarded-For', ipBloqueado)
                .send({ email: 'aluno@teste.unimap', senha: 'errada' });
        }

        const outro = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipLivre)
            .send({ email: 'aluno@teste.unimap', senha: SENHA_PADRAO });

        expect(outro.status).toBe(200);
    });

    test('resposta 429 traz retry-after', async () => {
        const ip = ipUnico();
        for (let i = 0; i < 6; i++) {
            await request(app).post('/api/auth/login').set('X-Forwarded-For', ip)
                .send({ email: 'aluno@teste.unimap', senha: 'errada' });
        }
        const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', ip)
            .send({ email: 'aluno@teste.unimap', senha: 'errada' });

        expect(res.status).toBe(429);
        expect(res.headers['retry-after'] || res.headers['ratelimit-reset']).toBeDefined();
    });

    test('forgot-password tem limite mais apertado (4ª tentativa barra)', async () => {
        const ip = ipUnico();

        for (let i = 0; i < 3; i++) {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .set('X-Forwarded-For', ip)
                .send({ email: 'alguem@teste.unimap' });
            expect(res.status).toBe(200);
        }

        const quarta = await request(app)
            .post('/api/auth/forgot-password')
            .set('X-Forwarded-For', ip)
            .send({ email: 'alguem@teste.unimap' });

        expect(quarta.status).toBe(429);
    });

    test('GET de leitura não é barrado pelo limite de login', async () => {
        const ip = ipUnico();
        for (let i = 0; i < 6; i++) {
            await request(app).post('/api/auth/login').set('X-Forwarded-For', ip)
                .send({ email: 'aluno@teste.unimap', senha: 'errada' });
        }

        const res = await request(app).get('/api/status').set('X-Forwarded-For', ip);
        expect(res.status).toBe(200);
    });
});

describe('Rotas de debug', () => {
    test('não existem quando NODE_ENV é production', async () => {
        // O app de teste roda com NODE_ENV=test, onde o debug segue
        // montado. Aqui se verifica a decisão, não o efeito.
        const { debugHabilitado } = require('../server');
        expect(typeof debugHabilitado).toBe('boolean');

        const original = process.env.NODE_ENV;
        try {
            process.env.NODE_ENV = 'production';
            jest.resetModules();
            const appProd = require('../server');
            const res = await request(appProd).get('/api/debug/tabelas');
            expect(res.status).toBe(404);
        } finally {
            process.env.NODE_ENV = original;
            jest.resetModules();
        }
    });
});

describe('Validação de entrada', () => {
    let adminToken;

    beforeAll(async () => {
        adminToken = await h.loginAs('admin');
    });

    const comoAdmin = (req) =>
        req.set('Authorization', `Bearer ${adminToken}`).set('X-Forwarded-For', ipUnico());

    test('POST /api/cursos sem nome devolve 400', async () => {
        const res = await comoAdmin(request(app).post('/api/cursos')).send({ duracao: 8 });
        expect(res.status).toBe(400);
    });

    test('registro com senha curta devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .set('X-Forwarded-For', ipUnico())
            .send({ nome: 'Senha Curta', email: `curta-${Date.now()}@teste.unimap`, senha: '123' });

        expect(res.status).toBe(400);
    });

    test('registro com email malformado devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .set('X-Forwarded-For', ipUnico())
            .send({ nome: 'Email Ruim', email: 'nao-e-email', senha: 'senhaValida123' });

        expect(res.status).toBe(400);
    });

    test('reset de senha com senha curta devolve 400', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .set('X-Forwarded-For', ipUnico())
            .send({ token: 'qualquer', novaSenha: '123' });

        expect(res.status).toBe(400);
    });

    test('corpo JSON malformado devolve 400, não 500', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .set('X-Forwarded-For', ipUnico())
            .send('{"email": isso nao e json}');

        expect(res.status).toBe(400);
        expect(res.status).not.toBe(500);
    });

    test('corpo gigante é rejeitado', async () => {
        const res = await request(app)
            .post('/api/cursos')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('X-Forwarded-For', ipUnico())
            .send({ nome: 'x'.repeat(2 * 1024 * 1024), duracao: 8 });

        expect([400, 413]).toContain(res.status);
    });
});

describe('Conta criada pelo Google', () => {
    test('login por senha explica que a conta é do Google', async () => {
        await h.run(
            `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
             VALUES (?, ?, 'google_oauth', 'aluno', 1)`,
            ['Via Google', 'via-google@teste.unimap']
        );

        const res = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: 'via-google@teste.unimap', senha: 'qualquerSenha123' });

        expect(res.status).toBe(401);
        // Mensagem precisa dar o caminho: a conta não tem senha própria.
        expect(res.body.error).toMatch(/google/i);
    });
});

describe('Healthcheck', () => {
    test('GET /api/health responde 200 com estado do banco', async () => {
        const res = await request(app).get('/api/health').set('X-Forwarded-For', ipUnico());

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.db).toBe('ok');
    });
});
