import type {
  CoachAttentionReason,
  CoachHomeResponse,
  CoachRosterAthlete,
  CoachRosterResponse,
} from '@/lib/coach-mobile';

type CoachHomeIdentity = {
  id?: number | null;
  user_id?: number | null;
  email?: string | null;
  role?: string | null;
  is_coach?: boolean;
  workspace_mode?: string | null;
  is_individual_workspace?: boolean;
  is_self_coached?: boolean;
};

export function coachHomeContextKey(user?: CoachHomeIdentity | null): string | null {
  if (!user) return null;
  const identity = String(user.email || '').trim().toLowerCase()
    || String(user.id ?? user.user_id ?? '').trim();
  if (!identity) return null;
  const role = user.is_coach || user.role === 'coach' ? 'coach' : String(user.role || 'athlete');
  const workspace =
    user.workspace_mode === 'individual' || user.is_individual_workspace || user.is_self_coached
      ? 'individual'
      : 'team';
  return `${role}:${identity}:${workspace}`;
}

export type CoachRosterV2Filter = 'all' | 'needs_attention' | 'programming' | 'active';

export function deriveCoachHomeFromRoster(payload: CoachRosterResponse): CoachHomeResponse {
  const byId = new Map((payload.athletes || []).map((athlete) => [athlete.id, athlete]));
  const attention = (payload.needs_attention || [])
    .map((item) => byId.get(item.athlete_id))
    .filter((athlete): athlete is CoachRosterAthlete => Boolean(athlete))
    .slice(0, 3);
  const recentActivity = (payload.athletes || [])
    .flatMap((athlete) => (athlete.recent_training || [])
      .filter((session) => session.evidence_mode === 'performed')
      .map((session) => ({
        athlete: {
          id: athlete.id,
          name: athlete.name,
          avatar_url: athlete.avatar_url,
          avatar_uploaded_at: athlete.avatar_uploaded_at,
        },
        session,
      })))
    .sort((left, right) => {
      const byDate = String(right.session.date || '').localeCompare(String(left.session.date || ''));
      return byDate || right.session.workout_id - left.session.workout_id;
    })
    .slice(0, 4);

  return {
    ok: true,
    generated_at: payload.generated_at,
    summary: {
      needs_you: payload.counts?.needs_attention || 0,
      reviews: payload.counts?.reviews || 0,
      programming: payload.counts?.programming || 0,
      check_ins: payload.counts?.check_ins || 0,
    },
    attention_athletes: attention,
    attention_total: payload.needs_attention_total || payload.counts?.needs_attention || attention.length,
    recent_activity: recentActivity,
    roster_total: payload.counts?.all || payload.athletes?.length || 0,
    athletes: payload.athletes || [],
  };
}

export function mergeCoachHomeWithRoster(
  home: CoachHomeResponse,
  roster: CoachRosterResponse,
  previousHome?: CoachHomeResponse | null,
): CoachHomeResponse {
  const derived = deriveCoachHomeFromRoster(roster);
  const previousById = new Map((previousHome?.athletes || []).map((athlete) => [athlete.id, athlete]));
  const homeById = new Map((home.attention_athletes || []).map((athlete) => [athlete.id, athlete]));
  const athletes = (roster.athletes || []).map((athlete) => {
    const previous = previousById.get(athlete.id);
    const attention = homeById.get(athlete.id);
    const fallback = attention || previous;
    if (!fallback) return athlete;

    // During rolling backend/client transitions, a roster row may omit deeper
    // evidence even though Home already rendered it. Missing fields must not
    // erase known-good evidence; explicit empty arrays/nulls still remain
    // authoritative and correctly clear obsolete values.
    return {
      ...previous,
      ...attention,
      ...athlete,
      status: athlete.status ?? attention?.status ?? previous?.status,
      current_training:
        athlete.current_training ?? attention?.current_training ?? previous?.current_training,
      readiness: athlete.readiness ?? attention?.readiness ?? previous?.readiness,
      recent_training: Array.isArray(athlete.recent_training)
        ? athlete.recent_training
        : Array.isArray(attention?.recent_training)
        ? attention.recent_training
        : previous?.recent_training,
      last_completed_session:
        Object.prototype.hasOwnProperty.call(athlete, 'last_completed_session')
          ? athlete.last_completed_session
          : Object.prototype.hasOwnProperty.call(attention || {}, 'last_completed_session')
          ? attention?.last_completed_session
          : previous?.last_completed_session,
      next_assigned_session:
        Object.prototype.hasOwnProperty.call(athlete, 'next_assigned_session')
          ? athlete.next_assigned_session
          : Object.prototype.hasOwnProperty.call(attention || {}, 'next_assigned_session')
          ? attention?.next_assigned_session
          : previous?.next_assigned_session,
    } as CoachRosterAthlete;
  });
  return {
    ...home,
    athletes,
    roster_total: roster.counts?.all || roster.athletes?.length || home.roster_total,
    // Keep the authoritative Home counters and capped lists, but let the
    // roster-derived evidence cover rolling backend deployments.
    attention_athletes: home.attention_athletes?.length
      ? home.attention_athletes
      : derived.attention_athletes,
    recent_activity: home.recent_activity?.length
      ? home.recent_activity
      : derived.recent_activity,
  };
}

