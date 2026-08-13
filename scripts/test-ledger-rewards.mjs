import assert from 'node:assert/strict';

import {
  canonicalMajorVolumeMedallions,
  canonicalPrHistory,
  canonicalTotal,
  CORE_LIFT_MILESTONE_THRESHOLDS,
  totalClubState,
  TOTAL_CLUB_THRESHOLDS,
} from '../lib/ledger-rewards.ts';

const best = (projectionId, lift, weightKg, setId) => ({
  projection_id: projectionId,
  core_movement_key: lift,
  movement_label: lift,
  metric: 'weight',
  best_value: weightKg,
  unit: 'kg',
  event: { id: projectionId, event_type: 'CORE_WEIGHT_PR', source_set_log_id: setId },
});

const sparse = canonicalTotal([best(1, 'squat', 180, 101)]);
assert.equal(sparse.complete, false);
assert.equal(sparse.lb, 0, 'partial core-lift evidence must not manufacture a combined total');

const dense = canonicalTotal([
  best(1, 'squat', 200, 101),
  best(2, 'bench', 140, 102),
  best(3, 'deadlift', 240, 103),
]);
assert.equal(dense.complete, true);
assert.equal(dense.lb, 1280);
assert.deepEqual(dense.lifts.map((lift) => lift.sourceSetLogId), [101, 102, 103]);

const clubLb = totalClubState(dense, 'lb');
assert.equal(clubLb.thresholds, TOTAL_CLUB_THRESHOLDS.lb);
assert.equal(clubLb.earnedTierIndex, 3);
assert.equal(clubLb.next, 1500);
assert.equal(clubLb.remaining, 220);
assert.ok(clubLb.progress > 0 && clubLb.progress < 1);

const medallions = canonicalMajorVolumeMedallions([
  {
    id: 10,
    event_type: 'TOTAL_LIFETIME_VOLUME_MILESTONE',
    occurred_at: '2026-06-02T12:00:00Z',
    source_set_log_id: 501,
    evidence: { threshold_lb: 1000000, milestone_scope: 'total' },
  },
  {
    id: 11,
    event_type: 'CORE_LIFETIME_VOLUME_MILESTONE',
    occurred_at: '2026-07-02T12:00:00Z',
    source_set_log_id: 502,
    evidence: { threshold_lb: 250000, lift_family: 'bench', milestone_scope: 'lift' },
  },
  {
    id: 12,
    event_type: 'CORE_LIFETIME_VOLUME_MILESTONE',
    occurred_at: '2026-08-02T12:00:00Z',
    evidence: { threshold_lb: 123456, lift_family: 'bench' },
  },
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

assert.equal(CORE_LIFT_MILESTONE_THRESHOLDS.squat.lb[0], 95);
assert.equal(CORE_LIFT_MILESTONE_THRESHOLDS.deadlift.lb.at(-1), 895);

console.log('[ledger rewards] sparse/dense totals, exact clubs, medallions, and PR history passed');
