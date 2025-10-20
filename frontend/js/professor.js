// js/professor.js
class ProfessorManager {
    constructor() {
        this.currentProfessor = null;
    }

    // Carregar aulas do professor
    async carregarMinhasAulas() {
        try {
            const user = authManager.getCurrentUser();
            if (!user || user.tipo !== 'professor') return;

            const response = await apiClient.get(`/api/aulas/usuario/${user.id}`);
            
            if (response.success && response.data) {
                this.exibirAulasProfessor(response.data);
            } else {
                this.exibirAulasProfessor([]);
            }
        } catch (error) {
            console.error('Erro ao carregar aulas:', error);
            this.exibirAulasProfessor([]);
        }
    }

    // Exibir aulas do professor
    exibirAulasProfessor(aulas) {
        const container = document.getElementById('aulas-professor-grid');
        if (!container) return;

        if (!aulas || aulas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <h3>Nenhuma aula cadastrada</h3>
                    <p>Comece criando sua primeira aula</p>
                    <button class="btn-primary" onclick="showSection('criar-aula')">
                        <i class="fas fa-plus-circle"></i> Criar Primeira Aula
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = aulas.map(aula => `
            <div class="aula-card">
                <div class="aula-header">
                    <h3>${aula.disciplina_nome || aula.disciplina || 'Disciplina'}</h3>
                    <span class="status-badge ${this.getStatusAula(aula)}">
                        ${this.getTextoStatus(aula)}
                    </span>
                </div>
                <div class="aula-info">
                    <div class="info-item">
                        <span class="icon"><i class="fas fa-users"></i></span>
                        <strong>Turma:</strong> ${aula.turma || 'N/A'} | ${aula.curso || ''}
                    </div>
                    <div class="info-item">
                        <span class="icon"><i class="fas fa-map-marker-alt"></i></span>
                        <strong>Sala:</strong> ${aula.sala_bloco || ''} ${aula.sala_numero || 'N/A'}
                    </div>
                    <div class="info-item">
                        <span class="icon"><i class="fas fa-clock"></i></span>
                        <strong>Horário:</strong> ${aula.horario_inicio} - ${aula.horario_fim}
                    </div>
                    <div class="info-item">
                        <span class="icon"><i class="fas fa-calendar"></i></span>
                        <strong>Dias:</strong> ${this.formatarDiasSemana(aula.dia_semana)}
                    </div>
                </div>
                <div class="aula-actions">
                    <button class="btn-action" onclick="professorManager.editarAula(${aula.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-action secundario" onclick="professorManager.excluirAula(${aula.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Criar nova aula
    async criarAula(dadosAula) {
        try {
            const user = authManager.getCurrentUser();
            if (!user || user.tipo !== 'professor') {
                throw new Error('Acesso negado. Apenas professores podem criar aulas.');
            }

            // Validar dados obrigatórios
            if (!dadosAula.disciplina || !dadosAula.sala_id || !dadosAula.curso || 
                !dadosAula.turma || !dadosAula.horario_inicio || !dadosAula.horario_fim || 
                !dadosAula.dia_semana) {
                throw new Error('Preencha todos os campos obrigatórios');
            }

            const response = await apiClient.post('/api/aulas', dadosAula);
            
            if (response.success) {
                showNotification('Aula criada com sucesso!', 'success');
                // Limpar formulário
                document.getElementById('formCriarAula').reset();
                // Recarregar lista de aulas
                this.carregarMinhasAulas();
                return true;
            } else {
                throw new Error(response.error || 'Erro ao criar aula');
            }
        } catch (error) {
            console.error('Erro ao criar aula:', error);
            showNotification(error.message, 'error');
            return false;
        }
    }

    // Editar aula
    async editarAula(aulaId) {
        showNotification('Funcionalidade de edição em desenvolvimento', 'info');
        // Implementar edição posteriormente
    }

    // Excluir aula
    async excluirAula(aulaId) {
        if (confirm('Tem certeza que deseja excluir esta aula?')) {
            try {
                const response = await apiClient.delete(`/api/aulas/${aulaId}`);
                if (response.success) {
                    showNotification('Aula excluída com sucesso!', 'success');
                    this.carregarMinhasAulas();
                } else {
                    throw new Error(response.error || 'Erro ao excluir aula');
                }
            } catch (error) {
                console.error('Erro ao excluir aula:', error);
                showNotification(error.message, 'error');
            }
        }
    }

    // Helper methods
    getStatusAula(aula) {
        const agora = new Date();
        const horaAtual = agora.getHours() + ':' + (agora.getMinutes() < 10 ? '0' : '') + agora.getMinutes();
        
        // Lógica simples para status (pode ser melhorada)
        if (horaAtual >= aula.horario_inicio && horaAtual <= aula.horario_fim) {
            return 'em-andamento';
        } else if (horaAtual < aula.horario_inicio) {
            return 'proxima';
        } else {
            return 'concluida';
        }
    }

    getTextoStatus(aula) {
        const status = this.getStatusAula(aula);
        const textos = {
            'em-andamento': 'Em Andamento',
            'proxima': 'Próxima',
            'concluida': 'Concluída'
        };
        return textos[status] || 'Agendada';
    }

    formatarDiasSemana(dias) {
        const diasMap = {
            'seg': 'Segunda',
            'ter': 'Terça', 
            'qua': 'Quarta',
            'qui': 'Quinta',
            'sex': 'Sexta'
        };
        
        return dias.split(',').map(dia => diasMap[dia] || dia).join(', ');
    }
async carregarSalas() {
    try {
        const response = await apiClient.get('/api/salas');
        if (response.success && response.data) {
            const select = document.getElementById('salaSelect');
            select.innerHTML = '<option value="">Selecione a sala</option>' +
                response.data.map(sala => 
                    `<option value="${sala.id}">${sala.bloco} ${sala.numero} - ${sala.tipo} (Capacidade: ${sala.capacidade})</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar salas:', error);
    }
}
}


// Instância global
const professorManager = new ProfessorManager();