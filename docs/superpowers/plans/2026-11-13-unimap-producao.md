# UniMap Produção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o UniMap de projeto local inseguro a sistema hospedado com autenticação real, banco persistente e domínio próprio.

**Architecture:** O backend Express permanece servindo API e estáticos no mesmo processo. A troca de SQLite por Neon Postgres acontece atrás de um shim em `config/database.js` que preserva a API do `sqlite3`, deixando os 202 call sites das rotas intactos. Uma suíte de testes de API é escrita antes da migração, contra SQLite, e precisa ficar verde contra Postgres depois — é ela que prova a migração.

**Tech Stack:** Node 22, Express 4, `pg`, `jsonwebtoken`, `bcryptjs`, `helmet`, `express-rate-limit`, `zod`, `dotenv`, `pino-http`, Jest + Supertest, Neon Postgres, Render.

**Spec:** `docs/superpowers/plans/2026-11-13-unimap-producao-spec.md`

## Global Constraints

- Node >= 22. Declarar `"engines": { "node": ">=22" }` em `backend/package.json`.
- Nenhum segredo literal em arquivo versionado. Todo segredo vem de `process.env`.
- Colunas booleanas permanecem `INTEGER` (`0`/`1`), não `BOOLEAN`.
- IDs existentes são preservados na migração de dados; sequences reposicionadas com `setval`.
- Mensagens de erro da API em português, formato atual `{ error: "..." }` ou `{ success: false, error: "..." }` — não alterar contratos que o frontend consome.
- Nenhuma alteração em `frontend/js/api.js` além do tratamento de 401, porque ele já envia `Authorization: Bearer <token>`.
- Toda task termina com commit.

## Review Focus

Falhas que a spec implica mas nenhuma task exercita naturalmente. Cada linha tem seu teste adicionado à task indicada.

1. **JWT com assinatura válida mas usuário já deletado/desativado** deve dar 401, não 500 nem acesso. → Task 3.
2. **`?` dentro de literal de string no SQL** não deve ser convertido em placeholder pelo tradutor do shim. → Task 5.
3. **`db.run` em `INSERT` sem coluna `id`** (tabelas de junção como `aluno_turmas`) não pode quebrar ao tentar `RETURNING id`. → Task 5.
4. **Comparação de tipo frouxa** — Postgres é estrito: `periodo` vindo como string `"5"` contra coluna `INTEGER` dá erro de tipo onde SQLite aceitava. → Task 6.
5. **Rate limit atrás do proxy do Render** conta o IP do proxy e bloqueia todo mundo se `trust proxy` não estiver configurado. → Task 8.

---

### Task 1: Higiene do repositório e segredos

**Files:**
- Create: `.gitignore`, `backend/.env.example`, `README.md`
- Modify: `backend/config/email.js`, `backend/config/auth.js`, `backend/server.js`, `backend/package.json`
- Delete: `backend/node_modules/` (do índice), `backend/unimap.db`, `frontend/images/DB.Browser.for.SQLite-v3.13.1-win32.msi`, `backend/server-simple.js`, `frontend/teste-professor.html`, `backend/unimap.sqbpro`

**Interfaces:**
- Produces: `process.env.JWT_SECRET`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `SMTP_USER`, `SMTP_PASS`, `APP_URL`, `NODE_ENV`, `PORT` — nomes usados por todas as tasks seguintes.

- [ ] **Step 1: `.gitignore`** cobrindo `node_modules/`, `*.db`, `*.sqbpro`, `.env`, `*.msi`, `dist/`, `coverage/`.

- [ ] **Step 2: Remover do índice e do histórico**

```bash
git rm -r --cached backend/node_modules
git rm --cached backend/unimap.db backend/unimap.sqbpro
git rm frontend/images/DB.Browser.for.SQLite-v3.13.1-win32.msi
git rm backend/server-simple.js frontend/teste-professor.html
```
Depois `git filter-repo --invert-paths --path backend/node_modules --path backend/unimap.db --path frontend/images/DB.Browser.for.SQLite-v3.13.1-win32.msi` para expurgar o histórico. Guardar cópia local de `unimap.db` fora do repo antes — a Task 7 precisa dela.

