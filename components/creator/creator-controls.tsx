import React, { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export type CreatorOption<T extends string | number> = {
  value: T;
  label: string;
};

type CreatorSegmentedControlProps<T extends string> = {
  options: Array<CreatorOption<T>>;
  value: T;
  onChange: (value: T) => void;
};

export function CreatorSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: CreatorSegmentedControlProps<T>) {
  return (
    <View style={styles.segmentedRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segmentBtn, selected && styles.segmentBtnActive]}
            onPress={() => onChange(option.value)}
          >
            <ThemedText variant="badge" style={[styles.segmentText, selected && styles.segmentTextActive]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

type CreatorStepperProps = {
  label: string;
  value: number | null | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function CreatorStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
}: CreatorStepperProps) {
  const current = Number.isFinite(Number(value)) ? Number(value) : 0;
  const nextDown = Math.max(min, current - step);
  const nextUp = Math.min(max, current + step);

  return (
    <View style={styles.controlBlock}>
      <ThemedText variant="bodyMuted" style={styles.controlLabel}>{label}</ThemedText>
      <View style={styles.stepperRow}>
        <Pressable
          style={[styles.stepperBtn, current <= min && styles.controlDisabled]}
          disabled={current <= min}
          onPress={() => onChange(nextDown)}
        >
          <ThemedText variant="h3" style={styles.stepperText}>-</ThemedText>
        </Pressable>
        <ThemedText variant="h3" style={styles.stepperValue}>{current}</ThemedText>
        <Pressable
          style={[styles.stepperBtn, current >= max && styles.controlDisabled]}
          disabled={current >= max}
          onPress={() => onChange(nextUp)}
        >
          <ThemedText variant="h3" style={styles.stepperText}>+</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

type CreatorRpeSelectorProps = {
  value: number | null | undefined;
  onChange: (value: number) => void;
};

export function CreatorRpeSelector({ value, onChange }: CreatorRpeSelectorProps) {
  return (
    <CreatorChoiceChips
      options={RPE_OPTIONS.map((option) => ({ value: option, label: String(option) }))}
      value={Number(value)}
      onChange={onChange}
    />
  );
}

type CreatorChoiceChipsProps<T extends string | number> = {
  options: Array<CreatorOption<T>>;
  value: T | null | undefined;
  onChange: (value: T) => void;
};

export function CreatorChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
}: CreatorChoiceChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chipSelectorContent}
      style={styles.chipSelectorScroll}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={String(option.value)}
            style={[styles.choiceChip, selected && styles.choiceChipActive]}
            onPress={() => onChange(option.value)}
          >
            <ThemedText variant="badge" style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type CreatorAdvancedSectionProps = {
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
};

export function CreatorAdvancedSection({
  open,
  onToggle,
  children,
}: CreatorAdvancedSectionProps) {
  return (
    <View style={styles.advancedWrap}>
      <Pressable style={styles.advancedHeader} onPress={onToggle}>
        <ThemedText variant="body" style={styles.advancedTitle}>Advanced (optional)</ThemedText>
        <ThemedText variant="bodyMuted" style={styles.advancedChevron}>{open ? '⌃' : '⌄'}</ThemedText>
      </Pressable>

      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedRow: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.14)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.42)',
    padding: 3,
    flexDirection: 'row',
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.34)',
  },
  segmentText: {
    color: '#A8A29E',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  controlBlock: {
    flex: 1,
  },
  controlLabel: {
    marginBottom: 6,
    color: '#A8A29E',
    fontSize: 12,
    fontWeight: '700',
  },
  stepperRow: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.14)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.4)',
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,16,28,0.34)',
  },
  controlDisabled: {
    opacity: 0.35,
  },
  stepperText: {
    color: '#C4B5FD',
    fontWeight: '800',
  },
  stepperValue: {
    minWidth: 30,
    color: '#F8FAFC',
    textAlign: 'center',
    fontWeight: '800',
  },
  chipSelectorScroll: {
    flexGrow: 0,
  },
  chipSelectorContent: {
    gap: 8,
    paddingRight: 4,
  },
  choiceChip: {
    minWidth: 48,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.16)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  choiceChipActive: {
    borderColor: 'rgba(139,92,246,0.5)',
    backgroundColor: 'rgba(139,92,246,0.34)',
  },
  choiceChipText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  choiceChipTextActive: {
    color: '#FFFFFF',
  },
  advancedWrap: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
    paddingTop: 8,
  },
  advancedHeader: {
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advancedTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  advancedChevron: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
});
