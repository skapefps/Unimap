// api.js - Serviço de API UNIMAP (VERSÃO OTIMIZADA)
class ApiService {
    constructor() {
        this.baseURL = window.location.origin + '/api';
        this.cache = new Map();
        this.requestQueue = new Map();
        this.cacheTTL = 30000; // 30 segundos
        this.maxRetries = 3;
        this.initialRetryDelay = 1000;
        console.log('🌐 API Base URL:', this.baseURL);
    }

    // 🔧 MÉTODOS PRINCIPAIS OTIMIZADOS
    getHeaders(additionalHeaders = {}) {
        const token = localStorage.getItem('authToken');
        const baseHeaders = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...additionalHeaders
        };
        return baseHeaders;
    }

    async request(endpoint, options = {}) {
        const cacheKey = this.generateCacheKey(endpoint, options);
        const queueKey = this.generateQueueKey(endpoint);

        // 🔥 Cache otimizado para GET
        if (options.method === 'GET' && this.cache.has(cacheKey)) {
            console.log('📦 Retornando do cache:', cacheKey);
            return this.cache.get(cacheKey);
        }

        // 🔥 Prevenção de requisições duplicadas
        if (this.requestQueue.has(queueKey)) {
            return this.requestQueue.get(queueKey);
        }

        try {
            console.log('📤 Enviando requisição:', endpoint, this.sanitizeLog(options));

            const requestPromise = this.executeRequest(endpoint, options, cacheKey);
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

    async executeRequest(endpoint, options, cacheKey) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            headers: this.getHeaders(),
            ...options
        });

        const result = await this.handleResponse(response, endpoint);

        // Cache otimizado para respostas bem-sucedidas GET
        if (options.method === 'GET' && result.success) {
            this.setCache(cacheKey, result);
        }

        return result;
    }

    generateCacheKey(endpoint, options) {
        return `${endpoint}-${JSON.stringify(options)}`;
    }

    generateQueueKey(endpoint) {
        return `${endpoint}-${Date.now()}`;
    }

    setCache(key, value) {
        this.cache.set(key, value);
        setTimeout(() => this.cache.delete(key), this.cacheTTL);
    }

    sanitizeLog(options) {
        if (!options.body) return options;

        try {
            const body = JSON.parse(options.body);
            const sanitized = { ...body };
            if (sanitized.senha) sanitized.senha = '***';
            if (sanitized.password) sanitized.password = '***';
            return { ...options, body: JSON.stringify(sanitized) };
        } catch {
            return options;
        }
    }

    async handleResponse(response, endpoint) {
        console.log(`📥 Resposta de ${endpoint}:`, response.status);

        try {
            const data = await this.parseResponse(response);

            if (response.ok) {
                return { success: true, data };
            } else {
                const errorMessage = this.extractErrorMessage(data, response);
                console.error(`❌ Erro ${response.status} em ${endpoint}:`, errorMessage);
                return { success: false, error: errorMessage };
            }
        } catch (error) {
            console.error('❌ Erro ao processar resposta:', error);
            return {
                success: false,
                error: 'Resposta inválida do servidor'
            };
        }
    }

    async parseResponse(response) {
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Resposta não é JSON: ${text.substring(0, 100)}`);
        }
    }

    extractErrorMessage(data, response) {
        return data?.error || data?.message ||
            `Erro ${response.status}: ${response.statusText}`;
    }

    // 🔥 MÉTODOS DE AUTENTICAÇÃO OTIMIZADOS
    async register(userData) {
        console.log('👤 Registrando usuário:', this.sanitizeUserData(userData));
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async login(dadosLogin) {
        console.log('🔐 Realizando login:', this.sanitizeUserData(dadosLogin));

        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            }
            return result;
        } catch (error) {
            console.error('❌ Erro no login:', error);
            return { success: false, error: error.message };
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
        this.clearCacheByPattern('/aulas');

        return this.request('/aulas', {
            method: 'POST',
            body: JSON.stringify(dadosAula)
        });
    }

    async excluirAula(aulaId) {
        console.log('🗑️ Excluindo aula:', aulaId);
        this.clearCacheByPattern('/aulas');

        return this.request(`/aulas/${aulaId}`, {
            method: 'DELETE'
        });
    }

    async atualizarAula(aulaId, dadosAula) {
        console.log('✏️ Atualizando aula:', aulaId, dadosAula);
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
        return this.request(`/aulas/${aulaId}/cancelar`, { method: 'PUT' });
    }

    async reativarAula(aulaId) {
        console.log('🔄 Reativando aula:', aulaId);
        this.clearCacheByPattern('/aulas');
        return this.request(`/aulas/${aulaId}/reativar`, { method: 'PUT' });
    }

    // 🔥 MÉTODOS ESPECÍFICOS PARA PROFESSORES
    async getMinhasAulasProfessor() {
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

    // 🔧 MÉTODOS DE GESTÃO DE CACHE OTIMIZADOS
    clearCacheByPattern(pattern) {
        let clearedCount = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                clearedCount++;
            }
        }
        console.log('🧹 Cache limpo:', clearedCount, 'itens para padrão:', pattern);
    }

    clearAllCache() {
        const size = this.cache.size;
        this.cache.clear();
        console.log('🧹 Todo o cache limpo:', size, 'itens removidos');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            queueSize: this.requestQueue.size
        };
    }

    // 🔧 MÉTODO PARA REQUISIÇÕES EM LOTE OTIMIZADO
    async batchRequests(requests) {
        console.log('🔄 Executando lote de requisições:', requests.length);

        const results = await Promise.allSettled(
            requests.map(req => this.request(req.endpoint, req.options))
        );

        return results.map((result, index) => this.processBatchResult(result, requests[index]));
    }

    processBatchResult(result, request) {
        const isFulfilled = result.status === 'fulfilled';
        const value = isFulfilled ? result.value : null;

        return {
            request,
            success: isFulfilled && value.success,
            data: isFulfilled ? value.data : null,
            error: !isFulfilled ? result.reason :
                (value && !value.success ? value.error : null)
        };
    }

    // 🔧 MÉTODO PARA HEALTH CHECK OTIMIZADO
    async healthCheck() {
        const startTime = Date.now();

        try {
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const responseTime = Date.now() - startTime;
            const status = response.ok ? 'healthy' : 'unhealthy';

            return {
                success: response.ok,
                online: true,
                responseTime,
                status,
                ...(!response.ok && { error: `Status ${response.status}` })
            };
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

    // 🔧 MÉTODO PARA RETRY AUTOMÁTICO OTIMIZADO
    async requestWithRetry(endpoint, options = {}, maxRetries = this.maxRetries, delay = this.initialRetryDelay) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Tentativa ${attempt}/${maxRetries} para ${endpoint}`);
                const result = await this.request(endpoint, options);

                if (result.success || !this.shouldRetry(result.error)) {
                    return result;
                }

                if (attempt < maxRetries) {
                    console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                    await this.delay(delay);
                    delay *= 2; // Exponential backoff
                }
            } catch (error) {
                console.error(`❌ Tentativa ${attempt} falhou:`, error);
                if (attempt === maxRetries || !this.shouldRetry(error.message)) {
                    throw error;
                }
                await this.delay(delay);
                delay *= 2;
            }
        }

        return {
            success: false,
            error: `Todas as ${maxRetries} tentativas falharam`
        };
    }

    shouldRetry(errorMessage) {
        const retryableErrors = ['conexão', 'timeout', 'network', 'fetch'];
        return retryableErrors.some(keyword =>
            errorMessage.toLowerCase().includes(keyword)
        );
    }

    // 🔧 MÉTODOS DE AUTENTICAÇÃO ADICIONAIS OTIMIZADOS
    async verifyToken() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            return { success: false, error: 'Token não encontrado' };
        }

        try {
            const response = await fetch(`${this.baseURL}/auth/verify`, {
                headers: this.getHeaders()
            });

            return {
                success: response.ok,
                valid: response.ok,
                ...(!response.ok && { error: 'Token inválido' })
            };
        } catch (error) {
            return {
                success: false,
                valid: false,
                error: error.message
            };
        }
    }

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

    async logout() {
        console.log('🚪 Realizando logout');
        this.clearAllCache();
        this.requestQueue.clear();

        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');

        return {
            success: true,
            message: 'Logout realizado com sucesso'
        };
    }

    // 🔧 UTILITÁRIOS OTIMIZADOS
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    sanitizeUserData(userData) {
        const sanitized = { ...userData };
        if (sanitized.senha) sanitized.senha = '***';
        if (sanitized.password) sanitized.password = '***';
        return sanitized;
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        return password && password.length >= 6;
    }

    // 🔧 MÉTODOS DE DEBUG E MONITORAMENTO
    enableDebugMode() {
        this.debugMode = true;
        console.log('🐛 Modo debug ativado');
    }

    disableDebugMode() {
        this.debugMode = false;
        console.log('🐛 Modo debug desativado');
    }

    getPerformanceMetrics() {
        return {
            cacheSize: this.cache.size,
            queueSize: this.requestQueue.size,
            cacheTTL: this.cacheTTL,
            maxRetries: this.maxRetries
        };
    }
}

// ✅ INSTÂNCIA GLOBAL OTIMIZADA
const api = new ApiService();

// 🔧 EXPORTAÇÃO PARA USO GLOBAL
if (typeof window !== 'undefined') {
    window.api = api;

    // 🔧 FERRAMENTAS DE DEBUG OTIMIZADAS
    window.apiDebug = {
        cacheStats: () => api.getCacheStats(),
        clearCache: () => api.clearAllCache(),
        healthCheck: () => api.healthCheck(),
        batchTest: () => api.batchRequests([
            { endpoint: '/cursos' },
            { endpoint: '/salas' },
            { endpoint: '/aulas' }
        ]),
        performance: () => api.getPerformanceMetrics(),
        enableDebug: () => api.enableDebugMode(),
        disableDebug: () => api.disableDebugMode()
    };
}

console.log('🌐 API Service carregado e otimizado:', {
    cache: api.cache.size,
    baseURL: api.baseURL,
    features: ['cache', 'retry', 'batch', 'healthCheck']
});