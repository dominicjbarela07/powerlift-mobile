import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  initialLoggerFeedbackState, acceptedSetHapticKind, feedbackMotionDuration, loggerFeedbackReducer,
  finalAssignedSetOpportunity, logSheetHandoffPlan, logSetActionPresentation, normalizeRecognitionEvents,
  recognitionPresentation, recognitionVisibleDuration, safelyRunHaptic, selectCelebrationEvents,
  selectSessionHighlights, submissionFailureHapticKind,
} from '../lib/logger-feedback.ts';
import { createLoggerFeedbackStorage, MAX_CONSUMED_RECOGNITION_IDS } from '../lib/logger-feedback-storage-core.ts';

const event = (id, event_type = 'CORE_WEIGHT_PR', priority = 10, overrides = {}) => ({
  id, event_type, priority, core_movement_key: 'competition_squat', movement_label: 'Competition Squat',
  current_value: 205, prior_value: 202.5, delta: 2.5, unit: 'kg', scope: 'career', source_set_log_id: 99,
  trigger_set_log_id: 99, source_revision: 1, calculation_version: 'core-accomplishment-v1', newly_generated: true,
  replayed: false, consumed: false, evidence: { actual_weight_kg: 205, actual_reps: 5 }, ...overrides,
});
const boundary = (movement_final_set, session_final_set) => ({ authority: 'canonical', movement_final_set, session_final_set, workout_evidence_revision: 4 });

// Orthogonal state domains remain intact under overlapping actions.
let state = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 10 });
assert.equal(state.submission.status, 'submitting');
assert.equal(state.submission.activeItemId, 10);
state = loggerFeedbackReducer(state, { type: 'SUBMIT_SUCCEEDED', setLogId: 1, created: true, replayed: false, events: [event(1)], completionBoundary: boundary(true, false) });
state = loggerFeedbackReducer(state, { type: 'TIMER_PICKER_PENDING' });
assert.equal(state.submission.status, 'persisted_new_set');
assert.equal(state.timer.status, 'picker_pending');
assert.equal(state.recognition.status, 'queued');
assert.equal(state.completionBoundary.status, 'movement_final_set');
state = loggerFeedbackReducer(state, { type: 'SAVE_CONFIRMATION_FINISHED' });
assert.equal(state.submission.status, 'idle');
assert.equal(state.submission.activeItemId, null);
state = loggerFeedbackReducer(state, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(state.recognition.status, 'queued');
state = loggerFeedbackReducer(state, { type: 'TIMER_IDLE' });
state = loggerFeedbackReducer(state, { type: 'DISPLAY_NEXT_RECOGNITION' });
state = loggerFeedbackReducer(state, { type: 'APP_BACKGROUNDED' });
assert.equal(state.recognition.status, 'displayed');
assert.equal(state.recognition.currentEvent.id, 1);
state = loggerFeedbackReducer(state, { type: 'APP_RESUMED' });
assert.equal(state.recognition.currentEvent.id, 1);
state = loggerFeedbackReducer(state, { type: 'SET_EDITED', sourceSetLogId: 777 });
assert.equal(state.timer.status, 'idle');
assert.equal(state.sourceMutation.status, 'set_edited');
assert.equal(state.completionBoundary.status, 'movement_final_set');

let sessionState = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'RESTORE_PENDING', events: [event(2), event(3, 'CORE_WEIGHT_PR', 20, { source_set_log_id: 100, trigger_set_log_id: 100 })] });
sessionState = loggerFeedbackReducer(sessionState, { type: 'CANONICAL_COMPLETION_CONFIRMED', completionBoundary: boundary(true, true) });
sessionState = loggerFeedbackReducer(sessionState, { type: 'TIMER_PICKER_PENDING' });
sessionState = loggerFeedbackReducer(sessionState, { type: 'SET_DELETED', sourceSetLogId: 999 });
assert.equal(sessionState.completionBoundary.status, 'session_final_set');
assert.equal(sessionState.recognition.queuedEvents.length, 2);
assert.equal(sessionState.timer.status, 'picker_pending');
const replay = loggerFeedbackReducer(sessionState, { type: 'SUBMIT_SUCCEEDED', setLogId: 9, created: false, replayed: true, events: [event(9)] });
assert.equal(replay.submission.status, 'idempotent_replay');
assert.equal(replay.recognition.queuedEvents.length, 2);
assert.equal(replay.completionBoundary.status, 'session_final_set');
assert.deepEqual(loggerFeedbackReducer(replay, { type: 'RESET' }), initialLoggerFeedbackState);

