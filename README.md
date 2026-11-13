# UNIMAP

Sistema de gestão acadêmica: salas, blocos, cursos, turmas, disciplinas, professores e horários de aula, com painéis separados para administrador, professor e aluno.

## Stack

- **Backend:** Node 22, Express 4, Postgres (Neon)
- **Frontend:** HTML/CSS/JavaScript sem framework, servido pelo próprio Express
- **Auth:** JWT (HS256) + Google Identity Services
- **Hospedagem:** Render

## Rodando localmente

Requer Node 22 ou superior.

```bash
cd backend
cp .env.example .env     # preencha DATABASE_URL e JWT_SECRET
npm install
npm run migrate          # cria o schema
npm start                # http://localhost:3000
```

Gerar um `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Testes

```bash
cd backend
npm test
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NODE_ENV` | sim | `development`, `production` ou `test` |
| `PORT` | não | Porta HTTP. Padrão `3000` |
| `APP_URL` | sim | URL pública. Usada no CORS e no link de reset de senha |
| `DATABASE_URL` | sim | String de conexão Postgres |
| `JWT_SECRET` | sim | Segredo de assinatura dos tokens. Mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | não | Validade do token. Padrão `7d` |
| `GOOGLE_CLIENT_ID` | não | Client ID do Google. Sem ele, o login com Google fica desabilitado |
| `SMTP_USER` / `SMTP_PASS` | não | Credenciais de email. Sem elas, a recuperação de senha fica desabilitada |
| `SMTP_FROM` | não | Remetente dos emails |

## Estrutura

```
backend/
  config/       conexão com o banco, JWT, email, Google
  middleware/   autenticação, autorização, validação, rate limit
  migrations/   schema versionado em SQL
  routes/       endpoints da API, um arquivo por recurso
  scripts/      migração de dados
  tests/        Jest + Supertest
frontend/
  css/ js/ images/
  *.html        páginas
docs/
  superpowers/plans/   spec e plano de implementação
```

## Deploy

Push na `main` dispara deploy automático no Render, que roda as migrations antes de subir. A configuração está em `render.yaml`.
