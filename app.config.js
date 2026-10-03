const { expo } = require('./app.json');

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
