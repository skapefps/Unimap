// turmas.js - Gerenciador de Turmas
class TurmasManager {
    constructor() {
        this.turmas = [];
        this.alunos = [];
        this.init();
    }

    async init() {
        await this.carregarTurmas();
        await this.carregarAlunos();
        this.setupEventListeners();
    }

    async carregarTurmas() {
        try {
            const response = await api.authenticatedRequest('/turmas');
            if (response.success) {
                this.turmas = response.data;
                this.renderizarTurmas();
            }
        } catch (error) {
            console.error('Erro ao carregar turmas:', error);
        }
    }

    async carregarAlunos() {
        try {
            const response = await api.authenticatedRequest('/usuarios?tipo=aluno');
            if (response.success) {
                this.alunos = response.data;
            }
        } catch (error) {
            console.error('Erro ao carregar alunos:', error);
        }
    }

    renderizarTurmas() {
        const container = document.getElementById('turmas-container');
        if (!container) return;

        container.innerHTML = this.turmas.map(turma => `
            <div class="turma-card">
                <h3>${turma.nome}</h3>
                <p>Curso: ${turma.curso_nome}</p>
                <p>Período: ${turma.periodo}°</p>
                <p>Ano: ${turma.ano}</p>
                <p>Alunos: ${turma.total_alunos || 0}</p>
                <div class="turma-actions">
                    <button onclick="turmasManager.vincularAlunos(${turma.id})">Vincular Alunos</button>
                    <button onclick="turmasManager.verAlunos(${turma.id})">Ver Alunos</button>
                </div>
            </div>
        `).join('');
    }

    async vincularAlunos(turmaId) {
        // Implementar modal para vincular alunos
    }

    async verAlunos(turmaId) {
        // Implementar modal para ver alunos
    }

    setupEventListeners() {
        // Configurar eventos
    }
}

const turmasManager = new TurmasManager();