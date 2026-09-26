import type { ImageSourcePropType } from 'react-native';
import type { MachineEquipmentType } from './machine-equipment';

export type EquipmentTypeArtwork = Readonly<{
  source: ImageSourcePropType;
  description: string;
  accessibilityLabel: string;
}>;

// Category illustrations only. Equipment identity, manufacturer, model and
// comparability continue to be owned by the existing equipment flow.
// The validated category pair is enabled for DEV and the governed TestFlight OTA only.
export const EQUIPMENT_TYPE_ARTWORK: Readonly<Record<MachineEquipmentType, EquipmentTypeArtwork>> | null = (__DEV__ || process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'testflight') ? {
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

// The exact plate-loaded cable image was approved by the owner for TestFlight.
// Production remains on its separate, unchanged art channel.
export const CABLE_EQUIPMENT_TYPE_ARTWORK: Readonly<Record<MachineEquipmentType, EquipmentTypeArtwork>> | null = (__DEV__ || process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'testflight') ? {
  plate_loaded: {
    source: require('@/assets/images/equipment-types/cable-review/plate-loaded-cable-station-candidate-v1.png'),
    description: 'Plate-loaded cable station',
    accessibilityLabel: 'Plate-loaded cable station with pulleys and mounted plates',
  },
  selectorized: {
    source: require('@/assets/images/equipment-types/v1/selectorized.png'),
    description: 'Cable stack and selector pin',
    accessibilityLabel: 'Approved selectorized stack and inserted pin for a cable station',
  },
} : null;
