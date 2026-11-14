/**
 * Validação de parâmetros de id na URL.
 *
 * O SQLite aceitava comparar a string "abc" com uma coluna INTEGER e
 * simplesmente não achava nada — resultado: 404. O Postgres recusa a
 * comparação com erro 22P02, que subia como 500.
 *
 * Registrado com `router.param('id', validarId)`, roda antes de qualquer
 * handler da rota que tenha `:id`, sem precisar tocar em cada um.
 */

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {string} valor — o parâmetro cru da URL
 */
function validarId(req, res, next, valor) {
    // Inteiro positivo, sem sinal, sem decimal, sem notação científica.
    if (!/^\d+$/.test(String(valor))) {
        return res.status(400).json({
            success: false,
            error: 'ID inválido'
        });
    }

    const numero = Number(valor);

    // Acima do limite de INTEGER do Postgres o banco devolveria erro de
    // overflow; aqui vira 400, que é o que o pedido realmente é.
    if (numero > 2147483647) {
        return res.status(400).json({
            success: false,
            error: 'ID inválido'
        });
    }

    next();
}

/**
 * Converte um campo do corpo para número inteiro.
 *
 * Formulários HTML mandam número como string; o SQLite aceitava, o
 * Postgres não. Devolve `null` para vazio/ausente e `NaN` para o que
 * não é número, deixando a decisão com quem chamou.
 *
 * @param {unknown} valor
 * @returns {number|null}
 */
function paraInteiro(valor) {
    if (valor === undefined || valor === null || valor === '') return null;
    const n = Number(valor);
    return Number.isInteger(n) ? n : NaN;
}

module.exports = { validarId, paraInteiro };
