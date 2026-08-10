import React from 'react';
import {
  Image,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { SLColors, SLRadius } from '@/constants/theme';
import type { AccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';

type AccessoryMuscleRegionMedallionProps = Readonly<{
  accessibilityLabel?: string;
  compact?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  regionKey?: AccessoryMuscleRegionKey | null;
}>;

export function AccessoryMuscleRegionMedallion({
  accessibilityLabel,
  compact = false,
  containerStyle,
  regionKey,
}: AccessoryMuscleRegionMedallionProps) {
  const asset = accessoryMuscleRegionAsset(regionKey);

  return (
    <View
      accessibilityLabel={accessibilityLabel || `${asset.label} primary muscle group`}
      accessibilityRole="image"
      style={[
        styles.frame,
        compact && styles.frameCompact,
        containerStyle,
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={asset.source}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceFloating,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  frameCompact: {
    height: 60,
    width: 60,
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
