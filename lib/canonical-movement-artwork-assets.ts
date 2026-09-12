import type { ImageSourcePropType } from 'react-native';

import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import {
  resolveCanonicalMovementArtwork,
  type CanonicalAccessoryArtworkKey,
  type CanonicalCoreArtworkFamily,
  type CanonicalMovementArtworkInput,
} from '@/lib/canonical-movement-artwork';

export const CANONICAL_CORE_MOVEMENT_ARTWORK: Readonly<
  Record<CanonicalCoreArtworkFamily, ImageSourcePropType>
> = {
  squat: require('@/assets/images/lift-icons/achievement-material-v2/squat.png'),
  bench: require('@/assets/images/lift-icons/achievement-material-v2/bench.png'),
  deadlift: require('@/assets/images/lift-icons/achievement-material-v2/deadlift.png'),
  press: require('@/assets/images/lift-icons/achievement-material-v2/press.png'),
};

// This generated family is explicitly DEV-only pending human review and release authorization.
// Metro removes the unreachable asset requires from TestFlight/Production exports.
export const CANONICAL_ACCESSORY_MOVEMENT_ARTWORK: Readonly<Record<
  CanonicalAccessoryArtworkKey,
  Readonly<{ source: ImageSourcePropType; thumbnail: ImageSourcePropType; label: string }>
