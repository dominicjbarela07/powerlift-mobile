import { governedAccessoryArtworkTaxonomy } from './governed-movement-art-taxonomy';
import { focusedAccessoryMuscleRegionKey } from './accessory-muscle-group';
import type { MovementArtDefinition } from './canonical-movement-art-subject';

type References = {
  key?: string | null;
  family?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: readonly string[] | null;
  equipment_type?: string | null;
  movement_definition_id?: number | null;
  effective_movement_definition_id?: number | null;
  performed_canonical_movement_definition_id?: number | null;
  movement_identity?: MovementArtDefinition | null;
  effective_movement_identity?: MovementArtDefinition | null;
  performed_canonical_movement_identity?: MovementArtDefinition | null;
  performed_movement_identity?: MovementArtDefinition | null;
  legacy?: {
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: MovementArtDefinition | null;
  } | null;
};

const positiveId = (value: unknown) => (typeof value === 'number' || typeof value === 'string')
  && Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

/**
 * Normalize named movement references before any consumer chooses precedence.
 * An empty preferred object is absence, not authority over a governed ID.
 * This is read-only: no labels, row IDs, writes or performed identity creation.
 */
export function normalizeWorkoutItemMovementReferences<T extends References>(row: T, enrich = false): T {
  const references = [row.performed_canonical_movement_identity, row.effective_movement_identity,
    row.performed_movement_identity, row.movement_identity, row.legacy?.effective_movement_identity];
  const reference = (value: MovementArtDefinition | null | undefined, scalar?: number | null) => {
    const id = positiveId(value?.id) || positiveId(scalar);
    const key = value?.key?.trim() || null;
    const hasTaxonomy = focusedAccessoryMuscleRegionKey(value?.primary_muscle_group)
      || focusedAccessoryMuscleRegionKey(value?.family)
      || focusedAccessoryMuscleRegionKey(value?.material_parameters?.accessory_taxonomy?.primary_muscle_group);
    if (!id && !key && !hasTaxonomy) return null;
    if (!enrich || hasTaxonomy) return { ...value, ...(id ? { id } : {}) };
    // Keep contradictory ID/key and scalar/reference pairs visible to the
    // authoritative consumer's conflict guard; never repair them by guessing.
    const catalog = governedAccessoryArtworkTaxonomy(id, key);
    const matching = references.find(other => other && id && positiveId(other.id) === id
      && (!key || !other.key || other.key === key) && other.primary_muscle_group);
    const combined = { ...catalog, ...matching, ...value, ...(id ? { id } : {}) };
    for (const field of ['key', 'family', 'equipment_type', 'primary_muscle_group', 'secondary_muscle_groups'] as const) {
      if (combined[field] == null) (combined as Record<string, unknown>)[field] = matching?.[field] ?? catalog?.[field];
    }
    return combined;
  };
  return {
    ...row,
    movement_identity: reference(row.movement_identity || (positiveId(row.movement_definition_id) ? {
      id: row.movement_definition_id, key: row.key, family: row.family, primary_muscle_group: row.primary_muscle_group,
      secondary_muscle_groups: row.secondary_muscle_groups, equipment_type: row.equipment_type,
    } : null), row.movement_definition_id),
    effective_movement_identity: reference(row.effective_movement_identity, row.effective_movement_definition_id),
    performed_canonical_movement_identity: reference(row.performed_canonical_movement_identity, row.performed_canonical_movement_definition_id),
    performed_movement_identity: reference(row.performed_movement_identity),
    ...(row.legacy ? { legacy: { ...row.legacy,
      effective_movement_identity: reference(row.legacy.effective_movement_identity, row.legacy.effective_movement_definition_id),
    } } : {}),
  };
}

export function conflictingWorkoutMovementReferences(row: References): boolean {
  for (const [ref, scalar] of [[row.movement_identity, row.movement_definition_id],
    [row.effective_movement_identity, row.effective_movement_definition_id],
    [row.performed_canonical_movement_identity, row.performed_canonical_movement_definition_id]] as const) {
    if (positiveId(ref?.id) && positiveId(scalar) && positiveId(ref?.id) !== positiveId(scalar)) return true;
  }
  const a = row.effective_movement_identity, b = row.performed_canonical_movement_identity;
  return Boolean(a && b && ((positiveId(a.id) && positiveId(b.id) && positiveId(a.id) !== positiveId(b.id))
    || (a.key && b.key && a.key !== b.key)));
}
