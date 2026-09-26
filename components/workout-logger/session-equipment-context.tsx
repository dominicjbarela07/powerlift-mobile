import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLTypography } from '@/constants/theme';
import { ManufacturerBrandMark } from './manufacturer-brand-mark';

/** The same measured manufacturer row in the Session and the crop reviewer. */
export function SessionEquipmentContext({ selected, manufacturer, name, variant, domain = 'machine' }: {
  selected: boolean; manufacturer?: string | null; name?: string | null; variant?: string | null;
  domain?: 'machine' | 'cable';
}) {
  return <View style={[s.context, !selected && s.required]}>
    <ManufacturerBrandMark compact manufacturerName={manufacturer} />
    <View style={s.copy}>
      <Text style={s.eyebrow}>{selected ? 'CURRENT EQUIPMENT' : 'EQUIPMENT NEEDED'}</Text>
      <Text numberOfLines={2} style={s.name}>{selected ? name || 'Other' : `Choose the ${domain === 'cable' ? 'cable station' : 'machine'} you are using`}</Text>
      <Text numberOfLines={2} style={s.meta}>{selected
        ? [manufacturer || 'Other', variant].filter(Boolean).join(' · ')
        : domain === 'cable' ? 'Manufacturer and type identify your cable station.'
          : 'Manufacturer and type keep machine history comparable.'}</Text>
    </View>
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
});
