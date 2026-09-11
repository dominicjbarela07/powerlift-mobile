import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { acceptsCoachingPerformance, coachingTotalChange, workspaceLedgerParams } from '../lib/coach-performance.ts';

const data = { projection_version: 'coach-performance-v2', athlete: { id: 12 }, workspace_subject: { subject_key: 'coach:1:athlete:12:relationship:7', athlete_id: 12, coach_user_id: 1 }, big_three_arc: { estimated_total_change_kg: 25, lifts: Array.from({ length: 3 }, () => ({ points: [{}, {}] })) } };
assert.equal(acceptsCoachingPerformance(data, data.workspace_subject.subject_key, 12), true);
assert.equal(acceptsCoachingPerformance(data, data.workspace_subject.subject_key, 4), false);
assert.equal(acceptsCoachingPerformance(data, 'coach:1:athlete:12:relationship:8', 12), false);
assert.equal(acceptsCoachingPerformance({ ...data, athlete: { id: 4 } }, data.workspace_subject.subject_key, 12), false);
assert.equal(acceptsCoachingPerformance(null, data.workspace_subject.subject_key, 12), false);
assert.equal(coachingTotalChange(data), 25);
assert.equal(coachingTotalChange({ ...data, big_three_arc: { ...data.big_three_arc, lifts: [{ points: [{}] }, ...data.big_three_arc.lifts.slice(1)] } }), null);
assert.equal(coachingTotalChange(null), null);
assert.deepEqual(workspaceLedgerParams(12), { athleteId: '12', athlete_id: '12', workspaceAthleteId: '12', returnToWorkspace: '1', workspaceReturn: 'performance' });
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [shell, performance, request, training, ledger] = await Promise.all([
  read('components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceShell.tsx'),
  read('components/coach-mobile/athlete-workspace/CoachAthletePerformance.tsx'),
  read('components/coach-mobile/athlete-workspace/useCoachPerformance.ts'),
  read('app/(tabs)/workout/index.tsx'),
  read('components/ledger/athlete-ledger-subject.tsx'),
]);
assert.match(shell, /key: 'performance', label: 'Performance'/);
assert.match(shell, /<SLFloatingNavigationDock/);
assert.match(request, /return \(\) => controller.abort\(\)/);
assert.match(request, /result\?\.key === key/);
assert.match(request, /acceptsCoachingPerformance/);
assert.match(performance, /supplemental-summary/);
assert.doesNotMatch(performance, /fetchLedgerExplorationIndex|fetchLedgerCoreVariants/);
assert.doesNotMatch(performance, /fetchLedgerAccomplishmentHistory/);
assert.match(performance, /<CanonicalMovementArtwork/);
assert.match(training, /const canSelectAthlete = coachMode && !focusedWorkspace/);
assert.match(training, /const selectAthlete = \(id: number\) => \{\s*if \(!canSelectAthlete\) return;/);
assert.match(training, /const saveTraining = focusedWorkspace\?\.setTrainingState/);
assert.match(training, /const scrollY = event\.nativeEvent\.contentOffset\.y; saveTraining\?\.\(\(current\) => \(\{ \.\.\.current, scrollY \}\)\)/);
assert.doesNotMatch(training, /saveTraining\?\.\([\s\S]{0,100}event\.nativeEvent/, 'pooled events must be read before deferred state updates');
assert.match(ledger, /\['evidence', 'performance', 'brief'\]/);
console.log('Coach Performance V2 subject, trajectory, bounded loading, canonical artwork and navigation: PASS');
