class ProfessorManager {
    constructor() {
        this.currentUser = null;
        this.minhasAulas = []; // 🔥 SEMPRE inicializar como array vazio
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

        // 🔥 CORREÇÃO: Usar await individualmente em vez de Promise.allSettled
        try {
            await this.carregarMinhasAulas();
        } catch (error) {
            console.error('❌ Erro ao carregar aulas:', error);
        }

        try {
            await this.carregarSalasDisponiveis();
        } catch (error) {
            console.error('❌ Erro ao carregar salas:', error);
        }

        try {
            await this.carregarCursosDetalhados();
        } catch (error) {
            console.error('❌ Erro ao carregar cursos:', error);
        }

        this.configurarEventosFormulario();
        this.desabilitarPeriodo();
        this.desabilitarTurma();
    }

    // 🔥 MÉTODOS DE CARREGAMENTO
    async carregarMinhasAulas() {
        try {
            console.log('📚 Carregando aulas do professor...');

            const result = await api.getMinhasAulasProfessor();

            console.log('📦 Resposta completa da API:', result); // DEBUG

            if (result?.success) {
                // 🔥 CORREÇÃO: Garantir que temos um array válido
                let aulasData = result.data;

                // Se data não for um array, tentar extrair de outras propriedades
                if (!Array.isArray(aulasData)) {
                    console.warn('⚠️ Resposta não é um array, tentando extrair dados...', aulasData);

                    if (aulasData && typeof aulasData === 'object') {
                        // Tentar encontrar array em propriedades comuns
                        if (Array.isArray(aulasData.aulas)) {
                            aulasData = aulasData.aulas;
                        } else if (Array.isArray(aulasData.data)) {
                            aulasData = aulasData.data;
                        } else if (Array.isArray(aulasData.result)) {
                            aulasData = aulasData.result;
                        } else {
                            // Extrair todos os valores que são arrays
                            const arrays = Object.values(aulasData).filter(val => Array.isArray(val));
                            if (arrays.length > 0) {
                                aulasData = arrays[0];
                            }
                        }
                    }
                }

                // 🔥 CORREÇÃO: Garantir que minhasAulas seja sempre um array
                this.minhasAulas = Array.isArray(aulasData) ? aulasData : [];

                console.log(`✅ ${this.minhasAulas.length} aulas carregadas do backend`);

                if (this.minhasAulas.length > 0) {
                    const ativas = this.minhasAulas.filter(a => a.ativa === 1 || a.ativa === true).length;
                    const canceladas = this.minhasAulas.filter(a => a.ativa === 0 || a.ativa === false).length;
                    console.log(`📊 Detalhes: ${ativas} ativas, ${canceladas} canceladas`);
                }

                this.renderizarAulas();
            } else {
                console.error('❌ Erro na resposta da API:', result?.error);
                throw new Error(result?.error || 'Erro ao carregar aulas');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar aulas:', error);
            this.mostrarErro('Erro ao carregar aulas. Recarregue a página.');

            // Fallback seguro
            this.minhasAulas = [];
            this.renderizarAulas();
        }
    }

    // 🔧 MÉTODO TEMPORÁRIO PARA DEBUG
    async debugAulasAPI() {
        try {
            console.log('🔍 DEBUG: Verificando resposta da API...');

            const result = await api.getMinhasAulasProfessor();
            console.log('📦 Resposta completa:', result);
            console.log('📋 Tipo de result:', typeof result);
            console.log('🔍 Propriedades de result:', Object.keys(result));

            if (result.data) {
                console.log('📊 Tipo de result.data:', typeof result.data);
                console.log('🔍 Propriedades de result.data:', Object.keys(result.data));
                console.log('📝 É array?', Array.isArray(result.data));
            }

            return result;
        } catch (error) {
            console.error('❌ Erro no debug:', error);
        }
    }

    usarAulasExemplo() {
        console.log('🔄 Usando aulas de exemplo...');
        this.minhasAulas = [
            {
                id: 1,
                disciplina: 'Programação Web',
                sala_numero: 'A101',
                sala_bloco: 'A',
                curso: 'Sistemas de Informação',
                turma: 'SI1N',
                horario_inicio: '18:50',
                horario_fim: '19:40',
                dia_semana: 'segunda',
                ativa: true
            },
            {
                id: 2,
                disciplina: 'Banco de Dados',
                sala_numero: 'B201',
                sala_bloco: 'B',
                curso: 'Sistemas de Informação',
                turma: 'SI1N',
                horario_inicio: '19:40',
                horario_fim: '20:30',
                dia_semana: 'quarta',
                ativa: true
            }
        ];
        this.renderizarAulas();
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

    // 🔥 NOVA FUNÇÃO: Editar aula
    async editarAula(aulaId) {
        try {
            console.log('✏️ Editando aula:', aulaId);

            // Buscar dados da aula
            const aula = this.minhasAulas.find(a => a.id === aulaId);
            if (!aula) {
                throw new Error('Aula não encontrada');
            }

            // Mostrar modal de edição
            this.mostrarModalEdicaoAula(aula);

        } catch (error) {
            console.error('❌ Erro ao editar aula:', error);
            this.mostrarErro('Erro ao carregar dados da aula: ' + error.message);
        }
    }

    // 🔥 NOVA FUNÇÃO: Modal de edição
    mostrarModalEdicaoAula(aula) {
        console.log('🎯 Iniciando modal de edição para aula:', aula);

        const diasSemana = {
            1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta',
            'segunda': 'segunda', 'terca': 'terca', 'quarta': 'quarta',
            'quinta': 'quinta', 'sexta': 'sexta'
        };

        const diasSelecionados = Array.isArray(aula.dia_semana) ?
            aula.dia_semana :
            [aula.dia_semana].map(dia => diasSemana[dia]).filter(Boolean);

        const modalHTML = `
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
                        
                        <!-- CURSO, PERÍODO E TURMA -->
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

                        <!-- BUSCA E SELEÇÃO DE SALA -->
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

                        <!-- HORÁRIO -->
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

                        <!-- DIAS DA SEMANA -->
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
        </div>
    `;

        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Inicializar o modal com os dados da aula
        this.inicializarModalEdicao(aula);
    }

    async inicializarModalEdicao(aula) {
        try {
            console.log('🎯 Inicializando modal de edição com dados:', aula);

            // 1. Configurar curso, período e turma
            await this.configurarCursoPeriodoTurmaEdicao(aula);

            // 2. Configurar busca de salas
            await this.configurarSalasEdicao(aula.sala_id);

            // 3. Configurar horário
            this.configurarHorarioEdicao(aula.horario_inicio, aula.horario_fim);

            // 4. Configurar eventos
            this.configurarEventosEdicao();

            console.log('✅ Modal de edição inicializado com sucesso');

        } catch (error) {
            console.error('❌ Erro ao inicializar modal de edição:', error);
            this.mostrarErro('Erro ao carregar dados para edição: ' + error.message);
        }
    }

    async configurarCursoPeriodoTurmaEdicao(aula) {
        const cursoSelect = document.getElementById('editarCursoSelect');
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        const turmaSelect = document.getElementById('editarTurmaSelect');

        // Carregar cursos se necessário
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

        // Se a aula tem curso, habilitar período
        if (aula.curso) {
            this.habilitarPeriodoEdicao();
            await this.configurarPeriodoEdicao(aula);
        }

        // Configurar turma
        if (aula.curso && aula.turma) {
            await this.configurarTurmaEdicao(aula.curso, aula.turma);
        }
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

        // Encontrar o curso selecionado para saber total de períodos
        const selectedOption = cursoSelect.options[cursoSelect.selectedIndex];
        const totalPeriodos = selectedOption ? parseInt(selectedOption.getAttribute('data-total-periodos')) || 8 : 8;

        // Popular períodos
        periodoSelect.innerHTML = '<option value="">Selecione o período</option>';
        for (let i = 1; i <= totalPeriodos; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}° Período`;
            periodoSelect.appendChild(option);
        }

        // Tentar determinar o período baseado na turma (ex: "SI1N" -> período 1)
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
            // Carregar turmas para o curso e período
            await this.carregarTurmasPorCursoPeriodo(curso, periodoSelect.value);

            // Selecionar a turma atual
            if (turmaAtual) {
                turmaSelect.value = turmaAtual;
            }

        } catch (error) {
            console.error('❌ Erro ao configurar turma na edição:', error);
            this.desabilitarTurmaEdicaoComMensagem('Erro ao carregar turmas');
        }
    }

    async configurarSalasEdicao(salaIdAtual) {
        const salaSelect = document.getElementById('editarSalaSelect');
        const searchInput = document.getElementById('editarSearchSala');

        // Carregar salas se necessário
        if (this.salasDisponiveis.length === 0) {
            await this.carregarSalasDisponiveis();
        }

        // Popular select de salas
        salaSelect.innerHTML = '<option value="">Selecione a sala</option>' +
            this.salasDisponiveis.map(sala =>
                `<option value="${sala.id}" 
                     data-bloco="${sala.bloco}" 
                     data-tipo="${sala.tipo}"
                     ${sala.id === salaIdAtual ? 'selected' : ''}>
                ${sala.numero} - Bloco ${sala.bloco} (${sala.tipo}) - ${sala.capacidade} lugares
            </option>`
            ).join('');

        // Configurar busca de salas
        this.configurarBuscaSalasEdicao();

        // Preencher busca com sala selecionada
        if (salaIdAtual) {
            const selectedOption = salaSelect.options[salaSelect.selectedIndex];
            if (selectedOption && searchInput) {
                searchInput.value = selectedOption.textContent;
            }
        }
    }

    configurarBuscaSalasEdicao() {
        const searchInput = document.getElementById('editarSearchSala');
        const salaSelect = document.getElementById('editarSalaSelect');

        if (!searchInput || !salaSelect) return;

        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const options = salaSelect.getElementsByTagName('option');

            for (let i = 0; i < options.length; i++) {
                const text = options[i].textContent.toLowerCase();
                const shouldShow = text.includes(searchTerm);
                options[i].style.display = shouldShow ? '' : 'none';

                if (i === 0) options[i].style.display = ''; // Manter primeiro option
            }
        });

        salaSelect.addEventListener('change', function () {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption && searchInput) {
                searchInput.value = selectedOption.textContent;
            }
        });
    }

    configurarHorarioEdicao(horarioInicio, horarioFim) {
        const horarioSelect = document.getElementById('editarHorarioSelect');
        if (!horarioSelect) return;

        const horarioString = `${horarioInicio}-${horarioFim}`;
        horarioSelect.value = horarioString;
    }

    configurarEventosEdicao() {
        // Evento para curso
        const cursoSelect = document.getElementById('editarCursoSelect');
        cursoSelect.addEventListener('change', async (e) => {
            const periodoSelect = document.getElementById('editarPeriodoSelect');

            if (e.target.value) {
                this.habilitarPeriodoEdicao();
                await this.configurarPeriodoEdicao({});
            } else {
                periodoSelect.disabled = true;
                periodoSelect.innerHTML = '<option value="">Selecione o curso primeiro</option>';
                this.desabilitarTurmaEdicao();
            }
        });

        // Evento para período
        const periodoSelect = document.getElementById('editarPeriodoSelect');
        periodoSelect.addEventListener('change', async (e) => {
            const curso = document.getElementById('editarCursoSelect').value;

            if (curso && e.target.value) {
                await this.configurarTurmaEdicao(curso, '');
            } else {
                this.desabilitarTurmaEdicao();
            }
        });
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

    async carregarSalasParaEdicao(salaIdSelecionada) {
        try {
            const salaSelect = document.getElementById('editarSala');
            if (!salaSelect) return;
            const salas = this.salasDisponiveis.length > 0 ?
                this.salasDisponiveis :
                await this.carregarSalasParaModal();

            salaSelect.innerHTML = '<option value="">Selecione a sala</option>' +
                salas.map(sala => `
                <option value="${sala.id}" 
                    ${sala.id === salaIdSelecionada ? 'selected' : ''}
                    data-bloco="${sala.bloco}" 
                    data-tipo="${sala.tipo}">
                    ${sala.numero} - Bloco ${sala.bloco} (${sala.tipo}) - ${sala.capacidade} lugares
                </option>
            `).join('');

        } catch (error) {
            console.error('❌ Erro ao carregar salas para edição:', error);
            document.getElementById('editarSala').innerHTML = '<option value="">Erro ao carregar salas</option>';
        }
    }

    async carregarSalasParaModal() {
        try {
            const result = await api.getSalas();
            if (result?.success) {
                return result.data;
            }
            throw new Error('Erro ao carregar salas');
        } catch (error) {
            console.error('❌ Erro ao carregar salas para modal:', error);
            return [];
        }
    }

    async salvarEdicaoAula() {
        try {
            const aulaId = document.getElementById('editarAulaId').value;
            const form = document.getElementById('formEditarAula');

            console.log('💾 Iniciando salvamento da edição para aula:', aulaId);

            // Validar formulário
            if (!form.checkValidity()) {
                console.log('❌ Formulário inválido');
                form.reportValidity();
                return;
            }

            // Coletar dados do formulário
            const dadosAtualizados = {
                disciplina: document.getElementById('editarDisciplinaInput').value.trim(),
                sala_id: parseInt(document.getElementById('editarSalaSelect').value),
                curso: document.getElementById('editarCursoSelect').value,
                turma: document.getElementById('editarTurmaSelect').value,
                horario: document.getElementById('editarHorarioSelect').value
            };

            console.log('📋 Dados coletados para edição:', dadosAtualizados);

            // Validação básica
            if (!dadosAtualizados.curso) {
                this.mostrarErro('❌ Selecione um curso');
                return;
            }
            if (!dadosAtualizados.turma) {
                this.mostrarErro('❌ Selecione uma turma');
                return;
            }
            if (!dadosAtualizados.sala_id) {
                this.mostrarErro('❌ Selecione uma sala');
                return;
            }
            if (!dadosAtualizados.disciplina) {
                this.mostrarErro('❌ Digite o nome da disciplina');
                return;
            }
            if (!dadosAtualizados.horario) {
                this.mostrarErro('❌ Selecione um horário');
                return;
            }

            // Validar dias da semana
            const diasSelecionados = Array.from(document.querySelectorAll('input[name="editarDias"]:checked'))
                .map(cb => cb.value);

            console.log('📅 Dias selecionados na edição:', diasSelecionados);
            if (diasSelecionados.length === 0) {
                this.mostrarErro('❌ Selecione pelo menos um dia da semana');
                return;
            }

            // Processar horário
            if (dadosAtualizados.horario) {
                const [horario_inicio, horario_fim] = dadosAtualizados.horario.split('-');
                dadosAtualizados.horario_inicio = horario_inicio.trim();
                dadosAtualizados.horario_fim = horario_fim.trim();
                delete dadosAtualizados.horario;
            }

            // Mostrar loading
            const submitBtn = document.querySelector('#formEditarAula ~ .modal-footer .btn-primary');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            submitBtn.disabled = true;

            console.log('🚀 Chamando atualização da aula...');

            // Chamar API para atualizar
            await this.atualizarAulaNoBackend(aulaId, dadosAtualizados, diasSelecionados);

        } catch (error) {
            console.error('❌ Erro ao salvar edição:', error);
            this.mostrarErro('Erro ao salvar alterações: ' + error.message);

            // Reativar botão em caso de erro
            const submitBtn = document.querySelector('#formEditarAula ~ .modal-footer .btn-primary');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
                submitBtn.disabled = false;
            }
        }
    }

    validarDadosEdicao(dados) {
        const erros = [];

        if (!dados.disciplina || dados.disciplina.trim().length < 3) {
            erros.push('Disciplina deve ter pelo menos 3 caracteres');
        }

        if (!dados.sala_id) {
            erros.push('Selecione uma sala');
        }

        if (!dados.curso) {
            erros.push('Curso é obrigatório');
        }

        if (!dados.turma) {
            erros.push('Turma é obrigatória');
        }

        if (!dados.horario_inicio || !dados.horario_fim) {
            erros.push('Horários de início e fim são obrigatórios');
        } else {
            const inicio = new Date(`2000-01-01T${dados.horario_inicio}`);
            const fim = new Date(`2000-01-01T${dados.horario_fim}`);

            if (inicio >= fim) {
                erros.push('Horário de início deve ser antes do horário de fim');
            }
        }

        return erros;
    }

    // 🔥 CORREÇÃO: Método atualizado para usar a rota PUT
    async atualizarAulaNoBackend(aulaId, dados, diasSelecionados) {
        try {
            // Converter dias para números (usar apenas o primeiro dia por enquanto)
            const diaParaNumero = {
                'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5
            };

            const dadosCompletos = {
                ...dados,
                dia_semana: diaParaNumero[diasSelecionados[0]] // Por enquanto, usa apenas o primeiro dia
            };

            console.log('💾 Enviando dados para atualização:', dadosCompletos);

            const result = await api.atualizarAula(aulaId, dadosCompletos);

            if (result?.success) {
                console.log('✅ Aula atualizada com sucesso');
                return result;
            } else {
                throw new Error(result?.error || 'Erro ao atualizar aula');
            }
        } catch (error) {
            console.error('❌ Erro na atualização:', error);
            throw new Error('Erro ao atualizar aula: ' + error.message);
        }
    }

    criarCardAula(aula) {
        const status = this.getStatusAula(aula);
        const dias = this.formatarDiasSemana(aula.dia_semana);

        // 🔥 CORREÇÃO: Verificar corretamente se a aula está cancelada
        // No SQLite, valores booleanos podem vir como 0/1 ou true/false
        const isCancelada = aula.ativa === 0 || aula.ativa === false ||
            aula.status === 'cancelada' || aula.cancelada === true;

        console.log(`🎯 Renderizando aula ${aula.id}: ${aula.disciplina}, ativa: ${aula.ativa}, cancelada: ${isCancelada}`);

        return `
        <div class="professor-aula-card ${isCancelada ? 'aula-cancelada' : ''}" 
             data-aula-id="${aula.id}" 
             onclick="professorManager.verDetalhesAula(${aula.id})">
            
            <div class="professor-aula-card-content">
                <div class="professor-aula-header">
                    <h3>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h3>
                    <span class="professor-status-badge ${isCancelada ? 'status-cancelada' : status.classe}">
                        <i class="fas ${isCancelada ? 'fa-ban' : status.icone}"></i> 
                        ${isCancelada ? 'Cancelada' : status.texto}
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
                    ${isCancelada ? `
                    <div class="professor-info-item">
                        <span class="professor-icon"><i class="fas fa-calendar-times"></i></span>
                        <span style="color: #dc3545; font-weight: 600;">AULA CANCELADA</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="professor-aula-actions" onclick="event.stopPropagation()">
                ${!isCancelada ? `
                    <!-- Aula ATIVA -->
                    <button class="professor-btn-action editar" onclick="professorManager.editarAula(${aula.id})">
                        <i class="fas fa-edit"></i>
                        <span>Editar</span>
                    </button>
                    <button class="professor-btn-action secundario" onclick="professorManager.abrirMapaSala('${aula.sala_bloco}', ${aula.sala_andar || 1}, '${aula.sala_numero}')">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Localizar</span>
                    </button>
                    <button class="professor-btn-action cancelar" onclick="professorManager.cancelarAula(${aula.id})">
                        <i class="fas fa-ban"></i>
                        <span>Cancelar</span>
                    </button>
                    <button class="professor-btn-action perigo" onclick="professorManager.excluirAula(${aula.id})">
                        <i class="fas fa-trash"></i>
                        <span>Excluir</span>
                    </button>
                ` : `
                    <!-- Aula CANCELADA -->
                    <button class="professor-btn-action reativar" onclick="professorManager.reativarAula(${aula.id})">
                        <i class="fas fa-undo"></i>
                        <span>Reativar</span>
                    </button>
                    <button class="professor-btn-action perigo" onclick="professorManager.excluirAula(${aula.id})">
                        <i class="fas fa-trash"></i>
                        <span>Excluir</span>
                    </button>
                `}
            </div>
        </div>
    `;
    }

    async criarAula(dadosAula, diasSelecionados) {
        try {
            console.log('📝 Validando e criando nova aula:', dadosAula);
            console.log('📅 Dias recebidos:', diasSelecionados);

            const erros = this.validarFormularioAula(dadosAula);
            if (erros.length > 0) {
                this.mostrarErro('Erros no formulário:\n' + erros.join('\n'));
                return;
            }

            const diasFormatados = diasSelecionados.join(',');

            const dadosFormatados = {
                disciplina: dadosAula.disciplina,
                sala_id: parseInt(dadosAula.sala_id),
                curso: dadosAula.curso,
                turma: dadosAula.turma,
                horario_inicio: dadosAula.horario_inicio,
                horario_fim: dadosAula.horario_fim,
                dia_semana: diasFormatados
            };

            console.log('📤 Enviando dados da aula:', dadosFormatados);
            const result = await api.criarAula(dadosFormatados);

            if (result?.success) {
                console.log('✅ Aula criada com sucesso!');
                this.mostrarSucesso(`Aula criada com sucesso para os dias: ${diasSelecionados.join(', ')}`);

                await this.carregarMinhasAulas();
                showSection('minhas-aulas-professor');
                document.getElementById('formCriarAula')?.reset();
                this.cache.clear();

            } else {
                const mensagemErro = result?.error || 'Erro desconhecido ao criar aula';
                throw new Error(mensagemErro);
            }

        } catch (error) {
            console.error('❌ Erro ao criar aula:', error);
            this.mostrarErro(this.tratarErroAula(error));
        }
    }

    async cancelarAula(aulaId) {
        if (!confirm('Tem certeza que deseja cancelar esta aula? Os alunos serão notificados.')) {
            return;
        }

        try {
            console.log('🚫 Cancelando aula:', aulaId);

            // Mostrar loading
            this.mostrarLoadingBotao(aulaId, 'cancelar');

            const result = await api.cancelarAula(aulaId);

            if (result?.success) {
                console.log('✅ Aula cancelada com sucesso! ID:', aulaId);
                this.mostrarSucesso('Aula cancelada com sucesso!');

                // Recarregar as aulas para ver a atualização
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
        if (!confirm('Tem certeza que deseja reativar esta aula?')) {
            return;
        }

        try {
            console.log('🔄 Reativando aula:', aulaId);

            // Mostrar loading
            this.mostrarLoadingBotao(aulaId, 'reativar');

            const result = await api.reativarAula(aulaId);

            if (result?.success) {
                console.log('✅ Aula reativada com sucesso! ID:', aulaId);
                this.mostrarSucesso('Aula reativada com sucesso!');

                // Recarregar as aulas para ver a atualização
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
            if (originalHTML) {
                botao.innerHTML = originalHTML;
            }
            botao.disabled = false;
        });
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

        if (dados.horario_inicio && dados.horario_fim) {
            const inicio = new Date(`2000-01-01T${dados.horario_inicio}`);
            const fim = new Date(`2000-01-01T${dados.horario_fim}`);

            if (inicio >= fim) {
                erros.push('Horário de início deve ser antes do horário de fim');
            }
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
        // Se a aula está cancelada
        if (aula.status === 'cancelada' || aula.cancelada || !aula.ativa) {
            return { classe: 'cancelada', texto: 'Cancelada', icone: 'fa-ban' };
        }

        // Lógica original para determinar status da aula ativa
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
        const status = this.getStatusAula(aula);
        const dias = this.formatarDiasSemana(aula.dia_semana);
        const isCancelada = aula.status === 'cancelada' || aula.cancelada || !aula.ativa;

        const modalHTML = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal-content modal-large" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-info-circle"></i> Detalhes da Aula</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="aula-detalhes-grid">
                        <div class="detalhe-item">
                            <label><i class="fas fa-book"></i> Disciplina:</label>
                            <span>${aula.disciplina || aula.disciplina_nome || 'N/A'}</span>
                        </div>
                        <div class="detalhe-item">
                            <label><i class="fas fa-graduation-cap"></i> Curso:</label>
                            <span>${aula.curso || 'N/A'}</span>
                        </div>
                        <div class="detalhe-item">
                            <label><i class="fas fa-users"></i> Turma:</label>
                            <span>${aula.turma || 'N/A'}</span>
                        </div>
                        <div class="detalhe-item">
                            <label><i class="fas fa-door-open"></i> Sala:</label>
                            <span>Sala ${aula.sala_numero} - Bloco ${aula.sala_bloco}</span>
                        </div>
                        <div class="detalhe-item">
                            <label><i class="fas fa-clock"></i> Horário:</label>
                            <span>${aula.horario_inicio} - ${aula.horario_fim}</span>
                        </div>
                        <div class="detalhe-item">
                            <label><i class="fas fa-calendar-day"></i> Dias:</label>
                            <span>${dias}</span>
                        </div>
                        <div class="detalhe-item">
                            <label><i class="fas fa-info-circle"></i> Status:</label>
                            <span class="status-badge ${isCancelada ? 'status-cancelada' : status.classe}">
                                <i class="fas ${isCancelada ? 'fa-ban' : status.icone}"></i>
                                ${isCancelada ? 'Cancelada' : status.texto}
                            </span>
                        </div>
                        ${aula.descricao ? `
                        <div class="detalhe-item full-width">
                            <label><i class="fas fa-file-alt"></i> Descrição:</label>
                            <span>${aula.descricao}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-fechar" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i> Fechar
                    </button>
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