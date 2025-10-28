const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Listar todos os professores
router.get('/', authenticateToken, (req, res) => {
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

// Adicionar professor aos favoritos
router.post('/favoritos', authenticateToken, (req, res) => {
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

// Obter professores favoritos de um aluno
router.get('/favoritos/:aluno_id', authenticateToken, (req, res) => {
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

// Remover professor dos favoritos
router.delete('/favoritos/:aluno_id/:professor_id', authenticateToken, (req, res) => {
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

// Criar professor (apenas admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
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

// Atualizar professor (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
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

// Alterar status do professor (apenas admin)
router.put('/:id/status', authenticateToken, requireAdmin, (req, res) => {
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

// Obter contagem de favoritos de um professor
router.get('/:id/favoritos-count', authenticateToken, requireAdmin, (req, res) => {
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

// Rota alternativa para favoritos
router.get('/:id/favoritos', authenticateToken, requireAdmin, (req, res) => {
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

// Obter estatísticas de professores (apenas admin)
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
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

// Obter aulas de um professor específico
router.get('/:id/aulas', authenticateToken, (req, res) => {
    const { id } = req.params;
    
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
    
    db.all(query, [id], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar aulas do professor:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

module.exports = router;