import { fetchJson } from '@/lib/api';
import { formatCalculatedWeightValue, kilogramsToDisplayValue } from '@/lib/display-units';
export { canonicalCompetitionLiftKey } from '@/lib/strength-standard-identity';

export type LedgerRange = '30d' | '90d' | '180d' | '1y' | 'all';
export type LedgerUnit = 'kg' | 'lb';
export type StrengthMetric = 'total' | 'squat' | 'bench' | 'deadlift';
export type StrengthTierDefinition = Readonly<{
  tier: number;
  name: string;
  target_percentile: number;
  actual_percentile: number;
  threshold_kg: number;
  display_lb: number;
}>;
export type StrengthStandardProjection = Readonly<{
  status: 'supported' | 'unsupported';
  reason?: string | null;
  version: string;
  canonical_unit: 'kg';
  display_conversion: number;
  sex?: 'M' | 'F' | null;
  sex_label?: string | null;
  metrics: Partial<Record<StrengthMetric, readonly StrengthTierDefinition[]>>;
  dataset?: Readonly<Record<string, unknown>>;
}>;

export type LedgerArcPoint = { date?: string | null; value_kg?: number | null };
export type LedgerLift = {
  key?: string | null;
  label?: string | null;
  current_e1rm_kg?: number | null;
  best_e1rm_kg?: number | null;
  change_kg?: number | null;
  change_pct?: number | null;
  trend?: string | null;
  points?: LedgerArcPoint[];
};

export type LedgerStoryItem = {
  id?: string | number | null;
  kind?: string | null;
  title?: string | null;
  body?: string | null;
  date?: string | null;
  route?: string | null;
};

export type LedgerProgression = {
  athlete?: { id?: number | null; name?: string | null; preferred_units?: string | null; sex?: string | null } | null;
  strength_standard?: StrengthStandardProjection | null;
  range?: { start_date?: string | null; end_date?: string | null; label?: string | null } | null;
  strength_story?: { title?: string | null; body?: string | null; confidence?: string | null; primary_lift?: string | null } | null;
  big_three_arc?: { lifts?: LedgerLift[]; estimated_total_kg?: number | null; estimated_total_change_kg?: number | null } | null;
  recent_wins?: LedgerStoryItem[];
  consistency?: {
    sessions_assigned?: number | null;
    sessions_completed?: number | null;
    missed_or_incomplete?: number | null;
    completion_rate_pct?: number | null;
    current_streak?: number | null;
    best_streak?: number | null;
    training_age_years?: number | null;
    weeks?: { week_start?: string | null; assigned?: number | null; completed?: number | null; missed?: number | null }[];
  } | null;
  milestones?: LedgerStoryItem[];
  readiness?: { average?: number | null; trend?: string | null; context_line?: string | null } | null;
  bodyweight?: { current_kg?: number | null; context_line?: string | null } | null;
  metric_trends?: {
    top_weight?: LedgerMetricTrend;
    avg_rpe?: LedgerMetricTrend;
    volume?: LedgerMetricTrend;
  } | null;
};

export type LedgerMetricTrend = {
  points?: { date?: string | null; value?: number | null; value_kg?: number | null }[];
  summary?: { current?: number | null; best?: number | null; change?: number | null } | null;
  complete_training_volume_kg?: number | null;
  competition_total_volume_kg?: number | null;
  competition_by_lift_kg?: Partial<Record<'squat' | 'bench' | 'deadlift', number>>;
  /** Backward-compatible alias for competition_by_lift_kg. */
  by_lift_kg?: Partial<Record<'squat' | 'bench' | 'deadlift', number>>;
  source?: string | null;
};

export type AccomplishmentEvent = {
  id: number;
  event_type: string;
  priority?: number | null;
  occurred_at?: string | null;
  workout_date?: string | null;
  workout_title?: string | null;
  core_movement_key?: string | null;
  movement_label?: string | null;
  movement_family?: string | null;
  movement_kind?: string | null;
  current_value?: number | null;
  prior_value?: number | null;
  delta?: number | null;
  unit?: string | null;
  source_set_log_id?: number | null;
  workout_id?: number | null;
  workout_item_id?: number | null;
  training_block_id?: number | null;
  scope?: string | null;
  is_current_best?: boolean | null;
  evidence?: Record<string, unknown> | null;
  reported_bodyweight?: {
    reported_bodyweight_kg: number;
    reported_at?: string | null;
    training_date?: string | null;
    workout_id?: number | null;
    source: 'PRE_SESSION_READINESS' | string;
    resolution?: 'exact_session' | 'canonical_same_training_date' | string;
  } | null;
};

export type CurrentBest = {
  projection_id: number;
  core_movement_key: string;
  movement_label: string;
  metric: 'weight' | 'e1rm' | string;
  best_value: number;
  unit: string;
  event: AccomplishmentEvent;
};

