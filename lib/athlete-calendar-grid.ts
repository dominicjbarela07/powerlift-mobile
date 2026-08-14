export const ATHLETE_CALENDAR_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const ATHLETE_CALENDAR_DAYS_PER_WEEK = ATHLETE_CALENDAR_WEEKDAYS.length;
export const ATHLETE_CALENDAR_WEEKS_PER_MONTH = 6;

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
