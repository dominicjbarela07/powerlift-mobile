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
  accessory_incline_dumbbell_bench_press: {
    source: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-incline-bench-press-v1.png'),
    thumbnail: require('@/assets/images/movement-artwork/free-weight-v1/dumbbell-incline-bench-press-v1-thumb.png'),
    label: 'Athlete performing a dumbbell incline bench press',
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
