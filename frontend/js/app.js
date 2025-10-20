// Gerenciamento de navegação entre telas
class UnimapApp {
    constructor() {
        this.currentSection = 'aulas-mobile';
        this.currentBloco = null;
        this.currentAndar = null;
        this.init();
    }

    init() {
        console.log('🚀 Inicializando UNIMAP App...');
        this.checkAuth();
        this.showSection('aulas-mobile');
        this.setupEventListeners();
        this.setupGlobalFunctions();
    }

    // ✅ ADICIONE ESTE MÉTODO para configurar funções globais
    setupGlobalFunctions() {
        // Tornar os métodos disponíveis globalmente
        window.showSection = (sectionId) => this.showSection(sectionId);
        window.showAndares = (bloco) => this.showAndares(bloco);
        window.showSalas = (andar) => this.showSalas(andar);
        window.openTab = (tabId) => this.openTab(tabId);
        window.logout = () => this.logout();
    }

    checkAuth() {
        const userData = localStorage.getItem('unimap_user');
        if (!userData) {
            console.log('⚠️ Usuário não autenticado');
            // Não redirecionar automaticamente para permitir teste
            // window.location.href = 'login.html';
            return;
        }
        
        this.user = JSON.parse(userData);
        this.updateUserInfo();
        this.checkAdminPermissions(); // ✅ ADICIONADO: Verificar permissões de admin
    }

    updateUserInfo() {
        const mobileUser = document.getElementById('mobileUserName');
        const desktopUser = document.getElementById('desktopUserName');
        const navUser = document.querySelector('.nav-user');
        
        if (mobileUser) mobileUser.textContent = this.user.nome;
        if (desktopUser) desktopUser.textContent = this.user.nome;
        if (navUser) navUser.textContent = this.user.nome;
    }

    // ✅ ADICIONADO: Método para verificar permissões de admin
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
        
        // 🔥 CORREÇÃO ESPECÍFICA PARA OS LINKS DO DASHBOARD
        const adminDashboardMobile = document.getElementById('admin-dashboard-mobile');
        const adminDashboardLink = document.getElementById('admin-dashboard-link');
        
        if (adminDashboardMobile) {
            adminDashboardMobile.style.display = isAdmin ? 'block' : 'none';
            console.log('📱 Dashboard mobile:', isAdmin ? 'visível' : 'oculto');
        }
        if (adminDashboardLink) {
            adminDashboardLink.style.display = isAdmin ? 'block' : 'none';
            console.log('💻 Dashboard desktop:', isAdmin ? 'visível' : 'oculto');
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
    }

