import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import {
  StrengthLedgerBottomSheet,
  type StrengthLedgerBottomSheetHandle,
} from '@/components/sheets/StrengthLedgerBottomSheet';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLRadius, SLTypography } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

type MuscleFocus = Readonly<{
  primary?: readonly { muscle_id?: string | null; score?: number | null }[];
  source?: string | null;
}>;

export type BlockDetailsSession = Readonly<{
  id: number;
  title?: string | null;
  label?: string | null;
  date?: string | null;
  kind?: string | null;
  status?: string | null;
  estimated_duration_minutes?: number | null;
  preview?: {
    movement_count?: number | null;
    muscle_focus?: MuscleFocus | null;
  } | null;
  recap?: {
    logged_set_count?: number | null;
    session_rpe?: number | null;
    average_rpe?: number | null;
  } | null;
}>;

type BlockDetailsDay = Readonly<{
  date?: string | null;
  label?: string | null;
  day_number?: number | null;
  is_today?: boolean | null;
  kind?: string | null;
  sessions?: BlockDetailsSession[];
}>;

type BlockDetailsWeek = Readonly<{
  week: number;
  label?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  date_range_label?: string | null;
  is_current?: boolean | null;
  position?: 'past' | 'current' | 'future' | string | null;
  sessions?: BlockDetailsSession[];
  days?: BlockDetailsDay[];
  counts?: {
    total?: number | null;
    completed?: number | null;
    upcoming?: number | null;
    missed?: number | null;
    other?: number | null;
  } | null;
}>;

type BlockDetailsPayload = Readonly<{
  block?: {
    id?: number | null;
    name?: string | null;
    current_week?: number | null;
    total_weeks?: number | null;
    week_label?: string | null;
    date_range_label?: string | null;
    progress?: { completed?: number | null; total?: number | null; percent?: number | null } | null;
  } | null;
  summary?: {
    total?: number | null;
    completed?: number | null;
    upcoming?: number | null;
    missed?: number | null;
  } | null;
  weeks?: BlockDetailsWeek[];
}>;

type Props = Readonly<{
  athleteId?: number | null;
  onDismiss: () => void;
  onOpenSession: (session: BlockDetailsSession) => void;
  visible: boolean;
}>;

const tone = {
  current: SLColors.railViolet,
  complete: '#43D786',
  upcoming: '#F2B52C',
  missed: '#F25566',
  none: '#5D616C',
};

