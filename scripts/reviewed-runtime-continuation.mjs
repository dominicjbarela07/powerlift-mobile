import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertRuntimeEvidence, productFiles, fingerprintFiles, sha256 } from './testflight-cumulative-integrity.mjs';
import { assertProgressionEvidence } from './reviewed-release-progression.mjs';
import { assertEducationTransport } from './education-image-transport.mjs';

// Reuse actual observed journeys only for this exact reviewed cumulative update.
// Never relabel retained observations as a fresh simulator run or native certification.
export function assertReviewedRuntimeContinuation(root, state, fingerprint) {
  const scope = state.reviewedRuntimeContinuation;
  assert.ok(scope, 'exact reviewed runtime continuation scope is required');
  assertProgressionEvidence(root, scope);
  const ownerText = fs.readFileSync(path.join(root, scope.ownerEvidencePath), 'utf8');
  assert.ok(ownerText.includes('you dont need to recheck screens that you determined were fine btw'), 'retained observations require the explicit owner repeat-check instruction');
  assert.equal(fingerprint, scope.productFingerprint, 'runtime continuation cannot cover another product candidate');
  assert.equal(scope.priorUpdateId, state.currentTestFlight.id, 'continuation must retain the actual current shipped baseline');
  const priorPath = path.resolve(root, scope.priorReceipt.path);
  assert.equal(sha256(fs.readFileSync(priorPath)), scope.priorReceipt.sha256, 'prior runtime receipt changed');
  const prior = JSON.parse(fs.readFileSync(priorPath));
  assertRuntimeEvidence(prior, scope.priorProductFingerprint, state.requiredRuntimeFlows, path.dirname(priorPath));
  const nativePath = path.resolve(root, scope.nativeReceipt.path);
  assert.equal(sha256(fs.readFileSync(nativePath)), scope.nativeReceipt.sha256, 'actual native preview receipt changed');
  const native = JSON.parse(fs.readFileSync(nativePath));
  assert.equal(native.sourceSHA, scope.nativeSourceSha);
  assert.equal(native.apiBase, 'https://app.strengthledger.fit');
  assert.equal(native.liveBackendSource, scope.liveBackendSource);
  assert.equal(native.nativeExpoSecureStoreProof.pass, true);
  assert.equal(native.temporaryProbeRemoved, true);
  assert.equal(native.missingExportAssets, 0);
  assert.equal(native.productionNativeBinaryCertified, false, 'preview is not a certified new store binary');
  assert.ok(Date.parse(scope.nativeObservedAt) <= Date.now() + 60_000 && Date.now() - Date.parse(scope.nativeObservedAt) < 48 * 3600_000, 'equivalent native preview proof is stale');
  const live = JSON.parse(execFileSync('/usr/bin/curl', ['--fail', '--silent', '--show-error', '--max-time', '20', 'https://app.strengthledger.fit/health/recognition'], { encoding: 'utf8' }));
  assert.equal(live.source_sha, scope.liveBackendSource, 'serving backend changed since equivalent native preview');
  assert.equal(live.ready, true);
  const previewRoot = '/Users/dominic/powerlifting_app/powerlift_mobile';
  const changed = execFileSync('git', ['diff', '--name-only', scope.nativeSourceSha, 'HEAD', '--', 'app', 'components', 'lib', 'hooks', 'context', 'contexts', 'constants', 'config', 'assets', 'artwork-review/runtime-policy.json', 'theme.ts'], { cwd: previewRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const runtimeChanges = changed.filter(file => !file.startsWith('app/(tabs)/dev-mocks/') && !file.startsWith('config/testflight-release-') && file !== 'config/protected-fix-manifest.json');
  const transport = assertEducationTransport(previewRoot, { sourceCommit: scope.nativeSourceSha });
  assert.deepEqual(runtimeChanges.slice().sort(), transport.files.slice().sort(), 'actual native preview changed beyond strictly byte-equivalent image transport; fresh observations are required');
  const current = productFiles(root), observed = productFiles(previewRoot);
  for (const file of Object.keys(current)) {
    if (file === 'config/protected-fix-manifest.json') continue;
    assert.equal(current[file], observed[file], `unobserved runtime difference: ${file}`);
  }
  // This sole changed JSON file is release enforcement, never application input.
  for (const file of Object.keys(current).filter(file => /^(app|components|lib|hooks|context|contexts)\/.*\.(tsx?|js)$/.test(file))) {
    assert.ok(!fs.readFileSync(path.join(root, file), 'utf8').includes('protected-fix-manifest'), 'release metadata became runtime input');
  }
  assert.equal(fingerprintFiles(current), fingerprint);
  return { mode: 'OWNER_AUTHORIZED_RETAINED_OBSERVATIONS', priorFlows: prior.flows.length, priorObservedAt: prior.completedAt, actualEquivalentNativeSource: native.sourceSHA, losslessImageTransport: transport, liveBackendSource: native.liveBackendSource, freshFullJourneyRun: false, newProductionNativeBinaryCertified: false };
}
