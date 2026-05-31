// app/athlete-dashboard.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';

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
  } | null;
  coach?: {
    id?: number;
    name?: string | null;
    email?: string | null;
  } | null;
  phase?: {
    label?: string | null;
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

type TodayResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  today?: TodayPayload | null;
};

const PATCH_NOTE_VERSION = 'strength_ledger_mobile_2_0_athlete_tour_seen';

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
  const { token } = useAuth();
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPatchNote, setShowPatchNote] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkPatchNote = async () => {
      try {
        const seen = await AsyncStorage.getItem(PATCH_NOTE_VERSION);
        if (!cancelled && seen !== '1') setShowPatchNote(true);
      } catch {
        if (!cancelled) setShowPatchNote(true);
      }
    };

    checkPatchNote();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismissPatchNote = async () => {
    setShowPatchNote(false);
    try {
      await AsyncStorage.setItem(PATCH_NOTE_VERSION, '1');
    } catch {
      // no-op
    }
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
      if (action.route === 'workout' && action.workout_id) {
        router.push({
          pathname: '/workout/[workoutId]',
          params: { workoutId: String(action.workout_id) },
        });
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
    [router]
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
      <PatchNoteModal dismissPatchNote={dismissPatchNote} showPatchNote={showPatchNote} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadToday({ silent: true })} tintColor={palette.muted} />
        }
      >
        <PresentState today={today} />
        <TodayTraining onAction={openAction} today={today} />
        <MeetPlanEntry
          meet={today.phase?.meet}
          onPress={() => openAction({ route: 'meet', label: 'View Meet Plan', meet_plan_id: today.phase?.meet?.id })}
        />
        <ReadinessLine today={today} />
        <ContextTray onAction={openAction} today={today} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PresentState({ today }: { today: TodayPayload }) {
  const dateLabel = formatLongDate(today.date);
  const athleteName = today.athlete?.name || 'Athlete';
  const phaseLine = buildPhaseLine(today);

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
          <Text style={styles.todayKicker}>Today</Text>
          <Text style={styles.athleteName}>{athleteName}</Text>
          <Text style={styles.coachLine}>
            {today.coach?.name ? `Coached by ${today.coach.name}` : 'Training companion'}
          </Text>
        </View>
      </View>

      <View style={styles.presentStrip}>
        <Text style={styles.dateText}>{dateLabel}</Text>
        <View style={styles.presentDivider} />
        <Text style={styles.phaseText} numberOfLines={1}>{phaseLine}</Text>
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
  onAction,
  today,
}: {
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
  const trainingSummary = buildTodayTrainingSummary(
    preview?.primary_lifts?.length ? preview.primary_lifts : mission?.focus,
    preview?.core_count,
    preview?.accessory_count,
    hasSession
  );
  const actionLabel = actionLabelForSession(sessionAction, mission?.status, hasSession);
  const sessionLabel = hasSession ? session?.label || mission?.title || 'Today' : 'Recovery day';
  const sessionDate = session?.date ? formatShortDate(session.date) : mission?.date ? formatShortDate(mission.date) : formatShortDate(today.date);

  return (
    <View style={[styles.todayTrainingZone, !hasSession && styles.todayTrainingZoneCompact]}>
      <View style={styles.todayTrainingRail} />
      <View style={[styles.todayTrainingBody, !hasSession && styles.todayTrainingBodyCompact]}>
        <View style={styles.todayTrainingTopRow}>
          <Text style={styles.todayTrainingKicker}>Today's Training</Text>
          <StatusPill value={hasSession ? mission?.status : 'rest'} />
        </View>

        <Text style={[styles.todayTrainingTitle, !hasSession && styles.todayTrainingTitleCompact]}>{sessionLabel}</Text>
        <Text style={styles.todayTrainingDate}>{sessionDate}</Text>
        <Text style={[styles.todayTrainingMovements, !hasSession && styles.todayTrainingMovementsCompact]} numberOfLines={2}>{trainingSummary.mainLine}</Text>
        {trainingSummary.workLine ? (
          <Text style={styles.todayTrainingSummary} numberOfLines={1}>{trainingSummary.workLine}</Text>
        ) : null}

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

function ReadinessLine({ today }: { today: TodayPayload }) {
  const readiness = today.readiness;
  const score = formatNumber(readiness?.score, 1);
  const metrics = readiness?.metrics || {};
  const metricLine = [
    ['Sleep', metrics.sleep],
    ['Energy', metrics.energy],
    ['Soreness', metrics.soreness],
    ['Stress', metrics.stress],
  ]
    .filter(([, value]) => value != null)
    .slice(0, 3)
    .map(([label, value]) => `${label} ${formatNumber(value as number, 1)}`);

  return (
    <View style={styles.readinessLine}>
      <View style={styles.readinessRail} />
      <View style={styles.readinessScore}>
        <Text style={styles.readinessScoreValue}>{score}</Text>
        <Text style={styles.readinessScoreLabel}>Ready</Text>
      </View>
      <View style={styles.readinessCopy}>
        <Text style={styles.readinessMessage}>{readiness?.message || 'Readiness context will appear after check-ins.'}</Text>
        {metricLine.length > 0 ? <Text style={styles.readinessMetrics}>{metricLine.join(' / ')}</Text> : null}
      </View>
    </View>
  );
}

function ContextTray({
  onAction,
  today,
}: {
  onAction: (action?: TodayAction | null) => void;
  today: TodayPayload;
}) {
  const yesterday = today.yesterday;
  const tomorrow = today.tomorrow;
  const hasConnection = !!(today.latest_announcement || today.latest_message);

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

      {hasConnection ? (
        <View style={styles.coachConnection}>
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

function CoachConnectionRow({
  item,
  label,
  onPress,
}: {
  item: CoachConnectionItem;
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

function StatusPill({ value }: { value?: string | null }) {
  const status = String(value || '').replace('_', ' ');
  if (!status || status === 'rest') {
    return <Text style={styles.statusText}>Rest</Text>;
  }
  return <Text style={styles.statusText}>{status}</Text>;
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

function buildPhaseLine(today: TodayPayload) {
  const meet = today.phase?.meet;
  const block = today.phase?.block;
  if (meet?.days_until === 0) return 'Meet day';
  if (meet?.days_until != null && meet?.name) return `${meet.name} / ${meet.days_until} days out`;
  if (block?.name) return block.name;
  return today.phase?.label || 'Training phase';
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
  return classification || name.replace(/\b(comp|competition)\b/gi, '').replace(/\s+/g, ' ').trim();
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

function formatLongDate(iso?: string | null) {
  if (!iso) return 'Today';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat([], { weekday: 'long', month: 'short', day: 'numeric' }).format(d);
}

function formatShortDate(iso?: string | null) {
  if (!iso) return 'Date TBD';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' }).format(d);
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
    paddingTop: 10,
    paddingBottom: 104,
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
    paddingVertical: 8,
    marginBottom: 8,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.violetDim,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.26)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: palette.violetSoft,
    fontSize: 17,
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
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: 0,
  },
  coachLine: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  presentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.rail,
  },
  dateText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  presentDivider: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: palette.subtle,
  },
  phaseText: {
    flex: 1,
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
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
  todayTrainingZone: {
    flexDirection: 'row',
    minHeight: 250,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(24,16,15,0.24)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(205,194,176,0.055)',
  },
  todayTrainingZoneCompact: {
    minHeight: 0,
    marginBottom: 8,
  },
  todayTrainingRail: {
    width: 4,
    backgroundColor: 'rgba(214,167,94,0.64)',
  },
  todayTrainingBody: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
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
    marginBottom: 14,
  },
  todayTrainingKicker: {
    color: palette.amber,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  statusText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  todayTrainingTitle: {
    color: palette.textStrong,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: 0,
  },
  todayTrainingTitleCompact: {
    fontSize: 27,
    lineHeight: 31,
  },
  todayTrainingDate: {
    marginTop: 4,
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  todayTrainingMovements: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(205,194,176,0.075)',
    color: palette.textStrong,
    fontSize: 18,
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
    gap: 12,
    marginTop: 20,
    paddingVertical: 13,
    paddingRight: 12,
    backgroundColor: 'rgba(24,16,15,0.22)',
  },
  readinessRail: {
    width: 2,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(166,129,88,0.42)',
  },
  readinessScore: {
    width: 54,
  },
  readinessScoreValue: {
    color: palette.textStrong,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '900',
  },
  readinessScoreLabel: {
    color: palette.steel,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  readinessCopy: {
    flex: 1,
    minWidth: 0,
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
    gap: 8,
  },
  coachConnection: {
    gap: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(205,194,176,0.055)',
  },
  coachPocket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 104,
    backgroundColor: 'rgba(24,16,15,0.18)',
    paddingVertical: 13,
    paddingRight: 12,
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
    width: 2,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(196,181,253,0.24)',
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
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  contextBody: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  rowPressed: {
    opacity: 0.88,
  },
  glanceStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 112,
    backgroundColor: 'rgba(24,16,15,0.14)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(205,194,176,0.045)',
  },
  glanceCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  glanceDivider: {
    width: 1,
    backgroundColor: palette.rail,
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
    fontSize: 15,
    lineHeight: 20,
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
});
