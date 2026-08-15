export const ATHLETE_CALENDAR_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const ATHLETE_CALENDAR_DAYS_PER_WEEK = ATHLETE_CALENDAR_WEEKDAYS.length;
export const ATHLETE_CALENDAR_WEEKS_PER_MONTH = 6;

export type AthleteCalendarBlockRange = {
  id?: number | string;
  start: string;
  end: string;
  label: string;
};

export type AthleteCalendarBlockTransition = {
  key: string;
  blockId?: number | string;
  blockName: string;
  startDate: string;
  weekStartDate: string;
};

/**
 * Builds the canonical Sunday-first six-week Calendar matrix.
 *
 * Adjacent-month dates remain real cells so every rendered row has exactly
 * seven columns and the weekday header always shares the same day index.
 */
export function athleteCalendarWeeksForMonth(month: Date): Date[][] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstCell = new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth(),
    1 - firstOfMonth.getDay(),
  );

  return Array.from({ length: ATHLETE_CALENDAR_WEEKS_PER_MONTH }, (_, weekIndex) => (
    Array.from({ length: ATHLETE_CALENDAR_DAYS_PER_WEEK }, (_, weekdayIndex) => {
      const dayOffset = weekIndex * ATHLETE_CALENDAR_DAYS_PER_WEEK + weekdayIndex;
      return new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + dayOffset);
    })
  ));
}

/**
 * Projects canonical, date-only Training Block starts onto the Calendar's
 * Sunday-first week rows. Date-only arithmetic deliberately avoids timestamp
 * conversion so an athlete's Training date cannot shift at a UTC boundary.
 *
 * Cross-month rows are owned by the month containing the row's Sunday. This
 * keeps a duplicated six-week month matrix from rendering the same transition
 * twice while placing Jul 27 directly above the Jul 26-Aug 1 row, for example.
 */
export function athleteCalendarBlockTransitionsForMonth(
  ranges: AthleteCalendarBlockRange[],
  month: Date,
): Map<string, AthleteCalendarBlockTransition[]> {
  const ownerMonth = formatMonthKey(month.getFullYear(), month.getMonth() + 1);
  const transitions = new Map<string, AthleteCalendarBlockTransition[]>();
  const seen = new Set<string>();

  for (const range of [...ranges].sort(compareBlockRanges)) {
    const weekStartDate = athleteCalendarWeekStartYmd(range.start);
    if (!weekStartDate || weekStartDate.slice(0, 7) !== ownerMonth) continue;

    const identity = String(range.id ?? range.label);
    const key = `block:${identity}:${range.start}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const bucket = transitions.get(weekStartDate) || [];
    bucket.push({
      key,
      blockId: range.id,
      blockName: range.label,
      startDate: range.start,
      weekStartDate,
    });
    transitions.set(weekStartDate, bucket);
  }

  return transitions;
}

export function athleteCalendarWeekStartYmd(value: string): string | null {
  const parts = parseDateOnly(value);
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return formatDateOnly(new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()));
}

export function formatAthleteCalendarBlockStartDate(value: string): string {
  const parts = parseDateOnly(value);
  if (!parts) return value;
  return `${MONTH_ABBREVIATIONS[parts.month - 1]} ${parts.day}`;
}

function compareBlockRanges(left: AthleteCalendarBlockRange, right: AthleteCalendarBlockRange) {
  const byDate = left.start.localeCompare(right.start);
  if (byDate) return byDate;
  return String(left.id ?? left.label).localeCompare(String(right.id ?? right.label));
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;
  return { year, month, day };
}

function formatDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

const MONTH_ABBREVIATIONS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;
