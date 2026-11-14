const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const transporter = require('../config/email');
const { client } = require('../config/auth');
const { authenticateToken } = require('../middleware/auth');
const { sign } = require('../config/jwt');
const { loginLimiter, registroLimiter, senhaLimiter } = require('../middleware/limiters');
const { validate, schemas } = require('../middleware/validate');
const router = express.Router();

// Rota de login
router.post('/login', loginLimiter, validate(schemas.login), (req, res) => {
    const { email, matricula, senha } = req.body;
    
    console.log('🔐 Tentativa de login:', { email, matricula, hasPassword: !!senha });
    
    // Validação robusta
    if (!senha) {
        console.log('❌ Senha não fornecida');
        return res.status(400).json({ 
            success: false,
            error: 'Senha é obrigatória' 
        });
    }
    
    // Verificar se foi fornecido email OU matrícula
    if (!email && !matricula) {
        console.log('❌ Nenhuma credencial fornecida');
        return res.status(400).json({ 
            success: false,
            error: 'Email ou matrícula são obrigatórios' 
        });
    }
    
    // Construir query baseada no que foi fornecido
    let query, params, tipoCredencial;
    
    if (email) {
        query = 'SELECT * FROM usuarios WHERE email = ? AND ativo = 1';
        params = [email];
        tipoCredencial = 'email';
    } else {
        query = 'SELECT * FROM usuarios WHERE matricula = ? AND ativo = 1';
        params = [matricula];
        tipoCredencial = 'matrícula';
    }
    
    console.log(`🔍 Buscando usuário por ${tipoCredencial}:`, params[0]);
    
    // Buscar usuário por email ou matrícula
    db.get(query, params, async (err, user) => {
        if (err) {
            console.error('❌ Erro no banco:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Erro interno do servidor' 
            });
        }
        
        if (!user) {
            console.log(`❌ ${tipoCredencial} não encontrado:`, params[0]);
            return res.status(401).json({ 
                success: false,
                error: `${tipoCredencial} não cadastrado` 
            });
        }
        
        // Conta criada pelo Google: o cadastro grava a string literal
        // "google_oauth" em senha_hash, não um hash. Sem este ramo o
        // usuário recebia "Senha incorreta" sem nenhuma pista de que a
        // conta não tem senha própria.
        if (user.senha_hash === 'google_oauth') {
            console.log('ℹ️ Tentativa de login por senha em conta do Google');
            return res.status(401).json({
                success: false,
                error: 'Esta conta foi criada com o Google. Use o botão "Entrar com Google".'
            });
        }

        try {
            // Verificar senha
            const senhaValida = await bcrypt.compare(senha, user.senha_hash);

            if (!senhaValida) {
                console.log('❌ Senha incorreta para:', params[0]);
                return res.status(401).json({
                    success: false,
                    error: 'Senha incorreta'
                });
            }
            
            console.log('✅ Login bem-sucedido:', user.nome, '- Tipo:', user.tipo);
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    nome: user.nome,
                    email: user.email,
                    matricula: user.matricula,
                    tipo: user.tipo,
                    curso: user.curso,
                    periodo: user.periodo
                },
                token: sign(user)
            });

        } catch (error) {
            console.error('❌ Erro ao verificar senha:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    });
});

