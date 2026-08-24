#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coachComingUpProgrammingDestination } from '../lib/coach-mobile.ts';
import { resolveProgrammingSessionDeepOpen } from '../lib/programming-session-deep-open.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const home = read('components', 'coach-mobile', 'CoachActivityHome.tsx');
const manager = read('app', '(tabs)', 'workout', 'index.tsx');
const service = read('..', 'app', 'services', 'coach_home_activity.py');

assert.match(service, /"destination": \{"route": "\/\(tabs\)\/workout", "params": \{"workoutId": int\(workout\.id\), "athleteId": int\(athlete\.id\)\}\}/);
assert.match(home, /openComingUpSession\(session\)/);
assert.match(manager, /workoutId\?: string/);
assert.match(manager, /key=\{trainingScopeKey\}/, 'athlete changes must reset stale child workspace state');
assert.match(manager, /resolveProgrammingSessionDeepOpen/);
assert.match(manager, /router\.setParams\(\{ workoutId: undefined, programId: undefined \}/);
assert.match(manager, /if \(!intentKey\) \{[\s\S]*?consumedDirectOpenRef\.current = null/, 'consumed intent must reset so the same card can open again later');

const fixture = {
  ready: true,
  requestedWorkoutId: 802,
  requestedAthleteId: 12,
  loadedAthleteId: 12,
  requestedProgramId: 51,
  activeProgramId: 51,
  blocks: [{ id: 71, training_program_id: 51, start_date: '2026-08-03', end_date: '2026-09-27' }],
  pendingMap: {
    71: [{ id: 802, training_block_id: 71, date: '2026-08-25', status: 'assigned', title: 'W5 Lower A' }],
  },
  completedMap: { 71: [] },
};

assert.deepEqual(coachComingUpProgrammingDestination({
  athlete: { id: 12, name: 'Athlete' },
  destination: { route: '/(tabs)/workout', params: { athleteId: 999, workoutId: 802 } },
}), {
  route: '/(tabs)/workout',
  params: { athleteId: 12, workoutId: 802 },
});
assert.equal(coachComingUpProgrammingDestination({
  athlete: { id: 12, name: 'Athlete' },
  destination: { route: '/(tabs)/workout', params: { athleteId: 12 } },
}), null, 'Coming Up must fail closed without a stable workout id');
assert.deepEqual(resolveProgrammingSessionDeepOpen({ ...fixture, ready: false }), { state: 'pending' });
assert.deepEqual(resolveProgrammingSessionDeepOpen(fixture), {
  state: 'open',
  workoutId: 802,
  context: { blockId: 71, week: 4, day: '2026-08-25' },
});
assert.deepEqual(resolveProgrammingSessionDeepOpen({ ...fixture, loadedAthleteId: 99 }), { state: 'rejected', reason: 'athlete' });
assert.deepEqual(resolveProgrammingSessionDeepOpen({ ...fixture, activeProgramId: 52 }), { state: 'rejected', reason: 'program' });
assert.deepEqual(resolveProgrammingSessionDeepOpen({ ...fixture, requestedWorkoutId: 999 }), { state: 'rejected', reason: 'session' });
assert.deepEqual(resolveProgrammingSessionDeepOpen({
  ...fixture,
  pendingMap: { 71: [] },
  completedMap: { 71: [{ ...fixture.pendingMap[71][0], status: 'completed' }] },
}), { state: 'rejected', reason: 'lifecycle' });

console.log('[coach-home-coming-up-direct-open] ok');
