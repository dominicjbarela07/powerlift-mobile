export type CalendarTodayTarget = {
  date: string;
  timezone: string;
  monthStart: string;
  weekStart: string;
};

export function ymdInTimezone(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function resolveCalendarToday(
  instant: Date,
  trainingTimezone: string | null | undefined,
  deviceTimezone: string | null | undefined,
): CalendarTodayTarget {
  const timezone = validTimezone(trainingTimezone)
    || validTimezone(deviceTimezone)
    || 'America/Los_Angeles';
  const date = ymdInTimezone(instant, timezone);
  return {
    date,
    timezone,
    monthStart: `${date.slice(0, 7)}-01`,
    weekStart: addDays(date, -weekday(date)),
  };
}

export function rangeContainsDate(
  rangeStart: string | null | undefined,
  rangeEnd: string | null | undefined,
  date: string,
) {
  return Boolean(rangeStart && rangeEnd && rangeStart <= date && date < rangeEnd);
}

export function clockMinutesInTimezone(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function validTimezone(value: string | null | undefined): string | null {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return null;
  }
}

function weekday(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(value: string, count: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + count));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
