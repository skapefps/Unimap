const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Listar todos os usuários (apenas admin)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
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

// Obter perfil do usuário logado
router.get('/perfil', authenticateToken, (req, res) => {
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

// Atualizar usuário completo (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
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

// Alterar tipo de usuário (apenas admin)
router.put('/:id/tipo', authenticateToken, requireAdmin, (req, res) => {
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

// Excluir usuário (soft delete - apenas admin)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
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

// Estatísticas de usuários (apenas admin)
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
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

module.exports = router;