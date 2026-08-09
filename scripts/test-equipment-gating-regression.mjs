import assert from 'node:assert/strict';

import {
  activeEquipmentIdentity,
  isMachineAccessoryItem,
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

console.log('Equipment gating regression checks passed.');
