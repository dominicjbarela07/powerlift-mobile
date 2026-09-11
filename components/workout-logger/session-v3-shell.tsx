import { useSLReducedMotion } from '@/lib/motion';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import type { CanonicalMovementArtworkInput } from '@/lib/canonical-movement-artwork';
import { SLFontFamilies } from '@/constants/theme';

export function SessionV3Header({ title, subtitle, active, preview, inset, onBack, onActions, logged, total, elapsed }: {
  title: string; subtitle: string; active: boolean; preview?: string | null; inset: number;
  onBack: () => void; onActions: () => void; logged: number; total: number; elapsed: string;
}) {
  return <View style={[s.header, { paddingTop: inset + 4 }]}>
    <View style={s.headerRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={preview ? 'Return to Coach Editor' : active ? 'Minimize Session' : 'Back to Training'} onPress={onBack} style={s.icon}><Ionicons name={active && !preview ? 'chevron-down' : 'chevron-back'} size={22} color="#d4cadd" /></Pressable>
      <View style={s.copy}><Text style={s.headerTitle}>{preview ? `Preview · ${preview}` : title}</Text><Text style={s.subtitle}>{preview ? 'Read only · Return to Coach Editor' : subtitle}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Session actions" onPress={onActions} style={s.icon}><Ionicons name="ellipsis-horizontal" size={23} color="#d4cadd" /></Pressable>
    </View>
    {active ? <><View style={s.progressRow}><Text style={s.subtitle}><Text style={s.green}>●</Text> {logged} / {total} sets saved</Text><Text style={s.subtitle}>{elapsed} elapsed</Text></View><View style={s.track}><View style={[s.fill, { width: `${Math.min(100, total ? logged / total * 100 : 0)}%` }]} /></View></> : null}
  </View>;
}

export function SessionV3PlanHero({ title, focus, planned, movements, artwork, note }: {
  title: string; focus: string; planned: number; movements: number; artwork?: CanonicalMovementArtworkInput | null; note?: string | null;
}) {
  return <View style={s.hero}>
    <View style={s.heroRow}><View style={s.heroCopy}><Text style={s.eyebrow}>TODAY’S SESSION</Text><Text style={s.title}>{title}</Text><Text style={s.focus}>{focus}</Text></View><CanonicalMovementArtwork movement={artwork} size={120} style={s.heroArt} /></View>
    <View style={s.stats}><View><Text style={s.number}>{planned}</Text><Text style={s.subtitle}>work sets</Text></View><View><Text style={s.number}>{movements}</Text><Text style={s.subtitle}>movements</Text></View></View>
    {note ? <View style={s.note}><Text style={s.eyebrow}>SESSION NOTE</Text><Text style={s.noteText}>{note}</Text></View> : null}
  </View>;
}

export function SessionV3Footer({ bottom, label, disabled, onPress, secondary, onSecondary, unit, onUnit, rest, onRest, onSkip, onAddRest }: {
  bottom: number; label: string; disabled?: boolean; onPress: () => void; secondary: string;
  onSecondary: () => void; unit: string; onUnit: () => void;
  rest?: string | null; onRest: () => void; onSkip: () => void; onAddRest: () => void;
}) {
  return <View style={[s.footer, { paddingBottom: Math.max(bottom, 12) }]}>
    {rest ? <View style={s.rest}><Pressable onPress={onRest}><Text style={s.restTime}>{rest}</Text></Pressable><View style={s.copy} /><Pressable accessibilityRole="button" onPress={onAddRest} style={s.smallAction}><Text style={s.cyan}>+30 sec</Text></Pressable><Pressable accessibilityRole="button" onPress={onSkip} style={s.smallAction}><Text style={s.cyan}>Skip</Text></Pressable></View> : null}
    <View style={s.footerTools}><Pressable accessibilityRole="button" onPress={onSecondary} style={s.secondary}><Text style={s.subtitle}>{secondary} <Text style={s.cyan}>⌃</Text></Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Display units ${unit}`} onPress={onUnit} style={s.unit}><Text style={s.subtitle}>{unit}</Text></Pressable></View>
    <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled: !!disabled }} onPress={onPress} style={({ pressed }) => [s.primary, (pressed || disabled) && s.dim]}>
      <LinearGradient colors={['#9862e8', '#6232c2']} style={s.primaryFill}><Text style={s.primaryText}>{label}</Text></LinearGradient>
    </Pressable>
  </View>;
}

export type SessionNavigatorRow = { key: string; title: string; summary: string; complete: boolean; selected: boolean; artwork?: CanonicalMovementArtworkInput | null };
export function SessionMovementNavigator({ visible, rows, onClose, onSelect, bottom }: { visible: boolean; rows: SessionNavigatorRow[]; onClose: () => void; onSelect: (key: string) => void; bottom: number }) {
  const reduceMotion = useSLReducedMotion();
  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}><View style={s.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close movement navigator" /><View style={[s.sheet, { paddingBottom: Math.max(20, bottom) }]}>
    <View style={s.headerRow}><Text style={[s.title, s.copy]}>Session movements</Text><Pressable onPress={onClose} style={s.icon} accessibilityLabel="Close"><Ionicons name="close" color="#eee" size={24} /></Pressable></View>
    <ScrollView>{rows.map((row, i) => <Pressable key={row.key} accessibilityRole="button" accessibilityState={{ selected: row.selected }} onPress={() => onSelect(row.key)} style={[s.navigatorRow, row.selected && s.selected]}>
      <Text style={row.complete ? s.green : s.subtitle}>{row.complete ? '✓' : String(i + 1).padStart(2, '0')}</Text><CanonicalMovementArtwork movement={row.artwork} size={40} /><View style={s.copy}><Text style={s.headerTitle}>{row.title}</Text><Text style={s.subtitle}>{row.summary}</Text></View><Ionicons name="chevron-forward" color="#b494e6" size={18} />
    </Pressable>)}</ScrollView>
  </View></View></Modal>;
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 18, backgroundColor: '#08060d' }, headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 8 },
  icon: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, headerTitle: { color: '#f5f0fb', fontSize: 15, fontFamily: SLFontFamilies.sansSemiBold },
  subtitle: { color: '#b7aec6', fontSize: 12, lineHeight: 18 }, progressRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#302537' },
  green: { color: '#8cdab8' }, cyan: { color: '#b2e2ea', fontSize: 13 }, track: { height: 2, backgroundColor: '#2b2434' }, fill: { height: 2, backgroundColor: '#aa85e5' },
  hero: { paddingTop: 12 }, heroRow: { flexDirection: 'row', minHeight: 124, alignItems: 'center' }, heroCopy: { flex: 1, zIndex: 1 }, heroArt: { marginRight: -8 },
  eyebrow: { color: '#b395e6', fontFamily: SLFontFamilies.sansBold, fontSize: 10, letterSpacing: 1.4 }, title: { color: '#f6f1fc', fontSize: 30, lineHeight: 35, fontFamily: SLFontFamilies.sansBold, marginVertical: 10 }, focus: { color: '#c9bfd7', fontSize: 14, lineHeight: 21 },
  stats: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2e2637', flexDirection: 'row', gap: 35, paddingVertical: 8 }, number: { fontSize: 25, color: '#f0eaf8', fontFamily: SLFontFamilies.sansBold }, note: { borderLeftWidth: 2, borderLeftColor: '#a77fe3', paddingLeft: 11, marginVertical: 13 }, noteText: { color: '#d1c7df', fontSize: 13, lineHeight: 19, marginTop: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 3, backgroundColor: '#08060df5', borderTopWidth: 1, borderTopColor: '#271f30' }, footerTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 }, secondary: { minHeight: 38, justifyContent: 'center', flex: 1 }, unit: { width: 40, height: 32, borderWidth: 1, borderColor: '#45354f', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, primary: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#a47be5' }, primaryFill: { minHeight: 52, justifyContent: 'center', alignItems: 'center', padding: 12 }, primaryText: { color: '#fff', fontSize: 17, fontFamily: SLFontFamilies.sansBold }, dim: { opacity: 0.5 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginTop: 8, backgroundColor: '#0f2025', borderWidth: 1, borderColor: '#30424c', borderRadius: 14 }, restTime: { fontSize: 30, color: '#d4f2f7', fontFamily: SLFontFamilies.sansSemiBold }, smallAction: { minHeight: 36, justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' }, sheet: { maxHeight: '80%', backgroundColor: '#0f0c16', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#41314e', padding: 18 }, navigatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#312638', paddingVertical: 16 }, selected: { backgroundColor: '#22182e' },
});
