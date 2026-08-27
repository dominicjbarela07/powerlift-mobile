import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';

import { API_BASE, fetchJson } from '@/lib/api';
import {
  appStateTimingTransition,
  appendPendingEventIdempotently,
  rebaseSessionElapsedAfterRestart,
} from '@/lib/session-timing-telemetry-core';


export const SESSION_TIMING_VERSION = 'telemetry-v2' as const;
const STORAGE_KEY = 'strength-ledger:session-timing:v2';

export type SessionTimingEventType =
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'app_backgrounded'
  | 'app_foregrounded'
  | 'session_completed'
  | 'session_canceled'
  | 'interruption_started'
  | 'interruption_ended';

export type ClientTimingEvent = {
  event_type: SessionTimingEventType;
  occurred_at: string;
  client_event_id: string;
  client_session_id: string;
  client_session_revision: number;
  session_elapsed_ms: number;
  client_clock_source: 'session-monotonic' | 'wall-rebased-after-restart';
  timing_evidence_version: typeof SESSION_TIMING_VERSION;
  provenance: 'mobile-client';
  reason_code?: string;
  metadata?: Record<string, unknown>;
};

export type PerformedSetTiming = {
  performed_at: string;
  client_event_id: string;
  client_session_id: string;
  client_session_revision: number;
  session_elapsed_ms: number;
  client_clock_source: ClientTimingEvent['client_clock_source'];
  timing_evidence_version: typeof SESSION_TIMING_VERSION;
  prescribed_rest_seconds_snapshot?: number;
};

type PersistedTimingState = {
  activeWorkoutId: string | null;
  clientSessionId: string | null;
  clientSessionRevision: number;
  startedAtWallMs: number | null;
  baseElapsedMs: number;
  lastPersistedWallMs: number;
  clockSource: ClientTimingEvent['client_clock_source'];
  sessionStartedEvent: ClientTimingEvent | null;
  pendingEvents: Array<{ workoutId: string; event: ClientTimingEvent }>;
};

const initialState = (): PersistedTimingState => ({
  activeWorkoutId: null,
  clientSessionId: null,
  clientSessionRevision: 0,
  startedAtWallMs: null,
  baseElapsedMs: 0,
  lastPersistedWallMs: Date.now(),
  clockSource: 'session-monotonic',
  sessionStartedEvent: null,
  pendingEvents: [],
});

let state = initialState();
let initialized = false;
let initializePromise: Promise<void> | null = null;
let appStateSubscription: { remove(): void } | null = null;
let runtimeAnchorMs = monotonicNow();
let foregroundActive = AppState.currentState === 'active';
let flushPromise: Promise<void> | null = null;
const setEvidenceByEventId = new Map<string, PerformedSetTiming>();

function monotonicNow(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function randomHex(byteCount: number): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (cryptoObject?.getRandomValues) {
    const bytes = new Uint8Array(byteCount);
    cryptoObject.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  let value = '';
  while (value.length < byteCount * 2) {
    value += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  }
  return value.slice(0, byteCount * 2);
}

export function createClientEventId(prefix = 'evt'): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  const uuid = typeof cryptoObject?.randomUUID === 'function'
    ? cryptoObject.randomUUID()
    : `${randomHex(4)}-${randomHex(2)}-4${randomHex(2).slice(1)}-a${randomHex(2).slice(1)}-${randomHex(6)}`;
  return `${prefix}-${uuid}`;
}

function elapsedMs(): number {
  if (!state.activeWorkoutId || !state.startedAtWallMs) return 0;
  return Math.max(0, Math.round(state.baseElapsedMs + (monotonicNow() - runtimeAnchorMs)));
}

