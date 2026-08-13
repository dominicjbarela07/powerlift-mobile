import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourceRoot = resolve(import.meta.dirname, '..');
const releaseProjection = process.argv.includes('--release-projection');
const rootArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const root = rootArgument ? resolve(rootArgument) : sourceRoot;
const source = (path) => readFileSync(resolve(root, path), 'utf8');

const ledgerRoutes = Object.freeze({
  home: 'app/(tabs)/ledger/home.tsx',
  journey: 'app/(tabs)/ledger/journey.tsx',
  strength: 'app/(tabs)/ledger/strength.tsx',
  achievements: 'app/(tabs)/ledger/achievements.tsx',
  accessories: 'app/(tabs)/ledger/accessories.tsx',
  variants: 'app/(tabs)/ledger/variants.tsx',
  muscles: 'app/(tabs)/ledger/muscle-groups.tsx',
  archive: 'app/(tabs)/ledger/archive.tsx',
});

for (const [room, path] of Object.entries(ledgerRoutes)) {
  assert.ok(existsSync(resolve(root, path)), `${room} must resolve to the approved DEV Ledger route`);
  assert.match(source(path), /components\/ledger\/(route-screen|archive-detail)/, `${room} must use the canonical Ledger component tree`);
}

const routeScreen = source('components/ledger/route-screen.tsx');
assert.match(routeScreen, /ExperienceForScreen/);
assert.match(routeScreen, /MovementCollectionExperience/);
assert.match(routeScreen, /MuscleGroupsExperience/);
assert.doesNotMatch(routeScreen, /components\/ledger\/v2|\.\/v2\//, 'the obsolete independent TestFlight Ledger implementation must not be wired into shipping routes');

for (const path of [
  'components/ledger/index-experience.tsx',
  'components/ledger/experiences.tsx',
  'components/ledger/exploration-experiences.tsx',
  'components/ledger/AchievementsExperience.tsx',
  'lib/ledger-journey.ts',
  'lib/ledger-exploration.ts',
  'lib/ledger-archive.ts',
  'lib/ledger-data.ts',
  'lib/accessory-muscle-region-assets.ts',
]) assert.ok(existsSync(resolve(root, path)), `shipping parity source is missing: ${path}`);

const index = source('components/ledger/index-experience.tsx');
for (const contract of ['CAREER SNAPSHOT', 'CORE LIFTS · LATEST RESULTS', 'LATEST ENTRY', 'AT A GLANCE', 'CONTEXT MATTERS', 'FULL LEDGER INDEX']) {
  assert.match(index, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Ledger Index contract is missing: ${contract}`);
}

const routing = source('components/ledger/routing.ts');
for (const room of ['home', 'journey', 'strength', 'achievements', 'accessories', 'variants', 'muscle-groups', 'archive']) {
  assert.match(routing, new RegExp(`['\"]${room}['\"]`), `Ledger routing is missing ${room}`);
}

const releaseConfig = source('app.json');
assert.match(releaseConfig, /"runtimeVersion"\s*:\s*\{\s*"policy"\s*:\s*"appVersion"/s);

const explicitExclusions = [
  'app/(tabs)/dev-mocks',
  'components/barbell/LoadedSleeve3D.tsx',
  'lib/accessory-picker-artwork.ts',
];

if (releaseProjection) {
  for (const excluded of explicitExclusions) {
    assert.ok(!existsSync(resolve(root, excluded)), `explicit DEV-only scope leaked into the release projection: ${excluded}`);
  }
} else {
  const shippingComposition = [routeScreen, index, routing, source('app/_layout.tsx'), source('app/(tabs)/_layout.tsx')].join('\n');
  assert.doesNotMatch(shippingComposition, /LoadedSleeve3D|accessory-picker-artwork/, 'DEV-only renderer or picker code must not enter shipping composition');
}

console.log('[testflight-source-parity] canonical Ledger routes, components, assets, runtime, and explicit exclusions passed');
