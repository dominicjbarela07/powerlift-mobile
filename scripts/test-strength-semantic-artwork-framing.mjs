import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assets = read('lib/strength-ledger-visual-assets.ts');
const renderer = read('components/ledger/StrengthSemanticArtwork.tsx');
const strength = read('components/ledger/StrengthExperience.tsx');
const achievements = read('components/ledger/AchievementsExperience.tsx');

const destinations = ['context-header', 'overview-card', 'selector-card', 'achievement-card', 'detail-hero', 'tier-progression', 'picker'];
const subjects = {
  squat: ['ledger-core-squat-rack-v1.png', 'rack-loaded-bar'],
  bench: ['ledger-core-bench-station-v1.png', 'bench-rack-loaded-bar'],
  deadlift: ['ledger-core-deadlift-platform-v1.png', 'floor-bar-platform'],
};

for (const [lift, [filename, subject]] of Object.entries(subjects)) {
  assert.match(assets, new RegExp(filename.replace('.', '\\.')), `${lift} resolves through its governed identity asset`);
  assert.match(assets, new RegExp(subject), `${lift} preserves its semantic equipment silhouette contract`);
  const file = path.join(root, 'assets/images/ledger-index-v2', filename);
  assert.ok(fs.existsSync(file) && fs.statSync(file).size > 50_000, `${lift} governed identity art is present and substantive`);
}

for (const destination of destinations) {
  assert.match(assets, new RegExp(`'${destination}'`), `${destination} is part of the destination matrix`);
  assert.match(renderer, new RegExp(destination === 'picker' ? '\\bpicker:' : `'${destination}'`), `${destination} owns a renderer safe zone`);
}

assert.match(assets, /destinationRule:\s*'Semantic strength artwork is composed for its destination and is never cover-cropped\.'/i, 'the permanent destination-framing rule is governed centrally');
assert.match(renderer, /resizeMode=\{asset\.fit\}/, 'the renderer obeys the governed fit');
assert.doesNotMatch(renderer, /cover/, 'the semantic renderer contains no cover path');

for (const [source, label] of [[strength, 'Strength'], [achievements, 'Achievements']]) {
  assert.match(source, /StrengthSemanticArtwork/, `${label} consumes the governed semantic renderer`);
  assert.doesNotMatch(source, /lift-tier-heroes/, `${label} does not reuse a cinematic hero as a universal semantic asset`);
}

assert.match(strength, /currentHeroArtStage[\s\S]*currentHeroEvidenceRow/, 'Strength detail deliberately partitions art from evidence');
assert.match(achievements, /liftDetailHeroArtStage[\s\S]*liftDetailHeroCopy/, 'Achievements detail deliberately partitions art from evidence');

console.log('[strength semantic artwork framing] governed identities, destination matrix, contain policy, safe zones, and consumer partitions passed');
