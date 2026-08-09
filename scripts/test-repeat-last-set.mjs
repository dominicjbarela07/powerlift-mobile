import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const route = fs.readFileSync(
  path.join(root, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const loggerPrimitives = fs.readFileSync(
  path.join(root, 'components/workout-logger/logger-primitives.tsx'),
  'utf8',
);
const coreLoggers = fs.readFileSync(
  path.join(root, 'components/workout-logger/core-loggers.tsx'),
  'utf8',
);

const accessoryRepeatStart = route.indexOf('const repeatAccessoryLastSet');
const accessoryRepeatEnd = route.indexOf('const loadIdentityPicker', accessoryRepeatStart);
assert.ok(accessoryRepeatStart > 0 && accessoryRepeatEnd > accessoryRepeatStart);
const accessoryRepeat = route.slice(accessoryRepeatStart, accessoryRepeatEnd);
assert.match(accessoryRepeat, /lastLogForItem\(item\)/);
assert.match(accessoryRepeat, /weight: toWheelWeight\(last, unit\)/);
assert.match(accessoryRepeat, /reps: last\.actual_reps/);
assert.match(accessoryRepeat, /rir: last\.actual_rir/);
assert.match(accessoryRepeat, /setPendingAccessoryLogItemId\(item\.id\)/);

const coreRepeatStart = route.indexOf('const repeatCoreSet');
const coreRepeatEnd = route.indexOf('const commitCoreWheel', coreRepeatStart);
assert.ok(coreRepeatStart > 0 && coreRepeatEnd > coreRepeatStart);
const coreRepeat = route.slice(coreRepeatStart, coreRepeatEnd);
assert.match(coreRepeat, /toWheelWeight\(previousLog, unit\)/);
assert.match(coreRepeat, /previousLog\.actual_reps/);
assert.match(coreRepeat, /previousLog\.actual_rpe/);
assert.match(coreRepeat, /setPendingCoreWheelLog/);

const accessorySaveStart = route.indexOf('const handleAccessorySave');
const accessorySaveEnd = route.indexOf('const clearTopSet', accessorySaveStart);
assert.ok(accessorySaveStart > 0 && accessorySaveEnd > accessorySaveStart);
const accessorySave = route.slice(accessorySaveStart, accessorySaveEnd);
assert.match(
  accessorySave,
  /equipmentSnapshotForSet\(activeEquipmentIdentity\(accessoryItem\)\)/,
  'repeated accessory sets must snapshot the currently persisted movement equipment identity',
);

assert.match(`${loggerPrimitives}\n${coreLoggers}`, /label="Repeat Last"|>Repeat Last</);

console.log('repeat-last-set tests passed');
