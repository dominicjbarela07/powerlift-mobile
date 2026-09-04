import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  compareMovementPerformance,
  formatMovementPerformanceComparison,
  movementLoadPolicy,
} from '../lib/movement-performance-semantics.ts';
import { formatPerformedLoad } from '../lib/performed-load-semantics.ts';
import {
  buildPersonalBestEvidence,
  personalBestEvidenceMatchesLoadSemantics,
} from '../lib/post-session-pr-evidence.ts';

const root = resolve(import.meta.dirname, '..');
const recapSource = readFileSync(resolve(root, 'components/coach-mobile/CompletedSessionRecap.tsx'), 'utf8');
const historySource = readFileSync(resolve(root, 'components/movement-history/CanonicalMovementHistoryScreen.tsx'), 'utf8');
const loggerSource = readFileSync(resolve(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const KG_PER_LB = 0.45359237;
const assistance = { loadConvention: 'assistance_load', measurementType: 'assisted_reps' };
const weighted = { loadConvention: 'added_bodyweight', measurementType: 'weighted_bodyweight_reps' };
const external = { loadConvention: 'external_load', measurementType: 'load_reps' };
const set = (lb, reps, rir = 1) => ({ weightKg: lb * KG_PER_LB, reps, rir });

const matrix = [
  [set(70, 10), set(80, 10), 'improved', '10 lb less assistance at matched reps & effort'],
  [set(80, 10), set(70, 10), 'declined', '10 lb more assistance at matched reps & effort'],
  [set(80, 10), set(80, 8), 'improved', '2 more reps at the same assistance & effort'],
  [set(80, 8), set(80, 10), 'declined', '2 fewer reps at the same assistance & effort'],
  [set(80, 10), set(80, 10), 'stable', 'Matched prior performance'],
];

for (const [current, previous, state, copy] of matrix) {
  const result = compareMovementPerformance(current, previous, assistance);
  assert.equal(result.state, state);
  assert.equal(formatMovementPerformanceComparison(result, 'lb'), copy);
  assert.equal(
    compareMovementPerformance(
      { ...current, weightKg: Number(current.weightKg) },
      { ...previous, weightKg: Number(previous.weightKg) },
      assistance,
    ).state,
    state,
    'classification must be invariant when the same evidence is presented in kg',
  );
}

assert.equal(compareMovementPerformance(set(45, 8), set(25, 8), weighted).state, 'improved');
assert.equal(compareMovementPerformance(set(110, 10), set(100, 10), external).state, 'improved');
assert.equal(compareMovementPerformance(set(70, 8, 0), set(80, 10, 1), assistance).state, 'not_comparable', 'conflicting load, reps, and effort must fail closed');
assert.equal(movementLoadPolicy(assistance).loadDirection, 'lower_is_better');
assert.equal(movementLoadPolicy(assistance).supportsEstimatedStrength, false);
assert.equal(movementLoadPolicy(weighted).loadDirection, 'higher_is_better');
assert.equal(formatPerformedLoad(80 * KG_PER_LB, 'lb', assistance), '80 lb assistance');
assert.equal(formatPerformedLoad(80 * KG_PER_LB, 'kg', assistance), '36.25 kg assistance');
assert.equal(formatPerformedLoad(45 * KG_PER_LB, 'lb', weighted), 'BW + 45 lb');

const assistedMovement = {
  item_id: 7,
  label: 'Canonical movement label is irrelevant',
  measurement: { load_convention: 'assistance_load', measurement_type: 'assisted_reps' },
  sets: [{ id: 701, actual_weight_kg: 70 * KG_PER_LB, actual_reps: 10, actual_rir: 1 }],
};
const assistanceEvent = (currentLb, previousLb, metric = 'rep_max_load', currentReps = 10, previousReps = 10) => ({
  id: `${currentLb}-${previousLb}-${metric}`,
  event_type: metric === 'estimated_1rm' ? 'CORE_E1RM_PR' : metric === 'same_load_reps' ? 'CORE_SAME_WEIGHT_REP_PR' : 'CORE_REP_MAX_PR',
  movement_label: assistedMovement.label,
  workout_item_id: 7,
  source_set_log_id: 701,
  record_evidence: {
    metric,
    target_reps: currentReps,
    source_set: { set_log_id: 701, weight_kg: currentLb * KG_PER_LB, reps: currentReps, rir: 1 },
    prior_set: { set_log_id: 601, weight_kg: previousLb * KG_PER_LB, reps: previousReps, rir: 1 },
    current_value: currentLb * KG_PER_LB,
    prior_value: previousLb * KG_PER_LB,
  },
});
const evidence = (event) => buildPersonalBestEvidence([event], [assistedMovement])[0];
assert.equal(personalBestEvidenceMatchesLoadSemantics(evidence(assistanceEvent(70, 80))), true, 'lower assistance at matched performance may remain valid PR evidence');
assert.equal(personalBestEvidenceMatchesLoadSemantics(evidence(assistanceEvent(90, 70))), false, 'increasing assistance must never earn a heavier-load PR');
assert.equal(personalBestEvidenceMatchesLoadSemantics(evidence(assistanceEvent(80, 80, 'same_load_reps', 10, 8))), true, 'more reps at matched assistance and effort remains valid');
assert.equal(personalBestEvidenceMatchesLoadSemantics(evidence(assistanceEvent(70, 80, 'estimated_1rm'))), false, 'assistance must never earn conventional estimated-RM evidence');

assert.match(recapSource, /ASSISTANCE REQUIRED[\s\S]*LESS IS STRONGER/i);
assert.match(recapSource, /personalBestEvidenceMatchesLoadSemantics/);
assert.doesNotMatch(recapSource, /No material change\$\{suffix\}/);
assert.doesNotMatch(recapSource, /No material change%/);
assert.match(historySource, /ASSISTANCE TREND/);
assert.match(historySource, /Recorded assistance · lower is better/);
assert.match(readFileSync(resolve(root, 'lib/canonical-movement-history.ts'), 'utf8'), /recorded_assistance_v1[\s\S]*estimated_strength_pr: null[\s\S]*load_pr: null/);
assert.match(loggerSource, /governedLoadKind === 'assistance'/);
assert.doesNotMatch(loggerSource, /normalizedAccessoryName\.includes\('assisted'\)/);

console.log('assisted movement semantics, progression, PR, history, display, copy, and unit matrix: PASS');
