class AulasManager {
    constructor() {
        this.aulas = [];
        this.tipoUsuario = null;
        this.usuarioId = null;
        this.init();
    }

    async init() {
        console.log('📚 Inicializando AulasManager...');

        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData) {
            this.tipoUsuario = userData.tipo;
            this.usuarioId = userData.id;
            console.log(`👤 AulasManager configurado para: ${this.tipoUsuario} (ID: ${this.usuarioId})`);
        }
    }

    // ✅ CARREGAR AULAS DO ALUNO
    async carregarAulasAluno() {
        try {
            if (!this.usuarioId) {
                throw new Error('ID do aluno não encontrado');
            }

            console.log('🎓 Carregando aulas para aluno:', this.usuarioId);

            const response = await fetch(`/api/aluno/${this.usuarioId}/aulas`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            this.aulas = await response.json();
            console.log(`✅ ${this.aulas.length} aulas carregadas para o aluno`);
            return this.aulas;

        } catch (error) {
            console.error('❌ Erro ao carregar aulas do aluno:', error);
            this.aulas = [];
            throw error;
        }
    }

    // ✅ CARREGAR AULAS DO PROFESSOR
    async carregarAulasProfessor() {
        try {
            const result = await api.getMinhasAulasProfessor();
            if (result && result.success) {
                this.aulas = result.data;
                console.log(`✅ ${this.aulas.length} aulas carregadas para o professor`);
                return this.aulas;
            } else {
                throw new Error(result?.error || 'Erro ao carregar aulas do professor');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar aulas do professor:', error);
            this.aulas = [];
            throw error;
        }
    }

    // ✅ CARREGAR AULAS DO ALUNO
    async carregarAulasAluno() {
        try {
            if (!this.usuarioId) {
                throw new Error('ID do aluno não encontrado');
            }

            const response = await fetch(`/api/aluno/${this.usuarioId}/aulas`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            this.aulas = await response.json();
            console.log(`✅ ${this.aulas.length} aulas carregadas para o aluno`);
            return this.aulas;

        } catch (error) {
            console.error('❌ Erro ao carregar aulas do aluno:', error);
            this.aulas = [];
            throw error;
        }
    }

    // ✅ CARREGAR TODAS AS AULAS (ADMIN)
    async carregarTodasAulas() {
        try {
            const result = await api.getAulas();
            if (result && Array.isArray(result)) {
                this.aulas = result;
            } else if (result && result.success) {
                this.aulas = result.data;
            }
            console.log(`✅ ${this.aulas.length} aulas carregadas`);
            return this.aulas;
        } catch (error) {
            console.error('❌ Erro ao carregar todas as aulas:', error);
            this.aulas = [];
            throw error;
        }
    }

    renderizarAulas() {
        console.log('🎨 Renderizando aulas...');

        // Encontrar containers pelas classes (seu HTML atual)
        const containerMobile = document.querySelector('#aulas-mobile .aulas-list');
        const containerDesktop = document.querySelector('#aulas-desktop .aulas-grid');

        console.log('📱 Containers encontrados:', {
            mobile: containerMobile ? '✅' : '❌',
            desktop: containerDesktop ? '✅' : '❌'
        });

        if (!containerMobile && !containerDesktop) {
            console.error('❌ Nenhum container de aulas encontrado');
            return;
        }

        const html = this.gerarHTMLAulasAluno();

        if (containerMobile) containerMobile.innerHTML = html;
        if (containerDesktop) containerDesktop.innerHTML = html;

        console.log('✅ Aulas renderizadas com sucesso');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    agruparAulasPorDia(aulas) {
        const dias = {
            1: { nome: 'Segunda-feira', aulas: [] },
            2: { nome: 'Terça-feira', aulas: [] },
            3: { nome: 'Quarta-feira', aulas: [] },
            4: { nome: 'Quinta-feira', aulas: [] },
            5: { nome: 'Sexta-feira', aulas: [] }
        };

        aulas.forEach(aula => {
            const diaNumero = parseInt(aula.dia_semana);
            if (dias[diaNumero]) {
                dias[diaNumero].aulas.push(aula);
            }
        });

        // Ordenar aulas por horário em cada dia
        Object.values(dias).forEach(dia => {
            dia.aulas.sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));
        });

        return dias;
    }

    // ✅ VER DETALHES DA AULA (PARA ALUNO)
    verDetalhesAula(aulaId) {
        const aula = this.aulas.find(a => a.id === aulaId);
        if (aula) {
            this.mostrarModalDetalhesAulaAluno(aula);
        } else {
            this.mostrarErro('Aula não encontrada');
        }
    }

    // ✅ MODAL DE DETALHES DA AULA PARA ALUNO
    mostrarModalDetalhesAulaAluno(aula) {
        const dia = this.formatarDiaSemana(aula.dia_semana);

        const modalHTML = `
<div class="modal-overlay" id="modalDetalhesAulaAluno">
    <div class="modal-content modal-large">
        <div class="modal-header">
            <h3><i class="fas fa-info-circle"></i> Detalhes da Aula</h3>
            <button class="modal-close" onclick="fecharModalDetalhesAluno()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="aula-detalhes-grid">
                <div class="detalhe-item">
                    <label><i class="fas fa-book"></i> Disciplina:</label>
                    <span>${this.escapeHtml(aula.disciplina || aula.disciplina_nome || 'N/A')}</span>
                </div>
                ${aula.professor_nome ? `
                <div class="detalhe-item">
                    <label><i class="fas fa-chalkboard-teacher"></i> Professor:</label>
                    <span>${this.escapeHtml(aula.professor_nome)}</span>
                </div>
                ` : ''}
                ${aula.professor_email ? `
                <div class="detalhe-item">
                    <label><i class="fas fa-envelope"></i> Email do Professor:</label>
                    <span>${this.escapeHtml(aula.professor_email)}</span>
                </div>
                ` : ''}
                <div class="detalhe-item">
                    <label><i class="fas fa-graduation-cap"></i> Curso:</label>
                    <span>${this.escapeHtml(aula.curso || 'N/A')}</span>
                </div>
                <div class="detalhe-item">
                    <label><i class="fas fa-users"></i> Turma:</label>
                    <span>${this.escapeHtml(aula.turma || 'N/A')}</span>
                </div>
                <div class="detalhe-item">
                    <label><i class="fas fa-door-open"></i> Sala:</label>
                    <span>Sala ${this.escapeHtml(aula.sala_numero || 'N/A')} - Bloco ${this.escapeHtml(aula.sala_bloco || 'N/A')}</span>
                </div>
                <div class="detalhe-item">
                    <label><i class="fas fa-clock"></i> Horário:</label>
                    <span>${aula.horario_inicio || 'N/A'} - ${aula.horario_fim || 'N/A'}</span>
                </div>
                <div class="detalhe-item">
                    <label><i class="fas fa-calendar-day"></i> Dia:</label>
                    <span>${this.escapeHtml(dia)}</span>
                </div>
                ${aula.periodo ? `
                <div class="detalhe-item">
                    <label><i class="fas fa-calendar-alt"></i> Período:</label>
                    <span>${aula.periodo}º Período</span>
                </div>
                ` : ''}
                <div class="detalhe-item">
                    <label><i class="fas fa-info-circle"></i> Status:</label>
                    <span class="status-badge ativa">
                        <i class="fas fa-check-circle"></i> Ativa
                    </span>
                </div>
            </div>
            
            <!-- Ações específicas para aluno -->
            <div class="aula-actions-aluno" style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee;">
                <button class="btn-primary" onclick="abrirMapaSala('${aula.sala_bloco}', ${aula.sala_andar || 1}, '${aula.sala_numero}'); fecharModalDetalhesAluno();">
                    <i class="fas fa-map-marker-alt"></i> Localizar no Mapa
                </button>
                <button class="btn-secondary" onclick="fecharModalDetalhesAluno()">
                    <i class="fas fa-times"></i> Fechar
                </button>
            </div>
        </div>
    </div>
</div>`;

        this.fecharTodosModaisAluno();
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        window.fecharModalDetalhesAluno = () => {
            this.fecharTodosModaisAluno();
        };

        // Configurar fechamento ao clicar fora
        setTimeout(() => {
            const overlay = document.getElementById('modalDetalhesAulaAluno');
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        this.fecharTodosModaisAluno();
                    }
                });
            }
        }, 50);
    }

    // ✅ ATUALIZAR GERAR HTML DAS AULAS DO ALUNO (COM CLIQUE)
    gerarHTMLAulasAluno() {
        if (!this.aulas || this.aulas.length === 0) {
            return `
            <div class="empty-state">
                <i class="fas fa-calendar-times fa-3x"></i>
                <h3>Nenhuma aula encontrada</h3>
                <p>Você não tem aulas agendadas para sua turma no momento.</p>
            </div>
        `;
        }

        // Agrupar aulas por dia da semana
        const aulasPorDia = this.agruparAulasPorDia(this.aulas);
        return this.gerarHTMLAulasPorDia(aulasPorDia);
    }

    // No método gerarHTMLAulasPorDia, atualize a geração dos cards:
