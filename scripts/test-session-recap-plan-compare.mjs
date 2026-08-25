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
assert.doesNotMatch(recapSource, /compareLargeArtwork/, 'expanded comparison must not repeat the header movement artwork');
assert.equal((recapSource.match(/source=\{artwork\}/g) || []).length, 1, 'each comparison card must render movement artwork only once');
assert.match(recapSource, /<PlanCompareExperience recap=\{recap\}/, 'the active Plan \/ Compare tab must mount the rich transcript');
assert.doesNotMatch(recapSource, /<View style=\{styles\.planStack\}>/, 'the legacy text transcript must not remain an active render path');
assert.match(recapSource, /FloatingDisplayUnitRegistration[\s\S]*session-recap-unit-toggle/, 'Plan \/ Compare must share the floating display-unit control');

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

const customRows = buildSessionRecapComparisons(
  [
    {
      item_id: 31,
      label: 'Competition Squat · Top',
      variant: 'TOP',
      sets: 1,
      reps: 3,
      rpe_target: 8,
    },
    {
      item_id: 32,
      label: 'Competition Squat · Backdown',
      variant: 'FULL_CUSTOM',
      sets: 2,
      planned_sets: [
        { set_index: 1, reps: 5, rpe_target: 7, manual_target_kg: 180, manual_pm_kg: 2.5 },
        { set_index: 2, reps: 4, rpe_target: 8, manual_target_kg: 185, manual_pm_kg: 0 },
      ],
    },
  ],
  [
    {
      item_id: 31,
      label: 'Competition Squat · Top',
      sets: [{ id: 301, set_index: 1, actual_weight_kg: 200, actual_reps: 3, actual_rpe: 8 }],
    },
    {
      item_id: 32,
      label: 'Competition Squat · Backdown',
      sets: [
        { id: 302, set_index: 1, actual_weight_kg: 181, actual_reps: 5, actual_rpe: 7 },
        { id: 303, set_index: 2, actual_weight_kg: 185, actual_reps: 4, actual_rpe: 8 },
        { id: 304, set_index: 3, actual_weight_kg: 175, actual_reps: 5, actual_rpe: 8 },
      ],
    },
  ],
);
assert.equal(customRows[0].plan.variant, 'TOP', 'Core top-set structure remains distinct');
assert.deepEqual(customRows[1].comparisons[0].plan, {
  setIndex: 1,
  repLow: 5,
  repHigh: 5,
  loadLowKg: 177.5,
  loadHighKg: 182.5,
  rirTarget: null,
  rpeTarget: 7,
});
assert.equal(customRows[1].comparisons[0].kind, 'matched', 'custom planned-set load ranges and RPE must compare against immutable evidence');
assert.equal(customRows[1].comparisons[2].kind, 'different_load', 'additional performed sets remain visible as neutral differences');

const substituted = buildSessionRecapComparisons(
  [{ item_id: 41, label: 'Chest-Supported Dumbbell Row', sets: 1, reps_text: '8-10', rir_target: 1 }],
  [{ item_id: 41, label: 'Chest-Supported Machine Row', measurement: { canonical_identity_id: 912 }, equipment: [{ manufacturer: 'Matrix', label: 'Matrix · Selectorized' }], sets: [{ id: 401, set_index: 1, actual_weight_kg: 80, actual_reps: 9, actual_rir: 1 }] }],
);
assert.equal(substituted[0].plan.label, 'Chest-Supported Dumbbell Row');
assert.equal(substituted[0].performed.label, 'Chest-Supported Machine Row');
assert.equal(substituted[0].performed.measurement.canonical_identity_id, 912, 'performed canonical identity must remain authoritative');
assert.equal(substituted[0].performed.equipment[0].manufacturer, 'Matrix', 'performed manufacturer evidence must remain attached');

const sameLabelWrongIdentity = buildSessionRecapComparisons(
  [{ item_id: 21, label: 'Cable Upright Row', sets: 1, reps: 12 }],
  [{ item_id: 22, label: 'Cable Upright Row', sets: [{ id: 201, actual_reps: 12 }] }],
);
assert.equal(sameLabelWrongIdentity.length, 2, 'display labels must never join planned and performed identities');
assert.equal(sameLabelWrongIdentity[0].comparisons[0].kind, 'not_logged');

console.log('Session Recap Plan / Compare transcript contracts passed.');
