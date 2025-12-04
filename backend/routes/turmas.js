const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Listar todas as turmas
router.get('/', authenticateToken, (req, res) => {
    console.log('📚 Buscando todas as turmas (ativas e inativas)...');

    const query = `SELECT * FROM turmas ORDER BY ativa DESC, nome`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas:', err);

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

                    res.json([]);
                });
                return;
            }

            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ ${rows.length} turmas encontradas (ativas e inativas)`);

        const turmasProcessadas = rows.map(turma => ({
            id: turma.id,
            nome: turma.nome,
            curso: turma.curso,
            periodo: turma.periodo,
            ano: turma.ano,
            quantidade_alunos: 0,
            ativa: turma.ativa,
            data_criacao: turma.data_criacao
        }));

        res.json(turmasProcessadas);
    });
});

// Listar turmas simples (sem autenticação para seleção)
router.get('/simple', authenticateToken, (req, res) => {
    console.log('🔍 Buscando todas as turmas (simple)...');

    const query = `
        SELECT id, nome, curso, periodo, ano, ativa 
        FROM turmas 
        WHERE ativa = 1 
        ORDER BY curso, periodo, nome
    `;

    db.all(query, [], (err, turmas) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas simples:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        console.log(`✅ ${turmas.length} turmas encontradas`);
        res.json({
            success: true,
            data: turmas
        });
    });
});

// Listar turmas públicas (sem autenticação)
router.get('/public', (req, res) => {
    console.log('📚 Buscando turmas (pública)...');

    const query = `
        SELECT id, nome, curso, periodo, ano, ativa 
        FROM turmas 
        WHERE ativa = 1 
        ORDER BY curso, periodo, nome
    `;

    db.all(query, [], (err, turmas) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas públicas:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ ${turmas.length} turmas encontradas`);
        res.json(turmas);
    });
});

// Criar turma (apenas admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
    const { nome, curso, periodo, ano } = req.body;

    console.log('🆕 Criando nova turma:', { nome, curso, periodo });

    if (!nome || !curso || !periodo) {
        return res.status(400).json({ error: 'Nome, curso e período são obrigatórios' });
    }

    db.run(
        `INSERT INTO turmas (nome, curso, periodo, ano) 
         VALUES (?, ?, ?, ?)`,
        [nome, curso, periodo, ano || new Date().getFullYear()],
        function (err) {
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

// Atualizar turma (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, curso, periodo, ano, ativa } = req.body;

    console.log('✏️ Atualizando turma:', id);

    db.run(
        `UPDATE turmas 
         SET nome = ?, curso = ?, periodo = ?, ano = ?, ativa = ?
         WHERE id = ?`,
        [nome, curso, periodo, ano, ativa, id],
        function (err) {
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

// Excluir turma (apenas admin)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    console.log('🗑️ Inativando turma:', id);

    db.get('SELECT COUNT(*) as total FROM aluno_turmas WHERE turma_id = ?', [id], (countErr, countResult) => {
        if (countErr) {
            console.error('❌ Erro ao verificar alunos da turma:', countErr);
            return res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }

        if (countResult.total > 0) {
            console.log('❌ Turma ativa tem alunos vinculados, não pode ser inativada');
            return res.status(400).json({
                success: false,
                error: 'Não é possível inativar uma turma ativa que possui alunos vinculados'
            });
        }

        db.run('UPDATE turmas SET ativa = 0 WHERE id = ?', [id], function (err) {
            if (err) {
                console.error('❌ Erro ao inativar turma:', err);
                return res.status(400).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Turma não encontrada' });
            }

            res.json({
                success: true,
                message: 'Turma inativada com sucesso!'
            });
        });
    });
});

// Excluir turma permanentemente (apenas admin)
router.delete('/permanent/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    console.log('🗑️ EXCLUSÃO PERMANENTE de turma:', id);

    db.get('SELECT COUNT(*) as total FROM aluno_turmas WHERE turma_id = ?', [id], (countErr, countResult) => {
        if (countErr) {
            console.error('❌ Erro ao verificar alunos da turma:', countErr);
            return res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }

        if (countResult.total > 0) {
            console.log('❌ Turma tem alunos vinculados, não pode ser excluída');
            return res.status(400).json({
                success: false,
                error: 'Não é possível excluir uma turma que possui alunos vinculados'
            });
        }

        db.run('DELETE FROM turmas WHERE id = ?', [id], function (err) {
            if (err) {
                console.error('❌ Erro ao excluir turma permanentemente:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Erro interno do servidor'
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Turma não encontrada'
                });
            }

            console.log('✅ Turma excluída permanentemente do banco');
            res.json({
                success: true,
                message: 'Turma excluída permanentemente com sucesso!'
            });
        });
    });
});

