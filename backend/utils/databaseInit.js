/**
 * Verificação do schema no boot.
 *
 * Este arquivo criava as tabelas e alterava colunas a cada inicialização
 * do servidor (873 linhas de CREATE TABLE, PRAGMA table_info e ALTER
 * TABLE encadeados em callbacks). Isso deixou de ser feito aqui por três
 * motivos:
 *
 *   1. O schema agora é versionado em migrations/*.sql, aplicado antes
 *      de o app subir — não durante.
 *   2. Servidor web fazendo DDL no boot é corrida garantida com mais de
 *      uma instância: duas réplicas subindo juntas executariam o mesmo
 *      ALTER TABLE ao mesmo tempo.
 *   3. `PRAGMA table_info` não existe no Postgres, e o truque de
 *      inspecionar colunas em runtime só existia para compensar a
 *      ausência de migrations.
 *
 * O que sobrou é uma verificação: se as tabelas não estiverem lá, o
 * problema é que as migrations não rodaram, e a mensagem precisa dizer
 * isso em vez de deixar o app responder 500 em cada rota.
 *
 * Os dados iniciais (blocos, cursos, horários, admin) saíram para
 * scripts/seed.js, executado sob demanda com `npm run seed`.
 */
const db = require('../config/database');

const TABELAS_ESPERADAS = [
    'usuarios',
    'professores',
    'cursos',
    'disciplinas',
    'blocos',
    'salas',
    'turmas',
    'horarios',
    'aulas',
    'aluno_turmas',
    'professores_favoritos',
    'password_reset_tokens'
];

/**
 * Confere que o schema está no lugar. Não cria nem altera nada.
 *
 * @returns {Promise<{ok: boolean, faltando: string[]}>}
 */
function verificarSchema() {
    return new Promise((resolve) => {
        const placeholders = TABELAS_ESPERADAS.map(() => '?').join(', ');

        db.all(
            `SELECT table_name AS nome
               FROM information_schema.tables
              WHERE table_schema = 'public'
                AND table_name IN (${placeholders})`,
            TABELAS_ESPERADAS,
            (err, rows) => {
                if (err) {
                    console.error('❌ Não foi possível verificar o schema:', err.message);
                    return resolve({ ok: false, faltando: TABELAS_ESPERADAS, erro: err });
                }

                const presentes = new Set((rows || []).map((r) => r.nome));
                const faltando = TABELAS_ESPERADAS.filter((t) => !presentes.has(t));

                if (faltando.length > 0) {
                    console.error('❌ Tabelas ausentes no banco:', faltando.join(', '));
                    console.error('   Rode as migrations antes de subir o servidor: npm run migrate');
                } else if (process.env.NODE_ENV !== 'test') {
                    console.log(`✅ Schema verificado (${TABELAS_ESPERADAS.length} tabelas)`);
                }

                resolve({ ok: faltando.length === 0, faltando });
            }
        );
    });
}

/**
 * Mantido com o nome antigo porque é assim que server.js chama.
 * Hoje apenas verifica; a criação do schema é das migrations.
 */
function initializeDatabase() {
    return verificarSchema();
}

module.exports = {
    initializeDatabase,
    verificarSchema,
    TABELAS_ESPERADAS
};
