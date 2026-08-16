import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function assertIncludes(source, values, label) {
  for (const value of values) {
    if (!source.includes(value)) {
      throw new Error(`${label} is missing canonical marker: ${value}`);
    }
  }
}

const layout = read('app/(tabs)/_layout.tsx');
const home = read('app/(tabs)/coach-videos.tsx');
const list = read('components/reviews/review-list-screen.tsx');
const session = read('app/(tabs)/coach-session-review.tsx');
const video = read('app/(tabs)/coach-video-review.tsx');
const repository = read('app/(tabs)/coach-video-archive.tsx');
const api = read('lib/api.ts');

assertIncludes(layout, [
  'title: \'Reviews\'',
  'name="coach-review-queue"',
  'name="coach-review-history"',
  'name="coach-session-review"',
], 'Coach tab navigation');

assertIncludes(home, [
  'getCoachReviewHub',
  'Review Queue',
  'Team Reviews',
  'Video Repository',
  'Past Work',
  'Needs Review',
  'Recent Review History',
  'Filter reviews by athlete',
  'createLatestRequestManager',
], 'Review Hub home');

assertIncludes(list, [
  'getCoachReviewQueue',
  'getCoachReviewHistory',
  'Load More',
  'Filter by athlete',
  'Filter by review type',
  'createLatestRequestManager',
], 'Review queue and history');

assertIncludes(session, [
  'getCoachSessionReview',
  'saveCoachSessionReview',
  'view=coach-preview',
  'CompletedSessionRecap',
  'viewerMode="coach"',
  'coachReview={coachReview}',
  'followup_adjust_programming',
  'if (saving) return',
  "action: 'save' | 'complete'",
], 'Session review workspace');

const completedRecap = read('components/coach-mobile/CompletedSessionRecap.tsx');
assertIncludes(completedRecap, [
  'COACH REVIEW TOOLS',
  'ATHLETE FEEDBACK',
  'PRIVATE COACH NOTE',
  'Complete Review',
  'Performed SetLog targets',
  'BEST SET TREND · EXACT IDENTITY',
], 'Canonical completed Session review surface');

assertIncludes(video, [
  'videoId',
  'SetVideoPlayerModal',
], 'Video review detail');

assertIncludes(repository, [
  'getCoachVideoArchive',
  'date_from',
  'date_to',
  'has_feedback',
  'pinned',
  'Load More',
  'createLatestRequestManager',
], 'Video Repository');

assertIncludes(api, [
  '/coach/mobile/review-hub',
  '/coach/mobile/review-hub/queue',
  '/coach/mobile/review-hub/history',
  '/coach/mobile/review-hub/sessions/',
  '/video-review/mobile/coach/archive',
  'signal?: AbortSignal',
], 'Review API client');

for (const [relativePath, source] of [
  ['app/(tabs)/coach-videos.tsx', home],
  ['components/reviews/review-list-screen.tsx', list],
  ['app/(tabs)/coach-session-review.tsx', session],
  ['components/reviews/review-item-card.tsx', read('components/reviews/review-item-card.tsx')],
]) {
  const userVisibleWorkout = /(['"`])[^'"`\n]*\bworkout\b[^'"`\n]*\1/gi;
  const offending = [...source.matchAll(userVisibleWorkout)]
    .map((match) => match[0])
    .filter((value) => !/workoutId|\/workout/i.test(value));
  if (offending.length) {
    throw new Error(`${relativePath} exposes disallowed user-facing “workout” copy: ${offending.join(', ')}`);
  }
}

console.log('Review Hub canonical parity static regression: PASS');
