import type { ImageSourcePropType } from 'react-native';

import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { resolveCanonicalMovementArtwork } from '@/lib/canonical-movement-artwork';

type PickerMovementIdentity = Readonly<{
  id?: number | null;
  key?: string | null;
  primary_muscle_group?: string | null;
}>;

export type AccessoryPickerArtwork = Readonly<{
  kind: 'muscle' | 'neutral';
  source: ImageSourcePropType | null;
}>;

export function accessoryPickerArtwork(
  movement?: PickerMovementIdentity | null,
): AccessoryPickerArtwork {
  const resolved = resolveCanonicalMovementArtwork(
    movement ? { ...movement, kind: 'accessory' } : null,
  );
  if (resolved.kind !== 'accessory') return { kind: 'neutral', source: null };
  return {
    kind: 'muscle',
    source: accessoryMuscleRegionAsset(resolved.regionKey).source,
  };
}
