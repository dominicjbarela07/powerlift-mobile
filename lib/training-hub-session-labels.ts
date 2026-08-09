export type TrainingHubSessionLabelInput = {
  status?: string | null;
  kind?: string | null;
  timeliness?: string | null;
};

function normalized(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function dateKeyToUtc(value?: string | null) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const timestamp = Date.UTC(
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10) - 1,
    Number.parseInt(match[3], 10),
  );
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function trainingHubSessionDayLabel(
  sessionDate?: string | null,
  todayDate?: string | null,
) {
  const sessionTimestamp = dateKeyToUtc(sessionDate);
  if (sessionTimestamp == null) return 'Date not set';

  const todayTimestamp = dateKeyToUtc(todayDate);
  if (todayTimestamp != null) {
    const dayOffset = Math.round((sessionTimestamp - todayTimestamp) / 86_400_000);
    if (dayOffset === 0) return 'Today';
    if (dayOffset === 1) return 'Tomorrow';
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(new Date(sessionTimestamp));
}

export function trainingHubSessionStatusLabel({
  status,
  kind,
  timeliness,
}: TrainingHubSessionLabelInput) {
  const values = new Set([normalized(status), normalized(kind)]);
  const timing = normalized(timeliness);

  if (timing.includes('moved')) return 'Moved';
  if (values.has('completed') || values.has('logged') || values.has('done')) return 'Completed';
  if (values.has('in_progress')) return 'In Progress';
  if (values.has('incomplete')) return 'Incomplete';
  if (
    values.has('missed')
    || values.has('past_due')
    || normalized(status).startsWith('missed')
  ) {
    return 'Missed';
  }
  if (values.has('cancelled') || values.has('canceled')) return 'Canceled';
  return 'Not Started';
}
