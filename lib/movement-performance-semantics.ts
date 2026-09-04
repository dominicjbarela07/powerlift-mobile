import { kilogramsToDisplayValue, type DisplayWeightUnit } from '@/lib/display-units';
import {
  isAssistanceLoad,
  isBodyweightLoad,
  type PerformedLoadSemantics,
} from '@/lib/performed-load-semantics';

export type MovementLoadPolicy = Readonly<{
  kind: 'assistance' | 'added_bodyweight' | 'bodyweight' | 'external';
  loadDirection: 'higher_is_better' | 'lower_is_better' | 'neutral';
  supportsEstimatedStrength: boolean;
  trendMetric: 'assistance_load_kg' | null;
  trendLabel: 'Assistance required' | null;
}>;

export type MovementPerformanceEvidence = Readonly<{
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
}>;

export type MovementPerformanceComparison = Readonly<{
  state: 'improved' | 'stable' | 'declined' | 'not_comparable';
  policy: MovementLoadPolicy;
  loadDeltaKg: number | null;
  repsDelta: number | null;
  reserveDelta: number | null;
  loadMatched: boolean;
  repsMatched: boolean;
  effortMatched: boolean;
  effortKind: 'rir' | 'rpe' | 'normalized' | null;
}>;

const LOAD_TOLERANCE_KG = 0.0005;
const EFFORT_TOLERANCE = 0.05;

