import { restTimerSignalForExpiry, RestTimerSignalGate, type RestTimerSignal, type RestTimerSignalContext } from './rest-timer-signal';
import type { ActiveRestTimer, RestTimerCompletionState } from './rest-timer-completion-core';

export type RestTimerExpiryResult = RestTimerSignal | 'stale';

type RouterDependencies = Readonly<{
  readState: () => RestTimerCompletionState;
  context: (timer: ActiveRestTimer) => RestTimerSignalContext;
  cancelNotification: (notificationId: string | null) => void;
  playBeep: (timer: ActiveRestTimer) => void;
}>;

/** The only decision and side-effect owner for a timer's natural expiry. */
export class RestTimerExpiryRouter {
  private readonly gate = new RestTimerSignalGate();
  constructor(private readonly deps: RouterDependencies) {}

  route(timer: ActiveRestTimer, notificationId = timer.notificationId): RestTimerExpiryResult {
    const state = this.deps.readState();
    const stillActive = state.active?.timerId === timer.timerId && state.active.endAtMs === timer.endAtMs;
    const justCompleted = state.pending?.timerId === timer.timerId
      && state.pending.completedAtMs === timer.endAtMs;
    if (!stillActive && !justCompleted) return 'stale';
    const existing = this.gate.get(timer.timerId);
    if (existing) return existing;
    const signal = this.gate.claim(timer.timerId, restTimerSignalForExpiry(this.deps.context(timer)));
    if (signal === 'beep') {
      this.deps.cancelNotification(notificationId);
      this.deps.playBeep(timer);
    }
    return signal;
  }

  /** A replaced/extended timer's old request must never become a new completion. */
  routeNotification(timerId: string, scheduledEndAtMs: number | null, notificationId: string, nowMs: number): RestTimerExpiryResult {
    const state = this.deps.readState();
    const active = state.active;
    if (active?.timerId === timerId) {
      if ((scheduledEndAtMs !== null && scheduledEndAtMs !== active.endAtMs) || nowMs < active.endAtMs) return 'stale';
      return this.route(active, notificationId);
    }
    const pending = state.pending;
    if (pending?.timerId === timerId) {
      if (scheduledEndAtMs !== null && scheduledEndAtMs !== pending.completedAtMs) return 'stale';
      return this.route({
        timerId: pending.timerId,
        workoutId: pending.workoutId,
        ownerUserId: pending.ownerUserId,
        startedAtMs: pending.completedAtMs,
        endAtMs: pending.completedAtMs,
        notificationId: pending.notificationId,
      }, notificationId);
    }
    return 'stale';
  }
}
