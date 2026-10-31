import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { StrengthLedgerBottomSheet, StrengthLedgerBottomSheetScrollView, type StrengthLedgerBottomSheetHandle } from '@/components/sheets/StrengthLedgerBottomSheet';
import { LEDGER as T } from '@/constants/ledger';
import { currentLedgerDestination, LEDGER_CHAPTERS, LEDGER_DESTINATIONS, type LedgerDestination, type LedgerNavigationState } from '@/lib/ledger-navigation';
const C = T.colors;

/** One persistent current-location control; every leaf is one menu choice away. */
export function LedgerViewNavigation({ state, onSelect }: {
  state: LedgerNavigationState;
  onSelect: (destination: LedgerDestination) => void;
}) {
  const { height, fontScale } = useWindowDimensions();
  const current = currentLedgerDestination(state);
  const chapter = LEDGER_CHAPTERS.find(item => item.key === current.section)!;
  const [open, setOpen] = useState(false);
  const sheet = useRef<StrengthLedgerBottomSheetHandle>(null);
  const pending = useRef<LedgerDestination | null>(null);
  const dismiss = () => {
    setOpen(false);
    const destination = pending.current;
    pending.current = null;
    if (destination) onSelect(destination);
  };
  const choose = (destination: LedgerDestination) => {
    if (pending.current) return;
    pending.current = destination;
    sheet.current?.dismiss();
  };
  return <View testID="ledger-view-navigation" style={s.owner}>
    <Pressable testID="ledger-view-trigger" accessibilityRole="button"
      accessibilityLabel={`Ledger view: ${chapter.label}, ${current.label}. Choose view`}
      accessibilityHint="Opens all Ledger views" accessibilityState={{ expanded: open }}
      onPress={() => { Keyboard.dismiss(); pending.current = null; setOpen(true); }} style={s.trigger}>
      <Text style={s.breadcrumb}>{current.section === 'milestones' ? 'THE LEDGER' : `THE LEDGER · ${chapter.label.toUpperCase()}`}</Text>
      <View style={s.titleRow}><Text numberOfLines={1} style={s.title}>{current.label}</Text><Ionicons name="chevron-down" size={17} color={C.secondary}/></View>
    </Pressable>
    <StrengthLedgerBottomSheet ref={sheet} testID="ledger-view-chooser" accessibilityLabel="Ledger views"
      visible={open} onDismiss={dismiss} heightFraction={Math.min(0.93, 680 * Math.max(1, fontScale) / height)}>
      <Text accessibilityRole="header" style={s.menuTitle}>The Ledger</Text>
      <StrengthLedgerBottomSheetScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.choices}>
        {LEDGER_CHAPTERS.map(group => <View key={group.key} style={s.group}>
          {group.key !== 'milestones' ? <Text style={s.groupLabel}>{group.label}</Text> : null}
          {LEDGER_DESTINATIONS.filter(destination => destination.section === group.key).map(destination => {
            const selected = current.key === destination.key;
            return <Pressable key={destination.key} testID={destination.testID} accessibilityRole="button"
              accessibilityLabel={`${group.label}: ${destination.label}`} accessibilityState={{ selected }}
              onPress={() => choose(destination)} style={({ pressed }) => [s.choice, selected && s.selectedChoice, pressed && s.pressed]}>
              <Ionicons name={destination.icon} size={21} color={selected ? C.accent : C.muted}/>
              <Text style={[s.choiceLabel, selected && s.selectedLabel]}>{destination.label}</Text>
              {selected ? <Ionicons name="checkmark" size={20} color={C.accent}/> : null}
            </Pressable>;
          })}
        </View>)}
      </StrengthLedgerBottomSheetScrollView>
    </StrengthLedgerBottomSheet>
  </View>;
}
const s = StyleSheet.create({
  owner: { flex: 1, minWidth: 0 },
  trigger: { minHeight: 56, justifyContent: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: 5, paddingVertical: 3 },
  breadcrumb: { color: C.muted, fontFamily: T.fonts.bodyMedium, fontSize: T.type.micro, lineHeight: 15, letterSpacing: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  title: { color: C.text, fontFamily: T.fonts.bodySemiBold, fontSize: T.type.heading, lineHeight: 32, letterSpacing: -.4, flexShrink: 1 },
  menuTitle: { color: C.text, fontFamily: T.fonts.bodySemiBold, fontSize: T.type.section, lineHeight: 28, paddingHorizontal: 20, paddingBottom: 12 },
  choices: { paddingHorizontal: 16, paddingBottom: 12, gap: 16 },
  group: { gap: 3 },
  groupLabel: { color: C.muted, fontFamily: T.fonts.bodyMedium, fontSize: T.type.caption, lineHeight: 18, paddingLeft: 12, marginBottom: 3 },
  choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 12, paddingVertical: 10, borderRadius: T.radius.inner },
  choiceLabel: { flex: 1, minWidth: 0, color: C.secondary, fontFamily: T.fonts.bodyMedium, fontSize: T.type.bodyStrong, lineHeight: 22 },
  selectedChoice: { backgroundColor: C.panel },
  selectedLabel: { color: C.text, fontFamily: T.fonts.bodySemiBold },
  pressed: { backgroundColor: C.raised },
});
