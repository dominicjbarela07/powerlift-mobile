import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoachAthleteHubSheet } from '@/components/coach-mobile/CoachAthleteHubSheet';
import type { CompletedSessionRecapPayload } from '@/components/coach-mobile/CompletedSessionRecap';
import {
  CoachBrandHeader,
  CoachCardChevron,
  CoachMetricTile,
  CoachSectionHeading,
  CoachSparkline,
  CoachStatusBadge,
  COACH_V2,
} from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLAthleteAvatar, SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { canonicalAccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import { fetchJson } from '@/lib/api';
import {
  athleteTrainingLabel,
  coachKpiAthletes,
  coachTodaySessions,
  type CoachCommandCenterKpi,
  deriveCoachHomeFromRoster,
  formatCoachRelativeDate,
  formatCoachVolume,
  formatCoachWeight,
  mergeCoachHomeWithRoster,
  sortCoachCommandCenterAthletes,
} from '@/lib/coach-mobile-v2';
import type {
  CoachHomeResponse,
  CoachAthleteSummaryResponse,
  CoachRecentTrainingSession,
  CoachRosterAthlete,
  CoachRosterResponse,
} from '@/lib/coach-mobile';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate(now: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
}

function normalizeAthlete(athlete: CoachRosterAthlete): CoachRosterAthlete {
  return { ...athlete, ...normalizeProfilePhotoPayload(athlete) };
}

function normalizeHome(payload: CoachHomeResponse): CoachHomeResponse {
  return {
    ...payload,
    attention_athletes: (payload.attention_athletes || []).map(normalizeAthlete),
    athletes: payload.athletes?.map(normalizeAthlete),
    recent_activity: (payload.recent_activity || []).map((activity) => ({
      ...activity,
      athlete: { ...activity.athlete, ...normalizeProfilePhotoPayload(activity.athlete) },
    })),
  };
}

export function CoachHomeV2({
  previewCoachName,
  previewData,
  previewInitiallySelectedAthleteId,
  previewRecaps,
  previewSummaries,
}: {
  previewCoachName?: string;
  previewData?: CoachHomeResponse;
  previewInitiallySelectedAthleteId?: number;
  previewRecaps?: Record<number, CompletedSessionRecapPayload>;
  previewSummaries?: Record<number, CoachAthleteSummaryResponse>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const accountKey = user?.email || String(user?.athlete_id || '');
  const accountKeyRef = useRef(accountKey);
  const requestRef = useRef(0);
  const previewMode = Boolean(previewData);
  const [data, setData] = useState<CoachHomeResponse | null>(previewData ? normalizeHome(previewData) : null);
  const [loading, setLoading] = useState(!previewData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<CoachRosterAthlete | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<CoachCommandCenterKpi | null>(null);
  const today = useMemo(() => new Date(), []);
  const firstName = useMemo(() => {
    const name = String(user?.user_name || '').trim();
    return previewCoachName || name.split(/\s+/)[0] || String(user?.email || '').split('@')[0] || 'Coach';
  }, [previewCoachName, user?.email, user?.user_name]);

  useEffect(() => {
    accountKeyRef.current = accountKey;
    requestRef.current += 1;
    setSelectedAthlete(null);
    if (!previewMode) setData(null);
  }, [accountKey, previewMode]);

  useEffect(() => {
    if (previewData) {
      setData(normalizeHome(previewData));
      setLoading(false);
    }
  }, [previewData]);

  useEffect(() => {
    if (!previewInitiallySelectedAthleteId || !previewData) return;
    const athlete = (previewData.athletes || previewData.attention_athletes || [])
      .find((item) => item.id === previewInitiallySelectedAthleteId);
    if (athlete) setSelectedAthlete(normalizeAthlete(athlete));
  }, [previewData, previewInitiallySelectedAthleteId]);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (previewMode) return;
    const requestAccount = accountKey;
    const sequence = ++requestRef.current;
    const current = () => accountKeyRef.current === requestAccount && requestRef.current === sequence;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const homeResponse = await fetchJson('/coach/mobile/home', { method: 'GET' });
      if (!current()) return;
      if (homeResponse.status === 401) {
        router.replace('/login');
        return;
      }

      let payload = homeResponse.json as CoachHomeResponse | null;
      if (homeResponse.status === 404) {
        const rosterResponse = await fetchJson('/coach/mobile/roster', { method: 'GET' });
        const roster = rosterResponse.json as CoachRosterResponse | null;
        if (!current()) return;
        if (!rosterResponse.ok || !roster?.ok) {
          setError(roster?.error || `Could not load Coach Home. (${rosterResponse.status})`);
          return;
        }
        payload = deriveCoachHomeFromRoster(roster);
      } else {
        if (!homeResponse.ok || !payload?.ok) {
          setError(payload?.error || `Could not load Coach Home. (${homeResponse.status})`);
          return;
        }
        // Home remains a bounded attention projection. The relationship-scoped
        // roster supplies the horizontal command-center rail in one batch.
        const rosterResponse = await fetchJson('/coach/mobile/roster', { method: 'GET' });
        const roster = rosterResponse.json as CoachRosterResponse | null;
        if (!current()) return;
        if (rosterResponse.ok && roster?.ok) payload = mergeCoachHomeWithRoster(payload, roster);
      }

      if (!current() || !payload?.ok) return;
      setData(normalizeHome(payload));
    } catch (loadError) {
      if (!current()) return;
      console.warn('Coach Command Center load failed', loadError);
      setError('Network error. Pull to refresh or try again.');
    } finally {
      if (current()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [accountKey, previewMode, router]);

  useFocusEffect(useCallback(() => {
    if (!selectedAthlete && !selectedKpi) void load({ silent: true });
  }, [load, selectedAthlete, selectedKpi]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !selectedAthlete && !selectedKpi) void load({ silent: true });
    });
    return () => subscription.remove();
  }, [load, selectedAthlete, selectedKpi]);

  const athletes = useMemo(() => sortCoachCommandCenterAthletes(data?.athletes?.length ? data.athletes : data?.attention_athletes || []), [data]);
  const todaysSessions = useMemo(() => coachTodaySessions(athletes, today), [athletes, today]);

  const openSession = useCallback((session: CoachRecentTrainingSession) => {
    router.push({
      pathname: '/(tabs)/workout/[workoutId]',
      params: {
        workoutId: String(session.workout_id),
        ...(session.evidence_mode === 'performed' ? { athleteView: 'coach-preview' } : {}),
      },
    } as any);
  }, [router]);

  if (loading && !data) {
    return <SLScreen edges="top" padded={false}><SLLoadingState message="Building today’s coaching command center." title="Loading Coach Home" /></SLScreen>;
  }

  return (
    <SLScreen edges="top" padded={false} style={styles.screen}>
      <CoachBrandHeader
        briefIcon="calendar-outline"
        briefLabel="Open Coach Calendar"
        onBrief={() => router.push('/(tabs)/coach-calendar')}
        onSettings={() => router.push('/(tabs)/settings')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={COACH_V2.violet} onRefresh={() => load({ silent: true })} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <View style={styles.greetingCopy}>
            <Text style={styles.greetingEyebrow}>{greeting(today)}, Coach</Text>
            <Text numberOfLines={1} style={styles.greetingName}>{firstName}</Text>
          </View>
          <Pressable accessibilityLabel="Open today in Coach Calendar" accessibilityRole="button" onPress={() => router.push('/(tabs)/coach-calendar')} style={styles.dateButton}>
            <View><Text style={styles.dateLabel}>Today</Text><Text style={styles.dateValue}>{longDate(today)}</Text></View>
            <Ionicons color={COACH_V2.text} name="chevron-down" size={17} />
          </Pressable>
        </View>

        {error ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load()} title="Coach Home unavailable" /> : null}

        {data ? (
          <>
            <View style={styles.metrics}>
              <CoachMetricTile color={COACH_V2.green} icon="barbell-outline" label="Sessions" onPress={() => setSelectedKpi('sessions')} value={todaysSessions.length} />
              <CoachMetricTile color={COACH_V2.violetBright} icon="clipboard-outline" label="Reviews" onPress={() => setSelectedKpi('reviews')} value={data.summary.reviews} />
              <CoachMetricTile color={COACH_V2.gold} icon="calendar-outline" label="Programming" onPress={() => setSelectedKpi('programming')} value={data.summary.programming} />
              <CoachMetricTile color={COACH_V2.cyan} icon="checkbox-outline" label="Check-Ins" onPress={() => setSelectedKpi('check_ins')} value={data.summary.check_ins} />
            </View>

            <View style={styles.section}>
              <CoachSectionHeading action="View all" onAction={() => router.push('/(tabs)/coach-roster')} title="Your Athletes at a Glance" />
              {athletes.length ? (
                <ScrollView contentContainerStyle={styles.athleteRail} horizontal showsHorizontalScrollIndicator={false}>
                  {athletes.map((athlete) => <AthleteOverviewCard athlete={athlete} key={athlete.id} onPress={() => setSelectedAthlete(athlete)} />)}
                </ScrollView>
              ) : <EmptyCard icon="people-outline" text="No active athlete relationships are available." />}
            </View>

            <View style={styles.section}>
              <CoachSectionHeading action="View calendar" onAction={() => router.push('/(tabs)/coach-calendar')} title="Today’s Sessions" />
              {todaysSessions.length ? todaysSessions.map(({ athlete, session }) => (
                <Pressable accessibilityLabel={`Open ${athlete.name} ${session.label}`} accessibilityRole="button" key={`${athlete.id}-${session.workout_id}`} onPress={() => openSession(session)} style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}>
                  <SLAthleteAvatar imageUrl={athlete.profilePhotoUrl} imageVersion={athlete.profilePhotoVersion} name={athlete.name} size={42} />
                  <View style={styles.sessionCopy}>
                    <Text numberOfLines={1} style={styles.sessionName}>{session.label}</Text>
                    <Text numberOfLines={1} style={styles.sessionAthlete}>{athlete.name}</Text>
                  </View>
                  <CoachStatusBadge label={session.evidence_mode === 'performed' ? 'Completed' : 'Upcoming'} tone={session.evidence_mode === 'performed' ? 'success' : 'cyan'} />
                  <CoachCardChevron />
                </Pressable>
              )) : <EmptyCard icon="calendar-outline" text="No Sessions are scheduled for today." />}
            </View>

            <View style={styles.section}>
              <CoachSectionHeading action="View all" onAction={() => router.push('/(tabs)/coach-roster')} title="Recent Activity Feed" />
              {data.recent_activity.length ? data.recent_activity.map((activity) => (
                <Pressable accessibilityLabel={`Open ${activity.athlete.name} completed Session`} accessibilityRole="button" key={`${activity.athlete.id}-${activity.session.workout_id}`} onPress={() => openSession(activity.session)} style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}>
                  <SLAthleteAvatar imageUrl={(activity.athlete as any).profilePhotoUrl} imageVersion={(activity.athlete as any).profilePhotoVersion} name={activity.athlete.name} size={42} />
                  <View style={styles.activityCopy}>
                    <Text numberOfLines={1} style={styles.activityHeadline}>{activity.athlete.name} completed {activity.session.label}</Text>
                    <Text numberOfLines={1} style={styles.activityEvidence}>
                      {[activity.session.set_count ? `${activity.session.set_count} sets` : null, formatCoachVolume(activity.session.total_volume_kg), activity.session.pr_count ? `${activity.session.pr_count} PR${activity.session.pr_count === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'Performed evidence recorded'}
                    </Text>
                  </View>
                  <Text style={styles.activityDate}>{formatCoachRelativeDate(activity.session.date)}</Text>
                  <CoachCardChevron />
                </Pressable>
              )) : <EmptyCard icon="pulse-outline" text="Completed Session activity will appear here." />}
            </View>
          </>
        ) : null}
        <View style={styles.bottomSpace} />
      </ScrollView>

      <CoachKpiSheet
        athletes={athletes}
        kind={selectedKpi}
        onClose={() => setSelectedKpi(null)}
        onOpenAthlete={(athlete) => {
          setSelectedKpi(null);
          setTimeout(() => setSelectedAthlete(athlete), 0);
        }}
        onOpenSession={(session) => {
          setSelectedKpi(null);
          setTimeout(() => openSession(session), 0);
        }}
        today={today}
      />
      <CoachAthleteHubSheet
        athlete={selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
        previewRecap={selectedAthlete ? previewRecaps?.[selectedAthlete.id] : null}
        previewSummary={selectedAthlete ? previewSummaries?.[selectedAthlete.id] : null}
      />
    </SLScreen>
  );
}

function AthleteOverviewCard({ athlete, onPress }: { athlete: CoachRosterAthlete; onPress: () => void }) {
  const recent = (athlete.recent_training || []).find((session) => session.evidence_mode === 'performed');
  const focusId = recent?.muscle_focus?.primary?.[0]?.muscle_id;
  const focusAsset = accessoryMuscleRegionAsset(canonicalAccessoryMuscleRegionKey(focusId));
  const readinessColor = athlete.readiness.score != null && athlete.readiness.score < 3 ? COACH_V2.magenta : COACH_V2.green;
  return (
    <Pressable accessibilityLabel={`Open ${athlete.name} Athlete Hub`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.athleteCard, athlete.status.classification === 'needs_attention' && styles.athleteCardAttention, pressed && styles.pressed]}>
      <View style={styles.athleteTop}>
        <SLAthleteAvatar imageUrl={athlete.profilePhotoUrl} imageVersion={athlete.profilePhotoVersion} name={athlete.name} size={43} statusColor={athlete.status.classification === 'needs_attention' ? COACH_V2.magenta : COACH_V2.green} />
        <Text numberOfLines={2} style={styles.athleteName}>{athlete.name}</Text>
      </View>
      <CoachStatusBadge label={athlete.status.label} tone={toneForAthlete(athlete)} />
      <Text numberOfLines={1} style={styles.athleteTraining}>{athleteTrainingLabel(athlete)}</Text>
      <View style={styles.readinessRow}>
        <View><Text style={styles.athleteMetricLabel}>Readiness</Text><Text style={[styles.athleteMetricValue, { color: readinessColor }]}>{athlete.readiness.score == null ? '—' : athlete.readiness.score.toFixed(1)}</Text></View>
        <View style={styles.athleteSpark}><CoachSparkline color={readinessColor} values={(athlete.readiness.history || []).map((point) => point.score)} /></View>
      </View>
      <Text style={styles.athleteMetricLabel}>Last Session</Text>
      <Text numberOfLines={1} style={styles.athleteLastSession}>{recent?.label || 'No completed Session'}</Text>
      <View style={styles.athleteEvidenceRow}>
        <Text numberOfLines={1} style={styles.athleteEvidence}>{recent ? [recent.pr_count ? `${recent.pr_count} PR${recent.pr_count === 1 ? '' : 's'}` : null, formatCoachVolume(recent.total_volume_kg, athlete.preferred_units)].filter(Boolean).join(' · ') || 'Performed' : '—'}</Text>
        {focusId ? <Image resizeMode="contain" source={focusAsset.source} style={styles.athleteFocus} /> : null}
      </View>
    </Pressable>
  );
}

function toneForAthlete(athlete: CoachRosterAthlete) {
  if (athlete.status.tone === 'danger') return 'danger' as const;
  if (athlete.status.tone === 'warning') return 'warning' as const;
  return 'success' as const;
}

function EmptyCard({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.emptyCard}><Ionicons color={COACH_V2.muted} name={icon} size={21} /><Text style={styles.emptyText}>{text}</Text></View>;
}

function CoachKpiSheet({ athletes, kind, onClose, onOpenAthlete, onOpenSession, today }: { athletes: CoachRosterAthlete[]; kind: CoachCommandCenterKpi | null; onClose: () => void; onOpenAthlete: (athlete: CoachRosterAthlete) => void; onOpenSession: (session: CoachRecentTrainingSession) => void; today: Date }) {
  const insets = useSafeAreaInsets();
  if (!kind) return null;
  const labels: Record<CoachCommandCenterKpi, { title: string; empty: string }> = {
    sessions: { title: 'Today’s Sessions', empty: 'No Sessions are scheduled for today.' },
    reviews: { title: 'Reviews Waiting', empty: 'No athlete reviews are waiting.' },
    programming: { title: 'Programming Due', empty: 'No athlete programming is due.' },
    check_ins: { title: 'Check-Ins', empty: 'No check-ins need attention.' },
  };
  const items = coachKpiAthletes(athletes, kind, today);
  const sessions = coachTodaySessions(athletes, today);
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible>
      <View style={styles.kpiBackdrop}>
        <Pressable accessibilityLabel="Close KPI detail" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.kpiSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.kpiHandle} />
          <View style={styles.kpiHeader}>
            <View><Text style={styles.kpiEyebrow}>Coach Command Center</Text><Text style={styles.kpiTitle}>{labels[kind].title}</Text></View>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.kpiClose}><Ionicons color={COACH_V2.text} name="close" size={22} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.kpiList} showsVerticalScrollIndicator={false}>
            {kind === 'sessions' && sessions.length ? sessions.map(({ athlete, session }) => (
              <Pressable accessibilityRole="button" key={`${athlete.id}-${session.workout_id}`} onPress={() => onOpenSession(session)} style={({ pressed }) => [styles.kpiRow, pressed && styles.pressed]}>
                <SLAthleteAvatar imageUrl={athlete.profilePhotoUrl} imageVersion={athlete.profilePhotoVersion} name={athlete.name} size={44} />
                <View style={styles.kpiRowCopy}><Text style={styles.kpiRowName}>{session.label}</Text><Text numberOfLines={1} style={styles.kpiRowMeta}>{athlete.name} · {session.evidence_mode === 'performed' ? 'Completed' : 'Upcoming'}</Text></View>
                <CoachStatusBadge label={session.evidence_mode === 'performed' ? 'Completed' : 'Upcoming'} tone={session.evidence_mode === 'performed' ? 'success' : 'cyan'} />
                <CoachCardChevron />
              </Pressable>
            )) : kind !== 'sessions' && items.length ? items.map((athlete) => (
              <Pressable accessibilityRole="button" key={athlete.id} onPress={() => onOpenAthlete(athlete)} style={({ pressed }) => [styles.kpiRow, pressed && styles.pressed]}>
                <SLAthleteAvatar imageUrl={athlete.profilePhotoUrl} imageVersion={athlete.profilePhotoVersion} name={athlete.name} size={44} />
                <View style={styles.kpiRowCopy}><Text style={styles.kpiRowName}>{athlete.name}</Text><Text numberOfLines={1} style={styles.kpiRowMeta}>{kpiAthleteContext(athlete, kind)}</Text></View>
                <CoachCardChevron />
              </Pressable>
            )) : <EmptyCard icon="checkmark-circle-outline" text={labels[kind].empty} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function kpiAthleteContext(athlete: CoachRosterAthlete, kind: Exclude<CoachCommandCenterKpi, 'sessions'>) {
  if (kind === 'reviews') {
    const count = Number(athlete.pending_video_reviews?.count || 0) + Number(athlete.pending_session_reviews?.count || 0);
    return `${count} review${count === 1 ? '' : 's'} waiting · ${athleteTrainingLabel(athlete)}`;
  }
  if (kind === 'programming') {
    const days = athlete.programming_horizon?.days_remaining;
    return `${days == null ? 'Programming horizon available' : `${days} day${days === 1 ? '' : 's'} remaining`} · ${athleteTrainingLabel(athlete)}`;
  }
  return [
    athlete.readiness.score == null ? null : `Readiness ${athlete.readiness.score.toFixed(1)}`,
    athlete.reported_bodyweight?.latest ? formatCoachWeight(athlete.reported_bodyweight.latest.reported_bodyweight_kg, athlete.preferred_units) : null,
    athlete.readiness.date ? formatCoachRelativeDate(athlete.readiness.date) : null,
  ].filter(Boolean).join(' · ') || 'Check-in context available';
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COACH_V2.black },
  content: { gap: 14, paddingTop: 12 },
  greetingRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  greetingCopy: { flex: 1, minWidth: 0 },
  greetingEyebrow: { color: COACH_V2.muted, fontSize: 12 },
  greetingName: { marginTop: 2, color: COACH_V2.text, fontSize: 22, lineHeight: 25, fontWeight: '700' },
  dateButton: { minWidth: 125, minHeight: 52, borderRadius: 9, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 11 },
  dateLabel: { color: COACH_V2.subtle, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  dateValue: { marginTop: 3, color: COACH_V2.text, fontSize: 11, fontWeight: '700' },
  metrics: { flexDirection: 'row', gap: 6 },
  section: { gap: 7 },
  athleteRail: { gap: 8, paddingRight: 2 },
  athleteCard: { width: 155, minHeight: 244, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 10 },
  athleteCardAttention: { borderColor: `${COACH_V2.magenta}77` },
  athleteTop: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  athleteName: { flex: 1, color: COACH_V2.text, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  athleteTraining: { marginTop: 8, color: COACH_V2.muted, fontSize: 10 },
  readinessRow: { marginTop: 10, minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 5 },
  athleteMetricLabel: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  athleteMetricValue: { marginTop: 3, fontSize: 16, fontWeight: '800' },
  athleteSpark: { flex: 1, height: 36 },
  athleteLastSession: { marginTop: 4, color: COACH_V2.text, fontSize: 11, fontWeight: '700' },
  athleteEvidenceRow: { marginTop: 'auto', minHeight: 46, flexDirection: 'row', alignItems: 'flex-end' },
  athleteEvidence: { flex: 1, color: COACH_V2.green, fontSize: 9, fontWeight: '700' },
  athleteFocus: { width: 43, height: 43 },
  sessionRow: { minHeight: 66, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9 },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionName: { color: COACH_V2.text, fontSize: 13, fontWeight: '800' },
  sessionAthlete: { marginTop: 3, color: COACH_V2.muted, fontSize: 10 },
  activityCard: { minHeight: 68, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9 },
  activityCopy: { flex: 1, minWidth: 0 },
  activityHeadline: { color: COACH_V2.text, fontSize: 12, fontWeight: '800' },
  activityEvidence: { marginTop: 4, color: COACH_V2.green, fontSize: 9, fontWeight: '700' },
  activityDate: { color: COACH_V2.subtle, fontSize: 9 },
  emptyCard: { minHeight: 70, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  emptyText: { flex: 1, color: COACH_V2.muted, fontSize: 11 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
  bottomSpace: { height: 84 },
  kpiBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  kpiSheet: { maxHeight: '72%', minHeight: '42%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: COACH_V2.borderStrong, backgroundColor: COACH_V2.black, padding: 14 },
  kpiHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#5C6070' },
  kpiHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiEyebrow: { color: COACH_V2.violetBright, fontSize: 9, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  kpiTitle: { marginTop: 4, color: COACH_V2.text, fontSize: 22, fontWeight: '700' },
  kpiClose: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, alignItems: 'center', justifyContent: 'center' },
  kpiList: { gap: 7, paddingBottom: 10 },
  kpiRow: { minHeight: 66, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  kpiRowCopy: { flex: 1, minWidth: 0 },
  kpiRowName: { color: COACH_V2.text, fontSize: 13, fontWeight: '800' },
  kpiRowMeta: { marginTop: 3, color: COACH_V2.muted, fontSize: 10 },
});
