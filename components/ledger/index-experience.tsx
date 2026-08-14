import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLSpacing } from '@/constants/theme';
import {
  canonicalLiftKey,
  displayWeight,
  fetchLedgerAccomplishmentHistory,
  type AccomplishmentEvent,
  type CurrentBest,
  type LedgerUnit,
} from '@/lib/ledger-data';
import { fetchLedgerExplorationIndex, type LedgerExplorationIndex } from '@/lib/ledger-exploration';
import { fetchJourneyBootstrap, type JourneyEntry } from '@/lib/ledger-journey';
import { canonicalMajorVolumeMedallions, canonicalTotal, totalClubState } from '@/lib/ledger-rewards';
import { majorVolumeMedallionAsset } from '@/lib/major-volume-medallion-assets';
import { SL_TOTAL_TROPHY_ASSETS } from '@/lib/trophy-assets';
import { CORE_LIFT_PRESENTATION } from './model';
import { ledgerHrefFor, type LedgerRoom } from './routing';
import { useLedgerLiveData } from './use-ledger-live-data';

const CHAPTERS: readonly {
  number: string;
  room: Exclude<LedgerRoom, 'home' | 'muscle-groups' | 'filters'>;
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
}[] = [
  { number: '01', room: 'journey', title: 'JOURNEY', detail: 'Blocks, phases, and session history.', icon: 'map-outline', tone: '#A873F1' },
  { number: '02', room: 'strength', title: 'STRENGTH', detail: 'Core lifts, variants, rep maxes, trends.', icon: 'barbell-outline', tone: '#62C8EF' },
  { number: '03', room: 'achievements', title: 'ACHIEVEMENTS', detail: 'All PRs, milestones, and awards.', icon: 'star-outline', tone: '#E8B95D' },
  { number: '04', room: 'accessories', title: 'ACCESSORIES', detail: 'Exercise progress, volume, and PRs.', icon: 'body-outline', tone: '#68D29F' },
  { number: '05', room: 'variants', title: 'VARIANTS', detail: 'Alternate lifts and movement patterns.', icon: 'git-branch-outline', tone: '#BB7BEE' },
  { number: '06', room: 'archive', title: 'ARCHIVE', detail: 'Complete session and set history.', icon: 'archive-outline', tone: '#EC7067' },
];

const PR_EVENT_TYPES = new Set(['CORE_WEIGHT_PR', 'CORE_E1RM_PR', 'CORE_REP_MAX_PR']);
const RAW_COMPLETION_EVENT_TYPES = new Set(['SESSION_COMPLETED', 'CORE_MOVEMENT_SESSION_COMPLETED', 'CORE_PRESCRIPTION_COMPLETED']);

