/**
 * Editorial category definitions for AI-assisted post generation.
 *
 * Each entry has:
 *  - value: stable enum key used in API contracts and logs
 *  - label: PT-BR display label for the admin UI
 *  - description: short orientation hint surfaced in prompts
 */

export const AI_POST_CATEGORIES = [
  'backend-arquitetura',
  'frontend-fullstack',
  'dados-filas-consistencia',
  'performance-seguranca-producao',
  'carreira-senioridade-pensamento',
] as const;

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

export type AiPostCategory = (typeof AI_POST_CATEGORIES)[number];

export interface AiPostCategoryMeta {
  value: AiPostCategory;
  label: string;
  description: string;
}

export const AI_POST_CATEGORY_META: Record<AiPostCategory, AiPostCategoryMeta> = {
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
};
