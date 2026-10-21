import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeCurrentWorkoutItem } from '../lib/current-session-movement.ts';
import { canonicalArtworkInputFromDefinition } from '../lib/canonical-movement-art-subject.ts';
import { canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';
import { resolveApprovedExactMovementArtwork as approved } from '../lib/movement-artwork-hero.ts';

const read = file => JSON.parse(fs.readFileSync(file));
const catalog = read('config/governed-movement-art-taxonomy.json').movements;
const live = read('docs/validation/rdl-artwork-2026-10-21/live-rdl-input.json');
const liveCore = read('docs/validation/rdl-artwork-2026-10-21/live-core-inventory.json');
const policy = read('artwork-review/runtime-policy.json');
const unchanged = structuredClone(live);
const rdl = approved(canonicalArtworkInputForLoggerItem(live), true);
assert.equal(rdl?.key, 'accessory_romanian_deadlift', 'actual Production RDL must retain its original approved exact art');
assert.equal(rdl.movement_definition_id, live.movement_definition_id, 'artwork never substitutes DEV identity for the server movement');
assert.equal(rdl.app_sha256, 'b40bd7faf76a792a368b59765ef5662ac35a1a012ac609a4c5e233b484033b14');
assert.deepEqual(live, unchanged, 'read-only artwork resolution preserves server evidence');

let definitions = 0, relocated = 0, collisions = 0, liveCoreCount = 0;
function check(definition, expected, id, coreId) {
  const identity = { ...definition, id, ownership_scope: 'global', core_movement_definition_id: coreId };
  const item = { movement_identity_contract: 1, movement_definition_id: id, movement_identity: identity,
    lift: 'AX', variant: 'ACC', mode: 'RIR',
    core_movement: coreId ? { id: coreId, key: definition.key, family: definition.family, kind: definition.core_kind } : null };
  const normalized = normalizeCurrentWorkoutItem(item);
  assert.equal(normalized.movement_definition_id, id, definition.key);
  assert.equal(normalized.movement_identity.key, definition.key, 'an environment-local numeric collision cannot relabel a global definition');
  assert.equal(normalized.core_movement_id, coreId, 'the server owns Core IDs too');
  assert.deepEqual(normalizeCurrentWorkoutItem(normalized), normalized, 'normalization is idempotent');
  for (const input of [canonicalArtworkInputForLoggerItem(item), canonicalArtworkInputForLoggerItem(normalized), canonicalArtworkInputFromDefinition(identity)]) {
    const art = approved(input, true);
    assert.equal(art?.key, expected.key, `${definition.key}: relocated definition must retain the approved image`);
    assert.equal(art.app_sha256, expected.app_sha256, 'no new image or substitution');
    assert.equal(art.candidate_id, expected.candidate_id, 'retain original human receipt');
    assert.equal(art.movement_definition_id, id, 'retain environment-owned physical movement ID');
    assert.equal(approved(input, true, { ...policy, denied_keys: [...policy.denied_keys, art.key] }), null);
    assert.equal(approved(input, true, { ...policy, approved_exact_artwork: [] }), null);
  }
  const privateItem = { ...item, movement_identity: { ...identity, kind: 'custom', ownership_scope: 'coach' } };
  assert.equal(approved(canonicalArtworkInputForLoggerItem(privateItem), true), null, 'private definitions cannot impersonate a public artwork key');
}
for (const definition of catalog) {
  const expected = approved(canonicalArtworkInputFromDefinition(definition), true);
  if (!expected) continue;
  definitions++;
  check(definition, expected, 1_000_000 + definition.id, definition.core_movement_definition_id ? 2_000_000 + definition.core_movement_definition_id : null);
  relocated++;
  const collision = catalog.find(row => row.id !== definition.id && row.key !== definition.key);
  check(definition, expected, collision.id, definition.core_movement_definition_id ? 3_000_000 + definition.core_movement_definition_id : null);
  collisions++;
  const deployed = liveCore.find(row => row.key === definition.key);
  if (deployed) {
    check(definition, expected, deployed.id, deployed.core_movement_definition_id);
    liveCoreCount++;
  }
}
assert.equal(liveCoreCount, liveCore.length, 'audit every actually deployed Core definition, not RDL alone');
assert.ok(definitions > 400, 'audit complete governed approved inventory');
const unowned = { ...live, movement_identity: { ...live.movement_identity, ownership_scope: undefined } };
assert.equal(approved(canonicalArtworkInputForLoggerItem(unowned), true), null, 'unproven foreign identity remains closed');
const conflict = { ...live, core_movement: { ...live.core_movement, key: 'competition_squat' } };
assert.equal(approved(canonicalArtworkInputForLoggerItem(conflict), true), null, 'contradictory typed Core identity never borrows art');
console.log('PASS: ' + JSON.stringify({ pass: true, approved_definitions: definitions, relocated, numeric_collisions: collisions,
  actual_production_core_definitions: liveCoreCount, original_rdl_image_sha256: rdl.app_sha256,
  private_impersonation_rejected: true, deny_and_missing_approval_rejected: true }));
