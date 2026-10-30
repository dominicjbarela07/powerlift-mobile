import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertReliabilityBaseline, reliabilityPaths, reliabilityInstruction } from './mobile-reliability-release-scope.mjs';
import { assertClientFixScope } from './owner-directed-client-fix.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-reliability-scope-'));
try {
  const write = (file, data) => { const bytes = JSON.stringify(data); fs.writeFileSync(path.join(root, file), bytes); return { path: file, sha256: sha(bytes) }; };
  const baseline = { ...Object.fromEntries(reliabilityPaths.filter(p => p !== 'lib/set-edit-recovery.ts').map(p => [p, 'old'])), 'assets/approved.png': 'art', 'context/AuthContext.tsx': 'auth' };
  const fingerprint = sha(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b))));
  const publication = { id: 'actual-update', gitCommitHash: 'actual-source', servedBundleSha256: 'bundle' };
  const state = { verifiedProduction3AppleSignInRetirement: { publication, publishedProof: {
    gateC: write('gate.json', { pass: true, missing: [], candidateProductFingerprint: fingerprint, published: publication }),
    assetAudit: write('audit.json', { pass: true, missingOrCorrupt: 0, updateId: publication.id, verified: 1, assets: [{ hash: 'asset' }] }),
    exportSource: write('export.json', { candidateSha: publication.gitCommitHash, productFingerprint: fingerprint, bundle: { sha256: 'bundle' }, assetHashes: ['asset'] }),
  } } };
  const contracts = ['test-mobile-reliability-release-scope.mjs', 'test-today-loading-lifecycle.mjs', 'test-set-edit-recovery.mjs', 'test-set-edit-api.mjs', 'test-zero-load-edit-set.mjs', 'test-zero-load-edit-api.mjs'];
  const scope = { scope: 'mobile-reliability-20261030', baselineUpdateId: publication.id, baselineSourceSha: publication.gitCommitHash,
    baselineProductFingerprint: fingerprint, baselineFiles: write('baseline.json', baseline), productFingerprint: 'candidate', validation: 'OWNER_DIRECTED_CONTRACTS_ONLY',
    ownerInstruction: reliabilityInstruction, changedProductFiles: Object.fromEntries(reliabilityPaths.map(p => [p, 'new'])), contracts: Object.fromEntries(contracts.map(p => ['scripts/' + p, 'hash'])) };
  const files = { ...baseline, ...scope.changedProductFiles };
  const check = (candidate = files, s = scope) => assertReliabilityBaseline({ root, scope: s, state, files: candidate });
  const changes = check(), owner = 'Today is unavailable. Active Session edit: 15 seconds then Retry. ' + reliabilityInstruction;
  assertClientFixScope(scope, 'candidate', changes, owner);
  for (const bad of [{ ...files, 'context/AuthContext.tsx': 'bypass' }, { ...files, 'assets/approved.png': 'changed' }, { ...files, 'lib/hidden.ts': 'added' }]) assert.throws(() => check(bad), /unrelated/);
  const lost = { ...files }; delete lost['assets/approved.png']; assert.throws(() => check(lost), /remove published/);
  assert.throws(() => check(files, { ...scope, baselineUpdateId: 'invented' }), /actual current/);
  assert.throws(() => check(files, { ...scope, baselineSourceSha: 'invented' }), /actual current/);
  assert.throws(() => assertClientFixScope(scope, 'changed', changes, owner));
  assert.throws(() => assertClientFixScope(scope, 'candidate', changes, reliabilityInstruction));
  assert.throws(() => assertClientFixScope({ ...scope, contracts: {} }, 'candidate', changes, owner));
  assert.throws(() => assertClientFixScope({ ...scope, ownerInstruction: 'ship something' }, 'candidate', changes, 'ship something'));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log('PASS exact Today/Set edit release: current complete 3.0 source/assets retained; only the two repairs and their guard metadata allowed; stale baselines, hidden changes, missing art, wrong owner scope and missing contracts rejected.');
