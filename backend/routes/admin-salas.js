const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();


const { validarId } = require('../middleware/validarId');

// Qualquer rota com :id recebe 400 para id nao numerico, em vez de
// 500 por erro de tipo do Postgres.
router.param('id', validarId);

// ⭐ ROTA DE TESTE
router.get('/test', authenticateToken, (req, res) => {
    console.log('✅ Rota /api/admin/salas/test está funcionando!');
    res.json({ 
        success: true, 
        message: 'Rota de admin salas está funcionando!',
        timestamp: new Date().toISOString()
    });
});

// ⭐⭐ ROTA ATUALIZADA: Listar salas com paginação, filtros E BUSCA
router.get('/todos', authenticateToken, (req, res) => {
    console.log('📚 Buscando salas com paginação, filtros e busca...');

    // Parâmetros de paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Parâmetros de filtro
    const { bloco, andar, tipo, ativo, campus, busca } = req.query;

    // Construir query base
    let query = `
        SELECT 
            id,
            numero,
            bloco,
            andar,
            tipo,
            capacidade,
            recursos,
            ativa,
            campus
        FROM salas 
        WHERE 1=1
    `;
    
    let countQuery = `SELECT COUNT(*) as total FROM salas WHERE 1=1`;
    let queryParams = [];
    let countParams = [];

    // Aplicar filtro de busca
    if (busca && busca !== '') {
        query += ' AND (numero LIKE ? OR bloco LIKE ? OR tipo LIKE ? OR campus LIKE ?)';
        countQuery += ' AND (numero LIKE ? OR bloco LIKE ? OR tipo LIKE ? OR campus LIKE ?)';
        const buscaTerm = `%${busca}%`;
        queryParams.push(buscaTerm, buscaTerm, buscaTerm, buscaTerm);
        countParams.push(buscaTerm, buscaTerm, buscaTerm, buscaTerm);
        console.log('🔍 Aplicando filtro de busca:', busca);
    }

    // Aplicar filtros existentes
    if (bloco && bloco !== 'todos') {
        query += ' AND bloco = ?';
        countQuery += ' AND bloco = ?';
        queryParams.push(bloco);
        countParams.push(bloco);
    }

    if (andar && andar !== 'todos') {
        query += ' AND andar = ?';
        countQuery += ' AND andar = ?';
        queryParams.push(andar);
        countParams.push(andar);
    }

    if (tipo && tipo !== 'todos') {
        query += ' AND tipo = ?';
        countQuery += ' AND tipo = ?';
        queryParams.push(tipo);
        countParams.push(tipo);
    }

    if (ativo && ativo !== 'todos') {
        const ativoValue = ativo === 'true' ? 1 : 0;
        query += ' AND ativa = ?';
        countQuery += ' AND ativa = ?';
        queryParams.push(ativoValue);
        countParams.push(ativoValue);
    }

    if (campus && campus !== 'todos') {
        query += ' AND campus = ?';
        countQuery += ' AND campus = ?';
        queryParams.push(campus);
        countParams.push(campus);
    }

    // Ordenação
    query += ' ORDER BY bloco, numero';

    // Paginação
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    console.log('🔍 Query:', query);
    console.log('📊 Parâmetros:', queryParams);
    console.log('📄 Paginação: página', page, ', limite:', limit);
    if (busca) console.log('🎯 Busca ativa:', busca);

    // Executar queries em paralelo
    Promise.all([
        new Promise((resolve, reject) => {
            db.all(query, queryParams, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.get(countQuery, countParams, (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.total : 0);
            });
        }),
        new Promise((resolve, reject) => {
            // Buscar valores únicos para filtros
            db.all('SELECT DISTINCT bloco FROM salas WHERE bloco IS NOT NULL AND bloco != "" ORDER BY bloco', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.bloco));
            });
        }),
        new Promise((resolve, reject) => {
            db.all('SELECT DISTINCT andar FROM salas WHERE andar IS NOT NULL AND andar != "" ORDER BY andar', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.andar));
            });
        }),
        new Promise((resolve, reject) => {
            db.all('SELECT DISTINCT tipo FROM salas WHERE tipo IS NOT NULL AND tipo != "" ORDER BY tipo', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.tipo));
            });
        }),
        new Promise((resolve, reject) => {
            db.all('SELECT DISTINCT campus FROM salas WHERE campus IS NOT NULL AND campus != "" ORDER BY campus', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.campus));
            });
        })
    ]).then(([salas, total, blocos, andares, tipos, campi]) => {
        const totalPages = Math.ceil(total / limit);

        console.log(`✅ ${salas.length} salas encontradas (página ${page} de ${totalPages})`);

        res.json({
            success: true,
            data: {
                salas,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: {
                    blocos: blocos || [],
                    andares: andares || [],
                    tipos: tipos || [],
                    campi: campi || []
                },
                busca: busca || ''
            }
        });

    }).catch(err => {
        console.error('❌ Erro ao buscar salas:', err);
        return res.status(500).json({ 
            success: false,
            error: err.message 
        });
    });
});

