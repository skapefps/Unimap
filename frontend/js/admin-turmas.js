class AdminTurmas {
    constructor() {
        this.turmas = [];
        this.alunos = [];
        this.turmaEditando = null;
        this.carregando = false;
        this.inicializado = false;
        this.cursosComPeriodos = {};
        this.cursosDisponiveis = [];
        this.alunosVinculadosInicialmente = new Set();
    }

    async init() {
        if (this.inicializado) {
            console.log('✅ AdminTurmas já foi inicializado');
            return;
        }

        try {
            console.group('🚀 INICIALIZAÇÃO DO ADMIN TURMAS');
            console.log('📚 Carregando dados iniciais...');

            // 🔥 CORREÇÃO: Carregar cursos PRIMEIRO e AGUARDAR conclusão
            await this.carregarCursosDoBanco();
            console.log('✅ Cursos carregados e selects configurados');

            // 🔥 CORREÇÃO: Configurar eventos APÓS carregar cursos
            this.configurarEventosCursoPeriodo();
            console.log('✅ Eventos configurados');

            // Carregar demais dados em paralelo
            await Promise.all([
                this.carregarTurmas(),
                this.carregarAlunos()
            ]);
            console.log('✅ Turmas e alunos carregados');

            // Configurar interface
            this.setupEventListeners();
            this.setupModalEventListeners();

            this.inicializado = true;
            console.log('🎉 AdminTurmas inicializado com sucesso');
            console.groupEnd();

            // Debug automático após 2 segundos
            setTimeout(() => {
                this.verificarEstadoInicial();
            }, 2000);

        } catch (error) {
            console.error('❌ Erro na inicialização do AdminTurmas:', error);
            console.groupEnd();
            this.showNotification('Erro ao carregar dados do sistema', 'error');

            // 🔥 CORREÇÃO: Tentar recarregar cursos mesmo com erro
            await this.carregarCursosDoBanco();
        }
    }

    // ========== GESTÃO DE CURSOS E PERÍODOS ==========

    async carregarCursosDoBanco() {
        try {
            console.log('📚 Carregando cursos para turmas...');

            // 🔥 CORREÇÃO: Usar a função makeRequest corretamente
            const response = await this.makeRequest('/cursos/com-periodos');
            console.log('📡 Resposta da API de cursos:', response);

            // 🔥 CORREÇÃO: A API retorna array diretamente, não objeto com {success, data}
            let cursosData = [];

            if (Array.isArray(response)) {
                // Resposta é um array direto (formato correto da API)
                cursosData = response;
                console.log('✅ Cursos carregados (formato array direto)');
            } else if (response && response.success && Array.isArray(response.data)) {
                // Resposta tem formato {success: true, data: [...]}
                cursosData = response.data;
                console.log('✅ Cursos carregados (formato objeto com data)');
            } else if (response && Array.isArray(response.cursos)) {
                // Resposta tem formato {cursos: [...]}
                cursosData = response.cursos;
                console.log('✅ Cursos carregados (formato objeto com cursos)');
            } else {
                console.warn('⚠️ Estrutura de resposta inesperada para cursos:', response);
                throw new Error('Estrutura de resposta inesperada para cursos');
            }

            this.cursosComPeriodos = {};
            this.cursosDisponiveis = [];

            console.log('📊 Cursos recebidos da API:', cursosData);

            // Processar cursos do banco
            cursosData.forEach(curso => {
                if (curso && curso.nome) {
                    this.cursosComPeriodos[curso.nome] = curso.total_periodos || 8;
                    this.cursosDisponiveis.push(curso.nome);
                }
            });

            console.log(`✅ ${this.cursosDisponiveis.length} cursos carregados do banco:`, this.cursosDisponiveis);

            // 🔥 CORREÇÃO: Popular os cursos imediatamente após carregar
            this.popularCursosNoModalTurma();

        } catch (error) {
            console.error('❌ Erro ao carregar cursos do banco:', error);

            // 🔥 CORREÇÃO: Tentar endpoint alternativo
            await this.tentarEndpointAlternativoCursos();
        }
    }

    // 🔥 NOVA FUNÇÃO: Tentar endpoint alternativo para cursos
    async tentarEndpointAlternativoCursos() {
        try {
            console.log('🔄 Tentando endpoint alternativo para cursos...');

            const response = await this.makeRequest('/cursos');
            console.log('📡 Resposta do endpoint alternativo:', response);

            let cursosData = [];

            if (Array.isArray(response)) {
                cursosData = response;
            } else if (response && response.success && Array.isArray(response.data)) {
                cursosData = response.data;
            } else {
                throw new Error('Endpoint alternativo também falhou');
            }

            this.cursosComPeriodos = {};
            this.cursosDisponiveis = [];

            cursosData.forEach(curso => {
                if (curso && curso.nome) {
                    // 🔥 CORREÇÃO: Se não tiver total_periodos, usar valor padrão 8
                    this.cursosComPeriodos[curso.nome] = curso.total_periodos || 8;
                    this.cursosDisponiveis.push(curso.nome);
                }
            });

            console.log(`✅ ${this.cursosDisponiveis.length} cursos carregados do endpoint alternativo`);
            this.popularCursosNoModalTurma();

        } catch (error) {
            console.error('❌ Endpoint alternativo também falhou:', error);
            this.usarCursosFallbackTurmas();
        }
    }


    usarCursosFallbackTurmas() {
        console.log('🔄 Usando cursos fallback para turmas...');

        // Buscar cursos do localStorage se existirem
        const cursosSalvos = localStorage.getItem('cursos_disponiveis');
        if (cursosSalvos) {
            try {
                const cursos = JSON.parse(cursosSalvos);
                this.cursosComPeriodos = {};
                this.cursosDisponiveis = [];

                cursos.forEach(curso => {
                    if (curso && curso.nome) {
                        this.cursosComPeriodos[curso.nome] = curso.total_periodos || 8;
                        this.cursosDisponiveis.push(curso.nome);
                    }
                });

                console.log('✅ Cursos recuperados do localStorage:', this.cursosDisponiveis);
                this.popularCursosNoModalTurma();
                return;
            } catch (e) {
                console.warn('⚠️ Erro ao ler cursos do localStorage:', e);
            }
        }

        // Fallback padrão
        const cursosFallback = {
            'Sistemas de Informação': 8,
            'Administração': 8,
            'Direito': 10,
            'Engenharia Civil': 10,
            'Medicina': 12,
            'Psicologia': 10,
            'Enfermagem': 8,
            'Educação Física': 8
        };

        this.cursosComPeriodos = cursosFallback;
        this.cursosDisponiveis = Object.keys(cursosFallback);
        this.popularCursosNoModalTurma();
    }

    // 🔥 CORREÇÃO: Função popularCursosNoModalTurma síncrona
    popularCursosNoModalTurma(callback = null) {
        try {
            const selectCurso = document.getElementById('turmaCurso');
            if (!selectCurso) {
                console.error('❌ Elemento turmaCurso não encontrado');
                if (callback) callback();
                return;
            }

            console.log('📝 Populando cursos no modal de turma...');

            // Limpar select
            selectCurso.innerHTML = '<option value="">Selecione o curso</option>';

            if (!this.cursosDisponiveis || this.cursosDisponiveis.length === 0) {
                console.warn('⚠️ Nenhum curso disponível para popular no modal');
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Nenhum curso disponível';
                option.disabled = true;
                selectCurso.appendChild(option);

                if (callback) callback();
                return;
            }

            // Ordenar cursos alfabeticamente
            const cursosOrdenados = [...this.cursosDisponiveis].sort();

            cursosOrdenados.forEach(curso => {
                const option = document.createElement('option');
                option.value = curso;
                option.textContent = curso;

                const totalPeriodos = this.cursosComPeriodos[curso] || 8;
                option.setAttribute('data-total-periodos', totalPeriodos);
                option.setAttribute('title', `${totalPeriodos} períodos`);

                selectCurso.appendChild(option);
            });

            console.log(`✅ ${cursosOrdenados.length} cursos adicionados ao modal de turma`);

            // Executar callback imediatamente
            if (callback) callback();

        } catch (error) {
            console.error('❌ Erro ao popular cursos no modal:', error);
            if (callback) callback();
        }
    }

    // 🔥 NOVA FUNÇÃO: Verificar estado do formulário de edição
    verificarEstadoFormularioEdicao() {
        try {
            console.group('🔍 VERIFICAÇÃO DO FORMULÁRIO DE EDIÇÃO');

            const elementos = {
                turmaCurso: document.getElementById('turmaCurso'),
                turmaPeriodo: document.getElementById('turmaPeriodo')
            };

            console.log('📋 Estado dos elementos:');
            console.log('- turmaCurso:', {
                existe: !!elementos.turmaCurso,
                valor: elementos.turmaCurso ? elementos.turmaCurso.value : 'N/A',
                options: elementos.turmaCurso ? elementos.turmaCurso.options.length : 0
            });

            console.log('- turmaPeriodo:', {
                existe: !!elementos.turmaPeriodo,
                valor: elementos.turmaPeriodo ? elementos.turmaPeriodo.value : 'N/A',
                options: elementos.turmaPeriodo ? elementos.turmaPeriodo.options.length : 0
            });

            if (this.turmaEditando) {
                console.log('📊 Dados da turma em edição:', {
                    curso: this.turmaEditando.curso,
                    periodo: this.turmaEditando.periodo
                });
            }

            console.groupEnd();

        } catch (error) {
            console.error('❌ Erro na verificação:', error);
        }
    }

    forcarPreenchimentoCurso(turma) {
        try {
            const turmaCursoInput = document.getElementById('turmaCurso');
            if (!turmaCursoInput || !turma.curso) return;

            console.log('💪 Forçando preenchimento do curso:', turma.curso);

            // Tentativa 1: Definir value diretamente
            turmaCursoInput.value = turma.curso;

            // Tentativa 2: Encontrar a option e marcar como selected
            const options = Array.from(turmaCursoInput.options);
            const cursoOption = options.find(opt => opt.value === turma.curso);
            if (cursoOption) {
                cursoOption.selected = true;
            }

            // Tentativa 3: Disparar eventos para notificar mudanças
            turmaCursoInput.dispatchEvent(new Event('change', { bubbles: true }));
            turmaCursoInput.dispatchEvent(new Event('input', { bubbles: true }));

            // Tentativa 4: Usar setAttribute (às vezes funciona melhor)
            turmaCursoInput.setAttribute('value', turma.curso);

            // Tentativa 5: Verificação visual
            setTimeout(() => {
                console.log('👀 Valor atual do select:', turmaCursoInput.value);
                console.log('👀 Option selecionada:', turmaCursoInput.options[turmaCursoInput.selectedIndex]?.text);

                if (turmaCursoInput.value !== turma.curso) {
                    console.warn('⚠️ Valor não foi mantido, tentando novamente...');
                    this.forcarPreenchimentoCurso(turma);
                }
            }, 200);

        } catch (error) {
            console.error('❌ Erro ao forçar preenchimento:', error);
        }
    }

    configurarEventosCursoPeriodo() {
        try {
            console.log('⚙️ Configurando eventos de curso e período...');

            const selectCurso = document.getElementById('turmaCurso');
            const selectPeriodo = document.getElementById('turmaPeriodo');

            if (selectCurso) {
                // Remover event listeners antigos
                const novoSelectCurso = selectCurso.cloneNode(true);
                selectCurso.parentNode.replaceChild(novoSelectCurso, selectCurso);

                // 🔥 CORREÇÃO: Configurar evento com debounce
                let timeoutId;
                novoSelectCurso.addEventListener('change', (e) => {
                    console.log('🎯 Evento change do curso disparado:', e.target.value);

                    // Debounce para evitar múltiplas chamadas
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        this.atualizarPeriodosTurma(e.target.value);
                    }, 100);
                });

                // Configurar estado inicial
                novoSelectCurso.disabled = false;
                novoSelectCurso.classList.remove('select-desabilitado');
                novoSelectCurso.classList.add('select-habilitado');

                console.log('✅ Evento do curso configurado');
            } else {
                console.error('❌ Select de curso não encontrado');
            }

            if (selectPeriodo) {
                // Configurar estado inicial do período
                selectPeriodo.disabled = true;
                selectPeriodo.classList.add('select-desabilitado');
                selectPeriodo.classList.remove('select-habilitado');
                selectPeriodo.innerHTML = '<option value="">Selecione o período</option>';

                console.log('✅ Estado inicial do período configurado');
            }
        } catch (error) {
            console.error('❌ Erro ao configurar eventos curso/período:', error);
        }
    }

    debugEdicaoTurma(turmaId) {
        try {
            console.group('🐛 DEBUG EDIÇÃO DE TURMA');

            const turma = this.turmas.find(t => t.id === turmaId);
            console.log('📋 Dados da turma:', turma);

            const selectCurso = document.getElementById('turmaCurso');
            console.log('🎯 Select de curso:', {
                existe: !!selectCurso,
                options: selectCurso ? selectCurso.options.length : 0,
                valores: selectCurso ? Array.from(selectCurso.options).map(o => o.value) : []
            });

            console.log('📊 Cursos disponíveis:', this.cursosDisponiveis);
            console.log('📚 Mapeamento de períodos:', this.cursosComPeriodos);

            // Verificar se o curso da turma está na lista
            if (turma && turma.curso) {
                const cursoEncontrado = this.cursosDisponiveis.includes(turma.curso);
                console.log('🔍 Curso da turma encontrado na lista?', cursoEncontrado);

                if (!cursoEncontrado) {
                    console.warn('⚠️ Curso da turma não encontrado na lista:', turma.curso);
                }
            }

            console.groupEnd();

        } catch (error) {
            console.error('❌ Erro no debug de edição:', error);
        }
    }

    // 🔥 CORREÇÃO: Função atualizarPeriodosTurma com callback de conclusão
    atualizarPeriodosTurma(cursoSelecionado, callback = null) {
        try {
            console.group('🔄 ATUALIZANDO PERÍODOS DA TURMA');
            console.log('📋 Curso selecionado:', cursoSelecionado);

            const selectPeriodo = document.getElementById('turmaPeriodo');
            if (!selectPeriodo) {
                console.error('❌ Elemento turmaPeriodo não encontrado no DOM');
                console.groupEnd();
                if (callback) callback(false);
                return;
            }

            // Limpar períodos anteriores
            selectPeriodo.innerHTML = '<option value="">Selecione o período</option>';

            // Resetar estado do select
            selectPeriodo.disabled = true;
            selectPeriodo.classList.add('select-desabilitado');
            selectPeriodo.classList.remove('select-habilitado');

            if (!cursoSelecionado) {
                console.log('ℹ️ Nenhum curso selecionado');
                console.groupEnd();
                if (callback) callback(false);
                return;
            }

            // Verificar se o curso existe no nosso mapeamento
            if (!this.cursosComPeriodos || !this.cursosComPeriodos[cursoSelecionado]) {
                console.warn('⚠️ Curso não encontrado no mapeamento:', cursoSelecionado);
                console.log('📊 Cursos disponíveis:', this.cursosComPeriodos);

                // Tentar buscar o curso nos dados disponíveis
                const cursoEncontrado = this.cursosDisponiveis.find(curso =>
                    curso.toLowerCase() === cursoSelecionado.toLowerCase()
                );

                if (cursoEncontrado && this.cursosComPeriodos[cursoEncontrado]) {
                    console.log('✅ Curso encontrado por busca case-insensitive:', cursoEncontrado);
                    cursoSelecionado = cursoEncontrado;
                } else {
                    console.error('❌ Curso não encontrado de forma alguma');
                    this.mostrarPeriodosGenericos(selectPeriodo);
                    console.groupEnd();
                    if (callback) callback(false);
                    return;
                }
            }

            const totalPeriodos = this.cursosComPeriodos[cursoSelecionado];
            console.log(`📚 Curso "${cursoSelecionado}" tem ${totalPeriodos} períodos`);

            if (!totalPeriodos || totalPeriodos < 1) {
                console.warn('⚠️ Número de períodos inválido, usando valor padrão (8)');
                this.mostrarPeriodosGenericos(selectPeriodo);
                console.groupEnd();
                if (callback) callback(false);
                return;
            }

            // Popular períodos baseado no total do curso
            for (let i = 1; i <= totalPeriodos; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${i}º Período`;
                selectPeriodo.appendChild(option);
            }

            // Habilitar o select de período
            selectPeriodo.disabled = false;
            selectPeriodo.classList.remove('select-desabilitado');
            selectPeriodo.classList.add('select-habilitado');

            // Adicionar estilo visual de sucesso
            selectPeriodo.style.borderColor = '#28a745';
            selectPeriodo.style.backgroundColor = '#f8fff9';

            console.log(`✅ Gerados ${totalPeriodos} períodos para "${cursoSelecionado}"`);
            console.groupEnd();

            // 🔥 CORREÇÃO: Executar callback se fornecido
            if (callback) {
                setTimeout(() => callback(true), 50);
            }

        } catch (error) {
            console.error('❌ Erro crítico ao atualizar períodos:', error);
            console.groupEnd();
            this.mostrarPeriodosGenericos(document.getElementById('turmaPeriodo'));
            if (callback) callback(false);
        }
    }

    mostrarPeriodosGenericos(selectPeriodo) {
        if (!selectPeriodo) return;

        console.log('🔄 Mostrando períodos genéricos como fallback');

        // Limpar e desabilitar
        selectPeriodo.innerHTML = '<option value="">Selecione o período</option>';
        selectPeriodo.disabled = false;
        selectPeriodo.classList.remove('select-desabilitado');
        selectPeriodo.classList.add('select-habilitado');

        // Mostrar períodos de 1 a 8 como fallback
        for (let i = 1; i <= 8; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}º Período`;
            selectPeriodo.appendChild(option);
        }

        // Estilo de aviso
        selectPeriodo.style.borderColor = '#ffc107';
        selectPeriodo.style.backgroundColor = '#fffbf0';

        console.log('✅ Períodos genéricos (1-8) carregados como fallback');
    }

    // ========== GESTÃO DE TURMAS ==========

    async carregarTurmas() {
        try {
            console.log('📚 Carregando turmas do banco (ativas e inativas)...');

            const response = await this.makeRequest('/turmas');
            console.log('📡 Resposta bruta da API de turmas:', response);

            // 🔥 CORREÇÃO: Processar turmas
            let turmasData = [];

            if (Array.isArray(response)) {
                turmasData = response;
            } else if (response && response.success && Array.isArray(response.data)) {
                turmasData = response.data;
            } else if (response && Array.isArray(response.turmas)) {
                turmasData = response.turmas;
            } else {
                console.warn('⚠️ Estrutura de resposta inesperada para turmas:', response);
                throw new Error('Estrutura de resposta inesperada para turmas');
            }

            this.turmas = this.processarTurmas(turmasData);
            console.log('✅ Turmas processadas (ativas e inativas):', this.turmas.length);

            // 🔥 CORREÇÃO: Atualizar quantidades de todas as turmas
            console.log('🔄 Atualizando quantidades de alunos...');
            for (const turma of this.turmas) {
                await this.atualizarQuantidadeAlunosTurma(turma.id);
            }

            this.renderizarTurmas();
            this.atualizarEstatisticasTurmas();

        } catch (error) {
            console.error('❌ Erro ao carregar turmas:', error);
            this.showNotification('Erro ao carregar turmas do banco: ' + error.message, 'error');
            this.turmas = [];
            this.renderizarTurmas();
        }
    }


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

    renderizarTurmas() {
        console.log('🎯 Renderizando turmas (ativas e inativas)...');

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

        const turmasAtivas = this.turmas.filter(t => t.ativa);
        const turmasInativas = this.turmas.filter(t => !t.ativa);

        let html = '';

        if (turmasAtivas.length > 0) {
            html += `
            <tr class="categoria-turma">
                <td colspan="7" class="categoria-header">
                    <i class="fas fa-check-circle text-success"></i>
                    <strong>Turmas Ativas</strong>
                    <span class="badge active">${turmasAtivas.length} turma(s)</span>
                </td>
            </tr>
        `;

            html += turmasAtivas.map(turma => this.criarLinhaTurma(turma)).join('');
        }

        if (turmasInativas.length > 0) {
            html += `
            <tr class="categoria-turma">
                <td colspan="7" class="categoria-header">
                    <i class="fas fa-pause-circle text-warning"></i>
                    <strong>Turmas Inativas</strong>
                    <span class="badge inactive">${turmasInativas.length} turma(s)</span>
                </td>
            </tr>
        `;

            html += turmasInativas.map(turma => this.criarLinhaTurma(turma)).join('');
        }

        tbody.innerHTML = html;
        this.atualizarEstatisticasTurmas();

        console.log('✅ Turmas renderizadas:', {
            ativas: turmasAtivas.length,
            inativas: turmasInativas.length,
            total: this.turmas.length
        });
    }

    criarLinhaTurma(turma) {
        const isInativa = !turma.ativa;
        const classeLinha = isInativa ? 'turma-inativa' : '';

        return `
        <tr class="${classeLinha}">
            <td>
                <div class="turma-info">
                    <strong class="${isInativa ? 'text-muted' : ''}">${this.escapeHtml(turma.nome)}</strong>
                    ${isInativa ? '<div class="status-inativo"><i class="fas fa-pause"></i> Inativa</div>' : ''}
                </div>
            </td>
            <td class="${isInativa ? 'text-muted' : ''}">${this.escapeHtml(turma.curso)}</td>
            <td class="${isInativa ? 'text-muted' : ''}">${turma.periodo}° Período</td>
            <td>
                <span class="badge ${turma.quantidade_alunos > 0 ? 'active' : 'inactive'} ${isInativa ? 'badge-inativo' : ''}">
                    ${turma.quantidade_alunos || 0} alunos
                </span>
            </td>
            <td class="${isInativa ? 'text-muted' : ''}">${turma.ano}</td>
            <td>
                <span class="badge ${turma.ativa ? 'active' : 'inactive'}">
                    ${turma.ativa ? 'Ativa' : 'Inativa'}
                </span>
            </td>
            <td>
                <div class="acoes-turma">
                    <button class="btn-action small ${isInativa ? 'disabled' : ''}" 
                            onclick="adminTurmas.vincularAlunosTurma(${turma.id})" 
                            title="${isInativa ? 'Turma inativa - não é possível vincular alunos' : 'Vincular alunos'}" 
                            ${isInativa ? 'disabled' : ''}>
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn-action small secundario ${isInativa ? 'disabled' : ''}" 
                            onclick="adminTurmas.abrirModalGerenciarVinculos(${turma.id})"
                            title="${isInativa ? 'Turma inativa' : 'Gerenciar alunos vinculados'}" 
                            ${isInativa || turma.quantidade_alunos === 0 ? 'disabled' : ''}>
                        <i class="fas fa-users-cog"></i>
                    </button>
                    <button class="btn-action small" 
                            onclick="adminTurmas.editarTurma(${turma.id})" 
                            title="Editar turma">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action small secundario" 
                            onclick="adminTurmas.verAlunosTurma(${turma.id})"
                            title="Ver alunos da turma">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="btn-action small perigo ${isInativa ? 'disabled' : ''}" 
                            onclick="adminTurmas.desvincularTodosAlunos(${turma.id})"
                            title="${isInativa ? 'Turma inativa' : 'Desvincular todos os alunos'}" 
                            ${isInativa || turma.quantidade_alunos === 0 ? 'disabled' : ''}>
                        <i class="fas fa-users-slash"></i>
                    </button>
                    <button class="btn-action small perigo" 
                            onclick="adminTurmas.excluirTurma(${turma.id})"
                            title="${turma.ativa && turma.quantidade_alunos > 0 ? 'Não é possível excluir turma ativa com alunos vinculados' : (turma.quantidade_alunos > 0 ? 'Excluir turma inativa (primeiro desvincule os alunos)' : 'Excluir turma')}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }

    // ========== GESTÃO DE ALUNOS ==========

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

    // ========== MODAIS E FORMULÁRIOS ==========

    abrirModalCriarTurma() {
        try {
            this.turmaEditando = null;

            const modalTitle = document.getElementById('turmaModalTitle');
            const turmaIdInput = document.getElementById('turmaId');
            const turmaForm = document.getElementById('turmaForm');
            const modal = document.getElementById('turmaModal');

            if (!modal) {
                console.error('❌ Modal não encontrado no DOM');
                this.criarModalTurmaFallback();
                return;
            }

            if (modalTitle) modalTitle.textContent = 'Nova Turma';
            if (turmaIdInput) turmaIdInput.value = '';
            if (turmaForm) turmaForm.reset();

            this.popularCursosNoModalTurma();

            modal.style.display = 'flex';
            this.prepararModalMobile(modal);

        } catch (error) {
            console.error('❌ Erro ao abrir modal de criação:', error);
            this.criarModalTurmaFallback();
        }
    }

    fecharModalTurma() {
        const modal = document.getElementById('turmaModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
        this.turmaEditando = null;
        const turmaForm = document.getElementById('turmaForm');
        if (turmaForm) turmaForm.reset();
    }

    // 🔥 CORREÇÃO: Função editarTurma com preenchimento correto do período
    async editarTurma(turmaId) {
        try {
            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            this.turmaEditando = turma;

            const modal = document.getElementById('turmaModal');
            if (!modal) {
                console.log('ℹ️ Modal não encontrado, criando dinamicamente...');
                await this.criarModalEdicaoFallback(turma);
                return;
            }

            // 🔥 CORREÇÃO: Capturar elementos DENTRO da função para evitar problemas de escopo
            const obterElementos = () => {
                return {
                    modalTitle: document.getElementById('turmaModalTitle'),
                    turmaIdInput: document.getElementById('turmaId'),
                    turmaNomeInput: document.getElementById('turmaNome'),
                    turmaCursoInput: document.getElementById('turmaCurso'),
                    turmaPeriodoInput: document.getElementById('turmaPeriodo'),
                    turmaAnoInput: document.getElementById('turmaAno'),
                    turmaAtivaInput: document.getElementById('turmaAtiva')
                };
            };

            let elementos = obterElementos();

            if (!elementos.turmaNomeInput || !elementos.turmaCursoInput) {
                console.warn('⚠️ Campos do formulário não encontrados, criando modal fallback');
                await this.criarModalEdicaoFallback(turma);
                return;
            }

            // 🔥 CORREÇÃO: Garantir que os cursos estão carregados antes de preencher
            if (this.cursosDisponiveis.length === 0) {
                console.log('🔄 Carregando cursos antes de editar turma...');
                await this.carregarCursosDoBanco();
            }

            // Preencher dados básicos primeiro
            if (elementos.modalTitle) elementos.modalTitle.textContent = 'Editar Turma';
            if (elementos.turmaIdInput) elementos.turmaIdInput.value = turma.id;
            if (elementos.turmaNomeInput) elementos.turmaNomeInput.value = turma.nome || '';
            if (elementos.turmaAnoInput) elementos.turmaAnoInput.value = turma.ano || new Date().getFullYear();
            if (elementos.turmaAtivaInput) elementos.turmaAtivaInput.value = turma.ativa ? 'true' : 'false';

            // Mostrar modal primeiro
            modal.style.display = 'flex';
            this.prepararModalMobile(modal);

            // 🔥 CORREÇÃO: Popular cursos e preencher APÓS mostrar o modal
            const preencherCursoEPeriodo = async () => {
                // Recapturar elementos para garantir que estão disponíveis
                elementos = obterElementos();

                if (!elementos.turmaCursoInput) {
                    console.error('❌ Elemento turmaCurso não encontrado após abrir modal');
                    return;
                }

                console.log('🎯 Iniciando preenchimento do curso e período...');

                // Popular cursos no modal
                this.popularCursosNoModalTurma(() => {
                    // 🔥 CORREÇÃO: Recapturar elementos após popular o select
                    elementos = obterElementos();

                    if (!elementos.turmaCursoInput || !elementos.turmaPeriodoInput) {
                        console.error('❌ Elementos não encontrados após popular cursos');
                        return;
                    }

                    console.log('🔄 Tentando preencher curso:', turma.curso);

                    // Verificar se o curso existe nas opções
                    const cursoExiste = Array.from(elementos.turmaCursoInput.options).some(
                        option => option.value === turma.curso
                    );

                    if (cursoExiste) {
                        // 🔥 CORREÇÃO: Preencher curso
                        elementos.turmaCursoInput.value = turma.curso;
                        console.log('✅ Curso preenchido:', elementos.turmaCursoInput.value);

                        // 🔥 CORREÇÃO: Disparar evento change para atualizar períodos
                        const changeEvent = new Event('change', { bubbles: true });
                        elementos.turmaCursoInput.dispatchEvent(changeEvent);

                        // 🔥 CORREÇÃO: Aguardar ATIVAMENTE a atualização dos períodos
                        this.aguardarPeriodosAtualizados(turma.curso, turma.periodo, elementos);
                    } else {
                        console.error('❌ Curso não encontrado:', turma.curso);
                        console.log('📋 Cursos disponíveis:',
                            Array.from(elementos.turmaCursoInput.options).map(o => o.value));
                    }
                });
            };

            // Iniciar o processo de preenchimento
            preencherCursoEPeriodo();

        } catch (error) {
            console.error('❌ Erro ao abrir edição da turma:', error);
            this.showNotification('Erro ao carregar dados da turma: ' + error.message, 'error');

            if (this.turmaEditando) {
                await this.criarModalEdicaoFallback(this.turmaEditando);
            }
        }
    }

    // 🔥 NOVA FUNÇÃO: Aguardar ativamente a atualização dos períodos
    aguardarPeriodosAtualizados(curso, periodo, elementos) {
        console.log('⏳ Aguardando atualização dos períodos para:', curso);

        let tentativas = 0;
        const maxTentativas = 10; // 5 segundos no total

        const verificarPeriodos = setInterval(() => {
            tentativas++;

            // Verificar se o select de período tem opções (mais que 1 = opção padrão + períodos)
            const temPeriodos = elementos.turmaPeriodoInput &&
                elementos.turmaPeriodoInput.options.length > 1;

            if (temPeriodos) {
                clearInterval(verificarPeriodos);
                console.log('✅ Períodos atualizados após', tentativas, 'tentativas');

                // 🔥 CORREÇÃO: Preencher período agora que os períodos estão disponíveis
                this.preencherPeriodoComSeguranca(periodo, elementos);
            } else if (tentativas >= maxTentativas) {
                clearInterval(verificarPeriodos);
                console.error('❌ Timeout: Períodos não foram atualizados após', maxTentativas, 'tentativas');

                // 🔥 CORREÇÃO: Tentar preencher mesmo sem períodos (fallback)
                this.preencherPeriodoComSeguranca(periodo, elementos);
            } else {
                console.log('🔄 Aguardando períodos... tentativa', tentativas);

                // 🔥 CORREÇÃO: Re-disparar evento a cada 2 tentativas para garantir
                if (tentativas % 2 === 0) {
                    elementos.turmaCursoInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }, 500); // Verificar a cada 500ms
    }

    // 🔥 NOVA FUNÇÃO: Preencher período com múltiplas estratégias
    preencherPeriodoComSeguranca(periodo, elementos) {
        try {
            if (!elementos.turmaPeriodoInput) {
                console.error('❌ Select de período não encontrado');
                return;
            }

            console.log('🎯 Tentando preencher período:', periodo);

            // Estratégia 1: Tentar definir value diretamente
            elementos.turmaPeriodoInput.value = periodo;

            // Estratégia 2: Verificar se o valor foi aceito
            setTimeout(() => {
                if (elementos.turmaPeriodoInput.value != periodo) {
                    console.warn('⚠️ Valor não aceito, tentando estratégia alternativa...');

                    // Estratégia 3: Encontrar a option e marcar como selected
                    const options = Array.from(elementos.turmaPeriodoInput.options);
                    const periodoOption = options.find(opt => parseInt(opt.value) === parseInt(periodo));

                    if (periodoOption) {
                        periodoOption.selected = true;
                        console.log('✅ Período preenchido via option selection');
                    } else {
                        console.error('❌ Período não encontrado nas opções:', periodo);
                        console.log('📋 Períodos disponíveis:', options.map(o => o.value));

                        // Estratégia 4: Tentar o primeiro período disponível como fallback
                        if (options.length > 1) {
                            elementos.turmaPeriodoInput.value = options[1].value; // Pula a opção padrão
                            console.log('⚠️ Período original não encontrado, usando:', elementos.turmaPeriodoInput.value);
                        }
                    }
                } else {
                    console.log('✅ Período preenchido com sucesso:', elementos.turmaPeriodoInput.value);
                }
            }, 100);

        } catch (error) {
            console.error('❌ Erro ao preencher período:', error);
        }
    }

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

            if (!dadosTurma.nome) {
                this.showNotification('Nome da turma é obrigatório', 'error');
                return;
            }

            if (!dadosTurma.curso) {
                this.showNotification('Curso é obrigatório', 'error');
                return;
            }

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
                console.log('✏️ Editando turma existente:', turmaId);
                response = await this.makeRequest(`/turmas/${turmaId}`, {
                    method: 'PUT',
                    body: JSON.stringify(dadosTurma)
                });
            } else {
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

    // ========== VINCULAÇÃO DE ALUNOS ==========

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
            console.log('🎯 Abrindo modal de vínculo para turma:', turma);

            let modal = document.getElementById('vincularAlunosModal');
            if (!modal) {
                console.log('🔄 Modal não encontrado, criando fallback...');
                await this.criarModalVincularAlunosFallback();
                modal = document.getElementById('vincularAlunosModal');
            }

            // Garantir que os elementos existem
            const turmaNomeElement = document.getElementById('turmaSelecionadaNome');
            const turmaCursoElement = document.getElementById('turmaSelecionadaCurso');

            if (turmaNomeElement) {
                turmaNomeElement.textContent = turma.nome || 'Turma sem nome';
            }

            if (turmaCursoElement) {
                turmaCursoElement.textContent = `Curso: ${turma.curso || 'Não definido'}`;
            }

            await this.carregarAlunos();

            // 🔥 CORREÇÃO: Aguardar a renderização completa
            await this.renderizarListaAlunosParaTurma();

            modal.style.display = 'flex';
            this.prepararModalMobile(modal);

            console.log('✅ Modal de vínculo aberto com sucesso');

        } catch (error) {
            console.error('❌ Erro crítico no modal de vínculo:', error);
            this.showNotification('Erro ao abrir modal de vínculo: ' + error.message, 'error');
        }
    }


    fecharModalVincularAlunos() {
        const modal = document.getElementById('vincularAlunosModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }

        this.turmaEditando = null;

        this.alunosVinculadosInicialmente.clear();

        const buscarInput = document.getElementById('buscarAlunosTurma');
        if (buscarInput) buscarInput.value = '';
    }

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

            console.log('🎯 Iniciando processo de matrícula para alunos...');

            const response = await this.makeRequest('/turmas/matricular-alunos', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: turmaId,
                    alunos_ids: alunosIds
                })
            });

            console.log('📡 Resposta da matrícula:', response);

            if (response && response.success) {
                this.showNotification(response.message, 'success');

                // 🔥 CORREÇÃO: Atualizar quantidade imediatamente após vincular
                console.log('🔄 Atualizando quantidade após vinculação...');
                await this.atualizarQuantidadeAlunosTurma(turmaId);

                // 🔥 CORREÇÃO: Recarregar dados completos
                await Promise.all([
                    this.carregarTurmas(),
                    this.carregarAlunos()
                ]);

                this.renderizarTurmas();
                this.sincronizarComDashboard();

                this.fecharModalVincularAlunos();

            } else {
                throw new Error(response?.error || 'Erro ao vincular alunos');
            }

        } catch (error) {
            console.error('❌ Erro ao vincular alunos:', error);
            this.showNotification('Erro ao vincular alunos: ' + error.message, 'error');
        }
    }

    // ========== FUNÇÕES AUXILIARES ==========

    async makeRequest(endpoint, options = {}) {
        const token = localStorage.getItem('authToken');

        if (!token) {
            console.error('❌ Token de autenticação não encontrado');
            throw new Error('Usuário não autenticado');
        }

        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            ...options
        };

        // 🔥 CORREÇÃO: Se body for objeto, converter para JSON
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            console.log(`📤 Fazendo requisição para: /api${endpoint}`, config.method || 'GET');

            const response = await fetch(`/api${endpoint}`, config);

            // 🔥 CORREÇÃO: Verificar se a resposta é JSON válido
            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.warn('⚠️ Resposta não é JSON:', text.substring(0, 100));
                throw new Error('Resposta do servidor não é JSON válido');
            }

            console.log(`📥 Resposta de /api${endpoint}:`, {
                status: response.status,
                ok: response.ok,
                data: data
            });

            if (!response.ok) {
                throw new Error(data.error || data.message || `Erro ${response.status}`);
            }

            return data;

        } catch (error) {
            console.error(`❌ Erro na requisição /api${endpoint}:`, error);
            throw error;
        }
    }

    setupEventListeners() {
        console.log('✅ Configurando event listeners para turmas');

        // Formulário principal
        const turmaForm = document.getElementById('turmaForm');
        if (turmaForm) {
            turmaForm.addEventListener('submit', (e) => this.salvarTurma(e));
        } else {
            console.log('ℹ️ Formulário de turma não encontrado no carregamento inicial');
        }

        // Configurar eventos específicos de curso/período
        this.configurarEventosCursoPeriodo();

        // Eventos de modal
        this.setupModalEventListeners();

        console.log('✅ Todos os event listeners configurados');
    }

    setupModalEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.style.display = 'none';
                document.body.classList.remove('modal-open');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal-overlay');
                modals.forEach(modal => {
                    modal.style.display = 'none';
                });
                document.body.classList.remove('modal-open');
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-content')) {
                e.stopPropagation();
            }
        });
    }

    prepararModalMobile(modalElement) {
        document.body.classList.add('modal-open');

        setTimeout(() => {
            const firstInput = modalElement.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 300);
    }

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

    // ========== FUNÇÕES DE DEBUG E DIAGNÓSTICO ==========

    verificarEstadoInicial() {
        console.group('🔍 VERIFICAÇÃO DO ESTADO INICIAL');

        const selectCurso = document.getElementById('turmaCurso');
        const selectPeriodo = document.getElementById('turmaPeriodo');

        console.log('📋 Select de curso:', {
            existe: !!selectCurso,
            habilitado: selectCurso ? !selectCurso.disabled : 'N/A',
            options: selectCurso ? selectCurso.options.length : 0,
            valor: selectCurso ? selectCurso.value : 'N/A'
        });

        console.log('📋 Select de período:', {
            existe: !!selectPeriodo,
            habilitado: selectPeriodo ? !selectPeriodo.disabled : 'N/A',
            options: selectPeriodo ? selectPeriodo.options.length : 0,
            valor: selectPeriodo ? selectPeriodo.value : 'N/A'
        });

        console.log('📊 Dados internos:', {
            cursosDisponiveis: this.cursosDisponiveis ? this.cursosDisponiveis.length : 0,
            cursosComPeriodos: this.cursosComPeriodos ? Object.keys(this.cursosComPeriodos).length : 0
        });

        console.groupEnd();

        // Se não há cursos, tentar recarregar
        if (!this.cursosDisponiveis || this.cursosDisponiveis.length === 0) {
            console.warn('⚠️ Nenhum curso disponível, tentando recarregar...');
            this.carregarCursosDoBanco();
        }
    }

    async debugCursos() {
        console.group('🐛 DEBUG CURSOS - DETALHADO');

        try {
            console.log('🔍 Verificando estado atual dos cursos:');
            console.log('📊 Cursos disponíveis:', this.cursosDisponiveis);
            console.log('📚 Mapeamento períodos:', this.cursosComPeriodos);

            // Testar a API diretamente
            const response = await fetch('/api/cursos/com-periodos', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            console.log('🎯 Status da API:', response.status);
            const rawData = await response.json();
            console.log('📡 Resposta bruta da API:', rawData);

            // Verificar estrutura do modal
            const selectCurso = document.getElementById('turmaCurso');
            console.log('📝 Select de curso no DOM:', {
                existe: !!selectCurso,
                options: selectCurso ? selectCurso.options.length : 0,
                valor: selectCurso ? selectCurso.value : 'N/A'
            });

        } catch (error) {
            console.error('❌ Erro no debug:', error);
        }

        console.groupEnd();
        this.showNotification('Debug de cursos concluído - Verifique o console', 'info');
    }

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

    // ========== FUNÇÕES FALLBACK (PARA COMPATIBILIDADE) ==========

    criarModalTurmaFallback() {
        console.log('🔄 Criando modal de turma fallback...');
        // Implementação do fallback...
    }

    criarModalVincularAlunosFallback() {
        console.log('🔄 Criando modal de vínculo fallback...');
        // Implementação do fallback...
    }

    async criarModalEdicaoFallback(turma) {
        console.log('🔄 Criando modal de edição fallback...');
        // Implementação do fallback...
    }

    // ========== OUTRAS FUNÇÕES (MANTIDAS PARA COMPATIBILIDADE) ==========

    validarTurmaDuplicada(dadosTurma, turmaId = null) {
        const { nome, curso, periodo, ano } = dadosTurma;
        const turmaDuplicada = this.turmas.find(turma =>
            turma.nome.toLowerCase() === nome.toLowerCase() &&
            turma.curso === curso &&
            turma.periodo === periodo &&
            turma.ano === ano &&
            turma.id !== turmaId
        );
        return turmaDuplicada;
    }

    validarCursoAluno(alunoId, turmaCurso) {
        const aluno = this.alunos.find(a => a.id === alunoId);
        if (!aluno) {
            return { valido: false, motivo: 'Aluno não encontrado' };
        }
        if (!aluno.curso) {
            return { valido: true, motivo: 'Aluno sem curso definido' };
        }
        if (aluno.curso !== turmaCurso) {
            return {
                valido: false,
                motivo: `Aluno do curso ${aluno.curso} não pode ser adicionado à turma do curso ${turmaCurso}`
            };
        }
        return { valido: true };
    }

    async atualizarQuantidadeAlunosTurma(turmaId) {
        try {
            console.log('🔢 Atualizando quantidade de alunos para turma:', turmaId);

            const alunosVinculados = await this.buscarAlunosVinculadosTurmaComId(turmaId);
            const novaQuantidade = alunosVinculados.length;

            console.log(`✅ Encontrados ${novaQuantidade} alunos na turma ${turmaId}`);

            const turmaIndex = this.turmas.findIndex(t => t.id === turmaId);
            if (turmaIndex !== -1) {
                this.turmas[turmaIndex].quantidade_alunos = novaQuantidade;
                console.log(`✅ Quantidade atualizada para turma local: ${novaQuantidade}`);

                this.renderizarTurmas();
                this.atualizarEstatisticasTurmas();
                return true;
            } else {
                console.warn(`⚠️ Turma com ID ${turmaId} não encontrada na lista local`);
                return false;
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar quantidade:', error);
            return false;
        }
    }

    async buscarAlunosVinculadosTurmaComId(turmaId) {
        try {
            console.log('🔍 Buscando alunos vinculados da turma:', turmaId);

            const response = await this.makeRequest(`/turmas/${turmaId}/alunos`);
            console.log('📡 Resposta da API alunos vinculados:', response);

            // 🔥 CORREÇÃO: Tratar diferentes formatos de resposta
            let alunosVinculados = [];

            if (Array.isArray(response)) {
                alunosVinculados = response;
            } else if (response && response.success && Array.isArray(response.data)) {
                alunosVinculados = response.data;
            } else if (response && Array.isArray(response.alunos)) {
                alunosVinculados = response.alunos;
            } else {
                console.warn('⚠️ Formato de resposta inesperado para alunos vinculados:', response);
                alunosVinculados = [];
            }

            console.log(`✅ ${alunosVinculados.length} alunos vinculados encontrados`);
            return alunosVinculados;

        } catch (error) {
            console.error('❌ Erro ao buscar alunos vinculados:', error);
            return [];
        }
    }

    atualizarEstatisticasTurmas() {
        try {
            if (!Array.isArray(this.turmas)) {
                console.warn('⚠️ Turmas não é um array:', this.turmas);
                return;
            }
            const totalTurmas = this.turmas.length;
            const totalAlunosVinculados = this.turmas.reduce((total, turma) => total + (turma.quantidade_alunos || 0), 0);
            const turmasComAlunos = this.turmas.filter(turma => (turma.quantidade_alunos || 0) > 0).length;
            const totalTurmasEl = document.getElementById('total-turmas');
            const totalAlunosVinculadosEl = document.getElementById('total-alunos-vinculados');
            const turmasComAlunosEl = document.getElementById('turmas-com-alunos');
            if (totalTurmasEl) totalTurmasEl.textContent = totalTurmas;
            if (totalAlunosVinculadosEl) totalAlunosVinculadosEl.textContent = totalAlunosVinculados;
            if (turmasComAlunosEl) turmasComAlunosEl.textContent = turmasComAlunos;
            console.log('📊 Estatísticas de turmas atualizadas:', { totalTurmas, totalAlunosVinculados, turmasComAlunos });
        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas de turmas:', error);
        }
    }

    sincronizarComDashboard() {
        if (window.adminManager && typeof adminManager.atualizarTurmasDashboard === 'function') {
            console.log('🔄 Sincronizando turmas com dashboard...');
            adminManager.atualizarTurmasDashboard();
        }
    }

    // ========== FUNÇÕES DE GERENCIAMENTO DE ALUNOS ==========

    async buscarAlunosVinculadosTurma() {
        try {
            if (!this.turmaEditando?.id) {
                console.log('⚠️ Nenhuma turma selecionada para buscar alunos vinculados');
                return [];
            }

            console.log('🔍 Buscando alunos vinculados da turma:', this.turmaEditando.id);

            const response = await this.makeRequest(`/turmas/${this.turmaEditando.id}/alunos`);
            console.log('📡 Resposta da API alunos vinculados:', response);

            // 🔥 CORREÇÃO: Tratar diferentes formatos de resposta
            let alunosVinculados = [];

            if (Array.isArray(response)) {
                // Resposta é array direto
                alunosVinculados = response;
            } else if (response && response.success && Array.isArray(response.data)) {
                // Formato {success: true, data: [...]}
                alunosVinculados = response.data;
            } else if (response && Array.isArray(response.alunos)) {
                // Formato {alunos: [...]}
                alunosVinculados = response.alunos;
            } else if (response && response.data && Array.isArray(response.data)) {
                // Formato aninhado
                alunosVinculados = response.data;
            } else {
                console.warn('⚠️ Formato de resposta inesperado para alunos vinculados:', response);
                alunosVinculados = [];
            }

            console.log(`✅ ${alunosVinculados.length} alunos vinculados encontrados`);
            return alunosVinculados;

        } catch (error) {
            console.error('❌ Erro ao buscar alunos vinculados:', error);
            return [];
        }
    }

    async renderizarListaAlunosParaTurma() {
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

        try {
            // 🔥 CORREÇÃO: Aguardar a Promise ser resolvida
            const alunosVinculados = await this.buscarAlunosVinculadosTurma();

            // 🔥 CORREÇÃO: Garantir que é um array
            const alunosVinculadosIds = Array.isArray(alunosVinculados)
                ? alunosVinculados.map(aluno => aluno.id)
                : [];

            this.alunosVinculadosInicialmente = new Set(alunosVinculadosIds);

            console.log(`🎯 ${alunosVinculadosIds.length} alunos já vinculados à turma:`, alunosVinculadosIds);
            console.log('📋 Estado inicial guardado:', Array.from(this.alunosVinculadosInicialmente));

            tbody.innerHTML = this.alunos.map(aluno => {
                const turmaAluno = this.turmas.find(t => t.id === aluno.turma_id);
                const jaNaTurma = alunosVinculadosIds.includes(aluno.id);
                const validacaoCurso = this.validarCursoAluno(aluno.id, this.turmaEditando?.curso);
                const podeVincular = !jaNaTurma && validacaoCurso.valido;

                return `
                <tr>
                    <td>
                        <input type="checkbox" class="aluno-checkbox" value="${aluno.id}" 
                               ${jaNaTurma ? 'checked' : ''} 
                               ${podeVincular || jaNaTurma ? '' : 'disabled'}
                               data-inicialmente-vinculado="${jaNaTurma}">
                        ${jaNaTurma ? '<small class="text-success">(já vinculado)</small>' : ''}
                        ${!validacaoCurso.valido && !jaNaTurma ? '<small class="text-danger">(curso incompatível)</small>' : ''}
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
                        <span class="badge ${jaNaTurma ? 'active' : (podeVincular ? 'active' : 'inactive')}">
                            ${jaNaTurma ? 'Vinculado' : (podeVincular ? 'Pode vincular' : 'Não pode vincular')}
                        </span>
                    </td>
                </tr>
            `;
            }).join('');

            this.configurarSelecaoAlunosComEventos();

        } catch (error) {
            console.error('❌ Erro ao renderizar lista de alunos:', error);
            tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar alunos</p>
                    <small>${error.message}</small>
                </td>
            </tr>
        `;
        }
    }


    configurarSelecaoAlunosComEventos() {
        const selecionarTodos = document.getElementById('selecionarTodosAlunos');
        const checkboxes = document.querySelectorAll('.aluno-checkbox:not(:disabled)');
        const buscarInput = document.getElementById('buscarAlunosTurma');

        console.log(`🔧 Configurando eventos para ${checkboxes.length} checkboxes`);

        if (selecionarTodos) {
            selecionarTodos.onchange = (e) => {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            };
        }

        if (buscarInput) {
            buscarInput.oninput = (e) => {
                const termo = e.target.value.toLowerCase();
                const linhas = document.querySelectorAll('#listaAlunosTurma tr');

                linhas.forEach(linha => {
                    const texto = linha.textContent.toLowerCase();
                    linha.style.display = texto.includes(termo) ? '' : 'none';
                });
            };
        }

        checkboxes.forEach(checkbox => {
            checkbox.onchange = null;

            checkbox.onchange = async (e) => {
                const alunoId = parseInt(e.target.value);
                const estaSelecionado = e.target.checked;
                const estavaVinculadoInicialmente = this.alunosVinculadosInicialmente.has(alunoId);

                console.log('🔄 Alteração de seleção:', {
                    alunoId,
                    estaSelecionado,
                    estavaVinculadoInicialmente
                });

                if (!estaSelecionado && estavaVinculadoInicialmente) {
                    const aluno = this.alunos.find(a => a.id === alunoId);
                    if (aluno) {
                        await this.desvincularAlunoInstantaneo(alunoId, aluno.nome);
                    }
                }
                else if (!estaSelecionado && !estavaVinculadoInicialmente) {
                    console.log('ℹ️ Aluno não estava vinculado inicialmente - ignorando desvinculação');
                }
            };
        });
    }

    async desvincularAlunoInstantaneo(alunoId, alunoNome) {
        try {
            const turmaId = this.turmaEditando?.id;
            if (!turmaId) {
                console.error('❌ Turma não selecionada para desvinculação instantânea');
                return;
            }

            // 🔥 VERIFICAÇÃO EXTRA: Confirmar que o aluno estava vinculado inicialmente
            if (!this.alunosVinculadosInicialmente.has(alunoId)) {
                console.log('⚠️ Aluno não estava vinculado inicialmente - cancelando desvinculação');

                // 🔥 CORREÇÃO: Não restaurar o checkbox se não estava vinculado inicialmente
                const checkbox = document.querySelector(`.aluno-checkbox[value="${alunoId}"]`);
                if (checkbox) {
                    checkbox.checked = false; // Manter desmarcado
                }
                return;
            }

            console.log('⚡ Desvinculação instantânea:', { turmaId, alunoId, alunoNome });

            // Feedback visual
            const checkbox = document.querySelector(`.aluno-checkbox[value="${alunoId}"]`);
            if (checkbox) {
                checkbox.disabled = true;
                const linha = checkbox.closest('tr');
                if (linha) {
                    linha.style.opacity = '0.6';
                    const statusCell = linha.cells[6];
                    if (statusCell) {
                        statusCell.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Desvinculando...';
                    }
                }
            }

            const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: parseInt(turmaId),
                    aluno_id: parseInt(alunoId)
                })
            });

            if (response && response.success) {
                console.log('✅ Aluno desvinculado instantaneamente:', alunoNome);

                // 🔥 ATUALIZAR: Remover da lista de alunos vinculados inicialmente
                this.alunosVinculadosInicialmente.delete(alunoId);

                // Atualizar dados globais
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

                // 🔥 CORREÇÃO: Atualizar apenas a linha específica em vez de recarregar todo o modal
                await this.atualizarApenasLinhaAluno(alunoId);

                this.showNotification(`Aluno "${alunoNome}" desvinculado automaticamente`, 'info');
            } else {
                throw new Error(response?.error || 'Erro na desvinculação instantânea');
            }

        } catch (error) {
            console.error('❌ Erro na desvinculação instantânea:', error);

            // Restaurar estado em caso de erro
            const checkbox = document.querySelector(`.aluno-checkbox[value="${alunoId}"]`);
            if (checkbox) {
                checkbox.disabled = false;
                // 🔥 CORREÇÃO: Só restaurar como selecionado se estava vinculado inicialmente
                if (this.alunosVinculadosInicialmente.has(alunoId)) {
                    checkbox.checked = true;
                }

                const linha = checkbox.closest('tr');
                if (linha) {
                    linha.style.opacity = '1';
                    const statusCell = linha.cells[6];
                    if (statusCell) {
                        statusCell.innerHTML = '<span class="badge active">Vinculado</span>';
                    }
                }
            }

            this.showNotification('Erro ao desvincular aluno: ' + error.message, 'error');
        }
    }

    async atualizarApenasLinhaAluno(alunoId) {
        try {
            const checkbox = document.querySelector(`.aluno-checkbox[value="${alunoId}"]`);
            if (!checkbox) return;

            const linha = checkbox.closest('tr');
            if (!linha) return;

            const aluno = this.alunos.find(a => a.id === alunoId);
            if (!aluno) return;

            const statusCell = linha.cells[6];
            if (statusCell) {
                statusCell.innerHTML = '<span class="badge active">Pode vincular</span>';
            }

            const checkboxCell = linha.cells[0];
            checkboxCell.innerHTML = `
            <input type="checkbox" class="aluno-checkbox" value="${alunoId}">
            <small class="text-danger">(curso incompatível)</small>
        `;

            linha.style.opacity = '1';

            const novoCheckbox = checkboxCell.querySelector('.aluno-checkbox');
            if (novoCheckbox) {
                novoCheckbox.onchange = async (e) => {
                    const alunoId = parseInt(e.target.value);
                    const estaSelecionado = e.target.checked;
                    const estavaVinculadoInicialmente = this.alunosVinculadosInicialmente.has(alunoId);

                    console.log('🔄 Alteração de seleção:', {
                        alunoId,
                        estaSelecionado,
                        estavaVinculadoInicialmente
                    });

                    if (!estaSelecionado && estavaVinculadoInicialmente) {
                        const aluno = this.alunos.find(a => a.id === alunoId);
                        if (aluno) {
                            await this.desvincularAlunoInstantaneo(alunoId, aluno.nome);
                        }
                    }
                };
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar linha do aluno:', error);
        }
    }

    // ========== FUNÇÕES DE EXCLUSÃO E DESVINCULAÇÃO ==========

    async excluirTurma(turmaId) {
        const turma = this.turmas.find(t => t.id === turmaId);
        if (!turma) return;

        console.log('🗑️ Tentando excluir turma:', {
            id: turma.id,
            nome: turma.nome,
            ativa: turma.ativa,
            quantidade_alunos: turma.quantidade_alunos
        });

        if (turma.ativa && turma.quantidade_alunos > 0) {
            this.showNotification('Não é possível excluir uma turma ativa que possui alunos vinculados!', 'error');
            return;
        }

        if (!turma.ativa && turma.quantidade_alunos > 0) {
            const confirmarDesvinculacao = confirm(
                `A turma "${turma.nome}" possui ${turma.quantidade_alunos} aluno(s) vinculado(s).\n\n` +
                'Para excluir a turma, é necessário desvincular todos os alunos primeiro.\n\n' +
                'Deseja desvincular todos os alunos agora?'
            );

            if (confirmarDesvinculacao) {
                await this.desvincularTodosAlunos(turmaId);
                setTimeout(async () => {
                    await this.carregarTurmas();
                    const turmaAtualizada = this.turmas.find(t => t.id === turmaId);
                    if (turmaAtualizada && turmaAtualizada.quantidade_alunos === 0) {
                        await this.excluirTurmaAposVerificacao(turmaId);
                    } else {
                        this.showNotification('Ainda há alunos vinculados. Não foi possível excluir a turma.', 'error');
                    }
                }, 1500);
            }
            return;
        }

        await this.excluirTurmaAposVerificacao(turmaId);
    }

    async excluirTurmaAposVerificacao(turmaId) {
        const turma = this.turmas.find(t => t.id === turmaId);
        if (!turma) return;

        const mensagemConfirmacao = turma.ativa
            ? `Tem certeza que deseja inativar a turma "${turma.nome}"?\n\nEsta ação tornará a turma inativa.`
            : `Tem certeza que deseja excluir permanentemente a turma "${turma.nome}"?\n\nEsta ação não pode ser desfeita.`;

        if (!confirm(mensagemConfirmacao)) {
            return;
        }

        try {
            const endpoint = turma.ativa ? `/turmas/${turmaId}` : `/turmas/permanent/${turmaId}`;

            console.log('📤 Fazendo requisição de exclusão para:', endpoint);

            const response = await this.makeRequest(endpoint, {
                method: 'DELETE'
            });

            if (response && response.success) {
                this.showNotification(response.message, 'success');
                await this.carregarTurmas();
            } else {
                throw new Error(response?.error || 'Erro ao excluir turma');
            }
        } catch (error) {
            console.error('❌ Erro ao excluir turma:', error);
            this.showNotification('Erro ao excluir turma: ' + error.message, 'error');
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

    // ========== FUNÇÕES DE VISUALIZAÇÃO ==========

    // 🔥 CORREÇÃO: Função verAlunosTurma corrigida
    async verAlunosTurma(turmaId) {
        try {
            console.log('👀 Ver alunos da turma:', turmaId);

            // 🔥 CORREÇÃO: Usar a função auxiliar que já sabemos que funciona
            const alunosVinculados = await this.buscarAlunosVinculadosTurmaComId(turmaId);

            console.log(`✅ ${alunosVinculados.length} alunos carregados do banco`);

            if (!Array.isArray(alunosVinculados)) {
                throw new Error('Resposta inválida da API - não é um array');
            }

            this.mostrarModalAlunosTurma(alunosVinculados, turmaId);

        } catch (error) {
            console.error('❌ Erro ao carregar alunos da turma:', error);
            this.showNotification('Erro ao carregar alunos do banco: ' + error.message, 'error');
        }
    }

    // 🔥 CORREÇÃO: Apenas aumento do tamanho do modal
    mostrarModalAlunosTurma(alunos, turmaId) {
        try {
            const turma = this.turmas.find(t => t.id === turmaId);
            const turmaNome = turma ? turma.nome : 'Turma';

            const modalId = 'modal-ver-alunos-turma';

            // Remover modal existente de forma segura
            const modalExistente = document.getElementById(modalId);
            if (modalExistente) {
                modalExistente.remove();
            }

            let alunosHTML = '';

            if (alunos && Array.isArray(alunos) && alunos.length > 0) {
                alunosHTML = alunos.map(aluno => `
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
                                onclick="adminTurmas.desvincularAlunoIndividualModal(${turmaId}, ${aluno.id}, '${this.escapeHtml(aluno.nome)}')"
                                title="Desvincular aluno">
                            <i class="fas fa-unlink"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            } else {
                alunosHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum aluno nesta turma</p>
                    </td>
                </tr>
            `;
            }

            const modalHTML = `
        <div class="modal-overlay" id="${modalId}">
            <div class="modal-content xxlarge" onclick="event.stopPropagation()" style="
                max-width: 95%;
                width: 95%;
                max-height: 90vh;
                height: 90vh;
            ">
                <div class="modal-header">
                    <h3><i class="fas fa-users"></i> Alunos da Turma - ${this.escapeHtml(turmaNome)}</h3>
                    <button class="modal-close" onclick="adminTurmas.fecharModalVerAlunos()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="height: calc(100% - 120px);">
                    <!-- 🔥 CORREÇÃO: Container com altura máxima e scroll -->
                    <div class="table-responsive" style="
                        height: 100%;
                        overflow: auto;
                    ">
                        <table style="
                            min-width: 1000px;
                            width: 100%;
                        ">
                            <thead>
                                <tr>
                                    <th style="min-width: 200px;">Nome</th>
                                    <th style="min-width: 120px;">Matrícula</th>
                                    <th style="min-width: 220px;">Email</th>
                                    <th style="min-width: 180px;">Curso</th>
                                    <th style="min-width: 100px;">Período</th>
                                    <th style="min-width: 100px;">Status</th>
                                    <th style="min-width: 100px;">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alunosHTML}
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="adminTurmas.fecharModalVerAlunos()">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            console.log('✅ Modal de ver alunos com tamanho aumentado (scroll reduzido)');

        } catch (error) {
            console.error('❌ Erro ao criar modal de ver alunos:', error);
            this.showNotification('Erro ao criar modal: ' + error.message, 'error');
        }
    }

    async desvincularAluno(turmaId, alunoId, alunoNome = '') {
        try {
            if (!alunoNome) {
                const aluno = this.alunos.find(a => a.id === alunoId);
                alunoNome = aluno ? aluno.nome : 'Aluno';
            }

            const confirmacao = confirm(`Tem certeza que deseja desvincular o aluno "${alunoNome}" da turma?`);
            if (!confirmacao) return;

            console.log('🗑️ Desvinculando aluno individual:', { turmaId, alunoId });

            const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: parseInt(turmaId),
                    aluno_id: parseInt(alunoId)
                })
            });

            console.log('📡 Resposta da desvinculação individual:', response);

            if (response && response.success) {
                this.showNotification(`Aluno "${alunoNome}" desvinculado com sucesso!`, 'success');

                // Atualizar dados globais
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

            } else {
                throw new Error(response?.error || 'Erro ao desvincular aluno');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular aluno individual:', error);
            this.showNotification('Erro ao desvincular aluno: ' + error.message, 'error');
        }
    }

    // ========== FUNÇÕES DE GERENCIAMENTO DE VÍNCULOS ==========

    async abrirModalGerenciarVinculos(turmaId) {
        try {
            console.log('👥 Abrindo modal de gerenciar vínculos:', turmaId);

            const turma = this.turmas.find(t => t.id === turmaId);
            if (!turma) {
                throw new Error('Turma não encontrada');
            }

            this.turmaEditando = turma;

            // 🔥 CORREÇÃO: Buscar alunos vinculados diretamente
            const alunosVinculados = await this.buscarAlunosVinculadosTurmaComId(turmaId);
            console.log('📡 Alunos vinculados encontrados:', alunosVinculados);

            if (!Array.isArray(alunosVinculados)) {
                throw new Error('Resposta inválida da API');
            }

            console.log(`✅ ${alunosVinculados.length} alunos encontrados na turma`);
            this.mostrarModalGerenciarVinculos(turma, alunosVinculados);

        } catch (error) {
            console.error('❌ Erro ao abrir modal de gerenciar vínculos:', error);
            this.showNotification('Erro ao carregar alunos da turma: ' + error.message, 'error');
        }
    }

    mostrarModalGerenciarVinculos(turma, alunosVinculados) {
        try {
            console.log('🎯 Mostrando modal de gerenciar vínculos:', {
                turma: turma.nome,
                alunos: alunosVinculados.length
            });

            const modalId = 'modal-gerenciar-vinculos';

            // 🔥 CORREÇÃO: Remover modal existente de forma mais segura
            const modalExistente = document.getElementById(modalId);
            if (modalExistente) {
                modalExistente.remove();
            }

            let alunosHTML = '';

            if (alunosVinculados && alunosVinculados.length > 0) {
                alunosHTML = alunosVinculados.map(aluno => `
                <tr>
                    <td>
                        <input type="checkbox" class="aluno-vinculado-checkbox" value="${aluno.id}">
                    </td>
                    <td>${this.escapeHtml(aluno.nome)}</td>
                    <td>${this.escapeHtml(aluno.matricula || 'N/A')}</td>
                    <td>${this.escapeHtml(aluno.email)}</td>
                    <td>${this.escapeHtml(aluno.curso || 'N/A')}</td>
                    <td>${this.formatarData(aluno.data_matricula || aluno.data_vinculo || aluno.created_at)}</td>
                    <td>
                        <button class="btn-action small perigo" 
                                onclick="adminTurmas.desvincularAlunoIndividual(${turma.id}, ${aluno.id}, '${this.escapeHtml(aluno.nome)}')"
                                title="Desvincular aluno">
                            <i class="fas fa-unlink"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            } else {
                alunosHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum aluno vinculado a esta turma</p>
                    </td>
                </tr>
            `;
            }

            const modalHTML = `
        <div class="modal-overlay" id="${modalId}">
            <div class="modal-content large">
                <div class="modal-header">
                    <h3><i class="fas fa-user-times"></i> Gerenciar Alunos - ${this.escapeHtml(turma.nome)}</h3>
                    <button class="modal-close" onclick="adminTurmas.fecharModalGerenciarVinculos()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Turma: <strong>${this.escapeHtml(turma.nome)}</strong></label>
                        <small class="form-text">Curso: ${this.escapeHtml(turma.curso)} | ${alunosVinculados.length} aluno(s) vinculado(s)</small>
                    </div>
                    
                    ${alunosVinculados.length > 0 ? `
                        <div class="form-group">
                            <label>Buscar Alunos Vinculados:</label>
                            <input type="text" id="buscarAlunosVinculados" class="form-control" 
                                   placeholder="Digite o nome, matrícula ou email...">
                        </div>
                        
                        <div class="alunos-vinculados-container" style="max-height: 400px; overflow-y: auto;">
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
                                    ${alunosHTML}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="btn-group" style="margin-top: 20px;">
                            <button type="button" class="btn-primary perigo" onclick="adminTurmas.desvincularAlunosSelecionados()">
                                <i class="fas fa-unlink"></i> Desvincular Selecionados
                            </button>
                            <button type="button" class="btn-secondary" onclick="adminTurmas.fecharModalGerenciarVinculos()">
                                <i class="fas fa-times"></i> Fechar
                            </button>
                        </div>
                    ` : `
                        <div class="empty-state">
                            <i class="fas fa-users-slash"></i>
                            <p>Nenhum aluno vinculado a esta turma</p>
                        </div>
                        <div class="btn-group" style="margin-top: 20px;">
                            <button type="button" class="btn-secondary" onclick="adminTurmas.fecharModalGerenciarVinculos()">
                                <i class="fas fa-times"></i> Fechar
                            </button>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // 🔥 CORREÇÃO: Configurar eventos após inserir no DOM
            if (alunosVinculados.length > 0) {
                this.configurarModalGerenciarVinculos();
            }

            console.log('✅ Modal de gerenciar vínculos criado com sucesso');

        } catch (error) {
            console.error('❌ Erro ao criar modal de gerenciar vínculos:', error);
            this.showNotification('Erro ao criar modal: ' + error.message, 'error');
        }
    }

    fecharModalGerenciarVinculos() {
        const modal = document.getElementById('modal-gerenciar-vinculos');
        if (modal) {
            modal.remove();
        }
        this.turmaEditando = null;
    }

    fecharModalVerAlunos() {
        const modal = document.getElementById('modal-ver-alunos-turma');
        if (modal) {
            modal.remove();
        }
    }

    // 🔥 NOVA FUNÇÃO: Desvincular aluno do modal de ver alunos
    async desvincularAlunoIndividualModal(turmaId, alunoId, alunoNome = '') {
        try {
            if (!alunoNome) {
                const aluno = this.alunos.find(a => a.id === alunoId);
                alunoNome = aluno ? aluno.nome : 'Aluno';
            }

            const confirmacao = confirm(`Tem certeza que deseja desvincular o aluno "${alunoNome}" da turma?`);
            if (!confirmacao) return;

            console.log('🗑️ Desvinculando aluno do modal:', { turmaId, alunoId });

            const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: parseInt(turmaId),
                    aluno_id: parseInt(alunoId)
                })
            });

            console.log('📡 Resposta da desvinculação:', response);

            if (response && response.success) {
                this.showNotification(`Aluno "${alunoNome}" desvinculado com sucesso!`, 'success');

                // Atualizar dados globais
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

                // 🔥 CORREÇÃO: Fechar e reabrir o modal para atualizar a lista
                this.fecharModalVerAlunos();
                setTimeout(() => {
                    this.verAlunosTurma(turmaId);
                }, 500);

            } else {
                throw new Error(response?.error || 'Erro ao desvincular aluno');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular aluno do modal:', error);
            this.showNotification('Erro ao desvincular aluno: ' + error.message, 'error');
        }
    }

    async desvincularAlunoIndividual(turmaId, alunoId, alunoNome = '') {
        try {
            if (!alunoNome) {
                const aluno = this.alunos.find(a => a.id === alunoId);
                alunoNome = aluno ? aluno.nome : 'Aluno';
            }

            const confirmacao = confirm(`Tem certeza que deseja desvincular o aluno "${alunoNome}" da turma?`);
            if (!confirmacao) return;

            console.log('🗑️ Desvinculando aluno individual:', { turmaId, alunoId });

            const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                method: 'POST',
                body: JSON.stringify({
                    turma_id: parseInt(turmaId),
                    aluno_id: parseInt(alunoId)
                })
            });

            console.log('📡 Resposta da desvinculação individual:', response);

            if (response && response.success) {
                this.showNotification(`Aluno "${alunoNome}" desvinculado com sucesso!`, 'success');

                // 🔥 CORREÇÃO: Atualizar dados globais
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

                // 🔥 CORREÇÃO: Fechar e reabrir o modal para atualizar a lista
                this.fecharModalGerenciarVinculos();
                setTimeout(() => {
                    this.abrirModalGerenciarVinculos(turmaId);
                }, 500);

            } else {
                throw new Error(response?.error || 'Erro ao desvincular aluno');
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular aluno individual:', error);
            this.showNotification('Erro ao desvincular aluno: ' + error.message, 'error');
        }
    }


    configurarModalGerenciarVinculos() {
        try {
            console.log('⚙️ Configurando modal de gerenciar vínculos...');

            const selecionarTodos = document.getElementById('selecionarTodosVinculados');
            const checkboxes = document.querySelectorAll('.aluno-vinculado-checkbox');
            const buscarInput = document.getElementById('buscarAlunosVinculados');

            if (selecionarTodos && checkboxes.length > 0) {
                selecionarTodos.addEventListener('change', (e) => {
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = e.target.checked;
                    });
                });

                console.log('✅ "Selecionar Todos" configurado');
            } else {
                console.warn('⚠️ Elementos de seleção não encontrados');
            }

            if (buscarInput) {
                buscarInput.addEventListener('input', (e) => {
                    const termo = e.target.value.toLowerCase();
                    const linhas = document.querySelectorAll('#listaAlunosVinculados tr');

                    let linhasVisiveis = 0;
                    linhas.forEach(linha => {
                        const texto = linha.textContent.toLowerCase();
                        const deveMostrar = texto.includes(termo);
                        linha.style.display = deveMostrar ? '' : 'none';

                        if (deveMostrar) linhasVisiveis++;
                    });

                    console.log(`🔍 Busca: ${linhasVisiveis}/${linhas.length} alunos encontrados`);
                });

                console.log('✅ Busca configurada');
            } else {
                console.warn('⚠️ Campo de busca não encontrado');
            }

        } catch (error) {
            console.error('❌ Erro ao configurar modal de gerenciar vínculos:', error);
        }
    }

    // 🔥 CORREÇÃO: Função desvincularAlunosSelecionados para fechar modal após desvincular
    async desvincularAlunosSelecionados() {
        try {
            console.log('🔍 Verificando seleção de alunos para desvincular...');
            const checkboxes = document.querySelectorAll('.aluno-vinculado-checkbox:checked');
            const alunosIds = Array.from(checkboxes).map(cb => {
                const value = parseInt(cb.value);
                console.log(`📋 Checkbox selecionado: ID ${value}`);
                return value;
            });

            if (alunosIds.length === 0) {
                this.showNotification('Selecione pelo menos um aluno para desvincular', 'warning');
                return;
            }

            const turmaId = this.turmaEditando?.id;
            if (!turmaId) {
                throw new Error('Turma não selecionada');
            }

            console.log(`🎯 Preparando para desvincular ${alunosIds.length} aluno(s) da turma ${turmaId}`);

            const nomesAlunos = alunosIds.map(id => {
                const aluno = this.alunos.find(a => a.id === id);
                return aluno ? aluno.nome : `Aluno ID ${id}`;
            });

            const confirmacao = confirm(
                `Tem certeza que deseja desvincular ${alunosIds.length} aluno(s) da turma?\n\n` +
                `Alunos:\n- ${nomesAlunos.join('\n- ')}`
            );

            if (!confirmacao) {
                console.log('❌ Usuário cancelou a desvinculação');
                return;
            }

            console.log('🔄 Iniciando desvinculação em lote...');

            let desvinculadosComSucesso = 0;
            let erros = [];

            for (const alunoId of alunosIds) {
                try {
                    console.log(`🔄 Desvinculando aluno ${alunoId}...`);

                    const response = await this.makeRequest('/turmas/desmatricular-aluno', {
                        method: 'POST',
                        body: JSON.stringify({
                            turma_id: parseInt(turmaId),
                            aluno_id: parseInt(alunoId)
                        })
                    });

                    console.log(`📡 Resposta para aluno ${alunoId}:`, response);

                    if (response && response.success) {
                        desvinculadosComSucesso++;
                        console.log(`✅ Aluno ${alunoId} desvinculado com sucesso`);
                    } else {
                        throw new Error(response?.error || 'Erro na resposta da API');
                    }

                } catch (error) {
                    console.error(`❌ Erro ao desvincular aluno ${alunoId}:`, error);
                    const alunoNome = this.alunos.find(a => a.id === alunoId)?.nome || `Aluno ID ${alunoId}`;
                    erros.push(`${alunoNome}: ${error.message}`);
                }
            }

            console.log(`📊 Resultado: ${desvinculadosComSucesso} sucesso(s), ${erros.length} erro(s)`);

            if (desvinculadosComSucesso > 0) {
                if (erros.length === 0) {
                    this.showNotification(
                        `${desvinculadosComSucesso} aluno(s) desvinculado(s) com sucesso!`,
                        'success'
                    );
                } else {
                    this.showNotification(
                        `${desvinculadosComSucesso} aluno(s) desvinculado(s), ${erros.length} com erro.`,
                        'warning'
                    );
                    console.error('❌ Erros detalhados:', erros);
                }

                console.log('🔄 Atualizando dados após desvinculação...');
                await this.atualizarQuantidadeAlunosTurma(turmaId);
                await this.carregarAlunos();
                this.renderizarTurmas();

                // 🔥 CORREÇÃO: Fechar o modal após desvincular com sucesso
                console.log('🚪 Fechando modal de gerenciar vínculos...');
                this.fecharModalGerenciarVinculos();

            } else {
                throw new Error('Nenhum aluno foi desvinculado: ' + erros.join('; '));
            }

        } catch (error) {
            console.error('❌ Erro ao desvincular alunos selecionados:', error);
            this.showNotification('Erro ao desvincular alunos: ' + error.message, 'error');
        }
    }

    // ========== FUNÇÕES UTILITÁRIAS ==========

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

    filtrarTurmas(status) {
        try {
            console.log(`🔍 Filtrando turmas por status: ${status}`);

            const tbody = document.getElementById('turmas-body');
            if (!tbody) return;

            const linhas = tbody.querySelectorAll('tr:not(.categoria-turma)');

            linhas.forEach(linha => {
                const isInativa = linha.classList.contains('turma-inativa');
                const categoria = linha.closest('tr.categoria-turma');

                switch (status) {
                    case 'ativas':
                        linha.style.display = !isInativa ? '' : 'none';
                        if (categoria && categoria.textContent.includes('Inativas')) {
                            categoria.style.display = 'none';
                        }
                        break;
                    case 'inativas':
                        linha.style.display = isInativa ? '' : 'none';
                        if (categoria && categoria.textContent.includes('Ativas')) {
                            categoria.style.display = 'none';
                        }
                        break;
                    case 'todas':
                    default:
                        linha.style.display = '';
                        if (categoria) {
                            categoria.style.display = '';
                        }
                        break;
                }
            });

            console.log(`✅ Filtro aplicado: ${status}`);
        } catch (error) {
            console.error('❌ Erro ao filtrar turmas:', error);
        }
    }

    // ========== FUNÇÕES DE DIAGNÓSTICO AVANÇADO ==========

    async debugAlunoTurmas() {
        try {
            console.group('🐛 DEBUG ALUNO-TURMAS - DETALHADO');

            console.log('📊 Dados atuais:');
            console.log('- Turmas:', this.turmas.length);
            console.log('- Alunos:', this.alunos.length);

            for (const turma of this.turmas) {
                console.log(`\n🔍 Analisando turma: ${turma.nome} (ID: ${turma.id})`);

                const alunosResponse = await this.makeRequest(`/turmas/${turma.id}/alunos`);
                const alunosNaTurma = alunosResponse.success ? alunosResponse.data : [];

                console.log(`   👥 Alunos na API: ${alunosNaTurma.length}`);
                console.log(`   📊 Quantidade registrada: ${turma.quantidade_alunos}`);

                const alunosLocais = this.alunos.filter(a => a.turma_id === turma.id);
                console.log(`   🔍 Alunos locais com turma_id: ${alunosLocais.length}`);

                if (alunosNaTurma.length !== turma.quantidade_alunos) {
                    console.warn(`   ⚠️ DISCREPÂNCIA: API tem ${alunosNaTurma.length}, turma mostra ${turma.quantidade_alunos}`);

                    await this.atualizarQuantidadeAlunosTurma(turma.id);
                }

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
            console.log('📚 Turmas no sistema:', this.turmas.length);
            this.turmas.forEach(turma => {
                console.log(`   🏫 ${turma.nome}: ${turma.quantidade_alunos} alunos, ${turma.ativa ? 'Ativa' : 'Inativa'}`);
            });

            console.log('👥 Alunos no sistema:', this.alunos.length);
            const alunosComTurma = this.alunos.filter(a => a.turma_id);
            console.log(`   📊 Alunos com turma: ${alunosComTurma.length}`);

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

    async sincronizacaoCompleta() {
        try {
            console.log('🔄 Iniciando sincronização completa...');

            await Promise.all([
                this.carregarTurmas(),
                this.carregarAlunos()
            ]);

            for (const turma of this.turmas) {
                await this.atualizarQuantidadeAlunosTurma(turma.id);
            }

            this.renderizarTurmas();
            this.sincronizarComDashboard();

            console.log('✅ Sincronização completa concluída');
            this.showNotification('Sistema de turmas sincronizado com sucesso!', 'success');

        } catch (error) {
            console.error('❌ Erro na sincronização completa:', error);
            this.showNotification('Erro na sincronização: ' + error.message, 'error');
        }
    }
}

// Inicialização
const adminTurmas = new AdminTurmas();

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 DOM Carregado - Inicializando AdminTurmas...');

    setTimeout(async () => {
        try {
            await adminTurmas.init();
            console.log('✅ AdminTurmas inicializado com sucesso');

            // Verificar se os cursos foram carregados
            if (adminTurmas.cursosDisponiveis.length === 0) {
                console.warn('⚠️ Nenhum curso carregado, tentando recarregar...');
                await adminTurmas.carregarCursosDoBanco();
            }

        } catch (error) {
            console.error('❌ Erro na inicialização do AdminTurmas:', error);
            adminTurmas.showNotification('Erro ao inicializar sistema de turmas', 'error');
        }
    }, 100);
});

// Tornar acessível globalmente
window.AdminTurmas = AdminTurmas;
window.adminTurmas = adminTurmas;