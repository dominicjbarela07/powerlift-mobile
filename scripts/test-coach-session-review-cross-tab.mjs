import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const recap = fs.readFileSync(path.join(root, 'components/coach-mobile/CompletedSessionRecap.tsx'), 'utf8');
const reviewer = fs.readFileSync(path.join(root, 'components/coach-mobile/CoachSessionReviewerV3.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/coach-session-review.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'app/(tabs)/_layout.tsx'), 'utf8');

assert.match(layout, /<StrengthLedgerAppHeader[\s\S]*topInset=\{insets\.top\}/, 'the global app shell must remain the single native top-inset owner');
assert.match(layout, /name="coach-session-review"[\s\S]*?headerShown: false[\s\S]*?title: 'Session Review'/, 'Reviewer V3 must own its compact review header instead of rendering beneath the global brand header.');
assert.match(reviewer, /<SafeAreaView edges=\{\['top'\]\}/, 'Reviewer V3 must own the native top safe area when its route header is hidden.');

assert.match(route, /const \[draft, setDraft\] = useState<CoachReviewDraft>/, 'the route must own the one canonical Session review draft');
assert.match(route, /onDraftChange: setDraft/, 'shared tools must write directly to the route-owned draft');
assert.match(recap, /const draft = review\.draft;/, 'the shared review tools must be controlled by canonical review state');
assert.doesNotMatch(recap, /function CoachTools[\s\S]{0,180}useState/, 'review tools must not create a tab-local draft copy');

assert.match(reviewer, /tab === 'performed'[\s\S]*tab === 'plan'[\s\S]*tab === 'coach'/, 'Performed, Plan / Compare, and Coach lenses must remain in Reviewer V3.');
assert.match(reviewer, /tab === 'plan' \? <PlanCompareExperience[^>]*recap=\{recap\}/, 'Plan / Compare must reuse the canonical recap projection.');
assert.match(reviewer, /tab === 'coach' \? <>[\s\S]*<CoachTools review=\{coachReview\}/, 'Reviewer V3 must pass the one route-owned review state to the shared Coach tools.');
assert.doesNotMatch(reviewer, /useState<CoachReviewDraft>|setDraft\(/, 'Reviewer V3 lenses must not create a private review draft.');

for (const capability of [
  'ATHLETE FEEDBACK',
  'PRIVATE COACH NOTE',
  'OUTCOME',
  'PRIORITY',
  'Adjust programming',
  'Message athlete',
  'Consider training max update',
  'Monitor next Session',
  'Send feedback as message',
  'Save Draft',
  'Complete Review',
]) {
  assert.ok(recap.includes(capability), `shared review tools must retain ${capability}`);
}

assert.match(route, /if \(saving\) return;/, 'review persistence must keep duplicate submission protection');
assert.match(route, /review\.review_controls\?\.editable !== false/, 'shared review tools must preserve backend edit authorization');
assert.match(route, /setError\(caught\?\.message \|\| 'Could not save this review\. Your entries have been preserved\.'\)/, 'failed saves must preserve the canonical draft for retry');

console.log('Coach Session review compaction and shared cross-tab tools contract: PASS');
