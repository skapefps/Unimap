const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Dados de usuários em memória (para teste)
const users = [
    {
        id: 1,
        nome: 'Kaique Lucas',
        email: 'kaique@unipam.edu.br',
        tipo: 'aluno',
        curso: 'Sistemas de Informação'
    }
];

// Login simulado
app.post('/api/auth/login', (req, res) => {
    const { email, senha } = req.body;
    
    // Qualquer email/senha funciona no teste
    const user = users.find(u => u.email === email) || users[0];
    
    res.json({
        success: true,
        message: 'Login realizado com sucesso!',
        user: user
    });
});

// Cadastro simulado
app.post('/api/auth/register', (req, res) => {
    const { nome, email } = req.body;
    
    const newUser = {
        id: users.length + 1,
        nome: nome,
        email: email,
        tipo: 'aluno',
        curso: 'Sistemas de Informação'
    };
    
    users.push(newUser);
    
    res.json({
        success: true,
        message: 'Usuário criado com sucesso!'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor SIMPLES rodando: http://localhost:${PORT}`);
});