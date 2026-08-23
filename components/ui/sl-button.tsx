import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  type GestureResponderEvent,
  type AccessibilityState,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLColors, SLGradients, SLIconSize, SLOpacity, SLRadius, SLShadows, SLSpacing, SLTypography, type SLTypographyRole } from '@/constants/theme';
import { SLMotionPressable } from './sl-motion';
import { SLMaterialOverlay } from './sl-workspace';

type IconName = keyof typeof Ionicons.glyphMap;
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type SLButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: IconName;
  iconRight?: IconName;
  iconRightPosition?: 'inline' | 'edge';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  labelTypographyRole?: Extract<SLTypographyRole, 'shortButtonLabel' | 'longButtonLabel'>;
  disableNativePressAnimation?: boolean;
};

const variantStyles: Record<ButtonVariant, { bg: string; border: string; text: string; icon: string }> = {
  primary: {
    bg: SLColors.focusRaised,
    border: SLColors.borderFocus,
    text: SLColors.textPrimary,
    icon: SLColors.textPrimary,
  },
  secondary: {
    bg: SLColors.object,
    border: SLColors.borderStandard,
    text: SLColors.text,
    icon: SLColors.text,
  },
  ghost: {
    bg: 'transparent',
    border: 'transparent',
    text: SLColors.textMuted,
    icon: SLColors.textMuted,
  },
  danger: {
    bg: SLColors.surfaceDestructive,
    border: SLColors.danger,
    text: SLColors.danger,
    icon: SLColors.danger,
  },
};

const sizeStyles: Record<ButtonSize, { minHeight: number; padding: number; verticalPadding: number; fontSize: number; icon: number }> = {
  sm: { minHeight: 44, padding: SLSpacing.md, verticalPadding: SLSpacing.sm, fontSize: SLTypography.buttonLabel.fontSize, icon: SLIconSize.compact },
  md: { minHeight: 50, padding: SLSpacing.lg, verticalPadding: SLSpacing.sm, fontSize: SLTypography.buttonLabel.fontSize, icon: 17 },
  lg: { minHeight: 56, padding: SLSpacing.xl, verticalPadding: SLSpacing.md, fontSize: SLTypography.rowTitle.fontSize, icon: 19 },
};

export function SLButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  iconRightPosition = 'inline',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityState,
  labelTypographyRole,
  disableNativePressAnimation = false,
}: SLButtonProps) {
  const [pressed, setPressed] = useState(false);
  const palette = variantStyles[variant];
  const sizing = sizeStyles[size];
  const isDisabled = disabled || loading;
  const resolvedLabelRole = labelTypographyRole ?? (/\s/.test(label.trim()) || label.length > 10
    ? 'longButtonLabel'
    : 'shortButtonLabel');

  return (
    <SLMotionPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      disableNativePressAnimation={disableNativePressAnimation}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          minHeight: sizing.minHeight,
          opacity: isDisabled ? SLOpacity.loading : 1,
          paddingHorizontal: sizing.padding,
          paddingVertical: sizing.verticalPadding,
          width: fullWidth ? '100%' : undefined,
        },
        style,
        variant === 'primary'
          ? pressed ? SLShadows.pressedLevel3 : SLShadows.level3
          : variant === 'ghost'
            ? null
            : pressed ? SLShadows.pressedLevel2 : SLShadows.level2,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={pressed ? SLGradients.primaryPressed : SLGradients.primary}
          end={{ x: 1, y: 1 }}
          locations={SLGradients.primaryLocations}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      {variant !== 'ghost' ? (
        <SLMaterialOverlay compact level={variant === 'primary' ? 3 : 2} pressed={pressed} />
      ) : null}
      {loading ? (
        <ActivityIndicator color={palette.icon} size="small" />
      ) : (
        <>
          {iconLeft ? <Ionicons color={palette.icon} name={iconLeft} size={sizing.icon} /> : null}
          <Text
            maxFontSizeMultiplier={1.35}
            numberOfLines={resolvedLabelRole === 'longButtonLabel' ? 2 : 1}
            typographyRole={resolvedLabelRole}
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
          {iconRight ? (
            <Ionicons
              color={palette.icon}
              name={iconRight}
              size={sizing.icon}
              style={iconRightPosition === 'edge' ? styles.iconRightEdge : undefined}
            />
          ) : null}
        </>
      )}
    </SLMotionPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: SLRadius.radiusControl,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  iconRightEdge: {
    position: 'absolute',
    right: SLSpacing.xl,
  },
  label: {
    fontFamily: SLTypography.buttonLabel.fontFamily,
    fontWeight: SLTypography.buttonLabel.fontWeight,
    letterSpacing: SLTypography.buttonLabel.letterSpacing,
    lineHeight: SLTypography.buttonLabel.lineHeight,
  },
});
