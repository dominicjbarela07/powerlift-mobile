import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { SLAtmosphericContextHeader, SLCanonicalIcon } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies, SLLayout, SLRadius } from '@/constants/theme';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import { formatWeightFromKg, kilogramsToDisplayValue } from '@/lib/display-units';
import {
  fetchJourneyBootstrap,
  fetchJourneyTimelinePage,
  fetchReportedBodyweightHistory,
  JourneyRequestError,
  type JourneyBlock,
  type JourneyBootstrap,
  type JourneyEntry,
  type ReportedBodyweightObservation,
} from '@/lib/ledger-journey';
import {
  fetchLedgerProgression,
  LedgerRequestError,
  type LedgerLift,
  type LedgerProgression,
  type LedgerRange,
  type LedgerRequestFailureKind,
  type LedgerUnit,
  type StrengthMetric,
} from '@/lib/ledger-data';
import { journeyPerformanceDetail } from '@/lib/journey-weight-presentation';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';

const JOURNEY_HERO = require('@/assets/images/ledger-index-v2/ledger-chapter-journey-v1.png');
const CHAPTER_ART = {
  current: require('@/assets/images/journey-storyboard-v1/chapter-current.png'),
  foundation: require('@/assets/images/journey-storyboard-v1/chapter-foundation.png'),
  transition: require('@/assets/images/journey-storyboard-v1/chapter-transition.png'),
} as const satisfies Record<string, ImageSourcePropType>;

const RANGE_OPTIONS = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'ALL TIME' },
] as const;
const METRIC_OPTIONS: readonly { key: StrengthMetric; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'squat', label: 'Squat' },
  { key: 'bench', label: 'Bench' },
  { key: 'deadlift', label: 'Deadlift' },
];
const LIFT_TONES: Record<Exclude<StrengthMetric, 'total'>, string> = {
  squat: '#9D66FF',
  bench: '#EA4D98',
  deadlift: '#FF536B',
};

type JourneyRange = Extract<LedgerRange, '30d' | '90d' | 'all'>;
type JourneyDetail =
  | { kind: 'chapter'; block: JourneyBlock }
  | { kind: 'chapters' }
  | { kind: 'bodyweight' }
  | { kind: 'timeline' }
  | null;

type StrengthPoint = Readonly<{ date: string; valueKg: number }>;

export function composeJourneyTotalStrengthPoints(lifts: readonly LedgerLift[]): StrengthPoint[] {
  const byLift = new Map<string, StrengthPoint[]>();
  for (const lift of lifts) {
    const key = String(lift.key || '').toLowerCase();
    if (!['squat', 'bench', 'deadlift'].includes(key)) continue;
    byLift.set(key, (lift.points ?? [])
      .filter((point): point is { date: string; value_kg: number } => Boolean(point.date) && Number.isFinite(point.value_kg))
      .map((point) => ({ date: point.date, valueKg: Number(point.value_kg) }))
      .sort((left, right) => left.date.localeCompare(right.date)));
  }
  if (byLift.size !== 3) return [];
  const dates = [...new Set([...byLift.values()].flatMap((points) => points.map((point) => point.date)))].sort();
  const latest: Partial<Record<'squat' | 'bench' | 'deadlift', number>> = {};
  const indexes = { squat: 0, bench: 0, deadlift: 0 };
  const result: StrengthPoint[] = [];
  for (const date of dates) {
    for (const key of ['squat', 'bench', 'deadlift'] as const) {
      const points = byLift.get(key) ?? [];
      while (indexes[key] < points.length && points[indexes[key]].date <= date) {
        latest[key] = points[indexes[key]].valueKg;
        indexes[key] += 1;
      }
    }
    if (latest.squat != null && latest.bench != null && latest.deadlift != null) {
      result.push({ date, valueKg: latest.squat + latest.bench + latest.deadlift });
    }
  }
  return result;
}

