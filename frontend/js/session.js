/**
 * session.js — controle de sessão.
 *
 * O token agora é um JWT com validade (7 dias por padrão), então ele
 * expira. Antes, o "token" era o ID do usuário e nunca vencia, de modo
 * que nenhuma página precisava lidar com sessão perdida.
 *
 * Em vez de tratar 401 nas 47 chamadas fetch espalhadas pelo projeto,
 * este arquivo intercepta o fetch uma única vez. Precisa ser carregado
 * ANTES dos outros scripts.
 */
(function () {
    'use strict';

    const PAGINAS_PUBLICAS = [
        'login.html',
        'cadastro.html',
        'forgot-password.html',
        'reset-password.html'
    ];

    const emPaginaPublica = () =>
        PAGINAS_PUBLICAS.some((p) => window.location.pathname.endsWith(p));

    let encerrando = false;

    /**
 * Limpa a sessão e volta ao login, preservando o destino para
 * retomar depois do novo login.
 */
    function encerrarSessao(motivo) {
        if (encerrando || emPaginaPublica()) return;
        encerrando = true;

        console.warn(' Sessão encerrada:', motivo);

        try {
            const destino = window.location.pathname + window.location.search;
            sessionStorage.setItem('unimap:redirecionarPara', destino);
        } catch (e) {
 // sessionStorage pode falhar em modo privado; não é crítico.
        }

        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');

        const msg = motivo === 'expirada'
            ? 'Sua sessão expirou. Faça login novamente.'
            : 'Faça login para continuar.';

        try {
            sessionStorage.setItem('unimap:mensagemLogin', msg);
        } catch (e) { /* idem */ }

        window.location.href = 'login.html';
    }

    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async function (recurso, opcoes) {
        const resposta = await fetchOriginal(recurso, opcoes);

 // Só reage a chamadas da própria API.
        const url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
        const eApiPropria = url.includes('/api/');

        if (resposta.status === 401 && eApiPropria) {
 // Não derruba a sessão por um 401 do próprio login: ali o 401
 // significa "senha errada", não "sessão inválida".
            const eRotaDeLogin = /\/api\/auth\/(login|login-professor|google|register|forgot-password|reset-password)/.test(url);

            if (!eRotaDeLogin) {
                let expirada = false;
                try {
 // Clona: o corpo original precisa seguir legível para quem chamou.
                    const corpo = await resposta.clone().json();
                    expirada = corpo && corpo.expired === true;
                } catch (e) {
 // Resposta sem JSON; trata como sessão inválida genérica.
                }
                encerrarSessao(expirada ? 'expirada' : 'invalida');
            }
        }

        return resposta;
    };

    /**
 * Na página de login, mostra o motivo de a sessão ter caído, para o
 * usuário não ficar sem explicação depois de um redirecionamento.
 */
    function exibirMensagemPendente() {
        let msg;
        try {
            msg = sessionStorage.getItem('unimap:mensagemLogin');
            if (msg) sessionStorage.removeItem('unimap:mensagemLogin');
        } catch (e) {
            return;
        }
        if (!msg) return;

        const alvo = document.getElementById('loginErrorDesktop')
            || document.querySelector('.error-message');

        if (alvo) {
            alvo.textContent = msg;
            alvo.style.display = 'block';
        }
    }

    if (window.location.pathname.endsWith('login.html')) {
        document.addEventListener('DOMContentLoaded', exibirMensagemPendente);
    }

    /** Exposto para o logout manual dos botões de sair. */
    window.unimapSession = {
        encerrar: () => encerrarSessao('logout'),
        token: () => localStorage.getItem('authToken'),
        autenticado: () => Boolean(localStorage.getItem('authToken')),
        /** Destino salvo antes do redirecionamento, para retomar após login. */
        destinoPendente: () => {
            try {
                const d = sessionStorage.getItem('unimap:redirecionarPara');
                if (d) sessionStorage.removeItem('unimap:redirecionarPara');
                return d;
            } catch (e) {
                return null;
            }
        }
    };
})();
