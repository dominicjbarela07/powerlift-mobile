export type CalendarRepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type CalendarEventMutation = {
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone: string;
  location: string | null;
  notes: string | null;
  repeat_rule: CalendarRepeatRule;
  alert_offset_minutes: number | null;
};

export type CalendarEventDraft = {
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  location: string;
  notes: string;
  repeatRule: CalendarRepeatRule;
  alertOffsetMinutes: number | null;
};

export type CalendarEventInitialValues = Partial<CalendarEventDraft>;

type PersistedCalendarEvent = {
  title?: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location?: string | null;
  notes?: string | null;
  repeatRule?: CalendarRepeatRule | null;
  alertOffsetMinutes?: number | null;
};

export const CALENDAR_REPEAT_OPTIONS: { value: CalendarRepeatRule; label: string }[] = [
  { value: 'none', label: 'Never' },
  { value: 'daily', label: 'Every Day' },
  { value: 'weekly', label: 'Every Week' },
  { value: 'monthly', label: 'Every Month' },
  { value: 'yearly', label: 'Every Year' },
];

export const CALENDAR_ALERT_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

export function calendarEventDraftFrom(
  event: PersistedCalendarEvent | null | undefined,
  date: string,
  initialValues: CalendarEventInitialValues = {},
): CalendarEventDraft {
  const startDate = event ? event.startsAt.slice(0, 10) : date;
  const exclusiveEndDate = event ? event.endsAt.slice(0, 10) : date;
  const inclusiveEnd = event?.allDay ? addYmdDays(exclusiveEndDate, -1) : exclusiveEndDate;
  return {
    title: event?.title || '',
    startDate,
    startTime: event ? event.startsAt.slice(11, 16) : '09:00',
    endDate: inclusiveEnd,
    endTime: event ? event.endsAt.slice(11, 16) : '10:00',
    allDay: event?.allDay || false,
    location: event?.location || '',
    notes: event?.notes || '',
    repeatRule: event?.repeatRule || 'none',
    alertOffsetMinutes: event?.alertOffsetMinutes ?? null,
    ...initialValues,
  };
}

export function eventMutationFromDraft(
  draft: CalendarEventDraft,
  timezoneOverride?: string | null,
): { payload: CalendarEventMutation } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = 'Title is required.';
  const startDate = parseDate(draft.startDate);
  const endDate = parseDate(draft.endDate);
  if (!startDate) errors.starts_at = 'Use YYYY-MM-DD.';
  if (!endDate) errors.ends_at = 'Use YYYY-MM-DD.';
  const start = startDate && (draft.allDay ? startDate : combine(startDate, draft.startTime));
  const end = endDate && (draft.allDay ? addLocalDays(endDate, 1) : combine(endDate, draft.endTime));
  if (!start) errors.starts_at ||= draft.allDay ? 'Use YYYY-MM-DD.' : 'Use a date and 24-hour time.';
  if (!end) errors.ends_at ||= draft.allDay ? 'Use YYYY-MM-DD.' : 'Use a date and 24-hour time.';
  if (start && end && end <= start) errors.ends_at = 'End must be after start.';
  if (!CALENDAR_REPEAT_OPTIONS.some((option) => option.value === draft.repeatRule)) {
    errors.repeat_rule = 'Choose a supported repeat rule.';
  }
  if (
    draft.alertOffsetMinutes !== null
    && (!Number.isInteger(draft.alertOffsetMinutes) || draft.alertOffsetMinutes < 0 || draft.alertOffsetMinutes > 525600)
  ) {
    errors.alert_offset_minutes = 'Choose an alert between the event time and one year before.';
  }
  if (Object.keys(errors).length || !start || !end) return { errors };

  const timezone = timezoneOverride || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let startsAt: string;
  let endsAt: string;
  try {
    startsAt = zonedIso(draft.startDate, draft.allDay ? '00:00' : draft.startTime, timezone);
    endsAt = zonedIso(
      draft.allDay ? addYmdDays(draft.endDate, 1) : draft.endDate,
      draft.allDay ? '00:00' : draft.endTime,
      timezone,
    );
  } catch {
    return { errors: { timezone: 'Use a valid timezone.' } };
  }

  return {
    payload: {
      title: draft.title.trim(),
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: draft.allDay,
      timezone,
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
      repeat_rule: draft.repeatRule,
      alert_offset_minutes: draft.alertOffsetMinutes,
    },
  };
}

export function calendarRepeatLabel(value: CalendarRepeatRule) {
  return CALENDAR_REPEAT_OPTIONS.find((option) => option.value === value)?.label || 'Never';
}

export function calendarAlertLabel(value: number | null) {
  const preset = CALENDAR_ALERT_OPTIONS.find((option) => option.value === value);
  if (preset) return preset.label;
  if (value === null) return 'None';
  if (value % 1440 === 0) {
    const days = value / 1440;
    return `${days} day${days === 1 ? '' : 's'} before`;
  }
  if (value % 60 === 0) {
    const hours = value / 60;
    return `${hours} hour${hours === 1 ? '' : 's'} before`;
  }
  return `${value} minutes before`;
}

export function createSingleSubmitGate() {
  let locked = false;
  return {
    tryLock() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
    isLocked() {
      return locked;
    },
  };
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return localYmd(date) === value ? date : null;
}

function combine(date: Date, time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}

function addLocalDays(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

function localYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addYmdDays(value: string, count: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + count));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function zonedIso(date: string, time: string, timezone: string) {
  const probe = new Date(`${date}T12:00:00Z`);
  const zoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(probe).find((part) => part.type === 'timeZoneName')?.value || 'GMT+00:00';
  const rawOffset = zoneName.replace('GMT', '');
  const offset = rawOffset === '' ? '+00:00' : /^[-+]\d{2}:\d{2}$/.test(rawOffset)
    ? rawOffset
    : rawOffset.replace(/^([-+])(\d):/, '$10$2:');
  return `${date}T${time}:00${offset}`;
}
