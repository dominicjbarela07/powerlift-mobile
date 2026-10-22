import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
import { assertWeeklyReportBaseline, assertWeeklyReportDeployment } from './weekly-report-release-scope.mjs';
import { assertSessionCopyBackdownBaseline } from './session-copy-backdown-release-scope.mjs';
import { assertVideoEngineBaseline, verifyVideoEngineDeployment } from './video-engine-release-scope.mjs';
import { assertPortableArtworkBaseline } from './approved-artwork-portability-release-scope.mjs';

// Exact source-bound owner validation; never represents visual/device proof.
export function assertClientFixScope(scope, fingerprint, modifications, ownerText) {
  assert.ok(['video-engine-20261022', 'approved-artwork-portability-20261021', 'session-copy-backdown-20261018', 'weekly-training-report-20261017', 'canonical-zero-load-edit-20261005', 'canonical-set-save-recovery-20261008', 'canonical-copied-week-identity-20261013', 'athlete-video-archive-access-20261014', 'set-entry-video-preview-20261014', 'canonical-logger-floating-unit-20261014', 'canonical-fixed-equipment-eligibility-20261014', 'mobile-navigation-loading-20261016'].includes(scope?.scope), 'unknown owner client-fix scope');
  assert.equal(scope.productFingerprint, fingerprint, 'client-fix validation cannot cover changed product source');
  assert.equal(scope.validation, 'OWNER_DIRECTED_CONTRACTS_ONLY');
  assert.ok(ownerText.includes(scope.ownerInstruction), 'exact current owner task is required');
  if (scope.scope === 'video-engine-20261022') {
    assert.equal(scope.ownerInstruction, "Once it's that and safe and validated, please push it. I want it released.");
    assert.ok(ownerText.includes('video uploads') && ownerText.includes('video downloads') && ownerText.includes('video playback') && ownerText.includes('Baked Overlay 2'), 'retain complete video and accepted overlay request');
  } else if (scope.scope === 'approved-artwork-portability-20261021') {
    assert.equal(scope.ownerInstruction, 'Find what the fuck is going on, fix it, and deploy the fix.');
    assert.ok(ownerText.includes('image asset for RDL') && ownerText.includes('unacceptable'), 'retain the actual RDL asset recurrence and deployment directive');
  } else if (scope.scope === 'session-copy-backdown-20261018') {
    assert.equal(scope.ownerInstruction, 'Please fix it, validate it, and push the hotfix.');
    assert.ok(ownerText.includes('mobile session builder') && ownerText.includes('1x1') && ownerText.includes('3x5') && ownerText.includes('extra straight set'), 'Session copy requires the complete actual owner report');
  } else if (scope.scope === 'weekly-training-report-20261017') {
    assert.ok(['send it to testflight please... 2.1', "So I guess TestFlight is now just whatever the production is. That's fine. Fucking upload a 3.0."].includes(scope.ownerInstruction));
    assert.ok(ownerText.includes('Weekly Training Report') && ownerText.includes('Set / Weight / Reps / Effort'), 'Weekly export requires the complete approved owner scope');
  } else if (scope.scope === 'mobile-navigation-loading-20261016') {
    assert.ok(ownerText.includes('2.1 runtime') && ownerText.includes('ledger tab') && ownerText.includes('program manager') && ownerText.includes('calendar') && ownerText.includes('training session') && ownerText.includes('not acceptable'), 'Navigation scope requires the actual complete owner directive');
  } else if (['canonical-logger-floating-unit-20261014','canonical-fixed-equipment-eligibility-20261014'].includes(scope.scope)) {
    assert.equal(scope.ownerInstruction, scope.scope === 'canonical-logger-floating-unit-20261014' ? 'Sorry, I meant ship it.' : 'RHIA NWWSA RO BE fixed first!!!! this is a production 3.0 occurance!');
    assert.ok(ownerText.includes('I said make it fucking bigger') && ownerText.includes('It used to be a floating button'), 'Preserve the owner correction, not the rejected selector');
    assert.ok(ownerText.includes('it can be slightly smaller, just as long as its noticible'), 'Retain the final size refinement');
  } else if (scope.scope === 'set-entry-video-preview-20261014') {
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
  assert.deepEqual(Object.keys(scope.contracts).sort(), scope.scope === 'video-engine-20261022'
    ? ['scripts/test-video-artifact-cache.mjs', 'scripts/test-video-engine-failure-controls.mjs', 'scripts/test-video-engine-queue.mjs', 'scripts/test-video-engine-release-scope.mjs', 'scripts/test-video-player-recovery.mjs']
    : scope.scope === 'approved-artwork-portability-20261021'
    ? ['scripts/test-approved-artwork-portability-release-scope.mjs', 'scripts/test-approved-artwork-portability.mjs', 'scripts/test-private-movement-identity-contract.mjs', 'scripts/test-shared-movement-programming-context.mjs', 'scripts/test-single-current-movement-id.mjs']
    : scope.scope === 'session-copy-backdown-20261018'
    ? ['scripts/test-session-copy-backdown-api.mjs', 'scripts/test-session-copy-backdown-release-scope.mjs', 'scripts/test-session-workspace-top-backdown-copy.mjs']
    : scope.scope === 'weekly-training-report-20261017'
    ? ['scripts/test-training-week-report.mjs', 'scripts/test-weekly-report-release-scope.mjs']
    : scope.scope === 'mobile-navigation-loading-20261016'
    ? ['scripts/test-calendar-navigation-cache.mjs','scripts/test-evidence-read-cache.mjs','scripts/test-mobile-navigation-loading.mjs']
    : scope.scope === 'canonical-fixed-equipment-eligibility-20261014'
    ? ['scripts/test-fixed-equipment-api.mjs','scripts/test-fixed-equipment-eligibility.mjs','scripts/test-logger-floating-unit.mjs']
    : scope.scope === 'canonical-logger-floating-unit-20261014'
    ? ['scripts/test-logger-floating-unit.mjs']
    : scope.scope === 'set-entry-video-preview-20261014'
    ? ['scripts/test-selected-set-video-preview.mjs', 'scripts/test-session-execution-ownership.mjs', 'scripts/test-set-entry-video.mjs']
    : scope.scope === 'athlete-video-archive-access-20261014'
    ? ['scripts/test-archive-video-movement-api.mjs', 'scripts/test-today-archive-access.mjs']
    : scope.scope === 'canonical-copied-week-identity-20261013'
    ? ['scripts/test-active-session-hot-swap.mjs', 'scripts/test-active-session-mutation-backend.mjs', 'scripts/test-governed-movement-art-taxonomy.mjs', 'scripts/test-private-movement-identity-contract.mjs', 'scripts/test-single-current-movement-id.mjs']
    : scope.scope === 'canonical-set-save-recovery-20261008'
    ? ['scripts/test-accessory-pr-save-api.mjs', 'scripts/test-canonical-set-save-recovery.mjs', 'scripts/test-session-logger-journal.mjs', 'scripts/test-set-submission-lifecycle.mjs']
    : ['scripts/test-zero-load-edit-api.mjs', 'scripts/test-zero-load-edit-set.mjs']);
}
export function assertNavigationBaseline({root, scope, state, files}) {
  assert.equal(scope.scope, 'mobile-navigation-loading-20261016');
  assert.equal(scope.baselineUpdateId, state.currentTestFlight.id, 'Navigation must start at the actual current update');
  assert.equal(scope.baselineSourceSha, state.currentTestFlight.gitCommitHash, 'Navigation must retain the actual published source');
  const read = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'Navigation baseline proof changed');
    return JSON.parse(bytes);
  };
  const proof = state.verifiedEquipmentEligibility.publishedProof;
  const gate = read(proof.gateC), audit = read(proof.assetAudit);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, scope.baselineUpdateId);
  assert.equal(gate.published.gitCommitHash, scope.baselineSourceSha);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(audit.servedLaunchSha256, gate.published.servedBundleSha256);
  const baseline = read(scope.baselineFiles);
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a],[b]) => a.localeCompare(b)))), gate.candidateProductFingerprint);
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'Navigation cannot remove any published product file');
  const changes = Object.entries(files).filter(([file,hash]) => baseline[file] !== hash).map(([path,after]) => ({path,after}));
  assert.deepEqual(changes.map(row => row.path).sort(), ['app/(tabs)/athlete-calendar.tsx','components/ledger/use-ledger-live-data.ts','lib/calendar-range-pagination.ts'], 'Navigation cannot include unrelated product changes');
  return changes;
}
export function assertLoggerUnitBaseline({root, scope, state, files}) {
  assert.ok(['canonical-logger-floating-unit-20261014','canonical-fixed-equipment-eligibility-20261014'].includes(scope.scope));
  assert.equal(scope.baselineUpdateId, state.currentTestFlight.id);
  assert.equal(scope.baselineSourceSha, state.currentTestFlight.gitCommitHash);
  const read = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'Logger unit baseline proof changed');
    return JSON.parse(bytes);
  };
  const proof = state.verifiedSetEntryVideo.publishedProof;
  const gate = read(proof.gateC), audit = read(proof.assetAudit);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, scope.baselineUpdateId);
  assert.equal(gate.published.gitCommitHash, scope.baselineSourceSha);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(audit.servedLaunchSha256, gate.published.servedBundleSha256);
  const baseline = read(scope.baselineFiles);
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a],[b]) => a.localeCompare(b)))), gate.candidateProductFingerprint);
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'Logger unit update cannot remove product files');
  const changes = Object.entries(files).filter(([file,hash]) => baseline[file] !== hash).map(([path,after]) => ({path,after}));
  const allowed = ['app/(tabs)/workout/[workoutId].tsx', 'components/ui/floating-control-coordinator.tsx', 'components/workout-logger/session-v3-shell.tsx', 'config/protected-fix-manifest.json'];
  if (scope.scope === 'canonical-fixed-equipment-eligibility-20261014') allowed.push('lib/equipment-flow-subject.ts');
  assert.deepEqual(changes.map(row => row.path).sort(), allowed, 'Logger update cannot include unrelated product changes');
  return changes;
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
  assert.deepEqual(changes.map(row => row.path).sort(), ['app/(tabs)/workout/[workoutId].tsx', 'components/workout-logger/core-loggers.tsx', 'components/workout-logger/selected-set-video-preview.tsx', 'components/workout-logger/set-entry-video.tsx', 'config/bottom-sheet-consumer-inventory.json', 'config/protected-fix-manifest.json', 'lib/set-video-upload-status.ts', 'lib/videoUploadQueue.ts'], 'Set video scope cannot include unrelated product changes');
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
  const modifications = scope.scope === 'video-engine-20261022'
    ? assertVideoEngineBaseline({root, scope, state, files})
    : scope.scope === 'approved-artwork-portability-20261021'
    ? assertPortableArtworkBaseline({root, scope, state, files})
    : scope.scope === 'session-copy-backdown-20261018'
    ? assertSessionCopyBackdownBaseline({root, scope, state, files})
    : scope.scope === 'weekly-training-report-20261017'
    ? assertWeeklyReportBaseline({root, scope, state, files})
    : scope.scope === 'mobile-navigation-loading-20261016'
    ? assertNavigationBaseline({root, scope, state, files})
    : ['canonical-logger-floating-unit-20261014','canonical-fixed-equipment-eligibility-20261014'].includes(scope.scope)
    ? assertLoggerUnitBaseline({root, scope, state, files})
    : scope.scope === 'set-entry-video-preview-20261014'
    ? assertSelectedVideoBaseline({root, scope, state, files})
    : scope.scope === 'athlete-video-archive-access-20261014'
    ? assertArchiveAccessBaseline({root, scope, state, files})
    : scope.scope === 'canonical-copied-week-identity-20261013'
    ? assertCopiedWeekIdentityBaseline({root, scope, state, files})
    : scope.scope === 'canonical-set-save-recovery-20261008'
    ? assertSetSaveRecoveryBaseline({root, scope, state, files}) : delta.modifications;
  assertClientFixScope(scope, fingerprint, modifications, evidence.toString());
  if (['canonical-logger-floating-unit-20261014','canonical-fixed-equipment-eligibility-20261014'].includes(scope.scope)) {
    assert.equal(scope.visualEvidence.length, 3);
    for (const entry of scope.visualEvidence) {
      assert.ok(entry.path.startsWith('docs/validation/logger-unit-control-dev-2026-10-14/'));
      assert.equal(sha(fs.readFileSync(path.join(root, entry.path))), entry.sha256, 'Reviewed Logger screenshot changed');
    }
  }
  if (scope.scope === 'mobile-navigation-loading-20261016') {
    const bytes = fs.readFileSync(path.resolve(root,scope.backendDeploymentReceipt.path));
    assert.equal(sha(bytes),scope.backendDeploymentReceipt.sha256);
    const deployment = JSON.parse(bytes);
    assert.equal(deployment.sourceSha,scope.backendSourceSha);
    assert.equal(deployment.liveVerified,true);
    assert.equal(deployment.gate.pass,true);
    assert.equal(deployment.gate.navigationLoadingAcceptance.candidateOwned,false);
    assert.equal(deployment.gate.navigationLoadingAcceptance.cases,3);
    const live=JSON.parse(execFileSync('/usr/bin/curl',['--fail','--silent','--show-error','--max-time','20','https://app.strengthledger.fit/health/recognition'],{encoding:'utf8'}));
    assert.equal(live.source_sha,scope.backendSourceSha,'Navigation backend must be live before mobile publication');
    assert.equal(live.ready,true);
  }
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
  if (scope.scope === 'video-engine-20261022') verifyVideoEngineDeployment({root, scope, state});
  if (scope.scope === 'weekly-training-report-20261017') assertWeeklyReportDeployment({root, scope});
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
