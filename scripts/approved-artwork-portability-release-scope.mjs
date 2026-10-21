import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const portableArtworkPaths = [
  'config/protected-fix-manifest.json',
  'lib/canonical-movement-art-subject.ts', 'lib/canonical-movement-artwork.ts',
  'lib/current-session-movement.ts', 'lib/governed-movement-art-taxonomy.ts', 'lib/movement-artwork-hero.ts',
].sort();
export function assertPortableArtworkBaseline({ root, scope, state, files }) {
  assert.equal(scope.scope, 'approved-artwork-portability-20261021');
  const previous = state.verifiedProduction3SessionCopyBackdown;
  assert.equal(scope.baselineUpdateId, previous.publication.id, 'retain actual latest 3.0 update');
  assert.equal(scope.baselineSourceSha, previous.publication.gitCommitHash, 'retain actual latest 3.0 source');
  const read = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'approved-artwork baseline proof changed');
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
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'artwork repair cannot remove published product files');
  const changes = Object.entries(files).filter(([file, hash]) => baseline[file] !== hash).map(([path, after]) => ({ path, after }));
  assert.deepEqual(changes.map(row => row.path).sort(), portableArtworkPaths, 'artwork repair cannot include unrelated product changes or replacement assets');
  return changes;
}
