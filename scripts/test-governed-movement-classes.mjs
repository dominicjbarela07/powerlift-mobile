import assert from 'node:assert/strict';
import { coreFamilyLabel, governedCoreChoices, governedCoreClass, MOVEMENT_CLASS_OPTIONS } from '../lib/governed-movement-classes.ts';

const families = ['squat', 'bench', 'deadlift', 'press'];
const rows = [
  ...families.slice(0, 3).map((family, index) => ({
    id: index + 1, core_movement_id: index + 1, display_name: `Competition ${family}`,
    lift: ['SQ', 'BN', 'DL'][index], core_movement_kind: 'competition', core_movement_family: family,
    movement_definition_id: index + 1001,
  })),
  ...Array.from({ length: 240 }, (_, index) => ({
    id: index + 4, core_movement_id: index + 4, display_name: `Variant ${index}`,
    lift: 'VR', core_movement_kind: 'variant', core_movement_family: families[index % families.length],
    movement_definition_id: index + 1004,
  })),
];
const choices = governedCoreChoices([{ movements: rows }, { movements: [rows[0]] }]);
assert.equal(choices.length, rows.filter(row => row.core_movement_family !== 'press').length,
  'canonical IDs deduplicate while the retired Pressing family is excluded');
assert.deepEqual(MOVEMENT_CLASS_OPTIONS.map(option => option.label), ['CORE', 'VARIANTS', 'ACCESSORIES']);
assert.equal(choices.filter(row => governedCoreClass(row) === 'core').length, 3);
assert.equal(choices.filter(row => governedCoreClass(row) === 'variant').length, 180);
assert.equal(choices.find(row => row.id === 242).movement_definition_id, 1242);
assert.equal(coreFamilyLabel('bench'), 'Competition Bench');
assert.ok(!choices.some(row => row.core_movement_family === 'press'));
const overheadPress = governedCoreChoices([{ movements: [{
  id: 62, core_movement_id: 62, display_name: 'Barbell Overhead Press', lift: 'VR',
  core_movement_kind: 'variant', core_movement_family: 'bench', movement_definition_id: 1062,
}] }]);
assert.deepEqual(overheadPress.map(row => [row.id, row.core_movement_family, row.movement_definition_id]), [[62, 'bench', 1062]]);
assert.equal(overheadPress.filter(row => row.display_name.toLowerCase().includes('barbell overhead press')).length, 1);
assert.deepEqual(governedCoreChoices([{ movements: [{ id: 999, name: 'Competition Squat', lift: 'SQ' }] }]), [],
  'a familiar name cannot classify a row without canonical backend kind');
console.log('[governed-movement-classes] Squat, Bench, and Deadlift governed rows retain class and numeric identity; Pressing is excluded');
