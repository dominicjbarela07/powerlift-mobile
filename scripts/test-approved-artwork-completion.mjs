import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { resolveApprovedExactMovementArtwork, approvedLoggerCrop, movementHeroFocal } from '../lib/movement-artwork-hero.ts';
import { canonicalArtworkInputFromDefinition } from '../lib/canonical-movement-art-subject.ts';
import { approvedExactArtworkPolicy, approvedLoggerCropPolicy, assertHumanArtworkGate } from './canonical-art-review-gate.mjs';
import { movementHeroGeometry, movementHeroSourceFrame } from '../lib/movement-artwork-geometry.mjs';

const read=file=>JSON.parse(fs.readFileSync(file));
const state=read('artwork-review/review-state.json'), reuse=read('config/governed-movement-art-reuse.json');
const catalog=read('config/governed-movement-art-taxonomy.json');
const approvals=approvedExactArtworkPolicy(state), selected=new Set(), pending=[], pendingCrops=[];
assertHumanArtworkGate();
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const active of reuse.active_accessory_identities) {
 const definition=catalog.movements.find(row=>row.id===active.movement_definition_id && row.key===active.key);
 assert.ok(definition,`${active.key}: complete active catalog`);
 const input=canonicalArtworkInputFromDefinition(definition), frozen=structuredClone(input);
 const result=resolveApprovedExactMovementArtwork(input,true);
 assert.deepEqual(input,frozen,'visual reads never mutate Session identity');
 if(!result) {
  const versions=state.items.filter(row=>row.movement_definition_id===definition.id).sort((a,b)=>b.version-a.version);
  const latest=versions[0];
  assert.ok(latest && ['pending','rejected'].includes(latest.status),`${active.key}: approved accessory must not lose artwork`);
  assert.equal(latest.human_approved,false);
  pending.push({id:definition.id,key:definition.key,status:latest.status});
  continue;
 }
 assert.equal(result.movement_definition_id,definition.id,'shared image must preserve current movement ID');
 const item=state.items.find(row=>row.candidate_id===result.candidate_id);
 const mapping=state.canonical_assets.find(row=>row.candidate_id===item.candidate_id);
 assert.ok(approvals.some(row=>row.candidate_id===item.candidate_id && row.app_sha256===result.app_sha256));
 assert.equal(digest(mapping.files.app.path),result.app_sha256);
 const crop=approvedLoggerCropPolicy(state,item) ?? undefined;
 if(!crop) {
  // A newly approved replacement cannot inherit its rejected predecessor's crop.
  // Keep checking all existing approved crops; the replacement uses contain until reviewed.
  const prior=state.items.find(row=>row.candidate_id===item.supersedes_candidate_id);
  assert.ok(prior && prior.status==='rejected' && approvedLoggerCropPolicy(state,prior),`${definition.key}: missing expected approved crop`);
  assert.notEqual(item.files.master.sha256,prior.files.master.sha256);
  assert.equal(state.logger_crop_reviews[item.candidate_id],undefined,'new bytes must not receive the old crop decision');
  assert.equal(item.presentation.cropMode,'contain','uncropped replacement preserves full equipment');
  pendingCrops.push({id:definition.id,key:definition.key,candidate_id:item.candidate_id});
 }
 assert.deepEqual(approvedLoggerCrop(result.key),crop ?? undefined);
 for(const width of [320,375,393,430])for(const height of [220,300,360]) {
  const focal=movementHeroFocal(result.key), box=movementHeroGeometry(width,height,focal,crop);
  const frame=movementHeroSourceFrame(box,...item.files.app.dimensions);
  assert.ok(Object.values(frame).every(Number.isFinite));
  assert.ok(Math.abs(frame.width/frame.height-item.files.app.dimensions[0]/item.files.app.dimensions[1])<1e-9);
 }
 assert.equal(resolveApprovedExactMovementArtwork({...input,movement_identity:{...definition,key:'fixture_wrong_key'}},true),null,'contradictory ID/key cannot borrow art');
 selected.add(item.candidate_id);
}
for(const row of reuse.legacy_artwork_identities) {
 const input={movement_identity_contract:1,movement_definition_id:row.movement_definition_id,movement_identity:row.taxonomy};
 const before=structuredClone(input), result=resolveApprovedExactMovementArtwork(input,true);
 const source=approvals.find(p=>p.key===row.artwork_key && p.movement_definition_id===row.artwork_movement_definition_id);
 assert.equal(result?.candidate_id,source?.candidate_id,`${row.key}: old exact reference reuses only the governed survivor image`);
 if(result){assert.equal(result.movement_definition_id,row.movement_definition_id);assert.deepEqual(approvedLoggerCrop(result.key),source.logger_crop);}
 assert.deepEqual(input,before,'artwork reuse does not perform a Swap or rewrite historical provenance');
 assert.equal(resolveApprovedExactMovementArtwork({movement_definition_id:row.movement_definition_id,movement_identity:{...row.taxonomy,key:'fixture_wrong_key'}},true),null);
}
console.log(JSON.stringify({active_accessories:reuse.active_accessory_identities.length,approved_source_images:reuse.active_accessory_identities.length-pending.length,approved_with_exact_crops:reuse.active_accessory_identities.length-pending.length-pendingCrops.length,pending_source_approvals:pending,pending_replacement_crop_reviews:pendingCrops,verified_legacy_artwork_redirects:reuse.legacy_artwork_identities.length,production_art_runtime_unchanged:true}));
if(process.argv.includes('--require-complete'))assert.deepEqual(pending,[],'all accessory source images require owner approval before declaring complete coverage');
