import {
  activeEquipmentIdentity,
  type EquipmentAwareWorkoutItem,
  type EquipmentIdentityLike,
} from '@/lib/equipment-selection';

export type LoggerIdentityReference = EquipmentIdentityLike & {
  family?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[] | null;
};

export type LoggerMovementIdentityItem = EquipmentAwareWorkoutItem & {
  is_substituted?: boolean | null;
  original_movement?: string | null;
  selected_sub_movement?: string | null;
  effective_movement_identity?: LoggerIdentityReference | null;
  performed_canonical_movement_identity?: LoggerIdentityReference | null;
  legacy?: {
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: LoggerIdentityReference | null;
  } | null;
};

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function withId(identity: LoggerIdentityReference | null | undefined, idOverride?: unknown) {
  const id = positiveId(idOverride) || positiveId(identity?.id);
  return id ? ({ ...(identity || {}), id } as LoggerIdentityReference) : null;
}

export function resolveLoggerMovementIdentity(item: LoggerMovementIdentityItem) {
  const equipment = activeEquipmentIdentity(item) as LoggerIdentityReference | null;
  const equipmentId = positiveId(equipment?.id);
  const performedComparison = withId(
    item.performed_movement_identity as LoggerIdentityReference | null,
  );
  const performedMovement = performedComparison
    && positiveId(performedComparison.id) !== equipmentId
    ? performedComparison
    : null;
  const programmed = withId(item.movement_identity as LoggerIdentityReference | null);
  const effective = withId(item.effective_movement_identity)
    || withId(item.performed_canonical_movement_identity)
    || performedMovement
    || (item.is_substituted ? null : withId(
      item.legacy?.effective_movement_identity,
      item.legacy?.effective_movement_definition_id,
    ) || programmed);
  return {
    programmed,
    effective,
    equipment,
    displayName: effective?.display_name
      || item.selected_sub_movement
      || item.movement
      || item.original_movement
      || 'Accessory',
    canonicalIdentityComplete: Boolean(effective),
  } as const;
}
