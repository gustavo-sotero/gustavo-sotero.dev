/**
 * AI post generation prompt constants and builders.
 *
 * Centralised in shared so both the API (sync draft) and the worker
 * (async draft job) can use the same editorial content without duplication.
 */

import type { AiPostRequestedCategory } from '../constants/ai-posts';
import type { GenerateDraftRequest } from '../schemas/ai-post-generation';

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
 * Includes 'misto' for mixed-category generation requests.
 */
export const CATEGORY_INSTRUCTIONS: Record<AiPostRequestedCategory, string> = {
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

  misto: `Categoria: Misto — sem restrição temática
Gere sugestões ou draft em qualquer uma das categorias editoriais disponíveis:
Backend & Arquitetura, Frontend & Fullstack, Dados/Filas/Consistência, Performance/Segurança/Produção ou Carreira/Senioridade.
Escolha a categoria mais relevante para o briefing fornecido.
Se não houver briefing, priorize os temas mais úteis para o leitor do portfólio técnico de Gustavo.
Cada sugestão ou draft gerado DEVE ser atribuído a uma categoria concreta (nunca retorne 'misto' como categoria do item).`,
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

// ── Prompt builders ───────────────────────────────────────────────────────────

export function buildDraftSystemPrompt(category: AiPostRequestedCategory | string): string {
  const categoryBlock = CATEGORY_INSTRUCTIONS[category as AiPostRequestedCategory] ?? '';
  const exemplarsBlock = STYLE_EXEMPLARS.slice(0, 3)
    .map((e, i) => `--- Exemplar ${i + 1} ---\n${e}`)
    .join('\n\n');

  return `${BASE_IDENTITY_BLOCK}

${categoryBlock}

Exemplos do estilo editorial esperado (use para calibrar tom e densidade, não para copiar):
${exemplarsBlock}

${IMAGE_PROMPT_RULES}

Sua tarefa: escrever um draft completo de post técnico de blog.
O conteúdo deve ser substantivo, direto ao ponto, com exemplos de código quando relevante.
Tamanho alvo: 600-1200 palavras para o post.
Use blocos \`\`\`mermaid apenas quando eles ajudarem materialmente a compreensão do texto; se prosa e código bastarem, não force diagramas.
Formatação: Markdown limpo, headings H2/H3, sem H1 (o título é o H1 da página).`;
}

export function buildTopicsSystemPrompt(category: AiPostRequestedCategory | string): string {
  const categoryBlock = CATEGORY_INSTRUCTIONS[category as AiPostRequestedCategory] ?? '';
  return `${BASE_IDENTITY_BLOCK}

${categoryBlock}

Sua tarefa: sugerir temas de posts para o blog técnico.
Cada sugestão deve ter ângulo original, proposta clara e utilidade real para o leitor-alvo.
Evite temas genéricos como "o que é Docker" ou "introdução a X".
Prefira recortes específicos: um tradeoff, uma decisão de engenharia, um erro comum.`;
}

export function buildDraftUserPrompt(req: GenerateDraftRequest): string {
  const parts: string[] = [];
  const s = req.selectedSuggestion;

  parts.push(
    `Tema escolhido:
Título provisório: ${s.proposedTitle}
Ângulo: ${s.angle}
Resumo: ${s.summary}
Leitor-alvo: ${s.targetReader}
Tags sugeridas: ${s.suggestedTagNames.join(', ')}`
  );

  if (req.briefing) {
    parts.push(`Briefing complementar do autor:\n${req.briefing}`);
  }

  if (req.rejectedAngles.length > 0) {
    parts.push(
      `Ângulos a evitar nesta regeneração:\n${req.rejectedAngles.map((a) => `- ${a}`).join('\n')}`
    );
  }

  parts.push(
    `Produza o draft completo com os campos: title, slug (URL-safe, PT-BR), excerpt (máx 500 caracteres), content (Markdown), suggestedTagNames (máx 8), imagePrompt (inglês), notes (nullable — use para qualquer aviso editorial).`
  );

  return parts.join('\n\n');
}
