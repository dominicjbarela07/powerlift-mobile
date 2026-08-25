export type ProgrammingMoveWeek = {
  index: number;
  days: Array<{
    date?: string | null;
  }>;
};

export type ProgrammingMoveDestination = {
  week: number;
  date: string;
};

export type ProgrammingWeekDropZone = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Resolves an ISO calendar date against the already-rendered Programming Hub
 * roadmap. This keeps the post-move follow behavior on the same date-only
 * semantics as the week strip and avoids UTC conversion drift.
 */
export function programmingMoveDestination(
  weeks: ProgrammingMoveWeek[],
  targetDate: string
): ProgrammingMoveDestination | null {
  if (!isIsoCalendarDate(targetDate)) return null;
  for (const week of weeks) {
    if (week.days.some((day) => day.date === targetDate)) {
      return { week: week.index, date: targetDate };
    }
  }
  return null;
}

export function isSameProgrammingDate(currentDate: string, targetDate: string) {
  return currentDate === targetDate;
}

/**
 * Maps an absolute pointer position to one of the seven rendered Week days.
 * The vertical bound is intentional: releasing beside the day rail cancels
 * rather than silently moving a Session to a surprising date.
 */
export function programmingWeekDropDate(
  dates: (string | null | undefined)[],
  zone: ProgrammingWeekDropZone | null,
  absoluteX: number,
  absoluteY: number,
) {
  if (!zone || !Number.isFinite(absoluteX) || !Number.isFinite(absoluteY)) return null;
  if (zone.width <= 0 || zone.height <= 0) return null;
  if (
    absoluteX < zone.x
    || absoluteX > zone.x + zone.width
    || absoluteY < zone.y
    || absoluteY > zone.y + zone.height
  ) return null;

  const index = Math.min(
    dates.length - 1,
    Math.max(0, Math.floor(((absoluteX - zone.x) / zone.width) * dates.length)),
  );
  const date = dates[index];
  return date && isIsoCalendarDate(date) ? date : null;
}

/** Mirrors the server's quick-edit lifecycle guard for affordance only. */
export function canDragProgrammingSession(status?: string | null) {
  return ['draft', 'assigned'].includes(String(status || '').trim().toLowerCase());
}

function isIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
  );
}
