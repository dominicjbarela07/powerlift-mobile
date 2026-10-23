import assert from 'node:assert/strict';

/** A bounded JS correction for the existing owner-built 3.0 binary. */
export function assertProduction3ClientFix({branch, scope, baseline, proof, packageLockSha256}) {
  assert.equal(branch, 'production-3-preparation', '3.0 fixes cannot publish or remap legacy Production');
  assert.ok(['onboarding-reliability-20261023','video-engine-20261022','approved-artwork-portability-20261021','session-copy-backdown-20261018','weekly-training-report-20261017','canonical-copied-week-identity-20261013','athlete-video-archive-access-20261014','set-entry-video-preview-20261014','canonical-logger-floating-unit-20261014','canonical-fixed-equipment-eligibility-20261014','mobile-navigation-loading-20261016'].includes(scope?.scope), '3.0 publication requires an exact reviewed owner scope');
  assert.equal(proof?.id, '22c6739e-8857-4478-a5d8-a2a21523ddb2');
  assert.equal(proof.status, 'FINISHED'); assert.equal(proof.platform, 'IOS');
  assert.equal(proof.appVersion, '3.0.0'); assert.equal(proof.runtimeVersion, '3.0.0');
  assert.equal(proof.channel, branch); assert.equal(proof.appBuildVersion, '35');
  assert.equal(proof.sdkVersion, '54.0.0');
  assert.equal(proof.gitCommitHash, '93cbf4ed9e223c7dae1588995ebb64bfbc46ffd9');
  assert.equal(packageLockSha256, proof.packageLockSha256, '3.0 native dependencies changed since the actual build source');
  assert.equal(baseline.sourcePackageLockSha256, proof.packageLockSha256);
  assert.deepEqual(baseline.plugins, proof.nativePlugins.map(plugin => Array.isArray(plugin) ? plugin[0] : plugin));
  assert.equal(baseline.newArchEnabled, proof.newArchEnabled);
  assert.equal(baseline.easBuildId, proof.id); assert.equal(baseline.iosBuild, '35');
  assert.equal(baseline.sourceSha, proof.gitCommitHash);
}
