#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildPostSessionTabs } from '../lib/post-session-shell.ts';

const surface = fs.readFileSync('components/coach-mobile/CompletedSessionRecap.tsx', 'utf8');
const activeSurface = surface.split('/* Retired athlete-recap renderer')[0];
const tabKeys = (viewerMode, hasPersonalBests) => buildPostSessionTabs({
  viewerMode,
  hasPersonalBests,
}).map((tab) => tab.key);

assert.deepEqual(tabKeys('athlete', false), ['overview', 'performed', 'plan']);
assert.deepEqual(tabKeys('coach', false), ['overview', 'performed', 'plan', 'coach']);
assert.deepEqual(tabKeys('athlete', true), ['overview', 'performed', 'plan', 'personal_bests']);
assert.deepEqual(tabKeys('coach', true), ['overview', 'performed', 'plan', 'personal_bests', 'coach']);

assert.match(activeSurface, /buildPostSessionTabs\(\{[\s\S]*viewerMode,[\s\S]*hasPersonalBests: personalBestEvidence\.length > 0/, 'the canonical tab policy must drive the visible shell');
assert.match(activeSurface, /<Text style=\{styles\.topSubtitle\}>Post-Session Review<\/Text>/, 'the header must identify the canonical Post-Session surface rather than the active lens');
assert.doesNotMatch(activeSurface, /Post-Session \$\{activeTabLabel\}|Coach Post-Session \$\{activeTabLabel\}/, 'the route title must not collapse into an active-tab title');

const heroIndex = activeSurface.indexOf('<View style={styles.canonicalHero}>');
const tabsIndex = activeSurface.indexOf('ref={tabsScrollRef}');
const overviewIndex = activeSurface.indexOf("{tab === 'overview'");
assert.ok(heroIndex >= 0 && tabsIndex > heroIndex && overviewIndex > tabsIndex, 'the stable canonical shell and tab rail must wrap the Overview content');
assert.doesNotMatch(activeSurface, /tab !== 'overview' \? <>[\s\S]*styles\.canonicalHero/, 'Overview must never hide the canonical shell');
assert.match(activeSurface, /<FloatingDisplayUnitRegistration unit=\{unit\} onChange=\{setUnit\} slot=\{1\} testID="canonical-post-session-unit-toggle" \/>/, 'the canonical lb\/kg control must remain registered for every lens');

assert.match(activeSurface, /tab === 'overview'[\s\S]*<SessionReadOverview[\s\S]*<WhatChangedOverview[\s\S]*<RecoveryOverview[\s\S]*<ReflectionOverview/, 'the redesigned Overview must remain inside the Overview lens');
assert.match(activeSurface, /tab === 'performed'[\s\S]*performedMovements\.length \? performedMovements\.map/, 'Performed must remain reachable and render every movement');
assert.doesNotMatch(activeSurface, /shownMovements|hiddenMovementCount|showAllMovements|Show all movements/, 'Performed must not regain a movement disclosure gate');
for (const evidence of ['THIS SESSION', 'LAST TIME', 'FIRST EXACT EXPOSURE', 'MovementTrendChart', 'ManufacturerBrandMark']) {
  assert.ok(activeSurface.includes(evidence), `Performed must retain ${evidence}`);
}
assert.match(activeSurface, /tab === 'plan' \? recap\.plan\.available === false[\s\S]*<PlanCompareExperience edgeToEdge/, 'Plan \/ Compare must remain a distinct reachable lens');
assert.match(activeSurface, /tab === 'personal_bests' && personalBestEvidence\.length \? <PersonalBestsExperience/, 'Personal Bests content must remain conditional on valid PR evidence');
assert.match(activeSurface, /tab === 'coach' && viewerMode === 'coach'[\s\S]*<CoachTools review=\{coachReview\}/, 'Coach review must remain a final coach-only lens');

const tabRail = activeSurface.slice(tabsIndex, activeSurface.indexOf("{tab === 'overview'", tabsIndex));
assert.match(tabRail, /onPress=\{\(\) => setTab\(row\.key\)\}/, 'tab switches must be local workspace state changes');
assert.doesNotMatch(tabRail, /router\.|onResumeSession|started_at|completed_at|duration_seconds/, 'tab switches must not navigate or mutate Session lifecycle');
assert.match(activeSurface, /contentScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/, 'tab changes must preserve the shared surface while resetting only its scroll owner');
assert.match(activeSurface, /formatMovementPerformanceComparison\(compareMovementPerformance/, 'assisted-movement comparison semantics must remain intact');

console.log('Canonical Post-Session shell, exact role\/PR tab matrices, persistent state, and preserved lenses: PASS');
