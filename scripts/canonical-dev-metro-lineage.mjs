import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANONICAL_DEV_MOBILE_ROOT = '/Users/dominic/powerlifting_app_dev/powerlift_mobile';
export const CANONICAL_DEV_MOBILE_BRANCH = 'dev/canonical-mobile';
export const CANONICAL_DEV_MOBILE_REMOTE_REF = 'origin/dev/canonical-mobile';
export const CANONICAL_DEV_METRO_PORT = 8081;

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function command(file, args, cwd = CANONICAL_DEV_MOBILE_ROOT) {
  return execFileSync(file, args, { cwd, encoding: 'utf8' }).trim();
}

function canonicalPath(candidate) {
  return realpathSync(candidate);
}

export function inspectCanonicalSource() {
  const projectRoot = canonicalPath(process.cwd());
  const gitRoot = canonicalPath(command('git', ['rev-parse', '--show-toplevel'], projectRoot));
  const branch = command('git', ['branch', '--show-current'], projectRoot);
  const sha = command('git', ['rev-parse', 'HEAD'], projectRoot);
  const remoteSha = command('git', ['rev-parse', CANONICAL_DEV_MOBILE_REMOTE_REF], projectRoot);
  const status = command('git', ['status', '--porcelain=v1'], projectRoot);
  return {
    projectRoot,
    gitRoot,
    scriptRoot: canonicalPath(scriptRoot),
    branch,
    sha,
    remoteRef: CANONICAL_DEV_MOBILE_REMOTE_REF,
    remoteSha,
    clean: status.length === 0,
  };
}

export function assertCanonicalSource(snapshot) {
  const expectedRoot = canonicalPath(CANONICAL_DEV_MOBILE_ROOT);
  const failures = [];
  if (snapshot.projectRoot !== expectedRoot) failures.push(`process root is ${snapshot.projectRoot}`);
  if (snapshot.gitRoot !== expectedRoot) failures.push(`Git root is ${snapshot.gitRoot}`);
  if (snapshot.scriptRoot !== expectedRoot) failures.push(`tooling root is ${snapshot.scriptRoot}`);
  if (snapshot.branch !== CANONICAL_DEV_MOBILE_BRANCH) failures.push(`branch is ${snapshot.branch || '(detached)'}`);
  if (snapshot.sha !== snapshot.remoteSha) failures.push(`HEAD ${snapshot.sha} does not equal ${snapshot.remoteRef} ${snapshot.remoteSha}`);
  if (!snapshot.clean) failures.push('working tree is dirty');
  if (failures.length) {
    throw new Error(`CANONICAL DEV SOURCE CHECK FAILED — ${failures.join('; ')}`);
  }
  return snapshot;
}

export function inspectMetroListener() {
  let pidOutput = '';
  try {
    pidOutput = command('lsof', ['-nP', `-iTCP:${CANONICAL_DEV_METRO_PORT}`, '-sTCP:LISTEN', '-t']);
  } catch {
    return { port: CANONICAL_DEV_METRO_PORT, processes: [] };
  }
  const pids = [...new Set(pidOutput.split(/\s+/).filter(Boolean).map(Number))];
  const processes = pids.map((pid) => {
    const cwdOutput = command('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
    const cwd = canonicalPath(cwdOutput.split('\n').find((line) => line.startsWith('n'))?.slice(1) || '');
    return {
      pid,
      cwd,
      command: command('ps', ['-p', String(pid), '-o', 'command=']),
    };
  });
  return { port: CANONICAL_DEV_METRO_PORT, processes };
}

export function assertCanonicalMetroSnapshot(snapshot) {
  assertCanonicalSource(snapshot.source);
  const expectedRoot = canonicalPath(CANONICAL_DEV_MOBILE_ROOT);
  const failures = [];
  if (snapshot.listener.port !== CANONICAL_DEV_METRO_PORT) failures.push(`listener port is ${snapshot.listener.port}`);
  if (snapshot.listener.processes.length !== 1) failures.push(`expected one listener, found ${snapshot.listener.processes.length}`);
  if (snapshot.listener.processes.some((process) => process.cwd !== expectedRoot)) failures.push('listener CWD is not the canonical project root');
  if (snapshot.manifest.projectRoot !== expectedRoot) failures.push(`Expo manifest project root is ${snapshot.manifest.projectRoot}`);
  if (snapshot.manifest.runtimeVersion !== snapshot.manifest.appVersion) failures.push(`runtime ${snapshot.manifest.runtimeVersion} does not match app version ${snapshot.manifest.appVersion}`);
  try {
    if (Number(new URL(snapshot.manifest.launchAssetUrl).port) !== CANONICAL_DEV_METRO_PORT) failures.push('launch asset is not served by port 8081');
  } catch {
    failures.push('launch asset URL is invalid');
  }
  if (failures.length) {
    throw new Error(`CANONICAL DEV METRO CHECK FAILED — ${failures.join('; ')}`);
  }
  return snapshot;
}

export async function certifyCanonicalDevMetro(host = '127.0.0.1') {
  if (!/^[A-Za-z0-9.:-]+$/.test(host)) throw new Error(`Unsupported Metro host: ${host}`);
  const source = inspectCanonicalSource();
  const listener = inspectMetroListener();
  const requestUrl = `http://${host}:${CANONICAL_DEV_METRO_PORT}`;
  const response = await fetch(requestUrl, {
    headers: {
      Accept: 'application/expo+json,application/json',
      'Expo-Platform': 'ios',
    },
  });
  if (!response.ok) throw new Error(`Metro manifest request failed with HTTP ${response.status}`);
  const manifestPayload = await response.json();
  const appConfig = JSON.parse(readFileSync(path.join(CANONICAL_DEV_MOBILE_ROOT, 'app.json'), 'utf8'));
  const snapshot = {
    certifiedAt: new Date().toISOString(),
    requestUrl,
    source,
    listener,
    manifest: {
      id: manifestPayload.id,
      runtimeVersion: manifestPayload.runtimeVersion,
      appVersion: appConfig.expo?.version,
      projectRoot: canonicalPath(manifestPayload.extra?.expoGo?.developer?.projectRoot || ''),
      launchAssetUrl: manifestPayload.launchAsset?.url,
    },
  };
  return assertCanonicalMetroSnapshot(snapshot);
}
