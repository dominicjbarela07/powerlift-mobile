import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SL_TAB_ROW_CONTROL,
  SLTabRowControlItem,
  SLTabRowControlLabel,
  SLTabRowControlShell,
} from '@/components/navigation/sl-tab-row-control';
import { Text } from '@/components/ui/sl-text';
import {
  SLColors,
  SLLayout,
  SLMovementCardMaterial,
  SLSpacing,
  SLTypography,
} from '@/constants/theme';
import type { CalendarRepeatRule } from '@/lib/calendar-event-form';
import {
  calendarDayMatchesFilter,
  primaryCalendarDayTone,
  resolveCalendarLensState,
  type CalendarDayTone,
} from '@/lib/athlete-calendar-lens';
import {
  resolveCalendarSessionStatus,
  type CalendarSessionStatusPresentation,
} from '@/lib/calendar-session-status';
import { resolveAthleteCalendarMonthIndicator } from '@/lib/athlete-calendar-month-summary';
import { clockMinutesInTimezone } from '@/lib/calendar-today';
import {
  calendarProgramStartsInMonth,
  calendarTrainingRangeForDate,
  calendarTrainingRangesForMonth,
  formatCalendarStructureDate,
  formatCalendarStructureRange,
  type CalendarProgramContext,
} from '@/lib/calendar-training-structure';

export type AthleteCalendarSession = {
  id: number;
  title?: string | null;
  date?: string | null;
  status?: string | null;
  blockId?: number | null;
  blockName?: string | null;
  plannedSummary?: string | null;
  primaryLifts?: string[];
  accessoryCount?: number | null;
  prCount?: number | null;
  presentation?: 'heavy' | 'moved' | null;
  estimatedDurationMinutes?: number | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  scheduledTimezone?: string | null;
};

export type AthleteCalendarPersonalEvent = {
  id: number;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  category?: string | null;
  location?: string | null;
  notes?: string | null;
  repeatRule?: CalendarRepeatRule;
  alertOffsetMinutes?: number | null;
  unavailableForTraining: boolean;
};

export type AthleteCalendarMeet = { id: number; name?: string | null; date?: string | null; status?: string | null };
export type AthleteCalendarCheckIn = { id: number; title?: string | null; status?: string | null };
export type AthleteCalendarDay = {
  date: string;
  isToday?: boolean;
  trainingStatus?: string | null;
  sessions: AthleteCalendarSession[];
  personalEvents?: AthleteCalendarPersonalEvent[];
  meets?: AthleteCalendarMeet[];
  checkIns?: AthleteCalendarCheckIn[];
};
export type AthleteCalendarRange = { start: string; end: string; label: string; id?: number | string };
export type AthleteCalendarImportantDate = { id: string; date: string; label: string; kind: 'meet' | 'block' | 'session'; targetId?: number | null };
export type AthleteCalendarConflict = {
  id: string;
  certainty: 'confirmed' | 'potential';
  reason: string;
  date: string;
  eventId: number;
  eventTitle: string;
  workoutId: number;
  workoutTitle: string;
};
export type AthleteCalendarWeekSummary = {
  startDate: string;
  endDate: string;
  sessionCount: number;
  completedCount: number;
  missedCount: number;
  heavyCount: number;
  personalEventCount: number;
  isCurrent: boolean;
  loadLabel: string;
};
export type AthleteCalendarMonthSummary = {
  month: string;
  metricKind?: 'session_completion_to_date' | string | null;
  sessionCount: number;
  completedCount: number;
  upcomingCount: number;
  plannedCount: number;
  dueCount?: number | null;
  dueCompletedCount?: number | null;
  missedCount?: number | null;
  completionPercent: number | null;
  totalVolumeKg: number;
  prCount: number;
  reportedBodyweight?: {
    startKg: number;
    latestKg: number;
    observationCount: number;
  } | null;
  blockNames: string[];
};
export type AthleteCalendarExperienceData = {
  today: string;
  timezone?: string | null;
  athleteName?: string | null;
  avatarUrl?: string | null;
  preferredUnits?: 'kg' | 'lb';
  days: AthleteCalendarDay[];
  ranges?: AthleteCalendarRange[];
  programContext?: CalendarProgramContext | null;
  importantDates?: AthleteCalendarImportantDate[];
  conflicts?: AthleteCalendarConflict[];
  weekSummaries?: AthleteCalendarWeekSummary[];
  monthSummaries?: AthleteCalendarMonthSummary[];
};

export type AthleteCalendarLensState =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'rest'
  | 'personal'
  | 'needs_attention';

export type AthleteCalendarReadiness = {
  id: number;
  date: string;
  workoutId?: number | null;
  score?: number | null;
  sleepQuality?: number | null;
  sleepHours?: number | null;
  soreness?: number | null;
  stress?: number | null;
  energy?: number | null;
  bodyweightKg?: number | null;
};

export type AthleteCalendarAccomplishment = {
  count: number;
  movementLabels: string[];
  highestPriority?: {
    id?: number | string | null;
    eventType?: string | null;
    movementLabel?: string | null;
    currentValue?: number | null;
    priorValue?: number | null;
    delta?: number | null;
    unit?: string | null;
    presentationMode?: string | null;
  } | null;
};

export type AthleteCalendarDayDetailSession = AthleteCalendarSession & {
  programmingNotes?: string | null;
  planned?: {
    movementCount: number;
    movementLabels: string[];
    plannedSets: number;
    label?: string | null;
  } | null;
  performance?: {
    completedSets: number;
    totalReps: number;
    totalVolumeKg: number;
    actualDurationMinutes?: number | null;
    bestSet?: { weightKg: number; reps: number; rpe?: number | null; rir?: number | null } | null;
  } | null;
  reflection?: {
    sessionRpe?: number | null;
    strength?: string | null;
    fatigue?: string | null;
    note?: string | null;
  } | null;
  readiness?: AthleteCalendarReadiness | null;
  accomplishment?: AthleteCalendarAccomplishment | null;
  missedContext?: { reason?: string | null; comment?: string | null } | null;
};

export type AthleteCalendarDayDetail = {
  date: string;
  timezone?: string | null;
  isToday?: boolean;
  state: AthleteCalendarLensState;
  sessions: AthleteCalendarDayDetailSession[];
  readiness?: AthleteCalendarReadiness | null;
  personalEvents: AthleteCalendarPersonalEvent[];
  conflicts: AthleteCalendarConflict[];
  blockContext?: {
    id: number;
    name?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    weekNumber?: number | null;
    totalWeeks?: number | null;
  } | null;
  nextUp?: AthleteCalendarSession | null;
  capabilities: { canAddPersonalItem: boolean; canCreateSession: boolean };
};

export type AthleteCalendarAction =
  | { type: 'session'; id: number }
  | { type: 'create-session'; date: string }
  | { type: 'schedule-session'; session: AthleteCalendarSession }
  | { type: 'meet'; id: number }
  | { type: 'check-in'; id: number }
  | { type: 'daily-readiness'; date: string }
  | { type: 'add-event'; date: string }
  | { type: 'edit-event'; event: AthleteCalendarPersonalEvent }
  | { type: 'review-conflict'; conflict: AthleteCalendarConflict }
  | { type: 'important-date'; item: AthleteCalendarImportantDate };

export type CalendarView = 'month' | 'day';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 19 }, (_, index) => index + 6);