export function AthleteBlockDetailsSheet({ athleteId, onDismiss, onOpenSession, visible }: Props) {
  const sheetRef = useRef<StrengthLedgerBottomSheetHandle>(null);
  const pendingSessionRef = useRef<BlockDetailsSession | null>(null);
  const [details, setDetails] = useState<BlockDetailsPayload | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const query = athleteId ? `?athlete_id=${encodeURIComponent(String(athleteId))}` : '';
      const response = await fetchJson(`/workouts/mobile/training-hub/block-details${query}`, { method: 'GET' });
      const json: any = response.json || {};
      if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
      const nextDetails: BlockDetailsPayload | null = json.block_details || null;
      setDetails(nextDetails);
      const weeks = nextDetails?.weeks || [];
      const current = weeks.find((week) => week.is_current)
        || weeks.find((week) => week.week === Number(nextDetails?.block?.current_week || 0))
        || weeks[0];
      setExpandedWeek(current?.week ?? null);
    } catch (reason: any) {
      setError(reason?.message || 'Block Details could not load.');
      setDetails(null);
      setExpandedWeek(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useEffect(() => {
    if (visible) load(false);
  }, [load, visible]);

  const handleDismiss = useCallback(() => {
    const pending = pendingSessionRef.current;
    pendingSessionRef.current = null;
    onDismiss();
    if (pending) onOpenSession(pending);
  }, [onDismiss, onOpenSession]);
  const openSession = useCallback((session: BlockDetailsSession) => {
    pendingSessionRef.current = session;
    sheetRef.current?.dismiss();
  }, []);

  const block = details?.block;
  const progress = Math.max(0, Math.min(1, Number(block?.progress?.percent || 0)));
  const summary = details?.summary;

  return (
    <StrengthLedgerBottomSheet
      accessibilityLabel="Block Details"
      heightFraction={0.93}
      motionPreset="deliberate"
      onDismiss={handleDismiss}
      ref={sheetRef}
      testID="athlete-block-details-sheet"
      visible={visible}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={SLColors.accentViolet} />}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.titleRow}>
          <Ionicons color={SLColors.accentViolet} name="calendar-outline" size={23} />
          <Text style={styles.sheetTitle}>Block Details</Text>
        </View>

        {loading ? (
          <View style={styles.stateRow}>
            <ActivityIndicator color={SLColors.accentViolet} />
            <Text style={styles.stateText}>Loading your training block…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons color={tone.missed} name="alert-circle-outline" size={22} />
            <Text style={styles.stateText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => load(false)} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : !block ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>No active training block.</Text>
          </View>
        ) : (
          <>
            <View style={styles.blockCard}>
              <View style={styles.blockIdentityRow}>
                <View style={styles.blockMark}>
                  <Ionicons color={SLColors.accentViolet} name="layers" size={22} />
                </View>
                <View style={styles.blockCopy}>
                  <Text numberOfLines={1} style={styles.blockName}>{block.name || 'Training Block'}</Text>
                  <Text numberOfLines={2} style={styles.blockMeta}>
                    {weekAndDates(block)}
                  </Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.progressLabel}>{Number(block.progress?.completed || 0)} / {Number(block.progress?.total || 0)} complete</Text>
              <View style={styles.summaryRow}>
                <SummaryMetric color={tone.complete} label="Complete" value={summary?.completed} />
                <SummaryMetric color={tone.upcoming} label="Upcoming" value={summary?.upcoming} />
                <SummaryMetric color={tone.missed} label="Missed" value={summary?.missed} />
                <SummaryMetric color={SLColors.textPrimary} label="Total" value={summary?.total} />
              </View>
            </View>

            <Text style={styles.sectionLabel}>Block Timeline</Text>
            <View style={styles.timeline}>
              <View pointerEvents="none" style={styles.timelineSpine} />
              {(details?.weeks || []).map((week) => (
                <TimelineWeek
                  current={Boolean(week.is_current || week.week === Number(block.current_week || 0))}
                  expanded={expandedWeek === week.week}
                  key={week.week}
                  onOpenSession={openSession}
                  onPress={() => setExpandedWeek(week.week)}
                  week={week}
                />
              ))}
            </View>
          </>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </StrengthLedgerBottomSheet>
  );
}

function SummaryMetric({ color, label, value }: { color: string; label: string; value?: number | null }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={[styles.summaryValue, { color }]}>{Number(value || 0)}</Text>
      <Text numberOfLines={1} style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function TimelineWeek({
  current,
  expanded,
  onOpenSession,
  onPress,
  week,
}: {
  current: boolean;
  expanded: boolean;
  onOpenSession: (session: BlockDetailsSession) => void;
  onPress: () => void;
  week: BlockDetailsWeek;
}) {
  const weekTone = current ? tone.current : week.position === 'past' ? tone.complete : tone.upcoming;
  const total = Number(week.counts?.total || 0);
  const completed = Number(week.counts?.completed || 0);
  const countLabel = total > 0 ? `${completed} / ${total}` : '0 / 0';
  const dates = week.date_range_label || compactDateRange(week.start_date, week.end_date);
  const orderedSessions = useMemo(
    () => [...(week.sessions || [])].sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')) || left.id - right.id),
    [week.sessions],
  );
  return (
    <View style={[styles.weekRow, current && styles.weekRowCurrent, expanded && styles.weekRowExpanded]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed }) => [styles.weekPressable, pressed && styles.pressed]}
      >
        <View style={styles.weekHeader}>
          <View style={[styles.timelineNode, { borderColor: weekTone }, week.position === 'past' && styles.timelineNodeDone]}>
            {week.position === 'past' ? <Ionicons color={SLColors.canvas} name="checkmark" size={13} /> : <View style={[styles.timelineNodeCore, { backgroundColor: expanded ? weekTone : 'transparent' }]} />}
          </View>
          <View style={styles.weekIdentityCopy}>
            <View style={styles.weekTitleLine}>
              <Text style={[styles.weekName, (expanded || current) && { color: weekTone }]}>W{week.week}</Text>
              {current ? <Text style={styles.currentBadge}>CURRENT</Text> : null}
            </View>
            <Text style={styles.weekDates}>{dates || 'Dates unavailable'}</Text>
          </View>
          <View style={styles.weekCountWrap}>
            <Text style={[styles.weekCount, { color: weekTone }, total === 0 && styles.weekCountEmpty]}>{countLabel}</Text>
            {current ? <Text style={styles.weekCountCaption}>Sessions complete</Text> : null}
          </View>
        </View>
        <View style={[styles.weekPanel, expanded && styles.weekPanelExpanded]}>
          <WeekDayRail days={normalizeWeekDays(week.days || [], week.start_date)} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.agenda}>
          {orderedSessions.length ? orderedSessions.map((session) => (
            <SessionAgendaRow key={session.id} onPress={() => onOpenSession(session)} session={session} />
          )) : <Text style={styles.emptyAgenda}>No Sessions planned for this Week.</Text>}
        </View>
      ) : null}
    </View>
  );
}

