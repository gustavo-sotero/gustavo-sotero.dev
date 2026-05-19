export const PORTFOLIO_PROJECT = {
  slug: 'gustavo-sotero-dev',
  coverImage: 'projects/portfolio.png',
  title: 'Portfolio - gustavo-sotero.dev',
  description:
    'Portfólio pessoal fullstack backend-centric: API Hono, Next.js 16 App Router, BullMQ, outbox transacional, uploads S3, geração de posts com IA e admin autenticado via GitHub OAuth.',
  content: `
# gustavo-sotero.dev — Portfólio Fullstack Backend-Centric

Projeto de portfólio pessoal construído como **prova de conceito técnica** — não apenas uma vitrine, mas uma plataforma real com filas, cache, segurança, moderação, uploads diretos, otimização de imagens, analytics e geração de conteúdo com IA.

---

## Visão Geral

O **gustavo-sotero.dev** apresenta projetos, posts técnicos, experiência e educação profissional. A superfície pública é um site estático-first com SSR seletivo; por baixo funciona um sistema completo com painel admin autenticado, pipeline de posts com revisão e agendamento, geração de rascunhos por IA, uploads diretos ao S3, e jobs assíncronos gerenciados por BullMQ.

O objetivo do projeto foi demonstrar engenharia de produto real em ambiente de portfolio: fronteiras de domínio claras, padrões de resiliência aplicados (outbox, idempotência, fallbacks), segurança sem overengineering, e observabilidade estruturada do primeiro ao último log.

---

## Stack Tecnológica

| Camada | Tecnologia | Observações |
|---|---|---|
| Runtime | **Bun 1.x+** | Usado em todos os apps — API, Worker e build do Web |
| Frontend | **Next.js 16 App Router** | RSC, React Compiler, CacheComponents, Turbopack em dev, standalone build |
| UI | **React 19 + Tailwind CSS 4 + shadcn/ui** | Componentes acessíveis, Radix UI primitives |
| API | **Hono** | Feature-based routing, middlewares tipados, OpenAPI docs via Swagger UI |
| Worker | **BullMQ + ioredis** | Jobs assíncronos com DLQ, concurrency por queue, outbox relay |
| Banco | **PostgreSQL 17 + Drizzle ORM** | Schema em \`packages/shared\`, migrações em \`drizzle/\`, driver \`postgres\` |
| Cache / Filas | **Redis 8 + ioredis** | Rate limiting, cache de serviço, pub/sub de invalidação |
| Armazenamento | **S3-compatível** | Bun native S3 API; MinIO local, Cloudflare R2 em produção |
| Auth | **GitHub OAuth + JWT** | JWT em cookie httpOnly; admin derivado de \`ADMIN_GITHUB_ID\` |
| IA | **OpenRouter + Vercel AI SDK** | Geração estruturada de topics e drafts; feature-gated |
| Notificações | **Telegram Bot API** | Alertas assíncronos via worker |
| Markdown | **remark + rehype + Shiki** | Pipeline server-side com syntax highlighting, GFM, sanitização |
| Captcha | **Cloudflare Turnstile** | Formulário de contato público |
| Observabilidade | **LogTape** | Logs estruturados por categoria; sink em arquivo + console |
| Lint / Format | **Biome** | Substitui ESLint + Prettier numa ferramenta única |
| Testes | **Vitest** | Unitários e de integração em todos os apps |
| Monorepo | **Bun Workspaces** | Build, dev e test unificados; sem Turborepo |
| Containers | **Docker multi-stage** | Usuário non-root, health checks, bun slim |
| CI/CD | **GitHub Actions + Dokploy** | Lint, type-check, testes, build; deploy via Dokploy + Traefik v3 |

---

## Arquitetura

### Estrutura do Monorepo

\`\`\`
apps/
  api/      # REST API — Hono (Bun)
  worker/   # Jobs assíncronos — BullMQ (Bun)
  web/      # Frontend — Next.js 16 App Router (React 19)
packages/
  shared/   # Schema Drizzle, schemas Zod, tipos e utilitários cross-runtime
\`\`\`

\`\`\`mermaid
graph TD
    Web["apps/web\nNext.js 16"] -->|HTTP + ISR revalidation| API["apps/api\nHono"]
    Web --> Shared["packages/shared\n@portfolio/shared"]
    API --> Shared
    Worker["apps/worker\nBullMQ"] --> Shared
    Shared --- PG[(PostgreSQL 17)]
    API --> Redis[(Redis 8)]
    API --> S3[(S3-compatível)]
    Worker --> Redis
    Worker --> PG
    Worker --> S3

    style Shared fill:#1d3557,color:#fff
    style PG fill:#336791,color:#fff
    style Redis fill:#dc143c,color:#fff
    style S3 fill:#ff9900,color:#000
\`\`\`

### Topologia de Rede (Produção)

\`\`\`
https://gustavo-sotero.dev/api/*   →  Traefik StripPrefix /api  →  apps/api  :3000
https://gustavo-sotero.dev/*       →  apps/web  :3001
https://gustavo-sotero.dev/_internal/revalidate  →  Next.js ISR on-demand
\`\`\`

A API Hono é montada na raiz internamente e serve rotas como \`/posts\`, \`/auth/github/callback\` e \`/doc\` diretamente. O proxy Traefik captura \`/api/*\`, remove o prefixo, e encaminha ao container \`api\`. O frontend Next.js acessa o backend via \`API_INTERNAL_URL\` (sem prefixo, container-to-container) no SSR e via \`NEXT_PUBLIC_API_URL\` no cliente.

**Dev local:** Next.js \`rewrites\` em \`next.config.ts\` emulam o StripPrefix mantendo tudo same-origin. Os três processos sobem via \`concurrently\` a partir da raiz.

---

## API (\`apps/api\`)

### Middlewares Globais (ordem importa)

| Ordem | Middleware | Responsabilidade |
|---|---|---|
| 1 | \`bodyLimit\` | Rejeita payloads acima de \`BODY_SIZE_LIMIT\` bytes (413) |
| 2 | \`requestId\` | Injeta \`X-Request-Id\` em todas as respostas |
| 3 | \`cors\` | Same-origin permitido; headers preflight para mutações admin |
| 4 | \`secureHeaders\` | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| 5 | \`analyticsMiddleware\` | Fire-and-forget — enfileira evento de analytics pós-resposta |
| 6 | \`cacheControlMiddleware\` | S-maxage por tipo de rota (detail 3600s / listing 300s / admin no-store) |
| 7 | \`honoLogger\` | HTTP logging estruturado via \`@logtape/hono\` |

### Rotas Públicas

| Rota | Descrição |
|---|---|
| \`GET /home\` | **Agregado**: todas as seções da home em um único round-trip |
| \`GET /posts\` | Listagem paginada (windowed) de posts publicados, com filtro por tag |
| \`GET /posts/:slug\` | Detalhe do post com preview de comentários |
| \`GET /posts/:slug/comments\` | Comentários aprovados paginados |
| \`GET /projects\` | Listagem de projetos |
| \`GET /projects/:slug\` | Detalhe do projeto |
| \`GET /skills\` | Catálogo de skills |
| \`GET /tags\` | Tags do blog |
| \`GET /experience\` | Histórico profissional |
| \`GET /education\` | Formação acadêmica |
| \`GET /developer/profile\` | Perfil completo do desenvolvedor (pretty-printed JSON) |
| \`POST /contact\` | Formulário de contato (Turnstile verificado) |
| \`POST /comments\` | Envio de comentário em post |
| \`GET /feed.xml\` | Feed RSS dos posts |
| \`GET /sitemap.xml\` | Sitemap XML dinâmico |
| \`GET /health\`, \`GET /ready\` | Health checks |
| \`GET /doc\`, \`GET /doc/spec\` | OpenAPI Swagger UI |

### Rotas Admin (protegidas por \`authAdmin\` + CSRF)

| Rota | Descrição |
|---|---|
| \`POST /auth/github\`, \`GET /auth/github/callback\` | GitHub OAuth flow |
| \`GET /auth/me\`, \`POST /auth/logout\` | Sessão e logout |
| \`GET /admin/analytics\` | Dashboard de analytics de acessos |
| \`CRUD /admin/posts\` | Gestão de posts (criar, editar, publicar, agendar) |
| \`CRUD /admin/projects\` | Gestão de projetos do portfólio |
| \`CRUD /admin/skills\` | Catálogo de skills |
| \`CRUD /admin/tags\` | Gestão de tags do blog |
| \`CRUD /admin/experience\` | Histórico profissional |
| \`CRUD /admin/education\` | Formação acadêmica |
| \`CRUD /admin/comments\` | Moderação de comentários |
| \`GET /admin/contacts\` | Submissões do formulário de contato |
| \`GET|POST /admin/uploads/presign\`, \`POST /admin/uploads/:id/confirm\` | Upload direto S3 |
| \`GET|PUT /admin/posts/generate/config\` | Configuração de modelos de IA |
| \`GET /admin/posts/generate/models\` | Listagem de modelos OpenRouter elegíveis |
| \`POST /admin/posts/generate/topics\` | Sugestões de tópico (síncrono, legacy) |
| \`POST /admin/posts/generate/topic-runs\` | Cria run assíncrono de sugestão → 202 |
| \`GET /admin/posts/generate/topic-runs/:id\` | Polling de run de sugestão |
| \`POST /admin/posts/generate/draft-runs\` | Cria run assíncrono de rascunho → 202 |
| \`GET /admin/posts/generate/draft-runs/:id\` | Polling de run de rascunho |

### Home Aggregate Endpoint

\`GET /home\` resolve **6 serviços em paralelo** com \`Promise.all\` e retorna tudo em uma única resposta — eliminando N=7 round-trips separados que o SSR do Next.js precisaria fazer:

\`\`\`mermaid
flowchart TD
    A["GET /home"] --> B["Promise.all (6 serviços)"]
    B --> C1["listPosts (top 3)"]
    B --> C2["listProjects (featured first)"]
    B --> C3["listSkills (até 100)"]
    B --> C4["listTags (post tags)"]
    B --> C5["listExperience"]
    B --> C6["listEducation"]
    C1 & C2 & C3 & C4 & C5 & C6 --> D["{ posts, projects, skills, blogTags, experience, education }"]
    D --> E["200 OK — uma única requisição SSR"]
\`\`\`

---

## Worker (\`apps/worker\`)

### Jobs BullMQ

| Queue | Concurrency | Responsabilidade |
|---|---|---|
| \`telegram-notifications\` | 2 | Envia notificações via Telegram Bot API; DLQ com 5 tentativas |
| \`analytics-events\` | 10 | Persiste eventos de acesso (path, IP hash, user-agent, país) |
| \`image-optimize\` | 2 | Otimiza imagens uploaded com Bun.Image (JPEG/PNG/WebP) e sharp (GIF); DLQ com 3 tentativas |
| \`post-publish\` | 5 | Publica posts agendados no timestamp correto |
| \`data-retention\` | 1 | Cleanup periódico de dados expirados |
| \`ai-post-draft-generation\` | 2 | Geração assíncrona de rascunhos com IA (OpenRouter) |
| \`ai-post-topic-generation\` | 2 | Geração assíncrona de sugestões de tópico com IA |

### Transactional Outbox

Eventos que precisam de garantias de entrega (image-optimize, post-publish, ai-draft, ai-topic) são escritos na tabela \`outbox\` **dentro da mesma transação** que persiste a entidade principal. O outbox relay no worker faz polling periódico, publica no BullMQ com **job IDs determinísticos** (idempotentes), e marca o registro como processado.

\`\`\`mermaid
sequenceDiagram
    participant API as API (Hono)
    participant DB as PostgreSQL
    participant Relay as Outbox Relay (Worker)
    participant BullMQ as BullMQ

    API->>DB: BEGIN TX
    API->>DB: INSERT entity (upload, post, ai-run...)
    API->>DB: INSERT outbox (eventType, payload)
    API->>DB: COMMIT TX
    Note over API,DB: Entidade + outbox atomicamente

    loop polling periódico
        Relay->>DB: SELECT outbox WHERE status=pending ORDER BY created_at ASC LIMIT 50
        Relay->>BullMQ: queue.add(jobId=deterministic) — idempotente
        Relay->>DB: UPDATE outbox SET status=processed
    end
    Note over Relay,BullMQ: job ID colisão = BullMQ descarta silenciosamente (dedup)
\`\`\`

**Falhas de relay classificadas:** \`UNSUPPORTED_EVENT_TYPE\` · \`INVALID_PAYLOAD\` · \`QUEUE_PUBLISH_FAILURE\` · \`OUTBOX_STATUS_UPDATE_FAILURE\`. Cada classe tem log estruturado e caminho de retry distinto. Máximo de 5 tentativas por evento (\`OUTBOX_MAX_ATTEMPTS\`).

---

## Geração de Posts com IA

Integra **OpenRouter** via Vercel AI SDK para geração estruturada de sugestões de tópico e rascunhos completos de posts técnicos.

**Fluxo assíncrono (202 + polling):**

\`\`\`mermaid
flowchart TD
    A["POST /admin/posts/generate/draft-runs"] --> B["Insere draft_run (status=pending)"]
    B --> C["Escreve outbox event"]
    C --> D["202 Accepted { runId }"]
    D -.->|"poll"| E["GET /admin/posts/generate/draft-runs/:id"]
    E --> F{"status?"}
    F -->|pending/running| G["200 { status: running }"]
    F -->|completed| H["200 { status: completed, draft }"]
    F -->|failed| I["200 { status: failed, error }"]
    B -->|"outbox relay"| Worker["Worker: ai-post-draft-generation job"]
    Worker -->|"OpenRouter structured output"| J["UPDATE draft_run (completed/failed)"]
\`\`\`

- Feature-gated via \`AI_POSTS_ENABLED\` (retorna 503 quando desligado)
- Rate limiting: 10 req/min para topics, 5 req/min para drafts
- Timeout configurável via \`AI_POSTS_TIMEOUT_MS\`
- Normalização de request: trunca briefing, limita sugestões, deduplica tags
- Modelo configurável por tipo (topic model / draft model) com roteamento OpenRouter

---

## Upload de Imagens

Uploads seguem o padrão **presign → upload direto ao S3 → confirm → outbox → worker**.

\`\`\`mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    participant S3 as S3 / R2
    participant DB as PostgreSQL
    participant W as Worker (Bun.Image / sharp)

    B->>A: POST /admin/uploads/presign (mime, size, filename)
    A->>DB: INSERT uploads status=pending
    A->>S3: generate presigned PUT URL (TTL 15min)
    A-->>B: { uploadId, presignedUrl }

    B->>S3: PUT presignedUrl (binary — sem passar pela API)
    B->>A: POST /admin/uploads/:id/confirm

    A->>DB: UPDATE uploads SET status=uploaded
    A->>DB: INSERT outbox (IMAGE_OPTIMIZE_REQUESTED, {uploadId})
    A-->>B: { status: uploaded }

    Note over A,DB: outbox relay → BullMQ

    W->>S3: GET original
    W->>W: Bun.Image (JPEG/PNG/WebP) ou sharp (GIF) — resize, variants
    W->>S3: PUT optimized variants
    W->>DB: UPDATE uploads SET status=processed, optimizedUrl, variants
\`\`\`

Payload binário nunca trafega pela API — reduz bandwidth e latência. O estado do upload é consultável via \`GET /admin/uploads/:id\` para polling de otimização.

---

## Frontend (\`apps/web\`)

### Rotas Públicas

| Grupo | Rotas |
|---|---|
| \`(home)\` | Página principal (hero, posts recentes, projetos, skills, experiência, educação) |
| \`(blog)\` | Lista de posts + post detail com comentários |
| \`(projects)\` | Galeria de projetos + detail |
| \`(resume)\` | Currículo como PDF gerado no cliente via \`@react-pdf/renderer\` |
| \`(contact)\` | Formulário com Cloudflare Turnstile |
| \`(recruiters)\` | Página de referência para recrutadores |

### Admin (Route Group \`(admin)/admin\`)

| Seção | Funcionalidade |
|---|---|
| Login | GitHub OAuth (cookie httpOnly pós-redirect) |
| Posts | CRUD + publish/draft + agendamento + geração IA (topics + draft) |
| Projects | CRUD de projetos do portfólio |
| Skills | Gerenciar catálogo de skills |
| Tags | Gerenciar tags do blog |
| Experience | Timeline profissional |
| Education | Formação acadêmica |
| Analytics | Dashboard de pageviews e endpoints mais acessados |
| Uploads | Upload direto ao S3 + polling de otimização |
| Comments | Aprovação / rejeição de comentários |
| Contacts | Visualização de submissões de contato |

**Next.js CacheComponents:** componentes do servidor cacheados por rota para reduzir rendering repetitivo no SSR.  
**React Compiler:** memoização automática — sem \`useMemo\` / \`useCallback\` manuais desnecessários.  
**Output standalone:** build gera bundle self-contained para deploy em container.

---

## Banco de Dados

Schema Drizzle em \`packages/shared/src/db/schema/\`. Migrações em \`drizzle/\` — nunca editadas manualmente após commit.

| Tabela | Descrição |
|---|---|
| \`posts\` | Slug, título, content markdown, rendered_content HTML, status, scheduled_at |
| \`projects\` | Slug, title, description, content, cover_url, impact_facts[], featured, order |
| \`skills\` | Slug, name, category, expertise_level, is_highlighted |
| \`tags\` | Slug, name, category, icon_key, is_highlighted |
| \`experience\` | Empresa, cargo, período, description, status |
| \`education\` | Instituição, curso, período, status |
| \`comments\` | Post FK, author, email (hashed), body, status (pending / approved / rejected) |
| \`contacts\` | Nome, email, mensagem, timestamp |
| \`uploads\` | storage_key, status (pending / uploaded / processed / failed), optimized_url, variants JSONB |
| \`analytics\` | Path, method, status_code, ip_hash, user_agent, country, timestamp |
| \`outbox\` | event_type, payload JSONB, status (pending / processed / failed), attempts, created_at |
| \`ai_post_generation_settings\` | Model pairs (topic + draft), routing config |
| \`ai_post_generation_topic_runs\` | Run assíncrono de sugestão — status, resultado, error |
| \`ai_post_generation_draft_runs\` | Run assíncrono de rascunho — status, resultado, error |

---

## Estratégia de Cache

| Camada | Mecanismo | TTL |
|---|---|---|
| CDN / proxy | \`Cache-Control: public, s-maxage\` | 3600s detail · 300s listing |
| Stale-while-revalidate | \`stale-while-revalidate\` header | 300s detail · 60s listing |
| Serviço (Redis) | Cache por query key no service layer | Por domínio (posts: 5min, skills: 30min...) |
| RSC | Next.js \`cacheComponents\` | Automático por rota |
| Admin | \`no-store, private\` | Sem cache (dados auth-gated) |

---

## Segurança

| Mecanismo | Implementação |
|---|---|
| Autenticação admin | JWT HS256 em cookie \`httpOnly\`; \`sub\` validado contra \`ADMIN_GITHUB_ID\` |
| CSRF | Double Submit Cookie — \`csrf_token\` cookie vs. \`X-CSRF-Token\` header; \`timingSafeEqual\` em constant time |
| IP | Hash SHA-256 com \`IP_HASH_SALT\` — raw IP nunca persiste em banco nem logs |
| Rate Limiting | Sliding window Redis + fallback local em memória (80% cap); por IP hashed |
| Captcha | Cloudflare Turnstile em \`/contact\` (server-side verify) |
| Security Headers | \`hono/secure-headers\` — CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| Autoridade admin | Role derivado de \`ADMIN_GITHUB_ID\` em runtime — nenhum campo mutável no banco |
| Markdown | Pipeline rehype-sanitize — HTML arbitrário do autor não escapa para o DOM |
| Segredos de boot | Variáveis críticas validadas com Zod no startup; processo encerra em caso de variável ausente ou inválida |

---

## Observabilidade

Logs estruturados via **LogTape** com categorias hierárquicas (\`portfolio:api:http\`, \`portfolio:api:auth\`, \`portfolio:worker:relay\`, etc.). Sink em arquivo rotacionado (\`@logtape/file\`) + console em dev.

Eventos com identidade estável:

\`\`\`
analytics.event.enqueued     upload.presign.created     upload.confirmed
outbox.relay.processed       outbox.relay.failed        worker.job.completed
ai.draft.started             ai.draft.completed         ai.draft.failed
\`\`\`

HTTP logging via \`@logtape/hono\` com \`X-Request-Id\` correlacionado em todas as respostas.

---

## CI/CD e Deploy

\`\`\`mermaid
flowchart TD
    Push["git push → main"] --> CI["GitHub Actions\nlint · type-check · build\ntest (api + worker + web + shared)"]
    CI -->|"CI verde"| Dokploy["Dokploy\nrastreia branch main"]
    CI -->|"falhou"| Stop["🚫 sem deploy"]
    Dokploy --> Compose["docker-compose.yml\nbuild multi-stage\napi · worker · web"]
    Compose --> Traefik["Traefik v3\nStripPrefix /api\nHTTPS automático"]
    Traefik --> Live["✅ produção\ngustavo-sotero.dev"]
\`\`\`

- Build multi-stage Docker: \`deps → build → runtime\` (usuário non-root \`appuser\`)
- API health check: \`curl -sf http://localhost:3000/ready\`
- Worker depends_on: \`api:condition:service_healthy\`
- Rollback: apontar Dokploy para um commit/build anterior

---

## Trade-offs e Decisões de Design

### Home aggregate vs. N endpoints separados

**Decisão:** \`GET /home\` resolve todos os dados da página principal em um único round-trip com \`Promise.all\`.  
**Trade-off:** Endpoint acoplado à estrutura da home page vs. eliminação de N=7 requisições sequenciais no SSR. Para um portfólio com homepage bem definida, o ganho de latência justifica o coupling.

### Outbox vs. publish direto na fila

**Decisão:** Eventos críticos (upload-optimize, post-publish, ai-runs) passam pelo padrão outbox transacional.  
**Trade-off:** Complexidade de polling e relay vs. garantia de entrega exata-uma-vez. Sem outbox, um crash entre o INSERT da entidade e o \`queue.add()\` deixa o job nunca enfileirado sem possibilidade de recuperação.

### AI generation async (202 + polling) vs. síncrono

**Decisão:** Runs de IA retornam 202 imediatamente; cliente faz polling de status.  
**Trade-off:** UX mais complexa no frontend vs. desacoplamento total da latência do LLM (até 30s+) do ciclo de request/response HTTP. Timeouts de proxy e conexões do browser deixam de ser um problema.

### Admin auth: GitHub OAuth + JWT cookie vs. Better-Auth

**Decisão:** OAuth flow manual com JWT HS256 em cookie httpOnly, \`sub\` comparado contra \`ADMIN_GITHUB_ID\`.  
**Trade-off:** Solução mais simples e sem dependência de biblioteca de auth vs. menos features (sem refresh token automático, sem multi-session). Para portfólio single-operator, a simplicidade vence.

### Bun como runtime único + ioredis (não Bun.RedisClient)

**Decisão:** API e Worker rodam em Bun, mas usam \`ioredis\` para Redis (não a API nativa do Bun).  
**Trade-off:** Compatibilidade com BullMQ (que exige ioredis) força a escolha — \`Bun.RedisClient\` não implementa a interface ioredis que BullMQ usa internamente.

### Schema Drizzle em \`packages/shared\`

**Decisão:** O schema Drizzle vive em \`packages/shared\`, acessível por API e Worker.  
**Trade-off:** Única fonte de verdade para tipos de DB e facilita queries em ambos os apps vs. coupling mais forte do pacote shared à infraestrutura de banco. O config do drizzle-kit fica em \`apps/api\` (único lugar que roda migrations) para manter a separação operacional.

### Rate limit com fallback em memória

**Decisão:** Se Redis estiver indisponível, o rate limiter cai para um store em memória com 80% do threshold Redis.  
**Trade-off:** Counters não compartilhados entre réplicas (single instance em v1 — sem impacto prático) vs. API nunca fica completamente sem proteção de rate limit durante uma queda de Redis.

### Uploads presignados diretos ao S3

**Decisão:** Browser envia o binário diretamente ao S3 via URL presignada; API apenas gerencia estado.  
**Trade-off:** Zero payload binário pela API (elimina bottleneck de bandwidth e timeout) vs. ligeiro aumento de complexidade no fluxo (presign → upload externo → confirm → outbox).

### Markdown renderizado no servidor

**Decisão:** Pipeline remark → rehype → Shiki gera HTML no servidor; frontend recebe HTML sanitizado pronto.  
**Trade-off:** HTML armazenado em \`rendered_content\` duplica o dado vs. eliminação completa de re-rendering client-side e garantia de sanitização centralizada.

---

## Ambiente Local

\`\`\`sh
# Infraestrutura (PostgreSQL, Redis, MinIO)
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d

# Migrations + seed
bun run db:migrate
bun run db:seed

# Dev (api + worker + web em paralelo)
bun run dev
\`\`\`

Gate de qualidade:

\`\`\`sh
bun run lint        # Biome CI
bun run type-check  # tsc --noEmit em todos os apps
bun run test        # Vitest em api + worker + web + shared
bun run build       # Build completo (verifica erros de bundle)
\`\`\`

`,
  status: 'published' as const,
  repositoryUrl: 'https://github.com/gustavo-sotero/gustavo-sotero.dev',
  liveUrl: 'https://gustavo-sotero.dev',
  featured: true,
  order: 3,
  impactFacts: [
    'Home aggregate resolve 6 serviços em paralelo em um único round-trip, eliminando N=7 chamadas SSR separadas.',
    'Outbox transacional com job IDs determinísticos garante entrega idempotente de eventos para BullMQ sem perda em crash.',
    'Geração de posts com IA retorna 202 imediatamente e processa async, desacoplando latência do LLM do ciclo HTTP.',
    'Uploads diretos ao S3 via URL presignada eliminam binários trafegando pela API com fluxo confirm → outbox → Bun.Image para JPEG/PNG/WebP e sharp apenas para GIF.',
  ],
  skillSlugs: [
    'typescript',
    'javascript',
    'bun',
    'nextjs',
    'react',
    'hono',
    'tailwind',
    'postgresql',
    'redis',
    'drizzle',
    'bullmq',
    'docker',
    'docker-compose',
    'github-actions',
    'git',
    'github',
    'vps',
    'openapi',
    'vitest',
  ],
};
