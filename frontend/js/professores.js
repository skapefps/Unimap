// professores.js - Gerenciador de Professores COM SELEÇÃO DE PERÍODO E TURMA
class ProfessoresManager {
    constructor() {
        console.log('👨‍🏫 ProfessoresManager inicializado');
        this.user = null;
        this.professores = [];
        this.favoritos = [];
        this.cursos = [];
        this.periodos = [];
        this.turmas = [];
        this.init();
    }

    init() {
        console.log('🎯 Iniciando ProfessoresManager...');
        this.carregarUsuario();
        this.configurarEventListeners();
    }

    carregarUsuario() {
    console.log('🔐 Verificando autenticação...');
    const userData = localStorage.getItem('userData');
    if (userData) {
        this.user = JSON.parse(userData);
        console.log('✅ Usuário carregado:', this.user.nome, '- Tipo:', this.user.tipo);
        this.atualizarInterfaceUsuario();
        
        // SEMPRE carregar professores primeiro
        this.carregarProfessores();
        
        // Se for aluno, carregar cursos e dados do aluno
        if (this.user.tipo === 'aluno') {
            this.carregarCursos();
            this.carregarDadosAluno();
        }
    } else {
        console.log('❌ Usuário não autenticado');
    }
}

    async carregarCursos() {
        try {
            console.log('📚 Carregando cursos...');
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/cursos', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.cursos = await response.json();
                console.log('✅ Cursos carregados:', this.cursos.length);
                this.renderizarFormularioCompleto();
            } else {
                console.error('❌ Erro ao carregar cursos');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar cursos:', error);
        }
    }

