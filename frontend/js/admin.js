// admin.js - VERSÃO COMPLETA E CORRIGIDA
class AdminManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.checkAdminAccess();
        await this.loadDashboardData();
        this.setupEventListeners();
        this.updateUserInfo();
        
        // SINCRONIZAR COM adminTurmas SE ESTIVER DISPONÍVEL
        this.sincronizarAdminTurmas();
    }

    // 🔥 MÉTODO checkAdminAccess ADICIONADO
    async checkAdminAccess() {
        const userData = localStorage.getItem('userData');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const user = JSON.parse(userData);
            if (user.tipo !== 'admin') {
                alert('❌ Acesso restrito a administradores!');
                window.location.href = 'index.html';
                return;
            }
        } catch (error) {
            console.error('❌ Erro ao verificar acesso:', error);
            window.location.href = 'login.html';
        }
    }
    // MÉTODOS PARA O DASHBOARD - CORRIGIDOS
vincularAlunosTurma(turmaId) {
    this.verificarEExecutar(() => {
        adminTurmas.vincularAlunosTurma(turmaId);
    }, 'vincularAlunosTurma');
}

async editarTurmaDashboard(turmaId) {
    await this.verificarEExecutar(async () => {
        await adminTurmas.editarTurma(turmaId);
    }, 'editarTurma');
}

async verAlunosTurmaDashboard(turmaId) {
    await this.verificarEExecutar(async () => {
        await adminTurmas.verAlunosTurma(turmaId);
    }, 'verAlunosTurma');
}

// 🔥 NOVO MÉTODO: Verificar e executar com fallback
verificarEExecutar(callback, acao) {
    return new Promise((resolve) => {
        const tentarExecutar = (tentativa = 0) => {
            if (window.adminTurmas && typeof adminTurmas.carregarTurmas === 'function') {
                const resultado = callback();
                resolve(resultado);
            } else if (tentativa < 5) {
                console.log(`🔄 Tentativa ${tentativa + 1}/5 - Aguardando adminTurmas...`);
                setTimeout(() => tentarExecutar(tentativa + 1), 500);
            } else {
                console.error(`❌ adminTurmas não carregado após 5 tentativas para: ${acao}`);
                this.showNotification('Sistema de turmas não carregado. Recarregue a página.', 'error');
                resolve(null);
            }
        };
        
        tentarExecutar();
    });
}

 // 🔥 MÉTODO CORRIGIDO: Sincronizar com adminTurmas
