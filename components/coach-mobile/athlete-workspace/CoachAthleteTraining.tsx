import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { Text } from '@/components/ui/sl-text';
import { SLLayout, SLRadius, SLSpacing } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

import { useCoachAthleteWorkspace } from './CoachAthleteWorkspaceContext';

type CalendarSession = {
  workout_id: number;
  athlete_id: number;
  athlete_name: string;
  date: string;
  label: string;
  status: string;
  block_name?: string | null;
  week_number?: number | null;
  planned_summary?: string | null;
  set_count?: number;
};

type CalendarDay = {
  date: string;
  sessions: CalendarSession[];
  meets: Array<{ meet_plan_id: number; athlete_id: number; meet_name?: string | null; date: string }>;
  custom_items: Array<{ id: number; athlete_id?: number | null; title: string; category: string }>;
};

type CalendarResponse = {
  ok: boolean;
  error?: string;
  athlete_id?: number | string;
  days: CalendarDay[];
};

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readableDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function statusTone(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed' || normalized === 'logged' || normalized === 'done') return COACH_V2.green;
  if (normalized === 'missed' || normalized === 'incomplete') return COACH_V2.magenta;
  if (normalized === 'in_progress') return COACH_V2.gold;
  return COACH_V2.violetBright;
}

export function CoachAthleteTraining() {
  const router = useRouter();
  const workspace = useCoachAthleteWorkspace();
  const { bootstrap, summary, trainingState, setTrainingState } = workspace;
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const athlete = bootstrap?.athlete;
  const currentTraining = summary?.current_training || bootstrap?.current_training || {};
  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 14);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 29);

  useEffect(() => {
    if (!athlete) return undefined;
    const controller = new AbortController();
    setLoadingCalendar(true);
    setCalendarError(null);
    const query = new URLSearchParams({
      start: ymd(rangeStart),
      end: ymd(rangeEnd),
      athlete_id: String(athlete.id),
      include_completed: '1',
    });
    void fetchJson<CalendarResponse>(`/coach/mobile/calendar?${query.toString()}`, {
      method: 'GET',
      auth: true,
      signal: controller.signal,
    }).then((response) => {
      if (controller.signal.aborted) return;
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Athlete agenda is unavailable.');
      const leaked = (response.json.days || []).some((day) =>
        (day.sessions || []).some((session) => Number(session.athlete_id) !== athlete.id)
        || (day.meets || []).some((meet) => Number(meet.athlete_id) !== athlete.id),
      );
      if (leaked || Number(response.json.athlete_id) !== athlete.id) {
        throw new Error('Athlete agenda scope could not be verified.');
      }
      setCalendar(response.json);
    }).catch((caught) => {
      if (!controller.signal.aborted) setCalendarError(caught?.message || 'Athlete agenda is unavailable.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingCalendar(false);
    });
    return () => controller.abort();
  }, [athlete?.id, workspace.subjectKey]);

  useEffect(() => {
    if (!bootstrap || !summary) return;
    setTrainingState((current) => ({
      ...current,
      blockId: current.blockId ?? (Number(currentTraining.block_id || 0) || null),
      week: current.week ?? (Number(currentTraining.week_position || 0) || null),
      selectedDate: current.selectedDate || summary.next_assigned_session?.date || null,
    }));
  }, [bootstrap?.subject.subject_key, currentTraining.block_id, currentTraining.week_position, summary?.next_assigned_session?.date]);

  const sessions = useMemo(() => (calendar?.days || []).flatMap((day) => day.sessions || []), [calendar?.days]);
  const recent = useMemo(() => sessions.filter((session) => session.date < ymd(today)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), [sessions]);
  const upcoming = useMemo(() => sessions.filter((session) => session.date >= ymd(today)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10), [sessions]);
  const exceptions = useMemo(() => sessions.filter((session) => ['missed', 'incomplete'].includes(String(session.status).toLowerCase())), [sessions]);

  if (!bootstrap || !summary || !athlete) return null;
  const training = currentTraining;
  const metrics = summary.workspace_v3?.athlete.metrics;
  const openProgramming = () => router.push({
    pathname: '/(tabs)/workout',
    params: {
      athleteId: String(athlete.id),
      athleteName: athlete.name,
      workspaceReturn: 'training',
      workspaceSubjectKey: workspace.subjectKey,
      programmingBlockId: trainingState.blockId ? String(trainingState.blockId) : undefined,
      programmingWeek: trainingState.week ? String(trainingState.week) : undefined,
      programmingDay: trainingState.selectedDate || undefined,
    },
  } as any);

  const openSession = (session: CalendarSession) => {
    setTrainingState((current) => ({ ...current, selectedDate: session.date }));
    const completed = ['completed', 'logged', 'done'].includes(String(session.status).toLowerCase());
    router.push({
      pathname: completed ? '/(tabs)/coach-session-review' : '/(tabs)/workout/session-workspace/[workoutId]',
      params: {
        workoutId: String(session.workout_id),
        athleteId: String(athlete.id),
        returnToWorkspace: '1',
        workspaceReturn: 'training',
        workspaceSubjectKey: workspace.subjectKey,
      },
    } as any);
  };

  return (
    <ScrollView
      contentOffset={{ x: 0, y: trainingState.scrollY }}
      contentContainerStyle={styles.content}
      onScroll={(event) => setTrainingState((current) => ({ ...current, scrollY: event.nativeEvent.contentOffset.y }))}
      scrollEventThrottle={180}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={styles.kicker}>ATHLETE TRAINING</Text>
        <Text style={styles.title}>Plan and inspect the work</Text>
        <Text style={styles.subtitle}>Program, Sessions, and agenda remain locked to {athlete.name}.</Text>
      </View>

      <View style={styles.programCard}>
        <View style={styles.programTop}>
          <View style={styles.programIcon}><Ionicons color={COACH_V2.violetBright} name="barbell-outline" size={25} /></View>
          <View style={styles.flex}>
            <Text style={styles.programName}>{training.program_name || 'No active program'}</Text>
            <Text style={styles.meta}>{[training.block_name, training.week_position && training.week_total ? `Week ${training.week_position} of ${training.week_total}` : null].filter(Boolean).join(' · ') || 'Program position unavailable'}</Text>
          </View>
        </View>
        <View style={styles.stats}>
          <Stat label="Through" value={summary.programming_horizon.programmed_through_date || '—'} />
          <Stat label="Remaining" value={`${summary.programming_horizon.sessions_remaining ?? 0} Sessions`} />
          <Stat label="Execution" value={metrics?.adherence.value == null ? '—' : `${metrics.adherence.value.toFixed(0)}%`} />
        </View>
        <Pressable accessibilityRole="button" onPress={openProgramming} style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>Open Programming Manager</Text>
          <Ionicons color="#fff" name="arrow-forward-circle" size={20} />
        </Pressable>
      </View>

      {exceptions.length ? (
        <Section title="Needs Training Attention" meta={`${exceptions.length}`}>
          {exceptions.map((session) => <SessionRow key={session.workout_id} session={session} onPress={() => openSession(session)} />)}
        </Section>
      ) : null}

      <Section title="Athlete Agenda" meta="43-day scoped calendar">
        {loadingCalendar ? <View style={styles.loading}><ActivityIndicator color={COACH_V2.violetBright} /><Text style={styles.meta}>Loading athlete agenda…</Text></View> : calendarError ? <View style={styles.error}><Ionicons color={COACH_V2.magenta} name="warning-outline" size={18} /><Text style={[styles.meta, styles.flex]}>{calendarError}</Text></View> : (
          <>
            {!upcoming.length ? <Empty text="No upcoming Sessions are assigned in this window." /> : upcoming.map((session) => <SessionRow key={session.workout_id} session={session} onPress={() => openSession(session)} />)}
            <Pressable onPress={openProgramming} style={styles.secondaryAction}><Ionicons color={COACH_V2.violetBright} name="add-circle-outline" size={18} /><Text style={styles.secondaryActionText}>Create or schedule Session</Text></Pressable>
          </>
        )}
      </Section>

      <Section title="Recent Completed Sessions" meta={`${recent.length} shown`}>
        {recent.length ? recent.map((session) => <SessionRow key={session.workout_id} session={session} onPress={() => openSession(session)} />) : <Empty text="No completed Session is present in this bounded agenda window." />}
      </Section>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}</View>{children}</View>;
}

