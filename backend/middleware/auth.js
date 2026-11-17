const db = require('../config/database');
const { verify, ORIGEM } = require('../config/jwt');

/**
 * Autentica a requisição por JWT.
 *
 * Fluxo: extrai o Bearer, verifica assinatura e expiração, e só então
 * busca o usuário no banco. A ida ao banco é deliberada — é ela que faz
 * um usuário desativado ou removido perder o acesso imediatamente, sem
 * esperar o token expirar.
 *
 * 401 = token ausente, inválido, expirado ou de usuário que já não vale.
 * 403 = token legítimo, mas sem permissão para o recurso (ver requireX).
 */
function authenticateToken(req, res, next) {
    const header = req.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    let payload;
    try {
        payload = verify(token);
    } catch (err) {
        const expirado = err.name === 'TokenExpiredError';
        return res.status(401).json({
            error: expirado ? 'Sessão expirada. Faça login novamente.' : 'Token inválido',
            expired: expirado
        });
    }

    // Token emitido contra a tabela `professores` não resolve aqui.
    //
    // As duas tabelas de identidade têm sequences independentes, então
    // o professor de id 1 e o usuário de id 1 são pessoas diferentes.
    // Sem esta checagem, o token do professor 1 era resolvido contra
    // `usuarios WHERE id = 1` — que no banco atual é o administrador,
    // dando acesso total de admin. Reproduzido em teste antes da
    // correção.
    if (payload.src === ORIGEM.PROFESSORES) {
        return res.status(403).json({
            error: 'Este token é de professor e não dá acesso a esta área'
        });
    }

    db.get(
        'SELECT * FROM usuarios WHERE id = ? AND ativo = 1',
        [payload.sub],
        (err, user) => {
            if (err) {
                console.error('❌ Erro ao carregar usuário do token:', err.message);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }

            // Usuário deletado ou desativado depois da emissão do token.
            if (!user) {
                return res.status(401).json({ error: 'Token inválido' });
            }

            req.user = user;
            next();
        }
    );
}

/**
 * Autentica o professor por JWT contra a tabela `professores`.
 *
 * Existe porque professores vivem em tabela própria: o token emitido por
 * /api/auth/login-professor tem `tipo: 'professor'` e `sub` apontando
 * para `professores.id`, não para `usuarios.id`.
 */
function authenticateProfessor(req, res, next) {
    const header = req.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    let payload;
    try {
        payload = verify(header.slice('Bearer '.length).trim());
    } catch (err) {
        return res.status(401).json({
            error: err.name === 'TokenExpiredError'
                ? 'Sessão expirada. Faça login novamente.'
                : 'Token inválido'
        });
    }

    // Exige que o token tenha sido emitido contra a tabela `professores`.
    // `tipo` sozinho não basta: há usuários em `usuarios` com
    // tipo='professor', cujos ids pertencem a outra sequence.
    if (payload.src !== ORIGEM.PROFESSORES) {
        return res.status(403).json({ error: 'Acesso restrito a professores' });
    }

    db.get(
        'SELECT * FROM professores WHERE id = ? AND ativo = 1',
        [payload.sub],
        (err, professor) => {
            if (err) {
                console.error('❌ Erro ao carregar professor do token:', err.message);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }
            if (!professor) {
                return res.status(401).json({ error: 'Token inválido' });
            }

            req.professor = professor;
            req.user = { ...professor, tipo: 'professor', professor_id: professor.id };
            next();
        }
    );
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    next();
}

function requireProfessor(req, res, next) {
    if (!req.user || req.user.tipo !== 'professor') {
        return res.status(403).json({ error: 'Acesso restrito a professores' });
    }
    next();
}

function requireAluno(req, res, next) {
    if (!req.user || req.user.tipo !== 'aluno') {
        return res.status(403).json({ error: 'Acesso restrito a alunos' });
    }
    next();
}

module.exports = {
    authenticateToken,
    authenticateProfessor,
    requireAdmin,
    requireProfessor,
    requireAluno
};
