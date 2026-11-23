/**
 * mapa-campus.js — planta esquemática do campus, clicável.
 *
 * O "mapa" do sistema era uma lista agrupada por bloco e andar. Esta é a
 * planta desenhada: cada prédio é uma forma clicável que abre os andares
 * e as salas daquele bloco.
 *
 * SOBRE A GEOMETRIA
 *
 * As posições vêm da placa de orientação do campus. É uma planta
 * ESQUEMÁTICA: a disposição relativa dos prédios, as vias e os acessos
 * seguem a placa, mas as formas são simplificadas e as medidas não são
 * de levantamento. Serve para achar um bloco, não para medir distância.
 *
 * O volume (as laterais mais escuras) é desenhado por extrusão: cada
 * prédio é um polígono de topo mais duas faces projetadas na diagonal,
 * o que dá a leitura isométrica da placa sem precisar de 3D de verdade.
 *
 * Para corrigir a posição de um prédio, mexa só em PREDIOS: x e y são o
 * canto superior esquerdo e w e h o tamanho, no sistema do viewBox
 * (1000 × 720). `alt` é a altura aparente. Nada mais precisa mudar.
 */
(function () {
    'use strict';

    /**
     * Prédios do campus.
     *
     * A placa mostra fileiras diagonais, com a pista e o campo a oeste e
     * a via principal ao norte. `alt` dá o número de pavimentos
     * aparentes — prédios mais altos ficam com a lateral mais alta.
     */
    const PREDIOS = [
        // Fileira norte, de oeste para leste
        { letra: 'J', x: 72,  y: 158, w: 50, h: 186, alt: 16 },
        { letra: 'I', x: 142, y: 142, w: 52, h: 200, alt: 20 },
        { letra: 'B', x: 234, y: 128, w: 52, h: 210, alt: 18 },
        { letra: 'G', x: 324, y: 118, w: 56, h: 220, alt: 20 },
        { letra: 'L', x: 432, y: 112, w: 48, h: 200, alt: 16 },
        { letra: 'D', x: 522, y: 106, w: 60, h: 224, alt: 20 },

        // Fileira central
        { letra: 'K', x: 98,  y: 378, w: 50, h: 146, alt: 14 },
        { letra: 'F', x: 320, y: 366, w: 52, h: 148, alt: 20 },
        { letra: 'E', x: 394, y: 380, w: 48, h: 148, alt: 18 },
        { letra: 'C', x: 602, y: 336, w: 46, h: 118, alt: 16 },
        { letra: 'N', x: 670, y: 328, w: 46, h: 118, alt: 18 },
        { letra: 'A', x: 742, y: 324, w: 46, h: 128, alt: 16 },

        // Fileira sul
        { letra: 'H', x: 642, y: 476, w: 58, h: 118, alt: 20 },
        { letra: 'M', x: 472, y: 526, w: 54, h: 108, alt: 18 },

        // Prédio sem letra no cadastro
        { letra: 'ALFA', x: 232, y: 596, w: 148, h: 58, alt: 12, rotacao: -8 }
    ];

    /** Áreas verdes e esportivas. */
    /* A pista fica abaixo e a oeste do bloco K; com cy menor, a elipse
       passava por baixo do prédio e os dois se misturavam. */
    const CAMPO = { cx: 136, cy: 612, rx: 92, ry: 56 };
    const VERDE = { x: 822, y: 306, w: 136, h: 322, nome: 'Área verde' };

    /** Acessos numerados na placa. */
    const ACESSOS = [
        { n: '01', x: 792, y: 476 },
        { n: '02', x: 542, y: 426 },
        { n: '03', x: 302, y: 436 }
    ];

    /** Inclinação das fileiras, em graus. */
    const ROTACAO = -28;

    /** Deslocamento da extrusão, que cria o volume. */
    const DX = 9;

    let dadosMapa = null;
    let blocoAberto = null;

    const ns = 'http://www.w3.org/2000/svg';
    const cria = (tag, attrs = {}) => {
        const el = document.createElementNS(ns, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
    };

    // ----------------------------------------------------------------
    // Desenho
    // ----------------------------------------------------------------

    function desenharPredio(svg, p, dados) {
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const rot = p.rotacao === undefined ? ROTACAO : p.rotacao;
        const alt = p.alt || 16;

        const vocacao = vocacaoDe(dados);

        const g = cria('g', {
            class: 'mapa-predio',
            'data-bloco': p.letra,
            'data-familia': familiaDo(dados),
            tabindex: '0',
            role: 'button',
            'aria-label': dados
                ? `Bloco ${p.letra}, ${dados.total_salas} locais${vocacao ? '. ' + vocacao : ''}`
                : `Bloco ${p.letra}, sem locais cadastrados`
        });

        // Tooltip nativo: passar o mouse já diz o que tem ali.
        if (vocacao) {
            const titulo = cria('title');
            titulo.textContent = `Bloco ${p.letra} — ${vocacao}`;
            g.appendChild(titulo);
        }

        const interno = cria('g', { transform: `rotate(${rot} ${cx} ${cy})` });

        // Faces laterais primeiro: ficam atrás do topo.
        interno.appendChild(cria('polygon', {
            class: 'mapa-predio-lado',
            points: [
                `${p.x + p.w},${p.y}`,
                `${p.x + p.w + DX},${p.y + alt}`,
                `${p.x + p.w + DX},${p.y + p.h + alt}`,
                `${p.x + p.w},${p.y + p.h}`
            ].join(' ')
        }));

        interno.appendChild(cria('polygon', {
            class: 'mapa-predio-frente',
            points: [
                `${p.x},${p.y + p.h}`,
                `${p.x + p.w},${p.y + p.h}`,
                `${p.x + p.w + DX},${p.y + p.h + alt}`,
                `${p.x + DX},${p.y + p.h + alt}`
            ].join(' ')
        }));

        // Topo
        interno.appendChild(cria('rect', {
            class: 'mapa-predio-topo',
            x: p.x, y: p.y, width: p.w, height: p.h, rx: 5
        }));

        g.appendChild(interno);

        // Rótulo sem rotação, para o texto ficar sempre na horizontal.
        const selo = cria('g', { class: 'mapa-predio-selo' });
        selo.appendChild(cria('circle', { cx, cy: cy - 8, r: 15 }));
        const letra = cria('text', {
            x: cx, y: cy - 2, 'text-anchor': 'middle', class: 'mapa-predio-letra'
        });
        letra.textContent = p.letra;
        selo.appendChild(letra);

        if (dados) {
            const qtd = cria('text', {
                x: cx, y: cy + 24, 'text-anchor': 'middle', class: 'mapa-predio-qtd'
            });
            qtd.textContent = String(dados.total_salas);
            selo.appendChild(qtd);
        }

        g.appendChild(selo);

        const abrir = () => abrirBloco(p.letra);
        g.addEventListener('click', abrir);
        g.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); }
        });

        svg.appendChild(g);
    }

    function desenhar(svg) {
        svg.innerHTML = '';

        svg.appendChild(cria('rect', {
            x: 0, y: 0, width: 1000, height: 720, class: 'mapa-fundo'
        }));

        // Área verde a leste
        const verdeCx = VERDE.x + VERDE.w / 2;
        const verdeCy = VERDE.y + VERDE.h / 2;

        svg.appendChild(cria('rect', {
            x: VERDE.x, y: VERDE.y, width: VERDE.w, height: VERDE.h, rx: 14,
            class: 'mapa-verde',
            transform: `rotate(${ROTACAO} ${verdeCx} ${verdeCy})`
        }));

        // Sem rótulo, a mancha verde parecia um prédio sem nome.
        const verdeTexto = cria('text', {
            x: verdeCx, y: verdeCy, 'text-anchor': 'middle', class: 'mapa-area-nome'
        });
        verdeTexto.textContent = VERDE.nome;
        svg.appendChild(verdeTexto);

        // Pista e campo
        const campoG = cria('g', {
            transform: `rotate(${ROTACAO} ${CAMPO.cx} ${CAMPO.cy})`
        });
        campoG.appendChild(cria('ellipse', {
            cx: CAMPO.cx, cy: CAMPO.cy, rx: CAMPO.rx, ry: CAMPO.ry, class: 'mapa-pista'
        }));
        campoG.appendChild(cria('ellipse', {
            cx: CAMPO.cx, cy: CAMPO.cy, rx: CAMPO.rx - 24, ry: CAMPO.ry - 22, class: 'mapa-campo'
        }));
        svg.appendChild(campoG);

        const campoTexto = cria('text', {
            x: CAMPO.cx, y: CAMPO.cy + 4, 'text-anchor': 'middle', class: 'mapa-area-nome'
        });
        campoTexto.textContent = 'Pista e campo';
        svg.appendChild(campoTexto);

        // Via ao norte
        svg.appendChild(cria('line', {
            x1: 30, y1: 118, x2: 905, y2: 18, class: 'mapa-via'
        }));
        const viaTexto = cria('text', {
            x: 430, y: 64, 'text-anchor': 'middle', class: 'mapa-via-nome',
            transform: 'rotate(-6.5 430 64)'
        });
        viaTexto.textContent = 'Rua Olímpio Pereira de Melo';
        svg.appendChild(viaTexto);

        // Prédios, do fundo para a frente para a extrusão empilhar certo.
        const ordenados = [...PREDIOS].sort((a, b) => (a.y + a.h) - (b.y + b.h));
        for (const p of ordenados) {
            const dados = dadosMapa && dadosMapa.blocos.find((b) => b.letra === p.letra);
            desenharPredio(svg, p, dados);
        }

        // Acessos
        for (const a of ACESSOS) {
            const g = cria('g', { class: 'mapa-acesso' });
            g.appendChild(cria('rect', {
                x: a.x - 17, y: a.y - 13, width: 34, height: 26, rx: 7
            }));
            const t = cria('text', { x: a.x, y: a.y + 5, 'text-anchor': 'middle' });
            t.textContent = a.n;
            g.appendChild(t);
            const titulo = cria('title');
            titulo.textContent = `Acesso ${a.n}`;
            g.appendChild(titulo);
            svg.appendChild(g);
        }
    }

    // ----------------------------------------------------------------
    // Painel
    // ----------------------------------------------------------------

    const nomeAndar = (n) => (n === 0 ? 'Térreo' : `${n}º piso`);

    const ICONE_TIPO = {
        'Sala de Aula': 'fa-chalkboard',
        'Laboratório': 'fa-flask',
        'Laboratório de Informática': 'fa-desktop',
        'Auditório': 'fa-users',
        'Clínica': 'fa-stethoscope',
        'Convivência': 'fa-mug-hot',
        'Administrativo': 'fa-briefcase'
    };

    /**
     * Agrupa os tipos cadastrados em poucas famílias, que viram a cor do
     * prédio no mapa. Um campus todo da mesma cor não diz nada; colorido
     * pela vocação, o aluno acha o laboratório sem ler nome nenhum.
     */
    const FAMILIA = {
        'Sala de Aula': 'aula',
        'Laboratório': 'lab',
        'Laboratório de Informática': 'lab',
        'Auditório': 'auditorio',
        'Clínica': 'clinica',
        'Convivência': 'convivio',
        'Administrativo': 'admin',
        'Sala de Reunião': 'admin'
    };

    const ROTULO_FAMILIA = {
        aula: 'Salas de aula',
        lab: 'Laboratórios',
        auditorio: 'Auditórios',
        clinica: 'Clínicas',
        convivio: 'Convivência',
        admin: 'Administrativo'
    };

    /** A família que mais aparece no bloco. */
    function familiaDo(dados) {
        if (!dados || !dados.tipos || !dados.tipos.length) return 'outro';

        const soma = new Map();
        for (const { tipo, qtd } of dados.tipos) {
            const f = FAMILIA[tipo] || 'outro';
            soma.set(f, (soma.get(f) || 0) + qtd);
        }
        return [...soma.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    /**
     * Uma linha curta dizendo o que há no bloco, montada a partir dos
     * locais reais. Vale mais que o nome cadastrado, que em vários blocos
     * é genérico e não bate com o conteúdo.
     */
    function vocacaoDe(dados) {
        if (!dados) return '';
        if (dados.destaques && dados.destaques.length) {
            return dados.destaques.join(' · ');
        }
        if (dados.tipos && dados.tipos.length) {
            return dados.tipos
                .map((t) => ROTULO_FAMILIA[FAMILIA[t.tipo]] || t.tipo)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(' · ');
        }
        return '';
    }

    async function abrirBloco(letra) {
        blocoAberto = letra;

        document.querySelectorAll('.mapa-predio').forEach((el) => {
            el.classList.toggle('ativo', el.dataset.bloco === letra);
        });

        const painel = document.getElementById('mapaPainel');
        const dados = dadosMapa && dadosMapa.blocos.find((b) => b.letra === letra);

        if (!dados) {
            painel.innerHTML = `
                <div class="mapa-painel-topo">
                    <div><h3>Bloco ${letra}</h3></div>
                    <button type="button" class="mapa-fechar" aria-label="Fechar">
                        <i class="fas fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>
                <p class="mapa-vazio">Este bloco ainda não tem locais cadastrados.</p>`;
            painel.classList.add('aberto');
            painel.querySelector('.mapa-fechar').addEventListener('click', fecharPainel);
            return;
        }

        painel.innerHTML = `
            <div class="mapa-painel-topo">
                <div>
                    <span class="mapa-painel-letra" data-familia="${familiaDo(dados)}">${dados.letra}</span>
                    <h3>${dados.nome}</h3>
                    <p class="mapa-painel-sub">${dados.total_salas} locais · ${dados.andares.length} ${dados.andares.length === 1 ? 'piso' : 'pisos'}</p>
                    ${dados.destaques && dados.destaques.length
                        ? `<p class="mapa-painel-destaques">${dados.destaques.join(' · ')}</p>`
                        : ''}
                </div>
                <button type="button" class="mapa-fechar" aria-label="Fechar">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </div>
            <div class="mapa-andares" role="tablist">
                ${dados.andares.map((a, i) => `
                    <button type="button" role="tab" class="mapa-andar${i === 0 ? ' ativo' : ''}"
                            data-andar="${a.andar}" aria-selected="${i === 0}">
                        ${nomeAndar(a.andar)} <span>${a.salas}</span>
                    </button>`).join('')}
            </div>
            <div class="mapa-salas" id="mapaSalas" role="tabpanel"></div>`;

        painel.classList.add('aberto');
        painel.querySelector('.mapa-fechar').addEventListener('click', fecharPainel);

        painel.querySelectorAll('.mapa-andar').forEach((btn) => {
            btn.addEventListener('click', () => {
                painel.querySelectorAll('.mapa-andar').forEach((b) => {
                    b.classList.remove('ativo');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('ativo');
                btn.setAttribute('aria-selected', 'true');
                carregarSalas(letra, btn.dataset.andar);
            });
        });

        if (dados.andares.length) carregarSalas(letra, dados.andares[0].andar);
    }

    function fecharPainel() {
        const painel = document.getElementById('mapaPainel');
        if (painel) painel.classList.remove('aberto');
        document.querySelectorAll('.mapa-predio').forEach((el) => el.classList.remove('ativo'));
        blocoAberto = null;
    }

    async function carregarSalas(bloco, andar) {
        const alvo = document.getElementById('mapaSalas');
        if (!alvo) return;

        alvo.innerHTML = '<p class="mapa-carregando"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Carregando…</p>';

        try {
            const r = await fetch(
                `${Config.getBaseURL()}/salas/bloco/${encodeURIComponent(bloco)}/andar/${encodeURIComponent(andar)}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
            );
            if (!r.ok) throw new Error('Não foi possível carregar os locais');

            const salas = await r.json();
            if (!salas.length) {
                alvo.innerHTML = '<p class="mapa-vazio">Nenhum local neste piso.</p>';
                return;
            }

            alvo.innerHTML = `<ul class="mapa-lista">${salas.map((s) => {
                // Quando o número é só dígitos, o nome completo está em
                // recursos; quando é um nome, não há o que repetir.
                const ehNumero = /^\d+$/.test(s.numero || '');
                const detalhe = ehNumero && s.recursos ? s.recursos : '';
                return `
                <li>
                    <i class="fas ${ICONE_TIPO[s.tipo] || 'fa-door-open'}" aria-hidden="true"></i>
                    <div class="mapa-item-texto">
                        <span class="mapa-item-nome">${s.numero}</span>
                        ${detalhe ? `<span class="mapa-item-det">${detalhe}</span>` : ''}
                        <span class="mapa-item-tipo">${s.tipo || ''}</span>
                    </div>
                    ${s.telefone ? `<a class="mapa-item-tel" href="tel:${s.telefone.replace(/\D/g, '')}">
                        <i class="fas fa-phone" aria-hidden="true"></i><span>${s.telefone}</span></a>` : ''}
                </li>`;
            }).join('')}</ul>`;
        } catch (e) {
            alvo.innerHTML = `<p class="mapa-vazio">${e.message}</p>`;
        }
    }

    // ----------------------------------------------------------------
    // Lista alternativa, para quem prefere ir selecionando
    // ----------------------------------------------------------------

    function montarLista() {
        const alvo = document.getElementById('mapaListaBlocos');
        if (!alvo || !dadosMapa) return;

        const desenhados = new Set(PREDIOS.map((p) => p.letra));

        const cartao = (b) => {
            const vocacao = vocacaoDe(b);
            return `
            <button type="button" class="mapa-cartao" data-bloco="${b.letra}"
                    data-familia="${familiaDo(b)}">
                <span class="mapa-cartao-letra">${b.letra}</span>
                <span class="mapa-cartao-texto">
                    <span class="mapa-cartao-nome">${vocacao || b.nome}</span>
                    <span class="mapa-cartao-qtd">${b.total_salas}
                        ${b.total_salas === 1 ? 'local' : 'locais'}</span>
                </span>
            </button>`;
        };

        // Os blocos que não estão na planta são unidades à parte (clínicas,
        // centro de convenções, campos experimentais). Sem uma seção
        // própria, eles ficariam invisíveis no mapa e perdidos na lista.
        const naPlanta = dadosMapa.blocos.filter((b) => desenhados.has(b.letra));
        const fora = dadosMapa.blocos.filter((b) => !desenhados.has(b.letra));

        alvo.innerHTML = `
            <div class="mapa-grupo">
                <h4>Blocos na planta</h4>
                <div class="mapa-cartoes">${naPlanta.map(cartao).join('')}</div>
            </div>
            ${fora.length ? `
            <div class="mapa-grupo">
                <h4>Outras unidades
                    <span class="mapa-grupo-nota">fora da planta principal</span>
                </h4>
                <div class="mapa-cartoes">${fora.map(cartao).join('')}</div>
            </div>` : ''}`;

        alvo.querySelectorAll('.mapa-cartao').forEach((c) => {
            c.addEventListener('click', () => abrirBloco(c.dataset.bloco));
        });
    }

    // ----------------------------------------------------------------

    async function iniciar() {
        const svg = document.getElementById('mapaSvg');
        if (!svg) return;

        try {
            const r = await fetch(`${Config.getBaseURL()}/salas/mapa`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (r.ok) dadosMapa = await r.json();
        } catch (e) {
            console.warn('Mapa sem dados do servidor:', e.message);
        }

        desenhar(svg);
        montarLista();

        const resumo = document.getElementById('mapaResumo');
        if (resumo && dadosMapa) {
            resumo.textContent = `${dadosMapa.total_blocos} blocos · ${dadosMapa.total_salas} locais`;
        }

        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' && blocoAberto) fecharPainel();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

    window.UnimapMapa = { abrirBloco, fecharPainel, PREDIOS };
})();
