import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Image,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MuscleMap } from '@/components/anatomy/MuscleMap';
import { CoachAthleteHubSheet } from '@/components/coach-mobile/CoachAthleteHubSheet';
import type { CompletedSessionRecapPayload } from '@/components/coach-mobile/CompletedSessionRecap';
import {
  CoachCardChevron,
  CoachSparkline,
  CoachStatusBadge,
  COACH_V2,
} from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLAthleteAvatar, SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text, TextInput } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { API_BASE } from '@/lib/api-base';
import { fetchJson } from '@/lib/api';
import {
  athleteTrainingLabel,
  coachHomeContextKey,
  filterCoachRosterV2,
  formatCoachVolume,
  formatCoachWeight,
  mergeCoachHomeWithRoster,
  sortCoachCommandCenterAthletes,
  type CoachRosterV2Filter,
} from '@/lib/coach-mobile-v2';
import type {
  CoachAthleteSummaryResponse,
  CoachDestination,
  CoachHomeActivity,
  CoachHomeActivityType,
  CoachHomeResponse,
  CoachHomeUpcomingSession,
  CoachRosterAthlete,
  CoachRosterResponse,
} from '@/lib/coach-mobile';
import { useSLReducedMotion } from '@/lib/motion';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';
import {
  convertDisplayWeightValue,
  normalizeDisplayWeightUnit,
  parseDisplayWeightUnit,
  type DisplayWeightUnit,
} from '@/lib/display-units';

const PR_MEDALLION = require('@/assets/images/ledger-index-v2/ledger-career-pr-medallion-v1.png');
const PROGRAM_ART = require('@/assets/images/logger-renders/plate-stack-studio-v2/mobile-hero-240x160@3x/squat-405.png');
const QUEUE_PREVIEW_LIMIT = 6;

const FILTERS: { id: 'all' | CoachHomeActivityType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'All Events', icon: 'layers-outline' },
  { id: 'completed_session', label: 'Completed Sessions', icon: 'barbell-outline' },
  { id: 'video_submitted', label: 'Videos to Review', icon: 'videocam-outline' },
  { id: 'pr_achieved', label: 'PRs', icon: 'trophy-outline' },
  { id: 'readiness_check_in', label: 'Readiness Check-Ins', icon: 'pulse-outline' },
  { id: 'programming_alert', label: 'Programming Alerts', icon: 'calendar-outline' },
  { id: 'message_feedback', label: 'Messages', icon: 'chatbox-outline' },
];

const ROSTER_FILTERS: { id: CoachRosterV2Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs_attention', label: 'Needs You' },
  { id: 'programming', label: 'Programming' },
  { id: 'active', label: 'Active' },
];

function isRosterFilter(value?: string): value is CoachRosterV2Filter {
  return value === 'all' || value === 'needs_attention' || value === 'programming' || value === 'active';
}

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate(now: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
}

function shortDay(value?: string | null) {
  if (!value) return 'UPCOMING';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'UPCOMING';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(parsed).toUpperCase();
}

function relativeTime(value?: string | null) {
  if (!value) return 'Recently';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Recently';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function absoluteAssetUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE}${value.startsWith('/') ? '' : '/'}${value}`;
}

function anatomyKeys(values?: string[] | null) {
  const expanded = (values || []).flatMap((value) => {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'arms') return ['biceps', 'triceps'];
    if (key === 'full_body') return ['chest', 'lats', 'quads', 'hamstrings'];
    return key ? [key] : [];
  });
  return [...new Set(expanded)];
}

function normalizeAthlete(athlete: CoachRosterAthlete): CoachRosterAthlete {
  return { ...athlete, ...normalizeProfilePhotoPayload(athlete) };
}

function normalizeHome(payload: CoachHomeResponse): CoachHomeResponse {
  const normalizeActivity = (activity: CoachHomeActivity) => ({
    ...activity,
    athlete: {
      ...activity.athlete,
      avatar_url: absoluteAssetUrl(activity.athlete.avatar_url),
    },
    artwork: {
      ...activity.artwork,
      thumbnail_url: absoluteAssetUrl(activity.artwork?.thumbnail_url),
    },
  });
  return {
    ...payload,
    attention_athletes: (payload.attention_athletes || []).map(normalizeAthlete),
    athletes: payload.athletes?.map(normalizeAthlete),
    queue: (payload.queue || []).map(normalizeActivity),
    cleared_activity: (payload.cleared_activity || []).map(normalizeActivity),
    coming_up: (payload.coming_up || []).map((session) => ({
      ...session,
      athlete: { ...session.athlete, avatar_url: absoluteAssetUrl(session.athlete.avatar_url) },
    })),
    recent_activity: (payload.recent_activity || []).map((activity) => ({
      ...activity,
      athlete: { ...activity.athlete, ...normalizeProfilePhotoPayload(activity.athlete) },
    })),
  };
}

