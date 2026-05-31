import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type ButtonVariant = 'primary' | 'primarySoft' | 'secondary' | 'utility' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type SLButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

const variantStyles: Record<ButtonVariant, { bg: string; border: string; text: string; icon: string }> = {
  primary: {
    bg: SLColors.accentSteel,
    border: SLColors.accentSteel,
    text: SLColors.textInverted,
    icon: SLColors.textInverted,
  },
  primarySoft: {
    bg: SLColors.accentSteelSoft,
    border: SLColors.borderSelected,
    text: SLColors.textStrong,
    icon: SLColors.accentViolet,
  },
  secondary: {
    bg: SLColors.surfaceRaised,
    border: SLColors.borderStrong,
    text: SLColors.text,
    icon: SLColors.text,
  },
  utility: {
    bg: SLColors.surfaceFlat,
    border: SLColors.borderSubtle,
    text: SLColors.text,
    icon: SLColors.accentSteel,
  },
  ghost: {
    bg: 'transparent',
    border: 'transparent',
    text: SLColors.textMuted,
    icon: SLColors.textMuted,
  },
  danger: {
    bg: SLColors.dangerSoft,
    border: '#DC2626',
    text: '#FECACA',
    icon: SLColors.danger,
  },
};

const sizeStyles: Record<ButtonSize, { height: number; padding: number; fontSize: number; icon: number }> = {
  sm: { height: 34, padding: SLSpacing.md, fontSize: 12, icon: 15 },
  md: { height: 42, padding: SLSpacing.lg, fontSize: SLTypography.buttonLabel.fontSize, icon: 17 },
  lg: { height: 50, padding: SLSpacing.xl, fontSize: 14, icon: 19 },
};

export function SLButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
}: SLButtonProps) {
  const palette = variantStyles[variant];
  const sizing = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          height: sizing.height,
          opacity: isDisabled ? 0.55 : pressed ? 0.82 : 1,
          paddingHorizontal: sizing.padding,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.icon} size="small" />
      ) : (
        <>
          {iconLeft ? <Ionicons color={palette.icon} name={iconLeft} size={sizing.icon} /> : null}
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: palette.text,
                fontSize: sizing.fontSize,
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {iconRight ? <Ionicons color={palette.icon} name={iconRight} size={sizing.icon} /> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'center',
  },
  label: {
    fontFamily: SLTypography.buttonLabel.fontFamily,
    fontWeight: SLTypography.buttonLabel.fontWeight,
    letterSpacing: SLTypography.buttonLabel.letterSpacing,
    lineHeight: SLTypography.buttonLabel.lineHeight,
  },
});
