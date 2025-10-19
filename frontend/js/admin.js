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
            
            // Carregar estatísticas
            const statsResponse = await fetch('/api/dashboard/estatisticas', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                console.log('📈 Estatísticas carregadas:', stats);
                this.updateStats(stats);
            } else {
                console.error('❌ Erro ao carregar estatísticas');
            }

            // Carregar últimos usuários
            const usersResponse = await fetch('/api/usuarios', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (usersResponse.ok) {
                const usuarios = await usersResponse.json();
                console.log('👥 Usuários carregados:', usuarios.length);
                this.renderUsuarios(usuarios); 
            } else {
                console.error('❌ Erro ao carregar usuários');
                this.showEmptyState();
            }

        } catch (error) {
            console.error('❌ Erro ao carregar dashboard:', error);
            this.showEmptyState();
        }
    }

    updateStats(stats) {
        const elements = {
            'total-usuarios': stats.total_usuarios || '0',
            'total-professores': stats.total_professores || '0',
            'total-salas': stats.total_salas || '0',
            'total-aulas': stats.total_aulas || '0'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.style.color = '#2c3e50';
            }
        });
    }

    renderUsuarios(usuarios) {
        const tbody = document.getElementById('usuarios-body');
        if (!tbody) {
            console.error('❌ Tabela de usuários não encontrada');
            return;
        }

        if (!usuarios || usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum usuário cadastrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = usuarios.map(usuario => `
            <tr>
                <td>
                    <strong>${usuario.nome}</strong>
                    ${usuario.tipo === 'admin' ? '<i class="fas fa-crown" style="color: #e74c3c; margin-left: 8px;"></i>' : ''}
                </td>
                <td>${usuario.email}</td>
                <td>
                    <span class="badge ${usuario.tipo}">
                        ${usuario.tipo === 'admin' ? 'Administrador' : 
                          usuario.tipo === 'professor' ? 'Professor' : 'Aluno'}
                    </span>
                </td>
                <td>${this.formatarData(usuario.data_cadastro)}</td>
            </tr>
        `).join('');

        console.log('✅ Usuários renderizados:', usuarios.length);
    }

    formatarData(dataString) {
        try {
            const data = new Date(dataString);
            return data.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Data inválida';
        }
    }

    showEmptyState() {
        const tbody = document.getElementById('usuarios-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erro ao carregar usuários</p>
                    </td>
                </tr>
            `;
        }
    }

    updateUserInfo() {
        const userData = localStorage.getItem('userData');
        if (userData) {
            const user = JSON.parse(userData);
            const userElement = document.querySelector('[data-user="nome"]');
            if (userElement) {
                userElement.innerHTML = `${user.nome} <span class="user-type-badge admin">ADMIN</span>`;
            }
        }
    }

    setupEventListeners() {
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
    }
}

// Inicializar admin
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando AdminManager...');
    window.adminManager = new AdminManager();
});