import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'components/ledger/index-experience.tsx'), 'utf8');
const resolver = await readFile(path.join(root, 'lib/ledger-index-assets.ts'), 'utf8');

for (const marker of [
  'ImageBackground',
  'LEDGER_INDEX_ASSETS.hero',
  'CareerBars',
  'ledgerCoreLiftAsset',
  'LEDGER_INDEX_ASSETS.careerSets',
  'LEDGER_INDEX_ASSETS.careerPr',
  'LatestEntryArtwork',
  "ledgerIndexChapterAsset('strength')",
  "room: 'journey'",
  "room: 'strength'",
  "room: 'achievements'",
  "room: 'accessories'",
  "room: 'variants'",
  "room: 'archive'",
  "openRoom('muscle-groups')",
  "ledgerHrefFor('filters')",
]) {
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing Ledger convergence marker: ${marker}`);
}

for (const forbidden of ['journey-meet-team', 'achievement-material-v2']) {
  assert.doesNotMatch(source + resolver, new RegExp(forbidden), `Ledger index must not use people-based or generic lift artwork: ${forbidden}`);
}

const expectedAssets = new Map([
  ['ledger-hero-plate-v1.png', [1200, 600]],
  ['ledger-chapter-journey-v1.png', [384, 384]],
  ['ledger-chapter-accessories-v1.png', [384, 384]],
  ['ledger-chapter-variants-v1.png', [384, 384]],
  ['ledger-chapter-archive-v1.png', [384, 384]],
  ['ledger-career-sets-counter-v1.png', [600, 600]],
  ['ledger-career-pr-medallion-v1.png', [600, 600]],
  ['ledger-core-squat-rack-v1.png', [600, 600]],
  ['ledger-core-bench-station-v1.png', [600, 600]],
  ['ledger-core-deadlift-platform-v1.png', [600, 600]],
]);

for (const [filename, [expectedWidth, expectedHeight]] of expectedAssets) {
  const assetPath = path.join(root, 'assets/images/ledger-index-v2', filename);
  const metadata = await stat(assetPath);
  assert.ok(metadata.size > 40_000, `${filename} should be a production-quality raster asset`);
  const png = await readFile(assetPath);
  assert.equal(png.toString('ascii', 1, 4), 'PNG', `${filename} must be a PNG`);
  assert.equal(png.readUInt32BE(16), expectedWidth, `${filename} width changed`);
  assert.equal(png.readUInt32BE(20), expectedHeight, `${filename} height changed`);
  if (expectedWidth === 600) assert.equal(png.readUInt8(25), 6, `${filename} must preserve RGBA transparency`);
}

assert.match(resolver, /full-body\.png/, 'Muscle Groups must retain governed anatomy artwork');
assert.match(resolver, /plate-stack-catalog\/blender-cycles-catalog-v1\/lb\/455\.png/, 'Strength chapter must use equipment-led imagery');
assert.match(resolver, /normalized\.includes\('squat'\)[\s\S]*normalized\.includes\('bench'\)[\s\S]*normalized\.includes\('deadlift'\)/, 'Core Lift resolver must preserve distinct semantic equipment families');
assert.match(resolver, /return null;/, 'genuinely unknown lift families retain a safe explicit fallback boundary');
assert.match(resolver, /LEDGER_INDEX_ASSET_GOVERNANCE/, 'new Ledger artwork must publish governed asset metadata');
assert.doesNotMatch(source, /resolvePlateStackRender|fallbackPlate|prMedallion/, 'valid core lifts, Sets, and PRs must not resolve through generic load imagery');
assert.match(source, /SL_TOTAL_TROPHY_ASSETS/, 'Achievements must retain the approved trophy system');
assert.match(source, /hero: \{ minHeight: 160, justifyContent: 'flex-end'/, 'Ledger hero must not restore the oversized top dead space');
assert.match(source, /page: \{ gap: 19, paddingBottom: 20/, 'Ledger hero must preserve the breathing room before Career Snapshot');
assert.match(source, /heroCopy: \{ gap: 4, paddingHorizontal: 18, paddingBottom: 25 \}/, 'Ledger hero copy must preserve its intentional bottom breathing room');

console.log('[ledger-index-visual] composition, routes, governed artwork, and raster dimensions passed');
