import React from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/sl-text';
import { SLMotionPressable } from '@/components/ui/sl-motion';
import { LEDGER as T } from '@/constants/ledger';
import { LEDGER_CHAPTERS, type LedgerSection } from '@/lib/ledger-navigation';
const C = T.colors;

/** One visible primary level; contextual filters live with their own content. */
export function LedgerViewNavigation({ section, onSectionChange }: {
  section: LedgerSection;
  onSectionChange: (section: LedgerSection) => void;
}) {
  return <View testID="ledger-view-navigation" accessibilityRole="tablist" accessibilityLabel="Ledger sections" style={s.rail}>
    <LinearGradient pointerEvents="none" accessible={false} colors={[T.material.controlFace,T.material.chartFace]} style={StyleSheet.absoluteFillObject}/>
    {LEDGER_CHAPTERS.map(chapter => {
      const selected = section === chapter.key;
      return <SLMotionPressable key={chapter.key} testID={`ledger-tab-${chapter.key}`} accessibilityRole="tab"
        accessibilityLabel={chapter.label} accessibilityState={{ selected }}
        onPress={() => { Keyboard.dismiss(); onSectionChange(chapter.key); }}
        style={[s.segment, selected && s.selected]}>
        {selected?<LinearGradient pointerEvents="none" accessible={false} colors={[T.material.controlTop,T.material.controlBottom]} style={StyleSheet.absoluteFillObject}/>:null}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9} maxFontSizeMultiplier={1.2}
          style={[s.label, selected && s.selectedLabel]}>{chapter.label}</Text>
      </SLMotionPressable>;
    })}
  </View>;
}
const s = StyleSheet.create({
  rail: { flex: 1, minWidth: 0, flexDirection: 'row', padding: 3, borderRadius: T.radius.control, overflow:'hidden', backgroundColor: C.inset, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  segment: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2, borderRadius: T.radius.inner, borderWidth: StyleSheet.hairlineWidth, borderColor: T.material.maskClear, overflow:'hidden' },
  selected: { backgroundColor: C.action, borderColor: T.material.controlEdge, borderTopColor:T.material.accentEdge, borderBottomColor:T.material.controlBottom },
  label: { color: C.secondary, fontFamily: T.fonts.bodyMedium, fontSize: T.type.small, lineHeight: 20 },
  selectedLabel: { color: C.text, fontFamily: T.fonts.bodySemiBold },
});
