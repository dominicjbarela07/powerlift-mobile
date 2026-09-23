import type { ImageSourcePropType } from 'react-native';

import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { resolveApprovedExactMovementArtwork } from '@/lib/movement-artwork-hero';
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

// Keep this build-time condition inline so Metro removes the asset requires
// outside DEV and the explicitly authorized TestFlight export. Human receipts
// and the export hash guard independently restrict which candidates may ship.
// Reuse the approved 512px app image at every size. Separate review thumbnails
// remain audited on disk but must not consume another OTA asset per movement.
export const CANONICAL_ACCESSORY_MOVEMENT_ARTWORK: Readonly<Partial<Record<
  CanonicalAccessoryArtworkKey,
  Readonly<{ source: ImageSourcePropType; label: string }>
>>> = (__DEV__ || process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'testflight') ? {
  incline_barbell_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-barbell-press-v1.png'),
    label: 'Athlete performing incline barbell press',
  },
  accessory_flat_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/flat-dumbbell-bench-press-v1.png'),
    label: 'Athlete performing flat dumbbell bench press',
  },
  accessory_incline_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-incline-bench-press-v1.png'),
    label: 'Athlete performing incline dumbbell bench press',
  },
  accessory_decline_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/decline-dumbbell-bench-press-v1.png'),
    label: 'Athlete performing decline dumbbell bench press',
  },
  accessory_neutral_grip_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/neutral-grip-dumbbell-bench-press-v1.png'),
    label: 'Athlete performing neutral-grip dumbbell bench press',
  },
  accessory_dumbbell_floor_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-floor-press-v1.png'),
    label: 'Athlete performing dumbbell floor press',
  },
  accessory_dumbbell_squeeze_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-squeeze-press-v1.png'),
    label: 'Athlete performing dumbbell squeeze press',
  },
  accessory_dumbbell_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-flye-v1.png'),
    label: 'Athlete performing dumbbell fly',
  },
  accessory_incline_dumbbell_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-flye-v1.png'),
    label: 'Athlete performing incline dumbbell fly',
  },
  accessory_decline_dumbbell_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/decline-dumbbell-flye-v1.png'),
    label: 'Athlete performing decline dumbbell flys',
  },
  accessory_barbell_floor_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-floor-press-v1.png'),
    label: 'Athlete performing barbell floor press',
  },
  accessory_spoto_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/spoto-press-v1.png'),
    label: 'Athlete performing spoto press',
  },
  accessory_larsen_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/larsen-press-v1.png'),
    label: 'Athlete performing larsen press',
  },
  accessory_guillotine_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/guillotine-press-v1.png'),
    label: 'Athlete performing guillotine press',
  },
  accessory_reverse_grip_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/reverse-grip-bench-press-v1.png'),
    label: 'Athlete performing reverse-grip bench press',
  },
  accessory_cambered_bar_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/cambered-bar-bench-press-v1.png'),
    label: 'Athlete performing cambered-bar bench press',
  },
  accessory_seated_dumbbell_shoulder_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-shoulder-press-v1.png'),
    label: 'Athlete performing seated dumbbell shoulder press',
  },
  accessory_standing_dumbbell_shoulder_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-shoulder-press-v1.png'),
    label: 'Athlete performing standing dumbbell shoulder press',
  },
  accessory_arnold_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/arnold-press-v1.png'),
    label: 'Athlete performing arnold press',
  },
  accessory_dumbbell_front_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-front-raise-v1.png'),
    label: 'Athlete performing dumbbell front raise',
  },
  accessory_alternating_dumbbell_front_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/alternating-dumbbell-front-raise-v1.png'),
    label: 'Athlete performing alternating dumbbell front raise',
  },
  accessory_plate_front_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-front-raise-v1.png'),
    label: 'Athlete performing plate front raise',
  },
  accessory_barbell_front_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-front-raise-v1.png'),
    label: 'Athlete performing barbell front raise',
  },
  accessory_landmine_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/landmine-press-v1.png'),
    label: 'Athlete performing landmine press',
  },
  accessory_half_kneeling_landmine_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/half-kneeling-landmine-press-v1.png'),
    label: 'Athlete performing half-kneeling landmine press',
  },
  accessory_single_arm_landmine_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-landmine-press-v1.png'),
    label: 'Athlete performing single-arm landmine press',
  },
  accessory_z_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/z-press-v1.png'),
    label: 'Athlete performing z press',
  },
  accessory_bradford_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/bradford-press-v1.png'),
    label: 'Athlete performing bradford press',
  },
  accessory_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-lateral-raise-v1.png'),
    label: 'Athlete performing dumbbell lateral raise',
  },
  accessory_seated_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-lateral-raise-v1.png'),
    label: 'Athlete performing seated dumbbell lateral raise',
  },
  accessory_incline_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-lateral-raise-v1.png'),
    label: 'Athlete performing incline dumbbell lateral raise',
  },
  accessory_lean_away_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lean-away-dumbbell-lateral-raise-v1.png'),
    label: 'Athlete performing lean-away dumbbell lateral raise',
  },
  accessory_lying_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lying-dumbbell-lateral-raise-v1.png'),
    label: 'Athlete performing lying dumbbell lateral raise',
  },
  accessory_chest_supported_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-lateral-raise-v1.png'),
    label: 'Athlete performing chest-supported dumbbell lateral raise',
  },
  accessory_partial_dumbbell_lateral_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/partial-dumbbell-lateral-raise-v1.png'),
    label: 'Athlete performing partial dumbbell lateral raise',
  },
  accessory_lu_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lu-raise-v1.png'),
    label: 'Athlete performing lu raise',
  },
  accessory_dumbbell_upright_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-upright-row-v1.png'),
    label: 'Athlete performing dumbbell upright row',
  },
  accessory_wide_grip_barbell_upright_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-barbell-upright-row-v1.png'),
    label: 'Athlete performing wide-grip barbell upright row',
  },
  accessory_bent_over_dumbbell_reverse_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/bent-over-dumbbell-reverse-flye-v1.png'),
    label: 'Athlete performing bent-over dumbbell reverse fly',
  },
  accessory_chest_supported_dumbbell_reverse_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-reverse-flye-v1.png'),
    label: 'Athlete performing chest-supported dumbbell reverse fly',
  },
  accessory_rear_delt_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/rear-delt-dumbbell-row-v1.png'),
    label: 'Athlete performing rear-delt dumbbell row',
  },
  accessory_rear_delt_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/rear-delt-barbell-row-v1.png'),
    label: 'Athlete performing rear-delt barbell row',
  },
  accessory_wide_grip_chest_supported_rear_delt_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-chest-supported-rear-delt-row-v1.png'),
    label: 'Athlete performing wide-grip chest-supported rear-delt row',
  },
  accessory_prone_rear_delt_swing: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/prone-rear-delt-swing-v1.png'),
    label: 'Athlete performing prone rear-delt swing',
  },
  accessory_dumbbell_archer_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-archer-row-v1.png'),
    label: 'Athlete performing dumbbell archer row',
  },
  accessory_meadows_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/meadows-row-v1.png'),
    label: 'Athlete performing meadows row',
  },
  accessory_one_arm_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/one-arm-dumbbell-row-v1.png'),
    label: 'Athlete performing one-arm dumbbell row',
  },
  accessory_dumbbell_pullover: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-pullover-v1.png'),
    label: 'Athlete performing dumbbell pullover',
  },
  accessory_barbell_pullover: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-pullover-v1.png'),
    label: 'Athlete performing barbell pullover',
  },
  accessory_kroc_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/kroc-row-v1.png'),
    label: 'Athlete performing kroc row',
  },
  accessory_one_arm_landmine_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/one-arm-landmine-row-v1.png'),
    label: 'Athlete performing one-arm landmine row',
  },
  accessory_lat_biased_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lat-biased-dumbbell-row-v1.png'),
    label: 'Athlete performing lat-biased dumbbell row',
  },
  accessory_lat_biased_chest_supported_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lat-biased-chest-supported-dumbbell-row-v1.png'),
    label: 'Athlete performing lat-biased chest-supported dumbbell row',
  },
  accessory_bent_over_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/bent-over-barbell-row-v1.png'),
    label: 'Athlete performing bent-over barbell row',
  },
  accessory_pendlay_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/pendlay-row-v1.png'),
    label: 'Athlete performing pendlay row',
  },
  accessory_seal_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seal-row-v1.png'),
    label: 'Athlete performing seal row',
  },
  accessory_chest_supported_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-dumbbell-row-v1.png'),
    label: 'Athlete performing chest-supported dumbbell row',
  },
  accessory_chest_supported_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-barbell-row-v1.png'),
    label: 'Athlete performing chest-supported barbell row',
  },
  accessory_t_bar_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/t-bar-row-v1.png'),
    label: 'Athlete performing t-bar row',
  },
  accessory_wide_grip_t_bar_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-grip-t-bar-row-v1.png'),
    label: 'Athlete performing wide-grip t-bar row',
  },
  accessory_chest_supported_t_bar_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-t-bar-row-v1.png'),
    label: 'Athlete performing chest-supported t-bar row',
  },
  accessory_helms_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/helms-row-v1.png'),
    label: 'Athlete performing helms row',
  },
  accessory_batwing_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/batwing-row-v1.png'),
    label: 'Athlete performing batwing row',
  },
  accessory_gorilla_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/gorilla-row-v1.png'),
    label: 'Athlete performing gorilla row',
  },
  accessory_snatch_grip_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-barbell-row-v1.png'),
    label: 'Athlete performing snatch-grip barbell row',
  },
  accessory_dumbbell_high_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-high-row-v1.png'),
    label: 'Athlete performing dumbbell high row',
  },
  accessory_barbell_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-shrug-v1.png'),
    label: 'Athlete performing barbell shrug',
  },
  accessory_dumbbell_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-shrug-v1.png'),
    label: 'Athlete performing dumbbell shrug',
  },
  accessory_trap_bar_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/trap-bar-shrug-v1.png'),
    label: 'Athlete performing trap-bar shrug',
  },
  accessory_behind_the_back_barbell_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/behind-the-back-barbell-shrug-v1.png'),
    label: 'Athlete performing behind-the-back barbell shrug',
  },
  accessory_snatch_grip_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-shrug-v1.png'),
    label: 'Athlete performing snatch-grip shrug',
  },
  accessory_overhead_barbell_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/overhead-barbell-shrug-v1.png'),
    label: 'Athlete performing overhead barbell shrug',
  },
  accessory_farmer_carry: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/farmer-carry-v1.png'),
    label: 'Athlete performing farmer carry',
  },
  accessory_chest_supported_kelso_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-kelso-shrug-v1.png'),
    label: 'Athlete performing chest-supported kelso shrug',
  },
  accessory_barbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-curl-v1.png'),
    label: 'Athlete performing barbell curl',
  },
  accessory_ez_bar_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-curl-v1.png'),
    label: 'Athlete performing ez-bar curl',
  },
  accessory_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-curl-v1.png'),
    label: 'Athlete performing dumbbell curl',
  },
  accessory_alternating_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/alternating-dumbbell-curl-v1.png'),
    label: 'Athlete performing alternating dumbbell curl',
  },
  accessory_seated_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-curl-v1.png'),
    label: 'Athlete performing seated dumbbell curl',
  },
  accessory_incline_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-curl-v1.png'),
    label: 'Athlete performing incline dumbbell curl',
  },
  accessory_spider_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/spider-curl-v1.png'),
    label: 'Athlete performing spider curl',
  },
  accessory_single_arm_preacher_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-preacher-curl-v1.png'),
    label: 'Athlete performing single-arm preacher curl',
  },
  accessory_dumbbell_preacher_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-preacher-curl-v1.png'),
    label: 'Athlete performing dumbbell preacher curl',
  },
  accessory_ez_bar_preacher_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-preacher-curl-v1.png'),
    label: 'Athlete performing ez-bar preacher curl',
  },
  accessory_concentration_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/concentration-curl-v1.png'),
    label: 'Athlete performing concentration curl',
  },
  accessory_hammer_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/hammer-curl-v1.png'),
    label: 'Athlete performing hammer curl',
  },
  accessory_cross_body_hammer_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/cross-body-hammer-curl-v1.png'),
    label: 'Athlete performing cross-body hammer curl',
  },
  accessory_zottman_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/zottman-curl-v1.png'),
    label: 'Athlete performing zottman curl',
  },
  accessory_drag_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/drag-curl-v1.png'),
    label: 'Athlete performing drag curl',
  },
  accessory_reverse_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/reverse-curl-v1.png'),
    label: 'Athlete performing reverse curl',
  },
  accessory_cheat_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/cheat-curl-v1.png'),
    label: 'Athlete performing cheat curl',
  },
  accessory_close_grip_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/close-grip-bench-press-v1.png'),
    label: 'Athlete performing close-grip bench press',
  },
  accessory_jm_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/jm-press-v1.png'),
    label: 'Athlete performing jm press',
  },
  accessory_barbell_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-skull-crusher-v1.png'),
    label: 'Athlete performing barbell skull crusher',
  },
  accessory_ez_bar_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ez-bar-skull-crusher-v1.png'),
    label: 'Athlete performing ez-bar skull crusher',
  },
  accessory_dumbbell_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-skull-crusher-v1.png'),
    label: 'Athlete performing dumbbell skull crusher',
  },
  accessory_incline_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-skull-crusher-v1.png'),
    label: 'Athlete performing incline skull crusher',
  },
  accessory_decline_skull_crusher: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/decline-skull-crusher-v1.png'),
    label: 'Athlete performing decline skull crusher',
  },
  accessory_dumbbell_overhead_triceps_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-overhead-triceps-extension-v1.png'),
    label: 'Athlete performing dumbbell overhead triceps extension',
  },
  accessory_single_arm_dumbbell_overhead_triceps_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-dumbbell-overhead-triceps-extension-v1.png'),
    label: 'Athlete performing single-arm dumbbell overhead triceps extension',
  },
  accessory_tate_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/tate-press-v1.png'),
    label: 'Athlete performing tate press',
  },
  accessory_rolling_dumbbell_triceps_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/rolling-dumbbell-triceps-extension-v1.png'),
    label: 'Athlete performing rolling dumbbell triceps extension',
  },
  accessory_pjr_pullover: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/pjr-pullover-v1.png'),
    label: 'Athlete performing pjr pullover',
  },
  accessory_barbell_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-wrist-curl-v1.png'),
    label: 'Athlete performing barbell wrist curl',
  },
  accessory_dumbbell_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-wrist-curl-v1.png'),
    label: 'Athlete performing dumbbell wrist curl',
  },
  accessory_behind_the_back_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/behind-the-back-wrist-curl-v1.png'),
    label: 'Athlete performing behind-the-back wrist curl',
  },
  accessory_reverse_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/reverse-wrist-curl-v1.png'),
    label: 'Athlete performing reverse wrist curl',
  },
  accessory_dumbbell_reverse_wrist_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-reverse-wrist-curl-v1.png'),
    label: 'Athlete performing dumbbell reverse wrist curl',
  },
  accessory_wrist_roller: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wrist-roller-v1.png'),
    label: 'Athlete performing wrist roller',
  },
  accessory_plate_pinch: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-pinch-v1.png'),
    label: 'Athlete performing plate pinch',
  },
  accessory_fat_grip_hold: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/fat-grip-hold-v1.png'),
    label: 'Athlete performing fat-grip hold',
  },
  accessory_barbell_finger_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-finger-curl-v1.png'),
    label: 'Athlete performing barbell finger curl',
  },
  accessory_lever_bar_pronation: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lever-bar-pronation-v1.png'),
    label: 'Athlete performing lever bar pronation',
  },
  accessory_lever_bar_supination: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lever-bar-supination-v1.png'),
    label: 'Athlete performing lever bar supination',
  },
  accessory_radial_deviation: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/radial-deviation-v1.png'),
    label: 'Athlete performing radial deviation',
  },
  accessory_ulnar_deviation: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ulnar-deviation-v1.png'),
    label: 'Athlete performing ulnar deviation',
  },
  accessory_front_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/front-squat-v1.png'),
    label: 'Athlete performing front squat',
  },
  accessory_high_bar_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/high-bar-squat-v1.png'),
    label: 'Athlete performing high-bar squat',
  },
  accessory_zercher_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/zercher-squat-v1.png'),
    label: 'Athlete performing zercher squat',
  },
  accessory_goblet_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/goblet-squat-v1.png'),
    label: 'Athlete performing goblet squat',
  },
  accessory_cyclist_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/cyclist-squat-v1.png'),
    label: 'Athlete performing cyclist squat',
  },
  accessory_heel_elevated_goblet_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/heel-elevated-goblet-squat-v1.png'),
    label: 'Athlete performing heel-elevated goblet squat',
  },
  accessory_bulgarian_split_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/bulgarian-split-squat-v1.png'),
    label: 'Athlete performing bulgarian split squat',
  },
  accessory_front_foot_elevated_split_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/front-foot-elevated-split-squat-v1.png'),
    label: 'Athlete performing front-foot-elevated split squat',
  },
  accessory_heel_elevated_split_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/heel-elevated-split-squat-v1.png'),
    label: 'Athlete performing heel-elevated split squat',
  },
  accessory_reverse_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/reverse-lunge-v1.png'),
    label: 'Athlete performing reverse lunge',
  },
  accessory_walking_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/walking-lunge-v1.png'),
    label: 'Athlete performing walking lunge',
  },
  accessory_forward_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/forward-lunge-v1.png'),
    label: 'Athlete performing forward lunge',
  },
  accessory_lateral_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/lateral-lunge-v1.png'),
    label: 'Athlete performing lateral lunge',
  },
  accessory_step_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/step-up-v1.png'),
    label: 'Athlete performing step-up',
  },
  accessory_peterson_step_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/peterson-step-up-v1.png'),
    label: 'Athlete performing peterson step-up',
  },
  accessory_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/romanian-deadlift-v1.png'),
    label: 'Athlete performing romanian deadlift',
  },
  accessory_dumbbell_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-romanian-deadlift-v1.png'),
    label: 'Athlete performing dumbbell romanian deadlift',
  },
  accessory_single_leg_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-romanian-deadlift-v1.png'),
    label: 'Athlete performing single-leg romanian deadlift',
  },
  accessory_b_stance_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/b-stance-romanian-deadlift-v1.png'),
    label: 'Athlete performing b-stance romanian deadlift',
  },
  accessory_stiff_leg_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/stiff-leg-deadlift-v1.png'),
    label: 'Athlete performing stiff-leg deadlift',
  },
  accessory_snatch_grip_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/snatch-grip-romanian-deadlift-v1.png'),
    label: 'Athlete performing snatch-grip romanian deadlift',
  },
  accessory_barbell_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-good-morning-v1.png'),
    label: 'Athlete performing barbell good morning',
  },
  accessory_seated_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-good-morning-v1.png'),
    label: 'Athlete performing seated good morning',
  },
  accessory_barbell_hip_thrust: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-hip-thrust-v1.png'),
    label: 'Athlete performing barbell hip thrust',
  },
  accessory_single_leg_hip_thrust: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-hip-thrust-v1.png'),
    label: 'Athlete performing single-leg hip thrust',
  },
  accessory_b_stance_hip_thrust: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/b-stance-hip-thrust-v1.png'),
    label: 'Athlete performing b-stance hip thrust',
  },
  accessory_kas_glute_bridge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/kas-glute-bridge-v1.png'),
    label: 'Athlete performing kas glute bridge',
  },
  accessory_sumo_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/sumo-romanian-deadlift-v1.png'),
    label: 'Athlete performing sumo romanian deadlift',
  },
  accessory_deficit_reverse_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/deficit-reverse-lunge-v1.png'),
    label: 'Athlete performing deficit reverse lunge',
  },
  accessory_long_stride_reverse_lunge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/long-stride-reverse-lunge-v1.png'),
    label: 'Athlete performing long-stride reverse lunge',
  },
  accessory_glute_biased_step_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/glute-biased-step-up-v1.png'),
    label: 'Athlete performing glute-biased step-up',
  },
  accessory_long_stride_bulgarian_split_squat: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/long-stride-bulgarian-split-squat-v1.png'),
    label: 'Athlete performing long-stride bulgarian split squat',
  },
  accessory_seated_dumbbell_calf_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/seated-dumbbell-calf-raise-v1.png'),
    label: 'Athlete performing seated dumbbell calf raise',
  },
  accessory_dumbbell_sit_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-sit-up-v1.png'),
    label: 'Athlete performing dumbbell sit-up',
  },
  accessory_dumbbell_side_bend: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-side-bend-v1.png'),
    label: 'Athlete performing dumbbell side bend',
  },
  accessory_suitcase_march: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/suitcase-march-v1.png'),
    label: 'Athlete performing suitcase march',
  },
  accessory_suitcase_carry: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/suitcase-carry-v1.png'),
    label: 'Athlete performing suitcase carry',
  },
  accessory_landmine_rotation: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/landmine-rotation-v1.png'),
    label: 'Athlete performing landmine rotation',
  },
  accessory_russian_twist_with_weight: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/russian-twist-with-weight-v1.png'),
    label: 'Athlete performing russian twist with weight',
  },
  accessory_barbell_windshield_wiper: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-windshield-wiper-v1.png'),
    label: 'Athlete performing barbell windshield wiper',
  },
  accessory_jefferson_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/jefferson-curl-v1.png'),
    label: 'Athlete performing jefferson curl',
  },
  accessory_zercher_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/zercher-good-morning-v1.png'),
    label: 'Athlete performing zercher good morning',
  },
  accessory_weighted_sorenson_hold: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/weighted-sorenson-hold-v1.png'),
    label: 'Athlete performing weighted sorenson hold',
  },
  accessory_dumbbell_serratus_punch: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-serratus-punch-v1.png'),
    label: 'Athlete performing dumbbell serratus punch',
  },
  accessory_plate_neck_flexion: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-neck-flexion-v1.png'),
    label: 'Athlete performing plate neck flexion',
  },
  accessory_plate_neck_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-neck-extension-v1.png'),
    label: 'Athlete performing plate neck extension',
  },
  accessory_plate_lateral_neck_flexion: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-lateral-neck-flexion-v1.png'),
    label: 'Athlete performing plate lateral neck flexion',
  },
  accessory_ankle_weight_psoas_march: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ankle-weight-psoas-march-v1.png'),
    label: 'Athlete performing ankle-weight psoas march',
  },
  pull_up_bodyweight: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/pull_up_bodyweight-v2.png'),
    label: "Athlete performing Pull-Up",
  },
  machine_lat_pulldown_broad: {
    source: require('@/assets/images/movement-artwork/machine-v1/machine_lat_pulldown_broad-v3.png'),
    label: "Athlete performing Machine Lat Pulldown",
  },
  accessory_machine_chest_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_chest_press-v1.png'),
    label: "Athlete performing Machine Chest Press",
  },
  accessory_incline_machine_chest_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_incline_machine_chest_press-v2.png'),
    label: "Athlete performing Incline Machine Chest Press",
  },
  accessory_decline_machine_chest_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_decline_machine_chest_press-v2.png'),
    label: "Athlete performing Decline Machine Chest Press",
  },
  accessory_machine_chest_flye: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_chest_flye-v2.png'),
    label: "Athlete performing Machine Chest Fly",
  },
  accessory_converging_chest_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_converging_chest_press-v5.png'),
    label: "Athlete performing Converging Chest Press",
  },
  accessory_iso_lateral_chest_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_iso_lateral_chest_press-v1.png'),
    label: "Athlete performing Iso-Lateral Chest Press",
  },
  accessory_single_arm_machine_chest_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_arm_machine_chest_press-v2.png'),
    label: "Athlete performing Single-Arm Machine Chest Press",
  },
  accessory_smith_machine_bench_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_smith_machine_bench_press-v5.png'),
    label: "Athlete performing Smith-Machine Bench Press",
  },
  accessory_incline_smith_machine_bench_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_incline_smith_machine_bench_press-v1.png'),
    label: "Athlete performing Incline Smith-Machine Bench Press",
  },
  accessory_decline_smith_machine_bench_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_decline_smith_machine_bench_press-v6.png'),
    label: "Athlete performing Decline Smith-Machine Bench Press",
  },
  accessory_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_push_up-v1.png'),
    label: "Athlete performing Push-Up",
  },
  accessory_deficit_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_deficit_push_up-v1.png'),
    label: "Athlete performing Deficit Push-Up",
  },
  accessory_ring_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_ring_push_up-v2.png'),
    label: "Athlete performing Ring Push-Up",
  },
  accessory_wide_grip_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_wide_grip_push_up-v1.png'),
    label: "Athlete performing Wide-Grip Push-Up",
  },
  accessory_decline_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_decline_push_up-v1.png'),
    label: "Athlete performing Decline Push-Up",
  },
  accessory_incline_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_incline_push_up-v1.png'),
    label: "Athlete performing Incline Push-Up",
  },
  accessory_chest_dip: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_chest_dip-v2.png'),
    label: "Athlete performing Chest Dip",
  },
  accessory_ring_dip: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_ring_dip-v1.png'),
    label: "Athlete performing Ring Dip",
  },
  accessory_machine_shoulder_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_shoulder_press-v2.png'),
    label: "Athlete performing Machine Shoulder Press",
  },
  accessory_iso_lateral_shoulder_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_iso_lateral_shoulder_press-v2.png'),
    label: "Athlete performing Iso-Lateral Shoulder Press",
  },
  accessory_smith_machine_shoulder_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_smith_machine_shoulder_press-v2.png'),
    label: "Athlete performing Smith-Machine Shoulder Press",
  },
  accessory_machine_front_raise: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_front_raise-v5.png'),
    label: "Athlete performing Machine Front Raise",
  },
  accessory_pike_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_pike_push_up-v1.png'),
    label: "Athlete performing Pike Push-Up",
  },
  accessory_handstand_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_handstand_push_up-v5.png'),
    label: "Athlete performing Handstand Push-Up",
  },
  accessory_machine_lateral_raise: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_lateral_raise-v5.png'),
    label: "Athlete performing Machine Lateral Raise",
  },
  accessory_machine_y_raise: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_y_raise-v5.png'),
    label: "Athlete performing Machine Y-Raise",
  },
  accessory_machine_reverse_flye: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_reverse_flye-v1.png'),
    label: "Athlete performing Machine Reverse Fly",
  },
  accessory_rear_delt_row_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_rear_delt_row_machine-v6.png'),
    label: "Athlete performing Rear-Delt Row Machine",
  },
  accessory_machine_pullover: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_pullover-v5.png'),
    label: "Athlete performing Machine Pullover",
  },
  accessory_iso_lateral_lat_pulldown: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_iso_lateral_lat_pulldown-v3.png'),
    label: "Athlete performing Iso-Lateral Lat Pulldown",
  },
  accessory_iso_lateral_low_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_iso_lateral_low_row-v3.png'),
    label: "Athlete performing Iso-Lateral Low Row",
  },
  accessory_machine_low_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_low_row-v2.png'),
    label: "Athlete performing Machine Low Row",
  },
  accessory_single_arm_machine_low_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_arm_machine_low_row-v3.png'),
    label: "Athlete performing Single-Arm Machine Low Row",
  },
  accessory_neutral_grip_pull_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_neutral_grip_pull_up-v3.png'),
    label: "Athlete performing Neutral-Grip Pull-Up",
  },
  accessory_wide_grip_pull_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_wide_grip_pull_up-v2.png'),
    label: "Athlete performing Wide-Grip Pull-Up",
  },
  accessory_chin_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_chin_up-v2.png'),
    label: "Athlete performing Chin-Up",
  },
  accessory_sternum_chin_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_sternum_chin_up-v3.png'),
    label: "Athlete performing Sternum Chin-Up",
  },
  accessory_scapular_pull_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_scapular_pull_up-v1.png'),
    label: "Athlete performing Scapular Pull-Up",
  },
  accessory_chest_supported_machine_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_chest_supported_machine_row-v4.png'),
    label: "Athlete performing Chest-Supported Machine Row",
  },
  accessory_plate_loaded_high_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_plate_loaded_high_row-v3.png'),
    label: "Athlete performing Machine High Row",
  },
  accessory_iso_lateral_high_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_iso_lateral_high_row-v3.png'),
    label: "Athlete performing Iso-Lateral High Row",
  },
  accessory_single_arm_machine_high_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_arm_machine_high_row-v5.png'),
    label: "Athlete performing Single-Arm Machine High Row",
  },
  accessory_machine_t_bar_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_t_bar_row-v4.png'),
    label: "Athlete performing Machine T-Bar Row",
  },
  accessory_inverted_row: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_inverted_row-v1.png'),
    label: "Athlete performing Inverted Row",
  },
  accessory_feet_elevated_inverted_row: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_feet_elevated_inverted_row-v4.png'),
    label: "Athlete performing Feet-Elevated Inverted Row",
  },
  accessory_ring_row: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_ring_row-v3.png'),
    label: "Athlete performing Ring Row",
  },
  accessory_suspension_trainer_row: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_suspension_trainer_row-v3.png'),
    label: "Athlete performing Suspension-Trainer Row",
  },
  accessory_scapular_inverted_row: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_scapular_inverted_row-v3.png'),
    label: "Athlete performing Scapular Inverted Row",
  },
  accessory_machine_shrug: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_shrug-v3.png'),
    label: "Athlete performing Machine Shrug",
  },
  accessory_smith_machine_shrug: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_smith_machine_shrug-v1.png'),
    label: "Athlete performing Smith-Machine Shrug",
  },
  accessory_machine_kelso_shrug: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_kelso_shrug-v3.png'),
    label: "Athlete performing Machine Kelso Shrug",
  },
  accessory_machine_preacher_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_preacher_curl-v4.png'),
    label: "Athlete performing Machine Preacher Curl",
  },
  accessory_single_arm_machine_preacher_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_arm_machine_preacher_curl-v4.png'),
    label: "Athlete performing Single-Arm Machine Preacher Curl",
  },
  accessory_plate_loaded_biceps_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_plate_loaded_biceps_curl-v3.png'),
    label: "Athlete performing Machine Biceps Curl",
  },
  accessory_bodyweight_curl: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bodyweight_curl-v4.png'),
    label: "Athlete performing Bodyweight Curl",
  },
  accessory_ring_curl: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_ring_curl-v3.png'),
    label: "Athlete performing Ring Curl",
  },
  accessory_machine_triceps_extension: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_triceps_extension-v2.png'),
    label: "Athlete performing Machine Triceps Extension",
  },
  accessory_machine_dip: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_dip-v2.png'),
    label: "Athlete performing Machine Dip",
  },
  accessory_bench_dip: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bench_dip-v1.png'),
    label: "Athlete performing Bench Dip",
  },
  accessory_triceps_dip: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_triceps_dip-v1.png'),
    label: "Athlete performing Triceps Dip",
  },
  accessory_diamond_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_diamond_push_up-v1.png'),
    label: "Athlete performing Diamond Push-Up",
  },
  accessory_bodyweight_skull_crusher: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bodyweight_skull_crusher-v1.png'),
    label: "Athlete performing Bodyweight Skull Crusher",
  },
  accessory_ring_triceps_extension: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_ring_triceps_extension-v4.png'),
    label: "Athlete performing Ring Triceps Extension",
  },
  accessory_dead_hang: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_dead_hang-v1.png'),
    label: "Athlete performing Dead Hang",
  },
  accessory_towel_dead_hang: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_towel_dead_hang-v1.png'),
    label: "Athlete performing Towel Dead Hang",
  },
  accessory_false_grip_hang: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_false_grip_hang-v2.png'),
    label: "Athlete performing False-Grip Hang",
  },
  accessory_leg_extension: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_leg_extension-v3.png'),
    label: "Athlete performing Leg Extension",
  },
  accessory_single_leg_leg_extension: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_leg_leg_extension-v3.png'),
    label: "Athlete performing Single-Leg Leg Extension",
  },
  accessory_leg_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_leg_press-v1.png'),
    label: "Athlete performing Leg Press",
  },
  accessory_single_leg_leg_press: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_leg_leg_press-v3.png'),
    label: "Athlete performing Single-Leg Leg Press",
  },
  accessory_hack_squat: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_hack_squat-v3.png'),
    label: "Athlete performing Hack Squat",
  },
  accessory_pendulum_squat: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_pendulum_squat-v3.png'),
    label: "Athlete performing Pendulum Squat",
  },
  accessory_belt_squat: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_belt_squat-v3.png'),
    label: "Athlete performing Belt Squat",
  },
  accessory_v_squat: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_v_squat-v3.png'),
    label: "Athlete performing V-Squat",
  },
  accessory_machine_split_squat: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_split_squat-v5.png'),
    label: "Athlete performing Machine Split Squat",
  },
  accessory_machine_sissy_squat: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_sissy_squat-v2.png'),
    label: "Athlete performing Machine Sissy Squat",
  },
  accessory_smith_machine_squat: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_smith_machine_squat-v1.png'),
    label: "Athlete performing Smith-Machine Squat",
  },
  accessory_smith_machine_split_squat: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_smith_machine_split_squat-v1.png'),
    label: "Athlete performing Smith-Machine Split Squat",
  },
  accessory_sissy_squat: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_sissy_squat-v1.png'),
    label: "Athlete performing Sissy Squat",
  },
  accessory_reverse_nordic: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_reverse_nordic-v2.png'),
    label: "Athlete performing Reverse Nordic",
  },
  accessory_bodyweight_split_squat: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bodyweight_split_squat-v1.png'),
    label: "Athlete performing Bodyweight Split Squat",
  },
  accessory_wall_sit: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_wall_sit-v1.png'),
    label: "Athlete performing Wall Sit",
  },
  accessory_spanish_squat: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_spanish_squat-v2.png'),
    label: "Athlete performing Spanish Squat",
  },
  accessory_step_down: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_step_down-v1.png'),
    label: "Athlete performing Step-Down",
  },
  accessory_seated_leg_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_seated_leg_curl-v2.png'),
    label: "Athlete performing Seated Leg Curl",
  },
  accessory_lying_leg_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_lying_leg_curl-v2.png'),
    label: "Athlete performing Lying Leg Curl",
  },
  accessory_standing_single_leg_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_standing_single_leg_curl-v3.png'),
    label: "Athlete performing Standing Single-Leg Curl",
  },
  accessory_kneeling_leg_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_kneeling_leg_curl-v3.png'),
    label: "Athlete performing Kneeling Leg Curl",
  },
  accessory_single_leg_seated_leg_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_leg_seated_leg_curl-v2.png'),
    label: "Athlete performing Single-Leg Seated Leg Curl",
  },
  accessory_single_leg_lying_leg_curl: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_leg_lying_leg_curl-v2.png'),
    label: "Athlete performing Single-Leg Lying Leg Curl",
  },
  accessory_nordic_hamstring_curl: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_nordic_hamstring_curl-v1.png'),
    label: "Athlete performing Nordic Hamstring Curl",
  },
  accessory_assisted_nordic_hamstring_curl: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_assisted_nordic_hamstring_curl-v2.png'),
    label: "Athlete performing Assisted Nordic Hamstring Curl",
  },
  accessory_sliding_leg_curl: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_sliding_leg_curl-v1.png'),
    label: "Athlete performing Sliding Leg Curl",
  },
  accessory_stability_ball_leg_curl: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_stability_ball_leg_curl-v1.png'),
    label: "Athlete performing Stability-Ball Leg Curl",
  },
  accessory_bodyweight_glute_ham_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bodyweight_glute_ham_raise-v1.png'),
    label: "Athlete performing Bodyweight Glute-Ham Raise",
  },
  accessory_razor_curl: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_razor_curl-v1.png'),
    label: "Athlete performing Razor Curl",
  },
  accessory_45_degree_back_extension_hamstring_bias: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_45_degree_back_extension_hamstring_bias-v2.png'),
    label: "Athlete performing 45-Degree Back Extension (Hamstring Bias)",
  },
  accessory_machine_hip_thrust: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_hip_thrust-v3.png'),
    label: "Athlete performing Machine Hip Thrust",
  },
  accessory_machine_glute_bridge: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_glute_bridge-v3.png'),
    label: "Athlete performing Machine Glute Bridge",
  },
  accessory_machine_glute_kickback: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_glute_kickback-v3.png'),
    label: "Athlete performing Machine Glute Kickback",
  },
  accessory_reverse_hyperextension: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_reverse_hyperextension-v3.png'),
    label: "Athlete performing Reverse Hyperextension",
  },
  accessory_smith_machine_hip_thrust: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_smith_machine_hip_thrust-v3.png'),
    label: "Athlete performing Smith-Machine Hip Thrust",
  },
  accessory_bodyweight_glute_bridge: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bodyweight_glute_bridge-v1.png'),
    label: "Athlete performing Bodyweight Glute Bridge",
  },
  accessory_single_leg_glute_bridge: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_single_leg_glute_bridge-v1.png'),
    label: "Athlete performing Single-Leg Glute Bridge",
  },
  accessory_frog_pump: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_frog_pump-v1.png'),
    label: "Athlete performing Frog Pump",
  },
  accessory_quadruped_hip_extension: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_quadruped_hip_extension-v1.png'),
    label: "Athlete performing Quadruped Hip Extension",
  },
  accessory_45_degree_back_extension_glute_bias: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_45_degree_back_extension_glute_bias-v2.png'),
    label: "Athlete performing 45-Degree Back Extension (Glute Bias)",
  },
  accessory_adductor_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_adductor_machine-v2.png'),
    label: "Athlete performing Adductor Machine",
  },
  accessory_short_lever_copenhagen_adduction: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_short_lever_copenhagen_adduction-v1.png'),
    label: "Athlete performing Short-Lever Copenhagen Adduction",
  },
  accessory_long_lever_copenhagen_adduction: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_long_lever_copenhagen_adduction-v1.png'),
    label: "Athlete performing Long-Lever Copenhagen Adduction",
  },
  accessory_side_lying_hip_adduction: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_side_lying_hip_adduction-v1.png'),
    label: "Athlete performing Side-Lying Hip Adduction",
  },
  accessory_adductor_slide: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_adductor_slide-v1.png'),
    label: "Athlete performing Adductor Slide",
  },
  accessory_sumo_squat_hold: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_sumo_squat_hold-v1.png'),
    label: "Athlete performing Sumo Squat Hold",
  },
  accessory_hip_abductor_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_hip_abductor_machine-v3.png'),
    label: "Athlete performing Hip Abductor Machine",
  },
  accessory_standing_hip_abductor_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_standing_hip_abductor_machine-v2.png'),
    label: "Athlete performing Standing Hip Abductor Machine",
  },
  accessory_side_lying_hip_abduction: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_side_lying_hip_abduction-v1.png'),
    label: "Athlete performing Side-Lying Hip Abduction",
  },
  accessory_fire_hydrant: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_fire_hydrant-v1.png'),
    label: "Athlete performing Fire Hydrant",
  },
  accessory_lateral_step_down: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_lateral_step_down-v1.png'),
    label: "Athlete performing Lateral Step-Down",
  },
  accessory_side_plank_hip_abduction: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_side_plank_hip_abduction-v2.png'),
    label: "Athlete performing Side Plank Hip Abduction",
  },
  accessory_standing_calf_raise_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_standing_calf_raise_machine-v2.png'),
    label: "Athlete performing Standing Calf Raise Machine",
  },
  accessory_seated_calf_raise_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_seated_calf_raise_machine-v3.png'),
    label: "Athlete performing Seated Calf Raise Machine",
  },
  accessory_leg_press_calf_raise: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_leg_press_calf_raise-v3.png'),
    label: "Athlete performing Leg-Press Calf Raise",
  },
  accessory_hack_squat_calf_raise: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_hack_squat_calf_raise-v2.png'),
    label: "Athlete performing Hack-Squat Calf Raise",
  },
  accessory_smith_machine_calf_raise: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_smith_machine_calf_raise-v2.png'),
    label: "Athlete performing Smith-Machine Calf Raise",
  },
  accessory_tibialis_raise_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_tibialis_raise_machine-v2.png'),
    label: "Athlete performing Tibialis Raise Machine",
  },
  accessory_standing_calf_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_standing_calf_raise-v1.png'),
    label: "Athlete performing Standing Calf Raise",
  },
  accessory_single_leg_calf_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_single_leg_calf_raise-v2.png'),
    label: "Athlete performing Single-Leg Calf Raise",
  },
  accessory_bent_knee_calf_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bent_knee_calf_raise-v3.png'),
    label: "Athlete performing Bent-Knee Calf Raise",
  },
  accessory_donkey_calf_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_donkey_calf_raise-v2.png'),
    label: "Athlete performing Donkey Calf Raise",
  },
  accessory_tibialis_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_tibialis_raise-v1.png'),
    label: "Athlete performing Tibialis Raise",
  },
  accessory_barbell_rollout: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_barbell_rollout-v1.png'),
    label: "Athlete performing Barbell Rollout",
  },
  accessory_abdominal_crunch_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_abdominal_crunch_machine-v3.png'),
    label: "Athlete performing Abdominal Crunch Machine",
  },
  accessory_rotary_ab_crunch_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_rotary_ab_crunch_machine-v5.png'),
    label: "Athlete performing Rotary Ab Crunch Machine",
  },
  accessory_crunch: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_crunch-v1.png'),
    label: "Athlete performing Crunch",
  },
  accessory_reverse_crunch: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_reverse_crunch-v1.png'),
    label: "Athlete performing Reverse Crunch",
  },
  accessory_decline_sit_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_decline_sit_up-v1.png'),
    label: "Athlete performing Decline Sit-Up",
  },
  accessory_hanging_knee_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_hanging_knee_raise-v2.png'),
    label: "Athlete performing Hanging Knee Raise",
  },
  accessory_hanging_leg_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_hanging_leg_raise-v1.png'),
    label: "Athlete performing Hanging Leg Raise",
  },
  accessory_captain_s_chair_knee_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_captain_s_chair_knee_raise-v1.png'),
    label: "Athlete performing Captain's-Chair Knee Raise",
  },
  accessory_lying_leg_raise: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_lying_leg_raise-v1.png'),
    label: "Athlete performing Lying Leg Raise",
  },
  accessory_ab_wheel_rollout: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_ab_wheel_rollout-v1.png'),
    label: "Athlete performing Ab Wheel Rollout",
  },
  accessory_body_saw: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_body_saw-v1.png'),
    label: "Athlete performing Body Saw",
  },
  accessory_dead_bug: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_dead_bug-v1.png'),
    label: "Athlete performing Dead Bug",
  },
  accessory_hollow_body_hold: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_hollow_body_hold-v1.png'),
    label: "Athlete performing Hollow-Body Hold",
  },
  accessory_v_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_v_up-v1.png'),
    label: "Athlete performing V-Up",
  },
  accessory_toe_touch: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_toe_touch-v1.png'),
    label: "Athlete performing Toe Touch",
  },
  accessory_side_plank: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_side_plank-v1.png'),
    label: "Athlete performing Side Plank",
  },
  accessory_copenhagen_side_plank: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_copenhagen_side_plank-v2.png'),
    label: "Athlete performing Copenhagen Side Plank",
  },
  accessory_bicycle_crunch: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bicycle_crunch-v1.png'),
    label: "Athlete performing Bicycle Crunch",
  },
  accessory_cross_body_mountain_climber: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_cross_body_mountain_climber-v2.png'),
    label: "Athlete performing Cross-Body Mountain Climber",
  },
  accessory_windshield_wiper: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_windshield_wiper-v1.png'),
    label: "Athlete performing Windshield Wiper",
  },
  accessory_bird_dog: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bird_dog-v1.png'),
    label: "Athlete performing Bird Dog",
  },
  accessory_45_degree_back_extension_lower_back_bias: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_45_degree_back_extension_lower_back_bias-v1.png'),
    label: "Athlete performing 45-Degree Back Extension (Lower-Back Bias)",
  },
  accessory_horizontal_back_extension: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_horizontal_back_extension-v1.png'),
    label: "Athlete performing Horizontal Back Extension",
  },
  accessory_sorenson_hold: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_sorenson_hold-v2.png'),
    label: "Athlete performing Sorenson Hold",
  },
  accessory_superman_hold: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_superman_hold-v1.png'),
    label: "Athlete performing Superman Hold",
  },
  accessory_lumbar_extension_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_lumbar_extension_machine-v3.png'),
    label: "Athlete performing Lumbar Extension Machine",
  },
  accessory_push_up_plus: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_push_up_plus-v1.png'),
    label: "Athlete performing Push-Up Plus",
  },
  accessory_scapular_push_up: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_scapular_push_up-v1.png'),
    label: "Athlete performing Scapular Push-Up",
  },
  accessory_wall_slide_with_reach: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_wall_slide_with_reach-v1.png'),
    label: "Athlete performing Wall Slide with Reach",
  },
  accessory_hip_flexion_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_hip_flexion_machine-v3.png'),
    label: "Athlete performing Hip Flexion Machine",
  },
  accessory_standing_hip_flexor_march: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_standing_hip_flexor_march-v1.png'),
    label: "Athlete performing Standing Hip-Flexor March",
  },
  accessory_seated_leg_lift: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_seated_leg_lift-v1.png'),
    label: "Athlete performing Seated Leg Lift",
  },
  accessory_l_sit: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_l_sit-v1.png'),
    label: "Athlete performing L-Sit",
  },
  accessory_hanging_knee_raise_iso_hold: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_hanging_knee_raise_iso_hold-v4.png'),
    label: "Athlete performing Hanging Knee Raise Iso-Hold",
  },
  accessory_neck_bridge: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_neck_bridge-v1.png'),
    label: "Athlete performing Neck Bridge",
  },
  accessory_isometric_neck_flexion: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_isometric_neck_flexion-v1.png'),
    label: "Athlete performing Isometric Neck Flexion",
  },
  accessory_isometric_neck_extension: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_isometric_neck_extension-v1.png'),
    label: "Athlete performing Isometric Neck Extension",
  },
  accessory_band_shoulder_press: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_shoulder_press-v1.png'),
    label: "Athlete performing Band Shoulder Press",
  },
  accessory_band_lateral_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_lateral_raise-v1.png'),
    label: "Athlete performing Band Lateral Raise",
  },
  accessory_band_y_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_y_raise-v2.png'),
    label: "Athlete performing Band Y-Raise",
  },
  accessory_band_upright_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_upright_row-v1.png'),
    label: "Athlete performing Band Upright Row",
  },
  accessory_band_pull_apart: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_pull_apart-v1.png'),
    label: "Athlete performing Band Pull-Apart",
  },
  accessory_band_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_curl-v1.png'),
    label: "Athlete performing Band Curl",
  },
  accessory_band_hammer_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_hammer_curl-v1.png'),
    label: "Athlete performing Band Hammer Curl",
  },
  accessory_band_push_up: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_push_up-v4.png'),
    label: "Athlete performing Band Push-Up",
  },
  accessory_band_front_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_front_raise-v1.png'),
    label: "Athlete performing Band Front Raise",
  },
  accessory_lateral_band_walk: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_lateral_band_walk-v1.png'),
    label: "Athlete performing Lateral Band Walk",
  },
  accessory_monster_walk: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_monster_walk-v1.png'),
    label: "Athlete performing Monster Walk",
  },
  accessory_standing_band_hip_abduction: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_standing_band_hip_abduction-v1.png'),
    label: "Athlete performing Standing Band Hip Abduction",
  },
  accessory_clamshell: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_clamshell-v1.png'),
    label: "Athlete performing Clamshell",
  },
  accessory_band_chest_press: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_chest_press-v2.png'),
    label: "Athlete performing Band Chest Press",
  },
  accessory_band_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_row-v1.png'),
    label: "Athlete performing Band Row",
  },
  accessory_band_triceps_pressdown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_triceps_pressdown-v4.png'),
    label: "Athlete performing Band Triceps Pressdown",
  },
  accessory_band_frog_pump: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_frog_pump-v1.png'),
    label: "Athlete performing Band Frog Pump",
  },
  accessory_band_reverse_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_reverse_flye-v1.png'),
    label: "Athlete performing Band Reverse Fly",
  },
  accessory_band_w_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_w_raise-v1.png'),
    label: "Athlete performing Band W-Raise",
  },
  accessory_band_straight_arm_pulldown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_straight_arm_pulldown-v3.png'),
    label: "Athlete performing Band Straight-Arm Pulldown",
  },
  accessory_band_shrug: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_shrug-v1.png'),
    label: "Athlete performing Band Shrug",
  },
  accessory_band_overhead_shrug: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_overhead_shrug-v1.png'),
    label: "Athlete performing Band Overhead Shrug",
  },
  accessory_band_overhead_triceps_extension: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_overhead_triceps_extension-v1.png'),
    label: "Athlete performing Band Overhead Triceps Extension",
  },
  accessory_band_kickback: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_kickback-v1.png'),
    label: "Athlete performing Band Kickback",
  },
  accessory_band_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_romanian_deadlift-v1.png'),
    label: "Athlete performing Band Romanian Deadlift",
  },
  accessory_band_glute_bridge: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_glute_bridge-v1.png'),
    label: "Athlete performing Band Glute Bridge",
  },
  accessory_band_calf_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_calf_raise-v1.png'),
    label: "Athlete performing Band Calf Raise",
  },
  accessory_band_face_pull: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_face_pull-v1.png'),
    label: "Athlete performing Band Face Pull",
  },
  accessory_band_high_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_high_row-v5.png'),
    label: "Athlete performing Band High Row",
  },
  accessory_band_scapular_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_scapular_row-v4.png'),
    label: "Athlete performing Band Scapular Row",
  },
  accessory_band_leg_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_leg_curl-v1.png'),
    label: "Athlete performing Band Leg Curl",
  },
  accessory_band_glute_kickback: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_glute_kickback-v1.png'),
    label: "Athlete performing Band Glute Kickback",
  },
  accessory_band_hip_adduction: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_hip_adduction-v1.png'),
    label: "Athlete performing Band Hip Adduction",
  },
  accessory_band_tibialis_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_tibialis_raise-v1.png'),
    label: "Athlete performing Band Tibialis Raise",
  },
  accessory_band_wall_slide: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_wall_slide-v1.png'),
    label: "Athlete performing Band Wall Slide",
  },
  accessory_band_chest_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_chest_flye-v2.png'),
    label: "Athlete performing Band Chest Fly",
  },
  accessory_band_assisted_sissy_squat: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_assisted_sissy_squat-v2.png'),
    label: "Athlete performing Band-Assisted Sissy Squat",
  },
  accessory_band_crunch: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_crunch-v4.png'),
    label: "Athlete performing Band Crunch",
  },
  accessory_band_dead_bug: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_dead_bug-v4.png'),
    label: "Athlete performing Band Dead Bug",
  },
  accessory_band_pallof_press: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_pallof_press-v3.png'),
    label: "Athlete performing Band Pallof Press",
  },
  accessory_band_anti_rotation_hold: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_anti_rotation_hold-v3.png'),
    label: "Athlete performing Band Anti-Rotation Hold",
  },
  accessory_band_back_extension: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_back_extension-v2.png'),
    label: "Athlete performing Band Back Extension",
  },
  accessory_band_psoas_march: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_psoas_march-v1.png'),
    label: "Athlete performing Band Psoas March",
  },
  accessory_band_hip_flexion: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_hip_flexion-v2.png'),
    label: "Athlete performing Band Hip Flexion",
  },
  accessory_band_neck_extension: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_neck_extension-v2.png'),
    label: "Athlete performing Band Neck Extension",
  },
  accessory_band_assisted_pull_up: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_assisted_pull_up-v4.png'),
    label: "Athlete performing Band-Assisted Pull-Up",
  },
  accessory_hand_gripper: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_hand_gripper-v2.png'),
    label: "Athlete performing Hand Gripper",
  },
  accessory_towel_grip_hold: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_towel_grip_hold-v2.png'),
    label: "Athlete performing Towel Grip Hold",
  },
  accessory_rice_bucket_hand_drill: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_rice_bucket_hand_drill-v1.png'),
    label: "Athlete performing Rice-Bucket Hand Drill",
  },
  accessory_band_spanish_squat: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_spanish_squat-v4.png'),
    label: "Athlete performing Band Spanish Squat",
  },
  accessory_band_good_morning: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_good_morning-v1.png'),
    label: "Athlete performing Band Good Morning",
  },
  accessory_band_wood_chop: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_wood_chop-v3.png'),
    label: "Athlete performing Band Wood Chop",
  },
  accessory_band_serratus_punch: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_serratus_punch-v3.png'),
    label: "Athlete performing Band Serratus Punch",
  },
  accessory_band_neck_flexion: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_neck_flexion-v3.png'),
    label: "Athlete performing Band Neck Flexion",
  },
  accessory_standing_cable_chest_press: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_standing_cable_chest_press-v4.png'),
    label: "Athlete performing Standing Cable Chest Press",
  },
  accessory_single_arm_cable_chest_press: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_chest_press-v4.png'),
    label: "Athlete performing Single-Arm Cable Chest Press",
  },
  accessory_cable_chest_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_chest_flye-v5.png'),
    label: "Athlete performing Cable Chest Fly",
  },
  accessory_single_arm_cable_lateral_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_lateral_raise-v5.png'),
    label: "Athlete performing Single-Arm Cable Lateral Raise",
  },
  accessory_low_to_high_cable_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_low_to_high_cable_flye-v5.png'),
    label: "Athlete performing Low-to-High Cable Fly",
  },
  accessory_high_to_low_cable_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_high_to_low_cable_flye-v4.png'),
    label: "Athlete performing High-to-Low Cable Fly",
  },
  accessory_single_arm_cable_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_flye-v5.png'),
    label: "Athlete performing Single-Arm Cable Fly",
  },
  accessory_cable_squeeze_press: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_squeeze_press-v4.png'),
    label: "Athlete performing Cable Squeeze Press",
  },
  accessory_cable_front_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_front_raise-v6.png'),
    label: "Athlete performing Cable Front Raise",
  },
  accessory_cable_lateral_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_lateral_raise-v5.png'),
    label: "Athlete performing Cable Lateral Raise",
  },
  accessory_lean_away_cable_lateral_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_lean_away_cable_lateral_raise-v4.png'),
    label: "Athlete performing Lean-Away Cable Lateral Raise",
  },
  accessory_behind_the_back_cable_lateral_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_behind_the_back_cable_lateral_raise-v4.png'),
    label: "Athlete performing Behind-the-Back Cable Lateral Raise",
  },
  accessory_single_arm_cable_y_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_y_raise-v4.png'),
    label: "Athlete performing Single-Arm Cable Y-Raise",
  },
  accessory_dual_cable_y_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_dual_cable_y_raise-v6.png'),
    label: "Athlete performing Dual Cable Y-Raise",
  },
  accessory_cable_face_pull: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_face_pull-v8.png'),
    label: "Athlete performing Cable Face Pull",
  },
  accessory_half_kneeling_single_arm_lat_pulldown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_half_kneeling_single_arm_lat_pulldown-v7.png'),
    label: "Athlete performing Half-Kneeling Single-Arm Lat Pulldown",
  },
  accessory_band_lateral_neck_flexion: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_lateral_neck_flexion-v4.png'),
    label: "Athlete performing Band Lateral Neck Flexion",
  },
  accessory_single_arm_cable_front_raise: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_front_raise-v4.png'),
    label: "Athlete performing Single-Arm Cable Front Raise",
  },
  accessory_wide_grip_lat_pulldown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_wide_grip_lat_pulldown-v3.png'),
    label: "Athlete performing Wide-Grip Lat Pulldown",
  },
  accessory_single_arm_lat_pulldown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_lat_pulldown-v4.png'),
    label: "Athlete performing Single-Arm Lat Pulldown",
  },
  accessory_seated_cable_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_seated_cable_row-v6.png'),
    label: "Athlete performing Seated Cable Row",
  },
  accessory_cable_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_curl-v5.png'),
    label: "Athlete performing Cable Curl",
  },
  accessory_bayesian_cable_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_bayesian_cable_curl-v4.png'),
    label: "Athlete performing Bayesian Cable Curl",
  },
  accessory_single_arm_bayesian_cable_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_bayesian_cable_curl-v4.png'),
    label: "Athlete performing Single-Arm Bayesian Cable Curl",
  },
  accessory_single_arm_cable_preacher_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_preacher_curl-v4.png'),
    label: "Athlete performing Single-Arm Cable Preacher Curl",
  },
  accessory_high_cable_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_high_cable_curl-v4.png'),
    label: "Athlete performing High Cable Curl",
  },
  accessory_single_arm_cable_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_curl-v6.png'),
    label: "Athlete performing Single-Arm Cable Curl",
  },
  accessory_cable_hammer_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_hammer_curl-v5.png'),
    label: "Athlete performing Cable Hammer Curl",
  },
  accessory_cable_upright_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_upright_row-v4.png'),
    label: "Athlete performing Cable Upright Row",
  },
  accessory_single_arm_cable_reverse_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_reverse_flye-v5.png'),
    label: "Athlete performing Single-Arm Cable Reverse Fly",
  },
  accessory_cable_archer_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_archer_row-v5.png'),
    label: "Athlete performing Cable Archer Row",
  },
  accessory_straight_arm_cable_pulldown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_straight_arm_cable_pulldown-v5.png'),
    label: "Athlete performing Straight-Arm Cable Pulldown",
  },
  accessory_single_arm_cable_pullover: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_pullover-v3.png'),
    label: "Athlete performing Single-Arm Cable Pullover",
  },
  accessory_cable_lat_prayer: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_lat_prayer-v4.png'),
    label: "Athlete performing Cable Lat Prayer",
  },
  accessory_single_arm_cable_low_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_low_row-v8.png'),
    label: "Athlete performing Single-Arm Cable Low Row",
  },
  accessory_elbow_tucked_cable_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_elbow_tucked_cable_row-v4.png'),
    label: "Athlete performing Elbow-Tucked Cable Row",
  },
  accessory_wide_grip_seated_cable_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_wide_grip_seated_cable_row-v5.png'),
    label: "Athlete performing Wide-Grip Seated Cable Row",
  },
  accessory_neutral_grip_seated_cable_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_neutral_grip_seated_cable_row-v4.png'),
    label: "Athlete performing Neutral-Grip Seated Cable Row",
  },
  accessory_single_arm_seated_cable_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_seated_cable_row-v4.png'),
    label: "Athlete performing Single-Arm Seated Cable Row",
  },
  accessory_standing_cable_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_standing_cable_row-v4.png'),
    label: "Athlete performing Standing Cable Row",
  },
  accessory_cable_scapular_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_scapular_row-v4.png'),
    label: "Athlete performing Cable Scapular Row",
  },
  accessory_single_arm_cable_high_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_high_row-v3.png'),
    label: "Athlete performing Single-Arm Cable High Row",
  },
  accessory_cable_shrug: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_shrug-v5.png'),
    label: "Athlete performing Cable Shrug",
  },
  accessory_single_arm_cable_shrug: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_shrug-v4.png'),
    label: "Athlete performing Single-Arm Cable Shrug",
  },
  accessory_band_leg_extension: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_band_leg_extension-v3.png'),
    label: "Athlete performing Band Leg Extension",
  },
  accessory_cable_reverse_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_reverse_flye-v4.png'),
    label: "Athlete performing Cable Reverse Fly",
  },
  accessory_cross_body_cable_rear_delt_flye: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cross_body_cable_rear_delt_flye-v5.png'),
    label: "Athlete performing Cross-Body Cable Rear-Delt Fly",
  },
  accessory_neutral_grip_lat_pulldown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_neutral_grip_lat_pulldown-v9.png'),
    label: "Athlete performing Neutral-Grip Lat Pulldown",
  },
  accessory_close_grip_lat_pulldown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_close_grip_lat_pulldown-v4.png'),
    label: "Athlete performing Close-Grip Lat Pulldown",
  },
  accessory_supinated_grip_lat_pulldown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_supinated_grip_lat_pulldown-v3.png'),
    label: "Athlete performing Supinated-Grip Lat Pulldown",
  },
  accessory_cable_preacher_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_preacher_curl-v5.png'),
    label: "Athlete performing Cable Preacher Curl",
  },
  accessory_cable_triceps_pressdown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_triceps_pressdown-v4.png'),
    label: "Athlete performing Cable Triceps Pressdown",
  },
  accessory_single_arm_cable_pressdown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_pressdown-v7.png'),
    label: "Athlete performing Single-Arm Cable Pressdown",
  },
  accessory_single_arm_cable_overhead_triceps_extension: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_overhead_triceps_extension-v4.png'),
    label: "Athlete performing Single-Arm Cable Overhead Triceps Extension",
  },
  accessory_cross_body_cable_triceps_extension: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cross_body_cable_triceps_extension-v4.png'),
    label: "Athlete performing Cross-Body Cable Triceps Extension",
  },
  accessory_cable_kickback: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_kickback-v5.png'),
    label: "Athlete performing Cable Kickback",
  },
  accessory_cable_wrist_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_wrist_curl-v4.png'),
    label: "Athlete performing Cable Wrist Curl",
  },
  accessory_cable_reverse_wrist_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_reverse_wrist_curl-v4.png'),
    label: "Athlete performing Cable Reverse Wrist Curl",
  },
  accessory_cable_leg_curl: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_leg_curl-v4.png'),
    label: "Athlete performing Cable Leg Curl",
  },
  accessory_cable_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_romanian_deadlift-v7.png'),
    label: "Athlete performing Cable Romanian Deadlift",
  },
  accessory_single_leg_cable_romanian_deadlift: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_leg_cable_romanian_deadlift-v5.png'),
    label: "Athlete performing Single-Leg Cable Romanian Deadlift",
  },
  accessory_cable_glute_kickback: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_glute_kickback-v4.png'),
    label: "Athlete performing Cable Glute Kickback",
  },
  accessory_cable_pull_through: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_pull_through-v5.png'),
    label: "Athlete performing Cable Pull-Through",
  },
  accessory_standing_cable_hip_adduction: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_standing_cable_hip_adduction-v4.png'),
    label: "Athlete performing Standing Cable Hip Adduction",
  },
  accessory_standing_cable_hip_abduction: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_standing_cable_hip_abduction-v4.png'),
    label: "Athlete performing Standing Cable Hip Abduction",
  },
  accessory_cable_crunch: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_crunch-v9.png'),
    label: "Athlete performing Cable Crunch",
  },
  accessory_standing_cable_crunch: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_standing_cable_crunch-v5.png'),
    label: "Athlete performing Standing Cable Crunch",
  },
  accessory_cable_reverse_crunch: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_reverse_crunch-v4.png'),
    label: "Athlete performing Cable Reverse Crunch",
  },
  accessory_pallof_press: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_pallof_press-v10.png'),
    label: "Athlete performing Pallof Press",
  },
  accessory_half_kneeling_pallof_press: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_half_kneeling_pallof_press-v5.png'),
    label: "Athlete performing Half-Kneeling Pallof Press",
  },
  accessory_cable_wood_chop: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_wood_chop-v3.png'),
    label: "Athlete performing Cable Wood Chop",
  },
  accessory_low_to_high_cable_chop: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_low_to_high_cable_chop-v3.png'),
    label: "Athlete performing Low-to-High Cable Chop",
  },
  accessory_cable_serratus_punch: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_serratus_punch-v4.png'),
    label: "Athlete performing Cable Serratus Punch",
  },
  accessory_single_arm_cable_serratus_punch: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_single_arm_cable_serratus_punch-v4.png'),
    label: "Athlete performing Single-Arm Cable Serratus Punch",
  },
  accessory_standing_cable_hip_flexion: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_standing_cable_hip_flexion-v4.png'),
    label: "Athlete performing Standing Cable Hip Flexion",
  },
  accessory_supine_cable_hip_flexion: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_supine_cable_hip_flexion-v5.png'),
    label: "Athlete performing Supine Cable Hip Flexion",
  },
  accessory_cable_high_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_high_row-v7.png'),
    label: "Athlete performing Cable High Row",
  },
  accessory_chest_supported_cable_row: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_chest_supported_cable_row-v8.png'),
    label: "Athlete performing Chest-Supported Cable Row",
  },
  accessory_reverse_grip_triceps_pressdown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_reverse_grip_triceps_pressdown-v8.png'),
    label: "Athlete performing Reverse-Grip Triceps Pressdown",
  },
  accessory_cable_overhead_triceps_extension: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_overhead_triceps_extension-v5.png'),
    label: "Athlete performing Cable Overhead Triceps Extension",
  },
  accessory_cable_skull_crusher: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_skull_crusher-v4.png'),
    label: "Athlete performing Cable Skull Crusher",
  },
  accessory_rope_face_pull_with_external_rotation: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_rope_face_pull_with_external_rotation-v5.png'),
    label: "Athlete performing Cable Face Pull with External Rotation",
  },
  accessory_cable_side_bend: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_side_bend-v3.png'),
    label: "Athlete performing Cable Side Bend",
  },
  accessory_cable_pronation: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_pronation-v4.png'),
    label: "Athlete performing Cable Pronation",
  },
  accessory_cable_supination: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/accessory_cable_supination-v4.png'),
    label: "Athlete performing Cable Supination",
  },
  cable_lat_pulldown_unknown: {
    source: require('@/assets/images/movement-artwork/approved-completion-v1/cable_lat_pulldown_unknown-v2.png'),
    label: "Athlete performing Cable Lat Pulldown",
  },
  // Archive bytes remain reviewable locally and are removed from release exports.
  ...(__DEV__ ? {
  barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-row-v1.png'),
    label: 'Athlete performing barbell row',
  },
  single_arm_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-arm-dumbbell-row-v1.png'),
    label: 'Athlete performing single-arm dumbbell row',
  },
  incline_dumbbell_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-dumbbell-press-v1.png'),
    label: 'Athlete performing incline dumbbell press',
  },
  accessory_weighted_push_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/weighted-push-up-v1.png'),
    label: 'Athlete performing weighted push-up',
  },
  accessory_incline_bench_rear_delt_flye: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-bench-rear-delt-flye-v1.png'),
    label: 'Athlete performing incline-bench rear-delt fly',
  },
  accessory_wide_elbow_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-elbow-dumbbell-row-v1.png'),
    label: 'Athlete performing wide-elbow dumbbell row',
  },
  accessory_three_point_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/three-point-dumbbell-row-v1.png'),
    label: 'Athlete performing three-point dumbbell row',
  },
  accessory_landmine_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/landmine-row-v1.png'),
    label: 'Athlete performing landmine row',
  },
  accessory_incline_bench_dumbbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/incline-bench-dumbbell-row-v1.png'),
    label: 'Athlete performing incline-bench dumbbell row',
  },
  accessory_wide_elbow_barbell_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/wide-elbow-barbell-row-v1.png'),
    label: 'Athlete performing wide-elbow barbell row',
  },
  accessory_chest_supported_kelso_row: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/chest-supported-kelso-row-v1.png'),
    label: 'Athlete performing chest-supported kelso row',
  },
  accessory_kelso_shrug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/kelso-shrug-v1.png'),
    label: 'Athlete performing kelso shrug',
  },
  accessory_standing_dumbbell_curl: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-curl-v1.png'),
    label: 'Athlete performing standing dumbbell curl',
  },
  accessory_dumbbell_step_down: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-step-down-v1.png'),
    label: 'Athlete performing dumbbell step-down',
  },
  accessory_spanish_squat_with_weight: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/spanish-squat-with-weight-v1.png'),
    label: 'Athlete performing spanish squat with weight',
  },
  accessory_glute_ham_raise_with_weight: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/glute-ham-raise-with-weight-v1.png'),
    label: 'Athlete performing glute-ham raise with weight',
  },
  accessory_dumbbell_hip_thrust: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-hip-thrust-v1.png'),
    label: 'Athlete performing dumbbell hip thrust',
  },
  accessory_barbell_glute_bridge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-glute-bridge-v1.png'),
    label: 'Athlete performing barbell glute bridge',
  },
  accessory_dumbbell_glute_bridge: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-glute-bridge-v1.png'),
    label: 'Athlete performing dumbbell glute bridge',
  },
  accessory_dumbbell_frog_pump: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-frog-pump-v1.png'),
    label: 'Athlete performing dumbbell frog pump',
  },
  accessory_standing_dumbbell_calf_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/standing-dumbbell-calf-raise-v1.png'),
    label: 'Athlete performing standing dumbbell calf raise',
  },
  accessory_single_leg_dumbbell_calf_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/single-leg-dumbbell-calf-raise-v1.png'),
    label: 'Athlete performing single-leg dumbbell calf raise',
  },
  accessory_barbell_calf_raise: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-calf-raise-v1.png'),
    label: 'Athlete performing barbell calf raise',
  },
  accessory_donkey_calf_raise_with_weight: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/donkey-calf-raise-with-weight-v1.png'),
    label: 'Athlete performing donkey calf raise with weight',
  },
  accessory_weighted_crunch: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/weighted-crunch-v1.png'),
    label: 'Athlete performing weighted crunch',
  },
  accessory_plate_sit_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/plate-sit-up-v1.png'),
    label: 'Athlete performing plate sit-up',
  },
  accessory_weighted_decline_sit_up: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/weighted-decline-sit-up-v1.png'),
    label: 'Athlete performing weighted decline sit-up',
  },
  accessory_dumbbell_dead_bug: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-dead-bug-v1.png'),
    label: 'Athlete performing dumbbell dead bug',
  },
  accessory_barbell_back_extension: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/barbell-back-extension-v1.png'),
    label: 'Athlete performing barbell back extension',
  },
  accessory_good_morning: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/good-morning-v1.png'),
    label: 'Athlete performing good morning',
  },
  accessory_ankle_weight_hip_flexion: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/ankle-weight-hip-flexion-v1.png'),
    label: 'Athlete performing ankle-weight hip flexion',
  },
  accessory_pec_deck: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_pec_deck-v2.png'),
    label: "Athlete performing Pec Deck",
  },
  accessory_reverse_pec_deck: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_reverse_pec_deck-v4.png'),
    label: "Athlete performing Reverse Pec Deck",
  },
  accessory_chest_supported_rear_delt_machine_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_chest_supported_rear_delt_machine_row-v6.png'),
    label: "Athlete performing Chest-Supported Rear-Delt Machine Row",
  },
  accessory_machine_mid_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_machine_mid_row-v4.png'),
    label: "Athlete performing Machine Mid Row",
  },
  accessory_plate_loaded_seated_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_plate_loaded_seated_row-v4.png'),
    label: "Athlete performing Machine Seated Row",
  },
  accessory_chest_supported_high_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_chest_supported_high_row-v4.png'),
    label: "Athlete performing Chest-Supported High Row",
  },
  accessory_wide_elbow_machine_row: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_wide_elbow_machine_row-v6.png'),
    label: "Athlete performing Wide-Elbow Machine Row",
  },
  accessory_bodyweight_walking_lunge: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bodyweight_walking_lunge-v1.png'),
    label: "Athlete performing Bodyweight Walking Lunge",
  },
  accessory_glute_ham_raise: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_glute_ham_raise-v1.png'),
    label: "Athlete performing Glute-Ham Raise",
  },
  accessory_glute_drive_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_glute_drive_machine-v2.png'),
    label: "Athlete performing Glute Drive Machine",
  },
  accessory_single_leg_adductor_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_leg_adductor_machine-v3.png'),
    label: "Athlete performing Single-Leg Adductor Machine",
  },
  accessory_copenhagen_adduction: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_copenhagen_adduction-v1.png'),
    label: "Athlete performing Copenhagen Adduction",
  },
  accessory_single_leg_calf_raise_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_single_leg_calf_raise_machine-v2.png'),
    label: "Athlete performing Single-Leg Calf Raise Machine",
  },
  accessory_bird_dog_back_extension: {
    source: require('@/assets/images/movement-artwork/bodyweight-v1/accessory_bird_dog_back_extension-v2.png'),
    label: "Athlete performing Bird Dog Back Extension",
  },
  accessory_reverse_hyperextension_machine: {
    source: require('@/assets/images/movement-artwork/machine-v1/accessory_reverse_hyperextension_machine-v4.png'),
    label: "Athlete performing Reverse Hyperextension Machine",
  },
  } : {}),
} : {};

export function canonicalMovementArtworkSource(
  movement?: CanonicalMovementArtworkInput | null,
): ImageSourcePropType | null {
  const resolution = resolveCanonicalMovementArtwork(movement);
  const sharedOrExact = resolveApprovedExactMovementArtwork(movement);
  if (sharedOrExact && CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[sharedOrExact.key]) {
    return CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[sharedOrExact.key]?.source || null;
  }
  if (resolution.kind === 'accessory') {
    const approved = resolveApprovedExactMovementArtwork(movement);
    const exact = approved ? CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[approved.key] : null;
    if (exact) return exact.source;
    return accessoryMuscleRegionAsset(resolution.regionKey).source;
  }
  if (resolution.kind === 'core' || resolution.kind === 'core_variant') {
    return CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family];
  }
  return null;
}
