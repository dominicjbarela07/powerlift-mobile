import type {
  CoachHomeUpcomingSession,
  CoachMeetContext,
  CoachRosterAthlete,
} from '@/lib/coach-mobile';

export type CoachScheduleItem =
  | { kind: 'meet'; key: string; date: string; athlete: CoachRosterAthlete; meet: CoachMeetContext }
  | { kind: 'session'; key: string; date: string; session: CoachHomeUpcomingSession };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function canonicalMeetDate(value?: string | null): string | null {
  const raw = String(value || '').trim();
  const match = DATE_ONLY.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const verified = new Date(Date.UTC(year, month - 1, day));
  if (
    verified.getUTCFullYear() !== year
    || verified.getUTCMonth() !== month - 1
    || verified.getUTCDate() !== day
  ) return null;
  return raw;
}

export function normalizeCoachMeetContext(value?: CoachMeetContext | null): CoachMeetContext | null {
  const meetPlanId = Number(value?.meet_plan_id);
  const meetDate = canonicalMeetDate(value?.meet_date);
  if (!Number.isInteger(meetPlanId) || meetPlanId <= 0 || !meetDate) return null;
  return {
    meet_plan_id: meetPlanId,
    meet_name: String(value?.meet_name || '').trim() || null,
    meet_date: meetDate,
    days_until_meet: Number.isInteger(value?.days_until_meet)
      ? Number(value?.days_until_meet)
      : null,
  };
}

export function formatCoachMeetDate(value?: string | null): string {
  const date = canonicalMeetDate(value);
  if (!date) return 'Date unavailable';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function coachMeetTimingLabel(meet: CoachMeetContext): string {
  if (meet.days_until_meet === 0) return 'Today';
  if (meet.days_until_meet === 1) return 'Tomorrow';
  if (typeof meet.days_until_meet === 'number' && meet.days_until_meet > 1) {
    return `${meet.days_until_meet} days out`;
  }
  return formatCoachMeetDate(meet.meet_date);
}

/**
 * Merge canonical MeetPlan context from the relationship-scoped roster with
 * the existing upcoming Session projection. This is a presentation merge:
 * Meet Day identity, date, and eligibility remain backend-owned.
 */
export function coachScheduleItems(
  sessions: CoachHomeUpcomingSession[],
  athletes: CoachRosterAthlete[],
): CoachScheduleItem[] {
  const sessionItems: CoachScheduleItem[] = (sessions || [])
    .map((session) => ({
      kind: 'session',
      key: `session:${session.key}`,
      date: canonicalMeetDate(session.date) || '9999-12-31',
      session,
    }));
  const seenMeetPlans = new Set<number>();
  const meetItems: CoachScheduleItem[] = [];
  for (const athlete of athletes || []) {
    const meet = normalizeCoachMeetContext(athlete.meet_context);
    if (!meet || seenMeetPlans.has(meet.meet_plan_id)) continue;
    seenMeetPlans.add(meet.meet_plan_id);
    meetItems.push({
      kind: 'meet',
      key: `meet:${meet.meet_plan_id}`,
      date: meet.meet_date,
      athlete,
      meet,
    });
  }
  return [...sessionItems, ...meetItems].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder) return dateOrder;
    if (left.kind !== right.kind) return left.kind === 'meet' ? -1 : 1;
    return left.key.localeCompare(right.key);
  });
}
