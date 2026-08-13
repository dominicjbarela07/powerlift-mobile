import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { equipmentPresentationLabel } from '@/lib/equipment-presentation';
import {
  mapCoachSessionEditorPayload,
} from '@/lib/coach-session-editor';
import { SLColors, SLControlSize, SLFontFamilies, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
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
  planned_sets?: PlannedSet[];
  movement_identity?: {
    id?: number | null;
    display_name?: string | null;
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
};

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

export default function MobileSessionWorkspaceScreen() {
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
  const workoutId = firstParam(params.workoutId);
  const programmingAthleteId = firstParam(params.athleteId);
  const programmingBlockId = firstParam(params.programmingBlockId);
  const programmingWeek = firstParam(params.programmingWeek);
  const programmingDay = firstParam(params.programmingDay);
  const requestedSection = firstParam(params.section);

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
  const [workspaceDisplayUnit, setWorkspaceDisplayUnit] = useState<'kg' | 'lb'>('kg');
  const hasLoadedSessionRef = useRef(false);
  const loadRequestRevisionRef = useRef(0);
  const nextDraftMovementIdRef = useRef(-1);
  const addCoreCompletionRef = useRef<((item: SessionMovementItem) => void) | null>(null);
  const addAccessoryCompletionRef = useRef<((item: SessionMovementItem) => void) | null>(null);
  const reorderCompletionRef = useRef<((order: ReorderEditorState) => void) | null>(null);
  const loadedStatus = String(payload?.workout?.raw_status || payload?.workout?.status || '').trim().toLowerCase();
  const loadedCompletedSession = ['completed', 'logged', 'done'].includes(loadedStatus);
  const redirectingToLogger = authReady && user?.role !== 'coach' && !!payload && !loadedCompletedSession;

  const loadSession = useCallback(async (silent?: boolean) => {
    if (!workoutId) {
      setError('Missing session id.');
      setLoading(false);
      return;
    }
    const requestRevision = ++loadRequestRevisionRef.current;
    if (silent) setRefreshing(true);
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
      if (!silent) {
        setPayload(null);
        setError(err?.message || 'Session workspace could not load.');
      }
    } finally {
      if (requestRevision !== loadRequestRevisionRef.current) return;
      if (silent) setRefreshing(false);
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
    const preferredUnits = String(payload?.athlete?.preferred_units || '').toLowerCase();
    setWorkspaceDisplayUnit(['lb', 'lbs'].includes(preferredUnits) ? 'lb' : 'kg');
  }, [payload?.athlete?.id, payload?.athlete?.preferred_units]);

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
    const athleteId = payload?.athlete?.id;
    const customDefinitionsRequest = athleteId
      ? fetchJson<any>(`/workouts/mobile/movement-definitions/search?athlete_id=${athleteId}&limit=49`, { method: 'GET' })
      : Promise.resolve(null);
    Promise.all([
      fetchJson<MovementPresetPayload>('/workouts/mobile/movement_presets', { method: 'GET' }),
      customDefinitionsRequest,
    ])
      .then(([resp, customResponse]) => {
        const json = resp.json || {};
        if (!active) return;
        setMovementGroups(Array.isArray(json.training_lifts?.categories) ? json.training_lifts.categories : []);
        const categories = Array.isArray(json.accessories?.categories) ? json.accessories.categories : [];
        const definitions = Array.isArray(json.accessories?.definitions) ? json.accessories.definitions : [];
        const customItems = customResponse?.ok && Array.isArray(customResponse.json?.items)
          ? customResponse.json.items.filter((row: MovementPreset) => row.ownership_scope !== 'global')
          : [];
        setAccessoryGroups(accessoryGroupsWithCanonicalIdentity(
          accessoryGroupsWithCanonicalIdentity(categories, definitions),
          customItems,
          'custom_identity',
        ));
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
  const coreItems = workout?.core_items || [];
  const accessoryItems = useMemo(
    () => (workout?.accessory_groups || []).flatMap((group) => group.items || []),
    [workout?.accessory_groups]
  );

  const status = humanStatus(workout?.raw_status || workout?.status);
  const title = sessionTitle(workout?.label);
  const context = sessionContext(payload?.athlete?.name, workout?.label, workout?.date);

  const closeToProgrammingHome = () => {
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
    addAccessoryCompletionRef.current = onAdd;
    const setup = defaultAccessorySetup(accessoryGroups);
    setAccessoryEditor({
      mode: 'add',
      item: null,
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
        { text: 'Discard Changes', style: 'destructive', onPress: () => { addAccessoryCompletionRef.current = null; setAccessoryEditor(null); } },
      ]);
      return;
    }
    addAccessoryCompletionRef.current = null;
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

  const applyAccessorySetup = async (setup: AccessorySetup) => {
    if (!workout?.id || !accessoryEditor) return;
    try {
      setAccessorySaving(true);
      let movementDefinitionId = setup.movementDefinitionId;
      const isNewCustomMovement = !movementDefinitionId
        && !!setup.customMovement.trim()
        && setup.movement === setup.customMovement.trim();
      if (isNewCustomMovement) {
        const identityResponse = await fetchJson<any>('/workouts/mobile/movement-definitions', {
          method: 'POST',
          body: {
            athlete_id: payload?.athlete?.id,
            display_name: setup.movement,
            equipment_type: setup.equipmentType,
            loading_implementation: setup.loadingImplementation,
            load_convention: setup.loadConvention,
            measurement_type: setup.measurementType,
            sidedness: setup.sidedness,
          } as any,
        });
        const identityJson = identityResponse.json || {};
        if (!identityResponse.ok || !identityJson.ok || !identityJson.movement_definition?.id) {
          throw new Error(identityJson.error || `HTTP ${identityResponse.status}`);
        }
        movementDefinitionId = Number(identityJson.movement_definition.id);
        setAccessoryGroups((current) => accessoryGroupsWithCanonicalIdentity(current, [identityJson.movement_definition], 'custom_identity'));
        setAccessoryEditor((current) => current ? {
          ...current,
          setup: { ...current.setup, movementDefinitionId },
        } : current);
      }
      if (accessoryEditor.mode === 'add' && addAccessoryCompletionRef.current) {
        const id = nextDraftMovementIdRef.current--;
        addAccessoryCompletionRef.current({
          id,
          movement: setup.movement,
          original_movement: setup.movement,
          variant: 'ACC',
          sets: 3,
          reps_text: '10-12',
          rir_target: 2,
          notes: setup.notes,
          superset_group: setup.supersetGroup || null,
          superset_pos: setup.supersetGroup ? Number(setup.supersetPosition || 1) : null,
          movement_identity: movementDefinitionId ? { display_name: setup.movement } : null,
        });
        addAccessoryCompletionRef.current = null;
        setAccessoryEditor(null);
        return;
      }
      const body = {
        movement: setup.movement,
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
      setAccessoryEditor(null);
      await loadSession(true);
    } catch (err: any) {
      Alert.alert(
        accessoryEditor.mode === 'add' ? 'Could not add accessory' : 'Could not update accessory',
        err?.message || 'Please try again.'
      );
    } finally {
      setAccessorySaving(false);
    }
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
        ...(plan.metadataPatch.displayUnit !== undefined ? { preferred_units: plan.metadataPatch.displayUnit === 'lb' ? 'lbs' : 'kg' } : {}),
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
        <Tabs.Screen options={{ headerShown: false }} />
        <CompletedSessionRecap
          recap={workout.completed_recap}
          impactSummary={workout.impact_summary}
          preferredUnits={payload?.athlete?.preferred_units}
          refreshing={refreshing}
          onRefresh={() => { void loadSession(true); }}
          onClose={closeToProgrammingHome}
        />
      </>
    );
  }

  return (
    <View style={styles.screen}>
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
        onRefresh={() => { void loadSession(true); }}
        onCloseWorkspace={closeToProgrammingHome}
        onOpenAthleteView={openAthleteView}
        onOpenReorder={openReorderEditor}
        onAddCore={openAddCoreLiftEditor}
        onAddAccessory={openAddAccessoryEditor}
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
      <AccessoryEditorModal
        state={accessoryEditor}
        groups={accessoryGroups}
        loadingGroups={movementGroupsLoading}
        saving={accessorySaving}
        onChange={(setup) => setAccessoryEditor((current) => current ? { ...current, setup } : current)}
        onCancel={cancelAccessoryEditor}
        onApply={applyAccessorySetup}
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
      .filter(({ movement }) => !query || movementPresetName(movement).toLowerCase().includes(query))
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
      lift: preset.lift,
      ...(preset.lift === 'VR' ? { scheme: 'STRAIGHT', mode: 'RPE' } : {}),
    });
  };

  const chooseMovement = (movement: MovementPreset | string, group = activeGroup) => {
    if (!group) return;
    const preset = movementPresetFromValue(movement, group);
    patchSetup({
      movement: preset.name,
      family: preset.categoryKey || group.key,
      lift: preset.lift,
      ...(preset.lift === 'VR' ? { scheme: 'STRAIGHT', mode: 'RPE' } : {}),
    });
  };

  const useCustomMovement = () => {
    if (!setup?.customMovement.trim()) return;
    patchSetup({
      movement: setup.customMovement.trim(),
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

function AccessoryEditorModal({
  state,
  groups,
  loadingGroups,
  saving,
  onChange,
  onCancel,
  onApply,
}: {
  state: AccessoryEditorState | null;
  groups: MovementPresetGroup[];
  loadingGroups: boolean;
  saving: boolean;
  onChange: (setup: AccessorySetup) => void;
  onCancel: () => void;
  onApply: (setup: AccessorySetup) => void | Promise<void>;
}) {
  const [movementQuery, setMovementQuery] = useState('');
  const setup = state?.setup || null;
  const activeGroup = setup ? movementGroupByKey(groups, setup.family) || groups[0] || null : null;
  const title = state?.mode === 'add' ? 'Add accessory' : 'Change accessory';
  const isNewCustomMovement = !!setup
    && !setup.movementDefinitionId
    && !!setup.customMovement.trim()
    && setup.movement === setup.customMovement.trim();
  const customIdentityComplete = !!setup
    && !!setup.equipmentType
    && !!setup.loadingImplementation
    && !!setup.loadConvention
    && !!setup.measurementType
    && !!setup.sidedness;
  useEffect(() => setMovementQuery(''), [state?.item?.id, state?.mode]);
  const visibleMovementChoices = useMemo(() => {
    const query = movementQuery.trim().toLowerCase();
    const sourceGroups = query ? groups : activeGroup ? [activeGroup] : [];
    return sourceGroups.flatMap((group) => (group.movements || []).map((movement) => ({ group, movement })))
      .filter(({ movement }) => !query || movementPresetName(movement).toLowerCase().includes(query))
      .slice(0, query ? 48 : 18);
  }, [activeGroup, groups, movementQuery]);

  const patchSetup = (patch: Partial<AccessorySetup>) => {
    if (!setup) return;
    onChange({ ...setup, ...patch });
  };

  const chooseFamily = (group: MovementPresetGroup) => {
    const first = group.movements?.[0] || null;
    const name = movementPresetName(first);
    const preset = typeof first === 'object' && first ? first : null;
    patchSetup({
      family: group.key,
      movement: name || setup?.movement || '',
      movementDefinitionId: preset?.id || null,
    });
  };

  const chooseMovement = (movement: MovementPreset | string, group = activeGroup) => {
    if (!group) return;
    const name = movementPresetName(movement);
    patchSetup({
      movement: name,
      family: group.key,
      movementDefinitionId: typeof movement === 'object' ? movement.id || null : null,
    });
  };

  const useCustomMovement = () => {
    if (!setup?.customMovement.trim()) return;
    patchSetup({
      movement: setup.customMovement.trim(),
      movementDefinitionId: null,
    });
  };

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.accessoryEditorKeyboardWrap}
      >
        <Pressable style={styles.accessoryEditorBackdrop} onPress={Keyboard.dismiss}>
          <Pressable
            style={styles.accessoryEditorCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.trainingLiftEditorHeader, styles.accessoryEditorHeader]}>
              <View style={styles.accessoryEditorTitleBlock}>
                <Text style={styles.trainingLiftEditorEyebrow}>Workspace edit</Text>
                <Text style={styles.trainingLiftEditorTitle}>{title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel accessory changes"
                onPress={onCancel}
                style={({ pressed }) => [styles.trainingLiftCancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.trainingLiftCancelText}>Cancel</Text>
              </Pressable>
            </View>

            {!setup ? null : (
              <ScrollView
                style={styles.trainingLiftEditorScroll}
                contentContainerStyle={styles.accessoryEditorContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <TrainingLiftSection title="Movement">
              {loadingGroups ? (
                <View style={styles.trainingLiftLoadingRow}>
                  <ActivityIndicator color={colors.violet} />
                  <Text style={styles.trainingLiftMuted}>Loading accessory presets...</Text>
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
              <TextInput accessibilityLabel="Search accessory movements" value={movementQuery} onChangeText={setMovementQuery} placeholder="Search movements" placeholderTextColor={colors.subtle} style={styles.trainingLiftInput} />
              <View style={styles.trainingLiftCardGrid}>
                {visibleMovementChoices.map(({ movement, group }) => {
                  const name = movementPresetName(movement);
                  const selected = name === setup.movement;
                  return (
                    <TrainingLiftOptionCard
                      key={`${group.key}-${name}`}
                      title={name}
                      detail={group.name || 'Accessory movement'}
                      selected={selected}
                      tone="amber"
                      onPress={() => chooseMovement(movement, group)}
                    />
                  );
                })}
              </View>
              <View style={styles.trainingLiftCustomBlock}>
                <Text style={styles.trainingLiftFieldLabel}>Custom fallback</Text>
                <TextInput
                  value={setup.customMovement}
                  onChangeText={(value) => patchSetup({ customMovement: value })}
                  placeholder="Type custom accessory"
                  placeholderTextColor={colors.subtle}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit
                  style={styles.trainingLiftInput}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={useCustomMovement}
                  style={({ pressed }) => [styles.trainingLiftSecondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.trainingLiftSecondaryText}>Use custom accessory</Text>
                </Pressable>
              </View>
                </TrainingLiftSection>

                {isNewCustomMovement ? (
                  <TrainingLiftSection title="Custom Equipment Identity">
                    <Text style={styles.trainingLiftMuted}>Define the movement’s equipment and measurement semantics before adding it.</Text>
                    <AccessoryConfigChoices label="Equipment" value={setup.equipmentType} values={['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other']} onSelect={(equipmentType) => patchSetup({ equipmentType })} />
                    <AccessoryConfigChoices label="Loading" value={setup.loadingImplementation} values={['free_weight', 'selectorized_machine', 'plate_loaded_machine', 'cable_stack', 'bodyweight', 'unknown']} onSelect={(loadingImplementation) => patchSetup({ loadingImplementation })} />
                    <AccessoryConfigChoices label="Load convention" value={setup.loadConvention} values={['total_external_load', 'per_hand', 'machine_stack_display', 'bodyweight_only', 'added_bodyweight', 'assistance_load', 'no_external_load', 'unknown']} onSelect={(loadConvention) => patchSetup({ loadConvention })} />
                    <AccessoryConfigChoices label="Measurement" value={setup.measurementType} values={['load_reps', 'bodyweight_reps', 'added_weight_reps', 'assisted_reps', 'duration', 'unknown']} onSelect={(measurementType) => patchSetup({ measurementType })} />
                    <AccessoryConfigChoices label="Sidedness" value={setup.sidedness} values={['bilateral', 'unilateral', 'alternating', 'unknown']} onSelect={(sidedness) => patchSetup({ sidedness })} />
                  </TrainingLiftSection>
                ) : null}

                <TrainingLiftSection title="Grouped Set">
                  <Text style={styles.trainingLiftMuted}>
                    Leave “None” selected for a standard accessory. Matching letters run together as a superset, tri-set, or giant set.
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.trainingLiftFamilyRow}
                  >
                    {['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((group) => {
                      const selected = setup.supersetGroup === group;
                      const label = group || 'None';
                      return (
                        <Pressable
                          key={label}
                          accessibilityRole="button"
                          accessibilityLabel={group ? `Set group ${group}` : 'No grouped set'}
                          accessibilityState={{ selected }}
                          onPress={() => patchSetup({
                            supersetGroup: group,
                            supersetPosition: group ? (setup.supersetPosition || '1') : '',
                          })}
                          style={({ pressed }) => [
                            styles.trainingLiftFamilyButton,
                            selected && styles.trainingLiftFamilyButtonActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.trainingLiftFamilyText, selected && styles.trainingLiftFamilyTextActive]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {setup.supersetGroup ? (
                    <View style={styles.trainingLiftCustomBlock}>
                      <Text style={styles.trainingLiftFieldLabel}>Order inside group {setup.supersetGroup}</Text>
                      <TextInput
                        accessibilityLabel={`Order inside grouped set ${setup.supersetGroup}`}
                        value={setup.supersetPosition}
                        onChangeText={(value) => patchSetup({
                          supersetPosition: value.replace(/[^0-9]/g, '').slice(0, 2),
                        })}
                        keyboardType="number-pad"
                        placeholder="1"
                        placeholderTextColor={colors.subtle}
                        style={styles.trainingLiftInput}
                      />
                    </View>
                  ) : null}
                </TrainingLiftSection>

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
              <View style={[styles.trainingLiftEditorActions, styles.accessoryEditorActions]}>
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
              disabled={saving || !setup.movement || (isNewCustomMovement && !customIdentityComplete)}
              onPress={() => onApply(setup)}
              style={({ pressed }) => [
                styles.trainingLiftActionPrimary,
                (saving || !setup.movement || (isNewCustomMovement && !customIdentityComplete)) && styles.editorDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.trainingLiftActionPrimaryText}>{saving ? 'Applying...' : 'Apply Changes'}</Text>
            </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
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

function AccessoryConfigChoices({ label, value, values, onSelect }: { label: string; value: string; values: string[]; onSelect: (value: string) => void }) {
  return (
    <View style={styles.trainingLiftCustomBlock}>
      <Text style={styles.trainingLiftFieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trainingLiftFamilyRow}>
        {values.map((option) => {
          const selected = option === value;
          return (
            <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onSelect(option)} style={[styles.trainingLiftFamilyButton, selected && styles.trainingLiftFamilyButtonActive]}>
              <Text style={[styles.trainingLiftFamilyText, selected && styles.trainingLiftFamilyTextActive]}>
                {equipmentPresentationLabel(option, 'Option')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
        return { group, name, definitionId: typeof movement === 'object' ? movement.id || null : null };
      }
    }
  }
  return null;
}

function defaultAccessorySetup(groups: MovementPresetGroup[]): AccessorySetup {
  const fallback = 'Chest-Supported Row';
  const found = findAccessoryPreset(groups, fallback);
  const firstGroup = groups[0] || null;
  const firstMovement = movementPresetName(firstGroup?.movements?.[0] || null);
  return {
    movement: found?.name || firstMovement || fallback,
    movementDefinitionId: found?.definitionId || (typeof firstGroup?.movements?.[0] === 'object' ? firstGroup.movements[0].id || null : null),
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
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
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
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.14)',
    borderRadius: SLRadius.xl,
    overflow: 'hidden',
    backgroundColor: SLColors.surfaceInset,
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
    paddingBottom: 14,
    backgroundColor: 'rgba(30, 24, 38, 0.72)',
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
  },
  trainingLiftEditorContent: {
    paddingTop: 14,
    paddingBottom: 112,
    gap: 14,
  },
  accessoryEditorContent: {
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 18,
    gap: 14,
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
