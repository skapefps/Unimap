const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Listar todos os professores
router.get('/', authenticateToken, (req, res) => {
    console.log('📚 Buscando lista de professores...');
    
    db.all('SELECT * FROM professores ORDER BY ativo DESC, nome', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar professores:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} professores encontrados (ativos e inativos)`);
        res.json(rows);
    });
});

// Listar apenas professores ativos (para alunos)
router.get('/ativos', authenticateToken, (req, res) => {
    console.log('📚 Buscando lista de professores ativos...');
    
    db.all('SELECT * FROM professores WHERE ativo = 1 ORDER BY nome', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar professores ativos:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} professores ativos encontrados`);
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

// Excluir professor permanentemente (apenas admin)
// Excluir professor permanentemente (apenas admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;

    console.log(`🗑️ Tentando excluir professor ID: ${id}`);

    try {
        // Verificar se o professor existe
        const professor = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM professores WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!professor) {
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        console.log(`📋 Professor a ser excluído:`, professor);

        // 🔥 NOVA FUNCIONALIDADE: Buscar e atualizar o usuário correspondente
        let usuarioAtualizado = false;
        console.log(`📧 Buscando usuário com email: ${professor.email}`);
        
        const usuario = await new Promise((resolve, reject) => {
            db.get('SELECT id, nome, email, tipo FROM usuarios WHERE email = ? AND ativo = 1', [professor.email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (usuario) {
            console.log(`👤 Usuário encontrado:`, usuario);
            
            // 🔥 ALTERAR O TIPO DO USUÁRIO PARA "ALUNO"
            if (usuario.tipo === 'professor') {
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE usuarios SET tipo = "aluno", matricula = NULL, periodo = NULL, curso = NULL WHERE id = ?',
                        [usuario.id],
                        function(err) {
                            if (err) {
                                console.error('❌ Erro ao atualizar usuário para aluno:', err);
                                reject(err);
                            } else {
                                console.log(`✅ Usuário ${usuario.id} alterado para aluno`);
                                usuarioAtualizado = true;
                                resolve(this);
                            }
                        }
                    );
                });
            } else {
                console.log(`ℹ️ Usuário já é do tipo "${usuario.tipo}", mantendo tipo atual`);
            }
        } else {
            console.log(`❌ Nenhum usuário encontrado com o email: ${professor.email}`);
        }

        // 🔥 VERIFICAR DEPENDÊNCIAS ANTES DE EXCLUIR

        // 1. Verificar se existem aulas associadas
        const aulasCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM aulas WHERE professor_id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 2. Verificar se existem favoritos associados
        const favoritosCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM professores_favoritos WHERE professor_id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        console.log(`📊 Dependências encontradas: ${aulasCount} aulas, ${favoritosCount} favoritos`);

        // Se houver dependências, excluir em cascata
        if (aulasCount > 0 || favoritosCount > 0) {
            console.log(`⚠️ Professor tem dependências, excluindo em cascata...`);
            
            // Excluir aulas associadas
            if (aulasCount > 0) {
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM aulas WHERE professor_id = ?', [id], function(err) {
                        if (err) reject(err);
                        else {
                            console.log(`✅ ${this.changes} aulas excluídas`);
                            resolve();
                        }
                    });
                });
            }

            // Excluir favoritos associados
            if (favoritosCount > 0) {
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM professores_favoritos WHERE professor_id = ?', [id], function(err) {
                        if (err) reject(err);
                        else {
                            console.log(`✅ ${this.changes} favoritos excluídos`);
                            resolve();
                        }
                    });
                });
            }
        }

        // 🔥 EXCLUIR O PROFESSOR
        const result = await new Promise((resolve, reject) => {
            db.run('DELETE FROM professores WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });

        console.log(`✅ Professor ${id} excluído permanentemente. ${result.changes} linha(s) afetada(s)`);

        // Mensagem de retorno baseada no que foi feito
        let message = 'Professor excluído permanentemente com sucesso!';
        
        if (usuarioAtualizado) {
            message += ' O usuário correspondente foi alterado para aluno.';
        }

        res.json({ 
            success: true, 
            message: message,
            aulas_removidas: aulasCount,
            favoritos_removidos: favoritosCount,
            usuario_alterado: usuarioAtualizado
        });

    } catch (error) {
        console.error('❌ Erro ao excluir professor:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor ao excluir professor',
            details: error.message 
        });
    }
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
// Criar professor (apenas admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    const { nome, email } = req.body;
    
    if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }

    try {
        // 🔥 NOVA FUNCIONALIDADE: Verificar se já existe um usuário com este email
        const usuarioExistente = await new Promise((resolve, reject) => {
            db.get('SELECT id, tipo FROM usuarios WHERE email = ? AND ativo = 1', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        let usuarioId = null;

        if (usuarioExistente) {
            console.log('👤 Usuário existente encontrado:', usuarioExistente);
            
            // Se o usuário existe mas não é professor, atualizar para professor
            if (usuarioExistente.tipo !== 'professor') {
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE usuarios SET tipo = ?, matricula = NULL, periodo = NULL, curso = NULL WHERE id = ?',
                        ['professor', usuarioExistente.id],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                console.log('✅ Tipo de usuário atualizado para professor');
            }
            usuarioId = usuarioExistente.id;
        } else {
            console.log('👤 Criando novo usuário para o professor...');
            
            // 🔥 NOVA FUNCIONALIDADE: Criar usuário automaticamente
            // Gerar uma senha padrão (pode ser alterada depois via "esqueci minha senha")
            const senhaPadrao = 'prof123'; // Em produção, gere uma senha aleatória
            const bcrypt = require('bcryptjs');
            const senhaHash = await bcrypt.hash(senhaPadrao, 10);
            
            const resultUsuario = await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO usuarios (nome, email, senha_hash, tipo) 
                     VALUES (?, ?, ?, 'professor')`,
                    [nome, email, senhaHash],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    }
                );
            });
            
            usuarioId = resultUsuario.lastID;
            console.log('✅ Novo usuário professor criado com ID:', usuarioId);
        }

        // Agora criar/atualizar o registro na tabela professores
        const professorExistente = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM professores WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        let professorId;

        if (professorExistente) {
            // Atualizar professor existente
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE professores SET nome = ?, ativo = 1 WHERE id = ?',
                    [nome, professorExistente.id],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    }
                );
            });
            professorId = professorExistente.id;
            console.log('✅ Professor existente atualizado');
        } else {
            // Criar novo professor
            const resultProfessor = await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO professores (nome, email) VALUES (?, ?)',
                    [nome, email],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    }
                );
            });
            professorId = resultProfessor.lastID;
            console.log('✅ Novo professor criado com ID:', professorId);
        }

        res.json({ 
            success: true, 
            message: 'Professor cadastrado com sucesso!' + (usuarioExistente ? ' Usuário existente atualizado para professor.' : ' Novo usuário criado automaticamente.'),
            id: professorId,
            usuario_id: usuarioId
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar professor:', error);
        
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Este email já está cadastrado' });
        }
        
        return res.status(400).json({ error: error.message });
    }
});

// Atualizar professor (apenas admin)
// Atualizar professor (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { nome, email } = req.body;

    try {
        // Buscar dados atuais do professor
        const professorAtual = await new Promise((resolve, reject) => {
            db.get('SELECT email FROM professores WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!professorAtual) {
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        // 🔥 NOVA FUNCIONALIDADE: Atualizar usuário correspondente se o email mudou
        if (professorAtual.email !== email) {
            console.log('📧 Email alterado, atualizando usuário correspondente...');
            
            const usuarioExistente = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM usuarios WHERE email = ? AND ativo = 1', [professorAtual.email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (usuarioExistente) {
                // Verificar se o novo email já está em uso por outro usuário
                const usuarioComNovoEmail = await new Promise((resolve, reject) => {
                    db.get('SELECT id FROM usuarios WHERE email = ? AND ativo = 1', [email], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                if (usuarioComNovoEmail) {
                    return res.status(400).json({ error: 'Este email já está em uso por outro usuário' });
                }

                // Atualizar email do usuário
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE usuarios SET email = ? WHERE id = ?',
                        [email, usuarioExistente.id],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                console.log('✅ Email do usuário atualizado');
            }
        }

        // Atualizar nome do usuário correspondente
        const usuarioExistente = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM usuarios WHERE email = ? AND ativo = 1', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (usuarioExistente) {
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE usuarios SET nome = ? WHERE id = ?',
                    [nome, usuarioExistente.id],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            console.log('✅ Nome do usuário atualizado');
        }

        // Atualizar professor
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE professores SET nome = ?, email = ? WHERE id = ?',
                [nome, email, id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });

        console.log('✅ Professor e usuário atualizados com sucesso');
        res.json({ success: true, message: 'Professor atualizado com sucesso!' });

    } catch (error) {
        console.error('❌ Erro ao editar professor:', error);
        return res.status(400).json({ error: error.message });
    }
});

// Alterar status do professor (apenas admin)
// Alterar status do professor (apenas admin) - VERSÃO CORRIGIDA E TESTADA
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;

    console.log(`🔄 ALTERANDO STATUS DO PROFESSOR:`, {
        professorId: id,
        novoStatus: ativo,
        tipoNovoStatus: typeof ativo,
        bodyRecebido: req.body
    });

    try {
        // Buscar dados completos do professor
        const professor = await new Promise((resolve, reject) => {
            db.get('SELECT id, nome, email, ativo FROM professores WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('❌ Erro ao buscar professor:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });

        if (!professor) {
            console.error('❌ Professor não encontrado com ID:', id);
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        console.log(`📊 PROFESSOR ENCONTRADO:`, professor);

        // Converter ativo para número para garantir consistência (0 ou 1)
        const ativoNumero = ativo ? 1 : 0;

        // Atualizar status do professor
        const resultadoProfessor = await new Promise((resolve, reject) => {
            db.run(
                'UPDATE professores SET ativo = ? WHERE id = ?',
                [ativoNumero, id],
                function(err) {
                    if (err) {
                        console.error('❌ Erro ao atualizar professor:', err);
                        reject(err);
                    } else {
                        console.log(`✅ Professor atualizado: ${this.changes} linha(s) afetada(s)`);
                        resolve(this);
                    }
                }
            );
        });

        // 🔥 BUSCAR E ATUALIZAR USUÁRIO CORRESPONDENTE
        console.log(`📧 Buscando usuário com email: ${professor.email}`);
        
        const usuario = await new Promise((resolve, reject) => {
            db.get('SELECT id, nome, email, tipo FROM usuarios WHERE email = ? AND ativo = 1', [professor.email], (err, row) => {
                if (err) {
                    console.error('❌ Erro ao buscar usuário:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });

        if (usuario) {
            console.log(`👤 USUÁRIO ENCONTRADO:`, usuario);
            
            if (ativoNumero === 0) {
                // 🔥 DESATIVANDO PROFESSOR: alterar tipo do usuário para aluno
                if (usuario.tipo === 'professor') {
                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE usuarios SET tipo = "aluno", matricula = NULL, periodo = NULL, curso = NULL WHERE id = ?',
                            [usuario.id],
                            function(err) {
                                if (err) {
                                    console.error('❌ Erro ao atualizar usuário para aluno:', err);
                                    reject(err);
                                } else {
                                    console.log(`✅ Usuário ${usuario.id} alterado para aluno`);
                                    resolve(this);
                                }
                            }
                        );
                    });
                } else {
                    console.log(`ℹ️ Usuário já é do tipo "${usuario.tipo}", mantendo tipo atual`);
                }
            } else {
                // 🔥 ATIVANDO PROFESSOR: alterar tipo do usuário para professor
                if (usuario.tipo !== 'professor') {
                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE usuarios SET tipo = "professor", matricula = NULL, periodo = NULL, curso = NULL WHERE id = ?',
                            [usuario.id],
                            function(err) {
                                if (err) {
                                    console.error('❌ Erro ao atualizar usuário para professor:', err);
                                    reject(err);
                                } else {
                                    console.log(`✅ Usuário ${usuario.id} alterado para professor`);
                                    resolve(this);
                                }
                            }
                        );
                    });
                } else {
                    console.log(`ℹ️ Usuário já é professor, mantendo tipo`);
                }
            }
        } else {
            console.log(`❌ NENHUM USUÁRIO ENCONTRADO com o email: ${professor.email}`);
            console.log(`💡 Dica: Verifique se o email do professor corresponde exatamente ao email do usuário`);
        }

        // Buscar dados atualizados para retorno
        const professorAtualizado = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM professores WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        console.log(`🎯 STATUS ALTERADO COM SUCESSO: Professor ${id} -> ${ativoNumero ? 'Ativo' : 'Inativo'}`);

        res.json({ 
            success: true, 
            message: `Professor ${ativoNumero ? 'ativado' : 'desativado'} com sucesso!`,
            data: professorAtualizado
        });

    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao atualizar status do professor:', error);
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message 
        });
    }
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