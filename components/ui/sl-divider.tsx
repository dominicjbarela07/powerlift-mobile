import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SLColors } from '@/constants/theme';

type Props = {
  inset?: number;
  strong?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SLDivider({ inset = 0, strong = false, style }: Props) {
  return <View style={[styles.divider, strong && styles.strong, { marginLeft: inset }, style]} />;
}

const styles = StyleSheet.create({
  divider: { backgroundColor: SLColors.borderHairline, height: StyleSheet.hairlineWidth },
  strong: { backgroundColor: SLColors.borderSubtle },
});
