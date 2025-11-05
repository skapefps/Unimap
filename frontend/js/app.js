// app.js - UNIMAP App Completo com Mapa Dinâmico para Aluno
class UnimapApp {
    constructor() {
        this.currentSection = 'aulas-mobile';
        this.currentBloco = null;
        this.currentAndar = null;
        this.blocosData = [];
        this.init();
    }

    init() {
        console.log('🚀 Inicializando UNIMAP App...');

        // 🔥 CORREÇÃO: Verificar autenticação primeiro
        this.checkAuthAndRedirect();
        this.showSection('aulas-mobile');
        this.setupEventListeners();
        this.setupGlobalFunctions();
        this.initMapaAluno();
    }

    checkAuthAndRedirect() {
        const userData = localStorage.getItem('unimap_user') || localStorage.getItem('userData');
        const token = localStorage.getItem('authToken');

        if (!userData || !token) {
            console.log('🔐 Usuário não autenticado - Redirecionando para login');
            window.location.href = 'login.html';
            return;
        }

        try {
            this.user = JSON.parse(userData);
            this.updateUserInfo();
            this.checkAdminPermissions();
        } catch (error) {
            console.error('❌ Erro ao carregar usuário:', error);
            localStorage.removeItem('unimap_user');
            localStorage.removeItem('userData');
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }

    // ✅ CONFIGURAR FUNÇÕES GLOBAIS
    setupGlobalFunctions() {
        window.showSection = (sectionId) => this.showSection(sectionId);
        window.showAndares = (bloco) => this.showAndares(bloco);
        window.showSalas = (andar) => this.showSalas(andar);
        window.openTab = (tabId) => this.openTab(tabId);
        window.logout = () => this.logout();
        window.voltarParaBlocosAluno = () => this.voltarParaBlocosAluno();
        window.voltarParaAndaresAluno = () => this.voltarParaAndaresAluno();
    }

    checkAuth() {
        const userData = localStorage.getItem('unimap_user') || localStorage.getItem('userData');
        if (!userData) {
            console.log('⚠️ Usuário não autenticado');
            return;
        }

        try {
            this.user = JSON.parse(userData);
            this.updateUserInfo();
            this.checkAdminPermissions();
        } catch (error) {
            console.error('❌ Erro ao carregar usuário:', error);
        }
    }

    updateUserInfo() {
        const mobileUser = document.getElementById('mobileUserName');
        const desktopUser = document.getElementById('desktopUserName');
        const navUser = document.querySelector('.nav-user');

        if (mobileUser) mobileUser.textContent = this.user?.nome || 'Usuário';
        if (desktopUser) desktopUser.textContent = this.user?.nome || 'Usuário';
        if (navUser) navUser.textContent = this.user?.nome || 'Usuário';
    }

    checkAdminPermissions() {
        console.log('🔍 Verificando permissões de admin...');

        if (!this.user) {
            console.log('⚠️ Nenhum usuário para verificar permissões');
            return;
        }

        console.log('👤 Usuário:', this.user.nome, '- Tipo:', this.user.tipo);

        const isAdmin = this.user.tipo === 'admin' || this.user.tipo === 'professor';
        console.log(`🎯 É admin/professor: ${isAdmin}`);

        // Mostrar/ocultar elementos admin
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(element => {
            element.style.display = isAdmin ? 'block' : 'none';
        });

        const adminDashboardMobile = document.getElementById('admin-dashboard-mobile');
        const adminDashboardLink = document.getElementById('admin-dashboard-link');

        if (adminDashboardMobile) {
            adminDashboardMobile.style.display = isAdmin ? 'block' : 'none';
        }
        if (adminDashboardLink) {
            adminDashboardLink.style.display = isAdmin ? 'block' : 'none';
        }
    }

    setupEventListeners() {
        // Navegação inicial baseada no tamanho da tela
        if (window.innerWidth >= 768) {
            this.showSection('aulas-desktop');
        }
    }

    showSection(sectionId) {
        console.log('📱 Mostrando seção:', sectionId);

        // Esconder todas as seções
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });

