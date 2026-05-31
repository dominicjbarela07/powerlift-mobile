import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type Priority = 'high' | 'medium' | 'low' | 'neutral';

type SLPriorityBadgeProps = {
  priority?: Priority;
  label?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

const priorityTone: Record<Priority, SLStatusTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'info',
  neutral: 'neutral',
};

const priorityLabel: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  neutral: 'Normal',
};

export function SLPriorityBadge({
  priority = 'neutral',
  label,
  icon = 'flag',
  style,
}: SLPriorityBadgeProps) {
  const palette = SLStatusTones[priorityTone[priority]];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <Ionicons color={palette.icon} name={icon} size={12} />
      <Text numberOfLines={1} style={[styles.label, { color: palette.text }]}>
        {label ?? priorityLabel[priority]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.xs,
    maxWidth: '100%',
    paddingHorizontal: SLSpacing.sm,
    paddingVertical: 3,
  },
  label: {
    fontFamily: SLTypography.micro.fontFamily,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: SLTypography.micro.fontWeight,
    letterSpacing: 0,
  },
});
