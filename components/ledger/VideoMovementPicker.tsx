import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { StrengthLedgerBottomSheet, StrengthLedgerBottomSheetScrollView } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import type { ArchiveVideoMovement } from '@/lib/ledger-archive';

export function VideoMovementPicker({ movements, selected, onSelect }: {
  movements: ArchiveVideoMovement[];
  selected: ArchiveVideoMovement | null;
  onSelect: (movement: ArchiveVideoMovement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visible = movements.filter(m => m.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const choose = (movement: ArchiveVideoMovement | null) => { onSelect(movement); setOpen(false); setSearch(''); };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Filter videos by movement: ${selected?.name || 'All movements'}`} onPress={() => setOpen(true)} style={styles.trigger}>
      <Ionicons name="barbell-outline" size={20} color={SLColors.accentMuted} />
      <Text typographyRole="bodyStrong" style={styles.name}>{selected?.name || 'All movements'}</Text>
      <Ionicons name="chevron-down" size={17} color={SLColors.iconMuted} />
    </Pressable>
    <StrengthLedgerBottomSheet accessibilityLabel="Choose video movement" visible={open} onDismiss={() => { setOpen(false); setSearch(''); }} heightFraction={Math.min(0.72, 0.42 + movements.length * 0.06)}>
      <View style={styles.heading}><Text typographyRole="sectionTitle" style={styles.text}>By movement</Text><Text typographyRole="caption" style={styles.muted}>Movements in your video archive</Text></View>
      <View style={styles.search}><Ionicons name="search" size={18} color={SLColors.iconMuted} /><TextInput accessibilityLabel="Find a movement in your videos" placeholder="Find a movement" placeholderTextColor={SLColors.textMuted} value={search} onChangeText={setSearch} autoCapitalize="none" style={styles.input} /></View>
      <StrengthLedgerBottomSheetScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityState={{ selected: !selected }} onPress={() => choose(null)} style={styles.row}><Text typographyRole="bodyStrong" style={styles.name}>All movements</Text>{!selected ? <Ionicons name="checkmark" size={21} color={SLColors.accentMuted} /> : null}</Pressable>
        {visible.map(movement => <Pressable key={movement.key} accessibilityRole="button" accessibilityLabel={`${movement.name}, ${movement.video_count} videos${movement.key.startsWith('label:') ? ', recorded name' : ''}`} accessibilityState={{ selected: selected?.key === movement.key }} onPress={() => choose(movement)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.name}><Text typographyRole="bodyStrong" style={styles.text}>{movement.name}</Text>{movement.key.startsWith('label:') ? <Text typographyRole="caption" style={styles.muted}>Recorded name</Text> : null}</View>
          <Text typographyRole="caption" style={styles.muted}>{movement.video_count}</Text>{selected?.key === movement.key ? <Ionicons name="checkmark" size={21} color={SLColors.accentMuted} /> : null}
        </Pressable>)}
        {!visible.length ? <Text typographyRole="body" style={styles.empty}>{search.trim() ? 'No movements match that search.' : 'Your uploaded videos will appear here.'}</Text> : null}
      </StrengthLedgerBottomSheetScrollView>
    </StrengthLedgerBottomSheet>
  </>;
}

const styles = StyleSheet.create({
  trigger: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: SLColors.borderDefault, borderRadius: SLRadius.md, backgroundColor: SLColors.surfaceInset },
  name: { flex: 1, minWidth: 0, color: SLColors.textStrong },
  heading: { paddingHorizontal: SLSpacing.lg, paddingBottom: SLSpacing.md, gap: 5 },
  muted: { color: SLColors.textMuted },
  text: { color: SLColors.textStrong },
  pressed: { backgroundColor: SLColors.surfacePressed },
  search: { marginHorizontal: SLSpacing.lg, marginBottom: SLSpacing.sm, flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, paddingHorizontal: 12, backgroundColor: SLColors.surfaceInset, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderDefault },
  input: { flex: 1, minWidth: 0, color: SLColors.textStrong, paddingVertical: 10 },
  list: { paddingHorizontal: SLSpacing.lg, paddingBottom: SLSpacing.xl },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider },
  empty: { color: SLColors.textMuted, paddingVertical: SLSpacing.lg },
});
