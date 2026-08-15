export type CoachCalendarView = 'week' | 'month' | 'agenda';
export type CoachCalendarStatusFilter = 'all' | 'needs' | 'assigned' | 'in_progress' | 'completed' | 'draft';

export type CalendarDateRange = {
  start: Date;
  end: Date;
};

export const COACH_CALENDAR_WEEK_DAYS = 7;
export const COACH_CALENDAR_WEEK_WINDOW_WEEKS = 5;
export const COACH_CALENDAR_WEEK_BUFFER_WEEKS = 2;

export function toLocalYMD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromLocalYMD(value: string) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return new Date(Number.NaN);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfCalendarWeek(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function startOfCalendarMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

export function calendarRange(view: CoachCalendarView, anchor: Date): CalendarDateRange {
  if (view === 'week') {
    const start = startOfCalendarWeek(anchor);
    return { start, end: addCalendarDays(start, COACH_CALENDAR_WEEK_DAYS) };
  }
  if (view === 'month') {
    const start = startOfCalendarWeek(startOfCalendarMonth(anchor));
    return { start, end: addCalendarDays(start, 42) };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12, 0, 0, 0);
  return { start, end: addCalendarDays(start, 42) };
}

/**
 * Week mode keeps a bounded five-week surface mounted around the authoritative
 * week. This stays below the backend's 42-day range ceiling while ensuring an
 * adjacent week is already available before either ordinary edge is reached.
 */
export function coachCalendarWeekWindow(anchor: Date): CalendarDateRange {
  const authoritativeWeek = startOfCalendarWeek(anchor);
  const start = addCalendarDays(
    authoritativeWeek,
    -COACH_CALENDAR_WEEK_BUFFER_WEEKS * COACH_CALENDAR_WEEK_DAYS,
  );
  return {
    start,
    end: addCalendarDays(start, COACH_CALENDAR_WEEK_WINDOW_WEEKS * COACH_CALENDAR_WEEK_DAYS),
  };
}

export function coachCalendarRequestRange(view: CoachCalendarView, anchor: Date): CalendarDateRange {
  return view === 'week' ? coachCalendarWeekWindow(anchor) : calendarRange(view, anchor);
}

export function coachCalendarWeekIndex(visibleDate: Date, windowStart: Date) {
  const visibleWeek = startOfCalendarWeek(visibleDate);
  const firstWeek = startOfCalendarWeek(windowStart);
  return Math.round(
    (visibleWeek.getTime() - firstWeek.getTime())
      / (COACH_CALENDAR_WEEK_DAYS * 86_400_000),
  );
}

export function coachCalendarWindowNeedsShift(visibleDate: Date, windowStart: Date) {
  const weekIndex = coachCalendarWeekIndex(visibleDate, windowStart);
  return weekIndex < COACH_CALENDAR_WEEK_BUFFER_WEEKS
    || weekIndex >= COACH_CALENDAR_WEEK_WINDOW_WEEKS - COACH_CALENDAR_WEEK_BUFFER_WEEKS;
}

export function formatCalendarDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const parsed = fromLocalYMD(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, options || { weekday: 'short', month: 'short', day: 'numeric' });
}

export function calendarStatusLabel(status: string) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'in_progress') return 'In Progress';
  if (normalized === 'missed_excused') return 'Excused';
  if (!normalized) return 'Assigned';
  return normalized.replace(/_/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function calendarSessionNeedsAction(session: { status?: string; needs_session_review?: boolean }) {
  const status = String(session.status || '').toLowerCase();
  return ['missed', 'incomplete', 'draft'].includes(status) || !!session.needs_session_review;
}

export function calendarSessionMatchesStatus(
  session: { status?: string; needs_session_review?: boolean },
  filter: CoachCalendarStatusFilter
) {
  const status = String(session.status || '').toLowerCase();
  if (filter === 'all') return true;
  if (filter === 'needs') return calendarSessionNeedsAction(session);
  return status === filter;
}

export function isCalendarSessionMovable(session: { status?: string }) {
  const status = String(session.status || '').toLowerCase();
  return !['completed', 'logged', 'done'].includes(status);
}

export function sameAthleteDateMove(
  session: { athlete_id: number; date: string; status?: string },
  targetDate: string,
  targetAthleteId: number
) {
  if (!isCalendarSessionMovable(session)) return false;
  if (Number(session.athlete_id) !== Number(targetAthleteId)) return false;
  return !!targetDate && targetDate !== session.date;
}

export function isCoachCalendarDropTargetValid({
  session,
  destinationDate,
  today,
  targetAthleteId,
}: {
  session: { athlete_id: number; date: string; status?: string };
  destinationDate: string;
  today: string;
  targetAthleteId: number;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(destinationDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  if (destinationDate < today) return false;
  return sameAthleteDateMove(session, destinationDate, targetAthleteId);
}

export type CoachCalendarCellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function coachCalendarDateAtPoint(
  absoluteX: number,
  absoluteY: number,
  cells: ReadonlyMap<string, CoachCalendarCellRect>,
) {
  let match: string | null = null;
  cells.forEach((rect, date) => {
    if (match) return;
    if (
      absoluteX >= rect.x
      && absoluteX <= rect.x + rect.width
      && absoluteY >= rect.y
      && absoluteY <= rect.y + rect.height
    ) match = date;
  });
  return match;
}

function coachCalendarCountKey(status?: string) {
  const normalized = String(status || 'assigned').toLowerCase();
  if (['completed', 'logged', 'done'].includes(normalized)) return 'completed';
  return ['assigned', 'in_progress', 'draft', 'missed', 'missed_excused', 'incomplete'].includes(normalized)
    ? normalized
    : 'assigned';
}

export function withCoachCalendarSessionDate<
  TSession extends { workout_id: number; date: string; status?: string },
  TDay extends { date: string; sessions: TSession[]; counts: Record<string, number> },
>(days: TDay[], session: TSession, destinationDate: string): TDay[] {
  const nextSession = { ...session, date: destinationDate } as TSession;
  return days.map((day) => {
    const sessions = day.sessions.filter((candidate) => candidate.workout_id !== session.workout_id);
    if (day.date === destinationDate) sessions.push(nextSession);
    const counts: Record<string, number> = { ...day.counts, total: sessions.length };
    ['assigned', 'in_progress', 'completed', 'draft', 'missed', 'missed_excused', 'incomplete'].forEach((key) => {
      counts[key] = sessions.filter((candidate) => coachCalendarCountKey(candidate.status) === key).length;
    });
    return { ...day, counts, sessions };
  });
}

export function selectedAthleteLabel(
  athletes: Array<{ id: number; name: string }>,
  selectedIds: number[]
) {
  if (!selectedIds.length || selectedIds.length === athletes.length) return 'All Athletes';
  if (selectedIds.length === 1) {
    return athletes.find((athlete) => athlete.id === selectedIds[0])?.name || '1 Athlete';
  }
  return `${selectedIds.length} Athletes`;
}

export function monthGridRows<T>(items: T[]) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += 7) rows.push(items.slice(index, index + 7));
  return rows;
}
