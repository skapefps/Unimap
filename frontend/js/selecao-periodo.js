// selecao-periodo.js - VERSÃO DEBUG COMPLETA
class SelecaoPeriodoManager {
    constructor() {
        this.isInitialized = false;
        this.modalAberto = false;
        this.verificacaoEmAndamento = false;
        this.cursos = [];
        this.periodos = [];
        this.turmas = [];
    }

    init() {
        if (this.isInitialized) return;

        console.log('🎯 DEBUG: Inicializando SelecaoPeriodoManager...');
        this.setupEventListeners();

        setTimeout(() => {
            this.verificarSelecaoNecessaria();
        }, 1000);

        this.isInitialized = true;
    }

    setupEventListeners() {
        document.body.addEventListener('click', (e) => {
            if (e.target.id === 'modalSelecaoPeriodo') {
                this.ocultarModal();
            }

            if (e.target.id === 'salvarSelecaoPeriodo' || e.target.closest('#salvarSelecaoPeriodo')) {
                this.salvarSelecao();
            }
        });

        document.body.addEventListener('change', (e) => {
            if (e.target.id === 'cursoSelect') {
                this.handleCursoChange(e.target.value);
            }
            if (e.target.id === 'periodoSelect') {
                this.handlePeriodoChange(e.target.value);
            }
            if (e.target.id === 'turmaSelect') {
                this.validarFormulario();
            }
        });
    }

    async verificarSelecaoNecessaria() {
        if (this.verificacaoEmAndamento) {
            console.log('⚠️ DEBUG: Verificação já em andamento, ignorando...');
            return;
        }
        this.verificacaoEmAndamento = true;

        try {
            const userData = localStorage.getItem('userData');
            if (!userData) {
                console.log('❌ DEBUG: Nenhum usuário logado');
                return;
            }

            const user = JSON.parse(userData);
            console.log('👤 DEBUG: Usuário logado:', user.nome, '- Tipo:', user.tipo, '- ID:', user.id);

            if (user.tipo !== 'aluno') {
                console.log('✅ DEBUG: Não é aluno, não precisa de seleção');
                return;
            }

            console.log('🎯 DEBUG: É aluno, verificando dados no BANCO...');

            // VERIFICAÇÃO DIRETA NO BANCO
            const precisaSelecionar = await this.verificarDadosAlunoNoBanco(user.id);
            console.log('🎯 DEBUG: RESULTADO FINAL DA VERIFICAÇÃO - precisaSelecionar =', precisaSelecionar);

            if (precisaSelecionar && !this.modalAberto) {
                console.log('🚀 DEBUG: MOSTRANDO MODAL - Aluno precisa completar cadastro');
                this.mostrarModal();
            } else if (!precisaSelecionar) {
                console.log('✅ DEBUG: NÃO MOSTRAR MODAL - Aluno já tem cadastro completo');
            } else {
                console.log('⚠️ DEBUG: Modal já está aberto ou condição não atendida');
            }

        } catch (error) {
            console.error('❌ DEBUG: Erro na verificação:', error);
        } finally {
            this.verificacaoEmAndamento = false;
        }
    }

