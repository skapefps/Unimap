# UniMap — Spec: colocar em produção profissionalmente

**Origem:** auditoria do repositório `skapefps/Unimap` em 2026-11-13 (commit `eddc27d`).

## Estado atual (verificado, não presumido)

- Backend Express funcional: 12 arquivos de rota, ~110 endpoints, 13 tabelas, SQLite.
- Sobe e responde (`/api/status` → 200) depois de reinstalar `node_modules` para Linux.
- Frontend vanilla JS/HTML/CSS, 17 páginas, servido pelo próprio Express (`express.static`).
- `frontend/js/config.js` já resolve a URL da API por `window.location.origin` — o front funciona em produção same-origin sem alteração.
- Todas as queries SQL são parametrizadas. Nenhum SQL injection encontrado.
- Zero testes automatizados.

## Falhas que o sistema tem hoje

### Segurança (bloqueiam o lançamento)

1. **Autenticação falsa.** `routes/auth.js` devolve `token: user.id.toString()`. `middleware/auth.js` faz `parseInt(token)` e busca o ID. Verificado:
   `curl -H "Authorization: Bearer 1" /api/usuarios` → 200 com os 27 usuários. `Bearer 1` = admin total, sem senha.
2. **Senha única de professor** hardcoded: `if (senha !== 'prof123')` em `/api/auth/login-professor`.
3. **Senha de app do Gmail em texto puro** em `backend/config/email.js`, em repo **público**.
4. **Banco com dados pessoais commitado**: `backend/unimap.db` com 27 usuários reais (emails, hashes bcrypt) e 9 tokens de reset.
5. **Credenciais de admin impressas no stdout** a cada boot.
6. Sem `helmet`, sem rate limit, sem validação de entrada, sem CORS restrito.
7. 12 rotas `/api/debug/*` expostas.

### Infraestrutura (impedem hospedar)

8. **SQLite em arquivo** — o disco do Render é efêmero; o banco é apagado a cada deploy/restart.
9. **`node_modules` commitado** (2.448 arquivos) com binário `node_sqlite3.node` compilado para Windows → `invalid ELF header` no Linux. Verificado.
10. Sem `.gitignore`, sem `.env`, sem `dotenv`.
11. Link de reset de senha fixo em `http://localhost:3000`.
12. Instalador `.msi` de 17 MB em `frontend/images/`.
13. Sem healthcheck, logs estruturados, migrations ou backups.

### Código

14. `utils/databaseInit.js` cria a tabela `aulas` duas vezes, com schemas diferentes (linhas 12 e 148).
15. `PRAGMA table_info(aulas)` usado em runtime (5x) para adicionar colunas via `ALTER TABLE` — substitui migrations.
16. `server-simple.js` aceita qualquer senha; `teste-professor.html` é página de teste. Ambos no deploy.
17. Tabela `salas_backup_cleanup` (422 linhas) é lixo de desenvolvimento.

## Requisitos

### Obrigatórios

- R1. Token de autenticação deve ser inverificável sem a chave do servidor. `Bearer 1` → 401.
- R2. Senha de professor individual, com bcrypt, como a de aluno/admin.
- R3. Nenhum segredo no código-fonte nem no histórico do Git. Tudo por variável de ambiente.
- R4. Dados persistem entre deploys e restarts.
- R5. Os 27 usuários, 2.912 salas, 408 disciplinas, 5 cursos/turmas/professores e 18 aulas atuais são preservados, com os mesmos IDs. Senhas existentes continuam funcionando.
- R6. Rate limit em login, cadastro e recuperação de senha.
- R7. Validação de entrada em todo endpoint que escreve.
- R8. Rotas de debug e arquivos de teste ausentes em produção.
- R9. Headers de segurança (helmet) e CORS restrito à origem própria.
- R10. Healthcheck e logs de requisição para operar o sistema depois.
- R11. Suíte de testes automatizados cobrindo auth e CRUD, verde antes e depois da migração de banco.
- R12. Deploy no Render com HTTPS, auto-deploy no push da `main`.
- R13. Domínio customizado com HTTPS.

### Fora de escopo nesta fase

- Mapa visual (planta/SVG das salas). Hoje `mapa.js` é lista agrupada por bloco/andar. Fase 2.
- As 4 funcionalidades marcadas `"em desenvolvimento"` no front (vincular disciplinas a cursos, filtros do dashboard do aluno, edição de linha no CSV).
- Reescrita do frontend. Permanece vanilla JS.

## Decisões de arquitetura

- **Banco: Neon Postgres.** O usuário já usa Neon nos outros projetos. Alternativa descartada: SQLite em disco persistente do Render — mais simples, mas sem backups gerenciados e trava em uma instância só.
- **Driver: shim de compatibilidade.** `config/database.js` passa a expor a mesma API do `sqlite3` (`get`/`all`/`run`/`serialize`/`prepare`) sobre `pg`. Motivo: 202 call sites em 12 arquivos; reescrever cada um é risco desproporcional. Um arquivo testável em vez de doze arquivos alterados.
- **Booleanos continuam `INTEGER`** (`ativo INTEGER DEFAULT 1`) para não alterar as ~130 comparações `= 1` / `= 0` nas rotas.
- **Hospedagem: um único Web Service no Render** servindo API + estáticos, como hoje. Alternativa descartada: front na Vercel + API no Render — mais rápido globalmente, mas adiciona CORS, dois deploys e duas configs sem ganho real nesta escala.
- **Schema por migrations SQL versionadas**, substituindo o `databaseInit.js` em runtime.
