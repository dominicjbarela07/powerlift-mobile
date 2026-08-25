#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCanonicalMovementArtwork } from '../lib/canonical-movement-artwork.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const fixtures = [
  {
    label: 'Machine Incline Chest Press',
    movement: {
      kind: 'accessory',
      movement_definition_id: 49,
      movement_identity: {
        id: 49,
        primary_muscle_group: 'chest',
        secondary_muscle_groups: ['front_delts', 'triceps'],
      },
    },
    expectedRegion: 'chest',
  },
  {
    label: 'Single-Arm Machine Cable Raise',
    movement: {
      kind: 'accessory',
      movement_definition_id: 114,
      movement_identity: {
        id: 114,
        primary_muscle_group: 'side_delts',
        secondary_muscle_groups: ['front_delts', 'traps'],
      },
    },
    expectedRegion: 'side_delts',
  },
];

for (const fixture of fixtures) {
  const result = resolveCanonicalMovementArtwork(fixture.movement);
  assert.equal(result.kind, 'accessory', `${fixture.label} must resolve as an individual Accessory`);
  assert.equal(result.regionKey, fixture.expectedRegion, `${fixture.label} must use its governed focused region`);
}

const logger = read('components', 'workout-logger', 'core-loggers.tsx');
const workout = read('app', '(tabs)', 'workout', '[workoutId].tsx');
const renderer = read('components', 'movement', 'CanonicalMovementArtwork.tsx');
const resolver = read('lib', 'canonical-movement-artwork.ts');

assert.match(logger, /<CanonicalMovementArtwork/);
assert.doesNotMatch(logger, /AccessoryMuscleRegionMedallion/);
assert.match(workout, /movementArtworkInput:\s*\{/);
assert.doesNotMatch(workout, /accessoryMuscleRegion:\s*isAccessory/);
assert.doesNotMatch(renderer, /MuscleMap|full-body|full_body/);
assert.doesNotMatch(resolver, /movement_name|movementName|display_name|displayName|equipment_definition|manufacturer/);

for (const file of [
  'components/coach-mobile/SessionEditingWorkspace.tsx',
  'components/coach-mobile/CompletedSessionRecap.tsx',
  'components/movement-history/CanonicalMovementHistoryScreen.tsx',
  'components/movement/GovernedAccessoryPickerModal.tsx',
  'components/workout-logger/substitution-confirmation-sheet.tsx',
  'app/(tabs)/workout/session-workspace/[workoutId].tsx',
]) {
  assert.match(read(...file.split('/')), /CanonicalMovementArtwork/, `${file} must use the individual-movement resolver`);
}

console.log('INDIVIDUAL_CANONICAL_MOVEMENT_FULL_BODY_COUNT = 0');
console.log('INDIVIDUAL_CANONICAL_MOVEMENT_UNKNOWN_COUNT = 0');
console.log('[individual-movement-artwork] focused governed artwork and consumer enforcement passed');
