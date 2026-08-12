import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ACCEPTED_SET_SHEET_DWELL_MS,
  createCanonicalSetResultGate,
  createCanonicalSetSubmissionController,
  createLogSheetHandoffController,
  feedbackMotionDuration,
  initialLoggerFeedbackState,
  isNewCanonicalSessionFinalSet,
  loggerFeedbackReducer,
} from '../lib/logger-feedback.ts';

const recognitionEvent = (id, eventType = 'CORE_WEIGHT_PR') => ({
  id,
  event_type: eventType,
  priority: eventType === 'CORE_E1RM_PR' ? 10 : eventType === 'CORE_WEIGHT_PR' ? 20 : 50,
  core_movement_key: 'competition_squat',
  movement_label: 'Competition Squat',
  current_value: 190,
  prior_value: 180,
  delta: 10,
  unit: 'kg',
  scope: 'career',
  source_set_log_id: 14,
  trigger_set_log_id: 14,
  source_revision: 1,
  calculation_version: 'core-accomplishment-v1',
  newly_generated: true,
  replayed: false,
  consumed: false,
  evidence: { actual_weight_kg: 190, actual_reps: 1 },
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const canonicalFinalBoundary = {
  authority: 'canonical',
  movement_final_set: true,
  session_final_set: true,
  workout_evidence_revision: 3,
};
assert.equal(isNewCanonicalSessionFinalSet({
  created: true,
  replayed: false,
  completionBoundary: canonicalFinalBoundary,
}), true);
assert.equal(isNewCanonicalSessionFinalSet({
  created: true,
  replayed: false,
  completionBoundary: { ...canonicalFinalBoundary, session_final_set: false },
}), false, 'movement completion alone is not Session completion');
assert.equal(isNewCanonicalSessionFinalSet({
  created: false,
  replayed: true,
  completionBoundary: canonicalFinalBoundary,
}), false, 'an idempotent replay cannot create a second completion prompt');

// A demo reset can reuse a numeric set-log ID. The request identity, not that
// database-local integer, determines whether a response is a duplicate.
const resultGate = createCanonicalSetResultGate();
const reusedSetLog = { set: { id: 14 } };
assert.equal(resultGate.consume(4, 'submission-before-reset', reusedSetLog), true);
assert.equal(resultGate.consume(4, 'submission-before-reset', reusedSetLog), false);
assert.equal(resultGate.consume(4, 'submission-after-reset', reusedSetLog), true);
assert.equal(resultGate.consume(5, 'submission-before-reset', reusedSetLog), true);

// Created Weight PR: one request, canonical acceptance leaves Saving, exact
// accepted dwell, one sheet close/timer handoff, then recognition.
let state = initialLoggerFeedbackState;
let requestCount = 0;
let acceptedCount = 0;
let failureCount = 0;
let settledCount = 0;
const requestDeferred = deferred();
const submissionController = createCanonicalSetSubmissionController();
const submission = submissionController.run({
  onStarted: () => {
    state = loggerFeedbackReducer(state, { type: 'SUBMIT_STARTED', itemId: 11 });
  },
  request: async () => {
    requestCount += 1;
    return requestDeferred.promise;
  },
  onAccepted: (response) => {
    acceptedCount += 1;
    state = loggerFeedbackReducer(state, {
      type: 'SUBMIT_SUCCEEDED',
      setLogId: response.set.id,
      created: response.created,
      replayed: response.replayed,
      events: response.recognition_events,
    });
    state = loggerFeedbackReducer(state, { type: 'TIMER_PICKER_PENDING' });
    return response;
  },
  onFailure: () => {
    failureCount += 1;
    state = loggerFeedbackReducer(state, { type: 'SUBMIT_FAILED' });
  },
  onSettled: () => { settledCount += 1; },
});
assert.equal(state.submission.status, 'submitting');
assert.equal(submissionController.isInFlight(), true);
const rapidSecondTap = await submissionController.run({
  onStarted: () => assert.fail('second tap must not start'),
  request: async () => assert.fail('second tap must not send a request'),
  onFailure: () => assert.fail('ignored tap is not a failure'),
});
assert.equal(rapidSecondTap.status, 'ignored_in_flight');
assert.equal(requestCount, 1);

requestDeferred.resolve({
  created: true,
  replayed: false,
  set: { id: 14, client_submission_id: 'weight-pr-created' },
  recognition_events: [recognitionEvent(100)],
});
const createdOutcome = await submission;
assert.equal(createdOutcome.status, 'accepted');
assert.equal(acceptedCount, 1);
assert.equal(failureCount, 0);
assert.equal(settledCount, 1);
assert.equal(state.submission.status, 'persisted_new_set');
assert.equal(state.recognition.saveConfirmationVisible, true);
assert.equal(state.recognition.currentEvent, null);
assert.equal(state.recognition.queuedEvents.length, 1);

const scheduled = [];
let sheetCloseCount = 0;
let timerHandoffCount = 0;
const handoff = createLogSheetHandoffController(
  (callback, delayMs) => {
    const handle = { cancelled: false, ran: false, delayMs, run: () => {
      if (handle.cancelled || handle.ran) return;
      handle.ran = true;
      callback();
    } };
    scheduled.push(handle);
    return handle;
  },
  (handle) => { handle.cancelled = true; },
);
assert.equal(handoff.begin(state.submission.status, state.submission.lastSetLogId, state.submission.activeItemId, (plan) => {
  sheetCloseCount += 1;
  if (plan.openTimerPicker) timerHandoffCount += 1;
}), true);
assert.equal(scheduled[0].delayMs, ACCEPTED_SET_SHEET_DWELL_MS);
assert.equal(ACCEPTED_SET_SHEET_DWELL_MS, 700);
scheduled[0].run();
scheduled[0].run();
assert.equal(sheetCloseCount, 1);
assert.equal(timerHandoffCount, 1);

// Presentation is downstream of canonical acceptance and timer handoff. It is
// not awaited by the submission promise and cannot revert accepted truth.
let animationStartCount = 0;
state = loggerFeedbackReducer(state, { type: 'SAVE_CONFIRMATION_FINISHED' });
assert.equal(state.submission.status, 'idle');
assert.equal(state.recognition.currentEvent, null);
state = loggerFeedbackReducer(state, { type: 'TIMER_IDLE' });
state = loggerFeedbackReducer(state, { type: 'DISPLAY_NEXT_RECOGNITION' });
if (state.recognition.currentEvent) animationStartCount += 1;
assert.equal(animationStartCount, 1);
assert.equal(state.recognition.currentEvent.event_type, 'CORE_WEIGHT_PR');
// An interrupted presentation has no reducer action that can re-enter Saving.
assert.equal(state.submission.status, 'idle');

// Replay closes with the existing replay plan and cannot queue recognition or
// open the timer.
let replayState = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 11 });
replayState = loggerFeedbackReducer(replayState, {
  type: 'SUBMIT_SUCCEEDED', setLogId: 14, created: false, replayed: true,
  events: [recognitionEvent(101)],
});
assert.equal(replayState.submission.status, 'idempotent_replay');
assert.equal(replayState.recognition.queuedEvents.length, 0);
let replayCloseCount = 0;
let replayTimerCount = 0;
const replayHandoff = createLogSheetHandoffController();
assert.equal(replayHandoff.begin(replayState.submission.status, 14, 11, (plan) => {
  replayCloseCount += 1;
  if (plan.openTimerPicker) replayTimerCount += 1;
}), true);
assert.equal(replayCloseCount, 1);
assert.equal(replayTimerCount, 0);

