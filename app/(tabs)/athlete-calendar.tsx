import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { simplifyMobileMovementText } from '@/lib/mobileMovementNames';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';

type CalendarSession = {
  workout_id: number;
  title?: string | null;
  date?: string | null;
  status?: string | null;
  block_id?: number | null;
  block_name?: string | null;
  planned_summary?: string | null;
  primary_lifts?: string[];
  accessory_count?: number | null;
};

type CalendarMeet = {
  meet_plan_id: number;
  name?: string | null;
  date?: string | null;
  days_until?: number | null;
  status?: string | null;
};

type CalendarCheckIn = {
  submission_id: number;
  title?: string | null;
  description?: string | null;
  due_at?: string | null;
  local_due_time?: string | null;
  submitted_at?: string | null;
  status?: 'due' | 'late' | 'submitted' | string | null;
};

type BlockMarker = {
  kind?: 'block_start' | 'block_end' | string;
  label?: string | null;
  block_id?: number | null;
};

type CalendarDay = {
  date: string;
  is_today?: boolean | null;
  training_status?: 'rest' | 'assigned' | 'in_progress' | 'completed' | 'missed' | 'incomplete' | 'mixed' | string | null;
  sessions?: CalendarSession[];
  check_ins?: CalendarCheckIn[];
  meets?: CalendarMeet[];
  reminders?: unknown[];
  block_markers?: BlockMarker[];
};

type UpcomingItem = {
  date?: string | null;
  kind?: 'session' | 'meet' | 'block_marker' | string | null;
  title?: string | null;
  subtitle?: string | null;
  route?: string | null;
  workout_id?: number | null;
  meet_plan_id?: number | null;
  submission_id?: number | null;
  block_id?: number | null;
  status?: string | null;
};

type AthleteCalendarPayload = {
  range?: {
    start_date?: string | null;
    end_date?: string | null;
    timezone?: string | null;
  } | null;
  today?: string | null;
  block_pacing?: {
    block_id?: number | null;
    name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    week_number?: number | null;
    total_weeks?: number | null;
    week_label?: string | null;
    sessions_completed_this_week?: number | null;
    sessions_total_this_week?: number | null;
  } | null;
  meet_countdown?: CalendarMeet | null;
  days?: CalendarDay[];
  upcoming?: UpcomingItem[];
  can_edit_programming?: boolean;
};

const colors = {
  text: '#ECE5DA',
  textStrong: '#F9FAFB',
  muted: '#B8ACA1',
  subtle: '#82766D',
  line: 'rgba(222, 198, 166, 0.10)',
  lineSoft: 'rgba(222, 198, 166, 0.055)',
  surface: 'rgba(20, 14, 13, 0.30)',
  surfaceStrong: 'rgba(24, 16, 15, 0.48)',
  violet: SLColors.accentViolet,
  violetSoft: 'rgba(167, 139, 250, 0.16)',
  green: '#A7CBB5',
  amber: '#D6A75E',
  red: '#E88989',
  plum: 'rgba(72, 39, 61, 0.24)',
};

