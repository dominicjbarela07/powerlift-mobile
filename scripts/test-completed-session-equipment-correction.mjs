#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { equipmentSelectionOperation } from '../lib/equipment-selection.ts';

const route = fs.readFileSync('app/(tabs)/workout/[workoutId].tsx', 'utf8');

assert.equal(equipmentSelectionOperation({
  sessionStatus: 'assigned',
  plannedSetCount: 3,
  loggedSetCount: 0,
}), 'configuration');
assert.equal(equipmentSelectionOperation({
  sessionStatus: 'in_progress',
  plannedSetCount: 3,
  loggedSetCount: 1,
}), 'future_sets');
assert.equal(equipmentSelectionOperation({
  sessionStatus: 'in_progress',
  plannedSetCount: 3,
  loggedSetCount: 3,
}), 'evidence_correction');
for (const status of ['completed', 'logged', 'done']) {
  assert.equal(equipmentSelectionOperation({
    sessionStatus: status,
    plannedSetCount: 3,
    loggedSetCount: 1,
  }), 'evidence_correction');
}

const correctionHandler = route.slice(
  route.indexOf('const correctCompletedSessionEquipment'),
  route.indexOf('const submitTardyReason'),
);
assert.match(
  correctionHandler,
  /accessory_groups[\s\S]*flatMap[\s\S]*Number\(item\.id\) === itemId/,
  'completed correction must resolve the exact original WorkoutItem, including a superset member',
);
assert.match(
  correctionHandler,
  /openIdentityPicker\(accessoryItem, \{ kind: 'evidence_correction' \}\)/,
  'completed correction must open the canonical equipment picker directly',
);
assert.doesNotMatch(
  correctionHandler,
  /beginWorkout|status === 'in_progress'|pendingPostSession/,
  'equipment correction must never enter the begin/resume Session lifecycle',
);

const pickerHandler = route.slice(
  route.indexOf('const openIdentityPicker'),
  route.indexOf('const openAccessoryWheel'),
);
assert.match(
  pickerHandler,
  /equipmentSelectionOperation\(\{[\s\S]*sessionStatus:[\s\S]*plannedSetCount:[\s\S]*loggedSetCount:/,
  'one governed operation resolver must separate configuration, future sets, and evidence correction',
);
assert.match(
  pickerHandler,
  /operation === 'future_sets'[\s\S]*Change equipment for upcoming sets\?/,
  'an active partial movement must retain the future-set confirmation',
);
assert.match(
  pickerHandler,
  /operation === 'evidence_correction'[\s\S]*kind: 'evidence_correction'/,
  'an active movement with no future sets must become a correction without reopening the Session',
);

assert.match(
  route,
  /continuation\.kind === 'evidence_correction'[\s\S]*intent: 'evidence_correction'/,
  'completed evidence saves must carry an explicit correction intent',
);
assert.match(
  route,
  /isFinishedSession && workout\.completed_recap && !identityPickerItem/,
  'the same picker must remain mounted over a completed Session without changing its status',
);
assert.match(route, /EQUIPMENT USED FOR/);
assert.match(route, /Which version did you use\?/);
assert.match(route, /Which manufacturer’s machine did you use\?/);
assert.match(
  route,
  /onCorrectEquipment=\{coachPreviewRequested \? undefined : correctCompletedSessionEquipment\}/,
);
assert.doesNotMatch(route, /resumeCompletedSessionForEquipmentCorrection/);
assert.doesNotMatch(route, /Resume Session to correct equipment\?|Resume & Correct/);
assert.doesNotMatch(route, /pendingPostSessionEquipmentItemId/);

console.log('Completed Session equipment correction lifecycle and immutable-evidence contract: PASS');
