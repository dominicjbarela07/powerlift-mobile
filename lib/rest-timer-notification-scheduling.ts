import type { ActiveRestTimer } from './rest-timer-completion-core';

/** An in-flight native schedule may finish after Extend, Skip, or a new timer. */
export async function scheduleRestTimerEnd(timer: ActiveRestTimer, deps: {
  authorize: () => Promise<boolean>;
  now: () => number;
  readActive: () => ActiveRestTimer | null;
  schedule: (timer: ActiveRestTimer) => Promise<string>;
  attach: (timerId: string, id: string, expectedEndAtMs: number) => Promise<boolean>;
  cancel: (id: string) => void;
}): Promise<void> {
  if (!await deps.authorize()) return;
  const current = deps.readActive();
  if (current?.timerId !== timer.timerId || current.endAtMs !== timer.endAtMs || timer.endAtMs <= deps.now()) return;
  const id = await deps.schedule(timer);
  if (!await deps.attach(timer.timerId, id, timer.endAtMs)) deps.cancel(id);
}
