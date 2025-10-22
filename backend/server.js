const nodemailer = require('nodemailer');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();;
const path = require('path');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');


const app = express();
const PORT = 3000;
const dbPath = path.join(__dirname, 'unimap.db');
const db = new sqlite3.Database(dbPath);

// Configurar Google OAuth
const GOOGLE_CLIENT_ID = '432080672502-ba91tog3jvoc6c0mac01iq2b5k5q3mb1.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
app.use(cors());
app.use(express.json());

// ==================== INICIALIZAR BANCO COMPLETO ====================


    function initializeDatabase() {
    db.serialize(() => {
        console.log('🔄 Criando banco de dados COMPLETO...');

        // 1. TABELA USUÁRIOS
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            matricula TEXT UNIQUE,
            tipo TEXT DEFAULT 'aluno',
            curso TEXT,
            periodo INTEGER,
            senha_hash TEXT NOT NULL,
            ativo BOOLEAN DEFAULT 1,
            data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. TABELA CURSOS
        db.run(`CREATE TABLE IF NOT EXISTS cursos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL,
            duracao INTEGER,
            turno TEXT,
            ativo BOOLEAN DEFAULT 1
        )`);

        // 3. TABELA DISCIPLINAS
        db.run(`CREATE TABLE IF NOT EXISTS disciplinas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            curso_id INTEGER,
            periodo INTEGER,
            carga_horaria INTEGER,
            ativa BOOLEAN DEFAULT 1
        )`);

        // 4. TABELA SALAS
        db.run(`CREATE TABLE IF NOT EXISTS salas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT NOT NULL,
            bloco TEXT NOT NULL,
            andar INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            capacidade INTEGER,
            recursos TEXT,
            telefone TEXT,
            email TEXT,
            campus TEXT,
            ativa BOOLEAN DEFAULT 1
        )`);

        // 5. TABELA PROFESSORES
        db.run(`CREATE TABLE IF NOT EXISTS professores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            ativo BOOLEAN DEFAULT 1
        )`);

        // 6. TABELA AULAS
        db.run(`CREATE TABLE IF NOT EXISTS aulas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            disciplina_id INTEGER,
            professor_id INTEGER,
            sala_id INTEGER,
            curso TEXT,
            turma TEXT,
            horario_inicio TIME NOT NULL,
            horario_fim TIME NOT NULL,
            dia_semana TEXT NOT NULL,
            ativa BOOLEAN DEFAULT 1
        )`);

        // 7. TABELA PROFESSORES FAVORITOS
        db.run(`CREATE TABLE IF NOT EXISTS professores_favoritos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER,
            professor_id INTEGER,
            data_adicao DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(aluno_id, professor_id)
        )`);

        // 8. MATRÍCULAS
        db.run(`CREATE TABLE IF NOT EXISTS matriculas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER,
            disciplina_id INTEGER,
            periodo INTEGER,
            data_matricula DATETIME DEFAULT CURRENT_TIMESTAMP,
            situacao TEXT DEFAULT 'cursando'
        )`);

        // 9. HORÁRIOS
        db.run(`CREATE TABLE IF NOT EXISTS horarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            horario_inicio TIME NOT NULL,
            horario_fim TIME NOT NULL
        )`);

        // ========== DADOS INICIAIS ==========
        
        // Admin
        bcrypt.hash('admin123', 10, (err, hash) => {
            if (err) {
                console.error('❌ Erro ao criar hash do admin:', err);
                return;
            }
            db.run(`INSERT OR IGNORE INTO usuarios (nome, email, tipo, senha_hash) VALUES 
                ('Administrador', 'admin@unipam.edu.br', 'admin', ?)`, [hash], function(err) {
                if (err) {
                    console.error('❌ Erro ao inserir admin:', err);
                } else {
                    console.log('✅ Admin criado com ID:', this.lastID);
                }
            });
        });

        // Cursos
        db.run(`INSERT OR IGNORE INTO cursos (nome, duracao, turno) VALUES 
            ('Sistemas de Informação', 8, 'Noturno'),
            ('Administração', 8, 'Matutino'),
            ('Direito', 10, 'Integral')`, function(err) {
            if (err) {
                console.error('❌ Erro ao inserir cursos:', err);
            } else {
                console.log('✅ Cursos inseridos');
            }
        });

        // Disciplinas SI
        db.run(`INSERT OR IGNORE INTO disciplinas (nome, curso_id, periodo, carga_horaria) VALUES 
            ('Programação Web', 1, 3, 80),
            ('Banco de Dados', 1, 2, 60),
            ('Engenharia de Software', 1, 4, 80),
            ('Redes de Computadores', 1, 3, 60)`, function(err) {
            if (err) {
                console.error('❌ Erro ao inserir disciplinas:', err);
            } else {
                console.log('✅ Disciplinas inseridas');
            }
        });

        // Professores
        db.run(`INSERT OR IGNORE INTO professores (nome, email) VALUES 
            ('João Silva', 'joao.silva@unipam.edu.br'),
            ('Maria Santos', 'maria.santos@unipam.edu.br'),
            ('Pedro Costa', 'pedro.costa@unipam.edu.br')`, function(err) {
            if (err) {
                console.error('❌ Erro ao inserir professores:', err);
            } else {
                console.log('✅ Professores inseridos');
            }
        });

        // Horários
        db.run(`INSERT OR IGNORE INTO horarios (nome, horario_inicio, horario_fim) VALUES 
            ('M1', '07:30', '09:10'),
            ('M2', '09:20', '11:00'),
            ('M3', '11:10', '12:50'),
            ('T1', '13:00', '14:40'),
            ('T2', '14:50', '16:30'),
            ('N1', '19:00', '20:40'),
            ('N2', '20:50', '22:30')`, function(err) {
            if (err) {
                console.error('❌ Erro ao inserir horários:', err);
            } else {
                console.log('✅ Horários inseridos');
            }
        });

       
        criarSalasIniciais();
        console.log('✅ Banco COMPLETO criado!');
    });
}


