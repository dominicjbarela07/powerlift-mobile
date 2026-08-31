import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { AthleteCoachingScratchpadTrigger } from '@/components/coach-mobile/AthleteCoachingScratchpad';
import { CoachAnalyticsTrend } from '@/components/coach-mobile/CoachAnalyticsTrend';
import { CoachMobileHeader, CoachStatusBadge, COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { CanonicalMovementHistoryScreen } from '@/components/movement-history/CanonicalMovementHistoryScreen';
import { useCoachMoreNavigation } from '@/components/navigation/CoachMoreNavigationSheet';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLAthleteAvatar, SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { FloatingControlCoordinator, FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text, TextInput } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import { formatCoachRelativeDate, formatCoachVolume, formatCoachWeight } from '@/lib/coach-mobile-v2';
import type { CoachAthleteSummaryResponse, CoachRecentTrainingSession, CoachTeamBriefResponse } from '@/lib/coach-mobile';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';

type Period = '4W' | '12W' | '6M';
type Detail = 'progress' | 'readiness' | 'execution' | 'attention' | 'programming' | null;
type ExplorerMovement = {
  key: string;
  core_movement_id?: number | null;
  movement_definition_id?: number | null;
  label: string;
  movement_type?: string | null;
  last_trained_date?: string | null;
  top_work?: string | null;
  sessions?: { top_work?: string | null }[];
};
type SelectedMovement = Pick<ExplorerMovement, 'core_movement_id' | 'movement_definition_id' | 'label'>;
type MuscleExposure = { muscle: string; primary: number; secondary: number };
const PERIODS: Period[] = ['4W', '12W', '6M'];
const LIFT_LABELS: Record<string, string> = { squat: 'Squat', bench: 'Bench Press', deadlift: 'Deadlift' };

function signed(value?: number | null, suffix = '%') {
  return value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;
}
function trend(value?: number | null) {
  if (value == null) return 'Insufficient';
  if (value >= 3) return 'Progressing';
  if (value > 0.5) return 'Improving';
  if (value <= -3) return 'Declining';
  return 'Stable';
}
function tone(value?: number | null) {
  return value == null ? COACH_V2.muted : value < -0.5 ? COACH_V2.magenta : value > 0.5 ? COACH_V2.green : COACH_V2.cyan;
}
function performanceCopy(performance: CoachTeamBriefResponse['highlights'][number]['current_performance'], units?: string | null) {
  if (!performance) return 'Performed evidence unavailable';
  const effort = performance.rpe != null ? ` @${performance.rpe} RPE` : performance.rir != null ? ` @${performance.rir} RIR` : '';
  return `${formatCoachWeight(performance.weight_kg, units)} × ${performance.reps ?? '—'}${effort}`;
}
function titleCase(value?: string | null) {
  return String(value || '').replace(/^accessory_/, '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CoachAthleteHubV2({ previewSummary }: { previewSummary?: CoachAthleteSummaryResponse }) {
  const router = useRouter();
  const { open: openMoreNavigation } = useCoachMoreNavigation();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const { user } = useAuth();
  const rawAthleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const athleteId = rawAthleteId || (previewSummary ? String(previewSummary.athlete.id) : undefined);
  const [period, setPeriod] = useState<Period>('4W');
  const requestKey = `${user?.email || user?.athlete_id || ''}:${athleteId || ''}:${period}`;
  const requestKeyRef = useRef(requestKey);
  const requestRef = useRef(0);
  const [summary, setSummary] = useState<CoachAthleteSummaryResponse | null>(previewSummary || null);
  const [loading, setLoading] = useState(!previewSummary);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>(null);
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [movementResults, setMovementResults] = useState<ExplorerMovement[]>([]);
  const [selectedMovement, setSelectedMovement] = useState<SelectedMovement | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleExposure | null>(null);
  const exploreRequestRef = useRef(0);

  useEffect(() => { requestKeyRef.current = requestKey; requestRef.current += 1; }, [requestKey]);
  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (previewSummary) return;
    if (!athleteId) { setError('Athlete identity is missing.'); setLoading(false); return; }
    const key = requestKey;
    const sequence = ++requestRef.current;
    const current = () => requestKeyRef.current === key && requestRef.current === sequence;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetchJson(`/coach/mobile/athletes/${athleteId}/summary?view=v3&period=${period}`, { method: 'GET' });
      const payload = response.json as CoachAthleteSummaryResponse | null;
      if (!current()) return;
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok || !payload?.ok) { setError(payload?.error || `Could not load athlete context. (${response.status})`); return; }
      setSummary({ ...payload, athlete: { ...payload.athlete, ...normalizeProfilePhotoPayload(payload.athlete) } });
    } catch (loadError) {
      if (current()) { console.warn('Athlete Workspace V3 load failed', loadError); setError('Network error. Try again.'); }
    } finally { if (current()) { setLoading(false); setRefreshing(false); } }
  }, [athleteId, period, previewSummary, requestKey, router]);

  useFocusEffect(useCallback(() => { void load({ silent: true }); }, [load]));
  useEffect(() => { const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void load({ silent: true }); }); return () => sub.remove(); }, [load]);

  const workspace = summary?.workspace_v3;
  const metrics = workspace?.athlete.metrics;
  const preferredUnits = summary?.athlete.preferred_units || user?.preferred_units;
  const { unit: displayUnit, setUnit: setDisplayUnit } = useSurfaceWeightUnit(preferredUnits);
  const performed = useMemo(() => (summary?.recent_training || []).filter((row) => row.evidence_mode === 'performed'), [summary?.recent_training]);
  const upcoming = useMemo(() => (summary?.recent_training || []).filter((row) => row.evidence_mode === 'planned'), [summary?.recent_training]);
  const highlights = useMemo(() => (workspace?.highlights || []).filter((row) => row.type === 'pr' && row.athlete_id === summary?.athlete.id), [summary?.athlete.id, workspace?.highlights]);
  const muscleExposure = useMemo(() => {
    const totals = new Map<string, { muscle: string; primary: number; secondary: number }>();
    for (const session of summary?.recent_training || []) {
      for (const item of session.muscle_focus?.primary || []) { const row = totals.get(item.muscle_id) || { muscle: item.muscle_id, primary: 0, secondary: 0 }; row.primary += Math.max(1, Number(item.score || 1)); totals.set(item.muscle_id, row); }
      for (const item of session.muscle_focus?.secondary || []) { const row = totals.get(item.muscle_id) || { muscle: item.muscle_id, primary: 0, secondary: 0 }; row.secondary += Math.max(1, Number(item.score || 1)); totals.set(item.muscle_id, row); }
    }
    return [...totals.values()].sort((a, b) => b.primary - a.primary || b.secondary - a.secondary).slice(0, 8);
  }, [summary?.recent_training]);

  useEffect(() => {
    const needle = query.trim();
    const sequence = ++exploreRequestRef.current;
    if (!exploreOpen || needle.length < 2 || !athleteId) {
      setMovementResults([]);
      setSearching(false);
      setSearchError(null);
      return undefined;
    }
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ athlete_id: String(athleteId), q: needle });
        const response = await fetchJson(`/workouts/mobile/training-hub/movement-history?${params.toString()}`, { method: 'GET' });
        if (sequence !== exploreRequestRef.current) return;
        const payload = response.json as any;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
        const rows = Array.isArray(payload.movement_history?.movements) ? payload.movement_history.movements : [];
        setMovementResults(rows.slice(0, 16));
      } catch (searchFailure) {
        if (sequence !== exploreRequestRef.current) return;
        console.warn('Athlete Workspace movement search failed', searchFailure);
        setMovementResults([]);
        setSearchError('Movement search is temporarily unavailable. Muscle and metric results remain available.');
      } finally {
        if (sequence === exploreRequestRef.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [athleteId, exploreOpen, query]);

  const openMessage = useCallback(() => {
    if (!summary) return;
    const threadId = summary.unread_messages?.thread_id;
    router.push(threadId ? ({ pathname: '/(tabs)/messages/[threadId]', params: { threadId: String(threadId) } } as any) : ({ pathname: '/(tabs)/messages', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name } } as any));
  }, [router, summary]);
  const openSession = useCallback((session: CoachRecentTrainingSession) => {
    router.push({ pathname: session.evidence_mode === 'performed' ? '/(tabs)/coach-session-review' : '/(tabs)/workout/session-workspace/[workoutId]', params: { workoutId: String(session.workout_id) } } as any);
  }, [router]);
  const openMore = useCallback(() => {
    if (!summary) return;
    openMoreNavigation({ athleteId: String(summary.athlete.id), athleteName: summary.athlete.name });
  }, [openMoreNavigation, summary]);

  const openMovement = useCallback((movement: SelectedMovement) => {
    if (!movement.core_movement_id && !movement.movement_definition_id) return;
    setExploreOpen(false);
    setSelectedMovement(movement);
  }, []);

  const openMuscle = useCallback((muscle: MuscleExposure) => {
    setExploreOpen(false);
    setSelectedMuscle(muscle);
  }, []);

  const explorerResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !summary) return [];
    const rows: { key: string; kind: string; title: string; subtitle: string; disabled?: boolean; onPress: () => void }[] = [];
    movementResults.forEach((movement) => {
      const hasIdentity = Boolean(movement.core_movement_id || movement.movement_definition_id);
      rows.push({
        key: `movement:${movement.key}`,
        kind: movement.movement_type === 'accessory' ? 'Accessory Movement' : 'Core Movement',
        title: movement.label,
        subtitle: hasIdentity
          ? [movement.top_work || movement.sessions?.[0]?.top_work, movement.last_trained_date ? `Last trained ${formatCoachRelativeDate(movement.last_trained_date)}` : null].filter(Boolean).join(' · ') || 'Open exact governed history'
          : 'History unavailable — governed movement identity is missing',
        disabled: !hasIdentity,
        onPress: () => openMovement(movement),
      });
    });
    Object.entries(metrics?.max_progression.by_lift || {}).forEach(([family, value]) => {
      const title = LIFT_LABELS[family] || family;
      if (title.toLowerCase().includes(needle)) rows.push({ key: `lift:${family}`, kind: 'Movement', title, subtitle: `${signed(value)} · ${trend(value)} · canonical Core evidence`, onPress: () => router.push({ pathname: '/(tabs)/ledger/strength', params: { athleteId: String(summary.athlete.id), lift: family } } as any) });
    });
    highlights.forEach((row) => { if ((row.movement_name || '').toLowerCase().includes(needle)) rows.push({ key: row.key, kind: 'Performed evidence', title: row.movement_name || 'Core movement', subtitle: `${row.pr_type || 'PR'} · ${performanceCopy(row.current_performance, preferredUnits)}`, onPress: () => row.workout_id && router.push({ pathname: '/(tabs)/coach-session-review', params: { workoutId: String(row.workout_id) } } as any) }); });
    muscleExposure.forEach((row) => { const title = titleCase(row.muscle); if (title.toLowerCase().includes(needle)) rows.push({ key: `muscle:${row.muscle}`, kind: 'Muscle Exposure', title, subtitle: `${Math.round(row.primary)} direct · ${Math.round(row.secondary)} secondary exposure score`, onPress: () => openMuscle(row) }); });
    return rows.filter((row, index, all) => all.findIndex((candidate) => candidate.key === row.key) === index).slice(0, 18);
  }, [highlights, metrics?.max_progression.by_lift, movementResults, muscleExposure, openMovement, openMuscle, preferredUnits, query, router, summary]);

  if (loading && !summary) return <SLScreen edges="top" padded={false}><SLLoadingState message="Resolving canonical evidence and prior-period context." title="Reading Athlete" /></SLScreen>;
  return <SLScreen edges="top" padded={false} style={styles.screen}>
    <FloatingControlCoordinator context="screen">
      <FloatingDisplayUnitRegistration unit={displayUnit} onChange={setDisplayUnit} slot={1} testID="athlete-workspace-unit-toggle" />
      <CoachMobileHeader eyebrow="Athlete Command Center" onBack={() => router.back()} onPrimary={() => setToolkitOpen(true)} primaryLabel="Open Coach Toolkit" title="Athlete Workspace V3" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} tintColor={COACH_V2.violet} onRefresh={() => load({ silent: true })} />} showsVerticalScrollIndicator={false}>
        {error && !summary ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load()} title="Athlete Workspace unavailable" /> : null}
        {summary ? <>
          <View style={styles.hero}>
            <View style={styles.heroIdentity}><SLAthleteAvatar imageUrl={summary.athlete.profilePhotoUrl} imageVersion={summary.athlete.profilePhotoVersion} name={summary.athlete.name} size={62} statusColor={summary.operational_status.tone === 'danger' ? COACH_V2.magenta : COACH_V2.green} /><View style={styles.flex}><Text numberOfLines={1} style={styles.name}>{summary.athlete.name}</Text><Text style={styles.meta}>{summary.athlete.is_self ? 'Your athlete profile' : 'Coached athlete'}</Text><CoachStatusBadge label={summary.operational_status.label} tone={summary.operational_status.tone === 'danger' ? 'danger' : summary.operational_status.tone === 'warning' ? 'warning' : 'success'} /></View></View>
            <View style={styles.programStrip}><Ionicons color={COACH_V2.violetBright} name="barbell-outline" size={19} /><View style={styles.flex}><Text numberOfLines={1} style={styles.rowTitle}>{summary.current_training?.program_name || 'No active Program'}</Text><Text numberOfLines={1} style={styles.meta}>{[summary.current_training?.block_name, summary.current_training?.week_position && summary.current_training?.week_total ? `Week ${summary.current_training.week_position} of ${summary.current_training.week_total}` : null].filter(Boolean).join(' · ') || summary.current_training?.label || 'Program position unavailable'}</Text></View></View>
            <View style={styles.heroActions}><HeroAction icon="chatbubble-ellipses-outline" label="Message" onPress={openMessage} /><HeroAction icon="calendar-outline" label="Program" onPress={() => router.push({ pathname: '/(tabs)/workout', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name } } as any)} /><HeroAction icon="today-outline" label="Schedule" onPress={() => router.push({ pathname: '/(tabs)/coach-calendar', params: { athleteId: String(summary.athlete.id) } } as any)} /><HeroAction icon="ellipsis-horizontal" label="More" onPress={openMore} /></View>
          </View>
          <Heading meta={`Updated ${formatCoachRelativeDate(summary.generated_at)}`} title="Athlete Read" />
          <View style={styles.readGrid}><Read accent={tone(metrics?.max_progression.value)} icon="trending-up" label="Progress" onPress={() => setDetail('progress')} state={trend(metrics?.max_progression.value)} value={`${signed(metrics?.max_progression.value)} · ${period}`} /><Read accent={tone(metrics?.readiness_trend.value)} icon="pulse" label="Readiness" onPress={() => setDetail('readiness')} state={metrics?.readiness_trend.value == null ? 'Insufficient' : metrics.readiness_trend.value < 0 ? 'Trending Down' : 'Stable'} value={summary.readiness?.score == null ? 'No recent check-in' : `${summary.readiness.score.toFixed(1)} today`} /><Read accent={COACH_V2.cyan} icon="checkmark-circle" label="Execution" onPress={() => setDetail('execution')} state={metrics?.adherence.value == null ? 'Insufficient' : metrics.adherence.value >= 90 ? 'Strong' : 'Monitor'} value={metrics?.adherence.value == null ? 'No planned Sessions' : `${metrics.adherence.value.toFixed(0)}% adherence`} /><Read accent={summary.operational_status.reasons.length ? COACH_V2.gold : COACH_V2.green} icon="alert-circle" label="Attention" onPress={() => setDetail('attention')} state={summary.operational_status.reasons.length ? 'Needs Focus' : 'Clear'} value={`${summary.operational_status.reasons.length} items`} /></View>
          <Heading title="Explore Athlete" />
          <Pressable accessibilityLabel={`Explore ${summary.athlete.name} data`} accessibilityRole="button" onPress={() => setExploreOpen(true)} style={styles.explore}><Ionicons color={COACH_V2.muted} name="search" size={18} /><Text style={styles.exploreCopy}>Search movements, muscles, or metrics…</Text><Ionicons color={COACH_V2.muted} name="chevron-forward" size={17} /></Pressable>
          <ScrollView contentContainerStyle={styles.quickRow} horizontal showsHorizontalScrollIndicator={false}>{Object.keys(metrics?.max_progression.by_lift || {}).map((family) => <Pressable accessibilityRole="button" key={family} onPress={() => router.push({ pathname: '/(tabs)/ledger/strength', params: { athleteId: String(summary.athlete.id), lift: family } } as any)} style={styles.quickChip}><Ionicons color={COACH_V2.violetBright} name="barbell-outline" size={15} /><Text style={styles.quickText}>{LIFT_LABELS[family] || titleCase(family)}</Text></Pressable>)}{muscleExposure.slice(0, 4).map((row) => <Pressable accessibilityRole="button" key={row.muscle} onPress={() => openMuscle(row)} style={styles.quickChip}><Ionicons color={COACH_V2.gold} name="body-outline" size={15} /><Text style={styles.quickText}>{titleCase(row.muscle)}</Text></Pressable>)}</ScrollView>
          <View style={styles.card}><Heading action="Open detail" onAction={() => setDetail('progress')} title="Progress Over Time" /><Periods onChange={setPeriod} selected={period} /><View style={styles.lead}><Text style={[styles.leadValue, { color: tone(metrics?.max_progression.value) }]}>{signed(metrics?.max_progression.value)}</Text><Text style={styles.meta}>Normalized performance · {period}</Text></View>{workspace ? <CoachAnalyticsTrend athlete={workspace.progress.athlete_series_by_metric.max_progression || []} metric="max_progression" team={workspace.progress.team_series_by_metric.max_progression || []} /> : <Empty text="Comparable canonical Core evidence has not been established." />}<Text style={styles.eyebrow}>MOVEMENT SIGNALS</Text>{Object.entries(metrics?.max_progression.by_lift || {}).map(([family, value]) => <SignalRow key={family} label={LIFT_LABELS[family] || family} onPress={() => router.push({ pathname: '/(tabs)/ledger/strength', params: { athleteId: String(summary.athlete.id), lift: family } } as any)} state={trend(value)} value={signed(value)} />)}{!Object.keys(metrics?.max_progression.by_lift || {}).length ? <Empty text="No comparable competition-Core movement signals yet." /> : null}</View>
          <View style={styles.card}><Heading action="Open detail" onAction={() => setDetail('programming')} title="Programming & Exposure" /><View style={styles.program}><Ionicons color={COACH_V2.gold} name="calendar-outline" size={20} /><View style={styles.flex}><Text style={styles.rowTitle}>{summary.current_training?.program_name || 'No active Program'}</Text><Text style={styles.meta}>{summary.current_training?.block_name || 'Block unavailable'}{summary.current_training?.week_position && summary.current_training.week_total ? ` · Week ${summary.current_training.week_position} of ${summary.current_training.week_total}` : ''}</Text><Text style={styles.meta}>Programmed through {summary.programming_horizon.programmed_through_date || '—'}</Text></View></View>{muscleExposure.length ? <View style={styles.exposure}><ProgrammingMuscleRegionArt level="session" primary={muscleExposure.filter((row) => row.primary > 0).slice(0, 5).map((row) => row.muscle)} secondary={muscleExposure.filter((row) => row.secondary > 0).slice(0, 5).map((row) => row.muscle)} style={styles.anatomy} /><View style={styles.flex}>{muscleExposure.slice(0, 6).map((row) => <Pressable accessibilityRole="button" key={row.muscle} onPress={() => openMuscle(row)} style={styles.exposureRow}><Text numberOfLines={1} style={styles.exposureName}>{titleCase(row.muscle)}</Text><Text style={styles.meta}>{Math.round(row.primary)} / {Math.round(row.secondary)}</Text><Ionicons color={COACH_V2.muted} name="chevron-forward" size={13} /></Pressable>)}</View></View> : <Empty text="No governed muscle exposure is present in the bounded Session window." />}</View>
          <LastSessionRead highlights={highlights} onPress={() => performed[0] && openSession(performed[0])} session={performed[0] || null} units={displayUnit} />
          <UpcomingProgramming onPress={openSession} sessions={upcoming} />
          <View style={styles.card}><Heading title="Recent Wins" />{highlights.length ? highlights.slice(0, 4).map((row) => <Pressable accessibilityRole="button" key={row.key} onPress={() => row.workout_id && router.push({ pathname: '/(tabs)/coach-session-review', params: { workoutId: String(row.workout_id) } } as any)} style={styles.listRow}><View style={styles.icon}><Ionicons color={COACH_V2.gold} name="trophy-outline" size={18} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{row.pr_type || 'Core PR'} · {row.movement_name}</Text><Text style={styles.meta}>{performanceCopy(row.current_performance, displayUnit)}</Text><Text style={styles.evidence}>{row.prior_performance ? `Previous: ${performanceCopy(row.prior_performance, displayUnit)}` : 'First governed record'}</Text></View><Ionicons color={COACH_V2.muted} name="chevron-forward" size={17} /></Pressable>) : <Empty text="No governed recent wins in the bounded evidence window." />}</View>
          <View style={styles.card}><Heading title="Athlete Signals" />{summary.operational_status.reasons.map((row) => <AlertRow key={`${row.reason_type}:${row.title}`} label={row.title} onPress={() => router.push({ pathname: '/(tabs)/coach-attention/[athleteId]', params: { athleteId: String(summary.athlete.id), reasonType: row.reason_type } } as any)} severity={row.severity} text={row.supporting_text || 'Open the governed evidence.'} />)}{(workspace?.outliers || []).map((row) => <AlertRow key={row.metric} label={`${row.metric.replace(/_/g, ' ')} ${row.direction} range`} onPress={() => setDetail(row.metric === 'adherence' ? 'execution' : 'progress')} severity={row.direction === 'below' ? 'medium' : 'positive'} text={row.interpretation} />)}{summary.pending_video_reviews.count + summary.pending_session_reviews.count > 0 ? <AlertRow label="Outstanding review evidence" onPress={() => router.push({ pathname: '/(tabs)/coach-videos', params: { athleteId: String(summary.athlete.id) } } as any)} severity="medium" text={`${summary.pending_video_reviews.count + summary.pending_session_reviews.count} Session or film review${summary.pending_video_reviews.count + summary.pending_session_reviews.count === 1 ? '' : 's'} waiting.`} /> : null}{summary.programming_horizon.days_remaining != null && summary.programming_horizon.days_remaining <= 3 ? <AlertRow label="Programming horizon is short" onPress={() => router.push({ pathname: '/(tabs)/workout', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name } } as any)} severity="medium" text={`${Math.max(0, summary.programming_horizon.days_remaining)} programmed day${summary.programming_horizon.days_remaining === 1 ? '' : 's'} remaining.`} /> : null}{!summary.operational_status.reasons.length && !(workspace?.outliers || []).length && summary.pending_video_reviews.count + summary.pending_session_reviews.count === 0 && (summary.programming_horizon.days_remaining == null || summary.programming_horizon.days_remaining > 3) ? <AlertRow label="No deterministic attention signals" onPress={() => setDetail('attention')} severity="positive" text="Current bounded evidence is within established operating thresholds." /> : null}</View>
        </> : null}<View style={styles.bottomSpace} />
      </ScrollView>
      {summary ? <Pressable accessibilityLabel="Open Coach Toolkit" accessibilityRole="button" onPress={() => setToolkitOpen(true)} style={styles.floating}><Ionicons color={COACH_V2.text} name="add" size={27} /></Pressable> : null}
      <StrengthLedgerBottomSheet accessibilityLabel="Athlete evidence detail" onDismiss={() => setDetail(null)} visible={detail != null}>{summary ? <DetailSheet detail={detail} displayUnit={displayUnit} period={period} setPeriod={setPeriod} summary={summary} /> : null}</StrengthLedgerBottomSheet>
      <StrengthLedgerBottomSheet accessibilityLabel="Coach Toolkit" heightFraction={0.72} onDismiss={() => setToolkitOpen(false)} visible={toolkitOpen}>{summary ? <Toolkit onMessage={openMessage} pendingReviews={summary.pending_video_reviews.count + summary.pending_session_reviews.count} router={router} summary={summary} /> : null}</StrengthLedgerBottomSheet>
      <StrengthLedgerBottomSheet accessibilityLabel="Explore Athlete" heightFraction={0.88} onDismiss={() => { setExploreOpen(false); setQuery(''); }} visible={exploreOpen}><View style={styles.sheet}><Text style={styles.eyebrow}>ATHLETE EVIDENCE</Text><Text style={styles.sheetTitle}>Explore {summary?.athlete.name}</Text><View style={styles.search}><Ionicons color={COACH_V2.muted} name="search" size={18} /><TextInput autoFocus onChangeText={setQuery} placeholder="Movement, muscle, or metric" placeholderTextColor={COACH_V2.subtle} style={styles.input} value={query} />{searching ? <ActivityIndicator color={COACH_V2.violetBright} size="small" /> : null}</View>{searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}<ScrollView keyboardShouldPersistTaps="handled">{!query.trim() ? <ExplorerLanding metrics={metrics?.max_progression.by_lift || {}} muscles={muscleExposure} onMuscle={openMuscle} onQuery={setQuery} /> : !searching && !explorerResults.length ? <Empty text="No governed athlete evidence matches this search." /> : explorerResults.map((row) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: row.disabled }} disabled={row.disabled} key={row.key} onPress={row.onPress} style={[styles.searchResult, row.disabled && styles.disabled]}><View style={styles.flex}><Text style={styles.searchKind}>{row.kind}</Text><Text style={styles.rowTitle}>{row.title}</Text><Text style={styles.meta}>{row.subtitle}</Text></View><Ionicons color={row.disabled ? COACH_V2.subtle : COACH_V2.violetBright} name={row.disabled ? 'lock-closed-outline' : 'chevron-forward'} size={18} /></Pressable>)}</ScrollView></View></StrengthLedgerBottomSheet>
      <StrengthLedgerBottomSheet accessibilityLabel={selectedMovement ? `${selectedMovement.label} Movement History` : 'Movement History'} heightFraction={0.96} onDismiss={() => setSelectedMovement(null)} visible={selectedMovement != null}>{selectedMovement && summary ? <CanonicalMovementHistoryScreen athleteId={summary.athlete.id} coreMovementId={selectedMovement.core_movement_id} initialDisplayUnit={displayUnit} movementDefinitionId={selectedMovement.movement_definition_id} onRequestClose={() => setSelectedMovement(null)} presentation="sheet" /> : null}</StrengthLedgerBottomSheet>
      <StrengthLedgerBottomSheet accessibilityLabel={selectedMuscle ? `${titleCase(selectedMuscle.muscle)} Exposure` : 'Muscle Exposure'} heightFraction={0.9} onDismiss={() => setSelectedMuscle(null)} visible={selectedMuscle != null}>{selectedMuscle && summary ? <MuscleDetail muscle={selectedMuscle} onOpenLedger={() => router.push({ pathname: '/(tabs)/ledger/muscle-groups/[region]', params: { region: selectedMuscle.muscle, athleteId: String(summary.athlete.id) } } as any)} sessions={summary.recent_training || []} /> : null}</StrengthLedgerBottomSheet>
    </FloatingControlCoordinator>
  </SLScreen>;
}

