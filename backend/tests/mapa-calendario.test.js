/**
 * Mapa do campus e calendário.
 *
 * O "mapa" do sistema era uma lista agrupada por bloco e andar — num
 * sistema chamado UniMap, era a maior ausência do produto. E
 * `mapa.html`, que o menu de todas as páginas já linkava, não existia:
 * respondia 404.
 */
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const h = require('./helpers/app');

const { app } = h;
const FRONTEND = path.join(__dirname, '..', '..', 'frontend');
const ler = (f) => fs.readFileSync(path.join(FRONTEND, f), 'utf8');

let contadorIp = 0;
const ipUnico = () => `198.51.100.${(contadorIp++ % 250) + 1}`;

let token;

beforeAll(async () => {
    await h.aguardarSchema();
    await h.resetDb();
    await h.seed();
    token = await h.loginAs('aluno');

    // Duas salas no mesmo bloco e piso, mais uma duplicata do mesmo
    // número — a condição que a tabela real tinha.
    await h.run("INSERT INTO blocos (letra, nome) VALUES ('Z', 'Bloco Z - Teste')");
    for (const [numero, tipo] of [['101', 'Sala de Aula'], ['102', 'Laboratório'], ['101', 'Auditório']]) {
        await h.run(
            'INSERT INTO salas (numero, bloco, andar, tipo, ativa) VALUES (?, ?, 1, ?, 1)',
            [numero, 'Z', tipo]
        );
    }
}, 40000);

afterAll(() => h.limpar());

const comToken = (req) =>
    req.set('Authorization', `Bearer ${token}`).set('X-Forwarded-For', ipUnico());

describe('GET /api/salas/mapa', () => {
    test('exige autenticação', async () => {
        const res = await request(app).get('/api/salas/mapa').set('X-Forwarded-For', ipUnico());
        expect(res.status).toBe(401);
    });

    test('devolve blocos com andares e contagem', async () => {
        const res = await comToken(request(app).get('/api/salas/mapa'));

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.blocos)).toBe(true);

        const z = res.body.blocos.find((b) => b.letra === 'Z');
        expect(z).toBeDefined();
        expect(z.nome).toBe('Bloco Z - Teste');
        expect(z.andares.length).toBe(1);
        expect(z.andares[0].andar).toBe(1);
    });

    test('conta números distintos, não linhas duplicadas', async () => {
        // Foram inseridas 3 linhas, mas só 2 números: 101 e 102.
        const res = await comToken(request(app).get('/api/salas/mapa'));
        const z = res.body.blocos.find((b) => b.letra === 'Z');

        expect(z.total_salas).toBe(2);
    });

    test('o total do mapa é a soma dos blocos', async () => {
        const res = await comToken(request(app).get('/api/salas/mapa'));
        const soma = res.body.blocos.reduce((s, b) => s + b.total_salas, 0);

        expect(res.body.total_salas).toBe(soma);
        expect(res.body.total_blocos).toBe(res.body.blocos.length);
    });
});

describe('GET /api/salas/bloco/:bloco/andar/:andar', () => {
    test('não repete o mesmo número de sala', async () => {
        const res = await comToken(request(app).get('/api/salas/bloco/Z/andar/1'));

        expect(res.status).toBe(200);
        const numeros = res.body.map((s) => s.numero);
        expect(numeros.length).toBe(new Set(numeros).size);
    });
});

describe('Páginas', () => {
    test('mapa.html existe', () => {
        expect(fs.existsSync(path.join(FRONTEND, 'mapa.html'))).toBe(true);
    });

    test('calendario.html existe', () => {
        expect(fs.existsSync(path.join(FRONTEND, 'calendario.html'))).toBe(true);
    });

    test('todo link do menu aponta para página que existe', () => {
        // O menu linkava mapa.html, que não existia: 404 em toda página.
        const paginas = fs.readdirSync(FRONTEND).filter((f) => f.endsWith('.html'));
        const quebrados = [];

        for (const pagina of paginas) {
            const html = ler(pagina);
            for (const m of html.matchAll(/href="([a-z0-9-]+\.html)"/gi)) {
                if (!fs.existsSync(path.join(FRONTEND, m[1]))) {
                    quebrados.push(`${pagina} -> ${m[1]}`);
                }
            }
        }

        expect(quebrados).toEqual([]);
    });

    test('mapa.html carrega o desenho e o script', () => {
        const html = ler('mapa.html');
        expect(html).toContain('id="mapaSvg"');
        expect(html).toContain('js/mapa-campus.js');
        expect(html).toContain('css/mapa-campus.css');
    });

    test('mapa.html mantém a lista de blocos, para quem prefere selecionar', () => {
        expect(ler('mapa.html')).toContain('id="mapaListaBlocos"');
    });

    test('mapa.html diz que a planta é esquemática', () => {
        // A geometria veio de uma foto de placa: a página precisa ser
        // honesta sobre isso.
        expect(ler('mapa.html')).toMatch(/esquem[áa]tica/i);
    });

    test('calendario.html aponta para o PDF oficial', () => {
        expect(ler('js/calendario.js')).toContain('paineis.unipam.edu.br');
        expect(ler('calendario.html')).toContain('data-pdf');
    });

    test('o favicon não usa o tipo inválido imagex/png', () => {
        const paginas = fs.readdirSync(FRONTEND).filter((f) => f.endsWith('.html'));
        const ruins = paginas.filter((p) => ler(p).includes('imagex/png'));
        expect(ruins).toEqual([]);
    });
});

describe('Dados do calendário', () => {
    const fonte = ler('js/calendario.js');

    test('traz os doze meses', () => {
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        for (const m of meses) expect(fonte).toContain(`mes: '${m}'`);
    });

    test('os dias letivos batem com o PDF', () => {
        // Soma declarada no PDF: 101 no 1º semestre, 100 no 2º.
        const letivos = [...fonte.matchAll(/letivos:\s*(\d+)/g)].map((m) => Number(m[1]));
        expect(letivos).toHaveLength(11);

        const primeiro = letivos.slice(0, 6).reduce((a, b) => a + b, 0);
        const segundo = letivos.slice(6).reduce((a, b) => a + b, 0);

        expect(primeiro).toBe(101);
        expect(segundo).toBe(100);
    });
});
