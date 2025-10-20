class AdminManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.checkAdminAccess();
        await this.loadDashboardData();
        this.setupEventListeners();
        this.updateUserInfo();
    }

    async checkAdminAccess() {
        const userData = localStorage.getItem('userData');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }

        const user = JSON.parse(userData);
        if (user.tipo !== 'admin') {
            alert('❌ Acesso restrito a administradores!');
            window.location.href = 'index.html';
            return;
        }
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

            // Carregar últimos usuários - CORREÇÃO PRINCIPAL
            await this.carregarUsuarios();

        } catch (error) {
            console.error('❌ Erro ao carregar dashboard:', error);
            this.useFallbackStats();
            this.showEmptyState();
        }
    }

    // NOVO MÉTODO PARA CARREGAR USUÁRIOS
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

    renderUsuarios(usuarios) {
        const tbody = document.getElementById('usuarios-body');
        if (!tbody) {
            console.error('❌ Tabela de usuários não encontrada');
            return;
        }

        // VERIFICAÇÃO ROBUSTA
        if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
            this.showEmptyState();
            return;
        }

        try {
            tbody.innerHTML = usuarios.map(usuario => `
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
                </tr>
            `).join('');

            console.log('✅ Usuários renderizados:', usuarios.length);
            
        } catch (error) {
            console.error('❌ Erro ao renderizar usuários:', error);
            this.showErrorState('Erro ao exibir usuários');
        }
    }

    // NOVO MÉTODO PARA ESCAPAR HTML
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

    // NOVO MÉTODO PARA OBTER DISPLAY DO TIPO
    getTipoDisplay(tipo) {
        const tipos = {
            'admin': 'Administrador',
            'professor': 'Professor', 
            'aluno': 'Aluno'
        };
        return tipos[tipo] || 'Aluno';
    }

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

    // NOVO MÉTODO PARA FORÇAR RECARREGAMENTO
    async recarregarDashboard() {
        console.log('🔄 Recarregando dashboard...');
        await this.loadDashboardData();
    }
    // No admin.js - adicione esta função
async atualizarTurmaUsuario(usuarioId, turma) {
    try {
        const response = await fetch(`/api/usuarios/${usuarioId}/turma`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ turma })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            this.mostrarMensagem('Turma do usuário atualizada com sucesso!', 'success');
            this.carregarUsuarios();
        } else {
            throw new Error(data.error || 'Erro ao atualizar turma');
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar turma:', error);
        this.mostrarMensagem('Erro ao atualizar turma: ' + error.message, 'error');
    }
}
}

// Inicializar admin
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando AdminManager...');
    window.adminManager = new AdminManager();
    
    // Adicionar botão de debug se necessário
    window.debugAdmin = () => {
        console.log('🔍 Debug AdminManager:');
        console.log('- Token:', localStorage.getItem('authToken'));
        console.log('- UserData:', localStorage.getItem('userData'));
        adminManager.carregarUsuarios();
    };
    
});
