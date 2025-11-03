class ProfessorManager {
    constructor() {
        this.currentUser = null;
        this.minhasAulas = [];
        this.salasDisponiveis = [];
        this.cursos = [];
        this.turmas = [];
        this.cache = new Map();
        this.init();
    }

    // ========== INICIALIZAÇÃO ==========
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

        await this.carregarDadosIniciais();
        this.configurarInterface();
    }

    async carregarDadosIniciais() {
        const carregamentos = [
            this.carregarMinhasAulas(),
            this.carregarSalasDisponiveis(),
            this.carregarCursosDetalhados()
        ];

        for (const carregamento of carregamentos) {
            try {
                await carregamento;
            } catch (error) {
                console.error('❌ Erro no carregamento:', error);
            }
        }
    }

    configurarInterface() {
        this.configurarEventosFormulario();
        this.desabilitarPeriodo();
        this.desabilitarTurma();
    }

    // ========== CARREGAMENTO DE DADOS ==========
    async carregarMinhasAulas() {
        try {
            console.log('📚 Carregando aulas do professor...');
            const result = await api.getMinhasAulasProfessor();

            if (result?.success) {
                this.minhasAulas = this.processarDadosAulas(result.data);
                console.log(`✅ ${this.minhasAulas.length} aulas carregadas`);
                this.renderizarAulas();
            } else {
                throw new Error(result?.error || 'Erro ao carregar aulas');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar aulas:', error);
            this.minhasAulas = [];
            this.renderizarAulas();
        }
    }

    processarDadosAulas(dados) {
        console.log('📊 Processando dados das aulas:', dados);

        // 🔥 CORREÇÃO: Lidar com diferentes formatos de resposta
        if (Array.isArray(dados)) {
            return dados;
        }

        if (dados && typeof dados === 'object') {
            // Se for objeto com propriedade data (formato {success: true, data: [...]})
            if (dados.data && Array.isArray(dados.data)) {
                return dados.data;
            }

            // Se for objeto com outras propriedades de array
            const arrays = Object.values(dados).filter(val => Array.isArray(val));
            return arrays.length > 0 ? arrays[0] : [];
        }

        console.warn('⚠️ Formato de dados não reconhecido, retornando array vazio');
        return [];
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
                this.popularSelectTurmas(this.cache.get(cacheKey));
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
                    this.desabilitarTurmaComMensagem('Nenhuma turma disponível');
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar turmas:', error);
            this.desabilitarTurmaComMensagem('Erro de conexão');
        }
    }

    // ========== FALLBACKS ==========
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
    }

    usarCursosPadrao() {
        this.cursos = [
            { id: 1, nome: 'Sistemas de Informação', total_periodos: 8 },
            { id: 2, nome: 'Administração', total_periodos: 8 },
            { id: 3, nome: 'Direito', total_periodos: 8 }
        ];
        this.popularSelectCursos();
    }

    // ========== CONFIGURAÇÃO DE EVENTOS ==========
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

        searchInput.addEventListener('input', () => this.filtrarSalas(searchInput, salaSelect));
        salaSelect.addEventListener('change', () => this.atualizarBuscaSala(searchInput, salaSelect));
        searchInput.addEventListener('focus', () => searchInput.select());
        salaSelect.addEventListener('dblclick', () => this.limparSelecaoSala(searchInput, salaSelect));

        this.adicionarEstiloSalaSelecionada();
    }

    filtrarSalas(searchInput, salaSelect) {
        const searchTerm = searchInput.value.toLowerCase();
        const options = salaSelect.getElementsByTagName('option');
        let foundAny = false;

        for (let i = 0; i < options.length; i++) {
            const text = options[i].textContent.toLowerCase();
            const shouldShow = text.includes(searchTerm);
            options[i].style.display = shouldShow ? '' : 'none';

            if (shouldShow && i > 0) foundAny = true;
            if (i === 0) options[i].style.display = '';
        }

        this.aplicarEstiloFiltro(searchInput, foundAny);
    }

    aplicarEstiloFiltro(searchInput, foundAny) {
        if (foundAny && searchInput.value.length > 0) {
            searchInput.style.borderColor = '#4CAF50';
            searchInput.style.backgroundColor = '#f8fff8';
        } else if (searchInput.value.length > 0) {
            searchInput.style.borderColor = '#ff4444';
            searchInput.style.backgroundColor = '#fff8f8';
        } else {
            searchInput.style.borderColor = '#ccc';
            searchInput.style.backgroundColor = '';
        }
    }

    atualizarBuscaSala(searchInput, salaSelect) {
        const selectedOption = salaSelect.options[salaSelect.selectedIndex];

        if (salaSelect.value && selectedOption) {
            salaSelect.style.borderColor = '#4CAF50';
            salaSelect.style.backgroundColor = '#f8fff8';
            salaSelect.style.fontWeight = '600';
            salaSelect.setAttribute('data-selected-text', selectedOption.textContent);

            searchInput.value = selectedOption.textContent;
            searchInput.style.borderColor = '#4CAF50';
            searchInput.style.backgroundColor = '#f8fff8';
        } else {
            this.limparEstiloSala(searchInput, salaSelect);
        }
    }

    limparSelecaoSala(searchInput, salaSelect) {
        salaSelect.selectedIndex = 0;
        salaSelect.dispatchEvent(new Event('change'));
        searchInput.value = '';
        searchInput.focus();
    }

    limparEstiloSala(searchInput, salaSelect) {
        salaSelect.style.borderColor = '#ccc';
        salaSelect.style.backgroundColor = '';
        salaSelect.style.fontWeight = 'normal';
        salaSelect.removeAttribute('data-selected-text');

        searchInput.style.borderColor = '#ccc';
        searchInput.style.backgroundColor = '';
    }

    // ========== CONTROLE DE INTERFACE ==========
    habilitarPeriodo() {
        this.toggleElemento('periodoSelect', true);
    }

    desabilitarPeriodo() {
        const periodoSelect = document.getElementById('periodoSelect');
        if (!periodoSelect) return;

        periodoSelect.disabled = true;
        periodoSelect.innerHTML = '<option value="">Primeiro selecione o curso</option>';
        this.toggleElemento('periodoSelect', false);
    }

    habilitarTurma() {
        this.toggleElemento('turmaSelect', true);
    }

    desabilitarTurma() {
        const turmaSelect = document.getElementById('turmaSelect');
        if (turmaSelect) {
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = '<option value="">Primeiro selecione o curso e período</option>';
            this.toggleElemento('turmaSelect', false);
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

    toggleElemento(elementId, habilitar) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (habilitar) {
            element.disabled = false;
            element.classList.remove('select-desabilitado');
            element.classList.add('select-habilitado');
            element.style.opacity = '1';
            element.style.cursor = 'pointer';
            element.style.backgroundColor = '';
        } else {
            element.disabled = true;
            element.classList.add('select-desabilitado');
            element.classList.remove('select-habilitado');
            element.style.opacity = '0.7';
            element.style.cursor = 'not-allowed';
            element.style.backgroundColor = '#f9f9f9';
        }
    }

    // ========== POPULAÇÃO DE SELECTS ==========
    popularSelectCursos() {
        const select = document.getElementById('cursoSelect');
        if (!select || !this.cursos) return;

        select.innerHTML = '<option value="">Selecione o curso</option>' +
            this.cursos.map(curso =>
                `<option value="${curso.nome}" data-total-periodos="${curso.total_periodos || 8}">
                    ${curso.nome} (${curso.total_periodos || 8} períodos)
                </option>`
            ).join('');
    }

    popularSelectPeriodos(totalPeriodos) {
        const periodoSelect = document.getElementById('periodoSelect');
        if (!periodoSelect) return;

        this.habilitarPeriodo();
        periodoSelect.innerHTML = '<option value="">Selecione o período</option>';

        for (let i = 1; i <= totalPeriodos; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}° Período`;
            periodoSelect.appendChild(option);
        }
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

    // ========== GESTÃO DE AULAS ==========
    renderizarAulas() {
        const container = document.getElementById('aulas-professor-grid');
        if (!container) return;

        if (this.minhasAulas.length === 0) {
            container.innerHTML = this.getHTMLAulasVazias();
            return;
        }

        container.innerHTML = '';
        this.minhasAulas.forEach(aula => {
            const card = this.criarCardAula(aula);
            container.appendChild(this.htmlToElement(card));
        });
    }

    criarCardAula(aula) {
        const status = this.getStatusAula(aula);
        const dia = this.formatarDiasSemana(aula.dia_semana);
        const isCancelada = aula.ativa === 0 || aula.ativa === false || aula.status === 'cancelada';

        return `
    <div class="professor-aula-card ${isCancelada ? 'aula-cancelada' : ''}" 
         data-aula-id="${aula.id}" 
         onclick="professorManager.verDetalhesAula(${aula.id})">
        
        <div class="professor-aula-card-content">
            <div class="professor-aula-header">
                <h3>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h3>
                <span class="professor-status-badge ${status.classe}">
                    <i class="fas ${status.icone}"></i> 
                    ${status.texto}
                </span>
            </div>
            <div class="professor-aula-info">
                <div class="professor-info-item">
                    <span class="professor-icon"><i class="fas fa-clock"></i></span>
                    <span>${aula.horario_inicio} - ${aula.horario_fim} | ${dia}</span>
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
        </div>
        
        <div class="professor-aula-actions" onclick="event.stopPropagation()">
            ${!isCancelada ? this.getBotoesAulaAtiva(aula) : this.getBotoesAulaCancelada(aula)}
        </div>
    </div>`;
    }

    getBotoesAulaAtiva(aula) {
        return `
            <button class="professor-btn-action editar" onclick="professorManager.editarAula(${aula.id})">
                <i class="fas fa-edit"></i><span>Editar</span>
            </button>
            <button class="professor-btn-action secundario" onclick="professorManager.abrirMapaSala('${aula.sala_bloco}', ${aula.sala_andar || 1}, '${aula.sala_numero}')">
                <i class="fas fa-map-marker-alt"></i><span>Localizar</span>
            </button>
            <button class="professor-btn-action cancelar" onclick="professorManager.cancelarAula(${aula.id})">
                <i class="fas fa-ban"></i><span>Cancelar</span>
            </button>
            <button class="professor-btn-action perigo" onclick="professorManager.excluirAula(${aula.id})">
                <i class="fas fa-trash"></i><span>Excluir</span>
            </button>`;
    }

    getBotoesAulaCancelada(aula) {
        return `
            <button class="professor-btn-action reativar" onclick="professorManager.reativarAula(${aula.id})">
                <i class="fas fa-undo"></i><span>Reativar</span>
            </button>
            <button class="professor-btn-action perigo" onclick="professorManager.excluirAula(${aula.id})">
                <i class="fas fa-trash"></i><span>Excluir</span>
            </button>`;
    }

    // ========== OPERAÇÕES DE AULA ==========
    async criarAula(dadosAula, diasSelecionados) {
        const requestKey = `criar-aula-${JSON.stringify(dadosAula)}-${diasSelecionados.join(',')}`;

        if (this.pendingRequest === requestKey) {
            console.log('⚠️ Requisição duplicada detectada, ignorando...');
            return;
        }

        this.pendingRequest = requestKey;

        try {
            console.log('📝 Criando aulas para múltiplos dias:', dadosAula, 'Dias:', diasSelecionados);

            const erros = this.validarFormularioAula(dadosAula);
            if (erros.length > 0) {
                this.mostrarErro('Erros no formulário:\n' + erros.join('\n'));
                this.pendingRequest = null;
                return;
            }

            // 🔥 CORREÇÃO: Enviar todos os dias como array
            const dadosFormatados = {
                disciplina: dadosAula.disciplina,
                sala_id: parseInt(dadosAula.sala_id),
                curso: dadosAula.curso,
                turma: dadosAula.turma,
                horario_inicio: dadosAula.horario_inicio,
                horario_fim: dadosAula.horario_fim,
                dia_semana: diasSelecionados // 🔥 Envia array de dias
            };

            console.log('🚀 Enviando dados para API (criar múltiplas aulas):', dadosFormatados);

            const result = await api.criarAula(dadosFormatados);

            if (result?.success) {
                // 🔥 CORREÇÃO: Mensagem específica para múltiplas aulas
                let mensagemSucesso = '';
                if (result.aulasCriadas && result.aulasCriadas.length > 0) {
                    const diasCriados = result.aulasCriadas.map(aula =>
                        this.formatarDiaSemana(aula.dia_semana)
                    ).join(', ');

                    mensagemSucesso = `${result.aulasCriadas.length} aula(s) criada(s) com sucesso para: ${diasCriados}`;

                    if (result.aulasDuplicadas && result.aulasDuplicadas.length > 0) {
                        mensagemSucesso += ` (${result.aulasDuplicadas.length} aula(s) já existiam)`;
                    }
                } else {
                    mensagemSucesso = result.message || 'Aulas criadas com sucesso!';
                }

                this.mostrarSucesso(mensagemSucesso);

                // Recarregar as aulas para mostrar os novos cards
                await this.carregarMinhasAulas();
                this.limparFormulario();
                this.cache.clear();

                // Redirecionar para a lista de aulas
                setTimeout(() => {
                    showSection('minhas-aulas-professor');
                }, 2000); // 🔥 Aumentei o tempo para ver a mensagem
            } else {
                throw new Error(result?.error || 'Erro desconhecido ao criar aulas');
            }
        } catch (error) {
            console.error('❌ Erro ao criar aulas:', error);
            this.mostrarErro(this.tratarErroAula(error));
        } finally {
            this.pendingRequest = null;
        }
    }

    // 🔥 ADICIONE este método auxiliar para formatar o dia
    formatarDiaSemana(diaNumero) {
        const diasMap = {
            1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta',
            'segunda': 'Segunda', 'terca': 'Terça', 'quarta': 'Quarta',
            'quinta': 'Quinta', 'sexta': 'Sexta'
        };
        return diasMap[diaNumero] || diaNumero;
    }

    // 🔥 ADICIONE este método auxiliar:
    diaParaNumero(dia) {
        const diasMap = {
            'segunda': 1,
            'terca': 2,
            'quarta': 3,
            'quinta': 4,
            'sexta': 5
        };
        return diasMap[dia] || 1;
    }

    // 🔥 ADICIONE esta função para limpar o formulário corretamente
    limparFormulario() {
        const form = document.getElementById('formCriarAula');
        if (form) {
            form.reset();

            // Limpar seleção de dias
            document.querySelectorAll('input[name="dias"]').forEach(checkbox => {
                checkbox.checked = false;
            });

            // Resetar selects dependentes
            this.desabilitarPeriodo();
            this.desabilitarTurma();
        }

        console.log('✅ Formulário limpo');
    }

    async editarAula(aulaId) {
        try {
            console.log('✏️ Editando aula:', aulaId);
            const aula = this.minhasAulas.find(a => a.id === aulaId);

            if (!aula) {
                throw new Error('Aula não encontrada');
            }

            this.mostrarModalEdicaoAula(aula);
        } catch (error) {
            console.error('❌ Erro ao editar aula:', error);
            this.mostrarErro('Erro ao carregar dados da aula: ' + error.message);
        }
    }

    async cancelarAula(aulaId) {
        if (!confirm('Tem certeza que deseja cancelar esta aula? Os alunos serão notificados.')) return;

        try {
            this.mostrarLoadingBotao(aulaId, 'cancelar');
            const result = await api.cancelarAula(aulaId);

            if (result?.success) {
                this.mostrarSucesso('Aula cancelada com sucesso!');
                await this.carregarMinhasAulas();
                this.cache.clear();
            } else {
                throw new Error(result?.error || 'Erro ao cancelar aula');
            }
        } catch (error) {
            console.error('❌ Erro ao cancelar aula:', error);
            this.mostrarErro('Erro ao cancelar aula: ' + error.message);
            this.removerLoadingBotao(aulaId);
        }
    }

    async reativarAula(aulaId) {
        if (!confirm('Tem certeza que deseja reativar esta aula?')) return;

        try {
            this.mostrarLoadingBotao(aulaId, 'reativar');
            const result = await api.reativarAula(aulaId);

            if (result?.success) {
                this.mostrarSucesso('Aula reativada com sucesso!');
                await this.carregarMinhasAulas();
                this.cache.clear();
            } else {
                throw new Error(result?.error || 'Erro ao reativar aula');
            }
        } catch (error) {
            console.error('❌ Erro ao reativar aula:', error);
            this.mostrarErro('Erro ao reativar aula: ' + error.message);
            this.removerLoadingBotao(aulaId);
        }
    }

    async excluirAula(aulaId) {
        if (!confirm('Tem certeza que deseja excluir esta aula?')) return;

        try {
            const result = await api.excluirAula(aulaId);

            if (result?.success) {
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

    // ========== MODAIS ==========
    mostrarModalEdicaoAula(aula) {
        const modalHTML = this.gerarHTMLModalEdicao(aula);
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.inicializarModalEdicao(aula);
    }

    verDetalhesAula(aulaId) {
        console.log('📖 Ver detalhes da aula:', aulaId);
        const aula = this.minhasAulas.find(a => a.id === aulaId);
        if (aula) {
            this.mostrarModalDetalhesAula(aula);
        } else {
            console.error('❌ Aula não encontrada para ID:', aulaId);
            this.mostrarErro('Aula não encontrada');
        }
    }

    mostrarModalDetalhesAula(aula) {
        const status = this.getStatusAula(aula);
        const dia = this.formatarDiasSemana(aula.dia_semana);
        const isCancelada = aula.ativa === 0 || aula.ativa === false || aula.status === 'cancelada';

        // 🔥 CORREÇÃO: Modal simplificado e mais robusto
        const modalHTML = `
    <div class="modal-overlay" id="modalDetalhesAula">
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3><i class="fas fa-info-circle"></i> Detalhes da Aula</h3>
                <button class="modal-close" onclick="fecharModalDetalhes()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="aula-detalhes-grid">
                    <div class="detalhe-item">
                        <label><i class="fas fa-book"></i> Disciplina:</label>
                        <span>${this.escapeHtml(aula.disciplina || aula.disciplina_nome || 'N/A')}</span>
                    </div>
                    <div class="detalhe-item">
                        <label><i class="fas fa-graduation-cap"></i> Curso:</label>
                        <span>${this.escapeHtml(aula.curso || 'N/A')}</span>
                    </div>
                    <div class="detalhe-item">
                        <label><i class="fas fa-users"></i> Turma:</label>
                        <span>${this.escapeHtml(aula.turma || 'N/A')}</span>
                    </div>
                    <div class="detalhe-item">
                        <label><i class="fas fa-door-open"></i> Sala:</label>
                        <span>Sala ${this.escapeHtml(aula.sala_numero || 'N/A')} - Bloco ${this.escapeHtml(aula.sala_bloco || 'N/A')}</span>
                    </div>
                    <div class="detalhe-item">
                        <label><i class="fas fa-clock"></i> Horário:</label>
                        <span>${aula.horario_inicio || 'N/A'} - ${aula.horario_fim || 'N/A'}</span>
                    </div>
                    <div class="detalhe-item">
                        <label><i class="fas fa-calendar-day"></i> Dia:</label>
                        <span>${this.escapeHtml(dia)}</span>
                    </div>
                    <div class="detalhe-item">
                        <label><i class="fas fa-info-circle"></i> Status:</label>
                        <span class="status-badge ${isCancelada ? 'cancelada' : status.classe}">
                            <i class="fas ${isCancelada ? 'fa-ban' : status.icone}"></i>
                            ${isCancelada ? 'Cancelada' : status.texto}
                        </span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-fechar" onclick="fecharModalDetalhes()">
                    <i class="fas fa-times"></i> Fechar
                </button>
            </div>
        </div>
    </div>`;

        // 🔥 CORREÇÃO: Remover modais existentes
        this.fecharTodosModais();

        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 🔥 CORREÇÃO: Adicionar função global para fechar
        window.fecharModalDetalhes = () => {
            this.fecharTodosModais();
        };

        // 🔥 CORREÇÃO: Configurar evento de clique fora
        setTimeout(() => {
            const overlay = document.getElementById('modalDetalhesAula');
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        this.fecharTodosModais();
                    }
                });
            }

            // 🔥 CORREÇÃO: Prevenir que o clique no conteúdo feche o modal
            const modalContent = document.querySelector('.modal-content');
            if (modalContent) {
                modalContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }, 50);

        console.log('✅ Modal de detalhes aberto');
    }

    // 🔥 CORREÇÃO: Adicione estes métodos auxiliares
    fecharTodosModais() {
        const modais = document.querySelectorAll('.modal-overlay');
        modais.forEach(modal => {
            modal.remove();
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== UTILITÁRIOS ==========
    htmlToElement(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
    }

    getStatusAula(aula) {
        // 1. Verificar se a aula está cancelada
        if (aula.status === 'cancelada' || aula.cancelada || aula.ativa === 0 || aula.ativa === false) {
            return { classe: 'cancelada', texto: 'Cancelada', icone: 'fa-ban' };
        }

        // 2. Verificar se está em andamento AGORA
        const agora = new Date();
        const hoje = agora.getDay(); // 0 = Domingo, 1 = Segunda, etc.
        const horaAtual = agora.getHours() + agora.getMinutes() / 60;

        // Cada aula tem um dia da semana (número de 1 a 5)
        const diaAula = typeof aula.dia_semana === 'string' ?
            parseInt(aula.dia_semana) : aula.dia_semana;

        // 🔥 CORREÇÃO: Verificar se hoje é o dia da aula
        // Domingo = 0, Segunda = 1, Terça = 2, etc.
        const aulaHoje = (hoje === diaAula);

        if (aulaHoje) {
            const [horaInicio, minutoInicio] = aula.horario_inicio.split(':').map(Number);
            const [horaFim, minutoFim] = aula.horario_fim.split(':').map(Number);
            const horaInicioDecimal = horaInicio + minutoInicio / 60;
            const horaFimDecimal = horaFim + minutoFim / 60;

            // 🔥 CORREÇÃO: Verificar se está no horário da aula
            if (horaAtual >= horaInicioDecimal && horaAtual <= horaFimDecimal) {
                return { classe: 'em-andamento', texto: 'Em Andamento', icone: 'fa-play-circle' };
            }
        }

        // 3. Se não está cancelada e não está em andamento, então é ATIVA
        return { classe: 'ativa', texto: 'Ativa', icone: 'fa-check-circle' };
    }

    formatarDiasSemana(diaSemana) {
        // 🔥 CORREÇÃO: Cada aula agora tem apenas UM dia
        return this.formatarDiaUnico(diaSemana);
    }

    formatarDiaUnico(dia) {
        const diasMap = {
            'segunda': 'Segunda', 'terca': 'Terça', 'quarta': 'Quarta',
            'quinta': 'Quinta', 'sexta': 'Sexta',
            1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta'
        };
        return diasMap[dia] || dia;
    }

    validarFormularioAula(dados) {
        const erros = [];

        if (!dados.disciplina || dados.disciplina.trim().length < 3) {
            erros.push('Disciplina deve ter pelo menos 3 caracteres');
        }
        if (!dados.sala_id) erros.push('Selecione uma sala');
        if (!dados.curso) erros.push('Selecione um curso');
        if (!dados.turma) erros.push('Selecione uma turma');
        if (!dados.horario_inicio || !dados.horario_fim) erros.push('Selecione um horário');

        const diasSelecionados = Array.from(document.querySelectorAll('input[name="dias"]:checked'));
        if (diasSelecionados.length === 0) erros.push('Selecione pelo menos um dia da semana');

        if (dados.horario_inicio && dados.horario_fim) {
            const inicio = new Date(`2000-01-01T${dados.horario_inicio}`);
            const fim = new Date(`2000-01-01T${dados.horario_fim}`);
            if (inicio >= fim) erros.push('Horário de início deve ser antes do horário de fim');
        }

        return erros;
    }

    tratarErroAula(error) {
        const mensagens = {
            'Professor não encontrado': 'Seu perfil de professor não foi encontrado.',
            'UNIQUE constraint failed': 'Já existe uma aula com esses dados.',
            'FOREIGN KEY constraint failed': 'Sala ou curso inválido.',
            'NOT NULL constraint failed': 'Preencha todos os campos corretamente.'
        };

        for (const [chave, mensagem] of Object.entries(mensagens)) {
            if (error.message.includes(chave)) return mensagem;
        }

        return 'Erro ao criar aula: ' + error.message;
    }

    mostrarLoadingBotao(aulaId, acao) {
        const card = document.querySelector(`[data-aula-id="${aulaId}"]`);
        if (!card) return;

        const botoes = card.querySelectorAll('.professor-btn-action');
        botoes.forEach(botao => {
            const originalHTML = botao.innerHTML;
            botao.setAttribute('data-original-html', originalHTML);
            botao.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Processando...</span>`;
            botao.disabled = true;
        });
    }

    removerLoadingBotao(aulaId) {
        const card = document.querySelector(`[data-aula-id="${aulaId}"]`);
        if (!card) return;

        const botoes = card.querySelectorAll('.professor-btn-action');
        botoes.forEach(botao => {
            const originalHTML = botao.getAttribute('data-original-html');
            if (originalHTML) botao.innerHTML = originalHTML;
            botao.disabled = false;
        });
    }

    getHTMLAulasVazias() {
        return `
            <div class="professor-empty-state">
                <i class="fas fa-chalkboard-teacher fa-3x"></i>
                <p>Nenhuma aula encontrada</p>
                <p class="empty-subtitle">Crie sua primeira aula usando o botão acima</p>
            </div>`;
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
            .select-desabilitado {
                opacity: 0.7;
                cursor: not-allowed;
                background-color: #f9f9f9;
            }
            .select-habilitado {
                opacity: 1;
                cursor: pointer;
                background-color: white;
            }`;
        document.head.appendChild(style);
    }

    limparFormulario() {
        document.getElementById('formCriarAula')?.reset();
        showSection('minhas-aulas-professor');
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

    // ========== EDIÇÃO AVANÇADA (mantida para compatibilidade) ==========
    gerarHTMLModalEdicao(aula) {
        const diasSemana = {
            1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta',
            'segunda': 'segunda', 'terca': 'terca', 'quarta': 'quarta',
            'quinta': 'quinta', 'sexta': 'sexta'
        };

        const diasSelecionados = Array.isArray(aula.dia_semana) ?
            aula.dia_semana :
            [aula.dia_semana].map(dia => diasSemana[dia]).filter(Boolean);

        return `
        <div class="modal-overlay" id="modalEdicaoAula">
            <div class="modal-content modal-extra-large" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Editar Aula: ${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h3>
                    <button class="modal-close" onclick="document.getElementById('modalEdicaoAula').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="formEditarAula" class="professor-criar-aula-form">
                        <input type="hidden" id="editarAulaId" value="${aula.id}">
                        
                        <div class="professor-form-row">
                            <div class="professor-form-group">
                                <label for="editarCursoSelect" class="professor-form-label">
                                    <i class="fas fa-graduation-cap"></i> Curso *
                                </label>
                                <select id="editarCursoSelect" class="professor-form-control select-habilitado" required>
                                    <option value="">Selecione o curso</option>
                                </select>
                            </div>
                            <div class="professor-form-group">
                                <label for="editarPeriodoSelect" class="professor-form-label">
                                    <i class="fas fa-calendar-alt"></i> Período *
                                </label>
                                <select id="editarPeriodoSelect" class="professor-form-control select-desabilitado" required disabled>
                                    <option value="">Selecione o curso primeiro</option>
                                </select>
                            </div>
                        </div>

                        <div class="professor-form-row">
                            <div class="professor-form-group">
                                <label for="editarTurmaSelect" class="professor-form-label">
                                    <i class="fas fa-users"></i> Turma *
                                </label>
                                <select id="editarTurmaSelect" class="professor-form-control select-desabilitado" required disabled>
                                    <option value="">Selecione curso e período</option>
                                </select>
                            </div>
                            <div class="professor-form-group">
                                <label for="editarDisciplinaInput" class="professor-form-label">
                                    <i class="fas fa-book"></i> Disciplina *
                                </label>
                                <input type="text" id="editarDisciplinaInput" class="professor-form-control" 
                                       value="${aula.disciplina || aula.disciplina_nome || ''}" required
                                       placeholder="Nome da disciplina">
                            </div>
                        </div>

                        <div class="professor-form-row">
                            <div class="professor-form-group professor-form-group-full">
                                <label for="editarSearchSala" class="professor-form-label">
                                    <i class="fas fa-door-open"></i> Buscar Sala *
                                </label>
                                <div class="professor-search-container">
                                    <input type="text" id="editarSearchSala" class="professor-search-input"
                                           placeholder="Digite para filtrar salas... (Ex: A101, Laboratório, Bloco B)">
                                    <i class="fas fa-search professor-search-icon"></i>
                                </div>

                                <label for="editarSalaSelect" class="professor-form-label sala-select-label">
                                    <i class="fas fa-list"></i> Selecione a Sala *
                                </label>
                                <select id="editarSalaSelect" class="professor-form-control professor-sala-select" required size="6">
                                    <option value="">Carregando salas...</option>
                                </select>
                                <small class="professor-form-help">Use a busca acima para filtrar as salas</small>
                            </div>
                        </div>

                        <div class="professor-form-row">
                            <div class="professor-form-group">
                                <label for="editarHorarioSelect" class="professor-form-label">
                                    <i class="fas fa-clock"></i> Horário *
                                </label>
                                <select id="editarHorarioSelect" class="professor-form-control" required>
                                    <option value="">Selecione o horário</option>
                                    <option value="18:50-19:40">18:50 - 19:40</option>
                                    <option value="19:40-20:30">19:40 - 20:30</option>
                                    <option value="20:40-21:30">20:40 - 21:30</option>
                                    <option value="21:30-22:20">21:30 - 22:20</option>
                                </select>
                            </div>
                        </div>

                        <div class="professor-form-group professor-dias-container">
                            <label class="professor-form-label">
                                <i class="fas fa-calendar-day"></i> Dias da Semana *
                            </label>
                            <div class="professor-dias-checkbox">
                                ${['segunda', 'terca', 'quarta', 'quinta', 'sexta'].map(dia => `
                                    <label class="professor-checkbox-label">
                                        <input type="checkbox" name="editarDias" value="${dia}" 
                                            ${diasSelecionados.includes(dia) ? 'checked' : ''}>
                                        <span class="professor-checkmark"></span>
                                        <span class="professor-dia-text">${this.formatarDiasSemana(dia)}</span>
                                    </label>
                                `).join('')}
                            </div>
                            <small class="professor-form-help">Selecione os dias em que a aula ocorrerá</small>
                        </div>

                        <div class="professor-form-info">
                            <p><i class="fas fa-info-circle"></i> Todos os campos marcados com * são obrigatórios</p>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="professor-btn-secondary" onclick="document.getElementById('modalEdicaoAula').remove()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="button" class="btn-primary" onclick="professorManager.salvarEdicaoAula()">
                        <i class="fas fa-save"></i> Salvar Alterações
                    </button>
                </div>
            </div>
        </div>`;
    }

    async inicializarModalEdicao(aula) {
        try {
            await this.configurarCursoPeriodoTurmaEdicao(aula);
            await this.configurarSalasEdicao(aula.sala_id);
            this.configurarHorarioEdicao(aula.horario_inicio, aula.horario_fim);

            // 🔥 CORREÇÃO: Configurar eventos após um pequeno delay para garantir que o DOM está pronto
            setTimeout(() => {
                this.configurarEventosEdicao();
            }, 100);

        } catch (error) {
            console.error('❌ Erro ao inicializar modal de edição:', error);
            this.mostrarErro('Erro ao carregar dados para edição: ' + error.message);
        }
    }


    async configurarCursoPeriodoTurmaEdicao(aula) {
        const cursoSelect = document.getElementById('editarCursoSelect');
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        const turmaSelect = document.getElementById('editarTurmaSelect');

        if (this.cursos.length === 0) {
            await this.carregarCursosDetalhados();
        }

        // Popular select de cursos
        cursoSelect.innerHTML = '<option value="">Selecione o curso</option>' +
            this.cursos.map(curso =>
                `<option value="${curso.nome}" 
                 data-total-periodos="${curso.total_periodos || 8}"
                 ${curso.nome === aula.curso ? 'selected' : ''}>
            ${curso.nome} (${curso.total_periodos || 8} períodos)
        </option>`
            ).join('');

        // 🔥 CORREÇÃO: Se já tem curso selecionado, disparar eventos para carregar o restante
        if (aula.curso) {
            console.log('🔄 Curso pré-selecionado na edição, configurando dependências...');

            // Habilitar período
            periodoSelect.disabled = false;
            periodoSelect.classList.remove('select-desabilitado');
            periodoSelect.classList.add('select-habilitado');

            // Popular períodos
            const selectedCursoOption = cursoSelect.options[cursoSelect.selectedIndex];
            const totalPeriodos = selectedCursoOption ? parseInt(selectedCursoOption.getAttribute('data-total-periodos')) || 8 : 8;

            this.popularSelectPeriodosEdicao(totalPeriodos);

            // 🔥 CORREÇÃO: Aguardar um pouco e então selecionar o período e carregar turmas
            setTimeout(() => {
                if (aula.turma) {
                    // Tentar extrair o período da turma (ex: "T1", "T2", etc.)
                    const periodoMatch = aula.turma.match(/T?(\d+)/);
                    if (periodoMatch) {
                        const periodo = parseInt(periodoMatch[1]);
                        if (periodo >= 1 && periodo <= totalPeriodos) {
                            periodoSelect.value = periodo;

                            // Disparar evento change manualmente
                            periodoSelect.dispatchEvent(new Event('change'));

                            // Aguardar um pouco e selecionar a turma
                            setTimeout(() => {
                                turmaSelect.value = aula.turma;
                            }, 300);
                        }
                    }
                }
            }, 200);
        }
    }

    async configurarSalasEdicao(salaIdAtual) {
        const salaSelect = document.getElementById('editarSalaSelect');
        const searchInput = document.getElementById('editarSearchSala');

        if (this.salasDisponiveis.length === 0) {
            await this.carregarSalasDisponiveis();
        }

        salaSelect.innerHTML = '<option value="">Selecione a sala</option>' +
            this.salasDisponiveis.map(sala =>
                `<option value="${sala.id}" 
                     data-bloco="${sala.bloco}" 
                     data-tipo="${sala.tipo}"
                     ${sala.id === salaIdAtual ? 'selected' : ''}>
                ${sala.numero} - Bloco ${sala.bloco} (${sala.tipo}) - ${sala.capacidade} lugares
            </option>`
            ).join('');

        this.configurarBuscaSalasEdicao();

        if (salaIdAtual) {
            const selectedOption = salaSelect.options[salaSelect.selectedIndex];
            if (selectedOption && searchInput) {
                searchInput.value = selectedOption.textContent;
            }
        }
    }

    configurarHorarioEdicao(horarioInicio, horarioFim) {
        const horarioSelect = document.getElementById('editarHorarioSelect');
        if (!horarioSelect) return;

        const horarioString = `${horarioInicio}-${horarioFim}`;
        horarioSelect.value = horarioString;
    }

    habilitarPeriodoEdicao() {
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        periodoSelect.disabled = false;
        periodoSelect.classList.remove('select-desabilitado');
        periodoSelect.classList.add('select-habilitado');
    }

    async configurarPeriodoEdicao(aula) {
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        const cursoSelect = document.getElementById('editarCursoSelect');

        if (!cursoSelect.value) return;

        const selectedOption = cursoSelect.options[cursoSelect.selectedIndex];
        const totalPeriodos = selectedOption ? parseInt(selectedOption.getAttribute('data-total-periodos')) || 8 : 8;

        periodoSelect.innerHTML = '<option value="">Selecione o período</option>';
        for (let i = 1; i <= totalPeriodos; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}° Período`;
            periodoSelect.appendChild(option);
        }

        if (aula.turma) {
            const periodoMatch = aula.turma.match(/(\d+)/);
            if (periodoMatch) {
                const periodo = parseInt(periodoMatch[1]);
                if (periodo >= 1 && periodo <= totalPeriodos) {
                    periodoSelect.value = periodo;
                }
            }
        }
    }

    async configurarTurmaEdicao(curso, turmaAtual) {
        const turmaSelect = document.getElementById('editarTurmaSelect');
        const periodoSelect = document.getElementById('editarPeriodoSelect');

        if (!curso || !periodoSelect.value) {
            this.desabilitarTurmaEdicao();
            return;
        }

        try {
            await this.carregarTurmasPorCursoPeriodo(curso, periodoSelect.value);
            if (turmaAtual) turmaSelect.value = turmaAtual;
        } catch (error) {
            console.error('❌ Erro ao configurar turma na edição:', error);
            this.desabilitarTurmaEdicaoComMensagem('Erro ao carregar turmas');
        }
    }

    configurarBuscaSalasEdicao() {
        const searchInput = document.getElementById('editarSearchSala');
        const salaSelect = document.getElementById('editarSalaSelect');

        if (!searchInput || !salaSelect) {
            console.error('❌ Elementos de busca de salas não encontrados no modal de edição');
            return;
        }

        console.log('✅ Configurando busca de salas no modal de edição');

        // 🔥 CORREÇÃO: Remover event listeners anteriores
        searchInput.replaceWith(searchInput.cloneNode(true));
        salaSelect.replaceWith(salaSelect.cloneNode(true));

        // Obter elementos atualizados
        const searchInputAtualizado = document.getElementById('editarSearchSala');
        const salaSelectAtualizado = document.getElementById('editarSalaSelect');

        // Configurar busca
        searchInputAtualizado.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const options = salaSelectAtualizado.getElementsByTagName('option');

            for (let i = 0; i < options.length; i++) {
                const text = options[i].textContent.toLowerCase();
                options[i].style.display = text.includes(searchTerm) ? '' : 'none';
                if (i === 0) options[i].style.display = '';
            }
        });

        // Configurar seleção
        salaSelectAtualizado.addEventListener('change', function () {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption && searchInputAtualizado) {
                searchInputAtualizado.value = selectedOption.textContent;
            }
        });
    }

    configurarEventosEdicao() {
        console.log('🔧 Configurando eventos do modal de edição...');

        const cursoSelect = document.getElementById('editarCursoSelect');
        const periodoSelect = document.getElementById('editarPeriodoSelect');

        // 🔥 CORREÇÃO: Remover event listeners anteriores para evitar duplicação
        if (cursoSelect) {
            cursoSelect.replaceWith(cursoSelect.cloneNode(true));
        }
        if (periodoSelect) {
            periodoSelect.replaceWith(periodoSelect.cloneNode(true));
        }

        // 🔥 CORREÇÃO: Obter os elementos atualizados
        const cursoSelectAtualizado = document.getElementById('editarCursoSelect');
        const periodoSelectAtualizado = document.getElementById('editarPeriodoSelect');

        if (cursoSelectAtualizado) {
            console.log('✅ Configurando evento para curso select (edição)');
            cursoSelectAtualizado.addEventListener('change', (e) => {
                console.log('🎯 Curso alterado (edição):', e.target.value);
                this.handleCursoChangeEdicao(e.target.value);
            });
        }

        if (periodoSelectAtualizado) {
            console.log('✅ Configurando evento para período select (edição)');
            periodoSelectAtualizado.addEventListener('change', (e) => {
                console.log('🎯 Período alterado (edição):', e.target.value);
                this.handlePeriodoChangeEdicao(e.target.value);
            });
        }

        // 🔥 CORREÇÃO: Configurar busca de salas no modal de edição
        this.configurarBuscaSalasEdicao();
    }

    // 🔥 NOVOS MÉTODOS PARA HANDLE DE MUDANÇAS NA EDIÇÃO
    handleCursoChangeEdicao(cursoValue) {
        console.log('🔄 Handle curso change edição:', cursoValue);
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        const turmaSelect = document.getElementById('editarTurmaSelect');

        if (cursoValue) {
            // Habilitar período
            periodoSelect.disabled = false;
            periodoSelect.classList.remove('select-desabilitado');
            periodoSelect.classList.add('select-habilitado');

            // Popular períodos baseado no curso selecionado
            const selectedOption = document.querySelector('#editarCursoSelect option:checked');
            const totalPeriodos = selectedOption ? parseInt(selectedOption.getAttribute('data-total-periodos')) || 8 : 8;

            this.popularSelectPeriodosEdicao(totalPeriodos);
        } else {
            // Desabilitar período e turma
            periodoSelect.disabled = true;
            periodoSelect.innerHTML = '<option value="">Selecione o curso primeiro</option>';
            this.desabilitarTurmaEdicao();
        }
    }

    handlePeriodoChangeEdicao(periodoValue) {
        console.log('🔄 Handle período change edição:', periodoValue);
        const cursoSelect = document.getElementById('editarCursoSelect');
        const cursoValue = cursoSelect.value;

        if (cursoValue && periodoValue) {
            this.carregarTurmasPorCursoPeriodoEdicao(cursoValue, periodoValue);
        } else {
            this.desabilitarTurmaEdicao();
        }
    }

    popularSelectPeriodosEdicao(totalPeriodos) {
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        if (!periodoSelect) return;

        periodoSelect.innerHTML = '<option value="">Selecione o período</option>';

        for (let i = 1; i <= totalPeriodos; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}° Período`;
            periodoSelect.appendChild(option);
        }

        console.log(`✅ ${totalPeriodos} períodos carregados para edição`);
    }

    async carregarTurmasPorCursoPeriodoEdicao(curso, periodo) {
        try {
            console.log(`📋 Buscando turmas para edição: ${curso} - ${periodo}° período`);

            const cacheKey = `turmas-${curso}-${periodo}`;
            if (this.cache.has(cacheKey)) {
                this.popularSelectTurmasEdicao(this.cache.get(cacheKey));
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
                this.cache.set(cacheKey, turmas);
                this.popularSelectTurmasEdicao(turmas);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar turmas (edição):', error);
            this.desabilitarTurmaEdicaoComMensagem('Erro de conexão');
        }
    }

    popularSelectTurmasEdicao(turmas) {
        const turmaSelect = document.getElementById('editarTurmaSelect');
        if (!turmaSelect) return;

        turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';

        turmas.forEach(turma => {
            const option = document.createElement('option');
            option.value = turma.nome;
            option.textContent = turma.nome;
            turmaSelect.appendChild(option);
        });

        // Habilitar turma select
        turmaSelect.disabled = false;
        turmaSelect.classList.remove('select-desabilitado');
        turmaSelect.classList.add('select-habilitado');

        console.log(`✅ ${turmas.length} turmas carregadas para edição`);
    }

    desabilitarTurmaEdicao() {
        const turmaSelect = document.getElementById('editarTurmaSelect');
        if (turmaSelect) {
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = '<option value="">Selecione curso e período</option>';
            turmaSelect.classList.add('select-desabilitado');
            turmaSelect.classList.remove('select-habilitado');
        }
    }

    desabilitarTurmaEdicaoComMensagem(mensagem) {
        const turmaSelect = document.getElementById('editarTurmaSelect');
        if (turmaSelect) {
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = `<option value="">${mensagem}</option>`;
            turmaSelect.classList.add('select-desabilitado');
        }
    }

    async salvarEdicaoAula() {
        try {
            const aulaId = document.getElementById('editarAulaId').value;
            const form = document.getElementById('formEditarAula');

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const dadosAtualizados = {
                disciplina: document.getElementById('editarDisciplinaInput').value.trim(),
                sala_id: parseInt(document.getElementById('editarSalaSelect').value),
                curso: document.getElementById('editarCursoSelect').value,
                turma: document.getElementById('editarTurmaSelect').value,
                horario: document.getElementById('editarHorarioSelect').value
            };

            if (!this.validarDadosEdicao(dadosAtualizados)) return;

            const diasSelecionados = Array.from(document.querySelectorAll('input[name="editarDias"]:checked'))
                .map(cb => cb.value);

            if (diasSelecionados.length === 0) {
                this.mostrarErro('❌ Selecione pelo menos um dia da semana');
                return;
            }

            if (dadosAtualizados.horario) {
                const [horario_inicio, horario_fim] = dadosAtualizados.horario.split('-');
                dadosAtualizados.horario_inicio = horario_inicio.trim();
                dadosAtualizados.horario_fim = horario_fim.trim();
                delete dadosAtualizados.horario;
            }

            const submitBtn = document.querySelector('#formEditarAula ~ .modal-footer .btn-primary');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            submitBtn.disabled = true;

            await this.atualizarAulaNoBackend(aulaId, dadosAtualizados, diasSelecionados);

        } catch (error) {
            console.error('❌ Erro ao salvar edição:', error);
            this.mostrarErro('Erro ao salvar alterações: ' + error.message);
            this.reativarBotaoEdicao();
        }
    }

    validarDadosEdicao(dados) {
        if (!dados.curso) {
            this.mostrarErro('❌ Selecione um curso');
            return false;
        }
        if (!dados.turma) {
            this.mostrarErro('❌ Selecione uma turma');
            return false;
        }
        if (!dados.sala_id) {
            this.mostrarErro('❌ Selecione uma sala');
            return false;
        }
        if (!dados.disciplina) {
            this.mostrarErro('❌ Digite o nome da disciplina');
            return false;
        }
        if (!dados.horario) {
            this.mostrarErro('❌ Selecione um horário');
            return false;
        }
        return true;
    }

    reativarBotaoEdicao() {
        const submitBtn = document.querySelector('#formEditarAula ~ .modal-footer .btn-primary');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
            submitBtn.disabled = false;
        }
    }

    async atualizarAulaNoBackend(aulaId, dados, diasSelecionados) {
        try {
            const diaParaNumero = {
                'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5
            };

            const dadosCompletos = {
                ...dados,
                dia_semana: diaParaNumero[diasSelecionados[0]]
            };

            const result = await api.atualizarAula(aulaId, dadosCompletos);

            if (result?.success) {
                this.mostrarSucesso('Aula atualizada com sucesso!');
                document.getElementById('modalEdicaoAula')?.remove();
                await this.carregarMinhasAulas();
                this.cache.clear();
            } else {
                throw new Error(result?.error || 'Erro ao atualizar aula');
            }
        } catch (error) {
            console.error('❌ Erro na atualização:', error);
            throw new Error('Erro ao atualizar aula: ' + error.message);
        }
    }

    // ========== DESTRUIDOR ==========
    destruir() {
        this.cache.clear();
        document.removeEventListener('keydown', this.keyHandler);
        console.log('🧹 ProfessorManager destruído');
    }
}

// ✅ INSTÂNCIA GLOBAL
const professorManager = new ProfessorManager();
window.professorManager = professorManager;

console.log('👨‍🏫 professorManager global carregado');