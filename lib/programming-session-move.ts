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
