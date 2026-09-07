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
  StrengthStandingProjection,
  StrengthTierStateProjection,
  StrengthTierDefinition,
} from '@/lib/ledger-data';

export const STRENGTH_STANDARD_VERSION = 'opl_2026_09_04_b8b9bf6e_v1' as const;
export const STRENGTH_KG_TO_LB = 2.2046226218;

export const STRENGTH_TIER_LABELS = [
  'Tier I',
  'Tier II',
  'Tier III',
  'Tier IV',
  'Tier V',
  'Tier VI',
  'Tier VII',
] as const;

/**
 * The governed seven thresholds remain statistical tiers in the API. The
 * athlete-facing Total achievement identity is deliberately a named club.
 */
export const TOTAL_STRENGTH_CLUB_NAMES = [
  'Steel',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Obsidian',
] as const;

export type StrengthLiftKey = Exclude<StrengthMetric, 'total'>;

export type PlateClubMilestone = Readonly<{
  value: number;
  renderKeyLb: number;
}>;

export type PlateClubState = Readonly<{
  lift: StrengthLiftKey;
  unit: LedgerUnit;
  currentKg: number;
  current: number;
  milestones: readonly PlateClubMilestone[];
  earnedIndex: number;
  nextIndex: number | null;
  earned: PlateClubMilestone | null;
  next: PlateClubMilestone | null;
  remaining: number | null;
  progress: number;
}>;

const LB_PLATE_CLUBS: Readonly<Record<StrengthLiftKey, readonly number[]>> = Object.freeze({
  squat: Object.freeze([95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585, 635, 675, 725]),
  bench: Object.freeze([95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585]),
  deadlift: Object.freeze([135, 225, 315, 405, 495, 585, 675, 765, 855]),
});

const KG_PLATE_CLUBS: Readonly<Record<StrengthLiftKey, readonly PlateClubMilestone[]>> = Object.freeze({
  squat: Object.freeze([[50, 110], [60, 135], [100, 220], [150, 330], [200, 440], [250, 550], [300, 660]].map(([value, renderKeyLb]) => Object.freeze({ value, renderKeyLb }))),
  bench: Object.freeze([[40, 90], [60, 130], [80, 175], [100, 220], [120, 265], [140, 310], [160, 355], [180, 395], [200, 440]].map(([value, renderKeyLb]) => Object.freeze({ value, renderKeyLb }))),
  deadlift: Object.freeze([[60, 135], [100, 220], [150, 330], [200, 440], [250, 550], [300, 660], [350, 770], [400, 880]].map(([value, renderKeyLb]) => Object.freeze({ value, renderKeyLb }))),
});

export type CompetitiveStanding = Readonly<{
  percentile: number;
  roundedPercentile: number;
  sex: 'M' | 'F';
  sexLabel: 'male' | 'female';
  summary: string;
}>;

export type StrengthReferenceCohort = Readonly<{
  sourceName: string;
  datasetDate: string;
  datasetRevision: string;
  retrievedAtUtc: string;
  eventLabel: string;
  equipment: string;
  ageFilter: string;
  testedFilter: string;
  federationFilter: string;
  countryFilter: string;
  sanctionedRule: string;
  validityRule: string;
  identityRule: string;
  sourceRows: number;
  eligibleMeetPerformances: number;
  sexLabel: 'Male' | 'Female';
  sampleSize: number;
  referenceGroupLabel: string;
  selectionRule: string;
  eligibilityRule: string;
  dateRange: string;
  exclusions: string;
}>;
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

