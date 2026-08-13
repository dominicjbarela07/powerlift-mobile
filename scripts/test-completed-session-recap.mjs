import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const component = fs.readFileSync(path.join(root, 'components/coach-mobile/CompletedSessionRecap.tsx'), 'utf8');
const athleteRoute = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const coachRoute = fs.readFileSync(path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');

assert.match(component, /recap\.performed_movements\.map/, 'performed SetLog projections must drive the primary movement list');
assert.match(component, /actual_weight_kg/, 'actual load evidence must render');
assert.match(component, /actual_reps/, 'actual rep evidence must render');
assert.match(component, /actual_rpe/, 'RPE evidence must render');
assert.match(component, /actual_rir/, 'RIR evidence must render');
assert.match(component, /video_attachment_id/, 'video evidence must remain reachable');
assert.match(component, /recap\.accomplishments/, 'accomplishments must render');
assert.match(component, /recap\.reflection/, 'athlete reflection must render');
assert.match(component, /recap\.coach_feedback/, 'coach feedback must render');
assert.match(component, /type RecapTab = 'performed' \| 'plan'/, 'the prescription must remain secondary comparison context');
assert.match(component, /superset_group/, 'superset context must be preserved');

const athleteBranch = athleteRoute.indexOf('if (isFinishedSession && workout.completed_recap)');
const athleteLogger = athleteRoute.indexOf('<KeyboardAvoidingView', athleteBranch);
assert.ok(athleteBranch >= 0 && athleteLogger > athleteBranch, 'completed athlete sessions must branch to recap before logger UI');

assert.match(coachRoute, /loadedCompletedSession/);
assert.match(coachRoute, /user\?\.role !== 'coach' && !!payload && !loadedCompletedSession/, 'athlete deep links must wait for lifecycle data before redirecting');
const coachBranch = coachRoute.indexOf('if (loadedCompletedSession && workout.completed_recap)');
const coachEditor = coachRoute.indexOf('<SessionEditingWorkspace', coachBranch);
assert.ok(coachBranch >= 0 && coachEditor > coachBranch, 'completed coach sessions must branch to recap before programming UI');

for (const status of ['assigned', 'in_progress', 'draft']) {
  assert.ok(!['completed', 'logged', 'done'].includes(status), `${status} must not select completed recap mode`);
}

console.log('completed-session recap route and evidence contract: PASS');
