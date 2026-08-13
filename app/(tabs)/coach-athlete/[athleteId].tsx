import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { CoachMaterialLayer } from '@/components/coach-mobile/coach-material-layer';
import RefreshScreen from '@/components/refresh-screen';
import {
  SLErrorState,
  SLLoadingState,
  SLScreen,
  SLAthleteAvatar,
} from '@/components/ui';
import { SLColors, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import {
  normalizeCoachAttentionReasons,
  openCoachDestination,
  type CoachAttentionReason,
  type CoachTrainingContext,
} from '@/lib/coach-mobile';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';

type AthleteIdentity = {
  id: number;
  name: string;
  avatar_url?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
  sex?: string | null;
  bodyweight?: number | null;
  is_self?: boolean;
};

type WorkoutSummary = {
  workout_id: number;
  label: string;
  date?: string | null;
  status?: string | null;
  block_name?: string | null;
  submitted_at?: string | null;
  reviewed?: boolean;
  reviewed_at?: string | null;
};

type VideoReviewItem = {
  attachment_id: number;
  workout_id?: number | null;
  label: string;
  lift?: string | null;
  movement_name?: string | null;
  review_status?: string | null;
  session_date?: string | null;
  created_at?: string | null;
};

type SessionReviewItem = {
  workout_id: number;
  label: string;
  date?: string | null;
  submitted_at?: string | null;
  survey?: {
    rpe?: number | null;
    strength?: number | null;
    fatigue?: number | null;
    notes_preview?: string | null;
  } | null;
};

type AthleteCommandSummary = {
  ok: boolean;
  generated_at?: string;
  athlete: AthleteIdentity;
  operational_status: {
    primary_status?: string;
    label: string;
    tone?: string | null;
    reasons: CoachAttentionReason[];
  };
  current_training?: CoachTrainingContext;
  readiness?: {
    score?: number | null;
    date?: string | null;
    label: string;
  };
  queue_membership?: string[];
  programming_horizon: {
    programmed_through_date?: string | null;
    days_remaining?: number | null;
    status?: string | null;
    status_label?: string | null;
  };
  last_completed_session: WorkoutSummary | null;
  next_assigned_session: WorkoutSummary | null;
  pending_video_reviews: {
    count: number;
    items: VideoReviewItem[];
  };
  pending_session_reviews: {
    count: number;
    items: SessionReviewItem[];
  };
  unread_messages: {
    thread_id?: number | null;
    count: number;
    last_message_at?: string | null;
  } | null;
  meet_context: {
    meet_plan_id: number;
    meet_name?: string | null;
    meet_date?: string | null;
    days_until_meet?: number | null;
  } | null;
  coach_context: {
    pinned_note?: {
      id: number;
      title?: string | null;
      body_preview?: string | null;
      note_type?: string | null;
      updated_at?: string | null;
    } | null;
  };
  quick_actions: {
    message?: boolean;
    create_session?: boolean;
    open_next_session?: boolean;
    duplicate_session?: boolean;
    move_session?: boolean;
    review_video?: boolean;
    review_session_feedback?: boolean;
    open_web?: boolean;
  };
};

type CommandAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: SLStatusTone;
  onPress: () => void;
  meta?: string;
};

const SHEET_MATERIAL = {
  surface: 'rgba(8, 8, 10, 0.46)',
  surfaceSubtle: 'rgba(6, 6, 7, 0.30)',
  surfaceSoft: 'rgba(12, 13, 15, 0.42)',
  hairline: 'rgba(255, 255, 255, 0.052)',
} as const;

const validTones = new Set<SLStatusTone>(['neutral', 'info', 'success', 'warning', 'danger', 'review', 'accent']);

function statusTone(value?: string | null): SLStatusTone {
  return value && validTones.has(value as SLStatusTone) ? (value as SLStatusTone) : 'neutral';
}

function toneColor(tone: SLStatusTone) {
  return SLStatusTones[tone]?.icon ?? SLColors.accentSteel;
}

