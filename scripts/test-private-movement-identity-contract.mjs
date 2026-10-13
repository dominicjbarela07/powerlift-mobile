import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeCurrentWorkoutItem as current } from '../lib/current-session-movement.ts';
import { canonicalArtworkInputForLoggerItem as subject, resolveLoggerMovementIdentity as logger } from '../lib/logger-movement-identity.ts';
import { resolveCanonicalMovementArtwork as art } from '../lib/canonical-movement-artwork.ts';
import { resolveApprovedExactMovementArtwork as approved } from '../lib/movement-artwork-hero.ts';
import { resolveMovementHistoryLaunchForItem as history } from '../lib/movement-history-launch.ts';
import { isMachineAccessoryItem as machine } from '../lib/equipment-selection.ts';

// Database sequences are environment-local. A private server definition may
// legitimately have the same number as a different bundled public definition.
// It must retain its server identity and taxonomy, never borrow that public art.
const catalog = JSON.parse(fs.readFileSync('config/governed-movement-art-taxonomy.json', 'utf8')).movements;
for (const bundled of catalog) {
  const identity = { id: bundled.id, key: 'custom_coach_field_machine_triceps',
    kind: 'custom', ownership_scope: 'coach', identity_status: 'custom',
    display_name: 'Machine Overhead Triceps Extension', family: 'accessory_triceps',
    primary_muscle_group: 'triceps', secondary_muscle_groups: [], equipment_type: 'machine',
    requires_equipment_configuration: true };
  for (const contract of [undefined, 1]) {
    const raw = { id: 900001, lift: 'AX', variant: 'ACC', movement_identity_contract: contract,
      movement_definition_id: identity.id, movement_identity: identity,
      effective_movement_definition_id: identity.id, effective_movement_identity: identity,
      performed_canonical_movement_definition_id: identity.id,
      performed_canonical_movement_identity: identity,
      core_movement_id: bundled.core_movement_definition_id,
      core_movement: {id:bundled.core_movement_definition_id, family:'press',kind:'variant'}, set_logs: [] };
    const normalized = current(raw);
    assert.equal(normalized.movement_definition_id, identity.id, `${bundled.key}: preserve server current ID`);
    assert.equal(normalized.movement_identity.key, identity.key, `${bundled.key}: never overwrite private key`);
    assert.equal(logger(normalized).displayName, identity.display_name);
    assert.equal(machine(normalized), true);
    assert.equal(normalized.core_movement_id, null, 'a private accessory cannot inherit a Core ID');
    assert.equal(normalized.core_movement, null, 'a private accessory cannot inherit the Core/Variant badge');
    assert.equal(history({ athleteId: 7, item: normalized }).target.movementDefinitionId, identity.id);
    const resolved = art(subject(normalized));
    assert.equal(resolved.kind, 'accessory', `${bundled.key}: governed private taxonomy cannot become ?`);
    assert.equal(resolved.regionKey, 'triceps');
    assert.equal(resolved.artworkKey, undefined, 'a private definition cannot borrow approved public imagery');
    assert.equal(approved(subject(normalized), true), null, 'the actual approved-photo resolver cannot borrow public imagery');
    assert.deepEqual(current(normalized), normalized, 'normalization remains idempotent');
    assert.equal(raw.movement_identity.key, identity.key, 'read normalization is pure');
  }
  const publicCurrent = current({ movement_identity_contract: 1,
    movement_definition_id: bundled.id, movement_identity: bundled,
    effective_movement_identity: identity, performed_canonical_movement_identity: identity });
  assert.equal(publicCurrent.movement_identity.key, bundled.key,
    'a stale private compatibility alias cannot take ownership from the declared current public definition');
}
// Contradictory public IDs/keys and unknown text still fail closed.
const publicRow = catalog.find(row => row.kind === 'accessory');
assert.equal(art({ effective_movement_identity: { ...publicRow, key: 'wrong_public_key' } }).kind, 'neutral');
assert.equal(art({ movement: 'Machine Overhead Triceps Extension', item_id: 900001 }).kind, 'neutral');
console.log(`PASS private movement identity: ${catalog.length * 2} initial/current collisions; artwork, equipment, history and title retain the exact server subject without borrowing public art.`);

assert.match(fs.readFileSync('lib/api.ts', 'utf8'), /'X-Strength-Ledger-Current-Movement-Contract': '1'/, 'only the corrected mapper advertises current identity capability');
