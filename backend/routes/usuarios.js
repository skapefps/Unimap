const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

const atualizarProfessorFromUsuario = async (usuarioId, usuarioData) => {
    return new Promise((resolve, reject) => {
        console.log('👨‍🏫 Verificando/Criando professor para usuário:', usuarioId);

        // Verificar se já existe um professor com este email
        db.get('SELECT id FROM professores WHERE email = ?', [usuarioData.email], (err, professorExistente) => {
            if (err) {
                console.error('❌ Erro ao verificar professor existente:', err);
                reject(err);
                return;
            }

            if (professorExistente) {
                console.log('✅ Professor já existe, atualizando...');
                // Atualizar professor existente
                db.run(
                    'UPDATE professores SET nome = ?, ativo = 1 WHERE id = ?',
                    [usuarioData.nome, professorExistente.id],
                    function (err) {
                        if (err) {
                            console.error('❌ Erro ao atualizar professor:', err);
                            reject(err);
                        } else {
                            console.log('✅ Professor atualizado com sucesso');
                            resolve();
                        }
                    }
                );
            } else {
                console.log('➕ Criando novo professor...');
                // Criar novo professor
                db.run(
                    'INSERT INTO professores (nome, email) VALUES (?, ?)',
                    [usuarioData.nome, usuarioData.email],
                    function (err) {
                        if (err) {
                            console.error('❌ Erro ao criar professor:', err);
                            reject(err);
                        } else {
                            console.log('✅ Professor criado com sucesso, ID:', this.lastID);
                            resolve();
                        }
                    }
                );
            }
        });
    });
};

