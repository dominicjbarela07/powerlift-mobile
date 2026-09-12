import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applicableSessionReadiness, createSessionReadinessStartGate } from '../lib/session-readiness-start.ts';
import { sessionExecutionCapabilities } from '../lib/session-logger-lifecycle.ts';

const subject = {workoutId: 41, athleteId: 12, date: '2026-09-12'};
const row = {id: 7, workout_id: 41, athlete_id: 12, date: subject.date, readiness_score: 3.5};
assert.equal(applicableSessionReadiness(row, subject), true);
assert.equal(applicableSessionReadiness({...row, workout_id: null}, subject), true, 'explicit same-day Session-less observation');
for (const other of [null, {...row, workout_id: 99}, {...row, athlete_id: 13}, {...row, date: '2026-09-11'}, {...row, readiness_score: -1}, {...row, readiness_score: NaN}, {...row, id: null}]) {
  assert.equal(applicableSessionReadiness(other, subject), false, 'stale, sibling and legacy skipped evidence cannot satisfy readiness');
}
assert.equal(applicableSessionReadiness({...row, readiness_score: undefined, score: 3.1}, subject), true, 'canonical Calendar projection');

const gate = createSessionReadinessStartGate();
const open = (preview = false) => gate.open({scope: 'owner12:41:execute', workoutId: 41, preview});
let writes = 0, starts = 0;
let intent = open();
assert.ok(intent);
assert.equal(open(), null, 'double Begin cannot open another intent');
assert.equal(starts, 0, 'opening readiness never starts the Session');
assert.equal(gate.cancel(), true);
assert.equal(await gate.choose(intent, async () => { writes++; }, async () => { starts++; }), false);
assert.deepEqual({writes, starts}, {writes: 0, starts: 0}, 'dismissed/stale intent cannot start');

intent = open();
let release;
const saving = gate.choose(intent, async () => { await new Promise(resolve => { release = resolve; }); writes++; }, async () => { starts++; });
assert.equal(gate.isWorking(), true);
assert.equal(gate.cancel(), false, 'cannot dismiss an accepted in-flight save');
assert.equal(await gate.choose(intent, null, async () => { starts++; }), false, 'Submit/Skip race is serialized');
assert.equal(starts, 0);
release();
assert.equal(await saving, true);
assert.deepEqual({writes, starts}, {writes: 1, starts: 1}, 'persist before begin');
assert.equal(await gate.choose(intent, null, async () => { starts++; }), false, 'accepted intent cannot replay');

intent = open();
await gate.choose(intent, null, async () => { starts++; });
assert.deepEqual({writes, starts}, {writes: 1, starts: 2}, 'Skip performs no readiness write');
intent = open();
await gate.choose(intent, null, async () => { starts++; });
assert.deepEqual({writes, starts}, {writes: 1, starts: 3}, 'existing-readiness Continue performs no duplicate write');

intent = open();
await assert.rejects(gate.choose(intent, async () => { throw new Error('save failed'); }, async () => { starts++; }));
assert.equal(starts, 3);
assert.equal(gate.isCurrent(intent), true, 'failed save remains retryable');
await gate.choose(intent, async () => { writes++; }, async () => { starts++; });
assert.deepEqual({writes, starts}, {writes: 2, starts: 4});

intent = open(true);
assert.equal(await gate.choose(intent, async () => { writes++; }, async () => { starts++; }), false);
assert.deepEqual({writes, starts}, {writes: 2, starts: 4}, 'Coach Preview cannot create readiness or start');
gate.cancel();
intent = open();
const leaving = gate.choose(intent, async () => { await new Promise(resolve => { release = resolve; }); writes++; }, async () => { starts++; });
gate.invalidate(); release();
assert.equal(await leaving, false);
assert.equal(starts, 4, 'ownership/navigation change cannot start the old Session after save');

for (const status of ['in_progress', 'completed']) assert.equal(sessionExecutionCapabilities({status, canLog: true, previewRequested: false}).canBegin, false, 'resume does not enter pre-Session readiness');
const screen = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');
assert.ok(screen.includes('onPress={isPreSession ? () => { void handleBeginWorkoutPress(); }'));
assert.ok(!screen.includes('Check-in · optional'));
assert.ok(screen.includes("onSkip={() => { void chooseReadinessAndBegin('skip'); }}"));
assert.ok(screen.includes('readOnly={isCoachAthletePreview}'));
assert.ok(screen.includes('if (!data?.workout || beginInFlightRef.current) return;'));
assert.ok(screen.includes('beginInFlightRef.current = true;'));
assert.ok(screen.includes('if (executionScopeRef.current !== startScope) return;'));
assert.ok(screen.includes('calendar/day?date='));
assert.ok(!screen.includes('skipped: true'), 'never use legacy fabricated readiness sentinel');
const modal = fs.readFileSync('components/workout-logger/readiness-modal.tsx', 'utf8');
for (const copy of ['Skip & Begin Session', 'Save & Begin Session', 'Continue to Session', 'Readiness already recorded']) assert.ok(modal.includes(copy));
assert.ok(modal.includes('onDismiss={onCancel}'));
assert.ok(modal.includes('disabled={submitting || readOnly}'));
console.log('[session-readiness-start] begin/submit/skip/dismiss, exact existing evidence, retry, double taps, preview and ownership safety PASS');
