import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';
import { SLMaterialOverlay } from './sl-workspace';

type IconName = keyof typeof Ionicons.glyphMap;
type PillSize = 'sm' | 'md';

type SLStatusPillProps = {
  label: string;
  tone?: SLStatusTone;
  icon?: IconName;
  size?: PillSize;
  style?: StyleProp<ViewStyle>;
};

export function SLStatusPill({ label, tone = 'neutral', icon, size = 'sm', style }: SLStatusPillProps) {
  const palette = SLStatusTones[tone];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          paddingHorizontal: isSmall ? SLSpacing.sm : SLSpacing.md,
          paddingVertical: isSmall ? 3 : 5,
        },
        style,
      ]}
    >
      <SLMaterialOverlay compact level={2} />
      {icon ? <Ionicons color={palette.icon} name={icon} size={isSmall ? 12 : 14} /> : null}
      <Text
        numberOfLines={1}
        typographyRole="badge"
        style={[
          styles.label,
          {
            color: palette.text,
            fontSize: isSmall ? SLTypography.micro.fontSize : SLTypography.caption.fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.xs,
    maxWidth: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  label: {
    fontFamily: SLTypography.chipLabel.fontFamily,
    fontWeight: SLTypography.chipLabel.fontWeight,
    letterSpacing: 0,
  },
});