function Heading({ action, meta, onAction, title }: { action?: string; meta?: string; onAction?: () => void; title: string }) { return <View style={styles.heading}><View style={styles.flex}><Text style={styles.headingText}>{title}</Text>{meta ? <Text style={styles.headingMeta}>{meta}</Text> : null}</View>{action ? <Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.headingAction}>{action}</Text></Pressable> : null}</View>; }
function HeroAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) { return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.heroAction}><Ionicons color={COACH_V2.text} name={icon} size={17} /><Text style={styles.tiny}>{label}</Text></Pressable>; }
function Read({ accent, icon, label, onPress, state, value }: { accent: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; state: string; value: string }) { return <Pressable accessibilityLabel={`Open ${label} evidence`} accessibilityRole="button" onPress={onPress} style={styles.read}><Ionicons color={accent} name={icon} size={18} /><Text style={styles.readLabel}>{label}</Text><Text numberOfLines={1} style={[styles.readState, { color: accent }]}>{state}</Text><Text numberOfLines={2} style={styles.readValue}>{value}</Text></Pressable>; }
function Periods({ onChange, selected }: { onChange: (value: Period) => void; selected: Period }) { return <View style={styles.periods}>{PERIODS.map((value) => <Pressable accessibilityRole="button" key={value} onPress={() => onChange(value)} style={[styles.period, selected === value && styles.periodActive]}><Text style={[styles.periodText, selected === value && styles.periodTextActive]}>{value}</Text></Pressable>)}</View>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Ionicons color={COACH_V2.subtle} name="analytics-outline" size={17} /><Text style={styles.emptyText}>{text}</Text></View>; }
function SignalRow({ label, onPress, state, value }: { label: string; onPress: () => void; state: string; value: string }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.signal}><Text style={styles.signalName}>{label}</Text><Text style={styles.signalValue}>{value}</Text><Text style={[styles.signalState, { color: state === 'Declining' ? COACH_V2.magenta : state === 'Stable' ? COACH_V2.gold : COACH_V2.green }]}>{state}</Text><Ionicons color={COACH_V2.muted} name="chevron-forward" size={15} /></Pressable>; }
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text numberOfLines={1} style={styles.statValue}>{value}</Text><Text numberOfLines={1} style={styles.statLabel}>{label}</Text></View>; }
function LastSessionRead({ highlights, onPress, session, units }: { highlights: CoachTeamBriefResponse['highlights']; onPress: () => void; session: CoachRecentTrainingSession | null; units?: string | null }) {
  const sessionWins = session ? highlights.filter((row) => row.workout_id === session.workout_id) : [];
  return <View style={styles.card}><Heading title="Last Session Read" />{session ? <><View style={styles.sessionHeader}><View style={styles.flex}><Text style={styles.sessionTitle}>{session.label}</Text><Text style={styles.meta}>{formatCoachRelativeDate(session.date)}{session.block_name ? ` · ${session.block_name}` : ''}</Text></View><Text style={styles.status}>COMPLETED</Text></View><View style={styles.statGrid}><Stat label="Sets" value={String(session.set_count)} /><Stat label="Volume" value={formatCoachVolume(session.total_volume_kg, units) || '—'} /><Stat label="PRs" value={String(session.pr_count)} /><Stat label="Movements" value={String(session.movement_count)} /></View><View style={styles.outcome}><Ionicons color={session.pr_count ? COACH_V2.green : COACH_V2.cyan} name={session.pr_count ? 'trophy-outline' : 'checkmark-circle-outline'} size={18} /><View style={styles.flex}><Text style={styles.rowTitle}>{session.pr_count ? `${session.pr_count} governed win${session.pr_count === 1 ? '' : 's'}` : 'Completed Session evidence'}</Text><Text style={styles.meta}>{sessionWins[0] ? `${sessionWins[0].movement_name || 'Core movement'} · ${performanceCopy(sessionWins[0].current_performance, units)}` : `${session.set_count} performed sets across ${session.movement_count} movements`}</Text></View></View>{session.muscle_focus?.primary?.length ? <View><Text style={styles.eyebrow}>PRIMARY EXPOSURE</Text><Text style={styles.copy}>{session.muscle_focus.primary.slice(0, 5).map((row) => titleCase(row.muscle_id)).join(' · ')}</Text></View> : null}<Pressable accessibilityLabel={`Review ${session.label}`} accessibilityRole="button" onPress={onPress} style={styles.fullAction}><Text style={styles.fullActionText}>Review Full Session</Text><Ionicons color={COACH_V2.violetBright} name="chevron-forward" size={17} /></Pressable></> : <Empty text="No completed Session evidence is available." />}</View>;
}
function UpcomingProgramming({ onPress, sessions }: { onPress: (session: CoachRecentTrainingSession) => void; sessions: CoachRecentTrainingSession[] }) {
  return <View style={styles.card}><Heading title="Upcoming Programming" />{sessions.length ? sessions.slice(0, 4).map((session) => <Pressable accessibilityLabel={`Open ${session.label}`} accessibilityRole="button" key={session.workout_id} onPress={() => onPress(session)} style={styles.upcomingRow}><View style={styles.upcomingDate}><Ionicons color={COACH_V2.gold} name="barbell-outline" size={17} /><Text style={styles.upcomingDateText}>{formatCoachRelativeDate(session.date)}</Text></View><View style={styles.flex}><Text style={styles.rowTitle}>{session.label}</Text><Text style={styles.meta}>{[session.block_name, `${session.movement_count} movements`, `${session.set_count} sets`].filter(Boolean).join(' · ')}</Text></View><Ionicons color={COACH_V2.violetBright} name="chevron-forward" size={17} /></Pressable>) : <Empty text="No upcoming assigned Session is available." />}</View>;
}
function ExplorerLanding({ metrics, muscles, onMuscle, onQuery }: { metrics: Record<string, number | null>; muscles: MuscleExposure[]; onMuscle: (muscle: MuscleExposure) => void; onQuery: (value: string) => void }) {
  return <View style={styles.landing}><Text style={styles.eyebrow}>MOVEMENTS & METRICS</Text>{Object.entries(metrics).map(([family, value]) => <Pressable accessibilityRole="button" key={family} onPress={() => onQuery(LIFT_LABELS[family] || family)} style={styles.searchResult}><View style={styles.icon}><Ionicons color={COACH_V2.violetBright} name="barbell-outline" size={18} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{LIFT_LABELS[family] || titleCase(family)}</Text><Text style={styles.meta}>{signed(value)} · {trend(value)}</Text></View><Ionicons color={COACH_V2.violetBright} name="chevron-forward" size={18} /></Pressable>)}<Text style={styles.eyebrow}>MUSCLE EXPOSURE</Text>{muscles.slice(0, 8).map((row) => <Pressable accessibilityRole="button" key={row.muscle} onPress={() => onMuscle(row)} style={styles.searchResult}><View style={styles.icon}><Ionicons color={COACH_V2.gold} name="body-outline" size={18} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{titleCase(row.muscle)}</Text><Text style={styles.meta}>{Math.round(row.primary)} direct · {Math.round(row.secondary)} secondary exposure score</Text></View><Ionicons color={COACH_V2.violetBright} name="chevron-forward" size={18} /></Pressable>)}{!Object.keys(metrics).length && !muscles.length ? <Empty text="No governed movement or muscle evidence is available yet." /> : null}</View>;
}
function MuscleDetail({ muscle, onOpenLedger, sessions }: { muscle: MuscleExposure; onOpenLedger: () => void; sessions: CoachRecentTrainingSession[] }) {
  const contributing = sessions.filter((session) => [...(session.muscle_focus?.primary || []), ...(session.muscle_focus?.secondary || [])].some((row) => row.muscle_id === muscle.muscle));
  const points = contributing.map((session) => {
    const primary = session.muscle_focus?.primary?.find((row) => row.muscle_id === muscle.muscle)?.score || 0;
    const secondary = session.muscle_focus?.secondary?.find((row) => row.muscle_id === muscle.muscle)?.score || 0;
    return { date: session.date || '', value: Number(primary) + Number(secondary) };
  }).filter((point) => point.date && Number.isFinite(point.value)).reverse();
  return <ScrollView contentContainerStyle={styles.sheet}><Text style={styles.eyebrow}>MUSCLE EXPOSURE DETAIL</Text><Text style={styles.sheetTitle}>{titleCase(muscle.muscle)}</Text><View style={styles.muscleHero}><ProgrammingMuscleRegionArt level="session" primary={[muscle.muscle]} secondary={[]} style={styles.muscleArt} /><View style={styles.flex}><Stat label="Sessions" value={String(contributing.length)} /><View style={styles.muscleStats}><Stat label="Direct" value={String(Math.round(muscle.primary))} /><Stat label="Secondary" value={String(Math.round(muscle.secondary))} /></View></View></View><Text style={styles.eyebrow}>EXPOSURE TREND</Text><AnalyticalTimeSeriesChart emptyBody="Two governed exposure observations are required." emptyTitle="Not enough exposure history" height={210} metric={analyticalMetricDefinition('muscle_exposure', { label: 'Exposure score', kind: 'count', includeZero: true })} series={[{ key: muscle.muscle, label: titleCase(muscle.muscle), color: COACH_V2.violetBright, points }]} testID="athlete-workspace-muscle-exposure-chart" /><Text style={styles.eyebrow}>CONTRIBUTING SESSIONS</Text>{contributing.slice(0, 8).map((session) => <View key={session.workout_id} style={styles.listRow}><View style={styles.flex}><Text style={styles.rowTitle}>{session.label}</Text><Text style={styles.meta}>{formatCoachRelativeDate(session.date)} · {session.evidence_mode === 'performed' ? 'Performed' : 'Planned'} · {session.set_count} sets</Text></View></View>)}{!contributing.length ? <Empty text="No contributing Sessions are present in the bounded workspace window." /> : null}<Method text="Exposure uses governed Session muscle-focus taxonomy. Direct and secondary involvement remain separate; Session titles are never used to infer anatomy." /><Pressable accessibilityRole="button" onPress={onOpenLedger} style={styles.fullAction}><Text style={styles.fullActionText}>View Full Muscle History</Text><Ionicons color={COACH_V2.violetBright} name="chevron-forward" size={17} /></Pressable></ScrollView>;
}
function AlertRow({ label, onPress, severity, text }: { label: string; onPress: () => void; severity: string; text: string }) { const color = severity === 'high' || severity === 'critical' ? COACH_V2.magenta : severity === 'medium' ? COACH_V2.gold : COACH_V2.green; return <Pressable accessibilityRole="button" onPress={onPress} style={styles.listRow}><View style={[styles.dot, { backgroundColor: color }]} /><View style={styles.flex}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.meta}>{text}</Text></View><Text style={[styles.severity, { color }]}>{severity.toUpperCase()}</Text></Pressable>; }

