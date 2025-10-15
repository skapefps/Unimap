class ProfessoresManager {
    constructor() {
        this.user = null;
        this.professores = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadProfessores();
        this.setupEventListeners();
        this.updateUserInfo();
    }

    async checkAuth() {
        const userData = localStorage.getItem('unimap_user');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }
        this.user = JSON.parse(userData);
    }

    updateUserInfo() {
        const userName = document.getElementById('userName');
        if (userName && this.user) {
            userName.textContent = this.user.nome;
        }
    }

    async loadProfessores() {
        try {
            this.professores = await api.getProfessores();
            this.renderProfessoresDisponiveis();
            this.populateProfessorSelect();
            
            // Carregar professores favoritos
            await this.loadMeusProfessores();
        } catch (error) {
            console.error('Erro ao carregar professores:', error);
        }
    }

    async loadMeusProfessores() {
        try {
            const meusProfessores = await api.getProfessoresFavoritos(this.user.id);
            this.renderMeusProfessores(meusProfessores);
        } catch (error) {
            console.error('Erro ao carregar professores favoritos:', error);
        }
    }

    renderProfessoresDisponiveis() {
        const container = document.getElementById('lista-professores-disponiveis');
        if (!container) return;

        container.innerHTML = this.professores.map(professor => `
            <div class="professor-card">
                <h4>${professor.nome}</h4>
                <p><strong>Email:</strong> ${professor.email}</p>
                <p><strong>Curso:</strong> ${professor.curso || 'Não informado'}</p>
                <button class="btn-small" onclick="professoresManager.adicionarAosFavoritos(${professor.id})">
                    ★ Adicionar
                </button>
            </div>
        `).join('');
    }

    renderMeusProfessores(professores) {
        const container = document.getElementById('lista-meus-professores');
        if (!container) return;

        if (professores.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhum professor adicionado ainda.</p>';
            return;
        }

        container.innerHTML = professores.map(professor => `
            <div class="professor-card favorito">
                <h4>${professor.nome}</h4>
                <p><strong>Periodo:</strong> ${professor.periodo || 'Não informado'}</p>
                <p><strong>Curso:</strong> ${professor.curso || 'Não informado'}</p>
                <button class="btn-small btn-remove" onclick="professoresManager.removerDosFavoritos(${professor.id})">
                    ✕ Remover
                </button>
            </div>
        `).join('');
    }

    populateProfessorSelect() {
        const select = document.getElementById('professor-select');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione o professor</option>' +
            this.professores.map(prof => 
                `<option value="${prof.id}">${prof.nome} - ${prof.curso || 'Geral'}</option>`
            ).join('');
    }

    setupEventListeners() {
        const form = document.getElementById('form-adicionar-professor');
        if (form) {
            form.addEventListener('submit', (e) => this.handleAdicionarProfessor(e));
        }
    }

    async handleAdicionarProfessor(e) {
        e.preventDefault();
        
        const curso = document.getElementById('curso-select').value;
        const periodo = document.getElementById('periodo-select').value;
        const professorId = document.getElementById('professor-select').value;

        if (!curso || !periodo || !professorId) {
            this.showMessage('Preencha todos os campos!', 'error');
            return;
        }

        try {
            await api.adicionarProfessorFavorito(this.user.id, professorId);
            this.showMessage('Professor adicionado com sucesso!', 'success');
            
            // Recarregar lista
            await this.loadMeusProfessores();
            
            // Limpar formulário
            document.getElementById('form-adicionar-professor').reset();
            
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    async adicionarAosFavoritos(professorId) {
        try {
            await api.adicionarProfessorFavorito(this.user.id, professorId);
            this.showMessage('Professor adicionado aos favoritos!', 'success');
            await this.loadMeusProfessores();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    async removerDosFavoritos(professorId) {
        // Implementar quando tiver rota de remoção
        this.showMessage('Funcionalidade em desenvolvimento', 'info');
    }

    showMessage(message, type = 'info') {
        // Implementar sistema de mensagens
        alert(`${type.toUpperCase()}: ${message}`);
    }
}

// Funções globais
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

function logout() {
    localStorage.removeItem('unimap_user');
    window.location.href = 'login.html';
}

// Inicializar
let professoresManager;
window.addEventListener('load', () => {
    professoresManager = new ProfessoresManager();
});