export default function AthleteCalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isIndividual =
    user?.workspace_mode === 'individual' ||
      user?.is_individual_workspace === true ||
      user?.is_self_coached === true;
  const [anchorMonth, setAnchorMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));
  const [payload, setPayload] = useState<AthleteCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const canEditProgramming = user?.role === 'coach' && payload?.can_edit_programming !== false;

  const range = useMemo(() => monthGridRange(anchorMonth), [anchorMonth]);
  const daysByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    (payload?.days || []).forEach((day) => map.set(day.date, day));
    return map;
  }, [payload?.days]);
  const gridDays = useMemo(() => buildDateRange(range.start, range.end), [range.end, range.start]);
  const selectedDayRaw = daysByDate.get(selectedDate) || { date: selectedDate, training_status: 'rest', sessions: [], meets: [], block_markers: [] };
  const selectedDay = useMemo(
    () => isIndividual ? { ...selectedDayRaw, check_ins: [] } : selectedDayRaw,
    [isIndividual, selectedDayRaw]
  );
  const upcomingItems = useMemo(
    () => (payload?.upcoming || []).filter((item) => !isIndividual || item.route !== 'check_in'),
    [isIndividual, payload?.upcoming]
  );
  const blockRange = useMemo(() => {
    const start = parseDate(payload?.block_pacing?.start_date);
    const end = parseDate(payload?.block_pacing?.end_date);
    return start && end ? { start: toYMD(start), end: toYMD(end) } : null;
  }, [payload?.block_pacing?.end_date, payload?.block_pacing?.start_date]);

  const loadCalendar = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      start: toYMD(range.start),
      end: toYMD(range.end),
    });

    try {
      const resp = await fetchJson(`/athletes/mobile/calendar?${query.toString()}`, { method: 'GET' });
      const json = resp.json;
      if (!resp.ok || !json?.ok) {
        setPayload(null);
        setError(json?.error || `Calendar could not load. (${resp.status})`);
        return;
      }
      setPayload(json.athlete_calendar || null);
      if (json.athlete_calendar?.today && isSameMonth(parseDate(json.athlete_calendar.today), anchorMonth)) {
        setSelectedDate((current) => current || json.athlete_calendar.today);
      }
    } catch (err: any) {
      setPayload(null);
      setError(err?.message || 'Calendar could not load.');
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [anchorMonth, range.end, range.start]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const goToday = () => {
    const today = payload?.today || toYMD(new Date());
    const todayDate = parseDate(today) || new Date();
    setAnchorMonth(startOfMonth(todayDate));
    setSelectedDate(today);
  };

  const openSessionLogger = (session?: CalendarSession | null) => {
    if (!session?.workout_id) return;
    router.push({
      pathname: '/workout/[workoutId]',
      params: { workoutId: String(session.workout_id) },
    });
  };

  const openSessionWorkspace = (session?: CalendarSession | null) => {
    if (!session?.workout_id) return;
    if (!canEditProgramming) {
      openSessionLogger(session);
      return;
    }
    router.push({
      pathname: '/workout/session-workspace/[workoutId]' as any,
      params: { workoutId: String(session.workout_id) },
    });
  };

  const openSessionSummary = openSessionLogger;

  const openMeet = () => {
    router.push('/(tabs)/athlete-meet-plan' as any);
  };

  const openCheckIn = (checkIn?: CalendarCheckIn | UpcomingItem | null) => {
    if (!checkIn?.submission_id) return;
    router.push({
      pathname: '/(tabs)/check-in/[submissionId]',
      params: { submissionId: String(checkIn.submission_id), returnTo: 'calendar' },
    } as any);
  };

  const openCreateSession = () => {
    if (!isIndividual) return;
    router.push({
      pathname: '/create-workout',
      params: { date: selectedDate },
    } as any);
  };

  const openUpcoming = (item: UpcomingItem) => {
    if (item.route === 'workout' && item.workout_id) {
      router.push({
        pathname: '/workout/[workoutId]',
        params: { workoutId: String(item.workout_id) },
      });
      return;
    }
    if (item.route === 'meet') {
      openMeet();
      return;
    }
    if (item.route === 'check_in') {
      if (isIndividual) return;
      openCheckIn(item);
      return;
    }
    if (item.route === 'block') {
      router.push('/(tabs)/workout/block-details' as any);
    }
  };

  if (loading && !refreshing && !payload) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.violet} />
        <Text style={styles.stateTitle}>Loading Calendar</Text>
      </View>
    );
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCalendar({ silent: true })} tintColor={colors.violet} />}
      contentContainerStyle={styles.scroll}
    >
      <MonthHeader
        anchorMonth={anchorMonth}
        onPrev={() => setAnchorMonth(addMonths(anchorMonth, -1))}
        onNext={() => setAnchorMonth(addMonths(anchorMonth, 1))}
        onToday={goToday}
      />

      {error ? (
        <View style={styles.stateLine}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
          <Text style={styles.stateBody}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.calendarZone}>
        <View style={styles.weekHeader}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <Text key={day} style={styles.weekHeaderText}>{day}</Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {gridDays.map((date) => {
            const ymd = toYMD(date);
            const day = daysByDate.get(ymd);
            const inMonth = date.getMonth() === anchorMonth.getMonth();
            const inBlockRange = !!blockRange && ymd >= blockRange.start && ymd <= blockRange.end;
            return (
              <DayCell
                key={ymd}
                date={date}
                day={day}
                hideCheckIns={isIndividual}
                inMonth={inMonth}
                selected={ymd === selectedDate}
                inBlockRange={inBlockRange}
                blockStart={!!blockRange && ymd === blockRange.start}
                blockEnd={!!blockRange && ymd === blockRange.end}
                onPress={() => setSelectedDate(ymd)}
              />
            );
          })}
        </View>
        <CalendarLegend hasBlockRange={!!blockRange} hasMeet={!!payload?.meet_countdown} hideCheckIns={isIndividual} />
      </View>

      <SelectedDayTray
        day={selectedDay}
        canCreateSession={isIndividual}
        onCreateSession={openCreateSession}
        onOpenCheckIn={openCheckIn}
        onOpenMeet={openMeet}
        onOpenSession={openSessionLogger}
        onEditSession={openSessionWorkspace}
        canEditProgramming={canEditProgramming}
        onOpenSessionSummary={openSessionSummary}
      />

      <View style={styles.upcomingSummaryHeader}>
        <Text style={styles.upcomingTitle}>Upcoming</Text>
        <Pressable
          onPress={() => setUpcomingExpanded((value) => !value)}
          style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}
        >
          <Text style={styles.viewAllText}>{upcomingExpanded ? 'Collapse' : 'View All'}</Text>
        </Pressable>
      </View>
      {upcomingExpanded ? <UpcomingTimeline items={upcomingItems} onOpen={openUpcoming} /> : null}
    </ScrollView>
  );
}

