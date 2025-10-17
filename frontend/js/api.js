// api.js - Serviço de API UNIMAP
class ApiService {
    constructor() {
        // URL dinâmica baseada na origem atual
        this.baseURL = window.location.origin + '/api';
        console.log('🌐 API Base URL:', this.baseURL);
    }

    async register(userData) {
        try {
            console.log('📤 Enviando dados para cadastro:', userData);
            
            const response = await fetch(`${this.baseURL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            console.log('📥 Resposta do cadastro:', data);

            if (response.ok) {
                return { 
                    success: true, 
                    message: data.message,
                    userId: data.userId 
                };
            } else {
                return { 
                    success: false, 
                    error: data.error || 'Erro no cadastro' 
                };
            }
        } catch (error) {
            console.error('❌ Erro na API de cadastro:', error);
            return { 
                success: false, 
                error: 'Erro de conexão com o servidor' 
            };
        }
    }

    async login(email, password) {
        try {
            console.log('📤 Enviando login para API:', { email });
            
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    senha: password
                })
            });

            const data = await response.json();
            console.log('📥 Resposta completa da API:', data);

            if (response.ok && data.success) {
                return { 
                    success: true, 
                    user: data.user, 
                    token: data.token 
                };
            } else {
                return { 
                    success: false, 
                    error: data.error || 'Erro no login' 
                };
            }
        } catch (error) {
            console.error('❌ Erro na API de login:', error);
            return { 
                success: false, 
                error: 'Erro de conexão com o servidor' 
            };
        }
    }

    async googleLogin(token) {
        try {
            console.log('📤 Enviando token Google para API...');
            
            const response = await fetch(`${this.baseURL}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: token })
            });

            const data = await response.json();
            console.log('📥 Resposta do Google OAuth:', data);

            if (response.ok) {
                return { 
                    success: true, 
                    user: data.user, 
                    token: data.token 
                };
            } else {
                return { 
                    success: false, 
                    error: data.error || 'Erro no login Google' 
                };
            }
        } catch (error) {
            console.error('❌ Erro na API Google OAuth:', error);
            return { 
                success: false, 
                error: 'Erro de conexão com o servidor' 
            };
        }
    }
}

// ✅ INSTÂNCIA GLOBAL
const api = new ApiService();
// aulas.js - Gerenciamento de Aulas
class AulasManager {
    constructor() {
        this.api = api; // Usando a instância global já existente
        this.currentUser = null;
    }

    setUser(user) {
        this.currentUser = user;
    }

