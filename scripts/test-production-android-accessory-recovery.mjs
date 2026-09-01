import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activeEquipmentIdentity,
  needsEquipmentSelection,
} from '../lib/equipment-selection.ts';

const broadMachine = {
  id: 1,
  movement_identity: {
    id: 101,
    key: 'machine_lat_pulldown_broad',
    display_name: 'Machine Lat Pulldown',
    identity_specificity: 'broad',
    equipment_type: 'machine',
  },
};
assert.equal(needsEquipmentSelection(broadMachine), true);
assert.equal(activeEquipmentIdentity(broadMachine), null);

const configuredMachine = {
  ...broadMachine,
  performed_movement_identity: {
    id: 102,
    key: 'hammer_strength_lat_pulldown_plate_loaded',
    display_name: 'Hammer Strength Lat Pulldown — Plate Loaded',
    identity_specificity: 'exact',
    equipment_type: 'plate_loaded_machine',
    loading_implementation: 'plate loaded',
    implementation_key: 'hammer_strength:plate_loaded',
    manufacturer: { id: 10, key: 'hammer_strength', display_name: 'Hammer Strength' },
    equipment_context: { option_kind: 'catalog' },
  },
};
assert.equal(needsEquipmentSelection(configuredMachine), false);
assert.equal(activeEquipmentIdentity(configuredMachine)?.implementation_key, 'hammer_strength:plate_loaded');

const freeWeight = {
  id: 2,
  movement_identity: {
    id: 201,
    key: 'dumbbell_curl',
    display_name: 'Dumbbell Curl',
    identity_specificity: 'exact',
    equipment_type: 'dumbbell',
  },
};
assert.equal(needsEquipmentSelection(freeWeight), false);

const customPortable = {
  id: 3,
  movement_identity: {
    id: 301,
    key: 'athlete_custom_band_pressdown',
    display_name: 'My Band Pressdown',
    identity_specificity: 'exact',
    equipment_type: 'band',
  },
};
assert.equal(needsEquipmentSelection(customPortable), false);

const logger = readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');
assert.match(
  logger,
  /const openAccessoryWheel = \(item: WorkoutItem, skipEquipmentGate = false\) => \{[\s\S]*?needsEquipmentSelection\(item\)[\s\S]*?openEquipmentPicker\(item, \{ kind: 'accessory_set'/,
  'Log Set must open exact equipment selection before the accessory wheel.',
);
assert.match(
  logger,
  /manufacturer_key:[\s\S]*?equipment_type:[\s\S]*?requestAnimationFrame\(\(\) => openAccessoryWheel\(nextItem, true\)\)/,
  'Manufacturer + machine type selection must persist and resume logging.',
);
assert.match(logger, /actual_rir:\s*rir \?\? undefined/, '0 RIR must survive nullish payload construction.');
assert.match(logger, /reps < 0/, 'Zero-rep failed-set evidence must remain valid.');
assert.doesNotMatch(logger, /reps <= 0/, 'The recovery must not reject zero-rep evidence.');
assert.match(logger, /client_submission_id:\s*clientSubmissionId/, 'Set submissions must be retry-safe.');
assert.match(
  logger,
  /const json = await logAccessorySet\([\s\S]*?await fetchWorkout\(\)/,
  'Persisted accessory SetLogs must refresh the visible Session state.',
);
assert.match(logger, /workout\.accessory_groups\.map/, 'Straight and grouped accessories must share refreshed item state.');

console.log('production Android accessory recovery contract: PASS');
