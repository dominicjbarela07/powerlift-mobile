import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const experience = read('components/ledger/StrengthExperience.tsx');
const story = read('components/ledger/StrengthProgressionStory.tsx');
const data = read('lib/ledger-data.ts');

assert.match(data, /strength_lenses\?: StrengthProgressionLenses \| null/, 'the live progression payload exposes the governed lens contract');
assert.match(experience, /live\?\.strength_lenses \?\? null/, 'each lift consumes its live lens projection');
assert.match(experience, /<StrengthProgressionStory[\s\S]*lenses=\{profile\.lenses\}/, 'the detailed progression page renders the live progression story');

const requiredLensIds = [
  'strength-lens-estimated',
  'strength-lens-weight-on-bar',
  'strength-lens-rep-strength',
  'strength-lens-training-volume',
  'strength-lens-comparable-performance',
  'strength-lens-heavy-exposure',
  'strength-lens-historical-context',
  'strength-lens-source-evidence',
];
let previous = -1;
for (const testID of requiredLensIds) {
  const index = story.indexOf(`testID="${testID}"`);
  assert.ok(index > previous, `${testID} is present in the governed evidence order`);
  previous = index;
}

for (const range of ['30d', '90d', '180d', '1y', 'all']) {
  assert.match(experience, new RegExp(`\\['${range}'|, '${range}'`), `${range} remains available from the shared range control`);
}
assert.match(experience, /<RangeTabs value=\{range\} onChange=\{onRangeChange\}/, 'one shared range state drives the entire lift progression');
assert.match(experience, /strength-overview-performed-evidence/, 'Strength Overview includes concise performed-evidence signals');
assert.match(experience, /governed 80% threshold/, 'Overview identifies the heavy-exposure policy');
assert.match(experience, /selectorCard: \{ height: 166/, 'lift-selector cards have a definite compact height');
assert.match(experience, /selectorArtStage: \{ width: '46%', height: 166/, 'lift-selector art cannot resolve against an unbounded percentage height');

assert.match(story, /evidence: 'ESTIMATED' \| 'PERFORMED'/, 'estimated and performed evidence are visibly distinct');
assert.match(story, /Literal .*heaviest load\. No formula\./, 'weight-on-bar is explicitly literal and formula-free');
assert.match(story, /Estimated rep maxes are excluded/, 'rep strength excludes estimated rep maxes');
assert.match(story, /e1RM is not used/, 'comparable performance is independent of e1RM');
assert.match(story, /heavy\.definition/, 'the governed heavy-exposure definition is shown, not hidden');
assert.match(story, /strength-open-source-evidence/, 'source evidence has a directly reachable action');
assert.match(experience, /strength-progression-source-list/, 'the evidence tab exposes the source performances behind every lens');
assert.match(experience, /Only exact governed competition-lift evidence is shown/, 'variant mixing fails closed in the evidence presentation');

for (const compactEmpty of [
  'strength-top-weight-empty',
  'strength-rep-max-empty',
  'strength-volume-empty',
  'strength-comparison-empty',
  'strength-heavy-empty',
  'strength-history-empty',
]) {
  assert.match(story, new RegExp(compactEmpty), `${compactEmpty} is an honest compact empty state`);
}
assert.doesNotMatch(`${story}\n${experience}`, /you(?:'re| are) stronger|keep pushing|crush(?:ed|ing)? it|beast mode/i, 'the evidence experience contains no generic motivational language');
assert.doesNotMatch(story, /fontSize:\s*[0-9](?:\D|$)/, 'progression-story phone typography never drops below 10 points');

console.log('[strength progression experience] shared range, estimated/performed lenses, history, evidence, empty states, and overview signals passed');
