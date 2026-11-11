import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { KeyboardScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies, SLSelfCoach as C } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import { planDateLabel, planWeekStart, savePlanChange, shiftPlanDate } from '@/lib/self-coach-plan';
import { trainingSessionTitle } from '@/lib/training-session-title';
import { SelfCoachRoutineEditor, type RoutineDetail } from './SelfCoachRoutineEditor';

type PlanSession = {
  id: number; date: string; name: string; status: string; editable: boolean; copyable: boolean;
  movements: string[]; sets_saved: number; program?: string | null; week_number?: number | null;
};
type PlanWeek = { today: string; week_start: string; sessions: PlanSession[]; drafts: PlanSession[]; draft_count: number };
type Routine = {
  id: number | string; name: string; core_count: number; accessory_count: number; unsupported_reason?: string;
  preview?: { core_lifts?: { name: string }[]; accessories?: { name: string }[] };
};
type DateAction = { kind: 'schedule' | 'draft' | 'move' | 'copy'; date: string; routine?: Routine; session?: PlanSession };

export function SelfCoachPlanEntry({ athleteId, owner, unit, selectedDate, onDateChange, onPrograms, onContextRetry }: {
  athleteId: number | null;
  owner: string;
  unit: 'lb' | 'kg';
  selectedDate: string;
  onDateChange: (date: string) => void;
  onPrograms: () => void;
  onContextRetry: () => void;
}) {
  const router = useRouter();
  const [week, setWeek] = useState<PlanWeek | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [routinesLoaded, setRoutinesLoaded] = useState(false);
  const [weekError, setWeekError] = useState('');
  const [routineError, setRoutineError] = useState('');
  const [notice, setNotice] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [allRoutines, setAllRoutines] = useState(false);
  const [sessionMenu, setSessionMenu] = useState<number | null>(null);
  const [action, setAction] = useState<DateAction | null>(null);
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const activeWrite = useRef(false);
  const focus = useRef(false);
  const weekRequest = useRef(0);
  const routineRequest = useRef(0);
  const detailRequest = useRef(0);
  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;
  const start = selectedDate ? planWeekStart(selectedDate) : '';
  const date = selectedDate || week?.today || '';

  const loadWeek = useCallback(async () => {
    if (!athleteId) {
      setWeekError('Your training plan could not load.');
      setLoading(false);
      return;
    }
    const request = ++weekRequest.current;
    setLoading(true);
    setWeekError('');
    try {
      const response = await fetchJson<PlanWeek & { ok?: boolean; error?: string }>(
        `/workouts/mobile/self-coach/plan${start ? `?week_start=${start}` : ''}`, { cache: 'no-store' });
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Your week could not load.');
      if (request !== weekRequest.current || !focus.current) return;
      setWeek(response.json);
      if (!start) onDateChangeRef.current(response.json.today);
    } catch (reason) {
      if (request === weekRequest.current && focus.current) setWeekError(reason instanceof Error ? reason.message : 'Your week could not load.');
    } finally {
      if (request === weekRequest.current && focus.current) setLoading(false);
    }
  }, [athleteId, start]);

  const loadRoutines = useCallback(async () => {
    if (!athleteId) return;
    const request = ++routineRequest.current;
    setRoutineError('');
    try {
      const response = await fetchJson<{ ok?: boolean; error?: string; templates?: Routine[] }>(
        `/workouts/mobile/programming/session-templates?athlete_id=${athleteId}`, { cache: 'no-store' });
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Routines could not load.');
      if (request === routineRequest.current && focus.current) {
        setRoutines(response.json.templates || []);
        setRoutinesLoaded(true);
      }
    } catch (reason) {
      if (request === routineRequest.current && focus.current) setRoutineError(reason instanceof Error ? reason.message : 'Routines could not load.');
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => {
    focus.current = true;
    return () => { focus.current = false; weekRequest.current += 1; routineRequest.current += 1; detailRequest.current += 1; setDetailLoading(false); };
  }, []));
  useFocusEffect(useCallback(() => { void loadWeek(); }, [loadWeek]));
  useFocusEffect(useCallback(() => { void loadRoutines(); }, [loadRoutines]));

  const readRoutine = async (row: Routine) => {
    if (detailLoading || busy) return;
    setAction(null);
    setDetailLoading(true);
    setRoutineError('');
    const request = ++detailRequest.current;
    try {
      const response = await fetchJson<{ ok?: boolean; error?: string; routine?: RoutineDetail }>(
        `/workouts/mobile/self-coach/routines/${encodeURIComponent(row.id)}`, { cache: 'no-store' });
      if (!response.ok || !response.json?.ok || !response.json.routine) throw new Error(response.json?.error || 'This routine could not load.');
      if (focus.current && request === detailRequest.current) setRoutine(response.json.routine);
    } catch (reason) {
      if (focus.current && request === detailRequest.current) setRoutineError(reason instanceof Error ? reason.message : 'This routine could not load.');
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  };

  const openSession = (session: Pick<PlanSession, 'id' | 'status' | 'date'> & { editable?: boolean }) => {
    if (busy) return;
    const edit = session.editable || session.status === 'draft';
    router.push(edit
      ? { pathname: '/workout/session-workspace/[workoutId]', params: { workoutId: String(session.id), planDate: date || session.date } }
      : { pathname: '/workout/[workoutId]', params: { workoutId: String(session.id), returnTo: 'plan', planDate: date || session.date } });
  };

  const openAction = (kind: DateAction['kind'], session?: PlanSession, source?: Routine) => {
    if (!date || busy) return;
    setSaveError('');
    setNotice('');
    setAddOpen(false);
    setSessionMenu(null);
    setAction({ kind, date: session && kind === 'move' ? session.date : date < (week?.today || date) ? week!.today : date, routine: source, session });
  };
  const write = async (payload: Record<string, unknown>, success: (result: { session_id?: number; date?: string }) => void) => {
    if (activeWrite.current || !owner || !athleteId) return;
    activeWrite.current = true;
    setBusy(true);
    setSaveError('');
    try {
      const result = await savePlanChange(owner, athleteId, 'plan', payload);
      if (focus.current) success(result);
    } catch (reason) {
      if (focus.current) setSaveError(reason instanceof Error ? reason.message : 'This change could not save. Try again.');
    } finally {
      activeWrite.current = false;
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!action) return;
    const { kind, date: target, routine: source, session } = action;
    const payload = {
      action: kind, date: target,
      ...(source ? { routine_id: source.id } : {}),
      ...(session ? { session_id: session.id, expected_date: session.date, status: session.status } : {}),
    };
    void write(payload, result => {
      setAction(null);
      setRoutine(null);
      onDateChange(target);
      if (kind === 'draft' || kind === 'copy') {
        if (result.session_id) router.push({ pathname: '/workout/session-workspace/[workoutId]',
          params: { workoutId: String(result.session_id), planDate: target } });
        return;
      }
      setNotice(kind === 'move' ? `Session moved to ${planDateLabel(target)}.` : `Session scheduled for ${planDateLabel(target)}.`);
      void loadWeek();
    });
  };

  const cancelSession = (session: PlanSession) => Alert.alert('Cancel this Session?', `${trainingSessionTitle(session.name)} · ${planDateLabel(session.date)}`, [
    { text: 'Keep Session', style: 'cancel' },
    { text: 'Cancel Session', style: 'destructive', onPress: () => void write({
      action: 'cancel', session_id: session.id, expected_date: session.date, status: session.status,
    }, () => { setSessionMenu(null); setNotice('Session canceled.'); void loadWeek(); }) },
  ]);

  if (editing && athleteId) return <SelfCoachRoutineEditor key={editing === 'new' ? 'new' : String(routine?.id)}
    routine={editing === 'edit' ? routine || undefined : undefined} owner={owner} athleteId={athleteId} unit={unit}
    onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRoutine(null); setNotice('Routine saved.'); void loadRoutines(); }} />;

  const currentWeek = week?.week_start === (start || week?.week_start) ? week : null;
  const sessions = currentWeek?.sessions || [];
  const program = sessions.find(session => session.date === date && session.program) || sessions.find(session => session.program);
  const showAction = (sessionId?: number) => action && (action.session?.id === sessionId) ? <DateActionPanel
    action={action} today={week?.today || date} routines={routines} busy={busy} error={saveError}
    onChange={setAction} onClose={() => { setAction(null); setSaveError(''); }} onConfirm={confirm} /> : null;

  return <View style={s.screen}>
    <KeyboardScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
      refreshControl={routine ? undefined : <RefreshControl refreshing={loading && !!week} onRefresh={() => { void loadWeek(); void loadRoutines(); }} tintColor={C.accent} />}>
      {routine ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Plan" disabled={busy} onPress={() => { setRoutine(null); setAction(null); }} style={s.linkRow}>
          <Ionicons name="chevron-back" size={18} color={C.accent} /><Text style={s.link}>Plan</Text>
        </Pressable>
        <Text style={s.title}>{routine.name}</Text>
        <Text style={s.detail}>Reusable training</Text>
        <View style={s.list}>
          {routine.items.map((item, index) => <View key={index} style={s.routineDetailRow}>
            <Text style={s.index}>{index + 1}</Text><View style={s.flex}><Text style={s.name}>{item.name}</Text>
              <Text style={s.detail}>{[item.sets != null ? `${item.sets} sets` : null, item.reps_text ? `${item.reps_text} reps` : item.reps != null ? `${item.reps} reps` : null].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>)}
        </View>
        {showAction()}
        {!action ? <Pressable accessibilityRole="button" style={s.primary} onPress={() => openAction('schedule', undefined,
          routines.find(row => String(row.id) === String(routine.id)) || { id: routine.id, name: routine.name, core_count: 0, accessory_count: 0 })}>
          <Text style={s.primaryText}>Schedule this routine</Text>
        </Pressable> : null}
        {routine.can_rename && !action ? <Pressable accessibilityRole="button" onPress={() => setEditing('edit')} style={s.linkRow}>
          <Ionicons name="create-outline" color={C.accent} size={19} /><Text style={s.link}>{routine.editable ? 'Edit routine' : 'Rename routine'}</Text>
        </Pressable> : null}
      </> : <>
        <View style={s.heading}>
          <Text style={[s.title, s.flex]}>Plan</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onPrograms} style={s.linkRow}><Text style={s.link}>Programs</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Add to Plan" accessibilityState={{ expanded: addOpen }} disabled={!date || busy}
            onPress={() => setAddOpen(!addOpen)} style={s.addButton}><Ionicons name={addOpen ? 'close' : 'add'} color={C.accent} size={24} /></Pressable>
        </View>
        {addOpen ? <View style={s.menu}>
          <MenuAction icon="calendar-outline" label="Schedule session" onPress={() => openAction('schedule')} />
          <MenuAction icon="document-outline" label="New draft" onPress={() => openAction('draft')} />
          <MenuAction icon="barbell-outline" label="New routine" onPress={() => { setAddOpen(false); setAction(null); setEditing('new'); }} />
        </View> : null}
        {date ? <WeekStrip date={date} today={week?.today} disabled={busy} onSelect={onDateChange} /> : null}
        {program?.program ? <Text style={s.program}>{program.program}{program.week_number ? ` · Week ${program.week_number}` : ''}</Text> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text> : null}
        {weekError ? <View style={s.message}><Text accessibilityRole="alert" style={s.danger}>{weekError}</Text>
          <MenuAction icon="refresh-outline" label="Retry week" onPress={athleteId ? () => void loadWeek() : onContextRetry} /></View> : null}
        {!currentWeek && loading ? <ActivityIndicator color={C.accent} style={s.spinner} /> : null}
        {currentWeek && !sessions.length ? <View style={s.empty}><Text style={s.name}>Nothing on the schedule this week</Text><Text style={s.detail}>Pick a day to plan your next Session.</Text></View> : null}
        {sessions.map(session => <View key={session.id}>
          <AgendaRow session={session} selected={session.date === date} menuOpen={sessionMenu === session.id}
            onOpen={() => openSession(session)} onMenu={() => { setAction(null); setSaveError(''); setSessionMenu(sessionMenu === session.id ? null : session.id); }} busy={busy} />
          {sessionMenu === session.id ? <View style={s.menu}>
            {session.editable ? <MenuAction icon="create-outline" label="Edit this Session" onPress={() => openSession(session)} /> : null}
            {session.editable ? <MenuAction icon="calendar-outline" label="Move date" onPress={() => openAction('move', session)} /> : null}
            {session.copyable ? <MenuAction icon="copy-outline" label="Copy to date" onPress={() => openAction('copy', session)} /> : null}
            {session.editable ? <MenuAction icon="close-circle-outline" label="Cancel Session" onPress={() => cancelSession(session)} danger /> : null}
            {saveError ? <Text accessibilityRole="alert" style={s.danger}>{saveError}</Text> : null}
          </View> : null}
          {showAction(session.id)}
        </View>)}
        {showAction()}
        {!action ? <Pressable accessibilityRole="button" disabled={!date || busy} style={s.primary} onPress={() => openAction('schedule')}>
          <Ionicons name="calendar-outline" size={18} color={C.accentInk} /><Text style={s.primaryText}>Schedule session</Text>
        </Pressable> : null}
        {week?.draft_count ? <View style={s.section}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Drafts, ${week.draft_count} saved`} accessibilityState={{ expanded: draftsOpen }}
            onPress={() => setDraftsOpen(!draftsOpen)} style={s.sectionHeading}>
            <Text style={s.sectionTitle}>Drafts</Text><Text style={s.detail}>{week.draft_count} saved</Text>
            <Ionicons name={draftsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
          </Pressable>
          {draftsOpen ? week.drafts.map(draft => <Pressable key={draft.id} accessibilityRole="button" onPress={() => openSession(draft)} style={s.routineRow}>
            <Ionicons name="document-outline" size={20} color={C.accent} />
            <View style={s.flex}><Text style={s.name}>{trainingSessionTitle(draft.name)}</Text><Text style={s.detail}>{planDateLabel(draft.date)}</Text></View>
            <Ionicons name="chevron-forward" color={C.muted} size={18} />
          </Pressable>) : null}
        </View> : null}
        <View style={s.section}>
          <View style={s.sectionHeading}><Text style={s.sectionTitle}>Routines</Text>
            <Pressable accessibilityRole="button" disabled={!athleteId || busy} onPress={() => { setRoutine(null); setEditing('new'); }} style={s.linkRow}>
              <Ionicons name="add" size={18} color={C.accent} /><Text style={s.link}>New routine</Text>
            </Pressable>
          </View>
          {routines.slice(0, allRoutines ? undefined : 3).map(row => <Pressable key={row.id} accessibilityRole="button" disabled={detailLoading || busy}
            onPress={() => void readRoutine(row)} style={s.routineRow}>
            <View style={s.flex}><Text style={s.name}>{row.name}</Text>
              <Text numberOfLines={1} style={s.detail}>{[...(row.preview?.core_lifts || []), ...(row.preview?.accessories || [])].slice(0, 3).map(item => item.name).join(' · ') || `${row.core_count + row.accessory_count} exercises`}</Text>
            </View><Ionicons name="chevron-forward" color={C.muted} size={18} />
          </Pressable>)}
          {routines.length > 3 ? <Pressable accessibilityRole="button" onPress={() => setAllRoutines(!allRoutines)} style={s.linkRow}><Text style={s.link}>{allRoutines ? 'Show fewer' : `View all ${routines.length} routines`}</Text></Pressable> : null}
          {routinesLoaded && !routines.length && !routineError ? <Text style={s.detail}>Save exercises and sets you want to train again.</Text> : null}
          {detailLoading ? <ActivityIndicator color={C.accent} style={s.spinner} /> : null}
          {routineError ? <View><Text accessibilityRole="alert" style={s.danger}>{routineError}</Text><MenuAction icon="refresh-outline" label="Retry routines" onPress={() => void loadRoutines()} /></View> : null}
        </View>
        <View style={s.otherLinks}>
          <MenuAction icon="calendar-clear-outline" label="Full calendar" onPress={() => router.push('/(tabs)/athlete-calendar')} />
          <MenuAction icon="trophy-outline" label="Meet preparation" onPress={() => router.push('/(tabs)/athlete-meet-plan')} />
        </View>
      </>}
    </KeyboardScrollView>
  </View>;
}

function MenuAction({ icon, label, onPress, danger = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.linkRow}>
    <Ionicons name={icon} size={18} color={danger ? C.danger : C.accent} />
    <Text style={danger ? s.danger : s.link}>{label}</Text>
  </Pressable>;
}

function AgendaRow({ session, selected, menuOpen, onOpen, onMenu, busy }: {
  session: PlanSession; selected: boolean; menuOpen: boolean; onOpen: () => void; onMenu: () => void; busy: boolean;
}) {
  const presentations: Record<string, readonly [string, keyof typeof Ionicons.glyphMap, string]> = {
    completed: ['Completed', 'checkmark-circle', C.success],
    in_progress: ['In progress', 'play-circle', C.accent],
    draft: ['Draft', 'document-outline', C.muted],
    assigned: ['Scheduled', 'calendar-outline', '#E4BC71'],
    planned: ['Scheduled', 'calendar-outline', '#E4BC71'],
    canceled: ['Canceled', 'close-circle-outline', C.muted],
    missed: ['Missed', 'time-outline', C.danger],
    missed_excused: ['Excused', 'time-outline', C.muted],
    tardy: ['Late', 'time-outline', '#E4BC71'],
    incomplete: ['Incomplete', 'time-outline', '#E4BC71'],
  };
  const [label, icon, color] = presentations[session.status] || [session.status, 'calendar-outline', C.muted];
  const count = session.status === 'completed' || session.status === 'in_progress'
    ? `${session.sets_saved} ${session.sets_saved === 1 ? 'set' : 'sets'} saved` : '';
  const detail = [session.movements[0], count || session.movements.slice(1).join(' · ')].filter(Boolean).join(' · ');
  return <View style={[s.agendaRow, selected && s.agendaSelected]}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onOpen} style={s.agendaOpen}>
      <View style={s.dayGutter}><Text style={s.dayName}>{planDateLabel(session.date, { weekday: 'short' })}</Text>
        <Text style={s.dayNumber}>{planDateLabel(session.date, { month: 'short', day: 'numeric' })}</Text></View>
      <Ionicons name={icon} size={19} color={color} />
      <View style={s.flex}><Text style={s.name} numberOfLines={2}>{trainingSessionTitle(session.name)}</Text>
        {detail ? <Text style={s.detail} numberOfLines={2}>{detail}</Text> : null}
      </View>
      <Text style={[s.status, { color }]}>{label}</Text>
    </Pressable>
    {session.editable || session.copyable ? <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${trainingSessionTitle(session.name)}, ${label.toLowerCase()}, ${planDateLabel(session.date)}`}
      accessibilityState={{ expanded: menuOpen }} disabled={busy} onPress={onMenu} style={s.iconButton}><Ionicons name="ellipsis-horizontal" color={C.muted} size={19} /></Pressable> : null}
  </View>;
}

