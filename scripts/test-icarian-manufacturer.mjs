import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MANUFACTURER_REGISTRY,
  resolveManufacturerBrand,
} from '../lib/manufacturer-registry.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const icarian = MANUFACTURER_REGISTRY.find((entry) => entry.key === 'icarian');

assert.ok(icarian, 'Icarian must exist in the canonical mobile registry');
assert.equal(icarian.displayName, 'Icarian');
assert.equal(icarian.logoAssetKey, 'icarian');
assert.equal(icarian.logoSurface, 'light');
assert.equal(resolveManufacturerBrand('Icarian Fitness').key, 'icarian');
assert.equal(resolveManufacturerBrand('Precor Icarian').key, 'icarian');

const runtime = path.join(root, 'assets/images/manufacturer-logos/runtime/icarian.png');
const source = path.join(root, 'assets/images/manufacturer-logos/source/icarian.png');
const assetRegistry = fs.readFileSync(path.join(root, 'lib/manufacturer-logo-assets.ts'), 'utf8');
const logger = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');

for (const file of [runtime, source]) assert.ok(fs.existsSync(file), `Missing ${file}`);
const png = fs.readFileSync(runtime);
assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
assert.ok(png.readUInt32BE(16) >= 200);
assert.ok(png.readUInt32BE(20) >= 30);
assert.ok([4, 6].includes(png[25]), 'Runtime Icarian artwork must preserve alpha');
assert.match(assetRegistry, /icarian:\s*require\([^)]*runtime\/icarian\.png/);
assert.match(logger, /identityPickerRows\.map[\s\S]*ManufacturerBrandMark/);

console.log('Icarian manufacturer registry, aliases, picker mark, and public logo asset passed.');
