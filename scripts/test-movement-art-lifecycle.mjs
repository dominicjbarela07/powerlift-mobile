import assert from 'node:assert/strict';
import { expectedDirectArtworkKey, assertReviewedArtworkReuse } from './artwork-review-expectations.mjs';
import { resolveCanonicalMovementArtwork as resolve, normalizeCanonicalMovementArtSubject as subject, canonicalArtworkInputFromDefinition, CANONICAL_ACCESSORY_ARTWORK_IDENTITIES } from '../lib/canonical-movement-artwork.ts';
import { canonicalArtworkInputForLoggerItem } from '../lib/logger-movement-identity.ts';
import { resolveApprovedExactMovementArtwork } from '../lib/movement-artwork-hero.ts';

const press = {id:79,key:'accessory_seated_dumbbell_shoulder_press',family:'accessory_front_delts',primary_muscle_group:'front_delts',secondary_muscle_groups:['side_delts','triceps'],equipment_type:'dumbbell'};
const machine = {id:596,key:'custom_coach_e795f5e3d90e4e1796a6a561cb04c04a',family:'accessory_shoulders',primary_muscle_group:'side_delts',secondary_muscle_groups:[],equipment_type:'machine'};
const programmed = {id:91,key:'accessory_machine_shoulder_press',primary_muscle_group:'front_delts',secondary_muscle_groups:['side_delts','triceps'],equipment_type:'machine'};
const equipment = {id:27,key:'machine_equipment_8_arsenal_strength_selectorized',equipment_type:'selectorized_machine'};
const completed = identity => ({item_id:90001,kind:'accessory',primary_muscle_group:identity.primary_muscle_group,secondary_muscle_groups:identity.secondary_muscle_groups,
  measurement:{canonical_identity_id:identity.id,canonical_identity_key:identity.key,equipment_type:identity.equipment_type},
  sets:[{id:79,performed_canonical_movement_definition_id:identity.id,performed_canonical_movement_identity:identity,identity_snapshot:{performed_canonical_movement_definition_id:identity.id}}]});
