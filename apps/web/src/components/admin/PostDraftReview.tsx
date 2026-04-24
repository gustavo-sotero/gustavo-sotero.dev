'use client';

import {
  canonicalizeTagName,
  type GenerateDraftResponse,
  generateSlug,
  type Tag,
} from '@portfolio/shared';
import { ArrowLeft, Check, Clipboard, ClipboardCheck, RefreshCcw, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

type ApplyableField = 'title' | 'slug' | 'excerpt' | 'content' | 'tagIds';

interface ApplyAllFields {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tagIds: number[];
}

interface PostDraftReviewProps {
  draft: GenerateDraftResponse;
  allTags: Tag[];
  currentValues: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    tagIds?: number[];
  };
  onApplyAll: (fields: ApplyAllFields) => void;
  onApplyField: (field: ApplyableField, value: string | number[]) => void;
  onRegenerate: () => void;
  onBackToTopics: () => void;
  onDiscard: () => void;
  isRegenerating: boolean;
  /**
   * When provided, clicking "apply tags" or "apply all" will auto-create any
   * unmatched AI-suggested names before applying the resolved IDs to the form.
   * Only fires when the admin explicitly accepts the draft.
   */
  resolveAiTags?: (names: string[]) => Promise<number[]>;
}

/**
 * Match suggested tag names (case-insensitive, slug-aware) against the
 * existing tag catalog. Returns two lists: matched tag IDs and unmatched names.
 */
function resolveTagNames(
  suggestedNames: string[],
  allTags: Tag[]
): { matchedIds: number[]; unmatchedNames: string[] } {
  const tagLookup = buildTagLookup(allTags);
  const matchedIds: number[] = [];
  const unmatchedNames: string[] = [];
  const matchedIdSet = new Set<number>();
  const unmatchedNameSet = new Set<string>();

  for (const name of suggestedNames) {
    const trimmedName = name.trim();
    const found = findMatchingTag(trimmedName, tagLookup, allTags);
    if (found) {
      if (!matchedIdSet.has(found.id)) {
        matchedIdSet.add(found.id);
        matchedIds.push(found.id);
      }
    } else {
      const unmatchedKey = normalizeTagKey(trimmedName) || trimmedName.toLowerCase();
      if (trimmedName && !unmatchedNameSet.has(unmatchedKey)) {
        unmatchedNameSet.add(unmatchedKey);
        unmatchedNames.push(trimmedName);
      }
    }
  }

  return { matchedIds, unmatchedNames };
}

function buildTagLookup(allTags: Tag[]): Map<string, Tag> {
  const lookup = new Map<string, Tag>();

  for (const tag of allTags) {
    const exactNameKey = tag.name.trim().toLowerCase();
    const slugKey = normalizeTagKey(tag.slug);
    const generatedNameKey = normalizeTagKey(tag.name);

    if (exactNameKey) {
      lookup.set(exactNameKey, tag);
    }
    if (slugKey) {
      lookup.set(slugKey, tag);
    }
    if (generatedNameKey) {
      lookup.set(generatedNameKey, tag);
    }
  }

  return lookup;
}

function findMatchingTag(
  name: string,
  tagLookup: Map<string, Tag>,
  allTags: Tag[]
): Tag | undefined {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return undefined;
  }

  // 1. Exact name or slug match
  const directMatch =
    tagLookup.get(trimmedName.toLowerCase()) ?? tagLookup.get(normalizeTagKey(trimmedName));
  if (directMatch) return directMatch;

  // 2. Canonical name match — resolves AI casing variants (e.g. "nextjs" → "Next.js")
  const canonicalName = canonicalizeTagName(trimmedName, allTags);
  if (canonicalName !== trimmedName) {
    const canonicalMatch =
      tagLookup.get(canonicalName.toLowerCase()) ?? tagLookup.get(normalizeTagKey(canonicalName));
    if (canonicalMatch) return canonicalMatch;
  }

  return undefined;
}

function normalizeTagKey(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  return generateSlug(trimmedValue);
}

function FieldApplyButton({
  label,
  applied,
  onClick,
  disabled,
}: {
  label: string;
  applied: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'text-xs gap-1.5 h-7 px-2',
        applied
          ? 'text-emerald-400 opacity-70'
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
      )}
    >
      {applied ? <Check className="h-3 w-3" /> : <Wand2 className="h-3 w-3" />}
      {label}
    </Button>
  );
}

