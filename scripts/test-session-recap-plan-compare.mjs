import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildSessionRecapComparisons,
  classifySessionRecapSet,
  filterSessionRecapComparisons,
  parseSessionRecapRepTarget,
  sessionRecapTargetGeometry,
  summarizeSessionRecapExecution,
} from '../lib/session-recap-plan-compare.ts';

const recapSource = fs.readFileSync(path.join(process.cwd(), 'components/coach-mobile/CompletedSessionRecap.tsx'), 'utf8');
assert.doesNotMatch(recapSource, /compareIndex/);
assert.match(recapSource, /<ManufacturerBrandMark compact manufacturerName=/);

assert.deepEqual(parseSessionRecapRepTarget('8–10'), { low: 8, high: 10 });
assert.deepEqual(parseSessionRecapRepTarget(12), { low: 12, high: 12 });

const plans = [
  { item_id: 11, label: 'Machine Shoulder Press', sets: 3, reps_text: '8-10', rir_target: 1 },
  { item_id: 12, label: 'Dumbbell Curl', sets: 3, reps_text: '6-8', rir_target: 1 },
];
const performed = [
  {
    item_id: 11,
    label: 'Machine Shoulder Press',
    sets: [
      { id: 101, set_index: 1, actual_weight_kg: 100, actual_reps: 10, actual_rir: 1 },
      { id: 102, set_index: 2, actual_weight_kg: 100, actual_reps: 6, actual_rir: 1 },
      { id: 103, set_index: 3, actual_weight_kg: 90, actual_reps: 11, actual_rir: 1 },
    ],
  },
];
const rows = buildSessionRecapComparisons(plans, performed);
assert.equal(rows.length, 2);
assert.deepEqual(rows[0].comparisons.map((row) => row.kind), ['matched', 'below_target', 'above_target']);
assert.deepEqual(rows[1].comparisons.map((row) => row.kind), ['not_logged', 'not_logged', 'not_logged']);
assert.deepEqual(summarizeSessionRecapExecution(rows), {
  plannedSetCount: 6,
  loggedSetCount: 3,
  loggedPlannedSetCount: 3,
  matchedSetCount: 1,
  differenceSetCount: 2,
  notLoggedSetCount: 3,
  completionPercent: 50,
});
assert.equal(filterSessionRecapComparisons(rows, 'matched').length, 1);
assert.equal(filterSessionRecapComparisons(rows, 'differences').length, 1);
assert.equal(filterSessionRecapComparisons(rows, 'not_logged').length, 1);

const target = sessionRecapTargetGeometry(8, 10, 6);
assert.ok(target);
assert.ok(target.marker < target.targetStart, 'below-target evidence must plot left of the target interval');
const above = sessionRecapTargetGeometry(8, 10, 12);
assert.ok(above.marker > above.targetStart + above.targetWidth, 'above-target evidence must plot right of the target interval');
assert.equal(classifySessionRecapSet({ setIndex: 1, repLow: 8, repHigh: 10, loadLowKg: null, loadHighKg: null, rirTarget: 1, rpeTarget: null }, null), 'not_logged');

const sameLabelWrongIdentity = buildSessionRecapComparisons(
  [{ item_id: 21, label: 'Cable Upright Row', sets: 1, reps: 12 }],
  [{ item_id: 22, label: 'Cable Upright Row', sets: [{ id: 201, actual_reps: 12 }] }],
);
assert.equal(sameLabelWrongIdentity.length, 2, 'display labels must never join planned and performed identities');
assert.equal(sameLabelWrongIdentity[0].comparisons[0].kind, 'not_logged');

console.log('Session Recap Plan / Compare transcript contracts passed.');
