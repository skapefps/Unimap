const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireProfessor } = require('../middleware/auth');
const router = express.Router();

// Criar aula (apenas professores)
// Criar aula (apenas professores) - VERSÃO CORRIGIDA
// Rota para criar aula (COM VERIFICAÇÃO DE DUPLICAÇÃO)
router.post('/', authenticateToken, requireProfessor, (req, res) => {
    const { disciplina, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana } = req.body;

    console.log('📝 Tentativa de criar aula:', {
        disciplina,
        curso,
        turma,
        sala_id,
        horario_inicio,
        horario_fim,
        dia_semana
    });

    // 🔥 CORREÇÃO: Processar múltiplos dias
    const diasArray = typeof dia_semana === 'string' ?
        dia_semana.split(',').map(dia => dia.trim()) :
        (Array.isArray(dia_semana) ? dia_semana : [dia_semana]);

    console.log('📅 Dias processados:', diasArray);

    // Buscar professor_id baseado no email do usuário logado
    db.get('SELECT id FROM professores WHERE email = ?', [req.user.email], (err, professor) => {
        if (err) {
            console.error('❌ Erro ao buscar professor:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }

        if (!professor) {
            console.error('❌ Professor não encontrado para email:', req.user.email);
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        // 🔥 CORREÇÃO: Verificar duplicações antes de criar
        const verificarDuplicacao = (dia, callback) => {
            const diaParaNumero = {
                'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5
            };

            const diaSemanaNumero = diaParaNumero[dia] || dia;

            const query = `
                SELECT id FROM aulas 
                WHERE professor_id = ? 
                AND disciplina = ? 
                AND sala_id = ? 
                AND curso = ? 
                AND turma = ? 
                AND horario_inicio = ? 
                AND horario_fim = ? 
                AND dia_semana = ?
                AND ativa = 1
            `;

            db.get(query, [
                professor.id, disciplina, sala_id, curso, turma,
                horario_inicio, horario_fim, diaSemanaNumero
            ], (err, row) => {
                if (err) {
                    return callback(err);
                }
                callback(null, !!row);
            });
        };

        // 🔥 CORREÇÃO: Criar aulas apenas se não existirem duplicatas
        const promises = diasArray.map(dia => {
            return new Promise((resolve, reject) => {
                verificarDuplicacao(dia, (err, existeDuplicata) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (existeDuplicata) {
                        console.log(`⚠️ Aula duplicada encontrada para ${dia}, ignorando...`);
                        resolve({ dia, status: 'duplicada', mensagem: 'Aula já existe' });
                        return;
                    }

                    // Converter dia string para número se necessário
                    const diaParaNumero = {
                        'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5
                    };

                    const diaSemanaNumero = diaParaNumero[dia] || dia;

                    // Criar a aula
                    db.run(
                        `INSERT INTO aulas (disciplina, professor_id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [disciplina, professor.id, sala_id, curso, turma, horario_inicio, horario_fim, diaSemanaNumero],
                        function (err) {
                            if (err) {
                                console.error(`❌ Erro ao criar aula para ${dia}:`, err);
                                reject(err);
                            } else {
                                console.log(`✅ Aula criada para ${dia} com ID:`, this.lastID);
                                resolve({ dia, status: 'criada', id: this.lastID });
                            }
                        }
                    );
                });
            });
        });

        // 🔥 CORREÇÃO: Processar resultados
        Promise.all(promises.map(p => p.catch(e => e)))
            .then(results => {
                const aulasCriadas = results.filter(r => r.status === 'criada');
                const aulasDuplicadas = results.filter(r => r.status === 'duplicada');
                const erros = results.filter(r => r instanceof Error);

                console.log(`📊 Resultado: ${aulasCriadas.length} criadas, ${aulasDuplicadas.length} duplicadas, ${erros.length} erros`);

                if (aulasCriadas.length === 0 && aulasDuplicadas.length > 0) {
                    res.status(400).json({
                        success: false,
                        error: 'Todas as aulas já existem para os dias selecionados'
                    });
                } else if (erros.length > 0) {
                    res.status(400).json({
                        success: false,
                        error: 'Erro ao criar algumas aulas: ' + erros[0].message
                    });
                } else {
                    let mensagem = `${aulasCriadas.length} aula(s) criada(s) com sucesso`;
                    if (aulasDuplicadas.length > 0) {
                        mensagem += ` (${aulasDuplicadas.length} aula(s) já existiam)`;
                    }

                    res.json({
                        success: true,
                        message: mensagem,
                        aulasCriadas: aulasCriadas,
                        aulasDuplicadas: aulasDuplicadas
                    });
                }
            })
            .catch(error => {
                console.error('❌ Erro ao criar uma ou mais aulas:', error);
                res.status(400).json({ error: error.message });
            });
    });
});


router.put('/:id', authenticateToken, requireProfessor, (req, res) => {
    const { id } = req.params;
    const { disciplina, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana } = req.body;

    console.log('✏️ Atualizando aula:', id, req.body);

    db.run(
        `UPDATE aulas SET 
            disciplina = ?, sala_id = ?, curso = ?, turma = ?, 
            horario_inicio = ?, horario_fim = ?, dia_semana = ?
         WHERE id = ?`,
        [disciplina, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana, id],
        function (err) {
            if (err) {
                console.error('❌ Erro ao atualizar aula:', err);
                return res.status(400).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Aula não encontrada' });
            }

            console.log('✅ Aula atualizada com sucesso');
            res.json({
                success: true,
                message: 'Aula atualizada com sucesso!'
            });
        }
    );
});

router.put('/:id/cancelar', authenticateToken, requireProfessor, (req, res) => {
    const { id } = req.params;

    console.log('🚫 Cancelando aula:', id);

    db.run(
        'UPDATE aulas SET ativa = ? WHERE id = ?',
        [0, id], // Usar 0 para inativo (cancelada)
        function (err) {
            if (err) {
                console.error('❌ Erro ao cancelar aula:', err);
                return res.status(400).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Aula não encontrada' });
            }

            console.log('✅ Aula cancelada com sucesso');
            res.json({
                success: true,
                message: 'Aula cancelada com sucesso!'
            });
        }
    );
});

// Rota para reativar aula - VERSÃO CORRIGIDA
router.put('/:id/reativar', authenticateToken, requireProfessor, (req, res) => {
    const { id } = req.params;

    console.log('🔄 Reativando aula:', id);

    db.run(
        'UPDATE aulas SET ativa = ? WHERE id = ?',
        [1, id], // Usar 1 para ativa
        function (err) {
            if (err) {
                console.error('❌ Erro ao reativar aula:', err);
                return res.status(400).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Aula não encontrada' });
            }

            console.log('✅ Aula reativada com sucesso');
            res.json({
                success: true,
                message: 'Aula reativada com sucesso!'
            });
        }
    );
});

// Obter aulas do usuário logado
router.get('/usuario/:usuario_id', authenticateToken, (req, res) => {
    const { usuario_id } = req.params;

    console.log('📚 Buscando aulas para usuário:', usuario_id);

    // Buscar informações do usuário
    db.get('SELECT * FROM usuarios WHERE id = ?', [usuario_id], (err, user) => {
        if (err || !user) {
            console.error('❌ Usuário não encontrado:', usuario_id);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log('👤 Usuário encontrado:', user.nome, '- Tipo:', user.tipo);

        let query, params;

        if (user.tipo === 'professor') {
            query = `
                SELECT 
                    a.*, 
                    d.nome as disciplina_nome,
                    s.numero as sala_numero, 
                    s.bloco as sala_bloco,
                    s.andar as sala_andar,
                    p.nome as professor_nome
                FROM aulas a
                LEFT JOIN disciplinas d ON a.disciplina_id = d.id
                LEFT JOIN salas s ON a.sala_id = s.id
                LEFT JOIN professores p ON a.professor_id = p.id
                WHERE p.email = ? AND a.ativa = 1
                ORDER BY a.dia_semana, a.horario_inicio
            `;
            params = [user.email];
        } else {
            query = `
                SELECT a.*, p.nome as professor_nome, s.numero as sala_numero, s.bloco as sala_bloco,
                       d.nome as disciplina_nome
                FROM aulas a
                LEFT JOIN professores p ON a.professor_id = p.id
                LEFT JOIN salas s ON a.sala_id = s.id
                LEFT JOIN disciplinas d ON a.disciplina_id = d.id
                WHERE a.ativa = 1
                ORDER BY a.dia_semana, a.horario_inicio
            `;
            params = [];
        }

        console.log('📊 Executando query:', query);
        console.log('📋 Parâmetros:', params);

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar aulas do usuário:', err);
                return res.status(500).json({ error: err.message });
            }

            console.log(`✅ ${rows.length} aulas encontradas para o usuário`);
            res.json(rows);
        });
    });
});

// Rota para buscar aulas do professor - VERIFIQUE ESTA ROTA
router.get('/professor/minhas-aulas', authenticateToken, requireProfessor, (req, res) => {
    console.log('📚 Buscando aulas do professor (incluindo canceladas):', req.user.email);

    const query = `
        SELECT 
            a.*, 
            s.numero as sala_numero, 
            s.bloco as sala_bloco,
            s.andar as sala_andar
        FROM aulas a
        LEFT JOIN salas s ON a.sala_id = s.id
        LEFT JOIN professores p ON a.professor_id = p.id
        WHERE p.email = ?
        ORDER BY a.ativa DESC, a.dia_semana, a.horario_inicio
    `;

    db.all(query, [req.user.email], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar aulas do professor:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ ${rows.length} aulas encontradas para o professor ${req.user.email}`);

        // 🔥 GARANTIR que estamos retornando { success: true, data: array }
        res.json({
            success: true,
            data: rows  // Isso deve ser um array
        });
    });
});

// Obter aulas de um aluno específico
router.get('/aluno/:aluno_id', authenticateToken, (req, res) => {
    const { aluno_id } = req.params;

    console.log('🎓 Buscando aulas para aluno:', aluno_id);

    // Buscar informações do aluno
    db.get('SELECT curso, periodo FROM usuarios WHERE id = ?', [aluno_id], (err, aluno) => {
        if (err || !aluno) {
            console.error('❌ Aluno não encontrado:', aluno_id);
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }

        console.log('👤 Dados do aluno para filtro:', aluno);

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
            AND (a.curso = ? OR a.curso IS NULL OR a.curso = '')
            AND (a.turma LIKE '%' || ? || '%' OR a.turma IS NULL OR a.turma = '')
            ORDER BY a.dia_semana, a.horario_inicio
        `;

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

// Excluir aula (apenas professores)
router.delete('/:id', authenticateToken, requireProfessor, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM aulas WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('❌ Erro ao excluir aula:', err);
            return res.status(400).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Aula não encontrada' });
        }

        res.json({
            success: true,
            message: 'Aula excluída com sucesso!'
        });
    });
});

// Obter todas as aulas (apenas admin)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
    console.log('📚 Buscando todas as aulas...');

    const query = `
        SELECT 
            a.*, 
            p.nome as professor_nome,
            d.nome as disciplina_nome,
            s.numero as sala_numero,
            s.bloco as sala_bloco
        FROM aulas a
        LEFT JOIN professores p ON a.professor_id = p.id
        LEFT JOIN disciplinas d ON a.disciplina_id = d.id
        LEFT JOIN salas s ON a.sala_id = s.id
        WHERE a.ativa = 1
        ORDER BY a.dia_semana, a.horario_inicio
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar aulas:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log(`✅ ${rows.length} aulas encontradas`);
        res.json(rows);
    });
});

module.exports = router;