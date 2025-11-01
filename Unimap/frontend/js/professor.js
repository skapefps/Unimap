class ProfessorManager {
    constructor() {
        this.currentUser = null;
        this.minhasAulas = [];
        this.salasDisponiveis = [];
        this.cursos = [];
        this.turmas = [];
        this.cursoChangeHandler = null;
        this.cache = new Map();
        this.init();
    }

    async init() {
        console.log('👨‍🏫 Inicializando ProfessorManager...');

        const userData = localStorage.getItem('userData');
        if (!userData) {
            console.error('❌ Professor não autenticado');
            window.location.href = 'login.html';
            return;
        }

        this.currentUser = JSON.parse(userData);
        console.log('✅ Professor carregado:', this.currentUser);

        await Promise.allSettled([
            this.carregarMinhasAulas(),
            this.carregarSalasDisponiveis(),
            this.carregarCursosDetalhados()
        ]);

        this.configurarEventosFormulario();
        this.desabilitarPeriodo();
        this.desabilitarTurma();
    }

    // 🔥 MÉTODOS DE CARREGAMENTO
    async carregarMinhasAulas() {
        try {
            console.log('📚 Carregando aulas do professor...');

            const rotas = [
                () => api.getMinhasAulasProfessor(),
                () => api.getMinhasAulas()
            ];

            for (const rota of rotas) {
                try {
                    const result = await rota();
                    if (result?.success) {
                        this.minhasAulas = result.data;
                        console.log(`✅ ${this.minhasAulas.length} aulas carregadas`);
                        this.renderizarAulas();
                        return;
                    }
                } catch (error) {
                    console.warn('⚠️ Rota falhou, tentando próxima...');
                }
            }
            throw new Error('Todas as rotas falharam');
        } catch (error) {
            console.error('❌ Erro ao carregar aulas:', error);
            this.mostrarErro('Erro ao carregar aulas. Recarregue a página.');
        }
    }

    async carregarSalasDisponiveis() {
        try {
            console.log('🏫 Carregando salas disponíveis...');
            const result = await api.getSalas();

            if (result?.success) {
                this.salasDisponiveis = result.data;
                console.log(`✅ ${this.salasDisponiveis.length} salas carregadas`);
                this.renderizarSalasSelect();
            } else {
                throw new Error(result?.error);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar salas:', error);
            this.usarSalasPadrao();
        }
    }

    async carregarCursosDetalhados() {
        try {
            console.log('🎓 Carregando cursos detalhados...');
            const result = await api.getCursosDetalhados();

            if (result?.success) {
                this.cursos = result.data;
                console.log(`✅ ${this.cursos.length} cursos carregados`);
                this.popularSelectCursos();
            } else {
                throw new Error(result?.error);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar cursos:', error);
            this.usarCursosPadrao();
        }
    }

    async carregarTurmasPorCursoPeriodo(curso, periodo) {
        try {
            console.log(`📋 Buscando turmas para ${curso} - ${periodo}° período...`);
            
            const cacheKey = `turmas-${curso}-${periodo}`;
            if (this.cache.has(cacheKey)) {
                const turmas = this.cache.get(cacheKey);
                this.popularSelectTurmas(turmas);
                return;
            }

            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/turmas/curso/${encodeURIComponent(curso)}/periodo/${periodo}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const turmas = await response.json();
                this.turmas = turmas;
                this.cache.set(cacheKey, turmas);

                if (turmas.length > 0) {
                    this.popularSelectTurmas(turmas);
                    this.habilitarTurma();
                } else {
                    this.desabilitarTurmaComMensagem('Nenhuma turma disponível para este curso/período');
                }
                console.log(`✅ ${turmas.length} turmas carregadas`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar turmas:', error);
            this.desabilitarTurmaComMensagem('Erro de conexão');
        }
    }

    // 🔥 MÉTODOS DE FALLBACK
    usarSalasPadrao() {
        this.salasDisponiveis = [
            { id: 1, numero: 'A101', bloco: 'A', tipo: 'Sala de Aula', capacidade: 40 },
            { id: 2, numero: 'A102', bloco: 'A', tipo: 'Sala de Aula', capacidade: 35 },
            { id: 3, numero: 'A201', bloco: 'A', tipo: 'Sala de Aula', capacidade: 45 },
            { id: 4, numero: 'A202', bloco: 'A', tipo: 'Sala de Aula', capacidade: 30 },
            { id: 5, numero: 'B101', bloco: 'B', tipo: 'Laboratório', capacidade: 25 },
            { id: 6, numero: 'B102', bloco: 'B', tipo: 'Laboratório', capacidade: 20 }
        ];
        this.renderizarSalasSelect();
        this.mostrarErro('Usando dados de exemplo para salas');
    }

    usarCursosPadrao() {
        this.cursos = [
            { id: 1, nome: 'Sistemas de Informação', total_periodos: 8 },
            { id: 2, nome: 'Administração', total_periodos: 8 },
            { id: 3, nome: 'Direito', total_periodos: 8 }
        ];
        this.popularSelectCursos();
    }

    // 🔥 CONFIGURAÇÃO DE FORMULÁRIO
    configurarEventosFormulario() {
        this.configurarEventoCurso();
        this.configurarEventoPeriodo();
        this.configurarBuscaSalas();
    }

    configurarEventoCurso() {
        const cursoSelect = document.getElementById('cursoSelect');
        if (!cursoSelect) {
            console.error('❌ cursoSelect não encontrado');
            return;
        }

        cursoSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            
            if (selectedOption) {
                const totalPeriodos = selectedOption.getAttribute('data-total-periodos') || 8;
                this.habilitarPeriodo();
                this.popularSelectPeriodos(parseInt(totalPeriodos));
            } else {
                this.desabilitarPeriodo();
                this.desabilitarTurma();
            }
        });

        if (cursoSelect.value) {
            cursoSelect.dispatchEvent(new Event('change'));
        }
    }

    configurarEventoPeriodo() {
        const periodoSelect = document.getElementById('periodoSelect');
        periodoSelect?.addEventListener('change', async (e) => {
            const curso = document.getElementById('cursoSelect').value;
            const periodo = e.target.value;

            if (curso && periodo) {
                await this.carregarTurmasPorCursoPeriodo(curso, periodo);
            } else {
                this.desabilitarTurma();
            }
        });
    }

    configurarBuscaSalas() {
        const searchInput = document.getElementById('searchSala');
        const salaSelect = document.getElementById('salaSelect');

        if (!searchInput || !salaSelect) return;

        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const options = salaSelect.getElementsByTagName('option');
            let foundAny = false;

            for (let i = 0; i < options.length; i++) {
                const text = options[i].textContent.toLowerCase();
                const shouldShow = text.includes(searchTerm);
                options[i].style.display = shouldShow ? '' : 'none';

                if (shouldShow && i > 0) foundAny = true;
                if (i === 0) options[i].style.display = '';
            }

            if (foundAny && searchTerm.length > 0) {
                searchInput.style.borderColor = '#4CAF50';
                searchInput.style.backgroundColor = '#f8fff8';
            } else if (searchTerm.length > 0) {
                searchInput.style.borderColor = '#ff4444';
                searchInput.style.backgroundColor = '#fff8f8';
            } else {
                searchInput.style.borderColor = '#ccc';
                searchInput.style.backgroundColor = '';
            }
        });

        salaSelect.addEventListener('change', function () {
            const selectedOption = this.options[this.selectedIndex];

            if (this.value && selectedOption) {
                this.style.borderColor = '#4CAF50';
                this.style.backgroundColor = '#f8fff8';
                this.style.fontWeight = '600';
                this.setAttribute('data-selected-text', selectedOption.textContent);

                searchInput.value = selectedOption.textContent;
                searchInput.style.borderColor = '#4CAF50';
                searchInput.style.backgroundColor = '#f8fff8';
            } else {
                this.style.borderColor = '#ccc';
                this.style.backgroundColor = '';
                this.style.fontWeight = 'normal';
                this.removeAttribute('data-selected-text');

                searchInput.style.borderColor = '#ccc';
                searchInput.style.backgroundColor = '';
            }
        });

        searchInput.addEventListener('focus', function () {
            this.select();
        });

        salaSelect.addEventListener('dblclick', function () {
            this.selectedIndex = 0;
            this.dispatchEvent(new Event('change'));
            searchInput.value = '';
            searchInput.focus();
        });

        this.adicionarEstiloSalaSelecionada();
    }

    // 🔥 MÉTODOS DE UI
    habilitarPeriodo() {
        const periodoSelect = document.getElementById('periodoSelect');
        if (!periodoSelect) return;

        periodoSelect.disabled = false;
        periodoSelect.classList.remove('select-desabilitado');
        periodoSelect.classList.add('select-habilitado');
        periodoSelect.style.opacity = '1';
        periodoSelect.style.cursor = 'pointer';
        periodoSelect.style.backgroundColor = '';
    }

    desabilitarPeriodo() {
        const periodoSelect = document.getElementById('periodoSelect');
        if (!periodoSelect) return;

        periodoSelect.disabled = true;
        periodoSelect.innerHTML = '<option value="">Primeiro selecione o curso</option>';
        periodoSelect.classList.add('select-desabilitado');
        periodoSelect.classList.remove('select-habilitado');
        periodoSelect.style.opacity = '0.7';
        periodoSelect.style.cursor = 'not-allowed';
        periodoSelect.style.backgroundColor = '#f9f9f9';
    }

    habilitarTurma() {
        const turmaSelect = document.getElementById('turmaSelect');
        if (turmaSelect) {
            turmaSelect.disabled = false;
            turmaSelect.style.opacity = '1';
            turmaSelect.style.cursor = 'pointer';
            turmaSelect.style.backgroundColor = '';
            turmaSelect.classList.remove('select-desabilitado');
            turmaSelect.classList.add('select-habilitado');
        }
    }

    desabilitarTurma() {
        const turmaSelect = document.getElementById('turmaSelect');
        if (turmaSelect) {
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = '<option value="">Primeiro selecione o curso e período</option>';
            turmaSelect.style.opacity = '0.7';
            turmaSelect.style.cursor = 'not-allowed';
            turmaSelect.style.backgroundColor = '#f9f9f9';
            turmaSelect.classList.add('select-desabilitado');
            turmaSelect.classList.remove('select-habilitado');
        }
    }

    desabilitarTurmaComMensagem(mensagem) {
        const turmaSelect = document.getElementById('turmaSelect');
        if (turmaSelect) {
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = `<option value="">${mensagem}</option>`;
            turmaSelect.style.opacity = '0.6';
            turmaSelect.style.cursor = 'not-allowed';
            turmaSelect.style.backgroundColor = '#fff8f8';
        }
    }

    // 🔥 POPULAR SELECTS
    popularSelectCursos() {
        const select = document.getElementById('cursoSelect');
        if (!select || !this.cursos) return;

        select.innerHTML = '<option value="">Selecione o curso</option>' +
            this.cursos.map(curso =>
                `<option value="${curso.nome}" data-total-periodos="${curso.total_periodos || 8}">
                    ${curso.nome} (${curso.total_periodos || 8} períodos)
                </option>`
            ).join('');

        console.log('✅ Select de cursos populado com períodos');
    }

    popularSelectPeriodos(totalPeriodos) {
        const periodoSelect = document.getElementById('periodoSelect');
        if (!periodoSelect) return;

        this.habilitarPeriodo();
        periodoSelect.innerHTML = '';

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Selecione o período';
        periodoSelect.appendChild(placeholderOption);

        for (let i = 1; i <= totalPeriodos; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}° Período`;
            periodoSelect.appendChild(option);
        }

        console.log(`✅ ${totalPeriodos} períodos adicionados ao select`);
    }

    popularSelectTurmas(turmas) {
        const turmaSelect = document.getElementById('turmaSelect');
        if (!turmaSelect) return;

        turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';

        turmas.forEach(turma => {
            const option = document.createElement('option');
            option.value = turma.nome;
            option.textContent = turma.nome;
            turmaSelect.appendChild(option);
        });

        if (turmas.length > 0) {
            this.habilitarTurma();
        }
    }

    renderizarSalasSelect() {
        const select = document.getElementById('salaSelect');
        if (!select || !this.salasDisponiveis) return;

        select.innerHTML = '<option value="">Selecione a sala</option>' +
            this.salasDisponiveis.map(sala =>
                `<option value="${sala.id}" data-bloco="${sala.bloco}" data-tipo="${sala.tipo}">
                    ${sala.numero} - Bloco ${sala.bloco} (${sala.tipo}) - ${sala.capacidade} lugares
                </option>`
            ).join('');
    }

    // 🔥 RENDERIZAÇÃO DE AULAS
    renderizarAulas() {
        const container = document.getElementById('aulas-professor-grid');
        if (!container) return;

        if (this.minhasAulas.length === 0) {
            container.innerHTML = this.getHTMLAulasVazias();
            return;
        }

        // Usar batelamento para melhor performance com muitas aulas
        const batchSize = 10;
        const renderBatch = (startIndex = 0) => {
            const endIndex = Math.min(startIndex + batchSize, this.minhasAulas.length);
            const fragment = document.createDocumentFragment();

            for (let i = startIndex; i < endIndex; i++) {
                const card = this.criarCardAula(this.minhasAulas[i]);
                fragment.appendChild(this.htmlToElement(card));
            }

            container.appendChild(fragment);

            if (endIndex < this.minhasAulas.length) {
                setTimeout(() => renderBatch(endIndex), 0);
            }
        };

        container.innerHTML = '';
        renderBatch();
    }

    criarCardAula(aula) {
        const status = this.getStatusAula(aula);
        const dias = this.formatarDiasSemana(aula.dia_semana);

        return `
            <div class="professor-aula-card" data-aula-id="${aula.id}">
                <div class="professor-aula-header">
                    <h3>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h3>
                    <span class="professor-status-badge ${status.classe}">
                        <i class="fas ${status.icone}"></i> ${status.texto}
                    </span>
                </div>
                <div class="professor-aula-info">
                    <div class="professor-info-item">
                        <span class="professor-icon"><i class="fas fa-clock"></i></span>
                        <span>${aula.horario_inicio} - ${aula.horario_fim} | ${dias}</span>
                    </div>
                    <div class="professor-info-item">
                        <span class="professor-icon"><i class="fas fa-door-open"></i></span>
                        <span>Sala ${aula.sala_numero} - Bloco ${aula.sala_bloco}</span>
                    </div>
                    <div class="professor-info-item">
                        <span class="professor-icon"><i class="fas fa-users"></i></span>
                        <span>Turma: ${aula.turma || 'N/A'} | Curso: ${aula.curso || 'N/A'}</span>
                    </div>
                </div>
                <div class="professor-aula-actions">
                    <button class="professor-btn-action" onclick="professorManager.verDetalhesAula(${aula.id})">
                        <i class="fas fa-info-circle"></i> Detalhes
                    </button>
                    <button class="professor-btn-action secundario" onclick="professorManager.abrirMapaSala('${aula.sala_bloco}', ${aula.sala_andar || 1}, '${aula.sala_numero}')">
                        <i class="fas fa-map-marker-alt"></i> Localizar
                    </button>
                    <button class="professor-btn-action perigo" onclick="professorManager.excluirAula(${aula.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }

    // 🔥 GESTÃO DE AULAS
    async criarAula(dadosAula, diasSelecionados) {
        try {
            console.log('📝 Validando e criando nova aula:', dadosAula);
            console.log('📅 Dias recebidos:', diasSelecionados);

            const erros = this.validarFormularioAula(dadosAula);
            if (erros.length > 0) {
                this.mostrarErro('Erros no formulário:\n' + erros.join('\n'));
                return;
            }

            const diaParaNumero = {
                'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5
            };

            const aulasCriadas = [];
            const promises = diasSelecionados.map(async (diaString) => {
                const dadosFormatados = {
                    disciplina: dadosAula.disciplina,
                    sala_id: parseInt(dadosAula.sala_id),
                    curso: dadosAula.curso,
                    turma: dadosAula.turma,
                    horario_inicio: dadosAula.horario_inicio,
                    horario_fim: dadosAula.horario_fim,
                    dia_semana: diaParaNumero[diaString]
                };

                console.log(`📤 Enviando aula para ${diaString}:`, dadosFormatados);
                const result = await api.criarAula(dadosFormatados);

                if (result?.success) {
                    console.log(`✅ Aula criada para ${diaString}`);
                    aulasCriadas.push({ dia: diaString, id: result.id });
                } else {
                    const mensagemErro = result?.error || 'Erro desconhecido ao criar aula';
                    console.error(`❌ Erro para ${diaString}:`, mensagemErro);
                    throw new Error(`Erro para ${diaString}: ${mensagemErro}`);
                }
            });

            await Promise.all(promises);
            console.log(`✅ ${aulasCriadas.length} aulas criadas com sucesso!`);
            this.mostrarSucesso(`Aulas criadas com sucesso para ${aulasCriadas.length} dias!`);

            await this.carregarMinhasAulas();
            showSection('minhas-aulas-professor');
            document.getElementById('formCriarAula')?.reset();
            this.cache.clear(); // Limpar cache após mudanças

        } catch (error) {
            console.error('❌ Erro ao criar aula:', error);
            this.mostrarErro(this.tratarErroAula(error));
        }
    }

    async excluirAula(aulaId) {
        if (!confirm('Tem certeza que deseja excluir esta aula?')) {
            return;
        }

        try {
            console.log('🗑️ Excluindo aula:', aulaId);
            const result = await api.excluirAula(aulaId);

            if (result?.success) {
                console.log('✅ Aula excluída com sucesso!');
                this.mostrarSucesso('Aula excluída com sucesso!');
                await this.carregarMinhasAulas();
                this.cache.clear();
            } else {
                throw new Error(result?.error || 'Erro ao excluir aula');
            }
        } catch (error) {
            console.error('❌ Erro ao excluir aula:', error);
            this.mostrarErro('Erro ao excluir aula: ' + error.message);
        }
    }

    // 🔥 VALIDAÇÃO
    validarFormularioAula(dados) {
        const erros = [];

        if (!dados.disciplina || dados.disciplina.trim().length < 3) {
            erros.push('Disciplina deve ter pelo menos 3 caracteres');
        }

        if (!dados.sala_id) {
            erros.push('Selecione uma sala');
        }

        if (!dados.curso) {
            erros.push('Selecione um curso');
        }

        if (!dados.turma) {
            erros.push('Selecione uma turma');
        }

        if (!dados.horario_inicio || !dados.horario_fim) {
            erros.push('Selecione um horário');
        }

        const diasSelecionados = Array.from(document.querySelectorAll('input[name="dias"]:checked'));
        if (diasSelecionados.length === 0) {
            erros.push('Selecione pelo menos um dia da semana');
        }

        return erros;
    }

    tratarErroAula(error) {
        const mensagens = {
            'Professor não encontrado': 'Seu perfil de professor não foi encontrado. Entre em contato com a administração.',
            'UNIQUE constraint failed': 'Já existe uma aula com esses dados. Verifique os horários e salas.',
            'FOREIGN KEY constraint failed': 'Sala ou curso inválido. Verifique os dados selecionados.',
            'NOT NULL constraint failed': 'Erro nos dados da aula. Verifique se todos os campos estão preenchidos corretamente.'
        };

        for (const [chave, mensagem] of Object.entries(mensagens)) {
            if (error.message.includes(chave)) return mensagem;
        }

        return 'Erro ao criar aula: ' + error.message;
    }

    // 🔥 MÉTODOS AUXILIARES
    getStatusAula(aula) {
        // Lógica para determinar status da aula
        const agora = new Date();
        const hoje = agora.getDay();
        const horaAtual = agora.getHours() + agora.getMinutes() / 60;

        // Mapear dia da semana (0=Domingo, 1=Segunda, etc.)
        const diaSemanaMap = { 'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5 };
        const diaAula = diaSemanaMap[aula.dia_semana];

        if (diaAula === hoje) {
            const [horaInicio, minutoInicio] = aula.horario_inicio.split(':').map(Number);
            const [horaFim, minutoFim] = aula.horario_fim.split(':').map(Number);
            const horaInicioDecimal = horaInicio + minutoInicio / 60;
            const horaFimDecimal = horaFim + minutoFim / 60;

            if (horaAtual >= horaInicioDecimal && horaAtual <= horaFimDecimal) {
                return { classe: 'em-andamento', texto: 'Em Andamento', icone: 'fa-play-circle' };
            } else if (horaAtual < horaInicioDecimal) {
                return { classe: 'agendada', texto: 'Agendada', icone: 'fa-clock' };
            } else {
                return { classe: 'concluida', texto: 'Concluída', icone: 'fa-check-circle' };
            }
        }

        return { classe: 'ativa', texto: 'Ativa', icone: 'fa-check-circle' };
    }

    formatarDiasSemana(diaSemana) {
        const diasMap = {
            'segunda': 'Segunda',
            'terca': 'Terça', 
            'quarta': 'Quarta',
            'quinta': 'Quinta',
            'sexta': 'Sexta',
            1: 'Segunda',
            2: 'Terça',
            3: 'Quarta', 
            4: 'Quinta',
            5: 'Sexta'
        };
        return diasMap[diaSemana] || diaSemana;
    }

    // 🔥 MÉTODOS DE VISUALIZAÇÃO
    verDetalhesAula(aulaId) {
        console.log('📖 Ver detalhes da aula:', aulaId);
        const aula = this.minhasAulas.find(a => a.id === aulaId);
        if (aula) {
            this.mostrarModalDetalhesAula(aula);
        }
    }

    mostrarModalDetalhesAula(aula) {
        const modalHTML = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="aula-detalhes">
                            <p><strong>Curso:</strong> ${aula.curso || 'N/A'}</p>
                            <p><strong>Turma:</strong> ${aula.turma || 'N/A'}</p>
                            <p><strong>Horário:</strong> ${aula.horario_inicio} - ${aula.horario_fim}</p>
                            <p><strong>Dias:</strong> ${this.formatarDiasSemana(aula.dia_semana)}</p>
                            <p><strong>Sala:</strong> ${aula.sala_numero} - Bloco ${aula.sala_bloco}</p>
                            <p><strong>Status:</strong> ${aula.ativa ? 'Ativa' : 'Inativa'}</p>
                            ${aula.descricao ? `<p><strong>Descrição:</strong> ${aula.descricao}</p>` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
                    </div>
                </div>
            </div>
        `;

        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    abrirMapaSala(bloco, andar, sala) {
        console.log('🗺️ Abrindo mapa para:', bloco, andar, sala);
        showSection('mapa-blocos');

        setTimeout(() => {
            if (window.mapaManager) {
                window.mapaManager.mostrarSalas(bloco, andar);
            }
        }, 300);
    }

    // 🔥 UTILITÁRIOS
    htmlToElement(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
    }

    getHTMLAulasVazias() {
        return `
            <div class="professor-empty-state">
                <i class="fas fa-chalkboard-teacher fa-3x"></i>
                <p>Nenhuma aula encontrada</p>
                <p class="empty-subtitle">Crie sua primeira aula usando o botão acima</p>
            </div>
        `;
    }

    adicionarEstiloSalaSelecionada() {
        if (document.getElementById('professor-sala-styles')) return;

        const style = document.createElement('style');
        style.id = 'professor-sala-styles';
        style.textContent = `
            .professor-sala-select option:checked {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                font-weight: bold;
            }
            
            .professor-sala-select option:hover {
                background-color: #e8f5e8 !important;
            }
            
            .sala-selecionada-indicator {
                display: inline-block;
                margin-left: 10px;
                padding: 2px 8px;
                background: #4CAF50;
                color: white;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 600;
            }

            .select-desabilitado {
                opacity: 0.7;
                cursor: not-allowed;
                background-color: #f9f9f9;
            }

            .select-habilitado {
                opacity: 1;
                cursor: pointer;
                background-color: white;
            }
        `;
        document.head.appendChild(style);
    }

    obterSiglaCurso(cursoNome) {
        const siglas = {
            'Sistemas de Informação': 'SI',
            'Administração': 'ADM',
            'Direito': 'DIR',
            'Engenharia Civil': 'EC',
            'Medicina': 'MED',
            'Psicologia': 'PSI',
            'Enfermagem': 'ENF',
            'Educação Física': 'EDF',
            'Ciências Contábeis': 'CC',
            'Arquitetura e Urbanismo': 'ARQ'
        };
        return siglas[cursoNome] || 'TUR';
    }

    // 🔥 NOTIFICAÇÕES
    mostrarSucesso(mensagem) {
        if (window.showNotification) {
            showNotification(mensagem, 'success');
        } else {
            alert('✅ ' + mensagem);
        }
    }

    mostrarErro(mensagem) {
        if (window.showNotification) {
            showNotification(mensagem, 'error');
        } else {
            alert('❌ ' + mensagem);
        }
    }

    // 🔥 DEBUG
    async debugAulas() {
        try {
            console.log('🔍 DEBUG: Verificando aulas no banco...');

            const token = localStorage.getItem('authToken');
            const userData = JSON.parse(localStorage.getItem('userData'));

            const response = await fetch('/api/debug/aulas-professor', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📊 DEBUG - Aulas no banco:', data);
                alert(`DEBUG: ${data.aulas.length} aulas encontradas para ${userData.email}`);
            }
        } catch (error) {
            console.error('❌ Erro no debug:', error);
        }
    }

    debugCriarAula() {
        console.log('🔧 DEBUG: Testando criarAula manualmente...');

        const dadosTeste = {
            disciplina: 'Teste Debug',
            sala_id: 1,
            curso: 'Sistemas de Informação',
            turma: 'SI1N',
            horario_inicio: '18:50',
            horario_fim: '19:40',
            dia_semana: 1
        };

        console.log('📝 Dados de teste:', dadosTeste);
        this.criarAula(dadosTeste, ['segunda']);
    }

    // 🔥 LIMPEZA
    destruir() {
        this.cache.clear();
        document.removeEventListener('keydown', this.keyHandler);
        console.log('🧹 ProfessorManager destruído');
    }
}

// ✅ INSTÂNCIA GLOBAL
const professorManager = new ProfessorManager();

// Debug global
window.debugProfessor = professorManager;
window.professorManager = professorManager;

console.log('👨‍🏫 professorManager global carregado:', {
    criarAula: typeof professorManager.criarAula,
    carregarMinhasAulas: typeof professorManager.carregarMinhasAulas,
    excluirAula: typeof professorManager.excluirAula
});