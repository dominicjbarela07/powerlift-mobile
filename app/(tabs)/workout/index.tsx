import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';

import { SLMotionEntrance, SLProfileAvatar } from '@/components/ui';
import { SLButton } from '@/components/ui/sl-button';
import {
  AthleteTrainingHubExperience,
  type AthleteTrainingBlock,
  type AthleteTrainingDay,
  type AthleteTrainingHubData,
  type AthleteTrainingWeek,
} from '@/components/training-hub/AthleteTrainingHubExperience';
import { TrainingHubMaterialSurface } from '@/components/training-hub/training-hub-material-surface';
import { useAuth } from '@/context/AuthContext';
import {
  archiveProgrammingProgram,
  deleteProgrammingProgram,
  fetchJson,
  listProgrammingPrograms,
  type ProgrammingProgramSummary,
} from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';
import { compactProgrammingWeekdayLabel } from '@/lib/programming-weekday-label';
import { formatSessionContentSnapshot } from '@/lib/session-content-snapshot';
import {
  trainingHubSessionDayLabel,
  trainingHubSessionStatusLabel,
} from '@/lib/training-hub-session-labels';
import { resolveTrainingProgramProgress } from '@/lib/training-program-progress';
import {
  movementCardStateAccent,
  type MovementCardMaterialState,
} from '@/lib/movement-card-material';
import { SLColors, SLFontFamilies, SLRadius, SLShadows, SLTypography } from '@/constants/theme';

const SESSION_SWIPE_ACTIONS_WIDTH = 164;

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
  estimated_duration_minutes?: number | null;
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

type SessionTemplateOption = {
  id: number | string;
  name: string;
  core_count?: number | null;
  accessory_count?: number | null;
  unsupported_reason?: string | null;
};

type AdoptableSessionOption = {
  id: number;
  name: string;
  date?: string | null;
  status?: string | null;
};

type SessionAddState = {
  date: string;
  mode: 'choose' | 'templates' | 'adopt';
} | null;

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
    avatar_url?: string | null;
  } | null;
  today?: string | null;
  connected_coach?: {
    id?: number | null;
    name?: string | null;
    avatar_url?: string | null;
    avatar_uploaded_at?: string | null;
  } | null;
  active_program?: {
    id?: number | null;
    name?: string | null;
    program_type?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    meet_date?: string | null;
    description?: string | null;
    coach?: { id?: number | null; name?: string | null } | null;
    block_count?: number | null;
    total_weeks?: number | null;
    current_week?: number | null;
    progress?: number | null;
    status?: 'draft' | 'active' | 'archived' | string | null;
    updated_at?: string | null;
  } | null;
  program_history?: Array<{
    id: number;
    name?: string | null;
    duration_weeks?: number | null;
    completed_at?: string | null;
  }> | null;
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
  coach_updates?: {
    id: number;
    summary?: string | null;
    occurred_at?: string | null;
  }[] | null;
  previous_week_recap?: {
    sessions?: {
      assigned?: number | null;
      completed?: number | null;
    } | null;
    sets?: {
      planned?: number | null;
      completed?: number | null;
    } | null;
    videos_reviewed?: number | null;
  } | null;
};

type ProgramBlockPayload = {
  id: number;
  training_program_id?: number | null;
  name?: string | null;
  order_idx?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  current_week?: number | null;
  total_weeks?: number | null;
  date_range_label?: string | null;
  week_label?: string | null;
  week_tags?: Array<{
    week: number;
    key: string;
    label: string;
  }> | null;
  week_objectives?: {
    week: number;
    text: string;
    updated_at?: string | null;
    updated_by_user_id?: number | null;
  }[] | null;
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
  tag?: {
    key: string;
    label: string;
  } | null;
  objective?: {
    text: string;
    updatedAt?: string | null;
  } | null;
  days: Array<{
    key: string;
    date: string | null;
    label: string;
    sessions: HubSession[];
    count: number;
  }>;
};

type WeekActionKey =
  | 'edit-objective'
  | 'set-tag'
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

