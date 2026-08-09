import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  equipmentPresentationLabel,
  equipmentPresentationParts,
  isKnownEquipmentPresentationValue,
} from '../lib/equipment-presentation.ts';

const requiredClassifications = {
  plate_loaded_machine: 'Plate Loaded',
  selectorized_machine: 'Selectorized',
  smith_machine: 'Smith Machine',
  cable_machine: 'Cable Machine',
  lever_machine: 'Lever Machine',
};

for (const [identifier, label] of Object.entries(requiredClassifications)) {
  assert.equal(equipmentPresentationLabel(identifier), label);
  assert.equal(isKnownEquipmentPresentationValue(identifier), true);
  assert.equal(label.includes('_'), false);
}

const workspaceOptions = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other',
  'free_weight', 'selectorized_machine', 'plate_loaded_machine', 'cable_stack', 'unknown',
  'total_external_load', 'per_hand', 'machine_stack_display', 'bodyweight_only',
  'added_bodyweight', 'assistance_load', 'no_external_load', 'load_reps',
  'bodyweight_reps', 'added_weight_reps', 'assisted_reps', 'duration',
  'bilateral', 'unilateral', 'alternating',
];

for (const identifier of workspaceOptions) {
  const label = equipmentPresentationLabel(identifier, 'Option');
  assert.equal(isKnownEquipmentPresentationValue(identifier), true, `${identifier} needs canonical copy`);
  assert.equal(label.includes('_'), false, `${identifier} must not leak into presentation`);
  assert.notEqual(label, identifier, `${identifier} must pass through product copy`);
}

assert.equal(
  equipmentPresentationLabel('future_internal_equipment_code', 'Machine'),
  'Machine',
  'unmapped identifier-shaped values must fail closed to safe copy',
);
assert.equal(
  equipmentPresentationLabel('futurevalue', 'Equipment'),
  'Equipment',
  'unmapped single-token enum values must fail closed to safe copy',
);
assert.equal(equipmentPresentationLabel('Hammer Strength'), 'Hammer Strength');
assert.deepEqual(
  equipmentPresentationParts('Newtech · plate_loaded_machine'),
  ['Newtech', 'Plate Loaded'],
);

const loggerSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/session-workspace/[workoutId].tsx'),
  'utf8',
);

assert.match(loggerSource, /equipmentPresentationParts\(value, 'Machine'\)/);
assert.match(loggerSource, /equipmentPresentationLabel\(currentEquipmentVariant, 'Machine'\)/);
assert.match(loggerSource, /equipmentPresentationLabel\(historyIdentity\?\.equipment_type, 'Machine'\)/);
assert.doesNotMatch(loggerSource, /\[currentManufacturer \|\| 'Other', currentEquipmentVariant\]/);
assert.doesNotMatch(loggerSource, /historyIdentity\?\.equipment_type \|\| 'Machine'/);
assert.match(workspaceSource, /equipmentPresentationLabel\(option, 'Option'\)/);
assert.doesNotMatch(workspaceSource, /function humanOption/);

console.log('Equipment presentation mapping and shipping-surface checks passed.');
