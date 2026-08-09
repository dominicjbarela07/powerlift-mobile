import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  type GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text, TextInput } from '@/components/ui/sl-text';

import {
  CoachMaterialLayer,
  type CoachMaterialTone,
} from '@/components/coach-mobile/coach-material-layer';
import {
  SLAthleteAvatar,
  SLEmptyState,
  SLErrorState,
  SLLoadingState,
  SLScreen,
} from '@/components/ui';
import { SLColors, SLRadius } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchJson, getResolvedTimezone } from '@/lib/api';
import {
  type CoachRosterAthlete,
  type CoachRosterFilter,
  type CoachRosterResponse,
  openCoachDestination,
} from '@/lib/coach-mobile';
import { useSLReducedMotion } from '@/lib/motion';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';

const FILTERS: { key: CoachRosterFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_attention', label: 'Needs' },
  { key: 'programming', label: 'Prog' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'messages', label: 'Messages' },
  { key: 'check_ins', label: 'Check-ins' },
];

const FILTER_COLORS: Record<CoachRosterFilter, string> = {
  all: '#A45CFF',
  needs_attention: '#FF2C9D',
  programming: '#3BC9FF',
  reviews: '#3BC9FF',
  messages: '#A45CFF',
  check_ins: '#FF762D',
};

const EMPTY_COUNTS: Record<CoachRosterFilter, number> = {
  all: 0,
  needs_attention: 0,
  programming: 0,
  reviews: 0,
  messages: 0,
  check_ins: 0,
};

let rosterMemory: {
  accountKey: string | null;
  filter: CoachRosterFilter;
  query: string;
  scrollOffset: number;
} = {
  accountKey: null,
  filter: 'all',
  query: '',
  scrollOffset: 0,
};

type AthleteActionContext = {
  athlete: CoachRosterAthlete;
  anchorY: number | null;
};

function isFilter(value?: string): value is CoachRosterFilter {
  return FILTERS.some((item) => item.key === value);
}

function toneColor(athlete: CoachRosterAthlete) {
  if (athlete.status.tone === 'danger') return SLColors.danger;
  if (athlete.status.tone === 'warning') return SLColors.warning;
  return SLColors.success;
}

function materialTone(athlete: CoachRosterAthlete): CoachMaterialTone {
  if (athlete.status.tone === 'danger') return 'critical';
  if (athlete.status.tone === 'warning') return 'action';
  return 'on_track';
}

function reasonIcon(reasonType?: string, category?: string): keyof typeof Ionicons.glyphMap {
  if (category === 'programming') return 'calendar-outline';
  if (category === 'reviews') return 'videocam-outline';
  if (category === 'messages') return 'chatbubble-outline';
  if (category === 'check_ins') return 'checkbox-outline';
  if (reasonType?.includes('readiness')) return 'pulse-outline';
  if (reasonType?.includes('missed')) return 'close-circle-outline';
  return 'alert-circle-outline';
}

function trainingLine(athlete: CoachRosterAthlete) {
  const training = athlete.current_training;
  if (training.status !== 'active') return training.label;
  const position = [
    training.block_name,
    training.week_position && training.week_total
      ? `W${training.week_position} of ${training.week_total}`
      : null,
  ].filter(Boolean);
  return position.join(' · ');
}

