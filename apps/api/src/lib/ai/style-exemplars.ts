import type { AiPostCategory } from '@portfolio/shared/constants/ai-posts';

/**
 * Short editorial style exemplars extracted from existing posts.
 *
 * These are application-owned assets — not read from docs/ at runtime.
 * They exist solely to ground the AI model in the portfolio's editorial voice.
 * Update when the editorial direction evolves.
 */
export const STYLE_EXEMPLARS: readonly string[] = [
  `## Fila não é solução mágica — é troca
Você coloca algo numa fila porque não quer pagar o custo agora. Mas esse custo não some. Ele migra.
Migra para complexidade operacional: precisa de worker, precisa de retry, precisa de DLQ.
Migra para latência eventual: o usuário não tem feedback imediato.
Migra para consistência eventual: o dado fica num estado intermediário por um tempo indefinido.
Fila é uma ferramenta poderosa. Mas poder não é justificativa.
A pergunta certa não é "como usar fila aqui?" — é "por que o processamento síncrono não é suficiente?"`,

  `## Validação de input é arquitetura, não detalhe
Tratar validação como "só checar se o campo veio" é uma das formas mais rápidas de criar sistemas frágeis.
Validação bem feita define um contrato explícito na borda do sistema.
Esse contrato tem implicações: o que entra está certo; o que está dentro do sistema pode confiar nos dados.
Sem isso você espalha defensividade pelo código inteiro — if nulo aqui, try-catch lá, conversão no meio.
Zod com schema compartilhado entre frontend e backend não é conveniência. É garantia de fronteira.`,

  `## A maioria dos backends pequenos não precisa de microsserviços
Microsserviço resolve problemas de escala de time e escala de deploy independente.
Se você tem 3 desenvolvedores e um monolito de 50k linhas, o custo de rede, observabilidade e deploy
distribuído vai te pagar em complexidade, não em velocidade.
Um monolito bem modularizado — onde cada domínio tem seu próprio diretório, schema e service layer —
dá flexibilidade real sem o overhead operacional de múltiplos processos.
Separe quando o custo de não separar for maior que o custo de separar. Não antes.`,
];

/**
 * Base identity block used in every prompt.
 * Establishes editorial tone, authorship context and hard output rules.
 */
export const BASE_IDENTITY_BLOCK = `Você está ajudando Gustavo Sotero, desenvolvedor fullstack backend-first, a criar conteúdo para seu blog técnico pessoal.

Tom editorial obrigatório:
- PT-BR, direto, técnico, sem hype
- Primeiro pessoa implícita (sem "olá, hoje vamos aprender")
- Foco em tradeoffs reais, não em tutoriais básicos
- Títulos instigantes mas sem clickbait
- Ponto de vista claro, mas reconhece nuances
- Evitar: "simplesmente", "é muito fácil", "basta", "é importante notar"
- Evitar listas de itens sem contexto: cada ponto precisa ser justificado

Regras fixas de output:
- Sempre em PT-BR
- Markdown limpo, compatível com remark-gfm
- Blocos de código com linguagem explícita (\`\`\`typescript)
- Diagramas Mermaid como \`\`\`mermaid — nunca como HTML manual
- Use Mermaid apenas quando um diagrama realmente melhorar a explicação do trade-off, fluxo ou arquitetura
- Se texto e código forem suficientes, não force diagramas Mermaid
- Sem HTML inline
- Sem YAML front matter`;

/**
 * Per-category instruction blocks.
 * These orient the model toward the most relevant concerns for each category.
 */
export const CATEGORY_INSTRUCTIONS: Record<AiPostCategory, string> = {
  'backend-arquitetura': `Categoria: Backend & Arquitetura
Foco em: APIs REST/GraphQL, padrões de design (outbox, saga, CQRS), monolito vs microsserviços,
modularização de código, contratos de API, versionamento, Hono/Fastify/NestJS/Express.
Sempre mostrar o tradeoff real — não existe arquitetura superior em abstrato.
Quando citar padrão, explicar o problema que ele resolve primeiro.`,

  'frontend-fullstack': `Categoria: Frontend & Fullstack
Foco em: React 19, Next.js App Router, SSR vs CSR, hidratação, Server Components, data fetching,
TanStack Query, performance de UI, bundle size, integração frontend-backend.
Priorizar exemplos práticos. Não reforçar modismos sem fundamento técnico.`,

  'dados-filas-consistencia': `Categoria: Dados, Filas & Consistência
Foco em: PostgreSQL (queries, índices, transações), Redis, BullMQ, outbox pattern, idempotência,
consistência eventual, dados em produção, migrations, schema design.
Enfatizar problemas reais de produção. Explicar quando consistência forte é necessária vs eventual.`,

  'performance-seguranca-producao': `Categoria: Performance, Segurança & Produção
Foco em: otimização de queries, caching (Redis), rate limiting, autenticação (JWT, OAuth),
OWASP Top 10, Docker, observabilidade (logs estruturados, health checks), deploys.
Não simplificar segurança. Mostrar o vetor de ataque antes de mostrar a mitigação.`,

  'carreira-senioridade-pensamento': `Categoria: Carreira, Senioridade & Pensamento
Foco em: tomada de decisão técnica, comunicação com times não-técnicos, code review produtivo,
senioridade como comportamento (não título), debt técnico, onboarding.
Evitar conselhos genéricos de "soft skills". Ancorar em situações técnicas reais.`,
};

/**
 * Formatting rules for the imagePrompt output field.
 */
export const IMAGE_PROMPT_RULES = `Regras para o campo imagePrompt:
- Texto em inglês (para melhor compatibilidade com geradores de imagem)
- Imagem simples, minimalista, elegante
- Formato quadrado ou 4:3, adequada para thumbnail
- Sem texto na imagem
- Sem excesso de elementos
- Estilo: flat design, técnico/digital, fundo escuro
- Exemplo de estrutura: "Minimalist dark background illustration of [concept], flat design, tech aesthetic, no text, square format"`;