export function JourneyExperience() {
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState<JourneyBootstrap | null>(null);
  const [progressions, setProgressions] = useState<Partial<Record<JourneyRange, LedgerProgression>>>({});
  const [range, setRange] = useState<JourneyRange>('all');
  const [metric, setMetric] = useState<StrengthMetric>('total');
  const [detail, setDetail] = useState<JourneyDetail>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<LedgerRequestFailureKind>('error');
  const { unit, setUnit } = useSurfaceWeightUnit(bootstrap?.athlete.preferred_units);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextBootstrap, allTime] = await Promise.all([
        fetchJourneyBootstrap({ limit: 24, includeSessions: false }),
        fetchLedgerProgression('all'),
      ]);
      setBootstrap(nextBootstrap);
      setProgressions((current) => ({ ...current, all: allTime }));
      setError(null);
    } catch (caught) {
      const status = caught instanceof JourneyRequestError || caught instanceof LedgerRequestError ? caught.status : 0;
      const kind: LedgerRequestFailureKind = caught instanceof LedgerRequestError
        ? caught.kind
        : status === 401 || status === 403
          ? 'unauthorized'
          : status === 404 || status === 410
            ? 'unavailable'
            : 'error';
      setErrorKind(kind);
      setError(kind === 'unauthorized' ? 'Journey is not available to this account.' : kind === 'unavailable' ? 'Journey history is unavailable.' : 'Journey history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (progressions[range]) return;
    let active = true;
    fetchLedgerProgression(range).then((value) => {
      if (active) setProgressions((current) => ({ ...current, [range]: value }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [progressions, range]);

  if (loading) return <JourneyState kind="loading" message="Reconstructing your training record." />;
  if (error || !bootstrap) return <JourneyState kind={errorKind} message={error || 'Journey history is unavailable.'} onRetry={load} />;
  if (!bootstrap.earliest_record) return <JourneyState kind="empty" message="Your Journey begins with the first trustworthy training record." />;

  const allTime = progressions.all;
  const activeProgression = progressions[range] ?? allTime;
  const currentBlock = bootstrap.blocks.items.find((block) => block.state === 'current') ?? null;
  const highlights = curatedHighlights(bootstrap);
  const earliestDate = bootstrap.earliest_record.date;
  const recordDays = Math.max(1, daysBetween(earliestDate, bootstrap.as_of_date) + 1);

  return (
    <View testID="ledger-journey-experience" style={styles.page}>
      <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="ledger-journey-unit-toggle" />
      <SLAtmosphericContextHeader
        accent="#B56BFF"
        atmosphereSource={JOURNEY_HERO}
        backAccessibilityLabel="Back to The Ledger"
        contextLabel="THE LEDGER"
        onBack={() => router.replace('/(tabs)/ledger/home' as any)}
        style={styles.hero}
        subtitle={`${compactDate(earliestDate)} → today · ${recordDays.toLocaleString()} days recorded`}
        testID="journey-atmospheric-header"
        title="Journey"
      >
        <View style={styles.heroMetrics} testID="journey-career-context">
          <HeroMetric label="SESSIONS" value={bootstrap.lifetime.sessions_completed} />
          <HeroMetric label="SETS" value={bootstrap.lifetime.total_sets} />
          <HeroMetric label="PRS" value={bootstrap.lifetime.pr_count} />
          <HeroMetric label="CHAPTERS" value={bootstrap.lifetime.block_count} />
        </View>
      </SLAtmosphericContextHeader>

      <View style={styles.story}>
        <ThenNowSection progression={allTime} bootstrap={bootstrap} unit={unit} />
        <CurrentChapterSection asOfDate={bootstrap.as_of_date} block={currentBlock} unit={unit} onOpen={(block) => setDetail({ kind: 'chapter', block })} />
        <ProgressSection progression={activeProgression} range={range} metric={metric} unit={unit} onRange={setRange} onMetric={setMetric} />
        <TrainingChaptersSection blocks={bootstrap.blocks.items} unit={unit} onOpen={(block) => setDetail({ kind: 'chapter', block })} onOpenAll={() => setDetail({ kind: 'chapters' })} />
        <BodyweightContextSection bootstrap={bootstrap} unit={unit} onOpen={() => setDetail({ kind: 'bodyweight' })} />
        <CareerHighlightsSection entries={highlights} unit={unit} onOpenEvidence={(entry) => entry.source.href && router.push({ pathname: entry.source.href as any, params: { displayUnit: unit } } as any)} />
        <Pressable accessibilityRole="button" onPress={() => setDetail({ kind: 'timeline' })} style={({ pressed }) => [styles.timelinePortal, pressed && styles.pressed]} testID="journey-view-full-timeline">
          <View style={styles.timelinePortalIcon}><Ionicons name="time-outline" size={24} color="#C899FF" /></View>
          <View style={styles.flex}><Text style={styles.portalEyebrow}>FULL TIMELINE</Text><Text style={styles.portalTitle}>Every preserved moment, in order.</Text><Text style={styles.portalBody}>Sessions, PRs, chapters, meets, milestones, and source evidence.</Text></View>
          <Ionicons name="arrow-forward" size={20} color="#C899FF" />
        </Pressable>
      </View>

      <JourneyDetailModal detail={detail} bootstrap={bootstrap} unit={unit} onClose={() => setDetail(null)} onDetail={setDetail} />
    </View>
  );
}

function JourneyState({ kind, message, onRetry }: { kind: 'loading' | 'empty' | LedgerRequestFailureKind; message: string; onRetry?: () => void }) {
  const icon = kind === 'loading' ? 'hourglass-outline' : kind === 'unauthorized' ? 'lock-closed-outline' : kind === 'empty' ? 'map-outline' : 'alert-circle-outline';
  return <View style={styles.state} testID={`ledger-${kind}-state`}><SLCanonicalIcon name={icon} size={29} color="#B56BFF" /><Text style={styles.stateTitle}>{message}</Text>{onRetry ? <Pressable onPress={() => void onRetry()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}</View>;
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <View style={styles.heroMetric}><Text style={styles.heroMetricValue}>{value.toLocaleString()}</Text><Text style={styles.heroMetricLabel}>{label}</Text></View>;
}

function StoryHeading({ eyebrow, title, body, action, actionTestID, onAction }: { eyebrow: string; title: string; body?: string; action?: string; actionTestID?: string; onAction?: () => void }) {
  return <View style={styles.storyHeading}><View style={styles.flex}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.storyTitle}>{title}</Text>{body ? <Text style={styles.storyBody}>{body}</Text> : null}</View>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.headingAction} testID={actionTestID}><Text style={styles.headingActionText}>{action}</Text><Ionicons name="arrow-forward" size={14} color="#C899FF" /></Pressable> : null}</View>;
}

function ThenNowSection({ progression, bootstrap, unit }: { progression?: LedgerProgression; bootstrap: JourneyBootstrap; unit: LedgerUnit }) {
  const lifts = progression?.big_three_arc?.lifts ?? [];
  const bodyweight = bootstrap.bodyweight_context.comparison;
  return <View testID="journey-then-now" style={styles.section}>
    <StoryHeading eyebrow="THEN → NOW" title="The record has moved." body="Earliest and latest trustworthy observations. Nothing inferred between them." />
    <View style={styles.thenNowCard}>
      {(['squat', 'bench', 'deadlift'] as const).map((key) => {
        const lift = lifts.find((item) => String(item.key).toLowerCase() === key);
        const points = (lift?.points ?? []).filter((point) => point.date && point.value_kg != null);
        const first = points[0];
        const last = points.at(-1);
        return <ComparisonRow key={key} label={key === 'bench' ? 'Bench Press' : titleCase(key)} start={first?.value_kg} end={last?.value_kg} startDate={first?.date} endDate={last?.date} unit={unit} tone={LIFT_TONES[key]} />;
      })}
      <ComparisonRow label="Bodyweight" start={bodyweight?.start.reported_bodyweight_kg} end={bodyweight?.end.reported_bodyweight_kg} startDate={bodyweight?.start.training_date} endDate={bodyweight?.end.training_date} unit={unit} tone="#54D2C9" />
    </View>
  </View>;
}

function ComparisonRow({ label, start, end, startDate, endDate, unit, tone }: { label: string; start?: number | null; end?: number | null; startDate?: string | null; endDate?: string | null; unit: LedgerUnit; tone: string }) {
  const supported = start != null && end != null;
  return <View style={styles.comparisonRow}>
    <View style={[styles.comparisonMark, { backgroundColor: tone }]} />
    <View style={styles.comparisonLabel}><Text style={styles.comparisonName}>{label}</Text><Text style={styles.comparisonDate}>{supported ? `${shortDate(startDate)} → ${shortDate(endDate)}` : 'Not enough evidence yet'}</Text></View>
    <Text style={styles.comparisonValue}>{supported ? displayKg(start, unit) : '—'}</Text>
    <Ionicons name="arrow-forward" size={14} color="#6E7887" />
    <View style={styles.comparisonEnd}><Text style={[styles.comparisonValue, { color: tone }]}>{supported ? displayKg(end, unit) : '—'}</Text>{supported ? <Text style={styles.comparisonDelta}>{signedKg(end - start, unit)}</Text> : null}</View>
  </View>;
}

function CurrentChapterSection({ asOfDate, block, unit, onOpen }: { asOfDate: string; block: JourneyBlock | null; unit: LedgerUnit; onOpen: (block: JourneyBlock) => void }) {
  return <View testID="journey-current-chapter" style={styles.section}>
    <StoryHeading eyebrow="CURRENT CHAPTER" title={block?.name || 'Between recorded chapters'} body={block?.program?.name ? `${block.program.name} · ${rangeLabel(block.start_date, block.end_date)}` : block ? rangeLabel(block.start_date, block.end_date) : 'A current programmed block will appear when its governed dates include today.'} />
    {block ? <ImageBackground source={CHAPTER_ART.current} resizeMode="cover" imageStyle={styles.chapterImage} style={styles.currentChapter}>
      <View style={styles.chapterScrim} />
      <View style={styles.currentChapterCopy}>
        <View style={styles.stateBadge}><View style={styles.liveDot} /><Text style={styles.stateBadgeText}>IN PROGRESS</Text></View>
        <View style={styles.chapterStats}><ChapterStat value={String(block.session_count)} label="SESSIONS" /><ChapterStat value={String(block.pr_count)} label="PRS" /><ChapterStat value={block.strength_comparison?.total ? signedKg(block.strength_comparison.total.change_kg, unit) : '—'} label="SBD CHANGE" /></View>
        <ProgressTrack value={blockProgress(block, asOfDate)} />
        <Text style={styles.chapterProgressLabel}>{chapterProgressLabel(block, asOfDate)}</Text>
        <Pressable accessibilityRole="button" onPress={() => onOpen(block)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]} testID="journey-view-current-chapter"><Text style={styles.primaryActionText}>View Chapter Details</Text><Ionicons name="arrow-forward" size={17} color="#09070C" /></Pressable>
      </View>
    </ImageBackground> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No active chapter is recorded.</Text><Text style={styles.emptyBody}>Historical chapters remain available below.</Text></View>}
  </View>;
}

function ChapterStat({ value, label }: { value: string; label: string }) {
  return <View style={styles.chapterStat}><Text adjustsFontSizeToFit minimumFontScale={0.66} numberOfLines={1} style={styles.chapterStatValue}>{value}</Text><Text style={styles.chapterStatLabel}>{label}</Text></View>;
}

function ProgressTrack({ value }: { value: number }) {
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} /></View>;
}

