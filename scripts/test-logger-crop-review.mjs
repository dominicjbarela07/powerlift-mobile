import assert from 'node:assert/strict';
import fs from 'node:fs';
import { movementHeroGeometry, movementHeroSourceFrame, DEFAULT_FOCAL, DEFAULT_LOGGER_CROP } from '../lib/movement-artwork-geometry.mjs';
import { approvedLoggerCropPolicy } from './canonical-art-review-gate.mjs';
for (const width of [339,354,394]) for (const height of [260,300,360]) for (const cropMode of ['focal','contain']) {
  const focal={...DEFAULT_FOCAL,cropMode}, base=movementHeroGeometry(width,height,focal);
  assert.deepEqual(movementHeroGeometry(width,height,focal,DEFAULT_LOGGER_CROP),base,'unreviewed framing is unchanged');
  const moved=movementHeroGeometry(width,height,focal,{fit:'original',zoom:1,x:.1,y:-.1});
  assert.ok(Math.abs(moved.left-base.left-width*.1)<1e-10);
  assert.ok(Math.abs(moved.top-base.top+height*.1)<1e-10);
  const resized=movementHeroGeometry(width,height,focal,{fit:'original',zoom:1.2,x:0,y:0});
  assert.equal(resized.width,base.width*1.2);
  assert.ok(Math.abs(resized.left+resized.width/2-base.left-base.width/2)<1e-10,'zoom preserves center');
  assert.deepEqual(movementHeroGeometry(width,height,DEFAULT_FOCAL,{...DEFAULT_LOGGER_CROP,fit:cropMode}),base,'fit shares canonical geometry');
  const image=movementHeroSourceFrame(resized,1600,900);
  assert.ok(Math.abs(image.width/image.height-1600/900)<1e-10,'source aspect ratio is preserved');
}
const item={candidate_id:'fixture',files:{master:{sha256:'a'.repeat(64)},app:{sha256:'b'.repeat(64)}}};
const receipt={action:'approve',source:'human_logger_crop_ui',reviewer_user_id:1,candidate_sha256:item.files.master.sha256,app_sha256:item.files.app.sha256,crop:DEFAULT_LOGGER_CROP};
const state={logger_crop_reviews:{fixture:{status:'approved',review:receipt,history:[receipt],crop:DEFAULT_LOGGER_CROP}}};
assert.deepEqual(approvedLoggerCropPolicy(state,item),DEFAULT_LOGGER_CROP);
assert.equal(approvedLoggerCropPolicy(state,{...item,test_only:true}),null);
for(const change of [{source:'automated'},{source:'isolated_qa_logger_crop_ui'},{reviewer_user_id:0},{app_sha256:'c'.repeat(64)},{candidate_sha256:'d'.repeat(64)},{action:'save'}]) {
  const changed=structuredClone(state);Object.assign(changed.logger_crop_reviews.fixture.review,change);
  assert.equal(approvedLoggerCropPolicy(changed,item),null);
}
const layer=fs.readFileSync('components/movement/MovementArtworkHero.tsx','utf8');
const preview=fs.readFileSync('scripts/logger-art-review-entry.tsx','utf8');
const session=fs.readFileSync('components/workout-logger/session-v3-movement.tsx','utf8');
assert.match(layer,/<MovementArtworkHeroLayer/);
assert.match(preview,/<MovementArtworkHeroLayer/);
assert.match(session,/<SessionV3MovementLayout/);
assert.match(preview,/<SessionV3MovementLayout/);
assert.match(preview,/<SessionEquipmentContext/);
assert.match(preview,/<SessionHistoryPeek/);
assert.doesNotMatch(preview,/AuthProvider|fetch\(|logSet|saveWorkout/,'the preview never mounts the application state machine');
console.log('Logger crop geometry, immutable aspect ratio, exact receipts and shared renderer PASS');
