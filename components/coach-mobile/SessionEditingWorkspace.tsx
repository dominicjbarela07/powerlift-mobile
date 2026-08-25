import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SLButton } from '@/components/ui/sl-button';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { SLProfileAvatar } from '@/components/ui/sl-profile-avatar';
import { Text, TextInput } from '@/components/ui/sl-text';
import { MovementCardMaterial } from '@/components/workout-logger/movement-card-material';
import { LoggerWheelPicker } from '@/components/workout-logger/logger-wheel-picker';
import { useFloatingNavigationMotion } from '@/components/navigation/floating-navigation-motion';
import { SL_TAB_ROW_CONTROL, SL_TAB_ROW_FALLBACK_SHEEN, SL_TAB_ROW_SELECTED_LENS } from '@/components/navigation/sl-tab-row-control';
import {
  SLColors,
  SLControlSize,
  SLFontFamilies,
  SLIconSize,
  SLLayout,
  SLRadius,
  SLShadows,
  SLSpacing,
  SLTypography,
} from '@/constants/theme';
import {
  type CoachDisplayUnit,
  type CoachMovementDraft,
  convertLoadDisplayValue,
  isCoreVariantDraft,
  manualTargetMarginFromStoredRange,
  movementDraftFromItem,
  movementDraftIsDirty,
  movementProgrammingPatch,
  storedRangeFromManualTarget,
} from '@/lib/coach-session-editor';
import { accessoryMuscleRegion } from '@/lib/accessory-muscle-group';
import { exactAccessoryHistoryRows } from '@/lib/exact-accessory-history';
import { resolveLoggerLiftIdentity } from '@/lib/logger-visual-context';
import { formatLoggerWeightRangeKg, roundLoggerDisplayWeight } from '@/lib/logger-weight-format';
import { setSessionEditorOverlayOpen } from '@/lib/session-editor-overlay-state';
import { programmedSetCountForDraft } from '@/lib/session-programmed-set-count';
import {
  accessoryRepDisplayText,
  accessoryRepRangeAfterLowerChange,
  accessoryRepRangeAfterUpperChange,
  accessoryRepTargetFromText,
  accessoryRepTargetMemoryFromTarget,
  accessoryRepTargetText,
  decimalWheelOptions,
  integerWheelOptions,
  loadWheelOptions,
  marginWheelOptions,
  transitionAccessoryRepTarget,
  type AccessoryRepTarget,
  type AccessoryRepTargetMemory,
  type AccessoryRepTargetMode,
} from '@/lib/prescription-wheel-options';

export type SessionWorkspaceSection = 'core' | 'accessories';
export type MovementKind = 'core' | 'accessory';

export type MovementHistorySet = {
  weight_kg?: number | null;
  reps?: number | null;
  rir?: number | null;
  rpe?: number | null;
  date?: string | null;
};

export type SessionMovementItem = {
  id: number;
  lift?: string | null;
  variant?: string | null;
  designation?: string | null;
  movement?: string | null;
  original_movement?: string | null;
  sets?: number | null;
  reps?: number | null;
  reps_text?: string | null;
  mode?: string | null;
  rpe_target?: number | null;
  pct?: number | null;
  rir_target?: number | null;
  coach_prescribed_low_kg?: number | null;
  coach_prescribed_high_kg?: number | null;
  parent_item_id?: number | null;
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
  planned_sets?: Record<string, unknown>[];
  movement_identity?: {
    id?: number | null;
    display_name?: string | null;
    primary_muscle_group?: string | null;
    secondary_muscle_groups?: string[] | null;
    execution_family?: string | null;
    ownership_scope?: string | null;
    library_scope?: string | null;
    equipment_type?: string | null;
    loading_implementation?: string | null;
    manufacturer?: { display_name?: string | null } | null;
    equipment_model?: { display_name?: string | null } | null;
  } | null;
  performed_movement_identity?: SessionMovementItem['movement_identity'];
  performed_canonical_movement_identity?: SessionMovementItem['movement_identity'];
  legacy?: {
    state?: string | null;
    original_text?: string | null;
    normalized_key?: string | null;
    resolution_id?: number | null;
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: SessionMovementItem['movement_identity'];
    indicator?: string | null;
    history_caveat?: string | null;
    mapping?: { id?: number | null; revision?: number | null; status?: string | null } | null;
  } | null;
  core_movement?: {
    display_name?: string | null;
    loading_implementation?: string | null;
  } | null;
  movement_history?: {
    identity_scope?: string | null;
    comparison_allowed?: boolean | null;
    comparison_identity_key?: string | null;
    recent_sets?: MovementHistorySet[];
    recent_sessions?: MovementHistorySet[];
    most_recent_logged_set?: MovementHistorySet | null;
  } | null;
};

export type CalculatedLoadResult = {
  lowKg: number | null;
  highKg: number | null;
  trainingMaxKg: number | null;
  note?: string | null;
};

export type CalculatedLoadRequest = {
  lift: string;
  mode: 'RPE' | 'PCT';
  reps: string;
  intensity: string;
};

export type SessionWorkspaceAthleteOption = {
  id: number;
  name: string;
  avatarUrl?: string | null;
  avatarVersion?: string | null;
};

type WorkspaceCapabilities = {
  can_rename?: boolean;
  can_edit_session_notes?: boolean;
  can_add_movement?: boolean;
  can_reorder?: boolean;
  can_remove_movement?: boolean;
  can_edit_movement?: boolean;
  can_open_athlete_view?: boolean;
};

type GuardAction = (action: () => void) => void;

export type SessionWorkspaceMovementSave = {
  item: SessionMovementItem;
  kind: MovementKind;
  patch: Record<string, unknown>;
};

export type SessionWorkspaceSavePlan = {
  title: string;
  athleteId: number | null;
  scheduledDate: string;
  displayUnit: CoachDisplayUnit;
  notes: string;
  metadataPatch: {
    title?: string;
    athleteId?: number | null;
    scheduledDate?: string;
    displayUnit?: CoachDisplayUnit;
    notes?: string;
  };
  movementUpdates: SessionWorkspaceMovementSave[];
  movementCreates: SessionWorkspaceMovementSave[];
  deletedMovementIds: number[];
  coreOrder: number[];
  accessoryOrder: number[];
  orderChanged: boolean;
};

type SessionWorkspaceDraft = {
  title: string;
  athleteId: number | null;
  scheduledDate: string;
  displayUnit: CoachDisplayUnit;
  notes: string;
  items: Record<number, SessionMovementItem>;
  kinds: Record<number, MovementKind>;
  movements: Record<number, CoachMovementDraft>;
  coreOrder: number[];
  accessoryOrder: number[];
};

type Props = {
  title: string;
  context: string;
  status: string;
  athleteName?: string | null;
  athleteId?: number | null;
  athleteAvatarUrl?: string | null;
  athleteAvatarVersion?: string | null;
  scheduledDate?: string | null;
  coachName?: string | null;
  coachAvatarUrl?: string | null;
  coachAvatarVersion?: string | null;
  estimatedDurationMinutes?: number | null;
  estimatedDurationLowMinutes?: number | null;
  estimatedDurationHighMinutes?: number | null;
  notes: string;
  lockedReason?: string | null;
  editable: boolean;
  capabilities: WorkspaceCapabilities;
  coreItems: SessionMovementItem[];
  accessoryItems: SessionMovementItem[];
  refreshing: boolean;
  pendingMovementId?: number | null;
  reduceMotion: boolean;
  displayUnit: CoachDisplayUnit;
  athleteOptions?: SessionWorkspaceAthleteOption[];
  assignmentBlockedReason?: string | null;
  sheetPresentation?: boolean;
  registerDismissRequest?: (handler: (() => void) | null) => void;
  onRefresh: () => void;
  onCloseWorkspace: () => void;
  onOpenAthleteView: () => void;
  onOpenReorder: (order: { coreIds: number[]; accessoryIds: number[] }, onApply: (order: { coreIds: number[]; accessoryIds: number[] }) => void) => void;
  onAddCore: (displayUnit: CoachDisplayUnit, onAdd: (item: SessionMovementItem) => void) => void;
  onAddAccessory: (onAdd: (item: SessionMovementItem) => void) => void;
  onChangeAccessory: (item: SessionMovementItem, onChange: (item: SessionMovementItem) => void) => void;
  onOpenMovementHistory?: (item: SessionMovementItem) => void;
  onCalculateLoad: (request: CalculatedLoadRequest) => Promise<CalculatedLoadResult>;
  onSaveSession: (plan: SessionWorkspaceSavePlan) => Promise<boolean>;
  renderLifecycleActions: (guard: GuardAction, restricted: boolean) => React.ReactNode;
};

const GUTTER = SLSpacing.md;
const KG_PER_LB = 0.45359237;

const palette = {
  canvas: SLColors.canvas,
  object: SLColors.object,
  objectRaised: SLColors.objectRaised,
  line: SLColors.borderSubtle,
  lineStrong: SLColors.borderStandard,
  text: SLColors.textStrong,
  muted: SLColors.textMuted,
  subtle: SLColors.textSubtle,
  violet: SLColors.accentViolet,
  violetSoft: SLColors.accentSoft,
  red: SLColors.danger,
};

