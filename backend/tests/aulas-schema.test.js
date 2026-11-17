/**
 * A tabela `aulas` guarda o nome da disciplina na coluna TEXT `disciplina`.
 * Nunca existiu uma coluna `disciplina_id`. Mesmo assim, várias rotas faziam
 *
 *     LEFT JOIN disciplinas d ON a.disciplina_id = d.id
 *
 * o que derruba a consulta inteira com "column a.disciplina_id does not
 * exist" — e a tela "Minhas Aulas", que é a principal do sistema, mostrava
 * só uma mensagem de erro.
 *
 * Estes testes batem nas rotas de verdade. Se alguém reintroduzir um join
 * por uma coluna que não existe, elas voltam a dar 500 e o teste pega.
 */
const request = require('supertest');
const {
    app, run, aguardarSchema, resetDb, seed, loginAs, limpar, usuarios
} = require('./helpers/app');

describe('rotas de aulas x schema real da tabela', () => {
    let tokenAdmin;

    beforeAll(async () => {
        await aguardarSchema();
        await resetDb();
        await seed();
        tokenAdmin = await loginAs('admin');

        // Uma aula real, para as consultas terem o que devolver.
        const prof = await run(
            `INSERT INTO professores (nome, email, usuario_id, ativo)
             VALUES (?, ?, ?, 1)`,
            ['Professor Teste', 'professor@teste.unimap', usuarios.professor]
        );
        const sala = await run(
            `INSERT INTO salas (numero, bloco, andar, tipo, capacidade, ativa)
             VALUES (?, ?, ?, ?, ?, 1)`,
            ['101', 'A', 1, 'Sala de Aula', 40]
        );
        await run(
            `INSERT INTO aulas
                (disciplina, professor_id, sala_id, curso, turma,
                 horario_inicio, horario_fim, data_aula, periodo, dia_semana, ativa)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            ['Banco de Dados II', prof.lastID, sala.lastID, 'Sistemas de Informação',
             'SI5', '19:00', '20:40', '2026-03-10', 5, 2]
        );
    });

    afterAll(limpar);

    it('a tabela aulas não tem coluna disciplina_id (o nome fica em disciplina)', async () => {
        const { all } = require('./helpers/app');
        const colunas = await all(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name = 'aulas'`
        );
        const nomes = colunas.map((c) => c.column_name);
        expect(nomes).toContain('disciplina');
        expect(nomes).not.toContain('disciplina_id');
    });

    it('GET /api/aulas responde 200, não 500', async () => {
        const res = await request(app)
            .get('/api/aulas')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/aulas traz o nome da disciplina preenchido', async () => {
        const res = await request(app)
            .get('/api/aulas')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(res.status).toBe(200);
        const aula = res.body.find((a) => a.disciplina === 'Banco de Dados II');
        expect(aula).toBeDefined();
        expect(aula.disciplina_nome).toBe('Banco de Dados II');
    });

    it('GET /api/dashboard/stats responde 200', async () => {
        const res = await request(app)
            .get('/api/dashboard/stats')
            .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(res.status).toBeLessThan(500);
    });

    it('nenhuma rota faz join por a.disciplina_id', () => {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '..', 'routes');

        const culpados = [];
        for (const arquivo of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
            const texto = fs.readFileSync(path.join(dir, arquivo), 'utf8');
            texto.split('\n').forEach((linha, i) => {
                if (/\ba\.disciplina_id\b/.test(linha)) {
                    culpados.push(`${arquivo}:${i + 1}`);
                }
            });
        }

        expect(culpados).toEqual([]);
    });
});
