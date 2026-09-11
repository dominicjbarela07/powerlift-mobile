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
