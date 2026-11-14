/**
 * Conexão com o banco, expondo a API do `sqlite3`.
 *
 * As 12 rotas do projeto fazem ~202 chamadas no estilo
 * `db.get(sql, params, callback)`, e `db.run` depende de `this.lastID`
 * dentro do callback. Reescrever tudo isso para o estilo do `pg` seria
 * mexer em doze arquivos de uma vez; este módulo concentra a adaptação
 * em um só, que dá para testar.
 *
 * Métodos mantidos: get, all, run, serialize, prepare, each, close.
 *
 * Diferenças de comportamento que precisaram ser neutralizadas para a
 * resposta da API continuar idêntica à do SQLite:
 *
 *   - int8 (de COUNT(*)) chega como string no `pg`. 40 contagens no
 *     projeto virariam "27" em vez de 27 no JSON do dashboard.
 *   - DATE/TIMESTAMP chegam como objeto Date e seriam serializados em
 *     ISO 8601 ("2025-10-15T15:29:21.000Z") em vez do formato que o
 *     SQLite devolvia ("2025-10-15 15:29:21").
 *   - TIME vinha "18:50" do SQLite e vem "18:50:00" do Postgres.
 */
const { Pool, types } = require('pg');
const { toPg, precisaReturningId } = require('./sql-translate');

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
    throw new Error('DATABASE_URL ausente. Veja backend/.env.example.');
}

// ---------------------------------------------------------------------
// Parsers de tipo: mantêm o formato que o frontend já recebia.
// ---------------------------------------------------------------------

const OID = {
    INT8: 20,
    TIMESTAMP: 1114,
    TIMESTAMPTZ: 1184,
    DATE: 1082,
    NUMERIC: 1700
};

// COUNT(*), SUM() -> número, como no SQLite.
types.setTypeParser(OID.INT8, (v) => (v === null ? null : Number(v)));
types.setTypeParser(OID.NUMERIC, (v) => (v === null ? null : Number(v)));

/** "2025-10-15 15:29:21+00" -> "2025-10-15 15:29:21" */
const formatarTimestamp = (v) => {
    if (v === null) return null;
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(v);
    return m ? `${m[1]} ${m[2]}` : v;
};

types.setTypeParser(OID.TIMESTAMP, formatarTimestamp);
types.setTypeParser(OID.TIMESTAMPTZ, formatarTimestamp);

/** "2025-11-06" permanece string, sem virar Date. */
types.setTypeParser(OID.DATE, (v) => v);

// ---------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------

const ehLocal = /localhost|127\.0\.0\.1|\/tmp/.test(DATABASE_URL);

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: ehLocal ? false : { rejectUnauthorized: true },
    // O Neon escala para zero; manter o pool pequeno evita segurar
    // conexões ociosas e reduz tempo de compute cobrado.
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
});

pool.on('error', (err) => {
    // Erro em conexão ociosa do pool não deve derrubar o processo.
    console.error('❌ Erro no pool do Postgres:', err.message);
});

if (process.env.NODE_ENV !== 'test') {
    console.log('📊 Postgres conectado:', ehLocal ? 'local' : 'remoto (TLS)');
}

// ---------------------------------------------------------------------
// Adaptação da assinatura sqlite3
// ---------------------------------------------------------------------

/**
 * No sqlite3 o segundo argumento é opcional: tanto
 * `db.get(sql, cb)` quanto `db.get(sql, params, cb)` são válidos.
 */
function normalizarArgs(params, callback) {
    if (typeof params === 'function') {
        return { params: [], callback: params };
    }
    if (params === undefined || params === null) {
        return { params: [], callback };
    }
    return { params: Array.isArray(params) ? params : [params], callback };
}

async function executar(sql, params) {
    return pool.query(toPg(sql), params);
}

/** Busca uma linha. Devolve `undefined` quando não há — como o sqlite3. */
function get(sql, params, callback) {
    const a = normalizarArgs(params, callback);

    executar(sql, a.params)
        .then((res) => a.callback && a.callback(null, res.rows[0]))
        .catch((err) => a.callback && a.callback(err));
}

/** Busca todas as linhas. */
function all(sql, params, callback) {
    const a = normalizarArgs(params, callback);

    executar(sql, a.params)
        .then((res) => a.callback && a.callback(null, res.rows))
        .catch((err) => a.callback && a.callback(err));
}

