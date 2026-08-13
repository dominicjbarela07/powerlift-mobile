import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { bestForLift, canonicalLiftKey, displayWeight, kgToDisplay, type CurrentBest } from '@/lib/ledger-data';
import { coreLiftKey, type LedgerCoreLiftKey, type LedgerV2Scope, unitFor } from './types';
import { useLedgerV2Snapshot } from './data';
import { useLedgerV2Navigation } from './navigation';
import {
  LEDGER_V2_COLORS,
  LedgerBadge,
  LedgerContextBar,
  LedgerSection,
  LedgerSparkline,
  LedgerV2Header,
  LedgerV2PageState,
  accomplishmentLabel,
  accomplishmentTone,
  dateLabel,
  number,
} from './ui';

type StrengthTab = 'Core Lifts' | 'Rep Maxes' | 'PR History';

const LIFTS: readonly { key: LedgerCoreLiftKey; label: string; short: string; tone: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'squat', label: 'Squat', short: 'S', tone: '#A98BFF', icon: 'fitness-outline' },
  { key: 'bench', label: 'Bench Press', short: 'B', tone: '#D76EE7', icon: 'barbell-outline' },
  { key: 'deadlift', label: 'Deadlift', short: 'D', tone: '#D67A7E', icon: 'flash-outline' },
];

