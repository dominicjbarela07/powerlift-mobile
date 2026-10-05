import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {compareDevSuperset,runPostReleaseGate} from './verify-testflight-release-integrity.mjs';
import {productFiles,compareProtectedFiles,assertProtectedArtifactAssets} from './testflight-cumulative-integrity.mjs';

const root=process.cwd(),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const baseline=read('config/testflight-release-integrity.json');
const snapshot=read('config/protected-testflight-catalog.json');
const protectedMovement=snapshot.movements.find(row=>row.id===178);
const taxonomy='config/governed-movement-art-taxonomy.json';
const hash='a'.repeat(64);
const options={baseline:{protectedFiles:{'assets/approved.png':hash,'lib/hot-swap.ts':hash,[taxonomy]:hash},catalogIdentities:[[protectedMovement.id,protectedMovement.key]],sourceAuthorizations:[]},devFiles:{'assets/approved.png':hash,'lib/hot-swap.ts':hash},candidateFiles:{'assets/approved.png':hash,'lib/hot-swap.ts':hash},devCatalog:{movements:[],compatibility_movements:[protectedMovement]},candidateCatalog:{movements:[protectedMovement]},snapshot:{movements:[protectedMovement]}};
assert.equal(compareDevSuperset(options).pass,true);
assert.equal(compareDevSuperset({...options,devCatalog:{movements:[]}}).pass,false,'498-only DEV cannot excuse 69 missing shipped definitions');
assert.equal(compareDevSuperset({...options,devFiles:{'lib/hot-swap.ts':hash}}).pass,false,'Missing approved art blocks Gate A');
assert.equal(compareDevSuperset({...options,devFiles:{'assets/approved.png':hash}}).pass,false,'Release-only Hot Swap implementation blocks Gate A');
assert.equal(compareProtectedFiles({'lib/hot-swap.ts':hash},{},[]).violations.length,1,'Unapproved feature removal blocks Gate B');
assert.throws(()=>assertProtectedArtifactAssets(['previous-valid-art'],[]),/SUBTRACTION/,'Unapproved asset removal blocks Gate B');
assert.throws(()=>runPostReleaseGate({root,published:{gitCommitHash:'b'.repeat(40)},candidateSha:'a'.repeat(40)}),/Published TestFlight source/,'Wrong published source blocks Gate C');

// Exercise real CLI exit statuses against hard-linked snapshots. Unlink before
// modifying fixture bytes so the owner's files are never changed.
const devRoot=process.env.STRENGTH_LEDGER_DEV_MOBILE_ROOT||'/Users/dominic/powerlifting_app_dev/powerlift_mobile';
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'sl-superset-failure-'));
const candidateRoot=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).expo.extra?.releaseTrack==='testflight'?root:process.env.STRENGTH_LEDGER_TESTFLIGHT_ROOT||'/Users/dominic/powerlifting_app/powerlift_mobile_testflight';
const failures=[];
try {
  // Exact source-bound projections require real DEV provenance, including the
  // pre-fix source. A private shared-object clone retains that history without
  // writing to canonical DEV or creating owner work.
  execFileSync('git',['clone','--quiet','--no-checkout','--shared','--local','--branch','dev/canonical-mobile',devRoot,fixture]);
  for(const file of Object.keys(productFiles(devRoot))) {
    const target=path.join(fixture,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.linkSync(path.join(devRoot,file),target);
  }
  fs.writeFileSync(path.join(fixture,'fixture.txt'),'Isolated failure-mode fixture');
  execFileSync('git',['add','fixture.txt'],{cwd:fixture});
  execFileSync('git',['-c','user.name=Release gate test','-c','user.email=release-gate-test@localhost','commit','-qm','Isolated test fixture'],{cwd:fixture});
  const run=(expect,kind,extra=[])=>{
    const result=spawnSync(process.execPath,[path.join(root,'scripts/verify-testflight-release-integrity.mjs'),'--candidate-root',candidateRoot,'--dev-root',fixture,'--gate-a-only',...extra],{cwd:root,env:process.env,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
    assert.equal(result.status===0,expect,`${kind}: ${result.stdout} ${result.stderr}`);
    if(!expect) failures.push({kind,exitStatus:result.status});
  };
  run(true,'valid protected DEV snapshot');
  const art=Object.keys(baseline.protectedFiles).find(p=>p.includes('movement-artwork')&&p.endsWith('-app.png'));
  assert.ok(art);fs.unlinkSync(path.join(fixture,art));run(false,'missing approved artwork');fs.linkSync(path.join(devRoot,art),path.join(fixture,art));
  const original=fs.readFileSync(path.join(fixture,taxonomy));const catalog=JSON.parse(original);
  fs.unlinkSync(path.join(fixture,taxonomy));
  const withdrawn=snapshot.movements.filter(row=>!(catalog.movements||[]).some(d=>d.id===row.id));
  assert.equal(withdrawn.length,69,'Exercise the exact original 567 → 498 gap');
  fs.writeFileSync(path.join(fixture,taxonomy),JSON.stringify({...catalog,compatibility_movements:[]}));run(false,'69 missing governed movement IDs');fs.writeFileSync(path.join(fixture,taxonomy),original);
  const feature='lib/active-session-hot-swap.ts';assert.ok(baseline.protectedFiles[feature]);
  fs.unlinkSync(path.join(fixture,feature));run(false,'missing valid TestFlight feature / Hot Swap source');fs.linkSync(path.join(devRoot,feature),path.join(fixture,feature));
  // CLI Gate B intentionally fails before functional orchestration, so it cannot
  // recursively execute this failure-mode test.
  fs.mkdirSync(path.join(fixture,'empty-export'));
  const blocked=spawnSync(process.execPath,[path.join(root,'scripts/testflight-cumulative-integrity.mjs'),'--export-dir',path.join(fixture,'empty-export')],{cwd:candidateRoot,env:process.env,encoding:'utf8',timeout:30000});
  assert.notEqual(blocked.status,0,'Unapproved historical removal must produce a nonzero release exit');
  assert.match(blocked.stderr,/UNAUTHORIZED TESTFLIGHT ASSET SUBTRACTION/);failures.push({kind:'unauthorized exported asset removal',exitStatus:blocked.status});
} finally {fs.rmSync(fixture,{recursive:true,force:true});}
console.log(`Release constitution failure-mode checks PASS: ${JSON.stringify(failures)}; wrong published source also blocks Gate C`);
