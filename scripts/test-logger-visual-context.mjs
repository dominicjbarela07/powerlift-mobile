import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  createWorkoutDetailFixture,
  WORKOUT_DETAIL_FIXTURE_SCENARIOS,
} from '../dev-mocks/fixtures/workout-detail.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const fixture = read('dev-mocks/fixtures/workout-detail.ts');
const visualContext = read('lib/logger-visual-context.ts');
const loggerRoute = read('app/(tabs)/workout/[workoutId].tsx');
const movementComponent = read('components/workout-logger/core-loggers.tsx');
const milestoneRenderAssets = read('lib/barbell/milestone-render-assets.ts');
const loggerRenderAssets = read('lib/barbell/logger-plate-render-assets.ts');
const milestoneScreen = read('app/(tabs)/dev-mocks/milestones.tsx');
const sessionShell = read('components/workout-logger/session-shell.tsx');
const registry = read('dev-mocks/live-screen-registry.ts');
const backend = read('../app/blueprints/workouts.py');

const scenarios = [
  'primary-squat',
  'bench-rep-max',
  'deadlift-prior-session',
  'accessory-minimal',
  'coach-photo-fallback',
  'no-progress-context',
];
for (const scenario of scenarios) {
  assert.match(fixture, new RegExp(`'${scenario}'`), `missing deterministic logger scenario: ${scenario}`);
}
assert.deepEqual(WORKOUT_DETAIL_FIXTURE_SCENARIOS, scenarios);

const scenarioFixtures = Object.fromEntries(
  scenarios.map((scenario) => [scenario, createWorkoutDetailFixture(scenario)]),
);
assert.equal(scenarioFixtures['primary-squat'].workout.core_items[0].lift, 'SQ');
assert.equal(scenarioFixtures['primary-squat'].workout.core_items[0].progress_context.kind, 'weight_pr');
assert.equal(scenarioFixtures['bench-rep-max'].workout.core_items[0].progress_context.kind, 'rep_max');
assert.equal(scenarioFixtures['deadlift-prior-session'].workout.core_items[0].progress_context.kind, 'prior_session');
assert.equal(scenarioFixtures['accessory-minimal'].workout.core_items.length, 0);
assert.equal(scenarioFixtures['accessory-minimal'].workout.accessory_groups[0].items[0].target_low_kg, null);
assert.equal(scenarioFixtures['coach-photo-fallback'].coach.avatar_fixture, null);
assert.equal(scenarioFixtures['no-progress-context'].workout.core_items[0].progress_context, null);
assert.equal(scenarioFixtures['no-progress-context'].workout.core_items[0].lookback_best, null);