    async carregarDadosAluno() {
        try {
            console.log('🔍 Carregando dados do aluno...');
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/aluno/dados-completos/${this.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const resultado = await response.json();
                const aluno = resultado.data.data || resultado.data;
                
                console.log('📊 Dados do aluno:', aluno);
                
                if (aluno.curso && aluno.periodo && aluno.turma_id) {
                    this.preencherFormularioComDadosAluno(aluno);
                }
                
                this.carregarProfessores();
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados do aluno:', error);
            this.carregarProfessores();
        }
    }
    renderizarFormularioAdmin() {
    const formContainer = document.querySelector('.add-professor-form');
    if (!formContainer) {
        console.log('❌ Container do formulário não encontrado');
        return;
    }

    console.log('🔄 Renderizando formulário para ADMIN...');
    
    formContainer.innerHTML = `
        <div class="form-group">
            <label for="professor-select">
                <i class="fas fa-chalkboard-teacher"></i> Professor:
            </label>
            <select id="professor-select" class="select-shadow" required>
                <option value="">Selecione um professor</option>
            </select>
        </div>

        <button type="submit" class="btn-primary btn-full">
            <i class="fas fa-plus"></i> Adicionar Professor
        </button>
    `;

    // Popular o select de professores
    this.renderizarSelectProfessores();
    
    // Configurar event listeners específicos do admin
    this.configurarEventListenersAdmin();
}
configurarEventListenersAdmin() {
    const professorSelect = document.getElementById('professor-select');
    if (professorSelect) {
        professorSelect.addEventListener('change', () => {
            this.validarFormularioAdmin();
        });
    }

    const form = document.querySelector('.add-professor-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.adicionarProfessorFavoritoAdmin();
        });
    }
}
async adicionarProfessorFavoritoAdmin() {
    console.log('⭐ ADMIN: Iniciando adição de professor aos favoritos...');
    
    const professorSelect = document.getElementById('professor-select');
    const professorId = professorSelect.value;

    if (!professorId) {
        this.mostrarMensagem('Por favor, selecione um professor', 'warning');
        return;
    }

    if (!this.user) {
        this.mostrarMensagem('Usuário não autenticado', 'error');
        return;
    }

    try {
        console.log('📤 ADMIN: Enviando requisição para adicionar favorito...');
        
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/professores/favoritos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                aluno_id: this.user.id,
                professor_id: professorId
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ ADMIN: Professor adicionado aos favoritos!');
            this.mostrarMensagem('Professor adicionado aos favoritos!', 'success');
            
            this.carregarProfessoresFavoritos();
            professorSelect.value = '';
            
        } else {
            const errorMsg = data.error || 'Erro ao adicionar professor';
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('❌ ADMIN: Erro ao adicionar favorito:', error);
        this.mostrarMensagem('Erro ao adicionar professor: ' + error.message, 'error');
    }
}
renderizarFormularioCompleto() {
    const formContainer = document.querySelector('.add-professor-form');
    if (!formContainer) {
        console.log('❌ Container do formulário não encontrado');
        return;
    }

    console.log('🔄 Renderizando formulário COMPLETO para ALUNO...');
    
    formContainer.innerHTML = `
        <div class="form-group">
            <label for="curso-select-professor">
                <i class="fas fa-book"></i> Seu Curso:
            </label>
            <select id="curso-select-professor" class="select-shadow" required>
                <option value="">Selecione seu curso</option>
                ${this.cursos.map(curso => 
                    `<option value="${curso.id}" data-duracao="${curso.duracao_periodos || curso.total_periodos || 8}">
                        ${curso.nome}
                    </option>`
                ).join('')}
            </select>
        </div>

        <div class="form-group">
            <label for="periodo-select-professor">
                <i class="fas fa-calendar-alt"></i> Seu Período:
            </label>
            <select id="periodo-select-professor" class="select-shadow" required disabled>
                <option value="">Selecione o período</option>
            </select>
        </div>

        <div class="form-group">
            <label for="turma-select-professor">
                <i class="fas fa-users"></i> Sua Turma:
            </label>
            <select id="turma-select-professor" class="select-shadow" required disabled>
                <option value="">Selecione a turma</option>
            </select>
        </div>

        <div class="form-group">
            <label for="professor-select">
                <i class="fas fa-chalkboard-teacher"></i> Professor:
            </label>
            <select id="professor-select" class="select-shadow" required disabled>
                <option value="">Selecione um professor</option>
            </select>
        </div>

        <button type="submit" class="btn-primary btn-full">
            <i class="fas fa-plus"></i> Adicionar Professor
        </button>
    `;

    this.configurarEventListenersFormulario();
}

    configurarEventListenersFormulario() {
    // SE FOR ADMIN - APENAS CONFIGURAR O SELECT SIMPLES
    if (this.user.tipo === 'admin') {
        const professorSelect = document.getElementById('professor-select');
        if (professorSelect) {
            professorSelect.addEventListener('change', () => {
                this.validarFormularioAdmin();
            });
        }
    } 
    // SE FOR ALUNO - CONFIGURAR TODOS OS SELECTS
    else {
        const cursoSelect = document.getElementById('curso-select-professor');
        if (cursoSelect) {
            cursoSelect.addEventListener('change', (e) => {
                this.handleCursoChange(e.target.value);
            });
        }

        const periodoSelect = document.getElementById('periodo-select-professor');
        if (periodoSelect) {
            periodoSelect.addEventListener('change', (e) => {
                this.handlePeriodoChange(e.target.value);
            });
        }

        const turmaSelect = document.getElementById('turma-select-professor');
        if (turmaSelect) {
            turmaSelect.addEventListener('change', () => {
                this.validarFormularioCompleto();
            });
        }

        const professorSelect = document.getElementById('professor-select');
        if (professorSelect) {
            professorSelect.addEventListener('change', () => {
                this.validarFormularioCompleto();
            });
        }
    }

    // Configurar submit do formulário (igual para ambos)
    const form = document.querySelector('.add-professor-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.adicionarProfessorFavorito();
        });
    }
}
    async handleCursoChange(cursoId) {
        const periodoSelect = document.getElementById('periodo-select-professor');
        const turmaSelect = document.getElementById('turma-select-professor');
        const professorSelect = document.getElementById('professor-select');

        if (!cursoId) {
            periodoSelect.disabled = true;
            periodoSelect.innerHTML = '<option value="">Selecione o período</option>';
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
            professorSelect.disabled = true;
            return;
        }

        const cursoSelecionado = this.cursos.find(curso => curso.id == cursoId);
        const duracaoPeriodos = cursoSelecionado ? 
            (cursoSelecionado.duracao_periodos || cursoSelecionado.total_periodos || 8) : 8;

        console.log(`📚 Curso selecionado: ${cursoSelecionado?.nome}, Duração: ${duracaoPeriodos} períodos`);

        await this.carregarPeriodos(duracaoPeriodos);
        
        periodoSelect.disabled = false;
        turmaSelect.disabled = true;
        turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
        professorSelect.disabled = true;
    }

    async carregarPeriodos(duracaoPeriodos) {
        const periodoSelect = document.getElementById('periodo-select-professor');
        if (!periodoSelect) return;

        periodoSelect.innerHTML = '<option value="">Carregando períodos...</option>';
        periodoSelect.disabled = true;

        this.periodos = [];
        for (let i = 1; i <= duracaoPeriodos; i++) {
            this.periodos.push({
                id: i,
                numero: i,
                nome: `${i}° Período`
            });
        }

        periodoSelect.innerHTML = '<option value="">Selecione o período</option>';
        this.periodos.forEach(periodo => {
            const option = document.createElement('option');
            option.value = periodo.numero;
            option.textContent = periodo.nome;
            periodoSelect.appendChild(option);
        });

        periodoSelect.disabled = false;
        console.log(`✅ ${this.periodos.length} períodos carregados`);
    }

    async handlePeriodoChange(periodo) {
        const turmaSelect = document.getElementById('turma-select-professor');
        const professorSelect = document.getElementById('professor-select');
        const cursoSelect = document.getElementById('curso-select-professor');

        if (!periodo) {
            turmaSelect.disabled = true;
            turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
            professorSelect.disabled = true;
            return;
        }

        const cursoId = cursoSelect ? cursoSelect.value : '';
        if (!cursoId) return;

        turmaSelect.disabled = false;
        await this.carregarTurmas(cursoId, periodo);
        this.validarFormularioCompleto();
    }

    async carregarTurmas(cursoId, periodo) {
        const turmaSelect = document.getElementById('turma-select-professor');
        if (!turmaSelect) return;

        turmaSelect.innerHTML = '<option value="">Carregando turmas...</option>';
        turmaSelect.disabled = true;

        const cursoNome = this.getCursoNome(cursoId);
        console.log(`🔍 Buscando turmas para: ${cursoNome}, período ${periodo}`);

        try {
            const response = await fetch('/api/turmas/public');
            if (response.ok) {
                const todasTurmas = await response.json();
                
                this.turmas = todasTurmas.filter(turma => {
                    const cursoBate = turma.curso && 
                        (turma.curso === cursoNome || 
                         turma.curso.includes(cursoNome) || 
                         cursoNome.includes(turma.curso));
                    
                    const periodoBate = turma.periodo && 
                        turma.periodo.toString() === periodo.toString();
                    
                    return cursoBate && periodoBate;
                });

                turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
                
                if (this.turmas.length === 0) {
                    turmaSelect.innerHTML = '<option value="">Nenhuma turma disponível</option>';
                } else {
                    this.turmas.forEach(turma => {
                        const option = document.createElement('option');
                        option.value = turma.id;
                        option.textContent = turma.nome;
                        turmaSelect.appendChild(option);
                    });
                }
                
                turmaSelect.disabled = false;
                console.log(`✅ ${this.turmas.length} turmas carregadas`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar turmas:', error);
            turmaSelect.innerHTML = '<option value="">Erro ao carregar turmas</option>';
            turmaSelect.disabled = false;
        }
    }

    validarFormularioCompleto() {
        const cursoSelect = document.getElementById('curso-select-professor');
        const periodoSelect = document.getElementById('periodo-select-professor');
        const turmaSelect = document.getElementById('turma-select-professor');
        const professorSelect = document.getElementById('professor-select');
        const submitBtn = document.querySelector('.add-professor-form .btn-primary');

        if (!cursoSelect || !periodoSelect || !turmaSelect || !professorSelect || !submitBtn) return;

        const formularioValido = cursoSelect.value && 
                                periodoSelect.value && 
                                turmaSelect.value && 
                                professorSelect.value;

        professorSelect.disabled = !turmaSelect.value;
        submitBtn.disabled = !formularioValido;
    }

    getCursoNome(cursoId) {
        const curso = this.cursos.find(c => c.id == cursoId);
        return curso ? curso.nome : '';
    }

    preencherFormularioComDadosAluno(aluno) {
        console.log('📝 Preenchendo formulário com dados do aluno...');
        
        const cursoSelect = document.getElementById('curso-select-professor');
        const periodoSelect = document.getElementById('periodo-select-professor');
        const turmaSelect = document.getElementById('turma-select-professor');

        if (cursoSelect) {
            const curso = this.cursos.find(c => c.nome === aluno.curso);
            if (curso) {
                cursoSelect.value = curso.id;
                
                setTimeout(() => {
                    cursoSelect.dispatchEvent(new Event('change'));
                    
                    setTimeout(() => {
                        if (periodoSelect) {
                            periodoSelect.value = aluno.periodo;
                            periodoSelect.dispatchEvent(new Event('change'));
                            
                            setTimeout(() => {
                                if (turmaSelect && aluno.turma_id) {
                                    turmaSelect.value = aluno.turma_id;
                                    this.validarFormularioCompleto();
                                }
                            }, 500);
                        }
                    }, 500);
                }, 500);
            }
        }
    }

    async carregarProfessores() {
    try {
        console.log('📚 Carregando professores da API...');
        
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/professores', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            this.professores = await response.json();
            console.log('✅ Professores carregados:', this.professores.length);
            this.renderizarSelectProfessores();
            
            // ⭐⭐ ADICIONAR ESTA LINHA: Renderizar formulário baseado no tipo de usuário
            if (this.user.tipo === 'admin') {
                this.renderizarFormularioAdmin();
            }
            
            this.carregarProfessoresFavoritos();
        } else {
            console.error('❌ Erro ao carregar professores:', response.status);
        }
    } catch (error) {
        console.error('❌ Erro na requisição:', error);
    }
}

    renderizarSelectProfessores() {
        const select = document.getElementById('professor-select');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um professor</option>';

        if (this.professores.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhum professor disponível';
            select.appendChild(option);
            return;
        }

        this.professores.forEach(professor => {
            const option = document.createElement('option');
            option.value = professor.id;
            option.textContent = `${professor.nome} - ${professor.email}`;
            select.appendChild(option);
        });

        console.log('✅ Select de professores renderizado');
    }

    async carregarProfessoresFavoritos() {
        if (!this.user) return;

        try {
            console.log('⭐ Carregando professores favoritos...');
            
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/professores/favoritos/${this.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.favoritos = await response.json();
                console.log('✅ Favoritos carregados:', this.favoritos.length);
                this.renderizarProfessoresFavoritos();
            } else {
                console.error('❌ Erro ao carregar favoritos:', response.status);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar favoritos:', error);
        }
    }

    renderizarProfessoresFavoritos() {
        const container = document.querySelector('#meus-professores .professores-list');
        if (!container) {
            console.log('❌ Container de favoritos não encontrado');
            return;
        }

        if (this.favoritos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-plus fa-3x"></i>
                    <p>Nenhum professor favorito</p>
                    <p class="empty-state-subtitle">Adicione professores na aba "Adicionar Professor"</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.favoritos.map(professor => `
            <div class="professor-card favorite-card" data-professor-id="${professor.id}">
                <div class="professor-header">
                    <div class="professor-avatar">
                        <i class="fas fa-user-graduate"></i>
                    </div>
                    <div class="professor-info">
                        <h3 class="professor-name">${professor.nome}</h3>
                        <p class="professor-email">${professor.email}</p>
                    </div>
                    <button class="btn-remove-favorite" onclick="professoresManager.removerFavorito(${professor.id})" 
                            title="Remover dos favoritos">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="professor-actions">
                    <button class="btn-outline btn-sm" onclick="professoresManager.verDetalhesProfessor(${professor.id})">
                        <i class="fas fa-info-circle"></i> Ver Detalhes
                    </button>
                </div>
            </div>
        `).join('');

        console.log('✅ Professores favoritos renderizados');
    }

    configurarEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        const form = document.querySelector('.add-professor-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📝 Formulário submetido - Adicionar professor');
                this.adicionarProfessorFavorito();
                return false;
            });
        }

        const btnAdicionar = document.querySelector('.add-professor-form .btn-primary');
        if (btnAdicionar) {
            btnAdicionar.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Botão adicionar clicado');
                this.adicionarProfessorFavorito();
                return false;
            });
        }
    }

    loadMeusProfessores() {
        console.log('👨‍🏫 Carregando meus professores...');
        this.carregarProfessoresFavoritos();
    }

    async adicionarProfessorFavorito() {
    // Se for admin, usar formulário simples
    if (this.user.tipo === 'admin') {
        console.log('⭐ ADMIN: Iniciando adição de professor aos favoritos...');
        
        const professorSelect = document.getElementById('professor-select');
        const professorId = professorSelect.value;

        if (!professorId) {
            this.mostrarMensagem('Por favor, selecione um professor', 'warning');
            return;
        }

        if (!this.user) {
            this.mostrarMensagem('Usuário não autenticado', 'error');
            return;
        }

        try {
            console.log('📤 ADMIN: Enviando requisição para adicionar favorito...');
            
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/professores/favoritos', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    aluno_id: this.user.id,
                    professor_id: professorId
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('✅ ADMIN: Professor adicionado aos favoritos!');
                this.mostrarMensagem('Professor adicionado aos favoritos!', 'success');
                
                this.carregarProfessoresFavoritos();
                professorSelect.value = '';
                
            } else {
                const errorMsg = data.error || 'Erro ao adicionar professor';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('❌ ADMIN: Erro ao adicionar favorito:', error);
            this.mostrarMensagem('Erro ao adicionar professor: ' + error.message, 'error');
        }
        return;
    }
    
    // Se for aluno, usar formulário completo
    console.log('⭐ ALUNO: Iniciando adição de professor aos favoritos...');
    
    const cursoSelect = document.getElementById('curso-select-professor');
    const periodoSelect = document.getElementById('periodo-select-professor');
    const turmaSelect = document.getElementById('turma-select-professor');
    const professorSelect = document.getElementById('professor-select');

    if (!cursoSelect || !periodoSelect || !turmaSelect || !professorSelect) {
        this.mostrarMensagem('Erro: Formulário incompleto', 'error');
        return;
    }

    const cursoId = cursoSelect.value;
    const periodo = periodoSelect.value;
    const turmaId = turmaSelect.value;
    const professorId = professorSelect.value;

    console.log('🎯 Dados do formulário:', {
        cursoId, periodo, turmaId, professorId
    });

    if (!cursoId || !periodo || !turmaId || !professorId) {
        this.mostrarMensagem('Por favor, preencha todos os campos', 'warning');
        return;
    }

    if (!this.user) {
        this.mostrarMensagem('Usuário não autenticado', 'error');
        return;
    }

    try {
        console.log('📤 ALUNO: Enviando requisição para adicionar favorito...');
        
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/professores/favoritos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                aluno_id: this.user.id,
                professor_id: professorId,
                curso_id: cursoId,
                periodo: periodo,
                turma_id: turmaId
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ ALUNO: Professor adicionado aos favoritos!');
            this.mostrarMensagem('Professor adicionado aos favoritos!', 'success');
            
            this.carregarProfessoresFavoritos();
            this.limparFormulario();
            
        } else {
            const errorMsg = data.error || 'Erro ao adicionar professor';
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('❌ ALUNO: Erro ao adicionar favorito:', error);
        this.mostrarMensagem('Erro ao adicionar professor: ' + error.message, 'error');
    }
}

    limparFormulario() {
        const cursoSelect = document.getElementById('curso-select-professor');
        const periodoSelect = document.getElementById('periodo-select-professor');
        const turmaSelect = document.getElementById('turma-select-professor');
        const professorSelect = document.getElementById('professor-select');

        if (cursoSelect) cursoSelect.value = '';
        if (periodoSelect) {
            periodoSelect.innerHTML = '<option value="">Selecione o período</option>';
            periodoSelect.disabled = true;
        }
        if (turmaSelect) {
            turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
            turmaSelect.disabled = true;
        }
        if (professorSelect) {
            professorSelect.value = '';
            professorSelect.disabled = true;
        }
    }

    async removerFavorito(professorId) {
        if (!this.user) {
            this.mostrarMensagem('Usuário não autenticado', 'error');
            return;
        }

        if (!confirm('Tem certeza que deseja remover este professor dos favoritos?')) {
            return;
        }

        try {
            console.log('🗑️ Removendo professor dos favoritos...');
            
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/professores/favoritos/${this.user.id}/${professorId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('✅ Professor removido dos favoritos!');
                this.mostrarMensagem('Professor removido dos favoritos!', 'success');
                
                this.carregarProfessoresFavoritos();
                
            } else {
                const errorMsg = data.error || 'Erro ao remover professor';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('❌ Erro ao remover favorito:', error);
            this.mostrarMensagem('Erro ao remover professor: ' + error.message, 'error');
        }
    }

    verDetalhesProfessor(professorId) {
        console.log('📖 Ver detalhes do professor:', professorId);
        
        const professor = this.professores.find(p => p.id == professorId) || 
                         this.favoritos.find(p => p.id == professorId);
        
        if (professor) {
            this.mostrarAlertaDetalhes(professor);
        } else {
            this.mostrarMensagem('Professor não encontrado', 'error');
        }
    }

    mostrarAlertaDetalhes(professor) {
        const overlay = document.createElement('div');
        overlay.className = 'professor-alert-overlay';
        overlay.innerHTML = this.gerarHTMLAlerta(professor);
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);
        
        this.configurarEventListenersAlerta(overlay, professor);
    }

    gerarHTMLAlerta(professor) {
        const isFavorito = this.favoritos.some(p => p.id === professor.id);
        
        return `
            <div class="professor-alert">
                <div class="professor-alert-header">
                    <h2 class="professor-alert-title">
                        <i class="fas fa-chalkboard-teacher"></i>
                        Detalhes do Professor
                    </h2>
                    <button class="professor-alert-close" aria-label="Fechar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="professor-alert-content">
                    <div class="professor-details">
                        <div class="professor-detail-group">
                            <div class="professor-detail-icon">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="professor-detail-content">
                                <div class="professor-detail-label">Nome Completo</div>
                                <div class="professor-detail-value">${professor.nome}</div>
                            </div>
                        </div>
                        
                        <div class="professor-detail-group">
                            <div class="professor-detail-icon">
                                <i class="fas fa-envelope"></i>
                            </div>
                            <div class="professor-detail-content">
                                <div class="professor-detail-label">Email</div>
                                <div class="professor-detail-value">${professor.email}</div>
                            </div>
                        </div>
                        
                        <div class="professor-detail-group">
                            <div class="professor-detail-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="professor-detail-content">
                                <div class="professor-detail-label">Status</div>
                                <div class="professor-detail-value professor-status-${professor.ativo ? 'active' : 'inactive'}">
                                    ${professor.ativo ? 'Ativo' : 'Inativo'}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="professor-stats">
                        <div class="professor-stat-card">
                            <span class="professor-stat-number">${isFavorito ? '⭐' : '—'}</span>
                            <span class="professor-stat-label">Seu Favorito</span>
                        </div>
                        <div class="professor-stat-card">
                            <span class="professor-stat-number">${professor.id}</span>
                            <span class="professor-stat-label">ID</span>
                        </div>
                    </div>
                    
                    <div class="professor-aulas-section">
                        <h3 class="professor-section-title">
                            <i class="fas fa-book"></i>
                            Informações
                        </h3>
                        <div class="professor-aulas-list">
                            <div class="professor-aula-item">
                                <div class="professor-aula-info">
                                    <p class="professor-aula-name">Disponível para contato</p>
                                    <p class="professor-aula-details">Via email institucional</p>
                                </div>
                                <span class="professor-aula-horario">Email</span>
                            </div>
                            <div class="professor-aula-item">
                                <div class="professor-aula-info">
                                    <p class="professor-aula-name">Status no sistema</p>
                                    <p class="professor-aula-details">Professor ${professor.ativo ? 'ativo' : 'inativo'}</p>
                                </div>
                                <span class="professor-aula-horario">${professor.ativo ? 'Ativo' : 'Inativo'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="professor-alert-footer">
                    <button class="professor-alert-btn professor-alert-btn-outline" data-action="close">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                    ${!isFavorito ? 
                        `<button class="professor-alert-btn professor-alert-btn-primary" data-action="favorite">
                            <i class="fas fa-star"></i> Adicionar aos Favoritos
                        </button>` : 
                        `<button class="professor-alert-btn professor-alert-btn-outline" data-action="unfavorite">
                            <i class="fas fa-trash"></i> Remover dos Favoritos
                        </button>`
                    }
                </div>
            </div>
        `;
    }

    configurarEventListenersAlerta(overlay, professor) {
        const closeBtn = overlay.querySelector('.professor-alert-close');
        closeBtn.addEventListener('click', () => {
            this.fecharAlerta(overlay);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.fecharAlerta(overlay);
            }
        });
        
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                this.fecharAlerta(overlay);
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
        
        const buttons = overlay.querySelectorAll('.professor-alert-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.executarAcaoAlerta(action, professor, overlay);
            });
        });
    }
    validarFormularioAdmin() {
    const professorSelect = document.getElementById('professor-select');
    const submitBtn = document.querySelector('.add-professor-form .btn-primary');

    if (!professorSelect || !submitBtn) return;

    const formularioValido = professorSelect.value;
    submitBtn.disabled = !formularioValido;
}

    executarAcaoAlerta(action, professor, overlay) {
        switch(action) {
            case 'close':
                this.fecharAlerta(overlay);
                break;
            case 'favorite':
                this.adicionarProfessorFavoritoDireto(professor.id, overlay);
                break;
            case 'unfavorite':
                this.removerFavoritoDireto(professor.id, overlay);
                break;
        }
    }

    adicionarProfessorFavoritoDireto(professorId, overlay) {
        const select = document.getElementById('professor-select');
        if (select) {
            select.value = professorId;
            this.adicionarProfessorFavorito();
            this.fecharAlerta(overlay);
        }
    }

    removerFavoritoDireto(professorId, overlay) {
        this.removerFavorito(professorId);
        this.fecharAlerta(overlay);
    }

    fecharAlerta(overlay) {
        overlay.classList.remove('show');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
    }

    atualizarInterfaceUsuario() {
        console.log('📝 Atualizando informações do usuário na interface...');
        const userNameElements = document.querySelectorAll('#mobileUserName, #desktopUserName, .nav-user');
        userNameElements.forEach(element => {
            if (element) {
                element.textContent = this.user.nome;
            }
        });
    }

    mostrarMensagem(mensagem, tipo = 'info') {
        const mensagensAntigas = document.querySelectorAll('.mensagem-flutuante');
        mensagensAntigas.forEach(msg => msg.remove());

        const mensagemDiv = document.createElement('div');
        mensagemDiv.className = `mensagem-flutuante mensagem-${tipo}`;
        mensagemDiv.innerHTML = `
            <div class="mensagem-conteudo">
                <i class="fas fa-${this.getIconeMensagem(tipo)}"></i>
                <span>${mensagem}</span>
            </div>
        `;

        document.body.appendChild(mensagemDiv);

        setTimeout(() => {
            mensagemDiv.classList.add('show');
        }, 100);

        setTimeout(() => {
            mensagemDiv.classList.remove('show');
            setTimeout(() => {
                if (mensagemDiv.parentNode) {
                    mensagemDiv.parentNode.removeChild(mensagemDiv);
                }
            }, 300);
        }, 3000);
    }

    getIconeMensagem(tipo) {
        switch(tipo) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }

    manterNaAbaAtual() {
        const abaAdicionar = document.querySelector('.tab-btn[onclick*="adicionar-professor"]');
        if (abaAdicionar) {
            abaAdicionar.click();
        }
    }

    mostrarErro(mensagem) {
        const container = document.querySelector('#meus-professores .professores-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <p>${mensagem}</p>
                    <button class="btn-primary" onclick="professoresManager.carregarProfessores()">
                        <i class="fas fa-redo"></i> Tentar Novamente
                    </button>
                </div>
            `;
        }
    }
}

// Inicialização
console.log('📄 DOM carregado - Inicializando ProfessoresManager...');
const professoresManager = new ProfessoresManager();
console.log('✅ ProfessoresManager inicializado com sucesso!');