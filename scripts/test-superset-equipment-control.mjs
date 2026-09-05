import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  activeEquipmentIdentity,
  equipmentSelectionStatusLabels,
  equipmentSnapshotForSet,
  equipmentTypeSelectionStatusLabels,
  isMachineAccessoryItem,
} from '../lib/equipment-selection.ts';
import {
  applyWorkoutDetailMachineIdentity,
  hydrateWorkoutDetailEquipmentSelections,
  rememberWorkoutDetailEquipmentSelection,
  resetRememberedWorkoutDetailEquipmentSelections,
} from './fixtures/workout-detail.ts';

const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/superset-round-workspace.tsx'),
  'utf8',
);

const machineIdentity = ({ id, movementId, manufacturer, equipmentType, used }) => ({
  id,
  key: `machine-equipment:${manufacturer.toLowerCase().replaceAll(' ', '-')}:${equipmentType}`,
  display_name: `${manufacturer} · ${equipmentType}`,
  identity_specificity: 'exact',
  equipment_type: equipmentType,
  loading_implementation: equipmentType,
  implementation_key: `machine-equipment:${manufacturer.toLowerCase().replaceAll(' ', '-')}:${equipmentType}`,
  manufacturer: {
    id: id + 1000,
    key: manufacturer.toLowerCase().replaceAll(' ', '-'),
    display_name: manufacturer,
  },
  equipment_context: {
    option_kind: 'catalog',
    usage_status: used ? 'used' : 'not_used',
    used_equipment_type_keys: used ? [equipmentType] : [],
    usage_movement_definition_id: movementId,
  },
});

const machineItem = ({ id, movement, movementId, equipment = null, logs = [] }) => ({
  id,
  movement,
  movement_identity: {
    id: movementId,
    key: `movement:${movementId}`,
    display_name: movement,
    identity_specificity: 'exact',
    equipment_type: 'selectorized_machine',
    loading_implementation: 'machine_stack',
    load_convention: 'machine_stack_display',
  },
  performed_movement_identity: equipment,
  set_logs: logs,
  status: 'in_progress',
  started_at: '2026-09-05T16:00:00Z',
});

const portableItem = {
  id: 3,
  movement: 'Dumbbell Curl',
  movement_identity: {
    id: 203,
    key: 'dumbbell_curl',
    display_name: 'Dumbbell Curl',
    identity_specificity: 'exact',
    equipment_type: 'dumbbell',
    loading_implementation: 'free_weight',
    load_convention: 'per_hand',
  },
  performed_movement_identity: null,
  set_logs: [],
};

const panatta = machineIdentity({
  id: 301,
  movementId: 201,
  manufacturer: 'Panatta',
  equipmentType: 'selectorized',
  used: true,
});
const arsenal = machineIdentity({
  id: 302,
  movementId: 202,
  manufacturer: 'Arsenal Strength',
  equipmentType: 'plate_loaded',
  used: false,
});
const matrix = machineIdentity({
  id: 303,
  movementId: 202,
  manufacturer: 'Matrix',
  equipmentType: 'selectorized',
  used: true,
});
const a1Log = {
  id: 9001,
  set_index: 1,
  equipment_manufacturer_id: panatta.manufacturer.id,
  performed_movement_definition_id: 201,
};
const a1 = machineItem({
  id: 1,
  movement: 'Machine Lateral Raise',
  movementId: 201,
  equipment: panatta,
  logs: [a1Log],
});
const a2Log = {
  id: 9002,
  set_index: 1,
  equipment_manufacturer_id: matrix.manufacturer.id,
  performed_movement_definition_id: matrix.id,
};
const a2 = machineItem({
  id: 2,
  movement: 'Machine Dip',
  movementId: 202,
  equipment: matrix,
  logs: [a2Log],
});

assert.equal(isMachineAccessoryItem(a1), true);
assert.equal(isMachineAccessoryItem(a2), true);
assert.equal(isMachineAccessoryItem(portableItem), false);

