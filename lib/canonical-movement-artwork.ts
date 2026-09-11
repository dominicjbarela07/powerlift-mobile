import {
  focusedAccessoryMuscleRegionKey,
  type FocusedAccessoryMuscleRegionKey,
} from '@/lib/accessory-muscle-group';

export type CanonicalCoreArtworkFamily = 'squat' | 'bench' | 'deadlift' | 'press';
// Canonical DEV database audits: docs/validation/free-weight-{push,pull}-family-2026-09-11.
// Numeric MovementDefinition IDs are the lookup boundary. Stable keys and primary
// taxonomy must agree, excluding row-ID collisions and contradictory subjects.
export const CANONICAL_ACCESSORY_ARTWORK_IDENTITIES = {
  32: { key: 'accessory_flat_dumbbell_bench_press', primary: 'chest' },
  33: { key: 'accessory_incline_dumbbell_bench_press', primary: 'chest' },
  34: { key: 'accessory_decline_dumbbell_bench_press', primary: 'chest' },
  35: { key: 'accessory_neutral_grip_dumbbell_bench_press', primary: 'chest' },
  36: { key: 'accessory_dumbbell_floor_press', primary: 'chest' },
  37: { key: 'accessory_dumbbell_squeeze_press', primary: 'chest' },
  38: { key: 'accessory_dumbbell_hex_press', primary: 'chest' },
  39: { key: 'accessory_dumbbell_flye', primary: 'chest' },
  40: { key: 'accessory_incline_dumbbell_flye', primary: 'chest' },
  41: { key: 'accessory_decline_dumbbell_flye', primary: 'chest' },
  42: { key: 'accessory_barbell_floor_press', primary: 'chest' },
  43: { key: 'accessory_spoto_press', primary: 'chest' },
  44: { key: 'accessory_larsen_press', primary: 'chest' },
  45: { key: 'accessory_guillotine_press', primary: 'chest' },
  46: { key: 'accessory_reverse_grip_bench_press', primary: 'chest' },
  47: { key: 'accessory_cambered_bar_bench_press', primary: 'chest' },
  73: { key: 'accessory_weighted_push_up', primary: 'chest' },
  79: { key: 'accessory_seated_dumbbell_shoulder_press', primary: 'front_delts' },
  80: { key: 'accessory_standing_dumbbell_shoulder_press', primary: 'front_delts' },
  81: { key: 'accessory_arnold_press', primary: 'front_delts' },
  82: { key: 'accessory_dumbbell_front_raise', primary: 'front_delts' },
  83: { key: 'accessory_alternating_dumbbell_front_raise', primary: 'front_delts' },
  84: { key: 'accessory_plate_front_raise', primary: 'front_delts' },
  85: { key: 'accessory_barbell_front_raise', primary: 'front_delts' },
  86: { key: 'accessory_landmine_press', primary: 'front_delts' },
  87: { key: 'accessory_half_kneeling_landmine_press', primary: 'front_delts' },
  88: { key: 'accessory_single_arm_landmine_press', primary: 'front_delts' },
  89: { key: 'accessory_z_press', primary: 'front_delts' },
  90: { key: 'accessory_bradford_press', primary: 'front_delts' },
  103: { key: 'accessory_dumbbell_lateral_raise', primary: 'side_delts' },
  104: { key: 'accessory_seated_dumbbell_lateral_raise', primary: 'side_delts' },
  105: { key: 'accessory_incline_dumbbell_lateral_raise', primary: 'side_delts' },
  106: { key: 'accessory_lean_away_dumbbell_lateral_raise', primary: 'side_delts' },
  107: { key: 'accessory_lying_dumbbell_lateral_raise', primary: 'side_delts' },
  108: { key: 'accessory_chest_supported_dumbbell_lateral_raise', primary: 'side_delts' },
  109: { key: 'accessory_partial_dumbbell_lateral_raise', primary: 'side_delts' },
  110: { key: 'accessory_lu_raise', primary: 'side_delts' },
  111: { key: 'accessory_dumbbell_upright_row', primary: 'side_delts' },
  112: { key: 'accessory_wide_grip_barbell_upright_row', primary: 'side_delts' },
  289: { key: 'accessory_close_grip_bench_press', primary: 'triceps' },
  290: { key: 'accessory_jm_press', primary: 'triceps' },
  291: { key: 'accessory_barbell_skull_crusher', primary: 'triceps' },
  292: { key: 'accessory_ez_bar_skull_crusher', primary: 'triceps' },
  293: { key: 'accessory_dumbbell_skull_crusher', primary: 'triceps' },
  294: { key: 'accessory_incline_skull_crusher', primary: 'triceps' },
  295: { key: 'accessory_decline_skull_crusher', primary: 'triceps' },
  296: { key: 'accessory_dumbbell_overhead_triceps_extension', primary: 'triceps' },
  297: { key: 'accessory_single_arm_dumbbell_overhead_triceps_extension', primary: 'triceps' },
  298: { key: 'accessory_tate_press', primary: 'triceps' },
  299: { key: 'accessory_rolling_dumbbell_triceps_extension', primary: 'triceps' },
  300: { key: 'accessory_pjr_pullover', primary: 'triceps' },
  126: { key: 'accessory_bent_over_dumbbell_reverse_flye', primary: 'rear_delts' },
  127: { key: 'accessory_chest_supported_dumbbell_reverse_flye', primary: 'rear_delts' },
  128: { key: 'accessory_incline_bench_rear_delt_flye', primary: 'rear_delts' },
  129: { key: 'accessory_rear_delt_dumbbell_row', primary: 'rear_delts' },
  130: { key: 'accessory_wide_elbow_dumbbell_row', primary: 'rear_delts' },
  131: { key: 'accessory_rear_delt_barbell_row', primary: 'rear_delts' },
  154: { key: 'accessory_one_arm_dumbbell_row', primary: 'lats' },
  191: { key: 'accessory_bent_over_barbell_row', primary: 'upper_back' },
  194: { key: 'accessory_chest_supported_dumbbell_row', primary: 'upper_back' },
  235: { key: 'accessory_dumbbell_shrug', primary: 'traps' },
  132: { key: 'accessory_wide_grip_chest_supported_rear_delt_row', primary: 'rear_delts' },
  133: { key: 'accessory_prone_rear_delt_swing', primary: 'rear_delts' },
  150: { key: 'accessory_dumbbell_archer_row', primary: 'rear_delts' },
  153: { key: 'accessory_meadows_row', primary: 'lats' },
  155: { key: 'accessory_dumbbell_pullover', primary: 'lats' },
  157: { key: 'accessory_kroc_row', primary: 'lats' },
  158: { key: 'accessory_three_point_dumbbell_row', primary: 'lats' },
  161: { key: 'accessory_lat_biased_dumbbell_row', primary: 'lats' },
  162: { key: 'accessory_lat_biased_chest_supported_dumbbell_row', primary: 'lats' },
  192: { key: 'accessory_pendlay_row', primary: 'upper_back' },
  193: { key: 'accessory_seal_row', primary: 'upper_back' },
  195: { key: 'accessory_chest_supported_barbell_row', primary: 'upper_back' },
  196: { key: 'accessory_incline_bench_dumbbell_row', primary: 'upper_back' },
  197: { key: 'accessory_t_bar_row', primary: 'upper_back' },
  156: { key: 'accessory_barbell_pullover', primary: 'lats' },
  159: { key: 'accessory_landmine_row', primary: 'lats' },
  160: { key: 'accessory_one_arm_landmine_row', primary: 'lats' },
  198: { key: 'accessory_wide_grip_t_bar_row', primary: 'upper_back' },
  199: { key: 'accessory_chest_supported_t_bar_row', primary: 'upper_back' },
  200: { key: 'accessory_helms_row', primary: 'upper_back' },
  201: { key: 'accessory_batwing_row', primary: 'upper_back' },
  202: { key: 'accessory_gorilla_row', primary: 'upper_back' },
  203: { key: 'accessory_snatch_grip_barbell_row', primary: 'upper_back' },
  204: { key: 'accessory_wide_elbow_barbell_row', primary: 'upper_back' },
  205: { key: 'accessory_chest_supported_kelso_row', primary: 'upper_back' },
  206: { key: 'accessory_dumbbell_high_row', primary: 'upper_back' },
  234: { key: 'accessory_barbell_shrug', primary: 'traps' },
  236: { key: 'accessory_trap_bar_shrug', primary: 'traps' },
  237: { key: 'accessory_behind_the_back_barbell_shrug', primary: 'traps' },
  238: { key: 'accessory_snatch_grip_shrug', primary: 'traps' },
  239: { key: 'accessory_overhead_barbell_shrug', primary: 'traps' },
  240: { key: 'accessory_farmer_carry', primary: 'traps' },
  241: { key: 'accessory_chest_supported_kelso_shrug', primary: 'traps' },
  242: { key: 'accessory_kelso_shrug', primary: 'traps' },
  545: { key: 'accessory_barbell_back_extension', primary: 'lower_back' },
  547: { key: 'accessory_jefferson_curl', primary: 'lower_back' },
  549: { key: 'accessory_weighted_sorenson_hold', primary: 'lower_back' },
} as const;
export type CanonicalAccessoryArtworkKey =
  typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[keyof typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES]['key'];
