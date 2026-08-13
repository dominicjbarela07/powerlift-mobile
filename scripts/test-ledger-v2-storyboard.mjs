import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ledgerFixture } from '../components/ledger/v2/fixtures.ts';
import { blockChapters, movementEvidence } from '../components/ledger/v2/types.ts';
import { LEDGER_DESTINATIONS, ledgerHrefFor, resolveLedgerDestination } from '../components/ledger/routing.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const routeScreen = read('components/ledger/route-screen.tsx');
const index = read('components/ledger/v2/index-screen.tsx');
const data = read('components/ledger/v2/data.ts');
const assemble = read('components/ledger/v2/assemble.ts');
const ui = read('components/ledger/v2/ui.tsx');
const archive = read('components/ledger/archive-foundation.tsx');
const navigation = read('components/ledger/v2/navigation.ts');
const restoredAchievements = read('components/ledger/AchievementsExperience.tsx');
const newRuntime = [
  index,
  read('components/ledger/v2/journey-screen.tsx'),
  read('components/ledger/v2/strength-screen.tsx'),
  read('components/ledger/v2/achievements-screen.tsx'),
  restoredAchievements,
  read('components/ledger/v2/catalog-screen.tsx'),
  read('components/ledger/v2/muscle-screen.tsx'),
  read('components/ledger/v2/archive-screen.tsx'),
  ui,
].join('\n');

const topLevelRoutes = ['home', 'journey', 'strength', 'achievements', 'accessories', 'variants', 'muscles', 'archive'];
assert.deepEqual(LEDGER_DESTINATIONS.map((item) => item.key), topLevelRoutes, 'V2 destination registry is complete and ordered');
for (const key of topLevelRoutes) {
  assert.equal(resolveLedgerDestination(key)?.key, key);
  assert.equal(ledgerHrefFor(key), `/(tabs)/ledger/${key}`);
  assert.ok(existsSync(path.join(root, `app/(tabs)/ledger/${key}.tsx`)), `${key} route must exist`);
}

for (const route of [
  'strength/[movementKey].tsx',
  'achievements/[eventId].tsx',
  'accessories/[movementId].tsx',
  'variants/[movementId].tsx',
  'muscles/[muscleKey].tsx',
  'archive/[itemType]/[sourceId].tsx',
]) assert.ok(existsSync(path.join(root, 'app/(tabs)/ledger', route)), `${route} deep route must exist`);

assert.match(routeScreen, /LedgerV2IndexScreen/);
assert.match(routeScreen, /LedgerJourneyV2Screen/);
assert.match(routeScreen, /LedgerStrengthV2Screen/);
assert.match(routeScreen, /AchievementsExperience/);
assert.match(routeScreen, /LedgerAchievementsRoom/);
assert.match(routeScreen, /LedgerCatalogV2Screen kind="accessory"/);
assert.match(routeScreen, /LedgerCatalogV2Screen kind="variant"/);
assert.match(routeScreen, /LedgerMusclesV2Screen/);
assert.match(routeScreen, /LedgerArchiveV2Screen/);

for (const [number, title] of [['01', 'Journey'], ['02', 'Strength'], ['03', 'Achievements'], ['04', 'Accessories'], ['05', 'Variants'], ['06', 'Archive']]) {
  assert.match(index, new RegExp(`\\['${number}', '${title}'`), `${title} must retain its approved chapter number`);
}
assert.match(ui, /function LedgerBookIcon/, 'The Ledger must use bound-record iconography');
assert.doesNotMatch(newRuntime, /["'`]([^"'`]*\bWorkout\b[^"'`]*)["'`]/, 'V2 user-facing literals may not use Workout');
assert.doesNotMatch(newRuntime, /crushing it|taking off|dominating|hard work is paying off|undertrained|need more work/i, 'V2 may not ship bogus or prescriptive insights');

assert.match(data, /progression: fetchLedgerProgression/, 'index/strength evidence comes from canonical progression');
assert.match(data, /currentBests: fetchLedgerCurrentBests/, 'current records come from canonical current bests');
assert.match(data, /fetchLedgerAccomplishmentPage\(50\)/, 'accomplishments are canonical and bounded');
assert.match(data, /fetchArchiveCollection\('training', \{ date_from: dateFrom, limit: 24 \}\)/, 'Session history is date scoped and bounded');
assert.match(data, /searchArchive\(\{ date_from: dateFrom, limit: 50 \}\)/, 'performed evidence uses bounded server search');
assert.match(assemble, /Promise\.allSettled/, 'a secondary evidence failure must not collapse the whole Ledger');
assert.doesNotMatch(index, /if \(error \|\| !snapshot/, 'a refresh error must not hide an available Ledger snapshot');
assert.match(archive, /cursor: nextCursor/, 'production Archive uses server cursor pagination');
assert.match(archive, /block_id: naturalAlbumFilter\?\.blockId/, 'block chapter links apply an actual server filter');
assert.match(navigation, /router\.canGoBack\(\)/, 'deep navigation preserves logical back stack');

const mature = ledgerFixture('mature', 'all');
const sparse = ledgerFixture('sparse', 'all');
const matureMovements = movementEvidence(mature);
assert.equal(mature.progression.consistency?.sessions_completed, 184);
assert.ok(mature.accomplishments.some((item) => item.event_type.includes('REP_PR')), 'mature fixture includes rep PRs');
assert.ok(mature.accomplishments.some((item) => item.event_type.includes('E1RM')), 'mature fixture includes e1RM history');
assert.ok(matureMovements.filter((item) => item.classification === 'variant').length >= 4, 'mature fixture includes core variants');
assert.ok(matureMovements.filter((item) => item.classification === 'accessory').length >= 6, 'mature fixture includes rich accessories');
assert.ok(matureMovements.some((item) => item.latest.equipment), 'mature fixture includes immutable performed-equipment context');
assert.ok(blockChapters(mature).length >= 2, 'mature fixture includes multiple blocks');
assert.equal(sparse.accomplishments.length, 0, 'sparse fixture does not fabricate achievements');
assert.equal(sparse.progression.consistency?.sessions_completed, 1, 'sparse fixture represents a new athlete');

for (const relative of [
  'components/ledger/v2/index-screen.tsx',
  'components/ledger/v2/journey-screen.tsx',
  'components/ledger/v2/strength-screen.tsx',
  'components/ledger/v2/achievements-screen.tsx',
  'components/ledger/v2/catalog-screen.tsx',
  'components/ledger/v2/muscle-screen.tsx',
  'components/ledger/v2/archive-screen.tsx',
]) {
  assert.match(read(relative), /page:\s*\{\s*gap:\s*0,\s*paddingBottom:/, `${relative} owns an edge-to-edge root`);
}

console.log('[ledger-v2] storyboard routes, evidence boundaries, fixtures, navigation, and language contracts passed');
