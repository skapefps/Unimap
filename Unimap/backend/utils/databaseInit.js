const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Função principal para inicializar o banco de dados
function initializeDatabase() {
    console.log('🔄 Inicializando banco de dados UNIMAP...');

    db.serialize(() => {
        // ==================== TABELAS PRINCIPAIS ====================

        // 1. Usuários
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
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela usuarios:', err);
            } else {
                console.log('✅ Tabela usuarios verificada/criada');
            }
        });

        // 2. Blocos (estrutura do database/Init.js)
        db.run(`CREATE TABLE IF NOT EXISTS blocos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            letra TEXT UNIQUE NOT NULL,
            nome TEXT
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela blocos:', err);
            } else {
                console.log('✅ Tabela blocos verificada/criada');
                popularBlocos();
            }
        });

        // 3. Salas (estrutura consolidada)
        db.run(`CREATE TABLE IF NOT EXISTS salas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT NOT NULL,
            bloco TEXT NOT NULL,
            andar INTEGER DEFAULT 0,
            tipo TEXT DEFAULT 'Sala de Aula',
            capacidade INTEGER DEFAULT 30,
            recursos TEXT,
            telefone TEXT,
            email TEXT,
            campus TEXT DEFAULT 'Principal',
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            ativa BOOLEAN DEFAULT 1
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela salas:', err);
            } else {
                console.log('✅ Tabela salas verificada/criada');
                criarSalasExemplo();
            }
        });

        // 4. Professores
        db.run(`CREATE TABLE IF NOT EXISTS professores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
            ativo BOOLEAN DEFAULT 1
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela professores:', err);
            } else {
                console.log('✅ Tabela professores verificada/criada');
                popularProfessores();
            }
        });

        // 5. Cursos
        db.run(`CREATE TABLE IF NOT EXISTS cursos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL,
            duracao INTEGER,
            turno TEXT,
            total_periodos INTEGER DEFAULT 8,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            ativo BOOLEAN DEFAULT 1
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela cursos:', err);
            } else {
                console.log('✅ Tabela cursos verificada/criada');
                popularCursosBasicos();
            }
        });

        // 6. Disciplinas
        db.run(`CREATE TABLE IF NOT EXISTS disciplinas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            curso_id INTEGER,
            periodo INTEGER DEFAULT 1,
            carga_horaria INTEGER DEFAULT 60,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            ativa BOOLEAN DEFAULT 1,
            FOREIGN KEY (curso_id) REFERENCES cursos (id)
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela disciplinas:', err);
            } else {
                console.log('✅ Tabela disciplinas verificada/criada');
                popularDisciplinas();
            }
        });

        // 7. Turmas
        db.run(`CREATE TABLE IF NOT EXISTS turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            curso TEXT NOT NULL,
            periodo INTEGER NOT NULL,
            ano INTEGER DEFAULT 2024,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            ativa BOOLEAN DEFAULT 1
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela turmas:', err);
            } else {
                console.log('✅ Tabela turmas verificada/criada');
                popularTurmas();
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS aulas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina TEXT NOT NULL,
    professor_id INTEGER NOT NULL,
    sala_id INTEGER,
    curso TEXT,
    turma TEXT,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    dia_semana INTEGER NOT NULL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ativa BOOLEAN DEFAULT 1,
    FOREIGN KEY (professor_id) REFERENCES professores (id),
    FOREIGN KEY (sala_id) REFERENCES salas (id)
)`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela aulas:', err);
            } else {
                console.log('✅ Tabela aulas verificada/criada');

                verificarEAdicionarColunaDisciplina();
            }
        });

        function verificarEAdicionarColunaDisciplina() {
            console.log('🔍 Verificando se a coluna disciplina existe...');

            db.all(`PRAGMA table_info(aulas)`, (err, rows) => {
                if (err) {
                    console.error('❌ Erro ao verificar estrutura da tabela aulas:', err);
                    return;
                }

                if (!rows || !Array.isArray(rows)) {
                    console.error('❌ Dados da tabela aulas não retornados corretamente');
                    return;
                }

                const hasDisciplina = rows.some(row => row.name === 'disciplina');

                if (!hasDisciplina) {
                    console.log('🔄 Adicionando coluna disciplina na tabela aulas...');
                    db.run(`ALTER TABLE aulas ADD COLUMN disciplina TEXT`, (alterErr) => {
                        if (alterErr) {
                            if (alterErr.message.includes('duplicate column name')) {
                                console.log('✅ Coluna disciplina já existe');
                            } else {
                                console.error('❌ Erro ao adicionar coluna disciplina:', alterErr);
                            }
                        } else {
                            console.log('✅ Coluna disciplina adicionada com sucesso!');
                        }
                    });
                } else {
                    console.log('✅ Coluna disciplina já existe na tabela aulas');
                }
            });
        }

        // 9. Aluno_Turmas
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
                console.log('✅ Tabela aluno_turmas verificada/criada');
            }
        });

        // 10. Professores Favoritos
        db.run(`CREATE TABLE IF NOT EXISTS professores_favoritos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER NOT NULL,
            professor_id INTEGER NOT NULL,
            data_adicao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (aluno_id) REFERENCES usuarios (id),
            FOREIGN KEY (professor_id) REFERENCES professores (id),
            UNIQUE(aluno_id, professor_id)
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela professores_favoritos:', err);
            } else {
                console.log('✅ Tabela professores_favoritos verificada/criada');
            }
        });

        // 11. Horários (do database/Init.js)
        db.run(`CREATE TABLE IF NOT EXISTS horarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            horario_inicio TIME NOT NULL,
            horario_fim TIME NOT NULL
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela horarios:', err);
            } else {
                console.log('✅ Tabela horarios verificada/criada');
                popularHorarios();
            }
        });

        // 12. Tokens de Redefinição de Senha
        db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            used BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES usuarios (id)
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela password_reset_tokens:', err);
            } else {
                console.log('✅ Tabela password_reset_tokens verificada/criada');
            }
        });

        // ==================== DADOS INICIAIS ====================

        // Criar usuários padrão após um pequeno delay para garantir que a tabela existe
        setTimeout(() => {
            criarUsuarioAdmin();
            criarUsuarioProfessor();
        }, 1000);

        console.log('✅ Estrutura do banco de dados UNIMAP inicializada com sucesso!');

        // Verificar tabelas criadas
        setTimeout(() => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    console.error('❌ Erro ao verificar tabelas:', err);
                } else {
                    console.log(`📊 Total de tabelas criadas: ${tables.length}`);
                    tables.forEach(table => {
                        console.log(`   📋 ${table.name}`);
                    });
                }
            });
        }, 2000);
    });
}

// ==================== FUNÇÕES AUXILIARES ====================

// Popular blocos (do database/Init.js)
function popularBlocos() {
    const blocos = [
        ['A', 'Bloco A - Administração'],
        ['B', 'Bloco B - Laboratórios'],
        ['C', 'Bloco C - Salas de Aula'],
        ['D', 'Bloco D - Auditórios'],
        ['E', 'Bloco E - Pós-Graduação'],
        ['F', 'Bloco F - Biblioteca'],
        ['G', 'Bloco G - Laboratórios de Informática'],
        ['H', 'Bloco H - Sala de Professores'],
        ['I', 'Bloco I - Coordenações'],
        ['J', 'Bloco J - Laboratórios Especiais'],
        ['K', 'Bloco K - Pesquisa'],
        ['L', 'Bloco L - Extensão'],
        ['M', 'Bloco M - Mestrado'],
        ['N', 'Bloco N - Doutorado']
    ];

    db.get('SELECT COUNT(*) as total FROM blocos', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('🏢 Populando tabela blocos...');

            const stmt = db.prepare('INSERT OR IGNORE INTO blocos (letra, nome) VALUES (?, ?)');

            blocos.forEach(bloco => {
                stmt.run(bloco, (err) => {
                    if (err && !err.message.includes('UNIQUE')) {
                        console.error('❌ Erro ao inserir bloco:', bloco[0], err);
                    }
                });
            });

            stmt.finalize();
            console.log('✅ Blocos populados com sucesso');
        }
    });
}

// Popular cursos básicos
function popularCursosBasicos() {
    const cursos = [
        ['Sistemas de Informação', 8, 'Noturno', 8],
        ['Administração', 8, 'Noturno', 8],
        ['Direito', 10, 'Integral', 10],
        ['Engenharia Civil', 10, 'Integral', 10],
        ['Medicina', 12, 'Integral', 12],
        ['Psicologia', 10, 'Integral', 10],
        ['Enfermagem', 8, 'Integral', 8],
        ['Educação Física', 8, 'Integral', 8],
        ['Ciências Contábeis', 8, 'Noturno', 8],
        ['Arquitetura e Urbanismo', 10, 'Integral', 10]
    ];

    db.get('SELECT COUNT(*) as total FROM cursos', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('📚 Populando tabela cursos com períodos...');

            const stmt = db.prepare('INSERT OR IGNORE INTO cursos (nome, duracao, turno, total_periodos) VALUES (?, ?, ?, ?)');

            cursos.forEach(curso => {
                stmt.run(curso, (err) => {
                    if (err && !err.message.includes('UNIQUE')) {
                        console.error('❌ Erro ao inserir curso:', curso[0], err);
                    }
                });
            });

            stmt.finalize();
            console.log('✅ Cursos com períodos populados com sucesso');
        }
    });
}

// Popular professores
function popularProfessores() {
    const professores = [
        ['João Silva', 'joao.silva@unipam.edu.br'],
        ['Maria Santos', 'maria.santos@unipam.edu.br'],
        ['Pedro Costa', 'pedro.costa@unipam.edu.br'],
        ['Ana Oliveira', 'ana.oliveira@unipam.edu.br'],
        ['Carlos Souza', 'carlos.souza@unipam.edu.br']
    ];

    db.get('SELECT COUNT(*) as total FROM professores', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('👨‍🏫 Populando tabela professores...');

            const stmt = db.prepare('INSERT OR IGNORE INTO professores (nome, email) VALUES (?, ?)');

            professores.forEach(professor => {
                stmt.run(professor, (err) => {
                    if (err && !err.message.includes('UNIQUE')) {
                        console.error('❌ Erro ao inserir professor:', professor[0], err);
                    }
                });
            });

            stmt.finalize();
            console.log('✅ Professores populados com sucesso');
        }
    });
}

// Popular disciplinas
function popularDisciplinas() {
    const disciplinas = [
        ['Programação Web', 1, 3, 80],
        ['Banco de Dados', 1, 2, 60],
        ['Engenharia de Software', 1, 4, 80],
        ['Redes de Computadores', 1, 3, 60],
        ['Direito Civil', 3, 1, 80],
        ['Administração Financeira', 2, 3, 60],
        ['Cálculo I', 4, 1, 80],
        ['Anatomia Humana', 5, 1, 100]
    ];

    db.get('SELECT COUNT(*) as total FROM disciplinas', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('📖 Populando tabela disciplinas...');

            const stmt = db.prepare('INSERT OR IGNORE INTO disciplinas (nome, curso_id, periodo, carga_horaria) VALUES (?, ?, ?, ?)');

            disciplinas.forEach(disciplina => {
                stmt.run(disciplina, (err) => {
                    if (err && !err.message.includes('UNIQUE')) {
                        console.error('❌ Erro ao inserir disciplina:', disciplina[0], err);
                    }
                });
            });

            stmt.finalize();
            console.log('✅ Disciplinas populadas com sucesso');
        }
    });
}

// Popular turmas
function popularTurmas() {
    const turmas = [
        ['SI-2024-1A', 'Sistemas de Informação', 1, 2024],
        ['SI-2024-1B', 'Sistemas de Informação', 1, 2024],
        ['SI-2024-2A', 'Sistemas de Informação', 2, 2024],
        ['SI-2024-3A', 'Sistemas de Informação', 3, 2024],
        ['ADM-2024-1A', 'Administração', 1, 2024],
        ['ADM-2024-1B', 'Administração', 1, 2024],
        ['DIR-2024-1A', 'Direito', 1, 2024],
        ['DIR-2024-2A', 'Direito', 2, 2024],
        ['ENG-2024-1A', 'Engenharia Civil', 1, 2024],
        ['MED-2024-1A', 'Medicina', 1, 2024]
    ];

    db.get('SELECT COUNT(*) as total FROM turmas', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('👥 Populando tabela turmas...');

            const stmt = db.prepare('INSERT OR IGNORE INTO turmas (nome, curso, periodo, ano) VALUES (?, ?, ?, ?)');

            turmas.forEach(turma => {
                stmt.run(turma, (err) => {
                    if (err && !err.message.includes('UNIQUE')) {
                        console.error('❌ Erro ao inserir turma:', turma[0], err);
                    }
                });
            });

            stmt.finalize();
            console.log('✅ Turmas populadas com sucesso');
        }
    });
}

// Popular horários
function popularHorarios() {
    const horarios = [
        ['M1', '07:30', '09:10'],
        ['M2', '09:20', '11:00'],
        ['M3', '11:10', '12:50'],
        ['T1', '13:00', '14:40'],
        ['T2', '14:50', '16:30'],
        ['T3', '16:40', '18:20'],
        ['N1', '19:00', '20:40'],
        ['N2', '20:50', '22:30']
    ];

    db.get('SELECT COUNT(*) as total FROM horarios', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('🕐 Populando tabela horarios...');

            const stmt = db.prepare('INSERT OR IGNORE INTO horarios (nome, horario_inicio, horario_fim) VALUES (?, ?, ?)');

            horarios.forEach(horario => {
                stmt.run(horario, (err) => {
                    if (err && !err.message.includes('UNIQUE')) {
                        console.error('❌ Erro ao inserir horario:', horario[0], err);
                    }
                });
            });

            stmt.finalize();
            console.log('✅ Horários populados com sucesso');
        }
    });
}

// Criar salas de exemplo (versão consolidada)
function criarSalasExemplo() {
    db.get('SELECT COUNT(*) as total FROM salas', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('🏫 Criando salas de exemplo...');

            // Criar salas para blocos A a N
            const blocos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
            const stmt = db.prepare(`
                INSERT INTO salas (numero, bloco, andar, tipo, capacidade, recursos) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            let salasCriadas = 0;

            blocos.forEach(bloco => {
                // Criar 5 salas por andar (Térreo, 1º, 2º, 3º andar)
                for (let andar = 0; andar <= 3; andar++) {
                    for (let i = 1; i <= 5; i++) {
                        const numero = `${bloco}${andar}${i.toString().padStart(2, '0')}`;
                        const tipo = andar === 3 ? 'Laboratório' : 'Sala de Aula';
                        const capacidade = andar === 3 ? 20 : 30;
                        const recursos = andar === 3 ? 'Computadores, Projetor' : 'Projetor, Quadro';

                        stmt.run([numero, bloco, andar, tipo, capacidade, recursos], (err) => {
                            if (err) {
                                // Ignorar erros de duplicação
                                if (!err.message.includes('UNIQUE')) {
                                    console.error('❌ Erro ao criar sala:', numero, err);
                                }
                            } else {
                                salasCriadas++;
                            }
                        });
                    }
                }
            });

            stmt.finalize(() => {
                console.log(`✅ ${salasCriadas} salas de exemplo criadas`);
            });
        }
    });
}