function ProgressSection({ progression, range, metric, unit, onRange, onMetric }: { progression?: LedgerProgression; range: JourneyRange; metric: StrengthMetric; unit: LedgerUnit; onRange: (range: JourneyRange) => void; onMetric: (metric: StrengthMetric) => void }) {
  const lifts = progression?.big_three_arc?.lifts ?? [];
  const lift = metric === 'total' ? null : lifts.find((item) => String(item.key).toLowerCase() === metric);
  const points = metric === 'total'
    ? composeJourneyTotalStrengthPoints(lifts)
    : (lift?.points ?? []).filter((point) => point.date && point.value_kg != null).map((point) => ({ date: point.date as string, valueKg: Number(point.value_kg) }));
  const tone = metric === 'total' ? '#B56BFF' : LIFT_TONES[metric];
  return <View testID="journey-progress-over-time" style={styles.section}>
    <StoryHeading eyebrow="PROGRESS OVER TIME" title="Strength, seen across the record." body="Canonical weekly estimated-strength observations from qualified source sets." />
    <ChoiceRail values={RANGE_OPTIONS} selected={range} onSelect={(key) => onRange(key as JourneyRange)} />
    <ChoiceRail values={METRIC_OPTIONS} selected={metric} onSelect={(key) => onMetric(key as StrengthMetric)} />
    <View style={styles.chartCard}>
      <View style={styles.chartSummary}><View><Text style={styles.chartLabel}>{metric === 'total' ? 'ESTIMATED SBD TOTAL' : `${titleCase(metric)} ESTIMATED 1RM`}</Text><Text style={[styles.chartValue, { color: tone }]}>{points.at(-1) ? `${displayKg(points.at(-1)!.valueKg, unit)} ${unit.toUpperCase()}` : '—'}</Text></View><Text style={styles.chartRange}>{progression?.range?.label || 'Selected range'}</Text></View>
      <AnalyticalTimeSeriesChart
        emptyBody={metric === 'total' ? 'All three competition lifts need qualified observations in this range.' : 'Two qualified observations are required.'}
        emptyTitle="Not enough trustworthy evidence"
        height={228}
        metric={analyticalMetricDefinition('estimated_1rm', { label: metric === 'total' ? 'Estimated SBD total' : `${titleCase(metric)} estimated strength`, kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 0 })}
        series={[{ key: metric, label: metric === 'total' ? 'Estimated SBD total' : titleCase(metric), color: tone, points: points.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.valueKg, unit) })) }]}
        showLegend={false}
        testID="journey-strength-chart"
      />
    </View>
  </View>;
}

