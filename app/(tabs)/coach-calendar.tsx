import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ui/sl-text';

import RefreshScreen from '@/components/refresh-screen';
import { NewCoachExperience, type NewCoachExperiencePayload } from '@/components/NewCoachExperience';
import {
  SLErrorState,
  SLLoadingState,
  SLButton,
  SLScreen,
} from '@/components/ui';
import { SLColors, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

type CalendarAthlete = {
  id: number;
  name: string;
};

type CalendarSession = {
  workout_id: number;
  athlete_id: number;
  athlete_name: string;
  date: string;
  label: string;
  status: string;
  block_name?: string | null;
  training_block_id?: number | null;
  tags: string[];
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

type CalendarDay = {
  date: string;
  is_today: boolean;
  counts: Record<string, number>;
  sessions: CalendarSession[];
  meets: CalendarMeet[];
};

type CalendarResponse = {
  ok: boolean;
  error?: string;
  start: string;
  end: string;
  athlete_id: number | 'ALL';
  include_completed: boolean;
  summary: {
    total_sessions: number;
    assigned: number;
    in_progress: number;
    completed: number;
    draft: number;
    missed: number;
    incomplete: number;
    meets: number;
  };
  athletes: CalendarAthlete[];
  days: CalendarDay[];
  new_coach_experience?: NewCoachExperiencePayload | null;
};

type MoveResponse = {
  ok: boolean;
  error?: string;
  workout_id?: number;
  old_date?: string | null;
  new_date?: string | null;
  session?: CalendarSession;
};

type DuplicateResponse = {
  ok: boolean;
  error?: string;
  workout_id?: number;
  source_workout_id?: number;
  session?: CalendarSession;
};

type TrainingBlockRow = {
  id: number;
  name: string;
  status?: string | null;
  date_range?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
};

type StatusFilter = 'all' | 'needs' | 'upcoming' | 'completed';
type DatePickerTarget = 'move' | 'duplicate' | null;

const CALENDAR_MATERIAL = {
  surface: SLColors.object,
  surfaceSubtle: SLColors.surfaceEmbedded,
  surfaceSoft: SLColors.surfaceFlat,
  hairline: SLColors.borderHairline,
} as const;

const statusFilters: Array<{ key: StatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap; tone: SLStatusTone }> = [
  { key: 'all', label: 'All', icon: 'calendar-outline', tone: 'neutral' },
  { key: 'needs', label: 'Needs', icon: 'alert-circle-outline', tone: 'danger' },
  { key: 'upcoming', label: 'Upcoming', icon: 'time-outline', tone: 'info' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-circle-outline', tone: 'success' },
];

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, options || { weekday: 'short', month: 'short', day: 'numeric' });
}

function dateFromYMD(value: string) {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function statusTone(status: string): SLStatusTone {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'missed' || normalized === 'incomplete') return 'danger';
  if (normalized === 'draft') return 'warning';
  if (normalized === 'in_progress') return 'accent';
  if (normalized === 'completed') return 'success';
  return 'info';
}

function toneColor(tone: SLStatusTone) {
  return SLStatusTones[tone]?.icon ?? SLColors.accentSteel;
}

function statusLabel(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'in_progress') return 'In Progress';
  if (normalized === 'missed_excused') return 'Excused';
  return normalized ? normalized.replace(/_/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) : 'Session';
}

function isNeedsAction(session: CalendarSession) {
  const status = String(session.status || '').toLowerCase();
  return status === 'missed' || status === 'incomplete' || status === 'draft' || !!session.needs_session_review;
}

function sessionPassesFilter(session: CalendarSession, filter: StatusFilter) {
  const status = String(session.status || '').toLowerCase();
  if (filter === 'needs') return isNeedsAction(session);
  if (filter === 'upcoming') return status === 'assigned' || status === 'in_progress' || status === 'draft';
  if (filter === 'completed') return status === 'completed';
  return true;
}

function isEditableStatus(session?: CalendarSession | null) {
  const status = String(session?.status || '').toLowerCase();
  return status === 'draft' || status === 'assigned' || status === 'scheduled';
}

