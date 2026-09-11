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

export const CANONICAL_ACCESSORY_MOVEMENT_ARTWORK: Readonly<Record<
  CanonicalAccessoryArtworkKey,
  Readonly<{ source: ImageSourcePropType; thumbnail: ImageSourcePropType; label: string }>
>> = {
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
};

export function canonicalMovementArtworkSource(
  movement?: CanonicalMovementArtworkInput | null,
): ImageSourcePropType | null {
  const resolution = resolveCanonicalMovementArtwork(movement);
  if (resolution.kind === 'accessory') {
    if (resolution.artworkKey) return CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[resolution.artworkKey].source;
    return accessoryMuscleRegionAsset(resolution.regionKey).source;
  }
  if (resolution.kind === 'core' || resolution.kind === 'core_variant') {
    return CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family];
  }
  return null;
}
