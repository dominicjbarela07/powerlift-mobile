import assert from 'node:assert/strict';
import { accessoryPrimaryMuscleGroup } from '../lib/accessory-muscle-group.ts';

assert.equal(accessoryPrimaryMuscleGroup({ movement: 'Machine Shoulder Press' }), 'Shoulders');
assert.equal(accessoryPrimaryMuscleGroup({ movement: 'Barbell Row' }), 'Back');
assert.equal(accessoryPrimaryMuscleGroup({ movement: 'Leg Extension' }), 'Quads');
assert.equal(accessoryPrimaryMuscleGroup({ movement: 'Unknown Movement' }), 'Accessory');
assert.equal(accessoryPrimaryMuscleGroup({
  movement: 'Custom Movement',
  movement_identity: { family: 'incline_press', family_display_name: 'Incline Press' },
}), 'Chest');

console.log('[accessory-muscle-group] governed-family and legacy-name labels passed');
