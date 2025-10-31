class ProfessoresAdmin {
    constructor() {
        this.professores = [];
        this.professoresFiltrados = [];
        this.currentEditId = null;
        this.filtroAtivo = 'todos';
        this.init();
    }

    async init() {
        console.log('👨‍🏫 Inicializando gerenciamento de professores...');

        if (!this.checkAuth()) {
            console.error('❌ Usuário não autenticado');
            window.location.href = 'login.html';
            return;
        }

        await this.loadProfessores();
        this.setupEventListeners();
    }

    checkAuth() {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');

        if (!token || !userData) {
            return false;
        }

        try {
            const user = JSON.parse(userData);
            if (user.tipo !== 'admin') {
                console.error('❌ Acesso negado: usuário não é admin');
                return false;
            }
            return true;
        } catch (error) {
            console.error('❌ Erro ao verificar autenticação:', error);
            return false;
        }
    }

    async loadProfessores() {
        try {
            console.log('📚 Carregando professores...');

            const response = await adminAPI.getProfessores();

            if (response && Array.isArray(response)) {
                this.professores = response;
                this.professoresFiltrados = [...this.professores];
                console.log(`✅ ${this.professores.length} professores carregados`);
                this.renderProfessores();
                this.atualizarContadorFiltro();
            } else {
                throw new Error('Resposta inválida da API');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar professores:', error);
            this.showMessage('Erro ao carregar professores: ' + error.message, 'error');
            this.useFallbackData();
        }
    }

    useFallbackData() {
        console.log('🔄 Usando dados de fallback...');
        this.professores = [
            { id: 1, nome: 'João Silva', email: 'joao.silva@unipam.edu.br', ativo: true },
            { id: 2, nome: 'Maria Santos', email: 'maria.santos@unipam.edu.br', ativo: true },
            { id: 3, nome: 'Pedro Costa', email: 'pedro.costa@unipam.edu.br', ativo: false }
        ];
        this.professoresFiltrados = [...this.professores];
        this.renderProfessores();
        this.atualizarContadorFiltro();
    }

    async toggleStatus(id, novoStatus) {
        try {
            const professor = this.professores.find(p => p.id === id);
            if (!professor) {
                this.showMessage('Professor não encontrado', 'error');
                return;
            }

            const acao = novoStatus ? 'ativar' : 'desativar';
            const confirmMessage = novoStatus ?
                `Ativar professor ${professor.nome}?\n\n• O professor aparecerá para os alunos\n• O usuário correspondente terá seu tipo alterado para "professor"` :
                `Desativar professor ${professor.nome}?\n\n• O professor não aparecerá para os alunos\n• O usuário correspondente terá seu tipo alterado para "aluno"`;

            if (!confirm(confirmMessage)) return;

            console.log(`🔄 ENVIANDO: Alterar status do professor ${id} para ${novoStatus ? 'ativo' : 'inativo'}`);

            // Garantir que estamos enviando boolean (a API converterá para 0/1)
            const ativoValue = novoStatus;

            const response = await adminAPI.updateProfessorStatus(id, ativoValue);

            if (response && response.success) {
                const mensagem = `Professor ${acao}do com sucesso!` +
                    (novoStatus ?
                        '\nTipo do usuário alterado para professor.' :
                        '\nTipo do usuário alterado para aluno.');

                this.showMessage(mensagem, 'success');

                // Recarregar a lista de professores
                await this.loadProfessores();

                // 🔥 ATUALIZAR A LISTA DE USUÁRIOS SE ESTIVER ABERTA
                setTimeout(() => {
                    if (typeof adminUsuarios !== 'undefined' && typeof adminUsuarios.carregarUsuarios === 'function') {
                        console.log('🔄 Atualizando lista de usuários...');
                        adminUsuarios.carregarUsuarios();
                    }
                }, 500);

            } else {
                throw new Error(response?.error || 'Erro desconhecido na resposta da API');
            }

        } catch (error) {
            console.error('❌ ERRO ao alterar status:', error);

            let mensagemErro = 'Erro ao alterar status do professor: ' + error.message;

            // Mensagens mais amigáveis para erros comuns
            if (error.message.includes('NENHUM USUÁRIO ENCONTRADO')) {
                mensagemErro = 'Erro: Não foi encontrado um usuário correspondente a este professor. Verifique se o email do professor existe na tabela de usuários.';
            } else if (error.message.includes('email')) {
                mensagemErro = 'Erro: Problema com o email do professor. Verifique se existe um usuário com o mesmo email.';
            }

            this.showMessage(mensagemErro, 'error');
        }
    }

    // Método para testar sincronização - use no console do navegador
    async testarSincronizacao(professorId) {
        try {
            console.log('🧪 TESTANDO SINCRONIZAÇÃO...');

            const professor = this.professores.find(p => p.id === professorId);
            if (!professor) {
                console.log('❌ Professor não encontrado');
                return;
            }

            console.log('📋 DADOS DO PROFESSOR:', professor);

            // Testar via debug endpoint
            const response = await fetch(`/api/debug/sync-professor-usuario/${professorId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const debugData = await response.json();
                console.log('🔍 DEBUG SINCRONIZAÇÃO:', debugData);

                if (debugData.sincronizado) {
                    console.log('✅ PROFESSOR E USUÁRIO ESTÃO SINCRONIZADOS');
                } else {
                    console.log('❌ PROFESSOR E USUÁRIO NÃO ESTÃO SINCRONIZADOS');
                    console.log('💡 Problema:', debugData.detalhes);
                }
            } else {
                console.log('❌ Erro ao buscar dados de debug');
            }

        } catch (error) {
            console.error('❌ Erro no teste:', error);
        }
    }

    async excluirProfessor(id) {
        try {
            const professor = this.professores.find(p => p.id === id);
            if (!professor) {
                this.showMessage('Professor não encontrado', 'error');
                return;
            }

            // 🔥 CONFIRMAÇÃO MAIS SEGURA PARA EXCLUSÃO
            const confirmMessage =
                `🚨 ATENÇÃO: EXCLUSÃO PERMANENTE\n\n` +
                `Você está prestes a excluir PERMANENTEMENTE o professor:\n\n` +
                `👨‍🏫 ${professor.nome}\n` +
                `📧 ${professor.email}\n\n` +
                `Esta ação irá:\n` +
                `• Excluir permanentemente o professor\n` +
                `• Alterar o tipo do usuário correspondente para "aluno"\n` +
                `• Remover todas as aulas associadas\n` +
                `• Remover todos os favoritos dos alunos\n\n` +
                `Esta ação NÃO PODE ser desfeita!\n\n` +
                `Digite "EXCLUIR" para confirmar:`;

            const userInput = prompt(confirmMessage);

            if (userInput !== 'EXCLUIR') {
                this.showMessage('Exclusão cancelada', 'info');
                return;
            }

            console.log(`🗑️ Iniciando exclusão do professor ${id}...`);

            const response = await adminAPI.deleteProfessor(id);

            if (response && response.success) {
                let mensagem = `Professor "${professor.nome}" excluído permanentemente com sucesso!`;

                // 🔥 INFORMAR SOBRE A ALTERAÇÃO DO USUÁRIO
                if (response.usuario_alterado) {
                    mensagem += `\n\nO usuário correspondente foi alterado para "aluno".`;
                }

                // Adicionar informações sobre dependências removidas
                if (response.aulas_removidas > 0 || response.favoritos_removidos > 0) {
                    mensagem += `\n\nForam removidos automaticamente:\n`;
                    if (response.aulas_removidas > 0) {
                        mensagem += `• ${response.aulas_removidas} aula(s)\n`;
                    }
                    if (response.favoritos_removidos > 0) {
                        mensagem += `• ${response.favoritos_removidos} favorito(s)`;
                    }
                }

                this.showMessage(mensagem, 'success');

                // Recarregar a lista de professores
                await this.loadProfessores();

                // 🔥 ATUALIZAR A LISTA DE USUÁRIOS SE ESTIVER ABERTA
                setTimeout(() => {
                    if (typeof adminUsuarios !== 'undefined' && typeof adminUsuarios.carregarUsuarios === 'function') {
                        console.log('🔄 Atualizando lista de usuários...');
                        adminUsuarios.carregarUsuarios();
                    }
                }, 500);

            } else {
                throw new Error(response?.error || 'Erro desconhecido ao excluir professor');
            }

        } catch (error) {
            console.error('❌ Erro ao excluir professor:', error);

            let mensagemErro = 'Erro ao excluir professor: ' + error.message;

            // Mensagens mais específicas para erros comuns
            if (error.message.includes('foreign key constraint')) {
                mensagemErro = 'Não foi possível excluir o professor pois existem registros vinculados a ele. Tente desativá-lo em vez de excluir.';
            } else if (error.message.includes('not found')) {
                mensagemErro = 'Professor não encontrado. Pode já ter sido excluído.';
            }

            this.showMessage(mensagemErro, 'error');
        }
    }

    aplicarFiltroStatus(filtro) {
        this.filtroAtivo = filtro;

        // Atualizar botões ativos
        document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`filtro${filtro.charAt(0).toUpperCase() + filtro.slice(1)}`).classList.add('active');

        // Aplicar filtro
        switch (filtro) {
            case 'ativos':
                this.professoresFiltrados = this.professores.filter(p => p.ativo === 1 || p.ativo === true);
                break;
            case 'inativos':
                this.professoresFiltrados = this.professores.filter(p => p.ativo === 0 || p.ativo === false);
                break;
            default:
                this.professoresFiltrados = [...this.professores];
        }

        this.renderProfessores();
        this.atualizarContadorFiltro();
    }

    atualizarContadorFiltro() {
        const totalAtivos = this.professores.filter(p => p.ativo === 1 || p.ativo === true).length;
        const totalInativos = this.professores.filter(p => p.ativo === 0 || p.ativo === false).length;
        const totalFiltrados = this.professoresFiltrados.length;

        const contadorEl = document.getElementById('filtroContador');
        if (contadorEl) {
            contadorEl.innerHTML = `
                <span class="filtro-info">
                    Mostrando ${totalFiltrados} de ${this.professores.length} professores
                    (${totalAtivos} ativos, ${totalInativos} inativos)
                </span>
            `;
        }
    }

    renderProfessores() {
        const tbody = document.getElementById('professores-body');
        if (!tbody) {
            console.error('❌ Elemento professores-body não encontrado');
            return;
        }

        if (this.professoresFiltrados.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state"> <!-- 🔥 Mudei para colspan="5" -->
                    <i class="fas fa-chalkboard-teacher fa-2x"></i>
                    <p>Nenhum professor encontrado</p>
                    ${this.filtroAtivo !== 'todos' ?
                    `<button class="btn-primary" onclick="professoresAdmin.aplicarFiltroStatus('todos')">
                            <i class="fas fa-eye"></i> Ver Todos os Professores
                        </button>` :
                    `<button class="btn-primary" onclick="professoresAdmin.showForm()">
                            <i class="fas fa-plus"></i> Cadastrar Primeiro Professor
                        </button>`
                }
                </td>
            </tr>
        `;
            return;
        }

        tbody.innerHTML = this.professoresFiltrados.map(professor => `
        <tr data-professor-id="${professor.id}" class="${(professor.ativo === 0 || professor.ativo === false) ? 'inactive-row' : ''}">
            <td data-label="Nome">
                <div class="professor-info">
                    <strong>${professor.nome}</strong>
                    <span class="status-badge ${(professor.ativo === 1 || professor.ativo === true) ? 'active' : 'inactive'}">
                        <i class="fas ${(professor.ativo === 1 || professor.ativo === true) ? 'fa-check' : 'fa-ban'}"></i>
                        ${(professor.ativo === 1 || professor.ativo === true) ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
            </td>
            <td data-label="Email">${professor.email}</td>
            <td data-label="Status">
                <span class="status-badge ${(professor.ativo === 1 || professor.ativo === true) ? 'active' : 'inactive'}">
                    <i class="fas ${(professor.ativo === 1 || professor.ativo === true) ? 'fa-check' : 'fa-ban'}"></i>
                    ${(professor.ativo === 1 || professor.ativo === true) ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td data-label="Ações">
                <div class="action-buttons">
                    <button class="btn-action small" onclick="professoresAdmin.editProfessor(${professor.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action small ${(professor.ativo === 1 || professor.ativo === true) ? 'perigo' : 'sucesso'}" 
                            onclick="professoresAdmin.toggleStatus(${professor.id}, ${!(professor.ativo === 1 || professor.ativo === true)})"
                            title="${(professor.ativo === 1 || professor.ativo === true) ? 'Desativar' : 'Ativar'}">
                        <i class="fas ${(professor.ativo === 1 || professor.ativo === true) ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                    <button class="btn-action small info" onclick="professoresAdmin.viewDetails(${professor.id})" title="Detalhes">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    <!-- 🔥 NOVO BOTÃO DE EXCLUIR -->
                    <button class="btn-action small perigo" onclick="professoresAdmin.excluirProfessor(${professor.id})" 
                            title="Excluir Permanentemente" style="background: #dc3545;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    }

    showForm() {
        const form = document.getElementById('form-professor');
        const title = document.getElementById('form-title');

        if (form && title) {
            form.style.display = 'block';
            title.textContent = this.currentEditId ? 'Editar Professor' : 'Cadastrar Novo Professor';

            if (!this.currentEditId) {
                document.getElementById('professor-form').reset();
            }

            form.scrollIntoView({ behavior: 'smooth' });
        } else {
            console.error('❌ Elementos do formulário não encontrados');
        }
    }

    hideForm() {
        const form = document.getElementById('form-professor');
        if (form) {
            form.style.display = 'none';
            this.currentEditId = null;
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const nome = document.getElementById('professor-nome').value;
        const email = document.getElementById('professor-email').value;

        if (!nome || !email) {
            this.showMessage('Preencha todos os campos', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showMessage('Digite um email válido', 'error');
            return;
        }

        try {
            const professorData = { nome, email };

            if (this.currentEditId) {
                await adminAPI.updateProfessor(this.currentEditId, professorData);
                this.showMessage('Professor atualizado com sucesso!', 'success');
            } else {
                await adminAPI.createProfessor(professorData);
                this.showMessage('Professor cadastrado com sucesso!', 'success');
            }

            this.hideForm();
            await this.loadProfessores();

        } catch (error) {
            console.error('❌ Erro ao salvar professor:', error);

            if (error.message.includes('UNIQUE') || error.message.includes('email')) {
                this.showMessage('Este email já está cadastrado no sistema', 'error');
            } else {
                this.showMessage('Erro ao salvar professor: ' + error.message, 'error');
            }
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async editProfessor(id) {
        try {
            const professor = this.professores.find(p => p.id === id);
            if (!professor) {
                throw new Error('Professor não encontrado');
            }

            document.getElementById('professor-nome').value = professor.nome;
            document.getElementById('professor-email').value = professor.email;

            this.currentEditId = id;
            this.showForm();

        } catch (error) {
            console.error('❌ Erro ao editar professor:', error);
            this.showMessage('Erro ao carregar dados do professor', 'error');
        }
    }

    async toggleStatus(id, novoStatus) {
        try {
            const professor = this.professores.find(p => p.id === id);
            if (!professor) return;

            const confirmMessage = novoStatus ?
                `Ativar professor ${professor.nome}?` :
                `Desativar professor ${professor.nome}?\n\nProfessores desativados não aparecerão para os alunos.`;

            if (!confirm(confirmMessage)) return;

            await adminAPI.updateProfessorStatus(id, novoStatus);

            this.showMessage(
                `Professor ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`,
                'success'
            );

            await this.loadProfessores();

        } catch (error) {
            console.error('❌ Erro ao alterar status:', error);
            this.showMessage('Erro ao alterar status do professor', 'error');
        }
    }

    async viewDetails(id) {
        try {
            const professor = this.professores.find(p => p.id === id);
            if (!professor) {
                this.showMessage('Professor não encontrado', 'error');
                return;
            }

            this.showMessage('Carregando detalhes...', 'info');

            try {
                const [favoritosData, aulasData] = await Promise.all([
                    this.getProfessorFavoritosWithFallback(id),
                    this.getProfessorAulasWithFallback(id)
                ]);

                this.showProfessorDetails(professor, favoritosData, aulasData);

            } catch (error) {
                console.error('❌ Erro ao carregar detalhes completos:', error);
                this.showProfessorDetails(professor, { count: 0, alunos: [] }, []);
                this.showMessage('Algumas informações podem estar incompletas', 'warning');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar detalhes:', error);
            this.showMessage('Erro ao carregar detalhes do professor', 'error');
        }
    }

    async getProfessorFavoritosWithFallback(id) {
        try {
            return await adminAPI.getProfessorFavoritos(id);
        } catch (error) {
            console.error('❌ Erro ao carregar favoritos, usando fallback:', error);
            return { count: 0, alunos: [] };
        }
    }

    async getProfessorAulasWithFallback(id) {
        try {
            return await adminAPI.getProfessorAulas(id);
        } catch (error) {
            console.error('❌ Erro ao carregar aulas, usando fallback:', error);
            return [];
        }
    }

    showProfessorDetails(professor, favoritosData, aulasData) {
        const modalHTML = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>
                            <i class="fas fa-chalkboard-teacher"></i>
                            ${professor.nome}
                        </h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="professor-stats-grid">
                            <div class="stat-card mini">
                                <div class="stat-icon">
                                    <i class="fas fa-heart"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${favoritosData.count || 0}</div>
                                    <div class="stat-label">Favoritos</div>
                                </div>
                            </div>
                            
                            <div class="stat-card mini">
                                <div class="stat-icon">
                                    <i class="fas fa-book"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${aulasData.length}</div>
                                    <div class="stat-label">Aulas</div>
                                </div>
                            </div>
                            
                            <div class="stat-card mini">
                                <div class="stat-icon">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${this.calcularTotalAlunos(aulasData)}</div>
                                    <div class="stat-label">Alunos Estimados</div>
                                </div>
                            </div>
                        </div>

                        <div class="details-sections">
                            <div class="details-section">
                                <h4><i class="fas fa-info-circle"></i> Informações</h4>
                                <div class="info-grid">
                                    <div class="info-item">
                                        <label>Email:</label>
                                        <span>${professor.email}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Status:</label>
                                        <span class="status-badge ${professor.ativo ? 'active' : 'inactive'}">
                                            ${professor.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    <div class="info-item">
                                        <label>ID no Sistema:</label>
                                        <span>#${professor.id}</span>
                                    </div>
                                </div>
                            </div>

                            ${favoritosData.count > 0 ? `
                            <div class="details-section">
                                <h4><i class="fas fa-star"></i> Alunos Favoritos (${favoritosData.count})</h4>
                                <div class="alunos-list">
                                    ${favoritosData.alunos && favoritosData.alunos.length > 0 ?
                    favoritosData.alunos.map(aluno => `
                                            <div class="aluno-item">
                                                <i class="fas fa-user-graduate"></i>
                                                <span>${aluno.nome}</span>
                                                <small>${aluno.curso || 'Sem curso'}</small>
                                            </div>
                                        `).join('') :
                    '<p class="no-data">Lista de alunos não disponível</p>'
                }
                                </div>
                            </div>
                            ` : ''}

                            ${aulasData.length > 0 ? `
                            <div class="details-section">
                                <h4><i class="fas fa-calendar-alt"></i> Aulas (${aulasData.length})</h4>
                                <div class="aulas-list">
                                    ${aulasData.map(aula => `
                                        <div class="aula-item">
                                            <div class="aula-header">
                                                <strong>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</strong>
                                                <span class="aula-horario">${aula.horario_inicio} - ${aula.horario_fim}</span>
                                            </div>
                                            <div class="aula-details">
                                                <span>${aula.curso || 'Sem curso'} • ${aula.turma || 'N/A'}</span>
                                                <span>Sala ${aula.sala_numero || 'N/A'} - Bloco ${aula.sala_bloco || 'N/A'}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : '<p class="no-data">Nenhuma aula cadastrada para este professor</p>'}
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            Fechar
                        </button>
                        <button class="btn-primary" onclick="professoresAdmin.editProfessor(${professor.id}); this.closest('.modal-overlay').remove()">
                            <i class="fas fa-edit"></i> Editar Professor
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    calcularTotalAlunos(aulas) {
        return aulas.length * 30;
    }

    setupEventListeners() {
        const form = document.getElementById('professor-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
            console.log('✅ Event listener do formulário configurado');
        } else {
            console.error('❌ Formulário não encontrado');
        }

        // Event listeners para filtros
        const btnTodos = document.getElementById('filtroTodos');
        const btnAtivos = document.getElementById('filtroAtivos');
        const btnInativos = document.getElementById('filtroInativos');

        if (btnTodos) {
            btnTodos.addEventListener('click', () => this.aplicarFiltroStatus('todos'));
        }
        if (btnAtivos) {
            btnAtivos.addEventListener('click', () => this.aplicarFiltroStatus('ativos'));
        }
        if (btnInativos) {
            btnInativos.addEventListener('click', () => this.aplicarFiltroStatus('inativos'));
        }

        console.log('✅ Event listeners dos filtros configurados');
    }

    showMessage(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);

        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}-circle"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
}

const professoresAdmin = new ProfessoresAdmin();