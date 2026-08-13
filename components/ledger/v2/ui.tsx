import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies } from '@/constants/theme';
import { displayWeight, type AccomplishmentEvent, type LedgerUnit } from '@/lib/ledger-data';
import type { ArchiveItem } from '@/lib/ledger-archive';
import { LEDGER_SCOPE_OPTIONS, recordNumber, type LedgerV2Scope } from './types';

export const LEDGER_V2_COLORS = {
  canvas: '#020204',
  object: '#090A0F',
  raised: '#0D0F16',
  inset: '#07080D',
  line: '#262833',
  lineStrong: '#3A3546',
  text: '#F3F0F5',
  muted: '#9995A2',
  subtle: '#6F6B76',
  violet: '#B78AFF',
  violetSoft: '#241734',
  magenta: '#E06AF2',
  cyan: '#70D4E8',
  green: '#70D39B',
  gold: '#D9B56D',
  red: '#D97678',
} as const;

export function LedgerBookIcon({ size = 42 }: { size?: number }) {
  const scale = size / 42;
  return <View accessibilityLabel="The Ledger" style={[styles.book, { width: size, height: size, borderRadius: 9 * scale }]}>
    <View style={[styles.bookSpine, { width: 7 * scale }]} />
    <View style={[styles.bookRule, { left: 12 * scale, right: 7 * scale, top: 12 * scale }]} />
    <View style={[styles.bookRule, { left: 12 * scale, right: 11 * scale, top: 18 * scale }]} />
    <View style={[styles.bookMark, { width: 8 * scale, height: 12 * scale, right: 8 * scale, bottom: 7 * scale }]} />
  </View>;
}

export function LedgerV2Header({ title, subtitle, back, onBack, action }: {
  title: string; subtitle: string; back?: boolean; onBack?: () => void; action?: React.ReactNode;
}) {
  return <View style={styles.header}>
    {back ? <Pressable accessibilityLabel="Back" onPress={onBack} style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}><Ionicons name="chevron-back" size={22} color={LEDGER_V2_COLORS.text} /></Pressable> : <LedgerBookIcon size={40} />}
    <View style={styles.headerCopy}><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSubtitle}>{subtitle}</Text></View>
    {action || null}
  </View>;
}

export function LedgerV2PageState({ title, body, loading, onRetry }: { title: string; body: string; loading?: boolean; onRetry?: () => void }) {
  return <View style={styles.pageState}>
    {loading ? <ActivityIndicator color={LEDGER_V2_COLORS.violet} /> : <LedgerBookIcon size={46} />}
    <Text style={styles.pageStateTitle}>{title}</Text><Text style={styles.pageStateBody}>{body}</Text>
    {onRetry ? <Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}
  </View>;
}

export function LedgerContextBar({ value, onChange }: { value: LedgerV2Scope; onChange: (value: LedgerV2Scope) => void }) {
  return <View style={styles.contextWrap}>
    <Text style={styles.contextLabel}>TIME PERIOD</Text>
    <View style={styles.contextRail}>{LEDGER_SCOPE_OPTIONS.map((option) => {
      const selected = value === option.key;
      return <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(option.key)} style={[styles.contextChip, selected && styles.contextChipSelected]}><Text style={[styles.contextChipText, selected && styles.contextChipTextSelected]}>{option.label}</Text></Pressable>;
    })}</View>
  </View>;
}

export function LedgerSection({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionCopy}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.sectionTitle}>{title}</Text></View>{action && onAction ? <Pressable onPress={onAction} style={styles.sectionAction}><Text style={styles.sectionActionText}>{action}</Text><Ionicons name="arrow-forward" size={14} color={LEDGER_V2_COLORS.violet} /></Pressable> : null}</View>;
}

export function LedgerBadge({ label, tone = LEDGER_V2_COLORS.violet }: { label: string; tone?: string }) {
  return <View style={[styles.badge, { borderColor: `${tone}68`, backgroundColor: `${tone}14` }]}><Text style={[styles.badgeText, { color: tone }]}>{label}</Text></View>;
}

