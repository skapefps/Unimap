const jwt = require('jsonwebtoken');

const SEGREDO = process.env.JWT_SECRET;
const EXPIRACAO = process.env.JWT_EXPIRES_IN || '7d';
const ALGORITMO = 'HS256';

// Falha no boot, não na primeira requisição: um servidor sem segredo de
// assinatura não deve ficar de pé aceitando tráfego.
if (!SEGREDO) {
    throw new Error(
        'JWT_SECRET ausente. Gere um com: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
}

if (SEGREDO.length < 32) {
    throw new Error(`JWT_SECRET curto demais (${SEGREDO.length} caracteres). Mínimo 32.`);
}

/**
 * Assina um token para o usuário.
 *
 * O payload carrega apenas o id e o tipo. Nome, email e hash de senha
 * ficam de fora: o payload de um JWT é legível por qualquer um que tenha
 * o token, e os dados do usuário são buscados no banco a cada requisição
 * (é isso que permite revogar acesso desativando o usuário).
 *
 * @param {{id: number|string, tipo: string}} usuario
 * @returns {string}
 */
function sign(usuario) {
    if (!usuario || usuario.id === undefined || usuario.id === null) {
        throw new Error('sign() exige um usuário com id');
    }

    return jwt.sign(
        { sub: usuario.id, tipo: usuario.tipo || 'aluno' },
        SEGREDO,
        { expiresIn: EXPIRACAO, algorithm: ALGORITMO }
    );
}

/**
 * Verifica assinatura e expiração.
 *
 * @param {string} token
 * @returns {{sub: number|string, tipo: string, iat: number, exp: number}}
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError}
 */
function verify(token) {
    // algorithms explícito: sem isso um token forjado com alg "none"
    // ou outro algoritmo seria aceito.
    return jwt.verify(token, SEGREDO, { algorithms: [ALGORITMO] });
}

module.exports = { sign, verify, EXPIRACAO, ALGORITMO };
