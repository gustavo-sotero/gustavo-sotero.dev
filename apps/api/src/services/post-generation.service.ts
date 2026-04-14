import type { GenerateDraftRequest, GenerateTopicsRequest } from '@portfolio/shared';
import {
  AI_POST_CATEGORY_META,
  AI_POST_DEFAULT_SUGGESTIONS,
  AI_POST_MAX_DRAFT_TAG_NAMES,
  AI_POST_MAX_SUGGESTIONS,
  AI_POST_MAX_TOPIC_TAG_NAMES,
  generateDraftOutputSchema,
  generateDraftResponseSchema,
  generateTopicsOutputSchema,
  generateTopicsResponseSchema,
} from '@portfolio/shared';
import { generateSlug } from '@portfolio/shared/lib/slug';
import type {
  GenerateDraftResponse,
  GenerateTopicsResponse,
  TopicSuggestion,
} from '@portfolio/shared/types/ai-post-generation';
import { env } from '../config/env';
import { getLogger } from '../config/logger';
import { AiGenerationError, generateStructuredObject } from '../lib/ai/generateStructuredObject';
import {
  BASE_IDENTITY_BLOCK,
  CATEGORY_INSTRUCTIONS,
  IMAGE_PROMPT_RULES,
  STYLE_EXEMPLARS,
} from '../lib/ai/style-exemplars';
import { resolveActiveAiPostGenerationConfig } from './ai-post-generation-settings.service';

const logger = getLogger('services', 'post-generation');

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildTopicsSystemPrompt(category: string): string {
  const categoryBlock = CATEGORY_INSTRUCTIONS[category as keyof typeof CATEGORY_INSTRUCTIONS] ?? '';
  return `${BASE_IDENTITY_BLOCK}

${categoryBlock}

Sua tarefa: sugerir temas de posts para o blog técnico.
Cada sugestão deve ter ângulo original, proposta clara e utilidade real para o leitor-alvo.
Evite temas genéricos como "o que é Docker" ou "introdução a X".
Prefira recortes específicos: um tradeoff, uma decisão de engenharia, um erro comum.`;
}

function buildTopicsUserPrompt(req: GenerateTopicsRequest): string {
  const parts: string[] = [];

  if (req.briefing) {
    parts.push(`Briefing do autor:\n${req.briefing}`);
  }

  if (req.excludedIdeas.length > 0) {
    parts.push(
      `Ângulos a evitar (usados em gerações anteriores):\n${req.excludedIdeas.map((e) => `- ${e}`).join('\n')}`
    );
  }

  parts.push(
    `Gere exatamente ${req.limit} sugestões de tema para a categoria "${categoryLabel(req.category)}".\nCada sugestão deve ter suggestionId único (string curta), proposedTitle, angle, summary (2-3 frases), targetReader, suggestedTagNames (máx ${AI_POST_MAX_TOPIC_TAG_NAMES}) e rationale (1 frase curta).`
  );

  return parts.join('\n\n');
}

function buildDraftSystemPrompt(category: string): string {
  const categoryBlock = CATEGORY_INSTRUCTIONS[category as keyof typeof CATEGORY_INSTRUCTIONS] ?? '';
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

function buildDraftUserPrompt(req: GenerateDraftRequest): string {
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
    `Produza o draft completo com os campos: title, slug (URL-safe, PT-BR), excerpt (máx 500 caracteres), content (Markdown), suggestedTagNames (máx ${AI_POST_MAX_DRAFT_TAG_NAMES}), imagePrompt (inglês), notes (nullable — use para qualquer aviso editorial).`
  );

  return parts.join('\n\n');
}

function categoryLabel(category: string): string {
  return AI_POST_CATEGORY_META[category as keyof typeof AI_POST_CATEGORY_META]?.label ?? category;
}

// ── Output normalization ──────────────────────────────────────────────────────

function normalizeSuggestion(s: TopicSuggestion): TopicSuggestion {
  return {
    ...s,
    suggestionId: s.suggestionId.trim() || crypto.randomUUID().slice(0, 8),
    proposedTitle: s.proposedTitle.trim(),
    angle: s.angle.trim(),
    summary: s.summary.trim(),
    targetReader: s.targetReader.trim(),
    rationale: s.rationale.trim(),
    suggestedTagNames: deduplicateTags(s.suggestedTagNames).slice(0, AI_POST_MAX_TOPIC_TAG_NAMES),
  };
}

function normalizeTopicsResponse(
  raw: GenerateTopicsResponse,
  limit: number
): GenerateTopicsResponse {
  const unique = deduplicateSuggestions(raw.suggestions.map(normalizeSuggestion));
  const parsed = generateTopicsResponseSchema.safeParse({ suggestions: unique.slice(0, limit) });
  if (!parsed.success) {
    throw new AiGenerationError(
      'validation',
      'Generated topics did not satisfy the response contract'
    );
  }
  return parsed.data;
}

function normalizeDraftResponse(raw: GenerateDraftResponse): GenerateDraftResponse {
  const title = raw.title.trim();
  const slug = generateSlug(raw.slug.trim() || title);
  const excerpt = raw.excerpt.trim();
  const content = normalizeContent(raw.content);

  if (containsDisallowedInlineHtml(content)) {
    throw new AiGenerationError(
      'validation',
      'Generated draft contained inline HTML instead of clean Markdown'
    );
  }

  const imagePrompt = raw.imagePrompt.trim() || buildFallbackImagePrompt(title);
  const suggestedTagNames = deduplicateTags(raw.suggestedTagNames).slice(
    0,
    AI_POST_MAX_DRAFT_TAG_NAMES
  );
  const notes = raw.notes?.trim() ?? null;

  const parsed = generateDraftResponseSchema.safeParse({
    title,
    slug,
    excerpt,
    content,
    suggestedTagNames,
    imagePrompt,
    notes,
  });
  if (!parsed.success) {
    throw new AiGenerationError(
      'validation',
      'Generated draft is too short or missing required fields'
    );
  }

  return parsed.data;
}

