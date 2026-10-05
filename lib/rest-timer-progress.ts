import type { ActiveRestTimer } from './rest-timer-completion-core';

/** Presentation only: extensions expand the same rest period's total budget. */
export function restTimerRemainingFraction(timer: ActiveRestTimer, seconds: number): number {
  const duration = (timer.endAtMs - timer.startedAtMs) / 1000;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.min(1, seconds / duration));
}
