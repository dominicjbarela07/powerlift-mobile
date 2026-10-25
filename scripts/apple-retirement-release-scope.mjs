import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const retirementPaths = ['app/login.tsx', 'components/AuthSsoButtons.tsx', 'config/protected-fix-manifest.json'];
export const retirementInstruction = "Don't fix it, just so I can get rid of it. We're just gonna stick with email verification for now. Just make sure that it doesn't show anywhere anymore on production.";
export function assertAppleRetirementBaseline({root, scope, state, files}) {
  const previous = state.verifiedProduction3Onboarding;
  assert.equal(scope.baselineUpdateId, previous.publication.id, 'Retain actual latest 3.0 update');
  assert.equal(scope.baselineSourceSha, previous.publication.gitCommitHash, 'Retain actual latest 3.0 source');
  const read = entry => {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    assert.equal(sha(bytes), entry.sha256, 'Apple retirement baseline proof changed');
    return JSON.parse(bytes);
  };
  const gate = read(previous.publishedProof.gateC), audit = read(previous.publishedProof.assetAudit);
  const exported = read(previous.publishedProof.exportSource), baseline = read(scope.baselineFiles);
  assert.equal(gate.pass, true); assert.deepEqual(gate.missing, []);
  assert.equal(gate.published.id, scope.baselineUpdateId); assert.equal(gate.published.gitCommitHash, scope.baselineSourceSha);
  assert.equal(audit.pass, true); assert.equal(audit.missingOrCorrupt, 0);
  assert.equal(audit.updateId, gate.published.id);
  assert.equal(exported.candidateSha, scope.baselineSourceSha);
  assert.equal(exported.bundle.sha256, gate.published.servedBundleSha256);
  assert.equal(exported.bundle.sha256, previous.publication.servedBundleSha256);
  assert.ok(audit.assets.length > 0); assert.equal(audit.verified, audit.assets.length);
  assert.deepEqual([...new Set(audit.assets.map(a => a.hash))].sort(), [...exported.assetHashes].sort());
  const fingerprint = sha(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b))));
  assert.equal(fingerprint, gate.candidateProductFingerprint);
  assert.equal(fingerprint, scope.baselineProductFingerprint); assert.equal(fingerprint, exported.productFingerprint);
  assert.deepEqual(Object.keys(baseline).filter(file => !files[file]), [], 'Apple retirement cannot remove published files or artwork');
  const changes = Object.entries(files).filter(([file, hash]) => baseline[file] !== hash).map(([path, after]) => ({path, after}));
  assert.deepEqual(changes.map(row => row.path).sort(), retirementPaths, 'Apple retirement cannot include unrelated product changes');
  return changes;
}
export function verifyAppleRetirementPublication({root, scope, state}) {
  const remote = JSON.parse(execFileSync('npx', ['eas-cli', 'update:list', '--branch', 'production-3-preparation', '--limit', '2', '--json', '--non-interactive'], {cwd: root, encoding: 'utf8'}));
  assert.equal(remote.name, 'production-3-preparation');
  const latest = remote.currentPage.find(update => update.platforms.includes('ios'));
  assert.equal(latest?.group, state.verifiedProduction3Onboarding.publication.group, 'Active 3.0 changed; reconcile before Apple retirement');
  assert.equal(latest.runtimeVersion, '3.0.0');
  assert.equal(scope.ownerInstruction, retirementInstruction);
}