function normalizeWeekDays(days: BlockDetailsDay[], startDate?: string | null): BlockDetailsDay[] {
  const byDate = new Map(days.filter((day) => day.date).map((day) => [String(day.date), day]));
  const canBuildDates = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ''));
  return Array.from({ length: 7 }, (_, index) => {
    if (canBuildDates) {
      const [year, month, day] = String(startDate).split('-').map(Number);
      const date = new Date(year, month - 1, day + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return byDate.get(key) || { date: key, day_number: date.getDate(), kind: 'no_session', sessions: [] };
    }
    return days[index] || { day_number: null, kind: 'no_session', sessions: [] };
  });
}

function WeekDayRail({ days }: { days: BlockDetailsDay[] }) {
  return (
    <View style={styles.dayRail} testID="block-week-seven-day-rail">
      {days.map((day, index) => {
        const color = dayTone(day);
        return (
          <View key={day.date || index} style={styles.dayCell}>
            <Text style={[styles.dayLabel, day.is_today && { color: tone.current }]}>{compactWeekday(day.label, index)}</Text>
            <Text style={[styles.dayNumber, day.is_today && { color: tone.current }]}>{day.day_number ?? '–'}</Text>
            <View style={[styles.dayDot, day.kind === 'no_session' ? styles.dayDotNeutral : { backgroundColor: color, borderColor: color }]} />
          </View>
        );
      })}
    </View>
  );
}

function SessionAgendaRow({ onPress, session }: { onPress: () => void; session: BlockDetailsSession }) {
  const statusColor = sessionTone(session.kind || session.status);
  const muscleIds = (session.preview?.muscle_focus?.primary || [])
    .map((row) => String(row.muscle_id || ''))
    .filter((value) => value && value !== 'full_body');
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}>
      <View style={styles.sessionDate}>
        <Text style={styles.sessionDay}>{weekdayFromDate(session.date)}</Text>
        <Text style={styles.sessionDayNumber}>{dayFromDate(session.date)}</Text>
      </View>
      {muscleIds.length ? (
        <View style={styles.sessionArtFrame}>
          <ProgrammingMuscleRegionArt level="session" primary={muscleIds} />
        </View>
      ) : null}
      <View style={styles.sessionCopy}>
        <Text numberOfLines={2} style={styles.sessionTitle}>{session.title || session.label || 'Training Session'}</Text>
        <Text numberOfLines={1} style={styles.sessionEvidence}>{sessionEvidence(session)}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.sessionStatus, { color: statusColor }]}>{sessionStatusLabel(session.kind || session.status)}</Text>
      <Ionicons color={SLColors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function weekAndDates(block: NonNullable<BlockDetailsPayload['block']>) {
  const week = Number(block.current_week || 0);
  const total = Number(block.total_weeks || 0);
  const position = week > 0 && total > 0 ? `Week ${week} of ${total}` : block.week_label || '';
  return [position, block.date_range_label].filter(Boolean).join(' · ');
}

function compactDateRange(start?: string | null, end?: string | null) {
  if (!start || !end) return '';
  return `${shortDate(start)} – ${shortDate(end)}`;
}

function shortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function compactWeekday(value?: string | null, index = 0) {
  const raw = String(value || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]);
  return raw.startsWith('Th') ? 'Th' : raw.startsWith('Sa') ? 'Sa' : raw.startsWith('Su') ? 'Su' : raw.slice(0, 1);
}