assert.match(fixture, /WORKOUT_DETAIL_FIXTURE_SCENARIOS/);
assert.match(fixture, /createWorkoutDetailFixture\([\s\S]*requestedScenario/);
assert.doesNotMatch(fixture, /https?:\/\//, 'the deterministic coach avatar must remain local');
assert.match(loggerRoute, /coach-adrien-avatar\.png/);

for (const asset of ['squat.png', 'bench.png', 'deadlift.png']) {
  assert.match(
    visualContext,
    new RegExp(`lift-icons\\/achievement-material-v2\\/${asset.replace('.', '\\.')}`),
    `logger must reuse the approved ${asset} identity`,
  );
}
assert.match(visualContext, /resolvePlateStackRender/);
assert.match(visualContext, /resolveLoggerPrescribedWeight/);
assert.match(visualContext, /prescribedWeight\.endpoints\.map/);
assert.match(visualContext, /endpoint\.requestedWeight/);
assert.match(visualContext, /endpoint\.requestedUnit/);
assert.match(visualContext, /catalogKeyLb: render\.catalogKeyLb/);
assert.doesNotMatch(visualContext, /resolveLoggerPlateRenderAsset/);
assert.match(visualContext, /qualification === 'qualified'/);
assert.match(visualContext, /kind: 'prior_session'/);
assert.doesNotMatch(visualContext, /e1rm/i);

assert.match(movementComponent, /SLProfileAvatar/);
assert.match(movementComponent, /visualContext\?\.liftIconSource/);
assert.match(movementComponent, /visualContext\?\.plateStack/);
assert.match(movementComponent, /visualContext\?\.progress/);
assert.match(milestoneRenderAssets, /MILESTONE_RENDER_ORIENTATION_STYLE[\s\S]*scaleY: -1/);
assert.doesNotMatch(
  movementComponent,
  /LOGGER_PLATE_RENDER_ORIENTATION_STYLE/,
  'the logger component must not force one orientation onto every render generation',
);
assert.match(movementComponent, /visualContext\.plateStack\.mode === 'range'/);
assert.match(movementComponent, /visualContext\.plateStack\.endpoints\.map/);
assert.match(movementComponent, /endpoint\.plateStack\.presentationStyle/);
assert.doesNotMatch(movementComponent, /movementProgressPlate/);
assert.match(movementComponent, /activeNextSetPlateStage/);
assert.match(loggerRenderAssets, /LOGGER_PLATE_RENDER_ORIENTATION_STYLE[\s\S]*scaleX: -1/);
assert.doesNotMatch(loggerRenderAssets, /LOGGER_PLATE_RENDER_ORIENTATION_STYLE[\s\S]*scaleY/);
assert.match(loggerRenderAssets, /blender-cycles-poc-v1\/mobile-hero-240x160@3x\/squat\/405\.png/);
assert.match(loggerRenderAssets, /source: 'canonical-blender-cycles-poc-v1'/);
assert.match(visualContext, /requestedUnit: endpoint\.requestedUnit/);
assert.doesNotMatch(movementComponent, /activeNextSetPlate(KeyLight|Backlight|FloorReflection|ContactShadow|SleeveHighlight)/);
assert.doesNotMatch(movementComponent, /LinearGradient/);
assert.doesNotMatch(movementComponent, /activeMovementLiftMark/);
assert.match(movementComponent, /activeMovementLiftArtwork/);
assert.match(
  sessionShell,
  /sessionIdentityTitleCol[\s\S]*activeSessionTitle[\s\S]*<SessionTitleStatus screenMode=\{screenMode\} statusLabel=\{statusLabel\}/,
  'active status must be the right-aligned peer of the session title composition',
);
assert.match(milestoneScreen, /milestoneSleeveImage:[\s\S]*MILESTONE_RENDER_ORIENTATION_STYLE/);
assert.match(milestoneScreen, /heroRenderImage:[\s\S]*MILESTONE_RENDER_ORIENTATION_STYLE/);
assert.match(loggerRoute, /movementVisualContextFor/);
assert.match(
  loggerRoute,
  /visualContext=\{movementVisualContextFor\(\s*core,\s*movementPresentation\.renderWeight/,
);
assert.match(loggerRoute, /visualContext=\{movementVisualContextFor\(it\)\}/);
assert.match(loggerRoute, /loggerScenario[\s\S]*createWorkoutDetailFixture\(loggerScenario, idealWorkoutDetailLifecycle\)/);
assert.match(loggerRoute, /<RestTimerFocus/);
assert.match(loggerRoute, /onLogSet:/);
assert.match(registry, /'canonical-logger-pre-session': '\/\(tabs\)\/workout\/990001\?loggerLifecycle=pre_session'/);
assert.match(registry, /'canonical-logger-active-session': '\/\(tabs\)\/workout\/990001\?loggerLifecycle=active_session'/);
assert.match(registry, /'canonical-logger-post-session': '\/\(tabs\)\/workout\/990001\?loggerLifecycle=post_session'/);

assert.match(backend, /active_coach_id_for_athlete\(a\)/);
assert.match(backend, /"avatar_url": _mobile_training_user_avatar_url\(active_coach\)/);
assert.match(backend, /"avatar_uploaded_at": _mobile_training_user_avatar_version\(active_coach\)/);

const avatar = fs.readFileSync(path.join(root, 'assets/images/dev-fixtures/coach-adrien-avatar.png'));
assert.equal(avatar.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(avatar.readUInt32BE(16), 512);
assert.equal(avatar.readUInt32BE(20), 512);

console.log('Canonical logger visual context, local avatar, exact plate loads, and six mock scenarios passed.');
