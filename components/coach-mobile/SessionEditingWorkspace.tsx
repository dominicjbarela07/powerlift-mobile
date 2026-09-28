import { canonicalArtworkInputForLoggerItem } from '@/lib/logger-movement-identity';
import { KeyboardAvoidingView, KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { InlineSessionReorder } from './InlineSessionReorder';
import { AthleteCoachingScratchpadTrigger } from './AthleteCoachingScratchpad';
import { clearAuthoringJournal, readAuthoringJournal, writeAuthoringJournal } from '@/lib/session-authoring-journal';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Animated, BackHandler, Keyboard, LayoutAnimation, Platform, Pressable, RefreshControl, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';

import { SLButton } from '@/components/ui/sl-button';
import { StrengthLedgerBottomSheet, StrengthLedgerBottomSheetScrollView, type StrengthLedgerBottomSheetHandle } from '@/components/sheets/StrengthLedgerBottomSheet';
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
import { ProgrammingLastExposure } from './ProgrammingLastExposure';
import type { SessionExposureContext } from '@/lib/session-exposure-cache';
import { resolveLoggerLiftIdentity } from '@/lib/logger-visual-context';
import { formatLoggerWeightRangeKg, roundLoggerDisplayWeight } from '@/lib/logger-weight-format';
import { setSessionEditorOverlayOpen } from '@/lib/session-editor-overlay-state';
import { programmedSetCountForDraft } from '@/lib/session-programmed-set-count';
import {
  buildSessionWorkspaceMetadataPatch,
  sessionWorkspaceMetadataIsDirty,
} from '@/lib/session-workspace-persistence';
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

type SessionWorkspacePrompt =
  | null
  | { kind: 'message'; title: string; message: string }
  | { kind: 'dirty'; continueAction: () => void }
  | { kind: 'add-movement' }
  | { kind: 'reconcile'; conflictCount: number; onUseLocal: () => void }
  | { kind: 'remove-movement'; itemId: number; movementName: string };

export type MovementHistorySet = {
  weight_kg?: number | null;
  reps?: number | null;
  rir?: number | null;
  rpe?: number | null;
  date?: string | null;
};

export type SessionMovementItem = {
  id: number;
  movement_definition_id?: number | null;
  movement_identity_contract?: number;
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
  selected_sub_movement?: string | null;
  is_substituted?: boolean | null;
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
  backdown_sets?: number | null;
  backdown_reps?: number | null;
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
  effective_movement_identity?: SessionMovementItem['movement_identity'];
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
    id?: number | null;
    key?: string | null;
    display_name?: string | null;
    family?: string | null;
    kind?: string | null;
    loading_implementation?: string | null;
  } | null;
  performed_core_movement?: SessionMovementItem['core_movement'];
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
  baseVersion?: string;
  title: string;
  athleteId: number | null;
  scheduledDate: string;
  notes: string;
  metadataPatch: {
    title?: string;
    athleteId?: number | null;
    scheduledDate?: string;
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
  notes: string;
  items: Record<number, SessionMovementItem>;
  kinds: Record<number, MovementKind>;
  movements: Record<number, CoachMovementDraft>;
  coreOrder: number[];
  accessoryOrder: number[];
};

type Props = {
  exposureContext?: SessionExposureContext;
  entryMode?: 'self' | 'team' | 'workspace';
  programContext?: string;
  returnWeek?: number;
  authoringVersion?: string | null;
  acknowledgedAuthoringVersion?: string | null;
  journalIdentity?: string;
  journalScope?: string;
  onReady?: () => void;
  readyLabel?: string;
  onReuseSession?: () => void;
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
  onOpenReorder: (draft: {
    coreIds: number[];
    accessoryIds: number[];
    coreItems: SessionMovementItem[];
    accessoryItems: SessionMovementItem[];
  }, onApply: (order: { coreIds: number[]; accessoryIds: number[] }) => void) => void;
  onAddMovement?: (displayUnit: CoachDisplayUnit, onAdd: (item: SessionMovementItem, kind: MovementKind) => void) => void;
  onAddCore: (displayUnit: CoachDisplayUnit, onAdd: (item: SessionMovementItem) => void) => void;
  onAddAccessory: (onAdd: (item: SessionMovementItem) => void) => void;
  onChangeAccessory: (item: SessionMovementItem, onChange: (item: SessionMovementItem) => void) => void;
  onOpenMovementHistory?: (item: SessionMovementItem) => void;
  onCalculateLoad: (request: CalculatedLoadRequest) => Promise<CalculatedLoadResult>;
  onDisplayUnitChange: (unit: CoachDisplayUnit) => void;
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
  const draftStorageUnitRef = useRef(displayUnit);
  const draftStorageUnit = draftStorageUnitRef.current;
  const incomingSession = useMemo(
    () => createSessionWorkspaceDraft({ title, athleteId, scheduledDate, storageUnit: draftStorageUnit, notes, coreItems, accessoryItems }),
    [accessoryItems, athleteId, coreItems, draftStorageUnit, notes, scheduledDate, title],
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
  const [groupingIds, setGroupingIds] = useState<number[] | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggingOrder, setDraggingOrder] = useState(false);
  const [toolkitExpanded, setToolkitExpanded] = useState(false);
  const [workspacePrompt, setWorkspacePrompt] = useState<SessionWorkspacePrompt>(null);
  const [calculatedRows, setCalculatedRows] = useState<Record<number, CalculatedLoadResult>>({});
  const listScrollRef = useRef<ScrollView>(null);
  const movementSwipeRefs = useRef<Record<number, Swipeable | null>>({});
  const calculationRevisionRef = useRef(0);
  const acceptIncomingSessionRef = useRef(false);
  const baseVersionRef = useRef(props.authoringVersion || '');
  const [saveFailed, setSaveFailed] = useState(false);
  const [journalReady, setJournalReady] = useState(false);
  const [journalMessage, setJournalMessage] = useState('');
  const scrollYRef = useRef(0);
  type Recovery = { draft: SessionWorkspaceDraft; base: SessionWorkspaceDraft; baseVersion: string; selectedId: number | null; scrollY: number; storageUnit: CoachDisplayUnit };
  useEffect(() => {
    let active = true;
    if (!props.journalIdentity || !props.journalScope || !editable) { setJournalReady(true); return; }
    void readAuthoringJournal<Recovery>(props.journalIdentity, props.journalScope).then((recovery) => {
      if (!active || !recovery || recovery.draft.athleteId !== athleteId || recovery.storageUnit !== draftStorageUnit) return;
      setPersistedSession(recovery.base);
      setSessionDraft(recovery.draft);
      baseVersionRef.current = recovery.baseVersion;
      setSelectedId(recovery.selectedId);
      setJournalMessage(recovery.baseVersion === props.authoringVersion ? 'Restored your local changes.' : 'Restored local changes. The saved Session has changed; review before saving.');
      requestAnimationFrame(() => listScrollRef.current?.scrollTo({ y: recovery.scrollY, animated: false }));
    }).catch(() => { if (active) setJournalMessage('Local recovery is unavailable. Save to keep your changes.'); }).finally(() => { if (active) setJournalReady(true); });
    return () => { active = false; };
  }, [props.journalIdentity, props.journalScope]);


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
    if (!journalReady || savingSession) return;
    if (sessionDirty && !acceptIncomingSessionRef.current) {
      if (props.authoringVersion && props.authoringVersion !== baseVersionRef.current
        && props.acknowledgedAuthoringVersion === props.authoringVersion) {
        const reconciliation = reconcileSessionWorkspaceDraft(sessionDraft, persistedSession, incomingSession);
        if (reconciliation.conflicts.length === 0) {
          setPersistedSession(cloneSessionWorkspaceDraft(incomingSession));
          setSessionDraft(reconciliation.draft);
          baseVersionRef.current = props.authoringVersion;
          setJournalMessage('Your changes are ready on the updated Session.');
        } else {
          setJournalMessage('The saved Session also changed. Reconcile your edits before saving.');
        }
      }
      return;
    }
    const next = cloneSessionWorkspaceDraft(incomingSession);
    setPersistedSession(next);
    setSessionDraft(cloneSessionWorkspaceDraft(next));
    baseVersionRef.current = props.authoringVersion || '';
    acceptIncomingSessionRef.current = false;
  }, [incomingSession, incomingSessionSignature, sessionDirty, journalReady, props.authoringVersion, props.acknowledgedAuthoringVersion, savingSession]);
  const recoveryRef = useRef<Recovery | null>(null);
  recoveryRef.current = sessionDirty && journalReady ? { draft: sessionDraft, base: persistedSession, baseVersion: baseVersionRef.current, selectedId, scrollY: scrollYRef.current, storageUnit: draftStorageUnit } : null;
  useEffect(() => {
    if (!journalReady || !props.journalIdentity || !props.journalScope) return;
    const timer = setTimeout(() => {
      const recovery = recoveryRef.current;
      if (recovery) void writeAuthoringJournal(props.journalIdentity!, props.journalScope!, recovery).catch(() => setJournalMessage('Local recovery is unavailable. Save to keep your changes.'));
    }, 650);
    return () => clearTimeout(timer);
  }, [sessionDraft, selectedId, journalReady, props.journalIdentity, props.journalScope]);
  useEffect(() => () => {
    if (recoveryRef.current && props.journalIdentity && props.journalScope) void writeAuthoringJournal(props.journalIdentity, props.journalScope, recoveryRef.current).catch(() => undefined);
  }, [props.journalIdentity, props.journalScope]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && recoveryRef.current && props.journalIdentity && props.journalScope) {
        void writeAuthoringJournal(props.journalIdentity, props.journalScope, recoveryRef.current).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [props.journalIdentity, props.journalScope]);

  useLayoutEffect(() => {
    setSessionEditorOverlayOpen(true);
    return () => setSessionEditorOverlayOpen(false);
  }, []);
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
    setSaveFailed(false);
    setSessionDraft((current) => ({
      ...current,
      movements: {
        ...current.movements,
        [selectedId]: { ...current.movements[selectedId], ...patch },
      },
    }));
  }, [selectedId]);

  const changeEditorDisplayUnit = useCallback((unit: CoachDisplayUnit) => {
    if (unit === displayUnit || savingSession) return;
    props.onDisplayUnitChange(unit);
  }, [displayUnit, props, savingSession]);

  const discardWorkspaceChanges = useCallback(() => {
    setSessionDraft(cloneSessionWorkspaceDraft(incomingSession));
    setPersistedSession(cloneSessionWorkspaceDraft(incomingSession));
    baseVersionRef.current = props.authoringVersion || '';
    recoveryRef.current = null;
    setSaveFailed(false);
    setJournalMessage('');
    if (props.journalIdentity) void clearAuthoringJournal(props.journalIdentity);
    setRenaming(false);
    setEditingNotes(false);
    setEditingAthlete(false);
    setEditingDate(false);
  }, [incomingSession, props.authoringVersion, props.journalIdentity]);

  const reconcileWorkspaceChanges = useCallback(() => {
    if (!props.authoringVersion || props.authoringVersion === baseVersionRef.current) return;
    const reconciliation = reconcileSessionWorkspaceDraft(sessionDraft, persistedSession, incomingSession);
    const adopt = () => {
      setPersistedSession(cloneSessionWorkspaceDraft(incomingSession));
      setSessionDraft(reconciliation.draft);
      baseVersionRef.current = props.authoringVersion || '';
      setJournalMessage('Your local changes are ready to save.');
      setSaveFailed(false);
    };
    if (reconciliation.conflicts.length) setWorkspacePrompt({ kind: 'reconcile', conflictCount: reconciliation.conflicts.length, onUseLocal: adopt });
    else adopt();
  }, [incomingSession, persistedSession, props.authoringVersion, sessionDraft]);

  const saveWorkspaceChanges = useCallback(async () => {
    if (!sessionDirty || savingSession) return !sessionDirty;
    if (!sessionDraft.title.trim()) {
      setWorkspacePrompt({ kind: 'message', title: 'Session title required', message: 'Enter a Session title before saving.' });
      return false;
    }
    setSavingSession(true);
    setSaveFailed(false);
    acceptIncomingSessionRef.current = true;
    try {
      if (props.journalIdentity && props.journalScope && recoveryRef.current) {
        await writeAuthoringJournal(props.journalIdentity, props.journalScope, recoveryRef.current).catch(() => undefined);
      }
      const success = await props.onSaveSession({ ...buildSessionWorkspaceSavePlan(sessionDraft, persistedSession, draftStorageUnit), baseVersion: baseVersionRef.current });
      if (!success) {
        setSaveFailed(true);
        acceptIncomingSessionRef.current = false;
        return false;
      }
      recoveryRef.current = null;
      setJournalMessage('');
      if (props.journalIdentity) await clearAuthoringJournal(props.journalIdentity).catch(() => undefined);
      // The refreshed server payload owns IDs and the next version.
      acceptIncomingSessionRef.current = true;
      return true;
    } catch {
      setSaveFailed(true);
      acceptIncomingSessionRef.current = false;
      setWorkspacePrompt({ kind: 'message', title: 'Could not save Session', message: 'Your Session edits are still available.' });
      return false;
    } finally {
      setSavingSession(false);
    }
  }, [draftStorageUnit, persistedSession, props, savingSession, sessionDirty, sessionDraft]);

  const resolveDirty = useCallback((action: () => void) => {
    if (Keyboard.isVisible()) { Keyboard.dismiss(); return; }
    if (reordering) { setReordering(false); return; }
    if (!sessionDirty) {
      action();
      return;
    }
    setWorkspacePrompt({ kind: 'dirty', continueAction: action });
  }, [sessionDirty, reordering]);

  const openMovement = useCallback((item: SessionMovementItem) => {
    const nextId = selectedId === item.id ? null : item.id;
    setSelectedId(nextId);
    if (nextId != null) {
      const movement = sessionDraft.movements[nextId];
      const isCore = sessionDraft.coreOrder.includes(nextId);
      setManualOverrideEnabled(Boolean(isCore && movement && (isCoreVariantDraft(movement) || draftHasManualOverride(movement))));
      setBackdownManualOverrideEnabled(Boolean(isCore && (movement?.backdownTargetLowLb || movement?.backdownTargetHighLb)));
    }
  }, [selectedId, sessionDraft.movements, sessionDraft.coreOrder]);

  const collapseMovement = useCallback(() => {
    Keyboard.dismiss();
    setSelectedId(null);
  }, []);

  const addMovement = useCallback(() => {
    Keyboard.dismiss();
    if (props.onAddMovement) props.onAddMovement(displayUnit, (item, kind) => addSessionDraftMovement(item, kind, draftStorageUnit, setSessionDraft, setSelectedId));
    else setWorkspacePrompt({ kind: 'add-movement' });
  }, [props.onAddMovement, displayUnit, draftStorageUnit]);

  const selectAthlete = useCallback((nextAthleteId: number) => {
    setSessionDraft((current) => ({ ...current, athleteId: nextAthleteId }));
    setEditingAthlete(false);
  }, []);

  const selectDate = useCallback((value: Date) => {
    setEditingDate(false);
    const nextDate = toIsoDate(value);
    setSessionDraft((current) => ({ ...current, scheduledDate: nextDate }));
  }, []);

  const deleteSelectedMovement = useCallback(() => {
    if (!selectedItem) return;
    setWorkspacePrompt({ kind: 'remove-movement', itemId: selectedItem.id, movementName: movementName(selectedItem) });
  }, [selectedItem]);

  const requestRemoveMovement = useCallback((item: SessionMovementItem) => {
    setWorkspacePrompt({ kind: 'remove-movement', itemId: item.id, movementName: movementName(item) });
  }, []);

  const closeOtherMovementSwipes = useCallback((openingId: number) => {
    Object.entries(movementSwipeRefs.current).forEach(([id, swipe]) => {
      if (Number(id) !== openingId) swipe?.close();
    });
  }, []);

  const changeSelectedAccessory = useCallback(() => {
    if (!selectedItem || selectedKind !== 'accessory') return;
    props.onChangeAccessory(selectedItem, (replacement) => {
      setSessionDraft((current) => {
        const previous = current.items[replacement.id];
        const previousIdentityId = Number(
          previous?.movement_definition_id
          || previous?.movement_identity?.id
          || 0,
        );
        const replacementIdentityId = Number(
          replacement.movement_definition_id
          || replacement.movement_identity?.id
          || 0,
        );
        const identityChanged = (
          previousIdentityId > 0
          && replacementIdentityId > 0
          && previousIdentityId !== replacementIdentityId
        );
        return {
          ...current,
          items: { ...current.items, [replacement.id]: replacement },
          movements: {
            ...current.movements,
            [replacement.id]: {
              ...current.movements[replacement.id],
              movement: movementName(replacement),
              ...(identityChanged ? {
                approvedSubsText: '',
                approvedSubstitutions: [],
              } : {}),
            },
          },
        };
      });
      setSelectedId(replacement.id);
    });
  }, [props, selectedItem, selectedKind]);

  const chooseApprovedSubstitution = useCallback(() => {
    if (!selectedItem || selectedKind !== 'accessory' || selectedId == null) return;
    props.onChangeAccessory(selectedItem, (choice) => {
      const selectedName = movementName(choice).trim();
      const movementDefinitionId = Number(choice.movement_identity?.id || 0);
      if (!selectedName || !Number.isInteger(movementDefinitionId) || movementDefinitionId <= 0) {
        setWorkspacePrompt({ kind: 'message', title: 'Governed movement required', message: 'Choose a canonical or coach-owned custom movement.' });
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

  const openReorder = useCallback(() => { Keyboard.dismiss(); setSelectedId(null); setReordering(true); }, []);

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
      <View style={authorStyles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Return to selected week" onPress={() => resolveDirty(props.onCloseWorkspace)} style={authorStyles.headerAction}><Ionicons name="chevron-back" size={20} color={palette.violet} /><Text style={authorStyles.link}>Week {props.returnWeek || 1}</Text></Pressable>
        <Text accessibilityLiveRegion="polite" style={[authorStyles.saveState, { color: saveFailed ? palette.red : sessionDirty ? SLColors.accentMagenta : SLColors.success }]}>{savingSession ? 'Saving…' : saveFailed ? 'Couldn’t save' : sessionDirty ? 'Changed locally' : 'Saved'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Session actions" onPress={() => setToolkitExpanded(true)} style={authorStyles.overflow}><Ionicons name="ellipsis-horizontal" size={23} color={palette.text} /></Pressable>
      </View>
      <ScrollView focusClearance={76} scrollEnabled={!draggingOrder} ref={listScrollRef} style={styles.scroll} contentContainerStyle={[styles.content, useAccessibilityReflow && styles.contentAccessibility]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={props.onRefresh} tintColor={palette.muted} />} keyboardShouldPersistTaps="handled" scrollEventThrottle={100} onScroll={(event) => { scrollYRef.current = event.nativeEvent.contentOffset.y; }}>
        <View style={authorStyles.identity}>
          {props.entryMode !== 'self' && athleteName ? <Text style={authorStyles.subject}>{props.entryMode === 'workspace' ? 'ATHLETE WORKSPACE · ' : ''}{athleteName}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Rename Session" disabled={!capabilities.can_rename} onPress={() => { setRenameDraft(sessionDraft.title); setRenaming(true); }}><Text style={authorStyles.title}>{sessionDraft.title}</Text></Pressable>
          <View style={authorStyles.identityLine}><Pressable accessibilityRole="button" accessibilityLabel="Change Session date" disabled={!editable} onPress={() => setEditingDate(true)}><Text style={authorStyles.date}>{formatWorkspaceDate(sessionDraft.scheduledDate)}</Text></Pressable><Text style={authorStyles.lifecycle}>{status.replaceAll('_', ' ')}</Text></View>
          {props.programContext ? <Text style={authorStyles.breadcrumb}>{props.programContext}</Text> : null}
        </View>
        {athleteId && athleteName ? <View style={authorStyles.note}><AthleteCoachingScratchpadTrigger athleteId={athleteId} athleteName={athleteName} variant="inline" /></View> : null}
        {lockedReason ? <Text style={styles.lockedReason}>{lockedReason}</Text> : null}
        {journalMessage ? <Text style={authorStyles.recovery}>{journalMessage}</Text> : null}
        {sessionDirty && props.authoringVersion && baseVersionRef.current !== props.authoringVersion ? <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 5 }}><Text style={authorStyles.recovery}>The saved Session changed. Your local edits are preserved.</Text><Pressable accessibilityRole="button" style={authorStyles.headerAction} onPress={() => { Keyboard.dismiss(); void (async () => { if (recoveryRef.current && props.journalIdentity && props.journalScope) await writeAuthoringJournal(props.journalIdentity, props.journalScope, recoveryRef.current); props.onOpenAthleteView(); })(); }}><Text style={authorStyles.link}>Review saved Session</Text></Pressable><Pressable accessibilityRole="button" style={authorStyles.headerAction} onPress={reconcileWorkspaceChanges}><Text style={authorStyles.link}>Reconcile and retry</Text></Pressable></View> : null}
        <View style={authorStyles.note}>
          {editingNotes ? <><TextInput accessibilityLabel="Session notes" multiline value={sessionDraft.notes} onChangeText={(notes) => setSessionDraft((current) => ({ ...current, notes }))} placeholder="Add Session notes" placeholderTextColor={palette.muted} style={styles.sessionNotesInput} /><SmallButton label="Done" onPress={() => setEditingNotes(false)} primary /></> : <Pressable accessibilityRole="button" disabled={!capabilities.can_edit_session_notes} onPress={() => setEditingNotes(true)} style={authorStyles.noteTrigger}><Ionicons name="document-text-outline" size={19} color={palette.violet} /><Text numberOfLines={2} style={authorStyles.noteText}>{sessionDraft.notes || '+ Session note'}</Text><Ionicons name="chevron-forward" size={16} color={palette.muted} /></Pressable>}
        </View>
        {reordering ? <InlineSessionReorder order={{ coreIds: sessionDraft.coreOrder, accessoryIds: sessionDraft.accessoryOrder }} items={Object.fromEntries(allItems.map((item) => [item.id, movementItemWithDraft(item, sessionDraft.movements[item.id], draftStorageUnit)]))} reduceMotion={reduceMotion} onDragging={setDraggingOrder} onCancel={() => setReordering(false)} onApply={(order) => { setSessionDraft((current) => ({ ...current, coreOrder: order.coreIds, accessoryOrder: order.accessoryIds })); setReordering(false); }} /> : <>
        <View style={authorStyles.movementHeading}><Text style={authorStyles.breadcrumb}>{allItems.length} movements · {totalProgrammedSets} sets</Text>{capabilities.can_reorder && allItems.length > 1 ? <Pressable onPress={openReorder} style={authorStyles.headerAction}><Ionicons name="swap-vertical" size={16} color={palette.violet} /><Text style={authorStyles.link}>Reorder</Text></Pressable> : null}</View>
        <View style={styles.programmingRegion}>
          <View style={styles.movementOverview}>
            {(['core', 'accessory'] as const).map((kind) => {
              const items = kind === 'core' ? currentCoreItems : currentAccessoryItems;
              if (!items.length) return null;
              return (
                <View key={kind} style={styles.movementGroup}>
                  <View style={styles.movementGroupHeader}>
                    <Text style={styles.movementGroupLabel}>{kind === 'core' ? 'Core' : 'Accessories'}</Text>
                  </View>
                  <View style={styles.movementList}>
                    {items.map((item) => item.id === selectedId && draft ? (
                      <InlineMovementWorkspace
                        exposureContext={props.exposureContext ? { ...props.exposureContext, sessionDate: sessionDraft.scheduledDate || props.exposureContext.sessionDate } : undefined}
                        key={item.id}
                        item={item}
                        kind={kind}
                        draft={draft}
                        dirty={movementDraftIsDirty(draft, persistedSession.movements[item.id] || draft)}
                        editable={editable && capabilities.can_edit_movement !== false}
                        storageUnit={draftStorageUnit}
                        displayUnit={displayUnit}
                        calculatedTarget={calculatedTarget}
                        backdownCalculatedTarget={backdownCalculatedTarget}
                        calculatingTarget={calculatingTarget}
                        onCalculateLoad={onCalculateLoad}
                        manualOverrideEnabled={manualOverrideEnabled}
                        backdownManualOverrideEnabled={backdownManualOverrideEnabled}
                        onChange={updateDraft}
                        onManualOverrideEnabledChange={setManualOverrideEnabled}
                        onBackdownManualOverrideEnabledChange={setBackdownManualOverrideEnabled}
                        onChangeMovement={kind === 'accessory' ? changeSelectedAccessory : undefined}
                        onChooseSubstitution={kind === 'accessory' ? chooseApprovedSubstitution : undefined}
                        onOpenHistory={props.onOpenMovementHistory
                          ? () => props.onOpenMovementHistory?.(item)
                          : undefined}
                        onGroupMovements={kind === 'accessory' ? () => setGroupingIds(sessionDraft.accessoryOrder.filter((id) => id === item.id || (!!draft.supersetGroup && sessionDraft.movements[id]?.supersetGroup === draft.supersetGroup))) : undefined}
                        groupedWith={groupedMovementNames(sessionDraft, item.id, draft.supersetGroup)}
                        canDelete={!!capabilities.can_remove_movement}
                        onDelete={deleteSelectedMovement}
                        onCollapse={collapseMovement}
                        accessibilityReflow={useAccessibilityReflow}
                      />
                    ) : (
                      <VisualMovementRow
                        key={item.id}
                        item={movementItemWithDraft(item, sessionDraft.movements[item.id], draftStorageUnit)}
                        kind={kind}
                        pending={pendingMovementId === item.id}
                        onOpen={openMovement}
                        onRequestRemove={editable && capabilities.can_remove_movement ? requestRemoveMovement : undefined}
                        onSwipeOpen={closeOtherMovementSwipes}
                        onSwipeRef={(id, swipe) => { movementSwipeRefs.current[id] = swipe; }}
                        displayUnit={displayUnit}
                        calculatedLoad={calculatedRows[item.id] || null}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
            {!allItems.length ? <View style={authorStyles.empty}><Ionicons name="barbell-outline" size={42} color={palette.muted} /><Text style={authorStyles.emptyTitle}>Add your first movement</Text><SLButton label="Add Movement" onPress={addMovement} />{props.onReuseSession ? <Pressable onPress={() => resolveDirty(() => props.onReuseSession?.())} style={authorStyles.headerAction}><Text style={authorStyles.link}>Reuse a Session</Text><Ionicons name="chevron-forward" size={16} color={palette.violet} /></Pressable> : null}</View> : null}
          </View>

        </View>

        {allItems.length > 0 && capabilities.can_add_movement ? <Pressable accessibilityRole="button" onPress={addMovement} style={authorStyles.addMovement}><Ionicons name="add-circle-outline" size={23} color={palette.violet} /><Text style={authorStyles.link}>Add another movement</Text></Pressable> : null}
        </>}
        {assignmentBlockedReason && allItems.length > 0 ? <Text accessibilityRole="alert" style={styles.lockedReason}>{assignmentBlockedReason}</Text> : null}
      </ScrollView>

      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={authorStyles.toolbarLayer}>
        <View style={[authorStyles.toolbar, { marginBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Add Movement" disabled={!capabilities.can_add_movement || savingSession || reordering} onPress={addMovement} style={authorStyles.toolbarAction}><Ionicons name="add-circle-outline" size={23} color={palette.violet} /><Text style={authorStyles.toolbarLabel}>Add</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Preview saved Session" disabled={capabilities.can_open_athlete_view === false || savingSession} onPress={() => resolveDirty(props.onOpenAthleteView)} style={authorStyles.toolbarAction}><Ionicons name="eye-outline" size={23} color={palette.muted} /><Text style={authorStyles.toolbarLabel}>Preview</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={savingSession || reordering || (!sessionDirty && !props.onReady)} onPress={() => { if (sessionDirty) void saveWorkspaceChanges(); else props.onReady?.(); }} style={[authorStyles.toolbarAction, authorStyles.primaryAction, !sessionDirty && !props.onReady && { opacity: 0.45 }]}>{savingSession ? <ActivityIndicator color={palette.text} /> : <Ionicons name={sessionDirty ? 'save-outline' : props.onReady ? 'play' : 'checkmark'} size={21} color={palette.text} />}<Text style={authorStyles.primaryLabel}>{savingSession ? 'Saving…' : sessionDirty ? saveLabel : props.onReady ? props.readyLabel || 'Assign Session' : 'Saved'}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
      <StrengthLedgerBottomSheet accessibilityLabel="Session actions" visible={toolkitExpanded} onDismiss={() => setToolkitExpanded(false)} onRequestClose={() => setToolkitExpanded(false)}>
        <View style={{ padding: 16, gap: 12 }}><Text style={authorStyles.title}>Session actions</Text>
          {capabilities.can_rename ? <SmallButton label="Rename Session" onPress={() => { setToolkitExpanded(false); setRenameDraft(sessionDraft.title); setRenaming(true); }} /> : null}
          {editable ? <SmallButton label="Change date" onPress={() => { setToolkitExpanded(false); setEditingDate(true); }} /> : null}
          <SmallButton label={`Display in ${displayUnit === 'kg' ? 'lb' : 'kg'}`} onPress={() => changeEditorDisplayUnit(displayUnit === 'kg' ? 'lb' : 'kg')} />
          {sessionDirty ? <SmallButton label="Discard local changes" onPress={() => { setToolkitExpanded(false); resolveDirty(() => undefined); }} /> : null}
          {props.renderLifecycleActions((action) => { setToolkitExpanded(false); guardLifecycle(action); }, sessionDirty)}
        </View>
      </StrengthLedgerBottomSheet>
      <StrengthLedgerBottomSheet visible={groupingIds !== null} accessibilityLabel="Group movements" heightFraction={0.7} onRequestClose={() => setGroupingIds(null)} onDismiss={() => setGroupingIds(null)}>
        <View style={{ flex: 1, paddingHorizontal: 16, gap: 12 }}><Text style={authorStyles.title}>Group movements</Text><Text style={authorStyles.breadcrumb}>Choose the movements performed together.</Text><ScrollView>{sessionDraft.accessoryOrder.map((id) => <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: groupingIds?.includes(id), disabled: id === selectedId }} disabled={id === selectedId} onPress={() => setGroupingIds((ids) => ids?.includes(id) ? ids.filter((value) => value !== id) : [...(ids || []), id])} style={authorStyles.noteTrigger}><Ionicons name={groupingIds?.includes(id) ? 'checkbox' : 'square-outline'} size={24} color={palette.violet} /><Text style={authorStyles.noteText}>{movementName(sessionDraft.items[id])}</Text></Pressable>)}</ScrollView><SLButton label="Apply Group" onPress={() => {
          if (selectedId != null && groupingIds && groupingIds.length > 1) {
            const previous = sessionDraft.movements[selectedId]?.supersetGroup;
            const occupied = new Set(Object.values(sessionDraft.movements).map((movement) => movement.supersetGroup));
            if (!previous && Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)).every((label) => occupied.has(label))) {
              setGroupingIds(null);
              setWorkspacePrompt({ kind: 'message', title: 'Group unavailable', message: 'All group labels are in use. Remove a group before creating another.' });
              return;
            }
          }
          if (selectedId != null && groupingIds) setSessionDraft((current) => {
            const previous = current.movements[selectedId]?.supersetGroup || '';
            const occupied = new Set(Object.values(current.movements).map((movement) => movement.supersetGroup));
            const group = previous || Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)).find((value) => !occupied.has(value)) || '';
            const members = current.accessoryOrder.filter((id) => groupingIds.includes(id));
            const movements = { ...current.movements };
            for (const id of current.accessoryOrder) {
              const member = members.indexOf(id);
              if (member >= 0) movements[id] = { ...movements[id], supersetGroup: members.length > 1 ? group : '', supersetPosition: members.length > 1 ? String(member + 1) : '' };
              else if (previous && movements[id].supersetGroup === previous) movements[id] = { ...movements[id], supersetGroup: '', supersetPosition: '' };
            }
            const positions: Record<string, number> = {};
            for (const id of current.accessoryOrder) {
              const label = movements[id].supersetGroup;
              if (label) {
                const count = current.accessoryOrder.filter((other) => movements[other].supersetGroup === label).length;
                positions[label] = (positions[label] || 0) + 1;
                movements[id] = { ...movements[id], supersetGroup: count > 1 ? label : '', supersetPosition: count > 1 ? String(positions[label]) : '' };
              }
            }
            return { ...current, movements };
          });
          setGroupingIds(null);
        }} /><SmallButton label="Cancel" onPress={() => setGroupingIds(null)} /></View>
      </StrengthLedgerBottomSheet>
      <SessionDatePickerModal scheduledDate={sessionDraft.scheduledDate} visible={editingDate} onDismiss={() => setEditingDate(false)} onSelect={selectDate} />
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

      <SessionWorkspacePromptSheet
        prompt={workspacePrompt}
        saveLabel={saveLabel}
        saving={savingSession}
        onDismiss={() => setWorkspacePrompt(null)}
        onAddCore={() => {
          setWorkspacePrompt(null);
          props.onAddCore(displayUnit, (item) => addSessionDraftMovement(item, 'core', draftStorageUnit, setSessionDraft, setSelectedId));
        }}
        onAddAccessory={() => {
          setWorkspacePrompt(null);
          props.onAddAccessory((item) => addSessionDraftMovement(item, 'accessory', draftStorageUnit, setSessionDraft, setSelectedId));
        }}
        onDiscardAndContinue={(action) => {
          setWorkspacePrompt(null);
          discardWorkspaceChanges();
          action();
        }}
        onRemoveMovement={(itemId) => {
          setWorkspacePrompt(null);
          setSessionDraft((current) => removeSessionDraftMovement(current, itemId));
          setSelectedId(null);
        }}
        onSaveAndContinue={(action) => {
          void saveWorkspaceChanges().then((success) => {
            if (!success) return;
            setWorkspacePrompt(null);
            action();
          });
        }}
      />


    </View>
  );
}

function SessionWorkspacePromptSheet({
  prompt,
  saveLabel,
  saving,
  onDismiss,
  onAddCore,
  onAddAccessory,
  onDiscardAndContinue,
  onRemoveMovement,
  onSaveAndContinue,
}: {
  prompt: SessionWorkspacePrompt;
  saveLabel: string;
  saving: boolean;
  onDismiss: () => void;
  onAddCore: () => void;
  onAddAccessory: () => void;
  onDiscardAndContinue: (action: () => void) => void;
  onRemoveMovement: (itemId: number) => void;
  onSaveAndContinue: (action: () => void) => void;
}) {
  const sheetRef = useRef<StrengthLedgerBottomSheetHandle>(null);
  const close = () => sheetRef.current?.dismiss();
  const title = prompt?.kind === 'dirty'
    ? 'Unsaved Session changes'
    : prompt?.kind === 'reconcile'
      ? 'Review overlapping changes'
    : prompt?.kind === 'add-movement'
      ? 'Add Movement'
      : prompt?.kind === 'remove-movement'
        ? 'Remove movement?'
        : prompt?.title || 'Session Workspace';
  const message = prompt?.kind === 'dirty'
    ? 'Save or discard the current Session changes before continuing.'
    : prompt?.kind === 'reconcile'
      ? `${prompt.conflictCount} parts of this Session changed in both places. Your saved draft remains available. Choose whether your local values should take priority for those parts.`
    : prompt?.kind === 'add-movement'
      ? 'Choose the governed movement category to add.'
      : prompt?.kind === 'remove-movement'
        ? `Remove ${prompt.movementName} and its prescribed Sets from this Session? This change takes effect when you save.`
        : prompt?.kind === 'message'
          ? prompt.message
          : '';

  return (
    <StrengthLedgerBottomSheet
      ref={sheetRef}
      accessibilityLabel={title}
      heightFraction={prompt?.kind === 'add-movement' ? 0.44 : prompt?.kind === 'remove-movement' ? 0.30 : 0.40}
      motionPreset={prompt?.kind === 'remove-movement' ? 'standard' : 'deliberate'}
      onDismiss={onDismiss}
      onRequestClose={close}
      visible={!!prompt}
    >
      <View style={styles.workspacePromptBody}>
        <View style={styles.workspacePromptCopy}>
          <Text style={styles.workspacePromptEyebrow}>Session Workspace</Text>
          <Text style={styles.workspacePromptTitle}>{title}</Text>
          <Text style={styles.workspacePromptMessage}>{message}</Text>
        </View>

        {prompt?.kind === 'add-movement' ? (
          <View style={styles.workspacePromptChoiceRow}>
            <View style={styles.workspacePromptChoice}><SLButton fullWidth label="Core" onPress={onAddCore} size="md" variant="secondary" /></View>
            <View style={styles.workspacePromptChoice}><SLButton fullWidth label="Accessory" onPress={onAddAccessory} size="md" variant="primary" /></View>
          </View>
        ) : null}

        {prompt?.kind === 'dirty' ? (
          <View style={styles.workspacePromptActions}>
            <View style={styles.workspacePromptAction}><SLButton fullWidth disabled={saving} label="Cancel" onPress={close} size="sm" variant="secondary" /></View>
            <View style={styles.workspacePromptAction}><SLButton fullWidth disabled={saving} label="Discard" onPress={() => onDiscardAndContinue(prompt.continueAction)} size="sm" variant="danger" /></View>
            <View style={styles.workspacePromptAction}><SLButton fullWidth disabled={saving} loading={saving} label={saveLabel} onPress={() => onSaveAndContinue(prompt.continueAction)} size="sm" variant="primary" /></View>
          </View>
        ) : null}

        {prompt?.kind === 'reconcile' ? (
          <View style={styles.workspacePromptActions}>
            <View style={styles.workspacePromptAction}><SLButton fullWidth label="Keep editing" onPress={close} size="sm" variant="secondary" /></View>
            <View style={styles.workspacePromptAction}><SLButton fullWidth label="Use my values" onPress={() => { prompt.onUseLocal(); close(); }} size="sm" variant="primary" /></View>
          </View>
        ) : null}

        {prompt?.kind === 'remove-movement' ? (
          <View style={styles.workspacePromptActions}>
            <View style={styles.workspacePromptAction}><SLButton fullWidth label="Cancel" onPress={close} size="sm" variant="secondary" /></View>
            <View style={styles.workspacePromptAction}><SLButton fullWidth label="Remove" onPress={() => onRemoveMovement(prompt.itemId)} size="sm" variant="danger" /></View>
          </View>
        ) : null}

        {prompt?.kind === 'message' ? (
          <SLButton fullWidth label="Close" onPress={close} size="sm" variant="secondary" />
        ) : null}
      </View>
    </StrengthLedgerBottomSheet>
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
  onSelectDate: (date: Date) => void;
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
  const sheetRef = useRef<StrengthLedgerBottomSheetHandle>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const disabled = !draft.trim();
  const close = () => sheetRef.current?.dismiss();
  return (
    <StrengthLedgerBottomSheet
      ref={sheetRef}
      accessibilityLabel="Rename Session"
      heightFraction={0.35}
      motionPreset="deliberate"
      onDismiss={onDismiss}
      onPresent={() => {
        inputRef.current?.focus();
        requestAnimationFrame(() => inputRef.current?.setNativeProps({ selection: { start: 0, end: draft.length } }));
      }}
      onRequestClose={close}
      visible={visible}
    >
      <View style={styles.renameModalLayer}>
        <View accessibilityViewIsModal style={styles.renameModalCard}>
          <View style={styles.renameModalHeader}>
            <Text style={styles.renameModalTitle}>Rename Session</Text>
          </View>
          <TextInput
            accessibilityLabel="Session title"
            ref={inputRef}
            maxLength={120}
            onChangeText={onChange}
            onSubmitEditing={disabled ? undefined : onConfirm}
            returnKeyType="done"
            selectTextOnFocus
            style={styles.renameModalInput}
            value={draft}
          />
          <View style={styles.renameModalActions}>
            <View style={styles.renameModalAction}><SLButton fullWidth label="Cancel" onPress={close} size="sm" variant="secondary" /></View>
            <View style={styles.renameModalAction}><SLButton fullWidth disabled={disabled} label="Rename" onPress={onConfirm} size="sm" variant="primary" /></View>
          </View>
        </View>
      </View>
    </StrengthLedgerBottomSheet>
  );
}

function SessionDatePickerModal({ scheduledDate, visible, onDismiss, onSelect }: { scheduledDate?: string | null; visible: boolean; onDismiss: () => void; onSelect: (date: Date) => void }) {
  const sheetRef = useRef<StrengthLedgerBottomSheetHandle>(null);
  const { height } = useWindowDimensions();
  const selected = parseWorkspaceDate(scheduledDate) || new Date();
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  useEffect(() => {
    if (visible) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  }, [visible, scheduledDate]);
  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const preferredHeight = calendarCells.length === 42 ? 535 : 490;
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Date(2024, 0, 7 + index).toLocaleDateString(undefined, { weekday: 'short' }));
  const close = () => sheetRef.current?.dismiss();
  return (
    <StrengthLedgerBottomSheet
      ref={sheetRef}
      accessibilityLabel="Session Date"
      heightFraction={Math.min(0.72, preferredHeight / height)}
      motionPreset="deliberate"
      onDismiss={onDismiss}
      onRequestClose={close}
      visible={visible}
    >
      <ScrollView contentContainerStyle={styles.datePickerModalLayer} showsVerticalScrollIndicator={false}>
        <View accessibilityViewIsModal style={styles.datePickerModalCard}>
          <View style={styles.datePickerModalHeader}>
            <View><Text style={styles.datePickerModalEyebrow}>PROGRAMMING MANAGER</Text><Text style={styles.datePickerModalTitle}>Change Session Date</Text></View>
          </View>
          <View style={styles.datePickerCalendar}>
            <View style={styles.datePickerMonthHeader}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.datePickerMonthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
              <View style={styles.datePickerMonthActions}>
                {([-1, 1] as const).map((direction) => <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction < 0 ? 'Previous month' : 'Next month'} onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1, 12))} style={({ pressed }) => [styles.datePickerMonthAction, pressed && styles.pressed]}><Ionicons name={direction < 0 ? 'chevron-back' : 'chevron-forward'} size={18} color={palette.text} /></Pressable>)}
              </View>
            </View>
            <View style={styles.datePickerWeekRow}>{weekdayLabels.map((label, index) => <Text key={index} style={styles.datePickerWeekday}>{label}</Text>)}</View>
            <View style={styles.datePickerDays}>{calendarCells.map((day, index) => {
              const isSelected = day != null && selected.getFullYear() === month.getFullYear() && selected.getMonth() === month.getMonth() && selected.getDate() === day;
              return <View key={index} style={styles.datePickerDaySlot}>{day != null ? <Pressable accessibilityRole="button" accessibilityLabel={new Date(month.getFullYear(), month.getMonth(), day, 12).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} accessibilityState={{ selected: isSelected }} onPress={() => onSelect(new Date(month.getFullYear(), month.getMonth(), day, 12))} style={({ pressed }) => [styles.datePickerDay, isSelected && styles.datePickerDaySelected, pressed && !isSelected && styles.datePickerDayPressed]}><Text style={[styles.datePickerDayText, isSelected && styles.datePickerDayTextSelected]}>{day}</Text></Pressable> : null}</View>;
            })}</View>
          </View>
        </View>
      </ScrollView>
    </StrengthLedgerBottomSheet>
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
            {(canAthleteView || canReorder) ? <>
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

function VisualMovementRow({ item, kind, pending, onOpen, onRequestRemove, onSwipeOpen, onSwipeRef, displayUnit, calculatedLoad }: { item: SessionMovementItem; kind: MovementKind; pending: boolean; onOpen: (item: SessionMovementItem) => void; onRequestRemove?: (item: SessionMovementItem) => void; onSwipeOpen: (itemId: number) => void; onSwipeRef: (itemId: number, swipe: Swipeable | null) => void; displayUnit: CoachDisplayUnit; calculatedLoad: CalculatedLoadResult | null }) {
  const load = collapsedLoadPresentation(item, kind, calculatedLoad, displayUnit);
  const swipeRef = useRef<Swipeable>(null);
  const requestRemove = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onRequestRemove?.(item);
    swipeRef.current?.close();
  };
  const row = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[`Edit ${movementName(item)}`, prescriptionSummary(item, kind), load?.label, load?.value].filter(Boolean).join(', ')}
      accessibilityHint={onRequestRemove ? 'Swipe left to request removal.' : undefined}
      accessibilityActions={onRequestRemove ? [{ name: 'remove', label: 'Remove movement' }] : undefined}
      onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'remove') requestRemove(); }}
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.movementRow, item.superset_group && { borderLeftWidth: 2, borderLeftColor: palette.violet }, pressed && styles.movementRowPressed]}
    >
      <View style={styles.movementArtwork}><MovementArtwork item={item} kind={kind} size={__DEV__ ? 64 : 48} /></View>
      <View style={styles.movementCopy}>
        <Text typographyRole="movementTitle" numberOfLines={2} style={styles.movementName}>{movementName(item)}</Text>
        <Text typographyRole="bodyStrong" numberOfLines={2} style={styles.movementPrescription}>{prescriptionSummary(item, kind)}</Text>
        {load ? <View style={styles.movementLoadRow}>{load.label ? <Text typographyRole="micro" style={[styles.movementLoadLabel, load.manual && styles.movementLoadLabelManual]}>{load.label}</Text> : null}<Text typographyRole="bodyStrong" numberOfLines={2} style={[styles.movementLoad, load.manual && styles.movementLoadManual]}>{load.value}</Text></View> : null}
        <Text typographyRole="metadata" numberOfLines={1} style={styles.movementMeta}>{item.superset_group ? `Group ${item.superset_group} · ` : ''}{item.movement_identity?.equipment_type?.replaceAll('_', ' ') || movementMeta(item, kind)}</Text>
      </View>
      <View style={styles.movementTrailing}>{pending ? <ActivityIndicator size="small" color={palette.violet} /> : <Ionicons name="chevron-forward" size={18} color={palette.muted} />}</View>
    </Pressable>
  );
  if (!onRequestRemove) return row;
  return (
    <Swipeable
      ref={(swipe) => { swipeRef.current = swipe; onSwipeRef(item.id, swipe); }}
      friction={1}
      overshootRight={false}
      rightThreshold={58}
      dragOffsetFromRightEdge={8}
      failOffsetY={[-15, 15]}
      onSwipeableWillOpen={() => { onSwipeOpen(item.id); requestRemove(); }}
      renderRightActions={() => (
        <View style={styles.movementSwipeRemove}>
          <Ionicons name="trash-outline" size={20} color={palette.text} />
          <Text style={styles.movementSwipeRemoveText}>Remove</Text>
        </View>
      )}
    >
      {row}
    </Swipeable>
  );
}

