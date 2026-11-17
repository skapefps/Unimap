/**
 * icones.js — ícone por tipo de mensagem.
 *
 * As mensagens do sistema carregavam o emoji no texto: cada chamada
 * escrevia `showMessage(erro, 'error')`. Isso espalhava a
 * decisão visual por dezenas de pontos, não respeita o tamanho de fonte
 * nem o tema, e emoji não tem o mesmo desenho em cada sistema
 * operacional.
 *
 * Agora o tipo decide o ícone, num lugar só. A chamada passa o texto e
 * o tipo; o componente desenha.
 *
 * Carregado antes dos demais scripts, junto de session.js e config.js.
 */
(function () {
    'use strict';

    /** Classe do Font Awesome para cada tipo de mensagem. */
    const ICONES = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info',
        loading: 'fa-spinner fa-spin'
    };

    /**
 * Devolve o HTML do ícone para um tipo de mensagem.
 *
 * `aria-hidden` porque o texto ao lado já diz o que aconteceu —
 * sem isso o leitor de tela anuncia o ícone e repete a informação.
 *
 * @param {string} tipo success | error | warning | info | loading
 * @returns {string}
 */
    function iconeDe(tipo) {
        const classe = ICONES[tipo] || ICONES.info;
        return `<i class="fas ${classe}" aria-hidden="true"></i>`;
    }

    /**
 * Remove emoji do início de um texto.
 *
 * Existe para o período de transição: enquanto alguma chamada antiga
 * ainda mandar `' Erro'`, o emoji sai antes de a mensagem aparecer,
 * em vez de ficar ao lado do ícone novo.
 *
 * @param {string} texto
 * @returns {string}
 */
    function semEmoji(texto) {
        if (typeof texto !== 'string') return texto;
        return texto
            .replace(/^[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]+/u, '')
            .trim();
    }

    window.UnimapIcones = { iconeDe, semEmoji, ICONES };
})();
