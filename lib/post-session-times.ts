export type SessionTimeDraft = Readonly<{
  start: string;
  end: string;
}>;

export type ParsedSessionTimeDraft = Readonly<{
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}>;

const FORMAT = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/;

export function formatSessionDateTime(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function parseLocalDateTime(value: string): Date | null {
  const match = String(value || '').trim().match(FORMAT);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  if (
    parsed.getFullYear() !== Number(year)
    || parsed.getMonth() !== Number(month) - 1
    || parsed.getDate() !== Number(day)
    || parsed.getHours() !== Number(hour)
    || parsed.getMinutes() !== Number(minute)
  ) return null;
  return parsed;
}

export function createSessionTimeDraft(startedAt?: string | null, now = new Date()): SessionTimeDraft {
  const parsedStart = startedAt ? new Date(startedAt) : null;
  const fallbackStart = new Date(now.getTime() - (60 * 60 * 1000));
  const start = parsedStart && Number.isFinite(parsedStart.getTime()) ? parsedStart : fallbackStart;
  return Object.freeze({ start: formatSessionDateTime(start), end: formatSessionDateTime(now) });
}

export function parseSessionTimeDraft(
  draft: SessionTimeDraft,
): { value: ParsedSessionTimeDraft | null; error: string | null } {
  const start = parseLocalDateTime(draft.start);
  const end = parseLocalDateTime(draft.end);
  if (!start || !end) return { value: null, error: 'Use YYYY-MM-DD HH:MM for both session times.' };
  const durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (durationSeconds < 0) return { value: null, error: 'Session end must be after session start.' };
  if (durationSeconds > 24 * 60 * 60) return { value: null, error: 'Session duration cannot exceed 24 hours.' };
  return {
    value: Object.freeze({
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      durationSeconds,
    }),
    error: null,
  };
}
