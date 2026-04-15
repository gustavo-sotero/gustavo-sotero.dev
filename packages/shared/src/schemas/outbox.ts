import { z } from 'zod';

/**
 * Runtime payload schemas for outbox events.
 *
 * Used by the worker relay to validate event payloads before publishing to
 * BullMQ. Validation errors are surfaced as INVALID_PAYLOAD relay failures
 * rather than silently proceeding with an unsafe type cast.
 */

/** Payload schema for the `image-optimize` outbox event. */
export const imageOptimizeOutboxPayloadSchema = z.object({
  // uploadId is a postgres-generated UUID written by the API into the uploads
  // table. Its UUID format is already guaranteed at insert time; here we validate
  // structural presence (non-empty string) rather than re-validating the format.
  uploadId: z.string().min(1),
});

/** Payload schema for the `scheduled-post-publish` outbox event. */
export const scheduledPostPublishOutboxPayloadSchema = z.object({
  postId: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
});

/**
 * Payload schema for the `ai-post-draft-generate-requested` outbox event.
 * Intentionally minimal — the worker always re-reads the run record from DB.
 */
export const aiPostDraftGenerateRequestedOutboxPayloadSchema = z.object({
  runId: z.string().uuid(),
});

export type ImageOptimizeOutboxPayload = z.infer<typeof imageOptimizeOutboxPayloadSchema>;
export type ScheduledPostPublishOutboxPayload = z.infer<
  typeof scheduledPostPublishOutboxPayloadSchema
>;
export type AiPostDraftGenerateRequestedOutboxPayload = z.infer<
  typeof aiPostDraftGenerateRequestedOutboxPayloadSchema
>;