// Criar usuário admin padrão
function criarUsuarioAdmin() {
    db.get('SELECT COUNT(*) as total FROM usuarios WHERE tipo = "admin"', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('👤 Criando usuário admin padrão...');

            bcrypt.hash('admin123', 10, (err, senhaHash) => {
                if (err) {
                    console.error('❌ Erro ao criar hash para admin:', err);
                    return;
                }

                db.run(
                    `INSERT INTO usuarios (nome, email, senha_hash, tipo) 
                     VALUES (?, ?, ?, 'admin')`,
                    ['Administrador', 'admin@unipam.edu.br', senhaHash],
                    function (err) {
                        if (err) {
                            console.error('❌ Erro ao criar usuário admin:', err);
                        } else {
                            console.log('✅ Usuário admin criado com ID:', this.lastID);
                            console.log('📧 Email: admin@unipam.edu.br');
                            console.log('🔑 Senha: admin123');
                        }
                    }
                );
            });
        }
    });
}

// Criar usuário professor padrão
function criarUsuarioProfessor() {
    db.get('SELECT COUNT(*) as total FROM usuarios WHERE tipo = "professor"', [], (err, row) => {
        if (err) return;

        if (!row || row.total === 0) {
            console.log('👨‍🏫 Criando usuário professor padrão...');

            bcrypt.hash('prof123', 10, (err, senhaHash) => {
                if (err) {
                    console.error('❌ Erro ao criar hash para professor:', err);
                    return;
                }

                db.run(
                    `INSERT INTO usuarios (nome, email, senha_hash, tipo) 
                     VALUES (?, ?, ?, 'professor')`,
                    ['Professor Teste', 'professor@unipam.edu.br', senhaHash],
                    function (err) {
                        if (err) {
                            console.error('❌ Erro ao criar usuário professor:', err);
                        } else {
                            console.log('✅ Usuário professor criado com ID:', this.lastID);
                            console.log('📧 Email: professor@unipam.edu.br');
                            console.log('🔑 Senha: prof123');
                        }
                    }
                );
            });
        }
    });
}

