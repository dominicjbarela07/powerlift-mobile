import type { ImageSourcePropType } from 'react-native';
import type { MachineEquipmentType } from './machine-equipment';

export type EquipmentTypeArtwork = Readonly<{
  source: ImageSourcePropType;
  description: string;
  accessibilityLabel: string;
}>;

// Category illustrations only. Equipment identity, manufacturer, model and
// comparability continue to be owned by the existing equipment flow.
// Keep this newly generated pair out of TestFlight/Production bundles.
export const EQUIPMENT_TYPE_ARTWORK: Readonly<Record<MachineEquipmentType, EquipmentTypeArtwork>> | null = __DEV__ ? {
  plate_loaded: {
    source: require('@/assets/images/equipment-types/v1/plate-loaded.png'),
    description: 'Plates on loading horns',
    accessibilityLabel: 'Close-up of weight plates mounted on a machine loading horn',
  },
  selectorized: {
    source: require('@/assets/images/equipment-types/v1/selectorized.png'),
    description: 'Weight stack and selector pin',
    accessibilityLabel: 'Close-up of a rectangular weight stack with an inserted selector pin',
  },
} : null;