function ChoiceRail({ values, selected, onSelect }: { values: readonly { key: string; label: string }[]; selected: string; onSelect: (value: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRail}>{values.map((item) => { const active = item.key === selected; return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.key} onPress={() => onSelect(item.key)} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView>;
}

function TrainingChaptersSection({ blocks, unit, onOpen, onOpenAll }: { blocks: JourneyBlock[]; unit: LedgerUnit; onOpen: (block: JourneyBlock) => void; onOpenAll: () => void }) {
  return <View testID="journey-training-chapters" style={styles.section}>
    <StoryHeading eyebrow="TRAINING CHAPTERS" title="The work, divided by intent." body="Programmed blocks become the chapters of your record." action="View All" actionTestID="journey-view-all-chapters" onAction={onOpenAll} />
    <View style={styles.chapterSequence}>{blocks.slice(0, 3).map((block, index) => <ChapterCard key={block.id} block={block} index={index} unit={unit} onOpen={onOpen} />)}</View>
    {!blocks.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No training chapters yet.</Text></View> : null}
  </View>;
}

function ChapterCard({ block, index, unit, onOpen }: { block: JourneyBlock; index: number; unit: LedgerUnit; onOpen: (block: JourneyBlock) => void }) {
  const source = block.state === 'current' ? CHAPTER_ART.current : index % 2 === 0 ? CHAPTER_ART.foundation : CHAPTER_ART.transition;
  return <Pressable accessibilityRole="button" onPress={() => onOpen(block)} style={({ pressed }) => [styles.chapterCard, pressed && styles.pressed]}>
    <ImageBackground source={source} resizeMode="cover" imageStyle={styles.chapterCardImage} style={styles.chapterCardMedia}><View style={styles.chapterCardScrim} /><View style={styles.chapterNumber}><Text style={styles.chapterNumberText}>{String(index + 1).padStart(2, '0')}</Text></View></ImageBackground>
    <View style={styles.chapterCardCopy}><Text style={[styles.chapterState, block.state === 'current' && styles.chapterStateCurrent, block.state === 'upcoming' && styles.chapterStateUpcoming]}>{block.state === 'current' ? 'CURRENT' : block.state === 'upcoming' ? 'UPCOMING CHAPTER' : 'COMPLETED CHAPTER'}</Text><Text numberOfLines={2} style={styles.chapterCardTitle}>{block.name}</Text><Text style={styles.chapterCardMeta}>{rangeLabel(block.start_date, block.end_date)}</Text><Text style={styles.chapterCardMeta}>{block.session_count} Sessions · {block.pr_count} PRs{block.strength_comparison?.total ? ` · ${signedKg(block.strength_comparison.total.change_kg, unit)} SBD` : ''}</Text></View>
    <Ionicons name="chevron-forward" size={18} color="#9B82B8" />
  </Pressable>;
}

function BodyweightContextSection({ bootstrap, unit, onOpen }: { bootstrap: JourneyBootstrap; unit: LedgerUnit; onOpen: () => void }) {
  const context = bootstrap.bodyweight_context;
  const points = [...(context.recent_observations ?? [])].filter((row) => row.training_date && row.reported_bodyweight_kg != null).sort((left, right) => String(left.training_date).localeCompare(String(right.training_date)));
  const comparison = context.comparison;
  return <View testID="journey-bodyweight-context" style={styles.section}>
    <StoryHeading eyebrow="BODYWEIGHT CONTEXT" title="A parallel signal, not a verdict." body="Only athlete-reported or preserved weigh-in evidence is shown. No causal claim is made." action="Details" onAction={onOpen} />
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.bodyweightCard, pressed && styles.pressed]} testID="journey-view-bodyweight-detail">
      <View style={styles.bodyweightSummary}><View><Text style={styles.bodyweightLabel}>RECORDED RANGE</Text><Text style={styles.bodyweightValue}>{comparison ? `${displayKg(comparison.start.reported_bodyweight_kg, unit)} → ${displayKg(comparison.end.reported_bodyweight_kg, unit)} ${unit.toUpperCase()}` : 'Not enough reports'}</Text></View><View style={styles.bodyweightDelta}><Text style={styles.bodyweightDeltaLabel}>NET</Text><Text style={styles.bodyweightDeltaValue}>{comparison ? signedKg(comparison.delta_kg, unit) : '—'}</Text></View></View>
      <AnalyticalTimeSeriesChart emptyTitle="No reported trend yet" emptyBody="At least two bodyweight reports are required." height={176} metric={analyticalMetricDefinition('bodyweight', { label: 'Reported bodyweight', kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 1 })} series={[{ key: 'bodyweight', label: 'Reported bodyweight', color: '#54D2C9', points: points.map((point) => ({ date: point.training_date!, value: kilogramsToDisplayValue(point.reported_bodyweight_kg, unit) })) }]} showLegend={false} testID="journey-bodyweight-chart" />
      <View style={styles.openRow}><Text style={styles.openRowText}>View Bodyweight Details</Text><Ionicons name="arrow-forward" size={16} color="#54D2C9" /></View>
    </Pressable>
  </View>;
}

function CareerHighlightsSection({ entries, unit, onOpenEvidence }: { entries: JourneyEntry[]; unit: LedgerUnit; onOpenEvidence: (entry: JourneyEntry) => void }) {
  return <View testID="journey-career-highlights" style={styles.section}><StoryHeading eyebrow="CAREER HIGHLIGHTS" title="The moments worth holding onto." body="A curated set of high-signal milestones from the preserved record." />
    <View style={styles.highlights}>{entries.map((entry, index) => <Pressable key={entry.id} disabled={!entry.source.href} onPress={() => onOpenEvidence(entry)} style={({ pressed }) => [styles.highlightRow, pressed && styles.pressed]}><View style={styles.highlightIndex}><Text style={styles.highlightIndexText}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.flex}><Text style={styles.highlightType}>{highlightLabel(entry.event_type)}</Text><Text style={styles.highlightTitle}>{entryDisplayTitle(entry)}</Text><Text style={styles.highlightDetail}>{journeyPerformanceDetail(entry.event_type, entry.performance, unit, entry.detail)} · {compactDate(entry.occurred_on)}</Text></View>{entry.source.href ? <Ionicons name="arrow-forward" size={16} color="#8C789E" /> : null}</Pressable>)}</View>
  </View>;
}

function JourneyDetailModal({ detail, bootstrap, unit, onClose, onDetail }: { detail: JourneyDetail; bootstrap: JourneyBootstrap; unit: LedgerUnit; onClose: () => void; onDetail: (detail: JourneyDetail) => void }) {
  const insets = useSafeAreaInsets();
  const title = !detail ? 'Journey' : detail.kind === 'chapter' ? detail.block.name : detail.kind === 'chapters' ? 'Training Chapters' : detail.kind === 'bodyweight' ? 'Bodyweight Detail' : 'Full Timeline';
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={Boolean(detail)}>
    <SafeAreaView edges={['bottom']} style={[styles.modalScreen, { paddingTop: Math.max(insets.top, 52) }]}>
      <View style={styles.modalHeader}><Pressable accessibilityLabel="Back to Journey" accessibilityRole="button" onPress={onClose} style={styles.modalBack} testID="journey-detail-back"><Ionicons name="chevron-back" size={25} color="#F4F0F7" /></Pressable><View style={styles.flex}><Text style={styles.modalContext}>JOURNEY</Text><Text numberOfLines={1} style={styles.modalTitle}>{title}</Text></View></View>
      {detail?.kind === 'chapter' ? <ChapterDetail asOfDate={bootstrap.as_of_date} block={detail.block} blocks={bootstrap.blocks.items} timeline={bootstrap.timeline.items} unit={unit} onDetail={onDetail} /> : null}
      {detail?.kind === 'chapters' ? <AllChapters blocks={bootstrap.blocks.items} unit={unit} onOpen={(block) => onDetail({ kind: 'chapter', block })} /> : null}
      {detail?.kind === 'bodyweight' ? <BodyweightDetail initial={bootstrap.bodyweight_context.recent_observations} blocks={bootstrap.blocks.items} unit={unit} /> : null}
      {detail?.kind === 'timeline' ? <FullTimeline initial={bootstrap.timeline.items} unit={unit} /> : null}
    </SafeAreaView>
  </Modal>;
}

