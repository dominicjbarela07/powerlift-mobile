import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';

type SessionFocus = {
  primary?: string[];
  core_count?: number | null;
  accessory_count?: number | null;
};

type SessionRecap = {
  top_work?: string | null;
  execution_summary?: string | null;
  feedback_preview?: string | null;
};

type SessionPreviewPayload = {
  core?: Array<{
    movement?: string | null;
    prescription?: string | null;
    load?: string | null;
  }>;
  accessory_count?: number | null;
};

type HubSession = {
  id: number;
  title?: string | null;
  label?: string | null;
  date?: string | null;
  status?: string | null;
  kind?: 'in_progress' | 'today' | 'upcoming' | 'completed' | 'missed' | 'incomplete' | 'past_due' | string | null;
  training_block_id?: number | null;
  block_name?: string | null;
  focus?: SessionFocus | null;
  preview?: SessionPreviewPayload | null;
  recap?: SessionRecap | null;
  log_count?: number | null;
  timeliness?: string | null;
  missed_acknowledged_at?: string | null;
  incomplete_acknowledged_at?: string | null;
  attention?: {
    type?: 'missed' | 'incomplete' | string | null;
    label?: string | null;
  } | null;
};

type HubDay = {
  date: string;
  label?: string | null;
  day_number?: number | null;
  is_today?: boolean | null;
  kind?: 'session' | 'rest' | string | null;
  sessions?: HubSession[];
  completed?: number | null;
  assigned?: number | null;
  missed?: number | null;
};

type MovementLift = {
  key: 'squat' | 'bench' | 'deadlift' | string;
  label: string;
  last_trained_date?: string | null;
  recent_session_id?: number | null;
  recent_session_title?: string | null;
  movement?: string | null;
};

type TrainingHubPayload = {
  athlete?: {
    id?: number | null;
    name?: string | null;
    timezone?: string | null;
  } | null;
  today?: string | null;
  active_program?: {
    id?: number | null;
    name?: string | null;
    program_type?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    meet_date?: string | null;
  } | null;
  current_block?: {
    id?: number | null;
    name?: string | null;
    phase?: string | null;
    week_label?: string | null;
    date_range_label?: string | null;
    progress?: {
      completed?: number | null;
      total?: number | null;
      percent?: number | null;
    } | null;
    cadence?: {
      this_week_total?: number | null;
      this_week_completed?: number | null;
      this_week_missed?: number | null;
      rhythm?: string | null;
    } | null;
  } | null;
  flow?: HubSession[];
  week?: {
    start_date?: string | null;
    end_date?: string | null;
    days?: HubDay[];
  } | null;
  movement_history?: {
    lifts?: MovementLift[];
    film_room?: {
      label?: string | null;
      route?: string | null;
    } | null;
  } | null;
  memory?: {
    last_completed?: HubSession | null;
    next_up?: HubSession | null;
    momentum?: string | null;
  } | null;
};

type ProgramBlockPayload = {
  id: number;
  name?: string | null;
  order_idx?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  current_week?: number | null;
  total_weeks?: number | null;
  date_range_label?: string | null;
  week_label?: string | null;
};

type SessionMap = Record<string, HubSession[]>;

type ProgrammingReturnContext = {
  blockId?: number | null;
  week?: number | null;
  day?: string | null;
};

type RoadmapWeek = {
  index: number;
  startDate?: string | null;
  rangeLabel: string;
  summary: string;
  days: Array<{
    key: string;
    date: string | null;
    label: string;
    sessions: HubSession[];
    count: number;
  }>;
};

type WeekActionKey =
  | 'copy-to'
  | 'copy-from'
  | 'apply-template'
  | 'save-template'
  | 'assign-drafts'
  | 'revert-assigned'
  | 'shift'
  | 'clear';

type WeekActionState = {
  action: WeekActionKey;
  week: RoadmapWeek;
};

type BlockActionKey =
  | 'edit'
  | 'apply-template'
  | 'save-template'
  | 'assign-drafts'
  | 'revert-assigned'
  | 'clear';

type BlockActionState = {
  action: BlockActionKey;
  block: ProgramBlockPayload;
};

type WeekTemplate = {
  id: number;
  name?: string | null;
  session_count?: number | null;
  week_count?: number | null;
};

type BlockTemplate = WeekTemplate & {
  default_duration_weeks?: number | null;
};

type AttentionModalState =
  | { type: 'missed'; session: HubSession }
  | { type: 'incomplete'; session: HubSession }
  | null;

const colors = {
  text: '#ECE5DA',
  textStrong: SLColors.textStrong,
  muted: '#B8ACA1',
  subtle: '#82766D',
  line: 'rgba(222, 198, 166, 0.10)',
  lineSoft: 'rgba(222, 198, 166, 0.058)',
  surface: 'rgba(20, 14, 13, 0.32)',
  surfaceStrong: 'rgba(24, 16, 15, 0.50)',
  violet: SLColors.accentViolet,
  violetSoft: 'rgba(167, 139, 250, 0.13)',
  green: '#A7CBB5',
  amber: '#D6A75E',
  red: SLColors.railDanger,
};

const missedReasons = [
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'sick_injured', label: 'Sick/Injured' },
  { key: 'travel', label: 'Travel' },
  { key: 'forgot', label: 'Forgot' },
  { key: 'other', label: 'Other' },
];

const incompleteReasons = [
  { key: 'time', label: 'Time' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'pain_injury', label: 'Pain/Injury' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'interrupted', label: 'Interrupted' },
  { key: 'other', label: 'Other' },
];

const programmingAtmosphere = require('@/assets/images/lofi_programming.png');

const weekActionRows: Array<{ key: WeekActionKey; label: string }> = [
  { key: 'copy-to', label: 'Copy To...' },
  { key: 'copy-from', label: 'Copy From...' },
  { key: 'apply-template', label: 'Apply Week Template...' },
  { key: 'save-template', label: 'Save Week Template...' },
  { key: 'assign-drafts', label: 'Assign All Draft Sessions' },
  { key: 'revert-assigned', label: 'Revert All Assigned Sessions to Draft' },
  { key: 'shift', label: 'Shift Week...' },
  { key: 'clear', label: 'Clear Week...' },
];

const weekActionGroups: Array<{ title: string; keys: WeekActionKey[] }> = [
  { title: 'Templates', keys: ['apply-template', 'save-template'] },
  { title: 'Copying', keys: ['copy-to', 'copy-from'] },
  { title: 'Scheduling', keys: ['assign-drafts', 'revert-assigned', 'shift'] },
  { title: 'Danger Zone', keys: ['clear'] },
];

const blockActionRows: Array<{ key: BlockActionKey; label: string; danger?: boolean }> = [
  { key: 'edit', label: 'Edit Block...' },
  { key: 'apply-template', label: 'Apply Block Template...' },
  { key: 'save-template', label: 'Save Block Template...' },
  { key: 'assign-drafts', label: 'Assign All Draft Sessions in Block' },
  { key: 'revert-assigned', label: 'Revert All Assigned Sessions in Block to Draft' },
  { key: 'clear', label: 'Clear Block Sessions...', danger: true },
];

const blockActionGroups: Array<{ title: string; keys: BlockActionKey[] }> = [
  { title: 'Block', keys: ['edit'] },
  { title: 'Templates', keys: ['apply-template', 'save-template'] },
  { title: 'Scheduling', keys: ['assign-drafts', 'revert-assigned'] },
  { title: 'Danger Zone', keys: ['clear'] },
];