export function SessionEditingWorkspace(props: Props) {
  const {
    title,
    context,
    status,
    athleteName,
    athleteId,
    athleteAvatarUrl,
    athleteAvatarVersion,
    scheduledDate,
    estimatedDurationMinutes,
    estimatedDurationLowMinutes,
    estimatedDurationHighMinutes,
    notes,
    lockedReason,
    editable,
    capabilities,
    coreItems,
    accessoryItems,
    refreshing,
    pendingMovementId,
    reduceMotion,
    displayUnit,
    athleteOptions = [],
    assignmentBlockedReason,
    onCalculateLoad,
  } = props;
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, fontScale } = useWindowDimensions();
  const useAccessibilityReflow = viewportWidth < 360 || fontScale >= 1.3;
  const incomingSession = useMemo(
    () => createSessionWorkspaceDraft({ title, athleteId, scheduledDate, displayUnit, notes, coreItems, accessoryItems }),
    [accessoryItems, athleteId, coreItems, displayUnit, notes, scheduledDate, title],
  );
  const incomingSessionSignature = useMemo(() => sessionWorkspaceSignature(incomingSession), [incomingSession]);
  const [persistedSession, setPersistedSession] = useState<SessionWorkspaceDraft>(() => cloneSessionWorkspaceDraft(incomingSession));
  const [sessionDraft, setSessionDraft] = useState<SessionWorkspaceDraft>(() => cloneSessionWorkspaceDraft(incomingSession));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [manualOverrideEnabled, setManualOverrideEnabled] = useState(false);
  const [backdownManualOverrideEnabled, setBackdownManualOverrideEnabled] = useState(false);
  const [calculatedTarget, setCalculatedTarget] = useState<CalculatedLoadResult | null>(null);
  const [backdownCalculatedTarget, setBackdownCalculatedTarget] = useState<CalculatedLoadResult | null>(null);
  const [calculatingTarget, setCalculatingTarget] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(title);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [toolkitExpanded, setToolkitExpanded] = useState(false);
  const [calculatedRows, setCalculatedRows] = useState<Record<number, CalculatedLoadResult>>({});
  const listScrollRef = useRef<ScrollView>(null);
  const calculationRevisionRef = useRef(0);
  const acceptIncomingSessionRef = useRef(false);

  const sessionDirty = sessionWorkspaceDraftIsDirty(sessionDraft, persistedSession);
  const currentCoreItems = useMemo(
    () => sessionDraft.coreOrder.map((id) => sessionDraft.items[id]).filter(Boolean),
    [sessionDraft.coreOrder, sessionDraft.items],
  );
  const currentAccessoryItems = useMemo(
    () => sessionDraft.accessoryOrder.map((id) => sessionDraft.items[id]).filter(Boolean),
    [sessionDraft.accessoryOrder, sessionDraft.items],
  );
  const allItems = useMemo(
    () => [...currentCoreItems, ...currentAccessoryItems],
    [currentAccessoryItems, currentCoreItems],
  );
  const selectedItem = selectedId == null ? null : sessionDraft.items[selectedId] || null;
  const draft = selectedId == null ? null : sessionDraft.movements[selectedId] || null;
  const selectedKind: MovementKind = selectedId == null ? 'core' : sessionDraft.kinds[selectedId] || 'core';
  const totalProgrammedSets = useMemo(() => {
    return [...sessionDraft.coreOrder, ...sessionDraft.accessoryOrder].reduce((total, id) => {
      const movement = sessionDraft.movements[id];
      return total + (movement ? programmedSetCountForDraft(movement, sessionDraft.kinds[id]) : 0);
    }, 0);
  }, [sessionDraft]);
  const saveLabel = status.trim().toLowerCase() === 'draft' ? 'Save Draft' : 'Save Changes';
  const durationLabel = authoritativeDurationLabel(
    estimatedDurationMinutes,
    estimatedDurationLowMinutes,
    estimatedDurationHighMinutes,
  );
  const draftAthlete = athleteOptions.find((option) => option.id === sessionDraft.athleteId) || null;
  const canChangeAthlete = editable
    && ['draft', 'planned'].includes(status.trim().toLowerCase())
    && allItems.length === 0
    && athleteOptions.length > 0;

  useEffect(() => {
    if (sessionDirty && !acceptIncomingSessionRef.current) return;
    const next = cloneSessionWorkspaceDraft(incomingSession);
    setPersistedSession(next);
    setSessionDraft(cloneSessionWorkspaceDraft(next));
    acceptIncomingSessionRef.current = false;
  }, [incomingSession, incomingSessionSignature, sessionDirty]);
  useLayoutEffect(() => {
    setSessionEditorOverlayOpen(sessionDirty);
    return () => setSessionEditorOverlayOpen(false);
  }, [sessionDirty]);
  useEffect(() => {
    let active = true;
    const requests = currentCoreItems
      .filter((item) => !isCoreVariantItem(item) && item.coach_prescribed_low_kg == null && item.coach_prescribed_high_kg == null)
      .map((item) => ({ item, request: calculatedLoadRequest(item) }))
      .filter((entry): entry is { item: SessionMovementItem; request: CalculatedLoadRequest } => !!entry.request);
    if (!requests.length) {
      setCalculatedRows({});
      return () => { active = false; };
    }
    void Promise.all(requests.map(async ({ item, request }) => [item.id, await onCalculateLoad(request)] as const))
      .then((rows) => {
        if (active) setCalculatedRows(Object.fromEntries(rows));
      })
      .catch(() => {
        if (active) setCalculatedRows({});
      });
    return () => { active = false; };
  }, [currentCoreItems, onCalculateLoad]);

  useEffect(() => {
    if (!selectedItem || !draft || selectedKind !== 'core' || isCoreVariantDraft(draft)) {
      setCalculatedTarget(null);
      setBackdownCalculatedTarget(null);
      setCalculatingTarget(false);
      return;
    }
    const revision = ++calculationRevisionRef.current;
    const firstPlanned = draft.plannedSets[0];
    const mainRequest: CalculatedLoadRequest = {
      lift: String(selectedItem.lift || ''),
      mode: draft.mode,
      reps: draft.scheme === 'FULL_CUSTOM' ? String(firstPlanned?.reps || '') : draft.reps,
      intensity: draft.scheme === 'FULL_CUSTOM'
        ? String(draft.mode === 'PCT' ? firstPlanned?.pct || '' : firstPlanned?.rpe || '')
        : String(draft.mode === 'PCT' ? draft.pct : draft.rpe),
    };
    const backdownRequest: CalculatedLoadRequest | null = draft.scheme === 'TOP_BACKDOWN' && draft.sourceVariant !== 'BK'
      ? {
          lift: String(selectedItem.lift || ''),
          mode: draft.mode,
          reps: draft.backdownReps,
          intensity: draft.mode === 'PCT' ? draft.backdownPct : draft.backdownRpe,
        }
      : null;
    setCalculatingTarget(true);
    const timer = setTimeout(() => {
      void Promise.all([
        onCalculateLoad(mainRequest),
        backdownRequest ? onCalculateLoad(backdownRequest) : Promise.resolve(null),
      ]).then(([main, backdown]) => {
        if (revision !== calculationRevisionRef.current) return;
        setCalculatedTarget(main);
        setBackdownCalculatedTarget(backdown);
      }).catch(() => {
        if (revision !== calculationRevisionRef.current) return;
        setCalculatedTarget({ lowKg: null, highKg: null, trainingMaxKg: null, note: 'Calculated target unavailable' });
        setBackdownCalculatedTarget(null);
      }).finally(() => {
        if (revision === calculationRevisionRef.current) setCalculatingTarget(false);
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [draft, onCalculateLoad, selectedItem, selectedKind]);

  const updateDraft = useCallback((patch: Partial<CoachMovementDraft>) => {
    if (selectedId == null) return;
    setSessionDraft((current) => ({
      ...current,
      movements: {
        ...current.movements,
        [selectedId]: { ...current.movements[selectedId], ...patch },
      },
    }));
  }, [selectedId]);

  const changeEditorDisplayUnit = useCallback((unit: CoachDisplayUnit) => {
    if (unit === sessionDraft.displayUnit || savingSession) return;
    setSessionDraft((current) => ({
      ...current,
      displayUnit: unit,
      movements: Object.fromEntries(Object.entries(current.movements).map(([id, movement]) => [
        id,
        convertMovementDraftUnit(movement, current.displayUnit, unit),
      ])),
    }));
  }, [savingSession, sessionDraft.displayUnit]);

  const discardWorkspaceChanges = useCallback(() => {
    setSessionDraft(cloneSessionWorkspaceDraft(persistedSession));
    setRenaming(false);
    setEditingNotes(false);
    setEditingAthlete(false);
    setEditingDate(false);
  }, [persistedSession]);

  const saveWorkspaceChanges = useCallback(async () => {
    if (!sessionDirty || savingSession) return !sessionDirty;
    if (!sessionDraft.title.trim()) {
      Alert.alert('Session title required', 'Enter a Session title before saving.');
      return false;
    }
    setSavingSession(true);
    acceptIncomingSessionRef.current = true;
    try {
      const success = await props.onSaveSession(buildSessionWorkspaceSavePlan(sessionDraft, persistedSession));
      if (!success) {
        acceptIncomingSessionRef.current = false;
        return false;
      }
      setPersistedSession(cloneSessionWorkspaceDraft(sessionDraft));
      return true;
    } catch {
      acceptIncomingSessionRef.current = false;
      Alert.alert('Could not save Session', 'Your Session edits are still available.');
      return false;
    } finally {
      setSavingSession(false);
    }
  }, [persistedSession, props, savingSession, sessionDirty, sessionDraft]);

  const resolveDirty = useCallback((action: () => void) => {
    if (!sessionDirty) {
      action();
      return;
    }
    Alert.alert(
      'Unsaved Session changes',
      'Save or discard the current Session changes before continuing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard Changes',
          style: 'destructive',
          onPress: () => {
            discardWorkspaceChanges();
            action();
          },
        },
        {
          text: saveLabel,
          onPress: () => {
            void saveWorkspaceChanges().then((success) => {
              if (success) action();
            });
          },
        },
      ],
    );
  }, [discardWorkspaceChanges, saveLabel, saveWorkspaceChanges, sessionDirty]);

  const openMovement = useCallback((item: SessionMovementItem) => {
    const nextId = selectedId === item.id ? null : item.id;
    setSelectedId(nextId);
    if (nextId != null) {
      const movement = sessionDraft.movements[nextId];
      setManualOverrideEnabled(Boolean(movement && (isCoreVariantDraft(movement) || draftHasManualOverride(movement))));
      setBackdownManualOverrideEnabled(Boolean(movement?.backdownTargetLowLb || movement?.backdownTargetHighLb));
    }
  }, [selectedId, sessionDraft.movements]);

  const collapseMovement = useCallback(() => {
    Keyboard.dismiss();
    setSelectedId(null);
  }, []);

  const addMovement = useCallback(() => {
    Alert.alert('Add Movement', 'Choose the movement category.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Core', onPress: () => props.onAddCore(sessionDraft.displayUnit, (item) => addSessionDraftMovement(item, 'core', setSessionDraft, setSelectedId)) },
      { text: 'Accessory', onPress: () => props.onAddAccessory((item) => addSessionDraftMovement(item, 'accessory', setSessionDraft, setSelectedId)) },
    ]);
  }, [props, sessionDraft.displayUnit]);

  const selectAthlete = useCallback((nextAthleteId: number) => {
    setSessionDraft((current) => ({ ...current, athleteId: nextAthleteId }));
    setEditingAthlete(false);
  }, []);

  const selectDate = useCallback((event: DateTimePickerEvent, value?: Date) => {
    setEditingDate(false);
    if (event.type === 'dismissed' || !value) return;
    const nextDate = toIsoDate(value);
    setSessionDraft((current) => ({ ...current, scheduledDate: nextDate }));
  }, []);

  const deleteSelectedMovement = useCallback(() => {
    if (!selectedItem) return;
    Alert.alert('Remove movement?', `Remove ${movementName(selectedItem)} from this Session?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setSessionDraft((current) => removeSessionDraftMovement(current, selectedItem.id));
          setSelectedId(null);
        },
      },
    ]);
  }, [selectedItem]);

  const changeSelectedAccessory = useCallback(() => {
    if (!selectedItem || selectedKind !== 'accessory') return;
    props.onChangeAccessory(selectedItem, (replacement) => {
      setSessionDraft((current) => ({
        ...current,
        items: { ...current.items, [replacement.id]: replacement },
        movements: {
          ...current.movements,
          [replacement.id]: {
            ...current.movements[replacement.id],
            movement: movementName(replacement),
          },
        },
      }));
      setSelectedId(replacement.id);
    });
  }, [props, selectedItem, selectedKind]);

  const chooseApprovedSubstitution = useCallback(() => {
    if (!selectedItem || selectedKind !== 'accessory' || selectedId == null) return;
    props.onChangeAccessory(selectedItem, (choice) => {
      const selectedName = movementName(choice).trim();
      const movementDefinitionId = Number(choice.movement_identity?.id || 0);
      if (!selectedName || !Number.isInteger(movementDefinitionId) || movementDefinitionId <= 0) {
        Alert.alert('Governed movement required', 'Choose a canonical or coach-owned custom movement.');
        return;
      }
      setSessionDraft((current) => {
        const movement = current.movements[selectedId];
        if (!movement) return current;
        const substitutions = [...movement.approvedSubstitutions];
        if (!substitutions.some((row) => row.movementDefinitionId === movementDefinitionId)) {
          substitutions.push({ movement: selectedName, movementDefinitionId });
        }
        return {
          ...current,
          movements: {
            ...current.movements,
            [selectedId]: {
              ...movement,
              approvedSubsText: substitutions.map((row) => row.movement).join('\n'),
              approvedSubstitutions: substitutions,
            },
          },
        };
      });
    });
  }, [props, selectedId, selectedItem, selectedKind]);

  const openReorder = useCallback(() => {
    props.onOpenReorder(
      { coreIds: sessionDraft.coreOrder, accessoryIds: sessionDraft.accessoryOrder },
      (order) => setSessionDraft((current) => ({ ...current, coreOrder: order.coreIds, accessoryOrder: order.accessoryIds })),
    );
  }, [props, sessionDraft.accessoryOrder, sessionDraft.coreOrder]);

  const guardLifecycle = useCallback<GuardAction>((action) => resolveDirty(action), [resolveDirty]);
  const registerDismissRequest = props.registerDismissRequest;
  const onCloseWorkspace = props.onCloseWorkspace;

  useEffect(() => {
    registerDismissRequest?.(() => resolveDirty(onCloseWorkspace));
    return () => registerDismissRequest?.(null);
  }, [onCloseWorkspace, registerDismissRequest, resolveDirty]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (toolkitExpanded) {
        setToolkitExpanded(false);
        return true;
      }
      resolveDirty(props.onCloseWorkspace);
      return true;
    });
    return () => subscription.remove();
  }, [props.onCloseWorkspace, resolveDirty, toolkitExpanded]);

  return (
    <View style={styles.root}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        ref={listScrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, selectedItem && styles.contentEditing, useAccessibilityReflow && styles.contentAccessibility]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={props.onRefresh} tintColor={palette.muted} />}
        keyboardShouldPersistTaps="handled"
      >
        <SessionCompactIdentity
          title={sessionDraft.title}
          status={status}
          athleteId={sessionDraft.athleteId}
          athleteName={draftAthlete?.name || athleteName || context.split(' • ')[0] || null}
          athleteAvatarUrl={draftAthlete?.avatarUrl || athleteAvatarUrl}
          athleteAvatarVersion={draftAthlete?.avatarVersion || athleteAvatarVersion}
          scheduledDate={sessionDraft.scheduledDate}
          duration={durationLabel}
          athleteOptions={athleteOptions}
          canChangeAthlete={canChangeAthlete}
          editingAthlete={editingAthlete}
          editingDate={editingDate}
          savingSetup={savingSession}
          onBeginAthleteEdit={() => setEditingAthlete((current) => !current)}
          onDismissDate={() => setEditingDate(false)}
          onSelectAthlete={selectAthlete}
          onSelectDate={selectDate}
          accessibilityReflow={useAccessibilityReflow}
        />

        {lockedReason ? <Text style={styles.lockedReason}>{lockedReason}</Text> : null}

        <View style={styles.setupRegion}>
          <SessionNotesPreview
            value={sessionDraft.notes}
            draft={sessionDraft.notes}
            editing={editingNotes}
            saving={savingSession}
            editable={!!capabilities.can_edit_session_notes}
            onEdit={() => setEditingNotes(true)}
            onChange={(nextNotes) => setSessionDraft((current) => ({ ...current, notes: nextNotes }))}
            onSave={() => setEditingNotes(false)}
          />

        </View>

        <View style={styles.programmingRegion}>
          <View style={styles.movementOverview}>
            {(['core', 'accessory'] as const).map((kind) => {
              const items = kind === 'core' ? currentCoreItems : currentAccessoryItems;
              if (!items.length) return null;
              const isFirstGroup = kind === (currentCoreItems.length ? 'core' : 'accessory');
              return (
                <View key={kind} style={styles.movementGroup}>
                  <View style={styles.movementGroupHeader}>
                    <Text style={styles.movementGroupLabel}>{kind === 'core' ? 'Core' : 'Accessories'}</Text>
                    {isFirstGroup ? <SessionWorkloadMetric totalSets={totalProgrammedSets} /> : null}
                  </View>
                  <View style={styles.movementList}>
                    {items.map((item) => item.id === selectedId && draft ? (
                      <InlineMovementWorkspace
                        key={item.id}
                        item={item}
                        kind={kind}
                        draft={draft}
                        dirty={false}
                        editable={editable && capabilities.can_edit_movement !== false}
                        storageUnit={sessionDraft.displayUnit}
                        displayUnit={sessionDraft.displayUnit}
                        calculatedTarget={calculatedTarget}
                        backdownCalculatedTarget={backdownCalculatedTarget}
                        calculatingTarget={calculatingTarget}
                        manualOverrideEnabled={manualOverrideEnabled}
                        backdownManualOverrideEnabled={backdownManualOverrideEnabled}
                        onChange={updateDraft}
                        onManualOverrideEnabledChange={setManualOverrideEnabled}
                        onBackdownManualOverrideEnabledChange={setBackdownManualOverrideEnabled}
                        onChangeMovement={kind === 'accessory' ? changeSelectedAccessory : undefined}
                        onChooseSubstitution={kind === 'accessory' ? chooseApprovedSubstitution : undefined}
                        onOpenHistory={kind === 'accessory' && props.onOpenMovementHistory
                          ? () => props.onOpenMovementHistory?.(item)
                          : undefined}
                        groupedWith={groupedMovementNames(sessionDraft, item.id, draft.supersetGroup)}
                        canDelete={!!capabilities.can_remove_movement}
                        onDelete={deleteSelectedMovement}
                        onCollapse={collapseMovement}
                        accessibilityReflow={useAccessibilityReflow}
                      />
                    ) : (
                      <VisualMovementRow
                        key={item.id}
                        item={movementItemWithDraft(item, sessionDraft.movements[item.id], sessionDraft.displayUnit)}
                        kind={kind}
                        pending={pendingMovementId === item.id}
                        onOpen={openMovement}
                        displayUnit={sessionDraft.displayUnit}
                        calculatedLoad={calculatedRows[item.id] || null}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
            {!allItems.length ? <View style={styles.emptyList}><Text style={styles.emptyText}>No movements in this Session.</Text></View> : null}
          </View>

        </View>

        {assignmentBlockedReason ? <Text accessibilityRole="alert" style={styles.lockedReason}>{assignmentBlockedReason}</Text> : null}
      </ScrollView>

      <SessionFloatingToolkit
        bottom={props.sheetPresentation
          ? SLSpacing.md
          : insets.bottom + SLSpacing.xs + SL_TAB_ROW_CONTROL.shellHeight + SLSpacing.md}
        expanded={toolkitExpanded}
        reduceMotion={reduceMotion}
        restricted={sessionDirty}
        unit={sessionDraft.displayUnit}
        canAddMovement={!!capabilities.can_add_movement}
        canAthleteView={capabilities.can_open_athlete_view !== false}
        canChangeDate={editable}
        canRename={!!capabilities.can_rename}
        canReorder={!!capabilities.can_reorder}
        unitDisabled={savingSession || !editable}
        lifecycleActions={props.renderLifecycleActions(guardLifecycle, sessionDirty)}
        onAddMovement={() => {
          setToolkitExpanded(false);
          addMovement();
        }}
        onAthleteView={() => {
          setToolkitExpanded(false);
          resolveDirty(props.onOpenAthleteView);
        }}
        onChangeDate={() => {
          setToolkitExpanded(false);
          setEditingDate(true);
        }}
        onChangeUnit={changeEditorDisplayUnit}
        onReorder={() => {
          setToolkitExpanded(false);
          openReorder();
        }}
        onRenameSession={() => {
          setToolkitExpanded(false);
          setRenameDraft(sessionDraft.title);
          setRenaming(true);
        }}
        onExpandedChange={setToolkitExpanded}
      />

      <SessionRenameModal
        draft={renameDraft}
        visible={renaming}
        onChange={setRenameDraft}
        onDismiss={() => setRenaming(false)}
        onConfirm={() => {
          const nextTitle = renameDraft.trim();
          if (!nextTitle) return;
          setSessionDraft((current) => ({ ...current, title: nextTitle }));
          setRenaming(false);
        }}
      />

      {sessionDirty ? (
        <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inlineActionBarLayer}>
          <MovementActionBar
            safeAreaBottom={props.sheetPresentation ? 0 : insets.bottom}
            dirty
            saving={savingSession}
            onSave={() => { void saveWorkspaceChanges(); }}
            onDiscard={discardWorkspaceChanges}
            onDone={() => undefined}
          />
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

function SessionCompactIdentity({
  title,
  status,
  athleteId,
  athleteName,
  athleteAvatarUrl,
  athleteAvatarVersion,
  scheduledDate,
  duration,
  athleteOptions,
  canChangeAthlete,
  editingAthlete,
  editingDate,
  savingSetup,
  onBeginAthleteEdit,
  onDismissDate,
  onSelectAthlete,
  onSelectDate,
  accessibilityReflow,
}: {
  title: string;
  status: string;
  athleteId?: number | null;
  athleteName?: string | null;
  athleteAvatarUrl?: string | null;
  athleteAvatarVersion?: string | null;
  scheduledDate?: string | null;
  duration: string | null;
  athleteOptions: SessionWorkspaceAthleteOption[];
  canChangeAthlete: boolean;
  editingAthlete: boolean;
  editingDate: boolean;
  savingSetup: boolean;
  onBeginAthleteEdit: () => void;
  onDismissDate: () => void;
  onSelectAthlete: (athleteId: number) => void;
  onSelectDate: (event: DateTimePickerEvent, date?: Date) => void;
  accessibilityReflow: boolean;
}) {
  const [useCompactAthleteName, setUseCompactAthleteName] = useState(false);
  const athleteNameMeasureWidthRef = useRef(0);
  useEffect(() => setUseCompactAthleteName(false), [athleteName]);
  const athleteDisplayName = athleteName
    ? ((useCompactAthleteName || shouldDefaultToAbbreviatedAthleteName(athleteName))
        ? abbreviatedAthleteName(athleteName)
        : athleteName)
    : null;
  return (
    <View style={styles.identityCard}>
      <MovementCardMaterial accentColor={SLColors.textMuted} borderRadius={SLRadius.lg} state="not_started" />
      <View style={[styles.identityBody, accessibilityReflow && styles.identityBodyReflow]}>
        <View style={styles.identityPrimary}>
          <Text style={styles.identityTitle}>{title}</Text>
          <View style={styles.identityAthleteRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Session athlete: ${athleteName || 'Athlete'}`}
              accessibilityHint={canChangeAthlete ? 'Changes the athlete for this draft Session.' : undefined}
              accessibilityState={{ disabled: !canChangeAthlete || savingSetup }}
              disabled={!canChangeAthlete || savingSetup}
              onPress={onBeginAthleteEdit}
              style={({ pressed }) => [styles.identityAvatarButton, pressed && styles.pressed]}
            >
              <SLProfileAvatar
                accessibilityLabel={`${athleteName || 'Athlete'} profile photo`}
                name={athleteName}
                profilePhotoUrl={athleteAvatarUrl}
                profilePhotoVersion={athleteAvatarVersion}
                size={64}
              />
            </Pressable>
            <View style={styles.identityAthleteMeta}>
              {athleteName ? (
                <View
                  style={styles.identityAthleteNameWrap}
                  onLayout={(event) => {
                    const nextWidth = event.nativeEvent.layout.width;
                    if (Math.abs(nextWidth - athleteNameMeasureWidthRef.current) <= 1) return;
                    athleteNameMeasureWidthRef.current = nextWidth;
                    setUseCompactAthleteName(false);
                  }}
                >
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    onTextLayout={(event) => {
                      if (!useCompactAthleteName && event.nativeEvent.lines.length > 1) setUseCompactAthleteName(true);
                    }}
                    style={styles.identityAthleteNameMeasure}
                  >
                    {athleteName}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Session athlete: ${athleteName}`} accessibilityState={{ disabled: !canChangeAthlete || savingSetup }} disabled={!canChangeAthlete || savingSetup} onPress={onBeginAthleteEdit} style={({ pressed }) => [styles.identityMetaButton, pressed && styles.pressed]}><IdentityMeta icon="person-outline" label={athleteDisplayName || athleteName} affordance={canChangeAthlete} /></Pressable>
                </View>
              ) : null}
              {scheduledDate ? <View accessibilityLabel={`Session date: ${formatWorkspaceDate(scheduledDate)}`}><IdentityMeta icon="calendar-clear-outline" label={formatWorkspaceDate(scheduledDate)} /></View> : null}
            </View>
          </View>
        </View>
        <View style={[styles.identityContext, accessibilityReflow && styles.identityContextReflow]}>
          <View style={[styles.identitySessionStatus, accessibilityReflow && styles.identitySessionStatusReflow]}>
            <Text style={styles.identitySessionStatusLabel}>Status</Text>
            <Text
              numberOfLines={1}
              style={[styles.identitySessionStatusValue, { color: trainingHubSessionStatusColor(status) }]}
            >
              {humanize(status)}
            </Text>
          </View>
          {duration ? <View style={[styles.identityDuration, accessibilityReflow && styles.identityDurationReflow]}><Text style={styles.identityDurationLabel}>Est. Time</Text><Text numberOfLines={1} style={styles.identityDurationValue}>{duration}</Text></View> : null}
        </View>
      </View>
      {editingAthlete ? (
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.athleteChoices}>
          {athleteOptions.map((option) => {
            const selected = option.id === athleteId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${option.name}`}
                accessibilityState={{ selected, disabled: savingSetup }}
                disabled={savingSetup}
                onPress={() => onSelectAthlete(option.id)}
                style={({ pressed }) => [styles.athleteChoice, selected && styles.athleteChoiceSelected, pressed && styles.pressed]}
              >
                <SLProfileAvatar name={option.name} profilePhotoUrl={option.avatarUrl} profilePhotoVersion={option.avatarVersion} size={28} />
                <Text typographyRole="metadataStrong" numberOfLines={1} style={[styles.athleteChoiceText, selected && styles.athleteChoiceTextSelected]}>{option.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <SessionDatePickerModal
        scheduledDate={scheduledDate}
        visible={editingDate}
        onDismiss={onDismissDate}
        onSelect={onSelectDate}
      />
    </View>
  );
}

function SessionRenameModal({ draft, visible, onChange, onDismiss, onConfirm }: { draft: string; visible: boolean; onChange: (value: string) => void; onDismiss: () => void; onConfirm: () => void }) {
  const disabled = !draft.trim();
  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.renameModalLayer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close Rename Session" onPress={onDismiss} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.renameModalCard}>
          <View style={styles.renameModalHeader}>
            <Text style={styles.renameModalTitle}>Rename Session</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close Rename Session" hitSlop={8} onPress={onDismiss} style={({ pressed }) => [styles.renameModalClose, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Session title"
            autoFocus
            maxLength={120}
            onChangeText={onChange}
            onSubmitEditing={disabled ? undefined : onConfirm}
            returnKeyType="done"
            selectTextOnFocus
            style={styles.renameModalInput}
            value={draft}
          />
          <View style={styles.renameModalActions}>
            <View style={styles.renameModalAction}><SLButton fullWidth label="Cancel" onPress={onDismiss} size="sm" variant="secondary" /></View>
            <View style={styles.renameModalAction}><SLButton fullWidth disabled={disabled} label="Rename" onPress={onConfirm} size="sm" variant="primary" /></View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SessionDatePickerModal({ scheduledDate, visible, onDismiss, onSelect }: { scheduledDate?: string | null; visible: boolean; onDismiss: () => void; onSelect: (event: DateTimePickerEvent, date?: Date) => void }) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.datePickerModalLayer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" onPress={onDismiss} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.datePickerModalCard}>
          <View style={styles.datePickerModalHeader}>
            <Text style={styles.datePickerModalTitle}>Session Date</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" hitSlop={8} onPress={onDismiss} style={({ pressed }) => [styles.datePickerModalClose, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>
          <DateTimePicker
            accentColor={SLColors.accentViolet}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            mode="date"
            style={Platform.OS === 'ios' ? styles.datePickerModalControl : undefined}
            themeVariant="dark"
            value={parseWorkspaceDate(scheduledDate) || new Date()}
            onChange={onSelect}
          />
        </View>
      </View>
    </Modal>
  );
}

function IdentityMeta({ icon, label, affordance = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; affordance?: boolean }) {
  return <View style={styles.identityMeta}><Ionicons name={icon} size={SLIconSize.compact} color={palette.muted} /><Text numberOfLines={1} style={styles.identityMetaText}>{label}</Text>{affordance ? <Ionicons name="chevron-down" size={12} color={palette.subtle} /> : null}</View>;
}

function SessionWorkloadMetric({ totalSets }: { totalSets: number }) {
  return (
    <View accessibilityLabel={`${totalSets} total programmed ${totalSets === 1 ? 'set' : 'sets'}`} style={styles.workloadMetric}>
      <Text numberOfLines={1} style={styles.workloadMetricLabel}>Total Sets</Text>
      <Text numberOfLines={1} style={styles.workloadMetricValue}>{totalSets}</Text>
    </View>
  );
}

function SessionFloatingToolkit({ bottom, expanded, reduceMotion, restricted, unit, canAddMovement, canAthleteView, canChangeDate, canRename, canReorder, unitDisabled, lifecycleActions, onAddMovement, onAthleteView, onChangeDate, onChangeUnit, onRenameSession, onReorder, onExpandedChange }: { bottom: number; expanded: boolean; reduceMotion: boolean; restricted: boolean; unit: CoachDisplayUnit; canAddMovement: boolean; canAthleteView: boolean; canChangeDate: boolean; canRename: boolean; canReorder: boolean; unitDisabled: boolean; lifecycleActions: React.ReactNode; onAddMovement: () => void; onAthleteView: () => void; onChangeDate: () => void; onChangeUnit: (unit: CoachDisplayUnit) => void; onRenameSession: () => void; onReorder: () => void; onExpandedChange: (expanded: boolean) => void }) {
  const nextUnit = unit === 'kg' ? 'lb' : 'kg';
  const { expansion, expandedItemsOpacity, collapsedAnchorOpacity } = useFloatingNavigationMotion({
    expanded,
    collapsedWidth: 0,
    expandedWidth: 1,
    reduceMotion,
  });
  const panelMotionStyle = {
    opacity: expandedItemsOpacity,
    transform: [
      { translateY: expansion.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
      { scale: expansion.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1] }) },
    ],
  };
  return (
    <>
      {expanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Session tools"
          onPress={() => onExpandedChange(false)}
          style={styles.sessionToolkitDismissLayer}
        />
      ) : null}
      <View pointerEvents="box-none" style={[styles.sessionToolkit, { bottom }]}>
        <View accessibilityLabel="Session tools" style={styles.sessionToolkitShell}>
          <Animated.View
            accessibilityElementsHidden={!expanded}
            pointerEvents={expanded ? 'auto' : 'none'}
            style={[styles.sessionToolkitPanel, panelMotionStyle]}
          >
            <View pointerEvents="none" style={styles.sessionToolkitPanelMaterialClip}>
              <View style={styles.sessionToolkitMaterial} />
              <LinearGradient colors={SL_TAB_ROW_FALLBACK_SHEEN} end={{ x: 0.72, y: 1 }} locations={[0, 0.48, 1]} start={{ x: 0.12, y: 0 }} style={StyleSheet.absoluteFillObject} />
            </View>
            <View style={styles.sessionToolkitGroup}>
              <ToolkitSectionHeader label="Edit Session" color={SLColors.info} />
              {!restricted && canRename ? <ToolkitAction icon="create-outline" label="Rename Session" color={SLColors.info} onPress={onRenameSession} /> : null}
              {!restricted && canChangeDate ? <ToolkitAction icon="calendar-clear-outline" label="Change Date" color={SLColors.info} onPress={onChangeDate} /> : null}
              {canAddMovement ? <ToolkitAction icon="add-circle-outline" label="Add Movement" color={SLColors.info} onPress={onAddMovement} /> : null}
              <ToolkitAction icon="swap-horizontal-outline" label={`Units: ${unit.toUpperCase()}`} color={SLColors.info} disabled={unitDisabled} onPress={() => onChangeUnit(nextUnit)} />
            </View>
            <View style={styles.sessionToolkitDivider} />
            {!restricted && (canAthleteView || canReorder) ? <>
              <View style={styles.sessionToolkitGroup}>
                <ToolkitSectionHeader label="Workspace" color={SLColors.accentViolet} />
                {canAthleteView ? <ToolkitAction icon="eye-outline" label="Athlete View" color={SLColors.accentViolet} onPress={onAthleteView} /> : null}
                {canReorder ? <ToolkitAction icon="swap-vertical-outline" label="Reorder Movements" color={SLColors.accentViolet} onPress={onReorder} /> : null}
              </View>
              <View style={styles.sessionToolkitDivider} />
            </> : null}
            <View style={styles.sessionToolkitGroup}>
              <View style={styles.sessionToolkitLifecycle}>{lifecycleActions}</View>
            </View>
          </Animated.View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Close Session tools' : 'Open Session tools'}
            accessibilityState={{ expanded }}
            onPress={() => onExpandedChange(!expanded)}
            style={({ pressed }) => [styles.sessionToolkitTrigger, pressed && styles.pressed]}
          >
            <View pointerEvents="none" style={styles.sessionToolkitTriggerMaterialClip}>
              <View style={styles.sessionToolkitMaterial} />
              <LinearGradient colors={SL_TAB_ROW_FALLBACK_SHEEN} end={{ x: 0.72, y: 1 }} locations={[0, 0.48, 1]} start={{ x: 0.12, y: 0 }} style={StyleSheet.absoluteFillObject} />
            </View>
            <Animated.View pointerEvents="none" style={[styles.sessionToolkitSelectedLens, { opacity: expansion }]}><LinearGradient colors={SL_TAB_ROW_SELECTED_LENS} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFillObject} /></Animated.View>
            <Animated.View pointerEvents="none" style={[styles.sessionToolkitTriggerIcon, { opacity: collapsedAnchorOpacity }]}><Ionicons name="build-outline" size={SL_TAB_ROW_CONTROL.iconSize} color={SL_TAB_ROW_CONTROL.inactiveColor} /></Animated.View>
            <Animated.View pointerEvents="none" style={[styles.sessionToolkitTriggerIcon, { opacity: expansion }]}><Ionicons name="close" size={SL_TAB_ROW_CONTROL.iconSize} color={SL_TAB_ROW_CONTROL.selectedColor} /></Animated.View>
          </Pressable>
        </View>
      </View>
    </>
  );
}

