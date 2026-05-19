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
- **Row-Level Security (RLS)** no PostgreSQL aplicado automaticamente a cada migração Drizzle.
- Contexto de tenant propagado via async context e isolado por transação — sem uso de variáveis de sessão em conexões pooladas.
- Cache Redis prefixado por \`botId\` para evitar colisão entre tenants.

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Bun 1.x |
| Linguagem | TypeScript 5.x strict |
| Linter/Formatter | Biome |
| Bot Telegram | grammY + conversations + runner |
| API REST | Hono com RPC Client tipado |
| ORM | Drizzle ORM |
| Database | PostgreSQL 17 com RLS |
| Cache / Filas | Redis 8 (ioredis) + BullMQ |
| Frontend | Next.js 16 App Router + shadcn/ui + Tailwind CSS |
| Validação | Zod |
| IDs | UUID v7 — ordenados por tempo, não enumeráveis |
| Testes | Vitest |
| Templates | Handlebars com helpers customizados |
| API Docs | Scalar (OpenAPI) |
| Containers | Docker multi-stage, usuário non-root |
| CI/CD | GitHub Actions |
| Deploy | Dokploy + Traefik + Cloudflare |
| Observabilidade | LogTape + OpenTelemetry + Prometheus + Grafana + Loki |

---

## Módulos e Responsabilidades

### \`@smsbot/shared\` — Núcleo de Domínio

Schema Drizzle/PostgreSQL cobrindo usuários, pedidos, pagamentos, gift cards, serviços, suporte, broadcast, multi-tenant e sincronização de provedores.

**Serviços principais:**
- **UserService** — cadastro, saldo, reservas atômicas, RBAC
- **OrderService** — criação, recebimento de SMS, cancelamento, expiração, reativação
- **PaymentService** — confirmação de webhooks, bônus e comissões em transação atômica
- **GiftService** — elegibilidade multi-critério, resgate com garantia de unicidade
- **MarginService** — cálculo hierárquico de preço com 7 níveis de especificidade
- **AvailabilityService** — regras hierárquicas de disponibilidade (mesmo modelo das margens)
- **CustomizationService** — templates Handlebars e keyboards dinâmicos por tenant
- **AdminService** — RBAC hierárquico (master > gestor > admin) com 2FA Telegram
- **ProviderSyncService** — sincronização em 3 camadas por frequência

\`\`\`mermaid
stateDiagram-v2
    direction LR
    [*] --> pending : pedido criado
    pending --> active : número atribuído pelo provedor
    active --> completed : SMS recebido
    active --> cancelled : usuário cancela
    active --> expired : timeout
    completed --> [*]
    cancelled --> [*] : reembolso automático
    expired --> [*] : reembolso automático
    expired --> pending : reativar (mesmo número)
\`\`\`

**Provedores SMS:** múltiplas integrações via interface \`ISMSProvider\` com fallback automático e anonimização obrigatória para o usuário final.

**Gateways PIX:** múltiplos gateways via interface \`IPaymentGateway\` com validação de assinatura de webhook e fallback automático.

---

### \`@smsbot/bot\` — Bot Telegram

**Middlewares:** tenant resolution, terms gate, logger, admin guard, customization injection.

**Comandos de usuário:** fluxos de descoberta de serviços, compra, acompanhamento de pedidos, recarga de saldo, favoritos, gift cards, sistema de referral, suporte via ticket e FAQ.

**Comandos administrativos:** gestão de usuários, pedidos, recargas, gifts, broadcast, configuração de serviços e disponibilidade.

**Precificação:** ponto centralizado que usa \`MarginService\` para garantir consistência entre todas as telas de descoberta e confirmação de compra.

**Audit log:** todas as ações administrativas registradas automaticamente com metadados completos.

---

### \`@smsbot/api\` — API REST (Hono)

**Autenticação em 3 níveis:**
- **WebApp:** verificação criptográfica do \`initData\` Telegram
- **Admin/Gestor:** Telegram Login Widget + JWT de curta duração com refresh token em cookie httpOnly
- **Master:** mesma base com 2FA obrigatório via Telegram Bot — sem dependência de app autenticador externo

**Superfícies de API:** endpoints para WebApp (usuário final), painel Admin/Gestor e painel Master, além de webhooks para gateways de pagamento e provedores SMS.

**RBAC:** hierarquia de papéis aplicada via middleware, com audit log automático em todas as rotas administrativas.

---

### \`@smsbot/workers\` — Processamento Assíncrono (BullMQ)

Workers com concorrência e rate limiting individuais por domínio (pedidos, pagamentos, notificações, broadcast, sincronização de provedores).

**Jobs agendados:** expiração de pedidos, sincronização de preços, health check de provedores, atualização de catálogo.

**Dead Letter Queue:** jobs esgotados encaminhados para DLQ com monitoramento via Bull Board e reprocessamento manual disponível.

\`\`\`mermaid
graph TD
    subgraph C1["Camada 1 — Catálogo  ⏱ baixa frequência"]
        J1[catalog-sync] --> S1[(Catálogo de serviços e países)]
    end
    subgraph C2["Camada 2 — Preços  ⏱ média frequência"]
        J2[prices-sync] --> S2[(Preços por provedor)]
    end
    subgraph C3["Camada 3 — Health  ⏱ alta frequência"]
        J3[health-check] --> S3[(Status dos provedores)]
    end

    S1 & S2 --> MS[MarginService]
    S3 --> AS[AvailabilityService]
    MS & AS --> UI["Preço exibido ao usuário<br/>(consistente em todas as telas)"]

    style C1 fill:#1a3a2a,color:#ccc
    style C2 fill:#1a2a3a,color:#ccc
    style C3 fill:#3a1a1a,color:#ccc
\`\`\`

---

### \`@smsbot/web\` — Frontend (Next.js 16 App Router)

- **WebApp Telegram:** serviços, compra, pedidos, recarga, saldo, favoritos, configurações
- **Painel Admin/Gestor:** dashboard, serviços, usuários, gifts, editor de mensagens/teclados, broadcast, tickets
- **Painel Master:** gestão de bots, gestores, métricas globais, audit log

**Editor de Mensagens:** syntax highlighting Handlebars, preview em tempo real com dados mock, seletor de variáveis clicável, construtor visual de condições, versionamento com rollback.

**Editor de Teclados:** drag-and-drop (\`@dnd-kit\`), preview estilo Telegram, condições por botão.

**RPC Client:** tipado via \`hono/client\` — zero duplicação de tipos entre API e frontend.

---

## Decisões Arquiteturais

| ADR | Decisão | Motivo |
|-----|---------|--------|
| ADR-001 | grammY sobre Telegraf | Telegraf abandonado; grammY tem TypeScript nativo e runner escalável |
| ADR-002 | PostgreSQL + RLS sobre MongoDB | ACID, RLS nativo, Drizzle type-safe, isolamento multi-tenant sem overhead extra |
| ADR-003 | BullMQ sobre polling | Retry automático, DLQ, rate limiting, escalabilidade horizontal |
| ADR-004 | Tenant por coluna com RLS | Queries cross-tenant possíveis para o Master; migrations únicas |
| ADR-005 | Hono para API | Performance em Bun; RPC Client tipado elimina duplicação de tipos |
| ADR-006 | UUID v7 para IDs | Performance de B-tree (ordenado por tempo) + segurança (não enumerável) |
| ADR-007 | Margens e Disponibilidade hierárquicas | 7 níveis de especificidade; regra mais específica prevalece |
| ADR-008 | Provider Sync em 3 camadas | Separação de frequência: catálogo / preços / health |
| ADR-009 | 2FA Telegram nativo para Master | Sem dependência externa; UX nativa Telegram |
| ADR-010 | Audit log unificado | Tabela única para todos os papéis com retenção permanente e metadados JSONB |
| ADR-011 | Route groups no Next.js | Admin e Master no mesmo deploy; middleware RBAC sem infra extra |

> **Algoritmo de resolução de margem/disponibilidade:**

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

---

## Trade-offs

### Monorepo Bun Workspaces
**Prós:** build unificado, dependências compartilhadas, type-safety cross-package.  
**Contras:** ambiente de testes exige configuração específica de isolamento de workers para evitar falhas intermitentes.

### RLS + coluna \`bot_id\` (tenant por coluna)
**Prós:** queries cross-tenant para relatórios Master são triviais; migrations únicas.  
**Contras:** requer disciplina em cada query; contexto de tenant deve ser injetado corretamente antes de qualquer operação.

### Handlebars para templates
**Prós:** não-técnicos podem editar mensagens via painel; preview em tempo real; rollback de versões.  
**Contras:** erros em templates de produção requerem fallback explícito; helpers customizados precisam de cobertura de teste própria.

### grammY \`conversations\` para fluxos multi-step
**Prós:** fluxo linear legível para compras e recargas com QR Code.  
**Contras:** conversações são sensíveis à ordem de registro de handlers; sessão deve ser serializada para evitar race conditions em atualizações concorrentes.

### Anonimização de provedores SMS
**Prós:** protege relacionamentos comerciais; evita preferência de usuário por provedor específico.  
**Contras:** debugging de falhas de pedido requer correlação interna via logs administrativos.

### 2FA Telegram nativo (sem TOTP)
**Prós:** zero dependência de app autenticador externo; UX fluida para usuários Telegram.  
**Contras:** depende de disponibilidade do Telegram Bot API; requer fluxo de desbloqueio para contas bloqueadas.

---

## Segurança

| Requisito | Implementação |
|-----------|--------------|
| Autenticação WebApp | Verificação criptográfica do \`initData\` Telegram |
| Autenticação Admin | JWT de curta duração + refresh token httpOnly |
| 2FA Master | Código via Telegram Bot API com expiração e bloqueio por tentativas |
| Autorização | RBAC hierárquico via middleware |
| Isolamento de dados | RLS PostgreSQL por tenant |
| Criptografia em repouso | AES-256 para dados sensíveis |
| SQL Injection | Prepared statements via Drizzle ORM |
| Rate Limiting | Por IP e por usuário em todas as rotas públicas |
| Webhooks | Validação de assinatura por gateway antes de processar |
| Audit Trail | Todas as ações admin registradas com retenção permanente |
| Idempotência | Webhooks de pagamento são idempotentes por design |
`,
  status: 'published' as const,
  repositoryUrl: null,
  liveUrl: 'https://t.me/NotzSMSBot',
  featured: true,
  order: 0,
  impactFacts: [
    'Um único deploy atende múltiplos bots isolados por bot_id com RLS e contexto de tenant até a transação.',
    'Bot, API, workers e painéis compartilham o mesmo núcleo de domínio em Bun e TypeScript.',
    'Fallback automático entre múltiplos provedores SMS e gateways PIX reduz dependência operacional de terceiros.',
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
