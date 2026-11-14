/**
 * Testes do mecanismo de autenticação.
 *
 * O ponto central: antes desta task o `token` devolvido pelo login era
 * `user.id.toString()`, e `middleware/auth.js` apenas fazia parseInt e
 * buscava o ID. `Authorization: Bearer 1` dava acesso de admin sem senha.
 * O primeiro teste aqui é a regressão que impede isso de voltar.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const h = require('./helpers/app');

const { app, SENHA_PADRAO } = h;

beforeAll(async () => {
    await h.aguardarSchema();
    // Estado limpo: sem isso os testes acumulam dados entre execucoes
    // e passam a depender de ordem.
    await h.resetDb();
    await h.seed();
}, 40000);

afterAll(() => h.limpar());

describe('Token não pode ser o ID do usuário', () => {
    test('Bearer com ID numérico cru é rejeitado', async () => {
        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', 'Bearer 1');

        expect(res.status).toBe(401);
    });

    test('nenhum ID de 1 a 10 dá acesso', async () => {
        for (let id = 1; id <= 10; id++) {
            const res = await request(app)
                .get('/api/usuarios/perfil')
                .set('Authorization', `Bearer ${id}`);
            expect(res.status).toBe(401);
        }
    });

    test('o token emitido no login é um JWT, não um número', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@teste.unimap', senha: SENHA_PADRAO });

        expect(res.status).toBe(200);
        // Três segmentos separados por ponto.
        expect(res.body.token.split('.')).toHaveLength(3);
        expect(Number.isNaN(Number(res.body.token))).toBe(true);
    });
});

describe('Validação de assinatura e expiração', () => {
    test('JWT válido acessa rota protegida', async () => {
        const token = await h.loginAs('admin');
        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    test('JWT assinado com outro segredo é rejeitado', async () => {
        const falso = jwt.sign(
            { sub: h.usuarios.admin, tipo: 'admin' },
            'segredo-errado-mas-com-tamanho-suficiente-para-assinar',
            { expiresIn: '7d' }
        );

        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${falso}`);

        expect(res.status).toBe(401);
    });

    test('JWT com payload adulterado é rejeitado', async () => {
        const token = await h.loginAs('aluno');
        const [cabecalho, , assinatura] = token.split('.');

        // Troca o payload para se declarar admin, mantendo a assinatura original.
        const payloadFalso = Buffer
            .from(JSON.stringify({ sub: h.usuarios.aluno, tipo: 'admin' }))
            .toString('base64url');

        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${cabecalho}.${payloadFalso}.${assinatura}`);

        expect(res.status).toBe(401);
    });

    test('JWT expirado é rejeitado', async () => {
        const expirado = jwt.sign(
            { sub: h.usuarios.admin, tipo: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '-1s' }
        );

        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${expirado}`);

        expect(res.status).toBe(401);
    });

    test('header sem o esquema Bearer é rejeitado', async () => {
        const token = await h.loginAs('admin');
        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', token);

        expect(res.status).toBe(401);
    });
});

describe('Usuário desativado depois da emissão do token', () => {
    test('JWT válido de usuário desativado devolve 401, não 500 nem 200', async () => {
        // Usuário próprio, para não interferir nos outros testes.
        const hash = await bcrypt.hash(SENHA_PADRAO, 10);
        const { lastID } = await h.run(
            `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
             VALUES (?, ?, ?, 'admin', 1)`,
            ['Será Desativado', `desativado-${Date.now()}@teste.unimap`, hash]
        );

        const email = (await h.get('SELECT email FROM usuarios WHERE id = ?', [lastID])).email;

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email, senha: SENHA_PADRAO });
        expect(login.status).toBe(200);
        const token = login.body.token;

        // Token funciona enquanto o usuário está ativo.
        const antes = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${token}`);
        expect(antes.status).toBe(200);

        // Desativa e o mesmo token para de valer.
        await h.run('UPDATE usuarios SET ativo = 0 WHERE id = ?', [lastID]);

        const depois = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${token}`);
        expect(depois.status).toBe(401);
    });

    test('JWT de usuário deletado devolve 401, não 500', async () => {
        const hash = await bcrypt.hash(SENHA_PADRAO, 10);
        const email = `deletado-${Date.now()}@teste.unimap`;
        const { lastID } = await h.run(
            `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
             VALUES (?, ?, ?, 'aluno', 1)`,
            ['Será Deletado', email, hash]
        );

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email, senha: SENHA_PADRAO });
        const token = login.body.token;

        await h.run('DELETE FROM usuarios WHERE id = ?', [lastID]);

        const res = await request(app)
            .get('/api/usuarios/perfil')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
    });
});

describe('Login de professor', () => {
    const emailProf = `prof-login-${Date.now()}@teste.unimap`;
    const senhaProf = 'senhaDoProfessor123';

    beforeAll(async () => {
        const hash = await bcrypt.hash(senhaProf, 10);
        await h.run(
            `INSERT INTO professores (nome, email, senha_hash, ativo) VALUES (?, ?, ?, 1)`,
            ['Professor Com Senha', emailProf, hash]
        );
    });

    test('professor loga com a própria senha', async () => {
        const res = await request(app)
            .post('/api/auth/login-professor')
            .send({ email: emailProf, senha: senhaProf });

        expect(res.status).toBe(200);
        expect(res.body.token.split('.')).toHaveLength(3);
        expect(res.body.user.tipo).toBe('professor');
    });

    test('professor NÃO loga com a senha global prof123', async () => {
        const res = await request(app)
            .post('/api/auth/login-professor')
            .send({ email: emailProf, senha: 'prof123' });

        expect(res.status).toBe(401);
    });

    test('professor sem senha definida não loga com senha vazia', async () => {
        const emailSemSenha = `prof-sem-senha-${Date.now()}@teste.unimap`;
        await h.run(
            `INSERT INTO professores (nome, email, ativo) VALUES (?, ?, 1)`,
            ['Professor Sem Senha', emailSemSenha]
        );

        const res = await request(app)
            .post('/api/auth/login-professor')
            .send({ email: emailSemSenha, senha: '' });

        expect(res.status).toBe(400);
    });

    test('id do professor no token é numérico, não "prof_N"', async () => {
        const res = await request(app)
            .post('/api/auth/login-professor')
            .send({ email: emailProf, senha: senhaProf });

        expect(typeof res.body.user.id).toBe('number');
    });
});

describe('config/jwt.js', () => {
    const { sign, verify } = require('../config/jwt');

    test('sign devolve token que verify aceita', () => {
        const token = sign({ id: 42, tipo: 'aluno' });
        const payload = verify(token);

        expect(payload.sub).toBe(42);
        expect(payload.tipo).toBe('aluno');
    });

    test('verify lança em token adulterado', () => {
        const token = sign({ id: 42, tipo: 'aluno' });
        expect(() => verify(token.slice(0, -2) + 'xx')).toThrow();
    });

    test('o payload não carrega o hash da senha', () => {
        const token = sign({ id: 1, tipo: 'admin', senha_hash: '$2a$10$abcdef' });
        const payload = verify(token);

        expect(JSON.stringify(payload)).not.toContain('$2a$');
        expect(payload.senha_hash).toBeUndefined();
    });
});
