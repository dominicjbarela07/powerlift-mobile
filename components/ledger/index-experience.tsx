import { Ionicons } from '@expo/vector-icons';
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
import { SLColors, SLSpacing } from '@/constants/theme';
import { resolvePlateStackRender } from '@/lib/barbell/plate-stack-render-resolver';
import {
  canonicalLiftKey,
  displayWeight,
  fetchLedgerAccomplishmentHistory,
  kgToDisplay,
  type AccomplishmentEvent,
  type CurrentBest,
  type LedgerUnit,
} from '@/lib/ledger-data';
import { fetchLedgerExplorationIndex, type LedgerExplorationIndex } from '@/lib/ledger-exploration';
import { LEDGER_INDEX_ASSETS, ledgerIndexChapterAsset } from '@/lib/ledger-index-assets';
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
  tone: string;
}[] = [
  { number: '01', room: 'journey', title: 'JOURNEY', detail: 'Blocks, phases, and session history.', tone: '#A873F1' },
  { number: '02', room: 'strength', title: 'STRENGTH', detail: 'Core lifts, variants, rep maxes, trends.', tone: '#62C8EF' },
  { number: '03', room: 'achievements', title: 'ACHIEVEMENTS', detail: 'All PRs, milestones, and awards.', tone: '#E8B95D' },
  { number: '04', room: 'accessories', title: 'ACCESSORIES', detail: 'Exercise progress, volume, and PRs.', tone: '#68D29F' },
  { number: '05', room: 'variants', title: 'VARIANTS', detail: 'Alternate lifts and movement patterns.', tone: '#BB7BEE' },
  { number: '06', room: 'archive', title: 'ARCHIVE', detail: 'Complete session and set history.', tone: '#EC7067' },
];

const PR_EVENT_TYPES = new Set(['CORE_WEIGHT_PR', 'CORE_E1RM_PR', 'CORE_REP_MAX_PR']);
const RAW_COMPLETION_EVENT_TYPES = new Set(['SESSION_COMPLETED', 'CORE_MOVEMENT_SESSION_COMPLETED', 'CORE_PRESCRIPTION_COMPLETED']);

function dateLabel(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function eventTypeLabel(value: string) {
  return value.replace(/^CORE_/, '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventPerformance(event?: AccomplishmentEvent, unit: LedgerUnit = 'lb') {
  if (!event || typeof event.current_value !== 'number') return '—';
  const eventUnit = (event.unit || '').toLowerCase();
  if (eventUnit === 'kg' || eventUnit === 'lb') {
    const kilograms = eventUnit === 'kg' ? event.current_value : event.current_value / 2.2046226218;
    const reps = event.event_type.includes('REP') && typeof event.evidence?.reps === 'number'
      ? ` × ${event.evidence.reps}`
      : '';
    return `${displayWeight(kilograms, unit)} ${unit.toUpperCase()}${reps}`;
  }
  return `${event.current_value.toLocaleString()}${event.unit ? ` ${event.unit}` : ''}`;
}

function eventWeightKg(event?: AccomplishmentEvent) {
  if (!event || typeof event.current_value !== 'number' || !Number.isFinite(event.current_value)) return null;
  const eventUnit = (event.unit || '').toLowerCase();
  if (eventUnit === 'kg') return event.current_value;
  if (eventUnit === 'lb') return event.current_value / 2.2046226218;
  return null;
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
  return `${displayWeight(performance.weight_kg, unit)} ${unit.toUpperCase()}${reps}${effort}`;
}

function plateArtwork(weightKg: number | null | undefined, unit: LedgerUnit): ImageSourcePropType {
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg)) return LEDGER_INDEX_ASSETS.fallbackPlate;
  return resolvePlateStackRender({ weight: kgToDisplay(weightKg, unit), unit })?.imageSource
    ?? LEDGER_INDEX_ASSETS.fallbackPlate;
}

