import assert from 'node:assert/strict';
import { assertClientFixScope, assertSetSaveRecoveryBaseline } from './owner-directed-client-fix.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const instruction = 'Let me log at zero pounds.';
const text = instruction + '\nYou will not do simulator runs. Stop talking about it';
const scope = {scope: 'canonical-zero-load-edit-20261005', productFingerprint: 'fixed', validation: 'OWNER_DIRECTED_CONTRACTS_ONLY', ownerInstruction: instruction,
  changedProductFiles: {'app/logger.tsx': 'fixed-editor'}, contracts: {'scripts/test-zero-load-edit-api.mjs':'api', 'scripts/test-zero-load-edit-set.mjs':'editor'}};
const delta = [{path:'app/logger.tsx',after:'fixed-editor'}];
assertClientFixScope(scope,'fixed',delta,text);
assert.throws(() => assertClientFixScope(scope,'different',delta,text), /changed product source/);
assert.throws(() => assertClientFixScope(scope,'fixed',[...delta,{path:'assets/art.png',after:'new'}],text), /unrelated/);
assert.throws(() => assertClientFixScope(scope,'fixed',[{path:'app/logger.tsx',after:'other'}],text), /source changed/);
assert.throws(() => assertClientFixScope(scope,'fixed',delta,instruction), /exact owner instruction/);
assert.throws(() => assertClientFixScope({...scope,contracts:{'scripts/test-zero-load-edit-set.mjs':'editor'}},'fixed',delta,text));
console.log('Owner-directed zero-load validation: exact source, exact contracts, explicit instruction, no unrelated changes; deliberately invalid scopes rejected PASS');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-set-recovery-scope-'));
try {
  const write = (file, value) => { const bytes = JSON.stringify(value); fs.writeFileSync(path.join(root, file), bytes); return {path:file, sha256:hash(bytes)}; };
  const baseline = {'app/(tabs)/workout/[workoutId].tsx':'old-logger', 'config/protected-fix-manifest.json':'old-metadata', 'assets/approved.png':'approved-image'};
  const baselineProductFingerprint = hash(JSON.stringify(Object.entries(baseline).sort(([a],[b])=>a.localeCompare(b))));
  const current = {id:'actual-current', gitCommitHash:'actual-source'};
  const proof = {gateC:write('gate.json', {pass:true,missing:[],candidateProductFingerprint:baselineProductFingerprint,
    published:{...current, servedBundleSha256:'actual-bundle'}}),
    assetAudit:write('audit.json', {pass:true,missingOrCorrupt:0,updateId:current.id,servedLaunchSha256:'actual-bundle'})};
  const files = {...baseline, 'app/(tabs)/workout/[workoutId].tsx':'recovered-logger', 'config/protected-fix-manifest.json':'exact-held-patch', 'lib/canonical-set-save-recovery.ts':'recovery'};
  const state = {currentTestFlight:current, reviewedRuntimeContinuation:{publishedProof:proof}};
  const scope = {scope:'canonical-set-save-recovery-20261008', baselineUpdateId:current.id, baselineSourceSha:current.gitCommitHash,
    baselineProductFingerprint, baselineFiles:write('baseline.json',baseline)};
  const check = (candidate = files, candidateScope = scope, candidateState = state) => assertSetSaveRecoveryBaseline({root,scope:candidateScope,state:candidateState,files:candidate});
  assert.equal(check().length, 3);
  assert.throws(()=>check({...files,'assets/approved.png':'replacement'}), /unrelated/);
  const missing = {...files}; delete missing['assets/approved.png']; assert.throws(()=>check(missing), /remove/);
  assert.throws(()=>check(files,{...scope,baselineUpdateId:'invented'}), /actual current/);
  assert.throws(()=>check(files,{...scope,baselineProductFingerprint:'invented'}));
  assert.throws(()=>check(files,{...scope,baselineFiles:write('fake.json',{...baseline,'assets/approved.png':'replacement'})}), /complete verified/);
  assert.throws(()=>check(files,scope,{...state,currentTestFlight:{...current,gitCommitHash:'another-source'}}), /actual published source/);
  const recoveryScope = {...scope,productFingerprint:'candidate',validation:'OWNER_DIRECTED_CONTRACTS_ONLY',ownerInstruction:instruction,
    changedProductFiles:Object.fromEntries(check().map(row=>[row.path,row.after])),contracts:{
      'scripts/test-accessory-pr-save-api.mjs':'api','scripts/test-canonical-set-save-recovery.mjs':'handler',
      'scripts/test-session-logger-journal.mjs':'durable','scripts/test-set-submission-lifecycle.mjs':'lifecycle'}};
  assertClientFixScope(recoveryScope,'candidate',check(),text);
  assert.throws(()=>assertClientFixScope({...recoveryScope,contracts:{}},'candidate',check(),text));
  assert.throws(()=>assertClientFixScope(recoveryScope,'another',check(),text));
} finally {fs.rmSync(root,{recursive:true,force:true});}
console.log('Owner-directed Set recovery scope: PASS — exact verified current publication, complete baseline, exact candidate and contracts; missing art, unrelated changes, forged baseline/source and missing contracts rejected');
