import { Ionicons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLColors, SLControlSize, SLIconSize, SLSpacing, SLTypography } from '@/constants/theme';
import { SLMotionPressable } from './sl-motion';

type Props = {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  disclosure?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SLListRow({ title, subtitle, meta, leading, trailing, disclosure, disabled, onPress, style }: Props) {
  return (
    <SLMotionPressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, style]}
    >
      {leading}
      <View style={styles.copy}>
        <Text numberOfLines={1} typographyRole="bodyStrong" style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} typographyRole="supportingBody" style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text numberOfLines={1} typographyRole="caption" style={styles.meta}>{meta}</Text> : null}
      </View>
      {trailing}
      {disclosure && !trailing ? <Ionicons color={SLColors.textSubtle} name="chevron-forward" size={SLIconSize.standard} /> : null}
    </SLMotionPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomColor: SLColors.borderHairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SLSpacing.md,
    minHeight: SLControlSize.listRow,
    paddingHorizontal: SLSpacing.sm,
    paddingVertical: SLSpacing.sm,
  },
  copy: { flex: 1, gap: SLSpacing.xxs, minWidth: 0 },
  title: { ...SLTypography.rowTitle, color: SLColors.textStrong },
  subtitle: { ...SLTypography.rowMeta, color: SLColors.textMuted },
  meta: { ...SLTypography.rowMeta, color: SLColors.textSubtle },
});
