// Gerenciamento de navegação entre telas
class UnimapApp {
    constructor() {
        this.currentSection = 'aulas-mobile';
        this.currentBloco = null;
        this.currentAndar = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.showSection('aulas-mobile');
        this.setupEventListeners();
    }

    checkAuth() {
        const userData = localStorage.getItem('unimap_user');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }
        
        this.user = JSON.parse(userData);
        this.updateUserInfo();
    }

    updateUserInfo() {
        const mobileUser = document.getElementById('mobileUserName');
        const desktopUser = document.getElementById('desktopUserName');
        
        if (mobileUser) mobileUser.textContent = this.user.nome;
        if (desktopUser) desktopUser.textContent = this.user.nome;
    }

    setupEventListeners() {
        // Navegação inicial
        if (window.innerWidth >= 768) {
            this.showSection('aulas-desktop');
        }
    }

    showSection(sectionId) {
        // Esconder todas as seções
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
        });

        // Mostrar seção selecionada
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            this.currentSection = sectionId;
        }

        // Atualizar navegação ativa
        this.updateActiveNav(sectionId);
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
            return document.querySelector(`[onclick="showSection('${targetNav}')"]`);
        }
        return null;
    }

    showAndares(bloco) {
        this.currentBloco = bloco;
        document.getElementById('bloco-title').textContent = `Bloco ${bloco}`;
        this.showSection('mapa-andares');
    }

    showSalas(andar) {
        this.currentAndar = andar;
        document.getElementById('sala-title').textContent = 
            `Bloco ${this.currentBloco} > ${andar}° Andar`;
        this.showSection('mapa-salas');
    }

    openTab(tabId) {
        // Esconder todas as abas
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remover active de todos os botões
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Mostrar aba selecionada
        document.getElementById(tabId).classList.add('active');
        event.target.classList.add('active');
    }
}

// Funções globais para uso no HTML
function showSection(sectionId) {
    window.app.showSection(sectionId);
}

function toggleMenu() {
    const nav = document.getElementById('mobileNav');
    nav.classList.toggle('active');
}

function showAndares(bloco) {
    window.app.showAndares(bloco);
}

function showSalas(andar) {
    window.app.showSalas(andar);
}

function openTab(tabId) {
    window.app.openTab(tabId);
}

function logout() {
    localStorage.removeItem('unimap_user');
    window.location.href = 'login.html';
}

// Inicializar app quando a página carregar
window.addEventListener('load', () => {
    window.app = new UnimapApp();
});

// Detectar mudança de tamanho de tela
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && window.app.currentSection === 'aulas-mobile') {
        window.app.showSection('aulas-desktop');
    } else if (window.innerWidth < 768 && window.app.currentSection === 'aulas-desktop') {
        window.app.showSection('aulas-mobile');
    }
});