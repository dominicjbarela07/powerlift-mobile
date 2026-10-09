const { expo } = require('./app.json');

// Local candidate preparation is separate from legacy Production OTA. This
// creates a new native runtime; it does not remap channels or grant shipment.
if (process.env.STRENGTH_LEDGER_RELEASE_TARGET === 'production3') {
  if (process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL !== 'production3'
      || process.env.EXPO_PUBLIC_ART_RUNTIME_VERSION !== '3.0.0') {
    throw new Error('PRODUCTION 3.0 PREPARATION BLOCKED: explicit approved-art channel and runtime 3.0.0 are required.');
  }
  expo.version = '3.0.0';
  expo.runtimeVersion = '3.0.0';
  expo.extra = { ...expo.extra, releaseTrack: 'production3', publicationAuthorized: false };
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

module.exports = { expo };
