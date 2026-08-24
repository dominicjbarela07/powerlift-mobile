import {
  focusedAccessoryMuscleRegionKey,
  type FocusedAccessoryMuscleRegionKey,
} from '@/lib/accessory-muscle-group';

export type CanonicalCoreArtworkFamily = 'squat' | 'bench' | 'deadlift' | 'press';

type GovernedAccessoryIdentity = Readonly<{
  id?: number | null;
  key?: string | null;
  family?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: readonly string[] | null;
}>;

type GovernedCoreIdentity = Readonly<{
  id?: number | null;
  key?: string | null;
  family?: string | null;
  kind?: string | null;
}>;

export type CanonicalMovementArtworkInput = Readonly<{
  id?: number | null;
  key?: string | null;
  family?: string | null;
  kind?: string | null;
  identity_type?: string | null;
  lift?: string | null;
  variant?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: readonly string[] | null;
  core_family?: string | null;
  core_kind?: string | null;
  movement_definition_id?: number | null;
  core_movement_id?: number | null;
  movement_identity?: GovernedAccessoryIdentity | null;
  performed_movement_identity?: GovernedAccessoryIdentity | null;
  performed_canonical_movement_identity?: GovernedAccessoryIdentity | null;
  core_movement?: GovernedCoreIdentity | null;
  performed_core_movement?: GovernedCoreIdentity | null;
  measurement?: Readonly<{ canonical_identity_id?: number | null }> | null;
  legacy?: Readonly<{
    state?: string | null;
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: GovernedAccessoryIdentity | null;
  }> | null;
}>;

export type CanonicalMovementArtworkResolution =
  | Readonly<{
      kind: 'accessory';
      canonicalIdentityId: number;
      regionKey: FocusedAccessoryMuscleRegionKey;
      primaryMuscleGroup: string;
      secondaryMuscleGroups: readonly string[];
    }>
  | Readonly<{
      kind: 'core' | 'core_variant';
      canonicalIdentityId: number;
      family: CanonicalCoreArtworkFamily;
    }>
  | Readonly<{
      kind: 'neutral';
      reason: 'missing_canonical_identity' | 'missing_governed_taxonomy' | 'unsupported_core_family';
    }>;

const CORE_FAMILIES = new Set<CanonicalCoreArtworkFamily>(['squat', 'bench', 'deadlift', 'press']);

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizedToken(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function coreFamily(value: unknown): CanonicalCoreArtworkFamily | null {
  const normalized = normalizedToken(value);
  return CORE_FAMILIES.has(normalized as CanonicalCoreArtworkFamily)
    ? normalized as CanonicalCoreArtworkFamily
    : null;
}

function coreFamilyFromLiftCode(value: unknown): CanonicalCoreArtworkFamily | null {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'SQ') return 'squat';
  if (code === 'BN') return 'bench';
  if (code === 'DL') return 'deadlift';
  if (code === 'OHP') return 'press';
  return null;
}

function explicitCoreIdentity(
  movement: CanonicalMovementArtworkInput,
): { id: number; family: CanonicalCoreArtworkFamily | null; variant: boolean } | null {
  const nested = [movement.performed_core_movement, movement.core_movement]
    .find((identity) => positiveId(identity?.id));
  if (nested) {
    return {
      id: positiveId(nested.id)!,
      family: coreFamily(nested.family),
      variant: normalizedToken(nested.kind) === 'variant',
    };
  }

  const directCore = normalizedToken(movement.identity_type) === 'core'
    || normalizedToken(movement.kind) === 'core'
    || normalizedToken(movement.kind) === 'variant'
    || Boolean(movement.core_family || movement.core_kind || movement.core_movement_id);
  if (!directCore) return null;
  const id = positiveId(movement.core_movement_id)
    || positiveId(movement.measurement?.canonical_identity_id)
    || positiveId(movement.id);
  if (!id) return null;
  return {
    id,
    family: coreFamily(movement.core_family || movement.family) || coreFamilyFromLiftCode(movement.lift),
    variant: normalizedToken(movement.core_kind || movement.kind) === 'variant'
      || normalizedToken(movement.variant) === 'vr',
  };
}

function explicitAccessoryIdentity(
  movement: CanonicalMovementArtworkInput,
): { id: number; identity: GovernedAccessoryIdentity } | null {
  const resolvedLegacy = normalizedToken(movement.legacy?.state) === 'legacy_resolved'
    && positiveId(movement.legacy?.effective_movement_definition_id)
    && movement.legacy?.effective_movement_identity
    ? {
        id: positiveId(movement.legacy.effective_movement_definition_id)!,
        identity: movement.legacy.effective_movement_identity,
      }
    : null;
  if (resolvedLegacy) return resolvedLegacy;

  for (const identity of [
    movement.performed_canonical_movement_identity,
    movement.performed_movement_identity,
    movement.movement_identity,
  ]) {
    const id = positiveId(identity?.id);
    if (id && identity) return { id, identity };
  }

  const directAccessory = ['accessory', 'custom'].includes(normalizedToken(movement.kind))
    || normalizedToken(movement.identity_type) === 'accessory';
  if (!directAccessory) return null;
  const id = positiveId(movement.measurement?.canonical_identity_id)
    || positiveId(movement.movement_definition_id)
    || positiveId(movement.id);
  if (!id) return null;
  return {
    id,
    identity: {
      id,
      key: movement.key,
      primary_muscle_group: movement.primary_muscle_group,
      secondary_muscle_groups: movement.secondary_muscle_groups,
    },
  };
}

/**
 * The only semantic resolver for artwork representing one exact movement.
 * It consumes governed identity/taxonomy and has no title, alias, equipment,
 * Session-focus, or full-figure anatomy fallback.
 */
export function resolveCanonicalMovementArtwork(
  movement?: CanonicalMovementArtworkInput | null,
): CanonicalMovementArtworkResolution {
  if (!movement) return { kind: 'neutral', reason: 'missing_canonical_identity' };

  const core = explicitCoreIdentity(movement);
  if (core) {
    if (!core.family) return { kind: 'neutral', reason: 'unsupported_core_family' };
    return {
      kind: core.variant ? 'core_variant' : 'core',
      canonicalIdentityId: core.id,
      family: core.family,
    };
  }

  const accessory = explicitAccessoryIdentity(movement);
  if (!accessory) return { kind: 'neutral', reason: 'missing_canonical_identity' };
  const regionKey = focusedAccessoryMuscleRegionKey(accessory.identity.primary_muscle_group);
  if (!regionKey) return { kind: 'neutral', reason: 'missing_governed_taxonomy' };
  return {
    kind: 'accessory',
    canonicalIdentityId: accessory.id,
    regionKey,
    primaryMuscleGroup: String(accessory.identity.primary_muscle_group),
    secondaryMuscleGroups: accessory.identity.secondary_muscle_groups || [],
  };
}