function ChapterDetail({ asOfDate, block, blocks, timeline, unit, onDetail }: { asOfDate: string; block: JourneyBlock; blocks: JourneyBlock[]; timeline: JourneyEntry[]; unit: LedgerUnit; onDetail: (detail: JourneyDetail) => void }) {
  const [entries, setEntries] = useState(timeline.filter((entry) => entry.training_block_id === block.id));
  useEffect(() => {
    let active = true;
    fetchJourneyTimelinePage({ blockId: block.id, includeSessions: true, limit: 50 }).then((page) => { if (active) setEntries(page.items); }).catch(() => undefined);
    return () => { active = false; };
  }, [block.id]);
  const index = blocks.findIndex((item) => item.id === block.id);
  const art = block.state === 'current' ? CHAPTER_ART.current : index % 2 === 0 ? CHAPTER_ART.foundation : CHAPTER_ART.transition;
  const comparison = block.strength_comparison;
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent} testID="journey-chapter-detail">
    <ImageBackground source={art} style={styles.detailHero} imageStyle={styles.detailHeroImage}><View style={styles.detailHeroScrim} /><View style={styles.detailHeroCopy}><Text style={styles.detailEyebrow}>{block.state === 'current' ? 'CURRENT CHAPTER' : 'TRAINING CHAPTER'}</Text><Text style={styles.detailHeroTitle}>{block.name}</Text><Text style={styles.detailHeroMeta}>{block.program?.name || 'Program not recorded'} · {rangeLabel(block.start_date, block.end_date)}</Text></View></ImageBackground>
    <View style={styles.detailStatRow}><ChapterStat value={String(block.session_count)} label="SESSIONS" /><ChapterStat value={String(block.pr_count)} label="PRS" /><ChapterStat value={`${Math.round(blockProgress(block, asOfDate) * 100)}%`} label={block.state === 'current' ? 'ELAPSED' : block.state === 'upcoming' ? 'STARTED' : 'COMPLETE'} /></View>
    <DetailSection title="STRENGTH ACROSS THIS CHAPTER">
      {(['squat', 'bench', 'deadlift'] as const).map((key) => { const lift = comparison?.lifts[key]; return <View key={key} style={styles.detailComparison}><Text style={styles.detailComparisonLabel}>{key === 'bench' ? 'Bench Press' : titleCase(key)}</Text><Text style={styles.detailComparisonValue}>{lift ? `${displayKg(lift.start_e1rm_kg, unit)} → ${displayKg(lift.end_e1rm_kg, unit)} ${unit.toUpperCase()}` : 'Not enough boundary evidence'}</Text>{lift?.change_kg != null ? <Text style={[styles.detailComparisonDelta, { color: LIFT_TONES[key] }]}>{signedKg(lift.change_kg, unit)}</Text> : null}</View>; })}
      <Text style={styles.sourceNote}>Qualified weekly competition-lift e1RM evidence only.</Text>
    </DetailSection>
    <DetailSection title="BODYWEIGHT CONTEXT">
      <Text style={styles.detailBody}>{block.reported_bodyweight?.start && block.reported_bodyweight.end_or_latest ? `${displayKg(block.reported_bodyweight.start.reported_bodyweight_kg, unit)} → ${displayKg(block.reported_bodyweight.end_or_latest.reported_bodyweight_kg, unit)} ${unit.toUpperCase()} (${signedKg(block.reported_bodyweight.change_kg, unit)})` : 'No trustworthy reports near both chapter boundaries.'}</Text>
      <Text style={styles.sourceNote}>Context only. No change is attributed to the program.</Text>
    </DetailSection>
    <DetailSection title="CHAPTER HIGHLIGHTS">
      {entries.filter((entry) => entry.importance !== 'supporting').slice(0, 6).map((entry) => <View key={entry.id} style={styles.detailMoment}><View style={styles.detailMomentDot} /><View style={styles.flex}><Text style={styles.detailMomentTitle}>{entryDisplayTitle(entry)}</Text><Text style={styles.detailMomentMeta}>{compactDate(entry.occurred_on)} · {highlightLabel(entry.event_type)}</Text></View></View>)}
      {!entries.some((entry) => entry.importance !== 'supporting') ? <Text style={styles.detailBody}>No major chapter highlights are recorded.</Text> : null}
    </DetailSection>
    <View style={styles.chapterNav}>{index < blocks.length - 1 ? <Pressable onPress={() => onDetail({ kind: 'chapter', block: blocks[index + 1] })} style={styles.chapterNavButton}><Ionicons name="arrow-back" size={16} color="#BDA1DB" /><Text style={styles.chapterNavText}>Previous</Text></Pressable> : <View />}{index > 0 ? <Pressable onPress={() => onDetail({ kind: 'chapter', block: blocks[index - 1] })} style={styles.chapterNavButton}><Text style={styles.chapterNavText}>Next</Text><Ionicons name="arrow-forward" size={16} color="#BDA1DB" /></Pressable> : null}</View>
  </ScrollView>;
}

function DetailSection({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return <View style={styles.detailSection}><Text style={styles.detailSectionTitle}>{title}</Text>{children}</View>;
}

function AllChapters({ blocks, unit, onOpen }: { blocks: JourneyBlock[]; unit: LedgerUnit; onOpen: (block: JourneyBlock) => void }) {
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent} testID="journey-all-chapters"><Text style={styles.modalIntro}>Every governed training block, newest to earliest.</Text>{blocks.map((block, index) => <ChapterCard key={block.id} block={block} index={index} unit={unit} onOpen={onOpen} />)}</ScrollView>;
}

