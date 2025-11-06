class AulasManager {
    constructor() {
        this.aulas = [];
        this.tipoUsuario = null;
        this.usuarioId = null;
        this.currentUser = null;
        this.containerDesktop = null;
        this.containerMobile = null;
        this.init();
    }

    async init() {
        console.log('🎯 Inicializando AulasManager...');

        // Inicializar containers
        this.containerDesktop = document.getElementById('aulas-list-desktop');
        this.containerMobile = document.getElementById('aulas-list-mobile');

        console.log('📱 Containers:', {
            desktop: this.containerDesktop,
            mobile: this.containerMobile
        });

        // Verificar se o usuário está logado
        const userData = localStorage.getItem('userData');
        if (!userData) {
            console.error('❌ Usuário não está logado');
            this.mostrarErro('Você precisa fazer login para acessar as aulas');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
            return;
        }

        try {
            const user = JSON.parse(userData);
            this.currentUser = user;
            this.tipoUsuario = user.tipo;
            this.usuarioId = user.id;

            console.log('👤 Usuário carregado:', user);

            if (!user.id) {
                throw new Error('ID do usuário não encontrado');
            }

            // Carregar aulas baseado no tipo de usuário
            await this.carregarERenderizarAulas();

        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.mostrarErro('Erro ao carregar dados: ' + error.message);
        }
    }

    // 🔥 CORREÇÃO: Método gerarHTMLAulas que estava faltando
    gerarHTMLAulas(aulas) {
        console.log('🎨 Gerando HTML para', aulas.length, 'aulas');

        // Salvar as aulas na instância
        this.aulas = aulas;

        if (!aulas || aulas.length === 0) {
            return this.getHTMLNenhumaAula();
        }

        // Baseado no tipo de usuário, usar o método apropriado
        if (this.tipoUsuario === 'aluno') {
            return this.gerarHTMLAulasAluno();
        } else if (this.tipoUsuario === 'professor') {
            return this.gerarHTMLAulasProfessor();
        } else {
            // Fallback para outros tipos de usuário
            return this.gerarHTMLAulasGenerico(aulas);
        }
    }

    // 🔥 CORREÇÃO: Método genérico para fallback
    gerarHTMLAulasGenerico(aulas) {
        return `
            <div class="aulas-grid">
                ${aulas.map(aula => `
                    <div class="aula-card">
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
                            <p><strong>Curso:</strong> ${aula.curso}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async carregarAulasAluno(alunoId) {
        try {
            console.log('📚 Carregando aulas para aluno:', alunoId);

            const response = await api.request(`/aulas/aluno/${alunoId}`, {
                method: 'GET'
            });

            if (response.success) {
                console.log(`✅ ${response.data.length} aulas carregadas para o aluno`);
                return response.data;
            } else {
                throw new Error(response.error || 'Erro ao carregar aulas');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar aulas do aluno:', error);
            throw error;
        }
    }

    async carregarAulasProfessor() {
        try {
            console.log('👨‍🏫 Carregando aulas do professor');

            const response = await api.request('/aulas/professor/minhas-aulas', {
                method: 'GET'
            });

            if (response.success) {
                console.log(`✅ ${response.data.length} aulas carregadas para o professor`);
                return response.data;
            } else {
                throw new Error(response.error || 'Erro ao carregar aulas do professor');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar aulas do professor:', error);
            throw error;
        }
    }

    async carregarTodasAulas() {
        try {
            console.log('👑 Carregando todas as aulas (admin)');

            const response = await api.request('/aulas', {
                method: 'GET'
            });

            if (response.success) {
                console.log(`✅ ${response.data.length} aulas carregadas (admin)`);
                return response.data;
            } else {
                throw new Error(response.error || 'Erro ao carregar todas as aulas');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar todas as aulas:', error);
            throw error;
        }
    }

    renderizarAulas(aulas) {
        console.log('🎨 Renderizando aulas:', aulas.length);

        try {
            const aulasHTML = this.gerarHTMLAulas(aulas);

            // Atualizar desktop
            if (this.containerDesktop) {
                this.containerDesktop.innerHTML = aulasHTML;
            }

            // Atualizar mobile
            if (this.containerMobile) {
                this.containerMobile.innerHTML = aulasHTML;
            }

            console.log('✅ Aulas renderizadas com sucesso');
        } catch (error) {
            console.error('❌ Erro ao renderizar aulas:', error);
            this.mostrarErro('Erro ao exibir aulas: ' + error.message);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    agruparAulasPorData(aulas) {
        console.log('📅 Agrupando TODAS as aulas por data');

        const grupos = {};

        aulas.forEach(aula => {
            if (!aula.data_aula) {
                console.log('⚠️ Aula sem data, pulando:', aula.id);
                return;
            }

            // Usar a data completa como chave (YYYY-MM-DD)
            const dataKey = aula.data_aula;

            if (!grupos[dataKey]) {
                // Criar novo grupo para esta data
                grupos[dataKey] = {
                    nome: this.formatarDataDisplay(aula.data_aula),
                    data: new Date(aula.data_aula),
                    aulas: []
                };
            }

            grupos[dataKey].aulas.push(aula);
        });

        // Ordenar os grupos por data (mais antiga primeiro)
        const gruposOrdenados = Object.values(grupos).sort((a, b) => a.data - b.data);

        // Ordenar aulas dentro de cada grupo por horário
        gruposOrdenados.forEach(grupo => {
            grupo.aulas.sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));
        });

        console.log(`📊 ${gruposOrdenados.length} grupos de data criados`);
        return gruposOrdenados;
    }

    // 🔧 CORREÇÃO: MÉTODO agruparAulasPorDia CORRIGIDO
    agruparAulasPorDia(aulas) {
        const dias = {
            1: { nome: 'Segunda-feira', aulas: [] },
            2: { nome: 'Terça-feira', aulas: [] },
            3: { nome: 'Quarta-feira', aulas: [] },
            4: { nome: 'Quinta-feira', aulas: [] },
            5: { nome: 'Sexta-feira', aulas: [] }
        };

        aulas.forEach(aula => {
            // Usar data_aula para determinar o dia da semana
            let diaNumero;
            if (aula.data_aula) {
                // 🔥 CORREÇÃO: Usar UTC para cálculo consistente
                const [ano, mes, dia] = aula.data_aula.split('-').map(Number);
                const data = new Date(Date.UTC(ano, mes - 1, dia));
                const diaSemanaUTC = data.getUTCDay(); // 0=Domingo, 1=Segunda, etc.

                // 🔥 CORREÇÃO: Converter corretamente para 1-5 (Segunda a Sexta)
                diaNumero = diaSemanaUTC === 0 ? 7 : diaSemanaUTC; // 1=Segunda, 7=Domingo

                console.log(`📅 Frontend - Data: ${aula.data_aula}, UTC Day: ${diaSemanaUTC}, Dia Calculado: ${diaNumero}`);

                // Se for sábado (6) ou domingo (7), pular
                if (diaNumero === 6 || diaNumero === 7) {
                    console.log(`⏭️ Pulando aula de ${aula.data_aula} - Fim de semana (dia ${diaNumero})`);
                    return;
                }
            } else if (aula.dia_semana) {
                // Fallback para dia_semana do banco (já deve estar correto)
                diaNumero = parseInt(aula.dia_semana);
                console.log(`📅 Usando dia_semana do banco: ${diaNumero} para aula ${aula.id}`);
            } else {
                console.log('⚠️ Aula sem data_aula e dia_semana, pulando:', aula.id);
                return; // Pular aula sem dia definido
            }

            if (dias[diaNumero]) {
                dias[diaNumero].aulas.push(aula);
                console.log(`✅ Aula ${aula.id} (${aula.data_aula}) adicionada à ${dias[diaNumero].nome}`);
            } else {
                console.log(`❌ Dia número ${diaNumero} não encontrado para aula ${aula.id}`);
            }
        });

        // Ordenar aulas por horário em cada dia
        Object.values(dias).forEach(dia => {
            dia.aulas.sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));
        });

        // Debug: mostrar quantas aulas em cada dia
        Object.entries(dias).forEach(([diaNum, diaInfo]) => {
            console.log(`📊 ${diaInfo.nome}: ${diaInfo.aulas.length} aulas`);
        });

        return dias;
    }

    verDetalhesAula(aulaId) {
        const aula = this.aulas.find(a => a.id === aulaId);
        if (aula) {
            this.mostrarModalDetalhesAulaAluno(aula);
        } else {
            this.mostrarErro('Aula não encontrada');
        }
    }

    mostrarModalDetalhesAulaAluno(aula) {
        const dataFormatada = this.formatarDataDisplay(aula.data_aula);

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
                    <label><i class="fas fa-calendar-day"></i> Data:</label>
                    <span>${dataFormatada}</span>
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

    formatarDataDisplay(dataString) {
        if (!dataString) return 'Data não definida';

        try {
            const [ano, mes, dia] = dataString.split('-').map(Number);
            const data = new Date(ano, mes - 1, dia);

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            const amanha = new Date(hoje);
            amanha.setDate(amanha.getDate() + 1);

            const semanaQueVem = new Date(hoje);
            semanaQueVem.setDate(semanaQueVem.getDate() + 7);

            // Verificar se é hoje, amanhã ou outra data
            if (data.getTime() === hoje.getTime()) {
                return 'Hoje';
            } else if (data.getTime() === amanha.getTime()) {
                return 'Amanhã';
            } else if (data > hoje && data <= semanaQueVem) {
                // Próximos 7 dias - mostrar dia da semana
                return data.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                });
            } else {
                // Datas futuras - mostrar data completa
                return data.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        } catch (error) {
            console.error('❌ Erro ao formatar data:', error);
            return dataString;
        }
    }

    gerarHTMLAulasAluno() {
        if (!this.aulas || this.aulas.length === 0) {
            return this.getHTMLNenhumaAula();
        }

        // 🔥 CORREÇÃO: Usar agrupamento por data em vez de por dia da semana
        const gruposData = this.agruparAulasPorData(this.aulas);
        return this.gerarHTMLAulasPorData(gruposData);
    }

    gerarHTMLAulasPorData(gruposData) {
        let html = '';

        gruposData.forEach(grupo => {
            if (grupo.aulas.length > 0) {
                html += `
            <div class="dia-aulas">
                <h3 class="dia-titulo">
                    <i class="fas fa-calendar-day"></i> ${grupo.nome}
                </h3>
                <div class="aulas-dia-container">
                    ${grupo.aulas.map(aula => {
                    const statusClass = this.getAulaStatusClass(aula);
                    const statusBadge = this.getStatusBadge(aula);
                    return `
                            <div class="aula-card ${statusClass}" onclick="aulasManager.verDetalhesAula(${aula.id})">
                                <div class="aula-header">
                                    <div class="aula-header-top">
                                        <h4>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h4>
                                        ${statusBadge}
                                    </div>
                                    <div class="aula-header-bottom">
                                        <span class="aula-horario">
                                            <i class="fas fa-clock"></i>${aula.horario_inicio} - ${aula.horario_fim}
                                        </span>
                                    </div>
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
                            `;
                }).join('')}
                </div>
            </div>
            `;
            }
        });

        return html || this.getHTMLNenhumaAula();
    }

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
                    const statusBadge = this.getStatusBadge(aula);
                    return `
                        <div class="aula-card ${statusClass}" onclick="aulasManager.verDetalhesAula(${aula.id})">
                            ${statusBadge}
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

    getAulaStatusClass(aula) {
        // 🔥 CORREÇÃO: Verificar múltiplas formas de identificar aula cancelada
        const isCancelada = aula.ativa === 0 ||
            aula.ativa === false ||
            aula.status === 'cancelada' ||
            aula.status_aula === 'cancelada';

        if (isCancelada) {
            return 'aula-cancelada';
        }

        // 🔥 CORREÇÃO: Comparação de datas mais robusta
        const agora = new Date();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let dataAula;
        try {
            if (aula.data_aula) {
                const [ano, mes, dia] = aula.data_aula.split('-').map(Number);
                dataAula = new Date(ano, mes - 1, dia);
            } else {
                return '';
            }
        } catch (error) {
            console.error('❌ Erro ao processar data da aula:', aula.data_aula, error);
            return '';
        }

        const isHoje = dataAula.getDate() === hoje.getDate() &&
            dataAula.getMonth() === hoje.getMonth() &&
            dataAula.getFullYear() === hoje.getFullYear();

        if (isHoje) {
            const horaAtual = agora.getHours() + (agora.getMinutes() / 60);
            const [horaInicio, minutoInicio] = aula.horario_inicio.split(':').map(Number);
            const [horaFim, minutoFim] = aula.horario_fim.split(':').map(Number);
            const horaInicioDecimal = horaInicio + (minutoInicio / 60);
            const horaFimDecimal = horaFim + (minutoFim / 60);

            if (horaAtual >= horaInicioDecimal && horaAtual <= horaFimDecimal) {
                return 'aula-em-andamento';
            }
        }

        return '';
    }

    getStatusBadge(aula) {
        // 🔥 CORREÇÃO: Verificar múltiplas formas de identificar aula cancelada
        const isCancelada = aula.ativa === 0 ||
            aula.ativa === false ||
            aula.status === 'cancelada' ||
            aula.status_aula === 'cancelada';

        if (isCancelada) {
            return '<span class="aula-status-badge cancelada compact">Cancelada</span>';
        }

        // 🔥 CORREÇÃO: Comparação de datas mais robusta
        const agora = new Date();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas a data

        let dataAula;
        try {
            // Converter a data da aula para objeto Date
            if (aula.data_aula) {
                const [ano, mes, dia] = aula.data_aula.split('-').map(Number);
                dataAula = new Date(ano, mes - 1, dia);
            } else {
                // Se não tem data_aula, não podemos determinar se é hoje
                return '<span class="aula-status-badge ativa compact">Ativa</span>';
            }
        } catch (error) {
            console.error('❌ Erro ao processar data da aula:', aula.data_aula, error);
            return '<span class="aula-status-badge ativa compact">Ativa</span>';
        }

        // 🔥 CORREÇÃO: Comparar apenas ano, mês e dia
        const isHoje = dataAula.getDate() === hoje.getDate() &&
            dataAula.getMonth() === hoje.getMonth() &&
            dataAula.getFullYear() === hoje.getFullYear();

        console.log(`📅 Verificando status - Data aula: ${aula.data_aula}, Hoje: ${hoje.toISOString().split('T')[0]}, É hoje: ${isHoje}`);

        if (isHoje) {
            // Verificar se está em andamento
            const horaAtual = agora.getHours() + (agora.getMinutes() / 60);
            const [horaInicio, minutoInicio] = aula.horario_inicio.split(':').map(Number);
            const [horaFim, minutoFim] = aula.horario_fim.split(':').map(Number);
            const horaInicioDecimal = horaInicio + (minutoInicio / 60);
            const horaFimDecimal = horaFim + (minutoFim / 60);

            console.log(`⏰ Horário - Atual: ${horaAtual.toFixed(2)}, Aula: ${horaInicioDecimal}-${horaFimDecimal}`);

            if (horaAtual >= horaInicioDecimal && horaAtual <= horaFimDecimal) {
                return '<span class="aula-status-badge em-andamento pulse compact">Em Andamento</span>';
            } else {
                return '<span class="aula-status-badge hoje compact">Hoje</span>';
            }
        }

        // Se não é hoje e não está cancelada, é "Ativa"
        return '<span class="aula-status-badge ativa compact">Ativa</span>';
    }

    gerarHTMLAulasProfessor() {
        if (typeof professorManager !== 'undefined') {
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
                            <p><strong>Data:</strong> ${this.formatarDataDisplay(aula.data_aula)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    fecharTodosModaisAluno() {
        const modais = document.querySelectorAll('.modal-overlay');
        modais.forEach(modal => modal.remove());
    }

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

    getHTMLNenhumaAulaEstaSemana() {
        return `
    <div class="empty-state">
        <i class="fas fa-calendar-check fa-3x"></i>
        <h3>Nenhuma aula esta semana</h3>
        <p>Não há aulas agendadas para os dias atuais.</p>
        <div class="status-legend" style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <div class="legend-item" style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #27ae60;"></div>
                <span style="font-size: 0.9rem; color: #666;">Aulas Ativas</span>
            </div>
            <div class="legend-item" style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #e74c3c;"></div>
                <span style="font-size: 0.9rem; color: #666;">Aulas Canceladas</span>
            </div>
            <div class="legend-item" style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #f39c12;"></div>
                <span style="font-size: 0.9rem; color: #666;">Em Andamento</span>
            </div>
        </div>
    </div>
    `;
    }

    mostrarLoading() {
        console.log('⏳ Mostrando loading...');

        if (this.containerDesktop) {
            this.containerDesktop.innerHTML = `
                <div class="loading-aulas">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p>Carregando aulas...</p>
                </div>
            `;
        }

        if (this.containerMobile) {
            this.containerMobile.innerHTML = `
                <div class="loading-aulas">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p>Carregando aulas...</p>
                </div>
            `;
        }
    }

    esconderLoading() {
        console.log('✅ Escondendo loading...');
    }

    async carregarERenderizarAulas() {
        try {
            console.log('🔄 Carregando aulas...');
            this.mostrarLoading();

            const userData = localStorage.getItem('userData');
            if (!userData) {
                throw new Error('Usuário não logado');
            }

            const user = JSON.parse(userData);
            this.currentUser = user;
            this.tipoUsuario = user.tipo;

            console.log('👤 Tipo de usuário:', user.tipo);
            console.log('👤 ID do usuário:', user.id);

            let aulas = [];

            if (user.tipo === 'aluno') {
                aulas = await this.carregarAulasAluno(user.id);
            } else if (user.tipo === 'professor') {
                aulas = await this.carregarAulasProfessor();
            } else if (user.tipo === 'admin') {
                aulas = await this.carregarTodasAulas();
            } else {
                throw new Error('Tipo de usuário não suportado: ' + user.tipo);
            }

            console.log(`✅ ${aulas.length} aulas carregadas`);
            this.renderizarAulas(aulas);

        } catch (error) {
            console.error('❌ Erro ao carregar e renderizar aulas:', error);
            this.mostrarErro('Erro ao carregar aulas: ' + error.message);
        } finally {
            this.esconderLoading();
        }
    }

    mostrarErro(mensagem) {
        console.error('❌ Erro:', mensagem);

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

        if (this.containerDesktop) {
            this.containerDesktop.innerHTML = errorHTML;
        }
        if (this.containerMobile) {
            this.containerMobile.innerHTML = errorHTML;
        }
    }

    // Outros métodos mantidos para compatibilidade
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
        modal.remove();
    }
};

window.carregarAulas = function (containerId = null) {
    aulasManager.carregarERenderizarAulas();
};

// ✅ CORRIGIR A INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', function () {
    console.log('📚 AulasManager carregado e pronto');

    setTimeout(() => {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData && userData.tipo === 'aluno') {
            console.log('🎓 Inicializando carregamento automático de aulas para aluno...');
            aulasManager.carregarERenderizarAulas();
        }
    }, 1000);
});