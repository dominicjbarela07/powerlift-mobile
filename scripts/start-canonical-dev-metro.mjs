import { spawn } from 'node:child_process';
import path from 'node:path';
import { assertHumanArtworkGate } from './canonical-art-review-gate.mjs';

import {
  CANONICAL_DEV_METRO_PORT,
  CANONICAL_DEV_MOBILE_ROOT,
  assertCanonicalSource,
  inspectCanonicalSource,
  inspectMetroListener,
} from './canonical-dev-metro-lineage.mjs';

const source = assertCanonicalSource(inspectCanonicalSource());
assertHumanArtworkGate();
const existing = inspectMetroListener();
if (existing.processes.length) {
  throw new Error(`Port ${CANONICAL_DEV_METRO_PORT} is already owned by PID ${existing.processes.map((process) => process.pid).join(', ')}`);
}

console.log('[canonical-dev-metro] SOURCE PREFLIGHT PASS');
if (!source.clean) {
  console.log('[canonical-dev-metro] Working tree contains local changes; Metro will run against current filesystem state.');
}
console.log(JSON.stringify({ port: CANONICAL_DEV_METRO_PORT, ...source }, null, 2));

const expo = path.join(CANONICAL_DEV_MOBILE_ROOT, 'node_modules', '.bin', 'expo');
const child = spawn(expo, ['start', '--port', String(CANONICAL_DEV_METRO_PORT)], {
  cwd: CANONICAL_DEV_MOBILE_ROOT,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  console.error(`[canonical-dev-metro] Expo failed to start: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