    updateActiveNav(sectionId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Adicionar classe active ao link correspondente
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

    // 🔥 CORREÇÃO: Método showAndares atualizado
    showAndares(bloco) {
        console.log('🏢 Mostrando andares do bloco:', bloco);
        
        // Salvar bloco selecionado
        this.currentBloco = bloco;
        sessionStorage.setItem('blocoSelecionado', bloco);
        
        // Atualizar título
        const blocoTitle = document.getElementById('bloco-title');
        if (blocoTitle) {
            blocoTitle.textContent = `Bloco ${bloco}`;
        }
        this.showSection('mapa-andares');
    }

    // 🔥 CORREÇÃO COMPLETA: Método showSalas atualizado para funcionar com MapaManager
    async showSalas(andar) {
        console.log('🚪 Mostrando salas do andar:', andar);
        
        const bloco = this.currentBloco || sessionStorage.getItem('blocoSelecionado') || 'A';
        this.currentAndar = andar;
        
        // Mostrar loading
        this.showLoadingSalas(bloco, andar);
        
        // 🔥 AGUARDAR O MAPA MANAGER CARREGAR
        if (typeof mapaManager !== 'undefined') {
            try {
                // Se não tem salas carregadas, força carregar
                if (mapaManager.salas.length === 0) {
                    console.log('🔄 Forçando carregamento de salas...');
                    await mapaManager.carregarSalas();
                }
                
                // Usar o mapaManager para mostrar as salas
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

    // 🔥 ADICIONADO: Método para mostrar loading das salas
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

    // 🔥 ADICIONADO: Método para mostrar erro das salas
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
        
        // Esconder todas as abas
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remover active de todos os botões
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Mostrar aba selecionada
        const tabToShow = document.getElementById(tabId);
        if (tabToShow) {
            tabToShow.classList.add('active');
        }

        // Ativar botão clicado
        if (event && event.target) {
            event.target.classList.add('active');
        }
    }

    // ✅ ADICIONE ESTE MÉTODO para o menu mobile
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
        window.location.href = 'login.html';
    }
}

// ✅ MANTENHA as funções globais, mas mais robustas
function showSection(sectionId) {
    console.log('🎯 Mostrando seção:', sectionId);
    
    // Esconder todas as seções
    const allSections = document.querySelectorAll('.section, .mobile-section, .desktop-section');
    allSections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // Mostrar a seção específica
    let sectionToShow;
    
    // Verificar se é mobile ou desktop
    if (window.innerWidth <= 768) {
        // MOBILE - PRIORIDADE para versão mobile
        sectionToShow = document.getElementById(sectionId + '-mobile') || document.getElementById(sectionId);
    } else {
        // DESKTOP - PRIORIDADE para versão desktop  
        sectionToShow = document.getElementById(sectionId + '-desktop') || document.getElementById(sectionId);
    }
    
    // Se não encontrou, tenta o ID direto
    if (!sectionToShow) {
        sectionToShow = document.getElementById(sectionId);
    }
    
    if (sectionToShow) {
        sectionToShow.style.display = 'block';
        sectionToShow.classList.add('active');
        console.log('✅ Seção mostrada:', sectionToShow.id);
        
        // 🔥 CORREÇÃO COMPLETA: Forçar recarregamento das aulas em MOBILE e DESKTOP
        if ((sectionId === 'aulas' || sectionId === 'aulas-mobile' || sectionId === 'aulas-desktop') && typeof aulasManager !== 'undefined') {
            console.log('🔄 Recarregando aulas automaticamente...');
            setTimeout(() => {
                aulasManager.carregarMinhasAulas().then(() => {
                    console.log('✅ Aulas recarregadas com sucesso');
                }).catch(error => {
                    console.error('❌ Erro ao recarregar aulas:', error);
                });
            }, 150);
        }
        
        // 🔥 CORREÇÃO: Também recarregar professores quando abrir a seção
        if ((sectionId === 'professores') && typeof professoresManager !== 'undefined') {
            console.log('🔄 Recarregando professores...');
            setTimeout(() => {
                professoresManager.loadMeusProfessores(); // Recarregar favoritos
            }, 150);
        }
    } else {
        console.error('❌ Seção não encontrada:', sectionId);
    }
    
    // Fechar menu mobile se estiver aberto
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav) {
        mobileNav.classList.remove('active');
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
        window.location.href = 'login.html';
    }
}

// ✅ ADICIONE funções para aulas (que estão no HTML)
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
    
    // Navegar para o mapa
    showSection('mapa-blocos');
    
    // Navegar automaticamente para a sala
    setTimeout(() => {
        showAndares(bloco);
        setTimeout(() => {
            showSalas(andar);
        }, 300);
    }, 300);
}

// ✅ Inicializar app quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM carregado, inicializando app...');
    window.app = new UnimapApp();
});

// Detectar mudança de tamanho de tela
window.addEventListener('resize', () => {
    if (window.app) {
        if (window.innerWidth >= 768 && window.app.currentSection === 'aulas-mobile') {
            window.app.showSection('aulas-desktop');
        } else if (window.innerWidth < 768 && window.app.currentSection === 'aulas-desktop') {
            window.app.showSection('aulas-mobile');
        }
    }
});

// 🔧 ADICIONADO: Funções de debug para o mapa
window.debugApp = function() {
    console.log('🔍 DEBUG App:');
    console.log('- Seção atual:', window.app?.currentSection);
    console.log('- Bloco atual:', window.app?.currentBloco);
    console.log('- Andar atual:', window.app?.currentAndar);
    console.log('- MapaManager:', typeof mapaManager !== 'undefined' ? '✅ Carregado' : '❌ Não carregado');
    if (typeof mapaManager !== 'undefined') {
        console.log('- Salas carregadas:', mapaManager.salas.length);
    }
};

window.testarMapa = function(bloco = 'A', andar = 1) {
    console.log(`🧪 Testando mapa: Bloco ${bloco}, Andar ${andar}`);
    if (window.app) {
        window.app.showAndares(bloco);
        setTimeout(() => {
            window.app.showSalas(andar);
        }, 300);
    }
};

