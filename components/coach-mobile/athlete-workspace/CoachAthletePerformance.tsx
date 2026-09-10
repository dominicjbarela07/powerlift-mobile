import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { FloatingDisplayUnitRegistration, floatingControlBottom, SL_FLOATING_CONTROL } from '@/components/ui/floating-control-coordinator';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies, SLLayout } from '@/constants/theme';
import { workspaceLedgerParams } from '@/lib/coach-performance';
import { buildPerformanceSummary, performanceRecordDetail, performanceTaskChange, type PerformanceObservation } from '@/lib/coach-performance-summary';
import { fetchLedgerAccomplishments, fetchLedgerCurrentBests, kgToDisplay, type AccomplishmentEvent, type CurrentBestSnapshot, type LedgerUnit } from '@/lib/ledger-data';
import { fetchLedgerExplorationIndex, type LedgerExplorationIndex } from '@/lib/ledger-exploration';
import { LEDGER_INDEX_ASSETS } from '@/lib/ledger-index-assets';
import { canonicalPrHistory, competitiveStanding, resolveLedgerClubsRuntimeState } from '@/lib/ledger-rewards';
import { fetchLedgerCoreVariants, type LedgerCoreVariantsStory } from '@/lib/ledger-variants';
import { useCoachAthleteWorkspace } from './CoachAthleteWorkspaceContext';
import { Chapter, deltaLabel, EvidenceLink, INK, LIFT_COLORS, loadLabel, PerformanceLoading, periodDate, StrengthHero, v } from './PerformanceVisuals';

