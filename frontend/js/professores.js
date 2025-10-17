// professores.js - Versão CORRIGIDA
class ProfessoresManager {
    constructor() {
        this.user = null;
        this.professores = [];
        this.favoritos = [];
        console.log('👨‍🏫 ProfessoresManager inicializado');
    }

    async init() {
    console.log('🎯 Iniciando ProfessoresManager...');
    await this.checkAuth();
    await this.loadProfessores();
    await this.loadMeusProfessores(); // ✅ ADICIONAR ESTA LINHA - carregar favoritos também
    this.setupProfessorSelection();
    this.setupEventListeners();
    this.updateUserInfo();
}

    async checkAuth() {
        // Use as mesmas chaves do auth.js
        const userData = localStorage.getItem('userData');
        const token = localStorage.getItem('authToken');
        
        console.log('🔐 Verificando autenticação...', { 
            userData: !!userData, 
            token: !!token 
        });
        
        if (userData && token) {
            try {
                this.user = JSON.parse(userData);
                console.log('✅ Usuário carregado:', this.user.nome);
            } catch (error) {
                console.error('❌ Erro ao carregar usuário:', error);
            }
        } else {
            console.log('⚠️ Usuário não autenticado');
        }
    }

    updateUserInfo() {
        console.log('📝 Atualizando informações do usuário na interface...');
        
        // Atualizar nome do usuário na interface se os elementos existirem
        const mobileUserName = document.getElementById('mobileUserName');
        const desktopUserName = document.getElementById('desktopUserName');
        const navUser = document.querySelector('.nav-user');
        
        if (this.user) {
            if (mobileUserName) mobileUserName.textContent = this.user.nome;
            if (desktopUserName) desktopUserName.textContent = this.user.nome;
            if (navUser) navUser.textContent = this.user.nome;
        }
    }

    async loadProfessores() {
        try {
            console.log('📚 Carregando professores da API...');
            
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/professores', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const professores = await response.json();
            this.professores = professores;
            
            console.log('✅ Professores carregados:', professores.length);
            this.renderProfessoresDisponiveis();
            this.populateProfessorSelect();
            
        } catch (error) {
            console.error('❌ Erro ao carregar professores:', error);
            this.useFallbackData();
        }
    }

    useFallbackData() {
        this.professores = [
            { id: 1, nome: 'João Silva', email: 'joao.silva@unipam.edu.br', ativo: true },
            { id: 2, nome: 'Maria Santos', email: 'maria.santos@unipam.edu.br', ativo: true },
            { id: 3, nome: 'Pedro Costa', email: 'pedro.costa@unipam.edu.br', ativo: true }
        ];
        
        this.renderProfessoresDisponiveis();
        this.populateProfessorSelect();
        this.showMessage('Usando dados de exemplo (API offline)', 'info');
    }

