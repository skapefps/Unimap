const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin, authenticateProfessor } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const router = express.Router();


const { validarId } = require('../middleware/validarId');
const { validate, schemas } = require('../middleware/validate');

// Qualquer rota com :id recebe 400 para id nao numerico, em vez de
// 500 por erro de tipo do Postgres.
router.param('id', validarId);

// 🔧 UTILITÁRIOS OTIMIZADOS
const promisifyDb = {
    run: (sql, params) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            err ? reject(err) : resolve(this);
        });
    }),
    get: (sql, params) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            err ? reject(err) : resolve(row);
        });
    }),
    all: (sql, params) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            err ? reject(err) : resolve(rows);
        });
    })
};

// 🔧 MIDDLEWARE DE VALIDAÇÃO
const validateProfessorData = (req, res, next) => {
    const { nome, email } = req.body;

    if (!nome?.trim()) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    if (!email?.trim()) {
        return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    next();
};

// 🔧 OPERAÇÕES DE USUÁRIO
const syncUserWithProfessor = async (professorData, operation = 'create') => {
    const { nome, email, id } = professorData;

    try {
        // Buscar usuário existente
        const usuarioExistente = await promisifyDb.get(
            'SELECT id, tipo FROM usuarios WHERE email = ? AND ativo = 1',
            [email]
        );

        if (usuarioExistente) {
            // Atualizar usuário existente
            await promisifyDb.run(
                'UPDATE usuarios SET nome = ?, tipo = ? WHERE id = ?',
                [nome, 'professor', usuarioExistente.id]
            );
            return {
                usuarioId: usuarioExistente.id,
                action: 'updated',
                previousType: usuarioExistente.tipo
            };
        } else {
            // Criar novo usuário
            const senhaPadrao = 'prof123';
            const senhaHash = await bcrypt.hash(senhaPadrao, 10);

            const result = await promisifyDb.run(
                `INSERT INTO usuarios (nome, email, senha_hash, tipo) 
                 VALUES (?, ?, ?, 'professor')`,
                [nome, email, senhaHash]
            );

            return {
                usuarioId: result.lastID,
                action: 'created',
                previousType: null
            };
        }
    } catch (error) {
        console.error('❌ Erro na sincronização de usuário:', error);
        throw error;
    }
};

const updateUserForProfessorStatus = async (professorEmail, shouldBeProfessor) => {
    try {
        const usuario = await promisifyDb.get(
            'SELECT id, tipo FROM usuarios WHERE email = ? AND ativo = 1',
            [professorEmail]
        );

        if (!usuario) {
            console.log(`❌ Nenhum usuário encontrado para: ${professorEmail}`);
            return null;
        }

        const targetType = shouldBeProfessor ? 'professor' : 'aluno';

        if (usuario.tipo !== targetType) {
            await promisifyDb.run(
                `UPDATE usuarios SET tipo = ?, matricula = NULL, periodo = NULL, curso = NULL 
                 WHERE id = ?`,
                [targetType, usuario.id]
            );
            console.log(`✅ Usuário ${usuario.id} alterado para: ${targetType}`);
            return { changed: true, from: usuario.tipo, to: targetType };
        }

        console.log(`ℹ️ Usuário já é ${usuario.tipo}, mantendo tipo`);
        return { changed: false, currentType: usuario.tipo };
    } catch (error) {
        console.error('❌ Erro ao atualizar usuário:', error);
        throw error;
    }
};

// 🔧 OPERAÇÕES DE DEPENDÊNCIAS
const checkAndCleanDependencies = async (professorId) => {
    const dependencies = {
        aulas: 0,
        favoritos: 0
    };

    try {
        // Verificar e contar dependências
        const [aulasCount, favoritosCount] = await Promise.all([
            promisifyDb.get('SELECT COUNT(*) as count FROM aulas WHERE professor_id = ?', [professorId]),
            promisifyDb.get('SELECT COUNT(*) as count FROM professores_favoritos WHERE professor_id = ?', [professorId])
        ]);

        dependencies.aulas = aulasCount?.count || 0;
        dependencies.favoritos = favoritosCount?.count || 0;

        console.log(`📊 Dependências encontradas: ${dependencies.aulas} aulas, ${dependencies.favoritos} favoritos`);

        // Limpar dependências se existirem
        if (dependencies.aulas > 0) {
            await promisifyDb.run('DELETE FROM aulas WHERE professor_id = ?', [professorId]);
            console.log(`✅ ${dependencies.aulas} aulas excluídas`);
        }

        if (dependencies.favoritos > 0) {
            await promisifyDb.run('DELETE FROM professores_favoritos WHERE professor_id = ?', [professorId]);
            console.log(`✅ ${dependencies.favoritos} favoritos excluídos`);
        }

        return dependencies;
    } catch (error) {
        console.error('❌ Erro ao verificar dependências:', error);
        throw error;
    }
};

// 🚀 ROTAS OTIMIZADAS

// Listar todos os professores
router.get('/', authenticateToken, async (req, res) => {
    console.log('📚 Buscando lista de professores...');

    try {
        const rows = await promisifyDb.all(
            'SELECT * FROM professores ORDER BY ativo DESC, nome',
            []
        );

        console.log(`✅ ${rows.length} professores encontrados`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar professores:', error);
        res.status(500).json({ error: error.message });
    }
});

// Listar apenas professores ativos
router.get('/ativos', authenticateToken, async (req, res) => {
    console.log('📚 Buscando lista de professores ativos...');

    try {
        const rows = await promisifyDb.all(
            'SELECT * FROM professores WHERE ativo = 1 ORDER BY nome',
            []
        );

        console.log(`✅ ${rows.length} professores ativos encontrados`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar professores ativos:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Perfil do professor que está logado.
 *
 * O frontend (`js/professor.js`) já chamava esta rota, que não existia —
 * respondia 404 e o painel do professor não carregava. Devolve o
 * registro de `professores` ligado à conta, mais os dados da conta.
 */
router.get('/meu-perfil', authenticateProfessor, (req, res) => {
    const { id, nome, email, ativo } = req.professor;

    res.json({
        id,
        nome,
        email,
        ativo,
        usuario_id: req.user.id,
        tipo: 'professor'
    });
});

/**
 * Aulas do professor logado, sem precisar que o frontend saiba o id do
 * vínculo acadêmico.
 */
router.get('/minhas-aulas', authenticateProfessor, (req, res) => {
    db.all(
        `SELECT a.*, s.numero AS sala_numero, s.bloco AS sala_bloco
           FROM aulas a
           LEFT JOIN salas s ON a.sala_id = s.id
          WHERE a.professor_id = ? AND a.ativa = 1
          ORDER BY a.data_aula DESC, a.horario_inicio`,
        [req.professor.id],
        (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar aulas do professor:', err.message);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }
            res.json(rows || []);
        }
    );
});

// Adicionar professor aos favoritos
router.post('/favoritos', authenticateToken, async (req, res) => {
    const { aluno_id, professor_id } = req.body;

    try {
        await promisifyDb.run(
            'INSERT OR IGNORE INTO professores_favoritos (aluno_id, professor_id) VALUES (?, ?)',
            [aluno_id, professor_id]
        );

        res.json({
            success: true,
            message: 'Professor adicionado aos favoritos!'
        });
    } catch (error) {
        console.error('❌ Erro ao adicionar favorito:', error);
        res.status(400).json({ error: error.message });
    }
});

// Obter professores favoritos de um aluno
router.get('/favoritos/:aluno_id', authenticateToken, async (req, res) => {
    const { aluno_id } = req.params;

    try {
        const rows = await promisifyDb.all(
            `SELECT p.* FROM professores p 
             JOIN professores_favoritos pf ON p.id = pf.professor_id 
             WHERE pf.aluno_id = ? AND p.ativo = 1`,
            [aluno_id]
        );

        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar professores favoritos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remover professor dos favoritos
router.delete('/favoritos/:aluno_id/:professor_id', authenticateToken, async (req, res) => {
    const { aluno_id, professor_id } = req.params;

    try {
        const result = await promisifyDb.run(
            'DELETE FROM professores_favoritos WHERE aluno_id = ? AND professor_id = ?',
            [aluno_id, professor_id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Favorito não encontrado' });
        }

        res.json({
            success: true,
            message: 'Professor removido dos favoritos!'
        });
    } catch (error) {
        console.error('❌ Erro ao remover favorito:', error);
        res.status(400).json({ error: error.message });
    }
});

// Criar professor (apenas admin)
router.post('/', authenticateToken, requireAdmin, validate(schemas.professor), validateProfessorData, async (req, res) => {
    const { nome, email } = req.body;

    try {
        // Verificar se professor já existe
        const professorExistente = await promisifyDb.get(
            'SELECT id FROM professores WHERE email = ?',
            [email]
        );

        let professorId;
        let usuarioSync;

        if (professorExistente) {
            // Atualizar professor existente
            await promisifyDb.run(
                'UPDATE professores SET nome = ?, ativo = 1 WHERE id = ?',
                [nome, professorExistente.id]
            );
            professorId = professorExistente.id;
            console.log('✅ Professor existente atualizado');
        } else {
            // Criar novo professor
            const result = await promisifyDb.run(
                'INSERT INTO professores (nome, email) VALUES (?, ?)',
                [nome, email]
            );
            professorId = result.lastID;
            console.log('✅ Novo professor criado com ID:', professorId);
        }

        // Sincronizar com usuário
        usuarioSync = await syncUserWithProfessor({ nome, email, id: professorId });

        res.json({
            success: true,
            message: 'Professor cadastrado com sucesso!' +
                (usuarioSync.action === 'updated' ?
                    ' Usuário existente atualizado para professor.' :
                    ' Novo usuário criado automaticamente.'),
            id: professorId,
            usuario_id: usuarioSync.usuarioId
        });

    } catch (error) {
        console.error('❌ Erro ao adicionar professor:', error);

        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Este email já está cadastrado' });
        }

        res.status(400).json({ error: error.message });
    }
});

// Atualizar professor (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, validate(schemas.professor), validateProfessorData, async (req, res) => {
    const { id } = req.params;
    const { nome, email } = req.body;

    try {
        // Buscar dados atuais do professor
        const professorAtual = await promisifyDb.get(
            'SELECT email FROM professores WHERE id = ?',
            [id]
        );

        if (!professorAtual) {
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        // Verificar se o novo email já está em uso por outro professor
        if (professorAtual.email !== email) {
            const emailEmUso = await promisifyDb.get(
                'SELECT id FROM professores WHERE email = ? AND id != ?',
                [email, id]
            );

            if (emailEmUso) {
                return res.status(400).json({ error: 'Este email já está em uso por outro professor' });
            }
        }

        // Atualizar usuário correspondente se necessário
        if (professorAtual.email !== email || nome) {
            const usuarioExistente = await promisifyDb.get(
                'SELECT id FROM usuarios WHERE email = ? AND ativo = 1',
                [professorAtual.email]
            );

            if (usuarioExistente) {
                await promisifyDb.run(
                    'UPDATE usuarios SET nome = ?, email = ? WHERE id = ?',
                    [nome, email, usuarioExistente.id]
                );
                console.log('✅ Usuário atualizado');
            }
        }

        // Atualizar professor
        await promisifyDb.run(
            'UPDATE professores SET nome = ?, email = ? WHERE id = ?',
            [nome, email, id]
        );

        console.log('✅ Professor e usuário atualizados com sucesso');
        res.json({
            success: true,
            message: 'Professor atualizado com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro ao editar professor:', error);
        res.status(400).json({ error: error.message });
    }
});

// Alterar status do professor (apenas admin)
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;

    console.log(`🔄 Alterando status do professor ${id} para:`, ativo);

    try {
        // Buscar professor
        const professor = await promisifyDb.get(
            'SELECT id, nome, email, ativo FROM professores WHERE id = ?',
            [id]
        );

        if (!professor) {
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        const ativoNumero = ativo ? 1 : 0;

        // Atualizar status do professor
        await promisifyDb.run(
            'UPDATE professores SET ativo = ? WHERE id = ?',
            [ativoNumero, id]
        );

        // Sincronizar usuário correspondente
        const userUpdate = await updateUserForProfessorStatus(professor.email, ativo);

        // Buscar dados atualizados
        const professorAtualizado = await promisifyDb.get(
            'SELECT * FROM professores WHERE id = ?',
            [id]
        );

        console.log(`✅ Status alterado: Professor ${id} -> ${ativoNumero ? 'Ativo' : 'Inativo'}`);

        res.json({
            success: true,
            message: `Professor ${ativoNumero ? 'ativado' : 'desativado'} com sucesso!`,
            data: professorAtualizado,
            userUpdated: userUpdate
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar status do professor:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Excluir professor permanentemente (apenas admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;

    console.log(`🗑️ Excluindo professor ID: ${id}`);

    try {
        // Verificar se o professor existe
        const professor = await promisifyDb.get(
            'SELECT * FROM professores WHERE id = ?',
            [id]
        );

        if (!professor) {
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        // Limpar dependências
        const dependencies = await checkAndCleanDependencies(id);

        // Atualizar usuário correspondente para aluno
        const userUpdate = await updateUserForProfessorStatus(professor.email, false);

        // Excluir professor
        const result = await promisifyDb.run(
            'DELETE FROM professores WHERE id = ?',
            [id]
        );

        console.log(`✅ Professor ${id} excluído permanentemente`);

        res.json({
            success: true,
            message: 'Professor excluído permanentemente com sucesso!' +
                (userUpdate?.changed ? ' O usuário correspondente foi alterado para aluno.' : ''),
            aulas_removidas: dependencies.aulas,
            favoritos_removidos: dependencies.favoritos,
            usuario_alterado: userUpdate?.changed || false
        });

    } catch (error) {
        console.error('❌ Erro ao excluir professor:', error);
        res.status(500).json({
            error: 'Erro interno do servidor ao excluir professor',
            details: error.message
        });
    }
});

// 🔧 ROTAS DE ESTATÍSTICAS E RELATÓRIOS

// Obter contagem de favoritos de um professor
router.get('/:id/favoritos-count', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;

    console.log('⭐ Buscando favoritos do professor:', id);

    try {
        const result = await promisifyDb.get(
            `SELECT COUNT(*) as count FROM professores_favoritos pf
             JOIN usuarios u ON pf.aluno_id = u.id
             WHERE pf.professor_id = ? AND u.ativo = 1`,
            [id]
        );

        res.json({
            count: result?.count || 0
        });
    } catch (error) {
        console.error('❌ Erro ao contar favoritos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Lista detalhada de favoritos
router.get('/:id/favoritos', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;

    console.log('⭐ Buscando favoritos detalhados para professor:', id);

    try {
        const rows = await promisifyDb.all(
            `SELECT 
                u.id as aluno_id,
                u.nome as aluno_nome,
                u.email as aluno_email,
                u.curso as aluno_curso,
                u.periodo as aluno_periodo
             FROM professores_favoritos pf
             JOIN usuarios u ON pf.aluno_id = u.id
             WHERE pf.professor_id = ? AND u.ativo = 1
             ORDER BY u.nome`,
            [id]
        );

        console.log(`✅ ${rows.length} favoritos encontrados para professor ${id}`);

        res.json({
            count: rows.length,
            alunos: rows
        });
    } catch (error) {
        console.error('❌ Erro ao buscar favoritos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter estatísticas de professores (apenas admin)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    console.log('📊 Buscando estatísticas de professores...');

    try {
        const [total, comFavoritos, topProfessores] = await Promise.all([
            promisifyDb.get('SELECT COUNT(*) as total FROM professores WHERE ativo = 1'),
            promisifyDb.get(`SELECT COUNT(DISTINCT pf.professor_id) as total_com_favoritos 
                           FROM professores_favoritos pf 
                           JOIN professores p ON pf.professor_id = p.id 
                           WHERE p.ativo = 1`),
            promisifyDb.all(`SELECT p.id, p.nome, COUNT(pf.id) as total_favoritos
                           FROM professores p
                           LEFT JOIN professores_favoritos pf ON p.id = pf.professor_id
                           WHERE p.ativo = 1
                           GROUP BY p.id
                           ORDER BY total_favoritos DESC
                           LIMIT 5`)
        ]);

        const results = {
            total_professores: total?.total || 0,
            professores_com_favoritos: comFavoritos?.total_com_favoritos || 0,
            top_professores: topProfessores || []
        };

        console.log('✅ Estatísticas carregadas:', results);
        res.json(results);

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obter aulas de um professor específico
router.get('/:id/aulas', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const rows = await promisifyDb.all(
            `SELECT 
                a.*, 
                d.nome as disciplina_nome,
                s.numero as sala_numero, 
                s.bloco as sala_bloco
             FROM aulas a
             LEFT JOIN disciplinas d ON a.disciplina_id = d.id
             LEFT JOIN salas s ON a.sala_id = s.id
             WHERE a.professor_id = ? AND a.ativa = 1
             ORDER BY a.dia_semana, a.horario_inicio`,
            [id]
        );

        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar aulas do professor:', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔧 ROTA DE HEALTH CHECK
router.get('/health', async (req, res) => {
    try {
        const [profCount, activeCount] = await Promise.all([
            promisifyDb.get('SELECT COUNT(*) as count FROM professores'),
            promisifyDb.get('SELECT COUNT(*) as count FROM professores WHERE ativo = 1')
        ]);

        res.json({
            status: 'healthy',
            totalProfessores: profCount.count,
            professoresAtivos: activeCount.count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;