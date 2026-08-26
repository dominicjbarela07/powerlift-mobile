export type MovementStrengthMetricKey = 'e1rm' | 'e10rm';

export type MovementStrengthMetricPolicy = Readonly<{
  key: MovementStrengthMetricKey;
  metric: 'estimated_1rm_kg' | 'estimated_10rm_kg';
  projectionMetric: 'estimated_1rm' | 'estimated_10rm';
  label: 'Estimated 1RM' | 'Estimated 10RM';
  shortLabel: 'e1RM' | 'e10RM';
  method: 'epley_rpe_adjusted_v1' | 'epley_rpe_adjusted_e10rm_v1';
}>;

const CORE_POLICY: MovementStrengthMetricPolicy = {
  key: 'e1rm', metric: 'estimated_1rm_kg', projectionMetric: 'estimated_1rm',
  label: 'Estimated 1RM', shortLabel: 'e1RM', method: 'epley_rpe_adjusted_v1',
};

const ACCESSORY_POLICY: MovementStrengthMetricPolicy = {
  key: 'e10rm', metric: 'estimated_10rm_kg', projectionMetric: 'estimated_10rm',
  label: 'Estimated 10RM', shortLabel: 'e10RM', method: 'epley_rpe_adjusted_e10rm_v1',
};

export function strengthMetricForMovementClass(kind: 'core' | 'accessory' | 'core_variant' | string | null | undefined) {
  const normalized = String(kind || '').trim().toLowerCase();
  if (normalized === 'accessory' || normalized === 'acc') return ACCESSORY_POLICY;
  if (['core', 'core_variant', 'competition', 'variant'].includes(normalized)) return CORE_POLICY;
  throw new Error(`Unsupported governed movement class for strength metric: ${String(kind)}`);
}

export function estimateMovementStrengthKg(
  policy: MovementStrengthMetricPolicy,
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  rpe?: number | null,
  rir?: number | null,
) {
  const weight = Number(weightKg);
  const performedReps = Number(reps);
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(performedReps) || performedReps <= 0) return null;
  const recordedRpe = rpe == null && rir != null ? 10 - Math.max(0, Math.min(5, Number(rir))) : Number(rpe);
  const effectiveReps = Number.isFinite(recordedRpe) && recordedRpe >= 5 && recordedRpe <= 10
    ? performedReps + Math.max(0, 10 - recordedRpe)
    : performedReps;
  const e1rm = weight * (1 + effectiveReps / 30);
  return policy.key === 'e10rm' ? e1rm / (1 + 10 / 30) : e1rm;
}
