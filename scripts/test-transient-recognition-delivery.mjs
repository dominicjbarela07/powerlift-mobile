import assert from 'node:assert/strict';

import {
  attachTransientRecognitionDelivery,
  createTimerHandoffReleaseController,
  feedbackMotionDuration,
  initialLoggerFeedbackState,
  loggerFeedbackReducer,
  recognitionDeliveryId,
  selectCelebrationEvents,
  selectSessionHighlights,
  timerHandoffResolution,
} from '../lib/logger-feedback.ts';
import { createLoggerFeedbackStorage } from '../lib/logger-feedback-storage-core.ts';

const event = (id, eventType = 'CORE_WEIGHT_PR', priority = 20, overrides = {}) => ({
  id,
  event_type: eventType,
  priority,
  core_movement_key: 'competition_squat',
  movement_label: 'Competition Squat',
  current_value: 190,
  prior_value: 180,
  delta: 10,
  unit: 'kg',
  scope: eventType.includes('BLOCK') ? 'block' : 'career',
  source_set_log_id: 14,
  trigger_set_log_id: 14,
  source_revision: 1,
  calculation_version: 'core-accomplishment-v1',
  newly_generated: true,
  replayed: false,
  consumed: false,
  evidence: { actual_weight_kg: 190, actual_reps: 1 },
  ...overrides,
});

const responseEvents = attachTransientRecognitionDelivery([
  event(100, 'CORE_WEIGHT_PR', 20),
  event(101, 'CORE_BLOCK_WEIGHT_BEST', 50),
], { workoutId: 2, clientSubmissionId: 'scenario-02-created-a' });

// Durable truth keeps both canonical events; transient truth selects the
// server-priority career Weight PR and records the secondary count.
assert.deepEqual(selectSessionHighlights(responseEvents).map((row) => row.id), [100, 101]);
let state = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 8 });
state = loggerFeedbackReducer(state, {
  type: 'SUBMIT_SUCCEEDED',
  setLogId: 14,
  created: true,
  replayed: false,
  events: responseEvents,
});
state = loggerFeedbackReducer(state, { type: 'TIMER_PICKER_PENDING' });
state = loggerFeedbackReducer(state, { type: 'SAVE_CONFIRMATION_FINISHED' });

