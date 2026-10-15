import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Exact source-bound owner validation; never represents visual/device proof.
export function assertClientFixScope(scope, fingerprint, modifications, ownerText) {
  assert.ok(['canonical-zero-load-edit-20261005', 'canonical-set-save-recovery-20261008', 'canonical-copied-week-identity-20261013', 'athlete-video-archive-access-20261014', 'set-entry-video-preview-20261014'].includes(scope?.scope), 'unknown owner client-fix scope');
  assert.equal(scope.productFingerprint, fingerprint, 'client-fix validation cannot cover changed product source');
  assert.equal(scope.validation, 'OWNER_DIRECTED_CONTRACTS_ONLY');
  assert.ok(ownerText.includes(scope.ownerInstruction), 'exact current owner task is required');
  if (scope.scope === 'set-entry-video-preview-20261014') {
    assert.ok(ownerText.includes('Good, please ship it.') && ownerText.includes('ship it for both 3.0 and 2.1'), 'Selected video scope requires the actual owner signoff and both runtime targets');
    assert.ok(ownerText.includes('before I even') && ownerText.includes('submit it'), 'Local preview requires the actual owner request');
  } else if (scope.scope === 'athlete-video-archive-access-20261014') {
    assert.equal(scope.ownerInstruction, 'ok good, let me drill down by movement as well and its god to go');
    assert.ok(ownerText.includes('if the mac locks on you, just continue any other checks not requiring the sim and push if passing.'), 'Mac-lock continuation requires the actual owner instruction');
  } else if (scope.scope === 'canonical-copied-week-identity-20261013') {
    assert.ok(ownerText.includes('No I will test with you at a different time. Get everything fuckign set up!'), 'deferred device testing requires the exact owner instruction');
  } else assert.ok(ownerText.includes('You will not do simulator runs. Stop talking about it'), 'validation restriction requires the exact owner instruction');
  assert.deepEqual(modifications.map(row => row.path).sort(), Object.keys(scope.changedProductFiles).sort(), 'client-fix scope cannot include unrelated changes');
  for (const row of modifications) assert.equal(row.after, scope.changedProductFiles[row.path], 'client-fix source changed');
  assert.deepEqual(Object.keys(scope.contracts).sort(), scope.scope === 'set-entry-video-preview-20261014'
    ? ['scripts/test-selected-set-video-preview.mjs', 'scripts/test-session-execution-ownership.mjs', 'scripts/test-set-entry-video.mjs']
    : scope.scope === 'athlete-video-archive-access-20261014'
    ? ['scripts/test-archive-video-movement-api.mjs', 'scripts/test-today-archive-access.mjs']
    : scope.scope === 'canonical-copied-week-identity-20261013'
    ? ['scripts/test-active-session-hot-swap.mjs', 'scripts/test-active-session-mutation-backend.mjs', 'scripts/test-governed-movement-art-taxonomy.mjs', 'scripts/test-private-movement-identity-contract.mjs', 'scripts/test-single-current-movement-id.mjs']
    : scope.scope === 'canonical-set-save-recovery-20261008'
    ? ['scripts/test-accessory-pr-save-api.mjs', 'scripts/test-canonical-set-save-recovery.mjs', 'scripts/test-session-logger-journal.mjs', 'scripts/test-set-submission-lifecycle.mjs']
    : ['scripts/test-zero-load-edit-api.mjs', 'scripts/test-zero-load-edit-set.mjs']);
}
export function assertSelectedVideoBaseline({root, scope, state, files}) {
  assert.equal(scope.scope, 'set-entry-video-preview-20261014');
  assert.equal(scope.baselineUpdateId, state.currentTestFlight.id);
  assert.equal(scope.baselineSourceSha, state.currentTestFlight.gitCommitHash);
  const readProof = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'Video baseline proof changed');
    return JSON.parse(bytes);
  };
  const proof = state.verifiedProduction3VideoArchiveAccess.publishedProof;
  const gate = readProof(proof.gateC), audit = readProof(proof.assetAudit);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.gitCommitHash, scope.baselineSourceSha, 'Both runtime baselines must retain the same verified cumulative product source');
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(audit.servedLaunchSha256, gate.published.servedBundleSha256);
  const baseline = readProof(scope.baselineFiles);
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a],[b]) => a.localeCompare(b)))), gate.candidateProductFingerprint);
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'Set video additions cannot remove prior product files');
  const changes = Object.entries(files).filter(([file,hash]) => baseline[file] !== hash).map(([path,after]) => ({path,after}));
  assert.deepEqual(changes.map(row => row.path).sort(), ['app/(tabs)/workout/[workoutId].tsx', 'components/workout-logger/core-loggers.tsx', 'components/workout-logger/selected-set-video-preview.tsx', 'components/workout-logger/set-entry-video.tsx', 'config/protected-fix-manifest.json', 'lib/set-video-upload-status.ts', 'lib/videoUploadQueue.ts'], 'Set video scope cannot include unrelated product changes');
  return changes;
}
export function assertArchiveAccessBaseline({root, scope, state, files}) {
  assert.equal(scope.scope, 'athlete-video-archive-access-20261014');
  assert.equal(scope.baselineUpdateId, state.currentTestFlight.id, 'Archive access must retain the actual current update');
  assert.equal(scope.baselineSourceSha, state.currentTestFlight.gitCommitHash, 'Archive access must retain the actual published source');
  const receipt = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'Archive baseline proof changed');
    return JSON.parse(bytes);
  };
  const proof = state.verifiedCopiedWeekIdentity.publishedProof;
  const gate = receipt(proof.gateC), audit = receipt(proof.assetAudit);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, state.currentTestFlight.id);
  assert.equal(gate.published.gitCommitHash, state.currentTestFlight.gitCommitHash);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(audit.servedLaunchSha256, gate.published.servedBundleSha256);
  const baseline = receipt(scope.baselineFiles);
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a],[b])=>a.localeCompare(b)))), gate.candidateProductFingerprint, 'Archive baseline must equal the complete verified publication');
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file=>!files[file]), [], 'Archive access cannot remove product files');
  const changes = Object.entries(files).filter(([file,hash])=>baseline[file]!==hash).map(([path,after])=>({path,after}));
  assert.deepEqual(changes.map(row=>row.path).sort(), ['app/(tabs)/athlete-dashboard.tsx', 'components/home/AthleteHomeV3.tsx', 'components/home/TodayQuickAccess.tsx', 'components/ledger/VideoMovementPicker.tsx', 'components/ledger/archive-detail.tsx', 'components/ledger/archive-foundation.tsx', 'config/protected-fix-manifest.json', 'lib/ledger-archive.ts', 'lib/today-history-routes.ts'], 'Archive access cannot include unrelated product changes');
  return changes;
}
export function assertCopiedWeekIdentityBaseline({root, scope, state, files}) {
  assert.equal(scope.scope, 'canonical-copied-week-identity-20261013');
  assert.equal(scope.baselineUpdateId, state.currentTestFlight.id, 'identity fix must start at the actual current update');
  assert.equal(scope.baselineSourceSha, state.currentTestFlight.gitCommitHash, 'identity fix must retain the published source');
  const receipt = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'identity fix baseline proof changed');
    return JSON.parse(bytes);
  };
  const proof = state.verifiedSetSaveRecovery.publishedProof;
  const gate = receipt(proof.gateC), audit = receipt(proof.assetAudit);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, state.currentTestFlight.id);
  assert.equal(gate.published.gitCommitHash, state.currentTestFlight.gitCommitHash);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(audit.servedLaunchSha256, gate.published.servedBundleSha256);
  const baseline = receipt(scope.baselineFiles);
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)))), gate.candidateProductFingerprint);
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'identity fix cannot remove product files');
  const changes = Object.entries(files).filter(([file, hash]) => baseline[file] !== hash).map(([path, after]) => ({path, after}));
  assert.deepEqual(changes.map(row => row.path).sort(), ['config/android/google-services.json', 'config/native-runtime-baselines.json', 'config/protected-fix-manifest.json', 'lib/active-session-hot-swap.ts', 'lib/api.ts',
    'lib/canonical-movement-art-subject.ts', 'lib/canonical-movement-artwork.ts', 'lib/current-session-movement.ts'], 'identity fix cannot include unrelated product changes');
  return changes;
}
export function assertSetSaveRecoveryBaseline({root, scope, state, files}) {
  assert.equal(scope.scope, 'canonical-set-save-recovery-20261008');
  assert.equal(scope.baselineUpdateId, state.currentTestFlight.id, 'Set save recovery must start at the actual current update');
  assert.equal(scope.baselineSourceSha, state.currentTestFlight.gitCommitHash, 'Set save recovery must retain actual published source');
  const receipt = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'current published proof changed');
    return JSON.parse(bytes);
  };
  // Use the existing independently verified publication, never a freshly
  // invented baseline or an exemption for previously changed product files.
  const proof = state.reviewedRuntimeContinuation.publishedProof;
  const gate = receipt(proof.gateC), audit = receipt(proof.assetAudit);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, state.currentTestFlight.id);
  assert.equal(gate.published.gitCommitHash, state.currentTestFlight.gitCommitHash);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(audit.servedLaunchSha256, gate.published.servedBundleSha256);
  const baseline = receipt(scope.baselineFiles);
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)))), gate.candidateProductFingerprint,
    'baseline files must equal the complete verified published product');
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'Set save recovery cannot remove product files');
  const changes = Object.entries(files).filter(([file, hash]) => baseline[file] !== hash).map(([path, after]) => ({path, after}));
  assert.deepEqual(changes.map(row => row.path).sort(), ['app/(tabs)/workout/[workoutId].tsx', 'config/protected-fix-manifest.json', 'lib/canonical-set-save-recovery.ts'], 'Set save recovery cannot include unrelated product changes');
  return changes;
}
export function runClientFixContracts({root, scope, fingerprint, delta, exportDir, state, files}) {
  assert.ok(exportDir, 'client fix requires an actual bound export');
  assert.deepEqual(delta.subtractions, [], 'client fix cannot remove existing product files');
  const evidence = fs.readFileSync(path.join(root, scope.ownerEvidencePath));
  assert.equal(sha(evidence), scope.ownerEvidenceSha256);
  const modifications = scope.scope === 'set-entry-video-preview-20261014'
    ? assertSelectedVideoBaseline({root, scope, state, files})
    : scope.scope === 'athlete-video-archive-access-20261014'
    ? assertArchiveAccessBaseline({root, scope, state, files})
    : scope.scope === 'canonical-copied-week-identity-20261013'
    ? assertCopiedWeekIdentityBaseline({root, scope, state, files})
    : scope.scope === 'canonical-set-save-recovery-20261008'
    ? assertSetSaveRecoveryBaseline({root, scope, state, files}) : delta.modifications;
  assertClientFixScope(scope, fingerprint, modifications, evidence.toString());
  if (scope.scope === 'athlete-video-archive-access-20261014') {
    const bytes = fs.readFileSync(path.resolve(root,scope.backendDeploymentReceipt.path));
    assert.equal(sha(bytes),scope.backendDeploymentReceipt.sha256);
    const deployment = JSON.parse(bytes);
    assert.equal(deployment.sourceSha,scope.backendSourceSha);
    assert.equal(deployment.liveVerified,true);
    assert.equal(deployment.gate.pass,true);
    assert.equal(deployment.gate.archiveAcceptance.candidateOwned,false);
    assert.equal(deployment.gate.archiveAcceptance.cases,14);
    const live=JSON.parse(execFileSync('/usr/bin/curl',['--fail','--silent','--show-error','--max-time','20','https://app.strengthledger.fit/health/recognition'],{encoding:'utf8'}));
    assert.equal(live.source_sha,scope.backendSourceSha,'Video movement backend must be live before mobile publication');
    assert.equal(live.ready,true);
  }
  if (scope.scope === 'canonical-copied-week-identity-20261013') {
    const bytes = fs.readFileSync(path.resolve(root, scope.backendDeploymentReceipt.path));
    assert.equal(sha(bytes), scope.backendDeploymentReceipt.sha256, 'identity backend deployment receipt changed');
    const deployment = JSON.parse(bytes);
    assert.equal(deployment.sourceSha, scope.backendSourceSha);
    assert.equal(deployment.liveVerified, true);
    assert.equal(deployment.gate.pass, true);
    assert.equal(deployment.gate.currentSessionIdentityAcceptance.candidateOwned, false);
    assert.equal(deployment.gate.currentSessionIdentityAcceptance.pass, true);
    const live = JSON.parse(execFileSync('/usr/bin/curl', ['--fail', '--silent', '--show-error', '--max-time', '20', 'https://app.strengthledger.fit/health/recognition'], {encoding:'utf8'}));
    assert.equal(live.source_sha, scope.backendSourceSha, 'identity correction must be live before its mobile publication');
    assert.equal(live.ready, true);
  }
  const results = [];
  for (const [file, expected] of Object.entries(scope.contracts)) {
    assert.equal(sha(fs.readFileSync(path.join(root, file))), expected, 'client fix contract changed');
    const output = execFileSync(process.execPath, ['--import', 'tsx', file], {cwd: root, env: process.env, encoding: 'utf8', timeout: file === 'scripts/test-active-session-mutation-backend.mjs' ? 130000 : file === 'scripts/test-accessory-pr-save-api.mjs' ? 70000 : 30000});
    assert.match(output, /PASS|tests passed/);
    results.push({file, sourceSha256: expected, result: 'PASS', output});
  }
  const receipt = {scope: scope.scope, productFingerprint: fingerprint, completedAt: new Date().toISOString(),
    validation: scope.validation, runtimeVerified: false, contracts: results};
  fs.writeFileSync(path.join(exportDir, 'release-client-fix-contracts.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
