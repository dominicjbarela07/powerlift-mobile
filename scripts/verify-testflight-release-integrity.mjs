import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { productFiles, sha256, fingerprintFiles, assertOwnerEvidence, runIntegrityGate, assertProtectedArtifactAssets, expoHash } from './testflight-cumulative-integrity.mjs';

const baselineCatalogRef=root=>read(root,'config/testflight-release-integrity.json').previousTestFlight.gitCommitHash;
const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
export function gitState(root) {
  const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).trim();
  const status = git('status','--porcelain','--untracked-files=all');
  return {worktree:fs.realpathSync(root),branch:git('branch','--show-current'),sha:git('rev-parse','HEAD'),dirty:Boolean(status),status:status.split('\n').filter(Boolean)};
}

// Compare source and the explicit historical catalog separately: active discovery
// may be narrower after an owner-approved retirement, but shipped identities and
// their exact compatibility metadata must remain available to DEV readers.
export function compareDevSuperset({baseline,devFiles,candidateFiles,devCatalog,candidateCatalog,snapshot,removals=[]}) {
  const entries=[], missing=[];
  const add=(identity,area,dev,testflight,label,history,direction='NONE',authorizationEvidence=[])=>{
    const entry={identity,productArea:area,devState:dev,testflightState:testflight,recentHistoricalState:history,authorizationEvidence,label,requiredReconciliationDirection:direction};
    entries.push(entry); if(label==='TESTFLIGHT_ONLY'||label==='UNAUTHORIZED_SUBTRACTION') missing.push(entry);
  };
  const taxonomy='config/governed-movement-art-taxonomy.json';
  const receipts = baseline.sourceAuthorizations || [];
  for(const p of [...new Set([...Object.keys(baseline.protectedFiles),...Object.keys(candidateFiles),...Object.keys(devFiles)])].sort()) {
    if(p===taxonomy) continue;
    const historical=baseline.protectedFiles[p] || null, dev=devFiles[p] || null, tf=candidateFiles[p] || historical;
    const accepted=receipts.filter(a=>a.path===p&&a.before===historical);
    const retained=dev && (!historical || dev===historical || accepted.some(a=>a.after===dev));
    const removed=removals.find(a=>a.identity===p&&a.before===historical&&a.after===null&&a.action==='REMOVE');
    if(historical&&!retained&&!removed) add(p,'source / assets',dev,tf,'TESTFLIGHT_ONLY',historical,'TESTFLIGHT → DEV',accepted);
    else if(tf&&dev!==tf) add(p,'source / assets',dev,tf,'TESTFLIGHT_ONLY',historical,'TESTFLIGHT → DEV',accepted);
    else if(dev&&!tf) add(p,'source / assets',dev,null,'DEV_ONLY',historical,'AUTHORIZED DEV → TESTFLIGHT INTEGRATION');
    else add(p,'source / assets',dev,tf,removed?'AUTHORIZED_DIFFERENCE':historical&&dev!==historical?'AUTHORIZED_DIFFERENCE':'EQUIVALENT',historical,'NONE',removed?[removed]:accepted);
  }
  const devRows=[...(devCatalog.compatibility_movements || []),...devCatalog.movements];
  const devById=new Map(devRows.map(row=>[row.id,row]));
  const tfById=new Map(candidateCatalog.movements.map(row=>[row.id,row]));
  const retainedById=new Map(snapshot.movements.map(row=>[row.id,row]));
  const protectedById=new Map(baseline.catalogIdentities);
  for(const [id,key] of protectedById) {
    const dev=devById.get(id), tf=tfById.get(id), retained=retainedById.get(id);
    const active=devCatalog.movements.some(row=>row.id===id);
    const valid=dev?.key===key&&retained?.key===key&&(active||JSON.stringify(dev)===JSON.stringify(retained));
    const identical=valid&&JSON.stringify(dev)===JSON.stringify(tf);
    add(`movement:${id}:${key}`,'governed catalog',dev||null,tf||null,valid?(identical?'EQUIVALENT':'AUTHORIZED_DIFFERENCE'):'TESTFLIGHT_ONLY',retained||{id,key},valid?'Preserve DEV enrichment and exact shipped compatibility metadata':'TESTFLIGHT → DEV',valid&&!identical&&baseline.catalogCompatibilityAuthorization?[baseline.catalogCompatibilityAuthorization]:[]);
  }
  for(const row of devCatalog.movements) if(!protectedById.has(row.id)) add(`movement:${row.id}:${row.key}`,'governed catalog',row,null,'DEV_ONLY',null,'AUTHORIZED DEV → TESTFLIGHT INTEGRATION');
  add(taxonomy,'taxonomy',sha256(JSON.stringify(devCatalog)),sha256(JSON.stringify(candidateCatalog)),missing.some(e=>e.productArea==='governed catalog')?'UNAUTHORIZED_SUBTRACTION':'AUTHORIZED_DIFFERENCE',baseline.protectedFiles[taxonomy], 'Retain active DEV enrichment and exact shipped compatibility metadata',baseline.catalogCompatibilityAuthorization?[baseline.catalogCompatibilityAuthorization]:[]);
  for(const unresolved of baseline.unresolvedHistoricalAssetChanges || []) add(unresolved.path||unresolved.hash||unresolved.identity,'historical asset',unresolved,null,'AMBIGUOUS_OWNER_DECISION',unresolved,'OWNER DECISION REQUIRED; NO REMOVAL');
  const labels=['DEV_ONLY','TESTFLIGHT_ONLY','EQUIVALENT','AUTHORIZED_DIFFERENCE','UNAUTHORIZED_SUBTRACTION','AMBIGUOUS_OWNER_DECISION'];
  return {pass:missing.length===0,missing,entries,counts:Object.fromEntries(labels.map(label=>[label,entries.filter(e=>e.label===label).length]))};
}

