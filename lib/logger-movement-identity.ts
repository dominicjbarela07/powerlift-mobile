import {
  activeEquipmentIdentity,
  type EquipmentAwareWorkoutItem,
  type EquipmentIdentityLike,
} from '@/lib/equipment-selection';
import { normalizeCanonicalMovementArtSubject, type CanonicalMovementArtSubject, type CanonicalMovementArtworkInput } from '@/lib/canonical-movement-art-subject';
import { normalizeWorkoutItemMovementReferences, conflictingWorkoutMovementReferences } from './workout-item-movement-references';

export type LoggerIdentityReference = EquipmentIdentityLike & {
  kind?: string | null;
  family?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[] | null;
  execution_family?: string | null;
  requires_equipment_configuration?: boolean | null;
  material_parameters?: (NonNullable<EquipmentIdentityLike['material_parameters']> & {
    accessory_taxonomy?: {
      execution_family?: string | null;
      requires_equipment_configuration?: boolean | null;
      primary_muscle_group?: string | null;
      secondary_muscle_groups?: string[] | null;
    } | null;
  }) | null;
};

export type LoggerMovementIdentityItem = EquipmentAwareWorkoutItem & {
  movement_identity?: LoggerIdentityReference | null;
  performed_movement_identity?: LoggerIdentityReference | null;
  movement_definition_id?: number | null;
  effective_movement_definition_id?: number | null;
  performed_canonical_movement_definition_id?: number | null;
  lift?: string | null;
  variant?: string | null;
  is_substituted?: boolean | null;
  original_movement?: string | null;
  selected_sub_movement?: string | null;
  effective_movement_identity?: LoggerIdentityReference | null;
  performed_canonical_movement_identity?: LoggerIdentityReference | null;
  core_movement?: LoggerIdentityReference | null;
  performed_core_movement?: LoggerIdentityReference | null;
  legacy?: {
    state?: string | null;
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: LoggerIdentityReference | null;
  } | null;
};

export type LoggerMovementIdentity = Readonly<{
  kind: 'core' | 'accessory';
  programmed: LoggerIdentityReference | null;
  effective: LoggerIdentityReference | null;
  equipment: LoggerIdentityReference | null;
  displayName: string;
  canonicalIdentityComplete: boolean;
}>;

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function withId(
  identity: LoggerIdentityReference | null | undefined,
  idOverride?: unknown,
): LoggerIdentityReference | null {
  const id = positiveId(idOverride) || positiveId(identity?.id);
  if (!id) return null;
  return { ...(identity || {}), id } as LoggerIdentityReference;
}

/** One authoritative movement subject; programmed intent and equipment stay separate. */
export function resolveLoggerMovementIdentity(
  input: LoggerMovementIdentityItem,
): LoggerMovementIdentity {
  const item = normalizeWorkoutItemMovementReferences(input, true);
  const performedCore = withId(item.performed_core_movement);
  const programmedCore = withId(item.core_movement);
  if (performedCore || programmedCore) {
    const effective = performedCore || programmedCore;
    return {
      kind: 'core',
      programmed: programmedCore,
      effective,
      equipment: null,
      displayName: effective?.display_name || item.movement || 'Movement',
      canonicalIdentityComplete: Boolean(effective),
    };
  }

  const equipment = activeEquipmentIdentity(item) as LoggerIdentityReference | null;
  const equipmentId = positiveId(equipment?.id);
  const serverEffective = withId(item.effective_movement_identity);
  const performedCanonical = withId(item.performed_canonical_movement_identity);
  const performedComparison = withId(
    item.performed_movement_identity as LoggerIdentityReference | null,
  );
  const performedMovement = performedComparison
    && positiveId(performedComparison.id) !== equipmentId
    ? performedComparison
    : null;
  const legacyEffective = withId(
    item.legacy?.effective_movement_identity,
    item.legacy?.effective_movement_definition_id,
  );
  const programmed = withId(
    item.movement_identity as LoggerIdentityReference | null,
  );
  const conflicting = conflictingWorkoutMovementReferences(item);
  const effective = conflicting ? null : serverEffective || performedCanonical || performedMovement || (
    item.is_substituted ? null : legacyEffective || programmed
  );

  return {
    kind: 'accessory',
    programmed,
    effective,
    equipment,
    displayName: effective?.display_name
      || item.selected_sub_movement
      || item.movement
      || item.original_movement
      || 'Accessory',
    canonicalIdentityComplete: Boolean(effective),
  };
}

/**
 * Canonical artwork consumes a normalized movement subject, never a WorkoutItem.
 * Row identity, display copy, equipment, and unrelated Logger state are excluded.
 */
export function canonicalArtworkInputForLoggerItem(
  item: CanonicalMovementArtworkInput & { id?: number | null },
): CanonicalMovementArtSubject {
  return normalizeCanonicalMovementArtSubject({
    item_id: item.item_id || item.id,
    set_log_id: item.set_log_id,
    movement_definition_id: item.movement_definition_id,
    effective_movement_definition_id: item.effective_movement_definition_id,
    performed_canonical_movement_definition_id: item.performed_canonical_movement_definition_id,
    core_movement_id: item.core_movement_id,
    core_family: item.core_family, core_kind: item.core_kind,
    primary_muscle_group: item.primary_muscle_group, secondary_muscle_groups: item.secondary_muscle_groups,
    kind: item.core_movement || item.performed_core_movement ? 'core' : 'accessory',
    lift: item.lift, variant: item.variant,
    core_movement: item.core_movement, performed_core_movement: item.performed_core_movement,
    is_substituted: Boolean(item.is_substituted),
    movement_identity: item.movement_identity,
    effective_movement_identity: item.effective_movement_identity,
    performed_canonical_movement_identity: item.performed_canonical_movement_identity,
    performed_movement_identity: item.performed_movement_identity,
    legacy: item.legacy,
  });
}
