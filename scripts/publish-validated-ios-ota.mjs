import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const branch = valueFor('--branch') ?? 'testflight';
const message = valueFor('--message');
const prepareOnly = args.includes('--prepare-only');
const nodeModules = path.join(root, 'node_modules');

if (!fs.existsSync(nodeModules)) {
  throw new Error('OTA blocked: node_modules is missing. Run npm ci in this worktree.');
}
if (fs.lstatSync(nodeModules).isSymbolicLink()) {
  throw new Error(
    'OTA blocked: node_modules is a symlink. Run npm ci in this worktree so Expo Router resolves this app directory.',
  );
}
if (!prepareOnly && !message) {
  throw new Error('OTA blocked: --message is required when publishing.');
}

const easConfig = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const apiBase = process.env.EXPO_PUBLIC_API_BASE
  ?? easConfig.build?.testflight?.env?.EXPO_PUBLIC_API_BASE;
if (!apiBase) {
  throw new Error('OTA blocked: EXPO_PUBLIC_API_BASE is not configured.');
}

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strength-ledger-ios-ota-'));
const run = (command, commandArgs, options = {}) => execFileSync(command, commandArgs, {
  cwd: root,
  env: { ...process.env, EXPO_PUBLIC_API_BASE: apiBase },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
});

if (branch === 'testflight') {
  run(process.execPath, ['scripts/test-release-source-lineage.mjs']);
}
run('npm', ['run', 'test:accepted-behavior-contracts']);
run('npm', ['run', 'test:release-critical-invariants']);
run(process.execPath, ['scripts/test-testflight-source-parity.mjs', '--release-projection', '.']);

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
run(process.execPath, ['scripts/assert-ota-native-compatibility.mjs']);

const bundleRoot = path.join(outputDir, '_expo', 'static', 'js', 'ios');
const bundlePath = fs.readdirSync(bundleRoot)
  .filter((name) => name.endsWith('.hbc'))
  .map((name) => path.join(bundleRoot, name))[0];
const localBundle = fs.readFileSync(bundlePath);

if (prepareOnly) {
  console.log(`Validated OTA export retained at ${outputDir}`);
  process.exit(0);
}

const publishOutput = run('npx', [
  'eas-cli',
  'update',
  '--branch',
  branch,
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
if (!localBundle.equals(remoteBundle)) {
  throw new Error(
    `OTA published but remote launch asset differs from validated export ` +
    `(local=${localBundle.length}, remote=${remoteBundle.length}).`,
  );
}

const bundleSha256 = crypto.createHash('sha256').update(localBundle).digest('hex');

console.log(
  `OTA publish verified — group ${published.group}, update ${published.id}, ` +
  `${remoteBundle.length} byte route-complete launch bundle, SHA-256 ${bundleSha256}.`,
);