// The 700 ms sheet-close boundary and a workout refresh do not erase the
// event. Crucially, picker_pending blocks the old same-tick release race.
state = loggerFeedbackReducer(state, { type: 'CANONICAL_COMPLETION_CONFIRMED', completionBoundary: {
  authority: 'canonical', movement_final_set: true, session_final_set: false, workout_evidence_revision: 2,
} });
state = loggerFeedbackReducer(state, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(state.recognition.currentEvent, null);
assert.equal(state.recognition.queuedEvents[0].event_type, 'CORE_WEIGHT_PR');
assert.equal(state.recognition.queuedEvents[0].secondary_highlight_count, 1);
assert.equal('movementCompletion' in state, false);

// Selecting a timer resolves the decision immediately; the running timer does
// not consume recognition. Presentation is not marked seen until the surface
// explicitly reports that it began.
state = loggerFeedbackReducer(state, { type: 'TIMER_ACTIVE' });
state = loggerFeedbackReducer(state, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(state.recognition.currentEvent.event_type, 'CORE_WEIGHT_PR');
assert.equal(state.recognition.displayedDeliveryIds.length, 0);
const deliveryId = recognitionDeliveryId(state.recognition.currentEvent);
state = loggerFeedbackReducer(state, { type: 'RECOGNITION_PRESENTATION_STARTED', deliveryId });
state = loggerFeedbackReducer(state, { type: 'RECOGNITION_PRESENTATION_STARTED', deliveryId });
assert.deepEqual(state.recognition.displayedDeliveryIds, [deliveryId]);
state = loggerFeedbackReducer(state, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(state.recognition.currentEvent.event_type, 'CORE_WEIGHT_PR');

// Timer cancel/dismiss and no-timer fallback both release the same queue.
for (const timerResolution of ['TIMER_IDLE', 'TIMER_ACTIVE']) {
  let timerState = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 8 });
  timerState = loggerFeedbackReducer(timerState, { type: 'SUBMIT_SUCCEEDED', setLogId: 14, created: true, replayed: false, events: responseEvents });
  timerState = loggerFeedbackReducer(timerState, { type: 'TIMER_PICKER_PENDING' });
  timerState = loggerFeedbackReducer(timerState, { type: 'SAVE_CONFIRMATION_FINISHED' });
  timerState = loggerFeedbackReducer(timerState, { type: timerResolution });
  timerState = loggerFeedbackReducer(timerState, { type: 'DISPLAY_NEXT_RECOGNITION' });
  assert.equal(timerState.recognition.currentEvent.event_type, 'CORE_WEIGHT_PR');
}

// A session-final set uses the same handoff: canonical workout completion may
// become available while the timer decision is pending, but it cannot erase or
// outrank the primary recognition event from that accepted set submission.
let sessionFinal = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 8 });
sessionFinal = loggerFeedbackReducer(sessionFinal, {
  type: 'SUBMIT_SUCCEEDED',
  setLogId: 14,
  created: true,
  replayed: false,
  events: responseEvents,
});
sessionFinal = loggerFeedbackReducer(sessionFinal, { type: 'TIMER_PICKER_PENDING' });
sessionFinal = loggerFeedbackReducer(sessionFinal, { type: 'SAVE_CONFIRMATION_FINISHED' });
sessionFinal = loggerFeedbackReducer(sessionFinal, {
  type: 'CANONICAL_COMPLETION_CONFIRMED',
  completionBoundary: {
    authority: 'canonical',
    movement_final_set: true,
    session_final_set: true,
    workout_evidence_revision: 3,
  },
});
sessionFinal = loggerFeedbackReducer(sessionFinal, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(sessionFinal.recognition.currentEvent, null);
assert.equal(sessionFinal.recognition.queuedEvents[0].event_type, 'CORE_WEIGHT_PR');
sessionFinal = loggerFeedbackReducer(sessionFinal, { type: 'TIMER_IDLE' });
sessionFinal = loggerFeedbackReducer(sessionFinal, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(sessionFinal.recognition.currentEvent.event_type, 'CORE_WEIGHT_PR');

// React Native passes the press event to a bare `onPress={onClose}` callback.
// That supported cancel path must still resolve the picker as dismissed rather
// than leaving transient recognition blocked in picker_pending.
assert.equal(timerHandoffResolution('selected'), 'selected');
assert.equal(timerHandoffResolution('dismissed'), 'dismissed');
assert.equal(timerHandoffResolution({ nativeEvent: {} }), 'dismissed');
assert.equal(timerHandoffResolution(undefined), 'dismissed');

// The screen-owned timer handoff resolves exactly once. A mounted picker waits
// for the athlete; a picker that never mounts deterministically releases the
// queue through the unavailable callback.
const mountChecks = [];
const releaseController = createTimerHandoffReleaseController(
  (callback) => {
    const handle = { cancelled: false, run: () => { if (!handle.cancelled) callback(); } };
    mountChecks.push(handle);
    return handle;
  },
  (handle) => { handle.cancelled = true; },
);
let unavailableCount = 0;
assert.equal(releaseController.begin('set:14', () => { unavailableCount += 1; }), true);
assert.equal(releaseController.mounted('set:14'), true);
mountChecks[0].run();
assert.equal(unavailableCount, 0);
assert.equal(releaseController.resolve('set:14'), true);
assert.equal(releaseController.resolve('set:14'), false);
assert.equal(releaseController.begin('set:15', () => { unavailableCount += 1; }), true);
mountChecks[1].run();
assert.equal(unavailableCount, 1);
assert.equal(releaseController.resolve('set:15'), false);

// Genuine replay and accessory saves never enter transient recognition.
let replay = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 8 });
replay = loggerFeedbackReducer(replay, { type: 'SUBMIT_SUCCEEDED', setLogId: 14, created: false, replayed: true, events: responseEvents });
assert.equal(replay.recognition.queuedEvents.length, 0);
let accessory = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 30 });
accessory = loggerFeedbackReducer(accessory, { type: 'SUBMIT_SUCCEEDED', setLogId: 30, created: true, replayed: false, events: [event(300, 'ACCESSORY_WEIGHT_PR', 1)] });
assert.equal(accessory.recognition.queuedEvents.length, 0);
let ordinary = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 31 });
ordinary = loggerFeedbackReducer(ordinary, { type: 'SUBMIT_SUCCEEDED', setLogId: 31, created: true, replayed: false, events: [] });
assert.equal(ordinary.recognition.queuedEvents.length, 0);

