import { resolveCalendarSessionStatus } from './calendar-session-status';

export type CalendarLensState =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'rest'
  | 'personal'
  | 'needs_attention';

export type CalendarDayTone = 'violet' | 'pink' | 'gold' | 'green' | 'red' | 'slate';
export type CalendarFilterId = 'all' | 'sessions' | 'personal' | 'completed' | 'attention';

export type CalendarStateInput = {
  sessionStatuses?: (string | null | undefined)[];
  personalItemCount?: number;
  checkInCount?: number;
  meetCount?: number;
};

/**
 * Resolves one canonical calendar lens state from canonical Session lifecycle
 * values. Priority is intentional: attention and active execution must never be
 * hidden by a completed or personal item on the same date.
 */
export function resolveCalendarLensState(input: CalendarStateInput): CalendarLensState {
  const lifecycles = (input.sessionStatuses || []).map((status) => resolveCalendarSessionStatus(status).lifecycle);
  if (lifecycles.includes('missed')) return 'needs_attention';
  if (lifecycles.includes('in_progress')) return 'in_progress';
  if (lifecycles.includes('not_started') || lifecycles.includes('other')) return 'assigned';
  if (lifecycles.includes('completed')) return 'completed';
  if ((input.personalItemCount || 0) > 0) return 'personal';
  return 'rest';
}

export function calendarDayMatchesFilter(input: CalendarStateInput, filter: CalendarFilterId): boolean {
  if (filter === 'all') return true;
  const state = resolveCalendarLensState(input);
  const lifecycles = (input.sessionStatuses || []).map((status) => resolveCalendarSessionStatus(status).lifecycle);
  if (filter === 'sessions') return lifecycles.some((lifecycle) => lifecycle !== 'canceled');
  if (filter === 'personal') return (input.personalItemCount || 0) > 0;
  if (filter === 'completed') return lifecycles.includes('completed');
  return state === 'needs_attention';
}

export function primaryCalendarDayTone(input: CalendarStateInput): CalendarDayTone {
  const state = resolveCalendarLensState(input);
  if (state === 'needs_attention') return 'red';
  if (state === 'in_progress') return 'gold';
  if (state === 'completed') return 'green';
  if (state === 'assigned') return 'violet';
  if (state === 'personal' || (input.personalItemCount || 0) > 0) return 'pink';
  if ((input.meetCount || 0) > 0) return 'pink';
  if ((input.checkInCount || 0) > 0) return 'slate';
  return 'slate';
}
