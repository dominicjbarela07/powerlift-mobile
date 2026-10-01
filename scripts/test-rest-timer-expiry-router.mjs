import assert from 'node:assert/strict';
import { RestTimerExpiryRouter } from '../lib/rest-timer-expiry-router.ts';

const deadline = 100_000;
const timer = Object.freeze({
  timerId: 'session-41:timer-1', workoutId: '41', ownerUserId: '9',
  startedAtMs: 60_000, endAtMs: deadline, notificationId: 'notification-1',
});
const logger = { segments: ['(tabs)', 'workout', '[workoutId]'], workoutId: '41' };
const today = { segments: ['(tabs)', 'index'], workoutId: undefined };

function setup(overrides = {}) {
  let state = { active: timer, pending: null };
  let context = {
    nowMs: deadline, appState: 'active', foregroundSinceMs: 60_000,
    loggerVisibleSinceMs: 60_000, currentUserId: '9', route: logger,
    ...overrides,
  };
  const events = [];
  const router = new RestTimerExpiryRouter({
    readState: () => state,
    context: (current) => ({ ...current, ...context }),
    cancelNotification: (id) => events.push(['cancel', id]),
    playBeep: (current) => events.push(['beep', current.timerId]),
  });
  return {
    router, events,
    setState: (next) => { state = next; },
    setContext: (next) => { context = { ...context, ...next }; },
  };
}

{
  const { router, events } = setup();
  assert.equal(router.route(timer), 'beep');
  assert.deepEqual(events, [['cancel', 'notification-1'], ['beep', timer.timerId]],
    'visible Logger cancels the scheduled notification before one media beep');
  assert.equal(router.routeNotification(timer.timerId, deadline, 'notification-1', deadline), 'beep');
  assert.equal(router.route(timer), 'beep');
  assert.equal(events.length, 2, 'JS and native callbacks cannot duplicate output');
}
for (const overrides of [
  { route: today, loggerVisibleSinceMs: null },
  { appState: 'background', foregroundSinceMs: null },
  { appState: 'inactive', foregroundSinceMs: null },
  { foregroundSinceMs: deadline + 1 },
  { loggerVisibleSinceMs: deadline + 1 },
]) {
  const { router, events } = setup(overrides);
  assert.equal(router.route(timer), 'notification', JSON.stringify(overrides));
  assert.deepEqual(events, [], 'other routes and lifecycle states never play foreground media');
}
{
  const { router, events, setContext } = setup({ appState: 'background', foregroundSinceMs: null });
  assert.equal(router.route(timer), 'notification');
  setContext({ appState: 'active', foregroundSinceMs: deadline + 1,
    loggerVisibleSinceMs: deadline + 1 });
  assert.equal(router.route(timer), 'notification');
  assert.deepEqual(events, [], 'returning after expiry cannot produce a delayed beep');
}
{
  const { router, events, setState } = setup();
  setState({ active: null, pending: null });
  assert.equal(router.route(timer), 'stale', 'Skip is terminal');
  assert.equal(router.routeNotification(timer.timerId, deadline, 'notification-1', deadline), 'stale');
  assert.deepEqual(events, []);
}
{
  const { router, events, setState } = setup();
  setState({ active: { ...timer, endAtMs: deadline + 30_000,
    notificationId: 'notification-2' }, pending: null });
  assert.equal(router.route(timer), 'stale', 'old JS callback cannot end extended timer');
  assert.equal(router.routeNotification(timer.timerId, deadline, 'notification-1', deadline), 'stale',
    'old scheduled request cannot end extended timer');
  assert.equal(router.routeNotification(timer.timerId, deadline + 30_000, 'notification-2', deadline), 'stale',
    'new notification cannot fire before extended deadline');
  assert.deepEqual(events, []);
}
{
  const { router, events, setState } = setup();
  setState({ active: { ...timer, timerId: 'replacement' }, pending: null });
  assert.equal(router.route(timer), 'stale');
  assert.equal(router.routeNotification(timer.timerId, deadline, 'notification-1', deadline), 'stale');
  assert.deepEqual(events, []);
}
{
  const { router, events, setState } = setup();
  // Logger countdown may reconcile into pending before the native handler arrives.
  setState({ active: null, pending: {
    timerId: timer.timerId, workoutId: timer.workoutId, ownerUserId: timer.ownerUserId,
    completedAtMs: deadline, notificationId: timer.notificationId,
  } });
  assert.equal(router.routeNotification(timer.timerId, deadline, 'notification-1', deadline), 'beep');
  assert.deepEqual(events, [['cancel', 'notification-1'], ['beep', timer.timerId]]);
}
console.log('Rest timer expiry router lifecycle and race tests passed.');