// 🔥 TABELA PARA TOKENS DE REDEFINIÇÃO DE SENHA
db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios (id)
)`);

// ==================== INICIALIZAR TABELA ALUNO_TURMAS ====================
function initializeAlunoTurmasTable() {
    console.log('🔄 Criando/verificando tabela aluno_turmas...');
    
    db.run(`CREATE TABLE IF NOT EXISTS aluno_turmas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        turma_id INTEGER NOT NULL,
        data_matricula DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'cursando',
        FOREIGN KEY (aluno_id) REFERENCES usuarios (id),
        FOREIGN KEY (turma_id) REFERENCES turmas (id),
        UNIQUE(aluno_id, turma_id)
    )`, (err) => {
        if (err) {
            console.error('❌ Erro ao criar tabela aluno_turmas:', err);
        } else {
            console.log('✅ Tabela aluno_turmas verificada/criada com sucesso!');
        }
    });
}

// Chame esta função no início, após conectar ao banco
initializeAlunoTurmasTable();


// 🔥 CRIAR TABELA ALUNO_TURMAS IMEDIATAMENTE
console.log('🔄 Verificando/Criando tabela aluno_turmas...');
db.run(`CREATE TABLE IF NOT EXISTS aluno_turmas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno_id INTEGER NOT NULL,
    turma_id INTEGER NOT NULL,
    data_matricula DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'cursando',
    FOREIGN KEY (aluno_id) REFERENCES usuarios (id),
    FOREIGN KEY (turma_id) REFERENCES turmas (id),
    UNIQUE(aluno_id, turma_id)
)`, function(err) {
    if (err) {
        console.error('❌ Erro ao criar tabela aluno_turmas:', err);
    } else {
        console.log('✅ Tabela aluno_turmas verificada/criada com sucesso!');
        
        // Verificar se existem registros
        db.get('SELECT COUNT(*) as total FROM aluno_turmas', [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao contar registros:', err);
            } else {
                console.log(`📊 Total de registros em aluno_turmas: ${row.total}`);
            }
        });
    }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'arthurroquemeloneiva@gmail.com', 
        pass: 'ciuh jipe kfxq jkug'     
    }

});
app.post('/api/auth/forgot-password', (req, res) => {
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
                const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;
                
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
// 2. VERIFICAR TOKEN DE REDEFINIÇÃO
app.get('/api/auth/verify-reset-token/:token', (req, res) => {
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

// 3. REDEFINIR SENHA
app.post('/api/auth/reset-password', (req, res) => {
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

// 🔥 FUNÇÃO PARA CRIAR SALAS DE A a N
function criarSalasIniciais() {
    console.log('🏗️ Criando salas para blocos A-N...');
    
    const blocos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
    const tiposSala = ['Sala de Aula', 'Laboratório', 'Auditório', 'Sala de Reunião'];
    
    blocos.forEach(bloco => {
        // Cada bloco tem 4 andares (Térreo + 3 andares)
        for (let andar = 0; andar <= 3; andar++) {
            // Cada andar tem 8-12 salas
            const numSalas = Math.floor(Math.random() * 5) + 8;
            
            for (let i = 1; i <= numSalas; i++) {
                const capacidade = Math.floor(Math.random() * 40) + 20; // 20-60 lugares
                const tipo = tiposSala[Math.floor(Math.random() * tiposSala.length)];
                const numeroSala = `${bloco}${andar}${i.toString().padStart(2, '0')}`;
                
                db.run(
                    `INSERT OR IGNORE INTO salas 
                     (numero, bloco, andar, tipo, capacidade, recursos, campus, ativa) 
                     VALUES (?, ?, ?, ?, ?, ?, 'Campus Principal', 1)`,
                    [
                        numeroSala,
                        bloco,
                        andar,
                        tipo,
                        capacidade,
                        'Projetor, Ar-condicionado, Quadro branco',
                    ],
                    function(err) {
                        if (err && !err.message.includes('UNIQUE')) {
                            console.error(`❌ Erro ao criar sala ${numeroSala}:`, err);
                        }
                    }
                );
            }
        }
    });
    
    console.log('✅ Salas dos blocos A-N criadas!');
}

// Inicializar banco
 //initializeDatabase();

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    // Verificar se é um token numérico (ID do usuário)
    const userId = parseInt(token);
    if (isNaN(userId)) {
        return res.status(403).json({ error: 'Token inválido' });
    }

    db.get('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [userId], (err, user) => {
        if (err || !user) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    next();
}

// ==================== ROTA DE LOGIN ====================
// ==================== ROTA DE LOGIN MODIFICADA ====================
app.post('/api/auth/login', (req, res) => {
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
                token: user.id.toString()
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

// ==================== GOOGLE OAUTH ====================
app.post('/api/auth/google', async (req, res) => {
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
                    token: user.id.toString()
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
                            token: this.lastID.toString()
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
app.get('/api/professores/:id/favoritos-count', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log('⭐ Buscando favoritos do professor:', id);
    
    const query = `
        SELECT 
            COUNT(*) as count,
            GROUP_CONCAT(u.nome) as nomes_alunos,
            GROUP_CONCAT(u.curso) as cursos_alunos
        FROM professores_favoritos pf
        JOIN usuarios u ON pf.aluno_id = u.id
        WHERE pf.professor_id = ? AND u.ativo = 1
    `;
    
    db.get(query, [id], (err, result) => {
        if (err) {
            console.error('❌ Erro ao contar favoritos:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        
        console.log('✅ Favoritos encontrados:', result);
        
        // Processar resultado
        let alunos = [];
        if (result && result.nomes_alunos) {
            const nomes = result.nomes_alunos.split(',');
            const cursos = result.cursos_alunos ? result.cursos_alunos.split(',') : [];
            
            alunos = nomes.map((nome, index) => ({
                nome: nome.trim(),
                curso: cursos[index] ? cursos[index].trim() : 'Sem curso'
            }));
        }
        
        res.json({
            count: result ? (result.count || 0) : 0,
            alunos: alunos
        });
    });
});

// GET /api/aulas/professor/:professor_id - Aulas de um professor específico
app.post('/api/aulas', authenticateToken, (req, res) => {
    const { disciplina, sala_id, turma_id, horario_inicio, horario_fim, dia_semana } = req.body;
    
    // Buscar informações da turma para preencher curso e turma automaticamente
    db.get('SELECT * FROM turmas WHERE id = ?', [turma_id], (err, turma) => {
        if (err || !turma) {
            return res.status(400).json({ error: 'Turma não encontrada' });
        }
        
        // Buscar curso da turma
        db.get('SELECT nome FROM cursos WHERE id = ?', [turma.curso_id], (err, curso) => {
            // Resto da lógica de criação de aula...
            db.run(
                `INSERT INTO aulas (disciplina_id, professor_id, sala_id, turma_id, curso, turma, horario_inicio, horario_fim, dia_semana, ativa) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [disciplinaId, professorId, sala_id, turma_id, curso.nome, turma.nome, horario_inicio, horario_fim, dia_semana],
                function(err) {
                    // ... tratamento de erros
                }
            );
        });
    });


    // Função para buscar ou criar disciplina
    const buscarOuCriarDisciplina = (nomeDisciplina, callback) => {
        console.log('🔍 Buscando disciplina:', nomeDisciplina);
        
        // Primeiro, tentar buscar a disciplina pelo nome
        db.get('SELECT id FROM disciplinas WHERE nome = ?', [nomeDisciplina], (err, disciplina) => {
            if (err) {
                console.error('❌ Erro ao buscar disciplina:', err);
                return callback(err, null);
            }

            if (disciplina) {
                console.log('✅ Disciplina encontrada:', disciplina.id);
                return callback(null, disciplina.id);
            } else {
                // Disciplina não existe, criar uma nova
                console.log('🔄 Criando nova disciplina...');
                
                // Para criar uma disciplina, precisamos de um curso_id
                // Vamos usar o primeiro curso disponível como fallback
                db.get('SELECT id FROM cursos LIMIT 1', [], (err, curso) => {
                    if (err) {
                        console.error('❌ Erro ao buscar curso para disciplina:', err);
                        return callback(err, null);
                    }

                    const cursoId = curso ? curso.id : 1; // Fallback para curso 1
                    
                    db.run(
                        'INSERT INTO disciplinas (nome, curso_id, periodo, carga_horaria, ativa) VALUES (?, ?, 1, 60, 1)',
                        [nomeDisciplina, cursoId],
                        function(insertErr) {
                            if (insertErr) {
                                console.error('❌ Erro ao criar disciplina:', insertErr);
                                return callback(insertErr, null);
                            }
                            
                            const novaDisciplinaId = this.lastID;
                            console.log('✅ Disciplina criada com ID:', novaDisciplinaId);
                            callback(null, novaDisciplinaId);
                        }
                    );
                });
            }
        });
    };

    // Função para criar a aula
    const criarAula = (professorId, disciplinaId) => {
        console.log('🎯 Criando aula para:', { professorId, disciplinaId });
        
        // Validar dados obrigatórios
        if (!disciplinaId || !sala_id || !curso || !turma || !horario_inicio || !horario_fim || !dia_semana) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // Inserir a aula usando a estrutura CORRETA da tabela
        db.run(
            `INSERT INTO aulas (disciplina_id, professor_id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana, ativa) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [disciplinaId, professorId, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao criar aula:', err);
                    
                    // Tratar erros específicos
                    if (err.message.includes('FOREIGN KEY')) {
                        if (err.message.includes('sala_id')) {
                            return res.status(400).json({ error: 'Sala inválida ou não encontrada' });
                        }
                        if (err.message.includes('disciplina_id')) {
                            return res.status(400).json({ error: 'Disciplina inválida' });
                        }
                    }
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Já existe uma aula com esses dados' });
                    }
                    
                    return res.status(400).json({ error: 'Erro ao criar aula: ' + err.message });
                }
                
                console.log('✅ Aula criada com ID:', this.lastID);
                res.json({ 
                    success: true, 
                    message: 'Aula criada com sucesso!', 
                    id: this.lastID 
                });
            }
        );
    };

    // Executar o processo completo
    criarOuBuscarProfessor((err, professorId) => {
        if (err) {
            console.error('❌ Erro no processo de professor:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        
        if (!professorId) {
            return res.status(500).json({ error: 'Não foi possível criar ou encontrar o professor' });
        }
        
        // Agora buscar/criar a disciplina
        buscarOuCriarDisciplina(disciplina, (err, disciplinaId) => {
            if (err) {
                console.error('❌ Erro no processo de disciplina:', err);
                return res.status(500).json({ error: 'Erro ao processar disciplina' });
            }
            
            if (!disciplinaId) {
                return res.status(500).json({ error: 'Não foi possível criar ou encontrar a disciplina' });
            }
            
            // Finalmente criar a aula
            criarAula(professorId, disciplinaId);
        });
    });
});

// GET /api/professores/stats - Estatísticas gerais de professores
app.get('/api/professores/stats', authenticateToken, requireAdmin, (req, res) => {
    console.log('📊 Buscando estatísticas de professores...');
    
    const queries = [
        'SELECT COUNT(*) as total FROM professores WHERE ativo = 1',
        `SELECT COUNT(DISTINCT pf.professor_id) as total_com_favoritos 
         FROM professores_favoritos pf 
         JOIN professores p ON pf.professor_id = p.id 
         WHERE p.ativo = 1`,
        `SELECT p.id, p.nome, COUNT(pf.id) as total_favoritos
         FROM professores p
         LEFT JOIN professores_favoritos pf ON p.id = pf.professor_id
         WHERE p.ativo = 1
         GROUP BY p.id
         ORDER BY total_favoritos DESC
         LIMIT 5`
    ];
    
    db.serialize(() => {
        const results = {};
        let completed = 0;
        
        // Total de professores
        db.get(queries[0], [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de professores:', err);
                results.total_professores = 0;
            } else {
                results.total_professores = row ? row.total : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Professores com favoritos
        db.get(queries[1], [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar professores com favoritos:', err);
                results.professores_com_favoritos = 0;
            } else {
                results.professores_com_favoritos = row ? row.total_com_favoritos : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Top professores
        db.all(queries[2], [], (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar top professores:', err);
                results.top_professores = [];
            } else {
                results.top_professores = rows || [];
            }
            completed++;
            checkComplete();
        });
        
        function checkComplete() {
            if (completed === queries.length) {
                console.log('✅ Estatísticas carregadas:', results);
                res.json(results);
            }
        }
    });
});

// Rota alternativa para favoritos (caso a primeira não funcione)
app.get('/api/professores/:id/favoritos', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log('⭐ Buscando favoritos (rota alternativa) para professor:', id);
    
    const query = `
        SELECT 
            u.id as aluno_id,
            u.nome as aluno_nome,
            u.email as aluno_email,
            u.curso as aluno_curso,
            u.periodo as aluno_periodo
        FROM professores_favoritos pf
        JOIN usuarios u ON pf.aluno_id = u.id
        WHERE pf.professor_id = ? AND u.ativo = 1
        ORDER BY u.nome
    `;
    
    db.all(query, [id], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar favoritos (alternativa):', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        
        console.log(`✅ ${rows.length} favoritos encontrados para professor ${id}`);
        
        res.json({
            count: rows.length,
            alunos: rows.map(row => ({
                id: row.aluno_id,
                nome: row.aluno_nome,
                email: row.aluno_email,
                curso: row.aluno_curso,
                periodo: row.aluno_periodo
            }))
        });
    });
});

// ==================== CADASTRO DE USUÁRIO ====================
app.post('/api/auth/register', async (req, res) => {
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

// ==================== ROTAS DE DASHBOARD ====================
app.get('/api/dashboard/estatisticas', authenticateToken, (req, res) => {
    const queries = [
        'SELECT COUNT(*) as total FROM usuarios WHERE ativo = 1',
        'SELECT COUNT(*) as total FROM professores WHERE ativo = 1',
        'SELECT COUNT(*) as total FROM salas WHERE ativa = 1',
        'SELECT COUNT(*) as total FROM aulas WHERE ativa = 1'
    ];

    db.serialize(() => {
        const results = {};
        let completed = 0;

        queries.forEach((query, index) => {
            db.get(query, [], (err, row) => {
                if (err) {
                    console.error('❌ Erro na query:', query, err);
                    results[['total_usuarios', 'total_professores', 'total_salas', 'total_aulas'][index]] = 0;
                } else {
                    results[['total_usuarios', 'total_professores', 'total_salas', 'total_aulas'][index]] = row.total;
                }
                completed++;

                if (completed === queries.length) {
                    res.json(results);
                }
            });
        });
    });
});

// ==================== ROTAS DE CURSOS ====================
// ROTA PARA CURSOS - Garantir que existe
app.get('/api/cursos', authenticateToken, (req, res) => {
    console.log('🎓 Buscando cursos...');
    
    db.all('SELECT * FROM cursos WHERE ativo = 1 ORDER BY nome', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar cursos:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ ${rows.length} cursos encontrados`);
        res.json(rows);
    });
});