export default function TrainingIndexScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    athleteId?: string;
    programCreated?: string;
    programmingBlockId?: string;
    programmingWeek?: string;
    programmingDay?: string;
  }>();
  const rosterAthleteId = params.athleteId ? String(params.athleteId) : null;
  const programCreatedNonce = params.programCreated ? String(params.programCreated) : null;
  const returnBlockId = params.programmingBlockId ? Number(params.programmingBlockId) : null;
  const returnWeek = params.programmingWeek ? Number(params.programmingWeek) : null;
  const returnDay = params.programmingDay ? String(params.programmingDay) : null;
  const isIndividual = user?.workspace_mode === 'individual' || !!user?.is_individual_workspace || !!user?.is_self_coached;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hub, setHub] = useState<TrainingHubPayload | null>(null);
  const [programBlocks, setProgramBlocks] = useState<ProgramBlockPayload[]>([]);
  const [pendingMap, setPendingMap] = useState<SessionMap>({});
  const [completedMap, setCompletedMap] = useState<SessionMap>({});
  const [attentionModal, setAttentionModal] = useState<AttentionModalState>(null);
  const [attentionReason, setAttentionReason] = useState('');
  const [attentionComment, setAttentionComment] = useState('');
  const [attentionSubmitting, setAttentionSubmitting] = useState(false);
  const hasLoadedTrainingRef = useRef(false);

  const loadTraining = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const endpoint = rosterAthleteId
      ? `/workouts/my_list/mobile/${rosterAthleteId}`
      : '/workouts/my_list/mobile';

    try {
      const resp = await fetchJson(endpoint, { method: 'GET' });
      const res: any = resp.json;
      if (!resp.ok || !res?.ok) {
        setError(res?.error || res?.message || `HTTP ${resp.status}`);
        setHub(null);
        setProgramBlocks([]);
        setPendingMap({});
        setCompletedMap({});
        return;
      }
      setHub(res.training_hub || null);
      setProgramBlocks(res.blocks || []);
      setPendingMap(res.pending_map || {});
      setCompletedMap(res.completed_map || {});
    } catch (err: any) {
      setError(err?.message || 'Training Hub could not load.');
      setHub(null);
      setProgramBlocks([]);
      setPendingMap({});
      setCompletedMap({});
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [rosterAthleteId, programCreatedNonce]);

  useFocusEffect(
    useCallback(() => {
      const silent = hasLoadedTrainingRef.current;
      hasLoadedTrainingRef.current = true;
      loadTraining({ silent });
    }, [loadTraining])
  );

  const weekDays = useMemo(() => hub?.week?.days || [], [hub?.week?.days]);
  const movementLifts = useMemo(
    () => (hub?.movement_history?.lifts || []).filter(hasMovementHistory),
    [hub?.movement_history?.lifts]
  );

  const openWorkout = (workoutId?: number | null) => {
    if (!workoutId) return;
    router.push({
      pathname: '/workout/[workoutId]',
      params: { workoutId: String(workoutId) },
    });
  };

  const openSessionWorkspace = (workoutId?: number | null, context?: ProgrammingReturnContext) => {
    if (!workoutId) return;
    router.push({
      pathname: '/workout/session-workspace/[workoutId]' as any,
      params: {
        workoutId: String(workoutId),
        ...(context?.blockId ? { programmingBlockId: String(context.blockId) } : {}),
        ...(context?.week ? { programmingWeek: String(context.week) } : {}),
        ...(context?.day ? { programmingDay: String(context.day) } : {}),
      },
    });
  };

  const openFilmRoom = () => {
    router.push('/(tabs)/video-archive' as any);
  };

  const openBlockDetails = () => {
    router.push('/(tabs)/workout/block-details' as any);
  };

  const openSessionHistory = () => {
    router.push('/(tabs)/workout/session-history' as any);
  };

  const addSessionForDate = (date?: string | null) => {
    router.push({
      pathname: '/(tabs)/create-workout',
      params: date ? { date } : {},
    } as any);
  };

  const openMovementHistory = () => {
    router.push('/(tabs)/workout/movement-history' as any);
  };

  const openFullSchedule = () => {
    router.push('/(tabs)/athlete-calendar' as any);
  };

  const openAttentionModal = (type: 'missed' | 'incomplete', session: HubSession) => {
    setAttentionModal({ type, session });
    setAttentionReason(type === 'missed' ? missedReasons[0].key : incompleteReasons[0].key);
    setAttentionComment('');
  };

  const coordinateWithCoach = (session: HubSession) => {
    if (isIndividual) return;
    const sessionName = sessionTitle(session);
    const sessionDate = formatLongDate(session.date);
    const draft = [
      `Hey coach, I need to adjust ${sessionName}${sessionDate ? ` from ${sessionDate}` : ''}.`,
      session.block_name ? `Block: ${session.block_name}.` : null,
      'What should I do next?',
    ].filter(Boolean).join('\n');

    router.push({
      pathname: '/(tabs)/messages',
      params: {
        draft,
        contextType: 'training_session',
        workoutId: String(session.id),
        draftNonce: String(Date.now()),
      },
    } as any);
  };

  const submitAttention = async () => {
    if (!attentionModal) return;
    const endpoint = attentionModal.type === 'missed'
      ? `/workouts/mobile/${attentionModal.session.id}/acknowledge-missed`
      : `/workouts/mobile/${attentionModal.session.id}/mark-incomplete`;

    try {
      setAttentionSubmitting(true);
      const resp = await fetchJson<any>(endpoint, {
        method: 'POST',
        body: {
          reason: attentionReason,
          comment: attentionComment,
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setAttentionModal(null);
      setAttentionReason('');
      setAttentionComment('');
      await loadTraining({ silent: true });
    } catch (err: any) {
      Alert.alert('Could not save context', err?.message || 'Please try again.');
    } finally {
      setAttentionSubmitting(false);
    }
  };

  if (isIndividual) {
    return (
      <IndividualProgrammingHome
        hub={hub}
        loading={loading}
        error={error}
        refreshing={refreshing}
        onRefresh={() => loadTraining({ silent: true })}
        blocks={programBlocks}
        pendingMap={pendingMap}
        completedMap={completedMap}
        onOpenSession={openSessionWorkspace}
        onAddSession={addSessionForDate}
        initialBlockId={Number.isFinite(returnBlockId || NaN) ? returnBlockId : null}
        initialWeek={Number.isFinite(returnWeek || NaN) ? returnWeek : null}
        initialDay={returnDay}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTraining({ silent: true })} tintColor={colors.muted} />}
      >
        <TrainingHubHeader today={hub?.today} />

        {loading ? (
          <StateLine icon="barbell-outline" title="Loading Training Hub" body="Finding your current rhythm." />
        ) : error ? (
          <StateLine icon="alert-circle-outline" title="Training Hub unavailable" body={error} />
        ) : (
          <>
            <CurrentBlockAnchor
              block={hub?.current_block || null}
              onViewBlock={openBlockDetails}
            />
            <CurrentPosition block={hub?.current_block || null} memory={hub?.memory || null} days={weekDays} onOpen={openWorkout} />
            <WeekRhythm days={weekDays} onOpen={openWorkout} onFullSchedule={openFullSchedule} />
            <TrainingDetails
              block={hub?.current_block || null}
              movementLifts={movementLifts}
              onViewBlock={openBlockDetails}
              onSessionHistory={openSessionHistory}
              onMovementHistory={openMovementHistory}
              onFilmRoom={openFilmRoom}
            />
          </>
        )}
      </ScrollView>

      <AttentionModal
        state={attentionModal}
        reason={attentionReason}
        comment={attentionComment}
        submitting={attentionSubmitting}
        onReasonChange={setAttentionReason}
        onCommentChange={setAttentionComment}
        onClose={() => setAttentionModal(null)}
        onSubmit={submitAttention}
        onMessageCoach={coordinateWithCoach}
        isIndividual={isIndividual}
      />
    </View>
  );
}

function IndividualProgrammingHome({
  hub,
  loading,
  error,
  refreshing,
  onRefresh,
  blocks,
  pendingMap,
  completedMap,
  onOpenSession,
  onAddSession,
  initialBlockId,
  initialWeek,
  initialDay,
}: {
  hub: TrainingHubPayload | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  blocks: ProgramBlockPayload[];
  pendingMap: SessionMap;
  completedMap: SessionMap;
  onOpenSession: (id?: number | null, context?: ProgrammingReturnContext) => void;
  onAddSession: (date?: string | null) => void;
  initialBlockId?: number | null;
  initialWeek?: number | null;
  initialDay?: string | null;
}) {
  const router = useRouter();
  const activeProgram = hub?.active_program || null;
  const currentBlock = hub?.current_block || null;

  const handleProgramPress = () => {
    router.push('/(tabs)/workout/create-program' as any);
  };

  return (
    <View style={styles.screen}>
      {activeProgram ? (
        <View pointerEvents="none" style={styles.programmingPageAtmosphere}>
          <ImageBackground
            source={programmingAtmosphere}
            resizeMode="cover"
            style={styles.programmingPageAtmosphereImage}
            imageStyle={styles.programmingPageAtmosphereBitmap}
          >
            <View style={styles.programmingPageAtmosphereDim} />
            <View style={styles.programmingPageAtmosphereTint} />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(2, 2, 6, 0.94)',
                'rgba(2, 2, 6, 0.18)',
                'rgba(2, 2, 6, 0.12)',
                'rgba(2, 2, 6, 0.82)',
                'rgba(2, 2, 6, 1)',
              ]}
              locations={[0, 0.18, 0.50, 0.82, 1]}
              style={styles.programmingPageAtmosphereFade}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(2, 2, 6, 0.86)',
                'rgba(2, 2, 6, 0.12)',
                'rgba(2, 2, 6, 0.10)',
                'rgba(2, 2, 6, 0.86)',
              ]}
              locations={[0, 0.18, 0.82, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.programmingPageAtmosphereFade}
            />
          </ImageBackground>
        </View>
      ) : null}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.programmingScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      >
        {loading ? (
          <StateLine icon="barbell-outline" title="Loading Programming" body="Checking your current training structure." />
        ) : error ? (
          <StateLine icon="alert-circle-outline" title="Programming unavailable" body={error} />
        ) : activeProgram ? (
          <ActiveProgrammingRoadmap
            key={`programming-roadmap-${activeProgram.id || 'none'}`}
            activeProgram={activeProgram}
            currentBlock={currentBlock}
            blocks={blocks}
            pendingMap={pendingMap}
            completedMap={completedMap}
            onOpenSession={onOpenSession}
            onAddSession={onAddSession}
            onManageProgram={(programId) => router.push({
              pathname: '/(tabs)/workout/create-program',
              params: { mode: 'edit', programId: String(programId) },
            } as any)}
            onRefresh={onRefresh}
            athleteId={hub?.athlete?.id || null}
            initialBlockId={initialBlockId}
            initialWeek={initialWeek}
            initialDay={initialDay}
          />
        ) : (
          <View style={styles.programmingEmptyRow}>
            <Text style={styles.programmingEmptyText}>No active program</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create program"
              onPress={handleProgramPress}
              style={({ pressed }) => [
                styles.programmingAddButton,
                pressed && styles.programmingAddButtonPressed,
              ]}
            >
              <Text style={styles.programmingAddButtonText}>+ Program</Text>
            </Pressable>
          </View>
        )}

        {!activeProgram ? (
          <View style={styles.gettingStarted}>
            <Text style={styles.gettingStartedTitle}>Getting Started</Text>
            <View style={styles.gettingStartedList}>
              <GettingStartedStep index={1} label="Create a training program" />
              <GettingStartedStep index={2} label="Add your first block" />
              <GettingStartedStep index={3} label="Build your first session" />
              <GettingStartedStep index={4} label="Schedule training" />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ActiveProgrammingRoadmap({
  activeProgram,
  currentBlock,
  blocks,
  pendingMap,
  completedMap,
  onOpenSession,
  onAddSession,
  onManageProgram,
  onRefresh,
  athleteId,
  initialBlockId,
  initialWeek,
  initialDay,
}: {
  activeProgram: NonNullable<TrainingHubPayload['active_program']>;
  currentBlock: TrainingHubPayload['current_block'] | null;
  blocks: ProgramBlockPayload[];
  pendingMap: SessionMap;
  completedMap: SessionMap;
  onOpenSession: (id?: number | null, context?: ProgrammingReturnContext) => void;
  onAddSession: (date?: string | null) => void;
  onManageProgram: (programId: number) => void;
  onRefresh: () => void | Promise<void>;
  athleteId?: number | null;
  initialBlockId?: number | null;
  initialWeek?: number | null;
  initialDay?: string | null;
}) {
  const orderedBlocks = useMemo(() => {
    return [...blocks].sort((a, b) => Number(a.order_idx || 0) - Number(b.order_idx || 0));
  }, [blocks]);
  const currentBlockId = currentBlock?.id || orderedBlocks[0]?.id || null;
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(initialBlockId || currentBlockId);
  const [expandedWeek, setExpandedWeek] = useState(Math.max(1, Number(initialWeek || 1)));
  const [selectedDayKeys, setSelectedDayKeys] = useState<Record<string, string>>({});
  const [weekMenu, setWeekMenu] = useState<RoadmapWeek | null>(null);
  const [weekAction, setWeekAction] = useState<WeekActionState | null>(null);
  const [weekActionBusy, setWeekActionBusy] = useState(false);
  const [weekActionWarning, setWeekActionWarning] = useState('');
  const [weekActionConfirmed, setWeekActionConfirmed] = useState(false);
  const [blockMenu, setBlockMenu] = useState<ProgramBlockPayload | null>(null);
  const [blockAction, setBlockAction] = useState<BlockActionState | null>(null);
  const [blockActionBusy, setBlockActionBusy] = useState(false);
  const [blockActionWarning, setBlockActionWarning] = useState('');
  const [blockActionConfirmed, setBlockActionConfirmed] = useState(false);

  useEffect(() => {
    if (!orderedBlocks.length) {
      setSelectedBlockId(null);
      return;
    }
    const restoredBlock = initialBlockId && orderedBlocks.some((block) => block.id === initialBlockId)
      ? initialBlockId
      : null;
    const nextId = restoredBlock || currentBlockId || orderedBlocks[0].id;
    setSelectedBlockId((existing) => (
      existing && orderedBlocks.some((block) => block.id === existing) ? existing : nextId
    ));
  }, [currentBlockId, initialBlockId, orderedBlocks]);

  const selectedBlock = orderedBlocks.find((block) => block.id === selectedBlockId) || orderedBlocks[0] || null;

  useEffect(() => {
    const restoredWeek = selectedBlock?.id === initialBlockId && initialWeek
      ? Math.max(1, Number(initialWeek))
      : null;
    setExpandedWeek(restoredWeek || Math.max(1, Number(selectedBlock?.current_week || 1)));
  }, [initialBlockId, initialWeek, selectedBlock?.id, selectedBlock?.current_week]);

  const programWeeks = programWeekCount(activeProgram, orderedBlocks);
  const weeks = useMemo(
    () => buildRoadmapWeeks(selectedBlock, pendingMap, completedMap),
    [selectedBlock, pendingMap, completedMap]
  );
  const visibleWeeks = weeks;

  const manageProgram = () => {
    if (activeProgram.id) {
      onManageProgram(Number(activeProgram.id));
    }
  };

  const openWeekAction = (action: WeekActionKey, week: RoadmapWeek) => {
    setWeekMenu(null);
    setWeekAction({ action, week });
    setWeekActionWarning('');
    setWeekActionConfirmed(false);
  };

  const openBlockAction = (action: BlockActionKey, block: ProgramBlockPayload) => {
    setBlockMenu(null);
    if (action === 'edit') {
      if (activeProgram.id) {
        onManageProgram(Number(activeProgram.id));
      }
      return;
    }
    setBlockAction({ action, block });
    setBlockActionWarning('');
    setBlockActionConfirmed(false);
  };

  const executeWeekAction = async (action: WeekActionKey, week: RoadmapWeek, extra?: Record<string, any>) => {
    if (!activeProgram.id || !selectedBlock?.id || !athleteId || !week.startDate) {
      setWeekActionWarning('Week action context is missing.');
      return;
    }
    const payload = {
      action: action.replaceAll('-', '_'),
      athlete_id: athleteId,
      program_id: activeProgram.id,
      block_id: selectedBlock.id,
      source_week_start: week.startDate,
      week_start: week.startDate,
      confirm_conflicts: weekActionConfirmed,
      confirm_clear: weekActionConfirmed,
      ...(extra || {}),
    };
    try {
      setWeekActionBusy(true);
      setWeekActionWarning('');
      const resp = await fetchJson<any>('/workouts/mobile/programming/week-actions', {
        method: 'POST',
        body: payload as any,
      });
      const json = resp.json || {};
      if (resp.status === 409 && json.requires_confirmation) {
        setWeekActionConfirmed(true);
        setWeekActionWarning(json.error || 'Confirm to continue.');
        return;
      }
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setWeekAction(null);
      setWeekActionConfirmed(false);
      await onRefresh();
    } catch (err: any) {
      setWeekActionWarning(err?.message || 'Week action could not be completed.');
    } finally {
      setWeekActionBusy(false);
    }
  };

  const executeBlockAction = async (action: BlockActionKey, block: ProgramBlockPayload, extra?: Record<string, any>) => {
    if (!activeProgram.id || !block.id || !athleteId) {
      setBlockActionWarning('Block action context is missing.');
      return;
    }
    const payload = {
      action: action.replaceAll('-', '_'),
      athlete_id: athleteId,
      program_id: activeProgram.id,
      block_id: block.id,
      confirm_conflicts: blockActionConfirmed,
      confirm_template_truncation: blockActionConfirmed,
      confirm_clear: blockActionConfirmed,
      ...(extra || {}),
    };
    try {
      setBlockActionBusy(true);
      setBlockActionWarning('');
      const resp = await fetchJson<any>('/workouts/mobile/programming/block-actions', {
        method: 'POST',
        body: payload as any,
      });
      const json = resp.json || {};
      if (resp.status === 409 && json.requires_confirmation) {
        setBlockActionConfirmed(true);
        setBlockActionWarning(json.error || 'Confirm to continue.');
        return;
      }
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setBlockAction(null);
      setBlockActionConfirmed(false);
      await onRefresh();
    } catch (err: any) {
      setBlockActionWarning(err?.message || 'Block action could not be completed.');
    } finally {
      setBlockActionBusy(false);
    }
  };

  return (
    <View style={styles.roadmap}>
      <View style={styles.programSummaryCard}>
        <View style={styles.programSummaryIcon}>
          <Ionicons name="barbell-outline" size={25} color={colors.violet} />
        </View>
        <View style={styles.programSummaryCopy}>
          <Text style={styles.programSummaryName}>{activeProgram.name || 'Training Program'}</Text>
          <Text style={styles.programSummaryMeta}>
            {orderedBlocks.length || 0} Blocks <Text style={styles.programSummaryDot}>•</Text> {programWeeks || 0} Weeks
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage program"
          onPress={manageProgram}
          style={({ pressed }) => [styles.programManageButton, pressed && styles.pressed]}
        >
          <Text style={styles.programManageText}>Manage</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.textStrong} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.blockTabs}
      >
        {orderedBlocks.length ? orderedBlocks.map((block, index) => {
          const selected = block.id === selectedBlock?.id;
          return (
            <Pressable
              key={block.id}
              onPress={() => setSelectedBlockId(block.id)}
              style={[styles.blockTab, selected && styles.blockTabActive]}
            >
              <View style={styles.blockTabInner}>
                <Text style={[styles.blockTabText, selected && styles.blockTabTextActive]}>
                  {blockTabLabel(block, index)}
                </Text>
                {selected ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Block actions for ${block.name || blockTabLabel(block, index)}`}
                    hitSlop={8}
                    onPress={() => setBlockMenu(block)}
                    style={({ pressed }) => [styles.blockTabMenuButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={colors.textStrong} />
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }) : (
          <View style={[styles.blockTab, styles.blockTabActive]}>
            <View style={styles.blockTabInner}>
              <Text style={[styles.blockTabText, styles.blockTabTextActive]}>Block 1</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.weekCardList}>
        {visibleWeeks.length ? visibleWeeks.map((week) => {
          const expanded = week.index === expandedWeek;
          const weekKey = `${selectedBlock?.id || 'fallback'}:${week.index}`;
          const restoredDay = selectedBlock?.id === initialBlockId && week.index === initialWeek ? initialDay : null;
          const selectedDayKey = selectedDayKeys[weekKey] || restoredDay || firstDayKeyForWeek(week);
          const selectedDay = week.days.find((day) => day.key === selectedDayKey) || week.days[0] || null;
          return (
            <Pressable
              key={`${selectedBlock?.id || 'fallback'}-${week.index}`}
              onPress={() => setExpandedWeek(week.index)}
              style={[styles.weekCard, expanded && styles.weekCardExpanded]}
            >
              <View style={styles.weekCardHeader}>
                <View style={styles.weekCardTitleLine}>
                  {expanded ? (
                    <View style={styles.weekCardIcon}>
                      <Ionicons name="calendar-outline" size={20} color={colors.violet} />
                    </View>
                  ) : null}
                  <View style={styles.weekCardTitleCopy}>
                    <Text style={styles.weekCardTitle}>Week {week.index}</Text>
                    <Text style={styles.weekCardRange}>{week.rangeLabel}</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Week ${week.index} actions`}
                  onPress={() => setWeekMenu(week)}
                  style={({ pressed }) => [styles.weekActionsButton, pressed && styles.pressed]}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.textStrong} />
                </Pressable>
              </View>

              {expanded ? (
                <>
                  <View style={styles.weekStrip}>
                    {week.days.map((day) => (
                      <Pressable
                        key={day.key}
                        accessibilityRole="button"
                        accessibilityLabel={`${day.label}${day.count ? `, ${day.count} session${day.count === 1 ? '' : 's'}` : ', no sessions'}`}
                        onPress={() => setSelectedDayKeys((existing) => ({ ...existing, [weekKey]: day.key }))}
                        style={[styles.weekStripDay, selectedDay?.key === day.key && styles.weekStripDaySelected]}
                      >
                        <Text style={styles.weekStripLabel}>{day.label}</Text>
                        <View style={[styles.weekStripDot, day.count > 0 && styles.weekStripDotActive]}>
                          {day.count > 1 ? <Text style={styles.weekStripCount}>{day.count}</Text> : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  {selectedDay?.sessions.length ? (
                    <View style={styles.daySessionList}>
                      {selectedDay.sessions.map((session) => {
                        const preview = buildSessionPreview(week.index, session);
                        return (
                          <View key={session.id} style={styles.sessionPreview}>
                            <View style={styles.sessionPreviewHeader}>
                              <View style={styles.sessionPreviewTitleLine}>
                                <Text style={styles.sessionPreviewCode}>{preview.code}</Text>
                                <Text style={styles.sessionStatusPill}>{preview.status}</Text>
                              </View>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Edit session plan"
                                onPress={() => onOpenSession(preview.sessionId, {
                                  blockId: selectedBlock?.id || null,
                                  week: week.index,
                                  day: selectedDay?.key || null,
                                })}
                                style={({ pressed }) => [
                                  styles.sessionViewButton,
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Text style={styles.sessionViewText}>Edit Plan</Text>
                              </Pressable>
                            </View>
                            {preview.lines.length ? preview.lines.map((line, lineIndex) => {
                              const detail = splitPreviewDetail(line.detail);
                              return (
                                <View key={`${line.label}-${lineIndex}`} style={styles.sessionPreviewLine}>
                                  <Text style={styles.sessionPreviewLift}>{line.label}</Text>
                                  <Text style={styles.sessionPreviewWork}>{detail.work}</Text>
                                  {detail.load ? <Text style={styles.sessionPreviewLoad}>{detail.load}</Text> : null}
                                </View>
                              );
                            }) : (
                              <Text style={styles.sessionAccessoryText}>No core lifts</Text>
                            )}
                            <View style={styles.sessionAccessoryRow}>
                              <Ionicons name="briefcase-outline" size={15} color={colors.subtle} />
                              <Text style={styles.sessionAccessoryText}>{preview.accessories}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.dayEmptyState}>
                      <Text style={styles.dayEmptyTitle}>None</Text>
                      <Text style={styles.weekEmptyText}>No session scheduled for this day.</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add session"
                        onPress={() => onAddSession(selectedDay?.date)}
                        style={({ pressed }) => [styles.addSessionButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.addSessionButtonText}>+ Add Session</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.weekCollapsedRow}>
                  <Text style={styles.weekCollapsedSummary}>{week.summary}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.subtle} />
                </View>
              )}
            </Pressable>
          );
        }) : (
          <View style={styles.weekEmptyBlock}>
            <Text style={styles.weekEmptyTitle}>No blocks found</Text>
            <Text style={styles.weekEmptyText}>This program does not have a block roadmap yet.</Text>
          </View>
        )}
      </View>
      <WeekActionMenu
        week={weekMenu}
        onClose={() => setWeekMenu(null)}
        onSelect={openWeekAction}
      />
      <BlockActionMenu
        block={blockMenu}
        onClose={() => setBlockMenu(null)}
        onSelect={openBlockAction}
      />
      <WeekActionModal
        state={weekAction}
        weeks={visibleWeeks}
        busy={weekActionBusy}
        warning={weekActionWarning}
        confirmed={weekActionConfirmed}
        onClose={() => {
          setWeekAction(null);
          setWeekActionWarning('');
          setWeekActionConfirmed(false);
        }}
        onSubmit={executeWeekAction}
      />
      <BlockActionModal
        state={blockAction}
        busy={blockActionBusy}
        warning={blockActionWarning}
        confirmed={blockActionConfirmed}
        onClose={() => {
          setBlockAction(null);
          setBlockActionWarning('');
          setBlockActionConfirmed(false);
        }}
        onSubmit={executeBlockAction}
      />
    </View>
  );
}

function WeekActionMenu({
  week,
  onClose,
  onSelect,
}: {
  week: RoadmapWeek | null;
  onClose: () => void;
  onSelect: (action: WeekActionKey, week: RoadmapWeek) => void;
}) {
  return (
    <Modal visible={!!week} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionSheetScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.weekActionSheet}>
          <View style={styles.weekActionSheetHeader}>
            <View>
              <Text style={styles.weekActionTitle}>{week ? `Week ${week.index}` : 'Week'}</Text>
              {week?.rangeLabel ? <Text style={styles.weekActionSubtitle}>{week.rangeLabel}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close week actions"
              onPress={onClose}
              style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>
          <View style={styles.actionGroupList}>
            {weekActionGroups.map((group) => (
              <ActionGroup
                key={group.title}
                title={group.title}
                actions={group.keys.map((key) => weekActionRows.find((row) => row.key === key)).filter(Boolean) as Array<{ key: WeekActionKey; label: string }>}
                dangerKeys={['clear']}
                onSelect={(key) => week && onSelect(key as WeekActionKey, week)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BlockActionMenu({
  block,
  onClose,
  onSelect,
}: {
  block: ProgramBlockPayload | null;
  onClose: () => void;
  onSelect: (action: BlockActionKey, block: ProgramBlockPayload) => void;
}) {
  return (
    <Modal visible={!!block} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionSheetScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.weekActionSheet}>
          <View style={styles.weekActionSheetHeader}>
            <View>
              <Text style={styles.weekActionTitle}>{block?.name || 'Selected Block'}</Text>
              {block?.date_range_label ? <Text style={styles.weekActionSubtitle}>{block.date_range_label}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close block actions"
              onPress={onClose}
              style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>
          <View style={styles.actionGroupList}>
            {blockActionGroups.map((group) => (
              <ActionGroup
                key={group.title}
                title={group.title}
                actions={group.keys.map((key) => blockActionRows.find((row) => row.key === key)).filter(Boolean) as Array<{ key: BlockActionKey; label: string; danger?: boolean }>}
                dangerKeys={['clear']}
                onSelect={(key) => block && onSelect(key as BlockActionKey, block)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ActionGroup<T extends string>({
  title,
  actions,
  dangerKeys,
  onSelect,
}: {
  title: string;
  actions: Array<{ key: T; label: string; danger?: boolean }>;
  dangerKeys?: T[];
  onSelect: (key: T) => void;
}) {
  if (!actions.length) return null;

  return (
    <View style={styles.actionGroup}>
      <Text style={styles.actionGroupTitle}>{title}</Text>
      <View style={styles.weekActionRows}>
        {actions.map((action) => {
          const danger = !!action.danger || !!dangerKeys?.includes(action.key);
          return (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              onPress={() => onSelect(action.key)}
              style={({ pressed }) => [styles.weekActionRow, pressed && styles.pressed]}
            >
              <Text style={[styles.weekActionRowText, danger && styles.weekActionRowDanger]}>
                {action.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={danger ? colors.red : colors.subtle} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WeekActionModal({
  state,
  weeks,
  busy,
  warning,
  confirmed,
  onClose,
  onSubmit,
}: {
  state: WeekActionState | null;
  weeks: RoadmapWeek[];
  busy: boolean;
  warning: string;
  confirmed: boolean;
  onClose: () => void;
  onSubmit: (action: WeekActionKey, week: RoadmapWeek, extra?: Record<string, any>) => void | Promise<void>;
}) {
  const action = state?.action || null;
  const week = state?.week || null;
  const availableWeeks = useMemo(
    () => weeks.filter((candidate) => candidate.startDate && candidate.startDate !== week?.startDate),
    [week?.startDate, weeks]
  );
  const [selectedWeekStart, setSelectedWeekStart] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState<WeekTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateError, setTemplateError] = useState('');
  const needsWeekChoice = action === 'copy-to' || action === 'copy-from' || action === 'shift';
  const needsTemplateChoice = action === 'apply-template';

  useEffect(() => {
    if (!state) return;
    const firstWeek = weeks.find((candidate) => candidate.startDate && candidate.startDate !== state.week.startDate);
    setSelectedWeekStart(firstWeek?.startDate || '');
    setTemplateName(`Week ${state.week.index} Template`);
    setSelectedTemplateId('');
    setTemplateError('');
  }, [state, weeks]);

  useEffect(() => {
    if (action !== 'apply-template') return;
    let active = true;
    setTemplateError('');
    fetchJson<any>('/workouts/mobile/programming/week-templates', { method: 'GET' })
      .then((resp) => {
        const json = resp.json || {};
        if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
        if (!active) return;
        const rows = json.templates || [];
        setTemplates(rows);
        setSelectedTemplateId(rows[0]?.id ? String(rows[0].id) : '');
      })
      .catch((err) => {
        if (!active) return;
        setTemplates([]);
        setTemplateError(err?.message || 'Week templates could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [action]);

  if (!state || !week || !action) return null;

  const selectedWeek = weeks.find((candidate) => candidate.startDate === selectedWeekStart) || null;
  const selectedTemplate = templates.find((template) => String(template.id) === selectedTemplateId) || null;
  const canConfirm = !busy && (
    needsWeekChoice ? !!selectedWeekStart
      : needsTemplateChoice ? !!selectedTemplateId
        : true
  );
  const submitLabel = action === 'clear' && confirmed
    ? 'Clear Week'
    : confirmed
      ? action === 'shift' ? 'Shift Anyway' : action === 'apply-template' ? 'Apply Anyway' : 'Copy Anyway'
      : action === 'clear'
        ? 'Review Clear'
        : 'Confirm';
  const extra: Record<string, any> = {};
  if (action === 'copy-to' || action === 'shift') extra.target_week_start = selectedWeekStart;
  if (action === 'copy-from') {
    extra.source_week_start = selectedWeekStart;
    extra.target_week_start = week.startDate;
  }
  if (action === 'save-template') extra.template_name = templateName;
  if (action === 'apply-template') {
    extra.template_id = selectedTemplateId;
    extra.target_week_start = week.startDate;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionSheetScrim}>
        <View style={styles.weekActionModal}>
          <View style={styles.weekActionSheetHeader}>
            <View>
              <Text style={styles.weekActionEyebrow}>Week Action</Text>
              <Text style={styles.weekActionTitle}>{weekActionLabel(action)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close week action"
              onPress={onClose}
              style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>

          <Text style={styles.weekActionCopy}>{weekActionCopy(action)}</Text>

          {needsWeekChoice ? (
            <View style={styles.weekChoiceList}>
              <Text style={styles.weekActionFieldLabel}>{action === 'copy-from' ? 'Source week' : 'Target week'}</Text>
              {availableWeeks.length ? availableWeeks.map((candidate) => {
                const selected = candidate.startDate === selectedWeekStart;
                return (
                  <Pressable
                    key={candidate.startDate || candidate.index}
                    onPress={() => setSelectedWeekStart(candidate.startDate || '')}
                    style={[styles.weekChoiceRow, selected && styles.weekChoiceRowSelected]}
                  >
                    <View>
                      <Text style={[styles.weekChoiceTitle, selected && styles.weekChoiceTitleSelected]}>Week {candidate.index}</Text>
                      <Text style={styles.weekChoiceMeta}>{candidate.rangeLabel} · {candidate.summary}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.violet} /> : null}
                  </Pressable>
                );
              }) : (
                <Text style={styles.weekActionEmpty}>No other weeks available.</Text>
              )}
            </View>
          ) : null}

          {action === 'save-template' ? (
            <View style={styles.weekActionField}>
              <Text style={styles.weekActionFieldLabel}>Template name</Text>
              <TextInput
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="Week template name"
                placeholderTextColor={colors.subtle}
                style={styles.weekActionInput}
              />
            </View>
          ) : null}

          {needsTemplateChoice ? (
            <View style={styles.weekChoiceList}>
              <Text style={styles.weekActionFieldLabel}>Week template</Text>
              {templateError ? <Text style={styles.weekActionWarning}>{templateError}</Text> : null}
              {templates.length ? templates.map((template) => {
                const selected = String(template.id) === selectedTemplateId;
                return (
                  <Pressable
                    key={template.id}
                    onPress={() => setSelectedTemplateId(String(template.id))}
                    style={[styles.weekChoiceRow, selected && styles.weekChoiceRowSelected]}
                  >
                    <View>
                      <Text style={[styles.weekChoiceTitle, selected && styles.weekChoiceTitleSelected]}>{template.name || 'Week Template'}</Text>
                      <Text style={styles.weekChoiceMeta}>{Number(template.session_count || 0)} sessions</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.violet} /> : null}
                  </Pressable>
                );
              }) : !templateError ? (
                <Text style={styles.weekActionEmpty}>No saved week templates yet.</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.weekActionPreview}>
            <Text style={styles.weekActionPreviewText}>
              {weekActionPreview(action, week, selectedWeek, selectedTemplate)}
            </Text>
          </View>

          {warning ? <Text style={styles.weekActionWarning}>{warning}</Text> : null}

          <View style={styles.weekActionFooter}>
            <Pressable
              disabled={busy}
              onPress={onClose}
              style={({ pressed }) => [styles.weekActionSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.weekActionSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!canConfirm}
              onPress={() => onSubmit(action, week, extra)}
              style={({ pressed }) => [
                styles.weekActionPrimary,
                !canConfirm && styles.weekActionDisabled,
                pressed && canConfirm && styles.pressed,
              ]}
            >
              <Text style={styles.weekActionPrimaryText}>{busy ? 'Working...' : submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BlockActionModal({
  state,
  busy,
  warning,
  confirmed,
  onClose,
  onSubmit,
}: {
  state: BlockActionState | null;
  busy: boolean;
  warning: string;
  confirmed: boolean;
  onClose: () => void;
  onSubmit: (action: BlockActionKey, block: ProgramBlockPayload, extra?: Record<string, any>) => void | Promise<void>;
}) {
  const action = state?.action || null;
  const block = state?.block || null;
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateError, setTemplateError] = useState('');
  const needsTemplateChoice = action === 'apply-template';

  useEffect(() => {
    if (!state) return;
    setTemplateName(`${state.block.name || 'Block'} Template`);
    setSelectedTemplateId('');
    setTemplateError('');
  }, [state]);

  useEffect(() => {
    if (action !== 'apply-template') return;
    let active = true;
    setTemplateError('');
    fetchJson<any>('/workouts/mobile/programming/block-templates', { method: 'GET' })
      .then((resp) => {
        const json = resp.json || {};
        if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
        if (!active) return;
        const rows = json.templates || [];
        setTemplates(rows);
        setSelectedTemplateId(rows[0]?.id ? String(rows[0].id) : '');
      })
      .catch((err) => {
        if (!active) return;
        setTemplates([]);
        setTemplateError(err?.message || 'Block templates could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [action]);

  if (!state || !block || !action) return null;

  const selectedTemplate = templates.find((template) => String(template.id) === selectedTemplateId) || null;
  const canConfirm = !busy && (needsTemplateChoice ? !!selectedTemplateId : true);
  const submitLabel = action === 'clear' && confirmed
    ? 'Clear Block Sessions'
    : confirmed
      ? action === 'apply-template' ? 'Apply Anyway' : 'Confirm'
      : action === 'clear'
        ? 'Review Clear'
        : 'Confirm';
  const extra: Record<string, any> = {};
  if (action === 'save-template') extra.template_name = templateName;
  if (action === 'apply-template') extra.template_id = selectedTemplateId;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionSheetScrim}>
        <View style={styles.weekActionModal}>
          <View style={styles.weekActionSheetHeader}>
            <View>
              <Text style={styles.weekActionEyebrow}>Block Action</Text>
              <Text style={styles.weekActionTitle}>{blockActionLabel(action)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close block action"
              onPress={onClose}
              style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>

          <Text style={styles.weekActionCopy}>{blockActionCopy(action)}</Text>

          {action === 'save-template' ? (
            <View style={styles.weekActionField}>
              <Text style={styles.weekActionFieldLabel}>Template name</Text>
              <TextInput
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="Block template name"
                placeholderTextColor={colors.subtle}
                style={styles.weekActionInput}
              />
            </View>
          ) : null}

          {needsTemplateChoice ? (
            <View style={styles.weekChoiceList}>
              <Text style={styles.weekActionFieldLabel}>Block template</Text>
              {templateError ? <Text style={styles.weekActionWarning}>{templateError}</Text> : null}
              {templates.length ? templates.map((template) => {
                const selected = String(template.id) === selectedTemplateId;
                return (
                  <Pressable
                    key={template.id}
                    onPress={() => setSelectedTemplateId(String(template.id))}
                    style={[styles.weekChoiceRow, selected && styles.weekChoiceRowSelected]}
                  >
                    <View>
                      <Text style={[styles.weekChoiceTitle, selected && styles.weekChoiceTitleSelected]}>{template.name || 'Block Template'}</Text>
                      <Text style={styles.weekChoiceMeta}>
                        {Number(template.week_count || template.default_duration_weeks || 0)} weeks · {Number(template.session_count || 0)} sessions
                      </Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.violet} /> : null}
                  </Pressable>
                );
              }) : !templateError ? (
                <Text style={styles.weekActionEmpty}>No saved block templates yet.</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.weekActionPreview}>
            <Text style={styles.weekActionPreviewText}>{blockActionPreview(action, block, selectedTemplate)}</Text>
          </View>

          {warning ? <Text style={styles.weekActionWarning}>{warning}</Text> : null}

          <View style={styles.weekActionFooter}>
            <Pressable
              disabled={busy}
              onPress={onClose}
              style={({ pressed }) => [styles.weekActionSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.weekActionSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!canConfirm}
              onPress={() => onSubmit(action, block, extra)}
              style={({ pressed }) => [
                styles.weekActionPrimary,
                !canConfirm && styles.weekActionDisabled,
                pressed && canConfirm && styles.pressed,
              ]}
            >
              <Text style={styles.weekActionPrimaryText}>{busy ? 'Working...' : submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function weekActionLabel(action: WeekActionKey) {
  return weekActionRows.find((row) => row.key === action)?.label || 'Week Action';
}

function weekActionCopy(action: WeekActionKey) {
  return {
    'copy-to': 'Send this week’s training structure to another week in the same block.',
    'copy-from': 'Pull a week’s training structure into the selected week.',
    'apply-template': 'Apply a saved week structure to this week.',
    'save-template': 'Save this week’s structure so it can be reused later.',
    'assign-drafts': 'Assign all draft sessions in this week.',
    'revert-assigned': 'Revert all assigned sessions in this week back to draft.',
    shift: 'Move this week’s sessions to another week without leaving copies behind.',
    clear: 'Clear safe-to-remove sessions from this week.',
  }[action];
}

function weekActionPreview(
  action: WeekActionKey,
  source: RoadmapWeek,
  target: RoadmapWeek | null,
  template: WeekTemplate | null
) {
  if (action === 'copy-to') return `Copy Week ${source.index} into ${target ? `Week ${target.index}` : 'target week'}. Copied sessions will be drafts.`;
  if (action === 'copy-from') return `Copy ${target ? `Week ${target.index}` : 'source week'} into Week ${source.index}. Copied sessions will be drafts.`;
  if (action === 'apply-template') return `Apply ${template?.name || 'selected template'} to Week ${source.index}. Applied sessions become drafts.`;
  if (action === 'save-template') return `Save Week ${source.index} as a reusable week template.`;
  if (action === 'assign-drafts') return `Assign every draft session in Week ${source.index}. Completed, logged, and locked sessions are preserved.`;
  if (action === 'revert-assigned') return `Revert every assigned session in Week ${source.index} to draft. Completed, logged, and locked sessions are preserved.`;
  if (action === 'shift') return `Move Week ${source.index} into ${target ? `Week ${target.index}` : 'target week'}. Source week becomes empty.`;
  return `Remove safe draft/assigned sessions from Week ${source.index}. Logged or locked sessions are preserved.`;
}

function blockActionLabel(action: BlockActionKey) {
  return blockActionRows.find((row) => row.key === action)?.label || 'Block Action';
}

function blockActionCopy(action: BlockActionKey) {
  return {
    edit: 'Edit this block through the program editor.',
    'apply-template': 'Apply a saved block structure into the selected training block.',
    'save-template': 'Save this block’s week/session structure for reuse.',
    'assign-drafts': 'Assign all draft sessions in this block.',
    'revert-assigned': 'Revert all assigned sessions in this block back to draft.',
    clear: 'Clear all sessions that are safe to remove from this block.',
  }[action];
}

function blockActionPreview(action: BlockActionKey, block: ProgramBlockPayload, template: BlockTemplate | null) {
  const blockName = block.name || 'selected block';
  if (action === 'apply-template') return `Apply ${template?.name || 'selected block template'} into ${blockName}. Applied sessions become drafts.`;
  if (action === 'save-template') return `Save ${blockName} as a reusable block template.`;
  if (action === 'assign-drafts') return `Assign every draft session in ${blockName}. Completed, logged, and locked sessions are preserved.`;
  if (action === 'revert-assigned') return `Revert every assigned session in ${blockName} to draft. Completed, logged, and locked sessions are preserved.`;
  if (action === 'clear') return `Remove safe draft/assigned sessions from ${blockName}. Logged or locked sessions are preserved.`;
  return `Open ${blockName} in the program editor.`;
}

function GettingStartedStep({ index, label }: { index: number; label: string }) {
  return (
    <View style={styles.gettingStartedRow}>
      <View style={styles.gettingStartedIndex}>
        <Text style={styles.gettingStartedIndexText}>{index}</Text>
      </View>
      <Text style={styles.gettingStartedText}>{label}</Text>
    </View>
  );
}

function TrainingHubHeader({ today }: { today?: string | null }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <Text style={styles.title}>Training Hub</Text>
        <Text style={styles.headerDate}>{formatLongDate(today) || 'Today'}</Text>
      </View>
    </View>
  );
}

function CurrentBlockAnchor({
  block,
  onViewBlock,
}: {
  block: NonNullable<TrainingHubPayload['current_block']> | null;
  onViewBlock: () => void;
}) {
  const progress = Math.max(0, Math.min(1, Number(block?.progress?.percent || 0)));
  const progressPercent = Math.round(progress * 100);
  const totalWeeks = Number(block?.progress?.total || 0);
  const completedWeeks = Math.max(0, Math.min(totalWeeks, Number(block?.progress?.completed || 0)));
  const hasBlock = !!block;
  const cycleLine = totalWeeks ? `${totalWeeks}-week cycle` : block?.phase || 'Training block';

  return (
    <View style={styles.blockZone}>
      <View style={styles.blockRail} />
      <View style={styles.blockMain}>
        <View style={styles.blockCopy}>
          <Text style={styles.zoneKicker}>Current Block</Text>
          <Text style={styles.blockName}>{block?.name || 'No active block'}</Text>
          <View style={styles.blockMetaLine}>
            <Text style={styles.blockMeta}>{cycleLine}</Text>
            {block?.week_label ? <Text style={styles.blockDot}>•</Text> : null}
            {block?.week_label ? <Text style={styles.blockWeekText}>{block.week_label}</Text> : null}
          </View>
          {block?.date_range_label ? <Text style={styles.blockDateRange}>{block.date_range_label}</Text> : null}

          {hasBlock ? (
            <View style={styles.blockStepLine}>
              {Array.from({ length: Math.max(1, totalWeeks || 4) }).map((_, index) => {
                const isDone = totalWeeks ? index < completedWeeks : index < Math.round(progress * 4);
                const isCurrent = totalWeeks
                  ? index === Math.min(Math.max(completedWeeks, 0), Math.max(totalWeeks - 1, 0))
                  : index === Math.min(Math.round(progress * 4), 3);
                return (
                  <React.Fragment key={`block-step-${index}`}>
                    <View style={[styles.blockStepDot, isDone && styles.blockStepDotDone, isCurrent && styles.blockStepDotCurrent]}>
                      {isDone ? <Ionicons name="checkmark" size={12} color="#120D16" /> : null}
                    </View>
                    {index < Math.max(1, totalWeeks || 4) - 1 ? (
                      <View style={[styles.blockStepConnector, (isDone || isCurrent) && styles.blockStepConnectorActive]} />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>
          ) : null}

          <View style={styles.blockActionRow}>
            <Pressable style={({ pressed }) => [styles.blockAction, pressed && styles.pressed]} onPress={onViewBlock}>
              <Text style={styles.blockActionText}>View Block Details</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.violet} />
            </Pressable>
          </View>
        </View>
        {hasBlock ? (
          <View style={styles.blockProgressRing}>
            <Text style={styles.blockProgressPercent}>{progressPercent}%</Text>
            <Text style={styles.blockProgressLabel}>Complete</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CurrentPosition({
  block,
  memory,
  days,
  onOpen,
}: {
  block: NonNullable<TrainingHubPayload['current_block']> | null;
  memory: TrainingHubPayload['memory'] | null;
  days: HubDay[];
  onOpen: (id?: number | null) => void;
}) {
  const weekCompleted = Number(block?.cadence?.this_week_completed || 0);
  const weekTotal = Number(block?.cadence?.this_week_total || 0);
  const todayDay = days.find((day) => day.is_today) || null;
  const todaySession = todayDay?.sessions?.[0] || null;
  const next = memory?.next_up || null;
  const todayText = todaySession ? sessionTitle(todaySession) : todayDay?.label?.toLowerCase().includes('recovery') ? 'Recovery Day' : 'Rest';
  const nextText = next ? sessionTitle(next) : 'Rest';
  const weekPosition = weekTotal
    ? `${weekCompleted} of ${weekTotal} completed`
    : 'No sessions this week';
  const cue = positionCue(block, weekCompleted, weekTotal);
  const weekDots = Array.from({ length: Math.max(weekTotal || 0, 1) });

  return (
    <View style={styles.positionZone}>
      <View style={styles.positionRail} />
      <View style={styles.positionMain}>
        <Text style={styles.zoneKicker}>Current Position</Text>
        <View style={styles.positionGrid}>
          <View style={styles.positionTodayBlock}>
            <View style={styles.positionTargetIcon}>
              <Ionicons name="locate" size={23} color={colors.green} />
            </View>
            <View style={styles.positionTodayCopy}>
              <Text style={styles.positionMetaLabel}>Today</Text>
              <Text style={styles.positionPrimary}>{todayText}</Text>
              {cue ? <Text style={styles.positionCue}>{cue}</Text> : null}
            </View>
          </View>
          <View style={styles.positionSecondaryRow}>
            <View style={styles.positionWeekBlock}>
              <Text style={styles.positionMetaLabel}>This Week</Text>
              <Text style={styles.positionWeekValue}>{weekTotal ? `${weekTotal} session${weekTotal === 1 ? '' : 's'}` : 'No sessions'}</Text>
              <View style={styles.positionDotLine}>
                {weekDots.map((_, index) => (
                  <View
                    key={`week-dot-${index}`}
                    style={[styles.positionWeekDot, index < weekCompleted && styles.positionWeekDotDone]}
                  />
                ))}
              </View>
              <Text style={styles.positionMetaValue}>{weekPosition}</Text>
            </View>
            <View style={styles.positionNextBlock}>
              <Text style={styles.positionMetaLabel}>Next</Text>
              <Text style={styles.positionPrimarySmall}>{nextText}</Text>
              <Text style={styles.positionMetaValue}>{next?.date ? formatShortDate(next.date) : 'Next training day'}</Text>
            </View>
          </View>
        </View>
        {todaySession?.id ? (
          <View style={styles.positionActionRow}>
            <Pressable style={({ pressed }) => [styles.positionAction, pressed && styles.pressed]} onPress={() => onOpen(todaySession.id)}>
              <Text style={styles.blockActionText}>Open Session</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.green} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TrainingDetails({
  block,
  movementLifts,
  onViewBlock,
  onSessionHistory,
  onMovementHistory,
  onFilmRoom,
}: {
  block: NonNullable<TrainingHubPayload['current_block']> | null;
  movementLifts: MovementLift[];
  onViewBlock: () => void;
  onSessionHistory: () => void;
  onMovementHistory: () => void;
  onFilmRoom: () => void;
}) {
  return (
    <View style={styles.accessZone}>
      <Text style={styles.zoneKicker}>Training Hub</Text>
      <View style={styles.accessGrid}>
        <DetailRow
          label="Block Details"
          value="Explore your block, goals, and movement plan."
          icon="layers-outline"
          tone={colors.violet}
          onPress={onViewBlock}
        />
        <DetailRow
          label="Session History"
          value="Review past workouts and performance."
          icon="time-outline"
          tone={colors.green}
          onPress={onSessionHistory}
        />
        <DetailRow
          label="Movement History"
          value="Track lifts, progress, and personal records."
          icon="analytics-outline"
          tone={colors.amber}
          onPress={onMovementHistory}
        />
        <DetailRow
          label="Film Room"
          value="Review your training videos and technique."
          icon="videocam-outline"
          tone={colors.violet}
          onPress={onFilmRoom}
        />
      </View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  icon,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.accessRow, pressed && !disabled && styles.pressed, disabled && styles.accessRowDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.accessIcon, { borderColor: `${tone}55`, backgroundColor: `${tone}18` }]}>
        <Ionicons name={icon} size={23} color={disabled ? colors.subtle : tone} />
      </View>
      <View style={styles.accessCopy}>
        <Text style={[styles.accessLabel, disabled && styles.accessTextDisabled]}>{label}</Text>
        <Text style={[styles.accessValue, disabled && styles.accessTextDisabled]} numberOfLines={2}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={disabled ? colors.subtle : colors.muted} />
    </Pressable>
  );
}

function WeekRhythm({
  days,
  onFullSchedule,
  onOpen,
}: {
  days: HubDay[];
  onFullSchedule: () => void;
  onOpen: (id?: number | null) => void;
}) {
  return (
    <View style={styles.weekZone}>
      <View style={styles.zoneHeader}>
        <Text style={styles.zoneKicker}>This Week</Text>
      </View>
      {days.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekTileRow}
        >
          {days.map((day) => {
            const firstSession = day.sessions?.[0] || null;
            const isRest = day.kind !== 'session';
            const status = weekDayStatus(day, firstSession);
            const shortTitle = weekDayShortLabel(day, firstSession);
            return (
              <Pressable
                key={day.date}
                style={[
                  styles.weekDayTile,
                  day.is_today && styles.weekDayToday,
                  !isRest && styles.weekDayTraining,
                ]}
                onPress={() => firstSession ? onOpen(firstSession.id) : undefined}
                disabled={!firstSession}
              >
                <Text style={[styles.weekLabel, day.is_today && styles.weekLabelToday]}>{day.label || formatWeekday(day.date)}</Text>
                <Text style={styles.weekNumber}>{day.day_number || dateNumber(day.date)}</Text>
                <View style={[styles.weekStatusIcon, { borderColor: `${status.color}55`, backgroundColor: status.active ? `${status.color}33` : 'rgba(8, 8, 12, 0.42)' }]}>
                  <Ionicons name={status.icon} size={15} color={status.color} />
                </View>
                <Text style={styles.weekStatus} numberOfLines={2}>{shortTitle}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.quietLine}>No sessions this week.</Text>
      )}
      <Pressable style={({ pressed }) => [styles.fullScheduleButton, pressed && styles.pressed]} onPress={onFullSchedule}>
        <Text style={styles.fullScheduleText}>View Full Schedule</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.violet} />
      </Pressable>
    </View>
  );
}

function StateLine({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.stateLine}>
      <Ionicons name={icon} size={18} color={colors.violet} />
      <View style={styles.stateCopy}>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateBody}>{body}</Text>
      </View>
      {title.toLowerCase().includes('loading') ? <ActivityIndicator color={colors.violet} /> : null}
    </View>
  );
}

function AttentionModal({
  state,
  reason,
  comment,
  submitting,
  onReasonChange,
  onCommentChange,
  onClose,
  onSubmit,
  onMessageCoach,
  isIndividual,
}: {
  state: AttentionModalState;
  reason: string;
  comment: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onMessageCoach: (session: HubSession) => void;
  isIndividual?: boolean;
}) {
  const options = state?.type === 'missed' ? missedReasons : incompleteReasons;
  const title = state?.type === 'missed' ? 'Check in on this session' : 'Add session context';

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalKicker}>Training context</Text>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalBody}>{state ? sessionTitle(state.session) : ''}</Text>

          <View style={styles.reasonGrid}>
            {options.map((option) => {
              const selected = reason === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.reasonOption, selected && styles.reasonOptionSelected]}
                  onPress={() => onReasonChange(option.key)}
                >
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={comment}
            onChangeText={onCommentChange}
            placeholder={isIndividual ? 'Add private training context' : 'Add a note for your coach'}
            placeholderTextColor={colors.subtle}
            style={styles.commentInput}
            multiline
            maxLength={1000}
          />

          <View style={styles.modalActions}>
            {state && !isIndividual ? (
              <Pressable style={styles.secondaryAction} onPress={() => onMessageCoach(state.session)}>
                <Text style={styles.secondaryActionText}>Message coach</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryAction} onPress={onClose} disabled={submitting}>
              <Text style={styles.secondaryActionText}>Close</Text>
            </Pressable>
            <Pressable style={styles.primaryAction} onPress={onSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color={colors.textStrong} /> : <Text style={styles.primaryActionText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function sessionTitle(session?: HubSession | null) {
  return (session?.title || session?.label || 'Training Session').trim();
}

function hasMovementHistory(lift: MovementLift) {
  return Boolean(
    lift.last_trained_date &&
    (lift.recent_session_id || lift.movement || lift.recent_session_title)
  );
}

function normalizedKind(session?: HubSession | null) {
  return (session?.kind || session?.status || '').toString().trim().toLowerCase();
}

function toneForSession(session?: HubSession | null) {
  const kind = normalizedKind(session);
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return colors.green;
  if (kind === 'today' || kind === 'in_progress') return colors.violet;
  if (kind === 'missed' || kind === 'past_due' || kind === 'incomplete') return colors.red;
  return colors.amber;
}

function labelForKind(session: HubSession) {
  const kind = normalizedKind(session);
  if (kind === 'in_progress') return 'In progress';
  if (kind === 'today') return 'Today';
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return 'Complete';
  if (kind === 'missed') return 'Missed';
  if (kind === 'incomplete') return 'Incomplete';
  if (kind === 'past_due') return 'Past due';
  return 'Up next';
}

function weekDayStatus(day: HubDay, session?: HubSession | null) {
  if (session) {
    const kind = normalizedKind(session);
    if (kind === 'completed' || kind === 'logged' || kind === 'done') {
      return { icon: 'checkmark' as const, color: colors.green, active: true };
    }
    if (kind === 'missed' || kind === 'past_due' || kind === 'incomplete') {
      return { icon: 'alert' as const, color: colors.red, active: true };
    }
    return { icon: 'barbell' as const, color: colors.amber, active: true };
  }
  if (day.is_today) return { icon: 'heart' as const, color: colors.violet, active: true };
  return { icon: 'checkmark' as const, color: colors.violet, active: true };
}

function weekDayShortLabel(day: HubDay, session?: HubSession | null) {
  if (!session) {
    if (day.is_today) return 'Recovery';
    return 'Rest';
  }
  const title = sessionTitle(session);
  const firstWord = title.split(/\s+/).filter(Boolean)[0] || title;
  return firstWord.length > 10 ? firstWord.slice(0, 10) : firstWord;
}

function blockTabLabel(block: ProgramBlockPayload, index: number) {
  const rawName = (block.name || '').trim();
  if (/^block\s+\d+$/i.test(rawName)) return rawName;
  return `Block ${Number(block.order_idx || index) + 1}`;
}

function programWeekCount(
  activeProgram: NonNullable<TrainingHubPayload['active_program']>,
  blocks: ProgramBlockPayload[]
) {
  const datedWeeks = inclusiveWeekCount(activeProgram.start_date, activeProgram.end_date);
  if (datedWeeks) return datedWeeks;
  const blockWeeks = blocks.reduce((sum, block) => sum + Number(block.total_weeks || 0), 0);
  return blockWeeks || null;
}

function buildRoadmapWeeks(
  block: ProgramBlockPayload | null,
  pendingMap: SessionMap,
  completedMap: SessionMap
) {
  if (!block) return [];
  const start = parseDate(block.start_date);
  const end = parseDate(block.end_date);
  const totalWeeks = Number(block.total_weeks || inclusiveWeekCount(block.start_date, block.end_date) || 4);
  const blockSessions = [
    ...(pendingMap[String(block.id)] || []),
    ...(completedMap[String(block.id)] || []),
  ];

  return Array.from({ length: Math.max(1, totalWeeks) }, (_, offset) => {
    const index = offset + 1;
    const weekStart = start ? addDays(start, offset * 7) : null;
    const weekEnd = weekStart ? addDays(weekStart, 6) : null;
    const boundedEnd = weekEnd && end && weekEnd > end ? end : weekEnd;
    const sessions = blockSessions.filter((session) => {
      const sessionDate = parseDate(session.date);
      if (!weekStart || !boundedEnd || !sessionDate) return index === 1 && offset === 0;
      return sessionDate >= weekStart && sessionDate <= boundedEnd;
    });
    const drafts = sessions.filter(isDraftSession).length;
    const assigned = Math.max(0, sessions.length - drafts);

    return {
      index,
      startDate: weekStart ? toDateKey(weekStart) : null,
      rangeLabel: formatRangeLabel(weekStart, boundedEnd),
      summary: weekSummary(assigned, drafts, sessions.length),
      days: buildWeekStripDays(weekStart, sessions),
    };
  });
}

function buildSessionPreview(index: number, session: HubSession) {
  const title = sessionTitle(session);
  const previewRows = (session.preview?.core || [])
    .map((row) => {
      const label = fullMovementName(row.movement);
      const details = [
        trainingReadableText(row.prescription),
        trainingReadableText(row.load),
      ].filter(Boolean).join('  ');
      return label ? { label, detail: details || 'No prescription' } : null;
    })
    .filter(Boolean) as Array<{ label: string; detail: string }>;
  return {
    code: title || `Week ${index} Session`,
    status: isDraftSession(session) ? 'Draft' : normalizedKind(session).includes('completed') ? 'Complete' : 'Assigned',
    sessionId: session.id,
    lines: previewRows,
    accessories: accessoryText(session.preview, session.focus),
  };
}

function trainingReadableText(value?: string | null) {
  return String(value || '')
    .trim()
    .replace(/\btop\s*\/\s*bk\b/gi, 'Top + backdown')
    .replace(/\btop\s*\+\s*bk\b/gi, 'Top + backdown')
    .replace(/\bbk\b/g, 'backdown')
    .replace(/\bBK\b/g, 'Backdown');
}

function splitPreviewDetail(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return { work: 'No prescription', load: '' };
  const parts = raw.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      work: parts[0],
      load: parts.slice(1).join(' '),
    };
  }
  return { work: raw, load: '' };
}

function fullMovementName(value?: string | null) {
  const raw = String(value || '').trim();
  const simplified = simplifyMobileMovementName(raw);
  if (simplified !== raw) return simplified;
  const friendlyCompetitionName = {
    'COMPETITION SQUAT': 'Squat',
    'COMPETITION BENCH': 'Bench',
    'COMPETITION DEADLIFT': 'Deadlift',
  }[raw.toUpperCase()];
  if (friendlyCompetitionName) return friendlyCompetitionName;
  const mapped = {
    SQ: 'Squat',
    BN: 'Bench',
    DL: 'Deadlift',
    OHP: 'Overhead Press',
  }[raw.toUpperCase()];
  return mapped || raw;
}

function accessoryText(preview?: SessionPreviewPayload | null, focus?: SessionFocus | null) {
  const count = Number(preview?.accessory_count ?? focus?.accessory_count ?? 0);
  if (count > 0) return `${count} accessories`;
  return 'No accessories';
}

function buildWeekStripDays(weekStart: Date | null, sessions: HubSession[]) {
  const labels = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
  return labels.map((label, index) => {
    const day = weekStart ? addDays(weekStart, index) : null;
    const key = day ? toDateKey(day) : `${label}-${index}`;
    const daySessions = day
      ? sessions.filter((session) => session.date === key)
      : [];
    return {
      key,
      date: day ? key : null,
      label,
      sessions: daySessions,
      count: daySessions.length,
    };
  });
}

function firstDayKeyForWeek(week: { days: Array<{ key: string; count: number }> }) {
  return week.days.find((day) => day.count > 0)?.key || week.days[0]?.key || '';
}

function weekSummary(assigned: number, drafts: number, total: number) {
  if (!total) return 'No sessions planned';
  const pieces = [
    assigned ? `${assigned} assigned${assigned === 1 ? '' : ' sessions'}` : null,
    drafts ? `${drafts} draft${drafts === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return pieces.join(' / ') || `${total} sessions`;
}

function isDraftSession(session: HubSession) {
  const kind = normalizedKind(session);
  return kind.includes('draft') || kind.includes('planned');
}

function inclusiveWeekCount(startValue?: string | null, endValue?: string | null) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end || end < start) return null;
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil((ms + 86400000) / (86400000 * 7)));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRangeLabel(start: Date | null, end: Date | null) {
  if (!start || !end) return 'Unscheduled';
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
}

function positionCue(
  block: NonNullable<TrainingHubPayload['current_block']> | null,
  weekCompleted: number,
  weekTotal: number
) {
  const phase = `${block?.phase || ''} ${block?.week_label || ''}`.toLowerCase();
  if (phase.includes('deload') || phase.includes('recovery')) return 'Recover and absorb the work.';
  if (weekTotal > 0 && weekCompleted >= weekTotal) return 'Week complete. Recover and reset.';

  const progress = Math.max(0, Math.min(1, Number(block?.progress?.percent || 0)));
  if (!block) return 'Start with the next assigned session.';
  if (progress < 0.25) return 'Establish consistency early.';
  if (progress >= 0.75) return 'Finish the block well.';
  if (weekTotal > 0 && weekCompleted / weekTotal >= 0.5) return 'Stay on pace.';
  return 'Continue building momentum.';
}

function actionForSession(session: HubSession) {
  const kind = normalizedKind(session);
  if (kind === 'in_progress') return 'Resume';
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return 'Review';
  if (kind === 'missed' || kind === 'incomplete' || kind === 'past_due') return 'Open';
  return 'Start';
}

function formatFlowDate(value?: string | null) {
  if (!value) return 'Undated';
  const date = parseDate(value);
  if (!date) return value;
  return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.getMonth() + 1}/${date.getDate()}`;
}

function formatShortDate(value?: string | null) {
  if (!value) return '';
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLongDate(value?: string | null) {
  if (!value) return '';
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatWeekday(value?: string | null) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, { weekday: 'short' }) : '';
}

function dateNumber(value?: string | null) {
  const date = parseDate(value);
  return date ? date.getDate() : '';
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingTop: 18,
    paddingBottom: 36,
    gap: 16,
  },
  header: {
    gap: 6,
    paddingTop: 4,
  },
  headerIdentity: {
    gap: 3,
  },
  title: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 32,
    lineHeight: 38,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  headerDate: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 17,
    lineHeight: 23,
    color: colors.muted,
  },
  programmingScroll: {
    paddingTop: 10,
    paddingBottom: 36,
    gap: 18,
  },
  programmingPageAtmosphere: {
    position: 'absolute',
    top: -330,
    left: -96,
    right: -96,
    height: 1066,
    overflow: 'hidden',
  },
  programmingPageAtmosphereImage: {
    flex: 1,
  },
  programmingPageAtmosphereBitmap: {
    opacity: 0.58,
    transform: [{ translateY: -34 }],
  },
  programmingPageAtmosphereDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 2, 6, 0.46)',
  },
  programmingPageAtmosphereTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(91, 33, 182, 0.08)',
  },
  programmingPageAtmosphereFade: {
    ...StyleSheet.absoluteFillObject,
  },
  programmingHeader: {
    paddingTop: 2,
  },
  programmingTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  programmingEmptyRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(24, 16, 15, 0.20)',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
  },
  programmingEmptyText: {
    flex: 1,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 20,
    lineHeight: 25,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  programmingAddButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    backgroundColor: 'rgba(167, 139, 250, 0.13)',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  programmingAddButtonPressed: {
    opacity: 0.78,
  },
  programmingAddButtonText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  programmingActiveCard: {
    gap: 13,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.20)',
    backgroundColor: 'rgba(167, 139, 250, 0.055)',
    padding: 14,
    borderRadius: 12,
  },
  programmingActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  programmingActiveIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.26)',
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderRadius: 11,
  },
  programmingActiveCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  programmingActiveLabel: {
    ...SLTypography.utilityLabel,
    color: colors.violet,
    textTransform: 'uppercase',
  },
  programmingActiveTitle: {
    ...SLTypography.bodyStrong,
    color: colors.textStrong,
  },
  programmingActiveMeta: {
    gap: 8,
    borderTopWidth: 1,
    borderColor: colors.lineSoft,
    paddingTop: 12,
  },
  programmingActiveMetaText: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  gettingStarted: {
    gap: 12,
  },
  gettingStartedTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  gettingStartedList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(24, 16, 15, 0.14)',
  },
  gettingStartedRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 10,
  },
  gettingStartedIndex: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    backgroundColor: colors.violetSoft,
  },
  gettingStartedIndexText: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textStrong,
  },
  gettingStartedText: {
    ...SLTypography.body,
    flex: 1,
    color: colors.muted,
  },
  roadmap: {
    position: 'relative',
    gap: 14,
  },
  programSummaryCard: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.20)',
    backgroundColor: 'rgba(30, 24, 38, 0.48)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingLeft: 16,
    paddingRight: 12,
    shadowColor: colors.violet,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  programSummaryIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    backgroundColor: 'rgba(167, 139, 250, 0.14)',
    borderRadius: 15,
  },
  programSummaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  programSummaryName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 25,
    lineHeight: 31,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  programSummaryMeta: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 17,
    lineHeight: 23,
    color: colors.muted,
  },
  programSummaryDot: {
    color: colors.violet,
  },
  programManageButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.20)',
    backgroundColor: 'rgba(10, 8, 12, 0.36)',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  programManageText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  blockTabs: {
    alignItems: 'flex-end',
    paddingTop: 1,
    paddingBottom: 4,
    paddingRight: 8,
  },
  blockTab: {
    minWidth: 118,
    minHeight: 50,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(18, 16, 22, 0.54)',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginRight: 8,
    transform: [{ skewX: '-10deg' }],
  },
  blockTabActive: {
    borderColor: 'rgba(167, 139, 250, 0.72)',
    backgroundColor: 'rgba(124, 58, 237, 0.74)',
    shadowColor: colors.violet,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  blockTabText: {
    ...SLTypography.label,
    color: colors.muted,
    textAlign: 'center',
  },
  blockTabTextActive: {
    color: colors.textStrong,
  },
  blockTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    transform: [{ skewX: '10deg' }],
  },
  blockTabMenuButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 10,
  },
  weekCardList: {
    gap: 10,
  },
  weekCard: {
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(20, 18, 22, 0.44)',
    borderRadius: 17,
    paddingVertical: 15,
    paddingHorizontal: 13,
    gap: 12,
  },
  weekCardExpanded: {
    backgroundColor: 'rgba(22, 18, 28, 0.68)',
    borderColor: 'rgba(167, 139, 250, 0.70)',
    shadowColor: colors.violet,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  weekCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekCardTitleLine: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weekCardIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.26)',
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
    borderRadius: 13,
  },
  weekCardTitleCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 11,
  },
  weekCardTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 27,
    lineHeight: 33,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  weekCardRange: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 17,
    lineHeight: 23,
    color: colors.muted,
  },
  weekActionsButton: {
    width: 42,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.18)',
    backgroundColor: 'rgba(10, 8, 12, 0.38)',
    borderRadius: 13,
  },
  weekActionsText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  weekStrip: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.14)',
    borderRadius: 15,
    overflow: 'hidden',
  },
  weekStripDay: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRightWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(8, 8, 12, 0.30)',
  },
  weekStripDaySelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.20)',
    borderColor: 'rgba(167, 139, 250, 0.38)',
  },
  weekStripLabel: {
    ...SLTypography.label,
    color: colors.muted,
  },
  weekStripDot: {
    minWidth: 8,
    height: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStripDotActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
    minWidth: 18,
    height: 18,
  },
  weekStripCount: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 10,
    lineHeight: 13,
    color: '#120D16',
  },
  daySessionList: {
    gap: 12,
  },
  sessionPreview: {
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(12, 12, 18, 0.36)',
    borderRadius: 16,
    padding: 14,
  },
  sessionPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  sessionPreviewTitleLine: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 180,
    minWidth: 180,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  sessionPreviewCode: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 23,
    lineHeight: 29,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  sessionStatusPill: {
    ...SLTypography.label,
    color: colors.textStrong,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.30)',
    backgroundColor: colors.violetSoft,
    paddingVertical: 4,
    paddingHorizontal: 9,
    overflow: 'hidden',
    borderRadius: 999,
  },
  sessionViewButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.20)',
    backgroundColor: 'rgba(18, 16, 22, 0.50)',
    borderRadius: 13,
    paddingHorizontal: 15,
  },
  sessionViewButtonDisabled: {
    opacity: 0.52,
  },
  sessionViewText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  sessionPreviewLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 9,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.07)',
  },
  sessionPreviewLift: {
    minWidth: 112,
    flexShrink: 0,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.text,
    letterSpacing: 0,
  },
  sessionPreviewWork: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 16,
    lineHeight: 21,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 130,
    minWidth: 130,
    color: colors.muted,
  },
  sessionPreviewLoad: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 16,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'right',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 110,
    minWidth: 110,
  },
  sessionAccessoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  sessionAccessoryText: {
    ...SLTypography.bodyStrong,
    color: colors.muted,
    paddingLeft: 0,
    paddingTop: 0,
  },
  weekCollapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekCollapsedSummary: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 17,
    lineHeight: 23,
    color: colors.muted,
    letterSpacing: 0,
  },
  weekEmptyBlock: {
    gap: 6,
    paddingVertical: 18,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(24, 16, 15, 0.13)',
  },
  weekEmptyTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  weekEmptyText: {
    ...SLTypography.body,
    color: colors.muted,
  },
  dayEmptyState: {
    gap: 8,
    paddingTop: 2,
  },
  dayEmptyTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  addSessionButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    backgroundColor: colors.violetSoft,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  addSessionButtonText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  blockZone: {
    position: 'relative',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.20)',
    backgroundColor: 'rgba(9, 14, 28, 0.68)',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.violet,
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  blockRail: {
    width: 4,
    backgroundColor: colors.violet,
    opacity: 0.95,
  },
  blockMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 20,
    paddingLeft: 16,
    paddingRight: 16,
  },
  blockCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  zoneKicker: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.violet,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  blockName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  blockMetaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  blockMeta: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.muted,
  },
  blockDot: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.violet,
  },
  blockWeekText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.violet,
  },
  blockDateRange: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 16,
    lineHeight: 21,
    color: colors.muted,
  },
  blockStepLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  blockStepDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
  blockStepDotDone: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  blockStepDotCurrent: {
    width: 22,
    height: 22,
    borderColor: colors.violet,
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
  },
  blockStepConnector: {
    width: 34,
    height: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
  blockStepConnectorActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.70)',
  },
  blockProgressRing: {
    width: 108,
    height: 108,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 7,
    borderColor: 'rgba(167, 139, 250, 0.78)',
    backgroundColor: 'rgba(2, 6, 23, 0.44)',
  },
  blockProgressPercent: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 30,
    lineHeight: 35,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  blockProgressLabel: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  progressLine: {
    height: 2,
    backgroundColor: colors.lineSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.violet,
  },
  statusStrip: {
    gap: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 10,
  },
  rhythmText: {
    ...SLTypography.body,
    color: colors.text,
  },
  progressText: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  blockActionRow: {
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  blockAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.38)',
    backgroundColor: 'rgba(124, 58, 237, 0.10)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  blockActionText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  positionZone: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.20)',
    backgroundColor: 'rgba(9, 14, 28, 0.62)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  positionRail: {
    width: 4,
    backgroundColor: colors.green,
    opacity: 0.95,
  },
  positionMain: {
    flex: 1,
    paddingVertical: 18,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 14,
  },
  positionPrimary: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 18,
    lineHeight: 23,
    color: colors.textStrong,
  },
  positionGrid: {
    gap: 12,
  },
  positionTodayBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  positionTargetIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  positionTodayCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  // Critical training text must remain readable. Reflow/stack instead of
  // preserving cramped columns that split words into fragments.
  positionSecondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  positionWeekBlock: {
    flexGrow: 1,
    flexBasis: 148,
    minWidth: 148,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    borderRadius: 12,
    backgroundColor: 'rgba(8, 8, 12, 0.22)',
    padding: 10,
  },
  positionNextBlock: {
    flexGrow: 1,
    flexBasis: 148,
    minWidth: 148,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    borderRadius: 12,
    backgroundColor: 'rgba(8, 8, 12, 0.22)',
    padding: 10,
  },
  positionMetaLabel: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  positionMetaValue: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  positionWeekValue: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.green,
  },
  positionPrimarySmall: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.textStrong,
  },
  positionDotLine: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 2,
  },
  positionWeekDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
  },
  positionWeekDotDone: {
    backgroundColor: colors.green,
  },
  positionCue: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  positionActionRow: {
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  positionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  accessZone: {
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(9, 14, 28, 0.52)',
    borderRadius: 14,
    padding: 12,
  },
  accessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accessRow: {
    width: '48.5%',
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  accessRowDisabled: {
    opacity: 0.58,
  },
  accessIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
  },
  accessCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  accessLabel: {
    ...SLTypography.bodyStrong,
    color: colors.textStrong,
  },
  accessValue: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  accessTextDisabled: {
    color: colors.subtle,
  },
  flowZone: {
    gap: 14,
  },
  zoneHeader: {
    gap: 4,
  },
  zoneTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  flowList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  flowRow: {
    flexDirection: 'row',
    minHeight: 108,
  },
  flowRowDivider: {
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  timeline: {
    width: 26,
    alignItems: 'center',
    paddingTop: 19,
  },
  timelineNode: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    marginTop: 4,
    backgroundColor: colors.lineSoft,
  },
  flowBody: {
    flex: 1,
    paddingVertical: 15,
    paddingLeft: 8,
    gap: 7,
  },
  flowBodyDisabled: {
    opacity: 0.66,
  },
  flowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flowDate: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  flowKind: {
    ...SLTypography.label,
  },
  flowTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  flowFocus: {
    ...SLTypography.body,
    color: colors.muted,
  },
  flowRecap: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  flowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 2,
  },
  contextButton: {
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.36)',
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  contextButtonText: {
    ...SLTypography.label,
    color: '#FECACA',
  },
  launchStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.violet,
    backgroundColor: 'rgba(24, 16, 15, 0.36)',
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  launchStripText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  weekZone: {
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.26)',
    backgroundColor: 'rgba(9, 14, 28, 0.58)',
    borderRadius: 14,
    padding: 12,
  },
  weekTileRow: {
    flexDirection: 'row',
    gap: 7,
    paddingRight: 8,
  },
  weekDayTile: {
    width: 82,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  weekDayToday: {
    borderColor: 'rgba(167, 139, 250, 0.82)',
    backgroundColor: 'rgba(167, 139, 250, 0.14)',
    shadowColor: colors.violet,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  weekDayTraining: {
    borderColor: 'rgba(214, 167, 94, 0.20)',
  },
  weekLabel: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.muted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  weekLabelToday: {
    color: colors.textStrong,
  },
  weekNumber: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.textStrong,
    textAlign: 'center',
  },
  weekStatusIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  weekStatus: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  weekKind: {
    ...SLTypography.caption,
  },
  fullScheduleButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderRadius: 12,
  },
  fullScheduleText: {
    ...SLTypography.label,
    color: colors.violet,
  },
  quietLine: {
    ...SLTypography.body,
    color: colors.subtle,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 14,
  },
  stateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 16,
  },
  stateCopy: {
    flex: 1,
    gap: 2,
  },
  stateTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  stateBody: {
    ...SLTypography.body,
    color: colors.muted,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  modalSheet: {
    backgroundColor: 'rgba(24, 16, 15, 0.96)',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 10,
    paddingBottom: 24,
    paddingLeft: 18,
    paddingRight: 18,
    gap: 14,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 999,
    marginBottom: 4,
  },
  modalKicker: {
    ...SLTypography.label,
    color: colors.violet,
    textTransform: 'uppercase',
  },
  modalTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  modalBody: {
    ...SLTypography.body,
    color: colors.muted,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonOption: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  reasonOptionSelected: {
    borderColor: 'rgba(167, 139, 250, 0.44)',
    backgroundColor: colors.violetSoft,
  },
  reasonText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  reasonTextSelected: {
    color: colors.textStrong,
  },
  commentInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(24, 16, 15, 0.34)',
    color: colors.textStrong,
    textAlignVertical: 'top',
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontFamily: SLFontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryAction: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  secondaryActionText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  primaryAction: {
    minWidth: 84,
    alignItems: 'center',
    borderLeftWidth: 2,
    borderLeftColor: colors.violet,
    backgroundColor: colors.surfaceStrong,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  actionSheetScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  weekActionSheet: {
    backgroundColor: 'rgba(18, 14, 22, 0.98)',
    borderTopWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.18)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 16,
    shadowColor: colors.violet,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
  },
  weekActionModal: {
    maxHeight: '88%',
    backgroundColor: 'rgba(18, 14, 22, 0.98)',
    borderTopWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.18)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 16,
  },
  weekActionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  weekActionEyebrow: {
    ...SLTypography.label,
    color: colors.violet,
    textTransform: 'uppercase',
  },
  weekActionTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  weekActionSubtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: SLFontFamilies.sansMedium,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.14)',
    backgroundColor: 'rgba(10, 8, 12, 0.34)',
    borderRadius: 12,
  },
  actionGroupList: {
    gap: 13,
  },
  actionGroup: {
    gap: 7,
  },
  actionGroupTitle: {
    color: colors.violet,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0,
    fontFamily: SLFontFamilies.sansBold,
  },
  weekActionRows: {
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 8, 12, 0.28)',
  },
  weekActionRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.08)',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  weekActionRowText: {
    ...SLTypography.body,
    color: colors.textStrong,
    fontFamily: SLFontFamilies.sansBold,
  },
  weekActionRowDanger: {
    color: '#F0A4A4',
  },
  weekActionCopy: {
    ...SLTypography.body,
    color: colors.muted,
  },
  weekChoiceList: {
    gap: 8,
  },
  weekActionField: {
    gap: 8,
  },
  weekActionFieldLabel: {
    ...SLTypography.label,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  weekActionInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(5, 5, 5, 0.22)',
    color: colors.textStrong,
    paddingHorizontal: 12,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 16,
  },
  weekChoiceRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(8, 8, 8, 0.14)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  weekChoiceRowSelected: {
    borderColor: 'rgba(167, 139, 250, 0.46)',
    backgroundColor: colors.violetSoft,
  },
  weekChoiceTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  weekChoiceTitleSelected: {
    color: '#C4B5FD',
  },
  weekChoiceMeta: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  weekActionEmpty: {
    ...SLTypography.body,
    color: colors.subtle,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 12,
  },
  weekActionPreview: {
    borderLeftWidth: 2,
    borderLeftColor: colors.violet,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  weekActionPreviewText: {
    ...SLTypography.body,
    color: colors.muted,
  },
  weekActionWarning: {
    ...SLTypography.body,
    color: '#F0A4A4',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.30)',
    backgroundColor: 'rgba(127, 29, 29, 0.16)',
    padding: 10,
  },
  weekActionFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  weekActionSecondary: {
    minHeight: 46,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
  },
  weekActionSecondaryText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  weekActionPrimary: {
    minHeight: 46,
    justifyContent: 'center',
    borderLeftWidth: 2,
    borderLeftColor: colors.violet,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 18,
  },
  weekActionPrimaryText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  weekActionDisabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.72,
  },
});
