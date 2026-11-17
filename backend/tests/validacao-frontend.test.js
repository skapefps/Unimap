/**
 * Coerência entre a validação do frontend e a do backend.
 *
 * Origem deste arquivo: o cadastro parou de funcionar em produção porque
 * o mínimo de senha subiu para 8 no backend e o frontend continuou
 * aceitando 6. O usuário digitava 6 caracteres, o formulário aprovava,
 * e o servidor respondia 400 — sem que a tela dissesse o motivo.
 *
 * Não existe suíte de testes para o JavaScript do navegador aqui, então
 * a verificação é feita sobre o texto dos arquivos: o número que o
 * frontend afirma precisa ser o mesmo que o schema exige. É uma
 * verificação grosseira, mas pega exatamente a classe de erro que
 * causou a falha — as duas metades divergirem em silêncio.
 */
const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..', '..', 'frontend');

/** O número que o backend realmente exige, lido do schema. */
function minimoDoBackend() {
    const { schemas } = require('../middleware/validate');
    const r = schemas.registro.safeParse({
        nome: 'Nome Teste',
        email: 'a@b.com',
        senha: 'x'.repeat(7)
    });

    // Procura o menor tamanho que passa, entre 1 e 32.
    for (let n = 1; n <= 32; n++) {
        const ok = schemas.registro.safeParse({
            nome: 'Nome Teste',
            email: 'a@b.com',
            senha: 'x'.repeat(n)
        }).success;
        if (ok) return n;
    }
    throw new Error('Nenhum tamanho de senha entre 1 e 32 foi aceito pelo schema');
}

const ler = (arquivo) => fs.readFileSync(path.join(FRONTEND, arquivo), 'utf8');

/** Arquivos do frontend que validam tamanho de senha. */
const ARQUIVOS_COM_VALIDACAO = [
    'cadastro.html',
    'reset-password.html',
    'js/auth.js',
    'js/register.js'
];

