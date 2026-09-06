import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const strength = read('components/ledger/StrengthExperience.tsx');
const router = read('components/ledger/experiences.tsx');
const primitives = read('components/ledger/primitives.tsx');

assert.match(router, /StrengthExperience as StrengthStoryboardExperience/, 'the primary Strength route imports the storyboard implementation');
assert.match(router, /case 'strength': return <StrengthStoryboardExperience \/>/, 'Ledger 02 renders the storyboard implementation');
assert.match(strength, /\['overview', 'progression', 'records', 'analysis'\]/, 'the four governed Strength sections remain first-class tabs');
assert.match(strength, /strength-lift-selector/, 'Progression opens the visual three-lift selector');
for (const lift of ['squat', 'bench', 'deadlift']) {
  assert.match(strength, new RegExp(`strength-select-\\$\\{profile\\.key\\}`), `${lift} is reachable from the shared visual selector`);
  assert.match(strength, new RegExp(`lift-tier-heroes/${lift}\\.png`), `${lift} uses its premium lift-specific hero`);
  const tierReferences = strength.match(new RegExp(`milestone-renders/plate-club-material-v2/${lift}-`, 'g')) ?? [];
  assert.equal(tierReferences.length, 7, `${lift} has seven distinct lift-specific tier assets`);
  const hero = path.join(root, 'assets/images/achievements/lift-tier-heroes', `${lift}.png`);
  assert.ok(fs.existsSync(hero) && fs.statSync(hero).size > 100_000, `${lift} hero art is a substantive premium asset`);
}

const overviewHero = path.join(root, 'assets/images/ledger-index-v2/ledger-hero-plate-v1.png');
assert.ok(fs.existsSync(overviewHero) && fs.statSync(overviewHero).size > 100_000, 'the Overview retains a premium total-strength hero');
assert.match(strength, /\['progression', 'evidence', 'standards'\]/, 'lift detail contains Progression, Evidence, and Standards');
assert.match(strength, /strength-tier-entry/, 'lift detail reaches the complete seven-tier progression');
assert.match(strength, /strength-evidence-panel/, 'lift detail exposes exact source evidence');
assert.match(strength, /strength-standards-panel/, 'lift detail exposes the governed standard');
assert.match(strength, /canonicalPrHistory\(accomplishments\)/, 'Records use the canonical career PR projection');
assert.match(strength, /resolveLedgerClubsRuntimeState/, 'standing and thresholds come from the canonical Clubs runtime projection');
assert.match(strength, /useLedgerLiveData\(range\)/, 'all Strength sections share the real Ledger data boundary');
assert.match(strength, /TOTAL ESTIMATED STRENGTH/, 'Overview identifies the S\/B\/D estimate sum accurately');
assert.match(strength, /canonicalCompetitionLiftKey\(event\.core_movement_key\)/, 'record filtering begins with governed competition-lift identity');
assert.doesNotMatch(strength, /canonical(?:Competition)?LiftKey\([^\n)]*movement_label/, 'identity-based Strength consumers never infer a lift from display text');
assert.match(strength, /Thresholds are stored in KG and projected to LB only at display time/, 'the UI discloses canonical KG storage and display-only conversion');
assert.match(strength, /clubs\.standard\?\.version/, 'the exact governed standard version reaches detail screens');
assert.doesNotMatch(strength, /474\.5|1,154|492\.2/, 'storyboard example values are not embedded as athlete evidence');
assert.match(primitives, /LedgerScrollToTopContext/, 'the shared Ledger frame exposes governed scroll reset ownership');
assert.match(strength, /scrollToTopAfterTransition/, 'internal Strength screen transitions reset inherited scroll state');
assert.doesNotMatch(strength, /fontSize:\s*[0-9](?:\D|$)/, 'phone typography never drops below 10 points');

console.log('[strength storyboard] route, overview, lift selector, detail, tiers, evidence, standards, records, analysis, identity, and assets passed');
