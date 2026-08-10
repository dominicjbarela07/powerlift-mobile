import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  accessoryRepeatDraft,
  coreRepeatDraft,
  latestRepeatableSet,
} from '../lib/repeat-last-set.ts';

const richLog = {
  id: 991,
  set_index: 2,
  actual_weight_kg: 102.5,
  actual_reps: 5,
  actual_rpe: 7.5,
  actual_rir: 2.5,
  client_submission_id: 'must-not-copy',
  video_id: 77,
  has_video: true,
  notes: 'must not copy',
  created_at: '2026-08-10T10:00:00Z',
  equipment_manufacturer_id: 4,
};

assert.equal(latestRepeatableSet([{ ...richLog, set_index: 1 }, richLog]), richLog);
assert.equal(latestRepeatableSet([]), null);
assert.deepEqual(coreRepeatDraft(richLog, '225'), {
  weight: '225',
  reps: '5',
  rpe: '7.5',
});
assert.deepEqual(accessoryRepeatDraft(richLog, '225'), {
  weight: '225',
  reps: '5',
  rir: '2.5',
});
assert.deepEqual(Object.keys(coreRepeatDraft(richLog, '225')).sort(), ['reps', 'rpe', 'weight']);
assert.deepEqual(Object.keys(accessoryRepeatDraft(richLog, '225')).sort(), ['reps', 'rir', 'weight']);

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);

assert.match(source, /from '@\/lib\/repeat-last-set'/);
assert.match(source, /visible=\{!!coreWheel\?\.visible\}[\s\S]*coreWheelLastLog \? \([\s\S]*accessibilityLabel="Repeat Last Set"[\s\S]*onPress=\{repeatLastIntoCoreWheel\}/);
assert.match(source, /visible=\{!!accessoryWheel\?\.visible\}[\s\S]*accessoryWheelLastLog \? \([\s\S]*accessibilityLabel="Repeat Last Set"[\s\S]*onPress=\{repeatLastIntoAccessoryWheel\}/);
assert.match(source, /visible=\{Boolean\(supersetRoundLogger\)\}[\s\S]*activeEntry\.repeatLast \? \([\s\S]*Repeat Last Set for \$\{activeEntry\.title\}[\s\S]*repeatLastIntoSupersetEntry\(activeEntry\.itemId\)/);
assert.match(source, /\(item\.set_logs \|\| \[\]\)\.filter\([\s\S]*candidate\.set_index \|\| 0\) < roundIndex/);
assert.match(source, /entry\.itemId === itemId && !entry\.alreadyLogged && entry\.repeatLast/);
assert.match(source, /selectedVideo: null/);
assert.match(source, /const commitCoreWheel = \(\) => \{[\s\S]*setPendingCoreWheelLog\(/);
assert.match(source, /const commitAccessoryWheel = \(\) => \{[\s\S]*setPendingAccessoryLogItemId\(/);
assert.doesNotMatch(source, /const repeatCoreSet =/);
assert.doesNotMatch(source, /const repeatAccessoryLastSet =/);
assert.match(source, /canRepeat: false,[\s\S]*onRepeatLast: undefined/);
assert.match(source, /if \(!skipEquipmentGate && needsEquipmentSelection\(item\)\)/);

console.log('Canonical Set Logger Repeat Last Set regression checks passed.');
