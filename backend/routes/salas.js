const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Listar todas as salas
router.get('/', authenticateToken, (req, res) => {
    console.log('🏫 Buscando salas...');
    
    db.all('SELECT * FROM salas ORDER BY bloco, andar, numero', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar salas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Criar nova sala (apenas admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
    const { numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus } = req.body;
    
    console.log('🏫 Criando nova sala:', { numero, bloco, andar });
    
    db.run(
        `INSERT INTO salas 
         (numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus, ativa) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [numero, bloco, andar, tipo, capacidade, recursos || '', telefone || '', email || '', campus || ''],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            console.log('✅ Sala criada com ID:', this.lastID);
            res.json({ 
                success: true, 
                message: 'Sala criada com sucesso!', 
                id: this.lastID 
            });
        }
    );
});

// Obter estatísticas dos blocos
router.get('/blocos', authenticateToken, (req, res) => {
    const query = `
        SELECT 
            bloco as letra,
            COUNT(*) as total_salas,
            COUNT(DISTINCT andar) as total_andares
        FROM salas 
        WHERE ativa = 1
        GROUP BY bloco 
        ORDER BY bloco
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar blocos:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Obter andares de um bloco
router.get('/bloco/:bloco/andares', authenticateToken, (req, res) => {
    const { bloco } = req.params;
    
    const query = `
        SELECT DISTINCT andar 
        FROM salas 
        WHERE bloco = ? AND ativa = 1
        ORDER BY andar
    `;
    
    db.all(query, [bloco], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar andares:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Converter números para nomes de andares
        const andaresFormatados = rows.map(row => {
            switch(row.andar) {
                case 0: return 'Térreo';
                case 1: return '1º Andar';
                case 2: return '2º Andar';
                case 3: return '3º Andar';
                default: return `${row.andar}º Andar`;
            }
        });
        
        res.json(andaresFormatados);
    });
});

// Obter salas de um andar específico
router.get('/bloco/:bloco/andar/:andar', authenticateToken, (req, res) => {
    const { bloco, andar } = req.params;
    
    // Converter nome do andar para número
    let andarNumero;
    switch(andar) {
        case 'Térreo': andarNumero = 0; break;
        case '1º Andar': andarNumero = 1; break;
        case '2º Andar': andarNumero = 2; break;
        case '3º Andar': andarNumero = 3; break;
        default: andarNumero = parseInt(andar);
    }
    
    const query = `
        SELECT 
            id, numero, bloco, andar, tipo, capacidade, recursos,
            telefone, email, campus, ativa
        FROM salas 
        WHERE bloco = ? AND andar = ? AND ativa = 1
        ORDER BY numero
    `;
    
    db.all(query, [bloco, andarNumero], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar salas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Obter salas de um bloco específico
router.get('/bloco/:bloco', authenticateToken, (req, res) => {
    const { bloco } = req.params;
    
    db.all(
        'SELECT * FROM salas WHERE bloco = ? AND ativa = 1 ORDER BY andar, numero',
        [bloco],
        (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar salas do bloco:', bloco, err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Atualizar sala (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus } = req.body;
    
    db.run(
        `UPDATE salas SET 
            numero = ?, bloco = ?, andar = ?, tipo = ?, capacidade = ?, 
            recursos = ?, telefone = ?, email = ?, campus = ?
         WHERE id = ?`,
        [numero, bloco, andar, tipo, capacidade, recursos || '', telefone || '', email || '', campus || '', id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Sala não encontrada' });
            }
            
            res.json({ success: true, message: 'Sala atualizada com sucesso!' });
        }
    );
});

// Excluir sala (apenas admin - soft delete)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run(
        'UPDATE salas SET ativa = 0 WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao desativar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Sala não encontrada' });
            }
            
            res.json({ success: true, message: 'Sala desativada com sucesso!' });
        }
    );
});

// Obter sala por ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM salas WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('❌ Erro ao buscar sala:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Sala não encontrada' });
        }
        
        res.json(row);
    });
});

module.exports = router;