export function CoachActivityHome({
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
  const params = useLocalSearchParams<{ filter?: string; roster?: string }>();
  const { user } = useAuth();
  const viewerUnit = normalizeDisplayWeightUnit(user?.preferred_units);
  const contextKey = coachHomeContextKey(user);
  const contextKeyRef = useRef(contextKey);
  const requestRef = useRef(0);
  const activeRequestRef = useRef<{
    contextKey: string;
    controller: AbortController;
    mode: 'initial' | 'background' | 'manual';
    promise: Promise<void>;
  } | null>(null);
  const lastBackgroundRefreshAtRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const overlayOpenRef = useRef(false);
  const previewMode = Boolean(previewData);
  const initial = previewData ? normalizeHome(previewData) : null;
  const [data, setData] = useState<CoachHomeResponse | null>(initial);
  const dataRef = useRef<CoachHomeResponse | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<CoachRosterAthlete | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [clearedOpen, setClearedOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterInitialFilter, setRosterInitialFilter] = useState<CoachRosterV2Filter>('all');
  const [filter, setFilter] = useState<'all' | CoachHomeActivityType>('all');
  const [showEarlier, setShowEarlier] = useState(false);
  const today = useMemo(() => new Date(), []);
  const firstName = useMemo(() => {
    const name = String(user?.user_name || '').trim();
    return previewCoachName || name.split(/\s+/)[0] || String(user?.email || '').split('@')[0] || 'Coach';
  }, [previewCoachName, user?.email, user?.user_name]);

  useEffect(() => {
    if (contextKeyRef.current === contextKey) return;
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    contextKeyRef.current = contextKey;
    requestRef.current += 1;
    setSelectedAthlete(null);
    setFilterOpen(false);
    setClearedOpen(false);
    setRosterOpen(false);
    setError(null);
    setRefreshing(false);
    if (!previewMode) {
      setData(null);
      dataRef.current = null;
      setLoading(Boolean(contextKey));
    }
  }, [contextKey, previewMode]);

  useEffect(() => {
    overlayOpenRef.current = Boolean(selectedAthlete || filterOpen || clearedOpen || rosterOpen);
  }, [clearedOpen, filterOpen, rosterOpen, selectedAthlete]);

  useEffect(() => {
    const rawFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
    const rawRoster = Array.isArray(params.roster) ? params.roster[0] : params.roster;
    if (rawRoster !== '1' && !isRosterFilter(rawFilter)) return;
    setRosterInitialFilter(isRosterFilter(rawFilter) ? rawFilter : 'all');
    setRosterOpen(true);
    router.setParams({ filter: undefined, roster: undefined });
  }, [params.filter, params.roster, router]);

  useEffect(() => () => {
    requestRef.current += 1;
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
  }, []);

  useEffect(() => {
    if (!previewData) return;
    const normalized = normalizeHome(previewData);
    dataRef.current = normalized;
    setData(normalized);
    setLoading(false);
  }, [previewData]);

  useEffect(() => {
    if (!previewInitiallySelectedAthleteId || !previewData) return;
    const athlete = (previewData.athletes || []).find((row) => row.id === previewInitiallySelectedAthleteId);
    if (athlete) setSelectedAthlete(normalizeAthlete(athlete));
  }, [previewData, previewInitiallySelectedAthleteId]);

  const load = useCallback((mode: 'initial' | 'background' | 'manual' = 'background'): Promise<void> => {
    if (previewMode || !contextKey) return Promise.resolve();

    const active = activeRequestRef.current;
    if (active?.contextKey === contextKey) {
      if (mode !== 'manual' || active.mode === 'manual') return active.promise;
      active.controller.abort();
    } else if (active) {
      active.controller.abort();
    }

    const now = Date.now();
    if (mode === 'background' && now - lastBackgroundRefreshAtRef.current < 1_000) {
      return Promise.resolve();
    }
    if (mode === 'background') lastBackgroundRefreshAtRef.current = now;

    const requestContext = contextKey;
    const sequence = ++requestRef.current;
    const controller = new AbortController();
    const current = () => contextKeyRef.current === requestContext && requestRef.current === sequence;
    if (mode === 'manual') setRefreshing(true);
    if (mode === 'initial' && !dataRef.current) setLoading(true);
    setError(null);

    const promise = (async () => {
      try {
      const [homeResponse, rosterResponse] = await Promise.all([
        fetchJson<CoachHomeResponse>('/coach/mobile/home', { method: 'GET', signal: controller.signal }),
        fetchJson<CoachRosterResponse>('/coach/mobile/roster', { method: 'GET', signal: controller.signal }),
      ]);
      if (!current()) return;
      if (homeResponse.status === 401 || rosterResponse.status === 401) {
        router.replace('/login');
        return;
      }
      const home = homeResponse.json;
      const roster = rosterResponse.json;
      if (!homeResponse.ok || !home?.ok || !home.queue) {
        setError('The live coaching queue is not available on this release yet.');
        return;
      }
      if (!rosterResponse.ok || !roster?.ok) {
        setError(roster?.error || 'Could not load your athlete relationships.');
        return;
      }
      const merged = normalizeHome(mergeCoachHomeWithRoster(home, roster, dataRef.current));
      dataRef.current = merged;
      setData(merged);
      } catch (loadError: any) {
      if (!current() || loadError?.name === 'AbortError') return;
      console.warn('Coach Home activity load failed', loadError);
      setError('Network error. Pull to refresh or try again.');
      } finally {
      if (current()) {
        setLoading(false);
        if (mode === 'manual') setRefreshing(false);
        activeRequestRef.current = null;
      }
      }
    })();

    activeRequestRef.current = { contextKey: requestContext, controller, mode, promise };
    return promise;
  }, [contextKey, previewMode, router]);

  useFocusEffect(useCallback(() => {
    if (!overlayOpenRef.current) {
      void load(dataRef.current ? 'background' : 'initial');
    }
  }, [load]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const previous = appStateRef.current;
      appStateRef.current = state;
      if (state === 'active' && previous !== 'active' && !overlayOpenRef.current) {
        void load(dataRef.current ? 'background' : 'initial');
      }
    });
    return () => subscription.remove();
  }, [load]);

  const athletes = useMemo(
    () => sortCoachCommandCenterAthletes(data?.athletes?.length ? data.athletes : data?.attention_athletes || []),
    [data],
  );
  const athleteById = useMemo(() => new Map(athletes.map((row) => [row.id, row])), [athletes]);
  const filteredQueue = useMemo(() => (data?.queue || []).filter((item) => filter === 'all' || item.type === filter), [data?.queue, filter]);
  const visibleQueue = showEarlier ? filteredQueue : filteredQueue.slice(0, QUEUE_PREVIEW_LIMIT);

  const openAthlete = useCallback((athleteId: number) => {
    const athlete = athleteById.get(athleteId);
    if (athlete) setSelectedAthlete(athlete);
  }, [athleteById]);

  const openDestination = useCallback((destination: CoachDestination, athleteId?: number) => {
    if (destination.route === 'athlete_hub') {
      if (athleteId) openAthlete(athleteId);
      return;
    }
    router.push({ pathname: destination.route as any, params: Object.fromEntries(Object.entries(destination.params || {}).map(([key, value]) => [key, String(value ?? '')])) } as any);
  }, [openAthlete, router]);

  const dismiss = useCallback(async (activity: CoachHomeActivity) => {
    const current = dataRef.current;
    if (!current) return;
    const next: CoachHomeResponse = {
      ...current,
      queue: (current.queue || []).filter((row) => row.key !== activity.key),
      queue_total: Math.max(0, Number(current.queue_total || current.queue?.length || 0) - 1),
      cleared_activity: [{ ...activity, state: 'dismissed', cleared_at: new Date().toISOString() }, ...(current.cleared_activity || [])],
    };
    dataRef.current = next;
    setData(next);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (previewMode) return;
    try {
      const response = await fetchJson<{ ok: boolean; error?: string }>('/coach/mobile/home/activity/dismiss', {
        method: 'POST',
        body: { event_key: activity.key } as any,
      });
      if (response.ok && response.json?.ok) return;
      dataRef.current = current;
      setData(current);
      setError(response.json?.error || 'Could not dismiss this activity.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (dismissError) {
      console.warn('Coach Home activity dismissal failed', dismissError);
      dataRef.current = current;
      setData(current);
      setError('Could not dismiss this activity. Try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [previewMode]);

  if (loading && !data) {
    return <SLScreen edges="none" padded={false}><SLLoadingState message="Assembling live athlete evidence." title="Loading coaching queue" /></SLScreen>;
  }

  return (
    <SLScreen edges="none" padded={false} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => load('manual')} refreshing={refreshing} tintColor={COACH_V2.violet} />}
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

        {error ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load('manual')} title="Coach Home unavailable" /> : null}

        {data ? <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Coaching Queue</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{filteredQueue.length} Active</Text></View>
              </View>
              <Pressable accessibilityLabel="Filter coaching queue" accessibilityRole="button" onPress={() => setFilterOpen(true)} style={styles.filterButton}>
                <Text style={styles.sectionAction}>{filter === 'all' ? 'Filter' : FILTERS.find((row) => row.id === filter)?.label}</Text>
                <Ionicons color={COACH_V2.violetBright} name="filter-outline" size={17} />
              </Pressable>
            </View>
            {visibleQueue.length ? visibleQueue.map((activity) => (
              <SwipeActivityCard
                activity={activity}
                displayUnit={viewerUnit}
                key={activity.key}
                onDismiss={() => dismiss(activity)}
                onOpen={() => openDestination(activity.destination, activity.athlete.id)}
                onOpenAthlete={() => openAthlete(activity.athlete.id)}
              />
            )) : <EmptyQueue filter={filter} />}
            {filteredQueue.length > QUEUE_PREVIEW_LIMIT ? (
              <Pressable accessibilityRole="button" onPress={() => setShowEarlier((value) => !value)} style={styles.earlierButton}>
                <Text style={styles.earlierText}>{showEarlier ? 'Show focused queue' : 'View earlier activity'}</Text>
                <Ionicons color={COACH_V2.violetBright} name={showEarlier ? 'chevron-up' : 'chevron-down'} size={17} />
              </Pressable>
            ) : null}
            {(data.cleared_activity || []).length ? (
              <Pressable accessibilityRole="button" onPress={() => setClearedOpen(true)} style={styles.clearedLink}>
                <Ionicons color={COACH_V2.subtle} name="archive-outline" size={15} />
                <Text style={styles.clearedLinkText}>View cleared activity</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Coming Up</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/coach-calendar')}><Text style={styles.sectionAction}>View Calendar</Text></Pressable>
            </View>
            {(data.coming_up || []).length ? (
              <ScrollView contentContainerStyle={styles.upcomingRail} horizontal showsHorizontalScrollIndicator={false}>
                {(data.coming_up || []).map((session) => <UpcomingCard key={session.key} onOpen={() => openDestination(session.destination, session.athlete.id)} session={session} />)}
              </ScrollView>
            ) : <EmptyCard icon="calendar-outline" text="Nothing programmed in the next two weeks." />}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Athletes</Text>
              <Pressable accessibilityRole="button" onPress={() => setRosterOpen(true)}><Text style={styles.sectionAction}>Find athlete</Text></Pressable>
            </View>
            {athletes.length ? (
              <ScrollView contentContainerStyle={styles.athleteRail} horizontal showsHorizontalScrollIndicator={false}>
                {athletes.map((athlete) => <CompactAthleteCard athlete={athlete} key={athlete.id} onPress={() => setSelectedAthlete(athlete)} />)}
              </ScrollView>
            ) : <EmptyCard icon="people-outline" text="No active athlete relationships are available." />}
          </View>
        </> : null}
        <View style={styles.bottomSpace} />
      </ScrollView>

      <QueueFilterSheet current={filter} onApply={setFilter} onClose={() => setFilterOpen(false)} visible={filterOpen} />
      <ClearedActivitySheet activities={data?.cleared_activity || []} onClose={() => setClearedOpen(false)} onOpen={(activity) => openDestination(activity.destination, activity.athlete.id)} visible={clearedOpen} />
      <RosterSheet athletes={athletes} initialFilter={rosterInitialFilter} onClose={() => setRosterOpen(false)} onOpen={(athlete) => { setRosterOpen(false); setTimeout(() => setSelectedAthlete(athlete), 0); }} visible={rosterOpen} />
      <CoachAthleteHubSheet
        athlete={selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
        previewRecap={selectedAthlete ? previewRecaps?.[selectedAthlete.id] : null}
        previewSummary={selectedAthlete ? previewSummaries?.[selectedAthlete.id] : null}
      />
    </SLScreen>
  );
}

function SwipeActivityCard({ activity, displayUnit, onDismiss, onOpen, onOpenAthlete }: { activity: CoachHomeActivity; displayUnit: DisplayWeightUnit; onDismiss: () => void; onOpen: () => void; onOpenAthlete: () => void }) {
  const reduceMotion = useSLReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dx < -8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderMove: (_event, gesture) => x.setValue(Math.max(-112, Math.min(0, gesture.dx))),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -82 || gesture.vx < -0.75) {
        Animated.timing(x, { duration: reduceMotion ? 0 : 150, toValue: -420, useNativeDriver: true }).start(onDismiss);
      } else {
        Animated.spring(x, { damping: 18, stiffness: 220, toValue: 0, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(x, { damping: 18, stiffness: 220, toValue: 0, useNativeDriver: true }).start(),
  }), [onDismiss, reduceMotion, x]);
  return (
    <View style={styles.swipeShell}>
      <Pressable accessibilityLabel={`Dismiss ${activity.title}`} accessibilityRole="button" onPress={onDismiss} style={styles.dismissAction}>
        <Ionicons color="#FFF" name="trash-outline" size={22} /><Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        <Pressable accessibilityHint="Swipe left to dismiss" accessibilityLabel={`${activity.athlete.name}, ${activity.title}`} accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}>
          <ActivityArtwork activity={activity} />
          <View style={styles.activityBody}>
            <Pressable accessibilityLabel={`Open ${activity.athlete.name} Athlete Hub`} onPress={(event) => { event.stopPropagation(); onOpenAthlete(); }} style={styles.activityAthleteRow}>
              <SLAthleteAvatar imageUrl={activity.athlete.avatar_url} name={activity.athlete.name} size={26} />
              <View style={styles.activityIdentity}><Text numberOfLines={1} style={styles.activityAthlete}>{activity.athlete.name}</Text><Text style={styles.activityTime}>{relativeTime(activity.occurred_at)}</Text></View>
            </Pressable>
            <Text numberOfLines={1} style={[styles.activityTitle, { color: toneForActivity(activity.type) }]}>{activity.title}</Text>
            <Text numberOfLines={1} style={styles.activitySubtitle}>{activity.subtitle}</Text>
            <ActivityEvidence activity={activity} displayUnit={displayUnit} />
          </View>
          <CoachCardChevron />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ActivityVideoArtwork({ thumbnailUrl }: { thumbnailUrl?: string | null }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [thumbnailUrl]);

  const showThumbnail = Boolean(thumbnailUrl && !thumbnailFailed);
  return (
    <View style={styles.artwork}>
      {showThumbnail ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setThumbnailFailed(true)}
          resizeMode="cover"
          source={{ uri: thumbnailUrl! }}
          style={styles.videoThumbnail}
        />
      ) : (
        <View style={styles.videoFallback}>
          <Ionicons color={COACH_V2.subtle} name="videocam-outline" size={28} />
        </View>
      )}
      {showThumbnail ? <View pointerEvents="none" style={styles.videoScrim} /> : null}
      <View pointerEvents="none" style={styles.videoPlay}><Ionicons color="#FFF" name="play" size={15} /></View>
    </View>
  );
}

function ActivityArtwork({ activity }: { activity: CoachHomeActivity }) {
  const kind = activity.artwork?.kind;
  if (kind === 'performed_anatomy') {
    return <View style={styles.artwork}><LinearGradient colors={['#17101F', '#07090D']} style={StyleSheet.absoluteFillObject} /><MuscleMap primary={anatomyKeys(activity.artwork?.muscle_keys || activity.evidence.muscle_keys)} showFrame={false} size="thumbnail" style={styles.anatomy} /></View>;
  }
  if (kind === 'video_thumbnail') {
    return <ActivityVideoArtwork thumbnailUrl={activity.artwork?.thumbnail_url} />;
  }
  if (kind === 'pr_medallion') {
    return <View style={[styles.artwork, styles.prArtwork]}><Image resizeMode="contain" source={PR_MEDALLION} style={styles.prImage} /><View style={styles.prSeal}><Text style={styles.prSealText}>PR</Text></View></View>;
  }
  if (kind === 'readiness_chart') {
    const score = Number(activity.evidence.score || 0);
    return <View style={[styles.artwork, styles.readinessArtwork]}><ReadinessRing score={score} /><View style={styles.miniSpark}><CoachSparkline color={COACH_V2.green} values={(activity.evidence.history || []).map((row) => row.score)} /></View></View>;
  }
  if (kind === 'programming') {
    return <View style={styles.artwork}><Image resizeMode="cover" source={PROGRAM_ART} style={StyleSheet.absoluteFillObject} /><LinearGradient colors={['rgba(0,0,0,.08)', 'rgba(0,0,0,.72)']} style={StyleSheet.absoluteFillObject} /><Ionicons color={COACH_V2.gold} name="calendar" size={26} /></View>;
  }
  return <View style={[styles.artwork, styles.messageArtwork]}><Ionicons color={COACH_V2.violetBright} name="chatbox-ellipses" size={40} /></View>;
}

function ReadinessRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 28;
  const progress = Math.max(0, Math.min(1, score / 5));
  return <View style={styles.ring}><Svg height={68} viewBox="0 0 68 68" width={68}><Circle cx="34" cy="34" fill="none" r="28" stroke="#182A20" strokeWidth="5" /><Circle cx="34" cy="34" fill="none" r="28" rotation="-90" stroke={COACH_V2.green} strokeDasharray={`${circumference * progress} ${circumference}`} strokeLinecap="round" strokeWidth="5" x="0" y="0" /></Svg><Text style={styles.ringValue}>{score.toFixed(1)}</Text></View>;
}