function ToolkitSectionHeader({ label, color }: { label: string; color: string }) {
  return <Text style={[styles.sessionToolkitSectionHeader, { color }]}>{label}</Text>;
}

function ToolkitAction({ icon, label, color, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.sessionToolkitAction, disabled && styles.disabled, pressed && styles.pressed]}>
      <Ionicons name={icon} size={SL_TAB_ROW_CONTROL.iconSize} color={color} />
      <Text style={styles.sessionToolkitActionText}>{label}</Text>
    </Pressable>
  );
}

function SessionNotesPreview({ value, draft, editing, saving, editable, onEdit, onChange, onSave }: { value: string; draft: string; editing: boolean; saving: boolean; editable: boolean; onEdit: () => void; onChange: (value: string) => void; onSave: () => void }) {
  return (
    <View style={styles.sessionNotes}>
      <View style={styles.sessionNotesHeader}>
        <Text style={styles.compactSectionLabel}>Session Notes</Text>
        {!editing && editable ? <Pressable accessibilityRole="button" accessibilityLabel="Edit Session notes" hitSlop={10} onPress={onEdit} style={styles.textButton}><Text style={styles.textButtonLabel}>Edit</Text></Pressable> : null}
      </View>
      {editing ? (
        <>
          <TextInput accessibilityLabel="Session notes" multiline value={draft} onChangeText={onChange} placeholder="Add notes for the athlete" placeholderTextColor={palette.subtle} style={styles.sessionNotesInput} />
          <View style={styles.inlineActions}>
            <SmallButton label="Done" onPress={onSave} disabled={saving} primary />
          </View>
        </>
      ) : <Pressable accessibilityRole="button" accessibilityLabel="Edit Session notes" disabled={!editable} onPress={onEdit} style={({ pressed }) => [styles.sessionNotesPreview, pressed && styles.pressed]}><Text style={[styles.sessionNotesText, !value && styles.emptyText]}>{value || 'No Session notes.'}</Text></Pressable>}
    </View>
  );
}

function VisualMovementRow({ item, kind, pending, onOpen, displayUnit, calculatedLoad }: { item: SessionMovementItem; kind: MovementKind; pending: boolean; onOpen: (item: SessionMovementItem) => void; displayUnit: CoachDisplayUnit; calculatedLoad: CalculatedLoadResult | null }) {
  const load = collapsedLoadPresentation(item, kind, calculatedLoad, displayUnit);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[`Edit ${movementName(item)}`, prescriptionSummary(item, kind), load?.label, load?.value].filter(Boolean).join(', ')}
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.movementRow, pressed && styles.movementRowPressed]}
    >
      <MovementCardMaterial accentColor={movementAccent(item)} borderRadius={SLRadius.lg} state="not_started" />
      <View style={styles.movementArtwork}><MovementArtwork item={item} kind={kind} size={72} /></View>
      <View style={styles.movementCopy}>
        <Text typographyRole="movementTitle" numberOfLines={2} style={styles.movementName}>{movementName(item)}</Text>
        <Text typographyRole="bodyStrong" numberOfLines={2} style={styles.movementPrescription}>{prescriptionSummary(item, kind)}</Text>
        {load ? <View style={styles.movementLoadRow}>{load.label ? <Text typographyRole="micro" style={[styles.movementLoadLabel, load.manual && styles.movementLoadLabelManual]}>{load.label}</Text> : null}<Text typographyRole="bodyStrong" numberOfLines={2} style={[styles.movementLoad, load.manual && styles.movementLoadManual]}>{load.value}</Text></View> : null}
        <Text typographyRole="metadata" numberOfLines={2} style={styles.movementMeta}>{movementMeta(item, kind)}</Text>
      </View>
      <View style={styles.movementTrailing}>{pending ? <ActivityIndicator size="small" color={palette.violet} /> : <Ionicons name="chevron-forward" size={18} color={palette.muted} />}</View>
    </Pressable>
  );
}

function InlineMovementWorkspace({ item, kind, draft, dirty, editable, storageUnit, displayUnit, calculatedTarget, backdownCalculatedTarget, calculatingTarget, manualOverrideEnabled, backdownManualOverrideEnabled, canDelete, groupedWith, onChange, onManualOverrideEnabledChange, onBackdownManualOverrideEnabledChange, onChangeMovement, onChooseSubstitution, onOpenHistory, onDelete, onCollapse, accessibilityReflow }: { item: SessionMovementItem; kind: MovementKind; draft: CoachMovementDraft; dirty: boolean; editable: boolean; storageUnit: CoachDisplayUnit; displayUnit: CoachDisplayUnit; calculatedTarget: CalculatedLoadResult | null; backdownCalculatedTarget: CalculatedLoadResult | null; calculatingTarget: boolean; manualOverrideEnabled: boolean; backdownManualOverrideEnabled: boolean; canDelete: boolean; groupedWith: string[]; onChange: (patch: Partial<CoachMovementDraft>) => void; onManualOverrideEnabledChange: (enabled: boolean) => void; onBackdownManualOverrideEnabledChange: (enabled: boolean) => void; onChangeMovement?: () => void; onChooseSubstitution?: () => void; onOpenHistory?: () => void; onDelete: () => void; onCollapse: () => void; accessibilityReflow: boolean }) {
  const load = kind === 'core'
    ? expandedLoadPresentation(draft, calculatedTarget, storageUnit, displayUnit, manualOverrideEnabled)
    : null;
  return (
    <View accessibilityLabel={`${movementName(item)} expanded movement workspace`} style={styles.expandedMovementCard}>
      <MovementCardMaterial accentColor={movementAccent(item)} borderRadius={SLRadius.lg} state="not_started" />
      <Pressable accessibilityRole="button" accessibilityLabel={`Collapse ${movementName(item)} editor`} onPress={onCollapse} style={({ pressed }) => [styles.expandedMovementHeader, pressed && styles.pressed]}>
        <View style={styles.expandedMovementArtwork}><MovementArtwork item={item} kind={kind} size={64} /></View>
        <View style={styles.expandedMovementCopy}>
          <Text numberOfLines={2} style={[styles.movementName, styles.expandedMovementName]}>{movementName(item)}</Text>
          <Text numberOfLines={2} style={styles.movementMeta}>{draftMovementMeta(draft, item, kind)}</Text>
          {load ? <View style={styles.movementLoadRow}><Text typographyRole="micro" style={[styles.movementLoadLabel, load.manual && styles.movementLoadLabelManual]}>{load.label}</Text><Text numberOfLines={2} style={[styles.expandedLoad, load.manual && styles.movementLoadManual]}>{load.value}</Text></View> : null}
          {dirty ? <View accessibilityLabel="Unsaved changes" style={styles.dirtyDot} /> : null}
        </View>
        <View style={styles.movementTrailing}><Ionicons name="chevron-forward" size={20} color={palette.muted} /></View>
      </Pressable>
      <View style={styles.expandedEditorBody}>
        {kind === 'accessory' && onChangeMovement ? <MovementIdentityAction movement={movementName(item)} disabled={!editable} onPress={onChangeMovement} /> : null}
        <MovementQuickPrescriptionEditor
          key={`movement-editor-${item.id}`}
          draft={draft}
          kind={kind}
          editable={editable}
          accessibilityReflow={accessibilityReflow}
          onChange={onChange}
          storageUnit={storageUnit}
          displayUnit={displayUnit}
          calculatedTarget={calculatedTarget}
          backdownCalculatedTarget={backdownCalculatedTarget}
          calculatingTarget={calculatingTarget}
          manualOverrideEnabled={manualOverrideEnabled}
          backdownManualOverrideEnabled={backdownManualOverrideEnabled}
          onManualOverrideEnabledChange={onManualOverrideEnabledChange}
          onBackdownManualOverrideEnabledChange={onBackdownManualOverrideEnabledChange}
        />
        {kind === 'accessory' ? <AccessorySessionProgrammingContext draft={draft} editable={editable} groupedWith={groupedWith} onChange={onChange} onChooseSubstitution={onChooseSubstitution} /> : null}
        <RecentHistorySection item={item} displayUnit={displayUnit} onOpenHistory={onOpenHistory} />
        <CoachNotesSection value={draft.notes} editable={editable} onChange={(value) => onChange({ notes: value })} />
        <MovementDeleteAction disabled={!canDelete} onDelete={onDelete} />
      </View>
    </View>
  );
}