// Obter sala por ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    console.log('🔍 Buscando sala:', id);

    db.get('SELECT * FROM salas WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('❌ Erro ao buscar sala:', err);
            return res.status(500).json({ 
                success: false,
                error: err.message 
            });
        }

        if (!row) {
            return res.status(404).json({ 
                success: false,
                error: 'Sala não encontrada' 
            });
        }

        res.json({
            success: true,
            data: row
        });
    });
});

// Criar nova sala
router.post('/', authenticateToken, requireAdmin, (req, res) => {
    const { numero, bloco, andar, tipo, capacidade, recursos, campus } = req.body;

    console.log('🆕 Criando nova sala:', { numero, bloco, andar, tipo, capacidade, recursos, campus });

    // Validações
    if (!numero || numero.trim() === '') {
        return res.status(400).json({ 
            success: false,
            error: 'Número da sala é obrigatório' 
        });
    }

    if (!bloco || bloco.trim() === '') {
        return res.status(400).json({ 
            success: false,
            error: 'Bloco é obrigatório' 
        });
    }

    if (!capacidade || capacidade <= 0) {
        return res.status(400).json({ 
            success: false,
            error: 'Capacidade deve ser um número positivo' 
        });
    }

    // Verificar se já existe sala com mesmo número e bloco
    const checkQuery = 'SELECT id FROM salas WHERE numero = ? AND bloco = ? AND ativa = 1';
    db.get(checkQuery, [numero.trim(), bloco.trim()], (err, existing) => {
        if (err) {
            console.error('❌ Erro ao verificar sala existente:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Erro interno do servidor' 
            });
        }

        if (existing) {
            return res.status(400).json({ 
                success: false,
                error: 'Já existe uma sala ativa com este número e bloco' 
            });
        }

        // Inserir nova sala
        const insertQuery = `
            INSERT INTO salas (numero, bloco, andar, tipo, capacidade, recursos, ativa, campus) 
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `;
        
        db.run(insertQuery, 
            [numero.trim(), bloco.trim(), andar, tipo, capacidade, recursos, campus],
            function (err) {
                if (err) {
                    console.error('❌ Erro ao criar sala:', err);
                    return res.status(500).json({ 
                        success: false,
                        error: 'Erro ao criar sala no banco de dados' 
                    });
                }

                console.log('✅ Sala criada com ID:', this.lastID);
                res.status(201).json({
                    success: true,
                    message: 'Sala criada com sucesso!',
                    data: {
                        id: this.lastID,
                        numero: numero.trim(),
                        bloco: bloco.trim(),
                        andar: andar,
                        tipo: tipo,
                        capacidade: capacidade,
                        recursos: recursos,
                        campus: campus,
                        ativa: 1
                    }
                });
            }
        );
    });
});

