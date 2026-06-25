// app/athlete-dashboard.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TodayCheckInSurface, TodaySubmittedCheckIn } from '@/components/AthleteCheckInExperience';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';

type TodayAction = {
  kind?: string | null;
  label?: string | null;
  route?: 'workout' | 'training' | 'messages' | 'feedback' | 'film_room' | 'meet' | string | null;
  workout_id?: number | null;
  thread_id?: number | null;
  meet_plan_id?: number | null;
};

type MeetPlanSummary = {
  id?: number | null;
  name?: string | null;
  date?: string | null;
  days_until?: number | null;
  status?: string | null;
};

type TodaySession = {
  id: number;
  label?: string | null;
  date?: string | null;
  status?: string | null;
  preview?: {
    primary_lifts?: string[];
    summary?: string | null;
    core_count?: number;
    accessory_count?: number;
  } | null;
};

type TodayPayload = {
  date: string;
  athlete?: {
    id?: number;
    name?: string | null;
    avatar_url?: string | null;
    bodyweight_kg?: number | null;
  } | null;
  coach?: {
    id?: number;
    name?: string | null;
    email?: string | null;
  } | null;
  phase?: {
    label?: string | null;
    active_program?: {
      id?: number | null;
      name?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    } | null;
    block?: {
      id?: number;
      name?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    } | null;
    meet?: {
      id?: number | null;
      name?: string | null;
      date?: string | null;
      days_until?: number | null;
      status?: string | null;
    } | null;
  } | null;
  mission?: {
    kind?: 'workout' | 'recovery' | string;
    title?: string | null;
    date?: string | null;
    status?: string | null;
    body?: string | null;
    focus?: string[];
    session?: TodaySession | null;
  } | null;
  readiness?: {
    score?: number | null;
    message?: string | null;
    latest?: {
      sleep_quality?: number | null;
      energy?: number | null;
      soreness?: number | null;
      stress?: number | null;
    } | null;
    metrics?: {
      sleep?: number | null;
      energy?: number | null;
      soreness?: number | null;
      stress?: number | null;
    } | null;
  } | null;
  coach_guidance?: {
    source?: string | null;
    title?: string | null;
    body?: string | null;
    created_at?: string | null;
    route?: string | null;
    workout_id?: number | null;
  } | null;
  latest_announcement?: CoachConnectionItem | null;
  latest_message?: CoachConnectionItem | null;
  recent_glance?: {
    title?: string | null;
    date?: string | null;
    status?: string | null;
    workout_id?: number | null;
  } | null;
  yesterday?: DayTrainingState | null;
  next_glance?: {
    title?: string | null;
    date?: string | null;
    status?: string | null;
    workout_id?: number | null;
    week?: {
      assigned?: number;
      logged?: number;
      missed?: number;
      pct?: number | null;
      start_date?: string | null;
      end_date?: string | null;
    } | null;
  } | null;
  tomorrow?: DayTrainingState | null;
  progress_signal?: {
    kind?: string | null;
    label?: string | null;
    value?: number | null;
    unit?: string | null;
    delta?: number | null;
    body?: string | null;
  } | null;
  primary_action?: TodayAction | null;
};

type DayTrainingState = {
  date?: string | null;
  kind?: 'session' | 'rest' | string;
  title?: string | null;
  workout_id?: number | null;
};

type CoachConnectionItem = {
  id?: number | null;
  thread_id?: number | null;
  sender_name?: string | null;
  title?: string | null;
  body?: string | null;
  created_at?: string | null;
  route?: string | null;
};

type CoachConnectionDisplayItem = {
  sender_name?: string | null;
  title?: string | null;
  body?: string | null;
};

type TodayResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  today?: TodayPayload | null;
};

const PATCH_NOTE_VERSION = 'strength_ledger_mobile_2_0_athlete_tour_seen';
const INDIVIDUAL_TODAY_WELCOME_VERSION = 'strength_ledger_individual_today_welcome_seen_v1';
const REST_DAY_IMAGE = require('@/assets/images/chair.png');
const TRAINING_DAY_IMAGE = require('@/assets/images/gym_vibe.jpg');

const palette = {
  violet: '#8B5CF6',
  violetSoft: '#C4B5FD',
  violetDim: 'rgba(139,92,246,0.14)',
  steel: '#A69B8D',
  green: '#A7CBB5',
  amber: '#D6A75E',
  red: '#F87171',
  text: '#ECE5DA',
  textStrong: '#F9FAFB',
  muted: '#B8ACA1',
  subtle: '#82766D',
  rail: 'rgba(222,198,166,0.11)',
  surface: 'rgba(20,14,13,0.32)',
  surfaceStrong: 'rgba(24,16,15,0.50)',
  border: 'rgba(222,198,166,0.085)',
};

