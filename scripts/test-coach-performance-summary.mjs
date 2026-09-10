import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildPerformanceSummary, performanceRecordDetail, performanceTaskChange, summarizeRecovery } from '../lib/coach-performance-summary.ts';

const data = {
  athlete: { id: 12 }, range: { start_date: '2026-06-13', end_date: '2026-09-10' },
  big_three_arc: { lifts: ['squat', 'bench', 'deadlift'].map((key) => ({
    key, label: key, current_e1rm_kg: 200, change_kg: 20,
    strength_lenses: { comparable_performance: { status: 'supported', kind: 'more_weight_same_reps',
      from: { weight_kg: 100, reps: 5, date: '2026-09-01' }, to: { weight_kg: 105, reps: 5, date: '2026-09-10' } } },
  })) },
  consistency: { sessions_completed: 8, sessions_assigned: 10, completion_rate_pct: 80 },
  coaching_context: { period_days: 90, working_sets: 200, volume_change_pct: 20, comparison: { set_count: 180 },
    bodyweight: [], readiness: [], latest_readiness: null },
};
const progress = (id, gain = 5, occurred_on = '2026-09-10') => ({
  movement_id: id, identity_key: `${id}:equipment:1`, occurred_on, assisted: false,
  prior: { weight_kg: 100, reps: 10, rir: 2, equipment_identity_id: 1 },
  current: { weight_kg: 100 + gain, reps: 10, rir: 2, equipment_identity_id: 1 },
  comparison: { state: 'improved', load_delta_kg: gain, reps_delta: 0, load_direction: 'higher_is_better' },
});
const movement = (id, gain = 5, occurred_on = '2026-09-10') => ({
  core_movement_id: id, name: `Variant ${id}`, family: 'squat', parent_lift_label: 'Squat',
  latest_progression: { kind: 'more_weight_same_reps', load_delta_kg: gain, reps_delta: 0, occurred_on,
    prior: { weight_kg: 100, reps: 5 }, current: { weight_kg: 100 + gain, reps: 5 } },
});
const exploration = { athlete: { id: 12 }, accessories: {
  summary: { movement_count: 5 }, movements: [1, 2, 3, 4, 5].map((id) => ({ id, name: `Accessory ${id}` })),
  progress: [progress(1, 10), progress(2, 9), progress(3, 8), progress(4, 5), progress(5, 5)],
} };
const variants = { athlete: { id: 12 }, families: [], movements: [movement(101, 10), movement(102, 5), movement(103, 5)] };
const input = { data, exploration, variants, unit: 'lb' };
const frozen = JSON.stringify(input);
const model = buildPerformanceSummary(input);
assert.equal(model.accessoryPreview.length, 2);
assert.equal(model.variantPreview.length, 1);
assert.equal(model.observationPreview.length, 3);
assert.equal(new Set(model.observationPreview.map((o) => o.kind)).size, 3, 'One signal per category, not three competition estimates.');
assert.ok(model.observations.length > 3, 'Additional supported observations remain available in disclosure.');
for (const p of model.accessoryPreview) assert.ok(!model.observations.some((o) => o.id === `accessory:${p.identity_key}`));
for (const m of model.variantPreview) assert.ok(!model.observations.some((o) => o.id === `variant:${m.core_movement_id}`));
assert.ok(model.observations.every((o) => !/estimate/.test(o.detail)), 'Hero estimates are not re-emitted as observations.');

// API ordering and display units must not change the ranked identities or canonical evidence.
const ids = (m) => [m.accessoryPreview.map((p) => p.identity_key), m.variantPreview.map((p) => p.core_movement_id), m.observations.map((o) => o.id)];
const shuffled = structuredClone(input);
shuffled.data.big_three_arc.lifts.reverse(); shuffled.exploration.accessories.progress.reverse(); shuffled.variants.movements.reverse();
assert.deepEqual(ids(buildPerformanceSummary(shuffled)), ids(model));
assert.deepEqual(ids(buildPerformanceSummary({ ...input, unit: 'kg' })), ids(model));
assert.deepEqual(buildPerformanceSummary({ ...input, unit: 'lb' }), model);
assert.equal(JSON.stringify(input), frozen);

// Recent strong evidence beats equally strong old evidence; outside-period evidence is excluded.
const recency = structuredClone(input);
recency.exploration.accessories.progress = [progress(1, 5, '2026-08-01'), progress(2, 5), progress(3, 30, '2026-06-12')];
assert.deepEqual(buildPerformanceSummary(recency).accessoryPreview.map((p) => p.movement_id), [2, 1]);
recency.exploration.accessories.progress.push({ ...progress(2, 5), identity_key: '2:equipment:2' });
assert.equal(buildPerformanceSummary(recency).accessoryPreview.length, 2, 'Multiple equipment records do not crowd out distinct movements.');

// Less assistance is improvement; extra assistance by itself is not. Identity must resolve.
const assistance = structuredClone(input);
assistance.exploration.accessories.progress = [progress(1, -10), progress(2, 10), progress(99, 50)];
for (const p of assistance.exploration.accessories.progress) { p.assisted = true; p.comparison.load_direction = 'lower_is_better'; }
assert.deepEqual(buildPerformanceSummary(assistance).accessoryPreview.map((p) => p.movement_id), [1]);
const invalidVariant = structuredClone(input);
invalidVariant.variants.movements = [{ ...movement(0), family: 'squat' }, { ...movement(105), family: 'quads' }];
assert.deepEqual(buildPerformanceSummary(invalidVariant).variantPreview, []);

