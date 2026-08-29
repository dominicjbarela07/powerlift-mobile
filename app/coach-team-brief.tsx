import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { CoachMaterialLayer } from '@/components/coach-mobile/coach-material-layer';
import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import type { CoachAnalyticsAthlete, CoachAnalyticsMetricKey, CoachAnalyticsOutlier, CoachTeamBriefResponse } from '@/lib/coach-mobile';

type PeriodKey = CoachTeamBriefResponse['period']['key'];
type TrendPoint = CoachTeamBriefResponse['progress']['series'][number];
type LiftKey = 'total' | 'squat' | 'bench' | 'deadlift';

const PERIODS: PeriodKey[] = ['7D', '4W', '12W', '6M', 'YTD', 'ALL'];
const METRIC_LABELS: Record<CoachAnalyticsMetricKey, string> = { max_progression: 'Max Progression', dots_progression: 'Estimated DOTS', adherence: 'Adherence', pr_rate: 'PR Rate' };
const LIFT_LABELS: Record<LiftKey, string> = { total: 'Total', squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' };

function metricText(value?: number | null, suffix = '%') {
  if (value == null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;
}

function compactNumber(value?: number | null) {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function formatDateRange(period: CoachTeamBriefResponse['period']) {
  const start = period.start ? new Date(`${period.start}T12:00:00`) : null;
  const end = new Date(`${period.end}T12:00:00`);
  if (!start) return `Through ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function CoachTeamBriefScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const accountKey = user?.email || String(user?.user_id || user?.athlete_id || '');
  const accountKeyRef = useRef(accountKey);
  const requestRef = useRef(0);
  const [period, setPeriod] = useState<PeriodKey>('4W');
  const [brief, setBrief] = useState<CoachTeamBriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<CoachAnalyticsMetricKey>('max_progression');
  const [lift, setLift] = useState<LiftKey>('total');

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!accountKey) return;
    const requestAccount = accountKey;
    const sequence = ++requestRef.current;
    const current = () => accountKeyRef.current === requestAccount && requestRef.current === sequence;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<CoachTeamBriefResponse>(`/coach/mobile/team-brief?period=${period}`, { method: 'GET' });
      if (!current()) return;
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || `Unable to load Team Brief (${response.status}).`);
      setBrief(response.json);
    } catch (loadError: any) {
      if (current()) setError(loadError?.message || 'Unable to load Team Brief.');
    } finally {
      if (current()) { setLoading(false); setRefreshing(false); }
    }
  }, [accountKey, period, router]);

  useEffect(() => { accountKeyRef.current = accountKey; requestRef.current += 1; }, [accountKey]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && void load({ silent: true }));
    return () => subscription.remove();
  }, [load]);

  const close = useCallback(() => router.canGoBack() ? router.back() : router.replace('/(tabs)/coach-dashboard'), [router]);
  const trend = brief?.progress.series_by_metric?.[trendMetric] || brief?.progress.series || [];

  return (
    <SLScreen contentStyle={styles.screen} edges="top" padded={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Close Team Brief" accessibilityRole="button" hitSlop={10} onPress={close} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}><Ionicons color={COACH_V2.text} name="chevron-back" size={23} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>TEAM BRIEF</Text><Text style={styles.headerSubtitle}>The Coach&apos;s Ledger</Text></View>
        <Pressable accessibilityLabel="Open Team Brief methodology" accessibilityRole="button" onPress={() => router.push('/coach-team-methodology' as any)} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}><Ionicons color={COACH_V2.text} name="reader-outline" size={21} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); void load({ silent: true }); }} refreshing={refreshing} tintColor={COACH_V2.violetBright} />} showsVerticalScrollIndicator={false}>
        <View accessibilityLabel="Team Brief period" style={styles.periodRail}>
          {PERIODS.map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: period === key }} onPress={() => setPeriod(key)} style={({ pressed }) => [styles.periodButton, period === key && styles.periodButtonActive, pressed && styles.pressed]}><Text style={[styles.periodText, period === key && styles.periodTextActive]}>{key}</Text></Pressable>)}
        </View>
        {loading && !brief ? <SLLoadingState message="Compiling the team&apos;s coaching record." title="Building Team Brief" /> : null}
        {error && !brief ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load()} title="Team Brief unavailable" /> : null}
        {brief ? <>
          <SectionHeader index="1" subtitle={formatDateRange(brief.period)} title="TEAM SNAPSHOT" /><SnapshotCard brief={brief} />
          <SectionHeader index="2" subtitle="Normalized athlete-first change over time" title="PROGRESS OVER TIME" />
          <Card><View style={styles.metricSelector}>{brief.progress.metrics.map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: trendMetric === key }} onPress={() => setTrendMetric(key)} style={({ pressed }) => [styles.metricSelectorButton, trendMetric === key && styles.metricSelectorActive, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.metricSelectorText, trendMetric === key && styles.metricSelectorTextActive]}>{METRIC_LABELS[key]}</Text></Pressable>)}</View><TeamTrendChart metric={trendMetric} points={trend} /><View style={styles.chartLegend}><LegendDot color={COACH_V2.violetBright} label="Team average" /><LegendDot color="#4A4F5C" label={brief.data_quality.cohort_band_supported ? 'Robust normal band' : 'Observed range · small cohort'} /></View></Card>
          <SectionHeader index="3" subtitle="Canonical competition-Core evidence" title="TEAM LIFTS & PERFORMANCE" />
          <Card><View style={styles.liftTabs}>{(Object.keys(LIFT_LABELS) as LiftKey[]).map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: lift === key }} onPress={() => setLift(key)} style={({ pressed }) => [styles.liftTab, lift === key && styles.liftTabActive, pressed && styles.pressed]}><Text style={[styles.liftTabText, lift === key && styles.liftTabTextActive]}>{LIFT_LABELS[key]}</Text></Pressable>)}</View><LiftPerformance lift={brief.lifts[lift]} /></Card>
          <SectionHeader action="View all" index="4" onAction={() => router.push({ pathname: '/coach-team-outliers', params: { period: brief.period.key } } as any)} subtitle="Signals outside the defensible cohort band" title="OUTLIERS" /><OutlierStrip outliers={brief.outliers} onOpen={(row) => router.push({ pathname: '/coach-team-outliers', params: { athleteId: String(row.athlete_id), metric: row.metric, period: brief.period.key } } as any)} supported={brief.data_quality.cohort_band_supported} />
          <SectionHeader index="5" subtitle="Compare normalized evidence side by side" title="ATHLETE MATRIX" /><AthleteMatrix athletes={brief.athletes} onOpen={(athlete) => router.push({ pathname: '/coach-athlete-analytics/[athleteId]', params: { athleteId: String(athlete.athlete_id), period: brief.period.key } } as any)} />
          <SectionHeader index="6" subtitle="Your operational coaching record" title="COACHING IMPACT" /><ImpactGrid impact={brief.coaching_impact} />
          <SectionHeader index="7" subtitle="Milestones backed by persisted evidence" title="RECENT HIGHLIGHTS" /><Highlights rows={brief.highlights} />
          <SectionHeader index="8" subtitle="Evidence confidence and analytical limits" title="CONTEXT" />
          <Card><View style={styles.qualityHeader}><Ionicons color={brief.data_quality.cohort_band_supported ? COACH_V2.green : COACH_V2.gold} name="analytics-outline" size={23} /><View style={styles.flexOne}><Text style={styles.qualityTitle}>{brief.data_quality.athletes} athletes in scope</Text><Text style={styles.qualityCopy}>{brief.data_quality.cohort_band_supported ? 'Robust cohort bands available.' : 'Small cohort: individual values and observed ranges are shown without percentile claims.'}</Text></View></View>{brief.data_quality.notes.map((note) => <Text key={note} style={styles.qualityNote}>• {note}</Text>)}</Card>
        </> : null}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SLScreen>
  );
}

function Card({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'cyan' | 'on_track' | 'critical' | 'neutral' }) { return <View style={styles.card}><CoachMaterialLayer borderRadius={14} emphasis="quiet" tone={tone} />{children}</View>; }

function SectionHeader({ action, index, onAction, subtitle, title }: { action?: string; index: string; onAction?: () => void; subtitle: string; title: string }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionIndex}><Text style={styles.sectionIndexText}>{index}</Text></View><View style={styles.flexOne}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function SnapshotCard({ brief }: { brief: CoachTeamBriefResponse }) {
  const s = brief.snapshot;
  const cells = [
    { label: 'ATHLETES ACTIVE', value: s.active_athletes, color: COACH_V2.gold }, { label: 'SESSIONS COMPLETED', value: `${s.sessions_completed}/${s.sessions_planned}`, color: COACH_V2.green },
    { label: 'ADHERENCE', value: s.adherence_pct == null ? '—' : `${s.adherence_pct.toFixed(0)}%`, color: COACH_V2.gold }, { label: 'PRS', value: s.pr_count, color: COACH_V2.green, delta: s.pr_delta == null ? null : `${s.pr_delta >= 0 ? '+' : ''}${s.pr_delta} vs prior` },
    { label: 'SETS LOGGED', value: compactNumber(s.sets_logged), color: COACH_V2.text }, { label: 'VOLUME (KG)', value: compactNumber(s.volume_kg), color: COACH_V2.text },
    { label: 'PROGRAMMING COVERAGE', value: s.programming_coverage_pct == null ? '—' : `${s.programming_coverage_pct.toFixed(0)}%`, color: COACH_V2.text }, { label: 'REVIEWS COMPLETED', value: s.reviews_completed, color: COACH_V2.text },
  ];
  return <Card><View style={styles.snapshotGrid}>{cells.map((cell) => <View key={cell.label} accessibilityLabel={`${cell.label}: ${cell.value}`} style={styles.snapshotCell}><Text style={[styles.snapshotValue, { color: cell.color }]}>{cell.value}</Text><Text style={styles.snapshotLabel}>{cell.label}</Text>{cell.delta ? <Text style={styles.snapshotDelta}>{cell.delta}</Text> : null}</View>)}</View></Card>;
}

function TeamTrendChart({ metric, points }: { metric: CoachAnalyticsMetricKey; points: TrendPoint[] }) {
  const geometry = useMemo(() => {
    const usable = points.filter((point) => point.team_average != null);
    if (usable.length < 2) return null;
    const values = usable.flatMap((point) => [point.team_average, point.low, point.high]).filter((value): value is number => value != null);
    const min = Math.min(...values, metric === 'adherence' ? 0 : 0); const max = Math.max(...values, metric === 'adherence' ? 100 : 1); const span = Math.max(1, max - min);
    const x = (index: number) => 14 + (index / Math.max(1, usable.length - 1)) * 292; const y = (value: number) => 118 - ((value - min) / span) * 94;
    const line = usable.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.team_average as number)}`).join(' ');
    const upper = usable.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.high ?? point.team_average as number)}`).join(' ');
    const lower = usable.slice().reverse().map((point, reverseIndex) => { const index = usable.length - reverseIndex - 1; return `L${x(index)},${y(point.low ?? point.team_average as number)}`; }).join(' ');
    return { usable, line, band: `${upper}${lower}Z`, x, y, min, max };
  }, [metric, points]);
  if (!geometry) return <View style={styles.chartEmpty}><Text style={styles.chartEmptyTitle}>Insufficient comparable history</Text><Text style={styles.chartEmptyCopy}>At least two real observations are required before this trend is drawn.</Text></View>;
  return <View accessible accessibilityLabel={`${METRIC_LABELS[metric]} team trend from ${geometry.min.toFixed(1)} to ${geometry.max.toFixed(1)}`}><Svg height={150} viewBox="0 0 320 150" width="100%"><Defs><SvgGradient id="teamBand" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={COACH_V2.violetBright} stopOpacity="0.2" /><Stop offset="1" stopColor={COACH_V2.violetBright} stopOpacity="0.02" /></SvgGradient></Defs><Path d={geometry.band} fill="url(#teamBand)" /><Path d={geometry.line} fill="none" stroke={COACH_V2.violetBright} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} />{geometry.usable.map((point, index) => <Circle cx={geometry.x(index)} cy={geometry.y(point.team_average as number)} fill={index === geometry.usable.length - 1 ? COACH_V2.green : COACH_V2.violetBright} key={`${point.date}-${index}`} r={index === geometry.usable.length - 1 ? 4 : 2.4} />)}</Svg><View style={styles.chartDates}><Text style={styles.chartDate}>{geometry.usable[0].date.slice(5)}</Text><Text style={styles.chartDate}>{geometry.usable[geometry.usable.length - 1].date.slice(5)}</Text></View></View>;
}

function LegendDot({ color, label }: { color: string; label: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>; }

function LiftPerformance({ lift }: { lift?: CoachTeamBriefResponse['lifts'][string] }) {
  if (!lift || !lift.athletes_with_evidence) return <View style={styles.inlineEmpty}><Text style={styles.chartEmptyTitle}>No comparable Core evidence</Text><Text style={styles.chartEmptyCopy}>Canonical competition lift evidence is required in both periods.</Text></View>;
  return <View style={styles.liftBody}><View style={styles.liftPrimary}><Text style={styles.liftValue}>{metricText(lift.team_average_progression)}</Text><Text style={styles.liftLabel}>TEAM AVG PROGRESSION</Text><Text style={styles.liftEvidence}>{lift.athletes_with_evidence} athlete{lift.athletes_with_evidence === 1 ? '' : 's'} with evidence</Text></View><View style={styles.liftComparison}><Text style={styles.comparisonLabel}>TOP PROGRESSION</Text><Text numberOfLines={1} style={styles.comparisonName}>{lift.top_athlete?.name || '—'}</Text><Text style={[styles.comparisonValue, { color: COACH_V2.green }]}>{metricText(lift.top_athlete?.value)}</Text><View style={styles.comparisonDivider} /><Text style={styles.comparisonLabel}>LOWEST PROGRESSION</Text><Text numberOfLines={1} style={styles.comparisonName}>{lift.lowest_athlete?.name || '—'}</Text><Text style={[styles.comparisonValue, { color: COACH_V2.magenta }]}>{metricText(lift.lowest_athlete?.value)}</Text></View></View>;
}

function OutlierStrip({ onOpen, outliers, supported }: { onOpen: (row: CoachAnalyticsOutlier) => void; outliers: CoachAnalyticsOutlier[]; supported: boolean }) {
  if (!supported) return <Card tone="neutral"><View style={styles.inlineEmpty}><Ionicons color={COACH_V2.gold} name="people-outline" size={24} /><Text style={styles.chartEmptyTitle}>Cohort too small for outlier claims</Text><Text style={styles.chartEmptyCopy}>Individual values remain visible in the Athlete Matrix. Robust outlier bands require four comparable athletes.</Text></View></Card>;
  if (!outliers.length) return <Card tone="on_track"><View style={styles.inlineEmpty}><Ionicons color={COACH_V2.green} name="checkmark-circle-outline" size={25} /><Text style={styles.chartEmptyTitle}>No athletes outside the normal band</Text><Text style={styles.chartEmptyCopy}>No actionable cohort exceptions were detected in this period.</Text></View></Card>;
  return <ScrollView contentContainerStyle={styles.outlierRail} horizontal showsHorizontalScrollIndicator={false}>{outliers.slice(0, 5).map((row) => { const color = row.direction === 'below' ? COACH_V2.magenta : COACH_V2.green; return <Pressable key={`${row.athlete_id}:${row.metric}`} accessibilityLabel={`Open ${row.name} outlier detail`} accessibilityRole="button" onPress={() => onOpen(row)} style={({ pressed }) => [styles.outlierCard, { borderColor: `${color}66` }, pressed && styles.pressed]}><CoachMaterialLayer borderRadius={13} emphasis="standard" tone={row.direction === 'below' ? 'critical' : 'on_track'} /><Text style={[styles.outlierDirection, { color }]}>{row.direction === 'below' ? 'BELOW RANGE' : 'ABOVE RANGE'}</Text><Text numberOfLines={1} style={styles.outlierName}>{row.name}</Text><Text style={[styles.outlierValue, { color }]}>{metricText(row.value)}</Text><Text style={styles.outlierMetric}>{METRIC_LABELS[row.metric]}</Text><View style={styles.outlierFooter}><Text style={styles.outlierOpen}>View evidence</Text><Ionicons color={COACH_V2.muted} name="chevron-forward" size={16} /></View></Pressable>; })}</ScrollView>;
}

function AthleteMatrix({ athletes, onOpen }: { athletes: CoachAnalyticsAthlete[]; onOpen: (athlete: CoachAnalyticsAthlete) => void }) {
  const sorted = useMemo(() => [...athletes].sort((a, b) => (b.metrics.max_progression.value ?? -999) - (a.metrics.max_progression.value ?? -999)), [athletes]);
  return <Card><View style={styles.matrixHeader}><Text style={[styles.matrixHeaderText, styles.matrixName]}>ATHLETE</Text><Text style={styles.matrixHeaderText}>MAX</Text><Text style={styles.matrixHeaderText}>DOTS</Text><Text style={styles.matrixHeaderText}>ADH.</Text><Text style={styles.matrixHeaderText}>PR RATE</Text></View>{sorted.map((athlete) => <Pressable key={athlete.athlete_id} accessibilityLabel={`Open ${athlete.name} analytics`} accessibilityRole="button" onPress={() => onOpen(athlete)} style={({ pressed }) => [styles.matrixRow, pressed && styles.pressed]}><View style={styles.matrixName}><Text numberOfLines={1} style={styles.matrixAthlete}>{athlete.name}</Text><Text numberOfLines={1} style={styles.matrixContext}>{athlete.block?.name || athlete.program?.name || 'No active block'}</Text></View><MatrixValue metric={athlete.metrics.max_progression} /><MatrixValue metric={athlete.metrics.dots_progression} /><MatrixValue metric={athlete.metrics.adherence} /><MatrixValue metric={athlete.metrics.pr_rate} /><Ionicons color={COACH_V2.subtle} name="chevron-forward" size={14} /></Pressable>)}</Card>;
}

function MatrixValue({ metric }: { metric: CoachAnalyticsAthlete['metrics']['adherence'] }) { const color = metric.cohort_state === 'below' ? COACH_V2.magenta : metric.cohort_state === 'above' ? COACH_V2.green : metric.value == null ? COACH_V2.subtle : COACH_V2.text; return <Text numberOfLines={1} style={[styles.matrixValue, { color }]}>{metricText(metric.value)}</Text>; }

function ImpactGrid({ impact }: { impact: CoachTeamBriefResponse['coaching_impact'] }) {
  const cells: { label: string; value: string | number }[] = [
    { label: 'SESSIONS PROGRAMMED', value: Number(impact.sessions_programmed || 0) }, { label: 'PROGRAMMING COVERAGE', value: impact.programming_coverage_pct == null ? '—' : `${impact.programming_coverage_pct}%` },
    { label: 'REVIEW TURNAROUND', value: impact.review_turnaround_median_hours == null ? '—' : `${impact.review_turnaround_median_hours}h` }, { label: 'REVIEWS COMPLETED', value: Number(impact.reviews_completed || 0) },
    { label: 'ATHLETE PRS', value: Number(impact.athlete_prs_during_period || 0) }, { label: 'NOTES & FEEDBACK', value: Number(impact.notes_and_feedback_delivered || 0) },
    { label: 'BLOCKS MANAGED', value: Number(impact.training_blocks_managed || 0) }, { label: 'PROGRAMS MANAGED', value: Number(impact.programs_managed || 0) },
  ];
  return <Card tone="cyan"><View style={styles.impactGrid}>{cells.map((cell) => <View key={cell.label} style={styles.impactCell}><Text style={styles.impactValue}>{cell.value}</Text><Text style={styles.impactLabel}>{cell.label}</Text></View>)}</View><Text style={styles.impactNote}>{String(impact.language_note || '')}</Text></Card>;
}

function Highlights({ rows }: { rows: CoachTeamBriefResponse['highlights'] }) {
  if (!rows.length) return <Card tone="neutral"><View style={styles.inlineEmpty}><Text style={styles.chartEmptyTitle}>No highlights in this period</Text><Text style={styles.chartEmptyCopy}>Highlights appear only when persisted evidence supports them.</Text></View></Card>;
  return <Card tone="on_track">{rows.map((row, index) => <View key={row.key} style={[styles.highlightRow, index > 0 && styles.highlightDivider]}><Image source={row.asset === 'session_streak_medallion' ? require('@/assets/images/session-recap/session-streak-medallion-v1.png') : require('@/assets/images/ledger-index-v2/ledger-career-pr-medallion-v1.png')} style={styles.highlightImage} /><View style={styles.flexOne}><Text style={styles.highlightTitle}>{row.title}</Text><Text style={styles.highlightCopy}>{row.supporting_line || 'Evidence recorded'}</Text></View></View>)}</Card>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000' }, header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1C202A' }, headerButton: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: '#2D2938', backgroundColor: '#0E0A15', alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, alignItems: 'center', gap: 2 }, headerTitle: { color: COACH_V2.text, fontSize: 16, fontWeight: '900', letterSpacing: 0.6 }, headerSubtitle: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '600' }, content: { paddingTop: 12, gap: 10 },
  periodRail: { height: 38, padding: 3, borderRadius: 19, backgroundColor: '#080A0F', borderWidth: 1, borderColor: '#20232D', flexDirection: 'row', gap: 2 }, periodButton: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, periodButtonActive: { backgroundColor: '#28133A', borderWidth: 1, borderColor: '#70439A' }, periodText: { color: COACH_V2.subtle, fontSize: 10, fontWeight: '800' }, periodTextActive: { color: COACH_V2.violetBright },
  sectionHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 }, sectionIndex: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#251338', borderWidth: 1, borderColor: '#6C3D91', alignItems: 'center', justifyContent: 'center' }, sectionIndexText: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900' }, sectionTitle: { color: COACH_V2.violetBright, fontSize: 12, fontWeight: '900', letterSpacing: 0.35 }, sectionSubtitle: { color: COACH_V2.subtle, fontSize: 9, marginTop: 2 }, sectionAction: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '800' }, card: { overflow: 'hidden', borderRadius: 14, padding: 12, backgroundColor: '#090B11' },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap' }, snapshotCell: { width: '25%', minHeight: 78, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#242834' }, snapshotValue: { fontSize: 20, fontWeight: '800' }, snapshotLabel: { color: COACH_V2.muted, fontSize: 7, lineHeight: 9, textAlign: 'center', marginTop: 5 }, snapshotDelta: { color: COACH_V2.green, fontSize: 7, marginTop: 2 },
  metricSelector: { flexDirection: 'row', backgroundColor: '#05070B', borderRadius: 9, padding: 3, gap: 2 }, metricSelectorButton: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 7, paddingHorizontal: 3 }, metricSelectorActive: { backgroundColor: '#251336' }, metricSelectorText: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '700' }, metricSelectorTextActive: { color: COACH_V2.violetBright }, chartEmpty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', padding: 18 }, chartEmptyTitle: { color: COACH_V2.text, fontSize: 13, fontWeight: '800', textAlign: 'center' }, chartEmptyCopy: { color: COACH_V2.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5 }, chartDates: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: -11 }, chartDate: { color: COACH_V2.subtle, fontSize: 8 }, chartLegend: { flexDirection: 'row', gap: 18, paddingTop: 10 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { color: COACH_V2.muted, fontSize: 9 },
  liftTabs: { flexDirection: 'row', gap: 4 }, liftTab: { flex: 1, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06080D' }, liftTabActive: { backgroundColor: '#261638', borderWidth: 1, borderColor: '#724A99' }, liftTabText: { color: COACH_V2.subtle, fontSize: 10, fontWeight: '700' }, liftTabTextActive: { color: COACH_V2.violetBright }, liftBody: { flexDirection: 'row', minHeight: 140, paddingTop: 15 }, liftPrimary: { flex: 1, justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#2A2D36' }, liftValue: { color: COACH_V2.green, fontSize: 28, fontWeight: '800' }, liftLabel: { color: COACH_V2.muted, fontSize: 8, marginTop: 5 }, liftEvidence: { color: COACH_V2.subtle, fontSize: 8, marginTop: 8 }, liftComparison: { flex: 1.15, paddingLeft: 14, justifyContent: 'center' }, comparisonLabel: { color: COACH_V2.subtle, fontSize: 7, fontWeight: '800' }, comparisonName: { color: COACH_V2.text, fontSize: 11, fontWeight: '700', marginTop: 2 }, comparisonValue: { fontSize: 15, fontWeight: '800' }, comparisonDivider: { height: 1, backgroundColor: '#20232B', marginVertical: 8 }, inlineEmpty: { minHeight: 116, alignItems: 'center', justifyContent: 'center', padding: 16 },
  outlierRail: { gap: 9, paddingRight: 14 }, outlierCard: { width: 188, minHeight: 150, borderRadius: 13, borderWidth: 1, padding: 13, overflow: 'hidden' }, outlierDirection: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 }, outlierName: { color: COACH_V2.text, fontSize: 14, fontWeight: '800', marginTop: 9 }, outlierValue: { fontSize: 25, fontWeight: '900', marginTop: 9 }, outlierMetric: { color: COACH_V2.muted, fontSize: 9 }, outlierFooter: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, outlierOpen: { color: COACH_V2.violetBright, fontSize: 9, fontWeight: '700' },
  matrixHeader: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 1, borderBottomColor: '#242832' }, matrixHeaderText: { width: 48, color: COACH_V2.subtle, fontSize: 7, fontWeight: '800', textAlign: 'center' }, matrixName: { flex: 1, minWidth: 90, textAlign: 'left' }, matrixRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#242832' }, matrixAthlete: { color: COACH_V2.text, fontSize: 11, fontWeight: '800' }, matrixContext: { color: COACH_V2.subtle, fontSize: 7, marginTop: 2 }, matrixValue: { width: 48, color: COACH_V2.text, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap' }, impactCell: { width: '25%', minHeight: 74, alignItems: 'center', justifyContent: 'center', padding: 3, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#252A34' }, impactValue: { color: COACH_V2.text, fontSize: 19, fontWeight: '800' }, impactLabel: { color: COACH_V2.muted, fontSize: 7, lineHeight: 9, textAlign: 'center', marginTop: 4 }, impactNote: { color: COACH_V2.subtle, fontSize: 8, lineHeight: 12, marginTop: 10 }, highlightRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10 }, highlightDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#262A33' }, highlightImage: { width: 42, height: 42, resizeMode: 'contain' }, highlightTitle: { color: COACH_V2.text, fontSize: 11, fontWeight: '800' }, highlightCopy: { color: COACH_V2.muted, fontSize: 9, marginTop: 3 }, qualityHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 }, qualityTitle: { color: COACH_V2.text, fontSize: 13, fontWeight: '800' }, qualityCopy: { color: COACH_V2.muted, fontSize: 9, lineHeight: 13, marginTop: 2 }, qualityNote: { color: COACH_V2.subtle, fontSize: 9, lineHeight: 14, marginTop: 3 }, flexOne: { flex: 1, minWidth: 0 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] }, bottomSpace: { height: 48 },
});
