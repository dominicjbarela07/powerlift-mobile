import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createSessionLoggerRecoveryGate,
  sessionLoggerMovementCount,
  validateSessionLoggerPayload,
} from '../lib/session-logger-resume.ts';

const logger = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');

const payload = (id, coreCount, accessoryCounts = [], status = 'in_progress') => ({
  workout: {
    id,
    status,
    core_items: Array.from({ length: coreCount }, (_, index) => ({ id: index + 1 })),
    accessory_groups: accessoryCounts.map((count, groupIndex) => ({
      group: groupIndex,
      items: Array.from({ length: count }, (_, index) => ({ id: 100 + groupIndex * 10 + index })),
    })),
  },
});

const knownGood = payload(1507, 2, [2, 1]);
assert.equal(sessionLoggerMovementCount(knownGood), 5);
assert.deepEqual(
  validateSessionLoggerPayload({
    candidate: payload(1507, 2, [2, 1]),
    current: knownGood,
    requestedWorkoutId: '1507',
  }),
  { ok: true, movementCount: 5 },
);
assert.deepEqual(
  validateSessionLoggerPayload({
    candidate: payload(9999, 2, [2, 1]),
    current: knownGood,
    requestedWorkoutId: '1507',
  }),
  { ok: false, reason: 'wrong_workout' },
  'A stale route response must never replace the active Session.',
);
assert.deepEqual(
  validateSessionLoggerPayload({
    candidate: payload(1507, 0),
    current: knownGood,
    requestedWorkoutId: '1507',
  }),
  { ok: false, reason: 'movement_collection_regressed' },
  'A transient empty foreground response must preserve the known-good movement body.',
);
assert.deepEqual(
  validateSessionLoggerPayload({
    candidate: payload(1507, 0),
    current: null,
    requestedWorkoutId: '1507',
  }),
  { ok: true, movementCount: 0 },
  'A legitimately empty newly loaded Session remains valid.',
);
assert.deepEqual(
  validateSessionLoggerPayload({
    candidate: { workout: { id: 1507, status: 'in_progress', core_items: [], accessory_groups: null } },
    current: knownGood,
    requestedWorkoutId: '1507',
  }),
  { ok: false, reason: 'invalid_movement_collections' },
);

const gate = createSessionLoggerRecoveryGate({
  lifecycleDedupeMs: 600,
  maxBodyRecoveryAttempts: 1,
});
assert.equal(gate.beginLifecycleRecovery(1000), true);
assert.equal(gate.beginLifecycleRecovery(1200), false, 'focus + foreground must coalesce.');
assert.equal(gate.acquireBodyRecovery(), true);
assert.equal(gate.acquireBodyRecovery(), false, 'self-healing must be bounded.');
gate.markBodyHealthy();
assert.equal(gate.acquireBodyRecovery(), true, 'a healthy layout rearms future recovery.');

assert.match(
  logger,
  /previousState !== 'active'[\s\S]*?resumeRefreshRef\.current\(\)/,
  'A real background-to-active transition must invoke the single Logger resume owner.',
);
assert.match(
  logger,
  /useFocusEffect\(useCallback\([\s\S]*?revalidateActiveLogger\('focus'\)/,
  'Returning to the retained Logger route must revalidate the active Session.',
);
assert.match(
  logger,
  /validateSessionLoggerPayload\([\s\S]*?dataRef\.current = payload;[\s\S]*?setData\(payload\)/,
  'A coherent refresh must publish atomically to the event ref and rendered state.',
);
assert.match(
  logger,
  /key=\{`session-logger-body:\$\{workout\.id\}:\$\{bodyRenderGeneration\}`\}/,
  'The retained native body must have a bounded remount generation.',
);
assert.match(
  logger,
  /bodyRecoveryFailed[\s\S]*?Retry Session View/,
  'An unrecovered body must expose an explicit retry instead of staying blank.',
);
assert.doesNotMatch(
  logger,
  /return \(\s*<KeyboardAvoidingView\s+style=\{styles\.screen\}/,
  'The entire Logger must not be owned by stale iOS keyboard padding; keyboard sheets own avoidance.',
);

console.log('Session Logger resume contract passed: coherent foreground refresh, retained-data protection, bounded body recovery, and explicit retry.');
