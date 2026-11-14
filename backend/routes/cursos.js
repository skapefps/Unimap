const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();


const { validarId } = require('../middleware/validarId');

// Qualquer rota com :id recebe 400 para id nao numerico, em vez de
// 500 por erro de tipo do Postgres.
router.param('id', validarId);

// Listar todos os cursos (ativos)
router.get('/', authenticateToken, (req, res) => {
    const query = `SELECT id, nome FROM cursos WHERE ativo = 1 ORDER BY nome`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar cursos:', err);
            return res.status(500).json({ error: err.message });
        }
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

// Listar cursos detalhados (ativos)
router.get('/detalhados', authenticateToken, (req, res) => {
    console.log('📚 Buscando cursos detalhados...');

    const query = `
        SELECT 
            id,
            nome,
            total_periodos,
            duracao,
            turno,
            ativo
        FROM cursos 
        WHERE ativo = 1
        ORDER BY nome
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar cursos detalhados:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ ${rows.length} cursos detalhados encontrados`);
        res.json(rows);
    });
});

// Listar TODOS os cursos (ativos E inativos)
router.get('/todos', authenticateToken, (req, res) => {
    console.log('📚 Buscando TODOS os cursos (ativos e inativos)...');

    const query = `
        SELECT 
            id,
            nome,
            total_periodos,
            duracao,
            turno,
            ativo
        FROM cursos 
        ORDER BY id
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar todos os cursos:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ ${rows.length} cursos encontrados (ativos + inativos)`);
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

// ⭐⭐ CRIAR NOVO CURSO - CORRIGIDO ⭐⭐
router.post('/', authenticateToken, requireAdmin, (req, res) => {
    const { nome, duracao, turno, total_periodos } = req.body;

    console.log('🆕 Criando novo curso:', { nome, duracao, turno });

    if (!nome || nome.trim() === '') {
        return res.status(400).json({ 
            success: false,
            error: 'Nome do curso é obrigatório' 
        });
    }

    if (!turno || turno.trim() === '') {
        return res.status(400).json({ 
            success: false,
            error: 'Turno é obrigatório' 
        });
    }

    // O id é atribuído pelo banco.
    //
    // Aqui havia um `SELECT MAX(id) + 1` seguido de insert com o id
    // explícito. Dois problemas: dois pedidos simultâneos calculam o
    // mesmo id e um deles falha; e inserir id explícito não avança a
    // sequence do Postgres, então o próximo insert automático colide com
    // uma linha existente.
    {
        db.run(
            'INSERT INTO cursos (nome, duracao, turno, total_periodos, ativo) VALUES (?, ?, ?, ?, ?)',
            [nome.trim(), duracao, turno, total_periodos || 10, 1],
            function (err) {
                const nextId = this && this.lastID;

                if (err) {
                    console.error('❌ Erro ao criar curso:', err);
                    // Postgres: 23505 = unique_violation. A mensagem do
                    // sqlite3 trazia "UNIQUE"; a do pg, não.
                    if (err.code === '23505' || (err.message || '').includes('UNIQUE')) {
                        return res.status(400).json({
                            success: false,
                            error: 'Já existe um curso com este nome' 
                        });
                    }
                    return res.status(400).json({ 
                        success: false,
                        error: 'Erro ao criar curso no banco de dados' 
                    });
                }

                console.log('✅ Curso criado com ID:', nextId);
                res.status(201).json({
                    success: true,
                    message: 'Curso criado com sucesso!',
                    data: {
                        id: nextId,
                        nome: nome.trim(),
                        duracao,
                        turno,
                        total_periodos: total_periodos || 10,
                        ativo: 1
                    }
                });
            }
        );
    }
});

// ⭐⭐ ATUALIZAR CURSO - CORRIGIDO (AGORA COM success: true) ⭐⭐
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, duracao, turno, total_periodos, ativo } = req.body;

    console.log('✏️ Atualizando curso:', id);

    // Validações
    if (!nome || nome.trim() === '') {
        return res.status(400).json({ 
            success: false,
            error: 'Nome do curso é obrigatório' 
        });
    }

    if (!turno || turno.trim() === '') {
        return res.status(400).json({ 
            success: false,
            error: 'Turno é obrigatório' 
        });
    }

    db.run(
        `UPDATE cursos 
         SET nome = ?, duracao = ?, turno = ?, total_periodos = ?, ativo = ?
         WHERE id = ?`,
        [nome, duracao, turno, total_periodos, ativo, id],
        function (err) {
            if (err) {
                console.error('❌ Erro ao atualizar curso:', err);
                return res.status(400).json({ 
                    success: false,
                    error: err.message 
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Curso não encontrado' 
                });
            }

            console.log('✅ Curso atualizado com sucesso');
            res.json({
                success: true,  // ⭐⭐ CORREÇÃO: ESTAVA FALTANDO ⭐⭐
                message: 'Curso atualizado com sucesso!'
            });
        }
    );
});

// ⭐⭐ EXCLUIR CURSO (soft delete) - CORRIGIDO ⭐⭐
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    console.log('🗑️ Excluindo curso (soft delete):', id);

    db.run(
        'UPDATE cursos SET ativo = 0 WHERE id = ?',
        [id],
        function (err) {
            if (err) {
                console.error('❌ Erro ao excluir curso:', err);
                return res.status(400).json({ 
                    success: false,
                    error: err.message 
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Curso não encontrado' 
                });
            }

            res.json({
                success: true,
                message: 'Curso desativado com sucesso!'
            });
        }
    );
});

// ⭐⭐ EXCLUIR PERMANENTEMENTE - CORRIGIDO ⭐⭐
router.delete('/admin/excluir-permanentemente/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    console.log('🔥 Excluindo permanentemente curso:', id);

    db.get('SELECT id, ativo, nome FROM cursos WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('❌ Erro ao verificar curso:', err);
            return res.status(500).json({ 
                success: false,
                error: err.message 
            });
        }

        if (!row) {
            return res.status(404).json({ 
                success: false,
                error: 'Curso não encontrado' 
            });
        }

        if (row.ativo === 1) {
            return res.status(400).json({
                success: false,
                error: 'Não é possível excluir permanentemente um curso ativo. Desative o curso primeiro.'
            });
        }

        db.run('DELETE FROM cursos WHERE id = ?', [id], function (err) {
            if (err) {
                console.error('❌ Erro ao excluir curso:', err);
                return res.status(500).json({ 
                    success: false,
                    error: err.message 
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Curso não encontrado' 
                });
            }

            res.json({
                success: true,
                message: 'Curso excluído permanentemente com sucesso!'
            });
        });
    });
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