    async loadMeusProfessores() {
    try {
        if (!this.user) {
            console.log('⚠️ Sem usuário para carregar favoritos');
            return;
        }
        
        console.log('⭐ Carregando professores favoritos...');
        
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${api.baseURL}/professores/favoritos/${this.user.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const favoritos = await response.json();
            this.favoritos = favoritos;
            console.log('✅ Favoritos carregados do banco:', favoritos.length);
            
            // ✅ ATUALIZAR: Mostrar apenas os favoritos na aba "Meus Professores"
            this.renderAbaMeusProfessores(favoritos);
        } else {
            console.log('ℹ️ Nenhum favorito encontrado no banco');
            this.renderAbaMeusProfessores([]); // Mostrar lista vazia
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar favoritos:', error);
        this.renderAbaMeusProfessores([]); // Mostrar lista vazia em caso de erro
    }
}

// ✅ NOVA FUNÇÃO: Renderizar apenas na aba "Meus Professores"
renderAbaMeusProfessores(favoritos) {
    const container = document.querySelector('#meus-professores .professores-list');
    if (!container) return;

    if (!favoritos || favoritos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends fa-3x"></i>
                <p>Nenhum professor favorito</p>
                <p class="empty-subtitle">Adicione professores aos favoritos</p>
            </div>
        `;
        return;
    }

    container.innerHTML = favoritos.map(professor => `
        <div class="professor-card favorito">
            <div class="professor-header">
                <h4>${professor.nome}</h4>
                <span class="favorito-badge">
                    Favorito
                </span>
            </div>
            <div class="professor-info">
                <p><strong>Email:</strong> ${professor.email}</p>
                <p><strong>Status:</strong> ${professor.ativo ? 'Ativo' : 'Inativo'}</p>
            </div>
            <div class="professor-actions">
                <button class="btn-action small" onclick="professoresManager.verDetalhesProfessor(${professor.id})">
                    <i class="fas fa-info-circle"></i> Detalhes
                </button>
                <button class="btn-action small danger" onclick="professoresManager.removerDosFavoritos(${professor.id})">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        </div>
    `).join('');
}

    // Na função renderProfessoresDisponiveis() - REMOVA as estrelas
renderProfessoresDisponiveis() {
    const container = document.querySelector('#meus-professores .professores-list');
    if (!container) return;

    if (this.professores.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chalkboard-teacher fa-3x"></i>
                <p>Nenhum professor encontrado</p>
            </div>
        `;
        return;
    }

    container.innerHTML = this.professores.map(professor => `
        <div class="professor-card">
            <div class="professor-header">
                <h4>${professor.nome}</h4>
                <button class="btn-favorito" onclick="professoresManager.adicionarAosFavoritos(${professor.id})">
                    Adicionar aos favoritos  <!-- ✅ SEM ESTRELA -->
                </button>
            </div>
            <div class="professor-info">
                <p><strong>Email:</strong> ${professor.email}</p>
                <p><strong>Status:</strong> ${professor.ativo ? 'Ativo' : 'Inativo'}</p>
            </div>
        </div>
    `).join('');
}

// Na função renderMeusProfessores() - REMOVA as estrelas
renderMeusProfessores(professores) {
    const container = document.querySelector('#meus-professores .professores-list');
    if (!container) return;

    if (!professores || professores.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends fa-3x"></i>  <!-- ✅ ÍCONE DIFERENTE -->
                <p>Nenhum professor favorito</p>
                <p class="empty-subtitle">Adicione professores aos favoritos</p>
            </div>
        `;
        return;
    }

    container.innerHTML = professores.map(professor => `
        <div class="professor-card favorito">
            <div class="professor-header">
                <h4>${professor.nome}</h4>
                <span class="favorito-badge">
                    Favorito  <!-- ✅ SEM ESTRELA -->
                </span>
            </div>
            <div class="professor-info">
                <p><strong>Email:</strong> ${professor.email}</p>
                <p><strong>Status:</strong> ${professor.ativo ? 'Ativo' : 'Inativo'}</p>
            </div>
            <div class="professor-actions">
                <button class="btn-action small" onclick="professoresManager.verDetalhesProfessor(${professor.id})">
                    <i class="fas fa-info-circle"></i> Detalhes
                </button>
                <button class="btn-action small danger" onclick="professoresManager.removerDosFavoritos(${professor.id})">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        </div>
    `).join('');
}
    populateProfessorSelect() {
        console.log('🔍 Procurando select de professores...');
        
        // Tentar diferentes seletores
        const select = document.getElementById('professor-select') || 
                       document.querySelector('#adicionar-professor select:nth-child(3)') ||
                       document.querySelector('#adicionar-professor select:last-child');
        
        if (!select) {
            console.log('❌ Nenhum select de professores encontrado');
            console.log('📋 Selects disponíveis:', document.querySelectorAll('#adicionar-professor select'));
            return;
        }
        
        console.log('✅ Select encontrado:', select);
        
        // Salvar a primeira opção (placeholder)
        const placeholder = select.querySelector('option') ? select.querySelector('option').textContent : 'Selecione o professor';
        
        // Popular com professores
        select.innerHTML = `<option value="">${placeholder}</option>` +
            this.professores.map(prof => 
                `<option value="${prof.id}">${prof.nome}</option>`
            ).join('');
        
        console.log('✅ Select populado com', this.professores.length, 'professores');
    }

    setupProfessorSelection() {
        console.log('🎯 Configurando seleção de professores...');
        
        // Aguardar um pouco para garantir que o DOM está pronto
        setTimeout(() => {
            this.populateProfessorSelect();
            
            // Se ainda não encontrou, tentar novamente após 1 segundo
            if (!document.querySelector('#adicionar-professor select option[value]')) {
                console.log('🔄 Tentando novamente popular select...');
                setTimeout(() => this.populateProfessorSelect(), 1000);
            }
        }, 100);
    }

    setupEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        const form = document.querySelector('.add-professor-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleAdicionarProfessor(e));
            console.log('✅ Formulário de adicionar professor configurado');
        } else {
            console.log('❌ Formulário de adicionar professor não encontrado');
        }
    }

    async handleAdicionarProfessor(e) {
        e.preventDefault();
        console.log('➕ Processando adição de professor...');
        
        // CORREÇÃO: Usar o select correto
        const professorSelect = document.getElementById('professor-select');
        
        if (!professorSelect) {
            console.error('❌ Select de professores não encontrado');
            this.showMessage('Erro: Select de professores não encontrado', 'error');
            return;
        }
        
        const professorId = professorSelect.value;
        console.log('📋 Professor selecionado:', professorId);

        if (!professorId) {
            this.showMessage('Selecione um professor!', 'error');
            return;
        }

        try {
            await this.adicionarAosFavoritos(parseInt(professorId));
            
            // Limpar formulário
            if (e.target.reset) e.target.reset();
            // Resetar o select
            professorSelect.selectedIndex = 0;
            
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    async adicionarAosFavoritos(professorId) {
        try {
            if (!this.user) {
                this.showMessage('Faça login para adicionar favoritos', 'error');
                return;
            }

            console.log('➕ Adicionando professor aos favoritos:', professorId);
            
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Token de autenticação não encontrado');
            }
            
            const response = await fetch(`${api.baseURL}/professores/favoritos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    aluno_id: this.user.id,
                    professor_id: professorId
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Professor adicionado aos favoritos!', 'success');
                await this.loadMeusProfessores();
            } else {
                throw new Error(data.error || 'Erro ao adicionar favorito');
            }
        } catch (error) {
            console.error('Erro ao adicionar favorito:', error);
            this.showMessage('Erro ao adicionar favorito: ' + error.message, 'error');
        }
    }

