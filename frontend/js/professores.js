// professores.js - Gerenciador de Professores COMPLETO
class ProfessoresManager {
    constructor() {
        console.log('👨‍🏫 ProfessoresManager inicializado');
        this.user = null;
        this.professores = [];
        this.favoritos = [];
        this.init();
    }

    init() {
        console.log('🎯 Iniciando ProfessoresManager...');
        this.carregarUsuario();
        this.carregarProfessores();
        this.configurarEventListeners();
    }

    carregarUsuario() {
        console.log('🔐 Verificando autenticação...');
        const userData = localStorage.getItem('userData');
        if (userData) {
            this.user = JSON.parse(userData);
            console.log('✅ Usuário carregado:', this.user.nome);
            this.atualizarInterfaceUsuario();
        } else {
            console.log('❌ Usuário não autenticado');
        }
    }

    atualizarInterfaceUsuario() {
        console.log('📝 Atualizando informações do usuário na interface...');
        const userNameElements = document.querySelectorAll('#mobileUserName, #desktopUserName, .nav-user');
        userNameElements.forEach(element => {
            if (element) {
                element.textContent = this.user.nome;
            }
        });
    }

    async carregarProfessores() {
        try {
            console.log('📚 Carregando professores da API...');
            
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/professores', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.professores = await response.json();
                console.log('✅ Professores carregados:', this.professores.length);
                this.renderizarProfessores();
            } else {
                console.error('❌ Erro ao carregar professores:', response.status);
                this.mostrarErro('Erro ao carregar professores');
            }
        } catch (error) {
            console.error('❌ Erro na requisição:', error);
            this.mostrarErro('Erro de conexão');
        }
    }

    renderizarProfessores() {
        // Renderizar lista de professores para adicionar
        this.renderizarListaProfessores();
        
        // Carregar professores favoritos
        this.carregarProfessoresFavoritos();
    }

    renderizarListaProfessores() {
        const select = document.getElementById('professor-select');
        if (!select) {
            console.log('❌ Container de professores não encontrado');
            return;
        }

        // Limpar opções existentes (mantendo a primeira)
        while (select.options.length > 1) {
            select.remove(1);
        }

        if (this.professores.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhum professor disponível';
            select.appendChild(option);
            return;
        }

        this.professores.forEach(professor => {
            const option = document.createElement('option');
            option.value = professor.id;
            option.textContent = `${professor.nome} - ${professor.email}`;
            select.appendChild(option);
        });

        console.log('✅ Lista de professores renderizada');
    }

    async carregarProfessoresFavoritos() {
        if (!this.user) return;

        try {
            console.log('⭐ Carregando professores favoritos...');
            
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/professores/favoritos/${this.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.favoritos = await response.json();
                console.log('✅ Favoritos carregados:', this.favoritos.length);
                this.renderizarProfessoresFavoritos();
            } else {
                console.error('❌ Erro ao carregar favoritos:', response.status);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar favoritos:', error);
        }
    }

    renderizarProfessoresFavoritos() {
        const container = document.querySelector('#meus-professores .professores-list');
        if (!container) {
            console.log('❌ Container de favoritos não encontrado');
            return;
        }

        if (this.favoritos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-plus fa-3x"></i>
                    <p>Nenhum professor favorito</p>
                    <p class="empty-state-subtitle">Adicione professores na aba "Adicionar Professor"</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.favoritos.map(professor => `
            <div class="professor-card favorite-card" data-professor-id="${professor.id}">
                <div class="professor-header">
                    <div class="professor-avatar">
                        <i class="fas fa-user-graduate"></i>
                    </div>
                    <div class="professor-info">
                        <h3 class="professor-name">${professor.nome}</h3>
                        <p class="professor-email">${professor.email}</p>
                    </div>
                    <button class="btn-remove-favorite" onclick="professoresManager.removerFavorito(${professor.id})" 
                            title="Remover dos favoritos">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="professor-actions">
                    <button class="btn-outline btn-sm" onclick="professoresManager.verDetalhesProfessor(${professor.id})">
                        <i class="fas fa-info-circle"></i> Ver Detalhes
                    </button>
                </div>
            </div>
        `).join('');

        console.log('✅ Professores favoritos renderizados');
    }

    configurarEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        // Configurar formulário de adicionar professor
        const form = document.querySelector('.add-professor-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📝 Formulário submetido - Adicionar professor');
                this.adicionarProfessorFavorito();
                return false;
            });
        }

        // Configurar botão diretamente também
        const btnAdicionar = document.querySelector('.add-professor-form .btn-primary');
        if (btnAdicionar) {
            btnAdicionar.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Botão adicionar clicado');
                this.adicionarProfessorFavorito();
                return false;
            });
        }
    }

    // 🔥 FUNÇÃO PRINCIPAL PARA CARREGAR PROFESSORES
    loadMeusProfessores() {
        console.log('👨‍🏫 Carregando meus professores...');
        this.carregarProfessoresFavoritos();
    }

    async adicionarProfessorFavorito() {
        console.log('⭐ Iniciando adição de professor aos favoritos...');
        
        const select = document.getElementById('professor-select');
        if (!select) {
            console.error('❌ Select de professores não encontrado');
            this.mostrarMensagem('Erro: Select de professores não encontrado', 'error');
            return;
        }

        const professorId = select.value;
        console.log('🎯 Professor selecionado ID:', professorId);

        if (!professorId) {
            this.mostrarMensagem('Por favor, selecione um professor', 'warning');
            return;
        }

        if (!this.user) {
            this.mostrarMensagem('Usuário não autenticado', 'error');
            return;
        }

        try {
            console.log('📤 Enviando requisição para adicionar favorito...');
            
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/professores/favoritos', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    aluno_id: this.user.id,
                    professor_id: professorId
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('✅ Professor adicionado aos favoritos!');
                this.mostrarMensagem('Professor adicionado aos favoritos!', 'success');
                
                // Recarregar a lista de favoritos
                this.carregarProfessoresFavoritos();
                
                // Limpar seleção
                select.value = '';
                
                // Manter na mesma aba
                this.manterNaAbaAtual();
                
            } else {
                const errorMsg = data.error || 'Erro ao adicionar professor';
                console.error('❌ Erro na resposta:', errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('❌ Erro ao adicionar favorito:', error);
            this.mostrarMensagem('Erro ao adicionar professor: ' + error.message, 'error');
        }
    }

    async removerFavorito(professorId) {
        if (!this.user) {
            this.mostrarMensagem('Usuário não autenticado', 'error');
            return;
        }

        if (!confirm('Tem certeza que deseja remover este professor dos favoritos?')) {
            return;
        }

        try {
            console.log('🗑️ Removendo professor dos favoritos...');
            
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/professores/favoritos/${this.user.id}/${professorId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('✅ Professor removido dos favoritos!');
                this.mostrarMensagem('Professor removido dos favoritos!', 'success');
                
                // Recarregar a lista de favoritos
                this.carregarProfessoresFavoritos();
                
            } else {
                const errorMsg = data.error || 'Erro ao remover professor';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('❌ Erro ao remover favorito:', error);
            this.mostrarMensagem('Erro ao remover professor: ' + error.message, 'error');
        }
    }

    verDetalhesProfessor(professorId) {
    console.log('📖 Ver detalhes do professor:', professorId);
    
    const professor = this.professores.find(p => p.id == professorId) || 
                     this.favoritos.find(p => p.id == professorId);
    
    if (professor) {
        this.mostrarAlertaDetalhes(professor);
    } else {
        this.mostrarMensagem('Professor não encontrado', 'error');
    }
}

mostrarAlertaDetalhes(professor) {
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.className = 'professor-alert-overlay';
    overlay.innerHTML = this.gerarHTMLAlerta(professor);
    
    document.body.appendChild(overlay);
    
    // Mostrar com animação
    setTimeout(() => {
        overlay.classList.add('show');
    }, 10);
    
    // Configurar event listeners
    this.configurarEventListenersAlerta(overlay, professor);
}

gerarHTMLAlerta(professor) {
    const isFavorito = this.favoritos.some(p => p.id === professor.id);
    
    return `
        <div class="professor-alert">
            <div class="professor-alert-header">
                <h2 class="professor-alert-title">
                    <i class="fas fa-chalkboard-teacher"></i>
                    Detalhes do Professor
                </h2>
                <button class="professor-alert-close" aria-label="Fechar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="professor-alert-content">
                <div class="professor-details">
                    <div class="professor-detail-group">
                        <div class="professor-detail-icon">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="professor-detail-content">
                            <div class="professor-detail-label">Nome Completo</div>
                            <div class="professor-detail-value">${professor.nome}</div>
                        </div>
                    </div>
                    
                    <div class="professor-detail-group">
                        <div class="professor-detail-icon">
                            <i class="fas fa-envelope"></i>
                        </div>
                        <div class="professor-detail-content">
                            <div class="professor-detail-label">Email</div>
                            <div class="professor-detail-value">${professor.email}</div>
                        </div>
                    </div>
                    
                    <div class="professor-detail-group">
                        <div class="professor-detail-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="professor-detail-content">
                            <div class="professor-detail-label">Status</div>
                            <div class="professor-detail-value professor-status-${professor.ativo ? 'active' : 'inactive'}">
                                ${professor.ativo ? 'Ativo' : 'Inativo'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="professor-stats">
                    <div class="professor-stat-card">
                        <span class="professor-stat-number">${isFavorito ? '⭐' : '—'}</span>
                        <span class="professor-stat-label">Seu Favorito</span>
                    </div>
                    <div class="professor-stat-card">
                        <span class="professor-stat-number">${professor.id}</span>
                        <span class="professor-stat-label">ID</span>
                    </div>
                </div>
                
                <div class="professor-aulas-section">
                    <h3 class="professor-section-title">
                        <i class="fas fa-book"></i>
                        Informações
                    </h3>
                    <div class="professor-aulas-list">
                        <div class="professor-aula-item">
                            <div class="professor-aula-info">
                                <p class="professor-aula-name">Disponível para contato</p>
                                <p class="professor-aula-details">Via email institucional</p>
                            </div>
                            <span class="professor-aula-horario">Email</span>
                        </div>
                        <div class="professor-aula-item">
                            <div class="professor-aula-info">
                                <p class="professor-aula-name">Status no sistema</p>
                                <p class="professor-aula-details">Professor ${professor.ativo ? 'ativo' : 'inativo'}</p>
                            </div>
                            <span class="professor-aula-horario">${professor.ativo ? 'Ativo' : 'Inativo'}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="professor-alert-footer">
                <button class="professor-alert-btn professor-alert-btn-outline" data-action="close">
                    <i class="fas fa-times"></i> Fechar
                </button>
                ${!isFavorito ? 
                    `<button class="professor-alert-btn professor-alert-btn-primary" data-action="favorite">
                        <i class="fas fa-star"></i> Adicionar aos Favoritos
                    </button>` : 
                    `<button class="professor-alert-btn professor-alert-btn-outline" data-action="unfavorite">
                        <i class="fas fa-trash"></i> Remover dos Favoritos
                    </button>`
                }
            </div>
        </div>
    `;
}

configurarEventListenersAlerta(overlay, professor) {
    // Fechar ao clicar no X
    const closeBtn = overlay.querySelector('.professor-alert-close');
    closeBtn.addEventListener('click', () => {
        this.fecharAlerta(overlay);
    });
    
    // Fechar ao clicar no overlay (fora do alerta)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            this.fecharAlerta(overlay);
        }
    });
    
    // Fechar com ESC
    const keyHandler = (e) => {
        if (e.key === 'Escape') {
            this.fecharAlerta(overlay);
            document.removeEventListener('keydown', keyHandler);
        }
    };
    document.addEventListener('keydown', keyHandler);
    
    // Ações dos botões
    const buttons = overlay.querySelectorAll('.professor-alert-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            this.executarAcaoAlerta(action, professor, overlay);
        });
    });
}

