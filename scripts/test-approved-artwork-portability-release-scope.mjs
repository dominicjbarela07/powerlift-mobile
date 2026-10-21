import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertPortableArtworkBaseline, portableArtworkPaths } from './approved-artwork-portability-release-scope.mjs';
import { assertClientFixScope } from './owner-directed-client-fix.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-portable-art-scope-'));
try {
  const write = (file, data) => { const bytes = JSON.stringify(data); fs.writeFileSync(path.join(root, file), bytes); return { path: file, sha256: hash(bytes) }; };
  const baseline = { ...Object.fromEntries(portableArtworkPaths.map(path => [path, 'original'])), 'assets/approved.png': 'approved' };
  const publication = { id: 'real-update', gitCommitHash: 'published-source' };
  const fingerprint = hash(JSON.stringify(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b))));
  const state = { verifiedProduction3SessionCopyBackdown: { publication, publishedProof: {
    gateC: write('gate.json', { pass: true, missing: [], candidateProductFingerprint: fingerprint, published: { ...publication, servedBundleSha256: 'published-bytes' } }),
    assetAudit: write('audit.json', { pass: true, missingOrCorrupt: 0, updateId: publication.id, servedLaunchSha256: 'published-bytes' }),
  } } };
  const scope = { scope: 'approved-artwork-portability-20261021', baselineUpdateId: publication.id,
    baselineSourceSha: publication.gitCommitHash, baselineProductFingerprint: fingerprint, baselineFiles: write('baseline.json', baseline),
    productFingerprint: 'fixed', validation: 'OWNER_DIRECTED_CONTRACTS_ONLY', ownerInstruction: 'Find what the fuck is going on, fix it, and deploy the fix.',
    changedProductFiles: Object.fromEntries(portableArtworkPaths.map(path => [path, 'fixed'])), contracts: {
      'scripts/test-approved-artwork-portability-release-scope.mjs': 'scope', 'scripts/test-approved-artwork-portability.mjs': 'art', 'scripts/test-private-movement-identity-contract.mjs': 'private', 'scripts/test-shared-movement-programming-context.mjs': 'shared', 'scripts/test-single-current-movement-id.mjs': 'current',
    } };
  const files = { ...baseline, ...scope.changedProductFiles };
  const check = (candidate = files, candidateScope = scope) => assertPortableArtworkBaseline({ root, scope: candidateScope, state, files: candidate });
  const changes = check();
  assertClientFixScope(scope, 'fixed', changes, 'Missing image asset for RDL is unacceptable. ' + scope.ownerInstruction);
  assert.throws(() => check({ ...files, 'lib/unrelated.ts': 'extra' }), /unrelated/);
  const missing = { ...files }; delete missing['assets/approved.png'];
  assert.throws(() => check(missing), /remove published/);
  assert.throws(() => check({ ...files, 'assets/approved.png': 'replacement' }), /unrelated/);
  assert.throws(() => check(files, { ...scope, baselineUpdateId: 'invented' }), /actual latest/);
  assert.throws(() => check(files, { ...scope, baselineSourceSha: 'invented' }), /actual latest/);
  assert.throws(() => check(files, { ...scope, baselineFiles: write('fake.json', files) }));
  assert.throws(() => assertClientFixScope(scope, 'other-source', changes, scope.ownerInstruction), /changed product source/);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log('PASS: Approved artwork restoration retains exact verified 3.0 baseline; missing artwork, replacement assets, hidden source, fabricated baseline and unrelated changes deliberately rejected.');
