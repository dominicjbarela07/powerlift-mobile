export type AthleteHomeState = 'training' | 'recovery' | 'achievement' | 'meet' | 'rest';

export type HomeAction = {
  route?: string | null;
  workout_id?: number | null;
  meet_plan_id?: number | null;
  achievement_id?: number | null;
  lift_family?: string | null;
  label?: string | null;
};

export type HomeMuscleFocus = {
  primary?: { muscle_id?: string | null; score?: number | null }[];
  secondary?: { muscle_id?: string | null; score?: number | null }[];
  source?: 'planned' | 'performed' | string | null;
  evidence_movement_count?: number | null;
};

export type HomeSessionEvidence = {
  id?: number | null;
  title?: string | null;
  label?: string | null;
  date?: string | null;
  status?: string | null;
  movement_count?: number | null;
  programmed_set_count?: number | null;
  performed_set_count?: number | null;
  performed_volume_kg?: number | null;
  session_rpe?: number | null;
  pr_count?: number | null;
  evidence_state?: 'available' | 'absent' | 'unavailable' | string | null;
  muscle_focus?: HomeMuscleFocus | null;
  action?: HomeAction | null;
};

export type AthleteHomeV3Projection = {
  projection_version?: string | null;
  data_status?: {
    state?: 'ready' | 'unavailable' | string | null;
    source?: string | null;
    scope?: 'athlete' | 'self_coached' | string | null;
  } | null;
  state_precedence?: AthleteHomeState[];
  state?: { kind?: AthleteHomeState | string | null; evidence?: Record<string, unknown> | null } | null;
  hero?: {
    session?: HomeSessionEvidence | null;
    meet?: {
      id?: number | null;
      name?: string | null;
      date?: string | null;
      location?: string | null;
      timeline?: { label?: string | null; time?: string | null }[];
      action?: HomeAction | null;
    } | null;
    achievement?: HomeAchievement | null;
  } | null;
  program?: {
    id?: number | null;
    name?: string | null;
    block_id?: number | null;
    block_name?: string | null;
    week_number?: number | null;
  } | null;
  week?: {
    start_date?: string | null;
    end_date?: string | null;
    days?: { date?: string | null; kind?: string | null; is_today?: boolean; session_count?: number; achievement?: boolean }[];
    performed?: { sessions?: number | null; sets?: number | null; total_volume_kg?: number | null; pr_count?: number | null; evidence_state?: string | null } | null;
    action?: HomeAction | null;
  } | null;
  next_up?: HomeSessionEvidence | null;
  last_session?: HomeSessionEvidence | null;
  trends?: {
    readiness?: HomeTrend | null;
    bodyweight?: HomeTrend & { latest_kg?: number | null; delta_kg?: number | null; interpolated?: boolean };
    volume?: HomeTrend & { this_week_kg?: number | null };
  } | null;
  strength?: {
    family?: string | null;
    metric?: string | null;
    unit?: string | null;
    current_e1rm_kg?: number | null;
    delta_kg?: number | null;
    points?: { date?: string | null; value_kg?: number | null }[];
    selection_rule?: string | null;
    action?: HomeAction | null;
  } | null;
  achievement?: HomeAchievement | null;
  self_coached_actions?: HomeAction[];
  diagnostics?: Record<string, unknown> | null;
};

export type HomeTrend = {
  metric?: string | null;
  unit?: string | null;
  latest?: number | null;
  average_7d?: number | null;
  points?: { date?: string | null; value?: number | null; value_kg?: number | null }[];
  action?: HomeAction | null;
};

export type HomeAchievement = {
  id?: number | null;
  event_type?: string | null;
  movement_label?: string | null;
  movement_family?: string | null;
  current_value?: number | null;
  prior_value?: number | null;
  delta?: number | null;
  unit?: string | null;
  workout_id?: number | null;
  workout_date?: string | null;
  occurred_at?: string | null;
  evidence?: { actual_weight_kg?: number | null; actual_reps?: number | null; rep_count?: number | null } | null;
  action?: HomeAction | null;
};

