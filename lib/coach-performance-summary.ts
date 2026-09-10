import type { CoachingPerformance } from './coach-performance';
import type { AccomplishmentEvent } from './ledger-data';
import type { LedgerAccessoryProgress, LedgerExplorationIndex } from './ledger-exploration';
import type { CoreVariantMovement, LedgerCoreVariantsStory } from './ledger-variants';
import { convertDisplayWeightValue, formatCalculatedWeightFromKg, parseDisplayWeightUnit, type DisplayWeightUnit } from './display-units';

export const PERFORMANCE_PREVIEW_LIMITS = { observations: 3, accessories: 2, variants: 1, checkIn: 2 } as const;
const day = (value?: string | null) => String(value || '').slice(0, 10);
const epoch = (value?: string | null) => Date.parse(`${day(value)}T12:00:00Z`) || 0;
const daysBetween = (a: string, b: string) => (epoch(b) - epoch(a)) / 86400000;
const load = (value: number, unit: DisplayWeightUnit) => formatCalculatedWeightFromKg(value, unit) || '—';
const signed = (value: number) => `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}`;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

type PerformedTask = { weight_kg: number; reps?: number | null; rpe?: number | null; rir?: number | null };
/** Preserve the kind of evidence: same load/reps with less effort is not a load PR. */
export function performanceTaskChange(prior: PerformedTask, current: PerformedTask, unit: DisplayWeightUnit) {
  const task = `${load(prior.weight_kg, unit)} × ${prior.reps ?? '—'} → ${load(current.weight_kg, unit)} × ${current.reps ?? '—'}`;
  if (prior.weight_kg !== current.weight_kg || prior.reps !== current.reps) return task;
  const effort = prior.rir != null && current.rir != null && prior.rir !== current.rir ? `RIR ${prior.rir} → ${current.rir}`
    : prior.rpe != null && current.rpe != null ? `RPE ${prior.rpe} → ${current.rpe}` : null;
  return effort ? `${load(current.weight_kg, unit)} × ${current.reps ?? '—'} · ${effort}` : task;
}

export function performanceRecordDetail(event: AccomplishmentEvent, unit: DisplayWeightUnit) {
  const reps = event.evidence?.rep_count ?? event.evidence?.actual_reps;
  const metric = event.event_type === 'CORE_E1RM_PR' ? 'Estimated 1RM PR'
    : event.event_type === 'CORE_REP_MAX_PR' ? `${typeof reps === 'number' ? `${reps}-rep max` : 'Rep max'} PR` : 'Weight PR';
  const sourceUnit = parseDisplayWeightUnit(event.unit);
  const value = sourceUnit && event.current_value != null ? load(convertDisplayWeightValue(event.current_value, sourceUnit, 'kg'), unit) : null;
  return `${event.movement_label || 'Movement'} · ${metric}${value ? ` · ${value}` : ''}`;
}

