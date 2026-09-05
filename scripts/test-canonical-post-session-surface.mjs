#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(relative, 'utf8');
const surface = read('components/coach-mobile/CompletedSessionRecap.tsx');
const coachAdapter = read('components/coach-mobile/CoachSessionReviewerV3.tsx');
const athleteRoute = read('app/(tabs)/workout/[workoutId].tsx');
const coachRoute = read('app/(tabs)/coach-session-review.tsx');
const certification = read('app/dev-session-recap-certification.tsx');
const prEvidence = read('lib/post-session-pr-evidence.ts');
const styleFontSize = (name) => {
  const style = surface.match(new RegExp(`\\b${name}: \\{([^}]*)\\}`));
  assert.ok(style, `missing ${name} style`);
  const size = style[1].match(/fontSize: ([0-9.]+)/);
  assert.ok(size, `missing ${name} font size`);
  return Number(size[1]);
};

assert.match(coachAdapter, /return <CompletedSessionRecap/, 'coach review must delegate to the athlete/coach shared runtime');
assert.match(coachAdapter, /viewerMode="coach"/, 'the compatibility boundary must select coach capabilities explicitly');
assert.doesNotMatch(coachAdapter, /StyleSheet\.create|AnalyticalTimeSeriesChart|PlanCompareExperience/, 'the coach boundary must not grow a duplicate visual implementation');

assert.match(surface, /export type RecapTab = 'overview' \| 'performed' \| 'personal_bests' \| 'plan' \| 'coach'/);
for (const label of ['Overview', 'Performed', 'Personal Bests', 'Plan / Compare']) assert.ok(surface.includes(`label: '${label}'`), `shared tab rail is missing ${label}`);
assert.match(surface, /personalBestEvidence\.length \? \[\{ key: 'personal_bests' as const, label: 'Personal Bests' \}\] : \[\]/, 'Personal Bests must exist only when verified canonical PR evidence exists');
assert.match(surface, /viewerMode === 'coach' \? \[\{ key: 'coach' as const, label: 'Coach' \}\] : \[\]/, 'Coach must be the only role-gated lens');
assert.match(surface, /tab === 'coach' && viewerMode === 'coach'/, 'athletes must not reach coach-only controls');
assert.match(surface, /contentScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/, 'changing evidence lenses must reset the shared vertical scroll owner');
assert.match(surface, /requestAnimationFrame\(resetScrollOwners\)/, 'tab scroll reset must repeat after the next native layout frame');
assert.match(surface, /tabsScrollRef\.current\?\.scrollToEnd/, 'later evidence lenses must remain visibly selected in the horizontal tab rail');

for (const section of ['SESSION RESULT', 'LAST COMPARABLE SESSION', 'RECOVERY CONTEXT', 'ATHLETE REFLECTION', 'MOVEMENT PROGRESSION', 'COACH READ', 'COACH ATTENTION']) {
  assert.ok(surface.includes(section), `canonical evidence surface is missing ${section}`);
}
assert.match(surface, /AnalyticalTimeSeriesChart/, 'analytics must use the canonical inspectable chart primitive');
assert.match(surface, /ChartAxisModeToggle/, 'movement history must preserve TIME / INSTANCES inspection');
assert.match(surface, /xDomainMode=\{axisMode\}/, 'axis mode must change geometry without changing evidence');
assert.match(surface, /available\.includes\('readiness'\) \? 'readiness'/, 'the Overview recovery story must prefer the readiness trend');
assert.match(surface, /kind: selected === 'sleep' \? 'hours' : 'score'/, 'sleep and score charts must remain unit-honest');
assert.match(surface, /readableText/, 'post-Session charts must opt into the readable axis and tooltip treatment');
assert.match(surface, /largeReadableText/, 'the Overview recovery chart must opt into the 16-point axis and tooltip treatment');
assert.match(surface, /selectedInitially="latest"/, 'the Overview recovery chart must emphasize the current Session point');

