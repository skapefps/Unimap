// admin-professores.js - Sistema Completo de Gerenciamento de Professores (CORRIGIDO)
class ProfessoresAdmin {
    constructor() {
        this.professores = [];
        this.currentEditId = null;
        this.init();
    }

    async init() {
        console.log('👨‍🏫 Inicializando gerenciamento de professores...');
        
        // Verificar autenticação
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
                console.log(`✅ ${this.professores.length} professores carregados`);
                this.renderProfessores();
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
        this.renderProfessores();
    }

    renderProfessores() {
        const tbody = document.getElementById('professores-body');
        if (!tbody) {
            console.error('❌ Elemento professores-body não encontrado');
            return;
        }

        if (this.professores.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-chalkboard-teacher fa-2x"></i>
                        <p>Nenhum professor cadastrado</p>
                        <button class="btn-primary" onclick="professoresAdmin.showForm()">
                            <i class="fas fa-plus"></i> Cadastrar Primeiro Professor
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

       tbody.innerHTML = this.professores.map(professor => `
    <tr data-professor-id="${professor.id}">
        <td data-label="Nome">
            <div class="professor-info">
                <strong>${professor.nome}</strong>
                <span class="professor-email">${professor.email}</span>
            </div>
        </td>
        <td data-label="Email">${professor.email}</td>
        <td data-label="Status">
            <span class="status-badge ${professor.ativo ? 'active' : 'inactive'}">
                <i class="fas ${professor.ativo ? 'fa-check' : 'fa-ban'}"></i>
                ${professor.ativo ? 'Ativo' : 'Inativo'}
            </span>
        </td>
        <td data-label="Ações">
            <div class="action-buttons">
                <button class="btn-action small" onclick="professoresAdmin.editProfessor(${professor.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action small ${professor.ativo ? 'danger' : 'success'}" 
                        onclick="professoresAdmin.toggleStatus(${professor.id}, ${!professor.ativo})"
                        title="${professor.ativo ? 'Desativar' : 'Ativar'}">
                    <i class="fas ${professor.ativo ? 'fa-ban' : 'fa-check'}"></i>
                </button>
                <button class="btn-action small info" onclick="professoresAdmin.viewDetails(${professor.id})" title="Detalhes">
                    <i class="fas fa-chart-bar"></i>
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
                // Limpar formulário apenas para novo cadastro
                document.getElementById('professor-form').reset();
            }
            
            // Scroll para o formulário
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

        // Validação de email
        if (!this.validateEmail(email)) {
            this.showMessage('Digite um email válido', 'error');
            return;
        }

        try {
            const professorData = { nome, email };
            
            if (this.currentEditId) {
                // Editar professor existente
                await adminAPI.updateProfessor(this.currentEditId, professorData);
                this.showMessage('Professor atualizado com sucesso!', 'success');
            } else {
                // Criar novo professor
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

            // Preencher formulário
            document.getElementById('professor-nome').value = professor.nome;
            document.getElementById('professor-email').value = professor.email;
            
            // Configurar para edição
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
            // Carregar estatísticas do professor com fallback
            const [favoritosData, aulasData] = await Promise.all([
                this.getProfessorFavoritosWithFallback(id),
                this.getProfessorAulasWithFallback(id)
            ]);

            this.showProfessorDetails(professor, favoritosData, aulasData);
            
        } catch (error) {
            console.error('❌ Erro ao carregar detalhes completos:', error);
            // Mostrar modal mesmo com dados limitados
            this.showProfessorDetails(professor, { count: 0, alunos: [] }, []);
            this.showMessage('Algumas informações podem estar incompletas', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar detalhes:', error);
        this.showMessage('Erro ao carregar detalhes do professor', 'error');
    }
}

// Adicione estes métodos auxiliares para fallback:
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

        // Remover modal existente
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        
        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    calcularTotalAlunos(aulas) {
        // Estimativa: cada turma tem ~30 alunos
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
    }

    showMessage(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Sistema de notificação simples
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
        
        // Mostrar animação
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Auto-remover
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

// Instância global
const professoresAdmin = new ProfessoresAdmin();