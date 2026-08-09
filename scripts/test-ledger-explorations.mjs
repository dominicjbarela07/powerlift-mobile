import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  ledgerHrefFor,
  LEDGER_DESTINATIONS,
  resolveLedgerDestination,
  resolveLedgerDestinationFromPathname,
} from '../components/ledger/routing.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const model = read('components/ledger/model.ts');
const routing = read('components/ledger/routing.ts');
const experiences = read('components/ledger/experiences.tsx');
const indexExperience = read('components/ledger/index-experience.tsx');
const indexMaturity = read('components/ledger/index-maturity.ts');
const liveData = read('components/ledger/use-ledger-live-data.ts');
const journeyAdapter = read('components/ledger/journey-live-events.ts');
const journeyMoments = read('components/ledger/journey-moments.ts');
const archiveFoundation = read('components/ledger/archive-foundation.tsx');
const archiveDetail = read('components/ledger/archive-detail.tsx');
const archiveClient = read('lib/ledger-archive.ts');
const ledgerClient = read('lib/ledger-data.ts');
const achievements = read('components/ledger/AchievementsExperience.tsx');
const routeScreen = read('components/ledger/route-screen.tsx');
const primitives = read('components/ledger/primitives.tsx');
const tabsLayout = read('app/(tabs)/_layout.tsx');
const ledgerLayout = read('app/(tabs)/ledger/_layout.tsx');
const activeRuntime = [model, routing, experiences, indexExperience, indexMaturity, liveData, journeyAdapter, journeyMoments, archiveFoundation, archiveDetail, achievements].join('\n');

const expectedMapping = {
  home: '/(tabs)/ledger/home',
  journey: '/(tabs)/ledger/journey',
  strength: '/(tabs)/ledger/strength',
  achievements: '/(tabs)/ledger/achievements',
  archive: '/(tabs)/ledger/archive',
};

assert.equal(LEDGER_DESTINATIONS.length, 5, 'the Ledger must contain the foyer and four rooms');
for (const destination of LEDGER_DESTINATIONS) {
  assert.equal(destination.route, expectedMapping[destination.key]);
  assert.equal(resolveLedgerDestination(destination.key), destination);
  assert.equal(resolveLedgerDestinationFromPathname(destination.route), destination);
  assert.equal(ledgerHrefFor(destination.key), destination.route);
  const routePath = path.join(root, `app/(tabs)/ledger/${destination.key}.tsx`);
  assert.ok(existsSync(routePath), `${destination.key} requires a concrete route`);
}
assert.equal(resolveLedgerDestination(undefined), null, 'missing destinations must never become Home');
assert.equal(resolveLedgerDestination('unknown-room'), null, 'unknown destinations must never become Home');
assert.match(primitives, /!isIndex \? <View[\s\S]*ledgerHrefFor\('home'\)/, 'rooms return explicitly to the Ledger index');
assert.doesNotMatch(primitives, /DEV_MOCK_LIBRARY_HREF/, 'the Ledger foyer must not render a back action');
assert.doesNotMatch(primitives, /accessibilityRole="tablist"|LEDGER_DESTINATIONS\.map|navItemActive/, 'no nested Ledger room tabs may return');
assert.match(routeScreen, /screen === 'achievements'[\s\S]*?<LedgerAchievementsRoom \/>/, 'Achievements routes to the approved experience');
assert.match(ledgerLayout, /<Stack screenOptions=\{\{ headerShown: false \}\} \/>/, 'Ledger rooms use the shipping stack');
assert.match(tabsLayout, /name="ledger"[\s\S]*href: viewMode === 'athlete' \|\| isIndividual \? '\/\(tabs\)\/ledger\/home' : null/, 'the Ledger is available in the shipping athlete navigation');

for (const room of ['journey', 'strength', 'achievements', 'archive']) {
  assert.match(indexExperience, new RegExp(`testID="ledger-${room}-snapshot"|room="${room}"`), `the index exposes a ${room} entry`);
}
for (const obsoleteRoute of ['development', 'legacy', 'film-room', 'perspective', 'memories', 'identity']) {
  assert.equal(existsSync(path.join(root, `app/(tabs)/ledger/${obsoleteRoute}.tsx`)), false, `${obsoleteRoute} compatibility route must not preserve runtime fixtures`);
}

assert.doesNotMatch(model, /LEDGER_ATHLETE|JOURNEY_EVENTS_BY_YEAR|ACHIEVEMENT_ARTIFACTS|HISTORY_SESSIONS|FILM_ARCHIVE|MEMORY_ENTRIES/, 'the model must not export athlete fixture records');
assert.match(model, /Decorative assets only/, 'remaining static assets must be explicitly decorative');
assert.match(model, /CORE_LIFT_PRESENTATION/, 'static lift metadata may retain presentation-only configuration');
assert.doesNotMatch(model, /currentE1rm|allTimeE1rm|currentPr|trainingYears|coachName/, 'presentation metadata must not contain athlete values');
assert.doesNotMatch(model, /personal\?|image\?|video\?|duration\?|stat\?|transition\?|meetTotal\?|recordRegion\?/, 'Journey contracts must not retain fields that existed only for fictional cards');
for (const forbiddenRuntimeCopy of ['Jordan Reyes', 'Coach A', 'V2 DEMO', 'one year ago today', 'first 315', 'Spring Showdown', 'The first 500 after injury']) {
  assert.doesNotMatch(activeRuntime, new RegExp(forbiddenRuntimeCopy, 'i'), `runtime must not contain fictional copy: ${forbiddenRuntimeCopy}`);
}

