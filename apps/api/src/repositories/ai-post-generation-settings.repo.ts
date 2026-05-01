import { aiPostGenerationSettings } from '@portfolio/shared/db/schema';
import type { ProviderRoutingConfig } from '@portfolio/shared/schemas/ai-post-generation-config';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';

/**
 * Repository for the singleton AI post generation settings row.
 *
 * The table uses `scope = 'global'` as a fixed primary key, so there is at
 * most one row per instance. All methods work with that single record.
 */

export interface UpsertAiPostGenerationSettingsInput {
  topicsModelId: string;
  draftModelId: string;
  topicsRouting?: ProviderRoutingConfig | null;
  draftRouting?: ProviderRoutingConfig | null;
  updatedBy: string;
}

/** Retrieve the global AI post generation settings row, or null if absent. */
export async function findAiPostGenerationSettings() {
  const rows = await db
    .select()
    .from(aiPostGenerationSettings)
    .where(eq(aiPostGenerationSettings.scope, 'global'))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Upsert the global AI post generation settings row.
 *
 * Creates the row on first save, overwrites it on subsequent saves.
 * Returns the persisted row.
 */
export async function upsertAiPostGenerationSettings(input: UpsertAiPostGenerationSettingsInput) {
  const [row] = await db
    .insert(aiPostGenerationSettings)
    .values({
      scope: 'global',
      topicsModelId: input.topicsModelId,
      draftModelId: input.draftModelId,
      topicsRouting: input.topicsRouting ?? null,
      draftRouting: input.draftRouting ?? null,
      updatedBy: input.updatedBy,
    })
    .onConflictDoUpdate({
      target: aiPostGenerationSettings.scope,
      set: {
        topicsModelId: input.topicsModelId,
        draftModelId: input.draftModelId,
        topicsRouting: input.topicsRouting ?? null,
        draftRouting: input.draftRouting ?? null,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error('Upsert returned no row');
  return row;
}
