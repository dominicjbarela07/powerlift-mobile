export type CanonicalDailyReadinessObservation = {
  id?: number | null;
  date?: string | null;
  training_date?: string | null;
  workout_id?: number | null;
  context?: string | null;
  submitted_at?: string | null;
  sleep_quality?: number | null;
  sleep_hours?: number | null;
  energy?: number | null;
  soreness?: number | null;
  stress?: number | null;
  bodyweight_kg?: number | null;
  readiness_score?: number | null;
};

type DailyReadinessHomeState = {
  date: string;
  readiness?: {
    score?: number | null;
    latest?: CanonicalDailyReadinessObservation | null;
    metrics?: {
      sleep?: number | null;
      energy?: number | null;
      soreness?: number | null;
      stress?: number | null;
    } | null;
    [key: string]: unknown;
  } | null;
  daily_check_in?: CanonicalDailyReadinessObservation | null;
  capabilities?: {
    has_daily_check_in?: boolean;
    [key: string]: unknown;
  } | null;
  daily_check_in_action?: {
    kind?: string | null;
    label?: string | null;
    route?: string | null;
    workout_id?: number | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

/**
 * Hydrate Home from the canonical row returned by the save endpoint.
 *
 * This is persisted-server state, not an optimistic completion flag. The
 * follow-up dashboard request still reconciles the full projection, while the
 * saved observation makes the completed state visible without a second fetch.
 */
export function mergeCanonicalDailyReadiness<T extends DailyReadinessHomeState>(
  today: T,
  observation?: CanonicalDailyReadinessObservation | null,
): T {
  if (!observation?.id || observation.workout_id != null) return today;
  const observationDate = observation.training_date || observation.date;
  if (!observationDate || observationDate !== today.date) return today;

  return {
    ...today,
    readiness: {
      ...(today.readiness || {}),
      score: observation.readiness_score ?? today.readiness?.score ?? null,
      latest: observation,
      metrics: {
        ...(today.readiness?.metrics || {}),
        sleep: observation.sleep_hours ?? observation.sleep_quality ?? null,
        energy: observation.energy ?? null,
        soreness: observation.soreness ?? null,
        stress: observation.stress ?? null,
      },
    },
    daily_check_in: observation,
    capabilities: {
      ...(today.capabilities || {}),
      has_daily_check_in: true,
    },
    daily_check_in_action: {
      kind: 'view_daily_check_in',
      label: "Today's Check-In",
      route: 'daily_readiness',
      workout_id: null,
    },
  } as T;
}