function lower(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function legacySession(value: any): HomeSessionEvidence | null {
  if (!value?.id) return null;
  const status = lower(value.status);
  return {
    id: Number(value.id),
    title: value.title || value.label || 'Training Session',
    date: value.date,
    status,
    movement_count: Number(value.preview?.core_count || 0) + Number(value.preview?.accessory_count || 0) || null,
    action: { route: 'workout', workout_id: Number(value.id) },
  };
}

function latestStrength(root: any) {
  const candidates = Object.entries(root?.strength_trends || {}).flatMap(([family, raw]) => {
    const points = Array.isArray(raw) ? raw : [];
    return points.length ? [{ family, points, latest: points[points.length - 1] }] : [];
  });
  candidates.sort((a: any, b: any) => String(b.latest?.date || '').localeCompare(String(a.latest?.date || '')));
  const picked: any = candidates[0];
  if (!picked) return null;
  const previous = picked.points.length > 1 ? picked.points[picked.points.length - 2] : null;
  return {
    family: picked.family,
    current_e1rm_kg: picked.latest?.e1rm_kg,
    delta_kg: previous ? Number(picked.latest?.e1rm_kg || 0) - Number(previous?.e1rm_kg || 0) : null,
    points: picked.points.map((point: any) => ({ date: point.date, value_kg: point.e1rm_kg })),
    selection_rule: 'most_recent_e1rm_point_legacy_fallback',
    action: { route: 'ledger_strength', lift_family: picked.family },
  };
}

/**
 * Prefer the additive server projection. The compatibility adapter keeps a
 * previous backend useful without inventing performed metrics or history.
 */
export function mergeAthleteHomeV3(today: any, root: any) {
  const dailyCheckIn = today?.daily_check_in ?? root?.today_readiness ?? null;
  const hydratedToday = {
    ...today,
    daily_check_in: dailyCheckIn,
    capabilities: today?.capabilities ?? {
      can_daily_check_in: !today?.mission?.session?.id,
      has_daily_check_in: Boolean(dailyCheckIn),
    },
    daily_check_in_action: today?.daily_check_in_action ?? (
      !today?.mission?.session?.id
        ? { route: 'daily_readiness', label: dailyCheckIn ? "View Today's Check-In" : 'Check In' }
        : null
    ),
  };
  const canonical = root?.home_v3 || today?.home_v3;
  if (canonical?.projection_version === 'athlete-home-v3') return { ...hydratedToday, home_v3: canonical };

  const session = legacySession(hydratedToday?.mission?.session);
  const meetToday = lower(hydratedToday?.phase?.meet?.status) === 'today' || hydratedToday?.phase?.meet?.date === hydratedToday?.date;
  const dailyRecoveryEvidence = !session && Boolean(hydratedToday?.daily_check_in);
  const state: AthleteHomeState = meetToday ? 'meet' : session ? 'training' : dailyRecoveryEvidence ? 'recovery' : 'rest';
  const recent = (root?.recent_sessions || []).find((item: any) => ['completed', 'logged', 'done'].includes(lower(item?.status)));
  const legacyWeek = hydratedToday?.next_glance?.week || root?.consistency?.this_week || {};
  const weekDays = Array.isArray(root?.week_preview)
    ? root.week_preview.map((item: any) => ({ date: item.date, kind: lower(item.status) === 'completed' ? 'completed' : lower(item.status) === 'in_progress' ? 'in_progress' : 'session' }))
    : [];
  const readinessPoints = (root?.readiness_trend_7d || []).filter((point: any) => point?.readiness_score != null).map((point: any) => ({ date: point.date, value: point.readiness_score }));
  const reported = hydratedToday?.daily_check_in?.bodyweight_kg;
  const projection: AthleteHomeV3Projection = {
    projection_version: 'athlete-home-v3-compat',
    data_status: {
      state: 'unavailable',
      source: 'canonical_projection_missing',
      scope: 'athlete',
    },
    state_precedence: ['meet', 'training', 'achievement', 'recovery', 'rest'],
    state: { kind: state, evidence: { legacy_compatibility: true } },
    hero: {
      session,
      meet: meetToday ? { ...hydratedToday.phase.meet, action: { route: 'meet', meet_plan_id: hydratedToday.phase.meet.id } } : null,
      achievement: null,
    },
    program: {
      id: hydratedToday?.phase?.active_program?.id,
      name: hydratedToday?.phase?.active_program?.name,
      block_id: hydratedToday?.phase?.block?.id,
      block_name: hydratedToday?.phase?.block?.name,
      week_number: null,
    },
    week: {
      start_date: legacyWeek.start_date,
      end_date: legacyWeek.end_date,
      days: weekDays,
      performed: { sessions: legacyWeek.logged ?? null, sets: null, total_volume_kg: null, pr_count: null },
      action: { route: 'calendar' },
    },
    next_up: legacySession(root?.next_workout || hydratedToday?.next_glance),
    last_session: legacySession(recent || hydratedToday?.recent_glance),
    trends: {
      readiness: { latest: hydratedToday?.readiness?.score, average_7d: root?.readiness_summary?.composite, points: readinessPoints, action: { route: 'readiness_history' } },
      bodyweight: { latest_kg: reported ?? null, delta_kg: null, points: reported != null ? [{ date: hydratedToday.date, value_kg: reported }] : [], interpolated: false, action: { route: 'ledger_journey' } },
      volume: { this_week_kg: null, points: [], action: { route: 'training_history' } },
    },
    strength: latestStrength(root),
    achievement: null,
    self_coached_actions: [{ route: 'programming', label: 'Program Training' }, { route: 'calendar', label: 'Open Calendar' }],
  };
  return { ...hydratedToday, home_v3: projection };
}

export function resolveHomeState(projection?: AthleteHomeV3Projection | null): AthleteHomeState {
  const kind = lower(projection?.state?.kind);
  return ['training', 'recovery', 'achievement', 'meet', 'rest'].includes(kind)
    ? kind as AthleteHomeState
    : 'rest';
}
