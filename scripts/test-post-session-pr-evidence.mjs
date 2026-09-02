import assert from 'node:assert/strict';

const {
  buildPersonalBestEvidence,
  finitePrNumber,
} = await import('../lib/post-session-pr-evidence.ts');

const movement = {
  item_id: 12,
  label: 'Competition Bench Press',
  sets: [{ id: 701, actual_weight_kg: 124.738, actual_reps: 4, actual_rpe: 6, actual_rir: null }],
  best_set: { set_log_id: 999, weight_kg: 200, reps: 1 },
};
const common = {
  movement_label: movement.label,
  workout_item_id: 12,
  source_set_log_id: 701,
  current_value: 124.738,
  prior_value: null,
  delta: null,
  unit: 'kg',
  comparison_bucket: 'reps:4',
  evidence: { actual_weight_kg: 124.738, actual_reps: 4, actual_rpe: 6, rep_count: 4 },
};
const grouped = buildPersonalBestEvidence([
  { ...common, id: 1, event_type: 'CORE_REP_MAX_PR', scope: 'career' },
  { ...common, id: 2, event_type: 'CORE_BLOCK_REP_MAX_BEST', scope: 'block' },
], [movement]);

assert.equal(grouped.length, 1, 'career PR and block best from the same SetLog and exact rep bucket must be one coherent card');
assert.deepEqual(grouped[0].scopes.sort(), ['block', 'career']);
assert.equal(grouped[0].record.metric, 'rep_max_load');
assert.equal(grouped[0].record.target_reps, 4);
assert.equal(grouped[0].record.source_set?.reps, 4, 'rep PR evidence must use actual persisted set reps');
assert.equal(grouped[0].record.source_set?.weight_kg, 124.738);
assert.equal(grouped[0].record.current_value, 124.738, 'the generic 125kg PR value remains a load and must never become a rep count');
assert.equal(grouped[0].record.prior_value, null, 'missing prior evidence must remain null');
assert.equal(grouped[0].record.delta, null, 'missing prior evidence must not manufacture a zero-based delta');
assert.equal(finitePrNumber(null), null, 'null is not numeric zero');
assert.equal(finitePrNumber(undefined), null);
assert.equal(finitePrNumber(''), null);

const typed = buildPersonalBestEvidence([{
  ...common,
  id: 3,
  event_type: 'CORE_REP_MAX_PR',
  scope: 'career',
  record_evidence: {
    metric: 'rep_max_load',
    target_reps: 4,
    source_set: { set_log_id: 701, weight_kg: 124.738, reps: 4, rpe: 6 },
    prior_set: { set_log_id: 601, weight_kg: 120.202, reps: 4, rpe: 6, date: '2026-07-01' },
    current_value: 124.738,
    prior_value: 120.202,
    delta: 4.536,
    progression: {
      metric: 'rep_max_load', metric_label: '4RM Progression', metric_unit: 'kg',
      points: [
        { date: '2026-07-01', set_log_id: 601, metric_value: 120.202, weight_kg: 120.202, reps: 4 },
        { date: '2026-08-01', set_log_id: 701, metric_value: 124.738, weight_kg: 124.738, reps: 4, current: true },
      ],
    },
  },
}], [movement])[0];
assert.equal(typed.record.prior_set?.reps, 4);
assert.equal(typed.record.prior_value, 120.202);
assert.equal(typed.record.progression?.metric, 'rep_max_load');
assert.equal(typed.record.progression?.metric_label, '4RM Progression');
assert.notEqual(typed.record.progression?.metric, 'estimated_1rm_kg', 'rep PR cards must never inherit the generic e1RM chart');

const mismatched = buildPersonalBestEvidence([{
  ...common,
  id: 4,
  source_set_log_id: 702,
  event_type: 'CORE_REP_MAX_PR',
  evidence: {},
}], [movement])[0];
assert.equal(mismatched.record.source_set, null, 'a mismatched event must fail closed instead of falling back to movement.best_set');

for (const [eventType, expectedMetric, expectedChart] of [
  ['CORE_WEIGHT_PR', 'max_load', 'Max Load Progression'],
  ['CORE_E1RM_PR', 'estimated_1rm', 'Estimated 1RM Progression'],
  ['CORE_MOVEMENT_VOLUME_PR', 'movement_volume', 'Movement Volume Progression'],
]) {
  const record = buildPersonalBestEvidence([{
    ...common,
    id: eventType,
    event_type: eventType,
    record_evidence: {
      metric: expectedMetric,
      source_set: { set_log_id: 701, weight_kg: 124.738, reps: 4, rpe: 6 },
      current_value: 150,
      prior_set: null,
      prior_value: null,
      progression: { metric: expectedMetric, metric_label: expectedChart, metric_unit: 'kg', points: [{ set_log_id: 701, metric_value: 150, current: true }] },
    },
  }], [movement])[0].record;
  assert.equal(record.metric, expectedMetric);
  assert.equal(record.progression?.metric_label, expectedChart);
}

console.log('post-Session Personal Best typed SetLog evidence, deduplication, null, and chart semantics: PASS');
