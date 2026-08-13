import assert from 'node:assert/strict';

import {
  LIVE_SCREEN_REGISTRY,
  liveScreenAvailability,
} from '../dev-mocks/live-screen-registry.ts';
import { resolveLiveScreenLaunch } from '../dev-mocks/live-screen-resolvers.ts';

const entry = (id) => {
  const value = LIVE_SCREEN_REGISTRY.find((candidate) => candidate.id === id);
  assert.ok(value, `Missing registry entry ${id}`);
  return value;
};

const athlete = {
  id: 11,
  is_coach: false,
  athlete_id: 41,
  has_linked_athlete: true,
  can_access_product: true,
  account_state: 'READY',
};
const coach = {
  id: 12,
  is_coach: true,
  can_access_product: true,
  account_state: 'READY',
  workspace_mode: 'team',
};
const selfCoach = {
  ...coach,
  id: 13,
  workspace_mode: 'individual',
  is_individual_workspace: true,
};

function dependencies(overrides = {}) {
  return {
    fetchJson: async () => ({ ok: false, status: 500, json: null, raw: '' }),
    getAthleteWorkouts: async () => ({ ok: true, pending_map: {}, completed_map: {}, unassigned_pending: [], unassigned_completed: [] }),
    getCoachRoster: async () => ({ ok: true, athletes: [] }),
    getDueCheckIns: async () => ({ ok: true, status: 200, json: { ok: true, due_check_ins: [], recent_submissions: [] }, raw: '' }),
    getMessengerThreads: async () => ({ ok: true, threads: [] }),
    ...overrides,
  };
}

const workout = await resolveLiveScreenLaunch(entry('canonical-logger-active-session'), athlete, dependencies({
  getAthleteWorkouts: async () => ({
    ok: true,
    pending_map: {
      '2026-07-21': [
        { id: 90, label: 'Assigned session', status: 'assigned' },
        { id: 91, label: 'Canonical session', status: 'in_progress' },
      ],
    },
    completed_map: {},
    unassigned_pending: [],
    unassigned_completed: [],
  }),
}));
assert.equal(workout.ok, true);
assert.equal(workout.href.params.workoutId, '91');

const preSession = await resolveLiveScreenLaunch(entry('canonical-logger-pre-session'), athlete, dependencies({
  getAthleteWorkouts: async () => ({
    ok: true,
    pending_map: {
      upcoming: [
        { id: 93, label: 'Active session', status: 'in_progress' },
        { id: 97, label: 'Partially logged session', status: 'incomplete', log_count: 2 },
        { id: 94, label: 'Upcoming session', status: 'assigned', log_count: 0 },
      ],
    },
    completed_map: {},
    unassigned_pending: [],
    unassigned_completed: [],
  }),
}));
assert.equal(preSession.ok, true);
assert.equal(preSession.href.params.workoutId, '94');

const postSession = await resolveLiveScreenLaunch(entry('canonical-logger-post-session'), athlete, dependencies({
  getAthleteWorkouts: async () => ({
    ok: true,
    pending_map: { pending: [{ id: 95, status: 'assigned' }] },
    completed_map: { complete: [{ id: 96, label: 'Canonical completed session', status: 'completed' }] },
    unassigned_pending: [],
    unassigned_completed: [],
  }),
}));
assert.equal(postSession.ok, true);
assert.equal(postSession.href.params.workoutId, '96');

const completion = await resolveLiveScreenLaunch(entry('workout-completion-state'), athlete, dependencies({
  getAthleteWorkouts: async () => ({
    ok: true,
    pending_map: { pending: [{ id: 10 }] },
    completed_map: { complete: [{ id: 92, label: 'Completed session' }] },
    unassigned_pending: [],
    unassigned_completed: [],
  }),
}));
assert.equal(completion.ok, true);
assert.equal(completion.href.params.workoutId, '92');

const noWorkout = await resolveLiveScreenLaunch(entry('canonical-logger-active-session'), athlete, dependencies());
assert.deepEqual(noWorkout, { ok: false, reason: 'No eligible Training Session exists for this authenticated athlete.' });

const coachHistory = await resolveLiveScreenLaunch(entry('session-history'), coach, dependencies({
  getCoachRoster: async () => ({
    ok: true,
    athletes: [
      { id: 12, name: 'Self', is_self: true },
      { id: 77, name: 'Authorized Athlete', is_self: false },
    ],
  }),
}));
assert.equal(coachHistory.ok, true);
assert.equal(coachHistory.href.params.athleteId, '77');

const ownHistory = await resolveLiveScreenLaunch(entry('session-history'), selfCoach, dependencies());
assert.equal(ownHistory.ok, true);
assert.equal(ownHistory.href, '/(tabs)/workout/session-history');

const coachWorkout = await resolveLiveScreenLaunch(entry('session-workspace'), coach, dependencies({
  fetchJson: async () => ({
    ok: true,
    status: 200,
    raw: '',
    json: { ok: true, days: [{ sessions: [{ workout_id: 104, athlete_name: 'Authorized Athlete' }] }] },
  }),
}));
assert.equal(coachWorkout.ok, true);
assert.equal(coachWorkout.href.params.workoutId, '104');

const checkIn = await resolveLiveScreenLaunch(entry('check-in-detail'), athlete, dependencies({
  getDueCheckIns: async () => ({
    ok: true,
    status: 200,
    raw: '',
    json: { ok: true, due_check_ins: [{ id: 31, title: 'Weekly check-in' }], recent_submissions: [] },
  }),
}));
assert.equal(checkIn.ok, true);
assert.equal(checkIn.href.params.submissionId, '31');

const thread = await resolveLiveScreenLaunch(entry('message-thread'), athlete, dependencies({
  getMessengerThreads: async () => ({ ok: true, threads: [{ id: 52, other_user_name: 'Coach' }] }),
}));
assert.equal(thread.ok, true);
assert.equal(thread.href.params.threadId, '52');

assert.equal(liveScreenAvailability(entry('coach-roster'), athlete).available, false);
assert.equal(liveScreenAvailability(entry('coach-roster'), coach).available, true);
assert.equal(liveScreenAvailability(entry('coach-roster'), selfCoach).available, false);
assert.equal(liveScreenAvailability(entry('athlete-home'), coach).available, true, 'Coach accounts retain athlete identity');
assert.equal(liveScreenAvailability(entry('athlete-home'), selfCoach).available, false);
assert.equal(liveScreenAvailability(entry('workout-list'), null).available, false);

console.log('UI Mock Library parameter resolver and account-context tests passed.');
