class AdminAPI {
    constructor() {
        this.baseURL = '';
        this.token = localStorage.getItem('authToken');
    }

    async request(endpoint, options = {}) {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
            
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                ...options
            };

            console.log(`📤 API Request: ${endpoint}`, config);

            const response = await fetch(url, config);

            if (!response.ok) {
                if (response.status === 404) {
                    if (endpoint.includes('/favoritos-count')) {
                        console.log('🔄 Tentando rota alternativa para favoritos...');
                        const alternativeEndpoint = endpoint.replace('/favoritos-count', '/favoritos');
                        return this.request(alternativeEndpoint, options);
                    }
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Resposta não é JSON: ${text.substring(0, 100)}`);
            }

            console.log(`📥 API Response: ${endpoint}`, data);
            return data;

        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error);

            if (endpoint.includes('/favoritos-count') || endpoint.includes('/favoritos')) {
                console.log('🔄 Retornando dados de fallback para favoritos');
                return {
                    count: 0,
                    alunos: []
                };
            }
            
            if (endpoint.includes('/aulas/professor/')) {
                console.log('🔄 Retornando dados de fallback para aulas');
                return [];
            }
            
            throw error;
        }
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    async getProfessores() {
        return this.get('/api/professores?todos=true');
    }

    async createProfessor(data) {
        return this.post('/api/professores', data);
    }

    async updateProfessor(id, data) {
        return this.put(`/api/professores/${id}`, data);
    }

    async updateProfessorStatus(id, ativo) {
        return this.put(`/api/professores/${id}/status`, { ativo });
    }

    async getProfessorFavoritos(id) {
        return this.get(`/api/professores/${id}/favoritos-count`);
    }

    async getProfessorAulas(id) {
        return this.get(`/api/aulas/professor/${id}`);
    }

    async getProfessoresStats() {
        return this.get('/api/professores/stats');
    }
}

const adminAPI = new AdminAPI();