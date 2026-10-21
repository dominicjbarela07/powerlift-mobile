import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeCurrentWorkoutItem } from '../lib/current-session-movement.ts';
import { resolveLoggerMovementIdentity, canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';
import { resolveMovementHistoryLaunchForItem } from '../lib/movement-history-launch.ts';
import { resolveApprovedExactMovementArtwork } from '../lib/movement-artwork-hero.ts';
import { canonicalArtworkInputFromDefinition } from '../lib/canonical-movement-art-subject.ts';
const catalog=JSON.parse(fs.readFileSync('config/governed-movement-art-taxonomy.json','utf8'));
const shared=catalog.movements.filter(r=>r.programming_contexts?.includes('core')&&r.programming_contexts.includes('accessory'));
assert.equal(shared.length,7);
for(const d of shared){
 const core=normalizeCurrentWorkoutItem({movement_identity_contract:1,movement_definition_id:d.id,movement_identity:d,
    lift:'VR',variant:'STRAIGHT',mode:'RPE'});
 const accessory=normalizeCurrentWorkoutItem({...core,lift:'AX',variant:'ACC',mode:'RIR'});
 assert.equal(core.movement_definition_id,accessory.movement_definition_id);
 assert.equal(resolveLoggerMovementIdentity(core).kind,'core');
 assert.equal(resolveLoggerMovementIdentity(accessory).kind,'accessory');
 assert.equal(accessory.mode,'RIR');
 assert.equal(accessory.variant,'ACC');
 assert.equal(resolveLoggerMovementIdentity(accessory).effective.id,d.id);
 assert.deepEqual(resolveMovementHistoryLaunchForItem({athleteId:7,item:core}),
    resolveMovementHistoryLaunchForItem({athleteId:7,item:accessory}));
 const binding=catalog.shared_artwork_identities.find(r=>r.movement_definition_id===d.id);
 assert(binding);
 const approvals={denied_keys:[],approved_exact_artwork:[{key:binding.artwork_key,
   movement_definition_id:binding.artwork_movement_definition_id,candidate_id:'qa',app_sha256:'a'.repeat(64)}]};
 for(const input of [canonicalArtworkInputForLoggerItem(core),canonicalArtworkInputForLoggerItem(accessory),canonicalArtworkInputFromDefinition(d)]){
  const art=resolveApprovedExactMovementArtwork(input,true,approvals);
  assert.equal(art?.movement_definition_id,d.id);
  assert.equal(art?.key,binding.artwork_key);
  assert.equal(resolveApprovedExactMovementArtwork(input,true,{...approvals,denied_keys:[binding.artwork_key]}),null);
  assert.equal(resolveApprovedExactMovementArtwork(input,true,{...approvals,approved_exact_artwork:[]}),null);
 }
}
console.log('Seven shared identities: separate Core/accessory tools, one history, original hash-bound artwork approvals PASS.');
