interface CreatedAiRunRow {
  id: string;
  createdAt: Date;
}

type Awaitable<T> = T | PromiseLike<T>;

interface CreateQueuedAiRunWithOutboxOptions {
  createRun: () => Awaitable<CreatedAiRunRow | undefined>;
  insertOutbox: (runId: string) => Awaitable<unknown>;
  errorMessage: string;
}

export async function createQueuedAiRunWithOutbox(
  options: CreateQueuedAiRunWithOutboxOptions
): Promise<CreatedAiRunRow> {
  const insertedRun = await options.createRun();

  if (!insertedRun) {
    throw new Error(options.errorMessage);
  }

  await options.insertOutbox(insertedRun.id);
  return insertedRun;
}

export function buildQueuedAiRunResponse(run: CreatedAiRunRow, pollAfterMs: number) {
  return {
    runId: run.id,
    status: 'queued' as const,
    stage: 'queued' as const,
    pollAfterMs,
    createdAt: run.createdAt.toISOString(),
  };
}
