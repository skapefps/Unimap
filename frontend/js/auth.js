class AuthManager {
    constructor() {
        console.log('🔧 CONSTRUCTOR: AuthManager sendo construído...');
        this.isInitialized = false;
        this.isAuthenticated = false;
        this.currentUser = null;
        this.token = null;
        
        this.bindMethods();
    }

    bindMethods() {
        this.init = this.init.bind(this);
        this.setupLoginForm = this.setupLoginForm.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.validateLoginForm = this.validateLoginForm.bind(this);
        this.showLoading = this.showLoading.bind(this);
        this.hideLoading = this.hideLoading.bind(this);
        this.showError = this.showError.bind(this);
        this.hideError = this.hideError.bind(this);
        this.redirectToDashboard = this.redirectToDashboard.bind(this);
        this.checkExistingAuth = this.checkExistingAuth.bind(this);
        this.logout = this.logout.bind(this);
    }

    init() {
        if (this.isInitialized) return;
        
        console.log('🎯 INIT: Inicializando AuthManager...');
        this.checkExistingAuth();
        this.setupLoginForm();
        this.isInitialized = true;
        console.log('✅ INIT: AuthManager inicializado com sucesso');
    }

    checkExistingAuth() {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');
        
        if (token && userData) {
            try {
                this.token = token;
                this.currentUser = JSON.parse(userData);
                this.isAuthenticated = true;
                console.log('🔐 Usuário já autenticado:', this.currentUser.nome);
                
                // **REMOVER O REDIRECIONAMENTO AUTOMÁTICO**
                // Só redirecionar se o usuário explicitamente quiser
                // if (window.location.pathname.includes('login.html')) {
                //     console.log('⚠️  Usuário autenticado na página de login - redirecionamento desativado');
                //     // this.redirectToDashboard(); // COMENTADO
                // }
                
            } catch (error) {
                console.error('❌ Erro ao verificar autenticação:', error);
                this.clearAuth();
            }
        } else {
            console.log('🔐 Nenhum usuário autenticado encontrado');
        }
    }

    setupLoginForm() {
        console.log('🔧 SETUP: Configurando formulários de login...');
        
        // Configurar formulário MOBILE
        const loginForm = document.getElementById('loginForm');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');

        // Configurar formulário DESKTOP
        const loginFormDesktop = document.getElementById('loginFormDesktop');
        const emailInputDesktop = document.getElementById('emailDesktop');
        const passwordInputDesktop = document.getElementById('passwordDesktop');
        const loginBtnDesktop = document.getElementById('loginBtnDesktop');

        console.log('📱 Elementos Mobile:', { 
            loginForm: !!loginForm, 
            emailInput: !!emailInput, 
            passwordInput: !!passwordInput, 
            loginBtn: !!loginBtn 
        });
        
        console.log('💻 Elementos Desktop:', { 
            loginFormDesktop: !!loginFormDesktop, 
            emailInputDesktop: !!emailInputDesktop, 
            passwordInputDesktop: !!passwordInputDesktop, 
            loginBtnDesktop: !!loginBtnDesktop 
        });

        // Configurar MOBILE
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e, 'mobile'));
            console.log('✅ Event listener adicionado ao formulário mobile');
        } else {
            console.log('❌ Formulário mobile não encontrado (#loginForm)');
        }

        // Configurar DESKTOP
        if (loginFormDesktop) {
            loginFormDesktop.addEventListener('submit', (e) => this.handleLogin(e, 'desktop'));
            console.log('✅ Event listener adicionado ao formulário desktop');
        } else {
            console.log('❌ Formulário desktop não encontrado (#loginFormDesktop)');
        }

        // Validação em tempo real para MOBILE
        if (emailInput && passwordInput && loginBtn) {
            emailInput.addEventListener('input', () => this.validateLoginForm('mobile'));
            passwordInput.addEventListener('input', () => this.validateLoginForm('mobile'));
            this.validateLoginForm('mobile');
        }

        // Validação em tempo real para DESKTOP
        if (emailInputDesktop && passwordInputDesktop && loginBtnDesktop) {
            emailInputDesktop.addEventListener('input', () => this.validateLoginForm('desktop'));
            passwordInputDesktop.addEventListener('input', () => this.validateLoginForm('desktop'));
            this.validateLoginForm('desktop');
        }
    }

    validateLoginForm(version = 'mobile') {
        const email = version === 'mobile' 
            ? document.getElementById('email')?.value 
            : document.getElementById('emailDesktop')?.value;
            
        const password = version === 'mobile'
            ? document.getElementById('password')?.value
            : document.getElementById('passwordDesktop')?.value;
            
        const loginBtn = version === 'mobile'
            ? document.getElementById('loginBtn')
            : document.getElementById('loginBtnDesktop');

    }

       async handleLogin(event, version = 'mobile') {
        event.preventDefault();
        console.log(`🎯 HANDLELOGIN: Processando login (${version})...`);
        
        const email = version === 'mobile'
            ? document.getElementById('email')?.value
            : document.getElementById('emailDesktop')?.value;
            
        const password = version === 'mobile'
            ? document.getElementById('password')?.value
            : document.getElementById('passwordDesktop')?.value;
            
        const loginBtn = version === 'mobile'
            ? document.getElementById('loginBtn')
            : document.getElementById('loginBtnDesktop');

        console.log(`📧 Dados ${version}:`, { 
            email: email || 'N/A', 
            password: password ? '***' + password.slice(-2) : 'N/A' 
        });

        if (!email || !password) {
            this.showError('Email e senha são obrigatórios', version);
            return;
        }

        this.showLoading(loginBtn);
        this.hideError(version);

        try {
            console.log('🔄 Fazendo chamada REAL para API...');
            
            // CHAMADA REAL PARA A API
            const result = await api.login(email, password);
            
            if (result.success) {
                console.log('✅ LOGIN BEM-SUCEDIDO via API!', result);
                
                // Salvar dados de autenticação
                this.isAuthenticated = true;
                this.currentUser = result.user;
                this.token = result.token;
                
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('userData', JSON.stringify(result.user));
                
                // APENAS MUDAR O TEXTO DO BOTÃO (sem showSuccess)
                if (loginBtn) {
                    loginBtn.innerHTML = '<i class="fas fa-check"></i> Login realizado!';
                    loginBtn.style.backgroundColor = '#28a745';
                }
                
                console.log('🔄 Redirecionando para dashboard em 1 segundo...');
                setTimeout(() => {
                    this.redirectToDashboard();
                }, 1000);
                
            } else {
                throw new Error(result.error || 'Erro no login');
            }
            
        } catch (error) {
            console.error('❌ ERRO NO LOGIN:', error);
            
            // Mensagens de erro específicas
            let errorMessage = 'Erro ao fazer login. Tente novamente.';
            if (error.message.includes('Usuário não encontrado')) {
                errorMessage = 'Usuário não encontrado. Verifique o email.';
            } else if (error.message.includes('Senha incorreta')) {
                errorMessage = 'Senha incorreta. Tente novamente.';
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMessage = 'Erro de conexão. Verifique se o servidor está rodando.';
            } else {
                errorMessage = error.message;
            }
            
            this.showError(errorMessage, version);
            this.hideLoading(loginBtn);
        }
    }

    showLoading(button) {
        if (button) {
            const originalText = button.textContent;
            button.dataset.originalText = originalText;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
            button.style.opacity = '0.7';
        }
    }

    hideLoading(button) {
        if (button && button.dataset.originalText) {
            button.disabled = false;
            button.textContent = button.dataset.originalText;
            this.validateLoginForm();
        }
    }


    showError(message, version = 'mobile') {
        const errorDiv = version === 'mobile' 
            ? document.getElementById('loginError')
            : document.getElementById('loginErrorDesktop');
            
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            console.log('❌ Mostrando erro:', message);
        } else {
            console.log('❌ Div de erro não encontrada, mostrando alerta');
            alert('Erro: ' + message);
        }
    }

    hideError(version = 'mobile') {
        const errorDiv = version === 'mobile'
            ? document.getElementById('loginError')
            : document.getElementById('loginErrorDesktop');
            
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
    }

    clearAuth() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        console.log('🔓 Auth limpo - usuário deslogado');
    }

    redirectToDashboard() {
        console.log('🔄 Redirecionando para dashboard...');
        window.location.href = 'dashboard.html';
    }

    logout() {
        console.log('🚪 Executando logout...');
        this.clearAuth();
        window.location.href = 'login.html';
    }

    // Métodos para uso externo
    getCurrentUser() {
        return this.currentUser;
    }

    getToken() {
        return this.token;
    }

    isUserAuthenticated() {
        return this.isAuthenticated;
    }
}

