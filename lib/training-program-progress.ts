const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function dateOrdinal(value?: string | null): number | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(timestamp / MILLISECONDS_PER_DAY);
}

export function resolveTrainingProgramProgress({
  startDate,
  endDate,
  today,
}: {
  startDate?: string | null;
  endDate?: string | null;
  today?: string | null;
}): number | null {
  const start = dateOrdinal(startDate);
  const end = dateOrdinal(endDate);
  const current = dateOrdinal(today);

  if (start == null || end == null || current == null || end < start) {
    return null;
  }
  if (current < start) return 0;
  if (current >= end) return 1;

  const totalDays = end - start + 1;
  const elapsedDays = current - start + 1;
  return elapsedDays / totalDays;
}
