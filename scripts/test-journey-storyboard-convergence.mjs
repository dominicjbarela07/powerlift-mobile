import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const journey = read('components/ledger/JourneyExperience.tsx');
const client = read('lib/ledger-journey.ts');

const orderedSignals = [
  '<ThenNowSection',
  '<CurrentChapterSection',
  '<ProgressSection',
  '<TrainingChaptersSection',
  '<BodyweightContextSection',
  '<CareerHighlightsSection',
  'journey-view-full-timeline',
];
let previous = -1;
for (const signal of orderedSignals) {
  const index = journey.indexOf(signal);
  assert.ok(index > previous, `${signal} must appear in the locked continuous-story order`);
  previous = index;
}

assert.match(journey, /ledger-chapter-journey-v1\.png/, 'the approved mountain-path hero remains Journey identity');
assert.match(journey, /chapter-current\.png/);
assert.match(journey, /chapter-foundation\.png/);
assert.match(journey, /chapter-transition\.png/);
for (const file of ['chapter-current.png', 'chapter-foundation.png', 'chapter-transition.png']) {
  assert.ok(fs.statSync(path.join(root, 'assets/images/journey-storyboard-v1', file)).size > 100_000, `${file} must be production-grade raster artwork`);
}
assert.doesNotMatch(journey, /<Segmented|Overview', 'Blocks', 'Timeline'/, 'Journey has no primary tabs');
assert.match(journey, /fetchLedgerProgression\('all'\)/, 'Then/Now uses canonical all-time SBD evidence');
assert.match(journey, /fetchJourneyTimelinePage\(\{ blockId: block\.id, includeSessions: true, limit: 50 \}\)/, 'chapter detail uses bounded block evidence');
assert.match(journey, /fetchReportedBodyweightHistory\(\{ limit: 50 \}\)/, 'bodyweight detail uses reported evidence pagination');
assert.match(journey, /presentationStyle="fullScreen"/, 'drill-downs preserve the underlying Journey scroll context');
assert.match(journey, /visible=\{Boolean\(detail\)\}/, 'the native modal dismisses through an explicit visibility transition');
assert.match(journey, /<SafeAreaView edges=\{\['bottom'\]\} style=\{\[styles\.modalScreen, \{ paddingTop: Math\.max\(insets\.top, 52\) \}\]\}/, 'full-screen details own a dark safe-area canvas below the device status region');
assert.match(journey, /modalScreen: \{ flex: 1, backgroundColor: '#000000' \}/, 'detail canvas cannot regress to the native white modal background');
assert.match(journey, /View Chapter Details/);
assert.match(journey, /actionTestID="journey-view-all-chapters"/, 'View All Chapters remains directly reachable');
assert.match(journey, /View Bodyweight Details/);
assert.match(journey, /Load Earlier History/);
assert.match(journey, /UPCOMING CHAPTER/, 'future governed blocks cannot be mislabeled completed');
assert.match(journey, /No causal claim is made/);
assert.match(journey, /The complete bodyweight record could not be loaded/);
assert.match(journey, /The complete timeline could not be loaded/);
assert.match(client, /strength_comparison\?: JourneyChapterStrengthComparison/);
assert.match(client, /weekly_best_canonical_e1rm/);

console.log('[journey storyboard] continuous chronology, governed evidence, drill-downs, and atmospheric assets passed');
