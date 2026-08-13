import {
  MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB,
  isMajorVolumeMedallionThresholdLb,
  type MajorVolumeMedallionFamily,
  type MajorVolumeMedallionThresholdLb,
} from '@/lib/major-volume-milestones';
import type { AccomplishmentEvent, CurrentBest, LedgerUnit } from '@/lib/ledger-data';

export const TOTAL_CLUB_THRESHOLDS: Record<LedgerUnit, readonly number[]> = {
  lb: [250, 500, 750, 1000, 1500, 2000, 2500],
  kg: [100, 225, 350, 450, 675, 900, 1125],
};

export const CORE_LIFT_MILESTONE_THRESHOLDS: Record<'squat' | 'bench' | 'deadlift', Record<LedgerUnit, readonly number[]>> = {
  squat: {
    lb: [95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585, 635, 675, 725],
    kg: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340],
  },
  bench: {
    lb: [95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585],
    kg: [40, 60, 80, 100, 120, 140, 160, 180, 200],
  },
  deadlift: {
    lb: [95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585, 635, 675, 725, 765, 815, 855, 895],
    kg: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380],
  },
};

export const TOTAL_TROPHY_TIER_NAMES = [
  'Steel',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Obsidian',
] as const;

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
  current: number;
  thresholds: readonly number[];
  earnedTierIndex: number;
  nextTierIndex: number | null;
  prior: number;
  next: number | null;
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

function coreLiftKey(value?: string | null): 'squat' | 'bench' | 'deadlift' | null {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.includes('squat')) return 'squat';
  if (normalized.includes('bench')) return 'bench';
  if (normalized.includes('deadlift')) return 'deadlift';
  return null;
}

function evidenceString(event: AccomplishmentEvent, key: string): string | null {
  const value = event.evidence?.[key];
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

export function canonicalLiftWeightBests(items: readonly CurrentBest[]): CanonicalLiftWeightBest[] {
  return (['squat', 'bench', 'deadlift'] as const).flatMap((key) => {
    const best = items
      .filter((item) => item.metric === 'weight' && coreLiftKey(item.core_movement_key || item.movement_label) === key)
      .sort((left, right) => right.best_value - left.best_value)[0];
    if (!best || !Number.isFinite(best.best_value) || best.best_value <= 0) return [];
    return [{
      key,
      weightKg: best.best_value,
      roundedLb: Math.round((best.best_value * 2.2046226218) / 5) * 5,
      sourceSetLogId: best.event?.source_set_log_id ?? null,
    }];
  });
}

export function canonicalTotal(items: readonly CurrentBest[]): CanonicalTotal {
  const lifts = canonicalLiftWeightBests(items);
  const complete = lifts.length === 3;
  const lb = complete ? lifts.reduce((sum, lift) => sum + lift.roundedLb, 0) : 0;
  return {
    complete,
    lb,
    kg: complete ? Math.round((lb / 2.2046226218) / 2.5) * 2.5 : 0,
    lifts,
  };
}

export function totalClubState(total: CanonicalTotal, unit: LedgerUnit): TotalClubState {
  const thresholds = TOTAL_CLUB_THRESHOLDS[unit];
  const current = unit === 'lb' ? total.lb : total.kg;
  const earnedTierIndex = thresholds.reduce((highest, threshold, index) => threshold <= current ? index : highest, -1);
  const nextTierIndex = thresholds.findIndex((threshold) => threshold > current);
  const resolvedNextTierIndex = nextTierIndex < 0 ? null : nextTierIndex;
  const prior = earnedTierIndex >= 0 ? thresholds[earnedTierIndex] : 0;
  const next = resolvedNextTierIndex == null ? null : thresholds[resolvedNextTierIndex];
  const progress = next == null ? 1 : Math.max(0, Math.min(1, (current - prior) / Math.max(1, next - prior)));
  return {
    current,
    thresholds,
    earnedTierIndex,
    nextTierIndex: resolvedNextTierIndex,
    prior,
    next,
    remaining: next == null ? null : Math.max(0, next - current),
    progress,
  };
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
