export type CoachDestination = {
  route: string;
  params?: Record<string, string | number | null>;
};

export type CoachHomeActivityType =
  | 'completed_session'
  | 'video_submitted'
  | 'pr_achieved'
  | 'readiness_check_in'
  | 'programming_alert'
  | 'message_feedback';

export type CoachHomeActivity = {
  key: string;
  type: CoachHomeActivityType;
  state: 'active' | 'dismissed' | 'handled' | 'auto_resolved';
  athlete: {
    id: number;
    name: string;
    avatar_url?: string | null;
    preferred_units?: string | null;
  };
  title: string;
  subtitle?: string | null;
  occurred_at?: string | null;
  cleared_at?: string | null;
  priority: number;
  source: { type: string; id?: number | null };
  destination: CoachDestination;
  evidence: {
    set_count?: number;
    movement_count?: number;
    total_volume_kg?: number;
    video_count?: number;
    pr_count?: number;
    session_rpe?: number | null;
    muscle_keys?: string[];
    muscle_focus?: CoachSessionMuscleFocus | null;
    set_indexes?: number[];
    movement_name?: string | null;
    score?: number;
    delta?: number | null;
    history?: { date: string; score: number }[];
    sleep?: number;
    fatigue?: number;
    stress?: number;
    energy?: number;
    programmed_through_date?: string | null;
    days_remaining?: number | null;
    unread_count?: number;
    current_value?: number | null;
    event_type?: string | null;
    prior_value?: number | null;
    weight_kg?: number | null;
    reps?: number | null;
    rpe?: number | null;
    rir?: number | null;
    unit?: string | null;
    source_set_log_id?: number | null;
    source_revision?: number | null;
    record_count?: number;
    accomplishment_ids?: number[];
    record_types?: string[];
    records?: {
      id: number;
      event_type?: string | null;
      metric?: string | null;
      scope?: string | null;
      comparison_bucket?: string | null;
      current_value?: number | null;
      prior_value?: number | null;
      delta?: number | null;
      unit?: string | null;
      calculation_version?: string | null;
    }[];
  };
  artwork?: {
    kind?: 'performed_anatomy' | 'video_thumbnail' | 'pr_medallion' | 'readiness_chart' | 'programming' | 'message';
    muscle_keys?: string[];
    muscle_focus?: CoachSessionMuscleFocus | null;
    thumbnail_url?: string | null;
  };
};

export type CoachHomeUpcomingSession = {
  key: string;
  date: string;
  athlete: CoachHomeActivity['athlete'];
  title: string;
  subtitle?: string | null;
  movement_count?: number;
  muscle_keys?: string[];
  muscle_focus?: CoachSessionMuscleFocus | null;
  destination: CoachDestination;
};

export type CoachSessionMuscleFocus = {
  primary?: { muscle_id: string; score?: number }[];
  secondary?: { muscle_id: string; score?: number }[];
};

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
  destination: CoachDestination;
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
  preferred_units?: string | null;
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
  programming_horizon?: {
    programmed_through_date?: string | null;
    days_remaining?: number | null;
    sessions_remaining?: number;
  };
  unread_messages: { thread_id?: number | null; count: number; last_message_at?: string | null };
  pending_video_reviews: { count: number; oldest?: string | null };
  pending_session_reviews: { count: number; oldest?: string | null };
  readiness: {
    score?: number | null;
    date?: string | null;
    label: string;
    delta?: number | null;
    comparison_policy?: string | null;
    history?: { date: string; score: number }[];
  };
  reported_bodyweight?: {
    latest?: {
      date: string;
      reported_at?: string | null;
      reported_bodyweight_kg: number;
      source: 'PRE_SESSION_READINESS';
    } | null;
    delta_kg?: number | null;
    recent_observations?: {
      date: string;
      reported_at?: string | null;
      reported_bodyweight_kg: number;
      source: 'PRE_SESSION_READINESS';
    }[];
    interpolated: false;
    source: 'PRE_SESSION_READINESS';
  };
  week_summary?: {
    start_date: string;
    end_date: string;
    completed_sessions: number;
    scheduled_sessions: number;
    pr_count: number;
  };
  recent_training?: CoachRecentTrainingSession[];
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
    scratchpad?: {
      relationship_id: number;
      note_id: number | null;
      body_preview?: string | null;
      updated_at?: string | null;
      version?: string | null;
      is_empty?: boolean;
    } | null;
  };
  meet_context?: {
    meet_plan_id: number;
    meet_name?: string | null;
    meet_date?: string | null;
    days_until_meet?: number | null;
  } | null;
};

