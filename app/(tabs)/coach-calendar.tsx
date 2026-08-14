import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NewCoachExperience, type NewCoachExperiencePayload } from '@/components/NewCoachExperience';
import {
  SL_TAB_ROW_CONTROL,
  SLTabRowControlItem,
  SLTabRowControlShell,
} from '@/components/navigation/sl-tab-row-control';
import { SLAthleteAvatar, SLButton, SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLLayout, SLSpacing, SLStatusTones, type SLStatusTone } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import {
  addCalendarDays,
  calendarRange,
  calendarSessionMatchesStatus,
  calendarStatusLabel,
  coachCalendarRequestRange,
  coachCalendarWindowNeedsShift,
  formatCalendarDate,
  fromLocalYMD,
  isCalendarSessionMovable,
  monthGridRows,
  sameAthleteDateMove,
  selectedAthleteLabel,
  startOfCalendarWeek,
  toLocalYMD,
  type CoachCalendarStatusFilter,
  type CoachCalendarView,
} from '@/lib/coach-calendar';

type CalendarAthlete = { id: number; name: string; avatar_url?: string | null };
type CalendarSession = {
  workout_id: number;
  athlete_id: number;
  athlete_name: string;
  date: string;
  scheduled_time?: string | null;
  scheduled_timezone?: string | null;
  label: string;
  status: string;
  block_name?: string | null;
  training_block_id?: number | null;
  tags?: string[];
  planned_summary?: string | null;
  has_post_session_survey?: boolean;
  post_session_reviewed?: boolean;
  needs_session_review?: boolean;
};
type CalendarMeet = {
  meet_plan_id: number;
  athlete_id: number;
  athlete_name: string;
  meet_name?: string | null;
  date: string;
  days_out?: number | null;
};
type CalendarCustomItem = {
  id: number;
  title: string;
  date: string;
  time?: string | null;
  category: string;
  notes?: string | null;
  color?: string | null;
  athlete_id?: number | null;
  athlete_name?: string | null;
};
type CalendarDay = {
  date: string;
  is_today: boolean;
  counts: Record<string, number>;
  sessions: CalendarSession[];
  meets: CalendarMeet[];
  custom_items: CalendarCustomItem[];
};
type CalendarResponse = {
  ok: boolean;
  error?: string;
  start: string;
  end: string;
  summary: Record<string, number>;
  athletes: CalendarAthlete[];
  days: CalendarDay[];
  new_coach_experience?: NewCoachExperiencePayload | null;
};
type ItemDraft = {
  id?: number;
  title: string;
  date: string;
  time: string;
  category: string;
  notes: string;
  athleteId: number | null;
};

const ATHLETE_COLUMN = 112;
const DAY_COLUMN = 92;
const ROW_HEIGHT = 92;
const CALENDAR_ATHLETE_FILTER_KEY = 'strength-ledger:coach-calendar:athlete-filter:v1';
// Keep this list aligned with the canonical web Training Calendar. Meets are
// projected from MeetPlan and are not duplicated as custom calendar items.
const ITEM_CATEGORIES = [
  'Reminder',
  'Weigh-in',
  'Travel',
  'Team Check-in',
  'Programming Day',
  'Personal Note',
  'Do Not Schedule',
];
const STATUS_FILTERS: Array<{ key: CoachCalendarStatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'needs', label: 'Needs' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'draft', label: 'Draft' },
];

function statusTone(status: string): SLStatusTone {
  const value = String(status || '').toLowerCase();
  if (value === 'completed') return 'success';
  if (value === 'in_progress') return 'warning';
  if (value === 'draft') return 'neutral';
  if (value === 'missed' || value === 'incomplete') return 'danger';
  return 'accent';
}

function statusColor(status: string) {
  return SLStatusTones[statusTone(status)].icon;
}

function emptyDraft(date: string, athleteId: number | null = null): ItemDraft {
  return { title: '', date, time: '', category: 'Reminder', notes: '', athleteId };
}

function allDayItems(day?: CalendarDay | null) {
  if (!day) return [];
  return [
    ...day.sessions.map((item) => ({ kind: 'session' as const, item })),
    ...day.meets.map((item) => ({ kind: 'meet' as const, item })),
    ...day.custom_items.map((item) => ({ kind: 'custom' as const, item })),
  ];
}

type CalendarAgendaEntry =
  | { kind: 'session'; item: CalendarSession }
  | { kind: 'meet'; item: CalendarMeet }
  | { kind: 'custom'; item: CalendarCustomItem };

function orderedDayItems(day: CalendarDay): CalendarAgendaEntry[] {
  return allDayItems(day).sort((left, right) => {
    const leftTime = left.kind === 'session'
      ? left.item.scheduled_time
      : left.kind === 'custom' ? left.item.time : null;
    const rightTime = right.kind === 'session'
      ? right.item.scheduled_time
      : right.kind === 'custom' ? right.item.time : null;
    if (leftTime && rightTime) return leftTime.localeCompare(rightTime);
    if (leftTime) return -1;
    if (rightTime) return 1;
    return left.kind.localeCompare(right.kind);
  });
}

