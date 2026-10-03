import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const expoHash = bytes => crypto.createHash('sha256').update(bytes).digest('base64url');
export function compareProtectedFiles(protectedFiles, candidateFiles, authorizations = []) {
  const additions = Object.keys(candidateFiles).filter(p => !(p in protectedFiles));
  const modifications = [], subtractions = [], violations = [];
  for (const [p, expected] of Object.entries(protectedFiles)) {
    const actual = candidateFiles[p] ?? null;
    if (actual === expected) continue;
    const kind = actual === null ? 'SUBTRACTION' : 'MODIFICATION';
    const delta = {path:p, before:expected, after:actual, kind};
    (actual === null ? subtractions : modifications).push(delta);
    const authorized = authorizations.some(a => a.path === p && a.before === expected
      && a.after === actual && a.ownerInstruction && a.ownerEvidenceSha256
      && /^[a-f0-9]{64}$/.test(a.ownerEvidenceSha256));
    if (!authorized) violations.push(delta);
  }
  return {additions, modifications, subtractions, violations};
}

export function assertProtectedArtifactAssets(requiredHashes, actualHashes, authorizations = []) {
  const actual = new Set(actualHashes);
  const missing = [...new Set(requiredHashes)].filter(h => !actual.has(h));
  const unauthorized = missing.filter(h => !authorizations.some(a => a.hash === h
    && a.action === 'REMOVE' && a.ownerInstruction && /^[a-f0-9]{64}$/.test(a.ownerEvidenceSha256 || '')));
  assert.deepEqual(unauthorized, [], `UNAUTHORIZED TESTFLIGHT ASSET SUBTRACTION: ${unauthorized.length} protected asset hash(es) missing`);
  return {missing, unauthorized};
}

export function assertRuntimeEvidence(receipt, fingerprint, requiredFlows, evidenceRoot) {
  assert.ok(receipt, 'RELEASE BLOCKED: actual user-visible runtime proof is missing');
  assert.equal(receipt.productFingerprint, fingerprint, 'RELEASE BLOCKED: runtime proof belongs to different product source');
  assert.match(receipt.backendSourceSha || '', /^[a-f0-9]{40}$/, 'runtime proof requires the exact backend source');
  assert.match(receipt.backendProductFingerprint || '', /^[a-f0-9]{64}$/, 'runtime proof requires the backend content fingerprint, including uncommitted changes');
  for (const role of ['self-coach','team-coach','athlete']) {
    assert.ok(receipt.roles?.some(item => item.role === role && item.result === 'PASS' && item.evidence?.length), `RELEASE BLOCKED: actual ${role} journey is missing`);
  }
  assert.equal(receipt.simulator, 'iPhone Air', 'use the one canonical simulator');
  assert.ok(receipt.completedAt && Number.isFinite(Date.parse(receipt.completedAt))
    && Date.parse(receipt.completedAt) <= Date.now() + 60_000
    && Date.now() - Date.parse(receipt.completedAt) < 48 * 3600_000,
    'runtime proof is missing a valid recent completion time');
  for (const role of receipt.roles) {
    for (const evidence of role.evidence) {
      const file = path.resolve(evidenceRoot,evidence.path);
      assert.ok(file.startsWith(path.resolve(evidenceRoot) + path.sep), 'role proof must remain inside its proof directory');
      assert.equal(sha256(fs.readFileSync(file)),evidence.sha256, 'role proof file changed');
    }
  }
  for (const id of requiredFlows) {
    const flow = receipt.flows?.find(f => f.id === id);
    assert.ok(flow && flow.result === 'PASS' && flow.observableResult && flow.evidence?.length,
      `RELEASE BLOCKED: user-visible flow ${id} has not passed`);
    for (const evidence of flow.evidence) {
      const file = path.resolve(evidenceRoot, evidence.path);
      assert.ok(file.startsWith(path.resolve(evidenceRoot) + path.sep), 'evidence must remain inside its proof directory');
      assert.ok(fs.existsSync(file), `${id}: proof file is missing`);
      assert.equal(sha256(fs.readFileSync(file)), evidence.sha256, `${id}: proof file changed`);
    }
  }
}

