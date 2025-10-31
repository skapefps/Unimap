const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Listar todos os cursos
router.get('/', authenticateToken, (req, res) => {
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

// Listar cursos com períodos
router.get('/com-periodos', authenticateToken, (req, res) => {
    console.log('📚 Buscando cursos com períodos...');
    
    db.all('SELECT id, nome, total_periodos FROM cursos WHERE ativo = 1 ORDER BY nome', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar cursos com períodos:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} cursos encontrados`);
        res.json(rows);
    });
});

// Obter curso por ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    console.log('🔍 Buscando curso:', id);
    
    db.get('SELECT * FROM cursos WHERE id = ? AND ativo = 1', [id], (err, row) => {
        if (err) {
            console.error('❌ Erro ao buscar curso:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Curso não encontrado' });
        }
        
        res.json(row);
    });
});

// Criar novo curso (apenas admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
    const { nome, duracao, turno, total_periodos } = req.body;
    
    console.log('🆕 Criando novo curso:', { nome, duracao, turno });
    
    if (!nome) {
        return res.status(400).json({ error: 'Nome do curso é obrigatório' });
    }

    db.run(
        'INSERT INTO cursos (nome, duracao, turno, total_periodos) VALUES (?, ?, ?, ?)',
        [nome, duracao, turno, total_periodos || 8],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar curso:', err);
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Já existe um curso com este nome' });
                }
                return res.status(400).json({ error: err.message });
            }
            
            console.log('✅ Curso criado com ID:', this.lastID);
            res.json({ 
                success: true, 
                message: 'Curso criado com sucesso!', 
                id: this.lastID 
            });
        }
    );
});

// Atualizar curso (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, duracao, turno, total_periodos, ativo } = req.body;
    
    console.log('✏️ Atualizando curso:', id);
    
    db.run(
        `UPDATE cursos 
         SET nome = ?, duracao = ?, turno = ?, total_periodos = ?, ativo = ?
         WHERE id = ?`,
        [nome, duracao, turno, total_periodos, ativo, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar curso:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Curso não encontrado' });
            }
            
            res.json({ 
                success: true, 
                message: 'Curso atualizado com sucesso!' 
            });
        }
    );
});

// Excluir curso (apenas admin - soft delete)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log('🗑️ Excluindo curso:', id);
    
    db.run(
        'UPDATE cursos SET ativo = 0 WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao excluir curso:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Curso não encontrado' });
            }
            
            res.json({ 
                success: true, 
                message: 'Curso excluído com sucesso!' 
            });
        }
    );
});

// Estatísticas dos cursos
router.get('/:id/estatisticas', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log('📊 Buscando estatísticas do curso:', id);
    
    const queries = [
        'SELECT COUNT(*) as total_alunos FROM usuarios WHERE curso = (SELECT nome FROM cursos WHERE id = ?) AND ativo = 1',
        'SELECT COUNT(*) as total_disciplinas FROM disciplinas WHERE curso_id = ? AND ativa = 1',
        'SELECT COUNT(*) as total_turmas FROM turmas WHERE curso = (SELECT nome FROM cursos WHERE id = ?) AND ativa = 1'
    ];
    
    db.serialize(() => {
        const results = {};
        let completed = 0;
        
        // Total de alunos
        db.get(queries[0], [id], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de alunos:', err);
                results.total_alunos = 0;
            } else {
                results.total_alunos = row ? row.total_alunos : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Total de disciplinas
        db.get(queries[1], [id], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de disciplinas:', err);
                results.total_disciplinas = 0;
            } else {
                results.total_disciplinas = row ? row.total_disciplinas : 0;
            }
            completed++;
            checkComplete();
        });
        
        // Total de turmas
        db.get(queries[2], [id], (err, row) => {
            if (err) {
                console.error('❌ Erro ao buscar total de turmas:', err);
                results.total_turmas = 0;
            } else {
                results.total_turmas = row ? row.total_turmas : 0;
            }
            completed++;
            checkComplete();
        });
        
        function checkComplete() {
            if (completed === queries.length) {
                console.log('✅ Estatísticas do curso carregadas:', results);
                res.json(results);
            }
        }
    });
});

module.exports = router;