app.post('/api/cursos', authenticateToken, requireAdmin, (req, res) => {
    const { nome, duracao, turno } = req.body;
    
    db.run(
        'INSERT INTO cursos (nome, duracao, turno) VALUES (?, ?, ?)',
        [nome, duracao, turno],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar curso:', err);
                return res.status(400).json({ error: err.message });
            }
            res.json({ success: true, message: 'Curso criado!', id: this.lastID });
        }
    );
});

// ==================== ROTAS DE SALAS COMPLETAS ====================

// GET /api/salas - Retorna todas as salas
app.get('/api/salas', authenticateToken, (req, res) => {
    db.all('SELECT * FROM salas ORDER BY bloco, andar, numero', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar salas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// POST /api/salas - Criar nova sala
app.post('/api/salas', authenticateToken, requireAdmin, (req, res) => {
    const { numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus } = req.body;
    
    console.log('🏫 Criando nova sala:', { numero, bloco, andar });
    
    db.run(
        `INSERT INTO salas 
         (numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus, ativa) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [numero, bloco, andar, tipo, capacidade, recursos || '', telefone || '', email || '', campus || ''],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            console.log('✅ Sala criada com ID:', this.lastID);
            res.json({ 
                success: true, 
                message: 'Sala criada com sucesso!', 
                id: this.lastID 
            });
        }
    );
});

// GET /api/salas/blocos - Estatísticas dos blocos
app.get('/api/salas/blocos', authenticateToken, (req, res) => {
    const query = `
        SELECT 
            bloco as letra,
            COUNT(*) as total_salas,
            COUNT(DISTINCT andar) as total_andares
        FROM salas 
        WHERE ativa = 1
        GROUP BY bloco 
        ORDER BY bloco
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar blocos:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GET /api/salas/bloco/:bloco/andares - Andares de um bloco
app.get('/api/salas/bloco/:bloco/andares', authenticateToken, (req, res) => {
    const { bloco } = req.params;
    
    const query = `
        SELECT DISTINCT andar 
        FROM salas 
        WHERE bloco = ? AND ativa = 1
        ORDER BY andar
    `;
    
    db.all(query, [bloco], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar andares:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Converter números para nomes de andares
        const andaresFormatados = rows.map(row => {
            switch(row.andar) {
                case 0: return 'Térreo';
                case 1: return '1º Andar';
                case 2: return '2º Andar';
                case 3: return '3º Andar';
                default: return `${row.andar}º Andar`;
            }
        });
        
        res.json(andaresFormatados);
    });
});

// GET /api/salas/bloco/:bloco/andar/:andar - Salas de um andar
app.get('/api/salas/bloco/:bloco/andar/:andar', authenticateToken, (req, res) => {
    const { bloco, andar } = req.params;
    
    // Converter nome do andar para número
    let andarNumero;
    switch(andar) {
        case 'Térreo': andarNumero = 0; break;
        case '1º Andar': andarNumero = 1; break;
        case '2º Andar': andarNumero = 2; break;
        case '3º Andar': andarNumero = 3; break;
        default: andarNumero = parseInt(andar); // Caso já seja número
    }
    
    const query = `
        SELECT 
            id, numero, bloco, andar, tipo, capacidade, recursos,
            telefone, email, campus, ativa
        FROM salas 
        WHERE bloco = ? AND andar = ? AND ativa = 1
        ORDER BY numero
    `;
    
    db.all(query, [bloco, andarNumero], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar salas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GET /api/salas/bloco/:bloco - Salas de um bloco específico
app.get('/api/salas/bloco/:bloco', authenticateToken, (req, res) => {
    const { bloco } = req.params;
    
    db.all(
        'SELECT * FROM salas WHERE bloco = ? AND ativa = 1 ORDER BY andar, numero',
        [bloco],
        (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar salas do bloco:', bloco, err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// PUT /api/salas/:id - Atualizar sala
app.put('/api/salas/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus } = req.body;
    
    db.run(
        `UPDATE salas SET 
            numero = ?, bloco = ?, andar = ?, tipo = ?, capacidade = ?, 
            recursos = ?, telefone = ?, email = ?, campus = ?
         WHERE id = ?`,
        [numero, bloco, andar, tipo, capacidade, recursos || '', telefone || '', email || '', campus || '', id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Sala não encontrada' });
            }
            
            res.json({ success: true, message: 'Sala atualizada com sucesso!' });
        }
    );
});

// DELETE /api/salas/:id - Desativar sala
app.delete('/api/salas/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run(
        'UPDATE salas SET ativa = 0 WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao desativar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Sala não encontrada' });
            }
            
            res.json({ success: true, message: 'Sala desativada com sucesso!' });
        }
    );
});

// ==================== ROTAS DE PROFESSORES ====================
app.get('/api/professores', authenticateToken, (req, res) => {
    db.all('SELECT * FROM professores WHERE ativo = 1 ORDER BY nome', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar professores:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/professores/favoritos', authenticateToken, (req, res) => {
    const { aluno_id, professor_id } = req.body;
    
    db.run(
        'INSERT OR IGNORE INTO professores_favoritos (aluno_id, professor_id) VALUES (?, ?)',
        [aluno_id, professor_id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao adicionar favorito:', err);
                return res.status(400).json({ error: err.message });
            }
            res.json({ success: true, message: 'Professor adicionado aos favoritos!' });
        }
    );
});

app.get('/api/professores/favoritos/:aluno_id', authenticateToken, (req, res) => {
    const { aluno_id } = req.params;
    
    db.all(
        `SELECT p.* FROM professores p 
         JOIN professores_favoritos pf ON p.id = pf.professor_id 
         WHERE pf.aluno_id = ? AND p.ativo = 1`,
        [aluno_id],
        (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar professores favoritos:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Rota para remover professor dos favoritos
app.delete('/api/professores/favoritos/:aluno_id/:professor_id', authenticateToken, (req, res) => {
    const { aluno_id, professor_id } = req.params;
    
    db.run(
        'DELETE FROM professores_favoritos WHERE aluno_id = ? AND professor_id = ?',
        [aluno_id, professor_id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao remover favorito:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Favorito não encontrado' });
            }
            
            res.json({ success: true, message: 'Professor removido dos favoritos!' });
        }
    );
});

// Rota para adicionar/editar professor (apenas admin)
app.post('/api/professores', authenticateToken, requireAdmin, (req, res) => {
    const { nome, email } = req.body;
    
    if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }

    db.run(
        'INSERT INTO professores (nome, email) VALUES (?, ?)',
        [nome, email],
        function(err) {
            if (err) {
                console.error('❌ Erro ao adicionar professor:', err);
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Este email já está cadastrado' });
                }
                return res.status(400).json({ error: err.message });
            }
            res.json({ 
                success: true, 
                message: 'Professor cadastrado com sucesso!', 
                id: this.lastID 
            });
        }
    );
});

// Rota para editar professor
app.put('/api/professores/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, email } = req.body;

    db.run(
        'UPDATE professores SET nome = ?, email = ? WHERE id = ?',
        [nome, email, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao editar professor:', err);
                return res.status(400).json({ error: err.message });
            }
            res.json({ success: true, message: 'Professor atualizado com sucesso!' });
        }
    );
});

// Rota para alterar status do professor
app.put('/api/professores/:id/status', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;

    db.run(
        'UPDATE professores SET ativo = ? WHERE id = ?',
        [ativo, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar professor:', err);
                return res.status(400).json({ error: err.message });
            }
            res.json({ success: true, message: 'Status atualizado com sucesso!' });
        }
    );
});

// ==================== ROTA DE LOGIN PARA PROFESSORES ====================
app.post('/api/auth/login-professor', (req, res) => {
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
        
        if (!professor) {
            console.log('❌ Professor não encontrado:', email);
            return res.status(401).json({ error: 'Email não encontrado' });
        }
        
        try {
            // Para professores, vamos usar uma senha simples por enquanto
            // Você pode implementar bcrypt depois se quiser
            if (senha !== 'prof123') { // Senha padrão para professores
                console.log('❌ Senha incorreta para professor:', email);
                return res.status(401).json({ error: 'Senha incorreta' });
            }
            
            console.log('✅ Login professor bem-sucedido:', professor.nome);
            
            // Criar um usuário temporário para o professor no sistema
            const professorUser = {
                id: `prof_${professor.id}`,
                nome: professor.nome,
                email: professor.email,
                tipo: 'professor',
                professor_id: professor.id
            };
            
            res.json({
                success: true,
                user: professorUser,
                token: professorUser.id
            });
            
        } catch (error) {
            console.error('❌ Erro ao verificar senha:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    });
});

// ==================== ROTAS DE AULAS ====================
// ROTA CORRIGIDA PARA CRIAR AULAS (PROFESSORES)
app.post('/api/aulas', authenticateToken, (req, res) => {
    const { disciplina, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana } = req.body;
    
    console.log('📝 Tentativa de criar aula (ROTA CORRIGIDA):', { 
        disciplina, 
        sala_id, 
        curso, 
        turma, 
        user: req.user 
    });

    // Verificar se é professor
    if (req.user.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem criar aulas' });
    }

    // Buscar professor_id baseado no email do usuário logado
    db.get('SELECT id FROM professores WHERE email = ?', [req.user.email], (err, professor) => {
        if (err) {
            console.error('❌ Erro ao buscar professor:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        if (!professor) {
            console.error('❌ Professor não encontrado para email:', req.user.email);
            return res.status(404).json({ error: 'Professor não encontrado. Contate o administrador.' });
        }

        console.log('✅ Professor encontrado:', professor.id);

        // Buscar ou criar disciplina
        db.get('SELECT id FROM disciplinas WHERE nome = ?', [disciplina], (err, disciplinaExistente) => {
            if (err) {
                console.error('❌ Erro ao buscar disciplina:', err);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }

            let disciplinaId;
            
            if (disciplinaExistente) {
                disciplinaId = disciplinaExistente.id;
                console.log('✅ Disciplina encontrada:', disciplinaId);
            } else {
                // Criar disciplina se não existir
                console.log('🔄 Criando nova disciplina:', disciplina);
                db.run(
                    'INSERT INTO disciplinas (nome, curso_id, periodo, carga_horaria, ativa) VALUES (?, 1, 1, 60, 1)',
                    [disciplina],
                    function(err) {
                        if (err) {
                            console.error('❌ Erro ao criar disciplina:', err);
                            return res.status(500).json({ error: 'Erro ao criar disciplina' });
                        }
                        disciplinaId = this.lastID;
                        console.log('✅ Nova disciplina criada:', disciplinaId);
                        criarAula(disciplinaId);
                    }
                );
                return;
            }

            // Se disciplina já existe, criar aula
            criarAula(disciplinaId);
        });

        function criarAula(disciplinaId) {
            // Inserir a aula
            db.run(
                `INSERT INTO aulas (disciplina_id, professor_id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana, ativa) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [disciplinaId, professor.id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana],
                function(err) {
                    if (err) {
                        console.error('❌ Erro ao criar aula:', err);
                        
                        // Tratar erros específicos
                        if (err.message.includes('FOREIGN KEY')) {
                            if (err.message.includes('sala_id')) {
                                return res.status(400).json({ error: 'Sala inválida ou não encontrada' });
                            }
                        }
                        if (err.message.includes('UNIQUE')) {
                            return res.status(400).json({ error: 'Já existe uma aula com esses dados' });
                        }
                        
                        return res.status(400).json({ error: 'Erro ao criar aula: ' + err.message });
                    }
                    
                    console.log('✅ Aula criada com ID:', this.lastID);
                    res.json({ 
                        success: true, 
                        message: 'Aula criada com sucesso!', 
                        id: this.lastID 
                    });
                }
            );
        }
    });
});

// ROTA PARA CARREGAR AULAS DO USUÁRIO - VERSÃO CORRIGIDA
app.get('/api/aulas/usuario/:usuario_id', authenticateToken, (req, res) => {
    const { usuario_id } = req.params;
    
    console.log('📚 Buscando aulas para usuário:', usuario_id);
    
    // Buscar informações do usuário
    db.get('SELECT * FROM usuarios WHERE id = ?', [usuario_id], (err, user) => {
        if (err || !user) {
            console.error('❌ Usuário não encontrado:', usuario_id);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        console.log('👤 Usuário encontrado:', user.nome, '- Tipo:', user.tipo);
        
        let query, params;
        
        if (user.tipo === 'professor') {
            // 🔥 CORREÇÃO: Buscar aulas pelo email do professor na tabela professores
            console.log('🔍 Buscando aulas do professor pelo email:', user.email);
            
            query = `
                SELECT 
                    a.*, 
                    d.nome as disciplina_nome,
                    s.numero as sala_numero, 
                    s.bloco as sala_bloco,
                    s.andar as sala_andar,
                    p.nome as professor_nome
                FROM aulas a
                LEFT JOIN disciplinas d ON a.disciplina_id = d.id
                LEFT JOIN salas s ON a.sala_id = s.id
                LEFT JOIN professores p ON a.professor_id = p.id
                WHERE p.email = ? AND a.ativa = 1
                ORDER BY a.dia_semana, a.horario_inicio
            `;
            params = [user.email];
        } else {
            // Para alunos e admin, usar a lógica existente
            query = `
                SELECT a.*, p.nome as professor_nome, s.numero as sala_numero, s.bloco as sala_bloco,
                       d.nome as disciplina_nome
                FROM aulas a
                LEFT JOIN professores p ON a.professor_id = p.id
                LEFT JOIN salas s ON a.sala_id = s.id
                LEFT JOIN disciplinas d ON a.disciplina_id = d.id
                WHERE a.ativa = 1
                ORDER BY a.dia_semana, a.horario_inicio
            `;
            params = [];
        }
        
        console.log('📊 Executando query:', query);
        console.log('📋 Parâmetros:', params);
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar aulas do usuário:', err);
                return res.status(500).json({ error: err.message });
            }
            
            console.log(`✅ ${rows.length} aulas encontradas para o usuário`);
            res.json(rows);
        });
    });
});

// ROTA PARA CRIAR AULAS (PROFESSORES)
app.post('/api/aulas', authenticateToken, (req, res) => {
    const { disciplina, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana } = req.body;
    
    console.log('📝 Tentativa de criar aula:', { disciplina, curso, turma });

    // Verificar se é professor
    if (req.user.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem criar aulas' });
    }

    // Buscar professor_id baseado no email do usuário logado
    db.get('SELECT id FROM professores WHERE email = ?', [req.user.email], (err, professor) => {
        if (err) {
            console.error('❌ Erro ao buscar professor:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        if (!professor) {
            console.error('❌ Professor não encontrado para email:', req.user.email);
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        // Inserir a aula
        db.run(
            `INSERT INTO aulas (disciplina, professor_id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [disciplina, professor.id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao criar aula:', err);
                    return res.status(400).json({ error: err.message });
                }
                
                console.log('✅ Aula criada com ID:', this.lastID);
                res.json({ 
                    success: true, 
                    message: 'Aula criada com sucesso!', 
                    id: this.lastID 
                });
            }
        );
    });
});

// ROTA PARA EXCLUIR AULAS
app.delete('/api/aulas/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    // Verificar se é professor
    if (req.user.tipo !== 'professor') {
        return res.status(403).json({ error: 'Apenas professores podem excluir aulas' });
    }

    db.run('DELETE FROM aulas WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('❌ Erro ao excluir aula:', err);
            return res.status(400).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Aula não encontrada' });
        }

        res.json({ 
            success: true, 
            message: 'Aula excluída com sucesso!' 
        });
    });
});

// ==================== ROTAS DE USUÁRIOS ====================
app.get('/api/usuarios', authenticateToken, requireAdmin, (req, res) => {
    console.log('👥 Buscando todos os usuários...');
    
    const query = `
        SELECT id, nome, email, matricula, tipo, curso, periodo, data_cadastro 
        FROM usuarios 
        WHERE ativo = 1 
        ORDER BY nome
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar usuários:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} usuários encontrados`);
        res.json({ success: true, data: rows });
    });
});