function MovementArtwork({ item, kind, size }: { item: SessionMovementItem | null; kind: MovementKind; size: number }) {
  const movement = item ? {
    id: item.id,
    kind,
    lift: item.lift,
    variant: item.variant,
    movement_definition_id: item.movement_identity?.id,
    movement_identity: item.movement_identity,
    performed_movement_identity: item.performed_movement_identity,
    performed_canonical_movement_identity: item.performed_canonical_movement_identity,
    legacy: item.legacy,
  } : null;
  return <CanonicalMovementArtwork movement={movement} size={size} testID="session-editor-canonical-movement-artwork" />;
}

type PrescriptionDropdownOption = {
  label: string;
  value: string;
};

function CompactDropdownSelector({ label, value, options, open, disabled, onOpenChange, onChange }: { label: string; value: string; options: PrescriptionDropdownOption[]; open: boolean; disabled?: boolean; onOpenChange: (open: boolean) => void; onChange: (value: string) => void }) {
  const selected = options.find((option) => option.value === value) || options[0];
  return (
    <View
      onTouchStart={(event) => event.stopPropagation()}
      style={[styles.prescriptionChoiceField, styles.dropdownContainer, open && styles.dropdownContainerOpen]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label || value}`}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => onOpenChange(!open)}
        style={({ pressed }) => [styles.dropdownSelector, open && styles.dropdownSelectorOpen, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Text numberOfLines={1} style={styles.dropdownSelectorText}>{selected?.label || value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={open ? palette.violet : palette.muted} />
      </Pressable>
      {open ? (
        <View accessibilityRole="menu" style={styles.dropdownMenu}>
          {options.map((option, index) => {
            const optionSelected = option.value === value;
            return (
              <Pressable
                accessibilityRole="menuitem"
                accessibilityState={{ selected: optionSelected }}
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  onOpenChange(false);
                }}
                style={({ pressed }) => [styles.dropdownMenuItem, index === options.length - 1 && styles.dropdownMenuItemLast, optionSelected && styles.dropdownMenuItemSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.dropdownMenuItemText, optionSelected && styles.dropdownMenuItemTextSelected]}>{option.label}</Text>
                {optionSelected ? <Ionicons name="checkmark" size={18} color={palette.violet} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

type AccessoryPrescriptionPicker = 'sets' | 'reps' | 'rir' | null;

function AccessoryPrescriptionEditor({ draft, editable, onChange }: { draft: CoachMovementDraft; editable: boolean; accessibilityReflow: boolean; modeMenuOpen: boolean; onModeMenuOpenChange: (open: boolean) => void; onChange: (patch: Partial<CoachMovementDraft>) => void }) {
  const committedTarget = accessoryRepTargetFromText(draft.repsText);
  const [picker, setPicker] = useState<AccessoryPrescriptionPicker>(null);
  const [setsDraft, setSetsDraft] = useState(draft.sets || '3');
  const [rirDraft, setRirDraft] = useState(draft.rir || '2');
  const [repDraft, setRepDraft] = useState<AccessoryRepTarget>(committedTarget);
  const repMemoryRef = useRef<AccessoryRepTargetMemory>(accessoryRepTargetMemoryFromTarget(committedTarget));

  const openPicker = (next: Exclude<AccessoryPrescriptionPicker, null>) => {
    if (!editable) return;
    setSetsDraft(draft.sets || '3');
    setRirDraft(draft.rir || '2');
    const nextTarget = accessoryRepTargetFromText(draft.repsText);
    setRepDraft(nextTarget);
    repMemoryRef.current = accessoryRepTargetMemoryFromTarget(nextTarget);
    setPicker(next);
  };
  const changeRepMode = (nextMode: AccessoryRepTargetMode) => {
    const transitioned = transitionAccessoryRepTarget(repDraft, nextMode, repMemoryRef.current);
    repMemoryRef.current = transitioned.memory;
    setRepDraft(transitioned.target);
  };
  const apply = () => {
    if (picker === 'sets') onChange({ sets: setsDraft });
    if (picker === 'reps') onChange({ repsText: accessoryRepTargetText(repDraft) });
    if (picker === 'rir') onChange({ rir: rirDraft });
    setPicker(null);
  };
  const repTypeLabel = committedTarget.mode === 'FIXED' ? 'Single' : committedTarget.mode === 'RANGE' ? 'Range' : 'AMRAP';

  return (
    <View style={[styles.quickSection, styles.accessoryPrescriptionEditor]}>
      <Text style={styles.prescriptionSectionLabel}>PRESCRIPTION</Text>
      <View style={styles.prescriptionControlRow}>
        <PrescriptionValueControl accent="sets" disabled={!editable} label="SETS" meta="Tap to edit" onPress={() => openPicker('sets')} value={draft.sets || '—'} />
        <PrescriptionValueControl accent="reps" disabled={!editable} label="REPS" meta={repTypeLabel} onPress={() => openPicker('reps')} value={accessoryRepDisplayText(draft.repsText)} />
        <PrescriptionValueControl accent="rir" disabled={!editable} label="RIR" meta="Tap to edit" onPress={() => openPicker('rir')} value={draft.rir || '—'} />
      </View>

      <StrengthLedgerBottomSheet
        accessibilityLabel={picker === 'sets' ? 'Sets prescription picker' : picker === 'reps' ? 'Rep Target prescription picker' : 'RIR prescription picker'}
        heightFraction={picker === 'reps' && repDraft.mode === 'RANGE' ? 0.68 : 0.56}
        onDismiss={() => setPicker(null)}
        visible={picker != null}
      >
        <View style={styles.prescriptionPickerSheet}>
          <Text style={styles.prescriptionPickerTitle}>{picker === 'sets' ? 'SETS' : picker === 'reps' ? 'REP TARGET' : 'RIR'}</Text>
          {picker === 'sets' ? <LoggerWheelPicker density="compact" columns={[{
            key: 'sheet-sets', label: '', accessibilityLabel: 'Sets', value: setsDraft,
            options: integerWheelOptions(1, 20, setsDraft), accessibilityValue: (value) => `${value} sets`, onChange: setSetsDraft,
          }]} /> : null}
          {picker === 'reps' ? <>
            <View style={styles.repModeRow}>
              {([['FIXED', 'Single'], ['RANGE', 'Range'], ['AMRAP', 'AMRAP']] as const).map(([mode, label]) => {
                const selected = repDraft.mode === mode;
                return <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => changeRepMode(mode)} style={[styles.repModeButton, selected && styles.repModeButtonSelected]}><Text style={[styles.repModeButtonText, selected && styles.repModeButtonTextSelected]}>{label}</Text></Pressable>;
              })}
            </View>
            {repDraft.mode === 'FIXED' ? <LoggerWheelPicker density="compact" columns={[{
              key: 'sheet-single-reps', label: 'REPS', value: repDraft.fixed,
              options: integerWheelOptions(1, 50, repDraft.fixed), accessibilityValue: (value) => `${value} reps`, onChange: (fixed) => setRepDraft({ mode: 'FIXED', fixed }),
            }]} /> : repDraft.mode === 'RANGE' ? <View style={styles.repRangePicker}>
              <LoggerWheelPicker density="compact" grouped columns={[
                { key: 'sheet-min-reps', label: 'MIN REPS', value: repDraft.low, options: integerWheelOptions(1, 50, repDraft.low), accessibilityValue: (value) => `Minimum ${value} reps`, onChange: (low) => setRepDraft(accessoryRepRangeAfterLowerChange(low, repDraft.high)) },
                { key: 'sheet-max-reps', label: 'MAX REPS', value: repDraft.high, options: integerWheelOptions(1, 50, repDraft.high), accessibilityValue: (value) => `Maximum ${value} reps`, onChange: (high) => setRepDraft(accessoryRepRangeAfterUpperChange(repDraft.low, high)) },
              ]} />
              <View pointerEvents="none" style={styles.repRangeDash}><Text style={styles.repRangeDashText}>—</Text></View>
            </View> : <View style={styles.amrapState}><Text style={styles.amrapValue}>AMRAP</Text><Text style={styles.amrapDetail}>As many quality repetitions as possible. RIR remains an independent target.</Text></View>}
          </> : null}
          {picker === 'rir' ? <LoggerWheelPicker density="compact" columns={[{
            key: 'sheet-rir', label: '', accessibilityLabel: 'RIR target', value: rirDraft,
            options: decimalWheelOptions(0, 10, 0.5, rirDraft), accessibilityValue: (value) => `${value} RIR`, onChange: setRirDraft,
          }]} /> : null}
          <View style={styles.prescriptionPickerAction}><SLButton fullWidth label="Apply" onPress={apply} size="lg" variant="primary" /></View>
        </View>
      </StrengthLedgerBottomSheet>
    </View>
  );
}

function PrescriptionValueControl({ accent, disabled, label, meta, onPress, value }: { accent: 'sets' | 'reps' | 'rir'; disabled: boolean; label: string; meta: string; onPress: () => void; value: string }) {
  const accentStyle = accent === 'sets' ? styles.prescriptionValueControlSets : accent === 'reps' ? styles.prescriptionValueControlReps : styles.prescriptionValueControlRir;
  return <Pressable accessibilityLabel={`${label}, ${value}, ${meta}`} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.prescriptionValueControl, accentStyle, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={styles.prescriptionValueLabel}>{label}</Text>
    <Text numberOfLines={1} style={[styles.prescriptionValue, accent === 'sets' ? styles.prescriptionValueSets : accent === 'reps' ? styles.prescriptionValueReps : styles.prescriptionValueRir]}>{value}</Text>
    <Text numberOfLines={1} style={styles.prescriptionValueMeta}>{meta}</Text>
  </Pressable>;
}

function MovementQuickPrescriptionEditor({ draft, kind, editable, accessibilityReflow, onChange, storageUnit, displayUnit, calculatedTarget, backdownCalculatedTarget, calculatingTarget, manualOverrideEnabled, backdownManualOverrideEnabled, onManualOverrideEnabledChange, onBackdownManualOverrideEnabledChange }: { draft: CoachMovementDraft; kind: MovementKind; editable: boolean; accessibilityReflow: boolean; onChange: (patch: Partial<CoachMovementDraft>) => void; storageUnit: CoachDisplayUnit; displayUnit: CoachDisplayUnit; calculatedTarget: CalculatedLoadResult | null; backdownCalculatedTarget: CalculatedLoadResult | null; calculatingTarget: boolean; manualOverrideEnabled: boolean; backdownManualOverrideEnabled: boolean; onManualOverrideEnabledChange: (enabled: boolean) => void; onBackdownManualOverrideEnabledChange: (enabled: boolean) => void }) {
  const [openDropdown, setOpenDropdown] = useState<'designation' | 'set-type' | 'intensity-type' | 'rep-target' | null>(null);
  const isCoreVariant = kind === 'core' && isCoreVariantDraft(draft);
  const mainIntensityValue = draft.mode === 'PCT' ? draft.pct : draft.rpe;
  const mainIntensityLabel = draft.mode === 'PCT' ? 'Percentage' : 'RPE';
  const schemeOptions: PrescriptionDropdownOption[] = [
    { label: 'Straight Sets', value: 'STRAIGHT' },
    { label: 'Top + Backdowns', value: 'TOP_BACKDOWN' },
    { label: 'Full Custom', value: 'FULL_CUSTOM' },
  ];
  const intensityOptions: PrescriptionDropdownOption[] = [
    { label: 'RPE', value: 'RPE' },
    { label: 'Percentage', value: 'PCT' },
  ];
  const designationOptions: PrescriptionDropdownOption[] = [
    { label: 'None', value: '' },
    { label: 'Primary', value: 'PRIMARY' },
    { label: 'Secondary', value: 'SECONDARY' },
    { label: 'Tertiary', value: 'TERTIARY' },
    { label: 'Quaternary', value: 'QUATERNARY' },
  ];
  const fullCustomOverrideEnabled = manualOverrideEnabled || draft.plannedSets.some((row) => Boolean(row.targetLb));
  const clearFullCustomOverrides = () => onChange({
    plannedSets: draft.plannedSets.map((row) => ({ ...row, targetLb: '', rangeLb: '' })),
  });
  return (
    <View onTouchStart={() => setOpenDropdown(null)} style={styles.programmingStack}>
      {kind === 'core' ? <View style={[styles.quickSection, styles.prescriptionChoiceRow]}>
        <CompactDropdownSelector
          label="Designation"
          value={draft.designation}
          options={designationOptions}
          open={openDropdown === 'designation'}
          disabled={!editable}
          onOpenChange={(open) => setOpenDropdown(open ? 'designation' : null)}
          onChange={(designation) => onChange({ designation })}
        />
        {!isCoreVariant ? <CompactDropdownSelector
          label="Set Type"
          value={draft.scheme}
          options={schemeOptions}
          open={openDropdown === 'set-type'}
          disabled={!editable || schemeOptions.length < 2}
          onOpenChange={(open) => setOpenDropdown(open ? 'set-type' : null)}
          onChange={(scheme) => onChange({ scheme: scheme as CoachMovementDraft['scheme'] })}
        /> : null}
        {!isCoreVariant ? <CompactDropdownSelector
          label="Intensity Type"
          value={kind === 'core' ? draft.mode : 'RIR'}
          options={intensityOptions}
          open={openDropdown === 'intensity-type'}
          disabled={!editable || intensityOptions.length < 2}
          onOpenChange={(open) => setOpenDropdown(open ? 'intensity-type' : null)}
          onChange={(mode) => onChange({ mode: mode as CoachMovementDraft['mode'] })}
        /> : null}
      </View> : null}
      {kind === 'accessory' ? (
        <AccessoryPrescriptionEditor
          draft={draft}
          editable={editable}
          accessibilityReflow={accessibilityReflow}
          modeMenuOpen={openDropdown === 'rep-target'}
          onModeMenuOpenChange={(open) => setOpenDropdown(open ? 'rep-target' : null)}
          onChange={onChange}
        />
      ) : <View style={styles.quickSection}>
        {isCoreVariant ? (
          <LoggerWheelPicker density="compact" columns={[
            { key: 'sets', label: 'Sets', value: draft.sets, options: integerWheelOptions(1, 20, draft.sets), accessibilityValue: (value) => `${value} sets`, onChange: (sets) => onChange({ sets }), disabled: !editable },
            { key: 'reps', label: 'Reps', value: draft.reps, options: integerWheelOptions(1, 50, draft.reps), accessibilityValue: (value) => `${value} reps`, onChange: (reps) => onChange({ reps }), disabled: !editable },
          ]} />
        ) : draft.scheme === 'TOP_BACKDOWN' && draft.sourceVariant !== 'BK' && kind === 'core' ? (
          <View style={styles.topBackdownStack}>
            <PrescriptionWorkBlock label="Top Work" sets={draft.sets} reps={draft.reps} intensity={mainIntensityValue} intensityLabel={mainIntensityLabel} mode={draft.mode} editable={editable} onSets={(sets) => onChange({ sets })} onReps={(reps) => onChange({ reps })} onIntensity={(value) => onChange(draft.mode === 'PCT' ? { pct: value } : { rpe: value })} />
            <PrescriptionWorkBlock label="Backdown Work" sets={draft.backdownSets} reps={draft.backdownReps} intensity={draft.mode === 'PCT' ? draft.backdownPct : draft.backdownRpe} intensityLabel={mainIntensityLabel} mode={draft.mode} editable={editable} onSets={(backdownSets) => onChange({ backdownSets })} onReps={(backdownReps) => onChange({ backdownReps })} onIntensity={(value) => onChange(draft.mode === 'PCT' ? { backdownPct: value } : { backdownRpe: value })} />
          </View>
        ) : draft.scheme === 'FULL_CUSTOM' && kind === 'core' ? (
          <FullCustomSetEditor draft={draft} editable={editable} onChange={onChange} />
        ) : (
          <LoggerWheelPicker density="compact" columns={[
            { key: 'sets', label: 'Sets', value: draft.sets, options: integerWheelOptions(1, 20, draft.sets), accessibilityValue: (value) => `${value} sets`, onChange: (sets) => onChange({ sets }), disabled: !editable },
            { key: 'reps', label: 'Reps', value: draft.reps, options: integerWheelOptions(1, 50, draft.reps), accessibilityValue: (value) => `${value} reps`, onChange: (reps) => onChange({ reps }), disabled: !editable },
            { key: draft.mode.toLowerCase(), label: mainIntensityLabel, value: mainIntensityValue, options: draft.mode === 'PCT' ? decimalWheelOptions(20, 100, 2.5, draft.pct) : decimalWheelOptions(5, 10, 0.5, draft.rpe), suffix: draft.mode === 'PCT' ? '%' : undefined, accessibilityValue: (value) => draft.mode === 'PCT' ? `${value} percent` : `${value} RPE`, onChange: (value) => onChange(draft.mode === 'PCT' ? { pct: value } : { rpe: value }), disabled: !editable },
          ]} />
        )}
      </View>}

      {kind === 'core' && !isCoreVariant ? <View style={styles.quickSection}>
        {draft.scheme === 'TOP_BACKDOWN' && draft.sourceVariant !== 'BK' && kind === 'core' ? (
          <View style={styles.topBackdownStack}>
            <CalculatedTargetPanel label="Top Work" calculated={calculatedTarget} calculating={calculatingTarget} displayUnit={displayUnit} />
            <CalculatedTargetPanel label="Backdown Work" calculated={backdownCalculatedTarget} calculating={calculatingTarget} displayUnit={displayUnit} />
          </View>
        ) : draft.scheme === 'FULL_CUSTOM' && kind === 'core' ? (
          <CalculatedTargetPanel label="Set 1" calculated={calculatedTarget} calculating={calculatingTarget} displayUnit={displayUnit} />
        ) : (
          <CalculatedTargetPanel calculated={calculatedTarget} calculating={calculatingTarget} displayUnit={displayUnit} />
        )}
      </View> : null}

      {kind === 'core' ? <View style={styles.quickSection}>
        {isCoreVariant ? (
          <ManualOverrideBlock required draftLow={draft.targetLowLb} draftHigh={draft.targetHighLb} storageUnit={storageUnit} displayUnit={displayUnit} manualEnabled editable={editable} onManualEnabledChange={() => {}} onRangeChange={(targetLowLb, targetHighLb) => onChange({ targetLowLb, targetHighLb })} />
        ) : draft.scheme === 'TOP_BACKDOWN' && draft.sourceVariant !== 'BK' ? (
          <View style={styles.topBackdownStack}>
            <ManualOverrideBlock label="Top Work" draftLow={draft.targetLowLb} draftHigh={draft.targetHighLb} storageUnit={storageUnit} displayUnit={displayUnit} initialTarget={calculatedManualTargetValue(calculatedTarget, displayUnit)} manualEnabled={manualOverrideEnabled} editable={editable} onManualEnabledChange={(enabled) => { onManualOverrideEnabledChange(enabled); if (!enabled) onChange({ targetLowLb: '', targetHighLb: '' }); }} onRangeChange={(targetLowLb, targetHighLb) => onChange({ targetLowLb, targetHighLb })} />
            <ManualOverrideBlock label="Backdown Work" draftLow={draft.backdownTargetLowLb} draftHigh={draft.backdownTargetHighLb} storageUnit={storageUnit} displayUnit={displayUnit} initialTarget={calculatedManualTargetValue(backdownCalculatedTarget, displayUnit)} manualEnabled={backdownManualOverrideEnabled} editable={editable} onManualEnabledChange={(enabled) => { onBackdownManualOverrideEnabledChange(enabled); if (!enabled) onChange({ backdownTargetLowLb: '', backdownTargetHighLb: '' }); }} onRangeChange={(backdownTargetLowLb, backdownTargetHighLb) => onChange({ backdownTargetLowLb, backdownTargetHighLb })} />
          </View>
        ) : draft.scheme === 'FULL_CUSTOM' ? (
          <FullCustomOverrideEditor draft={draft} editable={editable} onChange={onChange} storageUnit={storageUnit} displayUnit={displayUnit} enabled={fullCustomOverrideEnabled} onEnabledChange={(enabled) => { onManualOverrideEnabledChange(enabled); if (!enabled) clearFullCustomOverrides(); }} />
        ) : (
          <ManualOverrideBlock draftLow={draft.targetLowLb} draftHigh={draft.targetHighLb} storageUnit={storageUnit} displayUnit={displayUnit} initialTarget={calculatedManualTargetValue(calculatedTarget, displayUnit)} manualEnabled={manualOverrideEnabled} editable={editable} onManualEnabledChange={(enabled) => { onManualOverrideEnabledChange(enabled); if (!enabled) onChange({ targetLowLb: '', targetHighLb: '' }); }} onRangeChange={(targetLowLb, targetHighLb) => onChange({ targetLowLb, targetHighLb })} />
        )}
      </View> : null}

    </View>
  );
}

function PrescriptionWorkBlock({ label, sets, reps, intensity, intensityLabel, mode, editable, onSets, onReps, onIntensity }: { label: string; sets: string; reps: string; intensity: string; intensityLabel: string; mode: CoachMovementDraft['mode']; editable: boolean; onSets: (value: string) => void; onReps: (value: string) => void; onIntensity: (value: string) => void }) {
  return (
    <View style={styles.workBlock}>
      <Text typographyRole="bodyStrong" style={styles.workBlockLabel}>{label}</Text>
      <LoggerWheelPicker density="compact" columns={[
        { key: 'sets', label: 'Sets', value: sets, options: integerWheelOptions(1, 20, sets), accessibilityValue: (value) => `${value} sets`, onChange: onSets, disabled: !editable },
        { key: 'reps', label: 'Reps', value: reps, options: integerWheelOptions(1, 50, reps), accessibilityValue: (value) => `${value} reps`, onChange: onReps, disabled: !editable },
        { key: mode.toLowerCase(), label: intensityLabel, value: intensity, options: mode === 'PCT' ? decimalWheelOptions(20, 100, 2.5, intensity) : decimalWheelOptions(5, 10, 0.5, intensity), suffix: mode === 'PCT' ? '%' : undefined, accessibilityValue: (value) => mode === 'PCT' ? `${value} percent` : `${value} RPE`, onChange: onIntensity, disabled: !editable },
      ]} />
    </View>
  );
}

function CalculatedTargetPanel({ calculated, calculating, displayUnit, label }: { calculated: CalculatedLoadResult | null; calculating: boolean; displayUnit: CoachDisplayUnit; label?: string }) {
  const lowKg = calculated?.lowKg ?? calculated?.highKg;
  const highKg = calculated?.highKg ?? calculated?.lowKg;
  const range = lowKg != null && highKg != null ? formatLoggerWeightRangeKg(lowKg, highKg, displayUnit) : null;
  return (
    <View style={styles.calculatedPanel}>
      <View style={styles.calculatedIcon}><Ionicons name="locate-outline" size={22} color={SLColors.accentCyanMuted} /></View>
      <View style={styles.calculatedCopy}>
        <Text typographyRole="micro" style={styles.calculatedEyebrow}>{label ? `${label} target` : 'Calculated target'}</Text>
        {calculating ? <ActivityIndicator size="small" color={SLColors.accentCyanMuted} /> : <Text style={[styles.calculatedValue, !range && styles.emptyText]}>{range || 'Calculated target unavailable'}</Text>}
      </View>
    </View>
  );
}

function calculatedManualTargetValue(calculated: CalculatedLoadResult | null, displayUnit: CoachDisplayUnit) {
  const lowKg = calculated?.lowKg ?? calculated?.highKg;
  const highKg = calculated?.highKg ?? calculated?.lowKg;
  if (lowKg == null || highKg == null) return '';
  const midpointKg = (lowKg + highKg) / 2;
  const displayValue = displayUnit === 'lb' ? midpointKg / KG_PER_LB : midpointKg;
  return numberText(roundLoggerDisplayWeight(displayValue, displayUnit));
}

function ManualOverrideBlock({ label, required = false, draftLow, draftHigh, storageUnit, displayUnit, initialTarget, manualEnabled, editable, onManualEnabledChange, onRangeChange }: { label?: string; required?: boolean; draftLow: string; draftHigh: string; storageUnit: CoachDisplayUnit; displayUnit: CoachDisplayUnit; initialTarget?: string; manualEnabled: boolean; editable: boolean; onManualEnabledChange: (enabled: boolean) => void; onRangeChange: (low: string, high: string) => void }) {
  const manual = manualTargetMarginFromStoredRange(draftLow, draftHigh, storageUnit, displayUnit);
  const enabled = required || manualEnabled;
  const updateManual = (target: string, margin: string) => {
    const range = storedRangeFromManualTarget(target, margin, displayUnit, storageUnit);
    onRangeChange(range.low, range.high);
  };
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nextEnabled = !enabled;
    if (nextEnabled && !manual.target) updateManual(initialTarget || loadWheelOptions(displayUnit, '')[0] || '0', '0');
    onManualEnabledChange(nextEnabled);
  };
  return (
    <View style={styles.loadStrategyBlock}>
      {label ? <Text typographyRole="bodyStrong" style={styles.workBlockLabel}>{label}</Text> : null}
      {required ? <View style={[styles.overrideAction, styles.overrideActionActive]}><View style={[styles.overrideIcon, styles.overrideIconActive]}><Ionicons name="options-outline" size={22} color={SLColors.warning} /></View><View style={styles.overrideCopy}><Text typographyRole="micro" style={[styles.overrideEyebrow, styles.overrideActionTextActive]}>Manual Load</Text><Text style={[styles.overrideActionText, styles.overrideActionTextActive]}>Required for Core variants</Text></View></View> : <ManualOverrideToggle enabled={enabled} editable={editable} onToggle={toggle} />}
      {enabled ? <View style={styles.manualFields}><LoggerWheelPicker density="compact" columns={[
        { key: 'manual-target', label: `Target (${displayUnit})`, value: manual.target, options: loadWheelOptions(displayUnit, manual.target), suffix: displayUnit, accessibilityValue: (value) => `${value} ${displayUnit === 'kg' ? 'kilograms' : 'pounds'}`, onChange: (target) => updateManual(target, manual.margin), disabled: !editable },
        { key: 'manual-margin', label: `Margin ± (${displayUnit})`, value: manual.margin, options: marginWheelOptions(displayUnit, manual.margin), suffix: displayUnit, accessibilityValue: (value) => `plus or minus ${value} ${displayUnit === 'kg' ? 'kilograms' : 'pounds'}`, onChange: (margin) => updateManual(manual.target, margin), disabled: !editable },
      ]} /></View> : null}
    </View>
  );
}

function ManualOverrideToggle({ enabled, editable, onToggle, plural = false }: { enabled: boolean; editable: boolean; onToggle: () => void; plural?: boolean }) {
  return (
    <View style={[styles.overrideAction, enabled && styles.overrideActionActive]}>
      <View style={[styles.overrideIcon, enabled && styles.overrideIconActive]}><Ionicons name="options-outline" size={22} color={enabled ? SLColors.warning : palette.muted} /></View>
      <View style={styles.overrideCopy}>
        <Text typographyRole="micro" style={[styles.overrideEyebrow, enabled && styles.overrideActionTextActive]}>Manual Override</Text>
        <Text style={[styles.overrideActionText, enabled && styles.overrideActionTextActive]}>{enabled ? `Manual ${plural ? 'targets' : 'target'} active` : `Override ${plural ? 'Targets' : 'Target'}`}</Text>
      </View>
      <Switch
        accessibilityLabel={enabled ? `Remove manual ${plural ? 'target overrides' : 'target override'}` : `Enable manual ${plural ? 'target overrides' : 'target override'}`}
        accessibilityState={{ disabled: !editable }}
        disabled={!editable}
        ios_backgroundColor={SLColors.surfaceDisabled}
        onValueChange={onToggle}
        style={styles.overrideSwitch}
        thumbColor={enabled ? SLColors.warning : SLColors.textMuted}
        trackColor={{ false: SLColors.surfaceDisabled, true: SLColors.warningSoft }}
        value={enabled}
      />
    </View>
  );
}

function FullCustomSetEditor({ draft, editable, onChange }: { draft: CoachMovementDraft; editable: boolean; onChange: (patch: Partial<CoachMovementDraft>) => void }) {
  const updateRow = (index: number, patch: Partial<CoachMovementDraft['plannedSets'][number]>) => {
    onChange({ plannedSets: draft.plannedSets.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) });
  };
  const removeRow = (index: number) => {
    if (draft.plannedSets.length <= 1) return;
    onChange({ plannedSets: draft.plannedSets.filter((_, rowIndex) => rowIndex !== index) });
  };
  const addRow = () => {
    const previous = draft.plannedSets[draft.plannedSets.length - 1];
    onChange({ plannedSets: [...draft.plannedSets, previous ? { ...previous, targetLb: '', rangeLb: '' } : { reps: '5', rpe: '7', pct: '70', targetLb: '', rangeLb: '' }] });
  };
  return (
    <View style={styles.fullCustomEditor}>
      <View style={styles.fullCustomHeader}><Text style={styles.fieldLabel}>Planned sets</Text><Pressable accessibilityRole="button" accessibilityLabel="Add Full Custom set" disabled={!editable} onPress={addRow} style={styles.fullCustomAdd}><Ionicons name="add" size={16} color={palette.violet} /><Text style={styles.fullCustomAddText}>Add Set</Text></Pressable></View>
      {draft.plannedSets.map((row, index) => {
        return <View key={`planned-set-${index}`} style={styles.fullCustomRow}>
          <View style={styles.fullCustomIndex}><Text style={styles.fullCustomIndexText}>{index + 1}</Text></View>
          <LoggerWheelPicker density="compact" columns={[
            { key: 'reps', label: 'Reps', value: row.reps, options: integerWheelOptions(1, 50, row.reps), accessibilityValue: (value) => `${value} reps`, onChange: (reps) => updateRow(index, { reps }), disabled: !editable },
            { key: draft.mode.toLowerCase(), label: draft.mode === 'PCT' ? 'Percent' : 'RPE', value: draft.mode === 'PCT' ? row.pct : row.rpe, options: draft.mode === 'PCT' ? decimalWheelOptions(20, 100, 2.5, row.pct) : decimalWheelOptions(5, 10, 0.5, row.rpe), suffix: draft.mode === 'PCT' ? '%' : undefined, accessibilityValue: (value) => draft.mode === 'PCT' ? `${value} percent` : `${value} RPE`, onChange: (value) => updateRow(index, draft.mode === 'PCT' ? { pct: value } : { rpe: value }), disabled: !editable },
          ]} style={styles.fullCustomWheelGroup} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove Full Custom set ${index + 1}`} accessibilityState={{ disabled: !editable || draft.plannedSets.length <= 1 }} disabled={!editable || draft.plannedSets.length <= 1} onPress={() => removeRow(index)} style={styles.fullCustomRemove}><Ionicons name="remove-circle-outline" size={18} color={palette.red} /></Pressable>
        </View>;
      })}
    </View>
  );
}

