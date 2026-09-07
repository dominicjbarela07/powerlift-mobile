import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const strength = read('components/ledger/StrengthExperience.tsx');
const ledgerData = read('lib/ledger-data.ts');
const liveData = read('components/ledger/use-ledger-live-data.ts');
const coachHub = read('components/coach-mobile/CoachAthleteHubV2.tsx');
const legacyProgressionRoute = read('app/(tabs)/athlete-progression.tsx');

const LOCKED_RULE = 'Strength Overview is the canonical entry point into individual core-lift progression. A redundant top-level “choose a lift” Progression destination must not exist.';

assert.match(strength, /type StrengthSection = 'overview' \| 'records' \| 'analysis'/, 'only Overview, Records, and Analysis are valid top-level Strength state');
assert.match(strength, /\['overview', 'records', 'analysis'\]/, 'the visible tab rail uses the canonical three-tab order');
assert.doesNotMatch(strength, /strength-tab-progression|strength-lift-selector|CHOOSE A LIFT|strength-select-|Open progression/, 'no redundant Progression destination or selector survives');

for (const lift of ['squat', 'bench', 'deadlift']) {
  assert.match(strength, /testID=\{`strength-overview-lift-\$\{profile\.key\}`\}/, `${lift} is represented by a directly actionable Overview card`);
  assert.match(strength, /onPress=\{\(\) => onOpenLift\(profile\.key\)\}/, `${lift} opens the lift-detail state without an intermediary`);
  assert.match(coachHub, new RegExp(`lift: family`), `${lift}-specific coach links preserve their governed lift intent`);
}

assert.match(strength, /useLocalSearchParams<\{ athleteId\?: string \| string\[\]; lift\?: string \| string\[\] \}>/, 'Strength consumes existing athlete/lift deep-link intent');
assert.match(strength, /LIFTS\.some\(\(lift\) => lift\.key === routeLiftValue\)/, 'only a governed S\/B\/D route key can open a detail');
assert.match(strength, /useLedgerLiveData\(range, \{ athleteId \}\)/, 'deep-linked coach views preserve the authorized athlete subject');
assert.match(liveData, /fetchLedgerProgression\(range, athleteId\)/, 'the live Strength projection carries the authorized subject');
assert.match(ledgerData, /params\.set\('athlete_id', String\(athleteId\)\)/, 'athlete-scoped Ledger requests explicitly identify their subject');
assert.match(legacyProgressionRoute, /<Redirect href="\/\(tabs\)\/ledger\/strength"/, 'generic legacy progression intent reconciles to Strength Overview');
assert.doesNotMatch(legacyProgressionRoute, /AthleteProgressionScreen|fetchJson|AnalyticalTimeSeriesChart/, 'the legacy route contains no dormant progression implementation');
assert.match(strength, /\['progression', 'evidence', 'standards'\]/, 'rich Progression remains inside each lift detail');

console.log(`[strength overview navigation] PASS — ${LOCKED_RULE}`);
