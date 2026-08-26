import {
  resolveLoggerMovementIdentity,
  type LoggerMovementIdentityItem,
} from '@/lib/logger-movement-identity';

type IdentityReference = Readonly<{ id?: number | null }>;

export type MovementHistoryLaunchItem = Readonly<{
  id?: number | null;
  movement?: string | null;
  movement_identity?: IdentityReference | null;
  effective_movement_identity?: IdentityReference | null;
  performed_movement_identity?: IdentityReference | null;
  performed_canonical_movement_identity?: IdentityReference | null;
  core_movement?: IdentityReference | null;
  performed_core_movement?: IdentityReference | null;
  is_substituted?: boolean | null;
  original_movement?: string | null;
  selected_sub_movement?: string | null;
  legacy?: {
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: IdentityReference | null;
  } | null;
}>;

export type MovementHistoryLaunchTarget = Readonly<{
  athleteId: number;
  movementDefinitionId?: number;
  coreMovementId?: number;
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

  const normalized = resolveLoggerMovementIdentity(
    item as LoggerMovementIdentityItem,
  );
  const equipmentContextDefinitionId = positiveId(normalized.equipment?.id);

  const coreMovementId = normalized.kind === 'core'
    ? positiveId(normalized.effective?.id)
    : null;
  if (coreMovementId) {
    return {
      ok: true,
      target: {
        athleteId: resolvedAthleteId,
        coreMovementId,
      },
    };
  }

  const movementDefinitionId = normalized.kind === 'accessory'
    ? positiveId(normalized.effective?.id)
    : null;
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
  identityType,
  equipmentContextDefinitionId,
}: {
  athleteId: number | null | undefined;
  movementDefinitionId: number | null | undefined;
  identityType?: 'accessory' | 'core' | null;
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
      ...(identityType === 'core'
        ? { coreMovementId: resolvedMovementDefinitionId }
        : { movementDefinitionId: resolvedMovementDefinitionId }),
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
      ...(target.movementDefinitionId
        ? { movementDefinitionId: String(target.movementDefinitionId) }
        : {}),
      ...(target.coreMovementId
        ? { coreMovementId: String(target.coreMovementId) }
        : {}),
      ...(target.equipmentContextDefinitionId
        ? { equipmentContextDefinitionId: String(target.equipmentContextDefinitionId) }
        : {}),
    },
  };
}

export function movementHistorySheetRouteForCanonicalIdentity({
  movementDefinitionId,
  coreMovementId,
  identityType,
  athleteId,
  equipmentContextDefinitionId,
}: {
  movementDefinitionId?: number | null;
  coreMovementId?: number | null;
  identityType?: 'accessory' | 'core' | null;
  athleteId?: number | null;
  equipmentContextDefinitionId?: number | null;
}) {
  const resolvedCoreMovementId = positiveId(coreMovementId)
    || (identityType === 'core' ? positiveId(movementDefinitionId) : null);
  const resolvedMovementDefinitionId = identityType === 'core'
    ? null
    : positiveId(movementDefinitionId);
  if (!resolvedCoreMovementId && !resolvedMovementDefinitionId) {
    throw new Error('A typed governed movement identity is required to open Movement History.');
  }
  return {
    pathname: '/movement-history-sheet' as const,
    params: {
      ...(resolvedCoreMovementId
        ? { coreMovementId: String(resolvedCoreMovementId) }
        : { movementDefinitionId: String(resolvedMovementDefinitionId) }),
      ...(positiveId(athleteId) ? { athleteId: String(athleteId) } : {}),
      ...(positiveId(equipmentContextDefinitionId)
        ? { equipmentContextDefinitionId: String(equipmentContextDefinitionId) }
        : {}),
    },
  };
}
