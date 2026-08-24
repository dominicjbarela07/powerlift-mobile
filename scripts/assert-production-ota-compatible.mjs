import fs from 'node:fs';
import path from 'node:path';
import {
  assertProductionOtaCompatible,
  calculateIosNativeDependencyFingerprint,
  readProductionBaseline,
  runtimeFromExpoConfig,
} from './production-release-policy.mjs';

const root = process.cwd();
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const baseline = readProductionBaseline(root);

assertProductionOtaCompatible({
  platform: 'ios',
  bundleIdentifier: app.ios?.bundleIdentifier,
  appVersion: app.version,
  buildNumber: baseline.appStoreBuildNumber,
  runtimeVersion: runtimeFromExpoConfig(app),
  nativeDependencyFingerprint: calculateIosNativeDependencyFingerprint(root),
  channel: baseline.channel,
  branch: baseline.branch,
}, baseline);

console.log(
  `Production OTA compatibility PASS — ${baseline.appStoreVersion} `
  + `(${baseline.appStoreBuildNumber}), runtime ${baseline.runtimeVersion}, `
  + `native dependency fingerprint ${baseline.nativeDependencyFingerprint}.`,
);