const activeSurface = surface.split('/* Retired athlete-recap renderer')[0];
assert.match(activeSurface, /performedMovements\.length \? performedMovements\.map/, 'all performed movements must always render');
assert.doesNotMatch(activeSurface, /shownMovements|hiddenMovementCount|showAllMovements|Show fewer movements/, 'the active V3 surface must not hide performed movements behind a disclosure');
for (const label of ['THIS SESSION', 'LAST TIME', 'CHANGE', 'FIRST EXACT EXPOSURE']) assert.ok(activeSurface.includes(label), `collapsed movement evidence is missing ${label}`);
assert.match(activeSurface, /<MovementTrendChart compact card trend=\{movement\.trend\}/, 'collapsed movement cards must keep progression visible and inspectable');
assert.match(activeSurface, /SESSION_PR_CREST_ART/, 'Personal Bests must use the governed premium Session PR crest');
assert.match(activeSurface, /buildPersonalBestEvidence\(canonicalPrEvents, normalizedPerformedMovements\)[\s\S]*personalBestEvidenceMatchesLoadSemantics/, 'Personal Bests must normalize typed record evidence and enforce governed load semantics before presentation');
assert.doesNotMatch(activeSurface, /currentReps = current/, 'a generic PR metric value must never be rendered as performed reps');
assert.doesNotMatch(activeSurface, /movement\.trend.*personalBestTrend/, 'Personal Best cards must not inherit the movement generic e1RM chart');
assert.match(activeSurface, /progression\.metric_label/, 'Personal Best chart labels must come from the record-specific progression contract');
assert.match(prEvidence, /if \(value == null \|\| value === ''/, 'null PR evidence must fail closed instead of coercing to zero');
assert.match(prEvidence, /movement\?\.sets.*Number\(set\.id\).*Number\(sourceId\)/, 'PR evidence must resolve the exact source SetLog ID');
assert.doesNotMatch(prEvidence, /best_set/, 'PR source evidence must never fall back to an unrelated movement best set');

for (const [name, minimum] of [
  ['movementComparisonValue', 13],
  ['setValueStrong', 13],
  ['overviewNarrative', 17],
  ['overviewComparisonLabel', 18],
  ['overviewComparisonDetail', 16],
  ['overviewRecoveryMetricLabel', 18],
  ['overviewRecoveryMetricDetail', 16],
  ['overviewReflectionDetail', 16],
  ['coachReadValue', 12],
  ['personalBestResultValue', 20],
]) assert.ok(styleFontSize(name) >= minimum, `${name} must remain readable at mobile width`);

const crestPath = 'assets/images/session-recap/session-pr-crest-v1.png';
assert.ok(fs.existsSync(crestPath), 'the governed Session PR crest asset must exist');
const crest = fs.readFileSync(crestPath);
assert.equal(crest.subarray(1, 4).toString('ascii'), 'PNG', 'the Session PR crest must remain a PNG');
assert.equal(crest[25], 6, 'the Session PR crest must retain genuine RGBA transparency');

for (const sparseState of [
  'Baseline building',
  'Duration baseline started',
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

assert.match(surface, /canonicalContent: \{ gap: 14 \}/, 'the post-Session canvas must not add a page gutter');
assert.match(surface, /toolsSheet: \{ width: '100%'/, 'the post-Session toolkit must be full width');
assert.match(surface, /movementStack: \{ gap: 10 \}/, 'movement cards must not add nested horizontal gutters');
assert.match(surface, /sessionRecapHighlightAsset/, 'premium PR, streak, and prescription assets must remain canonical');
assert.match(surface, /ProgrammingMuscleRegionArt level="session"/, 'aggregate anatomy must remain restricted to Session-level evidence');
assert.match(surface, /CanonicalMovementArtwork movement=\{movement\}/, 'individual movement rows must use canonical movement artwork');

assert.match(certification, /reviewer_v3:/, 'the DEV proof fixture must exercise mature analytics');
assert.match(certification, /canonical_identity_id: 9000 \+ itemId/, 'every proof movement must carry a stable governed identity for fail-closed artwork');
assert.match(certification, /params\.tab === 'coach' \? 'coach'/, 'the DEV proof fixture must expose every role lens');
assert.match(certification, /params\.tab === 'personal_bests' \? 'personal_bests'/, 'the DEV proof fixture must expose the conditional PR lens');
assert.match(certification, /params\.scenario === 'first-pr'/, 'the DEV proof fixture must expose a first-instance PR with no fabricated chart');
assert.match(certification, /params\.scenario === 'visual'/, 'the DEV proof fixture must expose the reference-matched Overview story');
assert.match(certification, /onResumeSession=\{\(\) => undefined\}/, 'the DEV proof fixture must expose the athlete toolkit');
assert.match(certification, /onOpenMovementHistory=\{\(\) => undefined\}/, 'the DEV proof fixture must expose exact governed movement history');

console.log('Canonical shared post-Session surface, role gating, lifecycle tools, analytics, sparse states, and full-width contracts: PASS');