function ActivityEvidence({ activity, displayUnit }: { activity: CoachHomeActivity; displayUnit: DisplayWeightUnit }) {
  const evidence = activity.evidence;
  if (activity.type === 'completed_session') {
    return <View style={styles.evidenceRow}><Text style={styles.evidenceText}>{[evidence.set_count ? `${evidence.set_count} sets` : null, formatCoachVolume(evidence.total_volume_kg, displayUnit), evidence.session_rpe ? `RPE ${evidence.session_rpe}` : null].filter(Boolean).join(' · ') || 'Performed evidence recorded'}</Text>{evidence.pr_count ? <MiniBadge color={COACH_V2.gold} text={`${evidence.pr_count} PR`} /> : null}{evidence.video_count ? <MiniBadge color={COACH_V2.violetBright} text={`${evidence.video_count} VIDEO${evidence.video_count === 1 ? '' : 'S'}`} /> : null}</View>;
  }
  if (activity.type === 'video_submitted') return <View style={styles.evidenceRow}><MiniBadge color={COACH_V2.violetBright} text="REVIEW" /><Text style={styles.evidenceText}>{evidence.set_indexes?.length ? `Sets ${evidence.set_indexes.join(', ')}` : 'Exact set context ready'}</Text></View>;
  if (activity.type === 'pr_achieved') {
    const unitToken = String(evidence.unit || '').trim().toLowerCase();
    const sourceUnit = parseDisplayWeightUnit(evidence.unit)
      || (unitToken.startsWith('kg') ? 'kg' : unitToken.startsWith('lb') ? 'lb' : null);
    const value = evidence.weight_kg != null
      ? formatCoachWeight(evidence.weight_kg, displayUnit)
      : evidence.current_value != null && sourceUnit
        ? `${formatEvidenceMass(evidence.current_value, sourceUnit, displayUnit)} ${displayUnit}`
        : evidence.current_value != null
          ? `${evidence.current_value}${evidence.unit ? ` ${evidence.unit}` : ''}`
          : 'Evidence verified';
    const delta = evidence.delta && sourceUnit
      ? `  +${formatEvidenceMass(evidence.delta, sourceUnit, displayUnit)} ${displayUnit}`
      : evidence.delta
        ? `  +${evidence.delta}`
        : '';
    return <Text style={[styles.evidenceText, { color: COACH_V2.gold }]}>{value}{evidence.reps ? ` × ${evidence.reps}` : ''}{delta}</Text>;
  }
  if (activity.type === 'readiness_check_in') return <Text style={[styles.evidenceText, { color: COACH_V2.green }]}>Readiness {evidence.score?.toFixed(1)}{evidence.delta != null ? `  ${evidence.delta >= 0 ? '↑' : '↓'} ${Math.abs(evidence.delta).toFixed(1)}` : ''}</Text>;
  if (activity.type === 'programming_alert') return <Text style={[styles.evidenceText, { color: COACH_V2.gold }]}>{evidence.days_remaining == null ? 'Coverage required now' : `${Math.max(0, evidence.days_remaining)} day${evidence.days_remaining === 1 ? '' : 's'} remaining`}</Text>;
  return <Text style={[styles.evidenceText, { color: COACH_V2.violetBright }]}>{evidence.unread_count || 1} unread</Text>;
}