export function AthleteCalendarExperience({
  anchorMonth,
  data,
  onAction,
  onMonthChange,
  onToday,
  canManagePersonalEvents = true,
  initialView = 'month',
  initialSelectedDate,
  onLoadMore,
  loadingMore = false,
  paginationError,
  onRetryLoadMore,
  onRefresh,
  refreshing = false,
  navigationRevision = 0,
  dayDetail,
  dayDetailError,
  dayDetailLoading = false,
  onRetryDayDetail,
  onSelectedDateChange,
  selectedDate: controlledSelectedDate,
}: {
  anchorMonth: Date;
  data: AthleteCalendarExperienceData;
  onAction: (action: AthleteCalendarAction) => void;
  onMonthChange: (month: Date) => void;
  onToday: () => string | void;
  onWeekSelect?: (week: AthleteCalendarWeekSummary) => void;
  canManagePersonalEvents?: boolean;
  initialView?: CalendarView;
  initialSelectedDate?: string;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  paginationError?: string | null;
  onRetryLoadMore?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  navigationRevision?: number;
  dayDetail?: AthleteCalendarDayDetail | null;
  dayDetailError?: string | null;
  dayDetailLoading?: boolean;
  onRetryDayDetail?: () => void;
  onSelectedDateChange?: (date: string) => void;
  selectedDate?: string;
}) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<CalendarView>(initialView);
  const [internalSelectedDate, setInternalSelectedDate] = useState(initialSelectedDate || data.today);
  const selectedDate = controlledSelectedDate || internalSelectedDate;
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [reduceMotion, setReduceMotion] = useState(false);
  const previousTodayRef = useRef(data.today);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => null);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const previousToday = previousTodayRef.current;
    previousTodayRef.current = data.today;
    // Loading can initially render before the server-provided athlete timezone
    // arrives. Advance only an untouched automatic selection; never pull a
    // date the athlete deliberately selected back to Today.
    if (!controlledSelectedDate) {
      setInternalSelectedDate((current) => current === previousToday ? data.today : current);
    }
  }, [data.today]);

  const setSelectedDate = useCallback((date: string) => {
    if (!controlledSelectedDate) setInternalSelectedDate(date);
    onSelectedDateChange?.(date);
  }, [controlledSelectedDate, onSelectedDateChange]);

  const openDay = useCallback((date: string) => {
    setSelectedDate(date);
    void Haptics.selectionAsync();
  }, [setSelectedDate]);

  const selectAgendaDate = useCallback((date: string) => {
    setSelectedDate(date);
    const nextDate = parseYmd(date);
    if (
      nextDate
      && (
        nextDate.getFullYear() !== anchorMonth.getFullYear()
        || nextDate.getMonth() !== anchorMonth.getMonth()
      )
    ) {
      onMonthChange(startOfMonth(nextDate));
    }
  }, [anchorMonth, onMonthChange]);

  const goToday = () => {
    const target = onToday() || data.today;
    setSelectedDate(target);
    if (view === 'day') setView('day');
    void Haptics.selectionAsync();
  };

  const filteredDays = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.days.filter((day) => {
      if (!dayMatchesFilter(day, filter)) return false;
      if (!normalized) return true;
      const values = [
        ...day.sessions.map((session) => session.title || ''),
        ...(day.personalEvents || []).map((event) => `${event.title} ${event.location || ''}`),
        ...(day.meets || []).map((meet) => meet.name || ''),
        ...(day.checkIns || []).map((checkIn) => checkIn.title || ''),
      ];
      return values.some((value) => value.toLowerCase().includes(normalized));
    });
  }, [data.days, filter, query]);

  return (
      <View style={styles.root}>
        <CalendarToolbar
          anchorMonth={anchorMonth}
          canAdd={canManagePersonalEvents}
          onAction={onAction}
          onBack={() => {
            if (view === 'day') setView('month');
            else onMonthChange(addMonths(anchorMonth, -12));
          }}
          onForward={() => onMonthChange(addMonths(anchorMonth, 12))}
          onSearch={() => setSearchOpen((current) => !current)}
          selectedDate={selectedDate}
          view={view}
        />
        {searchOpen ? (
          <View style={styles.searchRow}>
            <Ionicons color={SLColors.textMuted} name="search" size={20} />
            <TextInput
              autoFocus
              onChangeText={setQuery}
              placeholder="Search Calendar"
              placeholderTextColor={SLColors.textSubtle}
              style={styles.searchInput}
              value={query}
            />
            <Pressable onPress={() => { setQuery(''); setSearchOpen(false); }} hitSlop={10}>
              <Ionicons color={SLColors.textMuted} name="close-circle" size={21} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.body}>
          <AthleteCalendarV2Content
            anchorMonth={anchorMonth}
            canManagePersonalEvents={canManagePersonalEvents}
            data={data}
            dayDetail={dayDetail}
            dayDetailError={dayDetailError}
            dayDetailLoading={dayDetailLoading}
            expanded={view === 'day'}
            filter={filter}
            navigationRevision={navigationRevision}
            onAction={onAction}
            onExpand={() => setView('day')}
            onCollapse={() => setView('month')}
            onFilter={setFilter}
            onLoadMore={onLoadMore}
            onRefresh={onRefresh}
            onRetryDayDetail={onRetryDayDetail}
            onSelectDate={selectAgendaDate}
            refreshing={refreshing}
            selectedDate={selectedDate}
            visibleDays={filteredDays}
          />
        </View>
        {loadingMore ? <ActivityIndicator color={SLColors.accentMagenta} style={[styles.paginationSpinner, { bottom: 132 + insets.bottom }]} /> : null}
        {paginationError ? (
          <Pressable onPress={onRetryLoadMore} style={[styles.paginationError, { bottom: 132 + insets.bottom }]}>
            <Text style={styles.paginationErrorText}>More dates could not load. Tap to retry.</Text>
          </Pressable>
        ) : null}
        <BottomControls
          onToday={goToday}
          onView={() => setView((current) => current === 'day' ? 'month' : 'day')}
          bottomInset={insets.bottom}
          view={view}
        />
        {reduceMotion ? <View accessibilityLabel="Reduced motion enabled" /> : null}
      </View>
  );
}

function CalendarToolbar({
  anchorMonth,
  canAdd,
  onAction,
  onBack,
  onForward,
  onSearch,
  selectedDate,
  view,
}: {
  anchorMonth: Date;
  canAdd: boolean;
  onAction: (action: AthleteCalendarAction) => void;
  onBack: () => void;
  onForward: () => void;
  onSearch: () => void;
  selectedDate: string;
  view: CalendarView;
}) {
  const leftLabel = view === 'month' ? String(anchorMonth.getFullYear()) : monthShort(parseYmd(selectedDate) || anchorMonth);
  return (
    <View pointerEvents="box-none" style={styles.toolbar}>
      <SLTabRowControlShell density="utility">
        <SLTabRowControlItem
          accessibilityLabel={view === 'month' ? 'Previous year' : 'Back to month'}
          icon="chevron-back"
          onPress={onBack}
        />
        <View style={styles.toolbarPeriodLabel}>
          <SLTabRowControlLabel>{leftLabel}</SLTabRowControlLabel>
        </View>
        {view === 'month' ? (
          <SLTabRowControlItem accessibilityLabel="Next year" icon="chevron-forward" onPress={onForward} />
        ) : null}
      </SLTabRowControlShell>
      <SLTabRowControlShell density="utility">
        <SLTabRowControlItem accessibilityLabel="Search Calendar" icon="search" onPress={onSearch} />
        {canAdd ? (
          <SLTabRowControlItem
            accessibilityLabel="Add event"
            icon="add"
            onPress={() => onAction({ type: 'add-event', date: selectedDate })}
          />
        ) : null}
      </SLTabRowControlShell>
    </View>
  );
}

type CalendarFilter = 'all' | 'sessions' | 'personal' | 'completed' | 'attention';

const CALENDAR_FILTERS: { id: CalendarFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'personal', label: 'Personal' },
  { id: 'completed', label: 'Completed' },
  { id: 'attention', label: 'Attention' },
];

function AthleteCalendarV2Content({
  anchorMonth,
  canManagePersonalEvents,
  data,
  dayDetail,
  dayDetailError,
  dayDetailLoading,
  expanded,
  filter,
  navigationRevision,
  onAction,
  onCollapse,
  onExpand,
  onFilter,
  onLoadMore,
  onRefresh,
  onRetryDayDetail,
  onSelectDate,
  refreshing,
  selectedDate,
  visibleDays,
}: {
  anchorMonth: Date;
  canManagePersonalEvents: boolean;
  data: AthleteCalendarExperienceData;
  dayDetail?: AthleteCalendarDayDetail | null;
  dayDetailError?: string | null;
  dayDetailLoading: boolean;
  expanded: boolean;
  filter: CalendarFilter;
  navigationRevision: number;
  onAction: (action: AthleteCalendarAction) => void;
  onCollapse: () => void;
  onExpand: () => void;
  onFilter: (filter: CalendarFilter) => void;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  onRetryDayDetail?: () => void;
  onSelectDate: (date: string) => void;
  refreshing: boolean;
  selectedDate: string;
  visibleDays: AthleteCalendarDay[];
}) {
  const scrollRef = useRef<ScrollView>(null);
  const resolvedDetail = dayDetail?.date === selectedDate
    ? dayDetail
    : fallbackDayDetail(data, selectedDate, canManagePersonalEvents);
  const pullGesture = useMemo(
    () => Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY([-12, 12])
      .failOffsetX([-18, 18])
      .onEnd(({ translationY, velocityY }) => {
        if (!expanded && (translationY < -44 || velocityY < -520)) onExpand();
        if (expanded && (translationY > 44 || velocityY > 520)) onCollapse();
      }),
    [expanded, onCollapse, onExpand],
  );

  useEffect(() => {
    if (navigationRevision > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [navigationRevision]);

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.v2ScrollContent}
      onMomentumScrollEnd={({ nativeEvent }) => {
        const remaining = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
        if (!expanded && remaining < 240) onLoadMore?.();
      }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentViolet} /> : undefined}
      showsVerticalScrollIndicator={false}
    >
      {expanded ? (
        <FocusedWeekStrip data={data} onSelectDate={onSelectDate} selectedDate={selectedDate} />
      ) : (
        <>
          <FilterRow filter={filter} onFilter={onFilter} />
          <MonthSection
            data={{ ...data, days: visibleDays }}
            month={anchorMonth}
            onAction={onAction}
            onSelectDate={onSelectDate}
            selectedDate={selectedDate}
          />
        </>
      )}
      <GestureDetector gesture={pullGesture}>
        <View>
          <Pressable
            accessibilityLabel={expanded ? 'Collapse Training Lens to month' : 'Expand Training Lens to week'}
            accessibilityRole="button"
            onPress={expanded ? onCollapse : onExpand}
            style={styles.lensHandleButton}
          >
            <View style={styles.lensHandle} />
            <Text style={styles.lensHandleLabel}>{expanded ? 'MONTH OVERVIEW' : 'PULL UP FOR DAY DETAIL'}</Text>
          </Pressable>
          <TrainingLens
            canManagePersonalEvents={canManagePersonalEvents}
            data={data}
            detail={resolvedDetail}
            error={dayDetailError}
            loading={dayDetailLoading && !dayDetail}
            onAction={onAction}
            onRetry={onRetryDayDetail}
            selectedDate={selectedDate}
          />
        </View>
      </GestureDetector>
      <View style={styles.v2BottomClearance} />
    </ScrollView>
  );
}