    // Carregar aulas do usuário
    async carregarMinhasAulas() {
        try {
            if (!this.currentUser) {
                console.log('⚠️ Usuário não autenticado');
                return [];
            }

            console.log('📚 Carregando aulas para usuário:', this.currentUser.id);
            
            // Por enquanto vamos usar a rota geral de aulas
            // Depois podemos implementar a rota específica do usuário
            const response = await fetch(`${this.api.baseURL}/aulas`);
            const aulas = await response.json();

            if (response.ok) {
                this.renderizarAulas(aulas);
                return aulas;
            } else {
                throw new Error(aulas.error || 'Erro ao carregar aulas');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar aulas:', error);
            this.mostrarErro('Erro ao carregar aulas: ' + error.message);
            return [];
        }
    }

    // Renderizar aulas na interface
    renderizarAulas(aulas) {
        this.renderizarAulasMobile(aulas);
        this.renderizarAulasDesktop(aulas);
    }

    renderizarAulasMobile(aulas) {
        const container = document.querySelector('#aulas-mobile .aulas-list');
        if (!container) return;

        if (!aulas || aulas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open fa-3x"></i>
                    <p>Nenhuma aula encontrada</p>
                    <p class="empty-subtitle">Suas aulas aparecerão aqui</p>
                </div>
            `;
            return;
        }

        container.innerHTML = aulas.map(aula => this.criarCardAulaMobile(aula)).join('');
    }

    renderizarAulasDesktop(aulas) {
        const container = document.querySelector('#aulas-desktop .aulas-grid');
        if (!container) return;

        if (!aulas || aulas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open fa-3x"></i>
                    <p>Nenhuma aula encontrada</p>
                    <p class="empty-subtitle">Suas aulas aparecerão aqui</p>
                </div>
            `;
            return;
        }

        container.innerHTML = aulas.map(aula => this.criarCardAulaDesktop(aula)).join('');
    }

    // Criar cards de aula
    criarCardAulaMobile(aula) {
        const status = this.getStatusAula(aula);
        const dias = this.formatarDiasSemana(aula.dia_semana);
        
        return `
            <div class="aula-card" data-aula-id="${aula.id}">
                <div class="aula-header">
                    <h3>${aula.curso || 'Disciplina'}</h3>
                    <span class="status-badge ${status.classe}">
                        <i class="fas ${status.icone}"></i> ${status.texto}
                    </span>
                </div>
                <div class="aula-info">
                    <div class="info-item">
                        <span class="icon"><i class="fas fa-clock"></i></span>
                        <span>${aula.horario_inicio} - ${aula.horario_fim} | ${dias}</span>
                    </div>
                    <div class="info-item">
                        <span class="icon"><i class="fas fa-door-open"></i></span>
                        <span>Sala ${aula.sala_numero} - Bloco ${aula.sala_bloco}</span>
                    </div>
                    <div class="info-item">
                        <span class="icon"><i class="fas fa-chalkboard-teacher"></i></span>
                        <span>${aula.professor_nome || 'Professor'}</span>
                    </div>
                    <div class="info-item">
                        <span class="icon"><i class="fas fa-users"></i></span>
                        <span>Turma: ${aula.turma || 'N/A'}</span>
                    </div>
                </div>
                <div class="aula-actions">
                    <button class="btn-action" onclick="aulasManager.verDetalhesAula(${aula.id})">
                        <i class="fas fa-info-circle"></i> Ver detalhes
                    </button>
                    <button class="btn-action secundario" onclick="aulasManager.abrirMapaSala('${aula.sala_bloco}', ${this.getAndarSala(aula.sala_numero)}, '${aula.sala_numero}')">
                        <i class="fas fa-map-marker-alt"></i> Localizar sala
                    </button>
                </div>
            </div>
        `;
    }

    criarCardAulaDesktop(aula) {
        const status = this.getStatusAula(aula);
        
        return `
            <div class="aula-item" data-aula-id="${aula.id}">
                <div class="aula-badge ${status.classe}">
                    <i class="fas ${status.icone}"></i> ${status.texto}
                </div>
                <h4>${aula.curso || 'Disciplina'}</h4>
                <div class="aula-meta">
                    <span class="horario"><i class="fas fa-clock"></i> ${aula.horario_inicio}-${aula.horario_fim}</span>
                    <span class="sala"><i class="fas fa-door-open"></i> ${aula.sala_numero}-${aula.sala_bloco}</span>
                </div>
                <p class="professor"><i class="fas fa-chalkboard-teacher"></i> ${aula.professor_nome || 'Professor'}</p>
                <p class="dias"><i class="fas fa-calendar-day"></i> ${this.formatarDiasSemana(aula.dia_semana)}</p>
                <div class="aula-actions">
                    <button class="btn-action small" onclick="aulasManager.verDetalhesAula(${aula.id})">
                        <i class="fas fa-info-circle"></i> Detalhes
                    </button>
                    <button class="btn-action small secundario" onclick="aulasManager.abrirMapaSala('${aula.sala_bloco}', ${this.getAndarSala(aula.sala_numero)}, '${aula.sala_numero}')">
                        <i class="fas fa-map-marker-alt"></i> Mapa
                    </button>
                </div>
            </div>
        `;
    }

    // Utilitários
    getStatusAula(aula) {
        const agora = new Date();
        const horaAtual = agora.getHours() * 100 + agora.getMinutes();
        const [horaInicio] = aula.horario_inicio.split(':');
        const horaInicioNum = parseInt(horaInicio) * 100;
        
        if (horaAtual >= horaInicioNum && horaAtual < horaInicioNum + 200) {
            return { classe: 'em-andamento', texto: 'Agora', icone: 'fa-play-circle' };
        } else if (horaAtual < horaInicioNum) {
            return { classe: 'proxima', texto: 'Próxima', icone: 'fa-arrow-circle-right' };
        } else {
            return { classe: 'futura', texto: 'Futura', icone: 'fa-calendar-alt' };
        }
    }

    formatarDiasSemana(diaSemana) {
        const diasMap = {
            'segunda': 'Segunda',
            'terca': 'Terça', 
            'quarta': 'Quarta',
            'quinta': 'Quinta',
            'sexta': 'Sexta',
            'sabado': 'Sábado'
        };
        return diasMap[diaSemana] || diaSemana;
    }

    getAndarSala(numeroSala) {
        // Extrai o andar do número da sala (primeiro dígito)
        const andar = parseInt(numeroSala.charAt(0));
        return isNaN(andar) ? 1 : andar;
    }

    // Funcionalidades
    async verDetalhesAula(aulaId) {
        try {
            console.log('📖 Abrindo detalhes da aula:', aulaId);
            // Implementar modal de detalhes
            this.mostrarModalDetalhes(aulaId);
        } catch (error) {
            console.error('❌ Erro ao abrir detalhes:', error);
            this.mostrarErro('Erro ao carregar detalhes da aula');
        }
    }

    abrirMapaSala(bloco, andar, sala) {
        console.log('🗺️ Abrindo mapa para:', bloco, andar, sala);
        
        // Navegar para a seção de mapa
        showSection('mapa-blocos');
        
        // Navegar automaticamente para a sala específica
        setTimeout(() => {
            showAndares(bloco);
            setTimeout(() => {
                showSalas(andar);
                // Destacar a sala específica
                setTimeout(() => {
                    this.destacarSalaNoMapa(sala);
                }, 300);
            }, 500);
        }, 300);
    }

    destacarSalaNoMapa(numeroSala) {
        const salas = document.querySelectorAll('.sala-card');
        salas.forEach(sala => {
            const titulo = sala.querySelector('h4');
            if (titulo && titulo.textContent.includes(numeroSala)) {
                sala.style.border = '3px solid #3498db';
                sala.style.transform = 'scale(1.05)';
                sala.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    mostrarModalDetalhes(aulaId) {
        // Implementar modal com detalhes completos da aula
        alert(`Detalhes da aula ${aulaId}\n\nEm desenvolvimento...`);
    }

    mostrarErro(mensagem) {
        // Implementar toast de erro
        console.error('💥 Erro:', mensagem);
        alert(`Erro: ${mensagem}`);
    }

    // Filtros
    async filtrarAulas(filtro) {
        console.log('🔍 Filtrando aulas por:', filtro);
        const aulas = await this.carregarMinhasAulas();
        // Implementar lógica de filtro aqui
    }

    // Inicialização
    async init() {
        console.log('🚀 Inicializando AulasManager...');
        
        // Verificar se usuário está logado
        const userData = localStorage.getItem('unimap_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            console.log('👤 Usuário carregado:', this.currentUser);
            
            // Carregar aulas automaticamente
            await this.carregarMinhasAulas();
        } else {
            console.log('⚠️ Nenhum usuário logado');
        }
    }
}

// Instância global
const aulasManager = new AulasManager();

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    aulasManager.init();
});