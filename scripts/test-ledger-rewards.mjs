import assert from 'node:assert/strict';

import {
  canonicalLiftWeightBests,
  canonicalMajorVolumeMedallions,
  canonicalPrHistory,
  canonicalTotal,
  STRENGTH_KG_TO_LB,
  STRENGTH_STANDARD_VERSION,
  projectedStrengthTierState,
  strengthTierRoman,
  strengthTierState,
  supportedStrengthStandard,
  totalClubState,
  TOTAL_TROPHY_TIER_NAMES,
} from '../lib/ledger-rewards.ts';

const thresholds = {
  M: {
    total: [430, 500, 545, 590, 655, 730, 825],
    squat: [150, 175, 195, 215, 240, 275, 315],
    bench: [100, 115, 130, 140, 160, 185, 210],
    deadlift: [180, 205, 225, 240, 265, 295, 330],
  },
  F: {
    total: [240, 280, 305, 335, 375, 430, 495],
    squat: [85, 100, 110, 125, 140, 165, 190],
    bench: [45, 55, 60, 70, 80, 95, 110],
    deadlift: [105, 125, 135, 145, 160, 185, 210],
  },
};
const targetPercentiles = [20, 40, 55, 70, 85, 95, 99];

const standard = (sex) => ({
  status: 'supported',
  version: STRENGTH_STANDARD_VERSION,
  canonical_unit: 'kg',
  display_conversion: STRENGTH_KG_TO_LB,
  sex,
  sex_label: sex === 'M' ? 'Male' : 'Female',
  metrics: Object.fromEntries(Object.entries(thresholds[sex]).map(([metric, values]) => [metric, values.map((thresholdKg, index) => ({
    tier: index + 1,
    name: TOTAL_TROPHY_TIER_NAMES[index],
    target_percentile: targetPercentiles[index],
    actual_percentile: targetPercentiles[index],
    threshold_kg: thresholdKg,
    display_lb: Math.round(thresholdKg * STRENGTH_KG_TO_LB),
  }))])),
});

const best = (projectionId, lift, weightKg, setId, label = lift) => ({
  projection_id: projectionId,
  core_movement_key: lift,
  movement_label: label,
  metric: 'weight',
  best_value: weightKg,
  unit: 'kg',
  event: { id: projectionId, event_type: 'CORE_WEIGHT_PR', source_set_log_id: setId },
});

for (const sex of ['M', 'F']) {
  const resolved = supportedStrengthStandard(standard(sex));
  assert.ok(resolved, `${sex} standard must be supported`);
  for (const metric of ['total', 'squat', 'bench', 'deadlift']) {
    const values = thresholds[sex][metric];
    for (let index = 0; index < values.length; index += 1) {
      const threshold = values[index];
      const below = strengthTierState(threshold - 0.001, metric, resolved, 'kg');
      const exactKg = strengthTierState(threshold, metric, resolved, 'kg');
      const exactLb = strengthTierState(threshold, metric, resolved, 'lb');
      const above = strengthTierState(threshold + 0.001, metric, resolved, 'kg');
      assert.equal(below.earnedTierIndex, index - 1, `${sex} ${metric} tier ${index + 1} must not unlock early`);
      assert.equal(exactKg.earnedTierIndex, index, `${sex} ${metric} tier ${index + 1} must unlock at its exact kg boundary`);
      assert.equal(exactLb.earnedTierIndex, index, `${sex} ${metric} must not change tier when displayed in lb`);
      assert.equal(above.earnedTierIndex, index, `${sex} ${metric} tier ${index + 1} must remain unlocked above its boundary`);
      assert.equal(exactLb.current, Math.round(threshold * STRENGTH_KG_TO_LB));
      assert.equal(exactKg.progress, exactLb.progress, 'display unit must not alter canonical tier progress');
    }
    assert.equal(strengthTierState(values.at(-1) + 100, metric, resolved, 'lb').nextTierIndex, null, `${sex} ${metric} Tier 7 is terminal`);
  }
}

assert.equal(strengthTierState(430, 'total', standard('M'), 'kg').earnedTierIndex, 0);
assert.equal(strengthTierState(430, 'total', standard('F'), 'kg').earnedTierIndex, 5, 'sex-specific ladders must resolve independently');
assert.equal(supportedStrengthStandard({ ...standard('M'), sex: null }), null, 'unknown sex must fail closed');
assert.equal(supportedStrengthStandard({ ...standard('M'), version: 'legacy' }), null, 'unknown standard versions must fail closed');
assert.deepEqual(Array.from({ length: 7 }, (_, index) => strengthTierRoman(index + 1)), ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);

const sparse = canonicalTotal([best(1, 'competition_squat', 180, 101)]);
assert.equal(sparse.complete, false);
assert.equal(sparse.lb, 0, 'partial core-lift evidence must not manufacture a combined total');