function dayTone(day: BlockDetailsDay) {
  if (day.is_today || day.kind === 'today') return tone.current;
  if (day.kind === 'completed') return tone.complete;
  if (day.kind === 'missed') return tone.missed;
  if (day.kind === 'upcoming') return tone.upcoming;
  return tone.none;
}

function sessionTone(value?: string | null) {
  const state = String(value || '').toLowerCase();
  if (state === 'completed' || state === 'logged' || state === 'done') return tone.complete;
  if (state === 'today' || state === 'in_progress') return tone.current;
  if (state === 'missed' || state === 'past_due' || state === 'incomplete') return tone.missed;
  return tone.upcoming;
}

function sessionStatusLabel(value?: string | null) {
  const state = String(value || '').toLowerCase();
  if (state === 'completed' || state === 'logged' || state === 'done') return 'Complete';
  if (state === 'today') return 'Today';
  if (state === 'in_progress') return 'In progress';
  if (state === 'missed' || state === 'past_due') return 'Missed';
  if (state === 'incomplete') return 'Incomplete';
  return 'Upcoming';
}

function sessionEvidence(session: BlockDetailsSession) {
  const movementCount = Number(session.preview?.movement_count || 0);
  const setCount = Number(session.recap?.logged_set_count || 0);
  const rpe = session.recap?.session_rpe ?? session.recap?.average_rpe;
  if (sessionTone(session.kind || session.status) === tone.complete) {
    return [
      movementCount > 0 ? `${movementCount} movement${movementCount === 1 ? '' : 's'}` : null,
      setCount > 0 ? `${setCount} sets` : null,
      rpe != null ? `RPE ${Number(rpe).toFixed(Number(rpe) % 1 ? 1 : 0)}` : null,
    ].filter(Boolean).join(' · ') || 'Completed Session';
  }
  return [
    movementCount > 0 ? `${movementCount} movement${movementCount === 1 ? '' : 's'}` : null,
    session.estimated_duration_minutes ? `~${session.estimated_duration_minutes} min` : null,
  ].filter(Boolean).join(' · ') || 'Assigned Session';
}

function weekdayFromDate(value?: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
}

