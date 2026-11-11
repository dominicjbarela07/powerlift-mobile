import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { StrengthLedgerSheetModalAdapter, StrengthLedgerSheetDragRegion } from '@/components/sheets/StrengthLedgerBottomSheet';
import { useSLReducedMotion } from '@/lib/motion';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/sl-text';
import { FloatingControlStack, FloatingUtilityButton, SL_FLOATING_CONTROL } from '@/components/ui/floating-control-coordinator';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import type { CanonicalMovementArtworkInput } from '@/lib/canonical-movement-artwork';
import { SLFontFamilies } from '@/constants/theme';
import { RestTimerClockText, SessionElapsedClockText } from './session-clock-text';
import type { ActiveRestTimer } from '@/lib/rest-timer-completion-core';

export function SessionV3Header({ title, subtitle, active, preview, inset, onBack, onActions, logged, total, startedAt, onFinish, disabled }: {
  title: string; subtitle: string; active: boolean; preview?: string | null; inset: number;
  onBack: () => void; onActions: () => void; logged: number; total: number; startedAt: string | null;
  onFinish?: () => void; disabled?: boolean;
}) {
  return <View style={[s.header, { paddingTop: inset + 4 }]}>
    <View style={s.headerRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={preview ? 'Return to Session Workspace' : active ? 'Minimize Session' : 'Back to Training'} onPress={onBack} style={s.icon}><Ionicons name={active && !preview ? 'chevron-down' : 'chevron-back'} size={22} color="#d4cadd" /></Pressable>
      <View style={s.copy}><Text style={s.headerTitle}>{preview ? `Preview · ${preview}` : title}</Text><Text style={s.subtitle}>{preview ? 'Read only · Return to Session Workspace' : subtitle}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Session actions" onPress={onActions} style={s.icon}><Ionicons name="ellipsis-horizontal" size={23} color="#d4cadd" /></Pressable>
      {onFinish ? <Pressable accessibilityRole="button" accessibilityLabel="Finish Session" disabled={disabled} onPress={onFinish} style={[s.headerFinish, disabled && s.dim]}><Text style={s.finishText}>Finish</Text></Pressable> : null}
    </View>
    {active ? <><View style={s.progressRow}><Text style={s.subtitle}><Text style={s.green}>●</Text> {logged} / {total} sets saved</Text><SessionElapsedClockText startedAt={startedAt} style={s.subtitle} /></View><View style={s.track}><View style={[s.fill, { width: `${Math.min(100, total ? logged / total * 100 : 0)}%` }]} /></View></> : null}
  </View>;
}

export function SessionV3PlanHero({ title, focus, planned, movements, artwork, note, eyebrow = 'YOUR SESSION' }: {
  title: string; focus: string; planned: number; movements: number; artwork?: CanonicalMovementArtworkInput | null; note?: string | null; eyebrow?: string;
}) {
  return <View style={s.hero}>
    <View style={s.heroRow}><View style={s.heroCopy}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.title}>{title}</Text><Text style={s.focus}>{focus}</Text></View><CanonicalMovementArtwork surface="session-v3-shell" movement={artwork} size={120} style={s.heroArt} /></View>
    <View style={s.stats}><View><Text style={s.number}>{planned}</Text><Text style={s.subtitle}>work sets</Text></View><View><Text style={s.number}>{movements}</Text><Text style={s.subtitle}>movements</Text></View></View>
    {note ? <View style={s.note}><Text style={s.eyebrow}>SESSION NOTE</Text><Text style={s.noteText}>{note}</Text></View> : null}
  </View>;
}