function formatEvidenceMass(value: number, sourceUnit: DisplayWeightUnit, displayUnit: DisplayWeightUnit): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(
    convertDisplayWeightValue(Number(value), sourceUnit, displayUnit),
  );
}

function MiniBadge({ color, text }: { color: string; text: string }) {
  return <View style={[styles.miniBadge, { backgroundColor: `${color}16`, borderColor: `${color}77` }]}><Text style={[styles.miniBadgeText, { color }]}>{text}</Text></View>;
}

function UpcomingCard({ session, onOpen }: { session: CoachHomeUpcomingSession; onOpen: () => void }) {
  return <Pressable accessibilityLabel={`Open ${session.athlete.name} ${session.title}`} accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.upcomingCard, pressed && styles.pressed]}>
    <LinearGradient colors={['#10121A', '#05060A']} style={StyleSheet.absoluteFillObject} />
    <Text numberOfLines={1} style={styles.upcomingDate}>{shortDay(session.date)}</Text>
    <Text numberOfLines={1} style={styles.upcomingAthlete}>{session.athlete.name}</Text>
    <Text numberOfLines={1} style={styles.upcomingTitle}>{session.title}</Text>
    <View style={styles.upcomingAnatomy}><MuscleMap primary={anatomyKeys(session.muscle_keys)} showFrame={false} size="thumbnail" /></View>
    <Text numberOfLines={1} style={styles.upcomingMeta}>{session.movement_count ? `${session.movement_count} movements` : session.subtitle}</Text>
  </Pressable>;
}

