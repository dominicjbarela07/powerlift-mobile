import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies, SLLayout } from '@/constants/theme';
import { FloatingDisplayUnitRegistration, floatingControlBottom, SL_FLOATING_CONTROL } from '@/components/ui/floating-control-coordinator';
import { canonicalMovementArtworkSource } from '@/lib/canonical-movement-artwork-assets';
import { workspaceLedgerParams } from '@/lib/coach-performance';
import { canonicalCompetitionLiftKey, fetchLedgerAccomplishments, fetchLedgerCurrentBests, kgToDisplay, type AccomplishmentEvent, type CurrentBestSnapshot, type LedgerUnit } from '@/lib/ledger-data';
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
  const insets = useSafeAreaInsets();
  const floatingClearance = floatingControlBottom({ context: 'tab-screen', safeAreaBottom: insets.bottom, slot: 1 })
    + SL_FLOATING_CONTROL.size + SL_FLOATING_CONTROL.gap;
  const { performance: data, period, setPeriod, subjectKey, athleteId, reload } = workspace;
  const savedScroll = useRef(workspace.performanceScrollY);
  const [deep, setDeep] = useState(workspace.performanceScrollY > 380);
  const [events, setEvents] = useState<AccomplishmentEvent[]>([]);
  const [bests, setBests] = useState<CurrentBestSnapshot | null>(null);
  const [exploration, setExploration] = useState<LedgerExplorationIndex | null>(null);
  const [variants, setVariants] = useState<LedgerCoreVariantsStory | null>(null);
  const [supplementError, setSupplementError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expandedLift, setExpandedLift] = useState<string | null>(null);
  const open = (room: string, extra: Record<string, string> = {}) => router.push({
    pathname: `/(tabs)/ledger/${room}` as any,
    params: { ...workspaceLedgerParams(athleteId), ...extra },
  });
  useEffect(() => {
    let active = true;
    setEvents([]); setBests(null);
    // Two bounded canonical projections; no timeline pagination on entry.
    void Promise.all([fetchLedgerAccomplishments(12, athleteId), fetchLedgerCurrentBests(athleteId)])
      .then(([recent, current]) => { if (active) { setEvents(recent); setBests(current); } })
      .catch((error) => { if (active && [401, 403, 404].includes(error?.status)) void reload(true); });
    return () => { active = false; };
  }, [athleteId, subjectKey, retry, reload]);
  useEffect(() => {
    if (!deep) return;
    let active = true;
    setSupplementError(false);
    void Promise.all([fetchLedgerExplorationIndex(athleteId), fetchLedgerCoreVariants(athleteId)])
      .then(([accessories, core]) => {
        if (!active) return;
        if (accessories.athlete.id !== athleteId || core.athlete.id !== athleteId) { void reload(true); return; }
        setExploration(accessories); setVariants(core);
      }).catch(() => { if (active) setSupplementError(true); });
    return () => { active = false; };
  }, [athleteId, deep, subjectKey, retry, reload]);
  const refresh = () => { workspace.reloadPerformance(); void reload(true); setRetry((value) => value + 1); };
  const context = data?.coaching_context;
  const prs = canonicalPrHistory(events);
  const rangePrs = prs.filter((event) => (event.workout_date || event.occurred_at || '').slice(0, 10) >= (data?.range?.start_date || '9999') && (event.workout_date || event.occurred_at || '').slice(0, 10) <= (data?.range?.end_date || ''));
  const runtime = bests ? resolveLedgerClubsRuntimeState(bests.items, bests.strengthStandard, bests.strengthStanding, unit) : null;
  const standing = runtime ? competitiveStanding(runtime.totalState, runtime.standard?.sex) : null;
  const lifts = data?.big_three_arc?.lifts || [];
  const completed = data?.consistency?.sessions_completed || 0;
  const assigned = data?.consistency?.sessions_assigned || 0;
  const completion = data?.consistency?.completion_rate_pct;
  const bodyweight = [...new Map((context?.bodyweight || []).map((point) => [point.training_date, point])).values()];
  const latestWeight = bodyweight.at(-1)?.reported_bodyweight_kg;
  const recovery = context?.latest_readiness;
  return <>
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} slot={1} testID="coach-athlete-performance-unit-toggle" />
    <ScrollView testID="coach-athlete-performance" contentContainerStyle={[s.content, { paddingBottom: floatingClearance }]} showsVerticalScrollIndicator={false} contentOffset={{ x: 0, y: savedScroll.current }}
    onScroll={(event) => { const scrollY = event.nativeEvent.contentOffset.y; workspace.setPerformanceScrollY(scrollY); if (scrollY > 380) setDeep(true); }} scrollEventThrottle={120}
    refreshControl={<RefreshControl refreshing={workspace.refreshing} tintColor={INK.violet} onRefresh={refresh} />}>
    <View style={s.intro}><Text style={v.eyebrow}>THE LONG GAME</Text><Text style={s.title}>Performance</Text>
      <Text style={v.body}>{workspace.bootstrap?.current_training?.program_name || 'The work. The progress. The person.'}</Text></View>
    <View style={s.periodRow}>{(['30d', '90d', '180d'] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: period === value }} accessibilityLabel={`${value.slice(0, -1)} days`} onPress={() => setPeriod(value)} style={[s.period, period === value && s.periodActive]}><Text style={[s.periodText, period === value && { color: INK.text }]}>{value.slice(0, -1)} days</Text></Pressable>)}<View style={v.flex} /><Text style={s.periodUnit}>{unit.toUpperCase()}</Text></View>
    {!data ? <PerformanceLoading error={workspace.performanceError} onRetry={workspace.reloadPerformance} /> : <>
      <StrengthHero data={data} unit={unit} onLiftPress={(lift) => open('strength', { lift })} />
      <View style={s.periodFoot}><Text style={v.meta}>{periodDate(data.range?.start_date)} — {periodDate(data.range?.end_date)}</Text>{lifts.some((lift) => lift.points?.length) ? <Text style={v.meta}>Tap chart to inspect</Text> : null}</View>
      {rangePrs.length ? <Pressable onPress={() => open('achievements')} style={({ pressed }) => [s.prSignal, pressed && v.pressed]}><Image source={LEDGER_INDEX_ASSETS.careerPr} style={s.medallion} /><View style={v.flex}><Text style={s.goldTitle}>{rangePrs.length} recent personal record{rangePrs.length === 1 ? '' : 's'}</Text><Text style={v.meta}>{rangePrs[0].movement_label || 'Competition strength'} · {periodDate(rangePrs[0].workout_date || rangePrs[0].occurred_at)}</Text></View><Ionicons color={INK.gold} name="arrow-forward" size={20} /></Pressable> : null}
      <Chapter number="01" title="Beyond the estimate" detail="What is actually moving on the bar?" action="Strength" onPress={() => open('strength')}>
        {lifts.map((lift) => {
          const lenses = lift.strength_lenses;
          const rep = [...(lenses?.rep_strength.series || [])].sort((a, b) => (b.change_kg || 0) - (a.change_kg || 0))[0];
          const comparison = lenses?.comparable_performance;
          const expanded = expandedLift === lift.key;
          const career = runtime?.lifts.find((row) => row.key === lift.key);
          const careerEstimate = bests?.items.find((row) => row.metric === 'e1rm' && canonicalCompetitionLiftKey(row.core_movement_key) === lift.key);
          return <View key={lift.key} style={s.strengthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${lift.label} recorded strength`} onPress={() => setExpandedLift(expanded ? null : lift.key!)} style={s.strengthSummary}>
              <Image accessible={false} source={LEDGER_INDEX_ASSETS.coreLift[lift.key as 'squat' | 'bench' | 'deadlift']} style={s.liftArt} />
              <View style={v.flex}><Text style={v.rowTitle}>{lift.label}</Text><Text style={v.meta}>Heaviest in period</Text></View><Text style={s.recordValue}>{loadLabel(lenses?.weight_on_bar.heaviest_kg, unit)}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={LIFT_COLORS[lift.key!]} />
            </Pressable>
            {expanded ? <View style={s.lensDetail}>
              {career?.canonicalWeightKg != null ? <View style={s.factLine}><Text style={v.body}>Career heaviest</Text><Text style={v.rowTitle}>{loadLabel(career.canonicalWeightKg, unit)}</Text></View> : null}
              {careerEstimate ? <View style={s.factLine}><Text style={v.body}>Career e1RM peak</Text><Text style={v.rowTitle}>{loadLabel(careerEstimate.best_value, unit)}</Text></View> : null}
              {career?.plateClubState?.earned ? <View style={s.factLine}><Text style={v.body}>Plate club earned</Text><Text style={s.goldTitle}>{career.plateClubState.earned.value} {unit}</Text></View> : null}
              {rep ? <View style={s.factLine}><Text style={v.body}>{rep.label} · period best</Text><Text style={v.rowTitle}>{loadLabel(rep.best_in_range_kg, unit)}</Text></View> : <Text style={v.body}>Rep strength needs recorded load and reps.</Text>}
              {comparison?.status === 'supported' ? <View style={s.comparison}><Text style={s.observationTitle}>{comparison.kind === 'more_reps_same_weight' ? 'More reps at the same load' : comparison.kind === 'lower_effort_same_task' ? 'Same task, lower effort' : 'More load at the same reps'}</Text><Text style={v.body}>{loadLabel(comparison.from?.weight_kg, unit)} × {comparison.from?.reps} → {loadLabel(comparison.to?.weight_kg, unit)} × {comparison.to?.reps}{comparison.kind === 'lower_effort_same_task' ? ` · RPE ${comparison.from?.rpe ?? "—"} → ${comparison.to?.rpe ?? "—"}` : ""}</Text></View> : null}
              <EvidenceLink title="Inspect the strength record" detail="Rep progression, heavy exposure, career peaks & plate clubs" onPress={() => open('strength', { lift: lift.key! })} />
            </View> : null}
          </View>;
        })}
      </Chapter>
      <Chapter number="02" title="The work behind it" detail="Execution and performed work over the same period." action="Archive" onPress={() => open('archive')}>
        <View style={s.outputHero}><View style={s.ring}>
          <Svg width={110} height={110} viewBox="0 0 110 110"><Circle cx={55} cy={55} r={47} fill="none" stroke="#20252A" strokeWidth={7} />{completion != null ? <Circle cx={55} cy={55} r={47} fill="none" stroke={INK.green} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${Math.max(0, Math.min(100, completion)) * 2.953} 296`} rotation={-90} origin="55,55" /> : null}</Svg>
          <View style={s.ringValue}><Text style={s.ringNumber}>{completion == null ? '—' : `${Math.round(completion)}%`}</Text></View></View>
          <View style={v.flex}><Text style={s.outputNumber}>{completed}<Text style={s.outputDenominator}> / {assigned}</Text></Text><Text style={v.rowTitle}>Sessions completed</Text><Text style={v.body}>{data.consistency?.missed_or_incomplete || 0} missed or incomplete</Text></View></View>
        <View style={s.outputStrip}><View style={v.flex}><Text style={s.outputStat}>{context?.working_sets ?? 0}</Text><Text style={v.body}>working sets</Text></View><View style={s.statDivider} /><View style={v.flex}><Text style={s.outputStat}>{context?.frequency_per_week ?? 0}</Text><Text style={v.body}>Sessions / week</Text></View></View>
        <View style={s.volumeHeading}><View style={v.flex}><Text style={v.rowTitle}>Performed volume</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={s.volumeNumber}>{Math.round(kgToDisplay(context?.volume_kg || 0, unit)).toLocaleString()}<Text style={s.volumeUnit}> {unit}</Text></Text></View><View style={s.volumeChange}><Text style={[s.changeNumber, { color: (context?.volume_change_pct || 0) < 0 ? INK.magenta : INK.green }]}>{context?.volume_change_pct == null ? '—' : `${context.volume_change_pct > 0 ? '+' : ''}${context.volume_change_pct}%`}</Text><Text style={v.meta}>vs. previous {context?.period_days} days</Text></View></View>
        <WeeklyWork points={context?.weekly || []} unit={unit} />
        <Text style={v.meta}>External load × recorded reps. Assistance is excluded.</Text>
      </Chapter>
      <Chapter number="03" title="Worth noticing" detail="Observations to investigate, drawn from recorded work.">
        {lifts.filter((lift) => (lift.points?.length || 0) > 1 && lift.change_kg != null).map((lift) => <Pressable key={lift.key} onPress={() => open('strength', { lift: lift.key! })} style={s.observation}>
          <View style={[s.observationMark, { backgroundColor: LIFT_COLORS[lift.key!] }]} /><View style={v.flex}><Text style={s.observationTitle}>{lift.label} estimate {deltaLabel(lift.change_kg, unit)}</Text><Text style={v.body}>First to latest weekly best · {lift.points?.length} weeks with evidence</Text></View><Ionicons color={INK.muted} name="chevron-forward" size={17} /></Pressable>)}
        {!lifts.some((lift) => (lift.points?.length || 0) > 1) ? <Text style={v.body}>The first exposures establish a baseline. Comparisons appear when another week of evidence is available.</Text> : null}
        {context && context.working_sets !== context.comparison.set_count ? <View style={s.observation}><View style={[s.observationMark, { backgroundColor: INK.cyan }]} /><View style={v.flex}><Text style={s.observationTitle}>Working sets: {context.comparison.set_count} → {context.working_sets}</Text><Text style={v.body}>Consecutive {context.period_days}-day periods · {periodDate(context.comparison.start_date)} onward</Text></View></View> : null}
      </Chapter>
      <Chapter number="04" title="Supplemental development" detail="Exact movements. Independent progress.">
        {!deep || (!exploration && !supplementError) ? <PerformanceLoading onRetry={() => setDeep(true)} /> : supplementError ? <EvidenceLink title="Reload movement evidence" onPress={() => setRetry((value) => value + 1)} /> : <>
          <Text style={s.subhead}>ACCESSORIES <Text style={s.subheadContext}> / {exploration?.accessories.period.label}</Text></Text>
          {(exploration?.accessories.progress || []).filter((progress) => canonicalMovementArtworkSource(exploration?.accessories.movements.find((item) => item.id === progress.movement_id))).slice(0, 4).map((progress) => {
            const movement = exploration?.accessories.movements.find((item) => item.id === progress.movement_id);
            if (!movement) return null;
            return <Pressable key={progress.identity_key} onPress={() => open(`movement/${movement.id}`)} style={s.movementRow}><CanonicalMovementArtwork movement={movement} size={65} /><View style={v.flex}><Text style={v.rowTitle}>{movement.name}</Text><Text style={s.progressText}>{loadLabel(progress.prior.weight_kg, unit)} × {progress.prior.reps} → {loadLabel(progress.current.weight_kg, unit)} × {progress.current.reps}</Text><Text style={v.meta}>{progress.assisted ? 'Assistance load · ' : ''}{progress.current.equipment_model || progress.current.equipment_type?.replace(/_/g, ' ') || 'Same equipment'} · {periodDate(progress.occurred_on)}</Text></View><Ionicons name="chevron-forward" size={17} color={INK.muted} /></Pressable>;
          })}
          {!exploration?.accessories.progress.length ? <Text style={v.body}>{exploration?.accessories.summary.movement_count ? `${exploration.accessories.summary.movement_count} movements recorded. No matched-task improvement established in this period.` : 'Accessory development appears with exact movement and equipment evidence.'}</Text> : null}
          <EvidenceLink title="Open Accessories" detail="Current bests, equipment context & every exposure" onPress={() => open('accessories')} />
          <Text style={s.subhead}>CORE VARIANTS <Text style={s.subheadContext}> / By parent lift</Text></Text>
          {(['squat', 'bench', 'deadlift'] as const).map((family) => {
            const movements = (variants?.movements || []).filter((item) => item.family === family && (item.currently_programmed || item.latest_progression)).slice(0, 2);
            if (!movements.length) return null;
            return <View key={family}><Text style={[s.familyLabel, { color: LIFT_COLORS[family] }]}>{family === 'bench' ? 'BENCH PRESS' : family.toUpperCase()}</Text>{movements.map((movement) => <Pressable key={movement.core_movement_id} onPress={() => open(`variant/${movement.core_movement_id}`)} style={s.movementRow}>
              <CanonicalMovementArtwork movement={{ core_movement_id: movement.core_movement_id, core_movement: { id: movement.core_movement_id, family, kind: 'variant' } }} size={62} /><View style={v.flex}><Text style={v.rowTitle}>{movement.name}</Text><Text style={s.progressText}>{movement.latest_progression ? `${loadLabel(movement.latest_progression.prior.weight_kg, unit)} × ${movement.latest_progression.prior.reps} → ${loadLabel(movement.latest_progression.current.weight_kg, unit)} × ${movement.latest_progression.current.reps}` : `${movement.session_count} recorded Sessions`}</Text><Text style={v.meta}>{movement.currently_programmed ? 'In rotation' : 'Recorded progress'} · {periodDate(movement.last_performed_on)}</Text></View><Ionicons name="chevron-forward" size={17} color={INK.muted} /></Pressable>)}</View>;
          })}
          {!variants?.movements.length ? <Text style={v.body}>No exact Core Variant evidence recorded yet.</Text> : null}
          <EvidenceLink title="Open Core Variants" detail="Rotation, exact-task progress & the historical record" onPress={() => open('variants')} />
        </>}
      </Chapter>
      <Chapter number="05" title="Earned, not given" action="Achievements" onPress={() => open('achievements')}>
        <Pressable onPress={() => open('achievements')} style={s.achievement}><Image source={LEDGER_INDEX_ASSETS.chapter.achievements} style={s.trophy} /><View style={v.flex}><Text style={s.achievementKicker}>THE STRENGTH RECORD</Text><Text style={s.achievementTitle}>{standing ? standing.summary : 'Every milestone has a story.'}</Text><Text style={v.body}>{standing ? 'Sex-matched OpenPowerlifting reference. Open Strength for the full cohort and rules.' : 'PRs, plate clubs, standards & career milestones.'}</Text></View></Pressable>
        {prs.slice(0, 4).map((event) => <Pressable key={event.id} onPress={() => open('achievements')} style={s.prRow}><View style={v.flex}><Text style={v.rowTitle}>{event.movement_label || 'Strength record'}</Text><Text style={v.meta}>{periodDate(event.workout_date || event.occurred_at)} · {event.event_type === 'CORE_REP_MAX_PR' ? `New ${event.evidence?.rep_count || event.evidence?.actual_reps || ''}RM` : event.event_type === 'CORE_WEIGHT_PR' ? 'Heaviest recorded load' : 'Estimated strength PR'}</Text></View><Text numberOfLines={1} style={s.prValue}>{event.current_value != null ? event.unit === 'kg' ? loadLabel(event.current_value, unit) : `${event.current_value} ${event.unit || ''}` : 'PR'}</Text></Pressable>)}
        {!prs.length ? <Text style={v.body}>New personal records will appear here as they are earned.</Text> : null}
      </Chapter>
      <Chapter number="06" title="The person behind the work" detail="Reported bodyweight and recovery, alongside the training period." action="Journey" onPress={() => open('journey')}>
        <View style={s.contextTop}><View style={v.flex}><Text style={v.rowTitle}>Reported bodyweight</Text><Text style={s.volumeNumber}>{loadLabel(latestWeight, unit)}</Text></View><Text style={v.meta}>{bodyweight.length} reported days</Text></View>
        {bodyweight.length ? <AnalyticalTimeSeriesChart height={190} readableText selectedInitially="none" showLegend={false} metric={{ key: 'bodyweight', label: 'Bodyweight', kind: 'weight', unit, maximumFractionDigits: 1 }} series={[{ key: 'bodyweight', label: 'Reported', color: INK.magenta, points: bodyweight.map((point) => ({ date: point.training_date, value: kgToDisplay(point.reported_bodyweight_kg, unit) })) }]} /> : <Text style={v.body}>No bodyweight reported in this period.</Text>}
        <Text style={v.rowTitle}>Readiness <Text style={v.meta}> / 5 · daily average</Text></Text>
        {context?.readiness.length ? <AnalyticalTimeSeriesChart height={190} readableText selectedInitially="none" showLegend={false} metric={{ key: 'readiness', label: 'Readiness', kind: 'score', unit: '/5', minimum: 0, maximum: 5, maximumFractionDigits: 1 }} series={[{ key: 'readiness', label: 'Reported', color: INK.cyan, points: context.readiness }]} /> : <Text style={v.body}>No readiness reported in this period.</Text>}
        {recovery ? <View style={s.recovery}><Text style={s.subhead}>LATEST CHECK-IN <Text style={s.subheadContext}> / {periodDate(recovery.date)}</Text></Text>{[['Sleep', recovery.sleep_hours == null ? 'Not reported' : `${recovery.sleep_hours} hours`], ['Sleep quality', recovery.sleep_quality == null ? 'Not reported' : `${recovery.sleep_quality} / 5`], ['Soreness', recovery.soreness == null ? 'Not reported' : `${recovery.soreness} / 5`], ['Stress', recovery.stress == null ? 'Not reported' : `${recovery.stress} / 5`], ['Energy', recovery.energy == null ? 'Not reported' : `${recovery.energy} / 5`]].map(([label, value]) => <View key={label} style={s.factLine}><Text style={v.body}>{label}</Text><Text style={v.rowTitle}>{value}</Text></View>)}</View> : null}
      </Chapter>
      <View style={s.recordFooter}><Image source={LEDGER_INDEX_ASSETS.record} style={s.recordIcon} /><Text style={v.eyebrow}>THE RECORD CONTINUES</Text><Text style={s.footerTitle}>{workspace.bootstrap?.athlete.name}’s Ledger</Text><EvidenceLink title="Open Journey" detail="Training chapters, moments & context" onPress={() => open('journey')} /><EvidenceLink title="Explore the Archive" detail="Sessions, performed sets, media & competition" onPress={() => open('archive')} /></View>
    </>}
  </ScrollView>
  </>;
}

function WeeklyWork({ points, unit }: { points: { date: string; volume_kg: number; set_count: number; session_count: number }[]; unit: LedgerUnit }) {
  const [selected, setSelected] = useState<number | null>(null);
  const maximum = Math.max(1, ...points.map((point) => point.volume_kg));
  const point = selected == null ? null : points[selected];
  return <View><View style={s.bars}>{points.map((row, index) => <Pressable key={row.date} accessibilityRole="button" accessibilityLabel={`Week of ${periodDate(row.date)}: ${row.set_count} sets, ${loadLabel(row.volume_kg, unit)} volume`} onPress={() => setSelected(index)} style={s.barTarget}><View style={[s.bar, { height: row.volume_kg > 0 ? Math.max(3, row.volume_kg / maximum * 82) : 1, backgroundColor: selected === index ? INK.cyan : INK.violet, opacity: selected == null || selected === index ? 0.95 : 0.4 }]} /></Pressable>)}</View><View style={s.barAxis}><Text style={v.meta}>{periodDate(points[0]?.date)}</Text><Text style={v.meta}>WEEKLY VOLUME</Text><Text style={v.meta}>{periodDate(points.at(-1)?.date)}</Text></View>{point ? <Text style={s.barDetail}>Week of {periodDate(point.date)} · {point.set_count} sets · {loadLabel(point.volume_kg, unit)}</Text> : null}</View>;
}

const s = StyleSheet.create({
  content: { paddingHorizontal: SLLayout.screenGutter, paddingTop: 18, gap: 13 },
  intro: { gap: 4 }, title: { fontFamily: SLFontFamilies.display, color: INK.text, fontSize: 32 },
  periodRow: { flexDirection: 'row', alignItems: 'center', borderBottomColor: INK.line, borderBottomWidth: 1, marginBottom: 4 },
  period: { minHeight: 46, paddingHorizontal: 15, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  periodActive: { borderBottomColor: INK.violet }, periodText: { color: INK.muted, fontSize: 14 }, periodUnit: { color: INK.quiet, fontSize: 12, paddingRight: 4 },
  periodFoot: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  prSignal: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 }, medallion: { width: 53, height: 53 }, goldTitle: { color: INK.gold, fontSize: 16, fontWeight: '600' },
  strengthRow: { borderBottomColor: INK.line, borderBottomWidth: 1 }, strengthSummary: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 83 }, liftArt: { width: 62, height: 65, resizeMode: 'contain' }, recordValue: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 20 },
  lensDetail: { paddingVertical: 12, gap: 12 }, factLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, minHeight: 35 }, comparison: { borderLeftWidth: 2, borderLeftColor: INK.green, paddingLeft: 14, gap: 5 },
  outputHero: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingVertical: 10 }, ring: { width: 110, height: 110 }, ringValue: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center' }, ringNumber: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 22 }, outputNumber: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 38 }, outputDenominator: { color: INK.muted, fontSize: 24 },
  outputStrip: { flexDirection: 'row', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: INK.line, gap: 26 }, outputStat: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 32 }, statDivider: { width: 1, backgroundColor: INK.line },
  volumeHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }, volumeNumber: { color: INK.text, fontFamily: SLFontFamilies.numeric, fontSize: 23, marginTop: 4 }, volumeUnit: { color: INK.muted, fontSize: 16 }, volumeChange: { alignItems: 'flex-end', gap: 4 }, changeNumber: { fontFamily: SLFontFamilies.numeric, fontSize: 20 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 96, borderBottomWidth: 1, borderBottomColor: INK.line }, barTarget: { flex: 1, height: 96, justifyContent: 'flex-end', paddingHorizontal: 1 }, bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 }, barAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }, barDetail: { color: INK.cyan, fontSize: 13, marginTop: 8 },
  observation: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, borderBottomColor: INK.line, borderBottomWidth: 1 }, observationMark: { width: 3, height: 36, borderRadius: 2 }, observationTitle: { color: INK.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  subhead: { color: INK.violet, fontSize: 12, letterSpacing: 1, marginTop: 12 }, subheadContext: { color: INK.muted, fontSize: 12, letterSpacing: 0 }, movementRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: INK.line }, progressText: { color: INK.green, fontSize: 14, marginVertical: 5 }, familyLabel: { fontSize: 12, letterSpacing: 1, marginTop: 15 },
  achievement: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#120F09', borderRadius: 22, paddingVertical: 19, paddingRight: 16, borderWidth: 1, borderColor: '#382F1D', gap: 4 }, trophy: { width: 107, height: 148, resizeMode: 'contain' }, achievementKicker: { color: INK.gold, fontSize: 10, letterSpacing: 1 }, achievementTitle: { color: '#F1DEB8', fontFamily: SLFontFamilies.display, fontSize: 22, marginVertical: 8 }, prRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: INK.line, minHeight: 73, paddingVertical: 12 }, prValue: { color: INK.gold, fontFamily: SLFontFamilies.numeric, fontSize: 20 },
  contextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }, recovery: { borderTopWidth: 1, borderTopColor: INK.line, paddingTop: 12, gap: 5 },
  recordFooter: { marginTop: 32, paddingTop: 27, borderTopWidth: 1, borderTopColor: INK.line, gap: 9 }, recordIcon: { width: 40, height: 40, borderRadius: 10, marginBottom: 6 }, footerTitle: { color: INK.text, fontFamily: SLFontFamilies.display, fontSize: 27 },
});
