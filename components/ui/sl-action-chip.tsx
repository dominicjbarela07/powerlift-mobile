import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLColors, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type SLActionChipProps = {
  label: string;
  icon?: IconName;
  onPress?: (event: GestureResponderEvent) => void;
  tone?: SLStatusTone;
  selected?: boolean;
  disabled?: boolean;
  shape?: 'control' | 'pill';
  style?: StyleProp<ViewStyle>;
};

export function SLActionChip({
  label,
  icon,
  onPress,
  tone = 'neutral',
  selected = false,
  disabled = false,
  shape = 'pill',
  style,
}: SLActionChipProps) {
  const palette = SLStatusTones[tone];
  const backgroundColor = selected ? SLColors.surfaceSelected : SLColors.surfaceFlat;
  const borderColor = selected ? (tone === 'neutral' ? SLColors.borderSelected : palette.border) : SLColors.borderSubtle;
  const color = selected ? palette.text : SLColors.text;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        shape === 'pill' ? styles.pillChip : styles.controlChip,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {icon ? <Ionicons color={selected ? palette.icon : SLColors.textMuted} name={icon} size={15} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.xs,
    minHeight: 36,
    paddingHorizontal: SLSpacing.md,
  },
  pillChip: {
    borderRadius: SLRadius.pill,
  },
  controlChip: {
    borderRadius: SLRadius.radiusControl,
  },
  label: {
    fontFamily: SLTypography.chipLabel.fontFamily,
    fontSize: SLTypography.chipLabel.fontSize,
    fontWeight: SLTypography.chipLabel.fontWeight,
    letterSpacing: SLTypography.chipLabel.letterSpacing,
    lineHeight: SLTypography.chipLabel.lineHeight,
  },
});
