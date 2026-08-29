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
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NewCoachExperience, type NewCoachExperiencePayload } from '@/components/NewCoachExperience';
import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import {
  SL_TAB_ROW_CONTROL,
  SLTabRowControlItem,
  SLTabRowControlShell,
} from '@/components/navigation/sl-tab-row-control';
import { SLAthleteAvatar, SLButton, SLCompactDropdown, SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLLayout, SLSpacing, SLStatusTones, type SLStatusTone } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import { resolveCalendarSessionStatus } from '@/lib/calendar-session-status';
import {
  addCalendarDays,
  calendarRange,
  calendarSessionMatchesStatus,
  calendarSessionNeedsAction,
  calendarStatusLabel,
  coachCalendarDateAtPoint,
  coachCalendarMonthKey,
  coachCalendarMonthWindow,
  coachCalendarRequestRange,
  coachCalendarSessionLabelWindow,
  formatCalendarDate,
  fromLocalYMD,
  isCoachCalendarDropTargetValid,
  isCalendarSessionMovable,
  monthGridRows,
  selectedAthleteLabel,
  startOfCalendarWeek,
  toLocalYMD,
  withCoachCalendarSessionDate,
  type CoachCalendarStatusFilter,
  type CoachCalendarCellRect,
  type CoachCalendarView,
} from '@/lib/coach-calendar';
import { MUSCLE_META, type AnatomyPresentationPreference, type GovernedMuscleId } from '@/lib/anatomy-system';

type CalendarAthlete = {
  id: number;
  name: string;
  avatar_url?: string | null;
  sex?: string | null;
  anatomy_display_preference?: AnatomyPresentationPreference | null;
};
type CalendarMuscleFocusRow = { muscle_id: GovernedMuscleId | string; score: number };
type CalendarMuscleFocus = {
  primary: CalendarMuscleFocusRow[];
  secondary: CalendarMuscleFocusRow[];
  source: 'planned' | 'performed';
  evidence_movement_count?: number;
};
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
  program?: { id: number; name?: string | null; status?: string | null; start?: string | null; end?: string | null } | null;
  week_number?: number | null;
  calendar_access_scope?: 'full' | 'athlete_history' | string | null;
  tags?: string[];
  planned_summary?: string | null;
  movement_count?: number;
  set_count?: number;
  muscle_focus?: CalendarMuscleFocus | null;
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
  today?: string;
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

// Deprecated Week implementation remains temporarily source-compatible while
// old update bundles age out. It is no longer represented by active state,
// navigation, or the visible mode selector.
const DAY_COLUMN = 92;
const WEEK_CARD_HEADER_HEIGHT = 50;
const WEEK_DAY_LANE_HEIGHT = 104;
const WEEK_CARD_HEIGHT = WEEK_CARD_HEADER_HEIGHT + WEEK_DAY_LANE_HEIGHT;
const WEEK_CARD_GAP = 10;
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
const STATUS_FILTERS: Array<{ value: CoachCalendarStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'needs', label: 'Needs' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'draft', label: 'Draft' },
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

function sessionPillMaterial(session: CalendarSession) {
  if (calendarSessionNeedsAction(session)) return SLStatusTones.danger;
  const resolved = resolveCalendarSessionStatus(session.status);
  if (resolved.tone === 'green') return SLStatusTones.success;
  if (resolved.tone === 'gold') return SLStatusTones.warning;
  if (resolved.tone === 'red') return SLStatusTones.danger;
  if (resolved.tone === 'violet') return SLStatusTones.accent;
  return SLStatusTones.neutral;
}

