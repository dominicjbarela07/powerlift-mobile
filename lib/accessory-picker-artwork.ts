import type { ImageSourcePropType } from 'react-native';

import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { canonicalAccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';

type PickerMovementIdentity = Readonly<{
  key?: string | null;
  primary_muscle_group?: string | null;
}>;

export type AccessoryPickerArtwork = Readonly<{
  kind: 'movement' | 'muscle';
  source: ImageSourcePropType;
}>;

// Exact artwork is opt-in and keyed by stable movement identity. Keep this
// registry empty until a reviewed image is genuinely available and correct.
const EXACT_MOVEMENT_ARTWORK: Readonly<Record<string, ImageSourcePropType>> = {};

export function accessoryPickerArtwork(
  movement?: PickerMovementIdentity | null,
): AccessoryPickerArtwork {
  const exact = movement?.key ? EXACT_MOVEMENT_ARTWORK[movement.key] : null;
  if (exact) return { kind: 'movement', source: exact };
  const region = canonicalAccessoryMuscleRegionKey(
    movement?.primary_muscle_group,
  );
  return {
    kind: 'muscle',
    source: accessoryMuscleRegionAsset(region).source,
  };
}