// Obter alunos de uma turma
router.get('/:id/alunos', authenticateToken, (req, res) => {
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

// Matricular alunos em uma turma
router.post('/matricular-alunos', authenticateToken, requireAdmin, (req, res) => {
    const { turma_id, alunos_ids } = req.body;

    console.log('👥 MATRICULAR ALUNOS - Iniciando:', { turma_id, alunos_ids });

    if (!turma_id || !alunos_ids || !Array.isArray(alunos_ids)) {
        return res.status(400).json({
            success: false,
            error: 'Turma ID e lista de alunos são obrigatórios'
        });
    }

    // Verificar se a turma existe
    db.get('SELECT * FROM turmas WHERE id = ? AND ativa = 1', [turma_id], (err, turma) => {
        if (err) {
            console.error('❌ Erro ao verificar turma:', err);
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

        console.log('✅ Turma encontrada:', turma.nome);

        // Garantir que a tabela existe
        db.run(`CREATE TABLE IF NOT EXISTS aluno_turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER NOT NULL,
            turma_id INTEGER NOT NULL,
            data_matricula DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'cursando',
            UNIQUE(aluno_id, turma_id)
        )`, (createErr) => {
            if (createErr) {
                console.error('❌ Erro ao criar tabela:', createErr);
                return res.status(500).json({
                    success: false,
                    error: 'Erro no banco de dados'
                });
            }

            console.log('✅ Tabela aluno_turmas verificada');

            let matriculados = 0;
            let erros = [];
            let index = 0;

            const processarProximoAluno = () => {
                if (index >= alunos_ids.length) {
                    console.log(`🎯 Processamento concluído: ${matriculados} sucessos, ${erros.length} erros`);

                    if (matriculados > 0) {
                        res.json({
                            success: true,
                            message: `${matriculados} aluno(s) matriculado(s) com sucesso!`,
                            matriculados: matriculados,
                            erros: erros.length > 0 ? erros : undefined
                        });
                    } else {
                        res.status(400).json({
                            success: false,
                            error: 'Nenhum aluno foi matriculado: ' + (erros.length > 0 ? erros.join(', ') : 'Verifique os IDs dos alunos')
                        });
                    }
                    return;
                }

                const alunoId = alunos_ids[index];
                console.log(`🔄 Processando aluno ${index + 1}/${alunos_ids.length}: ID ${alunoId}`);

                // Verificar se o aluno existe
                db.get('SELECT id, nome FROM usuarios WHERE id = ? AND ativo = 1', [alunoId], (alunoErr, aluno) => {
                    if (alunoErr) {
                        console.error(`❌ Erro ao verificar aluno ${alunoId}:`, alunoErr);
                        erros.push(`Aluno ${alunoId}: erro ao verificar`);
                        index++;
                        processarProximoAluno();
                        return;
                    }

                    if (!aluno) {
                        console.log(`❌ Aluno não encontrado: ${alunoId}`);
                        erros.push(`Aluno ${alunoId}: não encontrado`);
                        index++;
                        processarProximoAluno();
                        return;
                    }

                    console.log(`✅ Aluno encontrado: ${aluno.nome} (ID: ${aluno.id})`);

                    // Inserir na tabela aluno_turmas
                    db.run(
                        'INSERT OR IGNORE INTO aluno_turmas (aluno_id, turma_id, status) VALUES (?, ?, "cursando")',
                        [alunoId, turma_id],
                        function (insertErr) {
                            if (insertErr) {
                                console.error(`❌ Erro ao matricular aluno ${alunoId}:`, insertErr);
                                erros.push(`Aluno ${aluno.nome}: ${insertErr.message}`);
                            } else {
                                if (this.changes > 0) {
                                    matriculados++;
                                    console.log(`✅ Aluno ${aluno.nome} matriculado com sucesso`);
                                } else {
                                    console.log(`⚠️ Aluno ${aluno.nome} já estava matriculado nesta turma`);
                                }
                            }

                            index++;
                            processarProximoAluno();
                        }
                    );
                });
            };

            // Iniciar o processamento
            processarProximoAluno();
        });
    });
});

// Desmatricular aluno individual
router.post('/desmatricular-aluno', authenticateToken, requireAdmin, (req, res) => {
    const { turma_id, aluno_id } = req.body;

    console.log('🗑️ Desvinculando aluno:', { turma_id, aluno_id });

    // Verificar se o vínculo existe
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

            // Remover o vínculo
            db.run('DELETE FROM aluno_turmas WHERE aluno_id = ? AND turma_id = ?',
                [aluno_id, turma_id],
                function (deleteErr) {
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
});

// Desvincular todos os alunos de uma turma
router.post('/:id/desvincular-todos', authenticateToken, requireAdmin, (req, res) => {
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

            // Remover todos os vínculos
            db.run('DELETE FROM aluno_turmas WHERE turma_id = ?', [turma_id], function (deleteErr) {
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
});

router.get('/curso/:curso/periodo/:periodo', authenticateToken, (req, res) => {
    const { curso, periodo } = req.params;
    
    console.log(`📋 Buscando turmas para: ${curso} - ${periodo}° período`);
    
    const query = `
        SELECT id, nome, curso, periodo, ano, ativa
        FROM turmas 
        WHERE curso = ? AND periodo = ? AND ativa = 1
        ORDER BY nome
    `;
    
    db.all(query, [curso, periodo], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} turmas encontradas`);
        res.json(rows);
    });
});

// Obter turmas por curso e período
router.get('/curso/:cursoId/periodo/:periodo', authenticateToken, (req, res) => {
    const { cursoId, periodo } = req.params;

    console.log('🔍 Buscando turmas para curso:', cursoId, 'período:', periodo);

    // Buscar o nome do curso pelo ID
    db.get('SELECT nome FROM cursos WHERE id = ?', [cursoId], (err, curso) => {
        if (err) {
            console.error('❌ Erro ao buscar curso:', err);
            return res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }

        if (!curso) {
            return res.status(404).json({
                success: false,
                error: 'Curso não encontrado'
            });
        }

        const nomeCurso = curso.nome;
        console.log('📚 Curso encontrado:', nomeCurso);

        // Buscar turmas que correspondem ao curso e período
        const query = `
            SELECT t.* 
            FROM turmas t
            WHERE t.curso = ? AND t.periodo = ? AND t.ativa = 1
            ORDER BY t.nome
        `;

        db.all(query, [nomeCurso, periodo], (err, turmas) => {
            if (err) {
                console.error('❌ Erro ao buscar turmas:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Erro interno do servidor'
                });
            }

            console.log(`✅ ${turmas.length} turmas encontradas para ${nomeCurso}, período ${periodo}`);

            res.json({
                success: true,
                data: turmas
            });
        });
    });
});

// Criar turmas de exemplo (apenas admin)
router.post('/criar-exemplos', authenticateToken, requireAdmin, (req, res) => {
    console.log('🎯 Criando turmas de exemplo...');

    const turmasExemplo = [
        ['SI-2024-1A', 'Sistemas de Informação', 1, 2024],
        ['SI-2024-1B', 'Sistemas de Informação', 1, 2024],
        ['SI-2024-2A', 'Sistemas de Informação', 2, 2024],
        ['SI-2024-3A', 'Sistemas de Informação', 3, 2024],
        ['ADM-2024-1A', 'Administração', 1, 2024],
        ['ADM-2024-1B', 'Administração', 1, 2024],
        ['DIR-2024-1A', 'Direito', 1, 2024],
        ['DIR-2024-2A', 'Direito', 2, 2024],
        ['DIR-2024-3A', 'Direito', 3, 2024],
        ['ENG-2024-1A', 'Engenharia Civil', 1, 2024]
    ];

    db.serialize(() => {
        // Criar tabela se não existir
        db.run(`CREATE TABLE IF NOT EXISTS turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            curso TEXT NOT NULL,
            periodo INTEGER NOT NULL,
            ano INTEGER DEFAULT 2024,
            ativa BOOLEAN DEFAULT 1
        )`, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela turmas:', err);
                return res.status(500).json({ error: err.message });
            }

            // Inserir turmas
            const stmt = db.prepare('INSERT OR IGNORE INTO turmas (nome, curso, periodo, ano) VALUES (?, ?, ?, ?)');
            let inserted = 0;

            turmasExemplo.forEach(turma => {
                stmt.run(turma, function (err) {
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

                console.log(`🎉 ${inserted} turmas criadas com sucesso!`);
                res.json({
                    success: true,
                    message: `${inserted} turmas criadas com sucesso!`
                });
            });
        });
    });
});

module.exports = router;