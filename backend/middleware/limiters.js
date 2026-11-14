/**
 * Limites de requisição.
 *
 * O login não tinha limite nenhum: dava para tentar senhas
 * indefinidamente. A recuperação de senha também não, e cada tentativa
 * dispara um email — servia de máquina de spam apontada para qualquer
 * endereço.
 *
 * Depende de `app.set('trust proxy', 1)` no server.js. Sem isso, atrás
 * do proxy do Render todos os clientes compartilham o IP do proxy e o
 * primeiro a estourar o limite bloqueia todo mundo.
 */
const rateLimit = require('express-rate-limit');

const MINUTO = 60 * 1000;

/** Permite afrouxar nos testes sem desligar a verificação. */
const n = (nome, padrao) => Number(process.env[nome] || padrao);

const respostaExcedida = (mensagem) => (req, res) => {
    res.status(429).json({ success: false, error: mensagem });
};

/**
 * Login: 5 tentativas por IP a cada 15 minutos.
 *
 * `skipSuccessfulRequests` faz o acerto não contar — quem erra a senha
 * duas vezes e acerta na terceira não fica perto do limite.
 */
const loginLimiter = rateLimit({
    windowMs: n('RATE_LOGIN_JANELA_MS', 15 * MINUTO),
    max: n('RATE_LOGIN_MAX', 5),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: respostaExcedida(
        'Muitas tentativas de login. Tente novamente em alguns minutos.'
    )
});

/** Cadastro: 5 contas por IP por hora. */
const registroLimiter = rateLimit({
    windowMs: n('RATE_REGISTRO_JANELA_MS', 60 * MINUTO),
    max: n('RATE_REGISTRO_MAX', 5),
    standardHeaders: true,
    legacyHeaders: false,
    handler: respostaExcedida('Muitos cadastros deste endereço. Tente mais tarde.')
});

/**
 * Recuperação de senha: 3 por IP por hora.
 *
 * Mais apertado que o login porque cada chamada manda email.
 */
const senhaLimiter = rateLimit({
    windowMs: n('RATE_SENHA_JANELA_MS', 60 * MINUTO),
    max: n('RATE_SENHA_MAX', 3),
    standardHeaders: true,
    legacyHeaders: false,
    handler: respostaExcedida(
        'Muitas solicitações de recuperação de senha. Tente novamente mais tarde.'
    )
});

/**
 * Limite geral da API: folgado, só para conter abuso automatizado.
 * Não se aplica aos estáticos.
 */
const apiLimiter = rateLimit({
    windowMs: n('RATE_API_JANELA_MS', 15 * MINUTO),
    max: n('RATE_API_MAX', 600),
    standardHeaders: true,
    legacyHeaders: false,
    handler: respostaExcedida('Muitas requisições. Aguarde um momento.')
});

module.exports = {
    loginLimiter,
    registroLimiter,
    senhaLimiter,
    apiLimiter
};
