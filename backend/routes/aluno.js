const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAluno } = require('../middleware/auth');
const router = express.Router();

// Atualizar dados do aluno (curso, período)
router.put('/atualizar-dados', authenticateToken, requireAluno, (req, res) => {
    const { curso, periodo } = req.body;
    
    console.log('✏️ Aluno atualizando próprios dados:', { 
        aluno_id: req.user.id, 
        curso, 
        periodo 
    });

    db.run(
        `UPDATE usuarios 
         SET curso = ?, periodo = ?
         WHERE id = ?`,
        [curso, periodo, req.user.id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar dados do aluno:', err);
                return res.status(400).json({ error: err.message });
            }
            
            console.log('✅ Dados do aluno atualizados com sucesso');
            res.json({ 
                success: true, 
                message: 'Dados atualizados com sucesso!' 
            });
        }
    );
});

// Selecionar turma (período)
router.post('/selecionar-turma', authenticateToken, requireAluno, (req, res) => {
    const { turma_id } = req.body;
    
    console.log('🎓 Aluno selecionando turma:', { 
        aluno_id: req.user.id, 
        turma_id 
    });

    if (!turma_id) {
        return res.status(400).json({ error: 'Turma ID é obrigatório' });
    }

    // Verificar se a turma existe
    db.get('SELECT * FROM turmas WHERE id = ? AND ativa = 1', [turma_id], (err, turma) => {
        if (err) {
            console.error('❌ Erro ao verificar turma:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        if (!turma) {
            return res.status(404).json({ error: 'Turma não encontrada' });
        }

        // Vincular aluno à turma
        db.run(
            'INSERT OR REPLACE INTO aluno_turmas (aluno_id, turma_id, status) VALUES (?, ?, "cursando")',
            [req.user.id, turma_id],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao vincular aluno à turma:', err);
                    return res.status(400).json({ error: err.message });
                }
                
                console.log('✅ Aluno vinculado à turma com sucesso');
                res.json({ 
                    success: true, 
                    message: 'Turma selecionada com sucesso!' 
                });
            }
        );
    });
});

