import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const canonical = read('components/ui/sl-contextual-header.tsx');
assert.match(canonical, /export function SLContextualHeader/, 'the canonical contextual header is exported');
assert.match(canonical, /export function SLAtmosphericContextHeader/, 'the premium atmospheric contextual header is exported');
assert.match(canonical, /export function SLCompactTabRail/, 'the canonical compact tab rail is exported');
assert.match(canonical, /fontSize:\s*24/, 'page identity remains a strong 24-point title');
assert.match(canonical, /width:\s*44,\s*height:\s*44/, 'header controls retain 44-point touch targets');
assert.match(canonical, /atmosphericBackTarget:\s*\{\s*width:\s*44,\s*height:\s*54/, 'the integrated atmospheric back affordance retains a full touch target');
assert.match(canonical, /testID=\{testID \? `\$\{testID\}-back`/, 'the integrated atmospheric back action remains directly exercisable');
assert.match(canonical, /minHeight:\s*44/, 'tab controls retain 44-point touch targets');
assert.doesNotMatch(canonical, /headerSpacer|emptyAction|placeholder/, 'the canonical header cannot render decorative filler controls');
assert.doesNotMatch(canonical, /controlVisual/, 'contextual navigation cannot restore the giant rounded-square control widget');
assert.match(canonical, /borderBottomWidth:\s*2/, 'the compact rail marks selection as an integrated underline');
assert.doesNotMatch(canonical, /tabTarget:\s*\{[^}]*borderRadius/, 'the compact rail cannot regress into detached SaaS pills');

assert.ok(!fs.existsSync(path.join(root, 'components/ui/sl-page-header.tsx')), 'the retired page-header implementation is deleted');

const activeSourceRoots = ['app', 'components'];
const sourceFiles = [];
for (const sourceRoot of activeSourceRoots) {
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(absolute);
    }
  };
  walk(path.join(root, sourceRoot));
}

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  assert.doesNotMatch(source, /\bSLPageHeader\b/, `${relative} must not use the retired page-header shell`);
}

const primitives = read('components/ledger/primitives.tsx');
assert.doesNotMatch(primitives, /backRow|backButton/, 'LedgerFrame no longer injects an isolated back-button row');
assert.match(primitives, /SLCompactTabRail/, 'Ledger segmented modes use the compact canonical tab rail');

const strength = read('components/ledger/StrengthExperience.tsx');
assert.match(strength, /SLAtmosphericContextHeader/, 'Strength composes navigation into its atmospheric page identity');
assert.match(strength, /STRENGTH_LEDGER_ATMOSPHERE_ASSETS\.strength/, 'Strength uses the governed iron atmosphere');
assert.match(strength, /SLCompactTabRail/, 'Strength uses the canonical compact tab rail');
assert.doesNotMatch(strength, /function StrengthHeader|detailHeaderSpacer|styles\.detailHeader/, 'Strength cannot restore the duplicate centered title shell');

const achievements = read('components/ledger/AchievementsExperience.tsx');
assert.match(achievements, /SLAtmosphericContextHeader/, 'Achievements composes navigation into its atmospheric page identity');
assert.match(achievements, /STRENGTH_LEDGER_ATMOSPHERE_ASSETS\.achievements/, 'Achievements uses the governed metallic achievement atmosphere');
assert.match(achievements, /SLCompactTabRail/, 'Achievements uses the canonical compact tab rail');
assert.doesNotMatch(achievements, /<View style=\{styles\.navButton\} \/>/, 'Achievements cannot render an empty right-side circle');

const exploration = read('components/ledger/exploration-experiences.tsx');
assert.match(exploration, /return <SLContextualHeader/, 'Accessories, Variants, muscle pages, and filters share the canonical header');
assert.match(exploration, /SLCompactTabRail/, 'movement exploration modes share the compact tab rail');
assert.doesNotMatch(exploration, /roomKicker|roomTitle|roomSubtitle/, 'the redundant Ledger room title stack is retired');

const ledgerExperiences = read('components/ledger/experiences.tsx');
assert.match(ledgerExperiences, /<SLContextualHeader[\s\S]*title="Journey"/, 'Journey uses the canonical contextual header');
assert.doesNotMatch(ledgerExperiences, /journeyIntroTitle|journeyIntroBody/, 'Journey does not retain its duplicate intro shell');

