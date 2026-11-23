/**
 * As telas chamam o cliente de API como `api.getAlgo(...)`. Se o método
 * não existir, o navegador lança
 *
 *   TypeError: api.getAlgo is not a function
 *
 * e a tela fica muda — sem erro no servidor, sem nada no log. Foi o que
 * acontecia no dashboard.html com getDashboardStats, que nunca existiu
 * em js/api.js: os quatro contadores ficavam parados em "0".
 *
 * Este teste lê as chamadas direto das páginas e exige que cada método
 * exista na classe do cliente.
 */
const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..', '..', 'frontend');
const API_JS = path.join(FRONTEND, 'js', 'api.js');

/** Arquivos que podem conter chamadas a `api.algumaCoisa(`. */
function arquivosComChamadas() {
    const achados = [];
    const varrer = (dir) => {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const completo = path.join(dir, item.name);
            if (item.isDirectory()) {
                if (item.name === 'node_modules') continue;
                varrer(completo);
            } else if (/\.(html|js)$/i.test(item.name) && completo !== API_JS) {
                achados.push(completo);
            }
        }
    };
    varrer(FRONTEND);
    return achados;
}

/** Métodos definidos na classe do cliente de API. */
function metodosDefinidos() {
    const texto = fs.readFileSync(API_JS, 'utf8');
    const nomes = new Set();

    // `async nome(` ou `nome(` no corpo da classe
    const padrao = /^\s{4}(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\(/gm;
    let m;
    while ((m = padrao.exec(texto)) !== null) nomes.add(m[1]);

    // Atribuições do tipo `ApiClient.prototype.nome =` ou `nome: function`
    const padrao2 = /(?:prototype\.|^\s*)([a-zA-Z_$][\w$]*)\s*[:=]\s*(?:async\s*)?function/gm;
    while ((m = padrao2.exec(texto)) !== null) nomes.add(m[1]);

    return nomes;
}

/** Chamadas `api.metodo(` encontradas nas telas. */
function chamadasPorArquivo() {
    const porArquivo = new Map();

    for (const arquivo of arquivosComChamadas()) {
        const texto = fs.readFileSync(arquivo, 'utf8');
        const padrao = /\bapi\.([a-zA-Z_$][\w$]*)\s*\(/g;
        let m;
        const nomes = new Set();
        while ((m = padrao.exec(texto)) !== null) nomes.add(m[1]);
        if (nomes.size) porArquivo.set(path.relative(FRONTEND, arquivo), [...nomes]);
    }
    return porArquivo;
}

describe('métodos de API chamados pelas telas existem no cliente', () => {
    const definidos = metodosDefinidos();
    const chamadas = chamadasPorArquivo();

    it('o cliente de API foi lido e tem métodos', () => {
        expect(definidos.size).toBeGreaterThan(10);
    });

    it('alguma tela chama o cliente (o teste tem o que checar)', () => {
        expect(chamadas.size).toBeGreaterThan(0);
    });

    const casos = [...chamadas.entries()];
    it.each(casos)('%s só chama métodos que existem', (_arquivo, nomes) => {
        const faltando = nomes.filter((n) => !definidos.has(n));
        expect(faltando).toEqual([]);
    });
});
