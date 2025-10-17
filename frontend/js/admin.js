// admin.js - Versão simplificada
class AdminManager {
    constructor() {
        this.init();
    }

    async init() {
        // A verificação já é feita pelo app.js - protegeAdminPages()
        await this.loadDashboardData();
        this.setupEventListeners();
        this.updateUserInfo();
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

    // ... resto do código permanece igual
    async loadDashboardData() {
        try {
            const token = localStorage.getItem('authToken');
            
            const statsResponse = await fetch('/api/dashboard/estatisticas', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                this.updateStats(stats);
            }

            const usersResponse = await fetch('/api/usuarios', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (usersResponse.ok) {
                const usuarios = await usersResponse.json();
                this.renderUsuarios(usuarios.slice(0, 5));
            }

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
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
            if (element) element.textContent = value;
        });
    }

    renderUsuarios(usuarios) {
        const tbody = document.getElementById('usuarios-body');
        if (!tbody) return;

        if (usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Nenhum usuário cadastrado</td></tr>';
            return;
        }

        tbody.innerHTML = usuarios.map(usuario => `
            <tr>
                <td>${usuario.nome}</td>
                <td>${usuario.email}</td>
                <td><span class="badge ${usuario.tipo}">${usuario.tipo}</span></td>
                <td>${new Date(usuario.data_cadastro).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    setupEventListeners() {
        const logoutBtn = document.querySelector('[data-logout]');
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
    window.adminManager = new AdminManager();
});