// Completar cadastro do aluno (curso, período, turma)
router.post('/completar-cadastro', authenticateToken, requireAluno, (req, res) => {
    const { curso_id, periodo, turma_id } = req.body;
    const aluno_id = req.user.id;
    
    console.log('🎯 Completando cadastro do aluno:', { aluno_id, curso_id, periodo, turma_id });
    console.log('🔐 Usuário autenticado:', req.user);
    
    if (!curso_id || !periodo || !turma_id) {
        return res.status(400).json({ 
            success: false,
            error: 'Curso, período e turma são obrigatórios' 
        });
    }

    // Buscar nome do curso
    db.get('SELECT nome FROM cursos WHERE id = ?', [curso_id], (err, curso) => {
        if (err || !curso) {
            console.error('❌ Erro ao buscar curso:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Curso não encontrado' 
            });
        }

        const nomeCurso = curso.nome;
        console.log('📚 Curso encontrado:', nomeCurso);

        // Iniciar transação
        db.serialize(() => {
            // 1. Atualizar dados do usuário
            db.run(
                `UPDATE usuarios SET curso = ?, periodo = ? WHERE id = ?`,
                [nomeCurso, periodo, aluno_id],
                function(err) {
                    if (err) {
                        console.error('❌ Erro ao atualizar dados do aluno:', err);
                        return res.status(500).json({ 
                            success: false,
                            error: 'Erro ao atualizar dados' 
                        });
                    }
                    
                    console.log('✅ Dados do aluno atualizados');
                    
                    // 2. Vincular à turma
                    db.run(
                        `INSERT OR REPLACE INTO aluno_turmas (aluno_id, turma_id, status) 
                         VALUES (?, ?, 'cursando')`,
                        [aluno_id, turma_id],
                        function(err) {
                            if (err) {
                                console.error('❌ Erro ao vincular aluno à turma:', err);
                                return res.status(500).json({ 
                                    success: false,
                                    error: 'Erro ao vincular à turma' 
                                });
                            }
                            
                            console.log('✅ Aluno vinculado à turma com sucesso');
                            
                            // 3. Buscar dados atualizados
                            db.get(
                                `SELECT id, nome, email, matricula, tipo, curso, periodo 
                                 FROM usuarios WHERE id = ?`,
                                [aluno_id],
                                (err, user) => {
                                    if (err) {
                                        console.error('❌ Erro ao buscar usuário atualizado:', err);
                                        return res.status(500).json({ 
                                            success: false,
                                            error: 'Erro ao buscar dados atualizados' 
                                        });
                                    }
                                    
                                    console.log('✅ Cadastro completado com sucesso para:', user.nome);
                                    
                                    res.json({ 
                                        success: true, 
                                        message: 'Cadastro completado com sucesso!',
                                        user: user
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// Verificar dados completos do aluno
router.get('/dados-completos/:id', authenticateToken, (req, res) => {
    const alunoId = req.params.id;
    
    console.log('🔍 Verificando dados completos do aluno:', alunoId);
    console.log('👤 Usuário autenticado:', req.user.id, req.user.nome);
    
    // Verificar se o usuário tem permissão para ver esses dados
    if (req.user.id != alunoId && req.user.tipo !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'Sem permissão para acessar esses dados' 
        });
    }
    
    const query = `
        SELECT 
            u.id, u.nome, u.email, u.tipo, u.curso, u.periodo,
            at.turma_id,
            t.nome as turma_nome
        FROM usuarios u
        LEFT JOIN aluno_turmas at ON u.id = at.aluno_id AND at.status = 'cursando'
        LEFT JOIN turmas t ON at.turma_id = t.id
        WHERE u.id = ? AND u.ativo = 1
    `;
    
    db.get(query, [alunoId], (err, aluno) => {
        if (err) {
            console.error('❌ Erro ao buscar dados do aluno:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Erro interno do servidor' 
            });
        }
        
        if (!aluno) {
            console.log('❌ Aluno não encontrado:', alunoId);
            return res.json({ 
                success: false, 
                error: 'Aluno não encontrado' 
            });
        }
        
        // VERIFICAÇÃO CORRETA: verificar se todos os campos estão preenchidos
        const temCurso = aluno.curso && aluno.curso.trim() !== '';
        const temPeriodo = aluno.periodo !== null && aluno.periodo !== undefined;
        const temTurma = aluno.turma_id !== null && aluno.turma_id !== undefined;
        
        const cadastroCompleto = temCurso && temPeriodo && temTurma;
        
        console.log('📊 Dados do aluno:', {
            id: aluno.id,
            nome: aluno.nome,
            curso: aluno.curso,
            periodo: aluno.periodo,
            turma_id: aluno.turma_id,
            temCurso: temCurso,
            temPeriodo: temPeriodo,
            temTurma: temTurma,
            cadastroCompleto: cadastroCompleto
        });
        
        res.json({
            success: true,
            data: {
                id: aluno.id,
                nome: aluno.nome,
                email: aluno.email,
                tipo: aluno.tipo,
                curso: aluno.curso,
                periodo: aluno.periodo,
                turma_id: aluno.turma_id,
                turma: aluno.turma_nome
            },
            cadastro_completo: cadastroCompleto,
            precisa_completar: !cadastroCompleto
        });
    });
});

// Obter turmas do aluno
router.get('/:id/turmas', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    console.log('🎓 Buscando turmas do aluno:', id);
    
    const query = `
        SELECT t.*, at.data_matricula, at.status
        FROM turmas t
        JOIN aluno_turmas at ON t.id = at.turma_id
        WHERE at.aluno_id = ? AND t.ativa = 1 AND at.status = 'cursando'
        ORDER BY t.ano DESC, t.periodo
    `;
    
    db.all(query, [id], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar turmas do aluno:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ ${rows.length} turmas encontradas para o aluno`);
        res.json(rows);
    });
});

// Obter aulas do aluno (com matching automático)
router.get('/:id/aulas', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    console.log('🎓 Buscando aulas para aluno:', id);
    
    // Buscar informações do aluno
    db.get('SELECT curso, periodo FROM usuarios WHERE id = ?', [id], (err, aluno) => {
        if (err || !aluno) {
            console.error('❌ Aluno não encontrado:', id);
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }
        
        console.log('👤 Dados do aluno para filtro:', aluno);
        
        // 🔥 FILTRO MELHORADO - Aulas que batem com curso E turma do aluno
        const query = `
            SELECT 
                a.*, 
                p.nome as professor_nome, 
                s.numero as sala_numero, 
                s.bloco as sala_bloco,
                s.andar as sala_andar,
                d.nome as disciplina_nome
            FROM aulas a
            LEFT JOIN professores p ON a.professor_id = p.id
            LEFT JOIN salas s ON a.sala_id = s.id
            LEFT JOIN disciplinas d ON a.disciplina_id = d.id
            WHERE a.ativa = 1 
            AND (a.curso = ? OR a.curso IS NULL OR a.curso = '') -- 🔥 Filtro por curso
            AND (a.turma LIKE '%' || ? || '%' OR a.turma IS NULL OR a.turma = '') -- 🔥 Filtro por turma
            ORDER BY a.dia_semana, a.horario_inicio
        `;
        
        // Se o aluno não tem curso definido, mostrar todas as aulas
        const cursoFiltro = aluno.curso || '';
        const turmaFiltro = aluno.periodo ? `T${aluno.periodo}` : '';
        
        console.log('🔍 Aplicando filtros:', { curso: cursoFiltro, turma: turmaFiltro });
        
        db.all(query, [cursoFiltro, turmaFiltro], (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar aulas do aluno:', err);
                return res.status(500).json({ error: err.message });
            }
            
            console.log(`✅ ${rows.length} aulas encontradas após filtro`);
            res.json(rows);
        });
    });
});

module.exports = router;