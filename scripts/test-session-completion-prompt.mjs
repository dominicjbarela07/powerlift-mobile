import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  canPresentFinalSessionCompletion,
  finalSessionCompletionReducer,
  initialFinalSessionCompletionState,
} from '../lib/final-session-completion.ts';

const root = path.resolve(import.meta.dirname, '..');
const route = fs.readFileSync(
  path.join(root, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const presenter = fs.readFileSync(
  path.join(root, 'components/workout-logger/final-session-completion-presenter.tsx'),
  'utf8',
);

const section = (start, end) => {
  const startIndex = route.indexOf(start);
  const endIndex = route.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing shipping-path start marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing shipping-path end marker: ${end}`);
  return route.slice(startIndex, endIndex);
};

const presentable = (state, overrides = {}) => canPresentFinalSessionCompletion({
  state,
  saveConfirmationVisible: false,
  recognitionActive: false,
  recognitionQueueLength: 0,
  appBackgrounded: false,
  timerPending: false,
  timerVisible: false,
  ...overrides,
});

// Transition identity: only a newly persisted, canonical final-set event may queue.
let state = finalSessionCompletionReducer(initialFinalSessionCompletionState, {
  type: 'RESET_WORKOUT',
  workoutId: 42,
});
assert.deepEqual(state, {
  workoutId: 42,
  eventId: null,
  phase: 'idle',
  handledEventIds: [],
});
assert.equal(presentable(state), false, 'non-final and failed submissions remain idle');

state = finalSessionCompletionReducer(state, {
  type: 'QUEUE_CANONICAL_FINAL_SET',
  workoutId: 42,
  eventId: '42:9001',
});
assert.equal(state.phase, 'pending');
assert.equal(state.eventId, '42:9001');

// Recognition and timer surfaces always win; completion presents only after they drain.
assert.equal(presentable(state, { saveConfirmationVisible: true }), false);
assert.equal(presentable(state, { recognitionActive: true }), false);
assert.equal(presentable(state, { recognitionQueueLength: 1 }), false);
assert.equal(presentable(state, { appBackgrounded: true }), false);
assert.equal(presentable(state, { timerPending: true }), false);
assert.equal(presentable(state, { timerVisible: true }), false);
assert.equal(presentable(state), true);

state = finalSessionCompletionReducer(state, { type: 'PRESENT_PENDING' });
assert.equal(state.phase, 'visible');
assert.equal(presentable(state), false, 'a visible prompt cannot be presented twice');

// Not Yet acknowledges this exact transition and leaves the active Logger in control.
state = finalSessionCompletionReducer(state, { type: 'NOT_YET' });
assert.equal(state.phase, 'idle');
assert.equal(state.eventId, null);
assert.deepEqual(state.handledEventIds, ['42:9001']);
state = finalSessionCompletionReducer(state, {
  type: 'QUEUE_CANONICAL_FINAL_SET',
  workoutId: 42,
  eventId: '42:9001',
});
assert.equal(state.phase, 'idle', 'the acknowledged transition must not reopen on rerender/replay');

// A distinct accepted transition can present, and the End Session action is double-tap safe.
state = finalSessionCompletionReducer(state, {
  type: 'QUEUE_CANONICAL_FINAL_SET',
  workoutId: 42,
  eventId: '42:9002',
});
state = finalSessionCompletionReducer(state, { type: 'PRESENT_PENDING' });
state = finalSessionCompletionReducer(state, { type: 'BEGIN_END_SESSION' });
assert.equal(state.phase, 'ending');
assert.equal(
  finalSessionCompletionReducer(state, { type: 'BEGIN_END_SESSION' }),
  state,
  'a second End Session press must not start another transition',
);
state = finalSessionCompletionReducer(state, { type: 'END_SESSION_TRANSITION_FAILED' });
assert.equal(state.phase, 'visible', 'a failed transition must remain recoverable');
state = finalSessionCompletionReducer(state, { type: 'BEGIN_END_SESSION' });
state = finalSessionCompletionReducer(state, { type: 'END_SESSION_TRANSITION_SUCCEEDED' });
assert.equal(state.phase, 'idle');
assert.ok(state.handledEventIds.includes('42:9002'));

const acceptedAutoAdvance = section(
  'const markAutoAdvanceAfterAcceptedLog = useCallback',
  'const scrollRef = useRef<any>(null);',
);
const canonicalHandoff = section(
  'const acceptedItemId = feedbackState.submission.activeItemId;',
  'useEffect(() => {\n    if (!canPresentFinalSessionCompletion',
);
const completionPresentation = section(
  'useEffect(() => {\n    if (!canPresentFinalSessionCompletion',
  'useEffect(() => {\n    if (!shouldShowCompletedSetSwipeTooltip',
);
const completionActions = section(
  'const dismissFinalSessionCompletion = useCallback',
  'const continueToPostSessionWithMissingSets',
);
const failedSubmission = section(
  'const handleCanonicalSetFailure = useCallback',
  'const submitCanonicalSet = useCallback',
);
const supersetSave = section(
  'async function saveSupersetRound',
  'const switchDisplayUnit',
);

assert.match(route, /finalSessionCompletionReducer/);
assert.match(route, /FinalSessionCompletionPresenter/);
assert.doesNotMatch(route, /endSessionPromptVisible|completionPromptRef|pendingSessionCompletionPromptRef/,
  'the Logger must have one reducer-owned completion transition');

assert.match(
  canonicalHandoff,
  /submission\.status === 'persisted_new_set'[\s\S]*completionBoundary\.authority === 'canonical'[\s\S]*completionBoundary\.status === 'session_final_set'/,
  'the shipping handoff must consume the authoritative post-persistence whole-session boundary',
);
assert.match(
  canonicalHandoff,
  /if \(isSessionFinalSet\) \{[\s\S]*setTimerPickerVisible\(false\);[\s\S]*stopRestTimer\(\);/,
  'the canonical final set must clear any existing timer before the sheet handoff',
);
assert.match(
  canonicalHandoff,
  /completionEventId = `\$\{acceptedWorkoutId\}:\$\{feedbackState\.submission\.lastSetLogId\}`/,
  'the completion transition must be identified by workout and persisted SetLog',
);
assert.match(
  canonicalHandoff,
  /type: 'QUEUE_CANONICAL_FINAL_SET'[\s\S]*feedbackDispatch\(\{ type: 'TIMER_IDLE' \}\);[\s\S]*return;/,
  'the final branch must queue exactly one prompt and return before rest progression',
);
assert.ok(
  canonicalHandoff.indexOf("type: 'QUEUE_CANONICAL_FINAL_SET'") < canonicalHandoff.indexOf('openTimerPicker();'),
  'the final-session branch must return before the timer picker path',
);

assert.match(
  completionPresentation,
  /saveConfirmationVisible:[\s\S]*recognitionActive:[\s\S]*recognitionQueueLength:[\s\S]*timerPending:[\s\S]*timerVisible:/,
  'recognition and rest surfaces must drain before presentation',
);
assert.match(completionPresentation, /type: 'PRESENT_PENDING'/);

assert.match(
  acceptedAutoAdvance,
  /isNewCanonicalSessionFinalSet\([\s\S]*pendingAutoAdvanceRef\.current = null;[\s\S]*return;[\s\S]*markAutoAdvanceAfterLog\(itemId\)/,
  'final-set results must be rejected by next-movement auto-advance',
);
assert.equal(
  (route.match(/markAutoAdvanceAfterAcceptedLog\(itemId, json\)/g) || []).length,
  5,
  'every individual accepted SetLog path must use the canonical final-set gate',
);
assert.match(supersetSave, /submitCanonicalSet\(/,
  'atomic superset Save Round must converge through canonical accepted-set handling');
assert.doesNotMatch(failedSubmission, /QUEUE_CANONICAL_FINAL_SET|PRESENT_PENDING/,
  'failed SetLog persistence must never queue or present completion');

assert.match(completionActions, /type: 'NOT_YET'/);
assert.match(completionActions, /finalSessionEndTransitionRef\.current/);
assert.match(completionActions, /type: 'BEGIN_END_SESSION'/);
assert.match(completionActions, /openPostSessionSurvey\(\)/,
  'End Session must enter the canonical post-session flow');
assert.match(completionActions, /type: 'END_SESSION_TRANSITION_FAILED'/,
  'a failed transition must be recoverable');
assert.match(route, />\s*Complete Session\s*</,
  'Not Yet must leave an obvious later finish action in the active Logger');

assert.match(presenter, /<Modal/);
assert.match(presenter, /presentationStyle="overFullScreen"/);
assert.match(presenter, /statusBarTranslucent/);
assert.match(presenter, /testID="final-session-completion-modal"/);
assert.match(presenter, />\s*All Sets Completed\s*</);
assert.match(presenter, /logged every set in this Session/);
assert.match(presenter, />\{ending \? 'Opening…' : 'End Session'\}</);
assert.match(presenter, />Not Yet</);
assert.match(presenter, /backgroundColor: 'rgba\(0,0,0,0\.82\)'/,
  'the modal must have an opaque, visible dim backdrop');
assert.match(presenter, /backgroundColor: '#0B0A12'/,
  'the modal surface must be visibly separated from the Logger');
assert.match(presenter, /disabled=\{ending\}/,
  'both actions must be guarded during the canonical end transition');

console.log('session-completion state and shipping-path tests passed');
