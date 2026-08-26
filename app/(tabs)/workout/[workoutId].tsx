// app/(tabs)/workout/[workoutId].tsx
// @ts-nocheck

import React, { useCallback, useEffect, useMemo, useReducer, useState, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  AppState,
  Animated,
  Easing,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  findNodeHandle,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text, TextInput } from '@/components/ui/sl-text';
import { resolveAccessoryIconName, SLProfileAvatar, type SLAccessoryIconName } from '@/components/ui';
let Notifications: any = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}
import { Tabs, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
let VideoThumbnails: any = null;
try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch (_) {
  VideoThumbnails = null;
}
import RefreshScreen from '@/components/refresh-screen';
import {
  createSessionLoggerRecoveryGate,
  sessionLoggerMovementCount,
  validateSessionLoggerPayload,
} from '@/lib/session-logger-resume';
import SetVideoPlayerModal, {
  type SetVideoSummary,
} from '@/components/SetVideoPlayerModal';
import {
  CompletedSessionRecap,
  type CompletedSessionRecapPayload,
} from '@/components/coach-mobile/CompletedSessionRecap';
import {
  type ActiveMovementDetailRow,
  type ActiveMovementVisualContext,
  CoreMovementLedgerRow,
  CoreSchemeDetail,
  type MovementLoggerFocusModel,
  type SetRailStep,
} from '@/components/workout-logger/core-loggers';
import {
  SupersetRoundWorkspace,
  type SupersetWorkspaceItem,
} from '@/components/workout-logger/superset-round-workspace';
import { ManufacturerBrandMark } from '@/components/workout-logger/manufacturer-brand-mark';
import {
  CancelResumeModal,
  RestTimerPickerModal,
  TardyReasonModal,
} from '@/components/workout-logger/logger-modals';
import {
  LogSheetUnitToggle,
  SessionUnitFloatingControl,
} from '@/components/workout-logger/logger-primitives';
import { LoggerWheelPicker } from '@/components/workout-logger/logger-wheel-picker';
import { SubstitutionConfirmationSheet } from '@/components/workout-logger/substitution-confirmation-sheet';
import {
  GovernedAccessoryPickerModal,
  type GovernedAccessoryIdentity,
} from '@/components/movement/GovernedAccessoryPickerModal';
import { ReadinessModal, type ReadinessModalValues } from '@/components/workout-logger/readiness-modal';
import { LoggerFeedbackSurface } from '@/components/workout-logger/logger-feedback';
import { FinalSessionCompletionPresenter } from '@/components/workout-logger/final-session-completion-presenter';
import { PostSessionCoachFeedback } from '@/components/workout-logger/post-session-surfaces';
import { SessionHighlightsPanel, SessionImpactPanel, type SessionImpactSummary } from '@/components/workout-logger/stage5-impact-summary';
import {
  SessionBeginAction,
  SessionCommandStrip,
  SessionIntentPanel,
} from '@/components/workout-logger/session-shell';
import {
  RestTimerFocus,
  type RestTimerHeaderOrigin,
} from '@/components/workout-logger/rest-timer-focus';
import { useAuth } from '@/context/AuthContext';
import { resolveSessionNoteAuthor } from '@/lib/session-note-author';
import {
  accessorySwapActionForItem,
  itemHasPersistedSetLogs,
  persistedSetLogItemIds,
  resolveSubstitutionAuthority,
} from '@/lib/accessory-swap-eligibility';
import { API_BASE, fetchJson, getDeviceTimezone, getResolvedTimezone, removeVideoAttachment } from '@/lib/api';
import { createLatestRequestManager } from '@/lib/latest-request';
import {
  cancelVideoUploadJob,
  enqueueVideoUpload,
  processVideoUploadQueue,
  retryVideoUploadJob,
  startVideoUploadQueue,
  subscribeVideoUploadQueue,
  type QueuedVideoUploadJob,
} from '@/lib/videoUploadQueue';
import { setUpdateBlocker } from '@/lib/updateSafety';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import {
  attachTransientRecognitionDelivery,
  feedbackAnalytics,
  createCanonicalSetResultGate,
  createCanonicalSetSubmissionController,
  createLogSheetHandoffController,
  createTimerHandoffReleaseController,
  finalAssignedSetOpportunity,
  initialLoggerFeedbackState,
  isNewCanonicalSessionFinalSet,
  loggerFeedbackReducer,
  logSetActionPresentation,
  recognitionDeliveryId,
  recognitionVisibleDuration,
  selectCelebrationEvents,
  timerHandoffResolution,
  type LoggerRecognitionEvent,
} from '@/lib/logger-feedback';
import {
  invalidateRecognitionForSet,
  invalidateRecognitionEvents,
  loadLoggerFeedbackStorage,
  markRecognitionConsumed,
  persistPendingRecognition,
} from '@/lib/logger-feedback-storage';
import {
  hasCompletedSetSwipeTooltipBeenShown,
  markCompletedSetSwipeTooltipShown,
} from '@/lib/completed-set-swipe-tooltip';
import {
  completedSetSwipeTooltipEnabled,
  shouldShowCompletedSetSwipeTooltip,
} from '@/lib/completed-set-swipe-tooltip-core';
import { triggerAcceptedSetHaptic, triggerSessionCompletionHaptic, triggerSubmissionFailureHaptic } from '@/lib/logger-feedback-haptics';
import {
  KG_PER_LB,
  formatLoggerWeightKg,
  formatLoggerWeightRangeKg,
  roundLoggerDisplayWeight,
  roundToNearestGymIncrementLb,
} from '@/lib/logger-weight-format';
import { formatPerformedLoad, type PerformedLoadSemantics } from '@/lib/performed-load-semantics';
import {
  resolveLoggerPrescribedWeight,
  type ResolvedLoggerPrescribedWeight,
} from '@/lib/logger-prescribed-weight';
import {
  resolveSetLoggerLoadDefault,
  type SetLoggerLoadEvidence,
} from '@/lib/set-logger-load-default';
import {
  accessoryPerSetPrescription,
  accessoryPerSetRepsLabel,
} from '@/lib/accessory-logger-prescription';
import {
  canPresentFinalSessionCompletion,
  finalSessionCompletionReducer,
  initialFinalSessionCompletionState,
} from '@/lib/final-session-completion';
import { accessoryMuscleRegion } from '@/lib/accessory-muscle-group';
import { movementScrollTarget } from '@/lib/movement-transition';
import { programmedSetCountForSession } from '@/lib/session-programmed-set-count';
import {
  accessoryRepTargetFromText,
  accessoryRepTargetText,
  type AccessoryRepTarget,
} from '@/lib/prescription-wheel-options';
import {
  canonicalLoggedSetCountForSession,
  deriveSessionElapsedSeconds,
  formatSessionElapsed,
} from '@/lib/session-header-metrics';
import { sessionLoggerSharedHeaderShown } from '@/lib/session-logger-shell';
import {
  createSessionTimeDraft,
  formatSessionTimeLabel,
  formatSessionTimeZoneLabel,
  parseSessionTimeDraft,
  replaceSessionDatePart,
  replaceSessionTimePart,
  resolveSessionTimeZone,
} from '@/lib/post-session-times';
import { buildReadinessPayload, createReadinessSubmissionGate, normalizeReadinessUnit, persistReadinessThenBegin } from '@/lib/readiness';
import { ThemedText } from '@/components/themed-text';
import { SLColors, SLFontFamilies, SLLayout, SLMotion, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
import {
  applyWorkoutDetailMachineIdentity,
  createWorkoutDetailFixture,
  hydrateWorkoutDetailEquipmentSelections,
  normalizeWorkoutDetailLifecycle,
  rememberWorkoutDetailEquipmentSelection,
  workoutDetailLifecycleForEntryId,
  workoutDetailMachineIdentityChoices,
  workoutDetailMachineVariantIdentity,
} from '@/dev-mocks/fixtures/workout-detail';
import { useDevLiveScreenSession } from '@/dev-mocks/live-screen-session';
import {
  exactAccessoryBestExposure,
  exactAccessoryHistoryRows,
  exactAccessoryLastExposure,
} from '@/lib/exact-accessory-history';
import {
  resolveLoggerLiftIdentity,
  resolveLoggerPlateStack,
  resolveLoggerProgressContext,
  type LoggerProgressEvidence,
} from '@/lib/logger-visual-context';
import {
  cueForRestTimerSecond,
  DEFAULT_REST_TIMER_CUE_CONFIG,
  REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS,
  shouldPromoteRestTimer,
} from '@/lib/rest-timer-cues';
import { RestTimerCountdownAudioWindow } from '@/lib/rest-timer-countdown-audio';
import {
  DEFAULT_REST_TIMER_SECONDS,
  normalizeRestTimerSeconds,
  resolveRestTimerPickerInitialSeconds,
  REST_TIMER_OPTIONS_SECONDS,
} from '@/lib/rest-timer-preference-core';
import {
  loadLastUsedRestTimerSeconds,
  persistLastUsedRestTimerSeconds,
} from '@/lib/rest-timer-preference';
import {
  clearRestTimerExpiry,
  loadRestTimerExpiry,
} from '@/lib/rest-timer-storage';
import {
  attachGlobalRestTimerNotification,
  beginGlobalRestTimer,
  getRestTimerCompletionState,
  hydrateRestTimerCompletion,
  reconcileGlobalRestTimerCompletion,
  stopGlobalRestTimer,
} from '@/lib/rest-timer-completion';
import { coreSetTimelineLabel } from '@/lib/core-logger-timeline';
import {
  buildSupersetRoundModel,
  missingSupersetRoundItemIds,
} from '@/lib/superset-rounds';
import {
  advanceSequentialGroupStep,
  createSequentialGroupDraft,
  previousSequentialGroupStep,
  skipSequentialGroupStep,
  updateSequentialGroupDraft,
  validateSequentialGroupForSave,
} from '@/lib/sequential-group-logger';
import {
  sequentialGroupTransitionConfig,
  type SequentialGroupTransitionDirection,
} from '@/lib/sequential-group-transition';
import {
  activeEquipmentIdentity,
  equipmentSnapshotForSet,
  isMachineAccessoryItem,
  needsEquipmentSelection,
  orderEquipmentChoices,
  type EquipmentSelectionContinuation,
} from '@/lib/equipment-selection';
import {
  movementHistorySheetRoute,
  resolveMovementHistoryLaunchForItem,
  resolveMovementHistoryLaunchFromMeasurement,
} from '@/lib/movement-history-launch';
import { resolveLoggerMovementIdentity } from '@/lib/logger-movement-identity';
import {
  equipmentPresentationLabel,
  equipmentPresentationParts,
} from '@/lib/equipment-presentation';
import {
  MACHINE_EQUIPMENT_TYPES,
  type MachineEquipmentType,
} from '@/lib/machine-equipment';
import {
  accessoryRepeatDraft,
  coreRepeatDraft,
  latestRepeatableSet,
  repeatSetPreview,
} from '@/lib/repeat-last-set';

const WORKOUT_DETAIL_COACH_AVATAR = require('@/assets/images/app_logo.png');
const CORE_FAMILY_LIFT_CODE = {
  squat: 'SQ',
  bench: 'BN',
  deadlift: 'DL',
} as const;
const REST_TIMER_ZERO_HOLD_MS = 650;
const REST_TIMER_READY_HOLD_MS = 900;
const REST_TIMER_RETURN_MS = 250;

type SetLog = {
  id: number;
  set_index: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  actual_rir: number | null;
  client_submission_id?: string | null;
  source_revision?: number;
  has_video?: boolean;
  video_id?: number | null;
  review_status?: string | null;
  upload_status?: string | null;
  video_url?: string | null;
  video?: SetVideoSummary | null;
  performed_movement_definition_id?: number | null;
  equipment_manufacturer_id?: number | null;
  equipment_model_id?: number | null;
  implementation_key_snapshot?: string | null;
  performed_label_snapshot?: string | null;
  identity_source_snapshot?: string | null;
};

type SetSubmissionAttempt = {
  id: string;
  signature: string;
};

function createSetSubmissionId(): string {
  return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

type SetVideoPlayerState = {
  visible: boolean;
  videoId: number | null;
  initialUrl?: string | null;
  initialVideo?: SetVideoSummary | null;
};

type MovementHistorySet = {
  weight_kg?: number | null;
  reps?: number | null;
  rir?: number | null;
  rpe?: number | null;
  date?: string | null;
  workout_id?: number | null;
  item_id?: number | null;
  movement?: string | null;
  set_index?: number | null;
};

type MovementHistory = {
  canonical_key?: string | null;
  movement_pattern?: string | null;
  loading_behavior?: 'normal' | 'assisted' | string | null;
  most_recent_logged_set?: MovementHistorySet | null;
  best_logged_set?: MovementHistorySet | null;
  recent_sets?: MovementHistorySet[];
  recent_sessions?: MovementHistorySet[];
  identity_scope?: 'exact_identity' | 'legacy_unresolved' | string;
  comparison_allowed?: boolean | null;
  comparison_identity_key?: string | null;
  comparison_scope?: string | null;
  movement_definition_id?: number | null;
  legacy_unresolved_history?: {
    most_recent_logged_set?: MovementHistorySet | null;
    best_logged_set?: MovementHistorySet | null;
    recent_sets?: MovementHistorySet[];
    recent_sessions?: MovementHistorySet[];
    identity_scope: 'legacy_unresolved';
    equipment_label?: string | null;
    reference_only: true;
    loads_comparable: false;
    comparison_allowed: false;
  } | null;
  related_reference_history?: {
    movement_definition_id: number;
    display_name: string;
    manufacturer?: string | null;
    equipment_type?: string | null;
    equipment_model?: string | null;
    implementation_key?: string | null;
    last_performed_on?: string | null;
    last_set?: MovementHistorySet | null;
    has_history: boolean;
    reference_only: true;
    loads_comparable: false;
  }[];
};

type GeneralMovementIdentity = {
  id: number;
  key: string;
  display_name: string;
  family_id?: number | null;
  family_display_name?: string | null;
  family?: string | null;
  ownership_scope?: string | null;
  library_scope?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[] | null;
  execution_family?: string | null;
  requires_equipment_configuration?: boolean | null;
  identity_specificity?: 'broad' | 'exact' | 'unknown' | string;
  equipment_type?: string | null;
  loading_implementation?: string | null;
  load_convention?: string | null;
  measurement_type?: string | null;
  sidedness?: string | null;
  implementation_key?: string | null;
  manufacturer?: { id: number; key: string; display_name: string } | null;
  equipment_model?: { id: number; key: string; display_name: string } | null;
  material_parameters?: {
    note?: string | null;
    custom_manufacturer_name?: string | null;
  } | null;
  equipment_context?: {
    remembered_status?: string | null;
    last_used_at?: string | null;
    option_kind?: 'catalog' | 'other' | 'unknown' | string;
  } | null;
  comparison_policy?: { confidence: string; comparison_scope: string; recognition_enabled: false } | null;
};

type PlannedSet = {
  set_index: number;
  reps: number | null;
  rpe_target: number | null;
  pct: number | null;
  manual_target_kg: number | null;
  manual_pm_kg: number | null;
  suggested_low_kg?: number | null;
  suggested_high_kg?: number | null;
};

type WorkoutItem = {
  id: number;
  lift: string;
  designation?: string | null;
  variant: string; // "TOP" | "BK" | "STRAIGHT" | "ACC"
  scheme?: string | null;
  planned_sets?: PlannedSet[];
  movement: string | null;
  original_movement?: string | null;
  is_substituted?: boolean;
  selected_sub_movement?: string | null;
  approved_subs?: string[];
  approved_sub_identities?: GeneralMovementIdentity[];
  sets: number | null;
  reps: number | null;
  reps_text: string | null;
  mode: string | null;
  rpe_target: number | null;
  pct: number | null;
  rir_target: number | null;
  target_low_kg: number | null;
  target_high_kg: number | null;
  baseline_low_kg: number | null;
  baseline_high_kg: number | null;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  notes: string | null;
  progress_context?: LoggerProgressEvidence | null;
  superset_group: string | null;
  superset_pos: number | null;
  set_logs: SetLog[];
  has_performed_evidence?: boolean | null;
  // Optional lookback / history (provided by backend when available)
  lookback_best?: {
    workout_id?: number | null;
    date?: string | null;
    label?: string | null;
    actual_weight_kg?: number | null;
    actual_reps?: number | null;
    actual_rpe?: number | null;
    actual_rir?: number | null;
  } | null;
  // Backwards-compat aliases some endpoints may use
  last_best?: WorkoutItem['lookback_best'];
  prev_best?: WorkoutItem['lookback_best'];
  movement_history?: MovementHistory | null;
  movement_identity?: GeneralMovementIdentity | null;
  effective_movement_identity?: GeneralMovementIdentity | null;
  performed_movement_identity?: GeneralMovementIdentity | null;
  performed_canonical_movement_identity?: GeneralMovementIdentity | null;
  core_movement?: {
    id: number;
    key: string;
    display_name: string;
    family?: string | null;
    kind?: string | null;
  } | null;
  performed_core_movement?: WorkoutItem['core_movement'];
  legacy?: {
    state?: string | null;
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: GeneralMovementIdentity | null;
  } | null;
  performed_sets?: number | null;
  performed_reps_text?: string | null;
  performed_rir_target?: number | null;
  parent_item_id?: number | string | null;
  dev_core_family?: keyof typeof CORE_FAMILY_LIFT_CODE | null;
  dev_visual_coverage?: string[];
};

type AccessoryGroup = {
  group: string | null;
  items: WorkoutItem[];
  dev_execution_hint?: string | null;
};

type WorkoutPayload = {
  ok: boolean;
  view_mode?: 'standard' | 'coach_preview' | string;
  permissions?: {
    can_log: boolean;
    can_coach: boolean;
    is_self_coached: boolean;
    can_hot_swap: boolean;
    can_browse_hot_swap_catalog?: boolean;
    can_create_custom_movement?: boolean;
    substitution_authority?: 'self_governed' | 'coach_restricted' | 'none' | string;
    view_only?: boolean;
  };
  workout: {
    id: number;
    athlete_id: number;
    date: string | null;
    label: string | null;
    status: string | null;
    started_at?: string | null;
    scheduled_timezone?: string | null;
    completed_duration_seconds?: number | null;
    estimated_duration_minutes?: number | null;
    estimated_duration_low_minutes?: number | null;
    estimated_duration_high_minutes?: number | null;
    estimated_duration_model_version?: 'deterministic-v1' | string | null;
    completion_reminder_sent_at?: string | null;
    timeliness?: 'on_time' | 'tardy' | 'missed' | string | null;
    loggable?: boolean | null;
    requires_tardy_reason?: boolean | null;
    tardy_reason?: string | null;
    block_reason?: string | null;
    training_block_id: number | null;
    programming_notes?: string | null;
    dev_visual_coverage?: Record<string, readonly string[]> | null;
    post_session_coach_feedback?: string | null;
    post_session_coach_feedback_at?: string | null;
    core_items: WorkoutItem[];
    accessory_groups: AccessoryGroup[];
    impact_summary?: SessionImpactSummary | null;
    accomplishment_history?: { items: LoggerRecognitionEvent[]; next_cursor: string | null; has_more: boolean } | null;
    completed_recap?: CompletedSessionRecapPayload | null;
  };
  readiness_survey?: {
    id: number;
    bodyweight_kg?: number | null;
  } | null;
  athlete: {
    id: number;
    name: string;
    preferred_units?: string | null;
    bodyweight_kg?: number | null;
    profilePhotoUrl?: string | null;
    profilePhotoVersion?: string | null;
  };
  coach?: {
    id: number;
    name?: string | null;
    avatar_url?: string | null;
    avatar_uploaded_at?: string | null;
    avatar_fixture?: 'coach-adrien' | string | null;
  } | null;
};




const MAX_ACCESSORY_LOAD_LB = 2000;
const MAX_ACCESSORY_LOAD_KG = Math.ceil((MAX_ACCESSORY_LOAD_LB * KG_PER_LB) / 2.5) * 2.5;
function formatWeight(
  kg: number | null | undefined,
  unit: 'kg' | 'lb'
): string {
  return formatLoggerWeightKg(kg, unit);
}

function itemLoadSemantics(item?: WorkoutItem | null): PerformedLoadSemantics {
  const identity = item?.performed_movement_identity || item?.movement_identity || null;
  return {
    loadConvention: identity?.load_convention,
    measurementType: identity?.measurement_type,
    loadingBehavior: item?.movement_history?.loading_behavior,
  };
}

function loggedSetText(log?: SetLog | null, unit: 'kg' | 'lb' = 'kg', item?: WorkoutItem | null) {
  if (!log) return null;
  let text = formatPerformedLoad(log.actual_weight_kg, unit, itemLoadSemantics(item))
    || `${formatWeight(log.actual_weight_kg, unit)} ${unit}`;
  if (log.actual_reps === 0) text += ' × Failed';
  else if (log.actual_reps != null) text += ` × ${log.actual_reps}`;
  if (log.actual_rpe != null) text += ` @ RPE ${log.actual_rpe.toFixed(1)}`;
  if (log.actual_rir != null) text += ` @ RIR ${log.actual_rir.toFixed(1)}`;
  return text;
}

function formatTargetRange(
  lowKg: number | null | undefined,
  highKg: number | null | undefined,
  unit: 'kg' | 'lb'
): string | null {
  if (lowKg == null || highKg == null) return null;
  if (lowKg === 0 && highKg === 0) return null;

  return formatLoggerWeightRangeKg(lowKg, highKg, unit);
}

function computeManualRangeKg(ps: PlannedSet): { lowKg: number | null; highKg: number | null } {
  const mid = ps.manual_target_kg;
  const pm = ps.manual_pm_kg;

  if (mid == null) return { lowKg: null, highKg: null };

  const plusMinus = pm != null ? Number(pm) : 0;
  if (!Number.isFinite(plusMinus) || plusMinus <= 0) {
    return { lowKg: mid, highKg: mid };
  }
  return { lowKg: mid - plusMinus, highKg: mid + plusMinus };
}

function formatPlannedWeightLine(ps: PlannedSet, unit: 'kg' | 'lb') {
  const manual = computeManualRangeKg(ps);
  const primary =
    manual.lowKg != null && manual.highKg != null
      ? formatTargetRange(manual.lowKg, manual.highKg, unit)
      : null;

  const suggested = formatTargetRange(ps.suggested_low_kg ?? null, ps.suggested_high_kg ?? null, unit);
  return { primary, suggested };
}

function formatPlannedSchemeLine(ps: PlannedSet, mode: string | null): string {
  const m = (mode || 'RPE').toUpperCase();
  const reps = ps.reps != null ? String(ps.reps) : '—';

  if (m === 'PCT') {
    const pct = ps.pct;
    if (pct == null) return `${reps} Reps`;
    const p = pct > 1 ? pct : pct * 100;
    return `${reps} Reps @ ${p.toFixed(1)}%`;
  }

  if (ps.rpe_target == null) return `${reps} Reps`;

  return `${reps} Reps @ ${Number(ps.rpe_target).toFixed(1)}`;
}

function roundToNearest5(x: number): number {
  return Math.round(x / 5) * 5;
}

function prettyStatus(status?: string | null) {
  if (!status) return '';
  const v = status.toLowerCase();
  if (v === 'tardy') return 'Tardy';
  if (v === 'missed') return 'Missed';
  if (v === 'missed_excused') return 'Excused';
  if (v === 'incomplete') return 'Incomplete';
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}


function titleCaseWord(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDesignation(des: any): string {
  const d = String(des || '').trim();
  if (!d) return '';
  return titleCaseWord(d);
}

function liftDisplayName(core: WorkoutItem): string {
  const v = String(core.variant || '').toUpperCase();

  // Core Variant / VR title
  if ((v === 'VR' || core.lift === 'VR') && core.movement) {
    const des = formatDesignation((core as any).designation);
    const movement = simplifyMobileMovementName(core.movement);
    return des ? `${movement} (${des})` : movement;
  }

  let base = '';
  if (core.lift === 'SQ') base = 'Squat';
  else if (core.lift === 'BN') base = 'Bench';
  else if (core.lift === 'DL') base = 'Deadlift';
  else base = simplifyMobileMovementName(core.movement || core.lift);

  const isNormalLift =
    core.lift === 'SQ' || core.lift === 'BN' || core.lift === 'DL' || core.lift === 'OHP';
  const isNormalVariant =
    v === 'TOP' || v === 'STRAIGHT' || v === 'FULL_CUSTOM';

  const des = formatDesignation((core as any).designation);
  if (des && isNormalLift && isNormalVariant) {
    return `${base} (${des})`;
  }

  return base;
}

function getLookbackBest(it: any) {
  if (String(it?.variant || '').trim().toUpperCase() === 'ACC') {
    return exactAccessoryLastExposure(it?.movement_history);
  }
  return it?.lookback_best || it?.last_best || it?.prev_best || null;
}

function formatLookbackLine(best: any, unit: 'kg' | 'lb', item?: WorkoutItem | null) {
  if (!best) return null;

  // Support both shapes:
  // 1) { actual_weight_kg, actual_reps, actual_rpe, actual_rir, date }
  // 2) { weight_kg, reps, rpe, rir, date }
  const w = best.actual_weight_kg ?? best.weight_kg ?? null;
  const reps = best.actual_reps ?? best.reps ?? null;
  const rpe = best.actual_rpe ?? best.rpe ?? null;
  const rir = best.actual_rir ?? best.rir ?? null;
  const dateStr = best.date ? String(best.date).slice(0, 10) : null;

  if (w == null || reps == null) return null;

  const load = formatPerformedLoad(w, unit, itemLoadSemantics(item)) || `${formatWeight(w, unit)} ${unit}`;
  let line = `Last best: ${load} × ${reps}`;
  if (rpe != null) line += ` @ RPE ${Number(rpe).toFixed(1)}`;
  if (rir != null) line += ` (RIR ${rir})`;
  if (dateStr) line += ` · ${dateStr}`;

  return line;
}

function videoStatusLabel(setLog?: SetLog | null, uploading?: boolean, failed?: string | null) {
  if (uploading) return 'Uploading...';
  if (failed) return 'Upload failed';
  const status = setLog?.review_status || setLog?.video?.review_status;
  if (setLog?.has_video || setLog?.video_id || setLog?.video?.id) {
    if (status === 'not_requested' || setLog?.video?.submitted_for_review === false) return 'Saved to Archive';
    if (status === 'reviewed') return 'Reviewed';
    if (status === 'needs_followup') return 'Needs follow-up';
    return 'Pending review';
  }
  return 'No video attached';
}

function queuedVideoStatusLabel(uploadState: { uploading?: boolean; queued?: boolean; uploaded?: boolean; error?: string | null; permanent?: boolean } | null | undefined) {
  if (!uploadState) return null;
  if (uploadState.uploading) return 'Uploading video...';
  if (uploadState.uploaded) return 'Video uploaded';
  if (uploadState.error) return uploadState.permanent ? 'Upload failed' : 'Upload failed — retry';
  if (uploadState.queued) return 'Video queued';
  return null;
}

function formatHistoryPattern(value: any) {
  const text = String(value || 'accessory').replace(/_/g, ' ').trim();
  return text ? text.replace(/\b\w/g, (m) => m.toUpperCase()) : 'Accessory';
}

function formatMovementHistorySet(row: MovementHistorySet | null | undefined, unit: 'kg' | 'lb', assisted?: boolean) {
  if (!row) return 'No logged set found';
  const w = row.weight_kg ?? null;
  const reps = row.reps ?? null;
  if (w == null || reps == null) return 'No logged set found';
  const dateStr = row.date ? String(row.date).slice(0, 10) : null;
  const load = formatPerformedLoad(w, unit, assisted ? { loadConvention: 'assistance_load' } : null)
    || `${formatWeight(w, unit)} ${unit}`;
  let line = `${load} × ${reps}`;
  if (row.rir != null) line += ` · RIR ${Number(row.rir).toFixed(1)}`;
  if (dateStr) line += ` · ${dateStr}`;
  return line;
}

function formatHistoryMetric(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function historyPerformanceParts(
  row: MovementHistorySet | null | undefined,
  unit: 'kg' | 'lb',
  assisted?: boolean,
) {
  if (!row || row.weight_kg == null || row.reps == null) return null;
  const effort = row.rir != null
    ? `RIR ${formatHistoryMetric(row.rir)}`
    : row.rpe != null
      ? `RPE ${formatHistoryMetric(row.rpe)}`
      : null;
  return {
    weight: formatPerformedLoad(row.weight_kg, unit, assisted ? { loadConvention: 'assistance_load' } : null)
      || `${formatWeight(row.weight_kg, unit)} ${unit}`,
    reps: `×${row.reps}`,
    effort,
    date: row.date ? String(row.date).slice(0, 10) : 'Date unavailable',
  };
}

function machineHistoryMetadata(value: string | null | undefined) {
  return equipmentPresentationParts(value, 'Machine');
}

function machineHistoryDisplayName(
  displayName: string | null | undefined,
  manufacturer: string | null | undefined,
) {
  const name = String(displayName || '').trim();
  const brand = String(manufacturer || '').trim().toLocaleLowerCase('en-US');
  if (!name || !brand) return name || 'Machine';
  const parts = name.split('·').map((part) => part.trim()).filter(Boolean);
  const withoutBrand = parts.filter((part) => part.toLocaleLowerCase('en-US') !== brand);
  return withoutBrand.join(' · ') || name;
}

function MovementHistorySummaryTile({
  assisted,
  kind,
  label,
  row,
  unit,
}: {
  assisted: boolean;
  kind: 'recent' | 'best';
  label: string;
  row: MovementHistorySet | null | undefined;
  unit: 'kg' | 'lb';
}) {
  const performance = historyPerformanceParts(row, unit, assisted);
  return (
    <View style={[
      styles.movementHistorySummaryTile,
      kind === 'best'
        ? styles.movementHistorySummaryTileBest
        : styles.movementHistorySummaryTileRecent,
    ]}>
      <View style={styles.movementHistorySummaryLabelRow}>
        <Ionicons
          color={kind === 'best' ? '#76D6AD' : '#BE8CFF'}
          name={kind === 'best' ? 'trophy-outline' : 'time-outline'}
          size={15}
        />
        <Text style={[
          styles.movementHistorySummaryLabel,
          kind === 'best'
            ? styles.movementHistorySummaryLabelBest
            : styles.movementHistorySummaryLabelRecent,
        ]}>
          {label}
        </Text>
      </View>
      {performance ? (
        <>
          <View style={styles.movementHistorySummaryPerformance}>
            <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.movementHistorySummaryWeight}>
              {performance.weight}
            </Text>
            <Text style={styles.movementHistorySummaryReps}>{performance.reps}</Text>
          </View>
          <View style={styles.movementHistorySummaryMeta}>
            {performance.effort ? (
              <Text style={styles.movementHistorySummaryEffort}>{performance.effort}</Text>
            ) : null}
            <Text style={styles.movementHistorySummaryDate}>{performance.date}</Text>
          </View>
        </>
      ) : (
        <Text style={styles.movementHistorySummaryEmpty}>No logged set</Text>
      )}
    </View>
  );
}

function MovementHistoryExactCard({
  assisted,
  row,
  unit,
}: {
  assisted: boolean;
  row: MovementHistorySet;
  unit: 'kg' | 'lb';
}) {
  const performance = historyPerformanceParts(row, unit, assisted);
  if (!performance) return null;
  return (
    <View style={styles.movementHistoryExactCard}>
      <View style={styles.movementHistoryExactPerformance}>
        <Text style={styles.movementHistoryExactWeight}>{performance.weight}</Text>
        <Text style={styles.movementHistoryExactReps}>{performance.reps}</Text>
        {performance.effort ? (
          <Text style={styles.movementHistoryExactEffort}>{performance.effort}</Text>
        ) : null}
      </View>
      <Text style={styles.movementHistoryExactDate}>{performance.date}</Text>
    </View>
  );
}

function MovementHistoryRelatedCard({
  row,
  unit,
}: {
  row: NonNullable<MovementHistory['related_reference_history']>[number];
  unit: 'kg' | 'lb';
}) {
  const performance = historyPerformanceParts(row.last_set, unit, false);
  const metadata = machineHistoryMetadata(row.equipment_type || row.equipment_model);
  const machineName = machineHistoryDisplayName(row.display_name, row.manufacturer);
  return (
    <View style={styles.movementHistoryEquipmentCard}>
      <View style={styles.movementHistoryEquipmentIdentity}>
        <ManufacturerBrandMark hero manufacturerName={row.manufacturer} />
        <View style={styles.movementHistoryEquipmentCopy}>
          <Text numberOfLines={2} style={styles.movementHistoryEquipmentName}>
            {machineName}
          </Text>
          <Text numberOfLines={1} style={styles.movementHistoryEquipmentManufacturer}>
            {row.manufacturer || 'Other'}
          </Text>
        </View>
      </View>
      {metadata.length ? (
        <View style={styles.movementHistoryMetadataChips}>
          {metadata.map((item) => (
            <View key={item} style={styles.movementHistoryMetadataChip}>
              <Text numberOfLines={1} style={styles.movementHistoryMetadataChipText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.movementHistoryEquipmentDivider} />
      {performance ? (
        <View>
          <View style={styles.movementHistoryEquipmentPerformance}>
            <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.movementHistoryEquipmentWeight}>
              {performance.weight}
            </Text>
            <Text style={styles.movementHistoryEquipmentReps}>{performance.reps}</Text>
            {performance.effort ? (
              <View style={styles.movementHistoryEquipmentEffortBadge}>
                <Text style={styles.movementHistoryEquipmentEffort}>{performance.effort}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.movementHistoryEquipmentDate}>{performance.date}</Text>
        </View>
      ) : (
        <Text style={styles.movementHistoryEquipmentEmpty}>No history with this equipment</Text>
      )}
    </View>
  );
}

type SessionScreenMode = 'pre_session' | 'active_session' | 'finished_session';
type CoreWheelKind = 'straight' | 'top' | 'bk' | 'fc';
type SelectedSetVideo = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes?: number | null;
  videoAngle?: string | null;
  thumbnailUri?: string | null;
  submitForReview?: boolean;
};

const VIDEO_UPLOAD_CONNECTION_ERROR =
  'Upload failed due to connection instability. Your set was saved, but the video did not upload. Try again on stronger Wi-Fi or cellular.';

function videoUploadFailureMessage(error: any) {
  const message = String(error?.message || '').trim();
  if (
    !message ||
    /network request failed/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message)
  ) {
    return VIDEO_UPLOAD_CONNECTION_ERROR;
  }
  return message;
}

function videoUploadIntent(selectedVideo: SelectedSetVideo) {
  return selectedVideo.submitForReview === false ? 'archive_only' : 'submitted';
}

const VIDEO_ANGLE_OPTIONS = [
  { slug: 'unknown', label: 'Unknown Angle' },
  { slug: 'front', label: 'Front' },
  { slug: 'side', label: 'Side' },
  { slug: 'front_diagonal', label: 'Front Diagonal' },
  { slug: 'rear_diagonal', label: 'Rear Diagonal' },
  { slug: 'rear', label: 'Rear' },
  { slug: 'other', label: 'Other' },
];

async function createSetVideoThumbnail(videoUri: string): Promise<string | null> {
  if (!VideoThumbnails?.getThumbnailAsync) return null;
  try {
    const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 800,
      quality: 0.72,
    });
    return result?.uri || null;
  } catch (error) {
    console.warn('Video thumbnail generation failed', error);
    return null;
  }
}

type PendingCoreWheelLog = {
  kind: CoreWheelKind;
  itemId: number;
  setIndex?: number;
} | null;
type CoreWheelState = {
  visible: boolean;
  kind: CoreWheelKind;
  itemId: number;
  setIndex?: number;
  title: string;
  subtitle: string;
  targetLine?: string | null;
  prescriptionLine?: string | null;
  weight: string;
  reps: string;
  rpe: string;
  weightOptions: string[];
  repsOptions: string[];
  rpeOptions: string[];
};
type AccessoryWheelState = {
  visible: boolean;
  itemId: number;
  title: string;
  targetLine?: string | null;
  weight: string;
  reps: string;
  rir: string;
  weightOptions: string[];
  repsOptions: string[];
  rirOptions: string[];
  selectedVideo?: SelectedSetVideo | null;
};
type SupersetRoundLoggerEntry = {
  itemId: number;
  title: string;
  prescription: string;
  weight: string;
  reps: string;
  rir: string;
  requiresRir: boolean;
  alreadyLogged: boolean;
  skipped?: boolean;
  loggedResult?: string | null;
  validationError?: string | null;
  weightOptions: string[];
  repsOptions: string[];
  rirOptions: string[];
  repeatLast: {
    weight: string;
    reps: string;
    rir: string;
    preview: string;
  } | null;
};
type SupersetRoundLoggerState = {
  groupLabel: string;
  roundIndex: number;
  roundCount: number;
  activeIndex: number;
  saving: boolean;
  entries: SupersetRoundLoggerEntry[];
};

function deriveScreenMode(status?: string | null): SessionScreenMode {
  const s = String(status || '').toLowerCase();
  if (s === 'in_progress') return 'active_session';
  if (['completed', 'logged', 'done', 'missed_excused'].includes(s)) return 'finished_session';
  return 'pre_session';
}

function positiveInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizedWorkoutVariant(item?: Pick<WorkoutItem, 'variant'> | null): string {
  return String(item?.variant || '').trim().toUpperCase();
}

function numericId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function uniqueLoggedSetIndexesForLogs(logs?: SetLog[] | null): number[] {
  return Array.from(
    new Set(
      (logs || [])
        .map((log) => Number(log.set_index || 0))
        .filter((idx) => Number.isFinite(idx) && idx > 0),
    ),
  ).sort((a, b) => a - b);
}

function isBackdownWorkoutItem(item?: WorkoutItem | null): boolean {
  const variant = normalizedWorkoutVariant(item);
  if (variant === 'BK' || variant === 'BACKDOWN' || variant === 'BACKDOWNS') return true;
  return item?.parent_item_id != null && variant !== 'ACC';
}

function isTopWorkoutItem(item?: WorkoutItem | null): boolean {
  const variant = normalizedWorkoutVariant(item);
  return variant === 'TOP' || variant === 'TOP_BACKDOWN';
}

function isFullCustomWorkoutItem(item?: WorkoutItem | null): boolean {
  return (
    normalizedWorkoutVariant(item) === 'FULL_CUSTOM' ||
    String(item?.scheme || '').trim().toUpperCase() === 'FULL_CUSTOM'
  );
}

function isStraightWorkoutItem(item?: WorkoutItem | null): boolean {
  const variant = normalizedWorkoutVariant(item);
  return variant === 'STRAIGHT' || variant === 'VR' || !variant;
}

function loggedSetCountForWorkout(workout?: WorkoutPayload['workout'] | null) {
  if (!workout) return 0;
  return canonicalLoggedSetCountForSession({
    coreItems: workout.core_items,
    accessoryGroups: workout.accessory_groups,
  });
}

function plannedSetCountForWorkout(workout?: WorkoutPayload['workout'] | null) {
  if (!workout) return 0;
  return programmedSetCountForSession({
    coreItems: workout.core_items,
    accessoryGroups: workout.accessory_groups,
  });
}

function durationEstimateForWorkout(workout?: WorkoutPayload['workout'] | null) {
  if (!workout) return null;
  const lowMinutes = Number(workout.estimated_duration_low_minutes);
  const highMinutes = Number(workout.estimated_duration_high_minutes);
  if (!Number.isFinite(lowMinutes) || !Number.isFinite(highMinutes) || lowMinutes <= 0 || highMinutes <= lowMinutes) {
    return null;
  }
  return {
    lowMinutes,
    highMinutes,
    label: `${lowMinutes}–${highMinutes}`,
    modelVersion: workout.estimated_duration_model_version || 'deterministic-v1',
  };
}

function missingSetLabelsForWorkout(workout?: WorkoutPayload['workout'] | null): string[] {
  if (!workout) return [];
  const missing: string[] = [];
  const formatSetRangeList = (indexes: number[]) => {
    if (!indexes.length) return '';
    const ranges: string[] = [];
    let start = indexes[0];
    let previous = indexes[0];
    for (let idx = 1; idx < indexes.length; idx += 1) {
      const current = indexes[idx];
      if (current === previous + 1) {
        previous = current;
        continue;
      }
      ranges.push(start === previous ? String(start) : `${start}-${previous}`);
      start = current;
      previous = current;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    return ranges.join(', ');
  };
  const missingIndexesForItem = (item: WorkoutItem, indexes: number[]) => {
    const logged = new Set(uniqueLoggedSetIndexesForLogs(item.set_logs || []));
    return indexes.filter((setIndex) => !logged.has(setIndex));
  };
  const addMissingForItem = (
    item: WorkoutItem,
    indexes: number[],
    labelPrefix: string,
    noun = 'Set',
  ) => {
    const missingIndexes = missingIndexesForItem(item, indexes);
    if (!missingIndexes.length) return;
    const plural = missingIndexes.length === 1 ? noun : `${noun}s`;
    missing.push(`${labelPrefix} - ${plural} ${formatSetRangeList(missingIndexes)}`);
  };

  const coreItems = workout.core_items || [];
  for (const core of coreItems) {
    const isBackdown = isBackdownWorkoutItem(core);
    if (isBackdown && core.parent_item_id != null) continue;

    const name = liftDisplayName(core);
    if (isFullCustomWorkoutItem(core)) {
      const planned = Array.isArray(core.planned_sets) ? core.planned_sets : [];
      const plannedIndexes = planned
        .map((ps) => Number(ps?.set_index || 0))
        .filter((idx) => Number.isFinite(idx) && idx > 0)
        .sort((a, b) => a - b);
      const indexes = plannedIndexes.length
        ? plannedIndexes
        : Array.from({ length: positiveInt(core.sets) }).map((_, idx) => idx + 1);
      addMissingForItem(core, indexes, name);
      continue;
    }

    if (isTopWorkoutItem(core)) {
      const topTotal = positiveInt(core.sets);
      addMissingForItem(
        core,
        Array.from({ length: topTotal }).map((_, idx) => idx + 1),
        name,
        'Top',
      );

      const backdowns = coreItems.filter(
        (item) => isBackdownWorkoutItem(item) && numericId(item.parent_item_id) === numericId(core.id),
      );
      backdowns.forEach((backdown) => {
        addMissingForItem(
          backdown,
          Array.from({ length: positiveInt(backdown.sets) }).map((_, idx) => idx + 1),
          name,
          'Backdown',
        );
      });
      continue;
    }

    addMissingForItem(core, Array.from({ length: positiveInt(core.sets) }).map((_, idx) => idx + 1), name);
  }

  for (const group of workout.accessory_groups || []) {
    for (const item of group.items || []) {
      const executionItem = accessoryExecutionItem(item);
      const name = simplifyMobileMovementName(accessoryExecutionName(item));
      addMissingForItem(executionItem, Array.from({ length: positiveInt(executionItem.sets) }).map((_, idx) => idx + 1), name);
    }
  }

  return missing;
}

function firstSessionFocus(workout?: WorkoutPayload['workout'] | null) {
  const coreItems = (workout?.core_items || []).filter((item) => !isBackdownWorkoutItem(item));
  const accessoryCount = (workout?.accessory_groups || []).reduce(
    (sum, group) => sum + (group.items || []).length,
    0,
  );
  const liftKeys = new Set(coreItems.map((item) => String(item.lift || '').toUpperCase()));
  const hasSbd = liftKeys.has('SQ') && liftKeys.has('BN') && liftKeys.has('DL');
  const liftNames = hasSbd
    ? ['SBD']
    : coreItems
        .map((item) => {
          const lift = String(item.lift || '').toUpperCase();
          if (lift === 'SQ') return 'Squat';
          if (lift === 'BN') return 'Bench';
          if (lift === 'DL') return 'Deadlift';
          if (lift === 'OHP') return 'OHP';
          return simplifyMobileMovementName(item.movement || item.lift);
        })
        .filter(Boolean)
        .filter((name, index, arr) => arr.indexOf(name) === index)
        .slice(0, 3);
  const accessoryLabel =
    accessoryCount > 0 ? `${accessoryCount} ${accessoryCount === 1 ? 'Accessory' : 'Accessories'}` : null;
  const parts = [...liftNames, accessoryLabel].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Training';
}

function toWheelWeight(log: SetLog | null | undefined, unit: 'kg' | 'lb') {
  if (log?.actual_weight_kg == null) return '';
  return displayWeightFromKg(log.actual_weight_kg, unit);
}

function repeatLoadLabel(
  item: WorkoutItem | null | undefined,
  log: SetLog,
  unit: 'kg' | 'lb',
): string {
  return formatPerformedLoad(log.actual_weight_kg, unit, itemLoadSemantics(item))
    || `${toWheelWeight(log, unit) || '0'} ${unit}`;
}

function displayWeightFromKg(kg: number | null | undefined, unit: 'kg' | 'lb') {
  if (kg == null || !Number.isFinite(Number(kg))) return '';
  return formatLoggerWeightKg(Number(kg), unit);
}

function formatWheelNumber(value: number) {
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function snapCoreWheelWeight(value: number, unit: 'kg' | 'lb') {
  if (!Number.isFinite(value)) return unit === 'kg' ? 70 : 150;
  return roundLoggerDisplayWeight(value, unit);
}

function weightDisplayToKg(weight: string, fromUnit: 'kg' | 'lb') {
  const value = Number(weight);
  if (!Number.isFinite(value)) return 0;
  return fromUnit === 'kg' ? value : value * KG_PER_LB;
}

function buildCoreWeightOptions(unit: 'kg' | 'lb', defaultValue: string) {
  const options: string[] = [];
  const pushRange = (start: number, end: number, step: number) => {
    for (let n = start; n <= end + 0.0001; n += step) {
      options.push(formatWheelNumber(n));
    }
  };

  if (unit === 'kg') {
    pushRange(20, 68.75, 1.25);
    pushRange(70, 350, 2.5);
  } else {
    pushRange(45, 147.5, 2.5);
    pushRange(150, 800, 5);
  }

  const snapped = formatWheelNumber(snapCoreWheelWeight(Number(defaultValue), unit));
  if (snapped && !options.includes(snapped)) options.push(snapped);
  return options.sort((a, b) => Number(a) - Number(b));
}

function buildAccessoryWeightOptions(unit: 'kg' | 'lb', defaultValue: string) {
  const options: string[] = [];
  const pushRange = (start: number, end: number, step: number) => {
    for (let n = start; n <= end + 0.0001; n += step) {
      options.push(formatWheelNumber(n));
    }
  };

  if (unit === 'kg') {
    pushRange(0, 68.75, 1.25);
    pushRange(70, MAX_ACCESSORY_LOAD_KG, 2.5);
  } else {
    pushRange(0, 147.5, 2.5);
    pushRange(150, MAX_ACCESSORY_LOAD_LB, 5);
  }

  const snapped = formatWheelNumber(snapCoreWheelWeight(Number(defaultValue), unit));
  if (snapped && !options.includes(snapped)) options.push(snapped);
  return options.sort((a, b) => Number(a) - Number(b));
}

function buildEditWeightOptions(mode: 'rpe' | 'rir', unit: 'kg' | 'lb', value: string) {
  const options = mode === 'rpe'
    ? buildCoreWeightOptions(unit, value)
    : buildAccessoryWeightOptions(unit, value);
  const exactValue = formatWheelNumber(Number(value));
  if (Number(value) > 0 && !options.includes(exactValue)) options.push(exactValue);
  return options.sort((a, b) => Number(a) - Number(b));
}

function nearestWheelValue(options: string[], value: string, fallback: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  let best = options[0] || fallback;
  for (const option of options) {
    if (Math.abs(Number(option) - n) < Math.abs(Number(best) - n)) {
      best = option;
    }
  }
  return best || fallback;
}

function loadWheelAllowsZero(item: WorkoutItem): boolean {
  const identity = item.performed_movement_identity || item.movement_identity || null;
  const convention = String(identity?.load_convention || '').trim().toLowerCase();
  return convention === 'bodyweight_only' || convention === 'no_external_load';
}

function nextSetIndexFromEvidence(evidence: readonly SetLoggerLoadEvidence[]): number {
  const logged = new Set(
    evidence
      .map((row) => Number(row.set_index || 0))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  let index = 1;
  while (logged.has(index)) index += 1;
  return index;
}

function coreStagePrescriptionChanged(
  item: WorkoutItem,
  planned: PlannedSet | null | undefined,
): boolean {
  const currentSetIndex = Number(planned?.set_index || 0);
  if (currentSetIndex <= 1) return false;
  const priorPlanned = (item.planned_sets || [])
    .filter((candidate) => Number(candidate.set_index || 0) < currentSetIndex)
    .sort((left, right) => Number(right.set_index || 0) - Number(left.set_index || 0))[0];
  if (!priorPlanned) return false;
  const current = resolveLoggerPrescribedWeight({ item, planned, unit: 'kg' });
  const previous = resolveLoggerPrescribedWeight({ item, planned: priorPlanned, unit: 'kg' });
  return current != null
    && previous != null
    && Math.abs(current.canonicalWeightKg - previous.canonicalWeightKg) > 0.01;
}

function prescribedCoreWeight(item: WorkoutItem, unit: 'kg' | 'lb', planned?: PlannedSet | null) {
  return resolveLoggerPrescribedWeight({
    item,
    planned,
    unit,
  })?.displayValue || '';
}

function defaultCoreWeight({
  item,
  unit,
  currentSetIndex,
  acceptedSet,
  planned,
}: {
  item: WorkoutItem;
  unit: 'kg' | 'lb';
  currentSetIndex: number;
  acceptedSet?: SetLoggerLoadEvidence | null;
  planned?: PlannedSet | null;
}) {
  const prescribedWeightKg = resolveLoggerPrescribedWeight({ item, planned, unit: 'kg' })?.canonicalWeightKg ?? null;
  const resolved = resolveSetLoggerLoadDefault({
    currentSetIndex,
    currentSessionSets: [
      ...(item.set_logs || []),
      ...(acceptedSet ? [acceptedSet] : []),
    ],
    comparableHistory: item.movement_history,
    prescribedWeightKg,
    fallbackWeightKg: unit === 'kg' ? 100 : 225 * KG_PER_LB,
    allowZeroLoad: loadWheelAllowsZero(item),
    preferPrescriptionForStageTransition: coreStagePrescriptionChanged(item, planned),
  });
  return displayWeightFromKg(resolved.weightKg, unit);
}

function defaultCoreReps(item: WorkoutItem, planned?: PlannedSet | null) {
  return String(planned?.reps ?? item.reps ?? 5);
}

function defaultCoreRpe(item: WorkoutItem, planned?: PlannedSet | null) {
  return formatWheelNumber(Number(planned?.rpe_target ?? item.rpe_target ?? 8));
}

function accessoryExecutionItem(item: WorkoutItem): WorkoutItem {
  const identity = resolveLoggerMovementIdentity(item);
  return {
    ...item,
    movement: identity.displayName,
    sets: item.performed_sets ?? item.sets,
    reps_text: item.performed_reps_text || item.reps_text,
    rir_target: item.performed_rir_target ?? item.rir_target,
  };
}

function accessoryExecutionName(item: WorkoutItem) {
  return accessoryExecutionItem(item).movement || 'Accessory';
}

function accessoryRepsDefault(item: WorkoutItem) {
  item = accessoryExecutionItem(item);
  const raw = String(item.reps_text || item.reps || '').trim();
  if (!raw || /amrap/i.test(raw)) return '10';
  const matches = raw.match(/\d+/g);
  if (!matches?.length) return '10';
  return matches[matches.length - 1] || '10';
}

function accessoryTargetLine(item: WorkoutItem) {
  item = accessoryExecutionItem(item);
  const base = `${positiveInt(item.sets)}×${item.reps_text || item.reps || '—'}`;
  if (item.rir_target == null) return base;
  return `${base} @${formatWheelNumber(Number(item.rir_target))} RIR`;
}

function defaultAccessoryWeight({
  item,
  unit,
  currentSetIndex,
  acceptedSet,
}: {
  item: WorkoutItem;
  unit: 'kg' | 'lb';
  currentSetIndex: number;
  acceptedSet?: SetLoggerLoadEvidence | null;
}) {
  const prescribedWeightKg = resolveLoggerPrescribedWeight({ item, unit: 'kg' })?.canonicalWeightKg ?? null;
  const resolved = resolveSetLoggerLoadDefault({
    currentSetIndex,
    currentSessionSets: [
      ...(item.set_logs || []),
      ...(acceptedSet ? [acceptedSet] : []),
    ],
    comparableHistory: item.movement_history,
    prescribedWeightKg,
    fallbackWeightKg: 0,
    allowZeroLoad: loadWheelAllowsZero(item),
  });
  return displayWeightFromKg(resolved.weightKg, unit);
}

function defaultAccessoryRir(item: WorkoutItem) {
  return formatWheelNumber(Number(accessoryExecutionItem(item).rir_target ?? 2));
}

function completedSetSummary(logs: SetLog[], totalSets: number, unit: 'kg' | 'lb', metric: 'rpe' | 'rir') {
  const count = logs.length;
  const header = `${count}/${totalSets || count} sets logged`;
  if (!count) return { meta: header, top: null };

  const avgWeightKg =
    logs.reduce((sum, log) => sum + Number(log.actual_weight_kg || 0), 0) / count;
  const avgReps =
    logs.reduce((sum, log) => sum + Number(log.actual_reps || 0), 0) / count;
  const metricValues = logs
    .map((log) => metric === 'rpe' ? log.actual_rpe : log.actual_rir)
    .filter((value) => value != null && Number.isFinite(Number(value))) as number[];
  const avgMetric = metricValues.length
    ? metricValues.reduce((sum, value) => sum + Number(value), 0) / metricValues.length
    : null;

  const top = [...logs].sort((a, b) => {
    const aScore = Number(a.actual_weight_kg || 0) * (1 + Number(a.actual_reps ?? 0) / 30);
    const bScore = Number(b.actual_weight_kg || 0) * (1 + Number(b.actual_reps ?? 0) / 30);
    return bScore - aScore;
  })[0] || null;

  const avgParts = [`${formatWeight(avgWeightKg, unit)} ${unit}`, `× ${formatWheelNumber(avgReps)}`];
  if (avgMetric != null) {
    avgParts.push(metric === 'rpe' ? `@${formatWheelNumber(avgMetric)} avg` : `@${formatWheelNumber(avgMetric)} RIR avg`);
  } else {
    avgParts.push('avg');
  }

  const topMetric = metric === 'rpe' ? top?.actual_rpe : top?.actual_rir;
  const topLine = top
    ? `Top: ${formatWeight(top.actual_weight_kg, unit)} ${unit}${top.actual_reps === 0 ? ' × Failed' : top.actual_reps != null ? ` × ${top.actual_reps}` : ''}${topMetric != null ? (metric === 'rpe' ? ` @${formatWheelNumber(Number(topMetric))}` : ` @${formatWheelNumber(Number(topMetric))} RIR`) : ''}`
    : null;

  return {
    meta: `${header} · ${avgParts.join(' ')}`,
    top: topLine,
  };
}

export default function WorkoutViewerScreen() {
  const {
    workoutId,
    loggerScenario,
    loggerLifecycle,
    returnTo,
    athleteView,
    returnSection,
    coachAthleteId,
    coachProgrammingBlockId,
    coachProgrammingWeek,
    coachProgrammingDay,
  } = useLocalSearchParams<{
    workoutId?: string;
    loggerScenario?: string;
    loggerLifecycle?: string;
    returnTo?: string;
    athleteView?: string;
    returnSection?: string;
    coachAthleteId?: string;
    coachProgrammingBlockId?: string;
    coachProgrammingWeek?: string;
    coachProgrammingDay?: string;
  }>();
  const coachPreviewRequested = athleteView === 'coach-preview';
  const router = useRouter();
  const devPreviewSession = useDevLiveScreenSession();
  const canonicalLoggerEntryLifecycle = workoutDetailLifecycleForEntryId(
    devPreviewSession?.entryId,
  );
  const isIdealWorkoutDetailPreview =
    __DEV__ &&
    devPreviewSession?.mode === 'ideal' &&
    canonicalLoggerEntryLifecycle != null;
  const idealWorkoutDetailLifecycle =
    canonicalLoggerEntryLifecycle
    || normalizeWorkoutDetailLifecycle(loggerLifecycle)
    || 'active_session';
  const { user } = useAuth(); // we only need session + role to decide logging availability
  const insets = useSafeAreaInsets();
  const isIndividualUser =
    user?.workspace_mode === 'individual' ||
    user?.is_individual_workspace === true ||
    user?.is_self_coached === true;

  const unitLocalOverrideRef = useRef<'kg' | 'lb' | null>(null);
  const [unit, setUnit] = useState<'kg' | 'lb'>(() => normalizeReadinessUnit(user?.preferred_units));
  const unitPreferenceHydratedRef = useRef(false);
  const [data, setData] = useState<WorkoutPayload | null>(null);
  const workoutRequestManagerRef = useRef(createLatestRequestManager<WorkoutPayload>());
  const resumeRefreshRef = useRef<() => void>(() => undefined);
  const loggerAppStateRef = useRef(AppState.currentState);
  const loggerRecoveryGateRef = useRef(createSessionLoggerRecoveryGate());
  const bodyRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenMountedRef = useRef(true);
  const hasFocusedLoggerRef = useRef(false);
  const [bodyRenderGeneration, setBodyRenderGeneration] = useState(0);
  const [bodyRecoveryFailed, setBodyRecoveryFailed] = useState(false);
  const acceptedLoadByItemIdRef = useRef<Record<number, SetLoggerLoadEvidence>>({});
  const [acceptedSetEvidenceItemIds, setAcceptedSetEvidenceItemIds] = useState<
    ReadonlySet<number>
  >(() => new Set());
  useEffect(() => {
    if (unitPreferenceHydratedRef.current || !user) return;
    if (unitLocalOverrideRef.current == null) {
      setUnit(normalizeReadinessUnit(user.preferred_units));
    }
    unitPreferenceHydratedRef.current = true;
  }, [user]);
  useEffect(() => {
    const isLogging = String(data?.workout?.status || '').toLowerCase() === 'in_progress';
    setUpdateBlocker('workout', isLogging);
    return () => setUpdateBlocker('workout', false);
  }, [data?.workout?.status]);
  const isRewardLoopDemoV2 = __DEV__ && String(data?.workout?.label || '').startsWith('V2 DEMO');
  const rewardLoopDemoV2StorageScope = data?.workout
    ? `${isRewardLoopDemoV2 ? 'mobile-reward-loop-v2:' : ''}${workoutId || data.workout.id}`
    : null;
  const rewardLoopDemoV2Log = useCallback((stage: string, details: Record<string, unknown> = {}) => {
    if (!isRewardLoopDemoV2) return;
    console.info('[RewardLoopDemoV2]', stage, details);
  }, [isRewardLoopDemoV2]);
  const [completedSetSwipeTooltipShown, setCompletedSetSwipeTooltipShown] = useState<boolean | null>(null);
  const [completedSetSwipeTooltipCandidateSetLogId, setCompletedSetSwipeTooltipCandidateSetLogId] = useState<number | null>(null);
  const [completedSetSwipeTooltipSetLogId, setCompletedSetSwipeTooltipSetLogId] = useState<number | null>(null);
  const completedSetSwipeTooltipSessionKey = data?.workout?.started_at
    ? `${rewardLoopDemoV2StorageScope}:${data.workout.started_at}`
    : rewardLoopDemoV2StorageScope;
  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());
  const [sessionClockForeground, setSessionClockForeground] = useState(
    () => AppState.currentState == null || AppState.currentState === 'active',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCompletedSetSwipeTooltipShown(null);
    setCompletedSetSwipeTooltipCandidateSetLogId(null);
    setCompletedSetSwipeTooltipSetLogId(null);
    if (!completedSetSwipeTooltipSessionKey) return () => { cancelled = true; };

    void hasCompletedSetSwipeTooltipBeenShown(completedSetSwipeTooltipSessionKey).then((shown) => {
      if (!cancelled) setCompletedSetSwipeTooltipShown(shown);
    }).catch(() => {
      if (!cancelled) setCompletedSetSwipeTooltipShown(false);
    });

    return () => { cancelled = true; };
  }, [completedSetSwipeTooltipSessionKey]);
  const [straightInputs, setStraightInputs] = useState<
    Record<number, { weight: string; reps: string; rpe: string }>
  >({});
  const [topInputs, setTopInputs] = useState<
    Record<number, { weight: string; reps: string; rpe: string }>
  >({});
  const [bkInputs, setBkInputs] = useState<
    Record<number, { weight: string; reps: string; rpe: string }>
  >({});
  const [fcInputs, setFcInputs] = useState<
    Record<string, { weight: string; reps: string; rpe: string }>
  >({});
  const [coreWheel, setCoreWheel] = useState<CoreWheelState | null>(null);
  const [pendingCoreWheelLog, setPendingCoreWheelLog] = useState<PendingCoreWheelLog>(null);
  const [accessoryWheel, setAccessoryWheel] = useState<AccessoryWheelState | null>(null);
  const [supersetRoundLogger, setSupersetRoundLogger] =
    useState<SupersetRoundLoggerState | null>(null);
  const supersetRoundSaveInFlightRef = useRef(false);
  const supersetRoundTransitionInFlightRef = useRef(false);
  const supersetRoundTransitionTokenRef = useRef(0);
  const [supersetRoundTransitioning, setSupersetRoundTransitioning] = useState(false);
  const [supersetRoundCapturedIndex, setSupersetRoundCapturedIndex] =
    useState<number | null>(null);
  const [supersetRoundProgressIndex, setSupersetRoundProgressIndex] =
    useState<number | null>(null);
  const supersetRoundStepOpacity = useRef(new Animated.Value(1)).current;
  const supersetRoundStepTranslateX = useRef(new Animated.Value(0)).current;
  const supersetRoundProgressFill = useRef(new Animated.Value(1)).current;
  const supersetRoundCapturedPulse = useRef(new Animated.Value(0)).current;
  const supersetRoundCapturedCueOpacity = useRef(new Animated.Value(0)).current;
  const [pendingAccessoryLogItemId, setPendingAccessoryLogItemId] = useState<any>(null);
  const [expandedCompletedMovements, setExpandedCompletedMovements] = useState<Record<string, boolean>>({});
  const [expandedCoreDetails, setExpandedCoreDetails] = useState<Record<string, boolean>>({});
  const [reduceMotion, setReduceMotion] = useState(false);
  const manualMovementSelectionRef = useRef(false);
  const pendingAutoAdvanceRef = useRef<{ fromKey: string | null } | null>(null);
  const autoExpandWorkoutIdRef = useRef<number | null>(null);
  const movementCardRefs = useRef<Record<string, any>>({});
  const scrollViewportHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const [setVideoPlayer, setSetVideoPlayer] = useState<SetVideoPlayerState>({
    visible: false,
    videoId: null,
    initialUrl: null,
    initialVideo: null,
  });
  const [pendingRowVideoUpload, setPendingRowVideoUpload] = useState<{
    setLogId: number;
    selectedVideo: SelectedSetVideo;
  } | null>(null);
  const [videoMlTrainingConsent, setVideoMlTrainingConsent] = useState<boolean | null | undefined>(undefined);
  const videoIntentOptions = useMemo(
    () => isIndividualUser
      ? [{ submitForReview: false, title: 'Save to Archive', body: 'Store it for your own review.' }]
      : [
          { submitForReview: false, title: 'Save to Archive', body: 'Store it for your own reference.' },
          { submitForReview: true, title: 'Submit to Coach', body: 'Send it to your coach for review.' },
        ],
    [isIndividualUser]
  );

  const updateFcInput = (
    key: string,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => {
    let v = value ?? '';

    if (field === 'reps') {
      v = v.replace(/[^0-9]/g, '');
    } else {
      v = v.replace(/[^0-9.]/g, '');
      const d = v.indexOf('.');
      if (d !== -1) v = v.slice(0, d + 1) + v.slice(d + 1).replace(/\./g, '');
    }

    setFcInputs((prev) => ({
      ...prev,
      [key]: {
        weight: prev[key]?.weight || '',
        reps: prev[key]?.reps || '',
        rpe: prev[key]?.rpe || '',
        [field]: v,
      },
    }));
  };

  const [accInputs, setAccInputs] = useState<
    Record<number, { weight: string; reps: string; rir: string }>
  >({});
  const updateAccInput = (
    itemId: number,
    field: 'weight' | 'reps' | 'rir',
    value: string,
  ) => {
    // iOS/Expo numeric keyboards can emit spaces/newlines or locale characters.
    // Sanitize at the point of entry so state is always clean.
    let v = value ?? '';

    if (field === 'reps') {
      // reps must be an integer; keep digits only
      v = v.replace(/[^0-9]/g, '');
    } else if (field === 'weight') {
      // allow digits + one decimal point
      v = v.replace(/[^0-9.]/g, '');
      const firstDot = v.indexOf('.');
      if (firstDot !== -1) {
        // remove any additional dots
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
      }
    } else if (field === 'rir') {
      // allow digits + one decimal point + optional leading minus
      v = v.replace(/[^0-9.\-]/g, '');
      // only keep a single leading minus
      v = v.replace(/(?!^)-/g, '');
      const firstDot = v.indexOf('.');
      if (firstDot !== -1) {
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
      }
    }

    setAccInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: prev[itemId]?.weight || '',
        reps: prev[itemId]?.reps || '',
        rir: prev[itemId]?.rir || '',
        [field]: v,
      },
    }));
  };

  const uniqueLoggedSetIndexes = (logs?: SetLog[] | null) => uniqueLoggedSetIndexesForLogs(logs);

  const loggedSetIndexCount = (logs?: SetLog[] | null) => uniqueLoggedSetIndexes(logs).length;

  const nextMissingSetIndex = (logs: SetLog[] | null | undefined, total: number) => {
    const indexes = new Set(uniqueLoggedSetIndexes(logs));
    for (let idx = 1; idx <= total; idx += 1) {
      if (!indexes.has(idx)) return idx;
    }
    return null;
  };

  const coreDetailExpansionKey = (id: number | string) => `core-detail:${id}`;

  const getOrderedWorkoutMovements = useCallback((workout?: WorkoutPayload['workout'] | null) => {
    if (!workout) return [];
    const rows: Array<{
      key: string;
      detailKey: string;
      kind: 'core' | 'accessory';
      id: number;
      complete: boolean;
      logged: number;
      total: number;
    }> = [];

    const coreItems = workout.core_items || [];
    for (const core of coreItems) {
      const isBackdown = isBackdownWorkoutItem(core);
      if (isBackdown && core.parent_item_id != null) continue;

      const isTop = isTopWorkoutItem(core);
      const isFullCustom = isFullCustomWorkoutItem(core);
      const backdownsForThisTop = isTop
        ? coreItems.filter((it) => isBackdownWorkoutItem(it) && numericId(it.parent_item_id) === numericId(core.id))
        : [];
      const topLogs = isTop ? (core.set_logs || []) : [];
      const topTotal = isTop ? positiveInt(core.sets) : 0;
      const backdownTotal = backdownsForThisTop.reduce((sum, bd) => sum + positiveInt(bd.sets), 0);
      const total = isFullCustom
        ? (Array.isArray(core.planned_sets) ? core.planned_sets.length : 0)
        : isTop
        ? topTotal + backdownTotal
        : positiveInt(core.sets);
      const logged = isTop
        ? loggedSetIndexCount(topLogs) + backdownsForThisTop.reduce((sum, bd) => sum + loggedSetIndexCount(bd.set_logs || []), 0)
        : loggedSetIndexCount(core.set_logs || []);

      rows.push({
        key: `core:${core.id}`,
        detailKey: coreDetailExpansionKey(core.id),
        kind: 'core',
        id: core.id,
        complete: total > 0 && logged >= total,
        logged,
        total,
      });
    }

    for (const group of workout.accessory_groups || []) {
      if (isIdealWorkoutDetailPreview && group.group) {
        const roundModel = buildSupersetRoundModel(group.items || []);
        const firstItemId = Number(group.items?.[0]?.id || 0);
        rows.push({
          key: `ss:${group.group}`,
          detailKey: `ss:${group.group}`,
          kind: 'accessory',
          id: firstItemId,
          complete: roundModel.status === 'complete',
          logged: roundModel.completedRounds,
          total: roundModel.roundCount,
        });
        continue;
      }
      for (const item of group.items || []) {
        const logs = item.set_logs || [];
        const total = positiveInt(item.sets);
        const logged = loggedSetIndexCount(logs);
        rows.push({
          key: `acc:${item.id}`,
          detailKey: `acc:${item.id}`,
          kind: 'accessory',
          id: item.id,
          complete: total > 0 && logged >= total,
          logged,
          total,
        });
      }
    }

    return rows;
  }, [isIdealWorkoutDetailPreview]);

  const findRenderedMovementKeyForItem = useCallback((
    workout: WorkoutPayload['workout'] | null | undefined,
    itemId: number,
  ) => {
    if (!workout) return null;
    const coreItems = workout.core_items || [];
    for (const core of coreItems) {
      const isBackdown = isBackdownWorkoutItem(core);
      if (isBackdown && core.parent_item_id != null) continue;
      if (core.id === itemId) return `core:${core.id}`;
      const isTop = isTopWorkoutItem(core);
      if (isTop) {
        const ownsBackdown = coreItems.some(
          (it) =>
            isBackdownWorkoutItem(it) &&
            numericId(it.parent_item_id) === numericId(core.id) &&
            numericId(it.id) === numericId(itemId),
        );
        if (ownsBackdown) return `core:${core.id}`;
      }
    }

    for (const group of workout.accessory_groups || []) {
      if (
        isIdealWorkoutDetailPreview
        && group.group
        && group.items.some((item) => item.id === itemId)
      ) {
        return `ss:${group.group}`;
      }
      for (const item of group.items || []) {
        if (item.id === itemId) return `acc:${item.id}`;
      }
    }

    return null;
  }, [isIdealWorkoutDetailPreview]);

  const openMovementCard = useCallback((key: string | null | undefined) => {
    if (!key) return;
    if (key.startsWith('core:')) {
      const id = key.slice('core:'.length);
      setExpandedCoreDetails((prev) => ({ ...prev, [coreDetailExpansionKey(id)]: true }));
      return;
    }
    if (key.startsWith('acc:') || key.startsWith('ss:')) {
      setExpandedCompletedMovements((prev) => ({ ...prev, [key]: true }));
    }
  }, []);

  const collapseMovementCard = useCallback((key: string | null | undefined) => {
    if (!key) return;
    if (key.startsWith('core:')) {
      const id = key.slice('core:'.length);
      setExpandedCoreDetails((prev) => {
        const detailKey = coreDetailExpansionKey(id);
        if (!prev[detailKey]) return prev;
        return { ...prev, [detailKey]: false };
      });
      return;
    }
    if (key.startsWith('acc:') || key.startsWith('ss:')) {
      setExpandedCompletedMovements((prev) => {
        if (!prev[key]) return prev;
        return { ...prev, [key]: false };
      });
    }
  }, []);

  const toggleMovementCard = useCallback((key: string) => {
    manualMovementSelectionRef.current = true;
    if (key.startsWith('core:')) {
      const detailKey = coreDetailExpansionKey(key.slice('core:'.length));
      setExpandedCoreDetails((prev) => ({ ...prev, [detailKey]: !prev[detailKey] }));
      return;
    }
    setExpandedCompletedMovements((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const markAutoAdvanceAfterLog = useCallback((itemId: number) => {
    pendingAutoAdvanceRef.current = {
      fromKey: findRenderedMovementKeyForItem(dataRef.current?.workout, itemId),
    };
  }, [findRenderedMovementKeyForItem]);

  const markAutoAdvanceAfterAcceptedLog = useCallback((itemId: number, result: any) => {
    if (isNewCanonicalSessionFinalSet({
      created: result?.created,
      replayed: result?.replayed,
      completionBoundary: result?.completion_boundary,
    })) {
      pendingAutoAdvanceRef.current = null;
      return;
    }
    markAutoAdvanceAfterLog(itemId);
  }, [markAutoAdvanceAfterLog]);

  const scrollRef = useRef<any>(null);
  const scrollYRef = useRef(0);
  const pendingRestoreScrollYRef = useRef<number | null>(null);

  const registerMovementCardRef = useCallback((key: string) => (node: any) => {
    if (node) movementCardRefs.current[key] = node;
    else delete movementCardRefs.current[key];
  }, []);

  const scrollMovementIntoView = useCallback((key: string) => {
    const node = movementCardRefs.current[key];
    if (!node || !scrollRef.current) return;
    try {
      const nodeHandle = findNodeHandle(node);
      const scrollNode = scrollRef.current.getInnerViewNode?.() || scrollRef.current;
      const scrollHandle = findNodeHandle(scrollNode);
      if (!nodeHandle || !scrollHandle) return;
      UIManager.measureLayout(
        nodeHandle,
        scrollHandle,
        () => {},
        (_x: number, cardTop: number, _width: number, cardHeight: number) => {
          const viewportHeight = scrollViewportHeightRef.current;
          const contentHeight = Math.max(
            scrollContentHeightRef.current,
            cardTop + cardHeight,
            scrollYRef.current + viewportHeight,
          );
          const targetY = movementScrollTarget({
            cardTop,
            cardHeight,
            scrollY: scrollYRef.current,
            viewportHeight,
            contentHeight,
          });
          if (targetY == null) return;
          scrollRef.current?.scrollTo({ y: targetY, animated: !reduceMotion });
        },
      );
    } catch {}
  }, [reduceMotion]);

  const scheduleMovementFocus = useCallback((key: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollMovementIntoView(key));
    });
  }, [scrollMovementIntoView]);

  const configureNextMovementLayoutTransition = useCallback(() => {
    if (reduceMotion) return;
    LayoutAnimation.configureNext({
      duration: SLMotion.spatialMs,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  }, [reduceMotion]);

  // --- Keyboard + focus helpers so active log row stays visible ---
  const inputRefs = useRef<Record<string, any>>({});

  const scrollToNode = (node: any) => {
    if (!node || !scrollRef.current) return;

    try {
      // IMPORTANT: measureLayout must be called with native node handles.
      // TextInput refs can sometimes be non-native (composite) depending on platform/runtime.
      // Using UIManager.measureLayout avoids the warning and works reliably.
      const nodeHandle = findNodeHandle(node);
      const scrollNode = (scrollRef.current as any).getInnerViewNode?.() || scrollRef.current;
      const scrollHandle = findNodeHandle(scrollNode);

      if (!nodeHandle || !scrollHandle) return;

      UIManager.measureLayout(
        nodeHandle,
        scrollHandle,
        () => {},
        (_x: number, y: number) => {
          const targetY = Math.max(0, y - 120);
          scrollRef.current?.scrollTo({ y: targetY, animated: true });
        }
      );
    } catch {}
  };

  const focusField = (key: string) => {
    const ref = inputRefs.current[key];
    if (ref?.focus) {
      ref.focus();
      // Scroll after focus so we land on the correct position
      requestAnimationFrame(() => scrollToNode(ref));
    }
  };

  const registerRef = (key: string) => (ref: any) => {
    if (ref) inputRefs.current[key] = ref;
  };
  const [refreshing, setRefreshing] = useState(false);
  const dataRef = useRef<WorkoutPayload | null>(null);

  const rememberScroll = () => {
    pendingRestoreScrollYRef.current = scrollYRef.current;
  };

  const restoreScrollSoon = () => {
    const y = pendingRestoreScrollYRef.current;
    if (y == null) return;
    pendingRestoreScrollYRef.current = null;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  };

  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const setSubmissionAttemptsRef = useRef<Record<string, SetSubmissionAttempt>>({});
  const processedSetResultsRef = useRef(createCanonicalSetResultGate());
  const canonicalSetSubmissionControllerRef = useRef(createCanonicalSetSubmissionController());
  const [feedbackState, feedbackDispatch] = useReducer(loggerFeedbackReducer, initialLoggerFeedbackState);
  const feedbackStateRef = useRef(feedbackState);
  feedbackStateRef.current = feedbackState;
  const [animatedCompletionSummaryId, setAnimatedCompletionSummaryId] = useState<string | null>(null);
  const freshCompletionSummaryIdRef = useRef<string | null>(null);
  const saveFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptedSheetHandoffControllerRef = useRef(createLogSheetHandoffController());
  const timerHandoffReleaseControllerRef = useRef(createTimerHandoffReleaseController());
  const activeTimerHandoffIdentityRef = useRef<string | null>(null);
  const transientTraceContextRef = useRef({
    workoutItemId: null as number | null,
    setLogId: null as number | null,
    clientSubmissionId: null as string | null,
    eventId: null as number | null,
    eventType: null as string | null,
  });
  const recognitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submissionStartedAtRef = useRef<number | null>(null);
  const lastAcceptedAtRef = useRef<number | null>(null);
  const timerOverlapReportedRef = useRef(false);
  const recognitionDisplayTelemetryRef = useRef<Set<string>>(new Set());
  const recognitionPromotionTraceRef = useRef<string | null>(null);
  const recognitionReleaseEvaluationTraceRef = useRef<string | null>(null);

  const transientRecognitionTrace = useCallback((checkpoint: number, message: string, details: Record<string, unknown> = {}) => {
    if (!__DEV__ || !isRewardLoopDemoV2) return;
    const context = transientTraceContextRef.current;
    const state = feedbackStateRef.current;
    console.info('[TransientRecognitionTrace]', {
      checkpoint,
      message,
      workout_id: Number(workoutId || data?.workout?.id || 0) || null,
      workout_item_id: context.workoutItemId,
      set_log_id: context.setLogId,
      client_submission_id: context.clientSubmissionId,
      event_id: context.eventId,
      event_type: context.eventType,
      recognition_lifecycle_state: `submission:${state.submission.status}|timer:${state.timer.status}|recognition:${state.recognition.status}`,
      ...details,
    });
  }, [data?.workout?.id, isRewardLoopDemoV2, workoutId]);

  const beginFeedbackSubmission = useCallback((itemId: number) => {
    acceptedSheetHandoffControllerRef.current.cancelPending();
    const now = Date.now();
    if (lastAcceptedAtRef.current != null) {
      feedbackAnalytics('time_from_set_acceptance_to_next_log_action', { latency_ms: now - lastAcceptedAtRef.current });
    }
    submissionStartedAtRef.current = now;
    feedbackDispatch({ type: 'SUBMIT_STARTED', itemId });
  }, []);

  const submissionForAttempt = useCallback((key: string, payload: object) => {
    const signature = JSON.stringify(payload);
    const existing = setSubmissionAttemptsRef.current[key];
    if (existing?.signature === signature) return existing.id;
    const id = createSetSubmissionId();
    setSubmissionAttemptsRef.current[key] = { id, signature };
    return id;
  }, []);

  const consumeSetResultOnce = useCallback((key: string, clientSubmissionId: string, json: any) => {
    if (!processedSetResultsRef.current.consume(String(workoutId || ''), clientSubmissionId, json)) return false;
    delete setSubmissionAttemptsRef.current[key];
    return true;
  }, [workoutId]);

  const handleCanonicalSetFeedback = useCallback((json: any, submittedItemId?: number) => {
    const setLogId = Number(json?.set?.id || 0);
    const acceptedItemId = Number(
      json?.set?.item_id
      || json?.item_id
      || submittedItemId
      || feedbackStateRef.current.submission.activeItemId
      || 0,
    );
    if (setLogId > 0 && acceptedItemId > 0) {
      setAcceptedSetEvidenceItemIds((current) => {
        if (current.has(acceptedItemId)) return current;
        return new Set([...current, acceptedItemId]);
      });
    }
    const clientSubmissionId = String(json?.client_submission_id || json?.set?.client_submission_id || '') || null;
    const responseEvents = Array.isArray(json?.recognition_events) ? json.recognition_events as LoggerRecognitionEvent[] : [];
    const rawEvents = attachTransientRecognitionDelivery(responseEvents, {
      workoutId: String(workoutId || json?.workout_id || ''),
      clientSubmissionId,
    });
    const events = selectCelebrationEvents(rawEvents);
    const primary = events[0] || null;
    transientTraceContextRef.current = {
      workoutItemId: Number(primary?.source?.workout_item_id || feedbackStateRef.current.submission.activeItemId || 0) || null,
      setLogId: setLogId || null,
      clientSubmissionId,
      eventId: primary?.id ?? null,
      eventType: primary?.event_type ?? null,
    };
    transientRecognitionTrace(1, 'canonical set-log response received');
    transientRecognitionTrace(2, 'canonical response creation state', {
      created: json?.created === true,
      replayed: json?.replayed === true,
    });
    transientRecognitionTrace(3, 'raw accomplishment events received', {
      events: rawEvents.map((event) => ({ id: event.id, type: event.event_type })),
    });
    transientRecognitionTrace(4, 'eligible transient events after filtering', {
      events: events.map((event) => ({ id: event.id, type: event.event_type })),
    });
    transientRecognitionTrace(5, 'canonical primary event selected', {
      primary_event_id: primary?.id ?? null,
      primary_event_type: primary?.event_type ?? null,
    });
    transientRecognitionTrace(6, 'secondary event count calculated', {
      secondary_count: primary?.secondary_highlight_count || 0,
    });
    rewardLoopDemoV2Log('canonical_response_received', {
      created: json?.created === true,
      replayed: json?.replayed === true,
      client_submission_id: json?.client_submission_id || json?.set?.client_submission_id || null,
      eligible_events: rawEvents.map((event) => ({ id: event.id, type: event.event_type })),
    });
    rewardLoopDemoV2Log('transient_selection', {
      primary: events[0] ? { id: events[0].id, type: events[0].event_type } : null,
      secondary_highlight_count: events[0]?.secondary_highlight_count || 0,
    });
    feedbackDispatch({
      type: 'SUBMIT_SUCCEEDED',
      setLogId,
      created: json?.created === true,
      replayed: json?.replayed === true,
      events: rawEvents,
      completionBoundary: json?.completion_boundary?.authority === 'canonical' ? json.completion_boundary : null,
    });
    if (events.length && json?.created === true && json?.replayed !== true) {
      transientRecognitionTrace(7, 'transient recognition enqueued');
    }
    transientRecognitionTrace(8, 'durable accomplishment events retained', {
      durable_event_count: responseEvents.length,
    });
    if (json?.created !== true) {
      feedbackAnalytics('recognition_replay_suppressed', { set_log_id: setLogId, replayed: json?.replayed === true });
      return;
    }
    const acceptedAt = Date.now();
    lastAcceptedAtRef.current = acceptedAt;
    feedbackAnalytics('canonical_save_accepted', { set_log_id: setLogId, created: true });
    feedbackAnalytics('set_save_feedback_latency', {
      latency_ms: submissionStartedAtRef.current != null ? acceptedAt - submissionStartedAtRef.current : null,
      set_log_id: setLogId,
    });
    if (events.length && rewardLoopDemoV2StorageScope) {
      void persistPendingRecognition(rewardLoopDemoV2StorageScope, events).then(() => {
        rewardLoopDemoV2Log('recognition_queued', { count: events.length });
      }).catch(() => {
        feedbackAnalytics('recognition_consumption_storage_failed', { count: events.length });
      });
      events.forEach((event) => feedbackAnalytics('recognition_event_received', { event_id: event.id, event_type: event.event_type, priority: event.priority }));
      feedbackAnalytics('recognition_event_queued', { count: events.length, primary_priority: events[0]?.priority });
    }
    void triggerAcceptedSetHaptic(events).then((hapticKind) => {
      feedbackAnalytics('haptic_triggered', { kind: hapticKind, event_count: events.length });
    });
    feedbackAnalytics('set_save_feedback_shown', { set_log_id: setLogId, event_count: events.length });
    if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
    saveFeedbackTimerRef.current = setTimeout(() => {
      feedbackDispatch({ type: 'SAVE_CONFIRMATION_FINISHED' });
    }, SLMotion.saveConfirmationMs);
  }, [rewardLoopDemoV2Log, rewardLoopDemoV2StorageScope, transientRecognitionTrace, workoutId]);

  const handleCanonicalSetFailure = useCallback((error: any) => {
    acceptedSheetHandoffControllerRef.current.cancelPending();
    const message = String(error?.message || error || '');
    const staleConflict = /stale|already been logged|conflict|refresh/i.test(message);
    feedbackDispatch({ type: 'SUBMIT_FAILED', staleConflict });
    void triggerSubmissionFailureHaptic();
    feedbackAnalytics('set_save_feedback_failure', { stale_conflict: staleConflict });
    return staleConflict;
  }, []);

  const submitCanonicalSet = useCallback(async ({
    itemId,
    attemptKey,
    clientSubmissionId,
    request,
    fallbackError,
  }: {
    itemId: number;
    attemptKey: string;
    clientSubmissionId: string;
    request: () => Promise<any>;
    fallbackError: string;
  }) => {
    const outcome = await canonicalSetSubmissionControllerRef.current.run({
      onStarted: () => {
        beginFeedbackSubmission(itemId);
        setSavingItemId(itemId);
        setError(null);
      },
      request,
      onAccepted: (json) => {
        if (!consumeSetResultOnce(attemptKey, clientSubmissionId, json)) {
          feedbackAnalytics('recognition_replay_suppressed', {
            set_log_id: Number(json?.set?.id || 0),
            duplicate_local_result: true,
          });
          const replay = { ...json, created: false, replayed: true };
          handleCanonicalSetFeedback(replay, itemId);
          return replay;
        }
        handleCanonicalSetFeedback(json, itemId);
        return json;
      },
      onFailure: (error: any) => {
        handleCanonicalSetFailure(error);
        setError(error?.message || fallbackError);
      },
      onSettled: () => setSavingItemId(null),
    });

    if (outcome.status === 'failed') {
      console.log('canonical set submission error', outcome.error);
      return null;
    }
    if (outcome.status !== 'accepted') return null;
    return outcome.value;
  }, [beginFeedbackSubmission, consumeSetResultOnce, handleCanonicalSetFailure, handleCanonicalSetFeedback]);

  const rememberAcceptedLoad = useCallback((
    itemId: number,
    setIndex: number,
    actualWeightKg: number,
  ) => {
    acceptedLoadByItemIdRef.current[itemId] = {
      set_index: setIndex,
      actual_weight_kg: actualWeightKg,
    };
  }, []);

  const intendedSetIndex = useCallback((itemId: number) => {
    const item = data?.workout?.core_items?.find((row: any) => Number(row?.id) === Number(itemId));
    const total = Math.max(0, Number(item?.sets || 0));
    const logged = new Set(
      [
        ...(Array.isArray(item?.set_logs) ? item.set_logs : []),
        ...(acceptedLoadByItemIdRef.current[itemId]
          ? [acceptedLoadByItemIdRef.current[itemId]]
          : []),
      ]
        .map((row: any) => Number(row?.set_index || 0))
        .filter((value: number) => value > 0),
    );
    if (total > 0) {
      for (let index = 1; index <= total; index += 1) {
        if (!logged.has(index)) return index;
      }
      return total + 1;
    }
    let index = 1;
    while (logged.has(index)) index += 1;
    return index;
  }, [data?.workout?.core_items]);
  useEffect(() => {
    const items = [
      ...(data?.workout?.core_items || []),
      ...(data?.workout?.accessory_groups || []).flatMap((group) => group.items || []),
    ];
    for (const item of items) {
      const accepted = acceptedLoadByItemIdRef.current[item.id];
      if (!accepted) continue;
      const persisted = (item.set_logs || []).some((set) => (
        Number(set.set_index || 0) === Number(accepted.set_index || 0)
      ));
      if (persisted) delete acceptedLoadByItemIdRef.current[item.id];
    }
  }, [data?.workout?.accessory_groups, data?.workout?.core_items]);
  const [videoUploadBySetLogId, setVideoUploadBySetLogId] = useState<
    Record<number, { uploading?: boolean; queued?: boolean; uploaded?: boolean; error?: string | null; permanent?: boolean; job?: QueuedVideoUploadJob | null }>
  >({});
  const uploadedQueueRefreshRef = useRef<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<
    null | 'begin' | 'complete' | 'cancel'
  >(null);

  const [restSeconds, setRestSeconds] = useState(0);
  const [restActive, setRestActive] = useState(false);
  const [restTimerZeroVisible, setRestTimerZeroVisible] = useState(false);
  const [restTimerReadyVisible, setRestTimerReadyVisible] = useState(false);
  const [restTimerHeaderOrigin, setRestTimerHeaderOrigin] =
    useState<RestTimerHeaderOrigin | null>(null);
  const restCountdownAudioRef = useRef<RestTimerCountdownAudioWindow | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restEndAtMsRef = useRef<number | null>(null);
  const lastRestCueSecondRef = useRef<number | null>(null);
  const restFocusReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restZeroAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restReadyDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restNotifIdRef = useRef<string | null>(null);
  const restTimerIdRef = useRef<string | null>(null);
  const notifPermCheckedRef = useRef(false);
  const startRestCountdownAudio = useCallback((remaining: number) => {
    if (!restCountdownAudioRef.current) {
      restCountdownAudioRef.current = new RestTimerCountdownAudioWindow({
        createPlayer: () => createAudioPlayer(
          require('../../../assets/audio/rest-countdown-sequence.wav'),
          {
            updateInterval: 1_000,
            keepAudioSessionActive: false,
          },
        ),
        onError: (error) => console.warn('rest countdown audio failed', error),
      });
    }
    restCountdownAudioRef.current.startAt(remaining);
  }, []);

  const deliverRestTimerCue = useCallback((remaining: number) => {
    const cue = cueForRestTimerSecond(remaining, DEFAULT_REST_TIMER_CUE_CONFIG);
    if (cue.tone) startRestCountdownAudio(remaining);
    if (cue.haptic === 'light') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } else if (cue.haptic === 'strong') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    } else if (cue.haptic === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [startRestCountdownAudio]);

  const handleRestTimerLayout = useCallback((origin: RestTimerHeaderOrigin) => {
    setRestTimerHeaderOrigin((current) => {
      if (
        current &&
        Math.abs(current.x - origin.x) < 0.5 &&
        Math.abs(current.y - origin.y) < 0.5 &&
        Math.abs(current.width - origin.width) < 0.5 &&
        Math.abs(current.height - origin.height) < 0.5
      ) {
        return current;
      }
      return origin;
    });
  }, []);
  const ensureNotifPerms = async () => {
    if (!Notifications) return false;
    // Only ask once per screen mount
    if (notifPermCheckedRef.current) {
      const existing = await Notifications.getPermissionsAsync();
      return existing.status === 'granted';
    }

    notifPermCheckedRef.current = true;

    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;

    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  };

  const cancelRestEndNotification = async () => {
    if (!Notifications) return;
    const id = restNotifIdRef.current;
    if (!id) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      // best-effort
      console.log('cancelRestEndNotification error', e);
    } finally {
      restNotifIdRef.current = null;
    }
  };

  const scheduleRestEndNotification = async (seconds: number, timerId: string) => {
    if (!Notifications) return;
    // Replace any existing scheduled rest notification
    await cancelRestEndNotification();

    const granted = await ensureNotifPerms();
    if (!granted) return;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rest over',
          body: 'Time for the next set.',
          data: {
            kind: 'rest_end',
            type: 'rest_timer_complete',
            workout_id: String(workoutId),
            timer_id: timerId,
            owner_user_id: String(user?.id ?? user?.user_id ?? ''),
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
      const attached = await attachGlobalRestTimerNotification(timerId, id);
      if (!attached) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
        return;
      }
      restNotifIdRef.current = id;
    } catch (e) {
      console.log('scheduleRestEndNotification error', e);
    }
  };

  // Shared timer picker state and helpers
  const [timerPickerVisible, setTimerPickerVisible] = useState(false);
  const [timerPickerValue, setTimerPickerValue] = useState(DEFAULT_REST_TIMER_SECONDS);
  const [sessionRestTimerSeconds, setSessionRestTimerSeconds] = useState<number | null>(null);
  const restTimerPreferenceOwnerId = user?.id ?? user?.user_id ?? null;
  const restTimerPreferenceOwnerKey = String(restTimerPreferenceOwnerId ?? '').trim();
  const restTimerPreferenceOwnerKeyRef = useRef(restTimerPreferenceOwnerKey);
  restTimerPreferenceOwnerKeyRef.current = restTimerPreferenceOwnerKey;
  const lastUsedRestTimerRef = useRef<{ ownerKey: string; seconds: number | null } | null>(null);
  const lastUsedRestTimerLoadRef = useRef<{
    ownerKey: string;
    promise: Promise<number | null>;
  } | null>(null);
  const timerPickerOpenRequestRef = useRef(0);
  const timerWheelRef = useRef<ScrollView | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [tardyReasonVisible, setTardyReasonVisible] = useState(false);
  const [tardyReason, setTardyReason] = useState('');

  const resolveActiveTimerHandoff = useCallback((rawOutcome: unknown) => {
    const outcome = timerHandoffResolution(rawOutcome);
    const identity = activeTimerHandoffIdentityRef.current;
    setTimerPickerVisible(false);
    if (!identity) return;
    if (!timerHandoffReleaseControllerRef.current.resolve(identity)) return;
    activeTimerHandoffIdentityRef.current = null;
    if (outcome === 'dismissed') feedbackDispatch({ type: 'TIMER_IDLE' });
    transientRecognitionTrace(13, `timer picker ${outcome}`);
    transientRecognitionTrace(14, 'timer handoff resolved', { outcome });
  }, [transientRecognitionTrace]);

  const handleTimerPickerMounted = useCallback(() => {
    const identity = activeTimerHandoffIdentityRef.current;
    if (!identity || !timerHandoffReleaseControllerRef.current.mounted(identity)) return;
    transientRecognitionTrace(13, 'timer picker opened');
  }, [transientRecognitionTrace]);

  const loadScopedLastUsedRestTimer = useCallback((): Promise<number | null> => {
    if (!restTimerPreferenceOwnerKey) return Promise.resolve(null);
    if (lastUsedRestTimerRef.current?.ownerKey === restTimerPreferenceOwnerKey) {
      return Promise.resolve(lastUsedRestTimerRef.current.seconds);
    }
    if (lastUsedRestTimerLoadRef.current?.ownerKey === restTimerPreferenceOwnerKey) {
      return lastUsedRestTimerLoadRef.current.promise;
    }

    const ownerKey = restTimerPreferenceOwnerKey;
    const promise = loadLastUsedRestTimerSeconds(ownerKey)
      .catch(() => null)
      .then((seconds) => {
        if (restTimerPreferenceOwnerKeyRef.current === ownerKey) {
          lastUsedRestTimerRef.current = { ownerKey, seconds };
        }
        return seconds;
      });
    lastUsedRestTimerLoadRef.current = { ownerKey, promise };
    return promise;
  }, [restTimerPreferenceOwnerKey]);

  useEffect(() => {
    timerPickerOpenRequestRef.current += 1;
    setSessionRestTimerSeconds(null);
    lastUsedRestTimerRef.current = null;
    lastUsedRestTimerLoadRef.current = null;
    void loadScopedLastUsedRestTimer();
    return () => {
      timerPickerOpenRequestRef.current += 1;
    };
  }, [loadScopedLastUsedRestTimer, workoutId]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled);
      if (enabled) feedbackAnalytics('reduced_motion_path', { enabled: true });
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!rewardLoopDemoV2StorageScope) return;
    let active = true;
    loadLoggerFeedbackStorage(rewardLoopDemoV2StorageScope).then(({ pending, consumed }) => {
      if (!active) return;
      feedbackDispatch({ type: 'RESTORE_CONSUMED', deliveryIds: consumed });
      feedbackDispatch({ type: 'RESTORE_PENDING', events: pending });
      if (pending.length) feedbackAnalytics('recognition_event_queued', { restored: true, count: pending.length });
    }).catch(() => feedbackAnalytics('recognition_restore_storage_failed', { workout_id: rewardLoopDemoV2StorageScope }));
    return () => { active = false; };
  }, [rewardLoopDemoV2StorageScope]);

  useEffect(() => {
    const blockers = {
      save_confirmation: feedbackState.recognition.saveConfirmationVisible,
      active_recognition: !!feedbackState.recognition.currentEvent,
      empty_queue: !feedbackState.recognition.queuedEvents.length,
      app_backgrounded: feedbackState.appLifecycle === 'background',
      timer_pending: feedbackState.timer.status === 'picker_pending',
      timer_visible: timerPickerVisible,
    };
    const releaseBlocked = Object.values(blockers).some(Boolean);
    const evaluationKey = JSON.stringify({ blockers, first: feedbackState.recognition.queuedEvents[0] ? recognitionDeliveryId(feedbackState.recognition.queuedEvents[0]) : null });
    if (recognitionReleaseEvaluationTraceRef.current !== evaluationKey) {
      recognitionReleaseEvaluationTraceRef.current = evaluationKey;
      transientRecognitionTrace(15, 'recognition release condition evaluated', { released: !releaseBlocked, blockers });
    }
    if (releaseBlocked) return;
    feedbackDispatch({ type: 'DISPLAY_NEXT_RECOGNITION' });
  }, [feedbackState.appLifecycle, feedbackState.recognition.currentEvent, feedbackState.recognition.queuedEvents, feedbackState.recognition.saveConfirmationVisible, feedbackState.timer.status, timerPickerVisible, transientRecognitionTrace]);

  useEffect(() => {
    const event = feedbackState.recognition.currentEvent;
    if (!event) return;
    const deliveryId = recognitionDeliveryId(event);
    if (recognitionPromotionTraceRef.current === deliveryId) return;
    recognitionPromotionTraceRef.current = deliveryId;
    transientRecognitionTrace(16, 'recognition promoted from queued to active');
  }, [feedbackState.recognition.currentEvent, transientRecognitionTrace]);

  useEffect(() => {
    const overlaps = timerPickerVisible && feedbackState.recognition.queuedEvents.length > 0;
    if (overlaps && !timerOverlapReportedRef.current) {
      feedbackAnalytics('recognition_timer_overlap', { queued_count: feedbackState.recognition.queuedEvents.length, deferred: true });
    }
    timerOverlapReportedRef.current = overlaps;
  }, [feedbackState.recognition.queuedEvents.length, timerPickerVisible]);

  useEffect(() => {
    const event = feedbackState.recognition.currentEvent;
    if (!event || feedbackState.appLifecycle === 'background') return;
    const deliveryId = recognitionDeliveryId(event);
    if (!feedbackState.recognition.displayedDeliveryIds.includes(deliveryId)) return;
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = setTimeout(() => {
      feedbackDispatch({ type: 'CONSUME_CURRENT_RECOGNITION' });
      if (rewardLoopDemoV2StorageScope) void markRecognitionConsumed(rewardLoopDemoV2StorageScope, deliveryId).catch(() => feedbackAnalytics('recognition_consumption_storage_failed', { event_id: event.id }));
      feedbackAnalytics('recognition_event_auto_resolved', { event_id: event.id, event_type: event.event_type });
      transientRecognitionTrace(20, 'recognition completed');
    }, recognitionVisibleDuration(event));
    return () => {
      if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    };
  }, [feedbackState.appLifecycle, feedbackState.recognition.currentEvent, feedbackState.recognition.displayedDeliveryIds, rewardLoopDemoV2StorageScope, transientRecognitionTrace]);

  const handleRecognitionPresentationStarted = useCallback((event: LoggerRecognitionEvent) => {
    const deliveryId = recognitionDeliveryId(event);
    transientRecognitionTrace(17, 'recognition component mounted');
    transientRecognitionTrace(18, event.event_type === 'CORE_WEIGHT_PR' ? 'Weight PR choreography started' : 'recognition choreography started');
    feedbackDispatch({ type: 'RECOGNITION_PRESENTATION_STARTED', deliveryId });
    transientRecognitionTrace(19, 'recognition marked presented');
    rewardLoopDemoV2Log('recognition_presentation_started', { event_id: event.id, event_type: event.event_type });
    if (rewardLoopDemoV2StorageScope) {
      void markRecognitionConsumed(rewardLoopDemoV2StorageScope, deliveryId).then(() => {
        rewardLoopDemoV2Log('recognition_marked_presented', { event_id: event.id });
      }).catch(() => {
        feedbackAnalytics('recognition_consumption_storage_failed', { event_id: event.id, phase: 'presentation_started' });
      });
    }
    if (recognitionDisplayTelemetryRef.current.has(deliveryId)) return;
    recognitionDisplayTelemetryRef.current.add(deliveryId);
    if (recognitionDisplayTelemetryRef.current.size > 100) {
      const oldest = recognitionDisplayTelemetryRef.current.values().next().value;
      if (oldest != null) recognitionDisplayTelemetryRef.current.delete(oldest);
    }
    feedbackAnalytics('recognition_event_displayed', { event_id: event.id, event_type: event.event_type, priority: event.priority });
  }, [rewardLoopDemoV2Log, rewardLoopDemoV2StorageScope, transientRecognitionTrace]);

  const dismissCurrentRecognition = useCallback(() => {
    const event = feedbackState.recognition.currentEvent;
    if (!event) return;
    const deliveryId = recognitionDeliveryId(event);
    feedbackDispatch({ type: 'CONSUME_CURRENT_RECOGNITION' });
    if (rewardLoopDemoV2StorageScope) void markRecognitionConsumed(rewardLoopDemoV2StorageScope, deliveryId).catch(() => feedbackAnalytics('recognition_consumption_storage_failed', { event_id: event.id }));
    feedbackAnalytics('recognition_event_dismissed', { event_id: event.id, event_type: event.event_type });
    transientRecognitionTrace(20, 'recognition dismissed');
  }, [feedbackState.recognition.currentEvent, rewardLoopDemoV2StorageScope, transientRecognitionTrace]);

  const [postSessionVisible, setPostSessionVisible] = useState(false);
  const [postSessionSubmitting, setPostSessionSubmitting] = useState(false);
  const [missingCompletionSets, setMissingCompletionSets] = useState<string[] | null>(null);
  const [finalSessionCompletion, finalSessionCompletionDispatch] = useReducer(
    finalSessionCompletionReducer,
    initialFinalSessionCompletionState,
  );
  const finalSessionEndTransitionRef = useRef(false);
  const [postSessionTimeError, setPostSessionTimeError] = useState<string | null>(null);
  const [postSessionFallbackTimeZone, setPostSessionFallbackTimeZone] = useState(
    () => getDeviceTimezone() || 'America/Los_Angeles',
  );
  const [postSessionTimePicker, setPostSessionTimePicker] = useState<'start' | 'end' | null>(null);
  const [postSessionTimePickerDraft, setPostSessionTimePickerDraft] = useState<Date | null>(null);
  const [postSessionTimePickerMode, setPostSessionTimePickerMode] = useState<'date' | 'time'>('date');
  const [postSessionForm, setPostSessionForm] = useState({
    sessionRpe: null as number | null,
    strengthFeeling: '' as '' | 'much_weaker' | 'slightly_weaker' | 'normal' | 'slightly_stronger' | 'much_stronger',
    fatigueFeeling: '' as '' | 'very_fresh' | 'slightly_fatigued' | 'moderately_fatigued' | 'very_fatigued',
    note: '',
    sessionStart: null as Date | null,
    sessionEnd: null as Date | null,
  });
  const [postSessionNotesExpanded, setPostSessionNotesExpanded] = useState(false);
  const [postSessionEffortRailWidth, setPostSessionEffortRailWidth] = useState(0);
  const postSessionEffortRailRef = useRef<View>(null);
  const postSessionEffortRailWindowX = useRef<number | null>(null);
  const postSessionEffortThumbScale = useRef(new Animated.Value(1)).current;
  const postSessionEffortRailValueRef = useRef<number | null>(null);

  const [editSetVisible, setEditSetVisible] = useState(false);
  const [editSetSubmitting, setEditSetSubmitting] = useState(false);
  const [setMutationNotice, setSetMutationNotice] = useState<string | null>(null);
  const setMutationNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editSetCtx, setEditSetCtx] = useState<{
    itemId: number;
    setIndex: number;
    setLogId: number;
    mode: 'rpe' | 'rir';
    movementName: string;
    loggedWeightKg: number | null;
    loggedReps: number | null;
    loggedRpe: number | null;
    loggedRir: number | null;
  } | null>(null);

  const [editSetForm, setEditSetForm] = useState({
    weight: '',
    reps: '',
    rpe: '',
    rir: '',
  });

  const showSetMutationNotice = useCallback((message: string) => {
    if (setMutationNoticeTimerRef.current) clearTimeout(setMutationNoticeTimerRef.current);
    setSetMutationNotice(message);
    setMutationNoticeTimerRef.current = setTimeout(() => {
      setSetMutationNotice(null);
      setMutationNoticeTimerRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => () => {
    if (setMutationNoticeTimerRef.current) clearTimeout(setMutationNoticeTimerRef.current);
  }, []);

  // --- Readiness survey (mobile only) ---
  const [readinessVisible, setReadinessVisible] = useState(false);
  const [pendingBeginWorkoutId, setPendingBeginWorkoutId] = useState<number | null>(null);
  const [readinessSubmitting, setReadinessSubmitting] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const readinessSubmissionGateRef = useRef(createReadinessSubmissionGate());

  const [readinessForm, setReadinessForm] = useState<ReadinessModalValues>({
    bodyweight: '',
    bodyweightSkipped: false,
    sleepPosition: 0.5,
    energyPosition: 0.5,
    sorenessPosition: 0.5,
    stressPosition: 0.5,
  });

  // If backend provides readiness data, this prevents re-prompting.
  // If it doesn't yet, you'll still get prompted once per begin tap.
  const hasReadinessForWorkout = () => {
    return !!data?.readiness_survey;
  };

  const openReadinessThenBegin = (wkId: number) => {
    setPendingBeginWorkoutId(wkId);
    setReadinessError(null);
    setReadinessForm({
      bodyweight: '',
      bodyweightSkipped: false,
      sleepPosition: 0.5,
      energyPosition: 0.5,
      sorenessPosition: 0.5,
      stressPosition: 0.5,
    });
    setReadinessVisible(true);
  };

  const cancelReadiness = () => {
    if (readinessSubmitting) return;
    setReadinessVisible(false);
    setPendingBeginWorkoutId(null);
    setReadinessError(null);
  };

  // Readiness must save before the session starts. Failure stays actionable.
  const submitReadinessAndBegin = async () => {
    const wkId = pendingBeginWorkoutId;
    if (!wkId) {
      setReadinessError('This training session is no longer available. Close and try again.');
      return;
    }

    const built = buildReadinessPayload(readinessForm, unit);
    if (!built.payload) {
      setReadinessError(built.error || 'Check your readiness values.');
      return;
    }

    await readinessSubmissionGateRef.current.run(async () => {
      try {
        setReadinessSubmitting(true);
        setReadinessError(null);
        await persistReadinessThenBegin(
          async () => {
            const response = await fetchJson(`${API_BASE}/workouts/mobile/${wkId}/readiness`, {
              method: 'POST',
              auth: true,
              body: built.payload,
            });
            if (!response.ok || !response.json?.ok) {
              throw new Error(response.json?.error || `Unable to save readiness (HTTP ${response.status})`);
            }
          },
          () => {
            setReadinessVisible(false);
            setPendingBeginWorkoutId(null);
            requestAnimationFrame(() => void beginWorkout());
          },
        );
      } catch (e: any) {
        console.log('readiness submit error', e);
        setReadinessError(e?.message || 'Could not save your check-in. Try again.');
      } finally {
        setReadinessSubmitting(false);
      }
    });
  };

  // --- Accessory hot-swap (self-coached only) ---
  const [swapAccVisible, setSwapAccVisible] = useState(false);
  const [swapPickerVisible, setSwapPickerVisible] = useState(false);
  const [swapAccItem, setSwapAccItem] = useState<WorkoutItem | null>(null);
  const [swapAccIdentity, setSwapAccIdentity] = useState<GeneralMovementIdentity | null>(null);
  const [movementHistoryItem, setMovementHistoryItem] = useState<WorkoutItem | null>(null);
  const [identityPickerItem, setIdentityPickerItem] = useState<WorkoutItem | null>(null);
  const [identityPickerQuery, setIdentityPickerQuery] = useState('');
  const [identityPickerRows, setIdentityPickerRows] = useState<GeneralMovementIdentity[]>([]);
  const [identityPickerLoading, setIdentityPickerLoading] = useState(false);
  const [identityPickerError, setIdentityPickerError] = useState<string | null>(null);
  const [identityPickerContinuation, setIdentityPickerContinuation] =
    useState<EquipmentSelectionContinuation>({ kind: 'none' });
  const [identityPickerManufacturer, setIdentityPickerManufacturer] =
    useState<GeneralMovementIdentity | null>(null);
  const identityPickerRequestRef = useRef(0);
  const [swapAccForm, setSwapAccForm] = useState({
    sets: '',
    rir: '',
  });
  const [swapRepTarget, setSwapRepTarget] = useState<AccessoryRepTarget>({ mode: 'FIXED', fixed: '10' });

  useEffect(() => {
    const itemId = Number(swapAccItem?.id || 0);
    if (!itemId || !acceptedSetEvidenceItemIds.has(itemId)) return;
    setSwapPickerVisible(false);
    setSwapAccVisible(false);
    setSwapAccItem(null);
    setSwapAccIdentity(null);
  }, [acceptedSetEvidenceItemIds, swapAccItem?.id]);

  const openCanonicalMovementHistory = (item: WorkoutItem) => {
    const resolution = resolveMovementHistoryLaunchForItem({
      athleteId: Number(data?.workout?.athlete_id || 0),
      item,
    });
    if (!resolution.ok) {
      if (__DEV__) console.warn('[MovementHistory] launch rejected', resolution.reason, item.id);
      Alert.alert('History unavailable', resolution.message);
      return;
    }
    router.push(movementHistorySheetRoute(resolution.target) as never);
  };

  const openSwapAcc = (it: WorkoutItem) => {
    const currentWorkout = data?.workout;
    const authority = resolveSubstitutionAuthority({
      serverAuthority: data?.permissions?.substitution_authority,
      canHotSwap: data?.permissions?.can_hot_swap,
      permissionIsSelfCoached: data?.permissions?.is_self_coached,
      accountIsSelfCoached: user?.is_self_coached,
      isCoachPreview: coachPreviewRequested,
    });
    const swapAction = accessorySwapActionForItem({
      substitutionAuthority: authority,
      hasApprovedSubstitutions: Array.isArray(it.approved_subs) && it.approved_subs.length > 0,
      isCoachPreview:
        coachPreviewRequested
        && data?.view_mode === 'coach_preview'
        && data?.permissions?.view_only === true,
      sessionLifecycle: deriveScreenMode(currentWorkout?.status),
      targetItemHasSetLogs: itemHasPersistedSetLogs(it),
      acceptedPersistedSetLogForItem: acceptedSetEvidenceItemIds.has(Number(it.id)),
    });
    if (!swapAction) return;
    setSwapAccItem(it);
    const identity = resolveLoggerMovementIdentity(it);
    setSwapAccIdentity(
      identity.effective
      || null
    );
    setSwapAccForm({
      sets: (it.performed_sets ?? it.sets) != null ? String(it.performed_sets ?? it.sets) : '',
      rir: (it.performed_rir_target ?? it.rir_target) != null ? String(it.performed_rir_target ?? it.rir_target) : '',
    });
    setSwapRepTarget(accessoryRepTargetFromText(
      it.performed_reps_text || it.reps_text || (it.reps != null ? String(it.reps) : '10'),
    ));
    setSwapPickerVisible(true);
  };

  const saveSwapAcc = async () => {
    if (!workoutId || !swapAccItem) return;
    if (
      itemHasPersistedSetLogs(swapAccItem)
      || acceptedSetEvidenceItemIds.has(Number(swapAccItem.id))
    ) {
      setSwapPickerVisible(false);
      setSwapAccVisible(false);
      setSwapAccItem(null);
      setSwapAccIdentity(null);
      return;
    }

    const setsStr = String(swapAccForm.sets || '').trim();
    const repsText = accessoryRepTargetText(swapRepTarget);
    const rirStr = String(swapAccForm.rir || '').trim();

    if (!swapAccIdentity?.id) {
      setError('Select a governed movement');
      return;
    }

    let sets: number | null = null;
    if (setsStr !== '') {
      const n = parseInt(setsStr.replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(n) || n < 0) {
        setError('Invalid sets');
        return;
      }
      sets = n;
    }

    let rir: number | null = null;
    if (rirStr !== '') {
      const cleaned = rirStr.replace(/[^0-9.\-]/g, '').replace(/(?!^)-/g, '');
      const n = parseFloat(cleaned);
      if (!Number.isFinite(n)) {
        setError('Invalid RIR');
        return;
      }
      rir = n;
    }

    try {
      setSavingItemId(swapAccItem.id);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${swapAccItem.id}/swap_acc`,
        {
          method: 'POST',
          body: {
            movement: swapAccIdentity.display_name,
            performed_canonical_movement_definition_id: swapAccIdentity.id,
            sets: sets ?? undefined,
            reps_text: repsText,
            rir: rir ?? undefined,
          },
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to swap accessory (HTTP ${status})`);
      }

      const savedItem = json.item as WorkoutItem | undefined;
      setSwapAccVisible(false);
      setSwapAccItem(null);
      rememberScroll();
      await fetchWorkout();
      if (savedItem?.performed_canonical_movement_identity?.requires_equipment_configuration) {
        openIdentityPicker(savedItem);
      }
    } catch (err: any) {
      console.log('saveSwapAcc error', err);
      setError(err?.message || 'Error swapping accessory');
    } finally {
      setSavingItemId(null);
    }
  };

  const openEditSet = (
    itemId: number,
    setLog: SetLog,
    opts: { mode: 'rpe' | 'rir'; movementName: string }
  ) => {
    const rawWeight =
      setLog.actual_weight_kg != null
        ? unit === 'kg'
          ? formatWeight(setLog.actual_weight_kg, 'kg')
          : String(roundToNearestGymIncrementLb(setLog.actual_weight_kg / KG_PER_LB))
        : '';
    const weightOptions = buildEditWeightOptions(opts.mode, unit, rawWeight);
    const repsOptions = ['0', ...Array.from({ length: opts.mode === 'rpe' ? 20 : 30 }, (_, idx) => String(idx + 1))];
    const metricOptions = opts.mode === 'rpe'
      ? Array.from({ length: 11 }, (_, idx) => formatWheelNumber(5 + idx * 0.5))
      : Array.from({ length: 11 }, (_, idx) => formatWheelNumber(idx * 0.5));
    const rawMetric = opts.mode === 'rpe' ? setLog.actual_rpe : setLog.actual_rir;

    setEditSetCtx({
      itemId,
      setIndex: setLog.set_index,
      setLogId: setLog.id,
      mode: opts.mode,
      movementName: opts.movementName,
      loggedWeightKg: setLog.actual_weight_kg ?? null,
      loggedReps: setLog.actual_reps ?? null,
      loggedRpe: setLog.actual_rpe ?? null,
      loggedRir: setLog.actual_rir ?? null,
    });

    setEditSetForm({
      weight: nearestWheelValue(weightOptions, rawWeight, weightOptions[0] || '0'),
      reps: nearestWheelValue(repsOptions, setLog.actual_reps != null ? String(setLog.actual_reps) : '', '0'),
      rpe: opts.mode === 'rpe'
        ? nearestWheelValue(metricOptions, rawMetric != null ? formatWheelNumber(Number(rawMetric)) : '', '8')
        : '',
      rir: opts.mode === 'rir'
        ? nearestWheelValue(metricOptions, rawMetric != null ? formatWheelNumber(Number(rawMetric)) : '', '2')
        : '',
    });

    setEditSetVisible(true);
  };

  const saveEditedSet = async () => {
    if (!workoutId || !editSetCtx) return;

    let weightInUnit =
      editSetForm.weight.trim() === '' ? NaN : parseFloat(editSetForm.weight);

    const repsStr = String(editSetForm.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;

    if (Number.isNaN(weightInUnit) || weightInUnit <= 0) {
      setError('Weight required');
      return;
    }
    if (!Number.isFinite(reps) || reps < 0) {
      setError('Reps required');
      return;
    }

    if (unit === 'lb') {
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
    }

    const weightKg = unit === 'kg' ? weightInUnit : weightInUnit * KG_PER_LB;

    let actual_rpe: number | null = null;
    let actual_rir: number | null = null;

    if (editSetCtx.mode === 'rpe') {
      actual_rpe =
        editSetForm.rpe.trim() === '' ? null : parseFloat(editSetForm.rpe);
      if (editSetForm.rpe.trim() !== '' && !Number.isFinite(actual_rpe as number)) {
        setError('Enter a valid RPE');
        return;
      }
    } else {
      actual_rir =
        editSetForm.rir.trim() === '' ? null : parseFloat(editSetForm.rir);
      if (editSetForm.rir.trim() !== '' && !Number.isFinite(actual_rir as number)) {
        setError('Enter a valid RIR');
        return;
      }
    }

    try {
      setEditSetSubmitting(true);
      setSavingItemId(editSetCtx.itemId);
      setError(null);

      const isDevFixtureSet = isIdealWorkoutDetailPreview
        && data?.workout?.accessory_groups?.some((group) =>
          group.items.some((item) =>
            item.id === editSetCtx.itemId
            && (item.set_logs || []).some((log) => log.id === editSetCtx.setLogId),
          ),
        );
      if (isDevFixtureSet) {
        setData((current) => current ? {
          ...current,
          workout: {
            ...current.workout,
            accessory_groups: current.workout.accessory_groups.map((group) => ({
              ...group,
              items: group.items.map((item) => item.id !== editSetCtx.itemId
                ? item
                : {
                    ...item,
                    set_logs: (item.set_logs || []).map((log) =>
                      log.id !== editSetCtx.setLogId
                        ? log
                        : {
                            ...log,
                            actual_weight_kg: weightKg,
                            actual_reps: reps,
                            actual_rpe,
                            actual_rir,
                          }),
                  }),
            })),
          },
        } : current);
        feedbackDispatch({ type: 'SET_EDITED', sourceSetLogId: editSetCtx.setLogId });
        setEditSetVisible(false);
        setEditSetCtx(null);
        showSetMutationNotice('Set updated · progress recalculated');
        return;
      }

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${editSetCtx.itemId}/edit_set`,
        {
          method: 'POST',
          auth: true,
          body: {
            set_index: editSetCtx.setIndex,
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe,
            actual_rir,
          },
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to update set (HTTP ${status})`);
      }

      feedbackDispatch({ type: 'SET_EDITED', sourceSetLogId: editSetCtx.setLogId });
      const invalidatedEventIds = Array.isArray(json?.invalidated_recognition_event_ids)
        ? json.invalidated_recognition_event_ids.map(Number).filter(Number.isFinite)
        : [];
      feedbackDispatch({ type: 'INVALIDATE_EVENTS', eventIds: invalidatedEventIds });
      if (workoutId) void invalidateRecognitionForSet(String(workoutId), editSetCtx.setLogId).catch(() => feedbackAnalytics('recognition_invalidation_storage_failed', { mutation: 'edit', source_set_log_id: editSetCtx.setLogId }));
      if (workoutId) void invalidateRecognitionEvents(String(workoutId), invalidatedEventIds).catch(() => feedbackAnalytics('recognition_invalidation_storage_failed', { mutation: 'edit', count: invalidatedEventIds.length }));
      feedbackAnalytics('recognition_invalidated_before_display', { source_set_log_id: editSetCtx.setLogId, mutation: 'edit' });

      setEditSetVisible(false);
      setEditSetCtx(null);
      rememberScroll();
      await fetchWorkout();
      showSetMutationNotice('Set updated · progress recalculated');
    } catch (err: any) {
      console.log('saveEditedSet error', err);
      setError(err?.message || 'Error updating set');
    } finally {
      setEditSetSubmitting(false);
      setSavingItemId(null);
    }
  };

  const deleteSetLog = async (itemId: number, setLogId: number) => {
    if (!workoutId || !setLogId) return;

    try {
      setEditSetSubmitting(true);
      setSavingItemId(itemId);
      setError(null);

      const isDevFixtureSet = isIdealWorkoutDetailPreview
        && data?.workout?.accessory_groups?.some((group) =>
          group.items.some((item) =>
            item.id === itemId
            && (item.set_logs || []).some((log) => log.id === setLogId),
          ),
        );
      if (isDevFixtureSet) {
        setData((current) => current ? {
          ...current,
          workout: {
            ...current.workout,
            accessory_groups: current.workout.accessory_groups.map((group) => ({
              ...group,
              items: group.items.map((item) => item.id !== itemId
                ? item
                : {
                    ...item,
                    set_logs: (item.set_logs || []).filter(
                      (log) => log.id !== setLogId,
                    ),
                  }),
            })),
          },
        } : current);
        feedbackDispatch({ type: 'SET_DELETED', sourceSetLogId: setLogId });
        setEditSetVisible(false);
        setEditSetCtx(null);
        showSetMutationNotice('Set deleted · progress recalculated');
        return;
      }

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/setlogs/${setLogId}`,
        {
          method: 'DELETE',
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to delete set (HTTP ${status})`);
      }

      feedbackDispatch({ type: 'SET_DELETED', sourceSetLogId: setLogId });
      const invalidatedEventIds = Array.isArray(json?.invalidated_recognition_event_ids)
        ? json.invalidated_recognition_event_ids.map(Number).filter(Number.isFinite)
        : [];
      feedbackDispatch({ type: 'INVALIDATE_EVENTS', eventIds: invalidatedEventIds });
      if (workoutId) void invalidateRecognitionForSet(String(workoutId), setLogId).catch(() => feedbackAnalytics('recognition_invalidation_storage_failed', { mutation: 'delete', source_set_log_id: setLogId }));
      if (workoutId) void invalidateRecognitionEvents(String(workoutId), invalidatedEventIds).catch(() => feedbackAnalytics('recognition_invalidation_storage_failed', { mutation: 'delete', count: invalidatedEventIds.length }));
      feedbackAnalytics('recognition_invalidated_before_display', { source_set_log_id: setLogId, mutation: 'delete' });

      setEditSetVisible(false);
      setEditSetCtx(null);

      rememberScroll();
      await fetchWorkout();
      showSetMutationNotice('Set deleted · progress recalculated');
    } catch (err: any) {
      console.log('deleteSetLog error', err);
      setError(err?.message || 'Error deleting set');
    } finally {
      setEditSetSubmitting(false);
      setSavingItemId(null);
    }
  };

  const confirmDeleteSet = (itemId: number, log: SetLog) => {
    const metric = log.actual_rpe != null
      ? ` @ RPE ${formatWheelNumber(log.actual_rpe)}`
      : log.actual_rir != null
      ? ` @ ${formatWheelNumber(log.actual_rir)} RIR`
      : '';
    const weight = log.actual_weight_kg != null ? `${formatWeight(log.actual_weight_kg, unit)} ${unit}` : 'This set';
    const reps = log.actual_reps != null ? ` × ${log.actual_reps}` : '';
    Alert.alert(
      'Delete this set?',
      `${weight}${reps}${metric} will be removed from this training session. Any affected accomplishments and history will be recalculated.`,
      [
        { text: 'Keep Set', style: 'cancel' },
        { text: 'Delete Set', style: 'destructive', onPress: () => void deleteSetLog(itemId, log.id) },
      ],
    );
  };

  const openTimerPicker = useCallback(() => {
    const requestId = timerPickerOpenRequestRef.current + 1;
    timerPickerOpenRequestRef.current = requestId;
    const activeTimerSeconds = restActive && restSeconds > 0 ? restSeconds : null;

    const presentPicker = (lastUsedSeconds: number | null) => {
      if (timerPickerOpenRequestRef.current !== requestId) return;
      const initialSeconds = resolveRestTimerPickerInitialSeconds({
        activeTimerSeconds,
        sessionSelectedSeconds: sessionRestTimerSeconds,
        lastUsedSeconds,
      });
      setTimerPickerValue(initialSeconds);
      setTimerPickerVisible(true);
      rewardLoopDemoV2Log('timer_handoff_opened', { default_seconds: initialSeconds });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const idx = Math.max(0, REST_TIMER_OPTIONS_SECONDS.indexOf(initialSeconds));
          timerWheelRef.current?.scrollTo({
            y: idx * 44,
            animated: false,
          });
        });
      });
    };

    if (activeTimerSeconds || sessionRestTimerSeconds) {
      presentPicker(null);
      return;
    }
    void loadScopedLastUsedRestTimer().then(presentPicker);
  }, [loadScopedLastUsedRestTimer, restActive, restSeconds, rewardLoopDemoV2Log, sessionRestTimerSeconds]);

  const startRestTimer = (seconds: number) => {
    restCountdownAudioRef.current?.reset();
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    const endAt = Date.now() + seconds * 1000;
    restEndAtMsRef.current = endAt;
    const globalTimer = beginGlobalRestTimer({
      workoutId,
      ownerUserId: user?.id ?? user?.user_id ?? '',
      endAtMs: endAt,
    });
    restTimerIdRef.current = globalTimer.timerId;
    if (globalTimer.replacedNotificationId && Notifications) {
      void Notifications.cancelScheduledNotificationAsync(globalTimer.replacedNotificationId)
        .catch(() => undefined);
    }
    lastRestCueSecondRef.current = null;
    if (restFocusReturnTimerRef.current) {
      clearTimeout(restFocusReturnTimerRef.current);
      restFocusReturnTimerRef.current = null;
    }
    if (restReadyDismissTimerRef.current) {
      clearTimeout(restReadyDismissTimerRef.current);
      restReadyDismissTimerRef.current = null;
    }

    if (restZeroAdvanceTimerRef.current) {
      clearTimeout(restZeroAdvanceTimerRef.current);
      restZeroAdvanceTimerRef.current = null;
    }
    setRestTimerZeroVisible(false);
    setRestTimerReadyVisible(false);
    setRestSeconds(seconds);
    setRestActive(true);
    feedbackDispatch({ type: 'TIMER_ACTIVE' });

    // Schedule a local notification so the timer "works" while backgrounded
    scheduleRestEndNotification(seconds, globalTimer.timerId);
  };

  const confirmRestTimerSelection = (seconds: number) => {
    const normalizedSeconds = normalizeRestTimerSeconds(seconds);
    setSessionRestTimerSeconds(normalizedSeconds);
    if (restTimerPreferenceOwnerKey) {
      lastUsedRestTimerRef.current = {
        ownerKey: restTimerPreferenceOwnerKey,
        seconds: normalizedSeconds,
      };
      void persistLastUsedRestTimerSeconds(
        restTimerPreferenceOwnerKey,
        normalizedSeconds,
      ).catch((error) => console.warn('rest timer preference persistence failed', error));
    }
    startRestTimer(normalizedSeconds);
  };

  const stopRestTimer = () => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    restEndAtMsRef.current = null;
    const activeGlobalTimer = getRestTimerCompletionState().active;
    const timerId = restTimerIdRef.current
      ?? (activeGlobalTimer?.workoutId === String(workoutId) ? activeGlobalTimer.timerId : null);
    restTimerIdRef.current = null;
    if (timerId) {
      void stopGlobalRestTimer(timerId).then((notificationId) => {
        if (notificationId && Notifications) {
          void Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
        }
      });
    }
    if (workoutId) {
      void clearRestTimerExpiry(workoutId).catch(() => undefined);
    }
    lastRestCueSecondRef.current = null;
    if (restReadyDismissTimerRef.current) {
      clearTimeout(restReadyDismissTimerRef.current);
      restReadyDismissTimerRef.current = null;
    }
    if (restZeroAdvanceTimerRef.current) {
      clearTimeout(restZeroAdvanceTimerRef.current);
      restZeroAdvanceTimerRef.current = null;
    }
    if (restFocusReturnTimerRef.current) {
      clearTimeout(restFocusReturnTimerRef.current);
      restFocusReturnTimerRef.current = null;
    }
    restCountdownAudioRef.current?.reset();
    setRestTimerZeroVisible(false);
    setRestTimerReadyVisible(false);
    setRestActive(false);
    setRestSeconds(0);
    feedbackDispatch({ type: 'TIMER_IDLE' });

    // Cancel any pending rest-end notification
    cancelRestEndNotification();
  };

  const formatRestTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // If timer isn't active or has no end timestamp, ensure interval is cleared
    if (!restActive || !restEndAtMsRef.current) {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      return;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((restEndAtMsRef.current! - Date.now()) / 1000)
      );

      setRestSeconds(remaining);

      if (
        remaining <= REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS &&
        remaining >= 0 &&
        lastRestCueSecondRef.current !== remaining
      ) {
        lastRestCueSecondRef.current = remaining;
        deliverRestTimerCue(remaining);
      }

      if (remaining <= 0) {
        cancelRestEndNotification();
        setRestActive(false);
        restEndAtMsRef.current = null;
        if (workoutId) {
          void clearRestTimerExpiry(workoutId).catch(() => undefined);
        }
        feedbackDispatch({ type: 'TIMER_IDLE' });
        void reconcileGlobalRestTimerCompletion();

        if (restTimerRef.current) {
          clearInterval(restTimerRef.current);
          restTimerRef.current = null;
        }
      }
    };

    // Immediate sync so UI is correct right away
    tick();

    // Update frequently for smooth UI; uses end timestamp so background is fine
    const id = setInterval(tick, 250);
    restTimerRef.current = id as any;

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    };
  }, [deliverRestTimerCue, restActive, workoutId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const previousState = loggerAppStateRef.current;
      loggerAppStateRef.current = state;
      setSessionClockForeground(state === 'active');
      if (state === 'active') setSessionNowMs(Date.now());
      if (state === 'active') feedbackDispatch({ type: 'APP_RESUMED' });
      else feedbackDispatch({ type: 'APP_BACKGROUNDED' });
      if (state === 'active' && previousState !== 'active') {
        resumeRefreshRef.current();
      }
      if (state === 'active' && restActive && restEndAtMsRef.current) {
        const remaining = Math.max(
          0,
          Math.ceil((restEndAtMsRef.current - Date.now()) / 1000)
        );
        setRestSeconds(remaining);

        if (
          remaining <= REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS &&
          remaining >= 0 &&
          lastRestCueSecondRef.current !== remaining
        ) {
          lastRestCueSecondRef.current = remaining;
          deliverRestTimerCue(remaining);
        }

        if (remaining <= 0) {
          setRestActive(false);
          restEndAtMsRef.current = null;
          if (workoutId) {
            void clearRestTimerExpiry(workoutId).catch(() => undefined);
          }
          void reconcileGlobalRestTimerCompletion();
        }
      }
    });

    return () => sub.remove();
  }, [deliverRestTimerCue, restActive, workoutId]);

  useEffect(() => {
    let cancelled = false;
    const status = String(data?.workout?.status || '').toLowerCase();
    if (!workoutId || status !== 'in_progress') return undefined;
    void hydrateRestTimerCompletion().then((snapshot) => {
      if (cancelled || snapshot.active?.workoutId !== String(workoutId)) return;
      restTimerIdRef.current = snapshot.active.timerId;
    }).catch(() => undefined);
    void loadRestTimerExpiry(workoutId).then((stored) => {
      if (cancelled || !stored || restEndAtMsRef.current) return;
      const remaining = Math.max(
        0,
        Math.ceil((stored.endAtMs - Date.now()) / 1000),
      );
      if (remaining <= 0) return;
      restEndAtMsRef.current = stored.endAtMs;
      setRestSeconds(remaining);
      setRestActive(true);
      feedbackDispatch({ type: 'TIMER_ACTIVE' });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [data?.workout?.status, workoutId]);

  useEffect(() => {
    if (!data?.workout) return;
    const status = String(data?.workout?.status || '').toLowerCase();
    if (status === 'in_progress') return;

    restCountdownAudioRef.current?.reset();

    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    restEndAtMsRef.current = null;
    const activeGlobalTimer = getRestTimerCompletionState().active;
    const timerId = restTimerIdRef.current
      ?? (activeGlobalTimer?.workoutId === String(workoutId) ? activeGlobalTimer.timerId : null);
    restTimerIdRef.current = null;
    if (timerId) {
      void stopGlobalRestTimer(timerId).then((notificationId) => {
        if (notificationId && Notifications) {
          void Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
        }
      });
    }
    if (workoutId) {
      void clearRestTimerExpiry(workoutId).catch(() => undefined);
    }
    if (restReadyDismissTimerRef.current) {
      clearTimeout(restReadyDismissTimerRef.current);
      restReadyDismissTimerRef.current = null;
    }
    if (restZeroAdvanceTimerRef.current) {
      clearTimeout(restZeroAdvanceTimerRef.current);
      restZeroAdvanceTimerRef.current = null;
    }
    setRestTimerZeroVisible(false);
    setRestTimerReadyVisible(false);
    if (restActive) setRestActive(false);
    if (restSeconds !== 0) setRestSeconds(0);
    if (timerPickerVisible) {
      if (feedbackState.timer.status === 'picker_pending') resolveActiveTimerHandoff('dismissed');
      else setTimerPickerVisible(false);
    }
    cancelRestEndNotification();
  }, [data?.workout?.status, feedbackState.timer.status, resolveActiveTimerHandoff, restActive, restSeconds, timerPickerVisible, workoutId]);

  useEffect(() => () => {
    restCountdownAudioRef.current?.dispose();
    restCountdownAudioRef.current = null;
  }, []);

  useEffect(() => {
    const status = String(data?.workout?.status || '').toLowerCase();
    if (
      status !== 'in_progress'
      || !data?.workout?.started_at
      || !sessionClockForeground
    ) return;

    setSessionNowMs(Date.now());
    const id = setInterval(() => setSessionNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data?.workout?.status, data?.workout?.started_at, sessionClockForeground]);

  const updateStraightInput = (
    itemId: number,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => {
    setStraightInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: prev[itemId]?.weight || '',
        reps: prev[itemId]?.reps || '',
        rpe: prev[itemId]?.rpe || '',
        [field]: value,
      },
    }));
  };

  const updateTopInput = (
    itemId: number,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => {
    setTopInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: prev[itemId]?.weight || '',
        reps: prev[itemId]?.reps || '',
        rpe: prev[itemId]?.rpe || '',
        [field]: value,
      },
    }));
  };

  const updateBkInput = (
    itemId: number,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => {
    setBkInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: prev[itemId]?.weight || '',
        reps: prev[itemId]?.reps || '',
        rpe: prev[itemId]?.rpe || '',
        [field]: value,
      },
    }));
  };

  const lastLogForItem = (item?: WorkoutItem | null) => {
    return latestRepeatableSet(item?.set_logs || []);
  };

  const prefillCoreInput = (
    kind: 'straight' | 'top' | 'bk',
    item: WorkoutItem,
    values: { weight?: string; reps?: string; rpe?: string },
  ) => {
    const apply = (prev: Record<number, { weight: string; reps: string; rpe: string }>) => {
      const cur = prev[item.id] || { weight: '', reps: '', rpe: '' };
      return {
        ...prev,
        [item.id]: {
          weight: values.weight ?? cur.weight,
          reps: values.reps ?? cur.reps,
          rpe: values.rpe ?? cur.rpe,
        },
      };
    };
    if (kind === 'straight') setStraightInputs(apply);
    if (kind === 'top') setTopInputs(apply);
    if (kind === 'bk') setBkInputs(apply);
  };

  const prefillFcInput = (
    key: string,
    values: { weight?: string; reps?: string; rpe?: string },
  ) => {
    setFcInputs((prev) => {
      const cur = prev[key] || { weight: '', reps: '', rpe: '' };
      return {
        ...prev,
        [key]: {
          weight: values.weight ?? cur.weight,
          reps: values.reps ?? cur.reps,
          rpe: values.rpe ?? cur.rpe,
        },
      };
    });
  };

  const loadIdentityPicker = useCallback(async (item: WorkoutItem, query = '') => {
    const requestId = ++identityPickerRequestRef.current;
    setIdentityPickerError(null);
    const family = item.movement_identity?.family_id;
    if (isIdealWorkoutDetailPreview) {
      const activeEquipment = activeEquipmentIdentity(item);
      const rows = orderEquipmentChoices(
        workoutDetailMachineIdentityChoices(
          query,
          family,
          item.movement_identity?.family_display_name || item.movement,
        ) as GeneralMovementIdentity[],
        activeEquipment?.id,
      ).sort((left, right) => {
        const activeManufacturerKey = activeEquipment?.manufacturer?.key || null;
        const activeOther = activeEquipment?.equipment_context?.option_kind === 'other'
          || activeEquipment?.key.includes('-other-');
        const isActiveManufacturer = (identity: GeneralMovementIdentity) => (
          activeOther
            ? identity.equipment_context?.option_kind === 'other'
            : Boolean(
                activeManufacturerKey
                && identity.manufacturer?.key === activeManufacturerKey,
              )
        );
        return Number(isActiveManufacturer(right)) - Number(isActiveManufacturer(left));
      });
      if (requestId === identityPickerRequestRef.current) {
        setIdentityPickerRows(rows);
        setIdentityPickerLoading(false);
      }
      return;
    }
    setIdentityPickerLoading(true);
    try {
      const response = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${item.id}/equipment-manufacturers`,
        { method: 'GET', auth: true },
      );
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Could not load equipment choices.');
      if (requestId !== identityPickerRequestRef.current) return;
      const needle = query.trim().toLowerCase();
      setIdentityPickerRows(
        (response.json.items || []).filter((row: GeneralMovementIdentity) => (
          !needle
          || [
            row.manufacturer?.display_name,
            row.display_name,
            item.movement,
          ].filter(Boolean).join(' ').toLowerCase().includes(needle)
        )),
      );
    } catch (error: any) {
      if (requestId !== identityPickerRequestRef.current) return;
      setIdentityPickerError(error?.message || 'Could not load equipment choices.');
    } finally {
      if (requestId === identityPickerRequestRef.current) setIdentityPickerLoading(false);
    }
  }, [data?.athlete?.id, isIdealWorkoutDetailPreview, workoutId]);

  useEffect(() => {
    if (!identityPickerItem) {
      identityPickerRequestRef.current += 1;
      return undefined;
    }
    const timer = setTimeout(
      () => void loadIdentityPicker(identityPickerItem, identityPickerQuery),
      identityPickerQuery.trim() ? 220 : 0,
    );
    return () => clearTimeout(timer);
  }, [identityPickerItem, identityPickerQuery, loadIdentityPicker]);

  const closeIdentityPicker = () => {
    identityPickerRequestRef.current += 1;
    setIdentityPickerItem(null);
    setIdentityPickerRows([]);
    setIdentityPickerError(null);
    setIdentityPickerContinuation({ kind: 'none' });
    setIdentityPickerManufacturer(null);
  };

  const resumeAfterEquipmentSelection = (
    nextItem: WorkoutItem,
    continuation: EquipmentSelectionContinuation,
    nextPayload?: WorkoutPayload | null,
  ) => {
    if (continuation.kind === 'accessory_set') {
      requestAnimationFrame(() => openAccessoryWheel(nextItem, true));
      return;
    }
    if (continuation.kind === 'group_round') {
      const source = nextPayload || data;
      const group = source?.workout?.accessory_groups?.find(
        (candidate) => candidate.group === continuation.groupLabel,
      );
      if (group) {
        requestAnimationFrame(() => {
          // Re-run the gate so tri-sets/giant sets can resolve the next
          // machine without discarding the round context.
          openSupersetRoundLogger(group, continuation.roundIndex);
        });
      }
    }
  };

  const commitPerformedIdentity = async (
    identity: GeneralMovementIdentity,
    equipmentVariant?: MachineEquipmentType,
  ) => {
    if (!identityPickerItem || !workoutId) return;
    const pickerItem = identityPickerItem;
    const continuation = identityPickerContinuation;
    const previousIdentityId = activeEquipmentIdentity(pickerItem)?.id ?? null;
    setIdentityPickerLoading(true);
    if (isIdealWorkoutDetailPreview) {
      const itemId = Number(pickerItem.id);
      const nextItem = applyWorkoutDetailMachineIdentity(
        pickerItem,
        Number(identity.id),
        identity,
      ) as WorkoutItem;
      const nextPayload = data ? {
        ...data,
        workout: {
          ...data.workout,
          accessory_groups: data.workout.accessory_groups.map((group) => ({
            ...group,
            items: group.items.map((item) => (
              Number(item.id) === itemId
                ? nextItem
                : item
            )),
          })),
        },
      } as WorkoutPayload : null;
      if (nextPayload) setData(nextPayload);
      rememberWorkoutDetailEquipmentSelection(workoutId, itemId, identity);
      closeIdentityPicker();
      setIdentityPickerLoading(false);
      if (previousIdentityId != null && Number(previousIdentityId) !== Number(identity.id)) {
        showSetMutationNotice('Equipment updated');
      }
      resumeAfterEquipmentSelection(nextItem, continuation, nextPayload);
      return;
    }
    const response = await fetchJson(`${API_BASE}/workouts/mobile/${workoutId}/items/${pickerItem.id}/performed-identity`, {
      method: 'PUT',
      auth: true,
      body: equipmentVariant
        ? {
            manufacturer_key: identity.manufacturer?.key || 'other',
            equipment_type: equipmentVariant,
          }
        : { movement_definition_id: identity.id },
    });
    if (!response.ok || !response.json?.ok) {
      setIdentityPickerError(response.json?.error || 'Could not save equipment choice.');
      setIdentityPickerLoading(false);
      return;
    }
    const nextItem = {
      ...pickerItem,
      performed_movement_identity:
        response.json?.performed_movement_identity || identity,
    };
    const nextPayload = data ? {
      ...data,
      workout: {
        ...data.workout,
        accessory_groups: data.workout.accessory_groups.map((group) => ({
          ...group,
          items: group.items.map((item) => (
            Number(item.id) === Number(nextItem.id)
              ? nextItem
              : item
          )),
        })),
      },
    } as WorkoutPayload : null;
    if (nextPayload) setData(nextPayload);
    closeIdentityPicker();
    await fetchWorkout({ silent: true });
    setIdentityPickerLoading(false);
    if (previousIdentityId != null && Number(previousIdentityId) !== Number(identity.id)) {
      showSetMutationNotice('Equipment updated');
    }
    resumeAfterEquipmentSelection(nextItem, continuation, nextPayload);
  };

  const choosePerformedIdentity = async (identity: GeneralMovementIdentity) => {
    setIdentityPickerManufacturer(identity);
    setIdentityPickerQuery('');
    setIdentityPickerError(null);
  };

  const chooseEquipmentVariant = async (
    variant: MachineEquipmentType,
  ) => {
    if (!identityPickerManufacturer) return;
    if (isIdealWorkoutDetailPreview) {
      const identity = workoutDetailMachineVariantIdentity(
        identityPickerManufacturer,
        variant,
      ) as GeneralMovementIdentity | null;
      if (!identity) {
        setIdentityPickerError('This equipment variant is unavailable.');
        return;
      }
      await commitPerformedIdentity(identity);
      return;
    }
    await commitPerformedIdentity(identityPickerManufacturer, variant);
  };

  const openIdentityPicker = (
    item: WorkoutItem,
    continuation: EquipmentSelectionContinuation = { kind: 'none' },
  ) => {
    const open = () => {
      const initialRows = isIdealWorkoutDetailPreview
        ? orderEquipmentChoices(
            workoutDetailMachineIdentityChoices(
              '',
              item.movement_identity?.family_id,
              item.movement_identity?.family_display_name || item.movement,
            ) as GeneralMovementIdentity[],
            activeEquipmentIdentity(item)?.id,
          )
        : [];
      setIdentityPickerItem(item);
      setIdentityPickerQuery('');
      setIdentityPickerRows(initialRows);
      setIdentityPickerLoading(false);
      setIdentityPickerError(null);
      setIdentityPickerContinuation(continuation);
      setIdentityPickerManufacturer(null);
    };
    if (
      continuation.kind === 'none'
      && activeEquipmentIdentity(item)
      && (item.set_logs || []).length > 0
    ) {
      Alert.alert(
        'Change equipment for upcoming sets?',
        'Sets already logged keep their original equipment identity. Your new choice applies only to future sets.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: open }],
      );
      return;
    }
    open();
  };

  const openAccessoryWheel = (item: WorkoutItem, skipEquipmentGate = false) => {
    if (!skipEquipmentGate && needsEquipmentSelection(item)) {
      openIdentityPicker(
        item,
        {
          kind: 'accessory_set',
          itemId: Number(item.id),
        },
      );
      return;
    }
    const executionItem = accessoryExecutionItem(item);
    const idealRecommendationWeightKg = isIdealWorkoutDetailPreview
      ? Number((item as any).dev_accessory_intelligence?.recommendation_weight_kg)
      : NaN;
    const idealSuggestedWeight = Number.isFinite(idealRecommendationWeightKg) && idealRecommendationWeightKg > 0
      ? formatWeight(idealRecommendationWeightKg, unit)
      : '';
    const acceptedSet = acceptedLoadByItemIdRef.current[item.id] || null;
    const currentSetIndex = nextSetIndexFromEvidence([
      ...(item.set_logs || []),
      ...(acceptedSet ? [acceptedSet] : []),
    ]);
    const rawWeight = idealSuggestedWeight
      || defaultAccessoryWeight({ item: executionItem, unit, currentSetIndex, acceptedSet });
    const weightOptions = buildAccessoryWeightOptions(unit, rawWeight);
    const repsOptions = ['0', ...Array.from({ length: 30 }, (_, idx) => String(idx + 1))];
    const rirOptions = Array.from({ length: 11 }, (_, idx) => formatWheelNumber(idx * 0.5));
    const repsDefault = accInputs[item.id]?.reps || accessoryRepsDefault(executionItem);
    const rirDefault = accInputs[item.id]?.rir || defaultAccessoryRir(executionItem);

    setAccessoryWheel({
      visible: true,
      itemId: item.id,
      title: accessoryExecutionName(item),
      targetLine: accessoryTargetLine(executionItem),
      weight: nearestWheelValue(weightOptions, rawWeight, '0'),
      reps: nearestWheelValue(repsOptions, repsDefault, '10'),
      rir: nearestWheelValue(rirOptions, rirDefault, '2'),
      weightOptions,
      repsOptions,
      rirOptions,
      selectedVideo: null,
    });
  };

  const queueAccessoryWheelLog = (wheel: AccessoryWheelState) => {
    const itemId = wheel.itemId;
    feedbackAnalytics('log_set_pressed', { item_id: itemId, movement_type: 'accessory' });
    setAccInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: wheel.weight,
        reps: wheel.reps,
        rir: wheel.reps === '0' ? '' : wheel.rir,
      },
    }));
    setPendingAccessoryLogItemId({
      itemId,
      selectedVideo: null,
    });
  };

  const commitAccessoryWheel = () => {
    if (!accessoryWheel) return;
    queueAccessoryWheelLog(accessoryWheel);
  };

  const openSupersetRoundLogger = (
    group: AccessoryGroup,
    roundIndex: number,
  ) => {
    if (!group.group) return;
    const model = buildSupersetRoundModel(group.items);
    const round = model.rounds.find((candidate) => candidate.index === roundIndex);
    if (!round) return;

    const unresolvedIdentity = round.entries.find(
      ({ item, log }) =>
        !log
        && needsEquipmentSelection(item),
    );
    if (unresolvedIdentity) {
      openIdentityPicker(unresolvedIdentity.item, {
        kind: 'group_round',
        groupLabel: group.group,
        roundIndex,
      });
      return;
    }

    const entries = round.entries.map(({ item, log }) => {
        const executionItem = accessoryExecutionItem(item);
        const idealRecommendationWeightKg = Number(
          (item as any).dev_accessory_intelligence?.recommendation_weight_kg,
        );
        const suggestedWeight = Number.isFinite(idealRecommendationWeightKg)
          && idealRecommendationWeightKg > 0
          ? formatWeight(idealRecommendationWeightKg, unit)
          : '';
        const acceptedSet = acceptedLoadByItemIdRef.current[item.id] || null;
        const weight = log
          ? toWheelWeight(log as SetLog, unit)
          : suggestedWeight
            || defaultAccessoryWeight({
              item: executionItem,
              unit,
              currentSetIndex: roundIndex,
              acceptedSet,
            });
        const weightOptions = buildAccessoryWeightOptions(unit, weight || '0');
        const repsOptions = ['0', ...Array.from({ length: 30 }, (_, idx) => String(idx + 1))];
        const rirOptions = Array.from(
          { length: 11 },
          (_, idx) => formatWheelNumber(idx * 0.5),
        );
        const reps = log?.actual_reps != null
          ? String(log.actual_reps)
          : accInputs[item.id]?.reps || accessoryRepsDefault(executionItem);
        const rir = log?.actual_rir != null
          ? formatWheelNumber(Number(log.actual_rir))
          : accInputs[item.id]?.rir || defaultAccessoryRir(executionItem);
        const previousLog = latestRepeatableSet(
          (item.set_logs || []).filter(
            (candidate) => Number(candidate.set_index || 0) < roundIndex,
          ),
        );
        const repeatDraft = previousLog
          ? accessoryRepeatDraft(previousLog, toWheelWeight(previousLog, unit))
          : null;
        return {
          itemId: item.id,
          title: simplifyMobileMovementName(accessoryExecutionName(item)),
          prescription: accessoryTargetLine(executionItem),
          weight: nearestWheelValue(weightOptions, weight || '0', '0'),
          reps: nearestWheelValue(repsOptions, reps, '10'),
          rir: nearestWheelValue(rirOptions, rir, '2'),
          requiresRir: executionItem.rir_target != null,
          alreadyLogged: Boolean(log),
          loggedResult: log ? loggedSetText(log as SetLog, unit, item) : null,
          validationError: null,
          weightOptions,
          repsOptions,
          rirOptions,
          repeatLast: repeatDraft ? {
            weight: nearestWheelValue(weightOptions, repeatDraft.weight, '0'),
            reps: nearestWheelValue(repsOptions, repeatDraft.reps, '10'),
            rir: nearestWheelValue(rirOptions, repeatDraft.rir, '2'),
            preview: repeatSetPreview(previousLog as SetLog, {
              loadLabel: repeatLoadLabel(item, previousLog as SetLog, unit),
              effort: 'RIR',
            }),
          } : null,
        };
      });
    const draft = createSequentialGroupDraft(entries);
    supersetRoundSaveInFlightRef.current = false;
    resetSupersetRoundTransition();
    setError(null);
    setSupersetRoundLogger({
      groupLabel: group.group,
      roundIndex,
      roundCount: model.roundCount,
      activeIndex: draft.activeIndex,
      saving: false,
      entries: [...draft.entries],
    });
  };

  const updateSupersetRoundEntry = (
    itemId: number,
    field: 'weight' | 'reps' | 'rir',
    nextValue: string,
  ) => {
    setSupersetRoundLogger((current) => {
      if (!current) return current;
      const next = updateSequentialGroupDraft(
        {
          entries: current.entries,
          activeIndex: current.activeIndex,
        },
        itemId,
        field,
        String(nextValue || ''),
      );
      return {
        ...current,
        entries: [...next.entries],
        activeIndex: next.activeIndex,
      };
    });
  };

  const repeatLastIntoSupersetEntry = (itemId: number) => {
    if (
      supersetRoundSaveInFlightRef.current
      || supersetRoundTransitionInFlightRef.current
      || canonicalSetSubmissionControllerRef.current.isInFlight()
    ) return;
    void saveSupersetRound(itemId);
  };

  const resetSupersetRoundTransition = () => {
    supersetRoundTransitionTokenRef.current += 1;
    supersetRoundTransitionInFlightRef.current = false;
    supersetRoundStepOpacity.stopAnimation();
    supersetRoundStepTranslateX.stopAnimation();
    supersetRoundProgressFill.stopAnimation();
    supersetRoundCapturedPulse.stopAnimation();
    supersetRoundCapturedCueOpacity.stopAnimation();
    supersetRoundStepOpacity.setValue(1);
    supersetRoundStepTranslateX.setValue(0);
    supersetRoundProgressFill.setValue(1);
    supersetRoundCapturedPulse.setValue(0);
    supersetRoundCapturedCueOpacity.setValue(0);
    setSupersetRoundTransitioning(false);
    setSupersetRoundCapturedIndex(null);
    setSupersetRoundProgressIndex(null);
  };

  const runSupersetRoundStepTransition = (
    nextLogger: SupersetRoundLoggerState,
    direction: SequentialGroupTransitionDirection,
    capturedIndex: number | null,
  ) => {
    if (supersetRoundTransitionInFlightRef.current) return;
    const transition = sequentialGroupTransitionConfig(direction, reduceMotion);
    const transitionToken = supersetRoundTransitionTokenRef.current + 1;
    supersetRoundTransitionTokenRef.current = transitionToken;
    supersetRoundTransitionInFlightRef.current = true;
    setSupersetRoundTransitioning(true);
    setSupersetRoundCapturedIndex(capturedIndex);
    setSupersetRoundProgressIndex(direction === 'forward' ? nextLogger.activeIndex : null);
    setError(null);

    supersetRoundCapturedCueOpacity.setValue(0);
    supersetRoundCapturedPulse.setValue(0);
    if (direction === 'forward') {
      void Haptics.selectionAsync().catch(() => undefined);
      Animated.sequence([
        Animated.timing(supersetRoundCapturedCueOpacity, {
          duration: 60,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(90),
        Animated.timing(supersetRoundCapturedCueOpacity, {
          duration: 100,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
      Animated.sequence([
        Animated.timing(supersetRoundCapturedPulse, {
          duration: 90,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(supersetRoundCapturedPulse, {
          duration: 120,
          easing: Easing.out(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    }

    Animated.parallel([
      Animated.timing(supersetRoundStepOpacity, {
        duration: transition.outgoingDurationMs,
        easing: Easing.inOut(Easing.quad),
        toValue: 0.18,
        useNativeDriver: true,
      }),
      Animated.timing(supersetRoundStepTranslateX, {
        duration: transition.outgoingDurationMs,
        easing: Easing.inOut(Easing.quad),
        toValue: transition.outgoingTranslateX,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || supersetRoundTransitionTokenRef.current !== transitionToken) return;
      supersetRoundStepOpacity.setValue(0);
      supersetRoundStepTranslateX.setValue(transition.incomingTranslateX);
      supersetRoundProgressFill.setValue(direction === 'forward' ? 0 : 1);
      setSupersetRoundLogger(nextLogger);

      requestAnimationFrame(() => {
        if (supersetRoundTransitionTokenRef.current !== transitionToken) return;
        Animated.parallel([
          Animated.timing(supersetRoundStepOpacity, {
            duration: transition.incomingDurationMs,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(supersetRoundStepTranslateX, {
            duration: transition.incomingDurationMs,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.timing(supersetRoundProgressFill, {
            duration: transition.incomingDurationMs,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start(({ finished: incomingFinished }) => {
          if (
            !incomingFinished
            || supersetRoundTransitionTokenRef.current !== transitionToken
          ) return;
          supersetRoundTransitionInFlightRef.current = false;
          setSupersetRoundTransitioning(false);
          setSupersetRoundCapturedIndex(null);
          setSupersetRoundProgressIndex(null);
          AccessibilityInfo.announceForAccessibility(
            `Movement ${nextLogger.activeIndex + 1} of ${nextLogger.entries.length}`,
          );
        });
      });
    });
  };

  const advanceSupersetRoundLogger = () => {
    if (!supersetRoundLogger || supersetRoundTransitionInFlightRef.current) return;
    const result = advanceSequentialGroupStep({
      entries: supersetRoundLogger.entries,
      activeIndex: supersetRoundLogger.activeIndex,
    });
    setError(result.validation.message);
    if (!result.validation.valid) return;
    Keyboard.dismiss();
    runSupersetRoundStepTransition({
      ...supersetRoundLogger,
      entries: [...result.state.entries],
      activeIndex: result.state.activeIndex,
    }, 'forward', supersetRoundLogger.activeIndex);
  };

  const goBackInSupersetRoundLogger = () => {
    if (!supersetRoundLogger || supersetRoundTransitionInFlightRef.current) return;
    const previous = previousSequentialGroupStep({
      entries: supersetRoundLogger.entries,
      activeIndex: supersetRoundLogger.activeIndex,
    });
    setError(null);
    Keyboard.dismiss();
    runSupersetRoundStepTransition({
      ...supersetRoundLogger,
      entries: [...previous.entries],
      activeIndex: previous.activeIndex,
    }, 'backward', null);
  };

  const skipCurrentSupersetMovement = () => {
    if (!supersetRoundLogger || supersetRoundTransitionInFlightRef.current) return;
    const skipped = skipSequentialGroupStep({
      entries: supersetRoundLogger.entries,
      activeIndex: supersetRoundLogger.activeIndex,
    });
    setError(null);
    Keyboard.dismiss();
    const nextLogger = {
      ...supersetRoundLogger,
      entries: [...skipped.entries],
      activeIndex: skipped.activeIndex,
    };
    if (skipped.activeIndex !== supersetRoundLogger.activeIndex) {
      runSupersetRoundStepTransition(nextLogger, 'forward', null);
    } else {
      setSupersetRoundLogger(nextLogger);
    }
  };

  const logSupersetMovementIndividually = () => {
    if (!supersetRoundLogger || !data) return;
    const entry = supersetRoundLogger.entries[supersetRoundLogger.activeIndex];
    const group = data.workout.accessory_groups.find(
      (candidate) => candidate.group === supersetRoundLogger.groupLabel,
    );
    const item = group?.items.find((candidate) => candidate.id === entry?.itemId);
    if (!item) return;
    closeSupersetRoundLogger();
    requestAnimationFrame(() => openAccessoryWheel(item));
  };

  const closeSupersetRoundLogger = () => {
    supersetRoundSaveInFlightRef.current = false;
    resetSupersetRoundTransition();
    setError(null);
    setSupersetRoundLogger(null);
  };

  async function saveSupersetRound(repeatItemId?: number) {
    if (!supersetRoundLogger || !data || !workoutId) return;
    if (
      supersetRoundSaveInFlightRef.current
      || supersetRoundTransitionInFlightRef.current
      || supersetRoundLogger.saving
    ) return;
    let workingEntries = supersetRoundLogger.entries.map((entry) => (
      repeatItemId === entry.itemId && !entry.alreadyLogged && entry.repeatLast
        ? {
            ...entry,
            ...entry.repeatLast,
            skipped: false,
            validationError: null,
          }
        : entry
    ));
    if (repeatItemId != null) {
      const repeatEntry = workingEntries.find(
        (entry) => entry.itemId === repeatItemId && !entry.alreadyLogged && entry.repeatLast,
      );
      if (!repeatEntry) return;
    } else {
      const draftValidation = validateSequentialGroupForSave({
        entries: workingEntries,
        activeIndex: supersetRoundLogger.activeIndex,
      });
      if (!draftValidation.validation.valid) {
        setSupersetRoundLogger({
          ...supersetRoundLogger,
          entries: [...draftValidation.state.entries],
          activeIndex: draftValidation.state.activeIndex,
        });
        setError(draftValidation.validation.message);
        return;
      }
      workingEntries = [...draftValidation.state.entries];
    }

    const group = data.workout.accessory_groups.find(
      (candidate) => candidate.group === supersetRoundLogger.groupLabel,
    );
    if (!group) return;
    const model = buildSupersetRoundModel(group.items);
    const missingItemIds = new Set(
      missingSupersetRoundItemIds(model, supersetRoundLogger.roundIndex),
    );
    const skippedItemIds = repeatItemId != null
      ? [...missingItemIds].filter((itemId) => itemId !== repeatItemId)
      : workingEntries
          .filter((entry) => missingItemIds.has(entry.itemId) && entry.skipped)
          .map((entry) => entry.itemId);
    const parsedEntries: Array<Omit<SupersetRoundLoggerEntry, 'weight' | 'reps' | 'rir'> & {
      weight: number;
      weightKg: number;
      reps: number;
      rir: number | null;
    }> = [];
    for (const entry of workingEntries) {
      if (!missingItemIds.has(entry.itemId) || entry.skipped) continue;
      if (repeatItemId != null && entry.itemId !== repeatItemId) continue;
      let weight = entry.weight.trim() === '' ? 0 : Number(entry.weight);
      const reps = Number(String(entry.reps).replace(/[^0-9]/g, ''));
      const rirText = String(entry.rir).trim().replace(/[^0-9.\-]/g, '');
      const rir = rirText ? Number(rirText) : null;
      if (unit === 'lb') weight = roundToNearestGymIncrementLb(weight);
      parsedEntries.push({
        ...entry,
        weight,
        weightKg: unit === 'kg' ? weight : weight * KG_PER_LB,
        reps,
        rir,
      });
    }

    supersetRoundSaveInFlightRef.current = true;
    setSupersetRoundLogger({
      ...supersetRoundLogger,
      entries: workingEntries,
      saving: true,
    });
    try {
      if (!parsedEntries.length) {
        closeSupersetRoundLogger();
        return;
      }
      if (!isIdealWorkoutDetailPreview) {
        const roundIndex = supersetRoundLogger.roundIndex;
        const attemptKey = (
          `superset:${supersetRoundLogger.groupLabel}:${roundIndex}`
        );
        const canonicalPayload = {
          group: supersetRoundLogger.groupLabel,
          round_index: roundIndex,
          skipped_item_ids: skippedItemIds,
          entries: parsedEntries.map((entry) => ({
            item_id: entry.itemId,
            actual_weight_kg: entry.weightKg,
            actual_reps: entry.reps,
            actual_rir: entry.rir,
          })),
        };
        const roundSubmissionId = submissionForAttempt(
          attemptKey,
          canonicalPayload,
        );
        const json = await submitCanonicalSet({
          itemId: parsedEntries[0].itemId,
          attemptKey,
          clientSubmissionId: roundSubmissionId,
          fallbackError: 'Could not save this round.',
          request: async () => {
            const response = await fetchJson(
              `${API_BASE}/workouts/mobile/${workoutId}/superset-rounds/${encodeURIComponent(supersetRoundLogger.groupLabel)}/${roundIndex}`,
              {
                method: 'POST',
                auth: true,
                body: {
                  skipped_item_ids: canonicalPayload.skipped_item_ids,
                  entries: canonicalPayload.entries.map((entry) => ({
                    ...entry,
                    client_submission_id:
                      `${roundSubmissionId}:${entry.item_id}`,
                  })),
                },
              },
            );
            if (!response.ok || !response.json?.ok) {
              throw new Error(
                response.json?.error
                || `Could not save this round (HTTP ${response.status})`,
              );
            }
            return response.json;
          },
        });
        if (!json) {
          supersetRoundSaveInFlightRef.current = false;
          setSupersetRoundLogger((current) => current ? {
            ...current,
            saving: false,
          } : current);
          return;
        }
        parsedEntries.forEach((entry) => {
          rememberAcceptedLoad(entry.itemId, roundIndex, entry.weightKg);
        });
        setAccInputs((current) => {
          const next = { ...current };
          parsedEntries.forEach((entry) => {
            next[entry.itemId] = {
              weight: formatWheelNumber(entry.weight),
              reps: '',
              rir: '',
            };
          });
          return next;
        });
        feedbackAnalytics('superset_round_logged', {
          group: supersetRoundLogger.groupLabel,
          round_index: roundIndex,
          movement_count: parsedEntries.length,
          persisted: true,
        });
        closeSupersetRoundLogger();
        await fetchWorkout({ silent: true });
        return;
      }
      const parsedByItemId = new Map(
        parsedEntries.map((entry) => [entry.itemId, entry]),
      );
      const roundIndex = supersetRoundLogger.roundIndex;
      setData((current) => current ? {
        ...current,
        workout: {
          ...current.workout,
          accessory_groups: current.workout.accessory_groups.map((candidate) => (
            candidate.group !== supersetRoundLogger.groupLabel
              ? candidate
              : {
                  ...candidate,
                  items: candidate.items.map((item) => {
                    const parsed = parsedByItemId.get(item.id);
                    const alreadyExists = (item.set_logs || []).some(
                      (log) => Number(log.set_index || 0) === roundIndex,
                    );
                    if (!parsed || alreadyExists) return item;
                    const mockSet: SetLog = {
                      id: 9_600_000 + (Number(item.id) * 10) + roundIndex,
                      set_index: roundIndex,
                      actual_weight_kg: parsed.weightKg,
                      actual_reps: parsed.reps,
                      actual_rpe: null,
                      actual_rir: parsed.rir,
                      client_submission_id:
                        `ideal-superset-${supersetRoundLogger.groupLabel}-${item.id}-${roundIndex}`,
                      ...equipmentSnapshotForSet(activeEquipmentIdentity(item)),
                    };
                    return {
                      ...item,
                      set_logs: [...(item.set_logs || []), mockSet],
                    };
                  }),
                }
          )),
        },
      } : current);
      setAccInputs((current) => {
        const next = { ...current };
        parsedEntries.forEach((entry) => {
          next[entry.itemId] = {
            weight: formatWheelNumber(entry.weight),
            reps: '',
            rir: '',
          };
        });
        return next;
      });
      feedbackAnalytics('superset_round_logged', {
        group: supersetRoundLogger.groupLabel,
        round_index: roundIndex,
        movement_count: parsedEntries.length,
      });
      closeSupersetRoundLogger();
      requestAnimationFrame(() => {
        openTimerPicker();
      });
    } catch (error: any) {
      supersetRoundSaveInFlightRef.current = false;
      setSupersetRoundLogger((current) => current ? {
        ...current,
        saving: false,
      } : current);
      setError(error?.message || 'Could not save this round.');
    }
  }

  const switchDisplayUnit = (nextUnit: 'kg' | 'lb') => {
    if (nextUnit === unit) return;
    const currentUnit = unit;
    unitLocalOverrideRef.current = nextUnit;

    setCoreWheel((prev) => {
      if (!prev) return prev;
      const weightKg = weightDisplayToKg(prev.weight, currentUnit);
      const nextWeightRaw = displayWeightFromKg(weightKg, nextUnit);
      const weightOptions = buildCoreWeightOptions(nextUnit, nextWeightRaw);
      return {
        ...prev,
        subtitle: nextUnit.toUpperCase(),
        weightOptions,
        weight: nearestWheelValue(weightOptions, nextWeightRaw, weightOptions[0] || (nextUnit === 'kg' ? '100' : '225')),
      };
    });

    setAccessoryWheel((prev) => {
      if (!prev) return prev;
      const weightKg = weightDisplayToKg(prev.weight, currentUnit);
      const nextWeightRaw = displayWeightFromKg(weightKg, nextUnit);
      const weightOptions = buildAccessoryWeightOptions(nextUnit, nextWeightRaw);
      return {
        ...prev,
        weightOptions,
        weight: nearestWheelValue(weightOptions, nextWeightRaw, '0'),
      };
    });

    setSupersetRoundLogger((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map((entry) => {
          const weightKg = weightDisplayToKg(entry.weight, currentUnit);
          const nextWeight = displayWeightFromKg(weightKg, nextUnit);
          const weightOptions = buildAccessoryWeightOptions(nextUnit, nextWeight);
          return {
            ...entry,
            weightOptions,
            weight: nearestWheelValue(weightOptions, nextWeight, '0'),
          };
        }),
      };
    });

    setEditSetForm((prev) => {
      if (!editSetVisible || !editSetCtx) return prev;
      const weightKg = weightDisplayToKg(prev.weight, currentUnit);
      const nextWeightRaw = displayWeightFromKg(weightKg, nextUnit);
      const weightOptions = buildEditWeightOptions(editSetCtx.mode, nextUnit, nextWeightRaw);
      return {
        ...prev,
        weight: nearestWheelValue(weightOptions, nextWeightRaw, weightOptions[0] || '0'),
      };
    });

    setUnit(nextUnit);
  };

  const openCoreWheel = ({
    kind,
    item,
    setIndex,
    planned,
    targetLine,
  }: {
    kind: CoreWheelKind;
    item: WorkoutItem;
    setIndex?: number;
    planned?: PlannedSet | null;
    targetLine?: string | null;
  }) => {
    const acceptedSet = acceptedLoadByItemIdRef.current[item.id] || null;
    const sessionEvidence = [
      ...(item.set_logs || []),
      ...(acceptedSet ? [acceptedSet] : []),
    ];
    const requestedSetIndex = Number(setIndex || 0);
    const requestedSetAlreadyLogged = requestedSetIndex > 0 && sessionEvidence.some(
      (set) => Number(set.set_index || 0) === requestedSetIndex,
    );
    const currentSetIndex = requestedSetIndex > 0 && !requestedSetAlreadyLogged
      ? requestedSetIndex
      : nextSetIndexFromEvidence(sessionEvidence);
    const rawWeight = defaultCoreWeight({
      item,
      unit,
      currentSetIndex,
      acceptedSet,
      planned: planned || null,
    });
    const weightOptions = buildCoreWeightOptions(unit, rawWeight);
    const weight = nearestWheelValue(weightOptions, rawWeight, weightOptions[0] || (unit === 'kg' ? '100' : '225'));
    const repsOptions = ['0', ...Array.from({ length: 20 }, (_, idx) => String(idx + 1))];
    const rpeOptions = Array.from({ length: 11 }, (_, idx) => formatWheelNumber(5 + idx * 0.5));
    const defaultReps = defaultCoreReps(item, planned || null);
    const defaultRpe = defaultCoreRpe(item, planned || null);
    const reps = nearestWheelValue(repsOptions, defaultReps, defaultReps);
    const rpe = nearestWheelValue(rpeOptions, defaultRpe, '8');

    setCoreWheel({
      visible: true,
      kind,
      itemId: item.id,
      setIndex,
      title: `${liftDisplayName(item)}${setIndex ? ` · Set ${setIndex}` : ''}`,
      subtitle: unit.toUpperCase(),
      targetLine,
      prescriptionLine: targetLine ? `${targetLine} × ${reps} @${rpe}` : null,
      weight,
      reps,
      rpe,
      weightOptions,
      repsOptions,
      rpeOptions,
    });
  };

  const queueCoreWheelLog = (wheel: CoreWheelState) => {
    const weight = wheel.weight;
    feedbackAnalytics('log_set_pressed', { item_id: wheel.itemId, movement_type: 'core', set_kind: wheel.kind });
    const reps = wheel.reps;
    const rpe = reps === '0' ? '' : wheel.rpe;

    if (wheel.kind === 'straight') {
      prefillCoreInput('straight', { id: wheel.itemId } as WorkoutItem, { weight, reps, rpe });
    } else if (wheel.kind === 'top') {
      prefillCoreInput('top', { id: wheel.itemId } as WorkoutItem, { weight, reps, rpe });
    } else if (wheel.kind === 'bk') {
      prefillCoreInput('bk', { id: wheel.itemId } as WorkoutItem, { weight, reps, rpe });
    } else {
      prefillFcInput(`${wheel.itemId}:${wheel.setIndex}`, { weight, reps, rpe });
    }

    setPendingCoreWheelLog({
      kind: wheel.kind,
      itemId: wheel.itemId,
      setIndex: wheel.setIndex,
    });
  };

  const commitCoreWheel = () => {
    if (!coreWheel) return;
    queueCoreWheelLog(coreWheel);
  };

  // Helper to ensure reps is initialized in state for controlled TextInput
  const ensureCoreRepsPrefill = (
    itemId: number,
    kind: 'straight' | 'top' | 'bk',
    fallbackReps: number | string | null | undefined,
  ) => {
    const repsStr = (fallbackReps != null && String(fallbackReps).trim() !== '')
      ? String(fallbackReps)
      : '';

    if (kind === 'straight') {
      setStraightInputs((prev) => {
        const cur = prev[itemId];
        if (cur && (cur.reps ?? '') !== '') return prev;
        return {
          ...prev,
          [itemId]: {
            weight: cur?.weight || '',
            reps: cur?.reps || repsStr,
            rpe: cur?.rpe || '',
          },
        };
      });
      return;
    }

    if (kind === 'top') {
      setTopInputs((prev) => {
        const cur = prev[itemId];
        if (cur && (cur.reps ?? '') !== '') return prev;
        return {
          ...prev,
          [itemId]: {
            weight: cur?.weight || '',
            reps: cur?.reps || repsStr,
            rpe: cur?.rpe || '',
          },
        };
      });
      return;
    }

    setBkInputs((prev) => {
      const cur = prev[itemId];
      if (cur && (cur.reps ?? '') !== '') return prev;
      return {
        ...prev,
        [itemId]: {
          weight: cur?.weight || '',
          reps: cur?.reps || repsStr,
          rpe: cur?.rpe || '',
        },
      };
    });
  };

  // Prefill prescribed reps into controlled state once the Training Session loads.
  useEffect(() => {
    const wk = data?.workout;
    if (!wk?.id) return;

    const coreItems: any[] = Array.isArray(wk.core_items) ? wk.core_items : [];

    // Straight-like items: STRAIGHT and legacy VR-straight only. VR TOP/BK/FULL_CUSTOM
    // must stay in their own logging buckets so prescribed sets are not hidden.
    const straightLike = coreItems.filter((it) => it && isStraightWorkoutItem(it));
    if (straightLike.length) {
      setStraightInputs((prev) => {
        let next = prev;
        for (const it of straightLike) {
          const id = it.id;
          const reps = it.reps;
          if (id == null || reps == null) continue;
          const cur = prev[id];
          if (cur && String(cur.reps || '').trim() !== '') continue;
          if (next === prev) next = { ...prev };
          next[id] = {
            weight: cur?.weight || '',
            reps: String(reps),
            rpe: cur?.rpe || '',
          };
        }
        return next;
      });
    }

    // Top items
    const topItems = coreItems.filter((it) => isTopWorkoutItem(it));
    if (topItems.length) {
      setTopInputs((prev) => {
        let next = prev;
        for (const it of topItems) {
          const id = it.id;
          const reps = it.reps;
          if (id == null || reps == null) continue;
          const cur = prev[id];
          if (cur && String(cur.reps || '').trim() !== '') continue;
          if (next === prev) next = { ...prev };
          next[id] = {
            weight: cur?.weight || '',
            reps: String(reps),
            rpe: cur?.rpe || '',
          };
        }
        return next;
      });
    }

    // Backdowns: every BK item should get its own reps prefill
    const bkItems = coreItems.filter((it) => isBackdownWorkoutItem(it));
    if (bkItems.length) {
      setBkInputs((prev) => {
        let next = prev;
        for (const it of bkItems) {
          const id = it.id;
          const reps = it.reps;
          if (id == null || reps == null) continue;
          const cur = prev[id];
          if (cur && String(cur.reps || '').trim() !== '') continue;
          if (next === prev) next = { ...prev };
          next[id] = {
            weight: cur?.weight || '',
            reps: String(reps),
            rpe: cur?.rpe || '',
          };
        }
        return next;
      });
    }

    const fcItems = coreItems.filter(
      (it) => isFullCustomWorkoutItem(it)
    );

    if (fcItems.length) {
      setFcInputs((prev) => {
        let next = prev;
        for (const it of fcItems) {
          const planned = Array.isArray(it.planned_sets) ? it.planned_sets : [];
          for (const ps of planned) {
            const k = `${it.id}:${ps?.set_index}`;
            if (!ps?.set_index) continue;
            const cur = prev[k];
            if (cur && String(cur.reps || '').trim() !== '') continue;
            if (next === prev) next = { ...prev };
            next[k] = {
              weight: cur?.weight || '',
              reps: ps?.reps != null ? String(ps.reps) : (cur?.reps || ''),
              rpe: cur?.rpe || '',
            };
          }
        }
        return next;
      });
    }
  }, [data?.workout?.id]);

  const logStraightSet = async (itemId: number, selectedVideo?: SelectedSetVideo | null) => {
    if (!workoutId || !data) return;

    const input = straightInputs[itemId] || { weight: '', reps: '', rpe: '' };
    let weightInUnit = input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;
    const rpe = input.rpe ? parseFloat(input.rpe) : null;

    if (Number.isNaN(weightInUnit)) {
      setError('Enter a valid weight');
      return;
    }
    if (weightInUnit <= 0) {
      setError('Weight required');
      return;
    }
    if (!Number.isFinite(reps) || reps < 0) {
      setError('Reps required');
      return;
    }

    // ROUND lbs before converting
    if (unit === 'lb') {
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
    }

    const weightKg = unit === 'kg'
      ? weightInUnit
      : weightInUnit * KG_PER_LB;

    const prescribedReps = (() => {
      const it = data?.workout?.core_items?.find((x: any) => x?.id === itemId);
      return it?.reps != null ? String(it.reps) : '';
    })();
    const setIndex = intendedSetIndex(itemId);
    const attemptKey = `straight:${itemId}:${setIndex}`;
    const canonicalPayload = {
      intended_set_index: setIndex,
      actual_weight_kg: weightKg,
      actual_reps: reps,
      actual_rpe: rpe,
    };
    if (isIdealWorkoutDetailPreview) {
      const mockSet: SetLog = {
        id: 9_000_000 + (Number(itemId) * 10) + setIndex,
        set_index: setIndex,
        actual_weight_kg: weightKg,
        actual_reps: reps,
        actual_rpe: rpe,
        actual_rir: null,
        client_submission_id: `ideal-core-${itemId}-${setIndex}`,
      };
      if (loggerScenario === 'final-session-completion') {
        const clientSubmissionId = String(mockSet.client_submission_id);
        const recognitionEvent: LoggerRecognitionEvent = {
          id: mockSet.id + 1,
          event_type: 'CORE_WEIGHT_PR',
          priority: 1,
          core_movement_key: 'bench',
          movement_label: 'Competition Bench Press',
          current_value: weightKg,
          prior_value: 220 * KG_PER_LB,
          delta: weightKg - (220 * KG_PER_LB),
          unit: 'kg',
          scope: 'career',
          source_set_log_id: mockSet.id,
          trigger_set_log_id: mockSet.id,
          source_revision: 1,
          calculation_version: 'dev-final-session-validation-v1',
          newly_generated: true,
          replayed: false,
          consumed: false,
          source: {
            workout_id: Number(workoutId),
            workout_item_id: itemId,
            set_log_id: mockSet.id,
          },
        };
        beginFeedbackSubmission(itemId);
        handleCanonicalSetFeedback({
          ok: true,
          created: true,
          replayed: false,
          client_submission_id: clientSubmissionId,
          set: { ...mockSet, item_id: itemId },
          recognition_events: [recognitionEvent],
          completion_boundary: {
            authority: 'canonical',
            movement_final_set: true,
            session_final_set: true,
            remaining_required_sets: 0,
            workout_evidence_revision: 1,
          },
        }, itemId);
      }
      setData((current) => current ? {
        ...current,
        workout: {
          ...current.workout,
          core_items: current.workout.core_items.map((item) => (
            Number(item.id) === Number(itemId)
              ? { ...item, set_logs: [...(item.set_logs || []), mockSet] }
              : item
          )),
        },
      } : current);
      if (loggerScenario !== 'final-session-completion') setCoreWheel(null);
      setStraightInputs((current) => ({
        ...current,
        [itemId]: {
          weight: formatWheelNumber(weightInUnit),
          reps: prescribedReps,
          rpe: '',
        },
      }));
      setError(null);
      return;
    }
    const clientSubmissionId = submissionForAttempt(attemptKey, canonicalPayload);

    const json = await submitCanonicalSet({
      itemId,
      attemptKey,
      clientSubmissionId,
      fallbackError: 'Error logging set',
      request: async () => {
        const { ok, status, json: responseJson } = await fetchJson(
          `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_straight`,
          {
            method: 'POST',
            body: {
              ...canonicalPayload,
              client_submission_id: clientSubmissionId,
            },
            auth: true,
          }
        );
        if (!ok || !responseJson?.ok) {
          throw new Error(responseJson?.error || `Failed to log set (HTTP ${status})`);
        }
        return responseJson;
      },
    });
    if (!json) return;
    rememberAcceptedLoad(itemId, setIndex, weightKg);

    try {
      markAutoAdvanceAfterAcceptedLog(itemId, json);
      rememberScroll();
      await fetchWorkout();
      const videoError = await attachSelectedVideoToLoggedSet(json?.set?.id, selectedVideo || null);
      if (selectedVideo && !videoError) await fetchWorkout({ silent: true });
      if (videoError) setError(videoError);

      // Prefill next set weight with the weight just used (saves re-typing)
      const nextWeightStr = weightInUnit > 0
        ? (unit === 'lb'
            ? String(roundToNearestGymIncrementLb(weightInUnit))
            : String(weightInUnit))
        : '';

      setStraightInputs((prev) => ({
        ...prev,
        [itemId]: { weight: nextWeightStr, reps: prescribedReps, rpe: '' },
      }));
    } catch (err: any) {
      console.log('logStraightSet post-acceptance refresh error', err);
      setError('Set logged, but the Session refresh did not finish. Pull to refresh.');
    }
  };

  const logTopSet = async (itemId: number, selectedVideo?: SelectedSetVideo | null) => {
    if (!workoutId || !data) return;

    const input = topInputs[itemId] || { weight: '', reps: '', rpe: '' };
    let weightInUnit = input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;
    const rpe = input.rpe ? parseFloat(input.rpe) : null;

    if (Number.isNaN(weightInUnit) || weightInUnit <= 0) {
      setError(`Enter a valid top set weight (${unit})`);
      return;
    }
    if (!Number.isFinite(reps) || reps < 0) {
      setError('Reps required');
      return;
    }
    if (reps > 0 && rpe == null) {
      setError('Enter a valid top set RPE');
      return;
    }

    // ROUND lbs before conversion
    if (unit === 'lb') {
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
    }

    const weightKg = unit === 'kg'
      ? weightInUnit
      : weightInUnit * KG_PER_LB;

    const prescribedReps = (() => {
      const it = data?.workout?.core_items?.find((x: any) => x?.id === itemId);
      return it?.reps != null ? String(it.reps) : '';
    })();
    const setIndex = intendedSetIndex(itemId);
    const attemptKey = `top:${itemId}:${setIndex}`;
    const canonicalPayload = {
      intended_set_index: setIndex,
      actual_weight_kg: weightKg,
      actual_reps: reps,
      actual_rpe: rpe,
    };
    const clientSubmissionId = submissionForAttempt(attemptKey, canonicalPayload);

    const json = await submitCanonicalSet({
      itemId,
      attemptKey,
      clientSubmissionId,
      fallbackError: 'Error logging top set',
      request: async () => {
        const { ok, status, json: responseJson } = await fetchJson(
          `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_top`,
          {
            method: 'POST',
            body: {
              ...canonicalPayload,
              client_submission_id: clientSubmissionId,
            },
            auth: true,
          }
        );
        if (!ok || !responseJson?.ok) {
          throw new Error(responseJson?.error || `Failed to log top set (HTTP ${status})`);
        }
        return responseJson;
      },
    });
    if (!json) return;
    rememberAcceptedLoad(itemId, setIndex, weightKg);

    try {
      markAutoAdvanceAfterAcceptedLog(itemId, json);
      rememberScroll();
      await fetchWorkout();
      const videoError = await attachSelectedVideoToLoggedSet(json?.set?.id, selectedVideo || null);
      if (selectedVideo && !videoError) await fetchWorkout({ silent: true });
      if (videoError) setError(videoError);
      setTopInputs((prev) => ({
        ...prev,
        [itemId]: { weight: '', reps: prescribedReps, rpe: '' },
      }));
    } catch (err: any) {
      console.log('logTopSet post-acceptance refresh error', err);
      setError('Set logged, but the Session refresh did not finish. Pull to refresh.');
    }
  };

  const logBackdownSet = async (itemId: number, selectedVideo?: SelectedSetVideo | null) => {
    if (!workoutId || !data) return;

    const input = bkInputs[itemId] || { weight: '', reps: '', rpe: '' };
    let weightInUnit = input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;
    const rpe = input.rpe ? parseFloat(input.rpe) : null;

    if (Number.isNaN(weightInUnit)) {
      setError(`Enter a valid backdown set weight (${unit})`);
      return;
    }
    if (weightInUnit <= 0) {
      setError(`Weight required`);
      return;
    }
    if (!Number.isFinite(reps) || reps < 0) {
      setError('Reps required');
      return;
    }

    // ROUND lbs before conversion
    if (unit === 'lb') {
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
    }

    const weightKg = unit === 'kg'
      ? weightInUnit
      : weightInUnit * KG_PER_LB;

    const prescribedReps = (() => {
      const it = data?.workout?.core_items?.find((x: any) => x?.id === itemId);
      return it?.reps != null ? String(it.reps) : '';
    })();
    const setIndex = intendedSetIndex(itemId);
    const attemptKey = `backdown:${itemId}:${setIndex}`;
    const canonicalPayload = {
      intended_set_index: setIndex,
      actual_weight_kg: weightKg,
      actual_reps: reps,
      actual_rpe: rpe,
    };
    const clientSubmissionId = submissionForAttempt(attemptKey, canonicalPayload);

    const json = await submitCanonicalSet({
      itemId,
      attemptKey,
      clientSubmissionId,
      fallbackError: 'Error logging backdown set',
      request: async () => {
        const { ok, status, json: responseJson } = await fetchJson(
          `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_bk`,
          {
            method: 'POST',
            body: {
              ...canonicalPayload,
              client_submission_id: clientSubmissionId,
            },
            auth: true,
          }
        );
        if (!ok || !responseJson?.ok) {
          throw new Error(responseJson?.error || `Failed to log backdown set (HTTP ${status})`);
        }
        return responseJson;
      },
    });
    if (!json) return;
    rememberAcceptedLoad(itemId, setIndex, weightKg);

    try {
      markAutoAdvanceAfterAcceptedLog(itemId, json);
      rememberScroll();
      await fetchWorkout();
      const videoError = await attachSelectedVideoToLoggedSet(json?.set?.id, selectedVideo || null);
      if (selectedVideo && !videoError) await fetchWorkout({ silent: true });
      if (videoError) setError(videoError);

      // Prefill next set weight with the weight just used (saves re-typing)
      const nextWeightStr = weightInUnit > 0
        ? (unit === 'lb'
            ? String(roundToNearestGymIncrementLb(weightInUnit))
            : String(weightInUnit))
        : '';

      setBkInputs((prev) => ({
        ...prev,
        [itemId]: { weight: nextWeightStr, reps: prescribedReps, rpe: '' },
      }));
    } catch (err: any) {
      console.log('logBackdownSet post-acceptance refresh error', err);
      setError('Set logged, but the Session refresh did not finish. Pull to refresh.');
    }
  };

  const logFullCustomSet = async (itemId: number, setIndex: number, selectedVideo?: SelectedSetVideo | null) => {
    if (!workoutId || !data) return;

    const key = `${itemId}:${setIndex}`;
    const input = fcInputs[key] || { weight: '', reps: '', rpe: '' };

    let weightInUnit = input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;
    const rpe = input.rpe ? parseFloat(input.rpe) : null;

    if (Number.isNaN(weightInUnit)) return setError(`Enter a valid weight (${unit})`);
    if (weightInUnit <= 0) return setError('Weight required');
    if (!Number.isFinite(reps) || reps < 0) return setError('Reps required');

    if (unit === 'lb') weightInUnit = roundToNearestGymIncrementLb(weightInUnit);

    const weightKg = unit === 'kg' ? weightInUnit : weightInUnit * KG_PER_LB;
    const attemptKey = `full-custom:${itemId}:${setIndex}`;
    const canonicalPayload = {
      set_index: setIndex,
      actual_weight_kg: weightKg,
      actual_reps: reps,
      actual_rpe: rpe,
    };
    const clientSubmissionId = submissionForAttempt(attemptKey, canonicalPayload);

    const json = await submitCanonicalSet({
      itemId,
      attemptKey,
      clientSubmissionId,
      fallbackError: 'Error logging set',
      request: async () => {
        const { ok, status, json: responseJson } = await fetchJson(
          `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_fc`,
          {
            method: 'POST',
            auth: true,
            body: {
              ...canonicalPayload,
              client_submission_id: clientSubmissionId,
            },
          }
        );
        if (!ok || !responseJson?.ok) throw new Error(responseJson?.error || `Failed (HTTP ${status})`);
        return responseJson;
      },
    });
    if (!json) return;
    rememberAcceptedLoad(itemId, setIndex, weightKg);

    try {
      markAutoAdvanceAfterAcceptedLog(itemId, json);
      rememberScroll();
      await fetchWorkout();
      const videoError = await attachSelectedVideoToLoggedSet(json?.set?.id, selectedVideo || null);
      if (selectedVideo && !videoError) await fetchWorkout({ silent: true });
      if (videoError) setError(videoError);

      // optional convenience: carry weight forward
      const nextWeightStr =
        weightInUnit > 0
          ? unit === 'lb'
            ? String(roundToNearestGymIncrementLb(weightInUnit))
            : String(weightInUnit)
          : '';

      setFcInputs((prev) => ({
        ...prev,
        [`${itemId}:${setIndex}`]: {
          weight: nextWeightStr,
          reps: prev[`${itemId}:${setIndex}`]?.reps || '',
          rpe: '',
        },
      }));
    } catch (e: any) {
      console.log('logFullCustomSet post-acceptance refresh error', e);
      setError('Set logged, but the Session refresh did not finish. Pull to refresh.');
    }
  };

  useEffect(() => {
    if (!pendingCoreWheelLog) return;
    const pending = pendingCoreWheelLog;
    setPendingCoreWheelLog(null);

    requestAnimationFrame(() => {
      if (pending.kind === 'straight') logStraightSet(pending.itemId);
      else if (pending.kind === 'top') logTopSet(pending.itemId);
      else if (pending.kind === 'bk') logBackdownSet(pending.itemId);
      else if (pending.kind === 'fc' && pending.setIndex != null) {
        logFullCustomSet(pending.itemId, pending.setIndex);
      }
    });
  }, [pendingCoreWheelLog, straightInputs, topInputs, bkInputs, fcInputs]);

  useEffect(() => {
    if (pendingAccessoryLogItemId == null) return;
    const pending = typeof pendingAccessoryLogItemId === 'object'
      ? pendingAccessoryLogItemId
      : { itemId: pendingAccessoryLogItemId, selectedVideo: null };
    const itemId = pending.itemId;
    setPendingAccessoryLogItemId(null);

    requestAnimationFrame(() => {
      handleAccessorySave(itemId, pending.selectedVideo || null);
    });
  }, [pendingAccessoryLogItemId, accInputs]);

  useEffect(() => {
    const canonicalSetSubmissionController = canonicalSetSubmissionControllerRef.current;
    const acceptedSheetHandoffController = acceptedSheetHandoffControllerRef.current;
    const timerHandoffReleaseController = timerHandoffReleaseControllerRef.current;
    canonicalSetSubmissionController.reset();
    processedSetResultsRef.current.reset();
    setSubmissionAttemptsRef.current = {};
    acceptedLoadByItemIdRef.current = {};
    activeTimerHandoffIdentityRef.current = null;
    timerHandoffReleaseController.reset();
    feedbackDispatch({ type: 'RESET' });
    return () => {
      canonicalSetSubmissionController.reset();
      acceptedSheetHandoffController.reset();
      timerHandoffReleaseController.reset();
    };
  }, [workoutId]);

  useEffect(() => {
    const acceptedItemId = feedbackState.submission.activeItemId;
    if (
      feedbackState.submission.status === 'persisted_new_set' &&
      (feedbackState.submission.lastSetLogId == null || acceptedItemId == null)
    ) {
      feedbackDispatch({ type: 'TIMER_IDLE' });
      return;
    }
    const isSessionFinalSet = (
      feedbackState.submission.status === 'persisted_new_set'
      && feedbackState.completionBoundary.authority === 'canonical'
      && feedbackState.completionBoundary.status === 'session_final_set'
    );
    if (isSessionFinalSet) {
      activeTimerHandoffIdentityRef.current = null;
      timerHandoffReleaseControllerRef.current.reset();
      setTimerPickerVisible(false);
      stopRestTimer();
    }
    const handoffStarted = acceptedSheetHandoffControllerRef.current.begin(
      feedbackState.submission.status,
      feedbackState.submission.lastSetLogId,
      acceptedItemId,
      (plan) => {
        transientRecognitionTrace(10, 'logger sheet close requested');
        if (coreWheel?.itemId === acceptedItemId) setCoreWheel(null);
        if (accessoryWheel?.itemId === acceptedItemId) setAccessoryWheel(null);
        requestAnimationFrame(() => {
          transientRecognitionTrace(11, 'logger sheet close completed');
          if (isSessionFinalSet) {
            const acceptedWorkoutId = Number(workoutId || dataRef.current?.workout?.id || 0);
            const completionEventId = `${acceptedWorkoutId}:${feedbackState.submission.lastSetLogId}`;
            pendingAutoAdvanceRef.current = null;
            activeTimerHandoffIdentityRef.current = null;
            timerHandoffReleaseControllerRef.current.reset();
            setTimerPickerVisible(false);
            stopRestTimer();
            finalSessionCompletionDispatch({
              type: 'QUEUE_CANONICAL_FINAL_SET',
              workoutId: acceptedWorkoutId,
              eventId: completionEventId,
            });
            feedbackDispatch({ type: 'TIMER_IDLE' });
            return;
          }
          if (!plan.openTimerPicker) {
            feedbackDispatch({ type: 'TIMER_IDLE' });
            return;
          }

          const handoffIdentity = `${feedbackState.submission.lastSetLogId}:${acceptedItemId}`;
          activeTimerHandoffIdentityRef.current = handoffIdentity;
          feedbackDispatch({ type: 'TIMER_PICKER_PENDING' });
          transientRecognitionTrace(12, 'timer handoff created', { handoff_identity: handoffIdentity });
          timerHandoffReleaseControllerRef.current.begin(handoffIdentity, () => {
            if (activeTimerHandoffIdentityRef.current !== handoffIdentity) return;
            activeTimerHandoffIdentityRef.current = null;
            setTimerPickerVisible(false);
            feedbackDispatch({ type: 'TIMER_IDLE' });
            transientRecognitionTrace(13, 'timer UI unavailable');
            transientRecognitionTrace(14, 'timer handoff resolved', { outcome: 'unavailable' });
          });
          openTimerPicker();
          if (feedbackState.submission.status === 'persisted_new_set') {
            setCompletedSetSwipeTooltipCandidateSetLogId(feedbackState.submission.lastSetLogId);
          }
        });
      },
    );
    if (handoffStarted && feedbackState.submission.status === 'persisted_new_set') {
      transientRecognitionTrace(9, 'accepted-state dwell started');
    }
  }, [accessoryWheel?.itemId, coreWheel?.itemId, feedbackState.completionBoundary.authority, feedbackState.completionBoundary.status, feedbackState.submission.activeItemId, feedbackState.submission.lastSetLogId, feedbackState.submission.status, openTimerPicker, transientRecognitionTrace, workoutId]);

  useEffect(() => {
    if (!canPresentFinalSessionCompletion({
      state: finalSessionCompletion,
      saveConfirmationVisible: feedbackState.recognition.saveConfirmationVisible,
      recognitionActive: feedbackState.recognition.currentEvent != null,
      recognitionQueueLength: feedbackState.recognition.queuedEvents.length,
      appBackgrounded: feedbackState.appLifecycle === 'background',
      timerPending: feedbackState.timer.status === 'picker_pending',
      timerVisible: timerPickerVisible,
    })) return;
    finalSessionCompletionDispatch({ type: 'PRESENT_PENDING' });
  }, [
    feedbackState.appLifecycle,
    feedbackState.recognition.currentEvent,
    feedbackState.recognition.queuedEvents.length,
    feedbackState.recognition.saveConfirmationVisible,
    feedbackState.timer.status,
    finalSessionCompletion,
    timerPickerVisible,
  ]);

  useEffect(() => {
    if (!shouldShowCompletedSetSwipeTooltip({
      enabled: completedSetSwipeTooltipEnabled,
      hasBeenShown: completedSetSwipeTooltipShown,
      isPersistedNewSet: completedSetSwipeTooltipCandidateSetLogId != null,
      setLogId: completedSetSwipeTooltipCandidateSetLogId,
    })) return;
    setCompletedSetSwipeTooltipSetLogId(completedSetSwipeTooltipCandidateSetLogId);
  }, [completedSetSwipeTooltipCandidateSetLogId, completedSetSwipeTooltipShown]);

  useEffect(() => {
    if (feedbackState.appLifecycle !== 'background') return;
    setCompletedSetSwipeTooltipCandidateSetLogId(null);
    setCompletedSetSwipeTooltipSetLogId(null);
  }, [feedbackState.appLifecycle]);

  const handleCompletedSetSwipeTooltipStarted = useCallback(() => {
    if (!completedSetSwipeTooltipSessionKey || completedSetSwipeTooltipSetLogId == null) return;
    setCompletedSetSwipeTooltipShown(true);
    setCompletedSetSwipeTooltipCandidateSetLogId(null);
    setCompletedSetSwipeTooltipSetLogId(null);
    void markCompletedSetSwipeTooltipShown(completedSetSwipeTooltipSessionKey).catch(() => undefined);
  }, [completedSetSwipeTooltipSessionKey, completedSetSwipeTooltipSetLogId]);

  async function logAccessorySet(
    workoutId: number,
    itemId: number,
    payload: {
      actual_weight_kg: number;
      actual_reps: number;
      actual_rir?: number | null;
      intended_set_index?: number;
      client_submission_id?: string;
    }
  ) {
    console.log('logAccessorySet payload', { workoutId, itemId, payload });

    const { ok, status, json } = await fetchJson(
      `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_acc`,
      {
        method: 'POST',
        body: payload,
        auth: true,
      }
    );

    if (!ok || !json?.ok) {
      throw new Error(
        json?.error || `Failed to log accessory set (HTTP ${status})`
      );
    }

    return json as {
      ok: true;
      set: {
        id: number;
        set_index: number;
        actual_weight_kg: number;
        actual_reps: number;
        actual_rir: number | null;
      };
      next_index: number;
      total_sets: number;
    };
  }

  const handleAccessorySave = async (itemId: number, selectedVideo?: SelectedSetVideo | null) => {
    if (!workoutId || !data) return;

    const input = accInputs[itemId] || { weight: '', reps: '', rir: '' };
    console.log('handleAccessorySave input', { itemId, input });
    let weightInUnit =
      input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    // reps: digits only (defensive against invisible chars)
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;

    // rir: allow number/decimal/negative; strip other characters
    const rirStr = String(input.rir ?? '').trim().replace(/[^0-9.\-]/g, '');
    const rir = rirStr !== '' ? parseFloat(rirStr) : null;

    if (Number.isNaN(weightInUnit)) {
      setError(`Enter a valid accessory weight (${unit})`);
      return;
    }

    if (!Number.isFinite(reps) || reps < 0) {
      setError('Reps required');
      return;
    }

    // ROUND lbs before conversion
    if (unit === 'lb') {
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
    }

    const weightKg = unit === 'kg'
      ? weightInUnit
      : weightInUnit * KG_PER_LB;
    const accessoryItem = (data?.workout?.accessory_groups || [])
      .flatMap((group: any) => group?.items || [])
      .find((row: any) => Number(row?.id) === Number(itemId));
    const loggedIndexes = new Set(
      [
        ...(Array.isArray(accessoryItem?.set_logs) ? accessoryItem.set_logs : []),
        ...(acceptedLoadByItemIdRef.current[itemId]
          ? [acceptedLoadByItemIdRef.current[itemId]]
          : []),
      ]
        .map((row: any) => Number(row?.set_index || 0))
        .filter((value: number) => value > 0),
    );
    let accessorySetIndex = 1;
    while (loggedIndexes.has(accessorySetIndex)) accessorySetIndex += 1;
    const attemptKey = `accessory:${itemId}:${accessorySetIndex}`;
    const canonicalPayload = {
      intended_set_index: accessorySetIndex,
      actual_weight_kg: weightKg,
      actual_reps: Number(reps),
      actual_rir: rir ?? undefined,
    };
    if (isIdealWorkoutDetailPreview) {
      const mockSet: SetLog = {
        id: 9_500_000 + (Number(itemId) * 10) + accessorySetIndex,
        set_index: accessorySetIndex,
        actual_weight_kg: weightKg,
        actual_reps: Number(reps),
        actual_rpe: null,
        actual_rir: rir,
        client_submission_id: `ideal-accessory-${itemId}-${accessorySetIndex}`,
        ...equipmentSnapshotForSet(activeEquipmentIdentity(accessoryItem)),
      };
      setData((current) => current ? {
        ...current,
        workout: {
          ...current.workout,
          accessory_groups: current.workout.accessory_groups.map((group) => ({
            ...group,
            items: group.items.map((item) => (
              Number(item.id) === Number(itemId)
                ? { ...item, set_logs: [...(item.set_logs || []), mockSet] }
                : item
            )),
          })),
        },
      } : current);
      setAccessoryWheel(null);
      setAccInputs((current) => ({
        ...current,
        [itemId]: {
          weight: formatWheelNumber(weightInUnit),
          reps: '',
          rir: '',
        },
      }));
      setError(null);
      return;
    }
    const clientSubmissionId = submissionForAttempt(attemptKey, canonicalPayload);

    const json = await submitCanonicalSet({
      itemId,
      attemptKey,
      clientSubmissionId,
      fallbackError: 'Error logging accessory set',
      request: () => logAccessorySet(
        Number(workoutId),
        itemId,
        {
          ...canonicalPayload,
          client_submission_id: clientSubmissionId,
        }
      ),
    });
    if (!json) return;
    rememberAcceptedLoad(itemId, accessorySetIndex, weightKg);

    try {
      markAutoAdvanceAfterAcceptedLog(itemId, json);
      rememberScroll();
      await fetchWorkout();
      const videoError = await attachSelectedVideoToLoggedSet(json?.set?.id, selectedVideo || null);
      if (selectedVideo && !videoError) await fetchWorkout({ silent: true });
      if (videoError) setError(videoError);

      // Prefill next set weight with the weight just used (saves re-typing)
      const nextWeightStr = weightInUnit > 0
        ? (unit === 'lb'
            ? String(roundToNearestGymIncrementLb(weightInUnit))
            : String(weightInUnit))
        : '';

      setAccInputs((prev) => ({
        ...prev,
        [itemId]: { weight: nextWeightStr, reps: '', rir: '' },
      }));
    } catch (err: any) {
      console.log('handleAccessorySave post-acceptance refresh error', err);
      setError('Set logged, but the Session refresh did not finish. Pull to refresh.');
    }
  };

  const clearTopSet = async (itemId: number) => {
    if (!workoutId || !data) return;

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/clear_top`,
        {
          method: 'POST',
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to clear top set (HTTP ${status})`);
      }
      const invalidatedEventIds = Array.isArray(json?.invalidated_recognition_event_ids)
        ? json.invalidated_recognition_event_ids.map(Number).filter(Number.isFinite)
        : [];
      feedbackDispatch({ type: 'INVALIDATE_EVENTS', eventIds: invalidatedEventIds });
      void invalidateRecognitionEvents(String(workoutId), invalidatedEventIds).catch(() => feedbackAnalytics('recognition_invalidation_storage_failed', { mutation: 'clear', count: invalidatedEventIds.length }));
      rememberScroll();
      await fetchWorkout();
    } catch (err: any) {
      console.log('clearTopSet error', err);
      setError(err?.message || 'Error clearing top set');
    } finally {
      setSavingItemId(null);
    }
  };

  const performStatusAction = async (kind: 'begin' | 'complete' | 'cancel') => {
    if (!workoutId) return;

    let path = '';
    if (kind === 'begin') path = 'begin';
    if (kind === 'complete') path = 'complete';
    if (kind === 'cancel') path = 'cancel';

    try {
      setActionLoading(kind);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/${path}`,
        {
          method: 'POST',
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to update Session status (HTTP ${status})`);
      }

      // pull fresh status + set_logs etc
      await fetchWorkout();
    } catch (err: any) {
      console.log('performStatusAction error', err);
      setError(err?.message || 'Error updating Training Session');
    } finally {
      setActionLoading(null);
    }
  };

  const beginWorkoutConfirmed = async (reason?: string) => {
    if (!data?.workout) return;
    const wkId = data.workout.id;

    if (!canLogFromServer) {
      Alert.alert('Read-only', 'You do not have permission to log this training session on mobile.');
      return;
    }

    if (isIdealWorkoutDetailPreview) {
      setData((current) => current ? {
        ...current,
        workout: {
          ...current.workout,
          status: 'in_progress',
          started_at: '2026-07-22T17:00:00Z',
          tardy_reason: reason || current.workout.tardy_reason,
        },
      } : current);
      return;
    }

    try {
      setActionLoading('begin');
      setError(null);

      // Step 1: check out the Training Session to this mobile client.
      const checkout = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/checkout`,
        { method: 'POST', auth: true }
      );

      if (!checkout.ok || !checkout.json?.ok) {
        Alert.alert(
          'Unable to begin session',
          checkout.json?.error ||
            `Training Session is currently checked out by another user or device. (HTTP ${checkout.status})`
        );
        return;
      }

      // Step 2: mark status as in_progress
      const begun = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/begin`,
        {
          method: 'POST',
          auth: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reason ? { tardy_reason: reason } : {}),
        }
      );

      if (!begun.ok || !begun.json?.ok) {
        Alert.alert('Error', begun.json?.error || `Failed to begin session (HTTP ${begun.status})`);
        return;
      }

      // Pull fresh Training Session data (status, logs, etc.).
      await fetchWorkout();
    } catch (err) {
      console.error('beginWorkout error', err);
      Alert.alert('Error', 'Failed to begin session');
    } finally {
      setActionLoading(null);
    }
  };

  const beginWorkout = async () => {
    const workout = data?.workout;
    if (workout?.loggable === false || workout?.timeliness === 'missed') {
      Alert.alert(
        'Session locked',
        workout.block_reason || (isIndividualUser
          ? 'This session is outside the 48-hour logging window. Shift the session date from Programming Manager.'
          : 'This session is outside the 48-hour logging window. Ask your coach to shift the date.')
      );
      return;
    }
    if (workout?.requires_tardy_reason && !String(workout.tardy_reason || '').trim()) {
      setTardyReason('');
      setTardyReasonVisible(true);
      return;
    }
    if (
      data?.workout?.status === 'completed' &&
      (data?.workout as any)?.post_session_submitted_at
    ) {
      Alert.alert(
        'Resume Session?',
        'Resuming this completed session will delete its post-session reflection.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resume Session',
            style: 'destructive',
            onPress: () => {
              requestAnimationFrame(() => beginWorkoutConfirmed());
            },
          },
        ]
      );
      return;
    }

    await beginWorkoutConfirmed();
  };

  const submitTardyReason = async () => {
    const reason = tardyReason.trim();
    if (!reason) {
      Alert.alert(
        'Reason required',
        isIndividualUser
          ? 'This session is being logged late. Add a quick note for your training log.'
          : 'This session is being logged late. Add a quick reason for your coach.'
      );
      return;
    }
    setTardyReasonVisible(false);
    await beginWorkoutConfirmed(reason);
  };

  const completeWorkout = async ({
    skipIncompleteWarning = false,
    sessionTimes = null,
  }: {
    skipIncompleteWarning?: boolean;
    sessionTimes?: { startedAt: string; endedAt: string } | null;
  } = {}) => {
    if (!data?.workout) return false;
    const wkId = data.workout.id;

    if (!skipIncompleteWarning && missingSetLabelsForWorkout(data.workout).length > 0) {
      setMissingCompletionSets(missingSetLabelsForWorkout(data.workout));
      return false;
    }

    if (isIdealWorkoutDetailPreview && loggerScenario === 'final-session-completion') {
      const completedFixture = createWorkoutDetailFixture('completed-recap-v2', 'post_session') as WorkoutPayload;
      const summaryId = completedFixture.workout.impact_summary?.summary_id || null;
      stopRestTimer();
      freshCompletionSummaryIdRef.current = summaryId;
      setAnimatedCompletionSummaryId(summaryId);
      setData(completedFixture);
      void triggerSessionCompletionHaptic();
      return true;
    }

    try {
      setActionLoading('complete');
      setError(null);

      const done = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/complete`,
        {
          method: 'POST',
          auth: true,
          body: sessionTimes ? {
            session_started_at: sessionTimes.startedAt,
            session_ended_at: sessionTimes.endedAt,
          } : undefined,
        }
      );

      if (!done.ok || !done.json?.ok) {
        Alert.alert('Error', done.json?.error || `Failed to complete session (HTTP ${done.status})`);
        return false;
      }

      // Completion owns the timer lifecycle. Clear both the local countdown and
      // persisted/global presenter before entering any post-session surface.
      stopRestTimer();

      const completionTransitioned =
        done.json?.completion_transitioned === true &&
        done.json?.impact_summary?.canonically_completed === true;
      if (completionTransitioned) {
        const summaryId = done.json.impact_summary.summary_id || null;
        freshCompletionSummaryIdRef.current = summaryId;
        setAnimatedCompletionSummaryId(summaryId);
        void triggerSessionCompletionHaptic();
        feedbackAnalytics('session_impact_summary_completed', { summary_id: done.json.impact_summary.summary_id });
      }

      // Refresh local data
      await fetchWorkout();
      if (completionTransitioned) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: 0, animated: false });
        });
      }

      // Best-effort checkin: release the lock after completion
      try {
        await fetchJson(
          `${API_BASE}/workouts/mobile/${wkId}/checkin`,
          { method: 'POST', auth: true }
        );
      } catch (e) {
        console.warn('checkin after complete failed', e);
      }
      return true;
    } catch (err) {
      console.error('completeWorkout error', err);
      Alert.alert('Error', 'Failed to complete session');
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const postSessionTimeZone = resolveSessionTimeZone(
    data?.workout?.scheduled_timezone,
    postSessionFallbackTimeZone,
  );

  useEffect(() => {
    let active = true;
    void getResolvedTimezone().then((timeZone) => {
      if (active) setPostSessionFallbackTimeZone(timeZone);
    });
    return () => { active = false; };
  }, []);

  const openPostSessionSurvey = () => {
    const isCompleted = String(data?.workout?.status || '').toLowerCase() === 'completed';
    const timeDraft = createSessionTimeDraft(
      data?.workout?.started_at,
      new Date(),
      isCompleted ? data?.workout?.completed_duration_seconds : null,
    );
    setPostSessionForm({
      sessionRpe: null,
      strengthFeeling: '',
      fatigueFeeling: '',
      note: '',
      sessionStart: timeDraft.start,
      sessionEnd: timeDraft.end,
    });
    setPostSessionTimeError(null);
    setPostSessionTimePicker(null);
    setPostSessionTimePickerDraft(null);
    setPostSessionTimePickerMode('date');
    setPostSessionNotesExpanded(false);
    postSessionEffortRailValueRef.current = null;
    setPostSessionVisible(true);
  };

  const openPostSessionTimePicker = (target: 'start' | 'end') => {
    Keyboard.dismiss();
    setPostSessionTimeError(null);
    setPostSessionTimePickerMode('date');
    const current = target === 'start'
      ? postSessionForm.sessionStart
      : postSessionForm.sessionEnd;
    setPostSessionTimePickerDraft(
      current instanceof Date && Number.isFinite(current.getTime())
        ? new Date(current.getTime())
        : new Date(),
    );
    setPostSessionTimePicker(target);
  };

  const closePostSessionTimePicker = () => {
    setPostSessionTimePicker(null);
    setPostSessionTimePickerDraft(null);
    setPostSessionTimePickerMode('date');
  };

  const updatePostSessionTimePickerDraft = (
    part: 'date' | 'time',
    selected: Date,
  ) => {
    const current = postSessionTimePickerDraft;
    if (!(current instanceof Date) || !Number.isFinite(current.getTime())) return;
    const next = part === 'date'
      ? replaceSessionDatePart(current, selected, postSessionTimeZone)
      : replaceSessionTimePart(current, selected, postSessionTimeZone);
    if (!next) {
      setPostSessionTimeError('That date and time is not valid in the Session timezone.');
      return;
    }
    setPostSessionTimePickerDraft(next);
    setPostSessionTimeError(null);
    return next;
  };

  const commitPostSessionTimePicker = (candidate = postSessionTimePickerDraft) => {
    if (!postSessionTimePicker || !candidate) return;
    const nextForm = {
      ...postSessionForm,
      [postSessionTimePicker === 'start' ? 'sessionStart' : 'sessionEnd']: candidate,
    };
    const parsed = parseSessionTimeDraft({
      start: nextForm.sessionStart,
      end: nextForm.sessionEnd,
    });
    if (!parsed.value) {
      setPostSessionTimeError(parsed.error);
      return;
    }
    setPostSessionForm(nextForm);
    setPostSessionTimeError(null);
    closePostSessionTimePicker();
  };

  const setPostSessionEffort = (value: number) => {
    const next = Math.max(6, Math.min(10, Math.round(value * 2) / 2));
    if (postSessionEffortRailValueRef.current !== next) {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    postSessionEffortRailValueRef.current = next;
    setPostSessionForm((prev) => prev.sessionRpe === next ? prev : { ...prev, sessionRpe: next });
  };

  const measurePostSessionEffortRail = useCallback(() => {
    postSessionEffortRailRef.current?.measureInWindow((x) => {
      postSessionEffortRailWindowX.current = x;
    });
  }, []);

  const setPostSessionEffortHeld = (held: boolean) => {
    if (reduceMotion) {
      postSessionEffortThumbScale.stopAnimation();
      postSessionEffortThumbScale.setValue(1);
      return;
    }
    Animated.spring(postSessionEffortThumbScale, {
      toValue: held ? 1.12 : 1,
      damping: 18,
      stiffness: 260,
      mass: 0.5,
      useNativeDriver: true,
    }).start();
  };

  const updatePostSessionEffortFromEvent = (event: any) => {
    if (!postSessionEffortRailWidth) return;
    const { locationX, pageX } = event.nativeEvent;
    const x = postSessionEffortRailWindowX.current != null && Number.isFinite(pageX)
      ? pageX - postSessionEffortRailWindowX.current
      : locationX;
    const ratio = Math.max(0, Math.min(1, Number(x || 0) / postSessionEffortRailWidth));
    setPostSessionEffort(6 + (ratio * 4));
  };

  const requestCompleteWorkout = () => {
    if (!data?.workout) return;
    const missingSets = missingSetLabelsForWorkout(data.workout);
    if (missingSets.length > 0) {
      setMissingCompletionSets(missingSets);
      return;
    }
    openPostSessionSurvey();
  };

  useEffect(() => {
    const workoutKey = Number(data?.workout?.id || workoutId || 0);
    finalSessionEndTransitionRef.current = false;
    finalSessionCompletionDispatch({ type: 'RESET_WORKOUT', workoutId: workoutKey });
  }, [data?.workout?.id, workoutId]);

  const dismissFinalSessionCompletion = useCallback(() => {
    if (finalSessionCompletion.phase !== 'visible') return;
    finalSessionCompletionDispatch({ type: 'NOT_YET' });
  }, [finalSessionCompletion.phase]);

  const endSessionFromFinalSet = useCallback(() => {
    if (finalSessionCompletion.phase !== 'visible' || finalSessionEndTransitionRef.current) return;
    finalSessionEndTransitionRef.current = true;
    finalSessionCompletionDispatch({ type: 'BEGIN_END_SESSION' });
    requestAnimationFrame(() => {
      try {
        openPostSessionSurvey();
        finalSessionCompletionDispatch({ type: 'END_SESSION_TRANSITION_SUCCEEDED' });
      } catch (transitionError) {
        console.error('open final-set post-session flow error', transitionError);
        finalSessionCompletionDispatch({ type: 'END_SESSION_TRANSITION_FAILED' });
        setError('Unable to open Session completion. Try End Session again.');
      } finally {
        finalSessionEndTransitionRef.current = false;
      }
    });
  }, [finalSessionCompletion.phase]);

  const continueToPostSessionWithMissingSets = () => {
    setMissingCompletionSets(null);
    requestAnimationFrame(() => openPostSessionSurvey());
  };

  const skipPostSessionAndComplete = async () => {
    const parsed = parseSessionTimeDraft({
      start: postSessionForm.sessionStart,
      end: postSessionForm.sessionEnd,
    });
    if (!parsed.value) {
      setPostSessionTimeError(parsed.error);
      return;
    }
    setPostSessionSubmitting(true);
    try {
      const completed = await completeWorkout({
        skipIncompleteWarning: true,
        sessionTimes: parsed.value,
      });
      if (completed) {
        closePostSessionTimePicker();
        setPostSessionVisible(false);
      }
    } finally {
      setPostSessionSubmitting(false);
    }
  };

  const submitPostSessionAndComplete = async () => {
    const parsedTimes = parseSessionTimeDraft({
      start: postSessionForm.sessionStart,
      end: postSessionForm.sessionEnd,
    });
    if (!parsedTimes.value) {
      setPostSessionTimeError(parsedTimes.error);
      return;
    }
    if (
      postSessionForm.sessionRpe == null ||
      !postSessionForm.strengthFeeling ||
      !postSessionForm.fatigueFeeling
    ) {
      setError('Complete the post-session check-in or choose Skip & Complete.');
      return;
    }

    if (!workoutId) {
      setError('Missing Session id');
      return;
    }

    try {
      setPostSessionSubmitting(true);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/post_session_survey`,
        {
          method: 'POST',
          auth: true,
          body: {
            session_rpe: postSessionForm.sessionRpe,
            strength_feeling: postSessionForm.strengthFeeling,
            fatigue_feeling: postSessionForm.fatigueFeeling,
            note: postSessionForm.note,
          },
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to save post-session survey (HTTP ${status})`);
      }

      const completed = await completeWorkout({
        skipIncompleteWarning: true,
        sessionTimes: parsedTimes.value,
      });
      if (completed) {
        closePostSessionTimePicker();
        setPostSessionVisible(false);
      }
    } catch (err: any) {
      console.log('submitPostSessionAndComplete error', err);
      setError(err?.message || 'Failed to submit post-session survey');
    } finally {
      setPostSessionSubmitting(false);
    }
  };

  const cancelWorkout = async () => {
    if (!data?.workout) return;
    const wkId = data.workout.id;

    try {
      setActionLoading('cancel');
      setError(null);

      const canceled = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/cancel`,
        { method: 'POST', auth: true }
      );

      if (!canceled.ok || !canceled.json?.ok) {
        Alert.alert('Error', canceled.json?.error || `Failed to cancel session (HTTP ${canceled.status})`);
        return;
      }

      // Refresh local data
      await fetchWorkout();

      // Best-effort checkin: release the lock after cancel
      try {
        await fetchJson(
          `${API_BASE}/workouts/mobile/${wkId}/checkin`,
          { method: 'POST', auth: true }
        );
      } catch (e) {
        console.warn('checkin after cancel failed', e);
      }
    } catch (err) {
      console.error('cancelWorkout error', err);
      Alert.alert('Error', 'Failed to cancel session');
    } finally {
      setActionLoading(null);
    }
  };

  const fetchWorkout = useCallback(async (opts?: {
    silent?: boolean;
    reason?: 'initial' | 'foreground' | 'focus' | 'body_recovery' | 'manual';
  }) => {
    if (!workoutId) {
      setError('Missing Session id');
      setLoading(false);
      setRefreshing(false);
      return false;
    }

    const silent = !!opts?.silent;

    if (silent) setRefreshing(true);
    else if (!dataRef.current) setLoading(true);
    else setRefreshing(true);

    setError(null);
    const requestedWorkoutId = String(workoutId);
    const requestResult = await workoutRequestManagerRef.current.run(async (signal) => {
      if (isIdealWorkoutDetailPreview) {
        const fixturePayload = (
          loggerScenario
            ? createWorkoutDetailFixture(loggerScenario, idealWorkoutDetailLifecycle)
            : createWorkoutDetailFixture('primary-squat', idealWorkoutDetailLifecycle)
        ) as WorkoutPayload;
        const payload = hydrateWorkoutDetailEquipmentSelections(
          fixturePayload as unknown as Record<string, any>,
        ) as WorkoutPayload;
        return payload;
      }

      const query = new URLSearchParams({ history: 'summary' });
      if (coachPreviewRequested) query.set('view', 'coach-preview');
      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${requestedWorkoutId}?${query.toString()}`,
        { method: 'GET', auth: true, signal }
      );

      const payload = json as WorkoutPayload;

      if (!ok || !payload?.ok) {
        throw new Error((payload as any)?.error || `Failed to load Training Session (HTTP ${status})`);
      }
      if (
        coachPreviewRequested
        && (payload.view_mode !== 'coach_preview' || payload.permissions?.view_only !== true)
      ) {
        throw new Error('Athlete View could not be verified as read-only.');
      }
      if (String(payload.workout?.id) !== requestedWorkoutId) {
        throw new Error('Training Session response did not match the requested Session.');
      }
      const validation = validateSessionLoggerPayload({
        candidate: payload,
        current: dataRef.current,
        requestedWorkoutId,
      });
      if (!validation.ok) {
        console.warn('[SessionLogger] rejected incoherent Session payload', {
          reason: validation.reason,
          request_reason: opts?.reason || 'initial',
          workout_id: requestedWorkoutId,
        });
        throw new Error('Training Session refresh was incomplete. Your current Session remains available.');
      }
      return payload;
    });

    if (requestResult.kind === 'cancelled' || requestResult.kind === 'obsolete') {
      if (
        screenMountedRef.current
        && !workoutRequestManagerRef.current.hasActiveRequest()
      ) {
        setLoading(false);
        setRefreshing(false);
      }
      return false;
    }

    if (requestResult.kind === 'error') {
      const err: any = requestResult.error;
      console.log('Training Session fetch error', err);
      if (!screenMountedRef.current) return false;
      setError(err?.message || 'Error loading Training Session');
      if (!silent && !dataRef.current) setData(null);
      if (silent) setRefreshing(false);
      else {
        setLoading(false);
        setRefreshing(false);
      }
      return false;
    }

    const payload = requestResult.value;
    if (!screenMountedRef.current) return false;
    if (!unitPreferenceHydratedRef.current) {
      if (unitLocalOverrideRef.current == null) {
        setUnit(normalizeReadinessUnit(payload.athlete?.preferred_units));
      }
      unitPreferenceHydratedRef.current = true;
    }
    setAcceptedSetEvidenceItemIds(new Set(persistedSetLogItemIds(payload.workout)));
    // Publish the accepted payload to event callbacks and React in one ownership
    // step. A later foreground callback can never observe an older dataRef while
    // the screen is already rendering the new Session.
    dataRef.current = payload;
    setData(payload);
    restoreScrollSoon();
    if (silent) setRefreshing(false);
    else {
      setLoading(false);
      setRefreshing(false);
    }
    return true;
  }, [
    idealWorkoutDetailLifecycle,
    isIdealWorkoutDetailPreview,
    loggerScenario,
    coachPreviewRequested,
    workoutId,
  ]);

  const remountLoggerBody = useCallback(() => {
    pendingRestoreScrollYRef.current = scrollYRef.current;
    scrollViewportHeightRef.current = 0;
    scrollContentHeightRef.current = 0;
    setBodyRecoveryFailed(false);
    setBodyRenderGeneration((generation) => generation + 1);
    requestAnimationFrame(() => requestAnimationFrame(restoreScrollSoon));
  }, []);

  const revalidateActiveLogger = useCallback((
    reason: 'foreground' | 'focus' | 'body_recovery',
  ) => {
    const current = dataRef.current;
    if (!current?.workout || String(current.workout.id) !== String(workoutId)) return;
    if (!loggerRecoveryGateRef.current.beginLifecycleRecovery(Date.now())) return;
    if (__DEV__) {
      console.info('[SessionLoggerLifecycle] revalidate retained Session', {
        reason,
        route_workout_id: String(workoutId),
        active_workout_id: String(current.workout.id),
        movement_count: sessionLoggerMovementCount(current),
        request_active: workoutRequestManagerRef.current.hasActiveRequest(),
      });
    }
    remountLoggerBody();
    void fetchWorkout({ silent: true, reason });
  }, [fetchWorkout, remountLoggerBody, workoutId]);

  useEffect(() => {
    resumeRefreshRef.current = () => revalidateActiveLogger('foreground');
    return () => {
      resumeRefreshRef.current = () => undefined;
    };
  }, [revalidateActiveLogger]);

  useFocusEffect(useCallback(() => {
    if (!hasFocusedLoggerRef.current) {
      hasFocusedLoggerRef.current = true;
      return undefined;
    }
    revalidateActiveLogger('focus');
    return undefined;
  }, [revalidateActiveLogger]));

  const assessLoggerBodyHealth = useCallback(() => {
    if (bodyRecoveryTimerRef.current) clearTimeout(bodyRecoveryTimerRef.current);
    bodyRecoveryTimerRef.current = setTimeout(() => {
      bodyRecoveryTimerRef.current = null;
      const current = dataRef.current;
      const status = String(current?.workout?.status || '').toLowerCase();
      const expectsMovementBody = status === 'in_progress'
        && sessionLoggerMovementCount(current) > 0;
      const bodyIsLaidOut = scrollViewportHeightRef.current > 1
        && scrollContentHeightRef.current > 1;
      if (!expectsMovementBody || bodyIsLaidOut) {
        loggerRecoveryGateRef.current.markBodyHealthy();
        setBodyRecoveryFailed(false);
        return;
      }
      if (!loggerRecoveryGateRef.current.acquireBodyRecovery()) {
        if (__DEV__) {
          console.warn('[SessionLoggerLifecycle] body recovery exhausted', {
            workout_id: current?.workout?.id ?? null,
            movement_count: sessionLoggerMovementCount(current),
            viewport_height: scrollViewportHeightRef.current,
            content_height: scrollContentHeightRef.current,
          });
        }
        setBodyRecoveryFailed(true);
        return;
      }
      remountLoggerBody();
      void fetchWorkout({ silent: true, reason: 'body_recovery' }).then(() => {
        assessLoggerBodyHealth();
      });
    }, 300);
  }, [fetchWorkout, remountLoggerBody]);

  const retryLoggerBody = useCallback(() => {
    loggerRecoveryGateRef.current.reset();
    remountLoggerBody();
    void fetchWorkout({ silent: true, reason: 'body_recovery' }).then(() => {
      assessLoggerBodyHealth();
    });
  }, [assessLoggerBodyHealth, fetchWorkout, remountLoggerBody]);

  const refreshAfterStaleConflict = useCallback(async () => {
    feedbackDispatch({ type: 'STALE_REFRESH_STARTED' });
    const refreshed = await fetchWorkout({ silent: true });
    if (!refreshed) {
      feedbackDispatch({ type: 'STALE_REFRESH_FAILED' });
      return;
    }
    setCoreWheel(null);
    setAccessoryWheel(null);
    feedbackDispatch({ type: 'STALE_REFRESH_SUCCEEDED' });
    feedbackAnalytics('stale_set_refresh_succeeded');
  }, [fetchWorkout]);

  useEffect(() => {
    startVideoUploadQueue();
    const unsubscribe = subscribeVideoUploadQueue((jobs) => {
      const next: Record<number, { uploading?: boolean; queued?: boolean; uploaded?: boolean; error?: string | null; permanent?: boolean; job?: QueuedVideoUploadJob | null }> = {};
      for (const job of jobs) {
        if (job.status === 'cancelled') continue;
        if (job.workoutId != null && data?.workout?.id != null && Number(job.workoutId) !== Number(data.workout.id)) {
          continue;
        }
        const current = next[job.setLogId];
        if (current?.job && new Date(current.job.updatedAt).getTime() > new Date(job.updatedAt).getTime()) {
          continue;
        }
        next[job.setLogId] = {
          uploading: job.status === 'uploading',
          queued: job.status === 'pending' || job.status === 'failed_retryable',
          uploaded: job.status === 'uploaded',
          error: job.status === 'failed_retryable' || job.status === 'failed_permanent' ? job.lastError || 'Video upload failed.' : null,
          permanent: job.status === 'failed_permanent',
          job,
        };
        if (job.status === 'uploaded' && job.workoutId === data?.workout?.id && !uploadedQueueRefreshRef.current.has(job.id)) {
          uploadedQueueRefreshRef.current.add(job.id);
          void fetchWorkout({ silent: true });
        }
      }
      setVideoUploadBySetLogId(next);
    });
    void processVideoUploadQueue();
    return unsubscribe;
  }, [data?.workout?.id, fetchWorkout]);

  const saveVideoMlConsentChoice = useCallback(async (value: boolean) => {
    const { ok, json } = await fetchJson('/settings/mobile/video-ml-consent', {
      method: 'POST',
      body: { video_ml_training_consent: value } as any,
      auth: true,
    });
    if (ok && json?.ok) {
      setVideoMlTrainingConsent(Boolean(json.video_ml_training_consent));
    } else {
      setVideoMlTrainingConsent(value);
    }
  }, []);

  const ensureVideoMlConsentChoice = useCallback(async (): Promise<boolean> => {
    let currentChoice = videoMlTrainingConsent;
    if (currentChoice === undefined) {
      try {
        const { ok, json } = await fetchJson('/settings/mobile/video-ml-consent', {
          method: 'GET',
          auth: true,
        });
        if (ok && json?.ok && typeof json.video_ml_training_consent === 'boolean') {
          currentChoice = json.video_ml_training_consent;
          setVideoMlTrainingConsent(currentChoice);
        } else {
          currentChoice = null;
          setVideoMlTrainingConsent(null);
        }
      } catch {
        currentChoice = null;
        setVideoMlTrainingConsent(null);
      }
    }

    if (currentChoice !== null) return true;

    return new Promise((resolve) => {
      Alert.alert(
        'Help Improve Future Video Analysis?',
        isIndividualUser
          ? 'Strength Ledger is building future ML tools for things like automatic video tags, camera angle detection, and training analysis. If you allow it, your uploaded training videos and related labels may be used internally to help train and improve those tools. Your videos stay private to you.'
          : 'Strength Ledger is building future ML tools for things like automatic video tags, camera angle detection, and training analysis. If you allow it, your uploaded training videos and related labels may be used internally to help train and improve those tools. Your videos stay private to you and your coach and are never shown to other athletes or coaches.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: async () => {
              try {
                await saveVideoMlConsentChoice(false);
              } catch {
                setVideoMlTrainingConsent(false);
              }
              resolve(true);
            },
          },
          {
            text: 'Allow',
            onPress: async () => {
              try {
                await saveVideoMlConsentChoice(true);
              } catch {
                setVideoMlTrainingConsent(true);
              }
              resolve(true);
            },
          },
        ],
      );
    });
  }, [isIndividualUser, saveVideoMlConsentChoice, videoMlTrainingConsent]);

  const pickSetVideo = useCallback(async (): Promise<SelectedSetVideo | null> => {
    const consentReady = await ensureVideoMlConsentChoice();
    if (!consentReady) return null;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow video library access to attach a clip.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (result.canceled) return null;

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('Video not selected', 'Video could not be selected.');
      return null;
    }

    const filename = asset.fileName || `set-video-${Date.now()}.mp4`;
    const mimeType = asset.mimeType || (filename.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
    const thumbnailUri = await createSetVideoThumbnail(asset.uri);
    return {
      uri: asset.uri,
      name: filename,
      mimeType,
      sizeBytes: asset.fileSize ?? null,
      videoAngle: 'unknown',
      thumbnailUri,
      submitForReview: !isIndividualUser,
    };
  }, [ensureVideoMlConsentChoice, isIndividualUser]);

  const uploadSelectedVideoToSetLog = useCallback(async (
    setLogId: number,
    selectedVideo: SelectedSetVideo,
    opts?: { refresh?: boolean },
  ) => {
    try {
      rememberScroll();
      const job = await enqueueVideoUpload({
        localFileUri: selectedVideo.uri,
        thumbnailUri: selectedVideo.thumbnailUri || null,
        setLogId,
        workoutId: dataRef.current?.workout?.id ?? null,
        filename: selectedVideo.name || 'set-video.mp4',
        mimeType: selectedVideo.mimeType || 'video/mp4',
        fileSizeBytes: selectedVideo.sizeBytes ?? null,
        videoAngle: selectedVideo.videoAngle || 'unknown',
        submitForReview: selectedVideo.submitForReview !== false,
        uploadIntent: videoUploadIntent(selectedVideo),
      });
      setVideoUploadBySetLogId((prev) => ({
        ...prev,
        [setLogId]: { queued: true, uploading: false, error: null, job },
      }));
      if (opts?.refresh !== false) {
        await fetchWorkout({ silent: true });
      }
      return job;
    } catch (err: any) {
      const message = videoUploadFailureMessage(err);
      setVideoUploadBySetLogId((prev) => ({
        ...prev,
        [setLogId]: { uploading: false, error: message },
      }));
      throw new Error(message);
    }
  }, [fetchWorkout]);

  const attachSelectedVideoToLoggedSet = useCallback(async (
    setLogId?: number | null,
    selectedVideo?: SelectedSetVideo | null,
  ): Promise<string | null> => {
    if (!selectedVideo) return null;
    if (!setLogId) return 'Set logged, but video upload failed: missing set id.';
    try {
      await uploadSelectedVideoToSetLog(setLogId, selectedVideo, { refresh: false });
      return null;
    } catch (err: any) {
      const message = videoUploadFailureMessage(err);
      setVideoUploadBySetLogId((prev) => ({
        ...prev,
        [setLogId]: { uploading: false, error: message },
      }));
      return `Set logged, but video upload failed: ${message}`;
    }
  }, [uploadSelectedVideoToSetLog]);

  const uploadVideoForSetLog = useCallback(async (setLog: SetLog) => {
    if (!setLog?.id) return;
    const currentUpload = videoUploadBySetLogId[setLog.id];
    if (currentUpload?.uploading || currentUpload?.queued) {
      return;
    }

    const selectedVideo = await pickSetVideo();
    if (!selectedVideo) return;

    setPendingRowVideoUpload({ setLogId: setLog.id, selectedVideo });
  }, [pickSetVideo, videoUploadBySetLogId]);

  const confirmPendingRowVideoUpload = useCallback(async () => {
    const pending = pendingRowVideoUpload;
    if (!pending) return;
    setPendingRowVideoUpload(null);
    try {
      setError(null);
      await uploadSelectedVideoToSetLog(pending.setLogId, pending.selectedVideo);
    } catch (err: any) {
      const message = videoUploadFailureMessage(err);
      setVideoUploadBySetLogId((prev) => ({
        ...prev,
        [pending.setLogId]: { uploading: false, error: message },
      }));
      setError(message);
    }
  }, [pendingRowVideoUpload, uploadSelectedVideoToSetLog]);

  const removeVideoForSetLog = useCallback(async (setLog: SetLog) => {
    const videoId = setLog.video_id || setLog.video?.id;
    if (!setLog?.id || !videoId) return;

    const deleteVideo = async () => {
      try {
        rememberScroll();
        setVideoUploadBySetLogId((prev) => ({
          ...prev,
          [setLog.id]: { uploading: false, deleting: true, error: null } as any,
        }));
        setError(null);

        const { ok, status, json } = await removeVideoAttachment(videoId);

        if (!ok || !json?.ok) {
          throw new Error(json?.error || `Video removal failed (HTTP ${status})`);
        }

        setVideoUploadBySetLogId((prev) => ({
          ...prev,
          [setLog.id]: { uploading: false, deleting: false, error: null } as any,
        }));
        await fetchWorkout({ silent: true });
      } catch (err: any) {
        const message = err?.message || 'Video removal failed';
        setVideoUploadBySetLogId((prev) => ({
          ...prev,
          [setLog.id]: { uploading: false, deleting: false, error: message } as any,
        }));
        setError(message);
      }
    };

    Alert.alert(
      'Remove video',
      'Remove this video from the set?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove video', style: 'destructive', onPress: deleteVideo },
      ],
    );
  }, [fetchWorkout]);

  const openSetVideoPlayer = useCallback((setLog: SetLog) => {
    const videoId = setLog.video_id || setLog.video?.id;
    if (!videoId) {
      Alert.alert('Video unavailable', 'This set does not have a playable video yet.');
      return;
    }
    setSetVideoPlayer({
      visible: true,
      videoId,
      initialUrl: setLog.video_url || setLog.video?.url || null,
      initialVideo: setLog.video || null,
    });
  }, []);

  const renderSetVideoAction = useCallback((setLog: SetLog, canAttachVideo: boolean) => {
    if (!setLog?.id) return null;
    const state = videoUploadBySetLogId[setLog.id] || {};
    const hasVideo = !!(setLog.has_video || setLog.video_id || setLog.video?.id);
    const queuedJob = state.job || null;
    const label = state.uploading
      ? 'Uploading video...'
      : state.uploaded && !hasVideo
      ? 'Video uploaded'
      : state.error
      ? state.permanent
        ? 'Upload failed'
        : 'Upload failed — retry'
      : state.queued
      ? 'Video queued'
      : videoStatusLabel(setLog, false, null);
    const disabled = !canAttachVideo || !!state.uploading || !!state.queued || !!(state as any).deleting;

    return (
      <View style={styles.setVideoRow}>
        {hasVideo ? (
          <TouchableOpacity
            style={styles.setVideoPreviewTile}
            onPress={() => openSetVideoPlayer(setLog)}
            activeOpacity={0.82}
          >
            <View style={styles.setVideoPlayBadge}>
              <Text style={styles.setVideoPlayText}>Play</Text>
            </View>
            <View style={styles.setVideoMeta}>
              <Text style={styles.setVideoTitle}>Video attached</Text>
              {setLog.video?.video_angle_label ? (
                <Text style={styles.setVideoAngleText}>{setLog.video.video_angle_label}</Text>
              ) : null}
              <Text
                style={[
                  styles.setVideoStatus,
                  styles.setVideoStatusAttached,
                  state.error && styles.setVideoStatusError,
                ]}
              >
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Text
            style={[
              styles.setVideoStatus,
              state.error && styles.setVideoStatusError,
            ]}
          >
            {label}
          </Text>
        )}
        {canAttachVideo ? (
          <View style={styles.setVideoActions}>
            <TouchableOpacity
              style={[
                styles.setVideoButton,
                disabled && styles.setVideoButtonDisabled,
              ]}
              onPress={() => uploadVideoForSetLog(setLog)}
              disabled={disabled}
            >
              {state.uploading ? (
                <ActivityIndicator size="small" color={SLColors.text} />
              ) : (
                <Text style={styles.setVideoButtonText}>{hasVideo ? 'Replace video' : 'Pick video'}</Text>
              )}
            </TouchableOpacity>
            {hasVideo ? (
              <TouchableOpacity
                style={[
                  styles.setVideoButton,
                  styles.setVideoRemoveButton,
                  disabled && styles.setVideoButtonDisabled,
                ]}
                onPress={() => removeVideoForSetLog(setLog)}
                disabled={disabled}
              >
                {(state as any).deleting ? (
                  <ActivityIndicator size="small" color={SLColors.danger} />
                ) : (
                  <Text style={[styles.setVideoButtonText, styles.setVideoRemoveButtonText]}>
                    Remove video
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
            {!hasVideo && queuedJob && state.error && !state.permanent ? (
              <TouchableOpacity
                style={styles.setVideoButton}
                onPress={() => retryVideoUploadJob(queuedJob.id)}
              >
                <Text style={styles.setVideoButtonText}>Retry upload</Text>
              </TouchableOpacity>
            ) : null}
            {!hasVideo && queuedJob && !state.uploading ? (
              <TouchableOpacity
                style={[styles.setVideoButton, styles.setVideoRemoveButton]}
                onPress={() => cancelVideoUploadJob(queuedJob.id)}
              >
                <Text style={[styles.setVideoButtonText, styles.setVideoRemoveButtonText]}>
                  Remove pending
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }, [openSetVideoPlayer, removeVideoForSetLog, uploadVideoForSetLog, videoUploadBySetLogId]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    const workout = data?.workout;
    if (!workout) return;

    const orderedMovements = getOrderedWorkoutMovements(workout);
    if (!orderedMovements.length) return;

    if (autoExpandWorkoutIdRef.current !== workout.id) {
      autoExpandWorkoutIdRef.current = workout.id;
      manualMovementSelectionRef.current = false;
      pendingAutoAdvanceRef.current = null;
    }

    if (workout.status !== 'in_progress') return;

    const firstIncomplete = orderedMovements.find((row) => row.total > 0 && !row.complete);
    const pendingAdvance = pendingAutoAdvanceRef.current;

    if (pendingAdvance) {
      pendingAutoAdvanceRef.current = null;
      const fromIndex = orderedMovements.findIndex((row) => row.key === pendingAdvance.fromKey);
      const fromRow = fromIndex >= 0 ? orderedMovements[fromIndex] : null;
      const nextRow = fromIndex >= 0
        ? orderedMovements.find(
            (row, index) =>
              row.total > 0 &&
              !row.complete &&
              index > fromIndex,
          )
        : firstIncomplete;

      if (fromRow?.complete) {
        configureNextMovementLayoutTransition();
        collapseMovementCard(fromRow.key);
        if (nextRow?.key && nextRow.key !== fromRow.key) {
          openMovementCard(nextRow.key);
          scheduleMovementFocus(nextRow.key);
        }
      } else if (fromRow?.key) {
        openMovementCard(fromRow.key);
      } else if (!manualMovementSelectionRef.current && firstIncomplete?.key) {
        openMovementCard(firstIncomplete.key);
      }
      return;
    }

    if (!manualMovementSelectionRef.current && firstIncomplete?.key) {
      const anyCoreExpanded = Object.values(expandedCoreDetails).some(Boolean);
      const anyAccessoryExpanded = Object.values(expandedCompletedMovements).some(Boolean);
      if (!anyCoreExpanded && !anyAccessoryExpanded) {
        openMovementCard(firstIncomplete.key);
      }
    }
  }, [
    data?.workout,
    getOrderedWorkoutMovements,
    collapseMovementCard,
    configureNextMovementLayoutTransition,
    openMovementCard,
    scheduleMovementFocus,
    expandedCoreDetails,
    expandedCompletedMovements,
  ]);

  useEffect(() => {
    workoutRequestManagerRef.current.cancel();
    loggerRecoveryGateRef.current.reset();
    hasFocusedLoggerRef.current = false;
    dataRef.current = null;
    setData(null);
    setError(null);
    setLoading(true);
    setRefreshing(false);
    setAcceptedSetEvidenceItemIds(new Set());
    setCoreWheel(null);
    setAccessoryWheel(null);
    setSupersetRoundLogger(null);
    setExpandedCompletedMovements({});
    setExpandedCoreDetails({});
    scrollYRef.current = 0;
    scrollViewportHeightRef.current = 0;
    scrollContentHeightRef.current = 0;
    setBodyRecoveryFailed(false);
  }, [workoutId]);

  useEffect(() => {
    const requestManager = workoutRequestManagerRef.current;
    void fetchWorkout();
    return () => requestManager.cancel();
  }, [fetchWorkout]);

  const onRefresh = useCallback(async () => {
    await fetchWorkout({ silent: true });
  }, [fetchWorkout]);

  useEffect(() => {
    screenMountedRef.current = true;
    const acceptedSheetHandoffController = acceptedSheetHandoffControllerRef.current;
    const canonicalSetSubmissionController = canonicalSetSubmissionControllerRef.current;
    const processedSetResults = processedSetResultsRef.current;
    const timerHandoffReleaseController = timerHandoffReleaseControllerRef.current;
    return () => {
      screenMountedRef.current = false;
      if (bodyRecoveryTimerRef.current) clearTimeout(bodyRecoveryTimerRef.current);
      // Do not cancel the active rest completion notification here. The global
      // serializable timer owns it after the Logger unmounts.
      if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
      canonicalSetSubmissionController.reset();
      processedSetResults.reset();
      acceptedSheetHandoffController.reset();
      timerHandoffReleaseController.reset();
      if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
      if (restFocusReturnTimerRef.current) clearTimeout(restFocusReturnTimerRef.current);
      if (restZeroAdvanceTimerRef.current) clearTimeout(restZeroAdvanceTimerRef.current);
      if (restReadyDismissTimerRef.current) clearTimeout(restReadyDismissTimerRef.current);
    };
  }, []);

  const loggerShellMode = loading && !data
    ? 'loading'
    : !data
      ? 'error'
      : deriveScreenMode(data.workout.status);
  const loggerHeaderShown = sessionLoggerSharedHeaderShown({
    mode: loggerShellMode,
    hasCompletedRecap: Boolean(data?.workout?.completed_recap),
  });

  if (loading && !data) {
    return (
      <>
        <Tabs.Screen options={{ headerShown: loggerHeaderShown }} />
        <View style={styles.center}>
          <ActivityIndicator />
          <ThemedText variant="bodyMuted" style={styles.muted}>
            Loading Training Session…
          </ThemedText>
        </View>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Tabs.Screen options={{ headerShown: loggerHeaderShown }} />
        <View style={styles.center}>
          <ThemedText variant="error" style={styles.errorText}>
            {error || 'Something went wrong'}
          </ThemedText>
        </View>
      </>
    );
  }

  const { workout, athlete } = data;
  const isCoachAthletePreview = coachPreviewRequested
    && data.view_mode === 'coach_preview'
    && data.permissions?.view_only === true;
  const canLogFromServer = !isCoachAthletePreview && !!data.permissions?.can_log;
  const canHotSwap = !isCoachAthletePreview && !!data.permissions?.can_hot_swap;
  const substitutionAuthority = resolveSubstitutionAuthority({
    serverAuthority: data.permissions?.substitution_authority,
    canHotSwap,
    permissionIsSelfCoached: data.permissions?.is_self_coached,
    accountIsSelfCoached: user?.is_self_coached,
    isCoachPreview: isCoachAthletePreview,
  });
  // Coach viewing an athlete Training Session in read-only mode.
  const isCoachView = isCoachAthletePreview || (!!data.permissions?.can_coach && !canLogFromServer);
  const canEdit =
    !isCoachAthletePreview &&
    (!!data.permissions?.can_coach || !!data.permissions?.is_self_coached) &&
    ['assigned', 'draft', 'tardy'].includes(String(workout.status || '').toLowerCase());
  const canLog = canLogFromServer && workout.status === 'in_progress';
  const canManageSetVideo = canLogFromServer && !isCoachView;
  const canBegin = canLogFromServer && ['assigned', 'tardy'].includes(String(workout.status || '').toLowerCase());
  const canCompleteOrCancel =
    canLogFromServer &&
    (workout.status === 'in_progress' || workout.status === 'completed');
  const screenMode = deriveScreenMode(workout.status);
  const isPreSession = screenMode === 'pre_session';
  const isActiveSession = screenMode === 'active_session';
  const isFinishedSession = screenMode === 'finished_session';
  const liveSessionDurationSeconds =
    isActiveSession
      ? deriveSessionElapsedSeconds(workout.started_at, sessionNowMs)
      : null;
  const sessionElapsedLabel = liveSessionDurationSeconds != null
    ? formatSessionElapsed(liveSessionDurationSeconds)
    : '0:00';
  const loggedSets = loggedSetCountForWorkout(workout);
  const plannedSets = plannedSetCountForWorkout(workout);
  const durationEstimate = durationEstimateForWorkout(workout);
  const coreMovementCount = workout.core_items.filter(
    (item) => !(isBackdownWorkoutItem(item) && item.parent_item_id != null),
  ).length;
  const accessoryMovementOrder = workout.accessory_groups.flatMap((group) => group.items);
  const progressPct = plannedSets ? Math.min(100, Math.round((loggedSets / plannedSets) * 100)) : 0;
  const focusLine = firstSessionFocus(workout);
  const sessionNoteAuthor = resolveSessionNoteAuthor({
    isSelfCoached: Boolean(isIndividualUser || data.permissions?.is_self_coached),
    coach: data.coach,
    athlete,
    selfUser: user,
  });
  const sessionNoteAuthorPreviewSource =
    isIdealWorkoutDetailPreview
    && sessionNoteAuthor.kind === 'coach'
    && data.coach?.avatar_fixture === 'coach-adrien'
      ? WORKOUT_DETAIL_COACH_AVATAR
      : undefined;
  const restTimerPromoted = shouldPromoteRestTimer(
    restActive,
    restSeconds,
    DEFAULT_REST_TIMER_CUE_CONFIG,
  );
  const restTimerFocusVisible =
    restTimerPromoted || restTimerZeroVisible || restTimerReadyVisible;
  const devAccessoryAccentFor = (iconName: SLAccessoryIconName | null) => {
    switch (iconName) {
      case 'dumbbell-press':
      case 'dumbbell-row':
      case 'lateral-raise':
        return SLColors.accentMagenta;
      case 'machine-chest-press':
      case 'leg-extension':
      case 'leg-curl':
      case 'pec-deck':
        return SLColors.accentOrange;
      case 'cable-row':
      case 'pulldown':
        return SLColors.info;
      default:
        return SLColors.accentViolet;
    }
  };
  const movementVisualContextFor = (
    item: WorkoutItem,
    prescribedWeight?: ResolvedLoggerPrescribedWeight | null,
  ): ActiveMovementVisualContext => {
    const accessoryFixtureContext = isIdealWorkoutDetailPreview
      ? (item as any).dev_accessory_intelligence
      : null;
    const isAccessory =
      String(item.variant || '').trim().toUpperCase() === 'ACC';
    const accessoryIconName = isAccessory ? resolveAccessoryIconName(item.movement) : null;
    const resolvedIdentity = isAccessory
      ? {
          key: 'accessory' as const,
          label: 'Accessory',
          accentColor: devAccessoryAccentFor(accessoryIconName),
          iconSource: null,
        }
      : resolveLoggerLiftIdentity(item);
    const identity = resolvedIdentity;
    const resolvedPlateWeight = prescribedWeight === undefined
      ? resolveLoggerPrescribedWeight({ item, unit })
      : prescribedWeight;
    const plateStack = isAccessory
      ? null
      : resolveLoggerPlateStack(
          item,
          unit,
          resolvedPlateWeight,
        );
    const baseProgress = resolveLoggerProgressContext(item, unit);
    const progress = isAccessory && accessoryFixtureContext && baseProgress
      ? {
          ...baseProgress,
          eyebrow: String(accessoryFixtureContext.previous_label || baseProgress.eyebrow),
          primary: baseProgress.primary.replace(/^Last time:\s*/i, ''),
          accessibilityLabel: `${accessoryFixtureContext.previous_label || baseProgress.eyebrow}. ${baseProgress.accessibilityLabel}`,
        }
      : baseProgress;
    const coach = data.coach;
    return {
      movementArtworkInput: {
        ...item,
        kind: isAccessory
          ? 'accessory'
          : String(item.variant || '').trim().toUpperCase() === 'VR'
            ? 'variant'
            : 'core',
      },
      liftLabel: identity.label,
      liftAccentColor: identity.accentColor,
      plateStack,
      progress,
      coach: coach
        ? {
            name: String(coach.name || 'Coach'),
            profilePhotoUrl: coach.avatar_url || null,
            profilePhotoVersion: coach.avatar_uploaded_at || null,
            previewSource:
              isIdealWorkoutDetailPreview && coach.avatar_fixture === 'coach-adrien'
                ? WORKOUT_DETAIL_COACH_AVATAR
                : null,
          }
        : null,
    };
  };

  const handleEditWorkout = () => {
    if (isIdealWorkoutDetailPreview) return;
    router.push({
      pathname: '/workout/session-workspace/[workoutId]' as any,
      params: { workoutId: String(workout.id) },
    });
  };

  const handleReturnToCoachEditor = () => {
    router.replace({
      pathname: '/workout/session-workspace/[workoutId]' as any,
      params: {
        workoutId: String(workout.id),
        section: returnSection === 'accessories' ? 'accessories' : 'core',
        ...(coachAthleteId ? { athleteId: coachAthleteId } : {}),
        ...(coachProgrammingBlockId ? { programmingBlockId: coachProgrammingBlockId } : {}),
        ...(coachProgrammingWeek ? { programmingWeek: coachProgrammingWeek } : {}),
        ...(coachProgrammingDay ? { programmingDay: coachProgrammingDay } : {}),
      },
    });
  };

  const handleBackToTrainingHub = () => {
    if ((returnTo === 'training-hub' || returnTo === 'program-timeline') && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/workout' as any);
  };

  const handleCloseCompletedRecap = () => {
    if (isCoachAthletePreview) {
      handleReturnToCoachEditor();
      return;
    }
    if (freshCompletionSummaryIdRef.current) {
      router.replace('/(tabs)/workout' as any);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/workout' as any);
  };

  const handleBeginWorkoutPress = () => {
    if (hasReadinessForWorkout()) {
      beginWorkout();
    } else {
      openReadinessThenBegin(workout.id);
    }
  };

  const railForSets = (total: number, activeIndex: number, completedIndexes: number[]): SetRailStep[] =>
    Array.from({ length: total }).map((_, idx) => {
      const setIndex = idx + 1;
      return {
        key: String(setIndex),
        label: `Set ${setIndex}`,
        state: completedIndexes.includes(setIndex)
          ? 'completed'
          : setIndex === activeIndex && canLog
          ? 'active'
          : 'locked',
      };
    });

  const compactSchemeText = (item: WorkoutItem, fallbackSets?: number) => {
    const sets = item.sets || fallbackSets || 0;
    const reps = item.reps || item.reps_text || '—';
    const rpe = item.rpe_target != null ? ` @${formatWheelNumber(Number(item.rpe_target))}` : '';
    const pct =
      item.mode === 'PCT' && item.pct != null
        ? ` @${(item.pct * 100).toFixed(1)}%`
        : '';
    return `${sets}×${reps}${rpe || pct}`;
  };

  const makeMovementLoggerFocus = ({
    item,
    setIndex,
    total,
    completedIndexes,
    kind,
    targetLine,
    prescriptionLine,
    planned,
    previousLog,
    rail,
    currentSetLabel,
    progressionLabel,
    heroLoadLabel,
  }: {
    item: WorkoutItem;
    setIndex: number;
    total: number;
    completedIndexes: number[];
    kind: CoreWheelKind;
    targetLine: string | null;
    prescriptionLine: string | null;
    planned?: PlannedSet | null;
    previousLog?: SetLog | null;
    rail?: SetRailStep[];
    currentSetLabel?: string;
    progressionLabel?: string;
    heroLoadLabel?: string | null;
  }): MovementLoggerFocusModel => {
    const resolvedSetLabel = currentSetLabel || `Set ${setIndex}`;
    const positionLabel = kind === 'top'
      ? total > 1 ? `Top Set ${setIndex} of ${total}` : 'Top Set'
      : kind === 'bk'
      ? `Backdown Set ${setIndex} of ${total}`
      : `${resolvedSetLabel} of ${total}`;
    const repsValue = planned?.reps ?? item.reps;
    const repsText = repsValue != null
      ? `${formatWheelNumber(Number(repsValue))} reps`
      : item.reps_text?.trim()
      ? `${item.reps_text.trim()} reps`
      : null;
    const rpeValue = planned?.rpe_target ?? item.rpe_target;
    const effortText = rpeValue != null
      ? `${formatWheelNumber(Number(rpeValue))} RPE`
      : item.rir_target != null
      ? `${formatWheelNumber(Number(item.rir_target))} RIR`
      : null;

    const resolvedRail = rail || railForSets(total, setIndex, completedIndexes);
    return ({
    itemId: item.id,
    groupItemId: item.parent_item_id || item.id,
    movementName: liftDisplayName(item),
    designation: formatDesignation((item as any).designation) || null,
    liftType:
      kind === 'fc'
        ? 'Full Custom'
        : kind === 'top'
        ? 'Top Set'
        : kind === 'bk'
        ? 'Backdown'
        : 'Straight Sets',
    currentSetLabel: resolvedSetLabel,
    currentSetPositionLabel: positionLabel,
    currentSetRepsLabel: repsText,
    currentSetLoadLabel: heroLoadLabel ?? targetLine,
    currentSetEffortLabel: effortText,
    progressionLabel: progressionLabel || `${completedIndexes.length} / ${total} sets logged`,
    targetLine,
    prescriptionLine,
    recentContext: formatLookbackLine(getLookbackBest(item), unit, item),
    rail: resolvedRail,
    opportunity: finalAssignedSetOpportunity(liftDisplayName(item), resolvedRail),
    canLog,
    canRepeat: false,
    onLogSet: () => openCoreWheel({
      kind,
      item,
      setIndex,
      planned: planned || undefined,
      targetLine,
    }),
    onRepeatLast: undefined,
    onViewHistory: () => openCanonicalMovementHistory(item),
    });
  };

  const completedCoreSetSummary = (
    item: WorkoutItem,
    log: SetLog,
  ) => {
    const uploadState = videoUploadBySetLogId[log.id] || {};
    const hasVideo = !!(log.has_video || log.video_id || log.video?.id);
    const queuedJob = uploadState.job || null;
    const queuedStatus = queuedVideoStatusLabel(uploadState);
    const status = queuedStatus || videoStatusLabel(log, !!uploadState.uploading, uploadState.error || null);
    const canRetryUpload = !!queuedJob && !!uploadState.error && !uploadState.permanent;
    const disabled = !canManageSetVideo || !!uploadState.uploading || (!!uploadState.queued && !canRetryUpload) || !!(uploadState as any).deleting;

    return {
      setLogId: log.id,
      resultText: loggedSetText(log, unit, item),
      videoLabel: hasVideo
        ? 'View'
        : uploadState.uploading
        ? 'Uploading...'
        : canRetryUpload
        ? 'Retry upload'
        : uploadState.queued
        ? 'Queued'
        : 'Add video',
      videoStatus: status,
      videoDisabled: disabled,
      onEdit: canLog
        ? () =>
            openEditSet(item.id, log, {
              mode: 'rpe',
              movementName: liftDisplayName(item),
            })
        : undefined,
      onDelete: canLog ? () => confirmDeleteSet(item.id, log) : undefined,
      onVideo: hasVideo
        ? () => openSetVideoPlayer(log)
        : canRetryUpload
        ? () => retryVideoUploadJob(queuedJob.id)
        : canManageSetVideo
        ? () => uploadVideoForSetLog(log)
        : undefined,
      status,
    };
  };

  const buildCoreMovementPresentation = ({
    core,
    isStraightLike,
    isTop,
    isBackdown,
    isFullCustom,
    hasParent,
    backdownsForThisTop,
    logs,
    totalSets,
    latestLoggedIdx,
    nextIdx,
    topLogs,
    topTotalSets,
    topLatestLoggedIdx,
    topNextIdx,
    hasAllTopActual,
  }: any): {
    loggerFocus: MovementLoggerFocusModel | null;
    detailRows: ActiveMovementDetailRow[];
    renderWeight: ResolvedLoggerPrescribedWeight | null;
  } => {
    const detailRows: ActiveMovementDetailRow[] = [];
    let loggerFocus: MovementLoggerFocusModel | null = null;
    let renderWeight: ResolvedLoggerPrescribedWeight | null = null;

    const attachFocus = (
      focus: MovementLoggerFocusModel,
      prescribedWeight: ResolvedLoggerPrescribedWeight | null,
    ) => {
      if (!loggerFocus) {
        loggerFocus = focus;
        renderWeight = prescribedWeight;
      }
    };

    if (isFullCustom && Array.isArray(core.planned_sets) && core.planned_sets.length > 0) {
      const plannedSets = core.planned_sets.slice().sort((a, b) => (a.set_index || 0) - (b.set_index || 0));
      const fcLogs = core.set_logs || [];
      const fcTotal = plannedSets.length;
      const completedIndexes = fcLogs.map((log) => log.set_index || 0).filter(Boolean);
      const fcLatestLoggedIdx = completedIndexes.length ? Math.max(...completedIndexes) : 0;
      const fcNextIdx = Math.min(fcLatestLoggedIdx + 1, fcTotal) || 1;

      plannedSets.forEach((ps) => {
        const setIdx = ps.set_index || 0;
        const existing = fcLogs.find((sl) => (sl.set_index || 0) === setIdx);
        const wt = formatPlannedWeightLine(ps, unit);
        const targetLine = wt.primary || wt.suggested || null;
        const prescribedWeight = resolveLoggerPrescribedWeight({
          item: core,
          planned: ps,
          unit,
        });
        const prescriptionLine = formatPlannedSchemeLine(ps, core.mode).replace(/\s×\s/g, '×').replace(/ @ RPE /g, ' @');
        const previousLog = [...fcLogs]
          .filter((sl) => (sl.set_index || 0) < setIdx)
          .sort((a, b) => (b.set_index || 0) - (a.set_index || 0))[0] || null;
        const isNext = !existing && setIdx === fcNextIdx;

        if (isNext) {
          attachFocus(makeMovementLoggerFocus({
            item: core,
            setIndex: setIdx,
            total: fcTotal,
            completedIndexes,
            kind: 'fc',
            targetLine,
            prescriptionLine,
            planned: ps,
            previousLog,
            heroLoadLabel: prescribedWeight?.displayLabel,
          }), prescribedWeight);
        }

        detailRows.push({
          key: `fc-${core.id}-${setIdx}`,
          label: `Set ${setIdx}`,
          state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
          target: existing ? null : targetLine,
          prescription: prescriptionLine,
          ...(existing
            ? completedCoreSetSummary(core, existing)
            : {}),
          onLogSet: isNext && canLog
            ? () => openCoreWheel({
                kind: 'fc',
                item: core,
                setIndex: setIdx,
                planned: ps,
                targetLine,
              })
            : undefined,
        });
      });

      return { loggerFocus, detailRows, renderWeight };
    }

    if (isStraightLike && totalSets > 0) {
      const completedIndexes = logs.map((log) => log.set_index || 0).filter(Boolean);
      const prescribedWeight = resolveLoggerPrescribedWeight({
        item: core,
        unit,
      });
      Array.from({ length: totalSets }).forEach((_, idx) => {
        const setIdx = idx + 1;
        const existing = logs.find((sl) => sl.set_index === setIdx);
        const previousLog = [...logs]
          .filter((sl) => (sl.set_index || 0) < setIdx)
          .sort((a, b) => (b.set_index || 0) - (a.set_index || 0))[0] || null;
        const isNext = !existing && setIdx === nextIdx;
        const targetLine = formatTargetRange(core.target_low_kg, core.target_high_kg, unit);
        const prescriptionLine = compactSchemeText(core, totalSets);

        if (isNext) {
          attachFocus(makeMovementLoggerFocus({
            item: core,
            setIndex: setIdx,
            total: totalSets,
            completedIndexes,
            kind: 'straight',
            targetLine,
            prescriptionLine,
            previousLog,
            heroLoadLabel: prescribedWeight?.displayLabel,
          }), prescribedWeight);
        }

        detailRows.push({
          key: `straight-${core.id}-${setIdx}`,
          label: `Set ${setIdx}`,
          state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
          target: existing ? null : targetLine,
          prescription: prescriptionLine,
          ...(existing
            ? completedCoreSetSummary(core, existing)
            : {}),
          onLogSet: isNext && canLog
            ? () => openCoreWheel({
                kind: 'straight',
                item: core,
                setIndex: setIdx,
                targetLine,
              })
            : undefined,
        });
      });

      return { loggerFocus, detailRows, renderWeight };
    }

    if (isTop && totalSets > 0) {
      const completedIndexes = uniqueLoggedSetIndexes(topLogs);
      const topPrescribedWeight = resolveLoggerPrescribedWeight({
        item: core,
        unit,
      });
      const topBackdownTotal = backdownsForThisTop.reduce((sum, bd) => sum + positiveInt(bd.sets), 0);
      const fullTopBackdownTotal = totalSets + topBackdownTotal;
      const topBackdownLoggedCount =
        loggedSetIndexCount(topLogs) +
        backdownsForThisTop.reduce((sum, bd) => sum + loggedSetIndexCount(bd.set_logs || []), 0);
        const topBackdownProgressLabel = `${topBackdownLoggedCount}/${fullTopBackdownTotal || totalSets}`;
      const topRailSteps = Array.from({ length: totalSets }).map((_, idx) => {
        const setIdx = idx + 1;
        const existing = topLogs.find((sl) => sl.set_index === setIdx);
        const isNextTop = !existing && setIdx === topNextIdx && !hasAllTopActual;
        return {
          key: `top-rail-${core.id}-${setIdx}`,
          label: totalSets > 1 ? `Top Set ${setIdx}` : 'Top Set',
          state: existing ? 'completed' : isNextTop && canLog ? 'active' : 'locked',
        } as SetRailStep;
      });
      const backdownRailSteps = backdownsForThisTop.flatMap((bd, bdIndex) => {
        const bdLogs = bd.set_logs || [];
        const bdTotal = positiveInt(bd.sets);
        const bdNextIdx = nextMissingSetIndex(bdLogs, bdTotal) || (loggedSetIndexCount(bdLogs) + 1);
        const backdownOffset = backdownsForThisTop
          .slice(0, bdIndex)
          .reduce((sum, item) => sum + positiveInt(item.sets), 0);
        return Array.from({ length: bdTotal }).map((_, idx) => {
          const setIdx = idx + 1;
          const timelineSetIndex = backdownOffset + setIdx;
          const existing = bdLogs.find((sl) => sl.set_index === setIdx);
          const isNextBackdown = hasAllTopActual && !existing && setIdx === bdNextIdx;
          return {
            key: `bd-rail-${bd.id}-${setIdx}`,
            label: `Backdown Set ${timelineSetIndex}`,
            state: existing ? 'completed' : isNextBackdown && canLog ? 'active' : 'locked',
          } as SetRailStep;
        });
      });
      const topBackdownRail = [...topRailSteps, ...backdownRailSteps];

      Array.from({ length: totalSets }).forEach((_, idx) => {
        const setIdx = idx + 1;
        const existing = logs.find((sl) => sl.set_index === setIdx);
        const previousLog = [...logs]
          .filter((sl) => (sl.set_index || 0) < setIdx)
          .sort((a, b) => (b.set_index || 0) - (a.set_index || 0))[0] || null;
        const isNext = !existing && setIdx === topNextIdx && !hasAllTopActual;
        const targetLine = formatTargetRange(core.target_low_kg, core.target_high_kg, unit);
        const prescriptionLine = compactSchemeText(core, totalSets);

        if (isNext) {
          attachFocus(makeMovementLoggerFocus({
            item: core,
            setIndex: setIdx,
            total: totalSets,
            completedIndexes,
            kind: 'top',
            targetLine,
            prescriptionLine,
            previousLog,
            rail: topBackdownRail,
            currentSetLabel: totalSets > 1 ? `Top Set ${setIdx}` : 'Top Set',
            progressionLabel: topBackdownProgressLabel,
            heroLoadLabel: topPrescribedWeight?.displayLabel,
          }), topPrescribedWeight);
        }

        detailRows.push({
          key: `top-${core.id}-${setIdx}`,
          label: totalSets > 1 ? `Top Set ${setIdx}` : 'Top Set',
          timelineLabel: coreSetTimelineLabel('top', setIdx, totalSets),
          state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
          target: existing ? null : targetLine,
          prescription: prescriptionLine,
          ...(existing
              ? completedCoreSetSummary(
                  core,
                  existing,
                )
            : {}),
          onLogSet: isNext && canLog
            ? () => openCoreWheel({
                kind: 'top',
                item: core,
                setIndex: setIdx,
                targetLine,
              })
            : undefined,
        });
      });

      backdownsForThisTop.forEach((bd, bdIndex) => {
        const bdLogs = bd.set_logs || [];
        const bdTotal = positiveInt(bd.sets);
        const bdNextIdx = nextMissingSetIndex(bdLogs, bdTotal) || (loggedSetIndexCount(bdLogs) + 1);
        const bdCompletedIndexes = uniqueLoggedSetIndexes(bdLogs);
        const backdownOffset = backdownsForThisTop
          .slice(0, bdIndex)
          .reduce((sum, item) => sum + positiveInt(item.sets), 0);
        const targetLine = formatTargetRange(bd.target_low_kg, bd.target_high_kg, unit);
        const backdownPrescribedWeight = resolveLoggerPrescribedWeight({
          item: bd,
          unit,
        });
        const prescriptionLine = compactSchemeText(bd, bdTotal);

        Array.from({ length: bdTotal }).forEach((_, idx) => {
          const setIdx = idx + 1;
          const timelineSetIndex = backdownOffset + setIdx;
          const existing = bdLogs.find((sl) => sl.set_index === setIdx);
          const previousLog = [...bdLogs]
            .filter((sl) => (sl.set_index || 0) < setIdx)
            .sort((a, b) => (b.set_index || 0) - (a.set_index || 0))[0] || null;
          const isNext = hasAllTopActual && !existing && setIdx === bdNextIdx;

          if (isNext) {
            attachFocus(makeMovementLoggerFocus({
              item: bd,
              setIndex: setIdx,
              total: bdTotal,
              completedIndexes: bdCompletedIndexes,
              kind: 'bk',
              targetLine,
              prescriptionLine,
              previousLog,
              rail: topBackdownRail,
              currentSetLabel: `Backdown Set ${setIdx}`,
              progressionLabel: topBackdownProgressLabel,
              heroLoadLabel: backdownPrescribedWeight?.displayLabel,
            }), backdownPrescribedWeight);
          }

          detailRows.push({
            key: `bk-${bd.id}-${setIdx}`,
            label: `Backdown Set ${timelineSetIndex}`,
            timelineLabel: coreSetTimelineLabel(
              'backdown',
              timelineSetIndex,
              topBackdownTotal,
            ),
            state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
            target: existing ? null : targetLine,
            prescription: prescriptionLine,
            ...(existing
                ? completedCoreSetSummary(
                    bd,
                    existing,
                )
              : {}),
            onLogSet: isNext && canLog
              ? () => openCoreWheel({
                  kind: 'bk',
                  item: bd,
                  setIndex: setIdx,
                  targetLine,
                })
              : undefined,
          });
        });
      });

      return { loggerFocus, detailRows, renderWeight };
    }

    if (isBackdown && !hasParent && totalSets > 0) {
      const completedIndexes = uniqueLoggedSetIndexes(logs);
      const prescribedWeight = resolveLoggerPrescribedWeight({
        item: core,
        unit,
      });
      Array.from({ length: totalSets }).forEach((_, idx) => {
        const setIdx = idx + 1;
        const existing = logs.find((sl) => sl.set_index === setIdx);
        const previousLog = [...logs]
          .filter((sl) => (sl.set_index || 0) < setIdx)
          .sort((a, b) => (b.set_index || 0) - (a.set_index || 0))[0] || null;
        const fallbackNextIdx = nextMissingSetIndex(logs, totalSets) || nextIdx;
        const isNext = !existing && setIdx === fallbackNextIdx;
        const targetLine = formatTargetRange(core.target_low_kg, core.target_high_kg, unit);
        const prescriptionLine = compactSchemeText(core, totalSets);

        if (isNext) {
          attachFocus(makeMovementLoggerFocus({
            item: core,
            setIndex: setIdx,
            total: totalSets,
            completedIndexes,
            kind: 'bk',
            targetLine,
            prescriptionLine,
            previousLog,
            heroLoadLabel: prescribedWeight?.displayLabel,
          }), prescribedWeight);
        }

        detailRows.push({
          key: `orphan-bk-${core.id}-${setIdx}`,
          label: `Backdown Set ${setIdx}`,
          timelineLabel: coreSetTimelineLabel('backdown', setIdx, totalSets),
          state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
          target: existing ? null : targetLine,
          prescription: prescriptionLine,
          ...(existing
            ? completedCoreSetSummary(
                core,
                existing,
              )
            : {}),
          onLogSet: isNext && canLog
            ? () => openCoreWheel({
                kind: 'bk',
                item: core,
                setIndex: setIdx,
                targetLine,
              })
            : undefined,
        });
      });
    }

    return { loggerFocus, detailRows, renderWeight };
  };

  const completedAccessorySetSummary = (
    item: WorkoutItem,
    log: SetLog,
  ) => {
    const uploadState = videoUploadBySetLogId[log.id] || {};
    const hasVideo = !!(log.has_video || log.video_id || log.video?.id);
    const queuedJob = uploadState.job || null;
    const queuedStatus = queuedVideoStatusLabel(uploadState);
    const status = queuedStatus || videoStatusLabel(log, !!uploadState.uploading, uploadState.error || null);
    const canRetryUpload = !!queuedJob && !!uploadState.error && !uploadState.permanent;
    const disabled = !canManageSetVideo || !!uploadState.uploading || (!!uploadState.queued && !canRetryUpload) || !!(uploadState as any).deleting;

    return {
      setLogId: log.id,
      resultText: loggedSetText(log, unit, item),
      videoLabel: hasVideo
        ? 'View'
        : uploadState.uploading
        ? 'Uploading...'
        : canRetryUpload
        ? 'Retry upload'
        : uploadState.queued
        ? 'Queued'
        : 'Add video',
      videoStatus: status,
      videoDisabled: disabled,
      onEdit: canLog
        ? () =>
            openEditSet(item.id, log, {
              mode: 'rir',
              movementName: simplifyMobileMovementName(item.movement || item.lift || 'Accessory'),
            })
        : undefined,
      onDelete: canLog ? () => confirmDeleteSet(item.id, log) : undefined,
      onVideo: hasVideo
        ? () => openSetVideoPlayer(log)
        : canRetryUpload
        ? () => retryVideoUploadJob(queuedJob.id)
        : canManageSetVideo
        ? () => uploadVideoForSetLog(log)
        : undefined,
    };
  };

  const accessoryLookbackLine = (item: WorkoutItem) => {
    const line = formatLookbackLine(getLookbackBest(item), unit, item);
    const devContext = isIdealWorkoutDetailPreview
      ? (item as any).dev_accessory_intelligence
      : null;
    const label = String(devContext?.previous_label || '').trim();
    const emptyLabel = String(devContext?.history_empty_label || '').trim();
    if (line && label) return line.replace(/^Last best:/, `${label}:`);
    return line || emptyLabel || null;
  };

  const supersetWorkspaceItems = (
    items: WorkoutItem[],
  ): SupersetWorkspaceItem[] => items.map((item) => ({
    ...item,
    title: simplifyMobileMovementName(item.movement) || 'Accessory',
    timelineLabel: simplifyMobileMovementName(item.movement) || 'Accessory',
    prescription: accessoryTargetLine(item),
    historyLine: accessoryLookbackLine(item),
    primaryMuscleRegion: accessoryMuscleRegion(item).key,
    set_logs: (item.set_logs || []).map((log) => ({
      ...log,
      resultLine: loggedSetText(log, unit, item),
    })),
  }));

  const buildAccessoryMovementPresentation = ({
    item,
    logs,
    totalSets,
    latestLoggedIdx,
    nextIndex,
    expanded,
    isComplete,
  }: {
    item: WorkoutItem;
    logs: SetLog[];
    totalSets: number;
    latestLoggedIdx: number;
    nextIndex: number;
    expanded: boolean;
    isComplete: boolean;
  }): { loggerFocus: MovementLoggerFocusModel | null; detailRows: ActiveMovementDetailRow[] } => {
    item = accessoryExecutionItem(item);
    const completedIndexes = logs.map((log) => log.set_index || 0).filter(Boolean);
    const rowCount = Math.max(totalSets, ...logs.map((log) => Number(log.set_index || 0)), 0);
    const detailRows: ActiveMovementDetailRow[] = Array.from({ length: rowCount }).map((_, offset) => {
      const setIndex = offset + 1;
      const log = logs.find((candidate) => Number(candidate.set_index || 0) === setIndex);
      const isNext = !log && setIndex === nextIndex;
      return {
        key: `acc-${item.id}-${setIndex}`,
        label: `Set ${setIndex}`,
        state: log ? 'completed' : isNext && canLog ? 'active' : 'locked',
        target: log ? null : accessoryPerSetPrescription(item),
        prescription: null,
        ...(log
          ? completedAccessorySetSummary(
              item,
              log,
            )
          : {}),
        onLogSet: isNext && canLog && !isCoachView ? () => openAccessoryWheel(item) : undefined,
      };
    });

    const canLogNext = expanded && !isComplete && canLog && !isCoachView;
    const shouldShowPlannedFocus =
      expanded && !isComplete && (isPreSession || canLogNext);
    const loggerFocus: MovementLoggerFocusModel | null = shouldShowPlannedFocus
      ? {
          itemId: item.id,
          groupItemId: item.id,
          movementName: simplifyMobileMovementName(item.movement) || 'Accessory',
          designation: 'Accessory',
          liftType: 'Support Work',
          currentSetLabel: `Set ${nextIndex}`,
          currentSetPositionLabel: `Set ${nextIndex} of ${totalSets}`,
          currentSetRepsLabel: accessoryPerSetRepsLabel(item),
          currentSetLoadLabel: null,
          currentSetHistoryPlaceholder: false,
          currentSetEffortLabel: item.rir_target != null ? `${formatWheelNumber(Number(item.rir_target))} RIR` : null,
          progressionLabel: `${logs.length} / ${totalSets || 0} sets logged`,
          targetLine: `${totalSets} sets`,
          prescriptionLine: accessoryLookbackLine(item),
          recentContext: accessoryLookbackLine(item),
          rail: railForSets(totalSets, nextIndex, completedIndexes),
          canLog: canLogNext,
          canRepeat: false,
          onLogSet: canLogNext ? () => openAccessoryWheel(item) : undefined,
          onRepeatLast: undefined,
          onViewHistory: () => openCanonicalMovementHistory(item),
          accessoryPresentation: true,
        }
      : null;

    return { loggerFocus, detailRows };
  };

  const renderAccessoryMovement = (it: WorkoutItem) => {
    const executionItem = accessoryExecutionItem(it);
    const logs = it.set_logs || [];
    const latestLoggedIdx =
      logs.length > 0
        ? Math.max(...logs.map((l) => l.set_index || 0))
        : 0;
    const totalSets = positiveInt(executionItem.sets);
    const loggedCount = logs.length;
    const nextIndex = loggedCount + 1;
    const accessoryDetailKey = `acc:${it.id}`;
    const accessoryIsComplete = totalSets > 0 && loggedCount >= totalSets;
    const accessoryIsExpanded = !!expandedCompletedMovements[accessoryDetailKey];
    const accessorySummary = completedSetSummary(logs, totalSets, unit, 'rir');
    const accessoryState = accessoryIsComplete ? 'complete' : loggedCount > 0 ? 'logged' : 'not_started';
    const lookbackLine = accessoryLookbackLine(it);
    const movementPresentation = buildAccessoryMovementPresentation({
      item: executionItem,
      logs,
      totalSets,
      latestLoggedIdx,
      nextIndex,
      expanded: accessoryIsExpanded,
      isComplete: accessoryIsComplete,
    });
    const swapLabel = accessorySwapActionForItem({
      substitutionAuthority,
      hasApprovedSubstitutions: Array.isArray(it.approved_subs) && it.approved_subs.length > 0,
      isCoachPreview: isCoachAthletePreview,
      sessionLifecycle: screenMode,
      targetItemHasSetLogs: itemHasPersistedSetLogs(it),
      acceptedPersistedSetLogForItem: acceptedSetEvidenceItemIds.has(Number(it.id)),
    });
    const machineAccessory = isMachineAccessoryItem(it);
    const fixtureAccessoryKind = String(
      (it as any).dev_accessory_intelligence?.kind || '',
    ).trim();
    const normalizedAccessoryName = String(it.movement || '').toLowerCase();
    const accessoryKind = machineAccessory
      ? 'machine'
      : fixtureAccessoryKind
        || (normalizedAccessoryName.includes('cable')
          ? 'cable'
          : normalizedAccessoryName.includes('weighted')
            ? 'weighted_bodyweight'
            : normalizedAccessoryName.includes('assisted')
              ? 'assisted_bodyweight'
              : /(pull-?up|chin-?up|dip|push-?up)/.test(normalizedAccessoryName)
                ? 'bodyweight'
                : 'portable');
    const currentEquipment = activeEquipmentIdentity(it) as GeneralMovementIdentity | null;
    const currentManufacturer = currentEquipment?.manufacturer?.display_name
      || (currentEquipment?.equipment_context?.option_kind === 'other'
        ? 'Other'
        : currentEquipment?.material_parameters?.custom_manufacturer_name)
      || null;
    const currentEquipmentName = currentManufacturer || 'Other';
    const currentEquipmentVariant = currentEquipment?.equipment_type || null;
    const currentEquipmentVariantLabel = currentEquipmentVariant
      ? equipmentPresentationLabel(currentEquipmentVariant, 'Machine')
      : null;
    const accessoryVariantLabel = accessoryKind === 'machine'
      ? currentEquipment
        ? `${currentManufacturer || 'Custom equipment'} · current equipment`
        : 'Equipment required before logging'
      : accessoryKind === 'portable'
        ? 'Portable identity · no equipment step'
        : accessoryKind === 'cable'
          ? 'Common cable identity'
          : accessoryKind === 'bodyweight'
            ? 'Bodyweight · no equipment step'
            : accessoryKind === 'weighted_bodyweight'
              ? 'Weighted bodyweight'
              : accessoryKind === 'assisted_bodyweight'
                ? 'Assisted bodyweight'
                : accessoryKind === 'timed'
                  ? 'Timed work'
                  : accessoryKind === 'carry'
                    ? 'Distance + load'
                  : accessoryKind === 'custom'
                    ? 'Custom equipment · unresolved'
                    : 'Accessory';

    return (
      <View
        key={it.id}
        ref={registerMovementCardRef(accessoryDetailKey)}
        collapsable={false}
      >
        <CoreMovementLedgerRow
          state={accessoryState}
          title={accessoryExecutionName(it)}
          designation="Accessory"
          variantLabel={accessoryVariantLabel}
          scheme={accessoryTargetLine(executionItem)}
          headerPrescription={accessoryTargetLine(executionItem)}
          loggerFocus={
            (isPreSession || isActiveSession) && accessoryIsExpanded
              ? movementPresentation.loggerFocus
              : null
          }
          expanded={accessoryIsExpanded}
          detailRows={accessoryIsExpanded ? movementPresentation.detailRows : undefined}
          expandedIdentityContext={accessoryIsExpanded && machineAccessory ? (
            <View style={[
              styles.currentEquipmentContext,
              !currentEquipment && styles.currentEquipmentContextRequired,
            ]}>
              <ManufacturerBrandMark
                compact
                manufacturerName={currentManufacturer}
              />
              <View style={styles.currentEquipmentCopy}>
                <Text style={styles.currentEquipmentEyebrow}>
                  {currentEquipment ? 'CURRENT EQUIPMENT' : 'EQUIPMENT NEEDED'}
                </Text>
                <Text numberOfLines={2} style={styles.currentEquipmentName}>
                  {currentEquipment ? currentEquipmentName : 'Choose the machine you are using'}
                </Text>
                <Text numberOfLines={2} style={styles.currentEquipmentMeta}>
                  {currentEquipment
                    ? [currentManufacturer || 'Other', currentEquipmentVariantLabel]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Manufacturer and type keep machine history comparable.'}
                </Text>
              </View>
            </View>
          ) : null}
          meta={accessoryIsComplete ? accessorySummary.meta : `${loggedCount}/${totalSets || 0} sets logged`}
          top={accessoryIsComplete ? accessorySummary.top : lookbackLine}
          movementNote={it.notes}
          visualContext={movementVisualContextFor(it)}
          submissionStatus={feedbackState.submission.status}
          submissionItemId={feedbackState.submission.activeItemId}
          reduceMotion={reduceMotion}
          completedSetSwipeTooltipSetLogId={completedSetSwipeTooltipSetLogId}
          onCompletedSetSwipeTooltipStarted={handleCompletedSetSwipeTooltipStarted}
          sessionIndex={
            coreMovementCount +
            accessoryMovementOrder.findIndex((item) => item.id === it.id) +
            1
          }
          sessionLifecycle={screenMode}
          auxAction={isCoachAthletePreview ? null : (
            <>
              {machineAccessory ? (
                <TouchableOpacity
                  style={styles.accessoryInlineAction}
                  onPress={() => openIdentityPicker(it)}
                >
                  <Ionicons name="barbell-outline" size={18} color={SLColors.textMuted} />
                  <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.accessoryInlineActionText}>Equipment</Text>
                </TouchableOpacity>
              ) : null}
              {swapLabel ? (
                <TouchableOpacity
                  style={styles.accessoryInlineAction}
                  onPress={() => openSwapAcc(it)}
                  disabled={savingItemId === it.id}
                >
                  <Text style={styles.accessoryInlineActionText}>{swapLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
          onOpen={() => toggleMovementCard(accessoryDetailKey)}
        />
      </View>
    );
  };

  const coreWheelSubmitAction = logSetActionPresentation(
    feedbackState.submission.status,
    coreWheel?.itemId != null && feedbackState.submission.activeItemId === coreWheel.itemId,
  );
  const coreWheelSubmitLabel = coreWheelSubmitAction.label;
  const accessoryWheelSubmitAction = logSetActionPresentation(
    feedbackState.submission.status,
    accessoryWheel?.itemId != null && feedbackState.submission.activeItemId === accessoryWheel.itemId,
  );
  const coreWheelItem = coreWheel
    ? data?.workout?.core_items.find((item) => item.id === coreWheel.itemId) || null
    : null;
  const coreWheelLastLog = lastLogForItem(coreWheelItem);
  const accessoryWheelItem = accessoryWheel
    ? data?.workout?.accessory_groups
        .flatMap((group) => group.items)
        .find((item) => item.id === accessoryWheel.itemId) || null
    : null;
  const accessoryWheelLastLog = lastLogForItem(accessoryWheelItem);
  const coreWheelRepeatPreview = coreWheelLastLog
    ? repeatSetPreview(coreWheelLastLog, {
        loadLabel: repeatLoadLabel(coreWheelItem, coreWheelLastLog, unit),
        effort: 'RPE',
      })
    : null;
  const accessoryWheelRepeatPreview = accessoryWheelLastLog
    ? repeatSetPreview(accessoryWheelLastLog, {
        loadLabel: repeatLoadLabel(accessoryWheelItem, accessoryWheelLastLog, unit),
        effort: 'RIR',
      })
    : null;
  const coreRepeatBusy = Boolean(
    pendingCoreWheelLog
    || (feedbackState.submission.status === 'submitting'
      && feedbackState.submission.activeItemId === coreWheel?.itemId),
  );
  const accessoryRepeatBusy = Boolean(
    pendingAccessoryLogItemId
    || (feedbackState.submission.status === 'submitting'
      && feedbackState.submission.activeItemId === accessoryWheel?.itemId),
  );

  const repeatLastIntoCoreWheel = () => {
    if (
      !coreWheel
      || !coreWheelLastLog
      || coreRepeatBusy
      || canonicalSetSubmissionControllerRef.current.isInFlight()
    ) return;
    const draft = coreRepeatDraft(coreWheelLastLog, toWheelWeight(coreWheelLastLog, unit));
    const repeatedWheel = {
      ...coreWheel,
      weight: nearestWheelValue(coreWheel.weightOptions, draft.weight, coreWheel.weight),
      reps: nearestWheelValue(coreWheel.repsOptions, draft.reps, coreWheel.reps),
      rpe: nearestWheelValue(coreWheel.rpeOptions, draft.rpe, coreWheel.rpe),
    };
    setCoreWheel(repeatedWheel);
    queueCoreWheelLog(repeatedWheel);
  };

  const repeatLastIntoAccessoryWheel = () => {
    if (
      !accessoryWheel
      || !accessoryWheelLastLog
      || accessoryRepeatBusy
      || canonicalSetSubmissionControllerRef.current.isInFlight()
    ) return;
    const draft = accessoryRepeatDraft(
      accessoryWheelLastLog,
      toWheelWeight(accessoryWheelLastLog, unit),
    );
    const repeatedWheel = {
      ...accessoryWheel,
      weight: nearestWheelValue(accessoryWheel.weightOptions, draft.weight, accessoryWheel.weight),
      reps: nearestWheelValue(accessoryWheel.repsOptions, draft.reps, accessoryWheel.reps),
      rir: nearestWheelValue(accessoryWheel.rirOptions, draft.rir, accessoryWheel.rir),
      selectedVideo: null,
    };
    setAccessoryWheel(repeatedWheel);
    queueAccessoryWheelLog(repeatedWheel);
  };

  if (isFinishedSession && workout.completed_recap) {
    const completionSummaryId = workout.impact_summary?.summary_id || null;
    const shouldShowCompletionCeremony = Boolean(
      completionSummaryId
      && workout.impact_summary?.canonically_completed
      && animatedCompletionSummaryId === completionSummaryId,
    );
    return (
      <>
        <Tabs.Screen options={{ headerShown: loggerHeaderShown }} />
        {shouldShowCompletionCeremony ? (
          <View
            style={[
              styles.completionCeremonyScreen,
              { paddingTop: insets.top, paddingBottom: insets.bottom },
            ]}
          >
            <SessionImpactPanel
              summary={workout.impact_summary}
              displayUnit={unit}
              reduceMotion={reduceMotion}
              animateEntry
              ceremonyOnly
              onCeremonyComplete={() => setAnimatedCompletionSummaryId((current) => current === completionSummaryId ? null : current)}
            />
          </View>
        ) : (
          <CompletedSessionRecap
            recap={workout.completed_recap}
            impactSummary={workout.impact_summary}
            preferredUnits={athlete.preferred_units}
            viewerMode={coachPreviewRequested ? 'coach' : 'athlete'}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onClose={handleCloseCompletedRecap}
            onDone={handleCloseCompletedRecap}
            onViewLedger={coachPreviewRequested ? undefined : () => router.push('/(tabs)/ledger' as any)}
            onViewCalendar={coachPreviewRequested
              ? () => router.push({ pathname: '/(tabs)/coach-calendar', params: { athleteId: String(athlete.id) } } as any)
              : () => router.push('/(tabs)/athlete-calendar' as any)}
            onOpenMovementHistory={(movement) => {
              const resolution = resolveMovementHistoryLaunchFromMeasurement({
                athleteId: athlete.id,
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
        )}
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <Tabs.Screen options={{ headerShown: loggerHeaderShown }} />
      <SessionCommandStrip
        restActive={restActive}
        restSeconds={restSeconds}
        restPromoted={restTimerFocusVisible}
        canLog={canLog}
        openTimerPicker={openTimerPicker}
        stopRestTimer={stopRestTimer}
        formatRestTime={formatRestTime}
        loggedSets={loggedSets}
        plannedSets={plannedSets}
        progressPct={progressPct}
        sessionElapsedLabel={sessionElapsedLabel}
        onRestTimerLayout={handleRestTimerLayout}
      />
      <RestTimerFocus
        visible={restTimerFocusVisible}
        ready={restTimerReadyVisible}
        seconds={restSeconds}
        reduceMotion={reduceMotion}
        headerOrigin={restTimerHeaderOrigin}
        onStop={stopRestTimer}
      />

      <SessionUnitFloatingControl
        unit={unit}
        bottom={insets.bottom + 74}
        onChange={switchDisplayUnit}
      />

      <LoggerFeedbackSurface
        saveConfirmationVisible={feedbackState.recognition.saveConfirmationVisible}
        statusMessage={setMutationNotice}
        event={feedbackState.recognition.currentEvent}
        secondaryHighlightCount={feedbackState.recognition.currentEvent?.secondary_highlight_count || 0}
        reduceMotion={reduceMotion}
        displayUnit={unit}
        onPresentationStarted={handleRecognitionPresentationStarted}
        onDismissEvent={dismissCurrentRecognition}
      />

      {/* Scrollable Training Session content */}
      <RefreshScreen
        key={`session-logger-body:${workout.id}:${bodyRenderGeneration}`}
        ref={scrollRef}
        style={styles.scrollShell}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{
          paddingBottom: SLLayout.tabBarClearance,
          flexGrow: 1,
        }}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(event) => {
          scrollViewportHeightRef.current = event.nativeEvent.layout.height;
          assessLoggerBodyHealth();
        }}
        onContentSizeChange={(_width, height) => {
          scrollContentHeightRef.current = height;
          assessLoggerBodyHealth();
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {isCoachAthletePreview ? (
          <View accessibilityRole="summary" style={styles.coachAthletePreviewBanner}>
            <View style={styles.coachAthletePreviewCopy}>
              <View style={styles.coachAthletePreviewTitleRow}>
                <Ionicons name="eye-outline" size={18} color={SLColors.success} />
                <Text style={styles.coachAthletePreviewTitle}>Athlete View</Text>
              </View>
              <Text style={styles.coachAthletePreviewBody}>
                Previewing {athlete.name}&apos;s Session. Logging and lifecycle actions are disabled.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to coach Session editor"
              onPress={handleReturnToCoachEditor}
              style={({ pressed }) => [
                styles.coachAthletePreviewBack,
                pressed && styles.coachAthletePreviewBackPressed,
              ]}
            >
              <Ionicons name="chevron-back" size={16} color={SLColors.textStrong} />
              <Text style={styles.coachAthletePreviewBackText}>Coach Editor</Text>
            </Pressable>
          </View>
        ) : null}
        {(!isFinishedSession || !workout.impact_summary?.canonically_completed) ? (
          <SessionIntentPanel
            workout={workout}
            screenMode={screenMode}
            statusLabel={prettyStatus(workout.status)}
            focusLine={focusLine}
            loggedSets={loggedSets}
            plannedSets={plannedSets}
            exerciseCount={
              workout.core_items.filter((item) => !(isBackdownWorkoutItem(item) && item.parent_item_id != null)).length +
              workout.accessory_groups.reduce((total, group) => total + group.items.length, 0)
            }
            durationEstimate={durationEstimate}
            canEdit={canEdit}
            onBackToTrainingHub={handleBackToTrainingHub}
            onEditWorkout={handleEditWorkout}
          />
        ) : null}
        {isFinishedSession && workout.impact_summary?.canonically_completed ? (
          <SessionImpactPanel
            summary={workout.impact_summary}
            displayUnit={unit}
            accomplishmentHistory={workout.accomplishment_history}
            reduceMotion={reduceMotion}
            animateEntry={animatedCompletionSummaryId === workout.impact_summary.summary_id}
          />
        ) : null}
        {isActiveSession && workoutId ? (
          <SessionHighlightsPanel
            events={workout.accomplishment_history?.items || []}
            workoutId={Number(workoutId)}
            displayUnit={unit}
            onOpen={(count) => feedbackAnalytics('session_highlights_opened', { count })}
          />
        ) : null}
        {!!(workout.programming_notes || '').trim() && (
          <View style={[
            styles.coachFeedbackCard,
            (isPreSession || isActiveSession) && styles.preSessionNotesCard,
            isActiveSession && styles.activeSessionNotesCard,
          ]}>
            <SLProfileAvatar
              accessibilityLabel={`${sessionNoteAuthor.name} session note author profile photo`}
              name={sessionNoteAuthor.name}
              previewSource={sessionNoteAuthorPreviewSource}
              profilePhotoUrl={sessionNoteAuthor.profilePhotoUrl}
              profilePhotoVersion={sessionNoteAuthor.profilePhotoVersion}
              size={36}
            />
            <View style={styles.preSessionNotesCopy}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.coachFeedbackEyebrow, (isPreSession || isActiveSession) && styles.preSessionNotesEyebrow]}>Session Notes</Text>
              <Text maxFontSizeMultiplier={1.35} style={styles.coachFeedbackText}>{workout.programming_notes}</Text>
            </View>
          </View>
        )}
        {isPreSession && canBegin ? (
          <View style={styles.preSessionPrimaryBeginAction}>
            <SessionBeginAction
              actionLoading={actionLoading}
              onBeginWorkout={handleBeginWorkoutPress}
            />
          </View>
        ) : null}
        {!!(workout.post_session_coach_feedback || '').trim() && (
          <PostSessionCoachFeedback
            authorKind={sessionNoteAuthor.kind}
            authorName={sessionNoteAuthor.name}
            feedback={workout.post_session_coach_feedback}
            previewSource={sessionNoteAuthorPreviewSource}
            profilePhotoUrl={sessionNoteAuthor.profilePhotoUrl}
            profilePhotoVersion={sessionNoteAuthor.profilePhotoVersion}
          />
        )}
        {/* Inline error banner (below header) */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity
              onPress={() => setError(null)}
              style={styles.errorBannerClose}
              accessibilityLabel="Dismiss error"
            >
              <Text style={styles.errorBannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <TardyReasonModal
          visible={tardyReasonVisible}
          tardyReason={tardyReason}
          setTardyReason={setTardyReason}
          onClose={() => setTardyReasonVisible(false)}
          onSubmit={submitTardyReason}
          styles={styles}
        />

        <Text style={styles.preSessionPlanTitle}>
          {isFinishedSession ? 'Completed Work' : 'Session Plan'}
        </Text>
        {/* Core lifts as peer movement ledger rows. */}
        <View style={[
          styles.sectionBlock,
          styles.canonicalMovementList,
        ]}>
          {workout.core_items.map((core, coreIndex) => {
            // ... keep the entire core_items.map block exactly as-is ...
            const isStraightLike = isStraightWorkoutItem(core);

            const isTop = isTopWorkoutItem(core);
            const isBackdown = isBackdownWorkoutItem(core);
            const hasParent = core.parent_item_id != null;

            const isFullCustom = isFullCustomWorkoutItem(core);

            // Skip BK rows that belong to a TOP – they’ll be rendered under the TOP card
            if (isBackdown && hasParent) {
              return null;
            }

            // BK children for this TOP item
            const backdownsForThisTop =
              isTop
                ? workout.core_items.filter(
                    (it) =>
                      isBackdownWorkoutItem(it) &&
                      numericId(it.parent_item_id) === numericId(core.id),
                  )
                : [];

            // Logging is allowed only when the server permits it and the Training Session is in progress.
            const canLog = canLogFromServer && workout.status === 'in_progress';

            // straight-style logs (STRAIGHT/VR items only)
            const logs = core.set_logs || [];
            const totalSets = positiveInt(core.sets);
            const latestLoggedIdx =
              logs.length > 0 ? Math.max(...logs.map((sl) => sl.set_index || 0)) : 0;
            const nextIdx = Math.min(latestLoggedIdx + 1, totalSets) || 1;

            // TOP items can have multiple prescribed sets. Keep hasTopActual for existing
            // backdown unlock logic, but also track per-set progress for TOP logging UI.
            const topLogs = isTop ? (logs || []) : [];
            const topTotalSets = isTop ? positiveInt(core.sets) : 0;
            const topLatestLoggedIdx =
              isTop && topLogs.length > 0
                ? Math.max(...topLogs.map((sl) => sl.set_index || 0))
                : 0;
            const topNextIdx = isTop
              ? (Math.min(topLatestLoggedIdx + 1, topTotalSets) || 1)
              : 1;

            const topSetLog = isTop
              ? (topLogs.find((sl) => sl.set_index === 1) || topLogs[0] || null)
              : null;

            const hasAllTopActual = isTop
              ? topTotalSets > 0 && topLatestLoggedIdx >= topTotalSets
              : false;
            const topBackdownLogs = backdownsForThisTop.flatMap((bd) => bd.set_logs || []);
            const topBackdownTotal = backdownsForThisTop.reduce((sum, bd) => sum + positiveInt(bd.sets), 0);
            const coreCompletionTotal = isFullCustom
              ? (Array.isArray(core.planned_sets) ? core.planned_sets.length : 0)
              : isTop
              ? topTotalSets + topBackdownTotal
              : totalSets;
            const coreCompletionLogs = isTop ? [...topLogs, ...topBackdownLogs] : logs;
            const coreCompletionLoggedCount = isTop
              ? loggedSetIndexCount(topLogs) +
                backdownsForThisTop.reduce((sum, bd) => sum + loggedSetIndexCount(bd.set_logs || []), 0)
              : loggedSetIndexCount(logs);
            const coreIsComplete = coreCompletionTotal > 0 && coreCompletionLoggedCount >= coreCompletionTotal;
            const coreSummary = completedSetSummary(coreCompletionLogs, coreCompletionTotal, unit, 'rpe');
            const variantLabel =
              isTop
                ? 'Top + Backdown'
                : isBackdown
                ? 'Backdown'
                : isFullCustom
                ? 'Full Custom'
                : 'Straight Sets';
            const topSchemeText = compactSchemeText(core, totalSets);
            const backdownSchemeText = (() => {
              if (!isTop || !backdownsForThisTop.length) return null;
              const totalBackdownSets = backdownsForThisTop.reduce((sum, bd) => sum + positiveInt(bd.sets), 0);
              const firstBackdown = backdownsForThisTop[0];
              return compactSchemeText(firstBackdown, totalBackdownSets);
            })();
            const schemeNode = !isTop && !isFullCustom ? (
              <>
                {compactSchemeText(core, totalSets)}
              </>
            ) : isTop ? (
              <>
                {topSchemeText}
                {backdownSchemeText ? (
                  <CoreSchemeDetail>
                    {' '}→ {backdownSchemeText}
                  </CoreSchemeDetail>
                ) : null}
              </>
            ) : (
              `${coreCompletionTotal || 0} planned sets`
            );
            const headerPrescription = !isTop && !isFullCustom
              ? compactSchemeText(core, totalSets)
              : isTop
              ? [topSchemeText, backdownSchemeText].filter(Boolean).join(' → ')
              : `${coreCompletionTotal || 0} planned sets`;
            const detailsKey = `core-detail:${core.id}`;
            const detailsExpanded = !!expandedCoreDetails[detailsKey];
            const hasAnyLogs = coreCompletionLoggedCount > 0;
            const presentationState = coreIsComplete
              ? 'complete'
              : hasAnyLogs
              ? 'logged'
              : 'not_started';
            const movementPresentation = buildCoreMovementPresentation({
              core,
              isStraightLike,
              isTop,
              isBackdown,
              isFullCustom,
              hasParent,
              backdownsForThisTop,
              logs,
              totalSets,
              latestLoggedIdx,
              nextIdx,
              topLogs,
              topTotalSets,
              topLatestLoggedIdx,
              topNextIdx,
              hasAllTopActual,
            });
            // P0 prescription integrity invariant:
            // Expanded athlete UI must render every prescribed API detail row,
            // even for completed sessions. Do not filter to logged/completed rows only.
            return (
              <View
                key={core.id}
                ref={registerMovementCardRef(`core:${core.id}`)}
                collapsable={false}
              >
                <CoreMovementLedgerRow
                  state={presentationState}
                  title={liftDisplayName(core)}
                  designation={formatDesignation((core as any).designation) || null}
                  variantLabel={variantLabel}
                  scheme={schemeNode}
                  headerPrescription={headerPrescription}
                  loggerFocus={
                    (isPreSession || isActiveSession) && detailsExpanded
                      ? movementPresentation.loggerFocus
                      : null
                  }
                  expanded={detailsExpanded}
                  detailRows={detailsExpanded ? movementPresentation.detailRows : undefined}
                  meta={coreIsComplete ? coreSummary.meta : `${coreCompletionLoggedCount}/${coreCompletionTotal || totalSets || 0} sets logged`}
                  top={coreIsComplete ? coreSummary.top : formatLookbackLine(getLookbackBest(core), unit, core)}
                  movementNote={core.notes}
                  visualContext={movementVisualContextFor(
                    core,
                    movementPresentation.renderWeight,
                  )}
                  submissionStatus={feedbackState.submission.status}
                  submissionItemId={feedbackState.submission.activeItemId}
                  reduceMotion={reduceMotion}
                  completedSetSwipeTooltipSetLogId={completedSetSwipeTooltipSetLogId}
                  onCompletedSetSwipeTooltipStarted={handleCompletedSetSwipeTooltipStarted}
                  onOpportunityDisplayed={(opportunity) => feedbackAnalytics('opportunity_context_displayed', {
                    type: opportunity.eyebrow,
                    item_id: movementPresentation.loggerFocus?.itemId || core.id,
                  })}
                  sessionIndex={coreIndex + 1}
                  sessionLifecycle={screenMode}
                  onOpen={() => toggleMovementCard(`core:${core.id}`)}
                />
              </View>
            );
          })}
        </View>

        {/* Accessories use the same peer movement logger model as core work. */}
        <View
          style={[
            styles.sectionBlock,
            styles.accessorySectionBlock,
            styles.canonicalMovementList,
          ]}
        >
          {workout.accessory_groups.map((grp, idx) => {
            const isSuperset = !!grp.group;

            if (isSuperset && grp.group) {
              const detailKey = `ss:${grp.group}`;
              const workspaceItems = supersetWorkspaceItems(grp.items);
              const roundModel = buildSupersetRoundModel(workspaceItems);
              return (
                <View
                  collapsable={false}
                  key={detailKey}
                  ref={registerMovementCardRef(detailKey)}
                >
                  <SupersetRoundWorkspace
                    canLog={canLog && !isCoachView}
                    executionHint={grp.dev_execution_hint || 'Alternate continuously'}
                    expanded={Boolean(expandedCompletedMovements[detailKey])}
                    groupLabel={grp.group}
                    model={roundModel}
                    onDeleteSet={(item, log) =>
                      confirmDeleteSet(item.id, log as SetLog)}
                    onEditSet={(item, log) =>
                      openEditSet(item.id, log as SetLog, {
                        mode: 'rir',
                        movementName: item.title,
                      })}
                    onLogMovement={(itemId) => {
                      const item = grp.items.find(
                        (candidate) => candidate.id === itemId,
                      );
                      if (item) openAccessoryWheel(item);
                    }}
                    onOpenHistory={(itemId) => {
                      const item = grp.items.find(
                        (candidate) => candidate.id === itemId,
                      );
                      if (item) setMovementHistoryItem(item);
                    }}
                    reduceMotion={reduceMotion}
                    onToggle={() => toggleMovementCard(detailKey)}
                  />
                </View>
              );
            }

            if (isSuperset) {
              return (
                <View
                  key={grp.group || `ss-${idx}`}
                  style={[
                    styles.supersetCard,
                    styles.supersetCardSecondary,
                    isPreSession && styles.movementCardPreSession,
                    isFinishedSession && styles.movementCardFinished,
                  ]}
                >
                  <View style={styles.supersetHeader}>
                    <Text style={styles.supersetBadge}>
                      Superset {grp.group}
                    </Text>
                  </View>
                  {grp.items.map((it) => renderAccessoryMovement(it))}
                </View>
              );
            }

            return grp.items.map((it) => renderAccessoryMovement(it));
          })}
        </View>
        {isPreSession && canBegin ? (
          <View style={styles.preSessionBottomBeginAction}>
            <SessionBeginAction
              actionLoading={actionLoading}
              onBeginWorkout={handleBeginWorkoutPress}
            />
          </View>
        ) : null}
        {/* Bottom-of-page actions: Complete / Cancel */}
        {canCompleteOrCancel && (
            <View style={[styles.actionBar, { marginTop: 16, marginBottom: 24 }]}>
              {workout.status === 'in_progress' && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionPrimary,
                    actionLoading === 'complete' && { opacity: 0.7 },
                  ]}
                  onPress={requestCompleteWorkout}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'complete' ? (
                    <ActivityIndicator size="small" color={SLColors.textInverted} />
                  ) : (
                    <Text
                      style={[
                        styles.actionButtonText,
                        styles.actionPrimaryText,
                      ]}
                    >
                      Complete Session
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  workout.status === 'completed'
                    ? styles.actionPrimary // Identical to Begin Session.
                    : styles.actionDanger,
                  actionLoading === 'cancel' && { opacity: 0.7 },
                ]}
                onPress={() => setCancelConfirmVisible(true)}
                disabled={!!actionLoading}
              >
                {actionLoading === 'cancel' ? (
                  <ActivityIndicator size="small" color={SLColors.danger} />
                ) : (
                  <Text
                    style={[
                      styles.actionButtonText,
                      workout.status === 'completed'
                        ? styles.actionPrimaryText
                        : styles.actionDangerText,
                    ]}
                  >
                    {workout.status === 'completed' ? 'Resume Session' : 'Cancel Session'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
      </RefreshScreen>

      {bodyRecoveryFailed ? (
        <View style={styles.bodyRecoveryOverlay} accessibilityRole="alert">
          <Ionicons name="refresh-circle-outline" size={32} color={SLColors.accentViolet} />
          <Text style={styles.bodyRecoveryTitle}>Session view needs to reconnect</Text>
          <Text style={styles.bodyRecoveryBody}>
            Your logged sets and timer are preserved. Retry loading this Session view.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry Session view"
            onPress={retryLoggerBody}
            style={({ pressed }) => [
              styles.bodyRecoveryButton,
              pressed && styles.bodyRecoveryButtonPressed,
            ]}
          >
            <Text style={styles.bodyRecoveryButtonText}>Retry Session View</Text>
          </Pressable>
        </View>
      ) : null}

      <SetVideoPlayerModal
        visible={setVideoPlayer.visible}
        videoId={setVideoPlayer.videoId}
        initialUrl={setVideoPlayer.initialUrl}
        initialVideo={setVideoPlayer.initialVideo}
        onClose={() => setSetVideoPlayer({ visible: false, videoId: null, initialUrl: null, initialVideo: null })}
      />

      <Modal
        visible={!!coreWheel?.visible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setCoreWheel(null)}
      >
        <View style={styles.coreWheelBackdrop}>
          <TouchableWithoutFeedback onPress={() => setCoreWheel(null)}>
            <View style={styles.coreWheelBackdropHit} />
          </TouchableWithoutFeedback>
          {coreWheel ? (
            <View style={styles.coreWheelSheet}>
              <View style={styles.coreWheelHandle} />
              <View style={styles.coreWheelHeaderRow}>
                <View style={styles.coreWheelHeaderCopy}>
                  <Text style={styles.coreWheelTitle}>
                    {coreWheel.title}
                  </Text>
                  <Text style={styles.coreWheelSubtitle}>
                    {coreWheel.prescriptionLine
                      ? `Prescribed: ${coreWheel.prescriptionLine}`
                      : 'Select actuals'}
                  </Text>
                </View>
                <LogSheetUnitToggle unit={unit} onChange={switchDisplayUnit} />
              </View>

              <LoggerWheelPicker columns={[
                { key: 'weight', label: 'Weight', value: coreWheel.weight, options: coreWheel.weightOptions, suffix: unit, accessibilityValue: (value) => `${value} ${unit === 'kg' ? 'kilograms' : 'pounds'}`, onChange: (value) => setCoreWheel((prev) => prev ? { ...prev, weight: value } : prev) },
                { key: 'reps', label: 'Reps', value: coreWheel.reps, options: coreWheel.repsOptions, accessibilityValue: (value) => `${value} reps`, onChange: (value) => setCoreWheel((prev) => prev ? { ...prev, reps: value } : prev) },
                { key: 'rpe', label: 'RPE', value: coreWheel.rpe, options: coreWheel.rpeOptions, accessibilityValue: (value) => `${value} RPE`, onChange: (value) => setCoreWheel((prev) => prev ? { ...prev, rpe: value } : prev) },
              ]} />

              {coreWheelLastLog ? (
                <TouchableOpacity
                  accessibilityHint="Logs a new set immediately through the standard set logger"
                  accessibilityLabel={`Repeat Last Set${coreWheelRepeatPreview ? `: ${coreWheelRepeatPreview}` : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ busy: coreRepeatBusy, disabled: coreRepeatBusy }}
                  disabled={coreRepeatBusy}
                  onPress={repeatLastIntoCoreWheel}
                  style={[styles.repeatLastSetAction, coreRepeatBusy && styles.repeatLastSetActionDisabled]}
                >
                  {coreRepeatBusy
                    ? <ActivityIndicator color={SLColors.accentViolet} size="small" />
                    : <Ionicons color={SLColors.accentViolet} name="copy-outline" size={20} />}
                  <View style={styles.repeatLastSetCopy}>
                    <Text style={styles.repeatLastSetTitle}>
                      {coreRepeatBusy ? 'Repeating Last Set…' : 'Repeat Last Set'}
                    </Text>
                    <Text style={styles.repeatLastSetSubtitle}>{coreWheelRepeatPreview}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.failedSetToggle,
                  styles.coreWheelFailedToggle,
                  coreWheel.reps === '0' && styles.failedSetToggleActive,
                ]}
                onPress={() =>
                  setCoreWheel((prev) =>
                    prev ? { ...prev, reps: prev.reps === '0' ? '1' : '0', rpe: prev.reps === '0' ? prev.rpe : '' } : prev
                  )
                }
              >
                <Text style={[styles.failedSetToggleText, coreWheel.reps === '0' && styles.failedSetToggleTextActive]}>
                  Failed lift / 0 reps
                </Text>
              </TouchableOpacity>

              <View style={styles.coreWheelActions}>
                <TouchableOpacity style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]} onPress={() => setCoreWheel(null)} disabled={feedbackState.submission.status === 'submitting'}>
                  <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
                </TouchableOpacity>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={coreWheelSubmitAction.accessibilityLabel}
                  accessibilityLiveRegion="polite"
                  accessibilityState={{ disabled: coreWheelSubmitAction.disabled, busy: ['saving', 'refreshing'].includes(coreWheelSubmitAction.tone) }}
                  disabled={coreWheelSubmitAction.disabled}
                  onPress={feedbackState.submission.status === 'stale_conflict' ? refreshAfterStaleConflict : commitCoreWheel}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionPrimary,
                    styles.logSheetSubmit,
                    styles.coreWheelSubmit,
                    coreWheelSubmitAction.tone === 'accepted' && styles.logSheetSubmitAccepted,
                    coreWheelSubmitAction.tone === 'failure' && styles.logSheetSubmitFailure,
                    pressed && !reduceMotion && styles.logSheetSubmitPressed,
                  ]}
                >
                  {['saving', 'refreshing'].includes(coreWheelSubmitAction.tone) ? <ActivityIndicator size="small" color={SLColors.textStrong} /> : null}
                  {coreWheelSubmitAction.tone === 'accepted' ? <Ionicons name="checkmark" size={20} color={SLColors.textStrong} /> : null}
                  <Text numberOfLines={1} style={[styles.actionButtonText, styles.actionPrimaryText]}>{coreWheelSubmitLabel}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={!!accessoryWheel?.visible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setAccessoryWheel(null)}
      >
        <View style={styles.coreWheelBackdrop}>
          <TouchableWithoutFeedback onPress={() => setAccessoryWheel(null)}>
            <View style={styles.coreWheelBackdropHit} />
          </TouchableWithoutFeedback>
          {accessoryWheel ? (
            <View style={styles.coreWheelSheet}>
              <View style={styles.coreWheelHandle} />
              <View style={styles.coreWheelHeaderRow}>
                <View style={styles.coreWheelHeaderCopy}>
                  <Text style={styles.coreWheelTitle}>{accessoryWheel.title}</Text>
                  <Text style={styles.coreWheelSubtitle}>
                    {accessoryWheel.targetLine ? accessoryWheel.targetLine : 'Select actuals'}
                  </Text>
                </View>
                <LogSheetUnitToggle unit={unit} onChange={switchDisplayUnit} />
              </View>

              <LoggerWheelPicker columns={[
                { key: 'weight', label: 'Weight', value: accessoryWheel.weight, options: accessoryWheel.weightOptions, suffix: unit, accessibilityValue: (value) => `${value} ${unit === 'kg' ? 'kilograms' : 'pounds'}`, onChange: (value) => setAccessoryWheel((prev) => prev ? { ...prev, weight: value } : prev) },
                { key: 'reps', label: 'Reps', value: accessoryWheel.reps, options: accessoryWheel.repsOptions, accessibilityValue: (value) => `${value} reps`, onChange: (value) => setAccessoryWheel((prev) => prev ? { ...prev, reps: value } : prev) },
                { key: 'rir', label: 'RIR', value: accessoryWheel.rir, options: accessoryWheel.rirOptions, accessibilityValue: (value) => `${value} RIR`, onChange: (value) => setAccessoryWheel((prev) => prev ? { ...prev, rir: value } : prev) },
              ]} />

              {accessoryWheelLastLog ? (
                <TouchableOpacity
                  accessibilityHint="Logs a new set immediately through the standard set logger"
                  accessibilityLabel={`Repeat Last Set${accessoryWheelRepeatPreview ? `: ${accessoryWheelRepeatPreview}` : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ busy: accessoryRepeatBusy, disabled: accessoryRepeatBusy }}
                  disabled={accessoryRepeatBusy}
                  onPress={repeatLastIntoAccessoryWheel}
                  style={[styles.repeatLastSetAction, accessoryRepeatBusy && styles.repeatLastSetActionDisabled]}
                >
                  {accessoryRepeatBusy
                    ? <ActivityIndicator color={SLColors.accentViolet} size="small" />
                    : <Ionicons color={SLColors.accentViolet} name="copy-outline" size={20} />}
                  <View style={styles.repeatLastSetCopy}>
                    <Text style={styles.repeatLastSetTitle}>
                      {accessoryRepeatBusy ? 'Repeating Last Set…' : 'Repeat Last Set'}
                    </Text>
                    <Text style={styles.repeatLastSetSubtitle}>{accessoryWheelRepeatPreview}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.failedSetToggle,
                  accessoryWheel.reps === '0' && styles.failedSetToggleActive,
                ]}
                onPress={() =>
                  setAccessoryWheel((prev) =>
                    prev ? { ...prev, reps: prev.reps === '0' ? '1' : '0', rir: prev.reps === '0' ? prev.rir : '' } : prev
                  )
                }
              >
                <Text style={[styles.failedSetToggleText, accessoryWheel.reps === '0' && styles.failedSetToggleTextActive]}>
                  Failed lift / 0 reps
                </Text>
              </TouchableOpacity>

              <View style={styles.coreWheelActions}>
                <TouchableOpacity style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]} onPress={() => setAccessoryWheel(null)} disabled={feedbackState.submission.status === 'submitting'}>
                  <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
                </TouchableOpacity>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={accessoryWheelSubmitAction.accessibilityLabel}
                  accessibilityLiveRegion="polite"
                  accessibilityState={{ disabled: accessoryWheelSubmitAction.disabled, busy: ['saving', 'refreshing'].includes(accessoryWheelSubmitAction.tone) }}
                  disabled={accessoryWheelSubmitAction.disabled}
                  onPress={feedbackState.submission.status === 'stale_conflict' ? refreshAfterStaleConflict : commitAccessoryWheel}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionPrimary,
                    styles.logSheetSubmit,
                    accessoryWheelSubmitAction.tone === 'accepted' && styles.logSheetSubmitAccepted,
                    accessoryWheelSubmitAction.tone === 'failure' && styles.logSheetSubmitFailure,
                    pressed && !reduceMotion && styles.logSheetSubmitPressed,
                  ]}
                >
                  {['saving', 'refreshing'].includes(accessoryWheelSubmitAction.tone) ? <ActivityIndicator size="small" color={SLColors.textStrong} /> : null}
                  {accessoryWheelSubmitAction.tone === 'accepted' ? <Ionicons name="checkmark" size={20} color={SLColors.textStrong} /> : null}
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>{accessoryWheelSubmitAction.label}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={closeSupersetRoundLogger}
        transparent
        visible={Boolean(supersetRoundLogger)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editSetKeyboardAvoider}
        >
          <View style={styles.coreWheelBackdrop}>
            <TouchableWithoutFeedback onPress={closeSupersetRoundLogger}>
              <View style={styles.coreWheelBackdropHit} />
            </TouchableWithoutFeedback>
            {supersetRoundLogger ? (() => {
              const activeEntry =
                supersetRoundLogger.entries[supersetRoundLogger.activeIndex];
              const isFinalMovement =
                supersetRoundLogger.activeIndex === supersetRoundLogger.entries.length - 1;
              const hasCompletedMovement =
                supersetRoundLogger.entries.some((entry) => entry.alreadyLogged);
              const finalActionLabel = hasCompletedMovement ? 'Finish Round' : 'Save Round';
              if (!activeEntry) return null;
              return (
                <View style={[styles.coreWheelSheet, styles.supersetRoundSheet]}>
                  <View style={styles.coreWheelHandle} />
                  <View style={styles.supersetRoundContextRow}>
                    <View style={styles.coreWheelHeaderCopy}>
                      <Text style={styles.supersetRoundContext}>
                        SUPERSET {supersetRoundLogger.groupLabel} · ROUND {supersetRoundLogger.roundIndex} OF {supersetRoundLogger.roundCount}
                      </Text>
                      <View style={styles.supersetRoundStepRow}>
                        <Text accessibilityLiveRegion="polite" style={styles.supersetRoundStep}>
                          MOVEMENT {supersetRoundLogger.activeIndex + 1} OF {supersetRoundLogger.entries.length}
                        </Text>
                        {supersetRoundCapturedIndex != null ? (
                          <Animated.View
                            style={[
                              styles.supersetRoundCapturedCue,
                              { opacity: supersetRoundCapturedCueOpacity },
                            ]}
                          >
                            <Ionicons color={SLColors.success} name="checkmark" size={13} />
                            <Text style={styles.supersetRoundCapturedCueText}>Captured</Text>
                          </Animated.View>
                        ) : null}
                      </View>
                    </View>
                    <LogSheetUnitToggle unit={unit} onChange={switchDisplayUnit} />
                  </View>

                  <View
                    accessibilityLabel={`Movement ${supersetRoundLogger.activeIndex + 1} of ${supersetRoundLogger.entries.length}`}
                    style={styles.supersetRoundProgress}
                  >
                    {supersetRoundLogger.entries.map((entry, index) => (
                      <Animated.View
                        key={entry.itemId}
                        style={[
                          styles.supersetRoundProgressMark,
                          supersetRoundCapturedIndex === index && {
                            transform: [{
                              scale: supersetRoundCapturedPulse.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.16],
                              }),
                            }],
                          },
                        ]}
                      >
                        {entry.alreadyLogged || index <= supersetRoundLogger.activeIndex ? (
                          <Animated.View
                            style={[
                              styles.supersetRoundProgressFill,
                              supersetRoundProgressIndex === index && {
                                transform: [{ scaleX: supersetRoundProgressFill }],
                              },
                            ]}
                          />
                        ) : null}
                      </Animated.View>
                    ))}
                  </View>

                  <Animated.View
                    pointerEvents={supersetRoundTransitioning ? 'none' : 'auto'}
                    style={[
                      styles.supersetRoundStepContent,
                      {
                        opacity: supersetRoundStepOpacity,
                        transform: [{ translateX: supersetRoundStepTranslateX }],
                      },
                    ]}
                  >
                    <View style={styles.supersetRoundMovementHeader}>
                      <View style={styles.supersetRoundEntryNumber}>
                        <Text style={styles.supersetRoundEntryNumberText}>
                          {supersetRoundLogger.activeIndex + 1}
                        </Text>
                      </View>
                      <View style={styles.supersetRoundEntryCopy}>
                        <Text style={styles.supersetRoundEntryTitle}>{activeEntry.title}</Text>
                        <Text style={styles.supersetRoundEntryPrescription}>
                          {activeEntry.prescription}
                        </Text>
                      </View>
                      {activeEntry.alreadyLogged ? (
                        <View style={styles.supersetRoundLoggedPill}>
                          <Ionicons color={SLColors.success} name="checkmark" size={14} />
                          <Text style={styles.supersetRoundLoggedPillText}>Logged</Text>
                        </View>
                      ) : activeEntry.skipped ? (
                        <View style={styles.supersetRoundSkippedPill}>
                          <Ionicons color={SLColors.warning} name="play-skip-forward" size={14} />
                          <Text style={styles.supersetRoundSkippedPillText}>Skipped</Text>
                        </View>
                      ) : null}
                    </View>

                    {activeEntry.alreadyLogged ? (
                      <View style={styles.supersetRoundLoggedSummary}>
                        <Text style={styles.supersetRoundLoggedResult}>
                          {activeEntry.weight} {unit} × {activeEntry.reps}
                          {activeEntry.rir ? ` · ${activeEntry.rir} RIR` : ''}
                        </Text>
                        <Text style={styles.supersetRoundLoggedNotice}>
                          Already saved. This movement will not be logged again.
                        </Text>
                      </View>
                    ) : activeEntry.skipped ? (
                      <View style={styles.supersetRoundSkippedSummary}>
                        <Text style={styles.supersetRoundLoggedResult}>Skipped for now</Text>
                        <Text style={styles.supersetRoundLoggedNotice}>
                          This movement stays incomplete and can be logged individually or in a later round attempt.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <LoggerWheelPicker columns={[
                          { key: 'weight', label: 'Weight', value: activeEntry.weight, options: activeEntry.weightOptions, suffix: unit, accessibilityValue: (value) => `${value} ${unit === 'kg' ? 'kilograms' : 'pounds'}`, onChange: (value) => updateSupersetRoundEntry(activeEntry.itemId, 'weight', value) },
                          { key: 'reps', label: 'Reps', value: activeEntry.reps, options: activeEntry.repsOptions, accessibilityValue: (value) => `${value} reps`, onChange: (value) => updateSupersetRoundEntry(activeEntry.itemId, 'reps', value) },
                          { key: 'rir', label: 'RIR', value: activeEntry.rir, options: activeEntry.rirOptions, accessibilityValue: (value) => `${value} RIR`, onChange: (value) => updateSupersetRoundEntry(activeEntry.itemId, 'rir', value) },
                        ]} />

                        {activeEntry.repeatLast ? (
                          <TouchableOpacity
                            accessibilityHint={`Logs a new set for ${activeEntry.title} immediately through the standard superset logger`}
                            accessibilityLabel={`Repeat Last Set for ${activeEntry.title}: ${activeEntry.repeatLast.preview}`}
                            accessibilityRole="button"
                            accessibilityState={{
                              busy: supersetRoundLogger.saving,
                              disabled: supersetRoundLogger.saving || supersetRoundTransitioning,
                            }}
                            disabled={supersetRoundLogger.saving || supersetRoundTransitioning}
                            onPress={() => repeatLastIntoSupersetEntry(activeEntry.itemId)}
                            style={[
                              styles.repeatLastSetAction,
                              (supersetRoundLogger.saving || supersetRoundTransitioning)
                                && styles.repeatLastSetActionDisabled,
                            ]}
                          >
                            {supersetRoundLogger.saving
                              ? <ActivityIndicator color={SLColors.accentViolet} size="small" />
                              : <Ionicons color={SLColors.accentViolet} name="copy-outline" size={20} />}
                            <View style={styles.repeatLastSetCopy}>
                              <Text style={styles.repeatLastSetTitle}>
                                {supersetRoundLogger.saving ? 'Repeating Last Set…' : 'Repeat Last Set'}
                              </Text>
                              <Text style={styles.repeatLastSetSubtitle}>{activeEntry.repeatLast.preview}</Text>
                            </View>
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                          onPress={() =>
                            updateSupersetRoundEntry(
                              activeEntry.itemId,
                              'reps',
                              activeEntry.reps === '0' ? '1' : '0',
                            )}
                          style={[
                            styles.failedSetToggle,
                            activeEntry.reps === '0' && styles.failedSetToggleActive,
                          ]}
                        >
                          <Text style={[
                            styles.failedSetToggleText,
                            activeEntry.reps === '0' && styles.failedSetToggleTextActive,
                          ]}>
                            Failed set / 0 reps
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {activeEntry.validationError || error ? (
                      <Text accessibilityLiveRegion="polite" style={styles.supersetRoundError}>
                        {activeEntry.validationError || error}
                      </Text>
                    ) : null}
                  </Animated.View>

                  {!activeEntry.alreadyLogged ? (
                    <View style={styles.supersetRoundEscapeActions}>
                      <TouchableOpacity
                        accessibilityLabel={`Skip ${activeEntry.title} for this round`}
                        disabled={supersetRoundLogger.saving || supersetRoundTransitioning}
                        onPress={skipCurrentSupersetMovement}
                        style={styles.supersetRoundEscapeAction}
                      >
                        <Ionicons color={SLColors.warning} name="play-skip-forward" size={17} />
                        <Text style={styles.supersetRoundEscapeActionText}>Skip</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel={`Log ${activeEntry.title} individually`}
                        disabled={supersetRoundLogger.saving || supersetRoundTransitioning}
                        onPress={logSupersetMovementIndividually}
                        style={styles.supersetRoundEscapeAction}
                      >
                        <Ionicons color={SLColors.accentViolet} name="open-outline" size={17} />
                        <Text style={styles.supersetRoundEscapeActionText}>Log Individually</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <View style={styles.coreWheelActions}>
                    <TouchableOpacity
                      disabled={supersetRoundLogger.saving || supersetRoundTransitioning}
                      onPress={
                        supersetRoundLogger.activeIndex === 0
                          ? closeSupersetRoundLogger
                          : goBackInSupersetRoundLogger
                      }
                      style={[
                        styles.actionButton,
                        styles.actionSecondary,
                        styles.supersetRoundSecondaryAction,
                        (
                          supersetRoundLogger.saving
                          || supersetRoundTransitioning
                        ) && styles.supersetRoundActionDisabled,
                      ]}
                    >
                      <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>
                        {supersetRoundLogger.activeIndex === 0 ? 'Cancel' : 'Back'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityLabel={
                        isFinalMovement
                          ? `${finalActionLabel} for superset ${supersetRoundLogger.groupLabel}, round ${supersetRoundLogger.roundIndex}`
                          : `Continue to movement ${supersetRoundLogger.activeIndex + 2}`
                      }
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: supersetRoundLogger.saving || supersetRoundTransitioning,
                        disabled: supersetRoundLogger.saving || supersetRoundTransitioning,
                      }}
                      disabled={supersetRoundLogger.saving || supersetRoundTransitioning}
                      onPress={
                        isFinalMovement
                          ? () => { void saveSupersetRound(); }
                          : advanceSupersetRoundLogger
                      }
                      style={[
                        styles.actionButton,
                        styles.actionPrimary,
                        styles.supersetRoundSave,
                        (
                          supersetRoundLogger.saving
                          || supersetRoundTransitioning
                        ) && styles.supersetRoundActionDisabled,
                      ]}
                    >
                      {supersetRoundLogger.saving ? (
                        <ActivityIndicator color={SLColors.textInverted} size="small" />
                      ) : null}
                      <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
                        {isFinalMovement ? finalActionLabel : 'Next Movement'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })() : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!pendingRowVideoUpload}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingRowVideoUpload(null)}
      >
        <View style={styles.coreWheelBackdrop}>
          <TouchableWithoutFeedback onPress={() => setPendingRowVideoUpload(null)}>
            <View style={styles.coreWheelBackdropHit} />
          </TouchableWithoutFeedback>
          {pendingRowVideoUpload ? (
            <View style={styles.coreWheelSheet}>
              <View style={styles.coreWheelHandle} />
              <View style={styles.coreWheelHeaderRow}>
                <View style={styles.coreWheelHeaderCopy}>
                  <Text style={styles.coreWheelTitle}>Video angle</Text>
                  <Text style={styles.coreWheelSubtitle}>{isIndividualUser ? 'Tag the camera angle for your archive.' : 'Tag the camera angle for coach review.'}</Text>
                </View>
              </View>
              <View style={[styles.logVideoAngleChips, { marginTop: 16 }]}>
                {VIDEO_ANGLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.slug}
                    style={[
                      styles.logVideoAngleChip,
                      pendingRowVideoUpload.selectedVideo.videoAngle === option.slug && styles.logVideoAngleChipActive,
                    ]}
                    onPress={() => setPendingRowVideoUpload((prev) => prev ? {
                      ...prev,
                      selectedVideo: { ...prev.selectedVideo, videoAngle: option.slug },
                    } : prev)}
                  >
                    <Text
                      style={[
                        styles.logVideoAngleChipText,
                        pendingRowVideoUpload.selectedVideo.videoAngle === option.slug && styles.logVideoAngleChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.logVideoIntentGroup}>
                <Text style={styles.logVideoIntentTitle}>What do you want to do with this video?</Text>
                {videoIntentOptions.map((option) => {
                  const active = (pendingRowVideoUpload.selectedVideo.submitForReview !== false) === option.submitForReview;
                  return (
                    <TouchableOpacity
                      key={option.title}
                      style={[styles.logVideoIntentOption, active && styles.logVideoIntentOptionActive]}
                      onPress={() => setPendingRowVideoUpload((prev) => prev ? {
                        ...prev,
                        selectedVideo: { ...prev.selectedVideo, submitForReview: option.submitForReview },
                      } : prev)}
                    >
                      <Text style={[styles.logVideoIntentOptionTitle, active && styles.logVideoIntentOptionTitleActive]}>
                        {option.title}
                      </Text>
                      <Text style={styles.logVideoIntentOptionBody}>{option.body}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.coreWheelActions}>
                <TouchableOpacity style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]} onPress={() => setPendingRowVideoUpload(null)}>
                  <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]} onPress={confirmPendingRowVideoUpload}>
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Upload</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={false && !!movementHistoryItem}
        transparent
        animationType="slide"
        onRequestClose={() => setMovementHistoryItem(null)}
      >
        <View style={styles.coreWheelBackdrop}>
          <TouchableWithoutFeedback onPress={() => setMovementHistoryItem(null)}>
            <View style={styles.coreWheelBackdropHit} />
          </TouchableWithoutFeedback>
          {movementHistoryItem ? (() => {
            const history = movementHistoryItem.movement_history || null;
            const assisted = history?.loading_behavior === 'assisted';
            const historyIdentity = movementHistoryItem.performed_movement_identity
              || movementHistoryItem.movement_identity
              || null;
            const exactManufacturerName = historyIdentity?.manufacturer?.display_name
              || (historyIdentity?.equipment_context?.option_kind === 'other' ? 'Other' : null);
            const exactMachineName = isIdealWorkoutDetailPreview
              ? exactManufacturerName || 'Other'
              : historyIdentity?.family_display_name
                || movementHistoryItem.movement
                || historyIdentity?.display_name
                || 'Machine';
            const exactEquipmentMetadata = machineHistoryMetadata(historyIdentity?.equipment_type);
            const recent = exactAccessoryHistoryRows(history).slice(0, 5);
            const exactMostRecent = exactAccessoryLastExposure(history);
            const exactBest = exactAccessoryBestExposure(history);
            const legacyHistory = history?.legacy_unresolved_history || null;
            const legacyRecent = (legacyHistory?.recent_sessions && legacyHistory.recent_sessions.length > 0)
              ? legacyHistory.recent_sessions
              : ((legacyHistory?.recent_sets || []).slice(0, 5));
            const related = history?.related_reference_history || [];
            const isMachineHistory = isMachineAccessoryItem(movementHistoryItem);
            return (
              <View style={[
                styles.movementHistorySheet,
                styles.movementHistoryFullScreenSheet,
                { paddingBottom: Math.max(insets.bottom, 18) },
              ]}>
                <View style={styles.coreWheelHandle} />
                <View style={styles.coreWheelHeaderRow}>
                  <View style={styles.coreWheelHeaderCopy}>
                    <Text style={styles.coreWheelTitle}>
                      {movementHistoryItem.movement || 'Movement'} History
                    </Text>
                    <Text style={styles.coreWheelSubtitle}>
                      {formatHistoryPattern(history?.movement_pattern)}
                      {assisted ? ' · assisted load' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="Close movement history"
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={() => setMovementHistoryItem(null)}
                    style={styles.movementHistoryCloseIcon}
                  >
                    <Ionicons
                      color={SLColors.textSecondary}
                      name="close"
                      size={24}
                    />
                  </TouchableOpacity>
                </View>

                {isMachineHistory ? (
                  <ScrollView
                    contentContainerStyle={styles.movementHistoryDossierContent}
                    showsVerticalScrollIndicator={false}
                    style={styles.movementHistoryDossierScroll}
                  >
                    <View style={styles.movementHistoryEquipmentHero}>
                      <View style={styles.movementHistoryEquipmentHeroTopline}>
                        <Text style={styles.movementHistoryManufacturerEyebrow}>
                          {isIdealWorkoutDetailPreview ? 'Equipment identity' : 'Exact equipment'}
                        </Text>
                        <View style={styles.movementHistoryCurrentBadge}>
                          <View style={styles.movementHistoryCurrentDot} />
                          <Text style={styles.movementHistoryCurrentText}>
                            {isIdealWorkoutDetailPreview ? 'CURRENT' : 'CURRENT MACHINE'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.movementHistoryEquipmentHeroIdentity}>
                        <ManufacturerBrandMark hero manufacturerName={exactManufacturerName} />
                        <View style={styles.movementHistoryManufacturerCopy}>
                          <Text numberOfLines={2} style={styles.movementHistoryEquipmentHeroName}>
                            {exactMachineName}
                          </Text>
                          <Text style={styles.movementHistoryEquipmentHeroManufacturer}>
                            {isIdealWorkoutDetailPreview
                              ? equipmentPresentationLabel(historyIdentity?.equipment_type, 'Machine')
                              : exactManufacturerName || 'Unknown manufacturer'}
                          </Text>
                        </View>
                      </View>
                      {exactEquipmentMetadata.length ? (
                        <View style={styles.movementHistoryMetadataChips}>
                          {exactEquipmentMetadata.map((item) => (
                            <View key={item} style={styles.movementHistoryMetadataChip}>
                              <Text numberOfLines={1} style={styles.movementHistoryMetadataChipText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>

                    {assisted ? (
                      <Text style={styles.movementHistoryAssistNote}>
                        Lower assistance can indicate improvement for this movement.
                      </Text>
                    ) : null}

                    <View style={styles.movementHistoryStats}>
                      <MovementHistorySummaryTile
                        assisted={assisted}
                        kind="recent"
                        label="Most recent"
                        row={exactMostRecent}
                        unit={unit}
                      />
                      <MovementHistorySummaryTile
                        assisted={assisted}
                        kind="best"
                        label="Best"
                        row={exactBest}
                        unit={unit}
                      />
                    </View>

                    <Text style={styles.movementHistorySectionTitle}>
                      {isIdealWorkoutDetailPreview ? 'Recent with this equipment' : 'Recent on this machine'}
                    </Text>
                    {recent.length > 0 ? (
                      <ScrollView
                        contentContainerStyle={styles.movementHistoryExactRail}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        {recent.map((row, idx) => (
                          <MovementHistoryExactCard
                            assisted={assisted}
                            key={`${row.workout_id || 'wk'}-${row.set_index || idx}-${idx}`}
                            row={row}
                            unit={unit}
                          />
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={styles.movementHistoryEmpty}>
                        No previous exact exposure.
                      </Text>
                    )}

                    {legacyRecent.length > 0 ? (
                      <>
                        <View style={styles.movementHistoryRelatedHeading}>
                          <Text style={styles.movementHistoryRelatedTitle}>
                            {equipmentPresentationLabel(
                              legacyHistory?.equipment_label,
                              'Unknown equipment',
                            )}
                          </Text>
                          <Text style={styles.movementHistoryRelatedCount}>{legacyRecent.length}</Text>
                        </View>
                        <View style={styles.movementHistoryRelatedGuidance}>
                          <Ionicons color={SLColors.textMuted} name="information-circle-outline" size={16} />
                          <Text style={styles.movementHistoryRelatedNote}>
                            Legacy sets recorded before equipment tracking. Reference only; loads may not be comparable to this machine.
                          </Text>
                        </View>
                        <ScrollView
                          contentContainerStyle={styles.movementHistoryExactRail}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                        >
                          {legacyRecent.map((row, idx) => (
                            <MovementHistoryExactCard
                              assisted={assisted}
                              key={`legacy-${row.workout_id || 'import'}-${row.set_index || idx}-${idx}`}
                              row={row}
                              unit={unit}
                            />
                          ))}
                        </ScrollView>
                      </>
                    ) : null}

                    {related.length > 0 ? (
                      <>
                        <View style={styles.movementHistoryRelatedHeading}>
                          <Text style={styles.movementHistoryRelatedTitle}>Other equipment</Text>
                          <Text style={styles.movementHistoryRelatedCount}>{related.length}</Text>
                        </View>
                        <View style={styles.movementHistoryRelatedGuidance}>
                          <Ionicons color={SLColors.textMuted} name="information-circle-outline" size={16} />
                          <Text style={styles.movementHistoryRelatedNote}>
                            {isIdealWorkoutDetailPreview && (movementHistoryItem as any).dev_accessory_intelligence?.kind === 'machine'
                              ? 'Reference only. Different manufacturers or types are not used for progression.'
                              : 'Reference only. Loads are not comparable across equipment implementations.'}
                          </Text>
                        </View>
                        <ScrollView
                          contentContainerStyle={styles.movementHistoryEquipmentRail}
                          decelerationRate="fast"
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          snapToInterval={300}
                        >
                          {related.map((row) => (
                            <MovementHistoryRelatedCard
                              key={`related-${row.movement_definition_id}`}
                              row={row}
                              unit={unit}
                            />
                          ))}
                        </ScrollView>
                      </>
                    ) : null}
                  </ScrollView>
                ) : (
                  <>
                    {assisted ? (
                      <Text style={styles.movementHistoryAssistNote}>
                        Lower assistance can indicate improvement for this movement.
                      </Text>
                    ) : null}
                    <View style={styles.movementHistoryStats}>
                      <View style={styles.movementHistoryStatCard}>
                        <Text style={styles.movementHistoryLabel}>Most Recent</Text>
                        <Text style={styles.movementHistoryValue}>
                          {formatMovementHistorySet(exactMostRecent, unit, assisted)}
                        </Text>
                      </View>
                      <View style={styles.movementHistoryStatCard}>
                        <Text style={styles.movementHistoryLabel}>Best</Text>
                        <Text style={styles.movementHistoryValue}>
                          {formatMovementHistorySet(exactBest, unit, assisted)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.movementHistorySectionTitle}>Recent History</Text>
                    <ScrollView
                      contentContainerStyle={styles.movementHistoryListContent}
                      showsVerticalScrollIndicator={false}
                      style={[styles.movementHistoryList, styles.movementHistoryExpandedList]}
                    >
                      {recent.length > 0 ? recent.map((row, idx) => (
                        <View key={`${row.workout_id || 'wk'}-${row.set_index || idx}-${idx}`} style={styles.movementHistoryRow}>
                          <Text style={styles.movementHistoryDate}>
                            {row.date ? String(row.date).slice(0, 10) : 'Unknown date'}
                          </Text>
                          <Text style={styles.movementHistoryRowValue}>
                            {formatMovementHistorySet(row, unit, assisted)}
                          </Text>
                        </View>
                      )) : (
                        <Text style={styles.movementHistoryEmpty}>No previous exact exposure.</Text>
                      )}
                      {related.length > 0 ? (
                        <>
                          <Text style={styles.movementHistoryRelatedTitle}>Related movement history</Text>
                          <Text style={styles.movementHistoryRelatedNote}>
                            Reference only. Loads are not comparable across equipment implementations.
                          </Text>
                          {related.map((row) => (
                            <View key={`related-${row.movement_definition_id}`} style={styles.movementHistoryRelatedRow}>
                              <ManufacturerBrandMark compact manufacturerName={row.manufacturer} />
                              <View style={styles.movementHistoryRelatedCopy}>
                                <Text style={styles.movementHistoryRelatedName}>{row.display_name}</Text>
                                <Text style={styles.movementHistoryDate}>
                                  {[row.manufacturer, equipmentPresentationLabel(
                                    row.equipment_type || row.equipment_model,
                                    'Equipment',
                                  )]
                                    .filter(Boolean)
                                    .join(' · ') || 'Equipment identity'}
                                </Text>
                              </View>
                              <Text style={styles.movementHistoryRowValue}>
                                {row.has_history ? formatMovementHistorySet(row.last_set, unit, false) : 'No history'}
                              </Text>
                            </View>
                          ))}
                        </>
                      ) : null}
                    </ScrollView>
                  </>
                )}

              </View>
            );
          })() : null}
        </View>
      </Modal>

      <Modal visible={!!identityPickerItem} transparent animationType="slide" onRequestClose={closeIdentityPicker}>
        <View style={styles.coreWheelBackdrop}>
          <TouchableWithoutFeedback onPress={closeIdentityPicker}><View style={styles.coreWheelBackdropHit} /></TouchableWithoutFeedback>
          <View
            style={[
              styles.movementHistorySheet,
              styles.equipmentPickerSheet,
            ]}
          >
            <View style={styles.coreWheelHandle} />
            {identityPickerItem ? (
              <>
                <View style={styles.equipmentPickerMovementContext}>
                  <Text style={styles.equipmentPickerMovementKicker}>EQUIPMENT FOR</Text>
                  <Text style={styles.equipmentPickerMovementTitle}>
                    {simplifyMobileMovementName(identityPickerItem.movement) || 'Accessory'}
                  </Text>
                  <Text style={styles.equipmentPickerMovementMeta}>
                    {identityPickerContinuation.kind === 'group_round'
                      ? `Superset ${identityPickerContinuation.groupLabel} · Round ${identityPickerContinuation.roundIndex}`
                      : 'Upcoming set'}
                  </Text>
                </View>
                {identityPickerManufacturer ? (
                  <>
                    <View style={styles.equipmentPickerHeader}>
                      <TouchableOpacity
                        style={styles.equipmentPickerHeaderAction}
                        onPress={() => {
                          setIdentityPickerManufacturer(null);
                          setIdentityPickerError(null);
                        }}
                        accessibilityLabel="Back to manufacturers"
                      >
                        <Ionicons name="arrow-back" size={20} color={SLColors.textStrong} />
                      </TouchableOpacity>
                      <View style={styles.equipmentPickerHeaderCopy}>
                        <Text style={styles.coreWheelTitle}>Which version are you using?</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.equipmentPickerHeaderAction}
                        onPress={closeIdentityPicker}
                        accessibilityLabel="Close equipment picker"
                      >
                        <Ionicons name="close" size={21} color={SLColors.textStrong} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.equipmentVariantManufacturer}>
                      <ManufacturerBrandMark
                        compact
                        manufacturerName={
                          identityPickerManufacturer.manufacturer?.display_name
                          || 'Other'
                        }
                      />
                      <Text style={styles.equipmentVariantManufacturerName}>
                        {identityPickerManufacturer.manufacturer?.display_name
                          || 'Other'}
                      </Text>
                    </View>
                    {identityPickerError ? (
                      <Text style={styles.movementHistoryEmpty}>
                        {identityPickerError}
                      </Text>
                    ) : null}
                    <View style={styles.equipmentVariantOptions}>
                      {MACHINE_EQUIPMENT_TYPES.map((variant) => {
                        const activeIdentity = activeEquipmentIdentity(identityPickerItem);
                        const selectedOther = (
                          identityPickerManufacturer.equipment_context?.option_kind === 'other'
                          || !identityPickerManufacturer.manufacturer?.key
                        );
                        const activeOther = (
                          activeIdentity?.equipment_context?.option_kind === 'other'
                          || activeIdentity?.manufacturer?.key === 'other'
                        );
                        const sameManufacturer = selectedOther
                          ? activeOther
                          : (
                              identityPickerManufacturer.manufacturer?.key
                              === activeIdentity?.manufacturer?.key
                            );
                        const activeVariant = String(
                          activeIdentity?.equipment_type || '',
                        ).toLowerCase().includes('plate')
                          ? 'plate_loaded'
                          : 'selectorized';
                        const current = Boolean(
                          sameManufacturer
                          && activeIdentity
                          && activeVariant === variant.key,
                        );
                        return (
                          <TouchableOpacity
                            key={variant.key}
                            style={[
                              styles.equipmentVariantRow,
                              current && styles.identityPickerRowCurrent,
                            ]}
                            onPress={() => void chooseEquipmentVariant(variant.key)}
                          >
                            <Text style={styles.equipmentVariantLabel}>
                              {variant.label}
                            </Text>
                            {current ? (
                              <Text style={styles.identityPickerCurrent}>CURRENT</Text>
                            ) : (
                              <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={SLColors.textMuted}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                <View style={styles.equipmentPickerHeader}>
                  <View style={styles.equipmentPickerHeaderCopy}>
                    <Text style={styles.coreWheelTitle}>Choose Manufacturer</Text>
                    <Text style={styles.coreWheelSubtitle}>
                      Which manufacturer&apos;s machine are you using?
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.equipmentPickerHeaderAction}
                    onPress={closeIdentityPicker}
                    accessibilityLabel="Close equipment picker"
                  >
                    <Ionicons name="close" size={21} color={SLColors.textStrong} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={identityPickerQuery}
                  onChangeText={setIdentityPickerQuery}
                  placeholder="Search manufacturer or machine"
                  placeholderTextColor={SLColors.textSubtle}
                  style={styles.identityPickerInput}
                  autoCorrect={false}
                />
                {identityPickerLoading ? <ActivityIndicator color={SLColors.accentViolet} /> : null}
                {identityPickerError ? <Text style={styles.movementHistoryEmpty}>{identityPickerError}</Text> : null}
                <ScrollView
                  style={[styles.movementHistoryList, styles.equipmentPickerList]}
                  keyboardShouldPersistTaps="handled"
                >
                  {identityPickerRows.map((row) => {
                    const other = row.equipment_context?.option_kind === 'other'
                      || row.key.endsWith('-other');
                    const activeEquipment = activeEquipmentIdentity(identityPickerItem);
                    const activeOther = activeEquipment?.equipment_context?.option_kind === 'other'
                      || activeEquipment?.key.includes('-other-');
                    const current = other
                      ? activeOther
                      : Boolean(
                          row.manufacturer?.key
                          && row.manufacturer.key === activeEquipment?.manufacturer?.key,
                        );
                    const manufacturerName = row.manufacturer?.display_name
                      || 'Other';
                    const rememberedStatus = row.equipment_context?.remembered_status;
                    const status = current || rememberedStatus === 'current'
                      ? 'CURRENT'
                      : rememberedStatus === 'used_before'
                        ? 'USED BEFORE'
                        : 'NEVER USED';
                    return (
                      <TouchableOpacity
                        key={row.id}
                        style={[
                          styles.identityPickerRow,
                          current && styles.identityPickerRowCurrent,
                        ]}
                        onPress={() => void choosePerformedIdentity(row)}
                      >
                        <ManufacturerBrandMark compact manufacturerName={manufacturerName} />
                        <View style={styles.identityPickerCopy}>
                          <Text numberOfLines={1} style={styles.identityPickerManufacturer}>
                            {manufacturerName}
                          </Text>
                          <Text
                            style={[
                              styles.identityPickerStatus,
                              current && styles.identityPickerCurrent,
                            ]}
                          >
                            {status}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                  {!identityPickerLoading && identityPickerQuery.trim() && !identityPickerRows.length ? (
                    <Text style={styles.movementHistoryEmpty}>
                      No manufacturers match “{identityPickerQuery.trim()}”.
                    </Text>
                  ) : null}
                </ScrollView>
                  </>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Cancel / Resume confirmation modal */}
      <CancelResumeModal
        visible={cancelConfirmVisible}
        workoutStatus={workout.status}
        actionLoading={actionLoading}
        onClose={() => setCancelConfirmVisible(false)}
        onConfirm={async () => {
          setCancelConfirmVisible(false);
          if (workout.status === 'completed') {
            beginWorkout();
          } else {
            cancelWorkout();
          }
        }}
        styles={styles}
      />

      <FinalSessionCompletionPresenter
        visible={finalSessionCompletion.phase === 'visible' || finalSessionCompletion.phase === 'ending'}
        ending={finalSessionCompletion.phase === 'ending'}
        onEndSession={endSessionFromFinalSet}
        onNotYet={dismissFinalSessionCompletion}
      />

      <Modal
        visible={editSetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!editSetSubmitting) {
            setEditSetVisible(false);
            setEditSetCtx(null);
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.editSetKeyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <View style={styles.coreWheelBackdrop}>
            <TouchableWithoutFeedback onPress={() => {
              if (!editSetSubmitting) {
                setEditSetVisible(false);
                setEditSetCtx(null);
              }
            }}>
              <View style={styles.coreWheelBackdropHit} />
            </TouchableWithoutFeedback>
            {editSetCtx ? (
              <View style={[styles.coreWheelSheet, styles.editSetWheelSheet]}>
              <View style={styles.coreWheelHandle} />
              <ScrollView
                style={styles.editSetScroll}
                contentContainerStyle={[styles.editSetScrollContent, { paddingBottom: Math.max(insets.bottom, SLSpacing.lg) }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
              <View style={styles.coreWheelHeaderRow}>
                <View style={styles.coreWheelHeaderCopy}>
                  <Text style={styles.coreWheelTitle}>{editSetCtx.movementName} · Set {editSetCtx.setIndex}</Text>
                  <Text style={styles.coreWheelSubtitle}>
                    Currently logged: {editSetCtx.loggedWeightKg != null ? formatWeight(editSetCtx.loggedWeightKg, unit) : '—'} {unit} × {editSetCtx.loggedReps ?? '—'}
                    {editSetCtx.mode === 'rpe'
                      ? ` @${editSetCtx.loggedRpe != null ? formatWheelNumber(editSetCtx.loggedRpe) : '—'}`
                      : ` @${editSetCtx.loggedRir != null ? formatWheelNumber(editSetCtx.loggedRir) : '—'} RIR`}
                  </Text>
                </View>
                <LogSheetUnitToggle unit={unit} onChange={switchDisplayUnit} />
              </View>

              <LoggerWheelPicker columns={[
                { key: 'weight', label: 'Weight', value: editSetForm.weight, options: buildEditWeightOptions(editSetCtx.mode, unit, editSetForm.weight), suffix: unit, accessibilityValue: (value) => `${value} ${unit === 'kg' ? 'kilograms' : 'pounds'}`, onChange: (weight) => setEditSetForm((prev) => ({ ...prev, weight })) },
                { key: 'reps', label: 'Reps', value: editSetForm.reps, options: ['0', ...Array.from({ length: editSetCtx.mode === 'rpe' ? 20 : 30 }, (_, idx) => String(idx + 1))], accessibilityValue: (value) => `${value} reps`, onChange: (reps) => setEditSetForm((prev) => ({ ...prev, reps })) },
                { key: editSetCtx.mode, label: editSetCtx.mode === 'rpe' ? 'RPE' : 'RIR', value: editSetCtx.mode === 'rpe' ? editSetForm.rpe : editSetForm.rir, options: editSetCtx.mode === 'rpe' ? Array.from({ length: 11 }, (_, idx) => formatWheelNumber(5 + idx * 0.5)) : Array.from({ length: 11 }, (_, idx) => formatWheelNumber(idx * 0.5)), accessibilityValue: (value) => `${value} ${editSetCtx.mode.toUpperCase()}`, onChange: (metric) => setEditSetForm((prev) => editSetCtx.mode === 'rpe' ? { ...prev, rpe: metric } : { ...prev, rir: metric }) },
              ]} />

              <TouchableOpacity
                style={[
                  styles.failedSetToggle,
                  styles.coreWheelFailedToggle,
                  editSetForm.reps === '0' && styles.failedSetToggleActive,
                ]}
                onPress={() =>
                  setEditSetForm((prev) => ({
                    ...prev,
                    reps: prev.reps === '0' ? '1' : '0',
                    rpe: prev.reps === '0' ? prev.rpe : '',
                    rir: prev.reps === '0' ? prev.rir : '',
                  }))
                }
              >
                <Text style={[styles.failedSetToggleText, editSetForm.reps === '0' && styles.failedSetToggleTextActive]}>
                  Failed lift / 0 reps
                </Text>
              </TouchableOpacity>

              <View style={styles.coreWheelActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionPrimary, styles.coreWheelSubmit]}
                  onPress={saveEditedSet}
                  disabled={editSetSubmitting}
                >
                  {editSetSubmitting ? (
                    <ActivityIndicator size="small" color={SLColors.textInverted} />
                  ) : (
                    <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Save Changes</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                  onPress={() => {
                    if (!editSetSubmitting) {
                      setEditSetVisible(false);
                      setEditSetCtx(null);
                    }
                  }}
                  disabled={editSetSubmitting}
                >
                  <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
                </TouchableOpacity>
              </View>
              </ScrollView>
            </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!missingCompletionSets}
        transparent
        animationType="fade"
        onRequestClose={() => setMissingCompletionSets(null)}
      >
        <View style={styles.modalBackdropCenter}>
          <View style={[styles.modalCard, styles.incompleteCompleteModal]}>
            <View style={styles.incompleteWarningIcon}>
              <Text style={styles.incompleteWarningIconText}>!</Text>
            </View>
            <Text style={styles.postSessionTitle}>Finish with unlogged sets?</Text>
            <Text style={styles.incompleteCompleteCopy}>
              These prescribed sets have not been logged. You can keep logging or continue to the post-session survey.
            </Text>

            <View style={styles.incompleteMissingListFrame}>
              <ScrollView style={styles.incompleteMissingList} showsVerticalScrollIndicator>
                {(missingCompletionSets || []).map((label, idx) => (
                  <View key={`${label}-${idx}`} style={styles.incompleteMissingRow}>
                    <Text style={styles.incompleteMissingBullet}>•</Text>
                    <Text style={styles.incompleteMissingText}>{label}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                onPress={() => setMissingCompletionSets(null)}
              >
                <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Keep Logging</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionDanger, { flex: 1.15 }]}
                onPress={continueToPostSessionWithMissingSets}
              >
                <Text style={[styles.actionButtonText, styles.actionDangerText]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={postSessionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!postSessionSubmitting) {
            setPostSessionTimePicker(null);
            setPostSessionTimePickerDraft(null);
            setPostSessionVisible(false);
          }
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={[styles.modalBackdrop, styles.postSessionBackdrop]}>
              <View style={[styles.modalCard, styles.postSessionModal]}>
                <Text style={[styles.postSessionTitle, styles.postSessionReflectionTitle]}>How did that feel?</Text>
                <Text style={styles.postSessionReflectionSubtitle}>Capture today&apos;s session while it&apos;s still fresh.</Text>

                <ScrollView
                  style={styles.postSessionScroll}
                  contentContainerStyle={styles.postSessionScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                <View style={styles.postSessionTimeSection}>
                  <Text style={styles.surveyLabel}>Session time</Text>
                  <Text style={styles.postSessionTimeHint}>
                    Confirmed in {formatSessionTimeZoneLabel(postSessionTimeZone)} time. Tap either time to correct it.
                  </Text>
                  <View style={styles.postSessionTimeRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Session started ${formatSessionTimeLabel(postSessionForm.sessionStart, {
                        sessionDate: data?.workout?.date,
                        timeZone: postSessionTimeZone,
                      })}`}
                      onPress={() => openPostSessionTimePicker('start')}
                      style={({ pressed }) => [styles.postSessionTimeSelection, pressed && styles.postSessionTimeSelectionPressed]}
                    >
                      <View style={styles.postSessionTimeSelectionCopy}>
                        <Text style={styles.postSessionTimeLabel}>Started</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.postSessionTimeValue}>
                          {formatSessionTimeLabel(postSessionForm.sessionStart, {
                            sessionDate: data?.workout?.date,
                            timeZone: postSessionTimeZone,
                          })}
                        </Text>
                      </View>
                      <Ionicons name="calendar-outline" size={20} color={SLColors.accentViolet} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Session ended ${formatSessionTimeLabel(postSessionForm.sessionEnd, {
                        sessionDate: data?.workout?.date,
                        timeZone: postSessionTimeZone,
                      })}`}
                      onPress={() => openPostSessionTimePicker('end')}
                      style={({ pressed }) => [styles.postSessionTimeSelection, pressed && styles.postSessionTimeSelectionPressed]}
                    >
                      <View style={styles.postSessionTimeSelectionCopy}>
                        <Text style={styles.postSessionTimeLabel}>Ended</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.postSessionTimeValue}>
                          {formatSessionTimeLabel(postSessionForm.sessionEnd, {
                            sessionDate: data?.workout?.date,
                            timeZone: postSessionTimeZone,
                          })}
                        </Text>
                      </View>
                      <Ionicons name="time-outline" size={20} color={SLColors.accentViolet} />
                    </Pressable>
                  </View>
                  {postSessionTimeError ? (
                    <Text accessibilityLiveRegion="polite" style={styles.supersetRoundError}>
                      {postSessionTimeError}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.postSessionEffortSection}>
                  <View style={styles.postSessionEffortHeader}>
                    <Text style={styles.surveyLabel}>Session RPE</Text>
                    <Text style={styles.postSessionEffortValue}>{postSessionForm.sessionRpe ?? '—'}</Text>
                  </View>
                  <View style={styles.postSessionEffortEndpoints}>
                    <Text style={styles.postSessionEffortEndpoint}>Easy</Text>
                    <Text style={styles.postSessionEffortEndpoint}>Max effort</Text>
                  </View>
                  <View
                    ref={postSessionEffortRailRef}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Session RPE. Easy to max effort."
                    accessibilityValue={{ text: postSessionForm.sessionRpe == null ? 'Not selected' : `${postSessionForm.sessionRpe} RPE` }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={(event) => setPostSessionEffort((postSessionForm.sessionRpe ?? 6) + (event.nativeEvent.actionName === 'increment' ? 0.5 : -0.5))}
                    onLayout={(event) => {
                      setPostSessionEffortRailWidth(event.nativeEvent.layout.width);
                      measurePostSessionEffortRail();
                    }}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(event) => {
                      measurePostSessionEffortRail();
                      setPostSessionEffortHeld(true);
                      updatePostSessionEffortFromEvent(event);
                    }}
                    onResponderMove={updatePostSessionEffortFromEvent}
                    onResponderRelease={(event) => {
                      updatePostSessionEffortFromEvent(event);
                      setPostSessionEffortHeld(false);
                    }}
                    onResponderTerminate={() => setPostSessionEffortHeld(false)}
                    style={styles.postSessionEffortRailTouchTarget}
                  >
                    <View style={styles.postSessionEffortRail} />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.postSessionEffortRailFill,
                        { width: postSessionEffortRailWidth ? ((postSessionForm.sessionRpe ?? 6) - 6) / 4 * postSessionEffortRailWidth : 0 },
                      ]}
                    />
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.postSessionEffortThumb,
                        {
                          left: postSessionEffortRailWidth ? ((postSessionForm.sessionRpe ?? 6) - 6) / 4 * (postSessionEffortRailWidth - 22) : 0,
                          transform: [{ scale: postSessionEffortThumbScale }],
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Strength</Text>
                  <View style={styles.postSessionSegmentedControl}>
                    {[
                      ['weaker', 'Weaker'],
                      ['normal', 'Normal'],
                      ['stronger', 'Stronger'],
                    ].map(([value, label]) => {
                      const selected = postSessionForm.strengthFeeling === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.postSessionSegment, selected && styles.postSessionSegmentActive]}
                          onPress={() => setPostSessionForm((prev) => ({ ...prev, strengthFeeling: value as any }))}
                          disabled={postSessionSubmitting}
                        >
                          <Text style={[styles.postSessionSegmentText, selected && styles.postSessionSegmentTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Fatigue</Text>
                  <View style={styles.postSessionSegmentedControl}>
                    {[
                      ['low', 'Low'],
                      ['medium', 'Medium'],
                      ['high', 'High'],
                    ].map(([value, label]) => {
                      const selected = postSessionForm.fatigueFeeling === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.postSessionSegment, selected && styles.postSessionSegmentActive]}
                          onPress={() => setPostSessionForm((prev) => ({ ...prev, fatigueFeeling: value as any }))}
                          disabled={postSessionSubmitting}
                        >
                          <Text style={[styles.postSessionSegmentText, selected && styles.postSessionSegmentTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.postSessionNotesSection}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ expanded: postSessionNotesExpanded }}
                    onPress={() => setPostSessionNotesExpanded((expanded) => !expanded)}
                    disabled={postSessionSubmitting}
                    style={styles.postSessionNotesToggle}
                  >
                    <View style={styles.postSessionNotesToggleCopy}>
                      <Text style={styles.postSessionNotesToggleText}>{postSessionNotesExpanded ? 'Hide notes' : 'Add notes'}</Text>
                      {!postSessionNotesExpanded ? <Text style={styles.postSessionNotesPrompt}>Anything worth remembering today?</Text> : null}
                    </View>
                    <Text style={styles.postSessionNotesToggleMark}>{postSessionNotesExpanded ? '−' : '+'}</Text>
                  </TouchableOpacity>
                  {postSessionNotesExpanded ? (
                    <TextInput
                      style={[styles.modalInput, styles.surveyNoteInput]}
                      value={postSessionForm.note}
                      onChangeText={(txt) => setPostSessionForm((prev) => ({ ...prev, note: txt }))}
                      placeholder="Anything worth remembering today?\n\nbench felt explosive\nsleep was poor\nshoulder tightened up\ntechnique clicked today"
                      placeholderTextColor={SLColors.textSubtle}
                      multiline
                      textAlignVertical="top"
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  ) : null}
                </View>
                </ScrollView>

                <View style={[styles.modalActionsRow, styles.postSessionActions, { paddingBottom: Math.max(insets.bottom, SLSpacing.sm) }]}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionPrimary, styles.postSessionCompleteAction]}
                    onPress={submitPostSessionAndComplete}
                    disabled={postSessionSubmitting}
                  >
                    {postSessionSubmitting ? <ActivityIndicator size="small" color={SLColors.textInverted} /> : <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Complete Session</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.postSessionSkipAction}
                    onPress={skipPostSessionAndComplete}
                    disabled={postSessionSubmitting}
                  >
                    <Text style={styles.postSessionSkipActionText}>Skip Reflection</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {postSessionTimePicker != null ? (
                <View style={[styles.modalBackdropCenter, styles.postSessionTimePickerOverlay]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel time changes"
                    onPress={closePostSessionTimePicker}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={[styles.modalCard, styles.postSessionTimePickerCard]}>
                <View style={styles.postSessionTimePickerHeader}>
                  <View>
                    <Text style={styles.postSessionTimePickerTitle}>
                      Session {postSessionTimePicker === 'start' ? 'start' : 'end'}
                    </Text>
                    <Text style={styles.postSessionTimePickerZone}>
                      {formatSessionTimeZoneLabel(postSessionTimeZone)} time
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close time picker"
                    hitSlop={10}
                    onPress={closePostSessionTimePicker}
                    style={styles.postSessionTimePickerClose}
                  >
                    <Ionicons name="close" size={24} color={SLColors.textStrong} />
                  </Pressable>
                </View>

                {postSessionTimePicker && (
                  Platform.OS === 'ios' ? (
                    <>
                      <View style={styles.postSessionNativePickerRow}>
                        <Text style={styles.postSessionNativePickerLabel}>Date</Text>
                        <DateTimePicker
                          value={postSessionTimePickerDraft || new Date()}
                          mode="date"
                          display="compact"
                          themeVariant="dark"
                          timeZoneName={postSessionTimeZone}
                          onChange={(_event, selected) => {
                            if (selected) updatePostSessionTimePickerDraft('date', selected);
                          }}
                        />
                      </View>
                      <View style={styles.postSessionNativePickerRow}>
                        <Text style={styles.postSessionNativePickerLabel}>Time</Text>
                        <DateTimePicker
                          value={postSessionTimePickerDraft || new Date()}
                          mode="time"
                          display="spinner"
                          themeVariant="dark"
                          timeZoneName={postSessionTimeZone}
                          minuteInterval={1}
                          style={styles.postSessionNativeTimePicker}
                          onChange={(_event, selected) => {
                            if (selected) updatePostSessionTimePickerDraft('time', selected);
                          }}
                        />
                      </View>
                    </>
                  ) : (
                    <DateTimePicker
                      value={postSessionTimePickerDraft || new Date()}
                      mode={postSessionTimePickerMode}
                      display="default"
                      timeZoneName={postSessionTimeZone}
                      onChange={(event, selected) => {
                        if (event.type === 'dismissed' || !selected) {
                          closePostSessionTimePicker();
                          return;
                        }
                        const next = updatePostSessionTimePickerDraft(postSessionTimePickerMode, selected);
                        if (postSessionTimePickerMode === 'date') {
                          setPostSessionTimePickerMode('time');
                        } else if (next) {
                          commitPostSessionTimePicker(next);
                        }
                      }}
                    />
                  )
                )}

                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.actionButton, styles.actionPrimary, styles.postSessionTimePickerDone]}
                  onPress={() => commitPostSessionTimePicker()}
                >
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Done</Text>
                </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Shared rest timer picker (popup modal) */}
      <RestTimerPickerModal
        visible={timerPickerVisible}
        timerWheelRef={timerWheelRef}
        timerPickerValue={timerPickerValue}
        setTimerPickerValue={setTimerPickerValue}
        startRestTimer={confirmRestTimerSelection}
        saveConfirmationVisible={feedbackState.recognition.saveConfirmationVisible}
        onMounted={handleTimerPickerMounted}
        onClose={resolveActiveTimerHandoff}
        styles={styles}
      />

      {/* Readiness survey modal (mobile only, shown on Begin Session). */}
      <ReadinessModal
        visible={readinessVisible}
        unit={unit}
        priorBodyweightKg={data?.athlete?.bodyweight_kg}
        values={readinessForm}
        error={readinessError}
        submitting={readinessSubmitting}
        reduceMotion={reduceMotion}
        onChange={setReadinessForm}
        onSubmit={submitReadinessAndBegin}
        onCancel={cancelReadiness}
      />

      {/* Accessory substitution modal */}
      <GovernedAccessoryPickerModal
        visible={swapPickerVisible}
        athleteId={data?.athlete?.id || null}
        title={substitutionAuthority === 'self_governed' ? 'Swap Accessory' : 'Choose Approved Substitute'}
        currentIdentityId={swapAccIdentity?.id || null}
        approvedOnly={substitutionAuthority !== 'self_governed'}
        canCreateCustom={
          substitutionAuthority === 'self_governed'
          && (data?.permissions?.can_create_custom_movement !== false || user?.is_self_coached === true)
        }
        approvedIdentities={(() => {
          const identities = [
            swapAccItem?.movement_identity,
            ...(swapAccItem?.approved_sub_identities || []),
          ].filter((value): value is GeneralMovementIdentity => !!value?.id);
          return [...new Map(identities.map((value) => [Number(value.id), value])).values()] as GovernedAccessoryIdentity[];
        })()}
        onCancel={() => {
          setSwapPickerVisible(false);
          setSwapAccItem(null);
        }}
        onSelect={(identity) => {
          setSwapAccIdentity(identity as GeneralMovementIdentity);
          setSwapPickerVisible(false);
          setSwapAccVisible(true);
        }}
      />

      <SubstitutionConfirmationSheet
        editablePrescription={!!data?.permissions?.can_browse_hot_swap_catalog}
        onBack={() => {
          setSwapAccVisible(false);
          setSwapPickerVisible(true);
        }}
        onCancel={() => setSwapAccVisible(false)}
        onConfirm={saveSwapAcc}
        onRepTargetChange={setSwapRepTarget}
        onRirChange={(rir) => setSwapAccForm((value) => ({ ...value, rir }))}
        onSetsChange={(sets) => setSwapAccForm((value) => ({ ...value, sets }))}
        performingIdentity={swapAccIdentity}
        performingName={swapAccIdentity?.display_name || 'Choose movement'}
        programmedIdentity={swapAccItem?.movement_identity || null}
        programmedName={swapAccItem?.movement || swapAccItem?.original_movement || 'Accessory'}
        repTarget={swapRepTarget}
        rir={swapAccForm.rir}
        saving={savingItemId === swapAccItem?.id}
        sets={swapAccForm.sets}
        visible={swapAccVisible}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: SLColors.textMuted,
    marginTop: 4,
    fontSize: SLTypography.rowTitle.fontSize,
  },

  errorText: {
    color: SLColors.danger,
    textAlign: 'center',
    paddingHorizontal: 24,
    fontSize: SLTypography.body.fontSize,
  },
  coachAthletePreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(143, 178, 154, 0.25)',
    borderRadius: SLRadius.lg,
    backgroundColor: SLColors.surfaceInset,
  },
  coachAthletePreviewCopy: {
    flex: 1,
    minWidth: 210,
    gap: 5,
  },
  coachAthletePreviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  coachAthletePreviewTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },
  coachAthletePreviewBody: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontFamily: SLFontFamilies.sansMedium,
  },
  coachAthletePreviewBack: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.canvasRaised,
  },
  coachAthletePreviewBackPressed: {
    opacity: 0.72,
  },
  coachAthletePreviewBackText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },

  // --- section blocks ---
  sectionBlock: {
    marginBottom: 20,
  },
  preSessionPlanTitle: {
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 0,
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  preSessionPrimaryBeginAction: {
    marginTop: 16,
    width: '100%',
  },
  preSessionBottomBeginAction: {
    marginBottom: 24,
    width: '100%',
  },
  canonicalMovementList: {
    marginTop: 0,
    marginBottom: 0,
    borderWidth: 0,
    borderRadius: SLRadius.none,
    overflow: 'visible',
    backgroundColor: SLColors.background,
  },

  accessorySectionBlock: {
    marginTop: 6,
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '700',
    color: SLColors.textStrong,
    marginBottom: 10,
  },

  coreSchemeDetail: {
    color: SLColors.accentViolet,
    fontWeight: '600',
  },

  // --- accessories ---
  supersetCard: {
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },


  supersetHeader: {
    marginBottom: 8,
  },

  supersetBadge: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  supersetRow: {
    borderRadius: SLRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.055)',
    backgroundColor: 'rgba(24,16,15,0.20)',
  },

  accCard: {
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },

  accCardSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.055)',
    backgroundColor: 'rgba(24,16,15,0.24)',
  },

  accHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  swapInput: {
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.10)',
    borderRadius: SLRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    backgroundColor: 'rgba(24,16,15,0.42)',
    marginBottom: 8,
  },


  accMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    marginBottom: 4,
  },
  accProgressText: {
    color: SLColors.review,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginBottom: 8,
  },
  completedMovementSummary: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(134,239,172,0.10)',
    backgroundColor: 'rgba(134,239,172,0.025)',
  },
  completedMovementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  completedMovementTitle: {
    flex: 1,
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '800',
  },
  completedMovementBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(134,239,172,0.14)',
    backgroundColor: 'rgba(134,239,172,0.045)',
  },
  completedMovementBadgeText: {
    color: SLColors.success,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  completedMovementMeta: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 7,
  },
  completedMovementTop: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 3,
  },
  completedMovementAction: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.22)',
    backgroundColor: 'rgba(91,79,207,0.09)',
  },
  completedMovementActionText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  coachFeedbackCard: {
    marginHorizontal: 8,
    marginTop: 12,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,203,181,0.16)',
    backgroundColor: 'rgba(18,32,28,0.58)',
  },
  preSessionNotesCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginTop: 16,
    marginHorizontal: 0,
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceEmbedded,
  },
  activeSessionNotesCard: {
    marginTop: SLSpacing.md,
  },
  preSessionNotesCopy: {
    flex: 1,
    minWidth: 0,
  },
  preSessionNotesEyebrow: {
    color: SLColors.accentViolet,
  },
  coachFeedbackEyebrow: {
    color: SLColors.success,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  coachFeedbackText: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '600',
  },
  cardMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    marginBottom: 10,
  },


  lookbackText: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 8,
  },
  movementHistoryButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.24)',
    backgroundColor: 'rgba(91,79,207,0.10)',
  },
  movementHistoryButtonText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },

  setLogsBlock: {
    marginTop: 4,
  },
  setLogLine: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(10,14,28,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.06)',
    overflow: 'hidden', // important for accent bar
  },

  setLogLineActive: {
    borderColor: 'rgba(134,239,172,0.12)',
    backgroundColor: 'rgba(134,239,172,0.025)',
    paddingVertical: 12,
  },

  setLogLineLatest: {
    borderColor: 'rgba(148,163,184,0.12)',
    paddingVertical: 8,
    backgroundColor: 'rgba(15,20,36,0.46)',
  },

  setLogAccent: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: SLColors.success,
    opacity: 0.72,
  },

  setLogAccentMuted: {
    backgroundColor: 'rgba(148,163,184,0.4)',
    opacity: 0.4,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  logHint: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.label.fontSize,
    marginTop: 6,
    lineHeight: 18,
  },
  setVideoRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  setVideoStatus: {
    flex: 1,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  setVideoStatusAttached: {
    color: SLColors.success,
  },
  setVideoStatusError: {
    color: SLColors.danger,
  },
  setVideoPreviewTile: {
    flex: 1,
    minHeight: 54,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(134,239,172,0.14)',
    backgroundColor: 'rgba(15,23,42,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  setVideoPlayBadge: {
    width: 38,
    height: 38,
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(134,239,172,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setVideoPlayText: {
    color: SLColors.success,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
  },
  setVideoMeta: {
    flex: 1,
    minWidth: 0,
  },
  setVideoTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    marginBottom: 2,
  },
  setVideoAngleText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    marginBottom: 2,
  },
  setVideoActions: {
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
  },
  setVideoButton: {
    minHeight: 32,
    minWidth: 96,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.32)',
    backgroundColor: 'rgba(129,140,248,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  setVideoButtonDisabled: {
    opacity: 0.65,
  },
  setVideoButtonText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  setVideoRemoveButton: {
    borderColor: 'rgba(248,113,113,0.34)',
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  setVideoRemoveButtonText: {
    color: SLColors.danger,
  },
  videoPlayerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  videoPlayerSheet: {
    width: '100%',
    maxWidth: 760,
    height: '92%',
    maxHeight: 860,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: SLColors.background,
    overflow: 'hidden',
  },
  videoPlayerCloseText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  videoPlayerFrame: {
    width: '100%',
    height: '100%',
    backgroundColor: SLColors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayerView: {
    width: '100%',
    height: '100%',
  },
  videoHudTopLeft: {
    position: 'absolute',
    left: 10,
    maxWidth: '58%',
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.22)',
    backgroundColor: 'rgba(8,12,22,0.66)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...SLShadows.level3,
  },
  videoHudBottomLeft: {
    position: 'absolute',
    left: 10,
    bottom: 66,
    maxWidth: '68%',
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.22)',
    backgroundColor: 'rgba(8,12,22,0.68)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
    ...SLShadows.level3,
  },
  videoHudCloseButton: {
    position: 'absolute',
    right: 10,
    width: 32,
    height: 32,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.22)',
    backgroundColor: 'rgba(8,12,22,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SLShadows.level3,
  },
  videoHudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoHudKicker: {
    color: SLColors.success,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  videoHudTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
    marginTop: 3,
    lineHeight: 17,
  },
  videoHudSubtext: {
    color: SLColors.text,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    marginTop: 2,
    lineHeight: 14,
  },
  videoHudStatusText: {
    color: SLColors.success,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.2)',
    backgroundColor: 'rgba(22,101,52,0.28)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  videoHudLine: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    lineHeight: 15,
  },
  videoHudLabel: {
    color: SLColors.success,
    fontWeight: '900',
  },
  videoPlayerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  videoPlayerOverlayText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    marginTop: 10,
  },
  videoPlayerErrorText: {
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  videoPlayerRetryButton: {
    minHeight: 36,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.36)',
    backgroundColor: 'rgba(129,140,248,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 12,
  },
  videoPlayerRetryText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  logVideoSelectedText: {
    flexBasis: '100%',
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  logVideoSelectedBlock: {
    flexBasis: '100%',
    gap: 8,
  },
  logVideoAngleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  logVideoAngleChip: {
    minHeight: 30,
    paddingHorizontal: 9,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,23,42,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logVideoAngleChipActive: {
    borderColor: 'rgba(129,140,248,0.46)',
    backgroundColor: 'rgba(91,79,207,0.26)',
  },
  logVideoAngleChipText: {
    color: SLColors.text,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  logVideoAngleChipTextActive: {
    color: SLColors.text,
  },
  logVideoIntentGroup: {
    marginTop: 8,
    gap: 8,
  },
  logVideoIntentTitle: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  logVideoIntentOption: {
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,23,42,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  logVideoIntentOptionActive: {
    borderColor: 'rgba(129,140,248,0.48)',
    backgroundColor: 'rgba(91,79,207,0.24)',
  },
  logVideoIntentOptionTitle: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  logVideoIntentOptionTitleActive: {
    color: SLColors.text,
  },
  logVideoIntentOptionBody: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    marginTop: 3,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: SLRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  unitToggleRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  unitToggleRowInline: {
    justifyContent: 'center',
  },
  timerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerLabelInline: {
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '600',
    color: SLColors.text,
    minWidth: 44,
    textAlign: 'right',
  },
  unitToggleOption: {
    minWidth: 50,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBar: {
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerLabel: {
    flex: 1,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '600',
    color: SLColors.text,
  },
  timerButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  timerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  timerPicker: {
    width: '92%',
    maxWidth: 420,
    borderRadius: SLRadius.xl,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(10,14,28,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(109,91,208,0.10)',
    alignSelf: 'center',
    ...SLShadows.shadowSheet,
  },
  timerPickerTitle: {
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
    color: SLColors.text,
    marginBottom: 8,
  },
  timerOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timerOptionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    backgroundColor: SLColors.surfaceRaised,
  },
  timerOptionText: {
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '600',
    color: SLColors.text,
  },
  timerPickerCancel: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  timerWheelWrap: {
    marginTop: 18,
    marginBottom: 0,
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(24,16,15,0.36)',
    overflow: 'hidden',
    height: 220,
    position: 'relative',
  },
  timerWheel: {
    height: 220,
    zIndex: 1,
  },
  timerWheelContent: {
    paddingVertical: 88,
  },
  timerWheelOption: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.62,
  },
  timerWheelOptionActive: {
    opacity: 1,
    backgroundColor: 'transparent',
  },

  swapModalWide: {
    width: '92%',
    maxWidth: 520,
  },
  movementHistorySheet: {
    backgroundColor: SLColors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: '82%',
  },
  movementHistoryFullScreenSheet: {
    height: '94%',
    maxHeight: '94%',
  },
  equipmentPickerSheet: {
    height: '90%',
    maxHeight: '90%',
  },
  movementHistoryCloseIcon: {
    alignItems: 'center',
    borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  movementHistoryDossierScroll: {
    flex: 1,
    minHeight: 0,
  },
  movementHistoryDossierContent: {
    paddingBottom: SLSpacing.md,
  },
  movementHistoryEquipmentHero: {
    backgroundColor: 'rgba(20, 12, 24, 0.96)',
    borderColor: 'rgba(190, 140, 255, 0.36)',
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    gap: 12,
    marginTop: 14,
    overflow: 'hidden',
    padding: 14,
  },
  movementHistoryEquipmentHeroTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  movementHistoryCurrentBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(190, 140, 255, 0.08)',
    borderColor: 'rgba(190, 140, 255, 0.24)',
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  movementHistoryCurrentDot: {
    backgroundColor: '#BE8CFF',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  movementHistoryCurrentText: {
    color: '#D9B8FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  movementHistoryEquipmentHeroIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  movementHistoryEquipmentHeroName: {
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 25,
  },
  movementHistoryEquipmentHeroManufacturer: {
    color: '#CDA3FF',
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    marginTop: 3,
  },
  movementHistoryMetadataChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  movementHistoryMetadataChip: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  movementHistoryMetadataChipText: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  movementHistoryManufacturerAnchor: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderColor: 'rgba(167,139,250,0.16)',
    borderRadius: SLRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 10,
  },
  movementHistoryManufacturerCopy: {
    flex: 1,
    minWidth: 0,
  },
  movementHistoryManufacturerEyebrow: {
    color: SLColors.primary,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  movementHistoryManufacturerName: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
    lineHeight: 18,
    marginTop: 2,
  },
  movementHistoryManufacturerModel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    marginTop: 1,
  },
  movementHistoryAssistNote: {
    color: SLColors.warning,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    marginTop: 8,
  },
  movementHistoryStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  movementHistorySummaryTile: {
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 128,
    padding: 13,
  },
  movementHistorySummaryTileRecent: {
    backgroundColor: 'rgba(24, 12, 31, 0.92)',
    borderColor: 'rgba(190, 140, 255, 0.28)',
  },
  movementHistorySummaryTileBest: {
    backgroundColor: 'rgba(7, 22, 18, 0.92)',
    borderColor: 'rgba(85, 205, 157, 0.28)',
  },
  movementHistorySummaryLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  movementHistorySummaryLabel: {
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  movementHistorySummaryLabelRecent: { color: '#CDA3FF' },
  movementHistorySummaryLabelBest: { color: '#76D6AD' },
  movementHistorySummaryPerformance: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    marginTop: 13,
  },
  movementHistorySummaryWeight: {
    color: SLColors.textStrong,
    flexShrink: 1,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  movementHistorySummaryReps: {
    color: SLColors.textSecondary,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 17,
    fontWeight: '700',
  },
  movementHistorySummaryMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  movementHistorySummaryEffort: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  movementHistorySummaryDate: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  movementHistorySummaryEmpty: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    marginTop: 24,
  },
  movementHistoryStatCard: {
    flex: 1,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.72)',
    padding: 12,
  },
  movementHistoryLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  movementHistoryValue: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontWeight: '800',
  },
  movementHistorySectionTitle: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  movementHistoryExactRail: {
    gap: 10,
    paddingRight: 18,
  },
  movementHistoryExactCard: {
    backgroundColor: 'rgba(17, 13, 20, 0.96)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: SLRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 7,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 11,
    width: 228,
  },
  movementHistoryExactPerformance: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
  },
  movementHistoryExactWeight: {
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 18,
    fontWeight: '700',
  },
  movementHistoryExactReps: {
    color: SLColors.textSecondary,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 16,
    fontWeight: '700',
  },
  movementHistoryExactEffort: {
    color: '#CDA3FF',
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  movementHistoryExactDate: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  movementHistoryList: {
    maxHeight: 260,
  },
  equipmentPickerList: {
    flex: 1,
    maxHeight: '100%',
    minHeight: 0,
  },
  equipmentPickerHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  equipmentPickerHeaderCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  equipmentPickerHeaderAction: {
    alignItems: 'center',
    backgroundColor: SLColors.surface,
    borderColor: SLColors.border,
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  equipmentVariantManufacturer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    paddingBottom: 18,
  },
  equipmentVariantManufacturerName: {
    color: SLColors.textStrong,
    flex: 1,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
  },
  equipmentVariantOptions: {
    gap: 10,
  },
  equipmentVariantRow: {
    alignItems: 'center',
    backgroundColor: SLColors.surface,
    borderColor: SLColors.border,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 66,
    paddingHorizontal: 18,
  },
  equipmentVariantLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
  },
  movementHistoryExpandedList: {
    flex: 1,
    maxHeight: '100%',
    minHeight: 0,
  },
  movementHistoryListContent: {
    paddingBottom: SLSpacing.sm,
  },
  movementHistoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    marginBottom: 8,
  },
  movementHistoryRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  movementHistoryRowManufacturer: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  movementHistoryDate: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  movementHistoryRowValue: {
    flex: 1,
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'right',
  },
  movementHistoryEmpty: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    padding: 12,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  movementHistoryRelatedTitle: {
    color: SLColors.text,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
  },
  movementHistoryRelatedHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  movementHistoryRelatedCount: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  movementHistoryRelatedGuidance: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    marginTop: 6,
  },
  movementHistoryRelatedNote: {
    color: SLColors.textMuted,
    flex: 1,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
  },
  movementHistoryEquipmentRail: {
    gap: 12,
    paddingRight: 18,
    paddingTop: 11,
  },
  movementHistoryEquipmentCard: {
    backgroundColor: 'rgba(14, 11, 17, 0.98)',
    borderColor: 'rgba(190, 140, 255, 0.22)',
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    gap: 11,
    minHeight: 222,
    overflow: 'hidden',
    padding: 13,
    width: 288,
  },
  movementHistoryEquipmentIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  movementHistoryEquipmentCopy: {
    flex: 1,
    minWidth: 0,
  },
  movementHistoryEquipmentName: {
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
  },
  movementHistoryEquipmentManufacturer: {
    color: '#CDA3FF',
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    marginTop: 3,
  },
  movementHistoryEquipmentDivider: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    height: StyleSheet.hairlineWidth,
  },
  movementHistoryEquipmentPerformance: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
  },
  movementHistoryEquipmentWeight: {
    color: SLColors.textStrong,
    flexShrink: 1,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  movementHistoryEquipmentReps: {
    color: SLColors.textSecondary,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 19,
    fontWeight: '700',
  },
  movementHistoryEquipmentEffortBadge: {
    backgroundColor: 'rgba(190, 140, 255, 0.08)',
    borderColor: 'rgba(190, 140, 255, 0.20)',
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  movementHistoryEquipmentEffort: {
    color: '#D4B1FF',
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  movementHistoryEquipmentDate: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginTop: 8,
  },
  movementHistoryEquipmentEmpty: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    marginTop: 8,
  },
  movementHistoryRelatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(15,23,42,0.38)',
    marginBottom: 8,
  },
  movementHistoryRelatedCopy: {
    flex: 1,
    gap: 2,
  },
  movementHistoryRelatedName: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '800',
  },
  identityPickerInput: {
    marginTop: 14,
    marginBottom: 10,
    minHeight: 46,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surface,
    color: SLColors.textStrong,
    paddingHorizontal: 14,
    fontSize: SLTypography.body.fontSize,
  },
  equipmentPickerMovementContext: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: SLSpacing.md,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  equipmentPickerMovementKicker: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  equipmentPickerMovementTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
    marginTop: 2,
  },
  equipmentPickerMovementMeta: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  identityPickerRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLColors.border,
  },
  identityPickerRowCurrent: {
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.42)',
    backgroundColor: 'rgba(124,58,237,0.08)',
    paddingHorizontal: 10,
  },
  identityPickerCopy: {
    flex: 1,
    gap: 4,
  },
  identityPickerManufacturer: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  identityPickerStatus: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  identityPickerCurrent: {
    color: SLColors.success,
  },
  identityPickerTitle: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  identityPickerMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    marginTop: 3,
  },
  readinessScaleRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  // Shared modal form helper styles (used in timer/readiness/edit-set modals)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.70)',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalSubtitle: {
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    color: SLColors.accentViolet,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalBody: {
    color: SLColors.textMuted,
    marginBottom: 14,
    lineHeight: 20,
    fontSize: SLTypography.rowTitle.fontSize,
    textAlign: 'left',
  },
  modalBtnGhost: {
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderColor: 'rgba(148,163,184,0.18)',
  },
  modalFieldBlock: {
    marginBottom: 10,
  },
  editSetModalWide: {
    width: '100%',
    maxWidth: 600,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalFieldInline: {
    flex: 1,
  },
  modalLabel: {
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    color: SLColors.review,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  postSessionModal: {
    width: '95%',
    maxWidth: 520,
    maxHeight: '88%',
    alignSelf: 'center',
    flexShrink: 1,
    overflow: 'hidden',
    paddingTop: SLSpacing.lg,
  },
  postSessionBackdrop: {
    alignItems: 'center',
  },
  postSessionScroll: {
    flexShrink: 1,
  },
  postSessionScrollContent: {
    paddingBottom: SLSpacing.sm,
  },
  postSessionReflectionTitle: {
    textAlign: 'left',
    marginBottom: 2,
  },
  postSessionReflectionSubtitle: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '700',
  },
  sessionCompletePromptIcon: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: SLRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.52)',
    backgroundColor: 'rgba(6,78,59,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SLSpacing.sm,
  },
  postSessionTimeSection: {
    marginTop: SLSpacing.lg,
    paddingTop: SLSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SLColors.border,
  },
  postSessionTimeHint: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 18,
    marginBottom: SLSpacing.sm,
  },
  postSessionTimeLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  postSessionTimeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SLSpacing.sm,
    marginBottom: SLSpacing.sm,
  },
  postSessionTimeSelection: {
    flex: 1,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.surface,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  postSessionTimeSelectionPressed: {
    borderColor: SLColors.accentViolet,
    backgroundColor: SLColors.surfaceMuted,
  },
  postSessionTimeSelectionCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: SLSpacing.xs,
  },
  postSessionTimeValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '800',
  },
  postSessionTimePickerCard: {
    width: '100%',
    maxWidth: 420,
  },
  postSessionTimePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  postSessionTimePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SLSpacing.lg,
  },
  postSessionTimePickerTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
  },
  postSessionTimePickerZone: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    marginTop: 2,
  },
  postSessionTimePickerClose: {
    width: 40,
    height: 40,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceMuted,
  },
  postSessionNativePickerRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SLColors.border,
  },
  postSessionNativePickerLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
  },
  postSessionNativeTimePicker: {
    flex: 1,
    height: 150,
  },
  postSessionTimePickerDone: {
    marginTop: SLSpacing.lg,
  },
  postSessionEffortSection: {
    marginTop: 22,
  },
  postSessionEffortHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  postSessionEffortValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
  },
  postSessionEffortEndpoints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  postSessionEffortEndpoint: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  postSessionEffortRailTouchTarget: {
    height: 42,
    justifyContent: 'center',
  },
  postSessionEffortRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.borderStrong,
  },
  postSessionEffortRailFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.accent,
  },
  postSessionEffortThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: SLRadius.pill,
    borderWidth: 3,
    borderColor: SLColors.backgroundRaised,
    backgroundColor: SLColors.accent,
  },
  postSessionSegmentedControl: {
    minHeight: 50,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.md,
    overflow: 'hidden',
    backgroundColor: SLColors.surface,
  },
  postSessionSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  postSessionSegmentActive: {
    backgroundColor: SLColors.surfaceMuted,
  },
  postSessionSegmentText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  postSessionSegmentTextActive: {
    color: SLColors.textStrong,
  },
  postSessionNotesSection: {
    marginTop: 12,
  },
  postSessionNotesToggle: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postSessionNotesToggleCopy: {
    flex: 1,
    paddingRight: SLSpacing.md,
  },
  postSessionNotesToggleText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  postSessionNotesPrompt: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    marginTop: 2,
  },
  postSessionNotesToggleMark: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '500',
  },
  postSessionActions: {
    flexDirection: 'column',
    marginTop: 12,
  },
  postSessionCompleteAction: {
    width: '100%',
  },
  postSessionSkipAction: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postSessionSkipActionText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  incompleteCompleteModal: {
    width: '92%',
    maxWidth: 520,
    alignItems: 'stretch',
  },
  incompleteWarningIcon: {
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: SLRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.58)',
    backgroundColor: 'rgba(120,53,15,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  incompleteWarningIconText: {
    color: SLColors.warning,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
  },
  incompleteCompleteCopy: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  incompleteMissingListFrame: {
    maxHeight: 220,
    marginTop: 16,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    backgroundColor: 'rgba(15,23,42,0.62)',
    overflow: 'hidden',
  },
  incompleteMissingList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  incompleteMissingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  incompleteMissingBullet: {
    color: SLColors.warning,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 20,
    fontWeight: '900',
  },
  incompleteMissingText: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '800',
  },
  surveySection: {
    marginTop: 14,
  },
  surveyChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  surveyChoiceStack: {
    gap: 8,
  },
  surveyNoteInput: {
    minHeight: 96,
    paddingTop: 12,
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  completionCeremonyScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: SLColors.black,
  },
  timerBarWrapper: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    paddingTop: 14,
  },

  scrollShell: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bodyRecoveryOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 132,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    backgroundColor: SLColors.black,
  },
  bodyRecoveryTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontFamily: SLFontFamilies.sansBold,
    textAlign: 'center',
  },
  bodyRecoveryBody: {
    color: SLColors.textMuted,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansMedium,
    lineHeight: 21,
    textAlign: 'center',
  },
  bodyRecoveryButton: {
    minHeight: 48,
    minWidth: 210,
    marginTop: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.lg,
    backgroundColor: SLColors.accentViolet,
  },
  bodyRecoveryButtonPressed: {
    opacity: 0.78,
  },
  bodyRecoveryButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontFamily: SLFontFamilies.sansBold,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  movementCardPreSession: {
    backgroundColor: 'rgba(10,14,28,0.24)',
    borderColor: 'rgba(148,163,184,0.055)',
  },
  movementCardFinished: {
    backgroundColor: 'rgba(12,16,32,0.24)',
    borderColor: 'rgba(129,140,248,0.09)',
  },
  coreScheme: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '500',
    marginBottom: 10,
    lineHeight: 19,
  },
  coreTarget: {
    fontSize: SLTypography.label.fontSize,
    color: SLColors.review,
    marginTop: 4,
  },

  actualText: {
    fontSize: SLTypography.label.fontSize,
    color: SLColors.success,
    marginTop: 4,
  },
  supersetCardSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.055)',
    backgroundColor: 'rgba(12,16,32,0.24)',
  },
  swapPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(91,79,207,0.7)',
    backgroundColor: 'rgba(91,79,207,0.12)',
  },
  swapPillText: {
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    color: SLColors.review,
  },
  accessoryInlineAction: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: SLRadius.radiusRow,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: 'transparent',
  },
  accessoryInlineActionText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  currentEquipmentContext: {
    marginTop: 16,
    marginHorizontal: 26,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(167,139,250,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentEquipmentContextRequired: {
    borderColor: 'rgba(251,146,60,0.28)',
  },
  currentEquipmentCopy: {
    flex: 1,
    gap: 2,
  },
  currentEquipmentEyebrow: {
    color: SLColors.review,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  currentEquipmentName: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 20,
    fontWeight: '900',
  },
  currentEquipmentMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
  },
  swapOptionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,20,36,0.55)',
  },

  swapOptionScroll: {
    maxHeight: 230,
    marginTop: SLSpacing.sm,
  },

  swapOptionList: {
    gap: SLSpacing.md,
    paddingBottom: SLSpacing.sm,
  },

  swapOptionGroup: {
    gap: SLSpacing.xs,
  },

  swapOptionGroupTitle: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },

  swapOptionButtonActive: {
    borderColor: 'rgba(109,91,208,0.22)',
    backgroundColor: 'rgba(109,91,208,0.08)',
  },

  swapOptionText: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '600',
  },

  swapOptionTextActive: {
    color: SLColors.text,
  },
  accTitle: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '600',
    letterSpacing: -0.1,
    flex: 1,
  },
  accRir: {
    color: SLColors.warning,
  },
  setLabel: {
    color: SLColors.review,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    marginBottom: 4,
  },

  setTargetInline: {
    color: SLColors.review,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '600',
    marginTop: 2,
  },
  logInput: {
    flex: 1,
    height: 44,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(15,20,36,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    paddingHorizontal: 12,
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '600',
  },

  logInputActive: {
    borderColor: 'rgba(109,91,208,0.22)',
    backgroundColor: 'rgba(15,20,36,0.86)',
  },

  logButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(91,79,207,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SLShadows.shadowSoft,
  },

  logButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  coreWheelButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.28)',
    backgroundColor: 'rgba(91,79,207,0.92)',
  },
  coreWheelButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  coreRepeatLastButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.24)',
    backgroundColor: 'rgba(91,79,207,0.10)',
  },
  coreRepeatLastButtonText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickActionPanel: {
    marginTop: 10,
    marginBottom: 8,
    gap: 8,
  },
  quickActionGroup: {
    gap: 6,
  },
  quickActionLabel: {
    color: SLColors.textSubtle,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.20)',
    backgroundColor: 'rgba(91,79,207,0.09)',
  },
  quickChipText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  undoButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.9)',
    backgroundColor: 'transparent',
  },
  undoButtonText: {
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '600',
    color: SLColors.danger,
  },
  actionPrimary: {
    backgroundColor: SLColors.accent,
    borderColor: SLColors.accent,
    ...SLShadows.raised,
  },
  actionButtonText: {
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  actionPrimaryText: {
    color: SLColors.textInverted,
  },
  unitTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SLColors.surfaceFlat,
    borderRadius: SLRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },

  unitToggleOptionActive: {
    backgroundColor: SLColors.accent,
    ...SLShadows.shadowSoft,
  },
  unitToggleText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    textTransform: 'lowercase',
  },

  unitToggleTextActive: {
    color: SLColors.textInverted,
  },
  timerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,20,36,0.18)',
  },
  timerStopButton: {
    borderColor: 'rgba(239,68,68,0.24)',
    backgroundColor: 'rgba(127,29,29,0.20)',
  },
  timerButtonText: {
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '600',
    color: SLColors.text,
  },
  timerWheelText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '700',
  },
  timerWheelTextActive: {
    color: SLColors.textStrong,
    fontSize: 23,
    fontWeight: '900',
  },
  timerWheelCenterIndicator: {
    position: 'absolute',
    top: 88,
    left: 6,
    right: 6,
    height: 44,
    borderRadius: SLRadius.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.surfaceSelected,
    zIndex: 0,
  },
  errorBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.7)',
    backgroundColor: 'rgba(127,29,29,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
  },
  errorBannerClose: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.6)',
    backgroundColor: 'rgba(127,29,29,0.6)',
  },
  errorBannerCloseText: {
    color: SLColors.danger,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  actionSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
    backgroundColor: 'rgba(9,14,25,0.70)',
  },
  actionSecondaryText: {
    color: SLColors.text,
  },
  inlineEditButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.35)',
    backgroundColor: 'rgba(129,140,248,0.10)',
  },
  modalCard: {
    borderRadius: SLRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    backgroundColor: 'rgba(9,14,25,0.98)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    ...SLShadows.shadowSheet,
  },
  coreWheelBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,6,23,0.70)',
  },
  coreWheelBackdropHit: {
    flex: 1,
  },
  restTimerPickerBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SLSpacing.lg,
  },
  restTimerPickerBackdropHit: {
    ...StyleSheet.absoluteFillObject,
  },
  coreWheelSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(148,163,184,0.24)',
    backgroundColor: 'rgba(9,14,25,0.98)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  restTimerPickerSheet: {
    alignSelf: 'stretch',
    maxWidth: 520,
    borderRadius: SLRadius.radiusSheet,
    borderBottomWidth: 1,
  },
  editSetKeyboardAvoider: {
    flex: 1,
  },
  editSetWheelSheet: {
    maxHeight: '88%',
    paddingBottom: 0,
  },
  editSetScroll: {
    flexGrow: 0,
  },
  editSetScrollContent: {
    paddingBottom: SLSpacing.lg,
  },
  supersetRoundSheet: {
    maxHeight: '88%',
    backgroundColor: SLColors.surfaceFloating,
    borderColor: SLColors.borderStrong,
  },
  supersetRoundContextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.md,
  },
  supersetRoundContext: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  supersetRoundStep: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    letterSpacing: 0.65,
  },
  supersetRoundStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    marginTop: 4,
  },
  supersetRoundCapturedCue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  supersetRoundCapturedCueText: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  supersetRoundProgress: {
    flexDirection: 'row',
    gap: 6,
    marginTop: SLSpacing.lg,
  },
  supersetRoundProgressMark: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    height: 7,
    overflow: 'hidden',
    width: 22,
  },
  supersetRoundProgressFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SLColors.accentViolet,
    borderRadius: SLRadius.pill,
  },
  supersetRoundStepContent: {
    overflow: 'hidden',
  },
  supersetRoundMovementHeader: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    marginTop: SLSpacing.lg,
    padding: SLSpacing.md,
  },
  supersetRoundEntryNumber: {
    alignItems: 'center',
    backgroundColor: SLColors.accentSoft,
    borderColor: SLColors.borderFocus,
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  supersetRoundEntryNumberText: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  supersetRoundEntryCopy: {
    flex: 1,
    minWidth: 0,
  },
  supersetRoundEntryTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '800',
    lineHeight: 22,
  },
  supersetRoundEntryPrescription: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    marginTop: 3,
  },
  supersetRoundLoggedPill: {
    alignItems: 'center',
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: SLSpacing.sm,
    paddingVertical: 5,
  },
  supersetRoundLoggedPillText: {
    color: SLColors.success,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  supersetRoundSkippedPill: {
    alignItems: 'center',
    backgroundColor: SLColors.warningSoft,
    borderColor: SLColors.warning,
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: SLSpacing.sm,
    paddingVertical: 5,
  },
  supersetRoundSkippedPillText: {
    color: SLColors.warning,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  supersetRoundLoggedResult: {
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.numeric,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '700',
  },
  supersetRoundLoggedSummary: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.success,
    borderRadius: SLRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: SLSpacing.xl,
    padding: SLSpacing.lg,
  },
  supersetRoundSkippedSummary: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.warning,
    borderRadius: SLRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: SLSpacing.xl,
    padding: SLSpacing.lg,
  },
  supersetRoundLoggedNotice: {
    color: SLColors.textSecondary,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    marginTop: SLSpacing.sm,
  },
  supersetRoundSave: {
    flex: 1.45,
  },
  supersetRoundSecondaryAction: {
    flex: 0.8,
  },
  supersetRoundActionDisabled: {
    opacity: 0.48,
  },
  supersetRoundError: {
    backgroundColor: SLColors.dangerSoft,
    borderColor: SLColors.danger,
    borderRadius: SLRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    marginTop: SLSpacing.md,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
    textAlign: 'left',
  },
  supersetRoundEscapeActions: {
    flexDirection: 'row',
    gap: SLSpacing.sm,
    marginTop: SLSpacing.md,
  },
  supersetRoundEscapeAction: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.borderStrong,
    borderRadius: SLRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: SLSpacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: SLSpacing.sm,
  },
  supersetRoundEscapeActionText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  coreWheelHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(148,163,184,0.38)',
    marginBottom: 14,
  },
  coreWheelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  coreWheelHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  coreWheelTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'left',
  },
  coreWheelSubtitle: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'left',
    marginTop: 4,
  },
  coreWheelActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  coreWheelSubmit: {
    flex: 1.45,
    minHeight: 54,
  },
  coreWheelFailedToggle: {
    marginTop: SLSpacing.lg,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderColor: 'rgba(248,113,113,0.28)',
  },
  repeatLastSetAction: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    marginTop: SLSpacing.md,
    minHeight: 52,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  repeatLastSetActionDisabled: {
    opacity: 0.62,
  },
  repeatLastSetCopy: {
    flex: 1,
    minWidth: 0,
  },
  repeatLastSetTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  repeatLastSetSubtitle: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    marginTop: 2,
  },
  logSheetSubmit: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  logSheetSubmitPressed: {
    transform: [{ scale: 0.975 }],
    opacity: 0.88,
  },
  logSheetSubmitAccepted: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  logSheetSubmitFailure: {
    backgroundColor: SLColors.dangerSoft,
    borderColor: SLColors.danger,
  },
  failedSetToggle: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.42)',
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderRadius: SLRadius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  failedSetToggleActive: {
    borderColor: 'rgba(248,113,113,0.72)',
    backgroundColor: 'rgba(127,29,29,0.46)',
  },
  failedSetToggleText: {
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  failedSetToggleTextActive: {
    color: SLColors.danger,
  },
  modalSheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 4,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(148,163,184,0.46)',
    marginBottom: 14,
  },
  modalSectionKicker: {
    color: SLColors.review,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 2,
  },
  loggedSummaryPill: {
    minHeight: 52,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(5,10,20,0.74)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  loggedSummaryIcon: {
    width: 24,
    height: 24,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.76)',
  },
  loggedSummaryIconText: {
    color: SLColors.accent,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  loggedSummaryLabel: {
    color: SLColors.success,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  loggedSummaryValue: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    textAlign: 'right',
  },
  modalValueCard: {
    minHeight: 88,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(5,10,20,0.74)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  modalValueInput: {
    color: SLColors.textStrong,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
    padding: 0,
    margin: 0,
  },
  modalValueUnit: {
    color: SLColors.review,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
    textAlign: 'right',
  },
  modalHelperLine: {
    color: SLColors.review,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
  },
  swapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swapHeaderSpacer: {
    width: 34,
  },
  swapCloseButton: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapCloseText: {
    color: SLColors.text,
    fontSize: SLTypography.hero.fontSize,
    lineHeight: 30,
    fontWeight: '300',
  },
  swapMovementField: {
    minHeight: 54,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    backgroundColor: 'rgba(5,10,20,0.74)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  swapSearchIcon: {
    color: SLColors.text,
    fontSize: SLTypography.screenTitle.fontSize,
    fontWeight: '500',
  },
  swapMovementInput: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '700',
    paddingVertical: 0,
  },
  swapClearText: {
    color: SLColors.text,
    fontSize: 25,
    fontWeight: '400',
  },
  swapPrescriptionCard: {
    minHeight: 88,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(5,10,20,0.74)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  swapPrescriptionInput: {
    color: SLColors.textStrong,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    padding: 0,
    margin: 0,
  },
  swapRepModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  swapRepMode: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: SLColors.borderStandard,
    backgroundColor: SLColors.surfaceFlat,
  },
  swapRepModeActive: {
    borderColor: SLColors.accent,
    backgroundColor: 'rgba(125, 55, 205, 0.28)',
  },
  swapRepModeText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  swapSummaryCard: {
    marginTop: 16,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.48)',
    backgroundColor: 'rgba(13,148,136,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  swapSummaryIcon: {
    color: SLColors.accent,
    fontSize: 25,
    fontWeight: '900',
  },
  swapSummaryCopy: {
    flex: 1,
  },
  swapSummaryTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 19,
    fontWeight: '800',
  },
  swapSummaryText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 3,
  },
  modalTitle: {
    color: SLColors.text,
    marginBottom: 6,
    fontWeight: '700',
    fontSize: SLTypography.sectionTitle.fontSize,
    letterSpacing: -0.2,
    textAlign: 'left',
  },
  modalBtnDanger: {
    backgroundColor: 'rgba(127,29,29,0.92)',
    borderColor: 'rgba(239,68,68,0.32)',
  },
  modalBtnText: {
    color: SLColors.text,
    fontWeight: '700',
    fontSize: SLTypography.rowTitle.fontSize,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: SLColors.border,
    borderRadius: SLRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    backgroundColor: SLColors.surface,
  },
  postSessionTitle: {
    fontSize: SLTypography.screenTitle.fontSize,
    lineHeight: 30,
    fontWeight: '900',
    color: SLColors.textStrong,
    marginBottom: 8,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  surveyLabel: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
    marginBottom: 8,
  },
  surveyChip: {
    flex: 1,
    height: 36,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surveyChipActive: {
    backgroundColor: SLColors.text,
    borderColor: SLColors.text,
  },
  surveyChipText: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
  },
  surveyChipTextActive: {
    color: SLColors.surface,
  },
  surveyChoiceButton: {
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  surveyChoiceButtonActive: {
    borderColor: SLColors.text,
    backgroundColor: SLColors.surfaceMuted,
  },
  surveyChoiceText: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '600',
  },
  surveyChoiceTextActive: {
    color: SLColors.text,
  },
  actionDanger: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.24)',
    borderWidth: 1,
  },
  actionDangerText: {
    color: SLColors.danger,
    fontWeight: '700',
  },
});
