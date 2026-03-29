# Portfólio — Fullstack Backend-Centric v2.0

Plataforma de portfólio pessoal construída como **prova de conceito técnica**: filas, cache, segurança, CRUD, moderação, uploads diretos, otimização de imagens, analytics e jobs em background.

**Stack:** Bun + Hono · Drizzle ORM + PostgreSQL · BullMQ + Redis · Next.js App Router · S3-compatível · Docker Compose + Dokploy

---

## Estrutura do Monorepo

```
apps/
  api/      # REST API com Hono (Bun)
  worker/   # Jobs em background com BullMQ (Bun)
  web/      # Next.js 16 App Router (React 19, Tailwind 4)
packages/
  shared/   # Tipos TypeScript, schemas Zod e constantes compartilhadas
```

---

## Topologia da API (Oficial: Baseada em Path)

A topologia pública oficial expõe a API sob um prefixo de rota:

```
https://seusite.com/api/*             →  Serviço Hono (proxy aplica StripPrefix /api)
https://seusite.com/*                 →  Aplicação Next.js
https://seusite.com/_internal/revalidate  →  ISR on-demand do Next.js (uso interno)
```

O backend Hono é montado na raiz internamente — serve rotas como `/posts`, `/auth/github/callback` e `/doc` diretamente. O proxy (Traefik/Dokploy) é responsável por capturar `/api/*`, remover o prefixo `/api` e encaminhar ao container `api` na porta 3000.

- URL pública: `https://seusite.com/api/posts`
- URL interna/SSR: `http://api:3000/posts` (via `API_INTERNAL_URL` — sem prefixo)

### Callback do OAuth

O GitHub OAuth App deve ser configurado com a URL de callback **pública**:

```
https://seusite.com/api/auth/github/callback
```

Após o proxy remover `/api`, o backend processa a requisição em `/auth/github/callback`.

### Configuração do proxy (Traefik/Dokploy)

```yaml
# Serviço web (Next.js)
- "traefik.http.routers.web.rule=Host(`seusite.com`)"
- "traefik.http.services.web.loadbalancer.server.port=3001"

# Serviço api (Hono) — captura /api/* e remove o prefixo
- "traefik.http.routers.api.rule=Host(`seusite.com`) && PathPrefix(`/api`)"
- "traefik.http.routers.api.middlewares=strip-api-prefix"
- "traefik.http.middlewares.strip-api-prefix.stripprefix.prefixes=/api"
- "traefik.http.services.api.loadbalancer.server.port=3000"

# Rotas internas do Next.js (/_internal) — prioridade elevada
- "traefik.http.routers.web-internal.rule=Host(`seusite.com`) && PathPrefix(`/_internal`)"
- "traefik.http.routers.web-internal.priority=10"
- "traefik.http.routers.web-internal.service=web"
```

> O serviço Hono **nunca vê o prefixo `/api`**. Fetches SSR via `API_INTERNAL_URL` vão direto para `http://api:3000` sem nenhum prefixo.

---

## Rotas da API

Todos os caminhos abaixo são **internos** (o que o Hono recebe após o proxy remover `/api`).

### Públicas

| Rota                | Descrição                                          |
| ------------------- | -------------------------------------------------- |
| `GET /health`       | Liveness check                                     |
| `GET /ready`        | Readiness check (DB + Redis + schema parity)       |
| `/posts`            | Posts do blog publicados                           |
| `/projects`         | Projetos publicados                                |
| `/tags`             | Tags em uso em posts/projetos                      |
| `/comments`         | Envio de comentários anônimos                      |
| `/contact`          | Envio de formulário de contato                     |
| `/developer`        | Dados do perfil (bio, disponibilidade)             |
| `/experience`       | Experiências profissionais                         |
| `/education`        | Formação acadêmica                                 |
| `GET /feed.xml`     | RSS 2.0 (posts publicados)                         |
| `GET /sitemap.xml`  | Sitemap XML (rotas públicas + slugs publicados)    |
| `GET /doc`          | Swagger UI (documentação interativa da API)        |
| `GET /doc/spec`     | Spec OpenAPI 3.1 (JSON)                            |

### Autenticação

| Rota                         | Descrição                                    |
| ---------------------------- | -------------------------------------------- |
| `POST /auth/github/start`    | Inicia o fluxo OAuth com GitHub              |
| `GET /auth/github/callback`  | Callback OAuth — emite JWT + cookie CSRF     |
| `POST /auth/logout`          | Limpa os cookies de sessão                   |

### Admin (JWT + CSRF obrigatórios)

Todas as rotas admin têm o prefixo `/admin`. GETs de detalhe usam `:slug`; PATCH/DELETE usam `:id`.

| Domínio de rota           | Descrição                                        |
| ------------------------- | ------------------------------------------------ |
| `/admin/posts`            | CMS — posts do blog                              |
| `/admin/projects`         | CMS — projetos                                   |
| `/admin/tags`             | Gerenciamento de tags                            |
| `/admin/experience`       | Experiências profissionais                       |
| `/admin/education`        | Formação acadêmica                               |
| `/admin/comments`         | Moderação de comentários (aprovar/rejeitar)      |
| `/admin/contacts`         | Gerenciamento de mensagens de contato            |
| `/admin/uploads`          | Upload via presigned URL + pipeline de confirmação |
| `/admin/analytics`        | Resumo de pageviews + top posts                  |
| `/admin/jobs`             | Endpoints operacionais de jobs                   |
| `/admin/jobs/dlq`         | Contagem de filas DLQ                            |

