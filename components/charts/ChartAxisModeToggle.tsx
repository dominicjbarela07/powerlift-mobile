import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import type { AnalyticalXDomainMode } from '@/lib/chart-fidelity';

export function ChartAxisModeToggle({
  value,
  onChange,
  testID,
}: {
  value: AnalyticalXDomainMode;
  onChange: (value: AnalyticalXDomainMode) => void;
  testID?: string;
}) {
  return <View accessibilityRole="tablist" style={styles.control} testID={testID}>
    {([
      ['chronological', 'TIME'],
      ['observationIndex', 'INSTANCES'],
    ] as const).map(([mode, label]) => {
      const selected = value === mode;
      return <Pressable
        accessibilityLabel={`${label.toLowerCase()} history axis`}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        key={mode}
        onPress={() => onChange(mode)}
        style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
      >
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  control: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#363A46',
    backgroundColor: '#080A10',
    padding: 2,
  },
  option: {
    minHeight: 30,
    minWidth: 48,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  optionSelected: {
    backgroundColor: '#2A1439',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9857D2',
  },
  label: { color: '#818692', fontSize: 9, fontWeight: '800', letterSpacing: 0.55 },
  labelSelected: { color: '#E0C2FF' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