    async verificarDadosAlunoNoBanco(alunoId) {
        try {
            console.log('🔍 DEBUG: Chamando API /api/aluno/dados-completos/' + alunoId);

            const token = authManager ? authManager.getToken() : localStorage.getItem('authToken');
            const response = await fetch(`/api/aluno/dados-completos/${alunoId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const resultado = await response.json();

            console.log('📊 DEBUG: Resposta COMPLETA da API:', resultado);

            if (resultado.success && resultado.data) {
                const aluno = resultado.data;

                console.log('📊 DEBUG: Dados REAIS do aluno:', aluno);

                const temCurso = aluno.curso && aluno.curso.trim() !== '';
                const temPeriodo = aluno.periodo !== null && aluno.periodo !== undefined;
                const temTurma = aluno.turma_id !== null && aluno.turma_id !== undefined;

                const precisaSelecionar = !temCurso || !temPeriodo || !temTurma;

                console.log('🎯 DEBUG: Análise CORRIGIDA:', {
                    temCurso: temCurso,
                    temPeriodo: temPeriodo,
                    temTurma: temTurma,
                    precisaSelecionar: precisaSelecionar
                });

                return precisaSelecionar;
            } else {
                console.error('❌ DEBUG: API não retornou dados válidos');
                return true;
            }

        } catch (error) {
            console.error('❌ DEBUG: Erro na verificação do banco:', error);
            return true;
        }
    }

    async mostrarModal() {
        console.log('🔄 DEBUG: Tentando mostrar modal...');

        if (this.modalAberto) {
            console.log('⚠️ DEBUG: Modal já está aberto, ignorando...');
            return;
        }

        const modalExistente = document.getElementById('modalSelecaoPeriodo');
        if (modalExistente && modalExistente.style.display === 'flex') {
            console.log('⚠️ DEBUG: Modal já está visível no DOM');
            this.modalAberto = true;
            return;
        }

        console.log('🏗️ DEBUG: Criando modal HTML...');

        if (!modalExistente) {
            this.criarModalHTML();
        }

        const modal = document.getElementById('modalSelecaoPeriodo');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            this.modalAberto = true;
            console.log('✅ DEBUG: Modal aberto com sucesso!');

            await this.carregarDadosIniciais();
        } else {
            console.error('❌ DEBUG: Modal não foi criado corretamente');
        }
    }

    criarModalHTML() {
        const modalHTML = `
        <div id="modalSelecaoPeriodo" class="modal-overlay" style="display: none;">
            <div class="modal-container">
                <div class="modal-header">
                    <h2><i class="fas fa-graduation-cap"></i> Complete seu Cadastro</h2>
                    <p>Selecione seu curso, período e turma para começar a usar o UNIMAP</p>
                </div>
                
                <div class="modal-body">
                    <div class="progress-indicator">
                        <div class="progress-step active" data-step="1"></div>
                        <div class="progress-step" data-step="2"></div>
                        <div class="progress-step" data-step="3"></div>
                    </div>

                    <div id="statusMessage" class="status-message"></div>

                    <form id="formSelecaoPeriodo">
                        <div class="form-group">
                            <label for="cursoSelect">
                                <i class="fas fa-book"></i> Curso:
                            </label>
                            <select id="cursoSelect" class="select-shadow" required>
                                <option value="">Selecione seu curso</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="periodoSelect">
                                <i class="fas fa-calendar-alt"></i> Período:
                            </label>
                            <select id="periodoSelect" class="select-shadow" required disabled>
                                <option value="">Selecione o período</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="turmaSelect">
                                <i class="fas fa-users"></i> Turma:
                            </label>
                            <select id="turmaSelect" class="select-shadow" required disabled>
                                <option value="">Selecione a turma</option>
                            </select>
                        </div>
                    </form>
                </div>

                <div class="modal-footer">
                    <button type="button" id="salvarSelecaoPeriodo" class="btn-primary btn-full" disabled>
                        <i class="fas fa-check"></i> Confirmar Seleção
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    ocultarModal() {
        const modal = document.getElementById('modalSelecaoPeriodo');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.modalAberto = false;
            console.log('✅ DEBUG: Modal fechado');
        }
    }

    async carregarDadosIniciais() {
        try {
            console.log('📥 DEBUG: Carregando dados iniciais...');
            await this.carregarCursos();
        } catch (error) {
            console.error('❌ DEBUG: Erro ao carregar dados iniciais:', error);
            this.mostrarMensagemStatus('Erro ao carregar dados. Tente novamente.', 'error');
        }
    }

    async carregarCursos() {
        try {
            const cursoSelect = document.getElementById('cursoSelect');
            if (!cursoSelect) return;

            cursoSelect.innerHTML = '<option value="">Carregando cursos...</option>';
            cursoSelect.disabled = true;

            // 🔥 CORREÇÃO: Usar a rota que retorna cursos COM total_periodos
            const token = authManager ? authManager.getToken() : localStorage.getItem('authToken');
            const response = await fetch('/api/cursos/com-periodos', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const cursos = await response.json();

            this.cursos = cursos;
            cursoSelect.innerHTML = '<option value="">Selecione seu curso</option>';

            this.cursos.forEach(curso => {
                const option = document.createElement('option');
                option.value = curso.id;
                option.textContent = curso.nome;
                // 🔥 CORREÇÃO: Armazenar total_periodos para uso posterior
                option.dataset.totalPeriodos = curso.total_periodos;
                cursoSelect.appendChild(option);

                console.log('📚 Curso disponível:', {
                    id: curso.id,
                    nome: curso.nome,
                    total_periodos: curso.total_periodos
                });
            });

            cursoSelect.disabled = false;
            this.atualizarProgresso(1);
            console.log(`✅ DEBUG: ${this.cursos.length} cursos carregados COM períodos`);

        } catch (error) {
            console.error('❌ DEBUG: Erro ao carregar cursos:', error);
            this.mostrarMensagemStatus('Erro ao carregar cursos. Tente novamente.', 'error');
        }
    }

    async handleCursoChange(cursoId) {
        const periodoSelect = document.getElementById('periodoSelect');
        const turmaSelect = document.getElementById('turmaSelect');
        const salvarBtn = document.getElementById('salvarSelecaoPeriodo');

        if (!cursoId) {
            periodoSelect.disabled = true;
            periodoSelect.innerHTML = '<option value="">Selecione o período</option>';
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
            salvarBtn.disabled = true;
            this.atualizarProgresso(1);
            return;
        }

        // 🔥 CORREÇÃO: Buscar o curso selecionado para obter o total_periodos REAL
        const cursoSelecionado = this.cursos.find(curso => curso.id == cursoId);

        if (!cursoSelecionado) {
            console.error('❌ Curso selecionado não encontrado:', cursoId);
            return;
        }

        // 🔥 CORREÇÃO: Usar total_periodos REAL do curso (não valor padrão)
        const totalPeriodos = cursoSelecionado.total_periodos || 8;

        console.log('📊 DEBUG: Curso selecionado:', {
            nome: cursoSelecionado.nome,
            total_periodos: totalPeriodos,
            curso_id: cursoId
        });

        periodoSelect.disabled = true;
        periodoSelect.innerHTML = '<option value="">Carregando períodos...</option>';

        // 🔥 CORREÇÃO: Passar o totalPeriodos REAL
        await this.carregarPeriodos(totalPeriodos);

        periodoSelect.disabled = false;
        turmaSelect.disabled = true;
        turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';

        this.validarFormulario();
        this.atualizarProgresso(2);
    }

    async carregarPeriodos(totalPeriodos) {
        try {
            const periodoSelect = document.getElementById('periodoSelect');
            if (!periodoSelect) return;

            console.log('🔄 DEBUG: Carregando períodos. Total:', totalPeriodos);

            periodoSelect.innerHTML = '<option value="">Carregando períodos...</option>';
            periodoSelect.disabled = true;

            const periodos = [];
            for (let i = 1; i <= totalPeriodos; i++) {
                periodos.push({
                    id: i,
                    numero: i,
                    nome: `${i}° Período`
                });
            }

            this.periodos = periodos;

            periodoSelect.innerHTML = '<option value="">Selecione o período</option>';

            this.periodos.forEach(periodo => {
                const option = document.createElement('option');
                option.value = periodo.numero;
                option.textContent = periodo.nome;
                periodoSelect.appendChild(option);
            });

            periodoSelect.disabled = false;

            console.log(`✅ DEBUG: ${periodos.length} períodos carregados para o curso`);

        } catch (error) {
            console.error('❌ DEBUG: Erro ao carregar períodos:', error);

            const periodoSelect = document.getElementById('periodoSelect');
            if (periodoSelect) {
                periodoSelect.innerHTML = '<option value="">Erro ao carregar períodos</option>';
            }

            this.mostrarMensagemStatus('Erro ao carregar períodos.', 'error');
        }
    }

    async handlePeriodoChange(periodo) {
        const turmaSelect = document.getElementById('turmaSelect');
        const salvarBtn = document.getElementById('salvarSelecaoPeriodo');
        const cursoSelect = document.getElementById('cursoSelect');

        if (!periodo) {
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
            salvarBtn.disabled = true;
            this.atualizarProgresso(2);
            return;
        }

        const cursoId = cursoSelect ? cursoSelect.value : '';
        if (!cursoId) return;

        turmaSelect.disabled = false;
        await this.carregarTurmas(cursoId, periodo);
        this.validarFormulario();
        this.atualizarProgresso(3);
    }

    async carregarTurmas(cursoId, periodo) {
        try {
            const turmaSelect = document.getElementById('turmaSelect');
            if (!turmaSelect) return;

            turmaSelect.innerHTML = '<option value="">Carregando turmas...</option>';
            turmaSelect.disabled = true;

            const cursoNome = this.getCursoNome(cursoId);

            let turmasEncontradas = [];

            try {
                const response = await fetch('/api/turmas/public');

                if (response.ok) {
                    const todasTurmas = await response.json();

                    turmasEncontradas = todasTurmas.filter(turma => {
                        const cursoBate = turma.curso &&
                            (turma.curso === cursoNome ||
                                turma.curso.includes(cursoNome) ||
                                cursoNome.includes(turma.curso));

                        const periodoBate = turma.periodo &&
                            turma.periodo.toString() === periodo.toString();

                        return cursoBate && periodoBate;
                    });
                } else {
                    throw new Error('Erro ao carregar turmas públicas');
                }
            } catch (error) {
                console.error('❌ DEBUG: Erro ao carregar turmas:', error);
                turmasEncontradas = this.getTurmasFallback(cursoId, periodo);
            }

            this.turmas = turmasEncontradas;

            turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';

            if (this.turmas.length === 0) {
                turmaSelect.innerHTML = '<option value="">Nenhuma turma disponível</option>';
                this.mostrarMensagemStatus(`Nenhuma turma disponível para ${cursoNome}, período ${periodo}.`, 'warning');
            } else {
                this.turmas.forEach(turma => {
                    const option = document.createElement('option');
                    option.value = turma.id;
                    option.textContent = turma.nome;
                    turmaSelect.appendChild(option);
                });
            }

            turmaSelect.disabled = false;

        } catch (error) {
            console.error('❌ DEBUG: Erro ao carregar turmas:', error);

            const turmaSelect = document.getElementById('turmaSelect');
            if (turmaSelect) {
                turmaSelect.innerHTML = '<option value="">Erro ao carregar turmas</option>';
                turmaSelect.disabled = false;
            }

            this.mostrarMensagemStatus('Erro ao carregar turmas. Tente novamente.', 'error');
            this.turmas = [];
        }
    }

    getTurmasFallback(cursoId, periodo) {
        const cursoNome = this.getCursoNome(cursoId);

        const turmasFallback = [
            { id: 1, nome: `Turma ${periodo}A`, curso: cursoNome, periodo: periodo },
            { id: 2, nome: `Turma ${periodo}B`, curso: cursoNome, periodo: periodo },
            { id: 3, nome: `Turma ${periodo}C`, curso: cursoNome, periodo: periodo }
        ];

        return turmasFallback;
    }

    getCursoNome(cursoId) {
        const curso = this.cursos.find(c => c.id == cursoId);
        return curso ? curso.nome : '';
    }

    validarFormulario() {
        const cursoSelect = document.getElementById('cursoSelect');
        const periodoSelect = document.getElementById('periodoSelect');
        const turmaSelect = document.getElementById('turmaSelect');
        const salvarBtn = document.getElementById('salvarSelecaoPeriodo');

        if (!cursoSelect || !periodoSelect || !turmaSelect || !salvarBtn) return;

        const isValid = cursoSelect.value && periodoSelect.value && turmaSelect.value && turmaSelect.value !== '';
        salvarBtn.disabled = !isValid;
    }

    atualizarProgresso(passoAtivo) {
        const steps = document.querySelectorAll('.progress-step');
        steps.forEach((step, index) => {
            if (index + 1 <= passoAtivo) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
    }

    async salvarSelecao() {
        try {
            const userData = localStorage.getItem('userData');
            const authToken = localStorage.getItem('authToken');

            if (!userData || !authToken) {
                console.error('❌ DEBUG: Usuário não autenticado');
                this.mostrarMensagemStatus('Erro de autenticação. Faça login novamente.', 'error');
                return;
            }

            const user = JSON.parse(userData);

            const cursoSelect = document.getElementById('cursoSelect');
            const periodoSelect = document.getElementById('periodoSelect');
            const turmaSelect = document.getElementById('turmaSelect');

            if (!cursoSelect.value || !periodoSelect.value || !turmaSelect.value) {
                this.mostrarMensagemStatus('Preencha todos os campos obrigatórios.', 'error');
                return;
            }

            const selecao = {
                curso_id: cursoSelect.value,
                periodo: periodoSelect.value,
                turma_id: turmaSelect.value
            };

            console.log('💾 DEBUG: Salvando seleção:', selecao);

            this.mostrarLoading(true);

            // 🔥 FALLBACK: Usar fetch direto
            const response = await fetch('/api/aluno/completar-cadastro', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(selecao)
            });

            const resultado = await response.json();

            if (resultado.success) {
                console.log('✅ DEBUG: Dados salvos no banco!');

                if (resultado.user) {
                    localStorage.setItem('userData', JSON.stringify(resultado.user));
                    console.log('✅ DEBUG: localStorage atualizado');
                }

                this.mostrarMensagemStatus('Cadastro completado com sucesso!', 'success');

                setTimeout(() => {
                    this.ocultarModal();
                    this.mostrarAlertaSucesso();

                    setTimeout(() => {
                        console.log('🔄 DEBUG: Recarregando página...');
                        window.location.reload();
                    }, 1500);
                }, 1000);
            } else {
                throw new Error(resultado.error || 'Erro ao salvar dados');
            }

        } catch (error) {
            console.error('❌ DEBUG: Erro ao salvar:', error);
            this.mostrarMensagemStatus('Erro ao salvar: ' + error.message, 'error');
        } finally {
            this.mostrarLoading(false);
        }
    }

    mostrarLoading(mostrar) {
        const salvarBtn = document.getElementById('salvarSelecaoPeriodo');
        if (!salvarBtn) return;

        if (mostrar) {
            salvarBtn.classList.add('btn-loading');
            salvarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            salvarBtn.disabled = true;
        } else {
            salvarBtn.classList.remove('btn-loading');
            salvarBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar Seleção';
            this.validarFormulario();
        }
    }

    mostrarMensagemStatus(mensagem, tipo = 'info') {
        const statusElement = document.getElementById('statusMessage');
        if (!statusElement) return;

        statusElement.textContent = mensagem;
        statusElement.className = 'status-message';

        if (tipo === 'success') {
            statusElement.classList.add('status-success');
        } else if (tipo === 'error') {
            statusElement.classList.add('status-error');
        } else if (tipo === 'warning') {
            statusElement.classList.add('status-warning');
        }

        statusElement.style.display = 'block';

        if (tipo === 'success') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }
    }

    mostrarAlertaSucesso() {
        if (!document.getElementById('alertaCadastroSucesso')) {
            const alertaHTML = `
                <div id="alertaCadastroSucesso" class="alerta-cadastro">
                    <div class="alerta-conteudo">
                        <div class="alerta-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="alerta-texto">
                            <h3>Cadastro Completo! 🎉</h3>
                            <p>Agora você tem acesso a todas as funcionalidades do UNIMAP</p>
                        </div>
                        <button class="alerta-fechar" onclick="this.parentElement.parentElement.remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', alertaHTML);
        }

        const alerta = document.getElementById('alertaCadastroSucesso');
        alerta.classList.add('show');

        setTimeout(() => {
            if (alerta.parentElement) {
                alerta.classList.remove('show');
                setTimeout(() => {
                    if (alerta.parentElement) {
                        alerta.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
}

// Instância global
const selecaoPeriodoManager = new SelecaoPeriodoManager();

// Inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DEBUG: DOM carregado, aguardando inicialização...');
        setTimeout(() => {
            selecaoPeriodoManager.init();
        }, 500);
    });
} else {
    console.log('📄 DEBUG: DOM já carregado, aguardando inicialização...');
    setTimeout(() => {
        selecaoPeriodoManager.init();
    }, 500);
}

window.selecaoPeriodoManager = selecaoPeriodoManager;