function FullCustomOverrideEditor({ draft, editable, onChange, storageUnit, displayUnit, enabled, onEnabledChange }: { draft: CoachMovementDraft; editable: boolean; onChange: (patch: Partial<CoachMovementDraft>) => void; storageUnit: CoachDisplayUnit; displayUnit: CoachDisplayUnit; enabled: boolean; onEnabledChange: (enabled: boolean) => void }) {
  const updateRow = (index: number, patch: Partial<CoachMovementDraft['plannedSets'][number]>) => {
    onChange({ plannedSets: draft.plannedSets.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) });
  };
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nextEnabled = !enabled;
    if (nextEnabled) {
      const fallbackTarget = loadWheelOptions(displayUnit, '')[0] || '0';
      onChange({
        plannedSets: draft.plannedSets.map((row) => row.targetLb ? row : {
          ...row,
          targetLb: convertLoadDisplayValue(fallbackTarget, displayUnit, storageUnit),
          rangeLb: convertLoadDisplayValue('0', displayUnit, storageUnit),
        }),
      });
    }
    onEnabledChange(nextEnabled);
  };
  return <View style={styles.loadStrategyBlock}><ManualOverrideToggle enabled={enabled} editable={editable} onToggle={toggle} plural />{enabled ? <View style={styles.fullCustomOverrideList}>{draft.plannedSets.map((row, index) => {
    const targetDisplay = convertLoadDisplayValue(row.targetLb, storageUnit, displayUnit);
    const marginDisplay = convertLoadDisplayValue(row.rangeLb, storageUnit, displayUnit);
    return <View key={`planned-set-override-${index}`} style={styles.workBlock}><Text typographyRole="bodyStrong" style={styles.workBlockLabel}>Set {index + 1}</Text><LoggerWheelPicker density="compact" columns={[
      { key: 'manual-target', label: `Target (${displayUnit})`, value: targetDisplay, options: loadWheelOptions(displayUnit, targetDisplay), suffix: displayUnit, accessibilityValue: (value) => `${value} ${displayUnit === 'kg' ? 'kilograms' : 'pounds'}`, onChange: (target) => updateRow(index, { targetLb: convertLoadDisplayValue(target, displayUnit, storageUnit) }), disabled: !editable },
      { key: 'manual-margin', label: `Margin ± (${displayUnit})`, value: marginDisplay, options: marginWheelOptions(displayUnit, marginDisplay), suffix: displayUnit, accessibilityValue: (value) => `plus or minus ${value} ${displayUnit === 'kg' ? 'kilograms' : 'pounds'}`, onChange: (margin) => updateRow(index, { rangeLb: convertLoadDisplayValue(margin, displayUnit, storageUnit) }), disabled: !editable },
    ]} /></View>;
  })}</View> : null}</View>;
}

function RecentHistorySection({ item, displayUnit, onOpenHistory }: { item: SessionMovementItem; displayUnit: CoachDisplayUnit; onOpenHistory?: () => void }) {
  const rows = exactAccessoryHistoryRows(item.movement_history);
  const [expanded, setExpanded] = useState(false);
  const latest = rows[0];
  return (
    <View style={styles.quickSection}>
      <View style={styles.sectionHeadingRow}><Text style={styles.fieldLabel}>LAST EXPOSURE</Text>{onOpenHistory ? <Pressable accessibilityRole="button" onPress={onOpenHistory} style={styles.inlineTextAction}><Text style={styles.inlineTextActionLabel}>History</Text></Pressable> : rows.length > 1 ? <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={styles.inlineTextAction}><Text style={styles.inlineTextActionLabel}>{expanded ? 'Close' : 'History'}</Text></Pressable> : null}</View>
      {latest ? <Text style={styles.lastExposureValue}>{historySetText(latest, displayUnit)} · {formatDate(latest.date)}</Text> : <Text style={styles.emptyText}>No previous exact exposure.</Text>}
      {expanded ? <View style={styles.historyList}>{rows.slice(1, 5).map((row, index) => <View key={`${row.date || 'history'}-${index}`} style={styles.historyListRow}><Text style={styles.historyValue}>{historySetText(row, displayUnit)}</Text><Text style={styles.historyDate}>{formatDate(row.date)}</Text></View>)}</View> : null}
    </View>
  );
}