function normalizeContent(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const lastLine = lines.at(-1)?.trim() ?? '';

  // Unwrap only explicit markdown wrappers so legitimate leading/trailing
  // code fences (for example ```mermaid at the start of the draft) stay intact.
  if (/^```(?:markdown|md)\s*$/i.test(firstLine) && lastLine === '```') {
    return lines.slice(1, -1).join('\n').trim();
  }

  return normalized;
}

const DISALLOWED_INLINE_HTML_RE = /<\/?[a-z][\w:-]*(?:\s[^<>]*)?>|<!--|<!doctype\b/i;

function containsDisallowedInlineHtml(content: string): boolean {
  let inCodeFence = false;
  const outsideCodeFenceLines: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (!inCodeFence) {
      outsideCodeFenceLines.push(line);
    }
  }

  return DISALLOWED_INLINE_HTML_RE.test(outsideCodeFenceLines.join('\n'));
}

function deduplicateTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((t) => {
    const trimmed = t.trim();
    if (!trimmed) {
      return false;
    }

    const key = generateSlug(trimmed);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateSuggestions(suggestions: TopicSuggestion[]): TopicSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = generateSlug(s.proposedTitle);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFallbackImagePrompt(title: string): string {
  return `Minimalist dark background illustration representing "${title}", flat design, tech aesthetic, no text, square format`;
}

function normalizeBriefing(briefing: string | null): string | null {
  const normalized = briefing?.trim() ?? '';
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, env.AI_POSTS_MAX_BRIEFING_CHARS);
}

function normalizeTopicsRequest(req: GenerateTopicsRequest): GenerateTopicsRequest {
  return {
    ...req,
    briefing: normalizeBriefing(req.briefing),
    limit: Math.min(
      req.limit ?? AI_POST_DEFAULT_SUGGESTIONS,
      env.AI_POSTS_MAX_SUGGESTIONS,
      AI_POST_MAX_SUGGESTIONS
    ),
    excludedIdeas: req.excludedIdeas.map((idea) => idea.trim()).filter(Boolean),
  };
}

function normalizeDraftRequest(req: GenerateDraftRequest): GenerateDraftRequest {
  return {
    ...req,
    briefing: normalizeBriefing(req.briefing),
    selectedSuggestion: normalizeSuggestion(req.selectedSuggestion),
    rejectedAngles: req.rejectedAngles.map((angle) => angle.trim()).filter(Boolean),
  };
}

function logValidationFailure(
  operation: 'topics' | 'draft',
  category: string,
  model: string,
  error: string
) {
  logger.warn('AI post generation validation failed after normalization', {
    operation,
    category,
    model,
    success: false,
    timeout: false,
    refusal: false,
    validationFailure: true,
    error,
  });
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Generate topic suggestions for the AI post generation assistant.
 *
 * Returns a structured list of editorial theme suggestions for the given
 * category. Nothing is persisted — the result is ephemeral.
 *
 * Throws `AiGenerationError` on provider failure, timeout, or refusal.
 * Throws a generic Error if the feature is disabled.
 */
export async function generateTopicSuggestions(
  req: GenerateTopicsRequest
): Promise<GenerateTopicsResponse> {
  const activeConfig = await resolveActiveAiPostGenerationConfig();
  const normalizedReq = normalizeTopicsRequest(req);
  const model = activeConfig.topicsModelId;

  try {
    const result = await generateStructuredObject({
      model,
      system: buildTopicsSystemPrompt(normalizedReq.category),
      prompt: buildTopicsUserPrompt(normalizedReq),
      schema: generateTopicsOutputSchema,
      operation: 'topics',
      metadata: { category: normalizedReq.category },
    });

    return normalizeTopicsResponse(result.object as GenerateTopicsResponse, normalizedReq.limit);
  } catch (err) {
    if (err instanceof AiGenerationError && err.kind === 'validation') {
      logValidationFailure('topics', normalizedReq.category, model, err.message);
    }
    throw err;
  }
}

/**
 * Generate a complete post draft from an approved topic suggestion.
 *
 * Returns structured editorial content for all form fields. Nothing is
 * persisted — the result requires explicit user approval in the admin UI.
 *
 * Throws `AiGenerationError` on provider failure, timeout, or refusal.
 * Throws a generic Error if the feature is disabled.
 */
export async function generatePostDraft(req: GenerateDraftRequest): Promise<GenerateDraftResponse> {
  const activeConfig = await resolveActiveAiPostGenerationConfig();
  const normalizedReq = normalizeDraftRequest(req);
  const model = activeConfig.draftModelId;

  try {
    const result = await generateStructuredObject({
      model,
      system: buildDraftSystemPrompt(normalizedReq.category),
      prompt: buildDraftUserPrompt(normalizedReq),
      schema: generateDraftOutputSchema,
      operation: 'draft',
      metadata: { category: normalizedReq.category },
    });

    return normalizeDraftResponse(result.object as GenerateDraftResponse);
  } catch (err) {
    if (err instanceof AiGenerationError && err.kind === 'validation') {
      logValidationFailure('draft', normalizedReq.category, model, err.message);
    }
    throw err;
  }
}
