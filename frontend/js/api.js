// api.js - Serviço de API UNIMAP
class ApiService {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
    }

    async register(userData) {
        try {
            console.log('📤 Enviando dados para cadastro:', userData);
            
            const response = await fetch(`${this.baseURL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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

    async login(email, password) {
        try {
            console.log('📤 Enviando login para API:', { email });
            
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    senha: password
                })
            });

            const data = await response.json();
            console.log('📥 Resposta completa da API:', data);

            if (response.ok && data.success) {
                return { 
                    success: true, 
                    user: data.user, 
                    token: data.token 
                };
            } else {
                return { 
                    success: false, 
                    error: data.error || 'Erro no login' 
                };
            }
        } catch (error) {
            console.error('❌ Erro na API de login:', error);
            return { 
                success: false, 
                error: 'Erro de conexão com o servidor' 
            };
        }
    }

    async googleLogin(token) {
        try {
            console.log('📤 Enviando token Google para API...');
            
            const response = await fetch(`${this.baseURL}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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
}

// ✅ INSTÂNCIA GLOBAL - ADICIONE ESTA LINHA
const api = new ApiService();