app.get('/api/usuario/perfil', authenticateToken, (req, res) => {
    db.get(
        'SELECT id, nome, email, matricula, tipo, curso, periodo, data_cadastro FROM usuarios WHERE id = ?',
        [req.user.id],
        (err, user) => {
            if (err || !user) {
                console.error('❌ Erro ao buscar perfil:', err);
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            res.json(user);
        }
    );
});

// Rota para atualizar usuário completo
app.put('/api/usuarios/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, email, matricula, tipo, curso, periodo } = req.body;

    console.log('✏️ Atualizando usuário:', { id, nome, email, tipo });

    if (!nome || !email || !tipo) {
        return res.status(400).json({ error: 'Nome, email e tipo são obrigatórios' });
    }

    db.run(
        `UPDATE usuarios 
         SET nome = ?, email = ?, matricula = ?, tipo = ?, curso = ?, periodo = ?
         WHERE id = ?`,
        [nome, email, matricula, tipo, curso, periodo, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar usuário:', err);
                
                if (err.message.includes('UNIQUE constraint failed')) {
                    if (err.message.includes('email')) {
                        return res.status(400).json({ error: 'Este email já está em uso' });
                    } else if (err.message.includes('matricula')) {
                        return res.status(400).json({ error: 'Esta matrícula já está em uso' });
                    }
                }
                
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            console.log('✅ Usuário atualizado com sucesso');
            res.json({ 
                success: true, 
                message: 'Usuário atualizado com sucesso!' 
            });
        }
    );
});