const dense = canonicalTotal([
  best(1, 'competition_squat', 200, 101),
  best(2, 'competition_bench', 140, 102),
  best(3, 'competition_deadlift', 240, 103),
]);
assert.equal(dense.complete, true);
assert.equal(dense.kg, 580, 'canonical total must be the unrounded sum of kg evidence');
assert.equal(dense.lb, 1279, 'lb total must be one exact conversion of the canonical kg total');
assert.deepEqual(dense.lifts.map((lift) => lift.sourceSetLogId), [101, 102, 103]);

const clubKg = totalClubState(dense, standard('M'), 'kg');
const clubLb = totalClubState(dense, standard('M'), 'lb');
assert.equal(clubKg.earnedTierIndex, 2);
assert.equal(clubLb.earnedTierIndex, clubKg.earnedTierIndex);
assert.equal(clubKg.nextKg, 590);
assert.equal(clubKg.remainingKg, 10);
assert.equal(clubLb.remaining, 22);
assert.equal(clubLb.progress, clubKg.progress);

const serverStanding = {
  status: 'supported',
  version: STRENGTH_STANDARD_VERSION,
  sex: 'M',
  metric: 'total',
  current_kg: 580,
  earned_tier: standard('M').metrics.total[2],
  next_tier: standard('M').metrics.total[3],
  remaining_kg: 10,
  progress: clubKg.progress,
  evidence_complete: true,
};
const projectedKg = projectedStrengthTierState(serverStanding, 'total', standard('M'), 'kg');
const projectedLb = projectedStrengthTierState(serverStanding, 'total', standard('M'), 'lb');
assert.equal(projectedKg.earnedTierIndex, 2, 'the client must honor the server-owned Tier III standing');
assert.equal(projectedLb.earnedTierIndex, projectedKg.earnedTierIndex, 'projected standing identity must survive unit changes');
assert.equal(projectedLb.nextTierIndex, projectedKg.nextTierIndex);
assert.equal(projectedLb.progress, projectedKg.progress);
assert.equal(projectedLb.next, 1301, 'lb presentation must derive from the canonical 590 kg Tier IV threshold');
assert.equal(projectedStrengthTierState({ ...serverStanding, version: 'legacy' }, 'total', standard('M'), 'kg'), null, 'stale standing versions must fail closed');
assert.equal(projectedStrengthTierState({ ...serverStanding, sex: 'F' }, 'total', standard('M'), 'kg'), null, 'standing sex must match the governed table');

const governedOnly = canonicalLiftWeightBests([
  best(10, 'hack_squat', 400, 201, 'Hack Squat'),
  best(11, 'smith_bench_press', 300, 202, 'Smith Bench Press'),
  best(12, 'romanian_deadlift', 350, 203, 'Romanian Deadlift'),
  best(13, 'accessory_curl', 500, 204, 'Competition Squat'),
  { ...best(15, 'competition_deadlift', 999, 206), metric: 'e1rm' },
  best(16, 'competition_bench', -10, 207),
  best(14, 'competition_squat', 170, 205),
]);
assert.deepEqual(governedOnly.map((lift) => [lift.key, lift.weightKg]), [['squat', 170]], 'names, variants, accessories, non-weight metrics, and invalid values must never qualify as competition-tier evidence');

const medallions = canonicalMajorVolumeMedallions([
  { id: 10, event_type: 'TOTAL_LIFETIME_VOLUME_MILESTONE', occurred_at: '2026-06-02T12:00:00Z', source_set_log_id: 501, evidence: { threshold_lb: 1000000, milestone_scope: 'total' } },
  { id: 11, event_type: 'CORE_LIFETIME_VOLUME_MILESTONE', occurred_at: '2026-07-02T12:00:00Z', source_set_log_id: 502, evidence: { threshold_lb: 250000, lift_family: 'bench', milestone_scope: 'lift' } },
  { id: 12, event_type: 'CORE_LIFETIME_VOLUME_MILESTONE', occurred_at: '2026-08-02T12:00:00Z', evidence: { threshold_lb: 123456, lift_family: 'bench' } },
]);
assert.equal(medallions.length, 2);
assert.equal(medallions[0].family, 'bench');
assert.equal(medallions[0].thresholdLb, 250000);
assert.equal(medallions[1].family, 'total');

const prs = canonicalPrHistory([
  { id: 20, event_type: 'CORE_WEIGHT_PR', occurred_at: '2026-02-01', current_value: 180 },
  { id: 21, event_type: 'CORE_REP_MAX_PR', occurred_at: '2026-03-01', current_value: 170 },
  { id: 22, event_type: 'CORE_BLOCK_WEIGHT_BEST', occurred_at: '2026-04-01', current_value: 175 },
  { id: 23, event_type: 'CORE_E1RM_PR', occurred_at: null, current_value: 205 },
]);
assert.deepEqual(prs.map((event) => event.id), [21, 20]);

console.log('[ledger rewards] sex-specific kg tier boundaries, exact identity, totals, unit parity, medallions, and PR history passed');
