import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ApiRequestError,
  criticalMutationFailureMessage,
  shouldSurfaceRequestFailure,
} from '../lib/api-request-policy.ts';
import { createLatestRequestManager } from '../lib/latest-request.ts';

const root = process.cwd();
const loggerSource = fs.readFileSync(
  path.join(root, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const apiSource = fs.readFileSync(path.join(root, 'lib/api.ts'), 'utf8');

const timeout = (importance) => new ApiRequestError({
  kind: 'timeout',
  message: 'Request timed out after 15 seconds. Please try again.',
  method: 'GET',
  path: '/workouts/mobile/1507',
  timeoutMs: 15_000,
  importance,
  requestId: 'mobile-regression-test',
  elapsedMs: 15_001,
});

assert.equal(shouldSurfaceRequestFailure(timeout('background-refresh')), false);
assert.equal(shouldSurfaceRequestFailure(timeout('prefetch')), false);
assert.equal(shouldSurfaceRequestFailure(timeout('critical-mutation')), true);
assert.equal(shouldSurfaceRequestFailure(timeout('foreground-read')), true);

const cancelled = new ApiRequestError({
  kind: 'cancelled',
  message: 'Request cancelled.',
  method: 'GET',
  path: '/workouts/mobile/1507',
  importance: 'foreground-read',
  requestId: 'mobile-cancelled-test',
  elapsedMs: 12,
});
assert.equal(shouldSurfaceRequestFailure(cancelled), false);
assert.equal(cancelled.name, 'AbortError');
assert.match(
  criticalMutationFailureMessage(timeout('critical-mutation'), 'fallback'),
  /Couldn't save this set.*tap Log Set to retry.*mobile-regression-test/,
);

assert.match(apiSource, /X-Strength-Ledger-Request-ID/);
assert.match(apiSource, /kind: 'timeout'/);
assert.match(apiSource, /kind: cancelled \? 'cancelled' : 'network'/);
assert.match(apiSource, /kind: 'malformed-response'/);
assert.match(loggerSource, /reason: 'post_set'/);
assert.match(loggerSource, /requestImportance: silent \|\| opts\?\.reason === 'post_set'/);
assert.match(loggerSource, /shouldSurfaceRequestFailure\(err\) && !silent && !dataRef\.current/);
const fetchWorkoutSource = loggerSource.slice(
  loggerSource.indexOf('const fetchWorkout = useCallback'),
  loggerSource.indexOf('const remountLoggerBody = useCallback'),
);
assert.match(fetchWorkoutSource, /if \(!silent\) setError\(null\);/);
assert.doesNotMatch(fetchWorkoutSource, /\n\s+setError\(null\);/);

const manager = createLatestRequestManager();
let releaseFirst;
const first = manager.run((signal) => new Promise((resolve, reject) => {
  releaseFirst = () => resolve('obsolete');
  signal.addEventListener('abort', () => {
    const error = new Error('cancelled');
    error.name = 'AbortError';
    reject(error);
  });
}));
const second = manager.run(async () => 'latest');
assert.deepEqual(await first, { kind: 'cancelled' });
assert.deepEqual(await second, { kind: 'success', value: 'latest' });
releaseFirst?.();

console.log('Session Logger request policy tests passed');
