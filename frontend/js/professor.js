// professor.js - Versão com melhor tratamento de erros
class ProfessorManager {
    constructor() {
        this.currentUser = null;
        this.minhasAulas = [];
        this.salasDisponiveis = [];
        this.cursos = [];
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
        await this.carregarSalasDisponiveis();
        await this.carregarCursos();
    }

    // professor.js - Apenas a função carregarMinhasAulas corrigida
async carregarMinhasAulas() {
    try {
        console.log('📚 Carregando aulas do professor...');
        
        // 🔥 TENTAR A ROTA ESPECÍFICA PARA PROFESSORES PRIMEIRO
        const result = await api.getMinhasAulasProfessor();
        
        if (result && result.success) {
            this.minhasAulas = result.data;
            console.log(`✅ ${this.minhasAulas.length} aulas carregadas (rota específica)`);
            this.renderizarAulas();
            return;
        }
        
        // 🔥 SE FALHAR, TENTAR A ROTA ALTERNATIVA
        console.log('🔄 Tentando rota alternativa...');
        const resultAlternativo = await api.getMinhasAulas();
        
        if (resultAlternativo && resultAlternativo.success) {
            this.minhasAulas = resultAlternativo.data;
            console.log(`✅ ${this.minhasAulas.length} aulas carregadas (rota alternativa)`);
            this.renderizarAulas();
        } else {
            console.error('❌ Ambas as rotas falharam:', result?.error, resultAlternativo?.error);
            this.mostrarErro('Erro ao carregar aulas. Recarregue a página.');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar aulas:', error);
        this.mostrarErro('Erro de conexão ao carregar aulas');
    }
}
    async carregarSalasDisponiveis() {
        try {
            console.log('🏫 Carregando salas disponíveis...');
            
            const result = await api.getSalas();
            
            if (result && result.success) {
                this.salasDisponiveis = result.data;
                console.log(`✅ ${this.salasDisponiveis.length} salas carregadas`);
                this.renderizarSalasSelect();
            } else {
                console.error('❌ Erro ao carregar salas:', result?.error);
                this.usarSalasPadrao();
            }
        } catch (error) {
            console.error('❌ Erro ao carregar salas:', error);
            this.usarSalasPadrao();
        }
    }

    async carregarCursos() {
        try {
            console.log('🎓 Carregando cursos...');
            
            const result = await api.getCursos();
            
            if (result && result.success) {
                this.cursos = result.data;
                console.log(`✅ ${this.cursos.length} cursos carregados`);
                this.popularSelectCursos();
            } else {
                console.error('❌ Erro ao carregar cursos:', result?.error);
                this.usarCursosPadrao();
            }
        } catch (error) {
            console.error('❌ Erro ao carregar cursos:', error);
            this.usarCursosPadrao();
        }
    }

    usarSalasPadrao() {
        // Fallback para salas padrão
        this.salasDisponiveis = [
            { id: 1, numero: 'A101', bloco: 'A', tipo: 'Sala de Aula', capacidade: 40 },
            { id: 2, numero: 'A102', bloco: 'A', tipo: 'Sala de Aula', capacidade: 35 },
            { id: 3, numero: 'A201', bloco: 'A', tipo: 'Sala de Aula', capacidade: 45 },
            { id: 4, numero: 'A202', bloco: 'A', tipo: 'Sala de Aula', capacidade: 30 },
            { id: 5, numero: 'B101', bloco: 'B', tipo: 'Laboratório', capacidade: 25 },
            { id: 6, numero: 'B102', bloco: 'B', tipo: 'Laboratório', capacidade: 20 }
        ];
        this.renderizarSalasSelect();
        this.mostrarErro('Usando dados de exemplo para salas');
    }

    usarCursosPadrao() {
        // Fallback para cursos padrão
        this.cursos = [
            { id: 1, nome: 'Sistemas de Informação' },
            { id: 2, nome: 'Administração' },
            { id: 3, nome: 'Direito' }
        ];
        this.popularSelectCursos();
    }

    renderizarSalasSelect() {
        const select = document.getElementById('salaSelect');
        if (!select || !this.salasDisponiveis) return;

        select.innerHTML = '<option value="">Selecione a sala</option>' +
            this.salasDisponiveis.map(sala => 
                `<option value="${sala.id}" data-bloco="${sala.bloco}" data-tipo="${sala.tipo}">
                    ${sala.numero} - Bloco ${sala.bloco} (${sala.tipo}) - ${sala.capacidade} lugares
                </option>`
            ).join('');

        // Configurar busca de salas
        this.configurarBuscaSalas();
    }
    popularSelectTurmas() {
    const select = document.getElementById('turmaSelect');
    if (!select) return;

    // Buscar turmas disponíveis da API
    this.carregarTurmasDisponiveis().then(turmas => {
        select.innerHTML = '<option value="">Selecione a turma</option>' +
            turmas.map(turma => 
                `<option value="${turma.id}">${turma.nome} - ${turma.curso} (${turma.periodo}° Período)</option>`
            ).join('');
    });
}

async carregarTurmasDisponiveis() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/turmas', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            return result.data || [];
        } else {
            console.error('❌ Erro ao carregar turmas:', response.status);
            return [];
        }
    } catch (error) {
        console.error('❌ Erro ao carregar turmas:', error);
        return [];
    }
}

    popularSelectCursos() {
        const select = document.getElementById('cursoSelect');
        if (!select || !this.cursos) return;

        select.innerHTML = '<option value="">Selecione o curso</option>' +
            this.cursos.map(curso => 
                `<option value="${curso.nome}">${curso.nome}</option>`
            ).join('');
    }

    configurarBuscaSalas() {
        const searchInput = document.getElementById('searchSala');
        const salaSelect = document.getElementById('salaSelect');
        
        if (searchInput && salaSelect) {
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const options = salaSelect.getElementsByTagName('option');
                
                for (let i = 0; i < options.length; i++) {
                    const text = options[i].textContent.toLowerCase();
                    options[i].style.display = text.includes(searchTerm) ? '' : 'none';
                }
                
                // Manter o primeiro option sempre visível
                if (options[0]) options[0].style.display = '';
            });
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

    validarFormularioAula(dados) {
        const erros = [];

        if (!dados.disciplina || dados.disciplina.trim().length < 3) {
            erros.push('Disciplina deve ter pelo menos 3 caracteres');
        }

        if (!dados.sala_id) {
            erros.push('Selecione uma sala');
        }

        if (!dados.curso) {
            erros.push('Selecione um curso');
        }

        if (!dados.turma) {
            erros.push('Selecione uma turma');
        }

        if (!dados.horario_inicio || !dados.horario_fim) {
            erros.push('Selecione um horário');
        }

        if (!dados.dia_semana || dados.dia_semana.length === 0) {
            erros.push('Selecione pelo menos um dia da semana');
        }

        return erros;
    }

    async criarAula(dadosAula) {
        try {
            console.log('📝 Validando e criando nova aula:', dadosAula);
            
            // Validar dados
            const erros = this.validarFormularioAula(dadosAula);
            if (erros.length > 0) {
                this.mostrarErro('Erros no formulário:\n' + erros.join('\n'));
                return;
            }

            // 🔥 CORREÇÃO: Garantir que os dados estejam no formato correto
            const dadosFormatados = {
                disciplina: dadosAula.disciplina,
                sala_id: parseInt(dadosAula.sala_id),
                curso: dadosAula.curso,
                turma: dadosAula.turma,
                horario_inicio: dadosAula.horario_inicio,
                horario_fim: dadosAula.horario_fim,
                dia_semana: dadosAula.dia_semana
            };

            console.log('📤 Enviando dados para API:', dadosFormatados);

            const result = await api.criarAula(dadosFormatados);
            
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
                // 🔥 CORREÇÃO MELHORADA: Mostrar erro específico da API
                const mensagemErro = result?.error || 'Erro desconhecido ao criar aula';
                console.error('❌ Erro da API:', mensagemErro);
                throw new Error(mensagemErro);
            }
        } catch (error) {
            console.error('❌ Erro ao criar aula:', error);
            
            // 🔥 CORREÇÃO: Mensagens de erro mais específicas
            let mensagemErro = 'Erro ao criar aula: ' + error.message;
            
            if (error.message.includes('Professor não encontrado')) {
                mensagemErro = 'Seu perfil de professor não foi encontrado. O sistema tentará criar automaticamente. Tente novamente.';
            } else if (error.message.includes('UNIQUE constraint failed')) {
                mensagemErro = 'Já existe uma aula com esses dados. Verifique os horários e salas.';
            } else if (error.message.includes('FOREIGN KEY constraint failed')) {
                mensagemErro = 'Sala ou curso inválido. Verifique os dados selecionados.';
            }
            
            this.mostrarErro(mensagemErro);
        }
    }

    async excluirAula(aulaId) {
        if (!confirm('Tem certeza que deseja excluir esta aula?')) {
            return;
        }

        try {
            console.log('🗑️ Excluindo aula:', aulaId);
            
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
        const aula = this.minhasAulas.find(a => a.id === aulaId);
        if (aula) {
            this.mostrarModalDetalhesAula(aula);
        }
    }

    mostrarModalDetalhesAula(aula) {
        const modalHTML = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${aula.disciplina || aula.disciplina_nome || 'Disciplina'}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="aula-detalhes">
                            <p><strong>Curso:</strong> ${aula.curso || 'N/A'}</p>
                            <p><strong>Turma:</strong> ${aula.turma || 'N/A'}</p>
                            <p><strong>Horário:</strong> ${aula.horario_inicio} - ${aula.horario_fim}</p>
                            <p><strong>Dias:</strong> ${this.formatarDiasSemana(aula.dia_semana)}</p>
                            <p><strong>Sala:</strong> ${aula.sala_numero} - Bloco ${aula.sala_bloco}</p>
                            <p><strong>Status:</strong> ${aula.ativa ? 'Ativa' : 'Inativa'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        document.body.insertAdjacentHTML('beforeend', modalHTML);
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
    // 🔧 FUNÇÃO DE DEBUG - Adicione ao professor.js
async debugAulas() {
    try {
        console.log('🔍 DEBUG: Verificando aulas no banco...');
        
        const token = localStorage.getItem('authToken');
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        const response = await fetch('/api/debug/aulas-professor', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('📊 DEBUG - Aulas no banco:', data);
            alert(`DEBUG: ${data.aulas.length} aulas encontradas para ${userData.email}`);
        }
    } catch (error) {
        console.error('❌ Erro no debug:', error);
    }
}
// No método criarAula, garantir que curso e turma sejam salvos corretamente
async criarAula(dadosAula) {
    try {
        console.log('📝 Validando e criando nova aula:', dadosAula);
        
        // Validar dados
        const erros = this.validarFormularioAula(dadosAula);
        if (erros.length > 0) {
            this.mostrarErro('Erros no formulário:\n' + erros.join('\n'));
            return;
        }

        // 🔥 GARANTIR QUE OS FILTROS ESTEJEM CORRETOS
        const dadosFormatados = {
            disciplina: dadosAula.disciplina,
            sala_id: parseInt(dadosAula.sala_id),
            curso: dadosAula.curso, // ✅ CURSO para filtro
            turma: dadosAula.turma, // ✅ TURMA para filtro
            horario_inicio: dadosAula.horario_inicio,
            horario_fim: dadosAula.horario_fim,
            dia_semana: dadosAula.dia_semana
        };

        console.log('📤 Enviando dados para API (com filtros):', dadosFormatados);

        const result = await api.criarAula(dadosFormatados);
        
        if (result && result.success) {
            console.log('✅ Aula criada com sucesso!');
            this.mostrarSucesso('Aula criada com sucesso!');
            
            await this.carregarMinhasAulas();
            showSection('minhas-aulas-professor');
            document.getElementById('formCriarAula')?.reset();
            
        } else {
            const mensagemErro = result?.error || 'Erro desconhecido ao criar aula';
            throw new Error(mensagemErro);
        }
    } catch (error) {
        console.error('❌ Erro ao criar aula:', error);
        let mensagemErro = 'Erro ao criar aula: ' + error.message;
        
        if (error.message.includes('Professor não encontrado')) {
            mensagemErro = 'Seu perfil de professor não foi encontrado. O sistema tentará criar automaticamente. Tente novamente.';
        } else if (error.message.includes('UNIQUE constraint failed')) {
            mensagemErro = 'Já existe uma aula com esses dados. Verifique os horários e salas.';
        } else if (error.message.includes('FOREIGN KEY constraint failed')) {
            mensagemErro = 'Sala ou curso inválido. Verifique os dados selecionados.';
        }
        
        this.mostrarErro(mensagemErro);
    }
    
}
// Adicione estas funções ao ProfessoresManager no professores.js

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
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.className = 'professor-alert-overlay';
    overlay.innerHTML = this.gerarHTMLAlerta(professor);
    
    document.body.appendChild(overlay);
    
    // Mostrar com animação
    setTimeout(() => {
        overlay.classList.add('show');
    }, 10);
    
    // Configurar event listeners
    this.configurarEventListenersAlerta(overlay, professor);
}

gerarHTMLAlerta(professor) {
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
                        <span class="professor-stat-number">${this.favoritos.filter(p => p.id === professor.id).length > 0 ? '⭐' : '0'}</span>
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
                        Informações Adicionais
                    </h3>
                    <div class="professor-aulas-list">
                        <div class="professor-aula-item">
                            <div class="professor-aula-info">
                                <p class="professor-aula-name">Disponível para contato</p>
                                <p class="professor-aula-details">Via email institucional</p>
                            </div>
                            <span class="professor-aula-horario">Ativo</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="professor-alert-footer">
                <button class="professor-alert-btn professor-alert-btn-outline" data-action="close">
                    <i class="fas fa-times"></i> Fechar
                </button>
                ${this.favoritos.filter(p => p.id === professor.id).length === 0 ? 
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
    // Fechar ao clicar no X
    const closeBtn = overlay.querySelector('.professor-alert-close');
    closeBtn.addEventListener('click', () => {
        this.fecharAlerta(overlay);
    });
    
    // Fechar ao clicar no overlay (fora do alerta)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            this.fecharAlerta(overlay);
        }
    });
    
    // Fechar com ESC
    const keyHandler = (e) => {
        if (e.key === 'Escape') {
            this.fecharAlerta(overlay);
            document.removeEventListener('keydown', keyHandler);
        }
    };
    document.addEventListener('keydown', keyHandler);
    
    // Ações dos botões
    const buttons = overlay.querySelectorAll('.professor-alert-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            this.executarAcaoAlerta(action, professor, overlay);
        });
    });
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
    if (!this.user) return;
    
    // Simular adição (você pode integrar com a função existente)
    this.mostrarMensagem('Professor adicionado aos favoritos!', 'success');
    this.fecharAlerta(overlay);
    
    // Recarregar favoritos
    setTimeout(() => {
        this.carregarProfessoresFavoritos();
    }, 500);
}

removerFavoritoDireto(professorId, overlay) {
    if (!this.user) return;
    
    if (confirm('Tem certeza que deseja remover este professor dos favoritos?')) {
        this.mostrarMensagem('Professor removido dos favoritos!', 'success');
        this.fecharAlerta(overlay);
        
        // Recarregar favoritos
        setTimeout(() => {
            this.carregarProfessoresFavoritos();
        }, 500);
    }
}

fecharAlerta(overlay) {
    overlay.classList.remove('show');
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, 300);
}

// Chame esta função no console do navegador para testar:
// professorManager.debugAulas()
}

// ✅ INSTÂNCIA GLOBAL
const professorManager = new ProfessorManager();