function formatShortDate(value?: string | null) {
  if (!value) return 'No date';
  const [year, month, day] = value.slice(0, 10).split('-').map((part) => Number(part));
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMeetLine(summary: AthleteCommandSummary) {
  const meet = summary.meet_context;
  if (!meet) return null;
  const days = meet.days_until_meet;
  const date = formatShortDate(meet.meet_date);
  if (typeof days === 'number') {
    if (days === 0) return `Meet today · ${date}`;
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} out · ${date}`;
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} past · ${date}`;
  }
  return meet.meet_name ? `${meet.meet_name} · ${date}` : date;
}

function formatWorkoutMeta(workout: WorkoutSummary | null) {
  if (!workout) return '';
  return [formatShortDate(workout.date), workout.block_name].filter(Boolean).join(' · ');
}

function cleanTitle(value?: string | null, fallback = 'Session') {
  const trimmed = (value || '').trim();
  if (!trimmed) return fallback;
  if (trimmed !== trimmed.toLowerCase()) return trimmed;
  return trimmed.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function reasonTone(severity?: string): SLStatusTone {
  if (severity === 'critical' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'neutral';
}

function queueReasonIcon(reason: CoachAttentionReason): keyof typeof Ionicons.glyphMap {
  if (reason.category === 'programming') return 'calendar-outline';
  if (reason.category === 'reviews') return 'videocam-outline';
  if (reason.category === 'messages') return 'chatbubble-outline';
  if (reason.category === 'check_ins') return 'checkbox-outline';
  if ((reason.reason_type || '').includes('readiness')) return 'pulse-outline';
  return 'alert-circle-outline';
}

function queueActionLabel(reason: CoachAttentionReason) {
  if (reason.category === 'programming') return 'Program';
  if (reason.category === 'reviews') return 'Review';
  if (reason.category === 'messages') return 'Reply';
  if (reason.category === 'check_ins') return 'Check in';
  return 'Open';
}

export default function CoachAthleteWorkspace() {
  const router = useRouter();
  const { user } = useAuth();
  const accountKey = user?.email || (user?.athlete_id ? `athlete:${user.athlete_id}` : null);
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const athleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const fallbackAthleteName = Array.isArray(params.athleteName) ? params.athleteName[0] : params.athleteName;

  const [summary, setSummary] = useState<AthleteCommandSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageOpening, setMessageOpening] = useState(false);
  const accountKeyRef = useRef(accountKey);
  const requestSequenceRef = useRef(0);

  const loadSummary = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!athleteId) {
        setError('Missing athlete.');
        setLoading(false);
        return;
      }
      if (!accountKey) return;
      const requestAccountKey = accountKey;
      const requestSequence = ++requestSequenceRef.current;
      const isCurrentRequest = () => (
        accountKeyRef.current === requestAccountKey
        && requestSequenceRef.current === requestSequence
      );

      if (!silent) setLoading(true);
      setError(null);

      try {
        const resp = await fetchJson<AthleteCommandSummary>(`/coach/mobile/athletes/${athleteId}/summary`, {
          method: 'GET',
        });
        if (!isCurrentRequest()) return;

        if (resp.status === 401) {
          router.replace('/login');
          return;
        }
        if (resp.status === 403 || resp.status === 404) {
          router.replace('/(tabs)/coach-roster');
          return;
        }

        if (!resp.ok || !resp.json?.ok) {
          setError(resp.json && 'error' in resp.json ? String((resp.json as any).error) : `Unable to load athlete (${resp.status}).`);
          return;
        }

        const payload = resp.json;
        const actionableReasons = normalizeCoachAttentionReasons(
          payload.operational_status?.reasons,
          {
            athleteId: payload.athlete?.id || athleteId,
            threadId: payload.unread_messages?.thread_id,
          },
        );
        setSummary({
          ...payload,
          athlete: {
            ...payload.athlete,
            ...normalizeProfilePhotoPayload(payload.athlete),
          },
          operational_status: {
            ...payload.operational_status,
            label: payload.operational_status?.label || 'Status unavailable',
            reasons: actionableReasons,
          },
          programming_horizon: payload.programming_horizon || {},
          pending_video_reviews: {
            count: Number(payload.pending_video_reviews?.count || 0),
            items: Array.isArray(payload.pending_video_reviews?.items)
              ? payload.pending_video_reviews.items
              : [],
          },
          pending_session_reviews: {
            count: Number(payload.pending_session_reviews?.count || 0),
            items: Array.isArray(payload.pending_session_reviews?.items)
              ? payload.pending_session_reviews.items
              : [],
          },
          coach_context: payload.coach_context || {},
          quick_actions: payload.quick_actions || {},
        });
      } catch (err: any) {
        if (!isCurrentRequest()) return;
        setError(err?.message || 'Unable to load athlete.');
      } finally {
        if (isCurrentRequest()) setLoading(false);
      }
    },
    [accountKey, athleteId, router]
  );

  useEffect(() => {
    accountKeyRef.current = accountKey;
    requestSequenceRef.current += 1;
    setSummary(null);
    setError(null);
    setLoading(true);
  }, [accountKey, athleteId]);

  useFocusEffect(useCallback(() => {
    void loadSummary();
  }, [loadSummary]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadSummary({ silent: true });
    });
    return () => subscription.remove();
  }, [loadSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSummary({ silent: true });
    setRefreshing(false);
  }, [loadSummary]);

  const athleteName = summary?.athlete.name || fallbackAthleteName || 'Athlete';

  const openTraining = useCallback(() => {
    if (!athleteId) return;
    router.push({
      pathname: '/(tabs)/workout',
      params: { athleteId: String(athleteId), athleteName },
    } as any);
  }, [athleteId, athleteName, router]);

  const openWorkout = useCallback(
    (workoutId?: number | null) => {
      if (!workoutId) return;
      router.push({
        pathname: '/workout/[workoutId]',
        params: { workoutId: String(workoutId) },
      } as any);
    },
    [router]
  );

  const openMessages = useCallback(async () => {
    const threadId = summary?.unread_messages?.thread_id;
    if (threadId) {
      router.push({
        pathname: '/(tabs)/messages/[threadId]',
        params: { threadId: String(threadId) },
      } as any);
      return;
    }

    if (!athleteId || messageOpening) return;
    setMessageOpening(true);
    try {
      const resp = await fetchJson<{ ok: boolean; thread_id?: number; error?: string }>(
        '/messenger/mobile/threads/ensure-athlete',
        {
          method: 'POST',
          body: JSON.stringify({ athlete_id: Number(athleteId) }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const json = resp.json;
      if (!resp.ok || !json?.ok || !json.thread_id) {
        throw new Error(json?.error || `Could not open messages. (${resp.status})`);
      }
      router.push({
        pathname: '/(tabs)/messages/[threadId]',
        params: { threadId: String(json.thread_id), athleteName },
      } as any);
    } catch (err: any) {
      Alert.alert('Messages unavailable', err?.message || 'Could not open athlete thread.');
      router.push('/(tabs)/messages' as any);
    } finally {
      setMessageOpening(false);
    }
  }, [athleteId, athleteName, messageOpening, router, summary?.unread_messages?.thread_id]);

  const openVideoReview = useCallback(() => {
    router.push('/(tabs)/coach-videos' as any);
  }, [router]);

  const openSessionReviews = useCallback((workoutId?: number | null) => {
    if (!athleteId) {
      router.push('/(tabs)/session-surveys' as any);
      return;
    }
    router.push({
      pathname: '/(tabs)/session-surveys',
      params: {
        athleteId: String(athleteId),
        athleteName,
        ...(workoutId ? { workoutId: String(workoutId) } : {}),
      },
    } as any);
  }, [athleteId, athleteName, router]);

  const openCreateSession = useCallback(() => {
    if (!athleteId) return;
    router.push({
      pathname: '/create-workout',
      params: { athleteId: String(athleteId), athleteName },
    } as any);
  }, [athleteId, athleteName, router]);

  const openCalendar = useCallback(() => {
    router.push('/(tabs)/coach-calendar' as any);
  }, [router]);

  const openHistory = useCallback(() => {
    if (!athleteId) return;
    router.push({
      pathname: '/(tabs)/workout/session-history',
      params: { athleteId: String(athleteId) },
    } as any);
  }, [athleteId, router]);

  const openCheckIns = useCallback(() => {
    if (!athleteId) return;
    router.push({
      pathname: '/(tabs)/check-ins',
      params: { athleteId: String(athleteId) },
    } as any);
  }, [athleteId, router]);

  const addCoachNote = useCallback(() => {
    if (!athleteId) return;
    Alert.prompt(
      `Add note for ${athleteName}`,
      'Coach context',
      async (body) => {
        const noteBody = body?.trim();
        if (!noteBody) return;
        const response = await fetchJson('/coach-utility-dock/notes', {
          method: 'POST',
          body: JSON.stringify({
            athlete_id: Number(athleteId),
            body: noteBody,
            scope: 'athlete',
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        const payload = response.json as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          Alert.alert('Note unavailable', payload?.error || 'Could not save note.');
          return;
        }
        void loadSummary({ silent: true });
      },
      'plain-text',
    );
  }, [athleteId, athleteName, loadSummary]);

  const openMore = useCallback(() => {
    Alert.alert(athleteName, 'More coaching actions', [
      { text: 'Create Training Session', onPress: openCreateSession },
      {
        text: 'Session Reviews',
        onPress: () => openSessionReviews(summary?.pending_session_reviews?.items[0]?.workout_id),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [athleteName, openCreateSession, openSessionReviews, summary?.pending_session_reviews?.items]);

  const coachingTools = useMemo((): CommandAction[] => {
    if (!summary) return [];
    return [
      {
        label: 'Message',
        icon: 'chatbubble-outline',
        tone: 'accent',
        onPress: openMessages,
        meta: summary.unread_messages?.count ? String(summary.unread_messages.count) : undefined,
      },
      {
        label: 'Reviews',
        icon: 'videocam-outline',
        tone: 'review',
        onPress: openVideoReview,
        meta: summary.pending_video_reviews.count
          ? String(summary.pending_video_reviews.count)
          : summary.pending_session_reviews.count
            ? String(summary.pending_session_reviews.count)
            : undefined,
      },
      { label: 'Program', icon: 'calendar-outline', tone: 'accent', onPress: openTraining },
      { label: 'Notes', icon: 'create-outline', tone: 'accent', onPress: addCoachNote },
      { label: 'Calendar', icon: 'today-outline', tone: 'info', onPress: openCalendar },
      { label: 'History', icon: 'time-outline', tone: 'neutral', onPress: openHistory },
      { label: 'Check-in', icon: 'checkbox-outline', tone: 'neutral', onPress: openCheckIns },
      { label: 'More', icon: 'ellipsis-horizontal', tone: 'neutral', onPress: openMore },
    ];
  }, [
    addCoachNote,
    openCalendar,
    openCheckIns,
    openHistory,
    openMessages,
    openMore,
    openTraining,
    openVideoReview,
    summary,
  ]);

  if (loading && !refreshing && !summary) {
    return (
      <SLScreen edges="none">
        <View style={styles.centerState}>
          <SLLoadingState message="Building athlete context..." title="Loading Athlete Workspace" />
        </View>
      </SLScreen>
    );
  }

  return (
    <SLScreen edges="none" padded={false}>
      <RefreshScreen
        contentContainerStyle={styles.scrollContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        style={styles.scroll}
      >
        {error && !summary ? (
          <View style={styles.centerState}>
            <SLErrorState
              actionLabel="Try Again"
              message={error}
              onActionPress={() => loadSummary()}
              title="Could not load athlete"
            />
          </View>
        ) : null}

        {summary ? (
          <>
            <View style={styles.commandHero}>
              <CoachMaterialLayer borderRadius={SLRadius.radiusCard} emphasis="priority" tone="violet" />
              <SLAthleteAvatar
                imageUrl={summary.athlete.profilePhotoUrl}
                imageVersion={summary.athlete.profilePhotoVersion}
                name={summary.athlete.name}
                size={72}
                statusColor={SLStatusTones[statusTone(summary.operational_status.tone)].icon}
              />
              <View style={styles.commandIdentity}>
                <Text style={styles.sectionEyebrow}>
                  {summary.athlete.is_self ? 'Self-Coached Workspace' : 'Coaching Workspace'}
                </Text>
                <Text typographyRole="dynamicName" numberOfLines={1} style={styles.commandName}>
                  {summary.athlete.name}
                </Text>
                <Text numberOfLines={1} style={styles.commandProgram}>
                  {summary.athlete.is_self
                    ? 'Coaching yourself today'
                    : `You’re coaching ${summary.athlete.name.split(' ')[0]}`}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={`More actions for ${summary.athlete.name}`}
                accessibilityRole="button"
                onPress={openMore}
                style={styles.commandHeroMenu}
              >
                <Ionicons color={SLColors.iconPrimary} name="ellipsis-horizontal" size={20} />
              </Pressable>
            </View>

            {error ? (
              <SLErrorState
                actionLabel="Try Again"
                message={error}
                onActionPress={() => loadSummary({ silent: true })}
                title="Refresh failed"
              />
            ) : null}

            <View style={styles.commandSection}>
              <CommandSection
                count={summary.operational_status.reasons.length}
                title="Active Coaching Queue"
              />
              {summary.operational_status.reasons.length > 0 ? (
                <View style={styles.coachingQueue}>
                  <CoachMaterialLayer borderRadius={SLRadius.radiusCard} emphasis="standard" tone="action" />
                  {summary.operational_status.reasons.map((reason, index) => (
                    <View
                      key={`${reason.reason_type}-${reason.source_id ?? index}`}
                      style={styles.attentionDetail}
                    >
                      <View
                        style={[
                          styles.attentionIcon,
                          { borderColor: toneColor(reasonTone(reason.severity)) },
                        ]}
                      >
                        <Ionicons
                          color={toneColor(reasonTone(reason.severity))}
                          name={queueReasonIcon(reason)}
                          size={18}
                        />
                      </View>
                      <View style={styles.attentionDetailCopy}>
                        <Text numberOfLines={1} style={styles.attentionDetailTitle}>
                          {reason.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.attentionDetailText}>
                          {reason.supporting_text
                            ? `${summary.athlete.name} · ${reason.supporting_text}`
                            : summary.athlete.name}
                        </Text>
                      </View>
                      <View style={styles.queueActions}>
                        <Pressable
                          accessibilityLabel={`${queueActionLabel(reason)} ${reason.title}`}
                          accessibilityRole="button"
                          onPress={() => openCoachDestination(router, reason.destination)}
                          style={styles.queueOpenButton}
                        >
                          <Text style={styles.queueOpenText}>{queueActionLabel(reason)}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.healthyCard}>
                  <CoachMaterialLayer borderRadius={SLRadius.radiusControl} emphasis="quiet" tone="on_track" />
                  <Ionicons color={SLColors.success} name="checkmark-circle" size={22} />
                  <View>
                    <Text style={styles.healthyTitle}>No active coaching work</Text>
                    <Text style={styles.healthyText}>Monitor normally.</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.commandSection}>
              <CommandSection title="Coaching Tools" />
              <View style={styles.coachingDock}>
                {coachingTools.map((action) => (
                  <CommandTool action={action} key={action.label} />
                ))}
              </View>
            </View>

            <View style={styles.commandSection}>
              <CommandSection title="Athlete Context" />
              <View style={styles.contextPanel}>
                <CoachMaterialLayer borderRadius={SLRadius.radiusCard} emphasis="quiet" tone="neutral" />
                <CurrentTrainingContext training={summary.current_training} />
                <AthleteContextRow
                  icon="pulse-outline"
                  label="Readiness"
                  tone={summary.readiness?.score == null
                    ? SLColors.textMuted
                    : summary.readiness.score < 3
                      ? SLColors.warning
                      : SLColors.success}
                  value={summary.readiness?.score == null
                    ? 'No readiness entry'
                    : `${summary.readiness.label}${summary.readiness.date ? ` · ${formatShortDate(summary.readiness.date)}` : ''}`}
                />
                <AthleteContextRow
                  icon="barbell-outline"
                  label="Last Training Session"
                  onPress={summary.last_completed_session
                    ? () => openWorkout(summary.last_completed_session?.workout_id)
                    : undefined}
                  tone={SLColors.warning}
                  value={summary.last_completed_session
                    ? `${cleanTitle(summary.last_completed_session.label)} · ${formatWorkoutMeta(summary.last_completed_session)}`
                    : 'No completed Sessions yet'}
                />
                <AthleteContextRow
                  icon="arrow-forward-circle-outline"
                  label="Upcoming Training Session"
                  onPress={summary.next_assigned_session
                    ? () => openWorkout(summary.next_assigned_session?.workout_id)
                    : undefined}
                  tone={SLColors.info}
                  value={summary.next_assigned_session
                    ? `${cleanTitle(summary.next_assigned_session.label)} · ${formatWorkoutMeta(summary.next_assigned_session)}`
                    : 'No assigned Session found'}
                />
                <View style={styles.contextNote}>
                  <View style={styles.contextIcon}>
                    <Ionicons color={SLColors.accentMuted} name="document-text-outline" size={17} />
                  </View>
                  <View style={styles.contextCopy}>
                    <Text style={styles.contextLabel}>Coach Context</Text>
                    <Text style={styles.noteText}>
                      {summary.coach_context.pinned_note?.body_preview || 'No pinned context'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityLabel="Return to Roster"
              accessibilityRole="button"
              onPress={() => router.replace('/(tabs)/coach-roster')}
              style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
            >
              <Ionicons color={SLColors.textMuted} name="arrow-back" size={18} />
              <Text style={styles.returnText}>Return to Roster with queue state preserved</Text>
            </Pressable>
          </>
        ) : null}
      </RefreshScreen>
    </SLScreen>
  );
}

function CommandTool({ action }: { action: CommandAction }) {
  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => [styles.commandTool, pressed && styles.actionRowPressed]}
    >
      <CoachMaterialLayer borderRadius={12} emphasis="quiet" tone="violet" />
      <View style={styles.commandToolIcon}>
        <Ionicons color={SLColors.accentMuted} name={action.icon} size={18} />
        {action.meta ? (
          <View style={styles.commandToolBadge}>
            <Text style={styles.commandToolBadgeText}>{action.meta}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.commandToolTitle}>{action.label}</Text>
    </Pressable>
  );
}

function CurrentTrainingContext({ training }: { training?: CoachTrainingContext }) {
  const unavailable = !training || training.status === 'position_unavailable';
  const noProgram = training?.status === 'no_active_program';
  const title = noProgram
    ? 'No active Training Program'
    : unavailable
      ? 'Training position unavailable'
      : training.program_name || 'Current Training';
  const block = training?.status === 'active' ? training.block_name : null;
  const position = training?.status === 'active'
    ? [
        training.week_position && training.week_total
          ? `Week ${training.week_position} of ${training.week_total}`
          : null,
        training.session_position && training.session_total
          ? `Day ${training.session_position} of ${training.session_total}`
          : null,
      ].filter(Boolean).join(' · ')
    : undefined;

  return (
    <View style={styles.currentTraining}>
      <View style={styles.contextIcon}>
        <Ionicons color={SLColors.accentViolet} name="layers-outline" size={15} />
      </View>
      <View style={styles.currentTrainingCopy}>
        <Text style={styles.contextLabel}>Current Training</Text>
        <Text numberOfLines={2} style={styles.currentTrainingTitle}>{title}</Text>
        {block ? (
          <View style={styles.currentTrainingPosition}>
            <Text numberOfLines={1} style={styles.currentTrainingBlock}>{block}</Text>
            {training?.week_tag?.label ? (
              <Text style={styles.trainingTag}>{training.week_tag.label}</Text>
            ) : null}
          </View>
        ) : null}
        {position ? <Text style={styles.currentTrainingMeta}>{position}</Text> : null}
      </View>
    </View>
  );
}

function AthleteContextRow({
  icon,
  label,
  value,
  tone = SLColors.accentMuted,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.contextIcon}><Ionicons color={tone} name={icon} size={17} /></View>
      <View style={styles.contextCopy}>
        <Text style={styles.contextLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.contextValue}>{value}</Text>
      </View>
      {onPress ? <Ionicons color={SLColors.textMuted} name="chevron-forward" size={15} /> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={styles.contextRow}>{content}</Pressable>
  ) : (
    <View style={styles.contextRow}>{content}</View>
  );
}

function CommandSection({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {typeof count === 'number' ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

function CommandLedgerRow({
  icon,
  title,
  meta,
  statusLabel,
  statusTone,
  priorityLabel,
  dominant,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta?: string;
  statusLabel?: string;
  statusTone: SLStatusTone;
  priorityLabel?: string;
  dominant?: boolean;
  onPress?: () => void;
}) {
  const color = toneColor(statusTone);
  const Wrapper = onPress ? Pressable : View;
  const rowContent = (
    <>
      <View style={[styles.ledgerIcon, { borderColor: color }]}>
        <Ionicons color={color} name={icon} size={15} />
      </View>
      <View style={styles.ledgerCopy}>
        <Text numberOfLines={1} style={styles.ledgerRowTitle}>{title}</Text>
        {meta ? <Text numberOfLines={1} style={styles.ledgerMeta}>{meta}</Text> : null}
      </View>
      <View style={styles.ledgerStatusWrap}>
        {priorityLabel ? <Text style={styles.priorityText}>{priorityLabel}</Text> : null}
        {statusLabel ? <Text style={[styles.ledgerStatus, { color }]}>{statusLabel}</Text> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.ledgerRow, dominant && styles.ledgerRowDominant, pressed && styles.pressed]}>
        {rowContent}
      </Pressable>
    );
  }

  return <Wrapper style={[styles.ledgerRow, dominant && styles.ledgerRowDominant]}>{rowContent}</Wrapper>;
}

function InlineEmpty({
  title,
  icon,
  tone = 'neutral',
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: SLStatusTone;
}) {
  const color = toneColor(tone);
  return (
    <View style={styles.inlineEmpty}>
      <Ionicons color={color} name={icon} size={16} />
      <Text style={styles.inlineEmptyText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    gap: SLSpacing.md,
    paddingBottom: 116,
    paddingTop: SLSpacing.md,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
  },
  commandHero: {
    alignItems: 'center',
    borderRadius: SLRadius.radiusCard,
    flexDirection: 'row',
    gap: SLSpacing.md,
    minHeight: 112,
    overflow: 'hidden',
    padding: SLSpacing.md,
  },
  commandIdentity: { flex: 1, minWidth: 0 },
  commandName: { color: SLColors.textPrimary, fontSize: 23, lineHeight: 28, marginTop: 3 },
  commandProgram: { color: SLColors.textMuted, marginTop: 3 },
  commandHeroMenu: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceInset,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  commandSection: { gap: 8, paddingTop: 4 },
  coachingQueue: { borderRadius: SLRadius.radiusCard, overflow: 'hidden' },
  attentionDetail: {
    alignItems: 'center',
    borderBottomColor: SLColors.borderHairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 74,
    padding: 10,
  },
  attentionIcon: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceInset,
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  attentionDetailCopy: { flex: 1, minWidth: 0 },
  attentionDetailTitle: { color: SLColors.textPrimary },
  attentionDetailText: { color: SLColors.textMuted, marginTop: 2 },
  queueActions: { alignItems: 'flex-end', gap: 5 },
  queueOpenButton: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceSelected,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 9,
  },
  queueOpenText: { color: SLColors.textSecondary, fontSize: 9 },
  healthyCard: {
    alignItems: 'center',
    borderRadius: SLRadius.radiusControl,
    flexDirection: 'row',
    gap: 10,
    minHeight: 66,
    overflow: 'hidden',
    padding: 12,
  },
  healthyTitle: { color: '#C9E8D3' },
  healthyText: { color: SLColors.textMuted },
  header: {
    gap: 3,
    paddingBottom: SLSpacing.sm,
    paddingTop: 4,
    position: 'relative',
  },
  pressed: {
    opacity: 0.78,
  },
  eyebrow: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: SLTypography.utilityLabel.lineHeight,
    textTransform: 'uppercase',
  },
  title: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: SLTypography.commandTitle.fontSize,
    fontWeight: SLTypography.commandTitle.fontWeight,
    letterSpacing: SLTypography.commandTitle.letterSpacing,
    lineHeight: SLTypography.commandTitle.lineHeight,
  },
  subtitle: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  heroSurface: {
    borderRadius: SLRadius.radiusCard,
    gap: SLSpacing.md,
    minHeight: 112,
    overflow: 'hidden',
    paddingHorizontal: SLSpacing.lg,
    paddingVertical: 18,
    position: 'relative',
  },
  heroRail: {
    bottom: 0,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: SLSpacing.sm,
    minWidth: 0,
  },
  heroName: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: SLTypography.commandTitle.fontWeight,
    letterSpacing: 0,
    lineHeight: 25,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLSpacing.xs,
  },
  meetLine: {
    alignItems: 'center',
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    borderColor: SHEET_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  meetText: {
    color: SLColors.text,
    flex: 1,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.caption.lineHeight,
  },
  section: {
    gap: 9,
  },
  rowStack: {
    borderRadius: SLRadius.radiusCard,
    overflow: 'hidden',
    position: 'relative',
  },
  coachingDock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  commandTool: {
    alignItems: 'center',
    borderRadius: 12,
    gap: 5,
    justifyContent: 'center',
    minHeight: 58,
    overflow: 'hidden',
    width: '23.4%',
  },
  commandToolIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 27,
  },
  commandToolTitle: {
    color: SLColors.textSecondary,
    fontSize: 9,
    textAlign: 'center',
  },
  commandToolBadge: {
    alignItems: 'center',
    backgroundColor: SLColors.accentHot,
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -7,
    top: -4,
  },
  commandToolBadgeText: { color: SLColors.white, fontSize: 8 },
  contextPanel: { borderRadius: SLRadius.radiusCard, overflow: 'hidden' },
  currentTraining: {
    alignItems: 'flex-start',
    borderBottomColor: SHEET_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  currentTrainingCopy: {
    flex: 1,
    minWidth: 0,
  },
  contextLabel: {
    color: SLColors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  currentTrainingTitle: {
    color: SLColors.textStrong,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 2,
  },
  currentTrainingPosition: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  currentTrainingBlock: {
    color: SLColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  trainingTag: {
    backgroundColor: 'rgba(139, 71, 255, 0.14)',
    borderColor: 'rgba(174, 128, 255, 0.34)',
    borderRadius: 999,
    borderWidth: 1,
    color: SLColors.accentViolet,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: 'uppercase',
  },
  currentTrainingMeta: {
    color: SLColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  returnButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
  },
  returnText: {
    color: SLColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 28,
  },
  sectionCount: { color: SLColors.textMuted, marginLeft: 'auto' },
  sectionRail: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    height: 2,
    width: 22,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionEyebrow: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 9,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 11,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.sectionLabel.fontFamily,
    fontSize: SLTypography.sectionLabel.fontSize,
    fontWeight: SLTypography.sectionLabel.fontWeight,
    letterSpacing: SLTypography.sectionLabel.letterSpacing,
    lineHeight: SLTypography.sectionLabel.lineHeight,
    textTransform: 'uppercase',
  },
  contextRow: {
    alignItems: 'center',
    borderBottomColor: SLColors.borderHairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  contextIcon: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceInset,
    borderRadius: 10,
    height: 31,
    justifyContent: 'center',
    width: 31,
  },
  contextCopy: { flex: 1, minWidth: 0 },
  contextValue: {
    color: SLColors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  contextNote: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    padding: 12,
  },
  noteText: {
    color: SLColors.textSecondary,
    flex: 1,
    lineHeight: 19,
    marginTop: 3,
  },
  ledgerRow: {
    alignItems: 'center',
    borderBottomColor: SHEET_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 60,
    overflow: 'hidden',
    paddingRight: SLSpacing.sm,
  },
  ledgerRowDominant: {
    backgroundColor: SHEET_MATERIAL.surfaceSoft,
    minHeight: 72,
  },
  ledgerRail: {
    alignSelf: 'stretch',
    opacity: 0.78,
    width: 4,
  },
  ledgerIcon: {
    alignItems: 'center',
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    borderRadius: SLRadius.radiusSharp,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ledgerCopy: {
    flex: 1,
    minWidth: 0,
  },
  ledgerRowTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  ledgerMeta: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
    marginTop: 2,
  },
  ledgerStatusWrap: {
    alignItems: 'flex-end',
    maxWidth: 86,
  },
  priorityText: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 9,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  ledgerStatus: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.22,
    lineHeight: 13,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  inlineEmpty: {
    alignItems: 'center',
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    borderBottomColor: SHEET_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 48,
    paddingHorizontal: SLSpacing.md,
  },
  inlineEmptyText: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  actionRowPressed: {
    opacity: 0.78,
  },
});