export default function CoachCalendarScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<CoachCalendarView>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [weekWindowAnchor, setWeekWindowAnchor] = useState(() => new Date());
  const [weekScrollTarget, setWeekScrollTarget] = useState(() => ({
    date: toLocalYMD(startOfCalendarWeek(new Date())),
    token: 0,
  }));
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CoachCalendarStatusFilter>('all');
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<number[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [dayDetail, setDayDetail] = useState<CalendarDay | null>(null);
  const [selectedSession, setSelectedSession] = useState<CalendarSession | null>(null);
  const [selectedCustomItem, setSelectedCustomItem] = useState<CalendarCustomItem | null>(null);
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(() => emptyDraft(toLocalYMD(new Date())));
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [dateAction, setDateAction] = useState<'move' | 'duplicate'>('move');
  const [moveDate, setMoveDate] = useState(toLocalYMD(new Date()));
  const [moving, setMoving] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const range = useMemo(() => calendarRange(view, anchor), [anchor, view]);
  const requestAnchor = view === 'week' ? weekWindowAnchor : anchor;
  const requestRange = useMemo(
    () => coachCalendarRequestRange(view, requestAnchor),
    [requestAnchor, view],
  );
  const loadSequence = useRef(0);
  const athleteFilterHydrated = useRef(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(CALENDAR_ATHLETE_FILTER_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedAthleteIds(parsed.filter((value): value is number => Number.isInteger(value) && value > 0));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) athleteFilterHydrated.current = true;
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!athleteFilterHydrated.current) return;
    void AsyncStorage.setItem(CALENDAR_ATHLETE_FILTER_KEY, JSON.stringify(selectedAthleteIds)).catch(() => undefined);
  }, [selectedAthleteIds]);

  const loadCalendar = useCallback(async (silent = false) => {
    const sequence = ++loadSequence.current;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        start: toLocalYMD(requestRange.start),
        end: toLocalYMD(requestRange.end),
        athlete_id: 'ALL',
        include_completed: '1',
      });
      const response = await fetchJson<CalendarResponse>(`/coach/mobile/calendar?${query}`, { method: 'GET' });
      if (sequence !== loadSequence.current) return;
      if (!response.ok || !response.json?.ok) {
        setError(response.json?.error || `Could not load Calendar. (${response.status})`);
        return;
      }
      setData(response.json);
    } catch {
      if (sequence === loadSequence.current) setError('Network error. Pull to refresh or try again.');
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [requestRange.end, requestRange.start]);

  useFocusEffect(useCallback(() => { void loadCalendar(false); }, [loadCalendar]));

  const athletes = data?.athletes || [];
  useEffect(() => {
    if (!athletes.length || !selectedAthleteIds.length) return;
    const rosterIds = new Set(athletes.map((athlete) => athlete.id));
    const retained = selectedAthleteIds.filter((id) => rosterIds.has(id));
    if (retained.length !== selectedAthleteIds.length) setSelectedAthleteIds(retained);
  }, [athletes, selectedAthleteIds]);
  const selectedAthleteSet = useMemo(() => new Set(selectedAthleteIds), [selectedAthleteIds]);
  const athleteVisible = useCallback((athleteId?: number | null) => {
    if (!selectedAthleteIds.length) return true;
    if (!athleteId) return true;
    return selectedAthleteSet.has(Number(athleteId));
  }, [selectedAthleteIds.length, selectedAthleteSet]);
  const visibleAthletes = useMemo(
    () => athletes.filter((athlete) => !selectedAthleteIds.length || selectedAthleteSet.has(athlete.id)),
    [athletes, selectedAthleteIds.length, selectedAthleteSet]
  );
  const visibleDays = useMemo(() => (data?.days || []).map((day) => ({
    ...day,
    sessions: (day.sessions || []).filter((session) => athleteVisible(session.athlete_id) && calendarSessionMatchesStatus(session, statusFilter)),
    meets: (day.meets || []).filter((meet) => athleteVisible(meet.athlete_id)),
    custom_items: (day.custom_items || []).filter((item) => athleteVisible(item.athlete_id)),
  })), [athleteVisible, data?.days, statusFilter]);
  const rangeStartKey = toLocalYMD(range.start);
  const rangeEndKey = toLocalYMD(range.end);
  const rangeDays = useMemo(
    () => visibleDays.filter((day) => day.date >= rangeStartKey && day.date < rangeEndKey),
    [rangeEndKey, rangeStartKey, visibleDays],
  );
  const visibleSessionCount = useMemo(() => rangeDays.reduce((total, day) => total + day.sessions.length, 0), [rangeDays]);
  const visibleDraftCount = useMemo(() => rangeDays.reduce((total, day) => total + day.sessions.filter((session) => session.status === 'draft').length, 0), [rangeDays]);
  const visibleInProgress = useMemo(() => rangeDays.reduce((total, day) => total + day.sessions.filter((session) => session.status === 'in_progress').length, 0), [rangeDays]);
  const visibleMeetCount = useMemo(() => rangeDays.reduce((total, day) => total + day.meets.length, 0), [rangeDays]);

  const shiftAnchor = useCallback((direction: number) => {
    if (view === 'week') {
      const next = addCalendarDays(anchor, direction * 7);
      setAnchor(next);
      setWeekScrollTarget((current) => ({
        date: toLocalYMD(startOfCalendarWeek(next)),
        token: current.token + 1,
      }));
      if (data?.start && coachCalendarWindowNeedsShift(next, fromLocalYMD(data.start))) {
        setWeekWindowAnchor(next);
      }
      return;
    }
    if (view === 'month') setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1, 12));
    else setAnchor((current) => addCalendarDays(current, direction * 42));
  }, [anchor, data?.start, view]);

  const selectCalendarView = useCallback((nextView: CoachCalendarView) => {
    if (nextView === 'week' && view !== 'week') {
      setWeekWindowAnchor(anchor);
      setWeekScrollTarget((current) => ({
        date: toLocalYMD(startOfCalendarWeek(anchor)),
        token: current.token + 1,
      }));
    }
    setView(nextView);
  }, [anchor, view]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setAnchor(today);
    if (view === 'week') {
      setWeekWindowAnchor(today);
      setWeekScrollTarget((current) => ({
        date: toLocalYMD(startOfCalendarWeek(today)),
        token: current.token + 1,
      }));
    }
  }, [view]);

  const onVisibleWeekSettled = useCallback((date: string) => {
    const visibleDate = fromLocalYMD(date);
    if (Number.isNaN(visibleDate.getTime())) return;
    setAnchor((current) => toLocalYMD(current) === date ? current : visibleDate);
    if (!data?.start || !coachCalendarWindowNeedsShift(visibleDate, fromLocalYMD(data.start))) return;
    setWeekWindowAnchor((current) => (
      toLocalYMD(startOfCalendarWeek(current)) === toLocalYMD(startOfCalendarWeek(visibleDate))
        ? current
        : visibleDate
    ));
  }, [data?.start]);

  const openCreateSession = useCallback((date: string, athlete?: CalendarAthlete | null) => {
    setCreateOpen(false);
    setDayDetail(null);
    const params: Record<string, string> = { date };
    if (athlete) {
      params.athleteId = String(athlete.id);
      params.athleteName = athlete.name;
    }
    router.push({ pathname: '/create-workout', params } as any);
  }, [router]);

  const openItemEditor = useCallback((date: string, athleteId: number | null, item?: CalendarCustomItem) => {
    setItemError(null);
    setSelectedCustomItem(item || null);
    setItemDraft(item ? {
      id: item.id,
      title: item.title,
      date: item.date,
      time: item.time || '',
      category: item.category || 'Reminder',
      notes: item.notes || '',
      athleteId: item.athlete_id || null,
    } : emptyDraft(date, athleteId));
    setCreateOpen(false);
    setDayDetail(null);
    setItemEditorOpen(true);
  }, []);

  const saveCalendarItem = useCallback(async () => {
    if (!itemDraft.title.trim()) {
      setItemError('Title is required.');
      return;
    }
    setSavingItem(true);
    setItemError(null);
    try {
      const path = itemDraft.id
        ? `/coach/mobile/calendar/items/${itemDraft.id}`
        : '/coach/mobile/calendar/items';
      const response = await fetchJson<{ ok: boolean; error?: string }>(path, {
        method: itemDraft.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          title: itemDraft.title.trim(),
          date: itemDraft.date,
          time: itemDraft.time.trim(),
          category: itemDraft.category,
          notes: itemDraft.notes.trim(),
          athlete_id: itemDraft.athleteId,
        }),
      });
      if (!response.ok || !response.json?.ok) {
        setItemError(response.json?.error || `Save failed. (${response.status})`);
        return;
      }
      setItemEditorOpen(false);
      setSelectedCustomItem(null);
      await loadCalendar(true);
    } catch {
      setItemError('Save failed. Please try again.');
    } finally {
      setSavingItem(false);
    }
  }, [itemDraft, loadCalendar]);

  const deleteCalendarItem = useCallback((item: CalendarCustomItem) => {
    Alert.alert('Delete Calendar Item', `Delete “${item.title}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const response = await fetchJson<{ ok: boolean; error?: string }>(`/coach/mobile/calendar/items/${item.id}`, { method: 'DELETE' });
          if (!response.ok || !response.json?.ok) Alert.alert('Delete failed', response.json?.error || 'Please try again.');
          else {
            setSelectedCustomItem(null);
            setItemEditorOpen(false);
            await loadCalendar(true);
          }
        },
      },
    ]);
  }, [loadCalendar]);

  const moveSession = useCallback(async (session: CalendarSession, date: string) => {
    if (!sameAthleteDateMove(session, date, session.athlete_id)) return;
    setMoving(true);
    try {
      const response = await fetchJson<{ ok: boolean; error?: string }>(`/coach/mobile/workouts/${session.workout_id}/move`, {
        method: 'POST', body: JSON.stringify({ date }),
      });
      if (!response.ok || !response.json?.ok) {
        Alert.alert('Move failed', response.json?.error || 'The Session remains on its original date.');
        return;
      }
      setSelectedSession(null);
      setMovePickerOpen(false);
      await loadCalendar(true);
    } catch {
      Alert.alert('Move failed', 'The Session remains on its original date.');
    } finally {
      setMoving(false);
    }
  }, [loadCalendar]);

  const duplicateSession = useCallback(async (session: CalendarSession, date: string) => {
    setMoving(true);
    try {
      const response = await fetchJson<{ ok: boolean; error?: string }>(`/coach/mobile/workouts/${session.workout_id}/duplicate`, {
        method: 'POST', body: JSON.stringify({ date }),
      });
      if (!response.ok || !response.json?.ok) {
        Alert.alert('Duplicate failed', response.json?.error || 'The Session was not duplicated.');
        return;
      }
      setSelectedSession(null);
      setMovePickerOpen(false);
      await loadCalendar(true);
    } catch {
      Alert.alert('Duplicate failed', 'The Session was not duplicated.');
    } finally {
      setMoving(false);
    }
  }, [loadCalendar]);

  const deleteSession = useCallback((session: CalendarSession) => {
    Alert.alert('Delete Session', `Delete “${session.label}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const response = await fetchJson<{ ok: boolean; error?: string }>(`/coach/mobile/workouts/${session.workout_id}/delete`, { method: 'POST' });
          if (!response.ok || !response.json?.ok) Alert.alert('Delete failed', response.json?.error || 'The Session was not deleted.');
          else {
            setSelectedSession(null);
            await loadCalendar(true);
          }
        },
      },
    ]);
  }, [loadCalendar]);

  const openSessionWorkspace = useCallback((session: CalendarSession) => {
    setSelectedSession(null);
    router.push({
      pathname: '/workout/session-workspace/[workoutId]' as any,
      params: { workoutId: String(session.workout_id), athleteId: String(session.athlete_id) },
    } as any);
  }, [router]);

  if (loading && !data) {
    return <SLScreen edges="none"><View style={styles.center}><SLLoadingState title="Loading Calendar" message="Building the coaching week…" /></View></SLScreen>;
  }

  const boardHeight = Math.max(380, height - 330);
  const rangeLabel = view === 'month'
    ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : `${formatCalendarDate(toLocalYMD(range.start), { month: 'short', day: 'numeric' })} – ${formatCalendarDate(toLocalYMD(addCalendarDays(range.end, -1)), { month: 'short', day: 'numeric' })}`;

  return (
    <SLScreen edges="none" padded={false}>
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <View>
            <Text typographyRole="pageTitle" style={styles.title}>Calendar</Text>
            <Text style={styles.subtitle}>Athletes × schedule</Text>
          </View>
          <Pressable accessibilityLabel="Calendar filters" onPress={() => setFilterOpen(true)} style={styles.iconButton}>
            <Ionicons color={SLColors.text} name="options-outline" size={20} />
          </Pressable>
        </View>

        {data?.new_coach_experience ? <NewCoachExperience experience={data.new_coach_experience} /> : null}

        <View style={styles.controlsRow}>
          <Pressable onPress={() => setFilterOpen(true)} style={styles.athleteFilterButton}>
            <Ionicons color={SLColors.textMuted} name="people-outline" size={15} />
            <Text numberOfLines={1} style={styles.filterButtonText}>{selectedAthleteLabel(athletes, selectedAthleteIds)}</Text>
            <Ionicons color={SLColors.textSubtle} name="chevron-down" size={14} />
          </Pressable>
          <View style={styles.segmentedControl}>
            {(['week', 'month', 'agenda'] as CoachCalendarView[]).map((mode) => (
              <Pressable key={mode} onPress={() => selectCalendarView(mode)} style={[styles.segment, view === mode && styles.segmentActive]}>
                <Text style={[styles.segmentText, view === mode && styles.segmentTextActive]}>{mode[0].toUpperCase() + mode.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.summaryStrip}>
          <SummaryValue color={SLStatusTones.success.icon} label="Sessions" value={visibleSessionCount} />
          <SummaryValue color={SLStatusTones.neutral.icon} label="Draft" value={visibleDraftCount} />
          <SummaryValue color={SLStatusTones.warning.icon} label="In Progress" value={visibleInProgress} />
          <SummaryValue color={SLStatusTones.review.icon} label="Meets" value={visibleMeetCount} />
        </View>

        <View style={styles.rangeRow}>
          <Pressable accessibilityLabel="Previous date range" onPress={() => shiftAnchor(-1)} style={styles.rangeArrow}>
            <Ionicons color={SLColors.textMuted} name="chevron-back" size={19} />
          </Pressable>
          <Pressable onPress={goToToday} style={styles.rangeLabelButton}>
            <Text style={styles.rangeLabel}>{rangeLabel}</Text>
            <Text style={styles.todayHint}>Today</Text>
          </Pressable>
          <Pressable accessibilityLabel="Next date range" onPress={() => shiftAnchor(1)} style={styles.rangeArrow}>
            <Ionicons color={SLColors.textMuted} name="chevron-forward" size={19} />
          </Pressable>
        </View>

        {error ? <SLErrorState title="Could not load Calendar" message={error} actionLabel="Try Again" onActionPress={() => loadCalendar(false)} /> : null}

        {!error && view === 'week' ? (
          <WeekBoard
            athletes={visibleAthletes}
            days={visibleDays}
            height={boardHeight}
            moving={moving}
            onCreate={(date, athlete) => { setItemDraft(emptyDraft(date, athlete.id)); setCreateOpen(true); }}
            onDayPress={setDayDetail}
            onItemPress={setSelectedCustomItem}
            onMove={moveSession}
            onSessionPress={setSelectedSession}
            onVisibleWeekSettled={onVisibleWeekSettled}
            onRefresh={() => loadCalendar(true)}
            reduceMotion={reduceMotion}
            refreshing={refreshing}
            scrollTarget={weekScrollTarget}
            timelineViewportWidth={Math.max(DAY_COLUMN, width - ATHLETE_COLUMN)}
          />
        ) : null}
        {!error && view === 'month' ? (
          <MonthBoard
            anchor={anchor}
            days={rangeDays}
            key={toLocalYMD(range.start)}
            onAdd={(day) => { setItemDraft(emptyDraft(day.date)); setCreateOpen(true); }}
            onCustomPress={setSelectedCustomItem}
            onMeetPress={(meet) => router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(meet.athlete_id), athleteName: meet.athlete_name } } as any)}
            onRefresh={() => loadCalendar(true)}
            onSessionPress={setSelectedSession}
            refreshing={refreshing}
          />
        ) : null}
        {!error && view === 'agenda' ? (
          <AgendaBoard days={rangeDays} onCustomPress={setSelectedCustomItem} onDayAdd={(day) => { setItemDraft(emptyDraft(day.date)); setCreateOpen(true); }} onMeetPress={(meet) => router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(meet.athlete_id), athleteName: meet.athlete_name } } as any)} onRefresh={() => loadCalendar(true)} onSessionPress={setSelectedSession} refreshing={refreshing} />
        ) : null}

        <View
          pointerEvents="box-none"
          style={[
            styles.fabDock,
            { bottom: insets.bottom + SLSpacing.xs + SL_TAB_ROW_CONTROL.shellHeight + SLSpacing.md },
          ]}
        >
          <SLTabRowControlShell style={styles.fabShell}>
            <SLTabRowControlItem
              accessibilityLabel="Create Calendar item"
              icon="add"
              onPress={() => { setItemDraft(emptyDraft(toLocalYMD(anchor))); setCreateOpen(true); }}
              selected
            />
          </SLTabRowControlShell>
        </View>
      </View>

      <FilterModal
        athletes={athletes}
        onClose={() => setFilterOpen(false)}
        search={filterSearch}
        selectedAthleteIds={selectedAthleteIds}
        setSearch={setFilterSearch}
        setSelectedAthleteIds={setSelectedAthleteIds}
        setStatusFilter={setStatusFilter}
        statusFilter={statusFilter}
        visible={filterOpen}
      />

      <CreateModal
        athletes={visibleAthletes}
        draft={itemDraft}
        onClose={() => setCreateOpen(false)}
        onCustom={() => openItemEditor(itemDraft.date, itemDraft.athleteId)}
        onSession={() => openCreateSession(itemDraft.date, athletes.find((athlete) => athlete.id === itemDraft.athleteId))}
        setDraft={setItemDraft}
        visible={createOpen}
      />

      <DayDetailModal
        day={dayDetail}
        onAdd={(day) => { setDayDetail(null); setItemDraft(emptyDraft(day.date)); setCreateOpen(true); }}
        onClose={() => setDayDetail(null)}
        onCustom={setSelectedCustomItem}
        onSession={setSelectedSession}
      />

      <SessionDetailModal
        moving={moving}
        onClose={() => setSelectedSession(null)}
        onDelete={() => selectedSession && deleteSession(selectedSession)}
        onDuplicate={() => {
          if (!selectedSession) return;
          setDateAction('duplicate');
          setMoveDate(toLocalYMD(addCalendarDays(fromLocalYMD(selectedSession.date), 7)));
          setMovePickerOpen(true);
        }}
        onMove={() => {
          if (!selectedSession) return;
          setDateAction('move');
          setMoveDate(selectedSession.date);
          setMovePickerOpen(true);
        }}
        onOpen={() => selectedSession && openSessionWorkspace(selectedSession)}
        session={selectedSession}
      />

      <CustomItemDetailModal
        item={selectedCustomItem}
        onClose={() => setSelectedCustomItem(null)}
        onDelete={deleteCalendarItem}
        onEdit={(item) => openItemEditor(item.date, item.athlete_id || null, item)}
      />

      <ItemEditorModal
        athletes={athletes}
        draft={itemDraft}
        error={itemError}
        onClose={() => setItemEditorOpen(false)}
        onSave={saveCalendarItem}
        saving={savingItem}
        setDraft={setItemDraft}
        visible={itemEditorOpen}
      />

      <DateModal
        date={moveDate}
        actionLabel={dateAction === 'move' ? 'Move Session' : 'Duplicate Session'}
        onChange={setMoveDate}
        onClose={() => setMovePickerOpen(false)}
        onDone={() => selectedSession && (dateAction === 'move' ? moveSession(selectedSession, moveDate) : duplicateSession(selectedSession, moveDate))}
        saving={moving}
        title={dateAction === 'move' ? 'Move Session' : 'Duplicate Session'}
        visible={movePickerOpen}
      />
    </SLScreen>
  );
}

