import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertProductionPlatformParity,
  assertProductionOtaCompatible,
  assertPublicationScope,
  calculateNativeDependencyFingerprint,
  readProductionBaseline,
} from './production-release-policy.mjs';

const baseline = readProductionBaseline();
assert.deepEqual(Object.keys(baseline.platforms).sort(), ['android', 'ios']);
assert.equal(baseline.runtimeVersion, '2.0.2');
assert.equal(baseline.channel, 'production');
assert.equal(baseline.branch, 'production-live-2.0.2');
assert.equal(baseline.nativeBuildAuthorization, 'NOT_GRANTED');
assert.equal(baseline.storeSubmissionAuthorization, 'NOT_GRANTED');

assert.deepEqual(assertPublicationScope(), ['android', 'ios']);
assert.deepEqual(assertPublicationScope({}), ['android', 'ios']);
assert.equal(
  calculateNativeDependencyFingerprint('android'),
  baseline.platforms.android.nativeDependencyFingerprint,
  'Android candidate must retain the live build 12 native dependency projection.',
);
assert.equal(
  calculateNativeDependencyFingerprint('ios'),
  baseline.platforms.ios.nativeDependencyFingerprint,
  'iOS candidate must retain the live build 24 native dependency projection.',
);

assert.deepEqual(
  assertPublicationScope({ target: 'all', scope: 'shared' }),
  ['android', 'ios'],
);
assert.throws(
  () => assertPublicationScope({ target: 'ios', scope: 'shared' }),
  /shared releases must explicitly publish Android \+ iOS/,
);
assert.throws(
  () => assertPublicationScope({ target: 'android', scope: 'platform-specific' }),
  /substantive --reason/,
);
assert.deepEqual(
  assertPublicationScope({
    target: 'android',
    scope: 'platform-specific',
    reason: 'Recover Android after the Production channel branch remap.',
  }),
  ['android'],
);
assert.deepEqual(
  assertPublicationScope({
    target: 'ios',
    scope: 'platform-specific',
    reason: 'Correct an iOS-only operating-system integration defect.',
  }),
  ['ios'],
);

const parityStates = Object.fromEntries(['android', 'ios'].map((platform) => {
  const live = baseline.platforms[platform];
  return [platform, {
    platform,
    channel: baseline.channel,
    status: 200,
    embeddedFallback: false,
    branch: baseline.branch,
    runtimeVersion: baseline.runtimeVersion,
    group: live.activeUpdateGroup,
    updateId: live.activeUpdateId,
    sourceCommit: live.activeUpdateSourceCommit,
    launchAssetKey: live.activeLaunchAssetKey,
    launchAssetSha256: live.activeLaunchAssetSha256,
    launchAssetBytes: live.activeLaunchAssetBytes,
  }];
}));
assert.equal(
  assertProductionPlatformParity({ baseline, states: parityStates }),
  'PRODUCTION 2.0.2 PLATFORM PARITY: PASS',
);
assert.throws(
  () => assertProductionPlatformParity({ baseline, states: { ios: parityStates.ios } }),
  /android: Production manifest is missing/,
);
assert.throws(
  () => assertProductionPlatformParity({ baseline, states: { android: parityStates.android } }),
  /ios: Production manifest is missing/,
);
assert.throws(
  () => assertProductionPlatformParity({
    baseline,
    states: { ...parityStates, android: { ...parityStates.android, status: 204, embeddedFallback: true } },
  }),
  /HTTP 204 \/ embedded fallback is forbidden/,
);
assert.throws(
  () => assertProductionPlatformParity({
    baseline,
    states: { ...parityStates, android: { ...parityStates.android, runtimeVersion: '2.0.3' } },
  }),
  /android runtime/,
);
assert.throws(
  () => assertProductionPlatformParity({
    baseline,
    states: { ...parityStates, ios: { ...parityStates.ios, channel: 'testflight' } },
  }),
  /ios channel/,
);
assert.throws(
  () => assertProductionPlatformParity({
    baseline,
    states: { ...parityStates, android: { ...parityStates.android, branch: 'wrong-branch' } },
  }),
  /android branch/,
);

const android = baseline.platforms.android;
assert.doesNotThrow(() => assertProductionOtaCompatible({
  platform: 'android',
  applicationIdentifier: android.applicationIdentifier,
  appVersion: android.storeVersion,
  runtimeVersion: baseline.runtimeVersion,
  nativeDependencyFingerprint: android.nativeDependencyFingerprint,
  channel: baseline.channel,
  branch: baseline.branch,
}, baseline));
assert.throws(
  () => assertProductionOtaCompatible({
    platform: 'android',
    applicationIdentifier: android.applicationIdentifier,
    appVersion: android.storeVersion,
    runtimeVersion: '2.0.3',
    nativeDependencyFingerprint: android.nativeDependencyFingerprint,
    channel: baseline.channel,
    branch: baseline.branch,
  }, baseline),
  /PRODUCTION MOBILE BLOCKED — native build required\. Native build not authorized\./,
);

const legacyPublisher = readFileSync(
  new URL('./publish-production-2.0.2-validated-ios-ota.mjs', import.meta.url),
  'utf8',
);
assert.match(legacyPublisher, /Legacy iOS-only Production publisher disabled/);
const wrapper = readFileSync(new URL('./eas-update-production.sh', import.meta.url), 'utf8');
assert.match(wrapper, /publish-validated-production-ota\.mjs "\$@"/);
const publisher = readFileSync(new URL('./publish-validated-production-ota.mjs', import.meta.url), 'utf8');
assert.match(publisher, /valueFor\('--platform'\) \?\? 'all'/);
assert.match(publisher, /valueFor\('--release-scope'\) \?\? 'shared'/);
assert.match(publisher, /verify-production-channel-parity\.mjs/);
assert.match(publisher, /assertProductionPlatformParity/);
const parityVerifier = readFileSync(new URL('./verify-production-channel-parity.mjs', import.meta.url), 'utf8');
assert.match(parityVerifier, /response\.status === 204/);
assert.match(parityVerifier, /channel:view/);
assert.match(parityVerifier, /assertProductionPlatformParity/);

console.log('production platform-aware release policy: PASS');
