const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Estatísticas gerais do dashboard
router.get('/estatisticas', authenticateToken, (req, res) => {
    const queries = [
        'SELECT COUNT(*) as total FROM usuarios WHERE ativo = 1',
        'SELECT COUNT(*) as total FROM professores WHERE ativo = 1',
        'SELECT COUNT(*) as total FROM salas WHERE ativa = 1',
        'SELECT COUNT(*) as total FROM aulas WHERE ativa = 1'
    ];

    db.serialize(() => {
        const results = {};
        let completed = 0;

        queries.forEach((query, index) => {
            db.get(query, [], (err, row) => {
                if (err) {
                    console.error('❌ Erro na query:', query, err);
                    results[['total_usuarios', 'total_professores', 'total_salas', 'total_aulas'][index]] = 0;
                } else {
                    results[['total_usuarios', 'total_professores', 'total_salas', 'total_aulas'][index]] = row.total;
                }
                completed++;

                if (completed === queries.length) {
                    res.json(results);
                }
            });
        });
    });
});

// Estatísticas para admin
router.get('/admin/estatisticas', authenticateToken, (req, res) => {
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }

    const queries = [
        // Total de usuários por tipo
        `SELECT tipo, COUNT(*) as total 
         FROM usuarios 
         WHERE ativo = 1 
         GROUP BY tipo`,

        // Total de salas por bloco
        `SELECT bloco, COUNT(*) as total 
         FROM salas 
         WHERE ativa = 1 
         GROUP BY bloco`,

        // Total de aulas por dia da semana
        `SELECT dia_semana, COUNT(*) as total 
         FROM aulas 
         WHERE ativa = 1 
         GROUP BY dia_semana`,

        // Últimos usuários cadastrados
        `SELECT nome, email, tipo, data_cadastro 
         FROM usuarios 
         WHERE ativo = 1 
         ORDER BY data_cadastro DESC 
         LIMIT 5`,

        // Próximas aulas
        `SELECT a.*, p.nome as professor_nome, s.numero as sala_numero
         FROM aulas a
         LEFT JOIN professores p ON a.professor_id = p.id
         LEFT JOIN salas s ON a.sala_id = s.id
         WHERE a.ativa = 1
         ORDER BY a.dia_semana, a.horario_inicio
         LIMIT 10`
    ];

    db.serialize(() => {
        const results = {};
        let completed = 0;

        // Usuários por tipo
        db.all(queries[0], [], (err, rows) => {
            if (err) console.error(err);
            results.usuarios_por_tipo = rows || [];
            completed++;
            checkComplete();
        });

        // Salas por bloco
        db.all(queries[1], [], (err, rows) => {
            if (err) console.error(err);
            results.salas_por_bloco = rows || [];
            completed++;
            checkComplete();
        });

        // Aulas por dia
        db.all(queries[2], [], (err, rows) => {
            if (err) console.error(err);
            results.aulas_por_dia = rows || [];
            completed++;
            checkComplete();
        });

        // Últimos usuários
        db.all(queries[3], [], (err, rows) => {
            if (err) console.error(err);
            results.ultimos_usuarios = rows || [];
            completed++;
            checkComplete();
        });

        // Próximas aulas
        db.all(queries[4], [], (err, rows) => {
            if (err) console.error(err);
            results.proximas_aulas = rows || [];
            completed++;
            checkComplete();
        });

        function checkComplete() {
            if (completed === queries.length) {
                console.log('✅ Estatísticas do admin carregadas');
                res.json(results);
            }
        }
    });
});