async function persistState() {
  state.baseElapsedMs = elapsedMs();
  state.lastPersistedWallMs = Date.now();
  runtimeAnchorMs = monotonicNow();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function timingContext() {
  if (!state.activeWorkoutId || !state.clientSessionId) return null;
  return {
    client_session_id: state.clientSessionId,
    client_session_revision: Math.max(1, state.clientSessionRevision),
    session_elapsed_ms: elapsedMs(),
    client_clock_source: state.clockSource,
    timing_evidence_version: SESSION_TIMING_VERSION,
  };
}

function buildEvent(eventType: SessionTimingEventType, options: {
  eventId?: string;
  reasonCode?: string;
  metadata?: Record<string, unknown>;
} = {}): ClientTimingEvent | null {
  const context = timingContext();
  if (!context) return null;
  return {
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    client_event_id: options.eventId || createClientEventId('life'),
    ...context,
    provenance: 'mobile-client',
    ...(options.reasonCode ? { reason_code: options.reasonCode } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

async function flushPendingEvents() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    while (state.pendingEvents.length) {
      const first = state.pendingEvents[0];
      try {
        const result = await fetchJson(
          `${API_BASE}/workouts/mobile/${first.workoutId}/timing-events`,
          { method: 'POST', auth: true, body: JSON.stringify({ event: first.event }) },
        );
        if (!result.ok || !result.json?.ok) return;
        state.pendingEvents.shift();
        await persistState();
      } catch {
        return;
      }
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function queueEvent(event: ClientTimingEvent) {
  const workoutId = state.activeWorkoutId;
  if (!workoutId) return;
  const beforeLength = state.pendingEvents.length;
  state.pendingEvents = appendPendingEventIdempotently(
    state.pendingEvents,
    { workoutId, event },
  );
  if (state.pendingEvents.length !== beforeLength) {
    await persistState();
  }
  await flushPendingEvents();
}

async function handleAppState(nextState: AppStateStatus) {
  const transition = appStateTimingTransition(foregroundActive, nextState);
  foregroundActive = transition.foreground;
  if (!transition.eventType) return;
  const event = buildEvent(transition.eventType, {
    metadata: { app_state: nextState },
  });
  if (event) await queueEvent(event);
  if (transition.foreground) await flushPendingEvents();
}

export function initializeSessionTimingTelemetry(): Promise<void> {
  if (initializePromise) return initializePromise;
  initializePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedTimingState>;
        const now = Date.now();
        const recoveredStartedAt = Number(parsed.startedAtWallMs || 0) || null;
        state = {
          ...initialState(),
          ...parsed,
          baseElapsedMs: rebaseSessionElapsedAfterRestart({
            priorElapsedMs: Number(parsed.baseElapsedMs || 0),
            startedAtWallMs: recoveredStartedAt,
            nowWallMs: now,
          }),
          lastPersistedWallMs: now,
          clockSource: parsed.activeWorkoutId ? 'wall-rebased-after-restart' : 'session-monotonic',
          pendingEvents: Array.isArray(parsed.pendingEvents) ? parsed.pendingEvents : [],
        };
      }
    } catch (error) {
      console.warn('Session timing telemetry hydration failed', error);
      state = initialState();
    }
    runtimeAnchorMs = monotonicNow();
    foregroundActive = AppState.currentState === 'active';
    if (!appStateSubscription) {
      appStateSubscription = AppState.addEventListener('change', (nextState) => {
        void handleAppState(nextState);
      });
    }
    initialized = true;
    await flushPendingEvents();
  })();
  return initializePromise;
}

async function ensureInitialized() {
  if (!initialized) await initializeSessionTimingTelemetry();
}

export async function prepareSessionStartTiming(workoutId: string | number): Promise<ClientTimingEvent> {
  await ensureInitialized();
  const normalizedWorkoutId = String(workoutId);
  if (state.activeWorkoutId === normalizedWorkoutId && state.sessionStartedEvent) {
    return state.sessionStartedEvent;
  }
  const now = Date.now();
  state = {
    ...state,
    activeWorkoutId: normalizedWorkoutId,
    clientSessionId: createClientEventId('session'),
    clientSessionRevision: Math.max(1, state.clientSessionRevision + 1),
    startedAtWallMs: now,
    baseElapsedMs: 0,
    lastPersistedWallMs: now,
    clockSource: 'session-monotonic',
  };
  runtimeAnchorMs = monotonicNow();
  await persistState();
  const event = buildEvent('session_started');
  if (!event) throw new Error('Session timing state did not initialize.');
  state.sessionStartedEvent = event;
  await persistState();
  return event;
}

export async function resumeSessionTiming(
  workoutId: string | number,
  startedAt?: string | null,
): Promise<void> {
  await ensureInitialized();
  const normalizedWorkoutId = String(workoutId);
  if (state.activeWorkoutId === normalizedWorkoutId && state.clientSessionId) return;
  const parsedStart = startedAt ? Date.parse(startedAt) : NaN;
  const now = Date.now();
  state = {
    ...state,
    activeWorkoutId: normalizedWorkoutId,
    clientSessionId: createClientEventId('session'),
    clientSessionRevision: Math.max(1, state.clientSessionRevision + 1),
    startedAtWallMs: Number.isFinite(parsedStart) ? parsedStart : now,
    baseElapsedMs: Number.isFinite(parsedStart) ? Math.max(0, now - parsedStart) : 0,
    lastPersistedWallMs: now,
    clockSource: Number.isFinite(parsedStart) ? 'wall-rebased-after-restart' : 'session-monotonic',
  };
  runtimeAnchorMs = monotonicNow();
  await persistState();
}

export async function discardPreparedSessionTiming(workoutId: string | number): Promise<void> {
  if (state.activeWorkoutId !== String(workoutId)) return;
  state = { ...initialState(), pendingEvents: state.pendingEvents };
  runtimeAnchorMs = monotonicNow();
  await persistState();
}

export async function finishSessionTiming(workoutId: string | number): Promise<void> {
  if (state.activeWorkoutId !== String(workoutId)) return;
  state = { ...initialState(), pendingEvents: state.pendingEvents };
  runtimeAnchorMs = monotonicNow();
  setEvidenceByEventId.clear();
  await persistState();
}

export function createLifecycleTimingEvent(
  workoutId: string | number,
  eventType: SessionTimingEventType,
  options: { reasonCode?: string; metadata?: Record<string, unknown> } = {},
): ClientTimingEvent | null {
  if (state.activeWorkoutId !== String(workoutId)) return null;
  return buildEvent(eventType, options);
}

export function createPerformedSetTiming(
  workoutId: string | number,
  clientEventId: string,
  prescribedRestSeconds?: number | null,
): PerformedSetTiming | null {
  if (state.activeWorkoutId !== String(workoutId)) return null;
  const existing = setEvidenceByEventId.get(clientEventId);
  if (existing) return existing;
  const context = timingContext();
  if (!context) return null;
  const evidence: PerformedSetTiming = {
    performed_at: new Date().toISOString(),
    client_event_id: clientEventId,
    ...context,
    ...(Number.isFinite(prescribedRestSeconds) && Number(prescribedRestSeconds) >= 0
      ? { prescribed_rest_seconds_snapshot: Math.round(Number(prescribedRestSeconds)) }
      : {}),
  };
  setEvidenceByEventId.set(clientEventId, evidence);
  return evidence;
}
