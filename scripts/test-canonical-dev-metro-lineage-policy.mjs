import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CANONICAL_DEV_METRO_PORT,
  CANONICAL_DEV_MOBILE_BRANCH,
  CANONICAL_DEV_MOBILE_REMOTE_REF,
  CANONICAL_DEV_MOBILE_ROOT,
  assertCanonicalMetroSnapshot,
  assertCanonicalSource,
  inspectCanonicalSource,
} from './canonical-dev-metro-lineage.mjs';

const sha = 'f'.repeat(40);
const source = {
  projectRoot: CANONICAL_DEV_MOBILE_ROOT,
  gitRoot: CANONICAL_DEV_MOBILE_ROOT,
  scriptRoot: CANONICAL_DEV_MOBILE_ROOT,
  branch: CANONICAL_DEV_MOBILE_BRANCH,
  sha,
  remoteRef: CANONICAL_DEV_MOBILE_REMOTE_REF,
  remoteSha: sha,
  clean: true,
};
assert.equal(assertCanonicalSource(source), source);

const snapshot = {
  source,
  listener: {
    port: CANONICAL_DEV_METRO_PORT,
    processes: [{ pid: 1234, cwd: CANONICAL_DEV_MOBILE_ROOT, command: 'node expo start --port 8081' }],
  },
  manifest: {
    projectRoot: CANONICAL_DEV_MOBILE_ROOT,
    runtimeVersion: '2.1.0',
    appVersion: '2.1.0',
    launchAssetUrl: 'http://172.20.5.63:8081/node_modules/expo-router/entry.bundle?platform=ios',
  },
};
assert.equal(assertCanonicalMetroSnapshot(snapshot), snapshot);

// Exercise source inspection with each real porcelain status shape. The
// injected Git reader keeps these tests independent of the developer's index.
for (const [label, status, clean] of [
  ['clean', '', true],
  ['modified tracked file', ' M app.json', false],
  ['untracked file', '?? local-development.txt', false],
  ['staged change', 'M  app.json', false],
  ['staged addition', 'A  local-development.txt', false],
  ['mixed local changes', 'MM app.json\n?? local-development.txt', false],
]) {
  const inspected = inspectCanonicalSource((file, args) => {
    assert.equal(file, 'git');
    switch (args.join(' ')) {
      case 'rev-parse --show-toplevel': return CANONICAL_DEV_MOBILE_ROOT;
      case 'branch --show-current': return CANONICAL_DEV_MOBILE_BRANCH;
      case 'rev-parse HEAD': return sha;
      case `rev-parse ${CANONICAL_DEV_MOBILE_REMOTE_REF}`: return sha;
      case 'status --porcelain=v1': return status;
      default: assert.fail(`Unexpected Git inspection: ${args.join(' ')}`);
    }
  });
  assert.equal(inspected.clean, clean, `${label}: preserve honest development state`);
  // Inspection reports this test's real runtime roots, including a release
  // projection. Test DEV cleanliness with canonical fixture roots; separately
  // prove a noncanonical inspection still fails even when its Git reader lies.
  const canonicalInspection = { ...inspected, projectRoot: source.projectRoot, scriptRoot: source.scriptRoot };
  assert.equal(assertCanonicalSource(canonicalInspection), canonicalInspection, `${label}: startup passes`);
  if (inspected.projectRoot !== source.projectRoot || inspected.scriptRoot !== source.scriptRoot) {
    assert.throws(() => assertCanonicalSource(inspected), /CANONICAL DEV SOURCE CHECK FAILED/);
  }
  const runtime = { ...snapshot, source: canonicalInspection };
  assert.equal(assertCanonicalMetroSnapshot(runtime), runtime, `${label}: DEV certification passes`);
}

for (const invalid of [
  { ...source, projectRoot: '/tmp/isolated-worktree' },
  { ...source, gitRoot: '/tmp/other-repository' },
  { ...source, scriptRoot: '/tmp/release-projection' },
  { ...source, branch: 'codex/isolated-validation' },
  { ...source, branch: 'release/testflight/dev-convergence-20260909' },
  { ...source, branch: 'production' },
  { ...source, branch: '' },
  { ...source, remoteSha: '0'.repeat(40) },
]) {
  for (const clean of [true, false]) {
    const invalidSource = { ...invalid, clean };
    assert.throws(() => assertCanonicalSource(invalidSource), /CANONICAL DEV SOURCE CHECK FAILED/);
    assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, source: invalidSource }), /CANONICAL DEV SOURCE CHECK FAILED/);
  }
}
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, listener: { port: 8082, processes: snapshot.listener.processes } }), /port is 8082/);
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, listener: { ...snapshot.listener, processes: [] } }), /expected one listener/);
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, listener: { ...snapshot.listener, processes: [...snapshot.listener.processes, ...snapshot.listener.processes] } }), /expected one listener/);
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, listener: { ...snapshot.listener, processes: [{ ...snapshot.listener.processes[0], cwd: '/tmp/release-projection' }] } }), /listener CWD/);
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, manifest: { ...snapshot.manifest, projectRoot: '/tmp/isolated-worktree' } }), /manifest project root/);
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, manifest: { ...snapshot.manifest, runtimeVersion: 'wrong-runtime' } }), /does not match app version/);
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, manifest: { ...snapshot.manifest, launchAssetUrl: 'http://127.0.0.1:8082/bundle' } }), /launch asset is not served by port 8081/);
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, manifest: { ...snapshot.manifest, launchAssetUrl: 'invalid' } }), /launch asset URL is invalid/);

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const apiBaseSource = readFileSync(new URL('../lib/api-base.ts', import.meta.url), 'utf8');
assert.equal(packageJson.scripts.start, 'node scripts/start-canonical-dev-metro.mjs');
assert.equal(packageJson.scripts['start:canonical-dev'], undefined);
assert.match(apiBaseSource, /http:\/\/10\.0\.2\.2:5000/, 'Android DEV must call Flask on its normal default port');
assert.match(apiBaseSource, /http:\/\/127\.0\.0\.1:5000/, 'iOS simulator DEV must call Flask on its normal default port');
assert.doesNotMatch(apiBaseSource, /(?:10\.0\.2\.2|127\.0\.0\.1):9081/, 'mobile DEV must not depend on the retired custom backend port');

console.log('[canonical DEV Metro lineage] clean/tracked/untracked/staged DEV passes; wrong roots, branches, release contexts, SHA, listener, and manifest fail closed');
