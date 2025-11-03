const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireProfessor } = require('../middleware/auth');
const router = express.Router();

// 🔧 UTILITÁRIOS OTIMIZADOS
const diasMap = {
    'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5
};

const parseDiasSemana = (diaSemana) => {
    if (Array.isArray(diaSemana)) return diaSemana;
    if (typeof diaSemana === 'string') return diaSemana.split(',').map(dia => dia.trim());
    return [diaSemana];
};

const converterDiaParaNumero = (dia) => {
    const diasMap = {
        'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5,
        '1': 1, '2': 2, '3': 3, '4': 4, '5': 5
    };
    return diasMap[dia] || 1;
};

// 🔧 PROMISIFY DATABASE OPERATIONS
const dbRun = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// 🔧 MIDDLEWARE DE VALIDAÇÃO
const validateAulaData = (req, res, next) => {
    const { disciplina, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana } = req.body;

    const missingFields = [];
    if (!disciplina) missingFields.push('disciplina');
    if (!sala_id) missingFields.push('sala_id');
    if (!curso) missingFields.push('curso');
    if (!turma) missingFields.push('turma');
    if (!horario_inicio) missingFields.push('horario_inicio');
    if (!horario_fim) missingFields.push('horario_fim');
    if (!dia_semana) missingFields.push('dia_semana');

    if (missingFields.length > 0) {
        return res.status(400).json({
            error: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
        });
    }

    next();
};


// 🔧 VERIFICAÇÃO DE DUPLICAÇÃO OTIMIZADA

const verificarDuplicacaoAulaPorDia = async (professorId, aulaData, diaNumero) => {
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

    const existing = await dbGet(query, [
        professorId, aulaData.disciplina, aulaData.sala_id, aulaData.curso,
        aulaData.turma, aulaData.horario_inicio, aulaData.horario_fim, diaNumero
    ]);

    return !!existing;
};

const verificarDuplicacaoAula = async (professorId, aulaData, dia) => {
    const diaSemanaNumero = converterDiaParaNumero(dia);

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

    const existing = await dbGet(query, [
        professorId, aulaData.disciplina, aulaData.sala_id, aulaData.curso,
        aulaData.turma, aulaData.horario_inicio, aulaData.horario_fim, diaSemanaNumero
    ]);

    return !!existing;
};

