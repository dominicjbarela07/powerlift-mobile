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
const reviewCard = read('components/reviews/review-item-card.tsx');
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
  'NEEDS REVIEW',
  'Recent Review History',
  'Filter reviews by athlete',
  'createLatestRequestManager',
  '(payload?.latest_queue || []).map',
  'There are no pending reviews in this scope.',
], 'Review Hub home');

assertIncludes(list, [
  'getCoachReviewQueue',
  'getCoachReviewHistory',
  'Load More',
  'Filter by athlete',
  'Filter by review type',
  'createLatestRequestManager',
  'router.back()',
], 'Review queue and history');

assertIncludes(reviewCard, [
  'item.summary',
  'item.actual',
  'item.reviewer_name',
  'onPress={onPress}',
], 'Review row evidence and action');

assertIncludes(session, [
  'getCoachSessionReview',
  'saveCoachSessionReview',
  'view=coach-preview',
  'CoachSessionReviewerV3',
  'coachReview={coachReview}',
  'followup_adjust_programming',
  'if (saving) return',
  "action: 'save' | 'complete'",
], 'Session review workspace');

const reviewerV3 = read('components/coach-mobile/CoachSessionReviewerV3.tsx');
assertIncludes(reviewerV3, [
  'CompletedSessionRecap',
  'viewerMode="coach"',
  'onOpenProgramming',
], 'Coach Session Reviewer compatibility boundary');

const completedRecap = read('components/coach-mobile/CompletedSessionRecap.tsx');
assertIncludes(completedRecap, [
  'SESSION RESULT',
  'LAST COMPARABLE SESSION',
  'MOVEMENT PROGRESSION',
  'Actual persisted SetLogs',
  'RECOVERY CONTEXT',
  'COACH READ',
  'PlanCompareExperience',
  'CoachTools',
  'CanonicalMovementArtwork',
  'FloatingDisplayUnitRegistration',
  'Open exact Movement History',
], 'Canonical role-aware post-Session surface');
assertIncludes(completedRecap, [
  'accessibilityRole="button"',
  'AnalyticalTimeSeriesChart',
  'canonical-post-session-recovery-chart',
], 'Interactive reviewer evidence');
if (/<MuscleMap\b/.test(completedRecap)) {
  throw new Error('Reviewer V3 must use canonical individual-movement artwork, never full-body MuscleMap');
}

assertIncludes(completedRecap, [
  'COACH REVIEW TOOLS',
  'ATHLETE FEEDBACK',
  'PRIVATE COACH NOTE',
  'Complete Review',
  'Actual persisted SetLogs',
  "movement.trend?.metric_label?.toUpperCase() || 'BEST SET TREND'",
  '} · EXACT MOVEMENT',
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
