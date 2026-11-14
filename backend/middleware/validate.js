/**
 * Validação de corpo de requisição com zod.
 *
 * Nenhum endpoint validava entrada além de checar se o campo existia.
 * Senha era aceita com qualquer tamanho no cadastro, email sem formato,
 * número como texto arbitrário.
 *
 * O formato de erro mantém `{ success: false, error: "..." }`, que é o
 * que o frontend já lê.
 */
const { z } = require('zod');

/**
 * Middleware de validação.
 *
 * Substitui `req.body` pelo resultado tipado — então o handler recebe
 * número onde o schema diz número, sem precisar converter.
 *
 * @param {z.ZodTypeAny} schema
 */
function validate(schema) {
    return (req, res, next) => {
        const r = schema.safeParse(req.body);

        if (!r.success) {
            const primeiro = r.error.issues[0];
            const campo = primeiro.path.join('.');

            return res.status(400).json({
                success: false,
                error: campo ? `${campo}: ${primeiro.message}` : primeiro.message,
                // Lista completa para o frontend poder marcar os campos.
                detalhes: r.error.issues.map((i) => ({
                    campo: i.path.join('.'),
                    mensagem: i.message
                }))
            });
        }

        req.body = r.data;
        next();
    };
}

// ---------------------------------------------------------------------
// Peças reutilizáveis
// ---------------------------------------------------------------------

const texto = (nome, min = 1, max = 255) =>
    z.string({ required_error: `${nome} é obrigatório` })
        .trim()
        .min(min, min === 1 ? `${nome} é obrigatório` : `${nome} precisa de ao menos ${min} caracteres`)
        .max(max, `${nome} passa de ${max} caracteres`);

const email = z.string({ required_error: 'email é obrigatório' })
    .trim()
    .toLowerCase()
    .email('email inválido')
    .max(255);

/** Senha nova: mínimo 8. Antes o cadastro não exigia nada e o reset, 6. */
const senhaNova = z.string({ required_error: 'senha é obrigatória' })
    .min(8, 'a senha precisa de ao menos 8 caracteres')
    .max(200, 'senha muito longa');

/** Senha no login: só não pode ser vazia — quem já tem senha curta precisa entrar. */
const senhaLogin = z.string({ required_error: 'senha é obrigatória' }).min(1, 'senha é obrigatória');

/**
 * Inteiro que aceita string.
 *
 * Formulário HTML manda número como texto; o SQLite aceitava, o
 * Postgres não.
 */
const inteiro = (nome, { min = 0, max = 2147483647 } = {}) =>
    z.coerce.number({ invalid_type_error: `${nome} precisa ser um número` })
        .int(`${nome} precisa ser um número inteiro`)
        .min(min, `${nome} precisa ser ao menos ${min}`)
        .max(max, `${nome} passa do máximo permitido`);

const inteiroOpcional = (nome, opcoes) =>
    z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : v),
        inteiro(nome, opcoes).optional()
    );

const textoOpcional = (max = 255) =>
    z.preprocess(
        (v) => (v === '' || v === null ? undefined : v),
        z.string().trim().max(max).optional()
    );

// ---------------------------------------------------------------------
// Schemas por endpoint
// ---------------------------------------------------------------------

const schemas = {
    login: z.object({
        email: z.string().trim().toLowerCase().email('email inválido').optional(),
        matricula: z.string().trim().min(1).max(50).optional(),
        senha: senhaLogin
    }).refine((d) => d.email || d.matricula, {
        message: 'informe email ou matrícula',
        path: ['email']
    }),

    loginProfessor: z.object({
        email,
        senha: senhaLogin
    }),

    registro: z.object({
        nome: texto('nome', 2, 150),
        email,
        senha: senhaNova,
        matricula: textoOpcional(50),
        curso: textoOpcional(150),
        periodo: inteiroOpcional('periodo', { min: 1, max: 20 })
    }),

    esqueciSenha: z.object({ email }),

    resetSenha: z.object({
        token: texto('token', 10, 200),
        novaSenha: senhaNova
    }),

    curso: z.object({
        nome: texto('nome', 2, 150),
        duracao: inteiroOpcional('duracao', { min: 1, max: 20 }),
        turno: textoOpcional(50),
        total_periodos: inteiroOpcional('total_periodos', { min: 1, max: 20 })
    }),

    sala: z.object({
        numero: texto('numero', 1, 50),
        bloco: texto('bloco', 1, 10),
        andar: inteiro('andar', { min: -5, max: 50 }),
        tipo: texto('tipo', 1, 100),
        capacidade: inteiroOpcional('capacidade', { min: 0, max: 10000 }),
        recursos: textoOpcional(1000),
        campus: textoOpcional(100),
        telefone: textoOpcional(50),
        email: z.preprocess(
            (v) => (v === '' || v === null ? undefined : v),
            z.string().trim().email('email inválido').optional()
        )
    }),

    turma: z.object({
        nome: texto('nome', 1, 100),
        curso: textoOpcional(150),
        curso_id: inteiroOpcional('curso_id', { min: 1 }),
        periodo: inteiro('periodo', { min: 1, max: 20 }),
        ano: inteiroOpcional('ano', { min: 2000, max: 2100 }),
        quantidade_alunos: inteiroOpcional('quantidade_alunos', { min: 0, max: 1000 })
    }),

    disciplina: z.object({
        nome: texto('nome', 2, 150),
        curso_id: inteiro('curso_id', { min: 1 }),
        periodo: inteiroOpcional('periodo', { min: 1, max: 20 }),
        carga_horaria: inteiroOpcional('carga_horaria', { min: 0, max: 2000 })
    }),

    professor: z.object({
        nome: texto('nome', 2, 150),
        email
    })
};

module.exports = { validate, schemas, z };