function CareerBars({ values }: { values: readonly number[] }) {
  const chart = values.slice(-12);
  const max = Math.max(1, ...chart);
  if (!chart.length) return <View accessible accessibilityLabel="No weekly session history yet" style={styles.careerChart}><Text style={styles.careerChartLabel}>COMPLETED / WEEK</Text><View style={styles.careerBarsEmpty}><Text style={styles.careerBarsEmptyText}>HISTORY BUILDS HERE</Text></View></View>;
  return <View accessible accessibilityLabel={`Canonical sessions completed by week: ${chart.join(', ')}`} style={styles.careerChart}>
    <Text style={styles.careerChartLabel}>COMPLETED / WEEK</Text>
    <View style={styles.careerBars}>{chart.map((value, index) => <View key={`${index}-${value}`} style={[styles.careerBar, { height: 7 + (value / max) * 39, opacity: 0.42 + (index / Math.max(1, chart.length - 1)) * 0.58 }]} />)}</View>
  </View>;
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

function MiniBars({ values }: { values: readonly number[] }) {
  const chart = values.slice(-8);
  const max = Math.max(1, ...chart);
  return <View accessible accessibilityLabel={`Weekly completed sessions: ${chart.join(', ')}`} style={styles.frequencyBars}>
    {chart.map((value, index) => <View key={`${index}-${value}`} style={[styles.frequencyBar, { height: 7 + (value / max) * 38 }]} />)}
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
  const artwork = plateArtwork(best?.best_value, unit);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${lift.key} strength history`} onPress={onPress} style={({ pressed }) => [styles.liftResult, pressed && styles.pressed]}>
    <Image accessible={false} source={artwork} resizeMode="cover" style={styles.liftArtwork} />
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

function RecentPrCard({ event, unit, onPress, wide = false }: { event: AccomplishmentEvent; unit: LedgerUnit; onPress: () => void; wide?: boolean }) {
  const tone = canonicalLiftKey(event.core_movement_key || event.movement_label) === 'bench'
    ? '#F06C7B'
    : canonicalLiftKey(event.core_movement_key || event.movement_label) === 'deadlift'
      ? '#EF695B'
      : '#A66FF1';
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.prCard, wide && styles.prCardWide, pressed && styles.pressed]}>
    {wide ? <Image accessible={false} source={plateArtwork(eventWeightKg(event), unit)} resizeMode="cover" style={styles.prArtwork} /> : null}
    <View style={[styles.prCardCopy, wide && styles.prCardCopyWide]}><View style={styles.prCardTop}><Text numberOfLines={1} style={styles.prMovement}>{event.movement_label || 'Movement'}</Text><View style={[styles.prMiniSeal, { backgroundColor: tone }]}><Text style={styles.prMiniSealText}>PR</Text></View></View>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.prValue}>{eventPerformance(event, unit)}</Text>
      <Text style={styles.prKind}>{eventTypeLabel(event.event_type)}</Text>
      <Text style={styles.prDate}>{dateLabel(event.occurred_at || event.workout_date)}</Text>
    </View>
  </Pressable>;
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
    return { events, prs, latest, unit, liftBests, medallion, trophyIndex };
  }, [accomplishments, currentBests, history, progression?.athlete?.preferred_units]);

  if (loading || supportLoading) return <View testID="ledger-home-experience" style={styles.state}><Image accessible={false} source={LEDGER_INDEX_ASSETS.record} style={styles.stateImage} /><Text style={styles.stateTitle}>Opening your complete record.</Text></View>;
  if (error) return <View testID="ledger-home-experience" style={styles.state}><Ionicons name={errorKind === 'unauthorized' ? 'lock-closed-outline' : 'alert-circle-outline'} size={32} color="#B994F3" /><Text style={styles.stateTitle}>{error}</Text><Pressable onPress={() => void reload()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>;

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
  const prArtifact = model.medallion
    ? majorVolumeMedallionAsset(model.medallion.family, model.medallion.thresholdLb)
    : LEDGER_INDEX_ASSETS.prMedallion;
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
  const latestEquipment = typeof latestJourneyEntry?.evidence?.equipment_label === 'string'
    ? latestJourneyEntry.evidence.equipment_label
    : null;
  const latestFooter = [latestEquipment, dateLabel(latestDate)].filter(Boolean).join(' · ');
  const latestImage = plateArtwork(latestJourneyEntry?.performance?.weight_kg ?? eventWeightKg(model.latest), model.unit);

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
          <SnapshotStat value={context ? context.lifetime_set_count.toLocaleString() : '—'} label="SETS" tone="#64D7DC" image={ledgerIndexChapterAsset('strength')} />
          <SnapshotStat value={model.prs.length.toLocaleString()} label="PRs" tone="#E1B95B" image={prArtifact} />
          <SnapshotStat value={model.events.length.toLocaleString()} label="ACHIEVEMENTS" tone="#D36BDE" image={trophyArtifact} assetShape="tall" />
        </View>
      </View>

      <Text style={styles.sectionKicker}>CORE LIFTS · LATEST BESTS</Text>
      <View style={styles.liftList}>{CORE_LIFT_PRESENTATION.map((lift, index) => <LiftResult key={lift.key} lift={lift} best={model.liftBests[index]} unit={model.unit} onPress={() => openRoom('strength')} />)}</View>

      <Text style={styles.sectionKicker}>LATEST ENTRY</Text>
      <Pressable disabled={!latestJourneyEntry && !model.latest} accessibilityRole="button" accessibilityLabel={`Latest Ledger entry: ${latestTitle}, ${latestValue}`} onPress={() => latestHref ? router.push(latestHref as any) : model.latest?.source_set_log_id ? router.push(`/(tabs)/ledger/archive/set/${model.latest.source_set_log_id}` as any) : openRoom('journey')} style={({ pressed }) => [styles.latestEntry, pressed && styles.pressed]}>
        <Image accessible={false} source={latestImage} resizeMode="cover" style={styles.latestImage} />
        <View style={styles.latestCopy}><View style={styles.latestTopLine}><Text style={styles.latestTitle}>{latestTitle.toUpperCase()}</Text>{latestIsPr ? <View style={styles.latestPrBadge}><Text style={styles.latestPrBadgeText}>PR</Text></View> : null}</View><Text numberOfLines={1} style={styles.latestContext}>{latestContext}</Text><Text style={styles.latestValue}>{latestValue}</Text><Text numberOfLines={1} style={styles.latestDate}>{latestFooter}</Text></View>
        <Ionicons name="arrow-forward" size={20} color="#B99AF0" />
      </Pressable>
    </View>

    <View style={styles.sectionInset}>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>AT A GLANCE</Text><Text style={styles.sectionMeta}>CONTEXT MATTERS</Text></View>
      <View style={styles.contextGrid}>
        <Pressable onPress={() => openRoom('journey')} style={({ pressed }) => [styles.contextCard, styles.blockCard, pressed && styles.pressed]}>
          <ImageBackground accessible={false} source={ledgerIndexChapterAsset('strength')} resizeMode="cover" style={styles.blockBackdrop} imageStyle={styles.blockBackdropImage}><View style={styles.blockBackdropScrim} /></ImageBackground>
          <View style={styles.contextCopy}><Text style={styles.contextLabel}>CURRENT BLOCK</Text><Text style={styles.contextValue}>{context?.block?.name || 'No current block'}</Text><Text style={styles.contextDetail}>{context?.week_number ? `Week ${context.week_number}${context.total_weeks ? ` of ${context.total_weeks}` : ''}` : 'No dated week context'}</Text></View>
          <ProgressRing value={context?.block_progress ?? 0} />
        </Pressable>
        <Pressable onPress={() => openRoom('journey')} style={({ pressed }) => [styles.contextCard, pressed && styles.pressed]}><Text style={styles.contextLabel}>REPORTED BODYWEIGHT</Text><Text style={styles.contextMetric}>{bodyweight ? `${displayWeight(bodyweight, model.unit)} ${model.unit.toUpperCase()}` : '—'}</Text><Text style={styles.contextDetail}>{bodyweightContextLine}</Text>{bodyweightTrendLine ? <Text style={styles.contextTrend}>{bodyweightTrendLine}</Text> : null}<MiniLine values={bodyweightPoints.slice(-8)} tone="#76CBD0" label="Reported pre-session bodyweight trend" /></Pressable>
        <View style={styles.contextCard}><Text style={styles.contextLabel}>TRAINING FREQUENCY</Text><Text style={styles.contextMetric}>{frequency == null ? '—' : Number(frequency).toFixed(1)}</Text><Text style={styles.contextDetail}>Sessions / week</Text><MiniBars values={frequencyPoints} /></View>
      </View>

      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>RECENT PRs</Text><Pressable onPress={() => openRoom('achievements')}><Text style={styles.sectionMeta}>VIEW ALL</Text></Pressable></View>
      {model.prs.length === 1 ? <RecentPrCard wide event={model.prs[0]} unit={model.unit} onPress={() => model.prs[0].source_set_log_id ? router.push(`/(tabs)/ledger/archive/set/${model.prs[0].source_set_log_id}` as any) : openRoom('achievements')} /> : model.prs.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prRail}>{model.prs.slice(0, 8).map((event) => <RecentPrCard key={event.id} event={event} unit={model.unit} onPress={() => event.source_set_log_id ? router.push(`/(tabs)/ledger/archive/set/${event.source_set_log_id}` as any) : openRoom('achievements')} />)}</ScrollView> : <View style={styles.emptyPrs}><Text style={styles.emptyPrsTitle}>No personal records yet.</Text><Text style={styles.emptyPrsBody}>Qualifying performances will be preserved here.</Text></View>}
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
  hero: { minHeight: 205, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: '#000000' },
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
  liftArtwork: { width: '37%', height: 80 },
  liftScrim: { position: 'absolute', left: '24%', top: 0, bottom: 0, width: '18%', backgroundColor: 'rgba(8,10,14,0.62)' },
  liftResultCopy: { flex: 1, minWidth: 0, gap: 0, marginLeft: 14 },
  liftResultLabel: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.42 },
  liftResultValue: { color: '#F4F2F5', fontSize: 28, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6 },
  liftResultUnit: { color: '#9AA2AD', fontSize: 10, lineHeight: 13, fontWeight: '600', letterSpacing: 0.28 },
  latestEntry: { height: 102, flexDirection: 'row', alignItems: 'center', gap: 11, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#49325E', backgroundColor: '#0D0A12', paddingRight: 13 },
  latestImage: { width: 108, height: 102, backgroundColor: '#090A0D' },
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
  contextGrid: { gap: 7 },
  contextCard: { minHeight: 112, overflow: 'hidden', gap: 3, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#2D3742', backgroundColor: '#080D12' },
  blockCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  blockBackdropImage: { opacity: 0.46 },
  blockBackdropScrim: { flex: 1, backgroundColor: 'rgba(4,7,10,0.64)' },
  contextCopy: { flex: 1, minWidth: 0, gap: 3 },
  contextLabel: { color: '#929AA5', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.52 },
  contextValue: { color: '#F0EEF2', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  contextMetric: { color: '#F3F0F4', fontSize: 29, lineHeight: 33, fontWeight: '600', letterSpacing: -0.55 },
  contextDetail: { color: '#9AA2AD', fontSize: 10, lineHeight: 14 },
  contextTrend: { color: '#76CBD0', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  progressRing: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  progressRingValue: { position: 'absolute', color: '#F2EEF5', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  miniChart: { position: 'absolute', right: 10, bottom: 8, width: 134, height: 52 },
  emptyChart: { position: 'absolute', right: 10, bottom: 8, width: 134, height: 52, justifyContent: 'flex-end' },
  emptyChartLine: { height: 1, backgroundColor: '#26303A' },
  frequencyBars: { position: 'absolute', right: 14, bottom: 12, width: 138, height: 49, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 7 },
  frequencyBar: { width: 9, minHeight: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: '#9D63E8' },
  prRail: { gap: 7, paddingRight: 14 },
  prCard: { width: 143, minHeight: 122, gap: 2, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: '#30343D', backgroundColor: '#090B0F' },
  prCardWide: { width: '100%', height: 96, flexDirection: 'row', alignItems: 'stretch', gap: 12, padding: 0, paddingRight: 13, overflow: 'hidden' },
  prArtwork: { width: 112, height: 96, backgroundColor: '#07090C' },
  prCardCopy: { flex: 1, minWidth: 0, gap: 2 },
  prCardCopyWide: { paddingVertical: 11 },
  prCardTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  prMovement: { flex: 1, color: '#B8A9CA', fontSize: 9, lineHeight: 12, fontWeight: '700', textTransform: 'uppercase' },
  prValue: { marginTop: 6, color: '#F4F2F5', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  prKind: { color: '#ABA2B4', fontSize: 9, lineHeight: 12 },
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
