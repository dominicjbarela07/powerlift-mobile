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

import { fetchJson } from '@/lib/api';
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
  const [anchorMonth, setAnchorMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));
  const [payload, setPayload] = useState<AthleteCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => monthGridRange(anchorMonth), [anchorMonth]);
  const daysByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    (payload?.days || []).forEach((day) => map.set(day.date, day));
    return map;
  }, [payload?.days]);
  const gridDays = useMemo(() => buildDateRange(range.start, range.end), [range.end, range.start]);
  const selectedDay = daysByDate.get(selectedDate) || { date: selectedDate, training_status: 'rest', sessions: [], meets: [], block_markers: [] };
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

  const openSession = (session?: CalendarSession | null) => {
    if (!session?.workout_id) return;
    router.push({
      pathname: '/workout/[workoutId]',
      params: { workoutId: String(session.workout_id) },
    });
  };

  const openMeet = () => {
    router.push('/(tabs)/athlete-meet-plan' as any);
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
      style={styles.screen}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.rangeLabel}>{monthLabel(anchorMonth)}</Text>
        </View>
        <View style={styles.monthControls}>
          <UtilityButton icon="chevron-back" label="Prev" onPress={() => setAnchorMonth(addMonths(anchorMonth, -1))} position="start" />
          <UtilityButton icon="calendar-outline" label="Today" onPress={goToday} position="middle" />
          <UtilityButton icon="chevron-forward" label="Next" onPress={() => setAnchorMonth(addMonths(anchorMonth, 1))} position="end" />
        </View>
      </View>

      {error ? (
        <View style={styles.stateLine}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
          <Text style={styles.stateBody}>{error}</Text>
        </View>
      ) : null}

      <ContextStrip payload={payload} />

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
        <CalendarLegend hasBlockRange={!!blockRange} hasMeet={!!payload?.meet_countdown} />
      </View>

      <SelectedDayTray day={selectedDay} onOpenMeet={openMeet} onOpenSession={openSession} />

      <UpcomingTimeline items={payload?.upcoming || []} onOpen={openUpcoming} />
    </ScrollView>
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
  inMonth,
  selected,
  inBlockRange,
  blockStart,
  blockEnd,
  onPress,
}: {
  date: Date;
  day?: CalendarDay;
  inMonth: boolean;
  selected: boolean;
  inBlockRange: boolean;
  blockStart: boolean;
  blockEnd: boolean;
  onPress: () => void;
}) {
  const status = day?.training_status || 'rest';
  const tone = toneForDay(status, !!day?.meets?.length, !!day?.block_markers?.length);
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
        {status !== 'rest' ? <View style={[styles.dayMarker, { backgroundColor: tone }]} /> : <View style={styles.restMarker} />}
        {day?.meets?.length ? <View style={[styles.dayMarker, { backgroundColor: colors.violet }]} /> : null}
        {day?.block_markers?.length ? <View style={[styles.dayMarker, { backgroundColor: colors.amber }]} /> : null}
      </View>
    </Pressable>
  );
}

function SelectedDayTray({
  day,
  onOpenSession,
  onOpenMeet,
}: {
  day: CalendarDay;
  onOpenSession: (session: CalendarSession) => void;
  onOpenMeet: () => void;
}) {
  const sessions = day.sessions || [];
  const meets = day.meets || [];
  const markers = day.block_markers || [];
  const hasEvents = sessions.length || meets.length || markers.length;
  return (
    <View style={styles.tray}>
      <View style={styles.trayHeader}>
        <Text style={styles.zoneKicker}>Selected Day</Text>
        <Text style={styles.trayDate}>{formatLongDate(day.date)}</Text>
      </View>

      {sessions.map((session) => (
        <Pressable key={session.workout_id} style={({ pressed }) => [styles.ledgerRow, pressed && styles.pressed]} onPress={() => onOpenSession(session)}>
          <View style={[styles.rowRail, { backgroundColor: toneForStatus(session.status) }]} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{session.title || 'Training Session'}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>{session.planned_summary || session.block_name || statusLabel(session.status)}</Text>
          </View>
          <Text style={[styles.rowStatus, { color: toneForStatus(session.status) }]}>{statusLabel(session.status)}</Text>
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
        <View style={styles.quietRest}>
          <Text style={styles.quietRestTitle}>Rest</Text>
          <Text style={styles.quietRestBody}>No training scheduled for this day.</Text>
        </View>
      ) : null}
    </View>
  );
}

function UpcomingTimeline({ items, onOpen }: { items: UpcomingItem[]; onOpen: (item: UpcomingItem) => void }) {
  return (
    <View style={styles.timelineZone}>
      <Text style={styles.zoneKicker}>Upcoming</Text>
      <View style={styles.timelineList}>
        {items.length ? items.map((item, index) => {
          const actionable = item.route === 'workout' || item.route === 'meet' || item.route === 'block';
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

function CalendarLegend({ hasBlockRange, hasMeet }: { hasBlockRange: boolean; hasMeet: boolean }) {
  return (
    <View style={styles.markerLegend}>
      {hasBlockRange ? <LegendItem kind="wash" label="Block dates" /> : null}
      <LegendItem color={colors.amber} label="Training" />
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

function toneForDay(status?: string | null, hasMeet = false, hasBlock = false) {
  if (hasMeet) return colors.violet;
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
  return toneForStatus(item.status);
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

function monthGridRange(month: Date) {
  const first = startOfMonth(month);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = addDays(first, -firstWeekday);
  const end = addDays(start, 42);
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
    paddingTop: 16,
    paddingBottom: 36,
    gap: 24,
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
    gap: 11,
    marginBottom: 8,
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
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.11)',
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
    backgroundColor: 'rgba(167, 139, 250, 0.24)',
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
    minHeight: 5,
    gap: 3,
  },
  dayMarker: {
    width: 5,
    height: 5,
    borderRadius: 3,
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
    width: 5,
    height: 5,
    borderRadius: 3,
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
  trayHeader: {
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
    gap: 12,
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
  },
  pressed: {
    opacity: 0.72,
  },
});