function MonthHeader({
  anchorMonth,
  onPrev,
  onNext,
  onToday,
}: {
  anchorMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <View style={styles.monthHeader}>
      <Pressable onPress={onToday} style={({ pressed }) => [styles.monthLabelButton, pressed && styles.pressed]}>
        <Text style={styles.monthTitle}>{monthLabel(anchorMonth)}</Text>
      </Pressable>
      <View style={styles.monthArrowGroup}>
        <Pressable onPress={onPrev} style={({ pressed }) => [styles.monthArrow, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={20} color={colors.textStrong} />
        </Pressable>
        <Pressable onPress={onNext} style={({ pressed }) => [styles.monthArrow, pressed && styles.pressed]}>
          <Ionicons name="chevron-forward" size={20} color={colors.textStrong} />
        </Pressable>
      </View>
    </View>
  );
}

function ContextStrip({ payload }: { payload: AthleteCalendarPayload | null }) {
  const meet = payload?.meet_countdown;
  const block = payload?.block_pacing;
  if (!meet && !block) {
    return null;
  }
  const blockLine = block
    ? [
        block.week_label || (block.week_number ? `Week ${block.week_number}` : null),
        block.total_weeks && block.week_number ? `${block.week_number}/${block.total_weeks}` : null,
        `${Number(block.sessions_completed_this_week || 0)} of ${Number(block.sessions_total_this_week || 0)} this week`,
      ].filter(Boolean).join(' · ')
    : null;
  return (
    <View style={styles.contextStrip}>
      <View style={styles.contextRail} />
      <View style={styles.contextBody}>
        {meet ? (
          <View style={styles.contextLine}>
            <Ionicons name="flag-outline" size={16} color={colors.violet} />
            <Text style={styles.contextText} numberOfLines={1}>
              {meet.days_until === 0 ? 'Meet day' : `${meet.name || 'Meet'} · ${meet.days_until} days out`}
            </Text>
          </View>
        ) : null}
        {block ? (
          <View style={styles.contextLine}>
            <Ionicons name="trail-sign-outline" size={16} color={colors.amber} />
            <Text style={styles.contextText} numberOfLines={1}>
              {block.name || 'Current block'}{blockLine ? ` · ${blockLine}` : ''}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DayCell({
  date,
  day,
  hideCheckIns,
  inMonth,
  selected,
  inBlockRange,
  blockStart,
  blockEnd,
  onPress,
}: {
  date: Date;
  day?: CalendarDay;
  hideCheckIns?: boolean;
  inMonth: boolean;
  selected: boolean;
  inBlockRange: boolean;
  blockStart: boolean;
  blockEnd: boolean;
  onPress: () => void;
}) {
  const status = day?.training_status || 'rest';
  const tone = toneForDay(status, !!day?.meets?.length, !!day?.block_markers?.length, !hideCheckIns && !!day?.check_ins?.length);
  const hasSessionCount = Number(day?.sessions?.length || 0);
  const markerLabel = hasSessionCount > 1 ? String(hasSessionCount) : '';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayCell,
        inBlockRange && inMonth && styles.dayCellInBlock,
        blockStart && inMonth && styles.dayCellBlockStart,
        blockEnd && inMonth && styles.dayCellBlockEnd,
        !inMonth && styles.dayCellFaded,
        day?.is_today && styles.dayCellToday,
        selected && styles.dayCellSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.dayNumber, !inMonth && styles.dayTextFaded, selected && styles.dayNumberSelected]}>{date.getDate()}</Text>
      <View style={styles.markerRow}>
        {status !== 'rest' || hasSessionCount ? (
          <View style={[styles.dayMarker, hasSessionCount > 1 && styles.dayMarkerCount, { backgroundColor: tone }]}>
            {markerLabel ? <Text style={styles.dayMarkerCountText}>{markerLabel}</Text> : null}
          </View>
        ) : <View style={styles.restMarker} />}
        {!hideCheckIns && day?.check_ins?.length ? <View style={[styles.dayMarker, { backgroundColor: checkInTone(day.check_ins[0]?.status) }]} /> : null}
        {day?.meets?.length ? <View style={[styles.dayMarker, { backgroundColor: colors.violet }]} /> : null}
        {day?.block_markers?.length ? <View style={[styles.dayMarker, { backgroundColor: colors.amber }]} /> : null}
      </View>
    </Pressable>
  );
}

function SelectedDayTray({
  day,
  canCreateSession,
  onCreateSession,
  onOpenCheckIn,
  onOpenSession,
  onEditSession,
  canEditProgramming,
  onOpenSessionSummary,
  onOpenMeet,
}: {
  day: CalendarDay;
  canCreateSession?: boolean;
  onCreateSession: () => void;
  onOpenCheckIn: (checkIn: CalendarCheckIn) => void;
  onOpenSession: (session: CalendarSession) => void;
  onEditSession: (session: CalendarSession) => void;
  canEditProgramming?: boolean;
  onOpenSessionSummary: (session: CalendarSession) => void;
  onOpenMeet: () => void;
}) {
  const sessions = day.sessions || [];
  const checkIns = day.check_ins || [];
  const meets = day.meets || [];
  const markers = day.block_markers || [];
  const primarySession = sessions[0] || null;
  const completed = !!primarySession && isCompletedStatus(primarySession.status || day.training_status);
  const inProgress = !!primarySession && isInProgressStatus(primarySession.status || day.training_status);
  const hasEvents = sessions.length || checkIns.length || meets.length || markers.length;
  const cardTone = completed ? colors.green : primarySession ? colors.amber : colors.violet;
  const cardIcon = completed ? 'checkmark' : primarySession ? 'barbell-outline' : 'calendar-outline';
  const cardTitle = completed
    ? (primarySession?.title || 'Training complete')
    : primarySession
      ? (primarySession.title || 'Training Session')
      : 'Nothing scheduled';
  const cardBody = primarySession ? sessionSummaryParts(primarySession) : ['Build your day. Stay consistent.'];
  return (
    <View style={[
      styles.selectedDayCard,
      { borderColor: fade(cardTone, completed ? 0.46 : primarySession ? 0.44 : 0.50) },
      completed ? styles.selectedDayCardComplete : primarySession ? styles.selectedDayCardTraining : styles.selectedDayCardEmpty,
    ]}>
      <View style={styles.selectedDayKickerRow}>
        <Text style={styles.selectedDayKicker}>{formatCalendarKicker(day.date)}</Text>
      </View>
      <View style={styles.selectedDayBody}>
        <View style={[styles.selectedDayIcon, { borderColor: fade(cardTone, 0.40), backgroundColor: fade(cardTone, 0.13) }]}>
          <Ionicons name={cardIcon as keyof typeof Ionicons.glyphMap} size={24} color={cardTone} />
        </View>
        <View style={styles.selectedDayCopy}>
          <View style={styles.selectedDayTitleRow}>
            <Text style={styles.selectedDayTitle}>{cardTitle}</Text>
            {primarySession ? (
              <Text style={[styles.selectedDayStatus, { color: cardTone }]}>{sessionStateLabel(primarySession.status)}</Text>
            ) : null}
          </View>
          <View style={styles.selectedSummaryList}>
            {cardBody.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.selectedSummaryLine} numberOfLines={1}>
                {primarySession ? `• ${line}` : line}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {primarySession ? (
        <View style={styles.selectedActionStack}>
          <Pressable
            style={({ pressed }) => [
              styles.selectedPrimaryButton,
              { backgroundColor: completed ? 'rgba(87, 171, 112, 0.14)' : 'rgba(113, 66, 222, 0.88)', borderColor: fade(cardTone, 0.46) },
              pressed && styles.pressed,
            ]}
            onPress={() => completed ? onOpenSessionSummary(primarySession) : onOpenSession(primarySession)}
          >
            <Text style={styles.selectedPrimaryButtonText}>{completed ? 'View Summary' : inProgress ? 'Continue Workout' : 'Start Workout'}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.textStrong} />
          </Pressable>
          {canEditProgramming ? (
            <Pressable
              style={({ pressed }) => [styles.selectedSecondaryButton, pressed && styles.pressed]}
              onPress={() => onEditSession(primarySession)}
            >
              <Text style={styles.selectedSecondaryButtonText}>Edit Plan</Text>
            </Pressable>
          ) : null}
        </View>
      ) : canCreateSession ? (
        <Pressable
          style={({ pressed }) => [styles.selectedPrimaryButton, styles.createPrimaryButton, pressed && styles.pressed]}
          onPress={onCreateSession}
        >
          <Ionicons name="add" size={18} color={colors.textStrong} />
          <Text style={styles.selectedPrimaryButtonText}>Create Session</Text>
        </Pressable>
      ) : null}

      {checkIns.map((checkIn) => (
        <Pressable key={checkIn.submission_id} style={({ pressed }) => [styles.ledgerRow, pressed && styles.pressed]} onPress={() => onOpenCheckIn(checkIn)}>
          <View style={[styles.rowRail, { backgroundColor: checkInTone(checkIn.status) }]} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{checkIn.title || 'Check-In'}</Text>
            <Text style={styles.rowMeta}>{checkInCalendarLine(checkIn)}</Text>
          </View>
          <Text style={[styles.rowStatus, { color: checkInTone(checkIn.status) }]}>{checkInStatusLabel(checkIn.status)}</Text>
        </Pressable>
      ))}

      {meets.map((meet) => (
        <Pressable key={meet.meet_plan_id} style={({ pressed }) => [styles.ledgerRow, pressed && styles.pressed]} onPress={onOpenMeet}>
          <View style={[styles.rowRail, { backgroundColor: colors.violet }]} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{meet.name || 'Meet'}</Text>
            <Text style={styles.rowMeta}>{meet.days_until === 0 ? 'Meet day' : `${meet.days_until} days out`}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ))}

      {markers.map((marker, index) => (
        <View key={`${marker.kind}-${marker.block_id}-${index}`} style={styles.ledgerRow}>
          <View style={[styles.rowRail, { backgroundColor: colors.amber }]} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{marker.label || 'Block marker'}</Text>
            <Text style={styles.rowMeta}>{marker.kind === 'block_end' ? 'Block end' : 'Block start'}</Text>
          </View>
        </View>
      ))}

      {!hasEvents ? (
        null
      ) : null}
    </View>
  );
}

function UpcomingTimeline({ items, onOpen }: { items: UpcomingItem[]; onOpen: (item: UpcomingItem) => void }) {
  return (
    <View style={styles.timelineZone}>
      <View style={styles.timelineHandle} />
      <Text style={styles.timelineSheetTitle}>Upcoming</Text>
      <View style={styles.timelineList}>
        {items.length ? items.map((item, index) => {
          const actionable = item.route === 'workout' || item.route === 'meet' || item.route === 'block' || item.route === 'check_in';
          return (
            <Pressable
              key={`${item.kind}-${item.date}-${index}`}
              style={({ pressed }) => [styles.timelineRow, pressed && actionable && styles.pressed]}
              onPress={() => actionable ? onOpen(item) : undefined}
              disabled={!actionable}
            >
              <View style={styles.timelineDate}>
                <Text style={styles.timelineMonth}>{formatMonth(item.date)}</Text>
                <Text style={styles.timelineDay}>{formatDayNumber(item.date)}</Text>
              </View>
              <View style={[styles.timelineRail, { backgroundColor: toneForUpcoming(item) }]} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{item.title || 'Calendar item'}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>{item.subtitle || item.kind || ''}</Text>
              </View>
              {actionable ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
            </Pressable>
          );
        }) : (
          <Text style={styles.emptyLine}>Nothing scheduled in the next two weeks.</Text>
        )}
      </View>
    </View>
  );
}

function CalendarLegend({ hasBlockRange, hasMeet, hideCheckIns }: { hasBlockRange: boolean; hasMeet: boolean; hideCheckIns?: boolean }) {
  return (
    <View style={styles.markerLegend}>
      {hasBlockRange ? <LegendItem kind="wash" label="Block dates" /> : null}
      <LegendItem color={colors.amber} label="Training" />
      {!hideCheckIns ? <LegendItem color={colors.violet} label="Check-In" /> : null}
      <LegendItem color={colors.green} label="Complete" />
      <LegendItem color={colors.red} label="Missed" />
      {hasMeet ? <LegendItem color={colors.violet} label="Meet" /> : null}
    </View>
  );
}

function LegendItem({ color, label, kind }: { color?: string; label: string; kind?: 'wash' }) {
  return (
    <View style={styles.legendItem}>
      {kind === 'wash' ? <View style={styles.legendWash} /> : <View style={[styles.legendDot, { backgroundColor: color || colors.line }]} />}
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function UtilityButton({
  icon,
  label,
  onPress,
  position,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  position: 'start' | 'middle' | 'end';
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.utilityButton,
        position !== 'end' && styles.utilityButtonDivider,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={15} color={colors.text} />
      <Text style={styles.utilityText}>{label}</Text>
    </Pressable>
  );
}

function toneForDay(status?: string | null, hasMeet = false, hasBlock = false, hasCheckIn = false) {
  if (hasMeet) return colors.violet;
  if (hasCheckIn) return colors.violet;
  if (status === 'completed') return colors.green;
  if (status === 'in_progress') return colors.violet;
  if (status === 'missed' || status === 'incomplete') return colors.red;
  if (status === 'assigned' || status === 'mixed') return colors.amber;
  if (hasBlock) return colors.amber;
  return colors.line;
}

function toneForStatus(status?: string | null) {
  const value = (status || '').toLowerCase();
  if (value === 'completed' || value === 'logged' || value === 'done') return colors.green;
  if (value === 'in_progress') return colors.violet;
  if (value === 'missed' || value === 'incomplete' || value === 'tardy') return colors.red;
  return colors.amber;
}

function toneForUpcoming(item: UpcomingItem) {
  if (item.kind === 'meet') return colors.violet;
  if (item.kind === 'block_marker') return colors.amber;
  if (item.kind === 'check_in') return checkInTone(item.status);
  return toneForStatus(item.status);
}

function checkInTone(status?: string | null) {
  const value = String(status || '').toLowerCase();
  if (value === 'submitted') return colors.green;
  if (value === 'late') return colors.red;
  return colors.violet;
}

function checkInStatusLabel(status?: string | null) {
  const value = String(status || '').toLowerCase();
  if (value === 'submitted') return 'Submitted';
  if (value === 'late') return 'Overdue';
  return 'Due';
}

function checkInCalendarLine(checkIn: CalendarCheckIn) {
  const status = String(checkIn.status || '').toLowerCase();
  if (status === 'submitted') return 'Submitted';
  if (status === 'late') return 'Overdue';
  return checkIn.local_due_time ? `Due ${checkIn.local_due_time}` : 'Due';
}

function statusLabel(status?: string | null) {
  const value = (status || 'assigned').toLowerCase();
  if (value === 'completed' || value === 'logged' || value === 'done') return 'Complete';
  if (value === 'in_progress') return 'In progress';
  if (value === 'missed') return 'Missed';
  if (value === 'incomplete') return 'Incomplete';
  if (value === 'tardy') return 'Tardy';
  return 'Not started';
}

function isCompletedStatus(status?: string | null) {
  const value = String(status || '').toLowerCase();
  return value === 'completed' || value === 'logged' || value === 'done';
}

function isInProgressStatus(status?: string | null) {
  return String(status || '').toLowerCase() === 'in_progress';
}

function sessionStateLabel(status?: string | null) {
  const value = String(status || 'assigned').toLowerCase();
  if (isCompletedStatus(value)) return 'Complete';
  if (value === 'in_progress') return 'In progress';
  if (value === 'missed') return 'Missed';
  if (value === 'incomplete') return 'Incomplete';
  if (value === 'tardy') return 'Tardy';
  return 'Assigned';
}

function sessionSummaryParts(session: CalendarSession) {
  const parts: string[] = [];
  const lifts = (session.primary_lifts || [])
    .map((lift) => simplifyMobileMovementText(lift))
    .filter(Boolean);
  parts.push(...lifts.slice(0, 3));

  const accessoryCount = Number(session.accessory_count || 0);
  if (accessoryCount > 0) {
    parts.push(`${accessoryCount} ${accessoryCount === 1 ? 'Accessory' : 'Accessories'}`);
  }

  const setsMatch = String(session.planned_summary || '').match(/(\d+)\s+sets?/i);
  if (setsMatch?.[1]) {
    const sets = Number(setsMatch[1]);
    if (sets > 0) parts.push(`${sets} ${sets === 1 ? 'Set' : 'Sets'}`);
  }

  if (!parts.length && session.planned_summary) {
    return simplifyMobileMovementText(session.planned_summary)
      .split(/[·/]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  return parts.length ? parts : [session.block_name || statusLabel(session.status)];
}

function formatCalendarKicker(value?: string | null) {
  const date = parseDate(value);
  if (!date) return 'SELECTED DAY';
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();
  const month = date.toLocaleDateString(undefined, { month: 'long' }).toUpperCase();
  return `${weekday} • ${month} ${date.getDate()}`;
}

function fade(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function monthGridRange(month: Date) {
  const first = startOfMonth(month);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = addDays(first, -firstWeekday);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const lastWeekday = (last.getDay() + 6) % 7;
  const end = addDays(last, 7 - lastWeekday);
  return { start, end };
}

function buildDateRange(start: Date, end: Date) {
  const dates = [];
  let cursor = new Date(start);
  while (cursor < end) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function isSameMonth(a: Date | null, b: Date) {
  return !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatLongDate(value?: string | null) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Selected day';
}

function formatMonth(value?: string | null) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, { month: 'short' }) : '';
}

function formatDayNumber(value?: string | null) {
  const date = parseDate(value);
  return date ? String(date.getDate()) : '';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingTop: 10,
    paddingBottom: 36,
    gap: 18,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  stateTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  stateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(40, 18, 18, 0.18)',
    paddingVertical: 12,
  },
  stateBody: {
    ...SLTypography.body,
    color: colors.muted,
  },
  monthHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monthLabelButton: {
    minHeight: 40,
    justifyContent: 'center',
  },
  monthTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 22,
    lineHeight: 27,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  monthArrowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(18, 15, 25, 0.24)',
  },
  header: {
    gap: 14,
  },
  headerText: {
    gap: 3,
  },
  title: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  rangeLabel: {
    ...SLTypography.body,
    color: colors.muted,
  },
  monthControls: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(24, 16, 15, 0.22)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(167, 139, 250, 0.48)',
  },
  utilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  utilityButtonDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.lineSoft,
  },
  utilityText: {
    ...SLTypography.label,
    color: colors.text,
  },
  contextStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  contextRail: {
    width: 3,
    backgroundColor: colors.violet,
    opacity: 0.72,
  },
  contextBody: {
    flex: 1,
    gap: 8,
    paddingVertical: 13,
    paddingLeft: 13,
    paddingRight: 10,
  },
  contextLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextText: {
    ...SLTypography.body,
    color: colors.text,
    flex: 1,
  },
  calendarZone: {
    gap: 10,
    marginBottom: 0,
  },
  weekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingBottom: 8,
  },
  weekHeaderText: {
    ...SLTypography.label,
    color: colors.subtle,
    flex: 1,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderColor: colors.lineSoft,
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.055)',
  },
  dayCellInBlock: {
    backgroundColor: 'rgba(92, 55, 105, 0.082)',
  },
  dayCellBlockStart: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(214, 167, 94, 0.42)',
  },
  dayCellBlockEnd: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(214, 167, 94, 0.38)',
  },
  dayCellFaded: {
    opacity: 0.38,
  },
  dayCellToday: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  dayCellSelected: {
    backgroundColor: 'rgba(113, 66, 222, 0.72)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(188, 154, 255, 0.72)',
  },
  dayNumber: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  dayTextFaded: {
    color: colors.subtle,
  },
  dayNumberSelected: {
    color: colors.textStrong,
  },
  markerRow: {
    flexDirection: 'row',
    minHeight: 7,
    gap: 3,
    alignItems: 'center',
  },
  dayMarker: {
    width: 6,
    height: 6,
    borderRadius: 4,
  },
  dayMarkerCount: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayMarkerCountText: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 8,
    color: '#0D0A12',
  },
  restMarker: {
    width: 10,
    height: 1,
    backgroundColor: colors.line,
    marginTop: 2,
  },
  markerLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 11,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 4,
  },
  legendWash: {
    width: 14,
    height: 6,
    backgroundColor: 'rgba(92, 55, 105, 0.18)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(214, 167, 94, 0.36)',
  },
  legendText: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  tray: {
    gap: 10,
    paddingTop: 6,
  },
  selectedDayCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    gap: 14,
    overflow: 'hidden',
  },
  selectedDayCardTraining: {
    backgroundColor: 'rgba(43, 30, 12, 0.28)',
  },
  selectedDayCardComplete: {
    backgroundColor: 'rgba(15, 45, 29, 0.28)',
  },
  selectedDayCardEmpty: {
    backgroundColor: 'rgba(36, 24, 51, 0.34)',
  },
  selectedDayKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedDayKicker: {
    ...SLTypography.label,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  selectedDayBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  selectedDayIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  selectedDayCopy: {
    flex: 1,
    gap: 6,
  },
  selectedDayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectedDayTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 20,
    lineHeight: 25,
    color: colors.textStrong,
    flex: 1,
  },
  selectedDayStatus: {
    ...SLTypography.label,
  },
  selectedSummaryList: {
    gap: 3,
  },
  selectedSummaryLine: {
    ...SLTypography.body,
    color: colors.muted,
  },
  selectedActionStack: {
    gap: 9,
  },
  selectedPrimaryButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  selectedPrimaryButtonText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  createPrimaryButton: {
    backgroundColor: 'rgba(113, 66, 222, 0.78)',
    borderColor: 'rgba(188, 154, 255, 0.62)',
  },
  selectedSecondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.14)',
    backgroundColor: 'rgba(10, 8, 12, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSecondaryButtonText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  trayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  trayHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  zoneKicker: {
    ...SLTypography.label,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  trayDate: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  createSessionButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.44)',
    backgroundColor: 'rgba(167, 139, 250, 0.14)',
  },
  createSessionText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  ledgerRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(24, 16, 15, 0.18)',
    borderTopWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 10,
  },
  rowRail: {
    width: 2,
    alignSelf: 'stretch',
    opacity: 0.85,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...SLTypography.body,
    color: colors.textStrong,
  },
  rowMeta: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  rowStatus: {
    ...SLTypography.label,
    paddingRight: 8,
  },
  quietRest: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.13)',
    paddingVertical: 15,
    gap: 3,
  },
  quietRestTitle: {
    ...SLTypography.body,
    color: colors.textStrong,
  },
  quietRestBody: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  timelineZone: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(26, 23, 33, 0.88)',
    paddingTop: 14,
    overflow: 'hidden',
  },
  timelineSheetTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
    paddingHorizontal: 16,
  },
  timelineHandle: {
    width: 58,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
  },
  timelineList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  timelineRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(24, 16, 15, 0.13)',
    borderTopWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 10,
  },
  timelineDate: {
    width: 44,
    alignItems: 'center',
    gap: 1,
  },
  timelineMonth: {
    ...SLTypography.caption,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  timelineDay: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 17,
    color: colors.textStrong,
  },
  timelineRail: {
    width: 2,
    alignSelf: 'stretch',
    opacity: 0.82,
  },
  emptyLine: {
    ...SLTypography.body,
    color: colors.subtle,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  upcomingSummaryHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  upcomingTitle: {
    ...SLTypography.label,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  viewAllButton: {
    minHeight: 32,
    justifyContent: 'center',
  },
  viewAllText: {
    ...SLTypography.label,
    color: colors.violet,
  },
  pressed: {
    opacity: 0.72,
  },
});
