export type CoachAttentionReason = {
  athlete_id: number;
  reason_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  supporting_text?: string | null;
  category: 'needs_attention' | 'programming' | 'reviews' | 'messages' | 'check_ins';
  count: number;
  due_at?: string | null;
  source_id?: number | null;
  destination: { route: string; params?: Record<string, string | number | null> };
  updated_at?: string | null;
  resolution_policy: string;
};

export type CoachTrainingContext = {
  status: 'active' | 'no_active_program' | 'position_unavailable';
  label: string;
  program_id?: number;
  program_name?: string;
  block_id?: number;
  block_name?: string;
  week_position?: number | null;
  week_total?: number | null;
  session_position?: number | null;
  session_total?: number | null;
  week_tag?: { key: string; label: string } | null;
};

export type CoachRosterAthlete = {
  id: number;
  name: string;
  avatar_url?: string | null;
  avatar_uploaded_at?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
  is_self: boolean;
  relationship_state: string;
  stable_sort_key: string;
  status: {
    classification: 'on_track' | 'monitor' | 'needs_attention';
    label: string;
    tone: 'success' | 'warning' | 'danger';
  };
  attention_reasons: CoachAttentionReason[];
  primary_attention_reason?: CoachAttentionReason | null;
  queue_membership: string[];
  current_training: CoachTrainingContext;
  unread_messages: { thread_id?: number | null; count: number; last_message_at?: string | null };
  pending_video_reviews: { count: number; oldest?: string | null };
  pending_session_reviews: { count: number; oldest?: string | null };
  readiness: { score?: number | null; date?: string | null; label: string };
  last_completed_session?: CoachSessionReference | null;
  next_assigned_session?: CoachSessionReference | null;
  coach_context?: {
    pinned_note?: {
      id: number;
      title?: string | null;
      body_preview?: string | null;
      note_type?: string | null;
      updated_at?: string | null;
    } | null;
  };
  meet_context?: {
    meet_plan_id: number;
    meet_name?: string | null;
    meet_date?: string | null;
    days_until_meet?: number | null;
  } | null;
};

export type CoachSessionReference = {
  workout_id: number;
  label: string;
  date?: string | null;
  status?: string | null;
  block_name?: string | null;
};

export type CoachRosterFilter =
  | 'all'
  | 'needs_attention'
  | 'programming'
  | 'reviews'
  | 'messages'
  | 'check_ins';

export type CoachRosterResponse = {
  ok: boolean;
  athletes: CoachRosterAthlete[];
  counts: Record<CoachRosterFilter, number>;
  needs_attention: { athlete_id: number; reason: CoachAttentionReason }[];
  needs_attention_total: number;
  attention_cap: number;
  generated_at: string;
  pending_invites?: {
    id: number;
    athlete_first?: string | null;
    athlete_last?: string | null;
    athlete_email: string;
    status: string;
  }[];
  error?: string;
};

export type CoachTeamBriefResponse = {
  ok: boolean;
  generated_at: string;
  needs_attention_count: number;
  team_health: {
    athletes: number;
    on_track: number;
    monitor: number;
    needs_attention: number;
  };
  items: {
    key: string;
    section?: 'needs_attention' | 'coming_up' | 'blind_spots';
    headline: string;
    supporting_line: string;
    action_label: string;
    destination: { route: string; params?: Record<string, string | number | null> };
  }[];
  error?: string;
};

export function openCoachDestination(
  router: { push: (target: any) => void },
  destination: { route: string; params?: Record<string, string | number | null> },
) {
  router.push({
    pathname: destination.route as any,
    params: Object.fromEntries(
      Object.entries(destination.params || {})
        .filter(([, value]) => value != null)
        .map(([key, value]) => [key, String(value)]),
    ),
  } as any);
}
