import React from 'react';
import {
  StyleSheet,
  type StyleProp,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLTypography } from '@/constants/theme';
import { MOVEMENT_STATUS_MIN_WIDTH } from '@/lib/movement-lifecycle-status-layout';

export function MovementLifecycleStatusLabel({
  label,
  style,
  containerStyle,
}: {
  label: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        maxFontSizeMultiplier={1.15}
        numberOfLines={1}
        style={[styles.label, style]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: MOVEMENT_STATUS_MIN_WIDTH,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  label: {
    flexShrink: 0,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: SLTypography.micro.lineHeight,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
});
