// js/admin-turmas.js - VERSÃO COMPLETA E ATUALIZADA
class AdminTurmas {
    constructor() {
        this.turmas = [];
        this.alunos = [];
        this.turmaEditando = null;
        this.carregando = false;
        this.inicializado = false;
    }

    // Inicializar
    async init() {
        if (this.inicializado) {
            console.log('✅ AdminTurmas já foi inicializado');
            return;
        }

        try {
            console.log('🚀 Inicializando AdminTurmas...');
            
            await this.carregarTurmas();
            await this.carregarAlunos();
            this.setupEventListeners();
            this.setupModalEventListeners();
            this.inicializado = true;
            console.log('✅ AdminTurmas inicializado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro na inicialização do AdminTurmas:', error);
            this.showNotification('Erro ao carregar dados do sistema', 'error');
        }
    }

    // Fazer requisições autenticadas
    async makeRequest(endpoint, options = {}) {
        const token = localStorage.getItem('authToken');
        
        if (!token) {
            this.showNotification('Usuário não autenticado', 'error');
            throw new Error('Usuário não autenticado');
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(`/api${endpoint}`, mergedOptions);
            
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
            console.log(`📡 API Response [${endpoint}]:`, data);

            if (!response.ok) {
                throw new Error(typeof data === 'object' ? (data.error || `Erro ${response.status}`) : `Erro ${response.status}`);
            }

            return {
                success: true,
                data: data,
                message: typeof data === 'object' ? data.message : 'Sucesso'
            };
        } catch (error) {
            console.error(`❌ Erro na requisição ${endpoint}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // CARREGAR TURMAS
    async carregarTurmas() {
        try {
            console.log('📚 Carregando turmas do banco...');
            
            const response = await this.makeRequest('/turmas');
            console.log('📡 Resposta bruta da API:', response);
            
            if (response && response.success) {
                this.turmas = this.processarTurmas(response.data || []);
                console.log('✅ Turmas processadas:', this.turmas);
                
                // Sincronizar quantidades
                console.log('🔄 Sincronizando quantidades...');
                for (const turma of this.turmas) {
                    await this.atualizarQuantidadeAlunosTurma(turma.id);
                }
                
                this.renderizarTurmas();
                this.atualizarEstatisticasTurmas();
            } else {
                throw new Error('Erro ao carregar turmas');
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar turmas:', error);
            this.showNotification('Erro ao carregar turmas do banco', 'error');
            this.turmas = [];
            this.renderizarTurmas();
        }
    }

    // Processar turmas para garantir estrutura correta
    processarTurmas(turmasData) {
        if (!Array.isArray(turmasData)) {
            console.warn('⚠️ Dados de turmas não são um array:', turmasData);
            return [];
        }

        return turmasData.map(turma => ({
            id: turma.id,
            nome: turma.nome || 'Turma sem nome',
            curso_id: turma.curso_id || null,
            curso: turma.curso || 'Curso não definido',
            periodo: turma.periodo || 1,
            ano: turma.ano || new Date().getFullYear(),
            quantidade_alunos: turma.quantidade_alunos || 0,
            ativa: turma.ativa !== undefined ? Boolean(turma.ativa) : true,
        }));
    }

    // CARREGAR ALUNOS
    async carregarAlunos() {
        try {
            console.log('👥 Carregando alunos do banco...');
            
            const response = await this.makeRequest('/usuarios?tipo=aluno');
            
            if (response && response.success) {
                let alunosArray = [];
                
                if (Array.isArray(response.data)) {
                    alunosArray = response.data;
                } else if (response.data && Array.isArray(response.data.data)) {
                    alunosArray = response.data.data;
                } else if (response.data && Array.isArray(response.data.usuarios)) {
                    alunosArray = response.data.usuarios;
                } else {
                    console.warn('⚠️ Estrutura inesperada, usando resposta direta');
                    alunosArray = response.data || [];
                }
                
                this.alunos = alunosArray;
                console.log('✅ Alunos carregados via API:', this.alunos.length);
            } else {
                throw new Error('Erro ao carregar alunos');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar alunos:', error);
            this.showNotification('Erro ao carregar alunos do banco', 'error');
            this.alunos = [];
        }
    }

    // RENDERIZAR TURMAS
    renderizarTurmas() {
        console.log('🎯 Renderizando turmas...');
        console.log('📊 Dados das turmas antes da renderização:', this.turmas.map(t => ({
            id: t.id,
            nome: t.nome,
            quantidade: t.quantidade_alunos
        })));
        
        const tbody = document.getElementById('turmas-body');
        if (!tbody) {
            console.log('ℹ️ Tabela de turmas não encontrada');
            return;
        }

        if (!Array.isArray(this.turmas) || this.turmas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhuma turma cadastrada</p>
                        <button onclick="adminTurmas.abrirModalCriarTurma()" class="btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Criar Primeira Turma
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.turmas.map(turma => `
            <tr>
                <td>
                    <strong>${this.escapeHtml(turma.nome)}</strong>
                    ${!turma.ativa ? '<br><small class="text-muted">(Inativa)</small>' : ''}
                </td>
                <td>${this.escapeHtml(turma.curso)}</td>
                <td>${turma.periodo}° Período</td>
                <td>
                    <span class="badge ${turma.quantidade_alunos > 0 ? 'active' : 'inactive'}">
                        ${turma.quantidade_alunos || 0} alunos
                    </span>
                </td>
                <td>${turma.ano}</td>
                <td>
                    <span class="badge ${turma.ativa ? 'active' : 'inactive'}">
                        ${turma.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                </td>
                <td>
                    <button class="btn-action small" onclick="adminTurmas.vincularAlunosTurma(${turma.id})" 
                            title="Vincular alunos" ${!turma.ativa ? 'disabled' : ''}>
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn-action small secundario" onclick="adminTurmas.abrirModalGerenciarVinculos(${turma.id})"
                            title="Gerenciar alunos vinculados" ${turma.quantidade_alunos === 0 ? 'disabled' : ''}>
                        <i class="fas fa-users-cog"></i>
                    </button>
                    <button class="btn-action small" onclick="adminTurmas.editarTurma(${turma.id})" 
                            title="Editar turma">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action small secundario" onclick="adminTurmas.verAlunosTurma(${turma.id})"
                            title="Ver alunos da turma">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="btn-action small perigo" onclick="adminTurmas.desvincularTodosAlunos(${turma.id})"
                            title="Desvincular todos os alunos" ${turma.quantidade_alunos === 0 ? 'disabled' : ''}>
                        <i class="fas fa-users-slash"></i>
                    </button>
                    <button class="btn-action small perigo" onclick="adminTurmas.excluirTurma(${turma.id})"
                            title="${turma.quantidade_alunos > 0 ? 'Não é possível excluir turma com alunos' : 'Excluir turma'}"
                            ${turma.quantidade_alunos > 0 ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Atualizar estatísticas após renderizar
        this.atualizarEstatisticasTurmas();
        
        console.log('✅ Turmas renderizadas:', this.turmas.length);
    }

    // ATUALIZAR ESTATÍSTICAS DE TURMAS
    atualizarEstatisticasTurmas() {
        try {
            if (!Array.isArray(this.turmas)) {
                console.warn('⚠️ Turmas não é um array:', this.turmas);
                return;
            }

            const totalTurmas = this.turmas.length;
            const totalAlunosVinculados = this.turmas.reduce((total, turma) => total + (turma.quantidade_alunos || 0), 0);
            const turmasComAlunos = this.turmas.filter(turma => (turma.quantidade_alunos || 0) > 0).length;
            
            // Calcular inconsistências
            let inconsistencias = 0;
            this.turmas.forEach(turma => {
                const alunosNaTurma = this.alunos.filter(aluno => aluno.turma_id === turma.id);
                if (alunosNaTurma.length !== (turma.quantidade_alunos || 0)) {
                    inconsistencias++;
                }
            });

            // Atualizar elementos na página de turmas
            const totalTurmasEl = document.getElementById('total-turmas');
            const totalAlunosVinculadosEl = document.getElementById('total-alunos-vinculados');
            const turmasComAlunosEl = document.getElementById('turmas-com-alunos');
            const inconsistenciasEl = document.getElementById('inconsistencias');

            if (totalTurmasEl) totalTurmasEl.textContent = totalTurmas;
            if (totalAlunosVinculadosEl) totalAlunosVinculadosEl.textContent = totalAlunosVinculados;
            if (turmasComAlunosEl) turmasComAlunosEl.textContent = turmasComAlunos;
            if (inconsistenciasEl) inconsistenciasEl.textContent = inconsistencias;

            console.log('📊 Estatísticas de turmas atualizadas:', {
                totalTurmas,
                totalAlunosVinculados,
                turmasComAlunos,
                inconsistencias
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas de turmas:', error);
        }
    }

    // MODAL DE TURMAS
    abrirModalCriarTurma() {
        this.turmaEditando = null;
        document.getElementById('turmaModalTitle').textContent = 'Nova Turma';
        document.getElementById('turmaId').value = '';
        document.getElementById('turmaForm').reset();
        document.getElementById('turmaAtiva').value = 'true';
        
        const modal = document.getElementById('turmaModal');
        if (modal) {
            this.prepararModalMobile(modal);
            modal.style.display = 'flex';
        }
    }

   // admin-turmas.js - MÉTODO editarTurma CORRIGIDO E SIMPLIFICADO
async editarTurma(turmaId) {
    try {
        const turma = this.turmas.find(t => t.id === turmaId);
        if (!turma) {
            throw new Error('Turma não encontrada');
        }

        this.turmaEditando = turma;

        // VERIFICAÇÃO DIRETA DOS ELEMENTOS (SEM TIMEOUT COMPLEXO)
        const modal = document.getElementById('turmaModal');
        if (!modal) {
            console.log('ℹ️ Modal não encontrado, criando dinamicamente...');
            await this.criarModalEdicaoFallback(turma);
            return;
        }

        // Preencher os dados diretamente
        const modalTitle = document.getElementById('turmaModalTitle');
        const turmaIdInput = document.getElementById('turmaId');
        const turmaNomeInput = document.getElementById('turmaNome');
        const turmaCursoInput = document.getElementById('turmaCurso');
        const turmaPeriodoInput = document.getElementById('turmaPeriodo');
        const turmaAnoInput = document.getElementById('turmaAno');
        const turmaAtivaInput = document.getElementById('turmaAtiva');

        // Verificar elementos críticos
        if (!turmaNomeInput || !turmaCursoInput) {
            console.warn('⚠️ Campos do formulário não encontrados, criando modal fallback');
            await this.criarModalEdicaoFallback(turma);
            return;
        }

        // Preencher os dados
        if (modalTitle) modalTitle.textContent = 'Editar Turma';
        if (turmaIdInput) turmaIdInput.value = turma.id;
        if (turmaNomeInput) turmaNomeInput.value = turma.nome || '';
        if (turmaCursoInput) turmaCursoInput.value = turma.curso || '';
        if (turmaPeriodoInput) turmaPeriodoInput.value = turma.periodo || '';
        if (turmaAnoInput) turmaAnoInput.value = turma.ano || new Date().getFullYear();
        if (turmaAtivaInput) turmaAtivaInput.value = turma.ativa ? 'true' : 'false';

        // Abrir modal
        modal.style.display = 'flex';
        this.prepararModalMobile(modal);
        
    } catch (error) {
        console.error('❌ Erro ao abrir edição da turma:', error);
        this.showNotification('Erro ao carregar dados da turma: ' + error.message, 'error');
        
        // Tentar fallback
        if (this.turmaEditando) {
            await this.criarModalEdicaoFallback(this.turmaEditando);
        }
    }
}


    // MÉTODO FALLBACK - CRIAR MODAL DINAMICAMENTE
    // admin-turmas.js - MÉTODO FALLBACK ATUALIZADO
async criarModalEdicaoFallback(turma) {
    try {
        console.log('🔄 Criando modal de edição fallback...');
        
        // Remover modal existente se houver
        const modalExistente = document.getElementById('turmaModal');
        if (modalExistente) {
            modalExistente.remove();
        }
        
        const modalHTML = `
            <div class="modal-overlay" id="turmaModal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-users-class"></i> Editar Turma</h3>
                        <button class="modal-close" onclick="adminTurmas.fecharModalTurma()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="turmaForm">
                            <input type="hidden" id="turmaId" value="${turma.id}">
                            
                            <div class="form-group">
                                <label>Nome da Turma:</label>
                                <input type="text" id="turmaNome" required class="form-control" 
                                       value="${this.escapeHtml(turma.nome || '')}" placeholder="Ex: SI-2024-1A">
                            </div>
                            
                            <div class="form-group">
                                <label>Curso:</label>
                                <select id="turmaCurso" required class="form-control">
                                    <option value="">Selecione o curso</option>
                                    <option value="Sistemas de Informação" ${turma.curso === 'Sistemas de Informação' ? 'selected' : ''}>Sistemas de Informação</option>
                                    <option value="Administração" ${turma.curso === 'Administração' ? 'selected' : ''}>Administração</option>
                                    <option value="Direito" ${turma.curso === 'Direito' ? 'selected' : ''}>Direito</option>
                                    <option value="Engenharia Civil" ${turma.curso === 'Engenharia Civil' ? 'selected' : ''}>Engenharia Civil</option>
                                    <option value="Medicina" ${turma.curso === 'Medicina' ? 'selected' : ''}>Medicina</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Período:</label>
                                <select id="turmaPeriodo" required class="form-control">
                                    <option value="">Selecione o período</option>
                                    ${[1,2,3,4,5,6,7,8].map(p => 
                                        `<option value="${p}" ${turma.periodo == p ? 'selected' : ''}>${p}° Período</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Ano:</label>
                                <input type="number" id="turmaAno" required class="form-control" 
                                       min="2020" max="2030" value="${turma.ano || 2024}">
                            </div>
                            
                            <div class="form-group">
                                <label>Status:</label>
                                <select id="turmaAtiva" class="form-control">
                                    <option value="true" ${turma.ativa ? 'selected' : ''}>Ativa</option>
                                    <option value="false" ${!turma.ativa ? 'selected' : ''}>Inativa</option>
                                </select>
                            </div>
                            
                            <div class="btn-group">
                                <button type="submit" class="btn-primary">
                                    <i class="fas fa-save"></i> Salvar Turma
                                </button>
                                <button type="button" class="btn-secondary" onclick="adminTurmas.fecharModalTurma()">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar event listener para o formulário
        const turmaForm = document.getElementById('turmaForm');
        if (turmaForm) {
            turmaForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarTurma(e);
            });
        }
        
        this.prepararModalMobile(document.getElementById('turmaModal'));
        
    } catch (error) {
        console.error('❌ Erro ao criar modal fallback:', error);
        this.showNotification('Erro crítico: Não foi possível abrir a edição da turma', 'error');
    }
}

    // FECHAR MODAL TURMA
    fecharModalTurma() {
        const modal = document.getElementById('turmaModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
        this.turmaEditando = null;
        document.getElementById('turmaForm').reset();
    }

    // VALIDAÇÃO DE TURMAS DUPLICADAS
    validarTurmaDuplicada(dadosTurma, turmaId = null) {
        const { nome, curso, periodo, ano } = dadosTurma;
        
        const turmaDuplicada = this.turmas.find(turma => 
            turma.nome.toLowerCase() === nome.toLowerCase() &&
            turma.curso === curso &&
            turma.periodo === periodo &&
            turma.ano === ano &&
            turma.id !== turmaId // Ignora a própria turma durante edição
        );
        
        return turmaDuplicada;
    }

    // SALVAR TURMA
    async salvarTurma(event) {
        if (event) event.preventDefault();

        try {
            const turmaId = document.getElementById('turmaId').value;
            const dadosTurma = {
                nome: document.getElementById('turmaNome').value.trim(),
                curso: document.getElementById('turmaCurso').value,
                periodo: parseInt(document.getElementById('turmaPeriodo').value),
                ano: parseInt(document.getElementById('turmaAno').value),
                ativa: document.getElementById('turmaAtiva').value === 'true' ? 1 : 0,
                quantidade_alunos: 0
            };

            console.log('💾 Salvando turma:', { turmaId, dadosTurma });

            // VALIDAÇÃO BÁSICA
            if (!dadosTurma.nome) {
                this.showNotification('Nome da turma é obrigatório', 'error');
                return;
            }

            if (!dadosTurma.curso) {
                this.showNotification('Curso é obrigatório', 'error');
                return;
            }

            // VALIDAÇÃO DE TURMA DUPLICADA
            const turmaDuplicada = this.validarTurmaDuplicada(dadosTurma, turmaId ? parseInt(turmaId) : null);
            if (turmaDuplicada) {
                this.showNotification(
                    `Já existe uma turma com o nome "${turmaDuplicada.nome}" no mesmo curso, período e ano!`, 
                    'error'
                );
                return;
            }

            let response;
            if (turmaId) {
                // EDITAR turma existente
                console.log('✏️ Editando turma existente:', turmaId);
                response = await this.makeRequest(`/turmas/${turmaId}`, {
                    method: 'PUT',
                    body: JSON.stringify(dadosTurma)
                });
            } else {
                // CRIAR nova turma
                console.log('🆕 Criando nova turma');
                response = await this.makeRequest('/turmas', {
                    method: 'POST',
                    body: JSON.stringify(dadosTurma)
                });
            }

            console.log('📡 Resposta da API:', response);

            if (response && response.success) {
                this.showNotification(
                    turmaId ? 'Turma atualizada com sucesso!' : 'Turma criada com sucesso!', 
                    'success'
                );
                
                this.fecharModalTurma();    
                await this.carregarTurmas();
                this.sincronizarComDashboard();
                
            } else {
                throw new Error(response?.error || 'Erro ao salvar turma');
            }
            
        } catch (error) {
            console.error('❌ Erro ao salvar turma:', error);
            this.showNotification('Erro ao salvar turma: ' + error.message, 'error');
        }
    }

    // EXCLUIR TURMA
    async excluirTurma(turmaId) {
        const turma = this.turmas.find(t => t.id === turmaId);
        if (!turma) return;

        if (turma.quantidade_alunos > 0) {
            this.showNotification('Não é possível excluir uma turma que possui alunos vinculados!', 'error');
            return;
        }

        if (!confirm('Tem certeza que deseja excluir esta turma? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            const response = await this.makeRequest(`/turmas/${turmaId}`, {
                method: 'DELETE'
            });

            if (response && response.success) {
                this.showNotification('Turma excluída com sucesso!', 'success');
                await this.carregarTurmas();
            } else {
                throw new Error(response?.error || 'Erro ao excluir turma');
            }
        } catch (error) {
            console.error('❌ Erro ao excluir turma:', error);
            this.showNotification('Erro ao excluir turma do banco: ' + error.message, 'error');
        }
    }

    // VINCULAR ALUNOS - MODAIS
    async vincularAlunosTurma(turmaId) {
        try {
            console.log('🎯 Vincular alunos à turma:', turmaId);
            
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            if (!turma.ativa) {
                this.showNotification('Não é possível vincular alunos a uma turma inativa!', 'error');
                return;
            }

            this.turmaEditando = turma;
            await this.abrirModalVincularAlunos(turma);

        } catch (error) {
            console.error('❌ Erro ao abrir modal de vínculo:', error);
            this.showNotification('Erro ao abrir modal: ' + error.message, 'error');
        }
    }

    async abrirModalVincularAlunos(turma) {
        try {
            const turmaNomeElement = document.getElementById('turmaSelecionadaNome');
            const turmaCursoElement = document.getElementById('turmaSelecionadaCurso');
            
            if (!turmaNomeElement) {
                throw new Error('Elemento turmaSelecionadaNome não encontrado');
            }
            
            turmaNomeElement.textContent = turma.nome;
            if (turmaCursoElement) {
                turmaCursoElement.textContent = `Curso: ${turma.curso}`;
            }
            
            await this.carregarAlunos();
            this.renderizarListaAlunosParaTurma();
            
            const modal = document.getElementById('vincularAlunosModal');
            if (!modal) {
                throw new Error('Modal vincularAlunosModal não encontrado');
            }
            
            modal.style.display = 'flex';
            this.prepararModalMobile(modal);
            
        } catch (error) {
            console.error('❌ Erro no modal de vínculo:', error);
            throw error;
        }
    }

    // VALIDAÇÃO DE CURSO DO ALUNO
    validarCursoAluno(alunoId, turmaCurso) {
        const aluno = this.alunos.find(a => a.id === alunoId);
        if (!aluno) {
            return { valido: false, motivo: 'Aluno não encontrado' };
        }
        
        // Se o aluno não tem curso definido, permitir (pode ser um caso legado)
        if (!aluno.curso) {
            return { valido: true, motivo: 'Aluno sem curso definido' };
        }
        
        // Verificar se o curso do aluno corresponde ao curso da turma
        if (aluno.curso !== turmaCurso) {
            return { 
                valido: false, 
                motivo: `Aluno do curso ${aluno.curso} não pode ser adicionado à turma do curso ${turmaCurso}` 
            };
        }
        
        return { valido: true };
    }

    // VINCULAR ALUNOS SELECIONADOS
    async vincularAlunosSelecionados() {
        try {
            const checkboxes = document.querySelectorAll('.aluno-checkbox:checked:not(:disabled)');
            let alunosIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

            if (alunosIds.length === 0) {
                this.showNotification('Selecione pelo menos um aluno', 'warning');
                return;
            }

            const turmaId = this.turmaEditando?.id;
            if (!turmaId) {
                throw new Error('Turma não selecionada');
            }

            // VALIDAÇÃO DE CURSO DOS ALUNOS
            const alunosInvalidos = [];
            const alunosValidos = [];

            for (const alunoId of alunosIds) {
                const validacao = this.validarCursoAluno(alunoId, this.turmaEditando.curso);
                if (validacao.valido) {
                    alunosValidos.push(alunoId);
                } else {
                    alunosInvalidos.push({ id: alunoId, motivo: validacao.motivo });
                }
            }

            if (alunosInvalidos.length > 0) {
                const nomesInvalidos = alunosInvalidos.map(invalido => {
                    const aluno = this.alunos.find(a => a.id === invalido.id);
                    return `${aluno.nome} (${invalido.motivo})`;
                }).join(', ');
                
                this.showNotification(
                    `${alunosInvalidos.length} aluno(s) não podem ser vinculados: ${nomesInvalidos}`,
                    'error'
                );
                
                // Se nenhum aluno é válido, parar aqui
                if (alunosValidos.length === 0) {
                    return;
                }
                
                // Se alguns são válidos, perguntar se quer continuar apenas com os válidos
                if (!confirm(`Deseja vincular apenas os ${alunosValidos.length} aluno(s) válidos?`)) {
                    return;
                }
                
                // Usar apenas os alunos válidos
                alunosIds = alunosValidos;
            }

            console.log('🎯 Iniciando processo de matrícula...');

            const response = await this.makeRequest('/matricular-alunos', {
                method: 'POST',
                body: JSON.stringify({ 
                    turma_id: turmaId, 
                    alunos_ids: alunosIds
                })
            });

            console.log('📡 Resposta:', response);

            if (response && response.success) {
                this.showNotification(response.message, 'success');
                this.fecharModalVincularAlunos();
                
                // ATUALIZAÇÃO CRÍTICA: Forçar atualização da quantidade
                console.log('🔄 Atualizando quantidade após vinculação...');
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                
                // Recarregar dados
                await Promise.all([
                    this.carregarTurmas(),
                    this.carregarAlunos()
                ]);
                
                this.renderizarTurmas();
                this.sincronizarComDashboard();
                
            } else {
                throw new Error(response?.error || 'Erro ao vincular alunos');
            }
            
        } catch (error) {
            console.error('❌ Erro ao vincular alunos:', error);
            this.showNotification('Erro ao vincular alunos: ' + error.message, 'error');
        }
    }

    // FECHAR MODAL VINCULAR ALUNOS
    fecharModalVincularAlunos() {
        const modal = document.getElementById('vincularAlunosModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
        
        this.turmaEditando = null;
        
        const buscarInput = document.getElementById('buscarAlunosTurma');
        if (buscarInput) buscarInput.value = '';
    }

    // RENDERIZAR LISTA DE ALUNOS PARA VINCULAR
    renderizarListaAlunosParaTurma() {
        const tbody = document.getElementById('listaAlunosTurma');
        if (!tbody) {
            console.error('❌ Elemento listaAlunosTurma não encontrado');
            return;
        }

        if (!Array.isArray(this.alunos) || this.alunos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum aluno encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.alunos.map(aluno => {
            const turmaAluno = this.turmas.find(t => t.id === aluno.turma_id);
            const jaNaTurma = aluno.turma_id === this.turmaEditando?.id;
            const validacaoCurso = this.validarCursoAluno(aluno.id, this.turmaEditando?.curso);
            const podeVincular = !jaNaTurma && validacaoCurso.valido;
            
            return `
                <tr>
                    <td>
                        <input type="checkbox" class="aluno-checkbox" value="${aluno.id}" 
                               ${podeVincular ? '' : 'disabled'} 
                               ${jaNaTurma ? 'checked' : ''}>
                        ${jaNaTurma ? '<small>(já vinculado)</small>' : ''}
                        ${!validacaoCurso.valido ? '<small class="text-danger">(curso incompatível)</small>' : ''}
                    </td>
                    <td>${this.escapeHtml(aluno.nome)}</td>
                    <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                    <td>${this.escapeHtml(aluno.email)}</td>
                    <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
                    <td>
                        <span class="badge ${aluno.turma_id ? 'active' : 'inactive'}">
                            ${turmaAluno ? turmaAluno.nome : 'Sem turma'}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${podeVincular ? 'active' : 'inactive'}">
                            ${podeVincular ? 'Pode vincular' : 'Não pode vincular'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        this.configurarSelecaoAlunos();
    }

    configurarSelecaoAlunos() {
        const selecionarTodos = document.getElementById('selecionarTodosAlunos');
        const checkboxes = document.querySelectorAll('.aluno-checkbox:not(:disabled)');
        const buscarInput = document.getElementById('buscarAlunosTurma');

        if (selecionarTodos) {
            selecionarTodos.addEventListener('change', (e) => {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });
        }

        if (buscarInput) {
            buscarInput.addEventListener('input', (e) => {
                const termo = e.target.value.toLowerCase();
                const linhas = document.querySelectorAll('#listaAlunosTurma tr');
                
                linhas.forEach(linha => {
                    const texto = linha.textContent.toLowerCase();
                    linha.style.display = texto.includes(termo) ? '' : 'none';
                });
            });
        }
    }

    // VER ALUNOS DA TURMA
    async verAlunosTurma(turmaId) {
        try {
            console.log('👀 Ver alunos da turma:', turmaId);
            
            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);
            
            if (response && response.success) {
                const alunosDaTurma = response.data || [];
                console.log(`✅ ${alunosDaTurma.length} alunos carregados do banco`);
                this.mostrarModalAlunosTurma(alunosDaTurma, turmaId);
            } else {
                throw new Error(response?.error || 'Erro ao carregar alunos');
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar alunos da turma:', error);
            this.showNotification('Erro ao carregar alunos do banco', 'error');
        }
    }

    mostrarModalAlunosTurma(alunos, turmaId) {
        const turma = this.turmas.find(t => t.id === turmaId);
        const turmaNome = turma ? turma.nome : 'Turma';
        
        const modalHTML = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3><i class="fas fa-users"></i> Alunos da Turma - ${this.escapeHtml(turmaNome)}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Matrícula</th>
                                        <th>Email</th>
                                        <th>Curso</th>
                                        <th>Período</th>
                                        <th>Status</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${alunos.map(aluno => `
                                        <tr>
                                            <td>${this.escapeHtml(aluno.nome)}</td>
                                            <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                                            <td>${this.escapeHtml(aluno.email)}</td>
                                            <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
                                            <td>${aluno.periodo || 'N/A'}° Período</td>
                                            <td>
                                                <span class="badge ${aluno.ativo !== false ? 'active' : 'inactive'}">
                                                    ${aluno.ativo !== false ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td>
                                                <button class="btn-action small perigo" 
                                                        onclick="adminTurmas.desvincularAluno(${turmaId}, ${aluno.id}, '${this.escapeHtml(aluno.nome)}')"
                                                        title="Desvincular aluno">
                                                    <i class="fas fa-unlink"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                    ${alunos.length === 0 ? `
                                        <tr>
                                            <td colspan="7" class="empty-state">
                                                <i class="fas fa-users-slash"></i>
                                                <p>Nenhum aluno nesta turma</p>
                                            </td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // ATUALIZAR QUANTIDADE DE ALUNOS NA TURMA
    async atualizarQuantidadeAlunosTurma(turmaId) {
        try {
            console.log('🔢 Atualizando quantidade de alunos para turma:', turmaId);
            
            // Buscar alunos vinculados diretamente da API
            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);
            
            if (response && response.success) {
                const alunosVinculados = response.data || [];
                const novaQuantidade = alunosVinculados.length;
                
                console.log(`✅ Encontrados ${novaQuantidade} alunos na turma ${turmaId}`);
                
                // Atualizar na lista local
                const turmaIndex = this.turmas.findIndex(t => t.id === turmaId);
                if (turmaIndex !== -1) {
                    this.turmas[turmaIndex].quantidade_alunos = novaQuantidade;
                    
                    // Atualizar também via API se possível
                    try {
                        await this.makeRequest(`/turmas/${turmaId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                ...this.turmas[turmaIndex],
                                quantidade_alunos: novaQuantidade
                            })
                        });
                        console.log(`✅ Quantidade atualizada no banco: ${novaQuantidade}`);
                    } catch (updateError) {
                        console.warn('⚠️ Não foi possível atualizar no banco, mas a quantidade local foi ajustada');
                    }
                    
                    // Forçar renderização e sincronização
                    this.renderizarTurmas();
                    this.atualizarEstatisticasTurmas();
                    this.sincronizarComDashboard();
                    
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('❌ Erro ao atualizar quantidade:', error);
            return false;
        }
    }

    // MÉTODOS PARA DESVINCULAR ALUNOS

    // DESVINCULAR ALUNO INDIVIDUAL
   // admin-turmas.js - MÉTODOS DE DESVINCULAÇÃO CORRIGIDOS

// DESVINCULAR ALUNO INDIVIDUAL - VERSÃO CORRIGIDA
async desvincularAluno(turmaId, alunoId, alunoNome = '') {
    try {
        if (!alunoNome) {
            const aluno = this.alunos.find(a => a.id === alunoId);
            alunoNome = aluno ? aluno.nome : 'Aluno';
        }

        const confirmacao = confirm(`Tem certeza que deseja desvincular o aluno "${alunoNome}" da turma?`);
        if (!confirmacao) return;

        console.log('🗑️ Desvinculando aluno:', { turmaId, alunoId });

        const response = await this.makeRequest('/desmatricular-aluno', {
            method: 'POST',
            body: JSON.stringify({
                turma_id: turmaId,
                aluno_id: alunoId
            })
        });

        if (response && response.success) {
            this.showNotification(`Aluno "${alunoNome}" desvinculado com sucesso!`, 'success');
            await this.atualizarQuantidadeAlunosTurma(turmaId);
            await this.carregarAlunos();
            this.renderizarTurmas();
        } else {
            throw new Error(response?.error || 'Erro ao desvincular aluno');
        }

    } catch (error) {
        console.error('❌ Erro ao desvincular aluno:', error);
        this.showNotification('Erro ao desvincular aluno: ' + error.message, 'error');
    }
}

// DESVINCULAR MÚLTIPLOS ALUNOS - VERSÃO SQLITE
async desvincularAlunosEmLote(turmaId, alunosIds) {
    try {
        if (!alunosIds || alunosIds.length === 0) {
            this.showNotification('Nenhum aluno selecionado para desvincular', 'warning');
            return;
        }

        const confirmacao = confirm(`Desvincular ${alunosIds.length} aluno(s) da turma?`);
        if (!confirmacao) return;

        console.log('🗑️ Desvinculando alunos em lote:', { turmaId, alunosIds });

        const response = await this.makeRequest('/desmatricular-alunos', {
            method: 'POST',
            body: JSON.stringify({
                turma_id: turmaId,
                alunos_ids: alunosIds
            })
        });

        if (response && response.success) {
            this.showNotification(response.message, 'success');
            await this.atualizarQuantidadeAlunosTurma(turmaId);
            await this.carregarAlunos();
            this.renderizarTurmas();
        } else {
            throw new Error(response?.error || 'Erro ao desvincular alunos');
        }

    } catch (error) {
        console.error('❌ Erro ao desvincular alunos em lote:', error);
        this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
    }
}
async desvincularTodosAlunos(turmaId) {
    try {
        const turma = this.turmas.find(t => t.id === turmaId);
        if (!turma) throw new Error('Turma não encontrada');

        if (turma.quantidade_alunos === 0) {
            this.showNotification('Esta turma não possui alunos vinculados', 'info');
            return;
        }

        const confirmacao = confirm(`Desvincular TODOS os ${turma.quantidade_alunos} alunos da turma "${turma.nome}"?`);
        if (!confirmacao) return;

        console.log('🗑️ Desvinculando todos os alunos da turma:', turmaId);

        const response = await this.makeRequest(`/turmas/${turmaId}/desvincular-todos`, {
            method: 'POST'
        });

        if (response && response.success) {
            this.showNotification(response.message, 'success');
            await this.atualizarQuantidadeAlunosTurma(turmaId);
            await this.carregarAlunos();
            this.renderizarTurmas();
        } else {
            throw new Error(response?.error || 'Erro ao desvincular todos os alunos');
        }

    } catch (error) {
        console.error('❌ Erro ao desvincular todos os alunos:', error);
        this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
    }
}

async desvincularAlunosEmLote(turmaId, alunosIds) {
    try {
        if (!alunosIds || alunosIds.length === 0) {
            this.showNotification('Nenhum aluno selecionado para desvincular', 'warning');
            return;
        }

        const nomesAlunos = alunosIds.map(id => {
            const aluno = this.alunos.find(a => a.id === id);
            return aluno ? aluno.nome : 'Aluno desconhecido';
        }).join(', ');

        const confirmacao = confirm(
            `Tem certeza que deseja desvincular ${alunosIds.length} aluno(s) da turma?\n\n` +
            `Alunos: ${nomesAlunos}`
        );

        if (!confirmacao) {
            return;
        }

        console.log('🗑️ Desvinculando alunos em lote:', { turmaId, alunosIds });

        let desvinculadosComSucesso = 0;
        let erros = [];

        // Desvincular cada aluno individualmente (fallback para quando a rota em lote não existe)
        for (const alunoId of alunosIds) {
            try {
                // TENTAR ROTA INDIVIDUAL PRIMEIRO
                const response = await this.makeRequest('/desmatricular-aluno', {
                    method: 'POST',
                    body: JSON.stringify({
                        turma_id: turmaId,
                        aluno_id: alunoId
                    })
                });

                if (response && response.success) {
                    desvinculadosComSucesso++;
                } else {
                    // TENTAR ROTA ALTERNATIVA (PUT para atualizar aluno)
                    const aluno = this.alunos.find(a => a.id === alunoId);
                    if (aluno) {
                        const updateResponse = await this.makeRequest(`/usuarios/${alunoId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                ...aluno,
                                turma_id: null // Remove o vínculo
                            })
                        });

                        if (updateResponse && updateResponse.success) {
                            desvinculadosComSucesso++;
                        } else {
                            throw new Error(`Falha ao desvincular aluno ID ${alunoId}`);
                        }
                    } else {
                        throw new Error(`Aluno ID ${alunoId} não encontrado`);
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao desvincular aluno ${alunoId}:`, error);
                const alunoNome = this.alunos.find(a => a.id === alunoId)?.nome || 'Aluno desconhecido';
                erros.push(`${alunoNome}: ${error.message}`);
            }
        }

        // Mostrar resultado
        if (desvinculadosComSucesso > 0) {
            if (erros.length === 0) {
                this.showNotification(
                    `${desvinculadosComSucesso} aluno(s) desvinculado(s) com sucesso!`, 
                    'success'
                );
            } else {
                this.showNotification(
                    `${desvinculadosComSucesso} aluno(s) desvinculado(s), ${erros.length} com erro. Verifique o console.`, 
                    'warning'
                );
            }
            
            // Atualizar dados
            await this.atualizarQuantidadeAlunosTurma(turmaId);
            await this.carregarAlunos();
            this.renderizarTurmas();
            
        } else {
            throw new Error('Nenhum aluno foi desvinculado: ' + erros.join('; '));
        }

    } catch (error) {
        console.error('❌ Erro ao desvincular alunos em lote:', error);
        this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
    }
}
    // MODAL PARA GERENCIAR VÍNCULOS DE ALUNOS
    async abrirModalGerenciarVinculos(turmaId) {
        try {
            console.log('👥 Abrindo modal de gerenciar vínculos:', turmaId);
            
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            this.turmaEditando = turma;

            // Buscar alunos vinculados à turma
            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);
            if (response && response.success) {
                const alunosVinculados = response.data || [];
                this.mostrarModalGerenciarVinculos(turma, alunosVinculados);
            } else {
                throw new Error('Erro ao carregar alunos da turma');
            }

        } catch (error) {
            console.error('❌ Erro ao abrir modal de gerenciar vínculos:', error);
            this.showNotification('Erro ao carregar alunos da turma: ' + error.message, 'error');
        }
    }

    // MOSTRAR MODAL DE GERENCIAR VÍNCULOS
    mostrarModalGerenciarVinculos(turma, alunosVinculados) {
        const modalHTML = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-times"></i> Gerenciar Alunos - ${this.escapeHtml(turma.nome)}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Turma: <strong>${this.escapeHtml(turma.nome)}</strong></label>
                            <small class="form-text">Curso: ${this.escapeHtml(turma.curso)} | ${turma.quantidade_alunos || 0} aluno(s) vinculado(s)</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Buscar Alunos Vinculados:</label>
                            <input type="text" id="buscarAlunosVinculados" class="form-control" 
                                   placeholder="Digite o nome, matrícula ou email...">
                        </div>
                        
                        <div class="alunos-vinculados-container" style="max-height: 400px; overflow-y: auto;">
                            ${alunosVinculados.length === 0 ? `
                                <div class="empty-state">
                                    <i class="fas fa-users-slash"></i>
                                    <p>Nenhum aluno vinculado a esta turma</p>
                                </div>
                            ` : `
                                <table class="alunos-table">
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" id="selecionarTodosVinculados"></th>
                                            <th>Nome</th>
                                            <th>Matrícula</th>
                                            <th>Email</th>
                                            <th>Curso</th>
                                            <th>Data de Vínculo</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody id="listaAlunosVinculados">
                                        ${alunosVinculados.map(aluno => `
                                            <tr>
                                                <td>
                                                    <input type="checkbox" class="aluno-vinculado-checkbox" value="${aluno.id}">
                                                </td>
                                                <td>${this.escapeHtml(aluno.nome)}</td>
                                                <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                                                <td>${this.escapeHtml(aluno.email)}</td>
                                                <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
                                                <td>${this.formatarData(aluno.data_vinculo || aluno.created_at)}</td>
                                                <td>
                                                    <button class="btn-action small perigo" 
                                                            onclick="adminTurmas.desvincularAluno(${turma.id}, ${aluno.id}, '${this.escapeHtml(aluno.nome)}')"
                                                            title="Desvincular aluno">
                                                        <i class="fas fa-unlink"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            `}
                        </div>
                        
                        ${alunosVinculados.length > 0 ? `
                            <div class="btn-group">
                                <button type="button" class="btn-primary perigo" onclick="adminTurmas.desvincularAlunosSelecionados()">
                                    <i class="fas fa-unlink"></i> Desvincular Selecionados
                                </button>
                                <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                    <i class="fas fa-times"></i> Fechar
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar event listeners
        this.configurarModalGerenciarVinculos();
    }

    // CONFIGURAR MODAL DE GERENCIAR VÍNCULOS
    configurarModalGerenciarVinculos() {
        // Selecionar todos
        const selecionarTodos = document.getElementById('selecionarTodosVinculados');
        const checkboxes = document.querySelectorAll('.aluno-vinculado-checkbox');
        
        if (selecionarTodos && checkboxes.length > 0) {
            selecionarTodos.addEventListener('change', (e) => {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });
        }
        
        // Buscar alunos
        const buscarInput = document.getElementById('buscarAlunosVinculados');
        if (buscarInput) {
            buscarInput.addEventListener('input', (e) => {
                const termo = e.target.value.toLowerCase();
                const linhas = document.querySelectorAll('#listaAlunosVinculados tr');
                
                linhas.forEach(linha => {
                    const texto = linha.textContent.toLowerCase();
                    linha.style.display = texto.includes(termo) ? '' : 'none';
                });
            });
        }
    }

    // DESVINCULAR ALUNOS SELECIONADOS NO MODAL
    // DESVINCULAR ALUNOS SELECIONADOS NO MODAL - VERSÃO CORRIGIDA
// DESVINCULAR ALUNOS SELECIONADOS NO MODAL - VERSÃO CORRIGIDA
async desvincularAlunosSelecionados() {
    try {
        const checkboxes = document.querySelectorAll('.aluno-vinculado-checkbox:checked');
        const alunosIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (alunosIds.length === 0) {
            this.showNotification('Selecione pelo menos um aluno para desvincular', 'warning');
            return;
        }

        const turmaId = this.turmaEditando?.id;
        if (!turmaId) {
            throw new Error('Turma não selecionada');
        }

        await this.desvincularAlunosEmLote(turmaId, alunosIds);
        
        // Fechar modal após desvincular
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }

    } catch (error) {
        console.error('❌ Erro ao desvincular alunos selecionados:', error);
        this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
    }
}
    // DESVINCULAR TODOS OS ALUNOS DE UMA TURMA
    async desvincularTodosAlunos(turmaId) {
        try {
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            if (turma.quantidade_alunos === 0) {
                this.showNotification('Esta turma não possui alunos vinculados', 'info');
                return;
            }

            const confirmacao = confirm(
                `ATENÇÃO: Tem certeza que deseja desvincular TODOS os ${turma.quantidade_alunos} alunos da turma "${turma.nome}"?\n\n` +
                `Esta ação não pode ser desfeita!`
            );

            if (!confirmacao) {
                return;
            }

            console.log('🗑️ Desvinculando todos os alunos da turma:', turmaId);

            const response = await this.makeRequest(`/turmas/${turmaId}/desvincular-todos`, {
                method: 'POST'
            });

            console.log('📡 Resposta da desvinculação total:', response);

            if (response && response.success) {
                this.showNotification(
                    `Todos os ${turma.quantidade_alunos} alunos foram desvinculados da turma!`, 
                    'success'
                );
                
                // Atualizar dados
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();
                
            } else {
                throw new Error(response?.error || 'Erro ao desvincular todos os alunos');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular todos os alunos:', error);
            this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
        }
    }

    // SINCRONIZAÇÃO COMPLETA
    async sincronizacaoCompleta() {
        try {
            console.log('🔄 Iniciando sincronização completa...');
            
            // Recarregar todos os dados
            await Promise.all([
                this.carregarTurmas(),
                this.carregarAlunos()
            ]);
            
            // Para cada turma, atualizar a quantidade baseada nos alunos vinculados
            for (const turma of this.turmas) {
                await this.atualizarQuantidadeAlunosTurma(turma.id);
            }
            
            // Renderizar novamente
            this.renderizarTurmas();
            this.sincronizarComDashboard();
            
            console.log('✅ Sincronização completa concluída');
            this.showNotification('Sistema de turmas sincronizado com sucesso!', 'success');
            
        } catch (error) {
            console.error('❌ Erro na sincronização completa:', error);
            this.showNotification('Erro na sincronização: ' + error.message, 'error');
        }
    }

    // SINCRONIZAR QUANTIDADES
    async sincronizarQuantidades() {
        try {
            console.log('🔄 Sincronizando quantidades de todas as turmas...');
            
            if (!Array.isArray(this.turmas) || this.turmas.length === 0) {
                console.log('ℹ️ Nenhuma turma para sincronizar');
                return;
            }
            
            let turmasAtualizadas = 0;
            
            for (const turma of this.turmas) {
                const sucesso = await this.atualizarQuantidadeAlunosTurma(turma.id);
                if (sucesso) {
                    turmasAtualizadas++;
                }
            }
            
            console.log(`✅ ${turmasAtualizadas}/${this.turmas.length} turmas sincronizadas`);
            this.showNotification(`Quantidades de ${turmasAtualizadas} turmas atualizadas!`, 'success');
            
        } catch (error) {
            console.error('❌ Erro na sincronização de quantidades:', error);
            this.showNotification('Erro ao sincronizar quantidades: ' + error.message, 'error');
        }
    }

    // DEBUG E DIAGNÓSTICO
    async debugAlunoTurmas() {
        try {
            console.group('🐛 DEBUG ALUNO-TURMAS - DETALHADO');
            
            console.log('📊 Dados atuais:');
            console.log('- Turmas:', this.turmas.length);
            console.log('- Alunos:', this.alunos.length);
            
            // Verificar cada turma
            for (const turma of this.turmas) {
                console.log(`\n🔍 Analisando turma: ${turma.nome} (ID: ${turma.id})`);
                
                // Buscar alunos vinculados diretamente da API
                const alunosResponse = await this.makeRequest(`/turmas/${turma.id}/alunos`);
                const alunosNaTurma = alunosResponse.success ? alunosResponse.data : [];
                
                console.log(`   👥 Alunos na API: ${alunosNaTurma.length}`);
                console.log(`   📊 Quantidade registrada: ${turma.quantidade_alunos}`);
                
                // Verificar alunos localmente
                const alunosLocais = this.alunos.filter(a => a.turma_id === turma.id);
                console.log(`   🔍 Alunos locais com turma_id: ${alunosLocais.length}`);
                
                // Verificar discrepância
                if (alunosNaTurma.length !== turma.quantidade_alunos) {
                    console.warn(`   ⚠️ DISCREPÂNCIA: API tem ${alunosNaTurma.length}, turma mostra ${turma.quantidade_alunos}`);
                    
                    // Corrigir automaticamente
                    await this.atualizarQuantidadeAlunosTurma(turma.id);
                }
                
                // Verificar cursos dos alunos
                const alunosCursoIncorreto = alunosNaTurma.filter(aluno => 
                    aluno.curso && aluno.curso !== turma.curso
                );
                
                if (alunosCursoIncorreto.length > 0) {
                    console.warn(`   🚨 ${alunosCursoIncorreto.length} aluno(s) com curso incompatível:`);
                    alunosCursoIncorreto.forEach(aluno => {
                        console.log(`      - ${aluno.nome}: ${aluno.curso} ≠ ${turma.curso}`);
                    });
                }
            }
            
            console.groupEnd();
            this.showNotification('Debug detalhado concluído - Verifique o console', 'info');
            
        } catch (error) {
            console.error('❌ Erro no debug:', error);
            this.showNotification('Erro no debug: ' + error.message, 'error');
        }
    }

    async diagnosticoCompletoTurmas() {
        try {
            console.group('🔍 DIAGNÓSTICO COMPLETO DO SISTEMA DE TURMAS');
            
            // 1. Verificar turmas
            console.log('📚 Turmas no sistema:', this.turmas.length);
            this.turmas.forEach(turma => {
                console.log(`   🏫 ${turma.nome}: ${turma.quantidade_alunos} alunos, ${turma.ativa ? 'Ativa' : 'Inativa'}`);
            });
            
            // 2. Verificar alunos
            console.log('👥 Alunos no sistema:', this.alunos.length);
            const alunosComTurma = this.alunos.filter(a => a.turma_id);
            console.log(`   📊 Alunos com turma: ${alunosComTurma.length}`);
            
            // 3. Verificar consistência
            for (const turma of this.turmas) {
                const alunosNaTurma = this.alunos.filter(a => a.turma_id === turma.id);
                console.log(`   🔍 ${turma.nome}: ${alunosNaTurma.length} alunos vs ${turma.quantidade_alunos} registrado`);
                
                if (alunosNaTurma.length !== turma.quantidade_alunos) {
                    console.warn(`   ⚠️ INCONSISTÊNCIA: Diferença de ${Math.abs(alunosNaTurma.length - turma.quantidade_alunos)}`);
                }
            }
            
            console.groupEnd();
            this.showNotification('Diagnóstico completo concluído - Verifique o console', 'info');
            
        } catch (error) {
            console.error('❌ Erro no diagnóstico completo:', error);
        }
    }

    // VERIFICAÇÃO DE ELEMENTOS
    verificarElementosModal() {
        console.group('🔍 VERIFICANDO ELEMENTOS DO MODAL');
        
        const elementos = [
            'turmaModal', 'turmaForm', 'turmaModalTitle', 'turmaId', 
            'turmaNome', 'turmaCurso', 'turmaPeriodo', 'turmaAno', 'turmaAtiva'
        ];
        
        elementos.forEach(id => {
            const element = document.getElementById(id);
            console.log(`${id}:`, element ? '✅ Encontrado' : '❌ Não encontrado');
            
            if (element) {
                console.log(`   📝 Conteúdo:`, element.value || element.textContent || element.innerHTML.substring(0, 50));
            }
        });
        
        console.groupEnd();
        this.showNotification('Verificação de elementos concluída - Verifique o console', 'info');
    }

    // VERIFICAR ESTRUTURA DAS TURMAS
    verificarEstruturaTurmas() {
        console.group('🔍 VERIFICANDO ESTRUTURA DAS TURMAS');
        
        if (!Array.isArray(this.turmas) || this.turmas.length === 0) {
            console.log('❌ Nenhuma turma carregada');
            console.groupEnd();
            return;
        }
        
        // Verificar a primeira turma como exemplo
        const primeiraTurma = this.turmas[0];
        console.log('📋 Estrutura da primeira turma:', primeiraTurma);
        console.log('📊 Campos disponíveis:', Object.keys(primeiraTurma));
        
        // Verificar tipos de dados
        console.log('🎯 Tipos de dados:');
        Object.keys(primeiraTurma).forEach(key => {
            console.log(`   ${key}: ${typeof primeiraTurma[key]} = ${primeiraTurma[key]}`);
        });
        
        console.groupEnd();
    }

    // SINCRONIZAR COM DASHBOARD
    sincronizarComDashboard() {
        if (window.adminManager && typeof adminManager.atualizarTurmasDashboard === 'function') {
            console.log('🔄 Sincronizando turmas com dashboard...');
            adminManager.atualizarTurmasDashboard();
        }
    }

    // PREPARAR MODAL PARA MOBILE
    prepararModalMobile(modalElement) {
        // Adicionar classe para body
        document.body.classList.add('modal-open');
        
        // Focar no primeiro campo input
        setTimeout(() => {
            const firstInput = modalElement.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 300);
    }

    // CONFIGURAR EVENT LISTENERS PARA MODAIS
    setupModalEventListeners() {
        // Fechar modal ao clicar fora
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.style.display = 'none';
                document.body.classList.remove('modal-open');
            }
        });
        
        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal-overlay');
                modals.forEach(modal => {
                    modal.style.display = 'none';
                });
                document.body.classList.remove('modal-open');
            }
        });
        
        // Prevenir fechamento ao clicar dentro do modal
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-content')) {
                e.stopPropagation();
            }
        });
    }

    // SETUP EVENT LISTENERS
    setupEventListeners() {
        console.log('✅ Event listeners configurados para turmas');
        
        // Configurar formulário de turma (se existir)
        const turmaForm = document.getElementById('turmaForm');
        if (turmaForm) {
            turmaForm.addEventListener('submit', (e) => this.salvarTurma(e));
        } else {
            console.log('ℹ️ Formulário de turma não encontrado no carregamento inicial');
        }
        
        // Configurar event listeners para modais
        this.setupModalEventListeners();
    }

    // UTILITÁRIOS
    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return 'N/A';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatarData(dataString) {
        if (!dataString) return 'N/A';
        try {
            const data = new Date(dataString);
            if (isNaN(data.getTime())) {
                return 'Data inválida';
            }
            
            return data.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            console.warn('⚠️ Erro ao formatar data:', dataString, error);
            return 'N/A';
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 10000;
                background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, duration);
        }
    }
    async buscarAlunosDaTurma(turmaId) {
    try {
        // Buscar todos os alunos e filtrar localmente
        await this.carregarAlunos();
        return this.alunos.filter(aluno => aluno.turma_id === turmaId);
    } catch (error) {
        console.error('❌ Erro ao buscar alunos da turma:', error);
        return [];
    }
}
}

// Instância global
const adminTurmas = new AdminTurmas();

// INICIALIZAÇÃO AUTOMÁTICA quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Carregado - Inicializando AdminTurmas...');
    
    setTimeout(async () => {
        try {
            await adminTurmas.init();
            console.log('✅ AdminTurmas inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização do AdminTurmas:', error);
        }
    }, 100);
});

// EXPORTAÇÃO PARA USO GLOBAL
window.AdminTurmas = AdminTurmas;
window.adminTurmas = adminTurmas;