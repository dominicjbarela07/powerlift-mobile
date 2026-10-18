import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const sessionCopyBackdownPath = 'components/coach-mobile/SessionEditingWorkspace.tsx';
export function assertSessionCopyBackdownBaseline({ root, scope, state, files }) {
  assert.equal(scope.scope, 'session-copy-backdown-20261018');
  const previous = state.verifiedProduction3WeeklyTrainingReport;
  assert.equal(scope.baselineUpdateId, previous.publication.id, 'use the actual published 3.0 baseline');
  assert.equal(scope.baselineSourceSha, previous.publication.gitCommitHash, 'retain the exact published source');
  const read = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'Session copy baseline evidence changed');
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
  assert.equal(sha(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)))), gate.candidateProductFingerprint);
  assert.equal(gate.candidateProductFingerprint, scope.baselineProductFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'Session copy hotfix cannot remove published product files');
  const changes = Object.entries(files).filter(([file, hash]) => baseline[file] !== hash).map(([path, after]) => ({ path, after }));
  assert.deepEqual(changes.map(row => row.path), [sessionCopyBackdownPath], 'Session copy hotfix cannot include unrelated product changes');
  return changes;
}
