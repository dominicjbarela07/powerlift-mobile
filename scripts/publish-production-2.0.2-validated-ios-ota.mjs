import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertProductionOtaCompatible,
  calculateIosNativeDependencyFingerprint,
  readProductionBaseline,
  runtimeFromExpoConfig,
} from './production-release-policy.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const message = valueFor('--message');
const prepareOnly = args.includes('--prepare-only');
if (!prepareOnly && !message) {
  throw new Error('OTA blocked: --message is required when publishing.');
}

const baseline = readProductionBaseline(root);
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
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

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strength-ledger-production-2.0.2-'));
const productionApiBase = 'https://app.strengthledger.fit';
const run = (command, commandArgs, options = {}) => execFileSync(command, commandArgs, {
  cwd: root,
  env: { ...process.env, EXPO_PUBLIC_API_BASE: productionApiBase },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
});

run(process.execPath, ['scripts/test-production-equipment-picker-hotfix.mjs']);
run('npx', ['tsc', '--noEmit']);
run('npx', [
  'expo',
  'export',
  '--platform',
  'ios',
  '--output-dir',
  outputDir,
  '--clear',
]);
run(process.execPath, ['scripts/assert-ota-route-bundle.mjs', outputDir]);

const bundleRoot = path.join(outputDir, '_expo', 'static', 'js', 'ios');
const bundlePath = fs.readdirSync(bundleRoot)
  .filter((name) => name.endsWith('.hbc'))
  .map((name) => path.join(bundleRoot, name))[0];
const localBundle = fs.readFileSync(bundlePath);
const localSha256 = crypto.createHash('sha256').update(localBundle).digest('hex');

if (prepareOnly) {
  console.log(
    `Production 2.0.2 OTA prepared — source ${sourceSha}, `
    + `${localBundle.length} bytes, SHA-256 ${localSha256}, export ${outputDir}.`,
  );
  process.exit(0);
}

const publishOutput = run('npx', [
  'eas-cli',
  'update',
  '--branch',
  baseline.branch,
  '--platform',
  'ios',
  '--message',
  message,
  '--skip-bundler',
  '--input-dir',
  outputDir,
  '--non-interactive',
  '--json',
], { capture: true });
const [published] = JSON.parse(publishOutput);
if (published.runtimeVersion !== baseline.runtimeVersion) {
  throw new Error(
    `OTA published to wrong runtime: ${published.runtimeVersion} (expected ${baseline.runtimeVersion}).`,
  );
}

const manifestResponse = await fetch(published.manifestPermalink, {
  headers: {
    accept: 'multipart/mixed',
    'expo-platform': 'ios',
    'expo-protocol-version': '1',
    'expo-runtime-version': published.runtimeVersion,
  },
});
if (!manifestResponse.ok) {
  throw new Error(`OTA published but manifest verification failed: HTTP ${manifestResponse.status}.`);
}
const contentType = manifestResponse.headers.get('content-type') ?? '';
const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
if (!boundary) {
  throw new Error('OTA published but manifest response had no multipart boundary.');
}
const responseBody = await manifestResponse.text();
const parts = responseBody.split(`--${boundary}`);
const jsonParts = parts.flatMap((part) => {
  const separator = part.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
  const body = part.split(separator).slice(1).join(separator).trim();
  if (!body.startsWith('{')) return [];
  try {
    return [JSON.parse(body)];
  } catch {
    return [];
  }
});
const manifest = jsonParts.find((part) => part.launchAsset);
const extensions = jsonParts.find((part) => part.assetRequestHeaders);
if (!manifest || !extensions) {
  throw new Error('OTA published but its manifest or asset authorization was unreadable.');
}
const launchAsset = manifest.launchAsset;
const authorization = extensions.assetRequestHeaders?.[launchAsset.key]?.authorization;
const remoteResponse = await fetch(launchAsset.url, {
  headers: authorization ? { authorization } : {},
});
if (!remoteResponse.ok) {
  throw new Error(`OTA published but launch-asset verification failed: HTTP ${remoteResponse.status}.`);
}
const remoteBundle = Buffer.from(await remoteResponse.arrayBuffer());
const remoteSha256 = crypto.createHash('sha256').update(remoteBundle).digest('hex');
if (!localBundle.equals(remoteBundle)) {
  throw new Error(
    `OTA published but remote launch asset differs from validated export `
    + `(local=${localSha256}, remote=${remoteSha256}).`,
  );
}

console.log(JSON.stringify({
  ok: true,
  sourceSha,
  runtime: published.runtimeVersion,
  branch: baseline.branch,
  channel: baseline.channel,
  group: published.group,
  iosUpdateId: published.id,
  bytes: localBundle.length,
  localSha256,
  remoteSha256,
  byteEqual: true,
}, null, 2));
