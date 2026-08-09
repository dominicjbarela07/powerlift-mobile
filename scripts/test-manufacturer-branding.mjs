import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MANUFACTURER_REGISTRY,
  resolveManufacturerBrand,
} from '../lib/manufacturer-registry.ts';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDirectory, '..');
const assetRoot = path.join(mobileRoot, 'assets/images/manufacturer-logos');
const assetRegistrySource = fs.readFileSync(
  path.join(mobileRoot, 'lib/manufacturer-logo-assets.ts'),
  'utf8',
);
const workoutLoggerSource = fs.readFileSync(
  path.join(mobileRoot, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(assetRoot, 'source-manifest.json'), 'utf8'),
);

const requiredManufacturers = [
  'hammer-strength',
  'life-fitness',
  'prime-fitness',
  'arsenal-strength',
  'rogers-athletic',
  'technogym',
  'atlantis',
  'panatta',
  'cybex',
  'matrix',
  'nautilus',
  'precor',
  'hoist',
  'legend-fitness',
  'rogue',
  'sorinex',
  'elitefts',
  'strive',
  'nebula',
  'bodymasters',
];

const registryKeys = new Set(MANUFACTURER_REGISTRY.map((entry) => entry.key));
for (const requiredKey of requiredManufacturers) {
  assert.ok(registryKeys.has(requiredKey), `Missing required manufacturer: ${requiredKey}`);
}
assert.equal(registryKeys.size, MANUFACTURER_REGISTRY.length, 'Manufacturer keys must be unique');

const manifestByKey = new Map(manifest.assets.map((entry) => [entry.key, entry]));
assert.deepEqual(
  new Set(manifestByKey.keys()),
  registryKeys,
  'The provenance manifest and runtime registry must have identical coverage',
);

for (const entry of MANUFACTURER_REGISTRY) {
  const manifestEntry = manifestByKey.get(entry.key);
  assert.ok(manifestEntry, `Missing provenance entry: ${entry.key}`);

  if (!entry.logoAssetKey) {
    assert.equal(manifestEntry.status, 'fallback', `${entry.key} must document its fallback`);
    assert.ok(manifestEntry.reason, `${entry.key} fallback must include a reason`);
    continue;
  }

  assert.ok(
    manifestEntry.status === 'official' || manifestEntry.status === 'provided',
    `${entry.key} must document either an official or user-provided local source`,
  );
  assert.equal(manifestEntry.runtimeFile, `runtime/${entry.logoAssetKey}.png`);
  const runtimePath = path.join(assetRoot, manifestEntry.runtimeFile);
  const sourcePath = path.join(assetRoot, manifestEntry.sourceFile);
  assert.ok(fs.existsSync(runtimePath), `Missing runtime logo: ${runtimePath}`);
  assert.ok(fs.existsSync(sourcePath), `Missing retained source logo: ${sourcePath}`);
  assert.match(
    assetRegistrySource,
    new RegExp(`['"]?${entry.logoAssetKey}['"]?\\s*:`),
    `Missing Metro asset mapping: ${entry.logoAssetKey}`,
  );

  const png = fs.readFileSync(runtimePath);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', `${entry.key} runtime asset must be PNG`);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25];
  assert.ok(width >= 200 && height >= 30, `${entry.key} runtime asset is unexpectedly small`);
  assert.ok(colorType === 4 || colorType === 6, `${entry.key} runtime asset must preserve alpha`);
}

const resolutionCases = [
  ['Hammer Strength', 'hammer-strength'],
  ['PRIME', 'prime-fitness'],
  ['Prime Fitness USA', 'prime-fitness'],
  ['Rogers Athletic Pendulum Five-Handle High Row', 'rogers-athletic'],
  ['Arsenal Strength Reloaded', 'arsenal-strength'],
  ['Body Masters', 'bodymasters'],
  ['Elite FTS', 'elitefts'],
  ['Free Motion Fitness', 'freemotion'],
  ['Newtech Strength Equipment', 'newtech'],
];
for (const [input, expectedKey] of resolutionCases) {
  assert.equal(resolveManufacturerBrand(input).key, expectedKey, `Failed alias: ${input}`);
}

for (const manufacturer of [
  'Technogym',
  'Cybex',
  'Bodymasters',
  'FreeMotion',
  'gym80',
  'Nebula',
  'Newtech',
  'SportsArt',
  'Torque Fitness',
]) {
  assert.equal(
    resolveManufacturerBrand(manufacturer).logoSurface,
    'light',
    `${manufacturer} requires a light logo surface`,
  );
}
for (const manufacturer of ['Atlantis', 'Matrix', 'Nautilus', 'Panatta']) {
  assert.equal(
    resolveManufacturerBrand(manufacturer).logoSurface,
    'dark',
    `${manufacturer} should remain on the standard dark logo surface`,
  );
}

const unknown = resolveManufacturerBrand('Custom Fabrication Co.');
assert.equal(unknown.key, null);
assert.equal(unknown.displayName, 'Custom Fabrication Co.');
assert.equal(unknown.usesFallback, true);

assert.match(
  workoutLoggerSource,
  /manufacturerName=\{exactManufacturerName\}/,
  'Exact machine history must use the canonical manufacturer brand mark',
);
assert.match(
  workoutLoggerSource,
  /manufacturerName=\{row\.manufacturer\}/,
  'Related machine history must use each row manufacturer',
);

const localLogoCount = MANUFACTURER_REGISTRY.filter((entry) => entry.logoAssetKey).length;
const fallbackCount = MANUFACTURER_REGISTRY.length - localLogoCount;
console.log(
  `manufacturer branding tests passed (${MANUFACTURER_REGISTRY.length} manufacturers, `
  + `${localLogoCount} local logos, ${fallbackCount} labeled fallbacks)`,
);