// 🔧 CRIAÇÃO DE AULA OTIMIZADA
const criarAulaParaDia = async (professorId, aulaData, dia) => {
    const diaSemanaNumero = converterDiaParaNumero(dia);

    const result = await dbRun(
        `INSERT INTO aulas (disciplina, professor_id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [aulaData.disciplina, professorId, aulaData.sala_id, aulaData.curso,
        aulaData.turma, aulaData.horario_inicio, aulaData.horario_fim, diaSemanaNumero]
    );

    return { dia, status: 'criada', id: result.lastID };
};

// 🚀 ROTAS OTIMIZADAS

// Criar aula (apenas professores) - VERSÃO SIMPLIFICADA
router.post('/', authenticateToken, requireProfessor, validateAulaData, async (req, res) => {
    const aulaData = req.body;
    console.log('📝 Criando aulas para dias:', aulaData.dia_semana);

    try {
        // Buscar professor
        const professor = await dbGet('SELECT id FROM professores WHERE email = ?', [req.user.email]);
        if (!professor) {
            return res.status(404).json({ error: 'Professor não encontrado' });
        }

        const diasArray = Array.isArray(aulaData.dia_semana) ?
            aulaData.dia_semana :
            aulaData.dia_semana.split(',');

        console.log('📅 Dias a processar:', diasArray);

        const aulasCriadas = [];
        const aulasDuplicadas = [];

        // Mapeamento de dias para números
        const diasParaNumeros = {
            'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5
        };

        for (const dia of diasArray) {
            try {
                // Converter dia para número
                const diaNumero = diasParaNumeros[dia] || 1;

                // Verificar duplicação
                const duplicata = await dbGet(
                    `SELECT id FROM aulas 
                     WHERE professor_id = ? AND disciplina = ? AND sala_id = ? 
                     AND curso = ? AND turma = ? AND horario_inicio = ? 
                     AND horario_fim = ? AND dia_semana = ? AND ativa = 1`,
                    [
                        professor.id, aulaData.disciplina, aulaData.sala_id,
                        aulaData.curso, aulaData.turma, aulaData.horario_inicio,
                        aulaData.horario_fim, diaNumero
                    ]
                );

                if (duplicata) {
                    aulasDuplicadas.push({ dia });
                    console.log(`⚠️ Aula duplicada para ${dia}`);
                    continue;
                }

                // Criar aula
                const result = await dbRun(
                    `INSERT INTO aulas (disciplina, professor_id, sala_id, curso, turma, 
                     horario_inicio, horario_fim, dia_semana, ativa) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        aulaData.disciplina, professor.id, aulaData.sala_id,
                        aulaData.curso, aulaData.turma, aulaData.horario_inicio,
                        aulaData.horario_fim, diaNumero
                    ]
                );

                // Buscar aula criada
                const aulaCriada = await dbGet(`
                    SELECT a.*, s.numero as sala_numero, s.bloco as sala_bloco
                    FROM aulas a LEFT JOIN salas s ON a.sala_id = s.id 
                    WHERE a.id = ?
                `, [result.lastID]);

                aulasCriadas.push(aulaCriada);
                console.log(`✅ Aula criada para ${dia} - ID: ${result.lastID}`);

            } catch (error) {
                console.error(`❌ Erro em ${dia}:`, error);
                // Continuar com os próximos dias mesmo com erro em um
            }
        }

        // Retornar resultado
        if (aulasCriadas.length === 0) {
            return res.status(400).json({
                success: false,
                error: aulasDuplicadas.length > 0 ?
                    'Todas as aulas já existem para os dias selecionados' :
                    'Erro ao criar aulas'
            });
        }

        const mensagem = `${aulasCriadas.length} aula(s) criada(s) com sucesso` +
            (aulasDuplicadas.length > 0 ? ` (${aulasDuplicadas.length} já existiam)` : '');

        res.json({
            success: true,
            message: mensagem,
            aulasCriadas,
            aulasDuplicadas
        });

    } catch (error) {
        console.error('❌ Erro ao criar aulas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Atualizar aula
router.put('/:id', authenticateToken, requireProfessor, validateAulaData, async (req, res) => {
    const { id } = req.params;
    const aulaData = req.body;

    console.log('✏️ Atualizando aula:', id, aulaData);

    try {
        const result = await dbRun(
            `UPDATE aulas SET 
                disciplina = ?, sala_id = ?, curso = ?, turma = ?, 
                horario_inicio = ?, horario_fim = ?, dia_semana = ?
             WHERE id = ?`,
            [aulaData.disciplina, aulaData.sala_id, aulaData.curso, aulaData.turma,
            aulaData.horario_inicio, aulaData.horario_fim, aulaData.dia_semana, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Aula não encontrada' });
        }

        console.log('✅ Aula atualizada com sucesso');
        res.json({
            success: true,
            message: 'Aula atualizada com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar aula:', error);
        res.status(400).json({ error: error.message });
    }
});

// 🔧 OPERAÇÕES COMUNS DE AULA
const executarOperacaoAula = async (req, res, operacao, mensagemSucesso) => {
    const { id } = req.params;

    console.log(`🔄 ${mensagemSucesso} aula:`, id);

    try {
        const result = await dbRun(
            'UPDATE aulas SET ativa = ? WHERE id = ?',
            [operacao, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Aula não encontrada' });
        }

        console.log(`✅ ${mensagemSucesso} com sucesso`);
        res.json({
            success: true,
            message: `${mensagemSucesso} com sucesso!`
        });

    } catch (error) {
        console.error(`❌ Erro ao ${mensagemSucesso.toLowerCase()} aula:`, error);
        res.status(400).json({ error: error.message });
    }
};

// Cancelar aula
router.put('/:id/cancelar', authenticateToken, requireProfessor, (req, res) => {
    executarOperacaoAula(req, res, 0, 'Aula cancelada');
});

// Reativar aula
router.put('/:id/reativar', authenticateToken, requireProfessor, (req, res) => {
    executarOperacaoAula(req, res, 1, 'Aula reativada');
});

// 🔧 CONSULTAS OTIMIZADAS

// Query base para aulas
const getAulasBaseQuery = (filtroProfessor = false) => `
    SELECT 
        a.*, 
        s.numero as sala_numero, 
        s.bloco as sala_bloco,
        s.andar as sala_andar,
        p.nome as professor_nome
    FROM aulas a
    LEFT JOIN salas s ON a.sala_id = s.id
    LEFT JOIN professores p ON a.professor_id = p.id
    ${filtroProfessor ? 'WHERE p.email = ?' : ''}
    ORDER BY a.ativa DESC, a.dia_semana, a.horario_inicio
`;

// Obter aulas do usuário
router.get('/usuario/:usuario_id', authenticateToken, async (req, res) => {
    const { usuario_id } = req.params;
    console.log('📚 Buscando aulas para usuário:', usuario_id);

    try {
        const user = await dbGet('SELECT * FROM usuarios WHERE id = ?', [usuario_id]);
        if (!user) {
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

        const rows = await dbAll(query, params);
        console.log(`✅ ${rows.length} aulas encontradas para o usuário`);
        res.json(rows);

    } catch (error) {
        console.error('❌ Erro ao buscar aulas do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// Aulas do professor (incluindo canceladas)
router.get('/professor/minhas-aulas', authenticateToken, requireProfessor, async (req, res) => {
    console.log('📚 Buscando aulas do professor:', req.user.email);

    try {
        const query = getAulasBaseQuery(true);
        const rows = await dbAll(query, [req.user.email]);

        console.log(`✅ ${rows.length} aulas encontradas para o professor ${req.user.email}`);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('❌ Erro ao buscar aulas do professor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Aulas do aluno
router.get('/aluno/:aluno_id', authenticateToken, async (req, res) => {
    const { aluno_id } = req.params;
    console.log('🎓 Buscando aulas para aluno:', aluno_id);

    try {
        const aluno = await dbGet('SELECT curso, periodo FROM usuarios WHERE id = ?', [aluno_id]);
        if (!aluno) {
            return res.status(404).json({ error: 'Aluno não encontrada' });
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

        const rows = await dbAll(query, [cursoFiltro, turmaFiltro]);
        console.log(`✅ ${rows.length} aulas encontradas após filtro`);
        res.json(rows);

    } catch (error) {
        console.error('❌ Erro ao buscar aulas do aluno:', error);
        res.status(500).json({ error: error.message });
    }
});

// Excluir aula
router.delete('/:id', authenticateToken, requireProfessor, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await dbRun('DELETE FROM aulas WHERE id = ?', [id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Aula não encontrada' });
        }

        res.json({
            success: true,
            message: 'Aula excluída com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro ao excluir aula:', error);
        res.status(400).json({ error: error.message });
    }
});

// Todas as aulas (apenas admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    console.log('📚 Buscando todas as aulas...');

    try {
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

        const rows = await dbAll(query, []);
        console.log(`✅ ${rows.length} aulas encontradas`);
        res.json(rows);

    } catch (error) {
        console.error('❌ Erro ao buscar aulas:', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔧 ROTA DE HEALTH CHECK
router.get('/health', async (req, res) => {
    try {
        const aulaCount = await dbGet('SELECT COUNT(*) as count FROM aulas', []);
        res.json({
            status: 'healthy',
            aulaCount: aulaCount.count,
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