export function sortCoachCommandCenterAthletes(athletes: CoachRosterAthlete[]) {
  const rank = { needs_attention: 0, monitor: 1, on_track: 2 } as const;
  return [...athletes].sort((left, right) => {
    const byStatus = rank[left.status.classification] - rank[right.status.classification];
    if (byStatus) return byStatus;
    return (left.stable_sort_key || left.name).localeCompare(right.stable_sort_key || right.name);
  });
}

export function coachTodaySessions(athletes: CoachRosterAthlete[], today = new Date()) {
  const key = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return athletes.flatMap((athlete) => (athlete.recent_training || [])
    .filter((session) => String(session.date || '').slice(0, 10) === key)
    .map((session) => ({ athlete, session })))
    .sort((left, right) => left.athlete.name.localeCompare(right.athlete.name));
}

export type CoachCommandCenterKpi = 'sessions' | 'reviews' | 'programming' | 'check_ins';

export function coachKpiAthletes(athletes: CoachRosterAthlete[], kind: CoachCommandCenterKpi, today = new Date()) {
  if (kind === 'sessions') {
    const ids = new Set(coachTodaySessions(athletes, today).map((item) => item.athlete.id));
    return athletes.filter((athlete) => ids.has(athlete.id));
  }
  if (kind === 'reviews') {
    return athletes.filter((athlete) => (
      Number(athlete.pending_video_reviews?.count || 0)
      + Number(athlete.pending_session_reviews?.count || 0)
    ) > 0);
  }
  return athletes.filter((athlete) => athlete.queue_membership?.includes(kind));
}

export function filterCoachRosterV2(
  athletes: CoachRosterAthlete[],
  filter: CoachRosterV2Filter,
  query = '',
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return athletes.filter((athlete) => {
    if (normalizedQuery && !athlete.name.toLocaleLowerCase().includes(normalizedQuery)) return false;
    if (filter === 'needs_attention') return athlete.status.classification === 'needs_attention';
    if (filter === 'programming') return athlete.queue_membership.includes('programming');
    if (filter === 'active') return athlete.current_training.status === 'active';
    return true;
  });
}

export function athleteTrainingLabel(athlete: Pick<CoachRosterAthlete, 'current_training'>) {
  const training = athlete.current_training;
  if (training.status !== 'active') return training.label;
  return [
    training.block_name || training.program_name,
    training.week_position && training.week_total
      ? `W${training.week_position} of ${training.week_total}`
      : null,
  ].filter(Boolean).join(' · ');
}

export function attentionActionLabel(reason?: CoachAttentionReason | null) {
  if (!reason) return 'View details';
  if (reason.category === 'programming') return 'Program next week';
  if (reason.category === 'reviews') return 'Open review';
  if (reason.category === 'messages') return 'Read message';
  if (reason.category === 'check_ins') return 'Open check-in';
  if (reason.reason_type === 'session_missed') return 'Review Session';
  return 'View evidence';
}

export function formatCoachRelativeDate(value?: string | null, today = new Date()) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const days = Math.round((parsed.getTime() - localToday.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === -1) return 'Yesterday';
  if (days === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
}

export function coachWeightUnit(preferredUnits?: string | null): 'kg' | 'lb' {
  return String(preferredUnits || '').toLowerCase().startsWith('lb') ? 'lb' : 'kg';
}

export function formatCoachWeight(valueKg?: number | null, preferredUnits?: string | null) {
  if (valueKg == null || !Number.isFinite(valueKg)) return '—';
  const unit = coachWeightUnit(preferredUnits);
  const value = unit === 'lb' ? valueKg * 2.2046226218 : valueKg;
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

export function formatCoachVolume(valueKg?: number | null, preferredUnits?: string | null) {
  if (valueKg == null || valueKg <= 0) return null;
  const unit = coachWeightUnit(preferredUnits);
  const value = unit === 'lb' ? valueKg * 2.2046226218 : valueKg;
  const display = value >= 10_000 ? `${(value / 1000).toFixed(1)}K` : Math.round(value).toLocaleString();
  return `${display} ${unit.toUpperCase()}`;
}

export function rosterInitials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SL';
}