describe('Mínimo de senha: frontend x backend', () => {
    const minimo = minimoDoBackend();

    test('o schema do backend tem um mínimo definido', () => {
        expect(minimo).toBeGreaterThan(1);
    });

    test.each(ARQUIVOS_COM_VALIDACAO)(
        '%s não valida senha com um mínimo menor que o do backend',
        (arquivo) => {
            const conteudo = ler(arquivo);

            // Comparações do tipo `value.length < N`
            const comparacoes = [...conteudo.matchAll(/\.length\s*<\s*(\d+)/g)]
                .map((m) => Number(m[1]));

            for (const n of comparacoes) {
                expect(n).toBeGreaterThanOrEqual(minimo);
            }
        }
    );

    test.each(ARQUIVOS_COM_VALIDACAO)(
        '%s não promete ao usuário um mínimo menor que o do backend',
        (arquivo) => {
            const conteudo = ler(arquivo);

            // Textos do tipo "pelo menos 6 caracteres" ou "Mínimo 6 caracteres"
            const promessas = [
                ...conteudo.matchAll(/(?:pelo menos|m[íi]nimo(?:\s+de)?)\s+(\d+)\s*caracteres/gi)
            ].map((m) => Number(m[1]));

            for (const n of promessas) {
                expect(n).toBeGreaterThanOrEqual(minimo);
            }
        }
    );

    test('atributos minlength do HTML não são menores que o do backend', () => {
        for (const arquivo of ARQUIVOS_COM_VALIDACAO.filter((f) => f.endsWith('.html'))) {
            const conteudo = ler(arquivo);
            const valores = [...conteudo.matchAll(/minlength\s*=\s*["'](\d+)["']/gi)]
                .map((m) => Number(m[1]));

            for (const n of valores) {
                expect(n).toBeGreaterThanOrEqual(minimo);
            }
        }
    });
});

describe('Nenhuma URL fixa de desenvolvimento no frontend', () => {
    /**
     * Três arquivos tinham a URL do backend fixa em http://localhost:3000:
     * o cadastro com Google e as telas de admin de cursos e de salas.
     * Em produção essas partes falavam com o computador do próprio
     * usuário — ou seja, duas telas inteiras ficavam sem backend, e
     * nenhum teste de API pegava isso, porque o problema está no
     * JavaScript do navegador.
     */
    const arquivos = [
        ...fs.readdirSync(FRONTEND).filter((f) => f.endsWith('.html')).map((f) => f),
        ...fs.readdirSync(path.join(FRONTEND, 'js'))
            .filter((f) => f.endsWith('.js'))
            .map((f) => `js/${f}`)
    ];

    test.each(arquivos)('%s não tem localhost fixo', (arquivo) => {
        const conteudo = ler(arquivo);

        // config.js é a exceção legítima: é ele que decide a URL,
        // escolhendo localhost só quando a página está em localhost.
        if (arquivo === 'js/config.js') return;

        const linhas = conteudo.split('\n')
            .map((l, i) => ({ n: i + 1, texto: l }))
            .filter(({ texto }) => /https?:\/\/(localhost|127\.0\.0\.1)/.test(texto))
            // Comentários não afetam o comportamento.
            .filter(({ texto }) => !/^\s*(\/\/|\*|<!--)/.test(texto));

        expect(linhas.map((l) => `linha ${l.n}: ${l.texto.trim().slice(0, 80)}`)).toEqual([]);
    });

    test('nenhum caminho do GitHub Pages (/Unimap/) sobrou', () => {
        // O logo do Google apontava para /Unimap/frontend/images/..., que
        // só existe na publicação do GitHub Pages. No Render a raiz
        // estática é frontend/, então a imagem vinha quebrada.
        for (const arquivo of arquivos) {
            const conteudo = ler(arquivo);
            expect(conteudo).not.toMatch(/["'(]\/Unimap\//);
        }
    });
});

describe('Interface sem emoji', () => {
    /**
     * O frontend tinha 1.311 emojis: 931 em console.log e 380 que
     * podiam chegar à tela. Emoji não tem o mesmo desenho em cada
     * sistema operacional, não acompanha tamanho de fonte nem tema, e
     * leitor de tela anuncia o nome dele junto do texto.
     *
     * Em lugar deles, Font Awesome, que já era usado no projeto.
     */
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/u;

    const arquivos = [
        ...fs.readdirSync(FRONTEND).filter((f) => f.endsWith('.html')),
        ...fs.readdirSync(path.join(FRONTEND, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
        ...fs.readdirSync(path.join(FRONTEND, 'css')).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`)
    ];

    test.each(arquivos)('%s não tem emoji', (arquivo) => {
        const linhas = ler(arquivo).split('\n')
            .map((texto, i) => ({ n: i + 1, texto }))
            .filter(({ texto }) => EMOJI.test(texto))
            .map((l) => `linha ${l.n}: ${l.texto.trim().slice(0, 60)}`);

        expect(linhas).toEqual([]);
    });

    test('todas as páginas carregam a biblioteca de ícones', () => {
        const semIcones = arquivos
            .filter((f) => f.endsWith('.html'))
            .filter((f) => !ler(f).includes('font-awesome'));

        expect(semIcones).toEqual([]);
    });
});

describe('Responsividade', () => {
    const paginas = fs.readdirSync(FRONTEND).filter((f) => f.endsWith('.html'));

    test.each(paginas)('%s declara a viewport', (pagina) => {
        expect(ler(pagina)).toMatch(/name=["']viewport["']/);
    });

    test.each(paginas)('%s carrega a base responsiva', (pagina) => {
        expect(ler(pagina)).toContain('css/responsivo.css');
    });

    test('nenhum container de formulário tem largura fixa', () => {
        // `width: 400px` no cartão de login e de cadastro estourava a
        // tela em celular de 360px.
        for (const arquivo of ['css/login.css', 'css/cadastro.css']) {
            const css = ler(arquivo);
            const container = css.match(/\.(login|register)-container \{[^}]*\}/);
            expect(container).not.toBeNull();
            expect(container[0]).not.toMatch(/\n\s*width:\s*\d+px/);
        }
    });

    test('toda altura 100vh tem a versão dvh ao lado', () => {
        // No celular, 100vh conta a altura com a barra do navegador
        // recolhida, e o conteúdo fica cortado.
        for (const arquivo of fs.readdirSync(path.join(FRONTEND, 'css')).filter((f) => f.endsWith('.css'))) {
            const linhas = ler(`css/${arquivo}`).split('\n');
            linhas.forEach((linha, i) => {
                if (!/(?:min-|max-)?height\s*:\s*100vh/.test(linha)) return;
                const seguinte = linhas[i + 1] || '';
                expect(seguinte).toMatch(/100dvh/);
            });
        }
    });
});

describe('Erros do servidor chegam ao usuário', () => {
    // O catch do cadastro só reconhecia três mensagens específicas e
    // trocava todo o resto por "Erro ao fazer cadastro. Tente
    // novamente." — então um 400 de validação virava um erro sem
    // explicação na tela.
    test('cadastro.html usa a mensagem vinda do servidor', () => {
        const conteudo = ler('cadastro.html');

        // Precisa existir algum caminho que use error.message / result.error
        // como texto exibido, não só comparações com strings fixas.
        const usaMensagemDoServidor =
            /errorMessage\s*=\s*error\.message/.test(conteudo)
            || /showMessage\(\s*['"`]❌ ['"`]\s*\+\s*error\.message/.test(conteudo);

        expect(usaMensagemDoServidor).toBe(true);
    });

    test('cadastro.html não descarta a mensagem do servidor em favor de um texto genérico fixo', () => {
        const conteudo = ler('cadastro.html');

        // O padrão problemático: declarar a mensagem genérica e só
        // sobrescrevê-la em casos específicos, sem fallback para o que
        // o servidor disse.
        const temGenericoSemFallback =
            /let errorMessage = 'Erro ao fazer cadastro\. Tente novamente\.';/.test(conteudo)
            && !/errorMessage\s*=\s*error\.message/.test(conteudo);

        expect(temGenericoSemFallback).toBe(false);
    });
});