- [ ] **Step 3: Segredos para env.** `config/email.js` lê `SMTP_USER`/`SMTP_PASS`; `config/auth.js` lê `GOOGLE_CLIENT_ID`. `server.js` carrega `dotenv` na primeira linha e remove o bloco de `console.log` com credenciais de admin. `transporter.verify()` só roda se `SMTP_USER` existir.

- [ ] **Step 4: Verificar**

Run: `git ls-files | grep -cE 'node_modules|\.db$|\.msi$'`
Expected: `0`

Run: `cd backend && node -e "require('dotenv').config(); require('./config/email')"`
Expected: sem crash, sem segredo impresso

- [ ] **Step 5: Commit** — `chore: remove segredos e artefatos do repo, mover config para env`

---

### Task 2: Suíte de testes de API contra SQLite

Esta é a rede de segurança da migração de banco. Precisa existir antes da Task 5.

**Files:**
- Create: `backend/tests/helpers/app.js`, `backend/tests/auth.test.js`, `backend/tests/crud.test.js`, `backend/jest.config.js`
- Modify: `backend/server.js` (exportar `app` sem dar `listen` quando `require`d), `backend/package.json` (script `test`)

**Interfaces:**
- Produces: `tests/helpers/app.js` exporta `{ app, resetDb(), loginAs(tipo) -> token }`. Todas as tasks seguintes rodam `npm test`.

- [ ] **Step 1: Separar `app` de `listen`.** `server.js` passa a exportar `app`; o `listen` fica atrás de `if (require.main === module)`.

- [ ] **Step 2: Escrever os testes que descrevem o comportamento correto**

```js
// auth.test.js
test('login com senha correta devolve token e usuário', ...)      // 200, body.token truthy
test('login com senha errada devolve 401', ...)
test('login sem senha devolve 400', ...)
test('rota protegida sem header devolve 401', ...)
test('register com email duplicado devolve 400', ...)
test('forgot-password com email inexistente devolve 200 genérico', ...)  // não revela existência
```

```js
// crud.test.js  — um ciclo create/read/update/delete por recurso
test('admin cria, lê, atualiza e remove curso', ...)
test('admin cria, lê, atualiza e remove sala', ...)
test('admin cria, lê, atualiza e remove turma', ...)
test('admin cria, lê, atualiza e remove disciplina', ...)
test('admin cria, lê, atualiza e remove professor', ...)
test('GET /api/salas/blocos devolve lista de blocos', ...)
test('GET /api/dashboard/admin/estatisticas devolve contagens', ...)
test('aluno não acessa rota de admin', ...)                        // 403
```

- [ ] **Step 3: Rodar contra SQLite**

Run: `cd backend && npm test`
Expected: PASS. Qualquer teste que falhe aqui é bug pré-existente — anotar e corrigir na task do seu domínio, não contornar o teste.

- [ ] **Step 4: Commit** — `test: suíte de API cobrindo auth e CRUD`

---

### Task 3: JWT real e senha de professor

Corrige R1 e R2 — a falha crítica.

**Files:**
- Create: `backend/config/jwt.js`
- Modify: `backend/middleware/auth.js`, `backend/routes/auth.js:11-104` (login), `:209-313` (google), `:552-600` (login-professor), `frontend/js/api.js` (tratar 401)
- Test: `backend/tests/auth.test.js`

**Interfaces:**
- Consumes: `process.env.JWT_SECRET` (Task 1); `tests/helpers/app.js` (Task 2).
- Produces: `config/jwt.js` exporta `sign(user) -> string` e `verify(token) -> { sub, tipo, iat, exp }`. Payload: `{ sub: user.id, tipo: user.tipo }`, expiração `7d`, algoritmo `HS256`.

- [ ] **Step 1: Escrever os testes que falham**

```js
test('Bearer com ID numérico cru é rejeitado', async () => {
  const r = await request(app).get('/api/usuarios').set('Authorization', 'Bearer 1');
  expect(r.status).toBe(401);
});
test('JWT válido acessa rota protegida', ...)                       // 200
test('JWT com assinatura adulterada é rejeitado', ...)              // 401
test('JWT expirado é rejeitado', ...)                               // 401, assina com expiresIn: '-1s'
test('JWT de usuário desativado depois da emissão é rejeitado', ...) // 401, não 500  [Review Focus 1]
test('professor loga com a própria senha bcrypt', ...)              // 200
test('professor não loga com prof123', ...)                         // 401
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd backend && npm test -- auth.test.js`
Expected: FAIL — o teste do `Bearer 1` retorna 200 hoje