### Next.js interno (apenas serviço web)

| Rota                           | Descrição                                         |
| ------------------------------ | ------------------------------------------------- |
| `POST /_internal/revalidate`   | Revalidação ISR on-demand por tag (secret obrigatório) |

---

## Como Começar

### Pré-requisitos

- [Bun](https://bun.sh) ≥ 1.0
- [Docker](https://www.docker.com) + Docker Compose

### Setup Local

O arquivo `.env` na raiz do repositório é a **única fonte de verdade** local para todos os comandos (`bun run dev`, `bun run db:*`, API, worker e web). Não duplique variáveis em `.env` por app.

```bash
# 1. Instalar dependências
bun install

# 2. Copiar e preencher variáveis de ambiente
cp .env.example .env
# Edite .env com seus valores

# 3. Subir serviços de infra (PostgreSQL, Redis, MinIO)
docker compose -f docker-compose.dev.yml up -d

# 4. Aplicar migrações do banco
bun run db:migrate

# 5. Popular com dados de exemplo
bun run db:seed
```

PowerShell (Windows):

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun run db:migrate
bun run db:seed
```

### Servidores de Desenvolvimento

```bash
# Inicia todos os processos (requer infra Docker rodando via docker-compose.dev.yml)
bun run dev

# Individualmente
bun run dev:api      # API em http://localhost:3000
bun run dev:worker   # Worker em background
bun run dev:web      # Web em http://localhost:3001
```

---

## Scripts Disponíveis

| Script                         | Descrição                                          |
| ------------------------------ | -------------------------------------------------- |
| `bun run dev`                  | Inicia todos os processos (api + worker + web)     |
| `bun run dev:api`              | API em modo watch                                  |
| `bun run dev:worker`           | Worker em modo watch                               |
| `bun run dev:web`              | Servidor de desenvolvimento Next.js                |
| `bun run db:migrate`           | Aplica migrações do Drizzle                        |
| `bun run db:seed`              | Popula o banco com dados de exemplo                |
| `bun run db:audit:schema`      | Verifica paridade de schema (exit 1 se objetos ausentes) |
| `bun run db:backfill:comments` | Re-renderiza comentários legados para HTML sanitizado |
| `bun run db:generate`          | Gera novas migrações a partir de mudanças no schema |
| `bun run db:studio`            | Abre o Drizzle Studio (GUI do banco)               |
| `bun run lint`                 | Executa o linter Biome                             |
| `bun run format`               | Formata o código com Biome                         |
| `bun run check`                | Lint + format com auto-fix                         |
| `bun run test`                 | Executa todos os testes do workspace               |
| `bun run test:services`        | Sobe a infraestrutura de teste isolada             |

> Use sempre `bun run test`, nunca `bun test` diretamente. O monorepo depende de configurações per-workspace do Vitest (`jsdom`, setup files, aliases de módulo). Executar o test runner nativo do Bun diretamente gera falhas enganosas como `document is not defined`.

> Sempre gere migrações com `bun run db:generate` a partir da raiz do repositório.

> **Reparo legado:** em bancos existentes, execute `bun run db:backfill:comments` **antes** de `bun run db:migrate`. A migração falha rápido quando `comments.rendered_content` ainda é nulo.

---

## Variáveis de Ambiente (Web)

Para `apps/web`, as variáveis são divididas entre build-time e runtime:

**Build-time** (`docker/web.Dockerfile` ARG/ENV):
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `NEXT_PUBLIC_S3_PUBLIC_DOMAIN`

**Runtime** (`docker-compose.yml` serviço web):
- `REVALIDATE_SECRET`
- `API_INTERNAL_URL` (recomendado no Docker: `http://api:3000`)

Chamadas server-side resolvem a URL base com a seguinte precedência:
1. `API_INTERNAL_URL` (rede interna, preferencial)
2. `NEXT_PUBLIC_API_URL` (fallback público)

### Flags opcionais de ambiente local

- `RATE_LIMIT_LOCAL_FALLBACK=true` — mantém o rate limiting disponível quando o Redis está indisponível usando um fallback in-memory por processo. **Seguro apenas em instância única.** Em produção com múltiplas réplicas, use `false` para que a falha do Redis retorne `503`.
- **Estado OAuth:** quando o Redis está indisponível, tokens de state do OAuth caem para uma store in-memory local. Seguro apenas em instância única; em múltiplas réplicas um callback roteado para outra réplica falhará com erro de state inválido.

---

## Verificação de Paridade de Schema

A paridade de schema verifica se os objetos críticos do banco de dados existem após a execução das migrações. Esse check é executado automaticamente no startup da API e no probe `/ready`, mas também pode ser disparado manualmente.

### Audit manual (local/CI)

```bash
# A partir da raiz do repositório:
bun --env-file .env run apps/api/src/db/audit-schema-parity.ts
# Saída: ✅ Schema parity OK (exit 0)
# Ou: ❌ Schema parity FAILED — lista de objetos ausentes (exit 1)
```

Objetos verificados:
- `table:experience_tags` — pivô entre experience e tags
- `column:tags.is_highlighted` — coluna de destaque de tags

### Checklist de verificação pós-deploy

Execute essa sequência ao investigar falhas de startup ou readiness no ambiente de destino:

```sql
-- 1. Confirme o histórico de migrações aplicadas
SELECT * FROM __drizzle_migrations ORDER BY created_at DESC;

-- 2. Verifique se a tabela experience_tags existe
SELECT to_regclass('public.experience_tags') AS experience_tags_table;

-- 3. Liste as colunas da tabela tags
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tags'
ORDER BY ordinal_position;

-- 4. Confirme que as tags referenciadas em falhas existem
-- (substitua os IDs pelos da requisição com problema)
SELECT id, name, slug FROM tags WHERE id IN (1, 5, 9, 13, 15);
```

### Quando `/ready` retorna 503 com `db-schema`

Significa que o banco é alcançável mas um ou mais objetos obrigatórios estão ausentes. Passos de remediação:

1. Confirme que o container está usando a imagem correta (tag/commit SHA)
2. Confirme que `DATABASE_URL` aponta para o banco de destino pretendido
3. Execute as migrações manualmente: `bun run db:migrate`
4. Rode o audit de paridade: `bun --env-file .env run apps/api/src/db/audit-schema-parity.ts`
5. Se o audit ainda falhar após as migrações, investigue `__drizzle_migrations` — pode haver uma entrada de migração faltando ou que não foi aplicada com sucesso

### Erros de tagIds em endpoints admin

Se `POST /admin/experience`, `POST /admin/posts` ou `POST /admin/projects` retornar `400 VALIDATION_ERROR` com `field: tagIds`, significa que um ou mais IDs submetidos não existem na tabela `tags`. Isso é comportamento correto — substitui a falha opaca `500` que ocorria anteriormente.

Para diagnosticar:
```sql
-- Verifique se os IDs existem (substitua pelos IDs do erro)
SELECT id, name FROM tags WHERE id IN (<ids_do_cliente>);
```

---

## Verificação de Deploy (Checklist de Paridade de Rotas)

Para confirmar se o artefato do Next.js contém as rotas admin esperadas, use o manifesto gerado pelo próprio build e, opcionalmente, um probe HTTP contra o standalone já em execução.

```text
Arquivo do manifesto: apps/web/.next/app-path-routes-manifest.json
Entradas mínimas esperadas: /admin/uploads, /admin/posts, /admin/projects, /admin/experience
```

```bash
# Com o standalone já rodando localmente:
curl -I http://localhost:3001/admin/uploads
# Aceitável: 200 OK ou redirecionamento para /admin/login
# Falha: 404 da aplicação ou qualquer resposta 5xx
```

O `build` de `apps/web` gera o manifesto usado nessa checagem. O probe HTTP é complementar para validar o artefato em runtime. Como `/admin/uploads` é protegido, um probe sem sessão pode terminar em `/admin/login`; isso é aceitável desde que a resposta não seja a 404 customizada.

### Checklist de paridade de rotas em produção

Quando uma rota admin retorna a página 404 customizada em produção mas funciona localmente, siga esta sequência antes de investigar o código-fonte:

1. **Confirme o artefato:** a imagem/tag ou commit SHA em produção corresponde ao build mais recente?
2. **Verifique a rota no container:** dentro do container web (antes do proxy), acesse `http://localhost:3001/admin/uploads` diretamente — se retornar 404, o artefato está faltando a rota; se retornar 200, o problema está no proxy.
3. **Valide o manifesto do build:** confira `apps/web/.next/app-path-routes-manifest.json` e confirme que a rota esperada aparece no artefato gerado pelo Next.js.
4. **Valide as regras do proxy:** a configuração do Traefik/Dokploy que roteia `/admin/*` não está sombreando ou reescrevendo incorretamente? A configuração do proxy é **externa ao repositório** e precisa ser validada separadamente quando fonte e produção divergem.
5. **Compare interno vs. público:** `http://web:3001/admin/uploads` (interno) vs. `https://seusite.com/admin/uploads` (público) — se o interno funciona e o público não, é um problema do proxy.

---

## Endpoints de Saúde

| Endpoint        | Descrição                              |
| --------------- | -------------------------------------- |
| `GET /health`   | Liveness — processo está no ar         |
| `GET /ready`    | Readiness — DB + Redis + paridade de schema |
| `GET /doc`      | Swagger UI (documentação interativa)   |
| `GET /doc/spec` | Spec OpenAPI 3.1 (JSON)                |

> `/doc` e `/doc/*` usam uma exceção de CSP escopada por rota (o Swagger UI exige assets inline e `cdn.jsdelivr.net`). A CSP global mais restrita permanece ativa em todas as demais rotas.

---

## Licença

MIT License — veja [LICENSE](LICENSE) para detalhes.
