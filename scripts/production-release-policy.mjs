import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const PRODUCTION_PLATFORMS = Object.freeze(['android', 'ios']);

export function readProductionBaseline(root = process.cwd()) {
  const baseline = JSON.parse(fs.readFileSync(
    path.join(root, 'config', 'production-mobile-baseline.json'),
    'utf8',
  ));
  if (baseline.schemaVersion !== 2 || !baseline.platforms) {
    throw new Error('Production OTA blocked: platform-aware baseline schema v2 is required.');
  }
  return baseline;
}

export function platformBaseline(baseline, platform) {
  if (!PRODUCTION_PLATFORMS.includes(platform)) {
    throw new Error(`Production OTA blocked: unsupported platform ${platform || '<missing>'}.`);
  }
  const selected = baseline.platforms?.[platform];
  if (!selected) {
    throw new Error(`Production OTA blocked: ${platform} has no governed live baseline.`);
  }
  return selected;
}

export function runtimeFromExpoConfig(expo) {
  if (typeof expo.runtimeVersion === 'string') return expo.runtimeVersion;
  if (expo.runtimeVersion?.policy === 'appVersion') return expo.version;
  throw new Error('Production OTA blocked: runtimeVersion is not explicit or appVersion-owned.');
}

function packageVersion(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
}

export function calculateNativeDependencyFingerprint(platform, root = process.cwd()) {
  if (!PRODUCTION_PLATFORMS.includes(platform)) {
    throw new Error(`Production OTA blocked: unsupported native projection platform ${platform}.`);
  }
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
  const rnConfig = runJson(['react-native-config', '--platform', platform, '--json']);
  const reactNativeDependencies = Object.fromEntries(
    Object.entries(rnConfig.dependencies)
      .filter(([, value]) => value.platforms?.[platform])
      .map(([name, value]) => [name, packageVersion(value.root)])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const expoConfig = runJson([
    'resolve',
    '--platform',
    platform === 'ios' ? 'apple' : 'android',
    '--json',
  ]);
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

export function requestedPlatforms(target) {
  if (target === 'all') return [...PRODUCTION_PLATFORMS];
  if (PRODUCTION_PLATFORMS.includes(target)) return [target];
  throw new Error(`Production OTA blocked: --platform must be all, android, or ios (received ${target || '<missing>'}).`);
}

export function assertPublicationScope({ target, scope, reason }) {
  const platforms = requestedPlatforms(target);
  if (scope === 'shared') {
    if (target !== 'all') {
      throw new Error(
        'Production OTA blocked: shared releases must explicitly publish Android + iOS with --platform all.',
      );
    }
    return platforms;
  }
  if (scope === 'platform-specific') {
    if (target === 'all') {
      throw new Error('Production OTA blocked: platform-specific releases must name exactly one platform.');
    }
    if (!reason || reason.trim().length < 20) {
      throw new Error('Production OTA blocked: platform-specific releases require a substantive --reason.');
    }
    return platforms;
  }
  throw new Error('Production OTA blocked: --release-scope must be shared or platform-specific.');
}

export function assertProductionOtaCompatible(candidate, baseline) {
  const live = platformBaseline(baseline, candidate.platform);
  const comparisons = [
    ['application identifier', candidate.applicationIdentifier, live.applicationIdentifier],
    ['app version', candidate.appVersion, live.storeVersion],
    ['runtime', candidate.runtimeVersion, baseline.runtimeVersion],
    ['native dependency fingerprint', candidate.nativeDependencyFingerprint, live.nativeDependencyFingerprint],
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

export function assertLiveEasBuild(build, baseline, platform) {
  const live = platformBaseline(baseline, platform);
  const comparisons = [
    ['build id', build.id, live.easBuildId],
    ['platform', String(build.platform || '').toLowerCase(), platform],
    ['distribution', String(build.distribution || '').toLowerCase(), 'store'],
    ['channel', build.channel, baseline.channel],
    ['app version', build.appVersion, live.storeVersion],
    ['build number', String(build.appBuildVersion ?? ''), live.storeBuildNumber],
    ['runtime', build.runtimeVersion, baseline.runtimeVersion],
    ['EAS build fingerprint', build.fingerprint?.hash, live.easBuildFingerprint],
  ];
  const failures = comparisons.filter(([, actual, expected]) => actual !== expected);
  if (failures.length) {
    const detail = failures
      .map(([label, actual, expected]) => `${label}: EAS=${actual || '<missing>'}, baseline=${expected}`)
      .join('\n');
    throw new Error(
      `PRODUCTION MOBILE BLOCKED — native build required. Native build not authorized.\n${detail}`,
    );
  }
}