// Rota de registro
router.post('/register', registroLimiter, validate(schemas.registro), async (req, res) => {
    const { nome, email, matricula, curso, periodo, senha } = req.body;
    
    console.log('👤 Tentativa de cadastro:', { email, nome });
    
    if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }
    
    try {
        // VERIFICAÇÃO FORTE - Verificar se email já existe (incluindo Google OAuth)
        db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (err, existingUser) => {
            if (err) {
                console.error('❌ Erro ao verificar email:', err);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }
            
            if (existingUser) {
                console.log('❌ Email já cadastrado:', email);
                return res.status(400).json({ 
                    error: 'Este email já está cadastrado no sistema. Use outro email ou faça login.' 
                });
            }
            
            // Verificar se matrícula já existe (se for fornecida)
            if (matricula) {
                db.get('SELECT * FROM usuarios WHERE matricula = ?', [matricula], async (err, existingMatricula) => {
                    if (err) {
                        console.error('❌ Erro ao verificar matrícula:', err);
                        return res.status(500).json({ error: 'Erro interno do servidor' });
                    }
                    
                    if (existingMatricula) {
                        console.log('❌ Matrícula já cadastrada:', matricula);
                        return res.status(400).json({ 
                            error: 'Esta matrícula já está cadastrada no sistema.' 
                        });
                    }
                    
                    // Criar usuário após verificação da matrícula
                    createUser();
                });
            } else {
                // Criar usuário sem verificação de matrícula
                createUser();
            }
            
            function createUser() {
                try {
                    bcrypt.hash(senha, 10, (hashErr, senhaHash) => {
                        if (hashErr) {
                            console.error('❌ Erro ao criar hash:', hashErr);
                            return res.status(500).json({ error: 'Erro interno do servidor' });
                        }
                        
                        db.run(
                            `INSERT INTO usuarios (nome, email, matricula, curso, periodo, senha_hash) 
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [nome, email, matricula || null, curso || null, periodo || null, senhaHash],
                            function(err) {
                                if (err) {
                                    console.error('❌ Erro ao criar usuário:', err);
                                    
                                    // Verificar se é erro de duplicação
                                    if (err.message.includes('UNIQUE constraint failed')) {
                                        if (err.message.includes('email')) {
                                            return res.status(400).json({ 
                                                error: 'Este email já está cadastrado no sistema.' 
                                            });
                                        } else if (err.message.includes('matricula')) {
                                            return res.status(400).json({ 
                                                error: 'Esta matrícula já está cadastrada no sistema.' 
                                            });
                                        }
                                    }
                                    
                                    return res.status(400).json({ error: 'Erro ao criar usuário: ' + err.message });
                                }
                                
                                console.log('✅ Usuário criado com ID:', this.lastID);
                                
                                res.json({ 
                                    success: true, 
                                    message: 'Usuário criado com sucesso!',
                                    userId: this.lastID 
                                });
                            }
                        );
                    });
                } catch (error) {
                    console.error('❌ Erro geral no cadastro:', error);
                    res.status(500).json({ error: 'Erro interno do servidor' });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erro geral no cadastro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota de login com Google
router.post('/google', loginLimiter, async (req, res) => {
    const { token } = req.body;

    console.log('🔐 Processando login Google...');
    
    if (!token) {
        return res.status(400).json({ error: 'Token não fornecido' });
    }

    try {
        console.log('✅ Token recebido, obtendo informações do usuário...');
        
        // Obter informações do usuário
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!userInfoResponse.ok) {
            throw new Error('Falha ao obter informações do usuário do Google');
        }

        const userInfo = await userInfoResponse.json();
        const { email, name, picture } = userInfo;

        console.log('✅ Informações do usuário Google obtidas:', email);

        // VERIFICAÇÃO: Se email já existe, FAZER LOGIN (não cadastrar)
        db.get('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email], async (err, user) => {
            if (err) {
                console.error('❌ Erro ao buscar usuário:', err);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }

            if (user) {
                console.log('✅ Usuário já cadastrado - Fazendo LOGIN:', user.nome);
                
                // USUÁRIO EXISTE - FAZER LOGIN
                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        nome: user.nome,
                        email: user.email,
                        matricula: user.matricula,
                        tipo: user.tipo,
                        curso: user.curso,
                        periodo: user.periodo
                    },
                    token: sign(user)
                });
                
            } else {
                // Criar novo usuário APENAS se não existir
                console.log('👤 Criando novo usuário Google:', name);
                
                db.run(
                    `INSERT INTO usuarios (nome, email, tipo, senha_hash) 
                     VALUES (?, ?, 'aluno', ?)`,
                    [name, email, 'google_oauth'],
                    function(err) {
                        if (err) {
                            console.error('❌ Erro ao criar usuário Google:', err);
                            
                            if (err.message.includes('UNIQUE constraint failed')) {
                                return res.status(400).json({ 
                                    success: false,
                                    error: 'Este email já está cadastrado.' 
                                });
                            }
                            
                            return res.status(400).json({ 
                                success: false,
                                error: 'Erro ao criar usuário: ' + err.message 
                            });
                        }
                        
                        console.log('✅ Novo usuário Google criado com ID:', this.lastID);
                        
                        res.json({
                            success: true,
                            user: {
                                id: this.lastID,
                                nome: name,
                                email: email,
                                tipo: 'aluno',
                                curso: null,
                                periodo: null
                            },
                            token: sign({ id: this.lastID, tipo: 'aluno' })
                        });
                    }
                );
            }
        });

    } catch (error) {
        console.error('❌ Erro na autenticação Google:', error);
        res.status(401).json({ 
            success: false,
            error: 'Erro na autenticação Google: ' + error.message 
        });
    }
});

// Rota de esqueci a senha
router.post('/forgot-password', senhaLimiter, validate(schemas.esqueciSenha), (req, res) => {
    const { email } = req.body;
    
    console.log('🔐 Solicitação de redefinição de senha para:', email);
    
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            error: 'Email é obrigatório' 
        });
    }
    
    // Buscar usuário pelo email
    db.get('SELECT id, nome, email FROM usuarios WHERE email = ? AND ativo = 1', [email], (err, user) => {
        if (err) {
            console.error('❌ Erro ao buscar usuário:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Erro interno do servidor' 
            });
        }
        
        if (!user) {
            console.log('❌ Email não encontrado:', email);
            // Por segurança, não revelamos se o email existe ou não
            return res.json({ 
                success: true, 
                message: 'Se o email existir em nosso sistema, enviaremos instruções de redefinição.' 
            });
        }
        
        // Gerar token único
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hora
        
        // Salvar token no banco
        db.run(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.id, token, expiresAt.toISOString()],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao salvar token:', err);
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Erro interno do servidor' 
                    });
                }
                
                console.log('✅ Token gerado para:', user.email);
                
                // Enviar email
                // Vem do ambiente: fixo em localhost, o email de produção
                // levava a um link quebrado.
                const baseUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`)
                    .replace(/\/+$/, '');
                const resetLink = `${baseUrl}/reset-password.html?token=${token}`;
                
                const mailOptions = {
                    from: 'UNIMAP <noreply@unimap.edu.br>',
                    to: user.email,
                    subject: 'Redefinição de Senha - UNIMAP',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #2c3e50;">Redefinição de Senha</h2>
                            <p>Olá, <strong>${user.nome}</strong>!</p>
                            <p>Recebemos uma solicitação para redefinir sua senha no UNIMAP.</p>
                            <p>Clique no botão abaixo para redefinir sua senha:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetLink}" 
                                   style="background-color: #3498db; color: white; padding: 12px 24px; 
                                          text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    Redefinir Senha
                                </a>
                            </div>
                            <p><strong>Link direto:</strong> ${resetLink}</p>
                            <p>Este link expira em 1 hora.</p>
                            <p>Se você não solicitou esta redefinição, ignore este email.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #7f8c8d; font-size: 12px;">
                                UNIMAP - Sistema de Gerenciamento Acadêmico
                            </p>
                        </div>
                    `
                };
                
                console.log('📤 Tentando enviar email para:', user.email);
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('❌ Erro ao enviar email:', error);
                        return res.status(500).json({ 
                            success: false, 
                            error: 'Erro ao enviar email de redefinição. Tente novamente em alguns minutos.' 
                        });
                    }
                    
                    console.log('✅ Email de redefinição enviado com sucesso!');
                    console.log('📧 Message ID:', info.messageId);
                    console.log('🔗 Preview URL:', nodemailer.getTestMessageUrl(info));
                    
                    res.json({ 
                        success: true, 
                        message: 'Enviamos um email com instruções para redefinir sua senha.' 
                    });
                });
            }
        );
    });
});

// Verificar token de redefinição
router.get('/verify-reset-token/:token', (req, res) => {
    const { token } = req.params;
    
    console.log('🔍 Verificando token:', token);
    
    db.get(
        `SELECT pt.*, u.email, u.nome 
         FROM password_reset_tokens pt 
         JOIN usuarios u ON pt.user_id = u.id 
         WHERE pt.token = ? AND pt.used = 0 AND pt.expires_at > datetime('now')`,
        [token],
        (err, tokenData) => {
            if (err) {
                console.error('❌ Erro ao verificar token:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Erro interno do servidor' 
                });
            }
            
            if (!tokenData) {
                console.log('❌ Token inválido ou expirado:', token);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Token inválido ou expirado' 
                });
            }
            
            res.json({ 
                success: true, 
                email: tokenData.email,
                nome: tokenData.nome
            });
        }
    );
});

// Redefinir senha
router.post('/reset-password', senhaLimiter, validate(schemas.resetSenha), (req, res) => {
    const { token, novaSenha } = req.body;
    
    console.log('🔄 Redefinindo senha para token:', token);
    
    if (!token || !novaSenha) {
        return res.status(400).json({ 
            success: false, 
            error: 'Token e nova senha são obrigatórios' 
        });
    }
    
    if (novaSenha.length < 6) {
        return res.status(400).json({ 
            success: false, 
            error: 'A senha deve ter pelo menos 6 caracteres' 
        });
    }
    
    // Verificar e usar o token
    db.get(
        `SELECT pt.*, u.id as user_id 
         FROM password_reset_tokens pt 
         JOIN usuarios u ON pt.user_id = u.id 
         WHERE pt.token = ? AND pt.used = 0 AND pt.expires_at > datetime('now')`,
        [token],
        async (err, tokenData) => {
            if (err) {
                console.error('❌ Erro ao verificar token:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Erro interno do servidor' 
                });
            }
            
            if (!tokenData) {
                console.log('❌ Token inválido ou expirado:', token);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Token inválido ou expirado' 
                });
            }
            
            try {
                // Hash da nova senha
                const senhaHash = await bcrypt.hash(novaSenha, 10);
                
                // Atualizar senha do usuário
                db.run(
                    'UPDATE usuarios SET senha_hash = ? WHERE id = ?',
                    [senhaHash, tokenData.user_id],
                    function(err) {
                        if (err) {
                            console.error('❌ Erro ao atualizar senha:', err);
                            return res.status(500).json({ 
                                success: false, 
                                error: 'Erro interno do servidor' 
                            });
                        }
                        
                        // Marcar token como usado
                        db.run(
                            'UPDATE password_reset_tokens SET used = 1 WHERE token = ?',
                            [token],
                            function(err) {
                                if (err) {
                                    console.error('❌ Erro ao marcar token como usado:', err);
                                }
                                
                                console.log('✅ Senha redefinida com sucesso para usuário:', tokenData.user_id);
                                res.json({ 
                                    success: true, 
                                    message: 'Senha redefinida com sucesso!' 
                                });
                            }
                        );
                    }
                );
                
            } catch (error) {
                console.error('❌ Erro ao criar hash da senha:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Erro interno do servidor' 
                });
            }
        }
    );
});

// Rota de login para professores
router.post('/login-professor', loginLimiter, validate(schemas.loginProfessor), (req, res) => {
    const { email, senha } = req.body;
    
    console.log('🔐 Tentativa de login professor:', email);
    
    if (!email || !senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    
    // Buscar professor por email
    db.get('SELECT * FROM professores WHERE email = ? AND ativo = 1', [email], async (err, professor) => {
        if (err) {
            console.error('❌ Erro no banco:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        // Mensagem idêntica para email inexistente e senha errada: não
        // informa a terceiros quais emails estão cadastrados.
        const credenciaisInvalidas = () =>
            res.status(401).json({ error: 'Email ou senha incorretos' });

        if (!professor) {
            console.log('❌ Login professor falhou (email não encontrado)');
            return credenciaisInvalidas();
        }

        // Professor cadastrado pelo admin ainda não definiu senha. O
        // caminho de primeiro acesso é a recuperação de senha.
        if (!professor.senha_hash) {
            console.log('❌ Login professor falhou (senha não definida)');
            return res.status(403).json({
                error: 'Primeiro acesso: defina sua senha pela opção "Esqueci a senha".'
            });
        }

        try {
            const senhaValida = await bcrypt.compare(senha, professor.senha_hash);

            if (!senhaValida) {
                console.log('❌ Login professor falhou (senha incorreta)');
                return credenciaisInvalidas();
            }

            console.log('✅ Login professor bem-sucedido:', professor.nome);

            const professorUser = {
                id: professor.id,
                nome: professor.nome,
                email: professor.email,
                tipo: 'professor',
                professor_id: professor.id
            };

            res.json({
                success: true,
                user: professorUser,
                token: sign({ id: professor.id, tipo: 'professor' })
            });

        } catch (error) {
            console.error('❌ Erro ao verificar senha:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    });
});

// Verificar se email existe
router.get('/check-email/:email', (req, res) => {
    const { email } = req.params;
    
    db.get('SELECT id, nome, email, tipo FROM usuarios WHERE email = ?', [email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            exists: !!user,
            user: user
        });
    });
});

// Verificar credenciais (email ou matrícula)
router.get('/check-credentials/:credential', (req, res) => {
    const { credential } = req.params;
    
    const isEmail = credential.includes('@');
    const query = isEmail 
        ? 'SELECT id, nome, email, matricula FROM usuarios WHERE email = ?' 
        : 'SELECT id, nome, email, matricula FROM usuarios WHERE matricula = ?';
    
    db.get(query, [credential], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            exists: !!user,
            isEmail: isEmail,
            user: user
        });
    });
});

module.exports = router;