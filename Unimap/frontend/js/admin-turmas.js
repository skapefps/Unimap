class AdminTurmas {
    constructor() {
        this.turmas = [];
        this.alunos = [];
        this.turmaEditando = null;
        this.carregando = false;
        this.inicializado = false;
        this.cursosComPeriodos = {};
        this.cursosDisponiveis = [];
        this.alunosVinculadosInicialmente = new Set();
    }

    async carregarCursosDoBanco() {
        try {
            console.log('📚 Carregando cursos para turmas...');

            const response = await this.makeRequest('/cursos-com-periodos');

            if (response.success) {
                this.cursosComPeriodos = {};
                this.cursosDisponiveis = [];

                console.log('📊 Cursos recebidos da API:', response.data);

                response.data.forEach(curso => {
                    this.cursosComPeriodos[curso.nome] = curso.total_periodos || 8;
                    this.cursosDisponiveis.push(curso.nome);
                });

                console.log(`✅ ${this.cursosDisponiveis.length} cursos carregados para turmas:`, this.cursosDisponiveis);
                this.popularCursosNoModalTurma();
            } else {
                throw new Error(response.error || 'Erro ao carregar cursos');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar cursos para turmas:', error);
            this.usarCursosFallbackTurmas();
        }
    }

    usarCursosFallbackTurmas() {
        console.log('🔄 Usando cursos fallback para turmas...');
        const cursosFallback = {
            'Sistemas de Informação': 8,
            'Administração': 8,
            'Direito': 10,
            'Medicina': 12,
            'Engenharia Civil': 10
        };

        this.cursosComPeriodos = cursosFallback;
        this.cursosDisponiveis = Object.keys(cursosFallback);
        this.popularCursosNoModalTurma();
    }

    popularCursosNoModalTurma() {
        const selectCurso = document.getElementById('turmaCurso');
        if (!selectCurso) {
            console.log('❌ Elemento turmaCurso não encontrado');
            return;
        }

        console.log('📝 Populando cursos no modal de turma...');
        console.log('📋 Cursos disponíveis:', this.cursosDisponiveis);

        selectCurso.innerHTML = '<option value="">Selecione o curso</option>';

        this.cursosDisponiveis.forEach(curso => {
            const option = document.createElement('option');
            option.value = curso;
            option.textContent = curso;
            selectCurso.appendChild(option);
        });

        console.log(`✅ ${this.cursosDisponiveis.length} cursos adicionados ao modal de turma`);
    }

    atualizarPeriodosTurma(cursoSelecionado) {
        const selectPeriodo = document.getElementById('turmaPeriodo');
        if (!selectPeriodo) {
            console.log('❌ Elemento turmaPeriodo não encontrado');
            return;
        }

        console.log(`🔄 Atualizando períodos para o curso: ${cursoSelecionado}`);

        selectPeriodo.innerHTML = '<option value="">Selecione o período</option>';

        if (cursoSelecionado && this.cursosComPeriodos[cursoSelecionado]) {
            const totalPeriodos = this.cursosComPeriodos[cursoSelecionado];

            console.log(`📚 Curso ${cursoSelecionado} tem ${totalPeriodos} períodos`);

            for (let i = 1; i <= totalPeriodos; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${i}° Período`;
                selectPeriodo.appendChild(option);
            }

            console.log(`✅ Gerados ${totalPeriodos} períodos para ${cursoSelecionado}`);
        } else {
            console.log('❌ Curso não encontrado ou sem períodos definidos:', cursoSelecionado);
        }
    }

    async init() {
        if (this.inicializado) {
            console.log('✅ AdminTurmas já foi inicializado');
            return;
        }

        try {
            console.log('🚀 Inicializando AdminTurmas...');

            await this.carregarCursosDoBanco();

            await this.carregarTurmas();
            await this.carregarAlunos();
            this.setupEventListeners();
            this.setupModalEventListeners();
            this.inicializado = true;
            console.log('✅ AdminTurmas inicializado com sucesso');

        } catch (error) {
            console.error('❌ Erro na inicialização do AdminTurmas:', error);
            this.showNotification('Erro ao carregar dados do sistema', 'error');
        }
    }

    async makeRequest(endpoint, options = {}) {
        const token = localStorage.getItem('authToken');

        if (!token) {
            this.showNotification('Usuário não autenticado', 'error');
            throw new Error('Usuário não autenticado');
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(`/api${endpoint}`, mergedOptions);

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            console.log(`📡 API Response [${endpoint}]:`, data);

            if (!response.ok) {
                throw new Error(typeof data === 'object' ? (data.error || `Erro ${response.status}`) : `Erro ${response.status}`);
            }

            return {
                success: true,
                data: data,
                message: typeof data === 'object' ? data.message : 'Sucesso'
            };
        } catch (error) {
            console.error(`❌ Erro na requisição ${endpoint}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async carregarTurmas() {
        try {
            console.log('📚 Carregando turmas do banco (ativas e inativas)...');

            const response = await this.makeRequest('/turmas');
            console.log('📡 Resposta bruta da API:', response);

            if (response && response.success) {
                this.turmas = this.processarTurmas(response.data || []);
                console.log('✅ Turmas processadas (ativas e inativas):', this.turmas);

                console.log('🔄 Sincronizando quantidades...');
                for (const turma of this.turmas) {
                    await this.atualizarQuantidadeAlunosTurma(turma.id);
                }

                this.renderizarTurmas();
                this.atualizarEstatisticasTurmas();
            } else {
                throw new Error('Erro ao carregar turmas');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar turmas:', error);
            this.showNotification('Erro ao carregar turmas do banco', 'error');
            this.turmas = [];
            this.renderizarTurmas();
        }
    }

    processarTurmas(turmasData) {
        if (!Array.isArray(turmasData)) {
            console.warn('⚠️ Dados de turmas não são um array:', turmasData);
            return [];
        }

        return turmasData.map(turma => ({
            id: turma.id,
            nome: turma.nome || 'Turma sem nome',
            curso_id: turma.curso_id || null,
            curso: turma.curso || 'Curso não definido',
            periodo: turma.periodo || 1,
            ano: turma.ano || new Date().getFullYear(),
            quantidade_alunos: turma.quantidade_alunos || 0,
            ativa: turma.ativa !== undefined ? Boolean(turma.ativa) : true,
        }));
    }

    async carregarAlunos() {
        try {
            console.log('👥 Carregando alunos do banco...');

            const response = await this.makeRequest('/usuarios?tipo=aluno');

            if (response && response.success) {
                let alunosArray = [];

                if (Array.isArray(response.data)) {
                    alunosArray = response.data;
                } else if (response.data && Array.isArray(response.data.data)) {
                    alunosArray = response.data.data;
                } else if (response.data && Array.isArray(response.data.usuarios)) {
                    alunosArray = response.data.usuarios;
                } else {
                    console.warn('⚠️ Estrutura inesperada, usando resposta direta');
                    alunosArray = response.data || [];
                }

                this.alunos = alunosArray;
                console.log('✅ Alunos carregados via API:', this.alunos.length);
            } else {
                throw new Error('Erro ao carregar alunos');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar alunos:', error);
            this.showNotification('Erro ao carregar alunos do banco', 'error');
            this.alunos = [];
        }
    }

    filtrarTurmas(status) {
        try {
            console.log(`🔍 Filtrando turmas por status: ${status}`);

            const tbody = document.getElementById('turmas-body');
            if (!tbody) return;

            const linhas = tbody.querySelectorAll('tr:not(.categoria-turma)');

            linhas.forEach(linha => {
                const isInativa = linha.classList.contains('turma-inativa');
                const categoria = linha.closest('tr.categoria-turma');

                switch (status) {
                    case 'ativas':
                        linha.style.display = !isInativa ? '' : 'none';
                        if (categoria && categoria.textContent.includes('Inativas')) {
                            categoria.style.display = 'none';
                        }
                        break;
                    case 'inativas':
                        linha.style.display = isInativa ? '' : 'none';
                        if (categoria && categoria.textContent.includes('Ativas')) {
                            categoria.style.display = 'none';
                        }
                        break;
                    case 'todas':
                    default:
                        linha.style.display = '';
                        if (categoria) {
                            categoria.style.display = '';
                        }
                        break;
                }
            });

            console.log(`✅ Filtro aplicado: ${status}`);
        } catch (error) {
            console.error('❌ Erro ao filtrar turmas:', error);
        }
    }

    renderizarTurmas() {
        console.log('🎯 Renderizando turmas (ativas e inativas)...');
        console.log('📊 Dados das turmas antes da renderização:', this.turmas.map(t => ({
            id: t.id,
            nome: t.nome,
            quantidade: t.quantidade_alunos,
            ativa: t.ativa
        })));

        const tbody = document.getElementById('turmas-body');
        if (!tbody) {
            console.log('ℹ️ Tabela de turmas não encontrada');
            return;
        }

        if (!Array.isArray(this.turmas) || this.turmas.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Nenhuma turma cadastrada</p>
                    <button onclick="adminTurmas.abrirModalCriarTurma()" class="btn-primary" style="margin-top: 10px;">
                        <i class="fas fa-plus"></i> Criar Primeira Turma
                    </button>
                </td>
            </tr>
        `;
            return;
        }

        const turmasAtivas = this.turmas.filter(t => t.ativa);
        const turmasInativas = this.turmas.filter(t => !t.ativa);

        let html = '';

        if (turmasAtivas.length > 0) {
            html += `
            <tr class="categoria-turma">
                <td colspan="7" class="categoria-header">
                    <i class="fas fa-check-circle text-success"></i>
                    <strong>Turmas Ativas</strong>
                    <span class="badge active">${turmasAtivas.length} turma(s)</span>
                </td>
            </tr>
        `;

            html += turmasAtivas.map(turma => this.criarLinhaTurma(turma)).join('');
        }

        if (turmasInativas.length > 0) {
            html += `
            <tr class="categoria-turma">
                <td colspan="7" class="categoria-header">
                    <i class="fas fa-pause-circle text-warning"></i>
                    <strong>Turmas Inativas</strong>
                    <span class="badge inactive">${turmasInativas.length} turma(s)</span>
                </td>
            </tr>
        `;

            html += turmasInativas.map(turma => this.criarLinhaTurma(turma)).join('');
        }

        tbody.innerHTML = html;

        this.atualizarEstatisticasTurmas();

        console.log('✅ Turmas renderizadas:', {
            ativas: turmasAtivas.length,
            inativas: turmasInativas.length,
            total: this.turmas.length
        });
    }

    criarLinhaTurma(turma) {
        const isInativa = !turma.ativa;
        const classeLinha = isInativa ? 'turma-inativa' : '';

        return `
        <tr class="${classeLinha}">
            <td>
                <div class="turma-info">
                    <strong class="${isInativa ? 'text-muted' : ''}">${this.escapeHtml(turma.nome)}</strong>
                    ${isInativa ? '<div class="status-inativo"><i class="fas fa-pause"></i> Inativa</div>' : ''}
                </div>
            </td>
            <td class="${isInativa ? 'text-muted' : ''}">${this.escapeHtml(turma.curso)}</td>
            <td class="${isInativa ? 'text-muted' : ''}">${turma.periodo}° Período</td>
            <td>
                <span class="badge ${turma.quantidade_alunos > 0 ? 'active' : 'inactive'} ${isInativa ? 'badge-inativo' : ''}">
                    ${turma.quantidade_alunos || 0} alunos
                </span>
            </td>
            <td class="${isInativa ? 'text-muted' : ''}">${turma.ano}</td>
            <td>
                <span class="badge ${turma.ativa ? 'active' : 'inactive'}">
                    ${turma.ativa ? 'Ativa' : 'Inativa'}
                </span>
            </td>
            <td>
                <div class="acoes-turma">
                    <button class="btn-action small ${isInativa ? 'disabled' : ''}" 
                            onclick="adminTurmas.vincularAlunosTurma(${turma.id})" 
                            title="${isInativa ? 'Turma inativa - não é possível vincular alunos' : 'Vincular alunos'}" 
                            ${isInativa ? 'disabled' : ''}>
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn-action small secundario ${isInativa ? 'disabled' : ''}" 
                            onclick="adminTurmas.abrirModalGerenciarVinculos(${turma.id})"
                            title="${isInativa ? 'Turma inativa' : 'Gerenciar alunos vinculados'}" 
                            ${isInativa || turma.quantidade_alunos === 0 ? 'disabled' : ''}>
                        <i class="fas fa-users-cog"></i>
                    </button>
                    <button class="btn-action small" 
                            onclick="adminTurmas.editarTurma(${turma.id})" 
                            title="Editar turma">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action small secundario" 
                            onclick="adminTurmas.verAlunosTurma(${turma.id})"
                            title="Ver alunos da turma">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="btn-action small perigo ${isInativa ? 'disabled' : ''}" 
                            onclick="adminTurmas.desvincularTodosAlunos(${turma.id})"
                            title="${isInativa ? 'Turma inativa' : 'Desvincular todos os alunos'}" 
                            ${isInativa || turma.quantidade_alunos === 0 ? 'disabled' : ''}>
                        <i class="fas fa-users-slash"></i>
                    </button>
                    <button class="btn-action small perigo" 
                            onclick="adminTurmas.excluirTurma(${turma.id})"
                            title="${turma.ativa && turma.quantidade_alunos > 0 ? 'Não é possível excluir turma ativa com alunos vinculados' : (turma.quantidade_alunos > 0 ? 'Excluir turma inativa (primeiro desvincule os alunos)' : 'Excluir turma')}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }

    atualizarEstatisticasTurmas() {
        try {
            if (!Array.isArray(this.turmas)) {
                console.warn('⚠️ Turmas não é um array:', this.turmas);
                return;
            }

            const totalTurmas = this.turmas.length;
            const totalAlunosVinculados = this.turmas.reduce((total, turma) => total + (turma.quantidade_alunos || 0), 0);
            const turmasComAlunos = this.turmas.filter(turma => (turma.quantidade_alunos || 0) > 0).length;
            const turmasAtivas = this.turmas.filter(turma => turma.ativa).length;
            const turmasInativas = this.turmas.filter(turma => !turma.ativa).length;

            const totalTurmasEl = document.getElementById('total-turmas');
            const totalAlunosVinculadosEl = document.getElementById('total-alunos-vinculados');
            const turmasComAlunosEl = document.getElementById('turmas-com-alunos');
            const turmasAtivasEl = document.getElementById('turmas-ativas');
            const turmasInativasEl = document.getElementById('turmas-inativas');

            if (totalTurmasEl) totalTurmasEl.textContent = totalTurmas;
            if (totalAlunosVinculadosEl) totalAlunosVinculadosEl.textContent = totalAlunosVinculados;
            if (turmasComAlunosEl) turmasComAlunosEl.textContent = turmasComAlunos;
            if (turmasAtivasEl) turmasAtivasEl.textContent = turmasAtivas;
            if (turmasInativasEl) turmasInativasEl.textContent = turmasInativas;

            console.log('📊 Estatísticas de turmas atualizadas:', {
                totalTurmas,
                totalAlunosVinculados,
                turmasComAlunos,
                turmasAtivas,
                turmasInativas
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas de turmas:', error);
        }
    }

    abrirModalCriarTurma() {
        try {
            this.turmaEditando = null;

            const modalTitle = document.getElementById('turmaModalTitle');
            const turmaIdInput = document.getElementById('turmaId');
            const turmaForm = document.getElementById('turmaForm');
            const modal = document.getElementById('turmaModal');

            if (!modal) {
                console.error('❌ Modal não encontrado no DOM');
                this.criarModalTurmaFallback();
                return;
            }

            if (modalTitle) modalTitle.textContent = 'Nova Turma';
            if (turmaIdInput) turmaIdInput.value = '';
            if (turmaForm) turmaForm.reset();

            this.popularCursosNoModalTurma();

            modal.style.display = 'flex';
            this.prepararModalMobile(modal);

        } catch (error) {
            console.error('❌ Erro ao abrir modal de criação:', error);
            this.criarModalTurmaFallback();
        }
    }

    async criarModalVincularAlunosFallback() {
        console.log('🔄 Criando modal de vínculo fallback...');

        const modalId = 'vincularAlunosModal';

        const modalExistente = document.getElementById(modalId);
        if (modalExistente) {
            modalExistente.remove();
        }

        const modalHTML = `
        <div class="modal-overlay" id="${modalId}" style="display: none;">
            <div class="modal-content large" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> Gerenciar Alunos da Turma</h3>
                    <button class="modal-close" onclick="adminTurmas.fecharModalVincularAlunos()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Turma Selecionada:</label>
                        <h4 id="turmaSelecionadaNome" style="margin: 0; color: #2c3e50;"></h4>
                        <p id="turmaSelecionadaCurso" style="margin: 5px 0 0 0; color: #7f8c8d;"></p>
                        <small class="text-info">
                            <i class="fas fa-info-circle"></i> 
                            Alunos já vinculados aparecem selecionados. Ao desmarcá-los, serão automaticamente desvinculados.
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Buscar Alunos:</label>
                        <input type="text" id="buscarAlunosTurma" class="form-control" 
                               placeholder="Digite o nome, matrícula ou email...">
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="selecionarTodosAlunos"> 
                            Selecionar todos os alunos disponíveis
                        </label>
                    </div>
                    
                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th width="50px">Sel.</th>
                                    <th>Nome</th>
                                    <th>Matrícula</th>
                                    <th>Email</th>
                                    <th>Curso</th>
                                    <th>Turma Atual</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="listaAlunosTurma">
                                <!-- Lista de alunos será renderizada aqui -->
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="btn-group">
                        <button type="button" class="btn-primary" onclick="adminTurmas.vincularAlunosSelecionados()">
                            <i class="fas fa-link"></i> Vincular Alunos Selecionados
                        </button>
                        <button type="button" class="btn-secondary" onclick="adminTurmas.fecharModalVincularAlunos()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        console.log('✅ Modal de vínculo fallback criado');
    }

    criarModalTurmaFallback() {
        console.log('🔄 Criando modal de turma fallback...');

        const modalHTML = `
        <div class="modal-overlay" id="turmaModal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-users-class"></i> Nova Turma</h3>
                    <button class="modal-close" onclick="adminTurmas.fecharModalTurma()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="turmaForm">
                        <input type="hidden" id="turmaId" value="">
                        
                        <div class="form-group">
                            <label>Nome da Turma:</label>
                            <input type="text" id="turmaNome" required class="form-control" 
                                   placeholder="Ex: SI-2024-1A">
                        </div>
                        
                        <div class="form-group">
                            <label>Curso:</label>
                            <select id="turmaCurso" required class="form-control">
                                <option value="">Selecione o curso</option>
                                <option value="Sistemas de Informação">Sistemas de Informação</option>
                                <option value="Administração">Administração</option>
                                <option value="Direito">Direito</option>
                                <option value="Engenharia Civil">Engenharia Civil</option>
                                <option value="Medicina">Medicina</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Período:</label>
                            <select id="turmaPeriodo" required class="form-control">
                                <option value="">Selecione o período</option>
                                ${[1, 2, 3, 4, 5, 6, 7, 8].map(p =>
            `<option value="${p}">${p}° Período</option>`
        ).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Ano:</label>
                            <input type="number" id="turmaAno" required class="form-control" 
                                   min="2020" max="2030" value="2024">
                        </div>
                        
                        <div class="form-group">
                            <label>Status:</label>
                            <select id="turmaAtiva" class="form-control">
                                <option value="true" selected>Ativa</option>
                                <option value="false">Inativa</option>
                            </select>
                        </div>
                        
                        <div class="btn-group">
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Salvar Turma
                            </button>
                            <button type="button" class="btn-secondary" onclick="adminTurmas.fecharModalTurma()">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

        const modalExistente = document.getElementById('turmaModal');
        if (modalExistente) {
            modalExistente.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const turmaForm = document.getElementById('turmaForm');
        if (turmaForm) {
            turmaForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarTurma(e);
            });
        }
    }

    async editarTurma(turmaId) {
        try {
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            this.turmaEditando = turma;

            const modal = document.getElementById('turmaModal');
            if (!modal) {
                console.log('ℹ️ Modal não encontrado, criando dinamicamente...');
                await this.criarModalEdicaoFallback(turma);
                return;
            }

            const modalTitle = document.getElementById('turmaModalTitle');
            const turmaIdInput = document.getElementById('turmaId');
            const turmaNomeInput = document.getElementById('turmaNome');
            const turmaCursoInput = document.getElementById('turmaCurso');
            const turmaPeriodoInput = document.getElementById('turmaPeriodo');
            const turmaAnoInput = document.getElementById('turmaAno');
            const turmaAtivaInput = document.getElementById('turmaAtiva');

            if (!turmaNomeInput || !turmaCursoInput) {
                console.warn('⚠️ Campos do formulário não encontrados, criando modal fallback');
                await this.criarModalEdicaoFallback(turma);
                return;
            }

            this.popularCursosNoModalTurma();

            if (modalTitle) modalTitle.textContent = 'Editar Turma';
            if (turmaIdInput) turmaIdInput.value = turma.id;
            if (turmaNomeInput) turmaNomeInput.value = turma.nome || '';

            if (turmaCursoInput && turma.curso) {
                turmaCursoInput.value = turma.curso;
                this.atualizarPeriodosTurma(turma.curso);

                if (turmaPeriodoInput && turma.periodo) {
                    setTimeout(() => {
                        if (turmaPeriodoInput) {
                            turmaPeriodoInput.value = turma.periodo;
                        }
                    }, 100);
                }
            }

            if (turmaAnoInput) turmaAnoInput.value = turma.ano || new Date().getFullYear();
            if (turmaAtivaInput) turmaAtivaInput.value = turma.ativa ? 'true' : 'false';

            modal.style.display = 'flex';
            this.prepararModalMobile(modal);

        } catch (error) {
            console.error('❌ Erro ao abrir edição da turma:', error);
            this.showNotification('Erro ao carregar dados da turma: ' + error.message, 'error');

            if (this.turmaEditando) {
                await this.criarModalEdicaoFallback(this.turmaEditando);
            }
        }
    }
    async criarModalEdicaoFallback(turma) {
        try {
            console.log('🔄 Criando modal de edição fallback...');

            const modalExistente = document.getElementById('turmaModal');
            if (modalExistente) {
                modalExistente.remove();
            }

            let opcoesPeriodo = '';
            const totalPeriodos = this.cursosComPeriodos[turma.curso] || 8;

            for (let i = 1; i <= totalPeriodos; i++) {
                opcoesPeriodo += `<option value="${i}" ${turma.periodo == i ? 'selected' : ''}>${i}° Período</option>`;
            }

            const modalHTML = `
            <div class="modal-overlay" id="turmaModal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-users-class"></i> Editar Turma</h3>
                        <button class="modal-close" onclick="adminTurmas.fecharModalTurma()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="turmaForm">
                            <input type="hidden" id="turmaId" value="${turma.id}">
                            
                            <div class="form-group">
                                <label>Nome da Turma:</label>
                                <input type="text" id="turmaNome" required class="form-control" 
                                       value="${this.escapeHtml(turma.nome || '')}" placeholder="Ex: SI-2024-1A">
                            </div>
                            
                            <!-- 🔥 CURSO DINÂMICO -->
                            <div class="form-group">
                                <label>Curso:</label>
                                <select id="turmaCurso" required class="form-control" onchange="adminTurmas.atualizarPeriodosTurma(this.value)">
                                    <option value="">Selecione o curso</option>
                                    ${this.cursosDisponiveis.map(curso =>
                `<option value="${curso}" ${turma.curso === curso ? 'selected' : ''}>${curso}</option>`
            ).join('')}
                                </select>
                            </div>
                            
                            <!-- 🔥 PERÍODO DINÂMICO -->
                            <div class="form-group">
                                <label>Período:</label>
                                <select id="turmaPeriodo" required class="form-control">
                                    <option value="">Selecione o período</option>
                                    ${opcoesPeriodo}
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Ano:</label>
                                <input type="number" id="turmaAno" required class="form-control" 
                                       min="2020" max="2030" value="${turma.ano || 2024}">
                            </div>
                            
                            <div class="form-group">
                                <label>Status:</label>
                                <select id="turmaAtiva" class="form-control">
                                    <option value="true" ${turma.ativa ? 'selected' : ''}>Ativa</option>
                                    <option value="false" ${!turma.ativa ? 'selected' : ''}>Inativa</option>
                                </select>
                            </div>
                            
                            <div class="btn-group">
                                <button type="submit" class="btn-primary">
                                    <i class="fas fa-save"></i> Salvar Turma
                                </button>
                                <button type="button" class="btn-secondary" onclick="adminTurmas.fecharModalTurma()">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            const turmaForm = document.getElementById('turmaForm');
            if (turmaForm) {
                turmaForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.salvarTurma(e);
                });
            }

            this.prepararModalMobile(document.getElementById('turmaModal'));

        } catch (error) {
            console.error('❌ Erro ao criar modal fallback:', error);
            this.showNotification('Erro crítico: Não foi possível abrir a edição da turma', 'error');
        }
    }
    validarCursoEPeriodo(curso, periodo) {
        if (!curso) {
            return { valido: false, erro: 'Curso é obrigatório' };
        }

        if (!periodo) {
            return { valido: false, erro: 'Período é obrigatório' };
        }

        const totalPeriodos = this.cursosComPeriodos[curso];
        if (totalPeriodos && periodo > totalPeriodos) {
            return {
                valido: false,
                erro: `O curso ${curso} tem apenas ${totalPeriodos} períodos. Período ${periodo} é inválido.`
            };
        }

        return { valido: true };
    }

    fecharModalTurma() {
        const modal = document.getElementById('turmaModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
        this.turmaEditando = null;
        document.getElementById('turmaForm').reset();
    }

    validarTurmaDuplicada(dadosTurma, turmaId = null) {
        const { nome, curso, periodo, ano } = dadosTurma;

        const turmaDuplicada = this.turmas.find(turma =>
            turma.nome.toLowerCase() === nome.toLowerCase() &&
            turma.curso === curso &&
            turma.periodo === periodo &&
            turma.ano === ano &&
            turma.id !== turmaId
        );

        return turmaDuplicada;
    }

    async salvarTurma(event) {
        if (event) event.preventDefault();

        try {
            const turmaId = document.getElementById('turmaId').value;
            const dadosTurma = {
                nome: document.getElementById('turmaNome').value.trim(),
                curso: document.getElementById('turmaCurso').value,
                periodo: parseInt(document.getElementById('turmaPeriodo').value),
                ano: parseInt(document.getElementById('turmaAno').value),
                ativa: document.getElementById('turmaAtiva').value === 'true' ? 1 : 0,
                quantidade_alunos: 0
            };

            console.log('💾 Salvando turma:', { turmaId, dadosTurma });

            if (!dadosTurma.nome) {
                this.showNotification('Nome da turma é obrigatório', 'error');
                return;
            }

            if (!dadosTurma.curso) {
                this.showNotification('Curso é obrigatório', 'error');
                return;
            }

            const turmaDuplicada = this.validarTurmaDuplicada(dadosTurma, turmaId ? parseInt(turmaId) : null);
            if (turmaDuplicada) {
                this.showNotification(
                    `Já existe uma turma com o nome "${turmaDuplicada.nome}" no mesmo curso, período e ano!`,
                    'error'
                );
                return;
            }

            let response;
            if (turmaId) {
                console.log('✏️ Editando turma existente:', turmaId);
                response = await this.makeRequest(`/turmas/${turmaId}`, {
                    method: 'PUT',
                    body: JSON.stringify(dadosTurma)
                });
            } else {
                console.log('🆕 Criando nova turma');
                response = await this.makeRequest('/turmas', {
                    method: 'POST',
                    body: JSON.stringify(dadosTurma)
                });
            }

            console.log('📡 Resposta da API:', response);

            if (response && response.success) {
                this.showNotification(
                    turmaId ? 'Turma atualizada com sucesso!' : 'Turma criada com sucesso!',
                    'success'
                );

                this.fecharModalTurma();
                await this.carregarTurmas();
                this.sincronizarComDashboard();

            } else {
                throw new Error(response?.error || 'Erro ao salvar turma');
            }

        } catch (error) {
            console.error('❌ Erro ao salvar turma:', error);
            this.showNotification('Erro ao salvar turma: ' + error.message, 'error');
        }
    }

    async excluirTurma(turmaId) {
        const turma = this.turmas.find(t => t.id === turmaId);
        if (!turma) return;

        console.log('🗑️ Tentando excluir turma:', {
            id: turma.id,
            nome: turma.nome,
            ativa: turma.ativa,
            quantidade_alunos: turma.quantidade_alunos
        });

        if (turma.ativa && turma.quantidade_alunos > 0) {
            this.showNotification('Não é possível excluir uma turma ativa que possui alunos vinculados!', 'error');
            return;
        }

        if (!turma.ativa && turma.quantidade_alunos > 0) {
            const confirmarDesvinculacao = confirm(
                `A turma "${turma.nome}" possui ${turma.quantidade_alunos} aluno(s) vinculado(s).\n\n` +
                'Para excluir a turma, é necessário desvincular todos os alunos primeiro.\n\n' +
                'Deseja desvincular todos os alunos agora?'
            );

            if (confirmarDesvinculacao) {
                await this.desvincularTodosAlunos(turmaId);
                setTimeout(async () => {
                    await this.carregarTurmas();
                    const turmaAtualizada = this.turmas.find(t => t.id === turmaId);
                    if (turmaAtualizada && turmaAtualizada.quantidade_alunos === 0) {
                        await this.excluirTurmaAposVerificacao(turmaId);
                    } else {
                        this.showNotification('Ainda há alunos vinculados. Não foi possível excluir a turma.', 'error');
                    }
                }, 1500);
            }
            return;
        }

        await this.excluirTurmaAposVerificacao(turmaId);
    }

    async excluirTurmaAposVerificacao(turmaId) {
        const turma = this.turmas.find(t => t.id === turmaId);
        if (!turma) return;

        const mensagemConfirmacao = turma.ativa
            ? `Tem certeza que deseja inativar a turma "${turma.nome}"?\n\nEsta ação tornará a turma inativa.`
            : `Tem certeza que deseja excluir permanentemente a turma "${turma.nome}"?\n\nEsta ação não pode ser desfeita.`;

        if (!confirm(mensagemConfirmacao)) {
            return;
        }

        try {
            const endpoint = turma.ativa ? `/turmas/${turmaId}` : `/turmas/permanent/${turmaId}`;

            console.log('📤 Fazendo requisição de exclusão para:', endpoint);

            const response = await this.makeRequest(endpoint, {
                method: 'DELETE'
            });

            if (response && response.success) {
                this.showNotification(response.message, 'success');
                await this.carregarTurmas();
            } else {
                throw new Error(response?.error || 'Erro ao excluir turma');
            }
        } catch (error) {
            console.error('❌ Erro ao excluir turma:', error);
            this.showNotification('Erro ao excluir turma: ' + error.message, 'error');
        }
    }

    async vincularAlunosTurma(turmaId) {
        try {
            console.log('🎯 Vincular alunos à turma:', turmaId);

            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            if (!turma.ativa) {
                this.showNotification('Não é possível vincular alunos a uma turma inativa!', 'error');
                return;
            }

            this.turmaEditando = turma;
            await this.abrirModalVincularAlunos(turma);

        } catch (error) {
            console.error('❌ Erro ao abrir modal de vínculo:', error);
            this.showNotification('Erro ao abrir modal: ' + error.message, 'error');
        }
    }
    async criarModalVincularAlunosFallback() {
        console.log('🔄 Criando modal de vínculo fallback...');

        const modalId = 'vincularAlunosModal';

        const modalExistente = document.getElementById(modalId);
        if (modalExistente) {
            modalExistente.remove();
        }

        const modalHTML = `
        <div class="modal-overlay" id="${modalId}" style="display: none;">
            <!-- ... resto do código do modal ... -->
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        console.log('✅ Modal de vínculo fallback criado');
    }

    async abrirModalVincularAlunos(turma) {
        try {
            console.log('🎯 Abrindo modal de vínculo para turma:', turma);

            let modal = document.getElementById('vincularAlunosModal');
            if (!modal) {
                console.log('🔄 Modal não encontrado, criando fallback...');
                await this.criarModalVincularAlunosFallback();
                modal = document.getElementById('vincularAlunosModal');
            }

            // Garantir que os elementos existem
            const turmaNomeElement = document.getElementById('turmaSelecionadaNome');
            const turmaCursoElement = document.getElementById('turmaSelecionadaCurso');

            if (turmaNomeElement) {
                turmaNomeElement.textContent = turma.nome || 'Turma sem nome';
            }

            if (turmaCursoElement) {
                turmaCursoElement.textContent = `Curso: ${turma.curso || 'Não definido'}`;
            }

            await this.carregarAlunos();
            this.renderizarListaAlunosParaTurma();

            modal.style.display = 'flex';
            this.prepararModalMobile(modal);

            console.log('✅ Modal de vínculo aberto com sucesso');

        } catch (error) {
            console.error('❌ Erro crítico no modal de vínculo:', error);
            this.showNotification('Erro ao abrir modal de vínculo: ' + error.message, 'error');
        }
    }

    verificarErestaurarModais() {
        console.log('🔍 Verificando e restaurando modais...');

        const modaisNecessarios = [
            { id: 'vincularAlunosModal', nome: 'Vincular Alunos' },
            { id: 'turmaModal', nome: 'Gerenciar Turma' }
        ];

        modaisNecessarios.forEach(modalInfo => {
            const modal = document.getElementById(modalInfo.id);
            if (!modal) {
                console.log(`🔄 Modal ${modalInfo.nome} não encontrado, restaurando...`);

                if (modalInfo.id === 'vincularAlunosModal') {
                    this.criarModalVincularAlunosFallback();
                } else if (modalInfo.id === 'turmaModal') {
                    this.criarModalTurmaFallback();
                }
            } else {
                console.log(`✅ Modal ${modalInfo.nome} encontrado`);
            }
        });
    }

    validarCursoAluno(alunoId, turmaCurso) {
        const aluno = this.alunos.find(a => a.id === alunoId);
        if (!aluno) {
            return { valido: false, motivo: 'Aluno não encontrado' };
        }

        if (!aluno.curso) {
            return { valido: true, motivo: 'Aluno sem curso definido' };
        }

        if (aluno.curso !== turmaCurso) {
            return {
                valido: false,
                motivo: `Aluno do curso ${aluno.curso} não pode ser adicionado à turma do curso ${turmaCurso}`
            };
        }

        return { valido: true };
    }

    fecharModalVincularAlunos() {
        const modal = document.getElementById('vincularAlunosModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }

        this.turmaEditando = null;

        this.alunosVinculadosInicialmente.clear();

        const buscarInput = document.getElementById('buscarAlunosTurma');
        if (buscarInput) buscarInput.value = '';
    }

    async vincularAlunosSelecionados() {
        try {
            const checkboxes = document.querySelectorAll('.aluno-checkbox:checked:not(:disabled)');
            let alunosIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

            if (alunosIds.length === 0) {
                this.showNotification('Selecione pelo menos um aluno', 'warning');
                return;
            }

            const turmaId = this.turmaEditando?.id;
            if (!turmaId) {
                throw new Error('Turma não selecionada');
            }

            const alunosVinculados = await this.buscarAlunosVinculadosTurma();
            const alunosVinculadosIds = alunosVinculados.map(aluno => aluno.id);

            const alunosNovosIds = alunosIds.filter(id => !alunosVinculadosIds.includes(id));

            console.log('🎯 Alunos para vincular (novos):', alunosNovosIds);
            console.log('📋 Alunos já vinculados:', alunosVinculadosIds);

            if (alunosNovosIds.length === 0) {
                this.showNotification('Todos os alunos selecionados já estão vinculados à turma', 'info');
                return;
            }

            const alunosInvalidos = [];
            const alunosValidos = [];

            for (const alunoId of alunosNovosIds) {
                const validacao = this.validarCursoAluno(alunoId, this.turmaEditando.curso);
                if (validacao.valido) {
                    alunosValidos.push(alunoId);
                } else {
                    alunosInvalidos.push({ id: alunoId, motivo: validacao.motivo });
                }
            }

            if (alunosInvalidos.length > 0) {
                const nomesInvalidos = alunosInvalidos.map(invalido => {
                    const aluno = this.alunos.find(a => a.id === invalido.id);
                    return `${aluno.nome} (${invalido.motivo})`;
                }).join(', ');

                this.showNotification(
                    `${alunosInvalidos.length} aluno(s) não podem ser vinculados: ${nomesInvalidos}`,
                    'error'
                );

                if (alunosValidos.length === 0) {
                    return;
                }

                if (!confirm(`Deseja vincular apenas os ${alunosValidos.length} aluno(s) válidos?`)) {
                    return;
                }

                alunosIds = alunosValidos;
            } else {
                alunosIds = alunosValidos;
            }

            console.log('🎯 Iniciando processo de matrícula para alunos novos...');

            const response = await this.makeRequest('/turmas/matricular-alunos', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: turmaId,
                    alunos_ids: alunosIds
                })
            });

            console.log('📡 Resposta:', response);

            if (response && response.success) {
                this.showNotification(response.message, 'success');

                alunosIds.forEach(id => {
                    this.alunosVinculadosInicialmente.add(id);
                });

                console.log('✅ Estado inicial atualizado:', Array.from(this.alunosVinculadosInicialmente));

                this.fecharModalVincularAlunos();

                console.log('🔄 Atualizando quantidade após vinculação...');
                await this.atualizarQuantidadeAlunosTurma(turmaId);

                await Promise.all([
                    this.carregarTurmas(),
                    this.carregarAlunos()
                ]);

                this.renderizarTurmas();
                this.sincronizarComDashboard();

            } else {
                throw new Error(response?.error || 'Erro ao vincular alunos');
            }

        } catch (error) {
            console.error('❌ Erro ao vincular alunos:', error);
            this.showNotification('Erro ao vincular alunos: ' + error.message, 'error');
        }
    }

    fecharModalVincularAlunos() {
        const modal = document.getElementById('vincularAlunosModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }

        this.turmaEditando = null;

        const buscarInput = document.getElementById('buscarAlunosTurma');
        if (buscarInput) buscarInput.value = '';
    }

    configurarSelecaoAlunosComEventos() {
        const selecionarTodos = document.getElementById('selecionarTodosAlunos');
        const checkboxes = document.querySelectorAll('.aluno-checkbox:not(:disabled)');
        const buscarInput = document.getElementById('buscarAlunosTurma');

        if (selecionarTodos) {
            selecionarTodos.addEventListener('change', (e) => {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });
        }

        if (buscarInput) {
            buscarInput.addEventListener('input', (e) => {
                const termo = e.target.value.toLowerCase();
                const linhas = document.querySelectorAll('#listaAlunosTurma tr');

                linhas.forEach(linha => {
                    const texto = linha.textContent.toLowerCase();
                    linha.style.display = texto.includes(termo) ? '' : 'none';
                });
            });
        }

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const alunoId = parseInt(e.target.value);
                const estavaSelecionado = e.target.checked;

                console.log('🔄 Alteração de seleção:', { alunoId, estavaSelecionado });

                if (!estavaSelecionado) {
                    const aluno = this.alunos.find(a => a.id === alunoId);
                    if (aluno) {
                        await this.desvincularAlunoInstantaneo(alunoId, aluno.nome);
                    }
                }
            });
        });
    }

    async desvincularAlunoInstantaneo(alunoId, alunoNome) {
        try {
            const turmaId = this.turmaEditando?.id;
            if (!turmaId) {
                console.error('❌ Turma não selecionada para desvinculação instantânea');
                return;
            }

            // 🔥 VERIFICAÇÃO EXTRA: Confirmar que o aluno estava vinculado inicialmente
            if (!this.alunosVinculadosInicialmente.has(alunoId)) {
                console.log('⚠️ Aluno não estava vinculado inicialmente - cancelando desvinculação');

                // 🔥 CORREÇÃO: Não restaurar o checkbox se não estava vinculado inicialmente
                const checkbox = document.querySelector(`.aluno-checkbox[value="${alunoId}"]`);
                if (checkbox) {
                    checkbox.checked = false; // Manter desmarcado
                }
                return;
            }

            console.log('⚡ Desvinculação instantânea:', { turmaId, alunoId, alunoNome });

            // Feedback visual
            const checkbox = document.querySelector(`.aluno-checkbox[value="${alunoId}"]`);
            if (checkbox) {
                checkbox.disabled = true;
                const linha = checkbox.closest('tr');
                if (linha) {
                    linha.style.opacity = '0.6';
                    const statusCell = linha.cells[6];
                    if (statusCell) {
                        statusCell.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Desvinculando...';
                    }
                }
            }

            const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: parseInt(turmaId),
                    aluno_id: parseInt(alunoId)
                })
            });

            if (response && response.success) {
                console.log('✅ Aluno desvinculado instantaneamente:', alunoNome);

                // 🔥 ATUALIZAR: Remover da lista de alunos vinculados inicialmente
                this.alunosVinculadosInicialmente.delete(alunoId);

                // Atualizar dados globais
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

                // 🔥 CORREÇÃO: Atualizar apenas a linha específica em vez de recarregar todo o modal
                await this.atualizarApenasLinhaAluno(alunoId);

                this.showNotification(`Aluno "${alunoNome}" desvinculado automaticamente`, 'info');
            } else {
                throw new Error(response?.error || 'Erro na desvinculação instantânea');
            }

        } catch (error) {
            console.error('❌ Erro na desvinculação instantânea:', error);

            // Restaurar estado em caso de erro
            const checkbox = document.querySelector(`.aluno-checkbox[value="${alunoId}"]`);
            if (checkbox) {
                checkbox.disabled = false;
                // 🔥 CORREÇÃO: Só restaurar como selecionado se estava vinculado inicialmente
                if (this.alunosVinculadosInicialmente.has(alunoId)) {
                    checkbox.checked = true;
                }

                const linha = checkbox.closest('tr');
                if (linha) {
                    linha.style.opacity = '1';
                    const statusCell = linha.cells[6];
                    if (statusCell) {
                        statusCell.innerHTML = '<span class="badge active">Vinculado</span>';
                    }
                }
            }

            this.showNotification('Erro ao desvincular aluno: ' + error.message, 'error');
        }
    }

    async atualizarApenasLinhaAluno(alunoId) {
        try {
            const checkbox = document.querySelector(`.aluno-checkbox[value="${alunoId}"]`);
            if (!checkbox) return;

            const linha = checkbox.closest('tr');
            if (!linha) return;

            const aluno = this.alunos.find(a => a.id === alunoId);
            if (!aluno) return;

            const statusCell = linha.cells[6];
            if (statusCell) {
                statusCell.innerHTML = '<span class="badge active">Pode vincular</span>';
            }

            const checkboxCell = linha.cells[0];
            checkboxCell.innerHTML = `
            <input type="checkbox" class="aluno-checkbox" value="${alunoId}">
            <small class="text-danger">(curso incompatível)</small>
        `;

            linha.style.opacity = '1';

            const novoCheckbox = checkboxCell.querySelector('.aluno-checkbox');
            if (novoCheckbox) {
                novoCheckbox.onchange = async (e) => {
                    const alunoId = parseInt(e.target.value);
                    const estaSelecionado = e.target.checked;
                    const estavaVinculadoInicialmente = this.alunosVinculadosInicialmente.has(alunoId);

                    console.log('🔄 Alteração de seleção:', {
                        alunoId,
                        estaSelecionado,
                        estavaVinculadoInicialmente
                    });

                    if (!estaSelecionado && estavaVinculadoInicialmente) {
                        const aluno = this.alunos.find(a => a.id === alunoId);
                        if (aluno) {
                            await this.desvincularAlunoInstantaneo(alunoId, aluno.nome);
                        }
                    } else if (!estaSelecionado && !estavaVinculadoInicialmente) {
                        console.log('ℹ️ Aluno não estava vinculado inicialmente - ignorando desvinculação');
                    }
                };
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar linha do aluno:', error);
        }
    }

    async forcarAtualizacaoModalVincularAlunos() {
        try {
            console.log('💪 Forçando atualização completa do modal de vincular alunos...');

            this.fecharModalVincularAlunos();

            setTimeout(async () => {
                if (this.turmaEditando) {
                    await this.abrirModalVincularAlunos(this.turmaEditando);
                }
            }, 300);

        } catch (error) {
            console.error('❌ Erro ao forçar atualização do modal:', error);
        }
    }

    async renderizarListaAlunosParaTurma() {
        const tbody = document.getElementById('listaAlunosTurma');
        if (!tbody) {
            console.error('❌ Elemento listaAlunosTurma não encontrado');
            return;
        }

        if (!Array.isArray(this.alunos) || this.alunos.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Nenhum aluno encontrado</p>
                </td>
            </tr>
        `;
            return;
        }

        try {
            const alunosVinculados = await this.buscarAlunosVinculadosTurma();
            const alunosVinculadosIds = alunosVinculados.map(aluno => aluno.id);

            this.alunosVinculadosInicialmente = new Set(alunosVinculadosIds);

            console.log(`🎯 ${alunosVinculadosIds.length} alunos já vinculados à turma:`, alunosVinculadosIds);
            console.log('📋 Estado inicial guardado:', Array.from(this.alunosVinculadosInicialmente));

            tbody.innerHTML = this.alunos.map(aluno => {
                const turmaAluno = this.turmas.find(t => t.id === aluno.turma_id);
                const jaNaTurma = alunosVinculadosIds.includes(aluno.id);
                const validacaoCurso = this.validarCursoAluno(aluno.id, this.turmaEditando?.curso);
                const podeVincular = !jaNaTurma && validacaoCurso.valido;

                return `
                <tr>
                    <td>
                        <input type="checkbox" class="aluno-checkbox" value="${aluno.id}" 
                               ${jaNaTurma ? 'checked' : ''} 
                               ${podeVincular || jaNaTurma ? '' : 'disabled'}
                               data-inicialmente-vinculado="${jaNaTurma}">
                        ${jaNaTurma ? '<small class="text-success">(já vinculado)</small>' : ''}
                        ${!validacaoCurso.valido && !jaNaTurma ? '<small class="text-danger">(curso incompatível)</small>' : ''}
                    </td>
                    <td>${this.escapeHtml(aluno.nome)}</td>
                    <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                    <td>${this.escapeHtml(aluno.email)}</td>
                    <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
                    <td>
                        <span class="badge ${aluno.turma_id ? 'active' : 'inactive'}">
                            ${turmaAluno ? turmaAluno.nome : 'Sem turma'}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${jaNaTurma ? 'active' : (podeVincular ? 'active' : 'inactive')}">
                            ${jaNaTurma ? 'Vinculado' : (podeVincular ? 'Pode vincular' : 'Não pode vincular')}
                        </span>
                    </td>
                </tr>
            `;
            }).join('');

            this.configurarSelecaoAlunosComEventos();

        } catch (error) {
            console.error('❌ Erro ao renderizar lista de alunos:', error);
            tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar alunos</p>
                </td>
            </tr>
        `;
        }
    }

    async buscarAlunosVinculadosTurma() {
        try {
            if (!this.turmaEditando?.id) return [];

            const response = await this.makeRequest(`/turmas/${this.turmaEditando.id}/alunos`);
            if (response && response.success) {
                return response.data || [];
            }
            return [];
        } catch (error) {
            console.error('❌ Erro ao buscar alunos vinculados:', error);
            return [];
        }
    }

    configurarSelecaoAlunosComEventos() {
        const selecionarTodos = document.getElementById('selecionarTodosAlunos');
        const checkboxes = document.querySelectorAll('.aluno-checkbox:not(:disabled)');
        const buscarInput = document.getElementById('buscarAlunosTurma');

        console.log(`🔧 Configurando eventos para ${checkboxes.length} checkboxes`);

        if (selecionarTodos) {
            selecionarTodos.onchange = (e) => {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            };
        }

        if (buscarInput) {
            buscarInput.oninput = (e) => {
                const termo = e.target.value.toLowerCase();
                const linhas = document.querySelectorAll('#listaAlunosTurma tr');

                linhas.forEach(linha => {
                    const texto = linha.textContent.toLowerCase();
                    linha.style.display = texto.includes(termo) ? '' : 'none';
                });
            };
        }

        checkboxes.forEach(checkbox => {
            checkbox.onchange = null;

            checkbox.onchange = async (e) => {
                const alunoId = parseInt(e.target.value);
                const estaSelecionado = e.target.checked;
                const estavaVinculadoInicialmente = this.alunosVinculadosInicialmente.has(alunoId);

                console.log('🔄 Alteração de seleção:', {
                    alunoId,
                    estaSelecionado,
                    estavaVinculadoInicialmente
                });

                if (!estaSelecionado && estavaVinculadoInicialmente) {
                    const aluno = this.alunos.find(a => a.id === alunoId);
                    if (aluno) {
                        await this.desvincularAlunoInstantaneo(alunoId, aluno.nome);
                    }
                }
                else if (!estaSelecionado && !estavaVinculadoInicialmente) {
                    console.log('ℹ️ Aluno não estava vinculado inicialmente - ignorando desvinculação');
                }
            };
        });
    }

    async verAlunosTurma(turmaId) {
        try {
            console.log('👀 Ver alunos da turma:', turmaId);

            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);

            if (response && response.success) {
                const alunosDaTurma = response.data || [];
                console.log(`✅ ${alunosDaTurma.length} alunos carregados do banco`);
                this.mostrarModalAlunosTurma(alunosDaTurma, turmaId);
            } else {
                throw new Error(response?.error || 'Erro ao carregar alunos');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar alunos da turma:', error);
            this.showNotification('Erro ao carregar alunos do banco', 'error');
        }
    }

    mostrarModalAlunosTurma(alunos, turmaId) {
        const turma = this.turmas.find(t => t.id === turmaId);
        const turmaNome = turma ? turma.nome : 'Turma';

        const modalId = 'modal-ver-alunos-turma';

        const modalExistente = document.getElementById(modalId);
        if (modalExistente) {
            modalExistente.remove();
        }

        const modalHTML = `
        <div class="modal-overlay" id="${modalId}" onclick="this.remove()">
            <div class="modal-content large" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-users"></i> Alunos da Turma - ${this.escapeHtml(turmaNome)}</h3>
                    <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Matrícula</th>
                                    <th>Email</th>
                                    <th>Curso</th>
                                    <th>Período</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alunos.map(aluno => `
                                    <tr>
                                        <td>${this.escapeHtml(aluno.nome)}</td>
                                        <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                                        <td>${this.escapeHtml(aluno.email)}</td>
                                        <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
                                        <td>${aluno.periodo || 'N/A'}° Período</td>
                                        <td>
                                            <span class="badge ${aluno.ativo !== false ? 'active' : 'inactive'}">
                                                ${aluno.ativo !== false ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn-action small perigo" 
                                                    onclick="adminTurmas.desvincularAluno(${turmaId}, ${aluno.id}, '${this.escapeHtml(aluno.nome)}')"
                                                    title="Desvincular aluno">
                                                <i class="fas fa-unlink"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${alunos.length === 0 ? `
                                    <tr>
                                        <td colspan="7" class="empty-state">
                                            <i class="fas fa-users-slash"></i>
                                            <p>Nenhum aluno nesta turma</p>
                                        </td>
                                    </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="document.getElementById('${modalId}').remove()">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async atualizarQuantidadeAlunosTurma(turmaId) {
        try {
            console.log('🔢 Atualizando quantidade de alunos para turma:', turmaId);

            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);

            if (response && response.success) {
                const alunosVinculados = response.data || [];
                const novaQuantidade = alunosVinculados.length;

                console.log(`✅ Encontrados ${novaQuantidade} alunos na turma ${turmaId}`);

                const turmaIndex = this.turmas.findIndex(t => t.id === turmaId);
                if (turmaIndex !== -1) {
                    this.turmas[turmaIndex].quantidade_alunos = novaQuantidade;

                    try {
                        await this.makeRequest(`/turmas/${turmaId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                ...this.turmas[turmaIndex],
                                quantidade_alunos: novaQuantidade
                            })
                        });
                        console.log(`✅ Quantidade atualizada no banco: ${novaQuantidade}`);
                    } catch (updateError) {
                        console.warn('⚠️ Não foi possível atualizar no banco, mas a quantidade local foi ajustada');
                    }

                    this.renderizarTurmas();
                    this.atualizarEstatisticasTurmas();
                    this.sincronizarComDashboard();

                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('❌ Erro ao atualizar quantidade:', error);
            return false;
        }
    }


    async desvincularAluno(turmaId, alunoId, alunoNome = '') {
        try {
            if (!alunoNome) {
                const aluno = this.alunos.find(a => a.id === alunoId);
                alunoNome = aluno ? aluno.nome : 'Aluno';
            }

            const confirmacao = confirm(`Tem certeza que deseja desvincular o aluno "${alunoNome}" da turma?`);
            if (!confirmacao) return;

            console.log('🗑️ Desvinculando aluno individual:', { turmaId, alunoId });

            const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: parseInt(turmaId),
                    aluno_id: parseInt(alunoId)
                })
            });

            console.log('📡 Resposta da desvinculação individual:', response);

            if (response && response.success) {
                this.showNotification(`Aluno "${alunoNome}" desvinculado com sucesso!`, 'success');

                // Atualizar dados globais
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

                // Tentar atualizar o modal normalmente
                await this.atualizarListaAlunosNoModal(turmaId);

                // 🔥 NOVO: Verificar se a atualização funcionou
                setTimeout(async () => {
                    // Verificar se o aluno ainda aparece no modal
                    const modal = document.getElementById('modal-gerenciar-vinculos');
                    if (modal) {
                        const alunoAindaPresente = modal.querySelector(`[value="${alunoId}"]`);
                        if (alunoAindaPresente) {
                            console.log('⚠️ Aluno ainda aparece no modal, forçando atualização...');
                            await this.forcarAtualizacaoModalGerenciarVinculos(turmaId);
                        }
                    }
                }, 1000);

            } else {
                throw new Error(response?.error || 'Erro ao desvincular aluno');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular aluno individual:', error);
            this.showNotification('Erro ao desvincular aluno: ' + error.message, 'error');
        }
    }

    async atualizarModalVincularAlunos() {
        try {
            console.log('🔄 Atualizando modal de vincular alunos...');

            const modal = document.getElementById('vincularAlunosModal');
            if (modal && (modal.style.display === 'flex' || modal.style.display === 'block')) {
                console.log('✅ Modal de vincular alunos está aberto - atualizando...');

                await this.carregarAlunos();

                this.renderizarListaAlunosParaTurma();

                console.log('✅ Modal de vincular alunos atualizado com sucesso');
            } else {
                console.log('ℹ️ Modal de vincular alunos não está aberto');
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar modal de vincular alunos:', error);
        }
    }

    async atualizarListaAlunosNoModal(turmaId) {
        try {
            console.log('🔄 Atualizando lista de alunos no modal...');

            const modais = document.querySelectorAll('.modal-overlay');
            console.log(`🔍 ${modais.length} modal(is) encontrado(s) no DOM`);

            let modalAberto = null;

            modais.forEach(modal => {
                const style = window.getComputedStyle(modal);
                if (style.display === 'flex' || style.display === 'block') {
                    modalAberto = modal;
                    console.log('✅ Modal visível encontrado:', modal.id);
                }
            });

            if (!modalAberto) {
                const modaisComDisplay = document.querySelectorAll('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
                if (modaisComDisplay.length > 0) {
                    modalAberto = modaisComDisplay[0];
                    console.log('✅ Modal encontrado por seletor de estilo:', modalAberto.id);
                }
            }

            if (!modalAberto) {
                modais.forEach(modal => {
                    const titulo = modal.querySelector('h3');
                    if (titulo && (titulo.textContent.includes('Gerenciar Alunos') || titulo.textContent.includes('Alunos da Turma'))) {
                        modalAberto = modal;
                        console.log('✅ Modal encontrado por conteúdo:', titulo.textContent);
                    }
                });
            }

            if (!modalAberto) {
                console.log('❌ Nenhum modal aberto foi detectado');
                return;
            }

            console.log('🎯 Modal detectado para atualização:', {
                id: modalAberto.id,
                display: modalAberto.style.display,
                conteúdo: modalAberto.querySelector('h3')?.textContent
            });

            const titulo = modalAberto.querySelector('h3');
            if (titulo) {
                if (titulo.textContent.includes('Gerenciar Alunos')) {
                    console.log('⚙️ Atualizando modal "Gerenciar Vínculos"...');
                    await this.atualizarModalGerenciarVinculos(turmaId);
                } else if (titulo.textContent.includes('Alunos da Turma')) {
                    console.log('📋 Atualizando modal "Ver Alunos"...');
                    await this.atualizarModalVerAlunos(turmaId);
                } else {
                    console.log('❓ Modal desconhecido:', titulo.textContent);
                }
            } else {
                console.log('⚠️ Modal sem título encontrado, tentando identificar pelo ID...');
                if (modalAberto.id === 'modal-gerenciar-vinculos') {
                    await this.atualizarModalGerenciarVinculos(turmaId);
                } else if (modalAberto.id === 'modal-ver-alunos-turma') {
                    await this.atualizarModalVerAlunos(turmaId);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar lista no modal:', error);
        }
    }

    async atualizarModalVerAlunos(turmaId) {
        try {
            console.log('🔄 Atualizando modal "Ver Alunos"...');

            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);

            if (response && response.success) {
                const alunosAtualizados = response.data || [];

                const tbody = document.querySelector('#modal-ver-alunos-turma tbody');
                if (tbody) {
                    this.atualizarTabelaAlunosVerTurma(tbody, alunosAtualizados, turmaId);
                }

                console.log(`✅ Modal "Ver Alunos" atualizado: ${alunosAtualizados.length} alunos`);
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar modal "Ver Alunos":', error);
        }
    }

    async forcarAtualizacaoModalGerenciarVinculos(turmaId) {
        try {
            console.log('💪 Forçando atualização do modal de gerenciar vínculos...');

            const modalExistente = document.getElementById('modal-gerenciar-vinculos');
            if (modalExistente) {
                modalExistente.remove();
            }

            await this.carregarAlunos();

            const turma = this.turmas.find(t => t.id === turmaId);
            if (turma) {
                this.turmaEditando = turma;
                const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);
                if (response && response.success) {
                    this.mostrarModalGerenciarVinculos(turma, response.data);
                    console.log('✅ Modal recarregado forçadamente');
                }
            }
        } catch (error) {
            console.error('❌ Erro ao forçar atualização do modal:', error);
        }
    }

    async atualizarModalGerenciarVinculos(turmaId) {
        try {
            console.log('🔄 Atualizando modal "Gerenciar Vínculos"...');

            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);

            if (response && response.success) {
                const alunosAtualizados = response.data || [];
                console.log(`📊 ${alunosAtualizados.length} alunos encontrados após atualização`);

                let modal = document.getElementById('modal-gerenciar-vinculos');

                if (!modal) {
                    console.log('🔍 Modal não encontrado pelo ID, procurando por conteúdo...');
                    const modais = document.querySelectorAll('.modal-overlay');
                    for (const m of modais) {
                        const titulo = m.querySelector('h3');
                        if (titulo && titulo.textContent.includes('Gerenciar Alunos')) {
                            modal = m;
                            break;
                        }
                    }
                }

                if (modal) {
                    console.log('✅ Modal encontrado:', modal.id);

                    let tbody = modal.querySelector('#listaAlunosVinculados');
                    if (!tbody) {
                        console.log('🔍 Tbody não encontrado pelo ID, procurando primeiro tbody...');
                        tbody = modal.querySelector('tbody');
                    }

                    if (tbody) {
                        console.log('✅ Tbody encontrado, atualizando tabela...');
                        this.atualizarTabelaAlunosGerenciarVinculos(tbody, alunosAtualizados, turmaId);

                        const contadorElement = modal.querySelector('.form-text, small');
                        if (contadorElement) {
                            contadorElement.textContent = `Curso: ${this.turmaEditando?.curso} | ${alunosAtualizados.length} aluno(s) vinculado(s)`;
                        }

                        console.log('✅ Modal "Gerenciar Vínculos" atualizado com sucesso');
                    } else {
                        console.error('❌ Tbody não encontrado no modal de gerenciar vínculos');
                    }
                } else {
                    console.error('❌ Modal de gerenciar vínculos não encontrado de forma alguma');
                }
            } else {
                console.error('❌ Erro ao buscar alunos atualizados:', response?.error);
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar modal "Gerenciar Vínculos":', error);
        }
    }

    atualizarTabelaAlunosVerTurma(tbody, alunos, turmaId) {
        if (!tbody) return;

        tbody.innerHTML = alunos.map(aluno => `
        <tr>
            <td>${this.escapeHtml(aluno.nome)}</td>
            <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
            <td>${this.escapeHtml(aluno.email)}</td>
            <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
            <td>${aluno.periodo || 'N/A'}° Período</td>
            <td>
                <span class="badge ${aluno.ativo !== false ? 'active' : 'inactive'}">
                    ${aluno.ativo !== false ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <button class="btn-action small perigo" 
                        onclick="adminTurmas.desvincularAluno(${turmaId}, ${aluno.id}, '${this.escapeHtml(aluno.nome)}')"
                        title="Desvincular aluno">
                    <i class="fas fa-unlink"></i>
                </button>
            </td>
        </tr>
    `).join('');

        if (alunos.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Nenhum aluno nesta turma</p>
                </td>
            </tr>
        `;
        }
    }


    atualizarTabelaAlunosGerenciarVinculos(tbody, alunos, turmaId) {
        if (!tbody) {
            console.error('❌ Tbody é nulo, não é possível atualizar');
            return;
        }

        console.log(`🎯 Atualizando tabela com ${alunos.length} alunos`);

        if (alunos.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Nenhum aluno vinculado a esta turma</p>
                </td>
            </tr>
        `;
            console.log('✅ Tabela atualizada: estado vazio');
            return;
        }

        tbody.innerHTML = alunos.map(aluno => `
        <tr>
            <td>
                <input type="checkbox" class="aluno-vinculado-checkbox" value="${aluno.id}">
            </td>
            <td>${this.escapeHtml(aluno.nome)}</td>
            <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
            <td>${this.escapeHtml(aluno.email)}</td>
            <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
            <td>${this.formatarData(aluno.data_matricula || aluno.data_vinculo || aluno.created_at)}</td>
            <td>
                <button class="btn-action small perigo" 
                        onclick="adminTurmas.desvincularAluno(${turmaId}, ${aluno.id}, '${this.escapeHtml(aluno.nome)}')"
                        title="Desvincular aluno">
                    <i class="fas fa-unlink"></i>
                </button>
            </td>
        </tr>
    `).join('');

        console.log('✅ Tabela do modal "Gerenciar Vínculos" renderizada');

        this.configurarModalGerenciarVinculos();
    }

    async desvincularAlunosEmLote(turmaId, alunosIds) {
        try {
            if (!alunosIds || alunosIds.length === 0) {
                this.showNotification('Nenhum aluno selecionado para desvincular', 'warning');
                return;
            }

            const confirmacao = confirm(`Desvincular ${alunosIds.length} aluno(s) da turma?`);
            if (!confirmacao) return;

            console.log('🗑️ Desvinculando alunos em lote:', { turmaId, alunosIds });

            const response = await this.makeRequest('/desmatricular-alunos', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: turmaId,
                    alunos_ids: alunosIds
                })
            });

            if (response && response.success) {
                this.showNotification(response.message, 'success');
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();
            } else {
                throw new Error(response?.error || 'Erro ao desvincular alunos');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular alunos em lote:', error);
            this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
        }
    }

    async desvincularTodosAlunos(turmaId) {
        try {
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) throw new Error('Turma não encontrada');

            if (turma.quantidade_alunos === 0) {
                this.showNotification('Esta turma não possui alunos vinculados', 'info');
                return;
            }

            console.log('🗑️ Desvinculando todos os alunos da turma:', turmaId);

            const response = await this.makeRequest(`/turmas/${turmaId}/desvincular-todos`, {
                method: 'POST'
            });

            console.log('📡 Resposta da desvinculação total:', response);

            if (response && response.success) {
                this.showNotification(
                    `Todos os ${turma.quantidade_alunos} alunos foram desvinculados da turma!`,
                    'success'
                );

                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

            } else {
                throw new Error(response?.error || 'Erro ao desvincular todos os alunos');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular todos os alunos:', error);
            this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
        }
    }

    async desvincularAlunosEmLote(turmaId, alunosIds) {
        try {
            if (!alunosIds || alunosIds.length === 0) {
                this.showNotification('Nenhum aluno selecionado para desvincular', 'warning');
                return;
            }

            const nomesAlunos = alunosIds.map(id => {
                const aluno = this.alunos.find(a => a.id === id);
                return aluno ? aluno.nome : 'Aluno desconhecido';
            }).join(', ');

            const confirmacao = confirm(
                `Tem certeza que deseja desvincular ${alunosIds.length} aluno(s) da turma?\n\n` +
                `Alunos: ${nomesAlunos}`
            );

            if (!confirmacao) {
                return;
            }

            console.log('🗑️ Desvinculando alunos em lote:', { turmaId, alunosIds });

            let desvinculadosComSucesso = 0;
            let erros = [];

            for (const alunoId of alunosIds) {
                try {
                    const response = await this.makeRequest('/desmatricular-aluno', {
                        method: 'POST',
                        body: JSON.stringify({
                            turma_id: turmaId,
                            aluno_id: alunoId
                        })
                    });

                    if (response && response.success) {
                        desvinculadosComSucesso++;
                    } else {
                        const aluno = this.alunos.find(a => a.id === alunoId);
                        if (aluno) {
                            const updateResponse = await this.makeRequest(`/usuarios/${alunoId}`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                    ...aluno,
                                    turma_id: null
                                })
                            });

                            if (updateResponse && updateResponse.success) {
                                desvinculadosComSucesso++;
                            } else {
                                throw new Error(`Falha ao desvincular aluno ID ${alunoId}`);
                            }
                        } else {
                            throw new Error(`Aluno ID ${alunoId} não encontrado`);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Erro ao desvincular aluno ${alunoId}:`, error);
                    const alunoNome = this.alunos.find(a => a.id === alunoId)?.nome || 'Aluno desconhecido';
                    erros.push(`${alunoNome}: ${error.message}`);
                }
            }

            if (desvinculadosComSucesso > 0) {
                if (erros.length === 0) {
                    this.showNotification(
                        `${desvinculadosComSucesso} aluno(s) desvinculado(s) com sucesso!`,
                        'success'
                    );
                } else {
                    this.showNotification(
                        `${desvinculadosComSucesso} aluno(s) desvinculado(s), ${erros.length} com erro. Verifique o console.`,
                        'warning'
                    );
                }

                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

            } else {
                throw new Error('Nenhum aluno foi desvinculado: ' + erros.join('; '));
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular alunos em lote:', error);
            this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
        }
    }

    mostrarModalGerenciarVinculos(turma, alunosVinculados) {
        try {
            console.log('🎯 Mostrando modal de gerenciar vínculos:', {
                turma: turma.nome,
                alunos: alunosVinculados.length
            });

            const modalId = 'modal-gerenciar-vinculos';

            const modalExistente = document.getElementById(modalId);
            if (modalExistente) {
                modalExistente.remove();
            }

            let alunosHTML = '';

            if (alunosVinculados && alunosVinculados.length > 0) {
                alunosHTML = alunosVinculados.map(aluno => `
                <tr>
                    <td>
                        <input type="checkbox" class="aluno-vinculado-checkbox" value="${aluno.id}">
                    </td>
                    <td>${this.escapeHtml(aluno.nome)}</td>
                    <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                    <td>${this.escapeHtml(aluno.email)}</td>
                    <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
                    <td>${this.formatarData(aluno.data_matricula || aluno.data_vinculo || aluno.created_at)}</td>
                    <td>
                        <button class="btn-action small perigo" 
                                onclick="adminTurmas.desvincularAluno(${turma.id}, ${aluno.id}, '${this.escapeHtml(aluno.nome)}')"
                                title="Desvincular aluno">
                            <i class="fas fa-unlink"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            } else {
                alunosHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum aluno vinculado a esta turma</p>
                    </td>
                </tr>
            `;
            }

            const modalHTML = `
            <div class="modal-overlay" id="${modalId}" onclick="this.remove()">
                <div class="modal-content large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-times"></i> Gerenciar Alunos - ${this.escapeHtml(turma.nome)}</h3>
                        <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Turma: <strong>${this.escapeHtml(turma.nome)}</strong></label>
                            <small class="form-text">Curso: ${this.escapeHtml(turma.curso)} | ${alunosVinculados.length} aluno(s) vinculado(s)</small>
                        </div>
                        
                        ${alunosVinculados.length > 0 ? `
                            <div class="form-group">
                                <label>Buscar Alunos Vinculados:</label>
                                <input type="text" id="buscarAlunosVinculados" class="form-control" 
                                       placeholder="Digite o nome, matrícula ou email...">
                            </div>
                        ` : ''}
                        
                        <div class="alunos-vinculados-container" style="max-height: 400px; overflow-y: auto;">
                            ${alunosVinculados.length > 0 ? `
                                <table class="alunos-table">
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" id="selecionarTodosVinculados"></th>
                                            <th>Nome</th>
                                            <th>Matrícula</th>
                                            <th>Email</th>
                                            <th>Curso</th>
                                            <th>Data de Vínculo</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody id="listaAlunosVinculados">
                                        ${alunosHTML}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="empty-state">
                                    <i class="fas fa-users-slash"></i>
                                    <p>Nenhum aluno vinculado a esta turma</p>
                                </div>
                            `}
                        </div>
                        
                        ${alunosVinculados.length > 0 ? `
                            <div class="btn-group">
                                <button type="button" class="btn-primary perigo" onclick="adminTurmas.desvincularAlunosSelecionados()">
                                    <i class="fas fa-unlink"></i> Desvincular Selecionados
                                </button>
                                <button type="button" class="btn-secondary" onclick="document.getElementById('${modalId}').remove()">
                                    <i class="fas fa-times"></i> Fechar
                                </button>
                            </div>
                        ` : `
                            <div class="btn-group">
                                <button type="button" class="btn-secondary" onclick="document.getElementById('${modalId}').remove()">
                                    <i class="fas fa-times"></i> Fechar
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            if (alunosVinculados.length > 0) {
                this.configurarModalGerenciarVinculos();
            }

            console.log('✅ Modal de gerenciar vínculos criado com sucesso');

        } catch (error) {
            console.error('❌ Erro ao criar modal de gerenciar vínculos:', error);
            this.showNotification('Erro ao criar modal: ' + error.message, 'error');
        }
    }

    configurarModalGerenciarVinculos() {
        try {
            console.log('⚙️ Configurando modal de gerenciar vínculos...');

            const selecionarTodos = document.getElementById('selecionarTodosVinculados');
            const checkboxes = document.querySelectorAll('.aluno-vinculado-checkbox');
            const buscarInput = document.getElementById('buscarAlunosVinculados');

            if (selecionarTodos && checkboxes.length > 0) {
                selecionarTodos.addEventListener('change', (e) => {
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = e.target.checked;
                    });
                });

                console.log('✅ "Selecionar Todos" configurado');
            } else {
                console.warn('⚠️ Elementos de seleção não encontrados');
            }

            if (buscarInput) {
                buscarInput.addEventListener('input', (e) => {
                    const termo = e.target.value.toLowerCase();
                    const linhas = document.querySelectorAll('#listaAlunosVinculados tr');

                    let linhasVisiveis = 0;
                    linhas.forEach(linha => {
                        const texto = linha.textContent.toLowerCase();
                        const deveMostrar = texto.includes(termo);
                        linha.style.display = deveMostrar ? '' : 'none';

                        if (deveMostrar) linhasVisiveis++;
                    });

                    console.log(`🔍 Busca: ${linhasVisiveis}/${linhas.length} alunos encontrados`);
                });

                console.log('✅ Busca configurada');
            } else {
                console.warn('⚠️ Campo de busca não encontrado');
            }

        } catch (error) {
            console.error('❌ Erro ao configurar modal de gerenciar vínculos:', error);
        }
    }
    async abrirModalGerenciarVinculos(turmaId) {
        try {
            console.log('👥 Abrindo modal de gerenciar vínculos:', turmaId);

            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            this.turmaEditando = turma;

            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);
            console.log('📡 Resposta da API alunos da turma:', response);

            if (response && response.success) {
                const alunosVinculados = response.data || [];
                console.log(`✅ ${alunosVinculados.length} alunos encontrados na turma`);
                this.mostrarModalGerenciarVinculos(turma, alunosVinculados);
            } else {
                throw new Error('Erro ao carregar alunos da turma: ' + (response?.error || 'Desconhecido'));
            }

        } catch (error) {
            console.error('❌ Erro ao abrir modal de gerenciar vínculos:', error);
            this.showNotification('Erro ao carregar alunos da turma: ' + error.message, 'error');
        }
    }

    async desvincularAlunoIndividual(turmaId, alunoId, alunoNome = '') {
        try {
            if (!alunoNome) {
                const aluno = this.alunos.find(a => a.id === alunoId);
                alunoNome = aluno ? aluno.nome : 'Aluno';
            }

            const confirmacao = confirm(`Tem certeza que deseja desvincular o aluno "${alunoNome}" da turma?`);
            if (!confirmacao) return;

            console.log('🗑️ Desvinculando aluno individual:', { turmaId, alunoId });

            const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: parseInt(turmaId),
                    aluno_id: parseInt(alunoId)
                })
            });

            console.log('📡 Resposta da desvinculação individual:', response);

            if (response && response.success) {
                this.showNotification(`Aluno "${alunoNome}" desvinculado com sucesso!`, 'success');

                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

            } else {
                throw new Error(response?.error || 'Erro ao desvincular aluno');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular aluno individual:', error);
            this.showNotification('Erro ao desvincular aluno: ' + error.message, 'error');
        }
    }

    async desvincularAlunosSelecionados() {
        try {
            console.log('🔍 Verificando seleção de alunos para desvincular...');
            const checkboxes = document.querySelectorAll('.aluno-vinculado-checkbox:checked');
            const alunosIds = Array.from(checkboxes).map(cb => {
                const value = parseInt(cb.value);
                console.log(`📋 Checkbox selecionado: ID ${value}`);
                return value;
            });

            if (alunosIds.length === 0) {
                this.showNotification('Selecione pelo menos um aluno para desvincular', 'warning');
                return;
            }

            const turmaId = this.turmaEditando?.id;
            if (!turmaId) {
                throw new Error('Turma não selecionada');
            }

            console.log(`🎯 Preparando para desvincular ${alunosIds.length} aluno(s) da turma ${turmaId}`);

            const nomesAlunos = alunosIds.map(id => {
                const aluno = this.alunos.find(a => a.id === id);
                return aluno ? aluno.nome : `Aluno ID ${id}`;
            });

            const confirmacao = confirm(
                `Tem certeza que deseja desvincular ${alunosIds.length} aluno(s) da turma?\n\n` +
                `Alunos:\n- ${nomesAlunos.join('\n- ')}`
            );

            if (!confirmacao) {
                console.log('❌ Usuário cancelou a desvinculação');
                return;
            }

            console.log('🔄 Iniciando desvinculação em lote...');

            let desvinculadosComSucesso = 0;
            let erros = [];

            for (const alunoId of alunosIds) {
                try {
                    console.log(`🔄 Desvinculando aluno ${alunoId}...`);

                    const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                        method: 'POST',
                        body: JSON.stringify({
                            turma_id: parseInt(turmaId),
                            aluno_id: parseInt(alunoId)
                        })
                    });

                    console.log(`📡 Resposta para aluno ${alunoId}:`, response);

                    if (response && response.success) {
                        desvinculadosComSucesso++;
                        console.log(`✅ Aluno ${alunoId} desvinculado com sucesso`);
                    } else {
                        throw new Error(response?.error || 'Erro na resposta da API');
                    }

                } catch (error) {
                    console.error(`❌ Erro ao desvincular aluno ${alunoId}:`, error);
                    const alunoNome = this.alunos.find(a => a.id === alunoId)?.nome || `Aluno ID ${alunoId}`;
                    erros.push(`${alunoNome}: ${error.message}`);
                }
            }

            console.log(`📊 Resultado: ${desvinculadosComSucesso} sucesso(s), ${erros.length} erro(s)`);

            if (desvinculadosComSucesso > 0) {
                if (erros.length === 0) {
                    this.showNotification(
                        `${desvinculadosComSucesso} aluno(s) desvinculado(s) com sucesso!`,
                        'success'
                    );
                } else {
                    this.showNotification(
                        `${desvinculadosComSucesso} aluno(s) desvinculado(s), ${erros.length} com erro.`,
                        'warning'
                    );
                    console.error('❌ Erros detalhados:', erros);
                }

                console.log('🔄 Atualizando dados após desvinculação...');
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

                await this.atualizarListaAlunosNoModal(turmaId);

            } else {
                throw new Error('Nenhum aluno foi desvinculado: ' + erros.join('; '));
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular alunos selecionados:', error);
            this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
        }
    }

    async desvincularTodosAlunos(turmaId) {
        try {
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            if (turma.quantidade_alunos === 0) {
                this.showNotification('Esta turma não possui alunos vinculados', 'info');
                return;
            }

            const confirmacao = confirm(
                `ATENÇÃO: Tem certeza que deseja desvincular TODOS os ${turma.quantidade_alunos} alunos da turma "${turma.nome}"?\n\n` +
                `Esta ação não pode ser desfeita!`
            );

            if (!confirmacao) {
                return;
            }

            console.log('🗑️ Desvinculando todos os alunos da turma:', turmaId);

            const response = await this.makeRequest(`/turmas/${turmaId}/desvincular-todos`, {
                method: 'POST'
            });

            console.log('📡 Resposta da desvinculação total:', response);

            if (response && response.success) {
                this.showNotification(
                    `Todos os ${turma.quantidade_alunos} alunos foram desvinculados da turma!`,
                    'success'
                );

                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

            } else {
                throw new Error(response?.error || 'Erro ao desvincular todos os alunos');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular todos os alunos:', error);
            this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
        }
    }

    async sincronizacaoCompleta() {
        try {
            console.log('🔄 Iniciando sincronização completa...');

            await Promise.all([
                this.carregarTurmas(),
                this.carregarAlunos()
            ]);

            for (const turma of this.turmas) {
                await this.atualizarQuantidadeAlunosTurma(turma.id);
            }

            this.renderizarTurmas();
            this.sincronizarComDashboard();

            console.log('✅ Sincronização completa concluída');
            this.showNotification('Sistema de turmas sincronizado com sucesso!', 'success');

        } catch (error) {
            console.error('❌ Erro na sincronização completa:', error);
            this.showNotification('Erro na sincronização: ' + error.message, 'error');
        }
    }

    async sincronizarQuantidades() {
        try {
            console.log('🔄 Sincronizando quantidades de todas as turmas...');

            if (!Array.isArray(this.turmas) || this.turmas.length === 0) {
                console.log('ℹ️ Nenhuma turma para sincronizar');
                return;
            }

            let turmasAtualizadas = 0;

            for (const turma of this.turmas) {
                const sucesso = await this.atualizarQuantidadeAlunosTurma(turma.id);
                if (sucesso) {
                    turmasAtualizadas++;
                }
            }

            console.log(`✅ ${turmasAtualizadas}/${this.turmas.length} turmas sincronizadas`);
            this.showNotification(`Quantidades de ${turmasAtualizadas} turmas atualizadas!`, 'success');

        } catch (error) {
            console.error('❌ Erro na sincronização de quantidades:', error);
            this.showNotification('Erro ao sincronizar quantidades: ' + error.message, 'error');
        }
    }

    async debugAlunoTurmas() {
        try {
            console.group('🐛 DEBUG ALUNO-TURMAS - DETALHADO');

            console.log('📊 Dados atuais:');
            console.log('- Turmas:', this.turmas.length);
            console.log('- Alunos:', this.alunos.length);

            for (const turma of this.turmas) {
                console.log(`\n🔍 Analisando turma: ${turma.nome} (ID: ${turma.id})`);

                const alunosResponse = await this.makeRequest(`/turmas/${turma.id}/alunos`);
                const alunosNaTurma = alunosResponse.success ? alunosResponse.data : [];

                console.log(`   👥 Alunos na API: ${alunosNaTurma.length}`);
                console.log(`   📊 Quantidade registrada: ${turma.quantidade_alunos}`);

                const alunosLocais = this.alunos.filter(a => a.turma_id === turma.id);
                console.log(`   🔍 Alunos locais com turma_id: ${alunosLocais.length}`);

                if (alunosNaTurma.length !== turma.quantidade_alunos) {
                    console.warn(`   ⚠️ DISCREPÂNCIA: API tem ${alunosNaTurma.length}, turma mostra ${turma.quantidade_alunos}`);

                    await this.atualizarQuantidadeAlunosTurma(turma.id);
                }

                const alunosCursoIncorreto = alunosNaTurma.filter(aluno =>
                    aluno.curso && aluno.curso !== turma.curso
                );

                if (alunosCursoIncorreto.length > 0) {
                    console.warn(`   🚨 ${alunosCursoIncorreto.length} aluno(s) com curso incompatível:`);
                    alunosCursoIncorreto.forEach(aluno => {
                        console.log(`      - ${aluno.nome}: ${aluno.curso} ≠ ${turma.curso}`);
                    });
                }
            }

            console.groupEnd();
            this.showNotification('Debug detalhado concluído - Verifique o console', 'info');

        } catch (error) {
            console.error('❌ Erro no debug:', error);
            this.showNotification('Erro no debug: ' + error.message, 'error');
        }
    }

    async diagnosticoCompletoTurmas() {
        try {
            console.group('🔍 DIAGNÓSTICO COMPLETO DO SISTEMA DE TURMAS');
            console.log('📚 Turmas no sistema:', this.turmas.length);
            this.turmas.forEach(turma => {
                console.log(`   🏫 ${turma.nome}: ${turma.quantidade_alunos} alunos, ${turma.ativa ? 'Ativa' : 'Inativa'}`);
            });

            console.log('👥 Alunos no sistema:', this.alunos.length);
            const alunosComTurma = this.alunos.filter(a => a.turma_id);
            console.log(`   📊 Alunos com turma: ${alunosComTurma.length}`);

            for (const turma of this.turmas) {
                const alunosNaTurma = this.alunos.filter(a => a.turma_id === turma.id);
                console.log(`   🔍 ${turma.nome}: ${alunosNaTurma.length} alunos vs ${turma.quantidade_alunos} registrado`);

                if (alunosNaTurma.length !== turma.quantidade_alunos) {
                    console.warn(`   ⚠️ INCONSISTÊNCIA: Diferença de ${Math.abs(alunosNaTurma.length - turma.quantidade_alunos)}`);
                }
            }

            console.groupEnd();
            this.showNotification('Diagnóstico completo concluído - Verifique o console', 'info');

        } catch (error) {
            console.error('❌ Erro no diagnóstico completo:', error);
        }
    }

    verificarElementosModal() {
        console.group('🔍 VERIFICANDO ELEMENTOS DO MODAL');

        const elementos = [
            'turmaModal', 'turmaForm', 'turmaModalTitle', 'turmaId',
            'turmaNome', 'turmaCurso', 'turmaPeriodo', 'turmaAno', 'turmaAtiva'
        ];

        elementos.forEach(id => {
            const element = document.getElementById(id);
            console.log(`${id}:`, element ? '✅ Encontrado' : '❌ Não encontrado');

            if (element) {
                console.log(`   📝 Conteúdo:`, element.value || element.textContent || element.innerHTML.substring(0, 50));
            }
        });

        console.groupEnd();
        this.showNotification('Verificação de elementos concluída - Verifique o console', 'info');
    }

    verificarEstruturaTurmas() {
        console.group('🔍 VERIFICANDO ESTRUTURA DAS TURMAS');

        if (!Array.isArray(this.turmas) || this.turmas.length === 0) {
            console.log('❌ Nenhuma turma carregada');
            console.groupEnd();
            return;
        }

        const primeiraTurma = this.turmas[0];
        console.log('📋 Estrutura da primeira turma:', primeiraTurma);
        console.log('📊 Campos disponíveis:', Object.keys(primeiraTurma));

        console.log('🎯 Tipos de dados:');
        Object.keys(primeiraTurma).forEach(key => {
            console.log(`   ${key}: ${typeof primeiraTurma[key]} = ${primeiraTurma[key]}`);
        });

        console.groupEnd();
    }

    sincronizarComDashboard() {
        if (window.adminManager && typeof adminManager.atualizarTurmasDashboard === 'function') {
            console.log('🔄 Sincronizando turmas com dashboard...');
            adminManager.atualizarTurmasDashboard();
        }
    }

    prepararModalMobile(modalElement) {
        document.body.classList.add('modal-open');

        setTimeout(() => {
            const firstInput = modalElement.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 300);
    }

    setupModalEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.style.display = 'none';
                document.body.classList.remove('modal-open');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal-overlay');
                modals.forEach(modal => {
                    modal.style.display = 'none';
                });
                document.body.classList.remove('modal-open');
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-content')) {
                e.stopPropagation();
            }
        });
    }

    setupEventListeners() {
        console.log('✅ Event listeners configurados para turmas');

        const turmaForm = document.getElementById('turmaForm');
        if (turmaForm) {
            turmaForm.addEventListener('submit', (e) => this.salvarTurma(e));
        } else {
            console.log('ℹ️ Formulário de turma não encontrado no carregamento inicial');
        }

        this.setupModalEventListeners();
    }

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return 'N/A';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatarData(dataString) {
        if (!dataString) return 'N/A';
        try {
            const data = new Date(dataString);
            if (isNaN(data.getTime())) {
                return 'Data inválida';
            }

            return data.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            console.warn('⚠️ Erro ao formatar data:', dataString, error);
            return 'N/A';
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 10000;
                background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, duration);
        }
    }

    debugModalGerenciarVinculos() {
        console.group('🔍 DEBUG MODAL GERENCIAR VÍNCULOS');

        // Verificar se o modal existe
        const modal = document.getElementById('modal-gerenciar-vinculos');
        console.log('📋 Modal pelo ID:', modal);

        if (modal) {
            console.log('🎯 Display do modal:', modal.style.display);
            console.log('📊 Conteúdo do modal:', modal.textContent?.substring(0, 100));

            // Verificar o tbody
            const tbody = modal.querySelector('#listaAlunosVinculados') || modal.querySelector('tbody');
            console.log('📋 Tbody encontrado:', tbody);

            if (tbody) {
                const linhas = tbody.querySelectorAll('tr');
                console.log('📊 Linhas no tbody:', linhas.length);

                // Mostrar IDs dos alunos atuais
                linhas.forEach((linha, index) => {
                    const checkbox = linha.querySelector('.aluno-vinculado-checkbox');
                    if (checkbox) {
                        console.log(`   Aluno ${index + 1}: ID ${checkbox.value}`);
                    }
                });
            }
        } else {
            console.log('🔍 Procurando modais abertos...');
            const modaisAbertos = document.querySelectorAll('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
            console.log(`📊 ${modaisAbertos.length} modal(is) aberto(s) encontrado(s):`);

            modaisAbertos.forEach((modal, index) => {
                console.log(`   Modal ${index + 1}:`, {
                    id: modal.id,
                    display: modal.style.display,
                    texto: modal.textContent?.substring(0, 100)
                });
            });
        }

        console.groupEnd();
    }

    async buscarAlunosDaTurma(turmaId) {
        try {
            await this.carregarAlunos();
            return this.alunos.filter(aluno => aluno.turma_id === turmaId);
        } catch (error) {
            console.error('❌ Erro ao buscar alunos da turma:', error);
            return [];
        }
    }
}

const adminTurmas = new AdminTurmas();

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 DOM Carregado - Inicializando AdminTurmas...');

    setTimeout(async () => {
        try {
            await adminTurmas.init();
            console.log('✅ AdminTurmas inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização do AdminTurmas:', error);
        }
    }, 100);
});

window.AdminTurmas = AdminTurmas;
window.adminTurmas = adminTurmas;