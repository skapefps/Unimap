// RegisterManager - Gerenciador de Cadastro
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
            
            const userData = {
                nome: inputs.fullName.value.trim(),
                email: inputs.email.value.trim(),
                usuario: inputs.username.value.trim(),
                senha: inputs.password.value,
                confirmarSenha: inputs.confirmPassword.value
            };

            // CHAMADA REAL PARA A API
            const result = await api.register(userData);
            
            if (result.success) {
                console.log('✅ CADASTRO BEM-SUCEDIDO via API!', result);
                
                // Salvar dados de autenticação
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('userData', JSON.stringify(result.user));
                
                this.showSuccess(registerBtn);
                
                console.log('🔄 Redirecionando para dashboard em 2 segundos...');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
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
            } else if (error.message.includes('Usuário já existe')) {
                errorMessage = 'Este nome de usuário já está em uso.';
            } else if (error.message.includes('Senhas não coincidem')) {
                errorMessage = 'As senhas não coincidem.';
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