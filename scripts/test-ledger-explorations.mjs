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
const journeyClient = read('lib/ledger-journey.ts');
const journeyMoments = read('components/ledger/journey-moments.ts');
const archiveFoundation = read('components/ledger/archive-foundation.tsx');
const archiveDetail = read('components/ledger/archive-detail.tsx');
const archiveClient = read('lib/ledger-archive.ts');
const ledgerClient = read('lib/ledger-data.ts');
const achievements = read('components/ledger/AchievementsExperience.tsx');
const explorationExperiences = read('components/ledger/exploration-experiences.tsx');
const explorationClient = read('lib/ledger-exploration.ts');
const routeScreen = read('components/ledger/route-screen.tsx');
const primitives = read('components/ledger/primitives.tsx');
const tabsLayout = read('app/(tabs)/_layout.tsx');
const ledgerLayout = read('app/(tabs)/ledger/_layout.tsx');
const activeRuntime = [model, routing, experiences, indexExperience, indexMaturity, liveData, journeyAdapter, journeyMoments, archiveFoundation, archiveDetail, achievements, explorationExperiences, explorationClient].join('\n');

const expectedMapping = {
  home: '/(tabs)/ledger/home',
  journey: '/(tabs)/ledger/journey',
  strength: '/(tabs)/ledger/strength',
  achievements: '/(tabs)/ledger/achievements',
  accessories: '/(tabs)/ledger/accessories',
  variants: '/(tabs)/ledger/variants',
  'muscle-groups': '/(tabs)/ledger/muscle-groups',
  filters: '/(tabs)/ledger/filters',
  archive: '/(tabs)/ledger/archive',
};

assert.equal(LEDGER_DESTINATIONS.length, 9, 'the Ledger must contain the index and all eight governed destinations');
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
assert.doesNotMatch(primitives, /backRow|backButton/, 'LedgerFrame does not inject the retired isolated back-button row');
assert.match(read('components/ledger/exploration-experiences.tsx'), /SLContextualHeader[\s\S]*ledgerHrefFor\('home'\)/, 'exploration rooms return explicitly through the compact contextual header');
assert.doesNotMatch(primitives, /DEV_MOCK_LIBRARY_HREF/, 'the Ledger foyer must not render a back action');
assert.doesNotMatch(primitives, /accessibilityRole="tablist"|LEDGER_DESTINATIONS\.map|navItemActive/, 'no nested Ledger room tabs may return');
assert.match(routeScreen, /screen === 'achievements'[\s\S]*?<LedgerAchievementsRoom\b/, 'Achievements routes to the approved experience');
assert.match(ledgerLayout, /<Stack screenOptions=\{\{ headerShown: false \}\} \/>/, 'Ledger rooms use the shipping stack');
assert.match(tabsLayout, /name="ledger"[\s\S]*href: viewMode === 'athlete' \|\| isIndividual \? '\/\(tabs\)\/ledger\/home' : null/, 'the Ledger is available in the shipping athlete navigation');

for (const room of ['journey', 'strength', 'achievements', 'accessories', 'variants', 'archive']) {
  assert.match(indexExperience, new RegExp(`room: '${room}'`), `the index exposes a ${room} entry`);
}
assert.match(indexExperience, /testID="ledger-muscle-groups-snapshot"/, 'the index exposes muscle-group exploration');
assert.match(indexExperience, /ledgerHrefFor\('filters'\)/, 'the index exposes contextual quick filters');
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

