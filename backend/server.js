const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
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

        // Salas
        db.run(`INSERT OR IGNORE INTO salas (numero, bloco, andar, tipo, capacidade, recursos) VALUES 
            ('101', 'A', 1, 'Sala de Aula', 40, 'Projetor, Quadro'),
            ('102', 'A', 1, 'Sala de Aula', 40, 'Projetor, Quadro'),
            ('201', 'A', 2, 'Sala de Aula', 30, 'Projetor, Quadro'),
            ('LAB1', 'B', 1, 'Laboratório', 20, 'Computadores, Projetor'),
            ('AUD1', 'D', 1, 'Auditório', 100, 'Projetor, Som')`, function(err) {
            if (err) {
                console.error('❌ Erro ao inserir salas:', err);
            } else {
                console.log('✅ Salas inseridas');
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

        console.log('✅ Banco COMPLETO criado!');
    });
}

// Inicializar banco
initializeDatabase();

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    db.get('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [token], (err, user) => {
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

// ==================== ROTAS DE AUTENTICAÇÃO ====================
app.post('/api/auth/login', (req, res) => {
    const { email, senha } = req.body;
    
    console.log('🔐 Tentativa de login:', email);
    
    if (!email || !senha) {
        return res.status(400).json({ error: 'Email/matrícula e senha são obrigatórios' });
    }
    
    // VERIFICAR SE É EMAIL OU MATRÍCULA
    const isEmail = email.includes('@');
    const query = isEmail 
        ? 'SELECT * FROM usuarios WHERE email = ? AND ativo = 1'
        : 'SELECT * FROM usuarios WHERE matricula = ? AND ativo = 1';
    
    db.get(query, [email], async (err, user) => {
        if (err) {
            console.error('❌ Erro no banco:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        
        if (!user) {
            console.log('❌ Usuário não encontrado:', email);
            const errorMsg = isEmail 
                ? 'Email não encontrado' 
                : 'Matrícula não encontrada';
            return res.status(401).json({ error: errorMsg });
        }
        
        try {
            const senhaValida = await bcrypt.compare(senha, user.senha_hash);
            if (!senhaValida) {
                console.log('❌ Senha incorreta para:', email);
                return res.status(401).json({ error: 'Senha incorreta' });
            }
            
            console.log('✅ Login bem-sucedido:', user.nome);
            
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
            console.error('❌ Erro ao comparar senha:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    });
});

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
app.get('/api/cursos', authenticateToken, (req, res) => {
    db.all('SELECT * FROM cursos WHERE ativo = 1 ORDER BY nome', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar cursos:', err);
            return res.status(500).json({ error: err.message });
        }
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

// ==================== ROTAS DE SALAS ====================
app.get('/api/salas', authenticateToken, (req, res) => {
    db.all('SELECT * FROM salas WHERE ativa = 1 ORDER BY bloco, andar, numero', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar salas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

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

// ==================== ROTAS DE AULAS ====================
// ==================== ROTAS DE AULAS ====================
app.get('/api/aulas', authenticateToken, (req, res) => {
    const query = `
        SELECT a.*, p.nome as professor_nome, s.numero as sala_numero, s.bloco as sala_bloco,
               d.nome as disciplina_nome
        FROM aulas a
        LEFT JOIN professores p ON a.professor_id = p.id
        LEFT JOIN salas s ON a.sala_id = s.id
        LEFT JOIN disciplinas d ON a.disciplina_id = d.id
        WHERE a.ativa = 1
        ORDER BY a.dia_semana, a.horario_inicio
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar aulas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/api/aulas/usuario/:usuario_id', authenticateToken, (req, res) => {
    const { usuario_id } = req.params;
    
    db.get('SELECT curso, tipo FROM usuarios WHERE id = ?', [usuario_id], (err, user) => {
        if (err || !user) {
            console.error('❌ Usuário não encontrado:', usuario_id);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        let query, params;
        
        if (user.tipo === 'aluno') {
            // Aluno: vê apenas aulas do seu curso
            query = `
                SELECT a.*, p.nome as professor_nome, s.numero as sala_numero, s.bloco as sala_bloco,
                       d.nome as disciplina_nome
                FROM aulas a
                LEFT JOIN professores p ON a.professor_id = p.id
                LEFT JOIN salas s ON a.sala_id = s.id
                LEFT JOIN disciplinas d ON a.disciplina_id = d.id
                WHERE a.curso = ? AND a.ativa = 1
                ORDER BY a.dia_semana, a.horario_inicio
            `;
            params = [user.curso];
        } else if (user.tipo === 'professor') {
            // Professor: vê apenas suas próprias aulas
            query = `
                SELECT a.*, p.nome as professor_nome, s.numero as sala_numero, s.bloco as sala_bloco,
                       d.nome as disciplina_nome
                FROM aulas a
                LEFT JOIN professores p ON a.professor_id = p.id
                LEFT JOIN salas s ON a.sala_id = s.id
                LEFT JOIN disciplinas d ON a.disciplina_id = d.id
                WHERE a.professor_id = (SELECT id FROM professores WHERE email = ?) AND a.ativa = 1
                ORDER BY a.dia_semana, a.horario_inicio
            `;
            params = [user.email];
        } else {
            // Admin: vê todas as aulas
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
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar aulas do usuário:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        });
    });
});

app.get('/api/aulas/usuario/:usuario_id', authenticateToken, (req, res) => {
    const { usuario_id } = req.params;
    
    db.get('SELECT curso FROM usuarios WHERE id = ?', [usuario_id], (err, user) => {
        if (err || !user) {
            console.error('❌ Usuário não encontrado:', usuario_id);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        const query = `
            SELECT a.*, p.nome as professor_nome, s.numero as sala_numero, s.bloco as sala_bloco
            FROM aulas a
            LEFT JOIN professores p ON a.professor_id = p.id
            LEFT JOIN salas s ON a.sala_id = s.id
            WHERE a.curso = ? AND a.ativa = 1
            ORDER BY a.dia_semana, a.horario_inicio
        `;
        
        db.all(query, [user.curso], (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar aulas do usuário:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        });
    });
});

// ==================== ROTAS DE USUÁRIOS ====================
app.get('/api/usuarios', authenticateToken, requireAdmin, (req, res) => {
    db.all('SELECT id, nome, email, tipo, curso, periodo, data_cadastro FROM usuarios WHERE ativo = 1', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar usuários:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
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

// ==================== ROTA DE DEBUG ====================
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

// ==================== ROTA DE TESTE SIMPLES ====================
app.get('/api/test', (req, res) => {
    res.json({ 
        status: '✅ OK', 
        message: 'Backend UNIMAP funcionando na porta 3000!',
        timestamp: new Date().toISOString(),
        versao: '2.0 - Completo com Google OAuth'
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
// ==================== SERVIR ARQUIVOS DO FRONTEND ====================
// Serve arquivos estáticos (HTML, CSS, JS, imagens)

// Rotas para as páginas principais - ADICIONE ISSO:
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
// ==================== SERVIR ARQUIVOS ESTÁTICOS ====================
app.use(express.static(path.join(__dirname, '../frontend')));

// Servir CSS específico
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));

// Servir JS específico  
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));

// Servir IMAGENS - ADICIONE ISSO:
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));
app.use('/Unimap/frontend/images', express.static(path.join(__dirname, '../frontend/images')));

// Servir arquivos da raiz também (caso precise)
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`🚀 UNIMAP COMPLETO rodando: http://localhost:${PORT}`);
    console.log(`📊 Banco: SQLite (unimap.db)`);
    console.log(`🔐 Google OAuth: Configurado`);
    console.log(`👤 Admin: admin@unipam.edu.br / admin123`);
    console.log(`🔍 Teste: http://localhost:${PORT}/api/test`);
    console.log(`📈 Status: http://localhost:${PORT}/api/status`);
    console.log(`👥 Debug: http://localhost:${PORT}/api/debug/usuarios`);
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