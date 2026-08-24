import {
  activeEquipmentIdentity,
  type EquipmentAwareWorkoutItem,
  type EquipmentIdentityLike,
} from '@/lib/equipment-selection';

export type LoggerIdentityReference = EquipmentIdentityLike & {
  kind?: string | null;
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

export type LoggerMovementIdentity = Readonly<{
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
  item: LoggerMovementIdentityItem,
): LoggerMovementIdentity {
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
  const effective = serverEffective || performedCanonical || performedMovement || (
    item.is_substituted ? null : legacyEffective || programmed
  );

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
  };
}
