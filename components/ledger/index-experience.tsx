import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { SLColors, SLSpacing } from '@/constants/theme';
import {
  canonicalLiftKey,
  displayCalculatedWeight,
  displayWeight,
  type AccomplishmentEvent,
  type CurrentBest,
  type LedgerUnit,
} from '@/lib/ledger-data';
import { fetchLedgerExplorationIndex, type LedgerExplorationIndex, type LedgerMovementProgress } from '@/lib/ledger-exploration';
import { LEDGER_INDEX_ASSETS, ledgerCoreLiftAsset, ledgerIndexChapterAsset } from '@/lib/ledger-index-assets';
import { fetchJourneyBootstrap, type JourneyBootstrap, type JourneyEntry } from '@/lib/ledger-journey';
import { formatPerformedLoad } from '@/lib/performed-load-semantics';
import { canonicalTotal, totalClubState } from '@/lib/ledger-rewards';
import { SL_TOTAL_TROPHY_ASSETS } from '@/lib/trophy-assets';
import { CORE_LIFT_PRESENTATION } from './model';
import { ledgerHrefFor, type LedgerRoom } from './routing';
import { useLedgerLiveData } from './use-ledger-live-data';

const CHAPTERS: readonly {
  number: string;
  room: Exclude<LedgerRoom, 'home' | 'muscle-groups' | 'filters'>;
  title: string;
  detail: string;
  tone: string;
}[] = [
  { number: '01', room: 'journey', title: 'JOURNEY', detail: 'Blocks, phases, and session history.', tone: '#A873F1' },
  { number: '02', room: 'strength', title: 'STRENGTH', detail: 'Core lifts, variants, rep maxes, trends.', tone: '#62C8EF' },
  { number: '03', room: 'achievements', title: 'ACHIEVEMENTS', detail: 'All PRs, milestones, and awards.', tone: '#E8B95D' },
  { number: '04', room: 'accessories', title: 'ACCESSORIES', detail: 'Exercise progress, volume, and PRs.', tone: '#68D29F' },
  { number: '05', room: 'variants', title: 'VARIANTS', detail: 'Alternate lifts and movement patterns.', tone: '#BB7BEE' },
  { number: '06', room: 'archive', title: 'ARCHIVE', detail: 'Complete session and set history.', tone: '#EC7067' },
];

const PR_EVENT_TYPES = new Set([
  'CORE_E1RM_PR',
  'CORE_WEIGHT_PR',
  'CORE_REP_MAX_PR',
  'CORE_RPE_PR',
  'CORE_SAME_WEIGHT_REP_PR',
  'CORE_BLOCK_E1RM_BEST',
  'CORE_BLOCK_WEIGHT_BEST',
  'CORE_BLOCK_REP_MAX_BEST',
  'CORE_BLOCK_SAME_WEIGHT_REP_BEST',
]);
const RAW_COMPLETION_EVENT_TYPES = new Set(['SESSION_COMPLETED', 'CORE_MOVEMENT_SESSION_COMPLETED', 'CORE_PRESCRIPTION_COMPLETED']);
const PR_SIGNIFICANCE: Readonly<Record<string, number>> = Object.freeze({
  CORE_REP_MAX_PR: 0,
  CORE_WEIGHT_PR: 1,
  CORE_E1RM_PR: 2,
  CORE_SAME_WEIGHT_REP_PR: 3,
  CORE_RPE_PR: 4,
  CORE_BLOCK_REP_MAX_BEST: 5,
  CORE_BLOCK_WEIGHT_BEST: 6,
  CORE_BLOCK_E1RM_BEST: 7,
  CORE_BLOCK_SAME_WEIGHT_REP_BEST: 8,
});

type RecentPrPerformance = Readonly<{
  key: string;
  primary: AccomplishmentEvent;
  badges: string[];
}>;

