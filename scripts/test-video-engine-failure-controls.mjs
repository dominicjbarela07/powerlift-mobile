import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Mutate only the in-memory module loaded by the actual queue test. DEV source
// and persisted app queues are never modified by this deliberate failure probe.
const probe = spawnSync(process.execPath, ['scripts/test-video-engine-queue.mjs'], {
  encoding: 'utf8', env: { ...process.env, VIDEO_ENGINE_TEST_MUTATION: 'remove-queue-serialization' },
});
assert.equal(probe.status, 1, 'unsafe queue must fail the actual behavioral suite');
assert.match(probe.stderr, /concurrent queue mutations cannot lose either intent/);
console.log('PASS: removing persistence serialization is rejected by the actual concurrent-enqueue test.');
