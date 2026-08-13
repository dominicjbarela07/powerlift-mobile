import React, { type ReactNode } from 'react';
import { type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { SLSurface, type SLSurfaceLevel } from './sl-workspace';

type CardVariant = 'default' | 'outline' | 'flat' | 'inset';

type SLCardProps = {
  children: ReactNode;
  variant?: CardVariant;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const variantLevels: Record<CardVariant, SLSurfaceLevel> = {
  default: 2,
  outline: 2,
  flat: 1,
  inset: 1,
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
  return (
    <SLSurface
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      interactive={Boolean(onPress)}
      level={variantLevels[variant]}
      onPress={onPress}
      style={style}
      contentStyle={contentStyle}
    >
      {children}
    </SLSurface>
  );
}