function dateLabel(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function eventTypeLabel(value: string, reps?: number | null) {
  if (value.includes('REP_MAX')) return reps ? `${reps}RM PR` : 'REP MAX PR';
  if (value.includes('SAME_WEIGHT_REP')) return value.includes('BLOCK') ? 'BLOCK REP BEST' : 'REP PR';
  if (value.includes('WEIGHT')) return value.includes('BLOCK') ? 'BLOCK WEIGHT BEST' : 'WEIGHT PR';
  if (value.includes('E1RM')) return value.includes('BLOCK') ? 'BLOCK e1RM BEST' : 'e1RM PR';
  if (value.includes('RPE')) return 'RPE PR';
  return 'PERSONAL RECORD';
}

function evidenceNumber(event: AccomplishmentEvent | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = event?.evidence?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function eventReps(event?: AccomplishmentEvent) {
  return evidenceNumber(event, 'actual_reps', 'rep_count', 'reps');
}

function eventPerformedWeightKg(event?: AccomplishmentEvent) {
  const evidenceWeight = evidenceNumber(event, 'actual_weight_kg');
  if (evidenceWeight != null) return evidenceWeight;
  if (!event || typeof event.current_value !== 'number' || !Number.isFinite(event.current_value)) return null;
  const eventUnit = (event.unit || '').toLowerCase();
  if (eventUnit === 'kg') return event.current_value;
  if (eventUnit === 'lb') return event.current_value / 2.2046226218;
  return null;
}

function eventPerformance(event?: AccomplishmentEvent, unit: LedgerUnit = 'lb') {
  const weightKg = eventPerformedWeightKg(event);
  if (weightKg != null) {
    const reps = eventReps(event);
    const isCalculatedEstimate = Boolean(event?.event_type.includes('E1RM'))
      && evidenceNumber(event, 'actual_weight_kg') == null;
    const displayed = isCalculatedEstimate
      ? displayCalculatedWeight(weightKg, unit)
      : displayWeight(weightKg, unit);
    return `${displayed} ${unit.toUpperCase()}${reps ? ` × ${reps}` : ''}`;
  }
  if (!event || typeof event.current_value !== 'number') return '—';
  return `${event.current_value.toLocaleString()}${event.unit ? ` ${event.unit}` : ''}`;
}

function displayVolume(valueKg: number | null | undefined, unit: LedgerUnit) {
  if (valueKg == null || !Number.isFinite(valueKg)) return '—';
  const value = unit === 'lb' ? valueKg * 2.2046226218 : valueKg;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}K ${unit.toUpperCase()}`;
  return `${Math.round(value).toLocaleString()} ${unit.toUpperCase()}`;
}

function eventComparison(event: AccomplishmentEvent, unit: LedgerUnit) {
  const reps = eventReps(event);
  const delta = typeof event.delta === 'number' && Number.isFinite(event.delta) ? event.delta : null;
  const priorValue = typeof event.prior_value === 'number' && Number.isFinite(event.prior_value) ? event.prior_value : null;
  if (priorValue != null && delta != null && delta > 0 && (event.unit === 'kg' || event.unit === 'lb')) {
    const deltaKg = event.unit === 'kg' ? delta : delta / 2.2046226218;
    const amount = `+${event.event_type.includes('E1RM') ? displayCalculatedWeight(deltaKg, unit) : displayWeight(deltaKg, unit)} ${unit.toUpperCase()}`;
    if (event.event_type.includes('REP_MAX')) return `${amount} · VS PRIOR ${reps ? `${reps}RM` : 'REP MAX'}`;
    if (event.event_type.includes('E1RM')) return `e1RM ${amount}`;
    return `${amount} · VS PRIOR BEST`;
  }
  if (event.event_type.includes('REP_MAX') && reps) return `NEW ${reps}RM`;
  if (event.event_type.includes('BLOCK')) return 'BLOCK BEST';
  return 'NEW PERSONAL RECORD';
}

function journeyLoadConvention(entry: JourneyEntry | null) {
  const loadSemantics = entry?.evidence?.load_semantics;
  if (loadSemantics && typeof loadSemantics === 'object') {
    const convention = (loadSemantics as Record<string, unknown>).load_convention;
    if (typeof convention === 'string') return convention;
  }
  const equipment = entry?.evidence?.equipment;
  if (!equipment || typeof equipment !== 'object') return null;
  const convention = (equipment as Record<string, unknown>).load_convention;
  return typeof convention === 'string' ? convention : null;
}

function journeyPerformance(entry: JourneyEntry | null, unit: LedgerUnit) {
  const performance = entry?.performance;
  if (!entry || typeof performance?.weight_kg !== 'number') return entry?.detail || '—';
  const reps = typeof performance.reps === 'number' ? ` × ${performance.reps}` : '';
  const effort = typeof performance.rpe === 'number'
    ? ` @ RPE ${performance.rpe}`
    : typeof performance.rir === 'number'
      ? ` @ ${performance.rir} RIR`
      : '';
  const loadSemantics = entry?.evidence?.load_semantics;
  const measurementType = loadSemantics && typeof loadSemantics === 'object'
    ? (loadSemantics as Record<string, unknown>).measurement_type
    : null;
  const load = formatPerformedLoad(performance.weight_kg, unit, {
    loadConvention: journeyLoadConvention(entry),
    measurementType: typeof measurementType === 'string' ? measurementType : null,
  }) || `${displayWeight(performance.weight_kg, unit)} ${unit.toUpperCase()}`;
  return `${load}${reps}${effort}`;
}

function comparePrEvents(left: AccomplishmentEvent, right: AccomplishmentEvent) {
  const time = Date.parse(right.occurred_at || right.workout_date || '') - Date.parse(left.occurred_at || left.workout_date || '');
  if (Number.isFinite(time) && time !== 0) return time;
  const significance = (PR_SIGNIFICANCE[left.event_type] ?? 99) - (PR_SIGNIFICANCE[right.event_type] ?? 99);
  if (significance !== 0) return significance;
  return (left.priority ?? 999) - (right.priority ?? 999) || right.id - left.id;
}

function recentPrPerformances(events: readonly AccomplishmentEvent[]): RecentPrPerformance[] {
  const grouped = new Map<string, AccomplishmentEvent[]>();
  [...events].filter((event) => PR_EVENT_TYPES.has(event.event_type)).sort(comparePrEvents).forEach((event) => {
    const key = event.source_set_log_id ? `set:${event.source_set_log_id}` : `event:${event.id}`;
    grouped.set(key, [...(grouped.get(key) || []), event]);
  });
  return [...grouped.entries()].map(([key, related]) => {
    const sorted = [...related].sort((left, right) => {
      const significance = (PR_SIGNIFICANCE[left.event_type] ?? 99) - (PR_SIGNIFICANCE[right.event_type] ?? 99);
      return significance || (left.priority ?? 999) - (right.priority ?? 999) || right.id - left.id;
    });
    return {
      key,
      primary: sorted[0],
      badges: sorted.map((event) => eventTypeLabel(event.event_type, eventReps(event))).filter((value, index, values) => values.indexOf(value) === index),
    };
  }).sort((left, right) => comparePrEvents(left.primary, right.primary));
}

function CareerBars({ values }: { values: readonly number[] }) {
  const chart = values.slice(-12);
  const max = Math.max(1, ...chart);
  if (!chart.some((value) => value > 0)) return <View accessible accessibilityLabel="No weekly session history yet" style={styles.careerChart}><Text style={styles.careerChartLabel}>COMPLETED / WEEK</Text><View style={styles.careerBarsEmpty}><Text style={styles.careerBarsEmptyText}>HISTORY BUILDS HERE</Text></View></View>;
  return <View accessible accessibilityLabel={`Canonical sessions completed by week: ${chart.join(', ')}`} style={styles.careerChart}>
    <Text style={styles.careerChartLabel}>COMPLETED / WEEK</Text>
    <View style={styles.careerBars}>{chart.map((value, index) => <View key={`${index}-${value}`} style={[styles.careerBar, { height: 7 + (value / max) * 39, opacity: 0.42 + (index / Math.max(1, chart.length - 1)) * 0.58 }]} />)}</View>
  </View>;
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function currentWeekStart() {
  const now = new Date();
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  now.setUTCDate(now.getUTCDate() - mondayOffset);
  now.setUTCHours(0, 0, 0, 0);
  return now;
}

function completedTrainingWeeks(weeks: readonly { week_start?: string | null; completed?: number | null }[], count = 8) {
  const currentMonday = currentWeekStart();
  const byStart = new Map(weeks.map((week) => [week.week_start, Math.max(0, week.completed ?? 0)]));
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(currentMonday);
    start.setUTCDate(start.getUTCDate() - 7 * (count - index));
    const weekStart = isoDay(start);
    return { weekStart, completed: byStart.get(weekStart) ?? 0 };
  });
}

function completedVolumeWeeks(points: readonly { date?: string | null; value_kg?: number | null }[]) {
  const currentMonday = isoDay(currentWeekStart());
  return points
    .filter((point): point is { date: string; value_kg: number } => Boolean(point.date && point.date < currentMonday && typeof point.value_kg === 'number' && Number.isFinite(point.value_kg)))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-8);
}

function shortWeekLabel(value?: string | null) {
  if (!value) return 'Completed week';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return 'Completed week';
  return `Week of ${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

function MiniLine({ values, tone, label }: { values: readonly number[]; tone: string; label: string }) {
  if (values.length < 2) return <View accessibilityLabel={`${label}: not enough evidence`} style={styles.emptyChart}><View style={styles.emptyChartLine} /></View>;
  const width = 134;
  const height = 52;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = Math.max(1, high - low);
  const coordinates = values.map((value, index) => ({
    x: 6 + index * ((width - 12) / (values.length - 1)),
    y: height - 7 - ((value - low) / spread) * (height - 15),
  }));
  const points = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  return <View accessibilityLabel={label} style={styles.miniChart}>
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1="4" x2={width - 4} y1={height - 6} y2={height - 6} stroke="#26303A" />
      <Polyline points={points} fill="none" stroke={tone} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {coordinates.map(({ x, y }, index) => <Circle key={index} cx={x} cy={y} r="2.4" fill={index === coordinates.length - 1 ? '#F2FFFF' : tone} />)}
    </Svg>
  </View>;
}

function ContextBars({ values, tone = '#9D63E8' }: { values: readonly number[]; tone?: string }) {
  const max = Math.max(...values, 1);
  return <View accessibilityLabel={`Trend: ${values.join(', ') || 'not enough evidence'}`} style={styles.contextBars}>
    {values.some((value) => value > 0) ? values.map((value, index) => <View key={`${index}-${value}`} style={[styles.contextBar, { height: `${Math.max(10, Math.round((Math.max(0, value) / max) * 100))}%`, backgroundColor: tone }]} />) : <View style={styles.contextBarsEmpty} />}
  </View>;
}

function ProgressRing({ value, tone = '#A873F1' }: { value: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  const size = 70;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * 2 * radius;
  return <View style={styles.progressRing}>
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#252D38" strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={tone} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - clamped)} rotation="-90" origin={`${size / 2} ${size / 2}`} />
    </Svg>
    <Text style={styles.progressRingValue}>{Math.round(clamped * 100)}%</Text>
  </View>;
}

function SnapshotStat({ value, label, tone, image, assetShape = 'wide' }: { value: string; label: string; tone: string; image: ImageSourcePropType; assetShape?: 'wide' | 'tall' }) {
  return <View style={styles.snapshotStat}>
    <View style={[styles.snapshotStatArtifact, { borderColor: `${tone}45` }]}><Image accessible={false} source={image} resizeMode="contain" style={assetShape === 'tall' ? styles.snapshotStatImageTall : styles.snapshotStatImageWide} /></View>
    <Text style={styles.snapshotStatValue}>{value}</Text>
    <Text style={[styles.snapshotStatLabel, { color: tone }]}>{label}</Text>
  </View>;
}

function LiftResult({ lift, best, unit, onPress }: { lift: typeof CORE_LIFT_PRESENTATION[number]; best?: CurrentBest; unit: LedgerUnit; onPress: () => void }) {
  const artwork = ledgerCoreLiftAsset(best?.core_movement_key || lift.key);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${lift.key} strength history`} onPress={onPress} style={({ pressed }) => [styles.liftResult, pressed && styles.pressed]}>
    {artwork ? <Image accessible={false} source={artwork} resizeMode="contain" style={styles.liftArtwork} /> : <View accessible={false} style={styles.liftArtworkFallback}><Ionicons name="barbell-outline" size={37} color={lift.color} /></View>}
    <View style={styles.liftScrim} />
    <View style={styles.liftResultCopy}>
      <Text style={[styles.liftResultLabel, { color: lift.color }]}>{lift.key.toUpperCase()}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.liftResultValue}>{best ? displayWeight(best.best_value, unit) : '—'}</Text>
      <Text style={styles.liftResultUnit}>{best ? unit.toUpperCase() : 'NO EVIDENCE'}</Text>
    </View>
    <Ionicons name="arrow-forward" size={19} color="#B7BEC8" />
  </Pressable>;
}

function ChapterRow({ chapter, onPress, image }: { chapter: typeof CHAPTERS[number]; onPress: () => void; image: ImageSourcePropType }) {
  return <Pressable testID={`ledger-${chapter.room}-snapshot`} accessibilityRole="button" accessibilityLabel={`Open ${chapter.title}: ${chapter.detail}`} onPress={onPress} style={({ pressed }) => [styles.chapterRow, pressed && styles.pressed]}>
    <Text style={styles.chapterNumber}>{chapter.number}</Text>
    <View style={[styles.chapterImageFrame, { borderColor: `${chapter.tone}55` }]}>
      <Image accessible={false} source={image} resizeMode={chapter.room === 'achievements' ? 'contain' : 'cover'} style={styles.chapterImage} />
      <View style={[styles.chapterImageTint, { backgroundColor: `${chapter.tone}0D` }]} />
    </View>
    <View style={styles.chapterCopy}>
      <Text style={styles.chapterTitle}>{chapter.title}</Text>
      <Text style={styles.chapterDetail}>{chapter.detail}</Text>
    </View>
    <Ionicons name="chevron-forward" size={22} color="#89939F" />
  </Pressable>;
}

function RecentPrCard({ performance, unit, onPress, hero = false }: { performance: RecentPrPerformance; unit: LedgerUnit; onPress: () => void; hero?: boolean }) {
  const event = performance.primary;
  const tone = canonicalLiftKey(event.core_movement_key || event.movement_label) === 'bench'
    ? '#F06C7B'
    : canonicalLiftKey(event.core_movement_key || event.movement_label) === 'deadlift'
      ? '#EF695B'
      : '#A66FF1';
  const artwork = ledgerCoreLiftAsset(event.core_movement_key || event.movement_label) || LEDGER_INDEX_ASSETS.careerPr;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${event.movement_label || 'Movement'} ${eventPerformance(event, unit)}, ${eventTypeLabel(event.event_type, eventReps(event))}`} onPress={onPress} style={({ pressed }) => [styles.prCard, hero && styles.prCardHero, pressed && styles.pressed]}>
    {hero ? <LinearGradient colors={['rgba(74,19,105,0.96)', 'rgba(28,8,38,0.97)', 'rgba(8,7,12,0.99)']} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFillObject} /> : null}
    {hero ? <View pointerEvents="none" style={styles.prParticles}>{[0, 1, 2, 3, 4, 5, 6, 7].map((dot) => <View key={dot} style={[styles.prParticle, { left: `${8 + ((dot * 17) % 86)}%`, top: `${9 + ((dot * 29) % 73)}%`, opacity: 0.25 + (dot % 3) * 0.17 }]} />)}</View> : null}
    <View style={[styles.prArtworkFrame, hero && styles.prArtworkFrameHero]}><Image accessible={false} source={artwork} resizeMode="contain" style={styles.prArtwork} /></View>
    <View style={[styles.prCardCopy, hero && styles.prCardCopyHero]}><View style={styles.prCardTop}><Text numberOfLines={1} style={[styles.prMovement, hero && styles.prMovementHero]}>{event.movement_label || 'Movement'}</Text><View style={[styles.prMiniSeal, { backgroundColor: tone }]}><Text style={styles.prMiniSealText}>PR</Text></View></View>
      <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={[styles.prValue, hero && styles.prValueHero]}>{eventPerformance(event, unit)}</Text>
      <Text style={[styles.prKind, hero && styles.prKindHero]}>{eventTypeLabel(event.event_type, eventReps(event))}</Text>
      <Text numberOfLines={1} style={styles.prComparison}>{eventComparison(event, unit)}</Text>
      {hero && performance.badges.length > 1 ? <View style={styles.prBadges}>{performance.badges.slice(1, 3).map((badge) => <View key={badge} style={styles.prBadge}><Text style={styles.prBadgeText}>{badge}</Text></View>)}</View> : null}
      <Text style={styles.prDate}>{dateLabel(event.occurred_at || event.workout_date)}</Text>
    </View>
  </Pressable>;
}

function LatestEntryArtwork({ movement, entry, fallbackEvent }: { movement?: LedgerMovementProgress | null; entry?: JourneyEntry | null; fallbackEvent?: AccomplishmentEvent }) {
  const movementLabel = movement?.name || entry?.movement?.label || fallbackEvent?.movement_label;
  return <View accessibilityLabel={movementLabel ? `${movementLabel} canonical artwork` : 'Latest movement'} style={styles.latestImage}>{movement ? <CanonicalMovementArtwork movement={movement} size={78} testID="ledger-latest-canonical-movement-artwork" /> : <Image accessible={false} source={LEDGER_INDEX_ASSETS.latestEntryFallback} resizeMode="contain" style={styles.latestImageFallback} />}</View>;
}

export function LedgerIndexExperience() {
  const router = useRouter();
  const { progression, currentBests, accomplishments, loading, error, errorKind, reload } = useLedgerLiveData('1y', { allowPartial: true });
  const [exploration, setExploration] = useState<LedgerExplorationIndex | null>(null);
  const [journeyBootstrap, setJourneyBootstrap] = useState<JourneyBootstrap | null>(null);
  const [supportLoading, setSupportLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchLedgerExplorationIndex(), fetchJourneyBootstrap({ limit: 24, includeSessions: true })])
      .then(([explorationResult, journeyResult]) => {
        if (!active) return;
        if (explorationResult.status === 'fulfilled') setExploration(explorationResult.value);
        if (journeyResult.status === 'fulfilled') setJourneyBootstrap(journeyResult.value);
      })
      .finally(() => { if (active) setSupportLoading(false); });
    return () => { active = false; };
  }, []);

  const model = useMemo(() => {
    const unit: LedgerUnit = progression?.athlete?.preferred_units?.toLowerCase().startsWith('lb') ? 'lb' : 'kg';
    const prs = recentPrPerformances(accomplishments);
    const latest = accomplishments.find((event) => !RAW_COMPLETION_EVENT_TYPES.has(event.event_type));
    const liftBests = CORE_LIFT_PRESENTATION.map((lift) => currentBests
      .filter((best) => canonicalLiftKey(best.core_movement_key || best.movement_label) === canonicalLiftKey(lift.key))
      .sort((left, right) => (left.metric === 'weight' ? -1 : 1) - (right.metric === 'weight' ? -1 : 1) || right.best_value - left.best_value)[0]);
    const completeTotal = canonicalTotal(currentBests);
    const club = totalClubState(completeTotal, unit);
    const trophyIndex = Math.max(0, club.earnedTierIndex);
    return { prs, latest, unit, liftBests, trophyIndex };
  }, [accomplishments, currentBests, progression?.athlete?.preferred_units]);

  if (loading || supportLoading) return <View testID="ledger-home-experience" style={styles.state}><Image accessible={false} source={LEDGER_INDEX_ASSETS.record} style={styles.stateImage} /><Text style={styles.stateTitle}>Opening your complete record.</Text></View>;
  if (error) return <View testID="ledger-home-experience" style={styles.state}><Ionicons name={errorKind === 'unauthorized' ? 'lock-closed-outline' : 'alert-circle-outline'} size={32} color="#B994F3" /><Text style={styles.stateTitle}>{error}</Text><Pressable onPress={() => void reload()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>;

  const today = new Date().toISOString().slice(0, 10);
  const latestJourneyEntry = journeyBootstrap?.timeline.items.find((entry) => entry.occurred_on <= today && !RAW_COMPLETION_EVENT_TYPES.has(entry.event_type)) || null;
  const latestMovement = exploration?.movements.find((movement) => (
    Boolean(latestJourneyEntry?.movement?.key && movement.key === latestJourneyEntry.movement.key)
    || Boolean(latestJourneyEntry?.movement?.label && movement.name === latestJourneyEntry.movement.label)
  )) || null;
  const sessions = Math.max(0, journeyBootstrap?.lifetime.sessions_completed ?? progression?.consistency?.sessions_completed ?? 0);
  const lifetimeSets = journeyBootstrap?.lifetime.total_sets ?? exploration?.context.lifetime_set_count;
  const lifetimePrs = journeyBootstrap?.lifetime.pr_count;
  const lifetimeAchievements = journeyBootstrap?.lifetime.major_achievement_count;
  const context = exploration?.context;
  const completedWeeks = completedTrainingWeeks(progression?.consistency?.weeks ?? []);
  const frequencyPoints = completedWeeks.map((week) => week.completed);
  const frequency = completedWeeks.length
    ? completedWeeks.reduce((sum, week) => sum + week.completed, 0) / completedWeeks.length
    : null;
  const volumeWeeks = completedVolumeWeeks(progression?.metric_trends?.volume?.points ?? []);
  const latestVolumeWeek = volumeWeeks.at(-1) || null;
  const previousVolumeWeek = volumeWeeks.at(-2) || null;
  const comparableVolume = latestVolumeWeek && previousVolumeWeek
    ? (new Date(`${latestVolumeWeek.date}T00:00:00Z`).getTime() - new Date(`${previousVolumeWeek.date}T00:00:00Z`).getTime()) === 7 * 86_400_000
    : false;
  const volumeDeltaPct = comparableVolume && previousVolumeWeek && previousVolumeWeek.value_kg > 0
    ? ((latestVolumeWeek!.value_kg - previousVolumeWeek.value_kg) / previousVolumeWeek.value_kg) * 100
    : null;
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
  const trophyArtifact = SL_TOTAL_TROPHY_ASSETS[model.trophyIndex];
  const openRoom = (room: LedgerRoom) => router.push(ledgerHrefFor(room) as any);
  const latestTitle = latestJourneyEntry?.movement?.label || model.latest?.movement_label || latestJourneyEntry?.title || 'No entry recorded yet';
  const latestValue = latestJourneyEntry ? journeyPerformance(latestJourneyEntry, model.unit) : eventPerformance(model.latest, model.unit);
  const latestDate = latestJourneyEntry?.occurred_at || latestJourneyEntry?.occurred_on || model.latest?.occurred_at || model.latest?.workout_date;
  const latestHref = latestJourneyEntry?.source.href;
  const latestIsPr = latestJourneyEntry
    ? Boolean(latestJourneyEntry.evidence && Array.isArray(latestJourneyEntry.evidence.accomplishments) && latestJourneyEntry.evidence.accomplishments.length)
    : Boolean(model.latest?.event_type.includes('_PR'));
  const latestContext = latestJourneyEntry?.event_type === 'MOVEMENT_ADDED'
    ? latestJourneyEntry.detail
    : latestJourneyEntry?.title && latestJourneyEntry.title !== latestTitle
      ? latestJourneyEntry.title
      : model.latest
        ? eventTypeLabel(model.latest.event_type)
        : 'Your next completed performance will appear here.';
  const latestEquipmentEvidence = latestJourneyEntry?.evidence?.equipment;
  const latestEquipment = latestEquipmentEvidence && typeof latestEquipmentEvidence === 'object'
    ? [
      (latestEquipmentEvidence as Record<string, unknown>).manufacturer,
      (latestEquipmentEvidence as Record<string, unknown>).model,
    ].filter((value): value is string => typeof value === 'string' && Boolean(value)).join(' · ') || null
    : null;
  const latestFooter = [latestEquipment, dateLabel(latestDate)].filter(Boolean).join(' · ');

  return <View testID="ledger-home-experience" style={styles.page}>
    <ImageBackground source={LEDGER_INDEX_ASSETS.hero} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage}>
      <View style={styles.heroScrim} />
      <View style={styles.heroCopy}>
        <Text style={styles.archiveKicker}>STRENGTH · RECORD · HISTORY</Text>
        <Text style={styles.pageTitle}>THE LEDGER</Text>
        <Text style={styles.pageSubtitle}>Your training, written in results.</Text>
      </View>
    </ImageBackground>

    <View style={styles.sectionInset}>
      <View style={styles.careerSnapshot}>
        <View style={styles.careerTop}>
          <View style={styles.careerCopy}><Text style={styles.sectionKicker}>CAREER SNAPSHOT</Text><Text style={styles.sessionValue}>{sessions.toLocaleString()}</Text><Text style={styles.sessionLabel}>SESSIONS RECORDED</Text></View>
          <CareerBars values={frequencyPoints} />
        </View>
        <View style={styles.snapshotStats}>
          <SnapshotStat value={lifetimeSets == null ? '—' : lifetimeSets.toLocaleString()} label="SETS" tone="#64D7DC" image={LEDGER_INDEX_ASSETS.careerSets} />
          <SnapshotStat value={lifetimePrs == null ? '—' : lifetimePrs.toLocaleString()} label="PRs" tone="#E1B95B" image={LEDGER_INDEX_ASSETS.careerPr} assetShape="tall" />
          <SnapshotStat value={lifetimeAchievements == null ? '—' : lifetimeAchievements.toLocaleString()} label="ACHIEVEMENTS" tone="#D36BDE" image={trophyArtifact} assetShape="tall" />
        </View>
      </View>

      <Text style={styles.sectionKicker}>CORE LIFTS · LATEST BESTS</Text>
      <View style={styles.liftList}>{CORE_LIFT_PRESENTATION.map((lift, index) => <LiftResult key={lift.key} lift={lift} best={model.liftBests[index]} unit={model.unit} onPress={() => openRoom('strength')} />)}</View>

      <Text style={styles.sectionKicker}>LATEST ENTRY</Text>
      <Pressable disabled={!latestJourneyEntry && !model.latest} accessibilityRole="button" accessibilityLabel={`Latest Ledger entry: ${latestTitle}, ${latestValue}`} onPress={() => latestHref ? router.push(latestHref as any) : model.latest?.source_set_log_id ? router.push(`/(tabs)/ledger/archive/set/${model.latest.source_set_log_id}` as any) : openRoom('journey')} style={({ pressed }) => [styles.latestEntry, pressed && styles.pressed]}>
        <LatestEntryArtwork movement={latestMovement} entry={latestJourneyEntry} fallbackEvent={model.latest} />
        <View style={styles.latestCopy}><View style={styles.latestTopLine}><Text style={styles.latestTitle}>{latestTitle.toUpperCase()}</Text>{latestIsPr ? <View style={styles.latestPrBadge}><Text style={styles.latestPrBadgeText}>PR</Text></View> : null}</View><Text numberOfLines={1} style={styles.latestContext}>{latestContext}</Text><Text style={styles.latestValue}>{latestValue}</Text><Text numberOfLines={1} style={styles.latestDate}>{latestFooter}</Text></View>
        <Ionicons name="arrow-forward" size={20} color="#B99AF0" />
      </Pressable>
    </View>

    <View style={styles.sectionInset}>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>AT A GLANCE</Text><Text style={styles.sectionMeta}>CONTEXT MATTERS</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contextRail}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open current block in Journey" onPress={() => openRoom('journey')} style={({ pressed }) => [styles.contextCard, styles.blockCard, pressed && styles.pressed]}>
          <ImageBackground accessible={false} source={ledgerIndexChapterAsset('strength')} resizeMode="cover" style={styles.blockBackdrop} imageStyle={styles.blockBackdropImage}><View style={styles.blockBackdropScrim} /></ImageBackground>
          <View style={styles.blockTop}><View style={styles.contextCopy}><Text style={styles.contextLabel}>CURRENT BLOCK</Text><Text numberOfLines={1} style={styles.contextValue}>{context?.block?.name || 'No current block'}</Text><Text style={styles.contextDetail}>{context?.week_number ? `Week ${context.week_number}${context.total_weeks ? ` of ${context.total_weeks}` : ''}` : 'No dated week context'}</Text></View><ProgressRing value={context?.block_progress ?? 0} /></View>
          <Text style={styles.blockEvidence}>{context?.block_total_sessions ? `${context.block_completed_sessions}/${context.block_total_sessions} sessions completed` : 'No completed-session evidence yet'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open completed training volume in Archive" onPress={() => openRoom('archive')} style={({ pressed }) => [styles.contextCard, pressed && styles.pressed]}><Text style={styles.contextLabel}>VOLUME · COMPLETED WEEK</Text><Text adjustsFontSizeToFit minimumFontScale={0.74} numberOfLines={1} style={styles.contextMetric}>{displayVolume(latestVolumeWeek?.value_kg, model.unit)}</Text><Text style={styles.contextDetail}>{shortWeekLabel(latestVolumeWeek?.date)}</Text>{volumeDeltaPct != null ? <Text style={[styles.contextTrend, volumeDeltaPct < 0 && styles.contextTrendDown]}>{volumeDeltaPct >= 0 ? '+' : ''}{volumeDeltaPct.toFixed(0)}% vs prior week</Text> : <Text style={styles.contextEvidence}>No adjacent-week comparison</Text>}<ContextBars values={volumeWeeks.map((point) => point.value_kg)} tone="#A557F0" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open training frequency in Journey" onPress={() => openRoom('journey')} style={({ pressed }) => [styles.contextCard, pressed && styles.pressed]}><Text style={styles.contextLabel}>TRAINING FREQUENCY</Text><Text style={styles.contextMetric}>{frequency == null ? '—' : Number(frequency).toFixed(1)}</Text><Text style={styles.contextDetail}>Sessions / week</Text><Text style={styles.contextEvidence}>Last 8 completed weeks</Text><ContextBars values={frequencyPoints} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open reported bodyweight history in Journey" onPress={() => openRoom('journey')} style={({ pressed }) => [styles.contextCard, pressed && styles.pressed]}><Text style={styles.contextLabel}>REPORTED BODYWEIGHT</Text><Text style={styles.contextMetric}>{bodyweight != null ? `${displayWeight(bodyweight, model.unit)} ${model.unit.toUpperCase()}` : '—'}</Text><Text numberOfLines={2} style={styles.contextDetail}>{bodyweightContextLine}</Text>{bodyweightTrendLine ? <Text numberOfLines={1} style={styles.contextTrend}>{bodyweightTrendLine}</Text> : <Text style={styles.contextEvidence}>No fabricated trend</Text>}<MiniLine values={bodyweightPoints.slice(-8)} tone="#76CBD0" label="Reported pre-session bodyweight trend" /></Pressable>
        {typeof progression?.readiness?.average === 'number' ? <View accessibilityLabel={`Readiness 7-day average ${progression.readiness.average.toFixed(1)}`} style={styles.contextCard}><Text style={styles.contextLabel}>READINESS TREND</Text><Text style={styles.contextMetric}>{progression.readiness.average.toFixed(1)}</Text><Text style={styles.contextDetail}>7-day average</Text><Text numberOfLines={2} style={styles.contextEvidence}>{progression.readiness.context_line || progression.readiness.trend || 'Reported readiness evidence'}</Text><View style={styles.readinessSignal}><Ionicons name="pulse-outline" size={30} color="#68D16F" /><Text style={styles.readinessSignalText}>{progression.readiness.trend || 'CURRENT'}</Text></View></View> : null}
      </ScrollView>

      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>RECENT PRs</Text><Pressable onPress={() => openRoom('achievements')}><Text style={styles.sectionMeta}>VIEW ALL</Text></Pressable></View>
      {model.prs.length ? <><RecentPrCard hero performance={model.prs[0]} unit={model.unit} onPress={() => model.prs[0].primary.source_set_log_id ? router.push(`/(tabs)/ledger/archive/set/${model.prs[0].primary.source_set_log_id}` as any) : openRoom('achievements')} />{model.prs.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prRail}>{model.prs.slice(1, 7).map((performance) => <RecentPrCard key={performance.key} performance={performance} unit={model.unit} onPress={() => performance.primary.source_set_log_id ? router.push(`/(tabs)/ledger/archive/set/${performance.primary.source_set_log_id}` as any) : openRoom('achievements')} />)}</ScrollView> : null}</> : <View style={styles.emptyPrs}><Text style={styles.emptyPrsTitle}>No personal records yet.</Text><Text style={styles.emptyPrsBody}>Qualifying performances will be preserved here.</Text></View>}
    </View>

    <View style={styles.sectionInset}>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>YOUR RECORD</Text><Text style={styles.sectionMeta}>FULL LEDGER INDEX</Text></View>
      <View style={styles.chapterIndex}>{CHAPTERS.map((chapter) => <ChapterRow key={chapter.room} chapter={chapter} onPress={() => openRoom(chapter.room)} image={chapter.room === 'achievements' ? trophyArtifact : ledgerIndexChapterAsset(chapter.room)} />)}</View>
    </View>

    <View style={styles.sectionInset}>
      <Text style={styles.sectionKicker}>QUICK FILTERS</Text>
      <View style={styles.quickFilters}>{['This Block', 'Last 3 Months', 'This Year', 'All Time'].map((label) => <Pressable key={label} onPress={() => router.push({ pathname: ledgerHrefFor('filters'), params: { time: label } } as never)} style={({ pressed }) => [styles.filterRow, pressed && styles.pressed]}><Ionicons name={label === 'All Time' ? 'infinite-outline' : 'calendar-outline'} size={19} color="#B5BBC5" /><Text style={styles.filterLabel}>{label}</Text><Ionicons name="chevron-forward" size={18} color="#7B8591" /></Pressable>)}</View>
      <Pressable testID="ledger-muscle-groups-snapshot" accessibilityRole="button" accessibilityLabel="Open Muscle Groups: performed volume and movement balance" onPress={() => openRoom('muscle-groups')} style={({ pressed }) => [styles.muscleJump, pressed && styles.pressed]}><Image accessible={false} source={LEDGER_INDEX_ASSETS.muscleGroups} resizeMode="contain" style={styles.muscleJumpImage} /><View style={styles.muscleJumpCopy}><Text style={styles.muscleJumpTitle}>MUSCLE GROUPS</Text><Text style={styles.muscleJumpDetail}>See performed volume and movement balance.</Text></View><Ionicons name="chevron-forward" size={22} color="#A7B0BC" /></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 19, paddingBottom: 20, backgroundColor: '#000000' },
  sectionInset: { gap: 9, marginHorizontal: 12 },
  hero: { minHeight: 160, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: '#000000' },
  heroImage: { opacity: 0.96 },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.20)' },
  heroCopy: { gap: 4, paddingHorizontal: 18, paddingBottom: 25 },
  archiveKicker: { color: '#BFA0F2', fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 1.25 },
  pageTitle: { color: '#F5F2F7', fontSize: 39, lineHeight: 43, fontWeight: '800', letterSpacing: -0.7 },
  pageSubtitle: { color: '#D1D2D6', fontSize: 14, lineHeight: 19, fontWeight: '600' },
  sectionKicker: { color: '#B58BEF', fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.72 },
  careerSnapshot: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#393441', backgroundColor: '#08090C' },
  careerTop: { minHeight: 121, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 12 },
  careerCopy: { flex: 1, minWidth: 0 },
  sessionValue: { marginTop: 1, color: '#F6F4F6', fontSize: 47, lineHeight: 50, fontWeight: '700', letterSpacing: -1.8 },
  sessionLabel: { color: '#9DA3AD', fontSize: 11, lineHeight: 15, letterSpacing: 0.55 },
  careerChart: { width: 142, gap: 3, alignItems: 'flex-end' },
  careerChartLabel: { color: '#737C88', fontSize: 7, lineHeight: 9, fontWeight: '700', letterSpacing: 0.5 },
  careerBars: { width: 142, height: 51, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 4, paddingBottom: 2, borderBottomWidth: 1, borderColor: '#333B46' },
  careerBar: { width: 7, minHeight: 8, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: '#A557F0' },
  careerBarsEmpty: { width: 142, height: 51, justifyContent: 'flex-end', paddingBottom: 7, borderBottomWidth: 1, borderColor: '#333B46' },
  careerBarsEmptyText: { color: '#626A75', fontSize: 8, letterSpacing: 0.5, textAlign: 'right' },
  snapshotStats: { minHeight: 101, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#35313A' },
  snapshotStat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, borderRightWidth: StyleSheet.hairlineWidth, borderColor: '#302E35' },
  snapshotStatArtifact: { width: 48, height: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 1, overflow: 'hidden', borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, backgroundColor: '#0D0E12' },
  snapshotStatImageWide: { width: 50, height: 38 },
  snapshotStatImageTall: { width: 31, height: 39 },
  snapshotStatValue: { color: '#F2EFF3', fontSize: 19, lineHeight: 22, fontWeight: '700' },
  snapshotStatLabel: { fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5 },
  liftList: { gap: 4 },
  liftResult: { height: 80, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#30343B', backgroundColor: '#080A0E' },
  liftArtwork: { width: 124, height: 78, marginLeft: 2 },
  liftArtworkFallback: { width: 124, height: 78, alignItems: 'center', justifyContent: 'center' },
  liftScrim: { position: 'absolute', left: 103, top: 0, bottom: 0, width: 35, backgroundColor: 'rgba(8,10,14,0.68)' },
  liftResultCopy: { flex: 1, minWidth: 0, gap: 0, marginLeft: 8 },
  liftResultLabel: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.42 },
  liftResultValue: { color: '#F4F2F5', fontSize: 28, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6 },
  liftResultUnit: { color: '#9AA2AD', fontSize: 10, lineHeight: 13, fontWeight: '600', letterSpacing: 0.28 },
  latestEntry: { height: 102, flexDirection: 'row', alignItems: 'center', gap: 11, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#49325E', backgroundColor: '#0D0A12', paddingRight: 13 },
  latestImage: { width: 108, height: 102, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#090A0D' },
  latestImageFallback: { width: 102, height: 96 },
  latestCopy: { flex: 1, minWidth: 0, gap: 1 },
  latestTopLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  latestTitle: { flexShrink: 1, color: '#C598F5', fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.3 },
  latestContext: { color: '#9299A4', fontSize: 10, lineHeight: 13 },
  latestValue: { color: '#F4F1F5', fontSize: 17, lineHeight: 21, fontWeight: '700' },
  latestDate: { color: '#8B929C', fontSize: 9, lineHeight: 12 },
  latestPrBadge: { minWidth: 27, alignItems: 'center', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: '#9F3150' },
  latestPrBadgeText: { color: '#FFFFFF', fontSize: 8, lineHeight: 10, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 27 },
  sectionTitle: { color: '#BB8CF4', fontSize: 13, lineHeight: 17, fontWeight: '800', letterSpacing: 0.6 },
  sectionMeta: { color: '#B18AE3', fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.45 },
  contextRail: { gap: 7, paddingRight: 14 },
  contextCard: { width: 170, height: 157, overflow: 'hidden', gap: 3, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#2D3742', backgroundColor: '#080D12' },
  blockCard: { width: 218, justifyContent: 'space-between' },
  blockTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  blockBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  blockBackdropImage: { opacity: 0.46 },
  blockBackdropScrim: { flex: 1, backgroundColor: 'rgba(4,7,10,0.64)' },
  contextCopy: { flex: 1, minWidth: 0, gap: 3 },
  contextLabel: { color: '#929AA5', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.52 },
  contextValue: { color: '#F0EEF2', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  contextMetric: { color: '#F3F0F4', fontSize: 29, lineHeight: 33, fontWeight: '600', letterSpacing: -0.55 },
  contextDetail: { color: '#9AA2AD', fontSize: 10, lineHeight: 14 },
  contextTrend: { color: '#76CBD0', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  contextTrendDown: { color: '#ED7A83' },
  contextEvidence: { color: '#697482', fontSize: 8, lineHeight: 11 },
  blockEvidence: { color: '#BEC5CE', fontSize: 9, lineHeight: 12, fontWeight: '600' },
  progressRing: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  progressRingValue: { position: 'absolute', color: '#F2EEF5', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  miniChart: { position: 'absolute', right: 10, bottom: 7, width: 148, height: 47 },
  emptyChart: { position: 'absolute', right: 10, bottom: 7, width: 148, height: 47, justifyContent: 'flex-end' },
  emptyChartLine: { height: 1, backgroundColor: '#26303A' },
  contextBars: { position: 'absolute', left: 12, right: 12, bottom: 8, height: 42, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 5, paddingBottom: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#303843' },
  contextBar: { flex: 1, maxWidth: 14, minHeight: 4, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  contextBarsEmpty: { flex: 1, height: 1, backgroundColor: '#26303A' },
  readinessSignal: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readinessSignalText: { color: '#68D16F', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.45 },
  prRail: { gap: 7, paddingRight: 14 },
  prCard: { width: 171, height: 160, gap: 4, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: '#30343D', backgroundColor: '#090B0F' },
  prCardHero: { width: '100%', height: 154, flexDirection: 'row', alignItems: 'stretch', gap: 10, padding: 10, overflow: 'hidden', borderColor: '#643892' },
  prParticles: { ...StyleSheet.absoluteFillObject },
  prParticle: { position: 'absolute', width: 5, height: 8, borderRadius: 2, backgroundColor: '#D66DFF', transform: [{ rotate: '28deg' }] },
  prArtworkFrame: { height: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 8, backgroundColor: '#08090C' },
  prArtworkFrameHero: { width: 119, height: 132, alignSelf: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#704397', backgroundColor: 'rgba(5,5,8,0.58)' },
  prArtwork: { width: '100%', height: '100%' },
  prCardCopy: { flex: 1, minWidth: 0, gap: 1 },
  prCardCopyHero: { justifyContent: 'center', paddingVertical: 2 },
  prCardTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  prMovement: { flex: 1, color: '#B8A9CA', fontSize: 9, lineHeight: 12, fontWeight: '700', textTransform: 'uppercase' },
  prMovementHero: { color: '#D8A7FF', fontSize: 11, lineHeight: 14 },
  prValue: { marginTop: 6, color: '#F4F2F5', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  prValueHero: { marginTop: 2, fontSize: 27, lineHeight: 32, letterSpacing: -0.55 },
  prKind: { color: '#ABA2B4', fontSize: 9, lineHeight: 12 },
  prKindHero: { color: '#D9CAE2', fontSize: 10, lineHeight: 13 },
  prComparison: { color: '#F091FF', fontSize: 8.5, lineHeight: 11, fontWeight: '700' },
  prBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  prBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(179,91,234,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#8F52AE' },
  prBadgeText: { color: '#DDB8F2', fontSize: 7, lineHeight: 9, fontWeight: '700' },
  prDate: { marginTop: 'auto', color: '#7F8792', fontSize: 8, lineHeight: 11 },
  prMiniSeal: { minWidth: 25, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  prMiniSealText: { color: '#FFFFFF', fontSize: 8, lineHeight: 10, fontWeight: '800' },
  emptyPrs: { gap: 2, padding: 16, borderRadius: 13, borderWidth: 1, borderColor: '#2E333C', backgroundColor: '#090B0F' },
  emptyPrsTitle: { color: '#E5E1E8', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  emptyPrsBody: { color: '#8C949F', fontSize: 10, lineHeight: 14 },
  chapterIndex: { overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#383A42', backgroundColor: '#07090C' },
  chapterRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#34363D' },
  chapterNumber: { width: 28, color: '#939BA6', fontSize: 17, lineHeight: 21, fontWeight: '700' },
  chapterImageFrame: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10, borderWidth: 1, backgroundColor: '#0C0D11' },
  chapterImage: { width: '100%', height: '100%' },
  chapterImageTint: { ...StyleSheet.absoluteFillObject },
  chapterCopy: { flex: 1, minWidth: 0, gap: 3 },
  chapterTitle: { color: '#F3F1F4', fontSize: 15, lineHeight: 19, fontWeight: '800' },
  chapterDetail: { color: '#A2A9B2', fontSize: 10.5, lineHeight: 14 },
  quickFilters: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#30353D', backgroundColor: '#080B0F' },
  filterRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#30343B' },
  filterLabel: { flex: 1, color: '#D4D6DA', fontSize: 13, lineHeight: 17, fontWeight: '600' },
  muscleJump: { minHeight: 126, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 5, overflow: 'hidden', paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: '#6E3BA0', backgroundColor: '#120B19' },
  muscleJumpImage: { width: 118, height: 118, marginLeft: -7 },
  muscleJumpCopy: { flex: 1, gap: 4 },
  muscleJumpTitle: { color: '#C586FA', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  muscleJumpDetail: { color: '#B2B5BE', fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.992 }] },
  state: { minHeight: 480, alignItems: 'center', justifyContent: 'center', gap: SLSpacing.md, marginHorizontal: 14 },
  stateImage: { width: 74, height: 74, opacity: 0.9 },
  stateTitle: { color: SLColors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#634B81' },
  retryText: { color: '#CCB6EB', fontSize: 11, fontWeight: '600' },
});