async sincronizarAdminTurmas() {
    console.log('🔄 Iniciando sincronização com adminTurmas...');
    
    // Aguardar o adminTurmas carregar com timeout
    let tentativas = 0;
    const maxTentativas = 10;
    
    while (tentativas < maxTentativas) {
        if (window.adminTurmas && typeof adminTurmas.carregarTurmas === 'function') {
            console.log('✅ adminTurmas carregado, sincronizando...');
            try {
                await adminTurmas.carregarTurmas();
                console.log('✅ Sincronização com adminTurmas concluída');
                return true;
            } catch (error) {
                console.error('❌ Erro na sincronização:', error);
                return false;
            }
        }
        
        tentativas++;
        console.log(`⏳ Aguardando adminTurmas... (${tentativas}/${maxTentativas})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.error('❌ Timeout: adminTurmas não carregado após 10 segundos');
    return false;
}

    async loadDashboardData() {
        try {
            console.log('📊 Carregando dados do dashboard...');
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                console.error('❌ Token não encontrado');
                this.showEmptyState();
                return;
            }

            // Carregar estatísticas
            const statsResponse = await fetch('/api/dashboard/estatisticas', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                console.log('📈 Estatísticas carregadas:', stats);
                this.updateStats(stats);
            } else {
                console.error('❌ Erro ao carregar estatísticas:', statsResponse.status);
                this.useFallbackStats();
            }

            // Carregar últimos usuários
            await this.carregarUsuarios();

            // CARREGAR TURMAS DO BANCO DIRETAMENTE
            await this.carregarTurmasDashboard();

        } catch (error) {
            console.error('❌ Erro ao carregar dashboard:', error);
            this.useFallbackStats();
            this.showEmptyState();
        }
    }

    // MÉTODO: Carregar turmas para o dashboard
    async carregarTurmasDashboard() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/turmas', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const turmasData = await response.json();
                console.log('📚 Turmas carregadas para dashboard:', turmasData);
                this.renderizarTurmasDashboard(turmasData);
            } else {
                console.error('❌ Erro ao carregar turmas:', response.status);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar turmas do dashboard:', error);
        }
    }

    // MÉTODO: Renderizar turmas no dashboard
    renderizarTurmasDashboard(turmasData) {
        const tbody = document.getElementById('turmas-body');
        if (!tbody) {
            console.log('ℹ️ Tabela de turmas não encontrada no dashboard');
            return;
        }

        if (!Array.isArray(turmasData) || turmasData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
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

        tbody.innerHTML = turmasData.map(turma => `
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
                    <button class="btn-action small" onclick="adminManager.vincularAlunosTurma(${turma.id})" 
                            title="Vincular alunos">
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn-action small" onclick="adminManager.editarTurmaDashboard(${turma.id})" 
                            title="Editar turma">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action small secundario" onclick="adminManager.verAlunosTurmaDashboard(${turma.id})"
                            title="Ver alunos da turma">
                        <i class="fas fa-list"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // MÉTODOS PARA O DASHBOARD
    vincularAlunosTurma(turmaId) {
        if (window.adminTurmas) {
            adminTurmas.vincularAlunosTurma(turmaId);
        } else {
            this.showNotification('Sistema de turmas não carregado', 'error');
        }
    }

    async editarTurmaDashboard(turmaId) {
        if (window.adminTurmas) {
            await adminTurmas.editarTurma(turmaId);
        } else {
            this.showNotification('Sistema de turmas não carregado', 'error');
        }
    }

    async verAlunosTurmaDashboard(turmaId) {
        if (window.adminTurmas) {
            await adminTurmas.verAlunosTurma(turmaId);
        } else {
            this.showNotification('Sistema de turmas não carregado', 'error');
        }
    }

    // ATUALIZAR ESTATÍSTICAS
    updateStats(stats) {
        try {
            const elements = {
                'total-usuarios': stats.total_usuarios || stats.totalUsuarios || '0',
                'total-professores': stats.total_professores || stats.totalProfessores || '0',
                'total-salas': stats.total_salas || stats.totalSalas || '0',
                'total-aulas': stats.total_aulas || stats.totalAulas || '0'
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                    element.style.color = '#2c3e50';
                }
            });

        } catch (error) {
            console.error('Erro ao atualizar estatísticas:', error);
        }
    }

    // MÉTODO: Carregar usuários
    async carregarUsuarios() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/usuarios', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('🔍 Status da resposta:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('👥 Resposta da API:', result);
                
                let usuariosArray = [];
                
                // Diferentes estruturas de resposta possíveis
                if (result.success && Array.isArray(result.data)) {
                    usuariosArray = result.data;
                } else if (Array.isArray(result)) {
                    usuariosArray = result;
                } else if (result.data && Array.isArray(result.data)) {
                    usuariosArray = result.data;
                } else if (result.usuarios && Array.isArray(result.usuarios)) {
                    usuariosArray = result.usuarios;
                } else {
                    console.warn('⚠️ Estrutura inesperada, tentando usar resultado direto:', result);
                    usuariosArray = result || [];
                }
                
                console.log('👥 Usuários para renderizar:', usuariosArray);
                this.renderUsuarios(usuariosArray);
                
            } else {
                console.error('❌ Erro HTTP ao carregar usuários:', response.status);
                this.showErrorState('Erro ao carregar usuários: ' + response.status);
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar usuários:', error);
            this.showErrorState('Erro de conexão');
        }
    }

   // admin.js - ATUALIZAR O MÉTODO renderUsuarios