// 🔐 FUNÇÃO PARA VERIFICAR E MOSTRAR OPÇÕES DE ADMIN
function checkAndShowAdminOptions() {
    console.log('🔍 Verificando permissões de admin...');
    
    const userData = localStorage.getItem('userData');
    
    if (!userData) {
        console.log('⚠️ Nenhum usuário logado');
        hideAdminOptions();
        return false;
    }
    
    try {
        const user = JSON.parse(userData);
        console.log('👤 Usuário:', user.nome, '- Tipo:', user.tipo);
        
        const isAdmin = user.tipo === 'admin';
        
        if (isAdmin) {
            showAdminOptions();
            updateUserBadge(user);
            console.log('✅ Admin detectado - Mostrando dashboard');
        } else {
            hideAdminOptions();
            console.log('ℹ️ Usuário normal - Ocultando dashboard');
        }
        
        return isAdmin;
        
    } catch (error) {
        console.error('❌ Erro ao verificar permissões:', error);
        hideAdminOptions();
        return false;
    }
}

// 👑 MOSTRAR OPÇÕES DE ADMIN
function showAdminOptions() {
    const adminLinks = document.querySelectorAll('.admin-only');
    adminLinks.forEach(link => {
        link.style.display = 'block';
    });
}

// 🚫 OCULTAR OPÇÕES DE ADMIN
function hideAdminOptions() {
    const adminLinks = document.querySelectorAll('.admin-only');
    adminLinks.forEach(link => {
        link.style.display = 'none';
    });
}

// 🏷️ ATUALIZAR BADGE DO USUÁRIO
function updateUserBadge(user) {
    const desktopUser = document.getElementById('desktopUserName');
    const mobileUser = document.querySelector('.nav-user');
    
    if (user.tipo === 'admin') {
        if (desktopUser) {
            desktopUser.innerHTML = `${user.nome} <span class="user-type-badge admin">ADMIN</span>`;
        }
        if (mobileUser) {
            mobileUser.innerHTML = `${user.nome} <span class="user-type-badge admin">ADMIN</span>`;
        }
    } else {
        if (desktopUser) {
            desktopUser.textContent = user.nome;
        }
        if (mobileUser) {
            mobileUser.textContent = user.nome;
        }
    }
}

// 🔒 PROTEGER PÁGINAS ADMIN
function protectAdminPages() {
    if (!window.location.pathname.includes('admin')) return;
    
    const userData = localStorage.getItem('userData');
    
    if (!userData) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        
        if (user.tipo !== 'admin') {
            alert('❌ Acesso restrito a administradores!');
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        window.location.href = 'login.html';
    }
}

// 📄 ATUALIZAR A INICIALIZAÇÃO DO APP
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado, inicializando app...');
    
    // 🔐 Verificar autenticação e permissões
    const userData = localStorage.getItem('userData');
    const token = localStorage.getItem('authToken');
    
    if (userData && token) {
        try {
            const user = JSON.parse(userData);
            console.log('👋 Usuário logado:', user.nome);
            
            // ✅ ATUALIZAR NOME DO USUÁRIO NA INTERFACE
            updateUserInterface(user);
            
            // ✅ VERIFICAR SE É ADMIN E MOSTRAR DASHBOARD
            checkAndShowAdminOptions();
            
        } catch (error) {
            console.error('❌ Erro ao carregar usuário:', error);
        }
    } else {
        console.log('👤 Usuário não autenticado');
    }
    
    // 🔒 PROTEGER PÁGINAS ADMIN (se estiver em uma)
    protectAdminPages();
    
    // 🚀 INICIALIZAR MANAGERS
    if (typeof aulasManager !== 'undefined') {
        aulasManager.init();
    }
    
    if (typeof professoresManager !== 'undefined') {
        setTimeout(() => {
            professoresManager.init();
        }, 100);
    }
});

// 👤 ATUALIZAR INTERFACE COM DADOS DO USUÁRIO
function updateUserInterface(user) {
    // Desktop
    const desktopUserName = document.getElementById('desktopUserName');
    const mobileUserName = document.getElementById('mobileUserName');
    const navUser = document.querySelector('.nav-user');
    
    if (desktopUserName) desktopUserName.textContent = user.nome;
    if (mobileUserName) mobileUserName.textContent = user.nome;
    if (navUser) navUser.textContent = user.nome;
}

// 🚪 FUNÇÃO LOGOUT (se não existir)
function logout() {
    if (typeof authManager !== 'undefined') {
        authManager.logout();
    } else {
        // Fallback simples
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = 'login.html';
    }
}