export function productFiles(root) {
  const result = {};
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      if (entry.name === 'dev-mocks' || entry.name === 'fixtures' || entry.name === '.DS_Store') continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) result[path.relative(root,file)] = sha256(fs.readFileSync(file));
    }
  };
  for (const dir of ['app','components','lib','hooks','contexts','constants','config','assets']) visit(path.join(root,dir));
  const runtimePolicy = 'artwork-review/runtime-policy.json';
  result[runtimePolicy] = sha256(fs.readFileSync(path.join(root,runtimePolicy)));
  // Release evidence and its approval documents do not participate in their own fingerprint.
  for (const p of Object.keys(result)) if (p.startsWith('config/testflight-release-') || p.startsWith('config/testflight-runtime-')) delete result[p];
  return result;
}
export function fingerprintBackend(root) {
  const files = {};
  function visit(dir) {
    if(!fs.existsSync(dir)) return;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      if(entry.name === '__pycache__') continue;
      const file = path.join(dir,entry.name);
      if(entry.isDirectory()) visit(file);
      else if(/\.(py|json|html|js|ts)$/.test(file)) files[path.relative(root,file)] = sha256(fs.readFileSync(file));
    }
  }
  for(const dir of ['app','migrations']) visit(path.join(root,dir));
  for(const name of ['wsgi.py','requirements.txt']) if(fs.existsSync(path.join(root,name))) files[name] = sha256(fs.readFileSync(path.join(root,name)));
  return fingerprintFiles(files);
}
export const fingerprintFiles = files => sha256(JSON.stringify(Object.entries(files).sort(([a],[b]) => a.localeCompare(b))));

function read(root,p) { return JSON.parse(fs.readFileSync(path.join(root,p),'utf8')); }
function exportedHashes(dir) {
  const hashes = [];
  function visit(p) { for (const e of fs.readdirSync(p,{withFileTypes:true})) {
    const f=path.join(p,e.name);if(e.isDirectory())visit(f);else if(e.isFile())hashes.push(expoHash(fs.readFileSync(f)));
  }}
  visit(dir); return hashes;
}

export function assertOwnerEvidence(root, authorizations) {
  for (const receipt of authorizations || []) {
    assert.ok(receipt.ownerInstruction && receipt.ownerEvidencePath,
      'owner authorization requires the exact instruction and a retained evidence file');
    const file = path.resolve(root, receipt.ownerEvidencePath);
    assert.ok(file.startsWith(path.resolve(root) + path.sep), 'owner evidence must be retained in the project');
    assert.ok(fs.existsSync(file), 'owner evidence file is missing');
    const bytes = fs.readFileSync(file);
    assert.equal(sha256(bytes), receipt.ownerEvidenceSha256, 'owner evidence bytes changed');
    const text = bytes.toString('utf8');
    const contains = value => typeof value === 'string' ? value === receipt.ownerInstruction : value && typeof value === 'object' && Object.values(value).some(contains);
    let retainedInstruction = text.includes(receipt.ownerInstruction);
    try { retainedInstruction ||= contains(JSON.parse(text)); } catch {}
    assert.ok(retainedInstruction, 'exact owner instruction is absent from evidence');
  }
}

