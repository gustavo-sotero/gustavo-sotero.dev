type RelayPollGuardLogger = {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
};

export interface OutboxRelayPollGuard {
  tryStartCycle: () => boolean;
  finishCycle: () => void;
}

export function createOutboxRelayPollGuard(
  logger: RelayPollGuardLogger,
  pollIntervalMs: number
): OutboxRelayPollGuard {
  let relayInFlight = false;
  let saturationStartedAt: number | null = null;
  let skippedPolls = 0;

  return {
    tryStartCycle() {
      if (relayInFlight) {
        skippedPolls += 1;

        if (saturationStartedAt === null) {
          saturationStartedAt = Date.now();
          logger.warn('Outbox relay: poll skipped while previous cycle is still in flight', {
            relaySaturated: true,
            pollIntervalMs,
            skippedPolls,
          });
        }

        return false;
      }

      relayInFlight = true;
      return true;
    },

    finishCycle() {
      relayInFlight = false;

      if (saturationStartedAt === null) {
        return;
      }

      logger.info('Outbox relay: saturation cleared after overlapping poll attempts', {
        relaySaturated: false,
        pollIntervalMs,
        skippedPolls,
        blockedDurationMs: Math.max(0, Date.now() - saturationStartedAt),
      });

      saturationStartedAt = null;
      skippedPolls = 0;
    },
  };
}
