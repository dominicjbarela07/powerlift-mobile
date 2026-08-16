import type { ImageSourcePropType } from 'react-native';

import type { AccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';

export type AccessoryMuscleRegionAsset = Readonly<{
  label: string;
  source: ImageSourcePropType;
}>;

export type AccessoryRegionalArtworkKey = AccessoryMuscleRegionKey | 'back_region';

export const ACCESSORY_MUSCLE_REGION_ASSETS: Readonly<
  Record<AccessoryMuscleRegionKey, AccessoryMuscleRegionAsset>
> = {
  chest: { label: 'Chest', source: require('../assets/images/muscle-regions/chest.png') },
  shoulders: { label: 'Shoulders', source: require('../assets/images/muscle-regions/shoulders.png') },
  front_delts: { label: 'Front delts', source: require('../assets/images/muscle-regions/front-delts.png') },
  side_delts: { label: 'Side delts', source: require('../assets/images/muscle-regions/side-delts.png') },
  rear_delts: { label: 'Rear delts', source: require('../assets/images/muscle-regions/rear-delts.png') },
  biceps: { label: 'Biceps', source: require('../assets/images/muscle-regions/biceps.png') },
  triceps: { label: 'Triceps', source: require('../assets/images/muscle-regions/triceps.png') },
  forearms: { label: 'Forearms', source: require('../assets/images/muscle-regions/forearms.png') },
  arms: { label: 'Arms', source: require('../assets/images/muscle-regions/arms.png') },
  lats: { label: 'Lats', source: require('../assets/images/muscle-regions/lats.png') },
  upper_back: { label: 'Upper back', source: require('../assets/images/muscle-regions/upper-back.png') },
  traps: { label: 'Traps', source: require('../assets/images/muscle-regions/traps.png') },
  rotator_cuff: { label: 'Rotator cuff', source: require('../assets/images/muscle-regions/rotator-cuff.png') },
  lower_back: { label: 'Lower back', source: require('../assets/images/muscle-regions/lower-back.png') },
  core: { label: 'Core', source: require('../assets/images/muscle-regions/core.png') },
  abs: { label: 'Abs', source: require('../assets/images/muscle-regions/abs.png') },
  obliques: { label: 'Obliques', source: require('../assets/images/muscle-regions/obliques.png') },
  quads: { label: 'Quads', source: require('../assets/images/muscle-regions/quads.png') },
  hamstrings: { label: 'Hamstrings', source: require('../assets/images/muscle-regions/hamstrings.png') },
  glutes: { label: 'Glutes', source: require('../assets/images/muscle-regions/glutes.png') },
  adductors: { label: 'Adductors', source: require('../assets/images/muscle-regions/adductors.png') },
  abductors: { label: 'Abductors', source: require('../assets/images/muscle-regions/abductors.png') },
  hip_flexors: { label: 'Hip flexors', source: require('../assets/images/muscle-regions/hip-flexors.png') },
  calves: { label: 'Calves', source: require('../assets/images/muscle-regions/calves.png') },
  serratus: { label: 'Serratus', source: require('../assets/images/muscle-regions/chest.png') },
  neck: { label: 'Neck', source: require('../assets/images/muscle-regions/traps.png') },
  full_body: { label: 'Full body', source: require('../assets/images/muscle-regions/full-body.png') },
};

export function accessoryMuscleRegionAsset(
  key?: AccessoryMuscleRegionKey | null,
): AccessoryMuscleRegionAsset {
  return ACCESSORY_MUSCLE_REGION_ASSETS[key || 'full_body'];
}

/**
 * Region-only artwork stays outside the governed muscle key set so browsing
 * can never manufacture a MovementDefinition muscle identity.
 */
const ACCESSORY_REGIONAL_ARTWORK_ASSETS: Readonly<
  Record<AccessoryRegionalArtworkKey, AccessoryMuscleRegionAsset>
> = {
  ...ACCESSORY_MUSCLE_REGION_ASSETS,
  back_region: {
    label: 'Back',
    source: require('../assets/images/muscle-regions/back-region.png'),
  },
};

export function accessoryRegionalArtworkAsset(
  key?: AccessoryRegionalArtworkKey | null,
): AccessoryMuscleRegionAsset {
  return ACCESSORY_REGIONAL_ARTWORK_ASSETS[key || 'full_body'];
}
