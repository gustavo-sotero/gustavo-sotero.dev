/**
 * Editorial category definitions for AI-assisted post generation.
 *
 * Each entry has:
 *  - value: stable enum key used in API contracts and logs
 *  - label: PT-BR display label for the admin UI
 *  - description: short orientation hint surfaced in prompts
 *
 * Type contract:
 *  - AiPostConcreteCategory — the five real editorial categories. Used in
 *    topic suggestion items and draft requests where a concrete domain is needed.
 *  - AiPostRequestedCategory — adds 'misto' for generation requests that may
 *    span multiple domains. Not valid in suggestion items.
 */

export const AI_POST_CONCRETE_CATEGORIES = [
  'backend-arquitetura',
  'frontend-fullstack',
  'dados-filas-consistencia',
  'performance-seguranca-producao',
  'carreira-senioridade-pensamento',
] as const;

/** All concrete editorial categories (valid in topic items and draft requests). */
export type AiPostConcreteCategory = (typeof AI_POST_CONCRETE_CATEGORIES)[number];

/** All categories that can be requested (concrete + misto for mixed generation). */
export type AiPostRequestedCategory = AiPostConcreteCategory | 'misto';

/**
 * @deprecated Use `AiPostConcreteCategory` (for items/drafts) or
 * `AiPostRequestedCategory` (for request inputs). Kept for back-compat.
 */
export type AiPostCategory = AiPostConcreteCategory;

/** Combined array for schemas that must allow misto in requests. */
export const AI_POST_REQUESTED_CATEGORIES: readonly AiPostRequestedCategory[] = [
  ...AI_POST_CONCRETE_CATEGORIES,
  'misto',
] as const;

// Alias to keep existing consumers working unchanged.
export const AI_POST_CATEGORIES = AI_POST_CONCRETE_CATEGORIES;

export const AI_POST_MAX_BRIEFING_CHARS = 1000;
export const AI_POST_MIN_SUGGESTIONS = 3;
export const AI_POST_MAX_SUGGESTIONS = 5;
export const AI_POST_DEFAULT_SUGGESTIONS = 4;
export const AI_POST_MAX_TOPIC_TAG_NAMES = 6;
export const AI_POST_MAX_DRAFT_TAG_NAMES = 8;
export const AI_POST_MAX_EXCLUDED_ITEMS = 10;
export const AI_POST_MAX_EXCLUDED_TEXT_CHARS = 300;
export const AI_POST_MAX_EXCERPT_CHARS = 500;
export const AI_POST_MIN_DRAFT_CONTENT_CHARS = 100;

// ── Draft Run constants ───────────────────────────────────────────────────────

export const AI_POST_DRAFT_RUN_STATUSES = [
  'queued',
  'running',
  'validating',
  'completed',
  'failed',
  'timed_out',
] as const;

export type AiPostDraftRunStatus = (typeof AI_POST_DRAFT_RUN_STATUSES)[number];

export const AI_POST_DRAFT_RUN_STAGES = [
  'queued',
  'resolving-config',
  'building-prompt',
  'requesting-provider',
  'normalizing-output',
  'canonicalizing-tags',
  'validating-output',
  'persisting-result',
  'completed',
  'failed',
  'timed-out',
] as const;

export type AiPostDraftRunStage = (typeof AI_POST_DRAFT_RUN_STAGES)[number];

/** Initial poll interval (ms) recommended by the server after run creation. */
export const AI_POST_DRAFT_RUN_INITIAL_POLL_MS = 1000;

// ── Category metadata ─────────────────────────────────────────────────────────

export interface AiPostCategoryMeta {
  value: AiPostRequestedCategory;
  label: string;
  description: string;
}

export const AI_POST_CATEGORY_META: Record<AiPostRequestedCategory, AiPostCategoryMeta> = {
  'backend-arquitetura': {
    value: 'backend-arquitetura',
    label: 'Backend & Arquitetura',
    description:
      'APIs, microsserviços, monolitos modulares, padrões de design, trade-offs de arquitetura',
  },
  'frontend-fullstack': {
    value: 'frontend-fullstack',
    label: 'Frontend & Fullstack',
    description:
      'React, Next.js, SSR, hidratação, bundling, performance de UI, integração frontend-backend',
  },
  'dados-filas-consistencia': {
    value: 'dados-filas-consistencia',
    label: 'Dados, Filas & Consistência',
    description:
      'PostgreSQL, Redis, BullMQ, transações, idempotência, outbox pattern, consistência eventual',
  },
  'performance-seguranca-producao': {
    value: 'performance-seguranca-producao',
    label: 'Performance, Segurança & Produção',
    description:
      'Otimização de queries, cache, rate limiting, autenticação, OWASP, Docker, observabilidade',
  },
  'carreira-senioridade-pensamento': {
    value: 'carreira-senioridade-pensamento',
    label: 'Carreira, Senioridade & Pensamento',
    description:
      'Soft skills técnicos, tomada de decisão em engenharia, senioridade, comunicação com times, code review',
  },
  misto: {
    value: 'misto',
    label: 'Misto',
    description:
      'Sugestões podem vir de qualquer categoria editorial existente, sem exigir uniformidade entre elas',
  },
};
