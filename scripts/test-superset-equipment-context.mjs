import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  activeEquipmentIdentity,
  activeEquipmentPresentation,
  equipmentSnapshotForSet,
  needsEquipmentSelection,
} from '../lib/equipment-selection.ts';

const identity = ({
  id,
  manufacturer,
  equipmentType,
  implementation = equipmentType,
  optionKind = 'catalog',
  customManufacturer = null,
}) => ({
  id,
  key: `equipment:${id}`,
  display_name: `${manufacturer || customManufacturer || 'Equipment'} · ${equipmentType}`,
  identity_specificity: 'exact',
  equipment_type: equipmentType,
  loading_implementation: implementation,
  implementation_key: `equipment:${id}`,
  manufacturer: manufacturer
    ? { id: id + 1000, key: manufacturer.toLowerCase().replaceAll(' ', '-'), display_name: manufacturer }
    : null,
  material_parameters: customManufacturer
    ? { custom_manufacturer_name: customManufacturer }
    : null,
  equipment_context: { option_kind: optionKind },
});

const machineItem = ({ id, movement, equipment, programmedEquipment = equipment, logs = [] }) => ({
  id,
  movement,
  movement_identity: programmedEquipment,
  performed_movement_identity: equipment,
  set_logs: logs,
});

const prime = machineItem({
  id: 1,
  movement: 'Machine Chest Press',
  equipment: identity({ id: 101, manufacturer: 'Prime Fitness', equipmentType: 'selectorized' }),
});
const hammer = machineItem({
  id: 2,
  movement: 'Machine Row',
  equipment: identity({ id: 102, manufacturer: 'Hammer Strength', equipmentType: 'plate_loaded' }),
});
const freeMotion = machineItem({
  id: 3,
  movement: 'Cable Fly',
  equipment: identity({ id: 103, manufacturer: 'FreeMotion', equipmentType: 'cable' }),
});
const dumbbell = {
  id: 4,
  movement: 'Dumbbell Curl',
  movement_identity: identity({ id: 104, manufacturer: null, equipmentType: 'dumbbell' }),
  performed_movement_identity: null,
  set_logs: [],
};
const barbell = {
  id: 5,
  movement: 'Barbell Row',
  movement_identity: identity({ id: 105, manufacturer: null, equipmentType: 'barbell' }),
  performed_movement_identity: null,
  set_logs: [],
};

assert.equal(activeEquipmentPresentation(prime)?.contextLabel, 'Prime Fitness · Selectorized');
assert.equal(activeEquipmentPresentation(hammer)?.contextLabel, 'Hammer Strength · Plate Loaded');
assert.equal(activeEquipmentPresentation(freeMotion)?.contextLabel, 'FreeMotion · Cable');
assert.deepEqual(
  [prime, hammer].map((item) => activeEquipmentPresentation(item)?.contextLabel),
  ['Prime Fitness · Selectorized', 'Hammer Strength · Plate Loaded'],
  'Two machine movements in one superset must retain independent brand context.',
);
assert.deepEqual(
  [prime, dumbbell].map((item) => activeEquipmentPresentation(item)?.contextLabel || null),
  ['Prime Fitness · Selectorized', null],
  'Portable free weights must not receive machine metadata.',
);
assert.deepEqual(
  [freeMotion, hammer].map((item) => activeEquipmentPresentation(item)?.contextLabel),
  ['FreeMotion · Cable', 'Hammer Strength · Plate Loaded'],
);
assert.deepEqual(
  [dumbbell, barbell].map((item) => activeEquipmentPresentation(item)?.contextLabel || null),
  [null, null],
);

const missingManufacturer = machineItem({
  id: 6,
  movement: 'Leg Extension',
  equipment: identity({ id: 106, manufacturer: null, equipmentType: 'selectorized' }),
});
assert.equal(activeEquipmentIdentity(missingManufacturer)?.id, 106);
assert.equal(activeEquipmentPresentation(missingManufacturer), null);
assert.equal(needsEquipmentSelection(missingManufacturer), false);