function dateLabel(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function eventTypeLabel(value: string) {
  return value.replace(/^CORE_/, '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventPerformance(event?: AccomplishmentEvent, unit: LedgerUnit = 'lb') {
  if (!event || typeof event.current_value !== 'number') return '—';
  const eventUnit = (event.unit || '').toLowerCase();
  if (eventUnit === 'kg' || eventUnit === 'lb') {
    const kilograms = eventUnit === 'kg' ? event.current_value : event.current_value / 2.2046226218;
    return `${displayWeight(kilograms, unit)} ${unit.toUpperCase()}${event.event_type.includes('REP') && event.evidence?.reps ? ` × ${String(event.evidence.reps)}` : ''}`;
  }
  return `${event.current_value.toLocaleString()}${event.unit ? ` ${event.unit}` : ''}`;
}

function journeyPerformance(entry: JourneyEntry | null, unit: LedgerUnit) {
  const performance = entry?.performance;
  if (!entry || typeof performance?.weight_kg !== 'number') return entry?.detail || '—';
  const reps = typeof performance.reps === 'number' ? ` × ${performance.reps}` : '';
  const rpe = typeof performance.rpe === 'number' ? ` @ RPE ${performance.rpe}` : '';
  return `${displayWeight(performance.weight_kg, unit)} ${unit.toUpperCase()}${reps}${rpe}`;
}

function MiniLine({ values, tone, label }: { values: readonly number[]; tone: string; label: string }) {
  if (values.length < 2) return <View accessibilityLabel={`${label}: not enough evidence`} style={styles.emptyChart}><View style={styles.emptyChartLine} /></View>;
  const width = 118;
  const height = 44;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = Math.max(1, high - low);
  const points = values.map((value, index) => `${5 + index * ((width - 10) / (values.length - 1))},${height - 5 - ((value - low) / spread) * (height - 10)}`).join(' ');
  return <View accessibilityLabel={label} style={styles.miniChart}><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Line x1="4" x2={width - 4} y1={height - 5} y2={height - 5} stroke="#26303A" /><Polyline points={points} fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg></View>;
}

function ProgressRing({ value, tone = '#A873F1' }: { value: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  const size = 62;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * 2 * radius;
  return <View style={styles.progressRing}><Svg width={size} height={size}><Circle cx={size / 2} cy={size / 2} r={radius} stroke="#252D38" strokeWidth={stroke} fill="none" /><Circle cx={size / 2} cy={size / 2} r={radius} stroke={tone} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - clamped)} rotation="-90" origin={`${size / 2} ${size / 2}`} /></Svg><Text style={styles.progressRingValue}>{Math.round(clamped * 100)}%</Text></View>;
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return <View style={styles.snapshotStat}><View style={[styles.statSeal, { borderColor: `${tone}66`, backgroundColor: `${tone}12` }]}><Ionicons name={label === 'SETS' ? 'reader-outline' : label === 'PRs' ? 'flash-outline' : 'ribbon-outline'} size={15} color={tone} /></View><Text style={styles.snapshotStatValue}>{value}</Text><Text style={styles.snapshotStatLabel}>{label}</Text></View>;
}

function LiftResult({ lift, best, unit }: { lift: typeof CORE_LIFT_PRESENTATION[number]; best?: CurrentBest; unit: LedgerUnit }) {
  return <View style={styles.liftResult}><Text style={[styles.liftResultLabel, { color: lift.color }]}>{lift.key.toUpperCase()}</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.liftResultValue}>{best ? displayWeight(best.best_value, unit) : '—'}</Text><Text style={styles.liftResultUnit}>{best ? `${unit.toUpperCase()} · ${best.metric === 'weight' ? 'BEST SET' : 'e1RM'}` : 'NO EVIDENCE'}</Text></View>;
}

function ChapterRow({ chapter, onPress, artifact }: { chapter: typeof CHAPTERS[number]; onPress: () => void; artifact?: React.ReactNode }) {
  return <Pressable testID={`ledger-${chapter.room}-snapshot`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chapterRow, pressed && styles.pressed]}><Text style={styles.chapterNumber}>{chapter.number}</Text><View style={[styles.chapterIcon, { borderColor: `${chapter.tone}55`, backgroundColor: `${chapter.tone}10` }]}>{artifact || <Ionicons name={chapter.icon} size={23} color={chapter.tone} />}</View><View style={styles.chapterCopy}><Text style={styles.chapterTitle}>{chapter.title}</Text><Text style={styles.chapterDetail}>{chapter.detail}</Text></View><Ionicons name="chevron-forward" size={18} color="#7F8794" /></Pressable>;
}

