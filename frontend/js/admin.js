class AdminManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.checkAdminAccess();
        await this.loadDashboardData();
        this.setupEventListeners();
    }

    async checkAdminAccess() {
        const userData = localStorage.getItem('unimap_user');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }

        const user = JSON.parse(userData);
        if (user.tipo !== 'admin') {
            alert('Acesso restrito a administradores!');
            window.location.href = 'index.html';
            return;
        }
    }

    async loadDashboardData() {
        try {
            // Carregar estatísticas
            const stats = await api.getEstatisticas();
            this.updateStats(stats);

            // Carregar últimos usuários
            const usuarios = await api.getUsuarios();
            this.renderUsuarios(usuarios.slice(0, 5)); // Últimos 5

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('total-usuarios').textContent = stats.total_usuarios || '0';
        document.getElementById('total-professores').textContent = stats.total_professores || '0';
        document.getElementById('total-salas').textContent = stats.total_salas || '0';
        document.getElementById('total-aulas').textContent = stats.total_aulas || '0';
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
        // Configurar eventos específicos do admin
    }
}

// Inicializar admin
window.addEventListener('load', () => {
    window.adminManager = new AdminManager();
});