// The summary cannot render a late previous-athlete supplemental response.
for (const name of ['exploration', 'variants']) {
  const stale = structuredClone(input); stale[name].athlete.id = 4;
  const result = buildPerformanceSummary(stale);
  assert.equal(result[name === 'exploration' ? 'accessories' : 'core'], null);
  assert.equal(result[name === 'exploration' ? 'accessoryPreview' : 'variantPreview'].length, 0);
}
const empty = structuredClone(data);
empty.big_three_arc.lifts = [];
empty.consistency = { sessions_assigned: 0 };
empty.coaching_context.working_sets = 0; empty.coaching_context.volume_change_pct = null;
const emptyModel = buildPerformanceSummary({ data: empty, exploration: null, variants: null, unit: 'kg' });
assert.equal(emptyModel.hasOutput, false); assert.equal(emptyModel.hasRecovery, false); assert.equal(emptyModel.hasSupplemental, false);
assert.deepEqual(emptyModel.observationPreview, []);
const accessoryOnly = buildPerformanceSummary({ data: empty, exploration, variants: null, unit: 'kg' });
assert.equal(accessoryOnly.hasSupplemental, true); assert.equal(accessoryOnly.accessoryPreview.length, 2);
assert.equal(buildPerformanceSummary({ data: null, exploration, variants, unit: 'kg' }).hasSupplemental, false);

// A 7-day mean uses actual reported days, not missing days as zero or a stale latest check-in.
const recoveryData = structuredClone(empty);
recoveryData.coaching_context.readiness = [
  { date: '2026-09-01', value: 4 }, { date: '2026-09-03', value: 4 },
  { date: '2026-09-04', value: 1 }, { date: '2026-09-04', value: 2 },
  { date: '2026-09-10', value: 3 }, { date: '2026-09-11', value: 5 }, { date: '2026-09-08', value: 0 },
];
recoveryData.coaching_context.bodyweight = [
  { training_date: '2026-09-10', reported_bodyweight_kg: 90 }, { training_date: '2026-07-01', reported_bodyweight_kg: 92 },
  { training_date: '2026-06-01', reported_bodyweight_kg: 100 }, { training_date: '2026-09-09', reported_bodyweight_kg: Infinity },
];
recoveryData.coaching_context.latest_readiness = { date: '2026-09-10', sleep_hours: 5, energy: 2, stress: 4, soreness: null, sleep_quality: null };
const recovery = summarizeRecovery(recoveryData);
assert.equal(recovery.recentAverage, 2.5); assert.equal(recovery.recentCount, 2); assert.equal(recovery.readinessChange, -1.5);
assert.equal(recovery.latestWeight, 90); assert.equal(recovery.weightChange, -2);
assert.deepEqual(recovery.checkIn.map((c) => c.label), ['Sleep', 'Energy']);
assert.equal(buildPerformanceSummary({ ...input, data: recoveryData }).observationPreview[0].kind, 'readiness', 'Material recovery change receives priority.');
recoveryData.coaching_context.readiness = [{ date: '2026-09-10', value: 3 }];
recoveryData.coaching_context.latest_readiness.date = '2026-06-01';
assert.equal(summarizeRecovery(recoveryData).readinessChange, null);
assert.equal(summarizeRecovery(recoveryData).checkIn.length, 0);

assert.equal(performanceTaskChange({ weight_kg: 100, reps: 5, rir: 1 }, { weight_kg: 100, reps: 5, rir: 3 }, 'kg'), '100 kg × 5 · RIR 1 → 3');
assert.equal(performanceTaskChange({ weight_kg: 100, reps: 5, rpe: 9 }, { weight_kg: 100, reps: 5, rpe: 8 }, 'kg'), '100 kg × 5 · RPE 9 → 8');
assert.match(performanceTaskChange({ weight_kg: 100, reps: 5 }, { weight_kg: 105, reps: 5 }, 'lb'), /220.5 lb.*231.5 lb/);
const pr = { event_type: 'CORE_E1RM_PR', movement_label: 'Squat', current_value: 100, unit: 'kg' };
assert.equal(performanceRecordDetail(pr, 'lb'), 'Squat · Estimated 1RM PR · 220.5 lb');
assert.equal(performanceRecordDetail({ ...pr, event_type: 'CORE_REP_MAX_PR', evidence: { rep_count: 3 } }, 'kg'), 'Squat · 3-rep max PR · 100 kg');

// Permanent copy and bounded-summary contract. Canonical destination labels are allowed.
const root = new URL('../components/coach-mobile/athlete-workspace/', import.meta.url);
for (const filename of readdirSync(root).filter((name) => /\.tsx?$/.test(name))) {
  const source = readFileSync(new URL(filename, root), 'utf8');
  assert.doesNotMatch(source, /earned,? not given|built different|the grind|proof of the work|greatness earned|your legacy|the long game|in their corner|look how far they|next training chapter/i, filename);
  assert.doesNotMatch(source, /THE ATHLETE RECORD/, filename);
}
const screen = readFileSync(new URL('CoachAthletePerformance.tsx', root), 'utf8');
assert.match(screen, /workspaceLedgerParams\(athleteId\)/);
assert.match(screen, /performanceScrollY/);
assert.match(screen, /!model\.accessories\?\.summary\.movement_count/);
assert.match(screen, /!model\.core\?\.movements\.length/);
assert.doesNotMatch(screen, /fetchLedgerAccomplishmentHistory|fetchAllArchive|readiness\.map/);
console.log('Performance synthesis: ranking, diversity, bounded disclosure, identity, dates, recovery, assistance, effort, units and copy PASS.');