function calendarSessionContext(session: CalendarSession) {
  return [...new Set([
    session.program?.name,
    session.block_name,
    session.week_number ? `Week ${session.week_number}` : null,
  ].filter((value): value is string => Boolean(value)))].join(' · ') || null;
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

function withCalendarSessionDate(
  current: CalendarResponse | null,
  session: CalendarSession,
  destinationDate: string,
) {
  if (!current) return current;
  return {
    ...current,
    days: withCoachCalendarSessionDate(current.days, session, destinationDate),
  };
}

export default function CoachCalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<CoachCalendarView>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toLocalYMD(new Date()));
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CoachCalendarStatusFilter>('all');
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<number[]>([]);
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
  const [monthPageCache, setMonthPageCache] = useState<Record<string, CalendarDay[]>>({});

  const range = useMemo(() => calendarRange(view, anchor), [anchor, view]);
  const requestRange = useMemo(
    () => coachCalendarRequestRange(view, anchor),
    [anchor, view],
  );
  const loadSequence = useRef(0);
  const monthPageCacheRef = useRef<Record<string, CalendarDay[]>>({});
  const athleteFilterHydrated = useRef(false);

  const replaceMonthPageCache = useCallback((next: Record<string, CalendarDay[]>) => {
    monthPageCacheRef.current = next;
    setMonthPageCache(next);
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(CALENDAR_ATHLETE_FILTER_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedAthleteIds(parsed.filter((value): value is number => Number.isInteger(value) && value > 0).slice(0, 1));
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
      if (view === 'month') {
        const key = coachCalendarMonthKey(anchor);
        replaceMonthPageCache({ ...monthPageCacheRef.current, [key]: response.json.days || [] });
      }
    } catch {
      if (sequence === loadSequence.current) setError('Network error. Pull to refresh or try again.');
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [anchor, replaceMonthPageCache, requestRange.end, requestRange.start, view]);

  useFocusEffect(useCallback(() => { void loadCalendar(false); }, [loadCalendar]));

  useEffect(() => {
    if (view !== 'month' || !data) return undefined;
    const controller = new AbortController();
    const months = coachCalendarMonthWindow(anchor);
    const keepKeys = new Set(months.map(coachCalendarMonthKey));
    const missing = months.filter((month) => !monthPageCacheRef.current[coachCalendarMonthKey(month)]);

    const prefetch = async () => {
      const loaded = await Promise.all(missing.map(async (month) => {
        const monthRange = coachCalendarRequestRange('month', month);
        const query = new URLSearchParams({
          start: toLocalYMD(monthRange.start),
          end: toLocalYMD(monthRange.end),
          athlete_id: 'ALL',
          include_completed: '1',
        });
        const response = await fetchJson<CalendarResponse>(`/coach/mobile/calendar?${query}`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!response.ok || !response.json?.ok) return null;
        return [coachCalendarMonthKey(month), response.json.days || []] as const;
      }));
      if (controller.signal.aborted) return;
      const next: Record<string, CalendarDay[]> = {};
      Object.entries(monthPageCacheRef.current).forEach(([key, days]) => {
        if (keepKeys.has(key)) next[key] = days;
      });
      loaded.forEach((entry) => {
        if (entry) next[entry[0]] = entry[1];
      });
      replaceMonthPageCache(next);
    };

    void prefetch().catch(() => undefined);
    return () => controller.abort();
  }, [anchor, data, replaceMonthPageCache, view]);

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
  const filterCalendarDays = useCallback((source: CalendarDay[]) => source.map((day) => ({
    ...day,
    sessions: (day.sessions || []).filter((session) => athleteVisible(session.athlete_id) && calendarSessionMatchesStatus(session, statusFilter)),
    meets: (day.meets || []).filter((meet) => athleteVisible(meet.athlete_id)),
    custom_items: (day.custom_items || []).filter((item) => athleteVisible(item.athlete_id)),
  })), [athleteVisible, statusFilter]);
  const visibleDays = useMemo(() => filterCalendarDays(data?.days || []), [data?.days, filterCalendarDays]);
  const rangeStartKey = toLocalYMD(range.start);
  const rangeEndKey = toLocalYMD(range.end);
  const rangeDays = useMemo(
    () => visibleDays.filter((day) => day.date >= rangeStartKey && day.date < rangeEndKey),
    [rangeEndKey, rangeStartKey, visibleDays],
  );
  const athleteById = useMemo(() => new Map(athletes.map((athlete) => [athlete.id, athlete])), [athletes]);
  const athleteFilterOptions = useMemo(() => [
    { value: 'all', label: 'All Athletes' },
    ...athletes.map((athlete) => ({ value: String(athlete.id), label: athlete.name })),
  ], [athletes]);
  const monthPrefix = coachCalendarMonthKey(anchor);
  const monthPages = useMemo(() => coachCalendarMonthWindow(anchor).map((month) => ({
    anchor: month,
    days: filterCalendarDays(monthPageCache[coachCalendarMonthKey(month)] || []),
  })), [anchor, filterCalendarDays, monthPageCache]);
  const currentMonthPage = monthPages[1]?.days.length ? monthPages[1].days : rangeDays;
  const activeMonthDays = useMemo(
    () => currentMonthPage.filter((day) => day.date.startsWith(monthPrefix)),
    [currentMonthPage, monthPrefix],
  );
  const monthSessions = useMemo(() => activeMonthDays.flatMap((day) => day.sessions), [activeMonthDays]);
  const visibleSessionCount = monthSessions.length;
  const visibleCompletedCount = monthSessions.filter((session) => ['completed', 'logged', 'done'].includes(String(session.status || '').toLowerCase())).length;
  const visibleDraftCount = monthSessions.filter((session) => String(session.status || '').toLowerCase() === 'draft').length;
  const visibleUpcomingCount = monthSessions.filter((session) => ['assigned', 'in_progress'].includes(String(session.status || '').toLowerCase())).length;

  const shiftAnchor = useCallback((direction: number) => {
    if (view === 'month') {
      setAnchor((current) => {
        const next = new Date(current.getFullYear(), current.getMonth() + direction, 1, 12);
        setSelectedDate(toLocalYMD(next));
        return next;
      });
      return;
    }
    setAnchor((current) => {
      const next = addCalendarDays(current, direction * 42);
      setSelectedDate(toLocalYMD(next));
      return next;
    });
  }, [view]);

  const selectCalendarView = useCallback((nextView: CoachCalendarView) => {
    const selected = fromLocalYMD(selectedDate);
    if (!Number.isNaN(selected.getTime())) {
      setAnchor(nextView === 'month'
        ? new Date(selected.getFullYear(), selected.getMonth(), 1, 12)
        : selected);
    }
    setView(nextView);
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(toLocalYMD(today));
    setAnchor(view === 'month' ? new Date(today.getFullYear(), today.getMonth(), 1, 12) : today);
  }, [view]);

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
    if (date === session.date) {
      setMovePickerOpen(false);
      return;
    }
    const today = data?.today || toLocalYMD(new Date());
    if (!isCoachCalendarDropTargetValid({
      session,
      destinationDate: date,
      today,
      targetAthleteId: session.athlete_id,
    })) {
      Alert.alert('Date unavailable', 'Choose today or a future date for a Session that can be moved.');
      return;
    }
    setMoving(true);
    setData((current) => withCalendarSessionDate(current, session, date));
    try {
      const response = await fetchJson<{ ok: boolean; error?: string; session?: CalendarSession; noop?: boolean }>(`/coach/mobile/workouts/${session.workout_id}/move`, {
        method: 'POST', body: JSON.stringify({ date }),
      });
      if (!response.ok || !response.json?.ok) {
        setData((current) => withCalendarSessionDate(current, session, session.date));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Move failed', response.json?.error || 'The Session remains on its original date.');
        return;
      }
      const canonicalSession = response.json.session || { ...session, date };
      setData((current) => withCalendarSessionDate(current, canonicalSession, canonicalSession.date));
      setSelectedSession(null);
      setMovePickerOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setData((current) => withCalendarSessionDate(current, session, session.date));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Move failed', 'The Session remains on its original date.');
    } finally {
      setMoving(false);
    }
  }, [data?.today]);

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

  const rangeLabel = view === 'month'
    ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : `${formatCalendarDate(toLocalYMD(range.start), { month: 'short', day: 'numeric' })} – ${formatCalendarDate(toLocalYMD(addCalendarDays(range.end, -1)), { month: 'short', day: 'numeric' })}`;
  const athleteSelectorLabel = selectedAthleteLabel(athletes, selectedAthleteIds);
  const statusSelectorLabel = statusFilter === 'all'
    ? 'All Statuses'
    : STATUS_FILTERS.find((filter) => filter.value === statusFilter)?.label || 'All Statuses';

  return (
    <SLScreen edges="none" padded={false}>
      <View style={styles.screen}>
        <View style={styles.compactHeader}>
          <View style={styles.headerIdentityRow}>
            <Text typographyRole="pageTitle" style={styles.title}>Calendar</Text>
            <SLCompactDropdown
              accessibilityHint="Selects which Session statuses appear immediately"
              accessibilityLabel={`Calendar status filter, ${statusSelectorLabel}`}
              label={statusSelectorLabel}
              menuTestID="coach-calendar-status-menu"
              minMenuWidth={196}
              onValueChange={setStatusFilter}
              options={STATUS_FILTERS}
              style={styles.statusSelector}
              testID="coach-calendar-status-selector"
              value={statusFilter}
            />
          </View>

          <View style={styles.headerControlRow}>
            <SLCompactDropdown
              accessibilityHint="Selects which athlete appears immediately"
              accessibilityLabel={`Calendar athlete selector, ${athleteSelectorLabel}`}
              icon="people-outline"
              label={athleteSelectorLabel}
              menuTestID="coach-calendar-athlete-menu"
              minMenuWidth={240}
              onValueChange={(value) => setSelectedAthleteIds(value === 'all' ? [] : [Number(value)])}
              options={athleteFilterOptions}
              style={styles.athleteSelector}
              testID="coach-calendar-athlete-selector"
              value={selectedAthleteIds[0] ? String(selectedAthleteIds[0]) : 'all'}
            />

            <View accessibilityLabel="Calendar view" style={styles.compactSegmentedControl}>
              {(['month', 'agenda'] as CoachCalendarView[]).map((mode) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: view === mode }}
                  key={mode}
                  onPress={() => selectCalendarView(mode)}
                  style={[styles.compactSegment, view === mode && styles.segmentActive]}
                  testID={`coach-calendar-view-${mode}`}
                >
                  <Text numberOfLines={1} style={[styles.segmentText, view === mode && styles.segmentTextActive]}>
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {data?.new_coach_experience ? <NewCoachExperience experience={data.new_coach_experience} /> : null}

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

        {!error && view === 'month' ? (
          <MonthBoard
            anchor={anchor}
            athleteById={athleteById}
            days={currentMonthPage}
            key={toLocalYMD(range.start)}
            monthPages={monthPages}
            monthSummary={{
              completed: visibleCompletedCount,
              draft: visibleDraftCount,
              sessions: visibleSessionCount,
              upcoming: visibleUpcomingCount,
            }}
            moving={moving}
            onAdd={(day) => { setItemDraft(emptyDraft(day.date)); setCreateOpen(true); }}
            onCustomPress={setSelectedCustomItem}
            onMeetPress={(meet) => router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(meet.athlete_id), athleteName: meet.athlete_name } } as any)}
            onMonthPage={shiftAnchor}
            onMove={moveSession}
            onRefresh={() => loadCalendar(true)}
            onSelectDate={setSelectedDate}
            onSessionPress={setSelectedSession}
            reduceMotion={reduceMotion}
            refreshing={refreshing}
            selectedDate={selectedDate}
            singleAthleteMode={selectedAthleteIds.length === 1}
            today={data?.today || toLocalYMD(new Date())}
          />
        ) : null}
        {!error && view === 'agenda' ? (
          <AgendaBoard athleteById={athleteById} days={rangeDays} onCustomPress={setSelectedCustomItem} onDayAdd={(day) => { setItemDraft(emptyDraft(day.date)); setCreateOpen(true); }} onMeetPress={(meet) => router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(meet.athlete_id), athleteName: meet.athlete_name } } as any)} onRefresh={() => loadCalendar(true)} onSelectDate={setSelectedDate} onSessionPress={setSelectedSession} refreshing={refreshing} selectedDate={selectedDate} today={data?.today || toLocalYMD(new Date())} />
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

type WeekDragState = { athleteId: number; session: CalendarSession; targetDate: string } | null;
type WeekCellItems = { sessions: CalendarSession[]; customItems: CalendarCustomItem[]; meets: CalendarMeet[] };
type WeekVisibleItem =
  | { kind: 'session'; value: CalendarSession }
  | { kind: 'custom'; value: CalendarCustomItem }
  | { kind: 'meet'; value: CalendarMeet };