function CoachNotesSection({ value, editable, onChange }: { value: string; editable: boolean; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <View style={styles.quickSection}>
      <View style={styles.sectionHeadingRow}><Text style={styles.fieldLabel}>COACH NOTE</Text>{editable ? <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Done editing Coach Note' : 'Edit Coach Note'} onPress={() => setEditing((current) => !current)} style={styles.inlineTextAction}><Text style={styles.inlineTextActionLabel}>{editing ? 'Done' : 'Edit'}</Text></Pressable> : null}</View>
      {editing ? <TextInput
          accessibilityLabel="Coach Notes"
          autoFocus
          editable={editable}
          multiline
          onChangeText={onChange}
          placeholder="Add movement-specific coaching notes"
          placeholderTextColor={palette.subtle}
          style={styles.coachNotesInput}
          value={value}
        /> : <Pressable accessibilityRole="button" accessibilityLabel="Edit Coach Notes" accessibilityState={{ disabled: !editable }} disabled={!editable} onPress={() => setEditing(true)} style={styles.coachNotesPreview}><Text numberOfLines={2} style={value.trim() ? styles.coachNotesPreviewText : styles.emptyText}>{value.trim() || 'Add movement-specific coaching notes'}</Text></Pressable>}
    </View>
  );
}

function AccessorySessionProgrammingContext({ draft, editable, groupedWith, onChange, onChooseSubstitution }: { draft: CoachMovementDraft; editable: boolean; groupedWith: string[]; onChange: (patch: Partial<CoachMovementDraft>) => void; onChooseSubstitution?: () => void }) {
  const groups = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const approvedNames = draft.approvedSubsText.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  const removeSubstitution = (name: string) => {
    const approvedSubstitutions = draft.approvedSubstitutions.filter((row) => row.movement !== name);
    onChange({
      approvedSubsText: approvedNames.filter((candidate) => candidate !== name).join('\n'),
      approvedSubstitutions,
    });
  };
  return (
    <View style={styles.quickSection}>
      <Text style={styles.fieldLabel}>GROUPED SET</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accessoryContextChoices}>
        {groups.map((group) => {
          const selected = draft.supersetGroup === group;
          return <Pressable key={group || 'none'} accessibilityRole="button" accessibilityState={{ selected, disabled: !editable }} disabled={!editable} onPress={() => onChange({ supersetGroup: group, supersetPosition: group ? (draft.supersetPosition || '1') : '' })} style={[styles.accessoryContextChoice, selected && styles.accessoryContextChoiceSelected, !editable && styles.disabled]}><Text style={[styles.accessoryContextChoiceText, selected && styles.accessoryContextChoiceTextSelected]}>{group || 'None'}</Text></Pressable>;
        })}
      </ScrollView>
      {draft.supersetGroup ? <Text style={styles.groupContextText}><Text style={styles.groupContextLetter}>{draft.supersetGroup}  </Text>{groupedWith.length ? `Grouped with: ${groupedWith[0]}${groupedWith.length > 1 ? ` +${groupedWith.length - 1}` : ''}` : 'Group assigned · add another movement to connect it'}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Manage approved substitutions. ${approvedNames.length} approved`} accessibilityState={{ disabled: !editable || !onChooseSubstitution }} disabled={!editable || !onChooseSubstitution} onPress={onChooseSubstitution} style={({ pressed }) => [styles.compactContextRow, pressed && styles.pressed]}>
        <View style={styles.compactContextCopy}><Text style={styles.fieldLabel}>APPROVED SUBSTITUTIONS</Text><Text numberOfLines={1} style={approvedNames.length ? styles.compactContextValue : styles.emptyText}>{approvedNames.length ? approvedNames.join(' · ') : 'None approved'}</Text></View>
        <Text style={styles.compactContextAction}>{approvedNames.length} approved</Text><Ionicons name="chevron-forward" size={17} color={palette.muted} />
      </Pressable>
      {approvedNames.length ? <View style={styles.substitutionChips}>{approvedNames.map((name) => <Pressable key={name} accessibilityLabel={`Remove ${name} substitution`} accessibilityRole="button" disabled={!editable} onPress={() => removeSubstitution(name)} style={styles.substitutionChip}><Text numberOfLines={1} style={styles.substitutionChipText}>{name}</Text>{editable ? <Ionicons name="close" size={13} color={palette.muted} /> : null}</Pressable>)}</View> : null}
    </View>
  );
}

function MovementDeleteAction({ disabled, onDelete }: { disabled: boolean; onDelete: () => void }) {
  return (
    <View style={styles.movementDeleteSection}>
      <Pressable accessibilityRole="button" accessibilityLabel="Remove Movement" accessibilityState={{ disabled }} disabled={disabled} onPress={onDelete} style={({ pressed }) => [styles.movementDeleteButton, pressed && styles.pressed, disabled && styles.disabled]}>
        <Ionicons name="trash-outline" size={SLIconSize.standard} color={palette.red} />
        <Text typographyRole="buttonLabel" style={styles.movementDeleteText}>Remove Movement</Text>
      </Pressable>
    </View>
  );
}

function MovementIdentityAction({ movement, disabled, onPress }: { movement: string; disabled: boolean; onPress: () => void }) {
  return (
    <View style={styles.movementIdentitySection}>
      <View style={styles.movementIdentityCopy}>
        <Text typographyRole="micro" style={styles.movementIdentityEyebrow}>Selected Movement</Text>
        <Text numberOfLines={2} style={styles.movementIdentityName}>{movement}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Change or swap ${movement}`} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.movementIdentityButton, pressed && styles.pressed, disabled && styles.disabled]}>
        <Ionicons name="swap-horizontal-outline" size={SLIconSize.standard} color={palette.violet} />
        <Text style={styles.movementIdentityButtonText}>Change / Swap</Text>
      </Pressable>
    </View>
  );
}

function MovementActionBar({ safeAreaBottom, dirty, saving, onSave, onDiscard, onDone }: { safeAreaBottom: number; dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; onDone: () => void }) {
  return (
    <View style={[styles.actionBar, { paddingBottom: Math.max(SLSpacing.sm, safeAreaBottom) }]}>
      {!dirty ? <SLButton fullWidth iconLeft="checkmark" label="Done" onPress={onDone} size="md" variant="primary" /> : null}
      {dirty ? <View style={styles.dirtyActions}><View style={styles.discardAction}><SLButton fullWidth iconLeft="arrow-undo-outline" label="Discard Changes" onPress={onDiscard} disabled={saving} size="md" variant="secondary" /></View><View style={styles.saveAction}><SLButton fullWidth iconLeft="checkmark" label={saving ? 'Saving' : 'Save Changes'} loading={saving} onPress={onSave} size="md" variant="primary" /></View></View> : null}
    </View>
  );
}

function SmallButton({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.smallButton, primary && styles.smallButtonPrimary, disabled && styles.disabled]}><Text style={[styles.smallButtonText, primary && styles.smallButtonTextPrimary]}>{label}</Text></Pressable>;
}

function groupedMovementNames(session: SessionWorkspaceDraft, selectedId: number, group: string) {
  const normalizedGroup = group.trim().toUpperCase();
  if (!normalizedGroup) return [];
  return [...session.coreOrder, ...session.accessoryOrder]
    .filter((id) => id !== selectedId && session.movements[id]?.supersetGroup.trim().toUpperCase() === normalizedGroup)
    .map((id) => movementName(session.items[id]))
    .filter(Boolean);
}

function movementAccent(item: SessionMovementItem | null) {
  if (!item) return SLColors.accentViolet;
  const identity = resolveLoggerLiftIdentity(item);
  return identity.key === 'accessory' ? SLColors.accentMagenta : identity.accentColor;
}

function trainingHubSessionStatusColor(value: string) {
  const status = value.trim().toLowerCase();
  if (status === 'draft') return SLColors.review;
  if (status === 'completed' || status === 'logged' || status === 'done') return SLColors.success;
  if (status === 'today' || status === 'in_progress') return SLColors.accentViolet;
  if (status === 'missed' || status === 'past_due' || status === 'incomplete') return SLColors.railDanger;
  return SLColors.warning;
}

function authoritativeDurationLabel(minutes?: number | null, low?: number | null, high?: number | null) {
  const valid = (value?: number | null) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value)) : null;
  const resolvedLow = valid(low);
  const resolvedHigh = valid(high);
  if (resolvedLow != null && resolvedHigh != null) return resolvedLow === resolvedHigh ? `${resolvedLow} min` : `${resolvedLow}–${resolvedHigh} min`;
  const resolvedMinutes = valid(minutes);
  return resolvedMinutes != null ? `${resolvedMinutes} min` : null;
}

function formatWorkspaceDate(value?: string | null) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value || '').trim();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function parseWorkspaceDate(value?: string | null) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function movementName(item: SessionMovementItem) {
  const name = String(item.movement || item.original_movement || liftLabel(item.lift) || 'Movement').trim();
  return name;
}

function draftHasManualOverride(draft: CoachMovementDraft) {
  return Boolean(
    draft.targetLowLb
    || draft.targetHighLb
    || draft.plannedSets.some((row) => Boolean(row.targetLb)),
  );
}

function isCoreVariantItem(item: SessionMovementItem) {
  return String(item.lift || '').trim().toUpperCase() === 'VR';
}

function ensureCoreVariantManualLoad(draft: CoachMovementDraft, displayUnit: CoachDisplayUnit) {
  if (!isCoreVariantDraft(draft) || draftHasManualOverride(draft)) return draft;
  const target = loadWheelOptions(displayUnit, '')[0] || (displayUnit === 'kg' ? '20' : '45');
  const range = storedRangeFromManualTarget(target, '0', displayUnit, displayUnit);
  return { ...draft, targetLowLb: range.low, targetHighLb: range.high };
}

function createSessionWorkspaceDraft({ title, athleteId, scheduledDate, displayUnit, notes, coreItems, accessoryItems }: {
  title: string;
  athleteId?: number | null;
  scheduledDate?: string | null;
  displayUnit: CoachDisplayUnit;
  notes: string;
  coreItems: SessionMovementItem[];
  accessoryItems: SessionMovementItem[];
}): SessionWorkspaceDraft {
  const allItems = [...coreItems, ...accessoryItems];
  const items = Object.fromEntries(allItems.map((item) => [item.id, item]));
  const kinds = Object.fromEntries([
    ...coreItems.map((item) => [item.id, 'core'] as const),
    ...accessoryItems.map((item) => [item.id, 'accessory'] as const),
  ]);
  const movements = Object.fromEntries(allItems.map((item) => {
    const linkedBackdown = String(item.variant || '').toUpperCase() === 'TOP'
      ? allItems.find((candidate) => candidate.parent_item_id === item.id) || null
      : null;
    return [item.id, ensureCoreVariantManualLoad(movementDraftFromItem(item, displayUnit, linkedBackdown), displayUnit)];
  }));
  return {
    title,
    athleteId: athleteId ?? null,
    scheduledDate: String(scheduledDate || '').slice(0, 10),
    displayUnit,
    notes,
    items,
    kinds,
    movements,
    coreOrder: coreItems.map((item) => item.id),
    accessoryOrder: accessoryItems.map((item) => item.id),
  };
}

function cloneSessionWorkspaceDraft(draft: SessionWorkspaceDraft): SessionWorkspaceDraft {
  return {
    ...draft,
    items: Object.fromEntries(Object.entries(draft.items).map(([id, item]) => [id, { ...item }])),
    kinds: { ...draft.kinds },
    movements: Object.fromEntries(Object.entries(draft.movements).map(([id, movement]) => [id, {
      ...movement,
      plannedSets: movement.plannedSets.map((row) => ({ ...row })),
    }])),
    coreOrder: [...draft.coreOrder],
    accessoryOrder: [...draft.accessoryOrder],
  };
}

function convertMovementDraftUnit(draft: CoachMovementDraft, sourceUnit: CoachDisplayUnit, targetUnit: CoachDisplayUnit): CoachMovementDraft {
  if (sourceUnit === targetUnit) return { ...draft, plannedSets: draft.plannedSets.map((row) => ({ ...row })) };
  const convert = (value: string) => convertLoadDisplayValue(value, sourceUnit, targetUnit);
  return {
    ...draft,
    targetLowLb: convert(draft.targetLowLb),
    targetHighLb: convert(draft.targetHighLb),
    backdownTargetLowLb: convert(draft.backdownTargetLowLb),
    backdownTargetHighLb: convert(draft.backdownTargetHighLb),
    plannedSets: draft.plannedSets.map((row) => ({
      ...row,
      targetLb: convert(row.targetLb),
      rangeLb: convert(row.rangeLb),
    })),
  };
}

function sessionWorkspaceSignature(draft: SessionWorkspaceDraft) {
  return JSON.stringify({
    ...draft,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
  });
}

function sessionWorkspaceDraftIsDirty(current: SessionWorkspaceDraft, persisted: SessionWorkspaceDraft) {
  if (current.title.trim() !== persisted.title.trim()
    || current.athleteId !== persisted.athleteId
    || current.scheduledDate !== persisted.scheduledDate
    || current.notes.trim() !== persisted.notes.trim()
    || JSON.stringify(current.coreOrder) !== JSON.stringify(persisted.coreOrder)
    || JSON.stringify(current.accessoryOrder) !== JSON.stringify(persisted.accessoryOrder)) return true;
  const currentIds = [...current.coreOrder, ...current.accessoryOrder].sort((a, b) => a - b);
  const persistedIds = [...persisted.coreOrder, ...persisted.accessoryOrder].sort((a, b) => a - b);
  if (JSON.stringify(currentIds) !== JSON.stringify(persistedIds)) return true;
  return currentIds.some((id) => {
    const currentMovement = current.movements[id];
    const persistedMovement = persisted.movements[id];
    if (!currentMovement || !persistedMovement) return true;
    const comparableCurrent = convertMovementDraftUnit(currentMovement, current.displayUnit, persisted.displayUnit);
    const identityChanged = current.kinds[id] === 'accessory'
      && Number(current.items[id]?.movement_identity?.id || 0) !== Number(persisted.items[id]?.movement_identity?.id || 0);
    return identityChanged || movementDraftIsDirty(comparableCurrent, persistedMovement);
  });
}

function buildSessionWorkspaceSavePlan(current: SessionWorkspaceDraft, persisted: SessionWorkspaceDraft): SessionWorkspaceSavePlan {
  const currentIds = [...current.coreOrder, ...current.accessoryOrder];
  const persistedIds = [...persisted.coreOrder, ...persisted.accessoryOrder];
  const movementUpdates: SessionWorkspaceMovementSave[] = [];
  const movementCreates: SessionWorkspaceMovementSave[] = [];
  currentIds.forEach((id) => {
    const movement = current.movements[id];
    const kind = current.kinds[id];
    const item = current.items[id];
    if (!movement || !kind || !item) return;
    const comparable = persisted.movements[id]
      ? convertMovementDraftUnit(movement, current.displayUnit, persisted.displayUnit)
      : null;
    const identityChanged = kind === 'accessory'
      && Number(item.movement_identity?.id || 0) !== Number(persisted.items[id]?.movement_identity?.id || 0);
    const patch = movementProgrammingPatch(movement, kind, current.displayUnit);
    if (kind === 'accessory' && item.movement_identity?.id) {
      patch.movement_definition_id = item.movement_identity.id;
    }
    if (kind === 'accessory') {
      const persistedSubstitutions = persisted.movements[id]?.approvedSubstitutions || [];
      if (JSON.stringify(movement.approvedSubstitutions) !== JSON.stringify(persistedSubstitutions)) {
        patch.approved_subs = movement.approvedSubstitutions.map((row) => ({
          movement: row.movement,
          movement_definition_id: row.movementDefinitionId,
        }));
      }
    }
    const save: SessionWorkspaceMovementSave = {
      item,
      kind,
      patch,
    };
    if (id < 0 || !persisted.movements[id]) movementCreates.push(save);
    else if (comparable && (identityChanged || movementDraftIsDirty(comparable, persisted.movements[id]))) movementUpdates.push(save);
  });
  return {
    title: current.title.trim(),
    athleteId: current.athleteId,
    scheduledDate: current.scheduledDate,
    displayUnit: current.displayUnit,
    notes: current.notes,
    metadataPatch: {
      ...(current.title.trim() !== persisted.title.trim() ? { title: current.title.trim() } : {}),
      ...(current.athleteId !== persisted.athleteId ? { athleteId: current.athleteId } : {}),
      ...(current.scheduledDate !== persisted.scheduledDate ? { scheduledDate: current.scheduledDate } : {}),
      ...(current.notes.trim() !== persisted.notes.trim() ? { notes: current.notes } : {}),
    },
    movementUpdates,
    movementCreates,
    deletedMovementIds: persistedIds.filter((id) => id > 0 && !currentIds.includes(id)),
    coreOrder: [...current.coreOrder],
    accessoryOrder: [...current.accessoryOrder],
    orderChanged: JSON.stringify(current.coreOrder) !== JSON.stringify(persisted.coreOrder)
      || JSON.stringify(current.accessoryOrder) !== JSON.stringify(persisted.accessoryOrder),
  };
}

function addSessionDraftMovement(
  item: SessionMovementItem,
  kind: MovementKind,
  setDraft: React.Dispatch<React.SetStateAction<SessionWorkspaceDraft>>,
  setSelectedId: React.Dispatch<React.SetStateAction<number | null>>,
) {
  setDraft((current) => {
    const movement = ensureCoreVariantManualLoad(movementDraftFromItem(item, current.displayUnit), current.displayUnit);
    return {
      ...current,
      items: { ...current.items, [item.id]: item },
      kinds: { ...current.kinds, [item.id]: kind },
      movements: { ...current.movements, [item.id]: movement },
      coreOrder: kind === 'core' ? [...current.coreOrder, item.id] : current.coreOrder,
      accessoryOrder: kind === 'accessory' ? [...current.accessoryOrder, item.id] : current.accessoryOrder,
    };
  });
  setSelectedId(item.id);
}