- [ ] **Step 3: Implementar `config/jwt.js`** com `jsonwebtoken`. Lança se `JWT_SECRET` estiver ausente ou com menos de 32 caracteres.

- [ ] **Step 4: Reescrever `middleware/auth.js`.** `authenticateToken` passa a: extrair o Bearer, `verify()`, buscar `SELECT * FROM usuarios WHERE id = ? AND ativo = 1` usando `payload.sub`, responder 401 se o usuário não existir mais ou estiver inativo, e popular `req.user`. `requireAdmin`/`requireProfessor`/`requireAluno` ficam como estão.

- [ ] **Step 5: Trocar a emissão nas 3 rotas.** `token: user.id.toString()` → `token: sign(user)` em `/login`, `/google` (os dois ramos) e `/login-professor`. Em `/login-professor`, substituir a comparação `senha !== 'prof123'` por `bcrypt.compare(senha, professor.senha_hash)` e devolver `id` numérico real, não `prof_${id}`.

- [ ] **Step 6: Coluna `senha_hash` em `professores`.** Adicionar a coluna; definir senha inicial aleatória por professor e registrar que o reset de senha é o caminho de primeiro acesso.

- [ ] **Step 7: Tratar 401 no frontend.** Em `frontend/js/api.js`, no handler de resposta: se `status === 401`, limpar `localStorage` e redirecionar para `login.html`. Necessário porque o token agora expira.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `cd backend && npm test`
Expected: PASS, incluindo os testes novos

- [ ] **Step 9: Commit** — `fix(security): JWT assinado no lugar de ID como token`

---

### Task 4: Schema Postgres no Neon

**Files:**
- Create: `backend/migrations/001_schema.sql`, `backend/migrations/run.js`
- Modify: `backend/package.json` (script `migrate`)

**Interfaces:**
- Consumes: `process.env.DATABASE_URL`.
- Produces: 13 tabelas no Neon. `migrations/run.js` aplica em ordem todo `.sql` do diretório, registrando os aplicados em `schema_migrations`, idempotente.

- [ ] **Step 1: Criar o projeto Neon** `unimap`, região `aws-sa-east-1` (São Paulo — é onde estão os usuários), Postgres 17.

- [ ] **Step 2: Escrever `001_schema.sql`** traduzindo as 13 tabelas de `utils/databaseInit.js`. Regras da tradução:
  - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
  - `DATETIME DEFAULT CURRENT_TIMESTAMP` → `TIMESTAMPTZ DEFAULT NOW()`
  - `ativo`/`used` e afins permanecem `INTEGER DEFAULT 1` / `DEFAULT 0`
  - `TIME`, `TEXT`, `INTEGER` mapeiam direto
  - Resolver a tabela `aulas` duplicada (spec item 14) adotando o schema da linha 148, que é o que as rotas consultam, mais as colunas que os `ALTER TABLE` de runtime adicionam
  - Incluir as FKs que `script.sql` declara e as constraints `UNIQUE` (`usuarios.email`, `usuarios.matricula`, `aluno_turmas(aluno_id, turma_id)`)
  - Não criar `salas_backup_cleanup`
  - Índices em `aulas(professor_id)`, `aulas(sala_id)`, `aluno_turmas(aluno_id)`, `password_reset_tokens(token)`

- [ ] **Step 3: Aplicar**

Run: `cd backend && npm run migrate`
Expected: `13 tabelas criadas`, e rodar duas vezes não erra

- [ ] **Step 4: Verificar o schema**

Run: query em `information_schema.tables`
Expected: as 13 tabelas, nenhuma `salas_backup_cleanup`

- [ ] **Step 5: Commit** — `feat(db): schema Postgres e runner de migrations`

---

### Task 5: Shim de compatibilidade sqlite3 → pg

A task de maior risco. É o que permite as 12 rotas continuarem como estão.