function CompactAthleteCard({ athlete, onPress }: { athlete: CoachRosterAthlete; onPress: () => void }) {
  const readiness = athlete.readiness.score;
  const color = readiness != null && readiness < 3 ? COACH_V2.magenta : COACH_V2.green;
  return <Pressable accessibilityLabel={`Open ${athlete.name} Athlete Hub`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.athleteCard, athlete.status.classification === 'needs_attention' && styles.athleteCardAttention, pressed && styles.pressed]}>
    <View style={styles.athleteTop}><SLAthleteAvatar imageUrl={athlete.profilePhotoUrl} imageVersion={athlete.profilePhotoVersion} name={athlete.name} size={39} statusColor={color} /><Text numberOfLines={2} style={styles.athleteName}>{athlete.name}</Text></View>
    <Text numberOfLines={1} style={styles.athleteTraining}>{athleteTrainingLabel(athlete)}</Text>
    <View style={styles.athleteReadiness}><Text style={[styles.athleteScore, { color }]}>{readiness == null ? '—' : readiness.toFixed(1)}</Text>{athlete.readiness.delta != null ? <Text style={[styles.athleteDelta, { color }]}>{athlete.readiness.delta >= 0 ? '↑' : '↓'} {Math.abs(athlete.readiness.delta).toFixed(1)}</Text> : null}</View>
    <View style={styles.athleteSpark}><CoachSparkline color={color} values={(athlete.readiness.history || []).map((point) => point.score)} /></View>
    <Text numberOfLines={1} style={styles.coverage}>{athlete.programming_horizon?.programmed_through_date ? `Coverage through ${athlete.programming_horizon.programmed_through_date}` : 'Programming needed'}</Text>
  </Pressable>;
}

