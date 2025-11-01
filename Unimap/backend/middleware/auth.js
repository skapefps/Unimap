const db = require('../config/database');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    // Verificar se é um token numérico (ID do usuário)
    const userId = parseInt(token);
    if (isNaN(userId)) {
        return res.status(403).json({ error: 'Token inválido' });
    }

    db.get('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [userId], (err, user) => {
        if (err || !user) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    next();
}

function requireProfessor(req, res, next) {
    if (req.user.tipo !== 'professor') {
        return res.status(403).json({ error: 'Acesso restrito a professores' });
    }
    next();
}

function requireAluno(req, res, next) {
    if (req.user.tipo !== 'aluno') {
        return res.status(403).json({ error: 'Acesso restrito a alunos' });
    }
    next();
}

module.exports = {
    authenticateToken,
    requireAdmin,
    requireProfessor,
    requireAluno
};