assert.match(liveData, /const requests = \[[\s\S]*fetchLedgerProgression[\s\S]*fetchLedgerCurrentBests[\s\S]*fetchLedgerAccomplishments/, 'shared live state must use canonical services');
assert.match(indexExperience, /useLedgerLiveData\('1y', \{ allowPartial: true \}\)/, 'the Index must remain bounded and not collapse when one optional canonical source fails');
assert.match(liveData, /Promise\.allSettled\(requests\)[\s\S]*failures\.length === requests\.length/, 'partial mode fails only when every canonical Index source fails');
assert.match(liveData, /Ledger Index loaded with partial canonical data/, 'partial release failures retain bounded diagnostic context');
assert.match(ledgerClient, /class LedgerRequestError extends Error/, 'Ledger requests preserve failure class');
assert.match(ledgerClient, /status === 401 \|\| status === 403[\s\S]*status === 404 \|\| status === 410/, 'Ledger requests distinguish authorization and unavailable evidence');
assert.doesNotMatch(liveData, /catch[\s\S]{0,500}(?:LEDGER_|mock|fixture|sample)/i, 'API failure must not substitute fixtures');
assert.doesNotMatch(indexExperience, /fetchLedgerAccomplishmentHistory/, 'the summary Index must not download the entire lifetime accomplishment archive');
assert.match(experiences, /fetchJourneyArchiveEvents/, 'Journey chronology uses Archive source records');
assert.match(experiences, /fetchJourneyBootstrap/, 'shipping Journey uses the bounded historical projection bootstrap');
assert.match(journeyClient, /\/mobile\/ledger\/journey/, 'Journey reads the authenticated historical projection namespace');
assert.match(journeyAdapter, /buildJourneyMoments/, 'Journey uses a deterministic moment aggregation boundary');
assert.match(journeyMoments, /CAREER_PR_TYPES/, 'Journey explicitly allows high-value career PR evidence');
assert.doesNotMatch(journeyMoments, /CORE_MOVEMENT_SESSION_COMPLETED|CORE_PRESCRIPTION_COMPLETED/, 'routine evaluator rows are excluded from Journey');
assert.match(indexExperience, /fetchLedgerExplorationIndex/, 'Index context uses the canonical exploration projection');
assert.match(indexExperience, /reported_bodyweight\?\.recent_observations/, 'bodyweight charts use reported readiness observations');
assert.doesNotMatch(indexExperience, /reported_bodyweight\?\.latest\?\.reported_bodyweight_kg\s*\?\?\s*context\?\.bodyweight_kg/, 'Ledger must never substitute profile bodyweight');
assert.match(indexExperience, /fetchJourneyBootstrap\(\{ limit: 24, includeSessions: true \}\)/, 'Latest Entry must use a bounded contextual Journey projection');
assert.match(indexExperience, /journeyBootstrap\?\.lifetime\.sessions_completed[\s\S]*journeyBootstrap\?\.lifetime\.total_sets[\s\S]*journeyBootstrap\?\.lifetime\.pr_count/, 'Career Snapshot uses bounded canonical lifetime totals');
assert.match(indexExperience, /eventReps\(event[\s\S]*actual_reps[\s\S]*rep_count/, 'Rep Max achievements use structured performed reps');
assert.match(indexExperience, /source_set_log_id \? `set:\$\{event\.source_set_log_id\}`/, 'accomplishments from one SetLog consolidate into one performance');
assert.match(indexExperience, /comparePrEvents[\s\S]*PR_SIGNIFICANCE/, 'Recent PR hero selection is deterministic');
assert.match(indexExperience, /eventComparison[\s\S]*typeof event\.delta/, 'Recent PR comparisons require canonical deltas');
assert.match(indexExperience, /completedTrainingWeeks[\s\S]*Last 8 completed weeks/, 'training frequency uses eight fully completed calendar weeks');
assert.match(indexExperience, /completedVolumeWeeks[\s\S]*No adjacent-week comparison/, 'volume comparisons require adjacent fully completed weekly evidence');
assert.match(indexExperience, /progression\?\.readiness\?\.average/, 'Readiness renders only when the governed aggregation exists');
assert.match(indexExperience, /formatPerformedLoad\(performance\.weight_kg, unit,[\s\S]*loadConvention: journeyLoadConvention\(entry\)/, 'Latest Entry labels assisted load only through its canonical load convention');
assert.match(indexExperience, /RAW_COMPLETION_EVENT_TYPES/, 'Latest Entry must reject raw completion event labels');
assert.doesNotMatch(indexExperience, /const latest = events\[0\]/, 'Latest Entry must not render the first raw accomplishment event');
assert.match(indexExperience, /LEDGER_INDEX_ASSETS\.careerPr[\s\S]*SL_STRENGTH_TIER_ASSETS/, 'purpose-built PR artwork and governed strength-tier trophies power distinct Career Snapshot concepts');
assert.doesNotMatch(indexExperience, /borderLeftWidth/, 'Index hierarchy cannot use colored accent rails');
assert.match(indexMaturity, /completedWorkouts >= 500[\s\S]*completedWorkouts >= 100[\s\S]*completedWorkouts >= 10/, 'maturity comes from one deterministic canonical-workout resolver');
assert.match(indexMaturity, /anniversary[\s\S]*major-pr[\s\S]*achievement[\s\S]*meet[\s\S]*reviewed-video[\s\S]*strength-change[\s\S]*rediscovery/, 'daily evidence priority is deterministic');
assert.match(experiences, /return <LedgerIndexExperience \/>/, 'the active Home route uses the maturity-aware Index');
assert.doesNotMatch(experiences, /\?\? 'deadlift'|\|\| 'deadlift'/, 'Strength must not invent a default strongest lift');
assert.match(experiences, /CanonicalStrengthTrendPlot[\s\S]*emptyBody="At least two qualifying estimated-strength observations are required\."/, 'Strength trends require real qualifying points');
assert.match(experiences, /bodyweightEvent = liftEvents\.find[\s\S]*reportedBodyweight: bodyweightEvent\?\.reported_bodyweight/, 'Strength context uses an exact source event carrying reported bodyweight');
assert.doesNotMatch(experiences, /\[0,\s*0\]|currentValue, currentValue/, 'Strength trends must not synthesize visual points');
for (const state of ['loading', 'empty', 'unauthorized', 'unavailable', 'error']) {
  assert.match(experiences, new RegExp(`ledger-\\$\\{kind\\}-state|kind=.${state}`), `Ledger rooms must preserve a ${state} state`);
}

assert.match(achievements, /useLedgerLiveData\('all', \{ fixture: devFixture \}\)/, 'Achievements uses canonical live data with an explicit DEV-only certification seam');
assert.match(achievements, /LIFT_PRESENTATIONS\.map/, 'the milestone ladder keeps all canonical lifts visible while leaving absent evidence empty');
assert.doesNotMatch(achievements, /const sourceKg = canonicalWeight \?\? estimate/, 'e1RM must not masquerade as a weight PR');
assert.match(achievements, /hasVolumeData = totalVolumeKg > 0 \|\| competitionTotalVolumeKg > 0/, 'volume achievements require real positive canonical totals');
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

assert.match(explorationClient, /\/mobile\/ledger\/archive\/movement-progress/, 'deeper Ledger views use the authenticated canonical projection');
assert.match(explorationClient, /movement-history\?movement_definition_id=/, 'movement detail is anchored to exact performed identity');
for (const surface of ['accessories', 'variants', 'muscle-groups', 'filters']) {
  assert.match(routeScreen, new RegExp(`screen === '${surface}'`), `${surface} resolves through the shipping route screen`);
}
for (const marker of ['ledger-context-bar', 'ledger-movement-detail-experience', 'ledger-muscle-detail-experience']) {
  assert.match(explorationExperiences, new RegExp(`testID="${marker}"`), `${marker} remains a concrete storyboard surface`);
}
assert.match(explorationExperiences, /CanonicalMovementArtwork[\s\S]*MuscleMap/, 'muscle and movement surfaces use governed canonical artwork');
assert.doesNotMatch(explorationExperiences, /fake fallback|fixture|sample data/i, 'deeper Ledger surfaces cannot substitute fictional evidence');

console.log('[ledger] canonical shipping routes, storyboard surfaces, truthful states, and Archive pagination passed');
