import { tags } from '@portfolio/shared/db/schema';
import type { PersistedTagForNormalization } from '@portfolio/shared/lib/aiTagNormalizer';
import {
  type ProviderRoutingConfig,
  providerRoutingConfigSchema,
} from '@portfolio/shared/schemas/ai-post-generation-config';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../config/db';

export type ActiveRunStatus = 'running' | 'validating';

type UpdatableRunTable = {
  id: unknown;
  $inferInsert: Record<string, unknown>;
};

type ClaimableRunTable = UpdatableRunTable & {
  status: unknown;
};

export async function claimQueuedAiRun<TClaimedRow>(
  runTable: ClaimableRunTable,
  runId: string,
  attemptCount: number
): Promise<TClaimedRow | undefined> {
  const now = new Date();
  const [claimed] = await db
    .update(runTable as never)
    .set({
      status: 'running',
      stage: 'resolving-config',
      startedAt: now,
      lastHeartbeatAt: now,
      updatedAt: now,
      attemptCount,
      errorKind: null,
      errorCode: null,
      errorMessage: null,
    } as never)
    .where(and(eq(runTable.id, runId), eq(runTable.status, 'queued')))
    .returning();

  return claimed as TClaimedRow | undefined;
}

export async function markAiRunMissingModelId(
  runTable: UpdatableRunTable,
  runId: string
): Promise<void> {
  await db
    .update(runTable as never)
    .set({
      status: 'failed',
      stage: 'failed',
      finishedAt: new Date(),
      updatedAt: new Date(),
      errorKind: 'config',
      errorCode: 'NO_MODEL_ID',
      errorMessage: 'Run created without a resolved model ID.',
    } as never)
    .where(eq(runTable.id, runId));
}

export async function setAiRunStage(
  runTable: UpdatableRunTable,
  runId: string,
  stage: string,
  status?: ActiveRunStatus
): Promise<void> {
  const update: Record<string, unknown> = {
    stage,
    lastHeartbeatAt: new Date(),
    updatedAt: new Date(),
  };

  if (status) {
    update.status = status;
  }

  await db
    .update(runTable as never)
    .set(update as never)
    .where(eq(runTable.id, runId));
}

export async function loadPersistedTagsForNormalization(): Promise<PersistedTagForNormalization[]> {
  return db.select({ name: tags.name, slug: tags.slug }).from(tags).orderBy(asc(tags.name));
}

export async function loadAiProviderRoutingConfig(
  kind: 'draft' | 'topics'
): Promise<ProviderRoutingConfig | undefined> {
  try {
    const settings = await db.query.aiPostGenerationSettings.findFirst();
    const rawRouting =
      kind === 'draft' ? (settings?.draftRouting ?? null) : (settings?.topicsRouting ?? null);
    const parsedRouting = providerRoutingConfigSchema.safeParse(rawRouting);
    return parsedRouting.success ? (parsedRouting.data ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}
