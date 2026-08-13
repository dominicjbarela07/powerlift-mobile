import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLColors, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';
import { SLMaterialOverlay } from './sl-workspace';

type IconName = keyof typeof Ionicons.glyphMap;

type CoachAction = {
  label: string;
  icon: IconName;
  onPress?: () => void;
  tone?: SLStatusTone;
  disabled?: boolean;
};

type CoachActionGridProps = {
  actions: CoachAction[];
  columns?: 2 | 3;
  style?: StyleProp<ViewStyle>;
};

export function CoachActionGrid({ actions, columns = 2, style }: CoachActionGridProps) {
  return (
    <View style={[styles.grid, style]}>
      {actions.map((action) => {
        const tone = SLStatusTones[action.tone ?? 'neutral'];
        return (
          <Pressable
            accessibilityLabel={action.label}
            accessibilityRole="button"
            disabled={action.disabled}
            key={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.action,
              {
                flexBasis: columns === 3 ? '31%' : '48%',
                opacity: action.disabled ? 0.45 : pressed ? 0.78 : 1,
              },
            ]}
          >
            <SLMaterialOverlay compact level={2} />
            <View style={[styles.iconWrap, { backgroundColor: tone.background, borderColor: tone.border }]}>
              <Ionicons color={tone.icon} name={action.icon} size={18} />
            </View>
            <Text numberOfLines={2} style={styles.label}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLSpacing.sm,
  },
  action: {
    alignItems: 'center',
    backgroundColor: SLColors.surface,
    borderColor: SLColors.border,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: SLSpacing.sm,
    minHeight: 92,
    overflow: 'hidden',
    padding: SLSpacing.md,
    position: 'relative',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: SLRadius.md,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  label: {
    color: SLColors.text,
    fontFamily: SLTypography.caption.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: SLTypography.caption.fontWeight,
    letterSpacing: 0,
    lineHeight: SLTypography.caption.lineHeight,
    textAlign: 'center',
  },
});