function SummaryValue({ label, value, color }: { label: string; value: number; color: string }) {
  return <View style={styles.summaryValue}><View style={[styles.summaryDot, { backgroundColor: color }]} /><Text style={styles.summaryNumber}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

type WeekDragState = { athleteId: number; targetDate: string } | null;
type WeekCellItems = { sessions: CalendarSession[]; customItems: CalendarCustomItem[]; meets: CalendarMeet[] };
type WeekVisibleItem =
  | { kind: 'session'; value: CalendarSession }
  | { kind: 'custom'; value: CalendarCustomItem }
  | { kind: 'meet'; value: CalendarMeet };

const WeekAthleteRow = React.memo(function WeekAthleteRow({ athlete, days, cellIndex, dragState, moving, reduceMotion, onHorizontalScroll, onHorizontalSettled, onRegisterRow, onSessionPress, onItemPress, onMove, onCreate, onDragState }: {
  athlete: CalendarAthlete;
  days: CalendarDay[];
  cellIndex: Map<string, WeekCellItems>;
  dragState: WeekDragState;
  moving: boolean;
  reduceMotion: boolean;
  onHorizontalScroll: (athleteId: number, x: number) => void;
  onHorizontalSettled: (x: number) => void;
  onRegisterRow: (athleteId: number, ref: ScrollView | null) => void;
  onSessionPress: (session: CalendarSession) => void;
  onItemPress: (item: CalendarCustomItem) => void;
  onMove: (session: CalendarSession, date: string) => void;
  onCreate: (date: string, athlete: CalendarAthlete) => void;
  onDragState: (state: WeekDragState) => void;
}) {
  const sameAthleteDrag = dragState?.athleteId === athlete.id;
  return (
    <View style={styles.matrixRow}>
      <View style={styles.athleteCell}>
        <SLAthleteAvatar imageUrl={athlete.avatar_url} name={athlete.name} size={34} />
        <Text numberOfLines={2} style={styles.athleteName}>{athlete.name}</Text>
      </View>
      <ScrollView
        directionalLockEnabled
        horizontal
        onMomentumScrollEnd={(event) => onHorizontalSettled(event.nativeEvent.contentOffset.x)}
        onScroll={(event) => onHorizontalScroll(athlete.id, event.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(event) => onHorizontalSettled(event.nativeEvent.contentOffset.x)}
        ref={(ref) => onRegisterRow(athlete.id, ref)}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.rowScroll}
      >
        {days.map((day, dayIndex) => {
          const items = cellIndex.get(`${athlete.id}:${day.date}`) || { sessions: [], customItems: [], meets: [] };
          const itemCount = items.sessions.length + items.customItems.length + items.meets.length;
          // Week rows are intentionally compact: render at most two items in a
          // cell and summarize the remainder instead of overflowing the row.
          const visibleItems: WeekVisibleItem[] = [
            ...items.sessions.map((value): WeekVisibleItem => ({ kind: 'session', value })),
            ...items.customItems.map((value): WeekVisibleItem => ({ kind: 'custom', value })),
            ...items.meets.map((value): WeekVisibleItem => ({ kind: 'meet', value })),
          ].slice(0, 2);
          return (
            <Pressable
              accessibilityLabel={`${athlete.name}, ${formatCalendarDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}${itemCount ? `, ${itemCount} items` : ', empty'}`}
              disabled={!!dragState}
              key={day.date}
              onPress={() => onCreate(day.date, athlete)}
              style={[
                styles.dayCell,
                day.is_today && styles.dayCellToday,
                sameAthleteDrag && styles.dayCellDragValid,
                sameAthleteDrag && dragState?.targetDate === day.date && styles.dayCellDragTarget,
              ]}
            >
              {visibleItems.map((item) => {
                if (item.kind === 'session') {
                  return (
                    <DraggableSessionChip
                      days={days}
                      dayIndex={dayIndex}
                      key={`session-${item.value.workout_id}`}
                      moving={moving}
                      onDragState={onDragState}
                      onMove={onMove}
                      onPress={onSessionPress}
                      reduceMotion={reduceMotion}
                      session={item.value}
                    />
                  );
                }
                if (item.kind === 'custom') {
                  return <CustomChip item={item.value} key={`custom-${item.value.id}`} onPress={onItemPress} />;
                }
                return <MeetChip key={`meet-${item.value.meet_plan_id}`} meet={item.value} />;
              })}
              {itemCount === 0 ? <Ionicons color={SLColors.textSubtle} name="add-circle-outline" size={16} /> : null}
              {itemCount > 2 ? <Text style={styles.moreCount}>+{itemCount - 2}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

function WeekBoard({ athletes, days, height, refreshing, moving, reduceMotion, scrollTarget, timelineViewportWidth, onRefresh, onSessionPress, onItemPress, onMove, onCreate, onDayPress, onVisibleWeekSettled }: {
  athletes: CalendarAthlete[];
  days: CalendarDay[];
  height: number;
  refreshing: boolean;
  moving: boolean;
  reduceMotion: boolean;
  scrollTarget: { date: string; token: number };
  timelineViewportWidth: number;
  onRefresh: () => void;
  onSessionPress: (session: CalendarSession) => void;
  onItemPress: (item: CalendarCustomItem) => void;
  onMove: (session: CalendarSession, date: string) => void;
  onCreate: (date: string, athlete: CalendarAthlete) => void;
  onDayPress: (day: CalendarDay) => void;
  onVisibleWeekSettled: (date: string) => void;
}) {
  const headerRef = useRef<ScrollView | null>(null);
  const rowRefs = useRef(new Map<number, ScrollView>());
  const syncing = useRef(false);
  const currentX = useRef(0);
  const previousFirstDay = useRef<string | null>(null);
  const preservedCenterDate = useRef<string | null>(scrollTarget.date);
  const preservedCenterFraction = useRef(0.5);
  const handledTargetToken = useRef(-1);
  const lastSettledDate = useRef<string | null>(null);
  const [dragState, setDragState] = useState<WeekDragState>(null);
  const cellIndex = useMemo(() => {
    const index = new Map<string, WeekCellItems>();
    const ensure = (athleteId: number, date: string) => {
      const key = `${athleteId}:${date}`;
      const existing = index.get(key);
      if (existing) return existing;
      const created: WeekCellItems = { sessions: [], customItems: [], meets: [] };
      index.set(key, created);
      return created;
    };
    days.forEach((day) => {
      day.sessions.forEach((session) => ensure(session.athlete_id, day.date).sessions.push(session));
      day.custom_items.forEach((item) => { if (item.athlete_id) ensure(item.athlete_id, day.date).customItems.push(item); });
      day.meets.forEach((meet) => ensure(meet.athlete_id, day.date).meets.push(meet));
    });
    return index;
  }, [days]);
  const clampX = useCallback((x: number) => Math.max(
    0,
    Math.min(x, Math.max(0, days.length * DAY_COLUMN - timelineViewportWidth)),
  ), [days.length, timelineViewportWidth]);
  const rememberCenter = useCallback((x: number) => {
    if (!days.length) return;
    const center = (clampX(x) + timelineViewportWidth / 2) / DAY_COLUMN;
    const index = Math.max(0, Math.min(days.length - 1, Math.floor(center)));
    preservedCenterDate.current = days[index]?.date || null;
    preservedCenterFraction.current = center - index;
  }, [clampX, days, timelineViewportWidth]);
  const scrollAll = useCallback((x: number, animated: boolean) => {
    const nextX = clampX(x);
    currentX.current = nextX;
    syncing.current = true;
    headerRef.current?.scrollTo({ x: nextX, animated });
    rowRefs.current.forEach((ref) => ref.scrollTo({ x: nextX, animated }));
    rememberCenter(nextX);
    requestAnimationFrame(() => { syncing.current = false; });
  }, [clampX, rememberCenter]);
  const syncX = useCallback((x: number, source: string) => {
    if (syncing.current) return;
    const nextX = clampX(x);
    currentX.current = nextX;
    rememberCenter(nextX);
    syncing.current = true;
    if (source !== 'header') headerRef.current?.scrollTo({ x: nextX, animated: false });
    rowRefs.current.forEach((ref, id) => { if (source !== String(id)) ref.scrollTo({ x: nextX, animated: false }); });
    requestAnimationFrame(() => { syncing.current = false; });
  }, [clampX, rememberCenter]);
  const onScroll = (source: string) => (event: NativeSyntheticEvent<NativeScrollEvent>) => syncX(event.nativeEvent.contentOffset.x, source);
  const onHorizontalScroll = useCallback((athleteId: number, x: number) => syncX(x, String(athleteId)), [syncX]);
  const settleVisibleWeek = useCallback((x: number) => {
    rememberCenter(x);
    const date = preservedCenterDate.current;
    if (!date || date === lastSettledDate.current) return;
    lastSettledDate.current = date;
    onVisibleWeekSettled(date);
  }, [onVisibleWeekSettled, rememberCenter]);
  const onRegisterRow = useCallback((athleteId: number, ref: ScrollView | null) => {
    if (!ref) {
      rowRefs.current.delete(athleteId);
      return;
    }
    rowRefs.current.set(athleteId, ref);
    requestAnimationFrame(() => ref.scrollTo({ x: currentX.current, animated: false }));
  }, []);

  useLayoutEffect(() => {
    const firstDay = days[0]?.date || null;
    if (!firstDay) return;
    const targetIndex = days.findIndex((day) => day.date === scrollTarget.date);
    if (handledTargetToken.current !== scrollTarget.token && targetIndex >= 0) {
      const initialPosition = handledTargetToken.current < 0;
      handledTargetToken.current = scrollTarget.token;
      previousFirstDay.current = firstDay;
      scrollAll(targetIndex * DAY_COLUMN, !initialPosition && !reduceMotion);
      return;
    }
    if (previousFirstDay.current && previousFirstDay.current !== firstDay && preservedCenterDate.current) {
      const preservedIndex = days.findIndex((day) => day.date === preservedCenterDate.current);
      if (preservedIndex >= 0) {
        scrollAll(
          (preservedIndex + preservedCenterFraction.current) * DAY_COLUMN - timelineViewportWidth / 2,
          false,
        );
      }
    }
    previousFirstDay.current = firstDay;
  }, [days, reduceMotion, scrollAll, scrollTarget, timelineViewportWidth]);

  if (!athletes.length) return <View style={[styles.boardEmpty, { height }]}><Text style={styles.emptyTitle}>No athletes match these filters</Text></View>;

  return (
    <View style={[styles.weekBoard, { height }]}>
      <View style={styles.matrixHeader}>
        <View style={styles.athleteHeader}><Text style={styles.athleteHeaderText}>ATHLETE</Text></View>
        <ScrollView
          directionalLockEnabled
          horizontal
          onMomentumScrollEnd={(event) => settleVisibleWeek(event.nativeEvent.contentOffset.x)}
          onScroll={onScroll('header')}
          onScrollEndDrag={(event) => settleVisibleWeek(event.nativeEvent.contentOffset.x)}
          ref={headerRef}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={styles.dateHeaderScroll}
        >
          {days.map((day) => (
            <Pressable key={day.date} onPress={() => onDayPress(day)} style={[styles.dateHeaderCell, day.is_today && styles.dateHeaderToday]}>
              <Text style={[styles.dateDow, day.is_today && styles.dateTodayText]}>{formatCalendarDate(day.date, { weekday: 'short' }).toUpperCase()}</Text>
              <Text style={[styles.dateNumber, day.is_today && styles.dateTodayText]}>{fromLocalYMD(day.date).getDate()}</Text>
              <View style={styles.dayCountDots}>
                {!!day.sessions.length && <View style={[styles.miniDot, { backgroundColor: SLStatusTones.accent.icon }]} />}
                {!!day.custom_items.length && <View style={[styles.miniDot, { backgroundColor: SLStatusTones.review.icon }]} />}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={athletes}
        extraData={dragState}
        getItemLayout={(_, index) => ({ index, length: ROW_HEIGHT, offset: ROW_HEIGHT * index })}
        initialNumToRender={8}
        keyExtractor={(athlete) => String(athlete.id)}
        maxToRenderPerBatch={8}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentViolet} />}
        renderItem={({ item: athlete }) => (
          <WeekAthleteRow
            athlete={athlete}
            cellIndex={cellIndex}
            days={days}
            dragState={dragState}
            moving={moving}
            onCreate={onCreate}
            onDragState={setDragState}
            onHorizontalScroll={onHorizontalScroll}
            onHorizontalSettled={settleVisibleWeek}
            onItemPress={onItemPress}
            onMove={onMove}
            onRegisterRow={onRegisterRow}
            onSessionPress={onSessionPress}
            reduceMotion={reduceMotion}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.weekRowsContent}
        style={styles.matrixRows}
        windowSize={7}
      />
    </View>
  );
}

function DraggableSessionChip({ session, dayIndex, days, moving, reduceMotion, onDragState, onMove, onPress }: {
  session: CalendarSession; dayIndex: number; days: CalendarDay[]; moving: boolean;
  reduceMotion: boolean;
  onDragState: (state: WeekDragState) => void;
  onMove: (session: CalendarSession, date: string) => void; onPress: (session: CalendarSession) => void;
}) {
  const x = useSharedValue(0);
  const scale = useSharedValue(1);
  const lastTargetIndex = useRef(dayIndex);
  const movable = isCalendarSessionMovable(session) && !moving;
  const gesture = Gesture.Pan()
    .enabled(movable)
    .activateAfterLongPress(320)
    .activeOffsetX([-6, 6])
    .runOnJS(true)
    .onStart(() => {
      lastTargetIndex.current = dayIndex;
      scale.value = reduceMotion ? 1 : withSpring(1.04);
      onDragState({ athleteId: session.athlete_id, targetDate: days[dayIndex]?.date || session.date });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      const targetIndex = Math.max(0, Math.min(days.length - 1, dayIndex + Math.round(event.translationX / DAY_COLUMN)));
      if (targetIndex !== lastTargetIndex.current) {
        lastTargetIndex.current = targetIndex;
        onDragState({ athleteId: session.athlete_id, targetDate: days[targetIndex]?.date || session.date });
        void Haptics.selectionAsync();
      }
    })
    .onEnd((event) => {
      const targetIndex = Math.max(0, Math.min(days.length - 1, dayIndex + Math.round(event.translationX / DAY_COLUMN)));
      const target = days[targetIndex];
      if (target && target.date !== session.date) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onMove(session, target.date);
      }
      x.value = reduceMotion ? 0 : withSpring(0);
      scale.value = reduceMotion ? 1 : withSpring(1);
    })
    .onFinalize(() => {
      onDragState(null);
      x.value = reduceMotion ? 0 : withSpring(0);
      scale.value = reduceMotion ? 1 : withSpring(1);
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scale: scale.value }], zIndex: scale.value > 1 ? 10 : 1 }));
  const color = statusColor(session.status);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.sessionChip, { borderColor: color, backgroundColor: `${color}18` }, animatedStyle]}>
        <Pressable accessibilityHint={movable ? 'Long press and drag left or right to change the date.' : undefined} accessibilityLabel={`${session.athlete_name}, ${session.label}, ${formatCalendarDate(session.date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${calendarStatusLabel(session.status)}`} accessibilityRole="button" disabled={moving} onPress={(event) => { event.stopPropagation(); onPress(session); }} style={styles.chipPressable}>
          <Text numberOfLines={1} style={styles.chipTitle}>{session.label}</Text>
          <Text numberOfLines={1} style={styles.chipMeta}>{session.block_name || calendarStatusLabel(session.status)}</Text>
          <View style={[styles.chipStatusDot, { backgroundColor: color }]} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function CustomChip({ item, onPress }: { item: CalendarCustomItem; onPress: (item: CalendarCustomItem) => void }) {
  return <Pressable onPress={(event) => { event.stopPropagation(); onPress(item); }} style={styles.customChip}><Text numberOfLines={1} style={styles.chipTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.chipMeta}>{item.time || item.category}</Text></Pressable>;
}

function MeetChip({ meet }: { meet: CalendarMeet }) {
  return <View style={styles.meetChip}><Text numberOfLines={1} style={styles.chipTitle}>{meet.meet_name || 'Meet'}</Text><Text style={styles.chipMeta}>Meet</Text></View>;
}

function MonthBoard({ anchor, days, refreshing, onRefresh, onSessionPress, onCustomPress, onMeetPress, onAdd }: {
  anchor: Date;
  days: CalendarDay[];
  refreshing: boolean;
  onRefresh: () => void;
  onSessionPress: (session: CalendarSession) => void;
  onCustomPress: (item: CalendarCustomItem) => void;
  onMeetPress: (meet: CalendarMeet) => void;
  onAdd: (day: CalendarDay) => void;
}) {
  const rows = monthGridRows(days);
  const initialDate = days.find((day) => day.is_today)?.date
    || days.find((day) => fromLocalYMD(day.date).getMonth() === anchor.getMonth() && allDayItems(day).length)?.date
    || days.find((day) => fromLocalYMD(day.date).getMonth() === anchor.getMonth())?.date
    || days[0]?.date
    || toLocalYMD(anchor);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const selectedDay = days.find((day) => day.date === selectedDate) || days[0];
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentViolet} />} style={styles.viewScroll} contentContainerStyle={styles.monthContent}>
      <View style={styles.monthWeekdays}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.monthWeekday}>{day}</Text>)}</View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.monthRow}>
          {row.map((day) => {
            const inMonth = fromLocalYMD(day.date).getMonth() === anchor.getMonth();
            const count = day.sessions.length + day.custom_items.length + day.meets.length;
            return (
              <Pressable accessibilityLabel={`${formatCalendarDate(day.date)}, ${count} items`} accessibilityState={{ selected: day.date === selectedDate }} key={day.date} onPress={() => setSelectedDate(day.date)} style={[styles.monthDay, day.is_today && styles.monthDayToday, day.date === selectedDate && styles.monthDaySelected]}>
                <Text style={[styles.monthDate, !inMonth && styles.monthDateOutside, (day.is_today || day.date === selectedDate) && styles.dateTodayText]}>{fromLocalYMD(day.date).getDate()}</Text>
                <View style={styles.monthDots}>
                  {day.sessions.slice(0, 3).map((session) => <View key={session.workout_id} style={[styles.monthDot, { backgroundColor: statusColor(session.status) }]} />)}
                  {!!day.custom_items.length && <View style={[styles.monthDot, { backgroundColor: SLStatusTones.review.icon }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      {selectedDay ? <View style={styles.monthAgenda}>
        <View style={styles.agendaDayHeader}>
          <View><Text style={styles.sectionTitle}>{formatCalendarDate(selectedDay.date, { weekday: 'long', month: 'short', day: 'numeric' })}</Text><Text style={styles.sectionMeta}>{allDayItems(selectedDay).length} item{allDayItems(selectedDay).length === 1 ? '' : 's'}</Text></View>
          <Pressable accessibilityLabel={`Add to ${selectedDay.date}`} onPress={() => onAdd(selectedDay)} style={styles.smallAdd}><Ionicons color={SLColors.accentViolet} name="add" size={20} /></Pressable>
        </View>
        {!allDayItems(selectedDay).length ? <View style={styles.monthAgendaEmpty}><Text style={styles.sectionMeta}>Nothing scheduled for this date.</Text></View> : null}
        {orderedDayItems(selectedDay).map((entry) => <CalendarAgendaRow entry={entry} key={`${entry.kind}-${entry.kind === 'session' ? entry.item.workout_id : entry.kind === 'meet' ? entry.item.meet_plan_id : entry.item.id}`} onCustomPress={onCustomPress} onMeetPress={onMeetPress} onSessionPress={onSessionPress} />)}
      </View> : null}
    </ScrollView>
  );
}

function AgendaBoard({ days, refreshing, onRefresh, onSessionPress, onCustomPress, onMeetPress, onDayAdd }: {
  days: CalendarDay[]; refreshing: boolean; onRefresh: () => void; onSessionPress: (session: CalendarSession) => void;
  onCustomPress: (item: CalendarCustomItem) => void; onMeetPress: (meet: CalendarMeet) => void; onDayAdd: (day: CalendarDay) => void;
}) {
  const populated = days.filter((day) => allDayItems(day).length);
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentViolet} />} style={styles.viewScroll} contentContainerStyle={styles.agendaContent}>
      {!populated.length ? <View style={styles.boardEmpty}><Text style={styles.emptyTitle}>No upcoming Calendar items</Text></View> : null}
      {populated.map((day) => (
        <View key={day.date} style={styles.agendaDay}>
          <View style={styles.agendaDayHeader}><View><Text style={styles.agendaDate}>{day.is_today ? 'Today' : formatCalendarDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}</Text><Text style={styles.sectionMeta}>{allDayItems(day).length} item{allDayItems(day).length === 1 ? '' : 's'}</Text></View><Pressable accessibilityLabel={`Add to ${day.date}`} onPress={() => onDayAdd(day)} style={styles.smallAdd}><Ionicons color={SLColors.accentViolet} name="add" size={20} /></Pressable></View>
          {orderedDayItems(day).map((entry) => <CalendarAgendaRow entry={entry} key={`${entry.kind}-${entry.kind === 'session' ? entry.item.workout_id : entry.kind === 'meet' ? entry.item.meet_plan_id : entry.item.id}`} onCustomPress={onCustomPress} onMeetPress={onMeetPress} onSessionPress={onSessionPress} />)}
        </View>
      ))}
    </ScrollView>
  );
}

function AgendaRow({ title, meta, icon, tone, onPress }: { title: string; meta: string; icon: keyof typeof Ionicons.glyphMap; tone: SLStatusTone; onPress: () => void }) {
  const color = SLStatusTones[tone].icon;
  return <Pressable onPress={onPress} style={styles.agendaRow}><View style={[styles.agendaIcon, { borderColor: color }]}><Ionicons color={color} name={icon} size={17} /></View><View style={styles.agendaCopy}><Text numberOfLines={1} style={styles.agendaTitle}>{title}</Text><Text numberOfLines={1} style={styles.agendaMeta}>{meta}</Text></View><Ionicons color={SLColors.textSubtle} name="chevron-forward" size={17} /></Pressable>;
}

function CalendarAgendaRow({ entry, onSessionPress, onMeetPress, onCustomPress }: {
  entry: CalendarAgendaEntry;
  onSessionPress: (session: CalendarSession) => void;
  onMeetPress: (meet: CalendarMeet) => void;
  onCustomPress: (item: CalendarCustomItem) => void;
}) {
  if (entry.kind === 'session') {
    const session = entry.item;
    return <AgendaRow icon="barbell-outline" meta={`${session.scheduled_time ? `${session.scheduled_time} · ` : ''}${session.athlete_name} · ${calendarStatusLabel(session.status)}`} onPress={() => onSessionPress(session)} title={session.label} tone={statusTone(session.status)} />;
  }
  if (entry.kind === 'meet') {
    const meet = entry.item;
    return <AgendaRow icon="flag-outline" meta={`${meet.athlete_name} · Meet`} onPress={() => onMeetPress(meet)} title={meet.meet_name || 'Meet'} tone="review" />;
  }
  const item = entry.item;
  return <AgendaRow icon="calendar-outline" meta={`${item.time ? `${item.time} · ` : ''}${item.athlete_name || 'Team'} · ${item.category}`} onPress={() => onCustomPress(item)} title={item.title} tone="info" />;
}

function Sheet({ children, onClose, title, visible, height = 'auto' }: { children: React.ReactNode; onClose: () => void; title: string; visible: boolean; height?: number | 'auto' }) {
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}><View style={styles.modalOverlay}><Pressable onPress={onClose} style={StyleSheet.absoluteFill} /><View style={[styles.sheet, height !== 'auto' && { maxHeight: height }]}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><Pressable accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.sheetClose}><Ionicons color={SLColors.text} name="close" size={21} /></Pressable></View>{children}</View></View></Modal>;
}

function FilterModal({ visible, athletes, selectedAthleteIds, setSelectedAthleteIds, statusFilter, setStatusFilter, search, setSearch, onClose }: {
  visible: boolean; athletes: CalendarAthlete[]; selectedAthleteIds: number[]; setSelectedAthleteIds: (ids: number[]) => void;
  statusFilter: CoachCalendarStatusFilter; setStatusFilter: (value: CoachCalendarStatusFilter) => void; search: string; setSearch: (value: string) => void; onClose: () => void;
}) {
  const filtered = athletes.filter((athlete) => athlete.name.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: number) => {
    if (!selectedAthleteIds.length) setSelectedAthleteIds([id]);
    else if (selectedAthleteIds.includes(id)) {
      const next = selectedAthleteIds.filter((value) => value !== id);
      setSelectedAthleteIds(next.length === athletes.length ? [] : next);
    } else {
      const next = [...selectedAthleteIds, id];
      setSelectedAthleteIds(next.length === athletes.length ? [] : next);
    }
  };
  return <Sheet onClose={onClose} title="Calendar Filters" visible={visible} height={680}><ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled"><TextInput accessibilityLabel="Search athletes" onChangeText={setSearch} placeholder="Search athletes" placeholderTextColor={SLColors.textSubtle} style={styles.input} value={search} /><View style={styles.filterSectionHeader}><Text style={styles.fieldLabel}>ATHLETES</Text><Pressable onPress={() => setSelectedAthleteIds([])}><Text style={styles.linkText}>All Athletes</Text></Pressable></View>{filtered.map((athlete) => { const selected = !selectedAthleteIds.length || selectedAthleteIds.includes(athlete.id); return <Pressable key={athlete.id} onPress={() => toggle(athlete.id)} style={styles.filterAthleteRow}><SLAthleteAvatar imageUrl={athlete.avatar_url} name={athlete.name} size={36} /><Text style={styles.filterAthleteName}>{athlete.name}</Text><Ionicons color={selected ? SLColors.accentViolet : SLColors.textSubtle} name={selected ? 'checkbox' : 'square-outline'} size={22} /></Pressable>; })}<Text style={[styles.fieldLabel, styles.statusLabel]}>STATUS</Text><View style={styles.filterChips}>{STATUS_FILTERS.map((filter) => <Pressable key={filter.key} onPress={() => setStatusFilter(filter.key)} style={[styles.filterChip, statusFilter === filter.key && styles.filterChipActive]}><Text style={[styles.filterChipText, statusFilter === filter.key && styles.filterChipTextActive]}>{filter.label}</Text></Pressable>)}</View><SLButton fullWidth label="Done" onPress={onClose} /></ScrollView></Sheet>;
}

function CreateModal({ visible, draft, setDraft, athletes, onClose, onSession, onCustom }: { visible: boolean; draft: ItemDraft; setDraft: React.Dispatch<React.SetStateAction<ItemDraft>>; athletes: CalendarAthlete[]; onClose: () => void; onSession: () => void; onCustom: () => void }) {
  return <Sheet onClose={onClose} title="Create Calendar Item" visible={visible}><View style={styles.sheetBody}><Text style={styles.fieldLabel}>DATE</Text><InlineDatePicker value={draft.date} onChange={(date) => setDraft((current) => ({ ...current, date }))} /><Text style={styles.fieldLabel}>ATHLETE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.athleteChips}><ChoiceChip label="Team" selected={draft.athleteId == null} onPress={() => setDraft((current) => ({ ...current, athleteId: null }))} />{athletes.map((athlete) => <ChoiceChip key={athlete.id} label={athlete.name} selected={draft.athleteId === athlete.id} onPress={() => setDraft((current) => ({ ...current, athleteId: athlete.id }))} />)}</ScrollView><Pressable disabled={!draft.athleteId} onPress={onSession} style={[styles.createChoice, !draft.athleteId && styles.disabled]}><View style={styles.createIcon}><Ionicons color={SLColors.accentViolet} name="barbell-outline" size={22} /></View><View style={styles.createCopy}><Text style={styles.createTitle}>Create Session</Text><Text style={styles.createMeta}>{draft.athleteId ? 'Add a Training Session for this athlete.' : 'Choose an athlete first.'}</Text></View><Ionicons color={SLColors.textSubtle} name="chevron-forward" size={19} /></Pressable><Pressable onPress={onCustom} style={styles.createChoice}><View style={[styles.createIcon, styles.customCreateIcon]}><Ionicons color={SLStatusTones.review.icon} name="calendar-outline" size={22} /></View><View style={styles.createCopy}><Text style={styles.createTitle}>Add Custom Item</Text><Text style={styles.createMeta}>Meet, check-in, travel, or other event.</Text></View><Ionicons color={SLColors.textSubtle} name="chevron-forward" size={19} /></Pressable></View></Sheet>;
}

