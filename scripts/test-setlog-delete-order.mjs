import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  canDeletePersistedSetLog,
  latestPersistedSetLogId,
} from '../lib/set-log-delete-order.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const route = read('app/(tabs)/workout/[workoutId].tsx');
const superset = read('components/workout-logger/superset-round-workspace.tsx');
const timeline = read('components/workout-logger/compact-set-timeline.tsx');

const set1 = { id: 101, set_index: 1 };
const set2 = { id: 102, set_index: 2 };
const set3 = { id: 103, set_index: 3 };

assert.equal(latestPersistedSetLogId([set1]), set1.id);
assert.equal(canDeletePersistedSetLog(set1, [set1]), true, 'one logged set is deletable');

assert.equal(canDeletePersistedSetLog(set1, [set1, set2]), false);
assert.equal(canDeletePersistedSetLog(set2, [set1, set2]), true, 'only Set 2 is deletable');

assert.equal(canDeletePersistedSetLog(set1, [set1, set2, set3]), false);
assert.equal(canDeletePersistedSetLog(set2, [set1, set2, set3]), false);
assert.equal(canDeletePersistedSetLog(set3, [set1, set2, set3]), true, 'only Set 3 is deletable');

const afterSet3Delete = [set1, set2];
assert.equal(canDeletePersistedSetLog(set2, afterSet3Delete), true, 'Set 2 becomes deletable immediately');
assert.equal(canDeletePersistedSetLog(set1, afterSet3Delete), false);

const movementA = [{ id: 201, set_index: 1 }];
const movementB = [{ id: 301, set_index: 1 }, { id: 302, set_index: 2 }];
assert.equal(canDeletePersistedSetLog(movementA[0], movementA), true, 'another movement cannot affect eligibility');
assert.equal(canDeletePersistedSetLog(movementB[0], movementB), false);
assert.equal(canDeletePersistedSetLog(movementB[1], movementB), true);

const reopened = JSON.parse(JSON.stringify([set1, set2, set3]));
assert.equal(latestPersistedSetLogId(reopened), set3.id, 'refresh/reopen preserves persisted ordering');
assert.equal(latestPersistedSetLogId([{ id: 401, set_index: 2 }, { id: 402, set_index: 2 }]), 402, 'ID breaks legacy duplicate-index ties');

const deleteGateUses = route.match(/canDeletePersistedSetLog\(log, item\.set_logs\)/g) || [];
assert.equal(deleteGateUses.length, 2, 'Core and Accessory presenters share the delete-order primitive');
assert.match(
  route,
  /onEdit: canLog[\s\S]*?openEditSet\(item\.id, log,[\s\S]*?onDelete: canLog && canDeletePersistedSetLog/,
  'editing remains available independently of delete eligibility',
);
assert.match(
  superset,
  /onEdit: canModifyLog[\s\S]*?onRemove: canModifyLog && persistedLog && canDeletePersistedSetLog\([\s\S]*?movement\.item\.set_logs/,
  'each superset member derives eligibility only from its own SetLogs',
);
assert.match(
  timeline,
  /\{selectedRow\.onRemove \? \([\s\S]*?name="trash-outline"[\s\S]*?: null\}/,
  'the trash affordance is hidden rather than disabled when deletion is unavailable',
);
assert.match(
  route,
  /setEditSetVisible\(false\);[\s\S]*?rememberScroll\(\);[\s\S]*?await fetchWorkout\(\);[\s\S]*?Set deleted · progress recalculated/,
  'successful deletion refreshes the movement immediately without a manual reload',
);

console.log('SetLog reverse-order delete contracts passed.');
