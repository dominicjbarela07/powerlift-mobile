import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Exact source-bound owner validation; never represents visual/device proof.
export function assertClientFixScope(scope, fingerprint, modifications, ownerText) {
  assert.ok(['canonical-zero-load-edit-20261005', 'canonical-set-save-recovery-20261008'].includes(scope?.scope), 'unknown owner client-fix scope');
  assert.equal(scope.productFingerprint, fingerprint, 'client-fix validation cannot cover changed product source');
  assert.equal(scope.validation, 'OWNER_DIRECTED_CONTRACTS_ONLY');
  assert.ok(ownerText.includes(scope.ownerInstruction), 'exact current owner task is required');
  assert.ok(ownerText.includes('You will not do simulator runs. Stop talking about it'), 'validation restriction requires the exact owner instruction');
  assert.deepEqual(modifications.map(row => row.path).sort(), Object.keys(scope.changedProductFiles).sort(), 'client-fix scope cannot include unrelated changes');
  for (const row of modifications) assert.equal(row.after, scope.changedProductFiles[row.path], 'client-fix source changed');
  assert.deepEqual(Object.keys(scope.contracts).sort(), scope.scope === 'canonical-set-save-recovery-20261008'
    ? ['scripts/test-accessory-pr-save-api.mjs', 'scripts/test-canonical-set-save-recovery.mjs', 'scripts/test-session-logger-journal.mjs', 'scripts/test-set-submission-lifecycle.mjs']
    : ['scripts/test-zero-load-edit-api.mjs', 'scripts/test-zero-load-edit-set.mjs']);
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
  const modifications = scope.scope === 'canonical-set-save-recovery-20261008'
    ? assertSetSaveRecoveryBaseline({root, scope, state, files}) : delta.modifications;
  assertClientFixScope(scope, fingerprint, modifications, evidence.toString());
  const results = [];
  for (const [file, expected] of Object.entries(scope.contracts)) {
    assert.equal(sha(fs.readFileSync(path.join(root, file))), expected, 'client fix contract changed');
    const output = execFileSync(process.execPath, ['--import', 'tsx', file], {cwd: root, env: process.env, encoding: 'utf8', timeout: file === 'scripts/test-accessory-pr-save-api.mjs' ? 70000 : 30000});
    assert.match(output, /PASS|tests passed/);
    results.push({file, sourceSha256: expected, result: 'PASS', output});
  }
  const receipt = {scope: scope.scope, productFingerprint: fingerprint, completedAt: new Date().toISOString(),
    validation: scope.validation, runtimeVerified: false, contracts: results};
  fs.writeFileSync(path.join(exportDir, 'release-client-fix-contracts.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
