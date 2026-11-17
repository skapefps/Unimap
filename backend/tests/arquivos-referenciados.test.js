/**
 * Uma página referenciar um arquivo que não existe é uma falha silenciosa:
 * o servidor responde o fallback de SPA, o navegador recusa executar e a
 * tela simplesmente não funciona, sem nenhum erro no log do servidor.
 *
 * Foi o que aconteceu com perfil.html -> js/perfil.js, que nunca existiu.
 *
 * Este teste varre todo <script src>, <link href> e <img src> local das
 * páginas e exige que o arquivo exista no disco.
 */
const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..', '..', 'frontend');

const paginas = fs.readdirSync(FRONTEND).filter((f) => f.endsWith('.html'));

/** Referências locais (ignora http(s):// e data:). */
function referenciasLocais(html) {
    const refs = [];
    const padroes = [
        /<script[^>]+src=["']([^"']+)["']/gi,
        /<link[^>]+href=["']([^"']+)["']/gi,
        /<img[^>]+src=["']([^"']+)["']/gi
    ];

    for (const padrao of padroes) {
        padrao.lastIndex = 0;
        let m;
        while ((m = padrao.exec(html)) !== null) {
            const alvo = m[1].trim();
            if (/^(https?:)?\/\//i.test(alvo)) continue;  // externo
            if (/^(data|mailto|tel):/i.test(alvo)) continue;
            if (alvo.startsWith('#')) continue;
            refs.push(alvo.split('?')[0].split('#')[0]);
        }
    }
    return refs;
}

describe('arquivos referenciados pelas páginas existem', () => {
    it('há páginas para verificar', () => {
        expect(paginas.length).toBeGreaterThan(0);
    });

    it.each(paginas)('%s não referencia arquivo inexistente', (pagina) => {
        const html = fs.readFileSync(path.join(FRONTEND, pagina), 'utf8');
        const faltando = [];

        for (const ref of referenciasLocais(html)) {
            // Resolve relativo à pasta do frontend, como o servidor serve.
            const limpo = ref.replace(/^\.?\//, '');
            if (!fs.existsSync(path.join(FRONTEND, limpo))) {
                faltando.push(ref);
            }
        }

        expect(faltando).toEqual([]);
    });
});