const ledgerIndex = read('components/ledger/index-experience.tsx');
assert.match(ledgerIndex, /<ImageBackground source=\{LEDGER_INDEX_ASSETS\.hero\}/, 'The Ledger root preserves its governed atmospheric identity art');
assert.match(ledgerIndex, /<Text style=\{styles\.pageTitle\}>THE LEDGER<\/Text>/, 'The Ledger root preserves its readable title over the atmospheric art');
assert.doesNotMatch(ledgerIndex, /SLContextualHeader|SLPageHeader/, 'the atmospheric Ledger root does not restore a nested-page header shell');

const archive = read('components/ledger/archive-foundation.tsx');
assert.match(archive, /SLContextualHeader/, 'Archive uses the canonical contextual header');
assert.doesNotMatch(archive, /function ArchiveHeading/, 'the oversized Archive heading shell is retired');

const coach = read('components/coach-mobile/coach-mobile-v2-ui.tsx');
assert.match(coach, /return <SLContextualHeader/, 'coach athlete detail delegates to the canonical header');
assert.doesNotMatch(coach, /headerSpacer/, 'coach detail cannot render empty balancing controls');

for (const [route, description] of [
  ['app/coach-team-brief.tsx', 'Coach Team Brief'],
  ['app/coach-team-outliers.tsx', 'Coach outliers'],
  ['app/coach-athlete-analytics/[athleteId].tsx', 'Coach athlete analytics'],
  ['components/coach-mobile/CoachCheckInsV2.tsx', 'Coach Check-Ins drill-downs'],
  ['components/training-hub/AthleteProgramTimeline.tsx', 'Program Timeline'],
  ['components/movement-history/CanonicalMovementHistoryScreen.tsx', 'canonical Movement History'],
  ['app/(tabs)/messages/announcements.tsx', 'Announcements'],
]) {
  const source = read(route);
  assert.match(source, /SLContextualHeader/, `${description} uses the canonical contextual header`);
  assert.doesNotMatch(source, /headerSpacer|headerButtonPlaceholder/, `${description} cannot restore invisible header balancing controls`);
}

const teamBrief = read('app/coach-team-brief.tsx');
assert.match(teamBrief, /SLCompactTabRail/, 'Coach Team Brief uses the canonical period rail');
assert.match(teamBrief, /metricSelectorButton:\s*\{[^}]*minHeight:\s*44/, 'Coach Team Brief analytical mode targets remain at least 44 points');
assert.match(teamBrief, /liftTab:\s*\{[^}]*height:\s*44/, 'Coach Team Brief lift targets remain at least 44 points');

const outliers = read('app/coach-team-outliers.tsx');
assert.match(outliers, /SLCompactTabRail/, 'Coach outlier filters use the canonical compact rail');

const checkIns = read('components/coach-mobile/CoachCheckInsV2.tsx');
assert.match(checkIns, /return <SLCompactTabRail/, 'Coach Check-In drill-down modes use the canonical compact rail');

const messages = read('app/(tabs)/messages/[threadId].tsx');
assert.doesNotMatch(messages, /headerSpacer/, 'specialized conversation identity headers cannot render invisible balancing controls');

for (const route of [
  'app/(tabs)/workout/block-details.tsx',
  'app/(tabs)/workout/movement-history.tsx',
  'app/(tabs)/workout/session-history.tsx',
]) {
  const source = read(route);
  assert.match(source, /SLContextualHeader/, `${route} uses the canonical Training Hub drill-down header`);
  assert.match(source, /scroll:\s*\{\s*paddingTop:\s*[0-8],\s*paddingBottom:\s*36,\s*gap:\s*[0-9]/, `${route} keeps content immediately below its compact header`);
}

const recap = read('components/coach-mobile/CompletedSessionRecap.tsx');
assert.match(recap, /styles\.topBar/, 'post-Session detail retains its already-compact contextual top bar');
assert.match(recap, /hasPostSessionMenu[\s\S]*ellipsis-horizontal/, 'post-Session detail shows a real right action, never filler');

const calendar = read('app/(tabs)/athlete-calendar.tsx');
assert.doesNotMatch(calendar, /SLPageHeader|backRow|headerSpacer/, 'Calendar drill-downs do not use the retired shell');
const settings = read('app/(tabs)/settings.tsx');
assert.doesNotMatch(settings, /SLPageHeader|backRow|headerSpacer/, 'Settings detail surfaces do not use the retired shell');

console.log('[premium contextual header] canonical shell, Ledger family, Training drill-downs, coach, Calendar, Settings, and post-Session guards passed');
