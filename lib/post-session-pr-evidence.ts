import type { SessionRecapTrend } from './session-recap-trend';
import { isAssistanceLoad } from './performed-load-semantics';
import { compareMovementPerformance } from './movement-performance-semantics';

export const CANONICAL_PR_EVENT_TYPES = new Set([
  'CORE_E1RM_PR', 'CORE_WEIGHT_PR', 'CORE_REP_MAX_PR', 'CORE_RPE_PR',
  'CORE_SAME_WEIGHT_REP_PR', 'CORE_BLOCK_E1RM_BEST', 'CORE_BLOCK_WEIGHT_BEST',
  'CORE_BLOCK_REP_MAX_BEST', 'CORE_BLOCK_SAME_WEIGHT_REP_BEST',
  'CORE_MOVEMENT_VOLUME_PR', 'CORE_BLOCK_MOVEMENT_VOLUME_BEST',
]);

export type PersonalBestSetEvidence = {
  set_log_id: number;
  date?: string | null;
  workout_id?: number | null;
  weight_kg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
};

export type PersonalBestRecordEvidence = {
  metric: string | null;
  scope?: string | null;
  target_reps?: number | null;
  source_set: PersonalBestSetEvidence | null;
  prior_set: PersonalBestSetEvidence | null;
  current_value: number | null;
  prior_value: number | null;
  delta: number | null;
  unit?: string | null;
  first_record: boolean;
  progression: (SessionRecapTrend & { state?: string | null }) | null;
};

export type PersonalBestEvidence<TMovement = Record<string, any>> = {
  event: Record<string, any>;
  events: Record<string, any>[];
  movement: TMovement | null;
  record: PersonalBestRecordEvidence;
  scopes: string[];
};

