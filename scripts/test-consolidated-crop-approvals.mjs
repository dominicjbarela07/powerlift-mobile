import assert from 'node:assert/strict';
import fs from 'node:fs';
import { approvedExactArtworkPolicy, consolidatedArtworkBinding, assertHumanArtworkGate } from './canonical-art-review-gate.mjs';
import { canonicalArtworkInputFromDefinition } from '../lib/canonical-movement-art-subject.ts';
import { resolveApprovedExactMovementArtwork, approvedLoggerCrop, reportApprovedArtworkBypass } from '../lib/movement-artwork-hero.ts';

const state=JSON.parse(fs.readFileSync('artwork-review/review-state.json','utf8'));
const taxonomy=JSON.parse(fs.readFileSync('config/governed-movement-art-taxonomy.json','utf8'));
assert.equal(state.consolidated_artwork_bindings.length,2);
assertHumanArtworkGate();
for(const binding of state.consolidated_artwork_bindings){
 const source=state.items.find(r=>r.candidate_id===binding.candidate_id);
 const target=taxonomy.movements.find(r=>r.id===binding.movement_definition_id);
 const input=canonicalArtworkInputFromDefinition(target);
 const art=resolveApprovedExactMovementArtwork(input,true);
 assert.equal(art.key,binding.artwork_key);
 assert.equal(art.movement_definition_id,target.id);
 assert.equal(art.candidate_id,source.candidate_id);
 assert.equal(art.app_sha256,source.files.app.sha256);
 assert.deepEqual(approvedLoggerCrop(art.key),state.logger_crop_reviews[source.candidate_id].crop);
 const warnings=[];const warn=console.warn;console.warn=(...args)=>warnings.push(args);
 try{reportApprovedArtworkBypass(input,art.key,'consolidated-crop-test',undefined,true);}finally{console.warn=warn;}
 assert.equal(warnings.length,0,'using the selected approved image is not an artwork bypass');
 for(const corruption of ['hash','receipt','sourceApproval']){
  const invalid=structuredClone(state);
  const record=invalid.consolidated_artwork_bindings.find(r=>r.candidate_id===source.candidate_id);
  if(corruption==='hash')record.app_sha256='0'.repeat(64);
  if(corruption==='receipt')record.crop_approval.reviewer_user_id=0;
  if(corruption==='sourceApproval')invalid.items.find(r=>r.candidate_id===source.candidate_id).human_approved=false;
  assert(!approvedExactArtworkPolicy(invalid).some(r=>r.candidate_id===source.candidate_id));
 }
 assert(consolidatedArtworkBinding(state,source));
}
console.log('Consolidated crop approvals: exact approved source bytes, original framing, canonical target ID and fail-closed receipts PASS');
