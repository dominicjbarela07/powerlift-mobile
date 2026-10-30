import type { AccomplishmentEvent, CurrentBest, LedgerProgression, StrengthSourcePerformance } from './ledger-data';
import { canonicalCompetitionLiftKey } from './strength-standard-identity';
import { kilogramsToDisplayValue } from './display-units';
import type { ArchiveItemType } from './ledger-archive';

export type RecordLift = 'squat' | 'bench' | 'deadlift';
export type LedgerSource = Readonly<{ type: ArchiveItemType; id: number }>;
export const RECORD_LIFTS = [
  { key: 'squat', label: 'Squat' }, { key: 'bench', label: 'Bench press' }, { key: 'deadlift', label: 'Deadlift' },
] as const;

export function eventSource(event: AccomplishmentEvent | undefined | null): LedgerSource | null {
  return event?.source_set_log_id && event.source_set_log_id > 0 ? { type: 'set', id: event.source_set_log_id } : null;
}
export function performanceSource(point?: StrengthSourcePerformance | null): LedgerSource | null {
  if (point?.source_set_log_id && point.source_set_log_id > 0) return { type: 'set', id: point.source_set_log_id };
  if (point?.source_type === 'historical_performance' && point.source_id && point.source_id > 0) return { type: 'historical_performance', id: point.source_id };
  return null;
}
export function recordProfile(key: RecordLift, progression: LedgerProgression | null, bests: readonly CurrentBest[]) {
  // A variant key must never qualify by a display-name or broad-family fallback.
  const exact = bests.filter(b => canonicalCompetitionLiftKey(b.core_movement_key) === key);
  const best = exact.filter(b => b.metric === 'weight' && Number.isFinite(b.best_value) && b.best_value > 0).sort((a,b) => b.best_value - a.best_value)[0] ?? null;
  const estimate = exact.filter(b => b.metric === 'e1rm' && Number.isFinite(b.best_value)).sort((a,b) => b.best_value - a.best_value)[0] ?? null;
  const live = progression?.big_three_arc?.lifts?.find(l => (canonicalCompetitionLiftKey(l.key) ?? ({squat:'squat',bench:'bench','bench press':'bench',deadlift:'deadlift'} as Record<string,string>)[(l.key||'').trim().toLowerCase()]) === key) ?? null;
  const lenses = live?.strength_lenses ?? null;
  const source = eventSource(best?.event);
  const reps = typeof best?.event?.evidence?.actual_reps === 'number' ? best.event.evidence.actual_reps : null;
  return { key, best, estimate, live, lenses, source, reps };
}
export function ledgerDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const d = new Date(`${value.slice(0,10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
export function recordEventLabel(event: AccomplishmentEvent) {
  if (event.event_type.includes('E1RM')) return 'Estimated 1RM record';
  if (event.event_type.includes('REP_MAX')) return 'Rep record';
  if (event.event_type.includes('WEIGHT')) return 'Load record';
  return event.event_type.toLowerCase().replace(/^core_/, '').replaceAll('_', ' ');
}

/** Literal display conversion for performed evidence. Zero remains valid;
 * plate-loading buckets and estimated-strength rounding do not apply. */
export function performedWeightValue(kg: number | null | undefined, unit: 'kg'|'lb') {
  if(kg==null || !Number.isFinite(kg))return '—';
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:unit==='kg'?2:1}).format(kilogramsToDisplayValue(kg,unit));
}
