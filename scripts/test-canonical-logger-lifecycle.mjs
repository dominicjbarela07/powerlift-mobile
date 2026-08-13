import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CANONICAL_LOGGER_ENTRY_LIFECYCLES,
  createWorkoutDetailFixture,
  workoutDetailLifecycleForEntryId,
} from '../dev-mocks/fixtures/workout-detail.ts';
import { LIVE_SCREEN_REGISTRY } from '../dev-mocks/live-screen-registry.ts';

const root = process.cwd();
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const routeSource = source('app/(tabs)/workout/[workoutId].tsx');
const movementCardSource = source('components/workout-logger/core-loggers.tsx');
const sessionShellSource = source('components/workout-logger/session-shell.tsx');

const loggerIds = [
  'canonical-logger-pre-session',
  'canonical-logger-active-session',
  'canonical-logger-post-session',
];
const loggerEntries = loggerIds.map((id) => {
  const entry = LIVE_SCREEN_REGISTRY.find((candidate) => candidate.id === id);
  assert.ok(entry, `Missing canonical lifecycle entry: ${id}`);
  return entry;
});

assert.equal(
  LIVE_SCREEN_REGISTRY.some((entry) => entry.id === 'workout-detail'),
  false,
  'The former single canonical logger entry must be replaced.',
);
assert.deepEqual(
  Object.keys(CANONICAL_LOGGER_ENTRY_LIFECYCLES),
  loggerIds,
  'The lifecycle map must enumerate exactly the three canonical logger entries.',
);
assert.deepEqual(
  loggerEntries.map((entry) => entry.title),
  [
    'Canonical Logger — Pre Session',
    'Canonical Logger — Active Session',
    'Canonical Logger — Post Session',
  ],
);
for (const entry of loggerEntries) {
  assert.deepEqual(entry.previewModes, ['live', 'ideal']);
  assert.deepEqual(entry.dataModes, ['live', 'ideal']);
  assert.equal(entry.sourceFile, 'app/(tabs)/workout/[workoutId].tsx');
  assert.equal(entry.idealStateStrategy, 'canonical-design-sandbox');
}

const pre = createWorkoutDetailFixture('primary-squat', 'pre_session');
const active = createWorkoutDetailFixture('primary-squat', 'active_session');
const post = createWorkoutDetailFixture('primary-squat', 'post_session');
const items = (fixture) => [
  ...fixture.workout.core_items,
  ...fixture.workout.accessory_groups.flatMap((group) => group.items),
];
const loggedCount = (fixture) =>
  items(fixture).reduce((total, item) => total + item.set_logs.length, 0);
const plannedCount = (item) =>
  item.planned_sets?.length || Math.max(0, Number(item.sets) || 0);

assert.equal(pre.workout.status, 'assigned');
assert.equal(pre.workout.started_at, null);
assert.equal(pre.workout.completed_duration_seconds, null);
assert.equal(loggedCount(pre), 0, 'Pre Session cannot contain completed work.');
assert.ok(pre.workout.programming_notes, 'Pre Session must include coach preparation context.');
assert.equal(pre.workout.impact_summary, null);

assert.equal(active.workout.status, 'in_progress');
assert.ok(loggedCount(active) > 0, 'Active Session must retain the existing mixed logging state.');
assert.ok(
  items(active).some((item) => item.set_logs.length < plannedCount(item)),
  'Active Session must retain unfinished work.',
);
assert.equal(active.workout.impact_summary, null);

assert.equal(post.workout.status, 'completed');
assert.equal(post.permissions.can_log, false);
assert.ok(post.workout.completed_duration_seconds > 0);
assert.equal(post.workout.impact_summary?.canonically_completed, true);
assert.equal(post.workout.impact_summary?.all_prescribed_work_logged, true);
assert.ok(post.workout.impact_summary?.session_volume_kg > 0);
assert.ok(post.workout.post_session_coach_feedback);
for (const item of items(post)) {
  assert.equal(
    item.set_logs.length,
    plannedCount(item),
    `Post Session must complete every set for ${item.movement}.`,
  );
}
for (const group of post.workout.accessory_groups.filter((candidate) => candidate.group)) {
  const roundCounts = group.items.map((item) => item.set_logs.length);
  assert.ok(roundCounts.length > 1, 'The canonical post-session fixture must contain grouped work.');
  assert.equal(
    new Set(roundCounts).size,
    1,
    `Every movement in Superset ${group.group} must have the same completed round count.`,
  );
}