export function PostDraftReview({
  draft,
  allTags,
  currentValues,
  onApplyAll,
  onApplyField,
  onRegenerate,
  onBackToTopics,
  onDiscard,
  isRegenerating,
  resolveAiTags,
}: PostDraftReviewProps) {
  const [applied, setApplied] = useState<Partial<Record<ApplyableField | 'all', true>>>({});
  const [imageCopied, setImageCopied] = useState(false);
  const [linkedinCopied, setLinkedinCopied] = useState(false);
  const [isResolvingTags, setIsResolvingTags] = useState(false);

  const tagLookup = buildTagLookup(allTags);
  const { matchedIds, unmatchedNames } = resolveTagNames(draft.suggestedTagNames, allTags);
  const overwriteState = {
    title: hasOverwrite(currentValues.title, draft.title),
    slug: hasOverwrite(currentValues.slug, draft.slug),
    excerpt: hasOverwrite(currentValues.excerpt, draft.excerpt),
    content: hasOverwrite(currentValues.content, draft.content),
    tagIds: hasTagOverwrite(currentValues.tagIds, matchedIds),
  } satisfies Record<ApplyableField, boolean>;
  const overwriteLabels = (Object.entries(overwriteState) as Array<[ApplyableField, boolean]>)
    .filter(([, shouldWarn]) => shouldWarn)
    .map(([field]) => overwriteLabel(field));

  function markApplied(field: ApplyableField | 'all') {
    setApplied((prev) => ({ ...prev, [field]: true }));
  }

  /**
   * Resolve all AI-suggested names to tag IDs.
   * Already-matched tags are kept; unmatched names are auto-created via `resolveAiTags`
   * when the prop is provided. Returns the full deduplicated ID list.
   */
  async function resolveAllTagIds(): Promise<number[] | null> {
    const allIds = [...matchedIds];

    if (unmatchedNames.length > 0 && resolveAiTags) {
      setIsResolvingTags(true);
      try {
        const createdIds = await resolveAiTags(unmatchedNames);
        for (const id of createdIds) {
          if (!allIds.includes(id)) allIds.push(id);
        }
      } catch {
        toast.error('Erro ao criar tags sugeridas pela IA');
        return null;
      } finally {
        setIsResolvingTags(false);
      }
    }

    return allIds;
  }

  async function applyAll() {
    const tagIds = await resolveAllTagIds();
    if (tagIds === null) return;

    onApplyAll({
      title: draft.title,
      slug: draft.slug,
      excerpt: draft.excerpt,
      content: draft.content,
      tagIds,
    });
    markApplied('all');
    toast.success('Draft aplicado ao formulário');
  }

  async function applyField(field: ApplyableField) {
    if (field === 'tagIds') {
      const tagIds = await resolveAllTagIds();
      if (tagIds === null) return;
      onApplyField('tagIds', tagIds);
      markApplied('tagIds');
    } else {
      onApplyField(field, draft[field] as string);
      markApplied(field);
    }
  }

  async function copyImagePrompt() {
    try {
      await navigator.clipboard.writeText(draft.imagePrompt);
      setImageCopied(true);
      toast.success('Prompt de imagem copiado');
      setTimeout(() => setImageCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  }

  async function copyLinkedinPost() {
    try {
      await navigator.clipboard.writeText(draft.linkedinPost);
      setLinkedinCopied(true);
      toast.success('Texto para LinkedIn copiado');
      setTimeout(() => setLinkedinCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  }

  return (
    <div className="pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-300">Revisão do draft gerado</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-xs text-zinc-500 hover:text-zinc-300 gap-1.5"
          >
            <RefreshCcw className={cn('h-3 w-3', isRegenerating && 'animate-spin')} />
            Regenerar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBackToTopics}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Temas
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Descartar
          </Button>
        </div>
      </div>

      {/* Apply all */}
      <Button
        type="button"
        onClick={() => {
          void applyAll();
        }}
        disabled={isRegenerating || isResolvingTags}
        className={cn(
          'w-full gap-2',
          applied.all
            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
            : 'bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400'
        )}
      >
        {applied.all ? (
          <>
            <Check className="h-4 w-4" /> Draft aplicado
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" /> Aplicar tudo ao formulário
          </>
        )}
      </Button>
      {overwriteLabels.length > 0 && !applied.all && (
        <p className="text-xs text-amber-400">
          Aplicar tudo vai sobrescrever: {overwriteLabels.join(', ')}.
        </p>
      )}

      {/* Field preview rows */}
      <div className="space-y-2 divide-y divide-zinc-800/60">
        {/* Title */}
        <DraftFieldRow
          label="Título"
          value={draft.title}
          fieldName="title"
          applied={!!applied.title || !!applied.all}
          isRegenerating={isRegenerating}
          onApply={() => applyField('title')}
          willOverwrite={overwriteState.title}
        />

        {/* Slug */}
        <DraftFieldRow
          label="Slug"
          value={draft.slug}
          fieldName="slug"
          applied={!!applied.slug || !!applied.all}
          isRegenerating={isRegenerating}
          onApply={() => applyField('slug')}
          willOverwrite={overwriteState.slug}
          mono
        />

        {/* Excerpt */}
        <DraftFieldRow
          label="Resumo"
          value={draft.excerpt}
          fieldName="excerpt"
          applied={!!applied.excerpt || !!applied.all}
          isRegenerating={isRegenerating}
          onApply={() => applyField('excerpt')}
          willOverwrite={overwriteState.excerpt}
        />

        {/* Content */}
        <DraftFieldRow
          label="Conteúdo"
          value={`${draft.content.slice(0, 120)}…`}
          fieldName="content"
          applied={!!applied.content || !!applied.all}
          isRegenerating={isRegenerating}
          onApply={() => applyField('content')}
          willOverwrite={overwriteState.content}
          fullValueNote={`${draft.content.split('\n').length} linhas de Markdown`}
        />

        {/* Tags */}
        <div className="pt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Tags</span>
            <FieldApplyButton
              label="Aplicar tags"
              applied={!!applied.tagIds || !!applied.all}
              onClick={() => {
                void applyField('tagIds');
              }}
              disabled={
                isRegenerating ||
                isResolvingTags ||
                (matchedIds.length === 0 && unmatchedNames.length === 0) ||
                (matchedIds.length === 0 && !resolveAiTags)
              }
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {draft.suggestedTagNames.map((name) => {
              const isMatched = !!findMatchingTag(name, tagLookup, allTags);
              return (
                <Badge
                  key={name}
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    isMatched
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700 line-through opacity-60'
                  )}
                >
                  {name}
                </Badge>
              );
            })}
          </div>
          {unmatchedNames.length > 0 && (
            <p className="text-xs text-zinc-600">
              {resolveAiTags
                ? 'Tags riscadas serão criadas automaticamente ao aplicar.'
                : 'Tags riscadas não existem no catálogo. Crie-as manualmente para aplicar.'}
            </p>
          )}
          {overwriteState.tagIds && !applied.tagIds && !applied.all && (
            <p className="text-xs text-amber-400">
              Aplicar tags substitui as tags atuais do formulário.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
        <span className="text-xs font-medium text-zinc-400">Preview do conteúdo</span>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-zinc-500">
          {draft.content}
        </pre>
      </div>

      {/* Image prompt */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">Prompt de imagem</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyImagePrompt}
            className="text-xs text-zinc-500 hover:text-zinc-300 h-6 px-2 gap-1.5"
          >
            {imageCopied ? (
              <ClipboardCheck className="h-3 w-3 text-emerald-400" />
            ) : (
              <Clipboard className="h-3 w-3" />
            )}
            {imageCopied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">{draft.imagePrompt}</p>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Use este prompt em um gerador externo. Ele não preenche a capa automaticamente nem altera
          o coverUrl do post.
        </p>
      </div>

      {/* LinkedIn post */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">Texto para LinkedIn</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyLinkedinPost}
            className="text-xs text-zinc-500 hover:text-zinc-300 h-6 px-2 gap-1.5"
          >
            {linkedinCopied ? (
              <ClipboardCheck className="h-3 w-3 text-emerald-400" />
            ) : (
              <Clipboard className="h-3 w-3" />
            )}
            {linkedinCopied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-line">
          {draft.linkedinPost}
        </p>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Copie e cole diretamente no LinkedIn. Não altera nenhum campo do formulário do post.
        </p>
      </div>

      {/* Notes from AI */}
      {draft.notes && (
        <div className="rounded-md border border-amber-900/30 bg-amber-950/20 px-3 py-2">
          <p className="text-xs text-amber-400">{draft.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-component ──────────────────────────────────────────────────────

function DraftFieldRow({
  label,
  value,
  fieldName: _fieldName,
  applied,
  isRegenerating,
  onApply,
  willOverwrite,
  mono = false,
  fullValueNote,
}: {
  label: string;
  value: string;
  fieldName: string;
  applied: boolean;
  isRegenerating: boolean;
  onApply: () => void;
  willOverwrite: boolean;
  mono?: boolean;
  fullValueNote?: string;
}) {
  return (
    <div className="pt-2 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">{label}</span>
          {willOverwrite && !applied && (
            <Badge
              variant="secondary"
              className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-300"
            >
              Sobrescreve
            </Badge>
          )}
        </div>
        <FieldApplyButton
          label={`Aplicar ${label.toLowerCase()}`}
          applied={applied}
          onClick={onApply}
          disabled={isRegenerating}
        />
      </div>
      <p className={cn('text-xs text-zinc-500 leading-relaxed', mono && 'font-mono')}>{value}</p>
      {fullValueNote && <p className="text-xs text-zinc-700">{fullValueNote}</p>}
      {willOverwrite && !applied && (
        <p className="text-xs text-amber-400">Substitui o valor atual do formulário.</p>
      )}
    </div>
  );
}

function hasOverwrite(currentValue: string | undefined, nextValue: string): boolean {
  const current = currentValue?.trim() ?? '';
  return current.length > 0 && current !== nextValue.trim();
}

function hasTagOverwrite(currentTagIds: number[] | undefined, nextTagIds: number[]): boolean {
  const current = currentTagIds ?? [];
  if (current.length === 0) {
    return false;
  }

  return !haveSameNumberSet(current, nextTagIds);
}

function haveSameNumberSet(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  return right.every((value) => leftSet.has(value));
}

function overwriteLabel(field: ApplyableField): string {
  switch (field) {
    case 'title':
      return 'título';
    case 'slug':
      return 'slug';
    case 'excerpt':
      return 'resumo';
    case 'content':
      return 'conteúdo';
    case 'tagIds':
      return 'tags';
  }
}
