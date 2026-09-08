import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SLMotionPressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLLayout, SLSpacing } from '@/constants/theme';

export function MeetModeHeader({ onReturn }: { onReturn: () => void }) {
  return (
    <View style={styles.header} testID="meet-mode-header">
      <SLMotionPressable
        accessibilityHint="Returns to the Strength Ledger screen you entered Meet Mode from."
        accessibilityLabel="Return to Strength Ledger"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onReturn}
        style={styles.returnAction}
        testID="meet-mode-return"
      >
        <Ionicons color={SLColors.warning} name="chevron-back" size={19} />
        <Text numberOfLines={1} style={styles.returnLabel}>Strength Ledger</Text>
      </SLMotionPressable>
      <View style={styles.identity}>
        <View style={styles.identityRule} />
        <Text style={styles.identityLabel}>MEET MODE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: SLColors.canvas,
    borderBottomColor: SLColors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: SLLayout.screenGutter,
  },
  returnAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.xxs,
    minHeight: 44,
    paddingRight: SLSpacing.sm,
  },
  returnLabel: {
    color: SLColors.textStrong,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.xs,
  },
  identityRule: {
    backgroundColor: SLColors.warning,
    borderRadius: 2,
    height: 2,
    width: 14,
  },
  identityLabel: {
    color: SLColors.warning,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    lineHeight: 14,
  },
});

