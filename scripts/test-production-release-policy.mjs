import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
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
assert.equal(
  calculateNativeDependencyFingerprint('android'),
  baseline.platforms.android.nativeDependencyFingerprint,
  'Android candidate must retain the live build 12 native dependency projection.',
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

console.log('production platform-aware release policy: PASS');
