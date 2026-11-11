const expo = { ...require('./app.json').expo };

// Local candidate preparation is separate from legacy Production OTA. This
// creates a new native runtime; it does not remap channels or grant shipment.
if (process.env.STRENGTH_LEDGER_RELEASE_TARGET === 'testflight31') {
  if (process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL !== 'testflight'
      || process.env.EXPO_PUBLIC_ART_RUNTIME_VERSION !== '3.1.0'
      || process.env.EXPO_PUBLIC_API_BASE !== 'https://app.strengthledger.fit') {
    throw new Error('TESTFLIGHT 3.1 PREPARATION BLOCKED: approved TestFlight artwork, runtime 3.1.0 and the live API are required.');
  }
  expo.version = '3.1.0';
  expo.runtimeVersion = '3.1.0';
  expo.extra = { ...expo.extra, releaseTrack: 'testflight', preparationTarget: 'testflight31', publicationAuthorized: false };
  require('./scripts/native-build-upload-policy.cjs').assertNativeBuildUploadPolicy(__dirname);
} else if (process.env.EXPO_PUBLIC_ART_RUNTIME_VERSION === '3.1.0') {
  throw new Error('TESTFLIGHT 3.1 PREPARATION BLOCKED: runtime 3.1.0 requires the explicit testflight31 target.');
} else if (process.env.STRENGTH_LEDGER_RELEASE_TARGET === 'production3') {
  if (process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL !== 'production3'
      || process.env.EXPO_PUBLIC_ART_RUNTIME_VERSION !== '3.0.0') {
    throw new Error('PRODUCTION 3.0 PREPARATION BLOCKED: explicit approved-art channel and runtime 3.0.0 are required.');
  }
  expo.version = '3.0.0';
  expo.runtimeVersion = '3.0.0';
  expo.extra = { ...expo.extra, releaseTrack: 'production3', publicationAuthorized: false };
  // Android 3.0 uses the owner-provided Firebase app; Expo's native plugins
  // copy its public config and apply Google Services during Android prebuild.
  expo.android = { ...expo.android, googleServicesFile: './config/android/google-services.json' };
  // Direct owner-started EAS builds must reject oversized/unsafe upload inputs.
  require('./scripts/native-build-upload-policy.cjs').assertNativeBuildUploadPolicy(__dirname);
} else if (process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'production3'
    || process.env.EXPO_PUBLIC_ART_RUNTIME_VERSION === '3.0.0') {
  throw new Error('PRODUCTION 3.0 PREPARATION BLOCKED: a 3.0 artwork switch cannot be applied to a legacy runtime.');
}

// This is evaluated by Expo/EAS before bundling, including direct EAS commands.
// The Oct 2 OTA silently excluded 492 assets when this switch was omitted.
// Fail here instead of allowing a successfully published empty artwork registry.
if (expo.extra?.releaseTrack === 'testflight'
    && process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL !== 'testflight') {
  throw new Error(
    'TESTFLIGHT RELEASE BLOCKED: EXPO_PUBLIC_APPROVED_ART_CHANNEL must be testflight. '
    + 'Use the governed TestFlight publisher. Publishing with approved artwork disabled '
    + 'is an unauthorized product subtraction.',
  );
}

function resolveAppConfig({ config }) {
  return { ...config, ...expo };
}

// Retain the direct configuration reader used by the guarded native wrapper.
resolveAppConfig.expo = expo;
module.exports = resolveAppConfig;
