import fs from 'node:fs';
import path from 'node:path';

const exportRoot = path.resolve(process.argv[2] ?? 'dist');
const target = process.argv[3] ?? 'ios';
const platforms = target === 'all' ? ['android', 'ios'] : [target];
const requiredRouteMarkers = [
  'RootLayout',
  'AthleteHomeV3',
  'SessionEditingWorkspace',
];
for (const platform of platforms) {
  if (!['android', 'ios'].includes(platform)) {
    throw new Error(`OTA blocked: unsupported route-bundle platform ${platform}.`);
  }
  const bundleRoot = path.join(exportRoot, '_expo', 'static', 'js', platform);
  if (!fs.existsSync(bundleRoot)) {
    throw new Error(`OTA blocked: ${platform} bundle directory is missing: ${bundleRoot}`);
  }
  const bundles = fs.readdirSync(bundleRoot)
    .filter((name) => name.endsWith('.hbc'))
    .map((name) => path.join(bundleRoot, name));
  if (bundles.length !== 1) {
    throw new Error(`OTA blocked: expected one ${platform} Hermes bundle, found ${bundles.length}.`);
  }
  const bundle = fs.readFileSync(bundles[0]);
  const missingMarkers = requiredRouteMarkers.filter((marker) => (
    !bundle.includes(Buffer.from(marker))
  ));
  if (bundle.length < 5_000_000 || missingMarkers.length) {
    throw new Error(
      `OTA blocked: exported ${platform} bundle does not contain the application route tree `
      + `(bytes=${bundle.length}, missing=${missingMarkers.join(', ') || 'none'}).`,
    );
  }
  console.log(
    `OTA route bundle PASS — ${platform}/${path.basename(bundles[0])}, `
    + `${bundle.length} bytes, canonical routes present.`,
  );
}
