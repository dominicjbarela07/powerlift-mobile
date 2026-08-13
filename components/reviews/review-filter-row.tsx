import React from 'react';
import { ScrollView, StyleSheet, Pressable } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';

export type ReviewFilterOption = { value: string; label: string };

export function ReviewFilterRow({
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  options: ReviewFilterOption[];
  selected: string;
  onSelect: (value: string) => void;
  accessibilityLabel: string;
}) {
  return (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: SLSpacing.sm, paddingRight: SLSpacing.lg },
  chip: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderStandard,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: SLColors.accentSoft, borderColor: SLColors.borderFocus },
  pressed: { opacity: 0.78 },
  label: { color: SLColors.textMuted, fontSize: 14, fontWeight: '600' },
  labelActive: { color: SLColors.accentMuted },
});