function EmptyQueue({ filter }: { filter: 'all' | CoachHomeActivityType }) {
  return <View style={styles.emptyQueue}><View style={styles.emptyQueueIcon}><Ionicons color={COACH_V2.green} name="checkmark" size={27} /></View><View style={styles.emptyQueueCopy}><Text style={styles.emptyQueueTitle}>{filter === 'all' ? 'Queue clear' : 'No matching activity'}</Text><Text style={styles.emptyQueueText}>Handled and auto-resolved evidence remains available in cleared activity.</Text></View></View>;
}

function EmptyCard({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.emptyCard}><Ionicons color={COACH_V2.muted} name={icon} size={21} /><Text style={styles.emptyText}>{text}</Text></View>;
}

function QueueFilterSheet({ current, onApply, onClose, visible }: { current: 'all' | CoachHomeActivityType; onApply: (value: 'all' | CoachHomeActivityType) => void; onClose: () => void; visible: boolean }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(current);
  useEffect(() => { if (visible) setDraft(current); }, [current, visible]);
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}><View style={styles.sheetBackdrop}><Pressable accessibilityLabel="Close queue filters" onPress={onClose} style={StyleSheet.absoluteFillObject} /><View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Filter Queue</Text><Pressable onPress={() => setDraft('all')}><Text style={styles.sectionAction}>Clear</Text></Pressable></View>{FILTERS.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: item.id === draft }} key={item.id} onPress={() => setDraft(item.id)} style={styles.filterRow}><View style={styles.filterIcon}><Ionicons color={item.id === draft ? COACH_V2.violetBright : COACH_V2.muted} name={item.icon} size={19} /></View><Text style={styles.filterLabel}>{item.label}</Text><Ionicons color={item.id === draft ? COACH_V2.violetBright : COACH_V2.subtle} name={item.id === draft ? 'radio-button-on' : 'radio-button-off'} size={21} /></Pressable>)}<Pressable onPress={() => { onApply(draft); onClose(); }} style={styles.applyButton}><Text style={styles.applyText}>Apply</Text></Pressable></View></View></Modal>;
}

