import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { sessionLoggerSharedHeaderShown } from '../lib/session-logger-shell.ts';

const root = resolve(import.meta.dirname, '..');
const logger = readFileSync(resolve(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const tabs = readFileSync(resolve(root, 'app/(tabs)/_layout.tsx'), 'utf8');

const lifecycle = [
  { mode: 'loading', hasCompletedRecap: false, shown: true },
  { mode: 'active_session', hasCompletedRecap: false, shown: true },
  { mode: 'finished_session', hasCompletedRecap: true, shown: false },
  { mode: 'loading', hasCompletedRecap: false, shown: true },
  { mode: 'pre_session', hasCompletedRecap: false, shown: true },
  { mode: 'error', hasCompletedRecap: false, shown: true },
];

for (const state of lifecycle) {
  assert.equal(
    sessionLoggerSharedHeaderShown(state),
    state.shown,
    `${state.mode} must ${state.shown ? 'use' : 'yield to'} the shared app header`,
  );
}

const loggerRegistration = tabs.match(/name="workout\/\[workoutId\]"[\s\S]*?<Tabs\.Screen/)?.[0] || '';
assert.ok(loggerRegistration, 'the canonical Logger route must be registered in the shared Tabs shell');
assert.doesNotMatch(
  loggerRegistration,
  /headerShown:\s*false/,
  'the route registration must not suppress the canonical app header',
);
assert.match(
  logger,
  /sessionLoggerSharedHeaderShown\([\s\S]*mode:\s*loggerShellMode[\s\S]*hasCompletedRecap:/,
  'every Logger lifecycle must derive header ownership from one shell-state contract',
);
assert.match(
  logger,
  /if \(loading && !data\)[\s\S]*?<Tabs\.Screen options=\{\{ headerShown: loggerHeaderShown \}\}/,
  'the loading state must actively restore shared header ownership',
);
assert.match(
  logger,
  /if \(!data\)[\s\S]*?<Tabs\.Screen options=\{\{ headerShown: loggerHeaderShown \}\}/,
  'the error state must actively restore shared header ownership',
);
assert.match(
  logger,
  /<View style=\{styles\.screen\}>[\s\S]*?<Tabs\.Screen options=\{\{ headerShown: loggerHeaderShown \}\}/,
  'the normal Logger must actively restore shared header ownership after recap reuse',
);
assert.doesNotMatch(
  logger,
  /<Tabs\.Screen options=\{\{ headerShown: false \}\}/,
  'the old one-way header suppression override must not survive',
);

console.log('[session-logger-shell-state] shared header ownership survives recap, loading, active, and error transitions');
