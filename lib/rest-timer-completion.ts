import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  EMPTY_REST_TIMER_COMPLETION_STATE,
  acknowledgeRestTimerCompletionState,
  attachRestTimerNotificationState,
  beginRestTimerState,
  createActiveRestTimer,
  reconcileRestTimerCompletionState,
  stopRestTimerState,
  type RestTimerCompletionState,
} from '@/lib/rest-timer-completion-core';
import { clearRestTimerExpiry, persistRestTimerExpiry } from '@/lib/rest-timer-storage';

const GLOBAL_REST_TIMER_STORAGE_KEY = 'strength-ledger:rest-timer-completion:v2';
type Listener = (state: RestTimerCompletionState) => void;

let currentState: RestTimerCompletionState = EMPTY_REST_TIMER_COMPLETION_STATE;
let hydratePromise: Promise<RestTimerCompletionState> | null = null;
let timerGeneration = 0;
let stateRevision = 0;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener(currentState));
}

async function persistState(): Promise<void> {
  if (!currentState.active && !currentState.pending) {
    await AsyncStorage.removeItem(GLOBAL_REST_TIMER_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(GLOBAL_REST_TIMER_STORAGE_KEY, JSON.stringify(currentState));
}

function validState(value: unknown): RestTimerCompletionState {
  if (!value || typeof value !== 'object') return EMPTY_REST_TIMER_COMPLETION_STATE;
  const raw = value as Partial<RestTimerCompletionState>;
  const active = raw.active
    && raw.active.timerId
    && raw.active.workoutId
    && raw.active.ownerUserId
    && Number.isFinite(Number(raw.active.endAtMs))
      ? Object.freeze({
          timerId: String(raw.active.timerId),
          workoutId: String(raw.active.workoutId),
          ownerUserId: String(raw.active.ownerUserId),
          startedAtMs: Number(raw.active.startedAtMs),
          endAtMs: Number(raw.active.endAtMs),
          notificationId: raw.active.notificationId ? String(raw.active.notificationId) : null,
        })
      : null;
  const pending = raw.pending
    && raw.pending.timerId
    && raw.pending.workoutId
    && raw.pending.ownerUserId
    && Number.isFinite(Number(raw.pending.completedAtMs))
      ? Object.freeze({
          timerId: String(raw.pending.timerId),
          workoutId: String(raw.pending.workoutId),
          ownerUserId: String(raw.pending.ownerUserId),
          completedAtMs: Number(raw.pending.completedAtMs),
          notificationId: raw.pending.notificationId ? String(raw.pending.notificationId) : null,
        })
      : null;
  return Object.freeze({ active, pending }) as RestTimerCompletionState;
}

export function getRestTimerCompletionState(): RestTimerCompletionState {
  return currentState;
}

export function subscribeRestTimerCompletion(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function hydrateRestTimerCompletion(
  nowMs = Date.now(),
): Promise<RestTimerCompletionState> {
  if (hydratePromise) return hydratePromise;
  const revisionAtStart = stateRevision;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(GLOBAL_REST_TIMER_STORAGE_KEY);
      if (stateRevision === revisionAtStart) {
        currentState = reconcileRestTimerCompletionState(
          raw ? validState(JSON.parse(raw)) : EMPTY_REST_TIMER_COMPLETION_STATE,
          nowMs,
        );
        stateRevision += 1;
        if (!currentState.active && currentState.pending) {
          await clearRestTimerExpiry(currentState.pending.workoutId).catch(() => undefined);
        }
        await persistState();
      }
    } catch {
      if (stateRevision === revisionAtStart) {
        currentState = EMPTY_REST_TIMER_COMPLETION_STATE;
        stateRevision += 1;
        await AsyncStorage.removeItem(GLOBAL_REST_TIMER_STORAGE_KEY).catch(() => undefined);
      }
    }
    emit();
    return currentState;
  })();
  return hydratePromise;
}

export function beginGlobalRestTimer(input: {
  workoutId: string | number;
  ownerUserId: string | number;
  endAtMs: number;
  nowMs?: number;
}): { timerId: string; replacedNotificationId: string | null } {
  const nowMs = input.nowMs ?? Date.now();
  timerGeneration += 1;
  const timer = createActiveRestTimer({
    timerId: `${String(input.workoutId)}:${input.endAtMs}:${timerGeneration}`,
    workoutId: input.workoutId,
    ownerUserId: input.ownerUserId,
    startedAtMs: nowMs,
    endAtMs: input.endAtMs,
  });
  const transition = beginRestTimerState(currentState, timer);
  currentState = transition.state;
  stateRevision += 1;
  emit();
  void Promise.all([
    persistRestTimerExpiry(timer.workoutId, timer.endAtMs),
    persistState(),
  ]).catch(() => undefined);
  return { timerId: timer.timerId, replacedNotificationId: transition.replacedNotificationId };
}

export async function attachGlobalRestTimerNotification(
  timerId: string,
  notificationId: string,
): Promise<boolean> {
  const next = attachRestTimerNotificationState(currentState, timerId, notificationId);
  if (next === currentState) return false;
  currentState = next;
  stateRevision += 1;
  emit();
  await persistState().catch(() => undefined);
  return true;
}

export async function reconcileGlobalRestTimerCompletion(
  nowMs = Date.now(),
): Promise<RestTimerCompletionState> {
  await hydrateRestTimerCompletion(nowMs);
  const previousActive = currentState.active;
  const next = reconcileRestTimerCompletionState(currentState, nowMs);
  if (next === currentState) return currentState;
  currentState = next;
  stateRevision += 1;
  if (previousActive && !currentState.active) {
    await clearRestTimerExpiry(previousActive.workoutId).catch(() => undefined);
  }
  emit();
  await persistState().catch(() => undefined);
  return currentState;
}

export async function stopGlobalRestTimer(timerId?: string | null): Promise<string | null> {
  const previousActive = currentState.active;
  const transition = stopRestTimerState(currentState, timerId);
  if (transition.state === currentState) return null;
  currentState = transition.state;
  stateRevision += 1;
  if (previousActive) await clearRestTimerExpiry(previousActive.workoutId).catch(() => undefined);
  emit();
  await persistState().catch(() => undefined);
  return transition.notificationId;
}

export async function acknowledgeGlobalRestTimerCompletion(
  timerId?: string | null,
): Promise<void> {
  await reconcileGlobalRestTimerCompletion();
  const next = acknowledgeRestTimerCompletionState(currentState, timerId);
  if (next === currentState) return;
  currentState = next;
  stateRevision += 1;
  emit();
  await persistState().catch(() => undefined);
}