function DetailSheet({ detail, displayUnit, period, setPeriod, summary }: { detail: Detail; displayUnit: string; period: Period; setPeriod: (value: Period) => void; summary: CoachAthleteSummaryResponse }) {
  const workspace = summary.workspace_v3; const metrics = workspace?.athlete.metrics;
  const title = detail === 'progress' ? 'Progress & Movement Signals' : detail === 'readiness' ? 'Readiness & Recovery' : detail === 'execution' ? 'Execution' : detail === 'attention' ? 'Attention' : 'Programming & Exposure';
  return <ScrollView contentContainerStyle={styles.sheet}><Text style={styles.eyebrow}>ATHLETE READ · {period}</Text><Text style={styles.sheetTitle}>{title}</Text>
    {detail === 'progress' ? <><Periods onChange={setPeriod} selected={period} /><CoachAnalyticsTrend athlete={workspace?.progress.athlete_series_by_metric.max_progression || []} metric="max_progression" team={workspace?.progress.team_series_by_metric.max_progression || []} />{Object.entries(metrics?.max_progression.by_lift || {}).map(([family, value]) => <SignalRow key={family} label={LIFT_LABELS[family] || family} onPress={() => {}} state={trend(value)} value={signed(value)} />)}<Method text={workspace?.methodology.max_progression} /></> : null}
    {detail === 'readiness' ? <><Metric title="Readiness Trend" value={metrics?.readiness_trend.value} /><AnalyticalTimeSeriesChart emptyBody="Two real readiness observations are required." emptyTitle="Not enough readiness history" height={210} metric={analyticalMetricDefinition('readiness')} series={[{ key: 'readiness', label: 'Readiness', color: COACH_V2.green, points: metrics?.recovery_context?.readiness.history || [] }]} testID="athlete-workspace-readiness-chart" /><RecoveryRows recovery={metrics?.recovery_context} />{summary.reported_bodyweight?.latest ? <View style={styles.metric}><Text style={styles.eyebrow}>REPORTED BODYWEIGHT</Text><Text style={styles.bodyweight}>{formatCoachWeight(summary.reported_bodyweight.latest.reported_bodyweight_kg, displayUnit)}</Text><Text style={styles.meta}>{formatCoachRelativeDate(summary.reported_bodyweight.latest.date)} · athlete-reported check-in evidence{summary.reported_bodyweight.delta_kg != null ? ` · ${summary.reported_bodyweight.delta_kg > 0 ? '+' : ''}${formatCoachWeight(summary.reported_bodyweight.delta_kg, displayUnit)} change` : ''}</Text></View> : <Empty text="No athlete-reported bodyweight evidence is available." />}<Method text="Every baseline excludes the current check-in. These are deterministic comparisons, not causal conclusions." /></> : null}
    {detail === 'execution' ? <><Metric title="Session Adherence" value={metrics?.adherence.value} /><Text style={styles.copy}>{metrics?.adherence.completed ?? 0} completed of {metrics?.adherence.planned ?? 0} planned Sessions in the selected period.</Text><Method text={workspace?.methodology.adherence} /></> : null}
    {detail === 'attention' ? <>{summary.operational_status.reasons.length ? summary.operational_status.reasons.map((row) => <AlertRow key={`${row.reason_type}:${row.title}`} label={row.title} onPress={() => {}} severity={row.severity} text={row.supporting_text || 'Governed operational evidence.'} />) : <Empty text="No deterministic attention signals in the current operating model." />}</> : null}
    {detail === 'programming' ? <><Text style={styles.copy}>{summary.current_training?.program_name || 'No active Program'} · {summary.current_training?.block_name || 'No active Block'}</Text><Text style={styles.copy}>Programmed through {summary.programming_horizon.programmed_through_date || '—'}.</Text><Method text="Exposure is projected from governed Session muscle-focus taxonomy. Primary and secondary involvement remain distinct." /></> : null}
  </ScrollView>;
}
function Metric({ title, value }: { title: string; value?: number | null }) { return <View style={styles.metric}><Text style={styles.eyebrow}>{title.toUpperCase()}</Text><Text style={[styles.leadValue, { color: tone(value) }]}>{signed(value)}</Text></View>; }
function RecoveryRows({ recovery }: { recovery?: NonNullable<NonNullable<CoachAthleteSummaryResponse['workspace_v3']>['athlete']['metrics']['recovery_context']> }) {
  if (!recovery) return <Empty text="No recovery context is available." />;
  const rows = [
    ['Readiness', recovery.readiness, '/10'],
    ['Sleep', recovery.sleep_hours, 'h'],
    ['Stress', recovery.stress, '/10'],
    ['Energy', recovery.energy, '/10'],
    ['Soreness', recovery.soreness, '/10'],
  ] as const;
  return <View style={styles.recoveryRows}>{rows.map(([label, row, unit]) => <View key={label} style={styles.recoveryRow}><View style={styles.flex}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.meta}>{row.prior_only_baseline == null ? `${row.baseline_observations} prior observations` : `Prior-only baseline ${row.prior_only_baseline}${unit}`}</Text></View><Text style={styles.recoveryCurrent}>{row.current == null ? '—' : `${row.current}${unit}`}</Text><Text style={[styles.recoveryDelta, { color: row.delta == null ? COACH_V2.muted : row.delta < 0 ? COACH_V2.magenta : COACH_V2.green }]}>{row.delta == null ? 'No baseline' : `${row.delta > 0 ? '+' : ''}${row.delta} vs prior`}</Text></View>)}</View>;
}
function Method({ text }: { text?: string }) { return text ? <View style={styles.method}><Ionicons color={COACH_V2.violetBright} name="information-circle-outline" size={18} /><Text style={styles.methodText}>{text}</Text></View> : null; }
function Toolkit({ onMessage, pendingReviews, router, summary }: { onMessage: () => void; pendingReviews: number; router: ReturnType<typeof useRouter>; summary: CoachAthleteSummaryResponse }) {
  const athleteId = summary.athlete.id; const athleteName = summary.athlete.name;
  const tools = [
    ['Review Last Session', summary.last_completed_session ? summary.last_completed_session.label : 'No completed Session available', 'document-text-outline', () => summary.last_completed_session && router.push({ pathname: '/(tabs)/coach-session-review', params: { workoutId: String(summary.last_completed_session.workout_id) } } as any)],
    ['Movement Deep Dive', 'Search exact Core and Accessory history', 'barbell-outline', () => router.push({ pathname: '/(tabs)/workout/movement-history', params: { athleteId: String(athleteId) } } as any)],
    ['Programming', 'Manage Program and Sessions', 'calendar-outline', () => router.push({ pathname: '/(tabs)/workout', params: { athleteId: String(athleteId), athleteName } } as any)],
    ['Schedule', 'Calendar and upcoming Sessions', 'today-outline', () => router.push({ pathname: '/(tabs)/coach-calendar', params: { athleteId: String(athleteId) } } as any)],
    ['Review Hub', pendingReviews ? `${pendingReviews} waiting` : 'Session and movement review', 'clipboard-outline', () => router.push({ pathname: '/(tabs)/coach-videos', params: { athleteId: String(athleteId) } } as any)],
    ['Check-Ins', 'Readiness and recovery', 'pulse-outline', () => router.push({ pathname: '/(tabs)/check-ins', params: { athleteId: String(athleteId) } } as any)],
    ['Message Athlete', 'Send a message', 'chatbubble-ellipses-outline', onMessage],
    ['Full Analytics', 'Ledger evidence and history', 'analytics-outline', () => router.push({ pathname: '/(tabs)/ledger', params: { athleteId: String(athleteId) } } as any)],
  ] as const;
  return <ScrollView contentContainerStyle={styles.sheet}><Text style={styles.eyebrow}>COACH ACTIONS</Text><Text style={styles.sheetTitle}>Toolkit</Text><Text style={styles.sectionLabel}>NOTES & NEXT STEPS</Text><AthleteCoachingScratchpadTrigger athleteId={athleteId} athleteName={athleteName} initialScratchpad={summary.coach_context.scratchpad} variant="card" />{tools.map(([label, detail, icon, onPress]) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: label === 'Review Last Session' && !summary.last_completed_session }} disabled={label === 'Review Last Session' && !summary.last_completed_session} key={label} onPress={onPress} style={[styles.tool, label === 'Review Last Session' && !summary.last_completed_session && styles.disabled]}><View style={styles.icon}><Ionicons color={COACH_V2.violetBright} name={icon} size={19} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.meta}>{detail}</Text></View><Ionicons color={COACH_V2.muted} name="chevron-forward" size={18} /></Pressable>)}</ScrollView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COACH_V2.black }, content: { gap: 10, paddingTop: 8, paddingHorizontal: 5 }, flex: { flex: 1, minWidth: 0 },
  hero: { minHeight: 132, gap: 10, borderRadius: 13, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#100B18', padding: 10 }, heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 }, programStrip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 9, borderWidth: 1, borderColor: '#3D2A50', backgroundColor: '#0A0910', paddingHorizontal: 10 }, heroActions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border, paddingTop: 9 }, name: { color: COACH_V2.text, fontSize: 19, fontWeight: '800' }, meta: { color: COACH_V2.muted, fontSize: 9.5, lineHeight: 13 }, heroAction: { minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }, tiny: { color: COACH_V2.text, fontSize: 8 },
  explore: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, paddingHorizontal: 12 }, exploreCopy: { flex: 1, color: COACH_V2.muted, fontSize: 12 },
  quickRow: { gap: 7, paddingRight: 6 }, quickChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 19, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#0D0A13', paddingHorizontal: 11 }, quickText: { color: COACH_V2.text, fontSize: 9.5, fontWeight: '800' },
  heading: { minHeight: 23, flexDirection: 'row', alignItems: 'center' }, headingText: { color: COACH_V2.text, fontSize: 13.5, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' }, headingMeta: { color: COACH_V2.subtle, fontSize: 8 }, headingAction: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '800' },
  readGrid: { flexDirection: 'row', gap: 5 }, read: { minHeight: 101, flex: 1, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 7 }, readLabel: { marginTop: 6, color: COACH_V2.subtle, fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }, readState: { marginTop: 5, fontSize: 9.5, lineHeight: 11, fontWeight: '900' }, readValue: { marginTop: 4, color: COACH_V2.muted, fontSize: 8, lineHeight: 10.5 },
  card: { gap: 9, borderRadius: 13, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 10 }, eyebrow: { color: COACH_V2.violetBright, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  periods: { height: 34, flexDirection: 'row', borderRadius: 9, backgroundColor: '#07080D', padding: 3 }, period: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 7 }, periodActive: { backgroundColor: '#6030A1' }, periodText: { color: COACH_V2.muted, fontSize: 9, fontWeight: '800' }, periodTextActive: { color: COACH_V2.text },
  lead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 }, leadValue: { fontSize: 25, fontWeight: '500' }, signal: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border }, signalName: { flex: 1, color: COACH_V2.text, fontSize: 11, fontWeight: '700' }, signalValue: { color: COACH_V2.green, fontSize: 10, fontWeight: '800' }, signalState: { minWidth: 61, textAlign: 'right', fontSize: 8.5, fontWeight: '800' },
  empty: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, backgroundColor: '#080A0F', padding: 10 }, emptyText: { flex: 1, color: COACH_V2.muted, fontSize: 10, lineHeight: 14 },
  program: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 9, borderWidth: 1, borderColor: '#5A4618', backgroundColor: '#131006', padding: 9 }, rowTitle: { color: COACH_V2.text, fontSize: 11.5, fontWeight: '800' }, exposure: { minHeight: 130, flexDirection: 'row', gap: 10 }, anatomy: { width: 112, height: 130, borderRadius: 9, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#090A10' }, exposureRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 5 }, exposureName: { flex: 1, color: COACH_V2.text, fontSize: 8.5, textTransform: 'capitalize' },
  sessionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, sessionTitle: { color: COACH_V2.text, fontSize: 16, lineHeight: 19, fontWeight: '900' }, status: { color: COACH_V2.green, fontSize: 7.5, fontWeight: '900', borderRadius: 5, borderWidth: 1, borderColor: '#1F6A45', backgroundColor: '#07150F', paddingHorizontal: 6, paddingVertical: 4 }, statGrid: { flexDirection: 'row', gap: 5 }, stat: { minHeight: 50, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#080A0F', paddingHorizontal: 4 }, statValue: { color: COACH_V2.text, fontSize: 13, fontWeight: '900' }, statLabel: { marginTop: 3, color: COACH_V2.muted, fontSize: 7.5, textTransform: 'uppercase' }, outcome: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 9, backgroundColor: '#07120E', padding: 9 }, fullAction: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9, borderWidth: 1, borderColor: '#503367', backgroundColor: '#120B19', paddingHorizontal: 12 }, fullActionText: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '900' }, upcomingRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border, paddingVertical: 7 }, upcomingDate: { width: 65, minHeight: 45, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 8, backgroundColor: '#151006' }, upcomingDateText: { color: COACH_V2.gold, fontSize: 7.5, fontWeight: '800', textAlign: 'center' },
  listRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border, paddingVertical: 7 }, icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B1026' }, evidence: { marginTop: 3, color: COACH_V2.green, fontSize: 8.5, fontWeight: '700' }, dot: { width: 8, height: 8, borderRadius: 4 }, severity: { fontSize: 7, fontWeight: '900' },
  floating: { position: 'absolute', right: 10, bottom: 12, width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: '#8C62B9', backgroundColor: 'rgba(45,30,61,0.94)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10 }, bottomSpace: { height: 78 },
  sheet: { gap: 10, paddingHorizontal: 10, paddingTop: 2, paddingBottom: 30 }, sheetTitle: { color: COACH_V2.text, fontSize: 24, lineHeight: 28, fontWeight: '800' }, search: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, borderWidth: 1, borderColor: '#7950A2', backgroundColor: COACH_V2.surface, paddingHorizontal: 10 }, input: { flex: 1, color: COACH_V2.text, fontSize: 14 }, searchError: { color: COACH_V2.gold, fontSize: 9.5, lineHeight: 14 }, searchResult: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border, paddingVertical: 8 }, searchKind: { color: COACH_V2.violetBright, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }, disabled: { opacity: 0.48 }, landing: { gap: 5, paddingTop: 5 },
  muscleHero: { minHeight: 185, flexDirection: 'row', gap: 10 }, muscleArt: { width: 150, height: 185, borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#090A10' }, muscleStats: { marginTop: 7, flexDirection: 'row', gap: 6 },
  metric: { gap: 5, borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 12 }, bodyweight: { color: COACH_V2.cyan, fontSize: 22, fontWeight: '700' }, copy: { color: COACH_V2.text, fontSize: 12, lineHeight: 17 }, method: { flexDirection: 'row', gap: 8, borderRadius: 10, backgroundColor: '#0E0A15', padding: 10 }, methodText: { flex: 1, color: COACH_V2.muted, fontSize: 9.5, lineHeight: 14 }, sectionLabel: { color: COACH_V2.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 }, tool: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border },
  recoveryRows: { borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, paddingHorizontal: 10 }, recoveryRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border }, recoveryCurrent: { minWidth: 48, color: COACH_V2.text, fontSize: 11, fontWeight: '800', textAlign: 'right' }, recoveryDelta: { minWidth: 78, fontSize: 8.5, fontWeight: '700', textAlign: 'right' },
});
