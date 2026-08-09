const WEEKDAY_LABELS = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
const MONDAY_FIRST_FALLBACK = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];

/**
 * Return the compact weekday label for the date displayed in a programming
 * week strip. The fallback is only used for an unscheduled week with no date.
 */
export function compactProgrammingWeekdayLabel(
  date: Date | null | undefined,
  fallbackIndex = 0,
): string {
  if (date instanceof Date && Number.isFinite(date.getTime())) {
    return WEEKDAY_LABELS[date.getDay()];
  }
  return MONDAY_FIRST_FALLBACK[
    Math.max(0, Number(fallbackIndex) || 0) % MONDAY_FIRST_FALLBACK.length
  ];
}
