// init.js - Centralizar inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    console.log(' Inicializando UNIMAP...');
    
 // Verificar autenticação global
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    const currentPage = window.location.pathname;
    
    const isAuthPage = currentPage.includes('login.html') || 
                      currentPage.includes('cadastro.html') ||
                      currentPage.includes('forgot-password.html') ||
                      currentPage.includes('reset-password.html');
    
 // Se não está autenticado e não está em página de auth, redirecionar
    if (!token && !isAuthPage && !currentPage.includes('index.html')) {
        console.log(' Redirecionando para login...');
        window.location.href = 'login.html';
        return;
    }
    
 // Se está autenticado e está em página de login, redirecionar para dashboard
    if (token && isAuthPage) {
        try {
            const user = JSON.parse(userData);
            console.log(' Usuário autenticado - Redirecionando...');
            authManager.redirectByUserType(user);
            return;
        } catch (error) {
            console.error(' Erro ao processar usuário:', error);
            localStorage.clear();
        }
    }
    
 // Inicializar managers
    if (typeof authManager !== 'undefined') {
        authManager.init();
    }
    
    if (typeof app !== 'undefined') {
        window.app = new UnimapApp();
    }
});