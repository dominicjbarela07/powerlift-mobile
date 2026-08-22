import { activeEquipmentIdentity, type EquipmentAwareWorkoutItem } from '@/lib/equipment-selection';

type IdentityReference = Readonly<{ id?: number | null }>;

export type MovementHistoryLaunchItem = Readonly<{
  id?: number | null;
  movement?: string | null;
  movement_identity?: IdentityReference | null;
  performed_movement_identity?: IdentityReference | null;
  performed_canonical_movement_identity?: IdentityReference | null;
  legacy?: {
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: IdentityReference | null;
  } | null;
}>;

export type MovementHistoryLaunchTarget = Readonly<{
  athleteId: number;
  movementDefinitionId: number;
  equipmentContextDefinitionId?: number;
}>;

export type MovementHistoryLaunchResolution =
  | Readonly<{ ok: true; target: MovementHistoryLaunchTarget }>
  | Readonly<{
      ok: false;
      reason: 'athlete_context_missing' | 'canonical_identity_missing';
      message: string;
    }>;

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveMovementHistoryLaunchForItem({
  athleteId,
  item,
}: {
  athleteId: number | null | undefined;
  item: MovementHistoryLaunchItem;
}): MovementHistoryLaunchResolution {
  const resolvedAthleteId = positiveId(athleteId);
  if (!resolvedAthleteId) {
    return {
      ok: false,
      reason: 'athlete_context_missing',
      message: 'Movement History needs an athlete context.',
    };
  }

  const equipmentContextDefinitionId = positiveId(
    activeEquipmentIdentity(item as EquipmentAwareWorkoutItem)?.id,
  );

  // Governed movement identity is the subject. A resolved legacy identity is
  // authoritative when older Session rows have not materialized the direct
  // canonical fields yet. Historical equipment identities are explicitly
  // excluded from the movement-subject slot.
  const candidates = [
    item.performed_canonical_movement_identity?.id,
    item.movement_identity?.id,
    item.legacy?.effective_movement_identity?.id,
    item.legacy?.effective_movement_definition_id,
  ].map(positiveId);
  const movementDefinitionId = candidates.find((candidate) => (
    candidate && candidate !== equipmentContextDefinitionId
  )) || null;
  if (!movementDefinitionId) {
    return {
      ok: false,
      reason: 'canonical_identity_missing',
      message: 'This movement does not have a governed identity yet, so exact History cannot open safely.',
    };
  }

  // Equipment is presentation/filter context only. It never substitutes for
  // the governed movement subject and never selects comparison policy here.
  return {
    ok: true,
    target: {
      athleteId: resolvedAthleteId,
      movementDefinitionId,
      ...(equipmentContextDefinitionId ? { equipmentContextDefinitionId } : {}),
    },
  };
}

export function resolveMovementHistoryLaunchFromMeasurement({
  athleteId,
  movementDefinitionId,
  equipmentContextDefinitionId,
}: {
  athleteId: number | null | undefined;
  movementDefinitionId: number | null | undefined;
  equipmentContextDefinitionId?: number | null;
}): MovementHistoryLaunchResolution {
  const resolvedAthleteId = positiveId(athleteId);
  if (!resolvedAthleteId) {
    return {
      ok: false,
      reason: 'athlete_context_missing',
      message: 'Movement History needs an athlete context.',
    };
  }
  const resolvedMovementDefinitionId = positiveId(movementDefinitionId);
  if (!resolvedMovementDefinitionId) {
    return {
      ok: false,
      reason: 'canonical_identity_missing',
      message: 'This movement does not have a governed identity yet, so exact History cannot open safely.',
    };
  }
  const resolvedEquipmentContextId = positiveId(equipmentContextDefinitionId);
  return {
    ok: true,
    target: {
      athleteId: resolvedAthleteId,
      movementDefinitionId: resolvedMovementDefinitionId,
      ...(resolvedEquipmentContextId
        ? { equipmentContextDefinitionId: resolvedEquipmentContextId }
        : {}),
    },
  };
}

export function movementHistorySheetRoute(target: MovementHistoryLaunchTarget) {
  return {
    pathname: '/movement-history-sheet' as const,
    params: {
      athleteId: String(target.athleteId),
      movementDefinitionId: String(target.movementDefinitionId),
      ...(target.equipmentContextDefinitionId
        ? { equipmentContextDefinitionId: String(target.equipmentContextDefinitionId) }
        : {}),
    },
  };
}

export function movementHistorySheetRouteForCanonicalIdentity({
  movementDefinitionId,
  athleteId,
  equipmentContextDefinitionId,
}: {
  movementDefinitionId: number;
  athleteId?: number | null;
  equipmentContextDefinitionId?: number | null;
}) {
  return {
    pathname: '/movement-history-sheet' as const,
    params: {
      movementDefinitionId: String(movementDefinitionId),
      ...(positiveId(athleteId) ? { athleteId: String(athleteId) } : {}),
      ...(positiveId(equipmentContextDefinitionId)
        ? { equipmentContextDefinitionId: String(equipmentContextDefinitionId) }
        : {}),
    },
  };
}
