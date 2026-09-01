import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertLiveEasBuild,
  assertProductionOtaCompatible,
  assertPublicationScope,
  calculateNativeDependencyFingerprint,
  platformBaseline,
  readProductionBaseline,
  runtimeFromExpoConfig,
} from './production-release-policy.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = valueFor('--platform');
const scope = valueFor('--release-scope');
const reason = valueFor('--reason');
const message = valueFor('--message');
const prepareOnly = args.includes('--prepare-only');
if (!prepareOnly && !message) {
  throw new Error('OTA blocked: --message is required when publishing.');
}

const platforms = assertPublicationScope({ target, scope, reason });
const baseline = readProductionBaseline(root);
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const run = (command, commandArgs, options = {}) => execFileSync(command, commandArgs, {
  cwd: root,
  env: { ...process.env, EXPO_PUBLIC_API_BASE: 'https://app.strengthledger.fit' },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
});

for (const platform of platforms) {
  const nativeDependencyFingerprint = calculateNativeDependencyFingerprint(platform, root);
  assertProductionOtaCompatible({
    platform,
    applicationIdentifier: platform === 'ios'
      ? app.ios?.bundleIdentifier
      : app.android?.package,
    appVersion: app.version,
    runtimeVersion: runtimeFromExpoConfig(app),
    nativeDependencyFingerprint,
    channel: baseline.channel,
    branch: baseline.branch,
  }, baseline);
  const live = platformBaseline(baseline, platform);
  const build = JSON.parse(run('npx', [
    'eas-cli',
    'build:view',
    live.easBuildId,
    '--json',
  ], { capture: true }));
  assertLiveEasBuild(build, baseline, platform);
}

const gitStatus = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
if (gitStatus) {
  throw new Error(`OTA blocked: release worktree is not clean.\n${gitStatus}`);
}
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();

run('npm', ['run', 'test:release-critical-invariants']);
run('npx', ['tsc', '--noEmit']);

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strength-ledger-production-2.0.2-'));
run('npx', [
  'expo',
  'export',
  '--platform',
  target,
  '--output-dir',
  outputDir,
  '--clear',
]);
run(process.execPath, ['scripts/assert-ota-route-bundle.mjs', outputDir, target]);

const localBundles = new Map(platforms.map((platform) => {
  const bundleRoot = path.join(outputDir, '_expo', 'static', 'js', platform);
  const bundlePaths = fs.readdirSync(bundleRoot)
    .filter((name) => name.endsWith('.hbc'))
    .map((name) => path.join(bundleRoot, name));
  if (bundlePaths.length !== 1) {
    throw new Error(`OTA blocked: expected one ${platform} Hermes bundle, found ${bundlePaths.length}.`);
  }
  const bytes = fs.readFileSync(bundlePaths[0]);
  return [platform, {
    bytes,
    length: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  }];
}));

if (prepareOnly) {
  console.log(JSON.stringify({
    ok: true,
    prepareOnly: true,
    sourceSha,
    runtime: baseline.runtimeVersion,
    branch: baseline.branch,
    channel: baseline.channel,
    target,
    scope,
    reason: reason || null,
    artifacts: Object.fromEntries([...localBundles].map(([platform, bundle]) => [platform, {
      bytes: bundle.length,
      sha256: bundle.sha256,
    }])),
    export: outputDir,
  }, null, 2));
  process.exit(0);
}

const publishOutput = run('npx', [
  'eas-cli',
  'update',
  '--branch',
  baseline.branch,
  '--platform',
  target,
  '--message',
  message,
  '--skip-bundler',
  '--input-dir',
  outputDir,
  '--non-interactive',
  '--json',
], { capture: true });
const published = JSON.parse(publishOutput);
const publishedPlatforms = [...new Set(published.map((update) => update.platform))].sort();
const expectedPlatforms = [...platforms].sort();
if (JSON.stringify(publishedPlatforms) !== JSON.stringify(expectedPlatforms)) {
  throw new Error(
    `OTA published with wrong platform set: ${publishedPlatforms.join(', ') || '<none>'} `
    + `(expected ${expectedPlatforms.join(', ')}).`,
  );
}
const groups = [...new Set(published.map((update) => update.group))];
if (groups.length !== 1) {
  throw new Error(`OTA published into ${groups.length} update groups; expected exactly one.`);
}
for (const update of published) {
  if (update.runtimeVersion !== baseline.runtimeVersion) {
    throw new Error(
      `OTA published to wrong runtime: ${update.runtimeVersion} (expected ${baseline.runtimeVersion}).`,
    );
  }
}

