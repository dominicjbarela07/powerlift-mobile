export type CalendarTrainingRange = {
  id?: number | string;
  start: string;
  end: string;
  label: string;
};

export type CalendarProgramContext = {
  id?: number | string;
  name?: string | null;
  start: string;
  end: string;
};

function monthBounds(month: Date) {
  const start = [
    month.getFullYear(),
    String(month.getMonth() + 1).padStart(2, '0'),
    '01',
  ].join('-');
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = [
    endDate.getFullYear(),
    String(endDate.getMonth() + 1).padStart(2, '0'),
    String(endDate.getDate()).padStart(2, '0'),
  ].join('-');
  return { start, end };
}

export function calendarTrainingRangesForMonth(
  ranges: CalendarTrainingRange[],
  month: Date,
) {
  const bounds = monthBounds(month);
  return ranges
    .filter((range) => range.start <= bounds.end && range.end >= bounds.start)
    .sort((left, right) => left.start.localeCompare(right.start));
}

export function calendarTrainingRangeForDate(
  ranges: CalendarTrainingRange[],
  date: string,
) {
  return ranges.find((range) => range.start <= date && range.end >= date) || null;
}

export function calendarProgramIntersectsMonth(
  program: CalendarProgramContext | null | undefined,
  month: Date,
) {
  if (!program) return false;
  const bounds = monthBounds(month);
  return program.start <= bounds.end && program.end >= bounds.start;
}

export function calendarProgramStartsInMonth(
  program: CalendarProgramContext | null | undefined,
  month: Date,
) {
  if (!program) return false;
  const bounds = monthBounds(month);
  return program.start >= bounds.start && program.start <= bounds.end;
}

function parseYmdParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatStructureDate(value: string, includeYear: boolean) {
  const date = parseYmdParts(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
  });
}

export function formatCalendarStructureDate(value: string) {
  return formatStructureDate(value, true);
}

export function formatCalendarStructureRange(start: string, end: string) {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const includeStartYear = startYear !== endYear;
  return `${formatStructureDate(start, includeStartYear)} – ${formatStructureDate(end, true)}`;
}
