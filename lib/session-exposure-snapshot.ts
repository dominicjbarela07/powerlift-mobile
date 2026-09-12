import type { CanonicalMovementHistory } from './canonical-movement-history';
import type { ExposureSnapshotIdentity } from './session-exposure-cache';
import { formatPerformedLoad, type PerformedLoadSemantics } from './performed-load-semantics';

type ExposureSet = Readonly<{ id?: number | null; workout_id?: number | null; date?: string | null;
  weight_kg?: number | null; reps?: number | null; rir?: number | null; rpe?: number | null }>;
export type HydratedExposureHistory = Readonly<{
  identity_scope?: string | null; comparison_allowed?: boolean | null;
  comparison_identity_key?: string | null; comparison_scope?: string | null;
  movement_definition_id?: number | null; core_movement_id?: number | null;
  equipment_configuration_identity_id?: number | null;
  previous_exposure?: { workout_id?: number | null; date?: string | null;
    comparison_identity_key?: string | null; representative_set?: ExposureSet | null;
    representative_set_selection_reason?: string | null } | null;
}>;
export type SessionExposure = Readonly<{
  set: ExposureSet; date: string; workoutId: number; comparisonKey: string;
  selection: 'Representative set'; recordedSetCount?: number;
}> | null;

function isPrior(row: { workout_id?: number | null; date?: string | null }, identity: ExposureSnapshotIdentity) {
  return Number(row.workout_id) > 0 && row.workout_id !== identity.workoutId
    && /^\d{4}-\d{2}-\d{2}/.test(row.date || '')
    // Match the existing Session hydration's before-Session-date policy.
    && String(row.date).slice(0, 10) < identity.sessionDate.slice(0, 10);
}
function usableSet(set?: ExposureSet | null): set is ExposureSet {
  return Boolean(set && set.weight_kg != null && Number.isFinite(set.weight_kg) && set.weight_kg >= 0
    && set.reps != null && Number.isFinite(set.reps) && set.reps > 0);
}

/** Consume the existing bounded summary; never infer a comparable task from labels. */
export function exposureFromHydration(history: HydratedExposureHistory | null | undefined, identity: ExposureSnapshotIdentity): SessionExposure {
  if (!history || history.comparison_allowed !== true || !history.comparison_identity_key) return null;
  const core = Boolean(identity.coreMovementId);
  if (history.identity_scope !== (core ? 'exact_core_identity' : 'exact_identity')) return null;
  if (core ? history.core_movement_id !== identity.coreMovementId : history.movement_definition_id !== identity.movementDefinitionId) return null;
  if (history.comparison_scope === 'exact_implementation'
    && (!identity.equipmentId || history.equipment_configuration_identity_id !== identity.equipmentId)) return null;
  if (identity.comparisonKey && identity.comparisonKey !== history.comparison_identity_key) return null;
  const prior = history.previous_exposure;
  if (!prior || !isPrior(prior, identity) || !usableSet(prior.representative_set)
    || prior.comparison_identity_key !== history.comparison_identity_key
    || prior.representative_set.workout_id !== prior.workout_id) return null;
  return { set: prior.representative_set, date: prior.date!, workoutId: prior.workout_id!,
    comparisonKey: history.comparison_identity_key, selection: 'Representative set' };
}

/** Core fallback only. Accessory summaries already own stricter equipment policy. */
export function exposureFromCoreHistory(history: CanonicalMovementHistory, identity: ExposureSnapshotIdentity): SessionExposure {
  if (!identity.coreMovementId || history.athlete.id !== identity.athleteId
    || history.identity_resolution?.subject_type !== 'core'
    || history.identity_resolution.subject_id !== identity.coreMovementId
    || history.scope !== 'exact_core_identity' || history.comparison_allowed !== true) return null;
  const comparableIds = new Set(history.performance_trend.map(row => row.exposure_id));
  const prior = history.exposures.find(row => isPrior(row, identity) && comparableIds.has(row.id)
    && Boolean(row.comparison_identity_key) && usableSet(row.best_set));
  if (!prior?.best_set) return null;
  return { set: prior.best_set, date: prior.date, workoutId: prior.workout_id,
    comparisonKey: prior.comparison_identity_key!, selection: 'Representative set',
    // Analytics counts recorded SetLogs, not a promised complete working dose.
    recordedSetCount: Number.isInteger(prior.set_count) && prior.set_count > 0 ? prior.set_count : undefined };
}

export function presentSessionExposure(exposure: SessionExposure, unit: 'kg' | 'lb', kind: 'core' | 'accessory', semantics?: PerformedLoadSemantics) {
  if (!exposure) return null;
  const set = exposure.set;
  const effortValue = kind === 'accessory' ? set.rir ?? set.rpe : set.rpe ?? set.rir;
  const effortKind = kind === 'accessory' ? set.rir != null ? 'RIR' : 'RPE' : set.rpe != null ? 'RPE' : 'RIR';
  const effort = effortValue != null && Number.isFinite(effortValue) ? `@${effortValue} ${effortKind}` : null;
  const date = new Date(`${exposure.date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return { performance: `${formatPerformedLoad(set.weight_kg, unit, semantics, 'recorded')} × ${set.reps}`,
    effort, date, context: [exposure.selection, exposure.recordedSetCount
      ? `${exposure.recordedSetCount} recorded ${exposure.recordedSetCount === 1 ? 'set' : 'sets'}` : null].filter(Boolean).join(' · ') };
}