function DatePickerInline({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  // Add minHeight to style for iOS spinner
  const pickerStyle =
    Platform.OS === 'ios'
      ? [styles.inlineDatePicker, { minHeight: 220 }]
      : styles.inlineDatePicker;
  return (
    <View style={pickerStyle}>
      <DateTimePicker
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        mode="date"
        onChange={(event, selected) => {
          if (Platform.OS === 'android') {
            onDone();
            if ((event as any)?.type === 'set' && selected) {
              onChange(toYMD(selected));
            }
            return;
          }
          if (selected) onChange(toYMD(selected));
        }}
        textColor={Platform.OS === 'ios' ? SLColors.text : undefined}
        themeVariant="dark"
        value={dateFromYMD(value || toYMD(new Date()))}
      />
      {Platform.OS === 'ios' ? (
        <View style={styles.dateDoneRow}>
          <SLButton fullWidth label="Done" onPress={onDone} />
        </View>
      ) : null}
    </View>
  );
}

export default function CoachCalendarScreen() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [athleteId, setAthleteId] = useState<'ALL' | string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  

  function statusFilterLabel(filter: StatusFilter) {
    if (filter === 'needs') return 'Needs';
    if (filter === 'upcoming') return 'Upcoming';
    if (filter === 'completed') return 'Completed';
    return 'All statuses';
  }
  const [data, setData] = useState<CalendarResponse | null>(null);
  const selectedAthleteLabel = useMemo(() => {
    if (athleteId === 'ALL') return 'All athletes';
    return data?.athletes.find((athlete) => String(athlete.id) === athleteId)?.name || 'Athlete';
  }, [athleteId, data?.athletes]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<CalendarSession | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState('');
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>(null);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const [blocks, setBlocks] = useState<TrainingBlockRow[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [assigningBlock, setAssigningBlock] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const loadCalendar = useCallback(
    async (opts?: { silent?: boolean; showRefreshIndicator?: boolean }) => {
      try {
        if (opts?.silent) {
          if (opts.showRefreshIndicator !== false) setRefreshing(true);
        } else setLoading(true);
        setError(null);

        const query = new URLSearchParams({
          start: toYMD(weekStart),
          end: toYMD(weekEnd),
          athlete_id: athleteId,
          include_completed: '1',
        });
        const resp = await fetchJson<CalendarResponse>(`/coach/mobile/calendar?${query.toString()}`, {
          method: 'GET',
        });
        const json = resp.json;
        if (!resp.ok || !json?.ok) {
          setError(json?.error || `Failed to load calendar. (${resp.status})`);
          return;
        }
        setData(json);
      } catch (err) {
        console.log('Coach calendar load error', err);
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [athleteId, weekEnd, weekStart]
  );

  useFocusEffect(
    useCallback(() => {
      loadCalendar({ silent: true, showRefreshIndicator: false });
    }, [loadCalendar])
  );

  const visibleDays = useMemo(() => {
    const days = data?.days || [];
    return days.map((day) => ({
      ...day,
      sessions: day.sessions.filter((session) => sessionPassesFilter(session, statusFilter)),
    }));
  }, [data?.days, statusFilter]);

  const visibleSessionCount = visibleDays.reduce((count, day) => count + day.sessions.length, 0);
  const visibleItemCount = visibleDays.reduce((count, day) => count + day.sessions.length + day.meets.length, 0);
  const needsCount = (data?.days || []).reduce((count, day) => count + day.sessions.filter(isNeedsAction).length, 0);

  const metrics = useMemo(
    () => [
      { label: 'Sessions', value: visibleSessionCount, tone: 'neutral' as SLStatusTone },
      { label: 'Needs', value: needsCount, tone: needsCount > 0 ? ('danger' as SLStatusTone) : ('neutral' as SLStatusTone) },
      { label: 'In Progress', value: data?.summary.in_progress || 0, tone: 'accent' as SLStatusTone },
      { label: 'Meets', value: data?.summary.meets || 0, tone: (data?.summary.meets || 0) > 0 ? ('review' as SLStatusTone) : ('neutral' as SLStatusTone) },
    ],
    [data?.summary.in_progress, data?.summary.meets, needsCount, visibleSessionCount]
  );

  const openSession = useCallback(
    (workoutId: number) => {
      setSelectedSession(null);
      router.push({
        pathname: '/workout/[workoutId]',
        params: { workoutId: String(workoutId) },
      } as any);
    },
    [router]
  );

  const openAthlete = useCallback(
    (athlete: { id: number; name: string }) => {
      setSelectedSession(null);
      router.push({
        pathname: '/(tabs)/coach-athlete/[athleteId]',
        params: { athleteId: String(athlete.id), athleteName: athlete.name },
      } as any);
    },
    [router]
  );

  const openCreateSession = useCallback(
    (day: CalendarDay) => {
      const params: Record<string, string> = { date: day.date };
      if (athleteId !== 'ALL') {
        const athlete = data?.athletes.find((row) => String(row.id) === athleteId);
        params.athleteId = athleteId;
        if (athlete?.name) params.athleteName = athlete.name;
      }
      router.push({ pathname: '/create-workout', params } as any);
    },
    [athleteId, data?.athletes, router]
  );

  const editSession = useCallback(
    (session: CalendarSession) => {
      if (!isEditableStatus(session)) return;
      setSelectedSession(null);
      router.push({
        pathname: '/workout/session-workspace/[workoutId]' as any,
        params: { workoutId: String(session.workout_id), athleteId: String(session.athlete_id) },
      } as any);
    },
    [router]
  );

  const openSessionReview = useCallback(
    (session: CalendarSession) => {
      setSelectedSession(null);
      router.push({
        pathname: '/(tabs)/session-surveys',
        params: {
          athleteId: String(session.athlete_id),
          athleteName: session.athlete_name,
          workoutId: String(session.workout_id),
        },
      } as any);
    },
    [router]
  );

  const openSessionSheet = useCallback((session: CalendarSession) => {
    setSelectedSession(session);
    setMoveDate(session.date || toYMD(new Date()));
    setDuplicateDate(session.date ? toYMD(addDays(dateFromYMD(session.date), 7)) : toYMD(addDays(new Date(), 7)));
    setMoveError(null);
    setDuplicateError(null);
    setBlockError(null);
  }, []);

  const closeSessionSheet = useCallback(() => {
    if (moving || duplicating || assigningBlock || deleting) return;
    setSelectedSession(null);
    setMoveError(null);
    setDuplicateError(null);
    setBlockError(null);
    setBlockPickerOpen(false);
    setDatePickerTarget(null);
  }, [assigningBlock, deleting, duplicating, moving]);

  const moveSelectedSession = useCallback(async () => {
    if (!selectedSession) return;
    setMoving(true);
    setMoveError(null);
    try {
      const resp = await fetchJson<MoveResponse>(`/coach/mobile/workouts/${selectedSession.workout_id}/move`, {
        method: 'POST',
        body: JSON.stringify({ date: moveDate }),
        headers: { 'Content-Type': 'application/json' },
      });
      const json = resp.json;
      if (!resp.ok || !json?.ok) {
        setMoveError(json?.error || `Move failed. (${resp.status})`);
        return;
      }
      setSelectedSession(null);
      await loadCalendar({ silent: true });
    } catch (err: any) {
      setMoveError(err?.message || 'Move failed. Please try again.');
    } finally {
      setMoving(false);
    }
  }, [loadCalendar, moveDate, selectedSession]);

  const duplicateSelectedSession = useCallback(async () => {
    if (!selectedSession) return;
    setDuplicating(true);
    setDuplicateError(null);
    try {
      const resp = await fetchJson<DuplicateResponse>(`/coach/mobile/workouts/${selectedSession.workout_id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ date: duplicateDate }),
        headers: { 'Content-Type': 'application/json' },
      });
      const json = resp.json;
      if (!resp.ok || !json?.ok) {
        setDuplicateError(json?.error || `Duplicate failed. (${resp.status})`);
        return;
      }
      setSelectedSession(null);
      await loadCalendar({ silent: true });
    } catch (err: any) {
      setDuplicateError(err?.message || 'Duplicate failed. Please try again.');
    } finally {
      setDuplicating(false);
    }
  }, [duplicateDate, loadCalendar, selectedSession]);

  const openBlockPicker = useCallback(async () => {
    if (!selectedSession) return;
    setBlockPickerOpen(true);
    setBlocksLoading(true);
    setBlockError(null);
    try {
      const query = new URLSearchParams({ athlete_id: String(selectedSession.athlete_id) });
      const resp = await fetchJson<{ ok: boolean; error?: string; blocks?: TrainingBlockRow[] }>(
        `/workouts/training_blocks.json?${query.toString()}`,
        { method: 'GET' }
      );
      const json = resp.json;
      if (!resp.ok || !json?.ok) {
        setBlockError(json?.error || `Could not load blocks. (${resp.status})`);
        setBlocks([]);
        return;
      }
      setBlocks(Array.isArray(json.blocks) ? json.blocks : []);
    } catch (err: any) {
      setBlockError(err?.message || 'Could not load blocks.');
      setBlocks([]);
    } finally {
      setBlocksLoading(false);
    }
  }, [selectedSession]);

  const assignSelectedBlock = useCallback(
    async (trainingBlockId: number | null) => {
      if (!selectedSession) return;
      setAssigningBlock(true);
      setBlockError(null);
      try {
        const resp = await fetchJson<{ ok: boolean; error?: string }>(
          `/coach/mobile/workouts/${selectedSession.workout_id}/block`,
          {
            method: 'POST',
            body: JSON.stringify({ training_block_id: trainingBlockId }),
            headers: { 'Content-Type': 'application/json' },
          }
        );
        const json = resp.json;
        if (!resp.ok || !json?.ok) {
          setBlockError(json?.error || `Assign failed. (${resp.status})`);
          return;
        }
        setBlockPickerOpen(false);
        setSelectedSession(null);
        await loadCalendar({ silent: true });
      } catch (err: any) {
        setBlockError(err?.message || 'Assign failed.');
      } finally {
        setAssigningBlock(false);
      }
    },
    [loadCalendar, selectedSession]
  );

  const deleteSelectedSession = useCallback(() => {
    if (!selectedSession || !isEditableStatus(selectedSession)) return;
    Alert.alert(
      'Delete Session',
      `Delete ${selectedSession.label || 'this session'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const resp = await fetchJson<{ ok: boolean; error?: string }>(
                `/coach/mobile/workouts/${selectedSession.workout_id}/delete`,
                { method: 'POST' }
              );
              const json = resp.json;
              if (!resp.ok || !json?.ok) {
                Alert.alert('Delete failed', json?.error || `Delete failed. (${resp.status})`);
                return;
              }
              setSelectedSession(null);
              await loadCalendar({ silent: true });
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message || 'Delete failed.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [loadCalendar, selectedSession]);

  if (loading && !refreshing && !data) {
    return (
      <SLScreen edges="none">
        <View style={styles.centerState}>
          <SLLoadingState message="Loading operational schedule..." title="Loading Calendar" />
        </View>
      </SLScreen>
    );
  }

  return (
    <SLScreen edges="none" padded={false}>
      <RefreshScreen
        contentContainerStyle={styles.scrollContent}
        onRefresh={() => loadCalendar({ silent: true })}
        refreshing={refreshing}
        style={styles.scroll}
      >
        <View style={styles.topBar}>
          <View style={styles.header}>
            <Text style={styles.title}>Calendar</Text>
            <Text style={styles.weekLabelText}>
              {formatDate(toYMD(weekStart), { month: 'short', day: 'numeric' })} - {formatDate(toYMD(addDays(weekEnd, -1)), { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.weekNav}>
            <CalendarUtilityChip icon="chevron-back-outline" label="Prev" onPress={() => setWeekStart((prev) => addDays(prev, -7))} />
            <CalendarUtilityChip icon="chevron-forward-outline" label="Next" onPress={() => setWeekStart((prev) => addDays(prev, 7))} />
          </View>
        </View>

        {data?.new_coach_experience ? (
          <NewCoachExperience experience={data.new_coach_experience} />
        ) : null}

        <CalendarMetricStrip metrics={metrics} />

        <View style={styles.filterSummaryBar}>
          <View style={styles.filterSummaryTextBlock}>
            <Text style={styles.filterSummaryTitle}>{selectedAthleteLabel}</Text>
            <Text style={styles.filterSummaryMeta}>{statusFilterLabel(statusFilter)}</Text>
          </View>
          <CalendarUtilityChip
            icon="options-outline"
            label="Filters"
            onPress={() => setFilterSheetOpen(true)}
            selected={athleteId !== 'ALL' || statusFilter !== 'all'}
            tone="info"
          />
        </View>
        <Modal
          animationType="fade"
          onRequestClose={() => setFilterSheetOpen(false)}
          transparent
          visible={filterSheetOpen}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.filterSheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Filters</Text>
                <Pressable accessibilityLabel="Close filters" onPress={() => setFilterSheetOpen(false)} style={styles.closeButton}>
                  <Ionicons color={SLColors.textMuted} name="close" size={20} />
                </Pressable>
              </View>

              <View style={styles.filterSheetSection}>
                <Text style={styles.filterSheetLabel}>Athlete</Text>
                <View style={styles.filterChipWrap}>
                  <CalendarUtilityChip
                    icon="people-outline"
                    label="All"
                    onPress={() => setAthleteId('ALL')}
                    selected={athleteId === 'ALL'}
                    tone="neutral"
                  />
                  {(data?.athletes || []).map((athlete) => (
                    <CalendarUtilityChip
                      icon="person-outline"
                      key={athlete.id}
                      label={athlete.name}
                      onPress={() => setAthleteId(String(athlete.id))}
                      selected={athleteId === String(athlete.id)}
                      tone="neutral"
                    />
                  ))}
                </View>
              </View>

              <View style={styles.filterSheetSection}>
                <Text style={styles.filterSheetLabel}>Status</Text>
                <View style={styles.filterChipWrap}>
                  {statusFilters.map((filter) => (
                    <CalendarUtilityChip
                      icon={filter.icon}
                      key={filter.key}
                      label={filter.label}
                      onPress={() => setStatusFilter(filter.key)}
                      selected={statusFilter === filter.key}
                      tone={filter.tone}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.filterSheetActions}>
                <SLButton
                  fullWidth
                  label="Reset Filters"
                  onPress={() => {
                    setAthleteId('ALL');
                    setStatusFilter('all');
                  }}
                  variant="secondary"
                />
                <SLButton fullWidth label="Done" onPress={() => setFilterSheetOpen(false)} />
              </View>
            </View>
          </View>
        </Modal>

        {error ? (
          <SLErrorState
            actionLabel="Try Again"
            message={error}
            onActionPress={() => loadCalendar()}
            title="Could not load calendar"
          />
        ) : null}

        <View style={styles.section}>
          {visibleItemCount === 0 && !error ? (
            <CalendarInlineEmpty title="No scheduled work" detail="No sessions match this week and filter." />
          ) : null}

          <View style={styles.dayStack}>
            {visibleDays.map((day) => {
              const dayTotal = day.sessions.length;
              return (
                <View key={day.date} style={styles.dayBucket}>
                  <View style={styles.dayHeader}>
                    <View>
                      <Text style={styles.dayTitle}>{day.is_today ? 'Today' : formatDate(day.date)}</Text>
                      <Text style={styles.dayMeta}>
                        {dayTotal} session{dayTotal === 1 ? '' : 's'}
                        {day.meets.length ? ` · ${day.meets.length} meet${day.meets.length === 1 ? '' : 's'}` : ''}
                      </Text>
                    </View>
                    <CalendarUtilityChip
                      icon="add-outline"
                      label="Create"
                      onPress={() => openCreateSession(day)}
                      tone="info"
                    />
                  </View>

                  {dayTotal === 0 && day.meets.length === 0 ? (
                    <View style={styles.emptyDay}>
                      <Text style={styles.emptyDayText}>No sessions</Text>
                    </View>
                  ) : (
                    <View style={styles.rowStack}>
                      {day.meets.map((meet) => (
                        <CalendarMeetRow
                          icon="flag-outline"
                          key={`meet-${meet.meet_plan_id}`}
                          meta={typeof meet.days_out === 'number' ? `${meet.days_out} day${meet.days_out === 1 ? '' : 's'} out` : undefined}
                          onPress={() => openAthlete({ id: meet.athlete_id, name: meet.athlete_name })}
                          statusLabel="Meet"
                          statusTone="review"
                          title={meet.meet_name || `${meet.athlete_name} meet`}
                        />
                      ))}

                      {day.sessions.map((session) => (
                        <CalendarSessionRow
                          key={session.workout_id}
                          session={session}
                          meta={[session.planned_summary, session.block_name].filter(Boolean).join(' · ') || undefined}
                          onPress={() => openSessionSheet(session)}
                          priorityLabel={session.needs_session_review ? 'Review' : isNeedsAction(session) ? 'Needs' : undefined}
                          rightLabel={session.needs_session_review ? 'Review' : session.tags?.[0]}
                          statusLabel={session.needs_session_review ? 'Needs Review' : statusLabel(session.status)}
                          statusTone={session.needs_session_review ? 'review' : statusTone(session.status)}
                          subtitle={session.athlete_name}
                          title={session.label || 'Session'}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <Modal
          animationType="fade"
          onRequestClose={closeSessionSheet}
          transparent
          visible={!!selectedSession}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleBlock}>
                  <Text numberOfLines={1} style={styles.sheetTitle}>
                    {selectedSession?.label || 'Session'}
                  </Text>
                  <Text typographyRole="supportingBody" style={styles.sheetSubtitle}>
                    {selectedSession?.athlete_name} · {selectedSession ? formatDate(selectedSession.date) : ''}
                  </Text>
                </View>
                <Pressable accessibilityLabel="Close session actions" onPress={closeSessionSheet} style={styles.closeButton}>
                  <Ionicons color={SLColors.textMuted} name="close" size={20} />
                </Pressable>
              </View>

              {selectedSession ? (
                <ScrollView
                  contentContainerStyle={styles.sheetActions}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.sheetActionsScroll}
                >
                  <SLButton
                    fullWidth
                    iconLeft="open-outline"
                    label="Open Session"
                    onPress={() => openSession(selectedSession.workout_id)}
                    variant="secondary"
                  />
                  <SLButton
                    fullWidth
                    iconLeft="person-outline"
                    label="Open Athlete"
                    onPress={() => openAthlete({ id: selectedSession.athlete_id, name: selectedSession.athlete_name })}
                    variant="secondary"
                  />
                  {selectedSession.needs_session_review ? (
                    <SLButton
                      fullWidth
                      iconLeft="clipboard-outline"
                      label="Session Review"
                      onPress={() => openSessionReview(selectedSession)}
                      variant="secondary"
                    />
                  ) : null}
                  {isEditableStatus(selectedSession) ? (
                    <>
                      <SLButton
                        fullWidth
                        iconLeft="create-outline"
                        label="Edit Session"
                        onPress={() => editSession(selectedSession)}
                        variant="secondary"
                      />

                      <View style={styles.movePanel}>
                        <Text style={styles.moveLabel}>Move Session</Text>
                        <Pressable
                          accessibilityLabel="Choose new session date"
                          accessibilityRole="button"
                          onPress={() => setDatePickerTarget('move')}
                          style={({ pressed }) => [styles.dateButton, { opacity: pressed ? 0.78 : 1 }]}
                        >
                          <Ionicons color={SLColors.accent} name="calendar-outline" size={17} />
                          <Text style={styles.dateButtonText}>{moveDate || 'Choose date'}</Text>
                        </Pressable>
                        {moveError ? <Text style={styles.moveError}>{moveError}</Text> : null}
                        <SLButton
                          disabled={!moveDate || moveDate === selectedSession.date}
                          fullWidth
                          iconLeft="swap-horizontal-outline"
                          label="Move to Date"
                          loading={moving}
                          onPress={moveSelectedSession}
                          variant="primary"
                        />
                      </View>

                      <View style={styles.movePanel}>
                        <Text style={styles.moveLabel}>Duplicate Session</Text>
                        <Pressable
                          accessibilityLabel="Choose duplicated session date"
                          accessibilityRole="button"
                          onPress={() => setDatePickerTarget('duplicate')}
                          style={({ pressed }) => [styles.dateButton, { opacity: pressed ? 0.78 : 1 }]}
                        >
                          <Ionicons color={SLColors.accent} name="calendar-outline" size={17} />
                          <Text style={styles.dateButtonText}>{duplicateDate || 'Choose date'}</Text>
                        </Pressable>
                        {duplicateError ? <Text style={styles.moveError}>{duplicateError}</Text> : null}
                        <SLButton
                          disabled={!duplicateDate}
                          fullWidth
                          iconLeft="copy-outline"
                          label="Duplicate to Date"
                          loading={duplicating}
                          onPress={duplicateSelectedSession}
                          variant="secondary"
                        />
                      </View>

                      {datePickerTarget ? (
                        <View style={styles.sheetDatePickerPanel}>
                          <Text style={styles.moveLabel}>
                            {datePickerTarget === 'move' ? 'Move Date' : 'Duplicate Date'}
                          </Text>
                          <DatePickerInline
                            onChange={datePickerTarget === 'move' ? setMoveDate : setDuplicateDate}
                            onDone={() => setDatePickerTarget(null)}
                            value={
                              datePickerTarget === 'move'
                                ? moveDate || selectedSession.date || toYMD(new Date())
                                : duplicateDate || selectedSession.date || toYMD(new Date())
                            }
                          />
                        </View>
                      ) : null}

                      <View style={styles.movePanel}>
                        <Text style={styles.moveLabel}>Training Block</Text>
                        <Text style={styles.blockCurrentText}>{selectedSession.block_name || 'No block assigned'}</Text>
                        {blockError ? <Text style={styles.moveError}>{blockError}</Text> : null}
                        <SLButton
                          fullWidth
                          iconLeft="folder-open-outline"
                          label="Assign to Block"
                          loading={blocksLoading || assigningBlock}
                          onPress={openBlockPicker}
                          variant="secondary"
                        />
                      </View>

                      <SLButton
                        disabled={deleting}
                        fullWidth
                        iconLeft="trash-outline"
                        label={deleting ? 'Deleting...' : 'Delete Session'}
                        onPress={deleteSelectedSession}
                        variant="danger"
                      />
                    </>
                  ) : null}
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

        <Modal
          animationType="fade"
          onRequestClose={() => {
            if (!assigningBlock) setBlockPickerOpen(false);
          }}
          transparent
          visible={blockPickerOpen}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dateSheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Assign to Block</Text>
                <Pressable accessibilityLabel="Close block picker" onPress={() => setBlockPickerOpen(false)} style={styles.closeButton}>
                  <Ionicons color={SLColors.textMuted} name="close" size={20} />
                </Pressable>
              </View>
              {blockError ? <Text style={styles.moveError}>{blockError}</Text> : null}
              {blocksLoading ? (
                <SLLoadingState message="Loading blocks..." title="Loading" />
              ) : (
                <ScrollView style={styles.blockList} contentContainerStyle={styles.blockListContent}>
                  <Pressable
                    disabled={assigningBlock}
                    onPress={() => assignSelectedBlock(null)}
                    style={({ pressed }) => [
                      styles.blockOption,
                      selectedSession?.training_block_id == null && styles.blockOptionSelected,
                      { opacity: pressed ? 0.78 : 1 },
                    ]}
                  >
                    <Text style={styles.blockOptionTitle}>No Block</Text>
                  </Pressable>
                  {blocks.map((block) => (
                    <Pressable
                      disabled={assigningBlock}
                      key={block.id}
                      onPress={() => assignSelectedBlock(block.id)}
                      style={({ pressed }) => [
                        styles.blockOption,
                        selectedSession?.training_block_id === block.id && styles.blockOptionSelected,
                        { opacity: pressed ? 0.78 : 1 },
                      ]}
                    >
                      <Text style={styles.blockOptionTitle}>{block.name}</Text>
                      {block.date_range || block.status ? (
                        <Text style={styles.blockOptionMeta}>{[block.date_range, block.status].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

      </RefreshScreen>
    </SLScreen>
  );
}

function CalendarMetricStrip({
  metrics,
}: {
  metrics: Array<{ label: string; value: number; tone: SLStatusTone }>;
}) {
  return (
    <View style={styles.metricStrip}>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.metricCell}>
          <Text style={[styles.metricValue, { color: toneColor(metric.tone) }]}>{metric.value}</Text>
          <Text numberOfLines={1} style={styles.metricLabel}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
}

function CalendarUtilityChip({
  icon,
  label,
  selected = false,
  tone = 'neutral',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected?: boolean;
  tone?: SLStatusTone;
  onPress: () => void;
}) {
  const color = selected ? toneColor(tone) : SLColors.textSubtle;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.utilityChip, selected && styles.utilityChipSelected, pressed && styles.pressed]}>
      <Ionicons color={color} name={icon} size={14} />
      <Text style={[styles.utilityChipText, selected && { color }]}>{label}</Text>
    </Pressable>
  );
}

function CalendarMeetRow({
  icon,
  title,
  meta,
  statusLabel,
  statusTone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta?: string;
  statusLabel: string;
  statusTone: SLStatusTone;
  onPress: () => void;
}) {
  return (
    <CalendarLedgerRow
      icon={icon}
      meta={meta}
      onPress={onPress}
      statusLabel={statusLabel}
      statusTone={statusTone}
      subtitle="Meet day"
      title={title}
    />
  );
}

function CalendarSessionRow({
  session,
  title,
  subtitle,
  meta,
  statusLabel,
  statusTone,
  priorityLabel,
  rightLabel,
  onPress,
}: {
  session: CalendarSession;
  title: string;
  subtitle: string;
  meta?: string;
  statusLabel: string;
  statusTone: SLStatusTone;
  priorityLabel?: string;
  rightLabel?: string;
  onPress: () => void;
}) {
  return (
    <CalendarLedgerRow
      icon={session.needs_session_review ? 'clipboard-outline' : 'barbell-outline'}
      meta={meta}
      onPress={onPress}
      priorityLabel={priorityLabel}
      rightLabel={rightLabel}
      statusLabel={statusLabel}
      statusTone={statusTone}
      subtitle={subtitle}
      title={title}
      dominant={isNeedsAction(session)}
    />
  );
}

function CalendarLedgerRow({
  icon,
  title,
  subtitle,
  meta,
  statusLabel,
  statusTone,
  priorityLabel,
  rightLabel,
  dominant,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  meta?: string;
  statusLabel: string;
  statusTone: SLStatusTone;
  priorityLabel?: string;
  rightLabel?: string;
  dominant?: boolean;
  onPress: () => void;
}) {
  const color = toneColor(statusTone);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sessionRow, dominant && styles.sessionRowDominant, pressed && styles.pressed]}>
      <View style={[styles.sessionIcon, { borderColor: color }]}>
        <Ionicons color={color} name={icon} size={15} />
      </View>
      <View style={styles.sessionCopy}>
        <View style={styles.sessionTitleRow}>
          <Text numberOfLines={1} style={styles.sessionTitle}>{title}</Text>
          {priorityLabel ? <Text style={[styles.priorityText, { color }]}>{priorityLabel}</Text> : null}
        </View>
        <Text numberOfLines={1} style={styles.sessionSubtitle}>{[subtitle, meta].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={styles.sessionStatusWrap}>
        {rightLabel ? <Text numberOfLines={1} style={styles.rightLabel}>{rightLabel}</Text> : null}
        <Text numberOfLines={1} style={[styles.sessionStatus, { color }]}>{statusLabel}</Text>
      </View>
    </Pressable>
  );
}

function CalendarInlineEmpty({ title, detail }: { title: string; detail?: string }) {
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

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    gap: 18,
    paddingBottom: 112,
    paddingTop: 3,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.md,
    justifyContent: 'space-between',
  },
  header: {
    flex: 1,
    minWidth: 0,
    paddingLeft: SLSpacing.md,
    position: 'relative',
  },
  headerRail: {
    backgroundColor: SLColors.railViolet,
    bottom: 2,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    top: 2,
    width: 3,
  },
  title: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: SLTypography.commandTitle.fontSize,
    fontWeight: SLTypography.commandTitle.fontWeight,
    letterSpacing: SLTypography.commandTitle.letterSpacing,
    lineHeight: SLTypography.commandTitle.lineHeight,
  },
  weekNav: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.xs,
  },
  weekLabelText: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  metricStrip: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  metricCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  metricValue: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.kpiNumber.fontFamily,
    fontSize: 21,
    fontWeight: SLTypography.kpiNumber.fontWeight,
    lineHeight: 24,
  },
  metricLabel: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 13,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  filterSummaryBar: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  filterSummaryTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  filterSummaryTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.label.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.label.lineHeight,
  },
  filterSummaryMeta: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.caption.lineHeight,
  },
  utilityChip: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 31,
    paddingHorizontal: 9,
  },
  utilityChipSelected: {
    backgroundColor: SLColors.object,
    borderColor: SLColors.borderSubtle,
  },
  utilityChipText: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.chipLabel.fontFamily,
    fontSize: SLTypography.chipLabel.fontSize,
    fontWeight: SLTypography.chipLabel.fontWeight,
    lineHeight: SLTypography.chipLabel.lineHeight,
  },
  filterSheet: {
    backgroundColor: SLColors.surfaceCommand,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    gap: SLSpacing.md,
    maxWidth: 560,
    padding: SLSpacing.lg,
    width: '100%',
  },
  filterSheetSection: {
    gap: SLSpacing.sm,
  },
  filterSheetLabel: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.label.fontFamily,
    fontSize: SLTypography.label.fontSize,
    fontWeight: SLTypography.label.fontWeight,
    lineHeight: SLTypography.label.lineHeight,
  },
  filterChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLSpacing.xs,
  },
  filterSheetActions: {
    gap: SLSpacing.sm,
  },
  section: {
    gap: 9,
  },
  dayStack: {
    gap: 16,
  },
  dayBucket: {
    gap: 0,
  },
  dayHeader: {
    alignItems: 'center',
    borderBottomColor: CALENDAR_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'space-between',
    minHeight: 36,
    paddingBottom: SLSpacing.xs,
  },
  dayTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.sectionLabel.fontFamily,
    fontSize: SLTypography.label.fontSize,
    fontWeight: SLTypography.sectionLabel.fontWeight,
    lineHeight: SLTypography.label.lineHeight,
  },
  dayMeta: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.caption.lineHeight,
  },
  rowStack: {
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    overflow: 'hidden',
  },
  emptyDay: {
    minHeight: 42,
    justifyContent: 'center',
  },
  emptyDayText: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceScrim,
    flex: 1,
    justifyContent: 'flex-end',
    padding: SLSpacing.lg,
  },
  sheet: {
    backgroundColor: SLColors.surfaceCommand,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    gap: SLSpacing.lg,
    maxHeight: '88%',
    maxWidth: 560,
    padding: SLSpacing.lg,
    width: '100%',
  },
  dateSheet: {
    backgroundColor: SLColors.surfaceCommand,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    gap: SLSpacing.md,
    maxWidth: 560,
    padding: SLSpacing.lg,
    width: '100%',
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.md,
    justifyContent: 'space-between',
  },
  sheetTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  sheetTitle: {
    color: SLColors.textStrong,
    flexShrink: 1,
    fontFamily: SLTypography.cardTitle.fontFamily,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: SLTypography.cardTitle.fontWeight,
    lineHeight: SLTypography.cardTitle.lineHeight,
  },
  sheetSubtitle: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sheetActions: {
    gap: SLSpacing.sm,
    paddingBottom: SLSpacing.xs,
  },
  sheetActionsScroll: {
    maxHeight: 640,
  },
  movePanel: {
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    gap: SLSpacing.sm,
    marginTop: SLSpacing.xs,
    padding: SLSpacing.md,
  },
  moveLabel: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.label.fontFamily,
    fontSize: SLTypography.label.fontSize,
    fontWeight: SLTypography.label.fontWeight,
    lineHeight: SLTypography.label.lineHeight,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 42,
    paddingHorizontal: SLSpacing.md,
  },
  dateButtonText: {
    color: SLColors.text,
    fontFamily: SLTypography.label.fontFamily,
    fontSize: SLTypography.label.fontSize,
    fontWeight: SLTypography.label.fontWeight,
  },
  sheetDatePickerPanel: {
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    gap: SLSpacing.sm,
    padding: SLSpacing.sm,
  },
  inlineDatePicker: {
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    // overflow: 'hidden', // Removed to avoid clipping spinner on iOS
    padding: SLSpacing.xs,
  },
  moveError: {
    color: SLColors.danger,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  actionHint: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  sessionRow: {
    alignItems: 'center',
    borderBottomColor: CALENDAR_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 62,
    overflow: 'hidden',
    paddingRight: SLSpacing.sm,
  },
  sessionRowDominant: {
    backgroundColor: CALENDAR_MATERIAL.surfaceSoft,
    minHeight: 68,
  },
  sessionRail: {
    alignSelf: 'stretch',
    opacity: 0.78,
    width: 4,
  },
  sessionIcon: {
    alignItems: 'center',
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    borderRadius: SLRadius.radiusSharp,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  sessionTitle: {
    color: SLColors.textStrong,
    flex: 1,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
    minWidth: 0,
  },
  priorityText: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 9,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  sessionSubtitle: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
    marginTop: 2,
  },
  sessionStatusWrap: {
    alignItems: 'flex-end',
    maxWidth: 92,
  },
  rightLabel: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 9,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  sessionStatus: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.22,
    lineHeight: 13,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  inlineEmpty: {
    alignItems: 'center',
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    borderBottomColor: CALENDAR_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 48,
    paddingHorizontal: SLSpacing.md,
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
  pressed: {
    opacity: 0.78,
  },
  blockCurrentText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  blockList: {
    maxHeight: 360,
  },
  blockListContent: {
    gap: SLSpacing.sm,
  },
  blockOption: {
    backgroundColor: CALENDAR_MATERIAL.surfaceSubtle,
    borderColor: CALENDAR_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    padding: SLSpacing.md,
  },
  blockOptionSelected: {
    borderColor: SLColors.accentViolet,
  },
  blockOptionTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.label.fontFamily,
    fontSize: SLTypography.label.fontSize,
    fontWeight: SLTypography.label.fontWeight,
  },
  blockOptionMeta: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
    marginTop: 2,
  },
  dateDoneRow: {
    paddingTop: SLSpacing.sm,
  },
});