export function runDevSupersetGate({root=process.cwd(),devRoot=process.env.STRENGTH_LEDGER_DEV_MOBILE_ROOT || '/Users/dominic/powerlifting_app_dev/powerlift_mobile',backendRoot=process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev',requireCleanCandidate=false}={}) {
  const baseline=read(root,'config/testflight-release-integrity.json');
  const constitutionFile=path.join(backendRoot,'docs/RELEASE_INVARIANTS.md');
  const constitution=fs.readFileSync(constitutionFile);
  assert.equal(sha256(constitution),baseline.releaseConstitutionSha256,'Authoritative release constitution changed; review its protection explicitly');
  assert.ok(constitution.toString().includes('DEV ⊇ TESTFLIGHT'),'Read and enforce the authoritative release constitution');
  for(const file of ['AGENTS.md','README.md','docs/RELEASE_INVARIANTS.md']) assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes('RELEASE_INVARIANTS.md'),`Mandatory release constitution pointer missing: ${file}`);
  const removals=read(root,'config/release-removal-authorizations.json');
  assert.equal(removals.schemaVersion,1);assert.ok(Array.isArray(removals.items));
  for(const removal of removals.items) {
    assert.ok(removal.identity&&removal.action==='REMOVE'&&removal.before&&removal.after===null,'Removal requires exact identity/before hash, REMOVE, and after:null');
  }
  assertOwnerEvidence(root,removals.items);
  assertOwnerEvidence(root,[...(baseline.sourceAuthorizations||[]),...(baseline.historicalRemovalAuthorizations||[]),baseline.catalogCompatibilityAuthorization].filter(Boolean));
  const snapshot=read(devRoot,'config/protected-testflight-catalog.json');
  assert.equal(sha256(fs.readFileSync(path.join(devRoot,'config/protected-testflight-catalog.json'))),baseline.protectedCatalogSnapshotSha256,'Exact shipped catalog metadata disappeared or changed in DEV');
  const dev=gitState(devRoot),candidate=gitState(root),backend=gitState(backendRoot);
  assert.equal(dev.branch,'dev/canonical-mobile','DEV must use its canonical branch');
  if(requireCleanCandidate) assert.equal(candidate.dirty,false,'Release candidate has dirty/untracked state; create a clean cumulative integration');
  const devFiles=productFiles(devRoot), candidateFiles=productFiles(root);
  const result=compareDevSuperset({baseline,devFiles,candidateFiles,devCatalog:read(devRoot,'config/governed-movement-art-taxonomy.json'),candidateCatalog:read(root,'config/governed-movement-art-taxonomy.json'),snapshot,removals:removals.items});
  // Historical source must remain, even when absent from the latest broken OTA.
  for(const p of baseline.historicalProtectedPaths) if(!devFiles[p]&&!(baseline.historicalRemovalAuthorizations||[]).some(a=>a.path===p&&a.action==='REMOVE')) {
    const entry={identity:p,productArea:'historical source / assets',devState:null,testflightState:'protected historical state',recentHistoricalState:baseline.releaseHistory.map(r=>({id:r.id,source:r.gitCommitHash})),authorizationEvidence:[],label:'TESTFLIGHT_ONLY',requiredReconciliationDirection:'TESTFLIGHT → DEV'};
    result.entries.push(entry);result.missing.push(entry);result.pass=false;
  }
  const devPolicy=read(devRoot,'artwork-review/runtime-policy.json');
  for(const prior of baseline.approvedArtwork) {
    const current=devPolicy.approved_exact_artwork.find(row=>row.key===prior.key);
    if(JSON.stringify(current)!==JSON.stringify(prior)) {
      const entry={identity:`artwork:${prior.movement_definition_id}:${prior.key}`,productArea:'approved exact movement art / crop',devState:current||null,testflightState:prior,recentHistoricalState:prior,authorizationEvidence:[],label:'TESTFLIGHT_ONLY',requiredReconciliationDirection:'TESTFLIGHT → DEV'};
      result.entries.push(entry);result.missing.push(entry);result.pass=false;
    }
  }
  result.counts=Object.fromEntries(Object.keys(result.counts).map(label=>[label,result.entries.filter(e=>e.label===label).length]));
  return {...result,gate:'A',publicationAuthorized:false,dev,candidate,backend,currentTestFlight:baseline.currentTestFlight,previousTestFlight:baseline.previousTestFlight,historyReviewed:baseline.releaseHistory,constitution:{path:constitutionFile,sha256:sha256(constitution)},protectedManifestSha256:sha256(fs.readFileSync(path.join(root,'config/testflight-release-integrity.json'))),catalogSnapshotSha256:baseline.protectedCatalogSnapshotSha256,devProductFingerprint:fingerprintFiles(devFiles),candidateProductFingerprint:fingerprintFiles(candidateFiles)};
}