// Atualizar sala
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { numero, bloco, andar, tipo, capacidade, recursos, ativa, campus } = req.body;

    console.log('✏️ Atualizando sala:', id, { numero, bloco, andar, tipo, capacidade, recursos, ativa, campus });

    // Validações
    if (!numero || numero.trim() === '') {
        return res.status(400).json({ 
            success: false,
            error: 'Número da sala é obrigatório' 
        });
    }

    if (!bloco || bloco.trim() === '') {
        return res.status(400).json({ 
            success: false,
            error: 'Bloco é obrigatório' 
        });
    }

    if (!capacidade || capacidade <= 0) {
        return res.status(400).json({ 
            success: false,
            error: 'Capacidade deve ser um número positivo' 
        });
    }

    // Verificar se a sala existe
    db.get('SELECT id FROM salas WHERE id = ?', [id], (err, sala) => {
        if (err) {
            console.error('❌ Erro ao verificar sala:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Erro interno do servidor' 
            });
        }

        if (!sala) {
            return res.status(404).json({ 
                success: false,
                error: 'Sala não encontrada' 
            });
        }

        // Verificar conflito com outras salas
        const checkQuery = 'SELECT id FROM salas WHERE numero = ? AND bloco = ? AND id != ? AND ativa = 1';
        db.get(checkQuery, [numero.trim(), bloco.trim(), id], (err, conflicting) => {
            if (err) {
                console.error('❌ Erro ao verificar conflito:', err);
                return res.status(500).json({ 
                    success: false,
                    error: 'Erro interno do servidor' 
                });
            }

            if (conflicting) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Já existe outra sala ativa com este número e bloco' 
                });
            }

            // Atualizar sala
            const updateQuery = `
                UPDATE salas 
                SET numero = ?, bloco = ?, andar = ?, tipo = ?, capacidade = ?, recursos = ?, ativa = ?, campus = ?
                WHERE id = ?
            `;
            
            db.run(updateQuery,
                [numero.trim(), bloco.trim(), andar, tipo, capacidade, recursos, ativa, campus, id],
                function (err) {
                    if (err) {
                        console.error('❌ Erro ao atualizar sala:', err);
                        return res.status(500).json({ 
                            success: false,
                            error: err.message 
                        });
                    }

                    if (this.changes === 0) {
                        return res.status(404).json({ 
                            success: false,
                            error: 'Sala não encontrada' 
                        });
                    }

                    console.log('✅ Sala atualizada com sucesso');
                    res.json({
                        success: true,
                        message: 'Sala atualizada com sucesso!'
                    });
                }
            );
        });
    });
});

// Excluir sala (soft delete)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    console.log('🗑️ Excluindo sala (soft delete):', id);

    db.run(
        'UPDATE salas SET ativa = 0 WHERE id = ?',
        [id],
        function (err) {
            if (err) {
                console.error('❌ Erro ao excluir sala:', err);
                return res.status(500).json({ 
                    success: false,
                    error: err.message 
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Sala não encontrada' 
                });
            }

            res.json({
                success: true,
                message: 'Sala desativada com sucesso!'
            });
        }
    );
});

// Excluir permanentemente
router.delete('/admin/excluir-permanentemente/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    console.log('🔥 Excluindo permanentemente sala:', id);

    db.get('SELECT id, ativa, numero, bloco FROM salas WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('❌ Erro ao verificar sala:', err);
            return res.status(500).json({ 
                success: false,
                error: err.message 
            });
        }

        if (!row) {
            return res.status(404).json({ 
                success: false,
                error: 'Sala não encontrada' 
            });
        }

        if (row.ativa === 1) {
            return res.status(400).json({
                success: false,
                error: 'Não é possível excluir permanentemente uma sala ativa. Desative a sala primeiro.'
            });
        }

        db.run('DELETE FROM salas WHERE id = ?', [id], function (err) {
            if (err) {
                console.error('❌ Erro ao excluir sala:', err);
                return res.status(500).json({ 
                    success: false,
                    error: err.message 
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Sala não encontrada' 
                });
            }

            res.json({
                success: true,
                message: 'Sala excluída permanentemente com sucesso!'
            });
        });
    });
});

module.exports = router;