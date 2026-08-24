#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const logger = readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');
const resolver = readFileSync(new URL('../lib/logger-movement-identity.ts', import.meta.url), 'utf8');
const swap = logger.slice(
  logger.indexOf('// --- Accessory hot-swap'),
  logger.indexOf('const openEditSet ='),
);
const modal = logger.slice(
  logger.indexOf('{/* Accessory substitution modal */}'),
  logger.indexOf('const styles = StyleSheet.create'),
);

assert.match(resolver, /item\.is_substituted \? null/, 'Incomplete substitutions must fail closed.');
assert.match(resolver, /performed_canonical_movement_identity/, 'Performed canonical ID must drive effective identity.');
assert.match(resolver, /performedMovement/, 'A non-equipment performed ID must drive effective identity.');
assert.match(resolver, /activeEquipmentIdentity/, 'Equipment must remain separate from movement identity.');
assert.match(swap, /performed_canonical_movement_definition_id:\s*swapAccIdentity\.id/, 'Swap writes must submit a stable governed ID.');
assert.match(swap, /acceptedIdentityId !== Number\(swapAccIdentity\.id\)/, 'Success must require the server to return the same ID.');
assert.doesNotMatch(swap, /setData\(/, 'Swap must not optimistically mutate Logger identity.');
assert.match(modal, /CanonicalAccessoryPicker/, 'Free swap must use the governed catalog picker.');
assert.doesNotMatch(
  modal.slice(0, modal.indexOf('<Text style={styles.modalSectionKicker}>Prescription</Text>')),
  /<TextInput/,
  'Movement identity must not be authored as free text.',
);
assert.match(logger, /title:\s*identity\.displayName/, 'Set Logger must use normalized effective identity.');
assert.match(logger, /resolveLoggerMovementIdentity\(movementHistoryItem\)\.displayName/, 'History title must use normalized effective identity.');

console.log('[production-canonical-movement-swap] stable ID, server confirmation, fail-closed history, and equipment separation passed');