function BodyweightDetail({ initial, blocks, unit }: { initial: ReportedBodyweightObservation[]; blocks: JourneyBlock[]; unit: LedgerUnit }) {
  const [items, setItems] = useState<ReportedBodyweightObservation[]>(initial);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadFirst = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try { const page = await fetchReportedBodyweightHistory({ limit: 50 }); setItems(page.items); setCursor(page.next_cursor ?? null); setHasMore(page.has_more); } catch { setLoadError('The complete bodyweight record could not be loaded.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadFirst(); }, [loadFirst]);
  const loadMore = async () => { if (!cursor || loading) return; setLoading(true); setLoadError(null); try { const page = await fetchReportedBodyweightHistory({ limit: 50, cursor }); setItems((current) => [...current, ...page.items]); setCursor(page.next_cursor ?? null); setHasMore(page.has_more); } catch { setLoadError('Earlier bodyweight reports could not be loaded.'); } finally { setLoading(false); } };
  const ordered = [...items].filter((item) => item.training_date).sort((left, right) => String(left.training_date).localeCompare(String(right.training_date)));
  const first = ordered[0]; const last = ordered.at(-1);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent} testID="journey-bodyweight-detail">
    <Text style={styles.modalIntro}>The complete reported bodyweight record, shown alongside chapter boundaries without implying cause.</Text>
    <View style={styles.detailSection}><View style={styles.bodyweightSummary}><View><Text style={styles.bodyweightLabel}>START → CURRENT</Text><Text style={styles.bodyweightValue}>{first && last ? `${displayKg(first.reported_bodyweight_kg, unit)} → ${displayKg(last.reported_bodyweight_kg, unit)} ${unit.toUpperCase()}` : 'Not enough reports'}</Text></View><View style={styles.bodyweightDelta}><Text style={styles.bodyweightDeltaLabel}>NET</Text><Text style={styles.bodyweightDeltaValue}>{first && last ? signedKg(last.reported_bodyweight_kg - first.reported_bodyweight_kg, unit) : '—'}</Text></View></View>
      <AnalyticalTimeSeriesChart emptyTitle="No bodyweight history" emptyBody="Submitted reports will appear here." height={270} metric={analyticalMetricDefinition('bodyweight', { label: 'Reported bodyweight', kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 1 })} series={[{ key: 'bodyweight', label: 'Reported bodyweight', color: '#54D2C9', points: ordered.map((point) => ({ date: point.training_date!, value: kilogramsToDisplayValue(point.reported_bodyweight_kg, unit) })) }]} showLegend={false} testID="journey-bodyweight-detail-chart" />
    </View>
    <DetailSection title="CHAPTER BOUNDARIES">{blocks.filter((block) => block.start_date).map((block) => <View key={block.id} style={styles.boundaryRow}><View style={[styles.boundaryDot, block.state === 'current' && styles.boundaryDotCurrent]} /><View style={styles.flex}><Text style={styles.boundaryTitle}>{block.name}</Text><Text style={styles.boundaryMeta}>{rangeLabel(block.start_date, block.end_date)}</Text></View></View>)}</DetailSection>
    {loadError ? <Text accessibilityRole="alert" style={styles.loadError}>{loadError}</Text> : null}
    {hasMore ? <Pressable disabled={loading} onPress={() => void loadMore()} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{loading ? 'Loading…' : 'Load Earlier Reports'}</Text></Pressable> : <Text style={styles.completeLabel}>COMPLETE REPORTED RECORD</Text>}
  </ScrollView>;
}

function FullTimeline({ initial, unit }: { initial: JourneyEntry[]; unit: LedgerUnit }) {
  const router = useRouter();
  const [items, setItems] = useState<JourneyEntry[]>(initial);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadFirst = useCallback(async () => { setLoading(true); setLoadError(null); try { const page = await fetchJourneyTimelinePage({ limit: 50, includeSessions: true }); setItems(page.items); setCursor(page.next_cursor ?? null); setHasMore(page.has_more); } catch { setLoadError('The complete timeline could not be loaded.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void loadFirst(); }, [loadFirst]);
  const loadMore = async () => { if (!cursor || loading) return; setLoading(true); setLoadError(null); try { const page = await fetchJourneyTimelinePage({ limit: 50, cursor, includeSessions: true }); setItems((current) => [...current, ...page.items]); setCursor(page.next_cursor ?? null); setHasMore(page.has_more); } catch { setLoadError('Earlier timeline history could not be loaded.'); } finally { setLoading(false); } };
  let lastYear = '';
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent} testID="journey-full-timeline"><Text style={styles.modalIntro}>Complete chronological evidence, newest first. Open any linked moment to inspect its preserved source.</Text>{items.map((entry) => { const year = entry.occurred_on.slice(0, 4); const heading = year !== lastYear; lastYear = year; return <React.Fragment key={entry.id}>{heading ? <Text style={styles.timelineYear}>{year}</Text> : null}<Pressable disabled={!entry.source.href} onPress={() => entry.source.href && router.push({ pathname: entry.source.href as any, params: { displayUnit: unit } } as any)} style={({ pressed }) => [styles.timelineRow, pressed && styles.pressed]}><View style={styles.timelineDate}><Text style={styles.timelineDay}>{monthDay(entry.occurred_on)}</Text></View><View style={styles.timelineAxis}><View style={styles.timelineDot} /><View style={styles.timelineLine} /></View><View style={styles.flex}><Text style={styles.timelineType}>{highlightLabel(entry.event_type)}</Text><Text style={styles.timelineTitle}>{entryDisplayTitle(entry)}</Text><Text style={styles.timelineDetail}>{journeyPerformanceDetail(entry.event_type, entry.performance, unit, entry.detail)}</Text></View>{entry.source.href ? <Ionicons name="arrow-forward" size={15} color="#82748D" /> : null}</Pressable></React.Fragment>; })}{loadError ? <Text accessibilityRole="alert" style={styles.loadError}>{loadError}</Text> : null}{hasMore ? <Pressable disabled={loading} onPress={() => void loadMore()} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{loading ? 'Loading…' : 'Load Earlier History'}</Text></Pressable> : <Text style={styles.completeLabel}>BEGINNING OF THE PRESERVED RECORD</Text>}</ScrollView>;
}

function curatedHighlights(bootstrap: JourneyBootstrap): JourneyEntry[] {
  const priority = ['PROGRAM_COMPLETED', 'COMPETITION', 'ACHIEVEMENT_EARNED', 'VOLUME_MILESTONE', 'WEIGHT_PR', 'E1RM_PR', 'BLOCK_STARTED', 'PROGRAM_STARTED'];
  return [...bootstrap.recent_major, ...bootstrap.timeline.items]
    .filter((entry) => priority.includes(entry.event_type))
    .sort((left, right) => priority.indexOf(left.event_type) - priority.indexOf(right.event_type) || right.occurred_on.localeCompare(left.occurred_on))
    .filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index)
    .slice(0, 5);
}

function blockProgress(block: JourneyBlock, asOfDate: string): number {
  if (block.state === 'historical_range') return 1;
  const start = block.start_date ? new Date(`${block.start_date}T12:00:00`).getTime() : NaN;
  const end = block.end_date ? new Date(`${block.end_date}T12:00:00`).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const asOf = new Date(`${asOfDate}T12:00:00`).getTime();
  return Math.max(0, Math.min(1, (asOf - start) / (end - start)));
}

function chapterProgressLabel(block: JourneyBlock, asOfDate: string): string {
  if (block.state !== 'current') return 'Chapter complete';
  const remaining = block.end_date ? daysBetween(asOfDate, block.end_date) : null;
  return remaining != null && remaining >= 0 ? `${Math.round(blockProgress(block, asOfDate) * 100)}% elapsed · ${remaining} days remaining` : 'Active chapter · end date not recorded';
}

function displayKg(value: number | null | undefined, unit: LedgerUnit): string {
  return formatWeightFromKg(value, unit)?.replace(/ (?:kg|lb)$/, '') ?? '—';
}

function signedKg(value: number | null | undefined, unit: LedgerUnit): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const converted = kilogramsToDisplayValue(value, unit);
  const rounded = Math.round(converted * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} ${unit}`;
}

function daysBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  return Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000);
}

function compactDate(value?: string | null): string {
  if (!value) return 'Date unavailable';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function monthDay(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function rangeLabel(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Dates not recorded';
  if (!end) return `Started ${compactDate(start)}`;
  return `${compactDate(start)} – ${compactDate(end)}`;
}

function titleCase(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function highlightLabel(value: string): string { return value.replaceAll('_', ' '); }
function entryDisplayTitle(entry: JourneyEntry): string {
  if (entry.event_type === 'PERFORMANCE' && entry.movement?.label) return entry.movement.label;
  return entry.title;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#000000' },
  hero: { minHeight: 334, marginTop: 0 },
  heroMetrics: { flexDirection: 'row', marginHorizontal: SLLayout.screenGutter, marginBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(210,178,255,0.35)', backgroundColor: 'rgba(3,3,7,0.46)' },
  heroMetric: { flex: 1, minWidth: 0, paddingTop: 11, paddingBottom: 8, alignItems: 'center' },
  heroMetricValue: { color: '#F7F3FA', fontFamily: SLFontFamilies.bodyBold, fontSize: 20, lineHeight: 24 },
  heroMetricLabel: { color: '#C7A7E8', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 8, letterSpacing: 0.8 },
  story: { paddingHorizontal: SLLayout.screenGutter, paddingBottom: 44 },
  section: { paddingTop: 30, gap: 14 },
  storyHeading: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#B989E7', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 9, lineHeight: 13, letterSpacing: 1.35 },
  storyTitle: { marginTop: 4, color: '#F3EFF6', fontFamily: SLFontFamilies.bodyBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.45 },
  storyBody: { marginTop: 6, maxWidth: 430, color: '#94909A', fontSize: 12, lineHeight: 18 },
  headingAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  headingActionText: { color: '#C899FF', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 11 },
  thenNowCard: { overflow: 'hidden', borderRadius: SLRadius.lg, borderWidth: 1, borderColor: '#30283A', backgroundColor: '#090A0F' },
  comparisonRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#24232A' },
  comparisonMark: { width: 3, height: 32, borderRadius: 2 },
  comparisonLabel: { flex: 1, minWidth: 0 },
  comparisonName: { color: '#EDE9F0', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 13 },
  comparisonDate: { marginTop: 3, color: '#777580', fontSize: 9 },
  comparisonValue: { color: '#B9B5BE', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 14 },
  comparisonEnd: { minWidth: 62, alignItems: 'flex-end' },
  comparisonDelta: { marginTop: 2, color: '#777580', fontSize: 8.5 },
  currentChapter: { minHeight: 330, overflow: 'hidden', justifyContent: 'flex-end', borderRadius: 22, borderWidth: 1, borderColor: '#5B3979' },
  chapterImage: { borderRadius: 22 },
  chapterScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,2,6,0.36)' },
  currentChapterCopy: { gap: 12, padding: 18, paddingTop: 110 },
  stateBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: '#6D4A8B', backgroundColor: 'rgba(8,5,14,0.72)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#63E49D' },
  stateBadgeText: { color: '#D9B8F5', fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.9 },
  chapterStats: { flexDirection: 'row', gap: 10 },
  chapterStat: { flex: 1, minWidth: 0 },
  chapterStatValue: { color: '#F5F1F7', fontFamily: SLFontFamilies.bodyBold, fontSize: 23, lineHeight: 27 },
  chapterStatLabel: { color: '#A79BAC', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 8, lineHeight: 12, letterSpacing: 0.7 },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.13)' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#B56BFF' },
  chapterProgressLabel: { color: '#B9AFBF', fontSize: 10 },
  primaryAction: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: '#EDE7F3' },
  primaryActionText: { color: '#09070C', fontFamily: SLFontFamilies.bodyBold, fontSize: 12 },
  emptyCard: { minHeight: 120, justifyContent: 'center', gap: 6, padding: 18, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: '#292D36', backgroundColor: '#090C12' },
  emptyTitle: { color: '#E7E4E9', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 15 },
  emptyBody: { color: '#858692', fontSize: 11, lineHeight: 16 },
  choiceRail: { gap: 7, paddingRight: 8 },
  choice: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: '#303641', backgroundColor: '#090D13' },
  choiceActive: { borderColor: '#9D4DE1', backgroundColor: '#28113A' },
  choiceText: { color: '#8D929B', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 10 },
  choiceTextActive: { color: '#F1E6FA' },
  chartCard: { overflow: 'hidden', padding: 13, borderRadius: 19, borderWidth: 1, borderColor: '#2B3340', backgroundColor: '#070B11' },
  chartSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 3, paddingBottom: 5 },
  chartLabel: { color: '#9398A3', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 8.5, letterSpacing: 0.7 },
  chartValue: { marginTop: 3, fontFamily: SLFontFamilies.bodyBold, fontSize: 24, lineHeight: 28 },
  chartRange: { color: '#767D8A', fontSize: 9 },
  chapterSequence: { gap: 10 },
  chapterCard: { minHeight: 128, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 12, borderRadius: 18, borderWidth: 1, borderColor: '#302F39', backgroundColor: '#0A0B10' },
  chapterCardMedia: { width: 116, alignSelf: 'stretch', overflow: 'hidden', justifyContent: 'flex-end', borderRadius: 13 },
  chapterCardImage: { borderRadius: 13 },
  chapterCardScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.14)' },
  chapterNumber: { alignSelf: 'flex-start', margin: 9, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(4,3,8,0.76)' },
  chapterNumberText: { color: '#EADDF5', fontFamily: SLFontFamilies.bodyBold, fontSize: 9 },
  chapterCardCopy: { flex: 1, minWidth: 0, gap: 4 },
  chapterState: { color: '#9B8AA8', fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.8 },
  chapterStateCurrent: { color: '#68DFA0' },
  chapterStateUpcoming: { color: '#70BDEA' },
  chapterCardTitle: { color: '#F0EDF2', fontFamily: SLFontFamilies.bodyBold, fontSize: 17, lineHeight: 21 },
  chapterCardMeta: { color: '#86848D', fontSize: 9.5, lineHeight: 13 },
  bodyweightCard: { overflow: 'hidden', padding: 14, borderRadius: 19, borderWidth: 1, borderColor: '#24484A', backgroundColor: '#071012' },
  bodyweightSummary: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  bodyweightLabel: { color: '#69C7C4', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 8.5, letterSpacing: 0.8 },
  bodyweightValue: { marginTop: 4, color: '#EDF6F5', fontFamily: SLFontFamilies.bodyBold, fontSize: 21, lineHeight: 26 },
  bodyweightDelta: { alignItems: 'flex-end', padding: 8, borderRadius: 10, backgroundColor: '#0E1B1D' },
  bodyweightDeltaLabel: { color: '#718F91', fontSize: 8 },
  bodyweightDeltaValue: { marginTop: 2, color: '#54D2C9', fontFamily: SLFontFamilies.bodyBold, fontSize: 14 },
  openRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#233436' },
  openRowText: { color: '#71D3CD', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 10 },
  highlights: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#2C2932', backgroundColor: '#090A0E' },
  highlightRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252229' },
  highlightIndex: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: '#5F4078', backgroundColor: '#1A1022' },
  highlightIndexText: { color: '#C89BE9', fontFamily: SLFontFamilies.bodyBold, fontSize: 10 },
  highlightType: { color: '#9875B3', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 7.5, letterSpacing: 0.75 },
  highlightTitle: { marginTop: 2, color: '#EAE6ED', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 13 },
  highlightDetail: { marginTop: 3, color: '#7F7C84', fontSize: 9.5, lineHeight: 13 },
  timelinePortal: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 30, padding: 17, borderRadius: 20, borderWidth: 1, borderColor: '#533469', backgroundColor: '#0F0915' },
  timelinePortalIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#251231' },
  portalEyebrow: { color: '#B683D9', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 8, letterSpacing: 0.9 },
  portalTitle: { marginTop: 3, color: '#F1ECF4', fontFamily: SLFontFamilies.bodyBold, fontSize: 16 },
  portalBody: { marginTop: 4, color: '#8C8491', fontSize: 10, lineHeight: 14 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  state: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 13, padding: 30, backgroundColor: '#000000' },
  stateTitle: { maxWidth: 320, color: '#D7D2DA', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#EEE8F3' },
  retryText: { color: '#09070B', fontFamily: SLFontFamilies.bodyBold, fontSize: 12 },
  modalScreen: { flex: 1, backgroundColor: '#000000' },
  modalHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#282430' },
  modalBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalContext: { color: '#B987E0', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 8, letterSpacing: 1 },
  modalTitle: { color: '#F3EFF5', fontFamily: SLFontFamilies.bodyBold, fontSize: 21, lineHeight: 26 },
  modalContent: { gap: 15, padding: SLLayout.screenGutter, paddingBottom: 52 },
  modalIntro: { color: '#96919C', fontSize: 12, lineHeight: 18 },
  detailHero: { minHeight: 280, overflow: 'hidden', justifyContent: 'flex-end', borderRadius: 20, borderWidth: 1, borderColor: '#463257' },
  detailHeroImage: { borderRadius: 20 },
  detailHeroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.24)' },
  detailHeroCopy: { gap: 5, padding: 18, paddingTop: 120 },
  detailEyebrow: { color: '#D2A8F4', fontFamily: SLFontFamilies.bodyBold, fontSize: 8.5, letterSpacing: 1 },
  detailHeroTitle: { color: '#F8F4F9', fontFamily: SLFontFamilies.bodyBold, fontSize: 27, lineHeight: 32 },
  detailHeroMeta: { color: '#C3BBC8', fontSize: 10, lineHeight: 15 },
  detailStatRow: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 17, borderWidth: 1, borderColor: '#2B2A31', backgroundColor: '#090A0E' },
  detailSection: { gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#2B2D35', backgroundColor: '#090C11' },
  detailSectionTitle: { color: '#A987C4', fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 0.9 },
  detailComparison: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252830' },
  detailComparisonLabel: { width: 82, color: '#E3DFE6', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 11 },
  detailComparisonValue: { flex: 1, color: '#AAA5AE', fontSize: 10 },
  detailComparisonDelta: { fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  sourceNote: { color: '#6F747E', fontSize: 9, lineHeight: 14 },
  detailBody: { color: '#D4CFD7', fontSize: 13, lineHeight: 19 },
  detailMoment: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailMomentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B56BFF' },
  detailMomentTitle: { color: '#E7E2EA', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 12 },
  detailMomentMeta: { marginTop: 2, color: '#777985', fontSize: 9 },
  chapterNav: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chapterNavButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#463452' },
  chapterNavText: { color: '#BDA1DB', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 11 },
  boundaryRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  boundaryDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: '#6A5B76' },
  boundaryDotCurrent: { borderColor: '#57D29B', backgroundColor: '#57D29B' },
  boundaryTitle: { color: '#DDD9E0', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 12 },
  boundaryMeta: { marginTop: 2, color: '#757882', fontSize: 9 },
  secondaryAction: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#5B3B70', backgroundColor: '#170C20' },
  secondaryActionText: { color: '#CEA4EB', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 11 },
  loadError: { color: '#FF8795', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  completeLabel: { color: '#68636D', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 8, letterSpacing: 0.9, textAlign: 'center' },
  timelineYear: { marginTop: 8, color: '#C69AE4', fontFamily: SLFontFamilies.bodyBold, fontSize: 24, lineHeight: 29 },
  timelineRow: { minHeight: 86, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  timelineDate: { width: 47, paddingTop: 4 },
  timelineDay: { color: '#88828D', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 9 },
  timelineAxis: { width: 14, alignSelf: 'stretch', alignItems: 'center' },
  timelineDot: { zIndex: 1, width: 9, height: 9, marginTop: 5, borderRadius: 5, borderWidth: 2, borderColor: '#B56BFF', backgroundColor: '#09050D' },
  timelineLine: { flex: 1, width: 1, marginTop: -1, backgroundColor: '#392743' },
  timelineType: { color: '#9874B1', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 7.5, letterSpacing: 0.7 },
  timelineTitle: { marginTop: 3, color: '#E7E2E9', fontFamily: SLFontFamilies.bodySemiBold, fontSize: 13 },
  timelineDetail: { marginTop: 4, color: '#81808A', fontSize: 10, lineHeight: 14 },
});

export default JourneyExperience;
