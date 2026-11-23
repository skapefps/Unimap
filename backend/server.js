require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

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

const { apiLimiter } = require('./middleware/limiters');

const app = express();
const PORT = process.env.PORT || 3000;
const EM_PRODUCAO = process.env.NODE_ENV === 'production';

// Rotas de debug só fora de produção. São 12 endpoints que expõem
// estrutura e conteúdo do banco.
const debugHabilitado = !EM_PRODUCAO;

// ---------------------------------------------------------------------
// Confiança no proxy
//
// Precisa vir antes dos rate limiters. O Render fica na frente da
// aplicação, então sem isto req.ip é o IP do proxy para todo mundo — o
// primeiro visitante a estourar o limite de login bloquearia os
// demais. Com 1, o Express lê o primeiro endereço de
// X-Forwarded-For, que é o cliente real.
// ---------------------------------------------------------------------
app.set('trust proxy', 1);

// Não anunciar o framework
app.disable('x-powered-by');

// ---------------------------------------------------------------------
// Logs de requisição
// ---------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
    app.use(pinoHttp({
        level: process.env.LOG_LEVEL || (EM_PRODUCAO ? 'info' : 'debug'),
        // Nunca registrar credenciais nem token.
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.senha',
                'req.body.novaSenha',
                'req.body.senha_hash',
                'req.body.token'
            ],
            censor: '[omitido]'
        },
        // Estáticos e healthcheck não precisam de uma linha cada.
        autoLogging: {
            ignore: (req) =>
                req.url === '/api/health'
                || /\.(css|js|png|jpe?g|svg|ico|woff2?|ttf)$/.test(req.url)
        }
    }));
}

// ---------------------------------------------------------------------
// Cabeçalhos de segurança
// ---------------------------------------------------------------------
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // O login usa Google Identity Services, que carrega script e
            // iframe de domínios do Google.
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://accounts.google.com',
                'https://apis.google.com',
                'https://www.gstatic.com'
            ],
            frameSrc: ["'self'", 'https://accounts.google.com'],
            connectSrc: ["'self'", 'https://accounts.google.com', 'https://oauth2.googleapis.com'],
            // O HTML liga comportamento por atributo (onclick, onchange...)
            // em mais de cem lugares. O padrão do Helmet aqui é 'none', que
            // bloqueia todos: os botões ficam na tela sem fazer nada, e o
            // servidor não registra erro nenhum. Enquanto o HTML for assim,
            // a diretiva precisa permitir atributo inline. Trocar isto por
            // 'none' exige antes migrar os handlers para addEventListener.
            scriptSrcAttr: ["'unsafe-inline'"],

            // O frontend tem estilo inline em várias páginas.
            // cdnjs serve o Font Awesome: sem ele aqui, o CSP bloqueia a
            // folha de estilo e TODOS os ícones do site somem.
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://fonts.googleapis.com',
                'https://cdnjs.cloudflare.com'
            ],
            // O Font Awesome busca os .woff2 no mesmo cdnjs.
            fontSrc: [
                "'self'",
                'https://fonts.gstatic.com',
                'https://cdnjs.cloudflare.com',
                'data:'
            ],
            imgSrc: ["'self'", 'data:', 'https:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'"]
        }
    },
    // Precisa ficar desligado: a janela do Google OAuth é cross-origin.
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    // HSTS só em produção, onde há HTTPS.
    hsts: EM_PRODUCAO ? { maxAge: 15552000, includeSubDomains: true } : false
}));

// ---------------------------------------------------------------------
// CORS
//
// Antes era cors() aberto, que autoriza qualquer origem. O frontend é
// servido pelo mesmo processo, então o padrão é só a própria origem.
// ---------------------------------------------------------------------
const origensPermitidas = [
    process.env.APP_URL,
    ...(process.env.CORS_EXTRA_ORIGENS || '').split(',').map((s) => s.trim())
].filter(Boolean);

if (!EM_PRODUCAO) {
    origensPermitidas.push('http://localhost:3000', 'http://127.0.0.1:3000');
}

app.use(cors({
    origin(origem, callback) {
        // Sem Origin: mesma origem, curl, app nativo. Liberado.
        if (!origem) return callback(null, true);

        if (origensPermitidas.includes(origem)) return callback(null, true);

        return callback(new Error('Origem não autorizada pelo CORS'));
    },
    credentials: true
}));

// Corpo JSON com limite — sem isto um POST gigante consome memória.
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));

// JSON malformado deve virar 400, não 500.
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, error: 'JSON inválido no corpo da requisição' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, error: 'Corpo da requisição muito grande' });
    }
    return next(err);
});

// Verificar que as migrations rodaram (não cria nada)
initializeDatabase();

// ---------------------------------------------------------------------
// Healthcheck
//
// Diferente de /api/status: este consulta o banco, então falha quando o
// banco cai. É o que o Render observa para decidir se a instância está
// saudável.
// ---------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
    try {
        await db.ping();
        res.json({
            status: 'ok',
            db: 'ok',
            ambiente: process.env.NODE_ENV || 'development',
            uptime_s: Math.round(process.uptime())
        });
    } catch (err) {
        res.status(503).json({ status: 'degradado', db: 'erro', erro: err.message });
    }
});

// Limite geral da API, depois do healthcheck para não barrar o monitor
app.use('/api', apiLimiter);

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
if (debugHabilitado) {
    app.use('/api/debug', debugRoutes);
} else {
    console.log('🔒 Rotas /api/debug desativadas (produção)');
}
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
module.exports.debugHabilitado = debugHabilitado;