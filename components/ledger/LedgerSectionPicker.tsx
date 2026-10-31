import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { LEDGER as T } from '@/constants/ledger';

/** A quiet continuous selector, with one selected position and no boxed tiles. */
export function LedgerSectionPicker<K extends string>({ items, value, onChange, testID }: {
  items: readonly { key: K; label: string; accessibilityLabel?: string; testID?: string }[];
  value: K; onChange: (key: K) => void; testID?: string;
}) {
  return <View accessibilityRole="tablist" testID={testID} style={s.rail}>{items.map(item => <Pressable
    key={item.key} testID={item.testID} accessibilityRole="tab" accessibilityLabel={item.accessibilityLabel??item.label}
    accessibilityState={{ selected: value === item.key }} onPress={()=>onChange(item.key)} style={s.target}>
    <Text style={[s.label,value===item.key&&s.selected]}>{item.label}</Text>
    <View style={[s.marker,value===item.key&&s.markerSelected]}/>
  </Pressable>)}</View>;
}
const s=StyleSheet.create({
 rail:{flexDirection:'row',gap:8,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:T.colors.line},
 target:{flex:1,minWidth:0,minHeight:46,alignItems:'center',justifyContent:'center',gap:9,paddingTop:8},
 label:{fontFamily:T.fonts.bodyMedium,fontSize:T.type.small,color:T.colors.muted},
 selected:{fontFamily:T.fonts.bodySemiBold,color:T.colors.text},
 marker:{height:2,width:24,backgroundColor:'transparent',borderRadius:T.radius.xs},
 markerSelected:{backgroundColor:T.colors.accent}
});
