import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const component = fs.readFileSync(path.join(root, 'components/coach-mobile/CompletedSessionRecap.tsx'), 'utf8');
const athleteRoute = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const coachRoute = fs.readFileSync(path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');
const certification = fs.readFileSync(path.join(root, 'app/dev-session-recap-certification.tsx'), 'utf8');
const recapAssets = fs.readFileSync(path.join(root, 'lib/session-recap-assets.ts'), 'utf8');

assert.match(component, /recap\.performed_movements\.map/, 'performed SetLog projections must drive the primary movement list');
assert.match(component, /actual_weight_kg/, 'actual load evidence must render');
assert.match(component, /actual_reps/, 'actual rep evidence must render');
assert.match(component, /actual_rpe/, 'RPE evidence must render');
assert.match(component, /actual_rir/, 'RIR evidence must render');
assert.match(component, /video_attachment_id/, 'video evidence must remain reachable');
assert.match(component, /recap\.accomplishments/, 'accomplishments must render');
assert.match(component, /recap\.reflection/, 'athlete reflection must render');
assert.match(component, /recap\.coach_feedback/, 'coach feedback must render');
assert.match(component, /export type RecapTab = 'overview' \| 'performed' \| 'plan' \| 'coach'/, 'the shared surface must expose the governed role-aware lenses');
assert.match(component, /viewerMode === 'coach' \? \[\{ key: 'coach' as const/, 'the Coach lens must remain role-gated');
assert.match(component, /superset_group/, 'superset context must be preserved');
assert.doesNotMatch(component, /Evidence recorded/, 'movement cards must render performance instead of database-state filler');
assert.doesNotMatch(component, /0 COMPARABLE/, 'the UI must not claim zero history from an unwired contract');
assert.match(component, /FIRST EXACT EXPOSURE/, 'one exact performance must have a truthful first-exposure state');
assert.match(component, /showPerfectPlan = Number\(recapHighlights\.prescribed_set_count \|\| 0\) > 0/, 'Perfect Plan must require a non-zero prescription denominator');
assert.match(component, /<ProgrammingMuscleRegionArt level="session"/, 'hero and focus must render governed regional assets');
assert.match(component, /SESSION_RECAP_ARCHIVE_ART/, 'sparse historical recap must retain its intentional archive treatment');
assert.match(component, /history_diagnostics/, 'DEV exact-history diagnostics must remain inspectable');
assert.match(component, /ManufacturerBrandMark/, 'equipment identity must remain a secondary branded layer');
assert.match(component, /MovementTrendChart/, 'movement cards must use the canonical chart component');
assert.match(component, /@shopify\/react-native-skia/, 'movement trend plots must use the installed native chart stack');
assert.doesNotMatch(component, /<Polyline/, 'movement trends must not regress to bare SVG polylines');
assert.doesNotMatch(component, /implementation_key\.replace/, 'internal equipment keys must never be user-facing copy');
assert.match(component, /BEST SET VIDEO/, 'best-set video evidence must be visible in expanded analysis');
assert.match(component, /WHAT CHANGED/, 'Session-level comparison analysis must be present');
assert.match(component, /MOVEMENT PROGRESSION/, 'governed movement progression cards must be present');
assert.match(component, /kind="streak"/, 'the Session Streak must render through the premium highlight artwork component');
assert.match(recapAssets, /streak: require\('@\/assets\/images\/session-recap\/session-streak-medallion-v1\.png'\)/, 'the Session Streak must use the canonical Ledger medallion asset');
assert.match(certification, /const movements = \[/, 'the DEV certification route must use a deterministic full-evidence Session');
assert.equal((certification.match(/movement\(\d+,/g) || []).length, 6, 'the certification Session must contain six canonical movements');
assert.equal((certification.match(/video: '(hinge|machine)'/g) || []).length, 2, 'the certification Session must contain two video evidence fixtures');
assert.match(certification, /volume_trend:/, 'the certification Session must exercise Session volume history');
assert.match(certification, /readiness_context:/, 'the certification Session must exercise readiness evidence');
assert.match(certification, /coach_feedback:/, 'the certification Session must exercise coach feedback');
assert.match(certification, /history_diagnostics:/, 'the certification Session must expose exact-history diagnostics in DEV');
assert.match(certification, /Machine Shoulder Press/, 'certification must prove movement identity above Newtech equipment');
assert.match(certification, /Machine Lateral Raise/, 'certification must prove movement identity above Matrix equipment');
assert.match(certification, /Leg Extension/, 'certification must prove separate movement history on shared Matrix equipment');
assert.match(certification, /coachReview=\{params\.mode === 'coach'/, 'the certification route must exercise real coach review tools');
assert.match(certification, /params\.tab === 'plan' \? 'plan'/, 'the certification route must exercise Plan\/Compare independently');
assert.match(certification, /params\.tab === 'coach' \? 'coach'/, 'the certification route must exercise the role-gated Coach lens independently');

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
