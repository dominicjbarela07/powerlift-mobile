import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Exact source-bound owner validation; never represents visual/device proof.
export function assertClientFixScope(scope, fingerprint, modifications, ownerText) {
  assert.equal(scope?.scope, 'canonical-zero-load-edit-20261005');
  assert.equal(scope.productFingerprint, fingerprint, 'client-fix validation cannot cover changed product source');
  assert.equal(scope.validation, 'OWNER_DIRECTED_CONTRACTS_ONLY');
  assert.ok(ownerText.includes(scope.ownerInstruction), 'exact current owner task is required');
  assert.ok(ownerText.includes('You will not do simulator runs. Stop talking about it'), 'validation restriction requires the exact owner instruction');
  assert.deepEqual(modifications.map(row => row.path).sort(), Object.keys(scope.changedProductFiles).sort(), 'client-fix scope cannot include unrelated changes');
  for (const row of modifications) assert.equal(row.after, scope.changedProductFiles[row.path], 'client-fix source changed');
  assert.deepEqual(Object.keys(scope.contracts).sort(), ['scripts/test-zero-load-edit-api.mjs', 'scripts/test-zero-load-edit-set.mjs']);
}
export function runClientFixContracts({root, scope, fingerprint, delta, exportDir}) {
  assert.ok(exportDir, 'client fix requires an actual bound export');
  assert.deepEqual(delta.subtractions, [], 'client fix cannot remove existing product files');
  const evidence = fs.readFileSync(path.join(root, scope.ownerEvidencePath));
  assert.equal(sha(evidence), scope.ownerEvidenceSha256);
  assertClientFixScope(scope, fingerprint, delta.modifications, evidence.toString());
  const results = [];
  for (const [file, expected] of Object.entries(scope.contracts)) {
    assert.equal(sha(fs.readFileSync(path.join(root, file))), expected, 'client fix contract changed');
    const output = execFileSync(process.execPath, ['--import', 'tsx', file], {cwd: root, env: process.env, encoding: 'utf8', timeout: 30000});
    assert.match(output, /PASS/);
    results.push({file, sourceSha256: expected, result: 'PASS', output});
  }
  const receipt = {scope: scope.scope, productFingerprint: fingerprint, completedAt: new Date().toISOString(),
    validation: scope.validation, runtimeVerified: false, contracts: results};
  fs.writeFileSync(path.join(exportDir, 'release-client-fix-contracts.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
