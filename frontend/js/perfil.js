/**
 * perfil.js — preenche a tela Meu Perfil.
 *
 * O perfil.html sempre referenciou este arquivo, mas ele não existia: o
 * navegador recebia 404 e a tela ficava com todos os campos em "-".
 *
 * Fontes dos dados:
 *   GET /api/usuarios/perfil              dados do usuário logado
 *   GET /api/professores/favoritos/:id    professores favoritados (alunos)
 *   GET /api/aluno/:id/aulas              aulas do aluno
 */
(function () {
    'use strict';

    const API = (typeof Config !== 'undefined' && Config.getBaseURL)
        ? Config.getBaseURL()
        : window.location.origin + '/api';

    const token = () => localStorage.getItem('authToken');

    /** Escreve em um elemento pelo id, sem quebrar se ele não existir. */
    function escrever(id, valor) {
        const el = document.getElementById(id);
        if (el) el.textContent = (valor === null || valor === undefined || valor === '')
            ? '-'
            : valor;
    }

    async function buscar(caminho) {
        const resposta = await fetch(`${API}${caminho}`, {
            headers: {
                'Authorization': `Bearer ${token()}`,
                'Content-Type': 'application/json'
            }
        });
        if (!resposta.ok) {
            throw new Error(`${resposta.status} em ${caminho}`);
        }
        return resposta.json();
    }

    /** "aluno" -> "Aluno". Deixa o tipo apresentável. */
    function rotuloTipo(tipo) {
        if (!tipo) return '-';
        const mapa = { aluno: 'Aluno', professor: 'Professor', admin: 'Administrador' };
        return mapa[tipo] || (tipo.charAt(0).toUpperCase() + tipo.slice(1));
    }

    async function carregarDados() {
        // Mostra na hora o que já está salvo localmente, para a tela não
        // ficar vazia enquanto a requisição não volta.
        try {
            const local = JSON.parse(localStorage.getItem('userData') || 'null');
            if (local) preencher(local);
        } catch (_) { /* userData corrompido: ignora e espera a API */ }

        const usuario = await buscar('/usuarios/perfil');
        preencher(usuario);
        return usuario;
    }

    function preencher(u) {
        escrever('profile-nome', u.nome);
        escrever('profile-email', u.email);
        escrever('profile-matricula', u.matricula);
        escrever('profile-curso', u.curso);
        escrever('profile-periodo', u.periodo ? `${u.periodo}º` : null);
        escrever('profile-tipo', rotuloTipo(u.tipo));
    }

    /**
     * As estatísticas são secundárias: se uma falhar, a outra ainda aparece
     * e os dados pessoais continuam na tela.
     */
    async function carregarEstatisticas(usuario) {
        if (!usuario || !usuario.id) return;

        const favoritos = buscar(`/professores/favoritos/${usuario.id}`)
            .then((lista) => escrever('stat-favoritos', Array.isArray(lista) ? lista.length : 0))
            .catch(() => escrever('stat-favoritos', 0));

        const aulas = buscar(`/aluno/${usuario.id}/aulas`)
            .then((lista) => escrever('stat-aulas', contarDaSemana(lista)))
            .catch(() => escrever('stat-aulas', 0));

        await Promise.allSettled([favoritos, aulas]);
    }

    /** Conta as aulas entre a segunda e o domingo da semana corrente. */
    function contarDaSemana(lista) {
        if (!Array.isArray(lista)) return 0;

        const hoje = new Date();
        const diaDaSemana = (hoje.getDay() + 6) % 7; // segunda = 0
        const segunda = new Date(hoje);
        segunda.setDate(hoje.getDate() - diaDaSemana);
        segunda.setHours(0, 0, 0, 0);
        const domingo = new Date(segunda);
        domingo.setDate(segunda.getDate() + 6);
        domingo.setHours(23, 59, 59, 999);

        return lista.filter((aula) => {
            if (!aula || !aula.data_aula) return false;
            const data = new Date(aula.data_aula);
            if (isNaN(data)) return false;
            return data >= segunda && data <= domingo;
        }).length;
    }

    async function iniciar() {
        if (!token()) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const usuario = await carregarDados();
            await carregarEstatisticas(usuario);
        } catch (erro) {
            console.error('Erro ao carregar o perfil:', erro);
            // O session.js já trata 401 redirecionando para o login.
            // Aqui só evitamos deixar a tela mentindo que carregou.
            escrever('profile-nome', 'Não foi possível carregar');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
