import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, StyleSheet, View } from 'react-native';

import {
  parseYmd,
  toYmd,
  type AthleteCalendarAction,
  type AthleteCalendarConflict,
  type AthleteCalendarDay,
  type AthleteCalendarDayDetail,
  type AthleteCalendarExperienceData,
  type AthleteCalendarImportantDate,
  type AthleteCalendarPersonalEvent,
  type AthleteCalendarSession,
  type AthleteCalendarWeekSummary,
} from '@/components/calendar/AthleteCalendarExperience';
import { AthleteCalendarStoryboardV2 } from '@/components/calendar/AthleteCalendarStoryboardV2';
import { CalendarEventSheet, type CalendarEventMutation } from '@/components/calendar/CalendarEventSheet';
import { TrainingScheduleSheet, type TrainingScheduleMutation } from '@/components/calendar/TrainingScheduleSheet';
import { ReadinessModal, type ReadinessModalValues } from '@/components/workout-logger/readiness-modal';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLTypography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchJson, getDeviceTimezone } from '@/lib/api';
import {
  canSelfCoachRescheduleSessions,
  isAthleteCalendarDropTargetValid,
  withAthleteCalendarSessionDate,
} from '@/lib/athlete-calendar-reschedule';
import type { CalendarRepeatRule } from '@/lib/calendar-event-form';
import { rangeContainsDate, resolveCalendarToday } from '@/lib/calendar-today';
import {
  buildReadinessPayload,
  bodyweightKgToDisplay,
  normalizeReadinessUnit,
  readinessPositionFromCanonical,
  sleepPositionFromHours,
} from '@/lib/readiness';
import {
  canonicalCalendarRangeForMonth,
  calendarRangeKey,
  createCalendarRangeRequestManager,
  nextCalendarRange,
  previousCalendarRange,
} from '@/lib/calendar-range-pagination';

type ApiSession = {
  workout_id: number; title?: string | null; date?: string | null; status?: string | null;
  block_id?: number | null; block_name?: string | null; planned_summary?: string | null;
  primary_lifts?: string[]; accessory_count?: number | null; estimated_duration_minutes?: number | null;
  pr_count?: number | null;
  scheduled_start_time?: string | null; scheduled_end_time?: string | null;
  scheduled_timezone?: string | null;
};
type ApiPersonalEvent = {
  event_id: number; title: string; starts_at: string; ends_at: string; all_day: boolean; timezone: string;
  category?: string | null; location?: string | null; notes?: string | null; unavailable_for_training: boolean;
  repeat_rule?: CalendarRepeatRule; alert_offset_minutes?: number | null;
};
type ApiDay = {
  date: string; is_today?: boolean | null; training_status?: string | null; sessions?: ApiSession[];
  personal_events?: ApiPersonalEvent[];
  check_ins?: { submission_id: number; title?: string | null; status?: string | null }[];
  meets?: { meet_plan_id: number; name?: string | null; date?: string | null; status?: string | null }[];
};
type ApiReadiness = {
  id: number; date: string; workout_id?: number | null; score?: number | null;
  sleep_quality?: number | null; sleep_hours?: number | null; soreness?: number | null;
  stress?: number | null; energy?: number | null; bodyweight_kg?: number | null;
  submitted_at?: string | null;
};
type ApiDayDetailSession = {
  workout_id: number; title?: string | null; date: string; status?: string | null;
  scheduled_start_time?: string | null; scheduled_timezone?: string | null;
  block_id?: number | null; block_name?: string | null; programming_notes?: string | null;
  planned?: { movement_count?: number; movement_labels?: string[]; planned_sets?: number; label?: string | null } | null;
  performance?: { completed_sets?: number; total_reps?: number; total_volume_kg?: number; actual_duration_minutes?: number | null; best_set?: { weight_kg?: number; reps?: number; rpe?: number | null; rir?: number | null } | null } | null;
  estimated_duration_minutes?: number | null;
  reflection?: { session_rpe?: number | null; strength?: string | null; fatigue?: string | null; note?: string | null; submitted_at?: string | null } | null;
  readiness?: ApiReadiness | null;
  accomplishment?: {
    count?: number;
    movement_labels?: string[];
    highest_priority?: {
      id?: number | string | null; event_type?: string | null; movement_label?: string | null;
      current_value?: number | null; prior_value?: number | null; delta?: number | null;
      unit?: string | null; presentation_mode?: string | null;
    } | null;
  } | null;
  missed_context?: { reason?: string | null; comment?: string | null } | null;
};
type ApiDayDetail = {
  date: string; timezone?: string | null; is_today?: boolean; state?: AthleteCalendarDayDetail['state'];
  sessions?: ApiDayDetailSession[]; readiness?: ApiReadiness | null; personal_events?: ApiPersonalEvent[];
  conflicts?: ApiConflict[];
  block_context?: { block_id: number; name?: string | null; start_date?: string | null; end_date?: string | null; week_number?: number | null; total_weeks?: number | null } | null;
  next_up?: { workout_id: number; title?: string | null; date: string; status?: string | null; planned_summary?: string | null; block_name?: string | null } | null;
  capabilities?: { can_add_personal_item?: boolean; can_create_session?: boolean };
};
type ApiUpcoming = { date?: string | null; kind?: string | null; title?: string | null; workout_id?: number | null; meet_plan_id?: number | null; block_id?: number | null };
type ApiConflict = { conflict_id: string; certainty: 'confirmed' | 'potential'; reason: string; date: string; event_id: number; event_title: string; workout_id: number; workout_title: string };
type ApiWeekSummary = { start_date: string; end_date: string; session_count: number; completed_count: number; missed_count: number; heavy_count: number; personal_event_count: number; is_current: boolean; load_label: string };
type ApiMonthSummary = {
  month: string; metric_kind?: string | null; session_count: number; completed_count: number; upcoming_count: number;
  planned_count: number; due_count?: number | null; due_completed_count?: number | null; missed_count?: number | null;
  completion_percent?: number | null; total_volume_kg: number; pr_count: number;
  reported_bodyweight?: { start_kg: number; latest_kg: number; observation_count: number } | null;
  block_names?: string[];
};
type ApiRange = { id?: number | string; start: string; end: string; label: string };
type ApiProgramContext = { id?: number | string; name?: string | null; start: string; end: string };
type CalendarPayload = {
  today?: string | null; days?: ApiDay[]; upcoming?: ApiUpcoming[]; conflicts?: ApiConflict[];
  week_summaries?: ApiWeekSummary[]; ranges?: ApiRange[]; can_edit_programming?: boolean;
  month_summaries?: ApiMonthSummary[];
  program_context?: ApiProgramContext | null;
  range?: { start_date?: string | null; end_date?: string | null; timezone?: string | null };
};

