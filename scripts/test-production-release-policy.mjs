import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertProductionPlatformParity,
  assertPublicationScope,
  readProductionBaseline,
} from './production-release-policy.mjs';

const baseline = readProductionBaseline();
assert.deepEqual(Object.keys(baseline.platforms).sort(), ['android', 'ios']);
assert.equal(baseline.runtimeVersion, '2.0.2');
assert.deepEqual(assertPublicationScope(), ['android', 'ios']);
assert.throws(
  () => assertPublicationScope({ target: 'ios', scope: 'shared' }),
  /shared releases must explicitly publish Android \+ iOS/,
);
assert.deepEqual(
  assertPublicationScope({
    target: 'ios',
    scope: 'platform-specific',
    reason: 'Correct an iOS-only operating-system integration defect.',
  }),
  ['ios'],
);
assert.deepEqual(
  assertPublicationScope({
    target: 'android',
    scope: 'platform-specific',
    reason: 'Correct an Android-only rendering integration defect.',
  }),
  ['android'],
);

const states = Object.fromEntries(['android', 'ios'].map((platform) => {
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
  assertProductionPlatformParity({ baseline, states }),
  'PRODUCTION 2.0.2 PLATFORM PARITY: PASS',
);
assert.throws(
  () => assertProductionPlatformParity({ baseline, states: { ios: states.ios } }),
  /android: Production manifest is missing/,
);
assert.throws(
  () => assertProductionPlatformParity({ baseline, states: { android: states.android } }),
  /ios: Production manifest is missing/,
);
assert.throws(
  () => assertProductionPlatformParity({
    baseline,
    states: { ...states, android: { ...states.android, status: 204, embeddedFallback: true } },
  }),
  /HTTP 204 \/ embedded fallback is forbidden/,
);
assert.throws(
  () => assertProductionPlatformParity({
    baseline,
    states: { ...states, android: { ...states.android, runtimeVersion: '2.0.3' } },
  }),
  /android runtime/,
);
assert.throws(
  () => assertProductionPlatformParity({
    baseline,
    states: { ...states, ios: { ...states.ios, channel: 'wrong-channel' } },
  }),
  /ios channel/,
);

const retiredPublisher = readFileSync(
  new URL('./publish-production-2.0.2-validated-ios-ota.mjs', import.meta.url),
  'utf8',
);
assert.match(retiredPublisher, /Legacy iOS-only Production publisher disabled/);
const retiredWrapper = readFileSync(new URL('./eas-update-production.sh', import.meta.url), 'utf8');
assert.match(retiredWrapper, /historical main checkout is retired/);
assert.doesNotMatch(retiredWrapper, /eas(-cli)? update/);

console.log('historical Production main release paths retired: PASS');
