import assert from 'node:assert/strict';

import {
  normalizeCoachAttentionReasons,
  openCoachDestination,
} from '../lib/coach-mobile.ts';

const context = { athleteId: 42, threadId: 91 };
const modernReason = {
  athlete_id: 42,
  reason_type: 'video_review_waiting',
  severity: 'high',
  title: 'Videos waiting for review',
  supporting_text: '2 waiting',
  category: 'reviews',
  count: 2,
  destination: { route: '/(tabs)/coach-videos', params: { athleteId: 42 } },
  resolution_policy: 'video_review_completed',
};

const valid = normalizeCoachAttentionReasons([modernReason], context);
assert.equal(valid.length, 1);
assert.equal(valid[0].title, 'Videos waiting for review');
assert.equal(valid[0].supporting_text, '2 waiting');

const pushes = [];
assert.equal(openCoachDestination({ push: (target) => pushes.push(target) }, valid[0].destination), true);
assert.deepEqual(pushes[0], {
  pathname: '/(tabs)/coach-videos',
  params: { athleteId: '42' },
});

assert.equal(openCoachDestination({ push: () => assert.fail('invalid destination navigated') }, undefined), false);
assert.equal(openCoachDestination({ push: () => assert.fail('unknown route navigated') }, { route: '/unknown' }), false);
assert.equal(
  openCoachDestination(
    { push: () => assert.fail('missing required params navigated') },
    { route: '/(tabs)/messages/[threadId]' },
  ),
  false,
);

assert.equal(normalizeCoachAttentionReasons([{ ...modernReason, title: '', label: '' }], context).length, 0);
assert.equal(
  normalizeCoachAttentionReasons([
    { ...modernReason, reason_type: 'unknown_reason', destination: undefined },
  ], context).length,
  0,
);

const legacy = normalizeCoachAttentionReasons([
  { kind: 'pending_video_review', label: 'Video review pending', detail: '2 videos', priority: 'high' },
  { kind: 'programming_gap', label: 'Needs programming', detail: 'No programmed Sessions', priority: 'high' },
  { kind: 'unread_message', label: 'Unread message', detail: '1 unread', priority: 'medium' },
], context);
assert.equal(legacy.length, 3);
assert.deepEqual(legacy.map((reason) => reason.reason_type), [
  'video_review_waiting',
  'programming_gap',
  'unread_message',
]);
assert.deepEqual(legacy.map((reason) => reason.title), [
  'Video review pending',
  'Needs programming',
  'Unread message',
]);
assert.ok(legacy.every((reason) => reason.supporting_text && reason.destination.route));

const threeValid = normalizeCoachAttentionReasons([modernReason, ...legacy.slice(0, 2)], context);
assert.equal(threeValid.length, 3);
assert.equal(normalizeCoachAttentionReasons([], context).length, 0);
assert.equal(normalizeCoachAttentionReasons(null, context).length, 0);

console.log('Coach queue contract regression checks passed.');