// Estatísticas para professor
router.get('/professor/estatisticas', authenticateToken, (req, res) => {
    if (req.user.tipo !== 'professor') {
        return res.status(403).json({ error: 'Acesso restrito a professores' });
    }

    const queries = [
        // Total de aulas do professor
        `SELECT COUNT(*) as total_aulas 
         FROM aulas a
         JOIN professores p ON a.professor_id = p.id
         WHERE p.email = ? AND a.ativa = 1`,

        // Aulas por dia da semana
        `SELECT dia_semana, COUNT(*) as total 
         FROM aulas a
         JOIN professores p ON a.professor_id = p.id
         WHERE p.email = ? AND a.ativa = 1
         GROUP BY dia_semana`,

        // Próximas aulas
        `SELECT a.*, s.numero as sala_numero, s.bloco as sala_bloco
         FROM aulas a
         JOIN professores p ON a.professor_id = p.id
         LEFT JOIN salas s ON a.sala_id = s.id
         WHERE p.email = ? AND a.ativa = 1
         ORDER BY a.dia_semana, a.horario_inicio
         LIMIT 5`,

        // Disciplinas lecionadas
        `SELECT DISTINCT d.nome as disciplina
         FROM aulas a
         JOIN professores p ON a.professor_id = p.id
         LEFT JOIN disciplinas d ON a.disciplina_id = d.id
         WHERE p.email = ? AND a.ativa = 1`
    ];

    db.serialize(() => {
        const results = {};
        let completed = 0;

        // Total de aulas
        db.get(queries[0], [req.user.email], (err, row) => {
            if (err) console.error(err);
            results.total_aulas = row ? row.total_aulas : 0;
            completed++;
            checkComplete();
        });

        // Aulas por dia
        db.all(queries[1], [req.user.email], (err, rows) => {
            if (err) console.error(err);
            results.aulas_por_dia = rows || [];
            completed++;
            checkComplete();
        });

        // Próximas aulas
        db.all(queries[2], [req.user.email], (err, rows) => {
            if (err) console.error(err);
            results.proximas_aulas = rows || [];
            completed++;
            checkComplete();
        });

        // Disciplinas
        db.all(queries[3], [req.user.email], (err, rows) => {
            if (err) console.error(err);
            results.disciplinas = rows.map(r => r.disciplina).filter(Boolean);
            completed++;
            checkComplete();
        });

        function checkComplete() {
            if (completed === queries.length) {
                console.log('✅ Estatísticas do professor carregadas');
                res.json(results);
            }
        }
    });
});

// Estatísticas para aluno
router.get('/aluno/estatisticas', authenticateToken, (req, res) => {
    if (req.user.tipo !== 'aluno') {
        return res.status(403).json({ error: 'Acesso restrito a alunos' });
    }

    const queries = [
        // Total de aulas do aluno
        `SELECT COUNT(*) as total_aulas 
         FROM aulas a
         WHERE a.ativa = 1 
         AND (a.curso = ? OR a.curso IS NULL OR a.curso = '')
         AND (a.turma LIKE '%' || ? || '%' OR a.turma IS NULL OR a.turma = '')`,

        // Aulas por dia da semana
        `SELECT dia_semana, COUNT(*) as total 
         FROM aulas a
         WHERE a.ativa = 1 
         AND (a.curso = ? OR a.curso IS NULL OR a.curso = '')
         AND (a.turma LIKE '%' || ? || '%' OR a.turma IS NULL OR a.turma = '')
         GROUP BY dia_semana`,

        // Próximas aulas
        `SELECT a.*, p.nome as professor_nome, s.numero as sala_numero
         FROM aulas a
         LEFT JOIN professores p ON a.professor_id = p.id
         LEFT JOIN salas s ON a.sala_id = s.id
         WHERE a.ativa = 1 
         AND (a.curso = ? OR a.curso IS NULL OR a.curso = '')
         AND (a.turma LIKE '%' || ? || '%' OR a.turma IS NULL OR a.turma = '')
         ORDER BY a.dia_semana, a.horario_inicio
         LIMIT 5`,

        // Professores favoritos
        `SELECT COUNT(*) as total_favoritos 
         FROM professores_favoritos 
         WHERE aluno_id = ?`
    ];

    // Buscar dados do aluno primeiro
    db.get('SELECT curso, periodo FROM usuarios WHERE id = ?', [req.user.id], (err, aluno) => {
        if (err || !aluno) {
            return res.status(500).json({ error: 'Erro ao buscar dados do aluno' });
        }

        const cursoFiltro = aluno.curso || '';
        const turmaFiltro = aluno.periodo ? `T${aluno.periodo}` : '';

        db.serialize(() => {
            const results = {};
            let completed = 0;

            // Total de aulas
            db.get(queries[0], [cursoFiltro, turmaFiltro], (err, row) => {
                if (err) console.error(err);
                results.total_aulas = row ? row.total_aulas : 0;
                completed++;
                checkComplete();
            });

            // Aulas por dia
            db.all(queries[1], [cursoFiltro, turmaFiltro], (err, rows) => {
                if (err) console.error(err);
                results.aulas_por_dia = rows || [];
                completed++;
                checkComplete();
            });

            // Próximas aulas
            db.all(queries[2], [cursoFiltro, turmaFiltro], (err, rows) => {
                if (err) console.error(err);
                results.proximas_aulas = rows || [];
                completed++;
                checkComplete();
            });

            // Favoritos
            db.get(queries[3], [req.user.id], (err, row) => {
                if (err) console.error(err);
                results.total_favoritos = row ? row.total_favoritos : 0;
                completed++;
                checkComplete();
            });

            function checkComplete() {
                if (completed === queries.length) {
                    console.log('✅ Estatísticas do aluno carregadas');
                    res.json(results);
                }
            }
        });
    });
});

module.exports = router;