import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLColors, SLRadius, SLStatusTones, type SLStatusTone } from '@/constants/theme';

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
    variant === 'ghost' ? 'transparent' : variant === 'solid' ? palette.icon : palette.background;
  const iconColor = variant === 'solid' ? SLColors.textInverted : palette.icon;
  const borderColor = variant === 'ghost' ? 'transparent' : palette.border;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          borderRadius: sizing.radius,
          height: sizing.box,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
          width: sizing.box,
        },
        style,
      ]}
    >
      <Ionicons color={iconColor} name={icon} size={sizing.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
});