// Instância global
const authManager = new AuthManager();

// Inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM carregado, inicializando AuthManager...');
        authManager.init();
    });
} else {
    console.log('📄 DOM já carregado, inicializando AuthManager...');
    authManager.init();
}
// RegisterManager - Gerenciador de Cadastro (ATUALIZADO)
class RegisterManager {
    constructor() {
        console.log('🔧 CONSTRUCTOR: RegisterManager sendo construído...');
        this.isInitialized = false;
        this.bindMethods();
    }

    bindMethods() {
        this.init = this.init.bind(this);
        this.setupRegisterForm = this.setupRegisterForm.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.validateRegisterForm = this.validateRegisterForm.bind(this);
        this.showLoading = this.showLoading.bind(this);
        this.hideLoading = this.hideLoading.bind(this);
        this.showError = this.showError.bind(this);
        this.hideError = this.hideError.bind(this);
        this.showSuccess = this.showSuccess.bind(this);
    }

    init() {
        if (this.isInitialized) return;
        
        console.log('🎯 INIT: Inicializando RegisterManager...');
        this.setupRegisterForm();
        this.isInitialized = true;
        console.log('✅ INIT: RegisterManager inicializado com sucesso');
    }

    setupRegisterForm() {
        console.log('🔧 SETUP: Configurando formulários de cadastro...');
        
        // Configurar formulário DESKTOP
        const registerFormDesktop = document.getElementById('registerFormDesktop');
        const registerBtnDesktop = document.getElementById('registerBtnDesktop');

        // Configurar formulário MOBILE
        const registerFormMobile = document.getElementById('registerFormMobile');
        const registerBtnMobile = document.getElementById('registerBtnMobile');

        console.log('💻 Elementos Desktop:', { 
            registerFormDesktop: !!registerFormDesktop,
            registerBtnDesktop: !!registerBtnDesktop
        });
        
        console.log('📱 Elementos Mobile:', { 
            registerFormMobile: !!registerFormMobile,
            registerBtnMobile: !!registerBtnMobile
        });

        // Configurar DESKTOP
        if (registerFormDesktop) {
            registerFormDesktop.addEventListener('submit', (e) => this.handleRegister(e, 'desktop'));
            console.log('✅ Event listener adicionado ao formulário desktop');
        }

        // Configurar MOBILE
        if (registerFormMobile) {
            registerFormMobile.addEventListener('submit', (e) => this.handleRegister(e, 'mobile'));
            console.log('✅ Event listener adicionado ao formulário mobile');
        }

        // Validação em tempo real
        this.setupRealTimeValidation('desktop');
        this.setupRealTimeValidation('mobile');
    }

