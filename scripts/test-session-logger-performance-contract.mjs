import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createLatestRequestManager } from '../lib/latest-request.ts';

const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');

assert.match(
  logger,
  /createLatestRequestManager<WorkoutPayload>\(\)/,
  'Logger must own one cancellable request generation.',
);
assert.match(
  logger,
  /new URLSearchParams\(\{ history: 'summary' \}\)/,
  'Logger initial load must request bounded summary history.',
);
assert.match(
  logger,
  /fetchJson\([\s\S]*?\{ method: 'GET', auth: true, signal \}/,
  'Logger route fetch must pass its AbortSignal to the network layer.',
);
assert.match(
  logger,
  /String\(payload\.workout\?\.id\) !== requestedWorkoutId/,
  'Logger must reject a response for a different Session identity.',
);
assert.match(
  logger,
  /workoutRequestManagerRef\.current\.cancel\(\);[\s\S]*?dataRef\.current = null;[\s\S]*?setData\(null\);[\s\S]*?\}, \[workoutId\]\);/,
  'Changing Session ID must invalidate the old request and clear its workspace.',
);

const manager = createLatestRequestManager();
let resolveSlow;
const slow = new Promise((resolve) => { resolveSlow = resolve; });
const first = manager.run(async () => slow);
const second = manager.run(async () => ({ workout: { id: 202 } }));
resolveSlow({ workout: { id: 101 } });

assert.deepEqual(await second, {
  kind: 'success',
  value: { workout: { id: 202 } },
});
assert.equal(
  (await first).kind,
  'obsolete',
  'A late response from Session A must never publish after Session B owns the route.',
);

const cancelledManager = createLatestRequestManager();
const pending = cancelledManager.run(
  (signal) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }),
);
cancelledManager.cancel();
assert.equal((await pending).kind, 'cancelled');

console.log('Session Logger performance contract passed: bounded summary payload, ID ownership, abort, and stale-response discard.');