        // Mostrar seção selecionada
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.add('active');
            this.currentSection = sectionId;
        }

        // Atualizar navegação ativa
        this.updateActiveNav(sectionId);

        // Fechar menu mobile se estiver aberto
        this.closeMenu();

        // 🔥 CARREGAR DADOS AUTOMATICAMENTE
        this.carregarDadosDaSecao(sectionId);
    }

    carregarDadosDaSecao(sectionId) {
        switch (sectionId) {
            case 'aulas-mobile':
            case 'aulas-desktop':
                if (typeof aulasManager !== 'undefined') {
                    setTimeout(() => {
                        aulasManager.carregarMinhasAulas().catch(error => {
                            console.error('❌ Erro ao recarregar aulas:', error);
                        });
                    }, 150);
                }
                break;
            case 'professores':
                if (typeof professoresManager !== 'undefined') {
                    setTimeout(() => {
                        // ✅ CORREÇÃO: Verificar se a função existe antes de chamar
                        if (professoresManager.loadMeusProfessores) {
                            professoresManager.loadMeusProfessores();
                        } else {
                            console.warn('⚠️ professoresManager.loadMeusProfessores não existe');
                            // Tentar carregar de outra forma
                            professoresManager.init();
                        }
                    }, 150);
                }
                break;
            case 'mapa-blocos':
                // Já carregado pelo initMapaAluno()
                break;
        }
    }

    updateActiveNav(sectionId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const correspondingLink = this.getCorrespondingNavLink(sectionId);
        if (correspondingLink) {
            correspondingLink.classList.add('active');
        }
    }

    getCorrespondingNavLink(sectionId) {
        const navMap = {
            'aulas-mobile': 'aulas',
            'aulas-desktop': 'aulas',
            'mapa-blocos': 'mapa',
            'professores': 'professores'
        };

        const targetNav = navMap[sectionId];
        if (targetNav) {
            return document.querySelector(`[onclick*="${targetNav}"]`);
        }
        return null;
    }

    // ==================== SISTEMA DE MAPA DO ALUNO ====================

    // ✅ INICIALIZAR MAPA DO ALUNO
    initMapaAluno() {
        console.log('🗺️ Inicializando mapa do aluno...');
        this.carregarBlocosAluno();
        this.configurarEventosMapaAluno();
    }

    // ✅ CARREGAR BLOCOS PARA ALUNO
    async carregarBlocosAluno() {
        try {
            console.log('📡 Carregando blocos para aluno...');

            // Usar a API global se disponível, senão fazer fetch direto
            let blocos;
            if (typeof api !== 'undefined' && api.getBlocos) {
                const result = await api.getBlocos();
                if (result && result.success) {
                    blocos = result.data;
                } else {
                    throw new Error(result?.error || 'Erro na API');
                }
            } else {
                // Fallback: fetch direto
                const token = localStorage.getItem('authToken') || localStorage.getItem('unimap_token');
                const response = await fetch('/api/salas/blocos', {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });

                if (!response.ok) throw new Error('Erro na requisição');
                blocos = await response.json();
            }

            console.log('✅ Blocos carregados para aluno:', blocos);
            this.blocosData = blocos;
            this.renderizarBlocosAluno(blocos);

        } catch (error) {
            console.error('❌ Erro ao carregar blocos para aluno:', error);
            this.usarBlocosPadraoAluno();
        }
    }

    // ✅ RENDERIZAR BLOCOS PARA ALUNO
    renderizarBlocosAluno(blocos) {
        const container = document.getElementById('blocos-grid-aluno');
        if (!container) {
            console.log('⚠️ Container de blocos do aluno não encontrado');
            return;
        }

        if (!blocos || blocos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-building fa-3x"></i>
                    <p>Nenhum bloco encontrado</p>
                </div>
            `;
            return;
        }

        container.innerHTML = blocos.map(bloco => `
            <div class="bloco-card" onclick="app.selecionarBlocoAluno('${bloco.letra}')">
                <div class="bloco-icon">
                    <i class="fas fa-building"></i>
                </div>
                <h3>Bloco ${bloco.letra}</h3>
                <div class="bloco-stats">
                    <span class="stat">${bloco.total_salas} salas</span>
                    <span class="stat">${bloco.total_andares} andares</span>
                </div>
                <div class="bloco-badge">
                    ${bloco.total_salas} salas
                </div>
            </div>
        `).join('');

        console.log(`✅ ${blocos.length} blocos renderizados para aluno`);
    }

    // ✅ FALLBACK PARA BLOCOS
    usarBlocosPadraoAluno() {
        console.log('🔄 Usando blocos padrão para aluno...');
        const blocosPadrao = [
            { letra: 'A', total_salas: 58, total_andares: 4 },
            { letra: 'B', total_salas: 46, total_andares: 4 },
            { letra: 'C', total_salas: 45, total_andares: 4 },
            { letra: 'D', total_salas: 48, total_andares: 4 },
            { letra: 'E', total_salas: 84, total_andares: 4 },
            { letra: 'F', total_salas: 87, total_andares: 4 },
            { letra: 'G', total_salas: 87, total_andares: 4 },
            { letra: 'H', total_salas: 81, total_andares: 4 },
            { letra: 'I', total_salas: 82, total_andares: 4 },
            { letra: 'J', total_salas: 82, total_andares: 4 },
            { letra: 'K', total_salas: 82, total_andares: 4 },
            { letra: 'L', total_salas: 79, total_andares: 4 },
            { letra: 'M', total_salas: 84, total_andares: 4 },
            { letra: 'N', total_salas: 83, total_andares: 4 }
        ];
        this.renderizarBlocosAluno(blocosPadrao);
    }

    // ✅ SELECIONAR BLOCO (ALUNO)
    async selecionarBlocoAluno(bloco) {
        console.log(`🏢 Aluno selecionando bloco: ${bloco}`);
        this.currentBloco = bloco;
        sessionStorage.setItem('blocoSelecionado', bloco);

        // Atualizar título
        const blocoTitle = document.getElementById('bloco-title-aluno');
        if (blocoTitle) {
            blocoTitle.textContent = `Bloco ${bloco}`;
        }

        // Mostrar loading
        this.showLoadingAndaresAluno(bloco);

        // Carregar andares
        await this.carregarAndaresAluno(bloco);
    }

    // ✅ CARREGAR ANDARES (ALUNO)
    async carregarAndaresAluno(bloco) {
        try {
            console.log(`📡 Carregando andares do bloco ${bloco} para aluno...`);

            let andares;
            if (typeof api !== 'undefined' && api.getAndaresPorBloco) {
                const result = await api.getAndaresPorBloco(bloco);
                if (result && result.success) {
                    andares = result.data;
                } else {
                    throw new Error(result?.error || 'Erro na API');
                }
            } else {
                // Fallback: fetch direto
                const token = localStorage.getItem('authToken') || localStorage.getItem('unimap_token');
                const response = await fetch(`/api/salas/bloco/${bloco}/andares`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });

                if (!response.ok) throw new Error('Erro na requisição');
                andares = await response.json();
            }

            console.log(`✅ Andares carregados para aluno:`, andares);
            this.renderizarAndaresAluno(andares);
            this.showSection('mapa-andares');

        } catch (error) {
            console.error('❌ Erro ao carregar andares para aluno:', error);
            this.showErrorAndaresAluno('Erro ao carregar andares: ' + error.message);
        }
    }

    // ✅ RENDERIZAR ANDARES (ALUNO)
    renderizarAndaresAluno(andares) {
        const container = document.getElementById('andares-grid-aluno');
        if (!container) return;

        if (!andares || andares.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-door-closed fa-3x"></i>
                    <p>Nenhum andar encontrado</p>
                </div>
            `;
            return;
        }

        container.innerHTML = andares.map(andar => `
            <div class="andar-card" onclick="app.selecionarAndarAluno('${andar}')">
                <div class="andar-icon">
                    <i class="fas fa-layer-group"></i>
                </div>
                <h4>${andar}</h4>
                <p>Clique para ver as salas</p>
            </div>
        `).join('');

        console.log(`✅ ${andares.length} andares renderizados para aluno`);
    }

    // ✅ SELECIONAR ANDAR (ALUNO)
    async selecionarAndarAluno(andar) {
        console.log(`🚪 Aluno selecionando andar: ${andar}`);
        const bloco = this.currentBloco || sessionStorage.getItem('blocoSelecionado') || 'A';
        this.currentAndar = andar;

        // Mostrar loading
        this.showLoadingSalasAluno(bloco, andar);

        // Usar o MapaManager existente para mostrar salas
        if (typeof mapaManager !== 'undefined') {
            try {
                // Garantir que as salas estão carregadas
                if (mapaManager.salas.length === 0) {
                    console.log('🔄 Carregando salas...');
                    await mapaManager.carregarSalas();
                }

                // Mostrar salas usando o MapaManager
                await mapaManager.mostrarSalas(bloco, andar);
                this.mostrarFiltrosSalas();

            } catch (error) {
                console.error('❌ Erro ao carregar salas:', error);
                this.showErrorSalasAluno('Erro ao carregar salas: ' + error.message);
            }
        } else {
            console.error('❌ MapaManager não encontrado');
            this.showErrorSalasAluno('Sistema de mapa não carregado');
        }
    }

    // ✅ MOSTRAR FILTROS DE SALAS
    mostrarFiltrosSalas() {
        const filters = document.getElementById('salas-filters');
        if (filters) {
            filters.style.display = 'flex';
        }
    }

    // ✅ LOADING ANDARES (ALUNO)
    showLoadingAndaresAluno(bloco) {
        const container = document.getElementById('andares-grid-aluno');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin fa-3x"></i>
                    <p>Carregando andares do Bloco ${bloco}...</p>
                </div>
            `;
        }
        this.showSection('mapa-andares');
    }

    // ✅ LOADING SALAS (ALUNO)
    showLoadingSalasAluno(bloco, andar) {
        const container = document.getElementById('salas-grid-aluno');
        const title = document.getElementById('sala-title');

        if (title) {
            title.innerHTML = `Bloco ${bloco} > ${andar}° Andar <span class="salas-counter">carregando...</span>`;
        }

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin fa-3x"></i>
                    <p>Carregando salas...</p>
                </div>
            `;
        }

        // Esconder filtros durante o loading
        const filters = document.getElementById('salas-filters');
        if (filters) {
            filters.style.display = 'none';
        }

        this.showSection('mapa-salas');
    }

    // ✅ ERRO ANDARES (ALUNO)
    showErrorAndaresAluno(message) {
        const container = document.getElementById('andares-grid-aluno');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <p>${message}</p>
                    <button class="btn-primary" onclick="app.carregarBlocosAluno()">
                        <i class="fas fa-redo"></i> Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    // ✅ ERRO SALAS (ALUNO)
    showErrorSalasAluno(message) {
        const container = document.getElementById('salas-grid-aluno');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <p>${message}</p>
                    <button class="btn-primary" onclick="app.recarregarMapaAluno()">
                        <i class="fas fa-redo"></i> Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    // ✅ RECARREGAR MAPA (ALUNO)
    async recarregarMapaAluno() {
        console.log('🔄 Recarregando mapa para aluno...');
        if (typeof mapaManager !== 'undefined') {
            await mapaManager.forcarRecarregamento();
            const bloco = this.currentBloco || 'A';
            const andar = this.currentAndar || '1º Andar';
            await this.selecionarAndarAluno(andar);
        } else {
            this.carregarBlocosAluno();
        }
    }

    // ✅ CONFIGURAR EVENTOS DO MAPA (ALUNO)
    configurarEventosMapaAluno() {
        // Filtro de pesquisa de salas
        const searchInput = document.getElementById('searchSalaAluno');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filtrarSalasAluno(e.target.value);
            });
        }

        // Filtro de tipo de sala
        const tipoFilter = document.getElementById('filterTipoSalaAluno');
        if (tipoFilter) {
            tipoFilter.addEventListener('change', (e) => {
                this.filtrarSalasPorTipoAluno(e.target.value);
            });
        }
    }

    // ✅ FILTRAR SALAS POR TEXTO (ALUNO)
    filtrarSalasAluno(termo) {
        const salas = document.querySelectorAll('#salas-grid-aluno .sala-card');
        const termoLower = termo.toLowerCase();

        salas.forEach(sala => {
            const texto = sala.textContent.toLowerCase();
            sala.style.display = texto.includes(termoLower) ? 'block' : 'none';
        });
    }

    // ✅ FILTRAR SALAS POR TIPO (ALUNO)
    filtrarSalasPorTipoAluno(tipo) {
        const salas = document.querySelectorAll('#salas-grid-aluno .sala-card');

        salas.forEach(sala => {
            if (!tipo) {
                sala.style.display = 'block';
                return;
            }

            const tipoElement = sala.querySelector('p:nth-child(1)');
            if (tipoElement) {
                const tipoTexto = tipoElement.textContent.toLowerCase();
                sala.style.display = tipoTexto.includes(tipo.toLowerCase()) ? 'block' : 'none';
            }
        });
    }

    // ✅ VOLTAR PARA BLOCOS (ALUNO)
    voltarParaBlocosAluno() {
        this.showSection('mapa-blocos');
        this.currentBloco = null;
    }

    // ✅ VOLTAR PARA ANDARES (ALUNO)
    voltarParaAndaresAluno() {
        this.showSection('mapa-andares');
        this.currentAndar = null;
    }

    // ==================== MÉTODOS ORIGINAIS (COMPATIBILIDADE) ====================

    showAndares(bloco) {
        console.log('🏢 Mostrando andares do bloco:', bloco);
        this.currentBloco = bloco;
        sessionStorage.setItem('blocoSelecionado', bloco);

        const blocoTitle = document.getElementById('bloco-title');
        if (blocoTitle) {
            blocoTitle.textContent = `Bloco ${bloco}`;
        }
        this.showSection('mapa-andares');
    }

    async showSalas(andar) {
        console.log('🚪 Mostrando salas do andar:', andar);

        const bloco = this.currentBloco || sessionStorage.getItem('blocoSelecionado') || 'A';
        this.currentAndar = andar;

        this.showLoadingSalas(bloco, andar);

        if (typeof mapaManager !== 'undefined') {
            try {
                if (mapaManager.salas.length === 0) {
                    console.log('🔄 Forçando carregamento de salas...');
                    await mapaManager.carregarSalas();
                }

                await mapaManager.mostrarSalas(bloco, andar);
                this.showSection('mapa-salas');

            } catch (error) {
                console.error('❌ Erro ao carregar salas:', error);
                this.showErrorSalas('Erro ao carregar salas: ' + error.message);
            }
        } else {
            console.error('❌ MapaManager não encontrado');
            this.showErrorSalas('Sistema de mapa não carregado');
        }
    }

    showLoadingSalas(bloco, andar) {
        const container = document.querySelector('#mapa-salas .salas-grid');
        const title = document.getElementById('sala-title');

        if (title) {
            title.innerHTML = `Bloco ${bloco} > ${andar}° Andar <span class="salas-counter">carregando...</span>`;
        }

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin fa-3x"></i>
                    <p>Carregando salas...</p>
                </div>
            `;
        }

        this.showSection('mapa-salas');
    }

    showErrorSalas(message) {
        const container = document.querySelector('#mapa-salas .salas-grid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <p>${message}</p>
                    <button class="btn-primary" onclick="recarregarMapa()">
                        <i class="fas fa-redo"></i> Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    openTab(tabId) {
        console.log('📑 Abrindo aba:', tabId);

        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const tabToShow = document.getElementById(tabId);
        if (tabToShow) {
            tabToShow.classList.add('active');
        }

        if (event && event.target) {
            event.target.classList.add('active');
        }
    }

    closeMenu() {
        const nav = document.getElementById('mobileNav');
        if (nav) {
            nav.classList.remove('active');
        }
    }

    logout() {
        console.log('👋 Fazendo logout...');
        localStorage.removeItem('unimap_user');
        localStorage.removeItem('unimap_token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = 'login.html';
    }
}

// ==================== FUNÇÕES GLOBAIS ====================

function showSection(sectionId) {
    if (window.app) {
        window.app.showSection(sectionId);
    } else {
        console.error('❌ App não inicializado');
    }
}

function toggleMenu() {
    const nav = document.getElementById('mobileNav');
    if (nav) {
        nav.classList.toggle('active');
    }
}

function showAndares(bloco) {
    if (window.app) {
        window.app.showAndares(bloco);
    }
}

function showSalas(andar) {
    if (window.app) {
        window.app.showSalas(andar);
    }
}

function openTab(tabId) {
    if (window.app) {
        window.app.openTab(tabId);
    }
}

function logout() {
    if (window.app) {
        window.app.logout();
    } else {
        localStorage.removeItem('unimap_user');
        localStorage.removeItem('unimap_token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = 'login.html';
    }
}

// ✅ FUNÇÕES PARA AULAS (compatibilidade)
function filtrarAulas(filtro) {
    console.log('🔍 Filtrando aulas:', filtro);
    alert(`Filtrando por: ${filtro} - Em desenvolvimento`);
}

function filtrarAulasDesktop(filtro) {
    console.log('🔍 Filtrando aulas desktop:', filtro);
    alert(`Filtrando por: ${filtro} - Em desenvolvimento`);
}

function verDetalhesAula(idAula) {
    console.log('📖 Ver detalhes da aula:', idAula);
    alert(`Detalhes da aula ${idAula}\n\nEm desenvolvimento...`);
}

function abrirMapaSala(bloco, andar, sala) {
    console.log('🗺️ Abrindo mapa para:', bloco, andar, sala);

    showSection('mapa-blocos');

    setTimeout(() => {
        showAndares(bloco);
        setTimeout(() => {
            showSalas(andar);
        }, 300);
    }, 300);
}

// ✅ FUNÇÕES DE NAVEGAÇÃO DO MAPA (ALUNO) - GLOBAIS
function voltarParaBlocosAluno() {
    if (window.app) {
        window.app.voltarParaBlocosAluno();
    }
}

function voltarParaAndaresAluno() {
    if (window.app) {
        window.app.voltarParaAndaresAluno();
    }
}

// ✅ DETECTAR MUDANÇA DE TELA
window.addEventListener('resize', () => {
    if (window.app) {
        if (window.innerWidth >= 768 && window.app.currentSection === 'aulas-mobile') {
            window.app.showSection('aulas-desktop');
        } else if (window.innerWidth < 768 && window.app.currentSection === 'aulas-desktop') {
            window.app.showSection('aulas-mobile');
        }
    }
});

// ✅ FUNÇÕES DE DEBUG
window.debugApp = function () {
    console.log('🔍 DEBUG App:');
    console.log('- Seção atual:', window.app?.currentSection);
    console.log('- Bloco atual:', window.app?.currentBloco);
    console.log('- Andar atual:', window.app?.currentAndar);
    console.log('- Blocos carregados:', window.app?.blocosData?.length || 0);
    console.log('- MapaManager:', typeof mapaManager !== 'undefined' ? '✅ Carregado' : '❌ Não carregado');
    if (typeof mapaManager !== 'undefined') {
        console.log('- Salas carregadas:', mapaManager.salas.length);
    }
};

window.testarMapa = function (bloco = 'A', andar = '1º Andar') {
    console.log(`🧪 Testando mapa: Bloco ${bloco}, Andar ${andar}`);
    if (window.app) {
        window.app.selecionarBlocoAluno(bloco);
        setTimeout(() => {
            window.app.selecionarAndarAluno(andar);
        }, 500);
    }
};

// ✅ INICIALIZAÇÃO
window.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM carregado, inicializando app...');
    window.app = new UnimapApp();

    // Inicializar managers se existirem
    if (typeof aulasManager !== 'undefined') {
        aulasManager.init();
    }

    if (typeof professoresManager !== 'undefined') {
        setTimeout(() => {
            professoresManager.init();
        }, 100);
    }
});
