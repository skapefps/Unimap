// Rota para adicionar/editar professor (apenas admin)
app.post('/api/professores', authenticateToken, requireAdmin, (req, res) => {
    const { nome, email } = req.body;
    
    if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }

    db.run(
        'INSERT INTO professores (nome, email) VALUES (?, ?)',
        [nome, email],
        function(err) {
            if (err) {
                console.error('❌ Erro ao adicionar professor:', err);
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Este email já está cadastrado' });
                }
                return res.status(400).json({ error: err.message });
            }
            res.json({ 
                success: true, 
                message: 'Professor cadastrado com sucesso!', 
                id: this.lastID 
            });
        }
    );
});

// Rota para editar professor
app.put('/api/professores/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { nome, email } = req.body;

    db.run(
        'UPDATE professores SET nome = ?, email = ? WHERE id = ?',
        [nome, email, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao editar professor:', err);
                return res.status(400).json({ error: err.message });
            }
            res.json({ success: true, message: 'Professor atualizado com sucesso!' });
        }
    );
});

// Rota para alterar status do professor
app.put('/api/professores/:id/status', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;

    db.run(
        'UPDATE professores SET ativo = ? WHERE id = ?',
        [ativo, id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar professor:', err);
                return res.status(400).json({ error: err.message });
            }
            res.json({ success: true, message: 'Status atualizado com sucesso!' });
        }
    );
});