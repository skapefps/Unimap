const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Debug de usuários
router.get('/usuarios', authenticateToken, requireAdmin, (req, res) => {
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

// Debug de salas
router.get('/salas', authenticateToken, requireAdmin, (req, res) => {
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

// Debug de professores
router.get('/professores', authenticateToken, requireAdmin, (req, res) => {
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

// Debug de aulas do professor
router.get('/aulas-professor', authenticateToken, (req, res) => {
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

// Debug de turmas com filtro
router.get('/turmas-filtro', authenticateToken, (req, res) => {
    const { curso, periodo } = req.query;
    
    console.log('🔍 Debug filtro turmas:', { curso, periodo });
    
    const query = `
        SELECT * FROM turmas 
        WHERE curso = ? AND periodo = ? AND ativa = 1
        ORDER BY nome
    `;
    
    db.all(query, [curso, periodo], (err, rows) => {
        if (err) {
            console.error('❌ Erro no debug:', err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            curso_filtro: curso,
            periodo_filtro: periodo,
            total_turmas: rows.length,
            turmas: rows
        });
    });
});

// Debug completo do aluno
router.get('/aluno-completo/:id', authenticateToken, (req, res) => {
    const alunoId = req.params.id;
    
    console.log('🔍 DEBUG COMPLETO do aluno:', alunoId);
    
    const query = `
        SELECT 
            u.id, u.nome, u.email, u.curso, u.periodo,
            at.turma_id, 
            t.nome as turma_nome,
            u.curso as curso_original,
            LENGTH(u.curso) as tamanho_curso,
            u.periodo as periodo_original,
            at.turma_id as turma_id_original
        FROM usuarios u
        LEFT JOIN aluno_turmas at ON u.id = at.aluno_id AND at.status = 'cursando'
        LEFT JOIN turmas t ON at.turma_id = t.id
        WHERE u.id = ? AND u.ativo = 1
    `;
    
    db.get(query, [alunoId], (err, aluno) => {
        if (err) {
            console.error('❌ Erro no debug:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!aluno) {
            console.log('❌ Aluno não encontrado no debug');
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }
        
        console.log('📊 DETALHES COMPLETOS DO ALUNO:', aluno);
        
        // Análise detalhada
        const analise = {
            existe_aluno: !!aluno,
            curso: {
                valor: aluno.curso_original,
                tamanho: aluno.tamanho_curso,
                vazio: !aluno.curso_original || aluno.curso_original.trim() === '',
                preenchido: !!aluno.curso_original && aluno.curso_original.trim() !== ''
            },
            periodo: {
                valor: aluno.periodo_original,
                vazio: aluno.periodo_original === null || aluno.periodo_original === undefined || aluno.periodo_original === '',
                preenchido: aluno.periodo_original !== null && aluno.periodo_original !== undefined && aluno.periodo_original !== ''
            },
            turma: {
                valor: aluno.turma_id_original,
                vazio: aluno.turma_id_original === null || aluno.turma_id_original === undefined || aluno.turma_id_original === '',
                preenchido: aluno.turma_id_original !== null && aluno.turma_id_original !== undefined && aluno.turma_id_original !== ''
            },
            cadastro_completo: !(!aluno.curso_original || aluno.curso_original.trim() === '' || 
                               aluno.periodo_original === null || aluno.periodo_original === undefined || aluno.periodo_original === '' ||
                               aluno.turma_id_original === null || aluno.turma_id_original === undefined || aluno.turma_id_original === '')
        };
        
        res.json({
            aluno: aluno,
            analise: analise,
            precisa_completar: !analise.cadastro_completo
        });
    });
});

// Debug do estado do aluno
router.get('/estado-aluno/:id', authenticateToken, (req, res) => {
    const alunoId = req.params.id;
    
    db.get(`
        SELECT u.id, u.nome, u.curso, u.periodo, at.turma_id, t.nome as turma_nome
        FROM usuarios u
        LEFT JOIN aluno_turmas at ON u.id = at.aluno_id AND at.status = 'cursando'
        LEFT JOIN turmas t ON at.turma_id = t.id
        WHERE u.id = ?
    `, [alunoId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(row);
    });
});

// Rotas disponíveis para aluno
router.get('/routes-aluno', (req, res) => {
    const rotasAluno = [
        'GET  /api/aluno/dados-completos/:id',
        'POST /api/aluno/completar-cadastro',
        'GET  /api/turmas/curso/:cursoId/periodo/:periodo',
        'GET  /api/cursos-com-periodos',
        'GET  /api/turmas/public',
        'GET  /api/cursos',
        'GET  /api/debug/routes-aluno'
    ];
    
    res.json({
        success: true,
        message: 'Rotas disponíveis para o sistema de alunos',
        rotas: rotasAluno
    });
});

// Status do servidor
router.get('/status', (req, res) => {
    db.get('SELECT COUNT(*) as total_tables FROM sqlite_master WHERE type="table"', [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao verificar banco' });
        }
        res.json({
            status: '✅ Online',
            porta: process.env.PORT || 3000,
            total_tabelas: row.total_tables,
            banco: 'SQLite (unimap.db)',
            google_oauth: '✅ Configurado'
        });
    });
});

// Teste de turmas público
router.get('/test-turmas', (req, res) => {
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

module.exports = router;