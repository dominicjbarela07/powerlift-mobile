import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertVideoEngineBaseline, assertVideoEngineDeployment, assertActiveVideoBaseline, videoEnginePaths } from './video-engine-release-scope.mjs';
import { assertClientFixScope } from './owner-directed-client-fix.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-video-scope-'));
try {
  const write = (file, data) => { const bytes=JSON.stringify(data);fs.writeFileSync(path.join(root,file),bytes);return {path:file,sha256:hash(bytes)}; };
  const baseline = {...Object.fromEntries(videoEnginePaths.filter(p=>!p.endsWith('videoArtifactCache.ts')).map(p=>[p,'original'])),'assets/approved.png':'approved'};
  const publication={id:'actual-update',gitCommitHash:'actual-source'};
  const fingerprint=hash(JSON.stringify(Object.entries(baseline).sort(([a],[b])=>a.localeCompare(b))));
  const state={verifiedProduction3ApprovedArtworkPortability:{publication,publishedProof:{
    gateC:write('gate.json',{pass:true,missing:[],candidateProductFingerprint:fingerprint,published:{...publication,servedBundleSha256:'bundle'}}),
    assetAudit:write('audit.json',{pass:true,missingOrCorrupt:0,updateId:publication.id,servedLaunchSha256:'bundle'}),
  }}};
  const ownerInstruction="Once it's that and safe and validated, please push it. I want it released.";
  const ownerText='video uploads, video downloads, video playback. Baked Overlay 2. '+ownerInstruction;
  const scope={scope:'video-engine-20261022',baselineUpdateId:publication.id,baselineSourceSha:publication.gitCommitHash,baselineProductFingerprint:fingerprint,baselineFiles:write('baseline.json',baseline),productFingerprint:'candidate',validation:'OWNER_DIRECTED_CONTRACTS_ONLY',ownerInstruction,changedProductFiles:Object.fromEntries(videoEnginePaths.map(p=>[p,'fixed'])),contracts:Object.fromEntries(['scripts/test-video-artifact-cache.mjs','scripts/test-video-engine-failure-controls.mjs','scripts/test-video-engine-queue.mjs','scripts/test-video-engine-release-scope.mjs','scripts/test-video-player-recovery.mjs'].map(p=>[p,'hash']))};
  const files={...baseline,...scope.changedProductFiles};
  const check=(f=files,s=scope)=>assertVideoEngineBaseline({root,scope:s,state,files:f});
  const modifications=check();assertClientFixScope(scope,'candidate',modifications,ownerText);
  assert.throws(()=>check({...files,'lib/unrelated.ts':'hidden'}),/unrelated/);
  const removed={...files};delete removed['assets/approved.png'];assert.throws(()=>check(removed),/remove published/);
  assert.throws(()=>check({...files,'assets/approved.png':'replacement'}),/unrelated/);
  assert.throws(()=>check(files,{...scope,baselineUpdateId:'invented'}),/actual latest/);
  assert.throws(()=>check(files,{...scope,baselineSourceSha:'invented'}),/actual latest/);
  assert.throws(()=>check(files,{...scope,baselineFiles:write('fake.json',files)}));
  assert.throws(()=>assertClientFixScope(scope,'changed',modifications,ownerText),/changed product source/);
  assert.throws(()=>assertClientFixScope(scope,'candidate',modifications,ownerInstruction),/complete video/);
  const deployed={sourceSha:'backend',liveVerified:true,gate:{pass:true},worker:{sourceSha:'backend',liveVerified:true},schemaRevision:'f3e5a7b9c1d3',cloud:{passed:true,syntheticCleanupVerified:true}},live={source_sha:'backend',ready:true};
  assertVideoEngineDeployment(deployed,'backend',live);
  const remote={name:'production-3-preparation',currentPage:[{platforms:'ios',group:'actual-group',runtimeVersion:'3.0.0'}]};
  assertActiveVideoBaseline(remote,{group:'actual-group'});
  assert.throws(()=>assertActiveVideoBaseline({...remote,name:'testflight'},{group:'actual-group'}));
  assert.throws(()=>assertActiveVideoBaseline(remote,{group:'stale-group'}),/active 3.0 changed/);
  assert.throws(()=>assertActiveVideoBaseline({...remote,currentPage:[]},{group:'actual-group'}));
  for(const mutate of [d=>d.worker.sourceSha='stale',d=>d.worker.liveVerified=false,d=>d.schemaRevision='old',d=>d.gate.pass=false,d=>d.cloud.passed=false,d=>d.cloud.syntheticCleanupVerified=false]){const bad=structuredClone(deployed);mutate(bad);assert.throws(()=>assertVideoEngineDeployment(bad,'backend',live));}
  assert.throws(()=>assertVideoEngineDeployment(deployed,'backend',{...live,source_sha:'stale'}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('PASS: video release requires exact latest 3.0 baseline, four bounded video files, existing artwork, complete owner instruction, deployed matching worker/schema/cloud and live backend; deliberate substitutions rejected.');
