import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const assetRoot = path.join(root, 'assets/images/muscle-regions');
const registryPath = path.join(root, 'lib/accessory-muscle-region-assets.ts');
const medallionPath = path.join(root, 'components/workout-logger/accessory-muscle-region-medallion.tsx');
const coreLoggerPath = path.join(root, 'components/workout-logger/core-loggers.tsx');
const supersetPath = path.join(root, 'components/workout-logger/superset-round-workspace.tsx');

const expectedFiles = [
  'chest.png',
  'shoulders.png',
  'biceps.png',
  'triceps.png',
  'forearms.png',
  'lats.png',
  'upper-back.png',
  'lower-back.png',
  'core.png',
  'quads.png',
  'hamstrings.png',
  'glutes.png',
  'adductors.png',
  'calves.png',
  'arms.png',
  'full-body.png',
];

const runtimeFiles = fs.readdirSync(assetRoot).filter((file) => file.endsWith('.png')).sort();
assert.deepEqual(runtimeFiles, [...expectedFiles].sort(), 'Only the complete canonical runtime asset set may ship.');

const registry = fs.readFileSync(registryPath, 'utf8');
for (const file of expectedFiles) {
  assert.match(registry, new RegExp(`require\\(['\"]\\.\\./assets/images/muscle-regions/${file.replace('.', '\\.')}['\"]\\)`));
  const contents = fs.readFileSync(path.join(assetRoot, file));
  assert.equal(contents.readUInt32BE(16), 256, `${file} must use the canonical 256px canvas width.`);
  assert.equal(contents.readUInt32BE(20), 256, `${file} must use the canonical 256px canvas height.`);
  assert.equal(contents[25], 6, `${file} must be RGBA so its background remains transparent.`);
}
assert.equal((registry.match(/require\(/g) || []).length, expectedFiles.length);

const medallion = fs.readFileSync(medallionPath, 'utf8');
const coreLogger = fs.readFileSync(coreLoggerPath, 'utf8');
const superset = fs.readFileSync(supersetPath, 'utf8');
assert.match(medallion, /accessoryMuscleRegionAsset\(regionKey\)/);
assert.match(medallion, /<Image[\s\S]*?source=\{asset\.source\}/);
assert.doesNotMatch(medallion, /<Text/);
assert.match(coreLogger, /<AccessoryMuscleRegionMedallion/);
assert.match(superset, /<AccessoryMuscleRegionMedallion/);
assert.doesNotMatch(coreLogger, /activeMovementMuscleGroupText|accessoryMuscleGroupLabel/);
assert.doesNotMatch(superset, /muscleGroupBadgeText|primaryMuscleGroup/);

console.log('Accessory muscle-region runtime asset tests passed.');
