// js/api.js
class API {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            console.log(`🌐 API Request: ${url}`, config);
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Auth endpoints
    async login(email, senha) {
        return this.request('/auth/login', {
            method: 'POST',
            body: { email, senha }
        });
    }

    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: userData
        });
    }

    // Dashboard
    async getDashboardStats(token) {
        return this.request('/dashboard/estatisticas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    // User profile
    async getProfile(token) {
        return this.request('/usuario/perfil', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    // Cursos
    async getCursos(token) {
        return this.request('/cursos', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    // Salas
    async getSalas(token) {
        return this.request('/salas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    // Test connection
    async testConnection() {
        return this.request('/test');
    }
}

// Instância global da API
const api = new API();
window.api = api;