renderUsuarios(usuarios) {
    const tbody = document.getElementById('usuarios-body');
    if (!tbody) {
        console.error('❌ Tabela de usuários não encontrada');
        return;
    }

    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
        this.showEmptyState();
        return;
    }

    try {
        // Mostrar apenas os 5 primeiros usuários no dashboard
        const usuariosParaMostrar = usuarios.slice(0, 5);
        
        tbody.innerHTML = usuariosParaMostrar.map(usuario => `
            <tr>
                <td>
                    <strong>${this.escapeHtml(usuario.nome || 'N/A')}</strong>
                    ${usuario.tipo === 'admin' ? '<i class="fas fa-crown" style="color: #e74c3c; margin-left: 8px;"></i>' : ''}
                </td>
                <td>${this.escapeHtml(usuario.email || 'N/A')}</td>
                <td>
                    <span class="badge ${usuario.tipo || 'aluno'}">
                        ${this.getTipoDisplay(usuario.tipo)}
                    </span>
                </td>
                <td>${this.formatarData(usuario.data_cadastro || usuario.created_at)}</td>
                <td>${this.escapeHtml(usuario.curso || 'N/A')}</td>
                <td>${usuario.periodo ? `${usuario.periodo}° Período` : 'N/A'}</td>
            </tr>
        `).join('');

        console.log('✅ Usuários renderizados no dashboard:', usuariosParaMostrar.length);
        
    } catch (error) {
        console.error('❌ Erro ao renderizar usuários:', error);
        this.showErrorState('Erro ao exibir usuários');
    }
}

    // MÉTODO: Mostrar estado vazio
    showEmptyState() {
        const tbody = document.getElementById('usuarios-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum usuário cadastrado</p>
                    </td>
                </tr>
            `;
        }
    }

    // MÉTODO: Mostrar estado de erro
    showErrorState(mensagem) {
        const tbody = document.getElementById('usuarios-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${mensagem}</p>
                        <button onclick="adminManager.carregarUsuarios()" class="btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-redo"></i> Tentar Novamente
                        </button>
                    </td>
                </tr>
            `;
        }
    }

    // MÉTODO: Usar estatísticas fallback
    useFallbackStats() {
        console.log('🔄 Usando estatísticas fallback...');
        const fallbackStats = {
            'total-usuarios': '0',
            'total-professores': '0', 
            'total-salas': '0',
            'total-aulas': '0'
        };
        
        Object.entries(fallbackStats).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.style.color = '#95a5a6';
            }
        });
    }

    // MÉTODO: Obter display do tipo
    getTipoDisplay(tipo) {
        const tipos = {
            'admin': 'Administrador',
            'professor': 'Professor', 
            'aluno': 'Aluno'
        };
        return tipos[tipo] || 'Aluno';
    }

    // MÉTODO: Formatar data
    formatarData(dataString) {
        try {
            if (!dataString) return 'N/A';
            
            // Tenta converter a data
            const data = new Date(dataString);
            if (isNaN(data.getTime())) {
                return 'Data inválida';
            }
            
            return data.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.warn('⚠️ Erro ao formatar data:', dataString, error);
            return 'N/A';
        }
    }

    // MÉTODO: Atualizar informações do usuário
    updateUserInfo() {
        try {
            const userData = localStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                const userElement = document.querySelector('[data-user="nome"]');
                if (userElement) {
                    userElement.innerHTML = `${user.nome} <span class="user-type-badge admin">ADMIN</span>`;
                }
            }
        } catch (error) {
            console.error('Erro ao atualizar info do usuário:', error);
        }
    }

    // MÉTODO: Configurar event listeners
    setupEventListeners() {
        // Logout
        const logoutBtn = document.querySelector('.btn-sair-desktop');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof authManager !== 'undefined') {
                    authManager.logout();
                } else {
                    localStorage.clear();
                    window.location.href = 'login.html';
                }
            });
        }

        // Botão de recarregar
        const recarregarBtn = document.querySelector('#recarregarUsuarios');
        if (recarregarBtn) {
            recarregarBtn.addEventListener('click', () => {
                this.carregarUsuarios();
            });
        }
    }

    // MÉTODO: Escapar HTML
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
    // 🔄 MÉTODO MELHORADO: Sincronizar com dashboard
sincronizarComDashboard() {
    console.log('🔄 Sincronizando com dashboard...');
    
    // Forçar atualização no AdminManager
    if (window.adminManager && typeof adminManager.atualizarTurmasDashboard === 'function') {
        adminManager.atualizarTurmasDashboard();
    }
    
    // Disparar evento customizado para outras partes do sistema
    const event = new CustomEvent('turmasAtualizadas', {
        detail: { turmas: this.turmas }
    });
    document.dispatchEvent(event);
}


    // MÉTODO: Mostrar notificação
    showNotification(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        // Implementação básica de notificação
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
        }, 5000);
    }

    // MÉTODO: Forçar atualização das turmas
    async atualizarTurmasDashboard() {
        console.log('🔄 Atualizando turmas no dashboard...');
        await this.carregarTurmasDashboard();
        
        // Sincronizar com adminTurmas se disponível
        if (window.adminTurmas) {
            await adminTurmas.carregarTurmas();
        }
    }
}

// Inicializar admin
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando AdminManager...');
    window.adminManager = new AdminManager();
    
    // Adicionar função para atualizar turmas
    window.atualizarTurmas = () => {
        if (window.adminManager) {
            adminManager.atualizarTurmasDashboard();
        }
    };
    
    // Adicionar botão de debug se necessário
    window.debugAdmin = () => {
        console.log('🔍 Debug AdminManager:');
        console.log('- Token:', localStorage.getItem('authToken'));
        console.log('- UserData:', localStorage.getItem('userData'));
        adminManager.carregarUsuarios();
    };
});