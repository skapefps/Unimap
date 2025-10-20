// js/admin-usuarios.js - VERSÃO COMPLETA E CORRIGIDA
class AdminUsuarios {
    constructor() {
        this.usuarios = [];
        this.usuariosFiltrados = [];
        this.turmas = [];
        this.alunos = [];
        this.paginaAtual = 1;
        this.itensPorPagina = 10;
        this.usuarioEditando = null;
        this.turmaEditando = null;
        this.carregando = false;
        this.inicializado = false;
    }

    // Inicializar
    async init() {
        if (this.inicializado) {
            console.log('✅ AdminUsuarios já foi inicializado');
            return;
        }

        try {
            console.log('🚀 Inicializando AdminUsuarios...');
            
            // 🔥 CARREGAR DADOS BÁSICOS
            await this.carregarTurmas();
            await this.carregarUsuarios();
            await this.carregarAlunos();
            
            // 🔥 CONFIGURAÇÕES (COM VERIFICAÇÃO DE EXISTÊNCIA)
            if (typeof this.setupEventListeners === 'function') {
                this.setupEventListeners();
            } else {
                console.warn('⚠️ setupEventListeners não encontrado');
            }
            
            if (typeof this.verificarElementosModal === 'function') {
                this.verificarElementosModal();
            } else {
                console.warn('⚠️ verificarElementosModal não encontrado');
            }
            
            this.inicializado = true;
            console.log('✅ AdminUsuarios inicializado com sucesso');
            
            // 🔥 DEBUG (OPCIONAL - SÓ SE EXISTIR)
            if (typeof this.debugDados === 'function') {
                setTimeout(() => {
                    this.debugDados();
                }, 1000);
            }
            
        } catch (error) {
            console.error('❌ Erro na inicialização do AdminUsuarios:', error);
            this.inicializado = true; // Não travar o sistema
        }
    }

    // Fazer requisições autenticadas
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
            
            // Lidar melhor com respostas não-JSON
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

