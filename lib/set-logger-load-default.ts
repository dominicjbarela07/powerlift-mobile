export type SetLoggerLoadEvidence = Readonly<{
  id?: number | null;
  set_index?: number | null;
  actual_weight_kg?: number | null;
  weight_kg?: number | null;
  workout_id?: number | null;
  date?: string | null;
}>;

export type SetLoggerComparableHistory = Readonly<{
  identity_scope?: string | null;
  movement_definition_id?: number | null;
  most_recent_logged_set?: SetLoggerLoadEvidence | null;
  recent_sets?: readonly SetLoggerLoadEvidence[] | null;
}>;

export type SetLoggerLoadDefaultSource =
  | 'persisted_current_set'
  | 'current_session_previous_set'
  | 'historical_corresponding_set'
  | 'historical_most_recent_set'
  | 'prescription'
  | 'fallback';

export type ResolvedSetLoggerLoadDefault = Readonly<{
  weightKg: number;
  source: SetLoggerLoadDefaultSource;
  evidenceSetIndex: number | null;
}>;

function loadKg(
  evidence: SetLoggerLoadEvidence | null | undefined,
  allowZeroLoad: boolean,
): number | null {
  const value = Number(evidence?.actual_weight_kg ?? evidence?.weight_kg);
  if (!Number.isFinite(value)) return null;
  if (value > 0 || (allowZeroLoad && value === 0)) return value;
  return null;
}

function setIndex(evidence: SetLoggerLoadEvidence | null | undefined): number {
  const value = Number(evidence?.set_index || 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function latestPriorSessionSet(
  sets: readonly SetLoggerLoadEvidence[],
  currentSetIndex: number | null,
  allowZeroLoad: boolean,
): SetLoggerLoadEvidence | null {
  return sets
    .filter((set) => {
      if (loadKg(set, allowZeroLoad) == null) return false;
      return currentSetIndex == null || setIndex(set) < currentSetIndex;
    })
    .sort((left, right) => {
      const positionDelta = setIndex(right) - setIndex(left);
      if (positionDelta !== 0) return positionDelta;
      return Number(right.id || 0) - Number(left.id || 0);
    })[0] || null;
}

function sameHistoricalExposure(
  row: SetLoggerLoadEvidence,
  anchor: SetLoggerLoadEvidence,
): boolean {
  if (anchor.workout_id != null && row.workout_id != null) {
    return Number(row.workout_id) === Number(anchor.workout_id);
  }
  if (anchor.date && row.date) return String(row.date) === String(anchor.date);
  return false;
}

function comparableHistoricalLoad({
  history,
  currentSetIndex,
  allowZeroLoad,
}: {
  history?: SetLoggerComparableHistory | null;
  currentSetIndex: number | null;
  allowZeroLoad: boolean;
}): { evidence: SetLoggerLoadEvidence; source: SetLoggerLoadDefaultSource } | null {
  // Only the stable-identity series is load-comparable. Legacy/unresolved and
  // related-family history are intentionally excluded from initialization.
  if (history?.identity_scope !== 'exact_identity') return null;

  const recentSets = Array.isArray(history.recent_sets) ? history.recent_sets : [];
  const anchor = loadKg(history.most_recent_logged_set, allowZeroLoad) != null
    ? history.most_recent_logged_set
    : recentSets.find((row) => loadKg(row, allowZeroLoad) != null) || null;
  if (!anchor) return null;

  if (currentSetIndex != null) {
    const aligned = recentSets.find((row) => (
      setIndex(row) === currentSetIndex
      && sameHistoricalExposure(row, anchor)
      && loadKg(row, allowZeroLoad) != null
    ));
    if (aligned) {
      return { evidence: aligned, source: 'historical_corresponding_set' };
    }
  }

  return { evidence: anchor, source: 'historical_most_recent_set' };
}

/**
 * Resolves the canonical load-wheel starting point in kilograms. Callers
 * format the result into the active logger unit only after this decision.
 */
export function resolveSetLoggerLoadDefault({
  currentSetIndex,
  currentSessionSets,
  comparableHistory,
  prescribedWeightKg,
  fallbackWeightKg,
  allowZeroLoad = false,
  preferPrescriptionForStageTransition = false,
}: {
  currentSetIndex?: number | null;
  currentSessionSets?: readonly SetLoggerLoadEvidence[] | null;
  comparableHistory?: SetLoggerComparableHistory | null;
  prescribedWeightKg?: number | null;
  fallbackWeightKg: number;
  allowZeroLoad?: boolean;
  preferPrescriptionForStageTransition?: boolean;
}): ResolvedSetLoggerLoadDefault {
  const normalizedSetIndex = Number(currentSetIndex) > 0
    ? Math.floor(Number(currentSetIndex))
    : null;
  const sets = Array.isArray(currentSessionSets) ? currentSessionSets : [];
  const persistedCurrent = normalizedSetIndex == null
    ? null
    : sets
        .filter((set) => setIndex(set) === normalizedSetIndex && loadKg(set, allowZeroLoad) != null)
        .sort((left, right) => Number(right.id || 0) - Number(left.id || 0))[0] || null;
  if (persistedCurrent) {
    return Object.freeze({
      weightKg: loadKg(persistedCurrent, allowZeroLoad) as number,
      source: 'persisted_current_set',
      evidenceSetIndex: normalizedSetIndex,
    });
  }

  const prescription = Number(prescribedWeightKg);
  const hasPrescription = Number.isFinite(prescription)
    && (prescription > 0 || (allowZeroLoad && prescription === 0));
  if (preferPrescriptionForStageTransition && hasPrescription) {
    return Object.freeze({
      weightKg: prescription,
      source: 'prescription',
      evidenceSetIndex: null,
    });
  }

  const previous = latestPriorSessionSet(sets, normalizedSetIndex, allowZeroLoad);
  if (previous) {
    return Object.freeze({
      weightKg: loadKg(previous, allowZeroLoad) as number,
      source: 'current_session_previous_set',
      evidenceSetIndex: setIndex(previous) || null,
    });
  }

  const historical = comparableHistoricalLoad({
    history: comparableHistory,
    currentSetIndex: normalizedSetIndex,
    allowZeroLoad,
  });
  if (historical) {
    return Object.freeze({
      weightKg: loadKg(historical.evidence, allowZeroLoad) as number,
      source: historical.source,
      evidenceSetIndex: setIndex(historical.evidence) || null,
    });
  }

  if (hasPrescription) {
    return Object.freeze({
      weightKg: prescription,
      source: 'prescription',
      evidenceSetIndex: null,
    });
  }

  const fallback = Number(fallbackWeightKg);
  return Object.freeze({
    weightKg: Number.isFinite(fallback) && fallback >= 0 ? fallback : 0,
    source: 'fallback',
    evidenceSetIndex: null,
  });
}
