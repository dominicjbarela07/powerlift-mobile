import {
  formatCalculatedWeightDeltaFromKg,
  formatCalculatedWeightFromKg,
  formatWeightFromKg,
  normalizeDisplayWeightUnit,
  type DisplayWeightUnit,
} from './display-units';
import type { CoachTeamBriefResponse, CoachPrPerformance } from './coach-mobile';

export type TeamBriefHighlight = CoachTeamBriefResponse['highlights'][number];

function number(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number(value));
}

function effort(performance?: CoachPrPerformance | null) {
  if (performance?.rpe != null) return ` @${number(performance.rpe)} RPE`;
  if (performance?.rir != null) return ` @${number(performance.rir)} RIR`;
  return '';
}

export function formatPrPerformance(
  performance: CoachPrPerformance | null | undefined,
  unit: DisplayWeightUnit,
) {
  if (!performance) return null;
  const load = formatWeightFromKg(performance.weight_kg, unit);
  const reps = performance.reps == null ? null : `${performance.reps} rep${performance.reps === 1 ? '' : 's'}`;
  if (!load && !reps) return null;
  return `${[load, reps].filter(Boolean).join(' × ')}${effort(performance)}`;
}

function metricComparison(row: TeamBriefHighlight, unit: DisplayWeightUnit) {
  const kind = String(row.pr_type || '').toUpperCase();
  if (kind.includes('E1RM')) {
    const current = formatCalculatedWeightFromKg(row.current_value, unit);
    const prior = formatCalculatedWeightFromKg(row.prior_value, unit);
    const delta = formatCalculatedWeightDeltaFromKg(row.delta, unit, 'signed');
    return [current ? `e1RM ${current}` : null, prior ? `Previous ${prior}` : null, delta].filter(Boolean).join(' · ');
  }
  if (kind.includes('RPE EFFICIENCY')) {
    const improvement = row.delta == null ? null : Math.abs(Number(row.delta));
    return improvement == null ? null : `+${number(improvement)} RPE efficiency`;
  }
  const delta = formatCalculatedWeightDeltaFromKg(row.delta, unit, 'signed');
  return delta;
}

export function presentTeamBriefHighlight(row: TeamBriefHighlight) {
  const unit = normalizeDisplayWeightUnit(row.preferred_units);
  if (row.type !== 'pr') {
    return {
      title: row.title,
      badge: null,
      primary: row.supporting_line || 'Evidence recorded',
      comparison: null,
      date: null,
      unit,
    };
  }
  const current = formatPrPerformance(row.current_performance, unit)
    || (String(row.pr_type || '').toUpperCase().includes('E1RM')
      ? formatCalculatedWeightFromKg(row.current_value, unit)
      : null)
    || 'Performance evidence recorded';
  const prior = formatPrPerformance(row.prior_performance, unit);
  const metric = metricComparison(row, unit);
  const comparison = row.first_record
    ? 'First recorded best'
    : [prior ? `Previous: ${prior}` : row.prior_value != null ? `Previous: ${formatCalculatedWeightFromKg(row.prior_value, unit)}` : null, metric]
      .filter(Boolean)
      .join(' · ');
  return {
    title: row.title,
    badge: row.pr_type || 'PR',
    primary: current,
    comparison: comparison || 'Prior comparison unavailable',
    date: row.occurred_at
      ? new Date(`${row.occurred_at.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null,
    unit,
  };
}