// Rota para atualizar tipo de usuário (apenas admin)
app.put('/api/usuarios/:id/tipo', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;

    console.log('🔄 Alterando tipo do usuário:', { id, tipo });

    if (!['aluno', 'professor', 'admin'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de usuário inválido' });
    }

    // Verificar se o usuário existe
    db.get('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [id], (err, user) => {
        if (err) {
            console.error('❌ Erro ao verificar usuário:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Preparar dados para atualização
        let updateData = { tipo: tipo };
        let updateQuery = 'UPDATE usuarios SET tipo = ?';
        let params = [tipo];

        // Limpar campos específicos conforme o tipo
        if (tipo === 'professor') {
            updateQuery += ', matricula = NULL, periodo = NULL, curso = NULL';
        } else if (tipo === 'admin') {
            updateQuery += ', matricula = NULL, periodo = NULL';
        }

        updateQuery += ' WHERE id = ?';
        params.push(id);

        db.run(updateQuery, params, function(err) {
            if (err) {
                console.error('❌ Erro ao alterar tipo de usuário:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            console.log('✅ Tipo de usuário alterado com sucesso');
            res.json({ 
                success: true, 
                message: `Usuário atualizado para ${tipo} com sucesso!` 
            });
        });
    });
});

// ==================== ROTAS GERAIS ====================
app.get('/api/horarios', authenticateToken, (req, res) => {
    db.all('SELECT * FROM horarios ORDER BY horario_inicio', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar horários:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ==================== ROTAS DE DEBUG ====================
app.get('/api/debug/usuarios', (req, res) => {
    db.all('SELECT id, nome, email, matricula, tipo, curso, periodo, data_cadastro FROM usuarios WHERE ativo = 1', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            total: rows.length,
            usuarios: rows
        });
    });
});

app.get('/api/debug/salas', (req, res) => {
    const query = `
        SELECT 
            id, numero, bloco, andar, tipo, capacidade,
            COUNT(*) OVER (PARTITION BY bloco) as total_bloco
        FROM salas 
        WHERE ativa = 1
        ORDER BY bloco, andar, numero
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const resumo = rows.reduce((acc, sala) => {
            acc[sala.bloco] = (acc[sala.bloco] || 0) + 1;
            return acc;
        }, {});
        
        res.json({
            total_salas: rows.length,
            salas_por_bloco: resumo,
            salas: rows
        });
    });
});


// Rota para verificar status do banco
app.get('/api/status', (req, res) => {
    db.get('SELECT COUNT(*) as total_tables FROM sqlite_master WHERE type="table"', [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao verificar banco' });
        }
        res.json({
            status: '✅ Online',
            porta: PORT,
            total_tabelas: row.total_tables,
            banco: 'SQLite (unimap.db)',
            google_oauth: '✅ Configurado'
        });
    });
});

// Rota para verificar se email existe
app.get('/api/auth/check-email/:email', (req, res) => {
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

app.get('/api/auth/check-credentials/:credential', (req, res) => {
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

// ==================== SERVIR ARQUIVOS DO FRONTEND ====================
// Serve arquivos estáticos (HTML, CSS, JS, imagens)

// Rotas para as páginas principais
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/cadastro.html'));
});

app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/professor-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/professor-dashboard.html'));
});

// Rotas para arquivos específicos (caso precise acessar diretamente)
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/cadastro.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/cadastro.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/professor-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/professor-dashboard.html'));
});

// ==================== SERVIR ARQUIVOS ESTÁTICOS ====================
app.use(express.static(path.join(__dirname, '../frontend')));

// Servir CSS específico
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));

// Servir JS específico  
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));

// Servir IMAGENS
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));
app.use('/Unimap/frontend/images', express.static(path.join(__dirname, '../frontend/images')));

// Servir arquivos da raiz também (caso precise)
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`🚀 UNIMAP COMPLETO rodando: http://localhost:${PORT}`);
    console.log(`📊 Banco: SQLite (unimap.db)`);
    console.log(`🔐 Google OAuth: Configurado`);
    console.log(`👤 Admin: admin@unipam.edu.br / admin123`);
    console.log(`👨‍🏫 Professor: Use email do professor / prof123`);
    console.log(`🔍 Teste: http://localhost:${PORT}/api/test`);
    console.log(`📈 Status: http://localhost:${PORT}/api/status`);
    console.log(`👥 Debug: http://localhost:${PORT}/api/debug/usuarios`);
    console.log(`🏫 Debug Salas: http://localhost:${PORT}/api/debug/salas`);
    console.log(`🏗️ Blocos disponíveis: A, B, C, D, E, F, G, H, I, J, K, L, M, N`);
});
// ==================== NOVAS ROTAS PARA ESTATÍSTICAS DE PROFESSORES ====================

// GET /api/professores/:id/favoritos-count - Contar favoritos de um professor
app.get('/api/professores/:id/favoritos-count', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT 
            COUNT(*) as count,
            GROUP_CONCAT(u.nome) as nomes_alunos,
            GROUP_CONCAT(u.curso) as cursos_alunos
        FROM professores_favoritos pf
        JOIN usuarios u ON pf.aluno_id = u.id
        WHERE pf.professor_id = ? AND u.ativo = 1
    `;
    
    db.get(query, [id], (err, result) => {
        if (err) {
            console.error('❌ Erro ao contar favoritos:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        
        // Processar resultado
        const alunos = result.nomes_alunos ? result.nomes_alunos.split(',').map((nome, index) => ({
            nome: nome,
            curso: result.cursos_alunos ? result.cursos_alunos.split(',')[index] : null
        })) : [];
        
        res.json({
            count: result.count || 0,
            alunos: alunos
        });
    });
});

// GET /api/aulas/professor/:professor_id - Aulas de um professor específico
app.get('/api/aulas/professor/:professor_id', authenticateToken, requireAdmin, (req, res) => {
    const { professor_id } = req.params;
    
    const query = `
        SELECT 
            a.*, 
            d.nome as disciplina_nome,
            s.numero as sala_numero, 
            s.bloco as sala_bloco
        FROM aulas a
        LEFT JOIN disciplinas d ON a.disciplina_id = d.id
        LEFT JOIN salas s ON a.sala_id = s.id
        WHERE a.professor_id = ? AND a.ativa = 1
        ORDER BY a.dia_semana, a.horario_inicio
    `;
    
    db.all(query, [professor_id], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar aulas do professor:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GET /api/professores/stats - Estatísticas gerais de professores
app.get('/api/professores/stats', authenticateToken, requireAdmin, (req, res) => {
    const queries = [
        'SELECT COUNT(*) as total FROM professores WHERE ativo = 1',
        `SELECT COUNT(DISTINCT pf.professor_id) as total_com_favoritos 
         FROM professores_favoritos pf 
         JOIN professores p ON pf.professor_id = p.id 
         WHERE p.ativo = 1`,
        `SELECT p.nome, COUNT(pf.id) as total_favoritos
         FROM professores p
         LEFT JOIN professores_favoritos pf ON p.id = pf.professor_id
         WHERE p.ativo = 1
         GROUP BY p.id
         ORDER BY total_favoritos DESC
         LIMIT 5`
    ];
    
    db.serialize(() => {
        const results = {};
        let completed = 0;
        
        // Total de professores
        db.get(queries[0], [], (err, row) => {
            if (err) console.error(err);
            results.total_professores = row ? row.total : 0;
            completed++;
            checkComplete();
        });
        
        // Professores com favoritos
        db.get(queries[1], [], (err, row) => {
            if (err) console.error(err);
            results.professores_com_favoritos = row ? row.total_com_favoritos : 0;
            completed++;
            checkComplete();
        });
        
        // Top professores
        db.all(queries[2], [], (err, rows) => {
            if (err) console.error(err);
            results.top_professores = rows || [];
            completed++;
            checkComplete();
        });
        
        function checkComplete() {
            if (completed === queries.length) {
                res.json(results);
            }
        }
    });
});
// ROTA PARA DISCIPLINAS - Adicione esta rota
app.get('/api/disciplinas', authenticateToken, (req, res) => {
    db.all('SELECT * FROM disciplinas WHERE ativa = 1 ORDER BY nome', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar disciplinas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});
// ROTA ESPECÍFICA PARA MINHAS AULAS (PROFESSOR) - MAIS SIMPLES E CONFIÁVEL
app.get('/api/professor/minhas-aulas', authenticateToken, (req, res) => {
    console.log('📚 Buscando aulas do professor:', req.user.email);
    
    // Verificar se é professor
    if (req.user.tipo !== 'professor') {
        return res.status(403).json({ error: 'Acesso restrito a professores' });
    }

    const query = `
        SELECT 
            a.*, 
            d.nome as disciplina_nome,
            s.numero as sala_numero, 
            s.bloco as sala_bloco,
            s.andar as sala_andar
        FROM aulas a
        LEFT JOIN disciplinas d ON a.disciplina_id = d.id
        LEFT JOIN salas s ON a.sala_id = s.id
        LEFT JOIN professores p ON a.professor_id = p.id
        WHERE p.email = ? AND a.ativa = 1
        ORDER BY a.dia_semana, a.horario_inicio
    `;
    
    db.all(query, [req.user.email], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar aulas do professor:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} aulas encontradas para o professor ${req.user.email}`);
        res.json(rows);
    });
});
// ROTA DE DEBUG PARA AULAS DO PROFESSOR
app.get('/api/debug/aulas-professor', authenticateToken, (req, res) => {
    console.log('🔍 DEBUG: Buscando todas as aulas do professor:', req.user.email);
    
    const query = `
        SELECT 
            a.*, 
            p.nome as professor_nome,
            p.email as professor_email,
            d.nome as disciplina_nome,
            s.numero as sala_numero
        FROM aulas a
        LEFT JOIN professores p ON a.professor_id = p.id
        LEFT JOIN disciplinas d ON a.disciplina_id = d.id
        LEFT JOIN salas s ON a.sala_id = s.id
        WHERE p.email = ?
        ORDER BY a.id DESC
    `;
    
    db.all(query, [req.user.email], (err, aulas) => {
        if (err) {
            console.error('❌ Erro no debug:', err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            professor: req.user.email,
            total_aulas: aulas.length,
            aulas: aulas
        });
    });
});
// ROTA PARA AULAS DO ALUNO (COM MATCHING AUTOMÁTICO)
app.get('/api/aulas/aluno/:aluno_id', authenticateToken, (req, res) => {
    const { aluno_id } = req.params;
    
    console.log('🎓 Buscando aulas para aluno:', aluno_id);
    
    // Buscar informações do aluno
    db.get('SELECT curso, periodo FROM usuarios WHERE id = ?', [aluno_id], (err, aluno) => {
        if (err || !aluno) {
            console.error('❌ Aluno não encontrado:', aluno_id);
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }
        
        console.log('👤 Dados do aluno para filtro:', aluno);
        
        // 🔥 FILTRO MELHORADO - Aulas que batem com curso E turma do aluno
        const query = `
            SELECT 
                a.*, 
                p.nome as professor_nome, 
                s.numero as sala_numero, 
                s.bloco as sala_bloco,
                s.andar as sala_andar,
                d.nome as disciplina_nome
            FROM aulas a
            LEFT JOIN professores p ON a.professor_id = p.id
            LEFT JOIN salas s ON a.sala_id = s.id
            LEFT JOIN disciplinas d ON a.disciplina_id = d.id
            WHERE a.ativa = 1 
            AND (a.curso = ? OR a.curso IS NULL OR a.curso = '') -- 🔥 Filtro por curso
            AND (a.turma LIKE '%' || ? || '%' OR a.turma IS NULL OR a.turma = '') -- 🔥 Filtro por turma
            ORDER BY a.dia_semana, a.horario_inicio
        `;
        
        // Se o aluno não tem curso definido, mostrar todas as aulas
        const cursoFiltro = aluno.curso || '';
        const turmaFiltro = aluno.periodo ? `T${aluno.periodo}` : '';
        
        console.log('🔍 Aplicando filtros:', { curso: cursoFiltro, turma: turmaFiltro });
        
        db.all(query, [cursoFiltro, turmaFiltro], (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar aulas do aluno:', err);
                return res.status(500).json({ error: err.message });
            }
            
            console.log(`✅ ${rows.length} aulas encontradas após filtro`);
            res.json(rows);
        });
    });
});
app.get('/api/professores', authenticateToken, (req, res) => {
    console.log('📚 Buscando lista de professores...');
    
    db.all('SELECT * FROM professores WHERE ativo = 1 ORDER BY nome', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar professores:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} professores encontrados`);
        res.json(rows);
    });
});

// GET /api/professores/stats - Estatísticas (apenas admin)
app.get('/api/professores/stats', authenticateToken, requireAdmin, (req, res) => {
    console.log('📊 Buscando estatísticas de professores...');
    
    const queries = [
        'SELECT COUNT(*) as total FROM professores WHERE ativo = 1',
        `SELECT COUNT(DISTINCT pf.professor_id) as total_com_favoritos 
         FROM professores_favoritos pf 
         JOIN professores p ON pf.professor_id = p.id 
         WHERE p.ativo = 1`,
        `SELECT p.id, p.nome, COUNT(pf.id) as total_favoritos
         FROM professores p
         LEFT JOIN professores_favoritos pf ON p.id = pf.professor_id
         WHERE p.ativo = 1
         GROUP BY p.id
         ORDER BY total_favoritos DESC
         LIMIT 5`
    ];
    
    db.serialize(() => {
        const results = {};
        let completed = 0;
        
        // Total de professores
        db.get(queries[0], [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de professores:', err);
                results.total_professores = 0;
            } else {
                results.total_professores = row ? row.total : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Professores com favoritos
        db.get(queries[1], [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar professores com favoritos:', err);
                results.professores_com_favoritos = 0;
            } else {
                results.professores_com_favoritos = row ? row.total_com_favoritos : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Top professores
        db.all(queries[2], [], (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar top professores:', err);
                results.top_professores = [];
            } else {
                results.top_professores = rows || [];
            }
            completed++;
            checkComplete();
        });
        
        function checkComplete() {
            if (completed === queries.length) {
                console.log('✅ Estatísticas carregadas:', results);
                res.json(results);
            }
        }
    });
});

// Rota para debug de professores
app.get('/api/debug/professores', authenticateToken, (req, res) => {
    console.log('🔍 DEBUG: Buscando todos os dados de professores...');
    
    const query = `
        SELECT 
            p.*,
            COUNT(pf.id) as total_favoritos,
            GROUP_CONCAT(u.nome) as alunos_favoritos
        FROM professores p
        LEFT JOIN professores_favoritos pf ON p.id = pf.professor_id
        LEFT JOIN usuarios u ON pf.aluno_id = u.id
        WHERE p.ativo = 1
        GROUP BY p.id
        ORDER BY p.nome
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro no debug:', err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            total_professores: rows.length,
            professores: rows
        });
    });
});
// ==================== SISTEMA DE TURMAS E ASSOCIAÇÕES ====================





