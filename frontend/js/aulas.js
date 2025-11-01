class AulasManager {
    constructor() {
        this.aulas = [];
        this.init();
    }

    async init() {
        console.log('📚 Inicializando AulasManager...');
        //await this.carregarAulas();
    }

    async carregarAulas() {
        try {
            const result = await api.getAulas();
            if (result && result.success) {
                this.aulas = result.data;
                console.log(`✅ ${this.aulas.length} aulas carregadas`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar aulas:', error);
        }
    }

    async criarAula(dadosAula) {
        try {
            const result = await api.criarAula(dadosAula);
            return result;
        } catch (error) {
            console.error('❌ Erro ao criar aula:', error);
            throw error;
        }
    }

    async excluirAula(aulaId) {
        try {
            const result = await api.excluirAula(aulaId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao excluir aula:', error);
            throw error;
        }
    }

    filtrarAulasPorProfessor(professorId) {
        return this.aulas.filter(aula => aula.professor_id === professorId);
    }

    filtrarAulasPorSala(salaId) {
        return this.aulas.filter(aula => aula.sala_id === salaId);
    }

    filtrarAulasPorDia(diaSemana) {
        return this.aulas.filter(aula => aula.dia_semana === diaSemana);
    }

    verificarConflitoHorario(salaId, diaSemana, horarioInicio, horarioFim, aulaId = null) {
        return this.aulas.some(aula => {
            if (aula.id === aulaId) return false; 
            if (aula.sala_id !== salaId) return false;
            if (aula.dia_semana !== diaSemana) return false;
            
            const inicioExistente = aula.horario_inicio;
            const fimExistente = aula.horario_fim;
            
            return (
                (horarioInicio >= inicioExistente && horarioInicio < fimExistente) ||
                (horarioFim > inicioExistente && horarioFim <= fimExistente) ||
                (horarioInicio <= inicioExistente && horarioFim >= fimExistente)
            );
        });
    }
}

const aulasManager = new AulasManager();