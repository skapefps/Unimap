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

/** Tabelas de identidade. O token precisa dizer de qual ele veio. */
const ORIGEM = {
    USUARIOS: 'usuarios',
    PROFESSORES: 'professores'
};

/**
 * Assina um token para o usuário.
 *
 * O payload carrega id, tipo e a tabela de origem. Nome, email e hash de
 * senha ficam de fora: o payload de um JWT é legível por qualquer um que
 * tenha o token, e os dados do usuário são buscados no banco a cada
 * requisição (é isso que permite revogar acesso desativando o usuário).
 *
 * `src` existe porque há duas tabelas de identidade com sequences
 * independentes: `usuarios` e `professores`. Sem ela, um token com
 * sub=1 emitido para o professor 1 era resolvido contra
 * `usuarios WHERE id = 1` -- outra pessoa, que no banco atual é o
 * administrador. Era escalação de privilégio, reproduzida em teste.
 *
 * @param {{id: number|string, tipo: string}} usuario
 * @param {string} [origem] — ORIGEM.USUARIOS (padrão) ou ORIGEM.PROFESSORES
 * @returns {string}
 */
function sign(usuario, origem = ORIGEM.USUARIOS) {
    if (!usuario || usuario.id === undefined || usuario.id === null) {
        throw new Error('sign() exige um usuário com id');
    }

    if (origem !== ORIGEM.USUARIOS && origem !== ORIGEM.PROFESSORES) {
        throw new Error(`origem inválida para o token: ${origem}`);
    }

    return jwt.sign(
        { sub: usuario.id, tipo: usuario.tipo || 'aluno', src: origem },
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

module.exports = { sign, verify, ORIGEM, EXPIRACAO, ALGORITMO };
