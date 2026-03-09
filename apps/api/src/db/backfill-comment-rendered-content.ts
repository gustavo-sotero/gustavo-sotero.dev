import { comments } from '@portfolio/shared/db/schema';
import { asc, eq } from 'drizzle-orm';
import { db, pgClient } from '../config/db';
import { getLogger, setupLogger } from '../config/logger';
import { renderCommentMarkdown } from '../lib/markdownComment';

const logger = getLogger('db', 'backfill-comment-rendered-content');

const BATCH_SIZE = 200;

interface CommentRenderedContentBackfillDeps {
  dbClient?: typeof db;
  renderComment?: typeof renderCommentMarkdown;
  loggerInstance?: ReturnType<typeof getLogger>;
  batchSize?: number;
}

export async function runCommentRenderedContentBackfill({
  dbClient = db,
  renderComment = renderCommentMarkdown,
  loggerInstance = logger,
  batchSize = BATCH_SIZE,
}: CommentRenderedContentBackfillDeps = {}): Promise<void> {
  let offset = 0;
  let scanned = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    const rows = await dbClient
      .select({
        id: comments.id,
        content: comments.content,
        renderedContent: comments.renderedContent,
      })
      .from(comments)
      .orderBy(asc(comments.createdAt))
      .limit(batchSize)
      .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      try {
        const rendered = await renderComment(row.content);
        if (row.renderedContent !== rendered) {
          await dbClient
            .update(comments)
            .set({ renderedContent: rendered })
            .where(eq(comments.id, row.id));
          updated += 1;
        }
      } catch (err) {
        failed += 1;
        loggerInstance.error('Failed to backfill rendered content for comment', {
          commentId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    offset += rows.length;
  }

  loggerInstance.info('Comment rendered-content backfill completed', {
    scanned,
    updated,
    failed,
  });

  if (failed > 0) {
    throw new Error(`Backfill completed with ${failed} failed row(s)`);
  }
}

if (import.meta.main) {
  await setupLogger();

  runCommentRenderedContentBackfill()
    .then(async () => {
      await pgClient.end();
    })
    .catch(async (err) => {
      logger.error('Comment rendered-content backfill failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      await pgClient.end();
      process.exit(1);
    });
}