export function finitePrNumber(value: unknown): number | null {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function accomplishmentItemId(row: Record<string, any>): number | null {
  const parsed = finitePrNumber(row.workout_item_id ?? row.source?.workout_item_id);
  return parsed != null && parsed > 0 ? parsed : null;
}

export function accomplishmentSetLogId(row: Record<string, any>): number | null {
  const parsed = finitePrNumber(row.source_set_log_id ?? row.trigger_set_log_id ?? row.source?.set_log_id);
  return parsed != null && parsed > 0 ? parsed : null;
}

function normalizedLabel(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

export function accomplishmentMatchesMovement(
  row: Record<string, any>,
  movement: { item_id?: number | null; label?: string | null },
) {
  const itemId = accomplishmentItemId(row);
  if (itemId != null && movement.item_id != null) return itemId === Number(movement.item_id);
  const label = normalizedLabel(row.movement_label ?? row.source?.movement_label);
  return !!label && label === normalizedLabel(movement.label);
}

function metricForEvent(eventType: unknown) {
  const type = String(eventType || '').toUpperCase();
  if (type.includes('REP_MAX')) return 'rep_max_load';
  if (type.includes('SAME_WEIGHT_REP')) return 'same_load_reps';
  if (type.includes('E1RM')) return 'estimated_1rm';
  if (type.includes('WEIGHT')) return 'max_load';
  if (type.includes('VOLUME')) return 'movement_volume';
  if (type.includes('RPE')) return 'matched_performance_effort';
  return null;
}

function targetReps(event: Record<string, any>, sourceSet: PersonalBestSetEvidence | null) {
  const bucket = String(event.comparison_bucket || '');
  const bucketReps = bucket.startsWith('reps:') ? finitePrNumber(bucket.slice(5)) : null;
  return finitePrNumber(
    event.record_evidence?.target_reps
      ?? event.evidence?.rep_count
      ?? event.evidence?.actual_reps
      ?? bucketReps
      ?? sourceSet?.reps,
  );
}

function normalizeSet(value: unknown): PersonalBestSetEvidence | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, any>;
  const setLogId = finitePrNumber(row.set_log_id ?? row.id);
  if (setLogId == null || setLogId <= 0) return null;
  return {
    set_log_id: setLogId,
    date: row.date ?? null,
    workout_id: finitePrNumber(row.workout_id),
    weight_kg: finitePrNumber(row.weight_kg ?? row.actual_weight_kg),
    reps: finitePrNumber(row.reps ?? row.actual_reps),
    rpe: finitePrNumber(row.rpe ?? row.actual_rpe),
    rir: finitePrNumber(row.rir ?? row.actual_rir),
  };
}

function exactSourceSet(event: Record<string, any>, movement: Record<string, any> | null) {
  const sourceId = accomplishmentSetLogId(event);
  const exact = (movement?.sets || []).find((set: Record<string, any>) => Number(set.id) === Number(sourceId));
  if (exact) return normalizeSet(exact);
  if (sourceId == null) return null;
  const snapshot = event.evidence || {};
  if (finitePrNumber(snapshot.actual_weight_kg) == null && finitePrNumber(snapshot.actual_reps) == null) return null;
  return normalizeSet({
    set_log_id: sourceId,
    weight_kg: snapshot.actual_weight_kg,
    reps: snapshot.actual_reps,
    rpe: snapshot.actual_rpe,
    rir: snapshot.actual_rir,
    workout_id: event.workout_id ?? event.source?.workout_id,
    date: event.workout_date,
  });
}

function valueFromSet(metric: string | null, set: PersonalBestSetEvidence | null) {
  if (!set) return null;
  if (metric === 'rep_max_load' || metric === 'max_load') return finitePrNumber(set.weight_kg);
  if (metric === 'same_load_reps') return finitePrNumber(set.reps);
  if (metric === 'matched_performance_effort') return finitePrNumber(set.rpe);
  if (metric === 'movement_volume') {
    const weight = finitePrNumber(set.weight_kg);
    const reps = finitePrNumber(set.reps);
    return weight != null && reps != null ? weight * reps : null;
  }
  return null;
}

function normalizeRecord(event: Record<string, any>, movement: Record<string, any> | null): PersonalBestRecordEvidence {
  const typed = event.record_evidence && typeof event.record_evidence === 'object'
    ? event.record_evidence as Record<string, any>
    : {};
  const metric = String(typed.metric || metricForEvent(event.event_type) || '') || null;
  const sourceSet = normalizeSet(typed.source_set) || exactSourceSet(event, movement);
  const priorSet = normalizeSet(typed.prior_set);
  const typedCurrent = finitePrNumber(typed.current_value);
  const typedPrior = finitePrNumber(typed.prior_value);
  const currentValue = metric === 'estimated_1rm'
    ? typedCurrent ?? finitePrNumber(event.current_value)
    : valueFromSet(metric, sourceSet) ?? typedCurrent;
  const priorValue = priorSet
    ? (metric === 'estimated_1rm' ? typedPrior : valueFromSet(metric, priorSet) ?? typedPrior)
    : null;
  const typedDelta = finitePrNumber(typed.delta);
  return {
    metric,
    scope: typed.scope ?? event.scope ?? null,
    target_reps: targetReps(event, sourceSet),
    source_set: sourceSet,
    prior_set: priorSet,
    current_value: currentValue,
    prior_value: priorValue,
    delta: priorValue == null || currentValue == null ? null : typedDelta ?? currentValue - priorValue,
    unit: typed.unit ?? event.unit ?? null,
    first_record: priorSet == null,
    progression: typed.progression && typeof typed.progression === 'object' ? typed.progression : null,
  };
}

function semanticRecordKey(evidence: PersonalBestEvidence) {
  return [
    evidence.record.source_set?.set_log_id ?? accomplishmentSetLogId(evidence.event) ?? evidence.event.id,
    evidence.record.metric,
    evidence.record.target_reps ?? '',
  ].join(':');
}

function scopeLabel(event: Record<string, any>) {
  return String(event.scope || '').toLowerCase() === 'block'
    || String(event.event_type || '').toUpperCase().includes('BLOCK_')
    ? 'block'
    : 'career';
}

export function buildPersonalBestEvidence<TMovement extends Record<string, any>>(
  events: Record<string, any>[],
  movements: TMovement[],
): PersonalBestEvidence<TMovement>[] {
  const groups = new Map<string, PersonalBestEvidence<TMovement>>();
  for (const event of events) {
    const movement = movements.find((candidate) => accomplishmentMatchesMovement(event, candidate)) || null;
    const evidence: PersonalBestEvidence<TMovement> = {
      event,
      events: [event],
      movement,
      record: normalizeRecord(event, movement),
      scopes: [scopeLabel(event)],
    };
    const key = semanticRecordKey(evidence);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, evidence);
      continue;
    }
    existing.events.push(event);
    if (!existing.scopes.includes(scopeLabel(event))) existing.scopes.push(scopeLabel(event));
    if (scopeLabel(existing.event) === 'block' && scopeLabel(event) === 'career') {
      existing.event = event;
      existing.record = evidence.record;
    }
  }
  return [...groups.values()];
}

export function personalBestEvidenceMatchesLoadSemantics(
  evidence: PersonalBestEvidence<Record<string, any>>,
) {
  const measurement = evidence.movement?.measurement || {};
  const semantics = {
    loadConvention: measurement.load_convention,
    measurementType: measurement.measurement_type,
  };
  if (!isAssistanceLoad(semantics)) return true;

  const current = evidence.record.source_set;
  const previous = evidence.record.prior_set;
  if (!current || !previous) return false;
  const comparison = compareMovementPerformance(
    { weightKg: current.weight_kg, reps: current.reps, rpe: current.rpe, rir: current.rir },
    { weightKg: previous.weight_kg, reps: previous.reps, rpe: previous.rpe, rir: previous.rir },
    semantics,
  );
  if (comparison.state !== 'improved') return false;

  if (evidence.record.metric === 'rep_max_load') {
    return comparison.repsMatched && comparison.loadDeltaKg != null && comparison.loadDeltaKg < 0;
  }
  if (evidence.record.metric === 'same_load_reps') {
    return comparison.loadMatched && comparison.repsDelta != null && comparison.repsDelta > 0;
  }
  if (evidence.record.metric === 'matched_performance_effort') {
    return comparison.loadMatched && comparison.repsMatched
      && comparison.reserveDelta != null && comparison.reserveDelta > 0;
  }
  return false;
}
