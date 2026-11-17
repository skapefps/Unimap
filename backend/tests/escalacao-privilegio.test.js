/**
 * Regressão: token de professor não pode valer como token de usuário.
 *
 * `usuarios` e `professores` são tabelas de identidade separadas, com
 * sequences independentes — o professor de id 1 e o usuário de id 1 são
 * pessoas diferentes. O JWT carregava apenas `sub`, sem dizer de qual
 * tabela, então `authenticateToken` resolvia o token do professor 1
 * contra `usuarios WHERE id = 1`, que no banco de produção é o
 * administrador: acesso total de admin com credenciais de professor.
 *
 * A correção foi a claim `src` no token. Estes testes travam isso.
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const h = require('./helpers/app');
const { sign, ORIGEM } = require('../config/jwt');

const { app } = h;

let contadorIp = 0;
const ipUnico = () => `192.0.2.${(contadorIp++ % 250) + 1}`;

const SENHA_PROF = 'senhaDoProfessor123';

beforeAll(async () => {
    await h.aguardarSchema();
    await h.resetDb();
    await h.seed();
}, 40000);

afterAll(() => h.limpar());

/**
 * Garante um professor cujo id é igual ao id do admin em `usuarios` —
 * a condição exata que permitia a escalação.
 *
 * Idempotente: se o professor com esse id já existe (de um teste
 * anterior deste arquivo), devolve ele em vez de tentar inserir outro
 * com o mesmo id, o que violaria a chave primária.
 */
async function professorComIdDoAdmin() {
    const admin = await h.get("SELECT id FROM usuarios WHERE tipo = 'admin' LIMIT 1");
    const hash = await bcrypt.hash(SENHA_PROF, 10);

    const existente = await h.get('SELECT id, email FROM professores WHERE id = ?', [admin.id]);
    if (existente) {
        await h.run('UPDATE professores SET senha_hash = ?, ativo = 1 WHERE id = ?', [hash, admin.id]);
        return { email: existente.email, id: admin.id };
    }

    const email = `prof-colide-${Date.now()}@teste.unimap`;
    const { lastID } = await h.run(
        'INSERT INTO professores (nome, email, senha_hash, ativo) VALUES (?, ?, ?, 1)',
        ['Professor Colidente', email, hash]
    );

    if (lastID !== admin.id) {
        await h.run('UPDATE professores SET id = ? WHERE id = ?', [admin.id, lastID]);
    }

    return { email, id: admin.id };
}

describe('Token de professor não escala para admin', () => {
    test('rota de admin recusa token de professor com id igual ao do admin', async () => {
        const prof = await professorComIdDoAdmin();

        const login = await request(app)
            .post('/api/auth/login-professor')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: prof.email, senha: SENHA_PROF });

        expect(login.status).toBe(200);

        const res = await request(app)
            .get('/api/usuarios')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${login.body.token}`);

        expect(res.status).not.toBe(200);
        expect([401, 403]).toContain(res.status);
    });

    test('o token de professor declara a tabela de origem', async () => {
        const prof = await professorComIdDoAdmin();

        const login = await request(app)
            .post('/api/auth/login-professor')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: prof.email, senha: SENHA_PROF });

        const payload = jwt.decode(login.body.token);
        expect(payload.src).toBe(ORIGEM.PROFESSORES);
    });

    test('o token de usuário declara a tabela de origem', async () => {
        const token = await h.loginAs('admin');
        const payload = jwt.decode(token);
        expect(payload.src).toBe(ORIGEM.USUARIOS);
    });

    test('token forjado com src de professores não acessa rota de usuário', async () => {
        // Assinado com o segredo real, mas declarando a outra tabela.
        const forjado = sign({ id: h.usuarios.admin, tipo: 'admin' }, ORIGEM.PROFESSORES);

        const res = await request(app)
            .get('/api/usuarios')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${forjado}`);

        expect(res.status).toBe(403);
    });

    test('token de usuário não passa por authenticateProfessor', async () => {
        // tipo='professor' em `usuarios` não é o mesmo que estar em
        // `professores`: os ids vêm de sequences diferentes.
        const hash = await bcrypt.hash(SENHA_PROF, 10);
        const email = `usuario-tipo-prof-${Date.now()}@teste.unimap`;
        await h.run(
            `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
             VALUES (?, ?, ?, 'professor', 1)`,
            ['Usuario Tipo Professor', email, hash]
        );

        const login = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email, senha: SENHA_PROF });

        expect(login.status).toBe(200);
        expect(jwt.decode(login.body.token).src).toBe(ORIGEM.USUARIOS);
    });

    test('sign() recusa origem desconhecida', () => {
        expect(() => sign({ id: 1, tipo: 'admin' }, 'tabela_inventada')).toThrow();
    });
});