function parseMultipart(contentType, responseBody) {
  const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
  if (!boundary) throw new Error('OTA manifest response had no multipart boundary.');
  return responseBody.split(`--${boundary}`).flatMap((part) => {
    const separator = part.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
    const body = part.split(separator).slice(1).join(separator).trim();
    if (!body.startsWith('{')) return [];
    try {
      return [JSON.parse(body)];
    } catch {
      return [];
    }
  });
}

async function fetchManifestBundle(url, platform, expectedUpdateId) {
  const response = await fetch(url, {
    headers: {
      accept: 'multipart/mixed',
      'expo-platform': platform,
      'expo-protocol-version': '1',
      'expo-runtime-version': baseline.runtimeVersion,
      'expo-channel-name': baseline.channel,
    },
  });
  if (!response.ok) throw new Error(`OTA manifest verification failed: HTTP ${response.status}.`);
  const parts = parseMultipart(
    response.headers.get('content-type') ?? '',
    await response.text(),
  );
  const manifest = parts.find((part) => part.launchAsset);
  const extensions = parts.find((part) => part.assetRequestHeaders);
  if (!manifest || !extensions) throw new Error('OTA manifest or asset authorization was unreadable.');
  if (manifest.id !== expectedUpdateId) {
    throw new Error(`OTA update resolution mismatch: ${manifest.id} (expected ${expectedUpdateId}).`);
  }
  if (manifest.runtimeVersion !== baseline.runtimeVersion) {
    throw new Error(`OTA manifest runtime mismatch: ${manifest.runtimeVersion}.`);
  }
  if (manifest.metadata?.branchName !== baseline.branch) {
    throw new Error(`OTA manifest branch mismatch: ${manifest.metadata?.branchName || '<missing>'}.`);
  }
  const authorization = extensions.assetRequestHeaders?.[manifest.launchAsset.key]?.authorization;
  const remoteResponse = await fetch(manifest.launchAsset.url, {
    headers: authorization ? { authorization } : {},
  });
  if (!remoteResponse.ok) {
    throw new Error(`OTA launch-asset verification failed: HTTP ${remoteResponse.status}.`);
  }
  return {
    manifest,
    bytes: Buffer.from(await remoteResponse.arrayBuffer()),
  };
}

const verified = {};
for (const update of published) {
  const direct = await fetchManifestBundle(update.manifestPermalink, update.platform, update.id);
  const local = localBundles.get(update.platform);
  if (!local.bytes.equals(direct.bytes)) {
    throw new Error(`OTA direct launch asset differs from validated ${update.platform} export.`);
  }

  let resolved;
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      resolved = await fetchManifestBundle(app.updates.url, update.platform, update.id);
      break;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  if (!resolved) throw lastError;
  if (!local.bytes.equals(resolved.bytes)) {
    throw new Error(`Production channel serves bytes different from validated ${update.platform} export.`);
  }
  verified[update.platform] = {
    updateId: update.id,
    bytes: local.length,
    localSha256: local.sha256,
    remoteSha256: crypto.createHash('sha256').update(resolved.bytes).digest('hex'),
    byteEqual: true,
    channelResolved: true,
  };
}

const groupView = JSON.parse(run('npx', [
  'eas-cli',
  'update:view',
  groups[0],
  '--json',
], { capture: true }));
const groupPlatforms = [...new Set(groupView.map((update) => update.platform))].sort();
if (JSON.stringify(groupPlatforms) !== JSON.stringify(expectedPlatforms)) {
  throw new Error(
    `Published group platform audit failed: ${groupPlatforms.join(', ') || '<none>'} `
    + `(expected ${expectedPlatforms.join(', ')}).`,
  );
}

console.log(JSON.stringify({
  ok: true,
  sourceSha,
  runtime: baseline.runtimeVersion,
  branch: baseline.branch,
  channel: baseline.channel,
  group: groups[0],
  target,
  scope,
  reason: reason || null,
  verified,
}, null, 2));
