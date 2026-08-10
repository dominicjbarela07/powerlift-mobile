import assert from 'node:assert/strict';

import {
  activeEquipmentIdentity,
  isMachineAccessoryItem,
  isMachineEquipmentIdentity,
  needsEquipmentSelection,
} from '../lib/equipment-selection.ts';

for (const executionContext of [
  'real-athlete-assigned-session',
  'owner-admin-athlete-mobile-mode-self-session',
  'coach-logging-athlete-session',
]) {
  const legacyMachine = {
    id: 9001,
    movement: 'Lat Pulldown',
    execution_context: executionContext,
    movement_identity: null,
    performed_movement_identity: null,
  };
  assert.equal(isMachineAccessoryItem(legacyMachine), true);
  assert.equal(needsEquipmentSelection(legacyMachine), true);
}

const incompleteLegacyMachineIdentity = {
  id: 9002,
  movement: 'Leg Extension',
  movement_identity: {
    id: 9102,
    key: 'legacy_leg_extension',
    display_name: 'Leg Extension',
    identity_specificity: 'exact',
  },
  performed_movement_identity: null,
};
assert.equal(isMachineAccessoryItem(incompleteLegacyMachineIdentity), true);
assert.equal(activeEquipmentIdentity(incompleteLegacyMachineIdentity), null);
assert.equal(needsEquipmentSelection(incompleteLegacyMachineIdentity), true);

const authoritativePortableIdentity = {
  id: 9003,
  movement: 'Machine Chest Press',
  movement_identity: {
    id: 9103,
    key: 'barbell_chest_press',
    display_name: 'Barbell Chest Press',
    identity_specificity: 'exact',
    equipment_type: 'barbell',
    loading_implementation: 'barbell',
    load_convention: 'barbell_total',
  },
  performed_movement_identity: null,
};
assert.equal(isMachineAccessoryItem(authoritativePortableIdentity), false);
assert.equal(needsEquipmentSelection(authoritativePortableIdentity), false);

assert.equal(
  isMachineAccessoryItem({
    id: 9004,
    movement: 'Dumbbell Lat Pulldown',
    movement_identity: null,
    performed_movement_identity: null,
  }),
  false,
);

for (const movement of [
  'Cable Upright Row',
  'Cable Lateral Raise',
  'Cable Curl',
  'Cable Tricep Pushdown',
  'Cable Overhead Extension',
  'Cable Fly',
  'Lat Pulldown',
  'Cable Row',
  'Triceps Pushdown',
  'Single-Arm Pressdown',
]) {
  const item = {
    id: 9200,
    movement,
    movement_identity: null,
    performed_movement_identity: null,
  };
  assert.equal(
    isMachineAccessoryItem(item),
    true,
    `${movement} must enter the machine-equipment workflow.`,
  );
  assert.equal(
    needsEquipmentSelection(item),
    true,
    `${movement} must require equipment configuration before logging.`,
  );
}

for (const movement of [
  'DB Curl',
  'EZ Bar Curl',
  'Barbell Row',
  'Dumbbell Lateral Raise',
]) {
  const item = {
    id: 9300,
    movement,
    movement_identity: null,
    performed_movement_identity: null,
  };
  assert.equal(
    isMachineAccessoryItem(item),
    false,
    `${movement} must not be inferred as fixed machine equipment.`,
  );
  assert.equal(needsEquipmentSelection(item), false);
}

const authoritativeCableIdentity = {
  id: 9400,
  movement: 'Vertical Pull',
  movement_identity: {
    id: 9401,
    key: 'cable_vertical_pull_unknown',
    display_name: 'Vertical Pull',
    identity_specificity: 'unknown',
    equipment_type: 'cable',
    loading_implementation: 'cable_stack',
    load_convention: 'machine_stack_display',
  },
  performed_movement_identity: null,
};
assert.equal(
  isMachineEquipmentIdentity(authoritativeCableIdentity.movement_identity),
  true,
  'Authoritative cable metadata must be classified as machine equipment.',
);
assert.equal(isMachineAccessoryItem(authoritativeCableIdentity), true);
assert.equal(activeEquipmentIdentity(authoritativeCableIdentity), null);
assert.equal(needsEquipmentSelection(authoritativeCableIdentity), true);

const legacyCommonCableIdentity = {
  ...authoritativeCableIdentity,
  id: 9402,
  movement_identity: {
    ...authoritativeCableIdentity.movement_identity,
    id: 9403,
    key: 'cable_row_common',
    identity_specificity: 'exact',
    equipment_type: 'Common cable',
    loading_implementation: null,
    implementation_key: null,
  },
};
assert.equal(isMachineAccessoryItem(legacyCommonCableIdentity), true);
assert.equal(needsEquipmentSelection(legacyCommonCableIdentity), true);

const configuredCableIdentity = {
  ...authoritativeCableIdentity,
  id: 9404,
  performed_movement_identity: {
    id: 9405,
    key: 'machine-equipment:hammer-strength:selectorized',
    display_name: 'Hammer Strength · Selectorized',
    identity_specificity: 'exact',
    equipment_type: 'selectorized_machine',
    loading_implementation: 'selectorized_machine',
    load_convention: 'machine_stack_display',
    implementation_key: 'machine-equipment:hammer-strength:selectorized',
    manufacturer: {
      id: 77,
      key: 'hammer-strength',
      display_name: 'Hammer Strength',
    },
    equipment_context: { option_kind: 'catalog' },
  },
};
assert.equal(isMachineAccessoryItem(configuredCableIdentity), true);
assert.equal(activeEquipmentIdentity(configuredCableIdentity)?.id, 9405);
assert.equal(needsEquipmentSelection(configuredCableIdentity), false);

const cableNamedPortableIdentity = {
  id: 9500,
  movement: 'Cable-Style Dumbbell Pullover',
  movement_identity: {
    id: 9501,
    key: 'dumbbell_pullover',
    display_name: 'Dumbbell Pullover',
    identity_specificity: 'exact',
    equipment_type: 'dumbbell',
    loading_implementation: 'free_weight',
    load_convention: 'per_hand',
  },
  performed_movement_identity: null,
};
assert.equal(
  isMachineAccessoryItem(cableNamedPortableIdentity),
  false,
  'Authoritative portable metadata must override cable-like wording.',
);

const supersetEntries = [
  {
    id: 9601,
    movement: 'DB Curl',
    movement_identity: null,
    performed_movement_identity: null,
  },
  {
    id: 9602,
    movement: 'Cable Pushdown',
    movement_identity: null,
    performed_movement_identity: null,
  },
];
assert.deepEqual(
  supersetEntries.map((item) => needsEquipmentSelection(item)),
  [false, true],
  'Superset members must resolve their equipment gate independently.',
);

assert.equal(
  isMachineAccessoryItem({
    id: 9700,
    movement: 'Cable Lateral Raise',
    movement_identity: null,
    performed_movement_identity: null,
    dev_accessory_intelligence: { kind: 'portable' },
  }),
  true,
  'Credible cable evidence must fail toward machine configuration when non-authoritative metadata is stale.',
);

console.log('Equipment gating regression checks passed.');
