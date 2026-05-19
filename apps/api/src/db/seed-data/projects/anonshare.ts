export const ANONSHARE_PROJECT = {
  slug: 'anonshare',
  coverImage: 'projects/anonshare.png',
  title: 'AnonShare',
  description:
    'Compartilhamento anônimo de arquivos com upload sem conta, download único atômico, expiração, moderação e reconciliação operacional.',
  content: `
# anonshare.dev

Plataforma de compartilhamento anônimo de arquivos. Sem cadastro, sem rastreamento desnecessário. Envia, compartilha, pronto.

---

## O que é

Visitante abre o site, seleciona um arquivo de até **256 MB**, define se o link deve funcionar apenas uma vez, quando deve expirar e se o conteúdo pode ser pré-visualizado diretamente no navegador. O sistema gera um link indecifrável. O destinatário abre o link e baixa ou pré-visualiza enquanto o arquivo ainda for acessível.

É um projeto não-comercial de P&D e portfólio. O objetivo não foi construir o produto mais simples possível, mas o mais correto possível: arquitetura em camadas, ciclo de vida rastreável, moderação funcional, observabilidade estruturada e um painel de operação real.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | **Bun** |
| Web / SSR | **TanStack Start** (React) |
| API | **Hono** |
| Jobs assíncronos | **BullMQ** |
| Banco de dados | **PostgreSQL** + **Drizzle ORM** (driver Bun SQL nativo) |
| Cache / filas | **Redis** (ioredis) |
| Armazenamento | S3-compatível via **Bun native S3 API** (MinIO local, AWS S3 / Cloudflare R2 em produção) |
| Auth | **GitHub OAuth** (único administrador com allowlist por numeric ID) |
| Lint / formatação | **Biome** |
| Testes | **Bun test** (unitários e de integração) + **Playwright** (E2E) |
| Infraestrutura local | **Docker Compose** |

---

## Estrutura do monorepo

O projeto usa **Bun workspaces**. Sem Turborepo em v1 — a complexidade não justificava a dependência extra.

\`\`\`
apps/
  web/         # TanStack Start — páginas públicas, rota de compartilhamento, shell do admin
  api/         # Hono — endpoints de domínio, health, rotas internas
  worker/      # BullMQ — jobs de expiração, limpeza, reconciliação
packages/
  domain/      # Regras de negócio puras, enums, máquina de estados
  contracts/   # Tipos TypeScript compartilhados: payloads de API, dados de jobs, schemas Zod
  infrastructure/  # DB, Redis, storage, config, logger, rate limiting, fila, OAuth state
\`\`\`

**Fronteira rígida**: \`apps/*\` nunca importa de outro \`apps/*\`. Código compartilhado só trafega por \`packages/*\`, via aliases de workspace (\`@anonshare/*\`). O Biome reforça isso com \`noRestrictedImports\` — importações por caminho relativo profundo para dentro de \`packages/\` causam erro de lint.

\`\`\`mermaid
graph TD
    subgraph apps[" "]
        web["apps/web\nTanStack Start"]
        api["apps/api\nHono"]
        worker["apps/worker\nBullMQ"]
    end
    subgraph packages[" "]
        domain["packages/domain\nregras puras · enums · máquina de estados"]
        contracts["packages/contracts\nZod schemas · tipos de API · payloads de jobs"]
        infra["packages/infrastructure\nDB · Redis · S3 · logger · rate-limit · queue · OAuth"]
    end
    web --> contracts
    web --> infra
    api --> domain
    api --> contracts
    api --> infra
    worker --> domain
    worker --> contracts
    worker --> infra
    web -. "❌ proibido" .-> api
    web -. "❌ proibido" .-> worker
\`\`\`

---

## Modelo de domínio e estados de arquivo

O coração do sistema é a máquina de estados de arquivo, definida em \`packages/domain\`:

\`\`\`mermaid
stateDiagram-v2
    [*] --> pending_upload : upload iniciado
    pending_upload --> active : head ✓ + ativação no DB
    pending_upload --> missing : reconciliação (objeto ausente)

    active --> expiring : expire-file job
    expiring --> expired : expire-file job

    active --> consumed : one-time download atômico
    expiring --> consumed : one-time download atômico

    active --> hidden : moderação admin
    expiring --> hidden : moderação admin
    hidden --> active : restore admin
    hidden --> deleted : delete admin

    active --> deleted : delete admin
    expiring --> deleted : cleanup-file job
    expired --> deleted : cleanup-file job
    missing --> deleted : cleanup-file job

    active --> missing : reconciliação (objeto órfão)
    expiring --> missing : reconciliação (objeto órfão)
\`\`\`

Cada transição tem um \`trigger kind\`: \`automatic\` (jobs de expiração), \`manual\` (ação admin), ou \`reconciliation\` (correção de inconsistências). Isso permite que módulos futuros raciocinem sobre o ciclo de vida sem re-codificar a semântica.

---

## Ciclo de vida de upload

1. **Inserção** do registro com status \`pending_upload\`
2. **Stream para storage** — arquivo é enviado via Bun native S3 API
3. **Verificação via \`head()\`** — confirma que o objeto existe antes de ativar
4. **Ativação**: \`UPDATE files SET status = 'active'\` com \`RETURNING\` — se 0 linhas, compensa deletando o objeto do storage
5. **Fallback para reconciliação**: se a ativação falhar mas o objeto já estiver no storage, o registro fica em \`pending_upload\` para o reconciliador corrigir depois

Uploads pequenos (≤ 8 MiB) são bufferizados em \`Uint8Array\` para replayabilidade em retentativas de storage. Acima disso, streaming direto para evitar crescimento ilimitado de memória.

\`\`\`mermaid
sequenceDiagram
    participant C as Cliente
    participant A as API (Hono)
    participant DB as PostgreSQL
    participant S3 as Storage

    C->>A: POST /upload (multipart)
    A->>DB: INSERT status=pending_upload
    A->>S3: PUT objects/{uuid}
    Note over A,S3: ≤ 8 MiB → Uint8Array (replayable)<br/>› 8 MiB → stream direto
    A->>S3: HEAD objects/{uuid}
    alt objeto confirmado no storage
        A->>DB: UPDATE status=active RETURNING
        alt 0 linhas — registro desapareceu
            A->>S3: DELETE objects/{uuid}
            A-->>C: 500
        else ativado com sucesso
            A-->>C: 200 shareUrl
        end
    else HEAD falhou
        A->>DB: DELETE (compensação)
        A-->>C: 500
    end
\`\`\`

---

## Download one-time: atomicidade sem corrida

O download de uso único usa um compare-and-set diretamente no PostgreSQL:

\`\`\`sql
UPDATE files
SET status = 'consumed'
WHERE token = $1 AND status IN ('active', 'expiring')
RETURNING *
\`\`\`

Zero linhas retornadas = outra requisição ganhou a corrida → \`410 FILE_CONSUMED\`. Não há locks de aplicação envolvidos. Se a geração da URL presignada falhar *após* a reserva, a transação é revertida: o status volta para \`active\` ou \`expiring\`.

\`\`\`mermaid
sequenceDiagram
    participant R1 as Req A
    participant R2 as Req B (concorrente)
    participant DB as PostgreSQL
    participant S3 as Storage

    par corrida simultânea
        R1->>DB: UPDATE status=consumed WHERE status IN (active,expiring) RETURNING
        R2->>DB: UPDATE status=consumed WHERE status IN (active,expiring) RETURNING
    end
    DB-->>R1: 1 linha — ganhou
    DB-->>R2: 0 linhas — perdeu
    R2-->>R2: 410 FILE_CONSUMED

    R1->>S3: gerar presigned URL
    alt presign ok
        R1-->>R1: 200 + URL
    else presign falhou
        R1->>DB: UPDATE status=active|expiring (rollback)
        R1-->>R1: 500
    end
\`\`\`

---

## Jobs assíncronos (BullMQ)

Três filas principais:

| Fila | Responsabilidade |
|---|---|
| \`expire-file\` | Marca arquivos como \`expiring\` e \`expired\` nos timestamps corretos |
| \`cleanup-file\` | Deleta o objeto no storage e atualiza o registro para \`deleted\` |
| \`reconcile\` | Scheduler periódico que detecta e corrige inconsistências: objetos órfãos, registros \`pending_upload\` travados, expiração que não disparou |

A reconciliação é **obrigatória** — jobs atrasados sozinhos não são garantia suficiente. O reconciliador usa cursores para processar em batches e não sobrecarregar o banco em lotes grandes.

\`\`\`mermaid
flowchart TD
    UP([upload ativado]) -->|"agenda job atrasado\n(delay = expiresAt)"| EF

    EF[expire-file] -->|"expiresAt atingido"| MARK["marca expiring / expired"]
    MARK -->|"agenda cleanup"| CF

    CF[cleanup-file] -->|"DELETE objeto S3"| DEL([status = deleted])

    RC(["reconcile\nscheduler periódico"]) -->|"pending_upload travado"| FIX["ativa ou marca missing"]
    RC -->|"expiração não disparou"| EF
    RC -->|"objeto órfão no storage"| CF
    RC -->|"missing sem objeto"| DEL

    FIX --> active([status = active])
    FIX --> missing([status = missing])
    missing --> CF
\`\`\`

Conexões BullMQ usam \`{ url }\` (string de URL Redis), não uma instância ioredis, para evitar conflitos de versão.

---

## Rate limiting e modo degradado

Rate limiting centralizado em \`@anonshare/infrastructure/rate-limit\` via \`applyRateLimit()\`. Caminho principal usa contador de janela fixa no Redis (\`INCR\` / \`EXPIRE\` atômico).

**Fallback automático**: se o Redis lançar qualquer erro, cai para um store local em memória (\`Map\`) com os mesmos thresholds. O resultado inclui \`origin: 'memory-fallback'\` e um log de \`rate_limit.degraded\` para observabilidade.

**Ressalva**: o fallback em memória não é compartilhado entre réplicas. Em múltiplas instâncias da API durante uma queda do Redis, cada réplica mantém seu próprio contador — limite efetivo pode ser mais alto que o configurado. É modo de emergência, não substituto do Redis.

---

## Autenticação do admin

GitHub OAuth com allowlist por **numeric GitHub user ID** (estável, não pode ser renomeado). O ID allowlistado fica em \`GITHUB_ALLOWED_USER_ID\` no \`.env\`.

Após OAuth bem-sucedido:
- Registro de sessão na tabela \`admin_sessions\`
- Cookie assinado com \`SESSION_SECRET\` via \`setSignedCookie\` / \`getSignedCookie\` do Hono
- Cookie adulterado ou sem assinatura → rejeitado antes do lookup no banco
- Rotacionar \`SESSION_SECRET\` invalida **todas** as sessões ativas imediatamente

Estado OAuth pendente fica no Redis com TTL (não em memória de processo) — restart do servidor não interrompe um login em andamento.

---

## Observabilidade

Logs estruturados via \`@anonshare/infrastructure/logger\`. Todos os eventos operacionais emitem campos canônicos: \`event\`, \`timestamp\`, \`outcome\`, mais \`requestId\`, \`actor\` e \`entity\` quando disponíveis.

Eventos de produto com identidade estável entre processos:

\`\`\`
upload.created      download.started    download.completed
report.created      file.hidden         file.deleted
\`\`\`

O logger padrão de texto do Hono não é usado — tudo fica estruturado e parseável por ferramentas.

---

## Banco de dados

**Drizzle ORM** com driver Bun SQL nativo (sem AWS SDK layer para storage; sem dependências do pool de conexões do Node.js).

Tabelas principais: \`files\`, \`download_events\`, \`reports\`, \`admin_sessions\`, \`system_settings\`, \`operational_anomalies\`, \`file_moderation_actions\`.

Constraints no banco que espelham contratos da aplicação:
- \`files.token\`: regex \`^[A-Za-z0-9_-]{16,64}$\`
- \`files.report_count\`: não-negativo
- \`admin_sessions.github_id\`: numérico
- Coerência de status em \`reports\`: \`pending\` → \`unresolved\`; \`resolved/dismissed\` → exige \`resolved_by\` + \`resolved_at\`

Migrations via \`drizzle-kit\` (\`bun run db:generate\`). Arquivos \`.sql\` gerados nunca são editados manualmente após o commit — uma nova migration é criada em vez disso.

---

## Armazenamento

**Bun native S3 API** — sem o SDK da AWS. Provider-agnóstico: MinIO em local, AWS S3 ou Cloudflare R2 em produção via mesma interface.

Uploads diretos ao storage: sem roteamento de payload binário pelo servidor Hono para uploads grandes em produção. Downloads e previews usam URLs presignadas com TTL curto para reduzir bandwidth da aplicação.

Exceção: downloads one-time passam pelo backend controlado para garantir atomicidade da invalidação.

---

## Decisões de projeto e trade-offs

### Bun como runtime único
Todo o monorepo roda em Bun: runtime, driver SQL, S3 API, test runner. Menos camadas de abstração, sem incompatibilidades de módulos Node/Bun em áreas críticas. Trade-off: dependência de um runtime relativamente recente; algumas libraries do ecossistema Node têm compatibilidade parcial.

### TanStack Start + Hono em processos separados
Web e API são processos distintos. O web proxy \`/api\` para o Hono em dev. Isso mantém as fronteiras limpas — mutações de estado sempre passam pela API, nunca diretamente de server functions do TanStack Start. Trade-off: mais processos para coordenar localmente e em deploy.

### Admin SSR: fallback para hidratação no cliente
Loaders do TanStack Start em rotas autenticadas de admin não conseguem herdar o cookie da requisição de forma confiável no SSR. Solução estável: loader retorna \`{ kind: 'loading' }\` durante SSR, e o bootstrap real acontece na hidratação, onde o navegador já carrega o cookie de sessão. Trade-off: flash de estado de carregamento no admin em navegações diretas.

### Download one-time sem presigned URL direta
Entregar um presigned URL diretamente para um arquivo one-time não garante atomicidade — retentativas de download ou requests parciais poderiam consumir o token sem entrega real. A solução usa UPDATE atômico no PostgreSQL com RETURNING, mais rollback de reserva em caso de falha no storage.

### Reconciliação como garantia independente
Jobs atrasados no BullMQ podem ser perdidos (restart, falha de worker). O reconciliador periódico existe como garantia independente: varre registros em estado transitório, detecta objetos órfãos no storage, corrige expiração que não disparou. Não é redundância — é a segunda linha de consistência.

### Rate limiting com fallback em memória
Redis indisponível não derruba a API. O fallback em memória usa os mesmos thresholds e emite logs de degradação. Em ambientes de réplica única (v1), a perda de consistência entre réplicas é irrelevante. Em escala, o fallback é apenas um buffer de emergência.

### Biome em vez de ESLint + Prettier
Menos configuração, verificação de import boundary via \`noRestrictedImports\`, formatação e lint em uma ferramenta. Trade-off: regras mais restritivas em alguns casos (ex.: proíbe \`.then\` em objetos não-Promise, proíbe \`role="button"\` em elementos não-semânticos) que exigiram ajustes de padrões.

---

## Limitações conhecidas

- Sem criptografia ponta-a-ponta — o operador pode acessar os arquivos no storage
- Sem verificação de malware
- Sem proteção por senha no link
- Admin multi-usuário não suportado
- Preview limitado a: imagens, vídeo, áudio, PDF e texto (\`text/*\`)
- Downloads one-time não têm garantia de entrega confirmada pelo destinatário — a presigned URL é emitida e o evento \`download_completed\` é registrado na emissão, não na transferência completa
- Fallback de rate limiting em memória perde estado em restarts

---

## Ambiente local

\`\`\`sh
# Infraestrutura (PostgreSQL, Redis, MinIO)
cp .env.example .env
docker compose up -d

# Verificar conectividade real (não só container health)
bun run infra:check

# Migrations
bun run db:migrate

# Rodar tudo em paralelo
bun run dev
\`\`\`

Gate de qualidade antes de merge:

\`\`\`sh
bun run verify
# cobre: repo integrity, infra:check, bullmq version parity,
#        typecheck, lint, tests, build, e drift de migrations
\`\`\`

`,
  status: 'published' as const,
  repositoryUrl: 'https://github.com/gustavo-sotero/anonshare.dev',
  liveUrl: 'https://anonshare.dev/',
  featured: true,
  order: 2,
  impactFacts: [
    'Uploads de até 256 MB com preview, expiração configurável e links de uso único.',
    'Download único usa compare-and-set no PostgreSQL e rollback de reserva em falha de entrega.',
    'Reconciliador periódico corrige drift entre banco, filas e storage sem depender do happy path.',
    'GitHub OAuth com allowlist por numeric ID protege o admin com sessão assinada e fluxo simples.',
  ],
  skillSlugs: [
    'typescript',
    'javascript',
    'bun',
    'hono',
    'tanstack-start',
    'react',
    'tailwind',
    'postgresql',
    'redis',
    'drizzle',
    'bullmq',
    'docker',
    'docker-compose',
    'git',
    'github',
    'vps',
  ],
};
