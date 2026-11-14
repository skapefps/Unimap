/**
 * Testes de integração do shim pg contra um Postgres real.
 *
 * O que está sendo verificado não é o SQL em si, e sim que a camada de
 * compatibilidade entrega aos callbacks exatamente o que o sqlite3
 * entregava — é disso que as ~202 chamadas nas rotas dependem.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL
    || 'postgresql://postgres@localhost:5433/unimap_test';

const db = require('../config/database');

const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            // `this` precisa chegar com lastID/changes, como no sqlite3.
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });

const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

beforeAll(async () => {
    await db.pool.query(`
        CREATE TABLE IF NOT EXISTS shim_com_id (
            id     SERIAL PRIMARY KEY,
            nome   TEXT NOT NULL,
            valor  INTEGER,
            criado TIMESTAMPTZ DEFAULT NOW()
        )`);
    await db.pool.query(`
        CREATE TABLE IF NOT EXISTS shim_sem_id (
            chave TEXT NOT NULL,
            dado  TEXT,
            UNIQUE (chave)
        )`);
});

afterAll(async () => {
    await db.pool.query('DROP TABLE IF EXISTS shim_com_id');
    await db.pool.query('DROP TABLE IF EXISTS shim_sem_id');
    await db.pool.end();
});

beforeEach(async () => {
    await db.pool.query('TRUNCATE shim_com_id RESTART IDENTITY');
    await db.pool.query('TRUNCATE shim_sem_id');
});

describe('run()', () => {
    test('devolve lastID em INSERT em tabela com coluna id', async () => {
        const r = await run('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)', ['a', 1]);
        expect(r.lastID).toBe(1);
        expect(r.changes).toBe(1);
    });

    test('lastID avança a cada insert', async () => {
        const p = await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['p']);
        const s = await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['s']);
        expect(s.lastID).toBe(p.lastID + 1);
    });

    test('INSERT em tabela SEM coluna id não lança e deixa lastID undefined', async () => {
        // Review Focus 3: o shim acrescenta RETURNING id aos INSERT; numa
        // tabela de junção sem essa coluna o Postgres recusa, e o shim
        // precisa repetir a query sem a cláusula.
        const r = await run('INSERT INTO shim_sem_id (chave, dado) VALUES (?, ?)', ['k1', 'v1']);
        expect(r.lastID).toBeUndefined();
        expect(r.changes).toBe(1);

        const row = await get('SELECT dado FROM shim_sem_id WHERE chave = ?', ['k1']);
        expect(row.dado).toBe('v1');
    });

    test('devolve changes em UPDATE', async () => {
        await run('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)', ['x', 1]);
        await run('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)', ['x', 2]);

        const r = await run('UPDATE shim_com_id SET valor = ? WHERE nome = ?', [9, 'x']);
        expect(r.changes).toBe(2);
        expect(r.lastID).toBeUndefined();
    });

    test('devolve changes 0 quando UPDATE não atinge nada', async () => {
        const r = await run('UPDATE shim_com_id SET valor = ? WHERE nome = ?', [1, 'inexistente']);
        expect(r.changes).toBe(0);
    });

    test('devolve changes em DELETE', async () => {
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['d']);
        const r = await run('DELETE FROM shim_com_id WHERE nome = ?', ['d']);
        expect(r.changes).toBe(1);
    });

    test('erro de SQL chega no primeiro argumento do callback', async () => {
        await expect(run('INSERT INTO tabela_que_nao_existe (a) VALUES (?)', [1]))
            .rejects.toThrow();
    });

    test('violação de NOT NULL chega como erro, não como sucesso', async () => {
        await expect(run('INSERT INTO shim_com_id (valor) VALUES (?)', [1]))
            .rejects.toThrow();
    });

    test('INSERT OR IGNORE em chave duplicada não lança', async () => {
        await run('INSERT INTO shim_sem_id (chave, dado) VALUES (?, ?)', ['dup', 'primeiro']);
        const r = await run('INSERT OR IGNORE INTO shim_sem_id (chave, dado) VALUES (?, ?)', ['dup', 'segundo']);

        expect(r.changes).toBe(0);
        const row = await get('SELECT dado FROM shim_sem_id WHERE chave = ?', ['dup']);
        expect(row.dado).toBe('primeiro');
    });
});

describe('get()', () => {
    test('devolve undefined quando não há linha', async () => {
        // As rotas testam `if (!user)`. null também seria falsy, mas
        // undefined é o que o sqlite3 entregava.
        const row = await get('SELECT * FROM shim_com_id WHERE id = ?', [99999]);
        expect(row).toBeUndefined();
    });

    test('devolve a primeira linha', async () => {
        await run('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)', ['um', 1]);
        const row = await get('SELECT * FROM shim_com_id WHERE nome = ?', ['um']);
        expect(row.nome).toBe('um');
        expect(row.valor).toBe(1);
    });

    test('aceita ser chamado sem array de params', async () => {
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['sem']);
        const row = await new Promise((res, rej) =>
            db.get('SELECT COUNT(*) AS total FROM shim_com_id', (e, r) => (e ? rej(e) : res(r))));
        expect(row.total).toBe(1);
    });

    test('aceita param escalar fora de array', async () => {
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['escalar']);
        const row = await new Promise((res, rej) =>
            db.get('SELECT * FROM shim_com_id WHERE nome = ?', 'escalar', (e, r) => (e ? rej(e) : res(r))));
        expect(row.nome).toBe('escalar');
    });
});

describe('all()', () => {
    test('devolve array vazio, não null, quando não há linhas', async () => {
        const rows = await all('SELECT * FROM shim_com_id WHERE nome = ?', ['nada']);
        expect(Array.isArray(rows)).toBe(true);
        expect(rows).toHaveLength(0);
    });

    test('devolve todas as linhas na ordem do ORDER BY', async () => {
        await run('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)', ['b', 2]);
        await run('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)', ['a', 1]);

        const rows = await all('SELECT nome FROM shim_com_id ORDER BY nome');
        expect(rows.map((r) => r.nome)).toEqual(['a', 'b']);
    });
});

describe('Compatibilidade de tipos com o SQLite', () => {
    test('COUNT(*) volta NÚMERO, não string', async () => {
        // O pg entrega int8 como string. Com 40 contagens no projeto, o
        // dashboard passaria a devolver "2" em vez de 2 no JSON.
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['c1']);
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['c2']);

        const row = await get('SELECT COUNT(*) AS total FROM shim_com_id');
        expect(typeof row.total).toBe('number');
        expect(row.total).toBe(2);
    });

    test('SUM() volta número', async () => {
        await run('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)', ['s', 10]);
        await run('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)', ['s', 5]);

        const row = await get('SELECT SUM(valor) AS soma FROM shim_com_id');
        expect(typeof row.soma).toBe('number');
        expect(row.soma).toBe(15);
    });

    test('TIMESTAMPTZ volta string "YYYY-MM-DD HH:MM:SS", não Date nem ISO', async () => {
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['data']);
        const row = await get('SELECT criado FROM shim_com_id WHERE nome = ?', ['data']);

        expect(typeof row.criado).toBe('string');
        expect(row.criado).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        expect(row.criado).not.toContain('T');
        expect(row.criado).not.toContain('Z');
    });

    test('DATE volta string "YYYY-MM-DD"', async () => {
        const row = await get("SELECT CAST('2025-11-06' AS DATE) AS d");
        expect(row.d).toBe('2025-11-06');
    });

    test('SMALLINT de flag volta número 0/1', async () => {
        const row = await get('SELECT CAST(1 AS SMALLINT) AS ativo');
        expect(row.ativo).toBe(1);
        expect(typeof row.ativo).toBe('number');
    });
});

describe('LIKE insensível a maiúsculas', () => {
    test('busca com caixa diferente encontra o registro', async () => {
        // No SQLite isto funcionava; no Postgres sem ILIKE, não.
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['Bloco A']);

        const rows = await all('SELECT * FROM shim_com_id WHERE nome LIKE ?', ['%bloco a%']);
        expect(rows).toHaveLength(1);
    });
});

describe('prepare()', () => {
    test('run() em sequência e finalize() depois de todos terminarem', async () => {
        await new Promise((resolve, reject) => {
            const stmt = db.prepare('INSERT INTO shim_com_id (nome, valor) VALUES (?, ?)');
            stmt.run('p1', 1);
            stmt.run('p2', 2);
            stmt.run('p3', 3);
            stmt.finalize((err) => (err ? reject(err) : resolve()));
        });

        const row = await get('SELECT COUNT(*) AS total FROM shim_com_id');
        expect(row.total).toBe(3);
    });

    test('finalize() reporta erro ocorrido em algum run()', async () => {
        const err = await new Promise((resolve) => {
            const stmt = db.prepare('INSERT INTO shim_com_id (valor) VALUES (?)');
            stmt.run(1);
            stmt.finalize(resolve);
        });
        expect(err).toBeTruthy();
    });
});

describe('serialize() e each()', () => {
    test('serialize executa o bloco', async () => {
        let executou = false;
        db.serialize(() => { executou = true; });
        expect(executou).toBe(true);
    });

    test('each percorre as linhas e informa a contagem no fim', async () => {
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['e1']);
        await run('INSERT INTO shim_com_id (nome) VALUES (?)', ['e2']);

        const vistas = [];
        const total = await new Promise((resolve, reject) => {
            db.each(
                'SELECT nome FROM shim_com_id ORDER BY nome',
                [],
                (err, row) => (err ? reject(err) : vistas.push(row.nome)),
                (err, n) => (err ? reject(err) : resolve(n))
            );
        });

        expect(vistas).toEqual(['e1', 'e2']);
        expect(total).toBe(2);
    });
});

describe('ping()', () => {
    test('responde quando o banco está acessível', async () => {
        const res = await db.ping();
        expect(res.rowCount).toBe(1);
    });
});
