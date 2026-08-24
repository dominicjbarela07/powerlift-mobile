import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { MuscleMap } from '@/components/anatomy/MuscleMap';
import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { normalizeDisplayWeightUnit } from '@/lib/display-units';
import { equipmentPresentationLabel } from '@/lib/equipment-presentation';
import {
  mapCoachSessionEditorPayload,
} from '@/lib/coach-session-editor';
import { SLColors, SLControlSize, SLFontFamilies, SLLayout, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
import {
  SessionEditingWorkspace,
  type CalculatedLoadRequest,
  type CalculatedLoadResult,
  type SessionMovementItem,
  type SessionWorkspaceSavePlan,
} from '@/components/coach-mobile/SessionEditingWorkspace';
import {
  CompletedSessionRecap,
  type CompletedRecapImpactSummary,
  type CompletedSessionRecapPayload,
} from '@/components/coach-mobile/CompletedSessionRecap';
import { SL_TAB_ROW_CONTROL } from '@/components/navigation/sl-tab-row-control';
import {
  accessoryRegionalArtworkAsset,
  type AccessoryRegionalArtworkKey,
} from '@/lib/accessory-muscle-region-assets';
import { accessoryPickerArtwork } from '@/lib/accessory-picker-artwork';
import {
  movementHistorySheetRoute,
  resolveMovementHistoryLaunchForItem,
  resolveMovementHistoryLaunchFromMeasurement,
} from '@/lib/movement-history-launch';
import {
  GovernedAccessoryPickerModal,
  type GovernedAccessoryIdentity,
} from '@/components/movement/GovernedAccessoryPickerModal';

type PlannedSet = {
  set_index?: number | null;
  reps?: number | null;
  rpe_target?: number | null;
  pct?: number | null;
  manual_target_kg?: number | null;
  manual_pm_kg?: number | null;
};

type WorkoutItem = {
  id: number;
  parent_item_id?: number | null;
  lift?: string | null;
  variant?: string | null;
  designation?: string | null;
  movement?: string | null;
  original_movement?: string | null;
  selected_sub_movement?: string | null;
  sets?: number | null;
  reps?: number | null;
  reps_text?: string | null;
  mode?: string | null;
  rpe_target?: number | null;
  pct?: number | null;
  rir_target?: number | null;
  target_low_kg?: number | null;
  target_high_kg?: number | null;
  baseline_low_kg?: number | null;
  baseline_high_kg?: number | null;
  coach_prescribed_low_kg?: number | null;
  coach_prescribed_high_kg?: number | null;
  notes?: string | null;
  superset_group?: string | null;
  superset_pos?: number | null;
  approved_subs?: string[];
  approved_sub_identities?: Array<{
    movement?: string | null;
    movement_definition_id?: number | null;
    movement_identity?: {
      id?: number | null;
      display_name?: string | null;
    } | null;
  }>;
  planned_sets?: PlannedSet[];
  movement_identity?: {
    id?: number | null;
    display_name?: string | null;
    primary_muscle_group?: string | null;
    secondary_muscle_groups?: string[] | null;
    execution_family?: string | null;
    ownership_scope?: string | null;
    library_scope?: string | null;
  } | null;
  core_movement?: {
    id?: number | null;
    key?: string | null;
    display_name?: string | null;
    family?: string | null;
    kind?: string | null;
    loading_implementation?: string | null;
  } | null;
  performed_core_movement?: WorkoutItem['core_movement'];
  performed_movement_identity?: SessionMovementItem['movement_identity'];
  performed_canonical_movement_identity?: SessionMovementItem['movement_identity'];
  legacy?: {
    state?: 'canonical' | 'legacy_unresolved' | 'legacy_resolved' | string;
    original_text?: string | null;
    normalized_key?: string | null;
    resolution_id?: number | null;
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: SessionMovementItem['movement_identity'];
    indicator?: string | null;
    history_caveat?: string | null;
    mapping?: {
      id?: number | null;
      revision?: number | null;
      movement_definition_id?: number | null;
      movement_name?: string | null;
      status?: string | null;
    } | null;
  } | null;
};

type AccessoryGroup = {
  group?: string | null;
  items?: WorkoutItem[];
};

type WorkoutPayload = {
  ok?: boolean;
  error?: string | null;
  workout?: {
    id: number;
    date?: string | null;
    label?: string | null;
    status?: string | null;
    raw_status?: string | null;
    training_block_id?: number | null;
    program_id?: number | null;
    programming_notes?: string | null;
    scheduled_timezone?: string | null;
    estimated_duration_minutes?: number | null;
    estimated_duration_low_minutes?: number | null;
    estimated_duration_high_minutes?: number | null;
    workspace_capabilities?: WorkspaceCapabilities | null;
    muscle_focus?: {
      primary?: { muscle_id: string; score?: number | null }[];
      secondary?: { muscle_id: string; score?: number | null }[];
      source?: string | null;
    } | null;
    core_items?: WorkoutItem[];
    accessory_groups?: AccessoryGroup[];
    completed_recap?: CompletedSessionRecapPayload | null;
    impact_summary?: CompletedRecapImpactSummary | null;
  } | null;
  athlete?: {
    id?: number | null;
    name?: string | null;
    timezone?: string | null;
    preferred_units?: string | null;
    sex?: string | null;
    anatomy_display_preference?: string | null;
    avatar_url?: string | null;
    avatar_uploaded_at?: string | null;
  } | null;
  coach?: {
    id?: number | null;
    name?: string | null;
    avatar_url?: string | null;
    avatar_uploaded_at?: string | null;
  } | null;
};

type WorkspaceCapabilities = {
  editable?: boolean;
  locked_reason?: string | null;
  can_assign?: boolean;
  can_revert_to_draft?: boolean;
  can_delete?: boolean;
  can_move?: boolean;
  can_copy?: boolean;
  can_save_template?: boolean;
  can_rename?: boolean;
  can_edit_session_notes?: boolean;
  can_add_movement?: boolean;
  can_edit_movement?: boolean;
  can_remove_movement?: boolean;
  can_reorder?: boolean;
  can_open_athlete_view?: boolean;
  assign_blocked_reason?: string | null;
};

type RosterAthlete = {
  id: number;
  name?: string | null;
  avatar_url?: string | null;
  avatar_uploaded_at?: string | null;
};

type MovementPreset = {
  id?: number | null;
  core_movement_id?: number | null;
  name?: string | null;
  display_name?: string | null;
  lift?: string | null;
  category?: string | null;
  category_key?: string | null;
  family?: string | null;
  family_display_name?: string | null;
  type?: string | null;
  loading_behavior?: string | null;
  equipment_type?: string | null;
  loading_implementation?: string | null;
  load_convention?: string | null;
  measurement_type?: string | null;
  sidedness?: string | null;
  ownership_scope?: string | null;
  identity_status?: string | null;
  library_scope?: 'canonical' | 'my_movement' | string | null;
  can_manage?: boolean | null;
  can_restore?: boolean | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[] | null;
  execution_family?: string | null;
  requires_equipment_configuration?: boolean | null;
  custom_notes?: string | null;
  aliases?: string[] | null;
  is_favorite?: boolean | null;
  last_used_on?: string | null;
  recent_session_count?: number | null;
};

type MovementSimilarityMatch = {
  tier: 'EXACT' | 'ALIAS_MATCH' | 'EQUIPMENT_IMPLEMENTATION_MATCH' | 'STRONG_SIMILARITY' | 'RELATED';
  score?: number | null;
  reasons?: string[];
  can_manage?: boolean;
  movement_definition: MovementPreset;
};

type MovementPresetGroup = {
  name: string;
  key: string;
  movements?: (MovementPreset | string)[];
};

type MovementPresetPayload = {
  ok?: boolean;
  training_lifts?: {
    categories?: MovementPresetGroup[];
  };
  accessories?: {
    categories?: MovementPresetGroup[];
    definitions?: MovementPreset[];
  };
};

type MovementSearchResultGroup = {
  items: MovementPreset[];
  total_count: number;
  next_cursor: string | null;
};

type MovementSearchResultGroups = {
  selected_muscle_group: string;
  primary: MovementSearchResultGroup;
  secondary: MovementSearchResultGroup;
};

type MovementAuthoringOptions = {
  muscle_groups: { key: string; label: string; body_region?: string; artwork_url?: string }[];
  execution_families: { key: string; label: string; requires_equipment_configuration?: boolean }[];
  regional_groups?: AccessoryPickerRegion[];
};

type EditKind = 'core' | 'accessory';
type WorkspaceSection = 'core' | 'accessories';
type SessionActionKey = 'assign' | 'revert' | 'copy' | 'template' | 'move' | 'delete';
type CalendarAction = 'copy' | 'move';
type TrainingLiftScheme = 'STRAIGHT' | 'TOP_BACKDOWN' | 'FULL_CUSTOM';
type TrainingLiftMode = 'RPE' | 'PCT';

type TrainingLiftEditorMode = 'edit' | 'add';

type TrainingLiftEditorState = {
  mode: TrainingLiftEditorMode;
  item?: WorkoutItem | null;
  setup: TrainingLiftSetup;
  initialSetup: TrainingLiftSetup;
};

type AccessoryEditorMode = 'edit' | 'add';

type AccessoryEditorState = {
  mode: AccessoryEditorMode;
  item?: WorkoutItem | null;
  setup: AccessorySetup;
  initialSetup: AccessorySetup;
};

type ReorderEditorState = {
  coreIds: number[];
  accessoryIds: number[];
};

type TrainingLiftSetup = {
  movement: string;
  coreMovementId: number | null;
  family: string;
  lift: string;
  designation: string;
  scheme: TrainingLiftScheme;
  mode: TrainingLiftMode;
  notes: string;
  customMovement: string;
  targetLow: string;
  targetHigh: string;
};

type AccessorySetup = {
  movement: string;
  movementDefinitionId: number | null;
  ownershipScope: string;
  libraryScope: string;
  family: string;
  notes: string;
  customMovement: string;
  supersetGroup: string;
  supersetPosition: string;
  equipmentType: string;
  loadingImplementation: string;
  loadConvention: string;
  measurementType: string;
  sidedness: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  executionFamily: string;
  customNotes: string;
};

const ACCESSORY_MUSCLE_GROUPS = [
  ['chest', 'Chest'],
  ['front_delts', 'Front Delts'],
  ['side_delts', 'Side Delts'],
  ['rear_delts', 'Rear Delts'],
  ['lats', 'Lats'],
  ['upper_back', 'Upper Back'],
  ['traps', 'Traps'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['forearms', 'Forearms'],
  ['quads', 'Quads'],
  ['hamstrings', 'Hamstrings'],
  ['glutes', 'Glutes'],
  ['adductors', 'Adductors'],
  ['abductors', 'Abductors'],
  ['calves', 'Calves'],
  ['abs', 'Abs'],
  ['obliques', 'Obliques'],
  ['lower_back', 'Lower Back'],
  ['serratus', 'Serratus'],
  ['hip_flexors', 'Hip Flexors'],
  ['neck', 'Neck'],
] as const;

const ACCESSORY_EXECUTION_FAMILIES = [
  ['FREE_WEIGHT', 'Free Weight'],
  ['MACHINE', 'Machine'],
  ['CABLE', 'Cable'],
  ['BODYWEIGHT', 'Bodyweight'],
  ['BAND', 'Band'],
  ['OTHER_PORTABLE', 'Other Portable'],
] as const;

type AccessoryPickerRegion = Readonly<{
  key: string;
  label: string;
  artwork: AccessoryRegionalArtworkKey;
  muscles: readonly string[];
}>;

const ACCESSORY_PICKER_REGIONS = [
  { key: 'chest', label: 'Chest', artwork: 'chest', muscles: ['chest', 'serratus'] },
  { key: 'back', label: 'Back', artwork: 'back_region', muscles: ['lats', 'upper_back', 'traps', 'lower_back'] },
  { key: 'shoulders', label: 'Shoulders', artwork: 'side_delts', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { key: 'arms', label: 'Arms', artwork: 'arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', label: 'Legs', artwork: 'quads', muscles: ['quads', 'hamstrings', 'adductors', 'abductors', 'calves'] },
  { key: 'glutes_hips', label: 'Glutes / Hips', artwork: 'glutes', muscles: ['glutes', 'hip_flexors'] },
  { key: 'core', label: 'Core', artwork: 'core', muscles: ['abs', 'obliques'] },
  { key: 'other', label: 'Other', artwork: 'neck', muscles: ['neck'] },
] as const satisfies readonly AccessoryPickerRegion[];

type AccessoryPickerStep =
  | 'discovery'
  | 'targets'
  | 'results'
  | 'detail'
  | 'review'
  | 'success'
  | 'custom-name'
  | 'custom-primary'
  | 'custom-secondary'
  | 'custom-execution'
  | 'custom-review'
  | 'custom-created';
type AccessoryPickerResultMode = 'all' | 'favorites' | 'recent' | 'custom';

const CUSTOM_MOVEMENT_STEPS: readonly AccessoryPickerStep[] = [
  'custom-name',
  'custom-primary',
  'custom-secondary',
  'custom-execution',
  'custom-review',
];

const CUSTOM_EXECUTION_PRESENTATION = {
  FREE_WEIGHT: { description: 'Barbells, dumbbells, and free implements.', icon: 'barbell-outline' },
  MACHINE: { description: 'Selectorized and plate-loaded machines.', icon: 'fitness-outline' },
  CABLE: { description: 'Cable stack and pulley movements.', icon: 'git-branch-outline' },
  BODYWEIGHT: { description: 'Performed using bodyweight only.', icon: 'body-outline' },
  BAND: { description: 'Resistance-band movements.', icon: 'remove-outline' },
  OTHER_PORTABLE: { description: 'Landmine, kettlebell, and specialty methods.', icon: 'options-outline' },
} as const;

const KG_PER_LB = 0.45359237;
const WHEEL_ITEM_WIDTH = 64;
const REORDER_ROW_HEIGHT = 78;
const REORDER_ROW_GAP = 10;
const REORDER_ROW_STEP = REORDER_ROW_HEIGHT + REORDER_ROW_GAP;

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
  red: SLColors.railDanger,
};

export type MobileSessionWorkspaceContentProps = Readonly<{
  workoutId?: number | string | null;
  athleteId?: number | string | null;
  programmingBlockId?: number | string | null;
  programmingWeek?: number | string | null;
  programmingDay?: string | null;
  section?: string | null;
  embedded?: boolean;
  onClose?: () => void;
  registerDismissRequest?: (handler: (() => void) | null) => void;
}>;

export default function MobileSessionWorkspaceScreen() {
  return <MobileSessionWorkspaceContent />;
}

export function MobileSessionWorkspaceContent(props: MobileSessionWorkspaceContentProps = {}) {
  const router = useRouter();
  const { user, authReady } = useAuth();
  const params = useLocalSearchParams<{
    workoutId?: string | string[];
    athleteId?: string | string[];
    programmingBlockId?: string | string[];
    programmingWeek?: string | string[];
    programmingDay?: string | string[];
    section?: string | string[];
  }>();
  const workoutId = props.workoutId == null ? firstParam(params.workoutId) : String(props.workoutId);
  const programmingAthleteId = props.athleteId == null ? firstParam(params.athleteId) : String(props.athleteId);
  const programmingBlockId = props.programmingBlockId == null ? firstParam(params.programmingBlockId) : String(props.programmingBlockId);
  const programmingWeek = props.programmingWeek == null ? firstParam(params.programmingWeek) : String(props.programmingWeek);
  const programmingDay = props.programmingDay == null ? firstParam(params.programmingDay) : String(props.programmingDay);
  const requestedSection = props.section == null ? firstParam(params.section) : String(props.section);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<WorkoutPayload | null>(null);
  const activeSection: WorkspaceSection = requestedSection === 'accessories' ? 'accessories' : 'core';
  const [pendingAction, setPendingAction] = useState<SessionActionKey | null>(null);
  const [calendarAction, setCalendarAction] = useState<CalendarAction | null>(null);
  const [trainingLiftEditor, setTrainingLiftEditor] = useState<TrainingLiftEditorState | null>(null);
  const [accessoryEditor, setAccessoryEditor] = useState<AccessoryEditorState | null>(null);
  const [movementGroups, setMovementGroups] = useState<MovementPresetGroup[]>([]);
  const [accessoryGroups, setAccessoryGroups] = useState<MovementPresetGroup[]>([]);
  const [movementGroupsLoading, setMovementGroupsLoading] = useState(false);
  const [trainingLiftSaving, setTrainingLiftSaving] = useState(false);
  const [accessorySaving, setAccessorySaving] = useState(false);
  const [reorderEditor, setReorderEditor] = useState<ReorderEditorState | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [roster, setRoster] = useState<RosterAthlete[]>([]);
  const [workspaceDisplayUnit, setWorkspaceDisplayUnit] = useState<'kg' | 'lb'>(() => normalizeDisplayWeightUnit(user?.preferred_units));
  const hasLoadedSessionRef = useRef(false);
  const loadRequestRevisionRef = useRef(0);
  const loadedWorkoutIdRef = useRef<string | null>(null);
  const nextDraftMovementIdRef = useRef(-1);
  const addCoreCompletionRef = useRef<((item: SessionMovementItem) => void) | null>(null);
  const addAccessoryCompletionRef = useRef<((item: SessionMovementItem) => void) | null>(null);
  const changeAccessoryCompletionRef = useRef<((item: SessionMovementItem) => void) | null>(null);
  const reorderCompletionRef = useRef<((order: ReorderEditorState) => void) | null>(null);
  const loadedStatus = String(payload?.workout?.raw_status || payload?.workout?.status || '').trim().toLowerCase();
  const loadedCompletedSession = ['completed', 'logged', 'done'].includes(loadedStatus);
  const redirectingToLogger = !props.embedded && authReady && user?.role !== 'coach' && !!payload && !loadedCompletedSession;

  const loadSession = useCallback(async (silent?: boolean) => {
    if (!workoutId) {
      setError('Missing session id.');
      setLoading(false);
      return;
    }
    const sessionChanged = loadedWorkoutIdRef.current !== workoutId;
    if (sessionChanged) {
      loadedWorkoutIdRef.current = workoutId;
      hasLoadedSessionRef.current = false;
      setPayload(null);
      setTrainingLiftEditor(null);
      setAccessoryEditor(null);
      setReorderEditor(null);
      setCalendarAction(null);
      addCoreCompletionRef.current = null;
      addAccessoryCompletionRef.current = null;
      changeAccessoryCompletionRef.current = null;
      reorderCompletionRef.current = null;
    }
    const requestRevision = ++loadRequestRevisionRef.current;
    const shouldRefreshSilently = Boolean(silent && !sessionChanged);
    if (shouldRefreshSilently) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const resp = await fetchJson<WorkoutPayload>(`/workouts/mobile/${workoutId}`, { method: 'GET' });
      const json = resp.json || {};
      if (!resp.ok || !json.ok || !json.workout) {
        throw new Error(json.error || `HTTP ${resp.status}`);
      }
      if (requestRevision !== loadRequestRevisionRef.current) return;
      setPayload(mapCoachSessionEditorPayload(json));
      hasLoadedSessionRef.current = true;
    } catch (err: any) {
      if (requestRevision !== loadRequestRevisionRef.current) return;
      if (!shouldRefreshSilently) {
        setPayload(null);
        setError(err?.message || 'Session workspace could not load.');
      }
    } finally {
      if (requestRevision !== loadRequestRevisionRef.current) return;
      if (shouldRefreshSilently) setRefreshing(false);
      else setLoading(false);
    }
  }, [workoutId]);

  useFocusEffect(
    useCallback(() => {
      void loadSession(hasLoadedSessionRef.current);
    }, [loadSession])
  );

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setWorkspaceDisplayUnit(normalizeDisplayWeightUnit(user?.preferred_units));
  }, [user?.preferred_units]);

  useEffect(() => {
    if (!authReady || user?.role !== 'coach') return;
    let active = true;
    void fetchJson<any>('/coach/mobile/roster', { method: 'GET' })
      .then((response) => {
        const json = response.json || {};
        if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
        if (active) setRoster(Array.isArray(json.athletes) ? json.athletes : []);
      })
      .catch(() => {
        if (active) setRoster([]);
      });
    return () => { active = false; };
  }, [authReady, user?.role]);

  useEffect(() => {
    let active = true;
    setMovementGroupsLoading(true);
    void fetchJson<MovementPresetPayload>('/workouts/mobile/movement_presets?include_accessories=0', { method: 'GET' })
      .then((resp) => {
        const json = resp.json || {};
        if (!active) return;
        setMovementGroups(Array.isArray(json.training_lifts?.categories) ? json.training_lifts.categories : []);
        setAccessoryGroups([]);
      })
      .catch(() => {
        if (!active) return;
        setMovementGroups([]);
        setAccessoryGroups([]);
      })
      .finally(() => {
        if (active) setMovementGroupsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [payload?.athlete?.id]);

  useEffect(() => {
    if (!redirectingToLogger || !workoutId) return;
    router.replace({
      pathname: '/workout/[workoutId]',
      params: { workoutId: String(workoutId) },
    });
  }, [redirectingToLogger, router, workoutId]);

  const workout = payload?.workout || null;
  const workspaceCapabilities = workout?.workspace_capabilities || {};
  const workspaceEditable = workspaceCapabilities.editable !== false;
  const coreItems = useMemo(() => workout?.core_items || [], [workout?.core_items]);
  const accessoryItems = useMemo(
    () => (workout?.accessory_groups || []).flatMap((group) => group.items || []),
    [workout?.accessory_groups]
  );
  const workspaceFocus = useMemo(() => {
    const focus = workout?.muscle_focus;
    return {
      primary: (focus?.primary || []).map((row) => row.muscle_id).filter(Boolean),
      secondary: (focus?.secondary || []).map((row) => row.muscle_id).filter(Boolean),
    };
  }, [workout?.muscle_focus]);

  const status = humanStatus(workout?.raw_status || workout?.status);
  const title = sessionTitle(workout?.label);
  const context = sessionContext(payload?.athlete?.name, workout?.label, workout?.date);

  const closeToProgrammingHome = () => {
    if (props.onClose) {
      props.onClose();
      return;
    }
    router.replace({
      pathname: '/(tabs)/workout' as any,
      params: {
        ...(programmingAthleteId ? { athleteId: programmingAthleteId } : {}),
        ...(programmingBlockId ? { programmingBlockId } : {}),
        ...(programmingWeek ? { programmingWeek } : {}),
        ...(programmingDay ? { programmingDay } : {}),
      },
    });
  };

  const openAthleteView = () => {
    if (!workout?.id) return;
    router.push({
      pathname: '/workout/[workoutId]',
      params: {
        workoutId: String(workout.id),
        athleteView: 'coach-preview',
        returnSection: activeSection,
        ...(programmingAthleteId ? { coachAthleteId: programmingAthleteId } : {}),
        ...(programmingBlockId ? { coachProgrammingBlockId: programmingBlockId } : {}),
        ...(programmingWeek ? { coachProgrammingWeek: programmingWeek } : {}),
        ...(programmingDay ? { coachProgrammingDay: programmingDay } : {}),
      },
    });
  };

  const openAddCoreLiftEditor = (draftDisplayUnit: 'lb' | 'kg', onAdd: (item: SessionMovementItem) => void) => {
    setWorkspaceDisplayUnit(draftDisplayUnit);
    addCoreCompletionRef.current = onAdd;
    const setup = defaultTrainingLiftSetup(coreItems.length, movementGroups);
    setTrainingLiftEditor({
      mode: 'add',
      item: null,
      setup,
      initialSetup: setup,
    });
  };

  const openAddAccessoryEditor = (onAdd: (item: SessionMovementItem) => void) => {
    changeAccessoryCompletionRef.current = null;
    addAccessoryCompletionRef.current = onAdd;
    const defaults = defaultAccessorySetup(accessoryGroups);
    const setup: AccessorySetup = {
      ...defaults,
      movement: '',
      movementDefinitionId: null,
      ownershipScope: '',
      libraryScope: '',
      primaryMuscleGroup: '',
      secondaryMuscleGroups: [],
      executionFamily: '',
      customMovement: '',
      customNotes: '',
    };
    setAccessoryEditor({
      mode: 'add',
      item: null,
      setup,
      initialSetup: setup,
    });
  };

  const openChangeAccessoryEditor = (item: SessionMovementItem, onChange: (item: SessionMovementItem) => void) => {
    addAccessoryCompletionRef.current = null;
    changeAccessoryCompletionRef.current = onChange;
    const identity = item.movement_identity || null;
    const setup: AccessorySetup = {
      ...defaultAccessorySetup(accessoryGroups),
      movement: String(identity?.display_name || item.movement || item.original_movement || ''),
      movementDefinitionId: identity?.id || null,
      ownershipScope: String(identity?.ownership_scope || ''),
      libraryScope: String(identity?.library_scope || ''),
      notes: String(item.notes || ''),
      supersetGroup: String(item.superset_group || ''),
      supersetPosition: item.superset_pos == null ? '' : String(item.superset_pos),
      primaryMuscleGroup: String(identity?.primary_muscle_group || ''),
      secondaryMuscleGroups: Array.isArray(identity?.secondary_muscle_groups) ? identity.secondary_muscle_groups : [],
      executionFamily: String(identity?.execution_family || ''),
      customMovement: '',
      customNotes: '',
    };
    setAccessoryEditor({
      mode: 'edit',
      item: item as WorkoutItem,
      setup,
      initialSetup: setup,
    });
  };

  const cancelTrainingLiftEditor = () => {
    if (trainingLiftEditor && JSON.stringify(trainingLiftEditor.setup) !== JSON.stringify(trainingLiftEditor.initialSetup)) {
      Alert.alert('Discard movement changes?', 'Your unsaved movement setup changes will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard Changes', style: 'destructive', onPress: () => { addCoreCompletionRef.current = null; setTrainingLiftEditor(null); } },
      ]);
      return;
    }
    addCoreCompletionRef.current = null;
    setTrainingLiftEditor(null);
  };

  const cancelAccessoryEditor = () => {
    if (accessoryEditor && JSON.stringify(accessoryEditor.setup) !== JSON.stringify(accessoryEditor.initialSetup)) {
      Alert.alert('Discard movement changes?', 'Your unsaved accessory setup changes will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard Changes', style: 'destructive', onPress: () => { addAccessoryCompletionRef.current = null; changeAccessoryCompletionRef.current = null; setAccessoryEditor(null); } },
      ]);
      return;
    }
    addAccessoryCompletionRef.current = null;
    changeAccessoryCompletionRef.current = null;
    setAccessoryEditor(null);
  };

  const cancelReorderEditor = () => {
    reorderCompletionRef.current = null;
    setReorderEditor(null);
  };

  const applyTrainingLiftSetup = async (setup: TrainingLiftSetup) => {
    if (!workout?.id || !trainingLiftEditor) return;
    if (trainingLiftEditor.mode === 'add' && addCoreCompletionRef.current) {
      const id = nextDraftMovementIdRef.current--;
      const targetMultiplier = workspaceDisplayUnit === 'lb' ? KG_PER_LB : 1;
      addCoreCompletionRef.current({
        id,
        movement: setup.movement,
        core_movement: setup.coreMovementId ? {
          id: setup.coreMovementId,
          display_name: setup.movement,
          kind: 'variant',
        } : null,
        lift: setup.lift,
        designation: setup.designation,
        variant: setup.scheme === 'TOP_BACKDOWN' ? 'TOP' : setup.scheme === 'FULL_CUSTOM' ? 'FULL_CUSTOM' : 'STRAIGHT',
        mode: setup.mode,
        sets: setup.scheme === 'FULL_CUSTOM' ? 4 : 4,
        reps: 5,
        rpe_target: setup.mode === 'RPE' ? 7 : null,
        pct: setup.mode === 'PCT' ? 70 : null,
        coach_prescribed_low_kg: setup.lift === 'VR' && setup.targetLow ? Number(setup.targetLow) * targetMultiplier : null,
        coach_prescribed_high_kg: setup.lift === 'VR' && setup.targetHigh ? Number(setup.targetHigh) * targetMultiplier : null,
        notes: setup.notes,
        planned_sets: setup.scheme === 'FULL_CUSTOM'
          ? Array.from({ length: 4 }, (_, index) => ({ set_index: index + 1, reps: 5, rpe_target: setup.mode === 'RPE' ? 7 : null, pct: setup.mode === 'PCT' ? 70 : null }))
          : [],
      });
      addCoreCompletionRef.current = null;
      setTrainingLiftEditor(null);
      return;
    }
    try {
      setTrainingLiftSaving(true);
      const isAddMode = trainingLiftEditor.mode === 'add';
      const isCoreVariantSelection = setup.lift === 'VR';
      const endpoint = isAddMode
        ? `/workouts/mobile/${workout.id}/core-lifts`
        : `/workouts/mobile/${workout.id}/items/${trainingLiftEditor.item?.id}/programming`;
      const resp = await fetchJson(endpoint, {
        method: isAddMode ? 'POST' : 'PATCH',
        body: {
          movement: setup.movement,
          core_movement_id: setup.coreMovementId,
          lift: setup.lift,
          designation: setup.designation,
          notes: setup.notes,
          ...(!isCoreVariantSelection ? { scheme: setup.scheme, mode: setup.mode } : {}),
          ...(isCoreVariantSelection ? {
            target_low_lb: String(Number(setup.targetLow) * (workspaceDisplayUnit === 'lb' ? 1 : 1 / KG_PER_LB)),
            target_high_lb: String(Number(setup.targetHigh) * (workspaceDisplayUnit === 'lb' ? 1 : 1 / KG_PER_LB)),
          } : {}),
          ...(!isCoreVariantSelection && setup.scheme === 'FULL_CUSTOM' && String(trainingLiftEditor.item?.variant || '').toUpperCase() !== 'FULL_CUSTOM'
            ? {
                planned_sets: Array.from({ length: 4 }, (_, index) => ({
                  set_index: index + 1,
                  reps: 5,
                  rpe_target: setup.mode === 'RPE' ? 7 : null,
                  pct: setup.mode === 'PCT' ? 70 : null,
                  manual_target_kg: null,
                  manual_pm_kg: 0,
                })),
              }
            : {}),
          ...(isAddMode
            ? {
                sets: 4,
                reps: 5,
                ...(!isCoreVariantSelection ? { rpe_target: 7, pct: 70 } : {}),
              }
            : {}),
        } as any,
      });
      const json: any = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setTrainingLiftEditor(null);
      await loadSession(true);
    } catch (err: any) {
      Alert.alert(
        trainingLiftEditor.mode === 'add' ? 'Could not add core lift' : 'Could not update training lift',
        err?.message || 'Please try again.'
      );
    } finally {
      setTrainingLiftSaving(false);
    }
  };

  const openReorderEditor = (order: ReorderEditorState, onApply: (order: ReorderEditorState) => void) => {
    reorderCompletionRef.current = onApply;
    setReorderEditor({
      coreIds: order.coreIds,
      accessoryIds: order.accessoryIds,
    });
  };

  const applyReorder = async (nextOrder: ReorderEditorState) => {
    if (reorderCompletionRef.current) {
      reorderCompletionRef.current(nextOrder);
      reorderCompletionRef.current = null;
      setReorderEditor(null);
      return;
    }
    if (!workout?.id) return;
    try {
      setReorderSaving(true);
      const resp = await fetchJson(`/workouts/mobile/${workout.id}/items/reorder`, {
        method: 'PATCH',
        body: {
          core_item_ids: nextOrder.coreIds,
          accessory_item_ids: nextOrder.accessoryIds,
        } as any,
      });
      const json: any = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setReorderEditor(null);
      await loadSession(true);
    } catch (err: any) {
      Alert.alert('Could not apply order', err?.message || 'Please try again.');
    } finally {
      setReorderSaving(false);
    }
  };

  const applyAccessorySetup = async (setup: AccessorySetup): Promise<boolean> => {
    if (!workout?.id || !accessoryEditor) return false;
    try {
      setAccessorySaving(true);
      const movementDefinitionId = setup.movementDefinitionId;
      const resolvedMovementName = setup.movement;
      if (!movementDefinitionId) {
        throw new Error('Select a canonical or custom movement before applying changes.');
      }
      const legacy = accessoryEditor.item?.legacy;
      if (
        accessoryEditor.mode === 'edit'
        && accessoryEditor.item?.id
        && Number(accessoryEditor.item.id) > 0
        && legacy?.state === 'legacy_unresolved'
        && legacy.original_text
      ) {
        const previewResponse = await fetchJson<any>('/workouts/mobile/legacy-accessory-resolutions/preview', {
          method: 'POST',
          body: { legacy_label: legacy.original_text } as any,
        });
        const preview: any = previewResponse.json?.preview || {};
        if (!previewResponse.ok || !previewResponse.json?.ok) {
          throw new Error(previewResponse.json?.error || 'Legacy impact could not be loaded.');
        }
        const counts = preview.counts || {};
        const resolutionScope = await new Promise<'cancel' | 'occurrence' | 'mapping'>((resolve) => {
          Alert.alert(
            'Resolve this legacy name?',
            [
              `“${legacy.original_text}” will map to “${resolvedMovementName}” in your coaching workspace.`,
              `${Number(counts.future_draft || 0)} future draft · ${Number(counts.template || 0)} template · ${Number(counts.historical || 0)} historical preserved`,
              'Completed history keeps its original text.',
            ].join('\n\n'),
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
              { text: 'This Session', onPress: () => resolve('occurrence') },
              { text: 'Resolve Once', onPress: () => resolve('mapping') },
            ],
            { cancelable: true, onDismiss: () => resolve('cancel') },
          );
        });
        if (resolutionScope === 'cancel') return false;
        const resolutionResponse = await fetchJson<any>('/workouts/mobile/legacy-accessory-resolutions/resolve', {
          method: 'POST',
          body: {
            legacy_label: legacy.original_text,
            movement_definition_id: movementDefinitionId,
            expected_revision: legacy.mapping?.revision || undefined,
            remember: resolutionScope === 'mapping',
            workout_item_id: accessoryEditor.item.id,
          } as any,
        });
        if (!resolutionResponse.ok || !resolutionResponse.json?.ok) {
          throw new Error(resolutionResponse.json?.error || 'Legacy movement could not be resolved.');
        }
      }
      if (accessoryEditor.mode === 'add' && addAccessoryCompletionRef.current) {
        const id = nextDraftMovementIdRef.current--;
        addAccessoryCompletionRef.current({
          id,
          movement: resolvedMovementName,
          original_movement: resolvedMovementName,
          variant: 'ACC',
          sets: 3,
          reps_text: '10-12',
          rir_target: 2,
          notes: setup.notes,
          superset_group: setup.supersetGroup || null,
          superset_pos: setup.supersetGroup ? Number(setup.supersetPosition || 1) : null,
          movement_identity: movementDefinitionId ? {
            id: movementDefinitionId,
            display_name: resolvedMovementName,
            primary_muscle_group: setup.primaryMuscleGroup,
            secondary_muscle_groups: setup.secondaryMuscleGroups,
            execution_family: setup.executionFamily,
            ownership_scope: setup.ownershipScope,
            library_scope: setup.libraryScope,
          } : null,
        });
        addAccessoryCompletionRef.current = null;
        return true;
      }
      if (accessoryEditor.mode === 'edit' && changeAccessoryCompletionRef.current && accessoryEditor.item) {
        changeAccessoryCompletionRef.current({
          ...(accessoryEditor.item as SessionMovementItem),
          movement: resolvedMovementName,
          original_movement: resolvedMovementName,
          movement_identity: {
            id: movementDefinitionId,
            display_name: resolvedMovementName,
            primary_muscle_group: setup.primaryMuscleGroup,
            secondary_muscle_groups: setup.secondaryMuscleGroups,
            execution_family: setup.executionFamily,
            ownership_scope: setup.ownershipScope,
            library_scope: setup.libraryScope,
          },
          legacy: legacy?.state === 'legacy_unresolved' ? {
            ...legacy,
            state: 'canonical',
            effective_movement_definition_id: movementDefinitionId,
            indicator: null,
            history_caveat: null,
          } : legacy,
        });
        changeAccessoryCompletionRef.current = null;
        return true;
      }
      const body = {
        movement: resolvedMovementName,
        movement_definition_id: movementDefinitionId,
        notes: setup.notes,
        superset_group: setup.supersetGroup || null,
        superset_pos: setup.supersetGroup ? Number(setup.supersetPosition || 1) : null,
        ...(accessoryEditor.mode === 'add'
          ? {
              sets: 3,
              reps_text: '10-12',
              rir_target: 2,
            }
          : {}),
      };
      const endpoint = accessoryEditor.mode === 'add'
        ? `/workouts/mobile/${workout.id}/accessories`
        : `/workouts/mobile/${workout.id}/items/${accessoryEditor.item?.id}/programming`;
      const resp = await fetchJson(endpoint, {
        method: accessoryEditor.mode === 'add' ? 'POST' : 'PATCH',
        body: body as any,
      });
      const json: any = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      await loadSession(true);
      return true;
    } catch (err: any) {
      Alert.alert(
        accessoryEditor.mode === 'add' ? 'Could not add accessory' : 'Could not update accessory',
        err?.message || 'Please try again.'
      );
      return false;
    } finally {
      setAccessorySaving(false);
    }
  };

  const closeAccessoryEditorAfterSuccess = () => {
    addAccessoryCompletionRef.current = null;
    changeAccessoryCompletionRef.current = null;
    setAccessoryEditor(null);
  };

  const createCustomAccessoryDefinition = async (
    setup: AccessorySetup,
    confirmSimilar: boolean,
  ): Promise<MovementPreset | null> => {
    const athleteId = Number(payload?.athlete?.id);
    if (!Number.isFinite(athleteId) || athleteId <= 0) {
      throw new Error('Athlete context is unavailable.');
    }
    const identityBody = {
      athlete_id: athleteId,
      display_name: setup.customMovement.trim(),
      primary_muscle_group: setup.primaryMuscleGroup,
      secondary_muscle_groups: setup.secondaryMuscleGroups,
      execution_family: setup.executionFamily,
      notes: setup.customNotes,
    };
    const response = await fetchJson<any>('/workouts/mobile/movement-definitions', {
      method: 'POST',
      body: { ...identityBody, confirm_similar: confirmSimilar } as any,
    });
    const json = response.json || {};
    const definition: MovementPreset | null = response.ok && json.ok
      ? json.movement_definition
      : json.existing_custom_movement || json.existing_movement || null;
    if (!definition?.id) throw new Error(json.error || `HTTP ${response.status}`);
    setAccessoryGroups((current) => accessoryGroupsWithCanonicalIdentity(current, [definition], 'custom_identity'));
    return definition;
  };

  const runSessionAction = async (
    action: SessionActionKey,
    request: () => Promise<{ message?: string | null }>
  ) => {
    try {
      setPendingAction(action);
      const result = await request();
      if (result.message) Alert.alert('Session updated', result.message);
      await loadSession(true);
    } catch (err: any) {
      Alert.alert('Action failed', err?.message || 'Please try again.');
    } finally {
      setPendingAction(null);
    }
  };

  const revertToDraft = () => {
    if (!workout?.id) return;
    void runSessionAction('revert', async () => {
      const resp = await fetchJson<any>(`/workouts/mobile/${workout.id}/programming-status`, {
        method: 'PATCH',
        body: { status: 'draft' } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      return { message: 'Session reverted to draft.' };
    });
  };

  const assignSession = () => {
    if (!workout?.id) return;
    void runSessionAction('assign', async () => {
      const resp = await fetchJson<any>(`/workouts/mobile/${workout.id}/programming-status`, {
        method: 'PATCH',
        body: { status: 'assigned' } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      return { message: 'Session assigned.' };
    });
  };

  const saveAsTemplate = () => {
    if (!workout?.id) return;
    void runSessionAction('template', async () => {
      const resp = await fetchJson<any>(`/workouts/mobile/${workout.id}/programming-actions`, {
        method: 'POST',
        body: {
          action: 'save_template',
          template_name: workout.label || 'Untitled Session Template',
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      return { message: json.message || 'Session template saved.' };
    });
  };

  const confirmCalendarAction = async (targetDate: string) => {
    if (!workout?.id || !calendarAction) return;
    const action = calendarAction;
    setCalendarAction(null);
    await runSessionAction(action, async () => {
      const resp = await fetchJson<any>(`/workouts/mobile/${workout.id}/programming-actions`, {
        method: 'POST',
        body: {
          action: action === 'copy' ? 'copy_to' : 'move',
          target_date: targetDate,
          label: workout.label || 'Session',
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      return { message: json.message || (action === 'copy' ? 'Session copied.' : 'Session moved.') };
    });
  };

  const deleteSession = () => {
    if (!workout?.id) return;
    Alert.alert(
      'Delete session?',
      'This removes the session from the program.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setPendingAction('delete');
                const resp = await fetchJson<any>(`/workouts/mobile/${workout.id}/delete`, {
                  method: 'POST',
                  body: { confirm: true } as any,
                });
                const json = resp.json || {};
                if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
                ++loadRequestRevisionRef.current;
                hasLoadedSessionRef.current = false;
                setPayload(null);
                setTrainingLiftEditor(null);
                setAccessoryEditor(null);
                setReorderEditor(null);
                setCalendarAction(null);
                addCoreCompletionRef.current = null;
                addAccessoryCompletionRef.current = null;
                changeAccessoryCompletionRef.current = null;
                reorderCompletionRef.current = null;
                closeToProgrammingHome();
              } catch (err: any) {
                Alert.alert('Delete failed', err?.message || 'Please try again.');
              } finally {
                setPendingAction(null);
              }
            })();
          },
        },
      ]
    );
  };

  const saveSessionDraft = async (plan: SessionWorkspaceSavePlan) => {
    if (!workout?.id) return false;
    try {
      const requireOk = async (request: Promise<{ ok: boolean; status: number; json: any }>) => {
        const response = await request;
        const json = response.json || {};
        if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
        return json;
      };

      if (plan.metadataPatch.title !== undefined) {
        await requireOk(fetchJson(`/workouts/mobile/${workout.id}/rename`, {
          method: 'PATCH',
          body: { label: plan.metadataPatch.title } as any,
        }));
      }
      const setupPatch = {
        ...(plan.metadataPatch.athleteId !== undefined ? { athlete_id: plan.metadataPatch.athleteId } : {}),
        ...(plan.metadataPatch.scheduledDate !== undefined ? { date: plan.metadataPatch.scheduledDate } : {}),
      };
      if (Object.keys(setupPatch).length) {
        await requireOk(fetchJson(`/workouts/mobile/${workout.id}/setup`, {
          method: 'PATCH',
          body: setupPatch as any,
        }));
      }
      if (plan.metadataPatch.notes !== undefined) {
        await requireOk(fetchJson(`/workouts/mobile/${workout.id}/programming-notes`, {
          method: 'PATCH',
          body: { programming_notes: plan.metadataPatch.notes } as any,
        }));
      }

      for (const itemId of plan.deletedMovementIds) {
        await requireOk(fetchJson(`/workouts/mobile/${workout.id}/items/${itemId}/programming`, { method: 'DELETE' }));
      }
      for (const movement of plan.movementUpdates) {
        await requireOk(fetchJson(`/workouts/mobile/${workout.id}/items/${movement.item.id}/programming`, {
          method: 'PATCH',
          body: movement.patch as any,
        }));
      }

      const createdIds = new Map<number, number>();
      for (const movement of plan.movementCreates) {
        const endpoint = movement.kind === 'accessory'
          ? `/workouts/mobile/${workout.id}/accessories`
          : `/workouts/mobile/${workout.id}/core-lifts`;
        const json = await requireOk(fetchJson(endpoint, {
          method: 'POST',
          body: movement.patch as any,
        }));
        if (!json.item_id) throw new Error('The server did not return the created movement.');
        createdIds.set(movement.item.id, Number(json.item_id));
      }

      if (plan.orderChanged || plan.movementCreates.length || plan.deletedMovementIds.length) {
        const resolveId = (id: number) => createdIds.get(id) ?? id;
        await requireOk(fetchJson(`/workouts/mobile/${workout.id}/items/reorder`, {
          method: 'PATCH',
          body: {
            core_item_ids: plan.coreOrder.map(resolveId),
            accessory_item_ids: plan.accessoryOrder.map(resolveId),
          } as any,
        }));
      }

      setWorkspaceDisplayUnit(plan.displayUnit);
      await loadSession(true);
      return true;
    } catch (err: any) {
      Alert.alert('Could not save Session', err?.message || 'Your Session edits are still available.');
      return false;
    }
  };

  const calculateMovementLoad = useCallback(async (request: CalculatedLoadRequest): Promise<CalculatedLoadResult> => {
    const athleteId = Number(payload?.athlete?.id);
    const reps = Number(request.reps);
    const intensity = Number(request.intensity);
    if (!athleteId || !request.lift.trim() || !Number.isFinite(intensity) || intensity <= 0) {
      return { lowKg: null, highKg: null, trainingMaxKg: null, note: 'Calculated target unavailable' };
    }
    try {
      const resp = await fetchJson<any>('/workouts/mobile/suggest_range', {
        method: 'POST',
        body: {
          athlete_id: athleteId,
          lift: request.lift,
          mode: request.mode,
          ...(request.mode === 'PCT'
            ? { pct: intensity }
            : { reps: Number.isFinite(reps) && reps > 0 ? reps : null, rpe_target: intensity }),
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) {
        return { lowKg: null, highKg: null, trainingMaxKg: null, note: 'Calculated target unavailable' };
      }
      const finiteOrNull = (value: unknown) => value == null || value === ''
        ? null
        : Number.isFinite(Number(value)) ? Number(value) : null;
      return {
        lowKg: finiteOrNull(json.target_low_kg),
        highKg: finiteOrNull(json.target_high_kg),
        trainingMaxKg: finiteOrNull(json.tm),
        note: String(json.note || '').trim() || undefined,
      };
    } catch {
      return { lowKg: null, highKg: null, trainingMaxKg: null, note: 'Calculated target unavailable' };
    }
  }, [payload?.athlete?.id]);

  if (redirectingToLogger || loading || error || !workout) {
    return (
      <View style={styles.screen}>
        <View style={styles.stateBox}>
          {error ? <Ionicons name="alert-circle-outline" size={24} color={colors.red} /> : <ActivityIndicator color={colors.violet} />}
          <Text style={styles.stateTitle}>
            {redirectingToLogger ? 'Opening Training Session' : error ? 'Workspace unavailable' : 'Loading Session Workspace'}
          </Text>
          {error ? <Text style={styles.stateBody}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  if (loadedCompletedSession && workout.completed_recap) {
    return (
      <>
        {!props.embedded ? <Tabs.Screen options={{ headerShown: false, tabBarStyle: { display: 'none' } }} /> : null}
        <CompletedSessionRecap
          recap={workout.completed_recap}
          impactSummary={workout.impact_summary}
          preferredUnits={user?.preferred_units}
          viewerMode="coach"
          refreshing={refreshing}
          onRefresh={() => { void loadSession(true); }}
          onClose={closeToProgrammingHome}
          onViewCalendar={() => router.push({ pathname: '/(tabs)/coach-calendar', params: { athleteId: String(payload?.athlete?.id || '') } } as any)}
          onOpenProgramming={closeToProgrammingHome}
          onOpenMovementHistory={(movement) => {
            const resolution = resolveMovementHistoryLaunchFromMeasurement({
              athleteId: payload?.athlete?.id,
              movementDefinitionId: movement.measurement?.canonical_identity_id,
              identityType: movement.kind,
              equipmentContextDefinitionId: movement.measurement?.equipment_configuration_identity_id,
            });
            if (!resolution.ok) {
              Alert.alert('History unavailable', resolution.message);
              return;
            }
            router.push(movementHistorySheetRoute(resolution.target) as never);
          }}
        />
      </>
    );
  }

  return (
    <>
      {!props.embedded ? <Tabs.Screen options={{ headerShown: false, tabBarStyle: { display: 'none' } }} /> : null}
      <View style={[styles.screen, styles.programmingWorkspaceStage, props.embedded && styles.embeddedWorkspaceStage]}>
      <View style={styles.programmingWeekContext}>
        {!props.embedded ? <Pressable accessibilityRole="button" accessibilityLabel="Return to Week Lens" onPress={closeToProgrammingHome} style={styles.programmingWeekBack}>
          <Ionicons name="chevron-back" size={18} color={colors.textStrong} />
        </Pressable> : null}
        <View style={styles.programmingWeekContextCopy}>
          <Text style={styles.programmingWeekContextTitle}>Week {programmingWeek || '—'}</Text>
          <Text style={styles.programmingWeekContextMeta}>{programmingDay ? formatContextDate(programmingDay) : context}</Text>
        </View>
        <View style={styles.programmingWeekContextArt}>
          <ProgrammingMuscleRegionArt level="session" primary={workspaceFocus.primary} secondary={workspaceFocus.secondary} style={styles.programmingWeekContextAnatomy} />
        </View>
      </View>
      <View style={styles.programmingWorkspaceSheet}>
        {!props.embedded ? <View style={styles.programmingWorkspaceHandle} /> : null}
        <SessionEditingWorkspace
        title={title}
        context={context}
        status={status}
        athleteId={payload?.athlete?.id || null}
        athleteName={payload?.athlete?.name || null}
        athleteAvatarUrl={payload?.athlete?.avatar_url || null}
        athleteAvatarVersion={payload?.athlete?.avatar_uploaded_at || null}
        scheduledDate={workout.date || null}
        coachName={payload?.coach?.name || null}
        coachAvatarUrl={payload?.coach?.avatar_url || null}
        coachAvatarVersion={payload?.coach?.avatar_uploaded_at || null}
        estimatedDurationMinutes={workout.estimated_duration_minutes ?? null}
        estimatedDurationLowMinutes={workout.estimated_duration_low_minutes ?? null}
        estimatedDurationHighMinutes={workout.estimated_duration_high_minutes ?? null}
        notes={String(workout.programming_notes || '')}
        lockedReason={workspaceCapabilities.locked_reason}
        editable={workspaceEditable}
        capabilities={workspaceCapabilities}
        coreItems={coreItems}
        accessoryItems={accessoryItems}
        refreshing={refreshing}
        pendingMovementId={null}
        reduceMotion={reduceMotion}
        displayUnit={workspaceDisplayUnit}
        athleteOptions={roster.map((athlete) => ({
          id: athlete.id,
          name: String(athlete.name || 'Athlete'),
          avatarUrl: athlete.avatar_url || null,
          avatarVersion: athlete.avatar_uploaded_at || null,
        }))}
        assignmentBlockedReason={workspaceCapabilities.assign_blocked_reason || null}
        sheetPresentation={props.embedded}
        registerDismissRequest={props.registerDismissRequest}
        onRefresh={() => { void loadSession(true); }}
        onCloseWorkspace={closeToProgrammingHome}
        onOpenAthleteView={openAthleteView}
        onOpenReorder={openReorderEditor}
        onAddCore={openAddCoreLiftEditor}
        onAddAccessory={openAddAccessoryEditor}
        onChangeAccessory={openChangeAccessoryEditor}
        onOpenMovementHistory={(item) => {
          const resolution = resolveMovementHistoryLaunchForItem({
            athleteId: payload?.athlete?.id,
            item,
          });
          if (!resolution.ok) {
            if (__DEV__) console.warn('[MovementHistory] launch rejected', resolution.reason, item.id);
            Alert.alert('History unavailable', resolution.message);
            return;
          }
          router.push(movementHistorySheetRoute(resolution.target) as never);
        }}
        onSaveSession={saveSessionDraft}
        onCalculateLoad={calculateMovementLoad}
        renderLifecycleActions={(guard, restricted) => (
          <CompactSessionActions
            status={workout.raw_status || workout.status}
            capabilities={workspaceCapabilities}
            pendingAction={pendingAction}
            onlyDelete={restricted}
            onAssign={() => guard(assignSession)}
            onRevert={() => guard(revertToDraft)}
            onCopy={() => guard(() => setCalendarAction('copy'))}
            onMove={() => guard(() => setCalendarAction('move'))}
            onSaveTemplate={() => guard(saveAsTemplate)}
            onDelete={() => guard(deleteSession)}
          />
        )}
        />
      </View>

      <SessionCalendarModal
        visible={!!calendarAction}
        title={calendarAction === 'copy' ? 'Copy Session To' : 'Move Session'}
        actionLabel={calendarAction === 'copy' ? 'Copy Session' : 'Move Session'}
        initialDate={workout.date || todayIso()}
        busy={pendingAction === calendarAction}
        onCancel={() => setCalendarAction(null)}
        onConfirm={confirmCalendarAction}
      />
      <TrainingLiftEditorModal
        state={trainingLiftEditor}
        groups={movementGroups}
        loadingGroups={movementGroupsLoading}
        saving={trainingLiftSaving}
        displayUnit={workspaceDisplayUnit}
        onChange={(setup) => setTrainingLiftEditor((current) => current ? { ...current, setup } : current)}
        onCancel={cancelTrainingLiftEditor}
        onApply={applyTrainingLiftSetup}
      />
      <GovernedAccessoryPickerModal
        visible={!!accessoryEditor}
        title={accessoryEditor?.mode === 'add' ? 'Add Accessory' : 'Change Accessory'}
        athleteId={payload?.athlete?.id || null}
        currentIdentityId={accessoryEditor?.setup.movementDefinitionId || null}
        canCreateCustom={workspaceEditable && workspaceCapabilities.can_add_movement !== false}
        onCancel={cancelAccessoryEditor}
        onSelect={async (identity: GovernedAccessoryIdentity) => {
          if (!accessoryEditor) return;
          const setup: AccessorySetup = {
            ...accessoryEditor.setup,
            movement: identity.display_name,
            movementDefinitionId: identity.id,
            ownershipScope: identity.ownership_scope || '',
            libraryScope: identity.library_scope || '',
            family: identity.family || '',
            primaryMuscleGroup: identity.primary_muscle_group || '',
            secondaryMuscleGroups: identity.secondary_muscle_groups || [],
            executionFamily: identity.execution_family || '',
          };
          if (await applyAccessorySetup(setup)) closeAccessoryEditorAfterSuccess();
        }}
      />
      <ReorderEditorModal
        state={reorderEditor}
        coreItems={coreItems}
        accessoryItems={accessoryItems}
        saving={reorderSaving}
        reduceMotion={reduceMotion}
        onChange={setReorderEditor}
        onCancel={cancelReorderEditor}
        onApply={applyReorder}
      />
      </View>
    </>
  );

}

function TrainingLiftEditorModal({
  state,
  groups,
  loadingGroups,
  saving,
  displayUnit,
  onChange,
  onCancel,
  onApply,
}: {
  state: TrainingLiftEditorState | null;
  groups: MovementPresetGroup[];
  loadingGroups: boolean;
  saving: boolean;
  displayUnit: 'lb' | 'kg';
  onChange: (setup: TrainingLiftSetup) => void;
  onCancel: () => void;
  onApply: (setup: TrainingLiftSetup) => void | Promise<void>;
}) {
  const [movementQuery, setMovementQuery] = useState('');
  const setup = state?.setup || null;
  const activeGroup = setup ? movementGroupByKey(groups, setup.family) || groups[0] || null : null;
  const isCompetition = activeGroup?.key === 'competition_lifts';
  const title = state?.mode === 'add' ? 'Add training lift' : 'Change training lift';
  const isCoreVariantSelection = setup?.lift === 'VR';
  const coreVariantLoadComplete = !!setup
    && Number.isFinite(Number(setup.targetLow))
    && Number.isFinite(Number(setup.targetHigh))
    && !!setup.targetLow.trim()
    && !!setup.targetHigh.trim();
  useEffect(() => setMovementQuery(''), [state?.item?.id, state?.mode]);
  const visibleMovementChoices = useMemo(() => {
    const query = movementQuery.trim().toLowerCase();
    const sourceGroups = query ? groups : activeGroup ? [activeGroup] : [];
    return sourceGroups.flatMap((group) => (group.movements || []).map((movement) => ({ group, movement })))
      .filter(({ movement }) => !query || movementPresetSearchText(movement).includes(query))
      .slice(0, query ? 48 : (isCompetition ? 3 : 14));
  }, [activeGroup, groups, isCompetition, movementQuery]);

  const patchSetup = (patch: Partial<TrainingLiftSetup>) => {
    if (!setup) return;
    onChange({ ...setup, ...patch });
  };

  const chooseFamily = (group: MovementPresetGroup) => {
    const first = group.movements?.[0] || null;
    const preset = movementPresetFromValue(first, group);
    patchSetup({
      family: group.key,
      movement: preset.name,
      coreMovementId: preset.coreMovementId,
      lift: preset.lift,
      ...(preset.lift === 'VR' ? { scheme: 'STRAIGHT', mode: 'RPE' } : {}),
    });
  };

  const chooseMovement = (movement: MovementPreset | string, group = activeGroup) => {
    if (!group) return;
    const preset = movementPresetFromValue(movement, group);
    patchSetup({
      movement: preset.name,
      coreMovementId: preset.coreMovementId,
      family: preset.categoryKey || group.key,
      lift: preset.lift,
      ...(preset.lift === 'VR' ? { scheme: 'STRAIGHT', mode: 'RPE' } : {}),
    });
  };

  const useCustomMovement = () => {
    if (!setup?.customMovement.trim()) return;
    patchSetup({
      movement: setup.customMovement.trim(),
      coreMovementId: null,
      lift: 'VR',
      scheme: 'STRAIGHT',
      mode: 'RPE',
    });
  };

  return (
    <Modal visible={!!state} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.trainingLiftEditorScreen}>
        <View style={styles.trainingLiftEditorHeader}>
          <View>
            <Text style={styles.trainingLiftEditorEyebrow}>Workspace edit</Text>
            <Text style={styles.trainingLiftEditorTitle}>{title}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel training lift changes"
            onPress={onCancel}
            style={({ pressed }) => [styles.trainingLiftCancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.trainingLiftCancelText}>Cancel</Text>
          </Pressable>
        </View>

        {!setup ? null : (
          <ScrollView
            style={styles.trainingLiftEditorScroll}
            contentContainerStyle={styles.trainingLiftEditorContent}
            keyboardShouldPersistTaps="handled"
          >
            <TrainingLiftSection title="Movement">
              {loadingGroups ? (
                <View style={styles.trainingLiftLoadingRow}>
                  <ActivityIndicator color={colors.violet} />
                  <Text style={styles.trainingLiftMuted}>Loading movement presets...</Text>
                </View>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trainingLiftFamilyRow}>
                {groups.map((group) => {
                  const selected = group.key === activeGroup?.key;
                  return (
                    <Pressable
                      key={group.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => chooseFamily(group)}
                      style={({ pressed }) => [
                        styles.trainingLiftFamilyButton,
                        selected && styles.trainingLiftFamilyButtonActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.trainingLiftFamilyText, selected && styles.trainingLiftFamilyTextActive]}>
                        {group.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <TextInput accessibilityLabel="Search training movements" value={movementQuery} onChangeText={setMovementQuery} placeholder="Search movements" placeholderTextColor={colors.subtle} style={styles.trainingLiftInput} />
              <View style={styles.trainingLiftCardGrid}>
                {visibleMovementChoices.map(({ movement, group }) => {
                  const preset = movementPresetFromValue(movement, group);
                  const selected = preset.name === setup.movement;
                  const competitionChoice = group.key === 'competition_lifts';
                  return (
                    <TrainingLiftOptionCard
                      key={`${group.key}-${preset.name}`}
                      title={preset.name}
                      detail={competitionChoice ? 'TM-based competition lift' : `${group.name || 'Training lift'} · manual load required`}
                      selected={selected}
                      tone={competitionChoice ? 'primary' : 'amber'}
                      onPress={() => chooseMovement(movement, group)}
                    />
                  );
                })}
              </View>
              {!isCompetition ? (
                <View style={styles.trainingLiftCustomBlock}>
                  <Text style={styles.trainingLiftFieldLabel}>Custom fallback</Text>
                  <TextInput
                    value={setup.customMovement}
                    onChangeText={(value) => patchSetup({ customMovement: value })}
                    placeholder="Type custom variant"
                    placeholderTextColor={colors.subtle}
                    style={styles.trainingLiftInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={useCustomMovement}
                    style={({ pressed }) => [styles.trainingLiftSecondaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.trainingLiftSecondaryText}>Use custom variant</Text>
                  </Pressable>
                </View>
              ) : null}
            </TrainingLiftSection>

            {isCoreVariantSelection ? (
              <TrainingLiftSection title="Variant Load">
                <Text style={styles.trainingLiftMuted}>Core variants require an explicit coach-authored load range.</Text>
                <View style={styles.trainingLiftCardGrid}>
                  <View style={[styles.trainingLiftCustomBlock, { flex: 1 }]}><Text style={styles.trainingLiftFieldLabel}>Low ({displayUnit})</Text><TextInput accessibilityLabel={`Core variant low load ${displayUnit}`} value={setup.targetLow} onChangeText={(targetLow) => patchSetup({ targetLow })} keyboardType="decimal-pad" style={styles.trainingLiftInput} /></View>
                  <View style={[styles.trainingLiftCustomBlock, { flex: 1 }]}><Text style={styles.trainingLiftFieldLabel}>High ({displayUnit})</Text><TextInput accessibilityLabel={`Core variant high load ${displayUnit}`} value={setup.targetHigh} onChangeText={(targetHigh) => patchSetup({ targetHigh })} keyboardType="decimal-pad" style={styles.trainingLiftInput} /></View>
                </View>
              </TrainingLiftSection>
            ) : null}

            <TrainingLiftSection title="Role">
              <View style={styles.trainingLiftCardGrid}>
                {[
                  { value: '', label: 'None', detail: 'No special role' },
                  { value: 'PRIMARY', label: 'Primary', detail: 'Main training priority' },
                  { value: 'SECONDARY', label: 'Secondary', detail: 'Supplemental priority' },
                  { value: 'TERTIARY', label: 'Tertiary', detail: 'Lower-priority core work' },
                  { value: 'QUATERNARY', label: 'Quaternary', detail: 'Extra core exposure' },
                ].map((role) => (
                  <TrainingLiftOptionCard
                    key={role.value || 'none'}
                    title={role.label}
                    detail={role.detail}
                    selected={setup.designation === role.value}
                    onPress={() => patchSetup({ designation: role.value })}
                  />
                ))}
              </View>
            </TrainingLiftSection>

            {!isCoreVariantSelection ? <TrainingLiftSection title="Pattern">
              <View style={styles.trainingLiftCardGrid}>
                {[
                  { value: 'STRAIGHT' as TrainingLiftScheme, label: 'Straight Sets', detail: 'One clean prescription' },
                  { value: 'TOP_BACKDOWN' as TrainingLiftScheme, label: 'Top + Backdowns', detail: 'Exposure plus volume' },
                  { value: 'FULL_CUSTOM' as TrainingLiftScheme, label: 'Full Custom', detail: 'Set-by-set plan' },
                ].map((scheme) => (
                  <TrainingLiftOptionCard
                    key={scheme.value}
                    title={scheme.label}
                    detail={scheme.detail}
                    selected={setup.scheme === scheme.value}
                    onPress={() => patchSetup({ scheme: scheme.value })}
                  />
                ))}
              </View>
            </TrainingLiftSection> : null}

            {!isCoreVariantSelection ? <TrainingLiftSection title="Load language">
              <View style={styles.trainingLiftTwoColumnGrid}>
                {[
                  { value: 'RPE' as TrainingLiftMode, label: 'RPE-based', detail: 'Effort target' },
                  { value: 'PCT' as TrainingLiftMode, label: '% of TM', detail: 'Percentage loading' },
                ].map((mode) => (
                  <TrainingLiftOptionCard
                    key={mode.value}
                    title={mode.label}
                    detail={mode.detail}
                    selected={setup.mode === mode.value}
                    onPress={() => patchSetup({ mode: mode.value })}
                  />
                ))}
              </View>
            </TrainingLiftSection> : null}

            <TrainingLiftSection title="Movement Notes">
              <TextInput
                value={setup.notes}
                onChangeText={(value) => patchSetup({ notes: value })}
                placeholder="Add cue, setup note, or movement context..."
                placeholderTextColor={colors.subtle}
                multiline
                style={[styles.trainingLiftInput, styles.trainingLiftNotesInput]}
              />
            </TrainingLiftSection>
          </ScrollView>
        )}

        {setup ? (
          <View style={styles.trainingLiftEditorActions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onCancel}
              style={({ pressed }) => [styles.trainingLiftActionSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.trainingLiftActionSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving || !setup.movement || (isCoreVariantSelection && !coreVariantLoadComplete)}
              onPress={() => onApply(setup)}
              style={({ pressed }) => [
                styles.trainingLiftActionPrimary,
                (saving || !setup.movement || (isCoreVariantSelection && !coreVariantLoadComplete)) && styles.editorDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.trainingLiftActionPrimaryText}>{saving ? 'Applying...' : 'Apply Changes'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function AnatomyTargetArt({
  primary,
  secondary = [],
  athlete,
  style,
  scale = 0.72,
  size = 'thumbnail',
}: {
  primary: string;
  secondary?: string[];
  athlete?: { sex?: string | null; anatomy_display_preference?: string | null };
  style?: React.ComponentProps<typeof View>['style'];
  scale?: number;
  size?: 'thumbnail' | 'card';
}) {
  return <View style={[styles.anatomyTargetArt, style]}><MuscleMap athlete={athlete} primary={[primary]} secondary={secondary} semanticLevel="movement" size={size} style={{ transform: [{ scale }] }} view="auto" /></View>;
}

function AccessoryEditorModal({
  state,
  groups,
  athleteId,
  athleteAnatomy,
  canCreateCustom,
  saving,
  onChange,
  onCancel,
  onApply,
  onCreateCustom,
  onDone,
}: {
  state: AccessoryEditorState | null;
  groups: MovementPresetGroup[];
  athleteId: number | null;
  athleteAnatomy: { sex?: string | null; anatomy_display_preference?: string | null };
  canCreateCustom: boolean;
  saving: boolean;
  onChange: (setup: AccessorySetup) => void;
  onCancel: () => void;
  onApply: (setup: AccessorySetup) => Promise<boolean>;
  onCreateCustom: (setup: AccessorySetup, confirmSimilar: boolean) => Promise<MovementPreset | null>;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [pickerStep, setPickerStep] = useState<AccessoryPickerStep>('discovery');
  const [detailReturnStep, setDetailReturnStep] = useState<AccessoryPickerStep>('results');
  const [customReturnStep, setCustomReturnStep] = useState<AccessoryPickerStep>('results');
  const [discoveryMode, setDiscoveryMode] = useState<'muscle' | 'movement'>('muscle');
  const [selectedRegionKey, setSelectedRegionKey] = useState('');
  const [selectedMovement, setSelectedMovement] = useState<MovementPreset | null>(null);
  const [movementQuery, setMovementQuery] = useState('');
  const [primaryMuscleFilter, setPrimaryMuscleFilter] = useState('');
  const [regionalMuscleFilters, setRegionalMuscleFilters] = useState<string[]>([]);
  const [executionFamilyFilter, setExecutionFamilyFilter] = useState('');
  const [resultMode, setResultMode] = useState<AccessoryPickerResultMode>('all');
  const [searchResults, setSearchResults] = useState<MovementPreset[]>([]);
  const [searchResultGroups, setSearchResultGroups] = useState<MovementSearchResultGroups | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchRevision, setSearchRevision] = useState(0);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [reviewingCustom, setReviewingCustom] = useState(false);
  const [customReviewed, setCustomReviewed] = useState(false);
  const [customMatches, setCustomMatches] = useState<MovementSimilarityMatch[]>([]);
  const [customError, setCustomError] = useState('');
  const [customPrimaryRegionKey, setCustomPrimaryRegionKey] = useState('');
  const [customSecondaryExpanded, setCustomSecondaryExpanded] = useState(false);
  const [customNotesVisible, setCustomNotesVisible] = useState(false);
  const [authoringOptions, setAuthoringOptions] = useState<MovementAuthoringOptions | null>(null);
  const [authoringLoading, setAuthoringLoading] = useState(false);
  const [authoringError, setAuthoringError] = useState('');
  const [authoringRevision, setAuthoringRevision] = useState(0);
  const searchRequestRef = useRef(0);
  const customSimilarityRequestRef = useRef(0);
  const setup = state?.setup || null;
  const title = state?.mode === 'add' ? 'Add Accessory' : 'Change Accessory';
  const pickerRegions = authoringOptions?.regional_groups?.length
    ? authoringOptions.regional_groups
    : ACCESSORY_PICKER_REGIONS;
  const selectedRegion = pickerRegions.find((region) => region.key === selectedRegionKey) || null;
  const options = authoringOptions || {
    muscle_groups: ACCESSORY_MUSCLE_GROUPS.map(([key, label]) => ({ key, label })),
    execution_families: ACCESSORY_EXECUTION_FAMILIES.map(([key, label]) => ({ key, label })),
  };
  const customIdentityComplete = !!setup?.customMovement.trim()
    && !!setup.primaryMuscleGroup
    && !!setup.executionFamily;
  const showsResults = pickerStep === 'targets'
    || pickerStep === 'results'
    || (pickerStep === 'discovery' && discoveryMode === 'movement');

  useEffect(() => {
    setPickerStep('discovery');
    setDetailReturnStep('results');
    setCustomReturnStep('results');
    setDiscoveryMode('muscle');
    setSelectedRegionKey('');
    setSelectedMovement(null);
    setMovementQuery('');
    setPrimaryMuscleFilter('');
    setRegionalMuscleFilters([]);
    setExecutionFamilyFilter('');
    setResultMode('all');
    setSearchResults([]);
    setSearchResultGroups(null);
    setSearchNextCursor(null);
    setSearchError('');
    setCustomError('');
    setCustomReviewed(false);
    setCustomMatches([]);
    setCustomPrimaryRegionKey('');
    setCustomSecondaryExpanded(false);
    setCustomNotesVisible(false);
    setAuthoringError('');
  }, [state?.item?.id, state?.mode]);

  useEffect(() => {
    if (!state || !showsResults) {
      searchRequestRef.current += 1;
      setSearchLoading(false);
      return;
    }
    const requestId = ++searchRequestRef.current;
    const targetAthleteId = Number(athleteId);
    if (!Number.isFinite(targetAthleteId) || targetAthleteId <= 0) {
      setSearchResults([]);
      setSearchError('Athlete context is unavailable.');
      return;
    }
    setSearchLoading(true);
    setSearchLoadingMore(false);
    setSearchNextCursor(null);
    setSearchResultGroups(null);
    setSearchError('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        athlete_id: String(targetAthleteId),
        q: movementQuery.trim(),
        limit: '24',
      });
      if (pickerStep === 'results' && primaryMuscleFilter) {
        params.set('primary_muscle_group', primaryMuscleFilter);
        params.set('include_secondary', '1');
      }
      else if (pickerStep === 'results' && regionalMuscleFilters.length) {
        params.set('primary_muscle_groups', regionalMuscleFilters.join(','));
      } else if (pickerStep === 'targets' && selectedRegion?.muscles.length) {
        params.set('primary_muscle_groups', selectedRegion.muscles.join(','));
      }
      if (executionFamilyFilter) params.set('execution_family', executionFamilyFilter);
      if (resultMode === 'favorites') params.set('favorites_only', '1');
      if (resultMode === 'recent') params.set('recent_only', '1');
      if (resultMode === 'custom') params.set('custom_only', '1');
      void fetchJson<any>(`/workouts/mobile/movement-definitions/search?${params.toString()}`, { method: 'GET' })
        .then((response) => {
          if (requestId !== searchRequestRef.current) return;
          const json = response.json || {};
          if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
          const grouped = movementSearchResultGroups(json.result_groups);
          setSearchResultGroups(grouped);
          setSearchResults(grouped
            ? uniqueMovementResults([...grouped.primary.items, ...grouped.secondary.items])
            : Array.isArray(json.items) ? json.items : []);
          setSearchNextCursor(typeof json.next_cursor === 'string' ? json.next_cursor : null);
        })
        .catch((error: any) => {
          if (requestId !== searchRequestRef.current) return;
          setSearchResults([]);
          setSearchResultGroups(null);
          setSearchNextCursor(null);
          setSearchError(error?.message || 'Accessory movements could not load.');
        })
        .finally(() => {
          if (requestId === searchRequestRef.current) setSearchLoading(false);
        });
    }, movementQuery.trim() ? 220 : 0);
    return () => clearTimeout(timer);
  }, [
    athleteId,
    discoveryMode,
    executionFamilyFilter,
    movementQuery,
    pickerStep,
    primaryMuscleFilter,
    regionalMuscleFilters,
    resultMode,
    searchRevision,
    selectedRegion?.muscles,
    showsResults,
    state,
  ]);

  useEffect(() => {
    if (!state || !canCreateCustom || authoringOptions) return;
    const targetAthleteId = Number(athleteId);
    if (!Number.isFinite(targetAthleteId) || targetAthleteId <= 0) return;
    setAuthoringLoading(true);
    setAuthoringError('');
    void fetchJson<any>(`/workouts/mobile/movement-definitions/authoring-options?athlete_id=${targetAthleteId}`, { method: 'GET' })
      .then((response) => {
        const json = response.json || {};
        if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
        setAuthoringOptions({
          muscle_groups: Array.isArray(json.muscle_groups) ? json.muscle_groups : [],
          execution_families: Array.isArray(json.execution_families) ? json.execution_families : [],
          regional_groups: Array.isArray(json.regional_groups)
            ? json.regional_groups.map((region: any) => ({
              key: String(region.key || ''),
              label: String(region.label || ''),
              artwork: String(region.artwork_key || 'full_body') as AccessoryRegionalArtworkKey,
              muscles: Array.isArray(region.primary_muscle_groups)
                ? region.primary_muscle_groups.map(String)
                : [],
            })).filter((region: AccessoryPickerRegion) => region.key && region.label && region.muscles.length)
            : [],
        });
      })
      .catch(() => setAuthoringError('Custom movement options could not load.'))
      .finally(() => setAuthoringLoading(false));
  }, [athleteId, authoringOptions, authoringRevision, canCreateCustom, state]);

  const patchSetup = (patch: Partial<AccessorySetup>) => {
    if (!setup) return;
    if ('customMovement' in patch || 'primaryMuscleGroup' in patch || 'secondaryMuscleGroups' in patch || 'executionFamily' in patch) {
      setCustomReviewed(false);
      if ('customMovement' in patch) {
        customSimilarityRequestRef.current += 1;
        setReviewingCustom(false);
        setCustomMatches([]);
      }
      setCustomError('');
    }
    onChange({ ...setup, ...patch });
  };

  const openMovementDetail = (movement: MovementPreset) => {
    setDetailReturnStep(pickerStep);
    setSelectedMovement(movement);
    setPickerStep('detail');
  };

  const movementSetupFor = (movement: MovementPreset): AccessorySetup | null => {
    if (!setup || !movement.id) return null;
    const family = `identity_${String(movement.family || 'accessory').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    return {
      ...setup,
      movement: movementPresetName(movement),
      family: movementGroupByKey(groups, family)?.key || family,
      movementDefinitionId: movement.id,
      ownershipScope: movement.ownership_scope || '',
      libraryScope: movement.library_scope || '',
      primaryMuscleGroup: movement.primary_muscle_group || '',
      secondaryMuscleGroups: movement.secondary_muscle_groups || [],
      executionFamily: movement.execution_family || '',
      customNotes: movement.custom_notes || '',
    };
  };

  const confirmMovement = () => {
    if (!selectedMovement) return;
    const selectedSetup = movementSetupFor(selectedMovement);
    if (!selectedSetup) return;
    setPickerStep('review');
  };

  const confirmAndApplyMovement = async () => {
    if (!selectedMovement) return;
    const selectedSetup = movementSetupFor(selectedMovement);
    if (!selectedSetup) return;
    if (await onApply(selectedSetup)) setPickerStep('success');
  };

  const toggleFavorite = async (movement: MovementPreset) => {
    if (!movement.id || !athleteId) return;
    const nextFavorite = !movement.is_favorite;
    const update = (item: MovementPreset) => item.id === movement.id
      ? { ...item, is_favorite: nextFavorite }
      : item;
    setSearchResults((current) => current.map(update));
    setSearchResultGroups((current) => current ? {
      ...current,
      primary: { ...current.primary, items: current.primary.items.map(update) },
      secondary: { ...current.secondary, items: current.secondary.items.map(update) },
    } : current);
    setSelectedMovement((current) => current && current.id === movement.id ? update(current) : current);
    const response = await fetchJson<any>(
      `/workouts/mobile/movement-definitions/${movement.id}/favorite`,
      {
        method: nextFavorite ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: athleteId }),
      },
    );
    const json = response.json || {};
    if (!response.ok || !json.ok) {
      const rollback = (item: MovementPreset) => item.id === movement.id
        ? { ...item, is_favorite: !nextFavorite }
        : item;
      setSearchResults((current) => current.map(rollback));
      setSearchResultGroups((current) => current ? {
        ...current,
        primary: { ...current.primary, items: current.primary.items.map(rollback) },
        secondary: { ...current.secondary, items: current.secondary.items.map(rollback) },
      } : current);
      setSelectedMovement((current) => current && current.id === movement.id ? rollback(current) : current);
      Alert.alert('Favorite not updated', json.error || 'Try again.');
    } else if (!nextFavorite && resultMode === 'favorites') {
      setSearchResults((current) => current.filter((item) => item.id !== movement.id));
      setSearchResultGroups((current) => current ? {
        ...current,
        primary: {
          ...current.primary,
          items: current.primary.items.filter((item) => item.id !== movement.id),
          total_count: Math.max(0, current.primary.total_count - Number(current.primary.items.some((item) => item.id === movement.id))),
        },
        secondary: {
          ...current.secondary,
          items: current.secondary.items.filter((item) => item.id !== movement.id),
          total_count: Math.max(0, current.secondary.total_count - Number(current.secondary.items.some((item) => item.id === movement.id))),
        },
      } : current);
    }
  };

  const loadMoreMovements = async (resultGroup?: 'primary' | 'secondary') => {
    const groupCursor = resultGroup ? searchResultGroups?.[resultGroup].next_cursor : searchNextCursor;
    if (!state || !groupCursor || searchLoadingMore) return;
    const targetAthleteId = Number(athleteId);
    if (!Number.isFinite(targetAthleteId) || targetAthleteId <= 0) return;
    try {
      setSearchLoadingMore(true);
      const params = new URLSearchParams({
        athlete_id: String(targetAthleteId),
        q: movementQuery.trim(),
        limit: '24',
      });
      if (resultGroup && primaryMuscleFilter) {
        params.set('primary_muscle_group', primaryMuscleFilter);
        params.set('include_secondary', '1');
        params.set('result_group', resultGroup);
        params.set(`${resultGroup}_cursor`, groupCursor);
      } else {
        params.set('cursor', groupCursor);
      }
      if (primaryMuscleFilter && !resultGroup) params.set('primary_muscle_group', primaryMuscleFilter);
      else if (regionalMuscleFilters.length) {
        params.set('primary_muscle_groups', regionalMuscleFilters.join(','));
      }
      if (executionFamilyFilter) params.set('execution_family', executionFamilyFilter);
      if (resultMode === 'favorites') params.set('favorites_only', '1');
      if (resultMode === 'recent') params.set('recent_only', '1');
      if (resultMode === 'custom') params.set('custom_only', '1');
      const response = await fetchJson<any>(`/workouts/mobile/movement-definitions/search?${params.toString()}`, { method: 'GET' });
      const json = response.json || {};
      if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
      const grouped = movementSearchResultGroups(json.result_groups);
      if (resultGroup && grouped) {
        const loadedGroup = grouped[resultGroup];
        setSearchResultGroups((current) => {
          if (!current) return grouped;
          const mergedGroup = {
            ...loadedGroup,
            items: uniqueMovementResults([...current[resultGroup].items, ...loadedGroup.items]),
          };
          return { ...current, [resultGroup]: mergedGroup };
        });
        setSearchResults((current) => uniqueMovementResults([...current, ...loadedGroup.items]));
        return;
      }
      const nextItems: MovementPreset[] = Array.isArray(json.items) ? json.items : [];
      setSearchResults((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...nextItems.filter((item) => !seen.has(item.id))];
      });
      setSearchNextCursor(typeof json.next_cursor === 'string' ? json.next_cursor : null);
    } catch (error: any) {
      setSearchError(error?.message || 'More accessory movements could not load.');
    } finally {
      setSearchLoadingMore(false);
    }
  };

  const reviewCustomMovement = useCallback(async ({ nameOnly = false }: { nameOnly?: boolean } = {}) => {
    if (!setup || !setup.customMovement.trim() || (!nameOnly && !customIdentityComplete) || !athleteId) return false;
    const requestId = ++customSimilarityRequestRef.current;
    try {
      setReviewingCustom(true);
      setCustomError('');
      const response = await fetchJson<any>('/workouts/mobile/movement-definitions/similarity', {
        method: 'POST',
        body: {
          athlete_id: athleteId,
          display_name: setup.customMovement.trim(),
          ...(nameOnly ? {} : {
            primary_muscle_group: setup.primaryMuscleGroup,
            secondary_muscle_groups: setup.secondaryMuscleGroups,
            execution_family: setup.executionFamily,
            notes: setup.customNotes,
          }),
        } as any,
      });
      const json = response.json || {};
      if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
      if (requestId !== customSimilarityRequestRef.current) return false;
      setCustomMatches(Array.isArray(json.matches) ? json.matches : []);
      setCustomReviewed(true);
      return true;
    } catch (error: any) {
      if (requestId !== customSimilarityRequestRef.current) return false;
      setCustomError(error?.message || 'Possible matches could not be reviewed.');
      return false;
    } finally {
      if (requestId === customSimilarityRequestRef.current) setReviewingCustom(false);
    }
  }, [athleteId, customIdentityComplete, setup]);

  useEffect(() => {
    if (pickerStep !== 'custom-name' || !setup?.customMovement.trim() || !athleteId) return;
    const movementName = setup.customMovement.trim();
    if (movementName.length < 1) return;
    const timer = setTimeout(() => {
      void reviewCustomMovement({ nameOnly: true });
    }, 260);
    return () => clearTimeout(timer);
  }, [athleteId, pickerStep, reviewCustomMovement, setup?.customMovement]);

  const selectCustomMatch = (movement: MovementPreset) => {
    if (!movement?.id) return;
    setSearchResults((current) => [movement, ...current.filter((item) => item.id !== movement.id)]);
    setSelectedMovement(movement);
    setDetailReturnStep('custom-name');
    setPickerStep('detail');
  };

  const openCustomCreator = () => {
    setCustomReturnStep(pickerStep);
    setCustomPrimaryRegionKey('');
    setCustomSecondaryExpanded(false);
    setCustomError('');
    setCustomMatches([]);
    setCustomReviewed(false);
    patchSetup({
      customMovement: movementQuery.trim(),
      primaryMuscleGroup: '',
      secondaryMuscleGroups: [],
      executionFamily: '',
      customNotes: '',
    });
    setPickerStep('custom-name');
  };

  const advanceToCustomReview = async () => {
    if (await reviewCustomMovement()) setPickerStep('custom-review');
  };

  const createReviewedCustomMovement = async () => {
    if (!setup || !customIdentityComplete || !customReviewed) return;
    try {
      setCreatingCustom(true);
      setCustomError('');
      const definition = await onCreateCustom(setup, true);
      if (!definition?.id) return;
      setSearchResults((current) => [definition, ...current.filter((item) => item.id !== definition.id)]);
      setSelectedMovement(definition);
      setPickerStep('custom-created');
    } catch (error: any) {
      setCustomError(error?.message || 'Custom movement could not be created.');
    } finally {
      setCreatingCustom(false);
    }
  };

  const applyCreatedCustomMovement = async () => {
    if (!selectedMovement) return;
    const selectedSetup = movementSetupFor(selectedMovement);
    if (!selectedSetup) return;
    if (await onApply(selectedSetup)) onDone();
  };

  const goBack = () => {
    if (pickerStep === 'detail') setPickerStep(detailReturnStep);
    else if (pickerStep === 'review') setPickerStep('detail');
    else if (pickerStep === 'custom-name') setPickerStep(customReturnStep);
    else if (pickerStep === 'custom-primary') setPickerStep('custom-name');
    else if (pickerStep === 'custom-secondary') setPickerStep('custom-primary');
    else if (pickerStep === 'custom-execution') setPickerStep('custom-secondary');
    else if (pickerStep === 'custom-review') setPickerStep('custom-execution');
    else if (pickerStep === 'results') {
      setPrimaryMuscleFilter('');
      setRegionalMuscleFilters([]);
      setExecutionFamilyFilter('');
      setMovementQuery('');
      setResultMode('all');
      setPickerStep(selectedRegionKey ? 'targets' : 'discovery');
    }
    else if (pickerStep === 'targets') {
      setSelectedRegionKey('');
      setPrimaryMuscleFilter('');
      setRegionalMuscleFilters([]);
      setPickerStep('discovery');
    }
  };

  const selectLibraryMode = (mode: AccessoryPickerResultMode) => {
    setSelectedRegionKey('');
    setPrimaryMuscleFilter('');
    setRegionalMuscleFilters([]);
    setExecutionFamilyFilter('');
    setMovementQuery('');
    setResultMode(mode);
    setPickerStep('results');
  };

  const movementCard = (movement: MovementPreset, relationship: 'default' | 'primary' | 'secondary' = 'default') => {
    const primaryLabel = accessoryTaxonomyLabel(movement.primary_muscle_group) || 'Primary muscle not specified';
    const executionLabel = accessoryTaxonomyLabel(movement.execution_family) || 'Execution not specified';
    const selectedMuscleLabel = accessoryTaxonomyLabel(primaryMuscleFilter);
    return (
    <View key={movement.id || movementPresetName(movement)} style={styles.accessoryPickerMovementCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Review ${movementPresetName(movement)}`}
        onPress={() => openMovementDetail(movement)}
        style={({ pressed }) => [styles.accessoryPickerMovementMain, pressed && styles.pressed]}
      >
        <Image source={accessoryPickerArtwork(movement).source} resizeMode="contain" style={styles.accessoryPickerMovementArt} />
        <View style={styles.accessoryPickerMovementCopy}>
          <Text style={styles.accessoryPickerMovementTitle}>{movementPresetName(movement)}</Text>
          {relationship === 'default' ? (
            <Text numberOfLines={2} style={styles.accessoryPickerMovementMeta}>{movementResultContext(movement)}</Text>
          ) : (
            <Text numberOfLines={2} style={styles.accessoryPickerMovementMeta}>
              {primaryLabel}
              {relationship === 'secondary' && selectedMuscleLabel ? <Text style={styles.accessoryPickerMovementSecondaryMeta}> · + {selectedMuscleLabel}</Text> : null}
              <Text> · {executionLabel}</Text>
            </Text>
          )}
          {movement.ownership_scope === 'coach' ? <Text style={styles.accessoryPickerMovementSource}>My Movement</Text> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={movement.is_favorite ? `Remove ${movementPresetName(movement)} from favorites` : `Add ${movementPresetName(movement)} to favorites`}
        accessibilityState={{ selected: !!movement.is_favorite }}
        hitSlop={8}
        onPress={() => void toggleFavorite(movement)}
        style={({ pressed }) => [styles.accessoryPickerFavorite, movement.is_favorite && styles.accessoryPickerFavoriteActive, pressed && styles.pressed]}
      >
        <Ionicons name={movement.is_favorite ? 'star' : 'star-outline'} size={22} color={movement.is_favorite ? SLColors.warning : colors.muted} />
      </Pressable>
    </View>
    );
  };

  const favoriteResults = resultMode === 'all' ? searchResults.filter((movement) => movement.is_favorite) : [];
  const recentResults = resultMode === 'all'
    ? searchResults.filter((movement) => !movement.is_favorite && movement.last_used_on)
    : [];
  const ungroupedResults = resultMode === 'all'
    ? searchResults.filter((movement) => !movement.is_favorite && !movement.last_used_on)
    : searchResults;
  const unscopedResultSections = [
    ...(favoriteResults.length ? [{ label: 'Favorites', items: favoriteResults }] : []),
    ...(recentResults.length ? [{ label: 'Recently Used', items: recentResults }] : []),
    ...(ungroupedResults.length ? [{
      label: resultMode === 'favorites' ? 'Favorites' : resultMode === 'recent' ? 'Recently Used' : resultMode === 'custom' ? 'My Movements' : 'All Movements',
      items: ungroupedResults,
    }] : []),
  ];
  const customStepNumber = CUSTOM_MOVEMENT_STEPS.indexOf(pickerStep) + 1;
  const customPrimaryRegion = pickerRegions.find((region) => region.key === customPrimaryRegionKey)
    || pickerRegions.find((region) => (region.muscles as readonly string[]).includes(setup?.primaryMuscleGroup || ''))
    || null;
  const contextualSecondaryMuscles = options.muscle_groups
    .filter((option) => option.key !== setup?.primaryMuscleGroup)
    .sort((left, right) => {
      const leftRelevant = (customPrimaryRegion?.muscles as readonly string[] | undefined)?.includes(left.key) ? 0 : 1;
      const rightRelevant = (customPrimaryRegion?.muscles as readonly string[] | undefined)?.includes(right.key) ? 0 : 1;
      return leftRelevant - rightRelevant;
    });
  const visibleSecondaryMuscles = customSecondaryExpanded
    ? contextualSecondaryMuscles
    : contextualSecondaryMuscles.slice(0, 12);

  const resultList = (
    <View style={styles.accessoryPickerResultList}>
      {searchLoading ? (
        <View style={styles.trainingLiftLoadingRow}>
          <ActivityIndicator color={colors.violet} />
          <Text style={styles.trainingLiftMuted}>Loading relevant movements...</Text>
        </View>
      ) : null}
      {searchError ? (
        <View style={styles.accessoryEditorStatusBlock}>
          <Text style={styles.accessoryEditorErrorText}>{searchError}</Text>
          <Pressable accessibilityRole="button" onPress={() => setSearchRevision((value) => value + 1)} style={styles.trainingLiftSecondaryButton}>
            <Text style={styles.trainingLiftSecondaryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {!searchLoading && !searchError && searchResultGroups ? (
        <>
          <View style={[styles.accessoryPickerResultSection, styles.accessoryPickerResultSectionPrimary]}>
            <View style={styles.accessoryPickerResultSectionHeading}>
              <Text style={styles.accessoryPickerSectionLabel}>Primary target · {accessoryTaxonomyLabel(searchResultGroups.selected_muscle_group)}</Text>
              <Text style={styles.accessoryPickerResultCount}>{searchResultGroups.primary.total_count}</Text>
            </View>
            <Text style={styles.accessoryPickerResultDescription}>These movements primarily target your {accessoryTaxonomyLabel(searchResultGroups.selected_muscle_group)}.</Text>
            <View style={styles.accessoryPickerResultCards}>{searchResultGroups.primary.items.map((movement) => movementCard(movement, 'primary'))}</View>
            {!searchResultGroups.primary.items.length ? <Text style={styles.trainingLiftMuted}>No primary-target movements match these filters.</Text> : null}
            {searchResultGroups.primary.next_cursor ? (
              <Pressable accessibilityRole="button" disabled={searchLoadingMore} onPress={() => void loadMoreMovements('primary')} style={styles.trainingLiftSecondaryButton}>
                <Text style={styles.trainingLiftSecondaryText}>{searchLoadingMore ? 'Loading...' : 'Load More Primary Targets'}</Text>
              </Pressable>
            ) : null}
          </View>
          {searchResultGroups.secondary.total_count > 0 ? (
            <View style={[styles.accessoryPickerResultSection, styles.accessoryPickerResultSectionSecondary]}>
              <View style={styles.accessoryPickerResultSectionHeading}>
                <Text style={[styles.accessoryPickerSectionLabel, styles.accessoryPickerSectionLabelSecondary]}>Also trains {accessoryTaxonomyLabel(searchResultGroups.selected_muscle_group)}</Text>
                <Text style={[styles.accessoryPickerResultCount, styles.accessoryPickerResultCountSecondary]}>{searchResultGroups.secondary.total_count}</Text>
              </View>
              <Text style={styles.accessoryPickerResultDescription}>{accessoryTaxonomyLabel(searchResultGroups.selected_muscle_group)} is a secondary target in these movements.</Text>
              <View style={styles.accessoryPickerResultCards}>{searchResultGroups.secondary.items.map((movement) => movementCard(movement, 'secondary'))}</View>
              {searchResultGroups.secondary.next_cursor ? (
                <Pressable accessibilityRole="button" disabled={searchLoadingMore} onPress={() => void loadMoreMovements('secondary')} style={styles.trainingLiftSecondaryButton}>
                  <Text style={styles.trainingLiftSecondaryText}>{searchLoadingMore ? 'Loading...' : 'Load More Secondary Targets'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
      {!searchLoading && !searchError && !searchResultGroups ? unscopedResultSections.map((section) => (
        <View key={section.label} style={styles.accessoryPickerResultSection}>
          <Text style={styles.accessoryPickerSectionLabel}>{section.label}</Text>
          <View style={styles.accessoryPickerResultCards}>{section.items.map((movement) => movementCard(movement))}</View>
        </View>
      )) : null}
      {!searchLoading && !searchError && !searchResults.length ? (
        <View style={styles.accessoryEditorStatusBlock}>
          <Text style={styles.trainingLiftMuted}>No matching accessory movements.</Text>
          <Text style={styles.trainingLiftMuted}>Change the scope or create a coach-owned movement.</Text>
        </View>
      ) : null}
      {searchNextCursor && !searchResultGroups && !searchLoading ? (
        <Pressable accessibilityRole="button" disabled={searchLoadingMore} onPress={() => void loadMoreMovements()} style={styles.trainingLiftSecondaryButton}>
          <Text style={styles.trainingLiftSecondaryText}>{searchLoadingMore ? 'Loading...' : 'Load More'}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const stepTitle = pickerStep === 'discovery'
    ? title
    : pickerStep === 'targets'
      ? selectedRegion?.label || 'Choose Focus'
      : pickerStep === 'results'
        ? primaryMuscleFilter
          ? accessoryTaxonomyLabel(primaryMuscleFilter)
          : regionalMuscleFilters.length && selectedRegion
            ? `${selectedRegion.label} Movements`
            : resultMode === 'favorites'
              ? 'Favorites'
              : resultMode === 'recent'
                ? 'Recent'
                : resultMode === 'custom'
                  ? 'My Movements'
                  : 'Movements'
        : pickerStep === 'detail'
          ? movementPresetName(selectedMovement) || 'Movement Details'
          : pickerStep === 'review'
            ? 'Review Selection'
            : pickerStep === 'success'
              ? state?.mode === 'edit' ? 'Accessory Changed' : 'Accessory Added'
              : pickerStep === 'custom-created'
                ? 'Movement Created'
                : CUSTOM_MOVEMENT_STEPS.includes(pickerStep)
                  ? 'Create Movement'
                  : title;

  return (
    <Modal visible={!!state} animationType="slide" onRequestClose={pickerStep === 'success' || pickerStep === 'custom-created' ? onDone : onCancel} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.accessoryEditorKeyboardWrap}>
        <View style={styles.accessoryEditorCard}>
          <View
            style={[
              styles.trainingLiftEditorHeader,
              styles.accessoryEditorHeader,
              { paddingTop: Math.max(insets.top + 8, 18) },
            ]}
          >
            <View style={styles.accessoryPickerHeaderAction}>
              {pickerStep !== 'discovery' && pickerStep !== 'success' && pickerStep !== 'custom-created' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.accessoryPickerHeaderButton}>
                  <Ionicons name="chevron-back" size={22} color={colors.textStrong} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.accessoryEditorTitleBlock}>
              <Text style={styles.trainingLiftEditorEyebrow}>Session builder</Text>
              <Text numberOfLines={1} style={styles.accessoryPickerHeaderTitle}>{stepTitle}</Text>
            </View>
            <View style={styles.accessoryPickerHeaderAction}>
              <Pressable accessibilityRole="button" accessibilityLabel="Close accessory picker" onPress={pickerStep === 'success' || pickerStep === 'custom-created' ? onDone : onCancel} style={styles.accessoryPickerHeaderButton}>
                <Ionicons name="close" size={22} color={colors.textStrong} />
              </Pressable>
            </View>
          </View>

          {!setup ? (
            <View testID="accessory-picker-body" style={styles.accessoryEditorFailureState}>
              <Text style={styles.trainingLiftSectionTitle}>Accessory picker unavailable</Text>
              <Text style={styles.trainingLiftMuted}>Close this editor and try again.</Text>
            </View>
          ) : (
            <ScrollView
              testID="accessory-picker-body"
              style={styles.trainingLiftEditorScroll}
              contentContainerStyle={[
                styles.accessoryEditorContent,
                { paddingBottom: Math.max(insets.bottom + 18, 18) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {pickerStep === 'discovery' ? (
                <>
                  <View style={styles.accessoryPickerIntro}>
                    <Text style={styles.accessoryPickerKicker}>Choose target first</Text>
                    <Text style={styles.accessoryPickerIntroTitle}>What are you trying to train?</Text>
                    <Text style={styles.trainingLiftMuted}>Start with the muscle, or search directly when you already know the movement.</Text>
                  </View>
                  <View style={styles.accessoryPickerModeRow}>
                    {([
                      ['muscle', 'By Muscle', 'Drill into a target'],
                      ['movement', 'By Movement', 'Search directly'],
                    ] as const).map(([mode, label, detail]) => (
                      <Pressable
                        key={mode}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: discoveryMode === mode }}
                        onPress={() => {
                          setDiscoveryMode(mode);
                          setSelectedRegionKey('');
                          setPrimaryMuscleFilter('');
                          setRegionalMuscleFilters([]);
                          setMovementQuery('');
                          setResultMode('all');
                        }}
                        style={[styles.accessoryPickerMode, discoveryMode === mode && styles.accessoryPickerModeActive]}
                      >
                        <View style={[styles.accessoryPickerModeIcon, discoveryMode === mode && styles.accessoryPickerModeIconActive]}>
                          <Ionicons name={mode === 'muscle' ? 'body-outline' : 'search-outline'} size={24} color={discoveryMode === mode ? colors.violet : colors.muted} />
                        </View>
                        <View style={styles.accessoryPickerModeCopy}>
                          <Text style={styles.accessoryPickerModeTitle}>{label}</Text>
                          <Text style={styles.accessoryPickerModeDetail}>{detail}</Text>
                        </View>
                        {discoveryMode === mode ? <Ionicons name="checkmark-circle" size={22} color={colors.violet} /> : null}
                      </Pressable>
                    ))}
                  </View>
                  {discoveryMode === 'muscle' ? (
                    <View style={styles.accessoryPickerRegionGrid}>
                      {pickerRegions.map((region) => (
                        <Pressable
                          key={region.key}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose ${region.label}`}
                          onPress={() => {
                            setSelectedRegionKey(region.key);
                            setPrimaryMuscleFilter('');
                            setRegionalMuscleFilters([]);
                            setExecutionFamilyFilter('');
                            setMovementQuery('');
                            setPickerStep('targets');
                          }}
                          style={({ pressed }) => [styles.accessoryPickerRegionCard, pressed && styles.pressed]}
                        >
                          <Image source={accessoryRegionalArtworkAsset(region.artwork).source} resizeMode="contain" style={styles.accessoryPickerRegionArt} />
                          <Text style={styles.accessoryPickerRegionLabel}>{region.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.accessoryPickerSectionInset}>
                      <View style={styles.accessoryPickerSearchField}>
                        <Ionicons name="search-outline" size={20} color={colors.muted} />
                        <TextInput accessibilityLabel="Search accessory movements" value={movementQuery} onChangeText={setMovementQuery} autoFocus placeholder="Search all movements..." placeholderTextColor={colors.subtle} returnKeyType="search" style={styles.accessoryPickerSearchInput} />
                      </View>
                      {resultList}
                    </View>
                  )}
                  <View style={styles.accessoryPickerQuickRow}>
                    <Pressable onPress={() => selectLibraryMode('favorites')} style={styles.accessoryPickerQuickButton}><Ionicons name="star-outline" size={17} color={SLColors.warning} /><Text style={styles.accessoryPickerQuickText}>Favorites</Text></Pressable>
                    <Pressable onPress={() => selectLibraryMode('recent')} style={styles.accessoryPickerQuickButton}><Ionicons name="time-outline" size={17} color={colors.violet} /><Text style={styles.accessoryPickerQuickText}>Recent</Text></Pressable>
                    <Pressable onPress={() => selectLibraryMode('custom')} style={styles.accessoryPickerQuickButton}><Ionicons name="person-outline" size={17} color={colors.violet} /><Text style={styles.accessoryPickerQuickText}>My Movements</Text></Pressable>
                  </View>
                </>
              ) : null}

              {pickerStep === 'targets' && selectedRegion ? (
                <>
                  <View style={styles.accessoryPickerHero}>
                    <Image source={accessoryRegionalArtworkAsset(selectedRegion.artwork).source} resizeMode="contain" style={styles.accessoryPickerHeroArt} />
                  </View>
                  <View style={styles.accessoryPickerIntro}>
                    <Text style={styles.accessoryPickerKicker}>Select a primary target</Text>
                    <Text style={styles.trainingLiftMuted}>These targets filter the most relevant movements while preserving the governed muscle identity.</Text>
                  </View>
                  <View style={styles.accessoryPickerTargetGrid}>
                    {selectedRegion.muscles.map((muscle) => (
                      <Pressable
                        key={muscle}
                        accessibilityRole="button"
                        onPress={() => {
                          setPrimaryMuscleFilter(muscle);
                          setRegionalMuscleFilters([]);
                          setResultMode('all');
                          setMovementQuery('');
                          setPickerStep('results');
                        }}
                        style={({ pressed }) => [styles.accessoryPickerTargetCard, pressed && styles.pressed]}
                      >
                        <AnatomyTargetArt athlete={athleteAnatomy} primary={muscle} style={styles.accessoryPickerTargetArt} />
                        <View style={styles.accessoryPickerTargetCopy}>
                          <Text style={styles.accessoryPickerTargetLabel}>{accessoryTaxonomyLabel(muscle)}</Text>
                          <Text style={styles.accessoryPickerTargetMeta}>Primary muscle</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.accessoryPickerSectionInset}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View all ${selectedRegion.label} movements`}
                      testID={`accessory-picker-view-all-${selectedRegion.key}`}
                      onPress={() => {
                        setPrimaryMuscleFilter('');
                        setRegionalMuscleFilters([...selectedRegion.muscles]);
                        setExecutionFamilyFilter('');
                        setResultMode('all');
                        setMovementQuery('');
                        setPickerStep('results');
                      }}
                      style={styles.trainingLiftSecondaryButton}
                    >
                      <Text style={styles.trainingLiftSecondaryText}>View All {selectedRegion.label} Movements</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                  {searchResults.some((movement) => movement.last_used_on) ? (
                    <View style={styles.accessoryPickerSectionInset}>
                      <Text style={styles.accessoryPickerSectionLabel}>Recently Used</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accessoryPickerRecentRail}>
                        {searchResults.filter((movement) => movement.last_used_on).slice(0, 6).map((movement) => (
                          <Pressable key={movement.id || movementPresetName(movement)} onPress={() => openMovementDetail(movement)} style={styles.accessoryPickerRecentCard}>
                            <Image source={accessoryPickerArtwork(movement).source} resizeMode="contain" style={styles.accessoryPickerRecentArt} />
                            <Text numberOfLines={2} style={styles.accessoryPickerRecentTitle}>{movementPresetName(movement)}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </>
              ) : null}

              {pickerStep === 'results' ? (
                <>
                  {primaryMuscleFilter ? (
                    <View style={styles.accessoryPickerHeroCompact}>
                      <AnatomyTargetArt athlete={athleteAnatomy} primary={primaryMuscleFilter} scale={1.12} style={styles.accessoryPickerHeroCompactArt} />
                      <View><Text style={styles.accessoryPickerKicker}>Muscle focus</Text><Text style={styles.accessoryPickerIntroTitle}>{accessoryTaxonomyLabel(primaryMuscleFilter)}</Text></View>
                    </View>
                  ) : regionalMuscleFilters.length && selectedRegion ? (
                    <View style={styles.accessoryPickerHeroCompact}>
                      <Image source={accessoryRegionalArtworkAsset(selectedRegion.artwork).source} resizeMode="contain" style={styles.accessoryPickerHeroCompactArt} />
                      <View><Text style={styles.accessoryPickerKicker}>Regional browse</Text><Text style={styles.accessoryPickerIntroTitle}>{selectedRegion.label}</Text></View>
                    </View>
                  ) : null}
                  <View style={styles.accessoryPickerSectionInset}>
                    <View style={styles.accessoryPickerSearchField}>
                      <Ionicons name="search-outline" size={20} color={colors.muted} />
                      <TextInput accessibilityLabel="Search accessory movements" value={movementQuery} onChangeText={setMovementQuery} placeholder="Search this movement scope" placeholderTextColor={colors.subtle} returnKeyType="search" style={styles.accessoryPickerSearchInput} />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trainingLiftFamilyRow}>
                      {([
                        ['all', 'All'],
                        ['favorites', 'Favorites'],
                        ['recent', 'Recent'],
                      ] as const).map(([mode, label]) => (
                        <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: resultMode === mode }} onPress={() => setResultMode(mode)} style={[styles.trainingLiftFamilyButton, resultMode === mode && styles.trainingLiftFamilyButtonActive]}><Text style={[styles.trainingLiftFamilyText, resultMode === mode && styles.trainingLiftFamilyTextActive]}>{label}</Text></Pressable>
                      ))}
                    </ScrollView>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trainingLiftFamilyRow}>
                      {[['', 'Any equipment'], ...ACCESSORY_EXECUTION_FAMILIES].map(([key, label]) => (
                        <Pressable key={key || 'all'} accessibilityRole="button" accessibilityState={{ selected: executionFamilyFilter === key }} onPress={() => setExecutionFamilyFilter(key)} style={[styles.accessoryPickerEquipmentChip, executionFamilyFilter === key && styles.trainingLiftFamilyButtonActive]}><Text style={[styles.trainingLiftFamilyText, executionFamilyFilter === key && styles.trainingLiftFamilyTextActive]}>{label}</Text></Pressable>
                      ))}
                    </ScrollView>
                    {resultList}
                    {canCreateCustom ? <Pressable accessibilityRole="button" onPress={openCustomCreator} style={styles.trainingLiftSecondaryButton}><Text style={styles.trainingLiftSecondaryText}>Can&apos;t find it? Create custom movement</Text></Pressable> : null}
                  </View>
                </>
              ) : null}

              {pickerStep === 'detail' && selectedMovement ? (
                <View style={styles.accessoryPickerDetail}>
                  <View style={styles.accessoryPickerDetailHero}>
                    <Image source={accessoryPickerArtwork(selectedMovement).source} resizeMode="contain" style={styles.accessoryPickerDetailArt} />
                    <Pressable accessibilityRole="button" accessibilityLabel={selectedMovement.is_favorite ? 'Remove from favorites' : 'Add to favorites'} onPress={() => void toggleFavorite(selectedMovement)} style={styles.accessoryPickerDetailFavorite}>
                      <Ionicons name={selectedMovement.is_favorite ? 'star' : 'star-outline'} size={20} color={selectedMovement.is_favorite ? SLColors.warning : colors.muted} />
                      <Text style={styles.accessoryPickerDetailFavoriteText}>{selectedMovement.is_favorite ? 'Favorited' : 'Favorite'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.accessoryPickerDetailRows}>
                    {[
                      ['Primary muscle', accessoryTaxonomyLabel(selectedMovement.primary_muscle_group)],
                      ['Secondary muscles', (selectedMovement.secondary_muscle_groups || []).map(accessoryTaxonomyLabel).join(', ') || 'None'],
                      ['Equipment family', accessoryTaxonomyLabel(selectedMovement.execution_family)],
                      ['Setup', selectedMovement.requires_equipment_configuration ? 'Choose exact equipment in the Session' : 'No equipment setup required'],
                      ['Source', selectedMovement.ownership_scope === 'coach' ? 'My Movement' : 'Strength Ledger'],
                      ...(selectedMovement.last_used_on ? [['Last used', selectedMovement.last_used_on]] : []),
                    ].map(([label, value]) => <View key={label} style={styles.accessoryPickerDetailRow}><Text style={styles.accessoryPickerDetailLabel}>{label}</Text><Text style={styles.accessoryPickerDetailValue}>{value || 'Not specified'}</Text></View>)}
                  </View>
                  <Pressable accessibilityRole="button" disabled={saving} onPress={confirmMovement} style={[styles.accessoryPickerPrimaryAction, saving && styles.editorDisabled]}><Text style={styles.accessoryPickerPrimaryActionText}>{saving ? 'Selecting...' : 'Select Movement'}</Text></Pressable>
                </View>
              ) : null}

              {pickerStep === 'review' && selectedMovement ? (
                <View style={styles.accessoryPickerReview}>
                  <View style={styles.accessoryPickerProgressRail}>
                    {[0, 1, 2, 3, 4].map((step) => <View key={step} style={[styles.accessoryPickerProgressNode, styles.accessoryPickerProgressNodeActive]} />)}
                  </View>
                  <View style={styles.accessoryPickerIntroFlush}>
                    <Text style={styles.accessoryPickerKicker}>Confirm selection</Text>
                    <Text style={styles.accessoryPickerIntroTitle}>Review the exact movement</Text>
                    <Text style={styles.trainingLiftMuted}>Confirm this identity before adding it to the Session Workspace.</Text>
                  </View>
                  <View style={styles.accessoryPickerSelectedSummary}>
                    <Image source={accessoryPickerArtwork(selectedMovement).source} resizeMode="contain" style={styles.accessoryPickerSelectedArt} />
                    <View style={styles.accessoryPickerMovementCopy}>
                      <Text style={styles.accessoryPickerMovementTitle}>{movementPresetName(selectedMovement)}</Text>
                      <Text style={styles.accessoryPickerMovementMeta}>{accessoryTaxonomyLabel(selectedMovement.execution_family)}</Text>
                      <Text style={styles.accessoryPickerMovementSource}>{accessoryTaxonomyLabel(selectedMovement.primary_muscle_group)} · Primary</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color={colors.violet} />
                  </View>
                  {searchResults.some((movement) => movement.id !== selectedMovement.id) ? (
                    <View style={styles.accessoryPickerReviewAlternatives}>
                      <Text style={styles.accessoryPickerSectionLabel}>Other Movements In This Scope</Text>
                      {searchResults.filter((movement) => movement.id !== selectedMovement.id).slice(0, 4).map((movement) => (
                        <Pressable key={movement.id || movementPresetName(movement)} onPress={() => openMovementDetail(movement)} style={styles.accessoryPickerAlternativeRow}>
                          <Image source={accessoryPickerArtwork(movement).source} resizeMode="contain" style={styles.accessoryPickerAlternativeArt} />
                          <View style={styles.accessoryPickerMovementCopy}>
                            <Text style={styles.accessoryPickerMovementTitle}>{movementPresetName(movement)}</Text>
                            <Text style={styles.accessoryPickerMovementMeta}>{accessoryTaxonomyLabel(movement.execution_family)}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => void confirmAndApplyMovement()} style={[styles.accessoryPickerConfirmAction, saving && styles.editorDisabled]}>
                    <Ionicons name="checkmark" size={20} color={SLColors.textInverted} />
                    <Text style={styles.accessoryPickerConfirmActionText}>{saving ? 'Adding...' : state?.mode === 'edit' ? 'Confirm Change' : 'Confirm & Add to Session'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {pickerStep === 'success' && selectedMovement ? (
                <View style={styles.accessoryPickerSuccess}>
                  <View style={styles.accessoryPickerSuccessMark}>
                    <Ionicons name="checkmark" size={54} color={colors.violet} />
                  </View>
                  <View style={styles.accessoryPickerSelectedSummary}>
                    <Image source={accessoryPickerArtwork(selectedMovement).source} resizeMode="contain" style={styles.accessoryPickerSelectedArt} />
                    <View style={styles.accessoryPickerMovementCopy}>
                      <Text style={styles.accessoryPickerMovementTitle}>{movementPresetName(selectedMovement)}</Text>
                      <Text style={styles.accessoryPickerMovementMeta}>{accessoryTaxonomyLabel(selectedMovement.execution_family)}</Text>
                      <Text style={styles.accessoryPickerMovementSource}>{accessoryTaxonomyLabel(selectedMovement.primary_muscle_group)} · Primary</Text>
                    </View>
                  </View>
                  <View style={styles.accessoryPickerSuccessContext}>
                    <Text style={styles.accessoryPickerSectionLabel}>Added To Session</Text>
                    {[
                      ['Position', state?.mode === 'edit' ? 'Existing accessory' : 'Next accessory'],
                      ['Sets', state?.mode === 'edit' ? (state.item?.sets ? `${state.item.sets} sets` : 'Preserved') : '3 sets'],
                      ['Rep target', state?.mode === 'edit' ? (state.item?.reps_text || (state.item?.reps ? `${state.item.reps} reps` : 'Preserved')) : '10–12 reps'],
                    ].map(([label, value]) => <View key={label} style={styles.accessoryPickerDetailRow}><Text style={styles.accessoryPickerDetailLabel}>{label}</Text><Text style={styles.accessoryPickerDetailValue}>{value}</Text></View>)}
                  </View>
                  <Pressable accessibilityRole="button" onPress={onDone} style={styles.accessoryPickerConfirmAction}>
                    <Text style={styles.accessoryPickerConfirmActionText}>Continue Editing Session</Text>
                  </Pressable>
                </View>
              ) : null}

              {CUSTOM_MOVEMENT_STEPS.includes(pickerStep) ? (
                <View style={styles.customMovementCreator}>
                  <View style={styles.customMovementStepMeta}>
                    <Text style={styles.customMovementStepCount}>{customStepNumber} / 5</Text>
                    <View style={styles.customMovementStepRail}>
                      {CUSTOM_MOVEMENT_STEPS.map((step, index) => <View key={step} style={[styles.customMovementStepSegment, index < customStepNumber && styles.customMovementStepSegmentActive]} />)}
                    </View>
                  </View>

                  {pickerStep === 'custom-name' ? (
                    <>
                      <View style={styles.accessoryPickerIntroFlush}>
                        <Text style={styles.accessoryPickerIntroTitle}>What are you creating?</Text>
                        <Text style={styles.trainingLiftMuted}>Start by giving your movement a clear, unique name.</Text>
                      </View>
                      <View style={styles.customMovementFieldGroup}>
                        <Text style={styles.trainingLiftFieldLabel}>Movement name</Text>
                        <TextInput value={setup.customMovement} onChangeText={(customMovement) => patchSetup({ customMovement })} autoFocus placeholder="Single-Arm Cable Face-Away Curl" placeholderTextColor={colors.subtle} maxLength={160} style={styles.customMovementNameInput} />
                      </View>
                      <View style={styles.accessoryPickerSimilaritySection}>
                        <Text style={styles.accessoryPickerSectionLabel}>Possible Matches</Text>
                        {reviewingCustom ? <View style={styles.trainingLiftLoadingRow}><ActivityIndicator color={colors.violet} /><Text style={styles.trainingLiftMuted}>Checking canonical names and your library...</Text></View> : null}
                        {!reviewingCustom && customReviewed && customMatches.length ? customMatches.slice(0, 4).map((match) => (
                          <Pressable key={`${match.tier}-${match.movement_definition.id}`} onPress={() => selectCustomMatch(match.movement_definition)} style={styles.customMovementMatchCard}>
                            <Image source={accessoryPickerArtwork(match.movement_definition).source} resizeMode="contain" style={styles.customMovementMatchArt} />
                            <View style={styles.accessoryPickerMovementCopy}>
                              <Text style={styles.accessoryPickerMovementTitle}>{movementPresetName(match.movement_definition)}</Text>
                              <Text style={styles.accessoryPickerMovementMeta}>{accessoryTaxonomyLabel(match.movement_definition.primary_muscle_group)} · {accessoryTaxonomyLabel(match.movement_definition.execution_family)}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                          </Pressable>
                        )) : null}
                        {!reviewingCustom && customReviewed && !customMatches.length ? <Text style={styles.trainingLiftMuted}>No plausible existing movement identities found.</Text> : null}
                      </View>
                      {customReviewed ? (
                        <Pressable accessibilityRole="button" onPress={() => setPickerStep('custom-primary')} style={styles.customMovementDistinctAction}>
                          <View><Text style={styles.customMovementDistinctTitle}>No, mine is different.</Text><Text style={styles.customMovementDistinctMeta}>Continue creating</Text></View>
                          <Ionicons name="arrow-forward" size={20} color={colors.violet} />
                        </Pressable>
                      ) : null}
                      {customError ? <Text style={styles.accessoryEditorErrorText}>{customError}</Text> : null}
                      <Pressable accessibilityRole="button" disabled={!customReviewed || reviewingCustom || !setup.customMovement.trim()} onPress={() => setPickerStep('custom-primary')} style={[styles.accessoryPickerPrimaryAction, (!customReviewed || reviewingCustom || !setup.customMovement.trim()) && styles.editorDisabled]}><Text style={styles.accessoryPickerPrimaryActionText}>Continue</Text></Pressable>
                    </>
                  ) : null}

                  {pickerStep === 'custom-primary' ? (
                    <>
                      <View style={styles.accessoryPickerIntroFlush}>
                        <Text style={styles.accessoryPickerIntroTitle}>What does this movement primarily train?</Text>
                        <Text style={styles.trainingLiftMuted}>Select the main muscle group.</Text>
                      </View>
                      {authoringLoading ? <View style={styles.trainingLiftLoadingRow}><ActivityIndicator color={colors.violet} /><Text style={styles.trainingLiftMuted}>Loading governed muscle targets...</Text></View> : null}
                      {authoringError ? <View style={styles.accessoryEditorStatusBlock}><Text style={styles.accessoryEditorErrorText}>{authoringError}</Text><Pressable onPress={() => setAuthoringRevision((value) => value + 1)} style={styles.trainingLiftSecondaryButton}><Text style={styles.trainingLiftSecondaryText}>Retry</Text></Pressable></View> : null}
                      <View style={styles.customMovementRegionGrid}>
                        {pickerRegions.map((region) => {
                          const selected = customPrimaryRegion?.key === region.key;
                          return <Pressable key={region.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setCustomPrimaryRegionKey(region.key)} style={[styles.customMovementRegionCard, selected && styles.customMovementChoiceActive]}><Image source={accessoryRegionalArtworkAsset(region.artwork).source} resizeMode="contain" style={styles.customMovementRegionArt} /><Text style={styles.customMovementChoiceLabel}>{region.label}</Text></Pressable>;
                        })}
                      </View>
                      {customPrimaryRegion ? (
                        <View style={styles.customMovementExactTargets}>
                          <Text style={styles.accessoryPickerSectionLabel}>Choose Exact Primary Muscle</Text>
                          <View style={styles.customMovementMuscleGrid}>
                            {customPrimaryRegion.muscles.map((muscle) => {
                              const selected = setup.primaryMuscleGroup === muscle;
                              return <Pressable key={muscle} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => patchSetup({ primaryMuscleGroup: muscle, secondaryMuscleGroups: setup.secondaryMuscleGroups.filter((value) => value !== muscle) })} style={[styles.customMovementMuscleCard, selected && styles.customMovementChoiceActive]}><AnatomyTargetArt athlete={athleteAnatomy} primary={muscle} style={styles.customMovementMuscleArt} /><Text style={styles.customMovementChoiceLabel}>{accessoryTaxonomyLabel(muscle)}</Text>{selected ? <Ionicons name="checkmark-circle" size={18} color={colors.violet} /> : null}</Pressable>;
                            })}
                          </View>
                        </View>
                      ) : null}
                      <View style={styles.customMovementFooterActions}><Pressable onPress={goBack} style={styles.customMovementBackAction}><Text style={styles.trainingLiftSecondaryText}>Back</Text></Pressable><Pressable disabled={!setup.primaryMuscleGroup} onPress={() => setPickerStep('custom-secondary')} style={[styles.accessoryPickerPrimaryAction, styles.customMovementFooterPrimary, !setup.primaryMuscleGroup && styles.editorDisabled]}><Text style={styles.accessoryPickerPrimaryActionText}>Continue</Text></Pressable></View>
                    </>
                  ) : null}

                  {pickerStep === 'custom-secondary' ? (
                    <>
                      <View style={styles.accessoryPickerIntroFlush}>
                        <View style={styles.customMovementPromptRow}><Text style={styles.accessoryPickerIntroTitle}>Any secondary muscles?</Text><Text style={styles.customMovementSelectedCount}>{setup.secondaryMuscleGroups.length} selected</Text></View>
                        <Text style={styles.trainingLiftMuted}>Select up to 3 muscles that are significantly involved.</Text>
                      </View>
                      <View style={styles.customMovementMuscleGrid}>
                        {visibleSecondaryMuscles.map((option) => {
                          const selected = setup.secondaryMuscleGroups.includes(option.key);
                          return <Pressable key={option.key} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => { const next = selected ? setup.secondaryMuscleGroups.filter((value) => value !== option.key) : [...setup.secondaryMuscleGroups, option.key]; if (next.length <= 3) patchSetup({ secondaryMuscleGroups: next }); }} style={[styles.customMovementMuscleCard, selected && styles.customMovementChoiceActive]}><AnatomyTargetArt athlete={athleteAnatomy} primary={option.key} style={styles.customMovementMuscleArt} /><Text style={styles.customMovementChoiceLabel}>{option.label}</Text>{selected ? <Ionicons name="checkmark-circle" size={18} color={colors.violet} /> : null}</Pressable>;
                        })}
                      </View>
                      {!customSecondaryExpanded && contextualSecondaryMuscles.length > visibleSecondaryMuscles.length ? <Pressable onPress={() => setCustomSecondaryExpanded(true)} style={styles.trainingLiftSecondaryButton}><Text style={styles.trainingLiftSecondaryText}>View all governed muscles</Text></Pressable> : null}
                      <View style={styles.customMovementFooterActions}><Pressable onPress={goBack} style={styles.customMovementBackAction}><Text style={styles.trainingLiftSecondaryText}>Back</Text></Pressable><Pressable onPress={() => setPickerStep('custom-execution')} style={[styles.accessoryPickerPrimaryAction, styles.customMovementFooterPrimary]}><Text style={styles.accessoryPickerPrimaryActionText}>Continue</Text></Pressable></View>
                    </>
                  ) : null}

                  {pickerStep === 'custom-execution' ? (
                    <>
                      <View style={styles.accessoryPickerIntroFlush}>
                        <Text style={styles.accessoryPickerIntroTitle}>How is it performed?</Text>
                        <Text style={styles.trainingLiftMuted}>Select the primary execution method.</Text>
                      </View>
                      <View style={styles.customMovementExecutionList}>
                        {options.execution_families.map((option) => {
                          const selected = setup.executionFamily === option.key;
                          const presentation = CUSTOM_EXECUTION_PRESENTATION[option.key as keyof typeof CUSTOM_EXECUTION_PRESENTATION] || CUSTOM_EXECUTION_PRESENTATION.OTHER_PORTABLE;
                          return <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => patchSetup({ executionFamily: option.key })} style={[styles.customMovementExecutionCard, selected && styles.customMovementChoiceActive]}><View style={styles.customMovementExecutionIcon}><Ionicons name={presentation.icon} size={25} color={selected ? colors.violet : colors.muted} /></View><View style={styles.accessoryPickerMovementCopy}><Text style={styles.accessoryPickerMovementTitle}>{option.label}</Text><Text style={styles.accessoryPickerMovementMeta}>{presentation.description}</Text></View>{selected ? <Ionicons name="checkmark-circle" size={21} color={colors.violet} /> : null}</Pressable>;
                        })}
                      </View>
                      {customError ? <Text style={styles.accessoryEditorErrorText}>{customError}</Text> : null}
                      <View style={styles.customMovementFooterActions}><Pressable onPress={goBack} style={styles.customMovementBackAction}><Text style={styles.trainingLiftSecondaryText}>Back</Text></Pressable><Pressable disabled={!setup.executionFamily || reviewingCustom} onPress={() => void advanceToCustomReview()} style={[styles.accessoryPickerPrimaryAction, styles.customMovementFooterPrimary, (!setup.executionFamily || reviewingCustom) && styles.editorDisabled]}><Text style={styles.accessoryPickerPrimaryActionText}>{reviewingCustom ? 'Checking...' : 'Continue'}</Text></Pressable></View>
                    </>
                  ) : null}

                  {pickerStep === 'custom-review' ? (
                    <>
                      <View style={styles.accessoryPickerIntroFlush}>
                        <Text style={styles.accessoryPickerIntroTitle}>Review your movement</Text>
                        <Text style={styles.trainingLiftMuted}>Review the details before adding it to your library.</Text>
                      </View>
                      <View style={styles.customMovementReviewHero}>
                        <AnatomyTargetArt athlete={athleteAnatomy} primary={setup.primaryMuscleGroup} secondary={setup.secondaryMuscleGroups} scale={0.88} size="card" style={styles.customMovementReviewArt} />
                        <View style={styles.customMovementReviewIdentity}><Text style={styles.customMovementReviewName}>{setup.customMovement}</Text>{[['Primary muscle', accessoryTaxonomyLabel(setup.primaryMuscleGroup)], ['Secondary muscles', setup.secondaryMuscleGroups.map(accessoryTaxonomyLabel).join(', ') || 'None'], ['Execution', accessoryTaxonomyLabel(setup.executionFamily)], ['Library', 'My Coaching Library']].map(([label, value]) => <View key={label} style={styles.customMovementReviewRow}><View style={styles.customMovementReviewDot} /><View><Text style={styles.accessoryPickerDetailLabel}>{label}</Text><Text style={styles.customMovementReviewValue}>{value}</Text></View></View>)}</View>
                      </View>
                      {!customNotesVisible ? <Pressable onPress={() => setCustomNotesVisible(true)} style={styles.customMovementQuietAction}><Text style={styles.trainingLiftSecondaryText}>+ Add optional coaching notes</Text></Pressable> : <TextInput value={setup.customNotes} onChangeText={(customNotes) => patchSetup({ customNotes })} placeholder="Optional movement definition notes" placeholderTextColor={colors.subtle} multiline maxLength={500} style={[styles.trainingLiftInput, styles.trainingLiftNotesInput]} />}
                      {customError ? <Text style={styles.accessoryEditorErrorText}>{customError}</Text> : null}
                      <Pressable accessibilityRole="button" disabled={creatingCustom || !customIdentityComplete || !customReviewed} onPress={() => void createReviewedCustomMovement()} style={[styles.accessoryPickerConfirmAction, (creatingCustom || !customIdentityComplete || !customReviewed) && styles.editorDisabled]}><Ionicons name="checkmark" size={20} color={SLColors.textInverted} /><Text style={styles.accessoryPickerConfirmActionText}>{creatingCustom ? 'Creating...' : 'Create Movement'}</Text></Pressable>
                      <Pressable onPress={goBack} style={styles.customMovementBackAction}><Text style={styles.trainingLiftSecondaryText}>Back</Text></Pressable>
                    </>
                  ) : null}
                </View>
              ) : null}

              {pickerStep === 'custom-created' && selectedMovement ? (
                <View style={styles.customMovementCreated}>
                  <View style={styles.accessoryPickerSuccessMark}><Ionicons name="checkmark" size={54} color={colors.violet} /></View>
                  <View style={styles.customMovementCreatedCopy}><Text style={styles.customMovementCreatedKicker}>Added to your library</Text><Text style={styles.trainingLiftMuted}>This movement is now available whenever you program an athlete you are authorized to coach.</Text></View>
                  <View style={styles.accessoryPickerSelectedSummary}><Image source={accessoryPickerArtwork(selectedMovement).source} resizeMode="contain" style={styles.accessoryPickerSelectedArt} /><View style={styles.accessoryPickerMovementCopy}><Text style={styles.accessoryPickerMovementTitle}>{movementPresetName(selectedMovement)}</Text><Text style={styles.accessoryPickerMovementMeta}>{accessoryTaxonomyLabel(selectedMovement.primary_muscle_group)} · {accessoryTaxonomyLabel(selectedMovement.execution_family)}</Text></View></View>
                  <Pressable disabled={saving} onPress={() => void applyCreatedCustomMovement()} style={[styles.accessoryPickerConfirmAction, saving && styles.editorDisabled]}><Text style={styles.accessoryPickerConfirmActionText}>{saving ? 'Using...' : 'Use This Movement'}</Text></Pressable>
                  <Pressable onPress={onDone} style={styles.customMovementBackAction}><Text style={styles.trainingLiftSecondaryText}>Done</Text></Pressable>
                </View>
              ) : null}

            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


function TrainingLiftSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.trainingLiftSection}>
      <Text style={styles.trainingLiftSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TrainingLiftOptionCard({
  title,
  detail,
  selected,
  tone,
  onPress,
}: {
  title: string;
  detail?: string;
  selected: boolean;
  tone?: 'primary' | 'amber';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.trainingLiftOptionCard,
        tone === 'amber' && styles.trainingLiftOptionCardAmber,
        selected && styles.trainingLiftOptionCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.trainingLiftOptionTitle, selected && styles.trainingLiftOptionTitleSelected]}>{title}</Text>
      {detail ? <Text style={styles.trainingLiftOptionDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

function ReorderEditorModal({
  state,
  coreItems,
  accessoryItems,
  saving,
  reduceMotion,
  onChange,
  onCancel,
  onApply,
}: {
  state: ReorderEditorState | null;
  coreItems: WorkoutItem[];
  accessoryItems: WorkoutItem[];
  saving: boolean;
  reduceMotion: boolean;
  onChange: (state: ReorderEditorState) => void;
  onCancel: () => void;
  onApply: (state: ReorderEditorState) => void | Promise<void>;
}) {
  const visible = !!state;
  const coreById = useMemo(() => mapItemsById(coreItems), [coreItems]);
  const accessoryById = useMemo(() => mapItemsById(accessoryItems), [accessoryItems]);
  const [dragging, setDragging] = useState(false);

  const moveItem = (kind: 'core' | 'accessory', id: number, targetIndex: number) => {
    if (!state) return;
    const key = kind === 'core' ? 'coreIds' : 'accessoryIds';
    const ids = [...state[key]];
    const index = ids.indexOf(id);
    const nextIndex = Math.max(0, Math.min(ids.length - 1, targetIndex));
    if (index < 0 || nextIndex === index) return;
    const [removed] = ids.splice(index, 1);
    ids.splice(nextIndex, 0, removed);
    onChange({ ...state, [key]: ids });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.trainingLiftEditorScreen}>
        <View style={styles.trainingLiftEditorHeader}>
          <View>
            <Text style={styles.trainingLiftEditorEyebrow}>Workspace edit</Text>
            <Text style={styles.trainingLiftEditorTitle}>Reorder Session Items</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel reorder"
            onPress={onCancel}
            style={({ pressed }) => [styles.trainingLiftCancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.trainingLiftCancelText}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.trainingLiftEditorScroll}
          contentContainerStyle={styles.trainingLiftEditorContent}
          scrollEnabled={!dragging}
        >
          <ReorderSection
            title="Core Lifts"
            ids={state?.coreIds || []}
            itemsById={coreById}
            kind="core"
            onMove={moveItem}
            onDraggingChange={setDragging}
            reduceMotion={reduceMotion}
          />
          <ReorderSection
            title="Accessories"
            ids={state?.accessoryIds || []}
            itemsById={accessoryById}
            kind="accessory"
            onMove={moveItem}
            onDraggingChange={setDragging}
            reduceMotion={reduceMotion}
          />
        </ScrollView>

        {state ? (
          <View style={styles.trainingLiftEditorActions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onCancel}
              style={({ pressed }) => [styles.trainingLiftActionSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.trainingLiftActionSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => onApply(state)}
              style={({ pressed }) => [
                styles.trainingLiftActionPrimary,
                saving && styles.editorDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.trainingLiftActionPrimaryText}>{saving ? 'Applying...' : 'Apply Order'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function ReorderSection({
  title,
  ids,
  itemsById,
  kind,
  onMove,
  onDraggingChange,
  reduceMotion,
}: {
  title: string;
  ids: number[];
  itemsById: Map<number, WorkoutItem>;
  kind: 'core' | 'accessory';
  onMove: (kind: 'core' | 'accessory', id: number, targetIndex: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  reduceMotion: boolean;
}) {
  return (
    <TrainingLiftSection title={title}>
      <View style={styles.reorderList}>
        {ids.length ? ids.map((id, index) => {
          const item = itemsById.get(id);
          if (!item) return null;
          const name = workspaceMovementName(item, kind);
          const meta = kind === 'core'
            ? `${designationLabel(item.designation, 'core')} · ${variantLabel(item.variant) || 'Straight'}`
            : accessoryPrescriptionText(item);
          return (
            <DraggableReorderRow
              key={`${kind}-${id}`}
              id={id}
              kind={kind}
              index={index}
              itemCount={ids.length}
              name={name}
              meta={meta}
              onMove={onMove}
              onDraggingChange={onDraggingChange}
              reduceMotion={reduceMotion}
            />
          );
        }) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>No {title.toLowerCase()} in this session.</Text>
          </View>
        )}
      </View>
    </TrainingLiftSection>
  );
}

function DraggableReorderRow({
  id,
  kind,
  index,
  itemCount,
  name,
  meta,
  onMove,
  onDraggingChange,
  reduceMotion,
}: {
  id: number;
  kind: 'core' | 'accessory';
  index: number;
  itemCount: number;
  name: string;
  meta: string;
  onMove: (kind: 'core' | 'accessory', id: number, targetIndex: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  reduceMotion: boolean;
}) {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(140)
    .onBegin(() => {
      isDragging.value = true;
      runOnJS(onDraggingChange)(true);
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onFinalize(() => {
      const rawTarget = index + Math.round(translateY.value / REORDER_ROW_STEP);
      const targetIndex = Math.max(0, Math.min(itemCount - 1, rawTarget));
      translateY.value = reduceMotion ? 0 : withSpring(0, { damping: 18, stiffness: 220 });
      isDragging.value = false;
      runOnJS(onDraggingChange)(false);
      if (targetIndex !== index) {
        runOnJS(onMove)(kind, id, targetIndex);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: reduceMotion ? 1 : withSpring(isDragging.value ? 1.025 : 1, { damping: 18, stiffness: 240 }) },
    ],
    opacity: reduceMotion ? 1 : withSpring(isDragging.value ? 0.96 : 1, { damping: 18, stiffness: 240 }),
    zIndex: isDragging.value ? 20 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.reorderRow, animatedStyle]}>
        <View style={styles.reorderHandle}>
          <Ionicons name="reorder-three-outline" size={22} color={colors.violet} />
        </View>
        <View style={styles.reorderRowTextWrap}>
          <Text style={styles.reorderRowTitle}>{name}</Text>
          <Text style={styles.reorderRowMeta}>{meta}</Text>
        </View>
        <View style={styles.reorderButtonGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Move ${name} up`}
            accessibilityState={{ disabled: index === 0 }}
            disabled={index === 0}
            onPress={() => onMove(kind, id, index - 1)}
            style={({ pressed }) => [styles.reorderStepButton, index === 0 && styles.editorDisabled, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-up" size={16} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Move ${name} down`}
            accessibilityState={{ disabled: index === itemCount - 1 }}
            disabled={index === itemCount - 1}
            onPress={() => onMove(kind, id, index + 1)}
            style={({ pressed }) => [styles.reorderStepButton, index === itemCount - 1 && styles.editorDisabled, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function CompactSessionActions({
  status,
  capabilities,
  pendingAction,
  onlyDelete,
  onAssign,
  onRevert,
  onCopy,
  onMove,
  onSaveTemplate,
  onDelete,
}: {
  status?: string | null;
  capabilities: WorkspaceCapabilities;
  pendingAction: SessionActionKey | null;
  onlyDelete?: boolean;
  onAssign: () => void;
  onRevert: () => void;
  onCopy: () => void;
  onMove: () => void;
  onSaveTemplate: () => void;
  onDelete: () => void;
}) {
  const isDraft = String(status || '').toLowerCase() === 'draft';
  type CompactAction = {
    key: SessionActionKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    disabled?: boolean;
    danger?: boolean;
  };
  const lifecycleActions: CompactAction[] = onlyDelete ? [] : [
    ...(isDraft && capabilities.can_assign
      ? [{ key: 'assign' as const, label: 'Assign', icon: 'checkmark-circle-outline' as const, onPress: onAssign }]
      : !isDraft && capabilities.can_revert_to_draft
        ? [{ key: 'revert' as const, label: 'Revert to Draft', icon: 'arrow-undo-outline' as const, onPress: onRevert }]
        : []),
  ];
  const reuseActions: CompactAction[] = onlyDelete ? [] : [
    ...(capabilities.can_copy ? [{ key: 'copy', label: 'Copy Session To', icon: 'copy-outline', onPress: onCopy } as const] : []),
    ...(capabilities.can_move ? [{ key: 'move', label: 'Move Session', icon: 'move-outline', onPress: onMove } as const] : []),
    ...(capabilities.can_save_template ? [{ key: 'template', label: 'Save as Template', icon: 'document-text-outline', onPress: onSaveTemplate } as const] : []),
  ];
  const dangerActions: CompactAction[] = [
    ...(capabilities.can_delete ? [{ key: 'delete', label: 'Delete Session', icon: 'trash-outline', onPress: onDelete, danger: true } as const] : []),
  ];
  const sections = [
    { key: 'lifecycle', label: 'Lifecycle', color: SLColors.success, actions: lifecycleActions },
    { key: 'reuse', label: 'Reuse & Organize', color: SLColors.warning, actions: reuseActions },
    { key: 'danger', label: 'Danger Zone', color: SLColors.danger, actions: dangerActions },
  ].filter((section) => section.actions.length > 0);

  return (
    <View style={styles.sessionActions}>
      {sections.map((section, sectionIndex) => (
        <React.Fragment key={section.key}>
          {sectionIndex > 0 ? <View style={styles.sessionActionDivider} /> : null}
          <Text style={[styles.sessionActionSectionLabel, { color: section.color }]}>{section.label}</Text>
          {section.actions.map((action) => {
            const busy = pendingAction === action.key;
            const disabled = !!pendingAction || !!action.disabled;
            return (
              <Pressable
                key={action.key}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled }}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.sessionActionButton,
                  action.danger && styles.sessionActionDangerButton,
                  disabled && styles.sessionActionDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={section.color} />
                ) : (
                  <Ionicons name={action.icon} size={SL_TAB_ROW_CONTROL.iconSize} color={section.color} />
                )}
                <Text style={[styles.sessionActionText, action.danger && styles.sessionActionDangerText]}>{action.label}</Text>
              </Pressable>
            );
          })}
        </React.Fragment>
      ))}
    </View>
  );
}

function SessionCalendarModal({
  visible,
  title,
  actionLabel,
  initialDate,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  actionLabel: string;
  initialDate: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (dateValue: string) => void | Promise<void>;
}) {
  const initial = parseDate(initialDate) || new Date();
  const [monthCursor, setMonthCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toIsoDate(initial));

  useEffect(() => {
    if (!visible) return;
    const next = parseDate(initialDate) || new Date();
    setMonthCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    setSelectedDate(toIsoDate(next));
  }, [initialDate, visible]);

  const days = useMemo(() => calendarDaysForMonth(monthCursor), [monthCursor]);
  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalScrim}>
        <View style={styles.calendarModal}>
          <View style={styles.calendarHeader}>
            <View>
              <Text style={styles.calendarEyebrow}>Destination</Text>
              <Text style={styles.calendarTitle}>{title}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close calendar"
              onPress={onCancel}
              style={({ pressed }) => [styles.calendarClose, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>

          <View style={styles.calendarMonthRow}>
            <Pressable onPress={() => shiftMonth(-1)} style={styles.calendarMonthButton}>
              <Ionicons name="chevron-back" size={18} color={colors.textStrong} />
            </Pressable>
            <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
            <Pressable onPress={() => shiftMonth(1)} style={styles.calendarMonthButton}>
              <Ionicons name="chevron-forward" size={18} color={colors.textStrong} />
            </Pressable>
          </View>

          <View style={styles.calendarWeekdays}>
            {['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'].map((day) => (
              <Text key={day} style={styles.calendarWeekday}>{day}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              const iso = day ? toIsoDate(day) : '';
              const selected = iso === selectedDate;
              return (
                <Pressable
                  key={`${iso || 'empty'}-${index}`}
                  disabled={!day}
                  onPress={() => day && setSelectedDate(iso)}
                  style={({ pressed }) => [
                    styles.calendarDay,
                    selected && styles.calendarDaySelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected]}>
                    {day ? day.getDate() : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.calendarFooter}>
            <Text style={styles.calendarSelectedText}>{formatFullDate(selectedDate)}</Text>
            <View style={styles.calendarFooterActions}>
              <Pressable onPress={onCancel} disabled={busy} style={styles.calendarSecondary}>
                <Text style={styles.calendarSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => onConfirm(selectedDate)}
                disabled={busy}
                style={[styles.calendarPrimary, busy && styles.editorDisabled]}
              >
                <Text style={styles.calendarPrimaryText}>{busy ? 'Working...' : actionLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function sessionTitle(label?: string | null) {
  const text = String(label || '').trim();
  return text || 'Session';
}

function sessionContext(athleteName?: string | null, label?: string | null, dateValue?: string | null) {
  const athlete = String(athleteName || '').trim();
  const week = weekFromLabel(label);
  const date = formatContextDate(dateValue);
  return [athlete || 'Athlete', week, date || 'Unscheduled'].filter(Boolean).join(' • ');
}

function weekFromLabel(label?: string | null) {
  const match = String(label || '').match(/W(\d+)/i);
  return match ? `Week ${match[1]}` : '';
}

function humanStatus(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return 'Draft';
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatContextDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIso() {
  return toIsoDate(new Date());
}

function formatFullDate(value?: string | null) {
  const parsed = parseDate(value);
  if (!parsed) return 'Choose a date';
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calendarDaysForMonth(monthCursor: Date) {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function movementPresetName(value?: MovementPreset | string | null) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value.name || value.display_name || '').trim();
}

function movementPresetSearchText(value?: MovementPreset | string | null) {
  if (!value) return '';
  if (typeof value === 'string') return value.toLowerCase();
  return [movementPresetName(value), ...(value.aliases || [])]
    .join(' ')
    .toLowerCase();
}

function accessoryTaxonomyLabel(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const muscle = ACCESSORY_MUSCLE_GROUPS.find(([key]) => key === normalized.toLowerCase());
  if (muscle) return muscle[1];
  const execution = ACCESSORY_EXECUTION_FAMILIES.find(([key]) => key === normalized.toUpperCase());
  if (execution) return execution[1];
  return equipmentPresentationLabel(normalized, normalized);
}

function movementResultContext(value?: MovementPreset | null) {
  if (!value) return 'Accessory movement';
  const primary = accessoryTaxonomyLabel(value.primary_muscle_group) || 'Primary muscle not specified';
  const secondary = (value.secondary_muscle_groups || [])
    .map(accessoryTaxonomyLabel)
    .filter(Boolean);
  const execution = accessoryTaxonomyLabel(value.execution_family) || 'Execution not specified';
  return [
    primary,
    secondary.length ? `Secondary: ${secondary.join(', ')}` : 'Secondary: None',
    execution,
  ].join(' • ');
}

function uniqueMovementResults(items: MovementPreset[]) {
  const seen = new Set<number | string>();
  return items.filter((item) => {
    const key = item.id ?? movementPresetName(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function movementSearchResultGroups(value: any): MovementSearchResultGroups | null {
  const selectedMuscle = String(value?.selected_muscle_group || '').trim();
  if (!selectedMuscle || !value?.primary || !value?.secondary) return null;
  const normalizeGroup = (group: any): MovementSearchResultGroup => ({
    items: Array.isArray(group?.items) ? group.items : [],
    total_count: Math.max(0, Number(group?.total_count) || 0),
    next_cursor: typeof group?.next_cursor === 'string' ? group.next_cursor : null,
  });
  return {
    selected_muscle_group: selectedMuscle,
    primary: normalizeGroup(value.primary),
    secondary: normalizeGroup(value.secondary),
  };
}

function accessoryGroupsWithCanonicalIdentity(categories: MovementPresetGroup[], definitions: MovementPreset[], keyPrefix = 'identity') {
  if (!definitions.length) return categories;
  const grouped = new Map<string, MovementPresetGroup>();
  const retained: MovementPresetGroup[] = [];
  categories.forEach((group) => {
    if (group.key.startsWith(`${keyPrefix}_`)) {
      grouped.set(group.key, { ...group, movements: [...(group.movements || [])] });
    } else {
      retained.push(group);
    }
  });
  definitions.forEach((definition) => {
    const familyName = String(definition.family_display_name || definition.family || 'Equipment Catalog').trim();
    const key = `${keyPrefix}_${String(definition.family || familyName).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    const current = grouped.get(key) || { key, name: familyName, movements: [] };
    const duplicate = current.movements?.some((movement) => typeof movement === 'object'
      && ((movement.id && movement.id === definition.id) || movementPresetName(movement).toLowerCase() === movementPresetName(definition).toLowerCase()));
    if (!duplicate) current.movements?.push(definition);
    grouped.set(key, current);
  });
  return [...retained, ...Array.from(grouped.values())];
}

function movementPresetFromValue(value: MovementPreset | string | null | undefined, group?: MovementPresetGroup | null) {
  const name = movementPresetName(value);
  const preset = typeof value === 'object' && value ? value : null;
  return {
    name,
    coreMovementId: Number(preset?.core_movement_id || preset?.id) || null,
    lift: String(preset?.lift || (group?.key === 'competition_lifts'
      ? name === 'Competition Bench' ? 'BN' : name === 'Competition Deadlift' ? 'DL' : 'SQ'
      : 'VR')).toUpperCase(),
    categoryKey: preset?.category_key || group?.key || '',
  };
}

function movementGroupByKey(groups: MovementPresetGroup[], key?: string | null) {
  return groups.find((group) => group.key === key) || null;
}

function findTrainingPreset(groups: MovementPresetGroup[], movementName: string) {
  const wanted = String(movementName || '').trim().toLowerCase();
  if (!wanted) return null;
  for (const group of groups) {
    for (const movement of group.movements || []) {
      const preset = movementPresetFromValue(movement, group);
      if (preset.name.trim().toLowerCase() === wanted) {
        return { group, preset };
      }
    }
  }
  return null;
}

function defaultTrainingLiftSetup(existingCount: number, groups: MovementPresetGroup[]): TrainingLiftSetup {
  const fallback = 'Competition Squat';
  const found = findTrainingPreset(groups, fallback);
  const firstGroup = groups[0] || null;
  const firstPreset = movementPresetFromValue(firstGroup?.movements?.[0] || fallback, firstGroup);
  return {
    movement: found?.preset.name || firstPreset.name || fallback,
    coreMovementId: found?.preset.coreMovementId || firstPreset.coreMovementId || null,
    family: found?.group.key || firstGroup?.key || 'competition_lifts',
    lift: found?.preset.lift || firstPreset.lift || 'SQ',
    designation: existingCount ? 'SECONDARY' : 'PRIMARY',
    scheme: 'STRAIGHT',
    mode: 'RPE',
    notes: '',
    customMovement: '',
    targetLow: '',
    targetHigh: '',
  };
}

function findAccessoryPreset(groups: MovementPresetGroup[], movementName: string) {
  const wanted = String(movementName || '').trim().toLowerCase();
  if (!wanted) return null;
  for (const group of groups) {
    for (const movement of group.movements || []) {
      const name = movementPresetName(movement);
      if (name.trim().toLowerCase() === wanted) {
        return { group, name, definition: typeof movement === 'object' ? movement : null };
      }
    }
  }
  return null;
}

function defaultAccessorySetup(groups: MovementPresetGroup[]): AccessorySetup {
  const fallback = 'Chest-Supported Row';
  const found = findAccessoryPreset(groups, fallback);
  const firstGroup = groups[0] || null;
  const firstValue = firstGroup?.movements?.[0] || null;
  const firstMovement = movementPresetName(firstValue);
  const firstDefinition = typeof firstValue === 'object' ? firstValue : null;
  const definition = found?.definition || firstDefinition;
  return {
    movement: found?.name || firstMovement || fallback,
    movementDefinitionId: definition?.id || null,
    ownershipScope: definition?.ownership_scope || '',
    libraryScope: definition?.library_scope || '',
    family: found?.group.key || firstGroup?.key || 'lats_upper_back',
    notes: '',
    customMovement: '',
    supersetGroup: '',
    supersetPosition: '',
    equipmentType: '',
    loadingImplementation: '',
    loadConvention: '',
    measurementType: '',
    sidedness: '',
    primaryMuscleGroup: definition?.primary_muscle_group || '',
    secondaryMuscleGroups: definition?.secondary_muscle_groups || [],
    executionFamily: definition?.execution_family || '',
    customNotes: definition?.custom_notes || '',
  };
}

function mapItemsById(items: WorkoutItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function accessoryPrescriptionText(item: WorkoutItem) {
  const sets = numberText(item.sets);
  const reps = String(item.reps_text || numberText(item.reps) || '').trim();
  const rir = item.rir_target != null ? `@ ${formatNumber(item.rir_target)} RIR` : '';
  return [sets && reps ? `${sets} x ${reps}` : sets || reps, rir].filter(Boolean).join(' ');
}

function liftName(lift?: string | null) {
  const key = String(lift || '').toUpperCase();
  if (key === 'SQ') return 'Squat';
  if (key === 'BN') return 'Bench';
  if (key === 'DL') return 'Deadlift';
  if (key === 'OHP') return 'Overhead Press';
  if (key === 'AX') return 'Accessory';
  if (key === 'VR') return 'Variant';
  return key;
}

function designationLabel(value?: string | null, kind?: 'core' | 'accessory') {
  const text = String(value || '').trim();
  if (text) {
    return text
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return kind === 'core' ? 'Core Lift' : 'Accessory';
}

function workspaceMovementName(item: WorkoutItem, kind: EditKind) {
  const movement = String(item.movement || item.original_movement || liftName(item.lift) || '').trim() || 'Training item';
  if (kind !== 'core') return movement;
  const designation = designationLabel(item.designation, kind);
  return designation && designation !== 'Core Lift'
    ? `${designation} ${movement}`
    : movement;
}

function variantLabel(value?: string | null) {
  const key = String(value || '').toUpperCase();
  if (!key || key === 'ACC') return '';
  if (key === 'BK') return 'Backdown';
  if (key === 'FULL_CUSTOM') return 'Custom';
  return key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function numberText(value?: number | null) {
  if (value == null) return '';
  return formatNumber(value);
}

function formatNumber(value: number) {
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

const styles = StyleSheet.create({
  anatomyTargetArt: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  programmingWorkspaceStage: {
    backgroundColor: '#08090D',
    paddingTop: 8,
  },
  embeddedWorkspaceStage: {
    paddingTop: 0,
  },
  programmingWeekContext: {
    minHeight: 66,
    paddingHorizontal: SLLayout.screenGutter,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  programmingWeekBack: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programmingWeekContextCopy: { flex: 1 },
  programmingWeekContextArt: {
    width: 50,
    height: 52,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168,101,255,0.34)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(70,31,100,0.16)',
  },
  programmingWeekContextAnatomy: { width: '100%', height: '100%' },
  programmingWeekContextTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  programmingWeekContextMeta: {
    color: colors.muted,
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
    marginTop: 2,
  },
  programmingWorkspaceSheet: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.line,
    backgroundColor: SLColors.canvas,
  },
  programmingWorkspaceHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: colors.subtle,
    marginTop: 7,
    marginBottom: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 10,
    paddingBottom: 128,
    gap: 16,
  },
  stateBox: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  stateTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  stateBody: {
    color: colors.muted,
    textAlign: 'center',
    fontFamily: SLFontFamilies.sansMedium,
  },
  workspaceHeader: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: SLColors.surfaceInset,
    borderRadius: SLRadius.xl,
    padding: 18,
    gap: 10,
    ...SLShadows.raised,
  },
  workspaceLockedReason: {
    color: colors.muted,
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  sessionNotesPanel: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: SLColors.surfaceInset,
    borderRadius: SLRadius.lg,
    padding: 14,
    gap: 10,
  },
  sessionNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionNotesTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionNotesEditButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  sessionNotesEditText: {
    color: colors.violet,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionNotesBody: {
    color: colors.muted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  sessionNotesEmpty: {
    color: colors.subtle,
  },
  sessionNotesInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: SLRadius.md,
    color: colors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  sessionNotesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sessionName: {
    color: colors.textStrong,
  },
  sessionNameButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '100%',
  },
  sessionRenameEditor: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  sessionRenameInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
    backgroundColor: 'rgba(8, 8, 12, 0.38)',
    borderRadius: SLRadius.md,
    color: colors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: SLTypography.screenTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionRenameActions: {
    flexDirection: 'row',
    gap: 8,
  },
  sessionRenameSecondary: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(10, 8, 12, 0.24)',
    paddingHorizontal: 12,
  },
  sessionRenameSecondaryText: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionRenamePrimary: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.24)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(167, 203, 181, 0.12)',
    paddingHorizontal: 14,
  },
  sessionRenamePrimaryText: {
    color: colors.green,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerMetaCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 9,
  },
  statusPill: {
    color: colors.green,
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.24)',
    backgroundColor: 'rgba(167, 203, 181, 0.08)',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
    overflow: 'hidden',
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    flexBasis: '100%',
    flexGrow: 1,
  },
  headerStartButton: {
    minHeight: 38,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.32)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(167, 203, 181, 0.14)',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  headerStartText: {
    color: colors.green,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  headerFullEditorButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.canvasRaised,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  headerFullEditorText: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.18)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(10, 8, 12, 0.36)',
  },
  headerReorderButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexShrink: 0,
  },
  headerReorderText: {
    color: colors.violet,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionMeta: {
    color: colors.muted,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  sectionTabs: {
    minHeight: 50,
    flexDirection: 'row',
    gap: 8,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: SLColors.surfaceInset,
  },
  sectionTab: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: SLRadius.md,
    backgroundColor: 'transparent',
  },
  sectionTabSelected: {
    borderColor: 'rgba(167, 139, 250, 0.34)',
    backgroundColor: SLColors.surfaceSelected,
  },
  sectionTabLabel: {
    color: colors.muted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  sectionTabLabelSelected: {
    color: colors.textStrong,
  },
  sectionTabCount: {
    minWidth: 24,
    color: colors.subtle,
    textAlign: 'center',
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  sectionTabCountSelected: {
    color: colors.violet,
  },
  sectionWorkspace: {
    gap: 12,
  },
  sectionWorkspaceHidden: {
    display: 'none',
  },
  sectionHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.hero.fontSize,
    lineHeight: 34,
    fontFamily: SLFontFamilies.sansBold,
  },
  sectionCountPill: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: 'rgba(167, 139, 250, 0.09)',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansBold,
    overflow: 'hidden',
  },
  sectionActionButton: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  sectionActionText: {
    color: colors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  liftCard: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(20, 18, 22, 0.44)',
    borderRadius: SLRadius.lg,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 15,
    gap: 14,
  },
  liftCardAccessory: {
    backgroundColor: 'rgba(18, 20, 20, 0.40)',
  },
  liftHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  liftTitleRow: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 220,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liftIconShell: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.26)',
    backgroundColor: 'rgba(167, 139, 250, 0.14)',
    borderRadius: SLRadius.md,
  },
  liftIconShellAccessory: {
    borderColor: 'rgba(167, 203, 181, 0.22)',
    backgroundColor: 'rgba(167, 203, 181, 0.10)',
  },
  liftTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  liftName: {
    color: colors.textStrong,
    fontSize: SLTypography.title.fontSize,
    lineHeight: 28,
    fontFamily: SLFontFamilies.sansBold,
  },
  liftTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  softTag: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(10, 8, 12, 0.28)',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansBold,
    overflow: 'hidden',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineEditButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.16)',
    backgroundColor: 'rgba(10, 8, 12, 0.34)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  inlineEditText: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  prescriptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 9,
  },
  tokenLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  tokenJoiner: {
    color: colors.muted,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  prescriptionText: {
    color: colors.textStrong,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.18)',
    backgroundColor: 'rgba(12, 12, 18, 0.40)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
    overflow: 'hidden',
  },
  prescriptionTokenText: {
    color: colors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  loadStyleInfoButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.18)',
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  targetText: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(10, 8, 12, 0.32)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
    overflow: 'hidden',
  },
  targetTextUnset: {
    color: colors.subtle,
    borderStyle: 'dashed',
    backgroundColor: SLColors.canvasRaised,
  },
  plannedSetList: {
    gap: 5,
    paddingTop: 2,
  },
  inlineEditor: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
    backgroundColor: 'rgba(22, 18, 28, 0.58)',
    borderRadius: SLRadius.lg,
    padding: 13,
    gap: 12,
  },
  webValueEditor: {
    gap: 9,
  },
  repTargetEditor: {
    gap: 12,
  },
  repTypeGrid: {
    gap: 8,
  },
  repTypeButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(8, 8, 12, 0.30)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  repTypeButtonActive: {
    borderColor: 'rgba(167, 139, 250, 0.44)',
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
  },
  repTypeDot: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.24)',
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
  },
  repTypeDotActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  repTypeText: {
    color: colors.muted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  repTypeTextActive: {
    color: colors.textStrong,
  },
  repWheelBlock: {
    gap: 8,
  },
  repRangeGrid: {
    gap: 12,
  },
  amrapSelectedBox: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.30)',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderRadius: SLRadius.lg,
  },
  amrapSelectedText: {
    color: colors.textStrong,
    fontSize: SLTypography.title.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  wheelFrame: {
    position: 'relative',
    minHeight: 78,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
    borderRadius: SLRadius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  wheelCenterMarker: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: '50%',
    width: WHEEL_ITEM_WIDTH,
    marginLeft: -WHEEL_ITEM_WIDTH / 2,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.44)',
    backgroundColor: 'rgba(167, 139, 250, 0.20)',
    borderRadius: SLRadius.md,
    zIndex: 0,
  },
  wheelContent: {
    alignItems: 'center',
  },
  wheelItem: {
    width: WHEEL_ITEM_WIDTH,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    color: colors.muted,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  wheelItemTextSelected: {
    color: colors.textStrong,
    fontSize: SLTypography.screenTitle.fontSize,
  },
  webEditorMeta: {
    gap: 5,
  },
  webEditorMetaLabel: {
    color: colors.subtle,
    fontSize: SLTypography.micro.fontSize,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  webEditorMetaValue: {
    color: colors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  webEditorMetaHint: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  webLoadEditor: {
    gap: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.08)',
    paddingTop: 12,
  },
  webLoadStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  webLoadStepperLabel: {
    width: 92,
    color: colors.muted,
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  webLoadStepButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
  },
  webLoadStepText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 22,
    fontFamily: SLFontFamilies.sansBold,
  },
  webLoadField: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 10,
  },
  webLoadPrefix: {
    color: colors.muted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
    marginRight: 4,
  },
  webLoadInput: {
    flex: 1,
    color: colors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
    paddingVertical: 7,
  },
  webLoadUnit: {
    color: colors.muted,
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  webLoadActions: {
    flexDirection: 'row',
    gap: 8,
  },
  webLoadAction: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(10, 8, 12, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  webLoadActionText: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  editorFieldFull: {
    gap: 6,
  },
  editorLabel: {
    color: colors.subtle,
    fontSize: SLTypography.micro.fontSize,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  editorInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
    borderRadius: SLRadius.md,
    color: colors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  editorNotesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: SLFontFamilies.sansMedium,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editorSecondary: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(10, 8, 12, 0.22)',
    paddingHorizontal: 14,
  },
  editorSecondaryText: {
    color: colors.muted,
    fontSize: SLTypography.rowTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  editorPrimary: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.24)',
    backgroundColor: 'rgba(167, 203, 181, 0.12)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 16,
  },
  editorPrimaryText: {
    color: colors.green,
    fontSize: SLTypography.rowTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  editorDisabled: {
    opacity: 0.58,
  },
  plannedSetText: {
    color: colors.muted,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 19,
    fontFamily: SLFontFamilies.sansMedium,
  },
  notesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  notesText: {
    color: colors.violet,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  reorderList: {
    gap: 10,
  },
  reorderRow: {
    height: REORDER_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.14)',
    backgroundColor: 'rgba(24, 20, 30, 0.58)',
    borderRadius: SLRadius.lg,
    padding: 12,
    ...SLShadows.card,
  },
  reorderHandle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    borderRadius: SLRadius.md,
  },
  reorderRowTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  reorderRowTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  reorderRowMeta: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  reorderButtonGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  reorderStepButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.canvasRaised,
  },
  emptySection: {
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(20, 18, 22, 0.34)',
    borderRadius: SLRadius.lg,
    padding: 14,
  },
  emptySectionText: {
    color: colors.muted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  disabledButton: {
    opacity: 0.55,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(10, 8, 12, 0.30)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  disabledButtonCompact: {
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  disabledButtonText: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  removeItemButton: {
    opacity: 0.86,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(185, 104, 104, 0.22)',
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.surfaceDestructive,
  },
  sessionActions: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 2,
  },
  sessionActionSectionLabel: {
    paddingHorizontal: SLSpacing.sm,
    paddingTop: SLSpacing.xs,
    paddingBottom: 2,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.technical,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  sessionActionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: SLSpacing.xs,
    backgroundColor: SLColors.borderHairline,
  },
  sessionActionButton: {
    width: '100%',
    minHeight: SLControlSize.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: SLSpacing.sm,
    paddingHorizontal: SLSpacing.sm,
    paddingVertical: SLSpacing.xs,
    borderRadius: SL_TAB_ROW_CONTROL.itemRadius,
    backgroundColor: 'transparent',
  },
  sessionActionText: {
    flex: 1,
    minWidth: 0,
    color: SL_TAB_ROW_CONTROL.inactiveColor,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 14,
    lineHeight: 19,
  },
  sessionActionDangerButton: {
    backgroundColor: 'rgba(74,22,30,0.16)',
  },
  sessionActionDangerText: {
    color: SLColors.danger,
  },
  sessionActionDisabled: {
    opacity: 0.48,
  },
  trainingLiftEditorScreen: {
    flex: 1,
    backgroundColor: SLColors.surfaceInset,
  },
  accessoryEditorKeyboardWrap: {
    flex: 1,
    backgroundColor: '#000000',
  },
  accessoryEditorBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
    backgroundColor: 'rgba(3, 5, 10, 0.78)',
  },
  accessoryEditorCard: {
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
    ...SLShadows.shadowSheet,
  },
  trainingLiftEditorHeader: {
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(30, 24, 38, 0.42)',
  },
  accessoryEditorHeader: {
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomColor: 'rgba(200, 171, 114, 0.14)',
    backgroundColor: '#000000',
  },
  accessoryEditorTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  trainingLiftEditorEyebrow: {
    color: colors.violet,
    fontSize: SLTypography.caption.fontSize,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftEditorTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.hero.fontSize,
    lineHeight: 34,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftCancelButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.14)',
    backgroundColor: 'rgba(10, 8, 12, 0.34)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 14,
  },
  trainingLiftCancelText: {
    color: colors.muted,
    fontSize: SLTypography.rowTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftEditorScroll: {
    flex: 1,
    minHeight: 0,
  },
  trainingLiftEditorContent: {
    paddingTop: 14,
    paddingBottom: 112,
    gap: 14,
  },
  accessoryEditorContent: {
    paddingTop: 12,
    paddingHorizontal: 0,
    paddingBottom: 18,
    gap: 14,
  },
  accessoryEditorFailureState: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  accessoryEditorStatusBlock: {
    gap: 10,
    paddingVertical: 8,
  },
  accessoryEditorErrorText: {
    color: SLColors.danger,
    fontSize: SLTypography.rowTitle.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  accessoryPickerHeaderAction: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessoryPickerHeaderButton: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
    backgroundColor: '#050507',
  },
  accessoryPickerHeaderTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 26,
    fontFamily: SLFontFamilies.sansBold,
    textAlign: 'center',
  },
  accessoryPickerIntro: {
    gap: 7,
    marginHorizontal: 14,
    paddingVertical: 4,
  },
  accessoryPickerKicker: {
    color: colors.violet,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerIntroTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 28,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerModeRow: {
    flexDirection: 'column',
    gap: 10,
    marginHorizontal: 14,
  },
  accessoryPickerMode: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    paddingHorizontal: 13,
  },
  accessoryPickerModeActive: {
    borderColor: 'rgba(167, 139, 250, 0.66)',
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
  },
  accessoryPickerModeIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.md,
    backgroundColor: '#020204',
  },
  accessoryPickerModeIconActive: {
    borderColor: 'rgba(167, 139, 250, 0.48)',
    backgroundColor: 'rgba(124, 58, 237, 0.16)',
  },
  accessoryPickerModeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  accessoryPickerModeTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerModeDetail: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  accessoryPickerRegionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 14,
  },
  accessoryPickerRegionCard: {
    width: '31.3%',
    minHeight: 118,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#040507',
  },
  accessoryPickerRegionArt: {
    width: '100%',
    height: 84,
    backgroundColor: '#010102',
  },
  accessoryPickerRegionLabel: {
    color: colors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontFamily: SLFontFamilies.sansBold,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'center',
  },
  accessoryPickerQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 14,
  },
  accessoryPickerQuickButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.pill,
    backgroundColor: '#050608',
    paddingHorizontal: 13,
  },
  accessoryPickerQuickText: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerHero: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    overflow: 'hidden',
    marginHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    borderRadius: SLRadius.xl,
    backgroundColor: '#010102',
  },
  accessoryPickerHeroArt: {
    width: '100%',
    height: 220,
  },
  accessoryPickerHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  accessoryPickerTargetGrid: {
    gap: 10,
    marginHorizontal: 14,
  },
  accessoryPickerTargetCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    paddingHorizontal: 9,
  },
  accessoryPickerTargetArt: {
    width: 56,
    height: 56,
    borderRadius: SLRadius.sm,
    backgroundColor: '#010102',
  },
  accessoryPickerTargetCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  accessoryPickerTargetLabel: {
    color: colors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerTargetMeta: {
    color: colors.muted,
    fontSize: SLTypography.micro.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  accessoryPickerHeroCompact: {
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.20)',
    borderRadius: SLRadius.lg,
    backgroundColor: '#040507',
    paddingRight: 14,
  },
  accessoryPickerHeroCompactArt: {
    width: 112,
    height: 110,
  },
  accessoryPickerSectionInset: {
    gap: 12,
    marginHorizontal: 14,
  },
  accessoryPickerSearchField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(225, 221, 240, 0.16)',
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    paddingHorizontal: 13,
  },
  accessoryPickerSearchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
    paddingVertical: 10,
  },
  accessoryPickerEquipmentChip: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#050608',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 12,
  },
  accessoryPickerResultList: {
    gap: 15,
  },
  accessoryPickerResultSection: {
    gap: 8,
  },
  accessoryPickerResultSectionPrimary: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.20)',
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(124, 58, 237, 0.035)',
    padding: 10,
  },
  accessoryPickerResultSectionSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.22)',
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(33, 96, 190, 0.035)',
    padding: 10,
  },
  accessoryPickerResultSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  accessoryPickerResultCount: {
    minWidth: 25,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: SLRadius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(167, 139, 250, 0.20)',
    color: colors.violet,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerResultCountSecondary: {
    backgroundColor: 'rgba(74, 144, 226, 0.18)',
    color: '#67A7FF',
  },
  accessoryPickerResultDescription: {
    color: colors.muted,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 16,
    fontFamily: SLFontFamilies.sansMedium,
  },
  accessoryPickerResultCards: {
    gap: 7,
  },
  accessoryPickerSectionLabel: {
    color: colors.violet,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 16,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerSectionLabelSecondary: {
    color: '#67A7FF',
  },
  accessoryPickerMovementCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
  },
  accessoryPickerMovementMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 8,
  },
  accessoryPickerMovementArt: {
    width: 70,
    height: 70,
    borderRadius: SLRadius.md,
    backgroundColor: '#010102',
  },
  accessoryPickerMovementCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  accessoryPickerMovementTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 21,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerMovementMeta: {
    color: colors.muted,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 16,
    fontFamily: SLFontFamilies.sansMedium,
  },
  accessoryPickerMovementSecondaryMeta: {
    color: '#67A7FF',
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerMovementSource: {
    color: colors.violet,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 15,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerFavorite: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.lineSoft,
  },
  accessoryPickerFavoriteActive: {
    backgroundColor: 'rgba(200, 171, 114, 0.08)',
    borderLeftColor: 'rgba(200, 171, 114, 0.20)',
  },
  accessoryPickerDetail: {
    gap: 14,
    marginHorizontal: 14,
  },
  accessoryPickerDetailHero: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    borderRadius: SLRadius.xl,
    backgroundColor: '#010102',
    padding: 14,
  },
  accessoryPickerDetailArt: {
    width: '100%',
    height: 230,
  },
  accessoryPickerDetailFavorite: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(214, 167, 94, 0.24)',
    borderRadius: SLRadius.md,
    backgroundColor: '#050608',
  },
  accessoryPickerDetailFavoriteText: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerDetailRows: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
  },
  accessoryPickerDetailRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineSoft,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  accessoryPickerDetailLabel: {
    color: colors.subtle,
    fontSize: SLTypography.micro.fontSize,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerDetailValue: {
    flex: 1,
    color: colors.textStrong,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    textAlign: 'right',
    fontFamily: SLFontFamilies.sansMedium,
  },
  accessoryPickerStandaloneAction: {
    flex: 0,
    minHeight: 54,
  },
  accessoryPickerPrimaryAction: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(185, 104, 255, 0.72)',
    borderRadius: SLRadius.lg,
    backgroundColor: '#4B1A78',
    paddingHorizontal: 16,
  },
  accessoryPickerPrimaryActionText: {
    color: '#FFFFFF',
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerConfirmAction: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(232, 194, 104, 0.72)',
    borderRadius: SLRadius.lg,
    backgroundColor: '#D1A83E',
    paddingHorizontal: 16,
  },
  accessoryPickerConfirmActionText: {
    color: SLColors.textInverted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerSelectedSummary: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(214, 167, 94, 0.20)',
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    padding: 9,
  },
  accessoryPickerSelectedArt: {
    width: 84,
    height: 84,
    borderRadius: SLRadius.md,
    backgroundColor: '#010102',
  },
  accessoryPickerIntroFlush: {
    gap: 7,
    paddingVertical: 4,
  },
  accessoryPickerReview: {
    gap: 16,
    marginHorizontal: 14,
  },
  accessoryPickerProgressRail: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderTopColor: 'rgba(167, 139, 250, 0.54)',
    marginHorizontal: 14,
    marginTop: 9,
  },
  accessoryPickerProgressNode: {
    width: 8,
    height: 8,
    marginTop: -5,
    borderRadius: 999,
    backgroundColor: colors.muted,
  },
  accessoryPickerProgressNodeActive: {
    borderWidth: 2,
    borderColor: colors.violet,
    backgroundColor: '#000000',
  },
  accessoryPickerReviewAlternatives: {
    gap: 8,
  },
  accessoryPickerAlternativeRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    padding: 8,
  },
  accessoryPickerAlternativeArt: {
    width: 54,
    height: 54,
    borderRadius: SLRadius.sm,
    backgroundColor: '#010102',
  },
  accessoryPickerSuccess: {
    flex: 1,
    minHeight: 610,
    justifyContent: 'space-between',
    gap: 18,
    marginHorizontal: 14,
    paddingTop: 20,
  },
  accessoryPickerSuccessMark: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.violet,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  accessoryPickerSuccessContext: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#030405',
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  accessoryPickerRecentRail: {
    gap: 9,
    paddingRight: 14,
  },
  accessoryPickerRecentCard: {
    width: 106,
    minHeight: 126,
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    padding: 7,
  },
  accessoryPickerRecentArt: {
    width: '100%',
    height: 82,
    borderRadius: SLRadius.md,
    backgroundColor: '#010102',
  },
  accessoryPickerRecentTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 15,
    fontFamily: SLFontFamilies.sansBold,
  },
  accessoryPickerSimilaritySection: {
    gap: 9,
  },
  accessoryPickerSimilarityCard: {
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(200, 171, 114, 0.30)',
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(200, 171, 114, 0.06)',
    padding: 12,
  },
  accessoryPickerSimilarityBadge: {
    alignSelf: 'flex-start',
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(200, 171, 114, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  accessoryPickerSimilarityBadgeText: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  customMovementCreator: {
    gap: 16,
    marginHorizontal: 14,
    paddingBottom: 6,
  },
  customMovementStepMeta: {
    gap: 8,
  },
  customMovementStepCount: {
    color: colors.violet,
    fontSize: SLTypography.micro.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  customMovementStepRail: {
    flexDirection: 'row',
    gap: 6,
  },
  customMovementStepSegment: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#17141D',
  },
  customMovementStepSegmentActive: {
    backgroundColor: colors.violet,
  },
  customMovementFieldGroup: {
    gap: 7,
  },
  customMovementNameInput: {
    minHeight: 52,
    color: colors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
    borderWidth: 1,
    borderColor: 'rgba(185, 104, 255, 0.52)',
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    paddingHorizontal: 14,
  },
  customMovementMatchCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.md,
    backgroundColor: '#050608',
    padding: 7,
  },
  customMovementMatchArt: {
    width: 60,
    height: 60,
    borderRadius: SLRadius.sm,
    backgroundColor: '#010102',
  },
  customMovementDistinctAction: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(185, 104, 255, 0.28)',
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    paddingHorizontal: 14,
  },
  customMovementDistinctTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  customMovementDistinctMeta: {
    color: colors.violet,
    fontSize: SLTypography.micro.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  customMovementRegionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customMovementRegionCard: {
    width: '31.7%',
    minHeight: 112,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.md,
    backgroundColor: '#050608',
    paddingBottom: 8,
  },
  customMovementRegionArt: {
    width: '100%',
    height: 82,
    backgroundColor: '#010102',
  },
  customMovementChoiceActive: {
    borderColor: 'rgba(185, 104, 255, 0.78)',
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
  },
  customMovementChoiceLabel: {
    flex: 1,
    color: colors.textStrong,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 15,
    textAlign: 'center',
    fontFamily: SLFontFamilies.sansBold,
  },
  customMovementExactTargets: {
    gap: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineSoft,
    paddingTop: 14,
  },
  customMovementMuscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customMovementMuscleCard: {
    width: '31.7%',
    minHeight: 105,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.md,
    backgroundColor: '#050608',
    padding: 6,
  },
  customMovementMuscleArt: {
    width: '100%',
    height: 66,
    borderRadius: SLRadius.sm,
    backgroundColor: '#010102',
  },
  customMovementPromptRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  customMovementSelectedCount: {
    color: colors.violet,
    fontSize: SLTypography.micro.fontSize,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  customMovementExecutionList: {
    gap: 8,
  },
  customMovementExecutionCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    paddingHorizontal: 12,
  },
  customMovementExecutionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.md,
    backgroundColor: '#010102',
  },
  customMovementFooterActions: {
    flexDirection: 'row',
    gap: 10,
  },
  customMovementFooterPrimary: {
    flex: 1.35,
  },
  customMovementBackAction: {
    minHeight: 54,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.lg,
    backgroundColor: '#050608',
    paddingHorizontal: 14,
  },
  customMovementReviewHero: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(185, 104, 255, 0.24)',
    borderRadius: SLRadius.xl,
    backgroundColor: '#020203',
    padding: 10,
  },
  customMovementReviewArt: {
    width: '44%',
    minHeight: 265,
  },
  customMovementReviewIdentity: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 13,
  },
  customMovementReviewName: {
    color: colors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 26,
    fontFamily: SLFontFamilies.sansBold,
  },
  customMovementReviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  customMovementReviewDot: {
    width: 6,
    height: 6,
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: colors.violet,
  },
  customMovementReviewValue: {
    color: colors.textStrong,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontFamily: SLFontFamilies.sansMedium,
  },
  customMovementQuietAction: {
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  customMovementCreated: {
    flex: 1,
    minHeight: 610,
    justifyContent: 'space-between',
    gap: 18,
    marginHorizontal: 14,
    paddingTop: 24,
  },
  customMovementCreatedCopy: {
    alignItems: 'center',
    gap: 8,
  },
  customMovementCreatedKicker: {
    color: colors.violet,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftSection: {
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(20, 18, 22, 0.44)',
    borderRadius: SLRadius.lg,
    padding: 14,
  },
  trainingLiftSectionTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 26,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftLoadingRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trainingLiftMuted: {
    color: colors.muted,
    fontSize: SLTypography.rowTitle.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  trainingLiftFamilyRow: {
    gap: 8,
    paddingRight: 8,
  },
  trainingLiftFamilyButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(10, 8, 12, 0.28)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
  },
  trainingLiftFamilyButtonActive: {
    borderColor: 'rgba(167, 139, 250, 0.54)',
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
  },
  trainingLiftFamilyText: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftFamilyTextActive: {
    color: colors.textStrong,
  },
  trainingLiftCardGrid: {
    gap: 9,
  },
  trainingLiftTwoColumnGrid: {
    flexDirection: 'row',
    gap: 9,
  },
  trainingLiftOptionCard: {
    flex: 1,
    minHeight: 70,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.11)',
    backgroundColor: 'rgba(8, 8, 12, 0.28)',
    borderRadius: SLRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 13,
    gap: 4,
  },
  trainingLiftOptionCardAmber: {
    borderColor: 'rgba(214, 167, 94, 0.18)',
  },
  trainingLiftOptionCardSelected: {
    borderColor: 'rgba(167, 139, 250, 0.62)',
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
  },
  trainingLiftOptionTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 21,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftOptionTitleSelected: {
    color: SLColors.accentViolet,
  },
  trainingLiftOptionDetail: {
    color: colors.muted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontFamily: SLFontFamilies.sansMedium,
  },
  trainingLiftCustomBlock: {
    gap: 8,
    paddingTop: 2,
  },
  trainingLiftFieldLabel: {
    color: colors.subtle,
    fontSize: SLTypography.micro.fontSize,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
    borderRadius: SLRadius.md,
    color: colors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftNotesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    fontFamily: SLFontFamilies.sansMedium,
  },
  trainingLiftSecondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(10, 8, 12, 0.30)',
    borderRadius: SLRadius.md,
    paddingHorizontal: 13,
  },
  trainingLiftSecondaryText: {
    color: colors.muted,
    fontSize: SLTypography.rowTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftEditorActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(10, 8, 12, 0.94)',
  },
  accessoryEditorActions: {
    position: 'relative',
    left: undefined,
    right: undefined,
    bottom: undefined,
    paddingBottom: 16,
    backgroundColor: 'rgba(10, 8, 12, 0.98)',
  },
  trainingLiftActionSecondary: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.14)',
    backgroundColor: 'rgba(10, 8, 12, 0.34)',
    borderRadius: SLRadius.lg,
  },
  trainingLiftActionSecondaryText: {
    color: colors.muted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftActionPrimary: {
    flex: 1.4,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.26)',
    backgroundColor: 'rgba(167, 203, 181, 0.16)',
    borderRadius: SLRadius.lg,
  },
  trainingLiftActionPrimaryText: {
    color: colors.green,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  calendarModal: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: SLColors.surface,
    borderRadius: SLRadius.xl,
    padding: 16,
    gap: 14,
  },
  infoModal: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: SLColors.surface,
    borderRadius: SLRadius.xl,
    padding: 16,
    gap: 14,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoModalTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.screenTitle.fontSize,
    lineHeight: 30,
    fontFamily: SLFontFamilies.sansBold,
  },
  infoModalBody: {
    color: colors.muted,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 23,
    fontFamily: SLFontFamilies.sansMedium,
  },
  infoModalAction: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.24)',
    backgroundColor: 'rgba(167, 203, 181, 0.12)',
    borderRadius: SLRadius.md,
  },
  infoModalActionText: {
    color: colors.green,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  calendarEyebrow: {
    color: colors.violet,
    fontSize: SLTypography.caption.fontSize,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarTitle: {
    color: colors.textStrong,
    fontSize: SLTypography.screenTitle.fontSize,
    lineHeight: 30,
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarClose: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 5, 5, 0.25)',
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarMonthButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 8, 8, 0.18)',
  },
  calendarMonthLabel: {
    color: colors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingBottom: 8,
  },
  calendarWeekday: {
    width: `${100 / 7}%`,
    color: colors.subtle,
    textAlign: 'center',
    fontSize: SLTypography.caption.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
  },
  calendarDaySelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.54)',
  },
  calendarDayText: {
    color: colors.muted,
    fontSize: SLTypography.cardTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarDayTextSelected: {
    color: colors.textStrong,
  },
  calendarFooter: {
    borderTopWidth: 1,
    borderColor: colors.lineSoft,
    paddingTop: 12,
    gap: 12,
  },
  calendarSelectedText: {
    color: colors.muted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
  },
  calendarFooterActions: {
    flexDirection: 'row',
    gap: 10,
  },
  calendarSecondary: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarSecondaryText: {
    color: colors.muted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarPrimary: {
    flex: 1.4,
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.26)',
    backgroundColor: 'rgba(167, 203, 181, 0.13)',
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarPrimaryText: {
    color: colors.green,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  pressed: {
    opacity: 0.72,
  },
});
