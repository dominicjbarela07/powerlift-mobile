import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalArtworkInputFromDefinition } from '../lib/canonical-movement-artwork.ts';
import { resolveApprovedExactMovementArtwork, approvedLoggerCrop } from '../lib/movement-artwork-hero.ts';
import { approvedExactArtworkPolicy, approvedLoggerCropPolicy, assertHumanArtworkGate } from './canonical-art-review-gate.mjs';

const read = file => JSON.parse(fs.readFileSync(file));
const catalog = read('config/governed-movement-art-taxonomy.json').movements.filter(row => row.kind === 'core');
const reuse = read('config/governed-core-artwork-reuse.json');
const existing = read('config/governed-movement-art-reuse.json').shared_artwork_identities;
const state = read('artwork-review/review-state.json');
const policy = read('artwork-review/runtime-policy.json');
assertHumanArtworkGate();
assert.deepEqual(policy.approved_exact_artwork, approvedExactArtworkPolicy(state));
const uncovered = new Map(reuse.awaiting_specific_artwork.map(row => [row.movement_definition_id, row]));
const covered = [];
for (const definition of catalog) {
  const input = canonicalArtworkInputFromDefinition(definition), original = structuredClone(input);
  const result = resolveApprovedExactMovementArtwork(input, true);
  assert.deepEqual(input, original, 'artwork must not rewrite physical movement or history identity');
  if (uncovered.has(definition.id)) {
    assert.equal(result, null, 'special equipment/stance awaits its own approved source, never a misleading parent photograph');
    assert.equal(uncovered.get(definition.id).key, definition.key);
    continue;
  }
  const binding = [...reuse.mappings, ...existing].find(row => row.movement_definition_id === definition.id);
  assert.ok(binding, `${definition.key}: explicit numeric-ID assignment required`);
  assert.equal(binding.key, definition.key);
  assert.equal(binding.core_movement_definition_id, definition.core_movement_definition_id);
  assert.ok(result, `${definition.key}: approved source must resolve`);
  assert.equal(result.movement_definition_id, definition.id);
  assert.equal(result.key, binding.artwork_key);
  const source = state.items.find(row => row.candidate_id === result.candidate_id);
  assert.equal(source.movement_definition_id, binding.artwork_movement_definition_id);
  assert.deepEqual(approvedLoggerCrop(result.key), approvedLoggerCropPolicy(state, source));
  assert.ok(approvedLoggerCrop(result.key), 'parent framing must retain the exact human crop receipt');
  assert.equal(resolveApprovedExactMovementArtwork(input, false), null, 'Production remains disabled');
  assert.equal(resolveApprovedExactMovementArtwork(input, true, { denied_keys: [result.key], approved_exact_artwork: policy.approved_exact_artwork }), null);
  assert.equal(resolveApprovedExactMovementArtwork(input, true, { denied_keys: [], approved_exact_artwork: [] }), null);
  const conflict = { core_movement_id: definition.core_movement_definition_id,
    core_movement: { id: definition.core_movement_definition_id, key: 'unrelated_key', family: definition.family, kind: definition.core_kind } };
  assert.equal(resolveApprovedExactMovementArtwork(conflict, true), null, 'names cannot repair conflicting identity');
  covered.push(definition.id);
}
assert.equal(new Set([...covered, ...uncovered.keys()]).size, catalog.length);
for (const id of [1, 2, 3]) {
  const changed = structuredClone(state);
  const source = changed.items.find(row => row.candidate_id === changed.canonical_assets.find(row => row.movement_definition_id === id).candidate_id);
  delete changed.logger_crop_reviews[source.candidate_id];
  assert.ok(!approvedExactArtworkPolicy(changed).some(row => row.movement_definition_id === id), 'source approval alone cannot ship Core artwork');
  source.status = 'rejected';
  assert.ok(!approvedExactArtworkPolicy(changed).some(row => row.movement_definition_id === id));
}
console.log(JSON.stringify({ core_movements: catalog.length, approved_image_and_crop: covered.length, awaiting_dedicated_review: [...uncovered.values()].map(row => row.movement_name), production_unchanged: true }));
if (process.argv.includes('--require-complete')) assert.equal(uncovered.size, 0, 'Complete-library claim requires all dedicated images and crops approved');
