require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar configurações
const db = require('./config/database');
const { initializeDatabase } = require('./utils/databaseInit');

// Importar rotas
const authRoutes = require('./routes/auth');
const usuarioRoutes = require('./routes/usuarios');
const cursoRoutes = require('./routes/cursos');
const disciplinaRoutes = require('./routes/disciplinas');
const salaRoutes = require('./routes/salas');
const professorRoutes = require('./routes/professores');
const aulaRoutes = require('./routes/aulas');
const turmaRoutes = require('./routes/turmas');
const alunoRoutes = require('./routes/aluno');
const dashboardRoutes = require('./routes/dashboard');
const debugRoutes = require('./routes/debug');
const adminSalasRoutes = require('./routes/admin-salas');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar banco de dados
initializeDatabase();

// Usar rotas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/disciplinas', disciplinaRoutes);
app.use('/api/salas', salaRoutes);
app.use('/api/professores', professorRoutes);
app.use('/api/aulas', aulaRoutes);
app.use('/api/turmas', turmaRoutes);
app.use('/api/aluno', alunoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/admin/salas', adminSalasRoutes);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Servir recursos específicos
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));
app.use('/Unimap/frontend/images', express.static(path.join(__dirname, '../frontend/images')));

// Rotas para páginas principais
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/cadastro.html'));
});

app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/professor-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/professor-dashboard.html'));
});

// Rotas para arquivos específicos
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/cadastro.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/cadastro.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/professor-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/professor-dashboard.html'));
});

// Rota de status
app.get('/api/status', (req, res) => {
    res.json({
        status: '✅ Online',
        porta: PORT,
        ambiente: process.env.NODE_ENV || 'desenvolvimento',
        timestamp: new Date().toISOString()
    });
});

// Rota 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Iniciar servidor apenas quando executado diretamente.
// Quando importado (pelos testes), apenas exporta o app.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 UNIMAP rodando na porta ${PORT}`);
        console.log(`🌎 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📈 Health: ${process.env.APP_URL || `http://localhost:${PORT}`}/api/health`);
    });
}

module.exports = app;