gerarHTMLAulasPorDia(aulasPorDia) {
    let html = '';

    for (const [diaNumero, diaInfo] of Object.entries(aulasPorDia)) {
        if (diaInfo.aulas.length > 0) {
            html += `
            <div class="dia-aulas">
                <h3 class="dia-titulo">
                    <i class="fas fa-calendar-day"></i>${diaInfo.nome}
                </h3>
                <div class="aulas-dia-container">
                    ${diaInfo.aulas.map(aula => {
                        const statusClass = this.getAulaStatusClass(aula);
                        return `
                        <div class="aula-card ${statusClass}" onclick="aulasManager.verDetalhesAula(${aula.id})">
                            ${this.getStatusBadge(aula)}
                            <div class="aula-header">
                                <h4>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h4>
                                <span class="aula-horario">
                                    <i class="fas fa-clock"></i>${aula.horario_inicio} - ${aula.horario_fim}
                                </span>
                            </div>
                            <div class="aula-info">
                                <p><strong>Professor:</strong> ${aula.professor_nome || 'N/A'}</p>
                                <p><strong>Sala:</strong> ${aula.sala_numero} - Bloco ${aula.sala_bloco}</p>
                                <p><strong>Turma:</strong> ${aula.turma || 'N/A'}</p>
                                ${aula.periodo ? `<p><strong>Período:</strong> ${aula.periodo}º</p>` : ''}
                            </div>
                            <div class="aula-actions">
                                <button class="btn-localizar" 
                                        onclick="event.stopPropagation(); abrirMapaSala('${aula.sala_bloco}', ${aula.sala_andar || 1}, '${aula.sala_numero}')">
                                    <i class="fas fa-map-marker-alt"></i> Localizar Sala
                                </button>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
            `;
        }
    }

    return html || this.getHTMLNenhumaAulaEstaSemana();
}

// Método auxiliar para determinar a classe de status
getAulaStatusClass(aula) {
    if (aula.ativa === 0 || aula.ativa === false || aula.status === 'cancelada') {
        return 'aula-cancelada';
    }
    
    // Aqui você pode adicionar lógica para determinar se está em andamento, próxima, etc.
    // Baseado no horário atual e data
    return '';
}

// Método para gerar badge de status
getStatusBadge(aula) {
    if (aula.ativa === 0 || aula.ativa === false || aula.status === 'cancelada') {
        return '<span class="aula-status-badge cancelada">Cancelada</span>';
    }
    
    // Lógica para outros status
    return '';
}

    gerarHTMLAulasProfessor() {
        if (typeof professorManager !== 'undefined') {
            // Se professorManager existe, deixe ele lidar com a renderização
            console.log('📊 ProfessorManager encontrado, delegando renderização...');
            return '';
        }

        // Fallback básico para professor
        return `
            <div class="professor-aulas-grid">
                ${this.aulas.map(aula => `
                    <div class="aula-card professor" data-aula-id="${aula.id}">
                        <div class="aula-header">
                            <h4>${aula.disciplina || 'Disciplina'}</h4>
                            <span class="status ${aula.ativa ? 'ativa' : 'cancelada'}">
                                ${aula.ativa ? '🟢 Ativa' : '🔴 Cancelada'}
                            </span>
                        </div>
                        <div class="aula-info">
                            <p><strong>Horário:</strong> ${aula.horario_inicio} - ${aula.horario_fim}</p>
                            <p><strong>Sala:</strong> ${aula.sala_numero} - Bloco ${aula.sala_bloco}</p>
                            <p><strong>Turma:</strong> ${aula.turma}</p>
                            <p><strong>Dia:</strong> ${this.formatarDiaSemana(aula.dia_semana)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    gruparAulasPorDia(aulas) {
        const dias = {
            1: { nome: 'Segunda-feira', aulas: [] },
            2: { nome: 'Terça-feira', aulas: [] },
            3: { nome: 'Quarta-feira', aulas: [] },
            4: { nome: 'Quinta-feira', aulas: [] },
            5: { nome: 'Sexta-feira', aulas: [] }
        };

        aulas.forEach(aula => {
            const diaNumero = parseInt(aula.dia_semana);
            if (dias[diaNumero]) {
                dias[diaNumero].aulas.push(aula);
            }
        });

        // Ordenar aulas por horário em cada dia
        Object.values(dias).forEach(dia => {
            dia.aulas.sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));
        });

        return dias;
    }

    // ✅ FECHAR TODOS OS MODAIS (ALUNO)
    fecharTodosModaisAluno() {
        const modais = document.querySelectorAll('.modal-overlay');
        modais.forEach(modal => modal.remove());
    }

    // ✅ FORMATAR DIA DA SEMANA
    formatarDiaSemana(dia) {
        const diasMap = {
            1: 'Segunda-feira',
            2: 'Terça-feira',
            3: 'Quarta-feira',
            4: 'Quinta-feira',
            5: 'Sexta-feira',
            'segunda': 'Segunda-feira',
            'terca': 'Terça-feira',
            'quarta': 'Quarta-feira',
            'quinta': 'Quinta-feira',
            'sexta': 'Sexta-feira'
        };
        return diasMap[dia] || dia;
    }

    // ✅ HTML QUANDO NÃO HÁ AULAS
    getHTMLNenhumaAula() {
        if (this.tipoUsuario === 'aluno') {
            return `
                <div class="empty-state">
                    <i class="fas fa-calendar-times fa-3x"></i>
                    <h3>Nenhuma aula encontrada</h3>
                    <p>Você não tem aulas agendadas para sua turma no momento.</p>
                    <p class="empty-subtitle">Verifique se seu cadastro está completo com curso e turma.</p>
                </div>
            `;
        } else {
            return `
                <div class="empty-state">
                    <i class="fas fa-chalkboard-teacher fa-3x"></i>
                    <h3>Nenhuma aula encontrada</h3>
                    <p>${this.tipoUsuario === 'professor' ? 'Crie sua primeira aula usando o botão "Nova Aula"' : 'Nenhuma aula cadastrada no sistema'}</p>
                </div>
            `;
        }
    }

    // ✅ HTML QUANDO NÃO HÁ AULAS ESTA SEMANA
    getHTMLNenhumaAulaEstaSemana() {
        return `
            <div class="empty-state">
                <i class="fas fa-calendar-check fa-3x"></i>
                <h3>Nenhuma aula esta semana</h3>
                <p>Não há aulas agendadas para os dias atuais.</p>
                <p class="empty-subtitle">As aulas aparecerão aqui quando forem agendadas para sua turma.</p>
            </div>
        `;
    }

    // ✅ VERIFICAR SE ALUNO TEM CADASTRO COMPLETO
    async verificarCadastroCompletoAluno() {
        try {
            if (this.tipoUsuario !== 'aluno') return true;

            const response = await fetch(`/api/aluno/dados-completos/${this.usuarioId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.cadastro_completo;
            }
            return false;
        } catch (error) {
            console.error('❌ Erro ao verificar cadastro:', error);
            return false;
        }
    }

    async carregarERenderizarAulas() {
        try {
            console.log('🚀 Iniciando carregamento de aulas...');

            // Verificar se é aluno
            if (this.tipoUsuario !== 'aluno') {
                console.log('⚠️ Não é aluno, ignorando carregamento');
                return;
            }

            // Carregar aulas
            await this.carregarAulasAluno();

            // Renderizar
            this.renderizarAulas();

            console.log('✅ Aulas carregadas e renderizadas com sucesso');

        } catch (error) {
            console.error('❌ Erro ao carregar e renderizar aulas:', error);
            this.mostrarErro('Erro ao carregar aulas: ' + error.message);
        }
    }

    // ✅ MOSTRAR MODAL DE CADASTRO INCOMPLETO
    mostrarModalCadastroIncompleto() {
        const modalHTML = `
            <div class="modal-overlay" id="modalCadastroIncompleto">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-plus"></i> Complete seu Cadastro</h3>
                    </div>
                    <div class="modal-body">
                        <p>Para visualizar suas aulas, é necessário completar seu cadastro com:</p>
                        <ul>
                            <li>✅ Curso</li>
                            <li>✅ Período</li>  
                            <li>✅ Turma</li>
                        </ul>
                        <p>Clique no botão abaixo para completar seu cadastro.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-primary" onclick="window.location.href='perfil.html'">
                            <i class="fas fa-user-edit"></i> Completar Cadastro
                        </button>
                        <button class="btn-secondary" onclick="document.getElementById('modalCadastroIncompleto').remove()">
                            <i class="fas fa-times"></i> Mais Tarde
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    mostrarErro(mensagem) {
        console.error('❌ Erro:', mensagem);

        // Encontrar containers e mostrar erro
        const containerMobile = document.querySelector('#aulas-mobile .aulas-list');
        const containerDesktop = document.querySelector('#aulas-desktop .aulas-grid');

        const errorHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h3>Erro ao carregar aulas</h3>
                <p>${mensagem}</p>
                <button class="btn-primary" onclick="aulasManager.carregarERenderizarAulas()">
                    <i class="fas fa-redo"></i> Tentar Novamente
                </button>
            </div>
        `;

        if (containerMobile) containerMobile.innerHTML = errorHTML;
        if (containerDesktop) containerDesktop.innerHTML = errorHTML;
    }

    // ========== MÉTODOS EXISTENTES (COMPATIBILIDADE) ==========



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

// ✅ INICIALIZAÇÃO GLOBAL
const aulasManager = new AulasManager();

window.fecharModalDetalhesAluno = function () {
    const modal = document.getElementById('modalDetalhesAulaAluno');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
};

// ✅ FUNÇÃO GLOBAL PARA CARREGAR AULAS
window.carregarAulas = function (containerId = null) {
    if (!containerId) {
        // Determinar container automaticamente baseado na tela
        const isMobile = window.innerWidth < 768;
        containerId = isMobile ? 'aulas-list-mobile' : 'aulas-list-desktop';
    }

    aulasManager.carregarERenderizarAulas(containerId);
};

// ✅ CORRIGIR A INICIALIZAÇÃO NO aulas.js
document.addEventListener('DOMContentLoaded', function () {
    console.log('📚 AulasManager carregado e pronto');

    // ✅ CORREÇÃO: Carregar aulas automaticamente para ALUNOS
    setTimeout(() => {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData && userData.tipo === 'aluno') {
            console.log('🎓 Inicializando carregamento automático de aulas para aluno...');

            // Determinar container baseado no tamanho da tela
            const isMobile = window.innerWidth < 768;
            const containerId = isMobile ? 'aulas-list-mobile' : 'aulas-list-desktop';

            // Carregar aulas
            carregarAulas(containerId);
        }
    }, 1000);
});

// ✅ FUNÇÃO DE DEBUG - TESTAR VÍNCULO
async function debugVinculoAluno() {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || userData.tipo !== 'aluno') {
            alert('Esta função é apenas para alunos');
            return;
        }

        console.log('🐛 Iniciando debug de vínculo...');

        const response = await fetch(`/api/aluno/${userData.id}/debug-vinculo`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const debugData = await response.json();
        console.log('🔍 [DEBUG] Resultado completo:', debugData);

        // Mostrar resultado em um alerta formatado
        const mensagem = `
🎯 RESULTADO DO DEBUG:

👤 ALUNO:
• Nome: ${debugData.aluno?.aluno_nome || 'N/A'}
• Curso: ${debugData.aluno?.aluno_curso || 'NÃO DEFINIDO'}
• Turma: ${debugData.aluno?.turma_nome || 'NÃO VINCULADO'}
• Status: ${debugData.aluno?.status_vinculo || 'N/A'}

📚 AULAS ENCONTRADAS: ${debugData.aulas?.length || 0}

${debugData.aulas?.map(aula => `
➤ Aula: ${aula.disciplina}
  Curso: ${aula.aula_curso} | Turma: ${aula.aula_turma}
  Professor: ${aula.professor_nome} | Ativa: ${aula.ativa ? '✅' : '❌'}
`).join('')}

🔍 RESUMO:
• Aluno tem curso: ${debugData.resumo?.aluno_tem_curso ? '✅' : '❌'}
• Aluno tem turma: ${debugData.resumo?.aluno_tem_turma ? '✅' : '❌'}
• Correspondência de curso: ${debugData.resumo?.correspondencia_curso ? '✅' : '❌'}
• Correspondência de turma: ${debugData.resumo?.correspondencia_turma ? '✅' : '❌'}
        `.trim();

        alert(mensagem);

    } catch (error) {
        console.error('❌ Erro no debug:', error);
        alert('Erro no debug: ' + error.message);
    }
}

// ✅ ADICIONAR AO GLOBAL PARA TESTAR NO CONSOLE
window.debugVinculoAluno = debugVinculoAluno;

// ✅ FUNÇÃO DE DEBUG PARA VERIFICAR RENDERIZAÇÃO
window.debugRenderizacaoAulas = function () {
    console.log('🔍 [DEBUG RENDER] Verificando renderização...');

    const userData = JSON.parse(localStorage.getItem('userData'));
    console.log('👤 Usuário:', userData);

    console.log('📚 AulasManager:', {
        tipoUsuario: aulasManager.tipoUsuario,
        usuarioId: aulasManager.usuarioId,
        aulas: aulasManager.aulas,
        quantidade: aulasManager.aulas.length
    });

    // Verificar containers
    const containerMobile = document.getElementById('aulas-list-mobile');
    const containerDesktop = document.getElementById('aulas-list-desktop');

    console.log('📱 Containers:', {
        mobile: containerMobile ? '✅ Encontrado' : '❌ Não encontrado',
        desktop: containerDesktop ? '✅ Encontrado' : '❌ Não encontrado',
        mobileHTML: containerMobile ? containerMobile.innerHTML : 'N/A',
        desktopHTML: containerDesktop ? containerDesktop.innerHTML : 'N/A'
    });

    // Forçar recarregamento
    if (userData && userData.tipo === 'aluno') {
        const isMobile = window.innerWidth < 768;
        const containerId = isMobile ? 'aulas-list-mobile' : 'aulas-list-desktop';
        console.log('🔄 Forçando recarregamento no container:', containerId);
        carregarAulas(containerId);
    }
};