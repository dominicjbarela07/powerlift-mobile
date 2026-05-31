import React, { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLColors, SLRadius, SLShadows, SLSpacing } from '@/constants/theme';

type CardVariant = 'default' | 'raised' | 'muted' | 'outline' | 'flat' | 'command' | 'hero' | 'inset';

type SLCardProps = {
  children: ReactNode;
  variant?: CardVariant;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const variants: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: SLColors.surface,
    borderColor: SLColors.border,
    borderRadius: SLRadius.radiusCard,
  },
  raised: {
    backgroundColor: SLColors.surfaceRaised,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.radiusCard,
    ...SLShadows.card,
  },
  muted: {
    backgroundColor: SLColors.surfaceMuted,
    borderColor: SLColors.border,
    borderRadius: SLRadius.radiusCard,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.radiusCard,
  },
  flat: {
    backgroundColor: SLColors.surfaceFlat,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusRow,
  },
  command: {
    backgroundColor: SLColors.surfaceCommand,
    borderColor: SLColors.borderDefault,
    borderRadius: SLRadius.radiusHero,
    ...SLShadows.shadowCommand,
  },
  hero: {
    backgroundColor: SLColors.gradientHeroStart,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.radiusHero,
    ...SLShadows.shadowCommand,
  },
  inset: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderHairline,
    borderRadius: SLRadius.radiusControl,
  },
};

export function SLCard({
  children,
  variant = 'default',
  onPress,
  disabled = false,
  style,
  contentStyle,
  accessibilityLabel,
}: SLCardProps) {
  const body = <View style={[styles.content, contentStyle]}>{children}</View>;

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          variants[variant],
          {
            opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
          },
          style,
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={[styles.card, variants[variant], style]}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    padding: SLSpacing.lg,
  },
});
