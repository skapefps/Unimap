// api.js - Serviço de API UNIMAP (VERSÃO CORRIGIDA)
class ApiService {
    constructor() {
        this.baseURL = window.location.origin + '/api';
        this.cache = new Map();
        this.requestQueue = new Map();
        console.log('🌐 API Base URL:', this.baseURL);
    }

    // 🔧 MÉTODOS PRINCIPAIS OTIMIZADOS
    getHeaders(additionalHeaders = {}) {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...additionalHeaders
        };
    }

    async request(endpoint, options = {}) {
        const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
        const queueKey = `${endpoint}-${Date.now()}`;

        // 🔥 Cache para requisições GET
        if (options.method === 'GET' && this.cache.has(cacheKey)) {
            console.log('📦 Retornando do cache:', cacheKey);
            return this.cache.get(cacheKey);
        }

        // 🔥 Prevenção de requisições duplicadas
        if (this.requestQueue.has(queueKey)) {
            return this.requestQueue.get(queueKey);
        }

        try {
            console.log('📤 Enviando requisição:', endpoint, options);

            const requestPromise = (async () => {
                const response = await fetch(`${this.baseURL}${endpoint}`, {
                    headers: this.getHeaders(),
                    ...options
                });

                const result = await this.handleResponse(response, endpoint);

                // Cache para respostas bem-sucedidas GET
                if (options.method === 'GET' && result.success) {
                    this.cache.set(cacheKey, result);
                    setTimeout(() => this.cache.delete(cacheKey), 30000); // Cache de 30 segundos
                }

                return result;
            })();

            this.requestQueue.set(queueKey, requestPromise);
            const result = await requestPromise;
            this.requestQueue.delete(queueKey);

            return result;

        } catch (error) {
            this.requestQueue.delete(queueKey);
            console.error(`❌ Erro na requisição ${endpoint}:`, error);
            return {
                success: false,
                error: error.message || 'Erro de conexão com o servidor'
            };
        }
    }

    async handleResponse(response, endpoint) {
        console.log(`📥 Resposta de ${endpoint}:`, response.status);

        const contentType = response.headers.get('content-type');
        let data;

        try {
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Resposta não é JSON: ${text.substring(0, 100)}`);
            }
        } catch (error) {
            console.error('❌ Erro ao parsear resposta:', error);
            return {
                success: false,
                error: 'Resposta inválida do servidor'
            };
        }

        if (response.ok) {
            return { success: true, data };
        } else {
            const errorMessage = data?.error ||
                data?.message ||
                `Erro ${response.status}: ${response.statusText}`;

            console.error(`❌ Erro ${response.status} em ${endpoint}:`, errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    // 🔥 MÉTODOS DE AUTENTICAÇÃO OTIMIZADOS
    async register(userData) {
        console.log('👤 Registrando usuário:', userData);
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async login(dadosLogin) {
        console.log('🔐 Realizando login:', { ...dadosLogin, senha: '***' });

        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dadosLogin)
            });

            const result = await this.handleResponse(response, '/auth/login');

            if (result.success) {
                console.log('✅ Login realizado com sucesso');
                return {
                    success: true,
                    user: result.data.user,
                    token: result.data.token
                };
            } else {
                return result;
            }
        } catch (error) {
            console.error('❌ Erro no login:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async googleLogin(token) {
        console.log('🔐 Realizando login Google');
        return this.request('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    }

    // 🔥 MÉTODOS PARA SALAS OTIMIZADOS
    async getSalas() {
        return this.request('/salas');
    }

    async getSalasPorBloco(bloco) {
        return this.request(`/salas/bloco/${bloco}`);
    }

    async getSalasPorBlocoEAndar(bloco, andar) {
        return this.request(`/salas/bloco/${bloco}/andar/${andar}`);
    }

    async getBlocos() {
        return this.request('/salas/blocos');
    }

    async getAndaresPorBloco(bloco) {
        return this.request(`/salas/bloco/${bloco}/andares`);
    }

    // 🔥 MÉTODOS PARA AULAS OTIMIZADOS
    async getAulas() {
        return this.request('/aulas');
    }

    async getMinhasAulas() {
        const userData = localStorage.getItem('userData');
        if (!userData) {
            return { success: false, error: 'Usuário não autenticado' };
        }

        const user = JSON.parse(userData);
        return this.request(`/aulas/usuario/${user.id}`);
    }

    async criarAula(dadosAula) {
        console.log('📝 Criando aula:', dadosAula);

        // Limpar cache relacionado a aulas
        this.clearCacheByPattern('/aulas');

        return this.request('/aulas', {
            method: 'POST',
            body: JSON.stringify(dadosAula)
        });
    }

    async excluirAula(aulaId) {
        console.log('🗑️ Excluindo aula:', aulaId);

        // Limpar cache relacionado a aulas
        this.clearCacheByPattern('/aulas');

        return this.request(`/aulas/${aulaId}`, {
            method: 'DELETE'
        });
    }

    async atualizarAula(aulaId, dadosAula) {
        console.log('✏️ Atualizando aula:', aulaId, dadosAula);

        // Limpar cache relacionado a aulas
        this.clearCacheByPattern('/aulas');

        return this.request(`/aulas/${aulaId}`, {
            method: 'PUT',
            body: JSON.stringify(dadosAula)
        });
    }

    // 🔥 MÉTODOS PARA CANCELAR/REATIVAR AULA
    async cancelarAula(aulaId) {
        console.log('🚫 Cancelando aula:', aulaId);
        this.clearCacheByPattern('/aulas');
        return this.request(`/aulas/${aulaId}/cancelar`, {
            method: 'PUT'
        });
    }

    async reativarAula(aulaId) {
        console.log('🔄 Reativando aula:', aulaId);
        this.clearCacheByPattern('/aulas');
        return this.request(`/aulas/${aulaId}/reativar`, {
            method: 'PUT'
        });
    }

    // 🔥 MÉTODOS ESPECÍFICOS PARA PROFESSORES - CORRIGIDOS
    async getMinhasAulasProfessor() {
        // 🔥 CORREÇÃO: Rota correta para aulas do professor
        return this.request('/aulas/professor/minhas-aulas');
    }

    // 🔥 MÉTODOS PARA CURSOS OTIMIZADOS
    async getCursos() {
        return this.request('/cursos');
    }

    async getCursosComPeriodos() {
        return this.request('/cursos/com-periodos');
    }

    async getTurmasPorCursoPeriodo(curso, periodo) {
        return this.request(`/turmas/curso/${encodeURIComponent(curso)}/periodo/${periodo}`);
    }

    async getCursosDetalhados() {
        return this.request('/cursos/detalhados');
    }

    // 🔧 MÉTODOS AUXILIARES AVANÇADOS
    clearCacheByPattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
        console.log('🧹 Cache limpo para padrão:', pattern);
    }

    clearAllCache() {
        this.cache.clear();
        console.log('🧹 Todo o cache limpo');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            queueSize: this.requestQueue.size
        };
    }

    // 🔧 MÉTODO PARA REQUISIÇÕES EM LOTE
    async batchRequests(requests) {
        console.log('🔄 Executando lote de requisições:', requests.length);

        const results = await Promise.allSettled(
            requests.map(req => this.request(req.endpoint, req.options))
        );

        return results.map((result, index) => ({
            request: requests[index],
            success: result.status === 'fulfilled' && result.value.success,
            data: result.status === 'fulfilled' ? result.value.data : null,
            error: result.status === 'rejected' ? result.reason :
                (result.status === 'fulfilled' && !result.value.success ? result.value.error : null)
        }));
    }

    // 🔧 MÉTODO PARA HEALTH CHECK
    async healthCheck() {
        try {
            const startTime = Date.now();
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            const responseTime = Date.now() - startTime;

            if (response.ok) {
                return {
                    success: true,
                    online: true,
                    responseTime: responseTime,
                    status: 'healthy'
                };
            } else {
                return {
                    success: false,
                    online: true,
                    responseTime: responseTime,
                    status: 'unhealthy',
                    error: `Status ${response.status}`
                };
            }
        } catch (error) {
            return {
                success: false,
                online: false,
                responseTime: null,
                status: 'offline',
                error: error.message
            };
        }
    }

    // 🔧 MÉTODO PARA RETRY AUTOMÁTICO
    async requestWithRetry(endpoint, options = {}, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Tentativa ${attempt}/${maxRetries} para ${endpoint}`);
                const result = await this.request(endpoint, options);

                if (result.success) {
                    return result;
                }

                // Se não foi sucesso mas não é erro de conexão, não retry
                if (!result.error.includes('conexão') && !result.error.includes('timeout')) {
                    return result;
                }

                if (attempt < maxRetries) {
                    console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                    await this.delay(delay);
                    delay *= 2; // Exponential backoff
                }
            } catch (error) {
                console.error(`❌ Tentativa ${attempt} falhou:`, error);
                if (attempt === maxRetries) {
                    throw error;
                }
                await this.delay(delay);
                delay *= 2;
            }
        }

        return { success: false, error: `Todas as ${maxRetries} tentativas falharam` };
    }

    // 🔧 UTILITÁRIOS
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 🔧 MÉTODO PARA LOGOUT
    async logout() {
        console.log('🚪 Realizando logout');
        this.clearAllCache();
        this.requestQueue.clear();

        // Limpar localStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');

        return { success: true, message: 'Logout realizado com sucesso' };
    }

    // 🔧 MÉTODO PARA VERIFICAÇÃO DE TOKEN
    async verifyToken() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            return { success: false, error: 'Token não encontrado' };
        }

        try {
            const response = await fetch(`${this.baseURL}/auth/verify`, {
                headers: this.getHeaders()
            });

            if (response.ok) {
                return { success: true, valid: true };
            } else {
                return { success: false, valid: false, error: 'Token inválido' };
            }
        } catch (error) {
            return { success: false, valid: false, error: error.message };
        }
    }

    // 🔧 MÉTODO PARA ATUALIZAÇÃO DE DADOS DO USUÁRIO
    async updateUserProfile(userData) {
        console.log('👤 Atualizando perfil do usuário');
        return this.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async requestPasswordReset(email) {
        console.log('🔑 Solicitando recuperação de senha para:', email);
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        return password && password.length >= 6;
    }
}

const api = new ApiService();

if (typeof window !== 'undefined') {
    window.api = api;

    window.apiDebug = {
        cacheStats: () => api.getCacheStats(),
        clearCache: () => api.clearAllCache(),
        healthCheck: () => api.healthCheck(),
        batchTest: () => api.batchRequests([
            { endpoint: '/cursos' },
            { endpoint: '/salas' },
            { endpoint: '/aulas' }
        ])
    };
}

console.log('🌐 API Service carregado com otimizações:', {
    cache: api.cache.size,
    baseURL: api.baseURL,
    methods: Object.getOwnPropertyNames(ApiService.prototype)
});