// Função para criar salas adicionais (opcional)
function criarSalasAdicionais() {
    console.log('🏗️ Criando salas adicionais...');

    const tiposSala = ['Sala de Aula', 'Laboratório', 'Auditório', 'Sala de Reunião'];

    // Criar salas para os blocos A-N
    for (let blocoId = 1; blocoId <= 14; blocoId++) {
        const blocoLetra = String.fromCharCode(64 + blocoId); // A, B, C, ..., N

        for (let andar = 0; andar <= 3; andar++) {
            const numSalas = Math.floor(Math.random() * 6) + 8; // 8-13 salas por andar

            for (let i = 1; i <= numSalas; i++) {
                const capacidade = Math.floor(Math.random() * 40) + 20; // 20-60 lugares
                const tipo = tiposSala[Math.floor(Math.random() * tiposSala.length)];
                const numeroSala = `${blocoLetra}${andar}${i.toString().padStart(2, '0')}`;

                db.run(
                    `INSERT OR IGNORE INTO salas 
                     (numero, bloco, andar, tipo, capacidade, recursos) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        numeroSala,
                        blocoLetra,
                        andar,
                        tipo,
                        capacidade,
                        'Projetor, Ar-condicionado, Quadro branco'
                    ],
                    function (err) {
                        if (err && !err.message.includes('UNIQUE')) {
                            console.error(`❌ Erro ao criar sala ${numeroSala}:`, err);
                        }
                    }
                );
            }
        }
    }

    console.log('✅ Salas adicionais criadas!');
}

// Função para verificar e criar tabela aluno_turmas se necessário
function initializeAlunoTurmasTable() {
    console.log('🔄 Verificando tabela aluno_turmas...');

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

// Função para atualizar períodos dos cursos
function atualizarPeriodosDosCursos() {
    console.log('📚 Atualizando períodos dos cursos existentes...');

    const cursosPeriodos = {
        'Sistemas de Informação': 8,
        'Administração': 8,
        'Direito': 10,
        'Medicina': 12,
        'Engenharia Civil': 10,
        'Psicologia': 10,
        'Enfermagem': 8,
        'Educação Física': 8,
        'Ciências Contábeis': 8,
        'Arquitetura e Urbanismo': 10
    };

    Object.entries(cursosPeriodos).forEach(([nome, periodos]) => {
        db.run(
            'UPDATE cursos SET total_periodos = ? WHERE nome = ?',
            [periodos, nome],
            function (err) {
                if (err) {
                    console.error(`❌ Erro ao atualizar curso ${nome}:`, err);
                } else if (this.changes > 0) {
                    console.log(`✅ Curso ${nome} atualizado com ${periodos} períodos`);
                }
            }
        );
    });
}

module.exports = {
    initializeDatabase,
    criarSalasAdicionais,
    initializeAlunoTurmasTable,
    popularCursosBasicos,
    criarSalasExemplo,
    criarUsuarioAdmin,
    atualizarPeriodosDosCursos
};