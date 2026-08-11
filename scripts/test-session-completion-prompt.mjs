import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const route = fs.readFileSync(
  path.join(root, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);

const section = (start, end) => {
  const startIndex = route.indexOf(start);
  const endIndex = route.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing shipping-path start marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing shipping-path end marker: ${end}`);
  return route.slice(startIndex, endIndex);
};

const acceptedAutoAdvance = section(
  'const markAutoAdvanceAfterAcceptedLog = useCallback',
  'const scrollRef = useRef<any>(null);',
);
const canonicalHandoff = section(
  'const acceptedItemId = feedbackState.submission.activeItemId;',
  'useEffect(() => {\n    if (!shouldShowCompletedSetSwipeTooltip',
);
const completionReconciliation = section(
  'const current = data?.workout;\n    if (!current) return;',
  'const continueToPostSessionWithMissingSets',
);
const completionModal = section(
  'visible={endSessionPromptVisible}',
  '<Modal\n        visible={editSetVisible}',
);
const failedSubmission = section(
  'const handleCanonicalSetFailure = useCallback',
  'const submitCanonicalSet = useCallback',
);
const supersetSave = section(
  'async function saveSupersetRound',
  'const switchDisplayUnit',
);

assert.match(route, /const \[endSessionPromptVisible, setEndSessionPromptVisible\] = useState\(false\)/);
assert.match(route, /completionPromptRef = useRef/);
assert.doesNotMatch(route, /pendingSessionCompletionPromptRef/,
  'the shipping path must not split the completion event across a mutable pending ref and a later fetch effect');

assert.match(
  canonicalHandoff,
  /submission\.status === 'persisted_new_set'[\s\S]*completionBoundary\.authority === 'canonical'[\s\S]*completionBoundary\.status === 'session_final_set'/,
  'the actual accepted-set handoff must use the canonical whole-session boundary after persistence',
);
assert.match(
  canonicalHandoff,
  /if \(isSessionFinalSet\) \{[\s\S]*setTimerPickerVisible\(false\);[\s\S]*stopRestTimer\(\);[\s\S]*acceptedSheetHandoffControllerRef\.current\.begin/,
  'the canonical final set must clear any existing timer before sheet handoff',
);
assert.match(
  canonicalHandoff,
  /if \(isSessionFinalSet\) \{[\s\S]*pendingAutoAdvanceRef\.current = null;[\s\S]*stopRestTimer\(\);[\s\S]*setEndSessionPromptVisible\(true\);[\s\S]*feedbackDispatch\(\{ type: 'TIMER_IDLE' \}\);[\s\S]*return;/,
  'the actual shipping callback must select the modal branch and return before rest/next-movement progression',
);
assert.ok(
  canonicalHandoff.indexOf('setEndSessionPromptVisible(true)') < canonicalHandoff.indexOf('openTimerPicker();'),
  'the final-session branch must return before the timer picker path',
);

assert.match(
  acceptedAutoAdvance,
  /isNewCanonicalSessionFinalSet\([\s\S]*pendingAutoAdvanceRef\.current = null;[\s\S]*return;[\s\S]*markAutoAdvanceAfterLog\(itemId\)/,
  'final-set results must be rejected by the next-movement auto-advance gate',
);
assert.equal(
  (route.match(/markAutoAdvanceAfterAcceptedLog\(itemId, json\)/g) || []).length,
  5,
  'every individual accepted SetLog path must use the canonical final-set auto-advance gate',
);
assert.match(supersetSave, /submitCanonicalSet\(/,
  'superset Save Round must converge through canonical accepted-set handling');
assert.doesNotMatch(failedSubmission, /setEndSessionPromptVisible\(true\)/,
  'failed SetLog persistence must never present the completion modal');

assert.equal(
  (route.match(/setEndSessionPromptVisible\(true\)/g) || []).length,
  1,
  'exactly one shipping callback may open the completion modal',
);
assert.doesNotMatch(completionReconciliation, /setEndSessionPromptVisible\(true\)/,
  'a fully logged render/remount must not reopen the event-driven modal');
assert.match(completionReconciliation, /programmedSetCountForSession\(current\) > 0/);
assert.match(completionReconciliation, /missingSetLabelsForWorkout\(current\)\.length === 0/);

assert.match(completionModal, />All Sets Completed</);
assert.match(completionModal, /logged every prescribed set in this Session/);
assert.match(completionModal, />Not Yet</);
assert.match(completionModal, />End Session</);
assert.match(
  completionModal,
  /setEndSessionPromptVisible\(false\);[\s\S]*requestAnimationFrame\(openPostSessionSurvey\)/,
  'End Session must reuse the existing canonical post-session transition',
);

console.log('session-completion shipping-path tests passed');
