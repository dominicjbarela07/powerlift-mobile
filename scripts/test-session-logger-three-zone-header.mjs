import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalLoggedSetCountForSession,
  deriveSessionElapsedSeconds,
  formatSessionElapsed,
} from '../lib/session-header-metrics.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const workoutRoute = read('app/(tabs)/workout/[workoutId].tsx');
const sessionShell = read('components/workout-logger/session-shell.tsx');
const commandStrip = sessionShell.slice(
  sessionShell.indexOf('export function SessionCommandStrip'),
  sessionShell.indexOf('function SessionTitleStatus'),
);

assert.equal(formatSessionElapsed(42 * 60 + 18), '42:18');
assert.equal(formatSessionElapsed(1 * 3600 + 18 * 60 + 42), '1:18:42');
assert.equal(formatSessionElapsed(-10), '0:00');
assert.equal(deriveSessionElapsedSeconds('2026-08-14T12:00:00Z', Date.parse('2026-08-14T12:42:18Z')), 2538);
assert.equal(deriveSessionElapsedSeconds('2026-08-14T12:00:00', Date.parse('2026-08-14T13:18:42Z')), 4722);
assert.equal(deriveSessionElapsedSeconds('invalid', Date.now()), null);
assert.equal(deriveSessionElapsedSeconds('2026-08-14T12:00:10Z', Date.parse('2026-08-14T12:00:00Z')), 0);

const canonicalStart = '2026-08-14T12:00:00Z';
assert.equal(
  deriveSessionElapsedSeconds(canonicalStart, Date.parse('2026-08-14T12:10:00Z')),
  600,
  'a remount must derive elapsed time from the canonical start rather than mount time',
);
assert.equal(
  deriveSessionElapsedSeconds(canonicalStart, Date.parse('2026-08-14T12:15:30Z')),
  930,
  'foreground reconciliation must include time spent backgrounded',
);

assert.equal(canonicalLoggedSetCountForSession({
  coreItems: [{
    id: 1,
    set_logs: [
      { id: 101, set_index: 1 },
      { id: 102, set_index: 1 },
      { set_index: 2 },
    ],
  }],
  accessoryGroups: [{
    items: [
      { id: 2, set_logs: [{ id: 201, set_index: 1 }, { id: 202, set_index: 2 }] },
      { id: 3, set_logs: [{ id: 301, set_index: 1 }, { id: 302, set_index: 2 }] },
    ],
  }],
}), 5, 'drafts and duplicate set positions must not inflate canonical progress');

assert.equal(commandStrip.match(/testID="session-progress-zone"/g)?.length, 1);
assert.equal(commandStrip.match(/testID="session-elapsed-zone"/g)?.length, 1);
assert.equal(commandStrip.match(/styles\.commandDivider/g)?.length, 2);
assert.match(commandStrip, /testID="session-progress-zone"[\s\S]*styles\.commandTimerBlock[\s\S]*testID="session-elapsed-zone"/);
assert.match(commandStrip, /!restActive[\s\S]*testID="session-rest-timer-idle"[\s\S]*Set Timer/);
assert.match(commandStrip, /restActive[\s\S]*Rest Timer[\s\S]*testID="session-rest-timer-stop"[\s\S]*Stop/);
assert.doesNotMatch(commandStrip, /restSeconds[^\n]*:\s*'—'|restSeconds[^\n]*:\s*"—"/);
assert.match(commandStrip, /restActive && restSeconds <= 10/);
assert.match(commandStrip, /Elapsed session time \$\{sessionElapsedLabel\}/);
assert.match(commandStrip, /if \(!showTimerControls\) return null/);

const clockText = fs.readFileSync(path.join(process.cwd(), 'components/workout-logger/session-clock-text.tsx'), 'utf8');
assert.match(workoutRoute, /startedAt=\{workout.started_at\}/);
assert.match(clockText, /deriveSessionElapsedSeconds\(startedAt, clock.getNow\(\)\)/);
assert.match(clockText, /formatSessionElapsed\(seconds\)/);
assert.match(clockText, /AppState.addEventListener\('change'/);
assert.doesNotMatch(workoutRoute, /setSessionNowMs|setInterval\(/);
assert.match(workoutRoute, /canonicalLoggedSetCountForSession\([\s\S]*coreItems: workout\.core_items[\s\S]*accessoryGroups: workout\.accessory_groups/);
assert.match(workoutRoute, /plannedSetCountForWorkout\(workout\)/);
assert.doesNotMatch(
  sessionShell.slice(sessionShell.indexOf('if (isActiveSession)'), sessionShell.indexOf("return (\n    <View style={[styles.sessionIdentityShell, styles.sessionIdentityPre]")),
  />Elapsed</,
  'elapsed must not remain duplicated in the nearby active-session identity panel',
);

console.log('Canonical Session Logger three-zone in-progress header tests passed.');
