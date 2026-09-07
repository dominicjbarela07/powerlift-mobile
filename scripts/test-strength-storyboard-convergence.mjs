import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const strength = read('components/ledger/StrengthExperience.tsx');
const router = read('components/ledger/experiences.tsx');
const primitives = read('components/ledger/primitives.tsx');
const visualAssets = read('lib/strength-ledger-visual-assets.ts');
const semanticArtwork = read('components/ledger/StrengthSemanticArtwork.tsx');
const milestoneAssets = read('lib/barbell/milestone-render-assets.ts');

assert.match(router, /StrengthExperience as StrengthStoryboardExperience/, 'the primary Strength route imports the storyboard implementation');
assert.match(router, /case 'strength': return <StrengthStoryboardExperience \/>/, 'Ledger 02 renders the storyboard implementation');
assert.match(strength, /\['overview', 'progression', 'records', 'analysis'\]/, 'the four governed Strength sections remain first-class tabs');
assert.match(strength, /strength-lift-selector/, 'Progression opens the visual three-lift selector');
assert.match(strength, /strength-lift-picker-\$\{profile\.key\}/, 'the integrated lift identity picker remains directly exercisable');
for (const lift of ['squat', 'bench', 'deadlift']) {
  assert.match(strength, new RegExp(`strength-select-\\$\\{profile\\.key\\}`), `${lift} is reachable from the shared visual selector`);
  assert.match(visualAssets, new RegExp(`ledger-core-${lift === 'squat' ? 'squat-rack' : lift === 'bench' ? 'bench-station' : 'deadlift-platform'}-v1\\.png`), `${lift} resolves from its governed full-silhouette master`);
  const clubReferences = milestoneAssets.match(new RegExp(`milestone-renders/plate-club-material-v2/${lift}-`, 'g')) ?? [];
  assert.ok(clubReferences.length >= 12, `${lift} has a substantive governed plate-club artwork ladder`);
  const cutoutName = lift === 'squat' ? 'ledger-core-squat-rack-v1.png' : lift === 'bench' ? 'ledger-core-bench-station-v1.png' : 'ledger-core-deadlift-platform-v1.png';
  const cutout = path.join(root, 'assets/images/ledger-index-v2', cutoutName);
  assert.ok(fs.existsSync(cutout) && fs.statSync(cutout).size > 50_000, `${lift} semantic art is a substantive governed asset`);
}

for (const destination of ['context-header', 'overview-card', 'selector-card', 'achievement-card', 'detail-hero', 'tier-progression', 'picker']) {
  assert.match(visualAssets, new RegExp(`'${destination}'`), `${destination} is a governed semantic-art destination`);
}
assert.match(visualAssets, /fit:\s*'contain'/, 'semantic artwork explicitly fails closed to contain framing');
assert.match(semanticArtwork, /resizeMode=\{asset\.fit\}/, 'the shared semantic renderer consumes the governed fit policy');
assert.doesNotMatch(semanticArtwork, /resizeMode=["']cover["']/, 'the shared semantic renderer can never cover-crop a lift');
assert.match(strength, /destination="overview-card"/, 'Strength Overview has an explicit card composition');
assert.match(strength, /destination="selector-card"/, 'the lift selector has an explicit card composition');
assert.match(strength, /destination="detail-hero"/, 'lift detail has an explicit hero composition');
assert.match(strength, /destination="context-header"/, 'lift navigation has an explicit atmospheric identity composition');
assert.doesNotMatch(strength, /profile\.hero|lift-tier-heroes/, 'Strength cannot fall back to one cover-oriented hero across destinations');
assert.match(strength, /SLAtmosphericContextHeader/, 'Strength navigation is composed into the atmospheric page identity');

const overviewHero = path.join(root, 'assets/images/ledger-index-v2/ledger-hero-plate-v1.png');
assert.ok(fs.existsSync(overviewHero) && fs.statSync(overviewHero).size > 100_000, 'the Overview retains a premium total-strength hero');
const atmosphere = path.join(root, 'assets/images/ledger-atmosphere-v1/strength-header-v1.png');
assert.ok(fs.existsSync(atmosphere) && fs.statSync(atmosphere).size > 100_000, 'Strength retains a substantive governed atmospheric header asset');
assert.match(strength, /\['progression', 'evidence', 'standards'\]/, 'lift detail contains Progression, Evidence, and Standards');
assert.match(strength, /strength-tier-entry/, 'lift detail reaches the complete native plate-club progression');
assert.match(strength, /CURRENT PLATE CLUB/, 'lift detail presents gym-native achievement language');
assert.match(strength, /CompetitiveStandingCard/, 'lift detail separates population context from achievement identity');
assert.match(strength, /strength-evidence-panel/, 'lift detail exposes exact source evidence');
assert.match(strength, /strength-standards-panel/, 'lift detail exposes the governed standard');
assert.match(strength, /canonicalPrHistory\(accomplishments\)/, 'Records use the canonical career PR projection');
assert.match(strength, /resolveLedgerClubsRuntimeState/, 'standing and thresholds come from the canonical Clubs runtime projection');
assert.match(strength, /useLedgerLiveData\(range\)/, 'all Strength sections share the real Ledger data boundary');
assert.match(strength, /TOTAL ESTIMATED STRENGTH/, 'Overview identifies the S\/B\/D estimate sum accurately');
assert.match(strength, /canonicalCompetitionLiftKey\(event\.core_movement_key\)/, 'record filtering begins with governed competition-lift identity');
assert.doesNotMatch(strength, /canonical(?:Competition)?LiftKey\([^\n)]*movement_label/, 'identity-based Strength consumers never infer a lift from display text');
assert.match(strength, /Thresholds are stored in KG and projected to LB only at display time/, 'the UI discloses canonical KG storage and display-only conversion');
assert.match(strength, /standard\?\.version/, 'the exact governed standard version reaches detail screens');
assert.doesNotMatch(strength, /474\.5|1,154|492\.2/, 'storyboard example values are not embedded as athlete evidence');
assert.match(primitives, /LedgerScrollToTopContext/, 'the shared Ledger frame exposes governed scroll reset ownership');
assert.match(strength, /scrollToTopAfterTransition/, 'internal Strength screen transitions reset inherited scroll state');
assert.doesNotMatch(strength, /fontSize:\s*[0-9](?:\D|$)/, 'phone typography never drops below 10 points');

console.log('[strength storyboard] route, overview, lift selector, detail, plate clubs, competitive context, evidence, standards, records, analysis, identity, and assets passed');
