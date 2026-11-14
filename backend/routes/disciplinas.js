const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();


const { validarId } = require('../middleware/validarId');
const { validate, schemas } = require('../middleware/validate');

// Qualquer rota com :id recebe 400 para id nao numerico, em vez de
// 500 por erro de tipo do Postgres.
router.param('id', validarId);

// Listar todas as disciplinas
router.get('/', authenticateToken, (req, res) => {
    console.log('📚 Buscando disciplinas...');
    
    const query = `
        SELECT d.*, c.nome as curso_nome 
        FROM disciplinas d 
        LEFT JOIN cursos c ON d.curso_id = c.id 
        WHERE d.ativa = 1 
        ORDER BY d.nome
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar disciplinas:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ ${rows.length} disciplinas encontradas`);
        res.json(rows);
    });
});

// Listar disciplinas por curso
router.get('/curso/:curso_id', authenticateToken, (req, res) => {
    const { curso_id } = req.params;
    
    console.log('🔍 Buscando disciplinas do curso:', curso_id);
    
    const query = `
        SELECT d.*, c.nome as curso_nome 
        FROM disciplinas d 
        LEFT JOIN cursos c ON d.curso_id = c.id 
        WHERE d.curso_id = ? AND d.ativa = 1 
        ORDER BY d.periodo, d.nome
    `;
    
    db.all(query, [curso_id], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar disciplinas do curso:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ ${rows.length} disciplinas encontradas para o curso ${curso_id}`);
        res.json(rows);
    });
});

// Obter disciplina por ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    console.log('🔍 Buscando disciplina:', id);
    
    const query = `
        SELECT d.*, c.nome as curso_nome 
        FROM disciplinas d 
        LEFT JOIN cursos c ON d.curso_id = c.id 
        WHERE d.id = ? AND d.ativa = 1
    `;
    
    db.get(query, [id], (err, row) => {
        if (err) {
            console.error('❌ Erro ao buscar disciplina:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Disciplina não encontrada' });
        }
        
        res.json(row);
    });
});

// Criar nova disciplina (apenas admin)
router.post('/', authenticateToken, requireAdmin, validate(schemas.disciplina), (req, res) => {
    const { nome, curso_id, periodo, carga_horaria } = req.body;
    
    console.log('🆕 Criando nova disciplina:', { nome, curso_id, periodo });
    
    if (!nome || !curso_id) {
        return res.status(400).json({ error: 'Nome e curso são obrigatórios' });
    }

    db.run(
        'INSERT INTO disciplinas (nome, curso_id, periodo, carga_horaria) VALUES (?, ?, ?, ?)',
        [nome, curso_id, periodo || 1, carga_horaria || 60],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar disciplina:', err);
                return res.status(400).json({ error: err.message });
            }
            
            console.log('✅ Disciplina criada com ID:', this.lastID);
            res.json({ 
                success: true, 
                message: 'Disciplina criada com sucesso!', 
                id: this.lastID 
            });
        }
    );
});

// Atualizar disciplina (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, validate(schemas.disciplina), (req, res) => {
    const { id } = req.params;
    const { nome, curso_id, periodo, carga_horaria, ativa } = req.body;
    
    console.log('✏️ Atualizando disciplina:', id);
    
    db.run(
        `UPDATE disciplinas 
         SET nome = ?, curso_id = ?, periodo = ?, carga_horaria = ?, ativa = ?
         WHERE id = ?`,
        [nome, curso_id, periodo, carga_horaria, ativa, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar disciplina:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Disciplina não encontrada' });
            }
            
            res.json({ 
                success: true, 
                message: 'Disciplina atualizada com sucesso!' 
            });
        }
    );
});

// Excluir disciplina (apenas admin - soft delete)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    console.log('🗑️ Excluindo disciplina:', id);
    
    db.run(
        'UPDATE disciplinas SET ativa = 0 WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao excluir disciplina:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Disciplina não encontrada' });
            }
            
            res.json({ 
                success: true, 
                message: 'Disciplina excluída com sucesso!' 
            });
        }
    );
});

// Buscar ou criar disciplina (para uso em aulas)
router.post('/buscar-ou-criar', authenticateToken, (req, res) => {
    const { nome, curso_id } = req.body;
    
    console.log('🔍 Buscando ou criando disciplina:', nome);
    
    if (!nome) {
        return res.status(400).json({ error: 'Nome da disciplina é obrigatório' });
    }

    // Primeiro, tentar buscar a disciplina pelo nome
    db.get('SELECT id FROM disciplinas WHERE nome = ?', [nome], (err, disciplina) => {
        if (err) {
            console.error('❌ Erro ao buscar disciplina:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        if (disciplina) {
            console.log('✅ Disciplina encontrada:', disciplina.id);
            return res.json({ 
                success: true, 
                disciplina_id: disciplina.id,
                criada: false
            });
        } else {
            // Disciplina não existe, criar uma nova
            console.log('🔄 Criando nova disciplina:', nome);
            
            const cursoId = curso_id || 1; // Fallback para curso 1
            
            db.run(
                'INSERT INTO disciplinas (nome, curso_id, periodo, carga_horaria, ativa) VALUES (?, ?, 1, 60, 1)',
                [nome, cursoId],
                function(err) {
                    if (err) {
                        console.error('❌ Erro ao criar disciplina:', err);
                        return res.status(500).json({ error: 'Erro ao criar disciplina' });
                    }
                    
                    const novaDisciplinaId = this.lastID;
                    console.log('✅ Nova disciplina criada:', novaDisciplinaId);
                    
                    res.json({ 
                        success: true, 
                        disciplina_id: novaDisciplinaId,
                        criada: true
                    });
                }
            );
        }
    });
});

module.exports = router;