export function bindExportSource(root,exportDir) {
  const metadata=read(exportDir,'metadata.json').fileMetadata.ios;
  const receipt={schemaVersion:1,candidateSha:gitState(root).sha,productFingerprint:fingerprintFiles(productFiles(root)),createdAt:new Date().toISOString(),bundle:{path:metadata.bundle,sha256:sha256(fs.readFileSync(path.join(exportDir,metadata.bundle)))},assetHashes:[...new Set(metadata.assets.map(asset=>expoHash(fs.readFileSync(path.join(exportDir,asset.path)))))].sort()};
  fs.writeFileSync(path.join(exportDir,'release-export-source.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
export function assertBoundExport(root,exportDir) {
  const receipt=read(exportDir,'release-export-source.json');
  assert.equal(receipt.candidateSha,gitState(root).sha,'Export belongs to stale candidate source');
  assert.equal(receipt.productFingerprint,fingerprintFiles(productFiles(root)),'Export does not match current product source');
  assert.ok(Date.parse(receipt.createdAt)<=Date.now()+60000&&Date.now()-Date.parse(receipt.createdAt)<48*3600_000,'Export source binding must be recent');
  const metadata=read(exportDir,'metadata.json').fileMetadata.ios;
  assert.equal(metadata.bundle,receipt.bundle.path);assert.equal(sha256(fs.readFileSync(path.join(exportDir,metadata.bundle))),receipt.bundle.sha256,'Bound export bundle changed');
  assert.deepEqual([...new Set(metadata.assets.map(asset=>expoHash(fs.readFileSync(path.join(exportDir,asset.path)))))].sort(),receipt.assetHashes,'Bound export assets changed');
  return receipt;
}

export function runPostReleaseGate({root,devRoot,backendRoot,published,manifest,candidateSha,devProductFingerprint,validatedBundleSha256,servedBundleSha256,validatedAssetHashes}={}) {
  assert.equal(published.gitCommitHash,candidateSha,'Published TestFlight source does not match the inspected candidate');
  assert.equal(gitState(root).sha,candidateSha,'Release source changed after inspection');
  assert.equal(manifest.id,published.id,'Served artifact does not belong to the exact published update');
  assert.equal(servedBundleSha256,validatedBundleSha256,'Served bundle differs from the exact validated bundle');
  assert.deepEqual([...new Set(manifest.assets.map(a=>a.hash))].sort(),[...new Set(validatedAssetHashes || [])].sort(),'Served asset manifest differs from exact validated export');
  const baseline=read(root,'config/testflight-release-integrity.json');
  assertProtectedArtifactAssets(baseline.protectedAssetHashes,manifest.assets.map(a=>a.hash),baseline.assetRemovalAuthorizations);
  const result=runDevSupersetGate({root,devRoot,backendRoot,requireCleanCandidate:true});
  assert.equal(result.devProductFingerprint,devProductFingerprint,'DEV product source changed during publication; reconcile exact final state');
  assert.ok(result.pass,`Published TestFlight has state missing from DEV: ${result.missing.map(e=>e.identity).join(', ')}`);
  return {...result,gate:'C',published:{id:published.id,group:published.group,gitCommitHash:published.gitCommitHash,manifestId:manifest.id,servedBundleSha256},workflowComplete:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const value=flag=>{const i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:undefined;};
  const app=read(process.cwd(),'app.json').expo;
  const root=path.resolve(value('--candidate-root')||process.env.STRENGTH_LEDGER_TESTFLIGHT_ROOT||(app.extra?.releaseTrack==='testflight'?process.cwd():'/Users/dominic/powerlifting_app/powerlift_mobile_testflight'));
  const preparation=process.argv.includes('--source-only')||process.argv.includes('--gate-a-only');
  const output=value('--output'),report={schemaVersion:1,generatedAt:new Date().toISOString(),publicationAuthorized:false,gates:{}};
  try {
    report.gates.A=runDevSupersetGate({root,devRoot:value('--dev-root'),backendRoot:value('--backend-root'),requireCleanCandidate:!preparation});
    assert.ok(report.gates.A.pass,`GATE A BLOCKED: DEV is missing ${report.gates.A.missing.length} protected item(s): ${report.gates.A.missing.map(e=>e.identity).join(', ')}`);
    console.log(`[release-verify] Gate A PASS; valid TestFlight-only source/catalog/artwork state: 0`);
    if(!process.argv.includes('--gate-a-only')) {
      if(!preparation) {assert.ok(value('--export-dir'),'GATE B BLOCKED: fresh source-bound exported artifact required');assertBoundExport(root,value('--export-dir'));}
      report.gates.B=runIntegrityGate({root,exportDir:value('--export-dir'),runtimeReceipt:value('--runtime-receipt'),requireRuntime:!preparation});
      if(!preparation) assert.ok(value('--export-dir'),'GATE B BLOCKED: fresh actual exported artifact required');
      for(const script of ['test-release-source-lineage.mjs','test-accepted-behavior-contracts.mjs','test-release-critical-invariants.mjs']) {
        const env={...process.env,STRENGTH_LEDGER_BACKEND_ROOT:value('--backend-root')||process.env.STRENGTH_LEDGER_BACKEND_ROOT||'/Users/dominic/powerlifting_app_dev',STRENGTH_LEDGER_FROZEN_TESTFLIGHT_CATALOG_REF:baselineCatalogRef(root)};
        const result=spawnSync(process.execPath,[path.join('scripts',script)],{cwd:root,env,stdio:'inherit'});
        assert.equal(result.status,0,`Mandatory functional release contract failed: ${script}`);
      }
      const types=spawnSync('npx',['tsc','--noEmit'],{cwd:root,env:process.env,stdio:'inherit'});
      assert.equal(types.status,0,'Mandatory mobile type check failed');
      report.publicationAuthorized=!preparation;
    }
    console.log(`[release-verify] ${preparation?'PARTIAL PREPARATION ONLY; publication remains blocked':'PRE-RELEASE GATES A + B PASS; exact post-publication Gate C still required'}`);
  } catch(error) {report.error=error.message;process.exitCode=1;console.error(error.message);}
  if(output) {fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
}
