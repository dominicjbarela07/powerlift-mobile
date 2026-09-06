import {
  MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB,
  isMajorVolumeMedallionThresholdLb,
  type MajorVolumeMedallionFamily,
  type MajorVolumeMedallionThresholdLb,
} from '@/lib/major-volume-milestones';
import { canonicalCompetitionLiftKey } from '@/lib/strength-standard-identity';
import type {
  AccomplishmentEvent,
  CurrentBest,
  LedgerUnit,
  StrengthMetric,
  StrengthStandardProjection,
  StrengthTierStateProjection,
  StrengthTierDefinition,
} from '@/lib/ledger-data';

export const STRENGTH_STANDARD_VERSION = 'opl_2026_09_04_b8b9bf6e_v1' as const;
export const STRENGTH_KG_TO_LB = 2.2046226218;

export const TOTAL_TROPHY_TIER_NAMES = [
  'Steel',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Obsidian',
] as const;
export const STRENGTH_TIER_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

export function strengthTierRoman(tier: number): string {
  return STRENGTH_TIER_ROMAN[tier - 1] ?? String(tier);
}

export const CAREER_PR_EVENT_TYPES = new Set([
  'CORE_WEIGHT_PR',
  'CORE_E1RM_PR',
  'CORE_REP_MAX_PR',
]);

export const MAJOR_VOLUME_EVENT_TYPES = new Set([
  'CORE_LIFETIME_VOLUME_MILESTONE',
  'TOTAL_LIFETIME_VOLUME_MILESTONE',
]);

export type CanonicalLiftWeightBest = Readonly<{
  key: 'squat' | 'bench' | 'deadlift';
  weightKg: number;
  roundedLb: number;
  sourceSetLogId: number | null;
}>;

export type CanonicalTotal = Readonly<{
  complete: boolean;
  lb: number;
  kg: number;
  lifts: readonly CanonicalLiftWeightBest[];
}>;

export type TotalClubState = Readonly<{
  metric: StrengthMetric;
  standardVersion: typeof STRENGTH_STANDARD_VERSION;
  tiers: readonly StrengthTierDefinition[];
  currentKg: number;
  current: number;
  thresholds: readonly number[];
  earnedTierIndex: number;
  nextTierIndex: number | null;
  priorKg: number;
  prior: number;
  nextKg: number | null;
  next: number | null;
  remainingKg: number | null;
  remaining: number | null;
  progress: number;
}>;

export type MajorVolumeMedallionEvidence = Readonly<{
  event: AccomplishmentEvent;
  family: MajorVolumeMedallionFamily;
  thresholdLb: MajorVolumeMedallionThresholdLb;
  occurredAt: string;
  sourceSetLogId: number | null;
}>;

