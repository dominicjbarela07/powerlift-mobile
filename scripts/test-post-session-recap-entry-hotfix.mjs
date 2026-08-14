import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [logger, ceremony, recap, calendar] = await Promise.all([
  readFile(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/workout-logger/stage5-impact-summary.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/coach-mobile/CompletedSessionRecap.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/calendar/AthleteCalendarStoryboardV2.tsx', import.meta.url), 'utf8'),
]);

assert.match(logger, /completion_transitioned === true[\s\S]*canonically_completed === true/, 'fresh ceremony must require the canonical completion transition');
assert.match(logger, /freshCompletionSummaryIdRef\.current = summaryId;[\s\S]*setAnimatedCompletionSummaryId\(summaryId\)/, 'fresh completion identity must be retained for the one-time entry route');
assert.match(logger, /stopRestTimer\(\);[\s\S]*const completionTransitioned/, 'successful completion must clear the rest timer before post-session UI');
assert.match(logger, /shouldShowCompletionCeremony[\s\S]*animatedCompletionSummaryId === completionSummaryId/, 'ceremony must be tied to the exact completed summary');
assert.match(logger, /<SessionImpactPanel[\s\S]*animateEntry[\s\S]*ceremonyOnly[\s\S]*onCeremonyComplete=/, 'fresh completion must use the canonical post-session ceremony before recap');
assert.match(logger, /<CompletedSessionRecap[\s\S]*onClose=\{handleCloseCompletedRecap\}[\s\S]*onDone=\{handleCloseCompletedRecap\}/, 'historical and completed routes must retain working Back and Done exits');

assert.match(ceremony, /summary\.session_streak/, 'ceremony must render the canonical streak value');
assert.match(ceremony, /if \(!animateEntry \|\| reduceMotion\)/, 'reduced motion must use the restrained ceremony path');
assert.match(ceremony, /const reducedMotionHold = setTimeout\([\s\S]*1100\)/, 'reduced motion must retain an observable completion moment');
assert.match(ceremony, /if \(finished\) ceremonyCompleteRef\.current\?\.\(\)/, 'normal choreography must hand off only after it finishes');

assert.match(recap, /<SafeAreaView edges=\{\['top'\]\}/, 'recap must own the top safe area exactly once');
assert.doesNotMatch(recap, /styles\.topBar, \{ paddingTop: Math\.max\(insets\.top/, 'recap top bar must not apply a second top inset');
assert.match(recap, /accessibilityLabel="Done reviewing completed session recap"[\s\S]*onPress=\{onDone \|\| onClose\}/, 'Done must be a real accessible action');

assert.match(calendar, /onClose\(\);\s*requestAnimationFrame\(\(\) => onAction\(\{ type: 'session', id \}\)\)/, 'Calendar must dismiss its native lens before routing to recap');
assert.match(calendar, /accessibilityLabel=\{label\}[\s\S]*pointerEvents="none"/, 'the full Calendar CTA must be a first-tap press target');
assert.match(calendar, /pressed && styles\.primaryActionPressed/, 'the Calendar CTA must provide pressed feedback');

console.log('[post-session-recap-entry-hotfix] canonical entry, historical routing, safe area, timer lifecycle, and Calendar CTA passed');