export default function AthleteDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams<{ submittedCheckIn?: string }>();
  const { token, user } = useAuth();
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPatchNote, setShowPatchNote] = useState(false);
  const [showIndividualWelcome, setShowIndividualWelcome] = useState(false);
  const isIndividual =
    user?.workspace_mode === 'individual' ||
      user?.is_individual_workspace === true ||
      user?.is_self_coached === true;
  const isAuthenticatedCoach = user?.role === 'coach' || user?.is_coach === true;
  const showCoachCheckIn = !isAuthenticatedCoach && !isIndividual;
  const individualWelcomeKey = `${INDIVIDUAL_TODAY_WELCOME_VERSION}:${user?.email || 'unknown'}`;

  useEffect(() => {
    let cancelled = false;

    const checkPatchNote = async () => {
      try {
        const seen = await AsyncStorage.getItem(PATCH_NOTE_VERSION);
        if (!cancelled && !isIndividual && seen !== '1') setShowPatchNote(true);
      } catch {
        if (!cancelled && !isIndividual) setShowPatchNote(true);
      }
    };

    checkPatchNote();

    return () => {
      cancelled = true;
    };
  }, [isIndividual]);

  const dismissPatchNote = async () => {
    setShowPatchNote(false);
    try {
      await AsyncStorage.setItem(PATCH_NOTE_VERSION, '1');
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkIndividualWelcome = async () => {
      if (!isIndividual || !today || hasActiveProgram(today)) {
        setShowIndividualWelcome(false);
        return;
      }

      try {
        const seen = await AsyncStorage.getItem(individualWelcomeKey);
        if (!cancelled) setShowIndividualWelcome(seen !== '1');
      } catch {
        if (!cancelled) setShowIndividualWelcome(true);
      }
    };

    checkIndividualWelcome();

    return () => {
      cancelled = true;
    };
  }, [individualWelcomeKey, isIndividual, today]);

  const dismissIndividualWelcome = async () => {
    setShowIndividualWelcome(false);
    try {
      await AsyncStorage.setItem(individualWelcomeKey, '1');
    } catch {
      // no-op
    }
  };

  const goToProgrammingFromWelcome = async () => {
    await dismissIndividualWelcome();
    router.push('/(tabs)/workout' as any);
  };

  const loadToday = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        if (!token) {
          setError('Not authenticated. Please log in again.');
          setToday(null);
          return;
        }

        const res: any = await fetchJson('/athletes/mobile/dashboard', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = Number(res?.status ?? 0);
        const payload: TodayResponse = res?.json ?? res;

        if (res?.ok !== true || payload?.ok !== true) {
          const msg = payload?.error || payload?.message || `Request failed (${status || 'unknown'})`;
          setError(String(msg));
          setToday(null);
          if (status === 401) router.replace('/login');
          return;
        }

        if (!payload.today) {
          setError('Today is not available yet.');
          setToday(null);
          return;
        }

        setToday(payload.today);
      } catch (err) {
        console.log('Athlete Today API error', err);
        setError('Network error while loading Today.');
        setToday(null);
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [router, token]
  );

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useFocusEffect(
    React.useCallback(() => {
      loadToday({ silent: true });
    }, [loadToday])
  );

  const openAction = React.useCallback(
    (action?: TodayAction | null) => {
      if (!action) return;
      if (isIndividual && action.route === 'programming') {
        router.push('/(tabs)/workout' as any);
        return;
      }
      if (action.route === 'workout' && action.workout_id) {
        router.push({
          pathname: '/workout/[workoutId]',
          params: { workoutId: String(action.workout_id) },
        });
        return;
      }
      if (isIndividual && (action.route === 'messages' || action.route === 'announcements' || action.route === 'message_thread')) {
        router.push('/(tabs)/workout' as any);
        return;
      }
      if (action.route === 'messages') {
        router.push('/(tabs)/messages' as any);
        return;
      }
      if (action.route === 'announcements') {
        router.push('/(tabs)/messages/announcements' as any);
        return;
      }
      if (action.route === 'message_thread' && action.thread_id) {
        router.push({
          pathname: '/(tabs)/messages/[threadId]',
          params: { threadId: String(action.thread_id) },
        } as any);
        return;
      }
      if (action.route === 'feedback') {
        if (action.workout_id) {
          router.push({
            pathname: '/workout/[workoutId]',
            params: { workoutId: String(action.workout_id) },
          });
          return;
        }
        if (isIndividual) {
          router.push('/(tabs)/reflection' as any);
          return;
        }
        router.push('/(tabs)/coach-reviews' as any);
        return;
      }
      if (action.route === 'film_room') {
        router.push('/(tabs)/video-archive' as any);
        return;
      }
      if (action.route === 'meet') {
        router.push('/(tabs)/athlete-meet-plan' as any);
        return;
      }
      router.push('/(tabs)/workout' as any);
    },
    [isIndividual, router]
  );

  if (loading) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.violetSoft} />
          <Text style={styles.centeredText}>Loading Today...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !today) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Today is unavailable.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PatchNoteModal dismissPatchNote={dismissPatchNote} showPatchNote={showPatchNote && !isIndividual} />
      <IndividualTodayWelcomeModal
        onGoToProgramming={goToProgrammingFromWelcome}
        onNotNow={dismissIndividualWelcome}
        visible={showIndividualWelcome}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadToday({ silent: true })} tintColor={palette.muted} />
        }
      >
        <PresentState isIndividual={isIndividual} today={today} />
        {showCoachCheckIn ? <TodaySubmittedCheckIn title={params.submittedCheckIn} /> : null}
        {showCoachCheckIn ? <TodayCheckInSurface /> : null}
        <NoActiveProgramGuidance isIndividual={isIndividual} onAction={openAction} today={today} />
        {!(isIndividual && !hasActiveProgram(today)) ? (
          <TodayTraining isIndividual={isIndividual} onAction={openAction} today={today} />
        ) : null}
        <MeetPlanEntry
          meet={today.phase?.meet}
          onPress={() => openAction({ route: 'meet', label: 'View Meet Plan', meet_plan_id: today.phase?.meet?.id })}
        />
        <ReadinessLine isIndividual={isIndividual} today={today} />
        <ContextTray isIndividual={isIndividual} onAction={openAction} today={today} />
      </ScrollView>
    </SafeAreaView>
  );
}

