import type { CurrentBest, LedgerProgression, StrengthMetric, StrengthStandardProjection, StrengthStandingProjection, StrengthTierStateProjection } from '@/lib/ledger-data';
import { STRENGTH_KG_TO_LB, STRENGTH_STANDARD_VERSION, STRENGTH_TIER_LABELS } from '@/lib/ledger-rewards';
import type { LedgerLiveDataFixture } from '@/components/ledger/use-ledger-live-data';

type Sex = 'M' | 'F';
export type StrengthTierCertificationScenario = 'mid' | 'below' | 'tier7';

const TARGETS = [20, 40, 55, 70, 85, 95, 99] as const;
const TABLES: Record<Sex, Record<StrengthMetric, readonly number[]>> = {
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
const ACTUAL_PERCENTILES: Record<Sex, Record<StrengthMetric, readonly number[]>> = {
  M: {
    total: [20.33, 40.47, 55.88, 70.23, 85.62, 95.00, 99.03],
    squat: [22.41, 40.22, 57.34, 72.88, 86.79, 96.01, 99.12],
    bench: [23.52, 40.62, 59.36, 70.16, 86.72, 95.95, 99.06],
    deadlift: [20.94, 40.02, 56.34, 70.39, 85.70, 95.41, 99.18],
  },
  F: {
    total: [21.92, 42.11, 56.01, 71.03, 85.60, 95.47, 99.04],
    squat: [23.81, 42.36, 55.76, 73.51, 85.79, 95.90, 98.99],
    bench: [20.82, 44.13, 56.18, 76.29, 88.41, 96.62, 99.04],
    deadlift: [20.80, 45.27, 57.32, 70.66, 84.96, 96.14, 99.24],
  },
};

function standard(sex: Sex): StrengthStandardProjection {
  return {
    status: 'supported',
    version: STRENGTH_STANDARD_VERSION,
    canonical_unit: 'kg',
    display_conversion: STRENGTH_KG_TO_LB,
    sex,
    sex_label: sex === 'M' ? 'Male' : 'Female',
    dataset: { source: 'OpenPowerlifting', revision: 'b8b9bf6e', fixture: true },
    metrics: Object.fromEntries((['total', 'squat', 'bench', 'deadlift'] as const).map((metric) => [
      metric,
      TABLES[sex][metric].map((thresholdKg, index) => ({
        tier: index + 1,
        name: STRENGTH_TIER_LABELS[index],
        target_percentile: TARGETS[index],
        actual_percentile: ACTUAL_PERCENTILES[sex][metric][index],
        threshold_kg: thresholdKg,
        display_lb: Math.round(thresholdKg * STRENGTH_KG_TO_LB),
      })),
    ])),
  };
}

function best(id: number, key: 'competition_squat' | 'competition_bench' | 'competition_deadlift', label: string, valueKg: number): CurrentBest {
  return {
    projection_id: id,
    core_movement_key: key,
    movement_label: label,
    metric: 'weight',
    best_value: valueKg,
    unit: 'kg',
    event: {
      id,
      event_type: 'CORE_WEIGHT_PR',
      occurred_at: '2026-08-30T17:00:00Z',
      core_movement_key: key,
      movement_label: label,
      current_value: valueKg,
      unit: 'kg',
      source_set_log_id: 880000 + id,
      is_current_best: true,
    },
  };
}

export function strengthTierCertificationFixture(
  sex: Sex,
  scenario: StrengthTierCertificationScenario = 'mid',
): LedgerLiveDataFixture {
  const loadScenarios: Record<Sex, Record<StrengthTierCertificationScenario, readonly [number, number, number]>> = {
    M: { mid: [193, 110, 189.2], below: [140, 90, 170], tier7: [315, 210, 330] },
    F: { mid: [105, 57.5, 127.5], below: [80, 40, 100], tier7: [190, 110, 210] },
  };
  const loads = loadScenarios[sex][scenario];
  const currentBests = [
    best(1, 'competition_squat', 'Competition Squat', loads[0]),
    best(2, 'competition_bench', 'Competition Bench Press', loads[1]),
    best(3, 'competition_deadlift', 'Competition Deadlift', loads[2]),
  ];
  const strengthStandard = standard(sex);
  const state = (metric: StrengthMetric, currentKg: number): StrengthTierStateProjection => {
    const tiers = strengthStandard.metrics[metric] ?? [];
    const earnedTier = [...tiers].reverse().find((tier) => tier.threshold_kg <= currentKg) ?? null;
    const nextTier = tiers.find((tier) => tier.threshold_kg > currentKg) ?? null;
    const priorKg = earnedTier?.threshold_kg ?? 0;
    return {
      status: 'supported',
      version: STRENGTH_STANDARD_VERSION,
      sex,
      metric,
      current_kg: currentKg,
      earned_tier: earnedTier,
      next_tier: nextTier,
      remaining_kg: nextTier ? nextTier.threshold_kg - currentKg : null,
      progress: nextTier ? Math.max(0, Math.min(1, (currentKg - priorKg) / (nextTier.threshold_kg - priorKg))) : 1,
      evidence_complete: true,
    };
  };
  const totalKg = loads.reduce((sum, value) => sum + value, 0);
  const strengthStanding: StrengthStandingProjection = {
    status: 'supported',
    version: STRENGTH_STANDARD_VERSION,
    sex,
    evidence_authority: 'canonical_competition_weight_current_bests',
    metrics: {
      squat: state('squat', loads[0]),
      bench: state('bench', loads[1]),
      deadlift: state('deadlift', loads[2]),
      total: { ...state('total', totalKg), component_metrics: ['squat', 'bench', 'deadlift'] },
    },
  };
  const progression: LedgerProgression = {
    athlete: { id: 99001, name: `DEV ${sex === 'M' ? 'Male' : 'Female'} ${scenario}`, preferred_units: 'kg', sex },
    strength_standard: strengthStandard,
    range: { label: 'all time' },
    consistency: { sessions_completed: 48, best_streak: 8, training_age_years: 2, weeks: [] },
    metric_trends: { volume: { points: [], complete_training_volume_kg: 0, competition_total_volume_kg: 0 } },
  };
  return {
    progression,
    currentBests,
    accomplishments: currentBests.map((item) => item.event),
    strengthStandard,
    strengthStanding,
  };
}
