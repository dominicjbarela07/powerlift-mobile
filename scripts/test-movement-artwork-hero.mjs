import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveApprovedExactMovementArtwork, movementHeroFocal, movementHeroGeometry } from '../lib/movement-artwork-hero.ts';
import { CANONICAL_ACCESSORY_ARTWORK_IDENTITIES } from '../lib/canonical-movement-artwork.ts';
import { movementHeroSourceFrame } from '../lib/movement-artwork-geometry.mjs';
import { approvedExactArtworkPolicy, assertHumanArtworkGate } from './canonical-art-review-gate.mjs';
const state=JSON.parse(fs.readFileSync('artwork-review/review-state.json'));
const policy=JSON.parse(fs.readFileSync('artwork-review/runtime-policy.json'));
const subject=id=>({ identity_type:'accessory', movement_definition_id:id, key:CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[id]?.key, primary_muscle_group:CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[id]?.primary });
assertHumanArtworkGate();
assert.deepEqual(policy.approved_exact_artwork,approvedExactArtworkPolicy(state));
for (const row of state.canonical_assets) {
  const result=resolveApprovedExactMovementArtwork(subject(row.movement_definition_id),true,policy);
  const receipt=policy.approved_exact_artwork.find(entry=>entry.key===row.key);
  assert.equal(Boolean(result),Boolean(receipt),'only current positive human receipts enable exact heroes');
  assert.equal(resolveApprovedExactMovementArtwork(subject(row.movement_definition_id),false,policy),null,'DEV-only enhancement cannot enter release runtime');
}
const original=state.canonical_assets.find(row=>row.movement_definition_id===33);
const receipt={key:original.key,movement_definition_id:33,candidate_id:original.candidate_id,app_sha256:original.files.app.sha256};
const allowed={denied_keys:[],approved_exact_artwork:[receipt]};
assert.equal(resolveApprovedExactMovementArtwork(subject(33),true,allowed).key,original.key);
assert.equal(resolveApprovedExactMovementArtwork(subject(33),true,{denied_keys:[]}),null,'missing approval projection fails closed');
assert.equal(resolveApprovedExactMovementArtwork(subject(33),true,{...allowed,denied_keys:[original.key]}),null);
assert.equal(resolveApprovedExactMovementArtwork({...subject(33),key:'lookalike'},true,allowed),null);
assert.equal(resolveApprovedExactMovementArtwork({...subject(33),primary_muscle_group:'quads'},true,allowed),null);
assert.equal(resolveApprovedExactMovementArtwork({identity_type:'accessory',movement_definition_id:50000,key:original.key,primary_muscle_group:'chest'},true,allowed),null);
assert.equal(resolveApprovedExactMovementArtwork({movement:'Incline Dumbbell Bench Press'},true,allowed),null,'labels never grant hero eligibility');
assert.equal(resolveApprovedExactMovementArtwork({identity_type:'core',id:1,family:'squat'},true,allowed),null,'legacy Core family badges are not exact execution photographs');
assert.equal(resolveApprovedExactMovementArtwork({...subject(33),is_substituted:true},true,allowed),null);
assert.equal(resolveApprovedExactMovementArtwork({movement_identity:{id:33,key:original.key,primary_muscle_group:'chest'},performed_canonical_movement_identity:{id:113,key:'accessory_cable_lateral_raise',primary_muscle_group:'side_delts'}},true,allowed),null,'performed no-art identity must remove the programmed hero');
for(const [id,key] of [[121,'accessory_machine_lateral_raise'],[113,'accessory_cable_lateral_raise'],[309,'accessory_single_arm_cable_overhead_triceps_extension']]) {
  assert.equal(resolveApprovedExactMovementArtwork({identity_type:'accessory',movement_definition_id:id,key,primary_muscle_group:'side_delts'},true,allowed),null);
}
const fake=structuredClone(state);fake.items.find(row=>row.movement_definition_id===33).review.source='automation';
assert.ok(!approvedExactArtworkPolicy(fake).some(row=>row.movement_definition_id===33),'automation cannot manufacture positive approval');
const unpromoted=structuredClone(state);unpromoted.canonical_assets.find(row=>row.movement_definition_id===33).files.app.sha256='0'.repeat(64);
assert.ok(!approvedExactArtworkPolicy(unpromoted).some(row=>row.movement_definition_id===33),'approval is bound to mapped app bytes');
for(const id of [33,253,154,256,354]) for(const width of [288,343,393]) for(const height of [140,220,300]) {
  const key=CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[id].key;
  const focal=movementHeroFocal(key),box=movementHeroGeometry(width,height,focal);
  assert.ok(Object.values(box).every(Number.isFinite));
  assert.ok(box.width<=450&&box.width>0,'decode/layout dimensions stay bounded');
  const subjectX=box.left+focal.focalX*box.width;
  assert.ok(subjectX>width*.6&&subjectX<width*.92,'subject stays center-right with edge clearance');
  assert.equal(box.width,box.height,'square source is not stretched');
}
const read=path=>fs.readFileSync(path,'utf8');
for(const receipt of policy.approved_exact_artwork.filter(row=>row.presentation?.cropMode==='contain')) {
  for(const width of [288,343,393,430]) for(const height of [140,220,300]) {
    const box=movementHeroGeometry(width,height,movementHeroFocal(receipt.key));
    assert.equal(box.width,box.height,'approved square remains undistorted');
    assert.ok(box.left>=0 && box.top>=0 && box.left+box.width<=width && box.top+box.height<=height,
      `${receipt.key}: contain retains all head/hand/foot and machine contact points inside the hero`);
    assert.ok(box.left>=width*.38-1e-9,'contained artwork preserves left prescription space under the shared canvas scrim');
    assert.ok(box.width>=Math.min(width*.59,height*.75),'full compositions have meaningful hero weight');
  }
}
for (const row of state.canonical_assets) {
  const [sourceWidth, sourceHeight] = row.files.app.dimensions;
  const box=movementHeroGeometry(393,250,movementHeroFocal(row.key));
  const frame=movementHeroSourceFrame(box,sourceWidth,sourceHeight);
  assert.ok(Math.abs(frame.width/frame.height-sourceWidth/sourceHeight)<1e-9,`${row.key}: original aspect ratio`);
  assert.ok(frame.left>=box.left-1e-9&&frame.top>=box.top-1e-9&&frame.left+frame.width<=box.left+box.width+1e-9&&frame.top+frame.height<=box.top+box.height+1e-9);
  if(sourceWidth===sourceHeight) assert.deepEqual(frame,box,'square approved sources, including T-Bar Row, retain their exact geometry');
}
assert.deepEqual(movementHeroGeometry(393,250,movementHeroFocal('accessory_t_bar_row')),
  {width:270,height:270,left:167.61,top:45.8},'locked T-Bar Row composition');
