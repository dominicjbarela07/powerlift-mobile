import React from 'react';
import { Text, type TextProps, TextStyle } from 'react-native';
import { typography } from '@/theme';

export type Variant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyMuted'
  | 'label'
  | 'small'
  | 'kpi'
  | 'badge'
  | 'error';

export type ThemedTextProps = TextProps & {
  variant?: Variant;
  style?: TextStyle | TextStyle[];
  lightColor?: string;
  darkColor?: string;
};

function stripColor(style?: TextStyle | TextStyle[]): TextStyle | TextStyle[] | undefined {
  if (!style) return style;
  if (Array.isArray(style)) {
    return style.map((s) => {
      if (!s) return s;
      // @ts-ignore - allow partial style objects
      const { color, ...rest } = s as any;
      return rest as TextStyle;
    });
  }
  // @ts-ignore - allow partial style objects
  const { color, ...rest } = style as any;
  return rest as TextStyle;
}

export function ThemedText({
  variant = 'body',
  style,
  lightColor,
  darkColor,
  ...rest
}: ThemedTextProps) {
  const base = typography[variant] ?? typography.body;

  const safeStyle = stripColor(style);

  return (
    <Text
      {...rest}
      style={[
        base,
        safeStyle,
      ]}
    />
  );
}
