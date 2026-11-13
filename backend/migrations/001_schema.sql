-- UNIMAP — schema inicial (Postgres)
--
-- Tradução do schema SQLite que roda em produção hoje
-- (database/script.sql + as colunas que utils/databaseInit.js adicionava
-- via ALTER TABLE em runtime).
--
-- Decisões da tradução:
--   * INTEGER PRIMARY KEY AUTOINCREMENT  -> SERIAL PRIMARY KEY
--   * DATETIME DEFAULT CURRENT_TIMESTAMP -> TIMESTAMPTZ DEFAULT NOW()
--   * BOOLEAN DEFAULT 1                  -> SMALLINT DEFAULT 1
--     Mantido numérico de propósito: as rotas comparam `ativo = 1` e
--     `ativa = 0` em ~130 lugares. Virar BOOLEAN quebraria todas elas.
--   * Tabelas descartadas: aulas_backup_cleanup, salas_backup_cleanup e
--     matriculas — vazias ou lixo de desenvolvimento, sem referência no código.
--
-- A tabela `usuarios` existe aqui porque databaseInit.js nunca a criava:
-- em banco novo o login respondia 500 com "no such table: usuarios".

-- ---------------------------------------------------------------------
-- Usuários (alunos e administradores)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL PRIMARY KEY,
    nome          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    matricula     TEXT UNIQUE,
    tipo          TEXT NOT NULL DEFAULT 'aluno',
    curso         TEXT,
    periodo       INTEGER,
    senha_hash    TEXT NOT NULL,
    ativo         SMALLINT DEFAULT 1,
    data_cadastro TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email     ON usuarios (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios (matricula);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo      ON usuarios (tipo);

-- ---------------------------------------------------------------------
-- Professores (tabela própria; senha_hash é novidade desta migração)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professores (
    id         SERIAL PRIMARY KEY,
    nome       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    senha_hash TEXT,
    ativo      SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_professores_email ON professores (email);

-- ---------------------------------------------------------------------
-- Cursos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cursos (
    id             SERIAL PRIMARY KEY,
    nome           TEXT NOT NULL UNIQUE,
    duracao        INTEGER,
    turno          TEXT,
    ativo          SMALLINT DEFAULT 1,
    total_periodos INTEGER DEFAULT 8
);

-- ---------------------------------------------------------------------
-- Disciplinas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disciplinas (
    id            SERIAL PRIMARY KEY,
    nome          TEXT NOT NULL,
    curso_id      INTEGER REFERENCES cursos (id),
    periodo       INTEGER,
    carga_horaria INTEGER,
    ativa         SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_disciplinas_curso ON disciplinas (curso_id);

-- ---------------------------------------------------------------------
-- Blocos do campus
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocos (
    id    SERIAL PRIMARY KEY,
    letra TEXT NOT NULL UNIQUE,
    nome  TEXT
);

-- ---------------------------------------------------------------------
-- Salas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salas (
    id         SERIAL PRIMARY KEY,
    numero     TEXT NOT NULL,
    bloco      TEXT NOT NULL,
    andar      INTEGER NOT NULL,
    tipo       TEXT NOT NULL,
    capacidade INTEGER,
    recursos   TEXT,
    ativa      SMALLINT DEFAULT 1,
    campus     TEXT DEFAULT 'Principal',
    telefone   TEXT,
    email      TEXT
);

CREATE INDEX IF NOT EXISTS idx_salas_bloco       ON salas (bloco);
CREATE INDEX IF NOT EXISTS idx_salas_bloco_andar ON salas (bloco, andar);
CREATE INDEX IF NOT EXISTS idx_salas_ativa       ON salas (ativa);

-- ---------------------------------------------------------------------
-- Turmas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turmas (
    id                SERIAL PRIMARY KEY,
    nome              TEXT NOT NULL,
    curso_id          INTEGER REFERENCES cursos (id),
    periodo           INTEGER,
    ano               INTEGER DEFAULT 2024,
    ativa             SMALLINT DEFAULT 1,
    quantidade_alunos INTEGER DEFAULT 0,
    curso             TEXT
);

CREATE INDEX IF NOT EXISTS idx_turmas_curso           ON turmas (curso_id);
CREATE INDEX IF NOT EXISTS idx_turmas_curso_periodo   ON turmas (curso, periodo);

-- ---------------------------------------------------------------------
-- Horários padrão
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horarios (
    id             SERIAL PRIMARY KEY,
    nome           TEXT NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim    TIME NOT NULL
);

-- ---------------------------------------------------------------------
-- Aulas
--
-- O schema abaixo é o estado final real da tabela em produção: o
-- CREATE TABLE de script.sql mais as colunas que databaseInit.js
-- acrescentava em runtime (disciplina, data_aula, periodo, dia_semana,
-- data_criacao). Conferido com PRAGMA table_info no banco de produção.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aulas (
    id             SERIAL PRIMARY KEY,
    disciplina     TEXT NOT NULL,
    professor_id   INTEGER NOT NULL REFERENCES professores (id),
    sala_id        INTEGER REFERENCES salas (id),
    curso          TEXT,
    turma          TEXT,
    horario_inicio TIME NOT NULL,
    horario_fim    TIME NOT NULL,
    data_aula      DATE NOT NULL,
    periodo        INTEGER,
    dia_semana     INTEGER,
    data_criacao   TIMESTAMPTZ DEFAULT NOW(),
    ativa          SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_aulas_professor ON aulas (professor_id);
CREATE INDEX IF NOT EXISTS idx_aulas_sala      ON aulas (sala_id);
CREATE INDEX IF NOT EXISTS idx_aulas_data      ON aulas (data_aula);
CREATE INDEX IF NOT EXISTS idx_aulas_ativa     ON aulas (ativa);
CREATE INDEX IF NOT EXISTS idx_aulas_turma     ON aulas (turma);

-- ---------------------------------------------------------------------
-- Matrícula de aluno em turma
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aluno_turmas (
    id             SERIAL PRIMARY KEY,
    aluno_id       INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    turma_id       INTEGER NOT NULL REFERENCES turmas (id) ON DELETE CASCADE,
    data_matricula TIMESTAMPTZ DEFAULT NOW(),
    status         TEXT DEFAULT 'cursando',
    UNIQUE (aluno_id, turma_id)
);

CREATE INDEX IF NOT EXISTS idx_aluno_turmas_aluno ON aluno_turmas (aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_turmas_turma ON aluno_turmas (turma_id);

-- ---------------------------------------------------------------------
-- Professores favoritados por alunos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professores_favoritos (
    id           SERIAL PRIMARY KEY,
    aluno_id     INTEGER REFERENCES usuarios (id) ON DELETE CASCADE,
    professor_id INTEGER REFERENCES professores (id) ON DELETE CASCADE,
    data_adicao  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (aluno_id, professor_id)
);

CREATE INDEX IF NOT EXISTS idx_favoritos_aluno ON professores_favoritos (aluno_id);

-- ---------------------------------------------------------------------
-- Tokens de redefinição de senha
--
-- Os 9 tokens que existiam no SQLite não são migrados: estavam num
-- repositório público e devem ser considerados comprometidos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token   ON password_reset_tokens (token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user    ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens (expires_at);
