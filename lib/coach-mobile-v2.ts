import type {
  CoachAttentionReason,
  CoachHomeResponse,
  CoachRosterAthlete,
  CoachRosterResponse,
} from '@/lib/coach-mobile';

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
  };
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
