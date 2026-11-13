const request = require('supertest');
const h = require('./helpers/app');

const { app } = h;

let adminToken;
let alunoToken;

beforeAll(async () => {
    await h.aguardarSchema();
    await h.seed();
    adminToken = await h.loginAs('admin');
    alunoToken = await h.loginAs('aluno');
}, 40000);

afterAll(() => h.limpar());

const comoAdmin = (req) => req.set('Authorization', `Bearer ${adminToken}`);
const comoAluno = (req) => req.set('Authorization', `Bearer ${alunoToken}`);

/** Sufixo único por execução, para não colidir com dados já existentes. */
const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/**
 * As rotas não são consistentes no formato de resposta de criação:
 * cursos devolve { data: { id } }, disciplinas devolve { id },
 * salas devolve { id }. Esta função aceita as variantes em uso.
 */
function extrairId(body, chaveRecurso) {
    if (!body) return undefined;
    return body.id
        ?? body.data?.id
        ?? body[chaveRecurso]?.id
        ?? body[`${chaveRecurso}Id`]
        ?? body.lastID;
}

describe('Cursos', () => {
    let cursoId;

    test('admin cria curso', async () => {
        const res = await comoAdmin(request(app).post('/api/cursos'))
            .send({ nome: `Curso Teste ${uniq()}`, duracao: 8, turno: 'Noturno', total_periodos: 8 });

        expect([200, 201]).toContain(res.status);
        cursoId = extrairId(res.body, 'curso');
        expect(cursoId).toBeTruthy();
    });

    test('lista cursos inclui o criado', async () => {
        const res = await comoAdmin(request(app).get('/api/cursos'));
        expect(res.status).toBe(200);

        const lista = Array.isArray(res.body) ? res.body : (res.body.data || res.body.cursos || []);
        expect(lista.some((c) => c.id === cursoId)).toBe(true);
    });

    test('busca curso por id', async () => {
        const res = await comoAdmin(request(app).get(`/api/cursos/${cursoId}`));
        expect(res.status).toBe(200);
    });

    test('admin atualiza curso', async () => {
        const res = await comoAdmin(request(app).put(`/api/cursos/${cursoId}`))
            .send({ nome: `Curso Renomeado ${uniq()}`, duracao: 10, turno: 'Integral', total_periodos: 10 });
        expect([200, 204]).toContain(res.status);
    });

    test('POST sem nome devolve 400', async () => {
        const res = await comoAdmin(request(app).post('/api/cursos')).send({ duracao: 8 });
        expect(res.status).toBe(400);
    });

    test('aluno não cria curso', async () => {
        const res = await comoAluno(request(app).post('/api/cursos'))
            .send({ nome: `Proibido ${uniq()}`, duracao: 8 });
        expect(res.status).toBe(403);
    });

    test('admin remove curso', async () => {
        const res = await comoAdmin(request(app).delete(`/api/cursos/${cursoId}`));
        expect([200, 204]).toContain(res.status);
    });
});

describe('Salas', () => {
    let salaId;
    const numero = `T${uniq()}`;

    test('admin cria sala', async () => {
        const res = await comoAdmin(request(app).post('/api/salas'))
            .send({ numero, bloco: 'Z', andar: 1, tipo: 'Sala de Aula', capacidade: 40, recursos: 'Projetor' });

        expect([200, 201]).toContain(res.status);
        salaId = extrairId(res.body, 'sala');
        expect(salaId).toBeTruthy();
    });

    test('lista salas', async () => {
        const res = await comoAdmin(request(app).get('/api/salas'));
        expect(res.status).toBe(200);
    });

    test('busca sala por id', async () => {
        const res = await comoAdmin(request(app).get(`/api/salas/${salaId}`));
        expect(res.status).toBe(200);
    });

    test('GET /api/salas/blocos devolve lista de blocos', async () => {
        const res = await comoAdmin(request(app).get('/api/salas/blocos'));
        expect(res.status).toBe(200);

        const lista = Array.isArray(res.body) ? res.body : (res.body.data || res.body.blocos || []);
        expect(Array.isArray(lista)).toBe(true);
    });

    test('GET /api/salas/bloco/:bloco devolve salas do bloco', async () => {
        const res = await comoAdmin(request(app).get('/api/salas/bloco/Z'));
        expect(res.status).toBe(200);
    });

    test('admin atualiza sala', async () => {
        const res = await comoAdmin(request(app).put(`/api/salas/${salaId}`))
            .send({ numero, bloco: 'Z', andar: 2, tipo: 'Laboratório', capacidade: 30 });
        expect([200, 204]).toContain(res.status);
    });

    test('admin remove sala', async () => {
        const res = await comoAdmin(request(app).delete(`/api/salas/${salaId}`));
        expect([200, 204]).toContain(res.status);
    });
});