function ClearedActivitySheet({ activities, onClose, onOpen, visible }: { activities: CoachHomeActivity[]; onClose: () => void; onOpen: (activity: CoachHomeActivity) => void; visible: boolean }) {
  const insets = useSafeAreaInsets();
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}><View style={styles.sheetBackdrop}><Pressable accessibilityLabel="Close cleared activity" onPress={onClose} style={StyleSheet.absoluteFillObject} /><View style={[styles.tallSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>Coaching Queue</Text><Text style={styles.sheetTitle}>Cleared Activity</Text></View><Pressable onPress={onClose} style={styles.closeButton}><Ionicons color={COACH_V2.text} name="close" size={22} /></Pressable></View><ScrollView contentContainerStyle={styles.clearedList}>{activities.length ? activities.map((activity) => <Pressable key={activity.key} onPress={() => onOpen(activity)} style={styles.clearedRow}><SLAthleteAvatar imageUrl={activity.athlete.avatar_url} name={activity.athlete.name} size={38} /><View style={styles.clearedCopy}><Text numberOfLines={1} style={styles.clearedTitle}>{activity.title}</Text><Text numberOfLines={1} style={styles.clearedMeta}>{activity.athlete.name} · {activity.state.replace('_', ' ')}</Text></View><CoachCardChevron /></Pressable>) : <EmptyCard icon="archive-outline" text="No cleared activity yet." />}</ScrollView></View></View></Modal>;
}

function RosterSheet({ athletes, initialFilter, onClose, onOpen, visible }: { athletes: CoachRosterAthlete[]; initialFilter: CoachRosterV2Filter; onClose: () => void; onOpen: (athlete: CoachRosterAthlete) => void; visible: boolean }) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<CoachRosterV2Filter>('all');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterCoachRosterV2(athletes, filter, query), [athletes, filter, query]);
  useEffect(() => { if (visible) { setFilter(initialFilter); setQuery(''); } }, [initialFilter, visible]);
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}><View style={styles.sheetBackdrop}><Pressable accessibilityLabel="Close athlete finder" onPress={onClose} style={StyleSheet.absoluteFillObject} /><View style={[styles.tallSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>Coach Home</Text><Text style={styles.sheetTitle}>Find an Athlete</Text></View><Pressable onPress={onClose} style={styles.closeButton}><Ionicons color={COACH_V2.text} name="close" size={22} /></Pressable></View><View style={styles.search}><Ionicons color={COACH_V2.subtle} name="search" size={18} /><TextInput onChangeText={setQuery} placeholder="Search your athletes" placeholderTextColor={COACH_V2.subtle} style={styles.searchInput} value={query} /></View><ScrollView contentContainerStyle={styles.rosterFilters} horizontal showsHorizontalScrollIndicator={false}>{ROSTER_FILTERS.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.rosterFilter, filter === item.id && styles.rosterFilterActive]}><Text style={[styles.rosterFilterText, filter === item.id && styles.rosterFilterTextActive]}>{item.label}</Text></Pressable>)}</ScrollView><ScrollView contentContainerStyle={styles.rosterList}>{filtered.map((athlete) => <Pressable key={athlete.id} onPress={() => onOpen(athlete)} style={styles.rosterRow}><SLAthleteAvatar imageUrl={athlete.profilePhotoUrl} imageVersion={athlete.profilePhotoVersion} name={athlete.name} size={44} /><View style={styles.rosterCopy}><Text style={styles.rosterName}>{athlete.name}</Text><Text numberOfLines={1} style={styles.rosterMeta}>{athleteTrainingLabel(athlete)}</Text></View><CoachStatusBadge label={athlete.status.label} tone={athlete.status.tone === 'danger' ? 'danger' : athlete.status.tone === 'warning' ? 'warning' : 'success'} /><CoachCardChevron /></Pressable>)}</ScrollView></View></View></Modal>;
}