function makeCalendarRequestManager(cacheScope: string) {
  return createCalendarRangeRequestManager<CalendarPayload>(async (range, signal) => {
    const query = new URLSearchParams({ start: range.start, end: range.end });
    const response = await fetchJson(`/athletes/mobile/calendar?${query.toString()}`, {
      method: 'GET',
      signal,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok || response.json?.ok !== true) {
      throw new Error(response.json?.error || 'Calendar could not load.');
    }
    return response.json.athlete_calendar || {};
  }, { cacheScope });
}

export default function AthleteCalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const calendarIdentityScope = [
    user?.email || 'signed-out',
    user?.athlete_id ?? 'no-athlete',
    user?.mobile_mode || user?.role || 'no-mode',
  ].join('|');
  const requestManagerRef = useRef<ReturnType<typeof makeCalendarRequestManager> | null>(null);
  const requestScopeRef = useRef(calendarIdentityScope);
  if (!requestManagerRef.current) requestManagerRef.current = makeCalendarRequestManager(calendarIdentityScope);
  const activeCanonicalRangeRef = useRef('');
  const pageRequestActiveRef = useRef(false);
  const previousPageRequestActiveRef = useRef(false);
  const didSyncInitialAthleteTodayRef = useRef(false);
  const userMovedAnchorRef = useRef(false);
  const [anchorMonth, setAnchorMonth] = useState(() => startOfMonth(new Date()));
  const [payload, setPayload] = useState<CalendarPayload | null>(null);
  const [payloadOwnerScope, setPayloadOwnerScope] = useState(calendarIdentityScope);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const [loadedRangeEnd, setLoadedRangeEnd] = useState<string | null>(null);
  const [loadedRangeStart, setLoadedRangeStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ visible: boolean; date: string; event?: AthleteCalendarPersonalEvent | null }>({ visible: false, date: toYmd(new Date()) });
  const [mutationBusy, setMutationBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [eventMutationError, setEventMutationError] = useState<string | null>(null);
  const [navigationRevision, setNavigationRevision] = useState(0);
  const [scheduleEditor, setScheduleEditor] = useState<AthleteCalendarSession | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleFieldError, setScheduleFieldError] = useState<string | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [currentToday, setCurrentToday] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => toYmd(new Date()));
  const [dayDetail, setDayDetail] = useState<AthleteCalendarDayDetail | null>(null);
  const [dayDetailLoading, setDayDetailLoading] = useState(false);
  const [dayDetailError, setDayDetailError] = useState<string | null>(null);
  const [dailyReadinessVisible, setDailyReadinessVisible] = useState(false);
  const [dailyReadinessSubmitting, setDailyReadinessSubmitting] = useState(false);
  const [dailyReadinessError, setDailyReadinessError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [dailyReadinessValues, setDailyReadinessValues] = useState<ReadinessModalValues>({
    bodyweight: '',
    bodyweightSkipped: true,
    sleepPosition: 0.5,
    energyPosition: 0.5,
    sorenessPosition: 0.5,
    stressPosition: 0.5,
  });
  const dayDetailCacheRef = useRef(new Map<string, AthleteCalendarDayDetail>());
  const dayDetailAbortRef = useRef<AbortController | null>(null);
  const dayDetailRequestRef = useRef(0);
  const visiblePayload = payloadOwnerScope === calendarIdentityScope ? payload : null;
  const preferredUnits = user?.preferred_units;
  const canRescheduleSessions = canSelfCoachRescheduleSessions({
    canEditProgramming: visiblePayload?.can_edit_programming,
    isSelfCoached: user?.is_self_coached === true
      || user?.is_individual_workspace === true
      || user?.workspace_mode === 'individual',
  });

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => canonicalCalendarRangeForMonth(anchorMonth),
    [anchorMonth],
  );
  const load = useCallback(async (force = false, silent = false) => {
    const requestScope = calendarIdentityScope;
    const range = { start: rangeStart, end: rangeEnd };
    const requestKey = calendarRangeKey(range, requestScope);
    activeCanonicalRangeRef.current = requestKey;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      if (force) requestManagerRef.current!.clear();
      const result = await requestManagerRef.current!.request(range, { cancelStale: true, force });
      if (requestScopeRef.current !== requestScope || activeCanonicalRangeRef.current !== result.key) return;
      setPayload(result.value);
      setPayloadOwnerScope(requestScope);
      setLoadedRangeStart(rangeStart);
      setLoadedRangeEnd(rangeEnd);
      setPaginationError(null);
    } catch (caught: any) {
      if (isAbortError(caught)) return;
      if (requestScopeRef.current !== requestScope) return;
      setError(caught?.message || 'Calendar could not load.');
    } finally {
      if (requestScopeRef.current === requestScope) {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [calendarIdentityScope, rangeEnd, rangeStart]);

  useEffect(() => () => requestManagerRef.current?.cancelAll(), []);

  const loadDayDetail = useCallback(async (date: string, force = false) => {
    if (!force) {
      const cached = dayDetailCacheRef.current.get(date);
      if (cached) {
        setDayDetail(cached);
        setDayDetailError(null);
        return;
      }
    }
    dayDetailAbortRef.current?.abort();
    const controller = new AbortController();
    dayDetailAbortRef.current = controller;
    const requestRevision = ++dayDetailRequestRef.current;
    setDayDetailLoading(true);
    setDayDetailError(null);
    try {
      const query = new URLSearchParams({ date });
      const response = await fetchJson(`/athletes/mobile/calendar/day?${query.toString()}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok || response.json?.ok !== true) {
        throw new Error(response.json?.error || 'Day details could not load.');
      }
      if (requestRevision !== dayDetailRequestRef.current || controller.signal.aborted) return;
      const mapped = mapDayDetail(response.json.calendar_day || {});
      dayDetailCacheRef.current.set(date, mapped);
      setDayDetail(mapped);
    } catch (caught: any) {
      if (isAbortError(caught)) return;
      if (requestRevision !== dayDetailRequestRef.current) return;
      setDayDetailError(caught?.message || 'Day details could not load.');
    } finally {
      if (requestRevision === dayDetailRequestRef.current) setDayDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDayDetail(selectedDate);
    return () => dayDetailAbortRef.current?.abort();
  }, [loadDayDetail, selectedDate]);

  useEffect(() => {
    if (requestScopeRef.current === calendarIdentityScope) return;
    requestManagerRef.current?.cancelAll();
    requestManagerRef.current?.clear();
    requestManagerRef.current = makeCalendarRequestManager(calendarIdentityScope);
    requestScopeRef.current = calendarIdentityScope;
    activeCanonicalRangeRef.current = '';
    pageRequestActiveRef.current = false;
    previousPageRequestActiveRef.current = false;
    didSyncInitialAthleteTodayRef.current = false;
    userMovedAnchorRef.current = false;
    setPayload(null);
    setPayloadOwnerScope(calendarIdentityScope);
    setLoadedRangeEnd(null);
    setLoadedRangeStart(null);
    setCurrentToday(null);
    dayDetailAbortRef.current?.abort();
    dayDetailCacheRef.current.clear();
    setDayDetail(null);
    setDayDetailError(null);
    setError(null);
    setPaginationError(null);
    setLoading(true);
  }, [calendarIdentityScope]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useFocusEffect(useCallback(() => { void load(true, false); }, [load]));

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const becameActive = previousState !== 'active' && nextState === 'active';
      previousState = nextState;
      if (becameActive) void load(true, true);
    });
    return () => subscription.remove();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!visiblePayload || pageRequestActiveRef.current || !loadedRangeEnd) return;
    const requestScope = calendarIdentityScope;
    pageRequestActiveRef.current = true;
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const nextRange = nextCalendarRange(loadedRangeEnd);
      const result = await requestManagerRef.current!.request(nextRange);
      if (requestScopeRef.current !== requestScope) return;
      setPayload((current) => mergeCalendarPayload(current, result.value));
      setLoadedRangeEnd(nextRange.end);
    } catch (caught: any) {
      if (isAbortError(caught)) return;
      if (requestScopeRef.current !== requestScope) return;
      setPaginationError(caught?.message || 'More dates could not load.');
    } finally {
      if (requestScopeRef.current === requestScope) {
        pageRequestActiveRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [calendarIdentityScope, loadedRangeEnd, visiblePayload]);

  const loadPrevious = useCallback(async () => {
    if (!visiblePayload || previousPageRequestActiveRef.current || !loadedRangeStart) return;
    const requestScope = calendarIdentityScope;
    previousPageRequestActiveRef.current = true;
    setLoadingPrevious(true);
    setPaginationError(null);
    try {
      const previousRange = previousCalendarRange(loadedRangeStart);
      const result = await requestManagerRef.current!.request(previousRange);
      if (requestScopeRef.current !== requestScope) return;
      setPayload((current) => mergeCalendarPayload(current, result.value));
      setLoadedRangeStart(previousRange.start);
    } catch (caught: any) {
      if (isAbortError(caught)) return;
      if (requestScopeRef.current !== requestScope) return;
      setPaginationError(caught?.message || 'Earlier dates could not load.');
    } finally {
      if (requestScopeRef.current === requestScope) {
        previousPageRequestActiveRef.current = false;
        setLoadingPrevious(false);
      }
    }
  }, [calendarIdentityScope, loadedRangeStart, visiblePayload]);

  const data = useMemo<AthleteCalendarExperienceData>(() => ({
    today: currentToday || visiblePayload?.today || toYmd(new Date()),
    timezone: visiblePayload?.range?.timezone,
    athleteName: user?.user_name || 'Athlete',
    preferredUnits: normalizeReadinessUnit(preferredUnits),
    days: (visiblePayload?.days || []).map(mapDay),
    ranges: visiblePayload?.ranges || [],
    programContext: visiblePayload?.program_context
      ? {
          id: visiblePayload.program_context.id,
          name: visiblePayload.program_context.name,
          start: visiblePayload.program_context.start,
          end: visiblePayload.program_context.end,
        }
      : null,
    importantDates: importantDates(visiblePayload),
    conflicts: (visiblePayload?.conflicts || []).map(mapConflict),
    weekSummaries: (visiblePayload?.week_summaries || []).map(mapWeekSummary),
    monthSummaries: (visiblePayload?.month_summaries || []).map(mapMonthSummary),
  }), [currentToday, preferredUnits, user?.user_name, visiblePayload]);

  useEffect(() => {
    if (!visiblePayload?.today) return;
    setCurrentToday(visiblePayload.today);
    if (!didSyncInitialAthleteTodayRef.current) {
      didSyncInitialAthleteTodayRef.current = true;
      const athleteToday = parseYmd(visiblePayload.today);
      if (athleteToday && !userMovedAnchorRef.current) setAnchorMonth(startOfMonth(athleteToday));
    }
  }, [visiblePayload?.today]);

  const closeEditor = () => {
    if (!mutationBusy) {
      setEditor((current) => ({ ...current, visible: false }));
      setFieldErrors(null);
      setEventMutationError(null);
    }
  };
  const saveEvent = async (eventPayload: CalendarEventMutation) => {
    setMutationBusy(true);
    setFieldErrors(null);
    setEventMutationError(null);
    try {
      const existing = editor.event;
      const response = await fetchJson(existing ? `/athletes/mobile/calendar/events/${existing.id}` : '/athletes/mobile/calendar/events', {
        method: existing ? 'PATCH' : 'POST',
        body: eventPayload as any,
      });
      if (!response.ok || response.json?.ok !== true) {
        if (response.json?.field_errors) setFieldErrors(response.json.field_errors);
        else setEventMutationError(response.json?.error || 'Event could not be saved. Try again.');
        return;
      }
      setEditor((current) => ({ ...current, visible: false }));
      await load(true, true);
      dayDetailCacheRef.current.delete(editor.date);
      if (editor.date === selectedDate) await loadDayDetail(selectedDate, true);
    } catch (caught: any) {
      setEventMutationError(caught?.message || 'Event could not be saved. Try again.');
    } finally {
      setMutationBusy(false);
    }
  };
  const deleteEvent = async () => {
    if (!editor.event) return;
    setMutationBusy(true);
    try {
      const response = await fetchJson(`/athletes/mobile/calendar/events/${editor.event.id}`, { method: 'DELETE' });
      if (!response.ok || response.json?.ok !== true) { Alert.alert('Event not deleted', response.json?.error || 'Try again.'); return; }
      setEditor((current) => ({ ...current, visible: false }));
      await load(true, true);
      dayDetailCacheRef.current.delete(editor.date);
      if (editor.date === selectedDate) await loadDayDetail(selectedDate, true);
    } catch (caught: any) {
      Alert.alert('Event not deleted', caught?.message || 'Try again.');
    } finally { setMutationBusy(false); }
  };

  const openDailyReadiness = () => {
    const readiness = dayDetail?.date === selectedDate ? dayDetail.readiness : null;
    const unit = data.preferredUnits || 'kg';
    const existingBodyweight = bodyweightKgToDisplay(readiness?.bodyweightKg, unit) || '';
    setDailyReadinessValues({
      bodyweight: existingBodyweight,
      bodyweightSkipped: !existingBodyweight,
      sleepPosition: readiness?.sleepHours != null ? sleepPositionFromHours(readiness.sleepHours) : 0.5,
      energyPosition: readinessPositionFromCanonical(readiness?.energy),
      sorenessPosition: readinessPositionFromCanonical(readiness?.soreness),
      stressPosition: readinessPositionFromCanonical(readiness?.stress),
    });
    setDailyReadinessError(null);
    setDailyReadinessVisible(true);
  };

  const submitDailyReadiness = async () => {
    const unit = data.preferredUnits || 'kg';
    const built = buildReadinessPayload(dailyReadinessValues, unit);
    if (!built.payload) {
      setDailyReadinessError(built.error || 'Check the readiness values and try again.');
      return;
    }
    setDailyReadinessSubmitting(true);
    setDailyReadinessError(null);
    try {
      const response = await fetchJson('/athletes/mobile/readiness/daily', {
        method: 'POST',
        body: built.payload as any,
      });
      if (response.status === 409 && response.json?.workout_id) {
        setDailyReadinessVisible(false);
        router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(response.json.workout_id) } });
        return;
      }
      if (!response.ok || response.json?.ok !== true) {
        setDailyReadinessError(response.json?.error || 'Check-in could not be saved.');
        return;
      }
      setDailyReadinessVisible(false);
      dayDetailCacheRef.current.delete(selectedDate);
      await Promise.all([loadDayDetail(selectedDate, true), load(true, true)]);
    } catch (caught: any) {
      if (!isAbortError(caught)) setDailyReadinessError(caught?.message || 'Check-in could not be saved.');
    } finally {
      setDailyReadinessSubmitting(false);
    }
  };

  const handleAction = (action: AthleteCalendarAction) => {
    if (action.type === 'session') { router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(action.id) } }); return; }
    if (action.type === 'create-session') {
      const athleteId = user?.self_athlete_id || user?.athlete_id;
      router.push({
        pathname: '/create-workout',
        params: {
          date: action.date,
          ...(athleteId ? { athleteId: String(athleteId) } : {}),
        },
      } as any);
      return;
    }
    if (action.type === 'schedule-session') {
      setScheduleError(null);
      setScheduleFieldError(null);
      setScheduleEditor(action.session);
      return;
    }
    if (action.type === 'meet' || (action.type === 'important-date' && action.item.kind === 'meet')) { router.push('/(tabs)/athlete-meet-plan' as any); return; }
    if (action.type === 'check-in') { router.push({ pathname: '/(tabs)/check-in/[submissionId]', params: { submissionId: String(action.id), returnTo: 'calendar' } } as any); return; }
    if (action.type === 'daily-readiness') {
      if (action.date === (currentToday || data.today)) openDailyReadiness();
      return;
    }
    if (action.type === 'add-event') { setFieldErrors(null); setEventMutationError(null); setEditor({ visible: true, date: action.date }); return; }
    if (action.type === 'edit-event') { setFieldErrors(null); setEventMutationError(null); setEditor({ visible: true, date: action.event.startsAt.slice(0, 10), event: action.event }); return; }
    if (action.type === 'review-conflict') { showConflict(action.conflict, router, () => setEditor({ visible: true, date: action.conflict.date, event: findEvent(data.days, action.conflict.eventId) })); return; }
    if (action.type === 'important-date' && action.item.kind === 'session' && action.item.targetId) router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(action.item.targetId) } });
  };
  const goToday = () => {
    const target = resolveCalendarToday(new Date(), visiblePayload?.range?.timezone, getDeviceTimezone());
    const targetDate = parseYmd(target.date) || new Date();
    const targetMonth = startOfMonth(targetDate);
    const rangeMissingToday = !rangeContainsDate(visiblePayload?.range?.start_date, visiblePayload?.range?.end_date, target.date);
    const monthAlreadyAnchored =
      targetMonth.getFullYear() === anchorMonth.getFullYear()
      && targetMonth.getMonth() === anchorMonth.getMonth();
    userMovedAnchorRef.current = true;
    setCurrentToday(target.date);
    setSelectedDate(target.date);
    setAnchorMonth(targetMonth);
    setNavigationRevision((current) => current + 1);
    if (rangeMissingToday) {
      // Changing the anchor causes the focused range loader to fetch only the
      // month-sized buffered range that contains the new current date.
      activeCanonicalRangeRef.current = '';
      if (monthAlreadyAnchored) void load(true, true);
    }
    return target.date;
  };
  const changeMonth = (month: Date) => {
    userMovedAnchorRef.current = true;
    setAnchorMonth(month);
  };

  const saveTrainingSchedule = async (mutation: TrainingScheduleMutation) => {
    if (!scheduleEditor) return;
    setScheduleBusy(true);
    setScheduleError(null);
    setScheduleFieldError(null);
    try {
      const response = await fetchJson(`/athletes/mobile/calendar/sessions/${scheduleEditor.id}/schedule`, {
        method: 'PATCH',
        body: mutation as any,
      });
      if (!response.ok || response.json?.ok !== true) {
        setScheduleFieldError(response.json?.field_errors?.start_time || null);
        setScheduleError(response.json?.field_errors?.start_time ? null : response.json?.error || 'Training time could not be saved.');
        return;
      }
      setScheduleEditor(null);
      await load(true, true);
      dayDetailCacheRef.current.delete(scheduleEditor.date || selectedDate);
      if ((scheduleEditor.date || selectedDate) === selectedDate) await loadDayDetail(selectedDate, true);
    } catch (caught: any) {
      if (!isAbortError(caught)) setScheduleError(caught?.message || 'Training time could not be saved.');
    } finally {
      setScheduleBusy(false);
    }
  };

  const moveSession = useCallback(async (session: AthleteCalendarSession, date: string) => {
    const originalDate = session.date || '';
    const today = currentToday || visiblePayload?.today || toYmd(new Date());
    if (!canRescheduleSessions || !isAthleteCalendarDropTargetValid({ session, destinationDate: date, today })) return;
    const rollbackPayload = visiblePayload;

    const projectedSession: ApiSession = {
      workout_id: session.id,
      title: session.title,
      date: originalDate,
      status: session.status,
      block_id: session.blockId,
      block_name: session.blockName,
      planned_summary: session.plannedSummary,
      primary_lifts: session.primaryLifts,
      accessory_count: session.accessoryCount,
      estimated_duration_minutes: session.estimatedDurationMinutes,
      pr_count: session.prCount,
      scheduled_start_time: session.scheduledStartTime,
      scheduled_end_time: session.scheduledEndTime,
      scheduled_timezone: session.scheduledTimezone,
    };

    setRescheduleBusy(true);
    setPayload((current) => withAthleteCalendarSessionDate(current, projectedSession, date));
    try {
      const response = await fetchJson<{ ok: boolean; error?: string; noop?: boolean }>(
        `/coach/mobile/workouts/${session.id}/move`,
        { method: 'POST', body: { date } as any },
      );
      if (!response.ok || response.json?.ok !== true) {
        setPayload((current) => rollbackPayload || withAthleteCalendarSessionDate(current, projectedSession, originalDate));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Move failed', response.json?.error || 'The Session remains on its original date.');
        return;
      }

      dayDetailCacheRef.current.delete(originalDate);
      dayDetailCacheRef.current.delete(date);
      setScheduleEditor(null);
      await load(true, true);
      if (selectedDate === originalDate || selectedDate === date) await loadDayDetail(selectedDate, true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught: any) {
      setPayload((current) => rollbackPayload || withAthleteCalendarSessionDate(current, projectedSession, originalDate));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Move failed', caught?.message || 'The Session remains on its original date.');
    } finally {
      setRescheduleBusy(false);
    }
  }, [canRescheduleSessions, currentToday, load, loadDayDetail, selectedDate, visiblePayload]);

  return (
    <View style={styles.root}>
      {loading && !visiblePayload ? (
        <View style={styles.inlineLoading}>
          <ActivityIndicator color={SLColors.accentViolet} />
          <Text style={styles.inlineErrorText}>Loading Calendar…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.inlineError}>
          <Ionicons color={SLColors.danger} name="cloud-offline-outline" size={17} />
          <Text style={styles.inlineErrorText}>{error}</Text>
          <Text onPress={() => void load(true, true)} style={styles.inlineRetry}>Retry</Text>
        </View>
      ) : null}
      {visiblePayload ? <AthleteCalendarStoryboardV2
        anchorMonth={anchorMonth}
        canManagePersonalEvents={user?.role === 'athlete'}
        canRescheduleSessions={canRescheduleSessions}
        data={data}
        dayDetail={dayDetail?.date === selectedDate ? dayDetail : null}
        dayDetailError={dayDetailError}
        dayDetailLoading={dayDetailLoading}
        loadingMore={loadingMore}
        loadingPrevious={loadingPrevious}
        onAction={handleAction}
        onLoadMore={() => void loadMore()}
        onLoadPrevious={() => void loadPrevious()}
        onMonthChange={changeMonth}
        onMoveSession={(session, date) => void moveSession(session, date)}
        onRetryDayDetail={() => void loadDayDetail(selectedDate, true)}
        onSelectedDateChange={setSelectedDate}
        onRefresh={() => void load(true, true)}
        onRetryLoadMore={() => void loadMore()}
        onToday={goToday}
        navigationRevision={navigationRevision}
        paginationError={paginationError}
        refreshing={refreshing}
        rescheduleBusy={rescheduleBusy}
        reduceMotion={reduceMotion}
        selectedDate={selectedDate}
      /> : null}
      <ReadinessModal
        context="daily"
        error={dailyReadinessError}
        onCancel={() => { if (!dailyReadinessSubmitting) setDailyReadinessVisible(false); }}
        onChange={setDailyReadinessValues}
        onSubmit={() => void submitDailyReadiness()}
        priorBodyweightKg={dayDetail?.date === selectedDate ? dayDetail.readiness?.bodyweightKg : null}
        reduceMotion={reduceMotion}
        submitting={dailyReadinessSubmitting}
        unit={data.preferredUnits || 'kg'}
        values={dailyReadinessValues}
        visible={dailyReadinessVisible}
      />
      <CalendarEventSheet busy={mutationBusy} event={editor.event} initialDate={editor.date} onClose={closeEditor} onDelete={editor.event ? deleteEvent : undefined} onSave={saveEvent} saveError={eventMutationError} serverErrors={fieldErrors} timezone={data.timezone} visible={editor.visible} />
      <TrainingScheduleSheet
        busy={scheduleBusy || rescheduleBusy}
        canRescheduleDate={canRescheduleSessions}
        error={scheduleError}
        fieldError={scheduleFieldError}
        minimumDate={data.today}
        onClose={() => { if (!scheduleBusy && !rescheduleBusy) setScheduleEditor(null); }}
        onOpenSession={() => {
          if (!scheduleEditor) return;
          const workoutId = scheduleEditor.id;
          setScheduleEditor(null);
          router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(workoutId) } });
        }}
        onMoveDate={(date) => { if (scheduleEditor) void moveSession(scheduleEditor, date); }}
        onSave={saveTrainingSchedule}
        session={scheduleEditor}
        visible={!!scheduleEditor}
      />
    </View>
  );
}

function mapDay(day: ApiDay): AthleteCalendarDay {
  return {
    date: day.date,
    isToday: day.is_today === true,
    trainingStatus: day.training_status,
    sessions: (day.sessions || []).map(mapSession),
    personalEvents: (day.personal_events || []).map(mapEvent),
    meets: (day.meets || []).map((meet) => ({ id: meet.meet_plan_id, name: meet.name, date: meet.date, status: meet.status })),
    checkIns: (day.check_ins || []).map((checkIn) => ({ id: checkIn.submission_id, title: checkIn.title, status: checkIn.status })),
  };
}
function mapDayDetail(day: ApiDayDetail): AthleteCalendarDayDetail {
  return {
    date: day.date,
    timezone: day.timezone,
    isToday: day.is_today === true,
    state: day.state || 'rest',
    sessions: (day.sessions || []).map((session) => ({
      id: session.workout_id,
      title: session.title,
      date: session.date,
      status: session.status,
      scheduledStartTime: session.scheduled_start_time,
      scheduledTimezone: session.scheduled_timezone,
      blockId: session.block_id,
      blockName: session.block_name,
      programmingNotes: session.programming_notes,
      planned: {
        movementCount: session.planned?.movement_count || 0,
        movementLabels: session.planned?.movement_labels || [],
        plannedSets: session.planned?.planned_sets || 0,
        label: session.planned?.label,
      },
      performance: session.performance ? {
        completedSets: session.performance.completed_sets || 0,
        totalReps: session.performance.total_reps || 0,
        totalVolumeKg: session.performance.total_volume_kg || 0,
        actualDurationMinutes: session.performance.actual_duration_minutes,
        bestSet: session.performance.best_set ? {
          weightKg: session.performance.best_set.weight_kg || 0,
          reps: session.performance.best_set.reps || 0,
          rpe: session.performance.best_set.rpe,
          rir: session.performance.best_set.rir,
        } : null,
      } : null,
      estimatedDurationMinutes: session.estimated_duration_minutes,
      reflection: session.reflection ? {
        sessionRpe: session.reflection.session_rpe,
        strength: session.reflection.strength,
        fatigue: session.reflection.fatigue,
        note: session.reflection.note,
      } : null,
      readiness: mapReadiness(session.readiness),
      accomplishment: session.accomplishment ? {
        count: session.accomplishment.count || 0,
        movementLabels: session.accomplishment.movement_labels || [],
        highestPriority: session.accomplishment.highest_priority ? {
          id: session.accomplishment.highest_priority.id,
          eventType: session.accomplishment.highest_priority.event_type,
          movementLabel: session.accomplishment.highest_priority.movement_label,
          currentValue: session.accomplishment.highest_priority.current_value,
          priorValue: session.accomplishment.highest_priority.prior_value,
          delta: session.accomplishment.highest_priority.delta,
          unit: session.accomplishment.highest_priority.unit,
          presentationMode: session.accomplishment.highest_priority.presentation_mode,
        } : null,
      } : null,
      missedContext: session.missed_context ? {
        reason: session.missed_context.reason,
        comment: session.missed_context.comment,
      } : null,
    })),
    readiness: mapReadiness(day.readiness),
    personalEvents: (day.personal_events || []).map(mapEvent),
    conflicts: (day.conflicts || []).map(mapConflict),
    blockContext: day.block_context ? {
      id: day.block_context.block_id,
      name: day.block_context.name,
      startDate: day.block_context.start_date,
      endDate: day.block_context.end_date,
      weekNumber: day.block_context.week_number,
      totalWeeks: day.block_context.total_weeks,
    } : null,
    nextUp: day.next_up ? {
      id: day.next_up.workout_id,
      title: day.next_up.title,
      date: day.next_up.date,
      status: day.next_up.status,
      plannedSummary: day.next_up.planned_summary,
      blockName: day.next_up.block_name,
    } : null,
    capabilities: {
      canAddPersonalItem: day.capabilities?.can_add_personal_item === true,
      canCreateSession: day.capabilities?.can_create_session === true,
    },
  };
}
function mapReadiness(row?: ApiReadiness | null): AthleteCalendarDayDetail['readiness'] {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    workoutId: row.workout_id,
    score: row.score,
    sleepQuality: row.sleep_quality,
    sleepHours: row.sleep_hours,
    soreness: row.soreness,
    stress: row.stress,
    energy: row.energy,
    bodyweightKg: row.bodyweight_kg,
  };
}
function mapSession(session: ApiSession): AthleteCalendarSession { return { id: session.workout_id, title: session.title, date: session.date, status: session.status, blockId: session.block_id, blockName: session.block_name, plannedSummary: session.planned_summary, primaryLifts: session.primary_lifts, accessoryCount: session.accessory_count, prCount: session.pr_count, estimatedDurationMinutes: session.estimated_duration_minutes, scheduledStartTime: session.scheduled_start_time, scheduledEndTime: session.scheduled_end_time, scheduledTimezone: session.scheduled_timezone, presentation: /heavy|top|peak|test|max/i.test(session.title || '') ? 'heavy' : null }; }
function mapEvent(event: ApiPersonalEvent): AthleteCalendarPersonalEvent { return { id: event.event_id, title: event.title, startsAt: event.starts_at, endsAt: event.ends_at, allDay: event.all_day, timezone: event.timezone, category: event.category, location: event.location, notes: event.notes, repeatRule: event.repeat_rule || 'none', alertOffsetMinutes: event.alert_offset_minutes ?? null, unavailableForTraining: event.unavailable_for_training }; }
function mapConflict(item: ApiConflict): AthleteCalendarConflict { return { id: item.conflict_id, certainty: item.certainty, reason: item.reason, date: item.date, eventId: item.event_id, eventTitle: item.event_title, workoutId: item.workout_id, workoutTitle: item.workout_title }; }
function mapWeekSummary(item: ApiWeekSummary): AthleteCalendarWeekSummary { return { startDate: item.start_date, endDate: item.end_date, sessionCount: item.session_count, completedCount: item.completed_count, missedCount: item.missed_count, heavyCount: item.heavy_count, personalEventCount: item.personal_event_count, isCurrent: item.is_current, loadLabel: item.load_label }; }
function mapMonthSummary(item: ApiMonthSummary) { return { month: item.month, metricKind: item.metric_kind || null, sessionCount: item.session_count || 0, completedCount: item.completed_count || 0, upcomingCount: item.upcoming_count || 0, plannedCount: item.planned_count || 0, dueCount: item.due_count ?? null, dueCompletedCount: item.due_completed_count ?? null, missedCount: item.missed_count ?? null, completionPercent: item.completion_percent ?? null, totalVolumeKg: item.total_volume_kg || 0, prCount: item.pr_count || 0, reportedBodyweight: item.reported_bodyweight ? { startKg: item.reported_bodyweight.start_kg, latestKg: item.reported_bodyweight.latest_kg, observationCount: item.reported_bodyweight.observation_count } : null, blockNames: item.block_names || [] }; }
function findEvent(days: AthleteCalendarDay[], id: number) { for (const day of days) { const event = day.personalEvents?.find((item) => item.id === id); if (event) return event; } return null; }
function showConflict(conflict: AthleteCalendarConflict, router: ReturnType<typeof useRouter>, editEvent: () => void) { Alert.alert(conflict.certainty === 'confirmed' ? 'Schedule conflict' : 'Potential conflict', `${conflict.eventTitle} conflicts with ${conflict.workoutTitle}.\n\n${conflict.reason}`, [{ text: 'Edit Event', onPress: editEvent }, { text: 'Open Training', onPress: () => router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(conflict.workoutId) } }) }, { text: 'Close', style: 'cancel' }]); }
function importantDates(payload: CalendarPayload | null): AthleteCalendarImportantDate[] { const seen = new Set<string>(); const items: AthleteCalendarImportantDate[] = []; for (const item of payload?.upcoming || []) { if (!item.date || !['meet', 'block_marker', 'session'].includes(item.kind || '')) continue; if (item.kind === 'session' && !/test|heavy|peak|max/i.test(item.title || '')) continue; const kind = item.kind === 'meet' ? 'meet' : item.kind === 'block_marker' ? 'block' : 'session'; const targetId = item.meet_plan_id || item.block_id || item.workout_id; const id = `${kind}:${targetId || item.date}:${item.date}`; if (!seen.has(id)) { seen.add(id); items.push({ id, date: item.date, label: item.title || 'Important date', kind, targetId }); } } return items.slice(0, 3); }
function mergeCalendarPayload(current: CalendarPayload | null, next: CalendarPayload | null): CalendarPayload | null {
  if (!current) return next;
  if (!next) return current;
  const mergeBy = <T,>(left: T[] | undefined, right: T[] | undefined, key: (item: T) => string) => {
    const merged = new Map<string, T>();
    for (const item of [...(left || []), ...(right || [])]) merged.set(key(item), item);
    return [...merged.values()];
  };
  return {
    ...current,
    program_context: next.program_context ?? current.program_context,
    days: mergeBy(current.days, next.days, (item) => item.date).sort((a, b) => a.date.localeCompare(b.date)),
    upcoming: mergeBy(current.upcoming, next.upcoming, (item) => `${item.kind}:${item.date}:${item.workout_id || item.meet_plan_id || item.block_id || item.title}`),
    conflicts: mergeBy(current.conflicts, next.conflicts, (item) => item.conflict_id),
    week_summaries: mergeBy(current.week_summaries, next.week_summaries, (item) => item.start_date).sort((a, b) => a.start_date.localeCompare(b.start_date)),
    month_summaries: mergeBy(current.month_summaries, next.month_summaries, (item) => item.month).sort((a, b) => a.month.localeCompare(b.month)),
    ranges: mergeBy(current.ranges, next.ranges, (item) => `${item.id || item.label}:${item.start}:${item.end}`),
  };
}
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function isAbortError(error: unknown) { return error instanceof Error && error.name === 'AbortError'; }
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  inlineLoading: { minHeight: 40, borderRadius: 12, backgroundColor: SLColors.surfaceFlat, borderWidth: 1, borderColor: SLColors.borderHairline, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineError: { minHeight: 40, borderRadius: 12, backgroundColor: SLColors.dangerSoft, borderWidth: 1, borderColor: `${SLColors.danger}55`, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  inlineErrorText: { flex: 1, ...SLTypography.caption, color: SLColors.text },
  inlineRetry: { ...SLTypography.buttonLabel, color: SLColors.accentViolet, padding: 8 },
});