// Observed canonical PR types use the same delivery and release path.
for (const [index, eventType] of [
  'CORE_REP_MAX_PR',
  'CORE_BLOCK_WEIGHT_BEST',
  'CORE_BLOCK_REP_MAX_BEST',
].entries()) {
  const delivered = attachTransientRecognitionDelivery([event(400 + index, eventType, 10 + index)], {
    workoutId: 2,
    clientSubmissionId: `variant-${index}`,
  });
  let variant = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 8 });
  variant = loggerFeedbackReducer(variant, { type: 'SUBMIT_SUCCEEDED', setLogId: 20 + index, created: true, replayed: false, events: delivered });
  variant = loggerFeedbackReducer(variant, { type: 'SAVE_CONFIRMATION_FINISHED' });
  variant = loggerFeedbackReducer(variant, { type: 'DISPLAY_NEXT_RECOGNITION' });
  assert.equal(variant.recognition.currentEvent.event_type, eventType);
}
for (const [index, eventType] of ['CORE_E1RM_PR', 'CORE_BLOCK_E1RM_BEST'].entries()) {
  const delivered = attachTransientRecognitionDelivery([event(450 + index, eventType, 30 + index)], {
    workoutId: 2,
    clientSubmissionId: `analytical-${index}`,
  });
  let analytical = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 8 });
  analytical = loggerFeedbackReducer(analytical, { type: 'SUBMIT_SUCCEEDED', setLogId: 40 + index, created: true, replayed: false, events: delivered });
  analytical = loggerFeedbackReducer(analytical, { type: 'SAVE_CONFIRMATION_FINISHED' });
  analytical = loggerFeedbackReducer(analytical, { type: 'DISPLAY_NEXT_RECOGNITION' });
  assert.equal(analytical.recognition.currentEvent, null);
  assert.equal(analytical.recognition.queuedEvents.length, 0);
  assert.deepEqual(selectSessionHighlights(delivered).map((row) => row.id), [450 + index]);
}

// Edit/delete invalidation still removes pending transient work.
let invalidated = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'RESTORE_PENDING', events: responseEvents });
invalidated = loggerFeedbackReducer(invalidated, { type: 'SET_EDITED', sourceSetLogId: 14 });
assert.equal(invalidated.recognition.queuedEvents.length, 0);

// Persisted suppression is keyed by delivery identity, not a reset-reused
// event/set-log integer. A new canonical submission with id 100 is displayable.
const memory = new Map();
const storage = createLoggerFeedbackStorage({
  getItem: async (key) => memory.get(key) ?? null,
  setItem: async (key, value) => { memory.set(key, value); },
});
await storage.persist(2, selectCelebrationEvents(responseEvents));
await storage.consume(2, recognitionDeliveryId(responseEvents[0]));
const afterReset = attachTransientRecognitionDelivery([
  event(100, 'CORE_WEIGHT_PR', 20),
], { workoutId: 2, clientSubmissionId: 'scenario-02-created-after-reset' });
await storage.persist(2, afterReset);
const restored = await storage.load(2);
assert.deepEqual(restored.pending.map(recognitionDeliveryId), [recognitionDeliveryId(afterReset[0])]);
assert.notEqual(recognitionDeliveryId(afterReset[0]), recognitionDeliveryId(responseEvents[0]));

// Reduced Motion preserves the final evidence state by removing choreography
// duration, not by changing recognition eligibility or delivery.
assert.equal(feedbackMotionDuration(500, true), 0);
assert.equal(feedbackMotionDuration(500, false), 500);

console.log('[transient-recognition-delivery] timer handoff, presentation start, replay, reset reuse, durable separation, variants, and invalidation passed');