function toneForActivity(type: CoachHomeActivityType) {
  if (type === 'pr_achieved' || type === 'programming_alert') return COACH_V2.gold;
  if (type === 'readiness_check_in') return COACH_V2.green;
  if (type === 'video_submitted' || type === 'message_feedback') return COACH_V2.violetBright;
  return '#C78BFF';
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000' },
  content: { gap: 16, paddingTop: 10 },
  greetingRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  greetingCopy: { flex: 1, minWidth: 0 },
  greetingEyebrow: { color: COACH_V2.muted, fontSize: 12 },
  greetingName: { marginTop: 2, color: COACH_V2.text, fontSize: 23, lineHeight: 27, fontWeight: '700' },
  dateButton: { minWidth: 120, minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#0A0C12', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 11 },
  dateLabel: { color: COACH_V2.subtle, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  dateValue: { marginTop: 3, color: COACH_V2.text, fontSize: 11, fontWeight: '700' },
  section: { gap: 7 },
  sectionHeader: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: COACH_V2.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  sectionAction: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '700' },
  countBadge: { borderRadius: 5, backgroundColor: '#231037', borderWidth: 1, borderColor: '#633B88', paddingHorizontal: 7, paddingVertical: 3 },
  countText: { color: '#C88BFF', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  filterButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 5 },
  swipeShell: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#B72F3B' },
  dismissAction: { ...StyleSheet.absoluteFillObject, left: '74%', alignItems: 'center', justifyContent: 'center', gap: 4 },
  dismissText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  activityCard: { minHeight: 112, borderRadius: 12, borderWidth: 1, borderColor: '#2B2F3A', backgroundColor: '#090B11', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 10 },
  artwork: { width: 92, height: 94, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#282C35', backgroundColor: '#080A0F', alignItems: 'center', justifyContent: 'center' },
  anatomy: { transform: [{ scale: 1.2 }] },
  videoThumbnail: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  videoFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10131A' },
  videoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.16)' },
  videoPlay: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,.5)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  prArtwork: { backgroundColor: '#160E02', borderColor: '#624816' },
  prImage: { width: 82, height: 82 },
  prSeal: { position: 'absolute', width: 49, height: 49, borderRadius: 25, borderWidth: 2, borderColor: '#FFD86A', backgroundColor: 'rgba(47,29,2,.93)', alignItems: 'center', justifyContent: 'center', shadowColor: '#FFB323', shadowOpacity: 0.8, shadowRadius: 10 },
  prSealText: { color: '#FFD76A', fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  readinessArtwork: { justifyContent: 'flex-start', paddingTop: 4 },
  ring: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  ringValue: { position: 'absolute', color: COACH_V2.green, fontSize: 19, fontWeight: '800' },
  miniSpark: { position: 'absolute', left: 7, right: 7, bottom: -2, height: 31 },
  messageArtwork: { backgroundColor: '#120C20', borderColor: '#4E2A78' },
  activityBody: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center' },
  activityAthleteRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 30 },
  activityIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  activityAthlete: { flex: 1, color: COACH_V2.muted, fontSize: 10, fontWeight: '700' },
  activityTime: { color: COACH_V2.subtle, fontSize: 9 },
  activityTitle: { marginTop: 3, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  activitySubtitle: { marginTop: 2, color: COACH_V2.muted, fontSize: 10 },
  evidenceRow: { marginTop: 6, minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 5 },
  evidenceText: { marginTop: 5, color: COACH_V2.muted, fontSize: 9, fontWeight: '700' },
  miniBadge: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
  miniBadgeText: { fontSize: 8, fontWeight: '900' },
  earlierButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  earlierText: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '700' },
  clearedLink: { alignSelf: 'center', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearedLinkText: { color: COACH_V2.subtle, fontSize: 10, fontWeight: '700' },
  upcomingRail: { gap: 8, paddingRight: 2 },
  upcomingCard: { width: 148, height: 184, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#292D38', padding: 10 },
  upcomingDate: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '800' },
  upcomingAthlete: { marginTop: 5, color: COACH_V2.muted, fontSize: 9 },
  upcomingTitle: { marginTop: 2, color: COACH_V2.text, fontSize: 13, fontWeight: '800' },
  upcomingAnatomy: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  upcomingMeta: { color: COACH_V2.muted, fontSize: 9 },
  athleteRail: { gap: 8, paddingRight: 2 },
  athleteCard: { width: 150, height: 174, borderRadius: 12, borderWidth: 1, borderColor: '#292D38', backgroundColor: '#090B11', padding: 10 },
  athleteCardAttention: { borderColor: '#753047' },
  athleteTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  athleteName: { flex: 1, color: COACH_V2.text, fontSize: 12, fontWeight: '800' },
  athleteTraining: { marginTop: 7, color: COACH_V2.muted, fontSize: 9 },
  athleteReadiness: { marginTop: 8, flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  athleteScore: { fontSize: 20, fontWeight: '800' },
  athleteDelta: { fontSize: 9, fontWeight: '800' },
  athleteSpark: { position: 'absolute', right: 8, bottom: 25, width: 62, height: 32 },
  coverage: { marginTop: 'auto', color: COACH_V2.subtle, fontSize: 8 },
  emptyQueue: { minHeight: 94, borderRadius: 12, borderWidth: 1, borderColor: '#26332C', backgroundColor: '#07100C', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  emptyQueueIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: '#397453', backgroundColor: '#0B2718', alignItems: 'center', justifyContent: 'center' },
  emptyQueueCopy: { flex: 1 },
  emptyQueueTitle: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  emptyQueueText: { marginTop: 4, color: COACH_V2.muted, fontSize: 10, lineHeight: 14 },
  emptyCard: { minHeight: 70, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  emptyText: { flex: 1, color: COACH_V2.muted, fontSize: 11 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.995 }] },
  bottomSpace: { height: 88 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.76)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: '#343846', backgroundColor: '#07090E', padding: 14 },
  tallSheet: { maxHeight: '84%', minHeight: '58%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: '#343846', backgroundColor: '#07090E', padding: 14 },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#555968' },
  sheetHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetEyebrow: { color: COACH_V2.violetBright, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  sheetTitle: { color: COACH_V2.text, fontSize: 20, fontWeight: '800' },
  closeButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: COACH_V2.border, alignItems: 'center', justifyContent: 'center' },
  filterRow: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252936', flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterIcon: { width: 28, alignItems: 'center' },
  filterLabel: { flex: 1, color: COACH_V2.text, fontSize: 12, fontWeight: '700' },
  applyButton: { marginTop: 12, minHeight: 48, borderRadius: 9, backgroundColor: '#6F31BE', alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  clearedList: { gap: 7, paddingBottom: 10 },
  clearedRow: { minHeight: 62, borderRadius: 10, borderWidth: 1, borderColor: '#252936', backgroundColor: '#0A0C12', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9 },
  clearedCopy: { flex: 1, minWidth: 0 },
  clearedTitle: { color: COACH_V2.text, fontSize: 12, fontWeight: '800' },
  clearedMeta: { marginTop: 3, color: COACH_V2.subtle, fontSize: 9, textTransform: 'capitalize' },
  search: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  searchInput: { flex: 1, color: COACH_V2.text, fontSize: 13 },
  rosterFilters: { gap: 7, paddingVertical: 10 },
  rosterFilter: { height: 34, borderRadius: 17, borderWidth: 1, borderColor: COACH_V2.border, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  rosterFilterActive: { borderColor: COACH_V2.violet, backgroundColor: '#24113B' },
  rosterFilterText: { color: COACH_V2.muted, fontSize: 10, fontWeight: '700' },
  rosterFilterTextActive: { color: COACH_V2.text },
  rosterList: { gap: 7, paddingBottom: 10 },
  rosterRow: { minHeight: 66, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9 },
  rosterCopy: { flex: 1, minWidth: 0 },
  rosterName: { color: COACH_V2.text, fontSize: 12, fontWeight: '800' },
  rosterMeta: { marginTop: 3, color: COACH_V2.muted, fontSize: 9 },
});