const REGISTERED_ACCESSORY_ARTWORK_KEYS = new Set<string>(
  Object.values(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES).map((entry) => entry.key),
);

type GovernedAccessoryIdentity = Readonly<{
  id?: number | null;
  key?: string | null;
  family?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: readonly string[] | null;
  material_parameters?: Readonly<{
    accessory_taxonomy?: Readonly<{
      primary_muscle_group?: string | null;
      secondary_muscle_groups?: readonly string[] | null;
    }> | null;
  }> | null;
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
  effective_movement_identity?: GovernedAccessoryIdentity | null;
  is_substituted?: boolean | null;
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
      artworkKey?: CanonicalAccessoryArtworkKey;
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
      family: coreFamily(nested.family)
        || coreFamily(movement.core_family || movement.family)
        || coreFamilyFromLiftCode(movement.lift),
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
): {
  id: number;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: readonly string[];
  artworkKey?: CanonicalAccessoryArtworkKey;
} | null {
  const governedTaxonomy = (
    identity?: GovernedAccessoryIdentity | null,
    allowParentFallback = false,
  ): { primaryMuscleGroup: string; secondaryMuscleGroups: readonly string[] } | null => {
    const nested = identity?.material_parameters?.accessory_taxonomy;
    const primary = identity?.primary_muscle_group
      || nested?.primary_muscle_group
      || (allowParentFallback ? movement.primary_muscle_group : null)
      || (allowParentFallback ? movement.family : null)
      || identity?.family;
    const region = focusedAccessoryMuscleRegionKey(primary);
    if (!region) return null;
    return {
      primaryMuscleGroup: region,
      secondaryMuscleGroups: identity?.secondary_muscle_groups
        || nested?.secondary_muscle_groups
        || (allowParentFallback ? movement.secondary_muscle_groups : null)
        || [],
    };
  };
  const candidate = (
    identity?: GovernedAccessoryIdentity | null,
    idOverride?: unknown,
    allowParentFallback = false,
  ) => {
    const id = positiveId(idOverride) || positiveId(identity?.id);
    if (positiveId(idOverride) && positiveId(identity?.id) !== positiveId(idOverride)) return null;
    const taxonomy = governedTaxonomy(identity, allowParentFallback);
    if (!id || !taxonomy) return null;
    const registered = CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[
      id as keyof typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES
    ];
    if (registered && (
      identity?.key !== registered.key
      || taxonomy.primaryMuscleGroup !== registered.primary
    )) return null;
    if (!registered && REGISTERED_ACCESSORY_ARTWORK_KEYS.has(identity?.key || '')) return null;
    const artworkKey: CanonicalAccessoryArtworkKey | undefined = registered?.key;
    return { id, ...taxonomy, ...(artworkKey ? { artworkKey } : {}) };
  };

  // A performed equipment implementation is not a movement identity. Prefer
  // the server-normalized effective subject and explicit performed canonical
  // movement. A performed identity is only eligible when it carries governed
  // movement taxonomy of its own.
  // An explicit authoritative subject cannot fall through to the prescription
  // when incomplete. Conflicting canonical subjects also fail closed.
  const effective = movement.effective_movement_identity;
  const performedCanonical = movement.performed_canonical_movement_identity;
  if (effective && performedCanonical && (
    positiveId(effective.id) !== positiveId(performedCanonical.id)
    || (effective.key && performedCanonical.key && effective.key !== performedCanonical.key)
  )) return null;
  if (effective) return candidate(effective);
  if (performedCanonical) return candidate(performedCanonical);
  const performed = movement.performed_movement_identity;
  if (performed && governedTaxonomy(performed)) return candidate(performed);

  // A substitution without a stable performed ID is incomplete. Do not paint
  // the original prescription as if it were the movement currently performed.
  if (movement.is_substituted) return null;
  const legacyState = normalizedToken(movement.legacy?.state);
  const hasResolvedLegacy = ['canonical', 'legacy_resolved', 'resolved'].includes(legacyState)
    && positiveId(movement.legacy?.effective_movement_definition_id)
    && movement.legacy?.effective_movement_identity;
  if (hasResolvedLegacy) {
    return candidate(
      movement.legacy.effective_movement_identity,
      movement.legacy.effective_movement_definition_id,
    );
  }

  if (movement.movement_identity) return candidate(movement.movement_identity, undefined, true);

  const directAccessory = ['accessory', 'custom'].includes(normalizedToken(movement.kind))
    || normalizedToken(movement.identity_type) === 'accessory';
  if (!directAccessory) return null;
  const id = positiveId(movement.measurement?.canonical_identity_id)
    || positiveId(movement.movement_definition_id)
    || positiveId(movement.id);
  if (!id) return null;
  return candidate({
      id,
      key: movement.key,
      family: movement.family,
      primary_muscle_group: movement.primary_muscle_group,
      secondary_muscle_groups: movement.secondary_muscle_groups,
    }, id, true);
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
  if (!accessory) {
    const hasAccessoryIdentity = [
      movement.legacy?.effective_movement_definition_id,
      movement.effective_movement_identity?.id,
      movement.performed_canonical_movement_identity?.id,
      movement.movement_identity?.id,
      movement.performed_movement_identity?.id,
      movement.measurement?.canonical_identity_id,
      movement.movement_definition_id,
      ['accessory', 'custom'].includes(normalizedToken(movement.kind)) ? movement.id : null,
    ].some((value) => positiveId(value));
    return {
      kind: 'neutral',
      reason: hasAccessoryIdentity ? 'missing_governed_taxonomy' : 'missing_canonical_identity',
    };
  }
  return {
    kind: 'accessory',
    canonicalIdentityId: accessory.id,
    regionKey: accessory.primaryMuscleGroup as FocusedAccessoryMuscleRegionKey,
    primaryMuscleGroup: accessory.primaryMuscleGroup,
    secondaryMuscleGroups: accessory.secondaryMuscleGroups,
    ...(accessory.artworkKey ? { artworkKey: accessory.artworkKey } : {}),
  };
}
