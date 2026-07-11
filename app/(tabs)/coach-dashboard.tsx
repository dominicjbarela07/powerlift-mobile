// app/coach-dashboard.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import RefreshScreen from '@/components/refresh-screen';
import { NewCoachExperience, type NewCoachExperiencePayload } from '@/components/NewCoachExperience';
import {
  SLAthleteAvatar,
  SLErrorState,
  SLLoadingState,
  SLScreen,
  SLStatusPill,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchJson, isAccountStateBlockedPayload } from '@/lib/api';
import { SLColors, SLRadius, SLShadows, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';

type CoachDashboardAthleteRef = {
  id: number;
  name: string;
};

type CoachDashboardReviewAthleteRef = {
  id: number;
  name: string;
  count?: number;
};

type CoachDashboardRecentActivityItem = {
  kind: 'logged' | 'missed' | 'assigned' | 'tardy';
  athlete_name: string;
  session_name: string;
  detail?: string | null;
  when: string;
  workout_id: number;
  athlete_id: number;
  status: string;
};

type CoachDashboardUpcomingItem = {
  athlete_name: string;
  session_name: string;
  workout_id: number;
  athlete_id: number;
  status: string;
};

type CoachDashboardUpcomingDay = {
  date_iso: string;
  dow: string;
  md: string;
  date_label: string;
  items: CoachDashboardUpcomingItem[];
};

type CoachDashboardWorkflowItem = {
  athlete_id: number;
  athlete_name: string;
  programmed_through_date?: string | null;
  last_completed_date?: string | null;
  next_assigned_date?: string | null;
  days_remaining?: number | null;
  days_since_last_completed?: number | null;
  workflow_status?: string | null;
};

type CoachDashboardResponse = {
  ok: boolean;
  coach_name?: string;
  coach_logo_url?: string | null;
  total: number;
  athlete_count?: number;
  drafts: number;
  today_assigned: number;
  today_logged: number;
  missed_yesterday: number;
  pending_approvals: number;
  pending_reviews: number;
  workflow_programming_now?: number;
  workflow_programming_soon?: number;
  workflow_upcoming_reminders?: number;
  workflow_fully_programmed?: number;
  workflow_roster_count?: number;
  workflow_roster_uptodate_pct?: number;
  workflow_avg_horizon_days?: number | null;
  workflow_snapshot?: CoachDashboardWorkflowItem[];
  no_log_3plus: CoachDashboardAthleteRef[];
  missed_yesterday_athletes?: CoachDashboardAthleteRef[];
  pending_reviews_athletes?: CoachDashboardReviewAthleteRef[];
  recent_activity?: CoachDashboardRecentActivityItem[];
  upcoming_days?: CoachDashboardUpcomingDay[];
  new_coach_experience?: NewCoachExperiencePayload | null;
};

type QueueItem = {
  key: string;
  title: string;
  subtitle: string;
  meta?: string;
  athleteName?: string | null;
  statusLabel?: string;
  statusTone?: SLStatusTone;
  priority?: 'high' | 'medium' | 'low' | 'neutral';
  priorityLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  route?: string;
  routeParams?: Record<string, string>;
  workoutId?: number;
  athleteRoute?: {
    id: number;
    name: string;
  };
};

type MetricItem = {
  label: string;
  value: string | number;
  tone?: SLStatusTone;
};

const ROUTES = {
  coachRoster: '/coach-roster',
  coachVideos: '/(tabs)/coach-videos',
  createWorkout: '/create-workout',
  messages: '/(tabs)/messages',
  sessionSurveys: '/(tabs)/session-surveys',
  kpiDrafts: '/coach-kpi/drafts',
  kpiMissedYesterday: '/coach-kpi/missed_yesterday',
  kpiTodayAssigned: '/coach-kpi/today_assigned',
  kpiTodayLogged: '/coach-kpi/today_logged',
} as const;

const PATCH_NOTE_VERSION = 'strength_ledger_mobile_2_0_patch_notes_seen';

const TODAY_MATERIAL = {
  canvas: 'transparent',
  canvasWarm: 'transparent',
  graphiteWarm: 'rgba(13, 14, 14, 0.22)',
  graphiteSoft: 'rgba(8, 8, 10, 0.44)',
  graphiteInset: 'rgba(6, 6, 7, 0.30)',
  commandTop: 'rgba(8, 8, 10, 0.60)',
  commandBottom: '#070A10',
  hairlineWarm: 'rgba(255, 255, 255, 0.052)',
  violetWash: 'rgba(139, 92, 246, 0.045)',
  steelWash: 'rgba(126, 166, 184, 0.08)',
} as const;

function compactDateLabel() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

function workflowLabel(item: CoachDashboardWorkflowItem) {
  const days = item.days_remaining;
  if (typeof days === 'number') {
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
    if (days === 0) return 'Runs out today';
    return `${days} day${days === 1 ? '' : 's'} remaining`;
  }
  return 'Programming horizon unknown';
}

export default function CoachDashboardScreen() {
  const router = useRouter();
  const { user, token, applyAccountStatePayload } = useAuth();
  const isIndividual =
    user?.workspace_mode === 'individual' ||
      user?.is_individual_workspace === true ||
      user?.is_self_coached === true;

  const [data, setData] = useState<CoachDashboardResponse | null>(null);
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

  const dismissPatchNote = useCallback(async () => {
    setShowPatchNote(false);
    try {
      await AsyncStorage.setItem(PATCH_NOTE_VERSION, '1');
    } catch {
      // no-op
    }
  }, []);

  const displayName = useMemo(() => {
    const payloadName = (data?.coach_name || '').trim();
    if (payloadName) return payloadName;

    if (!user || typeof user !== 'object') return 'Coach';

    const getString = (obj: Record<string, unknown>, key: string) => {
      if (!(key in obj)) return '';
      const value = obj[key];
      return typeof value === 'string' ? value.trim() : '';
    };

    const userObj = user as Record<string, unknown>;
    const direct =
      getString(userObj, 'name') ||
      getString(userObj, 'full_name') ||
      getString(userObj, 'display_name') ||
      getString(userObj, 'coach_name');

    if (direct) return direct;

    const first = getString(userObj, 'first_name') || getString(userObj, 'firstName');
    const last = getString(userObj, 'last_name') || getString(userObj, 'lastName');
    const combined = [first, last].filter(Boolean).join(' ').trim();

    return combined || 'Coach';
  }, [data?.coach_name, user]);

  const loadDashboard = useCallback(
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
          setData(null);
          return;
        }

        const res: any = await fetchJson('/coach/mobile/dashboard', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const status = Number(res?.status ?? 0);
        const payload = res?.json ?? res;

        if (res?.ok !== true) {
          if (isAccountStateBlockedPayload(payload)) {
            await applyAccountStatePayload(payload);
            setData(null);
            router.replace('/');
            return;
          }
          const msg = payload?.error || payload?.message || `Request failed (${status || 'unknown'})`;
          setError(String(msg));
          setData(null);

          if (status === 401) {
            router.replace('/login');
          }
          return;
        }

        if (!payload || typeof payload !== 'object') {
          setError('Bad response (non-object).');
          setData(null);
          return;
        }

        if (payload.ok !== true) {
          const msg = payload?.error || payload?.message || 'Failed to load coach dashboard.';
          setError(String(msg));
          setData(null);
          return;
        }

        setData(payload as CoachDashboardResponse);
      } catch (e) {
        console.log('Coach dashboard load error', e);
        const msg = (e as any)?.message || String(e);
        setError(`Network/parse error: ${msg}`);
        setData(null);
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [applyAccountStatePayload, token, router]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboard({ silent: true });
    }, [loadDashboard])
  );

  const onRefresh = useCallback(async () => {
    await loadDashboard({ silent: true });
  }, [loadDashboard]);

  const openRoute = useCallback(
    (route?: string, routeParams?: Record<string, string>) => {
      if (!route) return;
      if (routeParams) {
        router.push({ pathname: route as any, params: routeParams } as any);
        return;
      }
      router.push(route as any);
    },
    [router]
  );

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

  const openAthlete = useCallback(
    (athlete?: { id: number; name: string }) => {
      if (!athlete) return;
      router.push({
        pathname: '/(tabs)/coach-athlete/[athleteId]',
        params: { athleteId: String(athlete.id), athleteName: athlete.name },
      } as any);
    },
    [router]
  );

  const programmingRows = useMemo(() => {
    const rows = data?.workflow_snapshot ?? [];
    return rows
      .filter((row) => {
        const status = String(row.workflow_status || '').toLowerCase();
        const days = row.days_remaining;
        return status.includes('need') || status.includes('soon') || (typeof days === 'number' && days <= 3);
      })
      .sort((a, b) => {
        const aDays = typeof a.days_remaining === 'number' ? a.days_remaining : 999;
        const bDays = typeof b.days_remaining === 'number' ? b.days_remaining : 999;
        return aDays - bDays || a.athlete_name.localeCompare(b.athlete_name);
      })
      .slice(0, 5);
  }, [data?.workflow_snapshot]);

  const needsAction = useMemo(() => {
    if (!data) return [] as QueueItem[];

    const items: QueueItem[] = [];

    (data.pending_reviews_athletes || []).forEach((athlete) => {
      const count = athlete.count ?? 1;
      items.push({
        key: `review-${athlete.id}`,
        title: athlete.name,
        subtitle: 'Session feedback is waiting for coach review.',
        athleteName: athlete.name,
        statusLabel: `${count} review${count === 1 ? '' : 's'}`,
        statusTone: 'review',
        priority: count > 1 ? 'high' : 'medium',
        priorityLabel: 'Review',
        route: ROUTES.sessionSurveys,
        routeParams: { athleteId: String(athlete.id), athleteName: athlete.name },
      });
    });

    (data.missed_yesterday_athletes || []).forEach((athlete) => {
      items.push({
        key: `missed-${athlete.id}`,
        title: athlete.name,
        subtitle: "Missed yesterday's assigned session.",
        athleteName: athlete.name,
        statusLabel: 'Missed',
        statusTone: 'warning',
        priority: 'high',
        priorityLabel: 'Follow up',
        route: ROUTES.kpiMissedYesterday,
      });
    });

    (data.no_log_3plus || []).forEach((athlete) => {
      items.push({
        key: `stale-${athlete.id}`,
        title: athlete.name,
        subtitle: 'No log for 3+ days. Open athlete context before messaging or adjusting.',
        athleteName: athlete.name,
        statusLabel: 'Stale',
        statusTone: 'danger',
        priority: 'high',
        priorityLabel: 'Check in',
        athleteRoute: { id: athlete.id, name: athlete.name },
      });
    });

    programmingRows.slice(0, 3).forEach((row) => {
      const days = row.days_remaining;
      items.push({
        key: `programming-${row.athlete_id}`,
        title: row.athlete_name,
        subtitle: workflowLabel(row),
        athleteName: row.athlete_name,
        statusLabel: typeof days === 'number' && days <= 0 ? 'Program now' : 'Due soon',
        statusTone: typeof days === 'number' && days <= 0 ? 'danger' : 'warning',
        priority: typeof days === 'number' && days <= 0 ? 'high' : 'medium',
        priorityLabel: 'Programming',
        athleteRoute: { id: row.athlete_id, name: row.athlete_name },
      });
    });

    if (!items.length && (data.drafts ?? 0) > 0) {
      items.push({
        key: 'drafts',
        title: 'Draft sessions',
        subtitle: `${data.drafts} draft${data.drafts === 1 ? '' : 's'} are not assigned.`,
        statusLabel: String(data.drafts),
        statusTone: 'accent',
        priority: 'low',
        priorityLabel: 'Clean up',
        route: ROUTES.kpiDrafts,
        icon: 'document-text-outline',
      });
    }

    return items.slice(0, 7);
  }, [data, programmingRows]);

  const reviewQueue = useMemo(() => {
    if (!data) return [] as QueueItem[];

    const items: QueueItem[] = [];

    if ((data.pending_reviews ?? 0) > 0) {
      items.push({
        key: 'session-reviews',
        title: 'Session feedback',
        subtitle: 'Review athlete post-session notes and mark handled.',
        statusLabel: `${data.pending_reviews}`,
        statusTone: 'review',
        priority: 'high',
        priorityLabel: 'Review',
        icon: 'clipboard-outline',
        route: ROUTES.sessionSurveys,
      });
    }

    items.push({
      key: 'video-inbox',
      title: 'Set video inbox',
      subtitle:
        (data.pending_approvals ?? 0) > 0
          ? 'Submitted videos are waiting for review.'
          : 'Open submitted set videos with context HUD playback.',
      statusLabel: (data.pending_approvals ?? 0) > 0 ? `${data.pending_approvals}` : 'Open',
      statusTone: (data.pending_approvals ?? 0) > 0 ? 'review' : 'neutral',
      priority: (data.pending_approvals ?? 0) > 0 ? 'high' : 'neutral',
      priorityLabel: (data.pending_approvals ?? 0) > 0 ? 'Video' : undefined,
      icon: 'videocam-outline',
      route: ROUTES.coachVideos,
    });

    return items;
  }, [data]);

  const upcomingSessions = useMemo(() => {
    return (data?.upcoming_days ?? []).flatMap((day) =>
      (day.items || []).slice(0, 3).map((item, idx) => ({
        ...item,
        key: `${day.date_iso}-${item.workout_id}-${idx}`,
        dateLabel: day.date_label,
        dow: day.dow,
      }))
    ).slice(0, 6);
  }, [data?.upcoming_days]);

  const recentActivity = useMemo(() => {
    if (!data?.recent_activity) return [] as QueueItem[];

    return data.recent_activity.slice(0, 5).map((item, idx): QueueItem => {
      const actionLabel =
        item.kind === 'logged'
          ? 'completed'
          : item.kind === 'missed'
          ? 'missed'
          : item.kind === 'tardy'
          ? 'logged late'
          : 'was assigned';

      const title = `${item.athlete_name} ${actionLabel} ${item.session_name}`;
      const when = String(item.when || '').trim();
      const meta = item.kind === 'tardy' && item.detail ? `${when || 'Recently'} · ${item.detail}` : when || 'Recently';

      return {
        key: `recent-${item.workout_id}-${idx}`,
        title,
        subtitle: meta,
        statusLabel:
          item.kind === 'logged'
            ? 'Logged'
            : item.kind === 'missed'
            ? 'Missed'
            : item.kind === 'tardy'
            ? 'Late'
            : 'Assigned',
        statusTone:
          item.kind === 'logged'
            ? 'success'
            : item.kind === 'missed'
            ? 'warning'
            : item.kind === 'tardy'
            ? 'accent'
            : 'neutral',
        icon:
          item.kind === 'logged'
            ? 'checkmark-circle-outline'
            : item.kind === 'missed'
            ? 'alert-circle-outline'
            : 'time-outline',
        route: item.workout_id ? undefined : ROUTES.kpiTodayLogged,
        workoutId: item.workout_id,
      };
    });
  }, [data?.recent_activity]);

  const priorityMetrics = useMemo(() => {
    const pendingReviews = data?.pending_reviews ?? 0;
    const missed = data?.missed_yesterday ?? 0;
    const programmingNow = data?.workflow_programming_now ?? 0;
    const programmingSoon = data?.workflow_programming_soon ?? 0;

    const metrics: MetricItem[] = [
      {
        label: 'Reviews',
        value: pendingReviews,
        tone: pendingReviews > 0 ? 'review' : 'neutral',
      },
      {
        label: 'Missed',
        value: missed,
        tone: missed > 0 ? 'warning' : 'neutral',
      },
      {
        label: 'Program now',
        value: programmingNow,
        tone: programmingNow > 0 ? 'danger' : 'neutral',
      },
      {
        label: 'Due soon',
        value: programmingSoon,
        tone: programmingSoon > 0 ? 'warning' : 'neutral',
      },
    ];

    return metrics;
  }, [data]);

  const firstAction = needsAction[0];

  if (loading && !data) {
    return (
      <SLScreen edges="none">
        <View style={styles.centerState}>
          <SLLoadingState message="Building the command center..." title="Loading Today" />
        </View>
      </SLScreen>
    );
  }

  return (
    <SLScreen edges="none" padded={false}>
      <CoachPatchNoteModal dismissPatchNote={dismissPatchNote} showPatchNote={showPatchNote} />
      <RefreshScreen
        contentContainerStyle={styles.scrollContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        style={styles.scroll}
      >
        <View style={styles.commandSurface}>
          <View style={styles.commandRail} />
          <View style={styles.headerTop}>
            <View style={styles.coachAvatar}>
              {data?.coach_logo_url ? (
                <Image source={{ uri: data.coach_logo_url }} style={styles.coachAvatarImage} />
              ) : (
                <SLAthleteAvatar name={displayName} size={44} />
              )}
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Forward Operating Base</Text>
              <Text style={styles.title}>Today</Text>
              <Text style={styles.subtitle}>
                {compactDateLabel()} / {displayName}
              </Text>
            </View>
          </View>
          <View style={styles.headerMetaRow}>
            <SLStatusPill
              icon="people-outline"
              label={`${data?.athlete_count ?? data?.total ?? 0} athlete${(data?.athlete_count ?? data?.total ?? 0) === 1 ? '' : 's'}`}
              tone="neutral"
            />
            {typeof data?.workflow_roster_uptodate_pct === 'number' ? (
              <SLStatusPill label={`${data.workflow_roster_uptodate_pct}% programmed`} tone="success" />
            ) : null}
          </View>
        </View>

        {error ? (
          <SLErrorState
            actionLabel="Try Again"
            message={error}
            onActionPress={() => loadDashboard()}
            style={styles.sectionGap}
            title="Could not load Today"
          />
        ) : null}

        {data?.new_coach_experience ? (
          <NewCoachExperience
            experience={data.new_coach_experience}
            onPrimaryPress={() => router.push('/(tabs)/coach-invite-athlete' as any)}
            onSecondaryPress={() => router.push('/(tabs)/coach-calendar' as any)}
          />
        ) : null}

        {!data?.new_coach_experience && firstAction ? (
          <Pressable
            onPress={() => {
              if (firstAction.athleteRoute) openAthlete(firstAction.athleteRoute);
              else openRoute(firstAction.route, firstAction.routeParams);
            }}
            style={({ pressed }) => [styles.priorityCommand, pressed && styles.pressed]}
          >
            <View style={[styles.priorityRail, { backgroundColor: toneColor(firstAction.statusTone) }]} />
            <View style={styles.priorityCopy}>
              <Text style={styles.priorityKicker}>Next action</Text>
              <Text style={styles.priorityTitle}>{firstAction.title}</Text>
              <Text numberOfLines={2} style={styles.priorityMeta}>{firstAction.subtitle}</Text>
            </View>
            <View style={styles.priorityCount}>
              <Text style={styles.priorityCountValue}>{needsAction.length}</Text>
              <Text style={styles.priorityCountLabel}>queued</Text>
            </View>
          </Pressable>
        ) : !data?.new_coach_experience ? (
          <View style={styles.clearPanel}>
            <Ionicons color={SLColors.success} name="checkmark-circle-outline" size={22} />
            <View style={styles.clearCopy}>
              <Text style={styles.clearTitle}>No urgent queue items</Text>
              <Text style={styles.clearSubtitle}>Review pulse and upcoming sessions below.</Text>
            </View>
          </View>
        ) : null}

        {!data?.new_coach_experience ? (
        <>
        <View style={styles.tacticalZone}>
          <View style={styles.kpiStrip}>
            {priorityMetrics.map((metric) => (
              <View key={metric.label} style={styles.kpiCell}>
                <Text style={[styles.kpiValue, metric.tone ? { color: toneColor(metric.tone) } : null]}>{metric.value}</Text>
                <Text numberOfLines={1} style={styles.kpiLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>

          <LedgerSection
            actionLabel={needsAction.length > 3 && !isIndividual ? 'Roster' : undefined}
            primary
            onActionPress={needsAction.length > 3 && !isIndividual ? () => router.push(ROUTES.coachRoster as any) : undefined}
            title="Needs Action"
          >
            {needsAction.length > 0 ? (
              <View style={styles.commandQueue}>
                {needsAction.map((item, index) => (
                  <LedgerRow
                    key={item.key}
                    item={item}
                    onPress={() => {
                      if (item.athleteRoute) openAthlete(item.athleteRoute);
                      else openRoute(item.route, item.routeParams);
                    }}
                    rank={index + 1}
                    dominant={index === 0}
                  />
                ))}
              </View>
            ) : (
              <InlineEmpty title="Queue clear" />
            )}
          </LedgerSection>

          <LedgerSection
            actionLabel="Open videos"
            onActionPress={() => router.push(ROUTES.coachVideos as any)}
            title="Review Queue"
          >
            <View style={styles.ledgerList}>
              {reviewQueue.map((item) => (
                <LedgerRow
                  key={item.key}
                  item={item}
                  onPress={() => openRoute(item.route, item.routeParams)}
                />
              ))}
            </View>
          </LedgerSection>
        </View>

        <View style={styles.lowerPlane}>
          <LedgerSection
            actionLabel={isIndividual ? undefined : 'Roster'}
            onActionPress={isIndividual ? undefined : () => router.push(ROUTES.coachRoster as any)}
            title="Programming Horizon"
          >
            <View style={styles.ledgerList}>
              {programmingRows.length > 0 ? (
                programmingRows.map((item) => (
                  <PlanningRow
                    key={`horizon-${item.athlete_id}`}
                    name={item.athlete_name}
                    horizon={workflowLabel(item)}
                    meta={item.programmed_through_date ? `Through ${item.programmed_through_date}` : undefined}
                    tone={typeof item.days_remaining === 'number' && item.days_remaining <= 0 ? 'danger' : 'warning'}
                    onPress={() => openAthlete({ id: item.athlete_id, name: item.athlete_name })}
                  />
                ))
              ) : (
                <InlineEmpty
                  title="Programming coverage stable"
                  detail={typeof data?.workflow_avg_horizon_days === 'number' ? `Average horizon: ${data.workflow_avg_horizon_days} days` : undefined}
                />
              )}

              {upcomingSessions.length > 0 ? (
                <View style={styles.upcomingWrap}>
                  <Text style={styles.subsectionLabel}>Upcoming sessions</Text>
                  {upcomingSessions.map((item) => (
                    <FeedRow
                      key={item.key}
                      title={item.athlete_name}
                      detail={item.session_name}
                      meta={item.dateLabel}
                      onPress={() => openWorkout(item.workout_id)}
                      tone="info"
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </LedgerSection>

          <LedgerSection title="Team Pulse">
            <View style={styles.feedList}>
              <FeedRow
                icon="calendar-outline"
                onPress={() => router.push(ROUTES.kpiTodayAssigned as any)}
                meta={`${data?.today_assigned ?? 0}`}
                tone="info"
                title="Today's assigned work"
              />
              <FeedRow
                icon="checkmark-circle-outline"
                onPress={() => router.push(ROUTES.kpiTodayLogged as any)}
                meta={`${data?.today_logged ?? 0}`}
                tone={(data?.today_logged ?? 0) > 0 ? 'success' : 'neutral'}
                title="Today's logged work"
              />
              {recentActivity.length > 0 ? (
                recentActivity.map((item) => (
                  <FeedRow
                    icon={item.icon}
                    key={item.key}
                    onPress={() => {
                      if (item.workoutId) openWorkout(item.workoutId);
                      else openRoute(item.route, item.routeParams);
                    }}
                    detail={item.subtitle}
                    meta={item.statusLabel}
                    tone={item.statusTone}
                    title={item.title}
                  />
                ))
              ) : (
                <InlineEmpty title="No recent pulse yet" />
              )}
            </View>
          </LedgerSection>
        </View>

        <UtilityDock
          actions={[
            { icon: 'add-circle-outline', label: 'Create', onPress: () => router.push(ROUTES.createWorkout as any), tone: 'accent' },
            ...(!isIndividual
              ? [
                  { icon: 'people-outline' as const, label: 'Roster', onPress: () => router.push(ROUTES.coachRoster as any), tone: 'info' as const },
                  { icon: 'chatbubbles-outline' as const, label: 'Messages', onPress: () => router.push(ROUTES.messages as any), tone: 'neutral' as const },
                ]
              : []),
            { icon: 'videocam-outline', label: 'Videos', onPress: () => router.push(ROUTES.coachVideos as any), tone: 'review' },
          ]}
        />
        </>
        ) : null}
      </RefreshScreen>
    </SLScreen>
  );
}

function CoachPatchNoteModal({
  dismissPatchNote,
  showPatchNote,
}: {
  dismissPatchNote: () => void;
  showPatchNote: boolean;
}) {
  const highlights = [
    ['Athlete Today', 'a clearer answer to what needs to happen today'],
    ['Reflection', 'coaching focus, feedback, and film study in one place'],
    ['Film Room', 'movement study instead of a generic video archive'],
    ['Progression and Calendar', 'growth and training rhythm made easier to read'],
    ['Meet Packet', 'meet prep and meet-day logging for visible plans'],
    ['Coaching Focus', 'set active Squat, Bench, and Deadlift cues for athletes'],
  ];

  return (
    <Modal visible={showPatchNote} transparent animationType="fade" onRequestClose={dismissPatchNote}>
      <View style={styles.patchModalBackdrop}>
        <View style={styles.patchModalCard}>
          <View style={styles.patchModalIconWrap}>
            <Ionicons name="sparkles" size={22} color={SLColors.accentViolet} />
          </View>
          <Text style={styles.patchModalTitle}>Mobile 2.0 is live</Text>
          <Text style={styles.patchModalBody}>
            Your athletes now have a refreshed mobile experience for training, feedback, progression, film study, and meet prep.
          </Text>
          <Text style={styles.patchModalSubtext}>
            Use Coaching Focus to set the main Squat, Bench, and Deadlift cues your athlete should keep in mind.
          </Text>
          <View style={styles.patchModalFlow}>
            {highlights.map(([label, detail]) => (
              <View key={label} style={styles.patchModalFlowRow}>
                <Text style={styles.patchModalFlowLabel}>{label}</Text>
                <Text style={styles.patchModalFlowDetail}>{detail}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={dismissPatchNote}
            style={({ pressed }) => [styles.patchModalButton, pressed && styles.pressed]}
          >
            <Text style={styles.patchModalButtonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function toneColor(tone?: SLStatusTone) {
  if (!tone) return SLColors.accentSteel;
  return SLStatusTones[tone]?.icon ?? SLColors.accentSteel;
}

function LedgerSection({
  title,
  actionLabel,
  onActionPress,
  primary = false,
  children,
}: {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.ledgerSection, primary && styles.ledgerSectionPrimary]}>
      <View style={styles.ledgerHeader}>
        <View style={[styles.sectionRail, primary && styles.sectionRailPrimary]} />
        <Text style={[styles.ledgerTitle, primary && styles.ledgerTitlePrimary]}>{title}</Text>
        {actionLabel && onActionPress ? (
          <Pressable onPress={onActionPress} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}>
            <Text style={styles.sectionActionText}>{actionLabel}</Text>
            <Ionicons color={SLColors.accentSteel} name="chevron-forward" size={14} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function LedgerRow({
  item,
  onPress,
  rank,
  dominant = false,
}: {
  item: QueueItem;
  onPress: () => void;
  rank?: number;
  dominant?: boolean;
}) {
  const rail = toneColor(item.statusTone);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ledgerRow, dominant && styles.ledgerRowDominant, pressed && styles.pressed]}>
      <View style={[styles.ledgerRowRail, { backgroundColor: rail }]} />
      {typeof rank === 'number' ? <Text style={styles.ledgerRank}>{String(rank).padStart(2, '0')}</Text> : null}
      <View style={styles.ledgerIdentity}>
        {item.athleteName ? (
          <SLAthleteAvatar name={item.athleteName} size={dominant ? 34 : 28} />
        ) : (
          <View style={[styles.ledgerIcon, { borderColor: rail }]}>
            <Ionicons color={rail} name={item.icon || 'radio-button-on-outline'} size={16} />
          </View>
        )}
      </View>
      <View style={styles.ledgerCopy}>
        <Text numberOfLines={1} style={[styles.ledgerRowTitle, dominant && styles.ledgerRowTitleDominant]}>
          {item.title}
        </Text>
        <Text numberOfLines={dominant ? 2 : 1} style={styles.ledgerRowMeta}>
          {item.meta || item.subtitle}
        </Text>
      </View>
      {item.statusLabel ? (
        <View style={styles.ledgerStatusWrap}>
          <Text style={[styles.ledgerStatus, { color: rail }]}>{item.statusLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function PlanningRow({
  name,
  horizon,
  meta,
  tone,
  onPress,
}: {
  name: string;
  horizon: string;
  meta?: string;
  tone?: SLStatusTone;
  onPress: () => void;
}) {
  const rail = toneColor(tone);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.planningRow, pressed && styles.pressed]}>
      <View style={[styles.planningMarker, { backgroundColor: rail }]} />
      <View style={styles.planningCopy}>
        <Text numberOfLines={1} style={styles.planningName}>{name}</Text>
        <Text numberOfLines={1} style={styles.planningHorizon}>{horizon}</Text>
      </View>
      {meta ? <Text numberOfLines={1} style={styles.planningMeta}>{meta}</Text> : null}
    </Pressable>
  );
}

function FeedRow({
  title,
  detail,
  meta,
  tone = 'neutral',
  icon,
  onPress,
}: {
  title: string;
  detail?: string;
  meta?: string;
  tone?: SLStatusTone;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const rail = toneColor(tone);

  const content = (
    <>
      <View style={styles.feedTrack}>
        <View style={[styles.feedDot, { borderColor: rail }]}>
          {icon ? <Ionicons color={rail} name={icon} size={12} /> : null}
        </View>
      </View>
      <View style={styles.feedCopy}>
        <Text numberOfLines={1} style={styles.feedTitle}>{title}</Text>
        {detail ? <Text numberOfLines={1} style={styles.feedDetail}>{detail}</Text> : null}
      </View>
      {meta ? <Text numberOfLines={1} style={styles.feedMeta}>{meta}</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.feedRow, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.feedRow}>
      {content}
    </View>
  );
}

function InlineEmpty({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.inlineEmpty}>
      <Ionicons color={SLColors.textSubtle} name="remove-outline" size={16} />
      <View style={styles.inlineEmptyCopy}>
        <Text style={styles.inlineEmptyTitle}>{title}</Text>
        {detail ? <Text style={styles.inlineEmptyDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

function UtilityDock({
  actions,
}: {
  actions: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    tone?: SLStatusTone;
  }>;
}) {
  return (
    <View style={styles.utilityDock}>
      {actions.map((action) => {
        const color = toneColor(action.tone);
        return (
          <Pressable key={action.label} onPress={action.onPress} style={({ pressed }) => [styles.utilityButton, pressed && styles.pressed]}>
            <Ionicons color={color} name={action.icon} size={17} />
            <Text style={styles.utilityButtonText}>{action.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: TODAY_MATERIAL.canvas,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 44,
    paddingHorizontal: 0,
    paddingTop: 3,
    position: 'relative',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
  },
  headerShell: {
    marginBottom: 0,
  },
  header: {
    gap: SLSpacing.sm,
    padding: SLSpacing.lg,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  coachAvatar: {
    height: 44,
    width: 44,
  },
  coachAvatarImage: {
    borderRadius: SLRadius.radiusCard,
    height: '100%',
    width: '100%',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 2,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sectionGap: {
    marginTop: 0,
  },
  commandSurface: {
    ...SLShadows.shadowCommand,
    backgroundColor: TODAY_MATERIAL.commandTop,
    borderBottomColor: TODAY_MATERIAL.hairlineWarm,
    borderBottomWidth: 1,
    borderRadius: SLRadius.radiusHero,
    minHeight: 138,
    overflow: 'hidden',
    paddingHorizontal: SLSpacing.lg,
    paddingVertical: 18,
    position: 'relative',
  },
  commandRail: {
    backgroundColor: SLColors.railViolet,
    bottom: 0,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  priorityCommand: {
    ...SLShadows.shadowSoft,
    alignItems: 'stretch',
    backgroundColor: TODAY_MATERIAL.graphiteSoft,
    borderBottomColor: TODAY_MATERIAL.hairlineWarm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.md,
    marginTop: -2,
    minHeight: 98,
    overflow: 'hidden',
    paddingRight: SLSpacing.md,
  },
  priorityRail: {
    opacity: 0.82,
    width: 4,
  },
  priorityCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 15,
  },
  priorityKicker: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: SLTypography.utilityLabel.lineHeight,
    textTransform: 'uppercase',
  },
  priorityTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: 22,
    fontWeight: SLTypography.commandTitle.fontWeight,
    letterSpacing: 0,
    lineHeight: 27,
  },
  priorityMeta: {
    color: '#A7AFBA',
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
    marginTop: 3,
  },
  priorityCount: {
    alignItems: 'center',
    borderLeftColor: TODAY_MATERIAL.hairlineWarm,
    borderLeftWidth: 1,
    justifyContent: 'center',
    minWidth: 60,
  },
  priorityCountValue: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.kpiNumber.fontFamily,
    fontSize: 25,
    fontWeight: SLTypography.kpiNumber.fontWeight,
    lineHeight: 29,
  },
  priorityCountLabel: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.35,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.78,
  },
  clearPanel: {
    alignItems: 'center',
    backgroundColor: TODAY_MATERIAL.graphiteSoft,
    borderBottomColor: TODAY_MATERIAL.hairlineWarm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 64,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  clearCopy: {
    flex: 1,
    gap: SLSpacing.xs,
  },
  clearTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    letterSpacing: 0,
  },
  clearSubtitle: {
    color: '#9FA8B4',
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  kpiStrip: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    flexDirection: 'row',
    marginLeft: 10,
    paddingVertical: 10,
  },
  kpiCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  kpiValue: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.kpiNumber.fontFamily,
    fontSize: 21,
    fontWeight: SLTypography.kpiNumber.fontWeight,
    lineHeight: 24,
  },
  kpiLabel: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 13,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  ledgerSection: {
    gap: 9,
  },
  ledgerSectionPrimary: {
    gap: SLSpacing.sm,
  },
  ledgerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 28,
  },
  sectionRail: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    height: 2,
    width: 14,
  },
  sectionRailPrimary: {
    backgroundColor: SLColors.railViolet,
    width: 30,
  },
  ledgerTitle: {
    color: '#A2ACB8',
    fontFamily: SLTypography.sectionLabel.fontFamily,
    fontSize: SLTypography.sectionLabel.fontSize,
    fontWeight: SLTypography.sectionLabel.fontWeight,
    letterSpacing: SLTypography.sectionLabel.letterSpacing,
    lineHeight: SLTypography.sectionLabel.lineHeight,
    textTransform: 'uppercase',
  },
  ledgerTitlePrimary: {
    color: SLColors.textStrong,
  },
  sectionAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginLeft: 'auto',
    minHeight: 28,
  },
  sectionActionText: {
    color: SLColors.accentSteel,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: SLTypography.utilityLabel.lineHeight,
    textTransform: 'uppercase',
  },
  commandQueue: {
    backgroundColor: TODAY_MATERIAL.graphiteInset,
    overflow: 'hidden',
  },
  ledgerList: {
    gap: 0,
  },
  ledgerRow: {
    alignItems: 'center',
    borderBottomColor: TODAY_MATERIAL.hairlineWarm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 60,
    overflow: 'hidden',
    paddingRight: SLSpacing.sm,
  },
  ledgerRowDominant: {
    backgroundColor: 'rgba(12, 13, 15, 0.48)',
    minHeight: 80,
  },
  ledgerRowRail: {
    alignSelf: 'stretch',
    width: 3,
  },
  ledgerRank: {
    color: '#65707D',
    fontFamily: SLTypography.kpiNumber.fontFamily,
    fontSize: 12,
    fontWeight: SLTypography.kpiNumber.fontWeight,
    lineHeight: 16,
    width: 24,
  },
  ledgerIdentity: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
  },
  ledgerIcon: {
    alignItems: 'center',
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
    letterSpacing: 0,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  ledgerRowTitleDominant: {
    fontSize: 15,
    lineHeight: 20,
  },
  ledgerRowMeta: {
    color: '#9BA5B2',
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
    marginTop: 2,
  },
  ledgerStatusWrap: {
    alignItems: 'flex-end',
    maxWidth: 82,
  },
  ledgerStatus: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 13,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  planningRow: {
    alignItems: 'center',
    borderBottomColor: TODAY_MATERIAL.hairlineWarm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 54,
    paddingVertical: SLSpacing.xs,
  },
  planningMarker: {
    height: 18,
    width: 3,
  },
  planningCopy: {
    flex: 1,
    minWidth: 0,
  },
  planningName: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  planningHorizon: {
    color: '#9CA6B1',
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  planningMeta: {
    color: '#6F7A87',
    flexShrink: 1,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: 14,
    maxWidth: 116,
    textAlign: 'right',
  },
  upcomingWrap: {
    borderTopColor: TODAY_MATERIAL.hairlineWarm,
    borderTopWidth: 1,
    gap: 0,
    marginTop: SLSpacing.md,
    paddingTop: SLSpacing.sm,
  },
  subsectionLabel: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: SLTypography.utilityLabel.lineHeight,
    marginBottom: SLSpacing.xs,
    textTransform: 'uppercase',
  },
  feedList: {
    gap: 0,
  },
  feedRow: {
    alignItems: 'center',
    borderBottomColor: TODAY_MATERIAL.hairlineWarm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 52,
    paddingVertical: SLSpacing.xs,
  },
  feedTrack: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: 22,
  },
  feedDot: {
    alignItems: 'center',
    backgroundColor: TODAY_MATERIAL.graphiteInset,
    borderRadius: SLRadius.radiusSharp,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  feedCopy: {
    flex: 1,
    minWidth: 0,
  },
  feedTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  feedDetail: {
    color: '#98A2AF',
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  feedMeta: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 13,
    maxWidth: 92,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  inlineEmpty: {
    alignItems: 'center',
    borderBottomColor: TODAY_MATERIAL.hairlineWarm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 48,
    paddingVertical: SLSpacing.xs,
  },
  inlineEmptyCopy: {
    flex: 1,
    minWidth: 0,
  },
  inlineEmptyTitle: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  inlineEmptyDetail: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  patchModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(3, 3, 5, 0.76)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  patchModalCard: {
    backgroundColor: 'rgba(9, 8, 12, 0.98)',
    borderColor: 'rgba(167,139,250,0.22)',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 380,
    paddingHorizontal: 22,
    paddingVertical: 22,
    width: '100%',
  },
  patchModalIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(124,108,255,0.15)',
    borderColor: 'rgba(167,139,250,0.24)',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginBottom: 14,
    width: 42,
  },
  patchModalTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 26,
    marginBottom: 10,
  },
  patchModalBody: {
    color: SLColors.text,
    fontFamily: SLTypography.body.fontFamily,
    fontSize: 14,
    fontWeight: SLTypography.body.fontWeight,
    lineHeight: 21,
    marginBottom: 10,
  },
  patchModalSubtext: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: 13,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: 19,
    marginBottom: 12,
  },
  patchModalFlow: {
    borderTopColor: 'rgba(255,255,255,0.07)',
    borderTopWidth: 1,
    marginBottom: 18,
  },
  patchModalFlowRow: {
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 9,
  },
  patchModalFlowLabel: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: 13,
    fontWeight: SLTypography.rowTitle.fontWeight,
  },
  patchModalFlowDetail: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: 12,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: 17,
  },
  patchModalButton: {
    alignItems: 'center',
    backgroundColor: SLColors.accentViolet,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
  },
  patchModalButtonText: {
    color: '#FFFFFF',
    fontFamily: SLTypography.buttonLabel.fontFamily,
    fontSize: SLTypography.buttonLabel.fontSize,
    fontWeight: SLTypography.buttonLabel.fontWeight,
  },
  utilityDock: {
    backgroundColor: 'rgba(6, 6, 7, 0.28)',
    borderLeftColor: 'transparent',
    borderLeftWidth: 0,
    borderRadius: SLRadius.radiusControl,
    flexDirection: 'row',
    gap: 1,
    marginLeft: 12,
    overflow: 'hidden',
    paddingLeft: 0,
    position: 'relative',
  },
  utilityButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 8, 10, 0.38)',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 54,
  },
  utilityButtonText: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  tacticalZone: {
    backgroundColor: 'transparent',
    gap: 17,
    marginTop: -2,
    paddingBottom: 18,
    paddingLeft: 0,
    paddingTop: 14,
    position: 'relative',
  },
  lowerPlane: {
    backgroundColor: 'transparent',
    gap: 21,
    paddingBottom: 2,
    paddingLeft: 10,
    paddingTop: 4,
  },
});
