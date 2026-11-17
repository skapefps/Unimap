-- Unifica a identidade de professor em `usuarios`.
--
-- `professores` era uma segunda tabela de identidade: senha própria,
-- sequence própria, nenhuma relação com `usuarios`. Três consequências:
--
--   1. Nenhum dos 5 professores tinha senha, e não havia caminho para
--      obter uma — a recuperação de senha consulta só `usuarios`.
--   2. O id colidia: o professor 1 e o usuário 1 são pessoas
--      diferentes, e o token não dizia de qual tabela vinha. Isso abriu
--      uma escalação de privilégio para admin.
--   3. Toda funcionalidade de conta teria de ser escrita duas vezes.
--
-- Depois desta migração, a conta do professor vive em `usuarios`, como
-- a de todo mundo. `professores` continua existindo e mantém seu id,
-- porque é para ele que `aulas` e `professores_favoritos` apontam — mas
-- passa a ser apenas o vínculo acadêmico, ligado por `usuario_id`.
--
-- O preenchimento de `usuario_id` é feito por scripts/unifica-professores.js,
-- que casa por email e cria o usuário onde não existir.

ALTER TABLE professores
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_professores_usuario ON professores (usuario_id);

-- Um usuário não pode ter dois vínculos acadêmicos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_professores_usuario_unico
    ON professores (usuario_id) WHERE usuario_id IS NOT NULL;

-- A senha sai daqui: a autenticação passa a ser só por `usuarios`.
-- A coluna foi criada nesta mesma série de mudanças e nunca chegou a
-- ser preenchida em produção, então não há nada a preservar.
ALTER TABLE professores DROP COLUMN IF EXISTS senha_hash;
