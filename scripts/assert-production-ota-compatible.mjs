import fs from 'node:fs';
import path from 'node:path';
import {
  assertProductionOtaCompatible,
  calculateNativeDependencyFingerprint,
  readProductionBaseline,
  requestedPlatforms,
  runtimeFromExpoConfig,
} from './production-release-policy.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = valueFor('--platform') || 'all';
const platforms = requestedPlatforms(target);
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const baseline = readProductionBaseline(root);

for (const platform of platforms) {
  assertProductionOtaCompatible({
    platform,
    applicationIdentifier: platform === 'ios'
      ? app.ios?.bundleIdentifier
      : app.android?.package,
    appVersion: app.version,
    runtimeVersion: runtimeFromExpoConfig(app),
    nativeDependencyFingerprint: calculateNativeDependencyFingerprint(platform, root),
    channel: baseline.channel,
    branch: baseline.branch,
  }, baseline);
  console.log(
    `Production ${platform} OTA compatibility PASS — ${app.version}, runtime `
    + `${baseline.runtimeVersion}, native projection `
    + `${baseline.platforms[platform].nativeDependencyFingerprint}.`,
  );
}
