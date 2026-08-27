import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EMPTY_REST_TIMER_COMPLETION_STATE,
  beginRestTimerState,
  createActiveRestTimer,
  deriveRestTimerRemainingSeconds,
  reconcileRestTimerCompletionState,
  stopRestTimerState,
} from '../lib/rest-timer-completion-core.ts';

const now = 10_000;
const timerA = createActiveRestTimer({
  timerId: 'workout-1:a',
  workoutId: 1,
  ownerUserId: 9,
  startedAtMs: now,
  endAtMs: now + 10_000,
});
const running = beginRestTimerState(EMPTY_REST_TIMER_COMPLETION_STATE, timerA).state;

assert.equal(deriveRestTimerRemainingSeconds(timerA, now), 10);
assert.equal(deriveRestTimerRemainingSeconds(timerA, now + 4_250), 6);
assert.equal(deriveRestTimerRemainingSeconds(timerA, now + 30_000), 0);

const foregroundAfterExpiry = reconcileRestTimerCompletionState(running, now + 30_000);
assert.equal(foregroundAfterExpiry.active, null, 'running + past expiry cannot survive foreground reconciliation');
assert.equal(foregroundAfterExpiry.pending?.timerId, timerA.timerId);

const mountAfterExpiry = reconcileRestTimerCompletionState(running, now + 10_001);
assert.equal(mountAfterExpiry.active, null, 'running + past expiry cannot survive mount reconciliation');

const stoppedAtZero = stopRestTimerState(foregroundAfterExpiry, timerA.timerId);
assert.equal(stoppedAtZero.state.active, null);
assert.equal(stoppedAtZero.state.pending, null, 'Stop at zero must be an idempotent recovery action');
assert.strictEqual(
  stopRestTimerState(stoppedAtZero.state, timerA.timerId).state,
  stoppedAtZero.state,
  'repeated Stop must be harmless',
);

const timerB = createActiveRestTimer({
  timerId: 'workout-1:b',
  workoutId: 1,
  ownerUserId: 9,
  startedAtMs: now + 12_000,
  endAtMs: now + 42_000,
});
const replacement = beginRestTimerState(running, timerB).state;
assert.equal(reconcileRestTimerCompletionState(replacement, now + 11_000).active?.timerId, timerB.timerId);
assert.strictEqual(
  stopRestTimerState(replacement, timerA.timerId).state,
  replacement,
  'a stale callback from timer A cannot cancel replacement timer B',
);

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const logger = read('app/(tabs)/workout/[workoutId].tsx');
const focus = read('components/workout-logger/rest-timer-focus.tsx');
const runtime = read('lib/rest-timer-completion.ts');

assert.match(logger, /deriveRestTimerRemainingSeconds\(activeTimer, Date\.now\(\)\)/);
assert.match(logger, /AppState\.addEventListener\('change'[\s\S]*state === 'active'[\s\S]*reconcileGlobalRestTimerCompletion\(\)/);
assert.match(logger, /hydrateRestTimerCompletion\(\)\.then\(\(\) => reconcileGlobalRestTimerCompletion\(\)\)/);
assert.match(logger, /restTimerFocusVisible = restTimerPromoted && restActive && restSeconds > 0/);
assert.doesNotMatch(logger, /setRestTimerZeroVisible\(true\)|setRestTimerReadyVisible\(true\)/);
assert.doesNotMatch(logger, /loadRestTimerExpiry/);
assert.match(logger, /pendingGlobalTimer\?\.workoutId === String\(workoutId\)/);
assert.match(focus, /accessibilityLabel=\{ready \? 'Dismiss completed rest timer' : 'Stop rest timer'\}/);
assert.match(focus, /transform: \[\{ scale: 0\.98 \}\]/);
assert.doesNotMatch(runtime, /persistRestTimerExpiry/);

console.log('Canonical rest-timer zero-state and lifecycle regression tests passed.');
