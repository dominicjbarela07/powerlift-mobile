import {
  focusedAccessoryMuscleRegionKey,
  type FocusedAccessoryMuscleRegionKey,
} from '@/lib/accessory-muscle-group';
import { isMovementArtworkReviewDenied } from '@/lib/movement-art-review-policy';

export type CanonicalCoreArtworkFamily = 'squat' | 'bench' | 'deadlift' | 'press';
// Entire free-weight inventory: docs/validation/free-weight-completion-2026-09-11/asset-manifest.json.
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
  495: { key: 'accessory_weighted_crunch', primary: 'abs' },
  251: { key: 'accessory_barbell_curl', primary: 'biceps' },
  252: { key: 'accessory_ez_bar_curl', primary: 'biceps' },
  253: { key: 'accessory_dumbbell_curl', primary: 'biceps' },
  254: { key: 'accessory_alternating_dumbbell_curl', primary: 'biceps' },
  255: { key: 'accessory_seated_dumbbell_curl', primary: 'biceps' },
  257: { key: 'accessory_incline_dumbbell_curl', primary: 'biceps' },
  476: { key: 'accessory_standing_dumbbell_calf_raise', primary: 'calves' },
  325: { key: 'accessory_barbell_wrist_curl', primary: 'forearms' },
  388: { key: 'accessory_dumbbell_romanian_deadlift', primary: 'hamstrings' },
  354: { key: 'accessory_bulgarian_split_squat', primary: 'quads' },
  256: { key: 'accessory_standing_dumbbell_curl', primary: 'biceps' },
  258: { key: 'accessory_spider_curl', primary: 'biceps' },
  259: { key: 'accessory_single_arm_preacher_curl', primary: 'biceps' },
  260: { key: 'accessory_dumbbell_preacher_curl', primary: 'biceps' },
  261: { key: 'accessory_ez_bar_preacher_curl', primary: 'biceps' },
  262: { key: 'accessory_concentration_curl', primary: 'biceps' },
  263: { key: 'accessory_hammer_curl', primary: 'biceps' },
  264: { key: 'accessory_cross_body_hammer_curl', primary: 'biceps' },
  265: { key: 'accessory_zottman_curl', primary: 'biceps' },
  267: { key: 'accessory_reverse_curl', primary: 'biceps' },
  268: { key: 'accessory_cheat_curl', primary: 'biceps' },
  326: { key: 'accessory_dumbbell_wrist_curl', primary: 'forearms' },
  327: { key: 'accessory_behind_the_back_wrist_curl', primary: 'forearms' },
  328: { key: 'accessory_reverse_wrist_curl', primary: 'forearms' },
  329: { key: 'accessory_dumbbell_reverse_wrist_curl', primary: 'forearms' },
  330: { key: 'accessory_wrist_roller', primary: 'forearms' },
  331: { key: 'accessory_plate_pinch', primary: 'forearms' },
  266: { key: 'accessory_drag_curl', primary: 'biceps' },
  332: { key: 'accessory_fat_grip_hold', primary: 'forearms' },
  333: { key: 'accessory_barbell_finger_curl', primary: 'forearms' },
  334: { key: 'accessory_lever_bar_pronation', primary: 'forearms' },
  336: { key: 'accessory_radial_deviation', primary: 'forearms' },
  337: { key: 'accessory_ulnar_deviation', primary: 'forearms' },
  348: { key: 'accessory_front_squat', primary: 'quads' },
  349: { key: 'accessory_high_bar_squat', primary: 'quads' },
  350: { key: 'accessory_zercher_squat', primary: 'quads' },
  351: { key: 'accessory_goblet_squat', primary: 'quads' },
  352: { key: 'accessory_cyclist_squat', primary: 'quads' },
  353: { key: 'accessory_heel_elevated_goblet_squat', primary: 'quads' },
  355: { key: 'accessory_front_foot_elevated_split_squat', primary: 'quads' },
  356: { key: 'accessory_heel_elevated_split_squat', primary: 'quads' },
  357: { key: 'accessory_reverse_lunge', primary: 'quads' },
  358: { key: 'accessory_walking_lunge', primary: 'quads' },
  359: { key: 'accessory_forward_lunge', primary: 'quads' },
  360: { key: 'accessory_lateral_lunge', primary: 'quads' },
  496: { key: 'accessory_dumbbell_sit_up', primary: 'abs' },
  497: { key: 'accessory_plate_sit_up', primary: 'abs' },
  498: { key: 'accessory_weighted_decline_sit_up', primary: 'abs' },
  477: { key: 'accessory_single_leg_dumbbell_calf_raise', primary: 'calves' },
  478: { key: 'accessory_barbell_calf_raise', primary: 'calves' },
  479: { key: 'accessory_seated_dumbbell_calf_raise', primary: 'calves' },
  335: { key: 'accessory_lever_bar_supination', primary: 'forearms' },
  418: { key: 'accessory_barbell_hip_thrust', primary: 'glutes' },
  420: { key: 'accessory_barbell_glute_bridge', primary: 'glutes' },
  421: { key: 'accessory_dumbbell_glute_bridge', primary: 'glutes' },
  422: { key: 'accessory_single_leg_hip_thrust', primary: 'glutes' },
  423: { key: 'accessory_b_stance_hip_thrust', primary: 'glutes' },
  424: { key: 'accessory_kas_glute_bridge', primary: 'glutes' },
  427: { key: 'accessory_long_stride_reverse_lunge', primary: 'glutes' },
  428: { key: 'accessory_glute_biased_step_up', primary: 'glutes' },
  429: { key: 'accessory_long_stride_bulgarian_split_squat', primary: 'glutes' },
  430: { key: 'accessory_dumbbell_frog_pump', primary: 'glutes' },
  387: { key: 'accessory_romanian_deadlift', primary: 'hamstrings' },
  389: { key: 'accessory_single_leg_romanian_deadlift', primary: 'hamstrings' },
  390: { key: 'accessory_b_stance_romanian_deadlift', primary: 'hamstrings' },
  391: { key: 'accessory_stiff_leg_deadlift', primary: 'hamstrings' },
  392: { key: 'accessory_snatch_grip_romanian_deadlift', primary: 'hamstrings' },
  393: { key: 'accessory_barbell_good_morning', primary: 'hamstrings' },
  394: { key: 'accessory_seated_good_morning', primary: 'hamstrings' },
  395: { key: 'accessory_dumbbell_good_morning', primary: 'hamstrings' },
  396: { key: 'accessory_glute_ham_raise_with_weight', primary: 'hamstrings' },
  546: { key: 'accessory_good_morning', primary: 'lower_back' },
  548: { key: 'accessory_zercher_good_morning', primary: 'lower_back' },
  523: { key: 'accessory_dumbbell_side_bend', primary: 'obliques' },
  524: { key: 'accessory_suitcase_march', primary: 'obliques' },
  525: { key: 'accessory_suitcase_carry', primary: 'obliques' },
  526: { key: 'accessory_landmine_rotation', primary: 'obliques' },
  527: { key: 'accessory_russian_twist_with_weight', primary: 'obliques' },
  361: { key: 'accessory_step_up', primary: 'quads' },
  362: { key: 'accessory_peterson_step_up', primary: 'quads' },
  363: { key: 'accessory_dumbbell_step_down', primary: 'quads' },
  364: { key: 'accessory_spanish_squat_with_weight', primary: 'quads' },
  500: { key: 'accessory_dumbbell_dead_bug', primary: 'abs' },
  480: { key: 'accessory_donkey_calf_raise_with_weight', primary: 'calves' },
  6: { key: 'incline_barbell_press', primary: 'chest' },
  7: { key: 'incline_dumbbell_press', primary: 'chest' },
  419: { key: 'accessory_dumbbell_hip_thrust', primary: 'glutes' },
  425: { key: 'accessory_sumo_romanian_deadlift', primary: 'glutes' },
  426: { key: 'accessory_deficit_reverse_lunge', primary: 'glutes' },
  569: { key: 'accessory_dumbbell_psoas_march', primary: 'hip_flexors' },
  570: { key: 'accessory_ankle_weight_hip_flexion', primary: 'hip_flexors' },
  580: { key: 'accessory_plate_neck_flexion', primary: 'neck' },
  581: { key: 'accessory_plate_neck_extension', primary: 'neck' },
  582: { key: 'accessory_plate_lateral_neck_flexion', primary: 'neck' },
  528: { key: 'accessory_barbell_windshield_wiper', primary: 'obliques' },
  560: { key: 'accessory_dumbbell_serratus_punch', primary: 'serratus' },
  561: { key: 'accessory_dumbbell_pullover_serratus_reach', primary: 'serratus' },
  4: { key: 'barbell_row', primary: 'upper_back' },
  5: { key: 'single_arm_dumbbell_row', primary: 'upper_back' },
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
      reason: 'missing_canonical_identity' | 'missing_governed_taxonomy' | 'unsupported_core_family' | 'human_artwork_review_required';
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
  if (accessory.artworkKey && isMovementArtworkReviewDenied(accessory.artworkKey)) {
    return { kind: 'neutral', reason: 'human_artwork_review_required' };
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
