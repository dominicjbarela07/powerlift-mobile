import {
  isRestTimerCompletionOwnedByCurrentLogger,
  type RestTimerPresentationRoute,
} from './rest-timer-completion-core';

export type RestTimerSignal = 'voice' | 'notification';

export type RestTimerSignalContext = Readonly<{
  timerId: string;
  workoutId: string;
  ownerUserId: string;
  endAtMs: number;
  nowMs: number;
  appState: string;
  foregroundSinceMs: number | null;
  loggerVisibleSinceMs: number | null;
  currentUserId: string;
  route: RestTimerPresentationRoute;
}>;

/** A resumed app or newly opened Logger cannot turn an expired notification into speech. */
export function restTimerSignalForExpiry(context: RestTimerSignalContext): RestTimerSignal {
  const ownsLogger = isRestTimerCompletionOwnedByCurrentLogger({
    timerId: context.timerId,
    workoutId: context.workoutId,
    ownerUserId: context.ownerUserId,
    completedAtMs: context.endAtMs,
    notificationId: null,
  }, context.route);
  return context.appState === 'active'
    && context.currentUserId === context.ownerUserId
    && ownsLogger
    && context.foregroundSinceMs !== null
    && context.foregroundSinceMs <= context.endAtMs
    && context.loggerVisibleSinceMs !== null
    && context.loggerVisibleSinceMs <= context.endAtMs
    && context.nowMs >= context.endAtMs
      ? 'voice'
      : 'notification';
}

/** One terminal signal per timer, even when native notification and JS deadline race. */
export class RestTimerSignalGate {
  private readonly claims = new Map<string, RestTimerSignal>();

  get(timerId: string): RestTimerSignal | null {
    return this.claims.get(timerId) ?? null;
  }

  claim(timerId: string, signal: RestTimerSignal): RestTimerSignal {
    const existing = this.claims.get(timerId);
    if (existing) return existing;
    this.claims.set(timerId, signal);
    if (this.claims.size > 32) this.claims.delete(this.claims.keys().next().value!);
    return signal;
  }

  replace(timerId: string, signal: RestTimerSignal): void {
    this.claims.set(timerId, signal);
  }
}