    setupRealTimeValidation(version = 'desktop') {
        const inputs = this.getFormInputs(version);
        
        Object.values(inputs).forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.validateRegisterForm(version));
            }
        });
        
        this.validateRegisterForm(version);
    }

    getFormInputs(version = 'desktop') {
        const prefix = version === 'mobile' ? 'Mobile' : 'Desktop';
        return {
            fullName: document.getElementById(`fullName${prefix}`),
            email: document.getElementById(`email${prefix}`),
            username: document.getElementById(`username${prefix}`),
            password: document.getElementById(`password${prefix}`),
            confirmPassword: document.getElementById(`confirmPassword${prefix}`)
        };
    }

    validateRegisterForm(version = 'desktop') {
        const inputs = this.getFormInputs(version);
        const registerBtn = version === 'mobile' 
            ? document.getElementById('registerBtnMobile')
            : document.getElementById('registerBtnDesktop');

        const isValid = Object.values(inputs).every(input => 
            input && input.value.trim() !== ''
        );

        if (registerBtn) {
            registerBtn.disabled = !isValid;
        }
    }

    async handleRegister(event, version = 'desktop') {
        event.preventDefault();
        console.log(`🎯 HANDLEREGISTER: Processando cadastro (${version})...`);
        
        const inputs = this.getFormInputs(version);
        const registerBtn = version === 'mobile' 
            ? document.getElementById('registerBtnMobile')
            : document.getElementById('registerBtnDesktop');

        // Validar dados
        const validation = this.validateData(inputs);
        if (!validation.isValid) {
            this.showError(validation.message, version);
            return;
        }

        this.showLoading(registerBtn);
        this.hideError(version);

        try {
            console.log('🔄 Fazendo chamada REAL para API de cadastro...');
            
            // DADOS CORRETOS PARA SEU BACKEND
            const userData = {
                nome: inputs.fullName.value.trim(),
                email: inputs.email.value.trim(),
                matricula: inputs.username.value.trim(), // Usando username como matrícula
                senha: inputs.password.value
                // curso e periodo podem ser adicionados depois
            };

            console.log('📤 Dados enviados para cadastro:', userData);

            // CHAMADA REAL PARA A API
            const result = await api.register(userData);
            
            if (result.success) {
                console.log('✅ CADASTRO BEM-SUCEDIDO via API!', result);
                
                // Mostrar mensagem de sucesso
                this.showSuccess(registerBtn);
                
                console.log('🔄 Redirecionando para login em 2 segundos...');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                
            } else {
                throw new Error(result.error || 'Erro no cadastro');
            }
            
        } catch (error) {
            console.error('❌ ERRO NO CADASTRO:', error);
            
            // Mensagens de erro específicas
            let errorMessage = 'Erro ao fazer cadastro. Tente novamente.';
            if (error.message.includes('Email já cadastrado')) {
                errorMessage = 'Este email já está cadastrado.';
            } else if (error.message.includes('matricula') && error.message.includes('UNIQUE')) {
                errorMessage = 'Esta matrícula já está em uso.';
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMessage = 'Erro de conexão. Verifique se o servidor está rodando.';
            } else {
                errorMessage = error.message;
            }
            
            this.showError(errorMessage, version);
            this.hideLoading(registerBtn);
        }
    }

    validateData(inputs) {
        // Verificar se todos os campos estão preenchidos
        for (let [key, input] of Object.entries(inputs)) {
            if (!input || !input.value.trim()) {
                return { 
                    isValid: false, 
                    message: `O campo ${this.getFieldName(key)} é obrigatório` 
                };
            }
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inputs.email.value.trim())) {
            return { 
                isValid: false, 
                message: 'Por favor, insira um email válido' 
            };
        }

        // Validar senha
        if (inputs.password.value.length < 6) {
            return { 
                isValid: false, 
                message: 'A senha deve ter pelo menos 6 caracteres' 
            };
        }

        // Validar confirmação de senha
        if (inputs.password.value !== inputs.confirmPassword.value) {
            return { 
                isValid: false, 
                message: 'As senhas não coincidem' 
            };
        }

        return { isValid: true, message: '' };
    }

    getFieldName(key) {
        const fieldNames = {
            fullName: 'Nome Completo',
            email: 'E-mail',
            username: 'Usuário',
            password: 'Senha',
            confirmPassword: 'Confirmar Senha'
        };
        return fieldNames[key] || key;
    }

    showLoading(button) {
        if (button) {
            const originalText = button.textContent;
            button.dataset.originalText = originalText;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cadastrando...';
            button.style.opacity = '0.7';
        }
    }

    hideLoading(button) {
        if (button && button.dataset.originalText) {
            button.disabled = false;
            button.textContent = button.dataset.originalText;
        }
    }

    showError(message, version = 'desktop') {
        const errorDiv = version === 'mobile' 
            ? document.getElementById('registerErrorMobile')
            : document.getElementById('registerErrorDesktop');
            
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            console.log('❌ Mostrando erro:', message);
        } else {
            console.log('❌ Div de erro não encontrada, mostrando alerta');
            alert('Erro: ' + message);
        }
    }

    hideError(version = 'desktop') {
        const errorDiv = version === 'mobile'
            ? document.getElementById('registerErrorMobile')
            : document.getElementById('registerErrorDesktop');
            
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
    }

    showSuccess(button) {
        if (button) {
            button.innerHTML = '<i class="fas fa-check"></i> Cadastro realizado!';
            button.style.backgroundColor = '#28a745';
        }
    }
}

// Instância global do RegisterManager
const registerManager = new RegisterManager();

// Inicialização do RegisterManager
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM carregado, inicializando RegisterManager...');
        registerManager.init();
    });
} else {
    console.log('📄 DOM já carregado, inicializando RegisterManager...');
    registerManager.init();
}

// Para debug
window.registerManager = registerManager;

// Para debug
window.authManager = authManager;