**Files:**
- Modify: `backend/config/database.js` (reescrita completa)
- Create: `backend/config/sql-translate.js`, `backend/tests/sql-translate.test.js`
- Delete: dependência `sqlite3` de `package.json` (depois da Task 7)

**Interfaces:**
- Consumes: `process.env.DATABASE_URL`; schema da Task 4.
- Produces: `config/database.js` exporta objeto com a mesma superfície que as rotas já usam:
  - `get(sql, params?, cb)` → `cb(err, row|undefined)`
  - `all(sql, params?, cb)` → `cb(err, rows[])`
  - `run(sql, params?, cb)` → `cb.call({ lastID, changes }, err)`
  - `serialize(fn)` → executa `fn()` imediatamente
  - `prepare(sql)` → `{ run(...params, cb?), finalize(cb?) }`
  - `sql-translate.js` exporta `toPg(sql) -> string`

- [ ] **Step 1: Testes do tradutor**

```js
test('? vira $1, $2 na ordem', () =>
  expect(toPg('SELECT * FROM a WHERE x = ? AND y = ?')).toBe('SELECT * FROM a WHERE x = $1 AND y = $2'));
test('? dentro de string literal não é convertido', () =>              // [Review Focus 2]
  expect(toPg("SELECT * FROM a WHERE s = 'por quê?' AND x = ?")).toBe("SELECT * FROM a WHERE s = 'por quê?' AND x = $1"));
test("datetime('now') vira NOW()", ...)
test("date('now') vira CURRENT_DATE", ...)
test('INSERT OR IGNORE vira ON CONFLICT DO NOTHING', ...)
test('GROUP_CONCAT vira STRING_AGG', ...)
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd backend && npm test -- sql-translate.test.js`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar `toPg`.** Varrer a string caractere a caractere alternando dentro/fora de literal (`'`, com `''` escapado) para que só os `?` fora de literal virem `$n`. As substituições de dialeto são regex aplicadas depois, também só fora de literal.

- [ ] **Step 4: Implementar o shim.** `pg.Pool` com `connectionString` e `ssl: { rejectUnauthorized: true }`. Cada método traduz o SQL, executa, e adapta o resultado:
  - `get` → `res.rows[0]`
  - `all` → `res.rows`
  - `run` → `changes` de `res.rowCount`; `lastID` de `res.rows[0].id` **quando houver**. Para obter o id, anexar ` RETURNING id` a `INSERT` que não tenha `RETURNING` — e, se o Postgres rejeitar porque a tabela não tem coluna `id`, repetir sem o `RETURNING` e devolver `lastID: undefined`. [Review Focus 3]
  - Argumento `params` opcional: se o segundo argumento for função, tratar como callback com `params = []`.
  - Erros do `pg` chegam ao callback como primeiro argumento, no formato que as rotas já esperam.

- [ ] **Step 5: Teste de integração do shim**

```js
test('run devolve lastID em INSERT com coluna id', ...)
test('run devolve changes em UPDATE', ...)
test('run em tabela sem coluna id não lança', ...)                     // [Review Focus 3]
test('get devolve undefined quando não há linha', ...)                 // não null — as rotas testam !user
test('prepare().run() insere e finalize() chama o callback', ...)
```

Run: `cd backend && npm test -- database`
Expected: PASS

- [ ] **Step 6: Commit** — `feat(db): shim pg com a API do sqlite3`

---

### Task 6: Ajustes de dialeto nas rotas

**Files:**
- Modify: `backend/routes/aulas.js:107-140`, `backend/utils/databaseInit.js` (reduzir a no-op ou remover), `backend/routes/turmas.js:636`, e os pontos que o teste apontar
- Test: `backend/tests/crud.test.js` (da Task 2, agora contra Postgres)

**Interfaces:**
- Consumes: shim da Task 5.

- [ ] **Step 1: Apontar os testes para o Postgres.** `tests/helpers/app.js` passa a usar `DATABASE_URL` de uma branch Neon de teste; `resetDb()` trunca as tabelas em vez de apagar arquivo.

- [ ] **Step 2: Rodar a suíte e coletar as falhas reais**

