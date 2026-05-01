import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOutboxRelayPollGuard } from './outbox-relay-poll-guard';

describe('createOutboxRelayPollGuard', () => {
  const warnMock = vi.fn();
  const infoMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));
  });

  it('logs saturation once when overlapping polls are skipped and logs recovery on finish', () => {
    const guard = createOutboxRelayPollGuard(
      {
        info: infoMock,
        warn: warnMock,
      },
      5_000
    );

    expect(guard.tryStartCycle()).toBe(true);
    expect(guard.tryStartCycle()).toBe(false);
    expect(guard.tryStartCycle()).toBe(false);

    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(warnMock).toHaveBeenCalledWith(
      'Outbox relay: poll skipped while previous cycle is still in flight',
      expect.objectContaining({
        relaySaturated: true,
        pollIntervalMs: 5_000,
        skippedPolls: 1,
      })
    );

    vi.advanceTimersByTime(15_000);
    guard.finishCycle();

    expect(infoMock).toHaveBeenCalledWith(
      'Outbox relay: saturation cleared after overlapping poll attempts',
      expect.objectContaining({
        relaySaturated: false,
        pollIntervalMs: 5_000,
        skippedPolls: 2,
        blockedDurationMs: 15_000,
      })
    );
  });

  it('does not log recovery when no poll overlap happened', () => {
    const guard = createOutboxRelayPollGuard(
      {
        info: infoMock,
        warn: warnMock,
      },
      5_000
    );

    expect(guard.tryStartCycle()).toBe(true);
    guard.finishCycle();

    expect(warnMock).not.toHaveBeenCalled();
    expect(infoMock).not.toHaveBeenCalled();
  });
});
