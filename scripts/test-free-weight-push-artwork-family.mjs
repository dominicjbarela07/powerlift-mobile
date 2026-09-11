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
const audit = JSON.parse(read('docs/validation/free-weight-push-family-2026-09-11/taxonomy-audit.json'));
const manifest = JSON.parse(read('docs/validation/free-weight-push-family-2026-09-11/asset-manifest.json'));
const mappingSource = read('lib/canonical-movement-artwork-assets.ts').toString();
const resolve = (identity) => resolveCanonicalMovementArtwork({ kind: 'accessory', effective_movement_identity: identity });

assert.equal(audit.count, 51);
assert.deepEqual(audit.counts_by_primary, { chest: 17, front_delts: 12, side_delts: 10, triceps: 12 });
assert.deepEqual(Object.keys(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES).map(Number).sort((a,b)=>a-b), audit.qualifying.map(r=>r.id).sort((a,b)=>a-b));
assert.equal(manifest.movements.filter(r=>r.final_status==='PENDING').length, 0);
assert.equal(manifest.movements.filter(r=>r.final_status==='KEEP').length, 1);
const uniqueAppFiles = new Set();
for (const row of audit.qualifying) {
  assert.equal(row.execution_family, 'FREE_WEIGHT');
  assert.equal(row.identity_status, 'canonical');
  assert.equal(row.retired_at, null);
  const identity = { id: row.id, key: row.key, family: row.family, primary_muscle_group: row.primary_muscle_group };
  assert.equal(resolve(identity).artworkKey, row.key);
  assert.equal(resolve({ ...identity, key: undefined }).kind, 'neutral', 'registered definition ID needs its stable catalog key to exclude unrelated row-ID collisions');
  assert.equal(resolve({ ...identity, key: 'contradictory_identity' }).kind, 'neutral');
  assert.equal(resolve({ ...identity, primary_muscle_group: 'lats', family: 'accessory_lats' }).kind, 'neutral');
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
const searchGroups = JSON.parse(read('docs/validation/free-weight-push-family-2026-09-11/qa-search-serialized.json'));
assert.equal(searchGroups.flatMap(group => group.items).length, 51);
for (const group of searchGroups) {
  assert.equal(group.http_status, 200);
  for (const item of group.items) {
    assert.equal(item.primary_muscle_group, group.primary);
    const selected = resolveCanonicalMovementArtwork({ ...item, kind: 'accessory' });
    assert.equal(selected.artworkKey, item.key, 'real search DTO selects the same exact canonical asset');
    assert.equal(selected.canonicalIdentityId, item.id);
  }
}
const serialized = JSON.parse(read('docs/validation/free-weight-push-family-2026-09-11/qa-session-serialized.json')).workout;
assert.equal(serialized.athlete_id, 12);
const serializedItems = serialized.accessory_groups.flatMap(group => group.items);
assert.deepEqual(serializedItems.map(item => item.effective_movement_definition_id), [33,79,80,84,103,289,292,297]);
for (const item of serializedItems) {
  const selected = resolveCanonicalMovementArtwork(canonicalArtworkInputForLoggerItem(item));
  assert.equal(selected.kind, 'accessory');
  assert.equal(selected.canonicalIdentityId, item.effective_movement_definition_id);
  assert.equal(selected.artworkKey, item.effective_movement_identity.key, 'real DEV serialized subject resolves without label inference');
}
assert.equal(manifest.movements.find(r=>r.id===33).files.master.sha256, 'e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe');
for (const row of audit.excluded) assert.equal(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[row.id], undefined);
assert.equal(resolve({ id: 321, key: 'accessory_weighted_dip', primary_muscle_group: 'triceps' }).artworkKey, undefined);
assert.equal(resolve({ id: 314, key: 'accessory_machine_dip', primary_muscle_group: 'triceps' }).kind, 'accessory');
assert.equal(resolveCanonicalMovementArtwork({ kind:'core', core_movement_id:33, core_family:'bench' }).kind, 'core');
assert.equal(resolveCanonicalMovementArtwork({ kind:'accessory', display_name:'Incline Dumbbell Bench Press' }).kind, 'neutral');
console.log('[free-weight-push-family] complete audited ID coverage, immutable baseline, 51 distinct files, identity conflicts, swaps and excluded/Core isolation passed');
