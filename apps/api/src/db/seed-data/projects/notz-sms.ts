export const NOTZ_PROJECT = {
  slug: 'notz-sms',
  coverImage: 'projects/notz-sms.jpg',
  title: 'Notz - SMS',
  description:
    'SaaS multi-tenant de verificação SMS via Telegram com bot grammY, API Hono, workers BullMQ, RLS e fallback entre provedores SMS e gateways PIX.',
  content: `
   # Notz - SMS — Plataforma Multi-Tenant de Verificação SMS

## Visão Geral

Plataforma SaaS de verificação SMS via Telegram Bot com arquitetura **multi-tenant**. Um único deploy serve múltiplos bots independentes, cada um com sua identidade visual, configuração de margens, disponibilidade de serviços e painel administrativo separado.

---

## Arquitetura

### Monorepo

\`\`\`
packages/
├── shared/    @smsbot/shared   — domínio, DB, services, repos, cache, providers
├── bot/       @smsbot/bot      — bot Telegram (grammY)
├── api/       @smsbot/api      — API REST (Hono)
├── workers/   @smsbot/workers  — processamento de filas (BullMQ)
└── web/       @smsbot/web      — WebApp + Painel Admin/Master (Next.js)
\`\`\`

\`\`\`mermaid
graph LR
    bot["@smsbot/bot"] -->|import| shared["@smsbot/shared"]
    api["@smsbot/api"] -->|import| shared
    workers["@smsbot/workers"] -->|import| shared
    web["@smsbot/web"] -->|HTTP RPC| api

    shared --- pg[(PostgreSQL 17)]
    shared --- redis[(Redis 8)]

    style shared fill:#1d3557,color:#fff
    style pg fill:#336791,color:#fff
    style redis fill:#dc143c,color:#fff
\`\`\`

**Runtime único:** todos os pacotes rodam em Bun 1.x.  
**Orquestração de build:** \`bun workspaces\` com \`--parallel\` para dev e \`--sequential\` para build/test/type-check.

### Padrão de Acesso

| Consumidor | Acesso ao domínio |
|------------|------------------|
| Bot / Workers | Import direto de \`@smsbot/shared\` |
| WebApp / Admin | HTTP via API Hono |

### Multi-Tenant

- Isolamento por coluna \`bot_id\` em **todas** as tabelas críticas.
- **Row-Level Security (RLS)** no PostgreSQL — política aplicada automaticamente por \`bun run db:migrate\` após cada migração Drizzle.
- Contexto de tenant propagado com \`runWithTenantBotContext\` / \`withTenantContext(tx, botId)\` em transações.
- Cache Redis prefixado por \`botId\` para evitar colisão entre tenants.
- \`bot_id IS NULL\` reservado para dados globais do Master; RLS impede que conexões tenant-scoped os acessem.

\`\`\`mermaid
sequenceDiagram
    participant Bot as grammY Handler
    participant MW as tenantMiddleware
    participant Ctx as runWithTenantBotContext
    participant TX as withTenantContext-tx
    participant PG as PostgreSQL RLS

    Bot->>MW: mensagem recebida
    MW->>MW: resolve bot_id do token
    MW->>Ctx: set async context (bot_id)
    Ctx->>TX: BEGIN → SET LOCAL app.current_bot_uuid = bot-uuid
    TX->>PG: SELECT ... (RLS filtra por bot_id automaticamente)
    PG-->>TX: rows do tenant correto
    TX-->>Ctx: commit
    Note over Ctx,PG: bot_id IS NULL só visível<br/>para conexões Master
\`\`\`

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Bun 1.x |
| Linguagem | TypeScript 5.x (strict, \`noUncheckedIndexedAccess\`, \`exactOptionalPropertyTypes\`) |
| Linter/Formatter | Biome (\`noExplicitAny: error\`, \`noUnusedImports: error\`, indent 2, aspas simples) |
| Bot Telegram | grammY + \`@grammyjs/hydrate\`, \`@grammyjs/conversations\`, \`@grammyjs/runner\` |
| API REST | Hono (otimizado para Bun, RPC Client tipado via \`hono/client\`) |
| ORM | Drizzle ORM |
| Database | PostgreSQL 17 com RLS |
| Cache / Filas | Redis 8 (ioredis) + BullMQ |
| Frontend | Next.js 16 App Router + shadcn/ui + Tailwind CSS |
| Validação | Zod |
| IDs | UUID v7 (\`uuidv7\`) — ordenados por tempo, não enumeráveis |
| Testes | Vitest (\`pool: forks\`, \`fileParallelism: false\` no bot/web) |
| Templates | Handlebars com helpers customizados (\`currency\`, \`date\`, \`flag\`, \`plural\`, \`eq\`, \`gt\`) |
| API Docs | Scalar (\`@scalar/hono-api-reference\`) |
| Containers | Docker multi-stage (\`base → deps → builder → runner\`), usuário \`bun\` non-root |
| CI/CD | GitHub Actions |
| Deploy | Dokploy + Traefik v3.0 + Cloudflare |
| Observabilidade | LogTape + OpenTelemetry + Prometheus + Grafana + Loki |

---

## Módulos e Responsabilidades

### \`@smsbot/shared\` — Núcleo de Domínio

**Database (Drizzle/PostgreSQL):**

| Grupo | Tabelas principais |
|-------|--------------------|
| Core | \`users\`, \`user_balances\`, \`orders\`, \`order_sms\`, \`transactions\`, \`recharges\` |
| Referral | \`referral_commissions\` |
| Gifts | \`gift_cards\`, \`gift_redemptions\` |
| Serviços | \`countries\`, \`services\`, \`country_providers\`, \`service_providers\` |
| Suporte | \`tickets\`, \`ticket_messages\`, \`support_agents\` |
| FAQ | \`faq_categories\`, \`faq_questions\`, \`faq_feedback\` |
| Broadcast | \`broadcasts\`, \`broadcast_logs\` |
| Multi-Tenant | \`bots\`, \`bot_admins\`, \`audit_logs\`, \`bot_messages\`, \`bot_keyboards\`, \`availability_rules\`, \`margin_rules\` |
| Provider Sync | \`provider_services_catalog\`, \`provider_countries_catalog\`, \`provider_pricing\`, \`provider_pricing_details\`, \`provider_status\` |

**Services:**
- \`UserService\` — cadastro, saldo, reservas, RBAC
- \`OrderService\` — criação, SMS, cancelamento, expiração, reativação
- \`PaymentService\` — confirmação webhook, bônus, comissões (atômico via tx)
- \`GiftService\` — elegibilidade multi-critério, resgate atômico com unique constraint
- \`MarginService\` — cálculo hierárquico de preço com 7 níveis de especificidade
- \`AvailabilityService\` — regras hierárquicas de disponibilidade (mesmo modelo das margens)
- \`CustomizationService\` — templates Handlebars + keyboards dinâmicos com interpolação de variáveis
- \`AdminService\` — RBAC hierárquico (master > gestor > admin), 2FA Telegram nativo
- \`BotService\` — gestão de instâncias de bot
- \`TicketService\` — fluxo de suporte com escalonamento
- \`ProviderSyncService\` — sincronização 3 camadas (catálogo 24h / preços 5min / health 1min)

\`\`\`mermaid
stateDiagram-v2
    direction LR
    [*] --> pending : POST /api/orders
    pending --> active : número atribuído pelo provedor
    active --> completed : SMS recebido
    active --> cancelled : usuário cancela
    active --> expired : timeout 20 min
    completed --> [*]
    cancelled --> [*] : reembolso automático
    expired --> [*] : reembolso automático
    expired --> pending : /reativar (novo pedido, mesmo número)
    note right of active
        Atualização push < 3s
        via notificationQueue
    end note
\`\`\`

**Provedores SMS:** 4 integrações via interface \`ISMSProvider\` com fallback automático entre provedores e **anonimização obrigatória** para o usuário final ("Provedor 1, 2, 3..."). Nomes reais nunca expostos.

**Gateways PIX:** 4 gateways via interface \`IPaymentGateway\` com validação de assinatura webhook e fallback automático entre gateways.

**Cache Redis:** chaves prefixadas por \`botId\`, TTLs definidos por domínio (\`msg:{botId}:{key}\` 300s, \`avl:{botId}:*\` 60–300s), invalidação via Pub/Sub \`customization:invalidate\`.

---

### \`@smsbot/bot\` — Bot Telegram

**Middlewares:** tenant resolution, terms gate, logger, admin guard, customization injection.

**Comandos de usuário:** \`/start\` (deep link referral), \`/servicos\`, \`/paises\`, \`/saldo\`, \`/recarga\`, \`/historico\`, \`/favoritos\`, \`/reativar\`, \`/resgatar\`, \`/indicados\`, \`/canal\`, \`/ticket\`, \`/termos\`, \`/faq\`, \`/ajuda\`.

**Comandos administrativos:** \`/user\`, \`/order\`, \`/recharge\`, \`/gift\`, \`/balance\`, \`/ban\`, \`/unban\`, \`/broadcast\`, \`/giftcreate\`, \`/stats\`, \`/providers\`, \`/services\`, \`/config\`.

**Callbacks:** 24 prefixos (\`menu:\`, \`ord:\`, \`svc:\`, \`ctr:\`, \`prov:\`, \`op:\`, \`rch:\`, \`react:\`, \`gift:\`, \`fav:\`, \`hist:\`, \`bal:\`, \`adm:\`, \`ref:\`, \`chn:\`, \`prv:\`, \`svcs:\`, \`avl:\`, \`cfg:\`, \`terms:\`, \`help:\`, \`tx:\`, \`noop\`). Padrão \`prefixo:ação:param\` ≤ 64 bytes.

**Templates:** 82 defaults Handlebars, organizados por contexto (\`start\`, \`order\`, \`recharge\`, \`gift\`, \`notification\`, \`admin\`, etc.).

**Keyboards:** 74 defaults com callbacks parametrizáveis e fallbacks seguros (\`noop\` / \`menu:main\`) para mensagens antigas sem dados de contexto.

**Precificação:** helper centralizado \`packages/bot/src/pricing.ts\` — usa \`MarginService.calculateSellPrice()\` com fallback para margem default do bot. Garante preço consistente entre telas de descoberta (\`/servicos\`, inline search, \`/reativar\`) e confirmação de compra.

**Busca inline:** debounce 300ms, cache Redis 5min, máx 50 resultados, providers anonimizados.

**Audit log:** \`createAdminAuditMiddleware\` registra todos os comandos/callbacks admin em \`audit_logs\`.

**Cobertura de testes:** 1565 testes, ~82% statements, ~72% branches, ~87% functions.

---

### \`@smsbot/api\` — API REST (Hono)

**Autenticação:**
- WebApp: header \`X-Telegram-Init-Data\` (HMAC-SHA256)
- Admin/Gestor: Telegram Login Widget + JWT (access 15min + refresh 7d) + httpOnly cookie
- Master: mesma base + 2FA Telegram nativo (código 6 dígitos via Bot API \`sendMessage\`, expira 5min, bloqueia após 5 tentativas)

\`\`\`mermaid
sequenceDiagram
    actor U as Usuário / Admin / Master
    participant TG as Telegram
    participant API as Hono API
    participant DB as PostgreSQL

    rect rgb(30, 80, 60)
        note over U,DB: WebApp (usuário final)
        U->>API: requisição + X-Telegram-Init-Data
        API->>API: HMAC-SHA256 verify(initData)
        API->>DB: find user (bot_id + telegram_id)
    end

    rect rgb(30, 60, 100)
        note over U,DB: Admin / Gestor
        U->>TG: Telegram Login Widget
        TG-->>U: signed auth object
        U->>API: POST /api/admin/auth
        API->>DB: verify bot_admin (role ≠ master)
        API-->>U: JWT 15min + refresh 7d (httpOnly)
    end

    rect rgb(80, 30, 60)
        note over U,DB: Master (obrigatório 2FA)
        U->>TG: Telegram Login Widget
        TG-->>U: signed auth object
        U->>API: POST /api/master/auth
        API->>DB: verify master role
        API->>TG: sendMessage(código 6 dígitos, TTL 5min)
        TG-->>U: mensagem com código
        U->>API: POST /api/master/auth/verify-2fa
        API-->>U: JWT (claim twoFactorVerified: true)
        note right of API: bloqueia após 5 falhas<br/>cooldown 15min
    end
\`\`\`

**Rotas WebApp:** \`/api/user/*\`, \`/api/services/*\`, \`/api/countries/*\`, \`/api/orders/*\`, \`/api/recharge/*\`, \`/api/gifts/*\`, \`/api/favorites/*\`.

**Rotas Admin:** \`/api/admin/dashboard\`, \`/api/admin/services/*\`, \`/api/admin/availability/*\`, \`/api/admin/users/*\`, \`/api/admin/gifts/*\`, \`/api/admin/messages/*\`, \`/api/admin/keyboards/*\`, \`/api/admin/broadcasts/*\`, \`/api/admin/tickets/*\`.

**Rotas Master:** \`/api/master/bots/*\`, \`/api/master/managers/*\`, \`/api/master/audit-log\`.

**Webhooks:** \`/api/webhooks/payment/:gateway\` (um endpoint por gateway), \`/api/webhooks/sms/:provider\`.

**Middleware RBAC:** \`requireRole(minRole)\` com hierarquia numérica (\`master=3 > gestor=2 > admin=1\`). Audit log automático em todas as rotas admin/master.

**Docs:** OpenAPI via Scalar em \`/reference\`.

---

### \`@smsbot/workers\` — Processamento Assíncrono (BullMQ)

| Worker | Concurrency | Rate Limit | Retries |
|--------|------------|------------|---------|
| Order | 10 | 100/s | 3 |
| Payment | 5 | 50/s | 5 |
| Notification | 20 | 30/s | 3 |
| Broadcast | 1 | 30/s | 1 |
| Provider Sync | 3 | 10/min | 3 |

**Scheduled jobs:** \`order-expiration-check\` (30s), \`prices-sync\` (5min), \`health-check\` (1min), \`services-sync\` (6h), \`catalog-sync\` (24h).

**Dead Letter Queue:** jobs esgotados vão para DLQ; monitoramento via Bull Board; reprocessamento manual disponível.

Redis configurado com \`maxRetriesPerRequest: null\` e \`enableReadyCheck: false\` (obrigatório para BullMQ).

\`\`\`mermaid
graph TD
    subgraph C1["Camada 1 — Catálogo  ⏱ 24h"]
        J1[catalog-sync job] --> T1[(provider_services_catalog)]
        J1 --> T2[(provider_countries_catalog)]
    end
    subgraph C2["Camada 2 — Preços  ⏱ 5min"]
        J2[prices-sync job] --> T3[(provider_pricing)]
        J2 --> T4[(provider_pricing_details)]
    end
    subgraph C3["Camada 3 — Health  ⏱ 1min"]
        J3[health-check job] --> T5[(provider_status)]
    end

    T1 & T2 & T3 & T4 --> MS[MarginService]
    T5 --> AS[AvailabilityService]
    MS --> PH["pricing.ts<br/>(bot)"]
    AS --> PH
    PH --> UI["Preço exibido ao usuário<br/>(consistente em todas as telas)"]

    style C1 fill:#1a3a2a,color:#ccc
    style C2 fill:#1a2a3a,color:#ccc
    style C3 fill:#3a1a1a,color:#ccc
\`\`\`

---

### \`@smsbot/web\` — Frontend (Next.js 16 App Router)

**Route groups:**
- \`(webapp)/\` — WebApp Telegram (serviços, compra, pedidos, recarga, saldo, favoritos, configurações)
- \`admin/\` — Painel Gestor/Admin (dashboard, serviços, usuários, gifts, editor de mensagens/teclados, broadcast, tickets)
- \`master/\` — Painel Master (bots, gestores, métricas globais, audit log viewer)

**Editor de Mensagens:** syntax highlighting Handlebars, preview real-time com dados mock, \`VariableSelector\` clicável, \`ConditionBuilder\` visual para \`if/unless/each\`, versionamento com rollback.

**Editor de Teclados:** drag-and-drop (\`@dnd-kit\`), preview estilo Telegram, condições por botão (\`always\`, \`balance\`, \`status\`, \`feature\`, \`channel_member\`).

**RPC Client:** tipado via \`hono/client hc<AppType>\` para zero duplicação de tipos entre API e frontend.

**\`typedRoutes: true\`** configurado no nível raiz do \`next.config.ts\` (não em \`experimental\`).

---

## Decisões Arquiteturais

| ADR | Decisão | Motivo |
|-----|---------|--------|
| ADR-001 | grammY sobre Telegraf | Telegraf abandonado; grammY tem TypeScript nativo e runner escalável |
| ADR-002 | PostgreSQL + RLS sobre MongoDB | ACID, RLS nativo, Drizzle type-safe, isolamento multi-tenant sem complexidade extra |
| ADR-003 | BullMQ sobre polling/\`setInterval\` | Retry automático, DLQ, rate limiting, escalabilidade horizontal |
| ADR-004 | Tenant por coluna com RLS | Queries cross-tenant possíveis para o Master; migrations únicas; sem schema-per-tenant overhead |
| ADR-005 | Hono para API | Melhor performance em Bun; RPC Client tipado elimina duplicação de tipos |
| ADR-006 | UUID v7 para IDs | Performance de B-tree (ordenado por tempo) + segurança (não enumerável) |
| ADR-007 | Margens e Disponibilidade hierárquicas | 7 níveis de especificidade; regra mais específica prevalece; mesma arquitetura para ambos os sistemas |

> **Algoritmo de resolução (MarginService / AvailabilityService):**

\`\`\`mermaid
flowchart TD
    Q(["Resolver: service S + country C + provider P"]) --> L1
    L1{"Regra S+C+P?"} -->|sim| HIT["✅ Usar esta regra"]
    L1 -->|não| L2{"Regra S+P?"}
    L2 -->|sim| HIT
    L2 -->|não| L3{"Regra S+C?"}
    L3 -->|sim| HIT
    L3 -->|não| L4{"Regra S?"}
    L4 -->|sim| HIT
    L4 -->|não| L5{"Regra P?"}
    L5 -->|sim| HIT
    L5 -->|não| L6{"Regra C?"}
    L6 -->|sim| HIT
    L6 -->|não| L7{"Regra global?"}
    L7 -->|sim| HIT
    L7 -->|não| DEFAULT(["⬦ Sem regra = disponível / margem default"])
    style HIT fill:#2d6a4f,color:#fff
    style DEFAULT fill:#555,color:#fff
\`\`\`
| ADR-008 | Provider Sync 3 camadas | Separação de frequência: catálogo (24h) / preços (5min) / health (1min) |
| ADR-009 | 2FA Telegram nativo para Master | Sem dependência externa (TOTP/app/SMS); código via Bot API; UX nativa Telegram |
| ADR-010 | Audit log unificado \`audit_logs\` | Tabela única para admin/gestor/master com retenção permanente e metadados JSONB |
| ADR-011 | Mesmo app Next.js, route groups | Admin e Master no mesmo deploy via \`admin/\` e \`master/\`; middleware RBAC sem infra extra |
| ADR-012 | \`pricing.ts\` centralizado no bot | Preço consistente entre todas as superfícies de descoberta e confirmação via único ponto |
| ADR-013 | \`withTenantContext(tx, botId)\` em transações | Evita \`SET LOCAL\` em conexões pooladas; contexto isolado por transação |

---

## Trade-offs

### Monorepo Bun Workspaces
**Prós:** build unificado, dependências compartilhadas, type-safety cross-package.  
**Contras:** Vitest no bot/web exige \`pool: forks\` + \`fileParallelism: false\` no Windows para evitar falhas intermitentes de worker.

### RLS + coluna \`bot_id\` (tenant por coluna)
**Prós:** queries cross-tenant para relatórios Master são triviais; migrations únicas.  
**Contras:** requer disciplina em cada query; contexto de tenant deve ser injetado antes de qualquer operação — \`session SET\` é inseguro com connection pooling, por isso usa-se \`SET LOCAL\` dentro de transações.

### Handlebars para templates
**Prós:** não-técnicos podem editar mensagens via painel; preview em tempo real; rollback de versões.  
**Contras:** templates compilados no startup; erros em templates de produção requerem fallback explícito; helpers customizados precisam de cobertura de teste própria.

### grammY \`conversations\` para fluxos multi-step
**Prós:** fluxo linear legível (ex: \`/giftcreate\`, recarga com QR Code).  
**Contras:** conversações são sensíveis à ordem de registro de handlers; \`sequentialize\` de sessão é obrigatório para evitar race conditions em atualizações concorrentes do mesmo usuário.

### Anonimização de provedores SMS
**Prós:** protege relacionamentos comerciais; evita preferência de usuário por provedor específico.  
**Contras:** debugging de falhas de pedido requer correlação interna; erros de provedor não podem mencionar o nome real nem nos logs expostos ao usuário.

### 2FA Telegram nativo (sem TOTP)
**Prós:** zero dependência de app autenticador externo; UX fluida para usuários Telegram.  
**Contras:** depende de disponibilidade do Telegram Bot API para envio do código; código expira em 5min; bloqueio após 5 falhas exige fluxo de desbloqueio manual.

### Reserva de saldo atômica
**Prós:** elimina TOCTOU entre verificação de saldo e débito.  
**Contras:** reserva precisa ser liberada explicitamente em todos os caminhos de falha (expiração, cancelamento, reembolso) — qualquer omissão "congela" saldo do usuário.

---

## Segurança

| Requisito | Implementação |
|-----------|--------------|
| Autenticação WebApp | HMAC-SHA256 do \`initData\` Telegram |
| Autenticação Admin | JWT (15min) + refresh (7d) + httpOnly cookie |
| 2FA Master | Código 6 dígitos via Bot API, expira 5min, bloqueia após 5 falhas |
| Autorização | RBAC hierárquico via middleware \`requireRole(minRole)\` |
| Isolamento de dados | RLS PostgreSQL por \`bot_id\` |
| Criptografia em repouso | AES-256 para dados sensíveis |
| SQL Injection | Prepared statements via Drizzle ORM |
| Rate Limiting | Por IP e por usuário em todas as rotas públicas |
| Webhooks | Validação de assinatura por gateway antes de processar |
| Audit Trail | Tabela \`audit_logs\` — todas as ações admin/gestor/master, retenção permanente |
| Idempotência | Confirmação de recarga só atualiza \`pending\`; já pago é no-op |

---

## Feature Flags

| Flag | Default | Descrição |
|------|---------|-----------|
| \`FF_WEBAPP_ENABLED\` | false | Habilita WebApp para usuários finais |
| \`FF_CRYPTO_PAYMENTS\` | false | Pagamentos crypto (estrutura preparada) |
| \`FF_MULTI_LEVEL_AFFILIATE\` | false | Sistema de afiliados multi-nível (1–5 níveis) |
| \`FF_REALTIME_NOTIFICATIONS\` | true | WebSocket no WebApp para status real-time |

---

## Métricas de Qualidade Atual

| Pacote | Testes | Statements | Branches | Functions |
|--------|--------|-----------|---------|----------|
| \`@smsbot/bot\` | 1 565 | ~82% | ~72% | ~87% |
| \`@smsbot/shared\` | — | — | — | — |
| \`@smsbot/api\` | — | — | — | — |
| \`@smsbot/workers\` | — | — | — | — |

**Alvo global:** > 70% cobertura em todos os pacotes.
`,
  status: 'published' as const,
  repositoryUrl: null,
  liveUrl: 'https://t.me/NotzSMSBot',
  featured: true,
  order: 0,
  impactFacts: [
    'Um único deploy atende múltiplos bots isolados por bot_id com RLS e contexto de tenant até a transação.',
    'Bot, API, workers e painéis compartilham o mesmo núcleo de domínio em Bun e TypeScript.',
    'Fallback entre 4 provedores SMS e 4 gateways PIX reduz dependência operacional de terceiros.',
    'Pedidos, expiração, reembolso e reativação são orquestrados com BullMQ, retries e DLQ.',
  ],
  skillSlugs: [
    'typescript',
    'javascript',
    'nodejs',
    'bun',
    'hono',
    'bullmq',
    'redis',
    'postgresql',
    'drizzle',
    'docker',
    'docker-compose',
    'react',
    'nextjs',
    'tailwind',
    'git',
    'github',
    'vps',
  ],
};
