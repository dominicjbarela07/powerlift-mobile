import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertOnboardingBaseline,assertOnboardingDeployment,onboardingPaths} from './onboarding-release-scope.mjs';
import {assertClientFixScope} from './owner-directed-client-fix.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sl-onboarding-scope-'));
try{
 const write=(name,value)=>{const bytes=JSON.stringify(value);fs.writeFileSync(path.join(root,name),bytes);return {path:name,sha256:sha(bytes)};};
 const baseline={...Object.fromEntries(onboardingPaths.slice(0,9).map(p=>[p,'original'])),'assets/approved.png':'art','lib/videoUploadQueue.ts':'video'};
 const publication={id:'actual-update',gitCommitHash:'actual-source'};
 const fingerprint=sha(JSON.stringify(Object.entries(baseline).sort(([a],[b])=>a.localeCompare(b))));
 const state={verifiedProduction3VideoEngine:{publication,publishedProof:{gateC:write('gate.json',{pass:true,missing:[],candidateProductFingerprint:fingerprint,published:{...publication,servedBundleSha256:'bundle'}}),assetAudit:write('audit.json',{pass:true,missingOrCorrupt:0,updateId:publication.id,servedLaunchSha256:'bundle'})}}};
 const scope={scope:'onboarding-reliability-20261023',baselineUpdateId:publication.id,baselineSourceSha:publication.gitCommitHash,baselineProductFingerprint:fingerprint,baselineFiles:write('baseline.json',baseline),productFingerprint:'candidate',validation:'OWNER_DIRECTED_CONTRACTS_ONLY',ownerInstruction:'Yes — release onboarding and configure Stripe',changedProductFiles:Object.fromEntries(onboardingPaths.map(p=>[p,'fixed'])),contracts:Object.fromEntries(['scripts/test-onboarding-recovery.mjs','scripts/test-onboarding-release-scope.mjs'].map(p=>[p,'hash']))};
 const files={...baseline,...scope.changedProductFiles};const check=(f=files,s=scope)=>assertOnboardingBaseline({root,scope:s,state,files:f});
 const changes=check();const owner='Release validated onboarding to Production and mobile 3.0, including configuring the webhook. '+scope.ownerInstruction;
 assertClientFixScope(scope,'candidate',changes,owner);
 for(const bad of [{...files,'lib/hidden.ts':'hidden'},{...files,'assets/approved.png':'changed'},{...files,'lib/videoUploadQueue.ts':'regressed'}])assert.throws(()=>check(bad),/unrelated/);
 const lost={...files};delete lost['assets/approved.png'];assert.throws(()=>check(lost),/remove published/);
 assert.throws(()=>check(files,{...scope,baselineUpdateId:'invented'}),/actual latest/);
 assert.throws(()=>check(files,{...scope,baselineSourceSha:'invented'}),/actual latest/);
 assert.throws(()=>assertClientFixScope(scope,'candidate',changes,scope.ownerInstruction),/approved onboarding/);
 assert.throws(()=>assertClientFixScope(scope,'changed',changes,owner),/changed product/);
 const deployed={sourceSha:'backend',liveVerified:true,gate:{pass:true},schemaRevision:'f5b7d9e1a3c5',supportWorker:{sourceSha:'backend',liveVerified:true},preflight:{ready:true,checks:{webhook:true}},signatureProbe:{validAccepted:true,invalidRejected:true,duplicateSafe:true}},live={source_sha:'backend',ready:true};
 assertOnboardingDeployment(deployed,'backend',live);
 for(const mutate of [d=>d.sourceSha='stale',d=>d.gate.pass=false,d=>d.schemaRevision='old',d=>d.supportWorker.liveVerified=false,d=>d.supportWorker.sourceSha='stale',d=>d.preflight.ready=false,d=>d.preflight.checks.webhook=false,d=>d.signatureProbe.invalidRejected=false,d=>d.signatureProbe.duplicateSafe=false]){const bad=structuredClone(deployed);mutate(bad);assert.throws(()=>assertOnboardingDeployment(bad,'backend',live));}
 assert.throws(()=>assertOnboardingDeployment(deployed,'backend',{...live,source_sha:'stale'}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('PASS: onboarding release retains exact current 3.0 video/art baseline, thirteen bounded source paths, complete owner authorization, matching live schema/worker/Stripe configuration and signed verification; deliberate hidden changes and regressions rejected.');
