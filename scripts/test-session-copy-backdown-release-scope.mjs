import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertSessionCopyBackdownBaseline, sessionCopyBackdownPath } from './session-copy-backdown-release-scope.mjs';
import { assertClientFixScope } from './owner-directed-client-fix.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-session-copy-scope-'));
try {
  const write = (file, data) => { const bytes = JSON.stringify(data); fs.writeFileSync(path.join(root, file), bytes); return { path: file, sha256: hash(bytes) }; };
  const baseline = { [sessionCopyBackdownPath]: 'original', 'assets/approved.png': 'approved' };
  const publication = { id: 'real-update', gitCommitHash: 'published-source' };
  const fingerprint = hash(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b))));
  const state = { verifiedProduction3WeeklyTrainingReport: { publication, publishedProof: {
    gateC: write('gate.json', { pass: true, missing: [], candidateProductFingerprint: fingerprint, published: { ...publication, servedBundleSha256: 'published-bytes' } }),
    assetAudit: write('audit.json', { pass: true, missingOrCorrupt: 0, updateId: publication.id, servedLaunchSha256: 'published-bytes' }),
  } } };
  const scope = { scope: 'session-copy-backdown-20261018', baselineUpdateId: publication.id,
    baselineSourceSha: publication.gitCommitHash, baselineProductFingerprint: fingerprint, baselineFiles: write('baseline.json', baseline),
    productFingerprint: 'fixed', validation: 'OWNER_DIRECTED_CONTRACTS_ONLY', ownerInstruction: 'Please fix it, validate it, and push the hotfix.',
    changedProductFiles: { [sessionCopyBackdownPath]: 'fixed' }, contracts: {
      'scripts/test-session-copy-backdown-api.mjs': 'api', 'scripts/test-session-copy-backdown-release-scope.mjs': 'scope', 'scripts/test-session-workspace-top-backdown-copy.mjs': 'model',
    } };
  const files = { ...baseline, [sessionCopyBackdownPath]: 'fixed' };
  const check = (candidate = files, candidateScope = scope) => assertSessionCopyBackdownBaseline({ root, scope: candidateScope, state, files: candidate });
  const changes = check();
  assertClientFixScope(scope, 'fixed', changes, 'mobile session builder 1x1 + 3x5 produces an extra straight set. ' + scope.ownerInstruction);
  assert.throws(() => check({ ...files, 'lib/unrelated.ts': 'extra' }), /unrelated/);
  const missing = { ...files }; delete missing['assets/approved.png'];
  assert.throws(() => check(missing), /remove published/);
  assert.throws(() => check({ ...files, 'assets/approved.png': 'replacement' }), /unrelated/);
  assert.throws(() => check(files, { ...scope, baselineUpdateId: 'invented' }), /actual published/);
  assert.throws(() => check(files, { ...scope, baselineSourceSha: 'invented' }), /exact published/);
  assert.throws(() => check(files, { ...scope, baselineFiles: write('fake.json', files) }));
  assert.throws(() => assertClientFixScope(scope, 'other-source', changes, scope.ownerInstruction), /changed product source/);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log('PASS: Session copy hotfix retains exact verified 3.0 baseline; missing artwork, replacement assets, hidden source, fabricated baseline and unrelated changes deliberately rejected.');
