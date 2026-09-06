import assert from 'node:assert/strict';

import {
  CANONICAL_DEV_METRO_PORT,
  CANONICAL_DEV_MOBILE_BRANCH,
  CANONICAL_DEV_MOBILE_REMOTE_REF,
  CANONICAL_DEV_MOBILE_ROOT,
  assertCanonicalMetroSnapshot,
  assertCanonicalSource,
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

for (const invalid of [
  { ...source, projectRoot: '/tmp/isolated-worktree' },
  { ...source, branch: 'codex/isolated-validation' },
  { ...source, remoteSha: '0'.repeat(40) },
  { ...source, clean: false },
]) {
  assert.throws(() => assertCanonicalSource(invalid), /CANONICAL DEV SOURCE CHECK FAILED/);
}
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, listener: { port: 8082, processes: snapshot.listener.processes } }), /port is 8082/);
assert.throws(() => assertCanonicalMetroSnapshot({ ...snapshot, manifest: { ...snapshot.manifest, projectRoot: '/tmp/isolated-worktree' } }), /manifest project root/);

console.log('[canonical DEV Metro lineage] fixed root, branch, SHA, clean-state, port, listener, and manifest guards passed');