function invariant(identity, denied=()=>false) {
  const active = resolve(canonicalArtworkInputForLoggerItem({id:90001,effective_movement_identity:identity}),denied);
  const recap = resolve(completed(identity),denied);
  assert.notEqual(active.kind,'neutral');
  assert.deepEqual(recap,active,'completion cannot reduce the same performed identity or taxonomy');
  return recap;
}
assert.equal(invariant(press).artworkKey,press.key);
assert.equal(invariant(machine).artworkKey,undefined);
for (const status of ['pending','rejected']) {
  const anatomy=invariant(press,()=>true);
  assert.equal(anatomy.kind,'accessory',`${status} exact photography cannot invalidate the movement`);
  assert.equal(anatomy.artworkKey,undefined);
  const policy={denied_keys:[press.key],approved_exact_artwork:[]};
  assert.equal(resolveApprovedExactMovementArtwork(completed(press),true,policy),null);
}
assert.ok(resolveApprovedExactMovementArtwork(completed(press),true),'exact current human receipt remains eligible');
assert.equal(resolveApprovedExactMovementArtwork(completed(press),false),null,'existing DEV-only photography release boundary survives');
const minimalRecap={...completed(press),sets:[]};
assert.equal(resolve(minimalRecap).artworkKey,press.key,'older recap measurement canonical key survives without nested definitions');
assert.equal(subject(completed(press)).source,'performed_evidence');
assert.equal(subject({kind:'accessory',movement_identity:programmed,effective_movement_definition_id:79,is_substituted:true}).canonicalIdentityId,79,'thin effective ID never falls back to programmed A');
const contradictorySecond=structuredClone(completed(press));contradictorySecond.sets.push({...contradictorySecond.sets[0],identity_snapshot:{performed_canonical_movement_definition_id:596}});
assert.equal(resolve(contradictorySecond).kind,'neutral','every immutable set snapshot is checked, including later sets');
assert.deepEqual(resolve({...completed(press),movement_identity:programmed,is_substituted:true}),resolve(completed(press)),'immutable performed B outranks programmed A');
assert.equal(resolve({kind:'accessory',movement_identity:programmed,is_substituted:true}).kind,'neutral','incomplete substitution never paints A');
assert.deepEqual(resolve({kind:'accessory',effective_movement_identity:machine,performed_movement_identity:equipment}),resolve({kind:'accessory',effective_movement_identity:machine}),'physical equipment materialization does not become movement identity');
for(const row of [completed(press),completed(machine)]) assert.notEqual(resolve(row).kind,'neutral','each superset member keeps its own identity');
assert.notEqual(resolve(completed(press)).regionKey,resolve(completed(machine)).regionKey);
assert.equal(resolve({...completed(press),sets:[...completed(press).sets,...completed(machine).sets]}).kind,'neutral','mixed evidence cannot be represented as one exact movement');
const legacy={kind:'accessory',legacy:{state:'legacy_resolved',effective_movement_definition_id:596,effective_movement_identity:machine}};
assert.deepEqual(resolve(legacy),resolve(completed(machine)));
assert.deepEqual(resolve({...legacy,legacy:{...legacy.legacy,state:'legacy_unresolved'}}),resolve(completed(machine)),'historical provenance state cannot erase an explicit server-governed effective mapping');
const taxonomyLegacy={kind:'accessory',legacy:{state:'legacy_resolved',effective_movement_identity:{primary_muscle_group:'front_delts',secondary_muscle_groups:['triceps']}}};
assert.equal(resolve(taxonomyLegacy).kind,'accessory','deterministically governed taxonomy does not require a photo or numeric ID');
assert.equal(resolve({kind:'accessory',movement:'invented arbitrary name',id:79}).kind,'neutral');
for(const id of [79,253,596]) {
  const row=resolve({kind:'accessory',id,key:press.key,primary_muscle_group:'front_delts'});
  assert.equal(row.canonicalIdentityId,null,'generic row ID is never canonical movement identity');
  assert.equal(row.artworkKey,undefined,'row-ID collisions cannot acquire exact photography');
}
assert.equal(resolve({kind:'core',id:1,family:'squat'}).kind,'neutral');
assert.equal(resolve(canonicalArtworkInputFromDefinition({id:1,kind:'competition',identity_type:'core',family:'squat'})).kind,'core');
assert.equal(resolve({kind:'accessory',effective_movement_identity:press,performed_canonical_movement_identity:machine}).kind,'neutral');
const frozen=completed(press);frozen.sets[0].primary_muscle_group_snapshot='rear_delts';
assert.equal(resolve(frozen).regionKey,'rear_delts','available immutable taxonomy wins over later definition metadata');
assert.equal(resolve(frozen).artworkKey,undefined,'changed taxonomy does not reuse an incompatible exact photo');
for(const [id,row] of Object.entries(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES)) {
  const identity={id:Number(id),key:row.key,primary_muscle_group:row.primary,secondary_muscle_groups:[]};
  invariant(identity);
  assertReviewedArtworkReuse(completed(identity),Number(id),row.key);
  assert.equal(resolve({kind:'accessory',movement_definition_id:Number(id)}).regionKey,row.primary,'registered canonical ID may enrich missing taxonomy deterministically');
  assert.equal(resolve({...completed(identity),sets:[]}).artworkKey,expectedDirectArtworkKey(row.key),'all registered recap keys, not only Shoulder Press');
  assert.equal(resolve({...completed(identity),sets:[],measurement:{canonical_identity_id:Number(id)}}).kind,'accessory','missing exact-art key cannot erase existing taxonomy');
}
console.log('Movement art lifecycle: all registered identities, saved/legacy recap contracts, substitution, equipment, superset, approval separation, frozen taxonomy and row-ID collision regressions PASS');