function FilterRow({ filter, onFilter }: { filter: CalendarFilter; onFilter: (filter: CalendarFilter) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.filterRow} horizontal showsHorizontalScrollIndicator={false}>
      {CALENDAR_FILTERS.map((item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: filter === item.id }}
          key={item.id}
          onPress={() => onFilter(item.id)}
          style={[styles.filterChip, filter === item.id && styles.filterChipSelected]}
        >
          <Text style={[styles.filterChipText, filter === item.id && styles.filterChipTextSelected]}>{item.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function FocusedWeekStrip({
  data,
  onSelectDate,
  selectedDate,
}: {
  data: AthleteCalendarExperienceData;
  onSelectDate: (date: string) => void;
  selectedDate: string;
}) {
  const selected = parseYmd(selectedDate) || new Date();
  const week = weekContaining(selected);
  const byDate = new Map(data.days.map((day) => [day.date, day]));
  return (
    <View style={styles.focusedWeekSection}>
      <Text style={styles.focusedWeekTitle}>{monthShort(week[0])} {week[0].getDate()} – {monthShort(week[6])} {week[6].getDate()}</Text>
      <View style={styles.focusedWeekStrip}>
        {week.map((date, index) => {
          const ymd = toYmd(date);
          const day = byDate.get(ymd);
          const selectedCell = ymd === selectedDate;
          const tone = primaryDayTone(day);
          return (
            <Pressable key={ymd} onPress={() => onSelectDate(ymd)} style={styles.focusedWeekDay}>
              <Text style={styles.focusedWeekWeekday}>{WEEKDAYS[index]}</Text>
              <View style={[styles.focusedWeekNumber, selectedCell && styles.focusedWeekNumberSelected]}>
                <Text style={[styles.focusedWeekNumberText, selectedCell && styles.selectedDayNumber]}>{date.getDate()}</Text>
              </View>
              <View style={[styles.focusedWeekMarker, { backgroundColor: toneColor(tone) }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TrainingLens({
  canManagePersonalEvents,
  data,
  detail,
  error,
  loading,
  onAction,
  onRetry,
  selectedDate,
}: {
  canManagePersonalEvents: boolean;
  data: AthleteCalendarExperienceData;
  detail: AthleteCalendarDayDetail;
  error?: string | null;
  loading: boolean;
  onAction: (action: AthleteCalendarAction) => void;
  onRetry?: () => void;
  selectedDate: string;
}) {
  const date = parseYmd(selectedDate) || new Date();
  const state = detail.state;
  const tone = lensTone(state);
  const sessions = detail.sessions;
  const readiness = detail.readiness || sessions.find((item) => item.readiness)?.readiness || null;
  const allowPersonalItem = canManagePersonalEvents && detail.capabilities.canAddPersonalItem;
  const allowCreateSession = detail.capabilities.canCreateSession;
  return (
    <View style={[styles.trainingLens, { borderColor: colorWithAlpha(tone, 0.58) }]}>
      <LinearGradient
        colors={[colorWithAlpha(tone, 0.15), 'rgba(0,0,0,0)']}
        end={{ x: 0.9, y: 0.8 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.lensDateRow}>
        <View style={styles.flex}>
          <Text style={[styles.lensEyebrow, { color: tone }]}>{date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}</Text>
          <Text style={styles.lensStateTitle}>{lensStateLabel(state, detail.isToday)}</Text>
        </View>
        <View style={[styles.lensStateBadge, { borderColor: colorWithAlpha(tone, 0.55) }]}>
          <View style={[styles.lensStateDot, { backgroundColor: tone }]} />
          <Text style={[styles.lensStateBadgeText, { color: tone }]}>{lensStateBadge(state)}</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.lensLoading}><ActivityIndicator color={tone} /><Text style={styles.lensMuted}>Loading day context…</Text></View>
      ) : null}
      {error ? (
        <Pressable onPress={onRetry} style={styles.lensError}>
          <Ionicons color={SLColors.danger} name="cloud-offline-outline" size={18} />
          <View style={styles.flex}><Text style={styles.lensCardTitle}>Day context unavailable</Text><Text style={styles.lensMuted}>The month remains available. Tap to retry this date.</Text></View>
        </Pressable>
      ) : null}
      {!loading && !error ? (
        <>
          {sessions.map((session) => (
            <SessionLensCard key={session.id} onAction={onAction} session={session} state={state} tone={tone} />
          ))}
          {state === 'rest' && !sessions.length ? <RestLensCard detail={detail} readiness={readiness} /> : null}
          {detail.personalEvents.map((event) => (
            <PersonalLensCard conflicts={detail.conflicts.filter((item) => item.eventId === event.id)} event={event} key={event.id} onAction={onAction} />
          ))}
          {readiness && state !== 'completed' ? <ReadinessCard readiness={readiness} /> : null}
          {detail.nextUp ? <NextUpCard nextUp={detail.nextUp} onAction={onAction} /> : null}
          {!sessions.length && !detail.personalEvents.length && state !== 'rest' ? <RestLensCard detail={detail} readiness={readiness} /> : null}
        </>
      ) : null}
      {allowPersonalItem || allowCreateSession ? (
        <View style={styles.quickAddActions}>
          {allowCreateSession ? (
            <Pressable onPress={() => onAction({ type: 'create-session', date: selectedDate })} style={({ pressed }) => [styles.quickAddButton, styles.quickAddButtonFlexible, pressed && styles.pressed]}>
              <Ionicons color={SLColors.accentViolet} name="barbell-outline" size={21} />
              <Text style={styles.quickAddText}>Create Session</Text>
            </Pressable>
          ) : null}
          {allowPersonalItem ? (
            <Pressable onPress={() => onAction({ type: 'add-event', date: selectedDate })} style={({ pressed }) => [styles.quickAddButton, styles.quickAddButtonFlexible, pressed && styles.pressed]}>
              <Ionicons color={SLColors.accentViolet} name="calendar-outline" size={21} />
              <Text style={styles.quickAddText}>Add Personal Item</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SessionLensCard({
  onAction,
  session,
  state,
  tone,
}: {
  onAction: (action: AthleteCalendarAction) => void;
  session: AthleteCalendarDayDetailSession;
  state: AthleteCalendarLensState;
  tone: string;
}) {
  const status = resolveCalendarSessionStatus(session.status);
  const completed = status.lifecycle === 'completed' || state === 'completed';
  const attention = status.lifecycle === 'missed' || state === 'needs_attention';
  const accomplishment = session.accomplishment?.highestPriority;
  const bestSet = session.performance?.bestSet;
  return (
    <View style={styles.lensCard}>
      <View style={styles.lensCardHeader}>
        <View style={styles.flex}>
          <Text style={styles.lensCardTitle}>{session.title || 'Training Session'}</Text>
          <Text style={styles.lensMeta}>{trainingContextLabel(session)}</Text>
        </View>
        <Text style={[styles.lensCardStatus, { color: tone }]}>{status.label.toUpperCase()}</Text>
      </View>
      {attention ? (
        <View style={styles.attentionCopy}>
          <Ionicons color={SLColors.danger} name="alert-circle-outline" size={18} />
          <Text style={styles.lensBody}>{session.missedContext?.comment || session.missedContext?.reason || 'This Session still needs your attention.'}</Text>
        </View>
      ) : null}
      {completed ? (
        <>
          <View style={styles.metricGrid}>
            <Metric label="SETS" value={String(session.performance?.completedSets || 0)} />
            <Metric label="REPS" value={String(session.performance?.totalReps || 0)} />
            <Metric label="DURATION" value={session.performance?.actualDurationMinutes ? `${session.performance.actualDurationMinutes} min` : '—'} />
            <Metric label="SESSION RPE" value={formatNumber(session.reflection?.sessionRpe)} />
          </View>
          {bestSet ? (
            <EvidenceRow icon="barbell-outline" label="PERFORMANCE HIGHLIGHT" value={`${formatWeight(bestSet.weightKg)} × ${bestSet.reps}${bestSet.rpe ? ` @ RPE ${formatNumber(bestSet.rpe)}` : ''}`} />
          ) : null}
          {accomplishment ? (
            <EvidenceRow icon="trophy-outline" label="ACCOMPLISHMENT" value={accomplishmentLabel(accomplishment)} tone={SLColors.success} />
          ) : null}
          {reflectionCopy(session) ? <EvidenceRow icon="chatbubble-ellipses-outline" label="HOW YOU FELT" value={reflectionCopy(session)!} /> : null}
        </>
      ) : (
        <View style={styles.metricGrid}>
          <Metric label="MOVEMENTS" value={String(session.planned?.movementCount || session.primaryLifts?.length || 0)} />
          <Metric label="WORKING SETS" value={String(session.planned?.plannedSets || 0)} />
          <Metric label="EST. TIME" value={session.estimatedDurationMinutes ? `${session.estimatedDurationMinutes} min` : '—'} />
        </View>
      )}
      {session.programmingNotes ? <EvidenceRow icon="document-text-outline" label="COACH CONTEXT" value={session.programmingNotes} /> : null}
      <Pressable onPress={() => onAction({ type: 'session', id: session.id })} style={({ pressed }) => [styles.lensPrimaryButton, { borderColor: colorWithAlpha(tone, 0.65) }, pressed && styles.pressed]}>
        <Text style={[styles.lensPrimaryButtonText, { color: tone }]}>{sessionActionLabel(session, completed)}</Text>
        <Ionicons color={tone} name="chevron-forward" size={18} />
      </Pressable>
    </View>
  );
}

function RestLensCard({ detail, readiness }: { detail: AthleteCalendarDayDetail; readiness: AthleteCalendarReadiness | null }) {
  return (
    <View style={styles.lensCard}>
      <EvidenceRow icon="moon-outline" label="FOCUS" value="Recovery and mobility" />
      {detail.blockContext ? (
        <EvidenceRow
          icon="layers-outline"
          label="CURRENT BLOCK"
          value={`${detail.blockContext.name || 'Training Block'}${detail.blockContext.weekNumber ? ` · Week ${detail.blockContext.weekNumber}${detail.blockContext.totalWeeks ? ` of ${detail.blockContext.totalWeeks}` : ''}` : ''}`}
        />
      ) : null}
      <EvidenceRow icon="pulse-outline" label="READINESS" value={readiness ? readinessSummary(readiness) : 'Not submitted'} />
    </View>
  );
}

function PersonalLensCard({
  conflicts,
  event,
  onAction,
}: {
  conflicts: AthleteCalendarConflict[];
  event: AthleteCalendarPersonalEvent;
  onAction: (action: AthleteCalendarAction) => void;
}) {
  return (
    <Pressable onPress={() => onAction({ type: 'edit-event', event })} style={({ pressed }) => [styles.lensCard, styles.personalCard, pressed && styles.pressed]}>
      <View style={styles.lensCardHeader}>
        <View style={styles.flex}>
          <Text style={styles.lensCardTitle}>{event.title}</Text>
          <Text style={styles.lensMeta}>{event.location || event.category || 'Personal item'} · {event.allDay ? 'All Day' : eventTimeLabel(event)}</Text>
        </View>
        <Ionicons color={SLColors.info} name="calendar-outline" size={22} />
      </View>
      {conflicts.map((conflict) => (
        <Pressable key={conflict.id} onPress={() => onAction({ type: 'review-conflict', conflict })} style={styles.conflictCallout}>
          <Ionicons color={SLColors.warning} name="warning-outline" size={18} />
          <View style={styles.flex}><Text style={styles.conflictTitle}>Schedule impact</Text><Text style={styles.lensBody}>{conflict.workoutTitle} is also scheduled on this date.</Text></View>
          <Ionicons color={SLColors.textMuted} name="chevron-forward" size={17} />
        </Pressable>
      ))}
    </Pressable>
  );
}

function ReadinessCard({ readiness }: { readiness: AthleteCalendarReadiness }) {
  return (
    <View style={styles.compactContextCard}>
      <Ionicons color={SLColors.success} name="pulse-outline" size={22} />
      <View style={styles.flex}><Text style={styles.contextLabel}>READINESS</Text><Text style={styles.contextValue}>{readinessSummary(readiness)}</Text></View>
    </View>
  );
}

function NextUpCard({ nextUp, onAction }: { nextUp: AthleteCalendarSession; onAction: (action: AthleteCalendarAction) => void }) {
  return (
    <Pressable onPress={() => onAction({ type: 'session', id: nextUp.id })} style={({ pressed }) => [styles.compactContextCard, pressed && styles.pressed]}>
      <Ionicons color={SLColors.accentViolet} name="arrow-forward-circle-outline" size={22} />
      <View style={styles.flex}><Text style={styles.contextLabel}>NEXT UP</Text><Text style={styles.contextValue}>{nextUp.title || 'Training Session'} · {formatDayReference(nextUp.date)}</Text></View>
      <Ionicons color={SLColors.textMuted} name="chevron-forward" size={17} />
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

function EvidenceRow({ icon, label, tone = SLColors.accentViolet, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; tone?: string; value: string }) {
  return (
    <View style={styles.evidenceRow}>
      <View style={[styles.evidenceIcon, { borderColor: colorWithAlpha(tone, 0.5) }]}><Ionicons color={tone} name={icon} size={18} /></View>
      <View style={styles.flex}><Text style={[styles.evidenceLabel, { color: tone }]}>{label}</Text><Text style={styles.evidenceValue}>{value}</Text></View>
    </View>
  );
}

function MonthView({
  anchorMonth,
  data,
  onAction,
  onLoadMore,
  onSelectDate,
  selectedDate,
  onRefresh,
  refreshing,
  navigationRevision,
}: {
  anchorMonth: Date;
  data: AthleteCalendarExperienceData;
  onAction: (action: AthleteCalendarAction) => void;
  onLoadMore?: () => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
  onRefresh?: () => void;
  refreshing: boolean;
  navigationRevision: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const months = useMemo(() => {
    const latestLoadedDate = data.days.reduce<Date | null>((latest, day) => {
      const parsed = parseYmd(day.date);
      if (!parsed || parsed < anchorMonth) return latest;
      return !latest || parsed > latest ? parsed : latest;
    }, null);
    const minimumEndMonth = addMonths(anchorMonth, 1);
    const loadedEndMonth = latestLoadedDate
      ? new Date(latestLoadedDate.getFullYear(), latestLoadedDate.getMonth(), 1)
      : minimumEndMonth;
    const endMonth = loadedEndMonth > minimumEndMonth ? loadedEndMonth : minimumEndMonth;
    return monthsThrough(anchorMonth, endMonth);
  }, [anchorMonth, data.days]);
  useEffect(() => {
    if (navigationRevision > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [navigationRevision]);
  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.monthScrollContent}
      onMomentumScrollEnd={({ nativeEvent }) => {
        const remaining = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
        if (remaining < 240) onLoadMore?.();
      }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentMagenta} /> : undefined}
      showsVerticalScrollIndicator={false}
    >
      {months.map((month) => (
        <MonthSection
          data={data}
          key={`${month.getFullYear()}-${month.getMonth()}`}
          month={month}
          onAction={onAction}
          onSelectDate={onSelectDate}
          selectedDate={selectedDate}
        />
      ))}
      <View style={styles.bottomClearance} />
    </ScrollView>
  );
}

function MonthSection({
  data,
  month,
  onAction,
  onSelectDate,
  selectedDate,
}: {
  data: AthleteCalendarExperienceData;
  month: Date;
  onAction: (action: AthleteCalendarAction) => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
}) {
  const cells = useMemo(() => monthGrid(month), [month]);
  const dayByDate = useMemo(() => new Map(data.days.map((day) => [day.date, day])), [data.days]);
  const monthBlocks = useMemo(
    () => calendarTrainingRangesForMonth(data.ranges || [], month),
    [data.ranges, month],
  );
  const showProgramChapter = calendarProgramStartsInMonth(data.programContext, month);
  return (
    <View style={styles.monthSection}>
      <Text style={styles.monthHeading}>{month.toLocaleDateString(undefined, { month: 'long' })}</Text>
      {showProgramChapter && data.programContext ? (
        <ProgramChapterDivider program={data.programContext} />
      ) : null}
      {monthBlocks.length ? (
        <TrainingJourneyBar blocks={monthBlocks} today={data.today} />
      ) : null}
      <View style={styles.weekHeader}>{WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
      <View style={styles.monthGrid}>
        {cells.map((date) => {
          const ymd = toYmd(date);
          const day = dayByDate.get(ymd);
          const inMonth = date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
          const selected = ymd === selectedDate;
          const today = ymd === data.today || day?.isToday === true;
          const hasTrainingSession = Boolean(day?.sessions.length);
          const semanticTone = toneColor(primaryDayTone(day));
          const block = calendarTrainingRangeForDate(monthBlocks, ymd);
          const isCurrentBlock = Boolean(block && block.start <= data.today && block.end >= data.today);
          const blockAccent = isCurrentBlock
            ? SLMovementCardMaterial.stateAccent.in_progress
            : SLColors.accentViolet;
          if (!inMonth) {
            return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" key={ymd} style={styles.dayCell} />;
          }
          return (
            <Pressable
              key={ymd}
              onPress={() => onSelectDate(ymd)}
              style={({ pressed }) => [styles.dayCell, pressed && styles.pressed]}
            >
              {block ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.blockDayAtmosphere,
                    { backgroundColor: colorWithAlpha(blockAccent, isCurrentBlock ? 0.045 : 0.025) },
                  ]}
                />
              ) : null}
              {hasTrainingSession ? (
                <LinearGradient
                  colors={[
                    colorWithAlpha(SLMovementCardMaterial.stateAccent.in_progress, 0),
                    colorWithAlpha(SLMovementCardMaterial.stateAccent.in_progress, 0.035),
                    colorWithAlpha(SLMovementCardMaterial.stateAccent.in_progress, 0.2),
                  ]}
                  end={{ x: 0.5, y: 1 }}
                  locations={[0, 0.55, 1]}
                  pointerEvents="none"
                  start={{ x: 0.5, y: 0 }}
                  style={styles.sessionDayUnderglow}
                />
              ) : null}
              <View
                style={[
                  styles.dayNumberWrap,
                  today && styles.todayDay,
                  today && { borderColor: semanticTone },
                  selected && styles.selectedDay,
                  selected && { backgroundColor: semanticTone },
                ]}
              >
                <Text style={[styles.dayNumber, selected && styles.selectedDayNumber, today && !selected && { color: semanticTone, fontWeight: '700' }]}>{date.getDate()}</Text>
              </View>
              <DaySignals day={day} onAction={onAction} />
            </Pressable>
          );
        })}
      </View>
      <MonthSummary data={data} month={month} />
    </View>
  );
}

function TrainingJourneyBar({ blocks, today }: { blocks: AthleteCalendarRange[]; today: string }) {
  return (
    <View style={styles.journeyWrap}>
      <View style={styles.journeyHeader}>
        <Text style={styles.journeyEyebrow}>TRAINING JOURNEY</Text>
        <Text style={styles.journeyHint}>Your position in the current program</Text>
      </View>
      <View style={styles.journeyTrack}>
        {blocks.map((block) => {
          const isCurrent = block.start <= today && block.end >= today;
          const blockKind = isCurrent ? 'CURRENT BLOCK' : 'TRAINING BLOCK';
          return (
            <View key={`${block.id || block.label}:${block.start}`} style={[styles.journeySegment, isCurrent && styles.journeySegmentCurrent]}>
              <Text style={[styles.journeySegmentKind, isCurrent && styles.journeySegmentKindCurrent]}>{blockKind}</Text>
              <Text numberOfLines={1} style={[styles.journeySegmentName, isCurrent && styles.journeySegmentNameCurrent]}>{block.label}</Text>
              <Text style={styles.journeySegmentDate}>{formatCalendarStructureRange(block.start, block.end)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MonthSummary({ data, month }: { data: AthleteCalendarExperienceData; month: Date }) {
  const monthId = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const summary = data.monthSummaries?.find((candidate) => candidate.month === monthId);
  const indicator = resolveAthleteCalendarMonthIndicator(summary);
  return (
    <View style={styles.monthSummary}>
      <Text style={styles.monthSummaryEyebrow}>{month.toLocaleDateString(undefined, { month: 'long' }).toUpperCase()} SUMMARY</Text>
      <View style={styles.monthSummaryMetrics}>
        <Metric label="SCHEDULED" value={String(summary?.sessionCount ?? '—')} />
        <Metric label="DUE" value={String(summary?.dueCount ?? '—')} />
        <Metric label="COMPLETED DUE" value={String(summary?.dueCompletedCount ?? '—')} />
        <Metric label="FUTURE" value={String(summary?.upcomingCount ?? '—')} />
      </View>
      <View style={styles.completionHeader}><Text style={styles.completionLabel}>SESSION COMPLETION THROUGH TODAY</Text><Text style={styles.completionValue}>{indicator.primary}{indicator.percent ? ` · ${indicator.percent}` : ''}</Text></View>
      {summary?.dueCount ? <View style={styles.completionTrack}><View style={[styles.completionFill, { width: `${summary.completionPercent ?? 0}%` }]} /></View> : null}
    </View>
  );
}

function ProgramChapterDivider({ program }: { program: CalendarProgramContext }) {
  return (
    <View
      accessibilityLabel={`New Training Program: ${program.name || 'Training Program'}, ${formatCalendarStructureDate(program.start)}`}
      style={styles.programChapter}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0)', colorWithAlpha(SLColors.accentViolet, 0.38)]}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.programChapterRule}
      />
      <View style={styles.programChapterCopy}>
        <Text style={styles.programChapterEyebrow}>NEW TRAINING PROGRAM</Text>
        <Text numberOfLines={2} style={styles.programChapterName}>{program.name || 'Training Program'}</Text>
        <Text style={styles.programChapterDate}>{formatCalendarStructureDate(program.start)}</Text>
      </View>
      <LinearGradient
        colors={[colorWithAlpha(SLColors.accentViolet, 0.38), 'rgba(0,0,0,0)']}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.programChapterRule}
      />
    </View>
  );
}

function DaySignals({ day, onAction }: { day?: AthleteCalendarDay; onAction: (action: AthleteCalendarAction) => void }) {
  if (!day) return null;
  const signals = signalsForDay(day, onAction);
  if (!signals.length) return null;
  return (
    <View style={styles.signalStack}>
      {signals.slice(0, 2).map((signal) => (
        <Pressable key={signal.key} onPress={signal.onPress} style={[styles.signalBar, signalTone(signal.tone)]}>
          <Text numberOfLines={1} style={styles.signalText}>{signal.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SignalMarkers({ signals }: { signals: ReturnType<typeof signalsForDay> }) {
  return (
    <View style={styles.signalDots}>
      {signals.slice(0, 3).map((signal) => <View key={signal.key} style={[styles.signalDot, signalTone(signal.tone)]} />)}
      {signals.length > 3 ? <View accessibilityLabel={`${signals.length - 3} more events`} style={styles.signalOverflow} /> : null}
    </View>
  );
}

function signalsForDay(day: AthleteCalendarDay, onAction: (action: AthleteCalendarAction) => void) {
  return [
    ...day.sessions.map((session) => {
      const status = resolveCalendarSessionStatus(session.status);
      return {
        key: `s-${session.id}`,
        title: session.title || 'Training',
        tone: status.tone,
        onPress: () => onAction({ type: 'session', id: session.id }),
      };
    }),
    ...(day.personalEvents || []).map((event) => ({ key: `e-${event.id}`, title: event.title, tone: event.unavailableForTraining ? 'gold' : 'slate', onPress: () => onAction({ type: 'edit-event', event }) })),
    ...(day.meets || []).map((meet) => ({ key: `m-${meet.id}`, title: meet.name || 'Meet', tone: 'gold', onPress: () => onAction({ type: 'meet', id: meet.id }) })),
    ...(day.checkIns || []).map((checkIn) => ({ key: `c-${checkIn.id}`, title: checkIn.title || 'Check-in', tone: 'slate', onPress: () => onAction({ type: 'check-in', id: checkIn.id }) })),
  ];
}

function DayView({
  data,
  selectedDate,
  onAction,
  onDateChange,
  navigationRevision,
  reduceMotion,
}: {
  data: AthleteCalendarExperienceData;
  selectedDate: string;
  onAction: (action: AthleteCalendarAction) => void;
  onDateChange: (date: string) => void;
  navigationRevision: number;
  reduceMotion: boolean;
}) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const weekTranslateX = useRef(new Animated.Value(0)).current;
  const weekTransitionActiveRef = useRef(false);
  const selected = parseYmd(selectedDate) || new Date();
  const week = weekContaining(selected);
  const day = data.days.find((item) => item.date === selectedDate);
  const timed = timedItems(day, onAction);
  const allDay = allDayItems(day, data, onAction);
  const now = new Date();
  const timezone = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  const nowMinutes = clockMinutesInTimezone(now, timezone);
  const showNow = selectedDate === data.today && nowMinutes >= 6 * 60;
  const settleWeekSwipe = useCallback(() => {
    Animated.spring(weekTranslateX, {
      toValue: 0,
      damping: 24,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [weekTranslateX]);
  const transitionWeek = useCallback((direction: -1 | 1) => {
    if (weekTransitionActiveRef.current) return;
    weekTransitionActiveRef.current = true;

    const commitDate = () => {
      onDateChange(toYmd(addDays(selected, direction * 7)));
      void Haptics.selectionAsync();
    };
    if (reduceMotion) {
      commitDate();
      weekTranslateX.setValue(0);
      weekTransitionActiveRef.current = false;
      return;
    }

    const viewportWidth = Math.max(width, 1);
    const outgoingX = direction > 0 ? -viewportWidth : viewportWidth;
    const incomingX = -outgoingX;
    Animated.timing(weekTranslateX, {
      toValue: outgoingX,
      duration: 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        weekTransitionActiveRef.current = false;
        settleWeekSwipe();
        return;
      }
      commitDate();
      weekTranslateX.setValue(incomingX);
      requestAnimationFrame(() => {
        Animated.timing(weekTranslateX, {
          toValue: 0,
          duration: 190,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          weekTransitionActiveRef.current = false;
        });
      });
    });
  }, [onDateChange, reduceMotion, selected, settleWeekSwipe, weekTranslateX, width]);
  const weekSwipe = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-24, 24])
      .failOffsetY([-18, 18])
      .runOnJS(true)
      .onUpdate(({ translationX }) => {
        if (weekTransitionActiveRef.current || reduceMotion) return;
        const dragLimit = Math.max(width, 1) * 0.82;
        weekTranslateX.setValue(Math.max(-dragLimit, Math.min(dragLimit, translationX)));
      })
      .onEnd(({ translationX, velocityX }) => {
        if (Math.abs(translationX) < 56 && Math.abs(velocityX) < 500) {
          settleWeekSwipe();
          return;
        }
        transitionWeek(translationX < 0 ? 1 : -1);
      }),
    [reduceMotion, settleWeekSwipe, transitionWeek, weekTranslateX, width],
  );
  useEffect(() => {
    if (selectedDate !== data.today || navigationRevision <= 0) return;
    const offset = Math.max(0, (nowMinutes - 6 * 60) * 1.25 - 120);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: offset, animated: true }));
  }, [data.today, navigationRevision, nowMinutes, selectedDate]);
  return (
    <View style={styles.dayView}>
      <View style={styles.agendaDateNavigation}>
        <GestureDetector gesture={weekSwipe}>
          <Animated.View
            accessibilityHint="Swipe left or right to change weeks"
            style={[styles.agendaWeekRow, { transform: [{ translateX: weekTranslateX }] }]}
          >
            <View style={styles.weekHeader}>{WEEKDAYS.map((label, index) => <Text key={`${label}-${index}`} style={styles.weekday}>{label}</Text>)}</View>
            <View style={styles.weekStrip}>
              {week.map((date) => {
                const ymd = toYmd(date);
                const active = ymd === selectedDate;
                return (
                  <Pressable key={ymd} onPress={() => onDateChange(ymd)} style={styles.weekDate}>
                    <View style={[styles.dayNumberWrap, active && styles.selectedDay]}>
                      <Text style={[styles.weekDateText, active && styles.selectedDayNumber]}>{date.getDate()}</Text>
                    </View>
                    {data.days.find((item) => item.date === ymd) ? (
                      <SignalMarkers signals={signalsForDay(data.days.find((item) => item.date === ymd)!, onAction)} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </GestureDetector>
        <Text style={styles.dayTitle}>{selected.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.dayScrollContent} showsVerticalScrollIndicator={false}>
        {allDay.length ? (
          <View style={styles.allDayArea}>
            <Text style={styles.allDayLabel}>all-day</Text>
            <View style={styles.allDayRows}>
              {allDay.map((item) => (
                <Pressable key={item.key} onPress={item.onPress} style={[styles.allDayEvent, signalTone(item.tone)]}>
                  <Ionicons color={SLColors.textStrong} name="calendar-outline" size={14} />
                  <View style={styles.flex}>
                    <View style={styles.eventTitleRow}>
                      <Text numberOfLines={1} style={styles.allDayText}>{item.title}</Text>
                      {item.status ? <SessionStatusIndicator status={item.status} /> : null}
                    </View>
                    {item.meta ? <Text numberOfLines={1} style={styles.allDayMeta}>{item.meta}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.hourGrid}>
          {HOURS.map((hour) => (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{hourLabel(hour)}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}
          {layoutTimedItems(timed).map((item) => (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              style={[
                styles.timedEvent,
                item.tone === 'personal' ? styles.personalTimedEvent : styles.trainingTimedEvent,
                {
                  top: (item.startMinutes - 360) * 1.25,
                  height: Math.max(48, (item.endMinutes - item.startMinutes) * 1.25),
                  left: 78 + item.column * ((Math.max(280, width) - 84) / item.columnCount),
                  width: (Math.max(280, width) - 90) / item.columnCount,
                },
              ]}
            >
              <View style={styles.eventTitleRow}>
                <Text numberOfLines={1} style={styles.timedTitle}>{item.title}</Text>
                {item.status ? <SessionStatusIndicator compact status={item.status} /> : null}
              </View>
              {item.location ? <Text numberOfLines={1} style={styles.timedMeta}>⌾ {item.location}</Text> : null}
              <Text style={styles.timedMeta}>{item.durationMinutes ? `About ${item.durationMinutes} min` : 'Duration estimate unavailable'}</Text>
              <Text style={styles.timedMeta}>{formatMinutes(item.startMinutes)}–{formatMinutes(item.endMinutes)}</Text>
            </Pressable>
          ))}
          {showNow ? (
            <View style={[styles.nowLine, { top: Math.max(0, (nowMinutes - 360) * 1.25) }]}>
              <Text style={styles.nowLabel}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: timezone })}</Text>
              <View style={styles.nowRule} />
            </View>
          ) : null}
        </View>
        <View style={styles.bottomClearance} />
      </ScrollView>
    </View>
  );
}

function SessionStatusIndicator({
  compact = false,
  status,
}: {
  compact?: boolean;
  status: CalendarSessionStatusPresentation;
}) {
  return (
    <View accessibilityLabel={`Session status: ${status.label}`} style={styles.sessionStatus}>
      <View style={[styles.sessionStatusDot, signalTone(status.tone)]} />
      <Text numberOfLines={1} style={[styles.sessionStatusLabel, compact && styles.sessionStatusLabelCompact]}>
        {status.label}
      </Text>
    </View>
  );
}

function BottomControls({ bottomInset, onToday, onView, view }: { bottomInset: number; onToday: () => void; onView: () => void; view: CalendarView }) {
  return (
    <View pointerEvents="box-none" style={[styles.bottomControls, { bottom: 66 + bottomInset }]}>
      <SLTabRowControlShell density="utility">
        <SLTabRowControlItem accessibilityLabel="Today" label="Today" onPress={onToday} />
      </SLTabRowControlShell>
      <SLTabRowControlShell density="utility">
        <SLTabRowControlItem
          accessibilityLabel={view === 'day' ? 'Month view' : 'Day view'}
          icon={view === 'day' ? 'calendar-outline' : 'today-outline'}
          onPress={onView}
        />
      </SLTabRowControlShell>
    </View>
  );
}

type TimedLayoutItem = {
  key: string;
  title: string;
  location?: string | null;
  tone: 'training' | 'personal';
  startMinutes: number;
  endMinutes: number;
  durationMinutes?: number | null;
  status?: CalendarSessionStatusPresentation;
  column: number;
  columnCount: number;
  onPress: () => void;
};

function timedItems(day: AthleteCalendarDay | undefined, onAction: (action: AthleteCalendarAction) => void): TimedLayoutItem[] {
  if (!day) return [];
  return [
    ...day.sessions.filter((session) => session.scheduledStartTime).map((session) => ({
      key: `s-${session.id}`,
      title: session.title || 'Training Session',
      location: session.blockName,
      tone: 'training' as const,
      startMinutes: parseClock(session.scheduledStartTime) ?? 9 * 60,
      endMinutes: parseClock(session.scheduledEndTime) ?? ((parseClock(session.scheduledStartTime) ?? 9 * 60) + (session.estimatedDurationMinutes || 30)),
      durationMinutes: session.estimatedDurationMinutes,
      status: resolveCalendarSessionStatus(session.status),
      column: 0,
      columnCount: 1,
      onPress: () => onAction({ type: 'schedule-session', session }),
    })),
    ...(day.personalEvents || []).filter((event) => !event.allDay).map((event) => {
      const startMinutes = clockFromIso(event.startsAt);
      const endMinutes = clockFromIso(event.endsAt);
      return {
        key: `e-${event.id}`,
        title: event.title,
        location: event.location,
        tone: 'personal' as const,
        startMinutes,
        endMinutes: endMinutes > startMinutes ? endMinutes : startMinutes + 30,
        column: 0,
        columnCount: 1,
        onPress: () => onAction({ type: 'edit-event', event }),
      };
    }),
  ];
}

function layoutTimedItems(items: TimedLayoutItem[]) {
  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes);
  const groups: TimedLayoutItem[][] = [];
  for (const item of sorted) {
    const group = groups.find((candidate) => candidate.some((other) => item.startMinutes < other.endMinutes && item.endMinutes > other.startMinutes));
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups.flatMap((group) => group.map((item, column) => ({ ...item, column, columnCount: group.length })));
}

function allDayItems(
  day: AthleteCalendarDay | undefined,
  data: AthleteCalendarExperienceData,
  onAction: (action: AthleteCalendarAction) => void,
) {
  if (!day) return [];
  return [
    ...day.sessions.filter((session) => !session.scheduledStartTime).map((session) => {
      const status = resolveCalendarSessionStatus(session.status);
      return {
        key: `s-${session.id}`,
        title: session.title || 'Training Session',
        meta: [session.blockName, durationLabel(session)].filter(Boolean).join(' · '),
        status,
        tone: status.tone,
        onPress: () => onAction({ type: 'schedule-session', session }),
      };
    }),
    ...(day.personalEvents || []).filter((event) => event.allDay).map((event) => ({ key: `e-${event.id}`, title: event.title, meta: event.category || 'Personal event', tone: 'gold', status: undefined, onPress: () => onAction({ type: 'edit-event', event }) })),
    ...(day.meets || []).map((meet) => ({ key: `m-${meet.id}`, title: meet.name || 'Competition', meta: 'Meet', tone: 'gold', status: undefined, onPress: () => onAction({ type: 'meet', id: meet.id }) })),
    ...(data.ranges || []).filter((range) => day.date >= range.start && day.date <= range.end).map((range) => ({ key: `r-${range.id || range.label}`, title: range.label, meta: 'Training block', tone: 'slate', status: undefined, onPress: () => undefined })),
  ];
}

function signalTone(tone: string) {
  if (tone === 'pink') return styles.tonePink;
  if (tone === 'gold') return styles.toneGold;
  if (tone === 'green') return styles.toneGreen;
  if (tone === 'slate') return styles.toneSlate;
  if (tone === 'red') return styles.toneRed;
  return styles.toneViolet;
}

function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = new Date(last);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) days.push(new Date(cursor));
  return days;
}
function weekContaining(date: Date) { const start = new Date(date); start.setDate(date.getDate() - date.getDay()); return Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)); }
function addDays(date: Date, count: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count); }
function parseClock(value?: string | null) { if (!value) return null; const match = /^(\d{1,2}):(\d{2})/.exec(value); if (!match) return null; return Number(match[1]) * 60 + Number(match[2]); }
function formatMinutes(value: number) { const date = new Date(2026, 0, 1, Math.floor(value / 60), value % 60); return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function hourLabel(hour: number) {
  if (hour === 12) return 'Noon';
  if (hour === 24) return '12 AM';
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour > 12 ? hour - 12 : hour} ${suffix}`;
}
function monthShort(date: Date) { return date.toLocaleDateString(undefined, { month: 'long' }); }
function clockFromIso(value: string) {
  const match = /T(\d{2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}
function durationLabel(session: AthleteCalendarSession) {
  return session.estimatedDurationMinutes ? `About ${session.estimatedDurationMinutes} min` : 'Duration estimate unavailable';
}
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date: Date, count: number) { return new Date(date.getFullYear(), date.getMonth() + count, 1); }
function monthsThrough(start: Date, end: Date) {
  const count = Math.max(1, Math.min(18, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1));
  return Array.from({ length: count }, (_, index) => addMonths(start, index));
}
export function parseYmd(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) return null; const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])); return toYmd(date) === value ? date : null; }
export function toYmd(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function formatCalendarWeekRange(week: AthleteCalendarWeekSummary) { return `${shortDate(week.startDate)}–${shortDate(week.endDate)}`; }
export function calendarWeeksForMonth(weeks: AthleteCalendarWeekSummary[], month: Date) { const start = toYmd(new Date(month.getFullYear(), month.getMonth(), 1)); const end = toYmd(new Date(month.getFullYear(), month.getMonth() + 1, 0)); return weeks.filter((week) => week.endDate >= start && week.startDate <= end); }
function shortDate(value: string) { const date = parseYmd(value) || new Date(); return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function dayStateInput(day?: AthleteCalendarDay) {
  return {
    sessionStatuses: day?.sessions.map((session) => session.status) || [],
    personalItemCount: day?.personalEvents?.length || 0,
    checkInCount: day?.checkIns?.length || 0,
    meetCount: day?.meets?.length || 0,
  };
}
function dayMatchesFilter(day: AthleteCalendarDay, filter: CalendarFilter) {
  return calendarDayMatchesFilter(dayStateInput(day), filter);
}
function primaryDayTone(day?: AthleteCalendarDay): CalendarDayTone {
  return primaryCalendarDayTone(dayStateInput(day));
}
function fallbackDayDetail(
  data: AthleteCalendarExperienceData,
  date: string,
  canManagePersonalEvents: boolean,
): AthleteCalendarDayDetail {
  const day = data.days.find((candidate) => candidate.date === date);
  const sessions: AthleteCalendarDayDetailSession[] = (day?.sessions || []).map((session) => ({
    ...session,
    planned: {
      movementCount: (session.primaryLifts?.length || 0) + (session.accessoryCount || 0),
      movementLabels: session.primaryLifts || [],
      plannedSets: 0,
      label: session.plannedSummary || null,
    },
  }));
  const sortedFutureSessions = data.days
    .filter((candidate) => candidate.date > date)
    .flatMap((candidate) => candidate.sessions)
    .filter((session) => resolveCalendarSessionStatus(session.status).lifecycle !== 'canceled')
    .sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')));
  const block = calendarTrainingRangeForDate(data.ranges || [], date);
  return {
    date,
    timezone: data.timezone || null,
    isToday: date === data.today,
    state: resolveCalendarLensState(dayStateInput(day)),
    sessions,
    readiness: null,
    personalEvents: day?.personalEvents || [],
    conflicts: (data.conflicts || []).filter((conflict) => conflict.date === date),
    blockContext: block ? {
      id: Number(block.id) || 0,
      name: block.label,
      startDate: block.start,
      endDate: block.end,
    } : null,
    nextUp: sortedFutureSessions[0] || null,
    capabilities: { canAddPersonalItem: canManagePersonalEvents, canCreateSession: false },
  };
}
function toneColor(tone: CalendarDayTone) {
  if (tone === 'pink') return SLColors.accentMagenta;
  if (tone === 'gold') return SLColors.warning;
  if (tone === 'green') return SLColors.success;
  if (tone === 'red') return SLColors.danger;
  if (tone === 'slate') return SLColors.info;
  return SLColors.accentViolet;
}
function lensTone(state: AthleteCalendarLensState) {
  if (state === 'needs_attention') return SLColors.danger;
  if (state === 'in_progress') return SLColors.warning;
  if (state === 'completed') return SLColors.success;
  if (state === 'personal') return SLColors.info;
  if (state === 'rest') return SLColors.textMuted;
  return SLColors.accentViolet;
}
function lensStateLabel(state: AthleteCalendarLensState, isToday?: boolean) {
  if (state === 'needs_attention') return 'Needs Attention';
  if (state === 'in_progress') return 'Session In Progress';
  if (state === 'completed') return 'Completed Day';
  if (state === 'personal') return 'Personal Schedule';
  if (state === 'rest') return 'Rest Day';
  return isToday ? "Today's Training" : 'Planned Training';
}
function lensStateBadge(state: AthleteCalendarLensState) {
  if (state === 'needs_attention') return 'ATTENTION';
  if (state === 'in_progress') return 'IN PROGRESS';
  if (state === 'completed') return 'COMPLETE';
  if (state === 'personal') return 'PERSONAL';
  if (state === 'rest') return 'RECOVERY';
  return 'ASSIGNED';
}
function trainingContextLabel(session: AthleteCalendarDayDetailSession) {
  return [
    session.blockName,
    session.planned?.label || session.plannedSummary,
    session.planned?.movementLabels?.length ? session.planned.movementLabels.join(' + ') : null,
  ].filter(Boolean).join(' · ') || 'Training Session';
}
function formatNumber(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
function formatWeight(value?: number | null) {
  return value === null || value === undefined ? '—' : `${formatNumber(value)} kg`;
}
function accomplishmentLabel(accomplishment: NonNullable<AthleteCalendarAccomplishment['highestPriority']>) {
  const label = String(accomplishment.eventType || 'personal record')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
  const evidence = accomplishment.currentValue === null || accomplishment.currentValue === undefined
    ? null
    : `${formatNumber(accomplishment.currentValue)}${accomplishment.unit ? ` ${accomplishment.unit}` : ''}`;
  return [accomplishment.movementLabel, label, evidence].filter(Boolean).join(' · ');
}
function reflectionCopy(session: AthleteCalendarDayDetailSession) {
  const reflection = session.reflection;
  if (!reflection) return '';
  return [reflection.strength, reflection.fatigue, reflection.note].filter(Boolean).join(' · ');
}
function sessionActionLabel(session: AthleteCalendarDayDetailSession, completed: boolean) {
  if (completed) return 'View Recap';
  const lifecycle = resolveCalendarSessionStatus(session.status).lifecycle;
  if (lifecycle === 'in_progress') return 'Resume Session';
  if (lifecycle === 'missed') return 'Review Session';
  return 'Begin Session';
}
function readinessSummary(readiness: AthleteCalendarReadiness) {
  const values = [
    readiness.score != null ? `${formatNumber(readiness.score)}/10` : null,
    readiness.energy != null ? `Energy ${formatNumber(readiness.energy)}` : null,
    readiness.soreness != null ? `Soreness ${formatNumber(readiness.soreness)}` : null,
  ].filter(Boolean);
  return values.join(' · ') || 'Submitted';
}
function eventTimeLabel(event: AthleteCalendarPersonalEvent) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Time unavailable';
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
function formatDayReference(value?: string | null) {
  const date = value ? parseYmd(value) : null;
  return date ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Upcoming';
}
function colorWithAlpha(color: string, alpha: number) {
  const normalized = color.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((character) => `${character}${character}`).join('')
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  body: { flex: 1, width: '100%', paddingTop: SL_TAB_ROW_CONTROL.itemSize },
  toolbar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, minHeight: SL_TAB_ROW_CONTROL.itemSize, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SLLayout.screenGutter },
  toolbarPeriodLabel: { paddingHorizontal: SLSpacing.xs },
  searchRow: { position: 'absolute', top: SL_TAB_ROW_CONTROL.itemSize + SLSpacing.xs, left: SLLayout.screenGutter, right: SLLayout.screenGutter, zIndex: 31, height: 48, borderRadius: 24, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: 'rgba(18,14,23,0.96)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, color: SLColors.textStrong, fontSize: 17 },
  v2ScrollContent: { width: '100%', paddingTop: SLSpacing.sm },
  filterRow: { paddingHorizontal: SLLayout.screenGutter, paddingBottom: SLSpacing.sm, gap: SLSpacing.sm },
  filterChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset, paddingHorizontal: SLSpacing.lg, alignItems: 'center', justifyContent: 'center' },
  filterChipSelected: { backgroundColor: SLColors.surfaceSelected, borderColor: SLColors.borderSelected },
  filterChipText: { ...SLTypography.chipLabel, color: SLColors.textMuted },
  filterChipTextSelected: { color: SLColors.textStrong },
  focusedWeekSection: { marginBottom: SLSpacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat, padding: SLSpacing.md, gap: SLSpacing.sm },
  focusedWeekTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong, textAlign: 'center' },
  focusedWeekStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  focusedWeekDay: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4 },
  focusedWeekWeekday: { ...SLTypography.micro, color: SLColors.textMuted, fontWeight: '700' },
  focusedWeekNumber: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  focusedWeekNumberSelected: { backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected },
  focusedWeekNumberText: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  focusedWeekMarker: { width: 6, height: 6, borderRadius: 3 },
  lensHandleButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 5 },
  lensHandle: { width: 54, height: 5, borderRadius: 3, backgroundColor: SLColors.borderStrong },
  lensHandleLabel: { ...SLTypography.micro, color: SLColors.textMuted, fontWeight: '700', letterSpacing: 0.8 },
  trainingLens: { position: 'relative', overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat, padding: SLSpacing.lg, gap: SLSpacing.md },
  lensDateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.md },
  lensEyebrow: { ...SLTypography.label, fontWeight: '700', letterSpacing: 0.8 },
  lensStateTitle: { ...SLTypography.sectionTitle, color: SLColors.textStrong, marginTop: 2 },
  lensStateBadge: { minHeight: 28, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  lensStateDot: { width: 6, height: 6, borderRadius: 3 },
  lensStateBadgeText: { ...SLTypography.micro, fontWeight: '700', letterSpacing: 0.5 },
  lensLoading: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SLSpacing.md },
  lensMuted: { ...SLTypography.rowMeta, color: SLColors.textMuted },
  lensError: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.md, borderRadius: 14, borderWidth: 1, borderColor: colorWithAlpha(SLColors.danger, 0.35), backgroundColor: SLColors.dangerSoft, padding: SLSpacing.md },
  lensCard: { borderRadius: 18, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset, padding: SLSpacing.md, gap: SLSpacing.md },
  lensCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.md },
  lensCardTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong },
  lensMeta: { ...SLTypography.rowMeta, color: SLColors.textMuted, marginTop: 2 },
  lensCardStatus: { ...SLTypography.micro, fontWeight: '700', letterSpacing: 0.45 },
  attentionCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.sm, borderRadius: 12, backgroundColor: SLColors.dangerSoft, padding: SLSpacing.md },
  lensBody: { ...SLTypography.body, color: SLColors.textSecondary, flex: 1 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLSpacing.sm },
  metric: { minWidth: '22%', flexGrow: 1, borderRadius: 12, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceFlat, paddingHorizontal: SLSpacing.sm, paddingVertical: SLSpacing.md, gap: 3 },
  metricLabel: { ...SLTypography.micro, color: SLColors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { ...SLTypography.metricValue, color: SLColors.textStrong },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: SLSpacing.md },
  evidenceIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceFlat },
  evidenceLabel: { ...SLTypography.micro, fontWeight: '700', letterSpacing: 0.6 },
  evidenceValue: { ...SLTypography.body, color: SLColors.textSecondary, marginTop: 2 },
  lensPrimaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SLSpacing.lg },
  lensPrimaryButtonText: { ...SLTypography.buttonLabel, fontWeight: '700' },
  personalCard: { borderColor: colorWithAlpha(SLColors.info, 0.45) },
  conflictCallout: { flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, borderRadius: 12, borderWidth: 1, borderColor: colorWithAlpha(SLColors.warning, 0.35), backgroundColor: SLColors.warningSoft, padding: SLSpacing.md },
  conflictTitle: { ...SLTypography.bodyStrong, color: SLColors.warning },
  compactContextCard: { minHeight: 62, borderRadius: 16, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.md, padding: SLSpacing.md },
  contextLabel: { ...SLTypography.micro, color: SLColors.textMuted, fontWeight: '700', letterSpacing: 0.6 },
  contextValue: { ...SLTypography.bodyStrong, color: SLColors.textStrong, marginTop: 2 },
  quickAddActions: { flexDirection: 'row', alignItems: 'stretch', gap: SLSpacing.sm },
  quickAddButton: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: SLColors.surfaceSelected, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SLSpacing.sm },
  quickAddButtonFlexible: { flex: 1, paddingHorizontal: SLSpacing.sm },
  quickAddText: { ...SLTypography.buttonLabel, color: SLColors.accentMuted, fontWeight: '700' },
  v2BottomClearance: { height: SLLayout.bottomActionClearance + SLSpacing.xxl },
  monthScrollContent: { width: '100%' },
  monthSection: { width: '100%', marginBottom: 10 },
  monthHeading: { fontSize: 40, lineHeight: 46, fontWeight: '700', color: SLColors.textStrong, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  journeyWrap: { marginBottom: SLSpacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset, padding: SLSpacing.md, gap: SLSpacing.sm },
  journeyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.md },
  journeyEyebrow: { ...SLTypography.micro, color: SLColors.accentViolet, fontWeight: '700', letterSpacing: 0.65 },
  journeyHint: { ...SLTypography.micro, color: SLColors.textMuted },
  journeyTrack: { flexDirection: 'row', overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: SLColors.borderSubtle },
  journeySegment: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceFlat, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderSubtle, paddingHorizontal: 5 },
  journeySegmentCurrent: { backgroundColor: SLColors.surfaceSelected },
  journeySegmentKind: { fontSize: 7, lineHeight: 9, color: SLColors.textSubtle, fontWeight: '700', letterSpacing: 0.35, marginBottom: 2 },
  journeySegmentKindCurrent: { color: SLColors.accentViolet },
  journeySegmentName: { ...SLTypography.micro, color: SLColors.textMuted, fontWeight: '700' },
  journeySegmentNameCurrent: { color: SLColors.textStrong },
  journeySegmentDate: { fontSize: 8, lineHeight: 10, color: SLColors.textSubtle, marginTop: 2 },
  programChapter: { width: '100%', minHeight: 60, paddingHorizontal: SLLayout.screenGutter, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  programChapterRule: { flex: 1, height: StyleSheet.hairlineWidth },
  programChapterCopy: { maxWidth: '62%', alignItems: 'center', gap: 1 },
  programChapterEyebrow: { ...SLTypography.micro, color: SLColors.accentViolet, fontWeight: '700', letterSpacing: 0.65, textAlign: 'center' },
  programChapterName: { ...SLTypography.caption, color: SLColors.textStrong, fontWeight: '700', textAlign: 'center' },
  programChapterDate: { ...SLTypography.micro, color: SLColors.textMuted, textAlign: 'center' },
  trainingStructureContext: { width: '100%', paddingHorizontal: SLLayout.screenGutter, paddingBottom: 8, gap: 4 },
  blockContextRow: { minHeight: 31, width: '100%', alignItems: 'center', justifyContent: 'center' },
  blockContextCopy: { alignItems: 'center' },
  blockContextIdentity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  blockContextDot: { width: 4, height: 4, borderRadius: 2 },
  blockContextKind: { ...SLTypography.micro, fontWeight: '700', letterSpacing: 0.5 },
  blockContextName: { ...SLTypography.micro, color: SLColors.textSecondary, fontWeight: '700', letterSpacing: 0.35 },
  blockContextRange: { ...SLTypography.micro, color: SLColors.textSecondary, textAlign: 'center', marginTop: 1 },
  weekHeader: { width: '100%', flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderStandard },
  weekday: { width: `${100 / 7}%`, paddingVertical: 8, textAlign: 'center', fontSize: 13, color: SLColors.textSecondary },
  monthGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, minHeight: 88, alignItems: 'center', paddingTop: 9, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderStandard },
  blockDayAtmosphere: { ...StyleSheet.absoluteFillObject },
  sessionDayUnderglow: { position: 'absolute', bottom: 0, left: 2, right: 2, height: 58 },
  dayNumberWrap: { minWidth: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  todayDay: { borderWidth: 2, backgroundColor: SLColors.surfaceInset },
  selectedDay: { backgroundColor: SLColors.accentMagenta, shadowColor: SLColors.accentViolet, shadowOpacity: 0.48, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  dayNumber: { fontSize: 22, color: SLColors.textStrong },
  selectedDayNumber: { color: SLColors.white, fontWeight: '700' },
  signalDots: { height: 18, flexDirection: 'row', alignItems: 'center', gap: 4 },
  signalDot: { width: 7, height: 7, borderRadius: 4 },
  signalOverflow: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: SLColors.textMuted },
  signalStack: { width: '76%', gap: 3, marginTop: 2 },
  signalBar: { minHeight: 7, borderRadius: 5, justifyContent: 'center', paddingHorizontal: 4 },
  signalText: { fontSize: 8, lineHeight: 10, color: SLColors.textStrong },
  monthSummary: { marginHorizontal: SLLayout.screenGutter, marginTop: SLSpacing.lg, borderRadius: 18, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat, padding: SLSpacing.lg, gap: SLSpacing.md },
  monthSummaryEyebrow: { ...SLTypography.label, color: SLColors.accentViolet, fontWeight: '700', letterSpacing: 0.7 },
  monthSummaryMetrics: { flexDirection: 'row', gap: SLSpacing.sm },
  completionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completionLabel: { ...SLTypography.micro, color: SLColors.textMuted, fontWeight: '700' },
  completionValue: { ...SLTypography.caption, color: SLColors.textStrong, fontWeight: '700' },
  completionTrack: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: SLColors.surfaceInset },
  completionFill: { height: '100%', borderRadius: 4, backgroundColor: SLColors.success },
  toneViolet: { backgroundColor: SLColors.accentViolet },
  tonePink: { backgroundColor: SLColors.accentMagenta },
  toneGold: { backgroundColor: SLColors.warning },
  toneGreen: { backgroundColor: SLColors.success },
  toneRed: { backgroundColor: SLColors.danger },
  toneSlate: { backgroundColor: SLColors.info },
  weekStrip: { minHeight: 64, width: '100%', flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderStandard },
  agendaDateNavigation: { width: '100%' },
  weekDate: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingTop: 3 },
  weekDateText: { fontSize: 21, color: SLColors.textStrong },
  dayView: { flex: 1, width: '100%', overflow: 'hidden' },
  agendaWeekRow: { width: '100%' },
  dayTitle: { fontSize: 20, fontWeight: '600', color: SLColors.textStrong, textAlign: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderStandard },
  dayScrollContent: { width: '100%' },
  allDayArea: { minHeight: 66, flexDirection: 'row', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderStandard },
  allDayLabel: { width: 72, fontSize: 15, textAlign: 'right', paddingRight: 10, paddingTop: 7, color: SLColors.textMuted },
  allDayRows: { flex: 1, gap: 4, paddingRight: 6 },
  allDayEvent: { minHeight: 34, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4 },
  allDayText: { flex: 1, fontSize: 14, fontWeight: '600', color: SLColors.textStrong },
  allDayMeta: { fontSize: 11, color: SLColors.textSecondary, marginTop: 1 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, minWidth: 0 },
  hourGrid: { height: 1425, width: '100%', position: 'relative' },
  hourRow: { height: 75, flexDirection: 'row', alignItems: 'flex-start' },
  hourLabel: { width: 74, paddingTop: 7, paddingRight: 8, textAlign: 'right', fontSize: 15, color: SLColors.textMuted },
  hourLine: { flex: 1, marginTop: 16, height: StyleSheet.hairlineWidth, backgroundColor: SLColors.borderStandard },
  timedEvent: { position: 'absolute', borderRadius: 8, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, overflow: 'hidden' },
  trainingTimedEvent: { backgroundColor: '#481250', borderColor: SLColors.accentMagenta },
  personalTimedEvent: { backgroundColor: '#671C0E', borderColor: SLColors.accentOrange },
  timedTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: SLColors.textStrong },
  timedMeta: { fontSize: 12, color: SLColors.textSecondary, marginTop: 2 },
  nowLine: { position: 'absolute', left: 40, right: 0, flexDirection: 'row', alignItems: 'center' },
  nowLabel: { borderRadius: 11, backgroundColor: SLColors.accentMagenta, color: SLColors.white, fontSize: 12, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2 },
  nowRule: { flex: 1, height: 2, backgroundColor: SLColors.accentMagenta },
  sessionStatus: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: SLSpacing.xs, marginTop: 4 },
  sessionStatusDot: { width: 6, height: 6, borderRadius: 3 },
  sessionStatusLabel: { ...SLTypography.micro, color: SLColors.textSecondary, fontWeight: '700' },
  sessionStatusLabelCompact: { fontSize: 9, lineHeight: 11 },
  bottomControls: { position: 'absolute', right: 0, zIndex: 20, alignItems: 'flex-end', gap: SLSpacing.sm, paddingRight: SLLayout.screenGutter },
  paginationSpinner: { position: 'absolute', bottom: 78, alignSelf: 'center' },
  paginationError: { position: 'absolute', bottom: 78, alignSelf: 'center', borderRadius: 16, backgroundColor: SLColors.dangerSoft, paddingHorizontal: 14, paddingVertical: 9 },
  paginationErrorText: { fontSize: 13, color: SLColors.danger },
  bottomClearance: { height: SLSpacing.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
});
