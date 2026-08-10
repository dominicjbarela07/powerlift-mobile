import { resolveCalendarSessionStatus } from '@/lib/calendar-session-status';

export type AthleteHomeWeekSession = {
  id?: number | null;
  workout_id?: number | null;
  date?: string | null;
  status?: string | null;
  kind?: string | null;
};

export type AthleteHomeWeekDayState = 'empty' | 'session' | 'complete' | 'missed';

export type AthleteHomeWeekDay = {
  date: string;
  day: string;
  label: string;
  isToday: boolean;
  state: AthleteHomeWeekDayState;
  sessionCount: number;
  completedCount: number;
  missedCount: number;
  accessibilityLabel: string;
};

type BuildAthleteHomeWeekOptions = {
  todayDate: string;
  sessions?: AthleteHomeWeekSession[] | null;
  fallbackSessions?: AthleteHomeWeekSession[];
  empty?: boolean;
};

export function mergeAthleteHomeWeekPreview<T extends { week_preview?: AthleteHomeWeekSession[] | null }>(
  today: T,
  responsePayload?: { week_preview?: unknown } | null,
): T {
  return {
    ...today,
    week_preview: Array.isArray(responsePayload?.week_preview)
      ? responsePayload.week_preview as AthleteHomeWeekSession[]
      : today.week_preview,
  };
}

export function buildAthleteHomeWeek({
  todayDate,
  sessions,
  fallbackSessions = [],
  empty = false,
}: BuildAthleteHomeWeekOptions): AthleteHomeWeekDay[] {
  const current = parseDateKey(todayDate) ?? new Date();
  const dayIndex = (current.getDay() + 6) % 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - dayIndex);

  // The API week preview is authoritative, including when it is an empty list.
  // Glance records are retained only for older cached/API payloads without it.
  const source = Array.isArray(sessions) ? sessions : fallbackSessions;
  const sessionsByDate = source.reduce<Record<string, AthleteHomeWeekSession[]>>((acc, session) => {
    const key = scheduleDateKey(session.date);
    if (!key) return acc;
    (acc[key] ||= []).push(session);
    return acc;
  }, {});

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = isoDate(date);
    const daySessions = empty ? [] : (sessionsByDate[key] ?? []);
    const summary = summarizeDay(daySessions);
    const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      date: key,
      day,
      label,
      isToday: key === scheduleDateKey(todayDate),
      ...summary,
      accessibilityLabel: buildAccessibilityLabel(day, label, summary),
    };
  });
}

export function scheduleDateKey(value?: string | null) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const key = `${match[1]}-${match[2]}-${match[3]}`;
  return parseDateKey(key) ? key : '';
}

function summarizeDay(sessions: AthleteHomeWeekSession[]) {
  const active = sessions.filter((session) => {
    const lifecycle = resolveSessionLifecycle(session);
    return lifecycle === 'not_started'
      || lifecycle === 'in_progress'
      || lifecycle === 'completed'
      || lifecycle === 'missed';
  });
  const completedCount = active.filter((session) => resolveSessionLifecycle(session) === 'completed').length;
  const missedCount = active.filter((session) => resolveSessionLifecycle(session) === 'missed').length;
  const actionableCount = active.filter((session) => {
    const lifecycle = resolveSessionLifecycle(session);
    return lifecycle === 'not_started' || lifecycle === 'in_progress';
  }).length;
  const sessionCount = active.length;

  let state: AthleteHomeWeekDayState = 'empty';
  if (actionableCount > 0) state = 'session';
  else if (missedCount > 0) state = 'missed';
  else if (sessionCount > 0 && completedCount === sessionCount) state = 'complete';

  return { state, sessionCount, completedCount, missedCount };
}

function resolveSessionLifecycle(session: AthleteHomeWeekSession) {
  if (session.status) return resolveCalendarSessionStatus(session.status).lifecycle;
  if (String(session.kind || '').toLowerCase() === 'session' || session.workout_id || session.id) {
    return 'not_started' as const;
  }
  return resolveCalendarSessionStatus(session.kind).lifecycle;
}

function buildAccessibilityLabel(
  day: string,
  label: string,
  summary: ReturnType<typeof summarizeDay>,
) {
  const prefix = `${day}, ${label}`;
  if (summary.sessionCount === 0) return `${prefix}, no session`;
  if (summary.state === 'complete') {
    return `${prefix}, ${summary.sessionCount} ${pluralizeSession(summary.sessionCount)} complete`;
  }
  if (summary.state === 'missed') {
    return `${prefix}, ${summary.missedCount} missed ${pluralizeSession(summary.missedCount)}`;
  }
  if (summary.completedCount > 0) {
    return `${prefix}, ${summary.completedCount} of ${summary.sessionCount} sessions complete`;
  }
  return `${prefix}, ${summary.sessionCount} scheduled ${pluralizeSession(summary.sessionCount)}`;
}

function pluralizeSession(count: number) {
  return count === 1 ? 'session' : 'sessions';
}

function parseDateKey(value?: string | null) {
  const key = scheduleDateKeyUnchecked(value);
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;
  return date;
}

function scheduleDateKeyUnchecked(value?: string | null) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