executarAcaoAlerta(action, professor, overlay) {
    switch(action) {
        case 'close':
            this.fecharAlerta(overlay);
            break;
        case 'favorite':
            this.adicionarProfessorFavoritoDireto(professor.id, overlay);
            break;
        case 'unfavorite':
            this.removerFavoritoDireto(professor.id, overlay);
            break;
    }
}

adicionarProfessorFavoritoDireto(professorId, overlay) {
    // Simular seleção no select e chamar a função existente
    const select = document.getElementById('professor-select');
    if (select) {
        select.value = professorId;
        this.adicionarProfessorFavorito();
        this.fecharAlerta(overlay);
    }
}

removerFavoritoDireto(professorId, overlay) {
    this.removerFavorito(professorId);
    this.fecharAlerta(overlay);
}

fecharAlerta(overlay) {
    overlay.classList.remove('show');
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, 300);
}
    mostrarMensagem(mensagem, tipo = 'info') {
        // Remover mensagens anteriores
        const mensagensAntigas = document.querySelectorAll('.mensagem-flutuante');
        mensagensAntigas.forEach(msg => msg.remove());

        // Criar nova mensagem
        const mensagemDiv = document.createElement('div');
        mensagemDiv.className = `mensagem-flutuante mensagem-${tipo}`;
        mensagemDiv.innerHTML = `
            <div class="mensagem-conteudo">
                <i class="fas fa-${this.getIconeMensagem(tipo)}"></i>
                <span>${mensagem}</span>
            </div>
        `;

        document.body.appendChild(mensagemDiv);

        // Mostrar mensagem
        setTimeout(() => {
            mensagemDiv.classList.add('show');
        }, 100);

        // Remover após 3 segundos
        setTimeout(() => {
            mensagemDiv.classList.remove('show');
            setTimeout(() => {
                if (mensagemDiv.parentNode) {
                    mensagemDiv.parentNode.removeChild(mensagemDiv);
                }
            }, 300);
        }, 3000);
    }

    getIconeMensagem(tipo) {
        switch(tipo) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }

    manterNaAbaAtual() {
        // Garantir que permaneça na aba "Adicionar Professor"
        const abaAdicionar = document.querySelector('.tab-btn[onclick*="adicionar-professor"]');
        if (abaAdicionar) {
            abaAdicionar.click();
        }
    }

    mostrarErro(mensagem) {
        const container = document.querySelector('#meus-professores .professores-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <p>${mensagem}</p>
                    <button class="btn-primary" onclick="professoresManager.carregarProfessores()">
                        <i class="fas fa-redo"></i> Tentar Novamente
                    </button>
                </div>
            `;
        }
    }
}

// Inicialização
console.log('📄 DOM carregado - Inicializando ProfessoresManager...');
const professoresManager = new ProfessoresManager();
console.log('✅ ProfessoresManager inicializado com sucesso!');