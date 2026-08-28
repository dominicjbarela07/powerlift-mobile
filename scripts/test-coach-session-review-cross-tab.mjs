import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const recap = fs.readFileSync(path.join(root, 'components/coach-mobile/CompletedSessionRecap.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/coach-session-review.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'app/(tabs)/_layout.tsx'), 'utf8');

assert.match(layout, /<StrengthLedgerAppHeader[\s\S]*topInset=\{insets\.top\}/, 'the global app shell must remain the single native top-inset owner');
assert.match(route, /viewerMode="coach"[\s\S]*parentProvidesTopSafeArea[\s\S]*coachReview=\{coachReview\}/, 'the coach review route must explicitly reuse the app-shell safe area');
assert.match(recap, /edges=\{parentProvidesTopSafeArea \? \[\] : \['top'\]\}/, 'the recap must omit only the duplicate top inset when a parent shell already owns it');

assert.match(route, /const \[draft, setDraft\] = useState<CoachReviewDraft>/, 'the route must own the one canonical Session review draft');
assert.match(route, /onDraftChange: setDraft/, 'shared tools must write directly to the route-owned draft');
assert.match(recap, /const draft = review\.draft;/, 'the shared review tools must be controlled by canonical review state');
assert.doesNotMatch(recap, /function CoachTools[\s\S]{0,180}useState/, 'review tools must not create a tab-local draft copy');

const activeLensStart = recap.indexOf("{tab === 'performed' ? <>", recap.indexOf('<View style={styles.tabs}>'));
const planLens = recap.indexOf('<PlanCompareExperience recap={recap}', activeLensStart);
const sharedTools = recap.indexOf("{viewerMode === 'coach' && coachReview ? <CoachTools review={coachReview} />", planLens);
const deepActions = recap.indexOf('{deepActions.length ?', sharedTools);
assert.ok(activeLensStart > 0 && planLens > activeLensStart, 'both Performed and Plan / Compare lenses must remain mounted by the canonical tab switch');
assert.ok(sharedTools > planLens && deepActions > sharedTools, 'one shared CoachTools instance must live outside and after both tab-specific lenses');
assert.equal((recap.slice(activeLensStart, sharedTools).match(/<CoachTools/g) || []).length, 0, 'neither lens may own a private review-tools instance');

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
