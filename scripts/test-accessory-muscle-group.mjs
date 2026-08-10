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

assert.equal(
  accessoryMuscleRegion({
    movement: 'Misleading Shoulder Press',
    movement_identity: { family: 'row', family_display_name: 'Row' },
  }).key,
  'upper_back',
  'Governed identity must win over legacy movement copy.',
);
assert.equal(accessoryMuscleRegion({ movement: 'Machine Shoulder Press' }).key, 'shoulders');
assert.equal(accessoryMuscleRegion({ movement: 'Reverse Hyperextension' }).key, 'lower_back');
assert.equal(accessoryMuscleRegion({ movement: 'Seated Calf Raise' }).key, 'calves');
assert.equal(accessoryMuscleRegion({ movement: 'Unresolved Custom Movement' }).key, 'full_body');

assert.deepEqual(
  combineAccessoryMuscleRegions(['biceps', 'triceps']),
  { key: 'arms', label: 'Arms' },
  'Related arm movements must use the combined Arms diagram.',
);
assert.equal(combineAccessoryMuscleRegions(['chest', 'chest']).key, 'chest');
assert.equal(combineAccessoryMuscleRegions(['lats', 'quads']).key, 'full_body');
assert.equal(combineAccessoryMuscleRegions(['shoulders', 'shoulders', 'triceps']).key, 'shoulders');

console.log('Accessory muscle-region resolver tests passed.');
