import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLTypography } from '@/constants/theme';
import { ManufacturerBrandMark } from './manufacturer-brand-mark';

/** The same measured manufacturer row in the Session and the crop reviewer. */
export function SessionEquipmentContext({ selected, manufacturer, name, variant, domain = 'machine', onSwapEquipment }: {
  selected: boolean; manufacturer?: string | null; name?: string | null; variant?: string | null;
  domain?: 'machine' | 'cable';
  onSwapEquipment?: () => void;
}) {
  return <View style={[s.context, !selected && s.required]}>
    <ManufacturerBrandMark compact manufacturerName={manufacturer} />
    <View style={s.copy}>
      <Text style={s.eyebrow}>{selected ? 'CURRENT EQUIPMENT' : 'EQUIPMENT NEEDED'}</Text>
      <Text numberOfLines={2} style={s.name}>{selected ? name || 'Other' : `Choose the ${domain === 'cable' ? 'cable station' : 'machine'} you are using`}</Text>
      {!selected || variant ? <Text numberOfLines={2} style={s.meta}>{selected
        ? variant
        : domain === 'cable' ? 'Manufacturer and type identify your cable station.'
          : 'Manufacturer and type keep machine history comparable.'}</Text> : null}
    </View>
    {selected && onSwapEquipment ? <Pressable accessibilityRole="button" accessibilityLabel="Swap equipment"
      accessibilityHint="Change the equipment used for this movement" onPress={onSwapEquipment}
      style={({ pressed }) => [s.swap, pressed && s.pressed]}>
      <Ionicons name="swap-horizontal" size={18} color="#c8a6ff" />
      <Text style={s.swapLabel}>Swap</Text>
    </Pressable> : null}
  </View>;
}
const s = StyleSheet.create({
  context: { marginTop: 16, marginHorizontal: 26, paddingTop: 14, paddingBottom: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(167,139,250,0.16)',
    flexDirection: 'row', alignItems: 'center', gap: 12 },
  required: { borderColor: 'rgba(251,146,60,0.28)' }, copy: { flex: 1, gap: 2 },
  eyebrow: { color: SLColors.review, fontSize: SLTypography.micro.fontSize, fontWeight: '900', letterSpacing: 0.7 },
  name: { color: SLColors.textStrong, fontSize: SLTypography.label.fontSize, lineHeight: 20, fontWeight: '900' },
  meta: { color: SLColors.textMuted, fontSize: SLTypography.caption.fontSize, lineHeight: 17 },
  swap: { minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  swapLabel: { color: '#c8a6ff', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