Run: `cd backend && npm test`
Expected: FAIL. As falhas são a lista de trabalho desta task — não presumir quais são antes de ver.

- [ ] **Step 3: Remover a introspecção de runtime.** Os 5 `PRAGMA table_info(aulas)` existem para adicionar colunas em banco já criado. Com migrations isso é morto: remover os blocos e o `ALTER TABLE` dinâmico de `databaseInit.js:197`. `initializeDatabase()` deixa de criar tabelas — o schema é responsabilidade das migrations. Manter apenas o seed idempotente de blocos/cursos/horários, se útil, atrás de uma flag.

- [ ] **Step 4: Coerção de tipos.** Onde a rota passa valor de `req.body` para coluna `INTEGER` (`periodo`, `curso_id`, `sala_id`, `professor_id`), converter com `Number()` e rejeitar `NaN` com 400. [Review Focus 4]

- [ ] **Step 5: Teste do tipo frouxo**

```js
test('POST /api/turmas com periodo "5" string é aceito', ...)          // 201
test('POST /api/turmas com periodo "abc" devolve 400', ...)            // não 500
```

- [ ] **Step 6: Suíte verde contra Postgres**

Run: `cd backend && npm test`
Expected: PASS — o mesmo conjunto de testes que passava em SQLite na Task 2

- [ ] **Step 7: Commit** — `fix(db): ajustes de dialeto Postgres nas rotas`

---

### Task 7: Migração dos dados reais

**Files:**
- Create: `backend/scripts/migrate-data.js`

**Interfaces:**
- Consumes: cópia local de `unimap.db` guardada na Task 1; schema da Task 4.

- [ ] **Step 1: Escrever o script.** Lê o SQLite e insere no Postgres na ordem das FKs: `usuarios`, `blocos`, `cursos`, `professores`, `disciplinas`, `turmas`, `salas`, `horarios`, `aulas`, `aluno_turmas`, `professores_favoritos`. Preserva `id` explicitamente. Ignora `password_reset_tokens` (tokens vazados, devem morrer) e `salas_backup_cleanup`. Ao final, `setval` em cada sequence para `MAX(id)`.

- [ ] **Step 2: Rodar**

Run: `cd backend && node scripts/migrate-data.js`

- [ ] **Step 3: Conferir as contagens**

Expected, por tabela: `usuarios` 27, `salas` 2912, `disciplinas` 408, `aulas` 18, `turmas` 5, `cursos` 5, `professores` 5, `blocos` 14, `horarios` 707, `aluno_turmas` 12, `professores_favoritos` 1

- [ ] **Step 4: Teste de que as senhas existentes continuam valendo**

```js
test('usuário pré-existente loga com a senha antiga', ...)             // hash bcrypt migrado intacto
test('sequence não colide: novo cadastro recebe id > 158', ...)
```

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 5: Commit** — `feat(db): script de migração dos dados SQLite para Postgres`

---

### Task 8: Hardening

**Files:**
- Create: `backend/middleware/validate.js`, `backend/middleware/limiters.js`
- Modify: `backend/server.js`, `backend/routes/auth.js`, e cada rota que escreve
- Test: `backend/tests/security.test.js`

**Interfaces:**
- Consumes: app da Task 2.
- Produces: `validate(schema)` — middleware que valida `req.body` com zod e responde 400 `{ error }` no formato atual.

- [ ] **Step 1: Escrever os testes**

```js
test('6ª tentativa de login em 15min devolve 429', ...)
test('resposta traz x-frame-options e x-content-type-options', ...)
test('rotas /api/debug respondem 404 com NODE_ENV=production', ...)
test('POST /api/cursos sem nome devolve 400', ...)
test('CORS rejeita origem desconhecida', ...)
```

- [ ] **Step 2: Confirmar falha**

Run: `cd backend && npm test -- security.test.js`
Expected: FAIL

- [ ] **Step 3: `app.set('trust proxy', 1)`** em `server.js` antes dos limiters, senão o Render faz todos os clientes compartilharem o IP do proxy e o rate limit bloqueia todo mundo. [Review Focus 5]

- [ ] **Step 4: `helmet()`**, com `contentSecurityPolicy` permitindo o Google Identity Services (`accounts.google.com`, `apis.google.com`) que o login usa.