function greetingForTimezone(now: Date, timezone: string) {
  let hour = now.getHours();
  try {
    const hourPart = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: timezone,
    }).formatToParts(now).find((part) => part.type === 'hour')?.value;
    const parsedHour = Number(hourPart);
    if (Number.isFinite(parsedHour)) hour = parsedHour;
  } catch {
    // The resolved timezone is validated upstream; device-local time is a safe
    // presentation fallback if the runtime cannot format that zone.
  }

  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CoachRosterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { refreshAccountState, user } = useAuth();
  const accountKey = user?.email || (user?.athlete_id ? `athlete:${user.athlete_id}` : null);
  const requestedFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const listRef = useRef<FlatList<CoachRosterAthlete>>(null);
  const accountKeyRef = useRef(accountKey);
  const requestSequenceRef = useRef(0);
  const [athletes, setAthletes] = useState<CoachRosterAthlete[]>([]);
  const [attentionIds, setAttentionIds] = useState<number[]>([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [attentionCap, setAttentionCap] = useState(6);
  const [filter, setFilter] = useState<CoachRosterFilter>(
    isFilter(requestedFilter)
      ? requestedFilter
      : rosterMemory.accountKey === accountKey
        ? rosterMemory.filter
        : 'all',
  );
  const [query, setQuery] = useState(
    rosterMemory.accountKey === accountKey ? rosterMemory.query : '',
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionContext, setActionContext] = useState<AthleteActionContext | null>(null);
  const [noteContext, setNoteContext] = useState<AthleteActionContext | null>(null);
  const [localTimezone, setLocalTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
  );
  const [greetingClock, setGreetingClock] = useState(() => new Date());

  const coachFirstName = useMemo(() => {
    const displayName = String(user?.user_name || '').trim();
    if (displayName) return displayName.split(/\s+/)[0];
    const emailName = String(user?.email || '').split('@')[0].trim();
    return emailName || 'Coach';
  }, [user?.email, user?.user_name]);

  const coachGreeting = useMemo(
    () => greetingForTimezone(greetingClock, localTimezone),
    [greetingClock, localTimezone],
  );

  const refreshGreetingContext = useCallback(async () => {
    setGreetingClock(new Date());
    setLocalTimezone(await getResolvedTimezone());
  }, []);

  useEffect(() => {
    accountKeyRef.current = accountKey;
    requestSequenceRef.current += 1;
    if (rosterMemory.accountKey !== accountKey) {
      rosterMemory = { accountKey, filter: 'all', query: '', scrollOffset: 0 };
      setAthletes([]);
      setAttentionIds([]);
      setCounts(EMPTY_COUNTS);
      setFilter(isFilter(requestedFilter) ? requestedFilter : 'all');
      setQuery('');
    }
  }, [accountKey, requestedFilter]);

  useEffect(() => {
    if (isFilter(requestedFilter)) setFilter(requestedFilter);
  }, [requestedFilter]);

  useEffect(() => {
    rosterMemory = { ...rosterMemory, accountKey, filter, query };
  }, [accountKey, filter, query]);

  const loadRoster = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!accountKey) return;
    const requestAccountKey = accountKey;
    const requestSequence = ++requestSequenceRef.current;
    const isCurrentRequest = () => (
      accountKeyRef.current === requestAccountKey
      && requestSequenceRef.current === requestSequence
    );
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const response = await fetchJson('/coach/mobile/roster', { method: 'GET' });
      const payload = response.json as CoachRosterResponse | null;
      if (!isCurrentRequest()) return;
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || `Could not load Roster. (${response.status})`);
        return;
      }
      setAthletes(
        (payload.athletes || []).map((athlete) => ({
          ...athlete,
          ...normalizeProfilePhotoPayload(athlete),
        })),
      );
      setCounts(payload.counts || EMPTY_COUNTS);
      setAttentionCap(Math.max(1, payload.attention_cap || 6));
      setAttentionIds((payload.needs_attention || []).map((item) => item.athlete_id));
    } catch (loadError) {
      if (!isCurrentRequest()) return;
      console.warn('Coach Roster load failed', loadError);
      setError('Network error. Pull to refresh or try again.');
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [accountKey, router]);

  useFocusEffect(
    useCallback(() => {
      loadRoster({ silent: true });
      void refreshAccountState();
      refreshGreetingContext();
      requestAnimationFrame(() => {
        if (rosterMemory.scrollOffset > 0) {
          listRef.current?.scrollToOffset({
            animated: false,
            offset: rosterMemory.scrollOffset,
          });
        }
      });
    }, [loadRoster, refreshAccountState, refreshGreetingContext]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadRoster({ silent: true });
        void refreshAccountState();
        refreshGreetingContext();
      }
    });
    return () => subscription.remove();
  }, [loadRoster, refreshAccountState, refreshGreetingContext]);

  useEffect(() => {
    const timer = setInterval(() => setGreetingClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const attentionOrder = useMemo(
    () => new Map(attentionIds.map((id, index) => [id, index])),
    [attentionIds],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const rows = athletes.filter((athlete) => {
      if (needle && !athlete.name.toLocaleLowerCase().includes(needle)) return false;
      return filter === 'all' || athlete.queue_membership.includes(filter);
    });
    if (filter === 'all') {
      return rows.sort((a, b) => a.stable_sort_key.localeCompare(b.stable_sort_key));
    }
    return rows.sort((a, b) => {
      const aRank = attentionOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = attentionOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.stable_sort_key.localeCompare(b.stable_sort_key);
    });
  }, [athletes, attentionOrder, filter, query]);

  const matchingAttentionAthletes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return attentionIds
      .map((id) => athletes.find((athlete) => athlete.id === id))
      .filter((athlete): athlete is CoachRosterAthlete => Boolean(athlete))
      .filter((athlete) => !needle || athlete.name.toLocaleLowerCase().includes(needle));
  }, [athletes, attentionIds, query]);

  const workingSetAthletes = useMemo(() => {
    const everyAthleteNeedsAttention = (
      athletes.length > 0
      && athletes.every((athlete) => attentionOrder.has(athlete.id))
    );
    return matchingAttentionAthletes.slice(
      0,
      everyAthleteNeedsAttention ? matchingAttentionAthletes.length : attentionCap,
    );
  }, [athletes, attentionCap, attentionOrder, matchingAttentionAthletes]);

  const workingSetIds = useMemo(
    () => new Set(workingSetAthletes.map((athlete) => athlete.id)),
    [workingSetAthletes],
  );

  const visibleRoster = useMemo(
    () => (
      filter === 'all'
        ? filtered.filter((athlete) => !workingSetIds.has(athlete.id))
        : filtered
    ),
    [filter, filtered, workingSetIds],
  );

  const openWorkspace = useCallback((athlete: CoachRosterAthlete) => {
    router.push({
      pathname: '/(tabs)/coach-athlete/[athleteId]',
      params: { athleteId: String(athlete.id), athleteName: athlete.name },
    } as any);
  }, [router]);

  const openMessage = useCallback(async (athlete: CoachRosterAthlete) => {
    const existingThread = athlete.unread_messages.thread_id;
    if (existingThread) {
      router.push({ pathname: '/(tabs)/messages/[threadId]', params: { threadId: String(existingThread) } } as any);
      return;
    }
    const response = await fetchJson('/messenger/mobile/threads/ensure-athlete', {
      method: 'POST',
      body: JSON.stringify({ athlete_id: athlete.id }),
    });
    const payload = response.json as { ok?: boolean; thread?: { id?: number }; thread_id?: number } | null;
    const threadId = payload?.thread?.id || payload?.thread_id;
    if (response.ok && threadId) {
      router.push({ pathname: '/(tabs)/messages/[threadId]', params: { threadId: String(threadId) } } as any);
    }
  }, [router]);

  const openReviews = useCallback((athlete: CoachRosterAthlete) => {
    const reason = athlete.attention_reasons.find((item) => item.category === 'reviews');
    if (reason) openCoachDestination(router, reason.destination);
    else router.push({ pathname: '/(tabs)/coach-videos', params: { athleteId: String(athlete.id) } } as any);
  }, [router]);

  const showAthleteActions = useCallback((
    athlete: CoachRosterAthlete,
    anchorY: number | null = null,
  ) => {
    setActionContext({ athlete, anchorY });
  }, []);

  const openProgramming = useCallback((athlete: CoachRosterAthlete) => {
    router.push({
      pathname: '/(tabs)/workout',
      params: { athleteId: String(athlete.id), athleteName: athlete.name },
    } as any);
  }, [router]);

  const openNextSession = useCallback((athlete: CoachRosterAthlete) => {
    const sessionId = athlete.next_assigned_session?.workout_id;
    if (sessionId) {
      router.push({
        pathname: '/(tabs)/workout/[workoutId]',
        params: { workoutId: String(sessionId) },
      } as any);
      return;
    }
    openWorkspace(athlete);
  }, [openWorkspace, router]);

  const openCheckIn = useCallback((athlete: CoachRosterAthlete) => {
    router.push({
      pathname: '/(tabs)/check-ins',
      params: { athleteId: String(athlete.id), athleteName: athlete.name },
    } as any);
  }, [router]);

  if (loading && athletes.length === 0) {
    return (
      <SLScreen edges="none">
        <View style={styles.centerState}>
          <SLLoadingState title="Loading Roster" message="Finding the coaching work that matters now." />
        </View>
      </SLScreen>
    );
  }

  return (
    <SLScreen edges="none" padded={false}>
      <FlatList
        ref={listRef}
        data={visibleRoster}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        refreshing={refreshing}
        onRefresh={() => loadRoster({ silent: true })}
        onScroll={(event) => {
          rosterMemory.scrollOffset = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={100}
        ListHeaderComponent={(
          <View style={styles.headerStack}>
            <View style={styles.rosterHeader}>
              <View style={styles.coachGreeting}>
                <SLAthleteAvatar
                  imageUrl={user?.profilePhotoUrl}
                  imageVersion={user?.profilePhotoVersion}
                  name={user?.user_name || coachFirstName}
                  size={42}
                />
                <View style={styles.coachGreetingCopy}>
                  <Text typographyRole="sectionTitle" style={styles.rosterHeaderTitle}>
                    {coachGreeting}, {coachFirstName}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityLabel="Add athlete"
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/coach-invite-athlete' as any)}
                style={({ pressed }) => [styles.addAthleteButton, pressed && styles.pressed]}
              >
                <CoachMaterialLayer borderRadius={8} emphasis="quiet" tone="violet" />
                <Ionicons name="person-add-outline" size={13} color="#A45CFF" />
                <Text typographyRole="badge" style={styles.addAthleteButtonText}>Add Athlete</Text>
              </Pressable>
            </View>

            <View style={styles.searchShell}>
              <CoachMaterialLayer borderRadius={9} emphasis="quiet" tone="violet" />
              <Ionicons name="search" size={18} color={SLColors.iconMuted} />
              <TextInput
                accessibilityLabel="Search athletes"
                value={query}
                onChangeText={setQuery}
                placeholder="Search athletes"
                placeholderTextColor={SLColors.textSubtle}
                style={styles.searchInput}
              />
              {query ? (
                <Pressable accessibilityLabel="Clear athlete search" accessibilityRole="button" hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={SLColors.iconMuted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              accessibilityRole="tablist"
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityLabel={`${item.label}, ${counts[item.key] || 0} athletes`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === item.key }}
                  onPress={() => setFilter(item.key)}
                  style={styles.filter}
                >
                  <CoachMaterialLayer
                    borderRadius={15}
                    emphasis={filter === item.key ? 'standard' : 'quiet'}
                    selected={filter === item.key}
                    tone={item.key === 'needs_attention'
                      ? 'critical'
                      : item.key === 'check_ins'
                        ? 'action'
                        : item.key === 'all' || item.key === 'messages'
                          ? 'violet'
                          : 'cyan'}
                  />
                  <Text style={[styles.filterText, filter === item.key && styles.filterTextSelected]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.filterCount, { color: FILTER_COLORS[item.key] }]}>
                    {counts[item.key] || 0}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <LinearGradient
              colors={['rgba(255, 44, 157, 0)', 'rgba(255, 44, 157, 0.92)', 'rgba(164, 92, 255, 0.54)', 'rgba(59, 201, 255, 0)']}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={styles.queueRule}
            />

            {error ? (
              <SLErrorState
                title="Could not load Roster"
                message={error}
                actionLabel="Try Again"
                onActionPress={() => loadRoster()}
              />
            ) : null}

            {filter === 'all' && workingSetAthletes.length > 0 ? (
              <View style={styles.attentionSection}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionLabel}>Needs Attention</Text>
                  <Pressable onPress={() => setFilter('needs_attention')}>
                    <Text style={styles.viewAll}>View all {counts.needs_attention}</Text>
                  </Pressable>
                </View>
                {workingSetAthletes.map((athlete) => (
                  <AthleteRow
                    key={`attention-${athlete.id}`}
                    athlete={athlete}
                    onPress={() => openWorkspace(athlete)}
                    onLongPress={(anchorY) => showAthleteActions(athlete, anchorY)}
                    onMessage={() => openMessage(athlete)}
                    onReview={() => openReviews(athlete)}
                    onOverflow={(anchorY) => showAthleteActions(athlete, anchorY)}
                  />
                ))}
                {matchingAttentionAthletes.length > workingSetAthletes.length ? (
                  <Pressable onPress={() => setFilter('needs_attention')} style={styles.moreAttention}>
                    <Text style={styles.moreAttentionText}>
                      {matchingAttentionAthletes.length - workingSetAthletes.length} more in Needs Attention
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {filter !== 'all' || visibleRoster.length > 0 ? (
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>
                    {filter === 'all' ? 'Remaining Athletes' : FILTERS.find((item) => item.key === filter)?.label}
                  </Text>
                </View>
                <Text style={styles.sectionMeta}>{visibleRoster.length} athlete{visibleRoster.length === 1 ? '' : 's'}</Text>
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <AthleteRow
            athlete={item}
            onPress={() => openWorkspace(item)}
            onLongPress={(anchorY) => showAthleteActions(item, anchorY)}
            onMessage={() => openMessage(item)}
            onReview={() => openReviews(item)}
            onOverflow={(anchorY) => showAthleteActions(item, anchorY)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        ListEmptyComponent={!error && filter !== 'all' ? (
          <SLEmptyState
            title={athletes.length ? 'No athletes in this queue' : 'No athletes yet'}
            message={athletes.length ? 'Try another filter or search.' : 'Invite an athlete to begin coaching.'}
          />
        ) : null}
        ListFooterComponent={<View style={{ height: 86 }} />}
      />

      <ActionPopover
        context={actionContext}
        onClose={() => setActionContext(null)}
        onOpenWorkspace={() => {
          if (actionContext) openWorkspace(actionContext.athlete);
          setActionContext(null);
        }}
        onMessage={() => {
          if (actionContext) openMessage(actionContext.athlete);
          setActionContext(null);
        }}
        onReview={() => {
          if (actionContext) openReviews(actionContext.athlete);
          setActionContext(null);
        }}
        onOpenProgramming={() => {
          if (actionContext) openProgramming(actionContext.athlete);
          setActionContext(null);
        }}
        onOpenNextSession={() => {
          if (actionContext) openNextSession(actionContext.athlete);
          setActionContext(null);
        }}
        onAddNote={() => {
          if (actionContext) setNoteContext(actionContext);
          setActionContext(null);
        }}
        onSendCheckIn={() => {
          if (actionContext) openCheckIn(actionContext.athlete);
          setActionContext(null);
        }}
      />
      <NoteComposer
        context={noteContext}
        onClose={() => setNoteContext(null)}
      />
    </SLScreen>
  );
}

function AthleteRow({
  athlete,
  onPress,
  onLongPress,
  onMessage,
  onReview,
  onOverflow,
}: {
  athlete: CoachRosterAthlete;
  onPress: () => void;
  onLongPress: (anchorY: number | null) => void;
  onMessage: () => void;
  onReview: () => void;
  onOverflow: (anchorY: number | null) => void;
}) {
  const primary = athlete.primary_attention_reason;
  const color = toneColor(athlete);
  const supportingReasonCount = Math.max(0, athlete.attention_reasons.length - 1);
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.swipeActions}>
          <Pressable accessibilityLabel={`Message ${athlete.name}`} onPress={onMessage} style={styles.swipeAction}>
            <View style={styles.messageActionIcon}>
              <Ionicons name="chatbubble-outline" size={17} color={SLColors.white} />
            </View>
            <Text style={styles.swipeText}>Message</Text>
          </Pressable>
          <Pressable accessibilityLabel={`Review ${athlete.name}`} onPress={onReview} style={[styles.swipeAction, styles.swipeReview]}>
            <View style={styles.reviewActionIcon}>
              <Ionicons name="videocam-outline" size={17} color={SLColors.white} />
            </View>
            <Text style={styles.swipeText}>Review</Text>
          </Pressable>
        </View>
      )}
    >
      <Pressable
        accessibilityLabel={`${athlete.name}. ${primary?.title || athlete.status.label}. ${trainingLine(athlete)}`}
        accessibilityRole="button"
        accessibilityActions={[
          { name: 'activate', label: 'Open athlete workspace' },
          { name: 'longpress', label: 'Show athlete actions' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onPress();
          if (event.nativeEvent.actionName === 'longpress') onLongPress(null);
        }}
        onPress={onPress}
        onLongPress={(event) => onLongPress(event.nativeEvent.pageY)}
        delayLongPress={450}
        style={({ pressed }) => [
          styles.athleteRow,
          primary && styles.athleteRowPriority,
          pressed && styles.rowPressed,
        ]}
      >
        <CoachMaterialLayer
          borderRadius={12}
          emphasis={primary ? 'priority' : 'quiet'}
          tone={materialTone(athlete)}
        />
        <SLAthleteAvatar
          imageUrl={athlete.profilePhotoUrl || athlete.avatar_url}
          imageVersion={athlete.profilePhotoVersion || athlete.avatar_uploaded_at}
          name={athlete.name}
          size={primary ? 46 : 42}
          statusColor={color}
        />
        <View style={styles.athleteCopy}>
          <Text numberOfLines={1} style={[styles.athleteName, primary && styles.athleteNamePriority]}>
            {athlete.is_self ? `${athlete.name} (You)` : athlete.name}
          </Text>
          <View style={styles.reasonLine}>
            {primary ? (
              <Ionicons
                name={reasonIcon(primary.reason_type, primary.category)}
                size={14}
                color={color}
              />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: color }]} />
            )}
            <Text numberOfLines={1} style={[styles.reason, { color }]}>
              {primary?.title || athlete.status.label}
            </Text>
            {primary?.count && primary.count > 1 ? (
              <View style={[styles.unresolvedBadge, { borderColor: color }]}>
                <Text style={[styles.unresolvedBadgeText, { color }]}>{primary.count}</Text>
              </View>
            ) : null}
          </View>
          {supportingReasonCount > 0 ? (
            <Text numberOfLines={1} style={styles.secondaryReason}>
              +{supportingReasonCount} supporting reason{supportingReasonCount === 1 ? '' : 's'}
            </Text>
          ) : primary?.supporting_text ? (
            <Text numberOfLines={1} style={styles.supporting}>{primary.supporting_text}</Text>
          ) : null}
          <Text numberOfLines={1} style={styles.training}>{trainingLine(athlete)}</Text>
        </View>
        {athlete.pending_video_reviews.count || athlete.unread_messages.count ? (
          <View style={styles.signalStack}>
            {athlete.pending_video_reviews.count ? (
              <View style={styles.signal}>
                <Ionicons name="videocam-outline" size={13} color={SLColors.review} />
                <Text style={styles.signalText}>{athlete.pending_video_reviews.count}</Text>
              </View>
            ) : null}
            {athlete.unread_messages.count ? (
              <View style={styles.signal}>
                <Ionicons name="chatbubble-outline" size={12} color={SLColors.accentViolet} />
                <Text style={styles.signalText}>{athlete.unread_messages.count}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Pressable
          accessibilityLabel={`More actions for ${athlete.name}`}
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation();
            onOverflow(event.nativeEvent.pageY);
          }}
          style={styles.overflow}
        >
          <Ionicons name="ellipsis-horizontal" size={21} color={SLColors.textMuted} />
        </Pressable>
      </Pressable>
    </Swipeable>
  );
}

function ActionPopover({
  context,
  onClose,
  onOpenWorkspace,
  onMessage,
  onReview,
  onOpenProgramming,
  onOpenNextSession,
  onAddNote,
  onSendCheckIn,
}: {
  context: AthleteActionContext | null;
  onClose: () => void;
  onOpenWorkspace: () => void;
  onMessage: () => void;
  onReview: () => void;
  onOpenProgramming: () => void;
  onOpenNextSession: () => void;
  onAddNote: () => void;
  onSendCheckIn: () => void;
}) {
  const reduceMotion = useSLReducedMotion();
  const { height: viewportHeight } = useWindowDimensions();
  const estimatedHeight = 388;
  const top = Math.max(
    72,
    Math.min(
      (context?.anchorY ?? viewportHeight / 2) - estimatedHeight / 2,
      viewportHeight - estimatedHeight - 78,
    ),
  );
  const athlete = context?.athlete || null;

  return (
    <Modal
      transparent
      visible={Boolean(context)}
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          accessibilityLabel={`Actions for ${athlete?.name || 'athlete'}`}
          accessibilityViewIsModal
          onPress={(event: GestureResponderEvent) => event.stopPropagation()}
          style={[styles.popover, { top }]}
        >
          <CoachMaterialLayer
            borderRadius={17}
            emphasis="standard"
            tone="violet"
          />
          <View style={styles.popoverHeader}>
            <SLAthleteAvatar
              imageUrl={athlete?.profilePhotoUrl || athlete?.avatar_url}
              imageVersion={athlete?.profilePhotoVersion || athlete?.avatar_uploaded_at}
              name={athlete?.name || 'Athlete'}
              size={34}
              statusColor={athlete ? toneColor(athlete) : SLColors.accentViolet}
            />
            <View style={styles.popoverHeaderCopy}>
              <Text style={styles.popoverEyebrow}>Athlete Actions</Text>
              <Text numberOfLines={1} style={styles.popoverTitle}>{athlete?.name}</Text>
            </View>
            <Pressable
              accessibilityLabel="Close athlete actions"
              hitSlop={10}
              onPress={onClose}
              style={styles.popoverClose}
            >
              <Ionicons name="close" size={22} color={SLColors.textStrong} />
            </Pressable>
          </View>
          <ScrollView bounces={false}>
            <PopoverAction icon="person-outline" label="Open athlete workspace" meta="Full context" onPress={onOpenWorkspace} />
            <PopoverAction icon="chatbubble-outline" label="Message" meta="Conversation" onPress={onMessage} />
            <PopoverAction icon="videocam-outline" label="Review videos" meta="Waiting media" onPress={onReview} />
            <PopoverAction icon="calendar-outline" label="Open programming" meta="Program and Sessions" onPress={onOpenProgramming} />
            <PopoverAction icon="arrow-forward-circle-outline" label="Open next Session" meta="Assigned work" onPress={onOpenNextSession} />
            <PopoverAction icon="create-outline" label="Add note" meta="Coach context" onPress={onAddNote} />
            <PopoverAction icon="checkbox-outline" label="Send check-in" meta="Athlete prompt" onPress={onSendCheckIn} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NoteComposer({
  context,
  onClose,
}: {
  context: AthleteActionContext | null;
  onClose: () => void;
}) {
  const reduceMotion = useSLReducedMotion();
  const { height: viewportHeight } = useWindowDimensions();
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const athlete = context?.athlete || null;
  const top = Math.max(
    96,
    Math.min(
      (context?.anchorY ?? viewportHeight * 0.38) - 70,
      viewportHeight - 360,
    ),
  );

  useEffect(() => {
    if (!context) {
      setBody('');
      setSaveError(null);
      setSaving(false);
    }
  }, [context]);

  const saveNote = useCallback(async () => {
    const noteBody = body.trim();
    if (!athlete || !noteBody || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetchJson('/coach-utility-dock/notes', {
        method: 'POST',
        body: JSON.stringify({
          athlete_id: athlete.id,
          body: noteBody,
          scope: 'athlete',
        }),
      });
      const payload = response.json as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        setSaveError(payload?.error || 'Could not save note.');
        return;
      }
      onClose();
    } catch (error) {
      console.warn('Coach note save failed', error);
      setSaveError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }, [athlete, body, onClose, saving]);

  return (
    <Modal
      transparent
      visible={Boolean(context)}
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          accessibilityLabel={`Add note for ${athlete?.name || 'athlete'}`}
          accessibilityViewIsModal
          onPress={(event: GestureResponderEvent) => event.stopPropagation()}
          style={[styles.notePopover, { top }]}
        >
          <CoachMaterialLayer
            borderRadius={SLRadius.radiusCard}
            emphasis="priority"
            tone={athlete ? materialTone(athlete) : 'neutral'}
          />
          <View style={styles.popoverHeader}>
            <SLAthleteAvatar
              imageUrl={athlete?.profilePhotoUrl || athlete?.avatar_url}
              imageVersion={athlete?.profilePhotoVersion || athlete?.avatar_uploaded_at}
              name={athlete?.name || 'Athlete'}
              size={42}
              statusColor={athlete ? toneColor(athlete) : SLColors.accentViolet}
            />
            <View style={styles.popoverHeaderCopy}>
              <Text style={styles.popoverEyebrow}>Coach Context</Text>
              <Text numberOfLines={1} style={styles.popoverTitle}>{athlete?.name}</Text>
            </View>
            <Pressable accessibilityLabel="Close note composer" hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={22} color={SLColors.textStrong} />
            </Pressable>
          </View>
          <View style={styles.noteBody}>
            <TextInput
              accessibilityLabel={`Note for ${athlete?.name || 'athlete'}`}
              autoFocus
              multiline
              onChangeText={setBody}
              placeholder="Add coaching context"
              placeholderTextColor={SLColors.textSubtle}
              style={styles.noteInput}
              value={body}
            />
            {saveError ? <Text style={styles.noteError}>{saveError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !body.trim() || saving }}
              disabled={!body.trim() || saving}
              onPress={saveNote}
              style={[
                styles.noteSave,
                (!body.trim() || saving) && styles.noteSaveDisabled,
              ]}
            >
              <Text style={styles.noteSaveText}>{saving ? 'Saving…' : 'Save note'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PopoverAction({
  icon,
  label,
  meta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.popoverAction}>
      <View style={styles.popoverIcon}>
        <Ionicons name={icon} size={16} color={SLColors.accentViolet} />
      </View>
      <View style={styles.popoverActionCopy}>
        <Text style={styles.popoverActionText}>{label}</Text>
        <Text style={styles.popoverActionMeta}>{meta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={SLColors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centerState: { flex: 1, justifyContent: 'center' },
  content: { paddingTop: 2, paddingBottom: 94 },
  headerStack: { gap: 8, paddingBottom: 8 },
  rosterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 54,
    paddingBottom: 6,
    paddingTop: 5,
  },
  coachGreeting: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  coachGreetingCopy: { flex: 1, minWidth: 0 },
  rosterHeaderTitle: {
    color: SLColors.textStrong,
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 20,
  },
  addAthleteButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    height: 30,
    overflow: 'hidden',
    paddingHorizontal: 10,
  },
  addAthleteButtonText: { color: SLColors.textStrong, fontSize: 10 },
  searchShell: {
    alignItems: 'center',
    borderRadius: 9,
    flexDirection: 'row',
    gap: 7,
    minHeight: 36,
    overflow: 'hidden',
    paddingHorizontal: 10,
  },
  searchInput: { color: SLColors.textStrong, flex: 1, fontSize: 13, paddingVertical: 0 },
  filters: { gap: 6, paddingRight: 18, paddingVertical: 3 },
  filter: {
    alignItems: 'center',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 4,
    height: 29,
    overflow: 'hidden',
    paddingHorizontal: 9,
  },
  queueRule: {
    height: 1,
    marginBottom: 1,
    marginTop: 1,
  },
  filterText: { color: SLColors.textMuted, fontSize: 10 },
  filterTextSelected: { color: SLColors.textStrong },
  filterCount: { fontSize: 9 },
  attentionSection: { gap: 6 },
  moreAttention: { alignItems: 'center', minHeight: 26, justifyContent: 'center' },
  moreAttentionText: { color: SLColors.textMuted, fontSize: 10 },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 27,
    paddingHorizontal: 1,
  },
  sectionLabel: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  viewAll: { color: SLColors.accentViolet, fontSize: 10 },
  sectionTitle: { color: SLColors.textStrong, fontSize: 14, fontWeight: '700' },
  sectionMeta: { color: SLColors.textMuted, fontSize: 10 },
  athleteRow: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 9,
    minHeight: 76,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 7,
    position: 'relative',
  },
  athleteRowPriority: { minHeight: 84, paddingVertical: 9 },
  athleteCopy: { flex: 1, minWidth: 0 },
  athleteName: { color: SLColors.textStrong, flexShrink: 1, fontSize: 14, fontWeight: '700', lineHeight: 17 },
  athleteNamePriority: { fontSize: 15, lineHeight: 19 },
  reasonLine: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 2, minWidth: 0 },
  statusDot: { borderRadius: 3, height: 6, width: 6 },
  reason: { flexShrink: 1, fontSize: 11, fontWeight: '700', lineHeight: 14 },
  supporting: { color: SLColors.textMuted, fontSize: 10, lineHeight: 13 },
  secondaryReason: { color: SLColors.textMuted, fontSize: 9, lineHeight: 12 },
  training: { color: SLColors.textSubtle, fontSize: 9, lineHeight: 12, marginTop: 1 },
  unresolvedBadge: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    height: 17,
    justifyContent: 'center',
    minWidth: 17,
    paddingHorizontal: 4,
  },
  unresolvedBadgeText: { fontSize: 8, fontWeight: '700' },
  signalStack: { alignItems: 'flex-end', gap: 2, justifyContent: 'center' },
  signal: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 44, 157, 0.08)',
    borderRadius: 9,
    flexDirection: 'row',
    gap: 2,
    height: 17,
    justifyContent: 'center',
    minWidth: 25,
    paddingHorizontal: 4,
  },
  signalText: { color: SLColors.textMuted, fontSize: 9, fontWeight: '700' },
  overflow: { alignItems: 'center', height: 22, justifyContent: 'center', width: 27 },
  pressed: { opacity: 0.76 },
  rowPressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  swipeActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  swipeAction: {
    alignItems: 'center',
    backgroundColor: '#211438',
    gap: 4,
    justifyContent: 'center',
    width: 75,
  },
  swipeReview: { backgroundColor: '#3A102C' },
  messageActionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(115, 75, 221, 0.72)',
    borderRadius: 9,
    height: 31,
    justifyContent: 'center',
    width: 31,
  },
  reviewActionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(205, 43, 115, 0.72)',
    borderRadius: 9,
    height: 31,
    justifyContent: 'center',
    width: 31,
  },
  swipeText: { color: SLColors.white, fontSize: 10 },
  modalBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.34)', flex: 1 },
  popover: {
    borderRadius: 17,
    maxHeight: '72%',
    maxWidth: 360,
    overflow: 'hidden',
    position: 'absolute',
    right: 12,
    shadowColor: '#A45CFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    width: '88%',
  },
  popoverHeader: {
    alignItems: 'center',
    borderBottomColor: 'rgba(164, 92, 255, 0.20)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 9,
    minHeight: 58,
    paddingHorizontal: 10,
  },
  popoverHeaderCopy: { flex: 1, minWidth: 0 },
  popoverClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  popoverEyebrow: {
    color: SLColors.accentViolet,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  popoverTitle: { color: SLColors.textStrong, fontSize: 15, fontWeight: '700', lineHeight: 18, marginTop: 1 },
  popoverAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 4, 12, 0.36)',
    borderBottomColor: 'rgba(164, 92, 255, 0.14)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 47,
    paddingHorizontal: 10,
  },
  popoverIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(164, 92, 255, 0.12)',
    borderRadius: 8,
    height: 29,
    justifyContent: 'center',
    width: 29,
  },
  popoverActionCopy: { flex: 1, minWidth: 0 },
  popoverActionText: { color: SLColors.textStrong, fontSize: 13, fontWeight: '700', lineHeight: 16 },
  popoverActionMeta: { color: SLColors.textMuted, fontSize: 9, lineHeight: 11, marginTop: 1 },
  notePopover: {
    borderColor: SLColors.border,
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    left: 14,
    overflow: 'hidden',
    position: 'absolute',
    right: 14,
  },
  noteBody: { gap: 10, padding: 14 },
  noteInput: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.border,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    color: SLColors.textStrong,
    fontSize: 15,
    minHeight: 112,
    padding: 12,
    textAlignVertical: 'top',
  },
  noteError: { color: SLColors.danger, fontSize: 12 },
  noteSave: {
    alignItems: 'center',
    backgroundColor: SLColors.accentViolet,
    borderRadius: SLRadius.radiusControl,
    justifyContent: 'center',
    minHeight: 44,
  },
  noteSaveDisabled: { opacity: 0.44 },
  noteSaveText: { color: SLColors.textStrong, fontSize: 14, fontWeight: '700' },
});
