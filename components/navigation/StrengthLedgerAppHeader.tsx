import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { SLColors, SLLayout, SLRadius } from '@/constants/theme';

export const STRENGTH_LEDGER_APP_HEADER = {
  contentHeight: 42,
  controlSize: 40,
  brandWidth: 110,
  brandHeight: 22,
} as const;

export type StrengthLedgerAppHeaderAction = {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  showNotificationDot?: boolean;
};

export function StrengthLedgerAppHeader({
  brandAccessibilityLabel = 'Open Home',
  leftAction,
  onBrandPress,
  rightAction,
  topInset = 0,
}: {
  brandAccessibilityLabel?: string;
  leftAction: StrengthLedgerAppHeaderAction;
  onBrandPress: () => void;
  rightAction: StrengthLedgerAppHeaderAction;
  topInset?: number;
}) {
  return (
    <ThemedView style={[styles.shell, { paddingTop: Math.max(0, topInset) }]}>
      <View style={styles.row}>
        <HeaderAction action={leftAction} />
        <TouchableOpacity
          accessibilityLabel={brandAccessibilityLabel}
          accessibilityRole="button"
          onPress={onBrandPress}
          style={styles.brandButton}
        >
          <Image source={require('@/assets/images/16:9.png')} style={styles.brand} />
        </TouchableOpacity>
        <HeaderAction action={rightAction} />
      </View>
    </ThemedView>
  );
}

function HeaderAction({ action }: { action: StrengthLedgerAppHeaderAction }) {
  return (
    <TouchableOpacity
      accessibilityLabel={action.accessibilityLabel}
      accessibilityRole="button"
      onPress={action.onPress}
      style={styles.action}
    >
      <Ionicons color={SLColors.text} name={action.icon} size={action.size ?? 21} />
      {action.showNotificationDot ? <View style={styles.notificationDot} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'transparent',
    borderBottomColor: SLColors.shellHairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SLLayout.screenGutter,
  },
  row: {
    height: STRENGTH_LEDGER_APP_HEADER.contentHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  action: {
    width: STRENGTH_LEDGER_APP_HEADER.controlSize,
    height: STRENGTH_LEDGER_APP_HEADER.controlSize,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: SLRadius.radiusRow,
    backgroundColor: SLColors.surfaceFlat,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  brandButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    width: STRENGTH_LEDGER_APP_HEADER.brandWidth,
    height: STRENGTH_LEDGER_APP_HEADER.brandHeight,
    resizeMode: 'contain',
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.danger,
    borderWidth: 1,
    borderColor: SLColors.shellCanvas,
  },
});
