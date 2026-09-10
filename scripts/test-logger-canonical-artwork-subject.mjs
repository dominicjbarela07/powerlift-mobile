#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { resolveCanonicalMovementArtwork } from '../lib/canonical-movement-artwork.ts';
import { canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';

const machineDip = {
  id: 314,
  key: 'accessory_machine_dip',
  display_name: 'Machine Dip',
  kind: 'accessory',
  family: 'accessory_triceps',
  equipment_type: 'machine',
  loading_implementation: 'machine_unspecified',
  primary_muscle_group: 'triceps',
  secondary_muscle_groups: ['chest'],
};

const initialHydration = canonicalArtworkInputForLoggerItem({
  id: 2505,
  movement: 'Machine Dip',
  is_substituted: false,
  effective_movement_identity: machineDip,
});
const sameMovementSwap = canonicalArtworkInputForLoggerItem({
  id: 2505,
  movement: 'Machine Dip',
  is_substituted: false,
  performed_canonical_movement_identity: machineDip,
  effective_movement_identity: machineDip,
});

assert.deepEqual(
  initialHydration,
  sameMovementSwap,
  'same-movement Swap must not improve or change the canonical artwork subject',
);
assert.deepEqual(resolveCanonicalMovementArtwork(initialHydration), {
  kind: 'accessory',
  canonicalIdentityId: 314,
  regionKey: 'triceps',
  primaryMuscleGroup: 'triceps',
  secondaryMuscleGroups: ['chest'],
});

const legacyHydration = canonicalArtworkInputForLoggerItem({
  id: 2505,
  movement: 'Machine Dip',
  is_substituted: false,
  legacy: {
    effective_movement_definition_id: 314,
    effective_movement_identity: machineDip,
  },
});
assert.deepEqual(
  legacyHydration,
  initialHydration,
  'a server-governed legacy identity must normalize to the same artwork subject',
);

const unresolved = canonicalArtworkInputForLoggerItem({
  id: 314,
  movement: 'Unmapped Legacy Accessory',
  is_substituted: false,
});
assert.deepEqual(unresolved, {
  kind: 'accessory',
  is_substituted: false,
  effective_movement_identity: null,
});
assert.deepEqual(resolveCanonicalMovementArtwork(unresolved), {
  kind: 'neutral',
  reason: 'missing_canonical_identity',
});

const loggerIdentity = fs.readFileSync('lib/logger-movement-identity.ts', 'utf8');
const loggerRoute = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
assert.match(loggerIdentity, /canonicalArtworkInputForLoggerItem/);
assert.match(loggerIdentity, /Row identity, display copy, equipment, and unrelated Logger state are excluded/);
assert.match(loggerRoute, /movementArtworkInput: canonicalArtworkInputForLoggerItem\(item\)/);
assert.doesNotMatch(
  loggerRoute,
  /movementArtworkInput:\s*\{\s*\.\.\.item/,
  'WorkoutItem row fields must never be spread across the canonical artwork boundary',
);

console.log('[logger-canonical-artwork-subject] normalized identity boundary and same-movement equivalence passed');