function removeSessionDraftMovement(current: SessionWorkspaceDraft, itemId: number): SessionWorkspaceDraft {
  const childIds = Object.values(current.items).filter((item) => item.parent_item_id === itemId).map((item) => item.id);
  const removed = new Set([itemId, ...childIds]);
  const items = { ...current.items };
  const kinds = { ...current.kinds };
  const movements = { ...current.movements };
  removed.forEach((id) => {
    delete items[id];
    delete kinds[id];
    delete movements[id];
  });
  return {
    ...current,
    items,
    kinds,
    movements,
    coreOrder: current.coreOrder.filter((id) => !removed.has(id)),
    accessoryOrder: current.accessoryOrder.filter((id) => !removed.has(id)),
  };
}

function movementItemWithDraft(item: SessionMovementItem, draft: CoachMovementDraft | undefined, displayUnit: CoachDisplayUnit): SessionMovementItem {
  if (!draft) return item;
  const toKg = (value: string) => {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return displayUnit === 'kg' ? parsed : parsed * KG_PER_LB;
  };
  return {
    ...item,
    movement: draft.movement,
    designation: draft.designation,
    variant: draft.scheme === 'FULL_CUSTOM' ? 'FULL_CUSTOM' : draft.sourceVariant,
    mode: draft.mode,
    sets: Number(draft.sets) || null,
    reps: Number(draft.reps) || null,
    reps_text: draft.repsText,
    rpe_target: Number(draft.rpe) || null,
    pct: Number(draft.pct) || null,
    rir_target: Number(draft.rir) || null,
    coach_prescribed_low_kg: toKg(draft.targetLowLb),
    coach_prescribed_high_kg: toKg(draft.targetHighLb),
    notes: draft.notes,
  };
}

function movementMeta(item: SessionMovementItem, kind: MovementKind) {
  const parts = [];
  if (kind === 'core') {
    if (item.designation) parts.push(humanize(item.designation));
    if (!isCoreVariantItem(item) && item.variant) parts.push(humanize(item.variant === 'BK' ? 'Backdown' : item.variant));
  } else {
    const primary = String(item.movement_identity?.primary_muscle_group || '').trim();
    const secondary = Array.isArray(item.movement_identity?.secondary_muscle_groups)
      ? item.movement_identity.secondary_muscle_groups.map((muscle) => String(muscle || '').trim()).filter(Boolean)
      : [];
    const muscles = [primary, ...secondary].filter(Boolean).slice(0, 2).map(humanize);
    if (muscles.length) parts.push(muscles.join(' · '));
    else parts.push(accessoryMuscleRegion(item).label);
  }
  return parts.filter(Boolean).join(' · ');
}

function prescriptionSummary(item: SessionMovementItem, kind: MovementKind) {
  const sets = numberText(item.sets);
  const reps = kind === 'accessory' ? accessoryRepDisplayText(String(item.reps_text || numberText(item.reps))) : numberText(item.reps);
  const effort = kind === 'accessory'
    ? item.rir_target != null ? `@ ${numberText(item.rir_target)} RIR` : ''
    : isCoreVariantItem(item) ? ''
    : String(item.mode || 'RPE').toUpperCase() === 'PCT'
      ? item.pct != null ? `@ ${numberText(Number(item.pct) <= 1 ? Number(item.pct) * 100 : item.pct)}%` : ''
      : item.rpe_target != null ? `@ ${numberText(item.rpe_target)} RPE` : '';
  return [sets && reps ? `${sets} × ${reps}` : sets || reps, effort].filter(Boolean).join(' ');
}

function draftMovementMeta(draft: CoachMovementDraft, item: SessionMovementItem, kind: MovementKind) {
  if (kind === 'accessory') return movementMeta(item, kind);
  if (isCoreVariantDraft(draft)) return humanize(draft.designation);
  const scheme = draft.scheme === 'TOP_BACKDOWN' ? 'Top + Backdowns' : draft.scheme === 'FULL_CUSTOM' ? 'Full Custom' : 'Straight';
  return [humanize(draft.designation), scheme].filter(Boolean).join(' - ');
}

function expandedLoadPresentation(draft: CoachMovementDraft, calculated: CalculatedLoadResult | null, storageUnit: CoachDisplayUnit, displayUnit: CoachDisplayUnit, manualEnabled: boolean) {
  if (manualEnabled) {
    const manual = manualTargetMarginFromStoredRange(draft.targetLowLb, draft.targetHighLb, storageUnit, displayUnit);
    const target = Number(manual.target);
    const margin = Number(manual.margin);
    if (Number.isFinite(target) && target > 0) {
      return {
        label: 'Manual',
        value: margin > 0 ? `${numberText(target)} ±${numberText(margin)} ${displayUnit}` : `${numberText(target)} ${displayUnit}`,
        manual: true,
      };
    }
  }
  if (calculated?.lowKg != null || calculated?.highKg != null) {
    return {
      label: 'Calculated',
      value: formatLoggerWeightRangeKg(Number(calculated.lowKg ?? calculated.highKg), Number(calculated.highKg ?? calculated.lowKg), displayUnit),
      manual: false,
    };
  }
  return null;
}

function calculatedLoadRequest(item: SessionMovementItem): CalculatedLoadRequest | null {
  const mode = String(item.mode || 'RPE').toUpperCase() === 'PCT' ? 'PCT' : 'RPE';
  const firstPlanned = Array.isArray(item.planned_sets) ? item.planned_sets[0] : null;
  const fullCustom = String(item.variant || '').toUpperCase() === 'FULL_CUSTOM';
  const reps = fullCustom ? String(firstPlanned?.reps || '') : String(item.reps || '');
  const intensityValue = fullCustom
    ? mode === 'PCT' ? firstPlanned?.pct : firstPlanned?.rpe_target ?? firstPlanned?.rpe
    : mode === 'PCT' ? item.pct : item.rpe_target;
  const lift = String(item.lift || '').trim();
  const intensity = String(intensityValue ?? '').trim();
  if (!lift || !intensity || !Number.isFinite(Number(intensity)) || Number(intensity) <= 0) return null;
  return { lift, mode, reps, intensity };
}

function collapsedLoadPresentation(item: SessionMovementItem, kind: MovementKind, calculated: CalculatedLoadResult | null, displayUnit: CoachDisplayUnit) {
  if (kind === 'accessory') return null;
  const manualLow = item.coach_prescribed_low_kg;
  const manualHigh = item.coach_prescribed_high_kg;
  const validManualLow = Number.isFinite(Number(manualLow)) && Number(manualLow) > 0 ? Number(manualLow) : null;
  const validManualHigh = Number.isFinite(Number(manualHigh)) && Number(manualHigh) > 0 ? Number(manualHigh) : null;
  if (validManualLow != null || validManualHigh != null) {
    const lowKg = Number(validManualLow ?? validManualHigh);
    const highKg = Number(validManualHigh ?? validManualLow);
    const targetKg = (lowKg + highKg) / 2;
    const marginKg = Math.abs(highKg - lowKg) / 2;
    const target = displayWeight(targetKg, displayUnit);
    const margin = displayWeight(marginKg, displayUnit);
    return {
      label: 'Manual',
      value: margin > 0 ? `${numberText(target)} ±${numberText(margin)} ${displayUnit}` : `${numberText(target)} ${displayUnit}`,
      manual: true,
    };
  }
  if (calculated?.lowKg != null || calculated?.highKg != null) {
    return {
      label: 'Calculated',
      value: formatLoggerWeightRangeKg(
        Number(calculated.lowKg ?? calculated.highKg),
        Number(calculated.highKg ?? calculated.lowKg),
        displayUnit,
      ),
      manual: false,
    };
  }
  return null;
}

function displayWeight(weightKg: number, displayUnit: CoachDisplayUnit) {
  const converted = displayUnit === 'lb' ? weightKg / KG_PER_LB : weightKg;
  return roundLoggerDisplayWeight(converted, displayUnit);
}

function historySetText(row: MovementHistorySet, displayUnit: CoachDisplayUnit) {
  const load = row.weight_kg != null
    ? `${numberText(displayUnit === 'lb' ? roundToPlate(Number(row.weight_kg) / KG_PER_LB) : roundToHalf(Number(row.weight_kg)))} ${displayUnit}`
    : '';
  const reps = row.reps != null ? `× ${row.reps}` : '';
  const effort = row.rpe != null ? `@ ${numberText(row.rpe)} RPE` : row.rir != null ? `@ ${numberText(row.rir)} RIR` : '';
  return [load, reps, effort].filter(Boolean).join(' ') || 'Logged set';
}

