import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const videoEnginePaths = ['config/protected-fix-manifest.json','components/SetVideoPlayerModal.tsx','lib/set-video-upload-status.ts','lib/videoArtifactCache.ts','lib/videoUploadQueue.ts'].sort();
export function assertVideoEngineBaseline({root, scope, state, files}) {
  assert.equal(scope.scope, 'video-engine-20261022');
  const previous = state.verifiedProduction3ApprovedArtworkPortability;
  assert.equal(scope.baselineUpdateId, previous.publication.id, 'retain actual latest 3.0 update');
  assert.equal(scope.baselineSourceSha, previous.publication.gitCommitHash, 'retain actual latest 3.0 source');
  const read = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'video baseline proof changed');
    return JSON.parse(bytes);
  };
  const gate = read(previous.publishedProof.gateC), audit = read(previous.publishedProof.assetAudit);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, scope.baselineUpdateId);
  assert.equal(gate.published.gitCommitHash, scope.baselineSourceSha);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(audit.servedLaunchSha256, gate.published.servedBundleSha256);
  const baseline = read(scope.baselineFiles);
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a],[b]) => a.localeCompare(b)))), gate.candidateProductFingerprint);
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'video release cannot remove published product files');
  const changes = Object.entries(files).filter(([file, hash]) => baseline[file] !== hash).map(([path, after]) => ({path, after}));
  assert.deepEqual(changes.map(row => row.path).sort(), videoEnginePaths, 'video release cannot include unrelated product changes or artwork');
  return changes;
}
export function assertVideoEngineDeployment(deployment, expectedSha, live) {
  assert.equal(deployment.sourceSha, expectedSha);
  assert.equal(deployment.liveVerified, true);
  assert.equal(deployment.gate.pass, true);
  assert.equal(deployment.worker.sourceSha, expectedSha);
  assert.equal(deployment.worker.liveVerified, true);
  assert.equal(deployment.schemaRevision, 'f3e5a7b9c1d3');
  assert.equal(deployment.cloud.passed, true);
  assert.equal(deployment.cloud.syntheticCleanupVerified, true);
  assert.equal(live.source_sha, expectedSha, 'matching video backend must be live before mobile publication');
  assert.equal(live.ready, true);
}
export function verifyVideoEngineDeployment({root, scope}) {
  const bytes = fs.readFileSync(path.resolve(root, scope.backendDeploymentReceipt.path));
  assert.equal(sha(bytes), scope.backendDeploymentReceipt.sha256, 'video deployment proof changed');
  const live = JSON.parse(execFileSync('/usr/bin/curl', ['--fail','--silent','--show-error','--max-time','20','https://app.strengthledger.fit/health/recognition'], {encoding:'utf8'}));
  assertVideoEngineDeployment(JSON.parse(bytes), scope.backendSourceSha, live);
}
