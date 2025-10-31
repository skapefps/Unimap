// api.js - Serviço de API UNIMAP (VERSÃO CORRIGIDA)
class ApiService {
    constructor() {
        this.baseURL = window.location.origin + '/api';
        console.log('🌐 API Base URL:', this.baseURL);
    }

    // 🔧 MÉTODO PARA OBTER HEADERS COM TOKEN
    getHeaders() {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    async register(userData) {
        try {
            console.log('📤 Enviando dados para cadastro:', userData);
            
            const response = await fetch(`${this.baseURL}/auth/register`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            console.log('📥 Resposta do cadastro:', data);

            if (response.ok) {
                return { 
                    success: true, 
                    message: data.message,
                    userId: data.userId 
                };
            } else {
                return { 
                    success: false, 
                    error: data.error || 'Erro no cadastro' 
                };
            }
        } catch (error) {
            console.error('❌ Erro na API de cadastro:', error);
            return { 
                success: false, 
                error: 'Erro de conexão com o servidor' 
            };
        }
    }

   // api.js - método login corrigido
async login(dadosLogin) {
    try {
        console.log('📤 Enviando dados para login:', dadosLogin);
        
        const response = await fetch(`${this.baseURL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dadosLogin)
        });

        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('❌ Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta do servidor não é JSON');
        }

        const data = await response.json();
        
        console.log('📥 Resposta do login:', data);

        if (!response.ok) {
            throw new Error(data.error || `Erro ${response.status}`);
        }

        return {
            success: true,
            user: data.user,
            token: data.token
        };
    } catch (error) {
        console.error('❌ Erro na API login:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

    async googleLogin(token) {
        try {
            console.log('📤 Enviando token Google para API...');
            
            const response = await fetch(`${this.baseURL}/auth/google`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ token: token })
            });

            const data = await response.json();
            console.log('📥 Resposta do Google OAuth:', data);

            if (response.ok) {
                return { 
                    success: true, 
                    user: data.user, 
                    token: data.token 
                };
            } else {
                return { 
                    success: false, 
                    error: data.error || 'Erro no login Google' 
                };
            }
        } catch (error) {
            console.error('❌ Erro na API Google OAuth:', error);
            return { 
                success: false, 
                error: 'Erro de conexão com o servidor' 
            };
        }
    }

    // 🔧 NOVO: MÉTODO GENÉRICO PARA REQUISIÇÕES AUTENTICADAS
    async authenticatedRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            headers: this.getHeaders(),
            ...options
        });

        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Resposta não é JSON: ${text.substring(0, 100)}`);
        }

        if (response.ok) {
            return { success: true, data };
        } else {
            return { 
                success: false, 
                error: data.error || `Erro ${response.status}: ${response.statusText}` 
            };
        }
    } catch (error) {
        console.error(`❌ Erro na requisição para ${endpoint}:`, error);
        return { 
            success: false, 
            error: error.message || 'Erro de conexão com o servidor' 
        };
    }
}

    // 🔧 MÉTODOS ESPECÍFICOS PARA SALAS
    async getSalas() {
        return await this.authenticatedRequest('/salas');
    }

    async getSalasPorBloco(bloco) {
        return await this.authenticatedRequest(`/salas/bloco/${bloco}`);
    }

    async getSalasPorBlocoEAndar(bloco, andar) {
        return await this.authenticatedRequest(`/salas/bloco/${bloco}/andar/${andar}`);
    }

    async getBlocos() {
        return await this.authenticatedRequest('/salas/blocos');
    }

    async getAndaresPorBloco(bloco) {
        return await this.authenticatedRequest(`/salas/bloco/${bloco}/andares`);
    }

    // 🔧 MÉTODOS PARA AULAS
    async getAulas() {
        return await this.authenticatedRequest('/aulas');
    }

    async getMinhasAulas() {
        const userData = localStorage.getItem('userData');
        if (!userData) return { success: false, error: 'Usuário não autenticado' };
        
        const user = JSON.parse(userData);
        return await this.authenticatedRequest(`/aulas/usuario/${user.id}`);
    }

    async criarAula(dadosAula) {
        return await this.authenticatedRequest('/aulas', {
            method: 'POST',
            body: JSON.stringify(dadosAula)
        });
    }

    async excluirAula(aulaId) {
        return await this.authenticatedRequest(`/aulas/${aulaId}`, {
            method: 'DELETE'
        });
    }

    // 👨‍🏫 FUNÇÕES DO PROFESSOR
    async getMinhasAulas() {
        try {
            const token = localStorage.getItem('authToken');
            const userData = JSON.parse(localStorage.getItem('userData'));
            
            const response = await fetch('/api/aulas/usuario/' + userData.id, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const aulas = await response.json();
                return { success: true, data: aulas };
            } else {
                const error = await response.json();
                return { success: false, error: error.error };
            }
        } catch (error) {
            console.error('Erro ao carregar aulas:', error);
            return { success: false, error: 'Erro de conexão' };
        }
    }
    // 🔥 NOVA FUNÇÃO ESPECÍFICA PARA PROFESSORES
    async getMinhasAulasProfessor() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/professor/minhas-aulas', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const aulas = await response.json();
                return { success: true, data: aulas };
            } else {
                const error = await response.json();
                return { success: false, error: error.error };
            }
        } catch (error) {
            console.error('Erro ao carregar aulas do professor:', error);
            return { success: false, error: 'Erro de conexão' };
        }
    }
    // 🎓 FUNÇÕES DE CURSOS - CORRIGIDAS
    async getCursos() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/cursos', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const cursos = await response.json();
                return { success: true, data: cursos };
            } else {
                const error = await response.json();
                return { success: false, error: error.error };
            }
        } catch (error) {
            console.error('Erro ao carregar cursos:', error);
            return { success: false, error: 'Erro de conexão' };
        }
    }
}

// ✅ INSTÂNCIA GLOBAL
const api = new ApiService();