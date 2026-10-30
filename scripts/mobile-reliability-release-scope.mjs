import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const reliabilityInstruction = "If the last two fixes are fully validated and you're confident in its ability to work, please ship it to 3.0.";
export const reliabilityPaths = ['app/(tabs)/athlete-dashboard.tsx', 'app/(tabs)/workout/[workoutId].tsx', 'config/protected-fix-manifest.json', 'lib/set-edit-recovery.ts'];
export function assertReliabilityBaseline({ root, scope, state, files }) {
  const previous = state.verifiedProduction3AppleSignInRetirement;
  assert.equal(scope.baselineUpdateId, previous.publication.id, 'Reliability must retain the actual current 3.0 update');
  assert.equal(scope.baselineSourceSha, previous.publication.gitCommitHash, 'Reliability must retain the actual current 3.0 source');
  const read = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'Reliability baseline proof changed');
    return JSON.parse(bytes);
  };
  const gate = read(previous.publishedProof.gateC), audit = read(previous.publishedProof.assetAudit);
  const exported = read(previous.publishedProof.exportSource), baseline = read(scope.baselineFiles);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, scope.baselineUpdateId); assert.equal(gate.published.gitCommitHash, scope.baselineSourceSha);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0); assert.equal(audit.updateId, gate.published.id);
  assert.equal(exported.candidateSha, scope.baselineSourceSha);
  assert.equal(exported.bundle.sha256, gate.published.servedBundleSha256);
  assert.equal(exported.bundle.sha256, previous.publication.servedBundleSha256);
  assert.ok(audit.assets.length); assert.equal(audit.verified, audit.assets.length);
  assert.deepEqual([...new Set(audit.assets.map(a => a.hash))].sort(), [...exported.assetHashes].sort());
  const fingerprint = sha(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b))));
  assert.equal(fingerprint, gate.candidateProductFingerprint);
  assert.equal(fingerprint, scope.baselineProductFingerprint); assert.equal(fingerprint, exported.productFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'Reliability cannot remove published files or artwork');
  const changes = Object.entries(files).filter(([file, hash]) => baseline[file] !== hash).map(([path, after]) => ({ path, after }));
  assert.deepEqual(changes.map(row => row.path).sort(), reliabilityPaths, 'Reliability cannot include unrelated product changes');
  return changes;
}
export function verifyReliabilityDeployment({ root, scope, state }) {
  const bytes = fs.readFileSync(path.resolve(root, scope.backendDeploymentReceipt.path));
  assert.equal(sha(bytes), scope.backendDeploymentReceipt.sha256, 'Backend deployment proof changed');
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.sourceSha, scope.backendSourceSha); assert.equal(receipt.liveVerified, true);
  assert.equal(receipt.gate.pass, true); assert.equal(receipt.gate.candidateSha, scope.backendSourceSha);
  assert.equal(receipt.gate.ownerPolicyAcceptance.candidateOwned, false);
  assert.equal(receipt.gate.repChainAcceptance.candidateOwned, false);
  assert.equal(receipt.gate.legacyBreakingPermissionControlRejected, true);
  assert.equal(scope.backendHealthUrl, 'https://app.strengthledger.fit/health/recognition');
  const live = JSON.parse(execFileSync('curl', ['--fail', '--silent', '--show-error', '--max-time', '20', scope.backendHealthUrl], { encoding: 'utf8' }));
  assert.equal(live.ready, true); assert.equal(live.source_sha, scope.backendSourceSha, 'Matching edit backend must be live before the mobile release');
  assert.equal(live.policy_version, 'accessory-rep-chain-equipment-isolated-v4');
  const remote = JSON.parse(execFileSync('npx', ['eas-cli', 'update:list', '--branch', 'production-3-preparation', '--limit', '2', '--json', '--non-interactive'], { cwd: root, encoding: 'utf8' }));
  const latest = remote.currentPage.find(update => update.platforms.includes('ios'));
  assert.equal(latest?.group, state.verifiedProduction3AppleSignInRetirement.publication.group, 'Active 3.0 changed; reconcile before release');
  assert.equal(latest.runtimeVersion, '3.0.0'); assert.equal(scope.ownerInstruction, reliabilityInstruction);
}
