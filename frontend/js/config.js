// config.js - Configurações dinâmicas
class Config {
    static getBaseURL() {
        // Se estiver em localhost, usa localhost, senão usa a origem atual
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        } else {
            return window.location.origin + '/api';
        }
    }
    
    static getWebURL() {
        return window.location.origin;
    }
}