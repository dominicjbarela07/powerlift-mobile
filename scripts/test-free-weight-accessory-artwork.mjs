#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveCanonicalMovementArtwork } from '../lib/canonical-movement-artwork.ts';
import { canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';

const key = 'accessory_incline_dumbbell_bench_press';
const target = { id: 33, key, family: 'accessory_chest', primary_muscle_group: 'chest' };
const other = { id: 32, key: 'accessory_flat_dumbbell_bench_press', primary_muscle_group: 'chest' };
const resolve = (input) => resolveCanonicalMovementArtwork({ kind: 'accessory', ...input });
const catalog = JSON.parse(fs.readFileSync(new URL('../assets/catalog/accessory-catalog-review.json', import.meta.url), 'utf8'));
assert.equal(catalog.movements.filter((row) => row.id === key).length, 1);

assert.equal(resolve({ ...target }).artworkKey, key, 'picker identity resolves the one governed entry');
assert.equal(resolve({ movement_identity: target }).artworkKey, key, 'programmed identity resolves');
assert.equal(resolve({ effective_movement_identity: target }).canonicalIdentityId, 33);
assert.equal(resolve({ effective_movement_identity: target }).artworkKey, key);
assert.equal(resolve({ performed_canonical_movement_identity: target }).artworkKey, key);
assert.equal(resolve({ legacy: { state: 'legacy_resolved', effective_movement_definition_id: 33, effective_movement_identity: target } }).artworkKey, key);

const substituted = canonicalArtworkInputForLoggerItem({
  movement_identity: other, effective_movement_identity: target,
  performed_canonical_movement_identity: target, is_substituted: true,
});
assert.equal(resolve(substituted).artworkKey, key, 'Logger uses performed subject after an approved swap');
assert.equal(resolve({ movement_identity: target, effective_movement_identity: other, is_substituted: true }).artworkKey, undefined, 'swapping away cannot retain this image');
assert.equal(resolve({ movement_identity: target, is_substituted: true }).kind, 'neutral', 'unresolved substitution cannot reuse programmed artwork');
assert.equal(resolve({ movement_identity: target, effective_movement_identity: { id: 99 } }).kind, 'neutral', 'incomplete effective identity cannot fall back to the prescription');
assert.equal(resolve({ movement_identity: target, effective_movement_identity: {} }).kind, 'neutral');
assert.equal(resolve({ effective_movement_identity: target, performed_canonical_movement_identity: other }).kind, 'neutral', 'conflicting governed IDs fail closed');
assert.equal(resolve({ effective_movement_identity: target, performed_canonical_movement_identity: { ...target, key: other.key } }).kind, 'neutral', 'contradictory keys fail closed');
assert.equal(resolve({ movement_identity: target, legacy: { state: 'resolved', effective_movement_definition_id: 33, effective_movement_identity: other } }).kind, 'neutral', 'legacy ID mismatch fails closed');

assert.equal(resolve({ key, primary_muscle_group: 'chest' }).kind, 'neutral', 'key without authoritative numeric ID is insufficient');
assert.equal(resolve({ id: 33, primary_muscle_group: 'chest', display_name: 'Dumbbell Incline Bench Press' }).artworkKey, undefined, 'numeric row ID and display name cannot invent governed artwork membership');
assert.equal(resolve({ id: 7, key: 'incline_dumbbell_press', family: 'horizontal_push' }).artworkKey, undefined, 'separate legacy movement is not mass-mapped');
for (const unrelated of [other, { id: 34, key: 'accessory_decline_dumbbell_bench_press', primary_muscle_group: 'chest' }, { id: 135, key: 'accessory_machine_reverse_fly', primary_muscle_group: 'rear_delts' }]) {
  const result = resolve({ ...unrelated, display_name: 'Dumbbell Incline Bench Press' });
  assert.equal(result.artworkKey, undefined);
  assert.equal(result.kind, 'accessory', 'existing governed fallback stays available');
}
assert.equal(resolveCanonicalMovementArtwork({ kind: 'core', core_movement_id: 33, core_family: 'bench', key }).kind, 'core');

for (const [name, expectedSize] of [['dumbbell-incline-bench-press-v1.png', 512], ['dumbbell-incline-bench-press-v1-thumb.png', 192]]) {
  const png = fs.readFileSync(new URL(`../assets/images/movement-artwork/free-weight-v1/${name}`, import.meta.url));
  assert.equal(png.readUInt32BE(16), expectedSize);
  assert.equal(png.readUInt32BE(20), expectedSize);
}
console.log('[free-weight-accessory-artwork] exact governed mapping, performed identity, conflict denial, unrelated fallback and PNG derivatives passed');
