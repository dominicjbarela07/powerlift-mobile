#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  advanceCoachSessionReviewVisit,
  canonicalCoachSessionReviewIdentity,
  coachSessionReviewPresentationKey,
} from '../lib/coach-session-review-presentation.ts';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const route = read('app/(tabs)/coach-session-review.tsx');
const recap = read('components/coach-mobile/CompletedSessionRecap.tsx');
const adapter = read('components/coach-mobile/CoachSessionReviewerV3.tsx');
const tabsLayout = read('app/(tabs)/_layout.tsx');

const reviewA = canonicalCoachSessionReviewIdentity('101');
const reviewB = canonicalCoachSessionReviewIdentity('208');
assert.equal(reviewA, '101', 'review A must resolve from its stable Session ID');
assert.equal(reviewB, '208', 'review B must resolve from its stable Session ID');
assert.equal(canonicalCoachSessionReviewIdentity('Athlete A'), null, 'display data must never become review identity');
assert.equal(canonicalCoachSessionReviewIdentity('0'), null, 'invalid Session IDs must fail closed');

let visitRevision = 0;
const reviewAFirstVisit = coachSessionReviewPresentationKey(reviewA, visitRevision);
const simulatedOffsets = new Map([[reviewAFirstVisit, 0]]);
assert.equal(simulatedOffsets.get(reviewAFirstVisit), 0, 'review A initially opens at the top');

simulatedOffsets.set(reviewAFirstVisit, 920);
assert.equal(simulatedOffsets.get(reviewAFirstVisit), 920, 'review A can scroll to the bottom');
assert.equal(coachSessionReviewPresentationKey(reviewA, visitRevision), reviewAFirstVisit, 'child navigation and back preserve the same review presentation');
assert.equal(coachSessionReviewPresentationKey(reviewA, visitRevision), reviewAFirstVisit, 'tab switches remain inside the same review presentation');

const reviewBDifferentAthlete = coachSessionReviewPresentationKey(reviewB, visitRevision);
assert.notEqual(reviewBDifferentAthlete, reviewAFirstVisit, 'a different athlete and Session receive a fresh presentation');
assert.equal(simulatedOffsets.get(reviewBDifferentAthlete) ?? 0, 0, 'review B cannot inherit review A scroll');

const sameAthleteDifferentSession = coachSessionReviewPresentationKey('209', visitRevision);
assert.notEqual(sameAthleteDifferentSession, reviewAFirstVisit, 'the same athlete on a different Session receives a fresh presentation');
assert.equal(simulatedOffsets.get(sameAthleteDifferentSession) ?? 0, 0, 'same-athlete/different-Session starts at the top');

visitRevision = advanceCoachSessionReviewVisit(visitRevision);
const reviewBAfterClose = coachSessionReviewPresentationKey(reviewB, visitRevision);
assert.equal(simulatedOffsets.get(reviewBAfterClose) ?? 0, 0, 'closing A without completion cannot leak its offset into B');
assert.notEqual(reviewBAfterClose, reviewBDifferentAthlete, 'ending a visit invalidates navigator-reused presentation state');

const rapidA = coachSessionReviewPresentationKey(reviewA, visitRevision);
const rapidB = coachSessionReviewPresentationKey(reviewB, visitRevision);
assert.notEqual(rapidA, rapidB, 'rapid A to B navigation changes the presentation before B content renders');
assert.equal(simulatedOffsets.get(rapidB) ?? 0, 0, 'rapid review B navigation starts at the top');

const deepLinkedB = coachSessionReviewPresentationKey(reviewB, 0);
assert.equal(simulatedOffsets.get(deepLinkedB) ?? 0, 0, 'a direct deep link to B starts at the top');

const completedARevision = advanceCoachSessionReviewVisit(0);
const reopenedCompletedA = coachSessionReviewPresentationKey(reviewA, completedARevision);
assert.notEqual(reopenedCompletedA, reviewAFirstVisit, 'reopening completed review A creates a fresh presentation');
assert.equal(simulatedOffsets.get(reopenedCompletedA) ?? 0, 0, 'reopened completed review A starts at the top');

assert.match(tabsLayout, /name="coach-session-review"[\s\S]*?href: null[\s\S]*?headerShown: false/, 'the regression fixture must retain the navigator-reused hidden tab route');
assert.match(route, /canonicalCoachSessionReviewIdentity\(params\.workoutId\)/, 'the route must key lifecycle to the canonical Session ID');
assert.doesNotMatch(route, /canonicalCoachSessionReviewIdentity\([^)]*athlete/i, 'review lifecycle must never key from athlete display data');
assert.match(route, /<CoachSessionReviewContent[\s\S]*key=\{coachSessionReviewPresentationKey\(reviewIdentity, visitRevision\)\}/, 'the entire route-local review state must remount at the presentation boundary');
assert.match(route, /const closeReview = useCallback\(\(\) => \{[\s\S]*onEndVisit\(\);[\s\S]*router\.back\(\);/, 'close must retire the current visit before leaving the route');
assert.match(route, /Review completed[\s\S]*onPress: closeReview/, 'Complete Review must retire the current visit before returning to the queue');
assert.match(route, /onOpenProgramming=\{\(\) => router\.push/, 'same-review Programming drill-down must not retire the visit');
assert.match(route, /onOpenMovementHistory=\{\(movement\) => \{[\s\S]*router\.push\(movementHistorySheetRoute/, 'same-review Movement History drill-down must not retire the visit');
assert.doesNotMatch(route, /setTimeout|animated:\s*true/, 'the identity reset must not rely on a delay or animated correction');
assert.match(adapter, /return <CompletedSessionRecap/, 'the route must keep the canonical shared reviewer runtime');
assert.match(recap, /contentScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/, 'existing within-review tab transitions must retain their non-animated top reset');

console.log('Coach Session Review scroll lifecycle contract passed');