const failed = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_FAILED' });
assert.equal(failed.submission.status, 'failure');
let stale = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 10 });
stale = loggerFeedbackReducer(stale, { type: 'SUBMIT_FAILED', staleConflict: true });
assert.equal(stale.submission.status, 'stale_conflict');
stale = loggerFeedbackReducer(stale, { type: 'STALE_REFRESH_STARTED' });
assert.equal(stale.submission.status, 'refreshing_stale');
stale = loggerFeedbackReducer(stale, { type: 'STALE_REFRESH_FAILED' });
assert.equal(stale.submission.status, 'stale_conflict');
stale = loggerFeedbackReducer(stale, { type: 'STALE_REFRESH_STARTED' });
stale = loggerFeedbackReducer(stale, { type: 'STALE_REFRESH_SUCCEEDED' });
assert.equal(stale.submission.status, 'idle');
assert.equal(stale.submission.activeItemId, null);

// Completion state is never inferred merely from local submission success.
const unconfirmed = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_SUCCEEDED', setLogId: 4, created: true, replayed: false, events: [] });
assert.equal(unconfirmed.completionBoundary.authority, 'unconfirmed');
assert.equal(unconfirmed.completionBoundary.status, 'none');

// Movement completion remains canonical workflow state, not a feedback queue.
const movementBoundaryState = loggerFeedbackReducer(initialLoggerFeedbackState, {
  type: 'SUBMIT_SUCCEEDED',
  setLogId: 50,
  created: true,
  replayed: false,
  events: [event(50)],
  completionBoundary: boundary(true, false),
});
assert.equal(movementBoundaryState.completionBoundary.status, 'movement_final_set');
assert.equal('movementCompletion' in movementBoundaryState, false);
assert.equal(movementBoundaryState.recognition.status, 'queued');

// Deduplication and mounted-session ID bounds.
let bounded = initialLoggerFeedbackState;
for (let id = 1; id <= 130; id += 1) {
  bounded = loggerFeedbackReducer(bounded, { type: 'RESTORE_PENDING', events: [event(id)] });
  bounded = loggerFeedbackReducer(bounded, { type: 'DISPLAY_NEXT_RECOGNITION' });
  bounded = loggerFeedbackReducer(bounded, { type: 'RECOGNITION_PRESENTATION_STARTED', deliveryId: `legacy-event:${id}` });
  bounded = loggerFeedbackReducer(bounded, { type: 'CONSUME_CURRENT_RECOGNITION' });
}
assert.equal(bounded.recognition.displayedDeliveryIds.length, 100);
const duplicate = loggerFeedbackReducer(bounded, { type: 'RESTORE_PENDING', events: [event(130)] });
assert.equal(duplicate.recognition.queuedEvents.length, 0);
let invalidatedCurrent = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'RESTORE_PENDING', events: [event(201), event(202, 'CORE_E1RM_PR', 30, { source_set_log_id: 202 })] });
invalidatedCurrent = loggerFeedbackReducer(invalidatedCurrent, { type: 'DISPLAY_NEXT_RECOGNITION' });
invalidatedCurrent = loggerFeedbackReducer(invalidatedCurrent, { type: 'INVALIDATE_EVENTS', eventIds: [202] });
assert.equal(invalidatedCurrent.recognition.currentEvent.id, 201);
assert.equal(invalidatedCurrent.recognition.queuedEvents.length, 0);

