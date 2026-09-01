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

const movementAFirst = buildSupersetRoundModel([
  item(1, 1, 4, [1, 2, 3, 4]),
  item(2, 2, 4),
]);
assert.equal(movementAFirst.loggedRequiredSets, 4);
assert.equal(movementAFirst.totalRequiredSets, 8);
assert.equal(movementAFirst.status, 'in_progress');
assert.deepEqual(
  movementAFirst.movements.map((movement) => ({
    itemId: movement.itemId,
    logged: movement.loggedRequiredSets,
    next: movement.nextSetIndex,
    complete: movement.complete,
  })),
  [
    { itemId: 1, logged: 4, next: null, complete: true },
    { itemId: 2, logged: 0, next: 1, complete: false },
  ],
  'one superset movement may finish before its sibling starts',
);
assert.equal(movementAFirst.suggestedNextItemId, 2);
assert.deepEqual(
  movementAFirst.rounds.map((round) => round.entries.map((entry) => entry.state)),
  [
    ['complete', 'ready'],
    ['complete', 'upcoming'],
    ['complete', 'upcoming'],
    ['complete', 'upcoming'],
  ],
  'only each movement\'s own first missing ordinal is ready',
);

const mixedOrder = buildSupersetRoundModel([
  item(1, 1, 4, [1, 2, 3]),
  item(2, 2, 4, [1, 2]),
]);
assert.deepEqual(mixedOrder.movements.map((movement) => movement.nextSetIndex), [4, 3]);
assert.equal(mixedOrder.loggedRequiredSets, 5);

const unequalCounts = buildSupersetRoundModel([
  item(1, 1, 4, [1, 2, 3, 4]),
  item(2, 2, 3, [1, 2]),
]);
assert.equal(unequalCounts.totalRequiredSets, 7);
assert.equal(unequalCounts.loggedRequiredSets, 6);
assert.deepEqual(unequalCounts.movements.map((movement) => movement.nextSetIndex), [null, 3]);

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
assert.deepEqual(triSet.movements.map((movement) => movement.nextSetIndex), [null, null, 3]);

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
assert.match(
  route,
  /if \(isSuperset && grp\.group\)[\s\S]*?<SupersetRoundWorkspace/,
  'live and Ideal State must render the same canonical superset workspace',
);
assert.match(
  route,
  /<SupersetRoundWorkspace[\s\S]*?onLogMovement=\{\(itemId\) => \{[\s\S]*?candidate\.id === itemId[\s\S]*?openAccessoryWheel\(item\)/,
  'each grouped movement must open the canonical individual Set Logger',
);
assert.match(
  route,
  /const handleAccessorySave = async[\s\S]*?loggedIndexes[\s\S]*?while \(loggedIndexes\.has\(accessorySetIndex\)\) accessorySetIndex \+= 1[\s\S]*?logAccessorySet/,
  'next set identity must derive independently from the selected movement evidence',
);
assert.match(route, /\/items\/\$\{itemId\}\/log_acc/);
assert.match(workspace, /MOVEMENT PROGRESS/);
assert.match(workspace, /Log these movements in any order/);
assert.match(workspace, /model\.movements\.map/);
assert.match(workspace, /onLogMovement\(movement\.itemId\)/);
assert.match(
  workspace,
  /<SLButton[\s\S]*?disableNativePressAnimation[\s\S]*?onPress=\{\(\) => onLogMovement\(movement\.itemId\)\}/,
  'grouped movement logging must not overlap native press animation with Set Logger presentation',
);
assert.match(workspace, /movement\.loggedRequiredSets} \/ \{movement\.requiredSets/);
assert.doesNotMatch(workspace, /Log Round|ROUND TIMELINE|onLogRound/);
assert.match(workspace, /onOpenHistory\(item\.id\)/);
assert.match(
  workspace,
  /<CompactSetTimeline[\s\S]*?movement\.requiredSets[\s\S]*?onEdit:[\s\S]*?onEditSet[\s\S]*?onRemove:[\s\S]*?onDeleteSet/,
  'each superset movement must use the compact timeline while preserving edit/delete authority',
);
assert.match(
  workspace,
  /const canModifyLog = Boolean\([\s\S]*?canLog[\s\S]*?persistedLog[\s\S]*?Number\.isFinite\(Number\(persistedLog\.id\)\)/,
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
  '[superset-rounds] independent pair, mixed order, unequal count, tri-set, giant-set, and persistence wiring guards passed',
);