const hero=read('components/movement/MovementArtworkHero.tsx');
assert.match(hero,/memo\(function MovementArtworkHero/);
assert.match(hero,/StyleSheet.absoluteFillObject/,'hero must not add layout height');
assert.match(hero,/cachePolicy="memory-disk"/);
assert.match(hero,/recyclingKey=\{receiptId\}/);
assert.match(hero,/reduceMotion \? 0 : 160/);
assert.match(hero,/locations=\{\[0, 0\.26, 0\.46, 0\.78, 1\]\}/,'one canvas fade for every composition');
assert.doesNotMatch(hero,/locations=\{contained \?/,'containment must never switch back to the photo-tile fade');
assert.doesNotMatch(hero,/setInterval|setTimeout|elapsedSeconds|elapsedMs|restRemaining|Date\.now|MuscleMap|help-outline|require\(/,'the image layer has no timer, fallback, identity guesses or independent asset paths');
const single=read('components/workout-logger/session-v3-movement.tsx');
assert.match(single,/resolveMovementArtworkPresentation\(visual\?\.movementArtworkInput, expanded, complete/);
assert.match(single,/<CanonicalMovementArtwork[^>]*requireHumanApproval movement=\{visual\?\.movementArtworkInput\} accessoryPresentation="muscle-focus"/,'targeted muscle context remains beside the canonical movement name');
assert.doesNotMatch(single,/!hero \? <CanonicalMovementArtwork/,'hero eligibility must never hide the muscle cue');
assert.match(single,/LoggerPlateStackVisual plateStack=\{endpoint.plateStack\}/,'Core physical loading survives');
const superset=read('components/workout-logger/superset-round-workspace.tsx');
assert.match(superset,/resolveMovementArtworkPresentation\(item\.movementArtwork, selected, movement.complete/);
assert.match(superset,/<CanonicalMovementArtwork[^>]*requireHumanApproval movement=\{item\.movementArtwork\} accessoryPresentation=\{thumbnailPresentation\}/,'each superset member retains its own governed muscle cue');
assert.doesNotMatch(superset,/!hero \? <CanonicalMovementArtwork/);
assert.doesNotMatch(superset,/Log superset round|MOVEMENT PROGRESS/);
const labPath='app/(tabs)/dev-mocks/movement-art-hero.tsx';
const releaseTrack=JSON.parse(read('app.json')).expo.extra?.releaseTrack;
const hasLab=fs.existsSync(labPath);
if(hasLab){
 const lab=read(labPath);
 assert.match(lab,/if \(!__DEV__\) return null/);
 assert.match(lab,/CANDIDATE CROP STUDY · NOT APPROVED/);
 assert.doesNotMatch(lab,/fetch\(|\.decide\(|human_approved\s*[:=]|approvals=/,'focal studies cannot grant approval');
} else {
 assert.equal(releaseTrack,'testflight','canonical DEV must retain its focal lab');
 assert.ok(JSON.parse(read('config/protected-fix-manifest.json')).releaseProjectionPaths.includes(labPath),'missing lab requires an explicit DEV release exclusion');
}
const layerConsumers=[];
for(const folder of ['components','app']) {
 const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=`${dir}/${entry.name}`;if(entry.isDirectory())walk(file);else if(/\.tsx$/.test(file)&&read(file).includes('<MovementArtworkHero '))layerConsumers.push(file);}};walk(folder);
}
assert.deepEqual(layerConsumers.sort(),[...(hasLab?[labPath]:[]),'components/workout-logger/session-v3-movement.tsx','components/workout-logger/superset-round-workspace.tsx'].sort(),'only the two eligibility-governed surfaces and isolated crop lab may mount hero art');
console.log('Movement hero: positive approval, exact identity, mapped-byte receipt, DEV scope, focal bounds, cached timer-independent layer, fallback, phase-independent and superset contracts PASS');