app.get('/api/aluno/:id/aulas', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT 
            a.*, 
            p.nome as professor_nome,
            d.nome as disciplina_nome,
            s.numero as sala_numero,
            s.bloco as sala_bloco,
            s.andar as sala_andar,
            t.nome as turma_nome,
            c.nome as curso_nome
        FROM aulas a
        LEFT JOIN professores p ON a.professor_id = p.id
        LEFT JOIN disciplinas d ON a.disciplina_id = d.id
        LEFT JOIN salas s ON a.sala_id = s.id
        LEFT JOIN turmas t ON a.turma_id = t.id
        LEFT JOIN cursos c ON t.curso_id = c.id
        WHERE a.turma_id IN (
            SELECT turma_id FROM aluno_turmas 
            WHERE aluno_id = ? AND status = 'cursando'
        )
        AND a.ativa = 1
        ORDER BY a.dia_semana, a.horario_inicio
    `;
    
    db.all(query, [id], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar aulas do aluno:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});
// ==================== ROTAS DE TURMAS COMPLETAS ====================

// GET /api/turmas - Listar todas as turmas (VERSÃO CORRIGIDA)
app.get('/api/turmas', authenticateToken, (req, res) => {
    console.log('📚 Buscando turmas...');
    
    // Query corrigida - busca básica primeiro
    const query = `SELECT * FROM turmas WHERE ativa = 1 ORDER BY nome`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas:', err);
            
            // Se a tabela não existe, criar
            if (err.message.includes('no such table')) {
                console.log('🔄 Criando tabela turmas...');
                db.run(`CREATE TABLE IF NOT EXISTS turmas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    curso TEXT NOT NULL,
                    periodo INTEGER NOT NULL,
                    ano INTEGER DEFAULT 2024,
                    ativa BOOLEAN DEFAULT 1,
                    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (createErr) => {
                    if (createErr) {
                        console.error('❌ Erro ao criar tabela turmas:', createErr);
                        return res.status(500).json({ error: 'Erro no banco de dados' });
                    }
                    
                    // Inserir algumas turmas de exemplo
                    console.log('✅ Tabela criada, inserindo turmas exemplo...');
                    db.run(`INSERT INTO turmas (nome, curso, periodo, ano) VALUES 
                        ('SI-2024-1A', 'Sistemas de Informação', 1, 2024),
                        ('ADM-2024-1A', 'Administração', 1, 2024),
                        ('DIR-2024-1A', 'Direito', 1, 2024)
                    `, (insertErr) => {
                        if (insertErr) {
                            console.error('❌ Erro ao inserir turmas exemplo:', insertErr);
                        }
                        // Retornar array vazio inicialmente
                        res.json([]);
                    });
                });
                return;
            }
            
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} turmas encontradas`);
        
        // Processar resultado para garantir estrutura consistente
        const turmasProcessadas = rows.map(turma => ({
            id: turma.id,
            nome: turma.nome,
            curso: turma.curso,
            periodo: turma.periodo,
            ano: turma.ano,
            quantidade_alunos: 0, // Valor padrão
            ativa: turma.ativa,
            data_criacao: turma.data_criacao
        }));
        
        res.json(turmasProcessadas);
    });
});

// POST /api/turmas - Criar nova turma
app.post('/api/turmas', authenticateToken, requireAdmin, (req, res) => {
    const { nome, curso, periodo, ano } = req.body;
    
    console.log('🆕 Criando nova turma:', { nome, curso, periodo });
    
    if (!nome || !curso || !periodo) {
        return res.status(400).json({ error: 'Nome, curso e período são obrigatórios' });
    }

    db.run(
        `INSERT INTO turmas (nome, curso, periodo, ano) 
         VALUES (?, ?, ?, ?)`,
        [nome, curso, periodo, ano || new Date().getFullYear()],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar turma:', err);
                return res.status(400).json({ error: err.message });
            }
            
            console.log('✅ Turma criada com ID:', this.lastID);
            res.json({ 
                success: true, 
                message: 'Turma criada com sucesso!', 
                id: this.lastID 
            });
        }
    );
});

// PUT /api/turmas/:id - Atualizar turma
app.put('/api/turmas/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, curso, periodo, ano, ativa } = req.body;
    
    console.log('✏️ Atualizando turma:', id);
    
    db.run(
        `UPDATE turmas 
         SET nome = ?, curso = ?, periodo = ?, ano = ?, ativa = ?
         WHERE id = ?`,
        [nome, curso, periodo, ano, ativa, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar turma:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Turma não encontrada' });
            }
            
            res.json({ 
                success: true, 
                message: 'Turma atualizada com sucesso!' 
            });
        }
    );
});

// DELETE /api/turmas/:id - Excluir turma (desativar)
app.delete('/api/turmas/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log('🗑️ Excluindo turma:', id);
    
    db.run(
        'UPDATE turmas SET ativa = 0 WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao excluir turma:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Turma não encontrada' });
            }
            
            res.json({ 
                success: true, 
                message: 'Turma excluída com sucesso!' 
            });
        }
    );
});

// POST /api/turmas/:id/alunos - Vincular alunos à turma
app.post('/api/turmas/:id/alunos', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { alunos_ids } = req.body;
    
    console.log('👥 Vinculando alunos à turma:', { turma_id: id, alunos_ids });
    
    if (!alunos_ids || !Array.isArray(alunos_ids)) {
        return res.status(400).json({ error: 'Lista de alunos é obrigatória' });
    }
    
    // Primeiro, verificar se a tabela aluno_turmas existe
    db.run(`CREATE TABLE IF NOT EXISTS aluno_turmas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        turma_id INTEGER NOT NULL,
        data_matricula DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'cursando',
        FOREIGN KEY (aluno_id) REFERENCES usuarios (id),
        FOREIGN KEY (turma_id) REFERENCES turmas (id),
        UNIQUE(aluno_id, turma_id)
    )`, (err) => {
        if (err) {
            console.error('❌ Erro ao criar tabela aluno_turmas:', err);
            return res.status(500).json({ error: 'Erro no banco de dados' });
        }
        
        // Agora inserir os alunos
        db.serialize(() => {
            const stmt = db.prepare(
                'INSERT OR REPLACE INTO aluno_turmas (aluno_id, turma_id) VALUES (?, ?)'
            );
            
            let inserted = 0;
            alunos_ids.forEach(alunoId => {
                stmt.run([alunoId, id], function(err) {
                    if (!err) inserted++;
                });
            });
            
            stmt.finalize((err) => {
                if (err) {
                    console.error('❌ Erro ao vincular alunos:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                console.log(`✅ ${inserted} aluno(s) vinculado(s) com sucesso!`);
                res.json({ 
                    success: true, 
                    message: `${inserted} aluno(s) vinculado(s) com sucesso!` 
                });
            });
        });
    });
});

// GET /api/turmas/:id/alunos - Listar alunos da turma
app.get('/api/turmas/:id/alunos', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    console.log('📋 Buscando alunos da turma:', id);
    
    const query = `
        SELECT u.id, u.nome, u.email, u.matricula, u.curso, u.periodo, at.data_matricula
        FROM usuarios u
        JOIN aluno_turmas at ON u.id = at.aluno_id
        WHERE at.turma_id = ? AND u.ativo = 1 AND at.status = 'cursando'
        ORDER BY u.nome
    `;
    
    db.all(query, [id], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar alunos da turma:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ ${rows.length} alunos encontrados na turma`);
        res.json(rows);
    });
});