assert.match(liveData, /Promise\.all\(\[[\s\S]*fetchLedgerProgression[\s\S]*fetchLedgerCurrentBests[\s\S]*fetchLedgerAccomplishments/, 'shared live state must use canonical services');
assert.match(ledgerClient, /class LedgerRequestError extends Error/, 'Ledger requests preserve failure class');
assert.match(ledgerClient, /status === 401 \|\| status === 403[\s\S]*status === 404 \|\| status === 410/, 'Ledger requests distinguish authorization and unavailable evidence');
assert.doesNotMatch(liveData, /catch[\s\S]{0,500}(?:LEDGER_|mock|fixture|sample)/i, 'API failure must not substitute fixtures');
assert.match(indexExperience, /fetchJourneyArchiveEvents/, 'Index chronology uses Archive source records');
assert.match(experiences, /fetchJourneyArchiveEvents/, 'Journey chronology uses Archive source records');
assert.match(journeyAdapter, /buildJourneyMoments/, 'Journey uses a deterministic moment aggregation boundary');
assert.match(journeyMoments, /CAREER_PR_TYPES/, 'Journey explicitly allows high-value career PR evidence');
assert.doesNotMatch(journeyMoments, /CORE_MOVEMENT_SESSION_COMPLETED|CORE_PRESCRIPTION_COMPLETED/, 'routine evaluator rows are excluded from Journey');
assert.match(indexExperience, /getAthleteVideoArchive\(\)[\s\S]*thumbnail_url/, 'Index imagery must come from canonical athlete media');
assert.match(indexExperience, /source=\{\{ uri: media\.thumbnail \}\}/, 'canonical signed media URLs power the Index exhibit');
assert.match(indexExperience, /ATMOSPHERIC_GYM[\s\S]*accessible=\{false\}/, 'atmospheric imagery is explicitly decorative');
assert.doesNotMatch(indexExperience, /borderLeftWidth|borderRightWidth/, 'Index hierarchy cannot use colored accent rails');
assert.match(indexMaturity, /completedWorkouts >= 500[\s\S]*completedWorkouts >= 100[\s\S]*completedWorkouts >= 10/, 'maturity comes from one deterministic canonical-workout resolver');
assert.match(indexMaturity, /anniversary[\s\S]*major-pr[\s\S]*achievement[\s\S]*meet[\s\S]*reviewed-video[\s\S]*strength-change[\s\S]*rediscovery/, 'daily evidence priority is deterministic');
assert.match(experiences, /return <LedgerIndexExperience \/>/, 'the active Home route uses the maturity-aware Index');
assert.doesNotMatch(experiences, /\?\? 'deadlift'|\|\| 'deadlift'/, 'Strength must not invent a default strongest lift');
assert.match(experiences, /points\.length < 2[\s\S]*Not enough qualifying evidence to draw a trend/, 'Strength trends require real qualifying points');
assert.doesNotMatch(experiences, /\[0,\s*0\]|currentValue, currentValue/, 'Strength trends must not synthesize visual points');
for (const state of ['loading', 'empty', 'unauthorized', 'unavailable', 'error']) {
  assert.match(experiences, new RegExp(`ledger-\\$\\{kind\\}-state|kind=.${state}`), `Ledger rooms must preserve a ${state} state`);
}

assert.match(achievements, /useLedgerLiveData\('all'\)/, 'Achievements uses canonical live data');
assert.match(achievements, /LIFT_PRESENTATIONS\.flatMap/, 'PR rows omit absent canonical lift evidence');
assert.doesNotMatch(achievements, /const sourceKg = canonicalWeight \?\? estimate/, 'e1RM must not masquerade as a weight PR');
assert.match(achievements, /hasVolumeData = volumePoints\.some/, 'volume achievements require real positive source evidence');
assert.match(achievements, /AchievementRequestState kind="empty"/, 'Achievements has truthful empty states');
assert.doesNotMatch(achievements, /current:\s*\{\s*lb:\s*\d|currentLb:\s*\d|value:\s*\d+[^\n]*career/i, 'Achievements presentation policy must not embed athlete progress');

assert.match(archiveClient, /\/mobile\/ledger\/archive/, 'Archive uses the canonical endpoint namespace');
assert.match(archiveFoundation, /fetchArchiveLanding/, 'Archive overview uses canonical landing data');
assert.match(archiveFoundation, /getAthleteVideoArchive\(\)/, 'Archive film uses canonical athlete media previews');
assert.match(archiveFoundation, /Latest from your record[\s\S]*Recent sessions[\s\S]*Lift film[\s\S]*Training albums[\s\S]*Rediscovered[\s\S]*Find something specific/, 'Archive overview remains browse-first and keeps organizational tools secondary');
assert.match(archiveFoundation, /program_context\?\.block_id[\s\S]*program_context\?\.program_id/, 'Archive albums preserve canonical program and block relationships');
assert.doesNotMatch(archiveFoundation, /mediaGridLines|Three ways into the record/, 'Archive cannot substitute fake film imagery or lead with database-like collection framing');
assert.match(archiveFoundation, /cursor: nextCursor/, 'Archive supports server pagination');
assert.match(archiveFoundation, /error\.status === 404 \|\| error\.status === 410/, 'Archive overview distinguishes unavailable sources');
assert.match(archiveDetail, /error\.status === 401 \|\| error\.status === 403/, 'Archive detail distinguishes authorization');
assert.match(archiveDetail, /error\.status === 404 \|\| error\.status === 410/, 'Archive detail distinguishes unavailable sources');
assert.match(archiveDetail, /state === 'error'[\s\S]*Try again/, 'Archive detail exposes retryable service failures');
assert.doesNotMatch(`${archiveFoundation}\n${archiveDetail}`, /(?:mock|fixture|sample)(?:Data|Items|Results)|fake fallback/i, 'Archive cannot contain fallback records');

console.log('[ledger] canonical shipping routes, adapters, truthful states, and Archive pagination passed');