export type CoachRecentTrainingSession = CoachSessionReference & {
  set_count: number;
  movement_count: number;
  total_volume_kg?: number | null;
  pr_count: number;
  evidence_mode: 'performed' | 'planned';
  muscle_focus?: {
    primary?: { muscle_id: string; score?: number }[];
    secondary?: { muscle_id: string; score?: number }[];
    source?: 'planned' | 'performed';
  };
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

export type CoachHomeResponse = {
  ok: boolean;
  generated_at: string;
  summary: {
    needs_you: number;
    reviews: number;
    programming: number;
    check_ins: number;
  };
  attention_athletes: CoachRosterAthlete[];
  attention_total: number;
  recent_activity: {
    athlete: {
      id: number;
      name: string;
      avatar_url?: string | null;
      avatar_uploaded_at?: string | null;
    };
    session: CoachRecentTrainingSession;
  }[];
  roster_total: number;
  /**
   * Optional command-center projection. Older backends omit this; the mobile
   * client fills it with one relationship-scoped roster request.
   */
  athletes?: CoachRosterAthlete[];
  queue?: CoachHomeActivity[];
  queue_total?: number;
  queue_counts?: Partial<Record<CoachHomeActivityType, number>>;
  cleared_activity?: CoachHomeActivity[];
  coming_up?: CoachHomeUpcomingSession[];
  error?: string;
};

export type CoachAthleteSummaryResponse = {
  ok: boolean;
  generated_at?: string;
  athlete: {
    id: number;
    name: string;
    avatar_url?: string | null;
    avatar_uploaded_at?: string | null;
    profilePhotoUrl?: string | null;
    profilePhotoVersion?: string | null;
    preferred_units?: string | null;
    is_self?: boolean;
  };
  operational_status: {
    primary_status: string;
    label: string;
    tone: 'success' | 'warning' | 'danger';
    reasons: CoachAttentionReason[];
  };
  programming_horizon: {
    programmed_through_date?: string | null;
    days_remaining?: number | null;
    sessions_remaining?: number;
    status?: string;
    status_label?: string;
  };
  current_training?: CoachTrainingContext;
  readiness?: CoachRosterAthlete['readiness'];
  reported_bodyweight?: CoachRosterAthlete['reported_bodyweight'];
  week_summary?: CoachRosterAthlete['week_summary'];
  recent_training?: CoachRecentTrainingSession[];
  last_completed_session?: CoachSessionReference | null;
  next_assigned_session?: CoachSessionReference | null;
  pending_video_reviews: { count: number; items?: unknown[] };
  pending_session_reviews: { count: number; items?: unknown[] };
  unread_messages?: { thread_id?: number | null; count: number; last_message_at?: string | null } | null;
  coach_context: {
    pinned_note?: {
      id: number;
      title?: string | null;
      body_preview?: string | null;
      note_type?: string | null;
      updated_at?: string | null;
    } | null;
    scratchpad?: {
      relationship_id: number;
      note_id: number | null;
      body?: string;
      body_preview?: string | null;
      updated_at?: string | null;
      updated_by?: { id: number; name: string } | null;
      version?: string | null;
      is_empty?: boolean;
    } | null;
  };
  quick_actions: Record<string, boolean>;
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
    destination: CoachDestination;
  }[];
  error?: string;
};

type QueueNormalizationContext = {
  athleteId?: number | string | null;
  threadId?: number | string | null;
};

const COACH_DESTINATION_REQUIREMENTS: Record<string, string[]> = {
  '/(tabs)/coach-videos': ['athleteId'],
  '/(tabs)/session-surveys': ['athleteId'],
  '/(tabs)/workout': ['athleteId'],
  '/(tabs)/workout/[workoutId]': ['workoutId'],
  '/(tabs)/messages/[threadId]': ['threadId'],
  '/(tabs)/check-ins': ['athleteId'],
  '/(tabs)/coach-athlete/[athleteId]': ['athleteId'],
  '/(tabs)/coach-dashboard': [],
};

const DESTINATION_ALIASES: Record<string, string> = {
  '/workout/[workoutId]': '/(tabs)/workout/[workoutId]',
  '/(tabs)/coach-roster': '/(tabs)/coach-dashboard',
};

const VALID_CATEGORIES = new Set<CoachAttentionReason['category']>([
  'needs_attention',
  'programming',
  'reviews',
  'messages',
  'check_ins',
]);

const VALID_SEVERITIES = new Set<CoachAttentionReason['severity']>([
  'critical',
  'high',
  'medium',
  'low',
]);

const LEGACY_REASON_TYPES: Record<string, string> = {
  pending_video_review: 'video_review_waiting',
  pending_session_review: 'session_review_waiting',
  programming_soon: 'programming_due',
  missed: 'session_missed',
  incomplete: 'session_missed',
  tardy: 'session_missed',
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned || null;
}