// GET /api/aluno/:id/turmas - Turmas do aluno
app.get('/api/aluno/:id/turmas', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    console.log('🎓 Buscando turmas do aluno:', id);
    
    const query = `
        SELECT t.*, at.data_matricula, at.status
        FROM turmas t
        JOIN aluno_turmas at ON t.id = at.turma_id
        WHERE at.aluno_id = ? AND t.ativa = 1 AND at.status = 'cursando'
        ORDER BY t.ano DESC, t.periodo
    `;
    
    db.all(query, [id], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas do aluno:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ ${rows.length} turmas encontradas para o aluno`);
        res.json(rows);
    });
});
// GET /api/turmas - Listar todas as turmas (VERSÃO CORRIGIDA)
app.get('/api/turmas', authenticateToken, (req, res) => {
    console.log('📚 Buscando turmas...');
    
    // ✅ QUERY CORRIGIDA - busca apenas colunas que existem
    const query = `
        SELECT 
            id,
            nome,
            curso,
            periodo,
            ano,
            ativa
        FROM turmas 
        WHERE ativa = 1
        ORDER BY ano DESC, periodo, nome
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas:', err);
            
            // Se a tabela não existe, criar
            if (err.message.includes('no such table')) {
                console.log('🔄 Criando tabela turmas...');
                db.run(`CREATE TABLE IF NOT EXISTS turmas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    curso TEXT NOT NULL,
                    periodo INTEGER NOT NULL,
                    ano INTEGER DEFAULT 2024,
                    ativa BOOLEAN DEFAULT 1,
                    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (createErr) => {
                    if (createErr) {
                        console.error('❌ Erro ao criar tabela turmas:', createErr);
                        return res.status(500).json({ error: 'Erro no banco de dados' });
                    }
                    
                    // Inserir algumas turmas de exemplo
                    console.log('✅ Tabela criada, inserindo turmas exemplo...');
                    db.run(`INSERT INTO turmas (nome, curso, periodo, ano) VALUES 
                        ('SI-2024-1A', 'Sistemas de Informação', 1, 2024),
                        ('ADM-2024-1A', 'Administração', 1, 2024),
                        ('DIR-2024-1A', 'Direito', 1, 2024)
                    `, (insertErr) => {
                        if (insertErr) console.error('❌ Erro ao inserir turmas exemplo:', insertErr);
                        res.json([]);
                    });
                });
                return;
            }
            
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} turmas encontradas`);
        
        // ✅ PROCESSAMENTO CORRIGIDO - sem data_criacao
        const turmasProcessadas = rows.map(turma => ({
            id: turma.id,
            nome: turma.nome,
            curso: turma.curso,
            periodo: turma.periodo,
            ano: turma.ano,
            quantidade_alunos: 0, // Valor padrão
            ativa: turma.ativa,
            // ❌ REMOVIDO: data_criacao não existe na tabela
        }));
        
        res.json(turmasProcessadas);
    });
});
// ✅ ROTA PÚBLICA PARA TESTE DE TURMAS (adicione no server.js)
app.get('/api/test-turmas', (req, res) => {
    console.log('🧪 Teste público de turmas...');
    
    const query = `SELECT id, nome, curso, periodo, ano, ativa FROM turmas WHERE ativa = 1`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro no teste:', err);
            
            // Se tabela não existe, criar
            if (err.message.includes('no such table')) {
                db.run(`CREATE TABLE IF NOT EXISTS turmas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    curso TEXT NOT NULL,
                    periodo INTEGER NOT NULL,
                    ano INTEGER DEFAULT 2024,
                    ativa BOOLEAN DEFAULT 1
                )`, (createErr) => {
                    if (createErr) return res.status(500).json({ error: createErr.message });
                    
                    // Inserir exemplos
                    db.run(`INSERT INTO turmas (nome, curso, periodo, ano) VALUES 
                        ('SI-2024-1A', 'Sistemas de Informação', 1, 2024),
                        ('ADM-2024-1A', 'Administração', 1, 2024),
                        ('DIR-2024-1A', 'Direito', 1, 2024)
                    `);
                    res.json([]);
                });
                return;
            }
            
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} turmas encontradas no teste`);
        res.json(rows);
    });
});
// ==================== ROTA PÚBLICA PARA CRIAR TURMAS ====================

// POST /api/turmas/popular-public - Criar turmas (sem autenticação)
app.post('/api/turmas/popular-public', (req, res) => {
    console.log('🎯 Populando tabela turmas (pública)...');
    
    db.run(`CREATE TABLE IF NOT EXISTS turmas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        curso TEXT NOT NULL,
        periodo INTEGER NOT NULL,
        ano INTEGER DEFAULT 2024,
        ativa BOOLEAN DEFAULT 1
    )`, (err) => {
        if (err) {
            console.error('❌ Erro ao criar tabela:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Inserir turmas de exemplo
        const turmasExemplo = [
            ['SI-2024-1A', 'Sistemas de Informação', 1, 2024],
            ['SI-2024-2A', 'Sistemas de Informação', 2, 2024],
            ['ADM-2024-1A', 'Administração', 1, 2024],
            ['ADM-2024-2A', 'Administração', 2, 2024],
            ['DIR-2024-1A', 'Direito', 1, 2024],
            ['ENG-2024-1A', 'Engenharia Civil', 1, 2024]
        ];
        
        // Limpar tabela primeiro
        db.run('DELETE FROM turmas', (err) => {
            if (err) console.log('⚠️ Não foi possível limpar tabela:', err);
            
            // Inserir novas turmas
            const stmt = db.prepare('INSERT INTO turmas (nome, curso, periodo, ano) VALUES (?, ?, ?, ?)');
            let inserted = 0;
            
            turmasExemplo.forEach(turma => {
                stmt.run(turma, function(err) {
                    if (err) {
                        console.error('❌ Erro ao inserir turma:', turma[0], err);
                    } else {
                        inserted++;
                        console.log('✅ Turma inserida:', turma[0]);
                    }
                });
            });
            
            stmt.finalize((err) => {
                if (err) {
                    console.error('❌ Erro ao finalizar inserções:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                console.log(`🎉 ${inserted} turmas inseridas com sucesso!`);
                res.json({ 
                    success: true, 
                    message: `${inserted} turmas criadas com sucesso!`,
                    turmas_criadas: inserted
                });
            });
        });
    });
});

// GET /api/turmas/public - Listar turmas (sem autenticação)
app.get('/api/turmas/public', (req, res) => {
    console.log('📚 Buscando turmas (pública)...');
    
    const query = `SELECT id, nome, curso, periodo, ano, ativa FROM turmas WHERE ativa = 1 ORDER BY nome`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} turmas encontradas`);
        res.json(rows);
    });
});
// DESVINCULAR ALUNO INDIVIDUAL - SQLITE
app.post('/api/desmatricular-aluno', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { turma_id, aluno_id } = req.body;
        
        console.log('🗑️ Desvinculando aluno:', { turma_id, aluno_id });

        // Verificar se o vínculo existe na tabela aluno_turmas
        db.get('SELECT id FROM aluno_turmas WHERE aluno_id = ? AND turma_id = ?', 
               [aluno_id, turma_id], (err, vinculo) => {
            if (err) {
                console.error('❌ Erro ao buscar vínculo:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Erro interno do servidor' 
                });
            }

            if (!vinculo) {
                console.log('❌ Vínculo não encontrado');
                return res.status(404).json({ 
                    success: false, 
                    error: 'Aluno não está vinculado a esta turma' 
                });
            }

            console.log('📋 Vínculo encontrado:', vinculo);

            // Remover o vínculo da tabela aluno_turmas
            db.run('DELETE FROM aluno_turmas WHERE aluno_id = ? AND turma_id = ?', 
                   [aluno_id, turma_id], 
                   function(deleteErr) {
                if (deleteErr) {
                    console.error('❌ Erro ao remover vínculo:', deleteErr);
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Erro interno do servidor' 
                    });
                }

                console.log('📊 Vínculo removido:', this.changes);

                if (this.changes === 0) {
                    console.log('⚠️ Vínculo não foi removido');
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Erro ao remover vínculo' 
                    });
                }

                console.log('✅ Aluno desvinculado com sucesso');
                res.json({ 
                    success: true, 
                    message: 'Aluno desvinculado da turma com sucesso!' 
                });
            });
        });

    } catch (error) {
        console.error('❌ Erro ao desvincular aluno:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});
// DESVINCULAR TODOS OS ALUNOS DE UMA TURMA - SQLITE
app.post('/api/turmas/:id/desvincular-todos', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const turma_id = req.params.id;
        
        console.log('🗑️ Desvinculando todos os alunos da turma:', turma_id);

        // Verificar se a turma existe
        db.get('SELECT id, nome FROM turmas WHERE id = ?', [turma_id], (err, turma) => {
            if (err) {
                console.error('❌ Erro ao buscar turma:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Erro interno do servidor' 
                });
            }

            if (!turma) {
                console.log('❌ Turma não encontrada:', turma_id);
                return res.status(404).json({ 
                    success: false, 
                    error: 'Turma não encontrada' 
                });
            }

            console.log('📋 Turma encontrada:', turma);

            // Verificar quantos alunos estão vinculados
            db.get('SELECT COUNT(*) as total FROM aluno_turmas WHERE turma_id = ?', [turma_id], (countErr, countResult) => {
                if (countErr) {
                    console.error('❌ Erro ao contar alunos:', countErr);
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Erro interno do servidor' 
                    });
                }

                console.log(`👥 ${countResult.total} alunos encontrados na turma`);

                // Remover todos os vínculos da tabela aluno_turmas
                db.run('DELETE FROM aluno_turmas WHERE turma_id = ?', [turma_id], function(deleteErr) {
                    if (deleteErr) {
                        console.error('❌ Erro ao desvincular alunos:', deleteErr);
                        return res.status(500).json({ 
                            success: false, 
                            error: 'Erro interno do servidor' 
                        });
                    }

                    console.log(`✅ ${this.changes} vínculos removidos da turma ${turma_id}`);

                    res.json({ 
                        success: true, 
                        message: `Todos os ${this.changes} alunos foram desvinculados da turma!`,
                        alunos_desvinculados: this.changes
                    });
                });
            });
        });

    } catch (error) {
        console.error('❌ Erro ao desvincular todos os alunos:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});
// DESVINCULAR MÚLTIPLOS ALUNOS - SQLITE
app.post('/api/desmatricular-alunos', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { turma_id, alunos_ids } = req.body;
        
        console.log('🗑️ Desvinculando alunos em lote:', { turma_id, alunos_ids });

        if (!alunos_ids || !Array.isArray(alunos_ids) || alunos_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Lista de alunos inválida' 
            });
        }

        let desvinculados = 0;
        let erros = [];

        // Função para processar cada aluno
        const processarAluno = (index) => {
            if (index >= alunos_ids.length) {
                // Todos os alunos processados
                console.log(`✅ ${desvinculados} alunos desvinculados, ${erros.length} erros`);

                if (desvinculados > 0) {
                    res.json({ 
                        success: true, 
                        message: `${desvinculados} aluno(s) desvinculado(s) com sucesso!`,
                        desvinculados,
                        erros
                    });
                } else {
                    res.status(400).json({ 
                        success: false, 
                        error: 'Nenhum aluno foi desvinculado: ' + erros.join(', ') 
                    });
                }
                return;
            }

            const aluno_id = alunos_ids[index];
            
            // Remover vínculo da tabela aluno_turmas
            db.run('DELETE FROM aluno_turmas WHERE aluno_id = ? AND turma_id = ?', 
                   [aluno_id, turma_id], 
                   function(deleteErr) {
                if (deleteErr) {
                    console.error(`❌ Erro ao desvincular aluno ${aluno_id}:`, deleteErr);
                    erros.push(`Aluno ${aluno_id}: ${deleteErr.message}`);
                } else if (this.changes > 0) {
                    desvinculados++;
                    console.log(`✅ Aluno ${aluno_id} desvinculado com sucesso`);
                } else {
                    erros.push(`Aluno ${aluno_id} não encontrado ou não vinculado`);
                }
                
                // Processar próximo aluno
                processarAluno(index + 1);
            });
        };

        // Iniciar processamento
        processarAluno(0);

    } catch (error) {
        console.error('❌ Erro ao desvincular alunos em lote:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});
// DESVINCULAR TODOS OS ALUNOS DE UMA TURMA
app.post('/api/turmas/:id/desvincular-todos', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const turma_id = req.params.id;
        
        console.log('🗑️ Desvinculando todos os alunos da turma:', turma_id);

        // Verificar se a turma existe
        const [turma] = await connection.execute(
            'SELECT * FROM turmas WHERE id = ?', 
            [turma_id]
        );

        if (turma.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Turma não encontrada' 
            });
        }

        // Desvincular todos os alunos da turma
        const query = 'UPDATE usuarios SET turma_id = NULL WHERE turma_id = ?';
        const [result] = await connection.execute(query, [turma_id]);

        console.log(`✅ ${result.affectedRows} alunos desvinculados da turma ${turma_id}`);

        res.json({ 
            success: true, 
            message: `Todos os ${result.affectedRows} alunos foram desvinculados da turma!`,
            alunos_desvinculados: result.affectedRows
        });

    } catch (error) {
        console.error('❌ Erro ao desvincular todos os alunos:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});
app.delete('/api/usuarios/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log('🗑️ Excluindo usuário ID:', id);

    // Verificar se o usuário existe
    db.get('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [id], (err, user) => {
        if (err) {
            console.error('❌ Erro ao verificar usuário:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        if (!user) {
            console.log('❌ Usuário não encontrado:', id);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Verificar se é o próprio admin tentando se excluir
        if (user.id === req.user.id) {
            console.log('❌ Admin tentando se excluir:', user.email);
            return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
        }

        // Desativar usuário (soft delete)
        db.run(
            'UPDATE usuarios SET ativo = 0 WHERE id = ?',
            [id],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao excluir usuário:', err);
                    return res.status(400).json({ error: err.message });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Usuário não encontrado' });
                }

                console.log('✅ Usuário excluído com sucesso:', user.email);
                res.json({ 
                    success: true, 
                    message: 'Usuário excluído com sucesso!' 
                });
            }
        );
    });
});
app.get('/api/usuarios/stats', authenticateToken, requireAdmin, (req, res) => {
    console.log('📊 Buscando estatísticas de usuários...');
    
    const queries = [
        'SELECT COUNT(*) as total FROM usuarios WHERE ativo = 1',
        'SELECT COUNT(*) as total FROM usuarios WHERE tipo = "aluno" AND ativo = 1',
        'SELECT COUNT(*) as total FROM usuarios WHERE tipo = "professor" AND ativo = 1',
        'SELECT COUNT(*) as total FROM usuarios WHERE tipo = "admin" AND ativo = 1'
    ];
    
    db.serialize(() => {
        const results = {};
        let completed = 0;
        
        // Total de usuários
        db.get(queries[0], [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de usuários:', err);
                results.total_usuarios = 0;
            } else {
                results.total_usuarios = row ? row.total : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Alunos
        db.get(queries[1], [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de alunos:', err);
                results.total_alunos = 0;
            } else {
                results.total_alunos = row ? row.total : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Professores
        db.get(queries[2], [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de professores:', err);
                results.total_professores = 0;
            } else {
                results.total_professores = row ? row.total : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Administradores
        db.get(queries[3], [], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de administradores:', err);
                results.total_admins = 0;
            } else {
                results.total_admins = row ? row.total : 0;
            }
            completed++;
            checkComplete();
        });
        
        function checkComplete() {
            if (completed === queries.length) {
                console.log('✅ Estatísticas carregadas:', results);
                res.json(results);
            }
        }
    });
});
