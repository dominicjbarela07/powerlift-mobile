import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { accessoryMuscleRegion } from '../lib/accessory-muscle-group.ts';

const root = path.resolve(import.meta.dirname, '..');
const assetRoot = path.join(root, 'assets/images/muscle-regions');
const registryPath = path.join(root, 'lib/accessory-muscle-region-assets.ts');
const medallionPath = path.join(root, 'components/workout-logger/accessory-muscle-region-medallion.tsx');
const coreLoggerPath = path.join(root, 'components/workout-logger/core-loggers.tsx');
const supersetPath = path.join(root, 'components/workout-logger/superset-round-workspace.tsx');
const pickerArtworkPath = path.join(root, 'lib/accessory-picker-artwork.ts');

const expectedFiles = [
  'chest.png',
  'shoulders.png',
  'front-delts.png',
  'side-delts.png',
  'rear-delts.png',
  'biceps.png',
  'triceps.png',
  'forearms.png',
  'arms.png',
  'lats.png',
  'upper-back.png',
  'traps.png',
  'rotator-cuff.png',
  'lower-back.png',
  'core.png',
  'abs.png',
  'obliques.png',
  'quads.png',
  'hamstrings.png',
  'glutes.png',
  'adductors.png',
  'abductors.png',
  'hip-flexors.png',
  'calves.png',
  'full-body.png',
];
const regionalNavigationFiles = ['back-region.png'];
const allExpectedFiles = [...expectedFiles, ...regionalNavigationFiles];

const runtimeFiles = fs.readdirSync(assetRoot).filter((file) => file.endsWith('.png')).sort();
assert.deepEqual(runtimeFiles, [...allExpectedFiles].sort(), 'Only the complete governed and regional runtime asset set may ship.');

const registry = fs.readFileSync(registryPath, 'utf8');
for (const file of allExpectedFiles) {
  assert.match(registry, new RegExp(`require\\(['\"]\\.\\./assets/images/muscle-regions/${file.replace('.', '\\.')}['\"]\\)`));
  const contents = fs.readFileSync(path.join(assetRoot, file));
  assert.equal(contents.readUInt32BE(16), 256, `${file} must use the canonical 256px canvas width.`);
  assert.equal(contents.readUInt32BE(20), 256, `${file} must use the canonical 256px canvas height.`);
  assert.equal(contents[25], 6, `${file} must be RGBA so its background remains transparent.`);
}
assert.equal((registry.match(/require\(/g) || []).length, allExpectedFiles.length + 2);
assert.match(registry, /serratus:[\s\S]*muscle-regions\/chest\.png/);
assert.match(registry, /neck:[\s\S]*muscle-regions\/traps\.png/);
assert.match(registry, /back_region:[\s\S]*muscle-regions\/back-region\.png/);
assert.match(registry, /accessoryRegionalArtworkAsset/);
assert.match(registry, /lats:[\s\S]*muscle-regions\/lats\.png/);

const medallion = fs.readFileSync(medallionPath, 'utf8');
const coreLogger = fs.readFileSync(coreLoggerPath, 'utf8');
const superset = fs.readFileSync(supersetPath, 'utf8');
const pickerArtwork = fs.readFileSync(pickerArtworkPath, 'utf8');
assert.match(medallion, /accessoryMuscleRegionAsset\(regionKey\)/);
assert.match(medallion, /<Image[\s\S]*?source=\{asset\.source\}/);
assert.doesNotMatch(medallion, /MuscleMap|isGovernedMuscleId/, 'Logger movement cards must use muscle-group PNG assets, never the full-body anatomy renderer.');
assert.doesNotMatch(medallion, /<Text/);
assert.match(coreLogger, /<AccessoryMuscleRegionMedallion/);
assert.match(superset, /<AccessoryMuscleRegionMedallion/);
assert.doesNotMatch(coreLogger, /activeMovementMuscleGroupText|accessoryMuscleGroupLabel/);
assert.doesNotMatch(superset, /muscleGroupBadgeText|primaryMuscleGroup/);
assert.match(pickerArtwork, /EXACT_MOVEMENT_ARTWORK/);
assert.match(pickerArtwork, /if \(exact\) return \{ kind: 'movement', source: exact \}/);
assert.match(pickerArtwork, /accessoryMuscleRegionAsset\(region\)\.source/);
assert.equal((pickerArtwork.match(/require\(/g) || []).length, 0, 'picker fallback must reuse the shared asset registry');

assert.deepEqual(
  accessoryMuscleRegion({
    movement: 'Machine Chest Supported Row',
    legacy: {
      effective_movement_identity: {
        primary_muscle_group: 'upper_back',
        family: 'row',
      },
    },
  }),
  { key: 'upper_back', label: 'Upper back' },
  'resolved legacy identity must outrank misleading raw-label words such as “chest supported”',
);
assert.deepEqual(
  accessoryMuscleRegion({
    movement: 'Machine Chest Supported Row',
    movement_identity: { primary_muscle_group: 'upper_back' },
  }),
  { key: 'upper_back', label: 'Upper back' },
  'programmed governed identity must outrank legacy text',
);
assert.deepEqual(
  accessoryMuscleRegion({ movement: 'Machine Chest Supported Row' }),
  { key: 'upper_back', label: 'Upper back' },
  'even genuinely unresolved row copy must not be misclassified as chest',
);

console.log('Accessory muscle-region runtime asset tests passed.');