function SessionRow({ session, onPress }: { session: CalendarSession; onPress: () => void }) {
  const tone = statusTone(session.status);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}>
      <View style={[styles.dateMarker, { borderColor: tone }]}><Text style={[styles.dateText, { color: tone }]}>{new Date(`${session.date}T12:00:00`).getDate()}</Text></View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.sessionTitle}>{session.label}</Text>
        <Text numberOfLines={1} style={styles.meta}>{readableDate(session.date)}{session.block_name ? ` · ${session.block_name}` : ''}{session.week_number ? ` · W${session.week_number}` : ''}</Text>
        {session.planned_summary ? <Text numberOfLines={1} style={styles.sessionEvidence}>{session.planned_summary}</Text> : null}
      </View>
      <View style={[styles.status, { backgroundColor: `${tone}16` }]}><Text style={[styles.statusText, { color: tone }]}>{String(session.status || 'assigned').replaceAll('_', ' ')}</Text></View>
      <Ionicons color={COACH_V2.muted} name="chevron-forward" size={16} />
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text numberOfLines={1} style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Ionicons color={COACH_V2.subtle} name="calendar-clear-outline" size={19} /><Text style={[styles.meta, styles.flex]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  content: { gap: SLSpacing.lg, padding: SLLayout.screenGutter, paddingBottom: 96 },
  intro: { paddingHorizontal: 2, paddingTop: 4 },
  kicker: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: COACH_V2.text, fontSize: 27, fontWeight: '800', marginTop: 4 },
  subtitle: { color: COACH_V2.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  flex: { flex: 1, minWidth: 0 },
  programCard: { backgroundColor: COACH_V2.surface, borderColor: 'rgba(157,92,255,0.46)', borderRadius: SLRadius.lg, borderWidth: 1, overflow: 'hidden', padding: 15 },
  programTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  programIcon: { alignItems: 'center', backgroundColor: 'rgba(157,92,255,0.14)', borderRadius: 15, height: 50, justifyContent: 'center', width: 50 },
  programName: { color: COACH_V2.text, fontSize: 19, fontWeight: '800' },
  meta: { color: COACH_V2.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  stats: { borderTopColor: COACH_V2.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', marginTop: 14, paddingTop: 13 },
  stat: { flex: 1, paddingHorizontal: 7 },
  statValue: { color: COACH_V2.text, fontSize: 13, fontWeight: '800' },
  statLabel: { color: COACH_V2.subtle, fontSize: 10, marginTop: 4 },
  primaryAction: { alignItems: 'center', backgroundColor: COACH_V2.violet, borderRadius: 13, flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, minHeight: 48, paddingHorizontal: 15 },
  primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  section: { backgroundColor: COACH_V2.surface, borderColor: COACH_V2.border, borderRadius: SLRadius.lg, borderWidth: 1, overflow: 'hidden', padding: 14 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sectionTitle: { color: COACH_V2.text, flex: 1, fontSize: 18, fontWeight: '800' },
  sectionMeta: { color: COACH_V2.subtle, fontSize: 11, fontWeight: '700' },
  sessionRow: { alignItems: 'center', borderTopColor: COACH_V2.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 9, minHeight: 68, paddingVertical: 9 },
  dateMarker: { alignItems: 'center', borderRadius: 13, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  dateText: { fontSize: 16, fontWeight: '900' },
  sessionTitle: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  sessionEvidence: { color: COACH_V2.subtle, fontSize: 11, marginTop: 3 },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  pressed: { opacity: 0.7 },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 76, padding: 12 },
  error: { alignItems: 'center', backgroundColor: 'rgba(255,71,103,0.08)', borderRadius: SLRadius.md, flexDirection: 'row', gap: 10, padding: 12 },
  empty: { alignItems: 'center', backgroundColor: COACH_V2.surfaceRaised, borderRadius: SLRadius.md, flexDirection: 'row', gap: 10, marginTop: 6, padding: 13 },
  secondaryAction: { alignItems: 'center', borderColor: COACH_V2.borderStrong, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12, minHeight: 43 },
  secondaryActionText: { color: COACH_V2.text, fontSize: 13, fontWeight: '800' },
  bottomSpace: { height: SLSpacing.xl },
});
