/**
 * O frontend carrega CSS e fontes de CDNs externas (Font Awesome no cdnjs,
 * Google Fonts). Se o Content-Security-Policy não listar esses domínios, o
 * navegador bloqueia a folha de estilo inteira e os ícones somem do site —
 * sem erro visível no servidor, só uma tela "sem CSS".
 *
 * Este teste lê os domínios direto do HTML/CSS/JS do frontend e exige que o
 * CSP permita cada um. Adicionar uma CDN nova sem liberá-la quebra aqui.
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');

const FRONTEND = path.join(__dirname, '..', '..', 'frontend');

/** Lê todo arquivo .html/.css/.js do frontend. */
function arquivosDoFrontend() {
    const achados = [];
    const varrer = (dir) => {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const completo = path.join(dir, item.name);
            if (item.isDirectory()) {
                if (item.name === 'node_modules') continue;
                varrer(completo);
            } else if (/\.(html|css|js)$/i.test(item.name)) {
                achados.push(completo);
            }
        }
    };
    varrer(FRONTEND);
    return achados;
}

/**
 * Domínios de onde o frontend puxa folha de estilo ou fonte.
 * Procura <link rel=stylesheet href>, @import e url() em CSS.
 */
function dominiosDeEstiloEFonte() {
    const dominios = new Set();
    const padroes = [
        /<link[^>]+href=["'](https:\/\/[^"']+)["'][^>]*>/gi,
        /@import\s+(?:url\()?["']?(https:\/\/[^"')]+)/gi,
        /url\(\s*["']?(https:\/\/[^"')]+)/gi
    ];

    for (const arquivo of arquivosDoFrontend()) {
        const texto = fs.readFileSync(arquivo, 'utf8');
        for (const padrao of padroes) {
            padrao.lastIndex = 0;
            let m;
            while ((m = padrao.exec(texto)) !== null) {
                // Só interessa link de estilo/fonte, não preconnect de imagem.
                const trecho = m[0];
                const ehEstilo = /stylesheet|\.css|@import|url\(/i.test(trecho);
                if (!ehEstilo) continue;
                try {
                    dominios.add(new URL(m[1]).origin);
                } catch (_) {
                    /* URL malformada no fonte: ignora */
                }
            }
        }
    }
    return [...dominios];
}

describe('CSP x recursos externos do frontend', () => {
    let app;
    let csp;

    beforeAll(async () => {
        app = require('../server');
        const resposta = await request(app).get('/api/health');
        csp = resposta.headers['content-security-policy'] || '';
    });

    it('envia um Content-Security-Policy', () => {
        expect(csp).not.toBe('');
    });

    it('o frontend realmente usa CDN externa (o teste tem o que checar)', () => {
        expect(dominiosDeEstiloEFonte().length).toBeGreaterThan(0);
    });

    it.each(dominiosDeEstiloEFonte())(
        'style-src permite %s',
        (dominio) => {
            const diretiva = (csp.split(';').find((d) => d.trim().startsWith('style-src')) || '').trim();
            expect(diretiva).toContain(dominio);
        }
    );

    it('font-src permite o cdnjs, de onde o Font Awesome busca os .woff2', () => {
        const diretiva = (csp.split(';').find((d) => d.trim().startsWith('font-src')) || '').trim();
        expect(diretiva).toContain('https://cdnjs.cloudflare.com');
    });

    /**
     * O projeto liga comportamento por atributo (onclick, onchange...) em
     * mais de cem lugares. O padrão do Helmet é script-src-attr 'none', que
     * bloqueia todos eles: os botões continuam na tela e não fazem nada,
     * sem erro no servidor. Enquanto o HTML for assim, a diretiva precisa
     * permitir atributo inline.
     */
    describe('handlers inline do HTML', () => {
        const contarHandlers = () => {
            let total = 0;
            for (const arquivo of arquivosDoFrontend()) {
                if (!/\.html$/i.test(arquivo)) continue;
                const texto = fs.readFileSync(arquivo, 'utf8');
                total += (texto.match(/\son[a-z]+\s*=\s*["']/gi) || []).length;
            }
            return total;
        };

        it('o HTML de fato usa handler inline (o teste tem o que proteger)', () => {
            expect(contarHandlers()).toBeGreaterThan(0);
        });

        it('script-src-attr não bloqueia os handlers inline', () => {
            const diretiva = (csp.split(';')
                .find((d) => d.trim().startsWith('script-src-attr')) || '').trim();

            // Ou a diretiva permite inline, ou não existe (e aí vale
            // script-src, que já tem 'unsafe-inline' para este projeto).
            if (diretiva) {
                expect(diretiva).toContain("'unsafe-inline'");
                expect(diretiva).not.toContain("'none'");
            }
        });
    });
});
