// professor.js - Versão corrigida com autenticação
class ProfessorManager {
    constructor() {
        this.currentUser = null;
        this.minhasAulas = [];
        this.init();
    }

    async init() {
        console.log('👨‍🏫 Inicializando ProfessorManager...');
        
        // Verificar autenticação
        const userData = localStorage.getItem('userData');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            console.log('✅ Professor carregado:', this.currentUser);
        } else {
            console.error('❌ Professor não autenticado');
            window.location.href = 'login.html';
            return;
        }

        await this.carregarMinhasAulas();
    }

    async carregarMinhasAulas() {
        try {
            console.log('📚 Carregando aulas do professor...');
            
            // 🔧 USAR A NOVA API COM AUTENTICAÇÃO
            const result = await api.getMinhasAulas();
            
            if (result && result.success) {
                this.minhasAulas = result.data;
                console.log(`✅ ${this.minhasAulas.length} aulas carregadas`);
                this.renderizarAulas();
            } else {
                console.error('❌ Erro ao carregar aulas:', result?.error);
                this.mostrarErro('Erro ao carregar aulas: ' + (result?.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('❌ Erro ao carregar aulas:', error);
            this.mostrarErro('Erro de conexão ao carregar aulas');
        }
    }

    renderizarAulas() {
        const container = document.getElementById('aulas-professor-grid');
        if (!container) return;

        if (this.minhasAulas.length === 0) {
            container.innerHTML = `
                <div class="professor-empty-state">
                    <i class="fas fa-chalkboard-teacher fa-3x"></i>
                    <p>Nenhuma aula encontrada</p>
                    <p class="empty-subtitle">Crie sua primeira aula usando o botão acima</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.minhasAulas.map(aula => this.criarCardAula(aula)).join('');
    }

    criarCardAula(aula) {
        const status = this.getStatusAula(aula);
        const dias = this.formatarDiasSemana(aula.dia_semana);
        
        return `
            <div class="professor-aula-card" data-aula-id="${aula.id}">
                <div class="professor-aula-header">
                    <h3>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h3>
                    <span class="professor-status-badge ${status.classe}">
                        <i class="fas ${status.icone}"></i> ${status.texto}
                    </span>
                </div>
                <div class="professor-aula-info">
                    <div class="professor-info-item">
                        <span class="professor-icon"><i class="fas fa-clock"></i></span>
                        <span>${aula.horario_inicio} - ${aula.horario_fim} | ${dias}</span>
                    </div>
                    <div class="professor-info-item">
                        <span class="professor-icon"><i class="fas fa-door-open"></i></span>
                        <span>Sala ${aula.sala_numero} - Bloco ${aula.sala_bloco}</span>
                    </div>
                    <div class="professor-info-item">
                        <span class="professor-icon"><i class="fas fa-users"></i></span>
                        <span>Turma: ${aula.turma || 'N/A'} | Curso: ${aula.curso || 'N/A'}</span>
                    </div>
                </div>
                <div class="professor-aula-actions">
                    <button class="professor-btn-action" onclick="professorManager.verDetalhesAula(${aula.id})">
                        <i class="fas fa-info-circle"></i> Detalhes
                    </button>
                    <button class="professor-btn-action secundario" onclick="professorManager.abrirMapaSala('${aula.sala_bloco}', ${aula.sala_andar || 1}, '${aula.sala_numero}')">
                        <i class="fas fa-map-marker-alt"></i> Localizar
                    </button>
                    <button class="professor-btn-action perigo" onclick="professorManager.excluirAula(${aula.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }

    async criarAula(dadosAula) {
        try {
            console.log('📝 Criando nova aula:', dadosAula);
            
            // 🔧 USAR A NOVA API COM AUTENTICAÇÃO
            const result = await api.criarAula(dadosAula);
            
            if (result && result.success) {
                console.log('✅ Aula criada com sucesso!');
                this.mostrarSucesso('Aula criada com sucesso!');
                
                // Recarregar aulas
                await this.carregarMinhasAulas();
                
                // Voltar para a lista de aulas
                showSection('minhas-aulas-professor');
                
                // Limpar formulário
                document.getElementById('formCriarAula')?.reset();
                
            } else {
                throw new Error(result?.error || 'Erro ao criar aula');
            }
        } catch (error) {
            console.error('❌ Erro ao criar aula:', error);
            this.mostrarErro('Erro ao criar aula: ' + error.message);
        }
    }

    async excluirAula(aulaId) {
        if (!confirm('Tem certeza que deseja excluir esta aula?')) {
            return;
        }

        try {
            console.log('🗑️ Excluindo aula:', aulaId);
            
            // 🔧 USAR A NOVA API COM AUTENTICAÇÃO
            const result = await api.excluirAula(aulaId);
            
            if (result && result.success) {
                console.log('✅ Aula excluída com sucesso!');
                this.mostrarSucesso('Aula excluída com sucesso!');
                
                // Recarregar aulas
                await this.carregarMinhasAulas();
            } else {
                throw new Error(result?.error || 'Erro ao excluir aula');
            }
        } catch (error) {
            console.error('❌ Erro ao excluir aula:', error);
            this.mostrarErro('Erro ao excluir aula: ' + error.message);
        }
    }

    // 🔧 MÉTODOS AUXILIARES
    getStatusAula(aula) {
        // Lógica para determinar status da aula
        return { classe: 'ativa', texto: 'Ativa', icone: 'fa-check-circle' };
    }

    formatarDiasSemana(diaSemana) {
        const diasMap = {
            'segunda': 'Segunda',
            'terca': 'Terça', 
            'quarta': 'Quarta',
            'quinta': 'Quinta',
            'sexta': 'Sexta'
        };
        return diasMap[diaSemana] || diaSemana;
    }

    verDetalhesAula(aulaId) {
        console.log('📖 Ver detalhes da aula:', aulaId);
        // Implementar modal de detalhes
        alert(`Detalhes da aula ${aulaId}\n\nEm desenvolvimento...`);
    }

    abrirMapaSala(bloco, andar, sala) {
        console.log('🗺️ Abrindo mapa para:', bloco, andar, sala);
        showSection('mapa-blocos');
        
        setTimeout(() => {
            if (window.mapaManager) {
                window.mapaManager.mostrarSalas(bloco, andar);
            }
        }, 300);
    }

    mostrarSucesso(mensagem) {
        if (window.showNotification) {
            showNotification(mensagem, 'success');
        } else {
            alert('✅ ' + mensagem);
        }
    }

    mostrarErro(mensagem) {
        if (window.showNotification) {
            showNotification(mensagem, 'error');
        } else {
            alert('❌ ' + mensagem);
        }
    }
}

// ✅ INSTÂNCIA GLOBAL
const professorManager = new ProfessorManager();