import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertProtectedArtifactAssets, protectedDeliveryHashes, sha256 } from './testflight-cumulative-integrity.mjs';
import { runDevSupersetGate, runPostReleaseGate, bindExportSource } from './verify-testflight-release-integrity.mjs';
import {assertRegisteredPublicationWorktree,runReleaseWorktreeCloseout} from './worktree-release-closeout.mjs';
import { assertEducationTransport, assertOtaAssetLimit } from './education-image-transport.mjs';
import { assertProduction3ClientFix } from './production3-client-fix-policy.mjs';
import { sharedValidationInputs, assertSharedValidation, assertReusableAssetAudit } from './shared-ota-validation.mjs';
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
const activeAssessments = valueFor('--active-assessments') || process.env.STRENGTH_LEDGER_ACTIVE_WORKTREE_ASSESSMENTS;
const runtimeReceipt = valueFor('--runtime-receipt') || process.env.STRENGTH_LEDGER_RUNTIME_RECEIPT;
const restorationRuntime = args.includes('--owner-directed-restoration');
const clientFixRuntime = args.includes('--owner-directed-client-fix');
const loggerVisualRuntime = args.includes('--owner-directed-logger-visual');
const reviewedRuntime = args.includes('--reviewed-cumulative-runtime');
const production3ClientFix = args.includes('--production3-client-fix');
const reuseValidation = valueFor('--reuse-shared-validation');
const reuseAssets = valueFor('--reuse-published-assets');
const governedProjection = branch === 'testflight' || production3ClientFix;
const nodeModules = path.join(root, 'node_modules');

if (branch.toLowerCase().includes('production') && !production3ClientFix) {
  throw new Error(
    'Production publication is blocked in the iOS-only publisher. '
    + 'Use scripts/eas-update-production.sh so shared releases target Android + iOS.',
  );
}
if (production3ClientFix) {
  const state = JSON.parse(fs.readFileSync(path.join(root,'config/testflight-release-integrity.json')));
  const nativeBaselines = JSON.parse(fs.readFileSync(path.join(root,'config/native-runtime-baselines.json')));
  const nativeProofBytes = fs.readFileSync(path.join(root,'config/testflight-release-identity-20261013/native-build35.json'));
  if (sha256(nativeProofBytes) !== nativeBaselines['3.0.0']?.sourceProofSha256) throw new Error('3.0 native source proof changed.');
  const nativeProof = JSON.parse(nativeProofBytes);
  const sourceConfig = JSON.parse(fs.readFileSync(path.join(root,'app.json'))).expo;
  if (JSON.stringify(sourceConfig.plugins) !== JSON.stringify(nativeProof.nativePlugins) || sourceConfig.newArchEnabled !== nativeProof.newArchEnabled) throw new Error('3.0 native plugin configuration changed since the actual build source.');
  const frozenNative = JSON.parse(execFileSync('git',['show',`${state.currentTestFlight.gitCommitHash}:config/native-runtime-baselines.json`],{cwd:root,encoding:'utf8'}));
  if (JSON.stringify(nativeBaselines['2.1.0']) !== JSON.stringify(frozenNative['2.1.0'])) throw new Error('The existing TestFlight native baseline must remain unchanged.');
  assertProduction3ClientFix({branch, scope:state.ownerDirectedClientFix,
    baseline:nativeBaselines['3.0.0'], proof:JSON.parse(nativeProofBytes),
    packageLockSha256:sha256(fs.readFileSync(path.join(root,'package-lock.json')))});
  if (!clientFixRuntime) throw new Error('3.0 correction requires the same source-bound owner-directed incident contracts.');
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
  env: { ...process.env, STRENGTH_LEDGER_BACKEND_ROOT: process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev', STRENGTH_LEDGER_FROZEN_TESTFLIGHT_CATALOG_REF:governedProjection?frozenCatalogRef:undefined,
    ...(production3ClientFix && !options.contracts ? {STRENGTH_LEDGER_RELEASE_TARGET:'production3',EXPO_PUBLIC_ART_RUNTIME_VERSION:'3.0.0'} : options.contracts ? {STRENGTH_LEDGER_RELEASE_TARGET:undefined,EXPO_PUBLIC_ART_RUNTIME_VERSION:undefined} : {}),
    EXPO_PUBLIC_API_BASE: apiBase, EXPO_PUBLIC_APPROVED_ART_CHANNEL: options.contracts ? 'testflight' : production3ClientFix ? 'production3' : branch === 'testflight' ? 'testflight' : 'disabled' },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
});