    async removerDosFavoritos(professorId) {
        try {
            if (!this.user) {
                this.showMessage('Faça login para remover favoritos', 'error');
                return;
            }

            console.log('🗑️ Removendo professor dos favoritos:', professorId);
            
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Token de autenticação não encontrado');
            }
            
            const response = await fetch(`${api.baseURL}/professores/favoritos/${this.user.id}/${professorId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showMessage('Professor removido dos favoritos!', 'success');
                await this.loadMeusProfessores();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Erro ao remover favorito');
            }
        } catch (error) {
            console.error('Erro ao remover favorito:', error);
            this.showMessage('Erro ao remover professor: ' + error.message, 'error');
        }
    }

    verDetalhesProfessor(professorId) {
        const professor = this.professores.find(p => p.id === professorId);
        if (professor) {
            this.mostrarModalDetalhes(professor);
        }
    }

    mostrarModalDetalhes(professor) {
        const modalHTML = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${professor.nome}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="professor-detalhes">
                            <p><strong>Email:</strong> ${professor.email}</p>
                            <p><strong>Status:</strong> ${professor.ativo ? 'Ativo' : 'Inativo'}</p>
                            <p><strong>Disciplinas:</strong> Em desenvolvimento...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal existente
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        
        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    mostrarModalDetalhes(professor) {
    const modalHTML = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${professor.nome}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="professor-detalhes">
                        <p>
                            <strong>Email:</strong> 
                            <a href="mailto:${professor.email}" style="color: #3498db; text-decoration: none;">
                                ${professor.email}
                            </a>
                        </p>
                        <p>
                            <strong>Status:</strong> 
                            <span style="color: ${professor.ativo ? '#27ae60' : '#e74c3c'}; font-weight: 600;">
                                ${professor.ativo ? '🟢 Ativo' : '🔴 Inativo'}
                            </span>
                        </p>
                        <p>
                            <strong>Disponibilidade:</strong> 
                            Segunda a Sexta, 08:00-18:00
                        </p>
                        <p>
                            <strong>Área de Atuação:</strong> 
                            Desenvolvimento Web, Banco de Dados
                        </p>
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                            <strong style="color: #2c3e50;">Informações de Contato:</strong>
                            <p style="margin: 8px 0; color: #666;">
                                <i class="fas fa-building" style="color: #3498db; width: 16px;"></i>
                                Bloco A, Sala 205
                            </p>
                            <p style="margin: 8px 0; color: #666;">
                                <i class="fas fa-clock" style="color: #3498db; width: 16px;"></i>
                                Atendimento: 13:00-14:00
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal existente
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
    
    // Adicionar novo modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

    showMessage(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Remover notificação existente
    const existingNotification = document.querySelector('.custom-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    
    // Ícones para cada tipo
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle', 
        info: 'fas fa-info-circle',
        warning: 'fas fa-exclamation-triangle'
    };
    
    const icon = icons[type] || icons.info;
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="${icon}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Mostrar animação
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto-remover após 5 segundos (exceto para erros)
    if (type !== 'error') {
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
}


// Inicialização com tratamento de erro
let professoresManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - Inicializando ProfessoresManager...');
    
    try {
        professoresManager = new ProfessoresManager();
        
        // Inicializar de forma assíncrona mas não bloquear a página
        setTimeout(async () => {
            try {
                await professoresManager.init();
                console.log('✅ ProfessoresManager inicializado com sucesso!');
            } catch (error) {
                console.error('❌ Erro na inicialização do ProfessoresManager:', error);
                // Não quebrar a aplicação se houver erro
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Erro crítico ao criar ProfessoresManager:', error);
    }

    
}
);


