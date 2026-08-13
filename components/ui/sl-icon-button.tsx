import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLColors, SLRadius, SLShadows, SLStatusTones, type SLStatusTone } from '@/constants/theme';
import { SLMotionPressable } from './sl-motion';
import { SLMaterialOverlay } from './sl-workspace';

type IconName = keyof typeof Ionicons.glyphMap;
type IconButtonVariant = 'solid' | 'soft' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

type SLIconButtonProps = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: (event: GestureResponderEvent) => void;
  tone?: SLStatusTone;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const sizes: Record<IconButtonSize, { box: number; icon: number; radius: number }> = {
  sm: { box: 34, icon: 16, radius: SLRadius.sm },
  md: { box: 42, icon: 19, radius: SLRadius.md },
  lg: { box: 50, icon: 22, radius: SLRadius.lg },
};

export function SLIconButton({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  disabled = false,
  style,
}: SLIconButtonProps) {
  const sizing = sizes[size];
  const palette = SLStatusTones[tone];
  const backgroundColor =
    variant === 'ghost'
      ? 'transparent'
      : variant === 'solid'
        ? palette.icon
        : tone === 'neutral'
          ? SLColors.object
          : palette.background;
  const iconColor = variant === 'solid' ? SLColors.textInverted : palette.icon;
  const borderColor =
    variant === 'ghost'
      ? 'transparent'
      : tone === 'neutral'
        ? SLColors.borderStandard
        : palette.border;

  return (
    <SLMotionPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed && variant !== 'ghost' ? SLColors.surfacePressed : backgroundColor,
          borderColor,
          borderRadius: sizing.radius,
          height: sizing.box,
          opacity: disabled ? 0.45 : 1,
          width: sizing.box,
        },
        variant === 'ghost' ? null : SLShadows.level2,
        style,
      ]}
    >
      {({ pressed }: { pressed: boolean }) => (
        <>
          {variant !== 'ghost' ? <SLMaterialOverlay compact level={variant === 'solid' ? 3 : 2} pressed={pressed} /> : null}
          <Ionicons color={iconColor} name={icon} size={sizing.icon} />
        </>
      )}
    </SLMotionPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
});