function repBucket(item: CurrentBest): number | null {
  const match = String(item.comparison_bucket || '').match(/^reps:(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function LedgerStrengthV2Screen() {
  const params = useLocalSearchParams<{ ledger_view?: string | string[] }>();
  const requestedView = Array.isArray(params.ledger_view) ? params.ledger_view[0] : params.ledger_view;
  const [scope, setScope] = useState<LedgerV2Scope>('3m');
  const [tab, setTab] = useState<StrengthTab>(() => requestedView === 'rep-maxes' ? 'Rep Maxes' : requestedView === 'pr-history' ? 'PR History' : 'Core Lifts');
  useEffect(() => {
    if (requestedView === 'rep-maxes') setTab('Rep Maxes');
    else if (requestedView === 'pr-history') setTab('PR History');
  }, [requestedView]);
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();

  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening Strength" body="Gathering qualifying performance evidence." />;
  if (error || !snapshot) return <LedgerV2PageState title="Strength is unavailable" body={error || 'No qualifying performance evidence was returned.'} onRetry={() => void reload()} />;
  const unit = unitFor(snapshot);
  const estimatedTotal = snapshot.progression.big_three_arc?.estimated_total_kg;
  const events = snapshot.accomplishments.filter((item) => coreLiftKey(item.core_movement_key || item.movement_label) !== null);

  return <View testID="ledger-v2-strength" style={styles.page}>
    <LedgerV2Header back onBack={back} title="Strength" subtitle="Core lifts, rep records, e1RM, and source evidence." />
    <View style={styles.tabs}>{(['Core Lifts', 'Rep Maxes', 'PR History'] as StrengthTab[]).map((value) => <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value}</Text></Pressable>)}</View>
    <LedgerContextBar value={scope} onChange={setScope} />

    {tab === 'Core Lifts' ? <>
      <View style={styles.totalHero}><Text style={styles.heroEyebrow}>CURRENT COMBINED e1RM</Text><View style={styles.heroValueRow}><Text style={styles.heroValue}>{estimatedTotal == null ? '—' : displayWeight(estimatedTotal, unit)}</Text>{estimatedTotal != null ? <Text style={styles.heroUnit}>{unit.toUpperCase()}</Text> : null}</View><Text style={styles.heroBody}>Sum of the latest qualifying squat, bench, and deadlift estimates. This is not a performed total.</Text></View>
      <LedgerSection eyebrow="Current authoritative state" title="Core lifts" />
      <View style={styles.lifts}>{LIFTS.map((lift) => {
        const profile = snapshot.progression.big_three_arc?.lifts?.find((item) => canonicalLiftKey(item.key || item.label) === lift.key);
        const weightBest = bestForLift(snapshot.currentBests, lift.key, 'weight');
        const e1rmBest = bestForLift(snapshot.currentBests, lift.key, 'e1rm');
        const points = (profile?.points || []).map((point) => point.value_kg).filter((value): value is number => typeof value === 'number');
        return <Pressable key={lift.key} onPress={() => push(`/(tabs)/ledger/strength/${lift.key}`)} style={({ pressed }) => [styles.liftCard, pressed && styles.pressed]}>
          <View style={styles.liftCardHeader}><View style={[styles.liftIcon, { borderColor: `${lift.tone}65`, backgroundColor: `${lift.tone}13` }]}><Ionicons name={lift.icon} size={22} color={lift.tone} /></View><View style={styles.liftCardTitle}><Text style={styles.liftName}>{lift.label}</Text><Text style={styles.liftContext}>{snapshot.progression.range?.label || 'Selected period'}</Text></View><Ionicons name="chevron-forward" size={18} color={LEDGER_V2_COLORS.subtle} /></View>
          <View style={styles.liftEvidence}><View><Text style={styles.evidenceLabel}>BEST PERFORMED WEIGHT</Text><Text style={styles.evidenceValue}>{weightBest ? `${displayWeight(weightBest.best_value, unit)} ${unit.toUpperCase()}` : '—'}</Text></View><View><Text style={styles.evidenceLabel}>BEST e1RM</Text><Text style={[styles.evidenceValue, { color: lift.tone }]}>{e1rmBest ? `${displayWeight(e1rmBest.best_value, unit)} ${unit.toUpperCase()}` : profile?.best_e1rm_kg ? `${displayWeight(profile.best_e1rm_kg, unit)} ${unit.toUpperCase()}` : '—'}</Text></View></View>
          <LedgerSparkline values={points.map((value) => kgToDisplay(value, unit))} tone={lift.tone} height={64} />
        </Pressable>;
      })}</View>
      <Pressable onPress={() => push('/(tabs)/ledger/variants')} style={({ pressed }) => [styles.variantDoor, pressed && styles.pressed]}><View style={styles.variantDoorIcon}><Ionicons name="git-branch-outline" size={23} color={LEDGER_V2_COLORS.magenta} /></View><View style={styles.variantDoorCopy}><Text style={styles.variantDoorTitle}>Core Variants</Text><Text style={styles.variantDoorBody}>Paused, tempo, grip, stance, and other independent movement histories.</Text></View><Ionicons name="arrow-forward" size={18} color={LEDGER_V2_COLORS.magenta} /></Pressable>
    </> : null}

    {tab === 'Rep Maxes' ? <>
      <LedgerSection eyebrow="Exact completed reps" title="Rep-max records" />
      <View style={styles.repMatrix}><View style={styles.repHeader}><Text style={[styles.repHeaderText, { flex: 1.4 }]}>LIFT</Text>{[1, 3, 5, 8].map((reps) => <Text key={reps} style={styles.repHeaderText}>{reps}RM</Text>)}</View>{LIFTS.map((lift) => <View key={lift.key} style={styles.repRow}><View style={[styles.repLift, { flex: 1.4 }]}><View style={[styles.repDot, { backgroundColor: lift.tone }]} /><Text style={styles.repLiftText}>{lift.label}</Text></View>{[1, 3, 5, 8].map((reps) => { const record = snapshot.currentBests.find((item) => canonicalLiftKey(item.core_movement_key || item.movement_label) === lift.key && item.metric === 'rep_max' && repBucket(item) === reps); return <Text key={reps} style={[styles.repValue, record && { color: lift.tone }]}>{record ? displayWeight(record.best_value, unit) : '—'}</Text>; })}</View>)}</View>
      <View style={styles.factNote}><Ionicons name="shield-checkmark-outline" size={18} color={LEDGER_V2_COLORS.cyan} /><Text style={styles.factNoteText}>Each cell is the heaviest canonical set completed for that exact rep count. Performed weight and e1RM remain separate records.</Text></View>
    </> : null}

    {tab === 'PR History' ? <>
      <LedgerSection eyebrow="Canonical accomplishment events" title="Core-lift PR history" />
      <View style={styles.history}>{events.map((event) => <Pressable key={event.id} onPress={() => push(`/(tabs)/ledger/achievements/${event.id}`)} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}><View style={[styles.historySeal, { borderColor: `${accomplishmentTone(event)}65`, backgroundColor: `${accomplishmentTone(event)}12` }]}><Text style={[styles.historySealText, { color: accomplishmentTone(event) }]}>PR</Text></View><View style={styles.historyCopy}><View style={styles.historyTitleRow}><Text style={styles.historyTitle}>{event.movement_label || 'Core lift'}</Text><LedgerBadge label={accomplishmentLabel(event)} tone={accomplishmentTone(event)} /></View><Text style={styles.historyMeta}>{dateLabel(event.occurred_at || event.workout_date)}{event.current_value != null ? ` · ${event.unit === 'reps' ? `${number(event.current_value)} reps` : `${displayWeight(event.current_value, unit)} ${unit.toUpperCase()}`}` : ''}</Text></View><Ionicons name="chevron-forward" size={16} color={LEDGER_V2_COLORS.subtle} /></Pressable>)}</View>
    </> : null}
  </View>;
}

export function LedgerLiftDetailV2Screen({ movementKey }: { movementKey: string }) {
  const [scope, setScope] = useState<LedgerV2Scope>('all');
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();
  const key = coreLiftKey(movementKey) || 'bench';
  const presentation = LIFTS.find((item) => item.key === key)!;

  if (loading && !snapshot) return <LedgerV2PageState loading title={`Opening ${presentation.label}`} body="Gathering exact source evidence." />;
  if (error || !snapshot) return <LedgerV2PageState title="Lift evidence is unavailable" body={error || 'No canonical lift evidence was returned.'} onRetry={() => void reload()} />;
  const unit = unitFor(snapshot);
  const profile = snapshot.progression.big_three_arc?.lifts?.find((item) => canonicalLiftKey(item.key || item.label) === key);
  const weightBest = bestForLift(snapshot.currentBests, key, 'weight');
  const e1rmBest = bestForLift(snapshot.currentBests, key, 'e1rm');
  const reps = snapshot.currentBests.filter((item) => canonicalLiftKey(item.core_movement_key || item.movement_label) === key && item.metric === 'rep_max').sort((left, right) => (repBucket(left) || 99) - (repBucket(right) || 99));
  const events = snapshot.accomplishments.filter((item) => coreLiftKey(item.core_movement_key || item.movement_label) === key);
  const points = (profile?.points || []).map((point) => point.value_kg).filter((value): value is number => typeof value === 'number').map((value) => kgToDisplay(value, unit));
  const source = weightBest?.event || events[0];
  const performedReps = typeof source?.evidence?.actual_reps === 'number' ? source.evidence.actual_reps : null;

  return <View testID="ledger-v2-lift-detail" style={styles.page}>
    <LedgerV2Header back onBack={back} title={presentation.label} subtitle="Performed records, e1RM, rep maxes, and PR history." />
    <LedgerContextBar value={scope} onChange={setScope} />
    <View style={[styles.detailHero, { borderColor: `${presentation.tone}55` }]}><LedgerBadge label={weightBest ? 'Weight PR' : 'Best available evidence'} tone={presentation.tone} /><Text style={styles.detailLabel}>BEST PERFORMED SET</Text><View style={styles.detailValueRow}><Text style={styles.detailValue}>{weightBest ? displayWeight(weightBest.best_value, unit) : '—'}</Text>{weightBest ? <Text style={styles.detailUnit}>{unit.toUpperCase()}{performedReps ? ` × ${performedReps}` : ''}</Text> : null}</View><Text style={styles.detailDate}>{dateLabel(source?.occurred_at || source?.workout_date)}</Text><View style={styles.detailDelta}><Text style={[styles.detailDeltaValue, { color: presentation.tone }]}>{source?.delta ? `+${displayWeight(Math.abs(source.delta), unit)} ${unit.toUpperCase()}` : 'No prior comparison'}</Text><Text style={styles.detailDeltaLabel}>vs previous canonical record</Text></View></View>
    <LedgerSection eyebrow="Observed estimates" title="e1RM progression" />
    <View style={styles.chartCard}><View style={styles.chartHeader}><View><Text style={styles.chartMetric}>{e1rmBest ? `${displayWeight(e1rmBest.best_value, unit)} ${unit.toUpperCase()}` : profile?.best_e1rm_kg ? `${displayWeight(profile.best_e1rm_kg, unit)} ${unit.toUpperCase()}` : '—'}</Text><Text style={styles.chartCaption}>best e1RM in canonical evidence</Text></View><LedgerBadge label={`${points.length} observations`} tone={LEDGER_V2_COLORS.cyan} /></View><LedgerSparkline values={points} tone={presentation.tone} height={110} /></View>
    <LedgerSection eyebrow="Exact rep buckets" title="Rep-max matrix" />
    <View style={styles.repDetailGrid}>{reps.length ? reps.map((item) => <Pressable key={item.projection_id} onPress={() => item.event?.source_set_log_id && push(`/(tabs)/ledger/archive/set/${item.event.source_set_log_id}`)} style={styles.repDetailCell}><Text style={styles.repDetailLabel}>{repBucket(item) || '—'}RM</Text><Text style={[styles.repDetailValue, { color: presentation.tone }]}>{displayWeight(item.best_value, unit)}</Text><Text style={styles.repDetailUnit}>{unit.toUpperCase()}</Text></Pressable>) : <Text style={styles.noEvidence}>No exact rep-max records are available yet.</Text>}</View>
    <LedgerSection eyebrow="Canonical record events" title="PR history" />
    <View style={styles.history}>{events.map((event) => <Pressable key={event.id} onPress={() => push(`/(tabs)/ledger/achievements/${event.id}`)} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}><View style={styles.historyCopy}><View style={styles.historyTitleRow}><Text style={styles.historyTitle}>{accomplishmentLabel(event)}</Text><LedgerBadge label={dateLabel(event.occurred_at || event.workout_date)} tone={accomplishmentTone(event)} /></View><Text style={styles.historyMeta}>{event.current_value != null ? `${event.unit === 'reps' ? number(event.current_value) : displayWeight(event.current_value, unit)} ${event.unit === 'reps' ? 'reps' : unit.toUpperCase()}` : 'Recorded accomplishment'}{event.delta ? ` · +${displayWeight(Math.abs(event.delta), unit)} ${unit.toUpperCase()}` : ''}</Text></View><Ionicons name="chevron-forward" size={16} color={LEDGER_V2_COLORS.subtle} /></Pressable>)}</View>
    {source?.source_set_log_id ? <Pressable onPress={() => push(`/(tabs)/ledger/archive/set/${source.source_set_log_id}`)} style={({ pressed }) => [styles.sourceAction, pressed && styles.pressed]}><Ionicons name="document-text-outline" size={20} color={presentation.tone} /><View style={styles.sourceCopy}><Text style={styles.sourceTitle}>View source SetLog</Text><Text style={styles.sourceBody}>Open the exact performed evidence behind this record.</Text></View><Ionicons name="arrow-forward" size={18} color={presentation.tone} /></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 0, paddingBottom: 24 },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: LEDGER_V2_COLORS.cyan },
  tabText: { color: LEDGER_V2_COLORS.muted, fontSize: 10, fontWeight: '700' },
  tabTextActive: { color: LEDGER_V2_COLORS.text },
  totalHero: { minHeight: 164, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#26333B', backgroundColor: '#060A0D', padding: 18 },
  heroEyebrow: { color: LEDGER_V2_COLORS.cyan, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroValue: { color: LEDGER_V2_COLORS.text, fontSize: 47, lineHeight: 53, fontWeight: '700', letterSpacing: -1.5 },
  heroUnit: { color: LEDGER_V2_COLORS.muted, fontSize: 13, fontWeight: '700' },
  heroBody: { maxWidth: 330, color: LEDGER_V2_COLORS.muted, fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
  lifts: { gap: 9, paddingHorizontal: 12 },
  liftCard: { minHeight: 196, borderRadius: 14, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object, padding: 14 },
  liftCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  liftIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1 },
  liftCardTitle: { flex: 1, minWidth: 0 },
  liftName: { color: LEDGER_V2_COLORS.text, fontSize: 16, fontWeight: '700' },
  liftContext: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  liftEvidence: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginTop: 15, marginBottom: 8 },
  evidenceLabel: { color: LEDGER_V2_COLORS.subtle, fontSize: 7.5, fontWeight: '800', letterSpacing: 0.7 },
  evidenceValue: { marginTop: 3, color: LEDGER_V2_COLORS.text, fontSize: 17, fontWeight: '700' },
  variantDoor: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#422D47', backgroundColor: '#0F0912', padding: 13 },
  variantDoorIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: `${LEDGER_V2_COLORS.magenta}12` },
  variantDoorCopy: { flex: 1, minWidth: 0 },
  variantDoorTitle: { color: LEDGER_V2_COLORS.text, fontSize: 15, fontWeight: '700' },
  variantDoorBody: { marginTop: 3, color: LEDGER_V2_COLORS.muted, fontSize: 9.5, lineHeight: 13 },
  repMatrix: { marginHorizontal: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: LEDGER_V2_COLORS.line },
  repHeader: { minHeight: 37, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0F14', paddingHorizontal: 10 },
  repHeaderText: { flex: 1, color: LEDGER_V2_COLORS.subtle, fontSize: 8, fontWeight: '800', textAlign: 'center' },
  repRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, paddingHorizontal: 10 },
  repLift: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  repDot: { width: 6, height: 6, borderRadius: 3 },
  repLiftText: { color: LEDGER_V2_COLORS.text, fontSize: 10.5, fontWeight: '700' },
  repValue: { flex: 1, color: LEDGER_V2_COLORS.subtle, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  factNote: { flexDirection: 'row', gap: 10, margin: 12, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#24343B', backgroundColor: '#071014' },
  factNoteText: { flex: 1, color: LEDGER_V2_COLORS.muted, fontSize: 10, lineHeight: 15 },
  history: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  historyRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  historySeal: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1 },
  historySealText: { fontSize: 10, fontWeight: '800' },
  historyCopy: { flex: 1, minWidth: 0, gap: 4 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { flex: 1, color: LEDGER_V2_COLORS.text, fontSize: 13.5, fontWeight: '700' },
  historyMeta: { color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  detailHero: { minHeight: 230, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, backgroundColor: '#09080D', padding: 18 },
  detailLabel: { marginTop: 15, color: LEDGER_V2_COLORS.subtle, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.9 },
  detailValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  detailValue: { color: LEDGER_V2_COLORS.text, fontSize: 48, lineHeight: 54, fontWeight: '700', letterSpacing: -1.6 },
  detailUnit: { color: LEDGER_V2_COLORS.muted, fontSize: 13, fontWeight: '700' },
  detailDate: { color: LEDGER_V2_COLORS.muted, fontSize: 10 },
  detailDelta: { alignItems: 'center', marginTop: 13 },
  detailDeltaValue: { fontSize: 14, fontWeight: '800' },
  detailDeltaLabel: { marginTop: 2, color: LEDGER_V2_COLORS.subtle, fontSize: 8.5 },
  chartCard: { marginHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object, padding: 14 },
  chartHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  chartMetric: { color: LEDGER_V2_COLORS.text, fontSize: 21, fontWeight: '700' },
  chartCaption: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 9 },
  repDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 12 },
  repDetailCell: { width: '23%', minHeight: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  repDetailLabel: { color: LEDGER_V2_COLORS.subtle, fontSize: 8, fontWeight: '800' },
  repDetailValue: { marginTop: 4, fontSize: 18, fontWeight: '700' },
  repDetailUnit: { color: LEDGER_V2_COLORS.muted, fontSize: 7.5, fontWeight: '700' },
  noEvidence: { color: LEDGER_V2_COLORS.muted, fontSize: 11, padding: 16 },
  sourceAction: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, margin: 12, borderRadius: 13, borderWidth: 1, borderColor: '#3B3150', backgroundColor: '#0D0912', padding: 13 },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceTitle: { color: LEDGER_V2_COLORS.text, fontSize: 13.5, fontWeight: '700' },
  sourceBody: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.987 }] },
});
