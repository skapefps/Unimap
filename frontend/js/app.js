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
    }

    updateUserInfo() {
        const mobileUser = document.getElementById('mobileUserName');
        const desktopUser = document.getElementById('desktopUserName');
        const navUser = document.querySelector('.nav-user');
        
        if (mobileUser) mobileUser.textContent = this.user.nome;
        if (desktopUser) desktopUser.textContent = this.user.nome;
        if (navUser) navUser.textContent = this.user.nome;
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

    showAndares(bloco) {
        this.currentBloco = bloco;
        const blocoTitle = document.getElementById('bloco-title');
        if (blocoTitle) {
            blocoTitle.textContent = `Bloco ${bloco}`;
        }
        this.showSection('mapa-andares');
    }

    showSalas(andar) {
        this.currentAndar = andar;
        const salaTitle = document.getElementById('sala-title');
        if (salaTitle && this.currentBloco) {
            salaTitle.textContent = `Bloco ${this.currentBloco} > ${andar}° Andar`;
        }
        this.showSection('mapa-salas');
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