import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
const telemetry = fs.readFileSync(path.join(root, 'lib/session-timing-telemetry.ts'), 'utf8');
const telemetryCore = fs.readFileSync(path.join(root, 'lib/session-timing-telemetry-core.ts'), 'utf8');

assert.match(telemetryCore, /Math\.max\(prior, wallElapsed\)/,
  'restart rebasing must never move elapsed time backwards');
assert.match(telemetryCore, /foreground \? 'app_foregrounded' : 'app_backgrounded'/,
  'AppState transitions must retain explicit foreground/background semantics');
assert.match(telemetryCore, /pending\.some\(\(row\) => row\.event\.client_event_id === candidate\.event\.client_event_id\)/,
  'pending lifecycle evidence must deduplicate by stable event identity');

assert.match(layout, /initializeSessionTimingTelemetry\(\)/, 'root shell must own telemetry initialization');
assert.match(telemetry, /AppState\.addEventListener\('change'/, 'AppState telemetry must be centralized');
assert.match(telemetry, /AsyncStorage\.setItem\(STORAGE_KEY/, 'active timing state must survive restart');
assert.match(telemetry, /pendingEvents/, 'offline lifecycle evidence must retain stable retry events');
assert.match(telemetry, /state\.activeWorkoutId === normalizedWorkoutId && state\.sessionStartedEvent/,
  'ambiguous Begin retries must reuse the same Session-start event');
assert.doesNotMatch(route, /catch \(err\) \{\s*if \(timingPrepared\) await discardPreparedSessionTiming/,
  'an ambiguous Begin response must not discard its stable event identity');
assert.match(route, /prepareSessionStartTiming\(wkId\)[\s\S]*timing_event: timingEvent/);
assert.match(route, /createLifecycleTimingEvent\(wkId, 'session_completed', \{[\s\S]*reasonCode: 'performed_duration_unavailable'/,
  'duration-unavailable completion must retain lifecycle telemetry without claiming performed elapsed time');
assert.match(route, /createLifecycleTimingEvent\(wkId, 'session_canceled'\)/);
assert.equal((route.match(/createPerformedSetTiming\(/g) || []).length, 5,
  'every SetLog writer present in Production 2.0.2 must emit performed timing');
assert.match(route, /prescribedRestSecondsForItem[\s\S]*prescribed_rest_seconds[\s\S]*rest_prescription_seconds/);
assert.doesNotMatch(route, /createPerformedSetTiming\([^)]*sessionRestTimerSeconds/,
  'ad-hoc rest timer selection must not masquerade as programmed rest');

console.log('Session timing telemetry contracts passed.');
