export const URLFY_PROJECT = {
  slug: 'urlfy',
  coverImage: 'projects/urlfy.png',
  title: 'URLfy',
  description:
    'URL shortener self-hosted com redirect hot path no Next.js, API Elysia, analytics via Redis Streams e observabilidade com OpenTelemetry.',
  content: `
# urlfy.cc — Self-Hosted URL Shortener

Projeto de portfólio full-stack — pesquisa aplicada em Bun runtime, React 19, Next.js 16 App Router, ElysiaJS, e trade-offs operacionais reais em um produto de produção self-hosted.

---

## Visão Geral

O **urlfy.cc** é um serviço de encurtamento de URLs focado em performance, segurança e rastreabilidade. Suporta usuários anônimos (link rápido sem cadastro) e power users autenticados (alias personalizado, expiração, analytics granular, API programática). A administração é derivada de conta GitHub vinculada — sem role mutável no banco.

---

## Stack Tecnológica

| Camada | Tecnologia | Observações |
|---|---|---|
| Runtime | **Bun 1.x+** | APIs nativas: \`Bun.SQL\`, \`Bun.RedisClient\` (RESP3), \`bun:test\` |
| Frontend | **Next.js 16 App Router** | SSR, RSC, Edge proxy, \`next-intl\` i18n |
| API | **ElysiaJS 1.x** | Feature-based MVC (Controller/Service/Model + TypeBox) |
| Banco de Dados | **PostgreSQL 17+** | Drizzle ORM + Bun SQL, particionamento por mês |
| Cache / Filas | **Redis 8+** | \`Bun.RedisClient\`, Redis Streams, Sorted Sets |
| Auth | **Better-Auth** | OAuth (Google, GitHub), 2FA, API Keys |
| Geo | **MaxMind GeoLite2** | Resolução offline via jsDelivr, sem credenciais |
| Observabilidade | **Grafana LGTM + OTLP** | OpenTelemetry: logs, traces, métricas |
| Estilo | **Tailwind CSS + shadcn/ui** | |
| Monorepo | **Bun Workspaces + Turborepo** | Build incremental com grafo de dependências |
| E-mail | **React Email + Resend** | Templates tipados com React |
| Linting / Format | **Biome** | Substitui ESLint + Prettier numa ferramenta única |

---

## Arquitetura

### Topologia de Rede

\`\`\`mermaid
flowchart LR
    Browser -->|":3000"| Ingress["Traefik / nginx\nsame-origin"]
    Ingress -->|"/api/*"| API["apps/api\nElysiaJS :3001"]
    Ingress -->|"/r/:code"| Web["apps/web\nNext.js :3000"]
    Ingress -->|"/*"| Web
    Web -.-|"redirect-domain pkg\nzero HTTP hop"| Redis[("Redis 8")]
    Web -.-> PG[("PostgreSQL 17")]
    API --> Redis
    API --> PG
    Worker["apps/worker\nBun"] -->|"Redis Streams"| Redis
    Worker --> PG
\`\`\`

**Dev local:** \`next.config.ts\` rewrites mantêm tudo same-origin.  
**Produção (Dokploy):** Traefik roteia \`/api/*\` para \`apps/api\`; \`/r/:code\` permanece em \`apps/web\`.

---

### Estrutura do Monorepo

\`\`\`
apps/
  web/     Next.js 16 — páginas públicas, auth, dashboard, /r/[code]
  api/     ElysiaJS   — todos os endpoints /api/*
  worker/  Bun workers — analytics, agregação, cleanup, soft-delete
packages/
  contracts/       Contratos de API gerados (OpenAPI → TypeScript)
  redirect-domain/ Lógica cache-aside de resolução (sem acoplamento a framework)
  data/            Schema Drizzle + cliente Bun SQL
  cache/           Redis client, cache keys, circuit breaker, rate-limiter core
  telemetry/       Helpers OpenTelemetry, derivação canônica de IP
  auth-shared/     Primitivas Better-Auth, escopos
  email/           Templates React Email
  geoip/           Cliente MaxMind offline
  config-ts/       Presets base tsconfig
\`\`\`

#### Grafo de Dependências dos Pacotes

\`\`\`mermaid
graph TD
    Web["apps/web\nNext.js 16"] --> Contracts["@urlfy/contracts"]
    Web --> Cache["@urlfy/cache"]
    Web --> Telemetry["@urlfy/telemetry"]
    Web --> AuthShared["@urlfy/auth-shared"]
    Web --> RedirectDomain["@urlfy/redirect-domain"]
    API["apps/api\nElysiaJS"] --> Contracts
    API --> Cache
    API --> Telemetry
    API --> AuthShared
    API --> Data["@urlfy/data"]
    API --> GeoIP["@urlfy/geoip"]
    Worker["apps/worker\nBun"] --> Cache
    Worker --> Telemetry
    Worker --> Data
    Worker --> GeoIP
    RedirectDomain --> Cache
    RedirectDomain --> Data
\`\`\`

---

### Redirect Hot-Path

\`/r/[code]\` resolve **dentro de \`apps/web\`** via \`packages/redirect-domain\` — **zero round-trip HTTP** para \`apps/api\`.

\`\`\`mermaid
flowchart TD
    A["GET /r/:code"] --> B{"Redis hit?\nlink:{code}"}
    B -->|"HIT"| C["Valida link"]
    B -->|"MISS"| D["Acquire lock\nSETNX TTL 5s"]
    D --> E["Query PostgreSQL"]
    E --> F["Popula Redis cache\nTTL 1h"]
    F --> C
    C --> G{"isActive\n!banned\n!expired\nclicks < max\n!loop?"}
    G -->|"✓ válido"| H["Fire-and-forget\nRedis Stream"]
    H --> I["301 / 302\n+ X-Request-Id"]
    G -->|"inativo / expirado"| J["410 Gone"]
    G -->|"banido"| K["451 Unavailable"]
    G -->|"loop detectado"| L["421 Misdirected"]
\`\`\`

**Stampede protection:** SETNX com backoff de 50ms para waiters concorrentes no mesmo código.

---

### Event-Driven Analytics

Cada clique gera um evento no Redis Stream \`analytics:clicks\`. O \`analytics-click.worker\` consome, enriquece com GeoIP (país, cidade) + User-Agent parsing (browser, OS, device), e persiste em \`analytics_events\` (tabela particionada por mês). O \`aggregation-stream.worker\` agrega diariamente para \`link_clicks_daily\`.

\`\`\`mermaid
flowchart LR
    Click["Browser Click"] -->|"SHA-256(IP)\nimediato"| Stream["Redis Stream\nanalytics:clicks"]
    Stream --> W1["analytics-click.worker\nGeoIP + UA parse"]
    W1 --> Events[("analytics_events\npartitioned / month")]
    Events --> W2["aggregation-stream.worker\ncron diário"]
    W2 --> Daily[("link_clicks_daily")]
    W3["cleanup-stream.worker"] -->|"purge > 90 dias"| Events
\`\`\`

**IP nunca persiste em claro** — hash SHA-256 imediato na borda antes de qualquer escrita.

---

### Workers (Bun)

| Worker | Responsabilidade |
|---|---|
| \`analytics-click.worker\` | Consome eventos de clique, enriquece e persiste |
| \`aggregation-stream.worker\` | Agrega dados brutos em \`link_clicks_daily\` |
| \`cleanup-stream.worker\` | Expira links, limpa dados antigos (> 90 dias) |
| \`deletion-stream.worker\` | Executa soft-delete diferido e purge após 30 dias |

Todos os workers têm restart automático com backoff (5s delay, máx. 5 restarts consecutivos) e flush de telemetria no shutdown.

---

## Banco de Dados

### Tabelas Principais

| Tabela | Descrição |
|---|---|
| \`users\`, \`sessions\`, \`accounts\`, \`verifications\` | Better-Auth core |
| \`twoFactors\`, \`apikeys\` | Better-Auth plugins |
| \`links\` | \`short_code\` (unique), \`original_url\`, \`redirect_type\` (301/302), \`clicks_count\`, \`max_clicks\`, \`password_hash\`, \`expires_at\`, campos OG/UTM, soft delete (\`deleted_at\`) |
| \`analytics_events\` | Particionada por mês — \`visitor_hash\`, \`country\`, \`city\`, \`browser\`, \`os\`, \`device_type\`, \`referrer\`, \`is_bot\` |
| \`link_clicks_daily\` | Agregados diários pré-computados |
| \`deleted_links_audit\` | Audit trail para links deletados |
| \`banned_urls\` | Blacklist de URLs maliciosas |
| \`reserved_slugs\` | Slugs do sistema bloqueados para short codes |

**Índices relevantes:** \`short_code\` (unique B-tree), \`user_id + deleted_at\` (partial), \`expires_at\` (partial, cleanup), GIN \`pg_trgm\` em \`short_code + original_url\` (busca fuzzy admin), GIN em \`tags\`.

---

## Caching Strategy

| Key pattern | TTL | Propósito |
|---|---|---|
| \`link:{code}\` | 1h | Dados de redirect |
| \`link:meta:{code}\` | 5m | OG metadata |
| \`link:404:{code}\` | 5m | Negative cache |
| \`link:banned:{code}\` | 24h | Links banidos |
| \`qr:{code}:{size}:{fmt}\` | 24h | QR Codes gerados |
| \`rl:{key}\` | sliding | Rate limiting |
| \`lock:{code}\` | 5s | Distributed lock (stampede) |

**Graceful degradation:** circuit breaker em Redis — se Redis cair, o redirect recai para PostgreSQL direto, sem falha total do serviço.

---

## Rate Limiting

Sliding window via Redis Sorted Sets em três camadas não sobrepostas:

1. **API edge (\`/api/*\`):** limite global aplicado em \`onBeforeHandle\` do Elysia
2. **Redirect (\`/r/:code\`):** por-IP + por-link no redirect handler
3. **Link abuse guard:** por \`shortCode\`, exclusivo ao fluxo de redirect

Nenhuma requisição é cobrada duas vezes no mesmo path.

---

## Autenticação & Autorização

**Better-Auth** com plugins \`twoFactor\` e \`apiKey\`. Três métodos de acesso:

| Método | Credencial | Caso de uso |
|---|---|---|
| Session | Cookie \`session\` | Browser / frontend |
| Bearer | \`Authorization: Bearer <token>\` | Chamadas externas de API |
| API Key | \`x-api-key: urlfy_sk_...\` | Acesso programático |

**Autoridade admin** derivada de \`ADMIN_GITHUB_ACCOUNT_ID\` (conta GitHub vinculada) — **não existe role mutável no banco de dados**. Elevação requer reautenticação ativa (sessão elevada com claim separado).

---

## Segurança

| Mecanismo | Implementação |
|---|---|
| Derivação de IP | Helpers canônicos em \`@urlfy/telemetry\` (\`getClientIp\`, \`getClientIpFromHeaders\`); parsing direto de headers de proxy é **proibido e enforçado via CI** |
| Validação de URL | Formato, protocolo (\`http\`/\`https\`), blacklist de domínios, bloqueio de auto-encurtadores |
| Loop guard | Destino verificado para padrões de auto-encurtamento → HTTP 421 |
| IP anonymization | Hash SHA-256 imediato; raw IP jamais persiste |
| Runtime secrets guard | \`BETTER_AUTH_SECRET\` e outras vars críticas rejeitam valores placeholder no boot |
| SSRF protection | Blocklist CIDR-aware para ranges privados e loopback |
| Rate limiting | Sliding window Redis, 3 camadas |
| CSP / Security headers | Enforçados via middleware; validados por CI com scanner de headers |

---

## Observabilidade

**Stack:** Grafana LGTM (Loki + Grafana + Tempo + Prometheus) via OTLP HTTP.

- \`@elysiajs/opentelemetry\` registrado como **primeiro plugin** Elysia — spans nomeados por função handler (\`createLink\`, \`listUserLinks\`, etc.)
- Todos os serviços inicializam o SDK via \`@urlfy/telemetry\` antes da primeira requisição
- Logs estruturados com correlation IDs via LogTape + OTEL exporters
- Métricas de cache hit/miss, latência de redirect, taxa de erro

---

## Contratos de API (Single Source of Truth)

\`openapi-spec.json\` é um snapshot gerado do spec merged (Elysia + Better-Auth). \`packages/contracts/src/generated/\` deriva TypeScript tipado desse spec.

\`\`\`
Elysia schema ──────────────────┐
                                 ├── bun run openapi:generate → openapi-spec.json
Better-Auth openapi ─────────────┘              │
                                                 ↓
                                  bun run contracts:generate → packages/contracts/src/generated/
\`\`\`

**Nenhum arquivo gerado deve ser editado manualmente.** CI verifica drift via \`bun run contracts:check\`.

---

## Release Flow (CI/CD)

\`\`\`mermaid
flowchart TD
    Push["git push → main"] --> CI["ci.yml\nlint · type-check · test\ncontract drift · security scan"]
    CI -->|"CI verde"| RT["release-tag.yml\ntag imutável\nrelease-YYYYMMDDHHMMSS-sha"]
    CI -->|"CI falhou"| Stop["🚫 sem release"]
    RT --> Branch["fast-forward\nbranch release"]
    Branch --> Dokploy["Dokploy\nrastreia release"]
    Dokploy --> Deploy["docker-compose.prod.yml\ndeploy automático"]
    Deploy --> Rollback{"problema?"}
    Rollback -->|"sim"| Repoint["repontar release\npara tag anterior"]
    Rollback -->|"não"| Live["✅ produção"]
\`\`\`

- Branch \`release\` é automation-owned
- Rollback: apontar \`release\` de volta a um tag anterior
- Dokploy usa \`docker/docker-compose.prod.yml\` como compose file

---

## Trade-offs e Decisões de Design

### Redirect em \`apps/web\` vs. \`apps/api\`

**Decisão:** \`/r/:code\` resolve em \`apps/web\` via \`packages/redirect-domain\`, sem hop HTTP para \`apps/api\`.  
**Trade-off:** Lógica de negócio duplicada potencial vs. latência. Adotou-se o pacote compartilhado \`redirect-domain\` para centralizar a lógica sem coupling ao framework, eliminando o overhead de HTTP sem duplicar código.

---

### Redis Streams vs. escrita direta em banco

**Decisão:** Analytics via Redis Streams (event sourcing) em vez de INSERT síncrono.  
**Trade-off:** Complexidade de infrastructure (consumer group, DLQ, backpressure) vs. simplicidade de DB direto. O ganho: redirect P50 < 30ms é viável — a escrita de analytics nunca está no caminho crítico do usuário. Se Redis cair, clicks são perdidos (não o link).

---

### Bun native APIs vs. adapters populares

**Decisão:** \`Bun.SQL\` (nativo) + \`Bun.RedisClient\` (RESP3 nativo) em vez de \`pg\` ou \`ioredis\`.  
**Trade-off:** Lock-in ao Bun runtime vs. performance nativa e menos layers de abstração. Para um portfólio demonstrando Bun, o trade-off é intencional e documentado. Circuit breaker mitiga risco de disponibilidade.

---

### Admin por ADMIN_GITHUB_ACCOUNT_ID vs. role no banco

**Decisão:** Role admin derivado de conta GitHub vinculada em runtime, não armazenado como campo mutável.  
**Trade-off:** Menos flexibilidade (apenas um admin account) vs. eliminação completa do vetor de escalada de privilégio via manipulação de banco/API. Para portfólio single-operator, o trade-off é correto.

---

### Same-origin ingress (sem BFF dedicado)

**Decisão:** Traefik/nginx na frente roteia \`/api/*\` e \`/r/:code\` — sem um BFF Next.js intermediário.  
**Trade-off:** \`apps/web\` e \`apps/api\` precisam de contrato explícito (packages/contracts) vs. acoplamento implícito de um BFF. O ganho: \`apps/api\` pode ser escalonado independentemente, e o contrato tipado previne drift silencioso.

---

### Particionamento de analytics_events por mês

**Decisão:** \`analytics_events\` é particionada declarativamente por mês no Drizzle.  
**Trade-off:** Migrations mais complexas, drift de primary key entre partições vs. queries de analytics ordens de grandeza mais rápidas para ranges de data comuns. Dados brutos são purgados após 90 dias; apenas agregados sobrevivem para sempre.

---

## Disaster Recovery

| Métrica | Target |
|---|---|
| RTO | < 1 hora |
| RPO | < 1 hora |

- PostgreSQL: backup hourly (7-day retention) + daily full às 02:00 UTC (30-day retention)
- Redis é efêmero — cache reconstrói automaticamente no cold start
- Rollback de deploy: \`release\` branch apontado para tag anterior

---

## Formato de Resposta da API

\`\`\`jsonc
// Sucesso
{ "success": true, "data": { ... } }

// Paginado
{ "success": true, "data": [...], "meta": { "total": 1000, "page": 1, "perPage": 20, "lastPage": 50, "hasMore": true } }

// Erro
{ "success": false, "error": { "code": "LINK_NOT_FOUND", "message": "..." }, "requestId": "req_abc123" }
\`\`\`

| Código de erro | HTTP | Significado |
|---|---|---|
| \`VALIDATION_ERROR\` | 400 | Input inválido |
| \`UNAUTHORIZED\` | 401 | Token ausente/inválido |
| \`PASSWORD_REQUIRED\` | 401 | Link protegido por senha |
| \`FORBIDDEN\` | 403 | Permissão insuficiente |
| \`LINK_NOT_FOUND\` | 404 | Short code desconhecido |
| \`LINK_EXPIRED\` | 410 | Link expirado |
| \`REDIRECT_LOOP\` | 421 | Loop de auto-encurtamento detectado |
| \`URL_MALICIOUS\` | 422 | URL bloqueada |
| \`RATE_LIMITED\` | 429 | Muitas requisições |
| \`LINK_BANNED\` | 451 | Link banido por admin |
| \`QUOTA_EXCEEDED\` | 402 | Cota de links do plano atingida |

---

## Módulos da API (\`apps/api/src/server/modules/\`)

| Módulo | Responsabilidade |
|---|---|
| \`links/\` | CRUD de links, validação, alias policy |
| \`analytics/\` | Dashboard de analytics por link |
| \`auth/\` | Endpoints Better-Auth (login, OAuth, 2FA, API keys) |
| \`admin/\` | Painel admin: busca global, ban, gestão de usuários |
| \`public/\` | Endpoint público de criação de link (guest) |
| \`users/\` | Perfil, exportação LGPD, deleção de conta |
| \`contact/\` | Formulário de contato |
| \`internal/\` | Endpoints internos (health, OpenAPI merged spec) |
| \`api-keys/\` | Gestão programática de API keys |

`,
  status: 'published' as const,
  repositoryUrl: 'https://github.com/gustavo-sotero/urlfy.cc',
  liveUrl: 'https://urlfy.cc/',
  featured: true,
  order: 1,
  impactFacts: [
    'Redirect resolve no Next.js via pacote compartilhado, sem round-trip HTTP para a API.',
    'Cache-aside com lock distribuído e fallback para PostgreSQL protege o hot path contra stampede.',
    'Cliques seguem por Redis Streams para analytics assíncrono com agregação e retenção controlada.',
    'Hash imediato de IP, loop guard e rate limit em três camadas endurecem a superfície pública.',
  ],
  skillSlugs: [
    'typescript',
    'javascript',
    'bun',
    'nextjs',
    'react',
    'tailwind',
    'elysia',
    'redis',
    'postgresql',
    'drizzle',
    'docker',
    'docker-compose',
    'opentelemetry',
    'git',
    'github',
  ],
};
