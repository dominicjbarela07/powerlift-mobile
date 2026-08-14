export const REST_TIMER_COMPLETION_STALE_MS = 15 * 60 * 1000;

export type ActiveRestTimer = Readonly<{
  timerId: string;
  workoutId: string;
  ownerUserId: string;
  startedAtMs: number;
  endAtMs: number;
  notificationId: string | null;
}>;

export type PendingRestTimerCompletion = Readonly<{
  timerId: string;
  workoutId: string;
  ownerUserId: string;
  completedAtMs: number;
  notificationId: string | null;
}>;

export type RestTimerCompletionState = Readonly<{
  active: ActiveRestTimer | null;
  pending: PendingRestTimerCompletion | null;
}>;

export type RestTimerPresentationRoute = Readonly<{
  segments: readonly string[];
  workoutId: string | number | readonly string[] | null | undefined;
}>;

export const EMPTY_REST_TIMER_COMPLETION_STATE: RestTimerCompletionState = Object.freeze({
  active: null,
  pending: null,
});

function cleanIdentifier(value: unknown): string {
  return String(value ?? '').trim();
}

function cleanRouteIdentifier(value: RestTimerPresentationRoute['workoutId']): string {
  return cleanIdentifier(Array.isArray(value) ? value[0] : value);
}

export function isCanonicalSessionLoggerRoute(
  route: RestTimerPresentationRoute | null | undefined,
): boolean {
  const routeSegments = (route?.segments ?? [])
    .map((segment) => cleanIdentifier(segment))
    .filter((segment) => !/^\(.+\)$/.test(segment));
  return routeSegments.length === 2
    && routeSegments[0] === 'workout'
    && routeSegments[1] === '[workoutId]';
}

export function isRestTimerCompletionOwnedByCurrentLogger(
  pending: PendingRestTimerCompletion | null,
  route: RestTimerPresentationRoute | null | undefined,
): boolean {
  return Boolean(
    pending
      && isCanonicalSessionLoggerRoute(route)
      && cleanRouteIdentifier(route?.workoutId) === pending.workoutId,
  );
}

export function createActiveRestTimer(input: {
  timerId: string;
  workoutId: string | number;
  ownerUserId: string | number;
  startedAtMs: number;
  endAtMs: number;
}): ActiveRestTimer {
  return Object.freeze({
    timerId: cleanIdentifier(input.timerId),
    workoutId: cleanIdentifier(input.workoutId),
    ownerUserId: cleanIdentifier(input.ownerUserId),
    startedAtMs: Number(input.startedAtMs),
    endAtMs: Number(input.endAtMs),
    notificationId: null,
  });
}

export function beginRestTimerState(
  state: RestTimerCompletionState,
  timer: ActiveRestTimer,
): { state: RestTimerCompletionState; replacedNotificationId: string | null } {
  return {
    state: Object.freeze({ active: timer, pending: null }),
    replacedNotificationId: state.active?.notificationId ?? null,
  };
}

export function attachRestTimerNotificationState(
  state: RestTimerCompletionState,
  timerId: string,
  notificationId: string,
): RestTimerCompletionState {
  if (!state.active || state.active.timerId !== timerId) return state;
  return Object.freeze({
    ...state,
    active: Object.freeze({ ...state.active, notificationId }),
  });
}

export function reconcileRestTimerCompletionState(
  state: RestTimerCompletionState,
  nowMs: number,
  staleMs = REST_TIMER_COMPLETION_STALE_MS,
): RestTimerCompletionState {
  let pending = state.pending;
  let active = state.active;

  if (active && active.endAtMs <= nowMs) {
    pending = Object.freeze({
      timerId: active.timerId,
      workoutId: active.workoutId,
      ownerUserId: active.ownerUserId,
      completedAtMs: active.endAtMs,
      notificationId: active.notificationId,
    });
    active = null;
  }

  if (pending && nowMs - pending.completedAtMs > staleMs) pending = null;
  if (active === state.active && pending === state.pending) return state;
  return Object.freeze({ active, pending });
}

export function stopRestTimerState(
  state: RestTimerCompletionState,
  timerId?: string | null,
): { state: RestTimerCompletionState; notificationId: string | null } {
  if (!state.active || (timerId && state.active.timerId !== timerId)) {
    return { state, notificationId: null };
  }
  return {
    state: Object.freeze({ active: null, pending: state.pending }),
    notificationId: state.active.notificationId,
  };
}

export function acknowledgeRestTimerCompletionState(
  state: RestTimerCompletionState,
  timerId?: string | null,
): RestTimerCompletionState {
  if (!state.pending || (timerId && state.pending.timerId !== timerId)) return state;
  return Object.freeze({ active: state.active, pending: null });
}

export function canPresentRestTimerCompletion(
  state: RestTimerCompletionState,
  ownerUserId: string | number | null | undefined,
  appState: string,
  route?: RestTimerPresentationRoute | null,
): boolean {
  return Boolean(
    state.pending
      && appState === 'active'
      && cleanIdentifier(ownerUserId)
      && state.pending.ownerUserId === cleanIdentifier(ownerUserId)
      && !isRestTimerCompletionOwnedByCurrentLogger(state.pending, route),
  );
}

export function isRestTimerNotification(notificationData: unknown): boolean {
  const data = notificationData && typeof notificationData === 'object'
    ? notificationData as Record<string, unknown>
    : {};
  return data.kind === 'rest_end' || data.type === 'rest_timer_complete';
}
