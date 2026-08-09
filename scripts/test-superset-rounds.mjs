import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildSupersetRoundModel,
  missingSupersetRoundItemIds,
} from '../lib/superset-rounds.ts';

const item = (id, position, sets, completedRounds = []) => ({
  id,
  movement: `Movement ${id}`,
  sets,
  superset_pos: position,
  set_logs: completedRounds.map((set_index) => ({ set_index })),
});

const untouched = buildSupersetRoundModel([
  item(2, 2, 3),
  item(1, 1, 3),
]);
assert.deepEqual(untouched.items.map((entry) => entry.id), [1, 2]);
assert.equal(untouched.roundCount, 3);
assert.equal(untouched.completedRounds, 0);
assert.equal(untouched.currentRoundIndex, 1);
assert.equal(untouched.status, 'not_started');
assert.deepEqual(untouched.rounds[0].entries.map((entry) => entry.state), ['ready', 'ready']);
assert.deepEqual(missingSupersetRoundItemIds(untouched, 1), [1, 2]);

const partial = buildSupersetRoundModel([
  item(1, 1, 3, [1]),
  item(2, 2, 3),
]);
assert.equal(partial.completedRounds, 0);
assert.equal(partial.currentRoundIndex, 1);
assert.equal(partial.status, 'in_progress');
assert.deepEqual(partial.rounds[0].entries.map((entry) => entry.state), ['complete', 'ready']);
assert.deepEqual(
  missingSupersetRoundItemIds(partial, 1),
  [2],
  'a partial round must only save missing movements and must not create duplicates',
);

const progressed = buildSupersetRoundModel([
  item(1, 1, 3, [1]),
  item(2, 2, 3, [1]),
]);
assert.equal(progressed.completedRounds, 1);
assert.equal(progressed.currentRoundIndex, 2);
assert.equal(progressed.rounds[0].state, 'complete');
assert.equal(progressed.rounds[1].state, 'current');

const triSet = buildSupersetRoundModel([
  item(1, 1, 3, [1, 2, 3]),
  item(2, 2, 2, [1, 2]),
  item(3, 3, 3, [1, 2]),
]);
assert.equal(triSet.roundCount, 3);
assert.equal(triSet.rounds[0].entries.length, 3);
assert.equal(triSet.rounds[2].entries.length, 2);
assert.equal(triSet.currentRoundIndex, 3);
assert.deepEqual(missingSupersetRoundItemIds(triSet, 3), [3]);

const giantSetComplete = buildSupersetRoundModel([
  item(1, 1, 2, [1, 2]),
  item(2, 2, 2, [1, 2]),
  item(3, 3, 2, [1, 2]),
  item(4, 4, 2, [1, 2]),
]);
assert.equal(giantSetComplete.status, 'complete');
assert.equal(giantSetComplete.completedRounds, 2);
assert.equal(giantSetComplete.currentRoundIndex, null);

const root = path.resolve(import.meta.dirname, '..');
const route = fs.readFileSync(
  path.join(root, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const workspace = fs.readFileSync(
  path.join(root, 'components/workout-logger/superset-round-workspace.tsx'),
  'utf8',
);
assert.match(route, /<SupersetRoundWorkspace/);
assert.match(route, /openSupersetRoundLogger/);
assert.match(route, /saveSupersetRound/);
assert.match(route, /if \(!supersetRoundLogger \|\| !data \|\| !workoutId\) return/);
assert.match(route, /isFinalMovement \? finalActionLabel : 'Next Movement'/);
assert.match(route, /hasCompletedMovement \? 'Finish Round' : 'Save Round'/);
assert.match(
  route,
  /if \(isSuperset && grp\.group\)[\s\S]*?<SupersetRoundWorkspace/,
  'live and Ideal State must render the same canonical round workspace',
);
assert.match(
  route,
  /workouts\/mobile\/\$\{workoutId\}\/superset-rounds\/\$\{encodeURIComponent\(supersetRoundLogger\.groupLabel\)\}\/\$\{roundIndex\}/,
  'live grouped rounds must persist through the atomic production endpoint',
);
assert.match(
  route,
  /candidate\.group !== supersetRoundLogger\.groupLabel[\s\S]*alreadyExists[\s\S]*set_logs:/,
  'Save Round must update the grouped fixture in one state transaction and skip duplicates',
);
assert.match(workspace, /TODAY&apos;S WORK/);
assert.match(workspace, /ROUND TIMELINE/);
assert.match(workspace, /Log Round/);
assert.match(workspace, /onOpenHistory\(item\.id\)/);
assert.match(
  workspace,
  /<CompletedSetSwipeRow[\s\S]*?onDelete=\{canModifyLog[\s\S]*?onEdit=\{canModifyLog/,
  'each completed superset movement must reuse the canonical edit/delete swipe gesture',
);
assert.match(
  workspace,
  /canLog[\s\S]*entry\.state === 'complete'[\s\S]*log != null[\s\S]*Number\.isFinite\(Number\(log\.id\)\)/,
  'only persisted completed superset logs may expose mutation gestures',
);
assert.match(
  route,
  /<SupersetRoundWorkspace[\s\S]*?onDeleteSet=\{\(item, log\) =>[\s\S]*?confirmDeleteSet\(item\.id, log as SetLog\)[\s\S]*?onEditSet=\{\(item, log\) =>[\s\S]*?openEditSet\(item\.id, log as SetLog,[\s\S]*?mode: 'rir'/,
  'superset gestures must use the existing confirmed delete and RIR edit flows',
);
assert.match(
  route,
  /const isDevFixtureSet = isIdealWorkoutDetailPreview[\s\S]*?SET_EDITED[\s\S]*?const isDevFixtureSet = isIdealWorkoutDetailPreview[\s\S]*?SET_DELETED/,
  'DEV fixture logs must update locally so synthetic superset set IDs remain editable and deletable',
);
assert.doesNotMatch(
  workspace,
  /CoreMovementLedgerRow/,
  'the unified workspace must not nest individual expandable movement cards',
);

console.log(
  '[superset-rounds] pair, partial round, tri-set, giant-set, and duplicate-log guards passed',
);