function finite(value: unknown) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalized(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function movementLoadPolicy(semantics?: PerformedLoadSemantics | null): MovementLoadPolicy {
  if (isAssistanceLoad(semantics)) {
    return {
      kind: 'assistance',
      loadDirection: 'lower_is_better',
      supportsEstimatedStrength: false,
      trendMetric: 'assistance_load_kg',
      trendLabel: 'Assistance required',
    };
  }
  const convention = normalized(semantics?.loadConvention);
  if (convention === 'added_bodyweight' || normalized(semantics?.measurementType).includes('weighted_bodyweight')) {
    return {
      kind: 'added_bodyweight',
      loadDirection: 'higher_is_better',
      supportsEstimatedStrength: true,
      trendMetric: null,
      trendLabel: null,
    };
  }
  if (isBodyweightLoad(semantics)) {
    return {
      kind: 'bodyweight',
      loadDirection: 'neutral',
      supportsEstimatedStrength: false,
      trendMetric: null,
      trendLabel: null,
    };
  }
  return {
    kind: 'external',
    loadDirection: 'higher_is_better',
    supportsEstimatedStrength: true,
    trendMetric: null,
    trendLabel: null,
  };
}

function effortReserve(evidence: MovementPerformanceEvidence) {
  const rir = finite(evidence.rir);
  if (rir != null) return { value: rir, kind: 'rir' as const };
  const rpe = finite(evidence.rpe);
  if (rpe != null) return { value: 10 - rpe, kind: 'rpe' as const };
  return null;
}

function sign(value: number, tolerance: number) {
  if (Math.abs(value) <= tolerance) return 0;
  return value > 0 ? 1 : -1;
}

export function compareMovementPerformance(
  current: MovementPerformanceEvidence | null | undefined,
  previous: MovementPerformanceEvidence | null | undefined,
  semantics?: PerformedLoadSemantics | null,
): MovementPerformanceComparison {
  const policy = movementLoadPolicy(semantics);
  const currentLoad = finite(current?.weightKg);
  const previousLoad = finite(previous?.weightKg);
  const currentReps = finite(current?.reps);
  const previousReps = finite(previous?.reps);
  const currentEffort = current ? effortReserve(current) : null;
  const previousEffort = previous ? effortReserve(previous) : null;
  const loadDeltaKg = currentLoad == null || previousLoad == null ? null : currentLoad - previousLoad;
  const repsDelta = currentReps == null || previousReps == null ? null : currentReps - previousReps;
  const reserveDelta = currentEffort == null || previousEffort == null ? null : currentEffort.value - previousEffort.value;
  const loadMatched = loadDeltaKg != null && sign(loadDeltaKg, LOAD_TOLERANCE_KG) === 0;
  const repsMatched = repsDelta != null && sign(repsDelta, 0) === 0;
  const effortMatched = reserveDelta != null && sign(reserveDelta, EFFORT_TOLERANCE) === 0;
  const scores: number[] = [];

  if (loadDeltaKg != null && policy.loadDirection !== 'neutral') {
    scores.push(sign(
      policy.loadDirection === 'lower_is_better' ? -loadDeltaKg : loadDeltaKg,
      LOAD_TOLERANCE_KG,
    ));
  }
  if (repsDelta != null) scores.push(sign(repsDelta, 0));
  if (reserveDelta != null) scores.push(sign(reserveDelta, EFFORT_TOLERANCE));

  const positive = scores.some((score) => score > 0);
  const negative = scores.some((score) => score < 0);
  const state = !current || !previous || !scores.length
    ? 'not_comparable'
    : positive && negative
      ? 'not_comparable'
      : positive
        ? 'improved'
        : negative
          ? 'declined'
          : 'stable';

  return {
    state,
    policy,
    loadDeltaKg,
    repsDelta,
    reserveDelta,
    loadMatched,
    repsMatched,
    effortMatched,
    effortKind: currentEffort && previousEffort
      ? currentEffort.kind === previousEffort.kind ? currentEffort.kind : 'normalized'
      : null,
  };
}

function displayMagnitude(valueKg: number, unit: DisplayWeightUnit) {
  return kilogramsToDisplayValue(Math.abs(valueKg), unit).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
}

function matchedSuffix(comparison: MovementPerformanceComparison) {
  if (comparison.repsMatched && comparison.effortMatched) return ' at matched reps & effort';
  if (comparison.repsMatched) return ' at matched reps';
  if (comparison.effortMatched) return ' at matched effort';
  return '';
}

export function formatMovementPerformanceComparison(
  comparison: MovementPerformanceComparison,
  unit: DisplayWeightUnit,
) {
  if (comparison.state === 'not_comparable') return 'No reliable like-for-like comparison';
  if (comparison.state === 'stable') return 'Matched prior performance';

  if (comparison.policy.kind === 'assistance' && comparison.loadDeltaKg != null && !comparison.loadMatched) {
    const direction = comparison.loadDeltaKg < 0 ? 'less' : 'more';
    return `${displayMagnitude(comparison.loadDeltaKg, unit)} ${unit} ${direction} assistance${matchedSuffix(comparison)}`;
  }

  if (comparison.repsDelta != null && !comparison.repsMatched) {
    const count = Math.abs(comparison.repsDelta);
    const direction = comparison.repsDelta > 0 ? 'more' : 'fewer';
    const loadContext = comparison.policy.kind === 'assistance'
      ? comparison.loadMatched ? ' at the same assistance' : ''
      : comparison.loadMatched ? ' at the same load' : '';
    const effortContext = comparison.effortMatched ? ' & effort' : '';
    return `${count} ${direction} rep${count === 1 ? '' : 's'}${loadContext}${effortContext}`;
  }

  if (comparison.reserveDelta != null && !comparison.effortMatched) {
    const amount = Math.abs(comparison.reserveDelta).toLocaleString('en-US', { maximumFractionDigits: 1 });
    const direction = comparison.reserveDelta > 0 ? 'more reserve' : 'less reserve';
    return `${amount} ${direction} at matched load & reps`;
  }

  if (comparison.loadDeltaKg != null && !comparison.loadMatched) {
    const direction = comparison.loadDeltaKg > 0 ? 'more load' : 'less load';
    return `${displayMagnitude(comparison.loadDeltaKg, unit)} ${unit} ${direction}${matchedSuffix(comparison)}`;
  }

  return 'Matched prior performance';
}
