import assert from 'node:assert/strict';

import {
  createLogSheetHandoffController,
  finalAssignedSetOpportunity,
  logSheetHandoffPlan,
  logSetActionPresentation,
  recognitionVisibleDuration,
  selectCelebrationEvents,
  selectSessionHighlights,
} from '../lib/logger-feedback.ts';

const event = (id, event_type, priority, overrides = {}) => ({
  id,
  event_type,
  priority,
  core_movement_key: 'competition_squat',
  movement_label: 'Competition Squat',
  current_value: 205,
  prior_value: 200,
  delta: 5,
  unit: 'kg',
  scope: 'career',
  source_set_log_id: 90,
  trigger_set_log_id: 90,
  source_revision: 1,
  calculation_version: 'core-accomplishment-v1',
  newly_generated: true,
  replayed: false,
  consumed: false,
  workout_id: 7,
  evidence: { actual_weight_kg: 205, actual_reps: 5 },
  ...overrides,
});

// The physical-feeling action never reports success before canonical acceptance.
assert.equal(logSetActionPresentation('idle', true).label, 'Log Set');
assert.equal(logSetActionPresentation('submitting', true).label, 'Saving');
assert.equal(logSetActionPresentation('persisted_new_set', true).label, 'Logged');
assert.equal(logSetActionPresentation('failure', true).label, 'Try Again');
assert.equal(logSetActionPresentation('stale_conflict', true).label, 'Refresh');
assert.equal(logSetActionPresentation('stale_conflict', true).disabled, false);
assert.equal(logSetActionPresentation('refreshing_stale', true).label, 'Refreshing');
assert.equal(logSetActionPresentation('refreshing_stale', true).disabled, true);
assert.equal(logSetActionPresentation('persisted_new_set', false).label, 'Log Set');
assert.deepEqual(logSheetHandoffPlan('persisted_new_set'), { delayMs: 700, openTimerPicker: true });
assert.deepEqual(logSheetHandoffPlan('idempotent_replay'), { delayMs: 0, openTimerPicker: false });
assert.equal(logSheetHandoffPlan('failure'), null);

// The accepted handoff is consumed by canonical set identity, so the
// sheet-closing rerender cannot reopen the timer picker.
const scheduledHandoffs = [];
const handoffController = createLogSheetHandoffController(
  (callback, delayMs) => {
    const handle = { cancelled: false, delayMs, run: () => { if (!handle.cancelled) callback(); } };
    scheduledHandoffs.push(handle);
    return handle;
  },
  (handle) => { handle.cancelled = true; },
);
let timerPickerOpenCount = 0;
let sheetCloseCount = 0;
const finish = (plan) => {
  sheetCloseCount += 1;
  if (plan.openTimerPicker) timerPickerOpenCount += 1;
};
assert.equal(handoffController.begin('persisted_new_set', 1001, 10, finish), true);
assert.equal(scheduledHandoffs.length, 1);
assert.equal(scheduledHandoffs[0].delayMs, 700);
scheduledHandoffs[0].run();
assert.equal(sheetCloseCount, 1);
assert.equal(timerPickerOpenCount, 1);
assert.equal(handoffController.begin('persisted_new_set', 1001, 10, finish), false);
assert.equal(scheduledHandoffs.length, 1);
assert.equal(timerPickerOpenCount, 1);
assert.equal(handoffController.begin('idempotent_replay', 1002, 10, finish), true);
assert.equal(sheetCloseCount, 2);
assert.equal(timerPickerOpenCount, 1);
assert.equal(handoffController.begin('persisted_new_set', 1003, 10, finish), true);
scheduledHandoffs[1].run();
assert.equal(timerPickerOpenCount, 2);
assert.equal(handoffController.begin('persisted_new_set', 1004, 10, finish), true);
handoffController.cancelPending();
scheduledHandoffs[2].run();
assert.equal(timerPickerOpenCount, 2);

// Anticipation is limited to the prescribed movement closeout. It never
// manufactures weight, rep, effort, or extra-set recommendations.
const closeout = finalAssignedSetOpportunity('Competition Squat', [
  { state: 'completed' },
  { state: 'completed' },
  { state: 'active' },
]);
assert.equal(closeout?.eyebrow, 'Movement closeout');
assert.match(closeout?.message || '', /assigned set/);
assert.doesNotMatch(closeout?.message || '', /add|increase|extra|more reps|more weight/i);
assert.equal(finalAssignedSetOpportunity('Competition Squat', [
  { state: 'completed' },
  { state: 'active' },
  { state: 'locked' },
]), null);
assert.equal(finalAssignedSetOpportunity('Accessory', [{ state: 'locked' }]), null);

// Canonical server priority controls the primary event. Closely related
// lower-priority events remain durable but do not compete in the transient UI.
const overlapping = [
  event(1, 'CORE_WEIGHT_PR', 20),
  event(2, 'CORE_E1RM_PR', 10),
  event(3, 'CORE_BLOCK_WEIGHT_BEST', 40),
  event(4, 'CORE_PRESCRIPTION_COMPLETED', 80),
];
assert.deepEqual(selectCelebrationEvents(overlapping).map((row) => row.id), [1]);
assert.equal(selectCelebrationEvents(overlapping)[0].secondary_highlight_count, 1);
assert.deepEqual(selectSessionHighlights(overlapping).map((row) => row.id), [2, 1, 3]);

const durableSafety = [
  ...overlapping,
  event(5, 'CORE_WEIGHT_PR', 20, { workout_id: 8, source_set_log_id: 91 }),
  event(6, 'CORE_WEIGHT_PR', 20, { workout_id: 7, source_set_log_id: 92, invalidated: true }),
  event(7, 'ACCESSORY_WEIGHT_PR', 1, { workout_id: 7, source_set_log_id: 93 }),
  event(2, 'CORE_E1RM_PR', 10),
];
assert.deepEqual(selectSessionHighlights(durableSafety, 7).map((row) => row.id), [2, 1, 3]);

// Accessory/unsupported events never enter recognition or active highlights.
assert.deepEqual(selectCelebrationEvents([
  event(10, 'ACCESSORY_WEIGHT_PR', 1),
  event(11, 'CORE_PRESCRIPTION_COMPLETED', 80),
]), []);

// Career accomplishments receive more stillness than block or completion events.
assert.equal(recognitionVisibleDuration(event(20, 'CORE_WEIGHT_PR', 20)), 5000);
assert.equal(recognitionVisibleDuration(event(21, 'CORE_BLOCK_WEIGHT_BEST', 40)), 3400);
assert.equal(recognitionVisibleDuration(event(22, 'CORE_PRESCRIPTION_COMPLETED', 80)), 2200);

console.log('[logger-reward-loop] anticipation, action, hierarchy, safety, and timing tests passed');
