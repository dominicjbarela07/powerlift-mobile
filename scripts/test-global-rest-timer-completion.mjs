import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EMPTY_REST_TIMER_COMPLETION_STATE,
  REST_TIMER_COMPLETION_STALE_MS,
  acknowledgeRestTimerCompletionState,
  attachRestTimerNotificationState,
  beginRestTimerState,
  canPresentRestTimerCompletion,
  createActiveRestTimer,
  isRestTimerNotification,
  reconcileRestTimerCompletionState,
  stopRestTimerState,
} from '../lib/rest-timer-completion-core.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const rootLayout = read('app/_layout.tsx');
const route = read('app/(tabs)/workout/[workoutId].tsx');
const presenter = read('components/rest-timer-completion-presenter.tsx');
const runtime = read('lib/rest-timer-completion.ts');

const now = 1_000_000;
const timerA = createActiveRestTimer({
  timerId: 'timer-a',
  workoutId: 682,
  ownerUserId: 7,
  startedAtMs: now,
  endAtMs: now + 90_000,
});
let state = beginRestTimerState(EMPTY_REST_TIMER_COMPLETION_STATE, timerA).state;
state = attachRestTimerNotificationState(state, timerA.timerId, 'notification-a');
assert.equal(state.active?.notificationId, 'notification-a');

const pending = reconcileRestTimerCompletionState(state, timerA.endAtMs);
assert.equal(pending.active, null);
assert.deepEqual(pending.pending, {
  timerId: 'timer-a',
  workoutId: '682',
  ownerUserId: '7',
  completedAtMs: timerA.endAtMs,
  notificationId: 'notification-a',
});

for (const routeName of ['Home', 'Calendar', 'Messages', 'Training Hub', 'Settings']) {
  assert.equal(
    canPresentRestTimerCompletion(pending, 7, 'active'),
    true,
    `completion must be route-independent on ${routeName}`,
  );
}
assert.equal(canPresentRestTimerCompletion(pending, 7, 'background'), false);
assert.equal(canPresentRestTimerCompletion(pending, 8, 'active'), false);

const dismissed = acknowledgeRestTimerCompletionState(pending, 'timer-a');
assert.equal(dismissed.pending, null);
assert.strictEqual(
  acknowledgeRestTimerCompletionState(pending, 'another-timer'),
  pending,
  'a stale acknowledgement must not dismiss the current completion',
);

const stopped = stopRestTimerState(state, 'timer-a');
assert.equal(stopped.state.active, null);
assert.equal(stopped.notificationId, 'notification-a');
assert.strictEqual(
  stopRestTimerState(state, 'stale-timer').state,
  state,
  'a stale stop must not cancel the current timer',
);

const timerB = createActiveRestTimer({
  timerId: 'timer-b',
  workoutId: 900,
  ownerUserId: 7,
  startedAtMs: now + 5_000,
  endAtMs: now + 35_000,
});
const replacement = beginRestTimerState(state, timerB);
assert.equal(replacement.replacedNotificationId, 'notification-a');
assert.equal(replacement.state.active?.timerId, 'timer-b');
assert.equal(replacement.state.pending, null);
assert.strictEqual(
  attachRestTimerNotificationState(replacement.state, 'timer-a', 'stale-notification'),
  replacement.state,
);

assert.equal(
  reconcileRestTimerCompletionState(
    pending,
    timerA.endAtMs + REST_TIMER_COMPLETION_STALE_MS,
  ).pending?.timerId,
  'timer-a',
);
assert.equal(
  reconcileRestTimerCompletionState(
    pending,
    timerA.endAtMs + REST_TIMER_COMPLETION_STALE_MS + 1,
  ).pending,
  null,
);

assert.equal(isRestTimerNotification({ kind: 'rest_end' }), true);
assert.equal(isRestTimerNotification({ type: 'rest_timer_complete' }), true);
assert.equal(isRestTimerNotification({ type: 'message' }), false);

assert.match(rootLayout, /<RestTimerCompletionPresenter userId=\{user\?\.id \?\? user\?\.user_id\} \/>/);
assert.match(rootLayout, /getLastNotificationResponseAsync\(\)/);
assert.match(rootLayout, /pathname: '\/\(tabs\)\/workout\/\[workoutId\]'[\s\S]*params: \{ workoutId \}/);
assert.match(presenter, /Rest Timer Complete/);
assert.match(presenter, /Your rest period is over\./);
assert.match(presenter, /Return to Session/);
assert.match(presenter, />Dismiss</);
assert.match(presenter, /AppState\.addEventListener\('change'/);
assert.match(presenter, /AppState\.currentState === 'active'[\s\S]*isRestTimerNotification/);
assert.match(presenter, /shouldShowBanner: !suppressRestEnd/);
assert.match(presenter, /shouldPlaySound: !suppressRestEnd/);
assert.match(presenter, /card: \{[\s\S]*maxWidth: 420[\s\S]*padding: 24/);
assert.match(presenter, /title: \{[\s\S]*fontSize: 26[\s\S]*lineHeight: 32/);
assert.match(presenter, /body: \{[\s\S]*fontSize: 18[\s\S]*lineHeight: 25/);
assert.match(presenter, /actions: \{[\s\S]*flexDirection: 'row'[\s\S]*gap: 10/);
assert.match(presenter, /action: \{[\s\S]*minHeight: 54/);
assert.doesNotMatch(presenter, /expo-audio|createAudioPlayer|RestTimerProvider|RestTimerContext/);

assert.match(route, /beginGlobalRestTimer\([\s\S]*workoutId,[\s\S]*ownerUserId:/);
assert.match(route, /type: 'rest_timer_complete'[\s\S]*workout_id: String\(workoutId\)[\s\S]*timer_id: timerId/);
assert.match(route, /Do not cancel the active rest completion notification here/);
assert.doesNotMatch(route, /presentRestTimerReady\(/);
assert.match(runtime, /strength-ledger:rest-timer-completion:v2/);
assert.match(runtime, /stateRevision === revisionAtStart/);

console.log('Global rest-timer completion lifecycle and delivery tests passed.');