type WeekActionMenuContext = {
  week: RoadmapWeek;
  anchorY: number;
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

type BlockActionMenuContext = {
  block: ProgramBlockPayload;
  anchorY: number;
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
  text: SLColors.text,
  textStrong: SLColors.textStrong,
  muted: SLColors.textMuted,
  subtle: SLColors.textSubtle,
  line: SLColors.borderSubtle,
  lineSoft: SLColors.borderHairline,
  surface: SLColors.surfaceEmbedded,
  surfaceStrong: SLColors.focus,
  violet: SLColors.accentViolet,
  violetSoft: SLColors.accentVioletSoft,
  green: SLColors.success,
  amber: SLColors.warning,
  red: SLColors.railDanger,
};

const GETTING_STARTED_STEPS = [
  {
    index: 1,
    title: 'Create a training program',
    body: 'Build your program structure',
    icon: 'clipboard-outline',
    tone: SLColors.info,
  },
  {
    index: 2,
    title: 'Add your first block',
    body: 'Organize your training phases',
    icon: 'layers-outline',
    tone: SLColors.accentCyanMuted,
  },
  {
    index: 3,
    title: 'Build your first session',
    body: 'Add movements and prescriptions',
    icon: 'calendar-clear-outline',
    tone: SLColors.accentViolet,
  },
  {
    index: 4,
    title: 'Schedule training',
    body: 'Plan your program calendar',
    icon: 'time-outline',
    tone: SLColors.warning,
  },
] as const;

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


const weekActionRows: Array<{ key: WeekActionKey; label: string }> = [
  { key: 'edit-objective', label: 'Edit Week Objective...' },
  { key: 'set-tag', label: 'Set Week Focus...' },
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
  { title: 'Week Context', keys: ['edit-objective', 'set-tag'] },
  { title: 'Templates', keys: ['apply-template', 'save-template'] },
  { title: 'Copying', keys: ['copy-to', 'copy-from'] },
  { title: 'Scheduling', keys: ['assign-drafts', 'revert-assigned', 'shift'] },
  { title: 'Danger Zone', keys: ['clear'] },
];

const trainingWeekTags = [
  { key: '', label: 'Standard Week' },
  { key: 'volume', label: 'Volume' },
  { key: 'intensity', label: 'Intensity' },
  { key: 'deload', label: 'Deload' },
  { key: 'peak', label: 'Peak' },
  { key: 'taper', label: 'Taper' },
  { key: 'test', label: 'Test' },
  { key: 'recovery', label: 'Recovery' },
] as const;

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
  const trainingScopeKey = rosterAthleteId ? `athlete:${rosterAthleteId}` : 'self';
  const programCreatedNonce = params.programCreated ? String(params.programCreated) : null;
  const returnBlockId = params.programmingBlockId ? Number(params.programmingBlockId) : null;
  const returnWeek = params.programmingWeek ? Number(params.programmingWeek) : null;
  const returnDay = params.programmingDay ? String(params.programmingDay) : null;
  const isIndividual = user?.workspace_mode === 'individual' || !!user?.is_individual_workspace || !!user?.is_self_coached;
  const isProgrammingManager = isIndividual || !!rosterAthleteId;

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
  const [loadedTrainingScopeKey, setLoadedTrainingScopeKey] = useState<string | null>(null);
  const hasLoadedTrainingRef = useRef(false);
  const trainingRequestSequenceRef = useRef(0);

  const loadTraining = useCallback(async (opts?: { silent?: boolean; showRefreshIndicator?: boolean }) => {
    const requestSequence = ++trainingRequestSequenceRef.current;
    const requestScopeKey = trainingScopeKey;
    const silent = !!opts?.silent;
    if (silent) {
      if (opts?.showRefreshIndicator !== false) setRefreshing(true);
    } else setLoading(true);
    setError(null);

    const endpoint = rosterAthleteId
      ? `/workouts/my_list/mobile/${rosterAthleteId}`
      : '/workouts/my_list/mobile';

    try {
      const resp = await fetchJson(endpoint, { method: 'GET' });
      const res: any = resp.json;
      if (
        requestSequence !== trainingRequestSequenceRef.current
        || requestScopeKey !== trainingScopeKey
      ) return;
      if (!resp.ok || !res?.ok) {
        setError(res?.error || res?.message || `HTTP ${resp.status}`);
        setHub(null);
        setProgramBlocks([]);
        setPendingMap({});
        setCompletedMap({});
        setLoadedTrainingScopeKey(requestScopeKey);
        return;
      }
      setHub(res.training_hub || null);
      setProgramBlocks(res.blocks || []);
      setPendingMap(res.pending_map || {});
      setCompletedMap(res.completed_map || {});
      setLoadedTrainingScopeKey(requestScopeKey);
    } catch (err: any) {
      if (
        requestSequence !== trainingRequestSequenceRef.current
        || requestScopeKey !== trainingScopeKey
      ) return;
      setError(err?.message || 'Training Hub could not load.');
      setHub(null);
      setProgramBlocks([]);
      setPendingMap({});
      setCompletedMap({});
      setLoadedTrainingScopeKey(requestScopeKey);
    } finally {
      if (
        requestSequence !== trainingRequestSequenceRef.current
        || requestScopeKey !== trainingScopeKey
      ) return;
      if (silent && opts?.showRefreshIndicator !== false) setRefreshing(false);
      else setLoading(false);
    }
  }, [programCreatedNonce, rosterAthleteId, trainingScopeKey]);

  useEffect(() => {
    trainingRequestSequenceRef.current += 1;
    hasLoadedTrainingRef.current = false;
    setLoadedTrainingScopeKey(null);
    setError(null);
    setRefreshing(false);
    setLoading(true);
  }, [trainingScopeKey]);

  useFocusEffect(
    useCallback(() => {
      const silent = hasLoadedTrainingRef.current;
      hasLoadedTrainingRef.current = true;
      loadTraining({ silent, showRefreshIndicator: false });
    }, [loadTraining])
  );

  const trainingScopeReady = loadedTrainingScopeKey === trainingScopeKey;
  const visibleHub = trainingScopeReady ? hub : null;
  const visibleProgramBlocks = trainingScopeReady ? programBlocks : [];
  const visiblePendingMap = trainingScopeReady ? pendingMap : {};
  const visibleCompletedMap = trainingScopeReady ? completedMap : {};
  const weekDays = useMemo(() => visibleHub?.week?.days || [], [visibleHub?.week?.days]);
  const athleteHubData = useMemo(
    () => buildAthleteTrainingHubData(
      visibleHub,
      visibleProgramBlocks,
      visiblePendingMap,
      visibleCompletedMap,
    ),
    [visibleCompletedMap, visibleHub, visiblePendingMap, visibleProgramBlocks]
  );

  const openWorkout = (workoutId?: number | null) => {
    if (!workoutId) return;
    router.push({
      pathname: '/workout/[workoutId]',
      params: {
        workoutId: String(workoutId),
        ...(rosterAthleteId ? {
          athleteView: 'coach-preview',
          coachAthleteId: rosterAthleteId,
        } : {}),
      },
    });
  };

  const openSessionWorkspace = (workoutId?: number | null, context?: ProgrammingReturnContext) => {
    if (!workoutId) return;
    router.push({
      pathname: '/workout/session-workspace/[workoutId]' as any,
      params: {
        workoutId: String(workoutId),
        ...(rosterAthleteId ? { athleteId: rosterAthleteId } : {}),
        ...(context?.blockId ? { programmingBlockId: String(context.blockId) } : {}),
        ...(context?.week ? { programmingWeek: String(context.week) } : {}),
        ...(context?.day ? { programmingDay: String(context.day) } : {}),
      },
    });
  };

  const openBlockDetails = () => {
    router.push('/(tabs)/workout/block-details' as any);
  };

  const openSessionHistory = () => {
    router.push({
      pathname: '/(tabs)/workout/session-history',
      params: rosterAthleteId ? { athleteId: rosterAthleteId } : {},
    } as any);
  };

  const addSessionForDate = (date?: string | null) => {
    router.push({
      pathname: '/(tabs)/create-workout',
      params: {
        ...(date ? { date } : {}),
        ...(rosterAthleteId ? { athleteId: rosterAthleteId } : {}),
        ...(hub?.athlete?.name ? { athleteName: hub.athlete.name } : {}),
      },
    } as any);
  };

  const openMessages = () => {
    router.push('/(tabs)/messages' as any);
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

  if (isProgrammingManager) {
    return (
      <IndividualProgrammingHome
        hub={visibleHub}
        loading={loading || !trainingScopeReady}
        error={error}
        refreshing={refreshing}
        onRefresh={() => loadTraining({ silent: true })}
        blocks={visibleProgramBlocks}
        pendingMap={visiblePendingMap}
        completedMap={visibleCompletedMap}
        onOpenSession={openSessionWorkspace}
        onViewSession={openWorkout}
        onAddSession={addSessionForDate}
        initialBlockId={Number.isFinite(returnBlockId || NaN) ? returnBlockId : null}
        initialWeek={Number.isFinite(returnWeek || NaN) ? returnWeek : null}
        initialDay={returnDay}
        managedAthleteId={rosterAthleteId ? Number(rosterAthleteId) : visibleHub?.athlete?.id || null}
        managedAthleteName={visibleHub?.athlete?.name || null}
        managedAthleteAvatarUrl={visibleHub?.athlete?.avatar_url || null}
        coachMode={Boolean(rosterAthleteId)}
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
        {loading || !trainingScopeReady ? (
          <StateLine icon="barbell-outline" title="Loading Training Hub" body="Finding your current rhythm." />
        ) : error ? (
          <StateLine icon="alert-circle-outline" title="Training Hub unavailable" body={error} />
        ) : (
          <SLMotionEntrance motionKey={`training-${visibleHub?.active_program?.id || 'none'}-${weekDays.length}`} distance={6}>
            <AthleteTrainingHubExperience
              data={athleteHubData}
              onAction={(action) => {
                if (action.type === 'session') openWorkout(action.id);
                if (action.type === 'block') openBlockDetails();
                if (action.type === 'program-history') openSessionHistory();
                if (action.type === 'message-coach') openMessages();
              }}
            />
          </SLMotionEntrance>
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
  onViewSession,
  onAddSession,
  initialBlockId,
  initialWeek,
  initialDay,
  managedAthleteId,
  managedAthleteName,
  managedAthleteAvatarUrl,
  coachMode,
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
  onViewSession: (id?: number | null) => void;
  onAddSession: (date?: string | null) => void;
  initialBlockId?: number | null;
  initialWeek?: number | null;
  initialDay?: string | null;
  managedAthleteId?: number | null;
  managedAthleteName?: string | null;
  managedAthleteAvatarUrl?: string | null;
  coachMode: boolean;
}) {
  const router = useRouter();
  const activeProgram = hub?.active_program || null;
  const currentBlock = hub?.current_block || null;
  const [programLibraryOpen, setProgramLibraryOpen] = useState(false);

  const handleProgramPress = () => {
    router.push({
      pathname: '/(tabs)/workout/create-program',
      params: {
        ...(managedAthleteId ? { athleteId: String(managedAthleteId) } : {}),
        ...(managedAthleteName ? { athleteName: managedAthleteName } : {}),
      },
    } as any);
  };

  const handleExitToAthleteWorkspace = () => {
    if (!coachMode || !managedAthleteId) return;
    router.replace({
      pathname: '/(tabs)/coach-athlete/[athleteId]',
      params: {
        athleteId: String(managedAthleteId),
        ...(managedAthleteName ? { athleteName: managedAthleteName } : {}),
      },
    } as any);
  };

  return (
    <View style={styles.screen}>
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
          <SLMotionEntrance motionKey={`programming-${activeProgram.id || 'active'}-${blocks.length}`} distance={6}>
          <ActiveProgrammingRoadmap
            activeProgram={activeProgram}
            currentBlock={currentBlock}
            blocks={blocks}
            pendingMap={pendingMap}
            completedMap={completedMap}
            onOpenSession={onOpenSession}
            onViewSession={onViewSession}
            onAddSession={onAddSession}
            onManageProgram={(programId) => router.push({
              pathname: '/(tabs)/workout/create-program',
              params: {
                mode: 'edit',
                programId: String(programId),
                ...(managedAthleteId ? { athleteId: String(managedAthleteId) } : {}),
                ...(managedAthleteName ? { athleteName: managedAthleteName } : {}),
              },
            } as any)}
            onCreateProgram={handleProgramPress}
            onRefresh={onRefresh}
            athleteId={managedAthleteId || hub?.athlete?.id || null}
            initialBlockId={initialBlockId}
            initialWeek={initialWeek}
            initialDay={initialDay}
            managedAthleteName={managedAthleteName}
            managedAthleteAvatarUrl={managedAthleteAvatarUrl}
            coachMode={coachMode}
            onExitAthleteWorkspace={coachMode && managedAthleteId ? handleExitToAthleteWorkspace : undefined}
          />
          </SLMotionEntrance>
        ) : (
          <ProgrammingEmptyState
            onCreateProgram={handleProgramPress}
            onOpenPrograms={() => setProgramLibraryOpen(true)}
          />
        )}
      </ScrollView>
      <ProgramActionsModal
        visible={programLibraryOpen}
        athleteId={managedAthleteId || hub?.athlete?.id || null}
        activeProgram={activeProgram}
        onClose={() => setProgramLibraryOpen(false)}
        onCreate={() => {
          setProgramLibraryOpen(false);
          handleProgramPress();
        }}
        onEdit={(programId) => {
          setProgramLibraryOpen(false);
          router.push({
            pathname: '/(tabs)/workout/create-program',
            params: {
              mode: 'edit',
              programId: String(programId),
              ...(managedAthleteId ? { athleteId: String(managedAthleteId) } : {}),
              ...(managedAthleteName ? { athleteName: managedAthleteName } : {}),
            },
          } as any);
        }}
        onRefresh={onRefresh}
      />
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
  onViewSession,
  onAddSession,
  onManageProgram,
  onCreateProgram,
  onRefresh,
  athleteId,
  initialBlockId,
  initialWeek,
  initialDay,
  managedAthleteName,
  managedAthleteAvatarUrl,
  coachMode,
  onExitAthleteWorkspace,
}: {
  activeProgram: NonNullable<TrainingHubPayload['active_program']>;
  currentBlock: TrainingHubPayload['current_block'] | null;
  blocks: ProgramBlockPayload[];
  pendingMap: SessionMap;
  completedMap: SessionMap;
  onOpenSession: (id?: number | null, context?: ProgrammingReturnContext) => void;
  onViewSession: (id?: number | null) => void;
  onAddSession: (date?: string | null) => void;
  onManageProgram: (programId: number) => void;
  onCreateProgram: () => void;
  onRefresh: () => void | Promise<void>;
  athleteId?: number | null;
  initialBlockId?: number | null;
  initialWeek?: number | null;
  initialDay?: string | null;
  managedAthleteName?: string | null;
  managedAthleteAvatarUrl?: string | null;
  coachMode: boolean;
  onExitAthleteWorkspace?: () => void;
}) {
  const orderedBlocks = useMemo(() => {
    return [...blocks].sort((a, b) => Number(a.order_idx || 0) - Number(b.order_idx || 0));
  }, [blocks]);
  const currentBlockId = currentBlock?.id || orderedBlocks[0]?.id || null;
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(initialBlockId || currentBlockId);
  const [expandedWeek, setExpandedWeek] = useState(Math.max(1, Number(initialWeek || 1)));
  const [selectedDayKeys, setSelectedDayKeys] = useState<Record<string, string>>({});
  const [weekMenu, setWeekMenu] = useState<WeekActionMenuContext | null>(null);
  const [weekAction, setWeekAction] = useState<WeekActionState | null>(null);
  const [weekActionBusy, setWeekActionBusy] = useState(false);
  const [weekActionWarning, setWeekActionWarning] = useState('');
  const [weekActionConfirmed, setWeekActionConfirmed] = useState(false);
  const [blockMenu, setBlockMenu] = useState<BlockActionMenuContext | null>(null);
  const [blockAction, setBlockAction] = useState<BlockActionState | null>(null);
  const [blockActionBusy, setBlockActionBusy] = useState(false);
  const [blockActionWarning, setBlockActionWarning] = useState('');
  const [blockActionConfirmed, setBlockActionConfirmed] = useState(false);
  const [programActionsOpen, setProgramActionsOpen] = useState(false);
  const [sessionAdd, setSessionAdd] = useState<SessionAddState>(null);

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
  const currentBlockIndex = Math.max(0, orderedBlocks.findIndex((block) => block.id === currentBlockId));
  const selectedBlockIndex = Math.max(0, orderedBlocks.findIndex((block) => block.id === selectedBlock?.id));
  const selectedBlockState: MovementCardMaterialState = selectedBlock?.id === currentBlockId
    ? 'in_progress'
    : selectedBlockIndex < currentBlockIndex
      ? 'complete'
      : 'not_started';
  const currentWeek = Math.max(1, Number(selectedBlock?.current_week || 1));
  const programProgress = activeProgram.progress ?? resolveTrainingProgramProgress({
    startDate: activeProgram.start_date,
    endDate: activeProgram.end_date,
  });
  const programHorizon = formatRangeLabel(
    parseDate(activeProgram.start_date),
    parseDate(activeProgram.end_date)
  );
  const programStatus = programmingStatusLabel(activeProgram.status);

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
      <TrainingHubMaterialSurface
        accentColor={colors.violet}
        expanded
        state="in_progress"
        style={styles.programIdentitySurface}
      >
        {coachMode ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${managedAthleteName || 'athlete'} workspace`}
              disabled={!onExitAthleteWorkspace}
              onPress={onExitAthleteWorkspace}
              style={({ pressed }) => [
                styles.programCoachIdentity,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.programCoachIdentityCopy}>
                <Text style={styles.programCoachIdentityLabel}>PROGRAMMING FOR</Text>
                <Text style={styles.programCoachIdentityName}>
                  {managedAthleteName || 'Athlete'}
                </Text>
                <View style={styles.programCoachIdentityWorkspaceCue}>
                  <Text style={styles.programCoachIdentityWorkspaceCueText}>Athlete Workspace</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.subtle} />
                </View>
              </View>
              <SLProfileAvatar
                name={managedAthleteName}
                profilePhotoUrl={managedAthleteAvatarUrl}
                size={64}
                statusColor={colors.violet}
                style={styles.programIdentityAvatar}
              />
            </Pressable>
            <View style={styles.programCoachDetails}>
              <View style={styles.programIdentityCopy}>
                <Text style={styles.programCoachDetailsLabel}>TRAINING PROGRAM</Text>
                <Text style={styles.programCoachProgramName}>
                  {activeProgram.name || 'Training Program'}
                </Text>
                <Text style={styles.programIdentityMeta}>
                  {orderedBlocks.length || 0} {orderedBlocks.length === 1 ? 'block' : 'blocks'}
                  {' · '}
                  {programWeeks || 0} {programWeeks === 1 ? 'week' : 'weeks'}
                  {programHorizon ? ` · ${programHorizon}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Training Program actions"
                hitSlop={8}
              onPress={() => setProgramActionsOpen(true)}
              style={({ pressed }) => [styles.programActionsButton, pressed && styles.pressed]}
            >
                <Text style={styles.programActionsButtonText}>Actions</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.subtle} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.programIdentityTop}>
            <View style={styles.programIdentityIcon}>
              <Ionicons name="construct-outline" size={24} color={colors.violet} />
            </View>
            <View style={styles.programIdentityCopy}>
              <Text style={styles.programIdentityEyebrow}>YOUR PROGRAMMING</Text>
              <Text style={styles.programIdentityName}>{activeProgram.name || 'Training Program'}</Text>
              <Text style={styles.programIdentityMeta}>
                {orderedBlocks.length || 0} {orderedBlocks.length === 1 ? 'block' : 'blocks'}
                {' · '}
                {programWeeks || 0} {programWeeks === 1 ? 'week' : 'weeks'}
                {programHorizon ? ` · ${programHorizon}` : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Training Program actions"
              hitSlop={8}
              onPress={() => setProgramActionsOpen(true)}
              style={({ pressed }) => [styles.programActionsButton, pressed && styles.pressed]}
            >
              <Text style={styles.programActionsButtonText}>Actions</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.subtle} />
            </Pressable>
          </View>
        )}
        <View style={styles.programIdentityProgressHeader}>
          <Text style={styles.programIdentityStatus}>{programStatus}</Text>
          <Text style={styles.programIdentityProgress}>{Math.round(Number(programProgress || 0))}%</Text>
        </View>
        <View style={styles.programProgressTrack}>
          <View
            style={[
              styles.programProgressFill,
              { width: `${Math.max(0, Math.min(100, Number(programProgress || 0)))}%` },
            ]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit Training Program"
          onPress={() => activeProgram.id && onManageProgram(Number(activeProgram.id))}
          style={({ pressed }) => [styles.programEditRow, pressed && styles.pressed]}
        >
          <Ionicons name="create-outline" size={20} color={colors.textStrong} />
          <Text style={styles.programEditRowText}>Edit Training Program</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.subtle} />
        </Pressable>
      </TrainingHubMaterialSurface>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.blockTabs}
      >
        {orderedBlocks.length ? orderedBlocks.map((block, index) => {
          const selected = block.id === selectedBlock?.id;
          const blockIsCurrent = block.id === currentBlockId;
          const blockWeekTag = block.week_tags?.find((entry) => Number(entry.week) === Number(block.current_week || 1));
          return (
            <Pressable
              key={block.id}
              onPress={() => setSelectedBlockId(block.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.blockTab, selected && styles.blockTabActive]}
            >
              <Text
                numberOfLines={2}
                style={[styles.blockTabText, selected && styles.blockTabTextActive]}
              >
                {blockTabLabel(block, index)}
              </Text>
              <Text style={[styles.blockTabMeta, selected && styles.blockTabMetaActive]}>
                {blockIsCurrent ? 'Current' : blockWeekTag?.label || `${block.total_weeks || 0} weeks`}
              </Text>
              {selected ? (
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(204, 164, 74, 0)', 'rgba(204, 164, 74, 0.18)']}
                  style={styles.blockTabUnderglow}
                />
              ) : null}
              {selected ? <View style={styles.blockTabIndicator} /> : null}
            </Pressable>
          );
        }) : (
          <View style={[styles.blockTab, styles.blockTabActive]}>
            <Text style={[styles.blockTabText, styles.blockTabTextActive]}>Block 1</Text>
          </View>
        )}
      </ScrollView>

      {selectedBlock ? (
        <TrainingHubMaterialSurface
          accentColor={movementCardStateAccent(selectedBlockState)}
          state={selectedBlockState}
          style={styles.selectedBlockSurface}
        >
          <View style={styles.selectedBlockIcon}>
            <Ionicons
              name="barbell-outline"
              size={22}
              color={movementCardStateAccent(selectedBlockState)}
            />
          </View>
          <View style={styles.selectedBlockCopy}>
            <Text style={styles.selectedBlockName}>{selectedBlock.name || 'Training Block'}</Text>
            <Text style={styles.selectedBlockMeta}>
              {selectedBlock.date_range_label || formatRangeLabel(parseDate(selectedBlock.start_date), parseDate(selectedBlock.end_date))}
              {' · '}
              Week {currentWeek} of {selectedBlock.total_weeks || visibleWeeks.length || 1}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Block actions for ${selectedBlock.name || 'Training Block'}`}
            hitSlop={10}
            onPress={(event) => setBlockMenu({
              block: selectedBlock,
              anchorY: event.nativeEvent.pageY,
            })}
            style={({ pressed }) => [styles.blockActionsButton, pressed && styles.pressed]}
          >
            <Text style={styles.blockActionsButtonText}>Actions</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.subtle} />
          </Pressable>
        </TrainingHubMaterialSurface>
      ) : null}

      <View style={styles.weekCardList}>
        {visibleWeeks.length ? visibleWeeks.map((week) => {
          const expanded = week.index === expandedWeek;
          const weekKey = `${selectedBlock?.id || 'fallback'}:${week.index}`;
          const restoredDay = selectedBlock?.id === initialBlockId && week.index === initialWeek ? initialDay : null;
          const selectedDayKey = selectedDayKeys[weekKey] || restoredDay || firstDayKeyForWeek(week);
          const selectedDay = week.days.find((day) => day.key === selectedDayKey) || week.days[0] || null;
          const weekState = programmingWeekMaterialState(week.index, currentWeek);
          return (
            <TrainingHubMaterialSurface
              key={`${selectedBlock?.id || 'fallback'}-${week.index}`}
              accentColor={movementCardStateAccent(weekState)}
              expanded={expanded}
              state={weekState}
              style={[styles.programmingWeekSurface, expanded && styles.programmingWeekSurfaceExpanded]}
            >
              <View style={styles.weekCardHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} Week ${week.index}`}
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedWeek(expanded ? 0 : week.index)}
                  style={({ pressed }) => [styles.weekCardHeaderMain, pressed && styles.pressed]}
                >
                  <View style={styles.weekCardTitleCopy}>
                    <View style={styles.weekCardTitleLine}>
                      <Text typographyRole="cardTitle" style={styles.weekCardTitle}>Week {week.index}</Text>
                      {week.tag?.label ? <Text style={styles.weekTag}>{week.tag.label}</Text> : null}
                    </View>
                    <Text style={styles.weekCardRange}>{week.rangeLabel}</Text>
                    <Text style={styles.weekCardSummary}>{week.summary}</Text>
                  </View>
                </Pressable>
                <View style={styles.weekCardHeaderControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Week ${week.index} actions`}
                    hitSlop={10}
                    onPress={(event) => setWeekMenu({
                      week,
                      anchorY: event.nativeEvent.pageY,
                    })}
                    style={({ pressed }) => [styles.weekActionsButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.weekActionsText}>Actions</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} Week ${week.index}`}
                    accessibilityState={{ expanded }}
                    hitSlop={10}
                    onPress={() => setExpandedWeek(expanded ? 0 : week.index)}
                    style={({ pressed }) => [styles.weekExpandButton, pressed && styles.pressed]}
                  >
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={movementCardStateAccent(weekState)}
                    />
                  </Pressable>
                </View>
              </View>

              {expanded ? (
                <>
                  {week.objective?.text ? (
                    <View style={styles.weekObjective}>
                      <View style={styles.weekObjectiveIcon}>
                        <Ionicons name="compass-outline" size={18} color={movementCardStateAccent(weekState)} />
                      </View>
                      <View style={styles.weekObjectiveCopy}>
                        <Text style={styles.weekObjectiveLabel}>WEEK OBJECTIVE</Text>
                        <Text style={styles.weekObjectiveText}>{week.objective.text}</Text>
                      </View>
                    </View>
                  ) : null}
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
                        <Text style={styles.weekStripDayNumber}>
                          {day.date ? parseDate(day.date)?.getDate() || '—' : '—'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {selectedDay?.sessions.length ? (
                    <View style={styles.daySessionList}>
                      {selectedDay.sessions.map((session) => {
                        const preview = buildSessionPreview(week.index, session);
                        const sessionState = programmingSessionMaterialState(session);
                        const movementSummary = formatSessionContentSnapshot({
                          movements: preview.lines.map((line) => line.label),
                          accessoryCount: session.preview?.accessory_count ?? session.focus?.accessory_count,
                        });
                        const openSession = () => onOpenSession(preview.sessionId, {
                          blockId: selectedBlock?.id || null,
                          week: week.index,
                          day: selectedDay?.key || null,
                        });
                        const viewSessionAsAthlete = () => onViewSession(preview.sessionId);
                        return (
                          <Swipeable
                            key={session.id}
                            friction={1}
                            overshootRight={false}
                            rightThreshold={82}
                            dragOffsetFromRightEdge={8}
                            renderRightActions={(progress, dragX) => {
                              const revealTranslateX = dragX.interpolate({
                                inputRange: [-SESSION_SWIPE_ACTIONS_WIDTH, 0],
                                outputRange: [0, SESSION_SWIPE_ACTIONS_WIDTH],
                                extrapolate: 'clamp',
                              });
                              const revealOpacity = progress.interpolate({
                                inputRange: [0, 0.08, 1],
                                outputRange: [0, 0.65, 1],
                                extrapolate: 'clamp',
                              });

                              return (
                                <Animated.View
                                  style={[
                                    styles.sessionSwipeActions,
                                    {
                                      opacity: revealOpacity,
                                      transform: [{ translateX: revealTranslateX }],
                                    },
                                  ]}
                                >
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Edit ${preview.code}`}
                                    onPress={openSession}
                                    style={({ pressed }) => [
                                      styles.sessionSwipeAction,
                                      pressed && styles.sessionSwipeActionPressed,
                                    ]}
                                  >
                                    <Ionicons name="create-outline" size={19} color={colors.textStrong} />
                                    <Text style={styles.sessionSwipeActionText}>Edit</Text>
                                  </Pressable>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Open ${preview.code} athlete view`}
                                    onPress={viewSessionAsAthlete}
                                    style={({ pressed }) => [
                                      styles.sessionSwipeAction,
                                      styles.sessionSwipeAthViewAction,
                                      pressed && styles.sessionSwipeAthViewActionPressed,
                                    ]}
                                  >
                                    <Ionicons name="eye-outline" size={19} color={colors.textStrong} />
                                    <Text style={styles.sessionSwipeActionText}>Ath View</Text>
                                  </Pressable>
                                </Animated.View>
                              );
                            }}
                          >
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${preview.code}. ${preview.status}.`}
                              accessibilityHint="Opens the Session editor. Swipe left for Edit or athlete view."
                              accessibilityActions={[
                                { name: 'edit', label: 'Edit Session' },
                                { name: 'view', label: 'Open athlete view' },
                              ]}
                              onAccessibilityAction={(event) => {
                                if (event.nativeEvent.actionName === 'edit') openSession();
                                if (event.nativeEvent.actionName === 'view') viewSessionAsAthlete();
                              }}
                              onPress={openSession}
                              style={({ pressed }) => [
                                styles.programmingSessionRow,
                                pressed && styles.programmingSessionRowPressed,
                              ]}
                            >
                              <View
                                style={[
                                  styles.programmingSessionMarker,
                                  { borderColor: movementCardStateAccent(sessionState) },
                                ]}
                              >
                                <Ionicons
                                  name={sessionState === 'complete' ? 'checkmark' : 'barbell-outline'}
                                  size={18}
                                  color={movementCardStateAccent(sessionState)}
                                />
                              </View>
                              <View style={styles.programmingSessionCopy}>
                                <Text numberOfLines={2} style={styles.programmingSessionTitle}>{preview.code}</Text>
                                <Text numberOfLines={2} style={styles.programmingSessionSummary}>
                                  {movementSummary || preview.accessories}
                                </Text>
                                <Text style={styles.programmingSessionDate}>
                                  {[
                                    formatLongDate(session.date || selectedDay?.date),
                                    session.estimated_duration_minutes
                                      ? `About ${session.estimated_duration_minutes} min`
                                      : null,
                                  ].filter(Boolean).join(' · ')}
                                </Text>
                              </View>
                              <View style={styles.programmingSessionStatusColumn}>
                                <Text
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.8}
                                  style={[
                                    styles.sessionStatusLabel,
                                    { color: movementCardStateAccent(sessionState) },
                                  ]}
                                >
                                  {preview.status}
                                </Text>
                              </View>
                            </Pressable>
                          </Swipeable>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.dayEmptyState}>
                      <View style={styles.dayEmptyCopy}>
                        <Text style={styles.dayEmptyTitle}>No Sessions scheduled</Text>
                        <Text style={styles.weekEmptyText}>Build, apply a template, or adopt an existing Session.</Text>
                      </View>
                    </View>
                  )}
                  {selectedDay?.date ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add Training Session on ${formatLongDate(selectedDay.date)}`}
                      onPress={() => {
                        if (selectedDay.date) {
                          setSessionAdd({ date: selectedDay.date, mode: 'choose' });
                        }
                      }}
                      style={({ pressed }) => [
                        styles.addSessionButton,
                        styles.weekAddSessionButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons name="add" size={18} color={colors.textStrong} />
                      <Text style={styles.addSessionButtonText}>Add Session</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </TrainingHubMaterialSurface>
          );
        }) : (
          <View style={styles.weekEmptyBlock}>
            <Text style={styles.weekEmptyTitle}>No blocks found</Text>
            <Text style={styles.weekEmptyText}>This program does not have a block roadmap yet.</Text>
          </View>
        )}
      </View>
      <WeekActionPopout
        context={weekMenu}
        onClose={() => setWeekMenu(null)}
        onSelect={openWeekAction}
      />
      <BlockActionPopout
        context={blockMenu}
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
      <ProgramActionsModal
        visible={programActionsOpen}
        athleteId={athleteId || null}
        activeProgram={activeProgram}
        onClose={() => setProgramActionsOpen(false)}
        onCreate={() => {
          setProgramActionsOpen(false);
          onCreateProgram();
        }}
        onEdit={(programId) => {
          setProgramActionsOpen(false);
          onManageProgram(programId);
        }}
        onRefresh={onRefresh}
      />
      <SessionAddModal
        state={sessionAdd}
        athleteId={athleteId || null}
        programId={Number(activeProgram.id || 0) || null}
        blockId={selectedBlock?.id || null}
        onClose={() => setSessionAdd(null)}
        onMode={(mode) => setSessionAdd((existing) => (
          existing ? { ...existing, mode } : existing
        ))}
        onBuild={() => {
          const date = sessionAdd?.date || null;
          setSessionAdd(null);
          onAddSession(date);
        }}
        onRefresh={onRefresh}
      />
    </View>
  );
}

function SessionAddModal({
  state,
  athleteId,
  programId,
  blockId,
  onClose,
  onMode,
  onBuild,
  onRefresh,
}: {
  state: SessionAddState;
  athleteId: number | null;
  programId: number | null;
  blockId: number | null;
  onClose: () => void;
  onMode: (mode: NonNullable<SessionAddState>['mode']) => void;
  onBuild: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState<SessionTemplateOption[]>([]);
  const [sources, setSources] = useState<AdoptableSessionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state || state.mode === 'choose' || !athleteId || !programId) return;
    let active = true;
    setLoading(true);
    setError('');
    const endpoint = state.mode === 'templates'
      ? `/workouts/mobile/programming/session-templates?athlete_id=${athleteId}`
      : `/workouts/mobile/programming/session-sources?athlete_id=${athleteId}&program_id=${programId}`;
    fetchJson<any>(endpoint, { method: 'GET' })
      .then((resp) => {
        const json = resp.json || {};
        if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
        if (!active) return;
        if (state.mode === 'templates') {
          setTemplates(Array.isArray(json.templates) ? json.templates : []);
        } else {
          setSources(Array.isArray(json.sources) ? json.sources : []);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (state.mode === 'templates') setTemplates([]);
        else setSources([]);
        setError(err?.message || 'Training Session options could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [athleteId, programId, state]);

  useEffect(() => {
    if (!state) {
      setTemplates([]);
      setSources([]);
      setError('');
      setBusyId('');
    }
  }, [state]);

  if (!state) return null;

  const contextReady = !!athleteId && !!programId && !!blockId && !!state.date;
  const applyTemplate = async (template: SessionTemplateOption) => {
    if (!contextReady || template.unsupported_reason) return;
    const key = `template:${String(template.id)}`;
    setBusyId(key);
    setError('');
    try {
      const resp = await fetchJson<any>('/workouts/mobile/programming/session-actions', {
        method: 'POST',
        body: {
          action: 'apply_template',
          athlete_id: athleteId,
          program_id: programId,
          block_id: blockId,
          target_date: state.date,
          template_id: template.id,
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      await onRefresh();
      onClose();
      const createdSessionId = json.workout?.id || json.workout_id || json.id;
      if (createdSessionId) {
        router.push({
          pathname: '/workout/session-workspace/[workoutId]' as any,
          params: { workoutId: String(createdSessionId), athleteId: String(athleteId), programmingBlockId: String(blockId) },
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Session template could not be applied.');
    } finally {
      setBusyId('');
    }
  };

  const adoptSession = async (source: AdoptableSessionOption) => {
    if (!contextReady) return;
    const key = `source:${source.id}`;
    setBusyId(key);
    setError('');
    try {
      const resp = await fetchJson<any>(`/workouts/mobile/programming/programs/${programId}/adopt-session`, {
        method: 'POST',
        body: {
          athlete_id: athleteId,
          block_id: blockId,
          workout_id: source.id,
          target_date: state.date,
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      await onRefresh();
      onClose();
      const adoptedSessionId = json.workout?.id || json.workout_id || json.id || source.id;
      router.push({
        pathname: '/workout/session-workspace/[workoutId]' as any,
        params: { workoutId: String(adoptedSessionId), athleteId: String(athleteId), programmingBlockId: String(blockId) },
      });
    } catch (err: any) {
      setError(err?.message || 'Training Session could not be adopted.');
    } finally {
      setBusyId('');
    }
  };

  const title = state.mode === 'choose'
    ? 'Add Training Session'
    : state.mode === 'templates'
      ? 'Use Session Template'
      : 'Adopt Existing Session';
  const subtitle = `${formatLongDate(state.date)} • ${state.mode === 'choose'
    ? 'Choose how to begin.'
    : state.mode === 'templates'
      ? 'Create a persistent Session from a saved template.'
      : 'Move an eligible unassigned Session into this Training Program.'}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionSheetScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busyId ? undefined : onClose} />
        <View style={styles.sessionAddSheet}>
          <View style={styles.weekActionSheetHeader}>
            <View style={styles.programActionHeading}>
              <Text style={styles.weekActionEyebrow}>Programming</Text>
              <Text style={styles.weekActionTitle}>{title}</Text>
              <Text style={styles.weekActionSubtitle}>{subtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close add Training Session"
              disabled={!!busyId}
              onPress={onClose}
              style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>

          {!contextReady ? (
            <Text style={styles.weekActionWarning}>Training Program context is missing.</Text>
          ) : null}
          {error ? <Text style={styles.weekActionWarning}>{error}</Text> : null}

          {state.mode === 'choose' ? (
            <View style={styles.sessionAddChoiceList}>
              <SessionAddChoice
                icon="create-outline"
                title="Build New"
                detail="Create a draft and open the Session Workspace."
                onPress={() => {
                  if (!contextReady) {
                    onBuild();
                    return;
                  }
                  onClose();
                  router.push({
                    pathname: '/(tabs)/create-workout',
                    params: { athleteId: String(athleteId), date: state.date, programmingBlockId: String(blockId), programmingProgramId: String(programId) },
                  } as any);
                }}
              />
              <SessionAddChoice
                icon="albums-outline"
                title="Use Session Template"
                detail="Start from a saved reusable Session."
                onPress={() => onMode('templates')}
              />
              <SessionAddChoice
                icon="enter-outline"
                title="Adopt Existing Session"
                detail="Bring an eligible unassigned Session into this Training Program."
                onPress={() => onMode('adopt')}
              />
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to add Training Session choices"
                disabled={!!busyId}
                onPress={() => onMode('choose')}
                style={({ pressed }) => [styles.sessionAddBack, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={16} color={colors.violet} />
                <Text style={styles.sessionAddBackText}>Add options</Text>
              </Pressable>
              <ScrollView
                style={styles.sessionAddList}
                contentContainerStyle={styles.sessionAddListContent}
                keyboardShouldPersistTaps="handled"
              >
                {loading ? <ActivityIndicator color={colors.violet} style={styles.programActionLoader} /> : null}
                {!loading && state.mode === 'templates' && !templates.length && !error ? (
                  <Text style={styles.weekActionEmpty}>No saved Session templates yet.</Text>
                ) : null}
                {!loading && state.mode === 'adopt' && !sources.length && !error ? (
                  <Text style={styles.weekActionEmpty}>No eligible unassigned Sessions are available.</Text>
                ) : null}
                {state.mode === 'templates' ? templates.map((template) => {
                  const key = `template:${String(template.id)}`;
                  const disabled = !!busyId || !!template.unsupported_reason;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${template.name}`}
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => void applyTemplate(template)}
                      style={({ pressed }) => [
                        styles.sessionAddOption,
                        disabled && styles.weekActionDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.sessionAddOptionCopy}>
                        <Text style={styles.sessionAddOptionTitle}>{template.name}</Text>
                        <Text style={styles.sessionAddOptionMeta}>
                          {template.unsupported_reason
                            || `${Number(template.core_count || 0)} core • ${Number(template.accessory_count || 0)} accessories`}
                        </Text>
                      </View>
                      {busyId === key
                        ? <ActivityIndicator color={colors.violet} />
                        : <Ionicons name="chevron-forward" size={17} color={colors.subtle} />}
                    </Pressable>
                  );
                }) : null}
                {state.mode === 'adopt' ? sources.map((source) => {
                  const key = `source:${source.id}`;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Adopt ${source.name}`}
                      accessibilityState={{ disabled: !!busyId }}
                      disabled={!!busyId}
                      onPress={() => void adoptSession(source)}
                      style={({ pressed }) => [styles.sessionAddOption, pressed && styles.pressed]}
                    >
                      <View style={styles.sessionAddOptionCopy}>
                        <Text style={styles.sessionAddOptionTitle}>{source.name}</Text>
                        <Text style={styles.sessionAddOptionMeta}>
                          {source.date ? formatLongDate(source.date) : 'Unscheduled'}
                          {source.status ? ` • ${String(source.status).replaceAll('_', ' ')}` : ''}
                        </Text>
                      </View>
                      {busyId === key
                        ? <ActivityIndicator color={colors.violet} />
                        : <Ionicons name="chevron-forward" size={17} color={colors.subtle} />}
                    </Pressable>
                  );
                }) : null}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SessionAddChoice({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.sessionAddChoice, pressed && styles.pressed]}
    >
      <View style={styles.sessionAddChoiceIcon}>
        <Ionicons name={icon} size={21} color={colors.violet} />
      </View>
      <View style={styles.sessionAddOptionCopy}>
        <Text style={styles.sessionAddOptionTitle}>{title}</Text>
        <Text style={styles.sessionAddOptionMeta}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
    </Pressable>
  );
}

type ProgramDestructiveAction = {
  type: 'archive' | 'delete';
  program: ProgrammingProgramSummary;
} | null;

function ProgramActionsModal({
  visible,
  athleteId,
  activeProgram,
  onClose,
  onCreate,
  onEdit,
  onRefresh,
}: {
  visible: boolean;
  athleteId: number | null;
  activeProgram: TrainingHubPayload['active_program'] | null;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (programId: number) => void;
  onRefresh: () => void | Promise<void>;
}) {
  const [programs, setPrograms] = useState<ProgrammingProgramSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [destructiveAction, setDestructiveAction] = useState<ProgramDestructiveAction>(null);
  const [confirmation, setConfirmation] = useState('');

  const loadPrograms = useCallback(async () => {
    if (!athleteId) {
      setPrograms([]);
      setError('Athlete context is missing.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await listProgrammingPrograms(athleteId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'Training Programs could not be loaded.');
      return;
    }
    setPrograms(result.programs || []);
  }, [athleteId]);

  useEffect(() => {
    if (!visible) return;
    setDestructiveAction(null);
    setConfirmation('');
    void loadPrograms();
  }, [loadPrograms, visible]);

  const submitDestructiveAction = async () => {
    if (!athleteId || !destructiveAction) return;
    const program = destructiveAction.program;
    if (confirmation.trim() !== program.name.trim()) {
      setError(`Type “${program.name}” exactly to continue.`);
      return;
    }
    setBusy(true);
    setError('');
    const payload = {
      athlete_id: athleteId,
      confirmation: confirmation.trim(),
      expected_updated_at: program.updated_at || null,
    };
    const result = destructiveAction.type === 'archive'
      ? await archiveProgrammingProgram(program.id, payload)
      : await deleteProgrammingProgram(program.id, payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || `Training Program could not be ${destructiveAction.type}d.`);
      return;
    }
    setDestructiveAction(null);
    setConfirmation('');
    await onRefresh();
    await loadPrograms();
  };

  const activeProgramId = Number(activeProgram?.id || 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.actionSheetScrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View style={[styles.weekActionSheet, styles.programActionSheet]}>
          <View style={styles.programActionSheetHandle} />
          <View style={styles.weekActionSheetHeader}>
            <View style={styles.programActionHeading}>
              {!destructiveAction ? (
                <Text style={styles.programActionEyebrow}>Programming lifecycle</Text>
              ) : null}
              <Text style={styles.weekActionTitle}>
                {destructiveAction
                  ? `${destructiveAction.type === 'archive' ? 'Archive' : 'Delete'} Training Program`
                  : 'Training Programs'}
              </Text>
              <Text style={styles.weekActionSubtitle}>
                {destructiveAction
                  ? destructiveAction.program.name
                  : 'Manage this athlete’s complete programming lifecycle.'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Training Program actions"
              disabled={busy}
              onPress={onClose}
              style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>

          {destructiveAction ? (
            <View style={styles.programConfirmationBody}>
              <Text style={styles.programConfirmationCopy}>
                {destructiveAction.type === 'archive'
                  ? 'Archiving releases future editable Sessions while retaining historical evidence.'
                  : 'Deleting removes the Training Program structure and releases Sessions according to the canonical lifecycle rules.'}
              </Text>
              <Text style={styles.weekActionFieldLabel}>
                Type the Training Program name to confirm
              </Text>
              <TextInput
                accessibilityLabel="Training Program name confirmation"
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                style={styles.weekActionInput}
              />
              {error ? <Text style={styles.weekActionWarning}>{error}</Text> : null}
              <View style={styles.weekActionFooter}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    setDestructiveAction(null);
                    setConfirmation('');
                    setError('');
                  }}
                  style={({ pressed }) => [styles.weekActionSecondary, pressed && styles.pressed]}
                >
                  <Text style={styles.weekActionSecondaryText}>Back</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || confirmation.trim() !== destructiveAction.program.name.trim()}
                  onPress={submitDestructiveAction}
                  style={({ pressed }) => [
                    styles.programDestructiveSubmit,
                    (busy || confirmation.trim() !== destructiveAction.program.name.trim()) && styles.weekActionDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {busy ? <ActivityIndicator color={colors.textStrong} /> : (
                    <Text style={styles.weekActionPrimaryText}>
                      {destructiveAction.type === 'archive' ? 'Archive' : 'Delete'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView
              style={styles.programActionList}
              contentContainerStyle={styles.programActionListContent}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create Training Program"
                onPress={onCreate}
                style={({ pressed }) => [styles.programCreateButton, pressed && styles.pressed]}
              >
                <View style={styles.programCreateIcon}>
                  <Ionicons name="add" size={20} color={colors.violet} />
                </View>
                <Text style={styles.programCreateButtonText}>Create Training Program</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
              {loading ? (
                <ActivityIndicator color={colors.violet} style={styles.programActionLoader} />
              ) : null}
              {error ? <Text style={styles.weekActionWarning}>{error}</Text> : null}
              {!loading && !programs.length && !error ? (
                <Text style={styles.weekEmptyText}>No Training Programs found for this athlete.</Text>
              ) : null}
              {programs.map((program) => {
                const isActive = program.id === activeProgramId || program.status === 'active';
                const isArchived = program.status === 'archived';
                const statusLabel = isActive
                  ? 'Active'
                  : String(program.status || 'draft').replaceAll('_', ' ');
                return (
                  <TrainingHubMaterialSurface
                    key={program.id}
                    accentColor={isActive ? colors.amber : (isArchived ? colors.subtle : colors.violet)}
                    state={isActive ? 'in_progress' : (isArchived ? 'complete' : 'not_started')}
                    style={styles.programActionCard}
                  >
                    <View style={styles.programActionCardHeader}>
                      <View style={styles.programActionCardCopy}>
                        <Text style={styles.programActionCardTitle}>{program.name}</Text>
                        <Text style={styles.programActionCardMeta}>
                          {program.start_date && program.end_date
                            ? `${formatShortDate(program.start_date)} – ${formatShortDate(program.end_date)}`
                            : 'Dates not set'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.programStatusBadge,
                          isActive && styles.programActiveBadge,
                          isArchived && styles.programArchivedBadge,
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                    <View style={styles.programActionButtons}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${program.name}`}
                        onPress={() => onEdit(program.id)}
                        style={({ pressed }) => [
                          styles.programCardAction,
                          styles.programCardActionEdit,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons name="create-outline" size={17} color={colors.violet} />
                        <Text style={styles.programCardActionText}>Edit</Text>
                      </Pressable>
                      {program.status !== 'archived' ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Archive ${program.name}`}
                          onPress={() => {
                            setError('');
                            setDestructiveAction({ type: 'archive', program });
                          }}
                          style={({ pressed }) => [
                            styles.programCardAction,
                            styles.programCardActionArchive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Ionicons name="archive-outline" size={17} color={colors.amber} />
                          <Text style={[styles.programCardActionText, styles.programActionArchiveText]}>
                            Archive
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${program.name}`}
                        onPress={() => {
                          setError('');
                          setDestructiveAction({ type: 'delete', program });
                        }}
                        style={({ pressed }) => [
                          styles.programCardAction,
                          styles.programCardActionDelete,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.red} />
                        <Text style={[styles.programCardActionText, styles.programActionDangerText]}>
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  </TrainingHubMaterialSurface>
                );
              })}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function WeekActionPopout({
  context,
  onClose,
  onSelect,
}: {
  context: WeekActionMenuContext | null;
  onClose: () => void;
  onSelect: (action: WeekActionKey, week: RoadmapWeek) => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const estimatedHeight = Math.min(560, viewportHeight - 144);
  const top = Math.max(
    72,
    Math.min(
      (context?.anchorY ?? viewportHeight / 2) - 48,
      viewportHeight - estimatedHeight - 72,
    ),
  );
  const week = context?.week || null;

  return (
    <Modal visible={!!context} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.actionPopoverScrim} onPress={onClose}>
        <Pressable
          accessibilityLabel={week ? `Week ${week.index} actions` : 'Week actions'}
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={[styles.actionPopover, { maxHeight: estimatedHeight, top }]}
        >
          <View style={styles.actionPopoverHeader}>
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
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.actionPopoverContent}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BlockActionPopout({
  context,
  onClose,
  onSelect,
}: {
  context: BlockActionMenuContext | null;
  onClose: () => void;
  onSelect: (action: BlockActionKey, block: ProgramBlockPayload) => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const estimatedHeight = Math.min(480, viewportHeight - 144);
  const top = Math.max(
    72,
    Math.min(
      (context?.anchorY ?? viewportHeight / 2) - 48,
      viewportHeight - estimatedHeight - 72,
    ),
  );
  const block = context?.block || null;

  return (
    <Modal visible={!!context} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.actionPopoverScrim} onPress={onClose}>
        <Pressable
          accessibilityLabel={`Actions for ${block?.name || 'selected Training Block'}`}
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={[styles.actionPopover, { maxHeight: estimatedHeight, top }]}
        >
          <View style={styles.actionPopoverHeader}>
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
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.actionPopoverContent}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>
        </Pressable>
      </Pressable>
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
  const [objective, setObjective] = useState('');
  const [weekTag, setWeekTag] = useState('');
  const needsWeekChoice = action === 'copy-to' || action === 'copy-from' || action === 'shift';
  const needsTemplateChoice = action === 'apply-template';

  useEffect(() => {
    if (!state) return;
    const firstWeek = weeks.find((candidate) => candidate.startDate && candidate.startDate !== state.week.startDate);
    setSelectedWeekStart(firstWeek?.startDate || '');
    setTemplateName(`Week ${state.week.index} Template`);
    setSelectedTemplateId('');
    setTemplateError('');
    setObjective(state.week.objective?.text || '');
    setWeekTag(state.week.tag?.key || '');
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
        : action === 'edit-objective'
          ? 'Save Objective'
          : action === 'set-tag'
            ? 'Save Focus'
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
  if (action === 'edit-objective') extra.objective = objective;
  if (action === 'set-tag') extra.week_tag = weekTag;

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

          {action === 'edit-objective' ? (
            <View style={styles.weekActionField}>
              <Text style={styles.weekActionFieldLabel}>Week objective</Text>
              <TextInput
                value={objective}
                onChangeText={setObjective}
                multiline
                maxLength={800}
                textAlignVertical="top"
                placeholder="What should the athlete accomplish this week?"
                placeholderTextColor={colors.subtle}
                style={[styles.weekActionInput, styles.weekActionTextArea]}
              />
              <Text style={styles.weekActionFieldHint}>{objective.length}/800</Text>
            </View>
          ) : null}

          {action === 'set-tag' ? (
            <View style={styles.weekChoiceList}>
              <Text style={styles.weekActionFieldLabel}>Week focus</Text>
              {trainingWeekTags.map((tag) => {
                const selected = tag.key === weekTag;
                return (
                  <Pressable
                    key={tag.key || 'standard'}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setWeekTag(tag.key)}
                    style={[styles.weekChoiceRow, selected && styles.weekChoiceRowSelected]}
                  >
                    <View>
                      <Text style={[styles.weekChoiceTitle, selected && styles.weekChoiceTitleSelected]}>{tag.label}</Text>
                      {!tag.key ? <Text style={styles.weekChoiceMeta}>No special week tag</Text> : null}
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.violet} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

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
              {weekActionPreview(action, week, selectedWeek, selectedTemplate, objective, weekTag)}
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
    'edit-objective': 'Set the concise coach-authored objective the athlete will see for this week.',
    'set-tag': 'Set the training focus the athlete will see for this week in Training Hub.',
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
  template: WeekTemplate | null,
  objective = '',
  weekTag = ''
) {
  if (action === 'edit-objective') {
    return objective.trim()
      ? `Save this coach objective for Week ${source.index}.`
      : `Clear the coach objective from Week ${source.index}.`;
  }
  if (action === 'set-tag') {
    const tag = trainingWeekTags.find((candidate) => candidate.key === weekTag);
    return weekTag
      ? `Set Week ${source.index} focus to ${tag?.label || weekTag}.`
      : `Clear the special focus from Week ${source.index}.`;
  }
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

function ProgrammingEmptyState({ onCreateProgram, onOpenPrograms }: { onCreateProgram: () => void; onOpenPrograms: () => void }) {
  return (
    <View style={styles.programmingEmptyState}>
      <TrainingHubMaterialSurface accentColor={SLColors.accentViolet} state="not_started" style={styles.emptyProgramHero}>
        <View style={styles.emptyProgramHeroTop}>
          <View style={styles.emptyProgramHeroIcon}>
            <Ionicons name="clipboard-outline" size={32} color={SLColors.accentViolet} />
          </View>
          <View style={styles.emptyProgramHeroCopy}>
            <Text style={styles.programmingEmptyTitle}>No active Training Program</Text>
            <Text style={styles.programmingEmptyBody}>Create a program to get started.</Text>
          </View>
          <SLButton
            accessibilityLabel="Create Training Program"
            iconLeft="add"
            label="Program"
            onPress={onCreateProgram}
            size="md"
            style={styles.emptyProgramPrimaryAction}
            variant="primary"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open all Training Programs"
          onPress={onOpenPrograms}
          style={({ pressed }) => [styles.emptyProgramLibrary, pressed && styles.programmingEmptyPressed]}
        >
          <Text style={styles.emptyProgramLibraryText}>All Training Programs</Text>
          <Ionicons name="chevron-forward" size={20} color={SLColors.accentViolet} />
        </Pressable>
      </TrainingHubMaterialSurface>

      <View style={styles.gettingStarted}>
        <View style={styles.gettingStartedHeading}>
          <Text style={styles.gettingStartedTitle}>Getting Started</Text>
          <Text style={styles.gettingStartedBody}>Follow these steps to build your first program.</Text>
        </View>
        <View style={styles.gettingStartedList}>
          {GETTING_STARTED_STEPS.map((step) => (
            <GettingStartedStep key={step.index} {...step} onPress={onCreateProgram} />
          ))}
        </View>
      </View>
    </View>
  );
}

function GettingStartedStep({ index, title, body, icon, tone, onPress }: { index: number; title: string; body: string; icon: keyof typeof Ionicons.glyphMap; tone: string; onPress: () => void }) {
  return (
    <TrainingHubMaterialSurface accentColor={tone} state="not_started" style={styles.gettingStartedCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        onPress={onPress}
        style={({ pressed }) => [styles.gettingStartedRow, pressed && styles.programmingEmptyPressed]}
      >
        <View style={[styles.gettingStartedIndex, { borderColor: `${tone}55`, backgroundColor: `${tone}14` }]}>
          <Text style={[styles.gettingStartedIndexText, { color: tone }]}>{index}</Text>
        </View>
        <View style={[styles.gettingStartedIcon, { backgroundColor: `${tone}12` }]}>
          <Ionicons name={icon} size={28} color={tone} />
        </View>
        <View style={styles.gettingStartedCopy}>
          <Text style={styles.gettingStartedStepTitle}>{title}</Text>
          <Text style={styles.gettingStartedStepBody}>{body}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={tone} />
      </Pressable>
    </TrainingHubMaterialSurface>
  );
}

function TrainingHubHeader({ today }: { today?: string | null }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <Text typographyRole="pageTitle" style={styles.title}>Training Hub</Text>
        <Text typographyRole="supportingBody" style={styles.headerDate}>{formatLongDate(today) || 'Today'}</Text>
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
      <View style={styles.blockMain}>
        <View style={styles.blockCopy}>
          <Text style={styles.zoneKicker}>Current Block</Text>
          <Text typographyRole="workoutName" numberOfLines={2} ellipsizeMode="tail" style={styles.blockName}>
            {block?.name || 'No active block'}
          </Text>
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
                      {isDone ? <Ionicons name="checkmark" size={12} color={SLColors.textInverted} /> : null}
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
      <View style={styles.positionMain}>
        <Text style={styles.zoneKicker}>Current Position</Text>
        <View style={styles.positionGrid}>
          <View style={styles.positionTodayBlock}>
            <View style={styles.positionTargetIcon}>
              <Ionicons name="locate" size={23} color={colors.green} />
            </View>
            <View style={styles.positionTodayCopy}>
              <Text style={styles.positionMetaLabel}>Today</Text>
              <Text typographyRole="workoutName" numberOfLines={2} ellipsizeMode="tail" style={styles.positionPrimary}>{todayText}</Text>
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
              <Text typographyRole="workoutName" numberOfLines={2} ellipsizeMode="tail" style={styles.positionPrimarySmall}>{nextText}</Text>
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
          value="Review past Training Sessions and performance."
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
  if (rawName) return rawName;
  return `Block ${Number(block.order_idx || index) + 1}`;
}

function programmingStatusLabel(status?: string | null) {
  const normalized = String(status || 'active').trim().toLowerCase();
  if (normalized === 'draft') return 'Draft';
  if (normalized === 'archived') return 'Archived';
  if (normalized === 'assigned') return 'Assigned';
  return 'Active';
}

function programmingWeekMaterialState(
  weekIndex: number,
  currentWeek: number
): MovementCardMaterialState {
  if (weekIndex < currentWeek) return 'complete';
  if (weekIndex === currentWeek) return 'in_progress';
  return 'not_started';
}

function programmingSessionMaterialState(session: HubSession): MovementCardMaterialState {
  const kind = normalizedKind(session);
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return 'complete';
  if (kind === 'missed' || kind === 'past_due' || kind === 'incomplete') return 'failed';
  if (kind === 'in_progress' || kind === 'started') return 'in_progress';
  return 'not_started';
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
      tag: block.week_tags?.find((tag) => Number(tag.week) === index) || null,
      objective: (() => {
        const row = block.week_objectives?.find((entry) => Number(entry.week) === index);
        return row?.text ? { text: row.text, updatedAt: row.updated_at || null } : null;
      })(),
      days: buildWeekStripDays(weekStart, sessions),
    };
  });
}

function buildAthleteTrainingHubData(
  hub: TrainingHubPayload | null,
  blocks: ProgramBlockPayload[],
  pendingMap: SessionMap,
  completedMap: SessionMap,
): AthleteTrainingHubData {
  const athletePhoto = normalizeProfilePhotoPayload(hub?.athlete);
  const coachPhoto = normalizeProfilePhotoPayload(hub?.connected_coach);
  const program = hub?.active_program || null;
  const blocksWithProgramIdentity = blocks.filter((block) => block.training_program_id != null);
  const activeBlocks = !program
    ? []
    : blocksWithProgramIdentity.length
      ? blocksWithProgramIdentity.filter((block) => block.training_program_id === program.id)
      : blocks;
  const currentBlockId = hub?.current_block?.id ?? null;
  const currentIndex = Math.max(0, activeBlocks.findIndex((block) => block.id === currentBlockId));

  const mappedBlocks: AthleteTrainingBlock[] = activeBlocks.map((block, index) => ({
    id: block.id,
    name: block.name || `Block ${index + 1}`,
    status: block.id === currentBlockId ? 'current' : index < currentIndex ? 'completed' : 'upcoming',
    currentWeek: block.id === currentBlockId ? block.current_week : null,
    totalWeeks: block.total_weeks,
    purpose: block.id === currentBlockId ? program?.description || null : null,
    coachContext: null,
    weeks: (block.total_weeks || inclusiveWeekCount(block.start_date, block.end_date)
      ? buildRoadmapWeeks(block, pendingMap, completedMap)
      : []).map((week): AthleteTrainingWeek => ({
      key: `${block.id}-${week.index}`,
      number: week.index,
      rangeLabel: week.rangeLabel,
      summary: week.summary,
      current: block.id === currentBlockId && Number(block.current_week || 0) === week.index,
      tag: week.tag ? { key: week.tag.key, label: week.tag.label } : null,
      objective: week.objective,
      days: week.days.map((day): AthleteTrainingDay => {
        const sessions = day.sessions.map((session) => {
          const previewMovements = (session.preview?.core || [])
            .map((item) => fullMovementName(item.movement))
            .filter(Boolean);
          const focusMovements = (session.focus?.primary || [])
            .map(fullMovementName)
            .filter(Boolean);
          return {
            id: session.id,
            title: sessionTitle(session),
            date: session.date,
            status: athleteSessionStatus(session, day.date, hub?.today),
            contentSummary: formatSessionContentSnapshot({
              movements: previewMovements.length ? previewMovements : focusMovements,
              accessoryCount: session.preview?.accessory_count ?? session.focus?.accessory_count,
            }),
            dayLabel: trainingHubSessionDayLabel(session.date || day.date, hub?.today),
            stateLabel: trainingHubSessionStatusLabel(session),
          };
        });
        return {
          key: day.key,
          weekday: day.label.slice(0, 2),
          dayNumber: day.date ? String(parseDate(day.date)?.getDate() || '') : null,
          status: sessions[0]?.status || (day.date === hub?.today ? 'today' : 'rest'),
          sessions,
        };
      }),
    })),
  }));

  const history = hub?.program_history?.[0] || null;
  const totalWeeks = program?.total_weeks || (program ? programWeekCount(program, activeBlocks) : null);
  const currentWeek = program?.current_week || currentProgramWeek(program, totalWeeks, hub?.today);
  const progress = program?.progress ?? resolveTrainingProgramProgress({
    startDate: program?.start_date,
    endDate: program?.end_date,
    today: hub?.today,
  });

  return {
    athleteName: hub?.athlete?.name || null,
    profilePhotoUrl: athletePhoto.profilePhotoUrl,
    profilePhotoVersion: athletePhoto.profilePhotoVersion,
    connectedCoachName: hub?.connected_coach?.name || program?.coach?.name || null,
    connectedCoachPhotoUrl: coachPhoto.profilePhotoUrl,
    connectedCoachPhotoVersion: coachPhoto.profilePhotoVersion,
    activeProgram: program ? {
      id: Number(program.id || 0),
      name: program.name || 'Current program',
      coachName: program.coach?.name || null,
      blockCount: program.block_count || activeBlocks.length || null,
      totalWeeks,
      currentWeek,
      progress,
      blocks: mappedBlocks,
    } : null,
    previousProgram: history ? {
      id: history.id,
      name: history.name || 'Previous program',
      durationLabel: history.duration_weeks ? `${history.duration_weeks} weeks` : null,
      completedLabel: history.completed_at ? `Completed ${formatLongDate(history.completed_at)}` : null,
    } : null,
    coachUpdates: (hub?.coach_updates || [])
      .filter((row) => row?.id && row?.summary)
      .map((row) => ({
        id: row.id,
        summary: String(row.summary),
        occurredAt: row.occurred_at || null,
      })),
    previousWeekRecap: hub?.previous_week_recap?.sessions ? {
      sessionsCompleted: Number(hub.previous_week_recap.sessions.completed || 0),
      sessionsAssigned: Number(hub.previous_week_recap.sessions.assigned || 0),
      setsCompleted: hub.previous_week_recap.sets?.completed ?? null,
      setsPlanned: hub.previous_week_recap.sets?.planned ?? null,
      videosReviewed: hub.previous_week_recap.videos_reviewed ?? null,
    } : null,
  };
}

function athleteSessionStatus(session: HubSession, date?: string | null, today?: string | null): 'completed' | 'today' | 'upcoming' | 'missed' | 'moved' {
  const status = normalizedKind(session);
  if (status === 'completed' || status === 'logged' || status === 'done') return 'completed';
  if (status === 'missed' || status === 'past_due' || status === 'incomplete') return 'missed';
  if (String(session.timeliness || '').toLowerCase().includes('moved')) return 'moved';
  if (date && today && date === today) return 'today';
  return 'upcoming';
}

function currentProgramWeek(program: TrainingHubPayload['active_program'], totalWeeks?: number | null, todayValue?: string | null) {
  const start = parseDate(program?.start_date);
  const today = parseDate(todayValue) || new Date();
  if (!start || !totalWeeks) return null;
  return Math.max(1, Math.min(totalWeeks, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1));
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
  return Array.from({ length: 7 }, (_, index) => {
    const day = weekStart ? addDays(weekStart, index) : null;
    const label = compactProgrammingWeekdayLabel(day, index);
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
    color: colors.textStrong,
  },
  headerDate: {
    color: colors.muted,
  },
  programmingScroll: {
    paddingTop: 10,
    paddingBottom: 36,
    gap: 18,
  },
  programmingEmptyState: {
    gap: 18,
  },
  emptyProgramHero: {
    borderRadius: SLRadius.lg,
  },
  emptyProgramHeroTop: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  emptyProgramHeroIcon: {
    width: 56,
    height: 56,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLColors.borderFocus,
    backgroundColor: SLColors.accentVioletSoft,
  },
  emptyProgramHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  programmingEmptyTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 20,
    lineHeight: 25,
    color: colors.textStrong,
  },
  programmingEmptyBody: {
    ...SLTypography.body,
    color: colors.muted,
  },
  emptyProgramPrimaryAction: {
    width: 112,
    flexShrink: 0,
  },
  emptyProgramLibrary: {
    minHeight: 50,
    marginHorizontal: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: SLRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLColors.borderStandard,
    backgroundColor: SLColors.surfaceMedia,
  },
  emptyProgramLibraryText: {
    ...SLTypography.bodyStrong,
    flex: 1,
    color: colors.textStrong,
  },
  programmingEmptyPressed: {
    opacity: 0.76,
  },
  gettingStarted: {
    gap: 10,
  },
  gettingStartedHeading: {
    gap: 2,
  },
  gettingStartedTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  gettingStartedBody: {
    ...SLTypography.body,
    color: colors.muted,
  },
  gettingStartedList: {
    gap: 7,
  },
  gettingStartedCard: {
    borderRadius: SLRadius.md,
  },
  gettingStartedRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  gettingStartedIndex: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gettingStartedIndexText: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 16,
    lineHeight: 21,
  },
  gettingStartedIcon: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.sm,
  },
  gettingStartedCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  gettingStartedStepTitle: {
    ...SLTypography.bodyStrong,
    color: colors.textStrong,
  },
  gettingStartedStepBody: {
    ...SLTypography.metadata,
    color: colors.muted,
  },
  roadmap: {
    position: 'relative',
    gap: 14,
  },
  programIdentitySurface: {
    borderRadius: SLRadius.xl,
  },
  programIdentityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  programCoachIdentity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  programCoachIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingTop: 2,
  },
  programCoachIdentityLabel: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.6,
    color: colors.violet,
  },
  programCoachIdentityName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 25,
    lineHeight: 30,
    color: colors.textStrong,
  },
  programCoachIdentityWorkspaceCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  programCoachIdentityWorkspaceCueText: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  programCoachDetails: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: colors.lineSoft,
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  programCoachDetailsLabel: {
    ...SLTypography.utilityLabel,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  programCoachProgramName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 19,
    lineHeight: 24,
    color: colors.textStrong,
  },
  programIdentityAvatar: {
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.72)',
  },
  programIdentityIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    backgroundColor: 'rgba(10, 8, 14, 0.82)',
    borderRadius: SLRadius.lg,
  },
  programIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  programIdentityEyebrow: {
    ...SLTypography.utilityLabel,
    color: colors.violet,
    textTransform: 'uppercase',
  },
  programIdentityName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 24,
    lineHeight: 29,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  programIdentityMeta: {
    ...SLTypography.body,
    color: colors.muted,
  },
  programActionsButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.16)',
    backgroundColor: 'rgba(8, 7, 11, 0.68)',
    borderRadius: SLRadius.lg,
  },
  programActionsButtonText: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  programIdentityProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  programIdentityStatus: {
    ...SLTypography.bodyStrong,
    color: colors.textStrong,
  },
  programIdentityProgress: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 17,
    lineHeight: 21,
    color: colors.violet,
  },
  programProgressTrack: {
    height: 6,
    overflow: 'hidden',
    marginTop: 9,
    marginHorizontal: 16,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  programProgressFill: {
    minWidth: 4,
    height: '100%',
    borderRadius: SLRadius.pill,
    backgroundColor: colors.violet,
  },
  programEditRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: colors.lineSoft,
    paddingHorizontal: 16,
  },
  programEditRowText: {
    ...SLTypography.bodyStrong,
    flex: 1,
    color: colors.textStrong,
  },
  blockTabs: {
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  blockTab: {
    position: 'relative',
    minWidth: 148,
    minHeight: 66,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  blockTabActive: {
    backgroundColor: 'rgba(204, 164, 74, 0.025)',
  },
  blockTabText: {
    ...SLTypography.bodyStrong,
    color: colors.muted,
    textAlign: 'center',
  },
  blockTabTextActive: {
    color: colors.amber,
  },
  blockTabMeta: {
    ...SLTypography.caption,
    marginTop: 3,
    color: colors.subtle,
    textAlign: 'center',
  },
  blockTabMetaActive: {
    color: 'rgba(222, 198, 166, 0.76)',
  },
  blockTabUnderglow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
  },
  blockTabIndicator: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    height: 3,
    borderRadius: SLRadius.pill,
    backgroundColor: colors.amber,
  },
  selectedBlockSurface: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectedBlockIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  selectedBlockCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  selectedBlockName: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  selectedBlockMeta: {
    ...SLTypography.body,
    color: colors.muted,
  },
  blockActionsButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 5,
  },
  blockActionsButtonText: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  weekCardList: {
    gap: 12,
  },
  programmingWeekSurface: {
    borderRadius: SLRadius.lg,
    paddingBottom: 1,
  },
  programmingWeekSurfaceExpanded: {
    paddingBottom: 14,
  },
  weekCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
  },
  weekCardHeaderMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekCardTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekCardTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  weekCardTitle: {
    color: colors.textStrong,
  },
  weekTag: {
    ...SLTypography.utilityLabel,
    color: colors.amber,
    borderWidth: 1,
    borderColor: 'rgba(204, 164, 74, 0.28)',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  weekCardRange: {
    ...SLTypography.body,
    color: colors.muted,
  },
  weekCardSummary: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  weekCardHeaderControls: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  weekActionsButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 3,
  },
  weekActionsText: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  weekExpandButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekObjective: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginHorizontal: 14,
    marginBottom: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 12,
  },
  weekObjectiveIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  weekObjectiveCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  weekObjectiveLabel: {
    ...SLTypography.utilityLabel,
    color: colors.amber,
  },
  weekObjectiveText: {
    ...SLTypography.bodyStrong,
    color: colors.textStrong,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 5,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  weekStripDay: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  weekStripDaySelected: {
    backgroundColor: 'rgba(204, 164, 74, 0.12)',
    borderColor: 'rgba(204, 164, 74, 0.72)',
  },
  weekStripLabel: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  weekStripDot: {
    minWidth: 8,
    height: 8,
    borderRadius: SLRadius.sm,
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
    color: SLColors.textInverted,
  },
  weekStripDayNumber: {
    fontFamily: SLFontFamilies.mono,
    fontSize: 13,
    lineHeight: 16,
    color: colors.subtle,
  },
  daySessionList: {
    marginHorizontal: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  programmingSessionRow: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 11,
    paddingRight: 3,
    backgroundColor: 'transparent',
  },
  programmingSessionRowPressed: {
    backgroundColor: 'rgba(166, 118, 255, 0.055)',
  },
  programmingSessionMarker: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
  },
  programmingSessionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  programmingSessionTitle: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.textStrong,
  },
  programmingSessionStatusColumn: {
    width: 82,
    flexShrink: 0,
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  sessionStatusLabel: {
    ...SLTypography.utilityLabel,
    width: '100%',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  programmingSessionSummary: {
    ...SLTypography.body,
    color: colors.muted,
  },
  programmingSessionDate: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  sessionSwipeActions: {
    width: SESSION_SWIPE_ACTIONS_WIDTH,
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  sessionSwipeAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(111, 45, 184, 0.72)',
  },
  sessionSwipeActionPressed: {
    backgroundColor: 'rgba(143, 79, 218, 0.82)',
  },
  sessionSwipeAthViewAction: {
    backgroundColor: 'rgba(77, 68, 96, 0.88)',
  },
  sessionSwipeAthViewActionPressed: {
    backgroundColor: 'rgba(101, 88, 126, 0.94)',
  },
  sessionSwipeActionText: {
    ...SLTypography.utilityLabel,
    color: colors.textStrong,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 14,
  },
  dayEmptyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dayEmptyTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  addSessionButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    backgroundColor: colors.violetSoft,
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
  },
  weekAddSessionButton: {
    alignSelf: 'stretch',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 14,
  },
  addSessionButtonText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  sessionAddSheet: {
    maxHeight: '88%',
    backgroundColor: 'rgba(18, 14, 22, 0.99)',
    borderTopWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14,
    ...SLShadows.shadowSheet,
  },
  sessionAddChoiceList: {
    gap: 9,
  },
  sessionAddChoice: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(8, 8, 8, 0.28)',
    borderRadius: SLRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  sessionAddChoiceIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
    backgroundColor: colors.violetSoft,
  },
  sessionAddBack: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  sessionAddBackText: {
    ...SLTypography.label,
    color: colors.violet,
  },
  sessionAddList: {
    maxHeight: 520,
  },
  sessionAddListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  sessionAddOption: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(8, 8, 8, 0.22)',
    borderRadius: SLRadius.lg,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  sessionAddOptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sessionAddOptionTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionAddOptionMeta: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  blockZone: {
    position: 'relative',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.20)',
    backgroundColor: 'rgba(9, 14, 28, 0.68)',
    borderRadius: SLRadius.md,
    overflow: 'hidden',
    ...SLShadows.card,
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
    fontSize: SLTypography.label.fontSize,
    lineHeight: 17,
    color: colors.violet,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  blockName: {
    color: colors.textStrong,
  },
  blockMetaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  blockMeta: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 23,
    color: colors.muted,
  },
  blockDot: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 22,
    color: colors.violet,
  },
  blockWeekText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 23,
    color: colors.violet,
  },
  blockDateRange: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: SLTypography.cardTitle.fontSize,
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
    borderRadius: SLRadius.pill,
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
    borderRadius: SLRadius.pill,
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
    fontSize: SLTypography.micro.fontSize,
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
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(8, 8, 12, 0.22)',
    padding: 10,
  },
  positionMetaLabel: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 16,
    color: colors.muted,
  },
  positionMetaValue: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  positionWeekValue: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 22,
    color: colors.green,
  },
  positionPrimarySmall: {
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
    borderRadius: SLRadius.pill,
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
    borderRadius: SLRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  accessZone: {
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(9, 14, 28, 0.52)',
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.xs,
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
    borderRadius: SLRadius.xs,
  },
  contextButtonText: {
    ...SLTypography.label,
    color: SLColors.danger,
  },
  launchStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  weekDayToday: {
    borderColor: 'rgba(167, 139, 250, 0.82)',
    backgroundColor: 'rgba(167, 139, 250, 0.14)',
    ...SLShadows.raised,
  },
  weekDayTraining: {
    borderColor: 'rgba(214, 167, 94, 0.20)',
  },
  weekLabel: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.caption.fontSize,
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
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 22,
    color: colors.textStrong,
    textAlign: 'center',
  },
  weekStatusIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.pill,
    borderWidth: 1,
  },
  weekStatus: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.micro.fontSize,
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
    borderRadius: SLRadius.md,
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
    borderRadius: SLRadius.pill,
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
    borderRadius: SLRadius.xs,
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
    fontSize: SLTypography.rowTitle.fontSize,
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
  actionPopoverScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
    flex: 1,
  },
  actionPopover: {
    backgroundColor: 'rgba(18, 14, 22, 0.985)',
    borderColor: 'rgba(167, 139, 250, 0.28)',
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    maxWidth: 372,
    overflow: 'hidden',
    position: 'absolute',
    right: 14,
    shadowColor: SLColors.accentViolet,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    width: '88%',
  },
  actionPopoverHeader: {
    alignItems: 'flex-start',
    borderBottomColor: 'rgba(167, 139, 250, 0.16)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionPopoverContent: {
    padding: 12,
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
    ...SLShadows.shadowSheet,
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
    fontSize: SLTypography.body.fontSize,
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
    borderRadius: SLRadius.md,
  },
  actionGroupList: {
    gap: 13,
  },
  actionGroup: {
    gap: 7,
  },
  actionGroupTitle: {
    color: colors.violet,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0,
    fontFamily: SLFontFamilies.sansBold,
  },
  weekActionRows: {
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    borderRadius: SLRadius.lg,
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
    color: SLColors.danger,
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
    fontSize: SLTypography.cardTitle.fontSize,
  },
  weekActionTextArea: {
    minHeight: 116,
    paddingTop: 12,
    paddingBottom: 12,
  },
  weekActionFieldHint: {
    ...SLTypography.caption,
    color: colors.subtle,
    textAlign: 'right',
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
    color: SLColors.accentViolet,
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
    color: SLColors.danger,
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
  programActionHeading: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  programActionSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: SLRadius.radiusSheet,
    borderTopRightRadius: SLRadius.radiusSheet,
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(10, 9, 13, 0.995)',
  },
  programActionSheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(222, 214, 232, 0.34)',
    marginBottom: 6,
  },
  programActionEyebrow: {
    ...SLTypography.label,
    color: colors.violet,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  programActionList: {
    maxHeight: 520,
  },
  programActionListContent: {
    gap: 12,
    paddingBottom: 8,
  },
  programActionLoader: {
    paddingVertical: 24,
  },
  programCreateButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    borderRadius: SLRadius.radiusRow,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  programCreateIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.radiusControl,
    backgroundColor: 'rgba(167, 139, 250, 0.14)',
  },
  programCreateButtonText: {
    ...SLTypography.body,
    color: colors.textStrong,
    fontFamily: SLFontFamilies.sansBold,
    flex: 1,
  },
  programActionCard: {
    gap: 14,
    padding: 15,
    borderRadius: SLRadius.radiusCard,
  },
  programActionCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  programActionCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  programActionCardTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
    fontFamily: SLFontFamilies.sansBold,
    lineHeight: 23,
  },
  programActionCardMeta: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  programStatusBadge: {
    ...SLTypography.caption,
    color: colors.violet,
    textTransform: 'capitalize',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.26)',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  programActiveBadge: {
    color: colors.amber,
    borderColor: 'rgba(222, 198, 166, 0.34)',
    backgroundColor: 'rgba(222, 198, 166, 0.10)',
  },
  programArchivedBadge: {
    color: colors.subtle,
    borderColor: 'rgba(142, 134, 151, 0.24)',
    backgroundColor: 'rgba(142, 134, 151, 0.08)',
  },
  programActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(222, 214, 232, 0.10)',
    paddingTop: 12,
  },
  programCardAction: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: SLRadius.pill,
    paddingHorizontal: 13,
  },
  programCardActionEdit: {
    borderColor: 'rgba(167, 139, 250, 0.28)',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
  },
  programCardActionArchive: {
    borderColor: 'rgba(222, 198, 166, 0.24)',
    backgroundColor: 'rgba(222, 198, 166, 0.07)',
  },
  programCardActionDelete: {
    borderColor: 'rgba(248, 113, 113, 0.22)',
    backgroundColor: 'rgba(127, 29, 29, 0.10)',
  },
  programCardActionText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  programActionArchiveText: {
    color: colors.amber,
  },
  programActionDangerText: {
    color: colors.red,
  },
  programConfirmationBody: {
    gap: 12,
  },
  programConfirmationCopy: {
    ...SLTypography.body,
    color: colors.muted,
  },
  programDestructiveSubmit: {
    minHeight: 46,
    justifyContent: 'center',
    backgroundColor: 'rgba(127, 29, 29, 0.72)',
    paddingHorizontal: 18,
  },
  pressed: {
    opacity: 0.72,
  },
});