>> = __DEV__ ? {
  accessory_flat_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/flat-dumbbell-bench-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/flat-dumbbell-bench-press-v1-thumb.png'),
    label: 'Athlete performing flat dumbbell bench press',
  },
  accessory_incline_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-incline-bench-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-incline-bench-press-v1-thumb.png'),
    label: 'Athlete performing incline dumbbell bench press',
  },
  accessory_decline_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/decline-dumbbell-bench-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/decline-dumbbell-bench-press-v1-thumb.png'),
    label: 'Athlete performing decline dumbbell bench press',
  },
  accessory_neutral_grip_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/neutral-grip-dumbbell-bench-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/neutral-grip-dumbbell-bench-press-v1-thumb.png'),
    label: 'Athlete performing neutral-grip dumbbell bench press',
  },
  accessory_dumbbell_floor_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-floor-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-floor-press-v1-thumb.png'),
    label: 'Athlete performing dumbbell floor press',
  },
  accessory_dumbbell_squeeze_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-squeeze-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-squeeze-press-v1-thumb.png'),
    label: 'Athlete performing dumbbell squeeze press',
  },
  accessory_dumbbell_hex_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-hex-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-hex-press-v1-thumb.png'),
    label: 'Athlete performing dumbbell hex press',
  },
  accessory_dumbbell_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-flye-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-flye-v1-thumb.png'),
    label: 'Athlete performing dumbbell fly',
  },
  accessory_incline_dumbbell_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-flye-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-flye-v1-thumb.png'),
    label: 'Athlete performing incline dumbbell fly',
  },
  accessory_decline_dumbbell_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/decline-dumbbell-flye-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/decline-dumbbell-flye-v1-thumb.png'),
    label: 'Athlete performing decline dumbbell flys',
  },
  accessory_barbell_floor_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-floor-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-floor-press-v1-thumb.png'),
    label: 'Athlete performing barbell floor press',
  },
  accessory_spoto_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/spoto-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/spoto-press-v1-thumb.png'),
    label: 'Athlete performing spoto press',
  },
  accessory_larsen_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/larsen-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/larsen-press-v1-thumb.png'),
    label: 'Athlete performing larsen press',
  },
  accessory_guillotine_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/guillotine-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/guillotine-press-v1-thumb.png'),
    label: 'Athlete performing guillotine press',
  },
  accessory_reverse_grip_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/reverse-grip-bench-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/reverse-grip-bench-press-v1-thumb.png'),
    label: 'Athlete performing reverse-grip bench press',
  },
  accessory_cambered_bar_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/cambered-bar-bench-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/cambered-bar-bench-press-v1-thumb.png'),
    label: 'Athlete performing cambered-bar bench press',
  },
  accessory_weighted_push_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/weighted-push-up-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/weighted-push-up-v1-thumb.png'),
    label: 'Athlete performing weighted push-up',
  },
  accessory_seated_dumbbell_shoulder_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-shoulder-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-shoulder-press-v1-thumb.png'),
    label: 'Athlete performing seated dumbbell shoulder press',
  },
  accessory_standing_dumbbell_shoulder_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-shoulder-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-shoulder-press-v1-thumb.png'),
    label: 'Athlete performing standing dumbbell shoulder press',
  },
  accessory_arnold_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/arnold-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/arnold-press-v1-thumb.png'),
    label: 'Athlete performing arnold press',
  },
  accessory_dumbbell_front_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-front-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-front-raise-v1-thumb.png'),
    label: 'Athlete performing dumbbell front raise',
  },
  accessory_alternating_dumbbell_front_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/alternating-dumbbell-front-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/alternating-dumbbell-front-raise-v1-thumb.png'),
    label: 'Athlete performing alternating dumbbell front raise',
  },
  accessory_plate_front_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-front-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/plate-front-raise-v1-thumb.png'),
    label: 'Athlete performing plate front raise',
  },
  accessory_barbell_front_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-front-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-front-raise-v1-thumb.png'),
    label: 'Athlete performing barbell front raise',
  },
  accessory_landmine_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/landmine-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/landmine-press-v1-thumb.png'),
    label: 'Athlete performing landmine press',
  },
  accessory_half_kneeling_landmine_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/half-kneeling-landmine-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/half-kneeling-landmine-press-v1-thumb.png'),
    label: 'Athlete performing half-kneeling landmine press',
  },
  accessory_single_arm_landmine_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-landmine-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-landmine-press-v1-thumb.png'),
    label: 'Athlete performing single-arm landmine press',
  },
  accessory_z_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/z-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/z-press-v1-thumb.png'),
    label: 'Athlete performing z press',
  },
  accessory_bradford_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/bradford-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/bradford-press-v1-thumb.png'),
    label: 'Athlete performing bradford press',
  },
  accessory_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-lateral-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-lateral-raise-v1-thumb.png'),
    label: 'Athlete performing dumbbell lateral raise',
  },
  accessory_seated_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-lateral-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-lateral-raise-v1-thumb.png'),
    label: 'Athlete performing seated dumbbell lateral raise',
  },
  accessory_incline_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-lateral-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-lateral-raise-v1-thumb.png'),
    label: 'Athlete performing incline dumbbell lateral raise',
  },
  accessory_lean_away_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lean-away-dumbbell-lateral-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/lean-away-dumbbell-lateral-raise-v1-thumb.png'),
    label: 'Athlete performing lean-away dumbbell lateral raise',
  },
  accessory_lying_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lying-dumbbell-lateral-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/lying-dumbbell-lateral-raise-v1-thumb.png'),
    label: 'Athlete performing lying dumbbell lateral raise',
  },
  accessory_chest_supported_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-lateral-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-lateral-raise-v1-thumb.png'),
    label: 'Athlete performing chest-supported dumbbell lateral raise',
  },
  accessory_partial_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/partial-dumbbell-lateral-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/partial-dumbbell-lateral-raise-v1-thumb.png'),
    label: 'Athlete performing partial dumbbell lateral raise',
  },
  accessory_lu_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lu-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/lu-raise-v1-thumb.png'),
    label: 'Athlete performing lu raise',
  },
  accessory_dumbbell_upright_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-upright-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-upright-row-v1-thumb.png'),
    label: 'Athlete performing dumbbell upright row',
  },
  accessory_wide_grip_barbell_upright_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-barbell-upright-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-barbell-upright-row-v1-thumb.png'),
    label: 'Athlete performing wide-grip barbell upright row',
  },
  accessory_close_grip_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/close-grip-bench-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/close-grip-bench-press-v1-thumb.png'),
    label: 'Athlete performing close-grip bench press',
  },
  accessory_jm_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/jm-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/jm-press-v1-thumb.png'),
    label: 'Athlete performing jm press',
  },
  accessory_barbell_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-skull-crusher-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-skull-crusher-v1-thumb.png'),
    label: 'Athlete performing barbell skull crusher',
  },
  accessory_ez_bar_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-skull-crusher-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-skull-crusher-v1-thumb.png'),
    label: 'Athlete performing ez-bar skull crusher',
  },
  accessory_dumbbell_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-skull-crusher-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-skull-crusher-v1-thumb.png'),
    label: 'Athlete performing dumbbell skull crusher',
  },
  accessory_incline_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-skull-crusher-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/incline-skull-crusher-v1-thumb.png'),
    label: 'Athlete performing incline skull crusher',
  },
  accessory_decline_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/decline-skull-crusher-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/decline-skull-crusher-v1-thumb.png'),
    label: 'Athlete performing decline skull crusher',
  },
  accessory_dumbbell_overhead_triceps_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-overhead-triceps-extension-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-overhead-triceps-extension-v1-thumb.png'),
    label: 'Athlete performing dumbbell overhead triceps extension',
  },
  accessory_single_arm_dumbbell_overhead_triceps_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-dumbbell-overhead-triceps-extension-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-dumbbell-overhead-triceps-extension-v1-thumb.png'),
    label: 'Athlete performing single-arm dumbbell overhead triceps extension',
  },
  accessory_tate_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/tate-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/tate-press-v1-thumb.png'),
    label: 'Athlete performing tate press',
  },
  accessory_rolling_dumbbell_triceps_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/rolling-dumbbell-triceps-extension-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/rolling-dumbbell-triceps-extension-v1-thumb.png'),
    label: 'Athlete performing rolling dumbbell triceps extension',
  },
  accessory_pjr_pullover: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/pjr-pullover-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/pjr-pullover-v1-thumb.png'),
    label: 'Athlete performing pjr pullover',
  },
  accessory_bent_over_dumbbell_reverse_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/bent-over-dumbbell-reverse-flye-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/bent-over-dumbbell-reverse-flye-v1-thumb.png'),
    label: 'Athlete performing bent-over dumbbell reverse fly',
  },
  accessory_chest_supported_dumbbell_reverse_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-reverse-flye-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-reverse-flye-v1-thumb.png'),
    label: 'Athlete performing chest-supported dumbbell reverse fly',
  },
  accessory_incline_bench_rear_delt_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-bench-rear-delt-flye-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/incline-bench-rear-delt-flye-v1-thumb.png'),
    label: 'Athlete performing incline-bench rear-delt fly',
  },
  accessory_rear_delt_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/rear-delt-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/rear-delt-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing rear-delt dumbbell row',
  },
  accessory_wide_elbow_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-elbow-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/wide-elbow-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing wide-elbow dumbbell row',
  },
  accessory_rear_delt_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/rear-delt-barbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/rear-delt-barbell-row-v1-thumb.png'),
    label: 'Athlete performing rear-delt barbell row',
  },
  accessory_one_arm_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/one-arm-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/one-arm-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing one-arm dumbbell row',
  },
  accessory_bent_over_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/bent-over-barbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/bent-over-barbell-row-v1-thumb.png'),
    label: 'Athlete performing bent-over barbell row',
  },
  accessory_chest_supported_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing chest-supported dumbbell row',
  },
  accessory_dumbbell_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-shrug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-shrug-v1-thumb.png'),
    label: 'Athlete performing dumbbell shrug',
  },
  accessory_wide_grip_chest_supported_rear_delt_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-chest-supported-rear-delt-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-chest-supported-rear-delt-row-v1-thumb.png'),
    label: 'Athlete performing wide-grip chest-supported rear-delt row',
  },
  accessory_prone_rear_delt_swing: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/prone-rear-delt-swing-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/prone-rear-delt-swing-v1-thumb.png'),
    label: 'Athlete performing prone rear-delt swing',
  },
  accessory_dumbbell_archer_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-archer-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-archer-row-v1-thumb.png'),
    label: 'Athlete performing dumbbell archer row',
  },
  accessory_meadows_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/meadows-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/meadows-row-v1-thumb.png'),
    label: 'Athlete performing meadows row',
  },
  accessory_dumbbell_pullover: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-pullover-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-pullover-v1-thumb.png'),
    label: 'Athlete performing dumbbell pullover',
  },
  accessory_kroc_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/kroc-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/kroc-row-v1-thumb.png'),
    label: 'Athlete performing kroc row',
  },
  accessory_three_point_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/three-point-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/three-point-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing three-point dumbbell row',
  },
  accessory_lat_biased_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lat-biased-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/lat-biased-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing lat-biased dumbbell row',
  },
  accessory_lat_biased_chest_supported_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lat-biased-chest-supported-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/lat-biased-chest-supported-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing lat-biased chest-supported dumbbell row',
  },
  accessory_pendlay_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/pendlay-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/pendlay-row-v1-thumb.png'),
    label: 'Athlete performing pendlay row',
  },
  accessory_seal_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seal-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/seal-row-v1-thumb.png'),
    label: 'Athlete performing seal row',
  },
  accessory_chest_supported_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-barbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-barbell-row-v1-thumb.png'),
    label: 'Athlete performing chest-supported barbell row',
  },
  accessory_incline_bench_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-bench-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/incline-bench-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing incline-bench dumbbell row',
  },
  accessory_t_bar_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/t-bar-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/t-bar-row-v1-thumb.png'),
    label: 'Athlete performing t-bar row',
  },
  accessory_barbell_pullover: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-pullover-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-pullover-v1-thumb.png'),
    label: 'Athlete performing barbell pullover',
  },
  accessory_landmine_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/landmine-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/landmine-row-v1-thumb.png'),
    label: 'Athlete performing landmine row',
  },
  accessory_one_arm_landmine_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/one-arm-landmine-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/one-arm-landmine-row-v1-thumb.png'),
    label: 'Athlete performing one-arm landmine row',
  },
  accessory_wide_grip_t_bar_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-t-bar-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-t-bar-row-v1-thumb.png'),
    label: 'Athlete performing wide-grip t-bar row',
  },
  accessory_chest_supported_t_bar_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-t-bar-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-t-bar-row-v1-thumb.png'),
    label: 'Athlete performing chest-supported t-bar row',
  },
  accessory_helms_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/helms-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/helms-row-v1-thumb.png'),
    label: 'Athlete performing helms row',
  },
  accessory_batwing_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/batwing-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/batwing-row-v1-thumb.png'),
    label: 'Athlete performing batwing row',
  },
  accessory_gorilla_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/gorilla-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/gorilla-row-v1-thumb.png'),
    label: 'Athlete performing gorilla row',
  },
  accessory_snatch_grip_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-barbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-barbell-row-v1-thumb.png'),
    label: 'Athlete performing snatch-grip barbell row',
  },
  accessory_wide_elbow_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-elbow-barbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/wide-elbow-barbell-row-v1-thumb.png'),
    label: 'Athlete performing wide-elbow barbell row',
  },
  accessory_chest_supported_kelso_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-kelso-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-kelso-row-v1-thumb.png'),
    label: 'Athlete performing chest-supported kelso row',
  },
  accessory_dumbbell_high_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-high-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-high-row-v1-thumb.png'),
    label: 'Athlete performing dumbbell high row',
  },
  accessory_barbell_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-shrug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-shrug-v1-thumb.png'),
    label: 'Athlete performing barbell shrug',
  },
  accessory_trap_bar_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/trap-bar-shrug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/trap-bar-shrug-v1-thumb.png'),
    label: 'Athlete performing trap-bar shrug',
  },
  accessory_behind_the_back_barbell_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/behind-the-back-barbell-shrug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/behind-the-back-barbell-shrug-v1-thumb.png'),
    label: 'Athlete performing behind-the-back barbell shrug',
  },
  accessory_snatch_grip_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-shrug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-shrug-v1-thumb.png'),
    label: 'Athlete performing snatch-grip shrug',
  },
  accessory_overhead_barbell_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/overhead-barbell-shrug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/overhead-barbell-shrug-v1-thumb.png'),
    label: 'Athlete performing overhead barbell shrug',
  },
  accessory_farmer_carry: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/farmer-carry-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/farmer-carry-v1-thumb.png'),
    label: 'Athlete performing farmer carry',
  },
  accessory_chest_supported_kelso_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-kelso-shrug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-kelso-shrug-v1-thumb.png'),
    label: 'Athlete performing chest-supported kelso shrug',
  },
  accessory_kelso_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/kelso-shrug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/kelso-shrug-v1-thumb.png'),
    label: 'Athlete performing kelso shrug',
  },
  accessory_barbell_back_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-back-extension-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-back-extension-v1-thumb.png'),
    label: 'Athlete performing barbell back extension',
  },
  accessory_jefferson_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/jefferson-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/jefferson-curl-v1-thumb.png'),
    label: 'Athlete performing jefferson curl',
  },
  accessory_weighted_sorenson_hold: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/weighted-sorenson-hold-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/weighted-sorenson-hold-v1-thumb.png'),
    label: 'Athlete performing weighted sorenson hold',
  },
  accessory_weighted_crunch: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/weighted-crunch-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/weighted-crunch-v1-thumb.png'),
    label: 'Athlete performing weighted crunch',
  },
  accessory_barbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-curl-v1-thumb.png'),
    label: 'Athlete performing barbell curl',
  },
  accessory_ez_bar_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-curl-v1-thumb.png'),
    label: 'Athlete performing ez-bar curl',
  },
  accessory_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-curl-v1-thumb.png'),
    label: 'Athlete performing dumbbell curl',
  },
  accessory_alternating_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/alternating-dumbbell-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/alternating-dumbbell-curl-v1-thumb.png'),
    label: 'Athlete performing alternating dumbbell curl',
  },
  accessory_seated_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-curl-v1-thumb.png'),
    label: 'Athlete performing seated dumbbell curl',
  },
  accessory_incline_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-curl-v1-thumb.png'),
    label: 'Athlete performing incline dumbbell curl',
  },
  accessory_standing_dumbbell_calf_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-calf-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-calf-raise-v1-thumb.png'),
    label: 'Athlete performing standing dumbbell calf raise',
  },
  accessory_barbell_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-wrist-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-wrist-curl-v1-thumb.png'),
    label: 'Athlete performing barbell wrist curl',
  },
  accessory_dumbbell_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-romanian-deadlift-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-romanian-deadlift-v1-thumb.png'),
    label: 'Athlete performing dumbbell romanian deadlift',
  },
  accessory_bulgarian_split_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/bulgarian-split-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/bulgarian-split-squat-v1-thumb.png'),
    label: 'Athlete performing bulgarian split squat',
  },
  accessory_standing_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-curl-v1-thumb.png'),
    label: 'Athlete performing standing dumbbell curl',
  },
  accessory_spider_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/spider-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/spider-curl-v1-thumb.png'),
    label: 'Athlete performing spider curl',
  },
  accessory_single_arm_preacher_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-preacher-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-preacher-curl-v1-thumb.png'),
    label: 'Athlete performing single-arm preacher curl',
  },
  accessory_dumbbell_preacher_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-preacher-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-preacher-curl-v1-thumb.png'),
    label: 'Athlete performing dumbbell preacher curl',
  },
  accessory_ez_bar_preacher_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-preacher-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-preacher-curl-v1-thumb.png'),
    label: 'Athlete performing ez-bar preacher curl',
  },
  accessory_concentration_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/concentration-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/concentration-curl-v1-thumb.png'),
    label: 'Athlete performing concentration curl',
  },
  accessory_hammer_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/hammer-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/hammer-curl-v1-thumb.png'),
    label: 'Athlete performing hammer curl',
  },
  accessory_cross_body_hammer_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/cross-body-hammer-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/cross-body-hammer-curl-v1-thumb.png'),
    label: 'Athlete performing cross-body hammer curl',
  },
  accessory_zottman_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/zottman-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/zottman-curl-v1-thumb.png'),
    label: 'Athlete performing zottman curl',
  },
  accessory_reverse_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/reverse-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/reverse-curl-v1-thumb.png'),
    label: 'Athlete performing reverse curl',
  },
  accessory_cheat_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/cheat-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/cheat-curl-v1-thumb.png'),
    label: 'Athlete performing cheat curl',
  },
  accessory_dumbbell_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-wrist-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-wrist-curl-v1-thumb.png'),
    label: 'Athlete performing dumbbell wrist curl',
  },
  accessory_behind_the_back_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/behind-the-back-wrist-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/behind-the-back-wrist-curl-v1-thumb.png'),
    label: 'Athlete performing behind-the-back wrist curl',
  },
  accessory_reverse_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/reverse-wrist-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/reverse-wrist-curl-v1-thumb.png'),
    label: 'Athlete performing reverse wrist curl',
  },
  accessory_dumbbell_reverse_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-reverse-wrist-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-reverse-wrist-curl-v1-thumb.png'),
    label: 'Athlete performing dumbbell reverse wrist curl',
  },
  accessory_wrist_roller: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wrist-roller-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/wrist-roller-v1-thumb.png'),
    label: 'Athlete performing wrist roller',
  },
  accessory_plate_pinch: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-pinch-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/plate-pinch-v1-thumb.png'),
    label: 'Athlete performing plate pinch',
  },
  accessory_drag_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/drag-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/drag-curl-v1-thumb.png'),
    label: 'Athlete performing drag curl',
  },
  accessory_fat_grip_hold: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/fat-grip-hold-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/fat-grip-hold-v1-thumb.png'),
    label: 'Athlete performing fat-grip hold',
  },
  accessory_barbell_finger_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-finger-curl-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-finger-curl-v1-thumb.png'),
    label: 'Athlete performing barbell finger curl',
  },
  accessory_lever_bar_pronation: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lever-bar-pronation-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/lever-bar-pronation-v1-thumb.png'),
    label: 'Athlete performing lever bar pronation',
  },
  accessory_radial_deviation: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/radial-deviation-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/radial-deviation-v1-thumb.png'),
    label: 'Athlete performing radial deviation',
  },
  accessory_ulnar_deviation: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ulnar-deviation-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/ulnar-deviation-v1-thumb.png'),
    label: 'Athlete performing ulnar deviation',
  },
  accessory_front_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/front-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/front-squat-v1-thumb.png'),
    label: 'Athlete performing front squat',
  },
  accessory_high_bar_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/high-bar-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/high-bar-squat-v1-thumb.png'),
    label: 'Athlete performing high-bar squat',
  },
  accessory_zercher_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/zercher-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/zercher-squat-v1-thumb.png'),
    label: 'Athlete performing zercher squat',
  },
  accessory_goblet_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/goblet-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/goblet-squat-v1-thumb.png'),
    label: 'Athlete performing goblet squat',
  },
  accessory_cyclist_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/cyclist-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/cyclist-squat-v1-thumb.png'),
    label: 'Athlete performing cyclist squat',
  },
  accessory_heel_elevated_goblet_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/heel-elevated-goblet-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/heel-elevated-goblet-squat-v1-thumb.png'),
    label: 'Athlete performing heel-elevated goblet squat',
  },
  accessory_front_foot_elevated_split_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/front-foot-elevated-split-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/front-foot-elevated-split-squat-v1-thumb.png'),
    label: 'Athlete performing front-foot-elevated split squat',
  },
  accessory_heel_elevated_split_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/heel-elevated-split-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/heel-elevated-split-squat-v1-thumb.png'),
    label: 'Athlete performing heel-elevated split squat',
  },
  accessory_reverse_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/reverse-lunge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/reverse-lunge-v1-thumb.png'),
    label: 'Athlete performing reverse lunge',
  },
  accessory_walking_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/walking-lunge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/walking-lunge-v1-thumb.png'),
    label: 'Athlete performing walking lunge',
  },
  accessory_forward_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/forward-lunge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/forward-lunge-v1-thumb.png'),
    label: 'Athlete performing forward lunge',
  },
  accessory_lateral_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lateral-lunge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/lateral-lunge-v1-thumb.png'),
    label: 'Athlete performing lateral lunge',
  },
  accessory_dumbbell_sit_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-sit-up-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-sit-up-v1-thumb.png'),
    label: 'Athlete performing dumbbell sit-up',
  },
  accessory_plate_sit_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-sit-up-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/plate-sit-up-v1-thumb.png'),
    label: 'Athlete performing plate sit-up',
  },
  accessory_weighted_decline_sit_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/weighted-decline-sit-up-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/weighted-decline-sit-up-v1-thumb.png'),
    label: 'Athlete performing weighted decline sit-up',
  },
  accessory_single_leg_dumbbell_calf_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-dumbbell-calf-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-dumbbell-calf-raise-v1-thumb.png'),
    label: 'Athlete performing single-leg dumbbell calf raise',
  },
  accessory_barbell_calf_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-calf-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-calf-raise-v1-thumb.png'),
    label: 'Athlete performing barbell calf raise',
  },
  accessory_seated_dumbbell_calf_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-calf-raise-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-calf-raise-v1-thumb.png'),
    label: 'Athlete performing seated dumbbell calf raise',
  },
  accessory_lever_bar_supination: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lever-bar-supination-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/lever-bar-supination-v1-thumb.png'),
    label: 'Athlete performing lever bar supination',
  },
  accessory_barbell_hip_thrust: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-hip-thrust-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-hip-thrust-v1-thumb.png'),
    label: 'Athlete performing barbell hip thrust',
  },
  accessory_barbell_glute_bridge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-glute-bridge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-glute-bridge-v1-thumb.png'),
    label: 'Athlete performing barbell glute bridge',
  },
  accessory_dumbbell_glute_bridge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-glute-bridge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-glute-bridge-v1-thumb.png'),
    label: 'Athlete performing dumbbell glute bridge',
  },
  accessory_single_leg_hip_thrust: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-hip-thrust-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-hip-thrust-v1-thumb.png'),
    label: 'Athlete performing single-leg hip thrust',
  },
  accessory_b_stance_hip_thrust: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/b-stance-hip-thrust-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/b-stance-hip-thrust-v1-thumb.png'),
    label: 'Athlete performing b-stance hip thrust',
  },
  accessory_kas_glute_bridge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/kas-glute-bridge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/kas-glute-bridge-v1-thumb.png'),
    label: 'Athlete performing kas glute bridge',
  },
  accessory_long_stride_reverse_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/long-stride-reverse-lunge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/long-stride-reverse-lunge-v1-thumb.png'),
    label: 'Athlete performing long-stride reverse lunge',
  },
  accessory_glute_biased_step_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/glute-biased-step-up-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/glute-biased-step-up-v1-thumb.png'),
    label: 'Athlete performing glute-biased step-up',
  },
  accessory_long_stride_bulgarian_split_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/long-stride-bulgarian-split-squat-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/long-stride-bulgarian-split-squat-v1-thumb.png'),
    label: 'Athlete performing long-stride bulgarian split squat',
  },
  accessory_dumbbell_frog_pump: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-frog-pump-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-frog-pump-v1-thumb.png'),
    label: 'Athlete performing dumbbell frog pump',
  },
  accessory_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/romanian-deadlift-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/romanian-deadlift-v1-thumb.png'),
    label: 'Athlete performing romanian deadlift',
  },
  accessory_single_leg_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-romanian-deadlift-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-romanian-deadlift-v1-thumb.png'),
    label: 'Athlete performing single-leg romanian deadlift',
  },
  accessory_b_stance_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/b-stance-romanian-deadlift-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/b-stance-romanian-deadlift-v1-thumb.png'),
    label: 'Athlete performing b-stance romanian deadlift',
  },
  accessory_stiff_leg_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/stiff-leg-deadlift-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/stiff-leg-deadlift-v1-thumb.png'),
    label: 'Athlete performing stiff-leg deadlift',
  },
  accessory_snatch_grip_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-romanian-deadlift-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-romanian-deadlift-v1-thumb.png'),
    label: 'Athlete performing snatch-grip romanian deadlift',
  },
  accessory_barbell_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-good-morning-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-good-morning-v1-thumb.png'),
    label: 'Athlete performing barbell good morning',
  },
  accessory_seated_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-good-morning-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/seated-good-morning-v1-thumb.png'),
    label: 'Athlete performing seated good morning',
  },
  accessory_dumbbell_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-good-morning-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-good-morning-v1-thumb.png'),
    label: 'Athlete performing dumbbell good morning',
  },
  accessory_glute_ham_raise_with_weight: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/glute-ham-raise-with-weight-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/glute-ham-raise-with-weight-v1-thumb.png'),
    label: 'Athlete performing glute-ham raise with weight',
  },
  accessory_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/good-morning-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/good-morning-v1-thumb.png'),
    label: 'Athlete performing good morning',
  },
  accessory_zercher_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/zercher-good-morning-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/zercher-good-morning-v1-thumb.png'),
    label: 'Athlete performing zercher good morning',
  },
  accessory_dumbbell_side_bend: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-side-bend-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-side-bend-v1-thumb.png'),
    label: 'Athlete performing dumbbell side bend',
  },
  accessory_suitcase_march: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/suitcase-march-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/suitcase-march-v1-thumb.png'),
    label: 'Athlete performing suitcase march',
  },
  accessory_suitcase_carry: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/suitcase-carry-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/suitcase-carry-v1-thumb.png'),
    label: 'Athlete performing suitcase carry',
  },
  accessory_landmine_rotation: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/landmine-rotation-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/landmine-rotation-v1-thumb.png'),
    label: 'Athlete performing landmine rotation',
  },
  accessory_russian_twist_with_weight: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/russian-twist-with-weight-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/russian-twist-with-weight-v1-thumb.png'),
    label: 'Athlete performing russian twist with weight',
  },
  accessory_step_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/step-up-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/step-up-v1-thumb.png'),
    label: 'Athlete performing step-up',
  },
  accessory_peterson_step_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/peterson-step-up-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/peterson-step-up-v1-thumb.png'),
    label: 'Athlete performing peterson step-up',
  },
  accessory_dumbbell_step_down: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-step-down-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-step-down-v1-thumb.png'),
    label: 'Athlete performing dumbbell step-down',
  },
  accessory_spanish_squat_with_weight: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/spanish-squat-with-weight-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/spanish-squat-with-weight-v1-thumb.png'),
    label: 'Athlete performing spanish squat with weight',
  },
  accessory_dumbbell_dead_bug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-dead-bug-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-dead-bug-v1-thumb.png'),
    label: 'Athlete performing dumbbell dead bug',
  },
  accessory_donkey_calf_raise_with_weight: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/donkey-calf-raise-with-weight-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/donkey-calf-raise-with-weight-v1-thumb.png'),
    label: 'Athlete performing donkey calf raise with weight',
  },
  incline_barbell_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-barbell-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/incline-barbell-press-v1-thumb.png'),
    label: 'Athlete performing incline barbell press',
  },
  incline_dumbbell_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-press-v1-thumb.png'),
    label: 'Athlete performing incline dumbbell press',
  },
  accessory_dumbbell_hip_thrust: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-hip-thrust-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-hip-thrust-v1-thumb.png'),
    label: 'Athlete performing dumbbell hip thrust',
  },
  accessory_sumo_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/sumo-romanian-deadlift-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/sumo-romanian-deadlift-v1-thumb.png'),
    label: 'Athlete performing sumo romanian deadlift',
  },
  accessory_deficit_reverse_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/deficit-reverse-lunge-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/deficit-reverse-lunge-v1-thumb.png'),
    label: 'Athlete performing deficit reverse lunge',
  },
  accessory_dumbbell_psoas_march: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-psoas-march-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-psoas-march-v1-thumb.png'),
    label: 'Athlete performing dumbbell psoas march',
  },
  accessory_ankle_weight_hip_flexion: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ankle-weight-hip-flexion-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/ankle-weight-hip-flexion-v1-thumb.png'),
    label: 'Athlete performing ankle-weight hip flexion',
  },
  accessory_plate_neck_flexion: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-neck-flexion-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/plate-neck-flexion-v1-thumb.png'),
    label: 'Athlete performing plate neck flexion',
  },
  accessory_plate_neck_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-neck-extension-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/plate-neck-extension-v1-thumb.png'),
    label: 'Athlete performing plate neck extension',
  },
  accessory_plate_lateral_neck_flexion: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-lateral-neck-flexion-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/plate-lateral-neck-flexion-v1-thumb.png'),
    label: 'Athlete performing plate lateral neck flexion',
  },
  accessory_barbell_windshield_wiper: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-windshield-wiper-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-windshield-wiper-v1-thumb.png'),
    label: 'Athlete performing barbell windshield wiper',
  },
  accessory_dumbbell_serratus_punch: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-serratus-punch-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-serratus-punch-v1-thumb.png'),
    label: 'Athlete performing dumbbell serratus punch',
  },
  accessory_dumbbell_pullover_serratus_reach: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-pullover-serratus-reach-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-pullover-serratus-reach-v1-thumb.png'),
    label: 'Athlete performing dumbbell pullover serratus reach',
  },
  barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/barbell-row-v1-thumb.png'),
    label: 'Athlete performing barbell row',
  },
  single_arm_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-dumbbell-row-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-dumbbell-row-v1-thumb.png'),
    label: 'Athlete performing single-arm dumbbell row',
  },
} : {} as Readonly<Record<CanonicalAccessoryArtworkKey, Readonly<{ source: ImageSourcePropType; thumbnail: ImageSourcePropType; label: string }>>>;

export function canonicalMovementArtworkSource(
  movement?: CanonicalMovementArtworkInput | null,
): ImageSourcePropType | null {
  const resolution = resolveCanonicalMovementArtwork(movement);
  if (resolution.kind === 'accessory') {
    if (__DEV__ && resolution.artworkKey) return CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[resolution.artworkKey].source;
    return accessoryMuscleRegionAsset(resolution.regionKey).source;
  }
  if (resolution.kind === 'core' || resolution.kind === 'core_variant') {
    return CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family];
  }
  return null;
}