function normalizedParamValue(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

export function normalizeCoachDestination(value: unknown): CoachDestination | null {
  if (!isRecord(value)) return null;
  const rawRoute = cleanIdentifier(value.route);
  if (!rawRoute) return null;
  const route = DESTINATION_ALIASES[rawRoute] || rawRoute;
  const requiredParams = COACH_DESTINATION_REQUIREMENTS[route];
  if (!requiredParams) return null;

  const paramsSource = isRecord(value.params) ? value.params : {};
  const params = Object.fromEntries(
    Object.entries(paramsSource)
      .map(([key, paramValue]) => [key, normalizedParamValue(paramValue)] as const)
      .filter(([, paramValue]) => paramValue != null),
  );
  if (requiredParams.some((key) => params[key] == null)) return null;

  return Object.keys(params).length > 0 ? { route, params } : { route };
}

function legacyDestination(
  reason: Record<string, any>,
  reasonType: string,
  context: QueueNormalizationContext,
): CoachDestination | null {
  const athleteId = normalizedParamValue(reason.athlete_id ?? context.athleteId);
  const workoutId = normalizedParamValue(reason.workout_id ?? reason.source_id);
  const threadId = normalizedParamValue(reason.thread_id ?? context.threadId);

  if (reasonType === 'video_review_waiting') {
    return normalizeCoachDestination({ route: '/(tabs)/coach-videos', params: { athleteId } });
  }
  if (reasonType === 'session_review_waiting') {
    return normalizeCoachDestination({ route: '/(tabs)/session-surveys', params: { athleteId } });
  }
  if (reasonType === 'session_missed') {
    return normalizeCoachDestination({ route: '/(tabs)/workout/[workoutId]', params: { workoutId } });
  }
  if (reasonType === 'programming_gap' || reasonType === 'programming_due') {
    return normalizeCoachDestination({ route: '/(tabs)/workout', params: { athleteId } });
  }
  if (reasonType === 'unread_message') {
    return normalizeCoachDestination({ route: '/(tabs)/messages/[threadId]', params: { threadId } });
  }
  return null;
}

function categoryForReason(reasonType: string): CoachAttentionReason['category'] {
  if (reasonType.includes('programming')) return 'programming';
  if (reasonType.includes('review')) return 'reviews';
  if (reasonType.includes('message')) return 'messages';
  if (reasonType.includes('check_in')) return 'check_ins';
  return 'needs_attention';
}

export function normalizeCoachAttentionReason(
  value: unknown,
  context: QueueNormalizationContext = {},
): CoachAttentionReason | null {
  if (!isRecord(value)) return null;

  const legacyType = cleanIdentifier(value.kind);
  const rawReasonType = cleanIdentifier(value.reason_type) || legacyType;
  if (!rawReasonType) return null;
  const reasonType = LEGACY_REASON_TYPES[rawReasonType] || rawReasonType;
  const title = cleanIdentifier(value.title) || cleanIdentifier(value.label);
  if (!title) return null;

  const destination = normalizeCoachDestination(value.destination)
    || legacyDestination(value, reasonType, context);
  if (!destination) return null;

  const rawSeverity = cleanIdentifier(value.severity) || cleanIdentifier(value.priority) || 'low';
  const severity = VALID_SEVERITIES.has(rawSeverity as CoachAttentionReason['severity'])
    ? rawSeverity as CoachAttentionReason['severity']
    : 'low';
  const rawCategory = cleanIdentifier(value.category);
  const category = rawCategory && VALID_CATEGORIES.has(rawCategory as CoachAttentionReason['category'])
    ? rawCategory as CoachAttentionReason['category']
    : categoryForReason(reasonType);
  const rawCount = Number(value.count ?? 1);
  const athleteId = Number(value.athlete_id ?? context.athleteId);

  return {
    athlete_id: Number.isFinite(athleteId) && athleteId > 0 ? athleteId : 0,
    reason_type: reasonType,
    severity,
    title,
    supporting_text: cleanIdentifier(value.supporting_text) || cleanIdentifier(value.detail),
    category,
    count: Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1,
    due_at: cleanIdentifier(value.due_at),
    source_id: (
      (typeof value.source_id === 'number' || (typeof value.source_id === 'string' && value.source_id.trim()))
      && Number.isFinite(Number(value.source_id))
    ) ? Number(value.source_id) : null,
    destination,
    updated_at: cleanIdentifier(value.updated_at),
    resolution_policy: cleanIdentifier(value.resolution_policy) || `legacy_${rawReasonType}`,
  };
}

export function normalizeCoachAttentionReasons(
  value: unknown,
  context: QueueNormalizationContext = {},
): CoachAttentionReason[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((reason) => normalizeCoachAttentionReason(reason, context))
    .filter((reason): reason is CoachAttentionReason => reason != null);
}

export function openCoachDestination(
  router: { push: (target: any) => void },
  destination: unknown,
): boolean {
  const normalized = normalizeCoachDestination(destination);
  if (!normalized) return false;
  router.push({
    pathname: normalized.route as any,
    params: Object.fromEntries(
      Object.entries(normalized.params || {})
        .filter(([, value]) => value != null)
        .map(([key, value]) => [key, String(value)]),
    ),
  } as any);
  return true;
}

export function coachComingUpProgrammingDestination(
  session: Pick<CoachHomeUpcomingSession, 'athlete' | 'destination'>,
): CoachDestination | null {
  const athleteId = Number(session.athlete?.id);
  const normalized = normalizeCoachDestination(session.destination);
  const workoutId = Number(normalized?.params?.workoutId);
  if (
    normalized?.route !== '/(tabs)/workout'
    || !Number.isInteger(athleteId)
    || athleteId <= 0
    || !Number.isInteger(workoutId)
    || workoutId <= 0
  ) return null;

  return {
    route: '/(tabs)/workout',
    params: {
      athleteId,
      workoutId,
      ...(normalized.params?.programId != null ? { programId: normalized.params.programId } : {}),
    },
  };
}