function evidenceNumber(event: AccomplishmentEvent, key: string): number | null {
  const value = event.evidence?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function evidenceString(event: AccomplishmentEvent, key: string): string | null {
  const value = event.evidence?.[key];
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

export function canonicalLiftWeightBests(items: readonly CurrentBest[]): CanonicalLiftWeightBest[] {
  return (['squat', 'bench', 'deadlift'] as const).flatMap((key) => {
    const best = items
      .filter((item) => item.metric === 'weight' && canonicalCompetitionLiftKey(item.core_movement_key) === key)
      .sort((left, right) => right.best_value - left.best_value)[0];
    if (!best || !Number.isFinite(best.best_value) || best.best_value <= 0) return [];
    return [{
      key,
      weightKg: best.best_value,
      roundedLb: Math.round(best.best_value * STRENGTH_KG_TO_LB),
      sourceSetLogId: best.event?.source_set_log_id ?? null,
    }];
  });
}

export function canonicalTotal(items: readonly CurrentBest[]): CanonicalTotal {
  const lifts = canonicalLiftWeightBests(items);
  const complete = lifts.length === 3;
  const kg = complete ? lifts.reduce((sum, lift) => sum + lift.weightKg, 0) : 0;
  return {
    complete,
    lb: complete ? Math.round(kg * STRENGTH_KG_TO_LB) : 0,
    kg,
    lifts,
  };
}

function displayStrengthKg(valueKg: number, unit: LedgerUnit): number {
  return unit === 'lb'
    ? Math.round(valueKg * STRENGTH_KG_TO_LB)
    : Math.round(valueKg * 100) / 100;
}

export function supportedStrengthStandard(
  candidate?: StrengthStandardProjection | null,
): StrengthStandardProjection | null {
  if (!candidate || candidate.status !== 'supported') return null;
  if (candidate.version !== STRENGTH_STANDARD_VERSION || candidate.canonical_unit !== 'kg') return null;
  if (candidate.display_conversion !== STRENGTH_KG_TO_LB || (candidate.sex !== 'M' && candidate.sex !== 'F')) return null;
  const metrics: StrengthMetric[] = ['total', 'squat', 'bench', 'deadlift'];
  for (const metric of metrics) {
    const tiers = candidate.metrics[metric];
    if (!tiers || tiers.length !== TOTAL_TROPHY_TIER_NAMES.length) return null;
    if (tiers.some((tier, index) => (
      tier.tier !== index + 1
      || tier.name !== TOTAL_TROPHY_TIER_NAMES[index]
      || !Number.isFinite(tier.threshold_kg)
      || tier.threshold_kg <= 0
      || Math.round(tier.threshold_kg * STRENGTH_KG_TO_LB) !== tier.display_lb
      || (index > 0 && tier.threshold_kg <= tiers[index - 1].threshold_kg)
    ))) return null;
  }
  return candidate;
}

export function strengthTierState(
  currentKg: number,
  metric: StrengthMetric,
  standard: StrengthStandardProjection,
  unit: LedgerUnit,
): TotalClubState | null {
  const supported = supportedStrengthStandard(standard);
  const tiers = supported?.metrics[metric];
  if (!supported || !tiers || !Number.isFinite(currentKg) || currentKg < 0) return null;
  const earnedTierIndex = tiers.reduce((highest, tier, index) => tier.threshold_kg <= currentKg ? index : highest, -1);
  const nextTierIndex = tiers.findIndex((tier) => tier.threshold_kg > currentKg);
  const resolvedNextTierIndex = nextTierIndex < 0 ? null : nextTierIndex;
  const priorKg = earnedTierIndex >= 0 ? tiers[earnedTierIndex].threshold_kg : 0;
  const nextKg = resolvedNextTierIndex == null ? null : tiers[resolvedNextTierIndex].threshold_kg;
  const remainingKg = nextKg == null ? null : Math.max(0, nextKg - currentKg);
  const progress = nextKg == null ? 1 : Math.max(0, Math.min(1, (currentKg - priorKg) / Math.max(Number.EPSILON, nextKg - priorKg)));
  return {
    metric,
    standardVersion: STRENGTH_STANDARD_VERSION,
    tiers,
    currentKg,
    current: displayStrengthKg(currentKg, unit),
    thresholds: tiers.map((tier) => unit === 'lb' ? tier.display_lb : tier.threshold_kg),
    earnedTierIndex,
    nextTierIndex: resolvedNextTierIndex,
    priorKg,
    prior: displayStrengthKg(priorKg, unit),
    nextKg,
    next: nextKg == null ? null : displayStrengthKg(nextKg, unit),
    remainingKg,
    remaining: remainingKg == null ? null : displayStrengthKg(remainingKg, unit),
    progress,
  };
}

/**
 * Present a server-owned standing without recalculating unlock identity on the
 * client. Older DEV backends remain supported through `strengthTierState`.
 */
export function projectedStrengthTierState(
  projection: StrengthTierStateProjection | null | undefined,
  metric: StrengthMetric,
  standard: StrengthStandardProjection,
  unit: LedgerUnit,
): TotalClubState | null {
  const supported = supportedStrengthStandard(standard);
  const tiers = supported?.metrics[metric];
  if (
    !supported
    || !tiers
    || !projection
    || projection.status !== 'supported'
    || projection.version !== supported.version
    || projection.sex !== supported.sex
    || projection.metric !== metric
  ) return null;

  const earnedTierIndex = projection.earned_tier == null
    ? -1
    : tiers.findIndex((tier) => tier.tier === projection.earned_tier?.tier && tier.threshold_kg === projection.earned_tier?.threshold_kg);
  const nextTierIndex = projection.next_tier == null
    ? null
    : tiers.findIndex((tier) => tier.tier === projection.next_tier?.tier && tier.threshold_kg === projection.next_tier?.threshold_kg);
  if (projection.earned_tier != null && earnedTierIndex < 0) return null;
  if (projection.next_tier != null && (nextTierIndex == null || nextTierIndex < 0)) return null;

  const currentKg = typeof projection.current_kg === 'number' && Number.isFinite(projection.current_kg)
    ? Math.max(0, projection.current_kg)
    : 0;
  const priorKg = earnedTierIndex >= 0 ? tiers[earnedTierIndex].threshold_kg : 0;
  const nextKg = nextTierIndex == null ? null : tiers[nextTierIndex].threshold_kg;
  const remainingKg = typeof projection.remaining_kg === 'number' && Number.isFinite(projection.remaining_kg)
    ? Math.max(0, projection.remaining_kg)
    : nextKg == null ? null : Math.max(0, nextKg - currentKg);
  return {
    metric,
    standardVersion: STRENGTH_STANDARD_VERSION,
    tiers,
    currentKg,
    current: displayStrengthKg(currentKg, unit),
    thresholds: tiers.map((tier) => unit === 'lb' ? tier.display_lb : tier.threshold_kg),
    earnedTierIndex,
    nextTierIndex,
    priorKg,
    prior: displayStrengthKg(priorKg, unit),
    nextKg,
    next: nextKg == null ? null : displayStrengthKg(nextKg, unit),
    remainingKg,
    remaining: remainingKg == null ? null : displayStrengthKg(remainingKg, unit),
    progress: Math.max(0, Math.min(1, Number(projection.progress ?? 0))),
  };
}

export function totalClubState(
  total: CanonicalTotal,
  standard: StrengthStandardProjection,
  unit: LedgerUnit,
): TotalClubState | null {
  if (!total.complete) return strengthTierState(0, 'total', standard, unit);
  return strengthTierState(total.kg, 'total', standard, unit);
}

export function majorVolumeMedallionEvidence(event: AccomplishmentEvent): MajorVolumeMedallionEvidence | null {
  if (!MAJOR_VOLUME_EVENT_TYPES.has(event.event_type)) return null;
  const thresholdLb = evidenceNumber(event, 'threshold_lb');
  const occurredAt = event.occurred_at || event.workout_date;
  if (thresholdLb == null || !isMajorVolumeMedallionThresholdLb(thresholdLb) || !occurredAt) return null;

  const family = event.event_type === 'TOTAL_LIFETIME_VOLUME_MILESTONE'
    ? 'total'
    : evidenceString(event, 'lift_family');
  if (family !== 'total' && family !== 'squat' && family !== 'bench' && family !== 'deadlift') return null;

  return {
    event,
    family,
    thresholdLb,
    occurredAt,
    sourceSetLogId: event.source_set_log_id ?? null,
  };
}

export function canonicalMajorVolumeMedallions(events: readonly AccomplishmentEvent[]): MajorVolumeMedallionEvidence[] {
  return events
    .map(majorVolumeMedallionEvidence)
    .filter((item): item is MajorVolumeMedallionEvidence => item !== null)
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || right.event.id - left.event.id);
}

export function canonicalPrHistory(events: readonly AccomplishmentEvent[]): AccomplishmentEvent[] {
  return events
    .filter((event) => CAREER_PR_EVENT_TYPES.has(event.event_type) && Boolean(event.occurred_at || event.workout_date))
    .sort((left, right) => Date.parse(right.occurred_at || right.workout_date || '') - Date.parse(left.occurred_at || left.workout_date || '') || right.id - left.id);
}

export function nextMajorVolumeThreshold(currentLb: number): MajorVolumeMedallionThresholdLb | null {
  return MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB.find((threshold) => threshold > currentLb) ?? null;
}
