import { equipmentPresentationLabel } from '@/lib/equipment-presentation';

export type SessionRecapRelatedSet = {
  set_log_id?: number | null;
  weight_kg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
  date?: string | null;
};

export type SessionRecapRelatedReference = {
  movement_definition_id?: number | null;
  movement_family_id?: number | null;
  display_name?: string | null;
  manufacturer?: string | null;
  equipment_model?: string | null;
  equipment_type?: string | null;
  loading_implementation?: string | null;
  load_convention?: string | null;
  measurement_type?: string | null;
  implementation_key?: string | null;
  identity_status?: 'canonical' | 'custom' | 'retired' | string | null;
  replacement_movement_definition_id?: number | null;
  last_performed_on?: string | null;
  last_set?: SessionRecapRelatedSet | null;
  reference_only?: boolean;
  loads_comparable?: boolean;
};

export type SessionRecapRelatedHistory = {
  state?: 'context_available' | string | null;
  relationship?: 'same_governed_movement_family' | string | null;
  movement_family_id?: number | null;
  comparison_confidence?: 'context_only' | string | null;
  ranking_policy?: 'canonical_related_history_order_v1' | string | null;
  reference_only?: boolean;
  loads_comparable?: boolean;
  references?: SessionRecapRelatedReference[] | null;
};

type MovementWithRelatedHistory = {
  kind?: string | null;
  measurement?: { canonical_identity_id?: number | null; comparison_eligible?: boolean } | null;
  trend?: { points?: { current?: boolean }[] | null } | null;
  related_history?: SessionRecapRelatedHistory | null;
};

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function exactPriorExposureCount(movement: MovementWithRelatedHistory): number {
  return (movement.trend?.points || []).filter((point) => point.current !== true).length;
}

/**
 * Fail closed at the presentation boundary. The backend owns relationship
 * qualification and ranking; the client only accepts the explicit context-only
 * contract and never derives relatedness from a display name.
 */
export function resolveSessionRecapRelatedHistory(
  movement: MovementWithRelatedHistory,
): SessionRecapRelatedHistory | null {
  const context = movement.related_history;
  const currentIdentityId = positiveId(movement.measurement?.canonical_identity_id);
  const currentFamilyId = positiveId(context?.movement_family_id);
  if (
    movement.kind !== 'accessory'
    || movement.measurement?.comparison_eligible !== true
    || exactPriorExposureCount(movement) > 0
    || currentIdentityId == null
    || currentFamilyId == null
    || context?.state !== 'context_available'
    || context.relationship !== 'same_governed_movement_family'
    || context.comparison_confidence !== 'context_only'
    || context.ranking_policy !== 'canonical_related_history_order_v1'
    || context.reference_only !== true
    || context.loads_comparable !== false
  ) {
    return null;
  }

  const references = (context.references || []).filter((reference) => (
    positiveId(reference.movement_definition_id) != null
    && positiveId(reference.movement_definition_id) !== currentIdentityId
    && positiveId(reference.movement_family_id) === currentFamilyId
    && positiveId(reference.last_set?.set_log_id) != null
    && Boolean(reference.last_performed_on || reference.last_set?.date)
    && reference.reference_only === true
    && reference.loads_comparable === false
  ));
  return references.length ? { ...context, references } : null;
}

export function relatedEquipmentIdentityLabel(reference: SessionRecapRelatedReference): string {
  const parts = [
    String(reference.manufacturer || '').trim(),
    String(reference.equipment_model || '').trim(),
  ].filter((part, index, all) => Boolean(part) && all.indexOf(part) === index);
  const loading = equipmentPresentationLabel(
    reference.loading_implementation || reference.equipment_type,
    'Different equipment',
  );
  if (loading !== 'Different equipment' && !parts.includes(loading)) parts.push(loading);
  return parts.join(' · ') || 'Different equipment';
}