export function CoachAthletePerformance() {
  const router = useRouter();
  const workspace = useCoachAthleteWorkspace();
  const { unit, setUnit } = workspace;
  const { performance: data, period, setPeriod, subjectKey, athleteId, reload } = workspace;
  const insets = useSafeAreaInsets();
  const floatingClearance = floatingControlBottom({ context: 'tab-screen', safeAreaBottom: insets.bottom, slot: 1 })
    + SL_FLOATING_CONTROL.size + SL_FLOATING_CONTROL.gap;
  const savedScroll = useRef(workspace.performanceScrollY);
  const [events, setEvents] = useState<AccomplishmentEvent[]>([]);
  const [bests, setBests] = useState<CurrentBestSnapshot | null>(null);
  const [exploration, setExploration] = useState<LedgerExplorationIndex | null>(null);
  const [variants, setVariants] = useState<LedgerCoreVariantsStory | null>(null);
  const [supplementError, setSupplementError] = useState(false);
  const [supplementLoading, setSupplementLoading] = useState(true);
  const [observationsOpen, setObservationsOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const open = (room: string, extra: Record<string, string> = {}) => {
    setObservationsOpen(false);
    router.push({ pathname: `/(tabs)/ledger/${room}` as any, params: { ...workspaceLedgerParams(athleteId), ...extra } });
  };
  useEffect(() => {
    let active = true;
    setEvents([]); setBests(null);
    // Bounded canonical projections; never paginate an entire Ledger on entry.
    void Promise.all([fetchLedgerAccomplishments(24, athleteId), fetchLedgerCurrentBests(athleteId)])
      .then(([recent, current]) => { if (active) { setEvents(recent); setBests(current); } })
      .catch((error) => { if (active && [401, 403, 404].includes(error?.status)) void reload(true); });
    return () => { active = false; };
  }, [athleteId, subjectKey, retry, reload]);
  useEffect(() => {
    if (!data) return;
    let active = true;
    setSupplementError(false); setSupplementLoading(true);
    // Load after the primary projection, including short/sparse pages that cannot scroll.
    void Promise.all([fetchLedgerExplorationIndex(athleteId), fetchLedgerCoreVariants(athleteId)])
      .then(([accessories, core]) => {
        if (!active) return;
        if (accessories.athlete.id !== athleteId || core.athlete.id !== athleteId) { void reload(true); return; }
        setExploration(accessories); setVariants(core);
      }).catch(() => { if (active) setSupplementError(true); })
      .finally(() => { if (active) setSupplementLoading(false); });
    return () => { active = false; };
  }, [athleteId, data, subjectKey, retry, reload]);
  const refresh = () => { workspace.reloadPerformance(); void reload(true); setRetry((value) => value + 1); };
  const context = data?.coaching_context;
  const model = buildPerformanceSummary({ data, exploration, variants, prs: canonicalPrHistory(events), unit });
  const runtime = bests ? resolveLedgerClubsRuntimeState(bests.items, bests.strengthStandard, bests.strengthStanding, unit) : null;
  const standing = runtime ? competitiveStanding(runtime.totalState, runtime.standard?.sex) : null;
  const lifts = data?.big_three_arc?.lifts || [];
  const hasStrength = lifts.some((lift) => lift.current_e1rm_kg != null || lift.strength_lenses?.weight_on_bar.heaviest_kg != null);
  const completed = data?.consistency?.sessions_completed || 0;
  const assigned = data?.consistency?.sessions_assigned || 0;
  const completion = data?.consistency?.completion_rate_pct;
  const recovery = model.recovery;
  const latestPr = model.recentPrs[0];

  return <>
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} slot={1} testID="coach-athlete-performance-unit-toggle" />
    <ScrollView testID="coach-athlete-performance" contentContainerStyle={[s.content, { paddingBottom: floatingClearance }]} showsVerticalScrollIndicator={false} contentOffset={{ x: 0, y: savedScroll.current }}
      onScroll={(event) => workspace.setPerformanceScrollY(event.nativeEvent.contentOffset.y)} scrollEventThrottle={120}
      refreshControl={<RefreshControl refreshing={workspace.refreshing} tintColor={INK.violet} onRefresh={refresh} />}>
      <View style={s.intro}><Text style={s.title}>Performance</Text><Text style={v.body}>{workspace.bootstrap?.current_training?.program_name || 'Strength, training & recovery'}</Text></View>
      <View style={s.periodRow}>{(['30d', '90d', '180d'] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: period === value }} accessibilityLabel={`${value.slice(0, -1)} days`} onPress={() => setPeriod(value)} style={[s.period, period === value && s.periodActive]}><Text style={[s.periodText, period === value && { color: INK.text }]}>{value.slice(0, -1)} days</Text></Pressable>)}<View style={v.flex} /><Text style={s.periodUnit}>{unit.toUpperCase()}</Text></View>
      {!data ? <PerformanceLoading error={workspace.performanceError} onRetry={workspace.reloadPerformance} /> : <>
        {hasStrength ? <>
          <StrengthHero data={data} unit={unit} dense onLiftPress={(lift) => open('strength', { lift })} />
          <Text style={s.periodFoot}>{periodDate(data.range?.start_date)} — {periodDate(data.range?.end_date)} · estimated strength</Text>
          <Chapter title="Strength development" action="Strength" onPress={() => open('strength')}>
            <View style={s.strengthEvidence} testID="performance-strength-evidence">{lifts.map((lift) => {
              const weight = lift.strength_lenses?.weight_on_bar;
              const change = weight?.change_kg;
              return <Pressable key={lift.key} accessibilityRole="button" accessibilityLabel={`Open ${lift.label} recorded strength`} onPress={() => open('strength', { lift: lift.key! })} style={({ pressed }) => [s.strengthLift, pressed && v.pressed]}>
                <Image accessible={false} source={LEDGER_INDEX_ASSETS.coreLift[lift.key as 'squat' | 'bench' | 'deadlift']} style={s.liftArt} />
                <View style={s.liftLabel}><Text style={s.liftName}>{lift.label}</Text><Ionicons name="chevron-forward" size={13} color={LIFT_COLORS[lift.key!]} /></View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={s.literalLoad}>{loadLabel(weight?.heaviest_kg, unit)}</Text>
                <Text style={v.meta}>{weight?.heaviest_kg == null ? 'No recorded load' : 'Heaviest in period'}</Text>
                {change != null && (weight?.points.length || 0) > 1 ? <Text style={[s.liftChange, { color: change < 0 ? INK.magenta : INK.green }]}>{deltaLabel(change, unit)} on bar</Text> : null}
              </Pressable>;
            })}</View>
          </Chapter>
        </> : <View style={s.emptyStrength}><Text style={v.rowTitle}>No recorded strength yet</Text><Text style={v.body}>Competition lift estimates appear with recorded sets.</Text><EvidenceLink title="Open Strength" onPress={() => open('strength')} /></View>}

        {model.hasOutput ? <Chapter title="Training output" action="Archive" onPress={() => open('archive')}>
          <View style={s.executionRow}><View style={s.ring}>
            <Svg width={74} height={74} viewBox="0 0 74 74"><Circle cx={37} cy={37} r={31} fill="none" stroke="#20252A" strokeWidth={5} />{completion != null ? <Circle cx={37} cy={37} r={31} fill="none" stroke={INK.green} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${Math.max(0, Math.min(100, completion)) * 1.948} 195`} rotation={-90} origin="37,37" /> : null}</Svg>
            <View style={s.ringValue}><Text style={s.executionPercent}>{completion == null ? '—' : `${Math.round(completion)}%`}</Text></View>
          </View><View style={v.flex}><Text style={s.sessionCount}>{completed}<Text style={s.sessionDenominator}> / {assigned} Sessions</Text></Text><Text style={v.body}>completed · {data.consistency?.missed_or_incomplete || 0} incomplete</Text><Text style={s.outputContext}><Text style={s.outputStrong}>{context?.working_sets ?? 0}</Text> working sets · <Text style={s.outputStrong}>{context?.frequency_per_week ?? 0}</Text> / week</Text></View></View>
          <View style={s.volumeHeading}><View><Text style={v.meta}>Performed volume</Text><Text style={s.volumeNumber}>{Math.round(kgToDisplay(context?.volume_kg || 0, unit)).toLocaleString()}<Text style={s.volumeUnit}> {unit}</Text></Text></View><View style={s.volumeChange}><Text style={[s.changeNumber, { color: (context?.volume_change_pct || 0) < 0 ? INK.magenta : INK.green }]}>{context?.volume_change_pct == null ? '—' : `${context.volume_change_pct > 0 ? '+' : ''}${context.volume_change_pct}%`}</Text><Text style={v.meta}>vs. prior {context?.period_days} days</Text></View></View>
          <WeeklyWork points={context?.weekly || []} unit={unit} />
        </Chapter> : null}

        {model.observationPreview.length ? <Chapter title="Worth noticing">
          <View>{model.observationPreview.map((item) => <Observation key={item.id} item={item} onPress={() => open(item.room, item.params)} />)}</View>
          {model.observations.length > model.observationPreview.length ? <EvidenceLink quiet title={`View more observations (${model.observations.length - model.observationPreview.length})`} onPress={() => setObservationsOpen(true)} /> : null}
        </Chapter> : null}

        {model.hasSupplemental ? <Chapter title="Supplemental development">
          {model.accessories?.summary.movement_count ? <View style={s.supplementGroup}>
            <View style={s.groupHeading}><Text style={s.groupTitle}>Accessories</Text><Text style={v.meta}>{model.accessories.period.label}</Text></View>
            <Text style={v.body}>{model.accessoryProgressCount ? `${model.accessoryProgressCount} movements with matched-task progress` : `${model.accessories.summary.movement_count} movements recorded · no matched-task change`}</Text>
            {model.accessoryPreview.map((progress) => {
              const movement = model.accessories!.movements.find((m) => m.id === progress.movement_id)!;
              return <Pressable key={progress.identity_key} accessibilityRole="button" accessibilityLabel={`Open ${movement.name} accessory evidence`} onPress={() => open(`movement/${movement.id}`)} style={({ pressed }) => [s.movementRow, pressed && v.pressed]}>
                <CanonicalMovementArtwork movement={movement} size={54} /><View style={v.flex}><Text style={v.rowTitle}>{movement.name}</Text><Text style={s.progressText}>{performanceTaskChange(progress.prior, progress.current, unit)}</Text><Text style={v.meta}>{progress.assisted ? 'Assistance · ' : ''}{progress.current.equipment_model || progress.current.equipment_type?.replace(/_/g, ' ') || 'Same equipment'} · {periodDate(progress.occurred_on)}</Text></View><Ionicons name="chevron-forward" size={15} color={INK.muted} />
              </Pressable>;
            })}
            <EvidenceLink quiet title="Open Accessories" onPress={() => open('accessories')} />
          </View> : null}
          {model.core?.movements.length ? <View style={s.supplementGroup}>
            <Text style={s.groupTitle}>Core Variants</Text>
            <View style={s.rotation}>{model.core.families.map((family) => <View key={family.family} style={v.flex}><Text style={[s.rotationFamily, { color: LIFT_COLORS[family.family] }]}>{family.label}</Text><Text style={v.meta}>{family.active_count} active</Text></View>)}</View>
            {model.variantPreview.map((movement) => {
              const p = movement.latest_progression!;
              return <Pressable key={movement.core_movement_id} accessibilityRole="button" accessibilityLabel={`Open ${movement.name} variant evidence`} onPress={() => open(`variant/${movement.core_movement_id}`)} style={({ pressed }) => [s.movementRow, pressed && v.pressed]}>
                <CanonicalMovementArtwork movement={{ core_movement_id: movement.core_movement_id, core_movement: { id: movement.core_movement_id, family: movement.family, kind: 'variant' } }} size={54} /><View style={v.flex}><Text style={v.rowTitle}>{movement.name}</Text><Text style={s.progressText}>{performanceTaskChange(p.prior, p.current, unit)}</Text><Text style={v.meta}>{movement.parent_lift_label} variant · {periodDate(p.occurred_on)}</Text></View><Ionicons name="chevron-forward" size={15} color={INK.muted} />
              </Pressable>;
            })}
            <EvidenceLink quiet title="Open Core Variants" onPress={() => open('variants')} />
          </View> : null}
        </Chapter> : supplementError ? <EvidenceLink title="Reload supplemental evidence" onPress={() => setRetry((value) => value + 1)} /> : supplementLoading ? <Text style={s.loadingEvidence}>Loading movement summaries…</Text> : null}

        {model.hasRecovery ? <Chapter title="Body & Readiness" action="Journey" onPress={() => open('journey')}>
          {recovery.bodyweight.length ? <>
            <View style={s.bodyweightHeading}><View><Text style={v.meta}>Reported bodyweight</Text><Text style={s.volumeNumber}>{loadLabel(recovery.latestWeight, unit)}</Text></View><View style={s.volumeChange}><Text style={v.rowTitle}>{recovery.weightChange == null ? '—' : deltaLabel(recovery.weightChange, unit)}</Text><Text style={v.meta}>{recovery.bodyweight.length} reported days</Text></View></View>
            <AnalyticalTimeSeriesChart height={168} readableText selectedInitially="none" showLegend={false} metric={{ key: 'bodyweight', label: 'Bodyweight', kind: 'weight', unit, maximumFractionDigits: 1 }} series={[{ key: 'bodyweight', label: 'Reported', color: INK.magenta, points: recovery.bodyweight.map((point) => ({ date: point.training_date, value: kgToDisplay(point.reported_bodyweight_kg, unit) })) }]} />
          </> : null}
          {recovery.readiness.length ? <View style={s.readinessLine}><View style={v.flex}><Text style={v.rowTitle}>Readiness</Text><Text style={v.meta}>{recovery.recentAverage == null ? `Latest · ${periodDate(recovery.latestReadiness?.date)}` : `7-day average · ${recovery.recentCount} reported days`}</Text></View><View style={s.volumeChange}><Text style={s.readinessValue}>{(recovery.recentAverage ?? recovery.latestReadiness!.value).toFixed(1)}<Text style={s.volumeUnit}> / 5</Text></Text><Text style={[v.meta, { color: recovery.readinessChange != null && recovery.readinessChange < 0 ? INK.magenta : INK.muted }]}>{recovery.readinessChange == null ? `Latest ${recovery.latestReadiness!.value.toFixed(1)} /5` : recovery.readinessChange === 0 ? 'Stable vs. prior week' : `${recovery.readinessChange > 0 ? '+' : ''}${recovery.readinessChange.toFixed(1)} vs. prior week`}</Text></View></View> : null}
          {recovery.checkIn.length ? <Text style={s.checkInLine}>{periodDate(recovery.checkInDate)} · {recovery.checkIn.map((item) => `${item.label} ${item.value} ${item.suffix}`).join(' · ')}</Text> : null}
        </Chapter> : null}

        <Chapter title="Athlete Record">
          {standing || latestPr ? <Pressable accessibilityRole="button" accessibilityLabel="Open Achievements" onPress={() => open('achievements')} style={({ pressed }) => [s.recordSummary, pressed && v.pressed]}>
            <Image source={LEDGER_INDEX_ASSETS.chapter.achievements} style={s.trophy} /><View style={v.flex}><Text style={s.recordLabel}>{standing ? 'Competitive Standing' : 'Recent Milestones'}</Text><Text style={s.standingText}>{standing ? standing.summary : `${model.recentPrs.length} recent personal records`}</Text>{latestPr ? <Text style={v.body}>{performanceRecordDetail(latestPr, unit)}</Text> : <Text style={v.meta}>Sex-matched OpenPowerlifting reference</Text>}</View><Ionicons name="chevron-forward" size={17} color={INK.gold} />
          </Pressable> : null}
          <View style={s.recordLinks}>{[...(!standing && !latestPr ? [['Achievements', 'achievements']] : []), ['Journey', 'journey'], ['Archive', 'archive']].map(([label, room]) => <Pressable key={room} accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={() => open(room)} style={({ pressed }) => [s.recordLink, pressed && v.pressed]}><Text style={s.recordLinkText}>{label}</Text><Ionicons name="arrow-forward" color={INK.violet} size={15} /></Pressable>)}</View>
          {!model.accessories?.summary.movement_count || !model.core?.movements.length ? <View style={s.recordLinks}>{[...(!model.accessories?.summary.movement_count ? [['Accessories', 'accessories']] : []), ...(!model.core?.movements.length ? [['Core Variants', 'variants']] : [])].map(([label, room]) => <Pressable key={room} accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={() => open(room)} style={s.recordLink}><Text style={s.recordLinkText}>{label}</Text><Ionicons name="arrow-forward" color={INK.violet} size={15} /></Pressable>)}</View> : null}
        </Chapter>
      </>}
    </ScrollView>
    <StrengthLedgerBottomSheet accessibilityLabel="Performance observations" visible={observationsOpen} onDismiss={() => setObservationsOpen(false)} heightFraction={0.75}>
      <ScrollView contentContainerStyle={s.observationsSheet}><Text style={s.sheetTitle}>Performance observations</Text><Text style={v.body}>Ranked by evidence, recency and size of change.</Text>{model.observations.map((item) => <Observation key={item.id} item={item} onPress={() => open(item.room, item.params)} />)}</ScrollView>
    </StrengthLedgerBottomSheet>
  </>;
}

function Observation({ item, onPress }: { item: PerformanceObservation; onPress: () => void }) {
  const color = item.kind === 'readiness' ? INK.magenta : item.kind === 'output' ? INK.cyan : INK.violet;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Inspect observation: ${item.title}`} onPress={onPress} style={({ pressed }) => [s.observation, pressed && v.pressed]}><View style={[s.observationMark, { backgroundColor: color }]} /><View style={v.flex}><Text style={s.observationTitle}>{item.title}</Text><Text style={v.body}>{item.detail}</Text></View><Ionicons name="chevron-forward" size={15} color={INK.muted} /></Pressable>;
}
function WeeklyWork({ points, unit }: { points: { date: string; volume_kg: number; set_count: number; session_count: number }[]; unit: LedgerUnit }) {
  const [selected, setSelected] = useState<number | null>(null);
  const maximum = Math.max(1, ...points.map((point) => point.volume_kg));
  const point = selected == null ? null : points[selected];
  return <View><View style={s.bars}>{points.map((row, index) => <Pressable key={row.date} accessibilityRole="button" accessibilityLabel={`Week of ${periodDate(row.date)}: ${row.set_count} sets, ${loadLabel(row.volume_kg, unit)} volume`} onPress={() => setSelected(index)} style={s.barTarget}><View style={[s.bar, { height: row.volume_kg > 0 ? Math.max(3, row.volume_kg / maximum * 54) : 1, backgroundColor: selected === index ? INK.cyan : INK.violet, opacity: selected == null || selected === index ? 0.95 : 0.4 }]} /></Pressable>)}</View><View style={s.barAxis}><Text style={v.meta}>{periodDate(points[0]?.date)}</Text><Text style={v.meta}>WEEKLY VOLUME</Text><Text style={v.meta}>{periodDate(points.at(-1)?.date)}</Text></View>{point ? <Text style={s.barDetail}>{periodDate(point.date)} · {point.set_count} sets · {loadLabel(point.volume_kg, unit)}</Text> : null}</View>;
}

const floatingSheetClearance = SL_FLOATING_CONTROL.sheetBottomInset;
const s = StyleSheet.create({
  content: { paddingHorizontal: SLLayout.screenGutter, paddingTop: 12, gap: 10 },
  intro: { gap: 2 }, title: { fontFamily: SLFontFamilies.display, color: INK.text, fontSize: 30 },
  periodRow: { flexDirection: 'row', alignItems: 'center', borderBottomColor: INK.line, borderBottomWidth: 1, marginBottom: 2 },
  period: { minHeight: 44, paddingHorizontal: 15, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  periodActive: { borderBottomColor: INK.violet }, periodText: { color: INK.muted, fontSize: 14 }, periodUnit: { color: INK.quiet, fontSize: 12, paddingRight: 4 },
  periodFoot: { color: INK.muted, fontSize: 12, paddingHorizontal: 3 },
  emptyStrength: { gap: 6, paddingVertical: 16 },
  strengthEvidence: { flexDirection: 'row', gap: 10 }, strengthLift: { flex: 1, minWidth: 0, gap: 4 }, liftArt: { width: '100%', height: 57, resizeMode: 'contain' }, liftLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, liftName: { color: INK.text, fontSize: 14, fontWeight: '600' }, literalLoad: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 20 }, liftChange: { fontSize: 12, lineHeight: 16 },
  executionRow: { flexDirection: 'row', alignItems: 'center', gap: 15 }, ring: { width: 74, height: 74 }, ringValue: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center' }, executionPercent: { color: INK.text, fontFamily: SLFontFamilies.body, fontWeight: '700', fontSize: 19 }, sessionCount: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 27 }, sessionDenominator: { color: INK.muted, fontFamily: SLFontFamilies.body, fontSize: 16 }, outputContext: { color: INK.muted, fontSize: 14, marginTop: 5 }, outputStrong: { color: INK.text, fontWeight: '600' },
  volumeHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 7 }, volumeNumber: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 24, marginTop: 3 }, volumeUnit: { color: INK.muted, fontSize: 14 }, volumeChange: { alignItems: 'flex-end', gap: 3 }, changeNumber: { fontFamily: SLFontFamilies.numeric, fontSize: 18 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 62, borderBottomWidth: 1, borderBottomColor: INK.line }, barTarget: { flex: 1, height: 62, justifyContent: 'flex-end', paddingHorizontal: 1 }, bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 }, barAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }, barDetail: { color: INK.cyan, fontSize: 13, marginTop: 6 },
  observation: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomColor: INK.line, borderBottomWidth: StyleSheet.hairlineWidth }, observationMark: { width: 3, height: 29, borderRadius: 2 }, observationTitle: { color: INK.text, fontSize: 15, lineHeight: 20, fontWeight: '600', marginBottom: 3 }, observationsSheet: { paddingHorizontal: SLLayout.screenGutter, paddingBottom: floatingSheetClearance, gap: 12 }, sheetTitle: { color: INK.text, fontFamily: SLFontFamilies.display, fontSize: 25 },
  supplementGroup: { gap: 7 }, groupHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, groupTitle: { color: INK.text, fontSize: 18, fontWeight: '600' }, movementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, progressText: { color: INK.green, fontSize: 14, lineHeight: 20, marginVertical: 3 }, rotation: { flexDirection: 'row', gap: 8, paddingVertical: 5 }, rotationFamily: { fontSize: 13, fontWeight: '600', marginBottom: 3 }, loadingEvidence: { color: INK.muted, fontSize: 13, paddingVertical: 8 },
  bodyweightHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, readinessLine: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, borderTopColor: INK.line, borderTopWidth: StyleSheet.hairlineWidth }, readinessValue: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 25 }, checkInLine: { color: INK.muted, fontSize: 13, lineHeight: 19 },
  recordSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }, trophy: { width: 64, height: 86, resizeMode: 'contain' }, recordLabel: { color: INK.gold, fontSize: 13, fontWeight: '600', marginBottom: 5 }, standingText: { color: '#F1DEB8', fontFamily: SLFontFamilies.display, fontSize: 20, lineHeight: 25 }, recordLinks: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 20 }, recordLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 }, recordLinkText: { color: INK.violet, fontSize: 14 },
});
