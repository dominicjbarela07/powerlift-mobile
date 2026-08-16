import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { fetchJson } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { SLColors, SLFontFamilies } from '@/constants/theme';

type PlannedSet = {
  set_index?: number | null;
  reps?: number | null;
  rpe_target?: number | null;
  pct?: number | null;
  manual_target_kg?: number | null;
  manual_pm_kg?: number | null;
  suggested_low_kg?: number | null;
  suggested_high_kg?: number | null;
};

type WorkoutItem = {
  id: number;
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
  notes?: string | null;
  superset_group?: string | null;
  superset_pos?: number | null;
  planned_sets?: PlannedSet[];
  movement_identity?: {
    id?: number | null;
    display_name?: string | null;
  } | null;
  legacy?: {
    state?: string | null;
    original_text?: string | null;
    indicator?: string | null;
    mapping?: {
      revision?: number | null;
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
    core_items?: WorkoutItem[];
    accessory_groups?: AccessoryGroup[];
  } | null;
  athlete?: {
    id?: number | null;
    name?: string | null;
  } | null;
};

type MovementPreset = {
  id?: number | null;
  name?: string | null;
  display_name?: string | null;
  lift?: string | null;
  category?: string | null;
  category_key?: string | null;
  family?: string | null;
  type?: string | null;
  loading_behavior?: string | null;
};

type MovementPresetGroup = {
  name: string;
  key: string;
  movements?: Array<MovementPreset | string>;
};

type MovementPresetPayload = {
  ok?: boolean;
  training_lifts?: {
    categories?: MovementPresetGroup[];
  };
  accessories?: {
    categories?: MovementPresetGroup[];
  };
};

type EditKind = 'core' | 'accessory';
type HotEditField = 'sets' | 'reps' | 'rpe' | 'pct' | 'load' | 'notes' | 'accessory_reps' | 'rir';

type HotEditState = {
  item: WorkoutItem;
  kind: EditKind;
  field: HotEditField;
};
type AccessoryRepType = 'fixed' | 'range' | 'plus' | 'amrap';

type SessionActionKey = 'revert' | 'copy' | 'template' | 'move' | 'delete';
type CalendarAction = 'copy' | 'move';
type LoadStyleInfo = 'rpe' | 'pct' | 'rir';
type TrainingLiftScheme = 'STRAIGHT' | 'TOP_BACKDOWN' | 'FULL_CUSTOM';
type TrainingLiftMode = 'RPE' | 'PCT';

type TrainingLiftEditorMode = 'edit' | 'add';

type TrainingLiftEditorState = {
  mode: TrainingLiftEditorMode;
  item?: WorkoutItem | null;
  setup: TrainingLiftSetup;
};

type AccessoryEditorMode = 'edit' | 'add';

type AccessoryEditorState = {
  mode: AccessoryEditorMode;
  item?: WorkoutItem | null;
  setup: AccessorySetup;
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
};

type AccessorySetup = {
  movement: string;
  movementDefinitionId: number | null;
  family: string;
  notes: string;
  customMovement: string;
};

const KG_PER_LB = 0.45359237;
const LBS_INCREMENT_THRESHOLD = 150;
const LBS_INCREMENT_BELOW_THRESHOLD = 2.5;
const LBS_INCREMENT_AT_OR_ABOVE_THRESHOLD = 5;
const WHEEL_ITEM_WIDTH = 64;
const REORDER_ROW_HEIGHT = 78;
const REORDER_ROW_GAP = 10;
const REORDER_ROW_STEP = REORDER_ROW_HEIGHT + REORDER_ROW_GAP;

const colors = {
  text: '#ECE5DA',
  textStrong: SLColors.textStrong,
  muted: '#B8ACA1',
  subtle: '#82766D',
  line: 'rgba(222, 198, 166, 0.12)',
  lineSoft: 'rgba(222, 198, 166, 0.07)',
  surface: 'rgba(20, 14, 13, 0.28)',
  surfaceStrong: 'rgba(24, 16, 15, 0.46)',
  violet: SLColors.accentViolet,
  violetSoft: 'rgba(167, 139, 250, 0.14)',
  green: '#A7CBB5',
  red: SLColors.railDanger,
};

export default function MobileSessionWorkspaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workoutId?: string | string[];
    programmingBlockId?: string | string[];
    programmingWeek?: string | string[];
    programmingDay?: string | string[];
  }>();
  const workoutId = firstParam(params.workoutId);
  const programmingBlockId = firstParam(params.programmingBlockId);
  const programmingWeek = firstParam(params.programmingWeek);
  const programmingDay = firstParam(params.programmingDay);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<WorkoutPayload | null>(null);
  const [editing, setEditing] = useState<HotEditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingAction, setPendingAction] = useState<SessionActionKey | null>(null);
  const [calendarAction, setCalendarAction] = useState<CalendarAction | null>(null);
  const [loadStyleInfo, setLoadStyleInfo] = useState<LoadStyleInfo | null>(null);
  const [trainingLiftEditor, setTrainingLiftEditor] = useState<TrainingLiftEditorState | null>(null);
  const [accessoryEditor, setAccessoryEditor] = useState<AccessoryEditorState | null>(null);
  const [movementGroups, setMovementGroups] = useState<MovementPresetGroup[]>([]);
  const [accessoryGroups, setAccessoryGroups] = useState<MovementPresetGroup[]>([]);
  const [movementGroupsLoading, setMovementGroupsLoading] = useState(false);
  const [trainingLiftSaving, setTrainingLiftSaving] = useState(false);
  const [accessorySaving, setAccessorySaving] = useState(false);
  const [renamingSession, setRenamingSession] = useState(false);
  const [sessionNameDraft, setSessionNameDraft] = useState('');
  const [sessionRenameSaving, setSessionRenameSaving] = useState(false);
  const [reorderEditor, setReorderEditor] = useState<ReorderEditorState | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);

  const loadSession = useCallback(async (silent?: boolean) => {
    if (!workoutId) {
      setError('Missing session id.');
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const resp = await fetchJson<WorkoutPayload>(`/workouts/mobile/${workoutId}`, { method: 'GET' });
      const json = resp.json || {};
      if (!resp.ok || !json.ok || !json.workout) {
        throw new Error(json.error || `HTTP ${resp.status}`);
      }
      setPayload(json);
    } catch (err: any) {
      setPayload(null);
      setError(err?.message || 'Session workspace could not load.');
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [workoutId]);

  useFocusEffect(
    useCallback(() => {
      void loadSession(false);
    }, [loadSession])
  );

  useEffect(() => {
    let active = true;
    setMovementGroupsLoading(true);
    fetchJson<MovementPresetPayload>('/workouts/mobile/movement_presets', { method: 'GET' })
      .then((resp) => {
        const json = resp.json || {};
        if (!active) return;
        setMovementGroups(Array.isArray(json.training_lifts?.categories) ? json.training_lifts.categories : []);
        setAccessoryGroups(Array.isArray(json.accessories?.categories) ? json.accessories.categories : []);
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
  }, []);

  const workout = payload?.workout || null;
  const coreItems = workout?.core_items || [];
  const accessoryItems = useMemo(
    () => (workout?.accessory_groups || []).flatMap((group) => group.items || []),
    [workout?.accessory_groups]
  );

  const status = humanStatus(workout?.raw_status || workout?.status);
  const title = sessionTitle(workout?.label);
  const context = sessionContext(workout?.label, workout?.date);
  const executionCtaLabel = executionLabel(workout?.raw_status || workout?.status);

  const closeToProgrammingHome = () => {
    router.replace({
      pathname: '/(tabs)/workout' as any,
      params: {
        ...(programmingBlockId ? { programmingBlockId } : {}),
        ...(programmingWeek ? { programmingWeek } : {}),
        ...(programmingDay ? { programmingDay } : {}),
      },
    });
  };

  const openSessionLogger = () => {
    if (!workout?.id) return;
    router.push({
      pathname: '/workout/[workoutId]',
      params: { workoutId: String(workout.id) },
    });
  };

  const openTrainingLiftEditor = (item: WorkoutItem) => {
    setTrainingLiftEditor({
      mode: 'edit',
      item,
      setup: trainingLiftSetupFromItem(item, movementGroups),
    });
  };

  const openAddCoreLiftEditor = () => {
    setTrainingLiftEditor({
      mode: 'add',
      item: null,
      setup: defaultTrainingLiftSetup(coreItems.length, movementGroups),
    });
  };

  const openAccessoryEditor = (item: WorkoutItem) => {
    setAccessoryEditor({
      mode: 'edit',
      item,
      setup: accessorySetupFromItem(item, accessoryGroups),
    });
  };

  const openAddAccessoryEditor = () => {
    setAccessoryEditor({
      mode: 'add',
      item: null,
      setup: defaultAccessorySetup(accessoryGroups),
    });
  };

  const applyTrainingLiftSetup = async (setup: TrainingLiftSetup) => {
    if (!workout?.id || !trainingLiftEditor) return;
    try {
      setTrainingLiftSaving(true);
      const isAddMode = trainingLiftEditor.mode === 'add';
      const endpoint = isAddMode
        ? `/workouts/mobile/${workout.id}/core-lifts`
        : `/workouts/mobile/${workout.id}/items/${trainingLiftEditor.item?.id}/programming`;
      const resp = await fetchJson(endpoint, {
        method: isAddMode ? 'POST' : 'PATCH',
        body: {
          movement: setup.movement,
          lift: setup.lift,
          designation: setup.designation,
          scheme: setup.scheme,
          mode: setup.mode,
          notes: setup.notes,
          ...(isAddMode
            ? {
                sets: 4,
                reps: 5,
                rpe_target: 7,
                pct: 70,
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

  const startSessionRename = () => {
    setSessionNameDraft(title);
    setRenamingSession(true);
  };

  const cancelSessionRename = () => {
    setSessionNameDraft('');
    setRenamingSession(false);
  };

  const saveSessionRename = async () => {
    if (!workout?.id) return;
    const label = sessionNameDraft.trim();
    if (!label) return;
    try {
      setSessionRenameSaving(true);
      const resp = await fetchJson(`/workouts/mobile/${workout.id}/rename`, {
        method: 'PATCH',
        body: { label } as any,
      });
      const json: any = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setRenamingSession(false);
      await loadSession(true);
    } catch (err: any) {
      Alert.alert('Could not rename session', err?.message || 'Please try again.');
    } finally {
      setSessionRenameSaving(false);
    }
  };

  const openReorderEditor = () => {
    setReorderEditor({
      coreIds: coreItems.map((item) => item.id),
      accessoryIds: accessoryItems.map((item) => item.id),
    });
  };

  const applyReorder = async (nextOrder: ReorderEditorState) => {
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
      if (!setup.movementDefinitionId) {
        throw new Error('Select a canonical movement before applying changes.');
      }
      const legacy = accessoryEditor.item?.legacy;
      if (
        accessoryEditor.mode === 'edit'
        && accessoryEditor.item?.id
        && legacy?.state === 'legacy_unresolved'
        && legacy.original_text
      ) {
        const previewResponse = await fetchJson<any>('/workouts/mobile/legacy-accessory-resolutions/preview', {
          method: 'POST',
          body: { legacy_label: legacy.original_text } as any,
        });
        const preview = previewResponse.json?.preview || {};
        if (!previewResponse.ok || !previewResponse.json?.ok) {
          throw new Error(previewResponse.json?.error || 'Legacy impact could not be loaded.');
        }
        const counts = preview.counts || {};
        const resolutionScope = await new Promise<'cancel' | 'occurrence' | 'mapping'>((resolve) => {
          Alert.alert(
            'Resolve this legacy name?',
            [
              `“${legacy.original_text}” will map to “${setup.movement}”.`,
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
        if (resolutionScope === 'cancel') return;
        const resolutionResponse = await fetchJson<any>('/workouts/mobile/legacy-accessory-resolutions/resolve', {
          method: 'POST',
          body: {
            legacy_label: legacy.original_text,
            movement_definition_id: setup.movementDefinitionId,
            expected_revision: legacy.mapping?.revision || undefined,
            remember: resolutionScope === 'mapping',
            workout_item_id: accessoryEditor.item.id,
          } as any,
        });
        if (!resolutionResponse.ok || !resolutionResponse.json?.ok) {
          throw new Error(resolutionResponse.json?.error || 'Legacy movement could not be resolved.');
        }
      }
      const body = {
        movement: setup.movement,
        movement_definition_id: setup.movementDefinitionId,
        notes: setup.notes,
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

  const saveHotEdit = async (item: WorkoutItem, kind: EditKind, values: Record<string, string>) => {
    if (!workout?.id) return;
    const body = kind === 'accessory'
      ? {
          sets: values.sets,
          reps_text: values.repsText,
          rir_target: values.rir,
          notes: values.notes,
        }
        : {
          sets: values.sets,
          reps: values.reps,
          rpe_target: values.rpe,
          pct: values.pct,
          target_low_lb: values.targetLow,
          target_high_lb: values.targetHigh,
          notes: values.notes,
        };

    try {
      setSavingEdit(true);
      const resp = await fetchJson(`/workouts/mobile/${workout.id}/items/${item.id}/programming`, {
        method: 'PATCH',
        body: body as any,
      });
      const json: any = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setEditing(null);
      await loadSession(true);
    } catch (err: any) {
      Alert.alert('Could not save edit', err?.message || 'Please try again.');
    } finally {
      setSavingEdit(false);
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

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadSession(true)} tintColor={colors.muted} />
        }
      >
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.violet} />
            <Text style={styles.stateTitle}>Loading Session Workspace</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.red} />
            <Text style={styles.stateTitle}>Workspace unavailable</Text>
            <Text style={styles.stateBody}>{error}</Text>
          </View>
        ) : workout ? (
          <>
            <View style={styles.workspaceHeader}>
              <View style={styles.headerTitleRow}>
                {renamingSession ? (
                  <View style={styles.sessionRenameEditor}>
                    <TextInput
                      value={sessionNameDraft}
                      onChangeText={setSessionNameDraft}
                      placeholder="Session name"
                      placeholderTextColor={colors.subtle}
                      style={styles.sessionRenameInput}
                      autoFocus
                    />
                    <View style={styles.sessionRenameActions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={sessionRenameSaving}
                        onPress={cancelSessionRename}
                        style={({ pressed }) => [styles.sessionRenameSecondary, pressed && styles.pressed]}
                      >
                        <Text style={styles.sessionRenameSecondaryText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={sessionRenameSaving || !sessionNameDraft.trim()}
                        onPress={saveSessionRename}
                        style={({ pressed }) => [
                          styles.sessionRenamePrimary,
                          (sessionRenameSaving || !sessionNameDraft.trim()) && styles.editorDisabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.sessionRenamePrimaryText}>{sessionRenameSaving ? 'Saving' : 'Save'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Rename session"
                    onPress={startSessionRename}
                    style={({ pressed }) => [styles.sessionNameButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.sessionName}>{title}</Text>
                    <Ionicons name="create-outline" size={18} color={colors.muted} />
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close session workspace"
                  onPress={closeToProgrammingHome}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={20} color={colors.textStrong} />
                </Pressable>
              </View>
              <View style={styles.headerMetaRow}>
                <View style={styles.headerMetaCopy}>
                  <Text style={styles.sessionMeta}>{context}</Text>
                  <Text style={styles.statusPill}>{status}</Text>
                </View>
                <View style={styles.headerActionGroup}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={executionCtaLabel}
                    onPress={openSessionLogger}
                    style={({ pressed }) => [styles.headerStartButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.headerStartText}>{executionCtaLabel}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Reorder session items"
                    onPress={openReorderEditor}
                    style={({ pressed }) => [styles.headerReorderButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="swap-vertical-outline" size={16} color={colors.violet} />
                    <Text style={styles.headerReorderText}>Reorder</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <SectionHeader
              title="Core Lifts"
              countLabel={`${coreItems.length} ${coreItems.length === 1 ? 'lift' : 'lifts'}`}
              actionLabel="+ Core Lift"
              onAction={openAddCoreLiftEditor}
            />
            {coreItems.length ? (
              coreItems.map((item) => (
                <LiftCard
                  key={item.id}
                  item={item}
                  kind="core"
                  editing={editing?.item.id === item.id ? editing : null}
                  saving={savingEdit}
                  onEdit={(field) => setEditing({ item, kind: 'core', field })}
                  onOpenTrainingLiftEditor={() => openTrainingLiftEditor(item)}
                  onInfo={setLoadStyleInfo}
                  onCancelEdit={() => setEditing(null)}
                  onSaveEdit={(values) => saveHotEdit(item, 'core', values)}
                />
              ))
            ) : (
              <EmptySection label="No core lifts in this session." />
            )}

            <SectionHeader
              title="Accessories"
              countLabel={`${accessoryItems.length} ${accessoryItems.length === 1 ? 'exercise' : 'exercises'}`}
              actionLabel="+ Accessory"
              onAction={openAddAccessoryEditor}
            />
            {accessoryItems.length ? (
              accessoryItems.map((item) => (
                <LiftCard
                  key={item.id}
                  item={item}
                  kind="accessory"
                  editing={editing?.item.id === item.id ? editing : null}
                  saving={savingEdit}
                  onEdit={(field) => setEditing({ item, kind: 'accessory', field })}
                  onOpenTrainingLiftEditor={() => openAccessoryEditor(item)}
                  onInfo={setLoadStyleInfo}
                  onCancelEdit={() => setEditing(null)}
                  onSaveEdit={(values) => saveHotEdit(item, 'accessory', values)}
                />
              ))
            ) : (
              <EmptySection label="No accessories in this session." />
            )}

            <SessionActions
              status={workout.raw_status || workout.status}
              pendingAction={pendingAction}
              onRevert={revertToDraft}
              onCopy={() => setCalendarAction('copy')}
              onSaveTemplate={saveAsTemplate}
              onMove={() => setCalendarAction('move')}
              onDelete={deleteSession}
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
            <LoadStyleInfoModal
              styleType={loadStyleInfo}
              onClose={() => setLoadStyleInfo(null)}
            />
            <TrainingLiftEditorModal
              state={trainingLiftEditor}
              groups={movementGroups}
              loadingGroups={movementGroupsLoading}
              saving={trainingLiftSaving}
              onChange={(setup) => setTrainingLiftEditor((current) => current ? { ...current, setup } : current)}
              onCancel={() => setTrainingLiftEditor(null)}
              onApply={applyTrainingLiftSetup}
            />
            <AccessoryEditorModal
              state={accessoryEditor}
              groups={accessoryGroups}
              loadingGroups={movementGroupsLoading}
              saving={accessorySaving}
              onChange={(setup) => setAccessoryEditor((current) => current ? { ...current, setup } : current)}
              onCancel={() => setAccessoryEditor(null)}
              onApply={applyAccessorySetup}
            />
            <ReorderEditorModal
              state={reorderEditor}
              coreItems={coreItems}
              accessoryItems={accessoryItems}
              saving={reorderSaving}
              onChange={setReorderEditor}
              onCancel={() => setReorderEditor(null)}
              onApply={applyReorder}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  countLabel,
  actionLabel,
  onAction,
}: {
  title: string;
  countLabel?: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {countLabel ? <Text style={styles.sectionCountPill}>{countLabel}</Text> : null}
      </View>
      {onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.sectionActionButton, pressed && styles.pressed]}
        >
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      ) : (
        <DisabledAction label={actionLabel} compact />
      )}
    </View>
  );
}

function LiftCard({
  item,
  kind,
  editing,
  saving,
  onEdit,
  onOpenTrainingLiftEditor,
  onInfo,
  onCancelEdit,
  onSaveEdit,
}: {
  item: WorkoutItem;
  kind: EditKind;
  editing: HotEditState | null;
  saving: boolean;
  onEdit: (field: HotEditField) => void;
  onOpenTrainingLiftEditor: () => void;
  onInfo: (styleType: LoadStyleInfo) => void;
  onCancelEdit: () => void;
  onSaveEdit: (values: Record<string, string>) => void;
}) {
  const name = simplifyMobileMovementName(item.movement || item.original_movement || liftName(item.lift)) || 'Training item';
  const designation = designationLabel(item.designation, kind);
  const showDesignation = designation && designation !== 'Core Lift' && designation !== 'Accessory';
  const variant = variantLabel(item.variant);
  const target = kind === 'core' ? targetText(item) : '';
  const hasNotes = !!String(item.notes || '').trim();
  const plannedSets = item.planned_sets || [];
  const isEditing = !!editing;
  const iconName: keyof typeof Ionicons.glyphMap = kind === 'core' ? 'barbell-outline' : 'fitness-outline';

  return (
    <View style={[styles.liftCard, kind === 'accessory' && styles.liftCardAccessory]}>
      <View style={[styles.liftAccentRail, kind === 'accessory' && styles.liftAccentRailAccessory]} />
      <View style={styles.liftHeader}>
        <View style={styles.liftTitleRow}>
          <View style={[styles.liftIconShell, kind === 'accessory' && styles.liftIconShellAccessory]}>
            <Ionicons name={iconName} size={20} color={kind === 'core' ? colors.violet : colors.green} />
          </View>
          <View style={styles.liftTitleWrap}>
            <Text style={styles.liftName}>{name}</Text>
            <View style={styles.liftTags}>
              {showDesignation ? <Text style={styles.softTag}>{designation}</Text> : null}
              {variant ? <Text style={styles.softTag}>{variant}</Text> : null}
            </View>
          </View>
        </View>
        <View style={styles.itemActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${name}`}
            onPress={onOpenTrainingLiftEditor}
            style={({ pressed }) => [styles.inlineEditButton, pressed && styles.pressed]}
          >
            <Text style={styles.inlineEditText}>Edit</Text>
          </Pressable>
          <DisabledIconAction icon="close" />
        </View>
      </View>

      <View style={styles.prescriptionRow}>
        <PrescriptionTokens item={item} kind={kind} onEdit={onEdit} onInfo={onInfo} />
        {target ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit target range for ${name}`}
            onPress={() => onEdit('load')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.targetText}>{target}</Text>
          </Pressable>
        ) : null}
      </View>

      {isEditing ? (
        <InlineLiftEditor
          item={item}
          kind={kind}
          editing={editing}
          saving={saving}
          onCancel={onCancelEdit}
          onSave={onSaveEdit}
        />
      ) : null}

      {plannedSets.length > 0 ? (
        <View style={styles.plannedSetList}>
          {plannedSets.slice(0, 4).map((set, index) => (
            <Text key={`${item.id}-${set.set_index || index}`} style={styles.plannedSetText}>
              Set {set.set_index || index + 1}: {plannedSetText(set)}
            </Text>
          ))}
          {plannedSets.length > 4 ? (
            <Text style={styles.plannedSetText}>+ {plannedSets.length - 4} more planned sets</Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit notes for ${name}`}
        onPress={() => onEdit('notes')}
        style={({ pressed }) => [styles.notesIndicator, pressed && styles.pressed]}
      >
        <Ionicons name={hasNotes ? 'information-circle-outline' : 'add-circle-outline'} size={15} color={colors.violet} />
        <Text style={styles.notesText}>{hasNotes ? 'Movement notes' : 'Add movement notes'}</Text>
      </Pressable>
    </View>
  );
}

function PrescriptionTokens({
  item,
  kind,
  onEdit,
  onInfo,
}: {
  item: WorkoutItem;
  kind: EditKind;
  onEdit: (field: HotEditField) => void;
  onInfo: (styleType: LoadStyleInfo) => void;
}) {
  const sets = numberText(item.sets);
  const reps = String(item.reps_text || numberText(item.reps) || '').trim();
  if (!sets && !reps) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit sets"
        onPress={() => onEdit('sets')}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text style={styles.prescriptionText}>Prescription pending</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.tokenLine}>
      {sets ? <PrescriptionToken label={sets} field="sets" onEdit={onEdit} /> : null}
      {sets && reps ? <Text style={styles.tokenJoiner}>x</Text> : null}
      {reps ? <PrescriptionToken label={reps} field={kind === 'accessory' ? 'accessory_reps' : 'reps'} onEdit={onEdit} /> : null}
      {kind === 'accessory' && item.rir_target != null ? (
        <>
          <Text style={styles.tokenJoiner}>@</Text>
          <PrescriptionToken label={formatNumber(item.rir_target)} field="rir" onEdit={onEdit} />
          <Text style={styles.tokenJoiner}>RIR</Text>
          <LoadStyleInfoButton styleType="rir" onInfo={onInfo} />
        </>
      ) : null}
      {kind === 'core' && String(item.mode || 'RPE').toUpperCase() === 'PCT' && item.pct != null ? (
        <>
          <Text style={styles.tokenJoiner}>@</Text>
          <PrescriptionToken label={formatNumber(displayPct(item.pct))} field="pct" onEdit={onEdit} />
          <Text style={styles.tokenJoiner}>%</Text>
          <LoadStyleInfoButton styleType="pct" onInfo={onInfo} />
        </>
      ) : null}
      {kind === 'core' && String(item.mode || 'RPE').toUpperCase() !== 'PCT' && item.rpe_target != null ? (
        <>
          <Text style={styles.tokenJoiner}>@</Text>
          <PrescriptionToken label={formatNumber(item.rpe_target)} field="rpe" onEdit={onEdit} />
          <Text style={styles.tokenJoiner}>RPE</Text>
          <LoadStyleInfoButton styleType="rpe" onInfo={onInfo} />
        </>
      ) : null}
    </View>
  );
}

function LoadStyleInfoButton({
  styleType,
  onInfo,
}: {
  styleType: LoadStyleInfo;
  onInfo: (styleType: LoadStyleInfo) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`About ${styleType === 'pct' ? 'percent 1RM' : styleType.toUpperCase()}`}
      onPress={() => onInfo(styleType)}
      hitSlop={8}
      style={({ pressed }) => [styles.loadStyleInfoButton, pressed && styles.pressed]}
    >
      <Ionicons name="information-circle-outline" size={15} color={colors.violet} />
    </Pressable>
  );
}

function PrescriptionToken({
  label,
  field,
  onEdit,
}: {
  label: string;
  field: HotEditField;
  onEdit: (field: HotEditField) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${field}`}
      onPress={() => onEdit(field)}
      style={({ pressed }) => [styles.prescriptionText, pressed && styles.pressed]}
    >
      <Text style={styles.prescriptionTokenText}>{label}</Text>
    </Pressable>
  );
}

function InlineLiftEditor({
  item,
  kind,
  editing,
  saving,
  onCancel,
  onSave,
}: {
  item: WorkoutItem;
  kind: EditKind;
  editing: HotEditState;
  saving: boolean;
  onCancel: () => void;
  onSave: (values: Record<string, string>) => void;
}) {
  const [sets, setSets] = useState(String(item.sets ?? ''));
  const [reps, setReps] = useState(String(item.reps ?? ''));
  const [repsText, setRepsText] = useState(String(item.reps_text || item.reps || ''));
  const [rpe, setRpe] = useState(String(item.rpe_target ?? ''));
  const [pct, setPct] = useState(item.pct != null ? String(formatNumber(displayPct(item.pct))) : '');
  const [rir, setRir] = useState(String(item.rir_target ?? ''));
  const [notes, setNotes] = useState(String(item.notes || ''));
  const initialLoad = loadEditorInfo(item);
  const [manualTarget, setManualTarget] = useState(initialLoad.targetDisplay);
  const [manualRange, setManualRange] = useState(initialLoad.rangeDisplay);
  const normalizedTarget = parseDisplayNumber(manualTarget);
  const normalizedRange = Math.max(0, parseDisplayNumber(manualRange) || 0);
  const targetLow = normalizedTarget ? Math.max(0, normalizedTarget - normalizedRange) : '';
  const targetHigh = normalizedTarget ? normalizedTarget + normalizedRange : '';
  const stepLoad = (field: 'target' | 'range', direction: -1 | 1) => {
    const current = field === 'target' ? parseDisplayNumber(manualTarget) : parseDisplayNumber(manualRange);
    const next = Math.max(0, (current || 0) + direction * 5);
    if (field === 'target') setManualTarget(String(next));
    else setManualRange(String(next));
  };
  const useSuggested = () => {
    if (!initialLoad.suggestedTargetDisplay) return;
    setManualTarget(initialLoad.suggestedTargetDisplay);
    setManualRange(initialLoad.suggestedRangeDisplay);
  };
  const clearOverride = () => {
    setManualTarget('');
    setManualRange('');
  };

  return (
    <View style={styles.inlineEditor}>
      {editing.field === 'load' && kind === 'core' ? (
        <View style={styles.webLoadEditor}>
          <View style={styles.webEditorMeta}>
            <Text style={styles.webEditorMetaLabel}>Suggested</Text>
            <Text style={styles.webEditorMetaValue}>{initialLoad.suggestedLabel || 'No TM suggestion'}</Text>
            {initialLoad.calculatedLabel ? <Text style={styles.webEditorMetaHint}>{initialLoad.calculatedLabel}</Text> : null}
          </View>
          <WebLoadStepper
            label="Manual Override"
            value={manualTarget}
            unit="lb"
            onChangeText={setManualTarget}
            onStep={(direction) => stepLoad('target', direction)}
            inputLabel="Manual target load in lb"
          />
          <WebLoadStepper
            label="Range"
            value={manualRange}
            unit="lb"
            prefix="±"
            onChangeText={setManualRange}
            onStep={(direction) => stepLoad('range', direction)}
            inputLabel="Manual range in lb"
          />
          <View style={styles.webLoadActions}>
            <Pressable
              disabled={!initialLoad.suggestedTargetDisplay}
              onPress={useSuggested}
              style={[styles.webLoadAction, !initialLoad.suggestedTargetDisplay && styles.editorDisabled]}
            >
              <Text style={styles.webLoadActionText}>Use suggested</Text>
            </Pressable>
            <Pressable onPress={clearOverride} style={styles.webLoadAction}>
              <Text style={styles.webLoadActionText}>Clear override</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {editing.field === 'accessory_reps' ? (
        <AccessoryRepTargetEditor value={repsText} onChange={setRepsText} />
      ) : null}
      {editing.field !== 'load' && editing.field !== 'notes' && editing.field !== 'accessory_reps' ? (
        <WebPrescriptionValueEditor
          field={editing.field}
          value={
            editing.field === 'sets' ? sets
              : editing.field === 'reps' ? reps
                : editing.field === 'rpe' ? rpe
                  : editing.field === 'pct' ? pct
                    : rir
          }
          onChange={
            editing.field === 'sets' ? setSets
              : editing.field === 'reps' ? setReps
                : editing.field === 'rpe' ? setRpe
                  : editing.field === 'pct' ? setPct
                    : setRir
          }
        />
      ) : null}
      {editing.field === 'notes' ? (
      <View style={styles.editorFieldFull}>
        <Text style={styles.editorLabel}>Movement Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Movement notes"
          placeholderTextColor={colors.subtle}
          multiline
          style={[styles.editorInput, styles.editorNotesInput]}
        />
      </View>
      ) : null}
      <View style={styles.editorActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          disabled={saving}
          style={({ pressed }) => [styles.editorSecondary, pressed && styles.pressed]}
        >
          <Text style={styles.editorSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onSave({
            ...(editing.field === 'sets' ? { sets } : {}),
            ...(editing.field === 'reps' ? { reps } : {}),
            ...(editing.field === 'rpe' ? { rpe } : {}),
            ...(editing.field === 'pct' ? { pct } : {}),
            ...(editing.field === 'accessory_reps' ? { repsText } : {}),
            ...(editing.field === 'rir' ? { rir } : {}),
            ...(editing.field === 'load' ? { targetLow: String(targetLow), targetHigh: String(targetHigh) } : {}),
            ...(editing.field === 'notes' ? { notes } : {}),
          })}
          disabled={saving}
          style={({ pressed }) => [styles.editorPrimary, pressed && styles.pressed, saving && styles.editorDisabled]}
        >
          <Text style={styles.editorPrimaryText}>{saving ? 'Saving' : 'Apply'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WebPrescriptionValueEditor({
  field,
  value,
  onChange,
  options: customOptions,
}: {
  field: HotEditField;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
}) {
  const kind = field === 'accessory_reps' ? 'accessory_reps' : field;
  const options = customOptions || notationOptionsFor(kind);
  const scrollRef = useRef<ScrollView>(null);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteracting = useRef(false);
  const [wheelWidth, setWheelWidth] = useState(0);
  const sidePadding = Math.max(0, (wheelWidth - WHEEL_ITEM_WIDTH) / 2);
  const selectedIndex = Math.max(0, options.findIndex((option) => String(option) === String(value)));

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({
      x: Math.max(0, index * WHEEL_ITEM_WIDTH),
      y: 0,
      animated,
    });
  }, []);

  useEffect(() => {
    if (isInteracting.current) return;
    if (!wheelWidth || selectedIndex < 0) return;
    requestAnimationFrame(() => scrollToIndex(selectedIndex, false));
  }, [scrollToIndex, selectedIndex, wheelWidth]);

  useEffect(() => () => {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
  }, []);

  const settleWheel = (offsetX: number, animated = true) => {
    if (!options.length) return;
    const index = Math.min(options.length - 1, Math.max(0, Math.round(offsetX / WHEEL_ITEM_WIDTH)));
    onChange(options[index]);
    const targetX = index * WHEEL_ITEM_WIDTH;
    if (Math.abs(offsetX - targetX) > 1) scrollToIndex(index, animated);
  };

  const settleAfterQuietDrag = (offsetX: number) => {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = setTimeout(() => {
      isInteracting.current = false;
      settleWheel(offsetX, true);
    }, 90);
  };

  return (
    <View style={styles.webValueEditor}>
      <View
        style={styles.wheelFrame}
        onLayout={(event) => setWheelWidth(event.nativeEvent.layout.width)}
      >
        <View pointerEvents="none" style={styles.wheelCenterMarker} />
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="normal"
          snapToInterval={WHEEL_ITEM_WIDTH}
          snapToAlignment="start"
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.wheelContent,
            { paddingLeft: sidePadding, paddingRight: sidePadding },
          ]}
          onScrollBeginDrag={() => {
            isInteracting.current = true;
            if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
          }}
          onMomentumScrollBegin={() => {
            isInteracting.current = true;
            if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
          }}
          onMomentumScrollEnd={(event) => {
            isInteracting.current = false;
            settleWheel(event.nativeEvent.contentOffset.x, true);
          }}
          onScrollEndDrag={(event) => {
            settleAfterQuietDrag(event.nativeEvent.contentOffset.x);
          }}
        >
          {options.map((option) => {
            const selected = String(option) === String(value);
            return (
              <Pressable
                key={`${kind}-${option}`}
                onPress={() => {
                  onChange(option);
                  scrollToIndex(options.indexOf(option), true);
                }}
                style={styles.wheelItem}
              >
                <Text style={[styles.wheelItemText, selected && styles.wheelItemTextSelected]}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function AccessoryRepTargetEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parsed = useMemo(() => parseAccessoryRepTarget(value), [value]);
  const repOptions = useMemo(() => Array.from({ length: 30 }, (_, index) => String(index + 1)), []);

  const setType = (nextType: AccessoryRepType) => {
    if (nextType === 'amrap') {
      onChange('AMRAP');
      return;
    }
    if (nextType === 'range') {
      const low = parsed.type === 'range' ? parsed.low || 10 : parsed.value || 10;
      const high = parsed.type === 'range' ? parsed.high || Math.max(low + 2, 12) : Math.max(low + 2, 12);
      onChange(`${low}-${high}`);
      return;
    }
    if (nextType === 'plus') {
      const target = parsed.type === 'plus' ? parsed.value : parsed.value || parsed.low || 10;
      onChange(`${target}+`);
      return;
    }
    onChange(String(parsed.value || parsed.low || 10));
  };

  const setFixed = (next: string) => onChange(next);
  const setPlus = (next: string) => onChange(`${next}+`);
  const setRangeLow = (next: string) => {
    const low = Number(next);
    const high = Math.max(low, parsed.high || low);
    onChange(`${low}-${high}`);
  };
  const setRangeHigh = (next: string) => {
    const high = Number(next);
    const low = Math.min(parsed.low || high, high);
    onChange(`${low}-${high}`);
  };

  return (
    <View style={styles.repTargetEditor}>
      <Text style={styles.editorLabel}>Rep Type</Text>
      <View style={styles.repTypeGrid}>
        {[
          { key: 'fixed' as const, label: 'Fixed Reps' },
          { key: 'range' as const, label: 'Rep Range' },
          { key: 'plus' as const, label: 'Plus Set' },
          { key: 'amrap' as const, label: 'AMRAP' },
        ].map((option) => {
          const selected = parsed.type === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setType(option.key)}
              style={({ pressed }) => [
                styles.repTypeButton,
                selected && styles.repTypeButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.repTypeDot, selected && styles.repTypeDotActive]} />
              <Text style={[styles.repTypeText, selected && styles.repTypeTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {parsed.type === 'fixed' ? (
        <View style={styles.repWheelBlock}>
          <Text style={styles.editorLabel}>Reps</Text>
          <WebPrescriptionValueEditor
            field="accessory_reps"
            value={String(parsed.value || 10)}
            onChange={setFixed}
            options={repOptions}
          />
        </View>
      ) : null}

      {parsed.type === 'range' ? (
        <View style={styles.repRangeGrid}>
          <View style={styles.repWheelBlock}>
            <Text style={styles.editorLabel}>Low Reps</Text>
            <WebPrescriptionValueEditor
              field="accessory_reps"
              value={String(parsed.low || 10)}
              onChange={setRangeLow}
              options={repOptions}
            />
          </View>
          <View style={styles.repWheelBlock}>
            <Text style={styles.editorLabel}>High Reps</Text>
            <WebPrescriptionValueEditor
              field="accessory_reps"
              value={String(parsed.high || 12)}
              onChange={setRangeHigh}
              options={repOptions}
            />
          </View>
        </View>
      ) : null}

      {parsed.type === 'plus' ? (
        <View style={styles.repWheelBlock}>
          <Text style={styles.editorLabel}>Target Reps</Text>
          <WebPrescriptionValueEditor
            field="accessory_reps"
            value={String(parsed.value || 10)}
            onChange={setPlus}
            options={repOptions}
          />
        </View>
      ) : null}

      {parsed.type === 'amrap' ? (
        <View style={styles.amrapSelectedBox}>
          <Text style={styles.amrapSelectedText}>AMRAP</Text>
        </View>
      ) : null}
    </View>
  );
}

function WebLoadStepper({
  label,
  value,
  unit,
  prefix,
  inputLabel,
  onChangeText,
  onStep,
}: {
  label: string;
  value: string;
  unit: string;
  prefix?: string;
  inputLabel: string;
  onChangeText: (value: string) => void;
  onStep: (direction: -1 | 1) => void;
}) {
  return (
    <View style={styles.webLoadStepper}>
      <Text style={styles.webLoadStepperLabel}>{label}</Text>
      <Pressable
        onPress={() => onStep(-1)}
        style={styles.webLoadStepButton}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label.toLowerCase()}`}
      >
        <Text style={styles.webLoadStepText}>-</Text>
      </Pressable>
      <View style={styles.webLoadField}>
        {prefix ? <Text style={styles.webLoadPrefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          accessibilityLabel={inputLabel}
          style={styles.webLoadInput}
        />
        <Text style={styles.webLoadUnit}>{unit}</Text>
      </View>
      <Pressable
        onPress={() => onStep(1)}
        style={styles.webLoadStepButton}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label.toLowerCase()}`}
      >
        <Text style={styles.webLoadStepText}>+</Text>
      </Pressable>
    </View>
  );
}

function TrainingLiftEditorModal({
  state,
  groups,
  loadingGroups,
  saving,
  onChange,
  onCancel,
  onApply,
}: {
  state: TrainingLiftEditorState | null;
  groups: MovementPresetGroup[];
  loadingGroups: boolean;
  saving: boolean;
  onChange: (setup: TrainingLiftSetup) => void;
  onCancel: () => void;
  onApply: (setup: TrainingLiftSetup) => void | Promise<void>;
}) {
  const setup = state?.setup || null;
  const activeGroup = setup ? movementGroupByKey(groups, setup.family) || groups[0] || null : null;
  const isCompetition = activeGroup?.key === 'competition_lifts';
  const title = state?.mode === 'add' ? 'Add training lift' : 'Change training lift';

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
    });
  };

  const chooseMovement = (movement: MovementPreset | string) => {
    if (!activeGroup) return;
    const preset = movementPresetFromValue(movement, activeGroup);
    patchSetup({
      movement: preset.name,
      family: preset.categoryKey || activeGroup.key,
      lift: preset.lift,
    });
  };

  const useCustomMovement = () => {
    if (!setup?.customMovement.trim()) return;
    patchSetup({
      movement: setup.customMovement.trim(),
      lift: 'VR',
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
              <View style={styles.trainingLiftCardGrid}>
                {(activeGroup?.movements || []).slice(0, isCompetition ? 3 : 14).map((movement) => {
                  const preset = movementPresetFromValue(movement, activeGroup);
                  const selected = preset.name === setup.movement;
                  return (
                    <TrainingLiftOptionCard
                      key={`${activeGroup?.key}-${preset.name}`}
                      title={preset.name}
                      detail={isCompetition ? 'TM-based competition lift' : `${activeGroup?.name || 'Training lift'} · manual load required`}
                      selected={selected}
                      tone={isCompetition ? 'primary' : 'amber'}
                      onPress={() => chooseMovement(movement)}
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

            <TrainingLiftSection title="Pattern">
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
            </TrainingLiftSection>

            <TrainingLiftSection title="Load language">
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
              disabled={saving || !setup.movement}
              onPress={() => onApply(setup)}
              style={({ pressed }) => [
                styles.trainingLiftActionPrimary,
                (saving || !setup.movement) && styles.editorDisabled,
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
  const setup = state?.setup || null;
  const activeGroup = setup ? movementGroupByKey(groups, setup.family) || groups[0] || null : null;
  const title = state?.mode === 'add' ? 'Add accessory' : 'Change accessory';

  const patchSetup = (patch: Partial<AccessorySetup>) => {
    if (!setup) return;
    onChange({ ...setup, ...patch });
  };

  const chooseFamily = (group: MovementPresetGroup) => {
    const first = group.movements?.[0] || null;
    const name = movementPresetName(first);
    patchSetup({
      family: group.key,
      movement: name || setup?.movement || '',
      movementDefinitionId: movementPresetId(first),
    });
  };

  const chooseMovement = (movement: MovementPreset | string) => {
    if (!activeGroup) return;
    const name = movementPresetName(movement);
    patchSetup({
      movement: name,
      movementDefinitionId: movementPresetId(movement),
      family: activeGroup.key,
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
                  <View style={styles.trainingLiftCardGrid}>
                    {(activeGroup?.movements || []).slice(0, 18).map((movement) => {
                      const name = movementPresetName(movement);
                      const selected = name === setup.movement;
                      return (
                        <TrainingLiftOptionCard
                          key={`${activeGroup?.key}-${name}`}
                          title={name}
                          detail={activeGroup?.name || 'Accessory movement'}
                          selected={selected}
                          tone="amber"
                          onPress={() => chooseMovement(movement)}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.trainingLiftMuted}>New accessories use governed catalog identity. Create custom movements from the full movement library.</Text>
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
                  disabled={saving || !setup.movement}
                  onPress={() => onApply(setup)}
                  style={({ pressed }) => [
                    styles.trainingLiftActionPrimary,
                    (saving || !setup.movement) && styles.editorDisabled,
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
  onChange,
  onCancel,
  onApply,
}: {
  state: ReorderEditorState | null;
  coreItems: WorkoutItem[];
  accessoryItems: WorkoutItem[];
  saving: boolean;
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
            <Text style={styles.trainingLiftEditorTitle}>Reorder Workout Items</Text>
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
          />
          <ReorderSection
            title="Accessories"
            ids={state?.accessoryIds || []}
            itemsById={accessoryById}
            kind="accessory"
            onMove={moveItem}
            onDraggingChange={setDragging}
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
}: {
  title: string;
  ids: number[];
  itemsById: Map<number, WorkoutItem>;
  kind: 'core' | 'accessory';
  onMove: (kind: 'core' | 'accessory', id: number, targetIndex: number) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  return (
    <TrainingLiftSection title={title}>
      <View style={styles.reorderList}>
        {ids.length ? ids.map((id, index) => {
          const item = itemsById.get(id);
          if (!item) return null;
          const name = simplifyMobileMovementName(item.movement || item.original_movement || liftName(item.lift)) || 'Training item';
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
}: {
  id: number;
  kind: 'core' | 'accessory';
  index: number;
  itemCount: number;
  name: string;
  meta: string;
  onMove: (kind: 'core' | 'accessory', id: number, targetIndex: number) => void;
  onDraggingChange: (dragging: boolean) => void;
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
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      isDragging.value = false;
      runOnJS(onDraggingChange)(false);
      if (targetIndex !== index) {
        runOnJS(onMove)(kind, id, targetIndex);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: withSpring(isDragging.value ? 1.025 : 1, { damping: 18, stiffness: 240 }) },
    ],
    opacity: withSpring(isDragging.value ? 0.96 : 1, { damping: 18, stiffness: 240 }),
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
      </Animated.View>
    </GestureDetector>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>{label}</Text>
    </View>
  );
}

function SessionActions({
  status,
  pendingAction,
  onRevert,
  onCopy,
  onSaveTemplate,
  onMove,
  onDelete,
}: {
  status?: string | null;
  pendingAction: SessionActionKey | null;
  onRevert: () => void;
  onCopy: () => void;
  onSaveTemplate: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const isDraft = String(status || '').toLowerCase() === 'draft';
  const actions: Array<{
    key: SessionActionKey;
    label: string;
    onPress: () => void;
    disabled?: boolean;
    wide?: boolean;
    danger?: boolean;
  }> = [
    { key: 'revert', label: 'Revert to Draft', onPress: onRevert, disabled: isDraft, wide: true },
    { key: 'copy', label: 'Copy Session To', onPress: onCopy },
    { key: 'template', label: 'Save as Template', onPress: onSaveTemplate },
    { key: 'move', label: 'Move Session', onPress: onMove },
    { key: 'delete', label: 'Delete', onPress: onDelete, danger: true },
  ];

  return (
    <View style={styles.sessionActions}>
      {actions.map((action) => {
        const busy = pendingAction === action.key;
        const disabled = !!pendingAction || !!action.disabled;
        return (
        <Pressable
          key={action.key}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.sessionActionButton,
            action.wide && styles.sessionActionWide,
            disabled && styles.sessionActionDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.sessionActionText, action.danger && styles.sessionActionDanger]}>
            {busy ? 'Working...' : action.label}
          </Text>
        </Pressable>
        );
      })}
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

function LoadStyleInfoModal({
  styleType,
  onClose,
}: {
  styleType: LoadStyleInfo | null;
  onClose: () => void;
}) {
  const content = loadStyleInfoContent(styleType);

  return (
    <Modal visible={!!styleType} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.infoModal}>
          <View style={styles.infoModalHeader}>
            <Text style={styles.infoModalTitle}>{content.title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close explanation"
              onPress={onClose}
              style={({ pressed }) => [styles.calendarClose, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>
          <Text style={styles.infoModalBody}>{content.body}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.infoModalAction, pressed && styles.pressed]}
          >
            <Text style={styles.infoModalActionText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function loadStyleInfoContent(styleType: LoadStyleInfo | null) {
  if (styleType === 'pct') {
    return {
      title: 'Percent 1RM',
      body: 'Percent 1RM uses a percentage of your training max or one-rep max to prescribe load. Strength Ledger calculates the target weight from the percentage and your saved max.',
    };
  }
  if (styleType === 'rir') {
    return {
      title: 'RIR',
      body: 'RIR means Reps In Reserve. It describes how many reps you should have left before failure at the end of the set.',
    };
  }
  return {
    title: 'RPE',
    body: 'RPE means Rate of Perceived Exertion. In Strength Ledger, it describes how hard the set should feel based on reps in reserve. For example, RPE 7 usually means about 3 reps left in the tank.',
  };
}

function DisabledAction({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <Pressable disabled accessibilityState={{ disabled: true }} style={[styles.disabledButton, compact && styles.disabledButtonCompact]}>
      <Text style={styles.disabledButtonText}>{label}</Text>
    </Pressable>
  );
}

function DisabledIconAction({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable disabled accessibilityState={{ disabled: true }} style={styles.disabledIconButton}>
      <Ionicons name={icon} size={16} color={colors.subtle} />
    </Pressable>
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

function sessionContext(label?: string | null, dateValue?: string | null) {
  const week = weekFromLabel(label);
  const date = formatContextDate(dateValue);
  if (week && date) return `${week} • ${date}`;
  return week || date || 'Unscheduled';
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

function executionLabel(value?: string | null) {
  const status = String(value || '').toLowerCase();
  if (status === 'in_progress') return 'Continue Workout';
  if (status === 'completed' || status === 'logged' || status === 'done') return 'View Summary';
  return 'Start Workout';
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
  const cells: Array<Date | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function movementPresetName(value?: MovementPreset | string | null) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value.display_name || value.name || '').trim();
}

function movementPresetId(value?: MovementPreset | string | null) {
  if (!value || typeof value === 'string' || !value.id) return null;
  return Number(value.id);
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

function trainingLiftSetupFromItem(item: WorkoutItem, groups: MovementPresetGroup[]): TrainingLiftSetup {
  const movement = item.movement || item.original_movement || liftName(item.lift) || '';
  const found = findTrainingPreset(groups, movement);
  const lift = String(found?.preset.lift || item.lift || 'VR').toUpperCase();
  const variant = String(item.variant || 'STRAIGHT').toUpperCase();
  const scheme: TrainingLiftScheme = variant === 'TOP' || variant === 'BK'
    ? 'TOP_BACKDOWN'
    : variant === 'FULL_CUSTOM'
      ? 'FULL_CUSTOM'
      : 'STRAIGHT';
  return {
    movement,
    family: found?.group.key || (['SQ', 'BN', 'DL'].includes(lift) ? 'competition_lifts' : 'squat_variants'),
    lift,
    designation: String(item.designation || '').toUpperCase(),
    scheme,
    mode: String(item.mode || 'RPE').toUpperCase() === 'PCT' ? 'PCT' : 'RPE',
    notes: String(item.notes || ''),
    customMovement: '',
  };
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
  };
}

function findAccessoryPreset(groups: MovementPresetGroup[], movementName: string) {
  const wanted = String(movementName || '').trim().toLowerCase();
  if (!wanted) return null;
  for (const group of groups) {
    for (const movement of group.movements || []) {
      const name = movementPresetName(movement);
      if (name.trim().toLowerCase() === wanted) {
        return { group, name, preset: movement };
      }
    }
  }
  return null;
}

function accessorySetupFromItem(item: WorkoutItem, groups: MovementPresetGroup[]): AccessorySetup {
  const movement = item.movement || item.original_movement || 'Chest-Supported Row';
  const found = findAccessoryPreset(groups, movement);
  return {
    movement,
    movementDefinitionId: item.movement_identity?.id || movementPresetId(found?.preset || null),
    family: found?.group.key || groups[0]?.key || 'lats_upper_back',
    notes: String(item.notes || ''),
    customMovement: '',
  };
}

function defaultAccessorySetup(groups: MovementPresetGroup[]): AccessorySetup {
  const fallback = 'Chest-Supported Row';
  const found = findAccessoryPreset(groups, fallback);
  const firstGroup = groups[0] || null;
  const firstMovement = movementPresetName(firstGroup?.movements?.[0] || null);
  return {
    movement: found?.name || firstMovement || fallback,
    movementDefinitionId: movementPresetId(found?.preset || firstGroup?.movements?.[0] || null),
    family: found?.group.key || firstGroup?.key || 'lats_upper_back',
    notes: '',
    customMovement: '',
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

function plannedSetText(set: PlannedSet) {
  const reps = set.reps != null ? `${set.reps} reps` : 'reps open';
  const target = set.rpe_target != null
    ? `@ ${formatNumber(set.rpe_target)} RPE`
    : set.pct != null
      ? `@ ${formatNumber(displayPct(set.pct))}%`
      : '';
  const load = rangeText(set.manual_target_kg, null) || rangeText(set.suggested_low_kg, set.suggested_high_kg);
  return [reps, target, load].filter(Boolean).join(' · ');
}

function targetText(item: WorkoutItem) {
  return rangeText(item.target_low_kg, item.target_high_kg) || rangeText(item.baseline_low_kg, item.baseline_high_kg);
}

function loadEditorInfo(item: WorkoutItem) {
  const lowLb = kgToDisplayLb(item.target_low_kg ?? item.baseline_low_kg);
  const highLb = kgToDisplayLb(item.target_high_kg ?? item.baseline_high_kg);
  const hasLow = lowLb != null && lowLb > 0;
  const hasHigh = highLb != null && highLb > 0;
  const low = hasLow ? lowLb : hasHigh ? highLb : null;
  const high = hasHigh ? highLb : hasLow ? lowLb : null;
  const target = low != null && high != null ? roundPlatformLbs((low + high) / 2) : null;
  const range = low != null && high != null ? Math.abs(high - low) / 2 : 0;
  return {
    suggestedLabel: low != null && high != null ? `${cleanNumber(low)}-${cleanNumber(high)} lb` : '',
    calculatedLabel: target != null ? `Calculated ${cleanNumber(target)} lb` : '',
    suggestedTargetDisplay: target != null ? cleanNumber(target) : '',
    suggestedRangeDisplay: target != null ? cleanNumber(range) : '',
    targetDisplay: target != null ? cleanNumber(target) : '',
    rangeDisplay: target != null ? cleanNumber(range) : '',
  };
}

function kgToDisplayLb(kg?: number | null) {
  if (kg == null || !Number.isFinite(Number(kg))) return null;
  return roundPlatformLbs(Number(kg) / KG_PER_LB);
}

function parseDisplayNumber(value: string) {
  const parsed = Number(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function notationOptionsFor(kind: HotEditField) {
  if (kind === 'sets') return Array.from({ length: 10 }, (_, index) => String(index + 1));
  if (kind === 'accessory_reps') return Array.from({ length: 30 }, (_, index) => String(index + 1));
  if (kind === 'reps') return Array.from({ length: 12 }, (_, index) => String(index + 1));
  if (kind === 'rir') return Array.from({ length: 6 }, (_, index) => String(index));
  if (kind === 'rpe') return Array.from({ length: 13 }, (_, index) => String(4 + index * 0.5).replace(/\.0$/, ''));
  if (kind === 'pct') return Array.from({ length: 21 }, (_, index) => String(50 + index * 2.5).replace(/\.0$/, ''));
  return [];
}

function parseAccessoryRepTarget(value?: string | null): {
  type: AccessoryRepType;
  value?: number;
  low?: number;
  high?: number;
} {
  const raw = String(value || '').trim();
  if (/^amrap$/i.test(raw)) return { type: 'amrap' };
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const low = clampRepValue(Number(range[1]) || 10);
    const high = clampRepValue(Number(range[2]) || low);
    return { type: 'range', low: Math.min(low, high), high: Math.max(low, high) };
  }
  const plus = raw.match(/^(\d+)\s*\+$/);
  if (plus) return { type: 'plus', value: clampRepValue(Number(plus[1]) || 10) };
  const fixed = raw.match(/^(\d+)$/);
  if (fixed) return { type: 'fixed', value: clampRepValue(Number(fixed[1]) || 10) };
  return { type: 'fixed', value: 10 };
}

function clampRepValue(value: number) {
  return Math.max(1, Math.min(30, Math.round(value)));
}

function rangeText(lowKg?: number | null, highKg?: number | null) {
  if (lowKg == null && highKg == null) return '';
  if (lowKg != null && highKg != null) {
    if (Math.abs(Number(lowKg) - Number(highKg)) < 0.01) return `${formatWeight(lowKg)} lb`;
    return `${formatWeight(lowKg)}-${formatWeight(highKg)} lb`;
  }
  const single = lowKg ?? highKg;
  return single != null ? `${formatWeight(single)} lb` : '';
}

function formatWeight(kg: number | null | undefined) {
  if (kg == null || !Number.isFinite(Number(kg))) return '?';
  const pounds = Number(kg) / KG_PER_LB;
  return cleanNumber(roundPlatformLbs(pounds));
}

function roundPlatformLbs(value: number) {
  const step = value < LBS_INCREMENT_THRESHOLD
    ? LBS_INCREMENT_BELOW_THRESHOLD
    : LBS_INCREMENT_AT_OR_ABOVE_THRESHOLD;
  return Math.floor((value / step) + 0.5) * step;
}

function cleanNumber(value: number) {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function displayPct(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  const numeric = Number(value);
  return numeric <= 1 ? numeric * 100 : numeric;
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
    fontSize: 18,
    fontFamily: SLFontFamilies.sansBold,
  },
  stateBody: {
    color: colors.muted,
    textAlign: 'center',
    fontFamily: SLFontFamilies.sansMedium,
  },
  workspaceHeader: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.20)',
    backgroundColor: 'rgba(30, 24, 38, 0.48)',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    shadowColor: colors.violet,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sessionName: {
    color: colors.textStrong,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: SLFontFamilies.sansBold,
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
    borderRadius: 14,
    color: colors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 24,
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
    borderRadius: 12,
    backgroundColor: 'rgba(10, 8, 12, 0.24)',
    paddingHorizontal: 12,
  },
  sessionRenameSecondaryText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionRenamePrimary: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.24)',
    borderRadius: 12,
    backgroundColor: 'rgba(167, 203, 181, 0.12)',
    paddingHorizontal: 14,
  },
  sessionRenamePrimaryText: {
    color: colors.green,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansBold,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansBold,
    overflow: 'hidden',
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  headerStartButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.32)',
    borderRadius: 14,
    backgroundColor: 'rgba(167, 203, 181, 0.14)',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  headerStartText: {
    color: colors.green,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansBold,
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.18)',
    borderRadius: 14,
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
    borderRadius: 14,
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexShrink: 0,
  },
  headerReorderText: {
    color: colors.violet,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionMeta: {
    color: colors.muted,
    fontSize: 17,
    fontFamily: SLFontFamilies.sansMedium,
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
    fontSize: 28,
    lineHeight: 34,
    fontFamily: SLFontFamilies.sansBold,
  },
  sectionCountPill: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: 'rgba(167, 139, 250, 0.09)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontFamily: SLFontFamilies.sansBold,
    overflow: 'hidden',
  },
  sectionActionButton: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  sectionActionText: {
    color: colors.textStrong,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansBold,
  },
  liftCard: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(20, 18, 22, 0.44)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 15,
    gap: 14,
  },
  liftCardAccessory: {
    backgroundColor: 'rgba(18, 20, 20, 0.40)',
  },
  liftAccentRail: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 999,
    backgroundColor: colors.violet,
    opacity: 0.90,
  },
  liftAccentRailAccessory: {
    backgroundColor: colors.green,
    opacity: 0.72,
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
    borderRadius: 13,
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
    fontSize: 22,
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
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
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
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  inlineEditText: {
    color: colors.muted,
    fontSize: 13,
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
    fontSize: 16,
    fontFamily: SLFontFamilies.sansBold,
  },
  prescriptionText: {
    color: colors.textStrong,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.18)',
    backgroundColor: 'rgba(12, 12, 18, 0.40)',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 18,
    fontFamily: SLFontFamilies.sansBold,
    overflow: 'hidden',
  },
  prescriptionTokenText: {
    color: colors.textStrong,
    fontSize: 17,
    fontFamily: SLFontFamilies.sansBold,
  },
  loadStyleInfoButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.18)',
    borderRadius: 999,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  targetText: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(10, 8, 12, 0.32)',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
    fontFamily: SLFontFamilies.sansMedium,
    overflow: 'hidden',
  },
  plannedSetList: {
    gap: 5,
    paddingTop: 2,
  },
  inlineEditor: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
    backgroundColor: 'rgba(22, 18, 28, 0.58)',
    borderRadius: 17,
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
    borderRadius: 14,
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
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
  },
  repTypeDotActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  repTypeText: {
    color: colors.muted,
    fontSize: 15,
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
    borderRadius: 16,
  },
  amrapSelectedText: {
    color: colors.textStrong,
    fontSize: 22,
    fontFamily: SLFontFamilies.sansBold,
  },
  wheelFrame: {
    position: 'relative',
    minHeight: 78,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
    borderRadius: 16,
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
    borderRadius: 14,
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
    fontSize: 18,
    fontFamily: SLFontFamilies.sansBold,
  },
  wheelItemTextSelected: {
    color: colors.textStrong,
    fontSize: 24,
  },
  webEditorMeta: {
    gap: 5,
  },
  webEditorMetaLabel: {
    color: colors.subtle,
    fontSize: 11,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  webEditorMetaValue: {
    color: colors.textStrong,
    fontSize: 16,
    fontFamily: SLFontFamilies.sansBold,
  },
  webEditorMetaHint: {
    color: colors.muted,
    fontSize: 13,
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
    fontSize: 12,
    fontFamily: SLFontFamilies.sansBold,
  },
  webLoadStepButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
  },
  webLoadStepText: {
    color: '#C4B5FD',
    fontSize: 20,
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
    borderRadius: 13,
    paddingHorizontal: 10,
  },
  webLoadPrefix: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: SLFontFamilies.sansBold,
    marginRight: 4,
  },
  webLoadInput: {
    flex: 1,
    color: colors.textStrong,
    fontSize: 15,
    fontFamily: SLFontFamilies.sansBold,
    paddingVertical: 7,
  },
  webLoadUnit: {
    color: colors.muted,
    fontSize: 12,
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
    borderRadius: 13,
    backgroundColor: 'rgba(10, 8, 12, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  webLoadActionText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansBold,
  },
  editorFieldFull: {
    gap: 6,
  },
  editorLabel: {
    color: colors.subtle,
    fontSize: 11,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  editorInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
    borderRadius: 13,
    color: colors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
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
    borderRadius: 13,
    backgroundColor: 'rgba(10, 8, 12, 0.22)',
    paddingHorizontal: 14,
  },
  editorSecondaryText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: SLFontFamilies.sansBold,
  },
  editorPrimary: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.24)',
    backgroundColor: 'rgba(167, 203, 181, 0.12)',
    borderRadius: 13,
    paddingHorizontal: 16,
  },
  editorPrimaryText: {
    color: colors.green,
    fontSize: 14,
    fontFamily: SLFontFamilies.sansBold,
  },
  editorDisabled: {
    opacity: 0.58,
  },
  plannedSetText: {
    color: colors.muted,
    fontSize: 14,
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
    fontSize: 13,
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
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  reorderHandle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    borderRadius: 12,
  },
  reorderRowTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  reorderRowTitle: {
    color: colors.textStrong,
    fontSize: 17,
    fontFamily: SLFontFamilies.sansBold,
  },
  reorderRowMeta: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansMedium,
  },
  emptySection: {
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(20, 18, 22, 0.34)',
    borderRadius: 16,
    padding: 14,
  },
  emptySectionText: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: SLFontFamilies.sansMedium,
  },
  disabledButton: {
    opacity: 0.55,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(10, 8, 12, 0.30)',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  disabledButtonCompact: {
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  disabledButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: SLFontFamilies.sansBold,
  },
  disabledIconButton: {
    opacity: 0.55,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    borderRadius: 11,
    backgroundColor: 'rgba(10, 8, 12, 0.30)',
  },
  sessionActions: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    backgroundColor: 'rgba(20, 18, 22, 0.44)',
    borderRadius: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  sessionActionButton: {
    width: '50%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.08)',
    backgroundColor: 'rgba(10, 8, 12, 0.24)',
  },
  sessionActionWide: {
    width: '100%',
  },
  sessionActionDisabled: {
    opacity: 0.48,
  },
  sessionActionText: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: SLFontFamilies.sansBold,
  },
  sessionActionDanger: {
    color: '#F0A4A4',
  },
  trainingLiftEditorScreen: {
    flex: 1,
    backgroundColor: '#0B080D',
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
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0B080D',
    shadowColor: '#000',
    shadowOpacity: 0.44,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
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
    fontSize: 12,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftEditorTitle: {
    color: colors.textStrong,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftCancelButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.14)',
    backgroundColor: 'rgba(10, 8, 12, 0.34)',
    borderRadius: 13,
    paddingHorizontal: 14,
  },
  trainingLiftCancelText: {
    color: colors.muted,
    fontSize: 14,
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
    borderRadius: 18,
    padding: 14,
  },
  trainingLiftSectionTitle: {
    color: colors.textStrong,
    fontSize: 20,
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
    fontSize: 14,
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
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  trainingLiftFamilyButtonActive: {
    borderColor: 'rgba(167, 139, 250, 0.54)',
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
  },
  trainingLiftFamilyText: {
    color: colors.muted,
    fontSize: 13,
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
    borderRadius: 15,
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
    fontSize: 16,
    lineHeight: 21,
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftOptionTitleSelected: {
    color: '#C4B5FD',
  },
  trainingLiftOptionDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: SLFontFamilies.sansMedium,
  },
  trainingLiftCustomBlock: {
    gap: 8,
    paddingTop: 2,
  },
  trainingLiftFieldLabel: {
    color: colors.subtle,
    fontSize: 11,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  trainingLiftInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.12)',
    backgroundColor: 'rgba(8, 8, 12, 0.34)',
    borderRadius: 13,
    color: colors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
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
    borderRadius: 13,
    paddingHorizontal: 13,
  },
  trainingLiftSecondaryText: {
    color: colors.muted,
    fontSize: 14,
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
    borderRadius: 15,
  },
  trainingLiftActionSecondaryText: {
    color: colors.muted,
    fontSize: 15,
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
    borderRadius: 15,
  },
  trainingLiftActionPrimaryText: {
    color: colors.green,
    fontSize: 15,
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
    backgroundColor: '#100C11',
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  infoModal: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: '#100C11',
    borderRadius: 22,
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
    fontSize: 24,
    lineHeight: 30,
    fontFamily: SLFontFamilies.sansBold,
  },
  infoModalBody: {
    color: colors.muted,
    fontSize: 16,
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
    borderRadius: 14,
  },
  infoModalActionText: {
    color: colors.green,
    fontSize: 15,
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
    fontSize: 12,
    textTransform: 'uppercase',
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarTitle: {
    color: colors.textStrong,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarClose: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 12,
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
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 8, 8, 0.18)',
  },
  calendarMonthLabel: {
    color: colors.textStrong,
    fontSize: 18,
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
    fontSize: 12,
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
    borderRadius: 12,
  },
  calendarDaySelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.54)',
  },
  calendarDayText: {
    color: colors.muted,
    fontSize: 16,
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
    fontSize: 15,
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarSecondaryText: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: SLFontFamilies.sansBold,
  },
  calendarPrimary: {
    flex: 1.4,
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'rgba(167, 203, 181, 0.26)',
    backgroundColor: 'rgba(167, 203, 181, 0.13)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarPrimaryText: {
    color: colors.green,
    fontSize: 15,
    fontFamily: SLFontFamilies.sansBold,
  },
  pressed: {
    opacity: 0.72,
  },
});
