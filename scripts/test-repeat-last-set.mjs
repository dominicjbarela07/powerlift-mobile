import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  accessoryRepeatDraft,
  coreRepeatDraft,
  latestRepeatableSet,
  repeatSetPreview,
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

assert.equal(latestRepeatableSet([{ ...richLog, id: 990, set_index: 99 }, richLog]), richLog);
assert.equal(latestRepeatableSet([]), null);
assert.equal(latestRepeatableSet(null), null);
assert.equal(
  latestRepeatableSet([
    { ...richLog, id: null, set_index: 1 },
    { ...richLog, id: null, set_index: 3 },
  ])?.set_index,
  3,
);
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
assert.equal(
  repeatSetPreview(richLog, { loadLabel: '225 lb', effort: 'RPE' }),
  '225 lb × 5 · RPE 7.5',
);
assert.equal(
  repeatSetPreview(richLog, { loadLabel: '102.5 kg', effort: 'RIR' }),
  '102.5 kg × 5 · RIR 2.5',
);
assert.equal(
  repeatSetPreview({ ...richLog, actual_rir: 1 }, { loadLabel: 'BW', effort: 'RIR' }),
  'BW × 5 · RIR 1',
);
assert.equal(
  repeatSetPreview({ ...richLog, actual_rir: 1 }, { loadLabel: '25 lb assistance', effort: 'RIR' }),
  '25 lb assistance × 5 · RIR 1',
);

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);

assert.match(source, /from '@\/lib\/repeat-last-set'/);
assert.match(source, /visible=\{!!coreWheel\?\.visible\}[\s\S]*coreWheelLastLog \? \([\s\S]*accessibilityLabel=\{`Repeat Last Set[\s\S]*onPress=\{repeatLastIntoCoreWheel\}/);
assert.match(source, /visible=\{!!accessoryWheel\?\.visible\}[\s\S]*accessoryWheelLastLog \? \([\s\S]*accessibilityLabel=\{`Repeat Last Set[\s\S]*onPress=\{repeatLastIntoAccessoryWheel\}/);
assert.match(source, /visible=\{Boolean\(supersetRoundLogger\)\}[\s\S]*activeEntry\.repeatLast \? \([\s\S]*Repeat Last Set for \$\{activeEntry\.title\}[\s\S]*repeatLastIntoSupersetEntry\(activeEntry\.itemId\)/);
assert.match(source, /\(item\.set_logs \|\| \[\]\)\.filter\([\s\S]*candidate\.set_index \|\| 0\) < roundIndex/);
assert.match(source, /entry\.itemId === repeatItemId && !entry\.alreadyLogged && entry\.repeatLast/);
assert.match(source, /selectedVideo: null/);
assert.match(source, /const queueCoreWheelLog = \(wheel: CoreWheelState\) => \{[\s\S]*kind: wheel\.kind,[\s\S]*setIndex: wheel\.setIndex/);
assert.match(source, /const queueAccessoryWheelLog = \(wheel: AccessoryWheelState\) => \{[\s\S]*setPendingAccessoryLogItemId\(/);
assert.match(source, /const repeatLastIntoCoreWheel = \(\) => \{[\s\S]*queueCoreWheelLog\(repeatedWheel\)/);
assert.match(source, /const repeatLastIntoAccessoryWheel = \(\) => \{[\s\S]*queueAccessoryWheelLog\(repeatedWheel\)/);
assert.match(source, /const repeatLastIntoSupersetEntry = \(itemId: number\) => \{[\s\S]*void saveSupersetRound\(itemId\)/);
assert.match(source, /repeatItemId != null[\s\S]*\[\.\.\.missingItemIds\]\.filter\(\(itemId\) => itemId !== repeatItemId\)/);
assert.match(source, /repeatItemId != null && entry\.itemId !== repeatItemId/);
assert.match(source, /superset-rounds\/\$\{encodeURIComponent\(supersetRoundLogger\.groupLabel\)\}\/\$\{roundIndex\}/);
assert.match(source, /canonicalSetSubmissionControllerRef\.current\.isInFlight\(\)/);
assert.match(source, /style=\{\[styles\.repeatLastSetAction, coreRepeatBusy && styles\.repeatLastSetActionDisabled\]\}/);
assert.match(source, /style=\{\[styles\.repeatLastSetAction, accessoryRepeatBusy && styles\.repeatLastSetActionDisabled\]\}/);
assert.match(source, /<Text style=\{styles\.repeatLastSetSubtitle\}>\{coreWheelRepeatPreview\}<\/Text>/);
assert.match(source, /<Text style=\{styles\.repeatLastSetSubtitle\}>\{accessoryWheelRepeatPreview\}<\/Text>/);
assert.match(source, /<Text style=\{styles\.repeatLastSetSubtitle\}>\{activeEntry\.repeatLast\.preview\}<\/Text>/);
assert.match(source, /repeatLoadLabel\(coreWheelItem, coreWheelLastLog, unit\)/);
assert.match(source, /repeatLoadLabel\(accessoryWheelItem, accessoryWheelLastLog, unit\)/);
assert.match(source, /convention === 'bodyweight_only' \|\| convention === 'no_external_load'/);
assert.match(source, /convention === 'assistance_load' \|\| loadingBehavior === 'assisted'/);
assert.match(source, /if \(!skipEquipmentGate && needsEquipmentSelection\(item\)\)/);
assert.match(source, /\.\.\.equipmentSnapshotForSet\(activeEquipmentIdentity\(item\)\)/);
assert.match(source, /if \(!json\) return;[\s\S]*markAutoAdvanceAfterAcceptedLog\(itemId, json\)/);
assert.match(source, /completionBoundary\.status === 'session_final_set'[\s\S]*if \(isSessionFinalSet\)[\s\S]*setTimerPickerVisible\(false\)[\s\S]*stopRestTimer\(\)/);
assert.match(source, /setEndSessionPromptVisible\(true\)/);
assert.doesNotMatch(source, /const repeatCoreSet =/);
assert.doesNotMatch(source, /const repeatAccessoryLastSet =/);
assert.match(source, /canRepeat: false,[\s\S]*onRepeatLast: undefined/);

console.log('Canonical Set Logger Repeat Last Set regression checks passed.');
