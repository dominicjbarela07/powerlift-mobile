import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { MACHINE_EQUIPMENT_TYPES } from '../lib/machine-equipment.ts';
import { equipmentFlowSubject, equipmentFlowVariants, equipmentFlowWrite } from '../lib/equipment-flow-subject.ts';

const source = fs.readFileSync('lib/equipment-type-artwork.ts', 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function load(dev, channel = '') {
  const requested = [], exports = {};
  vm.runInNewContext(code, {exports,__DEV__:dev,process:{env:{EXPO_PUBLIC_APPROVED_ART_CHANNEL:channel}},require:file=>{ requested.push(file); return file; }});
  return {artwork:exports.EQUIPMENT_TYPE_ARTWORK,cable:exports.CABLE_EQUIPMENT_TYPE_ARTWORK,requested};
}
const dev = load(true), release = load(false), testflight = load(false, 'testflight');
assert.equal(testflight.requested.length,4,'TestFlight imports the approved machine and cable category pairs');
assert.deepEqual(Object.keys(testflight.artwork),Object.keys(dev.artwork));
assert.deepEqual(Object.keys(dev.artwork).sort(), MACHINE_EQUIPMENT_TYPES.map(row=>row.key).sort());
assert.equal(dev.requested.length,4,'DEV imports the approved cable image and reuses the stack');
assert.ok(testflight.cable,'owner-approved exact cable image ships to TestFlight');
assert.equal(release.cable,null,'Production art remains unchanged');
assert.equal(release.artwork,null);
assert.equal(release.requested.length,0,'Production does not execute these image requires');
assert.equal(dev.artwork.machine,undefined,'no broad machine or display-label fallback');
assert.equal(dev.artwork['Plate Loaded'],undefined);
assert.equal(dev.artwork.cable,undefined);
assert.equal(dev.cable.selectorized.source,dev.artwork.selectorized.source,'approved selectorized stack is reused');
assert.match(dev.cable.plate_loaded.source,/cable-review\/plate-loaded-cable-station-candidate-v1\.png$/);
assert.equal(testflight.cable.plate_loaded.source,dev.cable.plate_loaded.source);
assert.notEqual(dev.cable.plate_loaded.source,dev.artwork.plate_loaded.source,'generic loading horn does not stand in for cable art');
const cableReview=JSON.parse(fs.readFileSync('artwork-review/equipment-types/plate-loaded-cable-station-v1/review.json'));
assert.equal(cableReview.review_status,'owner_approved_testflight');
assert.equal(cableReview.release_eligible,true);
const exportGuard=fs.readFileSync('scripts/assert-no-dev-artwork-export.mjs','utf8');
assert.match(exportGuard,/allKnown\.add\(expected\)/,'approved cable bytes are governed in the OTA export');
assert.match(exportGuard,/if \(testflight\) allowed\.add\(cable\.app_sha256\)/,'only TestFlight may bundle the exact cable derivative');
for(const [file,hash] of [
  ['artwork-review/equipment-types/plate-loaded-cable-station-v1/master.png',cableReview.master_sha256],
  ['assets/images/equipment-types/cable-review/plate-loaded-cable-station-candidate-v1.png',cableReview.app_sha256],
]) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash);
const manifest = JSON.parse(fs.readFileSync('docs/validation/equipment-type-art-2026-09-13/asset-manifest.json'));
assert.deepEqual(manifest.assets.map(row=>row.key).sort(),Object.keys(dev.artwork).sort());
const hashes = new Set();
for (const row of manifest.assets) {
  assert.equal(dev.artwork[row.key].source,'@/'+row.files.app.path);
  for(const file of Object.values(row.files)) {
    const bytes=fs.readFileSync(file.path);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
    assert.equal(bytes.readUInt32BE(16),bytes.readUInt32BE(20),'square close-up supports contained mobile tiles');
  }
  hashes.add(row.files.app.sha256);
}
assert.equal(hashes.size,2,'different physical mechanisms cannot share an image');
const identity = {id:48,key:'accessory_machine_chest_press',display_name:'Machine Chest Press',equipment_type:'machine',execution_family:'MACHINE',primary_muscle_group:'chest'};
const item = {id:9001,effective_movement_identity:identity,effective_movement_definition_id:48};
const subject = equipmentFlowSubject(item);
for (const row of equipmentFlowVariants(subject)) {
  assert.ok(dev.artwork[row.key]);
  assert.deepEqual(equipmentFlowWrite(subject,'prime_fitness',row.key), {manufacturer_key:'prime_fitness',equipment_type:row.key});
}
assert.deepEqual(equipmentFlowVariants(equipmentFlowSubject({...item,effective_movement_identity:{...identity,equipment_type:'plate_loaded_machine'}})).map(row=>row.key),['plate_loaded']);
const route=fs.readFileSync('app/(tabs)/workout/[workoutId].tsx','utf8');
assert.match(route,/identityPickerSubject\?\.domain === 'cable'/,'approved cable category presentation remains explicit');
assert.match(route,/<EquipmentTypeChoice[\s\S]*equipmentType=\{variant.key\}[\s\S]*onPress=\{\(\) => void chooseEquipmentVariant\(variant.key\)\}/,'same governed key drives art and existing selection callback');
const component=fs.readFileSync('components/workout-logger/equipment-type-choice.tsx','utf8');
assert.match(component,/contentFit="contain"/,'never clip the plates or selector pin');
assert.doesNotMatch(component,/fetchJson|fetch\(|manufacturer_key|performed_movement/,'presentation owns no identity mutations');
console.log('Equipment category art: approved machine and cable pairs on TestFlight, Production unchanged PASS');