assert.match(
  routeSource,
  /canConfigureEquipment:\s*!isCoachAthletePreview\s*&&\s*isMachineAccessoryItem\(item\)/,
  'Standalone and superset controls must share the canonical machine-item gate.',
);
assert.match(
  routeSource,
  /\{machineAccessory \? \([\s\S]*?onPress=\{\(\) => openIdentityPicker\(it\)\}[\s\S]*?>Equipment<\/Text>/,
  'A standalone machine accessory must retain its canonical Equipment action.',
);
assert.match(
  routeSource,
  /onConfigureEquipment=\{\(itemId\)[\s\S]*?grp\.items\.find\([\s\S]*?candidate\.id === itemId[\s\S]*?openIdentityPicker\(item\)/,
  'A superset Equipment tap must open the canonical picker for the exact member WorkoutItem.',
);
assert.match(
  workspaceSource,
  /movement\.item\.canConfigureEquipment[\s\S]*?accessibilityLabel=\{`Configure equipment for \$\{positionLabel\}, \$\{movement\.item\.title\}`\}[\s\S]*?onPress=\{\(\) => onConfigureEquipment\(movement\.itemId\)\}[\s\S]*?>Equipment</,
  'Each configurable superset member must expose its own reachable Equipment action.',
);
assert.doesNotMatch(
  workspaceSource.match(/<Pressable[\s\S]*?accessibilityLabel=\{`Superset \$\{groupLabel\}[\s\S]*?<\/Pressable>/)?.[0] || '',
  /onConfigureEquipment|Equipment/,
  'The whole-superset header must never own an ambiguous equipment action.',
);

const before = {
  workout: {
    id: 77,
    status: 'in_progress',
    started_at: '2026-09-05T16:00:00Z',
    accessory_groups: [{ group: 'A', round_count: 3, items: [a1, a2, portableItem] }],
  },
};
const updatedA2 = applyWorkoutDetailMachineIdentity(a2, arsenal.id, arsenal);
const after = {
  ...before,
  workout: {
    ...before.workout,
    accessory_groups: before.workout.accessory_groups.map((group) => ({
      ...group,
      items: group.items.map((item) => item.id === a2.id ? updatedA2 : item),
    })),
  },
};

assert.equal(activeEquipmentIdentity(after.workout.accessory_groups[0].items[0])?.id, panatta.id);
assert.equal(
  activeEquipmentIdentity(after.workout.accessory_groups[0].items[1])?.manufacturer?.key,
  arsenal.manufacturer.key,
);
assert.equal(
  String(activeEquipmentIdentity(after.workout.accessory_groups[0].items[1])?.equipment_type)
    .toLowerCase()
    .replaceAll('_', ' '),
  'plate loaded',
);
assert.equal(activeEquipmentIdentity(after.workout.accessory_groups[0].items[2]), null);
assert.deepEqual(after.workout.accessory_groups[0].items[0].set_logs, [a1Log]);
assert.deepEqual(after.workout.accessory_groups[0].items[1].set_logs, [a2Log]);
assert.equal(
  after.workout.accessory_groups[0].items[1].set_logs[0].equipment_manufacturer_id,
  matrix.manufacturer.id,
  'Changing current equipment must not rewrite the member\'s accepted SetLog evidence.',
);
assert.equal(after.workout.status, before.workout.status);
assert.equal(after.workout.started_at, before.workout.started_at);
assert.equal(after.workout.accessory_groups[0].round_count, 3);
assert.deepEqual(equipmentSnapshotForSet(panatta), {
  performed_movement_definition_id: panatta.id,
  equipment_manufacturer_id: panatta.manufacturer.id,
  equipment_model_id: null,
  implementation_key_snapshot: panatta.implementation_key,
  performed_label_snapshot: panatta.display_name,
  identity_source_snapshot: 'dev_equipment_selection',
});
assert.deepEqual(equipmentSelectionStatusLabels(panatta, false), ['USED']);
assert.deepEqual(equipmentTypeSelectionStatusLabels(panatta, 'selectorized', false), ['USED']);
assert.deepEqual(equipmentSelectionStatusLabels(arsenal, false), ['NOT USED']);
assert.deepEqual(equipmentTypeSelectionStatusLabels(arsenal, 'plate_loaded', false), ['NOT USED']);

resetRememberedWorkoutDetailEquipmentSelections();
rememberWorkoutDetailEquipmentSelection(before.workout.id, a2.id, arsenal);
const restored = hydrateWorkoutDetailEquipmentSelections(before);
assert.equal(activeEquipmentIdentity(restored.workout.accessory_groups[0].items[0])?.id, panatta.id);
assert.equal(
  activeEquipmentIdentity(restored.workout.accessory_groups[0].items[1])?.manufacturer?.key,
  arsenal.manufacturer.key,
);
assert.equal(
  String(activeEquipmentIdentity(restored.workout.accessory_groups[0].items[1])?.equipment_type)
    .toLowerCase()
    .replaceAll('_', ' '),
  'plate loaded',
);
assert.equal(restored.workout.accessory_groups[0].items[0].set_logs[0].id, a1Log.id);
assert.equal(restored.workout.accessory_groups[0].items[1].set_logs[0].id, a2Log.id);
assert.equal(
  restored.workout.accessory_groups[0].items[1].set_logs[0].equipment_manufacturer_id,
  matrix.manufacturer.id,
);
assert.equal(restored.workout.status, 'in_progress');
assert.equal(restored.workout.started_at, before.workout.started_at);
resetRememberedWorkoutDetailEquipmentSelections();

const equipmentPressBlock = workspaceSource.match(
  /accessibilityLabel=\{`Configure equipment for[\s\S]*?onPress=\{\(\) => onConfigureEquipment\(movement\.itemId\)\}/,
)?.[0] || '';
assert.ok(equipmentPressBlock, 'Equipment must be user-invoked from the movement action.');
assert.doesNotMatch(
  routeSource.match(/onToggle=\{\(\) => toggleMovementCard\(detailKey\)\}/)?.[0] || '',
  /openIdentityPicker/,
  'Expanding a superset must not auto-open equipment selection.',
);
assert.match(
  routeSource,
  /const unresolvedIdentity = round\.entries\.find\([\s\S]*?needsEquipmentSelection\(item\)[\s\S]*?openIdentityPicker\(unresolvedIdentity\.item,[\s\S]*?kind: 'group_round'/,
  'First-SetLog evidence enforcement must remain intact for unresolved machine members.',
);
assert.doesNotMatch(
  workspaceSource,
  /unit|kilogram|pound|\bkg\b|\blb\b/i,
  'Equipment-control eligibility must stay independent of display units.',
);

console.log('Superset machine equipment control contract passed.');