function roundToPlate(value: number) {
  return Math.round(value / 2.5) * 2.5;
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function numberText(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function liftLabel(value?: string | null) {
  return ({ SQ: 'Squat', BN: 'Bench', DL: 'Deadlift', OHP: 'Overhead Press', AX: 'Accessory', ACC: 'Accessory', VR: 'Variant' } as Record<string, string>)[String(value || '').toUpperCase()] || String(value || '');
}

function humanize(value?: string | null) {
  return String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function abbreviatedAthleteName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return value.trim();
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function shouldDefaultToAbbreviatedAthleteName(value: string) {
  const normalized = value.trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts.length > 2 || normalized.length > 20;
}

function formatDate(value?: string | null) {
  if (!value) return 'Previous Session';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  scroll: { flex: 1 },
  content: { paddingTop: 6, paddingBottom: 160 },
  contentEditing: { paddingBottom: 148 },
  contentAccessibility: { paddingBottom: 260 },
  identityCard: { position: 'relative', minHeight: 154, overflow: 'hidden', borderRadius: SLRadius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.lineStrong, backgroundColor: palette.object, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  identityBody: { width: '100%', minWidth: 0, minHeight: 132, flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  identityBodyReflow: { flexWrap: 'wrap' },
  identityAvatarButton: { width: 72, minHeight: 72, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.pill },
  identityPrimary: { flex: 1, minWidth: 0, gap: 6 },
  identityAthleteRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  identityAthleteMeta: { flex: 1, minWidth: 0, gap: 2 },
  identityAthleteNameWrap: { position: 'relative', minWidth: 0 },
  identityAthleteNameMeasure: { position: 'absolute', left: SLIconSize.compact + 5, right: 17, opacity: 0, color: palette.muted, fontFamily: SLFontFamilies.body, fontSize: 16, lineHeight: 22 },
  identityMetaButton: { minHeight: 28, minWidth: 0, justifyContent: 'center', borderRadius: SLRadius.sm },
  identityContext: { width: 108, minHeight: 78, flexShrink: 0, justifyContent: 'flex-start', gap: 4, paddingTop: 2, paddingLeft: 10, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: SLColors.borderHairline },
  identityContextReflow: { width: '100%', flexBasis: '100%', alignSelf: 'stretch', minHeight: 88, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', paddingLeft: 0, paddingTop: 8, borderLeftWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderHairline },
  identitySessionStatus: { minHeight: 40, alignItems: 'flex-start', justifyContent: 'center', gap: 3, paddingBottom: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  identitySessionStatusReflow: { flex: 0, minWidth: 0, borderBottomWidth: 0, paddingBottom: 0 },
  identitySessionStatusLabel: { color: palette.muted, textTransform: 'uppercase', fontFamily: SLFontFamilies.technical, fontSize: 14, lineHeight: 18 },
  identitySessionStatusValue: { fontFamily: SLFontFamilies.sansBold, fontSize: 18, lineHeight: 24 },
  identityDuration: { gap: 1 },
  identityDurationReflow: { flexShrink: 0, alignItems: 'flex-start' },
  identityDurationLabel: { color: palette.muted, textTransform: 'uppercase', fontFamily: SLFontFamilies.technical, fontSize: 14, lineHeight: 18 },
  identityDurationValue: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 18, lineHeight: 24 },
  identityTitle: { width: '100%', color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 22, lineHeight: 28 },
  identityMeta: { flex: 1, minWidth: 0, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 5 },
  identityMetaText: { flex: 1, minWidth: 0, color: palette.muted, fontFamily: SLFontFamilies.body, fontSize: 16, lineHeight: 22 },
  athleteChoices: { gap: 6, paddingVertical: 2, paddingRight: 10 },
  athleteChoice: { minWidth: 116, maxWidth: 190, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 7, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, backgroundColor: SLColors.surfaceFlat },
  athleteChoiceSelected: { borderColor: SLColors.borderSelected, backgroundColor: palette.violetSoft },
  athleteChoiceText: { flexShrink: 1, color: palette.muted },
  athleteChoiceTextSelected: { color: palette.text },
  renameModalLayer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SLLayout.screenGutter, backgroundColor: 'rgba(0,0,0,0.72)' },
  renameModalCard: { width: '100%', maxWidth: 380, overflow: 'hidden', borderRadius: SLRadius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStrong, backgroundColor: SLColors.surfaceMedia, paddingHorizontal: SLSpacing.md, paddingBottom: SLSpacing.md, ...SLShadows.level2 },
  renameModalHeader: { minHeight: SLControlSize.minimumTouchTarget + SLSpacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm },
  renameModalTitle: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 18, lineHeight: 24 },
  renameModalClose: { width: SLControlSize.minimumTouchTarget, height: SLControlSize.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md },
  renameModalInput: { minHeight: 48, color: palette.text, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.lineStrong, borderRadius: SLRadius.md, paddingHorizontal: SLSpacing.md, paddingVertical: SLSpacing.sm, fontFamily: SLFontFamilies.display, fontSize: 16 },
  renameModalActions: { flexDirection: 'row', gap: SLSpacing.sm, paddingTop: SLSpacing.md },
  renameModalAction: { flex: 1, minWidth: 0 },
  datePickerModalLayer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SLLayout.screenGutter, backgroundColor: 'rgba(0,0,0,0.72)' },
  datePickerModalCard: { width: '100%', maxWidth: 380, overflow: 'hidden', borderRadius: SLRadius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStrong, backgroundColor: SLColors.surfaceMedia, paddingHorizontal: SLSpacing.md, paddingBottom: SLSpacing.md, ...SLShadows.level2 },
  datePickerModalHeader: { minHeight: SLControlSize.minimumTouchTarget + SLSpacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm },
  datePickerModalTitle: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 18, lineHeight: 24 },
  datePickerModalClose: { width: SLControlSize.minimumTouchTarget, height: SLControlSize.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md },
  datePickerModalControl: { width: '100%', backgroundColor: SLColors.surfaceMedia },
  lockedReason: { color: palette.red, fontFamily: SLFontFamilies.body, fontSize: 12 },
  setupRegion: { gap: 8, marginBottom: 10 },
  compactSectionLabel: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 12, lineHeight: 16, textTransform: 'uppercase' },
  sessionNotes: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.06)', borderRadius: SLRadius.sm, backgroundColor: 'rgba(8,8,13,0.72)', paddingHorizontal: 12, paddingTop: 0, paddingBottom: 6, gap: 0 },
  sessionNotesHeader: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textButton: { minWidth: 44, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center' },
  textButtonLabel: { color: palette.violet, fontFamily: SLFontFamilies.sansBold, fontSize: 14, lineHeight: 19 },
  sessionNotesPreview: { minHeight: 34, alignItems: 'stretch', justifyContent: 'center', paddingVertical: 4 },
  sessionNotesText: { width: '100%', flexShrink: 1, color: palette.muted, fontSize: 16, lineHeight: 22 },
  sessionNotesInput: { minHeight: 88, color: palette.text, backgroundColor: palette.object, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: 10, padding: 11, textAlignVertical: 'top', fontFamily: SLFontFamilies.body, fontSize: 14 },
  inlineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  smallButton: { minHeight: 44, minWidth: 88, borderRadius: 10, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  smallButtonPrimary: { backgroundColor: palette.violetSoft, borderColor: 'rgba(167,139,250,0.45)' },
  smallButtonText: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 12 },
  smallButtonTextPrimary: { color: palette.violet },
  programmingRegion: { gap: 10 },
  workloadMetric: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.xs, paddingHorizontal: SLSpacing.sm, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, backgroundColor: SLColors.surfaceFlat },
  workloadMetricValue: { color: palette.text, fontFamily: SLFontFamilies.numeric, fontSize: 18, lineHeight: 22 },
  workloadMetricLabel: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 12, lineHeight: 16, textTransform: 'uppercase' },
  sessionToolkit: { position: 'absolute', right: SLLayout.screenGutter, zIndex: 50, elevation: 20, alignItems: 'flex-end' },
  sessionToolkitDismissLayer: { ...StyleSheet.absoluteFillObject, zIndex: 49 },
  sessionToolkitShell: { alignItems: 'flex-end', gap: SLSpacing.sm },
  sessionToolkitPanel: { width: 264, gap: SLSpacing.xs, overflow: 'hidden', padding: SLSpacing.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: SL_TAB_ROW_CONTROL.shellBorderColor, borderRadius: SLRadius.lg, backgroundColor: 'transparent', ...SLShadows.level2 },
  sessionToolkitPanelMaterialClip: { ...StyleSheet.absoluteFillObject, borderRadius: SLRadius.lg, overflow: 'hidden' },
  sessionToolkitMaterial: { ...StyleSheet.absoluteFillObject, backgroundColor: SL_TAB_ROW_CONTROL.translucentFallback },
  sessionToolkitGroup: { width: '100%', gap: 2, zIndex: 1 },
  sessionToolkitSectionHeader: { paddingHorizontal: SLSpacing.sm, paddingTop: SLSpacing.xs, paddingBottom: 2, textTransform: 'uppercase', fontFamily: SLFontFamilies.technical, fontSize: 11, lineHeight: 15, letterSpacing: 0.5 },
  sessionToolkitDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: SLSpacing.xs, backgroundColor: SLColors.borderHairline },
  sessionToolkitLifecycle: { width: '100%', alignItems: 'stretch', gap: 2 },
  sessionToolkitTrigger: { width: SL_TAB_ROW_CONTROL.shellHeight, height: SL_TAB_ROW_CONTROL.shellHeight, alignItems: 'center', justifyContent: 'center', borderWidth: SL_TAB_ROW_CONTROL.shellBorderWidth, borderColor: SL_TAB_ROW_CONTROL.shellBorderColor, borderRadius: SL_TAB_ROW_CONTROL.shellRadius, overflow: 'hidden', ...SLShadows.level2 },
  sessionToolkitTriggerMaterialClip: { ...StyleSheet.absoluteFillObject, borderRadius: SL_TAB_ROW_CONTROL.shellRadius, overflow: 'hidden' },
  sessionToolkitSelectedLens: { ...StyleSheet.absoluteFillObject, borderRadius: SL_TAB_ROW_CONTROL.itemRadius, borderColor: SL_TAB_ROW_CONTROL.indicatorBorderColor, borderWidth: SL_TAB_ROW_CONTROL.indicatorBorderWidth, overflow: 'hidden', ...SLShadows.level1 },
  sessionToolkitTriggerIcon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  sessionToolkitAction: { width: '100%', minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.sm, paddingVertical: SLSpacing.xs, borderRadius: SL_TAB_ROW_CONTROL.itemRadius, zIndex: 1 },
  sessionToolkitActionText: { flex: 1, minWidth: 0, color: SL_TAB_ROW_CONTROL.inactiveColor, fontFamily: SLFontFamilies.sansBold, fontSize: 14, lineHeight: 19 },
  movementOverview: { gap: 12 },
  movementGroup: { gap: 7 },
  movementGroupHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm },
  movementGroupLabel: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 13, lineHeight: 18, textTransform: 'uppercase' },
  movementList: { gap: 7 },
  movementRow: { position: 'relative', minHeight: 124, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', paddingVertical: 12, paddingHorizontal: 12, borderRadius: SLRadius.md, backgroundColor: palette.object, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line },
  movementRowPressed: { backgroundColor: palette.objectRaised },
  movementArtwork: { width: 72, height: 72, zIndex: 2, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  movementTrailing: { width: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  movementArtworkImage: { shadowOpacity: 0.36, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  artworkFallback: { alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, backgroundColor: palette.violetSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(167,139,250,0.25)' },
  movementCopy: { flex: 1, minWidth: 0, gap: 2 },
  movementName: { color: palette.text },
  expandedMovementName: { fontFamily: SLFontFamilies.sansBold, fontSize: 20, lineHeight: 25 },
  movementMeta: { color: palette.muted, textTransform: 'uppercase', fontFamily: SLFontFamilies.technical, fontSize: 13, lineHeight: 18 },
  movementPrescription: { color: palette.text, fontSize: 16, lineHeight: 22 },
  movementLoadRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  movementLoadLabel: { color: SLColors.accentCyanMuted, textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 3, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.accentCyanMuted },
  movementLoadLabelManual: { color: SLColors.warning, borderColor: SLColors.warning },
  movementLoad: { color: SLColors.accentCyanMuted },
  movementLoadManual: { color: SLColors.warning },
  expandedMovementCard: { position: 'relative', overflow: 'hidden', borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: SLColors.surfaceInset },
  expandedMovementHeader: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  expandedMovementArtwork: { width: 64, height: 64, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  expandedMovementCopy: { flex: 1, minWidth: 0, gap: 4 },
  expandedPrescription: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 16, lineHeight: 22 },
  expandedLoad: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 16, lineHeight: 22 },
  expandedEditorBody: { gap: 0, paddingHorizontal: 10, paddingTop: 1, paddingBottom: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard },
  movementIdentitySection: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, paddingVertical: SLSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  movementIdentityCopy: { flex: 1, minWidth: 0, gap: 2 },
  movementIdentityEyebrow: { color: palette.muted, textTransform: 'uppercase' },
  movementIdentityName: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 17, lineHeight: 22 },
  movementIdentityButton: { minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SLSpacing.xs, paddingHorizontal: SLSpacing.sm, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSelected, backgroundColor: palette.violetSoft },
  movementIdentityButtonText: { color: palette.violet, fontFamily: SLFontFamilies.sansBold, fontSize: 13, lineHeight: 18 },
  emptyList: { minHeight: 90, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderStyle: 'dashed', borderRadius: 12 },
  emptyText: { color: palette.muted, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 },
  movementMetaStatusRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm },
  dirtyDot: { width: 6, height: 6, borderRadius: SLRadius.pill, backgroundColor: palette.violet },
  quickSection: { gap: SLSpacing.xs, paddingVertical: SLSpacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  quickSectionTitle: { color: palette.text },
  accessoryContextChoices: { flexDirection: 'row', alignItems: 'center', gap: SLSpacing.xs, paddingVertical: 2 },
  accessoryContextChoice: { minWidth: SLControlSize.minimumTouchTarget, minHeight: SLControlSize.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SLSpacing.sm, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, backgroundColor: SLColors.surfaceFlat },
  accessoryContextChoiceSelected: { borderColor: SLColors.warning, backgroundColor: SLColors.warningSoft },
  accessoryContextChoiceText: { color: palette.muted, fontFamily: SLFontFamilies.sansBold, fontSize: 13, lineHeight: 18 },
  accessoryContextChoiceTextSelected: { color: SLColors.warning },
  groupContextText: { color: palette.muted, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 17 },
  groupContextLetter: { color: SLColors.warning, fontFamily: SLFontFamilies.bodyBold },
  compactContextRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.xs, paddingVertical: SLSpacing.xs },
  compactContextCopy: { flex: 1, minWidth: 0, gap: 3 },
  compactContextValue: { color: palette.text, fontFamily: SLFontFamilies.body, fontSize: 13, lineHeight: 18 },
  compactContextAction: { color: palette.violet, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 12, lineHeight: 17 },
  substitutionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SLSpacing.xs },
  substitutionChip: { maxWidth: '100%', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  substitutionChipText: { maxWidth: 210, color: palette.text, fontFamily: SLFontFamilies.bodyMedium, fontSize: 11, lineHeight: 15 },
  prescriptionChoiceRow: { zIndex: 30, flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.sm, overflow: 'visible' },
  prescriptionChoiceField: { flex: 1, minWidth: 0, gap: SLSpacing.sm },
  programmingStack: { gap: 0 },
  programmingWheelStack: { gap: SLSpacing.sm },
  accessoryPrescriptionEditor: { zIndex: 20, gap: SLSpacing.sm },
  prescriptionSectionLabel: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 10, lineHeight: 14, letterSpacing: 0.65 },
  prescriptionControlRow: { flexDirection: 'row', gap: 6 },
  prescriptionValueControl: { flex: 1, minWidth: 0, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden', borderRadius: SLRadius.md, borderWidth: 1, backgroundColor: SLColors.surfaceMedia },
  prescriptionValueControlSets: { borderColor: 'rgba(168,101,255,0.46)', backgroundColor: 'rgba(105,48,162,0.18)' },
  prescriptionValueControlReps: { borderColor: 'rgba(232,61,154,0.46)', backgroundColor: 'rgba(142,26,92,0.16)' },
  prescriptionValueControlRir: { borderColor: 'rgba(120,170,180,0.48)', backgroundColor: 'rgba(36,102,116,0.18)' },
  prescriptionValueLabel: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 9, lineHeight: 12, letterSpacing: 0.55 },
  prescriptionValue: { maxWidth: '95%', fontFamily: SLFontFamilies.numeric, fontSize: 19, lineHeight: 24 },
  prescriptionValueSets: { color: palette.violet },
  prescriptionValueReps: { color: SLColors.accentMagenta },
  prescriptionValueRir: { color: SLColors.accentCyanMuted },
  prescriptionValueMeta: { maxWidth: '92%', color: palette.muted, fontFamily: SLFontFamilies.bodyMedium, fontSize: 9, lineHeight: 12 },
  prescriptionPickerSheet: { flex: 1, minHeight: 0, paddingHorizontal: SLLayout.screenGutter, paddingBottom: SLSpacing.sm },
  prescriptionPickerTitle: { color: palette.text, fontFamily: SLFontFamilies.display, fontSize: 17, lineHeight: 22, textAlign: 'center', marginBottom: SLSpacing.sm },
  prescriptionPickerAction: { marginTop: 'auto', paddingTop: SLSpacing.sm },
  repModeRow: { flexDirection: 'row', overflow: 'hidden', borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  repModeButton: { flex: 1, minHeight: SLControlSize.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderStandard },
  repModeButtonSelected: { backgroundColor: 'rgba(105,48,162,0.42)' },
  repModeButtonText: { color: palette.muted, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 12, lineHeight: 17 },
  repModeButtonTextSelected: { color: palette.text },
  repRangePicker: { position: 'relative', marginTop: SLSpacing.sm },
  repRangeDash: { position: 'absolute', zIndex: 3, left: '50%', top: 78, width: 24, marginLeft: -12, alignItems: 'center' },
  repRangeDashText: { color: palette.text, fontFamily: SLFontFamilies.numeric, fontSize: 18, lineHeight: 22 },
  amrapState: { minHeight: 174, alignItems: 'center', justifyContent: 'center', gap: SLSpacing.sm, marginTop: SLSpacing.sm, borderRadius: SLRadius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(232,61,154,0.42)', backgroundColor: 'rgba(142,26,92,0.12)' },
  amrapValue: { color: SLColors.accentMagenta, fontFamily: SLFontFamilies.display, fontSize: 27, lineHeight: 34 },
  amrapDetail: { maxWidth: 280, color: palette.muted, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  accessoryRangeControls: { flexDirection: 'row', alignItems: 'stretch', gap: SLSpacing.sm },
  accessoryRangeControlsReflow: { flexDirection: 'column' },
  accessoryRangeCell: { minWidth: 0, overflow: 'hidden', paddingTop: SLSpacing.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, borderRadius: SLRadius.md, backgroundColor: SLColors.surfaceMedia },
  accessoryRangeSetsCell: { flex: 1 },
  accessoryRangeBoundsCell: { flex: 2 },
  accessoryRangeCellReflow: { flex: 0, width: '100%' },
  accessoryRangeLabel: { minHeight: 20, color: palette.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9, textAlign: 'center' },
  accessoryRangeWheels: { position: 'relative' },
  accessoryRangeSeparator: { position: 'absolute', zIndex: 2, top: 52, left: '50%', width: 12, height: 2, marginLeft: -6, borderRadius: SLRadius.pill, backgroundColor: palette.text },
  topBackdownStack: { gap: SLSpacing.md },
  workBlock: { gap: SLSpacing.sm, padding: SLSpacing.sm, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceMedia },
  workBlockLabel: { color: palette.text },
  sectionHeadingRow: { minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm },
  calculatedPanel: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.sm, paddingVertical: SLSpacing.xs, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceMedia },
  calculatedIcon: { width: 38, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.accentCyanMuted, backgroundColor: SLColors.surfaceInset },
  calculatedCopy: { flex: 1, minWidth: 0, gap: 2 },
  calculatedEyebrow: { color: SLColors.accentCyanMuted, fontSize: 12, lineHeight: 16, textTransform: 'uppercase' },
  calculatedValue: { color: palette.text, fontFamily: SLFontFamilies.numeric, fontSize: 19, lineHeight: 24 },
  loadStrategyBlock: { gap: SLSpacing.sm },
  overrideAction: { width: '100%', minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.sm, paddingVertical: SLSpacing.xs, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceMedia },
  overrideActionActive: { borderColor: SLColors.warning, backgroundColor: SLColors.warningSoft },
  overrideIcon: { width: 38, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset },
  overrideIconActive: { borderColor: SLColors.warning },
  overrideCopy: { flex: 1, minWidth: 0, gap: 2 },
  overrideSwitch: { transform: [{ scale: 0.62 }], marginHorizontal: -9 },
  overrideEyebrow: { color: palette.muted, fontSize: 12, lineHeight: 16, textTransform: 'uppercase' },
  overrideActionText: { color: palette.muted, fontFamily: SLTypography.buttonLabel.fontFamily, fontSize: 16, lineHeight: 21 },
  overrideActionTextActive: { color: SLColors.warning },
  manualFields: { width: '100%', gap: SLSpacing.sm },
  directChoiceBlock: { gap: SLSpacing.xs },
  dropdownContainer: { position: 'relative', zIndex: 1 },
  dropdownContainerOpen: { zIndex: 40 },
  dropdownSelector: { minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.md, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceMedia },
  dropdownSelectorOpen: { borderColor: SLColors.borderSelected, borderBottomLeftRadius: SLRadius.sm, borderBottomRightRadius: SLRadius.sm },
  dropdownSelectorText: { flex: 1, minWidth: 0, color: palette.text, fontFamily: SLTypography.bodyStrong.fontFamily, fontSize: 16, lineHeight: 21 },
  dropdownMenu: { position: 'absolute', zIndex: 50, top: 70, left: 0, right: 0, overflow: 'hidden', borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceMedia, ...SLShadows.level2 },
  dropdownMenuItem: { minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.xs, paddingHorizontal: SLSpacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  dropdownMenuItemLast: { borderBottomWidth: 0 },
  dropdownMenuItemSelected: { backgroundColor: SLColors.accentSoft },
  dropdownMenuItemText: { flex: 1, minWidth: 0, color: palette.text, fontFamily: SLTypography.bodyStrong.fontFamily, fontSize: 16, lineHeight: 21 },
  dropdownMenuItemTextSelected: { color: palette.text },
  loadRangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SLSpacing.xs },
  loadRangeSeparator: { minHeight: 44, color: palette.muted, fontFamily: SLFontFamilies.numeric, fontSize: 18, lineHeight: 44 },
  fullCustomEditor: { gap: SLSpacing.sm },
  fullCustomHeader: { minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fullCustomAdd: { minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.xs, paddingHorizontal: SLSpacing.sm },
  fullCustomAddText: { color: palette.violet, fontFamily: SLTypography.buttonLabel.fontFamily, fontSize: SLTypography.buttonLabel.fontSize, lineHeight: SLTypography.buttonLabel.lineHeight },
  fullCustomRow: { position: 'relative', flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.sm, flexWrap: 'wrap', padding: SLSpacing.sm, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceMedia },
  fullCustomIndex: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.sm, backgroundColor: SLColors.surfaceDisabled },
  fullCustomIndexText: { color: palette.text, fontFamily: SLTypography.metadataStrong.fontFamily, fontSize: SLTypography.metadataStrong.fontSize, lineHeight: SLTypography.metadataStrong.lineHeight },
  fullCustomRemove: { position: 'absolute', top: 2, right: 2, width: SLControlSize.minimumTouchTarget, height: SLControlSize.minimumTouchTarget, alignItems: 'center', justifyContent: 'center' },
  fullCustomWheelGroup: { width: '100%' },
  fieldLabel: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 12, lineHeight: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  fullCustomOverrideList: { gap: SLSpacing.sm },
  lastExposureValue: { color: palette.text, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 13, lineHeight: 19 },
  historyList: { gap: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderHairline },
  historyListRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  historyDate: { color: palette.muted, fontFamily: SLTypography.metadata.fontFamily, fontSize: 13, lineHeight: 18 },
  historyValue: { color: palette.text, fontFamily: SLTypography.metadataStrong.fontFamily, fontSize: 15, lineHeight: 20 },
  inlineTextAction: { minWidth: SLControlSize.minimumTouchTarget, minHeight: SLControlSize.minimumTouchTarget, alignItems: 'flex-end', justifyContent: 'center' },
  inlineTextActionLabel: { color: palette.violet, fontFamily: SLTypography.buttonLabel.fontFamily, fontSize: SLTypography.buttonLabel.fontSize, lineHeight: SLTypography.buttonLabel.lineHeight },
  coachNotesPreview: { minHeight: SLControlSize.minimumTouchTarget, justifyContent: 'center', paddingHorizontal: SLSpacing.sm, paddingVertical: SLSpacing.xs, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: '#09090D' },
  coachNotesPreviewText: { color: palette.text, fontFamily: SLTypography.body.fontFamily, fontSize: SLTypography.body.fontSize, lineHeight: SLTypography.body.lineHeight },
  coachNotesInput: { minHeight: 96, borderRadius: SLRadius.md, borderWidth: 1, borderColor: palette.lineStrong, backgroundColor: '#09090D', color: palette.text, padding: SLSpacing.md, textAlignVertical: 'top', fontFamily: SLTypography.body.fontFamily, fontSize: SLTypography.body.fontSize, lineHeight: SLTypography.body.lineHeight },
  movementDeleteSection: { paddingVertical: SLSpacing.sm },
  movementDeleteButton: { minHeight: SLControlSize.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SLSpacing.sm, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(206,135,135,0.28)', backgroundColor: SLColors.surfaceDestructive },
  movementDeleteText: { color: palette.red },
  inlineActionBarLayer: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 4, gap: SLSpacing.sm, paddingHorizontal: GUTTER, paddingTop: SLSpacing.sm, paddingBottom: SLSpacing.sm, backgroundColor: SLColors.surfaceInset, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard, ...SLShadows.level2 },
  dirtyActions: { flexDirection: 'row', gap: SLSpacing.sm },
  discardAction: { flex: 1 },
  saveAction: { flex: 1.1 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.72 },
});
