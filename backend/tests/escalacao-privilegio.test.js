/**
 * Regressão: o id de um professor não vale como id de usuário.
 *
 * Havia duas tabelas de identidade — `usuarios` e `professores` — com
 * sequences independentes, e o JWT carregava só `sub`, sem dizer de
 * qual delas. O token do professor 1 era resolvido contra
 * `usuarios WHERE id = 1`, que em produção é o Administrador: acesso
 * total de admin com credenciais de professor. Reproduzido em teste.
 *
 * A primeira correção foi a claim `src` no token. A correção definitiva
 * veio depois: `professores` deixou de ser tabela de identidade. A
 * conta vive em `usuarios`, e `professores` guarda o vínculo acadêmico
 * ligado por `usuario_id`. Nenhum token tem como apontar para
 * `professores.id`.
 *
 * Estes testes travam a garantia, que vale pelos dois motivos.
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
 * Cria um professor cujo `professores.id` é igual ao `usuarios.id` do
 * admin — a colisão exata que abria a escalação.
 */
async function professorComIdDoAdmin() {
    const admin = await h.get("SELECT id FROM usuarios WHERE tipo = 'admin' LIMIT 1");

    const existente = await h.get(
        'SELECT p.id, u.email FROM professores p JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?',
        [admin.id]
    );
    if (existente) return { email: existente.email, professorId: admin.id, adminId: admin.id };

    const hash = await bcrypt.hash(SENHA_PROF, 10);
    const email = `prof-colide-${Date.now()}@teste.unimap`;

    const u = await h.run(
        `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
         VALUES (?, ?, ?, 'professor', 1)`,
        ['Professor Colidente', email, hash]
    );
    const p = await h.run(
        'INSERT INTO professores (nome, email, usuario_id, ativo) VALUES (?, ?, ?, 1)',
        ['Professor Colidente', email, u.lastID]
    );

    if (p.lastID !== admin.id) {
        await h.run('UPDATE professores SET id = ? WHERE id = ?', [admin.id, p.lastID]);
    }

    return { email, professorId: admin.id, adminId: admin.id, usuarioId: u.lastID };
}

describe('O id do vínculo acadêmico não dá acesso de admin', () => {
    test('professor cujo registro tem o id do admin não acessa rota de admin', async () => {
        const prof = await professorComIdDoAdmin();

        const login = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: prof.email, senha: SENHA_PROF });

        expect(login.status).toBe(200);

        const res = await request(app)
            .get('/api/usuarios')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${login.body.token}`);

        expect(res.status).toBe(403);
    });

    test('o token aponta para a conta, nunca para o vínculo acadêmico', async () => {
        const prof = await professorComIdDoAdmin();

        const login = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: prof.email, senha: SENHA_PROF });

        const payload = jwt.decode(login.body.token);

        // sub = usuarios.id, que é diferente de professores.id.
        expect(payload.sub).not.toBe(prof.professorId);
        expect(payload.src).toBe(ORIGEM.USUARIOS);
    });

    test('o perfil devolvido é o do professor, não o do admin', async () => {
        const prof = await professorComIdDoAdmin();

        const login = await request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', ipUnico())
            .send({ email: prof.email, senha: SENHA_PROF });

        const res = await request(app)
            .get('/api/usuarios/perfil')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${login.body.token}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(prof.email);
        expect(res.body.tipo).toBe('professor');
    });
});

describe('Claims do token', () => {
    test('todo token emitido declara a tabela de origem', async () => {
        const token = await h.loginAs('admin');
        expect(jwt.decode(token).src).toBe(ORIGEM.USUARIOS);
    });

    test('token forjado com src de professores é recusado', async () => {
        // Assinado com o segredo real, mas declarando a outra origem.
        // Nenhuma rota aceita essa origem desde a unificação.
        const forjado = sign({ id: h.usuarios.admin, tipo: 'admin' }, ORIGEM.PROFESSORES);

        const res = await request(app)
            .get('/api/usuarios')
            .set('X-Forwarded-For', ipUnico())
            .set('Authorization', `Bearer ${forjado}`);

        expect(res.status).toBe(403);
    });

    test('sign() recusa origem desconhecida', () => {
        expect(() => sign({ id: 1, tipo: 'admin' }, 'tabela_inventada')).toThrow();
    });
});

describe('Modelo de identidade', () => {
    test('existe uma única tabela de contas', async () => {
        // `professores` não pode voltar a ter senha: seria uma segunda
        // tabela de identidade, e a colisão de ids volta com ela.
        const col = await h.get(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'professores' AND column_name = 'senha_hash'`);

        expect(col).toBeUndefined();
    });

    test('um usuário não pode ter dois vínculos acadêmicos', async () => {
        const hash = await bcrypt.hash(SENHA_PROF, 10);
        const email = `duplo-${Date.now()}@teste.unimap`;
        const u = await h.run(
            `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
             VALUES (?, ?, ?, 'professor', 1)`,
            ['Duplo Vinculo', email, hash]
        );

        await h.run(
            'INSERT INTO professores (nome, email, usuario_id, ativo) VALUES (?, ?, ?, 1)',
            ['Duplo Vinculo', email, u.lastID]
        );

        await expect(
            h.run(
                'INSERT INTO professores (nome, email, usuario_id, ativo) VALUES (?, ?, ?, 1)',
                ['Duplo Vinculo 2', `outro-${email}`, u.lastID]
            )
        ).rejects.toThrow();
    });
});