function WeekStrip({ date, today, disabled, onSelect }: { date: string; today?: string; disabled?: boolean; onSelect: (date: string) => void }) {
  const [jump, setJump] = useState(false);
  const first = planWeekStart(date);
  const last = shiftPlanDate(first, 6);
  const heading = first.slice(0, 7) === last.slice(0, 7)
    ? `${planDateLabel(first, { month: 'short', day: 'numeric' })}–${Number(last.slice(-2))}, ${last.slice(0, 4)}`
    : `${planDateLabel(first, { month: 'short', day: 'numeric', ...(first.slice(0, 4) !== last.slice(0, 4) ? { year: 'numeric' } : {}) })} – ${planDateLabel(last, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  return <View style={s.week}>
    <View style={s.weekTop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous week" disabled={disabled} onPress={() => onSelect(shiftPlanDate(date, -7))} style={s.iconButton}><Ionicons name="chevron-back" size={19} color={C.secondary} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Choose date, ${heading}`} disabled={disabled} onPress={() => setJump(!jump)} style={s.linkRow}>
        <Text style={s.weekTitle}>{heading}</Text><Ionicons name="chevron-down" size={14} color={C.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Next week" disabled={disabled} onPress={() => onSelect(shiftPlanDate(date, 7))} style={s.iconButton}><Ionicons name="chevron-forward" size={19} color={C.secondary} /></Pressable>
    </View>
    <View style={s.weekDays}>{Array.from({ length: 7 }, (_, i) => shiftPlanDate(first, i)).map(day => <Pressable key={day} accessibilityRole="button" accessibilityLabel={planDateLabel(day)}
      accessibilityState={{ selected: day === date }} disabled={disabled} onPress={() => { setJump(false); onSelect(day); }} style={s.day}>
      <Text style={s.dayName}>{planDateLabel(day, { weekday: 'short' }).slice(0, 1)}</Text>
      <View style={[s.dateBadge, day === date && s.dateSelected, day === today && day !== date && s.dateToday]}>
        <Text style={[s.dateNumber, day === date && s.selectedNumber]}>{Number(day.slice(-2))}</Text>
      </View>
    </Pressable>)}</View>
    {jump ? <View style={s.jump}><DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
      themeVariant="dark" onChange={(_, value) => {
        if (Platform.OS !== 'ios') setJump(false);
        if (!value) return;
        const chosen = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
        onSelect(chosen);
        setJump(false);
      }} /></View> : null}
  </View>;
}

