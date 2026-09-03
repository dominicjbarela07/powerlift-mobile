export type SessionTimeDraft = Readonly<{ start: Date; end: Date }>;

export type ParsedSessionTimeDraft = Readonly<{
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}>;

type ZonedSessionTimeParts = Readonly<{
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}>;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const EXPLICIT_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isValidTimeZone(value?: string | null): value is string {
  const candidate = String(value || '').trim();
  if (!candidate) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function resolveSessionTimeZone(preferred?: string | null, fallback?: string | null): string {
  if (isValidTimeZone(preferred)) return preferred;
  if (isValidTimeZone(fallback)) return fallback;
  return 'UTC';
}

export function parseSessionLifecycleInstant(value?: string | null): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const isoLike = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const normalized = EXPLICIT_TIME_ZONE.test(isoLike) ? isoLike : `${isoLike}Z`;
  const parsed = new Date(normalized);
  return isValidDate(parsed) ? parsed : null;
}

function timeZoneParts(value: Date, timeZone: string): ZonedSessionTimeParts | null {
  if (!isValidDate(value) || !isValidTimeZone(timeZone)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const result = {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
  return Object.values(result).every(Number.isFinite) ? result : null;
}

function sessionTimePartsToInstant(parts: ZonedSessionTimeParts, timeZone: string): Date | null {
  if (!isValidTimeZone(timeZone)) return null;
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  if (!Number.isFinite(targetUtc)) return null;
  let candidate = new Date(targetUtc);
  for (let pass = 0; pass < 3; pass += 1) {
    const observed = timeZoneParts(candidate, timeZone);
    if (!observed) return null;
    const observedUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, 0, 0);
    candidate = new Date(candidate.getTime() + (targetUtc - observedUtc));
  }
  const roundTrip = timeZoneParts(candidate, timeZone);
  if (!roundTrip || Object.keys(parts).some((key) => (
    roundTrip[key as keyof ZonedSessionTimeParts] !== parts[key as keyof ZonedSessionTimeParts]
  ))) return null;
  return candidate;
}

export function replaceSessionTimePart(current: Date, selectedTime: Date, timeZone: string): Date | null {
  const currentParts = timeZoneParts(current, timeZone);
  const selectedParts = timeZoneParts(selectedTime, timeZone);
  if (!currentParts || !selectedParts) return null;
  return sessionTimePartsToInstant({
    ...currentParts,
    hour: selectedParts.hour,
    minute: selectedParts.minute,
  }, timeZone);
}

function dateKey(value: Date, timeZone: string): string | null {
  const parts = timeZoneParts(value, timeZone);
  if (!parts) return null;
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function formatSessionTimeLabel(
  value: Date | null | undefined,
  options: { sessionDate?: string | null; timeZone: string; locale?: string },
): string {
  if (!isValidDate(value)) return 'Choose time';
  const selectedDate = dateKey(value, options.timeZone);
  const sessionDate = String(options.sessionDate || '').match(DATE_ONLY)?.[0] || null;
  const includeDate = Boolean(sessionDate && selectedDate && sessionDate !== selectedDate);
  return new Intl.DateTimeFormat(options.locale || 'en-US', {
    timeZone: options.timeZone,
    ...(includeDate ? { month: 'short' as const, day: 'numeric' as const } : {}),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(value);
}

export function createSessionTimeDraft(
  startedAt?: string | null,
  now = new Date(),
  completedDurationSeconds?: number | null,
): SessionTimeDraft {
  const safeNow = isValidDate(now) ? new Date(now.getTime()) : new Date();
  const start = parseSessionLifecycleInstant(startedAt) || new Date(safeNow.getTime() - 60 * 60 * 1000);
  const duration = completedDurationSeconds == null ? Number.NaN : Number(completedDurationSeconds);
  const end = Number.isFinite(duration) && duration > 0
    ? new Date(start.getTime() + duration * 1000)
    : safeNow;
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

export function parseSessionTimeDraft(
  draft: SessionTimeDraft,
): { value: ParsedSessionTimeDraft | null; error: string | null } {
  if (!isValidDate(draft.start) || !isValidDate(draft.end)) {
    return { value: null, error: 'Choose a valid start and end time.' };
  }
  const durationSeconds = Math.round((draft.end.getTime() - draft.start.getTime()) / 1000);
  if (durationSeconds < 0) return { value: null, error: 'Session end must be after session start.' };
  if (durationSeconds > 24 * 60 * 60) return { value: null, error: 'Session duration cannot exceed 24 hours.' };
  return {
    value: {
      startedAt: draft.start.toISOString(),
      endedAt: draft.end.toISOString(),
      durationSeconds,
    },
    error: null,
  };
}

export function resolveSessionCompletionTiming(
  draft: SessionTimeDraft,
  options: { manuallyCorrected?: boolean } = {},
): {
  value: ParsedSessionTimeDraft | null;
  durationUnavailable: boolean;
  error: string | null;
} {
  const parsed = parseSessionTimeDraft(draft);
  if (parsed.value) return { ...parsed, durationUnavailable: false };
  const durationSeconds = isValidDate(draft.start) && isValidDate(draft.end)
    ? Math.round((draft.end.getTime() - draft.start.getTime()) / 1000)
    : Number.NaN;
  if (!options.manuallyCorrected && durationSeconds > 24 * 60 * 60) {
    return { value: null, durationUnavailable: true, error: null };
  }
  return { ...parsed, durationUnavailable: false };
}
