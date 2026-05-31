import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { SLColors } from '@/constants/theme';

type SLAtmosphereProps = {
  style?: StyleProp<ViewStyle>;
};

export function SLAtmosphere({ style }: SLAtmosphereProps) {
  return (
    <LinearGradient
      colors={[
        SLColors.shellGradientTop,
        SLColors.shellGradientMid,
        SLColors.shellGradientDark,
        SLColors.shellGradientWarm,
      ]}
      locations={[0, 0.28, 0.68, 1]}
      pointerEvents="none"
      start={{ x: 0.25, y: 0 }}
      end={{ x: 0.75, y: 1 }}
      style={[StyleSheet.absoluteFillObject, style]}
    />
  );
}