export function runIntegrityGate({root=process.cwd(),exportDir,runtimeReceipt,requireRuntime=false}={}) {
  const protectedState=read(root,'config/testflight-release-integrity.json');
  assert.equal(protectedState.schemaVersion,1);
  assertOwnerEvidence(root, [...(protectedState.sourceAuthorizations || []), ...(protectedState.assetRemovalAuthorizations || []), ...(protectedState.historicalRemovalAuthorizations || [])]);
  for (const [file, expected] of Object.entries(protectedState.releaseGateFiles || {})) {
    assert.ok(fs.existsSync(path.join(root,file)), `release enforcement disappeared: ${file}`);
    assert.equal(sha256(fs.readFileSync(path.join(root,file))), expected, `release enforcement changed without a reviewed baseline update: ${file}`);
  }
  if(requireRuntime) assert.deepEqual(protectedState.unresolvedHistoricalAssetChanges || [], [],
    'RELEASE BLOCKED: historical asset changes still lack owner authorization evidence');
  assert.ok(protectedState.releaseHistory.length >= 5, 'multi-release historical evidence is required');
  assert.ok(protectedState.currentTestFlight && protectedState.previousTestFlight, 'both live and previous baseline identities are required');
  const files=productFiles(root), fingerprint=fingerprintFiles(files);
  const delta=compareProtectedFiles(protectedState.protectedFiles,files,protectedState.sourceAuthorizations);
  assert.deepEqual(delta.violations, [], `UNAUTHORIZED PRODUCT DELTA: ${delta.violations.length} protected path(s) changed or disappeared`);
  for(const historical of protectedState.historicalProtectedPaths) {
    assert.ok(files[historical] || (protectedState.historicalRemovalAuthorizations || []).some(receipt => receipt.path === historical && receipt.action === 'REMOVE'), `historical product state disappeared without owner authorization: ${historical}`);
  }
  const runtime=read(root,'artwork-review/runtime-policy.json');
  for(const prior of protectedState.approvedArtwork) {
    const current=runtime.approved_exact_artwork.find(r=>r.key===prior.key);
    assert.ok(current, `approved movement mapping disappeared: ${prior.key}`);
    assert.equal(current.movement_definition_id,prior.movement_definition_id, 'artwork must preserve canonical movement identity');
    assert.deepEqual(current,prior, `approved image, crop or presentation changed without owner receipt: ${prior.key}`);
  }
  const catalog=read(root,'config/governed-movement-art-taxonomy.json');
  assert.deepEqual(catalog.movements.map(r=>[r.id,r.key]).sort((a,b)=>a[0]-b[0] || a[1].localeCompare(b[1])),protectedState.catalogIdentities,
    'protected release catalog identity set changed; reconcile destination data and obtain explicit authorization first');
  const app=read(root,'app.json').expo,eas=read(root,'eas.json');
  if(app.extra?.releaseTrack==='testflight') {
    assert.equal(app.version,'2.1.0','this restoration cannot change Production 2.0.2 or native runtime');
    assert.equal(eas.build.testflight.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL,'testflight','native TestFlight builds must retain approved artwork');
  }
  let artifact;
  if(exportDir) artifact=assertProtectedArtifactAssets(protectedState.protectedAssetHashes,exportedHashes(exportDir),protectedState.assetRemovalAuthorizations);
  if(requireRuntime) {
    assert.ok(runtimeReceipt,'RELEASE BLOCKED: --runtime-receipt is required before publication');
    const receipt=JSON.parse(fs.readFileSync(runtimeReceipt,'utf8'));
    assertRuntimeEvidence(receipt,fingerprint,protectedState.requiredRuntimeFlows,path.dirname(runtimeReceipt));
    const backendRoot = process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev';
    assert.equal(fingerprintBackend(backendRoot),receipt.backendProductFingerprint,'backend content changed since runtime observation');
    assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:backendRoot,encoding:'utf8'}).trim(),receipt.backendSourceSha,'backend revision changed since runtime observation');
    const testedFiles = productFiles(receipt.runtimeSourceRoot || root);
    assert.equal(fingerprintFiles(testedFiles), receipt.testedProductFingerprint, 'runtime source has changed since observation');
    for (const [file, actual] of Object.entries(testedFiles)) {
      if (files[file] === actual) continue;
      const projection = protectedState.runtimeSourceProjection?.find(item => item.path === file && item.testedHash === actual && item.candidateHash === files[file]);
      assert.ok(projection, `untested release product difference: ${file}`);
    }
    for (const file of Object.keys(files)) assert.ok(testedFiles[file], `candidate product path was absent during runtime verification: ${file}`);
  }
  return {productFingerprint:fingerprint,baselines:protectedState.releaseHistory.length,sourceDelta:delta,artifact,runtimeVerified:requireRuntime};
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const value=flag=>{const i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:undefined;};
  const result=runIntegrityGate({exportDir:value('--export-dir'),runtimeReceipt:value('--runtime-receipt'),requireRuntime:process.argv.includes('--require-runtime')});
  const out=value('--output');if(out)fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(`[cumulative-testflight] PASS: ${result.baselines} historical releases; unauthorized source subtractions 0; artifact ${result.artifact?'verified':'not yet checked'}; runtime ${result.runtimeVerified?'verified':'not yet checked'}`);
}