function dayFromDate(value?: string | null) {
  if (!value) return '';
  return String(Number(value.slice(-2)));
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 10, paddingTop: 4 },
  titleRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, marginBottom: 6 },
  sheetTitle: { fontFamily: SLFontFamilies.sansBold, fontSize: 21, lineHeight: 27, color: SLColors.textPrimary },
  stateRow: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateCard: { minHeight: 150, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, borderRadius: SLRadius.lg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, backgroundColor: SLColors.surfaceInset },
  stateText: { ...SLTypography.body, color: SLColors.textSecondary, textAlign: 'center' },
  retryButton: { minHeight: 42, paddingHorizontal: 18, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderSelected, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...SLTypography.label, color: SLColors.accentMuted },
  blockCard: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStrong, borderRadius: SLRadius.lg, backgroundColor: 'rgba(8,8,13,0.72)' },
  blockIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 11, paddingTop: 9, paddingBottom: 7 },
  blockMark: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: SLColors.accentSoft },
  blockCopy: { flex: 1, minWidth: 0, gap: 3 },
  blockName: { fontFamily: SLFontFamilies.sansSemiBold, fontSize: 18, lineHeight: 23, color: SLColors.textPrimary, textTransform: 'uppercase' },
  blockMeta: { fontFamily: SLFontFamilies.sans, fontSize: 13, lineHeight: 17, color: SLColors.textSecondary },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginHorizontal: 11, backgroundColor: SLColors.borderSubtle },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: SLColors.accentViolet },
  progressLabel: { alignSelf: 'flex-end', marginHorizontal: 11, marginTop: 4, marginBottom: 7, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 12, lineHeight: 15, color: SLColors.accentMuted },
  summaryRow: { minHeight: 52, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  summaryMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, borderRightWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, paddingHorizontal: 2 },
  summaryValue: { fontFamily: SLFontFamilies.monoSemiBold, fontSize: 18, lineHeight: 22 },
  summaryLabel: { fontFamily: SLFontFamilies.sans, fontSize: 10, lineHeight: 13, color: SLColors.textMuted },
  sectionLabel: { marginTop: 14, marginBottom: 6, marginLeft: 2, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 13, lineHeight: 17, letterSpacing: 0.5, textTransform: 'uppercase', color: SLColors.accentMuted },
  timeline: { position: 'relative' },
  timelineSpine: { position: 'absolute', left: 12, top: 14, bottom: 14, width: 2, backgroundColor: 'rgba(167,139,250,0.28)' },
  weekRow: { position: 'relative', paddingBottom: 5 },
  weekRowCurrent: { marginBottom: 5, borderLeftWidth: 3, borderLeftColor: tone.current, borderRadius: 12, backgroundColor: 'rgba(112,60,175,0.10)' },
  weekRowExpanded: { paddingBottom: 7 },
  weekPressable: { paddingTop: 4, paddingBottom: 5 },
  weekHeader: { minHeight: 37, flexDirection: 'row', alignItems: 'center' },
  timelineNode: { zIndex: 1, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.canvas },
  timelineNodeDone: { backgroundColor: tone.complete },
  timelineNodeCore: { width: 10, height: 10, borderRadius: 5 },
  weekIdentityCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  weekTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  weekName: { fontFamily: SLFontFamilies.sansBold, fontSize: 16, lineHeight: 20, color: SLColors.textSecondary },
  currentBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: SLColors.accentSoft, fontFamily: SLFontFamilies.sansBold, fontSize: 8, lineHeight: 11, letterSpacing: 0.5, color: SLColors.accentMuted },
  weekDates: { marginTop: 1, fontFamily: SLFontFamilies.sans, fontSize: 12, lineHeight: 16, color: SLColors.textMuted },
  weekCountWrap: { minWidth: 58, alignItems: 'flex-end', marginLeft: 8, paddingRight: 2 },
  weekCount: { fontFamily: SLFontFamilies.sansSemiBold, fontSize: 12, lineHeight: 16 },
  weekCountCaption: { fontFamily: SLFontFamilies.sans, fontSize: 8, lineHeight: 11, color: SLColors.textMuted },
  weekCountEmpty: { color: SLColors.textSubtle },
  weekPanel: { marginLeft: 33, overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  weekPanelExpanded: { borderColor: 'rgba(167,139,250,0.35)' },
  dayRail: { height: 40, flexDirection: 'row', alignItems: 'stretch' },
  dayCell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 1 },
  dayLabel: { fontFamily: SLFontFamilies.sansSemiBold, fontSize: 9, lineHeight: 11, color: SLColors.textMuted },
  dayNumber: { fontFamily: SLFontFamilies.sans, fontSize: 11, lineHeight: 13, color: SLColors.textSecondary },
  dayDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  dayDotNeutral: { backgroundColor: tone.none, borderColor: tone.none, opacity: 0.7 },
  agenda: { marginLeft: 33, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  emptyAgenda: { ...SLTypography.caption, color: SLColors.textMuted, paddingHorizontal: 12, paddingVertical: 16 },
  sessionRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  sessionDate: { width: 28, alignItems: 'center' },
  sessionDay: { fontFamily: SLFontFamilies.sansSemiBold, fontSize: 10, lineHeight: 13, color: SLColors.textMuted },
  sessionDayNumber: { fontFamily: SLFontFamilies.monoSemiBold, fontSize: 14, lineHeight: 18, color: SLColors.textSecondary },
  sessionArtFrame: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFloating },
  sessionCopy: { flex: 1, minWidth: 0, gap: 2 },
  sessionTitle: { fontFamily: SLFontFamilies.sansSemiBold, fontSize: 14, lineHeight: 18, color: SLColors.textPrimary },
  sessionEvidence: { fontFamily: SLFontFamilies.sans, fontSize: 10, lineHeight: 14, color: SLColors.textMuted },
  sessionStatus: { maxWidth: 67, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 10, lineHeight: 14, textAlign: 'right' },
  pressed: { opacity: 0.72 },
  bottomSpacer: { height: 20 },
});