const WeekAthleteCard = React.memo(function WeekAthleteCard({ athlete, days, cellIndex, dragState, moving, reduceMotion, today, weekStart, onHorizontalScroll, onHorizontalSettled, onRegisterCard, onSessionPress, onItemPress, onMove, onCreate, onDayPress, onDragState }: {
  athlete: CalendarAthlete;
  days: CalendarDay[];
  cellIndex: Map<string, WeekCellItems>;
  dragState: WeekDragState;
  moving: boolean;
  reduceMotion: boolean;
  today: string;
  weekStart: string;
  onHorizontalScroll: (athleteId: number, x: number) => void;
  onHorizontalSettled: (x: number) => void;
  onRegisterCard: (athleteId: number, ref: ScrollView | null) => void;
  onSessionPress: (session: CalendarSession) => void;
  onItemPress: (item: CalendarCustomItem) => void;
  onMove: (session: CalendarSession, date: string) => void;
  onCreate: (date: string, athlete: CalendarAthlete) => void;
  onDayPress: (day: CalendarDay) => void;
  onDragState: (state: WeekDragState) => void;
}) {
  const sameAthleteDrag = dragState?.athleteId === athlete.id;
  const weekEnd = toLocalYMD(addCalendarDays(fromLocalYMD(weekStart), 7));
  const currentWeekItems = days
    .filter((day) => day.date >= weekStart && day.date < weekEnd)
    .map((day) => cellIndex.get(`${athlete.id}:${day.date}`) || { sessions: [], customItems: [], meets: [] });
  const currentWeekSessions = currentWeekItems.flatMap((items) => items.sessions);
  const currentWeekItemCount = currentWeekItems.reduce(
    (total, items) => total + items.sessions.length + items.customItems.length + items.meets.length,
    0,
  );
  const completedCount = currentWeekSessions.filter((session) => statusTone(session.status) === 'success').length;
  const weekComplete = currentWeekSessions.length > 0 && completedCount === currentWeekSessions.length;
  const trainingContext = currentWeekSessions.find((session) => session.block_name)?.block_name || 'Weekly schedule';
  const contextLabel = currentWeekItemCount
    ? `${trainingContext} · ${currentWeekItemCount} item${currentWeekItemCount === 1 ? '' : 's'}`
    : 'No Sessions this week';

  return (
    <View
      accessibilityElementsHidden={!!dragState && !sameAthleteDrag}
      style={[
        styles.athleteWeekCard,
        !!dragState && !sameAthleteDrag && styles.athleteWeekCardInactive,
        sameAthleteDrag && styles.athleteWeekCardActive,
      ]}
    >
      <View style={styles.athleteCardHeader}>
        <SLAthleteAvatar imageUrl={athlete.avatar_url} name={athlete.name} size={34} />
        <View style={styles.athleteCardCopy}>
          <Text numberOfLines={1} style={styles.athleteName}>{athlete.name}</Text>
          <Text numberOfLines={1} style={styles.athleteContext}>{contextLabel}</Text>
        </View>
        {currentWeekSessions.length ? (
          <View style={[styles.athleteCompletionPill, !weekComplete && styles.athleteCompletionPillPending]}>
            <Text style={[styles.athleteCompletionText, !weekComplete && styles.athleteCompletionTextPending]}>{completedCount}/{currentWeekSessions.length}</Text>
          </View>
        ) : null}
      </View>
      <ScrollView
        directionalLockEnabled
        horizontal
        onMomentumScrollEnd={(event) => onHorizontalSettled(event.nativeEvent.contentOffset.x)}
        onScroll={(event) => onHorizontalScroll(athlete.id, event.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(event) => onHorizontalSettled(event.nativeEvent.contentOffset.x)}
        ref={(ref) => onRegisterCard(athlete.id, ref)}
        scrollEnabled={!dragState}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.athleteWeekLane}
      >
        {days.map((day, dayIndex) => {
          const items = cellIndex.get(`${athlete.id}:${day.date}`) || { sessions: [], customItems: [], meets: [] };
          const itemCount = items.sessions.length + items.customItems.length + items.meets.length;
          const validDropTarget = !!dragState && sameAthleteDrag && isCoachCalendarDropTargetValid({
            session: dragState.session,
            destinationDate: day.date,
            today,
            targetAthleteId: athlete.id,
          });
          // Week rows are intentionally compact: render at most two items in a
          // cell and summarize the remainder instead of overflowing the row.
          const visibleItems: WeekVisibleItem[] = [
            ...items.sessions.map((value): WeekVisibleItem => ({ kind: 'session', value })),
            ...items.customItems.map((value): WeekVisibleItem => ({ kind: 'custom', value })),
            ...items.meets.map((value): WeekVisibleItem => ({ kind: 'meet', value })),
          ].slice(0, 2);
          return (
            <View
              key={day.date}
              style={[
                styles.dayCell,
                day.is_today && styles.dayCellToday,
                sameAthleteDrag && !validDropTarget && styles.dayCellDragInvalid,
                validDropTarget && styles.dayCellDragValid,
                validDropTarget && dragState?.targetDate === day.date && styles.dayCellDragTarget,
              ]}
            >
              <Pressable
                accessibilityLabel={`${athlete.name}, ${formatCalendarDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}${itemCount ? `, ${itemCount} items` : ', empty'}`}
                disabled={!!dragState}
                onPress={() => onDayPress(day)}
                style={styles.dayCellHeader}
              >
                <Text style={[styles.dateDow, day.is_today && styles.dateTodayText]}>{formatCalendarDate(day.date, { weekday: 'short' }).slice(0, 2).toUpperCase()}</Text>
                <Text style={[styles.dateNumber, day.is_today && styles.dateTodayText]}>{fromLocalYMD(day.date).getDate()}</Text>
                <View style={styles.dayCountDots}>
                  {!!items.sessions.length && <View style={[styles.miniDot, { backgroundColor: SLStatusTones.success.icon }]} />}
                  {!!items.customItems.length && <View style={[styles.miniDot, { backgroundColor: SLStatusTones.review.icon }]} />}
                  {!!items.meets.length && <View style={[styles.miniDot, { backgroundColor: SLStatusTones.danger.icon }]} />}
                </View>
              </Pressable>
              <View style={styles.dayCellItems}>
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
                        today={today}
                      />
                    );
                  }
                  if (item.kind === 'custom') {
                    return <CustomChip item={item.value} key={`custom-${item.value.id}`} onPress={onItemPress} />;
                  }
                  return <MeetChip key={`meet-${item.value.meet_plan_id}`} meet={item.value} />;
                })}
                {itemCount === 0 ? (
                  <Pressable
                    accessibilityLabel={`Schedule ${athlete.name} on ${formatCalendarDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                    disabled={!!dragState}
                    hitSlop={6}
                    onPress={() => onCreate(day.date, athlete)}
                    style={styles.emptyDayAction}
                  >
                    <Ionicons color={SLColors.textSubtle} name="add" size={15} />
                  </Pressable>
                ) : null}
                {itemCount > 2 ? <Text style={styles.moreCount}>+{itemCount - 2}</Text> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

function WeekBoard({ athletes, days, refreshing, moving, reduceMotion, scrollTarget, timelineViewportWidth, today, weekStart, onRefresh, onSessionPress, onItemPress, onMove, onCreate, onDayPress, onVisibleWeekSettled }: {
  athletes: CalendarAthlete[];
  days: CalendarDay[];
  refreshing: boolean;
  moving: boolean;
  reduceMotion: boolean;
  scrollTarget: { date: string; token: number };
  timelineViewportWidth: number;
  today: string;
  weekStart: string;
  onRefresh: () => void;
  onSessionPress: (session: CalendarSession) => void;
  onItemPress: (item: CalendarCustomItem) => void;
  onMove: (session: CalendarSession, date: string) => void;
  onCreate: (date: string, athlete: CalendarAthlete) => void;
  onDayPress: (day: CalendarDay) => void;
  onVisibleWeekSettled: (date: string) => void;
}) {
  const cardRefs = useRef(new Map<number, ScrollView>());
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
    cardRefs.current.forEach((ref) => ref.scrollTo({ x: nextX, animated }));
    rememberCenter(nextX);
    requestAnimationFrame(() => { syncing.current = false; });
  }, [clampX, rememberCenter]);
  const syncX = useCallback((x: number, source: string) => {
    if (syncing.current) return;
    const nextX = clampX(x);
    currentX.current = nextX;
    rememberCenter(nextX);
    syncing.current = true;
    cardRefs.current.forEach((ref, id) => { if (source !== String(id)) ref.scrollTo({ x: nextX, animated: false }); });
    requestAnimationFrame(() => { syncing.current = false; });
  }, [clampX, rememberCenter]);
  const onHorizontalScroll = useCallback((athleteId: number, x: number) => syncX(x, String(athleteId)), [syncX]);
  const settleVisibleWeek = useCallback((x: number) => {
    rememberCenter(x);
    const date = preservedCenterDate.current;
    if (!date || date === lastSettledDate.current) return;
    lastSettledDate.current = date;
    onVisibleWeekSettled(date);
  }, [onVisibleWeekSettled, rememberCenter]);
  const onRegisterCard = useCallback((athleteId: number, ref: ScrollView | null) => {
    if (!ref) {
      cardRefs.current.delete(athleteId);
      return;
    }
    cardRefs.current.set(athleteId, ref);
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

  if (!athletes.length) return <View style={styles.boardEmpty}><Text style={styles.emptyTitle}>No athletes match these filters</Text></View>;

  return (
    <View style={styles.weekBoard}>
      <FlatList
        data={athletes}
        extraData={dragState}
        getItemLayout={(_, index) => ({ index, length: WEEK_CARD_HEIGHT + WEEK_CARD_GAP, offset: (WEEK_CARD_HEIGHT + WEEK_CARD_GAP) * index })}
        initialNumToRender={6}
        keyExtractor={(athlete) => String(athlete.id)}
        maxToRenderPerBatch={6}
        refreshControl={<RefreshControl enabled={!dragState} refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentViolet} />}
        removeClippedSubviews={Platform.OS !== 'web'}
        renderItem={({ item: athlete }) => (
          <WeekAthleteCard
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
            onRegisterCard={onRegisterCard}
            onSessionPress={onSessionPress}
            onDayPress={onDayPress}
            reduceMotion={reduceMotion}
            today={today}
            weekStart={weekStart}
          />
        )}
        scrollEnabled={!dragState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.weekRowsContent}
        style={styles.weekCardList}
        windowSize={5}
      />
    </View>
  );
}

function DraggableSessionChip({ session, dayIndex, days, moving, reduceMotion, today, onDragState, onMove, onPress }: {
  session: CalendarSession; dayIndex: number; days: CalendarDay[]; moving: boolean;
  reduceMotion: boolean; today: string;
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
      onDragState({ athleteId: session.athlete_id, session, targetDate: days[dayIndex]?.date || session.date });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      const targetIndex = Math.max(0, Math.min(days.length - 1, dayIndex + Math.round(event.translationX / DAY_COLUMN)));
      if (targetIndex !== lastTargetIndex.current) {
        lastTargetIndex.current = targetIndex;
        onDragState({ athleteId: session.athlete_id, session, targetDate: days[targetIndex]?.date || session.date });
        void Haptics.selectionAsync();
      }
    })
    .onEnd((event) => {
      const targetIndex = Math.max(0, Math.min(days.length - 1, dayIndex + Math.round(event.translationX / DAY_COLUMN)));
      const target = days[targetIndex];
      if (target && isCoachCalendarDropTargetValid({
        session,
        destinationDate: target.date,
        today,
        targetAthleteId: session.athlete_id,
      })) {
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
  const animatedStyle = useAnimatedStyle(() => ({
    elevation: scale.value > 1 ? 14 : 0,
    shadowOpacity: scale.value > 1 ? 0.48 : 0,
    transform: [{ translateX: x.value }, { scale: scale.value }],
    zIndex: scale.value > 1 ? 20 : 1,
  }));
  const color = statusColor(session.status);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.sessionChip, { borderColor: color, backgroundColor: `${color}18` }, animatedStyle]}>
        <Pressable accessibilityHint={movable ? 'Long press and drag left or right to change the date.' : undefined} accessibilityLabel={`${session.athlete_name}, ${session.label}, ${formatCalendarDate(session.date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${calendarStatusLabel(session.status)}`} accessibilityRole="button" disabled={moving} onPress={(event) => { event.stopPropagation(); onPress(session); }} style={styles.chipPressable}>
          <Text numberOfLines={1} style={styles.chipTitle}>{session.label}</Text>
          <Text numberOfLines={1} style={styles.chipMeta}>{calendarSessionContext(session) || calendarStatusLabel(session.status)}</Text>
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

type MonthDragState = { session: CalendarSession; targetDate: string | null } | null;

function MonthBoard({ anchor, athleteById, days, monthPages, monthSummary, refreshing, moving, reduceMotion, selectedDate, singleAthleteMode, today, onRefresh, onSelectDate, onSessionPress, onCustomPress, onMeetPress, onAdd, onMonthPage, onMove }: {
  anchor: Date;
  athleteById: ReadonlyMap<number, CalendarAthlete>;
  days: CalendarDay[];
  monthPages: Array<{ anchor: Date; days: CalendarDay[] }>;
  monthSummary: { sessions: number; completed: number; upcoming: number; draft: number };
  refreshing: boolean;
  moving: boolean;
  reduceMotion: boolean;
  selectedDate: string;
  singleAthleteMode: boolean;
  today: string;
  onRefresh: () => void;
  onSelectDate: (date: string) => void;
  onSessionPress: (session: CalendarSession) => void;
  onCustomPress: (item: CalendarCustomItem) => void;
  onMeetPress: (meet: CalendarMeet) => void;
  onAdd: (day: CalendarDay) => void;
  onMonthPage: (direction: number) => void;
  onMove: (session: CalendarSession, date: string) => void;
}) {
  const rootRef = useRef<View | null>(null);
  const cellRefs = useRef(new Map<string, View>());
  const cellRects = useRef(new Map<string, CoachCalendarCellRect>());
  const rootOrigin = useRef({ x: 0, y: 0 });
  const latestPoint = useRef({ x: 0, y: 0 });
  const dragStateRef = useRef<MonthDragState>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const pagerX = useSharedValue(0);
  const [dragState, setDragState] = useState<MonthDragState>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const selectedDay = days.find((day) => day.date === selectedDate)
    || days.find((day) => fromLocalYMD(day.date).getMonth() === anchor.getMonth() && allDayItems(day).length)
    || days.find((day) => fromLocalYMD(day.date).getMonth() === anchor.getMonth())
    || days[0];

  const updateDropTarget = useCallback((absoluteX: number, absoluteY: number) => {
    const active = dragStateRef.current;
    if (!active) return;
    const hoveredDate = coachCalendarDateAtPoint(absoluteX, absoluteY, cellRects.current);
    const hoveredDay = hoveredDate ? days.find((day) => day.date === hoveredDate) : null;
    const targetDate = hoveredDay && isCoachCalendarDropTargetValid({
      session: active.session,
      destinationDate: hoveredDay.date,
      today,
      targetAthleteId: active.session.athlete_id,
    }) ? hoveredDay.date : null;
    if (active.targetDate === targetDate) return;
    const next = { ...active, targetDate };
    dragStateRef.current = next;
    setDragState(next);
    if (targetDate) void Haptics.selectionAsync();
  }, [days, today]);

  const refreshMonthGeometry = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOrigin.current = { x, y };
      dragX.value = latestPoint.current.x - x;
      dragY.value = latestPoint.current.y - y;
    });
    const entries = Array.from(cellRefs.current.entries());
    if (!entries.length) return;
    const measured = new Map<string, CoachCalendarCellRect>();
    let remaining = entries.length;
    entries.forEach(([date, ref]) => {
      ref.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) measured.set(date, { x, y, width, height });
        remaining -= 1;
        if (remaining === 0) {
          cellRects.current = measured;
          updateDropTarget(latestPoint.current.x, latestPoint.current.y);
        }
      });
    });
  }, [dragX, dragY, updateDropTarget]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(refreshMonthGeometry);
    return () => cancelAnimationFrame(frame);
  }, [days, refreshMonthGeometry]);

  const updateDragPoint = useCallback((absoluteX: number, absoluteY: number) => {
    latestPoint.current = { x: absoluteX, y: absoluteY };
    dragX.value = absoluteX - rootOrigin.current.x;
    dragY.value = absoluteY - rootOrigin.current.y;
    updateDropTarget(absoluteX, absoluteY);
  }, [dragX, dragY, updateDropTarget]);

  const startMonthDrag = useCallback((session: CalendarSession, absoluteX: number, absoluteY: number) => {
    latestPoint.current = { x: absoluteX, y: absoluteY };
    const next: MonthDragState = { session, targetDate: null };
    dragStateRef.current = next;
    setDragState(next);
    dragScale.value = reduceMotion ? 1 : withSpring(1.03);
    updateDragPoint(absoluteX, absoluteY);
    refreshMonthGeometry();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dragScale, reduceMotion, refreshMonthGeometry, updateDragPoint]);

  const clearMonthDrag = useCallback(() => {
    dragStateRef.current = null;
    setDragState(null);
    dragScale.value = reduceMotion ? 1 : withSpring(1);
  }, [dragScale, reduceMotion]);

  const finishMonthDrag = useCallback((session: CalendarSession) => {
    const targetDate = dragStateRef.current?.targetDate || null;
    clearMonthDrag();
    if (targetDate) onMove(session, targetDate);
  }, [clearMonthDrag, onMove]);

  const ghostStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - 108 },
      { translateY: dragY.value - 30 },
      { scale: dragScale.value },
    ],
  }));
  const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pagerX.value }] }));

  useEffect(() => {
    if (pageWidth > 0) pagerX.value = -pageWidth;
  }, [anchor, pageWidth, pagerX]);

  const monthPagingGesture = useMemo(() => Gesture.Pan()
    .enabled(!dragState && pageWidth > 0)
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      pagerX.value = -pageWidth + Math.max(-pageWidth, Math.min(pageWidth, event.translationX));
    })
    .onEnd((event) => {
      const direction = event.translationX < -pageWidth * 0.2 || event.velocityX < -520
        ? 1
        : event.translationX > pageWidth * 0.2 || event.velocityX > 520
          ? -1
          : 0;
      const destination = direction === 1 ? -pageWidth * 2 : direction === -1 ? 0 : -pageWidth;
      pagerX.value = withTiming(destination, { duration: reduceMotion ? 1 : 240 }, (finished) => {
        if (finished && direction) runOnJS(onMonthPage)(direction);
      });
    })
    .onFinalize((_event, success) => {
      if (!success) pagerX.value = withTiming(-pageWidth, { duration: reduceMotion ? 1 : 180 });
    }), [dragState, onMonthPage, pageWidth, pagerX, reduceMotion]);

  return (
    <View onLayout={() => requestAnimationFrame(refreshMonthGeometry)} ref={rootRef} style={styles.monthBoardRoot}>
    <ScrollView refreshControl={<RefreshControl enabled={!dragState} refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentViolet} />} scrollEnabled={!dragState} style={styles.viewScroll} contentContainerStyle={styles.monthContent}>
      <GestureDetector gesture={monthPagingGesture}>
        <View
          onLayout={({ nativeEvent }) => setPageWidth(nativeEvent.layout.width)}
          style={styles.monthPagerViewport}
          testID="coach-calendar-month-pager"
        >
          <Animated.View style={[styles.monthPagerTrack, pageWidth ? { width: pageWidth * 3 } : null, pagerStyle]}>
            {monthPages.map((page, pageIndex) => {
              const isCurrent = pageIndex === 1;
              return (
                <View
                  key={coachCalendarMonthKey(page.anchor)}
                  pointerEvents={isCurrent ? 'auto' : 'none'}
                  style={[styles.monthPagerPage, pageWidth ? { width: pageWidth } : null]}
                >
                  <MonthGridPage
                    anchor={page.anchor}
                    cellRefs={isCurrent ? cellRefs : undefined}
                    days={page.days}
                    dragState={isCurrent ? dragState : null}
                    monthSummary={isCurrent ? monthSummary : summarizeMonth(page.anchor, page.days)}
                    onSelectDate={onSelectDate}
                    selectedDate={selectedDate}
                    singleAthleteMode={singleAthleteMode}
                    today={today}
                  />
                </View>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>
      {selectedDay ? <View style={styles.monthAgenda}>
        <View style={styles.agendaDayHeader}>
          <View><Text style={styles.sectionTitle}>{formatCalendarDate(selectedDay.date, { weekday: 'long', month: 'short', day: 'numeric' })}</Text><Text style={styles.sectionMeta}>{allDayItems(selectedDay).length} item{allDayItems(selectedDay).length === 1 ? '' : 's'}</Text></View>
          <Pressable accessibilityLabel={`Add to ${selectedDay.date}`} onPress={() => onAdd(selectedDay)} style={styles.smallAdd}><Ionicons color={SLColors.accentViolet} name="add" size={20} /></Pressable>
        </View>
        {!allDayItems(selectedDay).length ? <View style={styles.monthAgendaEmpty}><Text style={styles.sectionMeta}>Nothing scheduled for this date.</Text></View> : null}
        {orderedDayItems(selectedDay).map((entry) => entry.kind === 'session' ? (
          <MonthDraggableSessionRow
            athlete={athleteById.get(entry.item.athlete_id)}
            key={`session-${entry.item.workout_id}`}
            moving={moving}
            onCancel={clearMonthDrag}
            onDrag={updateDragPoint}
            onDrop={finishMonthDrag}
            onPress={onSessionPress}
            onStart={startMonthDrag}
            reduceMotion={reduceMotion}
            session={entry.item}
          />
        ) : (
          <CalendarAgendaRow entry={entry} key={`${entry.kind}-${entry.kind === 'meet' ? entry.item.meet_plan_id : entry.item.id}`} onCustomPress={onCustomPress} onMeetPress={onMeetPress} onSessionPress={onSessionPress} />
        ))}
      </View> : null}
    </ScrollView>
    {dragState ? (
      <Animated.View pointerEvents="none" style={[styles.monthDragPreview, ghostStyle]}>
        <View style={[styles.monthDragPreviewIcon, { borderColor: statusColor(dragState.session.status) }]}>
          <Ionicons color={statusColor(dragState.session.status)} name="barbell-outline" size={18} />
        </View>
        <View style={styles.monthDragPreviewCopy}>
          <Text numberOfLines={1} style={styles.monthDragPreviewTitle}>{dragState.session.label}</Text>
          <Text numberOfLines={1} style={styles.monthDragPreviewMeta}>{dragState.session.athlete_name}</Text>
        </View>
      </Animated.View>
    ) : null}
    </View>
  );
}

function completeMonthPageDays(anchor: Date, days: CalendarDay[]) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const pageRange = calendarRange('month', anchor);
  return Array.from({ length: 42 }, (_, index) => {
    const date = toLocalYMD(addCalendarDays(pageRange.start, index));
    return byDate.get(date) || {
      date,
      is_today: false,
      counts: {},
      sessions: [],
      meets: [],
      custom_items: [],
    };
  });
}

function summarizeMonth(anchor: Date, days: CalendarDay[]) {
  const prefix = coachCalendarMonthKey(anchor);
  const sessions = days.filter((day) => day.date.startsWith(prefix)).flatMap((day) => day.sessions);
  return {
    sessions: sessions.length,
    completed: sessions.filter((session) => ['completed', 'logged', 'done'].includes(String(session.status || '').toLowerCase())).length,
    upcoming: sessions.filter((session) => ['assigned', 'in_progress'].includes(String(session.status || '').toLowerCase())).length,
    draft: sessions.filter((session) => String(session.status || '').toLowerCase() === 'draft').length,
  };
}

function MonthGridPage({ anchor, cellRefs, days, dragState, monthSummary, onSelectDate, selectedDate, singleAthleteMode, today }: {
  anchor: Date;
  cellRefs?: React.MutableRefObject<Map<string, View>>;
  days: CalendarDay[];
  dragState: MonthDragState;
  monthSummary: { sessions: number; completed: number; upcoming: number; draft: number };
  onSelectDate: (date: string) => void;
  selectedDate: string;
  singleAthleteMode: boolean;
  today: string;
}) {
  const rows = monthGridRows(completeMonthPageDays(anchor, days));
  return (
    <View style={styles.monthGridCard}>
      <View style={styles.monthSummaryStrip}>
        <MonthSummaryValue color={SLStatusTones.success.icon} icon="calendar-outline" label="Sessions" value={monthSummary.sessions} />
        <MonthSummaryValue color={SLStatusTones.success.icon} icon="checkmark-circle" label="Completed" value={monthSummary.completed} />
        <MonthSummaryValue color={SLColors.accentViolet} icon="time-outline" label="Upcoming" value={monthSummary.upcoming} />
        <MonthSummaryValue color={SLStatusTones.neutral.icon} icon="ellipse-outline" label="Draft" value={monthSummary.draft} />
      </View>
      <View style={styles.monthWeekdays}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.monthWeekday}>{day}</Text>)}</View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.monthRow}>
          {row.map((day) => {
            const inMonth = fromLocalYMD(day.date).getMonth() === anchor.getMonth();
            const count = day.sessions.length + day.custom_items.length + day.meets.length;
            const isToday = day.is_today || day.date === today;
            const sessionLabels = coachCalendarSessionLabelWindow(day.sessions, singleAthleteMode);
            const validDropTarget = !!dragState && isCoachCalendarDropTargetValid({
              session: dragState.session,
              destinationDate: day.date,
              today,
              targetAthleteId: dragState.session.athlete_id,
            });
            const sessionNames = day.sessions.map((session) => session.label).filter(Boolean).join(', ');
            return (
              <Pressable
                accessibilityLabel={`${formatCalendarDate(day.date)}, ${count} items${sessionNames ? `, ${sessionNames}` : ''}`}
                accessibilityState={{ disabled: !!dragState && !validDropTarget, selected: day.date === selectedDate }}
                disabled={!!dragState}
                key={day.date}
                onPress={() => onSelectDate(day.date)}
                ref={(ref) => {
                  if (!cellRefs) return;
                  if (ref) cellRefs.current.set(day.date, ref);
                  else cellRefs.current.delete(day.date);
                }}
                style={[
                  styles.monthDay,
                  singleAthleteMode && styles.monthDaySingleAthlete,
                  isToday && styles.monthDayToday,
                  day.date === selectedDate && styles.monthDaySelected,
                  dragState && !validDropTarget && styles.monthDayDragInvalid,
                  validDropTarget && styles.monthDayDragValid,
                  dragState?.targetDate === day.date && styles.monthDayDragTarget,
                ]}
              >
                <Text style={[styles.monthDate, !inMonth && styles.monthDateOutside, (isToday || day.date === selectedDate) && styles.dateTodayText]}>{fromLocalYMD(day.date).getDate()}</Text>
                {singleAthleteMode ? (
                  <View style={styles.monthSessionLabels}>
                    {sessionLabels.visible.map((session) => {
                      const material = sessionPillMaterial(session);
                      return (
                        <View key={session.workout_id} style={[styles.monthSessionPill, { backgroundColor: material.background, borderColor: material.border }]}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.monthSessionPillText, { color: material.text }]}>{session.label}</Text>
                        </View>
                      );
                    })}
                    {sessionLabels.overflow ? <Text numberOfLines={1} style={styles.monthSessionOverflow}>+{sessionLabels.overflow}</Text> : null}
                    {!sessionLabels.visible.length && (day.custom_items.length || day.meets.length) ? (
                      <View style={styles.monthDots}>
                        {!!day.custom_items.length && <View style={[styles.monthDot, { backgroundColor: SLStatusTones.review.icon }]} />}
                        {!!day.meets.length && <View style={[styles.monthDot, { backgroundColor: SLStatusTones.danger.icon }]} />}
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.monthDots}>
                    {day.sessions.slice(0, 3).map((session) => <View key={session.workout_id} style={[styles.monthDot, { backgroundColor: statusColor(session.status) }]} />)}
                    {!!day.custom_items.length && <View style={[styles.monthDot, { backgroundColor: SLStatusTones.review.icon }]} />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function MonthSummaryValue({ color, icon, label, value }: { color: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <View style={styles.monthSummaryValue}>
      <Ionicons color={color} name={icon} size={16} />
      <View>
        <Text style={styles.monthSummaryNumber}>{value}</Text>
        <Text style={styles.monthSummaryLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MonthDraggableSessionRow({ athlete, session, moving, reduceMotion, onStart, onDrag, onDrop, onCancel, onPress }: {
  athlete?: CalendarAthlete;
  session: CalendarSession;
  moving: boolean;
  reduceMotion: boolean;
  onStart: (session: CalendarSession, absoluteX: number, absoluteY: number) => void;
  onDrag: (absoluteX: number, absoluteY: number) => void;
  onDrop: (session: CalendarSession) => void;
  onCancel: () => void;
  onPress: (session: CalendarSession) => void;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const movable = isCalendarSessionMovable(session) && !moving;
  const gesture = Gesture.Pan()
    .enabled(movable)
    .activateAfterLongPress(320)
    .minDistance(3)
    .runOnJS(true)
    .onStart((event) => {
      scale.value = reduceMotion ? 1 : withSpring(1.02);
      opacity.value = 0.34;
      onStart(session, event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => onDrag(event.absoluteX, event.absoluteY))
    .onEnd(() => onDrop(session))
    .onFinalize((_event, success) => {
      scale.value = reduceMotion ? 1 : withSpring(1);
      opacity.value = 1;
      if (!success) onCancel();
    });
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <CalendarSessionCard
          accessibilityHint={movable ? 'Long press, then drag onto an available Calendar day to reschedule.' : undefined}
          athlete={athlete}
          compact
          onPress={() => onPress(session)}
          onOverflow={() => onPress(session)}
          session={session}
        />
      </Animated.View>
    </GestureDetector>
  );
}

function AgendaBoard({ athleteById, days, refreshing, selectedDate, today, onRefresh, onSelectDate, onSessionPress, onCustomPress, onMeetPress, onDayAdd }: {
  athleteById: ReadonlyMap<number, CalendarAthlete>;
  days: CalendarDay[];
  refreshing: boolean;
  selectedDate: string;
  today: string;
  onRefresh: () => void;
  onSelectDate: (date: string) => void;
  onSessionPress: (session: CalendarSession) => void;
  onCustomPress: (item: CalendarCustomItem) => void;
  onMeetPress: (meet: CalendarMeet) => void;
  onDayAdd: (day: CalendarDay) => void;
}) {
  const populated = days.filter((day) => day.date >= selectedDate && allDayItems(day).length);
  const groups = agendaGroups(populated, selectedDate);
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentViolet} />} style={styles.viewScroll} contentContainerStyle={styles.agendaContent}>
      {!populated.length ? <View style={styles.boardEmpty}><Text style={styles.emptyTitle}>No upcoming Calendar items</Text><Text style={styles.sectionMeta}>Use the add action to schedule a Session or custom item.</Text></View> : null}
      {groups.map((group) => (
        <View key={group.key} style={styles.agendaGroup}>
          <Text style={styles.agendaGroupLabel}>{group.label}</Text>
          {group.days.map((day) => (
            <View key={day.date} style={styles.agendaTimelineDay}>
              <Pressable accessibilityLabel={`Select ${formatCalendarDate(day.date)}`} onPress={() => onSelectDate(day.date)} style={styles.agendaDateRail}>
                <Text style={[styles.agendaWeekday, day.date === today && styles.agendaDateToday]}>{formatCalendarDate(day.date, { weekday: 'short' }).toUpperCase()}</Text>
                <Text style={[styles.agendaDayNumber, day.date === today && styles.agendaDateToday]}>{fromLocalYMD(day.date).getDate()}</Text>
                <Text style={styles.agendaMonth}>{formatCalendarDate(day.date, { month: 'short' }).toUpperCase()}</Text>
              </Pressable>
              <View style={styles.agendaDayCards}>
                {orderedDayItems(day).map((entry) => entry.kind === 'session' ? (
                  <CalendarSessionCard
                    athlete={athleteById.get(entry.item.athlete_id)}
                    key={`session-${entry.item.workout_id}`}
                    onOverflow={() => onSessionPress(entry.item)}
                    onPress={() => { onSelectDate(day.date); onSessionPress(entry.item); }}
                    session={entry.item}
                  />
                ) : (
                  <CalendarAgendaRow entry={entry} key={`${entry.kind}-${entry.kind === 'meet' ? entry.item.meet_plan_id : entry.item.id}`} onCustomPress={onCustomPress} onMeetPress={onMeetPress} onSessionPress={onSessionPress} />
                ))}
                <Pressable accessibilityLabel={`Add to ${day.date}`} onPress={() => onDayAdd(day)} style={styles.agendaInlineAdd}>
                  <Ionicons color={SLColors.accentViolet} name="add" size={15} />
                  <Text style={styles.agendaInlineAddText}>Add to this date</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function agendaGroups(days: CalendarDay[], anchorDate: string) {
  const parsedAnchor = fromLocalYMD(anchorDate);
  const thisWeek = toLocalYMD(startOfCalendarWeek(Number.isNaN(parsedAnchor.getTime()) ? new Date() : parsedAnchor));
  const nextWeek = toLocalYMD(addCalendarDays(fromLocalYMD(thisWeek), 7));
  const later = toLocalYMD(addCalendarDays(fromLocalYMD(thisWeek), 14));
  const groups = new Map<string, { key: string; label: string; days: CalendarDay[] }>();
  days.forEach((day) => {
    const key = day.date < nextWeek ? 'this-week' : day.date < later ? 'next-week' : day.date.slice(0, 7);
    const label = key === 'this-week'
      ? 'THIS WEEK'
      : key === 'next-week'
        ? 'NEXT WEEK'
        : formatCalendarDate(`${key}-01`, { month: 'long', year: 'numeric' }).toUpperCase();
    const group = groups.get(key) || { key, label, days: [] };
    group.days.push(day);
    groups.set(key, group);
  });
  return Array.from(groups.values());
}

function CalendarSessionCard({ athlete, compact = false, session, onPress, onOverflow, accessibilityHint }: {
  athlete?: CalendarAthlete;
  compact?: boolean;
  session: CalendarSession;
  onPress: () => void;
  onOverflow: () => void;
  accessibilityHint?: string;
}) {
  const primary = session.muscle_focus?.primary?.map((row) => row.muscle_id) || [];
  const secondary = session.muscle_focus?.secondary?.map((row) => row.muscle_id) || [];
  const focusLabel = primary
    .map((muscle) => MUSCLE_META[muscle as GovernedMuscleId]?.label)
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
  const countSummary = [
    Number.isFinite(session.movement_count) ? `${session.movement_count} movements` : null,
    Number.isFinite(session.set_count) ? `${session.set_count} sets` : null,
  ].filter(Boolean).join(' · ') || session.planned_summary || 'Programming details available';
  const color = statusColor(session.status);
  return (
    <View style={[styles.sessionVisualCard, compact && styles.sessionVisualCardCompact]}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={`${session.athlete_name}, ${session.label}, ${calendarStatusLabel(session.status)}, ${countSummary}`}
        accessibilityRole="button"
        onPress={onPress}
        style={styles.sessionVisualBody}
      >
        <View style={styles.sessionIdentityRow}>
          <SLAthleteAvatar imageUrl={athlete?.avatar_url} name={session.athlete_name} size={compact ? 30 : 34} />
          <View style={styles.sessionIdentityCopy}>
            <Text numberOfLines={1} style={styles.sessionAthleteName}>{session.athlete_name}</Text>
            <Text numberOfLines={2} style={[styles.sessionVisualTitle, compact && styles.sessionVisualTitleCompact]}>{session.label}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.sessionProgramContext}>{[calendarSessionContext(session), focusLabel].filter(Boolean).join(' · ') || calendarStatusLabel(session.status)}</Text>
        <View style={styles.sessionEvidenceRow}>
          <Ionicons color={SLColors.textMuted} name="clipboard-outline" size={13} />
          <Text numberOfLines={1} style={styles.sessionEvidence}>{countSummary}</Text>
        </View>
        <View style={[styles.sessionStatusRail, { backgroundColor: color }]} />
        {primary.length || secondary.length ? (
          <View pointerEvents="none" style={[styles.sessionAnatomy, compact && styles.sessionAnatomyCompact]}>
            <ProgrammingMuscleRegionArt level="session" primary={primary} secondary={secondary} />
          </View>
        ) : null}
      </Pressable>
      <View style={[styles.sessionLifecyclePill, { borderColor: `${color}99`, backgroundColor: `${color}18` }]}>
        <Text style={[styles.sessionLifecycleText, { color }]}>{calendarStatusLabel(session.status)}</Text>
      </View>
      <Pressable accessibilityLabel={`More actions for ${session.label}`} hitSlop={8} onPress={onOverflow} style={styles.sessionOverflow}>
        <Ionicons color={SLColors.textMuted} name="ellipsis-vertical" size={17} />
      </Pressable>
    </View>
  );
}

function AgendaRow({ title, meta, icon, tone, onPress, accessibilityHint }: { title: string; meta: string; icon: keyof typeof Ionicons.glyphMap; tone: SLStatusTone; onPress: () => void; accessibilityHint?: string }) {
  const color = SLStatusTones[tone].icon;
  return <Pressable accessibilityHint={accessibilityHint} accessibilityRole="button" onPress={onPress} style={styles.agendaRow}><View style={[styles.agendaIcon, { borderColor: color }]}><Ionicons color={color} name={icon} size={17} /></View><View style={styles.agendaCopy}><Text numberOfLines={1} style={styles.agendaTitle}>{title}</Text><Text numberOfLines={1} style={styles.agendaMeta}>{meta}</Text></View><Ionicons color={SLColors.textSubtle} name="chevron-forward" size={17} /></Pressable>;
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
  screen: { flex: 1, paddingTop: 6 }, center: { flex: 1, justifyContent: 'center' },
  compactHeader: { gap: 4, minHeight: 82, paddingHorizontal: 10 },
  headerIdentityRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between', minHeight: 42 },
  headerControlRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 36 },
  title: { color: SLColors.textStrong, flex: 1, fontSize: 29, fontWeight: '800' },
  statusSelector: { height: 36, width: 144 },
  athleteSelector: { flex: 1, height: 36, minWidth: 0 },
  compactSegmentedControl: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderHairline, borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 36, padding: 2, width: 148 },
  compactSegment: { alignItems: 'center', borderRadius: 9, flex: 1, justifyContent: 'center', minWidth: 0 },
  segmentActive: { backgroundColor: SLColors.accentSoft }, segmentText: { color: SLColors.textMuted, fontSize: 10, fontWeight: '700' }, segmentTextActive: { color: SLColors.accentViolet },
  summaryStrip: { alignItems: 'center', backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderHairline, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, marginHorizontal: 10, minHeight: 38, paddingHorizontal: 10 }, summaryValue: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 4 }, summaryDot: { borderRadius: 4, height: 7, width: 7 }, summaryNumber: { color: SLColors.text, fontSize: 12, fontWeight: '800' }, summaryLabel: { color: SLColors.textMuted, fontSize: 9 },
  rangeRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 50 }, rangeArrow: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 }, rangeLabelButton: { alignItems: 'center', flex: 1 }, rangeLabel: { color: SLColors.text, fontSize: 15, fontWeight: '800' }, todayHint: { color: SLColors.accentViolet, fontSize: 9, marginTop: 1, textTransform: 'uppercase' },
  fabDock: { position: 'absolute', right: SLLayout.screenGutter, zIndex: 30 }, fabShell: { width: SL_TAB_ROW_CONTROL.shellHeight },
  weekBoard: { flex: 1, overflow: 'hidden' },
  weekCardList: { flex: 1 },
  weekRowsContent: { paddingBottom: SLLayout.floatingUtilityClearance, paddingHorizontal: 10, paddingTop: 2 },
  athleteWeekCard: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, height: WEEK_CARD_HEIGHT, marginBottom: WEEK_CARD_GAP, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 12 },
  athleteWeekCardInactive: { opacity: 0.28 },
  athleteWeekCardActive: { borderColor: `${SLColors.accentViolet}CC` },
  athleteCardHeader: { alignItems: 'center', backgroundColor: SLColors.object, flexDirection: 'row', gap: 9, height: WEEK_CARD_HEADER_HEIGHT, paddingHorizontal: 10 },
  athleteCardCopy: { flex: 1, minWidth: 0 },
  athleteName: { color: SLColors.textStrong, fontSize: 13, fontWeight: '800' },
  athleteContext: { color: SLColors.textMuted, fontSize: 9, marginTop: 2 },
  athleteCompletionPill: { alignItems: 'center', backgroundColor: SLStatusTones.success.background, borderColor: SLStatusTones.success.border, borderRadius: 10, borderWidth: 1, justifyContent: 'center', minWidth: 38, paddingHorizontal: 7, paddingVertical: 4 },
  athleteCompletionText: { color: SLStatusTones.success.icon, fontSize: 9, fontWeight: '800' },
  athleteCompletionPillPending: { backgroundColor: SLColors.accentSoft, borderColor: `${SLColors.accentViolet}99` },
  athleteCompletionTextPending: { color: SLColors.accentViolet },
  athleteWeekLane: { borderTopColor: SLColors.borderHairline, borderTopWidth: 1, flex: 1 },
  dayCell: { alignItems: 'center', borderRightColor: SLColors.borderHairline, borderRightWidth: 1, height: WEEK_DAY_LANE_HEIGHT, width: DAY_COLUMN },
  dayCellToday: { backgroundColor: `${SLColors.accentViolet}0D` },
  dayCellHeader: { alignItems: 'center', borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', gap: 4, height: 29, justifyContent: 'center', width: '100%' },
  dateDow: { color: SLColors.textMuted, fontSize: 8, fontWeight: '800' },
  dateNumber: { color: SLColors.text, fontSize: 13, fontWeight: '800' },
  dateTodayText: { color: SLColors.accentViolet },
  dayCountDots: { flexDirection: 'row', gap: 2, height: 5, marginLeft: 1 },
  miniDot: { borderRadius: 2, height: 4, width: 4 },
  dayCellItems: { alignItems: 'center', flex: 1, gap: 2, justifyContent: 'center', paddingHorizontal: 4, position: 'relative', width: '100%' },
  emptyDayAction: { alignItems: 'center', borderColor: SLColors.borderStrong, borderRadius: 13, borderWidth: 1, height: 28, justifyContent: 'center', width: 28 },
  dayCellDragInvalid: { opacity: 0.22 },
  dayCellDragValid: { backgroundColor: `${SLColors.accentViolet}18`, opacity: 1 },
  dayCellDragTarget: { backgroundColor: `${SLColors.accentViolet}38`, borderColor: SLColors.accentViolet, borderWidth: 1, opacity: 1 },
  sessionChip: { borderLeftWidth: 2, borderRadius: 7, minHeight: 31, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowRadius: 9, width: DAY_COLUMN - 8 },
  chipPressable: { flex: 1, justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 3 },
  chipTitle: { color: SLColors.text, fontSize: 9, fontWeight: '800' },
  chipMeta: { color: SLColors.textMuted, fontSize: 8, marginTop: 1 },
  chipStatusDot: { borderRadius: 3, bottom: 4, height: 4, position: 'absolute', right: 4, width: 4 },
  customChip: { backgroundColor: SLStatusTones.review.background, borderColor: SLStatusTones.review.border, borderLeftWidth: 2, borderRadius: 7, minHeight: 31, padding: 5, width: DAY_COLUMN - 8 },
  meetChip: { backgroundColor: SLStatusTones.danger.background, borderColor: SLStatusTones.danger.border, borderLeftWidth: 2, borderRadius: 7, minHeight: 31, padding: 5, width: DAY_COLUMN - 8 },
  moreCount: { color: SLColors.textSubtle, fontSize: 8, fontWeight: '700', position: 'absolute', right: 4, top: 1 },
  boardEmpty: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 150, padding: 24 }, emptyTitle: { color: SLColors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  viewScroll: { flex: 1 },
  monthBoardRoot: { flex: 1, overflow: 'visible' },
  monthContent: { gap: 10, overflow: 'hidden', paddingBottom: 110, paddingHorizontal: 10 },
  monthPagerViewport: { overflow: 'hidden', width: '100%' },
  monthPagerTrack: { flexDirection: 'row' },
  monthPagerPage: { flexShrink: 0 },
  monthGridCard: { backgroundColor: '#05070A', borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, overflow: 'hidden', paddingBottom: 8 },
  monthSummaryStrip: { borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', minHeight: 64 },
  monthSummaryValue: { alignItems: 'center', borderRightColor: SLColors.borderHairline, borderRightWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', paddingHorizontal: 4 },
  monthSummaryNumber: { color: SLColors.textStrong, fontSize: 15, fontWeight: '900' },
  monthSummaryLabel: { color: SLColors.textMuted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  monthWeekdays: { flexDirection: 'row', paddingHorizontal: 4, paddingTop: 10 },
  monthWeekday: { color: SLColors.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'center', width: `${100 / 7}%` },
  monthRow: { flexDirection: 'row', paddingHorizontal: 4 },
  monthDay: { alignItems: 'center', height: 48, justifyContent: 'center', width: `${100 / 7}%` },
  monthDaySingleAthlete: { height: 68, justifyContent: 'flex-start', paddingHorizontal: 2, paddingTop: 5 },
  monthDayToday: { backgroundColor: `${SLStatusTones.warning.icon}18`, borderColor: `${SLStatusTones.warning.icon}99`, borderRadius: 18, borderWidth: 1 },
  monthDaySelected: { backgroundColor: SLColors.accentSoft, borderColor: SLColors.accentViolet, borderRadius: 18, borderWidth: 1 },
  monthDayDragInvalid: { opacity: 0.24 },
  monthDayDragValid: { backgroundColor: `${SLColors.accentViolet}16`, borderColor: `${SLColors.accentViolet}99`, borderRadius: 18, borderWidth: 1, opacity: 1 },
  monthDayDragTarget: { backgroundColor: `${SLColors.accentViolet}38`, borderColor: SLColors.accentViolet, borderRadius: 18, borderWidth: 2, opacity: 1 },
  monthDate: { color: SLColors.text, fontSize: 14, fontWeight: '700' },
  monthDateOutside: { color: SLColors.textSubtle },
  monthDots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 3 },
  monthDot: { borderRadius: 2, height: 4, width: 4 },
  monthSessionLabels: { alignItems: 'center', marginTop: 3, minHeight: 26, width: '100%' },
  monthSessionPill: { borderRadius: 5, borderWidth: 1, justifyContent: 'center', maxWidth: '100%', minHeight: 18, paddingHorizontal: 3, width: '100%' },
  monthSessionPillText: { fontSize: 8, fontWeight: '800', lineHeight: 11, textAlign: 'center' },
  monthSessionOverflow: { color: SLColors.textMuted, fontSize: 8, fontWeight: '800', lineHeight: 10, marginTop: 1 },
  monthAgenda: { backgroundColor: '#05070A', borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  monthAgendaEmpty: { paddingBottom: 16, paddingHorizontal: 14 },
  monthDragPreview: { alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.accentViolet, borderRadius: 14, borderWidth: 1, elevation: 12, flexDirection: 'row', gap: 9, left: 0, minHeight: 60, paddingHorizontal: 12, position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.42, shadowRadius: 14, top: 0, width: 216, zIndex: 50 },
  monthDragPreviewIcon: { alignItems: 'center', backgroundColor: SLColors.surfaceEmbedded, borderRadius: 11, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  monthDragPreviewCopy: { flex: 1 },
  monthDragPreviewTitle: { color: SLColors.textStrong, fontSize: 14, fontWeight: '800' },
  monthDragPreviewMeta: { color: SLColors.textMuted, fontSize: 11, marginTop: 2 },
  sectionTitle: { color: SLColors.text, fontSize: 15, fontWeight: '800' },
  sectionMeta: { color: SLColors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  agendaContent: { gap: 18, paddingBottom: 112, paddingHorizontal: 10, paddingTop: 2 },
  agendaGroup: { gap: 9 },
  agendaGroupLabel: { color: SLColors.accentViolet, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  agendaTimelineDay: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  agendaDateRail: { alignItems: 'center', paddingTop: 10, width: 45 },
  agendaWeekday: { color: SLColors.accentViolet, fontSize: 10, fontWeight: '900' },
  agendaDayNumber: { color: SLColors.textStrong, fontSize: 25, fontWeight: '900', lineHeight: 29 },
  agendaMonth: { color: SLColors.textMuted, fontSize: 9, fontWeight: '800' },
  agendaDateToday: { color: SLStatusTones.warning.icon },
  agendaDayCards: { flex: 1, gap: 7, minWidth: 0 },
  agendaInlineAdd: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 30, paddingHorizontal: 8 },
  agendaInlineAddText: { color: SLColors.accentViolet, fontSize: 10, fontWeight: '700' },
  agendaDay: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  agendaDayHeader: { alignItems: 'center', borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  agendaDate: { color: SLColors.text, fontSize: 15, fontWeight: '800' },
  smallAdd: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  agendaRow: { alignItems: 'center', backgroundColor: SLColors.surfaceEmbedded, borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 66, paddingHorizontal: 12 },
  agendaIcon: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  agendaCopy: { flex: 1 },
  agendaTitle: { color: SLColors.text, fontSize: 14, fontWeight: '800' },
  agendaMeta: { color: SLColors.textMuted, fontSize: 11, marginTop: 3 },
  sessionVisualCard: { backgroundColor: '#090B11', borderColor: SLColors.borderStrong, borderRadius: 15, borderWidth: 1, minHeight: 124, overflow: 'hidden', position: 'relative' },
  sessionVisualCardCompact: { borderLeftColor: SLColors.accentViolet, borderLeftWidth: 2, borderRadius: 0, borderWidth: 0, borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, minHeight: 104 },
  sessionVisualBody: { flex: 1, justifyContent: 'center', paddingBottom: 11, paddingLeft: 12, paddingRight: 82, paddingTop: 11 },
  sessionIdentityRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minWidth: 0 },
  sessionIdentityCopy: { flex: 1, minWidth: 0 },
  sessionAthleteName: { color: SLColors.textMuted, fontSize: 10, fontWeight: '700' },
  sessionVisualTitle: { color: SLColors.accentViolet, fontSize: 17, fontWeight: '900', lineHeight: 20, marginTop: 1 },
  sessionVisualTitleCompact: { color: SLColors.textStrong, fontSize: 15 },
  sessionProgramContext: { color: SLColors.textMuted, fontSize: 10, marginTop: 6 },
  sessionEvidenceRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 7 },
  sessionEvidence: { color: SLColors.text, flexShrink: 1, fontSize: 10, fontWeight: '700' },
  sessionStatusRail: { bottom: 0, position: 'absolute', right: 0, top: 0, width: 3 },
  sessionAnatomy: { bottom: -8, opacity: 0.92, position: 'absolute', right: 7, width: 58 },
  sessionAnatomyCompact: { right: 11 },
  sessionLifecyclePill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, position: 'absolute', right: 38, top: 7 },
  sessionLifecycleText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  sessionOverflow: { alignItems: 'center', backgroundColor: 'rgba(7,8,12,0.76)', borderColor: SLColors.borderHairline, borderRadius: 9, borderWidth: 1, height: 28, justifyContent: 'center', position: 'absolute', right: 6, top: 6, width: 25 },
  modalOverlay: { backgroundColor: 'rgba(0,0,0,0.72)', flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: SLColors.object, borderColor: SLColors.borderStrong, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '88%', minHeight: 180, paddingBottom: 26 }, sheetHeader: { alignItems: 'center', borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 15 }, sheetTitle: { color: SLColors.textStrong, fontSize: 20, fontWeight: '800' }, sheetClose: { alignItems: 'center', backgroundColor: SLColors.surfaceEmbedded, borderRadius: 16, height: 42, justifyContent: 'center', width: 42 }, sheetBody: { gap: 12, padding: 18, paddingBottom: 28 }, dayDetailGroup: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderHairline, borderRadius: 14, borderWidth: 1, overflow: 'hidden' }, dayDetailGroupTitle: { color: SLColors.textStrong, fontSize: 14, fontWeight: '800', paddingHorizontal: 13, paddingTop: 12 }, input: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 12, borderWidth: 1, color: SLColors.text, fontSize: 15, minHeight: 48, paddingHorizontal: 13, paddingVertical: 10 }, notesInput: { minHeight: 92 }, fieldLabel: { color: SLColors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 3 }, errorText: { color: SLStatusTones.danger.icon, fontSize: 12 }, linkText: { color: SLColors.accentViolet, fontSize: 12, fontWeight: '700' }, filterSectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, filterAthleteRow: { alignItems: 'center', borderBottomColor: SLColors.borderHairline, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 54 }, filterAthleteName: { color: SLColors.text, flex: 1, fontSize: 14, fontWeight: '700' }, statusLabel: { marginTop: 12 }, filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterChip: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 }, filterChipActive: { backgroundColor: SLColors.accentSoft, borderColor: SLColors.accentViolet }, filterChipText: { color: SLColors.textMuted, fontSize: 12, fontWeight: '700' }, filterChipTextActive: { color: SLColors.accentViolet }, athleteChips: { gap: 7, paddingRight: 12 }, choiceChip: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, maxWidth: 150, paddingHorizontal: 12, paddingVertical: 9 }, choiceChipActive: { backgroundColor: SLColors.accentSoft, borderColor: SLColors.accentViolet }, choiceChipText: { color: SLColors.textMuted, fontSize: 12, fontWeight: '700' }, choiceChipTextActive: { color: SLColors.accentViolet },
  createChoice: { alignItems: 'center', backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 78, padding: 12 }, disabled: { opacity: 0.45 }, createIcon: { alignItems: 'center', backgroundColor: SLColors.accentSoft, borderRadius: 12, height: 48, justifyContent: 'center', width: 48 }, customCreateIcon: { backgroundColor: SLStatusTones.review.background }, createCopy: { flex: 1 }, createTitle: { color: SLColors.text, fontSize: 15, fontWeight: '800' }, createMeta: { color: SLColors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 3 }, detailHero: { backgroundColor: SLColors.surfaceEmbedded, borderColor: SLColors.borderStrong, borderRadius: 16, borderWidth: 1, gap: 7, padding: 15 }, detailTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 10 }, detailIcon: { alignItems: 'center', borderRadius: 13, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, detailCopy: { flex: 1 }, detailTitle: { color: SLColors.textStrong, fontSize: 19, fontWeight: '800' }, detailMeta: { color: SLColors.textMuted, fontSize: 12 }, detailDate: { color: SLColors.text, fontSize: 14, fontWeight: '700' }, detailSummary: { color: SLColors.textMuted, fontSize: 13, lineHeight: 18 },
});
