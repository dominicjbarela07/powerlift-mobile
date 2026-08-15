export type AthleteCalendarMonthCompletionInput = {
  metricKind?: string | null;
  plannedCount?: number | null;
  dueCount?: number | null;
  dueCompletedCount?: number | null;
  completionPercent?: number | null;
};

export type AthleteCalendarMonthIndicator = {
  primary: string;
  label: 'SESSIONS' | 'PLANNED' | 'NO SESSIONS';
  percent: string | null;
  accessibilityLabel: string;
  authoritative: boolean;
};

export function resolveAthleteCalendarMonthIndicator(
  summary?: AthleteCalendarMonthCompletionInput | null,
): AthleteCalendarMonthIndicator {
  const authoritative = summary?.metricKind === 'session_completion_to_date';
  const planned = Math.max(0, Number(summary?.plannedCount || 0));

  if (authoritative) {
    const due = Math.max(0, Number(summary?.dueCount || 0));
    const completed = Math.min(due, Math.max(0, Number(summary?.dueCompletedCount || 0)));
    if (due > 0) {
      const percent = Math.max(0, Math.min(100, Number(summary?.completionPercent ?? Math.round((completed / due) * 100))));
      return {
        primary: `${completed}/${due}`,
        label: 'SESSIONS',
        percent: `${percent}%`,
        accessibilityLabel: `${completed} of ${due} Sessions due through today completed, ${percent} percent`,
        authoritative: true,
      };
    }
    if (planned > 0) {
      return {
        primary: String(planned),
        label: 'PLANNED',
        percent: null,
        accessibilityLabel: `${planned} future Session${planned === 1 ? '' : 's'} planned; no Session opportunities due yet`,
        authoritative: true,
      };
    }
    return {
      primary: '—',
      label: 'NO SESSIONS',
      percent: null,
      accessibilityLabel: 'No qualifying Sessions scheduled',
      authoritative: true,
    };
  }

  // Older API responses do not own completion-to-date semantics. Never turn
  // their completed/all ratio into a performance percentage.
  return planned > 0
    ? {
        primary: String(planned),
        label: 'PLANNED',
        percent: null,
        accessibilityLabel: `${planned} Session${planned === 1 ? '' : 's'} planned`,
        authoritative: false,
      }
    : {
        primary: '—',
        label: 'SESSIONS',
        percent: null,
        accessibilityLabel: 'Session completion summary unavailable',
        authoritative: false,
      };
}