let devSuperset;
if (governedProjection) {
  if (!prepareOnly) assertRegisteredPublicationWorktree({root});
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
const sharedInputs = sharedValidationInputs(root, process.env.STRENGTH_LEDGER_BACKEND_ROOT || '/Users/dominic/powerlifting_app_dev');
let sharedReceipt;
if (reuseValidation) {
  sharedReceipt = JSON.parse(fs.readFileSync(reuseValidation));
  assertSharedValidation(sharedReceipt, sharedInputs);
  console.log('Shared accepted/critical/TypeScript validation reused: exact source, tests, backend and contract environment match.');
} else {
  run('npm', ['run', 'test:accepted-behavior-contracts'], {contracts:true});
  run('npm', ['run', 'test:release-critical-invariants'], {contracts:true});
  run('npx', ['tsc','--noEmit']);
  sharedReceipt = { schemaVersion:1, pass:true, inputs:sharedInputs, checks:['accepted-contracts','critical-invariants','typescript'], completedAt:new Date().toISOString() };
}
fs.writeFileSync(path.join(outputDir,'release-shared-validation.json'),JSON.stringify(sharedReceipt,null,2));
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
const exportSource=governedProjection?bindExportSource(root,outputDir):null;
run(process.execPath, ['scripts/assert-ota-route-bundle.mjs', outputDir]);
run(process.execPath, ['scripts/assert-no-dev-artwork-export.mjs', outputDir]);
run(process.execPath, ['scripts/assert-ota-native-compatibility.mjs']);
if (governedProjection) run(process.execPath, ['--import','tsx','scripts/test-pre-october-2-restoration.mjs','--export-dir',outputDir,'--output',path.join(outputDir,'release-movement-imagery.json')]);
if (governedProjection) {
  const integrityArgs = ['scripts/testflight-cumulative-integrity.mjs', '--export-dir', outputDir];
  if (!prepareOnly) {
    if (!runtimeReceipt && !restorationRuntime && !clientFixRuntime && !reviewedRuntime) throw new Error('TestFlight publication blocked: actual runtime journey receipt or exact owner-directed validation scope is required.');
    integrityArgs.push('--require-runtime');
    if (runtimeReceipt) integrityArgs.push('--runtime-receipt', runtimeReceipt);
    if (restorationRuntime) integrityArgs.push('--restoration-runtime');
    if (clientFixRuntime) integrityArgs.push('--owner-directed-client-fix');
    if (loggerVisualRuntime) integrityArgs.push('--owner-directed-logger-visual');
    if (reviewedRuntime) integrityArgs.push('--reviewed-cumulative-runtime');
  }
  run(process.execPath, integrityArgs);
}

const bundleRoot = path.join(outputDir, '_expo', 'static', 'js', 'ios');
const bundlePath = fs.readdirSync(bundleRoot)
  .filter((name) => name.endsWith('.hbc'))
  .map((name) => path.join(bundleRoot, name))[0];
const localBundle = fs.readFileSync(bundlePath);
const deliveredCount = assertOtaAssetLimit(JSON.parse(fs.readFileSync(path.join(outputDir, 'metadata.json'))));
assertEducationTransport(root, { bundle: localBundle });
console.log(`Lossless image transport PASS: 17 original PNG payloads inside actual bundle; OTA ${deliveredCount}/1000 asset entries.`);

if (prepareOnly) {
  console.log(`Validated OTA export retained at ${outputDir}`);
  process.exit(0);
}

if (governedProjection) {
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
if (governedProjection && !published.gitCommitHash) {
  const details = JSON.parse(run('npx',['eas-cli','update:view',published.group,'--json'],{capture:true}));
  const update = (Array.isArray(details) ? details : details.updates || [details]).find(item=>item.id===published.id);
  if (!update?.gitCommitHash) throw new Error('Published source identity unavailable; release workflow incomplete');
  published.gitCommitHash = update.gitCommitHash;
}
if (governedProjection && (published.runtimeVersion !== (production3ClientFix ? '3.0.0' : '2.1.0') || published.platform !== 'ios')) {
  throw new Error('Published correction has the wrong native runtime or platform.');
}

const channelDetails = JSON.parse(run('npx', ['eas-cli','channel:view',branch,'--json','--non-interactive'], {capture:true}));
const channel = channelDetails.currentPage || channelDetails;
if (channel.isPaused || channel.updateBranches?.length !== 1 || channel.updateBranches[0].name !== branch) {
  throw new Error('Published correction channel must resolve unambiguously to the validated branch.');
}
fs.writeFileSync(path.join(outputDir,'release-channel.json'),JSON.stringify({channel:channel.name,branch:channel.updateBranches[0].name,paused:channel.isPaused,updateId:published.id,runtimeVersion:published.runtimeVersion},null,2));

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

if (governedProjection) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'config/testflight-release-integrity.json'), 'utf8'));
  assertProtectedArtifactAssets(protectedDeliveryHashes(root,baseline), manifest.assets.map(asset => asset.hash), baseline.assetRemovalAuthorizations);
}