    // Carregar todos os usuários
    async carregarUsuarios() {
        if (this.carregando) {
            console.log('⏳ Já está carregando usuários, ignorando chamada duplicada...');
            return;
        }

        this.carregando = true;

        try {
            console.log('📥 Carregando usuários...');
            
            const response = await this.makeRequest('/usuarios');
            
            if (response.success) {
                let usuariosArray = [];
                
                if (Array.isArray(response.data)) {
                    usuariosArray = response.data;
                } else if (response.data && Array.isArray(response.data.usuarios)) {
                    usuariosArray = response.data.usuarios;
                } else if (response.data && Array.isArray(response.data.data)) {
                    usuariosArray = response.data.data;
                } else if (Array.isArray(response)) {
                    usuariosArray = response;
                } else {
                    console.warn('⚠️ Estrutura inesperada da resposta:', response);
                    usuariosArray = [];
                }
                
                console.log('👥 Usuários carregados:', usuariosArray.length);
                
                this.usuarios = Array.isArray(usuariosArray) ? usuariosArray : [];
                this.usuariosFiltrados = [...this.usuarios];
                
                this.atualizarEstatisticas();
                this.exibirUsuarios();
                
                this.showNotification(`Carregados ${this.usuarios.length} usuários`, 'success');
            } else {
                throw new Error(response.error || 'Erro ao carregar usuários');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar usuários:', error);
            this.showNotification('Erro ao carregar usuários: ' + error.message, 'error');
            this.usuarios = [];
            this.usuariosFiltrados = [];
            this.exibirUsuarios();
        } finally {
            this.carregando = false;
        }
    }
    
    // Método carregarTurmas robusto
    async carregarTurmas() {
        try {
            console.log('📚 Carregando turmas...');
            
            // 🔥 PRIMEIRO TENTAR CARREGAR DADOS COMPLETOS
            const dadosCompletos = localStorage.getItem('unimap_dados_completos');
            if (dadosCompletos) {
                const dados = JSON.parse(dadosCompletos);
                console.log('📦 Dados completos encontrados:', dados);
                
                if (dados.turmas && Array.isArray(dados.turmas)) {
                    this.turmas = dados.turmas;
                    console.log('✅ Turmas carregadas do localStorage:', this.turmas.length);
                }
                
                if (dados.alunos && Array.isArray(dados.alunos)) {
                    this.alunos = dados.alunos;
                    console.log('✅ Alunos carregados do localStorage:', this.alunos.length);
                }
                
                // 🔥 RECALCULAR CONTADORES AO CARREGAR
                if (typeof this.recalcularContadoresTurmas === 'function') {
                    this.recalcularContadoresTurmas();
                }
                
                this.renderizarTurmas();
                return;
            }
            
            // Se não houver dados completos, tentar API
            try {
                const response = await this.makeRequest('/turmas');
                if (response && response.success) {
                    this.turmas = this.processarTurmas(response.data || []);
                    this.salvarDadosCompletos(); // Salvar como dados completos
                    console.log('✅ Turmas carregadas via API:', this.turmas.length);
                    this.renderizarTurmas();
                    return;
                }
            } catch (apiError) {
                console.warn('⚠️ API não disponível, usando dados iniciais:', apiError);
            }
            
            // 🔥 SE NADA FUNCIONAR, USAR DADOS INICIAIS E SALVAR
            await this.usarTurmasLocais();
            this.salvarDadosCompletos();
            
        } catch (error) {
            console.error('❌ Erro ao carregar turmas:', error);
            await this.usarTurmasLocais();
            if (typeof this.recalcularContadoresTurmas === 'function') {
                this.recalcularContadoresTurmas();
            }
            this.salvarDadosCompletos();
            this.renderizarTurmas();
        }
    }

    // Processar turmas para garantir estrutura correta
    processarTurmas(turmasData) {
        if (!Array.isArray(turmasData)) {
            console.warn('⚠️ Dados de turmas não são um array:', turmasData);
            return [];
        }

        return turmasData.map(turma => ({
            id: turma.id || Math.random(),
            nome: turma.nome || 'Turma sem nome',
            curso: turma.curso || 'Curso não definido',
            periodo: turma.periodo || '1',
            ano: turma.ano || new Date().getFullYear(),
            quantidade_alunos: turma.quantidade_alunos || 0,
            ativa: turma.ativa !== undefined ? turma.ativa : true,
        }));
    }

    // Método usarTurmasLocais
    async usarTurmasLocais() {
        console.log('🔄 Carregando turmas locais...');
        
        this.turmas = [
            {
                id: 1,
                nome: 'SI-2024-1A',
                curso: 'Sistemas de Informação',
                periodo: '1',
                ano: 2024,
                quantidade_alunos: 3,
                ativa: true,
                data_criacao: '2024-01-01'
            },
            {
                id: 2,
                nome: 'ADM-2024-1A',
                curso: 'Administração',
                periodo: '1',
                ano: 2024,
                quantidade_alunos: 2,
                ativa: true,
                data_criacao: '2024-01-01'
            },
            {
                id: 3,
                nome: 'DIR-2024-1A',
                curso: 'Direito',
                periodo: '1',
                ano: 2024,
                quantidade_alunos: 1,
                ativa: true,
                data_criacao: '2024-01-01'
            }
        ];
        
        console.log('✅ Turmas locais carregadas:', this.turmas.length);
    }

    // Método carregarAlunos
    async carregarAlunos() {
        try {
            console.log('👥 Carregando alunos...');
            
            // 🔥 PRIMEIRO VERIFICAR DADOS COMPLETOS
            const dadosCompletos = localStorage.getItem('unimap_dados_completos');
            if (dadosCompletos) {
                const dados = JSON.parse(dadosCompletos);
                if (dados.alunos && Array.isArray(dados.alunos)) {
                    this.alunos = dados.alunos;
                    console.log('✅ Alunos carregados do localStorage:', this.alunos.length);
                    return;
                }
            }
            
            // Se não, tentar API
            const response = await this.makeRequest('/usuarios?tipo=aluno');
            
            console.log('📡 Resposta completa da API:', response);
            
            if (response && response.success) {
                let alunosArray = [];
                
                if (Array.isArray(response.data)) {
                    alunosArray = response.data;
                } else if (response.data && Array.isArray(response.data.data)) {
                    alunosArray = response.data.data;
                } else if (response.data && Array.isArray(response.data.usuarios)) {
                    alunosArray = response.data.usuarios;
                } else if (Array.isArray(response)) {
                    alunosArray = response;
                } else {
                    console.warn('⚠️ Estrutura inesperada, usando resposta direta');
                    alunosArray = response.data || [];
                }
                
                this.alunos = alunosArray;
                console.log('✅ Alunos carregados via API:', this.alunos.length);
                
                // 🔥 SALVAR NOS DADOS COMPLETOS
                this.salvarDadosCompletos();
            } else {
                console.warn('⚠️ Erro ao carregar alunos, usando lista vazia');
                this.alunos = [];
                this.salvarDadosCompletos();
            }
        } catch (error) {
            console.error('❌ Erro ao carregar alunos:', error);
            this.alunos = [];
            this.salvarDadosCompletos();
        }
    }

    // 🔥 CORREÇÃO: Método renderizarTurmas
    renderizarTurmas() {
        console.log('🎯 Renderizando turmas...');
        
        // 🔥 CORREÇÃO: Verificar se estamos na página correta
        const tbody = document.getElementById('turmas-body');
        if (!tbody) {
            console.log('ℹ️ Tabela de turmas não encontrada - provavelmente não estamos na página de turmas');
            return; // Não é um erro, apenas não estamos na página de gerenciamento de turmas
        }

        if (!Array.isArray(this.turmas) || this.turmas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhuma turma cadastrada</p>
                        <button onclick="adminUsuarios.abrirModalCriarTurma()" class="btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Criar Primeira Turma
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.turmas.map(turma => `
            <tr>
                <td><strong>${this.escapeHtml(turma.nome)}</strong></td>
                <td>${this.escapeHtml(turma.curso)}</td>
                <td>${turma.periodo}° Período</td>
                <td>
                    <span class="badge ${turma.quantidade_alunos > 0 ? 'active' : 'inactive'}">
                        ${turma.quantidade_alunos} alunos
                    </span>
                </td>
                <td>${turma.ano}</td>
                <td>
                    <button class="btn-action small" onclick="adminUsuarios.vincularAlunosTurma(${turma.id})" 
                            title="Vincular alunos">
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn-action small" onclick="adminUsuarios.editarTurma(${turma.id})" 
                            title="Editar turma">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action small secundario" onclick="adminUsuarios.verAlunosTurma(${turma.id})"
                            title="Ver alunos da turma">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="btn-action small perigo" onclick="adminUsuarios.excluirTurma(${turma.id})"
                            title="Excluir turma">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        console.log('✅ Turmas renderizadas:', this.turmas.length);
    }

    // MODAL DE TURMAS
    abrirModalCriarTurma() {
        this.turmaEditando = null;
        document.getElementById('turmaModalTitle').textContent = 'Nova Turma';
        document.getElementById('turmaId').value = '';
        document.getElementById('turmaForm').reset();
        document.getElementById('turmaModal').style.display = 'flex';
    }

    // 🔥 CORREÇÃO: Método vincularAlunosTurma
    async vincularAlunosTurma(turmaId) {
        try {
            console.log('🎯 Vincular alunos à turma:', turmaId);
            
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            this.turmaEditando = turma;
            
            // 🔥 VERIFICAR EM QUAL PÁGINA ESTAMOS E USAR OS ELEMENTOS CORRETOS
            const isAdminPage = window.location.pathname.includes('admin.html');
            const isUsuariosPage = window.location.pathname.includes('admin-usuarios.html');
            
            console.log('📍 Página atual:', {
                pathname: window.location.pathname,
                isAdminPage: isAdminPage,
                isUsuariosPage: isUsuariosPage
            });
            
            if (isAdminPage) {
                // 🔥 ESTAMOS NO DASHBOARD (admin.html) - MODAL DIFERENTE
                await this.abrirModalVincularAlunosNoDashboard(turma);
            } else if (isUsuariosPage) {
                // 🔥 ESTAMOS NA PÁGINA DE USUÁRIOS - MODAL NORMAL
                await this.abrirModalVincularAlunosNormal(turma);
            } else {
                throw new Error('Página não reconhecida');
            }

        } catch (error) {
            console.error('❌ Erro ao abrir modal de vínculo:', error);
            this.showNotification('Erro ao abrir modal: ' + error.message, 'error');
        }
    }

    // 🔥 NOVO MÉTODO PARA DASHBOARD
    async abrirModalVincularAlunosNoDashboard(turma) {
        try {
            console.log('📱 Abrindo modal no Dashboard...');
            
            // No dashboard, criar um modal dinâmico
            this.criarModalVincularAlunosDinamico(turma);
            
        } catch (error) {
            console.error('❌ Erro no modal do dashboard:', error);
            throw error;
        }
    }

    // 🔥 NOVO MÉTODO PARA PÁGINA DE USUÁRIOS
    async abrirModalVincularAlunosNormal(turma) {
        try {
            console.log('💻 Abrindo modal normal...');
            
            const turmaNomeElement = document.getElementById('turmaSelecionadaNome');
            if (!turmaNomeElement) {
                throw new Error('Elemento turmaSelecionadaNome não encontrado');
            }
            
            turmaNomeElement.textContent = turma.nome;
            
            // Carregar alunos atualizados
            await this.carregarAlunos();
            this.renderizarListaAlunosParaTurma();
            
            const modal = document.getElementById('vincularAlunosModal');
            if (!modal) {
                throw new Error('Modal vincularAlunosModal não encontrado');
            }
            
            modal.style.display = 'flex';
            
        } catch (error) {
            console.error('❌ Erro no modal normal:', error);
            throw error;
        }
    }

    // 🔥 CRIAR MODAL DINÂMICO PARA O DASHBOARD
    criarModalVincularAlunosDinamico(turma) {
        try {
            // Remover modais existentes
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                if (modal.id !== 'turmaModal') { // Não remover o modal de turma
                    modal.remove();
                }
            });

            // Criar modal dinâmico
            const modalHTML = `
                <div class="modal-overlay" id="vincularAlunosModalDashboard" style="display: flex;">
                    <div class="modal-content" style="max-width: 800px;">
                        <div class="modal-header">
                            <h3><i class="fas fa-user-plus"></i> Vincular Alunos à Turma</h3>
                            <button class="modal-close" onclick="adminUsuarios.fecharModalVincularAlunosDashboard()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label>Turma: <strong>${this.escapeHtml(turma.nome)}</strong></label>
                            </div>
                            
                            <div class="form-group">
                                <label>Buscar Alunos:</label>
                                <input type="text" id="buscarAlunosTurmaDashboard" class="form-control" 
                                       placeholder="Digite o nome ou matrícula do aluno...">
                            </div>
                            
                            <div class="alunos-list-container" style="max-height: 300px; overflow-y: auto;">
                                <table class="alunos-table">
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" id="selecionarTodosAlunosDashboard"></th>
                                            <th>Nome</th>
                                            <th>Matrícula</th>
                                            <th>Email</th>
                                            <th>Turma Atual</th>
                                        </tr>
                                    </thead>
                                    <tbody id="listaAlunosTurmaDashboard">
                                        <!-- Preenchido via JavaScript -->
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="btn-group">
                                <button type="button" class="btn-primary" onclick="adminUsuarios.vincularAlunosSelecionadosDashboard()">
                                    <i class="fas fa-link"></i> Vincular Alunos Selecionados
                                </button>
                                <button type="button" class="btn-secondary" onclick="adminUsuarios.fecharModalVincularAlunosDashboard()">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Adicionar modal ao body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Carregar e renderizar alunos
            this.carregarAlunos().then(() => {
                this.renderizarListaAlunosParaTurmaDashboard();
            });

        } catch (error) {
            console.error('❌ Erro ao criar modal dinâmico:', error);
            throw error;
        }
    }

    // 🔥 RENDERIZAR LISTA DE ALUNOS NO MODAL DO DASHBOARD
    renderizarListaAlunosParaTurmaDashboard() {
        const tbody = document.getElementById('listaAlunosTurmaDashboard');
        if (!tbody) {
            console.error('❌ Elemento listaAlunosTurmaDashboard não encontrado');
            return;
        }

        if (!Array.isArray(this.alunos) || this.alunos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum aluno encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.alunos.map(aluno => {
            const jaNaTurma = aluno.turma_id === this.turmaEditando?.id;
            
            return `
                <tr>
                    <td>
                        <input type="checkbox" class="aluno-checkbox-dashboard" value="${aluno.id}" 
                               ${jaNaTurma ? 'disabled' : ''}>
                        ${jaNaTurma ? '<small>(já vinculado)</small>' : ''}
                    </td>
                    <td>${this.escapeHtml(aluno.nome)}</td>
                    <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                    <td>${this.escapeHtml(aluno.email)}</td>
                    <td>
                        <span class="badge ${aluno.turma_id ? 'active' : 'inactive'}">
                            ${aluno.turma_nome || 'Sem turma'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        this.configurarSelecaoAlunosDashboard();
    }

    // 🔥 CONFIGURAR SELEÇÃO NO DASHBOARD
    configurarSelecaoAlunosDashboard() {
        const selecionarTodos = document.getElementById('selecionarTodosAlunosDashboard');
        const checkboxes = document.querySelectorAll('.aluno-checkbox-dashboard');
        const buscarInput = document.getElementById('buscarAlunosTurmaDashboard');

        if (selecionarTodos) {
            selecionarTodos.addEventListener('change', (e) => {
                checkboxes.forEach(checkbox => {
                    if (!checkbox.disabled) {
                        checkbox.checked = e.target.checked;
                    }
                });
            });
        }

        if (buscarInput) {
            buscarInput.addEventListener('input', (e) => {
                const termo = e.target.value.toLowerCase();
                const linhas = document.querySelectorAll('#listaAlunosTurmaDashboard tr');
                
                linhas.forEach(linha => {
                    const texto = linha.textContent.toLowerCase();
                    linha.style.display = texto.includes(termo) ? '' : 'none';
                });
            });
        }
    }

    // 🔥 VINCULAR ALUNOS NO DASHBOARD
    async vincularAlunosSelecionadosDashboard() {
        try {
            const checkboxes = document.querySelectorAll('.aluno-checkbox-dashboard:checked:not(:disabled)');
            const alunosIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

            if (alunosIds.length === 0) {
                this.showNotification('Selecione pelo menos um aluno', 'warning');
                return;
            }

            const turmaId = this.turmaEditando?.id;
            if (!turmaId) {
                throw new Error('Turma não selecionada');
            }

            console.log('🎯 Vinculando alunos do dashboard:', { turmaId, alunosIds });

            await this.vincularAlunosLocal(turmaId, alunosIds);
            
        } catch (error) {
            console.error('❌ Erro ao vincular alunos no dashboard:', error);
            this.showNotification('Erro ao vincular alunos: ' + error.message, 'error');
        }
    }

    // 🔥 FECHAR MODAL DO DASHBOARD
    fecharModalVincularAlunosDashboard() {
        const modal = document.getElementById('vincularAlunosModalDashboard');
        if (modal) {
            modal.remove();
        }
        this.turmaEditando = null;
    }

    // 🔥 CORREÇÃO: Método editarTurma
    async editarTurma(turmaId) {
        try {
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            this.turmaEditando = turma;

            // 🔥 VERIFICAR SE ESTAMOS NO DASHBOARD OU PÁGINA DE USUÁRIOS
            const isAdminPage = window.location.pathname.includes('admin.html');
            
            if (isAdminPage) {
                // 🔥 NO DASHBOARD - USAR MODAL EXISTENTE
                await this.abrirEdicaoTurmaNoDashboard(turma);
            } else {
                // 🔥 NA PÁGINA DE USUÁRIOS - USAR MODAL NORMAL
                await this.abrirEdicaoTurmaNormal(turma);
            }

        } catch (error) {
            console.error('❌ Erro ao abrir edição da turma:', error);
            this.showNotification('Erro ao carregar dados da turma', 'error');
        }
    }

    // 🔥 ABRIR EDIÇÃO NO DASHBOARD
    async abrirEdicaoTurmaNoDashboard(turma) {
        try {
            document.getElementById('turmaModalTitle').textContent = 'Editar Turma';
            document.getElementById('turmaId').value = turma.id;
            document.getElementById('turmaNome').value = turma.nome || '';
            document.getElementById('turmaCurso').value = turma.curso || '';
            document.getElementById('turmaPeriodo').value = turma.periodo || '';
            document.getElementById('turmaAno').value = turma.ano || new Date().getFullYear();

            document.getElementById('turmaModal').style.display = 'flex';
        } catch (error) {
            console.error('❌ Erro ao abrir edição no dashboard:', error);
            throw error;
        }
    }

    // 🔥 ABRIR EDIÇÃO NORMAL
    async abrirEdicaoTurmaNormal(turma) {
        try {
            document.getElementById('turmaModalTitle').textContent = 'Editar Turma';
            document.getElementById('turmaId').value = turma.id;
            document.getElementById('turmaNome').value = turma.nome || '';
            document.getElementById('turmaCurso').value = turma.curso || '';
            document.getElementById('turmaPeriodo').value = turma.periodo || '';
            document.getElementById('turmaAno').value = turma.ano || new Date().getFullYear();

            document.getElementById('turmaModal').style.display = 'flex';
        } catch (error) {
            console.error('❌ Erro ao abrir edição normal:', error);
            throw error;
        }
    }

    fecharModalTurma() {
        document.getElementById('turmaModal').style.display = 'none';
        this.turmaEditando = null;
        document.getElementById('turmaForm').reset();
    }

    // Métodos de turma atualizados para usar localStorage
    async salvarTurma(event) {
        if (event) event.preventDefault();

        try {
            const turmaId = document.getElementById('turmaId').value;
            const dadosTurma = {
                nome: document.getElementById('turmaNome').value,
                curso: document.getElementById('turmaCurso').value,
                periodo: parseInt(document.getElementById('turmaPeriodo').value),
                ano: parseInt(document.getElementById('turmaAno').value),
                quantidade_alunos: 0,
                ativa: true,
                ultima_atualizacao: new Date().toISOString()
            };

            console.log('💾 Salvando turma localmente:', dadosTurma);

            if (turmaId) {
                // Editar turma existente
                const index = this.turmas.findIndex(t => t.id == turmaId);
                if (index !== -1) {
                    this.turmas[index] = { ...this.turmas[index], ...dadosTurma };
                }
            } else {
                // Criar nova turma
                const novaTurma = {
                    id: Date.now(), // ID temporário
                    ...dadosTurma
                };
                this.turmas.push(novaTurma);
            }

            // 🔥 RECALCULAR CONTADORES
            if (typeof this.recalcularContadoresTurmas === 'function') {
                this.recalcularContadoresTurmas();
            }

            // 🔥 SALVAR DADOS COMPLETOS IMEDIATAMENTE
            this.salvarDadosCompletos();

            this.showNotification(
                turmaId ? 'Turma atualizada com sucesso!' : 'Turma criada com sucesso!', 
                'success'
            );
            
            this.fecharModalTurma();
            this.renderizarTurmas();
            
        } catch (error) {
            console.error('❌ Erro ao salvar turma:', error);
            this.showNotification('Erro ao salvar turma: ' + error.message, 'error');
        }
    }

    async excluirTurma(turmaId) {
        if (!confirm('Tem certeza que deseja excluir esta turma? Os alunos vinculados serão desvinculados.')) {
            return;
        }

        try {
            // 🔥 PRIMEIRO DESVINCULAR ALUNOS DESTA TURMA
            this.alunos.forEach(aluno => {
                if (aluno.turma_id === turmaId) {
                    aluno.turma_id = null;
                    aluno.turma_nome = null;
                }
            });

            // Remover turma
            this.turmas = this.turmas.filter(t => t.id !== turmaId);

            // 🔥 RECALCULAR CONTADORES
            if (typeof this.recalcularContadoresTurmas === 'function') {
                this.recalcularContadoresTurmas();
            }

            // Salvar no localStorage
            this.salvarDadosCompletos();

            this.showNotification('Turma excluída com sucesso!', 'success');
            this.renderizarTurmas();
            
        } catch (error) {
            console.error('❌ Erro ao excluir turma:', error);
            this.showNotification('Erro ao excluir turma: ' + error.message, 'error');
        }
    }

    // VINCULAR ALUNOS À TURMA
    async vincularAlunosSelecionados() {
        try {
            const checkboxes = document.querySelectorAll('.aluno-checkbox:checked:not(:disabled)');
            const alunosIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

            if (alunosIds.length === 0) {
                this.showNotification('Selecione pelo menos um aluno', 'warning');
                return;
            }

            const turmaId = this.turmaEditando?.id;
            if (!turmaId) {
                throw new Error('Turma não selecionada');
            }

            console.log('🎯 Vinculando alunos:', { turmaId, alunosIds });

            // 🔥 USAR APENAS FALLBACK LOCAL (API NÃO DISPONÍVEL)
            await this.vincularAlunosLocal(turmaId, alunosIds);
            
        } catch (error) {
            console.error('❌ Erro ao vincular alunos:', error);
            this.showNotification('Erro ao vincular alunos. Verifique se a API está funcionando.', 'error');
        }
    }

    // 🔥 MÉTODO FALLBACK LOCAL MELHORADO
    async vincularAlunosLocal(turmaId, alunosIds) {
        try {
            console.log('🔄 Vinculando alunos localmente...');
            
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            // Buscar alunos selecionados que NÃO estão já na turma
            const alunosSelecionados = this.alunos.filter(aluno => 
                alunosIds.includes(aluno.id) && aluno.turma_id !== turmaId
            );

            if (alunosSelecionados.length === 0) {
                this.showNotification('Nenhum aluno novo para vincular', 'warning');
                return;
            }

            console.log(`👥 Vincular ${alunosSelecionados.length} aluno(s) à turma ${turma.nome}`);

            // Atualizar dados dos alunos
            alunosSelecionados.forEach(aluno => {
                aluno.turma_id = turmaId;
                aluno.turma_nome = turma.nome;
                aluno.ultima_atualizacao = new Date().toISOString();
            });

            // 🔥 USAR RECÁLCULO EM VEZ DE ATUALIZAÇÃO MANUAL
            if (typeof this.recalcularContadoresTurmas === 'function') {
                this.recalcularContadoresTurmas();
            }

            // Salvar imediatamente no localStorage
            this.salvarDadosCompletos();

            this.showNotification(
                `${alunosSelecionados.length} aluno(s) vinculado(s) à turma ${turma.nome}!`, 
                'success'
            );
            
            this.fecharModalVincularAlunos();
            this.renderizarTurmas();

        } catch (error) {
            console.error('❌ Erro no vínculo local:', error);
            throw error;
        }
    }

    fecharModalVincularAlunos() {
        // Fechar modal normal (admin-usuarios.html)
        const modalNormal = document.getElementById('vincularAlunosModal');
        if (modalNormal) {
            modalNormal.style.display = 'none';
        }
        
        // Fechar modal do dashboard (admin.html)
        const modalDashboard = document.getElementById('vincularAlunosModalDashboard');
        if (modalDashboard) {
            modalDashboard.remove();
        }
        
        this.turmaEditando = null;
        
        // Limpar busca
        const buscarInput = document.getElementById('buscarAlunosTurma');
        if (buscarInput) buscarInput.value = '';
        
        const buscarInputDashboard = document.getElementById('buscarAlunosTurmaDashboard');
        if (buscarInputDashboard) buscarInputDashboard.value = '';
    }

    // RENDERIZAR LISTA DE ALUNOS PARA TURMA
    renderizarListaAlunosParaTurma() {
        const tbody = document.getElementById('listaAlunosTurma');
        if (!tbody) {
            console.error('❌ Elemento listaAlunosTurma não encontrado');
            return;
        }

        if (!Array.isArray(this.alunos) || this.alunos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum aluno encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.alunos.map(aluno => {
            const jaNaTurma = aluno.turma_id === this.turmaEditando?.id;
            
            return `
                <tr>
                    <td>
                        <input type="checkbox" class="aluno-checkbox" value="${aluno.id}" 
                               ${jaNaTurma ? 'disabled' : ''}>
                        ${jaNaTurma ? '<small>(já vinculado)</small>' : ''}
                    </td>
                    <td>${this.escapeHtml(aluno.nome)}</td>
                    <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                    <td>${this.escapeHtml(aluno.email)}</td>
                    <td>
                        <span class="badge ${aluno.turma_id ? 'active' : 'inactive'}">
                            ${aluno.turma_nome || 'Sem turma'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        this.configurarSelecaoAlunos();
    }

    configurarSelecaoAlunos() {
        const selecionarTodos = document.getElementById('selecionarTodosAlunos');
        const checkboxes = document.querySelectorAll('.aluno-checkbox');
        const buscarInput = document.getElementById('buscarAlunosTurma');

        if (selecionarTodos) {
            selecionarTodos.addEventListener('change', (e) => {
                checkboxes.forEach(checkbox => {
                    if (!checkbox.disabled) {
                        checkbox.checked = e.target.checked;
                    }
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
    }

    async verAlunosTurma(turmaId) {
        try {
            console.log('👀 Ver alunos da turma:', turmaId);
            
            let alunosDaTurma = [];
            
            // 🔥 USAR APENAS DADOS LOCAIS (API NÃO FUNCIONA)
            const turma = this.turmas.find(t => t.id === turmaId);
            if (turma) {
                // Filtrar alunos que estão nesta turma
                alunosDaTurma = this.alunos.filter(aluno => 
                    aluno.turma_id === turmaId
                );
                
                console.log(`✅ ${alunosDaTurma.length} alunos na turma ${turma.nome}`);
            }

            this.mostrarModalAlunosTurma(alunosDaTurma, turmaId);
            
        } catch (error) {
            console.error('❌ Erro ao carregar alunos da turma:', error);
            this.showNotification('Erro ao carregar alunos: ' + error.message, 'error');
        }
    }

    mostrarModalAlunosTurma(alunos, turmaId) {
        const turma = this.turmas.find(t => t.id === turmaId);
        const turmaNome = turma ? turma.nome : 'Turma';
        
        const modalHTML = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 700px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-users"></i> Alunos da Turma - ${this.escapeHtml(turmaNome)}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
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
                                        </tr>
                                    `).join('')}
                                    ${alunos.length === 0 ? `
                                        <tr>
                                            <td colspan="5" class="empty-state">
                                                <i class="fas fa-users-slash"></i>
                                                <p>Nenhum aluno nesta turma</p>
                                            </td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // MÉTODOS PARA USUÁRIOS
    atualizarEstatisticas() {
        try {
            if (!Array.isArray(this.usuarios)) {
                console.warn('⚠️ this.usuarios não é um array:', this.usuarios);
                this.usuarios = [];
            }

            const totalUsuarios = this.usuarios.length;
            const totalAlunos = this.usuarios.filter(u => u && u.tipo === 'aluno').length;
            const totalProfessores = this.usuarios.filter(u => u && u.tipo === 'professor').length;
            const totalAdmins = this.usuarios.filter(u => u && u.tipo === 'admin').length;

            const totalUsuariosEl = document.getElementById('totalUsuarios');
            const totalAlunosEl = document.getElementById('totalAlunos');
            const totalProfessoresEl = document.getElementById('totalProfessores');
            const totalAdminsEl = document.getElementById('totalAdmins');

            if (totalUsuariosEl) totalUsuariosEl.textContent = totalUsuarios;
            if (totalAlunosEl) totalAlunosEl.textContent = totalAlunos;
            if (totalProfessoresEl) totalProfessoresEl.textContent = totalProfessores;
            if (totalAdminsEl) totalAdminsEl.textContent = totalAdmins;

            console.log('📊 Estatísticas atualizadas:', { totalUsuarios, totalAlunos, totalProfessores, totalAdmins });
        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas:', error);
        }
    }

    exibirUsuarios() {
        const tbody = document.getElementById('usuarios-body');
        if (!tbody) {
            console.error('❌ Elemento usuarios-body não encontrado');
            return;
        }

        try {
            if (!Array.isArray(this.usuariosFiltrados)) {
                console.warn('⚠️ usuariosFiltrados não é array, resetando...');
                this.usuariosFiltrados = [];
            }

            const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
            const fim = inicio + this.itensPorPagina;
            const usuariosPagina = this.usuariosFiltrados.slice(inicio, fim);

            if (!usuariosPagina || usuariosPagina.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state">
                            <i class="fas fa-users-slash"></i>
                            <p>Nenhum usuário encontrado</p>
                            <button onclick="adminUsuarios.recarregarUsuarios()" class="btn-primary" style="margin-top: 10px;">
                                <i class="fas fa-redo"></i> Recarregar
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = usuariosPagina.map(usuario => `
                    <tr>
                        <td><strong>${this.escapeHtml(usuario.nome || 'N/A')}</strong></td>
                        <td>${this.escapeHtml(usuario.email || 'N/A')}</td>
                        <td>${this.escapeHtml(usuario.matricula || 'N/A')}</td>
                        <td>
                            <span class="badge ${usuario.tipo || 'aluno'}">
                                ${this.formatarTipo(usuario.tipo)}
                            </span>
                        </td>
                        <td>${this.escapeHtml(usuario.curso || 'N/A')}</td>
                        <td>${this.formatarData(usuario.data_cadastro)}</td>
                        <td>
                            <button class="btn-action small" onclick="adminUsuarios.editarUsuario(${usuario.id})" 
                                    title="Editar usuário">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-action small secundario" 
                                    onclick="adminUsuarios.alterarTipo(${usuario.id}, '${usuario.tipo}')"
                                    title="Alterar tipo">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }

            this.atualizarPaginacao();
        } catch (error) {
            console.error('❌ Erro ao exibir usuários:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erro ao carregar lista de usuários</p>
                        <button onclick="adminUsuarios.recarregarUsuarios()" class="btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-redo"></i> Tentar Novamente
                        </button>
                    </td>
                </tr>
            `;
        }
    }

    async recarregarUsuarios() {
        console.log('🔄 Recarregando usuários manualmente...');
        await this.carregarUsuarios();
    }

    filtrarUsuarios(termo) {
        try {
            if (!termo) {
                this.usuariosFiltrados = [...this.usuarios];
            } else {
                const termoLower = termo.toLowerCase();
                this.usuariosFiltrados = this.usuarios.filter(usuario =>
                    usuario && (
                        (usuario.nome && usuario.nome.toLowerCase().includes(termoLower)) ||
                        (usuario.email && usuario.email.toLowerCase().includes(termoLower)) ||
                        (usuario.matricula && usuario.matricula.toLowerCase().includes(termoLower)) ||
                        (usuario.curso && usuario.curso.toLowerCase().includes(termoLower))
                    )
                );
            }
            
            this.paginaAtual = 1;
            this.exibirUsuarios();
        } catch (error) {
            console.error('❌ Erro ao filtrar usuários:', error);
        }
    }

    filtrarPorTipo(tipo) {
        try {
            if (!tipo) {
                this.usuariosFiltrados = [...this.usuarios];
            } else {
                this.usuariosFiltrados = this.usuarios.filter(usuario => 
                    usuario && usuario.tipo === tipo
                );
            }
            
            this.paginaAtual = 1;
            this.exibirUsuarios();
        } catch (error) {
            console.error('❌ Erro ao filtrar por tipo:', error);
        }
    }

    atualizarPaginacao() {
        try {
            const totalPaginas = Math.ceil(this.usuariosFiltrados.length / this.itensPorPagina);
            const prevButton = document.getElementById('prevPage');
            const nextButton = document.getElementById('nextPage');
            const pageInfo = document.getElementById('pageInfo');

            if (prevButton && nextButton && pageInfo) {
                prevButton.disabled = this.paginaAtual <= 1;
                nextButton.disabled = this.paginaAtual >= totalPaginas;
                
                pageInfo.textContent = `Página ${this.paginaAtual} de ${totalPaginas || 1}`;

                prevButton.onclick = () => this.mudarPagina(this.paginaAtual - 1);
                nextButton.onclick = () => this.mudarPagina(this.paginaAtual + 1);
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar paginação:', error);
        }
    }

    mudarPagina(novaPagina) {
        this.paginaAtual = novaPagina;
        this.exibirUsuarios();
    }

    async editarUsuario(usuarioId) {
        try {
            const usuario = this.usuarios.find(u => u.id === usuarioId);
            if (!usuario) {
                throw new Error('Usuário não encontrado');
            }

            this.usuarioEditando = usuario;

            document.getElementById('editUserId').value = usuario.id;
            document.getElementById('editUserName').value = usuario.nome || '';
            document.getElementById('editUserEmail').value = usuario.email || '';
            document.getElementById('editUserMatricula').value = usuario.matricula || '';
            document.getElementById('editUserType').value = usuario.tipo || 'aluno';
            document.getElementById('editUserCurso').value = usuario.curso || '';
            document.getElementById('editUserPeriodo').value = usuario.periodo || '';

            document.getElementById('editUserModal').style.display = 'flex';
        } catch (error) {
            console.error('❌ Erro ao abrir edição:', error);
            this.showNotification('Erro ao carregar dados do usuário', 'error');
        }
    }

    fecharModal() {
        document.getElementById('editUserModal').style.display = 'none';
        this.usuarioEditando = null;
        document.getElementById('editUserForm').reset();
    }

    async salvarEdicao() {
        try {
            const usuarioId = document.getElementById('editUserId').value;
            const dadosAtualizados = {
                nome: document.getElementById('editUserName').value,
                email: document.getElementById('editUserEmail').value,
                matricula: document.getElementById('editUserMatricula').value,
                tipo: document.getElementById('editUserType').value,
                curso: document.getElementById('editUserCurso').value,
                periodo: document.getElementById('editUserPeriodo').value
            };

            const response = await this.makeRequest(`/usuarios/${usuarioId}`, {
                method: 'PUT',
                body: JSON.stringify(dadosAtualizados)
            });
            
            if (response.success) {
                this.showNotification('Usuário atualizado com sucesso!', 'success');
                this.fecharModal();
                await this.carregarUsuarios();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('❌ Erro ao salvar edição:', error);
            this.showNotification('Erro ao atualizar usuário: ' + error.message, 'error');
        }
    }

    async alterarTipo(usuarioId, tipoAtual) {
        const tipos = ['aluno', 'professor', 'admin'];
        const tipoIndex = tipos.indexOf(tipoAtual);
        const novoTipo = tipos[(tipoIndex + 1) % tipos.length];

        if (confirm(`Deseja alterar o tipo deste usuário para ${this.formatarTipo(novoTipo)}?`)) {
            try {
                const dadosAtualizados = { tipo: novoTipo };
                
                if (novoTipo === 'professor') {
                    dadosAtualizados.matricula = '';
                    dadosAtualizados.periodo = null;
                }

                const response = await this.makeRequest(`/usuarios/${usuarioId}/tipo`, {
                    method: 'PUT',
                    body: JSON.stringify(dadosAtualizados)
                });

                if (response.success) {
                    this.limparCacheUsuario(usuarioId);
                    this.showNotification(response.message, 'success');
                    await this.carregarUsuarios();
                } else {
                    throw new Error(response.error);
                }
            } catch (error) {
                console.error('❌ Erro ao alterar tipo:', error);
                this.showNotification('Erro ao alterar tipo: ' + error.message, 'error');
            }
        }
    }

    limparCacheUsuario(usuarioId) {
        const usuarioLogado = JSON.parse(localStorage.getItem('userData') || '{}');
        
        if (usuarioLogado.id == usuarioId) {
            this.showNotification(
                'Tipo de usuário alterado. Faça login novamente para aplicar as mudanças.', 
                'warning',
                7000
            );
        }
    }

    formatarTipo(tipo) {
        const tipos = {
            'aluno': 'Aluno',
            'professor': 'Professor',
            'admin': 'Administrador'
        };
        return tipos[tipo] || tipo;
    }

    formatarData(dataString) {
        if (!dataString) return 'N/A';
        try {
            const data = new Date(dataString);
            return data.toLocaleDateString('pt-BR');
        } catch (error) {
            return 'N/A';
        }
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

    setupEventListeners() {
        console.log('✅ Event listeners configurados');
        
        const turmaForm = document.getElementById('turmaForm');
        if (turmaForm) {
            turmaForm.addEventListener('submit', (e) => this.salvarTurma(e));
        }

        // Filtro de usuários
        const searchInput = document.getElementById('searchUsers');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filtrarUsuarios(e.target.value);
            });
        }

        // Filtro por tipo
        const tipoFilter = document.getElementById('tipoFilter');
        if (tipoFilter) {
            tipoFilter.addEventListener('change', (e) => {
                this.filtrarPorTipo(e.target.value);
            });
        }
    }

    // 🔥 MÉTODOS ADICIONAIS PARA PERSISTÊNCIA

    // 🔥 SALVAR TODOS OS DADOS JUNTOS
    salvarDadosCompletos() {
        try {
            const dadosCompletos = {
                turmas: this.turmas,
                alunos: this.alunos,
                usuarios: this.usuarios,
                ultima_atualizacao: new Date().toISOString(),
                versao: '1.0'
            };
            
            localStorage.setItem('unimap_dados_completos', JSON.stringify(dadosCompletos));
            console.log('💾 Dados completos salvos no localStorage:', {
                turmas: this.turmas.length,
                alunos: this.alunos.length,
                usuarios: this.usuarios.length
            });
        } catch (error) {
            console.error('❌ Erro ao salvar dados completos:', error);
        }
    }

    // 🔥 MÉTODO PARA RECALCULAR CONTADORES DE ALUNOS POR TURMA
    recalcularContadoresTurmas() {
        try {
            console.log('🧮 Recalculando contadores de turmas...');
            
            if (!this.turmas || !this.alunos) {
                console.warn('⚠️ Dados incompletos para recalcular contadores');
                return;
            }
            
            // Zerar todos os contadores primeiro
            this.turmas.forEach(turma => {
                turma.quantidade_alunos = 0;
            });
            
            // Contar alunos por turma
            this.alunos.forEach(aluno => {
                if (aluno.turma_id) {
                    const turma = this.turmas.find(t => t.id === aluno.turma_id);
                    if (turma) {
                        turma.quantidade_alunos = (turma.quantidade_alunos || 0) + 1;
                    }
                }
            });
            
            console.log('✅ Contadores recalculados:');
            this.turmas.forEach(turma => {
                console.log(`   - ${turma.nome}: ${turma.quantidade_alunos} alunos`);
            });
            
        } catch (error) {
            console.error('❌ Erro ao recalcular contadores:', error);
        }
    }

    // 🔥 MÉTODO PARA FORÇAR RECÁLCULO (DEBUG)
    forcarRecalculo() {
        this.recalcularContadoresTurmas();
        this.salvarDadosCompletos();
        this.renderizarTurmas();
        this.showNotification('Contadores recalculados!', 'success');
    }

    // 🔥 ADICIONAR ESTE MÉTODO QUE ESTÁ FALTANDO
    verificarElementosModal() {
        try {
            console.log('🔍 Verificando elementos do modal...');
            
            // 🔥 ELEMENTOS BASE (EXISTEM EM AMBAS AS PÁGINAS)
            const elementosBase = [
                'turmaModal'
            ];
            
            // 🔥 ELEMENTOS DO DASHBOARD (admin.html)
            const elementosDashboard = [
                'vincularAlunosModalDashboard'
            ];
            
            // 🔥 ELEMENTOS DA PÁGINA DE USUÁRIOS (admin-usuarios.html)  
            const elementosUsuarios = [
                'turmaSelecionadaNome',
                'vincularAlunosModal',
                'listaAlunosTurma',
                'selecionarTodosAlunos',
                'editUserModal',
                'vincularTurmaAlunoModal'
            ];
            
            // Verificar elementos base
            elementosBase.forEach(id => {
                const element = document.getElementById(id);
                if (!element) {
                    console.warn(`⚠️ Elemento base não encontrado: ${id}`);
                } else {
                    console.log(`✅ Elemento base encontrado: ${id}`);
                }
            });
            
            // Verificar em qual página estamos
            const isAdminPage = window.location.pathname.includes('admin.html');
            const isUsuariosPage = window.location.pathname.includes('admin-usuarios.html');
            
            if (isAdminPage) {
                console.log('📍 Página: Dashboard (admin.html)');
                elementosDashboard.forEach(id => {
                    // No dashboard, alguns elementos são criados dinamicamente
                    console.log(`📱 Elemento do dashboard: ${id} (pode ser dinâmico)`);
                });
            } else if (isUsuariosPage) {
                console.log('📍 Página: Gerenciar Usuários (admin-usuarios.html)');
                elementosUsuarios.forEach(id => {
                    const element = document.getElementById(id);
                    if (!element) {
                        console.warn(`⚠️ Elemento de usuários não encontrado: ${id}`);
                    } else {
                        console.log(`✅ Elemento de usuários encontrado: ${id}`);
                    }
                });
            } else {
                console.log('📍 Página: Desconhecida', window.location.pathname);
            }
            
        } catch (error) {
            console.warn('⚠️ Erro na verificação de elementos:', error);
        }
    }

    // 🔥 ADICIONAR SE NÃO EXISTIR
    debugDados() {
        try {
            console.log('🔍 DEBUG - Dados atuais:');
            console.log('- Turmas:', this.turmas?.length || 0, 'turmas');
            console.log('- Alunos:', this.alunos?.length || 0, 'alunos');
            console.log('- Usuários:', this.usuarios?.length || 0, 'usuários');
            
            const dadosSalvos = localStorage.getItem('unimap_dados_completos');
            console.log('- Dados salvos no localStorage:', dadosSalvos ? 'Sim' : 'Não');
            
            if (this.turmas && this.alunos) {
                this.turmas.forEach(turma => {
                    const alunosNaTurma = this.alunos.filter(a => a.turma_id === turma.id);
                    console.log(`- Turma ${turma.nome}: ${alunosNaTurma.length} alunos`);
                });
            }
        } catch (error) {
            console.warn('⚠️ Erro no debug:', error);
        }
    }
}

// Instância global
const adminUsuarios = new AdminUsuarios();

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando AdminUsuarios...');
    adminUsuarios.init();
});