export type CalendarSessionLifecycle =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'canceled'
  | 'other';

export type CalendarSessionStatusPresentation = {
  lifecycle: CalendarSessionLifecycle;
  label: string;
  tone: 'gold' | 'violet' | 'green' | 'red' | 'slate';
};

const COMPLETED_STATUSES = new Set(['completed', 'logged', 'done']);
const NOT_STARTED_STATUSES = new Set(['assigned', 'not_started', 'pending', 'scheduled']);
const IN_PROGRESS_STATUSES = new Set(['in_progress', 'active', 'started']);
const MISSED_STATUSES = new Set(['missed', 'missed_excused', 'incomplete', 'tardy']);
const CANCELED_STATUSES = new Set(['canceled', 'cancelled']);

export function resolveCalendarSessionStatus(
  status?: string | null,
): CalendarSessionStatusPresentation {
  const normalized = String(status || 'assigned').trim().toLowerCase();

  if (NOT_STARTED_STATUSES.has(normalized)) {
    return { lifecycle: 'not_started', label: 'Not Started', tone: 'gold' };
  }
  if (IN_PROGRESS_STATUSES.has(normalized)) {
    return { lifecycle: 'in_progress', label: 'In Progress', tone: 'violet' };
  }
  if (COMPLETED_STATUSES.has(normalized)) {
    return { lifecycle: 'completed', label: 'Completed', tone: 'green' };
  }
  if (MISSED_STATUSES.has(normalized)) {
    return { lifecycle: 'missed', label: 'Missed', tone: 'red' };
  }
  if (CANCELED_STATUSES.has(normalized)) {
    return { lifecycle: 'canceled', label: 'Canceled', tone: 'red' };
  }

  return {
    lifecycle: 'other',
    label: humanizeStatus(normalized),
    tone: 'slate',
  };
}

function humanizeStatus(status: string) {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'Not Started';
}
