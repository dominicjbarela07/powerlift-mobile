import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildCoachVideoReviewReturnParams,
  coachVideoReviewReturnTarget,
  resolveCoachVideoReviewReturnContext,
} from '../lib/coach-video-review-return.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [screen, modal, workspace, hub, list, messages] = await Promise.all([
  read('app/(tabs)/coach-video-review.tsx'),
  read('components/SetVideoPlayerModal.tsx'),
  read('components/coach-mobile/athlete-workspace/CoachAthleteReviews.tsx'),
  read('app/(tabs)/coach-videos.tsx'),
  read('components/reviews/review-list-screen.tsx'),
  read('app/(tabs)/messages/[threadId].tsx'),
]);

const workspaceParams = buildCoachVideoReviewReturnParams({
  kind: 'workspace',
  athleteId: 47,
  destination: 'reviews',
  subjectKey: 'coach:8:athlete:47:generation:3',
  segment: 'followup',
  queuePosition: 4,
});
assert.deepEqual(coachVideoReviewReturnTarget(resolveCoachVideoReviewReturnContext(workspaceParams)), {
  pathname: '/(tabs)/coach-athlete/47/reviews',
});

const hubParams = buildCoachVideoReviewReturnParams({
  kind: 'hub', athleteId: 47, section: 'queue', scrollY: 318.5, queuePosition: 2,
});
assert.deepEqual(coachVideoReviewReturnTarget(resolveCoachVideoReviewReturnContext(hubParams)), {
  pathname: '/(tabs)/coach-videos',
  params: { athleteId: '47', reviewScrollY: '318.5', queuePosition: '2', reviewSection: 'queue' },
});

const queueParams = buildCoachVideoReviewReturnParams({
  kind: 'queue', athleteId: 47, reviewType: 'video', scrollY: 220, queuePosition: 7,
});
assert.deepEqual(coachVideoReviewReturnTarget(resolveCoachVideoReviewReturnContext(queueParams)), {
  pathname: '/(tabs)/coach-review-queue',
  params: { athleteId: '47', reviewScrollY: '220', queuePosition: '7', reviewType: 'video' },
});

const historyParams = buildCoachVideoReviewReturnParams({
  kind: 'history', reviewType: 'all', scrollY: 60,
});
assert.equal(
  coachVideoReviewReturnTarget(resolveCoachVideoReviewReturnContext(historyParams))?.pathname,
  '/(tabs)/coach-review-history',
);

assert.deepEqual(
  resolveCoachVideoReviewReturnContext({ reviewReturnTo: 'workspace', athleteId: 'not-an-athlete' }),
  { kind: 'inbox' },
  'invalid workspace identity must fail closed instead of leaking to another athlete',
);

assert.match(screen, /action === 'mark_reviewed' && updated\.review_status !== 'reviewed'/);
assert.match(screen, /if \(action === 'mark_reviewed'\) \{[\s\S]*?returnFromReview\(\);[\s\S]*?return;/);
assert.ok(
  screen.indexOf("updated.review_status !== 'reviewed'") < screen.indexOf('returnFromReview();'),
  'the overlay may close only after the server confirms canonical Reviewed state',
);
assert.match(screen, /router\.dismissTo\(returnTarget as any\)/);
assert.doesNotMatch(screen, /router\.back\(\)/, 'video-review completion must never use ambiguous back navigation');
assert.match(screen, /setReviewError\(err\?\.message/);
assert.match(screen, /accessibilityLiveRegion="polite"/);
assert.doesNotMatch(
  screen,
  /catch \(err: any\) \{\s*setSelectedVideo\(null\)/,
  'a failed completion must preserve the open review surface and current form state',
);

assert.match(modal, /setVideo\(initialVideo\);/);
assert.match(modal, /Number\(initialVideo\.id\) !== Number\(videoId\)/);
assert.match(workspace, /buildCoachVideoReviewReturnParams/);
assert.match(workspace, /kind: 'workspace'/);
assert.match(messages, /destination: 'messages'/);
assert.match(hub, /kind: 'hub'/);
assert.match(hub, /scrollY: scrollYRef\.current/);
assert.match(list, /kind: mode/);
assert.match(list, /reviewType,/);
assert.match(list, /useFocusEffect\(useCallback\(\(\) => \{ void load\(\); \}/);

console.log('video review Reviewed completion and exact-origin return contract: PASS');
