import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {resolveApprovedExactMovementArtwork} from '../lib/movement-artwork-hero.ts';
import {canonicalArtworkInputFromDefinition} from '../lib/canonical-movement-art-subject.ts';
import {sha256,expoHash,protectedDeliveryHashes,assertProtectedArtifactAssets,assertOwnerEvidence} from './testflight-cumulative-integrity.mjs';
import { applySharedReleaseFix } from './release-holdback-policy.mjs';
import { approvedArtRuntimeEnabled } from '../lib/approved-art-runtime.ts';
import { artBundlePolicyFiles, assertArtBundlePolicyProgression } from './approved-art-bundle-policy.mjs';

const root=process.cwd(),read=file=>JSON.parse(fs.readFileSync(file));
const state=read('config/testflight-release-integrity.json'),scope=state.movementImageryRestoration;
assert.ok(scope,'retain the exact owner-selected restoration baseline');
const prior=file=>execFileSync('git',['show',`${scope.sourceSha}:${file}`],{maxBuffer:32*1024*1024});
const sameSource=[
  'lib/canonical-movement-artwork-assets.ts','lib/canonical-movement-artwork.ts',
  'lib/canonical-movement-art-subject.ts','lib/movement-artwork-hero.ts',
  'lib/movement-artwork-geometry.mjs','lib/canonical-accessory-artwork-identities.ts',
  'lib/canonical-core-artwork-identities.ts','lib/approved-art-runtime.ts',
  'config/governed-movement-art-reuse.json','config/governed-core-artwork-reuse.json',
  'artwork-review/runtime-policy.json','components/movement/CanonicalMovementArtwork.tsx',
];
for(const file of sameSource) {
  const current = fs.readFileSync(file), original = prior(file);
  if ((file === 'lib/approved-art-runtime.ts' || artBundlePolicyFiles.includes(file)) && sha256(current) !== sha256(original)) {
    // Keep the original restoration pin. The separate owner-requested 3.0
    // export extension must prove every changed byte and retain old semantics.
    const progression = state.devSourceProgressions?.find(row => row.path === file && row.before === sha256(original) && row.after === sha256(current));
    assert.ok(progression, '3.0 art policy requires its exact owner-bound extension receipt');
    assertOwnerEvidence(root, [progression]);
    assert.equal(progression.changes.reduce((source, change) => applySharedReleaseFix(source, change), original.toString()), current.toString());
    if (artBundlePolicyFiles.includes(file)) assertArtBundlePolicyProgression(file, original.toString(), current.toString());
    assert.equal(approvedArtRuntimeEnabled(false, 'production', '2.0.2'), false);
    assert.equal(approvedArtRuntimeEnabled(false, 'testflight', '2.1.0'), true);
    assert.equal(approvedArtRuntimeEnabled(false, 'production3', '3.0.0'), true);
    assert.equal(approvedArtRuntimeEnabled(false, 'production3', '2.0.2'), false);
  } else assert.equal(sha256(current),sha256(original),`pre-Oct 2 artwork/resolver/crop source changed: ${file}`);
}
const baselinePolicy=JSON.parse(prior('artwork-review/runtime-policy.json'));
const baselineCatalog=JSON.parse(prior('config/governed-movement-art-taxonomy.json'));
const mappings=read('artwork-review/review-state.json').canonical_assets;
const registry=fs.readFileSync('lib/canonical-movement-artwork-assets.ts','utf8');
const manifest=read(scope.baselineManifestPath),baselineHashes=manifest.assets.map(asset=>asset.hash);
const rows=[];
for(const receipt of baselinePolicy.approved_exact_artwork) {
  const mapping=mappings.find(row=>row.key===receipt.key&&row.candidate_id===receipt.candidate_id);
  assert.ok(mapping,`missing approved mapping: ${receipt.key}`);
  const bytes=fs.readFileSync(mapping.files.app.path),hash=expoHash(bytes);
  assert.equal(sha256(bytes),receipt.app_sha256,`approved bytes changed: ${receipt.key}`);
  assert.ok(baselineHashes.includes(hash),`approved image absent from selected baseline: ${receipt.key}`);
  const escaped=receipt.key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const block=registry.match(new RegExp(`['"]?${escaped}['"]?: \\{([\\s\\S]*?)\\n  \\}`));
  assert.ok(block&&block[1].includes(mapping.files.app.path.replace(/^assets\//,'@/assets/')),`runtime registry lost exact source: ${receipt.key}`);
  rows.push({key:receipt.key,movementId:receipt.movement_definition_id,candidateId:receipt.candidate_id,path:mapping.files.app.path,sha256:receipt.app_sha256,expoHash:hash,loggerCrop:receipt.logger_crop,presentation:receipt.presentation});
}
const resolutions=baselineCatalog.movements.map(definition=>{
  const input=canonicalArtworkInputFromDefinition(definition),before=structuredClone(input);
  const expected=resolveApprovedExactMovementArtwork(input,true,baselinePolicy);
  const current=resolveApprovedExactMovementArtwork(input,true);
  assert.deepEqual(current,expected,`unexpected canonical artwork/fallback: ${definition.id}:${definition.key}`);
  assert.deepEqual(input,before,'artwork must never mutate canonical movement identity');
  return {movementId:definition.id,key:definition.key,artKey:current?.key??null,candidateId:current?.candidate_id??null};
});
// Preserve the complete Accessory PR recognition/celebration change, including
// the Oct 2 load-selection fix which prevents saving a false tie instead of a PR.
const bugSource=state.currentTestFlight.gitCommitHash;
for(const file of ['components/workout-logger/logger-wheel-picker.tsx',
  'components/workout-logger/logger-feedback.tsx','lib/logger-feedback.ts',
  'lib/logger-recognition-event-types.js','lib/recognition-motion-registry.ts',
  'lib/post-session-pr-evidence.ts']) {
  const bytes=execFileSync('git',['show',`${bugSource}:${file}`],{maxBuffer:16*1024*1024});
  const actual=sha256(fs.readFileSync(file)),before=sha256(bytes);
  if(actual!==before) {
    const correction=state.sourceAuthorizations.find(receipt=>receipt.path===file
      && receipt.before===before && receipt.after===actual
      && receipt.ownerDirectiveScope==='accessory-pr-machine-baseline-20261005');
    assert.ok(correction,`Accessory PR celebration source changed without exact owner-bound correction: ${file}`);
    assertOwnerEvidence(root,[correction]);
  }
}
const required=protectedDeliveryHashes(root,state);
assert.throws(()=>assertProtectedArtifactAssets(baselineHashes,baselineHashes.filter(hash=>hash!==rows[0].expoHash)),/SUBTRACTION/,'deliberately missing approved image must fail');
assert.throws(()=>assertProtectedArtifactAssets(baselineHashes,baselineHashes.filter(hash=>!rows.some(row=>row.expoHash===hash))),/486 protected asset/,'the complete movement-image subtraction must fail');
assert.throws(()=>protectedDeliveryHashes(root,{...state,unresolvedHistoricalAssetChanges:[{hash:rows[0].expoHash,sourceRecords:[]}]}),/baseline artwork cannot/,'baseline imagery can never use the historical thumbnail disposition');
const broken=read(scope.baselineManifestPath);
const badHash=rows[0].expoHash;
assert.throws(()=>assertProtectedArtifactAssets(required,broken.assets.filter(asset=>asset.hash!==badHash).map(asset=>asset.hash),state.assetRemovalAuthorizations),/SUBTRACTION/);
const brokenOct2=JSON.parse(execFileSync('git',['show',`${scope.sourceSha}:artwork-review/runtime-policy.json`],{maxBuffer:16*1024*1024}));
brokenOct2.approved_exact_artwork=brokenOct2.approved_exact_artwork.filter(row=>row.key!==rows[0].key);
const def=baselineCatalog.movements.find(row=>row.id===rows[0].movementId);
if(def) assert.notDeepEqual(resolveApprovedExactMovementArtwork(canonicalArtworkInputFromDefinition(def),true,brokenOct2),resolveApprovedExactMovementArtwork(canonicalArtworkInputFromDefinition(def),true),'missing mapping must reproduce resolver failure');
const value=flag=>{const i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:undefined;};
const exported=value('--export-dir');
let bundled=null;
if(exported) {
  const meta=read(path.join(exported,'metadata.json')).fileMetadata.ios;
  const hashes=meta.assets.map(asset=>expoHash(fs.readFileSync(path.join(exported,asset.path))));
  assertProtectedArtifactAssets(required,hashes,state.assetRemovalAuthorizations);
  for(const row of rows) assert.ok(hashes.includes(row.expoHash),`not bundled: ${row.key}`);
  bundled={entries:meta.assets.length,uniqueHashes:new Set(hashes).size,baselineMissing:0,movementAssetsMissing:0};
}
const report={baseline:{sourceSha:scope.sourceSha,updateId:scope.updateId,entries:manifest.assets.length,uniqueHashes:new Set(baselineHashes).size},approvedMappings:rows.length,uniqueMovementImages:new Set(rows.map(row=>row.expoHash)).size,canonicalIdentities:resolutions.length,exactArtIdentities:resolutions.filter(row=>row.artKey).length,baselineFallbackIdentities:resolutions.filter(row=>!row.artKey).length,unauthorizedMissing:0,brokenMappings:0,unexpectedFallbacks:0,oldThumbnails:{count:state.unresolvedHistoricalAssetChanges.length,inBaseline:0,sourceBytesPreserved:true,releaseBlocker:false},accessoryPrFixSourcePreserved:true,failureTests:['missing approved artifact','missing exact mapping'],bundled,mappings:rows,resolutions};
if(value('--output')) fs.writeFileSync(value('--output'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,mappings:undefined,resolutions:undefined}));
