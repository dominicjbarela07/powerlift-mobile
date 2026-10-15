import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fingerprintBackend, fingerprintFiles, productFiles, sha256 } from './testflight-cumulative-integrity.mjs';

export function sharedValidationInputs(root, backendRoot) {
  const checks = {};
  for (const file of fs.readdirSync(path.join(root, 'scripts')).sort()) {
    const full = path.join(root, 'scripts', file);
    if (fs.statSync(full).isFile()) checks[`scripts/${file}`] = sha256(fs.readFileSync(full));
  }
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'app.json', 'eas.json', 'config/testflight-release-integrity.json']) checks[file] = sha256(fs.readFileSync(path.join(root, file)));
  return {
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    productFingerprint: fingerprintFiles(productFiles(root)),
    checksFingerprint: fingerprintFiles(checks),
    backendFingerprint: fingerprintBackend(backendRoot),
    nodeVersion: process.version,
    contractEnvironment: 'testflight-art; live-api; frozen-catalog; no runtime override',
  };
}

export function assertSharedValidation(receipt, inputs) {
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.pass, true);
  assert.deepEqual(receipt.checks, ['accepted-contracts', 'critical-invariants', 'typescript']);
  assert.deepEqual(receipt.inputs, inputs, 'Shared OTA validation inputs changed; reuse is forbidden');
  const age = Date.now() - Date.parse(receipt.completedAt);
  assert.ok(Number.isFinite(age) && age >= -60000 && age < 24 * 3600000, 'Shared OTA validation receipt is stale');
}

export function assertReusableAssetAudit(audit, assets) {
  assert.equal(audit.pass, true);
  assert.equal(audit.missingOrCorrupt, 0);
  assert.ok(audit.updateId && audit.assets?.length > 0);
  assert.equal(audit.verified, audit.assets.length, 'Asset proof is incomplete');
  const verified = new Map(audit.assets.map(asset => [asset.hash, asset]));
  assert.deepEqual([...new Set(assets.map(asset => asset.hash))].sort(), [...verified.keys()].sort(), 'Content-addressed asset inventory changed; proof reuse is forbidden');
  return assets.map(asset => {
    const prior = verified.get(asset.hash);
    assert.ok(Number.isInteger(prior.bytes) && prior.bytes > 0, 'Missing verified asset bytes');
    return { key: asset.key, hash: asset.hash, bytes: prior.bytes };
  });
}