function NoActiveProgramGuidance({
  isIndividual,
  onAction,
  today,
}: {
  isIndividual?: boolean;
  onAction: (action?: TodayAction | null) => void;
  today: TodayPayload;
}) {
  if (!isIndividual || hasActiveProgram(today)) return null;

  return (
    <View style={styles.noProgramGuidance}>
      <View style={styles.noProgramRail} />
      <View style={styles.noProgramCopy}>
        <Text style={styles.noProgramTitle}>No Active Program</Text>
        <Text style={styles.noProgramBody}>
          Create your first training program to begin scheduling sessions and building your training calendar.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Programming"
        onPress={() => onAction({ route: 'programming', label: 'Open Programming' })}
        style={({ pressed }) => [styles.noProgramButton, pressed && styles.rowPressed]}
      >
        <Text style={styles.noProgramButtonText}>Open Programming</Text>
        <Ionicons name="arrow-forward" size={15} color={palette.violetSoft} />
      </Pressable>
    </View>
  );
}

function PresentState({ isIndividual, today }: { isIndividual?: boolean; today: TodayPayload }) {
  const athleteName = today.athlete?.name || 'Athlete';

  return (
    <View style={styles.presentZone}>
      <View style={styles.identityRow}>
        <View style={styles.avatar}>
          {today.athlete?.avatar_url ? (
            <Image source={{ uri: today.athlete.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials(athleteName)}</Text>
          )}
        </View>
        <View style={styles.identityText}>
          <Text style={styles.todayKicker}>{isIndividual ? 'Good morning' : 'Today'}</Text>
          <Text style={styles.athleteName}>{athleteName}</Text>
          <Text style={styles.coachLine}>
            {isIndividual ? 'Self-coached training' : today.coach?.name ? `Coached by ${today.coach.name}` : 'Training companion'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MeetPlanEntry({
  meet,
  onPress,
}: {
  meet?: MeetPlanSummary | null;
  onPress: () => void;
}) {
  if (!meet?.id) return null;

  const daysLine = meetDaysLabel(meet.days_until);
  const dateLine = meet.date ? formatShortDate(meet.date) : 'Date TBD';
  const statusLine = meetStatusLabel(meet.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.meetPlanEntry, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel="View Meet Plan"
    >
      <View style={styles.meetPlanRail} />
      <View style={styles.meetPlanCopy}>
        <View style={styles.meetPlanTopRow}>
          <Text style={styles.meetPlanKicker}>Meet Plan</Text>
          <Text style={styles.meetPlanTiming}>{daysLine}</Text>
        </View>
        <Text style={styles.meetPlanTitle} numberOfLines={1}>{meet.name || 'Meet'}</Text>
        <Text style={styles.meetPlanMeta} numberOfLines={1}>
          {dateLine} / {statusLine} / View attempts, warmups, and meet prep
        </Text>
      </View>
      <View style={styles.meetPlanAction}>
        <Text style={styles.meetPlanActionText}>View</Text>
        <Ionicons name="arrow-forward" size={15} color={palette.violetSoft} />
      </View>
    </Pressable>
  );
}

function TodayTraining({
  isIndividual,
  onAction,
  today,
}: {
  isIndividual?: boolean;
  onAction: (action?: TodayAction | null) => void;
  today: TodayPayload;
}) {
  const mission = today.mission;
  const action = today.primary_action;
  const isWorkout = mission?.kind === 'workout';
  const preview = mission?.session?.preview || null;
  const session = mission?.session || null;
  const hasSession = isWorkout && !!session?.id;
  const sessionAction = hasSession
    ? action || { route: 'workout', workout_id: session.id, label: 'Open Session' }
    : null;
  const isToday = String(session?.date || mission?.date || today.date).slice(0, 10) === String(today.date).slice(0, 10);
  const trainingSummary = buildTodayTrainingSummary(
    preview?.primary_lifts?.length ? preview.primary_lifts : mission?.focus,
    preview?.core_count,
    preview?.accessory_count,
    hasSession
  );
  const actionLabel = actionLabelForSession(sessionAction, mission?.status, hasSession);
  const sessionLabel = hasSession ? session?.label || mission?.title || 'Today' : 'Recovery day';
  const focusDate = session?.date || mission?.date || today.date;
  const sessionDate = hasSession
    ? formatShortDate(focusDate)
    : `${formatWeekdayAbbrev(focusDate)}  •  ${formatShortDate(focusDate)}  •  Rest`;
  const focusImage = hasSession ? TRAINING_DAY_IMAGE : REST_DAY_IMAGE;

  return (
    <View style={[styles.todayTrainingZone, !hasSession && styles.todayTrainingZoneCompact]}>
      <View pointerEvents="none" style={styles.restDayArtLayer}>
        <Image
          source={focusImage}
          style={[styles.restDayImage, hasSession && styles.trainingDayImage]}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(18,18,30,0.94)', 'rgba(18,18,30,0.58)', 'rgba(18,18,30,0.16)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.restDayImageSideFade}
        />
        <LinearGradient
          colors={['rgba(18,18,30,0.22)', 'rgba(18,18,30,0.72)']}
          start={{ x: 0.65, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.restDayImageDarken}
        />
        <LinearGradient
          colors={['rgba(214,167,94,0.12)', 'rgba(139,92,246,0.05)', 'rgba(18,18,30,0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.restDayImageWarmth}
        />
        </View>
      <View style={styles.todayTrainingRail} />
      <View style={[styles.todayTrainingBody, !hasSession && styles.todayTrainingBodyCompact]}>
        <View style={styles.todayTrainingTopRow}>
          <Text style={styles.todayTrainingKicker}>{isIndividual ? "Today's Focus" : "Today's Training"}</Text>
        </View>

        <View style={styles.todayFocusContentRow}>
          <View style={[styles.todayFocusCopy, hasSession ? styles.todayFocusCopyTraining : styles.todayFocusCopyRest]}>
            <Text style={[styles.todayTrainingTitle, !hasSession && styles.todayTrainingTitleCompact]}>{sessionLabel}</Text>
            <Text style={styles.todayTrainingDate}>{sessionDate}</Text>
            <Text style={[styles.todayTrainingMovements, !hasSession && styles.todayTrainingMovementsCompact]} numberOfLines={2}>{trainingSummary.mainLine}</Text>
            {trainingSummary.workLine ? (
              <Text style={styles.todayTrainingSummary} numberOfLines={1}>{trainingSummary.workLine}</Text>
            ) : null}
          </View>
        </View>

        {sessionAction ? (
          <Pressable
            onPress={() => onAction(sessionAction)}
            style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed]}
          >
            <View style={styles.primaryActionRail} />
            <View style={styles.primaryActionCopy}>
              <Text style={styles.primaryActionKicker}>Session</Text>
              <Text style={styles.primaryActionText}>{actionLabel}</Text>
            </View>
            <View style={styles.primaryActionIcon}>
              <Ionicons name="arrow-forward" size={18} color={palette.violetSoft} />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ReadinessLine({ isIndividual, today }: { isIndividual?: boolean; today: TodayPayload }) {
  const readiness = today.readiness;
  const hasScore = readiness?.score != null && Number.isFinite(Number(readiness.score));
  const score = hasScore ? formatNumber(readiness?.score, 1) : null;
  const readinessMessage =
    isIndividual && (!readiness?.score || String(readiness?.message || '').toLowerCase().includes('coach'))
      ? 'Readiness context will appear as you log readiness.'
      : readiness?.message || 'Readiness context will appear after check-ins.';
  const metrics = readiness?.metrics || {};
  const metricLine = [
    ['Bodyweight', today.athlete?.bodyweight_kg != null ? `${formatNumber(today.athlete.bodyweight_kg, 1)} kg` : null],
    ['Sleep', metrics.sleep],
    ['Energy', metrics.energy],
    ['Soreness', metrics.soreness],
    ['Stress', metrics.stress],
  ]
    .filter(([, value]) => value != null)
    .slice(0, 3)
    .map(([label, value]) => `${label} ${typeof value === 'string' ? value : formatNumber(value as number, 1)}`);

  return (
    <View style={styles.readinessLine}>
      <View style={styles.readinessRail} />
      <View style={styles.readinessIcon}>
        <Ionicons name="pulse-outline" size={24} color={palette.violetSoft} />
      </View>
      <View style={styles.readinessCopy}>
        <Text style={styles.readinessKicker}>Readiness</Text>
        <Text style={styles.readinessTitle}>{hasScore ? 'Ready' : 'Readiness'}</Text>
        <Text style={styles.readinessMessage}>{readinessMessage}</Text>
        {metricLine.length > 0 ? <Text style={styles.readinessMetrics}>{metricLine.join(' / ')}</Text> : null}
      </View>
      {hasScore ? (
        <View style={styles.readinessScore}>
          <Text style={styles.readinessScoreValue}>{score}</Text>
          <Text style={styles.readinessScoreLabel}>Score</Text>
        </View>
      ) : null}
    </View>
  );
}

function ContextTray({
  isIndividual,
  onAction,
  today,
}: {
  isIndividual?: boolean;
  onAction: (action?: TodayAction | null) => void;
  today: TodayPayload;
}) {
  const yesterday = today.yesterday;
  const tomorrow = today.tomorrow;
  const guidance = today.coach_guidance;
  const hasGuidance = !!(guidance?.body && guidance.source !== 'empty');
  const hasConnection = !!(today.latest_announcement || today.latest_message);

  if (isIndividual) {
    return <IndividualTrainingContext onAction={onAction} today={today} />;
  }

  return (
    <View style={styles.contextZone}>
      <View style={styles.glanceStrip}>
        <GlanceCell
          icon="calendar-outline"
          label="Tomorrow"
          title={dayStateTitle(tomorrow)}
          meta={tomorrow?.date ? formatShortDate(tomorrow.date) : 'Tomorrow'}
          onPress={() => tomorrow?.workout_id && onAction({ route: 'workout', workout_id: tomorrow.workout_id })}
        />
        <View style={styles.glanceDivider} />
        <GlanceCell
          icon="time-outline"
          label="Yesterday"
          title={dayStateTitle(yesterday)}
          meta={yesterday?.date ? formatShortDate(yesterday.date) : 'Yesterday'}
          onPress={() => yesterday?.workout_id && onAction({ route: 'workout', workout_id: yesterday.workout_id })}
        />
      </View>

      {(hasGuidance || hasConnection) ? (
        <View style={styles.coachConnection}>
          {hasGuidance ? (
            <CoachConnectionRow
              item={guidance}
              label={guidance.source === 'session_feedback' ? 'Coach Feedback' : 'Coach Guidance'}
              onPress={() => onAction({
                route: guidance.route || 'feedback',
                workout_id: guidance.workout_id,
                label: 'Open Session',
              })}
            />
          ) : null}
          {today.latest_announcement ? (
            <CoachConnectionRow
              item={today.latest_announcement}
              label="Coach Update"
              onPress={() => onAction({ route: 'announcements', label: 'Open' })}
            />
          ) : null}
          {today.latest_message ? (
            <CoachConnectionRow
              item={today.latest_message}
              label="Latest Message"
              onPress={() => onAction({
                route: today.latest_message?.thread_id ? 'message_thread' : 'messages',
                thread_id: today.latest_message?.thread_id,
                label: 'Open',
              })}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.coachEmptyLine}>
          <View style={styles.contextRail} />
          <Text style={styles.coachEmptyText}>No coach updates right now.</Text>
        </View>
      )}
    </View>
  );
}

function IndividualTrainingContext({
  onAction,
  today,
}: {
  onAction: (action?: TodayAction | null) => void;
  today: TodayPayload;
}) {
  const recent = today.recent_glance;
  const next = today.next_glance;
  const progress = today.progress_signal;
  const hasRecent = !!recent?.workout_id || !!recent?.title;
  const hasNext = !!next?.workout_id || !!next?.title;
  const week = next?.week;
  const weekLine = week?.pct != null
    ? `${week.logged || 0}/${week.assigned || 0} logged this week`
    : week?.assigned
    ? `${week.assigned} session${week.assigned === 1 ? '' : 's'} this week`
    : 'Training week context appears as sessions are scheduled.';

  return (
    <View style={styles.contextZone}>
      <View style={styles.glanceStrip}>
        <GlanceCell
          icon="calendar-outline"
          label="Next"
          title={next?.title || dayStateTitle(today.tomorrow)}
          meta={next?.date ? formatShortDate(next.date) : today.tomorrow?.date ? formatShortDate(today.tomorrow.date) : 'Training runway'}
          onPress={() => next?.workout_id && onAction({ route: 'workout', workout_id: next.workout_id })}
        />
        <View style={styles.glanceDivider} />
        <GlanceCell
          icon="checkmark-circle-outline"
          label="Recent"
          title={recent?.title || 'Recent training'}
          meta={recent?.date ? formatShortDate(recent.date) : 'Log sessions to build history'}
          onPress={() => recent?.workout_id && onAction({ route: 'workout', workout_id: recent.workout_id })}
        />
      </View>

      <View style={styles.trainingObjectStack}>
        <TrainingSignalRow
          icon="analytics-outline"
          label="Your Progress"
          title={progress?.label || 'Training momentum'}
          body={progress?.body || 'Training signals appear as you log sessions.'}
        />
        <TrainingSignalRow
          icon="barbell-outline"
          label="Up Next"
          title={hasNext ? next?.title || 'Next session' : 'No upcoming session'}
          body={hasNext ? `${next?.date ? formatShortDate(next.date) : 'Next scheduled day'} / ${weekLine}` : weekLine}
          onPress={next?.workout_id ? () => onAction({ route: 'workout', workout_id: next.workout_id }) : undefined}
        />
        {hasRecent ? (
          <TrainingSignalRow
            icon="time-outline"
            label="Last Session"
            title={recent?.title || 'Completed session'}
            body={recent?.date ? `${formatShortDate(recent.date)} / ${recent.status || 'completed'}` : recent.status || 'Completed'}
            onPress={recent?.workout_id ? () => onAction({ route: 'workout', workout_id: recent.workout_id }) : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

function TrainingSignalRow({
  body,
  icon,
  label,
  onPress,
  title,
}: {
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  title: string;
}) {
  const content = (
    <>
      <View style={styles.contextRail} />
      <View style={styles.trainingSignalIcon}>
        <Ionicons name={icon} size={18} color={palette.violetSoft} />
      </View>
      <View style={styles.contextCopy}>
        <Text style={styles.contextLabel}>{label}</Text>
        <Text style={styles.contextTitle}>{title}</Text>
        <Text style={styles.contextBody} numberOfLines={2}>{body}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={palette.muted} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.coachPocket}>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.coachPocket, pressed && styles.rowPressed]}>
      {content}
    </Pressable>
  );
}

function CoachConnectionRow({
  item,
  label,
  onPress,
}: {
  item: CoachConnectionDisplayItem;
  label: string;
  onPress: () => void;
}) {
  const title = item.title || item.sender_name || label;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.coachPocket, pressed && styles.rowPressed]}
    >
      <View style={styles.contextRail} />
      <View style={styles.contextCopy}>
        <Text style={styles.contextLabel}>{label}</Text>
        <Text style={styles.contextTitle}>{title}</Text>
        <Text style={styles.contextBody} numberOfLines={2}>
          {item.body || 'Open for the latest from your coach.'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={palette.muted} />
    </Pressable>
  );
}

function GlanceCell({
  icon,
  label,
  meta,
  onPress,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta: string;
  onPress?: () => void;
  title: string;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.glanceCell, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={17} color={palette.steel} />
      <Text style={styles.glanceLabel}>{label}</Text>
      <Text style={styles.glanceTitle} numberOfLines={2}>{title}</Text>
      <Text style={styles.glanceMeta} numberOfLines={1}>{meta}</Text>
    </Pressable>
  );
}

function hasActiveProgram(today: TodayPayload) {
  return !!(today.phase?.active_program?.id || today.phase?.block?.id);
}

function IndividualTodayWelcomeModal({
  onGoToProgramming,
  onNotNow,
  visible,
}: {
  onGoToProgramming: () => void;
  onNotNow: () => void;
  visible: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <View style={styles.patchModalBackdrop}>
        <View style={styles.patchModalCard}>
          <View style={styles.patchModalHeader}>
            <View style={styles.patchModalIconWrap}>
              <Ionicons name="barbell" size={22} color={palette.violetSoft} />
            </View>
            <View style={styles.patchModalHeaderCopy}>
              <Text style={styles.patchModalTitle}>Welcome to Strength Ledger Mobile</Text>
              <Text style={styles.patchModalSubtitle}>Pilot Self-Coach workspace</Text>
            </View>
          </View>
          <Text style={styles.patchModalBody}>
            Thanks for downloading Strength Ledger and participating in the pilot. Let&apos;s get you started by creating your first training program.
          </Text>
          <View style={styles.individualWelcomeActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to Programming"
              onPress={onGoToProgramming}
              style={({ pressed }) => [styles.patchModalButton, pressed && styles.primaryActionPressed]}
            >
              <Text style={styles.patchModalButtonText}>Go to Programming</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={onNotNow}
              style={({ pressed }) => [styles.individualWelcomeSecondary, pressed && styles.rowPressed]}
            >
              <Text style={styles.individualWelcomeSecondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PatchNoteModal({
  dismissPatchNote,
  showPatchNote,
}: {
  dismissPatchNote: () => void;
  showPatchNote: boolean;
}) {
  const tourItems = [
    {
      title: 'Today',
      purpose: 'Your starting point.',
      bullets: ['What am I doing today?', 'Do I have a session?', 'Is there a meet coming up?', 'Do I have coach updates?'],
    },
    {
      title: 'Training Hub',
      purpose: 'Your training structure.',
      bullets: ['See upcoming sessions', 'Understand your block', 'Navigate your training plan'],
    },
    {
      title: 'Calendar',
      purpose: 'Your training rhythm.',
      bullets: ['Look ahead', 'Review training cadence', 'View meet timelines'],
    },
    {
      title: 'Reflection',
      purpose: 'Your coaching history.',
      bullets: ['Review coaching focus', 'See coach feedback', 'Follow coaching notes over time'],
    },
    {
      title: 'Film Room',
      purpose: 'Your movement study space.',
      bullets: ['Review videos', 'Study technique', 'Revisit feedback'],
    },
    {
      title: 'Progression',
      purpose: 'Your performance story.',
      bullets: ['Track strength trends', 'Review milestones', 'See how training is working'],
    },
    {
      title: 'Meet Packet',
      purpose: 'Your competition preparation system.',
      bullets: ['Prepare attempts', 'Review warmups', 'Organize meet-day information'],
    },
  ];

  return (
    <Modal visible={showPatchNote} transparent animationType="fade" onRequestClose={dismissPatchNote}>
      <View style={styles.patchModalBackdrop}>
        <View style={styles.patchModalCard}>
          <View style={styles.patchModalHeader}>
            <View style={styles.patchModalIconWrap}>
              <Ionicons name="sparkles" size={22} color={palette.violetSoft} />
            </View>
            <View style={styles.patchModalHeaderCopy}>
              <Text style={styles.patchModalTitle}>Strength Ledger Mobile 2.0</Text>
              <Text style={styles.patchModalSubtitle}>A completely refreshed athlete experience.</Text>
            </View>
          </View>
          <Text style={styles.patchModalBody}>
            Here's where to go depending on what you need.
          </Text>
          <ScrollView
            contentContainerStyle={styles.patchModalTourContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.patchModalTour}
          >
            {tourItems.map((item) => (
              <View key={item.title} style={styles.patchModalTourRow}>
                <Text style={styles.patchModalFlowLabel}>{item.title}</Text>
                <Text style={styles.patchModalPurpose}>{item.purpose}</Text>
                <Text style={styles.patchModalFlowDetail}>{item.bullets.join(' / ')}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable
            onPress={dismissPatchNote}
            style={({ pressed }) => [styles.patchModalButton, pressed && styles.primaryActionPressed]}
          >
            <Text style={styles.patchModalButtonText}>Start exploring</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function meetDaysLabel(days?: number | null) {
  if (days == null) return 'Date TBD';
  if (days < 0) return 'Meet passed';
  if (days === 0) return 'Meet day';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} out`;
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return remainder === 0
    ? `${weeks} week${weeks === 1 ? '' : 's'} out`
    : `${weeks}w ${remainder}d out`;
}

function meetStatusLabel(status?: string | null) {
  switch (status) {
    case 'active':
      return 'Meet active';
    case 'prep_visible':
      return 'Prep visible';
    default:
      return status ? status.replace(/_/g, ' ') : 'Prep';
  }
}

function actionLabelForSession(action?: TodayAction | null, status?: string | null, isWorkout?: boolean) {
  if (!isWorkout) return 'Open Session';
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('progress')) return 'Resume Session';
  if (normalized.includes('complete') || normalized.includes('logged') || normalized.includes('done')) return 'View Session';
  if (normalized.includes('assigned') || normalized.includes('scheduled') || normalized.includes('not')) return 'Start Session';
  return action?.label || 'Open Session';
}

function accessoryCountLine(count?: number | null) {
  if (!count) return 'No accessories';
  return `${count} accessor${count === 1 ? 'y' : 'ies'}`;
}

function buildTodayTrainingSummary(
  lifts?: string[] | null,
  coreCount?: number | null,
  accessoryCount?: number | null,
  isWorkout?: boolean
) {
  if (!isWorkout) {
    return { mainLine: 'No session scheduled', workLine: '' };
  }

  const cleaned = (lifts || []).map((lift) => String(lift || '').trim()).filter(Boolean);
  const baseLiftSet = new Set<string>();
  let detectedVariants = 0;

  cleaned.forEach((lift) => {
    const classification = classifyTodayMovement(lift);
    if (classification.kind === 'base') {
      baseLiftSet.add(classification.label);
    } else if (classification.kind === 'variant') {
      detectedVariants += 1;
    }
  });

  const orderedBases = ['Squat', 'Bench', 'Deadlift'].filter((lift) => baseLiftSet.has(lift));
  const mainLine = orderedBases.length ? orderedBases.join(' / ') : cleaned[0] ? cleanTodayMovementLabel(cleaned[0]) : 'Programmed training';
  const variantCount = Math.max(0, detectedVariants || ((coreCount ?? 0) - orderedBases.length));
  const parts = [
    variantCount > 0 ? `${variantCount} variant${variantCount === 1 ? '' : 's'}` : null,
    variantCount > 0 && !accessoryCount ? null : accessoryCountLine(accessoryCount),
  ].filter(Boolean);

  return {
    mainLine,
    workLine: parts.join(' · '),
  };
}

function classifyTodayMovement(name: string): { kind: 'base' | 'variant' | 'other'; label: string } {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  if (key === 'sq' || key === 'squat' || key === 'comp squat' || key === 'competition squat' || key === 'back squat') {
    return { kind: 'base', label: 'Squat' };
  }
  if (key === 'bn' || key === 'bench' || key === 'comp bench' || key === 'competition bench' || key === 'bench press') {
    return { kind: 'base', label: 'Bench' };
  }
  if (key === 'dl' || key === 'deadlift' || key === 'comp deadlift' || key === 'competition deadlift') {
    return { kind: 'base', label: 'Deadlift' };
  }

  if (/\bsquat\b/.test(key) || /\bbench\b/.test(key) || /\bdeadlift\b/.test(key)) {
    const label = /\bsquat\b/.test(key) ? 'Squat' : /\bbench\b/.test(key) ? 'Bench' : 'Deadlift';
    return { kind: 'variant', label };
  }

  return { kind: 'other', label: cleanTodayMovementLabel(name) };
}

function cleanTodayMovementLabel(name: string) {
  const classification = classifyTodayMovementBaseOnly(name);
  return classification || simplifyMobileMovementName(name);
}

function classifyTodayMovementBaseOnly(name: string) {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (key === 'sq' || key === 'squat' || key === 'comp squat' || key === 'competition squat' || key === 'back squat') return 'Squat';
  if (key === 'bn' || key === 'bench' || key === 'comp bench' || key === 'competition bench' || key === 'bench press') return 'Bench';
  if (key === 'dl' || key === 'deadlift' || key === 'comp deadlift' || key === 'competition deadlift') return 'Deadlift';
  return null;
}

function dayStateTitle(day?: DayTrainingState | null) {
  if (!day || day.kind === 'rest') return 'Rest';
  return day.title || 'Training session';
}

function initials(name?: string | null) {
  const parts = String(name || 'Athlete').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A';
}

function formatShortDate(iso?: string | null) {
  if (!iso) return 'Date TBD';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' }).format(d);
}

function formatWeekdayAbbrev(iso?: string | null) {
  if (!iso) return 'TODAY';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'TODAY';
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
}

function formatNumber(value?: number | null, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 104,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: 10,
  },
  centeredText: {
    color: palette.muted,
    fontSize: 14,
  },
  errorText: {
    color: palette.red,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  presentZone: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: palette.violetSoft,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  todayKicker: {
    color: palette.violetSoft,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  athleteName: {
    color: palette.textStrong,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: 0,
  },
  coachLine: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 2,
  },
  meetPlanEntry: {
    minHeight: 88,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(28,18,20,0.28)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(214,167,94,0.095)',
  },
  meetPlanRail: {
    width: 3,
    backgroundColor: 'rgba(214,167,94,0.52)',
  },
  meetPlanCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  meetPlanTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  meetPlanKicker: {
    color: palette.amber,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  meetPlanTiming: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  meetPlanTitle: {
    color: palette.textStrong,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  meetPlanMeta: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  meetPlanAction: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(214,167,94,0.08)',
  },
  meetPlanActionText: {
    color: palette.violetSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  noProgramGuidance: {
    minHeight: 118,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(24,16,15,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  noProgramRail: {
    width: 3,
    backgroundColor: 'rgba(139,92,246,0.68)',
  },
  noProgramCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingLeft: 14,
    paddingRight: 10,
  },
  noProgramTitle: {
    color: palette.textStrong,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: 0,
  },
  noProgramBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 6,
  },
  noProgramButton: {
    width: 116,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(196,181,253,0.10)',
    backgroundColor: 'rgba(139,92,246,0.075)',
    paddingHorizontal: 10,
  },
  noProgramButtonText: {
    color: palette.textStrong,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  todayTrainingZone: {
    flexDirection: 'row',
    minHeight: 248,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,30,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
    borderRadius: 22,
  },
  todayTrainingZoneCompact: {
    minHeight: 0,
  },
  restDayArtLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '54%',
  },
  restDayImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.64,
  },
  trainingDayImage: {
    opacity: 0.58,
  },
  restDayImageSideFade: {
    ...StyleSheet.absoluteFillObject,
  },
  restDayImageDarken: {
    ...StyleSheet.absoluteFillObject,
  },
  restDayImageWarmth: {
    ...StyleSheet.absoluteFillObject,
  },
  todayTrainingRail: {
    width: 4,
    backgroundColor: 'rgba(214,167,94,0.88)',
    zIndex: 2,
  },
  todayTrainingBody: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    zIndex: 2,
  },
  todayTrainingBodyCompact: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  todayTrainingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  todayTrainingKicker: {
    color: palette.amber,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  todayTrainingTitle: {
    color: palette.textStrong,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: 0,
  },
  todayTrainingTitleCompact: {
    fontSize: 27,
    lineHeight: 31,
  },
  todayTrainingDate: {
    marginTop: 7,
    color: palette.muted,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '800',
  },
  todayTrainingMovements: {
    marginTop: 18,
    color: palette.textStrong,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '900',
  },
  todayTrainingMovementsCompact: {
    marginTop: 10,
    paddingTop: 10,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: palette.muted,
  },
  todayTrainingSummary: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    fontWeight: '800',
  },
  todayFocusContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  todayFocusCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayFocusCopyTraining: {
    maxWidth: '76%',
  },
  todayFocusCopyRest: {
    maxWidth: '72%',
  },
  todayFocusIcon: {
    width: 112,
    height: 112,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.12)',
    backgroundColor: 'rgba(139,92,246,0.10)',
    overflow: 'hidden',
  },
  intentStack: {
    marginTop: 18,
    gap: 10,
  },
  intentPrimary: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(205,194,176,0.075)',
  },
  intentLabel: {
    color: palette.steel,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 5,
  },
  intentValue: {
    color: palette.textStrong,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  intentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  intentMetaLabel: {
    color: palette.subtle,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  intentMetaValue: {
    flex: 1,
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  intentDetails: {
    color: 'rgba(229,231,235,0.72)',
    fontSize: 13,
    lineHeight: 19,
  },
  readinessLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 136,
    paddingVertical: 18,
    paddingRight: 16,
    backgroundColor: 'rgba(18,18,30,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
    borderRadius: 22,
    overflow: 'hidden',
  },
  readinessRail: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(139,92,246,0.88)',
  },
  readinessIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.20)',
  },
  readinessScore: {
    width: 78,
    height: 78,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(167,203,181,0.64)',
    backgroundColor: 'rgba(8,10,12,0.28)',
  },
  readinessScoreValue: {
    color: palette.textStrong,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '900',
  },
  readinessScoreLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  readinessCopy: {
    flex: 1,
    minWidth: 0,
  },
  readinessKicker: {
    color: palette.violetSoft,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 5,
  },
  readinessTitle: {
    color: palette.textStrong,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    marginBottom: 6,
  },
  readinessMessage: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  readinessMetrics: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  primaryAction: {
    minHeight: 62,
    marginTop: 'auto',
    borderRadius: 6,
    backgroundColor: 'rgba(24,16,15,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  primaryActionPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryActionText: {
    color: palette.textStrong,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  primaryActionRail: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: palette.violet,
  },
  primaryActionCopy: {
    flex: 1,
    paddingHorizontal: 14,
  },
  primaryActionKicker: {
    color: palette.violetSoft,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 2,
  },
  primaryActionIcon: {
    width: 42,
    height: 42,
    marginRight: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.10)',
  },
  contextZone: {
    gap: 16,
  },
  coachConnection: {
    gap: 12,
  },
  trainingObjectStack: {
    gap: 16,
  },
  coachPocket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 100,
    backgroundColor: 'rgba(18,18,30,0.50)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingRight: 14,
    overflow: 'hidden',
  },
  coachEmptyLine: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(205,194,176,0.045)',
  },
  coachEmptyText: {
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '700',
  },
  contextRail: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(139,92,246,0.70)',
  },
  trainingSignalIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.14)',
  },
  contextCopy: {
    flex: 1,
    minWidth: 0,
  },
  contextLabel: {
    color: palette.violetSoft,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 5,
  },
  contextTitle: {
    color: palette.textStrong,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  contextBody: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 5,
  },
  rowPressed: {
    opacity: 0.88,
  },
  glanceStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
    minHeight: 136,
  },
  glanceCell: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.15)',
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,30,0.48)',
  },
  glanceDivider: {
    display: 'none',
  },
  glanceLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginTop: 8,
  },
  glanceTitle: {
    color: palette.textStrong,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  glanceMeta: {
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  patchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,8,7,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  patchModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 22,
    backgroundColor: 'rgba(24,16,15,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.22)',
    maxHeight: '84%',
  },
  patchModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  patchModalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,108,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.24)',
  },
  patchModalHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  patchModalTitle: {
    color: palette.textStrong,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
  },
  patchModalSubtitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 3,
  },
  patchModalBody: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  patchModalSubtext: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  patchModalFlow: {
    borderTopColor: 'rgba(222,198,166,0.08)',
    borderTopWidth: 1,
    gap: 0,
    marginBottom: 18,
    marginTop: 4,
  },
  patchModalTour: {
    marginBottom: 18,
    maxHeight: 420,
  },
  patchModalTourContent: {
    borderTopColor: 'rgba(222,198,166,0.08)',
    borderTopWidth: 1,
  },
  patchModalTourRow: {
    borderBottomColor: 'rgba(222,198,166,0.07)',
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 10,
  },
  patchModalFlowRow: {
    borderBottomColor: 'rgba(222,198,166,0.07)',
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 9,
  },
  patchModalFlowLabel: {
    color: palette.textStrong,
    fontSize: 13,
    fontWeight: '900',
  },
  patchModalPurpose: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  patchModalFlowDetail: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  individualWelcomeActions: {
    gap: 10,
  },
  patchModalButton: {
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violet,
  },
  patchModalButtonText: {
    color: palette.textStrong,
    fontSize: 15,
    fontWeight: '900',
  },
  individualWelcomeSecondary: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  individualWelcomeSecondaryText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
});
