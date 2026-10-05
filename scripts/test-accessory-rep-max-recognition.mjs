import assert from 'node:assert/strict';
import {
  acceptedSetHapticKind,
  initialLoggerFeedbackState,
  loggerFeedbackReducer,
  recognitionPresentation,
  selectCelebrationEvents,
  selectSessionHighlights,
} from '../lib/logger-feedback.ts';
import { recognitionMotionConfig } from '../lib/recognition-motion-registry.ts';
import { CANONICAL_PR_EVENT_TYPES, buildPersonalBestEvidence } from '../lib/post-session-pr-evidence.ts';

const event = (id, weight, prior, setId) => ({
  id, event_type: 'ACCESSORY_REP_MAX_PR', priority: 20,
  core_movement_key: 'accessory:71', movement_label: 'Machine Dip',
  current_value: weight, prior_value: prior, delta: prior == null ? null : weight - prior,
  unit: 'kg', scope: 'career', comparison_bucket: 'reps:12',
  source_set_log_id: setId, trigger_set_log_id: setId, workout_id: 9,
  source_revision: 1, calculation_version: 'core-accomplishment-v1',
  newly_generated: true, replayed: false, consumed: false,
  evidence: { actual_weight_kg: weight, actual_reps: 12, rep_count: 12,
    movement_definition_id: 71, equipment_configuration_identity_id: 81, comparison_scope: 'exact_implementation',
    equipment_label: 'Hammer Strength · Plate Loaded' },
});
const first = event(1, 175, 160, 101);
const stronger = event(2, 180, 175, 102);
const freeBaseline = { ...event(7, 20, null, 107), core_movement_key: 'accessory:253',
  movement_label: 'Dumbbell Curl', evidence: { actual_weight_kg: 20, actual_reps: 12, rep_count: 12,
    movement_definition_id: 253, equipment_configuration_identity_id: null, comparison_scope: 'portable_exact_movement' } };
assert.deepEqual(selectCelebrationEvents([freeBaseline]).map((row) => row.id), [7]);
assert.equal(recognitionPresentation(freeBaseline, 'kg')?.eyebrow, '12RM ESTABLISHED');
assert.equal(acceptedSetHapticKind([freeBaseline]), 'career');
assert.equal(buildPersonalBestEvidence([freeBaseline], []).length, 1);
for (const unearned of [event(3, 175, null, 103), event(4, 175, 175, 104),
  event(5, 170, 175, 105), event(6, 175.0005, 175, 106)]) {
  assert.deepEqual(selectCelebrationEvents([unearned]), [], 'Baselines and non-improvements must never celebrate');
  assert.deepEqual(selectSessionHighlights([unearned], 9), []);
  assert.equal(recognitionPresentation(unearned, 'kg'), null);
  assert.equal(acceptedSetHapticKind([unearned]), 'ordinary');
  assert.deepEqual(buildPersonalBestEvidence([unearned], []), []);
  const rejected = loggerFeedbackReducer(initialLoggerFeedbackState, {
    type: 'SUBMIT_SUCCEEDED', setLogId: unearned.source_set_log_id, created: true, replayed: false, events: [unearned],
  });
  assert.deepEqual(rejected.recognition.queuedEvents, []);
  const restored = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'RESTORE_PENDING', events: [unearned] });
  assert.deepEqual(restored.recognition.queuedEvents, [], 'Old pending baselines must not reappear');
}
assert.equal(CANONICAL_PR_EVENT_TYPES.has(first.event_type), true);
assert.deepEqual(selectCelebrationEvents([first]).map((row) => row.id), [1]);
assert.equal(recognitionMotionConfig(first.event_type)?.primitive, 'record-takeover');
assert.deepEqual(recognitionMotionConfig(first.event_type)?.haptics, ['medium-impact', 'success-settle']);
assert.equal(acceptedSetHapticKind([first]), 'career');
const presentation = recognitionPresentation(first, 'kg');
assert.equal(presentation?.eyebrow, 'NEW 12RM');
assert.equal(presentation?.value, '175 kg');
assert.match(presentation?.accessibilityLabel || '', /Machine Dip/);
let state = loggerFeedbackReducer(initialLoggerFeedbackState, {
  type: 'SUBMIT_SUCCEEDED', setLogId: 101, created: true, replayed: false, events: [first],
});
assert.deepEqual(state.recognition.queuedEvents.map((row) => row.id), [1]);
const coalesced = loggerFeedbackReducer(state, {
  type: 'SUBMIT_SUCCEEDED', setLogId: 102, created: true, replayed: false, events: [stronger],
});
assert.deepEqual(coalesced.recognition.queuedEvents.map((row) => row.id), [2]);
state = loggerFeedbackReducer(state, { type: 'SAVE_CONFIRMATION_FINISHED' });
const timerPending = loggerFeedbackReducer(state, { type: 'TIMER_PICKER_PENDING' });
assert.equal(loggerFeedbackReducer(timerPending, { type: 'DISPLAY_NEXT_RECOGNITION' }).recognition.currentEvent, null);
const timerReleased = loggerFeedbackReducer(timerPending, { type: 'TIMER_IDLE' });
assert.equal(loggerFeedbackReducer(timerReleased, { type: 'DISPLAY_NEXT_RECOGNITION' }).recognition.currentEvent?.id, 1);
const background = loggerFeedbackReducer(state, { type: 'APP_BACKGROUNDED' });
assert.equal(loggerFeedbackReducer(background, { type: 'DISPLAY_NEXT_RECOGNITION' }).recognition.currentEvent, null);
assert.equal(loggerFeedbackReducer(loggerFeedbackReducer(background, { type: 'APP_RESUMED' }),
  { type: 'DISPLAY_NEXT_RECOGNITION' }).recognition.currentEvent?.id, 1);
const replay = loggerFeedbackReducer(initialLoggerFeedbackState, {
  type: 'SUBMIT_SUCCEEDED', setLogId: 101, created: false, replayed: true, events: [first],
});
assert.deepEqual(replay.recognition.queuedEvents, []);
state = loggerFeedbackReducer(state, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(state.recognition.currentEvent?.id, 1);
assert.deepEqual(selectSessionHighlights([first, stronger], 9).map((row) => row.id), [1, 2]);
const movement = { item_id: 7, label: 'Machine Dip',
  sets: [{ id: 101, actual_weight_kg: 175, actual_reps: 12 },
    { id: 102, actual_weight_kg: 180, actual_reps: 12 }] };
const evidence = buildPersonalBestEvidence([
  { ...first, workout_item_id: 7 },
  { ...stronger, workout_item_id: 7 },
], [movement]);
assert.equal(evidence.length, 1);
assert.equal(evidence[0].record.current_value, 180);
assert.equal(evidence[0].record.target_reps, 12);
assert.equal(evidence[0].record.metric, 'rep_max_load');
console.log('Accessory rep-max save → celebration → premium motion → recap: PASS');
