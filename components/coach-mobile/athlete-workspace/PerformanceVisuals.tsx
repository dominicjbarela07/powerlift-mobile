import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies } from '@/constants/theme';
import { coachingTotalChange, type CoachingPerformance } from '@/lib/coach-performance';
import { displayCalculatedWeight, kgToDisplay, type LedgerUnit } from '@/lib/ledger-data';
import { STRENGTH_LEDGER_ATMOSPHERE_ASSETS } from '@/lib/strength-ledger-visual-assets';

export const INK = { text: '#F4F0FF', muted: '#AAA5B8', quiet: '#777384', violet: '#B889FF', cyan: '#59D9EF', magenta: '#F278CA', green: '#51E2A5', gold: '#E8C17B', line: '#24212E' };
export const LIFT_COLORS: Record<string, string> = { squat: INK.violet, bench: INK.cyan, deadlift: INK.magenta };
export function periodDate(value?: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—';
}
export function loadLabel(value: number | null | undefined, unit: LedgerUnit) {
  return value == null ? '—' : `${displayCalculatedWeight(value, unit)} ${unit}`;
}
export function deltaLabel(value: number | null | undefined, unit: LedgerUnit) {
  return value == null ? 'Building a baseline' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${loadLabel(Math.abs(value), unit)}`;
}
export function Chapter({ number, title, detail, action, onPress, children }: { number: string; title: string; detail?: string; action?: string; onPress?: () => void; children: React.ReactNode }) {
  return <View style={v.chapter}>
    <View style={v.chapterTop}><Text style={v.chapterNumber}>{number}</Text><View style={v.rule} /><Text style={v.eyebrow}>THE ATHLETE RECORD</Text></View>
    <View style={v.headingRow}><Text style={v.heading}>{title}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={v.linkTarget}><Text style={v.link}>{action}</Text><Ionicons name="arrow-forward" size={16} color={INK.violet} /></Pressable> : null}</View>
    {detail ? <Text style={v.body}>{detail}</Text> : null}
    {children}
  </View>;
}
export function EvidenceLink({ title, detail, onPress }: { title: string; detail?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [v.evidenceLink, pressed && v.pressed]}><View style={v.flex}><Text style={v.rowTitle}>{title}</Text>{detail ? <Text style={v.body}>{detail}</Text> : null}</View><Ionicons color={INK.violet} name="arrow-forward" size={21} /></Pressable>;
}
export function PerformanceLoading({ error, onRetry }: { error?: string | null; onRetry: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={error ? 'Retry Performance' : 'Loading Performance'} onPress={onRetry} style={v.loading}>
    {error ? <Ionicons name="reload" size={22} color={INK.violet} /> : <ActivityIndicator color={INK.violet} />}
    <Text style={v.rowTitle}>{error ? 'Performance unavailable' : 'Reading the training record'}</Text><Text style={v.body}>{error || 'Strength, execution, and recent evidence.'}</Text>
  </Pressable>;
}
export function StrengthHero({ data, unit, compact = false, onPress, onLiftPress }: { data: CoachingPerformance; unit: LedgerUnit; compact?: boolean; onPress?: () => void; onLiftPress?: (key: string) => void }) {
  const arc = data.big_three_arc;
  const delta = coachingTotalChange(data);
  const lifts = arc?.lifts || [];
  const available = lifts.filter((lift) => lift.current_e1rm_kg != null);
  const partial = arc?.estimated_total_kg == null;
  const headlineLift = available[0];
  const headline = partial ? headlineLift?.current_e1rm_kg : arc?.estimated_total_kg;
  const title = partial ? headlineLift ? `${headlineLift.label?.toUpperCase()} ESTIMATE` : 'STRENGTH BASELINE' : 'ESTIMATED TOTAL';
  return <View style={[v.hero, compact && v.compactHero]}>
    <Image accessible={false} source={STRENGTH_LEDGER_ATMOSPHERE_ASSETS.strength} resizeMode="cover" style={[v.heroArt, compact && v.compactArt]} />
    <LinearGradient colors={['rgba(5,3,9,0.20)', '#08060E']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={[v.heroContent, compact && v.compactContent]}>
      <Text style={v.eyebrow}>{title}</Text>
      <View style={v.totalLine}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[v.total, compact && v.compactTotal, headline == null && v.emptyTotal]}>{headline == null ? "First chapter" : displayCalculatedWeight(headline, unit)}</Text>{headline != null ? <Text style={v.totalUnit}>{unit}</Text> : null}</View>
      <View style={v.deltaLine}><View style={[v.signalDot, { backgroundColor: delta == null ? INK.quiet : delta < 0 ? INK.magenta : INK.green }]} /><Text style={[v.delta, { color: delta == null ? INK.muted : delta < 0 ? INK.magenta : INK.green }]}>{partial ? `${available.length} of 3 lifts established` : deltaLabel(delta, unit)}</Text>{!partial && delta != null ? <Text style={v.meta}>in this period</Text> : null}</View>
      {!compact ? <Text style={v.heroContext}>{arc?.estimated_total_kg == null ? 'A Total appears when all three competition lifts have evidence.' : 'Latest weekly bests · competition S / B / D'}</Text> : null}
      {!compact && lifts.some((lift) => lift.points?.length) ? <View style={v.heroChart}>
        <AnalyticalTimeSeriesChart testID="coach-performance-strength-chart" height={178} readableText selectedInitially="none" showLegend={false}
          metric={{ key: 'e1rm', label: 'Estimated 1RM', kind: 'weight', unit, maximumFractionDigits: 0 }}
          series={lifts.map((lift) => ({ key: lift.key!, label: lift.label!, color: LIFT_COLORS[lift.key!] || INK.violet,
            points: (lift.points || []).filter((point) => point.date && point.value_kg != null).map((point) => ({ date: point.date!, value: kgToDisplay(point.value_kg!, unit) })) }))} />
      </View> : null}
      <View style={[v.liftStrip, compact && v.compactStrip]}>{lifts.map((lift) => <Pressable key={lift.key} accessibilityRole="button" accessibilityLabel={`Open ${lift.label} strength evidence`} onPress={() => onLiftPress?.(lift.key!)} style={({ pressed }) => [v.lift, pressed && v.pressed]}>
        <View style={v.liftLabelRow}><View style={[v.signalDot, { backgroundColor: LIFT_COLORS[lift.key!] }]} /><Text style={v.liftLabel}>{lift.label}</Text></View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={v.liftValue}>{displayCalculatedWeight(lift.current_e1rm_kg, unit)}</Text>
        {!compact ? <Text style={[v.liftDelta, { color: lift.current_e1rm_kg == null ? INK.muted : lift.change_kg != null && lift.change_kg < 0 ? INK.magenta : INK.green }]}>{(lift.points?.length || 0) >= 2 ? deltaLabel(lift.change_kg, unit) : lift.current_e1rm_kg == null ? 'No evidence yet' : 'First evidence'}</Text> : null}
      </Pressable>)}</View>
      {compact && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={v.heroFooter}><Text style={v.link}>Open Performance</Text><Ionicons color={INK.violet} name="arrow-forward" size={20} /></Pressable> : null}
    </View>
  </View>;
}

export const v = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.987 }] },
  eyebrow: { color: INK.violet, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  heading: { color: INK.text, fontFamily: SLFontFamilies.display, fontSize: 25, flex: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  body: { color: INK.muted, fontSize: 14, lineHeight: 20 },
  meta: { color: INK.muted, fontSize: 12 },
  rowTitle: { color: INK.text, fontSize: 16, fontWeight: '600' },
  link: { color: INK.violet, fontSize: 13, fontWeight: '600' },
  linkTarget: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chapter: { gap: 12, paddingTop: 20 },
  chapterTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 3 },
  chapterNumber: { color: INK.violet, fontFamily: SLFontFamilies.numeric, fontSize: 13 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: INK.line },
  evidenceLink: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: INK.line, paddingVertical: 16, minHeight: 62 },
  loading: { minHeight: 180, gap: 12, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: '#0B0811', borderRadius: 20 },
  hero: { backgroundColor: '#0B0712', borderWidth: 1, borderColor: '#30223F', borderRadius: 24, overflow: 'hidden' },
  compactHero: { borderRadius: 21 },
  heroArt: { position: 'absolute', left: 0, right: 0, top: 0, width: '100%', height: 200, opacity: 0.8 },
  compactArt: { height: 150, opacity: 0.58 },
  heroContent: { padding: 17 },
  compactContent: { padding: 15 },
  compactStrip: { marginTop: 10, paddingTop: 10 },
  totalLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 3 },
  total: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 45, letterSpacing: -1.5, flexShrink: 1 },
  compactTotal: { fontSize: 34 },
  emptyTotal: { fontFamily: SLFontFamilies.display, fontSize: 32, letterSpacing: 0 },
  totalUnit: { color: '#C8BDD6', fontSize: 20 },
  deltaLine: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 1 },
  signalDot: { width: 5, height: 5, borderRadius: 3 },
  delta: { fontSize: 15, fontWeight: '600' },
  heroContext: { color: INK.muted, fontSize: 12, lineHeight: 17, marginTop: 10, maxWidth: 265 },
  heroChart: { marginTop: 2, marginHorizontal: -8 },
  liftStrip: { flexDirection: 'row', marginTop: 14, borderTopWidth: 1, borderTopColor: '#2A2036', paddingTop: 14 },
  lift: { flex: 1, gap: 4, minHeight: 47, paddingRight: 8 },
  liftLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liftLabel: { color: '#C5BED1', fontSize: 13 },
  liftValue: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 21 },
  smallUnit: { color: INK.muted, fontFamily: SLFontFamilies.body, fontSize: 12 },
  liftDelta: { fontSize: 12 },
  heroFooter: { borderTopWidth: 1, borderTopColor: '#2A2036', marginTop: 14, paddingTop: 12, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
