import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  assertProgrammingMutationSubject,
  assertProgrammingResponseSubject,
  programmingSubjectRoute,
  resolveProgrammingSubject,
} from '../lib/programming-subject.ts';

const workspace = (id) => ({ athleteId: id, bootstrap: { subject: { athlete_id: id } } });
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manager = read('app/(tabs)/workout/index.tsx');
const builder = read('app/(tabs)/workout/create-program.tsx');
const session = read('app/(tabs)/workout/session-workspace/[workoutId].tsx');

test('verified workspace owns the subject despite missing or conflicting route selection', () => {
  for (const id of [4, 12]) {
    for (const route of [undefined, '58', ['58'], 'invalid']) {
      assert.deepEqual(resolveProgrammingSubject(workspace(id), route), { athleteId: id, workspaceOwned: true, ready: true });
    }
  }
});

test('unresolved or contradictory workspace never falls back to another athlete or self', () => {
  for (const value of [{ athleteId: 12, bootstrap: null }, { athleteId: 12, bootstrap: workspace(4).bootstrap }]) {
    const subject = resolveProgrammingSubject(value, '4');
    assert.deepEqual(subject, { athleteId: null, workspaceOwned: true, ready: false });
    assert.throws(() => assertProgrammingResponseSubject(subject, 4));
    assert.throws(() => programmingSubjectRoute(subject, 'home'));
  }
});

test('global selection and Individual self inference remain distinct from workspace ownership', () => {
  assert.deepEqual(resolveProgrammingSubject(null, '12'), { athleteId: 12, workspaceOwned: false, ready: true });
  assert.deepEqual(resolveProgrammingSubject(null), { athleteId: null, workspaceOwned: false, ready: true });
  for (const route of ['0', '-1', 'NaN', '1.5']) assert.equal(resolveProgrammingSubject(null, route).ready, false);
});

test('mismatched or missing response identity cannot hydrate programming actions', () => {
  const subject = resolveProgrammingSubject(workspace(12));
  assert.doesNotThrow(() => assertProgrammingResponseSubject(subject, 12));
  for (const id of [4, 58, null, undefined]) assert.throws(() => assertProgrammingResponseSubject(subject, id));
  assert.match(manager, /assertProgrammingResponseSubject[\s\S]*responseHub\?\.athlete\?\.id/);
  assert.match(manager, /requestScopeKey !== trainingScopeRef\.current/);
  assert.match(manager, /key=\{trainingScopeKey\}/);
});

test('workspace mutation preserves both current and requested athlete identity', () => {
  const subject = resolveProgrammingSubject(workspace(12));
  assert.doesNotThrow(() => assertProgrammingMutationSubject(subject, 12, 12));
  for (const pair of [[4, 12], [12, 4], [12, null], [null, 12]]) {
    assert.throws(() => assertProgrammingMutationSubject(subject, ...pair));
  }
  assert.doesNotThrow(() => assertProgrammingMutationSubject(resolveProgrammingSubject(null, '12'), 12, 4));
  assert.match(session, /assertProgrammingMutationSubject\(programmingSubject, payload\.athlete\.id, plan\.athleteId\)/);
  assert.match(session, /plan\.athleteId !== payload\.athlete\.id/);
  assert.match(session, /athleteOptions=\{\[\]\}/);
  assert.match(session, /assertProgrammingResponseSubject[\s\S]*json\.athlete\?\.id/);
});

test('program creation/edit and return remain under the owned workspace and cannot override its athlete', () => {
  const subject = resolveProgrammingSubject(workspace(12), '4');
  assert.deepEqual(programmingSubjectRoute(subject, 'create-program', { mode: 'edit', programId: '21', athleteId: '4' }), {
    pathname: '/(tabs)/coach-athlete/[athleteId]/training/create-program',
    params: { mode: 'edit', programId: '21', athleteId: '12' },
  });
  assert.deepEqual(programmingSubjectRoute(subject, 'home', { programCreated: '21' }), {
    pathname: '/(tabs)/coach-athlete/[athleteId]/training', params: { programCreated: '21', athleteId: '12' },
  });
  assert.match(builder, /resolveProgrammingSubject\(athleteWorkspace, params\.athleteId\)/);
  assert.equal((builder.match(/programmingSubjectRoute\(programmingSubject, 'home'/g) || []).length, 2);
  assert.match(read('app/(tabs)/coach-athlete/[athleteId]/training/create-program.tsx'), /key=\{workspace\.subjectKey\}/);
});

test('global and Individual builder routes and return destinations are preserved', () => {
  for (const route of [undefined, '12']) {
    const subject = resolveProgrammingSubject(null, route);
    assert.equal(programmingSubjectRoute(subject, 'home').pathname, '/(tabs)/workout');
    assert.equal(programmingSubjectRoute(subject, 'create-program').pathname, '/(tabs)/workout/create-program');
  }
});

test('scoped picker is absent, cannot fetch the roster, and cannot switch subjects through its handler', () => {
  assert.match(manager, /const canSelectAthlete = coachMode && !focusedWorkspace/);
  assert.match(manager, /\{canSelectAthlete \? <Pressable[\s\S]*accessibilityLabel="Switch athlete"/);
  assert.match(manager, /\{canSelectAthlete \? <StoryboardSheet visible=\{sheet === 'athletes'\}/);
  assert.match(manager, /if \(sheet !== 'athletes' \|\| !canSelectAthlete/);
  assert.match(manager, /const selectAthlete = \(id: number\) => \{\s*if \(!canSelectAthlete\) return;/);
  assert.match(manager, /router\.replace\(\{ pathname: '\/\(tabs\)\/workout', params: \{ athleteId: String\(id\) \}/);
});
