import assert from 'node:assert/strict';
import {
  accessoryMuscleRegion,
  combineAccessoryMuscleRegions,
} from '../lib/accessory-muscle-group.ts';

const governed = (family, movement = 'Legacy display copy') => accessoryMuscleRegion({
  movement,
  movement_identity: { family },
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
    movement_identity: { family: 'row', family_display_name: 'Row' },
  }).key,
  'upper_back',
  'Governed identity must win over legacy movement copy.',
);
assert.equal(accessoryMuscleRegion({ movement: 'Machine Shoulder Press' }).key, 'shoulders');
assert.equal(accessoryMuscleRegion({ movement: 'Cable Front Raise' }).key, 'front_delts');
assert.equal(accessoryMuscleRegion({ movement: 'Dumbbell Lateral Raise' }).key, 'side_delts');
assert.equal(accessoryMuscleRegion({ movement: 'Reverse Pec Deck Rear Delt' }).key, 'rear_delts');
assert.equal(accessoryMuscleRegion({ movement: 'Dumbbell Shrug' }).key, 'traps');
assert.equal(accessoryMuscleRegion({ movement: 'Cable External Rotation' }).key, 'rotator_cuff');
assert.equal(accessoryMuscleRegion({ movement: 'Reverse Hyperextension' }).key, 'lower_back');
assert.equal(accessoryMuscleRegion({ movement: 'Seated Calf Raise' }).key, 'calves');
assert.equal(accessoryMuscleRegion({ movement: 'Hip Abductor Machine' }).key, 'abductors');
assert.equal(accessoryMuscleRegion({ movement: 'Hip Adductor Machine' }).key, 'adductors');
assert.equal(accessoryMuscleRegion({ movement: 'Standing Hip Flexor March' }).key, 'hip_flexors');
assert.equal(accessoryMuscleRegion({ movement: 'Cable Oblique Crunch' }).key, 'obliques');
assert.equal(accessoryMuscleRegion({ movement: 'Cable Abdominal Crunch' }).key, 'abs');
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
