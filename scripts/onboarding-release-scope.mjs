import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const onboardingPaths=['app/index.tsx','app/login.tsx','app/verify-email.tsx','app/billing-return.tsx','app/_layout.tsx','app/(tabs)/link-coach.tsx','app/(tabs)/settings.tsx','context/AuthContext.tsx','lib/api.ts','lib/checkoutBrowser.ts','lib/onboarding-message.ts','components/onboarding/OnboardingProgress.tsx','components/onboarding/OnboardingSupport.tsx'].sort();
export function assertOnboardingBaseline({root,scope,state,files}){
 assert.equal(scope.scope,'onboarding-reliability-20261023');
 const previous=state.verifiedProduction3VideoEngine;
 assert.equal(scope.baselineUpdateId,previous.publication.id,'Retain actual latest 3.0 update');
 assert.equal(scope.baselineSourceSha,previous.publication.gitCommitHash,'Retain actual latest 3.0 source');
 const read=entry=>{const bytes=fs.readFileSync(path.resolve(root,entry.path));assert.equal(sha(bytes),entry.sha256,'Onboarding baseline proof changed');return JSON.parse(bytes);};
 const gate=read(previous.publishedProof.gateC),audit=read(previous.publishedProof.assetAudit),baseline=read(scope.baselineFiles);
 assert.equal(gate.pass,true);assert.deepEqual(gate.missing,[]);assert.equal(gate.published.id,scope.baselineUpdateId);assert.equal(gate.published.gitCommitHash,scope.baselineSourceSha);
 assert.equal(audit.pass,true);assert.equal(audit.missingOrCorrupt,0);assert.equal(audit.updateId,gate.published.id);assert.equal(audit.servedLaunchSha256,gate.published.servedBundleSha256);
 const fingerprint=sha(JSON.stringify(Object.entries(baseline).sort(([a],[b])=>a.localeCompare(b))));assert.equal(fingerprint,gate.candidateProductFingerprint);assert.equal(fingerprint,scope.baselineProductFingerprint);
 assert.deepEqual(Object.keys(baseline).filter(file=>!files[file]),[],'Onboarding cannot remove published source or artwork');
 const changes=Object.entries(files).filter(([file,hash])=>baseline[file]!==hash).map(([path,after])=>({path,after}));
 assert.deepEqual(changes.map(row=>row.path).sort(),onboardingPaths,'Onboarding cannot include unrelated source, native configuration or artwork');return changes;
}
export function assertOnboardingDeployment(deployment,expectedSha,live){
 assert.equal(deployment.sourceSha,expectedSha);assert.equal(deployment.liveVerified,true);assert.equal(deployment.gate.pass,true);
 assert.equal(deployment.schemaRevision,'f5b7d9e1a3c5');assert.equal(deployment.supportWorker.sourceSha,expectedSha);assert.equal(deployment.supportWorker.liveVerified,true);
 assert.equal(deployment.preflight.ready,true);assert.ok(Object.values(deployment.preflight.checks).every(Boolean));
 assert.equal(deployment.signatureProbe.validAccepted,true);assert.equal(deployment.signatureProbe.invalidRejected,true);assert.equal(deployment.signatureProbe.duplicateSafe,true);
 assert.equal(live.source_sha,expectedSha,'Matching onboarding backend must be live before mobile publication');assert.equal(live.ready,true);
}
export function verifyOnboardingDeployment({root,scope,state}){
 const bytes=fs.readFileSync(path.resolve(root,scope.backendDeploymentReceipt.path));assert.equal(sha(bytes),scope.backendDeploymentReceipt.sha256,'Onboarding deployment evidence changed');
 const live=JSON.parse(execFileSync('/usr/bin/curl',['--fail','--silent','--show-error','--max-time','20','https://app.strengthledger.fit/health/recognition'],{encoding:'utf8'}));assertOnboardingDeployment(JSON.parse(bytes),scope.backendSourceSha,live);
 const remote=JSON.parse(execFileSync('npx',['eas-cli','update:list','--branch','production-3-preparation','--limit','5','--json','--non-interactive'],{cwd:root,encoding:'utf8'}));
 assert.equal(remote.name,'production-3-preparation');const latest=remote.currentPage.find(u=>u.platforms.includes('ios'));assert.equal(latest?.group,state.verifiedProduction3VideoEngine.publication.group,'Active 3.0 changed; reconcile before onboarding publication');assert.equal(latest.runtimeVersion,'3.0.0');
}