if (manifest.id !== published.id || manifest.runtimeVersion !== published.runtimeVersion) throw new Error('Served manifest differs from the exact published correction.');
const verifiedAssets = [];
let assetCursor = 0;
if (reuseAssets) {
  const auditBytes = fs.readFileSync(reuseAssets);
  const baseline = JSON.parse(fs.readFileSync(path.join(root,'config/testflight-release-integrity.json')));
  const pins = Object.values(baseline).flatMap(value => value?.publishedProof?.assetAudit ? [value.publishedProof.assetAudit.sha256] : []);
  if (!pins.includes(sha256(auditBytes))) throw new Error('Asset reuse requires an exact retained verified publication proof.');
  verifiedAssets.push(...assertReusableAssetAudit(JSON.parse(auditBytes), manifest.assets));
  console.log(`Reused verified content-addressed bytes for ${verifiedAssets.length} unchanged asset entries.`);
} else await Promise.all(Array.from({length:4}, async () => {
  while (assetCursor < manifest.assets.length) {
    const asset = manifest.assets[assetCursor++];
    const auth = extensions.assetRequestHeaders?.[asset.key]?.authorization;
    const response = await fetch(asset.url, {headers:auth ? {authorization:auth} : {}});
    if (!response.ok) throw new Error(`Published asset unavailable: ${asset.key}, HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = crypto.createHash('sha256').update(bytes).digest('base64url');
    if (hash !== asset.hash) throw new Error(`Published asset bytes differ: ${asset.key}`);
    verifiedAssets.push({key:asset.key,hash,bytes:bytes.length});
  }
}));
fs.writeFileSync(path.join(outputDir,'release-asset-byte-audit.json'),JSON.stringify({pass:true,updateId:published.id,runtimeVersion:published.runtimeVersion,verified:verifiedAssets.length,missingOrCorrupt:0,assets:verifiedAssets,...(reuseAssets?{reusedFrom:{path:reuseAssets,sha256:sha256(fs.readFileSync(reuseAssets))}}:{})},null,2));

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
assertEducationTransport(root, { bundle: remoteBundle });
if (governedProjection) {
  const post = runPostReleaseGate({root,published,manifest,candidateSha:devSuperset.candidate.sha,devProductFingerprint:devSuperset.devProductFingerprint,validatedBundleSha256:bundleSha256,servedBundleSha256:sha256(remoteBundle),validatedAssetHashes:exportSource.assetHashes});
  fs.writeFileSync(path.join(outputDir,'release-gate-c.json'),JSON.stringify(post,null,2));
  console.log(`Gate C PASS: exact published artifact/source remains contained in DEV; receipt ${outputDir}/release-gate-c.json`);
  const closeout=runReleaseWorktreeCloseout({root,gateC:post,activeAssessments,exportDir:outputDir});
  console.log(`Release worktree closeout PASS: ${closeout.receiptPath}`);
}

console.log(
  `OTA publish verified — group ${published.group}, update ${published.id}, ` +
  `${remoteBundle.length} byte route-complete launch bundle, SHA-256 ${bundleSha256}.`,
);