- [ ] **Step 5: Limiters.** Login/`login-professor`: 5 por 15min por IP. `register` e `forgot-password`: 3 por hora por IP. Limiter global brando no resto da API.

- [ ] **Step 6: CORS restrito** a `process.env.APP_URL` (e `localhost:3000` só fora de produção), no lugar do `cors()` aberto.

- [ ] **Step 7: Montar `/api/debug` apenas se `NODE_ENV !== 'production'`.**

- [ ] **Step 8: Schemas zod** para os POST/PUT de `cursos`, `salas`, `turmas`, `disciplinas`, `professores`, `usuarios`, `aulas`, `auth`. Senha com mínimo de 8 caracteres no cadastro e no reset (hoje são 6 no reset e nenhum no cadastro).

- [ ] **Step 9: Link de reset por env.** `routes/auth.js:371` passa a usar `${process.env.APP_URL}/reset-password.html?token=...`.

- [ ] **Step 10: Suíte verde**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 11: Commit** — `feat(security): helmet, rate limit, validação zod e CORS restrito`

---

### Task 9: Deploy no Render

**Files:**
- Create: `render.yaml`
- Modify: `backend/server.js` (healthcheck, logs), `backend/package.json`

**Interfaces:**
- Consumes: tudo acima.

- [ ] **Step 1: `/api/health`** respondendo `{ status, db }`, onde `db` vem de um `SELECT 1` — healthcheck que falha se o banco cair, ao contrário do `/api/status` atual que só diz que o processo está vivo.

- [ ] **Step 2: `pino-http`** para log de requisição em JSON, com `redact` em `authorization` e `senha`.

- [ ] **Step 3: `render.yaml`** — web service Node, `rootDir: backend`, build `npm ci && npm run migrate`, start `npm start`, `healthCheckPath: /api/health`, região `virginia` (as outras APIs do usuário estão lá), plano `starter`, autoDeploy no push da `main`.

- [ ] **Step 4: Variáveis de ambiente** no Render: `DATABASE_URL`, `JWT_SECRET` (gerado, 64 bytes hex), `GOOGLE_CLIENT_ID`, `SMTP_USER`, `SMTP_PASS` (a senha de app **nova**, depois de o usuário revogar a antiga), `APP_URL`, `NODE_ENV=production`.

- [ ] **Step 5: Deploy e verificar em produção**

Run: `curl https://<url>/api/health`
Expected: 200 com `db: "ok"`

Run: `curl -H "Authorization: Bearer 1" https://<url>/api/usuarios`
Expected: 401

- [ ] **Step 6: Teste manual do fluxo** — login como admin, abrir admin-salas, criar e remover uma sala, logout.

- [ ] **Step 7: Commit** — `feat(deploy): render.yaml, healthcheck e logs estruturados`

---

### Task 10: Domínio e HTTPS

**Files:**
- Modify: `render.yaml` (domínio), variável `APP_URL`

**Bloqueio:** depende de o usuário registrar o domínio. Não é executável sem isso.

- [ ] **Step 1:** Usuário registra o domínio (Registro.br para `.com.br`, ~R$40/ano).
- [ ] **Step 2:** Adicionar custom domain no serviço do Render; Render emite o certificado Let's Encrypt.
- [ ] **Step 3:** Apontar o DNS conforme o Render instruir (`CNAME` para o subdomínio, `ALIAS`/`A` para o apex).
- [ ] **Step 4:** Atualizar `APP_URL` e a origem autorizada do Google OAuth no Google Cloud Console.
- [ ] **Step 5: Verificar** — `curl -I https://<domínio>/api/health` → 200, certificado válido.
- [ ] **Step 6: Commit** — `chore: domínio customizado`

---

## Ordem e dependências

```
1 (higiene) → 2 (testes/SQLite) → 3 (JWT)
                                    ↓
                     4 (schema) → 5 (shim) → 6 (dialeto) → 7 (dados)
                                                              ↓
                                                      8 (hardening) → 9 (deploy) → 10 (domínio)
```

A Task 2 antes da 5 não é negociável: sem a suíte verde em SQLite não há como provar que o Postgres se comporta igual.
