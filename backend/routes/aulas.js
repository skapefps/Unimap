const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireProfessor } = require('../middleware/auth');
const router = express.Router();

// Criar aula (apenas professores)
router.post('/', authenticateToken, requireProfessor, (req, res) => {
    const { disciplina, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana } = req.body;
    
    console.log('📝 Tentativa de criar aula:', { disciplina, curso, turma });

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

        // Inserir a aula
        db.run(
            `INSERT INTO aulas (disciplina, professor_id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [disciplina, professor.id, sala_id, curso, turma, horario_inicio, horario_fim, dia_semana],
            function(err) {
                if (err) {
                    console.error('❌ Erro ao criar aula:', err);
                    return res.status(400).json({ error: err.message });
                }
                
                console.log('✅ Aula criada com ID:', this.lastID);
                res.json({ 
                    success: true, 
                    message: 'Aula criada com sucesso!', 
                    id: this.lastID 
                });
            }
        );
    });
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

// Obter minhas aulas (para professor)
router.get('/professor/minhas-aulas', authenticateToken, requireProfessor, (req, res) => {
    console.log('📚 Buscando aulas do professor:', req.user.email);
    
    const query = `
        SELECT 
            a.*, 
            d.nome as disciplina_nome,
            s.numero as sala_numero, 
            s.bloco as sala_bloco,
            s.andar as sala_andar
        FROM aulas a
        LEFT JOIN disciplinas d ON a.disciplina_id = d.id
        LEFT JOIN salas s ON a.sala_id = s.id
        LEFT JOIN professores p ON a.professor_id = p.id
        WHERE p.email = ? AND a.ativa = 1
        ORDER BY a.dia_semana, a.horario_inicio
    `;
    
    db.all(query, [req.user.email], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar aulas do professor:', err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ ${rows.length} aulas encontradas para o professor ${req.user.email}`);
        res.json(rows);
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

    db.run('DELETE FROM aulas WHERE id = ?', [id], function(err) {
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