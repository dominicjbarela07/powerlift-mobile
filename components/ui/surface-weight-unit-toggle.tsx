import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SLMotionPressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import type { DisplayWeightUnit } from '@/lib/display-units';

export function SurfaceWeightUnitToggle({
  unit,
  onChange,
  compact = false,
  style,
  testID = 'surface-weight-unit-toggle',
}: {
  unit: DisplayWeightUnit;
  onChange: (unit: DisplayWeightUnit) => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View accessibilityLabel={`Display weight unit. ${unit} selected.`} style={[styles.shell, compact && styles.shellCompact, style]} testID={testID}>
      {(['lb', 'kg'] as const).map((option) => {
        const active = option === unit;
        return (
          <SLMotionPressable
            accessibilityLabel={`Show weights in ${option === 'lb' ? 'pounds' : 'kilograms'}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={option}
            onPress={() => onChange(option)}
            style={[styles.option, compact && styles.optionCompact, active && styles.optionActive]}
            testID={`${testID}-${option}`}
          >
            <Text style={[styles.label, compact && styles.labelCompact, active && styles.labelActive]}>{option}</Text>
          </SLMotionPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13, 10, 19, 0.96)',
    borderColor: 'rgba(167, 101, 255, 0.42)',
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  shellCompact: { padding: 2 },
  option: {
    alignItems: 'center',
    borderRadius: SLRadius.pill,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 48,
    paddingHorizontal: 12,
  },
  optionCompact: { minHeight: 30, minWidth: 40, paddingHorizontal: 9 },
  optionActive: { backgroundColor: 'rgba(126, 58, 185, 0.72)' },
  label: { ...SLTypography.label, color: SLColors.textMuted, textTransform: 'lowercase' },
  labelCompact: { fontSize: 13 },
  labelActive: { color: SLColors.textPrimary },
});
