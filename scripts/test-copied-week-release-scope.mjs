import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertClientFixScope, assertCopiedWeekIdentityBaseline } from './owner-directed-client-fix.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-identity-scope-'));
try {
  const write = (name, value) => { const bytes = JSON.stringify(value); fs.writeFileSync(path.join(root, name), bytes); return {path:name,sha256:hash(bytes)}; };
  const paths = ['config/native-runtime-baselines.json','config/protected-fix-manifest.json','lib/active-session-hot-swap.ts', 'lib/api.ts','lib/canonical-movement-art-subject.ts','lib/canonical-movement-artwork.ts','lib/current-session-movement.ts'];
  const baseline = Object.fromEntries([...paths,'assets/approved.png'].map(file=>[file, 'before-'+file]));
  const current = {id:'current-update',gitCommitHash:'current-source'};
  const baselineFingerprint = hash(JSON.stringify(Object.entries(baseline).sort(([a],[b])=>a.localeCompare(b))));
  const proof = {gateC:write('gate.json',{pass:true,missing:[],candidateProductFingerprint:baselineFingerprint,published:{...current,servedBundleSha256:'served'}}),
    assetAudit:write('assets.json',{pass:true,missingOrCorrupt:0,updateId:current.id,servedLaunchSha256:'served'})};
  const state = {currentTestFlight:current,verifiedSetSaveRecovery:{publishedProof:proof}};
  const files = {...baseline,...Object.fromEntries(paths.map(file=>[file,'fixed-'+file]))};
  const scope = {scope:'canonical-copied-week-identity-20261013',baselineUpdateId:current.id,baselineSourceSha:current.gitCommitHash,
    baselineProductFingerprint:baselineFingerprint,baselineFiles:write('baseline.json',baseline)};
  const check = (candidate=files, s=scope, st=state)=>assertCopiedWeekIdentityBaseline({root,scope:s,state:st,files:candidate});
  assert.equal(check().length,7);
  assert.throws(()=>check({...files,'assets/approved.png':'replacement'}),/unrelated/);
  assert.throws(()=>check({...files,'lib/unrelated.ts':'new'}),/unrelated/);
  const missing={...files};delete missing['assets/approved.png'];assert.throws(()=>check(missing),/remove/);
  assert.throws(()=>check(files,{...scope,baselineUpdateId:'wrong'}),/actual current/);
  assert.throws(()=>check(files,{...scope,baselineSourceSha:'wrong'}),/published source/);
  assert.throws(()=>check(files,{...scope,baselineProductFingerprint:'invented'}));
  assert.throws(()=>check(files,{...scope,baselineFiles:write('forged.json',{...baseline,'assets/approved.png':'forged'})}));
  const instruction='NO MORE FUCKING MOVEMENT ID RELATED ERRORS!!!!!';
  const text=instruction+'\nNo I will test with you at a different time. Get everything fuckign set up!';
  const full={...scope,productFingerprint:'candidate',validation:'OWNER_DIRECTED_CONTRACTS_ONLY',ownerInstruction:instruction,
    changedProductFiles:Object.fromEntries(check().map(row=>[row.path,row.after])),contracts:{
      'scripts/test-active-session-hot-swap.mjs':'hot-swap', 'scripts/test-active-session-mutation-backend.mjs':'api',
      'scripts/test-governed-movement-art-taxonomy.mjs':'catalog', 'scripts/test-private-movement-identity-contract.mjs':'private',
      'scripts/test-single-current-movement-id.mjs':'current'}};
  assertClientFixScope(full,'candidate',check(),text);
  assert.throws(()=>assertClientFixScope(full,'wrong',check(),text),/changed product source/);
  assert.throws(()=>assertClientFixScope(full,'candidate',check(),instruction),/exact owner instruction/);
  assert.throws(()=>assertClientFixScope({...full,contracts:{}},'candidate',check(),text));
} finally {fs.rmSync(root,{recursive:true,force:true});}
console.log('PASS copied-week identity release scope: exact verified publication, exact bounded source, mandatory contracts and owner-deferred device proof; missing artwork, unrelated changes, forged baseline/source and missing guards reject.');