function DateActionPanel({ action, today, routines, busy, error, onChange, onClose, onConfirm }: {
  action: DateAction; today: string; routines: Routine[]; busy: boolean; error: string;
  onChange: (action: DateAction) => void; onClose: () => void; onConfirm: () => void;
}) {
  const heading = { schedule: 'Schedule session', draft: 'New draft', move: 'Move session', copy: 'Copy session' }[action.kind];
  const disabled = busy || action.date < today || (action.kind === 'schedule' && !action.routine)
    || (action.kind === 'move' && action.date === action.session?.date);
  const verb = { schedule: 'Schedule for', draft: 'Create draft for', move: 'Move to', copy: 'Copy to' }[action.kind];
  return <View style={s.panel}>
    <View style={s.heading}><Text style={[s.sectionTitle, s.flex]}>{heading}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close date selection"
      disabled={busy} onPress={onClose} style={s.iconButton}><Ionicons name="close" size={20} color={C.secondary} /></Pressable></View>
    {action.session ? <><Text style={s.name}>{trainingSessionTitle(action.session.name)}</Text><Text style={s.detail}>Current date · {planDateLabel(action.session.date)}</Text></> : null}
    {action.kind === 'schedule' ? action.routine ? <>
      <Text style={s.name}>{action.routine.name}</Text>
      <MenuAction icon="document-outline" label="Open as draft" onPress={() => { if (!busy) onChange({ ...action, kind: 'draft' }); }} />
    </> : <>
      <Text style={s.detail}>Choose a routine for this Session.</Text>
      {routines.filter(row => !row.unsupported_reason).map(row => <Pressable key={row.id} accessibilityRole="button" disabled={busy}
        onPress={() => onChange({ ...action, routine: row })} style={s.routineRow}><Text style={[s.name, s.flex]}>{row.name}</Text><Ionicons name="chevron-forward" color={C.muted} size={18} /></Pressable>)}
      <MenuAction icon="add-circle-outline" label="Build a one-off session" onPress={() => { if (!busy) onChange({ kind: 'draft', date: action.date }); }} />
    </> : null}
    {action.kind === 'draft' ? <>
      {action.routine ? <Text style={s.name}>{action.routine.name}</Text> : null}
      <Text style={s.detail}>Prepare the Session, then assign it from the editor.</Text>
    </> : null}
    <WeekStrip date={action.date} today={today} disabled={busy} onSelect={date => onChange({ ...action, date })} />
    {action.date < today ? <Text style={s.detail}>Choose today or a future date.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={s.danger}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onConfirm} style={[s.primary, disabled && s.dim]}>
      {busy ? <ActivityIndicator color={C.accentInk} /> : <Text style={s.primaryText}>{verb} {planDateLabel(action.date)}</Text>}
    </Pressable>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 116 },
  flex: { flex: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  title: { color: C.text, fontSize: 33, lineHeight: 41, fontFamily: SLFontFamilies.sansBold },
  linkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  link: { color: C.accent, fontSize: 15 },
  addButton: { height: 42, width: 42, borderRadius: 12, backgroundColor: '#2B203B', alignItems: 'center', justifyContent: 'center' },
  week: { marginTop: 12, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 8 },
  weekTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekTitle: { color: C.text, fontSize: 15, fontFamily: SLFontFamilies.sansSemiBold },
  weekDays: { flexDirection: 'row' },
  day: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5 },
  dayName: { color: C.secondary, fontSize: 12, lineHeight: 16 },
  dayNumber: { color: C.muted, fontSize: 11, lineHeight: 16 },
  dateBadge: { width: 34, minHeight: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dateSelected: { backgroundColor: C.accent },
  dateToday: { borderWidth: 1, borderColor: C.line },
  dateNumber: { color: C.text, fontSize: 15 },
  selectedNumber: { color: C.accentInk, fontFamily: SLFontFamilies.sansBold },
  jump: { alignItems: 'center', paddingVertical: 10 },
  iconButton: { minWidth: 38, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  agendaRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, minHeight: 68 },
  agendaSelected: { backgroundColor: '#191422' },
  agendaOpen: { flex: 1, minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  dayGutter: { width: 52, paddingLeft: 5, borderRightWidth: 1, borderRightColor: C.line },
  name: { color: C.text, fontSize: 16, lineHeight: 21, fontFamily: SLFontFamilies.sansSemiBold },
  detail: { color: C.secondary, fontSize: 13, lineHeight: 19 },
  status: { fontSize: 11, fontFamily: SLFontFamilies.sansSemiBold },
  program: { color: C.accent, fontSize: 13, marginTop: 12 },
  section: { marginTop: 16 },
  sectionHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: C.text, fontSize: 22, lineHeight: 28, fontFamily: SLFontFamilies.sansBold },
  routineRow: { minHeight: 59, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  routineDetailRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  list: { marginTop: 16 },
  index: { color: C.muted, width: 18, fontSize: 13 },
  empty: { paddingVertical: 18, gap: 3 },
  menu: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 13, marginTop: 6, marginBottom: 4 },
  panel: { padding: 13, marginTop: 9, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: '#473959' },
  primary: { minHeight: 51, paddingHorizontal: 12, marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 13 },
  primaryText: { color: C.accentInk, fontSize: 16, fontFamily: SLFontFamilies.sansBold },
  otherLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, marginTop: 9 },
  success: { color: C.success, fontSize: 13, marginTop: 10 },
  danger: { color: C.danger, fontSize: 14, lineHeight: 20 },
  message: { marginVertical: 12 },
  spinner: { marginVertical: 14 },
  dim: { opacity: 0.53 },
});
