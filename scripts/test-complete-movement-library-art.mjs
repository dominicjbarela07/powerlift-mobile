import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { canonicalArtworkInputFromDefinition } from '../lib/canonical-movement-artwork.ts';
import { resolveApprovedExactMovementArtwork, approvedLoggerCrop } from '../lib/movement-artwork-hero.ts';
import { isSelectableLibraryMovement } from '../lib/retired-movement-discovery.ts';
import { assertHumanArtworkGate, approvedLoggerCropPolicy } from './canonical-art-review-gate.mjs';

const read = file => JSON.parse(fs.readFileSync(file));
assertHumanArtworkGate();
const state = read('artwork-review/review-state.json');
const catalog = read('config/governed-movement-art-taxonomy.json').movements;
const active = catalog.filter(isSelectableLibraryMovement);
const results = [];
for (const definition of active) {
  const input = canonicalArtworkInputFromDefinition(definition), before = structuredClone(input);
  const artwork = resolveApprovedExactMovementArtwork(input, true);
  assert.ok(artwork, `${definition.key}: every selectable built-in needs an approved image`);
  const candidate = state.items.find(row => row.candidate_id === artwork.candidate_id);
  const mapping = state.canonical_assets.find(row => row.candidate_id === artwork.candidate_id);
  assert.ok(candidate?.human_approved && ['approved', 'approved_existing'].includes(candidate.status), definition.key);
  assert.ok(mapping, `${definition.key}: canonical asset must actually be packaged`);
  const crop = approvedLoggerCropPolicy(state, candidate);
  assert.ok(crop, `${definition.key}: approved framing required`);
  assert.deepEqual(approvedLoggerCrop(artwork.key), crop);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(mapping.files.app.path)).digest('hex'), candidate.files.app.sha256);
  assert.deepEqual(input, before, 'artwork never changes movement or history identity');
  results.push({ id: definition.id, key: definition.key, kind: definition.kind, candidate: candidate.candidate_id, asset: mapping.files.app.path, sha256: mapping.files.app.sha256, crop });
}
assert.equal(active.length, 498);
assert.equal(active.filter(row => row.kind === 'accessory').length, 468);
assert.equal(active.filter(row => row.kind === 'core').length, 30);
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) fs.writeFileSync(process.argv[outputIndex + 1], JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ active_built_in_movements: results.length, approved_images: results.length, approved_crops: results.length, retired_excluded: catalog.length - active.length, missing: 0, custom_art_not_required: true }));
