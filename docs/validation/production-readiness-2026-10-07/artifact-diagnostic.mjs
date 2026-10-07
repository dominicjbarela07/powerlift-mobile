import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root='/Users/dominic/powerlifting_app_dev/powerlift_mobile';
const evidence=path.join(root,'docs/validation/production-readiness-2026-10-07');
const exported='/Users/dominic/Documents/Codex/2026-10-03/re/outputs/production-readiness-2026-10-07/export-production3';
const read=file=>JSON.parse(fs.readFileSync(file));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const integrity=await import(pathToFileURL(path.join(root,'scripts/testflight-cumulative-integrity.mjs')));
const gates=await import(pathToFileURL(path.join(root,'scripts/canonical-art-review-gate.mjs')));
gates.assertHumanArtworkGate(root);
const state=read(path.join(root,'artwork-review/review-state.json'));
const policy=read(path.join(root,'artwork-review/runtime-policy.json'));
const baseline=read(path.join(root,'config/testflight-release-integrity.json'));
const expected=new Set(policy.approved_exact_artwork.map(row=>row.app_sha256));
const equipmentHashes=new Set([...read(path.join(root,'docs/validation/equipment-type-art-2026-09-13/asset-manifest.json')).assets.map(row=>row.files.app.sha256),read(path.join(root,'artwork-review/equipment-types/plate-loaded-cable-station-v1/review.json')).app_sha256]);
const required=integrity.protectedDeliveryHashes(root,baseline);
integrity.assertOwnerEvidence(root,baseline.assetRemovalAuthorizations);
const authorizedRemovals=new Set(baseline.assetRemovalAuthorizations.filter(row=>row.action==='REMOVE').map(row=>row.hash));
for(const row of baseline.assetRemovalAuthorizations.filter(row=>row.retainedPath)) {
  if(integrity.expoHash(fs.readFileSync(path.join(root,row.retainedPath)))!==row.hash) throw new Error('Authorized historical consolidation bytes not retained');
}
const navigationDirectory=path.join(root,'node_modules/@react-navigation/elements/lib/module/assets');
const navigationAssets=new Map(fs.readdirSync(navigationDirectory).filter(file=>/^(?:back-icon|search-icon)@[1-4]x\.ios\.png$/.test(file)).map(file=>[integrity.expoHash(fs.readFileSync(path.join(navigationDirectory,file))),path.relative(root,path.join(navigationDirectory,file))]));
const metadata=read(path.join(exported,'metadata.json')).fileMetadata;
const results={sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),publicationAuthorized:false,nativeBinaryBuilt:false,approvedMappings:policy.approved_exact_artwork.length,uniqueMovementImages:expected.size,platforms:{}};
const iosMetadataAssets=new Map(metadata.ios.assets.map(row=>[integrity.expoHash(fs.readFileSync(path.join(exported,row.path))),row]));
for(const platform of ['ios','android']) {
  const rows=metadata[platform].assets;
  const shas=new Set(),hashes=new Set();
  for(const row of rows) {const bytes=fs.readFileSync(path.join(exported,row.path));shas.add(sha(bytes));hashes.add(integrity.expoHash(bytes));}
  const missing=[...expected].filter(hash=>!shas.has(hash));
  if(missing.length) throw new Error(`${platform}: ${missing.length} approved movement images missing`);
  assert.deepEqual([...equipmentHashes].filter(hash=>!shas.has(hash)),[],`${platform}: approved equipment-category image missing`);
  const missingProtected=[...required].filter(hash=>!hashes.has(hash)&&!authorizedRemovals.has(hash));
  const platformOnly=[];
  for(const hash of missingProtected) {
    const asset=iosMetadataAssets.get(hash);
    const originalFiles=asset?.originalFiles || (navigationAssets.has(hash)?[navigationAssets.get(hash)]:[]);
    const allowed=platform==='android' && navigationAssets.has(hash);
    if(!allowed) throw new Error(`${platform}: unexplained protected asset loss ${hash}: ${originalFiles.join(',')}`);
    platformOnly.push({hash,originalFiles});
  }
  if(platform==='ios') integrity.assertProtectedArtifactAssets(required,hashes,baseline.assetRemovalAuthorizations);
  const o=state.canonical_assets.find(row=>row.movement_definition_id===650);
  if(!o || !shas.has(o.files.app.sha256)) throw new Error('Approved OHP absent from actual artifact');
  results.platforms[platform]={assetCount:rows.length,uniqueAssetHashes:hashes.size,approvedMovementImages:expected.size,approvedEquipmentCategoryImages:equipmentHashes.size,missingApprovedEquipmentCategoryImages:0,missingApprovedMovementImages:0,missingProtectedMovementImages:0,ownerAuthorizedHistoricalRemovalHashes:authorizedRemovals.size,historicalConsolidationSourceBytesPreserved:true,platformOnlyNavigationAssets:platformOnly,OHPIncluded:true,bundle:metadata[platform].bundle,bundleSha256:sha(fs.readFileSync(path.join(exported,metadata[platform].bundle)))};
}
fs.writeFileSync(path.join(evidence,'platform-asset-audit.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results));

const sourceRef=baseline.movementImageryRestoration.sourceSha;
const originalPolicy=JSON.parse(execFileSync('git',['show',`${sourceRef}:artwork-review/runtime-policy.json`],{cwd:root,maxBuffer:32*1024*1024}));
const missingOrChangedBytes=[],changedCrops=[];
for(const prior of originalPolicy.approved_exact_artwork) {
  const current=policy.approved_exact_artwork.find(row=>row.key===prior.key);
  if(!current || current.app_sha256!==prior.app_sha256 || current.candidate_id!==prior.candidate_id) missingOrChangedBytes.push({key:prior.key,prior,current});
  else if(JSON.stringify(current.logger_crop)!==JSON.stringify(prior.logger_crop)) {
    const saved=state.logger_crop_reviews[current.candidate_id];
    changedCrops.push({key:prior.key,candidateId:current.candidate_id,priorCrop:prior.logger_crop,currentCrop:current.logger_crop,humanReceipt:saved?.review});
  }
}
const sourceDeltas=[];
for(const file of ['lib/canonical-movement-artwork-assets.ts','lib/canonical-core-artwork-identities.ts','config/governed-core-artwork-reuse.json','artwork-review/runtime-policy.json']) {
  const current=fs.readFileSync(path.join(root,file)),prior=execFileSync('git',['show',`${sourceRef}:${file}`],{cwd:root,maxBuffer:32*1024*1024});
  if(sha(current)!==sha(prior)) sourceDeltas.push({path:file,protectedHash:sha(prior),currentHash:sha(current),registeredCurrentProgression:(baseline.devSourceProgressions||[]).some(row=>row.path===file&&row.after===sha(current)),registeredCurrentAuthorization:(baseline.sourceAuthorizations||[]).some(row=>row.path===file&&row.after===sha(current))});
}
const diagnosis={scope:'Independent inventory diagnosis; this does not bypass or pass the failed release-source gate.',protectedPreRegressionApprovedMappings:originalPolicy.approved_exact_artwork.length,missingOrChangedApprovedImageBytes:missingOrChangedBytes,ownerApprovedCropChanges:changedCrops,sourceDeltas};
fs.writeFileSync(path.join(evidence,'release-evidence-diagnosis.json'),JSON.stringify(diagnosis,null,2)+'\n');
console.log(JSON.stringify({protectedPreRegressionApprovedMappings:diagnosis.protectedPreRegressionApprovedMappings,missingOrChangedApprovedImageBytes:missingOrChangedBytes.length,ownerApprovedCropChanges:changedCrops.length,sourceDeltas}));

const {resolveApprovedExactMovementArtwork}=await import(pathToFileURL(path.join(root,'lib/movement-artwork-hero.ts')));
const {canonicalArtworkInputFromDefinition}=await import(pathToFileURL(path.join(root,'lib/canonical-movement-art-subject.ts')));
const {bindExportSource,assertBoundExport}=await import(pathToFileURL(path.join(root,'scripts/verify-testflight-release-integrity.mjs')));
const sourceReceipt=bindExportSource(root,exported);
assertBoundExport(root,exported);
fs.copyFileSync(path.join(exported,'release-export-source.json'),path.join(evidence,'local-export-source.json'));
const priorCatalog=JSON.parse(execFileSync('git',['show',`${sourceRef}:config/governed-movement-art-taxonomy.json`],{cwd:root,maxBuffer:32*1024*1024}));
const authorizedCropKeys=new Set(changedCrops.filter(row=>row.humanReceipt?.source==='human_logger_crop_ui' && row.humanReceipt.action==='approve').map(row=>row.key));
const resolutions=[];
for(const definition of priorCatalog.movements) {
  const input=canonicalArtworkInputFromDefinition(definition),before=structuredClone(input);
  const expectedArt=resolveApprovedExactMovementArtwork(input,true,originalPolicy);
  const actualArt=resolveApprovedExactMovementArtwork(input,true,policy);
  const stripCrop=row=>{if(!row)return null;const {logger_crop,...rest}=row;return rest;};
  assert.deepEqual(stripCrop(actualArt),stripCrop(expectedArt),`Baseline identity/art metadata changed: ${definition.id}:${definition.key}`);
  assert.deepEqual(input,before,'Resolver mutated canonical identity');
  if(JSON.stringify(actualArt?.logger_crop)!==JSON.stringify(expectedArt?.logger_crop)) assert.ok(authorizedCropKeys.has(actualArt.key),'Changed crop lacks actual human review');
  resolutions.push({movementId:definition.id,key:definition.key,artKey:actualArt?.key??null,candidateId:actualArt?.candidate_id??null});
}
for(const original of originalPolicy.approved_exact_artwork) {
  const mapping=state.canonical_assets.find(row=>row.key===original.key && row.candidate_id===original.candidate_id);
  assert.ok(mapping,`Baseline approved mapping missing: ${original.key}`);
  assert.equal(mapping.movement_definition_id,original.movement_definition_id);
  assert.equal(sha(fs.readFileSync(path.join(root,mapping.files.app.path))),original.app_sha256);
}
const inventory={sourceSha:results.sourceSha,baselineSourceSha:sourceRef,baselineUpdateId:baseline.movementImageryRestoration.updateId,baselineApprovedMappings:originalPolicy.approved_exact_artwork.length,canonicalIdentities:resolutions.length,exactArtIdentities:resolutions.filter(row=>row.artKey).length,establishedFallbackIdentities:resolutions.filter(row=>!row.artKey).length,missingApprovedMappings:0,changedApprovedImageBytes:0,unexpectedFallbacks:0,unauthorizedCropChanges:0,authorizedCropChanges:changedCrops,productFingerprint:sourceReceipt.productFingerprint,scope:'Independent whole-inventory check using actual approved image/crop receipts. Does not pass the failed source-bound release gates or certify a native/delivered build.',resolutions};
fs.writeFileSync(path.join(evidence,'baseline-resolver-audit.json'),JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify({...inventory,resolutions:undefined}));