function InlineMovementWorkspace({ exposureContext, item, kind, draft, dirty, editable, storageUnit, displayUnit, calculatedTarget, backdownCalculatedTarget, calculatingTarget, onCalculateLoad, manualOverrideEnabled, backdownManualOverrideEnabled, canDelete, groupedWith, onChange, onManualOverrideEnabledChange, onBackdownManualOverrideEnabledChange, onChangeMovement, onChooseSubstitution, onOpenHistory, onDelete, onCollapse, onGroupMovements, accessibilityReflow }: { exposureContext?: SessionExposureContext; item: SessionMovementItem; kind: MovementKind; draft: CoachMovementDraft; dirty: boolean; editable: boolean; storageUnit: CoachDisplayUnit; displayUnit: CoachDisplayUnit; calculatedTarget: CalculatedLoadResult | null; backdownCalculatedTarget: CalculatedLoadResult | null; calculatingTarget: boolean; onCalculateLoad: (request: CalculatedLoadRequest) => Promise<CalculatedLoadResult>; manualOverrideEnabled: boolean; backdownManualOverrideEnabled: boolean; canDelete: boolean; groupedWith: string[]; onChange: (patch: Partial<CoachMovementDraft>) => void; onManualOverrideEnabledChange: (enabled: boolean) => void; onBackdownManualOverrideEnabledChange: (enabled: boolean) => void; onChangeMovement?: () => void; onChooseSubstitution?: () => void; onOpenHistory?: () => void; onDelete: () => void; onCollapse: () => void; onGroupMovements?: () => void; accessibilityReflow: boolean }) {
  const load = kind === 'core'
    ? expandedLoadPresentation(draft, calculatedTarget, storageUnit, displayUnit, manualOverrideEnabled)
    : null;
  return (
    <View accessibilityLabel={`${movementName(item)} expanded movement workspace`} style={styles.expandedMovementCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Collapse ${movementName(item)} editor`} onPress={onCollapse} style={({ pressed }) => [styles.expandedMovementHeader, pressed && styles.pressed]}>
        <View style={styles.expandedMovementArtwork}><MovementArtwork item={item} kind={kind} size={__DEV__ ? 64 : 48} /></View>
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
          workspaceFocused
          movementName={movementName(item)}
          lift={String(item.lift || '')}
          onCalculateLoad={onCalculateLoad}
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
        {kind === 'accessory' ? <AccessorySessionProgrammingContext onGroupMovements={onGroupMovements} draft={draft} editable={editable} groupedWith={groupedWith} onChange={onChange} onChooseSubstitution={onChooseSubstitution} /> : null}
        <ProgrammingLastExposure context={exposureContext} item={item} displayUnit={displayUnit} onOpenHistory={onOpenHistory} />
        <CoachNotesSection value={draft.notes} editable={editable} onChange={(value) => onChange({ notes: value })} />
        <MovementDeleteAction disabled={!canDelete} onDelete={onDelete} />
      </View>
    </View>
  );
}

function MovementArtwork({ item, kind, size }: { item: SessionMovementItem | null; kind: MovementKind; size: number }) {
  const movement = item ? canonicalArtworkInputForLoggerItem({ ...item, item_id: item.id, kind }) : null;
  return <CanonicalMovementArtwork movement={movement} size={size} testID="session-editor-canonical-movement-artwork" />;
}

type PrescriptionDropdownOption = {
  label: string;
  value: string;
};

function CompactDropdownSelector({ label, value, options, open, disabled, hideLabel = false, onOpenChange, onChange }: { label: string; value: string; options: PrescriptionDropdownOption[]; open: boolean; disabled?: boolean; hideLabel?: boolean; onOpenChange: (open: boolean) => void; onChange: (value: string) => void }) {
  const selected = options.find((option) => option.value === value) || options[0];
  return (
    <View
      onTouchStart={(event) => event.stopPropagation()}
      style={[styles.prescriptionChoiceField, styles.dropdownContainer, open && styles.dropdownContainerOpen]}
    >
      {!hideLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label || value}`}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => onOpenChange(!open)}
        style={({ pressed }) => [styles.dropdownSelector, open && styles.dropdownSelectorOpen, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Text numberOfLines={1} style={[styles.dropdownSelectorText, label === 'Set Type' && value === 'TOP_BACKDOWN' && { fontSize: 14 }]}>{selected?.label || value}</Text>
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
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
    setConfirmDiscard(false);
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
    setConfirmDiscard(false);
    setPicker(null);
  };
  const cancelPicker = () => {
    const changed = picker === 'sets' ? setsDraft !== (draft.sets || '3')
      : picker === 'reps' ? accessoryRepTargetText(repDraft) !== accessoryRepTargetText(accessoryRepTargetFromText(draft.repsText))
        : picker === 'rir' ? rirDraft !== (draft.rir || '2') : false;
    if (!changed) { setPicker(null); return; }
    setConfirmDiscard(true);
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
        heightFraction={picker === 'reps' ? (repDraft.mode === 'AMRAP' ? 0.5 : confirmDiscard ? 0.70 : 0.64) : confirmDiscard ? 0.61 : 0.55}
        onDismiss={() => setPicker(null)}
        onRequestClose={cancelPicker}
        visible={picker != null}
      >
        <View style={styles.prescriptionPickerSheet}>
          <Text style={styles.prescriptionPickerTitle}>{picker === 'sets' ? 'SETS' : picker === 'reps' ? 'REP TARGET' : 'RIR'}</Text>
          {picker === 'sets' ? <LoggerWheelPicker density="sheet" columns={[{
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
            {repDraft.mode === 'FIXED' ? <LoggerWheelPicker density="sheet" columns={[{
              key: 'sheet-single-reps', label: 'REPS', value: repDraft.fixed,
              options: integerWheelOptions(1, 50, repDraft.fixed), accessibilityValue: (value) => `${value} reps`, onChange: (fixed) => setRepDraft({ mode: 'FIXED', fixed }),
            }]} /> : repDraft.mode === 'RANGE' ? <LoggerWheelPicker density="sheet" separator="—" columns={[
                { key: 'sheet-min-reps', label: 'MIN REPS', value: repDraft.low, options: integerWheelOptions(1, 50, repDraft.low), accessibilityValue: (value) => `Minimum ${value} reps`, onChange: (low) => setRepDraft(accessoryRepRangeAfterLowerChange(low, repDraft.high)) },
                { key: 'sheet-max-reps', label: 'MAX REPS', value: repDraft.high, options: integerWheelOptions(1, 50, repDraft.high), accessibilityValue: (value) => `Maximum ${value} reps`, onChange: (high) => setRepDraft(accessoryRepRangeAfterUpperChange(repDraft.low, high)) },
              ]} /> : <View style={styles.amrapState}><Text style={styles.amrapValue}>AMRAP</Text><Text style={styles.amrapDetail}>As many quality repetitions as possible. RIR remains an independent target.</Text></View>}
          </> : null}
          {picker === 'rir' ? <LoggerWheelPicker density="sheet" columns={[{
            key: 'sheet-rir', label: '', accessibilityLabel: 'RIR target', value: rirDraft,
            options: decimalWheelOptions(0, 10, 0.5, rirDraft), accessibilityValue: (value) => `${value} RIR`, onChange: setRirDraft,
          }]} /> : null}
          {confirmDiscard ? <View style={workspacePrescriptionStyles.confirmBar}><Text style={workspacePrescriptionStyles.confirmTitle}>Discard these edits?</Text><Text style={workspacePrescriptionStyles.hint}>Changes have not been applied to the Session draft.</Text><View style={workspacePrescriptionStyles.confirmActions}><Pressable accessibilityRole="button" onPress={() => setConfirmDiscard(false)}><Text style={workspacePrescriptionStyles.edit}>Keep Editing</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setConfirmDiscard(false); setPicker(null); }}><Text style={workspacePrescriptionStyles.remove}>Discard</Text></Pressable></View></View> : null}
          <View style={[styles.prescriptionPickerAction, workspacePrescriptionStyles.sheetFooter]}><Pressable accessibilityRole="button" onPress={cancelPicker} style={workspacePrescriptionStyles.cancelButton}><Text style={workspacePrescriptionStyles.cancelText}>Cancel</Text></Pressable><View style={{ flex: 2 }}><SLButton fullWidth label="Apply" onPress={apply} size="lg" variant="primary" /></View></View>
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

export function MovementQuickPrescriptionEditor({ prescriptionOnly = false, workspaceFocused = false, movementName: focusedMovementName, lift, onCalculateLoad, draft, kind, editable, accessibilityReflow, onChange, storageUnit, displayUnit, calculatedTarget, backdownCalculatedTarget, calculatingTarget, manualOverrideEnabled, backdownManualOverrideEnabled, onManualOverrideEnabledChange, onBackdownManualOverrideEnabledChange }: { prescriptionOnly?: boolean; workspaceFocused?: boolean; movementName?: string; lift?: string; onCalculateLoad?: (request: CalculatedLoadRequest) => Promise<CalculatedLoadResult>; draft: CoachMovementDraft; kind: MovementKind; editable: boolean; accessibilityReflow: boolean; onChange: (patch: Partial<CoachMovementDraft>) => void; storageUnit: CoachDisplayUnit; displayUnit: CoachDisplayUnit; calculatedTarget: CalculatedLoadResult | null; backdownCalculatedTarget: CalculatedLoadResult | null; calculatingTarget: boolean; manualOverrideEnabled: boolean; backdownManualOverrideEnabled: boolean; onManualOverrideEnabledChange: (enabled: boolean) => void; onBackdownManualOverrideEnabledChange: (enabled: boolean) => void }) {
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
  if (workspaceFocused && kind === 'core') return <WorkspaceCorePrescription
    draft={draft} editable={editable} onChange={onChange} storageUnit={storageUnit} displayUnit={displayUnit}
    movementName={focusedMovementName || draft.movement} lift={lift || draft.sourceLift} onCalculateLoad={onCalculateLoad}
    calculatedTarget={calculatedTarget} backdownCalculatedTarget={backdownCalculatedTarget} calculatingTarget={calculatingTarget}
  />;
  return (
    <View onTouchStart={() => setOpenDropdown(null)} style={styles.programmingStack}>
      {kind === 'core' ? <View style={[styles.quickSection, styles.prescriptionChoiceRow]}>
        <CompactDropdownSelector
          label="Designation"
          value={draft.designation}
          options={designationOptions}
          open={openDropdown === 'designation'}
          disabled={!editable || prescriptionOnly}
          onOpenChange={(open) => setOpenDropdown(open ? 'designation' : null)}
          onChange={(designation) => onChange({ designation })}
        />
        {!isCoreVariant ? <CompactDropdownSelector
          label="Set Type"
          value={draft.scheme}
          options={schemeOptions}
          open={openDropdown === 'set-type'}
          disabled={!editable || prescriptionOnly || schemeOptions.length < 2}
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
        ) : draft.scheme === 'TOP_BACKDOWN' && draft.sourceVariant !== 'BK' && !prescriptionOnly && kind === 'core' ? (
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

      {kind === 'core' && !isCoreVariant && !prescriptionOnly ? <View style={styles.quickSection}>
        {draft.scheme === 'TOP_BACKDOWN' && draft.sourceVariant !== 'BK' && !prescriptionOnly && kind === 'core' ? (
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
        ) : draft.scheme === 'TOP_BACKDOWN' && draft.sourceVariant !== 'BK' && !prescriptionOnly ? (
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

type WorkspaceFocus = { kind: 'top' | 'backdown' | 'set' | 'straight' | 'variant'; index?: number; original: CoachMovementDraft; staged: CoachMovementDraft };

function workspaceCalculatedText(calculated: CalculatedLoadResult | null, displayUnit: CoachDisplayUnit) {
  const low = calculated?.lowKg ?? calculated?.highKg;
  const high = calculated?.highKg ?? calculated?.lowKg;
  return low != null && high != null ? formatLoggerWeightRangeKg(low, high, displayUnit) : 'Target unavailable';
}

function WorkspaceCorePrescription({ draft, editable, onChange, storageUnit, displayUnit, movementName, lift, onCalculateLoad, calculatedTarget, backdownCalculatedTarget, calculatingTarget }: {
  draft: CoachMovementDraft; editable: boolean; onChange: (patch: Partial<CoachMovementDraft>) => void;
  storageUnit: CoachDisplayUnit; displayUnit: CoachDisplayUnit; movementName: string; lift: string;
  onCalculateLoad?: (request: CalculatedLoadRequest) => Promise<CalculatedLoadResult>;
  calculatedTarget: CalculatedLoadResult | null; backdownCalculatedTarget: CalculatedLoadResult | null; calculatingTarget: boolean;
}) {
  const [openDropdown, setOpenDropdown] = useState<'designation' | 'set-type' | 'intensity' | null>(null);
  const [focus, setFocus] = useState<WorkspaceFocus | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [setTargets, setSetTargets] = useState<Record<number, CalculatedLoadResult | null>>({});
  const [focusTarget, setFocusTarget] = useState<CalculatedLoadResult | null>(null);
  const [focusCalculating, setFocusCalculating] = useState(false);
  const variant = isCoreVariantDraft(draft);
  const setCalculationKey = draft.scheme === 'FULL_CUSTOM' && !variant
    ? JSON.stringify(draft.plannedSets.map((row) => [row.reps, draft.mode === 'PCT' ? row.pct : row.rpe])) : '';
  useEffect(() => {
    if (!setCalculationKey || !onCalculateLoad) { setSetTargets({}); return; }
    let active = true;
    const timer = setTimeout(() => {
      void Promise.all(draft.plannedSets.map(async (row, index) => {
        const intensity = draft.mode === 'PCT' ? row.pct : row.rpe;
        if (!row.reps || !intensity) return [index, null] as const;
        try { return [index, await onCalculateLoad({ lift, mode: draft.mode, reps: row.reps, intensity })] as const; }
        catch { return [index, null] as const; }
      })).then((results) => { if (active) setSetTargets(Object.fromEntries(results)); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [setCalculationKey, lift, onCalculateLoad]);
  const focusKey = focus ? JSON.stringify([focus.kind, focus.index, focus.staged.mode,
    focus.kind === 'set' ? focus.staged.plannedSets[focus.index || 0] : focus.kind === 'backdown'
      ? [focus.staged.backdownReps, focus.staged.backdownPct, focus.staged.backdownRpe]
      : [focus.staged.reps, focus.staged.pct, focus.staged.rpe]]) : '';
  useEffect(() => {
    if (!focus || !onCalculateLoad || focus.kind === 'variant') { setFocusTarget(null); setFocusCalculating(false); return; }
    const staged = focus.staged;
    const row = focus.kind === 'set' ? staged.plannedSets[focus.index || 0] : null;
    const reps = row?.reps ?? (focus.kind === 'backdown' ? staged.backdownReps : staged.reps);
    const intensity = row ? (staged.mode === 'PCT' ? row.pct : row.rpe)
      : focus.kind === 'backdown' ? (staged.mode === 'PCT' ? staged.backdownPct : staged.backdownRpe)
        : (staged.mode === 'PCT' ? staged.pct : staged.rpe);
    if (!reps || !intensity) { setFocusTarget(null); setFocusCalculating(false); return; }
    let active = true;
    setFocusCalculating(true);
    const timer = setTimeout(() => {
      void onCalculateLoad({ lift, mode: staged.mode, reps, intensity })
        .then((result) => { if (active) setFocusTarget(result); })
        .catch(() => { if (active) setFocusTarget(null); })
        .finally(() => { if (active) setFocusCalculating(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [focusKey, lift, onCalculateLoad]);
  const openFocus = (kind: WorkspaceFocus['kind'], index?: number) => {
    if (!editable) return;
    setConfirmDiscard(false);
    setConfirmRemove(false);
    const original = { ...draft, plannedSets: draft.plannedSets.map((row) => ({ ...row })) };
    const staged = { ...original, plannedSets: original.plannedSets.map((row) => ({ ...row })) };
    if (kind === 'variant' && !staged.targetLowLb && !staged.targetHighLb) {
      const initial = storedRangeFromManualTarget(loadWheelOptions(displayUnit, '')[0] || '0', '0', displayUnit, storageUnit);
      staged.targetLowLb = initial.low;
      staged.targetHighLb = initial.high;
      original.targetLowLb = initial.low;
      original.targetHighLb = initial.high;
    }
    setFocus({ kind, index, original, staged });
  };
  const updateFocus = (patch: Partial<CoachMovementDraft>) => setFocus((current) => current ? { ...current, staged: { ...current.staged, ...patch } } : null);
  const updateFocusSet = (patch: Partial<CoachMovementDraft['plannedSets'][number]>) => setFocus((current) => {
    if (!current || current.index == null) return current;
    return { ...current, staged: { ...current.staged, plannedSets: current.staged.plannedSets.map((row, index) => index === current.index ? { ...row, ...patch } : row) } };
  });
  const closeFocus = () => {
    if (!focus) return;
    setConfirmRemove(false);
    if (JSON.stringify(focus.staged) === JSON.stringify(focus.original)) { setFocus(null); return; }
    setConfirmDiscard(true);
  };
  const applyFocus = () => {
    if (!focus) return;
    setConfirmDiscard(false);
    setConfirmRemove(false);
    const s = focus.staged;
    if (focus.kind === 'set') onChange({ plannedSets: s.plannedSets });
    else if (focus.kind === 'backdown') onChange({ backdownSets: s.backdownSets, backdownReps: s.backdownReps,
      backdownRpe: s.backdownRpe, backdownPct: s.backdownPct,
      backdownTargetLowLb: s.backdownTargetLowLb, backdownTargetHighLb: s.backdownTargetHighLb });
    else onChange({ sets: s.sets, reps: s.reps, rpe: s.rpe, pct: s.pct,
      targetLowLb: s.targetLowLb, targetHighLb: s.targetHighLb });
    setFocus(null);
  };
  const manualRange = (value: CoachMovementDraft, kind: WorkspaceFocus['kind']) => kind === 'backdown'
    ? [value.backdownTargetLowLb, value.backdownTargetHighLb] : [value.targetLowLb, value.targetHighLb];
  const targetFor = (value: CoachMovementDraft, kind: WorkspaceFocus['kind'], calculated: CalculatedLoadResult | null, index?: number) => {
    if (kind === 'set') {
      const row = value.plannedSets[index || 0];
      if (row?.targetLb) return { text: `Manual · ${convertLoadDisplayValue(row.targetLb, storageUnit, displayUnit)} ${displayUnit}`, manual: true };
    } else {
      const [low, high] = manualRange(value, kind);
      if (low || high) {
        const manual = manualTargetMarginFromStoredRange(low, high, storageUnit, displayUnit);
        return { text: `Manual · ${manual.target} ${displayUnit}`, manual: true };
      }
    }
    return { text: workspaceCalculatedText(calculated, displayUnit), manual: false };
  };
  const addSet = () => {
    const previous = draft.plannedSets[draft.plannedSets.length - 1];
    onChange({ plannedSets: [...draft.plannedSets, previous ? { ...previous, targetLb: '', rangeLb: '' } : { reps: '5', rpe: '7', pct: '70', targetLb: '', rangeLb: '' }] });
  };
  const focusLabel = focus?.kind === 'set' ? `Set ${(focus.index || 0) + 1} of ${focus.staged.plannedSets.length}`
    : focus?.kind === 'top' ? 'Top Work' : focus?.kind === 'backdown' ? 'Backdown Work'
      : focus?.kind === 'variant' ? 'Manual Load' : 'Load Target';
  const stagedRow = focus?.kind === 'set' ? focus.staged.plannedSets[focus.index || 0] : null;
  const stagedManual = focus ? focus.kind === 'variant' ? true : focus.kind === 'set' ? Boolean(stagedRow?.targetLb)
    : Boolean(manualRange(focus.staged, focus.kind)[0] || manualRange(focus.staged, focus.kind)[1]) : false;
  const changeManual = (enabled: boolean) => {
    if (!focus) return;
    if (!enabled) {
      if (focus.kind === 'set') updateFocusSet({ targetLb: '', rangeLb: '' });
      else if (focus.kind === 'backdown') updateFocus({ backdownTargetLowLb: '', backdownTargetHighLb: '' });
      else updateFocus({ targetLowLb: '', targetHighLb: '' });
      return;
    }
    const fallback = calculatedManualTargetValue(focusTarget, displayUnit) || loadWheelOptions(displayUnit, '')[0] || '0';
    if (focus.kind === 'set') updateFocusSet({ targetLb: convertLoadDisplayValue(fallback, displayUnit, storageUnit), rangeLb: '0' });
    else {
      const range = storedRangeFromManualTarget(fallback, '0', displayUnit, storageUnit);
      if (focus.kind === 'backdown') updateFocus({ backdownTargetLowLb: range.low, backdownTargetHighLb: range.high });
      else updateFocus({ targetLowLb: range.low, targetHighLb: range.high });
    }
  };
  const focusManualValues = focus?.kind === 'set' && stagedRow
    ? { target: convertLoadDisplayValue(stagedRow.targetLb, storageUnit, displayUnit), margin: convertLoadDisplayValue(stagedRow.rangeLb, storageUnit, displayUnit) }
    : focus ? (() => { const [low, high] = manualRange(focus.staged, focus.kind); return manualTargetMarginFromStoredRange(low, high, storageUnit, displayUnit); })()
      : { target: '', margin: '' };
  const changeManualValue = (target: string, margin: string) => {
    if (!focus) return;
    if (focus.kind === 'set') updateFocusSet({ targetLb: convertLoadDisplayValue(target, displayUnit, storageUnit), rangeLb: convertLoadDisplayValue(margin, displayUnit, storageUnit) });
    else {
      const range = storedRangeFromManualTarget(target, margin, displayUnit, storageUnit);
      if (focus.kind === 'backdown') updateFocus({ backdownTargetLowLb: range.low, backdownTargetHighLb: range.high });
      else updateFocus({ targetLowLb: range.low, targetHighLb: range.high });
    }
  };
  return <View style={workspacePrescriptionStyles.stack}>
    <View style={workspacePrescriptionStyles.designationRow}><Text style={workspacePrescriptionStyles.eyebrow}>DESIGNATION</Text><View style={workspacePrescriptionStyles.designationPicker}><CompactDropdownSelector hideLabel label="Designation" value={draft.designation} options={[
      { label: 'None', value: '' }, { label: 'Primary', value: 'PRIMARY' }, { label: 'Secondary', value: 'SECONDARY' },
      { label: 'Tertiary', value: 'TERTIARY' }, { label: 'Quaternary', value: 'QUATERNARY' },
    ]} open={openDropdown === 'designation'} disabled={!editable} onOpenChange={(open) => setOpenDropdown(open ? 'designation' : null)} onChange={(designation) => onChange({ designation })} /></View></View>
    {!variant ? <View style={workspacePrescriptionStyles.selectorRow}>
      <CompactDropdownSelector label="Set Type" value={draft.scheme} options={[
        { label: 'Straight', value: 'STRAIGHT' }, { label: 'Top + Backdowns', value: 'TOP_BACKDOWN' }, { label: 'Full Custom', value: 'FULL_CUSTOM' },
      ]} open={openDropdown === 'set-type'} disabled={!editable} onOpenChange={(open) => setOpenDropdown(open ? 'set-type' : null)} onChange={(scheme) => onChange({ scheme: scheme as CoachMovementDraft['scheme'] })} />
      <CompactDropdownSelector label="Intensity" value={draft.mode} options={[
        { label: 'RPE', value: 'RPE' }, { label: 'Percentage', value: 'PCT' },
      ]} open={openDropdown === 'intensity'} disabled={!editable} onOpenChange={(open) => setOpenDropdown(open ? 'intensity' : null)} onChange={(mode) => onChange({ mode: mode as CoachMovementDraft['mode'] })} />
    </View> : null}
    {variant ? <>
      <Text style={styles.prescriptionSectionLabel}>PRESCRIPTION</Text>
      <LoggerWheelPicker density="compact" columns={[
        { key: 'sets', label: 'Sets', value: draft.sets, options: integerWheelOptions(1, 20, draft.sets), onChange: (sets) => onChange({ sets }), disabled: !editable },
        { key: 'reps', label: 'Reps', value: draft.reps, options: integerWheelOptions(1, 50, draft.reps), onChange: (reps) => onChange({ reps }), disabled: !editable },
      ]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Edit required manual load" disabled={!editable} onPress={() => openFocus('variant')} style={workspacePrescriptionStyles.targetLine}><Text style={workspacePrescriptionStyles.targetValueManual}>{draft.targetLowLb || draft.targetHighLb ? targetFor(draft, 'variant', null).text : 'Manual Load required'}</Text><Text style={workspacePrescriptionStyles.edit}>Edit ›</Text></Pressable>
    </> : draft.scheme === 'STRAIGHT' || draft.sourceVariant === 'BK' ? <>
      <Text style={styles.prescriptionSectionLabel}>PRESCRIPTION</Text>
      <LoggerWheelPicker density="compact" columns={[
        { key: 'sets', label: 'Sets', value: draft.sets, options: integerWheelOptions(1, 20, draft.sets), onChange: (sets) => onChange({ sets }), disabled: !editable },
        { key: 'reps', label: 'Reps', value: draft.reps, options: integerWheelOptions(1, 50, draft.reps), onChange: (reps) => onChange({ reps }), disabled: !editable },
        { key: 'intensity', label: draft.mode === 'PCT' ? 'Percent' : 'RPE', value: draft.mode === 'PCT' ? draft.pct : draft.rpe,
          options: draft.mode === 'PCT' ? decimalWheelOptions(20, 100, 2.5, draft.pct) : decimalWheelOptions(5, 10, 0.5, draft.rpe),
          onChange: (value) => onChange(draft.mode === 'PCT' ? { pct: value } : { rpe: value }), disabled: !editable },
      ]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Edit load target" disabled={!editable} onPress={() => openFocus('straight')} style={workspacePrescriptionStyles.targetLine}>
        <View><Text style={workspacePrescriptionStyles.eyebrow}>{targetFor(draft, 'straight', calculatedTarget).manual ? 'MANUAL TARGET' : 'CALCULATED TARGET'}</Text><Text style={targetFor(draft, 'straight', calculatedTarget).manual ? workspacePrescriptionStyles.targetValueManual : workspacePrescriptionStyles.targetValue}>{calculatingTarget ? 'Calculating…' : targetFor(draft, 'straight', calculatedTarget).text}</Text></View>
        <Text style={workspacePrescriptionStyles.edit}>Override ›</Text>
      </Pressable>
    </> : draft.scheme === 'TOP_BACKDOWN' ? <View style={workspacePrescriptionStyles.blocks}>
      {(['top', 'backdown'] as const).map((kind) => {
        const value = kind === 'top' ? { sets: draft.sets, reps: draft.reps, intensity: draft.mode === 'PCT' ? draft.pct : draft.rpe, calculated: calculatedTarget } : { sets: draft.backdownSets, reps: draft.backdownReps, intensity: draft.mode === 'PCT' ? draft.backdownPct : draft.backdownRpe, calculated: backdownCalculatedTarget };
        const target = targetFor(draft, kind, value.calculated);
        return <Pressable key={kind} accessibilityRole="button" accessibilityLabel={`Edit ${kind === 'top' ? 'Top Work' : 'Backdown Work'}, ${value.sets} sets, ${value.reps} reps`} disabled={!editable} onPress={() => openFocus(kind)} style={({ pressed }) => [workspacePrescriptionStyles.block, pressed && styles.pressed]}>
          <View style={workspacePrescriptionStyles.blockHeader}><Text style={workspacePrescriptionStyles.eyebrow}>{kind === 'top' ? 'TOP WORK' : 'BACKDOWN WORK'}</Text><Text style={workspacePrescriptionStyles.edit}>Edit ›</Text></View>
          <View style={workspacePrescriptionStyles.blockHeader}><Text style={workspacePrescriptionStyles.workValue}>{value.sets} × {value.reps} @ {value.intensity}{draft.mode === 'PCT' ? '%' : ''}</Text><Text numberOfLines={1} style={target.manual ? workspacePrescriptionStyles.targetValueManual : workspacePrescriptionStyles.targetValue}>{calculatingTarget && !target.manual ? 'Calculating…' : target.text}</Text></View>
        </Pressable>;
      })}
    </View> : <View style={workspacePrescriptionStyles.setStack}>
      <View style={workspacePrescriptionStyles.blockHeader}><Text style={workspacePrescriptionStyles.eyebrow}>FULL CUSTOM · {draft.plannedSets.length} {draft.plannedSets.length === 1 ? 'SET' : 'SETS'}</Text><Text style={workspacePrescriptionStyles.hint}>{draft.plannedSets.length ? 'Tap a set' : 'Add a Set to start'}</Text></View>
      {draft.plannedSets.map((row, index) => {
        const target = targetFor(draft, 'set', setTargets[index] || null, index);
        return <Pressable key={`workspace-set-${index}`} accessibilityRole="button" accessibilityLabel={`Edit Set ${index + 1}, ${row.reps} reps`} disabled={!editable} onPress={() => openFocus('set', index)} style={({ pressed }) => [workspacePrescriptionStyles.setRow, pressed && styles.pressed]}>
          <Text style={workspacePrescriptionStyles.setIndex}>{index + 1}</Text><Text style={workspacePrescriptionStyles.workValue}>{row.reps} @ {draft.mode === 'PCT' ? row.pct : row.rpe}{draft.mode === 'PCT' ? '%' : ''}</Text>
          <Text numberOfLines={1} style={target.manual ? workspacePrescriptionStyles.targetValueManual : workspacePrescriptionStyles.targetValue}>{target.text}</Text><Ionicons name="chevron-forward" size={16} color={palette.muted} />
        </Pressable>;
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Add Full Custom set" disabled={!editable} onPress={addSet} style={workspacePrescriptionStyles.addSet}><Ionicons name="add" size={17} color={palette.violet} /><Text style={workspacePrescriptionStyles.edit}>Add Set</Text></Pressable>
    </View>}
    <StrengthLedgerBottomSheet accessibilityLabel={`${focusLabel || 'Prescription'} editor`} visible={focus != null} heightFraction={focus?.kind === 'set' ? (stagedManual ? 0.82 : 0.62) : focus?.kind === 'top' || focus?.kind === 'backdown' ? (stagedManual ? 0.79 : 0.62) : focus?.kind === 'variant' ? 0.48 : stagedManual ? 0.58 : 0.50} onRequestClose={closeFocus} onDismiss={() => setFocus(null)}>
      {focus ? <View style={workspacePrescriptionStyles.sheet}>
        <View style={workspacePrescriptionStyles.sheetHeader}><Text style={workspacePrescriptionStyles.eyebrow}>{movementName.toUpperCase()}</Text><Text style={workspacePrescriptionStyles.sheetTitle}>{focusLabel}</Text><Text style={workspacePrescriptionStyles.hint}>{focus.kind === 'set' ? 'One Set at a time. Set order is preserved.' : 'Adjust only the selected prescription.'}</Text></View>
        <StrengthLedgerBottomSheetScrollView contentContainerStyle={workspacePrescriptionStyles.sheetContent} keyboardShouldPersistTaps="handled">
          {focus.kind !== 'straight' && focus.kind !== 'variant' ? <LoggerWheelPicker density="compact" columns={[
            ...(focus.kind === 'set' ? [] : [{ key: 'sets', label: 'Sets', value: focus.kind === 'backdown' ? focus.staged.backdownSets : focus.staged.sets,
              options: integerWheelOptions(1, 20, focus.kind === 'backdown' ? focus.staged.backdownSets : focus.staged.sets),
              onChange: (sets: string) => updateFocus(focus.kind === 'backdown' ? { backdownSets: sets } : { sets }) }]),
            { key: 'reps', label: 'Reps', value: stagedRow?.reps || (focus.kind === 'backdown' ? focus.staged.backdownReps : focus.staged.reps),
              options: integerWheelOptions(1, 50, stagedRow?.reps || (focus.kind === 'backdown' ? focus.staged.backdownReps : focus.staged.reps)),
              onChange: (reps: string) => focus.kind === 'set' ? updateFocusSet({ reps }) : updateFocus(focus.kind === 'backdown' ? { backdownReps: reps } : { reps }) },
            { key: 'intensity', label: focus.staged.mode === 'PCT' ? 'Percent' : 'RPE',
              value: stagedRow ? (focus.staged.mode === 'PCT' ? stagedRow.pct : stagedRow.rpe) : focus.kind === 'backdown' ? (focus.staged.mode === 'PCT' ? focus.staged.backdownPct : focus.staged.backdownRpe) : (focus.staged.mode === 'PCT' ? focus.staged.pct : focus.staged.rpe),
              options: focus.staged.mode === 'PCT' ? decimalWheelOptions(20, 100, 2.5, stagedRow?.pct || (focus.kind === 'backdown' ? focus.staged.backdownPct : focus.staged.pct)) : decimalWheelOptions(5, 10, 0.5, stagedRow?.rpe || (focus.kind === 'backdown' ? focus.staged.backdownRpe : focus.staged.rpe)),
              onChange: (value: string) => focus.kind === 'set' ? updateFocusSet(focus.staged.mode === 'PCT' ? { pct: value } : { rpe: value }) : updateFocus(focus.kind === 'backdown' ? (focus.staged.mode === 'PCT' ? { backdownPct: value } : { backdownRpe: value }) : (focus.staged.mode === 'PCT' ? { pct: value } : { rpe: value })) },
          ]} /> : null}
          {focus.kind !== 'variant' ? <View style={workspacePrescriptionStyles.calculatedBox}><Text style={workspacePrescriptionStyles.eyebrow}>CALCULATED TARGET · {focusLabel?.toUpperCase()}</Text><Text style={workspacePrescriptionStyles.targetValue}>{focusCalculating ? 'Calculating…' : workspaceCalculatedText(focusTarget, displayUnit)}</Text></View> : null}
          <View style={workspacePrescriptionStyles.manualRow}><Text style={workspacePrescriptionStyles.manualLabel}>{focus.kind === 'variant' ? 'Manual target required' : focus.kind === 'set' ? `Manual target for Set ${(focus.index || 0) + 1}` : 'Manual target override'}</Text>{focus.kind === 'variant' ? <Text style={workspacePrescriptionStyles.targetValueManual}>REQUIRED</Text> : <Switch value={stagedManual} onValueChange={changeManual} trackColor={{ false: SLColors.surfaceDisabled, true: SLColors.warningSoft }} thumbColor={stagedManual ? SLColors.warning : SLColors.textMuted} />}</View>
          {stagedManual || focus.kind === 'variant' ? <LoggerWheelPicker density="compact" columns={[
            { key: 'manual-target', label: `Target (${displayUnit})`, value: focusManualValues.target, options: loadWheelOptions(displayUnit, focusManualValues.target), onChange: (target) => changeManualValue(target, focusManualValues.margin) },
            { key: 'manual-margin', label: `Margin ± (${displayUnit})`, value: focusManualValues.margin, options: marginWheelOptions(displayUnit, focusManualValues.margin), onChange: (margin) => changeManualValue(focusManualValues.target, margin) },
          ]} /> : null}
          {focus.kind === 'set' ? <View style={workspacePrescriptionStyles.setActions}>
            <Pressable accessibilityRole="button" disabled={focus.staged.plannedSets.length <= 1} onPress={() => setConfirmRemove(true)}><Text style={workspacePrescriptionStyles.remove}>Remove Set</Text></Pressable>
            <View style={workspacePrescriptionStyles.moveActions}><Pressable accessibilityRole="button" accessibilityLabel="Move Set up" disabled={(focus.index || 0) === 0} onPress={() => setFocus((current) => { if (!current || current.index == null || current.index === 0) return current; const rows = [...current.staged.plannedSets]; [rows[current.index - 1], rows[current.index]] = [rows[current.index], rows[current.index - 1]]; return { ...current, index: current.index - 1, staged: { ...current.staged, plannedSets: rows } }; })}><Text style={workspacePrescriptionStyles.edit}>↑ Move</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Move Set down" disabled={(focus.index || 0) >= focus.staged.plannedSets.length - 1} onPress={() => setFocus((current) => { if (!current || current.index == null || current.index >= current.staged.plannedSets.length - 1) return current; const rows = [...current.staged.plannedSets]; [rows[current.index + 1], rows[current.index]] = [rows[current.index], rows[current.index + 1]]; return { ...current, index: current.index + 1, staged: { ...current.staged, plannedSets: rows } }; })}><Text style={workspacePrescriptionStyles.edit}>Move ↓</Text></Pressable></View>
          </View> : null}
          {focus.kind === 'set' && focus.staged.plannedSets.length > 1 ? <View style={workspacePrescriptionStyles.setNavigation}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous Set" disabled={(focus.index || 0) === 0} onPress={() => setFocus((current) => current && current.index != null && current.index > 0 ? { ...current, index: current.index - 1 } : current)}><Text style={workspacePrescriptionStyles.edit}>‹ Set {(focus.index || 0)}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Next Set" disabled={(focus.index || 0) >= focus.staged.plannedSets.length - 1} onPress={() => setFocus((current) => current && current.index != null && current.index < current.staged.plannedSets.length - 1 ? { ...current, index: current.index + 1 } : current)}><Text style={workspacePrescriptionStyles.edit}>Set {(focus.index || 0) + 2} ›</Text></Pressable>
          </View> : null}
        </StrengthLedgerBottomSheetScrollView>
        {confirmRemove ? <View style={workspacePrescriptionStyles.confirmBar}><Text style={workspacePrescriptionStyles.confirmTitle}>Remove this Set?</Text><Text style={workspacePrescriptionStyles.hint}>The local Session draft changes when you apply.</Text><View style={workspacePrescriptionStyles.confirmActions}><Pressable accessibilityRole="button" onPress={() => setConfirmRemove(false)}><Text style={workspacePrescriptionStyles.edit}>Keep Set</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setFocus((current) => current ? { ...current, staged: { ...current.staged, plannedSets: current.staged.plannedSets.filter((_, index) => index !== current.index) }, index: Math.max(0, Math.min((current.index || 0), current.staged.plannedSets.length - 2)) } : null); setConfirmRemove(false); }}><Text style={workspacePrescriptionStyles.remove}>Remove Set</Text></Pressable></View></View> : null}
        {confirmDiscard ? <View style={workspacePrescriptionStyles.confirmBar}><Text style={workspacePrescriptionStyles.confirmTitle}>Discard these edits?</Text><Text style={workspacePrescriptionStyles.hint}>Changes have not been applied to the Session draft.</Text><View style={workspacePrescriptionStyles.confirmActions}><Pressable accessibilityRole="button" onPress={() => setConfirmDiscard(false)}><Text style={workspacePrescriptionStyles.edit}>Keep Editing</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setConfirmDiscard(false); setFocus(null); }}><Text style={workspacePrescriptionStyles.remove}>Discard</Text></Pressable></View></View> : null}
        <View style={workspacePrescriptionStyles.sheetFooter}><Pressable accessibilityRole="button" onPress={closeFocus} style={workspacePrescriptionStyles.cancelButton}><Text style={workspacePrescriptionStyles.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" onPress={applyFocus} style={workspacePrescriptionStyles.applyButton}><Text style={workspacePrescriptionStyles.applyText}>Apply{focus.kind === 'top' ? ' to Top Work' : focus.kind === 'backdown' ? ' to Backdown Work' : focus.kind === 'set' ? ' Set Changes' : ''}</Text></Pressable></View>
      </View> : null}
    </StrengthLedgerBottomSheet>
  </View>;
}

const workspacePrescriptionStyles = StyleSheet.create({
  stack: { gap: 12 }, designationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, designationPicker: { width: 180, maxWidth: '62%' }, selectorRow: { flexDirection: 'row', gap: 8 }, blocks: { gap: 9 },
  block: { borderWidth: 1, borderColor: '#392C43', borderRadius: 11, backgroundColor: '#0A0910', padding: 12, gap: 9 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { color: '#ACA0B8', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  edit: { color: SLColors.accentViolet, fontSize: 12, fontWeight: '700' },
  workValue: { color: SLColors.textPrimary, fontSize: 16, fontWeight: '700' },
  targetValue: { color: SLColors.accentCyanMuted, fontSize: 12, fontWeight: '700', flexShrink: 1, marginLeft: 'auto', textAlign: 'right' },
  targetValueManual: { color: SLColors.warning, fontSize: 12, fontWeight: '700', flexShrink: 1, marginLeft: 'auto', textAlign: 'right' },
  hint: { color: palette.muted, fontSize: 11 }, targetLine: { borderTopWidth: 1, borderColor: '#302738', paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  setStack: { gap: 2 }, setRow: { minHeight: 50, borderBottomWidth: 1, borderColor: '#302537', flexDirection: 'row', alignItems: 'center', gap: 8 },
  setIndex: { width: 24, color: '#BDA9D1', fontSize: 13, fontWeight: '700' },
  addSet: { marginTop: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: '#704F8F', borderRadius: 10, padding: 10, flexDirection: 'row', gap: 5, justifyContent: 'center', alignItems: 'center' },
  sheet: { flex: 1, minHeight: 0 }, sheetHeader: { paddingHorizontal: 20, paddingBottom: 12, gap: 4 },
  sheetTitle: { color: SLColors.textPrimary, fontSize: 24, fontWeight: '800' }, sheetContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  calculatedBox: { borderWidth: 1, borderColor: '#29424A', borderRadius: 12, backgroundColor: '#0A1115', padding: 13, gap: 7 },
  manualRow: { borderWidth: 1, borderColor: '#392C43', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manualLabel: { color: SLColors.textPrimary, fontSize: 14, fontWeight: '600' },
  setActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, moveActions: { flexDirection: 'row', gap: 18 }, setNavigation: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }, remove: { color: SLColors.warning, fontSize: 12, fontWeight: '700' },
  sheetFooter: { borderTopWidth: 1, borderColor: '#382443', flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  confirmBar: { marginHorizontal: 16, borderWidth: 1, borderColor: SLColors.warningSoft, backgroundColor: '#21180F', borderRadius: 11, padding: 12, gap: 6 },
  confirmTitle: { color: SLColors.textPrimary, fontSize: 14, fontWeight: '700' }, confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, paddingTop: 5 },
  cancelButton: { flex: 1, minHeight: 45, borderWidth: 1, borderColor: '#493459', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: SLColors.textPrimary, fontSize: 13, fontWeight: '700' },
  applyButton: { flex: 2, minHeight: 45, backgroundColor: '#7441B3', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: SLColors.textPrimary, fontSize: 13, fontWeight: '800' },
});

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

function AccessorySessionProgrammingContext({ draft, editable, groupedWith, onChange, onChooseSubstitution, onGroupMovements }: { draft: CoachMovementDraft; editable: boolean; groupedWith: string[]; onChange: (patch: Partial<CoachMovementDraft>) => void; onChooseSubstitution?: () => void; onGroupMovements?: () => void }) {

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
      <Pressable accessibilityRole="button" disabled={!editable} onPress={onGroupMovements} style={styles.compactContextRow}><View style={styles.compactContextCopy}><Text style={styles.fieldLabel}>GROUPED SET</Text><Text style={styles.compactContextValue}>{groupedWith.length ? groupedWith.join(' · ') : 'Separate movement'}</Text></View><Text style={styles.compactContextAction}>Choose members</Text><Ionicons name="chevron-forward" size={17} color={palette.muted} /></Pressable>
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

function SmallButton({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
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

function ensureCoreVariantManualLoad(draft: CoachMovementDraft, _displayUnit: CoachDisplayUnit) {
  // A required manual target remains empty until the coach chooses it.
  return draft;
}

function createSessionWorkspaceDraft({ title, athleteId, scheduledDate, storageUnit, notes, coreItems, accessoryItems }: {
  title: string;
  athleteId?: number | null;
  scheduledDate?: string | null;
  storageUnit: CoachDisplayUnit;
  notes: string;
  coreItems: SessionMovementItem[];
  accessoryItems: SessionMovementItem[];
}): SessionWorkspaceDraft {
  const allItems = [...coreItems, ...accessoryItems];
  const accessoryIds = new Set(accessoryItems.map((item) => item.id));
  const items = Object.fromEntries(allItems.map((item) => [item.id, item]));
  const kinds = Object.fromEntries([
    ...coreItems.map((item) => [item.id, 'core'] as const),
    ...accessoryItems.map((item) => [item.id, 'accessory'] as const),
  ]);
  const movements = Object.fromEntries(allItems.map((item) => {
    const linkedBackdown = String(item.variant || '').toUpperCase() === 'TOP'
      ? allItems.find((candidate) => candidate.parent_item_id === item.id) || null
      : null;
    const movement = ensureCoreVariantManualLoad(movementDraftFromItem(item, storageUnit, linkedBackdown), storageUnit);
    return [item.id, accessoryIds.has(item.id)
      ? { ...movement, targetLowLb: '', targetHighLb: '' }
      : movement];
  }));
  return {
    title,
    athleteId: athleteId ?? null,
    scheduledDate: String(scheduledDate || '').slice(0, 10),
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

function reconcileSessionWorkspaceDraft(local: SessionWorkspaceDraft, base: SessionWorkspaceDraft, saved: SessionWorkspaceDraft) {
  const draft = cloneSessionWorkspaceDraft(saved);
  const conflicts: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const mergeFields = <T extends object>(label: string, original: T, mine: T, latest: T): T => {
    const merged = { ...latest };
    for (const key of Object.keys(mine) as (keyof T)[]) {
      if (same(mine[key], original[key])) continue;
      if (!same(latest[key], original[key]) && !same(latest[key], mine[key])) conflicts.push(`${label}.${String(key)}`);
      merged[key] = mine[key];
    }
    return merged;
  };
  for (const key of ['title', 'athleteId', 'scheduledDate', 'notes'] as const) {
    if (same(local[key], base[key])) continue;
    if (!same(saved[key], base[key]) && !same(saved[key], local[key])) conflicts.push(key);
    (draft as any)[key] = local[key];
  }
  const replacementIds = new Map<number, number>();
  let nextId = Math.min(-1, ...Object.keys(local.items).map(Number), ...Object.keys(saved.items).map(Number)) - 1;
  for (const id of new Set([...Object.keys(base.items), ...Object.keys(local.items)].map(Number))) {
    const before = base.items[id];
    const mine = local.items[id];
    const latest = saved.items[id];
    if (!before && mine) {
      draft.items[id] = mine;
      draft.movements[id] = local.movements[id];
      draft.kinds[id] = local.kinds[id];
    } else if (before && !mine) {
      if (latest && (!same(latest, before) || !same(saved.movements[id], base.movements[id]))) conflicts.push(`removed movement ${id}`);
      delete draft.items[id]; delete draft.movements[id]; delete draft.kinds[id];
    } else if (before && mine && !latest) {
      // A movement removed elsewhere can be restored as a new local addition
      // after the editor explicitly chooses to keep their values.
      const replacementId = nextId--;
      replacementIds.set(id, replacementId);
      draft.items[replacementId] = { ...mine, id: replacementId };
      draft.movements[replacementId] = local.movements[id];
      draft.kinds[replacementId] = local.kinds[id];
      conflicts.push(`removed movement ${id}`);
    } else if (before && mine && latest) {
      draft.items[id] = mergeFields(`movement ${id}`, before, mine, latest);
      draft.movements[id] = mergeFields(`prescription ${id}`, base.movements[id], local.movements[id], saved.movements[id]);
      if (local.kinds[id] !== base.kinds[id]) draft.kinds[id] = local.kinds[id];
    }
  }
  for (const key of ['coreOrder', 'accessoryOrder'] as const) {
    const mine = local[key].map((id) => replacementIds.get(id) ?? id);
    const latest = saved[key].filter((id) => Boolean(draft.items[id]));
    const localChanged = !same(local[key], base[key]);
    const baseIds = new Set(base[key]);
    const common = base[key].filter((id) => local[key].includes(id) && saved[key].includes(id));
    const commonOrder = (ids: number[]) => ids.filter((id) => baseIds.has(id) && common.includes(id));
    if (!same(commonOrder(local[key]), common) && !same(commonOrder(saved[key]), common)
      && !same(commonOrder(local[key]), commonOrder(saved[key]))) conflicts.push(key);
    const preferred = localChanged ? mine : latest;
    draft[key] = [...new Set([...preferred, ...latest, ...mine])].filter((id) => Boolean(draft.items[id]) && draft.kinds[id] === (key === 'coreOrder' ? 'core' : 'accessory'));
  }
  return { draft, conflicts };
}

function sessionWorkspaceSignature(draft: SessionWorkspaceDraft) {
  return JSON.stringify({
    ...draft,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
  });
}

function sessionWorkspaceDraftIsDirty(current: SessionWorkspaceDraft, persisted: SessionWorkspaceDraft) {
  if (sessionWorkspaceMetadataIsDirty(current, persisted)
    || JSON.stringify(current.coreOrder) !== JSON.stringify(persisted.coreOrder)
    || JSON.stringify(current.accessoryOrder) !== JSON.stringify(persisted.accessoryOrder)) return true;
  const currentIds = [...current.coreOrder, ...current.accessoryOrder].sort((a, b) => a - b);
  const persistedIds = [...persisted.coreOrder, ...persisted.accessoryOrder].sort((a, b) => a - b);
  if (JSON.stringify(currentIds) !== JSON.stringify(persistedIds)) return true;
  return currentIds.some((id) => {
    const currentMovement = current.movements[id];
    const persistedMovement = persisted.movements[id];
    if (!currentMovement || !persistedMovement) return true;
    const identityChanged = current.kinds[id] === 'accessory'
      && Number(current.items[id]?.movement_identity?.id || 0) !== Number(persisted.items[id]?.movement_identity?.id || 0);
    return identityChanged || movementDraftIsDirty(currentMovement, persistedMovement);
  });
}

function buildSessionWorkspaceSavePlan(current: SessionWorkspaceDraft, persisted: SessionWorkspaceDraft, storageUnit: CoachDisplayUnit): SessionWorkspaceSavePlan {
  const currentIds = [...current.coreOrder, ...current.accessoryOrder];
  const persistedIds = [...persisted.coreOrder, ...persisted.accessoryOrder];
  const movementUpdates: SessionWorkspaceMovementSave[] = [];
  const movementCreates: SessionWorkspaceMovementSave[] = [];
  currentIds.forEach((id) => {
    const movement = current.movements[id];
    const kind = current.kinds[id];
    const item = current.items[id];
    if (!movement || !kind || !item) return;
    const comparable = persisted.movements[id] ? movement : null;
    const identityChanged = kind === 'accessory'
      && Number(item.movement_identity?.id || 0) !== Number(persisted.items[id]?.movement_identity?.id || 0);
    const patch = movementProgrammingPatch(movement, kind, storageUnit);
    if (kind === 'core') {
      patch.lift = item.lift;
      if (item.core_movement?.id) patch.core_movement_id = item.core_movement.id;
    }
    if (kind === 'accessory' && item.movement_identity?.id) {
      patch.movement_definition_id = item.movement_identity.id;
    }
    if (kind === 'accessory') {
      delete patch.target_low_lb;
      delete patch.target_high_lb;
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
    notes: current.notes,
    metadataPatch: buildSessionWorkspaceMetadataPatch(current, persisted),
    movementUpdates,
    movementCreates,
    deletedMovementIds: persistedIds.filter((id) => id > 0 && !currentIds.includes(id)),
    coreOrder: [...current.coreOrder],
    accessoryOrder: [...current.accessoryOrder],
    orderChanged: JSON.stringify(current.coreOrder) !== JSON.stringify(persisted.coreOrder)
      || JSON.stringify(current.accessoryOrder) !== JSON.stringify(persisted.accessoryOrder),
  };
}

let draftMovementSequence = -Date.now() * 1000;

function addSessionDraftMovement(
  item: SessionMovementItem,
  kind: MovementKind,
  storageUnit: CoachDisplayUnit,
  setDraft: React.Dispatch<React.SetStateAction<SessionWorkspaceDraft>>,
  setSelectedId: React.Dispatch<React.SetStateAction<number | null>>,
) {
  // Process-unique negative IDs cannot collide with a recovered draft.
  if (item.id < 0) item = { ...item, id: --draftMovementSequence };
  setDraft((current) => {
    const prepared = ensureCoreVariantManualLoad(movementDraftFromItem(item, storageUnit), storageUnit);
    const movement = kind === 'accessory' ? { ...prepared, targetLowLb: '', targetHighLb: '' } : prepared;
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
    variant: draft.scheme === 'FULL_CUSTOM' ? 'FULL_CUSTOM' : draft.scheme === 'TOP_BACKDOWN' && draft.sourceVariant !== 'BK' ? 'TOP' : draft.sourceVariant,
    mode: draft.mode,
    sets: Number(draft.sets) || null,
    reps: Number(draft.reps) || null,
    reps_text: draft.repsText,
    rpe_target: Number(draft.rpe) || null,
    pct: Number(draft.pct) || null,
    rir_target: draft.rir.trim() ? Number(draft.rir) : null,
    superset_group: draft.supersetGroup || null,
    superset_pos: draft.supersetPosition ? Number(draft.supersetPosition) : null,
    coach_prescribed_low_kg: toKg(draft.targetLowLb),
    coach_prescribed_high_kg: toKg(draft.targetHighLb),
    notes: draft.notes,
    backdown_sets: Number(draft.backdownSets) || null,
    backdown_reps: Number(draft.backdownReps) || null,
    planned_sets: draft.plannedSets.map((row, index) => ({ set_index: index + 1, reps: Number(row.reps) || null,
      rpe_target: Number(row.rpe) || null, pct: Number(row.pct) || null,
      manual_target_kg: toKg(row.targetLb), manual_pm_kg: toKg(row.rangeLb) })),
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
  if (kind === 'core' && String(item.variant || '').toUpperCase() === 'FULL_CUSTOM') {
    const count = item.planned_sets?.length || 0;
    return `${count} custom ${count === 1 ? 'Set' : 'Sets'}`;
  }
  if (kind === 'core' && String(item.variant || '').toUpperCase() === 'TOP') {
    const backdownSets = numberText(item.backdown_sets);
    const backdownReps = numberText(item.backdown_reps);
    return `${sets || '—'} × ${reps || '—'} top · ${backdownSets || '—'} × ${backdownReps || '—'} backdown`;
  }
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


const authorStyles = StyleSheet.create({
  topbar: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  headerAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  link: { color: palette.violet, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 15 },
  saveState: { fontFamily: SLFontFamilies.sans, fontSize: 12 },
  overflow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  identity: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 5 },
  subject: { color: palette.violet, fontSize: 11, letterSpacing: 0.7, fontFamily: SLFontFamilies.sansSemiBold },
  title: { color: palette.text, fontSize: 27, lineHeight: 33, fontFamily: SLFontFamilies.sansBold },
  identityLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 },
  date: { color: palette.muted, fontFamily: SLFontFamilies.sans, fontSize: 14 },
  lifecycle: { color: SLColors.accentMagenta, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 12, textTransform: 'capitalize' },
  breadcrumb: { color: palette.muted, fontFamily: SLFontFamilies.sans, fontSize: 12, lineHeight: 18 },
  recovery: { color: SLColors.warning, fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 10 },
  note: { paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.line },
  noteTrigger: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9 },
  noteText: { flex: 1, color: palette.muted, fontFamily: SLFontFamilies.sans, fontSize: 14, lineHeight: 20 },
  movementHeading: { paddingHorizontal: 16, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { minHeight: 245, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle: { fontFamily: SLFontFamilies.sansSemiBold, color: palette.text, fontSize: 19 },
  addMovement: { marginHorizontal: 16, minHeight: 64, flexDirection: 'row', gap: 9, alignItems: 'center' },
  toolbarLayer: { position: 'absolute', left: 16, right: 16, bottom: 0 },
  toolbar: { minHeight: 64, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', backgroundColor: 'rgba(19,17,28,0.98)', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 5 } },
  toolbarAction: { minWidth: 60, minHeight: 50, justifyContent: 'center', alignItems: 'center', gap: 3, paddingHorizontal: 8 },
  toolbarLabel: { color: palette.muted, fontFamily: SLFontFamilies.sans, fontSize: 11 },
  primaryAction: { flex: 1, flexDirection: 'row', gap: 7, backgroundColor: '#56318F', borderRadius: 17 },
  primaryLabel: { color: palette.text, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 14 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  workspaceTopBar: { minHeight: 48, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SLLayout.screenGutter, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline, backgroundColor: palette.canvas },
  workspaceTopBarAction: { width: SLControlSize.minimumTouchTarget, height: SLControlSize.minimumTouchTarget, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md },
  workspaceTopBarTitle: { flex: 1, minWidth: 0, color: palette.text, textAlign: 'center', fontFamily: SLFontFamilies.sansBold, fontSize: 17, lineHeight: 22 },
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
  renameModalLayer: { flex: 1, justifyContent: 'flex-start', paddingHorizontal: SLLayout.screenGutter, paddingTop: SLSpacing.sm },
  renameModalCard: { width: '100%', gap: SLSpacing.sm, paddingBottom: SLSpacing.md },
  renameModalHeader: { minHeight: SLControlSize.minimumTouchTarget + SLSpacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm },
  renameModalTitle: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 18, lineHeight: 24 },
  renameModalClose: { width: SLControlSize.minimumTouchTarget, height: SLControlSize.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md },
  renameModalInput: { minHeight: 48, color: palette.text, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.lineStrong, borderRadius: SLRadius.md, paddingHorizontal: SLSpacing.md, paddingVertical: SLSpacing.sm, fontFamily: SLFontFamilies.display, fontSize: 16 },
  renameModalActions: { flexDirection: 'row', gap: SLSpacing.sm, paddingTop: SLSpacing.md },
  renameModalAction: { flex: 1, minWidth: 0 },
  datePickerModalLayer: { paddingHorizontal: SLLayout.screenGutter, paddingTop: SLSpacing.sm, paddingBottom: SLSpacing.lg },
  datePickerModalCard: { width: '100%', gap: SLSpacing.md },
  datePickerModalHeader: { minHeight: 62, justifyContent: 'center' },
  datePickerModalEyebrow: { color: palette.violet, fontFamily: SLFontFamilies.technical, fontSize: 11, lineHeight: 16, letterSpacing: 1.5 },
  datePickerModalTitle: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 23, lineHeight: 30 },
  datePickerCalendar: { paddingHorizontal: SLSpacing.sm, paddingTop: SLSpacing.sm, paddingBottom: SLSpacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.lineStrong, borderRadius: SLRadius.lg, backgroundColor: SLColors.surfaceMedia },
  datePickerMonthHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SLSpacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  datePickerMonthTitle: { flex: 1, color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 19, lineHeight: 24 },
  datePickerMonthActions: { flexDirection: 'row', gap: SLSpacing.xs },
  datePickerMonthAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, backgroundColor: SLColors.surfaceFlat },
  datePickerWeekRow: { flexDirection: 'row', paddingTop: SLSpacing.sm, paddingBottom: SLSpacing.xs },
  datePickerWeekday: { width: '14.2857%', color: palette.muted, textAlign: 'center', fontFamily: SLFontFamilies.technical, fontSize: 11, lineHeight: 20, textTransform: 'uppercase' },
  datePickerDays: { flexDirection: 'row', flexWrap: 'wrap' },
  datePickerDaySlot: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center' },
  datePickerDay: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  datePickerDaySelected: { backgroundColor: palette.violet, ...SLShadows.level1 },
  datePickerDayPressed: { backgroundColor: palette.violetSoft },
  datePickerDayText: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 15, lineHeight: 20 },
  datePickerDayTextSelected: { color: SLColors.black },
  workspacePromptBody: { flex: 1, justifyContent: 'space-between', gap: SLSpacing.lg, paddingHorizontal: SLLayout.screenGutter, paddingTop: SLSpacing.sm, paddingBottom: SLSpacing.md },
  workspacePromptCopy: { gap: SLSpacing.xs },
  workspacePromptEyebrow: { color: palette.violet, textTransform: 'uppercase', fontFamily: SLFontFamilies.technical, fontSize: 12, lineHeight: 16 },
  workspacePromptTitle: { color: palette.text, fontFamily: SLFontFamilies.sansBold, fontSize: 20, lineHeight: 26 },
  workspacePromptMessage: { color: palette.muted, fontFamily: SLFontFamilies.body, fontSize: 15, lineHeight: 21 },
  workspacePromptChoiceRow: { flexDirection: 'row', gap: SLSpacing.sm },
  workspacePromptChoice: { flex: 1, minWidth: 0 },
  workspacePromptActions: { flexDirection: 'row', gap: SLSpacing.sm },
  workspacePromptAction: { flex: 1, minWidth: 0 },
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
  programmingRegion: { gap: 8, paddingHorizontal: 16 },
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
  sessionToolkitSectionHeader: { paddingHorizontal: SLSpacing.sm, paddingTop: SLSpacing.xs, paddingBottom: 2, textTransform: 'uppercase', fontFamily: SLFontFamilies.technical, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
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
  movementRow: { position: 'relative', minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', paddingVertical: 12, paddingHorizontal: 12, borderRadius: SLRadius.md, backgroundColor: '#101016', borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line },
  movementRowPressed: { backgroundColor: palette.objectRaised },
  movementSwipeRemove: { width: 116, minHeight: 84, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderRadius: SLRadius.md, backgroundColor: 'rgba(173, 47, 72, 0.28)', borderWidth: StyleSheet.hairlineWidth, borderColor: palette.red },
  movementSwipeRemoveText: { color: palette.text, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 12, lineHeight: 16 },
  movementArtwork: { width: __DEV__ ? 64 : 48, height: __DEV__ ? 64 : 48, zIndex: 2, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  movementTrailing: { width: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  movementArtworkImage: { shadowOpacity: 0.36, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  artworkFallback: { alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, backgroundColor: palette.violetSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(167,139,250,0.25)' },
  movementCopy: { flex: 1, minWidth: 0, gap: 2 },
  movementName: { color: palette.text, fontSize: 17, lineHeight: 22, fontFamily: SLFontFamilies.sansSemiBold },
  expandedMovementName: { fontFamily: SLFontFamilies.sansBold, fontSize: 20, lineHeight: 25 },
  movementMeta: { color: palette.muted, textTransform: 'uppercase', fontFamily: SLFontFamilies.technical, fontSize: 13, lineHeight: 18 },
  movementPrescription: { color: palette.text, fontSize: 14, lineHeight: 20 },
  movementLoadRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  movementLoadLabel: { color: SLColors.accentCyanMuted, textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 3, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.accentCyanMuted },
  movementLoadLabelManual: { color: SLColors.warning, borderColor: SLColors.warning },
  movementLoad: { color: SLColors.accentCyanMuted },
  movementLoadManual: { color: SLColors.warning },
  expandedMovementCard: { position: 'relative', overflow: 'hidden', borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: '#101016' },
  expandedMovementHeader: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  expandedMovementArtwork: { width: __DEV__ ? 64 : 52, height: __DEV__ ? 64 : 52, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
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
  substitutionChipText: { maxWidth: 210, color: palette.text, fontFamily: SLFontFamilies.bodyMedium, fontSize: 12, lineHeight: 16 },
  prescriptionChoiceRow: { zIndex: 30, flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.sm, overflow: 'visible' },
  prescriptionChoiceField: { flex: 1, minWidth: 0, gap: SLSpacing.sm },
  programmingStack: { gap: 0 },
  programmingWheelStack: { gap: SLSpacing.sm },
  accessoryPrescriptionEditor: { zIndex: 20, gap: SLSpacing.sm },
  prescriptionSectionLabel: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 12, lineHeight: 16, letterSpacing: 0.65 },
  prescriptionControlRow: { flexDirection: 'row', gap: 6 },
  prescriptionValueControl: { flex: 1, minWidth: 0, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden', borderRadius: SLRadius.md, borderWidth: 1, backgroundColor: SLColors.surfaceMedia },
  prescriptionValueControlSets: { borderColor: 'rgba(168,101,255,0.46)', backgroundColor: 'rgba(105,48,162,0.18)' },
  prescriptionValueControlReps: { borderColor: 'rgba(232,61,154,0.46)', backgroundColor: 'rgba(142,26,92,0.16)' },
  prescriptionValueControlRir: { borderColor: 'rgba(120,170,180,0.48)', backgroundColor: 'rgba(36,102,116,0.18)' },
  prescriptionValueLabel: { color: palette.muted, fontFamily: SLFontFamilies.technical, fontSize: 12, lineHeight: 16, letterSpacing: 0.55 },
  prescriptionValue: { maxWidth: '95%', fontFamily: SLFontFamilies.numeric, fontSize: 19, lineHeight: 24 },
  prescriptionValueSets: { color: palette.violet },
  prescriptionValueReps: { color: SLColors.accentMagenta },
  prescriptionValueRir: { color: SLColors.accentCyanMuted },
  prescriptionValueMeta: { maxWidth: '92%', color: palette.muted, fontFamily: SLFontFamilies.bodyMedium, fontSize: 12, lineHeight: 16 },
  prescriptionPickerSheet: { flex: 1, minHeight: 0, paddingHorizontal: SLLayout.screenGutter, paddingBottom: SLSpacing.sm },
  prescriptionPickerTitle: { color: palette.text, fontFamily: SLFontFamilies.display, fontSize: 17, lineHeight: 22, textAlign: 'center', marginBottom: SLSpacing.sm },
  prescriptionPickerAction: { marginTop: 'auto', paddingTop: SLSpacing.sm },
  repModeRow: { flexDirection: 'row', overflow: 'hidden', borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  repModeButton: { flex: 1, minHeight: SLControlSize.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderStandard },
  repModeButtonSelected: { backgroundColor: 'rgba(105,48,162,0.42)' },
  repModeButtonText: { color: palette.muted, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 12, lineHeight: 17 },
  repModeButtonTextSelected: { color: palette.text },
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
