#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { reviewedFreeWeightFiles } from './reviewed-free-weight-corrections.mjs';
import { CANONICAL_ACCESSORY_ARTWORK_IDENTITIES as registry, resolveCanonicalMovementArtwork as resolve } from '../lib/canonical-movement-artwork.ts';
import { canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';

const root = new URL('../', import.meta.url);
const doc = 'docs/validation/free-weight-completion-2026-09-11/';
const read = path => fs.readFileSync(new URL(path, root));
const json = path => JSON.parse(read(path));
const audit = json(doc + 'taxonomy-audit.json');
const manifest = json(doc + 'asset-manifest.json');
const reviews = json(doc + 'reviews.json');
const plan = json(doc + 'generation-plan.json');
const mappings = read('lib/canonical-movement-artwork-assets.ts').toString();
const ids = rows => rows.map(row => row.id).sort((a,b) => a-b);
const confirmed = audit.records.filter(row => ['APPROVED','NEEDS NEW ART'].includes(row.decision));
assert.equal(audit.definitions_audited, 633);
assert.equal(audit.active_canonical_accessory_count, 586);
assert.equal(audit.taxonomized_free_weight_count, 194);
assert.equal(confirmed.length, 198);
assert.deepEqual(audit.prior_coverage, {Push:51, Pull:47});
assert.equal(audit.initial_decisions['NEEDS NEW ART'], 100);
assert.deepEqual(audit.blocked_ids, [343]);
assert.deepEqual(ids(manifest.movements), ids(confirmed));
assert.deepEqual(Object.keys(registry).map(Number).sort((a,b)=>a-b), ids(confirmed), 'exact full inventory, without family gaps or extra registrations');
assert.deepEqual(manifest.uncovered_confirmed_ids, []);
assert.equal(manifest.approved, 198);
assert.equal(manifest.new, 100);
assert.equal(manifest.retained, 98);
assert.deepEqual(ids(plan.movements), ids(confirmed.filter(row=>row.decision==='NEEDS NEW ART')));
const uniqueFiles = new Set();
const uniqueMasters = new Set();
for (const row of confirmed) {
  const asset = manifest.movements.find(item=>item.id===row.id);
  assert.equal(asset.asset_status, 'APPROVED');
  assert.equal(asset.primary_muscle_group, row.artwork_primary_muscle_group);
  assert.deepEqual(asset.secondary_muscle_groups, row.secondary_muscle_groups, 'never rewrite missing/stored taxonomy');
  assert.equal(asset.stored_primary_muscle_group, row.primary_muscle_group);
  assert.ok(asset.implement);
  assert.deepEqual(registry[row.id], {key:row.key,primary:row.artwork_primary_muscle_group});
  const identity = {id:row.id,key:row.key,family:row.family,primary_muscle_group:row.primary_muscle_group};
  const selected = resolve({kind:'accessory',effective_movement_identity:identity});
  assert.equal(selected.artworkKey,row.key);
  assert.equal(selected.canonicalIdentityId,row.id);
  assert.equal(resolve({kind:'accessory',effective_movement_identity:{...identity,key:'wrong'}}).kind,'neutral');
  assert.equal(resolve({kind:'accessory',effective_movement_identity:{...identity,key:undefined}}).kind,'neutral');
  assert.equal(resolve({kind:'accessory',effective_movement_identity:{...identity,id:999999}}).kind,'neutral');
  assert.equal(resolve({kind:'accessory',effective_movement_identity:{...identity,primary_muscle_group:'invalid_primary'}}).kind,'neutral');
  assert.equal(resolve({kind:'accessory',effective_movement_identity:identity,performed_canonical_movement_identity:{...identity,id:999999}}).kind,'neutral');
  assert.equal(resolve({kind:'accessory',movement_identity:identity,is_substituted:true}).kind,'neutral');
  const input = canonicalArtworkInputForLoggerItem({
    id:90000+row.id,movement:'Unrelated display label',is_substituted:true,
    movement_identity:{id:314,key:'accessory_machine_dip',primary_muscle_group:'triceps'},
    effective_movement_identity:identity,performed_canonical_movement_identity:identity,
  });
  assert.equal(resolve(input).artworkKey,row.key,'effective subject owns swapped Logger art');
  for (const role of ['master','app','thumbnail']) {
    const file=asset.files[role], bytes=read(file.path);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
    assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],file.dimensions);
    if(role!=='master') assert.deepEqual(file.dimensions,role==='app'?[512,512]:[192,192]);
  }
  uniqueFiles.add(asset.files.app.path);
  uniqueMasters.add(asset.files.master.sha256);
  assert.ok(mappings.includes("require('@/" + asset.files.app.path + "')"));
  assert.ok(mappings.includes("require('@/" + asset.files.thumbnail.path + "')"));
  if(asset.generation_batch==='Completion') {
    assert.ok(reviews.some(review=>review.id===row.id && review.attempt===asset.attempt && review.status==='ACCEPT'));
    const attempt=json(doc+'attempts/'+row.id+'-'+asset.attempt+'.json');
    assert.ok(attempt.reference_paths[0].endsWith('/masters/dumbbell-incline-bench-press-v1.png'));
  } else {
    const prior=json('docs/validation/free-weight-'+asset.generation_batch.toLowerCase()+'-family-2026-09-11/asset-manifest.json').movements.find(item=>item.id===row.id);
    assert.deepEqual(asset.files,reviewedFreeWeightFiles(prior),'historical files remain immutable except exact reviewed head corrections');
  }
}
assert.equal(uniqueFiles.size,198);
assert.equal(uniqueMasters.size,198,'distinct definitions have independently generated masters');
for(const row of audit.records.filter(row=>!confirmed.some(item=>item.id===row.id))) {
  assert.equal(registry[row.id],undefined,'excluded/custom/retired/ambiguous IDs do not gain art');
}
for(const id of [4,5,6,7]) {
  const row=confirmed.find(item=>item.id===id);
  assert.equal(row.primary_muscle_group,null);
  assert.ok(row.artwork_primary_source.includes('GOVERNED_FAMILY_REGIONS'));
  assert.equal(resolve({kind:'accessory',id,key:row.key,family:row.family}).artworkKey,row.key,'existing typed family adapter supports independent legacy identity');
}
for(const id of [546,548]) assert.equal(manifest.movements.find(row=>row.id===id).generation_batch,'Completion');
for(const id of [321,342,343,344,499,595,603]) assert.equal(registry[id],undefined);
assert.equal(resolve({kind:'accessory',display_name:'Dumbbell Curl',equipment_type:'dumbbell',primary_muscle_group:'biceps'}).kind,'neutral','labels/equipment/muscles cannot select an exact asset');
assert.equal(resolve({kind:'core',core_movement_id:33,core_family:'bench'}).kind,'core');
const search=json(doc+'qa-search-serialized.json');
assert.equal(search.length,20);
assert.equal(search.flatMap(group=>group.items).length,194);
for(const group of search) for(const row of group.items) {
  assert.equal(group.http_status,200);
  assert.equal(resolve({...row,kind:'accessory'}).artworkKey,row.key,'real search DTO selects exact family member');
}
const serialized=json(doc+'qa-session-serialized.json').workout;
assert.equal(serialized.athlete_id,12);
const items=serialized.accessory_groups.flatMap(group=>group.items);
assert.deepEqual(items.map(item=>item.effective_movement_definition_id),[33,154,253,325,354,388,476,495,4,5,6,7]);
for(const item of items) {
  const selected=resolve(canonicalArtworkInputForLoggerItem(item));
  assert.equal(selected.artworkKey,item.effective_movement_identity.key);
  assert.equal(selected.canonicalIdentityId,item.effective_movement_definition_id);
}
assert.equal(crypto.createHash('sha256').update(read('assets/images/movement-artwork/free-weight-v1/masters/dumbbell-incline-bench-press-v1.png')).digest('hex'),'e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe');
console.log('[free-weight-complete-family] 198 exact assets, 100 reviewed additions, 98 prior identities with verified correction provenance, 194 real search DTOs, four independent legacy IDs, mixed-family Session and fail-closed identities passed');