// Failure exits Saving and remains retryable.
let failedState = initialLoggerFeedbackState;
const failedController = createCanonicalSetSubmissionController();
const failedOutcome = await failedController.run({
  onStarted: () => { failedState = loggerFeedbackReducer(failedState, { type: 'SUBMIT_STARTED', itemId: 11 }); },
  request: async () => { throw new Error('network unavailable'); },
  onFailure: () => { failedState = loggerFeedbackReducer(failedState, { type: 'SUBMIT_FAILED' }); },
});
assert.equal(failedOutcome.status, 'failed');
assert.equal(failedState.submission.status, 'failure');
assert.equal(failedController.isInFlight(), false);

// Workout change/unmount cancels callback delivery from an old in-flight
// request without leaving the controller locked.
let staleCallbackCount = 0;
const staleDeferred = deferred();
const staleController = createCanonicalSetSubmissionController();
const staleRun = staleController.run({
  onStarted: () => {},
  request: () => staleDeferred.promise,
  onAccepted: () => { staleCallbackCount += 1; },
  onFailure: () => { staleCallbackCount += 1; },
});
staleController.reset();
staleDeferred.resolve({ ok: true });
assert.equal((await staleRun).status, 'cancelled');
assert.equal(staleCallbackCount, 0);
assert.equal(staleController.isInFlight(), false);

// Ordinary saves and every supported record type use the same canonical
// submission transition; presentation type does not alter request ownership.
for (const [index, eventType] of [
  'CORE_REP_MAX_PR',
  'CORE_E1RM_PR',
  'CORE_BLOCK_WEIGHT_BEST',
  'CORE_BLOCK_E1RM_BEST',
].entries()) {
  let variantState = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 20 + index });
  variantState = loggerFeedbackReducer(variantState, {
    type: 'SUBMIT_SUCCEEDED', setLogId: 20 + index, created: true, replayed: false,
    events: [recognitionEvent(200 + index, eventType)],
  });
  assert.equal(variantState.submission.status, 'persisted_new_set');
}
let ordinaryState = loggerFeedbackReducer(initialLoggerFeedbackState, { type: 'SUBMIT_STARTED', itemId: 30 });
ordinaryState = loggerFeedbackReducer(ordinaryState, {
  type: 'SUBMIT_SUCCEEDED', setLogId: 30, created: true, replayed: false, events: [],
});
assert.equal(ordinaryState.submission.status, 'persisted_new_set');
assert.equal(ordinaryState.recognition.queuedEvents.length, 0);

assert.equal(feedbackMotionDuration(180, true), 0);
const feedbackSurface = fs.readFileSync(new URL('../components/workout-logger/logger-feedback.tsx', import.meta.url), 'utf8');
const canonicalRecognitionSurface = fs.readFileSync(
  new URL('../components/workout-logger/canonical-record-recognition.tsx', import.meta.url),
  'utf8',
);
assert.match(canonicalRecognitionSurface, /if \(reduceMotion\) \{[\s\S]*evidenceOpacity\.setValue\(1\)/);
assert.match(feedbackSurface, /'CURRENT BEST'/);
assert.match(feedbackSurface, /'NEW BEST'/);
assert.match(canonicalRecognitionSurface, />\{formerLabel\}</);
assert.match(canonicalRecognitionSurface, />\{newLabel\}</);
assert.doesNotMatch(feedbackSurface, /SUBMIT_STARTED|SUBMIT_SUCCEEDED|fetchJson/);

console.log('[set-submission-lifecycle] canonical acceptance, dedupe, dwell, replay, failure, cleanup, and presentation separation tests passed');
