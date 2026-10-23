import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies } from '@/constants/theme';

export function OnboardingProgress({ step }: { step: 1 | 2 | 3 }) {
  return <View accessibilityLabel={`Setup step ${step} of 3`} style={s.row}>
    {['Account', 'Verify email', 'Start trial'].map((label, index) => <View key={label} style={s.step}>
      <View style={[s.dot, index + 1 <= step && s.current]}><Text style={s.number}>{index + 1 < step ? '✓' : index + 1}</Text></View>
      <Text style={[s.label, index + 1 === step && s.active]}>{label}</Text>
    </View>)}
  </View>;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  step: { flex: 1, gap: 8 },
  dot: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: SLColors.borderDefault, alignItems: 'center', justifyContent: 'center' },
  current: { borderColor: SLColors.accentViolet, backgroundColor: SLColors.surfaceInset },
  number: { fontSize: 12, color: SLColors.textStrong },
  label: { fontFamily: SLFontFamilies.sans, fontSize: 12, color: SLColors.textMuted },
  active: { color: SLColors.textStrong },
});
