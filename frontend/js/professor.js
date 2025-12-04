class ProfessorManager {
    constructor() {
        this.currentUser = null;
        this.minhasAulas = [];
        this.salasDisponiveis = [];
        this.cursos = [];
        this.turmas = [];
        this.cache = new Map();
        this.pendingRequest = null;
        this.handleCursoChangeEdicaoBound = null;
        this.handlePeriodoChangeEdicaoBound = null;
        this.init();
    }

    // ========== INICIALIZAÇÃO ==========
    async init() {
        const userData = localStorage.getItem('userData');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }

        this.currentUser = JSON.parse(userData);
        await this.carregarDadosIniciais();
        this.configurarInterface();
        this.configurarFiltros();
    }

    // 🔧 ATUALIZAR O CARREGAMENTO DE DADOS INICIAIS
    async carregarDadosIniciais() {
        const carregamentos = [
            this.carregarMinhasAulas(),
            this.carregarSalasDisponiveis(),
            this.carregarCursosDetalhados(),
            this.carregarDadosProfessor()
        ];

        for (const carregamento of carregamentos) {
            try {
                await carregamento;
            } catch (error) {
                console.error('Erro no carregamento:', error);
            }
        }
    }

    // 🔧 NOVA FUNÇÃO PARA CARREGAR DADOS DO PROFESSOR
    async carregarDadosProfessor() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;

            const response = await fetch('/api/professores/meu-perfil', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const professorData = await response.json();
                this.dadosProfessor = professorData;
                console.log('✅ Dados do professor carregados:', professorData);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados do professor:', error);
        }
    }

    configurarInterface() {
        this.configurarEventosFormulario();
        this.desabilitarPeriodo();
        this.desabilitarTurma();
        this.configurarDataMinima();
    }

    // ========== CARREGAMENTO DE DADOS ==========
    async carregarMinhasAulas() {
        try {
            const result = await api.getMinhasAulasProfessor();
            if (result?.success) {
                this.minhasAulas = this.processarDadosAulas(result.data);
                this.atualizarContadorFiltros(this.minhasAulas.length);
                this.filtrarAulas();
            } else {
                throw new Error(result?.error || 'Erro ao carregar aulas');
            }
        } catch (error) {
            console.error('Erro ao carregar aulas:', error);
            this.minhasAulas = [];
            this.renderizarAulas();
        }
    }

    processarDadosAulas(dados) {
        if (Array.isArray(dados)) return dados;
        if (dados && typeof dados === 'object') {
            if (dados.data && Array.isArray(dados.data)) return dados.data;
            const arrays = Object.values(dados).filter(val => Array.isArray(val));
            return arrays.length > 0 ? arrays[0] : [];
        }
        return [];
    }

    async carregarSalasDisponiveis() {
        try {
            const result = await api.getSalas();
            if (result?.success) {
                this.salasDisponiveis = result.data;
                this.renderizarSalasSelect();
            } else {
                throw new Error(result?.error);
            }
        } catch (error) {
            console.error('Erro ao carregar salas:', error);
            this.usarSalasPadrao();
        }
    }

    async carregarCursosDetalhados() {
        try {
            const result = await api.getCursosDetalhados();
            if (result?.success) {
                this.cursos = result.data;
                this.popularSelectCursos();
            } else {
                throw new Error(result?.error);
            }
        } catch (error) {
            console.error('Erro ao carregar cursos:', error);
            this.usarCursosPadrao();
        }
    }

    async carregarTurmasPorCursoPeriodo(curso, periodo) {
        try {
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
            console.error('Erro ao carregar turmas:', error);
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

    usarProfessoresPadrao() {
        return [
            { id: 1, nome: 'João Silva', email: 'joao.silva@unipam.edu.br' },
            { id: 2, nome: 'Maria Santos', email: 'maria.santos@unipam.edu.br' },
            { id: 3, nome: 'Pedro Oliveira', email: 'pedro.oliveira@unipam.edu.br' },
            { id: 4, nome: 'Ana Costa', email: 'ana.costa@unipam.edu.br' }
        ];
    }

    usarCursosPadrao() {
        return [
            { id: 1, nome: 'Sistemas de Informação', total_periodos: 8 },
            { id: 2, nome: 'Administração', total_periodos: 8 },
            { id: 3, nome: 'Direito', total_periodos: 8 }
        ];
    }

    // ========== CONFIGURAÇÃO DE EVENTOS ==========
    configurarEventosFormulario() {
        this.configurarEventoCurso();
        this.configurarEventoPeriodo();
        this.configurarBuscaSalas();
    }

    configurarEventoCurso() {
        const cursoSelect = document.getElementById('cursoSelect');
        if (!cursoSelect) return;

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

    // ========== SISTEMA DE FILTROS ==========

    configurarFiltros() {
        this.configurarFiltroTexto('filtroDisciplina', 'disciplina');
        this.configurarFiltroSelect('filtroCurso', 'curso');
        this.configurarFiltroSelect('filtroProfessor', 'professor');
        this.configurarFiltroTexto('filtroTurma', 'turma');
        this.configurarFiltroTexto('filtroSala', 'sala');
        this.configurarFiltroSelect('filtroStatus', 'status');

        // Carregar dados para os selects
        this.carregarCursosParaFiltro();
        this.carregarProfessoresParaFiltro();

        // Botão limpar filtros
        const btnLimparFiltros = document.getElementById('btnLimparFiltros');
        if (btnLimparFiltros) {
            btnLimparFiltros.addEventListener('click', () => this.limparFiltros());
        }
    }

    configurarFiltroTexto(inputId, campo) {
        const input = document.getElementById(inputId);
        if (!input) return;

        // Debounce para não filtrar a cada tecla pressionada
        let timeout;
        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.filtrarAulas();
            }, 300);
        });

        // Também filtrar ao pressionar Enter
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.filtrarAulas();
            }
        });
    }

    configurarFiltroSelect(selectId, campo) {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.addEventListener('change', () => {
            this.filtrarAulas();
        });
    }

    popularFiltroProfessores(professores) {
        const select = document.getElementById('filtroProfessor');
        if (!select) return;

        select.innerHTML = '<option value="">Todos os professores</option>';

        // Ordenar professores por nome
        professores.sort((a, b) => a.nome.localeCompare(b.nome));

        professores.forEach(professor => {
            const option = document.createElement('option');
            option.value = professor.nome;
            option.textContent = professor.nome;
            option.setAttribute('data-email', professor.email || '');
            select.appendChild(option);
        });
    }

    popularFiltroCursos(cursos) {
        const select = document.getElementById('filtroCurso');
        if (!select) return;

        select.innerHTML = '<option value="">Todos os cursos</option>';

        cursos.forEach(curso => {
            const option = document.createElement('option');
            option.value = curso.nome;
            option.textContent = curso.nome;
            select.appendChild(option);
        });
    }

    async carregarProfessoresParaFiltro() {
        const select = document.getElementById('filtroProfessor');
        if (!select) return;

        try {
            select.classList.add('loading');

            // USAR A ROTA DE PROFESSORES ATIVOS
            const result = await api.getProfessoresAtivos();
            if (result?.success) {
                this.professores = result.data;
                this.popularFiltroProfessores(this.professores);
            } else {
                throw new Error(result?.error || 'Erro ao carregar professores');
            }
        } catch (error) {
            console.error('Erro ao carregar professores para filtro:', error);
            this.popularFiltroProfessores(this.usarProfessoresPadrao());
        } finally {
            select.classList.remove('loading');
        }
    }

    // ========== CARREGAR DADOS PARA OS FILTROS ==========

    async carregarCursosParaFiltro() {
        const select = document.getElementById('filtroCurso');
        if (!select) return;

        try {
            select.classList.add('loading');

            if (this.cursos && this.cursos.length > 0) {
                this.popularFiltroCursos(this.cursos);
            } else {
                const result = await api.getCursosDetalhados();
                if (result?.success) {
                    this.cursos = result.data;
                    this.popularFiltroCursos(this.cursos);
                } else {
                    throw new Error(result?.error || 'Erro ao carregar cursos');
                }
            }
        } catch (error) {
            console.error('Erro ao carregar cursos para filtro:', error);
            this.popularFiltroCursos(this.usarCursosPadrao());
        } finally {
            select.classList.remove('loading');
        }
    }

    // ========== ATUALIZAR CONTADOR DE FILTROS ATIVOS ==========

    atualizarContadorFiltros(totalFiltrado) {
        const contador = document.getElementById('contadorAulas');
        const totalOriginal = this.minhasAulas.length;
        const filtrosContainer = document.querySelector('.filtros-container');

        if (contador) {
            if (totalFiltrado === totalOriginal) {
                contador.textContent = `Total: ${totalOriginal} aulas`;
                contador.classList.remove('filtro-ativo');
                filtrosContainer?.classList.remove('filtros-ativos');
            } else {
                contador.textContent = `Mostrando ${totalFiltrado} de ${totalOriginal} aulas`;
                contador.classList.add('filtro-ativo');
                filtrosContainer?.classList.add('filtros-ativos');
            }
        }
    }

    filtrarAulas() {
        if (!this.minhasAulas || this.minhasAulas.length === 0) return;

        const filtros = this.obterValoresFiltros();
        const aulasFiltradas = this.aplicarFiltros(this.minhasAulas, filtros);

        this.renderizarAulasFiltradas(aulasFiltradas);
        this.atualizarContadorFiltros(aulasFiltradas.length);
    }

    // 🔧 CORREÇÃO: Remover dia_semana dos filtros
    obterValoresFiltros() {
        return {
            disciplina: document.getElementById('filtroDisciplina')?.value.toLowerCase().trim() || '',
            curso: document.getElementById('filtroCurso')?.value || '',
            professor: document.getElementById('filtroProfessor')?.value || '',
            turma: document.getElementById('filtroTurma')?.value.toLowerCase().trim() || '',
            sala: document.getElementById('filtroSala')?.value.toLowerCase().trim() || '',
            status: document.getElementById('filtroStatus')?.value || ''
        };
    }

    aplicarFiltros(aulas, filtros) {
        return aulas.filter(aula => {
            // Filtro por disciplina
            if (filtros.disciplina) {
                const disciplina = (aula.disciplina || aula.disciplina_nome || '').toLowerCase();
                if (!disciplina.includes(filtros.disciplina)) return false;
            }

            // Filtro por curso
            if (filtros.curso) {
                const curso = (aula.curso || '');
                if (curso !== filtros.curso) return false;
            }

            // Filtro por professor
            if (filtros.professor) {
                const professor = (aula.professor_nome || '');
                if (professor !== filtros.professor) return false;
            }

            // Filtro por turma
            if (filtros.turma) {
                const turma = (aula.turma || '').toLowerCase();
                if (!turma.includes(filtros.turma)) return false;
            }

            // Filtro por sala
            if (filtros.sala) {
                const salaNumero = (aula.sala_numero || '').toLowerCase();
                const salaBloco = (aula.sala_bloco || '').toLowerCase();
                if (!salaNumero.includes(filtros.sala) && !salaBloco.includes(filtros.sala)) return false;
            }

            if (filtros.status) {
                const isCancelada = aula.ativa === 0 || aula.ativa === false || aula.status === 'cancelada';

                if (filtros.status === 'ativa' && isCancelada) return false;
                if (filtros.status === 'cancelada' && !isCancelada) return false;
            }

            return true;
        });
    }

    renderizarAulasFiltradas(aulasFiltradas) {
        const container = document.getElementById('aulas-professor-grid');
        if (!container) return;

        if (aulasFiltradas.length === 0) {
            container.innerHTML = this.getHTMLNenhumaAulaEncontrada();
            return;
        }

        container.innerHTML = '';
        aulasFiltradas.forEach(aula => {
            const card = this.criarCardAula(aula);
            container.appendChild(this.htmlToElement(card));
        });
    }

    getHTMLNenhumaAulaEncontrada() {
        return `
        <div class="professor-empty-state">
            <i class="fas fa-search fa-3x"></i>
            <p>Nenhuma aula encontrada</p>
            <p class="empty-subtitle">Tente ajustar os filtros de busca ou verifique se os critérios estão corretos</p>
            <button class="btn-limpar-filtros-empty" onclick="professorManager.limparFiltros()">
                 Limpar Todos os Filtros
            </button>
        </div>`;
    }

    // 🔧 CORREÇÃO: Remover filtroDia da limpeza
    limparFiltros() {
        // Limpar campos de texto
        const inputsTexto = ['filtroDisciplina', 'filtroTurma', 'filtroSala'];
        inputsTexto.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });

        // Limpar selects
        const selects = ['filtroCurso', 'filtroProfessor', 'filtroStatus'];
        selects.forEach(id => {
            const select = document.getElementById(id);
            if (select) select.selectedIndex = 0;
        });

        // Re-renderizar todas as aulas
        this.filtrarAulas();
    }

    // ========== GESTÃO DE AULAS ==========
    renderizarAulas() {
        this.filtrarAulas();
    }

    criarCardAula(aula) {
        const status = this.getStatusAula(aula);
        const dataFormatada = this.formatarDataDisplay(aula.data_aula);
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
                <span class="professor-icon"><i class="fas fa-calendar-day"></i></span>
                <span>${dataFormatada}</span>
            </div>
            <div class="professor-info-item">
                <span class="professor-icon"><i class="fas fa-clock"></i></span>
                <span>${aula.horario_inicio} - ${aula.horario_fim}</span>
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

    formatarDataDisplay(dataString) {
        if (!dataString) return 'Data não definida';

        // 🔥 CORREÇÃO SIMPLIFICADA: Usar data local simples
        const [ano, mes, dia] = dataString.split('-').map(Number);
        const data = new Date(ano, mes - 1, dia);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);

        // Verificar se é hoje, amanhã ou outra data
        if (data.getTime() === hoje.getTime()) {
            return 'Hoje';
        } else if (data.getTime() === amanha.getTime()) {
            return 'Amanhã';
        } else {
            return data.toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
    }

    mostrarModalDetalhesAula(aula) {
        const status = this.getStatusAula(aula);
        const dataFormatada = this.formatarDataDisplay(aula.data_aula);
        const isCancelada = aula.ativa === 0 || aula.ativa === false || aula.status === 'cancelada';

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
                ${aula.professor_nome ? `
                <div class="detalhe-item">
                    <label><i class="fas fa-chalkboard-teacher"></i> Professor:</label>
                    <span>${this.escapeHtml(aula.professor_nome)}</span>
                </div>
                ` : ''}
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
                    <label><i class="fas fa-calendar-day"></i> Data:</label>
                    <span>${dataFormatada}</span>
                </div>
                ${aula.periodo ? `
                <div class="detalhe-item">
                    <label><i class="fas fa-calendar-alt"></i> Período:</label>
                    <span>${aula.periodo}º Período</span>
                </div>
                ` : ''}
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

        this.fecharTodosModais();
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        window.fecharModalDetalhes = () => {
            this.fecharTodosModais();
        };

        setTimeout(() => {
            const overlay = document.getElementById('modalDetalhesAula');
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        this.fecharTodosModais();
                    }
                });
            }

            const modalContent = document.querySelector('.modal-content');
            if (modalContent) {
                modalContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }, 50);
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
        }
        `;
        document.head.appendChild(style);
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

    async criarAula(dadosAula) {
        const requestKey = `criar-aula-${JSON.stringify(dadosAula)}`;
        if (this.pendingRequest === requestKey) return;
        this.pendingRequest = requestKey;

        try {
            // 🔥 CORREÇÃO RADICAL: SEM VALIDAÇÃO DE DATA
            const dadosFormatados = {
                ...dadosAula,
                periodo: parseInt(dadosAula.periodo) || 5
            };

            console.log('📤 Enviando dados para API (sem validação de data):', dadosFormatados);

            const result = await api.criarAula(dadosFormatados);

            if (result?.success) {
                this.mostrarSucesso(result.message);
                await this.carregarMinhasAulas();
                this.limparFormulario();
                this.cache.clear();

                setTimeout(() => {
                    showSection('minhas-aulas-professor');
                }, 2000);
            } else {
                throw new Error(result?.error || 'Erro desconhecido ao criar aula');
            }
        } catch (error) {
            console.error('Erro ao criar aula:', error);
            this.mostrarErro(this.tratarErroAula(error));
        } finally {
            this.pendingRequest = null;
        }
    }

    limparFormulario() {
        const form = document.getElementById('formCriarAula');
        if (form) {
            form.reset();
            this.desabilitarPeriodo();
            this.desabilitarTurma();
        }
    }

    async editarAula(aulaId) {
        try {
            const aula = this.minhasAulas.find(a => a.id === aulaId);
            if (!aula) throw new Error('Aula não encontrada');
            this.mostrarModalEdicaoAula(aula);
        } catch (error) {
            console.error('Erro ao editar aula:', error);
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
            console.error('Erro ao cancelar aula:', error);
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
            console.error('Erro ao reativar aula:', error);
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
            console.error('Erro ao excluir aula:', error);
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
        const aula = this.minhasAulas.find(a => a.id === aulaId);
        if (aula) {
            this.mostrarModalDetalhesAula(aula);
        } else {
            this.mostrarErro('Aula não encontrada');
        }
    }

    fecharTodosModais() {
        const modais = document.querySelectorAll('.modal-overlay');
        modais.forEach(modal => modal.remove());
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
        if (aula.status === 'cancelada' || aula.cancelada || aula.ativa === 0 || aula.ativa === false) {
            return { classe: 'cancelada', texto: 'Cancelada', icone: 'fa-ban' };
        }

        const agora = new Date();
        const dataAula = new Date(aula.data_aula);
        const hoje = new Date(agora.toDateString());

        if (dataAula.toDateString() === hoje.toDateString()) {
            const horaAtual = agora.getHours() + agora.getMinutes() / 60;
            const [horaInicio, minutoInicio] = aula.horario_inicio.split(':').map(Number);
            const [horaFim, minutoFim] = aula.horario_fim.split(':').map(Number);
            const horaInicioDecimal = horaInicio + minutoInicio / 60;
            const horaFimDecimal = horaFim + minutoFim / 60;

            if (horaAtual >= horaInicioDecimal && horaAtual <= horaFimDecimal) {
                return { classe: 'em-andamento', texto: 'Em Andamento', icone: 'fa-play-circle' };
            }
        }
        return { classe: 'ativa', texto: 'Ativa', icone: 'fa-check-circle' };
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
        if (!dados.data_aula) erros.push('Selecione uma data para a aula');

        if (dados.horario_inicio && dados.horario_fim) {
            const inicio = new Date(`2000-01-01T${dados.horario_inicio}`);
            const fim = new Date(`2000-01-01T${dados.horario_fim}`);
            if (inicio >= fim) erros.push('Horário de início deve ser antes do horário de fim');
        }

        return erros;
    }

    configurarDataMinima() {
        const dataInput = document.getElementById('dataAula');
        if (dataInput) {
            const hoje = new Date().toISOString().split('T')[0];
            dataInput.setAttribute('min', hoje);
        }
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

    abrirMapaSala(bloco, andar, sala) {
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

    // ========== EDIÇÃO AVANÇADA ==========
    gerarHTMLModalEdicao(aula) {
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
                
                <!-- Disciplina -->
                <div class="professor-form-row">
                    <div class="professor-form-group professor-form-group-full">
                        <label for="editarDisciplinaInput" class="professor-form-label">
                            <i class="fas fa-book"></i> Disciplina *
                        </label>
                        <input type="text" id="editarDisciplinaInput" class="professor-form-control" required
                            value="${aula.disciplina || aula.disciplina_nome || ''}"
                            placeholder="Nome da disciplina">
                    </div>
                </div>

                <!-- Curso, Período e Turma -->
                <div class="professor-form-row">
                    <div class="professor-form-group">
                        <label for="editarCursoSelect" class="professor-form-label">
                            <i class="fas fa-graduation-cap"></i> Curso *
                        </label>
                        <select id="editarCursoSelect" class="professor-form-control" required>
                            <option value="">Selecione o curso</option>
                        </select>
                    </div>
                    <div class="professor-form-group">
                        <label for="editarPeriodoSelect" class="professor-form-label">
                            <i class="fas fa-calendar-alt"></i> Período *
                        </label>
                        <select id="editarPeriodoSelect" class="professor-form-control" required>
                            <option value="">Selecione o período</option>
                        </select>
                    </div>
                    <div class="professor-form-group">
                        <label for="editarTurmaSelect" class="professor-form-label">
                            <i class="fas fa-users"></i> Turma *
                        </label>
                        <select id="editarTurmaSelect" class="professor-form-control" required>
                            <option value="">Selecione a turma</option>
                        </select>
                    </div>
                </div>

                <!-- Data e Horário -->
                <div class="professor-form-row">
                    <div class="professor-form-group">
                        <label for="editarDataAula" class="professor-form-label">
                            <i class="fas fa-calendar-day"></i> Data da Aula *
                        </label>
                        <input type="date" id="editarDataAula" class="professor-form-control" 
                            value="${aula.data_aula || ''}" required
                            min="${new Date().toISOString().split('T')[0]}">
                    </div>
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

                <!-- Sala -->
                <div class="professor-form-row">
                    <div class="professor-form-group professor-form-group-full">
                        <label for="editarSearchSala" class="professor-form-label">
                            <i class="fas fa-door-open"></i> Buscar Sala *
                        </label>
                        <div class="professor-search-container">
                            <input type="text" id="editarSearchSala" class="professor-search-input"
                                placeholder="Digite para filtrar salas...">
                            <i class="fas fa-search professor-search-icon"></i>
                        </div>
                        <select id="editarSalaSelect" class="professor-form-control professor-sala-select" required size="6">
                            <option value="">Selecione uma sala</option>
                        </select>
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn-primary" onclick="professorManager.salvarEdicaoAula()">
                <i class="fas fa-save"></i> Salvar Alterações
            </button>
        </div>
    </div>             
</div>`;
    }

    // 🔧 CORREÇÃO: Remover referência a dias da semana na inicialização do modal
    async inicializarModalEdicao(aula) {
        try {
            document.getElementById('editarAulaId').value = aula.id;
            document.getElementById('editarDisciplinaInput').value = aula.disciplina || aula.disciplina_nome || '';
            this.configurarHorarioEdicao(aula.horario_inicio, aula.horario_fim);

            await this.configurarSalasEdicao(aula.sala_id);

            // Configurar curso, período e turma
            await this.configurarCursoPeriodoTurmaEdicao(aula);

            // Configurar eventos APÓS os dados estarem preenchidos
            this.configurarEventosEdicao();

        } catch (error) {
            console.error('Erro ao inicializar modal de edição:', error);
            this.mostrarErro('Erro ao carregar dados para edição: ' + error.message);
        }
    }

    extrairPeriodoDaTurma(turma) {
        if (!turma) return null;

        const turmaStr = turma.toString().trim();

        if (turmaStr.toUpperCase().startsWith('T')) {
            const numero = turmaStr.substring(1).trim();
            const periodo = parseInt(numero);
            if (!isNaN(periodo) && periodo >= 1 && periodo <= 20) {
                return periodo;
            }
        }

        const match = turmaStr.match(/(\d+)/);
        if (match && match[1]) {
            const periodo = parseInt(match[1]);
            if (periodo >= 1 && periodo <= 20) {
                return periodo;
            }
        }

        return null;
    }

    async configurarCursoPeriodoTurmaEdicao(aula) {
        const cursoSelect = document.getElementById('editarCursoSelect');
        const periodoSelect = document.getElementById('editarPeriodoSelect');

        await this.configurarCursoEdicao(aula.curso);

        if (aula.periodo) {
            this.configurarPeriodoEdicaoDireto(aula.periodo, aula);
        } else {
            const periodoExtraido = this.extrairPeriodoDaTurma(aula.turma);
            if (periodoExtraido) {
                this.configurarPeriodoEdicaoDireto(periodoExtraido, aula);
            }
        }
    }

    configurarPeriodoEdicaoDireto(periodo, aula) {
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        const cursoSelect = document.getElementById('editarCursoSelect');

        if (!periodoSelect) return;

        this.habilitarPeriodoEdicao();

        const selectedOption = cursoSelect.options[cursoSelect.selectedIndex];
        const totalPeriodos = selectedOption ?
            parseInt(selectedOption.getAttribute('data-total-periodos')) || 8 : 8;

        this.popularSelectPeriodosEdicao(totalPeriodos);

        periodoSelect.value = periodo;
        this.configurarTurmaEdicaoAposPeriodo(aula.curso, periodo, aula.turma);
    }

    async configurarTurmaEdicaoAposPeriodo(curso, periodo, turma) {
        await this.carregarTurmasPorCursoPeriodoEdicao(curso, periodo);

        const turmaSelect = document.getElementById('editarTurmaSelect');
        if (turmaSelect && turma) {
            turmaSelect.value = turma;
        }
    }

    async configurarCursoEdicao(cursoAula) {
        const cursoSelect = document.getElementById('editarCursoSelect');

        if (this.cursos.length === 0) {
            await this.carregarCursosDetalhados();
        }

        cursoSelect.innerHTML = '<option value="">Selecione o curso</option>' +
            this.cursos.map(curso =>
                `<option value="${curso.nome}" 
                 data-total-periodos="${curso.total_periodos || 8}"
                 ${curso.nome === cursoAula ? 'selected' : ''}>
            ${curso.nome} (${curso.total_periodos || 8} períodos)
        </option>`
            ).join('');

        if (cursoAula) {
            this.habilitarPeriodoEdicao();
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
                 ${sala.id === parseInt(salaIdAtual) ? 'selected' : ''}>
                ${sala.numero} - Bloco ${sala.bloco} (${sala.tipo}) - ${sala.capacidade} lugares
            </option>`
            ).join('');

        this.configurarBuscaSalasEdicao();

        if (salaIdAtual && searchInput) {
            const selectedOption = salaSelect.options[salaSelect.selectedIndex];
            if (selectedOption && selectedOption.textContent) {
                searchInput.value = selectedOption.textContent;
            }
        }
    }

    configurarHorarioEdicao(horarioInicio, horarioFim) {
        const horarioSelect = document.getElementById('editarHorarioSelect');
        if (!horarioSelect) return;

        const horarioString = `${horarioInicio}-${horarioFim}`;
        const options = Array.from(horarioSelect.options);
        const existingOption = options.find(opt => opt.value === horarioString);

        if (existingOption) {
            horarioSelect.value = horarioString;
        } else {
            horarioSelect.value = '';
        }
    }

    desabilitarPeriodoEdicao() {
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        if (periodoSelect) {
            periodoSelect.disabled = true;
            periodoSelect.innerHTML = '<option value="">Selecione o curso primeiro</option>';
            periodoSelect.classList.add('select-desabilitado');
            periodoSelect.classList.remove('select-habilitado');
        }
    }

    habilitarPeriodoEdicao() {
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        if (!periodoSelect) return;

        periodoSelect.disabled = false;
        periodoSelect.classList.remove('select-desabilitado');
        periodoSelect.classList.add('select-habilitado');
        periodoSelect.style.opacity = '1';
        periodoSelect.style.cursor = 'pointer';
        periodoSelect.style.backgroundColor = '';
    }

    configurarBuscaSalasEdicao() {
        const searchInput = document.getElementById('editarSearchSala');
        const salaSelect = document.getElementById('editarSalaSelect');

        if (!searchInput || !salaSelect) return;

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const options = salaSelect.getElementsByTagName('option');

            for (let i = 0; i < options.length; i++) {
                const text = options[i].textContent.toLowerCase();
                options[i].style.display = text.includes(searchTerm) ? '' : 'none';
                if (i === 0) options[i].style.display = '';
            }
        });

        salaSelect.addEventListener('change', () => {
            const selectedOption = salaSelect.options[salaSelect.selectedIndex];
            if (selectedOption && searchInput) {
                searchInput.value = selectedOption.textContent;
            }
        });
    }

    configurarEventosEdicao() {
        const cursoSelect = document.getElementById('editarCursoSelect');
        const periodoSelect = document.getElementById('editarPeriodoSelect');

        if (cursoSelect) {
            cursoSelect.removeEventListener('change', this.handleCursoChangeEdicaoBound);
            this.handleCursoChangeEdicaoBound = (e) => this.handleCursoChangeEdicao(e.target.value);
            cursoSelect.addEventListener('change', this.handleCursoChangeEdicaoBound);
        }

        if (periodoSelect) {
            periodoSelect.removeEventListener('change', this.handlePeriodoChangeEdicaoBound);
            this.handlePeriodoChangeEdicaoBound = (e) => this.handlePeriodoChangeEdicao(e.target.value);
            periodoSelect.addEventListener('change', this.handlePeriodoChangeEdicaoBound);
        }

        this.configurarBuscaSalasEdicao();
    }

    handleCursoChangeEdicao(cursoValue) {
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        const turmaSelect = document.getElementById('editarTurmaSelect');

        if (cursoValue) {
            periodoSelect.disabled = false;
            periodoSelect.classList.remove('select-desabilitado');
            periodoSelect.classList.add('select-habilitado');

            const selectedOption = document.querySelector('#editarCursoSelect option:checked');
            const totalPeriodos = selectedOption ? parseInt(selectedOption.getAttribute('data-total-periodos')) || 8 : 8;

            this.popularSelectPeriodosEdicao(totalPeriodos);
        } else {
            periodoSelect.disabled = true;
            periodoSelect.innerHTML = '<option value="">Selecione o curso primeiro</option>';
            this.desabilitarTurmaEdicao();
        }
    }

    handlePeriodoChangeEdicao(periodoValue) {
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

        periodoSelect.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecione o período';
        periodoSelect.appendChild(placeholder);

        for (let i = 1; i <= totalPeriodos; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}° Período`;
            periodoSelect.appendChild(option);
        }

        periodoSelect.disabled = false;
        periodoSelect.classList.remove('select-desabilitado');
        periodoSelect.classList.add('select-habilitado');
    }

    async carregarTurmasPorCursoPeriodoEdicao(curso, periodo) {
        try {
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
            console.error('Erro ao carregar turmas (edição):', error);
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

        turmaSelect.disabled = false;
        turmaSelect.classList.remove('select-desabilitado');
        turmaSelect.classList.add('select-habilitado');
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
            const aulaId = document.getElementById('editarAulaId')?.value;
            if (!aulaId) throw new Error('ID da aula não encontrado');

            const dadosAtualizados = {
                disciplina: document.getElementById('editarDisciplinaInput')?.value.trim(),
                sala_id: parseInt(document.getElementById('editarSalaSelect')?.value),
                curso: document.getElementById('editarCursoSelect')?.value,
                turma: document.getElementById('editarTurmaSelect')?.value,
                data_aula: document.getElementById('editarDataAula')?.value,
                periodo: parseInt(document.getElementById('editarPeriodoSelect')?.value)
            };

            // 🔥 CORREÇÃO: REMOVER VALIDAÇÃO DE DATA PARA EDIÇÃO
            // Permitir edição de qualquer data, incluindo passadas
            console.log('📅 Editando aula (sem validação de data):', dadosAtualizados.data_aula);

            // Processar horário
            const horario = document.getElementById('editarHorarioSelect')?.value;
            if (horario) {
                const [horario_inicio, horario_fim] = horario.split('-');
                dadosAtualizados.horario_inicio = horario_inicio.trim();
                dadosAtualizados.horario_fim = horario_fim.trim();
            }

            // Validações (exceto data)
            const erros = [];
            if (!dadosAtualizados.curso) erros.push('Selecione um curso');
            if (!dadosAtualizados.periodo || isNaN(dadosAtualizados.periodo)) erros.push('Selecione um período válido');
            if (!dadosAtualizados.turma) erros.push('Selecione uma turma');
            if (!dadosAtualizados.sala_id || isNaN(dadosAtualizados.sala_id)) erros.push('Selecione uma sala válida');
            if (!dadosAtualizados.disciplina || dadosAtualizados.disciplina.trim().length < 2) erros.push('Digite um nome de disciplina válido');
            if (!horario) erros.push('Selecione um horário');

            if (erros.length > 0) {
                this.mostrarErro('Erros no formulário:\n• ' + erros.join('\n• '));
                return;
            }

            const modal = document.getElementById('modalEdicaoAula');
            const submitBtn = modal?.querySelector('.btn-primary');

            let originalText = '';
            if (submitBtn) {
                originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                submitBtn.disabled = true;
            }

            try {
                const result = await api.atualizarAula(aulaId, dadosAtualizados);

                if (result?.success) {
                    this.mostrarSucesso('Aula atualizada com sucesso!');
                    const modal = document.getElementById('modalEdicaoAula');
                    if (modal) modal.remove();
                    await this.carregarMinhasAulas();
                    this.cache.clear();
                } else {
                    throw new Error(result?.error || 'Erro desconhecido ao atualizar aula');
                }

            } catch (error) {
                throw error;
            } finally {
                if (submitBtn) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }

        } catch (error) {
            console.error('Erro ao salvar edição:', error);
            this.mostrarErro('Erro ao salvar alterações: ' + error.message);
        }
    }

    // ========== DESTRUIDOR ==========
    destruir() {
        this.cache.clear();
        document.removeEventListener('keydown', this.keyHandler);
    }
}

const professorManager = new ProfessorManager();
window.professorManager = professorManager;