export type StrengthTierState = Readonly<{
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

export type LedgerClubsLiftState = Readonly<{
  key: StrengthLiftKey;
  canonicalWeightKg: number | null;
  currentLb: number | null;
  sourceSetLogId: number | null;
  plateClubState: PlateClubState | null;
  standingState: StrengthTierState | null;
}>;

export type LedgerClubsRuntimeState = Readonly<{
  standard: StrengthStandardProjection | null;
  standing: StrengthStandingProjection | null;
  total: CanonicalTotal;
  totalState: StrengthTierState | null;
  lifts: readonly LedgerClubsLiftState[];
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

function displayPlateClubCurrent(valueKg: number, unit: LedgerUnit): number {
  if (unit === 'lb') return Math.round(valueKg * STRENGTH_KG_TO_LB);
  return Math.round(valueKg * 10) / 10;
}

function plateClubMilestones(lift: StrengthLiftKey, unit: LedgerUnit): readonly PlateClubMilestone[] {
  if (unit === 'kg') return KG_PLATE_CLUBS[lift];
  return LB_PLATE_CLUBS[lift].map((value) => Object.freeze({ value, renderKeyLb: value }));
}

/** Gym-native milestones are a presentation/achievement layer, never a cohort calculation. */
export function resolvePlateClubState(
  currentKg: number,
  lift: StrengthLiftKey,
  unit: LedgerUnit,
): PlateClubState | null {
  if (!Number.isFinite(currentKg) || currentKg <= 0) return null;
  const current = displayPlateClubCurrent(currentKg, unit);
  const milestones = plateClubMilestones(lift, unit);
  const earnedIndex = milestones.reduce((highest, milestone, index) => milestone.value <= current ? index : highest, -1);
  const unresolvedNextIndex = milestones.findIndex((milestone) => milestone.value > current);
  const nextIndex = unresolvedNextIndex < 0 ? null : unresolvedNextIndex;
  const earned = earnedIndex < 0 ? null : milestones[earnedIndex];
  const next = nextIndex == null ? null : milestones[nextIndex];
  const priorValue = earned?.value ?? 0;
  const remaining = next == null ? null : Math.max(0, Math.round((next.value - current) * 10) / 10);
  const progress = next == null ? 1 : Math.max(0, Math.min(1, (current - priorValue) / Math.max(Number.EPSILON, next.value - priorValue)));
  return Object.freeze({ lift, unit, currentKg, current, milestones, earnedIndex, nextIndex, earned, next, remaining, progress });
}

export function totalStrengthClubName(tierIndex: number): typeof TOTAL_STRENGTH_CLUB_NAMES[number] | null {
  return TOTAL_STRENGTH_CLUB_NAMES[tierIndex] ?? null;
}

function standingTier(state: StrengthTierState | null | undefined): StrengthTierDefinition | null {
  if (!state || state.earnedTierIndex < 0) return null;
  return state.tiers[state.earnedTierIndex] ?? null;
}

export function competitiveStanding(
  state: StrengthTierState | null | undefined,
  sex: 'M' | 'F' | null | undefined,
): CompetitiveStanding | null {
  const tier = standingTier(state);
  if (!tier || (sex !== 'M' && sex !== 'F')) return null;
  const roundedPercentile = Math.round(tier.actual_percentile);
  const sexLabel = sex === 'M' ? 'male' : 'female';
  return Object.freeze({
    percentile: tier.actual_percentile,
    roundedPercentile,
    sex,
    sexLabel,
    summary: `Stronger than about ${roundedPercentile}% of comparable ${sexLabel} competitors`,
  });
}

export function competitiveStandingSummary(
  state: StrengthTierState | null | undefined,
  sex: 'M' | 'F' | null | undefined,
): string {
  const standing = competitiveStanding(state, sex);
  if (standing) return standing.summary;
  if (state && state.currentKg > 0 && (sex === 'M' || sex === 'F')) {
    return `Below the first governed reference point for comparable ${sex === 'M' ? 'male' : 'female'} competitors`;
  }
  return 'A governed competitive standing is not available yet';
}

function datasetString(dataset: Readonly<Record<string, unknown>> | undefined, key: string, fallback: string): string {
  const value = dataset?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function datasetNumber(dataset: Readonly<Record<string, unknown>> | undefined, key: string): number {
  const value = dataset?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function strengthReferenceCohort(
  standard: StrengthStandardProjection | null | undefined,
): StrengthReferenceCohort | null {
  const supported = supportedStrengthStandard(standard);
  if (!supported || (supported.sex !== 'M' && supported.sex !== 'F')) return null;
  const dataset = supported.dataset;
  const sexLabel = supported.sex === 'M' ? 'Male' : 'Female';
  const sampleSize = datasetNumber(dataset, supported.sex === 'M' ? 'male_lifters' : 'female_lifters');
  const dateMin = datasetString(dataset, 'eligible_date_min', '1965-09-04');
  const dateMax = datasetString(dataset, 'eligible_date_max', '2026-08-30');
  const eventLabel = datasetString(dataset, 'event_label', 'Full Power');
  const equipment = datasetString(dataset, 'equipment', 'Raw');
  const ageFilter = datasetString(dataset, 'age_filter', 'all_ages');
  const testedFilter = datasetString(dataset, 'tested_filter', 'not_applied');
  const federationFilter = datasetString(dataset, 'federation_filter', 'not_applied');
  const countryFilter = datasetString(dataset, 'country_filter', 'not_applied');
  const sanctionedRule = datasetString(dataset, 'sanctioned', 'exclude_explicit_no_blank_defaults_yes');
  const validityRule = datasetString(dataset, 'validity', 'positive_total_and_all_three_best3_lifts_non_dq_dd_ns_total_matches_best3_sum');
  const identityRule = datasetString(dataset, 'identity', 'exact_openpowerlifting_sex_and_name_suffix_preserved');
  return Object.freeze({
    sourceName: datasetString(dataset, 'source_name', 'OpenPowerlifting'),
    datasetDate: datasetString(dataset, 'dataset_date', '2026-09-04'),
    datasetRevision: datasetString(dataset, 'dataset_revision', 'b8b9bf6e'),
    retrievedAtUtc: datasetString(dataset, 'retrieved_at_utc', '2026-09-05T20:05:07Z'),
    eventLabel,
    equipment,
    ageFilter,
    testedFilter,
    federationFilter,
    countryFilter,
    sanctionedRule,
    validityRule,
    identityRule,
    sourceRows: datasetNumber(dataset, 'source_rows'),
    eligibleMeetPerformances: datasetNumber(dataset, 'eligible_meet_performances'),
    sexLabel,
    sampleSize,
    referenceGroupLabel: `${sexLabel} · ${equipment} · ${eventLabel} · sanctioned competition results · ${ageFilter === 'all_ages' ? 'all ages' : ageFilter}`,
    selectionRule: 'One best valid result per exact OpenPowerlifting lifter identity; Total, Squat, Bench Press, and Deadlift are independently maximized.',
    eligibilityRule: 'A valid Full Power result requires a positive Total and all three positive Best3 lifts, with Total matching their sum.',
    dateRange: `${dateMin} to ${dateMax}`,
    exclusions: 'Disqualified, did-not-lift, no-show, explicitly unsanctioned, non-Raw, and non-Full-Power results are excluded. Tested status, bodyweight, age, country, and federation are not filters.',
  });
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
    if (!tiers || tiers.length !== STRENGTH_TIER_LABELS.length) return null;
    if (tiers.some((tier, index) => (
      tier.tier !== index + 1
      || tier.name !== STRENGTH_TIER_LABELS[index]
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
): StrengthTierState | null {
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
): StrengthTierState | null {
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

export function totalStrengthTierState(
  total: CanonicalTotal,
  standard: StrengthStandardProjection,
  unit: LedgerUnit,
): StrengthTierState | null {
  if (!total.complete) return strengthTierState(0, 'total', standard, unit);
  return strengthTierState(total.kg, 'total', standard, unit);
}

/**
 * Resolve the exact strength projection consumed by Ledger → Clubs.
 *
 * Historical achievement rows are intentionally absent from this boundary:
 * standing is rebuilt from the current-bests endpoint's governed competition
 * Weight PR evidence and the versioned, sex-specific server standard.
 */
export function resolveLedgerClubsRuntimeState(
  currentBests: readonly CurrentBest[],
  standardCandidate: StrengthStandardProjection | null | undefined,
  standingCandidate: StrengthStandingProjection | null | undefined,
  unit: LedgerUnit,
): LedgerClubsRuntimeState {
  const standard = supportedStrengthStandard(standardCandidate);
  const standing = standingCandidate?.status === 'supported'
    && standingCandidate.version === standard?.version
    && standingCandidate.sex === standard?.sex
    ? standingCandidate
    : null;
  const total = canonicalTotal(currentBests);
  const totalState = standard
    ? projectedStrengthTierState(standing?.metrics.total, 'total', standard, unit)
      ?? totalStrengthTierState(total, standard, unit)
    : null;
  const lifts = (['squat', 'bench', 'deadlift'] as const).map((key): LedgerClubsLiftState => {
    const canonicalWeightBest = currentBests
      .filter((item) => item.metric === 'weight' && canonicalCompetitionLiftKey(item.core_movement_key) === key)
      .sort((left, right) => right.best_value - left.best_value)[0];
    const canonicalWeightKg = canonicalWeightBest?.best_value ?? null;
    return {
      key,
      canonicalWeightKg,
      currentLb: canonicalWeightKg == null ? null : Math.round(canonicalWeightKg * STRENGTH_KG_TO_LB / 5) * 5,
      sourceSetLogId: canonicalWeightBest?.event?.source_set_log_id ?? null,
      plateClubState: canonicalWeightKg == null ? null : resolvePlateClubState(canonicalWeightKg, key, unit),
      standingState: standard
        ? projectedStrengthTierState(standing?.metrics[key], key, standard, unit)
          ?? strengthTierState(canonicalWeightKg ?? 0, key, standard, unit)
        : null,
    };
  });
  return { standard, standing, total, totalState, lifts };
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
