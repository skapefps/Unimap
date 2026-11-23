/**
 * Tradução de SQL no dialeto SQLite para Postgres.
 *
 * Existe para que as ~202 chamadas `db.get/all/run` espalhadas pelas 12
 * rotas continuem escritas como estão. Reescrever cada uma à mão seria
 * risco desproporcional; aqui a tradução fica em um lugar, testada.
 *
 * O ponto delicado é não tocar no conteúdo de strings literais: um `?`
 * ou a palavra `LIKE` dentro de uma string são dados, não sintaxe. Por
 * isso a varredura é caractere a caractere, alternando entre dentro e
 * fora de literal, em vez de regex sobre a query inteira.
 */

/**
 * Divide o SQL em trechos, marcando quais estão dentro de string literal.
 *
 * Reconhece aspas simples com escape no estilo SQL (`''` dentro da
 * string) e aspas duplas, que no Postgres delimitam identificadores.
 *
 * @param {string} sql
 * @returns {Array<{texto: string, literal: boolean}>}
 */
function segmentar(sql) {
    const segmentos = [];
    let atual = '';
    let i = 0;

    const empurrar = (texto, literal) => {
        if (texto) segmentos.push({ texto, literal });
    };

    while (i < sql.length) {
        const c = sql[i];

        if (c === "'" || c === '"') {
            empurrar(atual, false);
            atual = '';

            const delimitador = c;
            let literal = delimitador;
            i++;

            while (i < sql.length) {
                if (sql[i] === delimitador) {
                    // Delimitador duplicado é escape, não fim da string.
                    if (sql[i + 1] === delimitador) {
                        literal += delimitador + delimitador;
                        i += 2;
                        continue;
                    }
                    literal += delimitador;
                    i++;
                    break;
                }
                literal += sql[i];
                i++;
            }

            empurrar(literal, true);
            continue;
        }

        atual += c;
        i++;
    }

    empurrar(atual, false);
    return segmentos;
}

/**
 * Funções cujo argumento é uma string literal.
 *
 * Precisam rodar ANTES da segmentação: `datetime('now')` se parte em
 * três segmentos (`datetime(`, o literal `'now'`, `)`), e a regex nunca
 * veria o padrão inteiro. Aplicar na query completa é seguro aqui porque
 * os padrões são chamadas de função específicas — a chance de aparecerem
 * dentro de uma string de dados é desprezível.
 */
const PRE_SUBSTITUICOES = [
    [/\bdatetime\s*\(\s*'now'\s*\)/gi, 'NOW()'],
    [/\bdate\s*\(\s*'now'\s*\)/gi, 'CURRENT_DATE']
];

/** Substituições de dialeto aplicadas somente fora de literais. */
const SUBSTITUICOES = [
    // SQLite não diferencia maiúsculas no LIKE para ASCII; Postgres sim.
    // Sem isto, buscar "bloco a" deixaria de encontrar "Bloco A".
    // O negative lookbehind evita transformar um ILIKE já existente.
    [/(?<!I)\bLIKE\b/gi, 'ILIKE'],


    // Agregações e utilitários com nome diferente
    [/\bGROUP_CONCAT\s*\(\s*([^,()]+?)\s*\)/gi, "STRING_AGG($1, ',')"],
    [/\bGROUP_CONCAT\s*\(/gi, 'STRING_AGG('],
    [/\bIFNULL\s*\(/gi, 'COALESCE(']
];

/**
 * Converte SQL do dialeto SQLite para Postgres.
 *
 * @param {string} sql
 * @returns {string}
 */
function toPg(sql) {
    if (typeof sql !== 'string' || sql.length === 0) return sql;

    let preparado = sql;
    for (const [de, para] of PRE_SUBSTITUICOES) {
        preparado = preparado.replace(de, para);
    }

    const segmentos = segmentar(preparado);
    let contador = 0;
    let temOnConflict = false;
    let orIgnore = false;

    const traduzidos = segmentos.map((seg) => {
        if (seg.literal) {
            // O segmentador trata " como delimitador, então "" chega aqui
            // como um "literal" vazio. No SQLite isso é string vazia; no
            // Postgres é um identificador de tamanho zero, que é erro de
            // sintaxe. Identificador vazio nunca é válido, então a troca
            // por '' é segura — e só acontece para o par exato "".
            if (seg.texto === '""') return "''";
            return seg.texto;
        }

        let texto = seg.texto;

        // INSERT OR IGNORE / OR REPLACE -> INSERT, com ON CONFLICT no fim
        const antes = texto;
        texto = texto.replace(/\bINSERT\s+OR\s+(IGNORE|REPLACE)\s+INTO\b/gi, 'INSERT INTO');
        if (texto !== antes) orIgnore = true;

        if (/\bON\s+CONFLICT\b/i.test(texto)) temOnConflict = true;

        for (const [de, para] of SUBSTITUICOES) {
            texto = texto.replace(de, para);
        }

        // ? posicional -> $n, numerado na ordem de aparição
        texto = texto.replace(/\?/g, () => `$${++contador}`);

        return texto;
    });

    let resultado = traduzidos.join('');

    // ON CONFLICT DO NOTHING entra só se o OR IGNORE pediu e a query
    // ainda não trouxer a sua própria cláusula.
    if (orIgnore && !temOnConflict) {
        resultado = `${resultado.replace(/;\s*$/, '').trimEnd()} ON CONFLICT DO NOTHING`;
    }

    return resultado;
}

/**
 * Diz se a query é um INSERT que precisa de `RETURNING id` para que o
 * shim consiga preencher `this.lastID`, como o sqlite3 fazia.
 *
 * @param {string} sql — já traduzido
 * @returns {boolean}
 */
function precisaReturningId(sql) {
    if (typeof sql !== 'string') return false;
    const limpo = sql.trim();
    return /^INSERT\s/i.test(limpo) && !/\bRETURNING\b/i.test(limpo);
}

module.exports = { toPg, precisaReturningId, segmentar };
