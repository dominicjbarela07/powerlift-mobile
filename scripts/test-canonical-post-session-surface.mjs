#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(relative, 'utf8');
const surface = read('components/coach-mobile/CompletedSessionRecap.tsx');
const coachAdapter = read('components/coach-mobile/CoachSessionReviewerV3.tsx');
const athleteRoute = read('app/(tabs)/workout/[workoutId].tsx');
const coachRoute = read('app/(tabs)/coach-session-review.tsx');
const certification = read('app/dev-session-recap-certification.tsx');

assert.match(coachAdapter, /return <CompletedSessionRecap/, 'coach review must delegate to the athlete/coach shared runtime');
assert.match(coachAdapter, /viewerMode="coach"/, 'the compatibility boundary must select coach capabilities explicitly');
assert.doesNotMatch(coachAdapter, /StyleSheet\.create|AnalyticalTimeSeriesChart|PlanCompareExperience/, 'the coach boundary must not grow a duplicate visual implementation');

assert.match(surface, /export type RecapTab = 'overview' \| 'performed' \| 'plan' \| 'coach'/);
for (const label of ['Overview', 'Performed', 'Plan / Compare']) assert.ok(surface.includes(`label: '${label}'`), `shared tab rail is missing ${label}`);
assert.match(surface, /viewerMode === 'coach' \? \[\{ key: 'coach' as const, label: 'Coach' \}\] : \[\]/, 'Coach must be the only role-gated lens');
assert.match(surface, /tab === 'coach' && viewerMode === 'coach'/, 'athletes must not reach coach-only controls');

for (const section of ['SESSION READ', 'WHAT CHANGED', 'CONTEXT & RECOVERY', 'ATHLETE REFLECTION', 'MOVEMENT PROGRESSION', 'COACH READ', 'COACH ATTENTION']) {
  assert.ok(surface.includes(section), `canonical evidence surface is missing ${section}`);
}
assert.match(surface, /AnalyticalTimeSeriesChart/, 'analytics must use the canonical inspectable chart primitive');
assert.match(surface, /ChartAxisModeToggle/, 'movement history must preserve TIME / INSTANCES inspection');
assert.match(surface, /xDomainMode=\{axisMode\}/, 'axis mode must change geometry without changing evidence');
assert.match(surface, /const \[selected, setSelected\].*'readiness'/, 'recovery must show one explicitly selected metric at a time');
assert.match(surface, /kind: selected === 'sleep' \? 'hours' : 'score'/, 'sleep and score charts must remain unit-honest');

for (const sparseState of [
  'Readiness context was not submitted',
  'No prior exact comparison yet',
  'Performed muscle emphasis is unavailable',
  'No performed SetLog evidence was recorded',
]) assert.ok(surface.includes(sparseState), `explicit sparse state is missing: ${sparseState}`);

for (const tool of ['Resume Session', 'Edit Set Evidence', 'Session Notes', 'Full Session History', 'CORRECT EQUIPMENT', 'MOVEMENT HISTORY']) {
  assert.ok(surface.includes(tool), `post-Session toolkit is missing ${tool}`);
}
assert.match(athleteRoute, /onResumeSession=.*beginWorkout/, 'Resume must use the existing governed lifecycle transition');
assert.match(athleteRoute, /onEditSetEvidence=.*beginWorkout/, 'Set evidence editing must reopen the same Session logger');
assert.match(athleteRoute, /onEditSessionNotes=.*beginWorkout/, 'Session note editing must preserve the same-Session lifecycle');
assert.match(athleteRoute, /resumeCompletedSessionForEquipmentCorrection/, 'equipment correction must use the governed identity picker path');
assert.match(athleteRoute, /Existing SetLogs keep their immutable performed snapshots/, 'equipment correction must disclose immutable performed evidence semantics');
assert.match(athleteRoute, /onViewSessionHistory=.*session-history/, 'full Session history must be reachable');

assert.match(coachRoute, /onOpenProgramming=/, 'Coach must be able to deep-link from evidence to Programming');
assert.match(coachRoute, /review\.review_controls\?\.editable !== false/, 'Coach controls must retain server authorization');
assert.match(surface, /CoachTools review=\{coachReview\}/, 'feedback, notes, outcomes, and completion must remain on the canonical coach draft');

assert.match(surface, /canonicalContent: \{ gap: 12 \}/, 'the post-Session canvas must not add a page gutter');
assert.match(surface, /toolsSheet: \{ width: '100%'/, 'the post-Session toolkit must be full width');
assert.match(surface, /movementStack: \{ gap: 9 \}/, 'movement cards must not add nested horizontal gutters');
assert.match(surface, /sessionRecapHighlightAsset/, 'premium PR, streak, and prescription assets must remain canonical');
assert.match(surface, /ProgrammingMuscleRegionArt level="session"/, 'aggregate anatomy must remain restricted to Session-level evidence');
assert.match(surface, /CanonicalMovementArtwork movement=\{movement\}/, 'individual movement rows must use canonical movement artwork');

assert.match(certification, /reviewer_v3:/, 'the DEV proof fixture must exercise mature analytics');
assert.match(certification, /canonical_identity_id: 9000 \+ itemId/, 'every proof movement must carry a stable governed identity for fail-closed artwork');
assert.match(certification, /params\.tab === 'coach' \? 'coach'/, 'the DEV proof fixture must expose every role lens');
assert.match(certification, /onResumeSession=\{\(\) => undefined\}/, 'the DEV proof fixture must expose the athlete toolkit');
assert.match(certification, /onOpenMovementHistory=\{\(\) => undefined\}/, 'the DEV proof fixture must expose exact governed movement history');

console.log('Canonical shared post-Session surface, role gating, lifecycle tools, analytics, sparse states, and full-width contracts: PASS');
