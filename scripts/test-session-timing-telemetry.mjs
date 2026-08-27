import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  appStateTimingTransition,
  appendPendingEventIdempotently,
  rebaseSessionElapsedAfterRestart,
} from '../lib/session-timing-telemetry-core.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
const telemetry = fs.readFileSync(path.join(root, 'lib/session-timing-telemetry.ts'), 'utf8');

assert.equal(rebaseSessionElapsedAfterRestart({
  priorElapsedMs: 20_000,
  startedAtWallMs: 1_000,
  nowWallMs: 31_000,
}), 30_000, 'restart must rebase elapsed time without persisting raw monotonic clocks');
assert.equal(rebaseSessionElapsedAfterRestart({
  priorElapsedMs: 45_000,
  startedAtWallMs: 1_000,
  nowWallMs: 31_000,
}), 45_000, 'restart must never move elapsed time backwards');

assert.deepEqual(appStateTimingTransition(true, 'inactive'), {
  foreground: false,
  eventType: 'app_backgrounded',
});
assert.deepEqual(appStateTimingTransition(false, 'background'), {
  foreground: false,
  eventType: null,
}, 'inactive -> background must not emit a duplicate background event');
assert.deepEqual(appStateTimingTransition(false, 'active'), {
  foreground: true,
  eventType: 'app_foregrounded',
});

const pending = [{ workoutId: '1', event: { client_event_id: 'event-12345678' } }];
assert.equal(appendPendingEventIdempotently(pending, pending[0]).length, 1);

assert.match(layout, /initializeSessionTimingTelemetry\(\)/, 'root shell must own telemetry initialization');
assert.match(telemetry, /AppState\.addEventListener\('change'/, 'AppState telemetry must be centralized');
assert.match(telemetry, /AsyncStorage\.setItem\(STORAGE_KEY/, 'active timing state must survive restart');
assert.match(telemetry, /pendingEvents/, 'offline lifecycle evidence must retain stable retry events');
assert.match(telemetry, /state\.activeWorkoutId === normalizedWorkoutId && state\.sessionStartedEvent/,
  'ambiguous Begin retries must reuse the same Session-start event');
assert.doesNotMatch(route, /catch \(err\) \{\s*if \(timingPrepared\) await discardPreparedSessionTiming/,
  'an ambiguous Begin response must not discard its stable event identity');
assert.match(route, /prepareSessionStartTiming\(wkId\)[\s\S]*timing_event: timingEvent/);
assert.match(route, /createLifecycleTimingEvent\(wkId, 'session_completed'\)/);
assert.match(route, /createLifecycleTimingEvent\(wkId, 'session_canceled'\)/);
assert.equal((route.match(/createPerformedSetTiming\(/g) || []).length, 6,
  'straight, top, backdown, custom, accessory, and superset paths must emit performed timing');
assert.match(route, /prescribedRestSecondsForItem[\s\S]*prescribed_rest_seconds[\s\S]*rest_prescription_seconds/);
assert.doesNotMatch(route, /createPerformedSetTiming\([^)]*sessionRestTimerSeconds/,
  'ad-hoc rest timer selection must not masquerade as programmed rest');

console.log('Session timing telemetry contracts passed.');