export function LedgerIndexExperience() {
  const router = useRouter();
  const { progression, currentBests, accomplishments, loading, error, errorKind, reload } = useLedgerLiveData('all', { allowPartial: true });
  const [history, setHistory] = useState<AccomplishmentEvent[]>([]);
  const [exploration, setExploration] = useState<LedgerExplorationIndex | null>(null);
  const [latestJourneyEntry, setLatestJourneyEntry] = useState<JourneyEntry | null>(null);
  const [supportLoading, setSupportLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchLedgerAccomplishmentHistory(), fetchLedgerExplorationIndex(), fetchJourneyBootstrap({ limit: 24, includeSessions: true })])
      .then(([historyResult, explorationResult, journeyResult]) => {
        if (!active) return;
        if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
        if (explorationResult.status === 'fulfilled') setExploration(explorationResult.value);
        if (journeyResult.status === 'fulfilled') {
          const today = new Date().toISOString().slice(0, 10);
          setLatestJourneyEntry(journeyResult.value.timeline.items.find((entry) => entry.occurred_on <= today && !RAW_COMPLETION_EVENT_TYPES.has(entry.event_type)) || null);
        }
      })
      .finally(() => { if (active) setSupportLoading(false); });
    return () => { active = false; };
  }, []);

  const model = useMemo(() => {
    const events = history.length ? history : accomplishments;
    const unit: LedgerUnit = progression?.athlete?.preferred_units?.toLowerCase().startsWith('lb') ? 'lb' : 'kg';
    const prs = events.filter((event) => PR_EVENT_TYPES.has(event.event_type));
    const latest = events.find((event) => !RAW_COMPLETION_EVENT_TYPES.has(event.event_type));
    const liftBests = CORE_LIFT_PRESENTATION.map((lift) => currentBests
      .filter((best) => canonicalLiftKey(best.core_movement_key || best.movement_label) === canonicalLiftKey(lift.key))
      .sort((left, right) => (left.metric === 'weight' ? -1 : 1) - (right.metric === 'weight' ? -1 : 1) || right.best_value - left.best_value)[0]);
    const completeTotal = canonicalTotal(currentBests);
    const club = totalClubState(completeTotal, unit);
    const medallion = canonicalMajorVolumeMedallions(events)[0];
    const trophyIndex = Math.max(0, club.earnedTierIndex);
    return { events, prs, latest, unit, liftBests, club, medallion, trophyIndex };
  }, [accomplishments, currentBests, history, progression?.athlete?.preferred_units]);

  if (loading || supportLoading) return <View testID="ledger-home-experience" style={styles.state}><Ionicons name="book-outline" size={30} color="#B994F3" /><Text style={styles.stateTitle}>Opening your complete record.</Text></View>;
  if (error) return <View testID="ledger-home-experience" style={styles.state}><Ionicons name={errorKind === 'unauthorized' ? 'lock-closed-outline' : 'alert-circle-outline'} size={30} color="#B994F3" /><Text style={styles.stateTitle}>{error}</Text><Pressable onPress={() => void reload()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>;

  const sessions = Math.max(0, progression?.consistency?.sessions_completed ?? 0);
  const context = exploration?.context;
  const frequency = context?.training_frequency_per_week ?? (() => {
    const weeks = progression?.consistency?.weeks ?? [];
    return weeks.length ? weeks.reduce((sum, week) => sum + (week.completed ?? 0), 0) / weeks.length : null;
  })();
  const bodyweight = context?.reported_bodyweight?.latest?.reported_bodyweight_kg;
  const bodyweightPoints = (context?.reported_bodyweight?.recent_observations ?? []).map((point) => point.reported_bodyweight_kg).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const latestReportedBodyweight = context?.reported_bodyweight?.latest;
  const reportedBodyweightComparison = context?.reported_bodyweight?.comparison;
  const bodyweightContextLine = latestReportedBodyweight?.training_date
    ? `Latest reported · ${dateLabel(latestReportedBodyweight.training_date)}`
    : 'No reported pre-session bodyweight';
  const bodyweightTrendLine = reportedBodyweightComparison
    ? `${displayWeight(reportedBodyweightComparison.start.reported_bodyweight_kg, model.unit)} → ${displayWeight(reportedBodyweightComparison.end.reported_bodyweight_kg, model.unit)} ${model.unit.toUpperCase()} · ${reportedBodyweightComparison.span_days} days`
    : null;
  const frequencyPoints = (progression?.consistency?.weeks ?? []).map((week) => week.completed ?? 0);
  const achievementArtifact = model.medallion
    ? <Image source={majorVolumeMedallionAsset(model.medallion.family, model.medallion.thresholdLb)} resizeMode="contain" style={styles.chapterArtifact} />
    : <Image source={SL_TOTAL_TROPHY_ASSETS[model.trophyIndex]} resizeMode="contain" style={styles.chapterArtifact} />;
  const openRoom = (room: LedgerRoom) => router.push(ledgerHrefFor(room) as any);
  const latestTitle = latestJourneyEntry?.title || (model.latest ? `${model.latest.movement_label || 'Training'} · ${eventTypeLabel(model.latest.event_type)}` : 'No entry recorded yet');
  const latestValue = latestJourneyEntry ? journeyPerformance(latestJourneyEntry, model.unit) : eventPerformance(model.latest, model.unit);
  const latestDate = latestJourneyEntry?.occurred_at || latestJourneyEntry?.occurred_on || model.latest?.occurred_at || model.latest?.workout_date;
  const latestHref = latestJourneyEntry?.source.href;
  const latestIsPr = latestJourneyEntry
    ? Boolean(latestJourneyEntry.evidence && Array.isArray(latestJourneyEntry.evidence.accomplishments) && latestJourneyEntry.evidence.accomplishments.length)
    : Boolean(model.latest?.event_type.includes('_PR'));

  return <View testID="ledger-home-experience" style={styles.page}>
    <View style={styles.titleBlock}><Text style={styles.archiveKicker}>STRENGTH LEDGER</Text><Text style={styles.pageTitle}>THE LEDGER</Text><Text style={styles.pageSubtitle}>Your training, written in results.</Text></View>

    <View style={styles.sectionInset}>
      <View style={styles.careerSnapshot}>
        <Text style={styles.sectionKicker}>CAREER SNAPSHOT</Text>
        <Text style={styles.sessionValue}>{sessions.toLocaleString()}</Text>
        <Text style={styles.sessionLabel}>SESSIONS RECORDED</Text>
        <View style={styles.snapshotStats}>
          <Stat value={context ? context.lifetime_set_count.toLocaleString() : '—'} label="SETS" tone="#64D7DC" />
          <Stat value={model.prs.length.toLocaleString()} label="PRs" tone="#E1B95B" />
          <Stat value={model.events.length.toLocaleString()} label="ACHIEVEMENTS" tone="#D36BDE" />
        </View>
      </View>

      <Text style={styles.sectionKicker}>CORE LIFTS · LATEST RESULTS</Text>
      <View style={styles.liftStrip}>{CORE_LIFT_PRESENTATION.map((lift, index) => <LiftResult key={lift.key} lift={lift} best={model.liftBests[index]} unit={model.unit} />)}</View>

      <Text style={styles.sectionKicker}>LATEST ENTRY</Text>
      <Pressable disabled={!latestJourneyEntry && !model.latest} accessibilityRole="button" onPress={() => latestHref ? router.push(latestHref as any) : model.latest?.source_set_log_id ? router.push(`/(tabs)/ledger/archive/set/${model.latest.source_set_log_id}` as any) : openRoom('journey')} style={({ pressed }) => [styles.latestEntry, pressed && styles.pressed]}>
        <View style={styles.prSeal}><Text style={styles.prSealText}>{latestIsPr ? 'PR' : '•'}</Text></View>
        <View style={styles.latestCopy}><Text style={styles.latestTitle}>{latestTitle}</Text><Text style={styles.latestValue}>{latestValue}</Text><Text style={styles.latestDate}>{dateLabel(latestDate)}</Text></View>
        <Ionicons name="arrow-forward" size={17} color="#B99AF0" />
      </Pressable>
    </View>

    <View style={styles.sectionInset}>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>AT A GLANCE</Text><Text style={styles.sectionMeta}>CONTEXT MATTERS</Text></View>
      <View style={styles.contextGrid}>
        <Pressable onPress={() => openRoom('journey')} style={({ pressed }) => [styles.contextCard, styles.blockCard, pressed && styles.pressed]}><View style={styles.contextCopy}><Text style={styles.contextLabel}>CURRENT BLOCK</Text><Text style={styles.contextValue}>{context?.block?.name || 'No current block'}</Text><Text style={styles.contextDetail}>{context?.week_number ? `Week ${context.week_number}${context.total_weeks ? ` of ${context.total_weeks}` : ''}` : 'No dated week context'}</Text></View><ProgressRing value={context?.block_progress ?? 0} /></Pressable>
        <Pressable onPress={() => openRoom('journey')} style={({ pressed }) => [styles.contextCard, pressed && styles.pressed]}><Text style={styles.contextLabel}>REPORTED BODYWEIGHT</Text><Text style={styles.contextMetric}>{bodyweight ? `${displayWeight(bodyweight, model.unit)} ${model.unit.toUpperCase()}` : '—'}</Text><Text style={styles.contextDetail}>{bodyweightContextLine}</Text>{bodyweightTrendLine ? <Text style={styles.contextTrend}>{bodyweightTrendLine}</Text> : null}<MiniLine values={bodyweightPoints.slice(-8)} tone="#76CBD0" label="Reported pre-session bodyweight trend" /></Pressable>
        <View style={styles.contextCard}><Text style={styles.contextLabel}>TRAINING FREQUENCY</Text><Text style={styles.contextMetric}>{frequency == null ? '—' : Number(frequency).toFixed(1)}</Text><Text style={styles.contextDetail}>Sessions / week</Text><MiniLine values={frequencyPoints.slice(-8)} tone="#9A72E6" label="Weekly completed sessions" /></View>
      </View>

      <Text style={styles.sectionKicker}>RECENT PRs</Text>
      <View style={styles.prList}>{model.prs.slice(0, 3).map((event) => <Pressable key={event.id} onPress={() => event.source_set_log_id ? router.push(`/(tabs)/ledger/archive/set/${event.source_set_log_id}` as any) : openRoom('achievements')} style={({ pressed }) => [styles.prRow, pressed && styles.pressed]}><View><Text style={styles.prMovement}>{event.movement_label || 'Movement'}</Text><Text style={styles.prKind}>{eventTypeLabel(event.event_type)} · {dateLabel(event.occurred_at || event.workout_date)}</Text></View><Text style={styles.prValue}>{eventPerformance(event, model.unit)}</Text><View style={styles.prMiniSeal}><Text style={styles.prMiniSealText}>PR</Text></View></Pressable>)}</View>
    </View>

    <View style={styles.sectionInset}>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>YOUR RECORD</Text><Text style={styles.sectionMeta}>FULL LEDGER INDEX</Text></View>
      <View style={styles.chapterIndex}>{CHAPTERS.map((chapter) => <ChapterRow key={chapter.room} chapter={chapter} onPress={() => openRoom(chapter.room)} artifact={chapter.room === 'achievements' ? achievementArtifact : undefined} />)}</View>
    </View>

    <View style={styles.sectionInset}>
      <Text style={styles.sectionKicker}>QUICK FILTERS</Text>
      <View style={styles.quickFilters}>{['This Block', 'Last 3 Months', 'This Year', 'All Time'].map((label) => <Pressable key={label} onPress={() => router.push({ pathname: ledgerHrefFor('filters'), params: { time: label } } as never)} style={({ pressed }) => [styles.filterRow, pressed && styles.pressed]}><Ionicons name={label === 'All Time' ? 'infinite-outline' : 'time-outline'} size={15} color="#B5BBC5" /><Text style={styles.filterLabel}>{label}</Text><Ionicons name="chevron-forward" size={14} color="#68717D" /></Pressable>)}</View>
      <Pressable testID="ledger-muscle-groups-snapshot" onPress={() => openRoom('muscle-groups')} style={({ pressed }) => [styles.muscleJump, pressed && styles.pressed]}><View style={styles.muscleJumpIcon}><Ionicons name="accessibility-outline" size={22} color="#B48AF1" /></View><View style={styles.muscleJumpCopy}><Text style={styles.muscleJumpTitle}>MUSCLE GROUPS</Text><Text style={styles.muscleJumpDetail}>See performed volume and movement balance.</Text></View><Ionicons name="arrow-forward" size={17} color="#8D96A2" /></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 22, paddingBottom: 20 },
  sectionInset: { gap: 10, marginHorizontal: 14 },
  titleBlock: { gap: 2, paddingHorizontal: 18, paddingTop: 5, paddingBottom: 3 },
  archiveKicker: { color: '#B18CE9', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1.35 },
  pageTitle: { color: '#F0EAF8', fontSize: 36, lineHeight: 40, fontWeight: '700', letterSpacing: 0.2 },
  pageSubtitle: { color: '#848B96', fontSize: 10, lineHeight: 14 },
  sectionKicker: { color: '#A98BDA', fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.75 },
  careerSnapshot: { overflow: 'hidden', alignItems: 'center', paddingTop: 10, borderRadius: 13, borderWidth: 1, borderColor: '#372C23', backgroundColor: '#0D0B08' },
  sessionValue: { marginTop: 1, color: '#F4F1ED', fontSize: 39, lineHeight: 41, fontWeight: '400', letterSpacing: -1.5 },
  sessionLabel: { color: '#9D968C', fontSize: 7, lineHeight: 9, letterSpacing: 0.6 },
  snapshotStats: { width: '100%', flexDirection: 'row', marginTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#373027' },
  snapshotStat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRightWidth: StyleSheet.hairlineWidth, borderColor: '#302B26' },
  statSeal: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  snapshotStatValue: { color: '#F0EDF2', fontSize: 16, lineHeight: 18, fontWeight: '500' },
  snapshotStatLabel: { color: '#858B94', fontSize: 6.5, lineHeight: 9, letterSpacing: 0.5 },
  liftStrip: { flexDirection: 'row', gap: 4 },
  liftResult: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#252C35', backgroundColor: '#090C11' },
  liftResultLabel: { fontSize: 7, lineHeight: 9, fontWeight: '700', letterSpacing: 0.45 },
  liftResultValue: { color: '#F3F1F4', fontSize: 23, lineHeight: 25, fontWeight: '500' },
  liftResultUnit: { color: '#78808B', fontSize: 5.8, lineHeight: 8, letterSpacing: 0.25 },
  latestEntry: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#39284E', backgroundColor: '#0D0A12' },
  prSeal: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1.5, borderColor: '#B25ADE', backgroundColor: '#24102F' },
  prSealText: { color: '#E1A5F5', fontSize: 13, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
  latestCopy: { flex: 1, minWidth: 0, gap: 1 },
  latestTitle: { color: '#B895F0', fontSize: 8.5, lineHeight: 11, fontWeight: '600' },
  latestValue: { color: '#F2EFF4', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  latestDate: { color: '#737B87', fontSize: 7, lineHeight: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 },
  sectionTitle: { color: '#B590EE', fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.75 },
  sectionMeta: { color: '#9B79D0', fontSize: 7.5, lineHeight: 10, letterSpacing: 0.55 },
  contextGrid: { gap: 7 },
  contextCard: { minHeight: 98, overflow: 'hidden', gap: 3, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: '#28313C', backgroundColor: '#0A0E13' },
  blockCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextCopy: { flex: 1, minWidth: 0, gap: 3 },
  contextLabel: { color: '#79828E', fontSize: 7, lineHeight: 9, fontWeight: '700', letterSpacing: 0.5 },
  contextValue: { color: '#ECEAF0', fontSize: 13, lineHeight: 16, fontWeight: '600' },
  contextMetric: { color: '#F0EEF2', fontSize: 22, lineHeight: 25, fontWeight: '500' },
  contextDetail: { color: '#86909C', fontSize: 8, lineHeight: 11 },
  contextTrend: { color: '#76CBD0', fontSize: 8, lineHeight: 11, fontWeight: '600' },
  progressRing: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },
  progressRingValue: { position: 'absolute', color: '#E8E3EE', fontSize: 13, lineHeight: 16, fontWeight: '600' },
  miniChart: { position: 'absolute', right: 8, bottom: 6, width: 118, height: 44 },
  emptyChart: { position: 'absolute', right: 8, bottom: 6, width: 118, height: 44, justifyContent: 'flex-end' },
  emptyChartLine: { height: 1, backgroundColor: '#26303A' },
  prList: { borderRadius: 10, borderWidth: 1, borderColor: '#282D37', backgroundColor: '#090C11' },
  prRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#272D37' },
  prMovement: { color: '#D5C0F1', fontSize: 8.5, lineHeight: 11, fontWeight: '600' },
  prKind: { maxWidth: 180, color: '#7D8591', fontSize: 7, lineHeight: 9 },
  prValue: { flex: 1, color: '#ECE9EF', fontSize: 12, lineHeight: 15, fontWeight: '700', textAlign: 'right' },
  prMiniSeal: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#A44CD1', backgroundColor: '#21102A' },
  prMiniSealText: { color: '#D990EC', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  chapterIndex: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#32313A', backgroundColor: '#090A0E' },
  chapterRow: { minHeight: 69, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2C2D34' },
  chapterNumber: { width: 23, color: '#9784AE', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  chapterIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 8, borderWidth: 1 },
  chapterArtifact: { width: 39, height: 39 },
  chapterCopy: { flex: 1, minWidth: 0, gap: 2 },
  chapterTitle: { color: '#F1EFF2', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  chapterDetail: { color: '#8A9099', fontSize: 8, lineHeight: 11 },
  quickFilters: { overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: '#282D34', backgroundColor: '#090B0F' },
  filterRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292E36' },
  filterLabel: { flex: 1, color: '#C4C7CD', fontSize: 9, lineHeight: 12 },
  muscleJump: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: '#3A2E48', backgroundColor: '#0C0A10' },
  muscleJumpIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#1B1225' },
  muscleJumpCopy: { flex: 1, gap: 2 },
  muscleJumpTitle: { color: '#E9E5ED', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  muscleJumpDetail: { color: '#858B95', fontSize: 8, lineHeight: 11 },
  pressed: { opacity: 0.72 },
  state: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: SLSpacing.md, marginHorizontal: 14 },
  stateTitle: { color: SLColors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#634B81' },
  retryText: { color: '#CCB6EB', fontSize: 11, fontWeight: '600' },
});