type ProgressionResponse = { ok: boolean; progression?: LedgerProgression; error?: string };
type TimelineResponse = {
  ok: boolean;
  accomplishment_timeline?: { items?: AccomplishmentEvent[]; next_cursor?: string | null; has_more?: boolean };
  error?: string;
};
type CurrentBestResponse = {
  ok: boolean;
  current_bests?: { items?: CurrentBest[] };
  error?: string;
};

export type LedgerRequestFailureKind = 'unauthorized' | 'unavailable' | 'error';

export class LedgerRequestError extends Error {
  readonly status: number;
  readonly kind: LedgerRequestFailureKind;

  constructor(status: number, detail?: string) {
    super(detail || `Ledger request failed (${status}).`);
    this.name = 'LedgerRequestError';
    this.status = status;
    this.kind = status === 401 || status === 403
      ? 'unauthorized'
      : status === 404 || status === 410
        ? 'unavailable'
        : 'error';
  }
}

async function requireJson<T extends { ok: boolean; error?: string }>(path: string): Promise<T> {
  const response = await fetchJson<T>(path, { method: 'GET', auth: true });
  if (!response.ok || !response.json?.ok) {
    throw new LedgerRequestError(response.status, response.json?.error);
  }
  return response.json;
}

export async function fetchLedgerProgression(range: LedgerRange = '90d'): Promise<LedgerProgression> {
  const payload = await requireJson<ProgressionResponse>(`/athletes/mobile/progression?range=${encodeURIComponent(range)}`);
  return payload.progression ?? {};
}

export type AccomplishmentPage = Readonly<{
  items: AccomplishmentEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}>;

export async function fetchLedgerAccomplishmentPage(limit = 24, cursor?: string | null): Promise<AccomplishmentPage> {
  const params = new URLSearchParams({ limit: String(Math.max(1, Math.min(limit, 50))) });
  if (cursor) params.set('cursor', cursor);
  const payload = await requireJson<TimelineResponse>(`/workouts/mobile/accomplishments?${params.toString()}`);
  const page = payload.accomplishment_timeline;
  return {
    items: page?.items ?? [],
    nextCursor: page?.next_cursor ?? null,
    hasMore: Boolean(page?.has_more && page?.next_cursor),
  };
}

export async function fetchLedgerAccomplishments(limit = 24): Promise<AccomplishmentEvent[]> {
  return (await fetchLedgerAccomplishmentPage(limit)).items;
}

/**
 * Reads the canonical accomplishment timeline without creating a second reward
 * projection. Ledger history surfaces use this when a single recent page would
 * hide older PRs or earned volume medallions.
 */
export async function fetchLedgerAccomplishmentHistory(maxPages = 20): Promise<AccomplishmentEvent[]> {
  const items: AccomplishmentEvent[] = [];
  let cursor: string | null = null;

  for (let pageIndex = 0; pageIndex < Math.max(1, maxPages); pageIndex += 1) {
    const page = await fetchLedgerAccomplishmentPage(50, cursor);
    items.push(...page.items);
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export async function fetchLedgerCurrentBests(): Promise<CurrentBest[]> {
  const payload = await requireJson<CurrentBestResponse>('/workouts/mobile/accomplishments/current-bests?scope=career&limit=24');
  return payload.current_bests?.items ?? [];
}

export function kgToDisplay(valueKg: number, unit: LedgerUnit): number {
  return kilogramsToDisplayValue(valueKg, unit);
}

export function displayWeight(valueKg: number | null | undefined, unit: LedgerUnit, fallback = '—'): string {
  if (valueKg === null || valueKg === undefined || !Number.isFinite(valueKg)) return fallback;
  const converted = kgToDisplay(valueKg, unit);
  const rounded = unit === 'kg' ? Math.round(converted * 2) / 2 : Math.round(converted / 5) * 5;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function displayCalculatedWeight(valueKg: number | null | undefined, unit: LedgerUnit, fallback = '—'): string {
  if (valueKg === null || valueKg === undefined || !Number.isFinite(valueKg)) return fallback;
  return formatCalculatedWeightValue(kgToDisplay(valueKg, unit), unit) || fallback;
}

export function canonicalLiftKey(value?: string | null): 'squat' | 'bench' | 'deadlift' | null {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.includes('squat')) return 'squat';
  if (normalized.includes('bench')) return 'bench';
  if (normalized.includes('deadlift')) return 'deadlift';
  return null;
}

export function bestForLift(items: CurrentBest[], lift: string, metric: 'weight' | 'e1rm'): CurrentBest | null {
  const key = canonicalLiftKey(lift);
  return items
    .filter((item) => canonicalLiftKey(item.core_movement_key || item.movement_label) === key && item.metric === metric)
    .sort((left, right) => right.best_value - left.best_value)[0] ?? null;
}
