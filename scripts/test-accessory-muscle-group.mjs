import assert from 'node:assert/strict';
import {
  accessoryMuscleRegion,
  combineAccessoryMuscleRegions,
} from '../lib/accessory-muscle-group.ts';

const governed = (family, movement = 'Legacy display copy') => accessoryMuscleRegion({
  movement,
  movement_identity: { id: 100, family },
}).key;

assert.equal(governed('shoulders'), 'shoulders');
assert.equal(governed('biceps'), 'biceps');
assert.equal(governed('triceps'), 'triceps');
assert.equal(governed('vertical_pull'), 'lats');
assert.equal(governed('row'), 'upper_back');
assert.equal(governed('bench'), 'chest');
assert.equal(governed('squat'), 'quads');
assert.equal(governed('deadlift'), 'hamstrings');
assert.equal(governed('glutes'), 'glutes');
assert.equal(governed('adductors'), 'adductors');
assert.equal(governed('front_delts_pressing'), 'front_delts');
assert.equal(governed('side_delts'), 'side_delts');
assert.equal(governed('rear_delts_upper_back'), 'rear_delts');
assert.equal(governed('traps'), 'traps');
assert.equal(governed('rotator_cuff_rehab'), 'rotator_cuff');
assert.equal(governed('abductors'), 'abductors');
assert.equal(governed('hip_flexors'), 'hip_flexors');

assert.equal(
  accessoryMuscleRegion({
    movement: 'Misleading Shoulder Press',
    movement_identity: { id: 101, family: 'row', family_display_name: 'Row' },
  }).key,
  'upper_back',
  'Governed identity must win over legacy movement copy.',
);
for (const movement of [
  'Machine Shoulder Press', 'Cable Front Raise', 'Dumbbell Lateral Raise',
  'Reverse Pec Deck Rear Delt', 'Dumbbell Shrug', 'Cable External Rotation',
  'Reverse Hyperextension', 'Seated Calf Raise', 'Hip Abductor Machine',
  'Hip Adductor Machine', 'Standing Hip Flexor March',
  'Cable Oblique Crunch', 'Cable Abdominal Crunch',
]) {
  assert.equal(accessoryMuscleRegion({ movement }).key, 'full_body');
}
assert.equal(accessoryMuscleRegion({ movement: 'Unresolved Custom Movement' }).key, 'full_body');

assert.deepEqual(
  combineAccessoryMuscleRegions(['biceps', 'triceps']),
  { key: 'arms', label: 'Arms' },
  'Related arm movements must use the combined Arms diagram.',
);
assert.equal(combineAccessoryMuscleRegions(['chest', 'chest']).key, 'chest');
assert.equal(combineAccessoryMuscleRegions(['lats', 'quads']).key, 'full_body');
assert.equal(combineAccessoryMuscleRegions(['shoulders', 'shoulders', 'triceps']).key, 'shoulders');
assert.equal(combineAccessoryMuscleRegions(['front_delts', 'rear_delts']).key, 'shoulders');
assert.equal(combineAccessoryMuscleRegions(['abs', 'obliques']).key, 'core');

console.log('Accessory muscle-region resolver tests passed.');
