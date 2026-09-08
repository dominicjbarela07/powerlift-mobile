import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoggerSheetHeader } from '@/components/workout-logger/logger-primitives';
import {
  SLButton,
  SLCompactDropdown,
  SLContextualHeader,
  SLListRow,
  SLQueueRow,
  SLScrollScreen,
  SLSectionHeader,
} from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import { MOBILE_TEXT_STRESS_FIXTURES } from '@/lib/mobile-text-layout-core';

export default function MobileTextLayoutLab() {
  const params = useLocalSearchParams<{ unit?: string }>();
  const [unit, setUnit] = useState<'kg' | 'lb'>(params.unit === 'kg' ? 'kg' : 'lb');
  const [equipment, setEquipment] = useState('prime');

  if (!__DEV__) return null;

  return (
    <SLScrollScreen contentContainerStyle={styles.content} edges="top" padded={false} testID="mobile-text-layout-lab">
      <SLContextualHeader
        breadcrumb="DEV · TEXT LAYOUT"
        subtitle={MOBILE_TEXT_STRESS_FIXTURES.dateRange}
        title={MOBILE_TEXT_STRESS_FIXTURES.sessionTitle}
      />

      <View style={styles.section}>
        <SLSectionHeader
          actionLabel="Review all evidence"
          onActionPress={() => undefined}
          subtitle={MOBILE_TEXT_STRESS_FIXTURES.blockTitle}
          title={MOBILE_TEXT_STRESS_FIXTURES.programTitle}
        />
        <SLListRow
          disclosure
          meta={MOBILE_TEXT_STRESS_FIXTURES.dateRange}
          subtitle={MOBILE_TEXT_STRESS_FIXTURES.equipmentIdentity}
          title={MOBILE_TEXT_STRESS_FIXTURES.movementTitles[0]}
        />
        <SLQueueRow
          athleteName={MOBILE_TEXT_STRESS_FIXTURES.athleteName}
          meta={MOBILE_TEXT_STRESS_FIXTURES.status}
          rightLabel={MOBILE_TEXT_STRESS_FIXTURES.decimalKgValue}
          subtitle={MOBILE_TEXT_STRESS_FIXTURES.equipmentIdentity}
          title={MOBILE_TEXT_STRESS_FIXTURES.movementTitles[1]}
          variant="priority"
        />
      </View>

      <View style={styles.loggerSheet}>
        <View style={styles.handle} />
        <LoggerSheetHeader
          onUnitChange={setUnit}
          supporting={unit === 'kg'
            ? 'Prescribed: 212.5 kg × 12 @9.5 RPE · 3-second eccentric · 2-second pause'
            : MOBILE_TEXT_STRESS_FIXTURES.prescribedLoad}
          title={MOBILE_TEXT_STRESS_FIXTURES.loggerTitle}
          unit={unit}
        />
        <View style={styles.metricRow}>
          <View style={styles.metricCopy}>
            <Text typographyRole="shortTechnicalLabel" style={styles.metricLabel}>PERFORMED LOAD</Text>
            <Text typographyRole="numeric" style={styles.metricValue}>
              {unit === 'kg' ? MOBILE_TEXT_STRESS_FIXTURES.decimalKgValue : MOBILE_TEXT_STRESS_FIXTURES.fourDigitLbValue}
            </Text>
          </View>
          <SLCompactDropdown
            accessibilityLabel="Equipment identity"
            label={MOBILE_TEXT_STRESS_FIXTURES.equipmentIdentity}
            onValueChange={setEquipment}
            options={[
              { value: 'prime', label: MOBILE_TEXT_STRESS_FIXTURES.equipmentIdentity },
              { value: 'standard', label: 'Standard Barbell' },
            ]}
            style={styles.equipmentPicker}
            value={equipment}
          />
        </View>
        <SLButton fullWidth iconRight="chevron-forward" iconRightPosition="edge" label={MOBILE_TEXT_STRESS_FIXTURES.actionLabel} onPress={() => undefined} />
      </View>

      <View style={styles.section}>
        <SLSectionHeader title="Movement title wrapping" />
        {MOBILE_TEXT_STRESS_FIXTURES.movementTitles.slice(2).map((title) => (
          <SLListRow disclosure key={title} subtitle={MOBILE_TEXT_STRESS_FIXTURES.comparisonValue} title={title} />
        ))}
      </View>
    </SLScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    backgroundColor: SLColors.canvas,
    gap: SLSpacing.lg,
    paddingBottom: 120,
  },
  section: {
    gap: SLSpacing.sm,
    paddingHorizontal: SLSpacing.md,
  },
  loggerSheet: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    gap: SLSpacing.lg,
    marginHorizontal: SLSpacing.md,
    padding: SLSpacing.lg,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: SLColors.borderStrong,
    borderRadius: SLRadius.pill,
    height: 4,
    width: 42,
  },
  metricRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLSpacing.md,
  },
  metricCopy: {
    flex: 1,
    gap: SLSpacing.xxs,
    minWidth: 132,
  },
  metricLabel: {
    color: SLColors.textMuted,
  },
  metricValue: {
    color: SLColors.textStrong,
  },
  equipmentPicker: {
    minHeight: 44,
    width: '100%',
  },
});
