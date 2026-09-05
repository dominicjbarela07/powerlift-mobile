export type ExactAccessoryHistorySet = {
  id?: number | null;
  weight_kg?: number | null;
  reps?: number | null;
  rir?: number | null;
  rpe?: number | null;
  date?: string | null;
};

export type ExactAccessoryHistoryPayload<TSet extends ExactAccessoryHistorySet = ExactAccessoryHistorySet> = {
  identity_scope?: string | null;
  comparison_allowed?: boolean | null;
  comparison_identity_key?: string | null;
  comparison_scope?: string | null;
  identity_resolution_source?: string | null;
  most_recent_logged_set?: TSet | null;
  best_logged_set?: TSet | null;
  recent_sets?: TSet[] | null;
  recent_sessions?: TSet[] | null;
  previous_exposure?: {
    workout_id?: number | null;
    date?: string | null;
    comparison_identity_key?: string | null;
    representative_set_id?: number | null;
    representative_set_selection_reason?: string | null;
    representative_set?: TSet | null;
  } | null;
} | null | undefined;

export function isExactComparableAccessoryHistory(
  history: ExactAccessoryHistoryPayload,
): boolean {
  return history?.identity_scope === 'exact_identity'
    && history?.comparison_allowed === true
    && Boolean(history?.comparison_identity_key);
}

export function exactAccessoryHistoryRows<TSet extends ExactAccessoryHistorySet>(
  history: ExactAccessoryHistoryPayload<TSet>,
): TSet[] {
  if (!isExactComparableAccessoryHistory(history)) return [];
  const recentSets = history?.recent_sets || [];
  if (recentSets.length) return recentSets;
  const recentSessions = history?.recent_sessions || [];
  if (recentSessions.length) return recentSessions;
  return history?.most_recent_logged_set ? [history.most_recent_logged_set] : [];
}

export function exactAccessoryLastExposure<TSet extends ExactAccessoryHistorySet>(
  history: ExactAccessoryHistoryPayload<TSet>,
): TSet | null {
  if (!isExactComparableAccessoryHistory(history)) return null;
  return history?.previous_exposure?.representative_set
    || history?.recent_sessions?.[0]
    || history?.most_recent_logged_set
    || null;
}

export function exactAccessoryBestExposure<TSet extends ExactAccessoryHistorySet>(
  history: ExactAccessoryHistoryPayload<TSet>,
): TSet | null {
  if (!isExactComparableAccessoryHistory(history)) return null;
  return history?.best_logged_set || null;
}

export function exactAccessoryDefaultWeightKg(
  history: ExactAccessoryHistoryPayload,
): number | null {
  const value = exactAccessoryLastExposure(history)?.weight_kg;
  return value != null && Number.isFinite(Number(value)) ? Number(value) : null;
}