function DayDetailModal({ day, onClose, onSession, onCustom, onAdd }: { day: CalendarDay | null; onClose: () => void; onSession: (session: CalendarSession) => void; onCustom: (item: CalendarCustomItem) => void; onAdd: (day: CalendarDay) => void }) {
  const groups = day ? groupDayItemsByAthlete(day) : [];
  return <Sheet onClose={onClose} title={day ? formatCalendarDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Day Details'} visible={!!day} height={680}>{day ? <ScrollView contentContainerStyle={styles.sheetBody}>{!allDayItems(day).length ? <View style={styles.boardEmpty}><Text style={styles.emptyTitle}>Nothing scheduled</Text><Text style={styles.sectionMeta}>Create a Session or custom Calendar item.</Text></View> : null}{groups.map((group) => <View key={group.key} style={styles.dayDetailGroup}><Text style={styles.dayDetailGroupTitle}>{group.label}</Text>{group.sessions.map((session) => <AgendaRow icon="barbell-outline" key={session.workout_id} meta={calendarStatusLabel(session.status)} onPress={() => { onClose(); onSession(session); }} title={session.label} tone={statusTone(session.status)} />)}{group.meets.map((meet) => <AgendaRow icon="flag-outline" key={meet.meet_plan_id} meta="Meet" onPress={() => {}} title={meet.meet_name || 'Meet'} tone="review" />)}{group.customItems.map((item) => <AgendaRow icon="calendar-outline" key={item.id} meta={item.time || item.category} onPress={() => { onClose(); onCustom(item); }} title={item.title} tone="info" />)}</View>)}<SLButton fullWidth iconLeft="add" label={`Add to ${formatCalendarDate(day.date, { month: 'short', day: 'numeric' })}`} onPress={() => onAdd(day)} /></ScrollView> : null}</Sheet>;
}

function groupDayItemsByAthlete(day: CalendarDay) {
  const groups = new Map<string, { key: string; label: string; sessions: CalendarSession[]; meets: CalendarMeet[]; customItems: CalendarCustomItem[] }>();
  const ensure = (athleteId: number | null | undefined, label: string | null | undefined) => {
    const key = athleteId ? `athlete-${athleteId}` : 'team';
    if (!groups.has(key)) groups.set(key, { key, label: label || 'Team', sessions: [], meets: [], customItems: [] });
    return groups.get(key)!;
  };
  day.sessions.forEach((session) => ensure(session.athlete_id, session.athlete_name).sessions.push(session));
  day.meets.forEach((meet) => ensure(meet.athlete_id, meet.athlete_name).meets.push(meet));
  day.custom_items.forEach((item) => ensure(item.athlete_id, item.athlete_name).customItems.push(item));
  return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function SessionDetailModal({ session, moving, onClose, onOpen, onMove, onDuplicate, onDelete }: { session: CalendarSession | null; moving: boolean; onClose: () => void; onOpen: () => void; onMove: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const canChange = !!session && isCalendarSessionMovable(session);
  return <Sheet onClose={onClose} title="Session Details" visible={!!session}>{session ? <View style={styles.sheetBody}><View style={styles.detailHero}><View style={styles.detailTitleRow}><View style={[styles.detailIcon, { borderColor: statusColor(session.status) }]}><Ionicons color={statusColor(session.status)} name="barbell-outline" size={21} /></View><View style={styles.detailCopy}><Text style={styles.detailTitle}>{session.label}</Text><Text style={styles.detailMeta}>{session.athlete_name} · {calendarStatusLabel(session.status)}</Text></View></View><Text style={styles.detailDate}>{formatCalendarDate(session.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>{session.planned_summary ? <Text style={styles.detailSummary}>{session.planned_summary}</Text> : null}</View><SLButton fullWidth iconLeft="open-outline" label="Open in Workspace" onPress={onOpen} />{canChange ? <SLButton fullWidth iconLeft="calendar-outline" label="Move Session" loading={moving} onPress={onMove} variant="secondary" /> : null}{canChange ? <SLButton fullWidth iconLeft="copy-outline" label="Duplicate Session" loading={moving} onPress={onDuplicate} variant="secondary" /> : null}{canChange ? <SLButton fullWidth iconLeft="trash-outline" label="Delete Session" onPress={onDelete} variant="danger" /> : null}</View> : null}</Sheet>;
}

function CustomItemDetailModal({ item, onClose, onEdit, onDelete }: { item: CalendarCustomItem | null; onClose: () => void; onEdit: (item: CalendarCustomItem) => void; onDelete: (item: CalendarCustomItem) => void }) {
  return <Sheet onClose={onClose} title="Calendar Item" visible={!!item}>{item ? <View style={styles.sheetBody}><View style={styles.detailHero}><Text style={styles.detailTitle}>{item.title}</Text><Text style={styles.detailMeta}>{item.athlete_name || 'Team'} · {item.category}</Text><Text style={styles.detailDate}>{formatCalendarDate(item.date, { weekday: 'long', month: 'long', day: 'numeric' })}{item.time ? ` · ${item.time}` : ''}</Text>{item.notes ? <Text style={styles.detailSummary}>{item.notes}</Text> : null}</View><SLButton fullWidth iconLeft="create-outline" label="Edit Item" onPress={() => { onClose(); onEdit(item); }} /><SLButton fullWidth iconLeft="trash-outline" label="Delete Item" onPress={() => onDelete(item)} variant="danger" /></View> : null}</Sheet>;
}

function ItemEditorModal({ visible, draft, setDraft, athletes, saving, error, onClose, onSave }: { visible: boolean; draft: ItemDraft; setDraft: React.Dispatch<React.SetStateAction<ItemDraft>>; athletes: CalendarAthlete[]; saving: boolean; error: string | null; onClose: () => void; onSave: () => void }) {
  return <Sheet onClose={onClose} title={draft.id ? 'Edit Calendar Item' : 'Add Custom Item'} visible={visible} height={740}><ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled"><Text style={styles.fieldLabel}>TITLE</Text><TextInput accessibilityLabel="Calendar item title" onChangeText={(title) => setDraft((current) => ({ ...current, title }))} placeholder="Calendar item title" placeholderTextColor={SLColors.textSubtle} style={styles.input} value={draft.title} /><Text style={styles.fieldLabel}>DATE</Text><InlineDatePicker value={draft.date} onChange={(date) => setDraft((current) => ({ ...current, date }))} /><Text style={styles.fieldLabel}>TIME (OPTIONAL)</Text><TextInput accessibilityLabel="Time in 24-hour format" autoCapitalize="none" onChangeText={(time) => setDraft((current) => ({ ...current, time }))} placeholder="HH:MM" placeholderTextColor={SLColors.textSubtle} style={styles.input} value={draft.time} /><Text style={styles.fieldLabel}>CATEGORY</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.athleteChips}>{ITEM_CATEGORIES.map((category) => <ChoiceChip key={category} label={category} selected={draft.category === category} onPress={() => setDraft((current) => ({ ...current, category }))} />)}</ScrollView><Text style={styles.fieldLabel}>ATHLETE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.athleteChips}><ChoiceChip label="Team" selected={draft.athleteId == null} onPress={() => setDraft((current) => ({ ...current, athleteId: null }))} />{athletes.map((athlete) => <ChoiceChip key={athlete.id} label={athlete.name} selected={draft.athleteId === athlete.id} onPress={() => setDraft((current) => ({ ...current, athleteId: athlete.id }))} />)}</ScrollView><Text style={styles.fieldLabel}>NOTES</Text><TextInput accessibilityLabel="Calendar item notes" multiline onChangeText={(notes) => setDraft((current) => ({ ...current, notes }))} placeholder="Optional context" placeholderTextColor={SLColors.textSubtle} style={[styles.input, styles.notesInput]} textAlignVertical="top" value={draft.notes} />{error ? <Text style={styles.errorText}>{error}</Text> : null}<SLButton fullWidth label={draft.id ? 'Save Changes' : 'Add to Calendar'} loading={saving} onPress={onSave} /></ScrollView></Sheet>;
}

function DateModal({ visible, title, date, actionLabel, saving, onChange, onClose, onDone }: { visible: boolean; title: string; date: string; actionLabel: string; saving: boolean; onChange: (date: string) => void; onClose: () => void; onDone: () => void }) {
  return <Sheet onClose={onClose} title={title} visible={visible}><View style={styles.sheetBody}><InlineDatePicker value={date} onChange={onChange} large /><SLButton fullWidth label={actionLabel} loading={saving} onPress={onDone} /></View></Sheet>;
}

function InlineDatePicker({ value, onChange, large = false }: { value: string; onChange: (date: string) => void; large?: boolean }) {
  return <DateTimePicker display={Platform.OS === 'ios' ? (large ? 'inline' : 'compact') : 'default'} mode="date" onChange={(_, date) => { if (date) onChange(toLocalYMD(date)); }} themeVariant="dark" value={fromLocalYMD(value)} />;
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choiceChip, selected && styles.choiceChipActive]}><Text numberOfLines={1} style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 10 }, center: { flex: 1, justifyContent: 'center' },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 10 }, title: { color: SLColors.textStrong, fontSize: 29, fontWeight: '800' }, subtitle: { color: SLColors.textMuted, fontSize: 13, marginTop: 1 }, iconButton: { alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderStrong, borderRadius: 14, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  controlsRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8 }, athleteFilterButton: { alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderHairline, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 5, maxWidth: 145, minHeight: 38, paddingHorizontal: 10 }, filterButtonText: { color: SLColors.text, flexShrink: 1, fontSize: 13, fontWeight: '700' }, segmentedControl: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderHairline, borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: 'row', padding: 3 }, segment: { alignItems: 'center', borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 32 }, segmentActive: { backgroundColor: SLColors.accentSoft }, segmentText: { color: SLColors.textMuted, fontSize: 11, fontWeight: '700' }, segmentTextActive: { color: SLColors.accentViolet },
  summaryStrip: { alignItems: 'center', backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderHairline, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 38, paddingHorizontal: 10 }, summaryValue: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 4 }, summaryDot: { borderRadius: 4, height: 7, width: 7 }, summaryNumber: { color: SLColors.text, fontSize: 12, fontWeight: '800' }, summaryLabel: { color: SLColors.textMuted, fontSize: 9 },
  rangeRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 50 }, rangeArrow: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 }, rangeLabelButton: { alignItems: 'center', flex: 1 }, rangeLabel: { color: SLColors.text, fontSize: 15, fontWeight: '800' }, todayHint: { color: SLColors.accentViolet, fontSize: 9, marginTop: 1, textTransform: 'uppercase' },
  fabDock: { position: 'absolute', right: SLLayout.screenGutter, zIndex: 30 }, fabShell: { width: SL_TAB_ROW_CONTROL.shellHeight },
  weekBoard: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderTopWidth: 1, borderBottomWidth: 1, overflow: 'hidden' }, matrixHeader: { backgroundColor: SLColors.object, borderBottomColor: SLColors.borderStrong, borderBottomWidth: 1, flexDirection: 'row', height: 64 }, athleteHeader: { alignItems: 'center', borderRightColor: SLColors.borderStrong, borderRightWidth: 1, justifyContent: 'center', width: ATHLETE_COLUMN }, athleteHeaderText: { color: SLColors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, dateHeaderScroll: { flex: 1 }, dateHeaderCell: { alignItems: 'center', borderRightColor: SLColors.borderHairline, borderRightWidth: 1, justifyContent: 'center', width: DAY_COLUMN }, dateHeaderToday: { backgroundColor: SLColors.accentSoft }, dateDow: { color: SLColors.textMuted, fontSize: 9, fontWeight: '800' }, dateNumber: { color: SLColors.text, fontSize: 20, fontWeight: '800', marginTop: 2 }, dateTodayText: { color: SLColors.accentViolet }, dayCountDots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 }, miniDot: { borderRadius: 3, height: 4, width: 4 }, matrixRows: { flex: 1 }, weekRowsContent: { paddingBottom: SLLayout.floatingUtilityClearance }, matrixRow: { borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', height: ROW_HEIGHT }, athleteCell: { alignItems: 'center', backgroundColor: SLColors.object, borderRightColor: SLColors.borderStrong, borderRightWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 7, width: ATHLETE_COLUMN }, athleteName: { color: SLColors.text, flex: 1, fontSize: 11, fontWeight: '700', lineHeight: 14 }, rowScroll: { flex: 1 }, dayCell: { alignItems: 'center', borderRightColor: SLColors.borderHairline, borderRightWidth: 1, gap: 3, height: ROW_HEIGHT, justifyContent: 'center', padding: 4, width: DAY_COLUMN }, dayCellToday: { backgroundColor: `${SLColors.accentViolet}08` }, dayCellDragValid: { backgroundColor: `${SLColors.accentViolet}12` }, dayCellDragTarget: { backgroundColor: `${SLColors.accentViolet}26`, borderColor: SLColors.accentViolet, borderWidth: 1 }, sessionChip: { borderLeftWidth: 2, borderRadius: 7, minHeight: 35, width: DAY_COLUMN - 8 }, chipPressable: { flex: 1, justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 3 }, chipTitle: { color: SLColors.text, fontSize: 9, fontWeight: '800' }, chipMeta: { color: SLColors.textMuted, fontSize: 8, marginTop: 1 }, chipStatusDot: { borderRadius: 3, bottom: 4, height: 4, position: 'absolute', right: 4, width: 4 }, customChip: { backgroundColor: SLStatusTones.review.background, borderColor: SLStatusTones.review.border, borderLeftWidth: 2, borderRadius: 7, minHeight: 32, padding: 5, width: DAY_COLUMN - 8 }, meetChip: { backgroundColor: SLStatusTones.danger.background, borderColor: SLStatusTones.danger.border, borderLeftWidth: 2, borderRadius: 7, minHeight: 32, padding: 5, width: DAY_COLUMN - 8 }, moreCount: { color: SLColors.textSubtle, fontSize: 8, fontWeight: '700', position: 'absolute', right: 4, top: 3 }, boardEmpty: { alignItems: 'center', justifyContent: 'center', minHeight: 150, padding: 24 }, emptyTitle: { color: SLColors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  viewScroll: { flex: 1 }, monthContent: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderTopWidth: 1, borderBottomWidth: 1, overflow: 'hidden', paddingBottom: 90 }, monthWeekdays: { flexDirection: 'row', paddingHorizontal: 4, paddingTop: 10 }, monthWeekday: { color: SLColors.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'center', width: `${100 / 7}%` }, monthRow: { flexDirection: 'row', paddingHorizontal: 4 }, monthDay: { alignItems: 'center', height: 54, justifyContent: 'center', width: `${100 / 7}%` }, monthDayToday: { backgroundColor: SLColors.accentSoft, borderRadius: 18 }, monthDaySelected: { borderColor: SLColors.accentViolet, borderRadius: 18, borderWidth: 1 }, monthDate: { color: SLColors.text, fontSize: 15, fontWeight: '700' }, monthDateOutside: { color: SLColors.textSubtle }, monthDots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 3 }, monthDot: { borderRadius: 2, height: 4, width: 4 }, monthAgenda: { borderTopColor: SLColors.borderHairline, borderTopWidth: 1, marginTop: 12 }, monthAgendaEmpty: { paddingHorizontal: 14, paddingBottom: 14 }, sectionTitle: { color: SLColors.text, fontSize: 15, fontWeight: '800' }, sectionMeta: { color: SLColors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  agendaContent: { gap: 16, paddingBottom: 100 }, agendaDay: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, agendaDayHeader: { alignItems: 'center', borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 14 }, agendaDate: { color: SLColors.text, fontSize: 15, fontWeight: '800' }, smallAdd: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 }, agendaRow: { alignItems: 'center', borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 66, paddingHorizontal: 12 }, agendaIcon: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 }, agendaCopy: { flex: 1 }, agendaTitle: { color: SLColors.text, fontSize: 14, fontWeight: '800' }, agendaMeta: { color: SLColors.textMuted, fontSize: 11, marginTop: 3 },
  modalOverlay: { backgroundColor: 'rgba(0,0,0,0.72)', flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: SLColors.object, borderColor: SLColors.borderStrong, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '88%', minHeight: 180, paddingBottom: 26 }, sheetHeader: { alignItems: 'center', borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 15 }, sheetTitle: { color: SLColors.textStrong, fontSize: 20, fontWeight: '800' }, sheetClose: { alignItems: 'center', backgroundColor: SLColors.surfaceEmbedded, borderRadius: 16, height: 42, justifyContent: 'center', width: 42 }, sheetBody: { gap: 12, padding: 18, paddingBottom: 28 }, dayDetailGroup: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderHairline, borderRadius: 14, borderWidth: 1, overflow: 'hidden' }, dayDetailGroupTitle: { color: SLColors.textStrong, fontSize: 14, fontWeight: '800', paddingHorizontal: 13, paddingTop: 12 }, input: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 12, borderWidth: 1, color: SLColors.text, fontSize: 15, minHeight: 48, paddingHorizontal: 13, paddingVertical: 10 }, notesInput: { minHeight: 92 }, fieldLabel: { color: SLColors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 3 }, errorText: { color: SLStatusTones.danger.icon, fontSize: 12 }, linkText: { color: SLColors.accentViolet, fontSize: 12, fontWeight: '700' }, filterSectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, filterAthleteRow: { alignItems: 'center', borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 54 }, filterAthleteName: { color: SLColors.text, flex: 1, fontSize: 14, fontWeight: '700' }, statusLabel: { marginTop: 12 }, filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterChip: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 }, filterChipActive: { backgroundColor: SLColors.accentSoft, borderColor: SLColors.accentViolet }, filterChipText: { color: SLColors.textMuted, fontSize: 12, fontWeight: '700' }, filterChipTextActive: { color: SLColors.accentViolet }, athleteChips: { gap: 7, paddingRight: 12 }, choiceChip: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, maxWidth: 150, paddingHorizontal: 12, paddingVertical: 9 }, choiceChipActive: { backgroundColor: SLColors.accentSoft, borderColor: SLColors.accentViolet }, choiceChipText: { color: SLColors.textMuted, fontSize: 12, fontWeight: '700' }, choiceChipTextActive: { color: SLColors.accentViolet },
  createChoice: { alignItems: 'center', backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 78, padding: 12 }, disabled: { opacity: 0.45 }, createIcon: { alignItems: 'center', backgroundColor: SLColors.accentSoft, borderRadius: 12, height: 48, justifyContent: 'center', width: 48 }, customCreateIcon: { backgroundColor: SLStatusTones.review.background }, createCopy: { flex: 1 }, createTitle: { color: SLColors.text, fontSize: 15, fontWeight: '800' }, createMeta: { color: SLColors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 3 }, detailHero: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, gap: 7, padding: 15 }, detailTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 10 }, detailIcon: { alignItems: 'center', borderRadius: 13, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, detailCopy: { flex: 1 }, detailTitle: { color: SLColors.textStrong, fontSize: 19, fontWeight: '800' }, detailMeta: { color: SLColors.textMuted, fontSize: 12 }, detailDate: { color: SLColors.text, fontSize: 14, fontWeight: '700' }, detailSummary: { color: SLColors.textMuted, fontSize: 13, lineHeight: 18 },
});
