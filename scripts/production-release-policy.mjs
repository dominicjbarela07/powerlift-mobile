import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function readProductionBaseline(root = process.cwd()) {
  return JSON.parse(fs.readFileSync(
    path.join(root, 'config', 'production-mobile-baseline.json'),
    'utf8',
  ));
}

export function runtimeFromExpoConfig(expo) {
  if (typeof expo.runtimeVersion === 'string') return expo.runtimeVersion;
  if (expo.runtimeVersion?.policy === 'appVersion') return expo.version;
  throw new Error('Production OTA blocked: runtimeVersion is not explicit or appVersion-owned.');
}

export function calculateIosNativeDependencyFingerprint(root = process.cwd()) {
  const nodeModules = path.join(root, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    throw new Error('Production OTA blocked: node_modules is missing. Run npm ci in this worktree.');
  }
  if (fs.lstatSync(nodeModules).isSymbolicLink()) {
    throw new Error('Production OTA blocked: node_modules must be local, not symlinked.');
  }
  const autolinking = path.join(nodeModules, '.bin', 'expo-modules-autolinking');
  const runJson = (args) => JSON.parse(execFileSync(autolinking, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }));
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const rnConfig = runJson(['react-native-config', '--platform', 'ios', '--json']);
  const reactNativeDependencies = Object.fromEntries(
    Object.entries(rnConfig.dependencies)
      .filter(([, value]) => value.platforms?.ios)
      .map(([name, value]) => [name, value.platforms.ios.version])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const expoConfig = runJson(['resolve', '--platform', 'apple', '--json']);
  const expoModules = Object.fromEntries(
    expoConfig.modules
      .map((module) => [module.packageName, module.packageVersion])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const projection = {
    newArchEnabled: app.newArchEnabled,
    plugins: (app.plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin)),
    reactNativeDependencies,
    expoModules,
  };
  return crypto.createHash('sha256').update(JSON.stringify(projection)).digest('hex');
}

export function assertProductionOtaCompatible(candidate, baseline) {
  const comparisons = [
    ['platform', candidate.platform, baseline.platform],
    ['bundle identifier', candidate.bundleIdentifier, baseline.bundleIdentifier],
    ['app version', candidate.appVersion, baseline.appStoreVersion],
    ['target build number', String(candidate.buildNumber ?? ''), baseline.appStoreBuildNumber],
    ['runtime', candidate.runtimeVersion, baseline.runtimeVersion],
    ['native dependency fingerprint', candidate.nativeDependencyFingerprint, baseline.nativeDependencyFingerprint],
    ['channel', candidate.channel, baseline.channel],
    ['branch', candidate.branch, baseline.branch],
  ];
  const failures = comparisons.filter(([, actual, expected]) => actual !== expected);
  if (failures.length) {
    const detail = failures
      .map(([label, actual, expected]) => `${label}: candidate=${actual || '<missing>'}, live=${expected}`)
      .join('\n');
    throw new Error(
      `PRODUCTION MOBILE BLOCKED — native build required. Native build not authorized.\n${detail}`,
    );
  }
}