assert.deepEqual(normalizeRecognitionEvents([event(11), event(10, 'CORE_E1RM_PR', 30), event(11)]).map((row) => row.id), [11, 10]);

// Celebration curation hides bookkeeping, first observations, and overlapping
// metrics from the same accepted set while leaving durable event truth intact.
const overlapping = [
  event(501, 'CORE_E1RM_PR', 30),
  event(502, 'CORE_WEIGHT_PR', 10),
  event(503, 'CORE_REP_MAX_PR', 20, { evidence: { actual_weight_kg: 205, actual_reps: 5, rep_count: 5 } }),
  event(504, 'CORE_BLOCK_WEIGHT_BEST', 40),
  event(505, 'CORE_PRESCRIPTION_COMPLETED', 80),
  event(506, 'CORE_MOVEMENT_SESSION_COMPLETED', 70),
];
assert.deepEqual(selectCelebrationEvents(overlapping).map((row) => row.id), [502]);
assert.equal(selectCelebrationEvents(overlapping)[0].secondary_highlight_count, 2);
assert.equal(overlapping.length, 6);
assert.deepEqual(selectSessionHighlights(overlapping).map((row) => row.id), [502, 503, 501, 504]);
const volumeMilestone = (id, eventType, overrides = {}) => event(id, eventType, eventType === 'CORE_LIFETIME_VOLUME_MILESTONE' ? 35 : 36, {
  core_movement_key: eventType === 'CORE_LIFETIME_VOLUME_MILESTONE' ? 'lifetime_volume_squat' : 'total_lifetime_volume',
  movement_label: eventType === 'CORE_LIFETIME_VOLUME_MILESTONE' ? 'Squat Lifetime Volume' : 'Total Lifetime Volume',
  current_value: 45359.237,
  prior_value: 45087.081578,
  delta: 272.155422,
  scope: eventType === 'CORE_LIFETIME_VOLUME_MILESTONE' ? 'lifetime_volume_lift' : 'lifetime_volume_total',
  evidence: {
    accumulated_reps: 14694,
    lift_family: eventType === 'CORE_LIFETIME_VOLUME_MILESTONE' ? 'squat' : null,
    milestone_scope: eventType === 'CORE_LIFETIME_VOLUME_MILESTONE' ? 'lift' : 'total',
    new_total_kg: 45395.5243896,
    next_threshold_lb: 250000,
    previous_total_kg: 45087.081578,
    threshold_kg: 45359.237,
    threshold_lb: 100000,
  },
  ...overrides,
});
const prAndBothLandmarks = [
  volumeMilestone(532, 'TOTAL_LIFETIME_VOLUME_MILESTONE'),
  event(530, 'CORE_WEIGHT_PR', 10),
  volumeMilestone(531, 'CORE_LIFETIME_VOLUME_MILESTONE'),
];
assert.deepEqual(
  selectCelebrationEvents(prAndBothLandmarks).map((row) => row.id),
  [530, 531, 532],
  'a PR must play first, followed by the per-lift and total landmarks as separate ceremonies',
);
assert.deepEqual(
  selectCelebrationEvents(prAndBothLandmarks.slice(0, 1).concat(prAndBothLandmarks.slice(2))).map((row) => row.id),
  [531, 532],
  'landmarks must still queue when the crossing set earns no PR',
);
let milestoneQueue = loggerFeedbackReducer(initialLoggerFeedbackState, {
  type: 'SUBMIT_SUCCEEDED',
  setLogId: 99,
  created: true,
  replayed: false,
  events: prAndBothLandmarks,
});
assert.deepEqual(milestoneQueue.recognition.queuedEvents.map((row) => row.id), [530, 531, 532]);
milestoneQueue = loggerFeedbackReducer(milestoneQueue, { type: 'SAVE_CONFIRMATION_FINISHED' });
milestoneQueue = loggerFeedbackReducer(milestoneQueue, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(milestoneQueue.recognition.currentEvent.id, 530);
milestoneQueue = loggerFeedbackReducer(milestoneQueue, { type: 'CONSUME_CURRENT_RECOGNITION' });
milestoneQueue = loggerFeedbackReducer(milestoneQueue, { type: 'DISPLAY_NEXT_RECOGNITION' });
assert.equal(milestoneQueue.recognition.currentEvent.id, 531);
milestoneQueue = loggerFeedbackReducer(milestoneQueue, { type: 'INVALIDATE_EVENTS', eventIds: [531] });
assert.equal(milestoneQueue.recognition.currentEvent, null, 'an edited or deleted crossing must remove its active landmark');
assert.deepEqual(milestoneQueue.recognition.queuedEvents.map((row) => row.id), [532]);
const milestoneReplay = loggerFeedbackReducer(milestoneQueue, {
  type: 'SUBMIT_SUCCEEDED',
  setLogId: 99,
  created: false,
  replayed: true,
  events: prAndBothLandmarks,
});
assert.deepEqual(milestoneReplay.recognition.queuedEvents.map((row) => row.id), [532], 'a persistence retry must not duplicate landmark ceremonies');
const durableAcrossWorkouts = [
  ...overlapping.map((row) => ({ ...row, workout_id: 1 })),
  event(510, 'CORE_WEIGHT_PR', 10, { workout_id: 2, source_set_log_id: 100 }),
  event(511, 'CORE_WEIGHT_PR', 10, { workout_id: 1, source_set_log_id: 101, invalidated_at: '2026-07-13T00:00:00Z' }),
  event(512, 'ACCESSORY_WEIGHT_PR', 1, { workout_id: 1, source_set_log_id: 102 }),
  { ...event(502, 'CORE_WEIGHT_PR', 10), workout_id: 1 },
];
assert.deepEqual(selectSessionHighlights(durableAcrossWorkouts, 1).map((row) => row.id), [502, 503, 501, 504]);
assert.deepEqual(selectCelebrationEvents([
  event(507, 'CORE_REP_MAX_PR', 20, { current_value: 200, prior_value: null, delta: null, comparison_bucket: 'reps:5', evidence: { actual_weight_kg: 200, actual_reps: 5, rep_count: 5 } }),
  event(508, 'CORE_PRESCRIPTION_COMPLETED', 80),
]).map((row) => row.id), [507]);
const rpeCollision = [
  event(520, 'CORE_E1RM_PR', 40),
  event(521, 'CORE_RPE_PR', 25, { current_value: 8, prior_value: 9, delta: -1, unit: 'rpe', evidence: { actual_weight_kg: 180, actual_reps: 5, actual_rpe: 8 } }),
  event(522, 'CORE_REP_MAX_PR', 20, { evidence: { actual_weight_kg: 180, actual_reps: 5, rep_count: 5 } }),
  event(523, 'CORE_WEIGHT_PR', 10),
];
assert.deepEqual(selectCelebrationEvents(rpeCollision).map((row) => row.id), [523]);
assert.equal(selectCelebrationEvents(rpeCollision)[0].secondary_highlight_count, 2);
assert.deepEqual(selectCelebrationEvents([
  event(524, 'CORE_E1RM_PR', 30),
  event(525, 'CORE_BLOCK_E1RM_BEST', 60),
]), []);
const completionOnlyState = loggerFeedbackReducer(initialLoggerFeedbackState, {
  type: 'SUBMIT_SUCCEEDED', setLogId: 99, created: true, replayed: false,
  events: [event(509, 'CORE_PRESCRIPTION_COMPLETED', 80)],
});
assert.equal(completionOnlyState.recognition.queuedEvents.length, 0);

// Active display unit is explicit for weight-primary Rep-Max evidence and accessibility.
const kgWeight = recognitionPresentation(event(12), 'kg');
assert.equal(kgWeight.eyebrow, 'New weight PR');
assert.equal(kgWeight.value, '205 kg');
assert.equal(kgWeight.detail, 'Previous 202.5 kg');
assert.equal(kgWeight.delta, '+2.5 kg');
assert.match(kgWeight.accessibilityLabel, /205 kilograms/);
const lbWeight = recognitionPresentation(event(12), 'lb');
assert.equal(lbWeight.value, '450 lb');
assert.equal(lbWeight.detail, 'Previous 445 lb');
assert.equal(lbWeight.delta, '+5 lb');
assert.match(lbWeight.accessibilityLabel, /450 pounds/);
assert.equal(recognitionPresentation(event(13, 'CORE_E1RM_PR'), 'kg'), null);
assert.equal(recognitionPresentation(event(13, 'CORE_BLOCK_E1RM_BEST'), 'lb'), null);
assert.equal(recognitionPresentation(event(13, 'CORE_E1RM_PR'), 'kg', 'historical').value, '205 kg');
assert.equal(recognitionPresentation(event(13, 'CORE_E1RM_PR'), 'lb', 'historical').value, '452 lb');
const totalLandmarkLb = recognitionPresentation(volumeMilestone(540, 'TOTAL_LIFETIME_VOLUME_MILESTONE'), 'lb');
assert.equal(totalLandmarkLb.eyebrow, 'MAJOR LIFETIME VOLUME LANDMARK');
assert.equal(totalLandmarkLb.value, '100K LB');
assert.equal(totalLandmarkLb.detail, '100,080 LB accumulated');
assert.equal(totalLandmarkLb.progression, 'Next 250,000 LB');
const liftLandmarkKg = recognitionPresentation(volumeMilestone(541, 'CORE_LIFETIME_VOLUME_MILESTONE'), 'kg');
assert.equal(liftLandmarkKg.eyebrow, 'SQUAT LIFETIME VOLUME LANDMARK');
assert.equal(liftLandmarkKg.value, '45K KG');
assert.match(liftLandmarkKg.detail, /45,396 KG accumulated/);
const careerRepKg = recognitionPresentation(event(14, 'CORE_REP_MAX_PR', 20, { current_value: 205, prior_value: 200, delta: 5, comparison_bucket: 'reps:5', evidence: { actual_weight_kg: 205, actual_reps: 5, rep_count: 5 } }), 'kg');
assert.equal(careerRepKg.eyebrow, 'NEW 5 REP MAX');
assert.equal(careerRepKg.value, '205 kg');
assert.equal(careerRepKg.detail, 'Previous 200 kg');
assert.equal(careerRepKg.delta, '+5 kg');
assert.equal(careerRepKg.progression, '200 kg → 205 kg');
assert.match(careerRepKg.accessibilityLabel, /5 REP MAX/);
assert.match(careerRepKg.accessibilityLabel, /205 kilograms/);
const establishedRep = recognitionPresentation(event(140, 'CORE_REP_MAX_PR', 20, { current_value: 200, prior_value: null, delta: null, comparison_bucket: 'reps:5', evidence: { actual_weight_kg: 200, actual_reps: 5, rep_count: 5 } }), 'kg');
assert.equal(establishedRep.eyebrow, '5 REP MAX ESTABLISHED');
assert.equal(establishedRep.value, '200 kg');
assert.equal(establishedRep.detail, null);
assert.equal(establishedRep.progression, null);
const careerRepLb = recognitionPresentation(event(141, 'CORE_REP_MAX_PR', 20, { current_value: 205, prior_value: 200, delta: 5, comparison_bucket: 'reps:5', evidence: { actual_weight_kg: 205, actual_reps: 5, rep_count: 5 } }), 'lb');
assert.equal(careerRepLb.eyebrow, 'NEW 5 REP MAX');
assert.equal(careerRepLb.value, '450 lb');
assert.equal(careerRepLb.detail, 'Previous 440 lb');
assert.equal(careerRepLb.delta, '+10 lb');
assert.match(careerRepLb.accessibilityLabel, /450 pounds/);
const blockRepKg = recognitionPresentation(event(142, 'CORE_BLOCK_REP_MAX_BEST', 50, { current_value: 205, prior_value: 200, delta: 5, comparison_bucket: 'reps:5', evidence: { actual_weight_kg: 205, actual_reps: 5, rep_count: 5 } }), 'kg');
assert.equal(blockRepKg.eyebrow, '5 REP MAX BLOCK BEST');
assert.equal(blockRepKg.value, '205 kg');
assert.equal(blockRepKg.detail, 'Previous 200 kg');
assert.equal(blockRepKg.delta, '+5 kg');
const completion = recognitionPresentation(event(15, 'CORE_PRESCRIPTION_COMPLETED', 80, { current_value: 3, prior_value: null, delta: null }), 'lb');
assert.equal(completion.value, '3 sets');
assert.doesNotMatch(completion.accessibilityLabel, /pounds/);
// Historical reuse shares metric formatting but removes transient "New" language.
const historicalWeightKg = recognitionPresentation(event(150, 'CORE_WEIGHT_PR'), 'kg', 'historical');
assert.equal(historicalWeightKg.eyebrow, 'Weight PR');
assert.equal(historicalWeightKg.value, '205 kg');
assert.doesNotMatch(historicalWeightKg.accessibilityLabel, /New/);
const historicalWeightLb = recognitionPresentation(event(151, 'CORE_E1RM_PR'), 'lb', 'historical');
assert.equal(historicalWeightLb.eyebrow, 'e1RM PR');
assert.equal(historicalWeightLb.value, '452 lb');
assert.match(historicalWeightLb.accessibilityLabel, /pounds/);
const historicalRep = recognitionPresentation(event(152, 'CORE_REP_MAX_PR', 20, { current_value: 205, prior_value: 200, delta: 5, comparison_bucket: 'reps:5', evidence: { actual_weight_kg: 205, actual_reps: 5, rep_count: 5 } }), 'lb', 'historical');
assert.equal(historicalRep.eyebrow, '5 REP MAX IMPROVED');
assert.equal(historicalRep.value, '450 lb');
assert.equal(historicalRep.detail, 'Previous 440 lb');
assert.equal(historicalRep.delta, '+10 lb');
const tenRepMax = recognitionPresentation(event(154, 'CORE_REP_MAX_PR', 20, { current_value: 140, prior_value: 135, delta: 5, comparison_bucket: 'reps:10', evidence: { actual_weight_kg: 140, actual_reps: 10, rep_count: 10 } }), 'kg');
assert.equal(tenRepMax.eyebrow, 'NEW 10 REP MAX');
assert.match(tenRepMax.accessibilityLabel, /10 REP MAX/);
const rpePr = recognitionPresentation(event(155, 'CORE_RPE_PR', 25, {
  current_value: 8,
  prior_value: 9,
  delta: -1,
  unit: 'rpe',
  comparison_bucket: 'weight_kg:180:reps:5',
  evidence: { actual_weight_kg: 180, actual_reps: 5, actual_rpe: 8 },
}), 'kg');
assert.equal(rpePr.eyebrow, 'MORE EFFICIENT');
assert.equal(rpePr.value, '@8');
assert.equal(rpePr.detail, 'Previous @9');
assert.equal(rpePr.delta, '-1.0 RPE');
assert.equal(rpePr.progression, '@9 → @8');
assert.equal(rpePr.workload, '180 kg × 5');
assert.match(rpePr.accessibilityLabel, /180 kilograms for 5 reps/);
const historicalRpe = recognitionPresentation(event(156, 'CORE_RPE_PR', 25, {
  current_value: 8,
  prior_value: 9,
  delta: -1,
  unit: 'rpe',
  evidence: { actual_weight_kg: 180, actual_reps: 5, actual_rpe: 8 },
}), 'kg', 'historical');
assert.equal(historicalRpe.eyebrow, 'Movement Efficiency');
const historicalCompletion = recognitionPresentation(event(153, 'CORE_MOVEMENT_SESSION_COMPLETED', 90, { current_value: 3, prior_value: null, delta: null }), 'lb', 'historical');
assert.equal(historicalCompletion.value, '3 sets');
assert.doesNotMatch(historicalCompletion.accessibilityLabel, /pounds/);
// Queued events are formatted at render time, so changing this argument changes output without mutating evidence.
assert.equal(recognitionPresentation(event(16), 'kg').value, '205 kg');
assert.equal(recognitionPresentation(event(16), 'lb').value, '450 lb');
assert.equal(recognitionPresentation(event(17, 'UNSUPPORTED_EVENT'), 'kg'), null);

assert.equal(acceptedSetHapticKind([]), 'ordinary');
assert.equal(acceptedSetHapticKind([event(18, 'CORE_PRESCRIPTION_COMPLETED', 80)]), 'ordinary');
assert.equal(acceptedSetHapticKind([event(19, 'CORE_BLOCK_WEIGHT_BEST', 50)]), 'block');
assert.equal(acceptedSetHapticKind([event(20, 'CORE_BLOCK_WEIGHT_BEST', 50), event(21, 'CORE_WEIGHT_PR', 20)]), 'career');
assert.equal(acceptedSetHapticKind([event(22, 'CORE_RPE_PR', 25, { current_value: 8, prior_value: 9, delta: -1 })]), 'block');
assert.equal(acceptedSetHapticKind([event(23, 'CORE_E1RM_PR', 30)]), 'ordinary');
let hapticCalls = 0;
assert.equal(await safelyRunHaptic(async () => { hapticCalls += 1; throw new Error('native haptic unavailable'); }), false);
assert.equal(hapticCalls, 1);
assert.equal(feedbackMotionDuration(160, true), 0);
assert.equal(submissionFailureHapticKind(), 'error');

// Reward-loop presentation stays tied to the canonical submission lifecycle.
assert.deepEqual(logSetActionPresentation('idle', false), {
  label: 'Log Set', tone: 'ready', disabled: false, accessibilityLabel: 'Log set',
});
assert.equal(logSetActionPresentation('submitting', true).label, 'Saving');
assert.equal(logSetActionPresentation('submitting', true).disabled, true);
assert.equal(logSetActionPresentation('persisted_new_set', true).label, 'Logged');
assert.equal(logSetActionPresentation('failure', true).label, 'Try Again');
assert.equal(logSetActionPresentation('stale_conflict', true).label, 'Refresh');
assert.equal(logSetActionPresentation('stale_conflict', true).disabled, false);
assert.equal(logSetActionPresentation('refreshing_stale', true).label, 'Refreshing');
assert.equal(logSetActionPresentation('refreshing_stale', true).disabled, true);
assert.equal(logSetActionPresentation('idempotent_replay', true).label, 'Log Set');
assert.deepEqual(logSheetHandoffPlan('persisted_new_set'), { delayMs: 700, openTimerPicker: true });
assert.deepEqual(logSheetHandoffPlan('idempotent_replay'), { delayMs: 0, openTimerPicker: false });
assert.equal(logSheetHandoffPlan('stale_conflict'), null);

// Client-local anticipation is structural only and never recommends changing
// prescribed weight, reps, effort, or set count.
assert.equal(finalAssignedSetOpportunity('Squat', [
  { state: 'completed' }, { state: 'completed' }, { state: 'active' },
]).message, 'Complete this assigned set to finish Squat.');
assert.equal(finalAssignedSetOpportunity('Squat', [
  { state: 'completed' }, { state: 'active' }, { state: 'locked' },
]), null);
assert.equal(finalAssignedSetOpportunity('Squat', [{ state: 'locked' }]), null);

assert.equal(recognitionVisibleDuration(event(401, 'CORE_WEIGHT_PR')), 5000);
assert.equal(recognitionVisibleDuration(event(402, 'CORE_BLOCK_WEIGHT_BEST')), 4200);
assert.equal(recognitionVisibleDuration(event(403, 'CORE_PRESCRIPTION_COMPLETED')), 2200);
assert.equal(recognitionVisibleDuration(volumeMilestone(404, 'TOTAL_LIFETIME_VOLUME_MILESTONE')), 7000);

const accomplishmentBanner = fs.readFileSync(new URL('../components/workout-logger/logger-feedback.tsx', import.meta.url), 'utf8');
assert.match(accomplishmentBanner, /export function FeedbackLifetimeBar/);
assert.match(accomplishmentBanner, /easing: Easing\.linear/);
assert.match(accomplishmentBanner, /if \(animationKey == null \|\| reduceMotion\)/);
assert.match(accomplishmentBanner, /MajorVolumeMilestoneRecognition/);
assert.match(accomplishmentBanner, /triggerMajorVolumeMilestoneHaptic/);

// Canonical document + per-workout serialized storage mutations.
class MemoryAdapter {
  values = new Map(); delays = new Map();
  async getItem(key) { return this.values.get(key) ?? null; }
  async setItem(key, value) { const delay = this.delays.get(key) || 0; if (delay) await new Promise((resolve) => setTimeout(resolve, delay)); this.values.set(key, value); }
}
const adapter = new MemoryAdapter();
const storage = createLoggerFeedbackStorage(adapter);
await Promise.all([storage.persist('a', [event(301)]), storage.persist('a', [event(302)])]);
assert.deepEqual((await storage.load('a')).pending.map((row) => row.id), [301, 302]);
await Promise.all([storage.persist('b', [event(303)]), storage.consume('b', 'legacy-event:303')]);
assert.deepEqual(await storage.load('b'), { pending: [], consumed: ['legacy-event:303'] });
await storage.persist('c', [event(304)]);
await Promise.all([storage.persist('c', [event(305)]), storage.invalidateEvents('c', [304, 305])]);
assert.deepEqual((await storage.load('c')).pending, []);
await Promise.all([storage.invalidateEvents('c-reverse', [310]), storage.persist('c-reverse', [event(310)])]);
assert.deepEqual((await storage.load('c-reverse')).pending.map((row) => row.id), [310]);
await Promise.all([storage.invalidateSet('set-reverse', 99), storage.persist('set-reverse', [event(311)])]);
assert.deepEqual((await storage.load('set-reverse')).pending.map((row) => row.id), [311]);
await storage.persist('d', [event(306), event(307)]);
await Promise.all([storage.consume('d', 'legacy-event:306'), storage.consume('d', 'legacy-event:307')]);
assert.deepEqual((await storage.load('d')).consumed, ['legacy-event:306', 'legacy-event:307']);
assert.deepEqual((await storage.load('a')).pending.map((row) => row.id), [301, 302]);

adapter.delays.set('logger-feedback:v6:wait', 15);
const delayedPersist = storage.persist('wait', [event(308)]);
const observed = storage.load('wait');
await delayedPersist;
assert.deepEqual((await observed).pending.map((row) => row.id), [308]);

adapter.values.set('logger-feedback:v6:bad-json', '{not-json');
assert.deepEqual(await storage.load('bad-json'), { pending: [], consumed: [] });
adapter.values.set('logger-feedback:v6:bad-version', JSON.stringify({ version: 999, pending: [event(1)], consumed: [] }));
assert.deepEqual(await storage.load('bad-version'), { pending: [], consumed: [] });
adapter.values.set('logger-feedback:v6:invalid-event', JSON.stringify({ version: 6, pending: [{ ...event(1), movement_label: '' }, event(309)], consumed: ['x'] }));
assert.deepEqual((await storage.load('invalid-event')).pending.map((row) => row.id), [309]);
for (let id = 1; id <= MAX_CONSUMED_RECOGNITION_IDS + 20; id += 1) await storage.consume('bounded', `delivery-${id}`);
const consumed = (await storage.load('bounded')).consumed;
assert.equal(consumed.length, MAX_CONSUMED_RECOGNITION_IDS);
assert.equal(consumed[0], 'delivery-21');

console.log('[logger-feedback] corrective reducer, presentation, haptic, and storage tests passed');