assert.equal(
  workoutDetailLifecycleForEntryId('canonical-logger-pre-session'),
  'pre_session',
);
assert.equal(
  workoutDetailLifecycleForEntryId('canonical-logger-active-session'),
  'active_session',
);
assert.equal(
  workoutDetailLifecycleForEntryId('canonical-logger-post-session'),
  'post_session',
);
assert.match(routeSource, /workoutDetailLifecycleForEntryId/);
assert.match(
  routeSource,
  /createWorkoutDetailFixture\('primary-squat', idealWorkoutDetailLifecycle\)/,
);
assert.match(
  routeSource,
  /const canLog = canLogFromServer && workout\.status === 'in_progress'/,
  'Completed canonical fixtures must remain unable to expose active logging.',
);
assert.doesNotMatch(
  movementCardSource,
  /preSessionIndex|activeSessionIndex/,
  'Lifecycle cards must not select separate Pre or Active render branches.',
);
assert.match(
  movementCardSource,
  /if \(sessionIndex != null\) \{/,
  'All lifecycle states must enter the shared movement card shell.',
);
assert.match(
  movementCardSource,
  /<MovementCardMaterial[\s\S]*state=\{cardMaterialState\}/,
  'The shared shell must retain the canonical Active Session card material.',
);
assert.match(
  routeSource,
  /\(isPreSession \|\| isActiveSession\) && detailsExpanded[\s\S]*?movementPresentation\.loggerFocus/,
  'Pre Session must render the same planned core hero and plate workspace without enabling logging.',
);
assert.match(
  movementCardSource,
  /const isPreSessionCard = sessionLifecycle === 'pre_session'/,
);
assert.match(
  movementCardSource,
  /const visibleProgressContext = isPreSessionCard[\s\S]*\\? null/,
  'Pre Session must not show logged-performance context.',
);
assert.match(
  movementCardSource,
  /const lifecycleDetailRows = isPreSessionCard[\s\S]*state: 'locked' as const[\s\S]*resultText: null/,
  'Pre Session must expose planned rows without completed results.',
);
assert.equal(
  (routeSource.match(/sessionLifecycle=\{screenMode\}/g) || []).length,
  2,
  'Core and accessory movement cards must receive the same lifecycle state.',
);
assert.equal(
  (routeSource.match(/sessionIndex=\{/g) || []).length,
  2,
  'Core and accessory movement cards must use the shared indexed card shell.',
);
assert.equal(
  (
    routeSource.match(
      /loggerFocus=\{\s*\(isPreSession \|\| isActiveSession\) &&[\s\S]*?movementPresentation\.loggerFocus[\s\S]*?: null\s*\}/g,
    ) || []
  ).length,
  2,
  'Pre and Active Session must receive the same planned workspace while action authorization remains state-driven.',
);
assert.doesNotMatch(
  routeSource,
  /isIdealWorkoutDetailPreview && isActiveSession && styles\.canonicalMovementList/,
  'Canonical card spacing must not be restricted to Active Session.',
);
assert.equal(
  (routeSource.match(/styles\.canonicalMovementList/g) || []).length,
  2,
  'Core and accessory lists must share canonical lifecycle spacing.',
);
assert.match(
  routeSource,
  /<SessionIntentPanel[\s\S]*workout\.programming_notes[\s\S]*preSessionPrimaryBeginAction[\s\S]*<SessionBeginAction[\s\S]*preSessionPlanTitle/,
  'Pre Session must render summary, session notes, the primary Begin Session action, then the plan.',
);
assert.match(
  routeSource,
  /workout\.accessory_groups\.map[\s\S]*preSessionBottomBeginAction[\s\S]*<SessionBeginAction/,
  'Pre Session must expose a second Begin Session action after the complete plan.',
);
assert.equal(
  (routeSource.match(/<SessionBeginAction/g) || []).length,
  2,
  'Pre Session must expose exactly two shared Begin Session entry points.',
);
assert.equal(
  (routeSource.match(/onBeginWorkout=\{handleBeginWorkoutPress\}/g) || []).length,
  2,
  'Both Begin Session buttons must call the same route handler.',
);
assert.equal(
  (routeSource.match(/const handleBeginWorkoutPress = \(\) =>/g) || []).length,
  1,
  'Session start behavior must remain defined in one handler.',
);
assert.match(
  sessionShellSource,
  /export function SessionBeginAction[\s\S]*<SLButton[\s\S]*label="Begin Session"[\s\S]*onPress=\{onBeginWorkout\}/,
  'Both entry points must reuse the approved shared Begin Session button.',
);

console.log('Canonical logger lifecycle fixtures and shared movement cards passed.');