describe('Turmas', () => {
    let turmaId;

    test('admin cria turma', async () => {
        const res = await comoAdmin(request(app).post('/api/turmas'))
            .send({ nome: `Turma ${uniq()}`, curso: 'Sistemas de Informação', periodo: 5, ano: 2026 });

        expect([200, 201]).toContain(res.status);
        turmaId = extrairId(res.body, 'turma');
        expect(turmaId).toBeTruthy();
    });

    test('lista turmas', async () => {
        const res = await comoAdmin(request(app).get('/api/turmas'));
        expect(res.status).toBe(200);
    });

    test('POST sem periodo devolve 400', async () => {
        const res = await comoAdmin(request(app).post('/api/turmas'))
            .send({ nome: `Incompleta ${uniq()}`, curso: 'Sistemas de Informação' });
        expect(res.status).toBe(400);
    });

    test('admin atualiza turma', async () => {
        const res = await comoAdmin(request(app).put(`/api/turmas/${turmaId}`))
            .send({ nome: `Turma Renomeada ${uniq()}`, curso: 'Medicina', periodo: 6, ano: 2026 });
        expect([200, 204]).toContain(res.status);
    });

    test('GET /api/turmas/:id/alunos devolve lista', async () => {
        const res = await comoAdmin(request(app).get(`/api/turmas/${turmaId}/alunos`));
        expect(res.status).toBe(200);
    });

    test('admin remove turma', async () => {
        const res = await comoAdmin(request(app).delete(`/api/turmas/${turmaId}`));
        expect([200, 204]).toContain(res.status);
    });
});

describe('Disciplinas', () => {
    let cursoId;
    let disciplinaId;

    beforeAll(async () => {
        const res = await comoAdmin(request(app).post('/api/cursos'))
            .send({ nome: `Curso p/ Disciplina ${uniq()}`, duracao: 8, turno: 'Noturno' });
        cursoId = extrairId(res.body, 'curso');
    });

    test('admin cria disciplina', async () => {
        const res = await comoAdmin(request(app).post('/api/disciplinas'))
            .send({ nome: `Disciplina ${uniq()}`, curso_id: cursoId, periodo: 3, carga_horaria: 60 });

        expect([200, 201]).toContain(res.status);
        disciplinaId = extrairId(res.body, 'disciplina');
        expect(disciplinaId).toBeTruthy();
    });

    test('lista disciplinas', async () => {
        const res = await comoAdmin(request(app).get('/api/disciplinas'));
        expect(res.status).toBe(200);
    });

    test('lista disciplinas por curso', async () => {
        const res = await comoAdmin(request(app).get(`/api/disciplinas/curso/${cursoId}`));
        expect(res.status).toBe(200);
    });

    test('POST sem curso_id devolve 400', async () => {
        const res = await comoAdmin(request(app).post('/api/disciplinas'))
            .send({ nome: `Sem Curso ${uniq()}`, periodo: 1 });
        expect(res.status).toBe(400);
    });

    test('admin atualiza disciplina', async () => {
        const res = await comoAdmin(request(app).put(`/api/disciplinas/${disciplinaId}`))
            .send({ nome: `Disciplina Renomeada ${uniq()}`, curso_id: cursoId, periodo: 4, carga_horaria: 80 });
        expect([200, 204]).toContain(res.status);
    });

    test('admin remove disciplina', async () => {
        const res = await comoAdmin(request(app).delete(`/api/disciplinas/${disciplinaId}`));
        expect([200, 204]).toContain(res.status);
    });
});

describe('Professores', () => {
    let professorId;

    test('admin cria professor', async () => {
        const res = await comoAdmin(request(app).post('/api/professores'))
            .send({ nome: `Prof Teste ${uniq()}`, email: `prof-${uniq()}@teste.unimap` });

        expect([200, 201]).toContain(res.status);
        professorId = extrairId(res.body, 'professor');
        expect(professorId).toBeTruthy();
    });

    test('lista professores', async () => {
        const res = await comoAdmin(request(app).get('/api/professores'));
        expect(res.status).toBe(200);
    });

    test('lista professores ativos', async () => {
        const res = await comoAdmin(request(app).get('/api/professores/ativos'));
        expect(res.status).toBe(200);
    });

    test('admin atualiza professor', async () => {
        const res = await comoAdmin(request(app).put(`/api/professores/${professorId}`))
            .send({ nome: `Prof Renomeado ${uniq()}`, email: `prof-novo-${uniq()}@teste.unimap` });
        expect([200, 204]).toContain(res.status);
    });

    test('admin desativa professor', async () => {
        const res = await comoAdmin(request(app).put(`/api/professores/${professorId}/status`))
            .send({ ativo: 0 });
        expect([200, 204]).toContain(res.status);
    });

    test('admin remove professor', async () => {
        const res = await comoAdmin(request(app).delete(`/api/professores/${professorId}`));
        expect([200, 204]).toContain(res.status);
    });
});

describe('Dashboard', () => {
    test('estatísticas de admin devolvem contagens', async () => {
        const res = await comoAdmin(request(app).get('/api/dashboard/admin/estatisticas'));
        expect(res.status).toBe(200);
        expect(typeof res.body).toBe('object');
    });

    test('estatísticas gerais respondem para usuário autenticado', async () => {
        const res = await comoAluno(request(app).get('/api/dashboard/estatisticas'));
        expect(res.status).toBe(200);
    });

    test('estatísticas de aluno respondem', async () => {
        const res = await comoAluno(request(app).get('/api/dashboard/aluno/estatisticas'));
        expect(res.status).toBe(200);
    });
});

describe('Status da API', () => {
    test('GET /api/status responde sem autenticação', async () => {
        const res = await request(app).get('/api/status');
        expect(res.status).toBe(200);
    });

    test('rota inexistente devolve 404', async () => {
        const res = await request(app).get('/api/rota-que-nao-existe');
        expect(res.status).toBe(404);
    });
});