export function summarizeRecovery(data: CoachingPerformance | null) {
  const end = day(data?.range?.end_date);
  const start = day(data?.range?.start_date);
  const inRange = (date: string) => Boolean(start && end && day(date) >= start && day(date) <= end);
  const bodyweight = [...new Map((data?.coaching_context.bodyweight || [])
    .filter((point) => inRange(point.training_date) && Number.isFinite(point.reported_bodyweight_kg) && point.reported_bodyweight_kg > 0)
    .map((point) => [day(point.training_date), point])).values()].sort((a, b) => a.training_date.localeCompare(b.training_date));
  const readiness = [...new Map((data?.coaching_context.readiness || [])
    .filter((point) => inRange(point.date) && Number.isFinite(point.value) && point.value >= 1 && point.value <= 5)
    .map((point) => [day(point.date), point])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const recent = readiness.filter((point) => daysBetween(point.date, end) < 7);
  const prior = readiness.filter((point) => daysBetween(point.date, end) >= 7 && daysBetween(point.date, end) < 14);
  const recentAverage = average(recent.map((point) => point.value));
  const priorAverage = average(prior.map((point) => point.value));
  const latest = data?.coaching_context.latest_readiness;
  const checkIn = latest && inRange(latest.date) ? [
    { label: 'Energy', value: latest.energy, suffix: '/5', priority: latest.energy != null && latest.energy <= 2 ? 5 : 1 },
    { label: 'Stress', value: latest.stress, suffix: '/5', priority: latest.stress != null && latest.stress >= 4 ? 5 : 0 },
    { label: 'Sleep', value: latest.sleep_hours, suffix: 'h', priority: latest.sleep_hours != null && latest.sleep_hours < 6 ? 6 : 3 },
    { label: 'Soreness', value: latest.soreness, suffix: '/5', priority: latest.soreness != null && latest.soreness >= 4 ? 4 : 0 },
    { label: 'Sleep quality', value: latest.sleep_quality, suffix: '/5', priority: latest.sleep_quality != null && latest.sleep_quality <= 2 ? 4 : 0 },
  ].filter((item) => item.value != null).sort((a, b) => b.priority - a.priority).slice(0, PERFORMANCE_PREVIEW_LIMITS.checkIn) : [];
  return { bodyweight, latestWeight: bodyweight.at(-1)?.reported_bodyweight_kg,
    weightChange: bodyweight.length >= 2 ? bodyweight.at(-1)!.reported_bodyweight_kg - bodyweight[0].reported_bodyweight_kg : null,
    readiness, recentAverage, recentCount: recent.length, latestReadiness: readiness.at(-1),
    readinessChange: recent.length >= 2 && prior.length >= 2 ? Number((recentAverage! - priorAverage!).toFixed(1)) : null,
    checkIn, checkInDate: latest?.date };
}

function accessoryMerit(row: LedgerAccessoryProgress) {
  const c = row.comparison;
  const loadGain = c.load_direction === 'lower_is_better' ? -(c.load_delta_kg || 0) : c.load_delta_kg || 0;
  if (loadGain > 0.05) return 80 + Math.min(10, loadGain / Math.max(1, row.prior.weight_kg) * 100);
  if ((c.reps_delta || 0) > 0) return 75 + Math.min(10, c.reps_delta! * 2);
  if ((c.effort_reserve_delta || 0) > 0) return 70 + Math.min(10, c.effort_reserve_delta! * 2);
  return 0;
}
function variantMerit(row: CoreVariantMovement) {
  const p = row.latest_progression;
  if (!p) return 0;
  if (p.kind === 'more_weight_same_reps' && p.load_delta_kg > 0.05) return 80 + Math.min(10, p.load_delta_kg / Math.max(1, p.prior.weight_kg) * 100);
  if (p.kind === 'more_reps_same_weight' && p.reps_delta > 0) return 75 + Math.min(10, p.reps_delta * 2);
  if (p.kind === 'lower_effort_same_task' && Math.abs(p.effort_delta || 0) > 0) return 70;
  return 0;
}
function recency(date: string, end: string) {
  return Math.max(0, 14 - Math.max(0, daysBetween(date, end))) * 0.5;
}
export type PerformanceObservation = {
  id: string; kind: 'strength' | 'accessory' | 'variant' | 'output' | 'readiness' | 'record';
  title: string; detail: string; date: string; score: number;
  room: string; params?: Record<string, string>;
};

/** Bounded previews, with exact movement/equipment identity retained. No inferred carryover. */
export function buildPerformanceSummary({ data, exploration, variants, prs = [], unit }: {
  data: CoachingPerformance | null; exploration: LedgerExplorationIndex | null;
  variants: LedgerCoreVariantsStory | null; prs?: readonly AccomplishmentEvent[]; unit: DisplayWeightUnit;
}) {
  const athleteId = data?.athlete?.id;
  // Even a late successful response for a previous athlete cannot enter this summary.
  const accessories = athleteId && exploration?.athlete.id === athleteId ? exploration.accessories : null;
  const core = athleteId && variants?.athlete.id === athleteId ? variants : null;
  const end = day(data?.range?.end_date);
  const start = day(data?.range?.start_date);
  const inRange = (date?: string | null) => Boolean(date && day(date) >= start && day(date) <= end);
  const rank = <T,>(rows: T[], score: (row: T) => number, date: (row: T) => string, id: (row: T) => string) => [...rows].sort((a, b) =>
    (score(b) + recency(date(b), end)) - (score(a) + recency(date(a), end)) || epoch(date(b)) - epoch(date(a)) || id(a).localeCompare(id(b)));
  const accessoryProgress = rank((accessories?.progress || []).filter((p) => accessoryMerit(p) > 0 && inRange(p.occurred_on)
    && accessories?.movements.some((m) => m.id === p.movement_id)), accessoryMerit, (p) => p.occurred_on, (p) => p.identity_key);
  // One preview per governed movement; equipment identity remains in the selected evidence.
  const distinctAccessories = accessoryProgress.filter((p, index, rows) => rows.findIndex((r) => r.movement_id === p.movement_id) === index);
  const accessoryPreview = distinctAccessories.slice(0, PERFORMANCE_PREVIEW_LIMITS.accessories);
  const variantProgress = rank((core?.movements || []).filter((m) => m.core_movement_id > 0 && ['squat', 'bench', 'deadlift'].includes(m.family)
    && variantMerit(m) > 0 && inRange(m.latest_progression?.occurred_on)), variantMerit, (m) => m.latest_progression!.occurred_on, (m) => String(m.core_movement_id));
  const variantPreview = variantProgress.slice(0, PERFORMANCE_PREVIEW_LIMITS.variants);
  const recovery = summarizeRecovery(data);
  const observations: PerformanceObservation[] = [];
  for (const lift of data?.big_three_arc?.lifts || []) {
    const c = lift.strength_lenses?.comparable_performance;
    if (c?.status !== 'supported' || !c.kind || !c.from || !c.to || c.from.weight_kg == null || c.to.weight_kg == null || !inRange(c.to.date)) continue;
    const label = c.kind === 'more_reps_same_weight' ? 'more reps at the same load' : c.kind === 'lower_effort_same_task' ? 'lower effort at the same task' : 'more load at the same reps';
    observations.push({ id: `strength:${lift.key}`, kind: 'strength', title: `${lift.label}: ${label}`,
      detail: performanceTaskChange({ ...c.from, weight_kg: c.from.weight_kg }, { ...c.to, weight_kg: c.to.weight_kg }, unit),
      date: day(c.to.date), score: 85, room: 'strength', params: { lift: lift.key! } });
  }
  for (const p of distinctAccessories.slice(PERFORMANCE_PREVIEW_LIMITS.accessories)) {
    const movement = accessories!.movements.find((m) => m.id === p.movement_id)!;
    observations.push({ id: `accessory:${p.identity_key}`, kind: 'accessory', title: movement.name,
      detail: `${performanceTaskChange(p.prior, p.current, unit)}${p.assisted ? ' · assistance' : ''}`,
      date: p.occurred_on, score: accessoryMerit(p), room: `movement/${p.movement_id}` });
  }
  for (const m of variantProgress.slice(PERFORMANCE_PREVIEW_LIMITS.variants)) {
    const p = m.latest_progression!;
    observations.push({ id: `variant:${m.core_movement_id}`, kind: 'variant', title: `${m.name} · ${m.parent_lift_label} variant`,
      detail: performanceTaskChange(p.prior, p.current, unit),
      date: p.occurred_on, score: variantMerit(m), room: `variant/${m.core_movement_id}` });
  }
  const context = data?.coaching_context;
  const assigned = data?.consistency?.sessions_assigned || 0;
  const completion = data?.consistency?.completion_rate_pct;
  if (assigned >= 3 && completion != null && completion < 85) observations.push({ id: 'output:execution', kind: 'output', title: 'Completion is below 85%',
    detail: `${data?.consistency?.sessions_completed || 0} of ${assigned} planned Sessions completed in this period.`, score: 90, date: end, room: 'archive' });
  if (context && Math.abs(context.volume_change_pct || 0) >= 10) observations.push({ id: 'output:volume', kind: 'output', title: `Volume ${context.volume_change_pct! > 0 ? 'rose' : 'fell'} with ${context.working_sets === context.comparison.set_count ? 'the same number of' : context.working_sets > context.comparison.set_count ? 'more' : 'fewer'} working sets`,
    detail: `${context.comparison.set_count} → ${context.working_sets} sets across consecutive ${context.period_days}-day periods.`, score: 68, date: end, room: 'archive' });
  if (recovery.readinessChange != null && Math.abs(recovery.readinessChange) >= 0.5) observations.push({ id: 'readiness:change', kind: 'readiness', title: recovery.readinessChange < 0 ? 'Recent readiness is lower' : 'Recent readiness is higher',
    detail: `${signed(recovery.readinessChange)} /5 versus the prior 7 days · ${recovery.recentCount} reported days.`, score: 95, date: recovery.latestReadiness!.date, room: 'journey' });
  const recentPrs = prs.filter((event) => inRange(event.workout_date || event.occurred_at));
  // PRs/standing have one home in Athlete Record, not a second signal beside the hero.
  const ranked = rank(observations, (o) => o.score, (o) => o.date, (o) => o.id);
  const kinds = new Set<string>();
  const preview = ranked.filter((item) => { if (kinds.has(item.kind)) return false; kinds.add(item.kind); return true; }).slice(0, PERFORMANCE_PREVIEW_LIMITS.observations);
  return { accessories, accessoryPreview, accessoryProgressCount: distinctAccessories.length, core, variantPreview,
    observations: [...preview, ...ranked.filter((item) => !preview.includes(item))], observationPreview: preview, recovery,
    recentPrs, hasOutput: Boolean(context?.working_sets || assigned),
    hasSupplemental: Boolean(accessories?.summary.movement_count || core?.movements.length),
    hasRecovery: Boolean(recovery.bodyweight.length || recovery.readiness.length || recovery.checkIn.length) };
}
