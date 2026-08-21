import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CompletedSessionRecapPayload } from '@/components/coach-mobile/CompletedSessionRecap';
import {
  CoachCardChevron,
  CoachSparkline,
  CoachStatusBadge,
  COACH_V2,
} from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLAthleteAvatar } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { canonicalAccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import { fetchJson } from '@/lib/api';
import {
  attentionActionLabel,
  formatCoachRelativeDate,
} from '@/lib/coach-mobile-v2';
import {
  openCoachDestination,
  type CoachAthleteSummaryResponse,
  type CoachRecentTrainingSession,
  type CoachRosterAthlete,
} from '@/lib/coach-mobile';
import {
  formatCompactVolumeValueFromKg,
  formatWeightDeltaFromKg,
  formatWeightFromKg,
  normalizeDisplayWeightUnit,
  type DisplayWeightUnit,
} from '@/lib/display-units';
import { useSLReducedMotion } from '@/lib/motion';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';

type WorkoutRecapResponse = {
  ok?: boolean;
  workout?: { completed_recap?: CompletedSessionRecapPayload | null };
};

type RecentSession = {
  id: number;
  date?: string | null;
  label: string;
  status: string;
  planned_summary?: string | null;
};

type RecentSessionsResponse = {
  ok?: boolean;
  sessions?: RecentSession[];
};

type ReadinessDetailResponse = {
  ok?: boolean;
  readiness?: {
    sleep_quality?: number | null;
    sleep_hours?: number | null;
    soreness?: number | null;
    stress?: number | null;
    energy?: number | null;
    readiness_score?: number | null;
  } | null;
};

type AthleteHubCacheEntry = {
  completedWorkoutId: number | null;
  summary: CoachAthleteSummaryResponse;
  recap: CompletedSessionRecapPayload | null;
  readinessDetail: ReadinessDetailResponse['readiness'];
  sessions: RecentSession[];
};

type Props = {
  athlete: CoachRosterAthlete | null;
  onClose: () => void;
  previewSummary?: CoachAthleteSummaryResponse | null;
  previewRecap?: CompletedSessionRecapPayload | null;
};

function toneForStatus(tone?: string) {
  if (tone === 'danger') return 'danger' as const;
  if (tone === 'warning') return 'warning' as const;
  return 'success' as const;
}

function sessionFocusNames(session?: CoachRecentTrainingSession | null) {
  return [
    ...(session?.muscle_focus?.primary || []),
    ...(session?.muscle_focus?.secondary || []),
  ].map((item) => item.muscle_id).filter(Boolean);
}

function recapFocusNames(recap?: CompletedSessionRecapPayload | null) {
  const projected = [
    ...(recap?.muscle_focus?.primary || []),
    ...(recap?.muscle_focus?.secondary || []),
  ].map((item) => item.muscle_id).filter(Boolean);
  if (projected.length) return projected;

  // Older recap payloads predate the session-level projection. Their movement
  // targets are still canonical persisted evidence, so aggregate those rather
  // than guessing from the Session title.
  const scores = new Map<string, number>();
  for (const movement of recap?.performed_movements || []) {
    const sets = Math.max(1, movement.sets?.length || 0);
    if (movement.primary_muscle_group) {
      scores.set(movement.primary_muscle_group, (scores.get(movement.primary_muscle_group) || 0) + sets);
    }
    for (const muscle of movement.secondary_muscle_groups || []) {
      scores.set(muscle, (scores.get(muscle) || 0) + sets * 0.5);
    }
  }
  return [...scores.entries()].sort((left, right) => right[1] - left[1]).map(([muscle]) => muscle);
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function movementPrescription(
  movement: CompletedSessionRecapPayload['performed_movements'][number],
  displayUnit: DisplayWeightUnit,
) {
  const performed = movement.sets.filter((set) => set.actual_reps != null || set.actual_weight_kg != null);
  if (!performed.length) return 'Performed evidence recorded';
  const evidenceSet = performed.find((set) => Number(set.actual_weight_kg) > 0) || performed[0];
  const weight = Number(evidenceSet.actual_weight_kg) > 0
    ? formatWeightFromKg(evidenceSet.actual_weight_kg, displayUnit)
    : null;
  const reps = evidenceSet.actual_reps == null ? null : `${evidenceSet.actual_reps} reps`;
  return [
    `${performed.length} set${performed.length === 1 ? '' : 's'}`,
    weight && evidenceSet.actual_reps != null ? `${weight} × ${evidenceSet.actual_reps}` : weight || reps,
  ].filter(Boolean).join(' · ');
}

function movementEquipment(movement: CompletedSessionRecapPayload['performed_movements'][number]) {
  const equipment = movement.equipment?.[0];
  if (!equipment) return null;
  const identity = [equipment.manufacturer, equipment.model || equipment.label]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return [...new Set(identity)].join(' · ') || null;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function readinessDriver(detail?: ReadinessDetailResponse['readiness']) {
  if (!detail) return null;
  const normalized = [
    detail.sleep_quality == null ? null : { label: 'Sleep lowest', score: Number(detail.sleep_quality) > 5 ? Number(detail.sleep_quality) / 2 : Number(detail.sleep_quality) },
    detail.energy == null ? null : { label: 'Energy lowest', score: Number(detail.energy) > 5 ? Number(detail.energy) / 2 : Number(detail.energy) },
    detail.soreness == null ? null : { label: 'Soreness elevated', score: 6 - Number(detail.soreness) },
    detail.stress == null ? null : { label: 'Stress elevated', score: 6 - Number(detail.stress) },
  ].filter((item): item is { label: string; score: number } => Boolean(item && Number.isFinite(item.score)));
  if (!normalized.length) return null;
  normalized.sort((left, right) => left.score - right.score);
  return normalized[0].label;
}

function shortDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

export function CoachAthleteHubSheet({ athlete, onClose, previewRecap, previewSummary }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useSLReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const notesY = useRef(0);
  const requestRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<number, AthleteHubCacheEntry>());
  const [summary, setSummary] = useState<CoachAthleteSummaryResponse | null>(previewSummary || null);
  const [recap, setRecap] = useState<CompletedSessionRecapPayload | null>(previewRecap || null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [readinessDetail, setReadinessDetail] = useState<ReadinessDetailResponse['readiness']>(null);
  const [readinessDetailLoading, setReadinessDetailLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athlete) return;
    if (previewSummary) {
      setSummary(previewSummary);
      setRecap(previewRecap || null);
      setRecentSessions((previewSummary.recent_training || []).map((session) => ({
        id: session.workout_id,
        date: session.date,
        label: session.label,
        status: session.status || (session.evidence_mode === 'performed' ? 'completed' : 'assigned'),
        planned_summary: session.evidence_mode === 'planned'
          ? `${session.movement_count} movements · ${session.set_count} sets`
          : null,
      })));
      return;
    }
    const sequence = ++requestRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const cached = cacheRef.current.get(athlete.id);
    if (cached) {
      setSummary(cached.summary);
      setRecap(cached.recap);
      setReadinessDetail(cached.readinessDetail);
      setRecentSessions(cached.sessions);
    }
    setLoading(true);
    setError(null);
    try {
      const [response, sessionsResponse] = await Promise.all([
        fetchJson(`/coach/mobile/athletes/${athlete.id}/summary`, { method: 'GET', signal: controller.signal }),
        fetchJson(`/coach/mobile/athletes/${athlete.id}/sessions/recent?limit=30`, { method: 'GET', signal: controller.signal }),
      ]);
      const payload = response.json as CoachAthleteSummaryResponse | null;
      if (sequence !== requestRef.current) return;
      if (!response.ok || !payload?.ok) {
        setError(response.status === 403
          ? 'This athlete is not in your active coaching relationships.'
          : payload?.error || `Could not load athlete context. (${response.status})`);
        return;
      }
      const normalized = {
        ...payload,
        athlete: { ...payload.athlete, ...normalizeProfilePhotoPayload(payload.athlete) },
      };
      setSummary(normalized);
      const sessionPayload = sessionsResponse.json as RecentSessionsResponse | null;
      const nextSessions = sessionsResponse.ok && sessionPayload?.ok && Array.isArray(sessionPayload.sessions)
        ? sessionPayload.sessions
        : [];
      setRecentSessions(nextSessions);

      const completedId = payload.last_completed_session?.workout_id;
      const cachedCompletionMatches = Number(cached?.completedWorkoutId || 0) === Number(completedId || 0);
      let nextRecap: CompletedSessionRecapPayload | null = cachedCompletionMatches ? cached?.recap || null : null;
      let nextReadinessDetail = cachedCompletionMatches ? cached?.readinessDetail || null : null;
      if (!cachedCompletionMatches) {
        setRecap(null);
        setReadinessDetail(null);
      }
      if (completedId) {
        const [recapResponse, readinessResponse] = await Promise.all([
          fetchJson(`/workouts/mobile/${completedId}?view=coach-preview`, { method: 'GET', signal: controller.signal }).catch(() => null),
          fetchJson(`/coach/mobile/review-hub/sessions/${completedId}`, { method: 'GET', signal: controller.signal }).catch(() => null),
        ]);
        const recapPayload = recapResponse?.json as WorkoutRecapResponse | null;
        if (sequence === requestRef.current && recapResponse?.ok) {
          nextRecap = recapPayload?.workout?.completed_recap || null;
          setRecap(nextRecap);
        }
        const readinessPayload = readinessResponse?.json as ReadinessDetailResponse | null;
        if (sequence === requestRef.current && readinessResponse?.ok && readinessPayload?.ok) {
          nextReadinessDetail = readinessPayload.readiness || null;
          setReadinessDetail(nextReadinessDetail);
        }
      }
      if (sequence === requestRef.current) {
        cacheRef.current.set(athlete.id, { completedWorkoutId: completedId || null, summary: normalized, recap: nextRecap, readinessDetail: nextReadinessDetail, sessions: nextSessions });
      }
    } catch (loadError) {
      if (sequence !== requestRef.current) return;
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      console.warn('Coach Athlete Hub sheet load failed', loadError);
      setError('Network error. Try again.');
    } finally {
      if (sequence === requestRef.current) setLoading(false);
    }
  }, [athlete, previewRecap, previewSummary]);

  useEffect(() => {
    requestRef.current += 1;
    requestControllerRef.current?.abort();
    const cached = athlete ? cacheRef.current.get(athlete.id) : null;
    setSummary(previewSummary || cached?.summary || null);
    setRecap(previewRecap || cached?.recap || null);
    setRecentSessions(cached?.sessions || []);
    setReadinessOpen(false);
    setReadinessDetail(cached?.readinessDetail || null);
    setLoading(false);
    setError(null);
    if (athlete) {
      AccessibilityInfo.announceForAccessibility(`${athlete.name} Athlete Hub opened.`);
      void load();
    }
    return () => requestControllerRef.current?.abort();
  }, [athlete, load, previewRecap, previewSummary]);

  const closeSheet = useCallback(() => {
    requestRef.current += 1;
    requestControllerRef.current?.abort();
    onClose();
  }, [onClose]);

  const navigate = useCallback((target: Parameters<typeof router.push>[0]) => {
    onClose();
    setTimeout(() => router.push(target as any), 0);
  }, [onClose, router]);

  if (!athlete) return null;

  const details = summary;
  const training = details?.current_training || athlete.current_training;
  const status = details?.operational_status || {
    primary_status: athlete.status.classification,
    label: athlete.status.label,
    tone: athlete.status.tone,
    reasons: athlete.attention_reasons,
  };
  const primaryReason = status.reasons?.[0];
  const readiness = details?.readiness || athlete.readiness;
  const bodyweight = details?.reported_bodyweight || athlete.reported_bodyweight;
  const recentTraining = details?.recent_training || athlete.recent_training || [];
  const lastSession = recentTraining.find((session) => session.evidence_mode === 'performed')
    || ((details?.last_completed_session || athlete.last_completed_session) ? {
      ...(details?.last_completed_session || athlete.last_completed_session)!,
      set_count: 0,
      movement_count: 0,
      pr_count: 0,
      evidence_mode: 'performed' as const,
    } : null);
  const focus = recapFocusNames(recap).length ? recapFocusNames(recap) : sessionFocusNames(lastSession);
  const focusAsset = accessoryMuscleRegionAsset(canonicalAccessoryMuscleRegionKey(focus[0]));
  const displayUnit = normalizeDisplayWeightUnit(user?.preferred_units);
  const week = details?.week_summary || athlete.week_summary;
  const highlights = recap?.highlights;
  const prCount = highlights?.pr_count ?? lastSession?.pr_count ?? week?.pr_count ?? 0;
  const volume = recap?.session.total_volume_kg ?? lastSession?.total_volume_kg;
  const recapBodyweight = recap?.session.reported_bodyweight;
  const latestBodyweight = bodyweight?.latest || (recapBodyweight ? {
    date: recapBodyweight.training_date || recap?.session.date || '',
    reported_at: recapBodyweight.reported_at,
    reported_bodyweight_kg: recapBodyweight.reported_bodyweight_kg,
    source: 'PRE_SESSION_READINESS' as const,
  } : null);
  const bodyweightObservations = bodyweight?.recent_observations?.length
    ? bodyweight.recent_observations
    : latestBodyweight ? [latestBodyweight] : [];
  const bodyweightBaseline = bodyweightObservations.length >= 3
    ? average(bodyweightObservations.slice(0, -1).slice(-6).map((point) => point.reported_bodyweight_kg))
    : null;
  const bodyweightDelta = latestBodyweight && bodyweightBaseline != null
    ? latestBodyweight.reported_bodyweight_kg - bodyweightBaseline
    : null;
  const readinessHistory = readiness?.history || [];
  const readinessBaseline = readinessHistory.length >= 3
    ? average(readinessHistory.slice(0, -1).slice(-6).map((point) => point.score))
    : null;
  const readinessDelta = readiness?.score != null && readinessBaseline != null
    ? readiness.score - readinessBaseline
    : readiness?.delta ?? null;
  const readinessContext = readinessDriver(readinessDetail);
  const pendingReviewCount = Number(details?.pending_video_reviews?.count || athlete.pending_video_reviews?.count || 0)
    + Number(details?.pending_session_reviews?.count || athlete.pending_session_reviews?.count || 0);
  const upcomingSessions = recentSessions
    .filter((session) => ['assigned', 'in_progress'].includes(String(session.status || '').toLowerCase()))
    .sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')))
    .slice(0, 4);
  if (!upcomingSessions.length) {
    const projected = recentTraining.filter((session) => session.evidence_mode === 'planned').slice(0, 4);
    upcomingSessions.push(...projected.map((session) => ({
      id: session.workout_id,
      date: session.date,
      label: session.label,
      status: session.status || 'assigned',
      planned_summary: `${session.movement_count} movements · ${session.set_count} sets`,
    })));
  }
  const horizon = details?.programming_horizon || athlete.programming_horizon;
  const horizonText = horizon?.programmed_through_date
    ? `Programmed through ${shortDate(horizon.programmed_through_date)}`
    : 'No upcoming programming coverage';
  const evidencePending = loading && !details;

  const message = () => {
    const threadId = details?.unread_messages?.thread_id || athlete.unread_messages?.thread_id;
    navigate(threadId
      ? { pathname: '/(tabs)/messages/[threadId]', params: { threadId: String(threadId) } } as any
      : { pathname: '/(tabs)/messages', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any);
  };
  const program = () => navigate({ pathname: '/(tabs)/workout', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any);
  const schedule = () => navigate({ pathname: '/(tabs)/coach-calendar', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any);
  const more = () => navigate({ pathname: '/(tabs)/coach-more', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any);
  const note = details?.coach_context?.pinned_note || athlete.coach_context?.pinned_note;
  const scrollToNotes = () => scrollRef.current?.scrollTo({ y: Math.max(0, notesY.current - 20), animated: !reduceMotion });
  const openPrimaryReason = () => {
    if (!primaryReason) return;
    onClose();
    setTimeout(() => openCoachDestination(router, primaryReason.destination), 0);
  };
  const openLastSession = () => {
    if (!lastSession?.workout_id) return;
    navigate({ pathname: '/(tabs)/workout/[workoutId]', params: { workoutId: String(lastSession.workout_id), athleteView: 'coach-preview' } } as any);
  };
  const openUpcomingSession = (session: RecentSession) => navigate({
    pathname: '/(tabs)/workout/[workoutId]',
    params: { workoutId: String(session.id), athleteView: 'coach-preview' },
  } as any);
  const openReadiness = async () => {
    setReadinessOpen(true);
    if (readinessDetail || !lastSession?.workout_id) return;
    setReadinessDetailLoading(true);
    try {
      const response = await fetchJson(`/coach/mobile/review-hub/sessions/${lastSession.workout_id}`, { method: 'GET' });
      const payload = response.json as ReadinessDetailResponse | null;
      if (response.ok && payload?.ok) setReadinessDetail(payload.readiness || null);
    } catch {
      // The trend history remains useful if the optional Session component
      // context cannot be loaded.
    } finally {
      setReadinessDetailLoading(false);
    }
  };

  return (
    <>
    <StrengthLedgerBottomSheet accessibilityLabel="Athlete Hub" onDismiss={closeSheet} visible>
          <ScrollView ref={scrollRef} bounces contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <LinearGradient colors={['rgba(157,92,255,0.17)', 'rgba(7,8,13,0.94)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.sheetActions}>
                <Pressable accessibilityLabel="More athlete actions" accessibilityRole="button" onPress={more} style={styles.roundButton}>
                  <Ionicons color={COACH_V2.text} name="ellipsis-horizontal" size={20} />
                </Pressable>
              </View>
              <View style={styles.identity}>
                <SLAthleteAvatar
                  imageUrl={details?.athlete.profilePhotoUrl || athlete.profilePhotoUrl}
                  imageVersion={details?.athlete.profilePhotoVersion || athlete.profilePhotoVersion}
                  name={athlete.name}
                  size={82}
                  statusColor={status.tone === 'danger' ? COACH_V2.magenta : status.tone === 'warning' ? COACH_V2.gold : COACH_V2.green}
                />
                <View style={styles.identityCopy}>
                  <Text numberOfLines={1} style={styles.athleteName}>{athlete.name}</Text>
                  <Text numberOfLines={2} style={styles.programLine}>
                    {training.status === 'active'
                      ? [training.block_name || training.program_name, training.week_position && training.week_total ? `Week ${training.week_position} of ${training.week_total}` : null].filter(Boolean).join(' · ')
                      : training.label}
                  </Text>
                  <CoachStatusBadge label={status.label} tone={toneForStatus(status.tone)} />
                </View>
              </View>
              <View style={styles.quickActions}>
                <QuickAction icon="chatbubble-ellipses-outline" label="Message" onPress={message} />
                <QuickAction icon="calendar-outline" label="Program" onPress={program} primary />
                <QuickAction icon="calendar-number-outline" label="Schedule" onPress={schedule} primary />
                <QuickAction icon="document-text-outline" label="Notes" onPress={scrollToNotes} />
                <QuickAction icon="ellipsis-horizontal" label="More" onPress={more} />
              </View>
            </View>

            {primaryReason ? (
              <Pressable accessibilityRole="button" onPress={openPrimaryReason} style={({ pressed }) => [styles.attentionCard, pressed && styles.pressed]}>
                <LinearGradient colors={['rgba(255,71,103,0.24)', 'rgba(37,8,18,0.96)']} style={StyleSheet.absoluteFillObject} />
                <View style={styles.attentionIcon}><Ionicons color={COACH_V2.magenta} name="calendar-outline" size={24} /></View>
                <View style={styles.attentionCopy}>
                  <Text style={styles.attentionEyebrow}>{primaryReason.title}</Text>
                  <Text numberOfLines={2} style={styles.attentionTitle}>{primaryReason.supporting_text || attentionActionLabel(primaryReason)}</Text>
                  <Text numberOfLines={1} style={styles.attentionMeta}>{horizonText}</Text>
                </View>
                <CoachCardChevron />
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={program} style={({ pressed }) => [styles.horizonCard, pressed && styles.pressed]}>
                <Ionicons color={COACH_V2.gold} name="calendar-outline" size={20} />
                <View style={styles.horizonCopy}>
                  <Text style={styles.horizonLabel}>Programming Horizon</Text>
                  <Text style={styles.horizonText}>{horizonText}</Text>
                </View>
                <CoachCardChevron />
              </Pressable>
            )}

            <SectionTitle title="Current Status" />
            <View style={styles.statusGrid}>
              <StatusCard
                accessibilityLabel="Open readiness details"
                label="Readiness"
                value={readiness?.score == null ? (evidencePending ? 'Loading…' : 'No report') : readiness.score.toFixed(1)}
                subtitle={[
                  readinessDelta == null ? formatCoachRelativeDate(readiness?.date) : `${readinessDelta > 0 ? '↑' : readinessDelta < 0 ? '↓' : '→'} ${Math.abs(readinessDelta).toFixed(1)} vs ${readinessBaseline == null ? 'previous' : 'recent avg'}`,
                  readinessContext,
                ].filter(Boolean).join(' · ')}
                accent={readinessDelta != null && readinessDelta < 0 ? COACH_V2.magenta : COACH_V2.cyan}
                onPress={() => void openReadiness()}
              >
                <CoachSparkline color={readiness?.delta != null && readiness.delta < 0 ? COACH_V2.magenta : COACH_V2.cyan} values={(readiness?.history || []).map((point) => point.score)} />
              </StatusCard>
              <StatusCard
                label="Bodyweight"
                value={formatWeightFromKg(latestBodyweight?.reported_bodyweight_kg, displayUnit) || (evidencePending ? 'Loading…' : 'No reports')}
                subtitle={bodyweightDelta == null
                  ? formatCoachRelativeDate(latestBodyweight?.date)
                  : `${formatWeightDeltaFromKg(bodyweightDelta, displayUnit)} vs recent avg`}
                accent={COACH_V2.cyan}
              >
                <CoachSparkline color={COACH_V2.cyan} values={bodyweightObservations.map((point) => point.reported_bodyweight_kg)} />
              </StatusCard>
              <View style={styles.focusCard}>
                <Image resizeMode="contain" source={focusAsset.source} style={styles.focusImage} />
                <Text style={styles.statusLabel}>Training Focus</Text>
                <Text numberOfLines={2} style={styles.focusLabel}>{focus.length ? focus.slice(0, 2).map(humanize).join(', ') : evidencePending ? 'Loading focus…' : 'No target evidence'}</Text>
              </View>
            </View>

            <SectionTitle title="Last Session" />
            {lastSession ? (
              <Pressable accessibilityLabel={`Open ${lastSession.label}`} accessibilityRole="button" onPress={openLastSession} style={({ pressed }) => [styles.lastSessionCard, pressed && styles.pressed]}>
                <View style={styles.lastSessionTop}>
                  <View style={styles.lastSessionArtwork}><Image resizeMode="contain" source={focusAsset.source} style={styles.lastSessionImage} /></View>
                  <View style={styles.lastSessionCopy}>
                    <Text style={styles.lastSessionTitle}>{lastSession.label}</Text>
                    <Text style={styles.lastSessionMeta}>{formatCoachRelativeDate(lastSession.date)} · Completed</Text>
                  </View>
                  <CoachStatusBadge label="Completed" tone="success" />
                </View>
                <View style={styles.sessionMetrics}>
                  <SessionMetric label="Sets" value={String(recap?.session.set_count ?? lastSession.set_count ?? '—')} />
                  <SessionMetric label="Total Volume" value={formatCompactVolumeValueFromKg(volume, displayUnit) || '—'} />
                  <SessionMetric label="PRs" value={String(prCount)} />
                  <SessionMetric label="Session RPE" value={recap?.reflection.session_rpe == null ? '—' : String(recap.reflection.session_rpe)} />
                </View>
                {focus.length ? <Text style={styles.performedFocus}>Performed focus · {focus.slice(0, 3).map(humanize).join(', ')}</Text> : null}
                {recap?.performed_movements?.length ? (
                  <View style={styles.movementList}>
                    {recap.performed_movements.slice(0, 4).map((movement) => (
                      <View key={`${movement.item_id || movement.label}`} style={styles.movementPill}>
                        <Text numberOfLines={1} style={styles.movementName}>{movement.label}</Text>
                        {movementEquipment(movement) ? <Text numberOfLines={1} style={styles.movementEquipment}>{movementEquipment(movement)}</Text> : null}
                        <Text numberOfLines={1} style={styles.movementEvidence}>{movementPrescription(movement, displayUnit)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.evidenceFallback}>Open the completed Session for performed movement evidence.</Text>
                )}
                <View style={styles.sessionOpenRow}>
                  <Text style={styles.sessionOpenText}>
                    {recap?.session.video_count ? `${recap.session.video_count} video${recap.session.video_count === 1 ? '' : 's'} · ` : ''}
                    {pendingReviewCount ? `${pendingReviewCount} review${pendingReviewCount === 1 ? '' : 's'} waiting · ` : ''}
                    View Session
                  </Text>
                  <CoachCardChevron />
                </View>
              </Pressable>
            ) : <View style={styles.emptyCard}><Text style={styles.emptyText}>No completed Session evidence is available.</Text></View>}

            <SectionTitle action="Schedule" onAction={schedule} title="Upcoming Sessions" />
            {upcomingSessions.length ? (
              <View style={styles.upcomingCard}>
                {upcomingSessions.map((session, index) => (
                  <Pressable
                    accessibilityLabel={`Open ${session.label}`}
                    accessibilityRole="button"
                    key={session.id}
                    onPress={() => openUpcomingSession(session)}
                    style={({ pressed }) => [styles.upcomingRow, index === upcomingSessions.length - 1 && styles.upcomingRowLast, pressed && styles.pressed]}
                  >
                    <View style={styles.upcomingDate}><Text style={styles.upcomingDateText}>{formatCoachRelativeDate(session.date)}</Text></View>
                    <View style={styles.upcomingCopy}>
                      <Text numberOfLines={1} style={styles.upcomingTitle}>{session.label}</Text>
                      <Text numberOfLines={1} style={styles.upcomingMeta}>{session.planned_summary || humanize(session.status || 'Assigned')}</Text>
                    </View>
                    <CoachStatusBadge label={humanize(session.status || 'Assigned')} tone={session.status === 'in_progress' ? 'cyan' : 'warning'} />
                    <Pressable accessibilityLabel={`Schedule ${session.label}`} accessibilityRole="button" hitSlop={8} onPress={(event) => { event.stopPropagation(); schedule(); }} style={styles.scheduleButton}>
                      <Ionicons color={COACH_V2.violetBright} name="calendar-number-outline" size={18} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            ) : <View style={styles.emptyCard}><Text style={styles.emptyText}>{evidencePending ? 'Loading upcoming Sessions…' : 'No upcoming Sessions are assigned.'}</Text></View>}

            <SectionTitle title="Recent Activity" />
            <View style={styles.activityCard}>
              {lastSession ? <ActivityRow icon="checkmark-circle-outline" title={`Completed ${lastSession.label}`} detail={[`${recap?.session.set_count ?? lastSession.set_count} sets`, formatCompactVolumeValueFromKg(volume, displayUnit) ? `${formatCompactVolumeValueFromKg(volume, displayUnit)} Total Volume` : null].filter(Boolean).join(' · ')} date={lastSession.date} /> : null}
              {readiness?.score != null ? <ActivityRow icon="pulse-outline" title={`Readiness submitted · ${readiness.score.toFixed(1)}`} detail={latestBodyweight ? `Reported Bodyweight · ${formatWeightFromKg(latestBodyweight.reported_bodyweight_kg, displayUnit)}` : 'Recovery check-in recorded'} date={readiness.date} /> : null}
              {pendingReviewCount ? <ActivityRow icon="videocam-outline" title={`${pendingReviewCount} review${pendingReviewCount === 1 ? '' : 's'} waiting`} detail={[details?.pending_video_reviews?.count ? `${details.pending_video_reviews.count} video` : null, details?.pending_session_reviews?.count ? `${details.pending_session_reviews.count} Session feedback` : null].filter(Boolean).join(' · ')} /> : null}
              {prCount ? <ActivityRow icon="medal-outline" title={`${prCount} PR${prCount === 1 ? '' : 's'} in ${lastSession?.label || 'the latest Session'}`} detail="Canonical completed-Session evidence" date={lastSession?.date} /> : null}
              {!lastSession && readiness?.score == null && !pendingReviewCount ? <Text style={styles.emptyText}>{evidencePending ? 'Loading recent athlete activity…' : 'No recent athlete activity is available.'}</Text> : null}
            </View>

            <SectionTitle action="View all" onAction={() => navigate({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any)} title="Recent Highlights · 7 Day" />
            <View style={styles.highlightGrid}>
              <HighlightCard accent={COACH_V2.magenta} icon="medal-outline" label="Rep PRs" value={String(prCount)} />
              <HighlightCard accent={COACH_V2.green} icon="checkmark-circle-outline" label="Sessions" value={week ? `${week.completed_sessions}/${week.scheduled_sessions}` : '—'} />
              <HighlightCard accent={COACH_V2.violetBright} icon="flash-outline" label="Total Volume" value={formatCompactVolumeValueFromKg(volume, displayUnit) || '—'} />
              {pendingReviewCount
                ? <HighlightCard accent={COACH_V2.gold} icon="videocam-outline" label="Reviews Waiting" value={String(pendingReviewCount)} />
                : <HighlightCard accent={COACH_V2.gold} icon="trophy-outline" label="Streak" value={highlights?.session_streak == null ? '—' : String(highlights.session_streak)} />}
            </View>

            <View onLayout={(event) => { notesY.current = event.nativeEvent.layout.y; }}>
              <SectionTitle title="Notes & Next Steps" />
              <View style={styles.notesCard}>
                <Ionicons color={COACH_V2.violetBright} name="document-text-outline" size={20} />
                <View style={styles.notesCopy}>
                  <Text style={styles.notesTitle}>{note?.title || 'No pinned coaching note'}</Text>
                  <Text style={styles.notesText}>{note?.body_preview || 'Add coaching context from the athlete’s canonical workspace when it is needed.'}</Text>
                </View>
              </View>
            </View>

            {error ? (
              <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryCard}>
                <Text style={styles.retryText}>{error} Tap to retry.</Text>
              </Pressable>
            ) : loading ? <Text style={styles.loadingText}>Loading the latest athlete evidence…</Text> : null}

            <Pressable accessibilityRole="button" onPress={lastSession ? openLastSession : program} style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}>
              <LinearGradient colors={['#5E24A8', '#8D43E8']} style={StyleSheet.absoluteFillObject} />
              <Text style={styles.primaryCtaText}>{lastSession ? 'Open Last Session' : 'Open Programming'}</Text>
              <Ionicons color={COACH_V2.text} name="arrow-forward" size={20} />
            </Pressable>
          </ScrollView>
    </StrengthLedgerBottomSheet>
    <Modal animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setReadinessOpen(false)} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={readinessOpen}>
      <View style={styles.detailBackdrop}>
        <Pressable accessibilityLabel="Close readiness details" accessibilityRole="button" onPress={() => setReadinessOpen(false)} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.detailSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.detailHandle} />
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.detailEyebrow}>Athlete Readiness</Text>
              <Text style={styles.detailTitle}>Recent recovery context</Text>
            </View>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setReadinessOpen(false)} style={styles.roundButton}>
              <Ionicons color={COACH_V2.text} name="close" size={22} />
            </Pressable>
          </View>
          <View style={styles.detailTrendCard}>
            <View>
              <Text style={styles.statusLabel}>Latest Readiness</Text>
              <Text style={styles.detailScore}>{readiness?.score == null ? '—' : readiness.score.toFixed(1)}</Text>
              <Text style={styles.detailTrendText}>{readinessDelta == null ? 'Not enough evidence for a comparison' : `${readinessDelta > 0 ? '↑' : readinessDelta < 0 ? '↓' : '→'} ${Math.abs(readinessDelta).toFixed(1)} vs ${readinessBaseline == null ? 'previous observation' : 'recent average'}`}</Text>
            </View>
            <View style={styles.detailSparkline}><CoachSparkline color={readinessDelta != null && readinessDelta < 0 ? COACH_V2.magenta : COACH_V2.cyan} values={readinessHistory.map((point) => point.score)} /></View>
          </View>
          {readinessDetail ? (
            <View style={styles.componentGrid}>
              <ReadinessComponent label="Sleep" value={readinessDetail.sleep_hours != null ? `${readinessDetail.sleep_hours} hr` : readinessDetail.sleep_quality} />
              <ReadinessComponent label="Energy" value={readinessDetail.energy} />
              <ReadinessComponent label="Soreness" value={readinessDetail.soreness} />
              <ReadinessComponent label="Stress" value={readinessDetail.stress} />
            </View>
          ) : readinessDetailLoading ? <Text style={styles.loadingText}>Loading latest Session check-in components…</Text> : null}
          <ScrollView contentContainerStyle={styles.observationList} showsVerticalScrollIndicator={false}>
            {readinessHistory.length ? [...readinessHistory].reverse().map((point) => {
              const weight = bodyweightObservations.find((observation) => observation.date === point.date);
              return (
                <View key={`${point.date}-${point.score}`} style={styles.observationRow}>
                  <View><Text style={styles.observationDate}>{shortDate(point.date)}</Text><Text style={styles.observationMeta}>{weight ? `Reported Bodyweight · ${formatWeightFromKg(weight.reported_bodyweight_kg, displayUnit)}` : 'Readiness observation'}</Text></View>
                  <Text style={styles.observationScore}>{point.score.toFixed(1)}</Text>
                </View>
              );
            }) : <Text style={styles.emptyText}>No recent readiness observations are available.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

function QuickAction({ icon, label, onPress, primary = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <Ionicons color={primary ? COACH_V2.violetBright : COACH_V2.text} name={icon} size={22} />
      <Text numberOfLines={1} style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ action, onAction, title }: { action?: string; onAction?: () => void; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? <Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

function StatusCard({ accessibilityLabel, accent, children, label, onPress, subtitle, value }: {
  accessibilityLabel?: string;
  accent: string;
  children: React.ReactNode;
  label: string;
  onPress?: () => void;
  subtitle?: string | null;
  value: string;
}) {
  const content = (
    <>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statusValue}>{value}</Text>
      {subtitle ? <Text numberOfLines={2} style={styles.statusSubtitle}>{subtitle}</Text> : null}
      <View style={styles.statusTrend}>{children}</View>
      <View style={[styles.statusAccent, { backgroundColor: accent }]} />
    </>
  );
  if (onPress) {
    return <Pressable accessibilityLabel={accessibilityLabel || label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.statusCard, pressed && styles.pressed]}>{content}</Pressable>;
  }
  return <View style={styles.statusCard}>{content}</View>;
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.sessionMetric}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.sessionMetricValue}>{value}</Text><Text style={styles.sessionMetricLabel}>{label}</Text></View>;
}

function HighlightCard({ accent, icon, label, value }: { accent: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={[styles.highlightCard, { borderColor: `${accent}45`, backgroundColor: `${accent}0C` }]}>
      <Ionicons color={accent} name={icon} size={22} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.highlightValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.highlightLabel}>{label}</Text>
    </View>
  );
}

function ActivityRow({ date, detail, icon, title }: { date?: string | null; detail?: string | null; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}><Ionicons color={COACH_V2.violetBright} name={icon} size={18} /></View>
      <View style={styles.activityCopy}><Text numberOfLines={1} style={styles.activityTitle}>{title}</Text>{detail ? <Text numberOfLines={2} style={styles.activityDetail}>{detail}</Text> : null}</View>
      {date ? <Text style={styles.activityDate}>{formatCoachRelativeDate(date)}</Text> : null}
    </View>
  );
}

function ReadinessComponent({ label, value }: { label: string; value?: number | string | null }) {
  if (value == null) return null;
  return <View style={styles.componentCard}><Text style={styles.componentValue}>{String(value)}</Text><Text style={styles.componentLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  sheetActions: { position: 'absolute', zIndex: 2, top: 17, right: 10, flexDirection: 'row', gap: 7 },
  roundButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 14, padding: 14, paddingTop: 8 },
  hero: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: COACH_V2.borderStrong, padding: 10, paddingTop: 8 },
  identity: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 19, paddingRight: 78 },
  identityCopy: { flex: 1, minWidth: 0, gap: 5 },
  athleteName: { color: COACH_V2.text, fontSize: 24, lineHeight: 29, fontWeight: '700' },
  programLine: { color: COACH_V2.muted, fontSize: 12, lineHeight: 17 },
  quickActions: { marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  quickAction: { minWidth: 50, flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6 },
  quickActionLabel: { color: COACH_V2.text, fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  attentionCard: { minHeight: 92, overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: `${COACH_V2.magenta}66`, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  attentionIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: `${COACH_V2.magenta}15`, alignItems: 'center', justifyContent: 'center' },
  attentionCopy: { flex: 1, minWidth: 0, gap: 5 },
  attentionEyebrow: { color: COACH_V2.magenta, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  attentionTitle: { color: COACH_V2.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  attentionMeta: { color: COACH_V2.muted, fontSize: 10 },
  horizonCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, borderWidth: 1, borderColor: `${COACH_V2.gold}44`, backgroundColor: COACH_V2.surface, padding: 12 },
  horizonCopy: { flex: 1, gap: 4 },
  horizonLabel: { color: COACH_V2.gold, fontSize: 9, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  horizonText: { color: COACH_V2.text, fontSize: 12, fontWeight: '700' },
  sectionTitleRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: COACH_V2.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionAction: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '700' },
  statusGrid: { flexDirection: 'row', gap: 7 },
  statusCard: { minHeight: 142, flex: 1, overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 10 },
  statusLabel: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '900', letterSpacing: 0.35, textTransform: 'uppercase' },
  statusValue: { marginTop: 8, color: COACH_V2.text, fontSize: 19, fontWeight: '700' },
  statusSubtitle: { marginTop: 3, minHeight: 23, color: COACH_V2.muted, fontSize: 8, lineHeight: 11 },
  statusTrend: { marginTop: 'auto', height: 34 },
  statusAccent: { position: 'absolute', left: 10, bottom: 8, width: 16, height: 2, borderRadius: 1 },
  focusCard: { minHeight: 142, flex: 1, overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 8, alignItems: 'center' },
  focusImage: { width: '100%', height: 87 },
  focusLabel: { marginTop: 4, color: COACH_V2.text, fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
  lastSessionCard: { borderRadius: 13, borderWidth: 1, borderColor: COACH_V2.borderStrong, backgroundColor: COACH_V2.surface, overflow: 'hidden', padding: 11 },
  lastSessionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lastSessionArtwork: { width: 66, height: 66, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#050609' },
  lastSessionImage: { width: '100%', height: '100%' },
  lastSessionCopy: { flex: 1, minWidth: 0 },
  lastSessionTitle: { color: COACH_V2.text, fontSize: 18, fontWeight: '800' },
  lastSessionMeta: { marginTop: 4, color: COACH_V2.muted, fontSize: 11 },
  sessionMetrics: { marginTop: 12, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border },
  sessionMetric: { minHeight: 56, flex: 1, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: COACH_V2.border, paddingHorizontal: 4 },
  sessionMetricValue: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  sessionMetricLabel: { marginTop: 3, color: COACH_V2.subtle, fontSize: 8, textTransform: 'uppercase' },
  performedFocus: { marginTop: 10, color: COACH_V2.violetBright, fontSize: 9, fontWeight: '700' },
  movementList: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  movementPill: { width: '48%', minHeight: 59, borderRadius: 8, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#11131B', padding: 7 },
  movementName: { color: COACH_V2.text, fontSize: 10, fontWeight: '800' },
  movementEquipment: { marginTop: 3, color: COACH_V2.violetBright, fontSize: 8 },
  movementEvidence: { marginTop: 4, color: COACH_V2.muted, fontSize: 8 },
  evidenceFallback: { marginTop: 11, color: COACH_V2.muted, fontSize: 10 },
  sessionOpenRow: { minHeight: 38, marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  sessionOpenText: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '800' },
  emptyCard: { borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 16 },
  emptyText: { color: COACH_V2.muted, fontSize: 11 },
  upcomingCard: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface },
  upcomingRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COACH_V2.border, paddingHorizontal: 10 },
  upcomingRowLast: { borderBottomWidth: 0 },
  upcomingDate: { width: 56 },
  upcomingDateText: { color: COACH_V2.violetBright, fontSize: 9, fontWeight: '800' },
  upcomingCopy: { flex: 1, minWidth: 0, gap: 3 },
  upcomingTitle: { color: COACH_V2.text, fontSize: 12, fontWeight: '800' },
  upcomingMeta: { color: COACH_V2.muted, fontSize: 9 },
  scheduleButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  activityCard: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface },
  activityRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COACH_V2.border, padding: 10 },
  activityIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: `${COACH_V2.violetBright}15`, alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1, minWidth: 0, gap: 3 },
  activityTitle: { color: COACH_V2.text, fontSize: 11, fontWeight: '800' },
  activityDetail: { color: COACH_V2.muted, fontSize: 9, lineHeight: 13 },
  activityDate: { color: COACH_V2.subtle, fontSize: 8 },
  highlightGrid: { flexDirection: 'row', gap: 6 },
  highlightCard: { minHeight: 90, flex: 1, borderRadius: 10, borderWidth: 1, padding: 9 },
  highlightValue: { marginTop: 8, color: COACH_V2.text, fontSize: 18, fontWeight: '700' },
  highlightLabel: { marginTop: 3, color: COACH_V2.muted, fontSize: 8 },
  notesCard: { minHeight: 84, flexDirection: 'row', gap: 10, borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 12 },
  notesCopy: { flex: 1, minWidth: 0 },
  notesTitle: { color: COACH_V2.text, fontSize: 12, fontWeight: '800' },
  notesText: { marginTop: 5, color: COACH_V2.muted, fontSize: 11, lineHeight: 16 },
  retryCard: { borderRadius: 9, borderWidth: 1, borderColor: `${COACH_V2.magenta}66`, backgroundColor: `${COACH_V2.magenta}0C`, padding: 11 },
  retryText: { color: COACH_V2.magenta, fontSize: 10 },
  loadingText: { color: COACH_V2.subtle, fontSize: 10, textAlign: 'center' },
  primaryCta: { minHeight: 55, overflow: 'hidden', borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryCtaText: { color: COACH_V2.text, fontSize: 14, fontWeight: '900' },
  detailBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.76)' },
  detailSheet: { maxHeight: '74%', minHeight: '58%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: COACH_V2.borderStrong, backgroundColor: COACH_V2.black, padding: 14 },
  detailHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#5C6070' },
  detailHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailEyebrow: { color: COACH_V2.violetBright, fontSize: 9, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  detailTitle: { marginTop: 4, color: COACH_V2.text, fontSize: 18, fontWeight: '800' },
  detailTrendCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 12 },
  detailScore: { marginTop: 5, color: COACH_V2.text, fontSize: 28, fontWeight: '800' },
  detailTrendText: { marginTop: 4, color: COACH_V2.muted, fontSize: 9 },
  detailSparkline: { flex: 1, height: 54 },
  componentGrid: { marginTop: 10, flexDirection: 'row', gap: 7 },
  componentCard: { minHeight: 58, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface },
  componentValue: { color: COACH_V2.text, fontSize: 16, fontWeight: '800' },
  componentLabel: { marginTop: 3, color: COACH_V2.subtle, fontSize: 8, textTransform: 'uppercase' },
  observationList: { gap: 7, paddingTop: 12, paddingBottom: 8 },
  observationRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 9, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, paddingHorizontal: 11 },
  observationDate: { color: COACH_V2.text, fontSize: 11, fontWeight: '800' },
  observationMeta: { marginTop: 3, color: COACH_V2.muted, fontSize: 9 },
  observationScore: { color: COACH_V2.cyan, fontSize: 18, fontWeight: '800' },
});
