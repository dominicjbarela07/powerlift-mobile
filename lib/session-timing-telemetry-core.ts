export type TimingAppStateEvent = 'app_backgrounded' | 'app_foregrounded' | null;

export function rebaseSessionElapsedAfterRestart(input: {
  priorElapsedMs: number;
  startedAtWallMs: number | null;
  nowWallMs: number;
}): number {
  const prior = Math.max(0, Math.round(Number(input.priorElapsedMs || 0)));
  if (!Number.isFinite(input.startedAtWallMs) || input.startedAtWallMs == null) return prior;
  const wallElapsed = Math.max(0, Math.round(input.nowWallMs - input.startedAtWallMs));
  return Math.max(prior, wallElapsed);
}

export function appStateTimingTransition(
  previouslyForeground: boolean,
  nextState: string,
): { foreground: boolean; eventType: TimingAppStateEvent } {
  const foreground = nextState === 'active';
  if (foreground === previouslyForeground) return { foreground, eventType: null };
  return {
    foreground,
    eventType: foreground ? 'app_foregrounded' : 'app_backgrounded',
  };
}

export function appendPendingEventIdempotently<T extends { event: { client_event_id: string } }>(
  pending: T[],
  candidate: T,
): T[] {
  return pending.some((row) => row.event.client_event_id === candidate.event.client_event_id)
    ? pending
    : [...pending, candidate];
}
