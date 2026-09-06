import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiSource = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');
const functionStart = apiSource.indexOf('export async function getUnreadSummary');
const functionEnd = apiSource.indexOf('export async function registerPushToken', functionStart);

assert.notEqual(functionStart, -1, 'getUnreadSummary must remain available');
assert.notEqual(functionEnd, -1, 'getUnreadSummary boundary must remain detectable');

const unreadSummarySource = apiSource.slice(functionStart, functionEnd);
assert.match(
  unreadSummarySource,
  /catch\s*\{[\s\S]*return \{ ok: false, error: 'Network error' \}/,
  'an unreachable backend must degrade the optional unread badge to a failed result'
);
assert.doesNotMatch(
  unreadSummarySource,
  /console\.(?:error|warn)/,
  'background unread polling must never trigger a visible React Native LogBox'
);

console.log('[unread summary resilience] optional badge polling fails quietly when the backend is unavailable');
