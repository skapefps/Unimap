/**
 * calendario.js — calendário acadêmico 2026.
 *
 * Os dados vêm do PDF oficial da UNIPAM (Portaria 3.463/2025), e o link
 * para o PDF fica na página: o que está aqui é uma leitura navegável
 * dele, não uma fonte paralela. Se a reitoria publicar uma versão nova,
 * o PDF muda e esta lista precisa ser atualizada junto.
 */
(function () {
    'use strict';

    const PDF = 'https://paineis.unipam.edu.br/paineis.php?nome=Calend__rio_Acad__mico_2026.pdf&local=unipam/calendario';

    /**
     * Um registro por mês. `letivos` é o número de dias letivos que o
     * PDF declara; meses sem aula não trazem o campo.
     *
     * `tipo` classifica o evento para a cor e o ícone:
     *   feriado    — não há expediente
     *   sabado     — sábado letivo, com horário de outro dia da semana
     *   prazo      — data limite ou período de solicitação
     *   marco      — início e encerramento de semestre
     *   reuniao    — reunião pedagógica
     */
    const MESES = [
        {
            mes: 'Janeiro', n: 1,
            eventos: [
                { dia: '02 a 30', tipo: 'prazo', texto: 'Solicitação de Obtenção de Novo Título e de Transferência Externa' },
                { dia: '19 a 23', tipo: 'prazo', texto: 'Renovação de matrículas, reabertura por trancamento e rematrícula de desistentes (se houver vaga)' }
            ]
        },
        {
            mes: 'Fevereiro', n: 2, letivos: 17,
            eventos: [
                { dia: '02', tipo: 'marco', texto: 'Início do semestre letivo e matrícula dos retardatários. Resultados dos pedidos de transferência e obtenção de novo título' },
                { dia: '02 a 29', tipo: 'prazo', texto: 'Recebimento de pedidos de aproveitamento de estudos e ajuste de matrículas' },
                { dia: '07', tipo: 'reuniao', texto: 'Reunião pedagógica' },
                { dia: '16 a 18', tipo: 'feriado', texto: 'Feriado e recesso de Carnaval e Quarta-feira de Cinzas' }
            ]
        },
        {
            mes: 'Março', n: 3, letivos: 22,
            eventos: [
                { dia: '11', tipo: 'prazo', texto: 'Última data para regularização de pendências acadêmicas, conforme Portaria da Reitoria' }
            ]
        },
        {
            mes: 'Abril', n: 4, letivos: 18,
            eventos: [
                { dia: '02 e 03', tipo: 'feriado', texto: 'Recesso e Sexta-feira Santa' },
                { dia: '20 e 21', tipo: 'feriado', texto: 'Feriado de Tiradentes e recesso' }
            ]
        },
        {
            mes: 'Maio', n: 5, letivos: 20,
            eventos: [
                { dia: '01', tipo: 'feriado', texto: 'Dia do Trabalho' },
                { dia: '24', tipo: 'feriado', texto: 'Aniversário da cidade' }
            ]
        },
        {
            mes: 'Junho', n: 6, letivos: 21,
            eventos: [
                { dia: '04', tipo: 'feriado', texto: 'Corpus Christi e recesso' },
                { dia: '13', tipo: 'feriado', texto: 'Santo Antônio' },
                { dia: '20', tipo: 'sabado', texto: 'Sábado letivo, com horário de sexta-feira' }
            ]
        },
        {
            mes: 'Julho', n: 7, letivos: 3,
            eventos: [
                { dia: '03', tipo: 'marco', texto: 'Encerramento do semestre letivo' },
                { dia: '01 a 31', tipo: 'prazo', texto: 'Solicitação de Obtenção de Novo Título e de Transferência Externa' },
                { dia: '20 a 24', tipo: 'prazo', texto: 'Renovação de matrículas, reabertura por trancamento e rematrícula de desistentes' }
            ]
        },
        {
            mes: 'Agosto', n: 8, letivos: 22,
            eventos: [
                { dia: '03', tipo: 'marco', texto: 'Início do semestre letivo e matrícula dos retardatários. Resultados dos pedidos de transferência e obtenção de novo título' },
                { dia: '08', tipo: 'reuniao', texto: 'Reunião pedagógica' },
                { dia: '15', tipo: 'feriado', texto: 'Nossa Senhora de Abadia e recesso' },
                { dia: '29', tipo: 'sabado', texto: 'Sábado letivo, com horário de quinta-feira' }
            ]
        },
        {
            mes: 'Setembro', n: 9, letivos: 22,
            eventos: [
                { dia: '04', tipo: 'prazo', texto: 'Última data para regularização de pendências acadêmicas, conforme Portaria da Reitoria' },
                { dia: '07', tipo: 'feriado', texto: 'Independência do Brasil' },
                { dia: '19', tipo: 'sabado', texto: 'Sábado letivo, com horário de segunda-feira' }
            ]
        },
        {
            mes: 'Outubro', n: 10, letivos: 22,
            eventos: [
                { dia: '03', tipo: 'sabado', texto: 'Sábado letivo, com horário de segunda-feira' },
                { dia: '12', tipo: 'feriado', texto: 'Nossa Senhora Aparecida' },
                { dia: '13', tipo: 'feriado', texto: 'Recesso do Dia do Professor' },
                { dia: '24', tipo: 'sabado', texto: 'Sábado letivo, com horário de segunda-feira' }
            ]
        },
        {
            mes: 'Novembro', n: 11, letivos: 21,
            eventos: [
                { dia: '02', tipo: 'feriado', texto: 'Finados' },
                { dia: '07', tipo: 'sabado', texto: 'Sábado letivo, com horário de sexta-feira' },
                { dia: '15', tipo: 'feriado', texto: 'Proclamação da República' },
                { dia: '20', tipo: 'feriado', texto: 'Consciência Negra' },
                { dia: '28', tipo: 'sabado', texto: 'Sábado letivo, com horário de terça-feira' }
            ]
        },
        {
            mes: 'Dezembro', n: 12, letivos: 13,
            eventos: [
                { dia: '05', tipo: 'sabado', texto: 'Sábado letivo, com horário de sexta-feira' },
                { dia: '16', tipo: 'marco', texto: 'Encerramento do semestre letivo' }
            ]
        }
    ];

    const ESTILO = {
        feriado: { icone: 'fa-umbrella-beach', rotulo: 'Feriado' },
        sabado:  { icone: 'fa-calendar-day',   rotulo: 'Sábado letivo' },
        prazo:   { icone: 'fa-hourglass-half', rotulo: 'Prazo' },
        marco:   { icone: 'fa-flag',           rotulo: 'Semestre' },
        reuniao: { icone: 'fa-people-group',   rotulo: 'Reunião' }
    };

    /** Converte "16 a 18" ou "02 e 03" no primeiro dia, para comparar com hoje. */
    function primeiroDia(texto) {
        const m = /(\d{1,2})/.exec(texto);
        return m ? Number(m[1]) : 1;
    }

    function ehFuturo(mesN, dia) {
        const hoje = new Date();
        const data = new Date(2026, mesN - 1, dia, 23, 59);
        return data >= hoje;
    }

    /** Os três próximos eventos a partir de hoje. */
    function proximos(limite = 3) {
        const lista = [];
        for (const m of MESES) {
            for (const e of m.eventos) {
                const d = primeiroDia(e.dia);
                if (ehFuturo(m.n, d)) lista.push({ ...e, mes: m.mes, mesN: m.n, ordem: m.n * 100 + d });
            }
        }
        return lista.sort((a, b) => a.ordem - b.ordem).slice(0, limite);
    }

    function montarDestaques() {
        const alvo = document.getElementById('calDestaques');
        if (!alvo) return;

        const lista = proximos();
        if (!lista.length) {
            alvo.innerHTML = '<p class="cal-vazio">O calendário de 2026 já terminou.</p>';
            return;
        }

        alvo.innerHTML = lista.map((e) => {
            const s = ESTILO[e.tipo];
            return `
            <article class="cal-destaque cal-${e.tipo}">
                <i class="fas ${s.icone}" aria-hidden="true"></i>
                <div>
                    <span class="cal-destaque-data">${e.dia} de ${e.mes}</span>
                    <p>${e.texto}</p>
                </div>
            </article>`;
        }).join('');
    }

    function montarMeses() {
        const alvo = document.getElementById('calMeses');
        if (!alvo) return;

        alvo.innerHTML = MESES.map((m) => `
            <section class="cal-mes">
                <header>
                    <h3>${m.mes}</h3>
                    ${m.letivos ? `<span class="cal-letivos">${m.letivos} dias letivos</span>` : ''}
                </header>
                <ul>
                    ${m.eventos.map((e) => {
                        const s = ESTILO[e.tipo];
                        return `
                        <li class="cal-${e.tipo}">
                            <span class="cal-dia">${e.dia}</span>
                            <div>
                                <span class="cal-rotulo"><i class="fas ${s.icone}" aria-hidden="true"></i> ${s.rotulo}</span>
                                <p>${e.texto}</p>
                            </div>
                        </li>`;
                    }).join('')}
                </ul>
            </section>`).join('');
    }

    function ligarFiltros() {
        const filtros = document.getElementById('calFiltros');
        if (!filtros) return;

        filtros.addEventListener('click', (ev) => {
            const btn = ev.target.closest('.cal-filtro');
            if (!btn) return;

            filtros.querySelectorAll('.cal-filtro').forEach((b) => {
                b.classList.toggle('ativo', b === btn);
                b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
            });

            const tipo = btn.dataset.tipo;
            document.querySelectorAll('#calMeses li').forEach((li) => {
                li.hidden = tipo !== 'todos' && !li.classList.contains(`cal-${tipo}`);
            });

            // Esconde o mês que ficou sem nenhum item visível.
            document.querySelectorAll('.cal-mes').forEach((sec) => {
                const visiveis = [...sec.querySelectorAll('li')].some((li) => !li.hidden);
                sec.hidden = !visiveis;
            });
        });
    }

    function iniciar() {
        montarDestaques();
        montarMeses();
        ligarFiltros();

        document.querySelectorAll('[data-pdf]').forEach((a) => {
            a.href = PDF;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

    window.UnimapCalendario = { MESES, PDF, proximos };
})();