export function SessionV3Footer({ bottom, label, disabled, onPress, secondary, onSecondary, unit, onUnit, rest, onRest, onSkip, onAddRest, onRestSecond, inlineTools = false, remainingSets = 0 }: {
  bottom: number; label: string; disabled?: boolean; onPress: () => void; secondary?: string | null;
  onSecondary: () => void; unit: string; onUnit: () => void;
  rest?: ActiveRestTimer | null; onRest: () => void; onSkip: () => void; onAddRest: () => void; onRestSecond?: (seconds: number) => void;
  inlineTools?: boolean; remainingSets?: number;
}) {
  const [footerHeight, setFooterHeight] = React.useState(0);
  return <><View onLayout={({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height)} style={[s.footer, { paddingBottom: Math.max(bottom, 12) }]}>
    {rest ? <View style={s.rest}><Pressable accessibilityRole="button" accessibilityLabel="Adjust rest timer" onPress={onRest}><RestTimerClockText timer={rest} ring style={s.restTime} onSecond={onRestSecond} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Add 30 seconds to rest timer" onPress={onAddRest} style={({ pressed }) => [s.smallAction, s.restAddAction, pressed && s.dim]}><Text style={s.restAddText}>+30 sec</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Skip active rest timer" onPress={onSkip} style={({ pressed }) => [s.smallAction, s.skipAction, pressed && s.dim]}><Text style={s.skipText}>Skip</Text></Pressable></View> : null}
    <View style={s.footerTools}>
      {inlineTools ? <Text style={[s.subtitle, s.copy]}>{remainingSets > 0 ? `${remainingSets} ${remainingSets === 1 ? 'set' : 'sets'} remaining` : 'All sets saved'}</Text> : secondary ? <Pressable accessibilityRole="button" onPress={onSecondary} style={s.secondary}><Text style={s.subtitle}>{secondary} <Text style={s.cyan}>⌃</Text></Text></Pressable> : <View style={s.copy} />}
      {inlineTools ? <>
        {!rest ? <Pressable accessibilityRole="button" accessibilityLabel="Start rest timer" onPress={onRest} style={s.inlineTool}><Ionicons name="timer-outline" size={17} color="#18e0e7" /><Text style={s.restToolText}>Rest</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Display unit ${unit}. Switch to ${unit === 'kg' ? 'lb' : 'kg'}`}
          accessibilityHint="Changes only the weights shown in this Session." onPress={onUnit} style={s.inlineTool} testID="session-logger-unit-toggle">
          <Text style={s.unitText}>{unit}</Text><Ionicons name="swap-horizontal" size={15} color="#b7aec6" />
        </Pressable>
      </> : null}
    </View>
    <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled: !!disabled }} onPress={onPress} style={({ pressed }) => [s.primary, (pressed || disabled) && s.dim]}>
      <LinearGradient colors={inlineTools ? ['#ba94f0', '#a77cde'] : ['#9862e8', '#6232c2']} style={s.primaryFill}><Text style={[s.primaryText, inlineTools && s.selfCoachPrimaryText]}>{label}</Text></LinearGradient>
    </Pressable>
  </View>
    {!inlineTools && footerHeight > 0 ? <FloatingControlStack context="screen" style={{ bottom: footerHeight + SL_FLOATING_CONTROL.gap }}>
      <FloatingUtilityButton
        accessibilityHint="Changes only the weights shown in this Session."
        accessibilityLabel={`Display unit ${unit}. Switch to ${unit === 'kg' ? 'lb' : 'kg'}`}
        label={unit} size="large" onPress={onUnit} testID="session-logger-unit-toggle"
      />
    </FloatingControlStack> : null}
  </>;
}

export type SessionNavigatorRow = { key: string; title: string; summary: string; complete: boolean; selected: boolean; artwork?: CanonicalMovementArtworkInput | null };
export function SessionExerciseStrip({ rows, onSelect, onBrowse, disabled }: {
  rows: SessionNavigatorRow[]; onSelect: (key: string) => void; onBrowse: () => void; disabled?: boolean;
}) {
  const rail = React.useRef<React.ElementRef<typeof ScrollView>>(null);
  const positions = React.useRef<Record<string, number>>({});
  const selected = rows.find(row => row.selected)?.key;
  React.useEffect(() => {
    if (selected && positions.current[selected] != null) rail.current?.scrollTo({ x: Math.max(0, positions.current[selected] - 18), animated: false });
  }, [selected]);
  return <View style={s.exerciseStrip}>
    <Pressable accessibilityRole="button" accessibilityLabel="All Session exercises" disabled={disabled} onPress={onBrowse} style={s.exerciseHeading}>
      <Text style={s.exerciseEyebrow}>EXERCISES</Text><Ionicons name="list-outline" color="#b7aec6" size={16} />
    </Pressable>
    <ScrollView ref={rail} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.exerciseRail}>
      {rows.map((row, index) => <Pressable key={row.key} accessibilityRole="button" accessibilityLabel={`${row.title}, ${row.summary}`}
        accessibilityState={{ selected: row.selected, disabled: !!disabled }} disabled={disabled} onPress={() => onSelect(row.key)}
        onLayout={({ nativeEvent }) => {
          positions.current[row.key] = nativeEvent.layout.x;
          if (row.selected) rail.current?.scrollTo({ x: Math.max(0, nativeEvent.layout.x - 18), animated: false });
        }}
        style={[s.exerciseChoice, row.selected && s.exerciseSelected]}>
        <Text style={[s.exerciseNumber, row.complete && s.green]}>{row.complete ? '✓' : index + 1}</Text>
        <View><Text style={[s.exerciseName, row.selected && s.exerciseNameSelected]}>{row.title}</Text><Text style={s.exerciseCount}>{row.summary}</Text></View>
      </Pressable>)}
    </ScrollView>
  </View>;
}
export function SessionMovementNavigator({ visible, rows, onClose, onSelect, bottom }: { visible: boolean; rows: SessionNavigatorRow[]; onClose: () => void; onSelect: (key: string) => void; bottom: number }) {
  const reduceMotion = useSLReducedMotion();
  return <StrengthLedgerSheetModalAdapter visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}><View style={s.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close movement navigator" /><View style={[s.sheet, { paddingBottom: Math.max(20, bottom) }]}>
    <StrengthLedgerSheetDragRegion><View style={s.headerRow}><Text style={[s.title, s.copy]}>Session movements</Text><Pressable onPress={onClose} style={s.icon} accessibilityLabel="Close"><Ionicons name="close" color="#eee" size={24} /></Pressable></View></StrengthLedgerSheetDragRegion>
    <ScrollView>{rows.map((row, i) => <Pressable key={row.key} accessibilityRole="button" accessibilityState={{ selected: row.selected }} onPress={() => onSelect(row.key)} style={[s.navigatorRow, row.selected && s.selected]}>
      <Text style={row.complete ? s.green : s.subtitle}>{row.complete ? '✓' : String(i + 1).padStart(2, '0')}</Text><CanonicalMovementArtwork surface="session-v3-shell" movement={row.artwork} size={40} /><View style={s.copy}><Text style={s.headerTitle}>{row.title}</Text><Text style={s.subtitle}>{row.summary}</Text></View><Ionicons name="chevron-forward" color="#b494e6" size={18} />
    </Pressable>)}</ScrollView>
  </View></View></StrengthLedgerSheetModalAdapter>;
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 18, backgroundColor: '#000000' }, headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 8 },
  headerFinish: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }, finishText: { color: '#c9a6ff', fontSize: 14, fontFamily: SLFontFamilies.sansSemiBold },
  selfCoachPrimaryText: { color: '#1a1027' },
  exerciseStrip: { backgroundColor: '#08070d', borderBottomWidth: 1, borderBottomColor: '#2b2434' },
  exerciseHeading: { minHeight: 30, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseEyebrow: { color: '#a69bb3', fontSize: 10, letterSpacing: 1.1, fontFamily: SLFontFamilies.sansSemiBold },
  exerciseRail: { paddingHorizontal: 18, gap: 18 },
  exerciseChoice: { minHeight: 54, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  exerciseSelected: { borderBottomColor: '#bc97f6' }, exerciseNumber: { color: '#b7aec6', fontSize: 12 },
  exerciseName: { color: '#b7aec6', fontSize: 13, fontFamily: SLFontFamilies.sansSemiBold },
  exerciseNameSelected: { color: '#e4ceff' }, exerciseCount: { color: '#a79cb5', fontSize: 10, lineHeight: 16 },
  inlineTool: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  restToolText: { color: '#18e0e7', fontSize: 12 }, unitText: { color: '#d6cede', fontSize: 13 },
  icon: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, headerTitle: { color: '#f5f0fb', fontSize: 15, fontFamily: SLFontFamilies.sansSemiBold },
  subtitle: { color: '#b7aec6', fontSize: 12, lineHeight: 18 }, progressRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#302537' },
  green: { color: '#8cdab8' }, cyan: { color: '#b2e2ea', fontSize: 13 }, track: { height: 2, backgroundColor: '#2b2434' }, fill: { height: 2, backgroundColor: '#aa85e5' },
  hero: { paddingTop: 12 }, heroRow: { flexDirection: 'row', minHeight: 124, alignItems: 'center' }, heroCopy: { flex: 1, zIndex: 1 }, heroArt: { marginRight: -8 },
  eyebrow: { color: '#b395e6', fontFamily: SLFontFamilies.sansBold, fontSize: 10, letterSpacing: 1.4 }, title: { color: '#f6f1fc', fontSize: 30, lineHeight: 35, fontFamily: SLFontFamilies.sansBold, marginVertical: 10 }, focus: { color: '#c9bfd7', fontSize: 14, lineHeight: 21 },
  stats: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2e2637', flexDirection: 'row', gap: 35, paddingVertical: 8 }, number: { fontSize: 25, color: '#f0eaf8', fontFamily: SLFontFamilies.sansBold }, note: { borderLeftWidth: 2, borderLeftColor: '#a77fe3', paddingLeft: 11, marginVertical: 13 }, noteText: { color: '#d1c7df', fontSize: 13, lineHeight: 19, marginTop: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 3, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#271f30' }, footerTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 }, secondary: { minHeight: 38, justifyContent: 'center', flex: 1 },
  primary: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#a47be5' }, primaryFill: { minHeight: 52, justifyContent: 'center', alignItems: 'center', padding: 12 }, primaryText: { color: '#fff', fontSize: 17, fontFamily: SLFontFamilies.sansBold }, dim: { opacity: 0.5 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, marginTop: 8, backgroundColor: '#080b0e', borderWidth: 1, borderColor: '#2d3d45', borderRadius: 16 }, restTime: { fontSize: 27, lineHeight: 34, fontVariant: ['tabular-nums'], color: '#ffffff', fontFamily: SLFontFamilies.sansSemiBold }, smallAction: { minHeight: 44, minWidth: 60, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }, skipAction: { borderWidth: 1, borderColor: '#303035', borderRadius: 12, backgroundColor: '#121215' }, skipText: { color: '#c2bdca', fontSize: 13 }, restAddAction: { flex: 1, minWidth: 0 }, restAddText: { color: '#18e0e7', fontSize: 15, fontFamily: SLFontFamilies.sansSemiBold },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' }, sheet: { maxHeight: '80%', backgroundColor: '#0f0c16', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#41314e', padding: 18 }, navigatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#312638', paddingVertical: 16 }, selected: { backgroundColor: '#22182e' },
});
