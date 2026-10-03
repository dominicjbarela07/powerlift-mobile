import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertProtectedArtifactAssets, sha256 } from './testflight-cumulative-integrity.mjs';
import { runDevSupersetGate, runPostReleaseGate, bindExportSource } from './verify-testflight-release-integrity.mjs';
// Mandatory authority: backend docs/RELEASE_INVARIANTS.md; Gates A/B/C cannot be bypassed here.

const root = process.cwd();
const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const branch = valueFor('--branch') ?? 'testflight';
const message = valueFor('--message');
const prepareOnly = args.includes('--prepare-only');
const runtimeReceipt = valueFor('--runtime-receipt') || process.env.STRENGTH_LEDGER_RUNTIME_RECEIPT;
const nodeModules = path.join(root, 'node_modules');

if (branch.toLowerCase().includes('production')) {
  throw new Error(
    'Production publication is blocked in the iOS-only publisher. '
    + 'Use scripts/eas-update-production.sh so shared releases target Android + iOS.',
  );
}

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
const frozenCatalogRef=JSON.parse(fs.readFileSync(path.join(root,'config/testflight-release-integrity.json'),'utf8')).previousTestFlight.gitCommitHash;
const run = (command, commandArgs, options = {}) => execFileSync(command, commandArgs, {
  cwd: root,
  env: { ...process.env, STRENGTH_LEDGER_FROZEN_TESTFLIGHT_CATALOG_REF:branch==='testflight'?frozenCatalogRef:undefined, EXPO_PUBLIC_API_BASE: apiBase, EXPO_PUBLIC_APPROVED_ART_CHANNEL: branch === 'testflight' ? 'testflight' : 'disabled' },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
});

let devSuperset;
if (branch === 'testflight') {
  if (JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).expo.extra?.releaseTrack!=='testflight') throw new Error('TestFlight must use its explicit release projection');
  devSuperset = runDevSupersetGate({root,requireCleanCandidate:!prepareOnly});
  if (!devSuperset.pass) throw new Error(`Gate A blocked: restore TestFlight → DEV: ${devSuperset.missing.map(item=>item.identity).join(', ')}`);
  fs.writeFileSync(path.join(outputDir,'release-gate-a.json'),JSON.stringify(devSuperset,null,2));
  run(process.execPath, ['scripts/test-release-source-lineage.mjs']);
  run(process.execPath, ['scripts/testflight-cumulative-integrity.mjs']);
  if (!prepareOnly) {
    const baseline = JSON.parse(fs.readFileSync(path.join(root,'config/testflight-release-integrity.json'),'utf8'));
    const remote = JSON.parse(run('npx',['eas-cli','update:list','--branch','testflight','--limit','10','--json','--non-interactive'],{capture:true}));
    const latest = remote.currentPage.filter(update => update.platforms.includes('ios')).slice(0,2);
    if (latest[0]?.group !== baseline.currentTestFlight.group || latest[1]?.group !== baseline.previousTestFlight.group) {
      throw new Error('TestFlight changed since the protected baseline was reconciled. Audit the exact current and previous releases before publishing.');
    }
  }
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
const exportSource=branch==='testflight'?bindExportSource(root,outputDir):null;
run(process.execPath, ['scripts/assert-ota-route-bundle.mjs', outputDir]);
run(process.execPath, ['scripts/assert-no-dev-artwork-export.mjs', outputDir]);
run(process.execPath, ['scripts/assert-ota-native-compatibility.mjs']);
if (branch === 'testflight') {
  const integrityArgs = ['scripts/testflight-cumulative-integrity.mjs', '--export-dir', outputDir];
  if (!prepareOnly) {
    if (!runtimeReceipt) throw new Error('TestFlight publication blocked: actual runtime journey receipt is required.');
    integrityArgs.push('--require-runtime', '--runtime-receipt', runtimeReceipt);
  }
  run(process.execPath, integrityArgs);
}

const bundleRoot = path.join(outputDir, '_expo', 'static', 'js', 'ios');
const bundlePath = fs.readdirSync(bundleRoot)
  .filter((name) => name.endsWith('.hbc'))
  .map((name) => path.join(bundleRoot, name))[0];
const localBundle = fs.readFileSync(bundlePath);

if (prepareOnly) {
  console.log(`Validated OTA export retained at ${outputDir}`);
  process.exit(0);
}

if (branch === 'testflight') {
  const finalPreflight=runDevSupersetGate({root,requireCleanCandidate:true});
  if (!finalPreflight.pass || finalPreflight.candidate.sha!==exportSource.candidateSha || finalPreflight.candidateProductFingerprint!==exportSource.productFingerprint || finalPreflight.devProductFingerprint!==devSuperset.devProductFingerprint) throw new Error('Source changed during validation; release blocked until exact source is reconciled and exported again');
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'config/testflight-release-integrity.json'),'utf8'));
  const latest=JSON.parse(run('npx',['eas-cli','update:list','--branch','testflight','--limit','10','--json','--non-interactive'],{capture:true})).currentPage.filter(update=>update.platforms.includes('ios')).slice(0,2);
  if (latest[0]?.group!==baseline.currentTestFlight.group || latest[1]?.group!==baseline.previousTestFlight.group) throw new Error('TestFlight changed while validating; reconcile the exact new protected baseline before publication');
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
if (branch === 'testflight' && !published.gitCommitHash) {
  const details = JSON.parse(run('npx',['eas-cli','update:view',published.group,'--json'],{capture:true}));
  const update = (Array.isArray(details) ? details : details.updates || [details]).find(item=>item.id===published.id);
  if (!update?.gitCommitHash) throw new Error('Published source identity unavailable; release workflow incomplete');
  published.gitCommitHash = update.gitCommitHash;
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

if (branch === 'testflight') {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'config/testflight-release-integrity.json'), 'utf8'));
  assertProtectedArtifactAssets(baseline.protectedAssetHashes, manifest.assets.map(asset => asset.hash), baseline.assetRemovalAuthorizations);
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
if (branch === 'testflight') {
  const post = runPostReleaseGate({root,published,manifest,candidateSha:devSuperset.candidate.sha,devProductFingerprint:devSuperset.devProductFingerprint,validatedBundleSha256:bundleSha256,servedBundleSha256:sha256(remoteBundle),validatedAssetHashes:exportSource.assetHashes});
  fs.writeFileSync(path.join(outputDir,'release-gate-c.json'),JSON.stringify(post,null,2));
  console.log(`Gate C PASS: exact published artifact/source remains contained in DEV; receipt ${outputDir}/release-gate-c.json`);
}

console.log(
  `OTA publish verified — group ${published.group}, update ${published.id}, ` +
  `${remoteBundle.length} byte route-complete launch bundle, SHA-256 ${bundleSha256}.`,
);