export function LedgerMetric({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return <View style={styles.metric}><Text adjustsFontSizeToFit minimumFontScale={0.58} numberOfLines={1} style={[styles.metricValue, tone ? { color: tone } : null]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

export function LedgerSurface({ children, style }: React.PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function LedgerChapterRow({ number, title, detail, icon, tone, onPress }: {
  number: string; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; tone: string; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}. ${detail}`} onPress={onPress} style={({ pressed }) => [styles.chapter, pressed && styles.pressed]}>
    <Text style={styles.chapterNumber}>{number}</Text><View style={[styles.chapterIcon, { borderColor: `${tone}50`, backgroundColor: `${tone}12` }]}><Ionicons name={icon} size={20} color={tone} /></View>
    <View style={styles.chapterCopy}><Text style={styles.chapterTitle}>{title}</Text><Text numberOfLines={2} style={styles.chapterDetail}>{detail}</Text></View><Ionicons name="chevron-forward" size={17} color={LEDGER_V2_COLORS.subtle} />
  </Pressable>;
}

export function LedgerSparkline({ values, tone = LEDGER_V2_COLORS.violet, height = 72 }: { values: number[]; tone?: string; height?: number }) {
  if (values.length < 2) return <View style={[styles.emptyPlot, { height }]}><Text style={styles.emptyPlotText}>More observations are needed.</Text></View>;
  const width = 300;
  const inset = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const points = values.map((value, index) => ({
    x: inset + index * ((width - inset * 2) / Math.max(1, values.length - 1)),
    y: height - inset - ((value - min) / spread) * (height - inset * 2),
  }));
  return <Svg accessibilityLabel={`${values.length} observed evidence points`} width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
    {[0.33, 0.66].map((position) => <Line key={position} x1={inset} x2={width - inset} y1={height * position} y2={height * position} stroke={LEDGER_V2_COLORS.line} strokeWidth="1" />)}
    <Polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={tone} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    {points.map((point, index) => <Circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r={index === points.length - 1 ? 4 : 2.4} fill={index === points.length - 1 ? LEDGER_V2_COLORS.text : tone} stroke={tone} strokeWidth={index === points.length - 1 ? 2 : 0} />)}
  </Svg>;
}

export function performanceLabel(item: ArchiveItem, unit: LedgerUnit): string {
  const weight = recordNumber(item.performance, 'weight_kg');
  const reps = recordNumber(item.performance, 'reps');
  const rpe = recordNumber(item.performance, 'rpe');
  const rir = recordNumber(item.performance, 'rir');
  if (weight === null && reps === null) return item.provenance_label || 'Recorded evidence';
  const effort = rpe !== null ? ` · RPE ${number(rpe)}` : rir !== null ? ` · ${number(rir)} RIR` : '';
  return `${displayWeight(weight, unit)} ${unit.toUpperCase()}${reps !== null ? ` × ${number(reps)}` : ''}${effort}`;
}

export function accomplishmentLabel(event: AccomplishmentEvent): string {
  if (event.event_type.includes('REP_PR') || event.event_type.includes('SAME_WEIGHT_REP')) return 'Rep PR';
  if (event.event_type.includes('E1RM')) return 'e1RM PR';
  if (event.event_type.includes('BLOCK')) return 'Block Best';
  if (event.event_type.includes('RPE')) return 'RPE PR';
  if (event.event_type.includes('WEIGHT')) return 'Weight PR';
  return event.event_type.replace(/^CORE_/, '').replaceAll('_', ' ');
}

export function accomplishmentTone(event: AccomplishmentEvent): string {
  if (event.event_type.includes('BLOCK')) return LEDGER_V2_COLORS.gold;
  if (event.event_type.includes('E1RM')) return LEDGER_V2_COLORS.cyan;
  if (event.event_type.includes('REP')) return LEDGER_V2_COLORS.magenta;
  return LEDGER_V2_COLORS.violet;
}

export function dateLabel(value?: string | null): string {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

const styles = StyleSheet.create({
  book: { overflow: 'hidden', borderWidth: 1, borderColor: '#6E4AA4', backgroundColor: '#1B1029', shadowColor: LEDGER_V2_COLORS.violet, shadowOpacity: 0.22, shadowRadius: 10 },
  bookSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#6F39AA' },
  bookRule: { position: 'absolute', height: 1, backgroundColor: '#9A6DD1' },
  bookMark: { position: 'absolute', borderWidth: 1, borderColor: '#C192FF', backgroundColor: '#4B216D' },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  headerBack: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.raised },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: LEDGER_V2_COLORS.text, fontSize: 27, lineHeight: 31, fontWeight: '700', letterSpacing: -0.55 },
  headerSubtitle: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 11.5, lineHeight: 16 },
  pageState: { minHeight: 520, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 26 },
  pageStateTitle: { color: LEDGER_V2_COLORS.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  pageStateBody: { maxWidth: 320, color: LEDGER_V2_COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { marginTop: 8, minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 13, borderWidth: 1, borderColor: '#5A3E77' },
  retryText: { color: '#D4B7FF', fontWeight: '700' },
  contextWrap: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  contextLabel: { color: LEDGER_V2_COLORS.subtle, fontFamily: SLFontFamilies.technical, fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
  contextRail: { flexDirection: 'row', gap: 6 },
  contextChip: { flex: 1, minHeight: 35, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderRadius: 10, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.inset },
  contextChipSelected: { borderColor: '#734AA1', backgroundColor: LEDGER_V2_COLORS.violetSoft },
  contextChipText: { color: LEDGER_V2_COLORS.muted, fontSize: 9.5, fontWeight: '700' },
  contextChipTextSelected: { color: '#D9C1FF' },
  sectionHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 9 },
  sectionCopy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { color: LEDGER_V2_COLORS.violet, fontFamily: SLFontFamilies.technical, fontSize: 9, fontWeight: '700', letterSpacing: 1.15, textTransform: 'uppercase' },
  sectionTitle: { color: LEDGER_V2_COLORS.text, fontSize: 19, lineHeight: 23, fontWeight: '700' },
  sectionAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionActionText: { color: LEDGER_V2_COLORS.violet, fontSize: 10.5, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', minHeight: 23, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontFamily: SLFontFamilies.technical, fontSize: 8.5, lineHeight: 11, fontWeight: '800', letterSpacing: 0.65, textTransform: 'uppercase' },
  metric: { flex: 1, minWidth: 0, gap: 2 },
  metricValue: { color: LEDGER_V2_COLORS.text, fontSize: 23, lineHeight: 27, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricLabel: { color: LEDGER_V2_COLORS.muted, fontSize: 9.5, lineHeight: 13 },
  surface: { borderWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.raised },
  chapter: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  chapterNumber: { width: 25, color: '#887B99', fontFamily: SLFontFamilies.technical, fontSize: 11, fontWeight: '700' },
  chapterIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  chapterCopy: { flex: 1, minWidth: 0, gap: 2 },
  chapterTitle: { color: LEDGER_V2_COLORS.text, fontSize: 14.5, fontWeight: '700', letterSpacing: 0.2 },
  chapterDetail: { color: LEDGER_V2_COLORS.muted, fontSize: 10.5, lineHeight: 14 },
  emptyPlot: { alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  emptyPlotText: { color: LEDGER_V2_COLORS.subtle, fontSize: 10 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.987 }] },
});