/**
 * Executa INSERT/UPDATE/DELETE.
 *
 * O callback é chamado com `this` ligado a `{ lastID, changes }`, que é
 * como o sqlite3 entrega esses valores — por isso as rotas usam
 * `function(err) { ... this.lastID ... }` e não arrow function.
 *
 * `lastID` vem de um `RETURNING id` acrescentado aos INSERT. Tabelas de
 * junção sem coluna `id` fariam o Postgres recusar a cláusula; nesse
 * caso a query é repetida sem ela e `lastID` fica `undefined`.
 */
function run(sql, params, callback) {
    const a = normalizarArgs(params, callback);
    const traduzido = toPg(sql);
    const querRetorno = precisaReturningId(traduzido);

    const finalizar = (err, res, comRetorno) => {
        if (!a.callback) return;

        if (err) return a.callback.call({ lastID: undefined, changes: 0 }, err);

        const contexto = {
            lastID: comRetorno && res.rows[0] ? res.rows[0].id : undefined,
            changes: res.rowCount === null ? 0 : res.rowCount
        };

        a.callback.call(contexto, null);
    };

    const comReturning = `${traduzido.replace(/;\s*$/, '').trimEnd()} RETURNING id`;

    pool.query(querRetorno ? comReturning : traduzido, a.params)
        .then((res) => finalizar(null, res, querRetorno))
        .catch((err) => {
            // 42703 = undefined_column: a tabela não tem coluna `id`.
            if (querRetorno && err.code === '42703') {
                return pool.query(traduzido, a.params)
                    .then((res) => finalizar(null, res, false))
                    .catch((err2) => finalizar(err2));
            }
            finalizar(err);
        });
}

/**
 * No sqlite3, serialize() enfileira as operações do bloco. Com o pool do
 * Postgres não há fila global, e o código das rotas já encadeia o que
 * depende de ordem pelos próprios callbacks — então executar o bloco
 * direto preserva o comportamento observável.
 */
function serialize(fn) {
    if (typeof fn === 'function') fn();
}

/** Alias: no sqlite3, parallelize() é o oposto de serialize(). */
const parallelize = serialize;

/**
 * Statement preparado, no formato que o sqlite3 expõe:
 * `const stmt = db.prepare(sql); stmt.run(a, b); stmt.finalize(cb);`
 *
 * Os `run` são encadeados numa promessa única para que `finalize()` só
 * chame o callback depois que todos terminarem — é disso que o seed
 * de blocos/cursos/horários depende.
 */
function prepare(sql, callbackPreparacao) {
    const traduzido = toPg(sql);
    let fila = Promise.resolve();
    const erros = [];

    const stmt = {
        run(...args) {
            const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
            const valores = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;

            fila = fila.then(() =>
                pool.query(traduzido, valores)
                    .then((res) => {
                        if (cb) {
                            cb.call(
                                { lastID: res.rows[0] ? res.rows[0].id : undefined, changes: res.rowCount || 0 },
                                null
                            );
                        }
                    })
                    .catch((err) => {
                        erros.push(err);
                        if (cb) cb.call({ lastID: undefined, changes: 0 }, err);
                    })
            );

            return stmt;
        },

        finalize(cb) {
            fila.then(() => {
                if (cb) cb(erros.length ? erros[0] : null);
            });
            return stmt;
        }
    };

    if (typeof callbackPreparacao === 'function') callbackPreparacao(null);
    return stmt;
}

/** Itera linha por linha; `callbackFinal` recebe a contagem. */
function each(sql, params, callbackLinha, callbackFinal) {
    const a = normalizarArgs(params, callbackLinha);
    const porLinha = a.callback;
    const noFim = typeof callbackFinal === 'function'
        ? callbackFinal
        : (typeof callbackLinha === 'function' && typeof params === 'function' ? callbackLinha : null);

    executar(sql, a.params)
        .then((res) => {
            res.rows.forEach((row) => porLinha && porLinha(null, row));
            if (noFim && noFim !== porLinha) noFim(null, res.rows.length);
        })
        .catch((err) => {
            if (porLinha) porLinha(err);
            if (noFim && noFim !== porLinha) noFim(err, 0);
        });
}

function close(callback) {
    pool.end()
        .then(() => callback && callback(null))
        .catch((err) => callback && callback(err));
}

/** Compatibilidade com `db.on('error', ...)` do sqlite3. */
function on(evento, handler) {
    if (evento === 'error') pool.on('error', handler);
    return module.exports;
}

module.exports = {
    get, all, run, serialize, parallelize, prepare, each, close, on,
    /** Acesso direto ao pool, para código novo que prefira promessas. */
    pool,
    /** Usado pelo healthcheck. */
    ping: () => pool.query('SELECT 1')
};