// Função para desativar professor quando usuário deixa de ser professor
const desativarProfessorFromUsuario = async (usuarioId, usuarioData) => {
    return new Promise((resolve, reject) => {
        console.log('👨‍🏫 Verificando desativação de professor para usuário:', usuarioId);
        
        // Verificar se existe um professor com este email
        db.get('SELECT id FROM professores WHERE email = ?', [usuarioData.email], (err, professorExistente) => {
            if (err) {
                console.error('❌ Erro ao verificar professor existente:', err);
                reject(err);
                return;
            }
            
            if (professorExistente) {
                console.log('🔴 Desativando professor:', professorExistente.id);
                // Desativar professor
                db.run(
                    'UPDATE professores SET ativo = 0 WHERE id = ?',
                    [professorExistente.id],
                    function(err) {
                        if (err) {
                            console.error('❌ Erro ao desativar professor:', err);
                            reject(err);
                        } else {
                            console.log('✅ Professor desativado com sucesso');
                            resolve();
                        }
                    }
                );
            } else {
                console.log('✅ Nenhum professor encontrado para desativar');
                resolve();
            }
        });
    });
};

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
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { nome, email, matricula, tipo, curso, periodo } = req.body;

    console.log('✏️ Atualizando usuário:', { id, nome, email, tipo, matricula });

    if (!nome || !email || !tipo) {
        return res.status(400).json({ error: 'Nome, email e tipo são obrigatórios' });
    }

    try {
        // Buscar dados atuais do usuário
        const usuarioAtual = await new Promise((resolve, reject) => {
            db.get('SELECT tipo, email, matricula FROM usuarios WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // 🔥 CORREÇÃO: Gerar uma matrícula única temporária quando for NULL
        let matriculaFinal = matricula;
        
        if (tipo === 'professor' || tipo === 'admin') {
            // Para professores e admins, usar um padrão único em vez de NULL
            matriculaFinal = `PROF-${Date.now()}-${id}`;
            console.log(`🔧 Gerando matrícula temporária para ${tipo}: ${matriculaFinal}`);
        }

        // Verificar conflito de email (se email foi alterado)
        if (email !== usuarioAtual.email) {
            const emailExistente = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM usuarios WHERE email = ? AND ativo = 1 AND id != ?', [email, id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (emailExistente) {
                return res.status(400).json({ error: 'Este email já está em uso' });
            }
        }

        // Verificar conflito de matrícula (apenas se não for professor/admin)
        if (matriculaFinal && matriculaFinal !== usuarioAtual.matricula && tipo === 'aluno') {
            const matriculaExistente = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM usuarios WHERE matricula = ? AND ativo = 1 AND id != ?', [matriculaFinal, id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (matriculaExistente) {
                return res.status(400).json({ error: 'Esta matrícula já está em uso' });
            }
        }

        // Executar a atualização do usuário
        const result = await new Promise((resolve, reject) => {
            db.run(
                `UPDATE usuarios 
                 SET nome = ?, email = ?, matricula = ?, tipo = ?, curso = ?, periodo = ?
                 WHERE id = ?`,
                [nome, email, matriculaFinal, tipo, curso, periodo, id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // 🔥 SINCRONIZAÇÃO COM TABELA PROFESSORES
        if (tipo === 'professor' && usuarioAtual && usuarioAtual.tipo !== 'professor') {
            console.log('🔄 Tipo alterado para professor, criando registro...');
            try {
                await atualizarProfessorFromUsuario(id, { nome, email });
                console.log('✅ Professor adicionado automaticamente');
            } catch (error) {
                console.error('⚠️ Aviso: Usuário atualizado, mas erro ao criar professor:', error);
            }
        }
        
        if (usuarioAtual && usuarioAtual.tipo === 'professor' && tipo !== 'professor') {
            console.log('🔄 Tipo alterado de professor para', tipo, ', desativando professor...');
            try {
                await desativarProfessorFromUsuario(id, { 
                    nome: nome, 
                    email: email 
                });
                console.log('✅ Professor desativado automaticamente');
            } catch (error) {
                console.error('⚠️ Aviso: Usuário atualizado, mas erro ao desativar professor:', error);
            }
        }

        console.log('✅ Usuário atualizado com sucesso');
        res.json({ 
            success: true, 
            message: 'Usuário atualizado com sucesso!' 
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar usuário:', error);
        
        if (error.message.includes('UNIQUE constraint failed')) {
            if (error.message.includes('email')) {
                return res.status(400).json({ error: 'Este email já está em uso' });
            } else if (error.message.includes('matricula')) {
                // 🔥 CORREÇÃO: Se ainda houver conflito de matrícula, gerar uma única
                console.log('🔄 Conflito de matrícula, gerando matrícula única...');
                return res.status(400).json({ 
                    error: 'Conflito de matrícula. Tente novamente ou deixe o campo em branco para gerar automaticamente.' 
                });
            }
        }
        
        return res.status(400).json({ error: error.message });
    }
});

// Alterar tipo de usuário (apenas admin)
// Alterar tipo de usuário (apenas admin)
router.put('/:id/tipo', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;

    console.log('🔄 Alterando tipo do usuário:', { id, tipo });

    if (!['aluno', 'professor', 'admin'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de usuário inválido' });
    }

    try {
        // Buscar dados do usuário
        const usuario = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // 🔥 CORREÇÃO: Gerar matrícula temporária para professores/admins
        let matriculaFinal = usuario.matricula;
        let cursoFinal = usuario.curso;
        let periodoFinal = usuario.periodo;

        if (tipo === 'professor' || tipo === 'admin') {
            matriculaFinal = `PROF-${Date.now()}-${id}`;
            cursoFinal = null;
            periodoFinal = null;
            console.log(`🔧 Gerando matrícula temporária: ${matriculaFinal}`);
        }

        // Preparar dados para atualização
        let updateQuery = 'UPDATE usuarios SET tipo = ?, matricula = ?, curso = ?, periodo = ?';
        let params = [tipo, matriculaFinal, cursoFinal, periodoFinal];

        updateQuery += ' WHERE id = ?';
        params.push(id);

        // Executar atualização
        const result = await new Promise((resolve, reject) => {
            db.run(updateQuery, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // 🔥 SINCRONIZAÇÃO COM TABELA PROFESSORES
        if (tipo === 'professor' && usuario.tipo !== 'professor') {
            console.log('🔄 Tipo alterado para professor, criando registro...');
            try {
                await atualizarProfessorFromUsuario(id, { 
                    nome: usuario.nome, 
                    email: usuario.email 
                });
                console.log('✅ Professor adicionado automaticamente');
            } catch (error) {
                console.error('⚠️ Aviso: Tipo alterado, mas erro ao criar professor:', error);
            }
        }
        
        if (usuario.tipo === 'professor' && tipo !== 'professor') {
            console.log('🔄 Tipo alterado de professor para', tipo, ', desativando professor...');
            try {
                await desativarProfessorFromUsuario(id, { 
                    nome: usuario.nome, 
                    email: usuario.email 
                });
                console.log('✅ Professor desativado automaticamente');
            } catch (error) {
                console.error('⚠️ Aviso: Tipo alterado, mas erro ao desativar professor:', error);
            }
        }

        console.log('✅ Tipo de usuário alterado com sucesso');
        res.json({ 
            success: true, 
            message: `Usuário atualizado para ${tipo} com sucesso!` 
        });

    } catch (error) {
        console.error('❌ Erro ao alterar tipo de usuário:', error);
        
        if (error.message.includes('UNIQUE constraint failed')) {
            if (error.message.includes('matricula')) {
                // 🔥 CORREÇÃO: Tentar novamente com matrícula diferente
                console.log('🔄 Conflito de matrícula, tentando novamente...');
                // Chamar a função recursivamente após um delay
                setTimeout(() => {
                    this.alteraTipoUsuario(id, tipo, res);
                }, 100);
                return;
            }
        }
        
        return res.status(400).json({ error: error.message });
    }
});

// Excluir usuário (soft delete - apenas admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    console.log('🗑️ Excluindo usuário ID:', id);

    try {
        // Verificar se o usuário existe
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            console.log('❌ Usuário não encontrado:', id);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Verificar se é o próprio admin tentando se excluir
        if (user.id === req.user.id) {
            console.log('❌ Admin tentando se excluir:', user.email);
            return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
        }

        console.log(`📋 Usuário a ser excluído:`, { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo });

        // 🔥 NOVA FUNCIONALIDADE: Se o usuário é professor, excluir também o registro na tabela professores
        let professorExcluido = false;
        let aulasRemovidas = 0;
        let favoritosRemovidos = 0;

        if (user.tipo === 'professor') {
            console.log('👨‍🏫 Usuário é professor, excluindo registro correspondente...');
            
            // Buscar o professor pelo email
            const professor = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM professores WHERE email = ?', [user.email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (professor) {
                console.log(`📊 Professor encontrado para exclusão: ID ${professor.id}`);
                
                // 1. Verificar e contar dependências
                const aulasCount = await new Promise((resolve, reject) => {
                    db.get('SELECT COUNT(*) as count FROM aulas WHERE professor_id = ?', [professor.id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row.count);
                    });
                });

                const favoritosCount = await new Promise((resolve, reject) => {
                    db.get('SELECT COUNT(*) as count FROM professores_favoritos WHERE professor_id = ?', [professor.id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row.count);
                    });
                });

                aulasRemovidas = aulasCount;
                favoritosRemovidos = favoritosCount;

                console.log(`📊 Dependências do professor: ${aulasCount} aulas, ${favoritosCount} favoritos`);

                // 2. Excluir dependências
                if (aulasCount > 0) {
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM aulas WHERE professor_id = ?', [professor.id], function(err) {
                            if (err) reject(err);
                            else {
                                console.log(`✅ ${this.changes} aulas excluídas`);
                                resolve();
                            }
                        });
                    });
                }

                if (favoritosCount > 0) {
                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM professores_favoritos WHERE professor_id = ?', [professor.id], function(err) {
                            if (err) reject(err);
                            else {
                                console.log(`✅ ${this.changes} favoritos excluídos`);
                                resolve();
                            }
                        });
                    });
                }

                // 3. Excluir o professor
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM professores WHERE id = ?', [professor.id], function(err) {
                        if (err) reject(err);
                        else {
                            console.log(`✅ Professor ${professor.id} excluído permanentemente`);
                            professorExcluido = true;
                            resolve();
                        }
                    });
                });
            } else {
                console.log('ℹ️ Nenhum professor encontrado com o email:', user.email);
            }
        }

        // Desativar usuário (soft delete)
        const result = await new Promise((resolve, reject) => {
            db.run(
                'UPDATE usuarios SET ativo = 0 WHERE id = ?',
                [id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log('✅ Usuário excluído com sucesso:', user.email);

        // Mensagem de retorno baseada no tipo de usuário
        let message = 'Usuário excluído com sucesso!';
        
        if (user.tipo === 'professor' && professorExcluido) {
            message += ' Professor removido permanentemente do sistema.';
            if (aulasRemovidas > 0 || favoritosRemovidos > 0) {
                message += ` Foram removidos: ${aulasRemovidas} aula(s) e ${favoritosRemovidos} favorito(s).`;
            }
        }

        res.json({ 
            success: true, 
            message: message,
            professor_excluido: professorExcluido,
            aulas_removidas: aulasRemovidas,
            favoritos_removidos: favoritosRemovidos
        });

    } catch (error) {
        console.error('❌ Erro ao excluir usuário:', error);
        
        if (error.message.includes('404') || error.message.includes('Cannot DELETE')) {
            return res.status(404).json({ error: 'Função de exclusão não disponível no momento. Contate o administrador do sistema.' });
        }
        
        return res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
    }
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