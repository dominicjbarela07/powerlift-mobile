import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLColors, SLControlSize, SLOpacity, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';
import { SLMotionPressable } from './sl-motion';
import { SLMaterialOverlay } from './sl-workspace';

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
    <SLMotionPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        shape === 'pill' ? styles.pillChip : styles.controlChip,
        {
          backgroundColor: pressed ? SLColors.surfacePressed : backgroundColor,
          borderColor,
          opacity: disabled ? SLOpacity.disabled : 1,
        },
        style,
      ]}
    >
      {({ pressed }: { pressed: boolean }) => (
        <>
          <SLMaterialOverlay compact level={selected ? 3 : 2} pressed={pressed} />
          {icon ? <Ionicons color={selected ? palette.icon : SLColors.textMuted} name={icon} size={15} /> : null}
          <Text numberOfLines={1} typographyRole="badge" style={[styles.label, { color }]}>
            {label}
          </Text>
        </>
      )}
    </SLMotionPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.xs,
    minHeight: SLControlSize.compact,
    overflow: 'hidden',
    paddingHorizontal: SLSpacing.md,
    position: 'relative',
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