const unresolvedEquipment = {
  id: 61,
  movement: 'Leg Extension',
  movement_identity: {
    ...identity({ id: 161, manufacturer: null, equipmentType: 'selectorized' }),
    identity_specificity: 'unknown',
    implementation_key: null,
    equipment_context: { option_kind: 'unknown' },
  },
  performed_movement_identity: null,
  set_logs: [],
};
assert.equal(activeEquipmentPresentation(unresolvedEquipment), null);
assert.equal(
  needsEquipmentSelection(unresolvedEquipment),
  true,
  'An unresolved superset machine must preserve the canonical equipment picker gate.',
);

const customManufacturer = machineItem({
  id: 7,
  movement: 'Hack Squat',
  equipment: identity({
    id: 107,
    manufacturer: null,
    equipmentType: 'plate_loaded',
    optionKind: 'other',
    customManufacturer: 'Arsenal Strength',
  }),
});
assert.equal(
  activeEquipmentPresentation(customManufacturer)?.contextLabel,
  'Arsenal Strength · Plate Loaded',
);

const replacementMachine = machineItem({
  id: 8,
  movement: 'Chest-Supported Machine Row',
  programmedEquipment: prime.performed_movement_identity,
  equipment: hammer.performed_movement_identity,
});
assert.equal(
  activeEquipmentPresentation(replacementMachine)?.contextLabel,
  'Hammer Strength · Plate Loaded',
  'A swap must show the effective performed machine, never the programmed machine.',
);

const machineToPortableSwap = {
  ...replacementMachine,
  movement: 'Chest-Supported Dumbbell Row',
  performed_movement_identity: dumbbell.movement_identity,
};
assert.equal(activeEquipmentPresentation(machineToPortableSwap), null);
assert.equal(needsEquipmentSelection(machineToPortableSwap), false);

const historicalIdentity = prime.performed_movement_identity;
const historicalSnapshot = equipmentSnapshotForSet(historicalIdentity);
assert.deepEqual(historicalSnapshot, {
  performed_movement_definition_id: 101,
  equipment_manufacturer_id: 1101,
  equipment_model_id: null,
  implementation_key_snapshot: 'equipment:101',
  performed_label_snapshot: 'Prime Fitness · selectorized',
  identity_source_snapshot: 'dev_equipment_selection',
});
assert.equal(
  equipmentSnapshotForSet(replacementMachine.performed_movement_identity).equipment_manufacturer_id,
  1102,
);
assert.equal(
  historicalSnapshot.equipment_manufacturer_id,
  1101,
  'Changing current equipment must not rewrite immutable historical SetLog evidence.',
);

const partiallyCompleted = {
  ...prime,
  set_logs: [{
    id: 501,
    set_index: 1,
    equipment_manufacturer_id: historicalSnapshot.equipment_manufacturer_id,
  }],
};
assert.equal(
  activeEquipmentPresentation(partiallyCompleted)?.contextLabel,
  'Prime Fitness · Selectorized',
  'Partial completion must not hide current equipment context.',
);
const restoredFromSessionPayload = JSON.parse(JSON.stringify(partiallyCompleted));
assert.equal(
  activeEquipmentPresentation(restoredFromSessionPayload)?.contextLabel,
  'Prime Fitness · Selectorized',
  'Session reopen/restoration must reproduce the same context from serialized canonical identity.',
);
assert.equal(restoredFromSessionPayload.set_logs[0].equipment_manufacturer_id, 1101);

const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/superset-round-workspace.tsx'),
  'utf8',
);

assert.match(
  routeSource,
  /const equipmentPresentation = activeEquipmentPresentation\(executionItem\);[\s\S]*equipmentContext: equipmentPresentation\?\.contextLabel \|\| null/,
  'The canonical superset mapping must resolve equipment from the effective execution item.',
);
assert.match(
  workspaceSource,
  /movement\.item\.equipmentContext[\s\S]*styles\.workEquipmentContext[\s\S]*movement\.item\.prescription/,
  'Superset movement cards must render brand context between name and prescription.',
);
assert.doesNotMatch(
  workspaceSource.match(/<View style=\{styles\.historySection\}>[\s\S]*?<\/View>\s*<\/View>/)?.[0] || '',
  /equipmentContext/,
  'Compact History rows must not label prior performance with current equipment.',
);

console.log('Superset equipment brand context checks passed.');
