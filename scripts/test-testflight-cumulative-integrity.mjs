import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compareProtectedFiles, assertProtectedArtifactAssets, assertRuntimeEvidence, assertOwnerEvidence, sha256 } from './testflight-cumulative-integrity.mjs';

const hash='a'.repeat(64);
assert.equal(compareProtectedFiles({'settings':hash},{},[]).violations.length,1);
assert.throws(() => assertOwnerEvidence('.', [{ownerInstruction:'obsolete',ownerEvidenceSha256:hash}]), /retained evidence/);
assert.throws(() => assertOwnerEvidence('.', [{ownerInstruction:'Owner approves removal',ownerEvidencePath:'missing-owner-evidence.txt',ownerEvidenceSha256:hash}]), /missing/);
assert.equal(compareProtectedFiles({'handler':hash},{handler:'b'.repeat(64)},[]).violations.length,1,
  'functional changes in an existing file must be reviewable negative deltas');
assert.equal(compareProtectedFiles({'settings':hash},{},[{path:'settings',before:hash,after:null,ownerInstruction:'Owner explicitly removes this exact control',ownerEvidenceSha256:hash}]).violations.length,0);
assert.equal(compareProtectedFiles({'settings':hash},{},[{path:'settings',before:hash,after:null,reason:'obsolete'}]).violations.length,1,
  'an agent reason is not owner authorization');
assert.throws(()=>assertProtectedArtifactAssets(['previous-valid-art'],[]),/UNAUTHORIZED TESTFLIGHT ASSET SUBTRACTION/);
assert.throws(()=>assertProtectedArtifactAssets(['r47-feature'],['r52-regressed-baseline']),/SUBTRACTION/,
  'the historical protected state must survive even when the immediately previous release was regressed');
assert.throws(()=>assertRuntimeEvidence(null,'source',['visible-pr'],'.'),/runtime proof is missing/);
assert.throws(()=>assertRuntimeEvidence({productFingerprint:'old'},'current',[],'.'),/different product source/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sl-release-proof-test-'));
try {
  fs.writeFileSync(path.join(dir,'proof.txt'),'Actual observed result');
  const receipt={productFingerprint:'source',backendSourceSha:'a'.repeat(40),backendProductFingerprint:hash,roles:['self-coach','team-coach','athlete'].map(role=>({role,result:'PASS',evidence:[{path:'proof.txt',sha256:sha256('Actual observed result')}]})),simulator:'iPhone Air',completedAt:new Date().toISOString(),flows:[{id:'visible-pr',result:'PASS',observableResult:'NEW 12RM shown',evidence:[{path:'proof.txt',sha256:sha256('Actual observed result')}]}]};
  assertRuntimeEvidence(receipt,'source',['visible-pr'],dir);
  assert.throws(()=>assertRuntimeEvidence({...receipt,roles:[]},'source',['visible-pr'],dir), /journey is missing/);
  assert.throws(()=>assertRuntimeEvidence({...receipt,completedAt:new Date(Date.now()+3600_000).toISOString()},'source',['visible-pr'],dir), /completion time/);
  fs.writeFileSync(path.join(dir,'proof.txt'),'changed');
  assert.throws(()=>assertRuntimeEvidence(receipt,'source',['visible-pr'],dir),/proof file changed/);
} finally {fs.rmSync(dir,{recursive:true,force:true});}
const app=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
if(app.extra?.releaseTrack==='testflight') {
  const env={...process.env};delete env.EXPO_PUBLIC_APPROVED_ART_CHANNEL;
  assert.throws(()=>execFileSync(process.execPath,['-e','require("./app.config.js")'],{env,stdio:'pipe'}),
    'the exact missing-switch incident must fail before a direct EAS export');
  assert.doesNotThrow(()=>execFileSync(process.execPath,['-e','require("./app.config.js")'],{env:{...env,EXPO_PUBLIC_APPROVED_ART_CHANNEL:'testflight'},stdio:'pipe'}));
}
console.log('Cumulative TestFlight: file/behavior deltas, historical assets, exact owner removals, missing/stale/tampered runtime proof, and direct missing-switch export all enforced PASS');
