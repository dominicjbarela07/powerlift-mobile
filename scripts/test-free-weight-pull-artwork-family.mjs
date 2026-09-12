#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  CANONICAL_ACCESSORY_ARTWORK_IDENTITIES,
  resolveCanonicalMovementArtwork,
} from '../lib/canonical-movement-artwork.ts';
import { canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root));
const audit = JSON.parse(read('docs/validation/free-weight-pull-family-2026-09-11/taxonomy-audit.json'));
const manifest = JSON.parse(read('docs/validation/free-weight-pull-family-2026-09-11/asset-manifest.json'));
const mappingSource = read('lib/canonical-movement-artwork-assets.ts').toString();
const resolve = (identity) => resolveCanonicalMovementArtwork({ kind: 'accessory', effective_movement_identity: identity });

assert.equal(audit.count, 47);
assert.equal(audit.candidate_count, 49);
assert.equal(audit.mid_back_taxonomy_present, false);
assert.deepEqual(audit.counts_by_primary, { rear_delts: 9, lats: 10, upper_back: 16, traps: 9, lower_back: 3 });
const pullPrimaries = new Set(Object.keys(audit.counts_by_primary));
// This historical batch remains immutable as the complete family grows.
for (const row of audit.qualifying) {
  assert.deepEqual(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[row.id], { key: row.key, primary: row.primary_muscle_group });
}
assert.equal(manifest.movements.filter(r=>r.final_status==='PENDING').length, 0);
assert.equal(manifest.movements.filter(r=>r.final_status==='KEEP').length, 0);
const uniqueAppFiles = new Set();
for (const row of audit.qualifying) {
  assert.equal(row.execution_family, 'FREE_WEIGHT');
  assert.equal(row.identity_status, 'canonical');
  assert.equal(row.retired_at, null);
  const identity = { id: row.id, key: row.key, family: row.family, primary_muscle_group: row.primary_muscle_group };
  assert.equal(resolve(identity).artworkKey, row.key);
  assert.equal(resolve({ ...identity, key: undefined }).kind, 'neutral', 'registered definition ID needs its stable catalog key to exclude unrelated row-ID collisions');
  assert.equal(resolve({ ...identity, key: 'contradictory_identity' }).kind, 'neutral');
  assert.equal(resolve({ ...identity, primary_muscle_group: 'chest', family: 'accessory_chest' }).kind, 'neutral');
  assert.equal(resolve({ ...identity, id: 999999 }).kind, 'neutral', 'known key cannot override a contradictory ID');
  assert.equal(resolve({ ...identity, id: undefined }).kind, 'neutral');
  assert.equal(resolveCanonicalMovementArtwork({ kind: 'accessory', ...identity,
    movement_identity: { ...identity, key: 'contradictory_identity' },
  }).kind, 'neutral', 'contradictory nested identity cannot fall through to outer picker data');
  assert.equal(resolveCanonicalMovementArtwork({ kind: 'accessory',
    movement_identity: identity,
    performed_movement_identity: { ...identity, key: 'contradictory_identity' },
  }).kind, 'neutral', 'performed governed identity cannot fall through to the prescription');
  const normalized = canonicalArtworkInputForLoggerItem({
    id: row.id + 90000, movement: 'Deliberately unrelated display label',
    movement_identity: { id: 314, key: 'accessory_machine_dip', primary_muscle_group: 'triceps' },
    effective_movement_identity: identity, performed_canonical_movement_identity: identity,
    is_substituted: true,
  });
  assert.equal(resolveCanonicalMovementArtwork(normalized).canonicalIdentityId, row.id);
  assert.equal(resolveCanonicalMovementArtwork(normalized).artworkKey, row.key);
  assert.equal(resolveCanonicalMovementArtwork({ kind: 'accessory', movement_identity: identity, is_substituted: true }).kind, 'neutral');
  const asset = manifest.movements.find(r=>r.id===row.id);
  assert.ok(asset?.files);
  uniqueAppFiles.add(asset.files.app.path);
  for (const role of ['master','app','thumbnail']) {
    const file = asset.files[role];
    const bytes = read(file.path);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)], file.dimensions);
    if (role !== 'master') assert.deepEqual(file.dimensions, role==='app' ? [512,512] : [192,192]);
  }
  assert.ok(mappingSource.includes(`require('@/${asset.files.app.path}')`));
  assert.ok(mappingSource.includes(`require('@/${asset.files.thumbnail.path}')`));
}
assert.equal(uniqueAppFiles.size, audit.count, 'separate IDs must not silently reuse one generic image');
const searchGroups = JSON.parse(read('docs/validation/free-weight-pull-family-2026-09-11/qa-search-serialized.json'));
assert.equal(searchGroups.flatMap(group => group.items).length, 49);
for (const group of searchGroups) {
  assert.equal(group.http_status, 200);
  for (const item of group.items) {
    assert.equal(item.primary_muscle_group, group.primary);
    const selected = resolveCanonicalMovementArtwork({ ...item, kind: 'accessory' });
    assert.equal(selected.artworkKey, CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[item.id]?.key, 'real historical search DTO maps its currently governed exact identity, including completed hinge coverage');
    assert.equal(selected.canonicalIdentityId, item.id);
  }
}
const serialized = JSON.parse(read('docs/validation/free-weight-pull-family-2026-09-11/qa-session-serialized.json')).workout;
assert.equal(serialized.athlete_id, 12);
const serializedItems = serialized.accessory_groups.flatMap(group => group.items);
assert.deepEqual(serializedItems.map(item => item.effective_movement_definition_id), [33,191,80,154,194,126,235,155,545]);
for (const item of serializedItems) {
  const selected = resolveCanonicalMovementArtwork(canonicalArtworkInputForLoggerItem(item));
  assert.equal(selected.kind, 'accessory');
  assert.equal(selected.canonicalIdentityId, item.effective_movement_definition_id);
  assert.equal(selected.artworkKey, item.effective_movement_identity.key, 'real DEV serialized subject resolves without label inference');
}
assert.equal(crypto.createHash('sha256').update(read('assets/images/movement-artwork/free-weight-v1/masters/dumbbell-incline-bench-press-v1.png')).digest('hex'), 'e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe');
for (const row of audit.excluded.filter(row => pullPrimaries.has(row.primary_muscle_group))) {
  assert.equal(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[row.id], undefined);
}
assert.equal(resolve({ id: 321, key: 'accessory_weighted_dip', primary_muscle_group: 'triceps' }).artworkKey, undefined);
assert.equal(resolve({ id: 314, key: 'accessory_machine_dip', primary_muscle_group: 'triceps' }).kind, 'accessory');
assert.equal(resolveCanonicalMovementArtwork({ kind:'core', core_movement_id:33, core_family:'bench' }).kind, 'core');
assert.equal(resolveCanonicalMovementArtwork({ kind:'accessory', display_name:'Incline Dumbbell Bench Press' }).kind, 'neutral');
const pushAudit = JSON.parse(read('docs/validation/free-weight-push-family-2026-09-11/taxonomy-audit.json'));
for (const row of [...pushAudit.qualifying, ...audit.qualifying]) {
  assert.equal(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[row.id]?.key, row.key, 'all 98 prior exact mappings remain intact');
}
for (const id of [546,548]) {
  assert.equal(manifest.movements.some(row => row.id === id), false, 'hinges were deferred from this historical Pull batch; the Completion audit governs their new artwork');
}
const reviews = JSON.parse(read('docs/validation/free-weight-pull-family-2026-09-11/reviews.json'));
for (const asset of manifest.movements) {
  assert.ok(reviews.some(review => review.id === asset.id && review.attempt === asset.attempt && review.status === 'ACCEPT'));
  const attempt = JSON.parse(read(`docs/validation/free-weight-pull-family-2026-09-11/attempts/${asset.id}-${asset.attempt}.json`));
  assert.ok(attempt.reference_paths[0].endsWith('/masters/dumbbell-incline-bench-press-v1.png'), 'every accepted asset uses the original master first');
}
console.log('[free-weight-pull-family] 47 immutable exact assets, 98 prior mappings, 49 real search DTOs, mixed push/pull Session, fail-closed swaps and historical scope passed');
