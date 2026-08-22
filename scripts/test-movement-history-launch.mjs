import assert from 'node:assert/strict';

import {
  movementHistorySheetRoute,
  resolveMovementHistoryLaunchForItem,
  resolveMovementHistoryLaunchFromMeasurement,
} from '../lib/movement-history-launch.ts';

const prime = {
  id: 25,
  key: 'machine_equipment_8_prime_plate_loaded',
  display_name: 'Prime Fitness · Plate Loaded',
  identity_specificity: 'exact',
  equipment_type: 'machine',
  loading_implementation: 'plate_loaded',
  implementation_key: 'prime:plate_loaded',
  manufacturer: { id: 8, key: 'prime_fitness', display_name: 'Prime Fitness' },
};

const screenshotItem = {
  id: 16061,
  movement: 'Single-Arm Lat Pulldown',
  movement_identity: null,
  performed_movement_identity: prime,
  performed_canonical_movement_identity: null,
  legacy: {
    effective_movement_definition_id: 167,
    effective_movement_identity: { id: 167 },
  },
};
const original = structuredClone(screenshotItem);
const resolved = resolveMovementHistoryLaunchForItem({ athleteId: 4, item: screenshotItem });
assert.equal(resolved.ok, true);
assert.deepEqual(resolved.ok ? resolved.target : null, {
  athleteId: 4,
  movementDefinitionId: 167,
  equipmentContextDefinitionId: 25,
});
assert.deepEqual(screenshotItem, original, 'opening History must not mutate Session state');
assert.deepEqual(movementHistorySheetRoute(resolved.target), {
  pathname: '/movement-history-sheet',
  params: {
    athleteId: '4',
    movementDefinitionId: '167',
    equipmentContextDefinitionId: '25',
  },
});

const noEquipment = resolveMovementHistoryLaunchForItem({
  athleteId: 4,
  item: { id: 2, movement: 'Dumbbell Curl', movement_identity: { id: 200 } },
});
assert.deepEqual(noEquipment.ok ? noEquipment.target : null, {
  athleteId: 4,
  movementDefinitionId: 200,
});

const performedCanonicalWins = resolveMovementHistoryLaunchForItem({
  athleteId: 4,
  item: {
    id: 3,
    movement_identity: { id: 10 },
    performed_canonical_movement_identity: { id: 11 },
  },
});
assert.equal(performedCanonicalWins.ok && performedCanonicalWins.target.movementDefinitionId, 11);

const historicalEquipmentInProgrammedSlot = resolveMovementHistoryLaunchForItem({
  athleteId: 4,
  item: {
    ...screenshotItem,
    movement_identity: prime,
  },
});
assert.equal(
  historicalEquipmentInProgrammedSlot.ok
    && historicalEquipmentInProgrammedSlot.target.movementDefinitionId,
  167,
  'equipment identity must never become the Movement History subject',
);

const sameEquipmentDifferentMovementA = resolveMovementHistoryLaunchForItem({
  athleteId: 4,
  item: { ...screenshotItem, legacy: { effective_movement_definition_id: 301 } },
});
const sameEquipmentDifferentMovementB = resolveMovementHistoryLaunchForItem({
  athleteId: 4,
  item: { ...screenshotItem, legacy: { effective_movement_definition_id: 302 } },
});
assert.equal(sameEquipmentDifferentMovementA.ok && sameEquipmentDifferentMovementA.target.movementDefinitionId, 301);
assert.equal(sameEquipmentDifferentMovementB.ok && sameEquipmentDifferentMovementB.target.movementDefinitionId, 302);
assert.equal(sameEquipmentDifferentMovementA.ok && sameEquipmentDifferentMovementA.target.equipmentContextDefinitionId, 25);

const missing = resolveMovementHistoryLaunchForItem({ athleteId: 4, item: { id: 9 } });
assert.deepEqual(missing.ok ? null : missing.reason, 'canonical_identity_missing');
const missingAthlete = resolveMovementHistoryLaunchForItem({ athleteId: null, item: screenshotItem });
assert.deepEqual(missingAthlete.ok ? null : missingAthlete.reason, 'athlete_context_missing');

const recap = resolveMovementHistoryLaunchFromMeasurement({
  athleteId: 4,
  movementDefinitionId: 167,
  equipmentContextDefinitionId: 25,
});
assert.deepEqual(recap.ok ? recap.target : null, {
  athleteId: 4,
  movementDefinitionId: 167,
  equipmentContextDefinitionId: 25,
});

console.log('[movement-history-launch] canonical identity, legacy resolution, equipment context, controlled failure, and state preservation passed');
