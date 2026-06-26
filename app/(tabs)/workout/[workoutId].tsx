// app/(tabs)/workout/[workoutId].tsx
// @ts-nocheck

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  findNodeHandle,
  UIManager,
} from 'react-native';
let Notifications: any = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
let VideoThumbnails: any = null;
try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch (_) {
  VideoThumbnails = null;
}
import RefreshScreen from '@/components/refresh-screen';
import SetVideoPlayerModal, {
  type SetVideoSummary,
} from '@/components/SetVideoPlayerModal';
import {
  type ActiveMovementDetailRow,
  CoreMovementLedgerRow,
  CoreSchemeDetail,
  type MovementLoggerFocusModel,
  type SetRailStep,
} from '@/components/workout-logger/core-loggers';
import {
  CancelResumeModal,
  RestTimerPickerModal,
  TardyReasonModal,
} from '@/components/workout-logger/logger-modals';
import {
  LogSheetUnitToggle,
} from '@/components/workout-logger/logger-primitives';
import {
  SessionCommandStrip,
  SessionIntentPanel,
  type WorkoutProgressSetSegment,
} from '@/components/workout-logger/session-shell';
import { useAuth } from '@/context/AuthContext';
import { API_BASE, fetchJson, removeVideoAttachment } from '@/lib/api';
import {
  cancelVideoUploadJob,
  enqueueVideoUpload,
  processVideoUploadQueue,
  retryVideoUploadJob,
  startVideoUploadQueue,
  subscribeVideoUploadQueue,
  type QueuedVideoUploadJob,
} from '@/lib/videoUploadQueue';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { ThemedText } from '@/components/themed-text';

type SetLog = {
  id: number;
  set_index: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  actual_rir: number | null;
  has_video?: boolean;
  video_id?: number | null;
  review_status?: string | null;
  upload_status?: string | null;
  video_url?: string | null;
  video?: SetVideoSummary | null;
};

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
  superset_group: string | null;
  superset_pos: number | null;
  set_logs: SetLog[];
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
  parent_item_id?: number | string | null;
};

type AccessoryGroup = {
  group: string | null;
  items: WorkoutItem[];
};

type WorkoutPayload = {
  ok: boolean;
  permissions?: {
    can_log: boolean;
    can_coach: boolean;
    is_self_coached: boolean;
    can_hot_swap: boolean;
  };
  workout: {
    id: number;
    athlete_id: number;
    date: string | null;
    label: string | null;
    status: string | null;
    timeliness?: 'on_time' | 'tardy' | 'missed' | string | null;
    loggable?: boolean | null;
    requires_tardy_reason?: boolean | null;
    tardy_reason?: string | null;
    block_reason?: string | null;
    training_block_id: number | null;
    programming_notes?: string | null;
    post_session_coach_feedback?: string | null;
    post_session_coach_feedback_at?: string | null;
    core_items: WorkoutItem[];
    accessory_groups: AccessoryGroup[];
  };
  athlete: {
    id: number;
    name: string;
  };
};




const KG_PER_LB = 0.45359237; // 1 lb = 0.45359 kg
const MAX_ACCESSORY_LOAD_LB = 2000;
const MAX_ACCESSORY_LOAD_KG = Math.ceil((MAX_ACCESSORY_LOAD_LB * KG_PER_LB) / 2.5) * 2.5;
const CORE_WHEEL_ROW_HEIGHT = 44;
const CORE_WHEEL_VISIBLE_ROWS = 5;

function formatWeight(
  kg: number | null | undefined,
  unit: 'kg' | 'lb'
): string {
  if (kg == null) return '?';

  if (unit === 'kg') {
    const snapped = Math.round(Number(kg) * 4) / 4;
    if (!Number.isFinite(snapped)) return '?';
    return snapped.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  // Convert kg → lb
  const lbs = kg / KG_PER_LB;
  const rounded = roundToNearestGymIncrementLb(lbs);
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

function formatTargetRange(
  lowKg: number | null | undefined,
  highKg: number | null | undefined,
  unit: 'kg' | 'lb'
): string | null {
  if (lowKg == null || highKg == null) return null;
  if (lowKg === 0 && highKg === 0) return null;

  const snapKg = (v: number | null | undefined) => {
    if (v == null) return null;
    const snapped = Math.round(Number(v) * 4) / 4;
    return Number.isFinite(snapped) ? snapped : null;
  };

  const formatTargetWeight = (kg: number | null | undefined) => {
    if (kg == null) return '?';

    if (unit === 'kg') {
      const snapped = snapKg(kg);
      if (snapped == null) return '?';
      return snapped.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    }

    const lbs = Number(kg) / KG_PER_LB;
    const rounded = Math.round(lbs / 2.5) * 2.5;
    return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };

  const low = snapKg(lowKg);
  const high = snapKg(highKg);
  if (low == null || high == null) return null;

  if (low === high) {
    return `${formatTargetWeight(low)} ${unit}`;
  }

  return `${formatTargetWeight(low)}–${formatTargetWeight(high)} ${unit}`;
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

function roundToNearestGymIncrementLb(x: number): number {
  return Math.round(x / 2.5) * 2.5;
}

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  assigned: {
    bg: 'rgba(234,179,8,0.12)', // warn
    text: '#facc15',
    border: 'rgba(234,179,8,0.4)',
  },
  in_progress: {
    bg: 'rgba(134,239,172,0.055)',
    text: '#A7CBB5',
    border: 'rgba(134,239,172,0.16)',
  },
  completed: {
    bg: 'rgba(129,140,248,0.14)', // accent
    text: '#a5b4fc',
    border: 'rgba(129,140,248,0.5)',
  },
  missed: {
    bg: 'rgba(239,68,68,0.12)',
    text: '#f87171',
    border: 'rgba(239,68,68,0.42)',
  },
  tardy: {
    bg: 'rgba(234,179,8,0.12)',
    text: '#facc15',
    border: 'rgba(234,179,8,0.4)',
  },
  missed_excused: {
    bg: 'rgba(148,163,184,0.10)',
    text: '#cbd5e1',
    border: 'rgba(148,163,184,0.28)',
  },
  incomplete: {
    bg: 'rgba(234,179,8,0.12)',
    text: '#facc15',
    border: 'rgba(234,179,8,0.38)',
  },
};

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
  return it?.lookback_best || it?.last_best || it?.prev_best || null;
}

function formatLookbackLine(best: any, unit: 'kg' | 'lb') {
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

  let line = `Last best: ${formatWeight(w, unit)} ${unit} × ${reps}`;
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
  let line = `${formatWeight(w, unit)} ${assisted ? `${unit} assistance` : unit} × ${reps}`;
  if (row.rir != null) line += ` · RIR ${Number(row.rir).toFixed(1)}`;
  if (dateStr) line += ` · ${dateStr}`;
  return line;
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
const VIDEO_CHUNKED_UPLOAD_ENABLED =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_VIDEO_CHUNKED_UPLOAD === '1';
const VIDEO_CHUNK_UPLOAD_RETRIES = 3;

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

function videoSubmitForReviewValue(selectedVideo: SelectedSetVideo) {
  return selectedVideo.submitForReview === false ? 'false' : 'true';
}

async function uploadVideoChunkWithRetry(setLogId: number, payload: any) {
  let lastError: any = null;
  for (let attempt = 1; attempt <= VIDEO_CHUNK_UPLOAD_RETRIES; attempt += 1) {
    const { ok, status, json, raw } = await fetchJson(
      `${API_BASE}/video-review/mobile/set-logs/${setLogId}/video/chunked/chunk`,
      {
        method: 'POST',
        body: payload,
        auth: true,
      }
    );
    if (ok && json?.ok) return json;
    lastError = new Error(json?.error || raw || `Video chunk upload failed (HTTP ${status})`);
    await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
  }
  throw lastError || new Error('Video chunk upload failed.');
}

async function uploadSetVideoChunked(setLogId: number, selectedVideo: SelectedSetVideo) {
  if (!VIDEO_CHUNKED_UPLOAD_ENABLED || Platform.OS === 'web') {
    throw new Error('chunked upload disabled');
  }
  const info = await FileSystem.getInfoAsync(selectedVideo.uri, { size: true } as any);
  const size = Number(selectedVideo.sizeBytes || (info as any)?.size || 0);
  if (!size) throw new Error('video file required');

  const init = await fetchJson(`${API_BASE}/video-review/mobile/set-logs/${setLogId}/video/chunked/init`, {
    method: 'POST',
    auth: true,
    body: {
      filename: selectedVideo.name || 'set-video.mp4',
      content_type: selectedVideo.mimeType || 'video/mp4',
      size,
      video_angle: selectedVideo.videoAngle || 'unknown',
      submit_for_review: videoSubmitForReviewValue(selectedVideo),
      upload_intent: videoUploadIntent(selectedVideo),
    },
  });
  if (!init.ok || !init.json?.ok) {
    throw new Error(init.json?.error || init.raw || `Chunked upload init failed (HTTP ${init.status})`);
  }
  const uploadId = init.json.upload_id;
  const chunkSize = Number(init.json.chunk_size || 1024 * 1024);
  const totalChunks = Number(init.json.total_chunks || Math.ceil(size / chunkSize));

  for (let index = 0; index < totalChunks; index += 1) {
    const position = index * chunkSize;
    const length = Math.min(chunkSize, size - position);
    const dataBase64 = await FileSystem.readAsStringAsync(selectedVideo.uri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    } as any);
    await uploadVideoChunkWithRetry(setLogId, {
      upload_id: uploadId,
      index,
      data_base64: dataBase64,
    });
  }

  let thumbnailBase64 = '';
  if (selectedVideo.thumbnailUri) {
    thumbnailBase64 = await FileSystem.readAsStringAsync(selectedVideo.thumbnailUri, {
      encoding: FileSystem.EncodingType.Base64,
    } as any);
  }

  const complete = await fetchJson(`${API_BASE}/video-review/mobile/set-logs/${setLogId}/video/chunked/complete`, {
    method: 'POST',
    auth: true,
    body: {
      upload_id: uploadId,
      total_chunks: totalChunks,
      thumbnail_base64: thumbnailBase64,
      thumbnail_filename: thumbnailBase64 ? `set-video-thumbnail-${Date.now()}.jpg` : '',
      thumbnail_content_type: thumbnailBase64 ? 'image/jpeg' : '',
    },
  });
  if (!complete.ok || !complete.json?.ok) {
    throw new Error(complete.json?.error || complete.raw || `Chunked upload complete failed (HTTP ${complete.status})`);
  }
  return complete.json?.video || null;
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

function videoAngleLabel(value?: string | null) {
  return VIDEO_ANGLE_OPTIONS.find((option) => option.slug === value)?.label || 'Unknown Angle';
}
type PendingCoreWheelLog = {
  kind: CoreWheelKind;
  itemId: number;
  setIndex?: number;
  selectedVideo?: SelectedSetVideo | null;
} | null;
type CoreWheelState = {
  visible: boolean;
  kind: CoreWheelKind;
  itemId: number;
  setIndex?: number;
  title: string;
  subtitle: string;
  targetLine?: string | null;
  weight: string;
  reps: string;
  rpe: string;
  weightOptions: string[];
  repsOptions: string[];
  rpeOptions: string[];
  selectedVideo?: SelectedSetVideo | null;
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

function plannedSetCountForItem(item: WorkoutItem) {
  if (isFullCustomWorkoutItem(item)) {
    return Array.isArray(item.planned_sets) && item.planned_sets.length ? item.planned_sets.length : positiveInt(item.sets);
  }
  return positiveInt(item.sets);
}

function loggedSetCountForWorkout(workout?: WorkoutPayload['workout'] | null) {
  if (!workout) return 0;
  const core = (workout.core_items || []).reduce((sum, item) => sum + (item.set_logs || []).length, 0);
  const acc = (workout.accessory_groups || []).reduce(
    (sum, group) => sum + (group.items || []).reduce((inner, item) => inner + (item.set_logs || []).length, 0),
    0,
  );
  return core + acc;
}

function plannedSetCountForWorkout(workout?: WorkoutPayload['workout'] | null) {
  if (!workout) return 0;
  const core = (workout.core_items || []).reduce((sum, item) => sum + plannedSetCountForItem(item), 0);
  const acc = (workout.accessory_groups || []).reduce(
    (sum, group) => sum + (group.items || []).reduce((inner, item) => inner + plannedSetCountForItem(item), 0),
    0,
  );
  return core + acc;
}

function progressSegmentsForWorkout(workout?: WorkoutPayload['workout'] | null): WorkoutProgressSetSegment[] {
  if (!workout) return [];
  const segments: WorkoutProgressSetSegment[] = [];
  (workout.core_items || []).forEach((item) => {
    const total = plannedSetCountForItem(item);
    const logged = (item.set_logs || []).length;
    const lift = String(item.lift || '').toUpperCase();
    const group = lift === 'DL' ? 'secondary' : 'primary';
    Array.from({ length: total }).forEach((_, setIndex) => {
      segments.push({
        key: `core-${item.id}-${setIndex}`,
        group,
        logged: setIndex < logged,
      });
    });
  });
  (workout.accessory_groups || []).forEach((group, groupIndex) => {
    (group.items || []).forEach((item, itemIndex) => {
      const total = plannedSetCountForItem(item);
      const logged = (item.set_logs || []).length;
      Array.from({ length: total }).forEach((_, setIndex) => {
        segments.push({
          key: `acc-${groupIndex}-${item.id || itemIndex}-${setIndex}`,
          group: 'accessory',
          logged: setIndex < logged,
        });
      });
    });
  });
  return segments;
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

function bestLoggedSet(workout?: WorkoutPayload['workout'] | null) {
  if (!workout) return null;
  let best: { item: WorkoutItem; log: SetLog; score: number } | null = null;
  const items = [
    ...(workout.core_items || []),
    ...(workout.accessory_groups || []).flatMap((group) => group.items || []),
  ];
  for (const item of items) {
    for (const log of item.set_logs || []) {
      if (log.actual_weight_kg == null) continue;
      const reps = log.actual_reps ?? 0;
      const coreBonus = item.variant !== 'ACC' ? 1000000 : 0;
      const score = coreBonus + Number(log.actual_weight_kg) * (1 + Number(reps) / 30);
      if (!best || score > best.score) best = { item, log, score };
    }
  }
  return best;
}

function loggedSetText(log?: SetLog | null, unit: 'kg' | 'lb' = 'kg') {
  if (!log) return null;
  let text = `${formatWeight(log.actual_weight_kg, unit)} ${unit}`;
  if (log.actual_reps === 0) text += ' × Failed';
  else if (log.actual_reps != null) text += ` × ${log.actual_reps}`;
  if (log.actual_rpe != null) text += ` @ RPE ${log.actual_rpe.toFixed(1)}`;
  if (log.actual_rir != null) text += ` @ RIR ${log.actual_rir.toFixed(1)}`;
  return text;
}

function toWheelWeight(log: SetLog | null | undefined, unit: 'kg' | 'lb') {
  if (log?.actual_weight_kg == null) return '';
  return displayWeightFromKg(log.actual_weight_kg, unit);
}

function displayWeightFromKg(kg: number | null | undefined, unit: 'kg' | 'lb') {
  if (kg == null || !Number.isFinite(Number(kg))) return '';
  const value = unit === 'kg' ? Number(kg) : Number(kg) / KG_PER_LB;
  const snapped = unit === 'kg'
    ? snapCoreWheelWeight(value, 'kg')
    : snapCoreWheelWeight(value, 'lb');
  return formatWheelNumber(snapped);
}

function formatWheelNumber(value: number) {
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function snapCoreWheelWeight(value: number, unit: 'kg' | 'lb') {
  if (!Number.isFinite(value)) return unit === 'kg' ? 70 : 150;
  const step = unit === 'kg'
    ? (value < 70 ? 1.25 : 2.5)
    : (value < 150 ? 2.5 : 5);
  return Math.round(value / step) * step;
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

function prescribedCoreWeight(item: WorkoutItem, unit: 'kg' | 'lb', planned?: PlannedSet | null) {
  const manual = planned ? computeManualRangeKg(planned) : null;
  if (manual?.lowKg != null && manual?.highKg != null) {
    return displayWeightFromKg((manual.lowKg + manual.highKg) / 2, unit);
  }

  const plannedAny: any = planned || {};
  if (plannedAny.target_kg != null) return displayWeightFromKg(plannedAny.target_kg, unit);
  if (planned?.suggested_low_kg != null && planned?.suggested_high_kg != null) {
    return displayWeightFromKg((planned.suggested_low_kg + planned.suggested_high_kg) / 2, unit);
  }

  if (item.target_low_kg != null && item.target_high_kg != null) {
    return displayWeightFromKg((item.target_low_kg + item.target_high_kg) / 2, unit);
  }
  if (item.target_low_kg != null) return displayWeightFromKg(item.target_low_kg, unit);
  if (item.target_high_kg != null) return displayWeightFromKg(item.target_high_kg, unit);

  return '';
}

function defaultCoreWeight(item: WorkoutItem, unit: 'kg' | 'lb', carriedInput?: string | null, planned?: PlannedSet | null) {
  if (carriedInput && Number.isFinite(Number(carriedInput)) && Number(carriedInput) > 0) {
    return carriedInput;
  }

  const prescribed = prescribedCoreWeight(item, unit, planned);
  if (prescribed) return prescribed;

  const best = getLookbackBest(item);
  const bestWeight = best?.actual_weight_kg ?? best?.weight_kg ?? null;
  if (bestWeight != null) return displayWeightFromKg(bestWeight, unit);

  return unit === 'kg' ? '100' : '225';
}

function defaultCoreReps(item: WorkoutItem, planned?: PlannedSet | null) {
  return String(planned?.reps ?? item.reps ?? 5);
}

function defaultCoreRpe(item: WorkoutItem, planned?: PlannedSet | null) {
  return formatWheelNumber(Number(planned?.rpe_target ?? item.rpe_target ?? 8));
}

function accessoryRepsDefault(item: WorkoutItem) {
  const raw = String(item.reps_text || item.reps || '').trim();
  if (!raw || /amrap/i.test(raw)) return '10';
  const matches = raw.match(/\d+/g);
  if (!matches?.length) return '10';
  return matches[matches.length - 1] || '10';
}

function accessoryTargetLine(item: WorkoutItem) {
  const base = `${positiveInt(item.sets)}×${item.reps_text || item.reps || '—'}`;
  if (item.rir_target == null) return base;
  return `${base} @${formatWheelNumber(Number(item.rir_target))} RIR`;
}

function defaultAccessoryWeight(item: WorkoutItem, unit: 'kg' | 'lb', existingInput?: string | null) {
  const previousLog = item.set_logs?.length
    ? [...item.set_logs].sort((a, b) => (b.set_index || 0) - (a.set_index || 0))[0]
    : null;
  const previousWeight = toWheelWeight(previousLog, unit);
  if (previousWeight) return previousWeight;

  const best = getLookbackBest(item);
  const bestWeight = best?.actual_weight_kg ?? best?.weight_kg ?? null;
  if (bestWeight != null) return displayWeightFromKg(bestWeight, unit);

  if (existingInput && Number.isFinite(Number(existingInput)) && Number(existingInput) > 0) {
    return existingInput;
  }

  return '0';
}

function defaultAccessoryRir(item: WorkoutItem) {
  return formatWheelNumber(Number(item.rir_target ?? 2));
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

function WheelColumn({
  label,
  value,
  options,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  suffix?: string;
}) {
  const wheelRef = useRef<ScrollView | null>(null);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteracting = useRef(false);
  const centerPadding = CORE_WHEEL_ROW_HEIGHT * Math.floor(CORE_WHEEL_VISIBLE_ROWS / 2);

  useEffect(() => {
    if (isInteracting.current) return;
    const index = Math.max(0, options.indexOf(value));
    requestAnimationFrame(() => {
      wheelRef.current?.scrollTo({
        y: index * CORE_WHEEL_ROW_HEIGHT,
        animated: false,
      });
    });
  }, [options, value]);

  useEffect(() => () => {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
  }, []);

  const settleToOffset = (offsetY: number) => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(offsetY / CORE_WHEEL_ROW_HEIGHT)));
    const next = options[index];
    if (next && next !== value) onChange(next);
    const targetY = index * CORE_WHEEL_ROW_HEIGHT;
    if (Math.abs(offsetY - targetY) > 1) {
      wheelRef.current?.scrollTo({
        y: targetY,
        animated: true,
      });
    }
  };

  const settleAfterQuietDrag = (offsetY: number) => {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = setTimeout(() => {
      isInteracting.current = false;
      settleToOffset(offsetY);
    }, 90);
  };

  return (
    <View style={styles.coreWheelColumn}>
      <Text style={styles.coreWheelColumnLabel}>{label}</Text>
      <View style={styles.coreWheelScrollFrame}>
        <View pointerEvents="none" style={styles.coreWheelCenterBand} />
        <ScrollView
          ref={wheelRef}
          style={styles.coreWheelScroll}
          contentContainerStyle={[
            styles.coreWheelScrollContent,
            { paddingTop: centerPadding, paddingBottom: centerPadding },
          ]}
          showsVerticalScrollIndicator={false}
          snapToInterval={CORE_WHEEL_ROW_HEIGHT}
          snapToAlignment="start"
          decelerationRate="normal"
          onScrollBeginDrag={() => {
            isInteracting.current = true;
            if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
          }}
          onMomentumScrollBegin={() => {
            isInteracting.current = true;
            if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
          }}
          onMomentumScrollEnd={(e) => {
            isInteracting.current = false;
            settleToOffset(e.nativeEvent.contentOffset.y);
          }}
          onScrollEndDrag={(e) => {
            settleAfterQuietDrag(e.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <TouchableOpacity
                key={`${label}-${option}`}
                style={styles.coreWheelOption}
                onPress={() => onChange(option)}
              >
                <Text style={[styles.coreWheelOptionText, selected && styles.coreWheelOptionTextActive]}>
                  {option}{suffix ? ` ${suffix}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export default function WorkoutViewerScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const router = useRouter();
  const { user } = useAuth(); // we only need session + role to decide logging availability
  const isIndividualUser =
    user?.workspace_mode === 'individual' ||
    user?.is_individual_workspace === true ||
    user?.is_self_coached === true;

  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [data, setData] = useState<WorkoutPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [pendingAccessoryLogItemId, setPendingAccessoryLogItemId] = useState<any>(null);
  const [expandedCompletedMovements, setExpandedCompletedMovements] = useState<Record<string, boolean>>({});
  const [expandedCoreDetails, setExpandedCoreDetails] = useState<Record<string, boolean>>({});
  const manualMovementSelectionRef = useRef(false);
  const pendingAutoAdvanceRef = useRef<{ fromKey: string | null } | null>(null);
  const autoExpandWorkoutIdRef = useRef<number | null>(null);
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

  const uniqueLoggedSetIndexes = (logs?: SetLog[] | null) =>
    Array.from(
      new Set(
        (logs || [])
          .map((log) => Number(log.set_index || 0))
          .filter((idx) => Number.isFinite(idx) && idx > 0),
      ),
    ).sort((a, b) => a - b);

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
  }, []);

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
      for (const item of group.items || []) {
        if (item.id === itemId) return `acc:${item.id}`;
      }
    }

    return null;
  }, []);

  const openMovementCard = useCallback((key: string | null | undefined) => {
    if (!key) return;
    if (key.startsWith('core:')) {
      const id = key.slice('core:'.length);
      setExpandedCoreDetails((prev) => ({ ...prev, [coreDetailExpansionKey(id)]: true }));
      return;
    }
    if (key.startsWith('acc:')) {
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
    if (key.startsWith('acc:')) {
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

  const scrollRef = useRef<any>(null);
  const scrollYRef = useRef(0);
  const pendingRestoreScrollYRef = useRef<number | null>(null);

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
  const [videoUploadBySetLogId, setVideoUploadBySetLogId] = useState<
    Record<number, { uploading?: boolean; queued?: boolean; uploaded?: boolean; error?: string | null; permanent?: boolean; job?: QueuedVideoUploadJob | null }>
  >({});
  const uploadedQueueRefreshRef = useRef<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<
    null | 'begin' | 'complete' | 'cancel'
  >(null);

  const [restSeconds, setRestSeconds] = useState(0);
  const [restActive, setRestActive] = useState(false);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restEndAtMsRef = useRef<number | null>(null);
  const restNotifIdRef = useRef<string | null>(null);
  const notifPermCheckedRef = useRef(false);
  const notifHandlerSetRef = useRef(false);
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

  const scheduleRestEndNotification = async (seconds: number) => {
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
          data: { kind: 'rest_end' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
      restNotifIdRef.current = id;
    } catch (e) {
      console.log('scheduleRestEndNotification error', e);
    }
  };

  // Shared timer picker state and helpers
  const [timerPickerVisible, setTimerPickerVisible] = useState(false);
  const [timerPickerValue, setTimerPickerValue] = useState(120);
  const timerWheelRef = useRef<ScrollView | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [tardyReasonVisible, setTardyReasonVisible] = useState(false);
  const [tardyReason, setTardyReason] = useState('');

  const [postSessionVisible, setPostSessionVisible] = useState(false);
  const [postSessionSubmitting, setPostSessionSubmitting] = useState(false);
  const [postSessionForm, setPostSessionForm] = useState({
    sessionRpe: null as number | null,
    strengthFeeling: '' as '' | 'much_weaker' | 'slightly_weaker' | 'normal' | 'slightly_stronger' | 'much_stronger',
    fatigueFeeling: '' as '' | 'very_fresh' | 'slightly_fatigued' | 'moderately_fatigued' | 'very_fatigued',
    note: '',
  });

  const [editSetVisible, setEditSetVisible] = useState(false);
  const [editSetSubmitting, setEditSetSubmitting] = useState(false);
  const [editSetCtx, setEditSetCtx] = useState<{
    itemId: number;
    setIndex: number;
    setLogId: number;
    canUndoDelete: boolean;
    mode: 'rpe' | 'rir';
    title: string;
  } | null>(null);

  const [editSetForm, setEditSetForm] = useState({
    weight: '',
    reps: '',
    rpe: '',
    rir: '',
  });

  // --- Readiness survey (mobile only) ---
  const [readinessVisible, setReadinessVisible] = useState(false);
  const [pendingBeginWorkoutId, setPendingBeginWorkoutId] = useState<number | null>(null);
  const [readinessSubmitting, setReadinessSubmitting] = useState(false);

  const [readinessForm, setReadinessForm] = useState({
    sleep_quality: 3,
    fatigue: 3,
    soreness: 3,
    stress: 3,
    overall: 3,
  });

  // If backend provides readiness data, this prevents re-prompting.
  // If it doesn't yet, you'll still get prompted once per begin tap.
  const hasReadinessForWorkout = () => {
    const wk: any = data?.workout;
    return !!wk?.readiness_survey;
  };

  const openReadinessThenBegin = (wkId: number) => {
    setPendingBeginWorkoutId(wkId);
    setReadinessVisible(true);
  };

  // Submit readiness (best-effort) then begin workout either way.
  const submitReadinessAndBegin = async (opts?: { skipped?: boolean }) => {
    const wkId = pendingBeginWorkoutId;
    if (!wkId) {
      setReadinessVisible(false);
      return;
    }

    try {
      setReadinessSubmitting(true);
      setError(null);

      const skipped = !!opts?.skipped;
      const body = skipped
        ? { skipped: true }
        : {
            sleep_quality: readinessForm.sleep_quality,
            soreness: readinessForm.soreness,
            stress: readinessForm.stress,
            energy: readinessForm.fatigue, // mapping fatigue -> energy for now
          };

      // Create this backend route next:
      // POST /workouts/mobile/<wkId>/readiness
      await fetchJson(`${API_BASE}/workouts/mobile/${wkId}/readiness`, {
        method: 'POST',
        auth: true,
        body,
      });
    } catch (e) {
      // Don't block beginning the workout if readiness submit fails
      console.log('readiness submit error', e);
    } finally {
      setReadinessSubmitting(false);
      setReadinessVisible(false);
      setPendingBeginWorkoutId(null);

      // Now proceed with the existing begin flow
      requestAnimationFrame(() => beginWorkout());
    }
  };

  // --- Accessory hot-swap (self-coached only) ---
  const [swapAccVisible, setSwapAccVisible] = useState(false);
  const [swapAccItem, setSwapAccItem] = useState<WorkoutItem | null>(null);
  const [movementHistoryItem, setMovementHistoryItem] = useState<WorkoutItem | null>(null);
  const [swapAccForm, setSwapAccForm] = useState({
    movement: '',
    sets: '',
    reps_text: '',
    rir: '',
  });

  const openSwapAcc = (it: WorkoutItem) => {
    setSwapAccItem(it);
    setSwapAccForm({
      movement: it.selected_sub_movement || it.movement || it.original_movement || '',
      sets: it.sets != null ? String(it.sets) : '',
      reps_text: it.reps_text || (it.reps != null ? String(it.reps) : ''),
      rir: it.rir_target != null ? String(it.rir_target) : '',
    });
    setSwapAccVisible(true);
  };

  const saveSwapAcc = async () => {
    if (!workoutId || !swapAccItem) return;

    const movement = String(swapAccForm.movement || '').trim();
    const setsStr = String(swapAccForm.sets || '').trim();
    const repsText = String(swapAccForm.reps_text || '').trim();
    const rirStr = String(swapAccForm.rir || '').trim();

    if (!movement) {
      setError('Movement required');
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
            movement,
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

      setSwapAccVisible(false);
      setSwapAccItem(null);
      rememberScroll();
      await fetchWorkout();
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
    opts: { mode: 'rpe' | 'rir'; title: string; canUndoDelete?: boolean }
  ) => {
    const weightVal =
      setLog.actual_weight_kg != null
        ? unit === 'kg'
          ? formatWeight(setLog.actual_weight_kg, 'kg')
          : String(roundToNearestGymIncrementLb(setLog.actual_weight_kg / KG_PER_LB))
        : '';

    setEditSetCtx({
      itemId,
      setIndex: setLog.set_index,
      setLogId: setLog.id,
      canUndoDelete: !!opts.canUndoDelete,
      mode: opts.mode,
      title: opts.title,
    });

    setEditSetForm({
      weight: weightVal,
      reps: setLog.actual_reps != null ? String(setLog.actual_reps) : '',
      rpe: setLog.actual_rpe != null ? String(setLog.actual_rpe) : '',
      rir: setLog.actual_rir != null ? String(setLog.actual_rir) : '',
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

      setEditSetVisible(false);
      setEditSetCtx(null);
      rememberScroll();
      await fetchWorkout();
    } catch (err: any) {
      console.log('saveEditedSet error', err);
      setError(err?.message || 'Error updating set');
    } finally {
      setEditSetSubmitting(false);
      setSavingItemId(null);
    }
  };

  const deleteEditedSet = async () => {
    if (!workoutId || !editSetCtx?.setLogId) return;

    try {
      setEditSetSubmitting(true);
      setSavingItemId(editSetCtx.itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/${workoutId}/setlogs/${editSetCtx.setLogId}`,
        {
          method: 'DELETE',
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to delete set (HTTP ${status})`);
      }

      setEditSetVisible(false);
      setEditSetCtx(null);

      rememberScroll();
      await fetchWorkout();
    } catch (err: any) {
      console.log('deleteEditedSet error', err);
      setError(err?.message || 'Error deleting set');
    } finally {
      setEditSetSubmitting(false);
      setSavingItemId(null);
    }
  };

  const TIMER_OPTIONS = Array.from({ length: 12 }, (_, idx) => (idx + 1) * 30);

  const openTimerPicker = () => {
    const current = restSeconds || 120;
    const nearest = TIMER_OPTIONS.reduce((best, option) =>
      Math.abs(option - current) < Math.abs(best - current) ? option : best,
    TIMER_OPTIONS[3]);
    setTimerPickerValue(nearest);
    setTimerPickerVisible(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const idx = Math.max(0, TIMER_OPTIONS.indexOf(nearest));
        timerWheelRef.current?.scrollTo({
          y: idx * 44,
          animated: false,
        });
      });
    });
  };

  const handleTimerSelect = (seconds: number) => {
    startRestTimer(seconds);
    setTimerPickerVisible(false);
  };

  const startRestTimer = (seconds: number) => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    const endAt = Date.now() + seconds * 1000;
    restEndAtMsRef.current = endAt;

    setRestSeconds(seconds);
    setRestActive(true);

    // Schedule a local notification so the timer "works" while backgrounded
    scheduleRestEndNotification(seconds);
  };

  const stopRestTimer = () => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    restEndAtMsRef.current = null;
    setRestActive(false);
    setRestSeconds(0);

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

      if (remaining <= 0) {
        cancelRestEndNotification();
        setRestActive(false);
        restEndAtMsRef.current = null;

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
  }, [restActive]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && restActive && restEndAtMsRef.current) {
        const remaining = Math.max(
          0,
          Math.ceil((restEndAtMsRef.current - Date.now()) / 1000)
        );
        setRestSeconds(remaining);

        if (remaining <= 0) {
          setRestActive(false);
          restEndAtMsRef.current = null;
        }
      }
    });

    return () => sub.remove();
  }, [restActive]);



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
    const logs = item?.set_logs || [];
    if (!logs.length) return null;
    return [...logs].sort((a, b) => (b.set_index || 0) - (a.set_index || 0))[0];
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

  const prefillAccessoryInput = (
    item: WorkoutItem,
    values: { weight?: string; reps?: string; rir?: string },
  ) => {
    setAccInputs((prev) => {
      const cur = prev[item.id] || { weight: '', reps: '', rir: '' };
      return {
        ...prev,
        [item.id]: {
          weight: values.weight ?? cur.weight,
          reps: values.reps ?? cur.reps,
          rir: values.rir ?? cur.rir,
        },
      };
    });
  };

  const repeatAccessoryLastSet = (item: WorkoutItem) => {
    const last = lastLogForItem(item);
    if (!last) return;
    prefillAccessoryInput(item, {
      weight: toWheelWeight(last, unit),
      reps: last.actual_reps != null ? String(last.actual_reps) : '',
      rir: last.actual_rir != null ? String(last.actual_rir) : '',
    });
    setPendingAccessoryLogItemId(item.id);
  };

  const openAccessoryWheel = (item: WorkoutItem) => {
    const rawWeight = defaultAccessoryWeight(item, unit, accInputs[item.id]?.weight || '');
    const weightOptions = buildAccessoryWeightOptions(unit, rawWeight);
    const repsOptions = ['0', ...Array.from({ length: 30 }, (_, idx) => String(idx + 1))];
    const rirOptions = Array.from({ length: 11 }, (_, idx) => formatWheelNumber(idx * 0.5));
    const repsDefault = accInputs[item.id]?.reps || accessoryRepsDefault(item);
    const rirDefault = accInputs[item.id]?.rir || defaultAccessoryRir(item);

    setAccessoryWheel({
      visible: true,
      itemId: item.id,
      title: item.movement || 'Accessory',
      targetLine: accessoryTargetLine(item),
      weight: nearestWheelValue(weightOptions, rawWeight, '0'),
      reps: nearestWheelValue(repsOptions, repsDefault, '10'),
      rir: nearestWheelValue(rirOptions, rirDefault, '2'),
      weightOptions,
      repsOptions,
      rirOptions,
      selectedVideo: null,
    });
  };

  const commitAccessoryWheel = () => {
    if (!accessoryWheel) return;
    const itemId = accessoryWheel.itemId;
    setAccInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: accessoryWheel.weight,
        reps: accessoryWheel.reps,
        rir: accessoryWheel.reps === '0' ? '' : accessoryWheel.rir,
      },
    }));
    setPendingAccessoryLogItemId({
      itemId,
      selectedVideo: null,
    });
    setAccessoryWheel(null);
  };

  const switchLogSheetUnit = (nextUnit: 'kg' | 'lb') => {
    if (nextUnit === unit) return;
    const currentUnit = unit;

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
    const carriedInput = (() => {
      if (kind === 'straight') return straightInputs[item.id]?.weight || '';
      if (kind === 'top') return topInputs[item.id]?.weight || '';
      if (kind === 'bk') return bkInputs[item.id]?.weight || '';
      if (kind === 'fc') return fcInputs[`${item.id}:${setIndex}`]?.weight || '';
      return '';
    })();

    const rawWeight = defaultCoreWeight(item, unit, carriedInput, planned || null);
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
      weight,
      reps,
      rpe,
      weightOptions,
      repsOptions,
      rpeOptions,
      selectedVideo: null,
    });
  };

  const repeatCoreSet = (
    kind: CoreWheelKind,
    item: WorkoutItem,
    previousLog: SetLog | null,
    setIndex?: number,
  ) => {
    if (!previousLog) return;

    const weight = toWheelWeight(previousLog, unit);
    const reps = previousLog.actual_reps != null ? String(previousLog.actual_reps) : '';
    const rpe = previousLog.actual_rpe != null ? formatWheelNumber(Number(previousLog.actual_rpe)) : '';

    if (kind === 'straight') {
      prefillCoreInput('straight', item, { weight, reps, rpe });
    } else if (kind === 'top') {
      prefillCoreInput('top', item, { weight, reps, rpe });
    } else if (kind === 'bk') {
      prefillCoreInput('bk', item, { weight, reps, rpe });
    } else {
      prefillFcInput(`${item.id}:${setIndex}`, { weight, reps, rpe });
    }

    setPendingCoreWheelLog({
      kind,
      itemId: item.id,
      setIndex,
    });
  };

  const commitCoreWheel = () => {
    if (!coreWheel) return;
    const weight = coreWheel.weight;
    const reps = coreWheel.reps;
    const rpe = reps === '0' ? '' : coreWheel.rpe;

    if (coreWheel.kind === 'straight') {
      prefillCoreInput('straight', { id: coreWheel.itemId } as WorkoutItem, { weight, reps, rpe });
    } else if (coreWheel.kind === 'top') {
      prefillCoreInput('top', { id: coreWheel.itemId } as WorkoutItem, { weight, reps, rpe });
    } else if (coreWheel.kind === 'bk') {
      prefillCoreInput('bk', { id: coreWheel.itemId } as WorkoutItem, { weight, reps, rpe });
    } else {
      prefillFcInput(`${coreWheel.itemId}:${coreWheel.setIndex}`, { weight, reps, rpe });
    }

    setPendingCoreWheelLog({
      kind: coreWheel.kind,
      itemId: coreWheel.itemId,
      setIndex: coreWheel.setIndex,
      selectedVideo: coreWheel.selectedVideo || null,
    });
    setCoreWheel(null);
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

  // Prefill prescribed reps into controlled state once the workout loads.
  useEffect(() => {
    const wk = data?.workout;
    if (!wk?.id) return;

    const coreItems: any[] = Array.isArray(wk.core_items) ? wk.core_items : [];

    // Straight-like items: STRAIGHT and VR
    const straightLike = coreItems.filter((it) => it && (it.variant === 'STRAIGHT' || it.variant === 'VR' || it.lift === 'VR'));
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

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_straight`,
        {
          method: 'POST',
          body: {
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe: rpe,
          },
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to log set (HTTP ${status})`);
      }

      setTimerPickerVisible(true);
      markAutoAdvanceAfterLog(itemId);
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
      console.log('logStraightSet error', err);
      setError(err?.message || 'Error logging set');
    } finally {
      setSavingItemId(null);
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

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_top`,
        {
          method: 'POST',
          body: {
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe: rpe,
          },
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to log top set (HTTP ${status})`);
      }

      setTimerPickerVisible(true);
      markAutoAdvanceAfterLog(itemId);
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
      console.log('logTopSet error', err);
      setError(err?.message || 'Error logging top set');
    } finally {
      setSavingItemId(null);
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

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_bk`,
        {
          method: 'POST',
          body: {
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe: rpe,
          },
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to log backdown set (HTTP ${status})`);
      }

      setTimerPickerVisible(true);
      markAutoAdvanceAfterLog(itemId);
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
      console.log('logBackdownSet error', err);
      setError(err?.message || 'Error logging backdown set');
    } finally {
      setSavingItemId(null);
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

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_fc`,
        {
          method: 'POST',
          auth: true,
          body: {
            set_index: setIndex,
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe: rpe,
          },
        }
      );

      if (!ok || !json?.ok) throw new Error(json?.error || `Failed (HTTP ${status})`);

      setTimerPickerVisible(true);
      markAutoAdvanceAfterLog(itemId);
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
      console.log('logFullCustomSet error', e);
      setError(e?.message || 'Error logging set');
    } finally {
      setSavingItemId(null);
    }
  };

  useEffect(() => {
    if (!pendingCoreWheelLog) return;
    const pending = pendingCoreWheelLog;
    setPendingCoreWheelLog(null);

    requestAnimationFrame(() => {
      if (pending.kind === 'straight') logStraightSet(pending.itemId, pending.selectedVideo || null);
      else if (pending.kind === 'top') logTopSet(pending.itemId, pending.selectedVideo || null);
      else if (pending.kind === 'bk') logBackdownSet(pending.itemId, pending.selectedVideo || null);
      else if (pending.kind === 'fc' && pending.setIndex != null) {
        logFullCustomSet(pending.itemId, pending.setIndex, pending.selectedVideo || null);
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

  async function logAccessorySet(
    workoutId: number,
    itemId: number,
    payload: {
      actual_weight_kg: number;
      actual_reps: number;
      actual_rir?: number | null;
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

    try {
      setSavingItemId(itemId);
      setError(null);

      const json = await logAccessorySet(
        Number(workoutId),
        itemId,
        {
          actual_weight_kg: weightKg,
          actual_reps: Number(reps),
          actual_rir: rir ?? undefined,
        }
      );

      setTimerPickerVisible(true);
      markAutoAdvanceAfterLog(itemId);
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
      console.log('handleAccessorySave error', err);
      setError(err?.message || 'Error logging accessory set');
    } finally {
      setSavingItemId(null);
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
        throw new Error(json?.error || `Failed to update workout status (HTTP ${status})`);
      }

      // pull fresh status + set_logs etc
      await fetchWorkout();
    } catch (err: any) {
      console.log('performStatusAction error', err);
      setError(err?.message || 'Error updating workout');
    } finally {
      setActionLoading(null);
    }
  };

  const beginWorkoutConfirmed = async (reason?: string) => {
    if (!data?.workout) return;
    const wkId = data.workout.id;

    if (!canLogFromServer) {
      Alert.alert('Read-only', 'You do not have permission to log this workout on mobile.');
      return;
    }

    try {
      setActionLoading('begin');
      setError(null);

      // Step 1: checkout the workout to this mobile client
      const checkout = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/checkout`,
        { method: 'POST', auth: true }
      );

      if (!checkout.ok || !checkout.json?.ok) {
        Alert.alert(
          'Unable to begin workout',
          checkout.json?.error ||
            `Workout is currently checked out by another user or device. (HTTP ${checkout.status})`
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
        Alert.alert('Error', begun.json?.error || `Failed to begin workout (HTTP ${begun.status})`);
        return;
      }

      // Pull fresh workout data (status, logs, etc.)
      await fetchWorkout();
    } catch (err) {
      console.error('beginWorkout error', err);
      Alert.alert('Error', 'Failed to begin workout');
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
        'Resuming this completed session will delete the post-session survey for this workout.',
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

  const completeWorkout = async () => {
    if (!data?.workout) return;
    const wkId = data.workout.id;

    try {
      setActionLoading('complete');
      setError(null);

      const done = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/complete`,
        { method: 'POST', auth: true }
      );

      if (!done.ok || !done.json?.ok) {
        Alert.alert('Error', done.json?.error || `Failed to complete workout (HTTP ${done.status})`);
        return;
      }

      // Refresh local data
      await fetchWorkout();

      // Best-effort checkin: release the lock after completion
      try {
        await fetchJson(
          `${API_BASE}/workouts/mobile/${wkId}/checkin`,
          { method: 'POST', auth: true }
        );
      } catch (e) {
        console.warn('checkin after complete failed', e);
      }
    } catch (err) {
      console.error('completeWorkout error', err);
      Alert.alert('Error', 'Failed to complete workout');
    } finally {
      setActionLoading(null);
    }
  };

  const openPostSessionSurvey = () => {
    setPostSessionForm({
      sessionRpe: null,
      strengthFeeling: '',
      fatigueFeeling: '',
      note: '',
    });
    setPostSessionVisible(true);
  };

  const skipPostSessionAndComplete = async () => {
    setPostSessionVisible(false);
    await completeWorkout();
  };

  const submitPostSessionAndComplete = async () => {
    if (
      postSessionForm.sessionRpe == null ||
      !postSessionForm.strengthFeeling ||
      !postSessionForm.fatigueFeeling
    ) {
      setError('Complete the post-session check-in or choose Skip & Complete.');
      return;
    }

    if (!workoutId) {
      setError('Missing workout id');
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

      setPostSessionVisible(false);
      await completeWorkout();
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
        Alert.alert('Error', canceled.json?.error || `Failed to cancel workout (HTTP ${canceled.status})`);
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
      Alert.alert('Error', 'Failed to cancel workout');
    } finally {
      setActionLoading(null);
    }
  };

  const fetchWorkout = useCallback(async (opts?: { silent?: boolean }) => {
    if (!workoutId) {
      setError('Missing workout id');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const silent = !!opts?.silent;

    try {
      if (silent) setRefreshing(true);
      else if (!dataRef.current) setLoading(true);
      else setRefreshing(true);

      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}`,
        { method: 'GET', auth: true }
      );

      const payload = json as WorkoutPayload;

      if (!ok || !payload?.ok) {
        throw new Error((payload as any)?.error || `Failed to load workout (HTTP ${status})`);
      }

      setData(payload);
      restoreScrollSoon();
    } catch (err: any) {
      console.log('Workout fetch error', err);
      setError(err?.message || 'Error loading workout');
      if (!silent && !dataRef.current) {
        setData(null);
      }
    } finally {
      if (silent) setRefreshing(false);
      else {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [workoutId]);

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

  const selectVideoForCoreWheel = useCallback(async () => {
    const selectedVideo = await pickSetVideo();
    if (!selectedVideo) return;
    setCoreWheel((prev) => prev ? { ...prev, selectedVideo } : prev);
  }, [pickSetVideo]);

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
                <ActivityIndicator size="small" color="#E2E8F0" />
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
                  <ActivityIndicator size="small" color="#FECACA" />
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
    if (Platform.OS === 'web' || !Notifications) return;
    if (notifHandlerSetRef.current) return;

    notifHandlerSetRef.current = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

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
        collapseMovementCard(fromRow.key);
        if (nextRow?.key && nextRow.key !== fromRow.key) {
          openMovementCard(nextRow.key);
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
    openMovementCard,
    expandedCoreDetails,
    expandedCompletedMovements,
  ]);

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  const onRefresh = useCallback(async () => {
    await fetchWorkout({ silent: true });
  }, [fetchWorkout]);

  useEffect(() => {
    return () => {
      // Best-effort cleanup so scheduled notifications don't linger
      cancelRestEndNotification();
    };
  }, []);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <ThemedText variant="bodyMuted" style={styles.muted}>
          Loading workout…
        </ThemedText>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <ThemedText variant="error" style={styles.errorText}>
          {error || 'Something went wrong'}
        </ThemedText>
      </View>
    );
  }

  const { workout, athlete } = data;
  const canLogFromServer = !!data.permissions?.can_log;
  const canHotSwap = !!data.permissions?.can_hot_swap;
  // Coach viewing an athlete workout in read-only mode
  const isCoachView = !!data.permissions?.can_coach && !canLogFromServer;
  const canEdit =
    (!!data.permissions?.can_coach || !!data.permissions?.is_self_coached) &&
    (workout.status === 'assigned' || workout.status === 'draft');
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
  const loggedSets = loggedSetCountForWorkout(workout);
  const plannedSets = plannedSetCountForWorkout(workout);
  const progressPct = plannedSets ? Math.min(100, Math.round((loggedSets / plannedSets) * 100)) : 0;
  const workoutProgressSegments = progressSegmentsForWorkout(workout);
  const topLogged = bestLoggedSet(workout);
  const focusLine = firstSessionFocus(workout);

  const statusStyle =
    (workout.status && STATUS_STYLES[workout.status]) || STATUS_STYLES.assigned;

  const handleEditWorkout = () => {
    router.push({
      pathname: '/create-workout',
      params: { editWorkoutId: String(workout.id) },
    });
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
  }): MovementLoggerFocusModel => ({
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
    currentSetLabel: currentSetLabel || `Set ${setIndex}`,
    progressionLabel: progressionLabel || `${completedIndexes.length} / ${total} sets logged`,
    targetLine,
    prescriptionLine,
    recentContext: formatLookbackLine(getLookbackBest(item), unit),
    rail: rail || railForSets(total, setIndex, completedIndexes),
    canLog,
    canRepeat: !!previousLog,
    onLogSet: () => openCoreWheel({
      kind,
      item,
      setIndex,
      planned: planned || undefined,
      targetLine,
    }),
    onRepeatLast: previousLog ? () => repeatCoreSet(kind, item, previousLog, setIndex) : undefined,
    onViewHistory: () => setMovementHistoryItem(item),
  });

  const completedCoreSetSummary = (
    item: WorkoutItem,
    log: SetLog,
    title: string,
    canUndoDelete: boolean,
  ) => {
    const uploadState = videoUploadBySetLogId[log.id] || {};
    const hasVideo = !!(log.has_video || log.video_id || log.video?.id);
    const queuedJob = uploadState.job || null;
    const queuedStatus = queuedVideoStatusLabel(uploadState);
    const status = queuedStatus || videoStatusLabel(log, !!uploadState.uploading, uploadState.error || null);
    const canRetryUpload = !!queuedJob && !!uploadState.error && !uploadState.permanent;
    const disabled = !canManageSetVideo || !!uploadState.uploading || (!!uploadState.queued && !canRetryUpload) || !!(uploadState as any).deleting;

    return {
      resultText: loggedSetText(log, unit),
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
              title,
              canUndoDelete,
            })
        : undefined,
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
  } => {
    const detailRows: ActiveMovementDetailRow[] = [];
    let loggerFocus: MovementLoggerFocusModel | null = null;

    const attachFocus = (focus: MovementLoggerFocusModel) => {
      if (!loggerFocus) loggerFocus = focus;
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
          }));
        }

        detailRows.push({
          key: `fc-${core.id}-${setIdx}`,
          label: `Set ${setIdx}`,
          state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
          target: existing ? null : targetLine,
          prescription: prescriptionLine,
          ...(existing
            ? completedCoreSetSummary(core, existing, `Edit Set ${setIdx}`, setIdx === fcLatestLoggedIdx)
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

      return { loggerFocus, detailRows };
    }

    if (isStraightLike && totalSets > 0) {
      const completedIndexes = logs.map((log) => log.set_index || 0).filter(Boolean);
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
          }));
        }

        detailRows.push({
          key: `straight-${core.id}-${setIdx}`,
          label: `Set ${setIdx}`,
          state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
          target: existing ? null : targetLine,
          prescription: prescriptionLine,
          ...(existing
            ? completedCoreSetSummary(core, existing, `Edit Set ${setIdx}`, setIdx === latestLoggedIdx)
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

      return { loggerFocus, detailRows };
    }

    if (isTop && totalSets > 0) {
      const completedIndexes = uniqueLoggedSetIndexes(topLogs);
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
          label: totalSets > 1 ? `Top ${setIdx}` : 'Top',
          state: existing ? 'completed' : isNextTop && canLog ? 'active' : 'locked',
        } as SetRailStep;
      });
      const backdownRailSteps = backdownsForThisTop.flatMap((bd) => {
        const bdLogs = bd.set_logs || [];
        const bdTotal = positiveInt(bd.sets);
        const bdNextIdx = nextMissingSetIndex(bdLogs, bdTotal) || (loggedSetIndexCount(bdLogs) + 1);
        return Array.from({ length: bdTotal }).map((_, idx) => {
          const setIdx = idx + 1;
          const existing = bdLogs.find((sl) => sl.set_index === setIdx);
          const isNextBackdown = hasAllTopActual && !existing && setIdx === bdNextIdx;
          return {
            key: `bd-rail-${bd.id}-${setIdx}`,
            label: `BD ${setIdx}`,
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
            currentSetLabel: totalSets > 1 ? `Top ${setIdx}` : 'Top',
            progressionLabel: topBackdownProgressLabel,
          }));
        }

        detailRows.push({
          key: `top-${core.id}-${setIdx}`,
          label: `Top ${setIdx}`,
          state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
          target: existing ? null : targetLine,
          prescription: prescriptionLine,
          ...(existing
            ? completedCoreSetSummary(
                core,
                existing,
                `Edit Top Set ${setIdx}`,
                setIdx === topLatestLoggedIdx &&
                  !backdownsForThisTop.some((bd) => loggedSetIndexCount(bd.set_logs || []) > 0),
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

      backdownsForThisTop.forEach((bd) => {
        const bdLogs = bd.set_logs || [];
        const bdTotal = positiveInt(bd.sets);
        const bdNextIdx = nextMissingSetIndex(bdLogs, bdTotal) || (loggedSetIndexCount(bdLogs) + 1);
        const bdCompletedIndexes = uniqueLoggedSetIndexes(bdLogs);
        const targetLine = formatTargetRange(bd.target_low_kg, bd.target_high_kg, unit);
        const prescriptionLine = compactSchemeText(bd, bdTotal);

        Array.from({ length: bdTotal }).forEach((_, idx) => {
          const setIdx = idx + 1;
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
              currentSetLabel: `BD ${setIdx}`,
              progressionLabel: topBackdownProgressLabel,
            }));
          }

          detailRows.push({
            key: `bk-${bd.id}-${setIdx}`,
            label: `Backdown ${setIdx}`,
            state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
            target: existing ? null : targetLine,
            prescription: prescriptionLine,
            ...(existing
              ? completedCoreSetSummary(
                  bd,
                  existing,
                  `Edit Backdown Set ${setIdx}`,
                  setIdx === bdLogs[bdLogs.length - 1]?.set_index,
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

      return { loggerFocus, detailRows };
    }

    if (isBackdown && !hasParent && totalSets > 0) {
      const completedIndexes = uniqueLoggedSetIndexes(logs);
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
          }));
        }

        detailRows.push({
          key: `orphan-bk-${core.id}-${setIdx}`,
          label: `Backdown ${setIdx}`,
          state: existing ? 'completed' : isNext && canLog ? 'active' : 'locked',
          target: existing ? null : targetLine,
          prescription: prescriptionLine,
          ...(existing
            ? completedCoreSetSummary(
                core,
                existing,
                `Edit Backdown Set ${setIdx}`,
                setIdx === logs[logs.length - 1]?.set_index,
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

    return { loggerFocus, detailRows };
  };

  const completedAccessorySetSummary = (
    item: WorkoutItem,
    log: SetLog,
    title: string,
    canUndoDelete: boolean,
  ) => {
    const uploadState = videoUploadBySetLogId[log.id] || {};
    const hasVideo = !!(log.has_video || log.video_id || log.video?.id);
    const queuedJob = uploadState.job || null;
    const queuedStatus = queuedVideoStatusLabel(uploadState);
    const status = queuedStatus || videoStatusLabel(log, !!uploadState.uploading, uploadState.error || null);
    const canRetryUpload = !!queuedJob && !!uploadState.error && !uploadState.permanent;
    const disabled = !canManageSetVideo || !!uploadState.uploading || (!!uploadState.queued && !canRetryUpload) || !!(uploadState as any).deleting;

    return {
      resultText: loggedSetText(log, unit),
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
              title,
              canUndoDelete,
            })
        : undefined,
      onVideo: hasVideo
        ? () => openSetVideoPlayer(log)
        : canRetryUpload
        ? () => retryVideoUploadJob(queuedJob.id)
        : canManageSetVideo
        ? () => uploadVideoForSetLog(log)
        : undefined,
    };
  };

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
    const completedIndexes = logs.map((log) => log.set_index || 0).filter(Boolean);
    const detailRows: ActiveMovementDetailRow[] = logs
      .slice()
      .sort((a, b) => (a.set_index || 0) - (b.set_index || 0))
      .map((log) => ({
        key: `acc-${item.id}-${log.set_index || log.id}`,
        label: `Set ${log.set_index || 1}`,
        state: 'completed',
        ...completedAccessorySetSummary(
          item,
          log,
          `Edit Set ${log.set_index || 1}`,
          (log.set_index || 0) === latestLoggedIdx,
        ),
      }));

    const canLogNext = expanded && !isComplete && canLog && !isCoachView;
    const loggerFocus: MovementLoggerFocusModel | null = canLogNext
      ? {
          itemId: item.id,
          groupItemId: item.id,
          movementName: simplifyMobileMovementName(item.movement) || 'Accessory',
          designation: 'Accessory',
          liftType: 'Support Work',
          currentSetLabel: `Set ${nextIndex}`,
          progressionLabel: `${logs.length} / ${totalSets || 0} sets logged`,
          targetLine: accessoryTargetLine(item),
          prescriptionLine: (() => {
            const lookback = formatLookbackLine(getLookbackBest(item), unit);
            return lookback || null;
          })(),
          recentContext: formatLookbackLine(getLookbackBest(item), unit),
          rail: railForSets(totalSets, nextIndex, completedIndexes),
          canLog: true,
          canRepeat: logs.length > 0,
          onLogSet: () => openAccessoryWheel(item),
          onRepeatLast: logs.length > 0 ? () => repeatAccessoryLastSet(item) : undefined,
          onViewHistory: () => setMovementHistoryItem(item),
        }
      : null;

    return { loggerFocus, detailRows };
  };

  const renderAccessoryMovement = (it: WorkoutItem) => {
    const logs = it.set_logs || [];
    const latestLoggedIdx =
      logs.length > 0
        ? Math.max(...logs.map((l) => l.set_index || 0))
        : 0;
    const totalSets = positiveInt(it.sets);
    const loggedCount = logs.length;
    const nextIndex = loggedCount + 1;
    const accessoryDetailKey = `acc:${it.id}`;
    const accessoryIsComplete = totalSets > 0 && loggedCount >= totalSets;
    const accessoryIsExpanded = !!expandedCompletedMovements[accessoryDetailKey];
    const accessorySummary = completedSetSummary(logs, totalSets, unit, 'rir');
    const accessoryState = accessoryIsComplete ? 'complete' : loggedCount > 0 ? 'logged' : 'not_started';
    const lookbackLine = formatLookbackLine(getLookbackBest(it), unit);
    const movementPresentation = buildAccessoryMovementPresentation({
      item: it,
      logs,
      totalSets,
      latestLoggedIdx,
      nextIndex,
      expanded: accessoryIsExpanded,
      isComplete: accessoryIsComplete,
    });
    const swapLabel = canHotSwap ? 'Swap' : Array.isArray(it.approved_subs) && it.approved_subs.length > 0 ? 'Sub' : null;

    return (
      <CoreMovementLedgerRow
        key={it.id}
        state={accessoryState}
        title={it.movement || 'Accessory'}
        variantLabel="Accessory"
        scheme={accessoryTargetLine(it)}
        loggerFocus={accessoryIsExpanded ? movementPresentation.loggerFocus : null}
        expanded={accessoryIsExpanded}
        detailRows={accessoryIsExpanded ? movementPresentation.detailRows : undefined}
        meta={accessoryIsComplete ? accessorySummary.meta : `${loggedCount}/${totalSets || 0} sets logged`}
        top={accessoryIsComplete ? accessorySummary.top : lookbackLine}
        movementNote={it.notes}
        auxAction={
          swapLabel ? (
            <TouchableOpacity
              style={styles.accessoryInlineAction}
              onPress={() => openSwapAcc(it)}
              disabled={savingItemId === it.id}
            >
              <Text style={styles.accessoryInlineActionText}>{swapLabel}</Text>
            </TouchableOpacity>
          ) : null
        }
        onOpen={() => toggleMovementCard(accessoryDetailKey)}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    >
      <SessionCommandStrip
        unit={unit}
        setUnit={setUnit}
        restActive={restActive}
        restSeconds={restSeconds}
        canLog={canLog}
        openTimerPicker={openTimerPicker}
        stopRestTimer={stopRestTimer}
        formatRestTime={formatRestTime}
        loggedSets={loggedSets}
        plannedSets={plannedSets}
        workoutStatus={workout.status}
      />

      {/* Scrollable workout content */}
      <RefreshScreen
        ref={scrollRef}
        style={styles.scrollShell}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{
          paddingBottom: 32,
          flexGrow: 1,
        }}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <SessionIntentPanel
          workout={workout}
          screenMode={screenMode}
          statusStyle={statusStyle}
          statusLabel={prettyStatus(workout.status)}
          focusLine={focusLine}
          loggedSets={loggedSets}
          plannedSets={plannedSets}
          progressPct={progressPct}
          progressSegments={workoutProgressSegments}
          topLoggedText={topLogged ? `${liftDisplayName(topLogged.item)} · ${loggedSetText(topLogged.log, unit)}` : null}
          canBegin={canBegin}
          canEdit={canEdit}
          actionLoading={actionLoading}
          onEditWorkout={handleEditWorkout}
          onBeginWorkout={handleBeginWorkoutPress}
        />
        {!!(workout.programming_notes || '').trim() && (
          <View style={styles.coachFeedbackCard}>
            <Text style={styles.coachFeedbackEyebrow}>Session Notes</Text>
            <Text style={styles.coachFeedbackText}>{workout.programming_notes}</Text>
          </View>
        )}
        {!!(workout.post_session_coach_feedback || '').trim() && (
          <View style={styles.coachFeedbackCard}>
            <Text style={styles.coachFeedbackEyebrow}>{isIndividualUser ? 'Session Feedback' : 'Coach Feedback'}</Text>
            <Text style={styles.coachFeedbackText}>{workout.post_session_coach_feedback}</Text>
          </View>
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

        {/* Core lifts as peer movement ledger rows. */}
        <View style={styles.sectionBlock}>
          {workout.core_items.map((core) => {
            // ... keep the entire core_items.map block exactly as-is ...
            const isStraightLike =
              core.variant === 'STRAIGHT' ||
              core.variant === 'VR' ||
              core.lift === 'VR';

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

            // Logging allowed only when server says this user can log AND workout is in progress
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
              <CoreMovementLedgerRow
                key={core.id}
                state={presentationState}
                title={liftDisplayName(core)}
                variantLabel={variantLabel}
                scheme={schemeNode}
                loggerFocus={detailsExpanded ? movementPresentation.loggerFocus : null}
                expanded={detailsExpanded}
                detailRows={detailsExpanded ? movementPresentation.detailRows : undefined}
                meta={coreIsComplete ? coreSummary.meta : `${coreCompletionLoggedCount}/${coreCompletionTotal || totalSets || 0} sets logged`}
                top={coreIsComplete ? coreSummary.top : formatLookbackLine(getLookbackBest(core), unit)}
                movementNote={core.notes}
                onOpen={() => toggleMovementCard(`core:${core.id}`)}
              />
            );
          })}
        </View>

        {/* Accessories use the same peer movement logger model as core work. */}
        <View style={[styles.sectionBlock, styles.accessorySectionBlock]}>
          {workout.accessory_groups.map((grp, idx) => {
            const isSuperset = !!grp.group;

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
                  onPress={openPostSessionSurvey}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'complete' ? (
                    <ActivityIndicator size="small" color="#020617" />
                  ) : (
                    <Text
                      style={[
                        styles.actionButtonText,
                        styles.actionPrimaryText,
                      ]}
                    >
                      Complete Workout
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  workout.status === 'completed'
                    ? styles.actionPrimary // identical to Begin Workout
                    : styles.actionDanger,
                  actionLoading === 'cancel' && { opacity: 0.7 },
                ]}
                onPress={() => setCancelConfirmVisible(true)}
                disabled={!!actionLoading}
              >
                {actionLoading === 'cancel' ? (
                  <ActivityIndicator size="small" color="#fca5a5" />
                ) : (
                  <Text
                    style={[
                      styles.actionButtonText,
                      workout.status === 'completed'
                        ? styles.actionPrimaryText
                        : styles.actionDangerText,
                    ]}
                  >
                    {workout.status === 'completed' ? 'Resume Workout' : 'Cancel Workout'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
      </RefreshScreen>

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
        animationType="slide"
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
                    <Text style={styles.coreWheelTitleDot}>• </Text>
                    {coreWheel.title}
                  </Text>
                  <Text style={styles.coreWheelSubtitle}>
                    {coreWheel.targetLine ? coreWheel.targetLine : 'Select actuals'}
                  </Text>
                </View>
                <LogSheetUnitToggle unit={unit} onChange={switchLogSheetUnit} />
              </View>

              <View style={styles.coreWheelColumns}>
                <WheelColumn
                  label="Weight"
                  value={coreWheel.weight}
                  options={coreWheel.weightOptions}
                  suffix={unit}
                  onChange={(value) => setCoreWheel((prev) => prev ? { ...prev, weight: value } : prev)}
                />
                <WheelColumn
                  label="Reps"
                  value={coreWheel.reps}
                  options={coreWheel.repsOptions}
                  onChange={(value) => setCoreWheel((prev) => prev ? { ...prev, reps: value } : prev)}
                />
                <WheelColumn
                  label="RPE"
                  value={coreWheel.rpe}
                  options={coreWheel.rpeOptions}
                  onChange={(value) => setCoreWheel((prev) => prev ? { ...prev, rpe: value } : prev)}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.failedSetToggle,
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

              <View style={styles.logVideoChoice}>
                <TouchableOpacity
                  style={styles.logVideoAttachButton}
                  onPress={selectVideoForCoreWheel}
                >
                  <Text style={styles.logVideoAttachText}>
                    {coreWheel.selectedVideo ? 'Change video' : 'Attach video'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.logVideoSkipButton}
                  onPress={() => setCoreWheel((prev) => prev ? { ...prev, selectedVideo: null } : prev)}
                >
                  <Text style={styles.logVideoSkipText}>Skip for now</Text>
                </TouchableOpacity>
                {coreWheel.selectedVideo ? (
                  <View style={styles.logVideoSelectedBlock}>
                    <Text style={styles.logVideoSelectedText} numberOfLines={1}>
                      Video selected · {videoAngleLabel(coreWheel.selectedVideo.videoAngle)}
                    </Text>
                    <View style={styles.logVideoAngleChips}>
                      {VIDEO_ANGLE_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.slug}
                          style={[
                            styles.logVideoAngleChip,
                            coreWheel.selectedVideo?.videoAngle === option.slug && styles.logVideoAngleChipActive,
                          ]}
                          onPress={() => setCoreWheel((prev) => prev?.selectedVideo ? {
                            ...prev,
                            selectedVideo: { ...prev.selectedVideo, videoAngle: option.slug },
                          } : prev)}
                        >
                          <Text
                            style={[
                              styles.logVideoAngleChipText,
                              coreWheel.selectedVideo?.videoAngle === option.slug && styles.logVideoAngleChipTextActive,
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
                        const active = (coreWheel.selectedVideo?.submitForReview !== false) === option.submitForReview;
                        return (
                          <TouchableOpacity
                            key={option.title}
                            style={[styles.logVideoIntentOption, active && styles.logVideoIntentOptionActive]}
                            onPress={() => setCoreWheel((prev) => prev?.selectedVideo ? {
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
                  </View>
                ) : null}
              </View>

              <View style={styles.coreWheelActions}>
                <TouchableOpacity style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]} onPress={() => setCoreWheel(null)}>
                  <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]} onPress={commitCoreWheel}>
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Log Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={!!accessoryWheel?.visible}
        transparent
        animationType="slide"
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
                <LogSheetUnitToggle unit={unit} onChange={switchLogSheetUnit} />
              </View>

              <View style={styles.coreWheelColumns}>
                <WheelColumn
                  label="Weight"
                  value={accessoryWheel.weight}
                  options={accessoryWheel.weightOptions}
                  suffix={unit}
                  onChange={(value) => setAccessoryWheel((prev) => prev ? { ...prev, weight: value } : prev)}
                />
                <WheelColumn
                  label="Reps"
                  value={accessoryWheel.reps}
                  options={accessoryWheel.repsOptions}
                  onChange={(value) => setAccessoryWheel((prev) => prev ? { ...prev, reps: value } : prev)}
                />
                <WheelColumn
                  label="RIR"
                  value={accessoryWheel.rir}
                  options={accessoryWheel.rirOptions}
                  onChange={(value) => setAccessoryWheel((prev) => prev ? { ...prev, rir: value } : prev)}
                />
              </View>

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
                <TouchableOpacity style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]} onPress={() => setAccessoryWheel(null)}>
                  <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]} onPress={commitAccessoryWheel}>
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Log Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
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
        visible={!!movementHistoryItem}
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
            const recent = (history?.recent_sessions && history.recent_sessions.length > 0)
              ? history.recent_sessions
              : ((history?.recent_sets || []).slice(0, 5));
            return (
              <View style={styles.movementHistorySheet}>
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
                </View>

                {assisted ? (
                  <Text style={styles.movementHistoryAssistNote}>
                    Lower assistance can indicate improvement for this movement.
                  </Text>
                ) : null}

                <View style={styles.movementHistoryStats}>
                  <View style={styles.movementHistoryStatCard}>
                    <Text style={styles.movementHistoryLabel}>Most Recent</Text>
                    <Text style={styles.movementHistoryValue}>
                      {formatMovementHistorySet(history?.most_recent_logged_set, unit, assisted)}
                    </Text>
                  </View>
                  <View style={styles.movementHistoryStatCard}>
                    <Text style={styles.movementHistoryLabel}>Best</Text>
                    <Text style={styles.movementHistoryValue}>
                      {formatMovementHistorySet(history?.best_logged_set, unit, assisted)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.movementHistorySectionTitle}>Recent History</Text>
                <ScrollView style={styles.movementHistoryList}>
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
                    <Text style={styles.movementHistoryEmpty}>No prior matching accessory history yet.</Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.actionButton, styles.actionSecondary, { marginTop: 12 }]}
                  onPress={() => setMovementHistoryItem(null)}
                >
                  <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Close</Text>
                </TouchableOpacity>
              </View>
            );
          })() : null}
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.editSetKeyboardRoot}
        >
          <View style={[styles.modalBackdrop, styles.editSetModalBackdrop]}>
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFillObject}
              onPress={Keyboard.dismiss}
              accessibilityLabel="Dismiss keyboard"
            />
          <View style={[styles.modalCard, styles.editSetModalWide, styles.editSetModalCard]}>
            <View style={styles.modalSheetHandle} />
            <Text style={styles.postSessionTitle}>{editSetCtx?.title || 'Edit Set'}</Text>
            <Text style={styles.modalSubtitle}>Update the logged values for this set.</Text>

            <ScrollView
              style={styles.editSetModalScroll}
              contentContainerStyle={styles.editSetModalScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.loggedSummaryPill}>
                <View style={styles.loggedSummaryIcon}>
                  <Text style={styles.loggedSummaryIconText}>✓</Text>
                </View>
                <Text style={styles.loggedSummaryLabel}>Currently logged</Text>
                <Text style={styles.loggedSummaryValue}>
                  {editSetForm.weight || '—'} {unit} × {editSetForm.reps || '—'}
                  {editSetCtx?.mode === 'rpe'
                    ? ` @ RPE ${editSetForm.rpe || '—'}`
                    : ` @ ${editSetForm.rir || '—'} RIR`}
                </Text>
              </View>

              <Text style={styles.modalSectionKicker}>Set Details</Text>

              <View style={styles.modalRow}>
                <View style={[styles.modalFieldBlock, styles.modalFieldInline]}>
                  <Text style={styles.modalLabel}>Weight ({unit})</Text>
                  <View style={styles.modalValueCard}>
                    <TextInput
                      style={styles.modalValueInput}
                      value={editSetForm.weight}
                      onChangeText={(txt) =>
                        setEditSetForm((prev) => ({
                          ...prev,
                          weight: txt.replace(/[^0-9.]/g, ''),
                        }))
                      }
                      placeholder="—"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <Text style={styles.modalValueUnit}>{unit}</Text>
                  </View>
                </View>

                <View style={[styles.modalFieldBlock, styles.modalFieldInline]}>
                  <Text style={styles.modalLabel}>Reps</Text>
                  <View style={styles.modalValueCard}>
                    <TextInput
                      style={styles.modalValueInput}
                      value={editSetForm.reps}
                      onChangeText={(txt) =>
                        setEditSetForm((prev) => ({
                          ...prev,
                          reps: txt.replace(/[^0-9]/g, ''),
                        }))
                      }
                      placeholder="—"
                      placeholderTextColor="#64748b"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <Text style={styles.modalValueUnit}>reps</Text>
                  </View>
                </View>

                {editSetCtx?.mode === 'rpe' ? (
                  <View style={[styles.modalFieldBlock, styles.modalFieldInline]}>
                    <Text style={styles.modalLabel}>RPE</Text>
                    <View style={styles.modalValueCard}>
                      <TextInput
                        style={styles.modalValueInput}
                        value={editSetForm.rpe}
                        onChangeText={(txt) =>
                          setEditSetForm((prev) => ({
                            ...prev,
                            rpe: txt.replace(/[^0-9.]/g, ''),
                          }))
                        }
                        placeholder="—"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      <Text style={styles.modalValueUnit}>/10</Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.modalFieldBlock, styles.modalFieldInline]}>
                    <Text style={styles.modalLabel}>RIR</Text>
                    <View style={styles.modalValueCard}>
                      <TextInput
                        style={styles.modalValueInput}
                        value={editSetForm.rir}
                        onChangeText={(txt) =>
                          setEditSetForm((prev) => ({
                            ...prev,
                            rir: txt.replace(/[^0-9.\\-]/g, '').replace(/(?!^)-/g, ''),
                          }))
                        }
                        placeholder="—"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      <Text style={styles.modalValueUnit}>RIR</Text>
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.failedSetToggle,
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
            </ScrollView>

            {/* P0 mobile invariant: keyboard must never cover modal composer/action rows. */}
            <View style={styles.modalActionsRow}>
              {editSetCtx?.canUndoDelete && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionDanger, { flex: 1 }]}
                  onPress={deleteEditedSet}
                  disabled={editSetSubmitting}
                >
                  {editSetSubmitting ? (
                    <ActivityIndicator size="small" color="#fca5a5" />
                  ) : (
                    <Text style={[styles.actionButtonText, styles.actionDangerText]}>Undo Set Log</Text>
                  )}
                </TouchableOpacity>
              )}

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
                <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
                onPress={saveEditedSet}
                disabled={editSetSubmitting}
              >
                {editSetSubmitting ? (
                  <ActivityIndicator size="small" color="#020617" />
                ) : (
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHelperLine}>Changes will update this set across all views.</Text>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={postSessionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!postSessionSubmitting) setPostSessionVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCard, styles.postSessionModal]}>
                <Text style={styles.postSessionTitle}>Post-Session Survey</Text>
                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Session RPE</Text>
                  <View style={styles.surveyChipRow}>
                    {[6, 7, 8, 9, 10].map((value) => {
                      const selected = postSessionForm.sessionRpe === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.surveyChip, selected && styles.surveyChipActive]}
                          onPress={() =>
                            setPostSessionForm((prev) => ({
                              ...prev,
                              sessionRpe: value,
                            }))
                          }
                        >
                          <Text style={[styles.surveyChipText, selected && styles.surveyChipTextActive]}>
                            {value}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Perceived Strength</Text>
                  <View style={styles.surveyChoiceStack}>
                    {[
                      ['weaker', 'Weaker'],
                      ['normal', 'Normal'],
                      ['stronger', 'Stronger'],
                    ].map(([value, label]) => {
                      const selected = postSessionForm.strengthFeeling === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.surveyChoiceButton, selected && styles.surveyChoiceButtonActive]}
                          onPress={() =>
                            setPostSessionForm((prev) => ({
                              ...prev,
                              strengthFeeling: value as any,
                            }))
                          }
                        >
                          <Text style={[styles.surveyChoiceText, selected && styles.surveyChoiceTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Perceived Fatigue</Text>
                  <View style={styles.surveyChoiceStack}>
                    {[
                      ['low', 'Low'],
                      ['medium', 'Medium'],
                      ['high', 'High'],
                    ].map(([value, label]) => {
                      const selected = postSessionForm.fatigueFeeling === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.surveyChoiceButton, selected && styles.surveyChoiceButtonActive]}
                          onPress={() =>
                            setPostSessionForm((prev) => ({
                              ...prev,
                              fatigueFeeling: value as any,
                            }))
                          }
                        >
                          <Text style={[styles.surveyChoiceText, selected && styles.surveyChoiceTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Notes</Text>
                  <TextInput
                    style={[styles.modalInput, styles.surveyNoteInput]}
                    value={postSessionForm.note}
                    onChangeText={(txt) =>
                      setPostSessionForm((prev) => ({
                        ...prev,
                        note: txt,
                      }))
                    }
                    placeholder="Sleep was bad, low back felt tight, bench moved well, etc."
                    placeholderTextColor="#64748b"
                    multiline
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>

                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                    onPress={skipPostSessionAndComplete}
                    disabled={postSessionSubmitting}
                  >
                    <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>
                      Skip & Complete
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionPrimary, { flex: 1.2 }]}
                    onPress={submitPostSessionAndComplete}
                    disabled={postSessionSubmitting}
                  >
                    {postSessionSubmitting ? (
                      <ActivityIndicator size="small" color="#020617" />
                    ) : (
                      <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
                        Submit & Complete
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
        startRestTimer={startRestTimer}
        onClose={() => setTimerPickerVisible(false)}
        styles={styles}
      />

      {/* Readiness survey modal (mobile only, shown on Begin Workout) */}
      <Modal
        visible={readinessVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!readinessSubmitting) setReadinessVisible(false);
        }}
      >
        <View style={styles.modalBackdropCenter}>
          <View style={[styles.modalCard, styles.readinessModal]}>
            <Text style={styles.postSessionTitle}>Quick readiness check</Text>

            {/* Sleep */}
            <Text style={styles.readinessQuestionLabel}>
              Sleep quality (1 = poor, 5 = great)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`sleep-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, sleep_quality: n }))}
                  style={[
                    styles.readinessScalePill,
                    n === readinessForm.sleep_quality && styles.readinessScalePillActive,
                  ]}
                >
                  <Text style={styles.readinessScalePillText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Energy */}
            <Text style={[styles.readinessQuestionLabel, styles.readinessQuestionSpaced]}>
              Energy (1 = drained, 5 = energized)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`fatigue-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, fatigue: n }))}
                  style={[
                    styles.readinessScalePill,
                    n === readinessForm.fatigue && styles.readinessScalePillActive,
                  ]}
                >
                  <Text style={styles.readinessScalePillText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Soreness */}
            <Text style={[styles.readinessQuestionLabel, styles.readinessQuestionSpaced]}>
              Soreness (1 = fresh, 5 = very sore)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`sore-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, soreness: n }))}
                  style={[
                    styles.readinessScalePill,
                    n === readinessForm.soreness && styles.readinessScalePillActive,
                  ]}
                >
                  <Text style={styles.readinessScalePillText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stress */}
            <Text style={[styles.readinessQuestionLabel, styles.readinessQuestionSpaced]}>
              Stress (1 = relaxed, 5 = high stress)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`stress-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, stress: n }))}
                  style={[
                    styles.readinessScalePill,
                    n === readinessForm.stress && styles.readinessScalePillActive,
                  ]}
                >
                  <Text style={styles.readinessScalePillText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionsRow}>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
                onPress={() => submitReadinessAndBegin({ skipped: false })}
                disabled={readinessSubmitting}
              >
                {readinessSubmitting ? (
                  <ActivityIndicator size="small" color="#0B0F1A" />
                ) : (
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Submit</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionDanger, { flex: 1 }]}
                onPress={() => {
                  if (!readinessSubmitting) {
                    setReadinessVisible(false);
                    setPendingBeginWorkoutId(null);
                  }
                }}
                disabled={readinessSubmitting}
              >
                <Text style={styles.actionDangerText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Accessory substitution modal */}
      <Modal
        visible={swapAccVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwapAccVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.swapModalWide]}>
            <View style={styles.modalSheetHandle} />
            <View style={styles.swapHeaderRow}>
              <View style={styles.swapHeaderSpacer} />
              <Text style={styles.postSessionTitle}>
                {canHotSwap ? 'Swap accessory' : 'Substitute accessory'}
              </Text>
              <TouchableOpacity style={styles.swapCloseButton} onPress={() => setSwapAccVisible(false)}>
                <Text style={styles.swapCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {canHotSwap
                ? 'Update the accessory movement and prescription.'
                : isIndividualUser
                  ? 'Select one of the approved substitutions below.'
                  : 'Select one of the coach-approved substitutions below.'}
            </Text>

            {canHotSwap ? (
              <>
                <Text style={styles.modalSectionKicker}>Movement</Text>
                <View style={styles.swapMovementField}>
                  <Text style={styles.swapSearchIcon}>⌕</Text>
                  <TextInput
                    style={styles.swapMovementInput}
                    placeholder="Movement (e.g., Lat Pulldown)"
                    placeholderTextColor="#64748b"
                    value={swapAccForm.movement}
                    onChangeText={(t) => setSwapAccForm((p) => ({ ...p, movement: t }))}
                  />
                  {swapAccForm.movement ? (
                    <TouchableOpacity onPress={() => setSwapAccForm((p) => ({ ...p, movement: '' }))}>
                      <Text style={styles.swapClearText}>×</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.modalSectionKicker}>Prescription</Text>
                <View style={styles.readinessScaleRow}>
                  <View style={[styles.swapPrescriptionCard, { flex: 1 }]}>
                    <Text style={styles.modalLabel}>Sets</Text>
                    <TextInput
                      style={styles.swapPrescriptionInput}
                      placeholder="—"
                      placeholderTextColor="#64748b"
                      keyboardType="number-pad"
                      value={swapAccForm.sets}
                      onChangeText={(t) =>
                        setSwapAccForm((p) => ({ ...p, sets: (t ?? '').replace(/[^0-9]/g, '') }))
                      }
                    />
                    <Text style={styles.modalValueUnit}>sets</Text>
                  </View>
                  <View style={[styles.swapPrescriptionCard, { flex: 1 }]}>
                    <Text style={styles.modalLabel}>Reps</Text>
                    <TextInput
                      style={styles.swapPrescriptionInput}
                      placeholder="—"
                      placeholderTextColor="#64748b"
                      value={swapAccForm.reps_text}
                      onChangeText={(t) => setSwapAccForm((p) => ({ ...p, reps_text: t }))}
                    />
                    <Text style={styles.modalValueUnit}>reps</Text>
                  </View>
                  <View style={[styles.swapPrescriptionCard, { flex: 1 }]}>
                    <Text style={styles.modalLabel}>RIR</Text>
                    <TextInput
                      style={styles.swapPrescriptionInput}
                      placeholder="—"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                      value={swapAccForm.rir}
                      onChangeText={(t) => setSwapAccForm((p) => ({ ...p, rir: t }))}
                    />
                    <Text style={styles.modalValueUnit}>RIR</Text>
                  </View>
                </View>

                <View style={styles.swapSummaryCard}>
                  <Text style={styles.swapSummaryIcon}>↔</Text>
                  <View style={styles.swapSummaryCopy}>
                    <Text style={styles.swapSummaryTitle}>
                      This will update {swapAccItem?.movement || 'this accessory'}
                    </Text>
                    <Text style={styles.swapSummaryText}>
                      {swapAccForm.sets || '—'}×{swapAccForm.reps_text || '—'} @ {swapAccForm.rir || '—'} RIR
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={{ gap: 8, marginTop: 10 }}>
                  {(() => {
                    const prescribed = String(
                      swapAccItem?.original_movement || swapAccItem?.movement || ''
                    ).trim();

                    const approved = Array.isArray(swapAccItem?.approved_subs)
                      ? swapAccItem.approved_subs
                      : [];

                    const options: string[] = [];
                    const seen = new Set<string>();

                    [prescribed, ...approved].forEach((mv) => {
                      const clean = String(mv || '').trim();
                      if (!clean) return;
                      const key = clean.toLowerCase();
                      if (seen.has(key)) return;
                      seen.add(key);
                      options.push(clean);
                    });

                    const currentActive = String(
                      swapAccItem?.selected_sub_movement || swapAccItem?.movement || ''
                    ).trim();

                    return options.map((movement) => {
                      const selected = swapAccForm.movement === movement;
                      const isPrescribed = prescribed !== '' && movement === prescribed;
                      const isActive = currentActive !== '' && movement === currentActive;

                      return (
                        <TouchableOpacity
                          key={movement}
                          style={[
                            styles.swapOptionButton,
                            selected && styles.swapOptionButtonActive,
                          ]}
                          onPress={() => setSwapAccForm((p) => ({ ...p, movement }))}
                        >
                          <Text style={[styles.swapOptionText, selected && styles.swapOptionTextActive]}>
                            {movement}
                            {isPrescribed ? ' (Prescribed)' : ''}
                            {isActive ? ' (Active)' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>

                <Text style={[styles.modalSubtitle, { marginTop: 10 }]}>
                  Keeps the same sets, reps, and RIR by default.
                </Text>
              </>
            )}
            
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                onPress={() => setSwapAccVisible(false)}
              >
                <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
                onPress={saveSwapAcc}
                disabled={savingItemId != null}
              >
                {savingItemId === swapAccItem?.id ? (
                  <ActivityIndicator size="small" color="#0B0F1A" />
                ) : (
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 14,
  },

  errorText: {
    color: '#f87171',
    textAlign: 'center',
    paddingHorizontal: 24,
    fontSize: 15,
  },

  // --- section blocks ---
  sectionBlock: {
    marginBottom: 20,
  },

  accessorySectionBlock: {
    marginTop: 6,
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 10,
  },

  coreSchemeDetail: {
    color: '#A5B4FC',
    fontWeight: '600',
  },

  // --- accessories ---
  supersetCard: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },


  supersetHeader: {
    marginBottom: 8,
  },

  supersetBadge: {
    color: '#ECE5DA',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  supersetRow: {
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.055)',
    backgroundColor: 'rgba(24,16,15,0.20)',
  },

  accCard: {
    borderRadius: 10,
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
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f9fafb',
    fontSize: 14,
    backgroundColor: 'rgba(24,16,15,0.42)',
    marginBottom: 8,
  },


  accMeta: {
    color: '#B8ACA1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  accProgressText: {
    color: '#8E84CC',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  completedMovementSummary: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
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
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800',
  },
  completedMovementBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(134,239,172,0.14)',
    backgroundColor: 'rgba(134,239,172,0.045)',
  },
  completedMovementBadgeText: {
    color: '#A7CBB5',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  completedMovementMeta: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 7,
  },
  completedMovementTop: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 3,
  },
  completedMovementAction: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.22)',
    backgroundColor: 'rgba(91,79,207,0.09)',
  },
  completedMovementActionText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '900',
  },
  coachFeedbackCard: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,203,181,0.16)',
    backgroundColor: 'rgba(18,32,28,0.58)',
  },
  coachFeedbackEyebrow: {
    color: '#A7CBB5',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  coachFeedbackText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  cardMeta: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },


  lookbackText: {
    color: '#64748B',
    fontSize: 13,
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.24)',
    backgroundColor: 'rgba(91,79,207,0.10)',
  },
  movementHistoryButtonText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '900',
  },

  setLogsBlock: {
    marginTop: 4,
  },
  setLogLine: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
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
    backgroundColor: '#A7CBB5',
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
    color: '#64748B',
    fontSize: 13,
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
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  setVideoStatusAttached: {
    color: '#A7F3D0',
  },
  setVideoStatusError: {
    color: '#FCA5A5',
  },
  setVideoPreviewTile: {
    flex: 1,
    minHeight: 54,
    borderRadius: 10,
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
    borderRadius: 19,
    backgroundColor: 'rgba(134,239,172,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setVideoPlayText: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '900',
  },
  setVideoMeta: {
    flex: 1,
    minWidth: 0,
  },
  setVideoTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  setVideoAngleText: {
    color: '#A5B4FC',
    fontSize: 11,
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
    borderRadius: 10,
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
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '800',
  },
  setVideoRemoveButton: {
    borderColor: 'rgba(248,113,113,0.34)',
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  setVideoRemoveButtonText: {
    color: '#FECACA',
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  videoPlayerCloseText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '900',
  },
  videoPlayerFrame: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.22)',
    backgroundColor: 'rgba(8,12,22,0.66)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  videoHudBottomLeft: {
    position: 'absolute',
    left: 10,
    bottom: 66,
    maxWidth: '68%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.22)',
    backgroundColor: 'rgba(8,12,22,0.68)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  videoHudCloseButton: {
    position: 'absolute',
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.22)',
    backgroundColor: 'rgba(8,12,22,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  videoHudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoHudKicker: {
    color: '#A7F3D0',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  videoHudTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
    lineHeight: 17,
  },
  videoHudSubtext: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    lineHeight: 14,
  },
  videoHudStatusText: {
    color: '#DCFCE7',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.2)',
    backgroundColor: 'rgba(22,101,52,0.28)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  videoHudLine: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },
  videoHudLabel: {
    color: '#A7F3D0',
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
    color: '#E0E7FF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
  },
  videoPlayerErrorText: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  videoPlayerRetryButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.36)',
    backgroundColor: 'rgba(129,140,248,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 12,
  },
  videoPlayerRetryText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '900',
  },
  logVideoChoice: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  logVideoAttachButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.34)',
    backgroundColor: 'rgba(139,92,246,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  logVideoAttachText: {
    color: '#E0E7FF',
    fontSize: 13,
    fontWeight: '900',
  },
  logVideoSkipButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
    backgroundColor: 'rgba(5,10,20,0.50)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  logVideoSkipText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '800',
  },
  logVideoSelectedText: {
    flexBasis: '100%',
    color: '#A7F3D0',
    fontSize: 12,
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
    borderRadius: 999,
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
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
  },
  logVideoAngleChipTextActive: {
    color: '#E0E7FF',
  },
  logVideoIntentGroup: {
    marginTop: 8,
    gap: 8,
  },
  logVideoIntentTitle: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '900',
  },
  logVideoIntentOption: {
    borderRadius: 12,
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
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '900',
  },
  logVideoIntentOptionTitleActive: {
    color: '#E0E7FF',
  },
  logVideoIntentOptionBody: {
    color: '#94A3B8',
    fontSize: 11,
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
    borderRadius: 16,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    minWidth: 44,
    textAlign: 'right',
  },
  unitToggleOption: {
    minWidth: 50,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 11,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
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
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(10,14,28,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(109,91,208,0.10)',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  timerPickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    backgroundColor: '#0f172a',
  },
  timerOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  timerPickerCancel: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  timerWheelWrap: {
    marginTop: 18,
    marginBottom: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(24,16,15,0.36)',
    overflow: 'hidden',
    height: 220,
    position: 'relative',
  },
  timerWheel: {
    height: 220,
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
    backgroundColor: '#020617',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: '82%',
  },
  movementHistoryAssistNote: {
    color: '#FBBF24',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  movementHistoryStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  movementHistoryStatCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,23,42,0.72)',
    padding: 12,
  },
  movementHistoryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  movementHistoryValue: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  movementHistorySectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  movementHistoryList: {
    maxHeight: 260,
  },
  movementHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    marginBottom: 8,
  },
  movementHistoryDate: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  movementHistoryRowValue: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'right',
  },
  movementHistoryEmpty: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  readinessModal: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  readinessQuestionLabel: {
    color: '#E2E8F0',
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 13,
    textAlign: 'center'
  },

  readinessQuestionSpaced: {
    marginTop: 14,
  },
  readinessScalePill: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(148,163,184,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  readinessScalePillActive: {
    borderColor: 'rgba(109,91,208,0.50)',
    backgroundColor: 'rgba(109,91,208,0.10)',
  },

  readinessScalePillText: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 13,
  },
  readinessScaleRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },

  readinessHelp: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
  },
  readinessRow: {
    marginTop: 10,
  },
  readinessLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 6,
  },
  readinessPills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  readinessPill: {
    width: 36,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.10)',
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
    fontSize: 14,
    lineHeight: 20,
    color: '#C7D2FE',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalBody: {
    color: '#94A3B8',
    marginBottom: 14,
    lineHeight: 20,
    fontSize: 14,
    textAlign: 'left',
  },
  modalBtnGhost: {
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderColor: 'rgba(148,163,184,0.18)',
  },
  modalFieldBlock: {
    marginBottom: 10,
  },
  editSetKeyboardRoot: {
    flex: 1,
  },
  editSetModalBackdrop: {
    justifyContent: 'flex-end',
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 18 : 14,
  },
  editSetModalWide: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  editSetModalCard: {
    maxHeight: '92%',
  },
  editSetModalScroll: {
    maxHeight: 360,
  },
  editSetModalScrollContent: {
    paddingBottom: 4,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalFieldInline: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#A78BFA',
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
    paddingTop: 4,
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
  timerBarWrapper: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 14,
  },

  scrollShell: {
    flex: 1,
    backgroundColor: 'transparent',
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
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    lineHeight: 19,
  },
  coreTarget: {
    fontSize: 13,
    color: '#8E84CC',
    marginTop: 4,
  },

  actualText: {
    fontSize: 13,
    color: '#A7CBB5',
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(91,79,207,0.7)',
    backgroundColor: 'rgba(91,79,207,0.12)',
  },
  swapPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  accessoryInlineAction: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  accessoryInlineActionText: {
    color: '#AFA4C8',
    fontSize: 11,
    fontWeight: '800',
  },
  swapOptionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,20,36,0.55)',
    justifyContent: 'flex-start',
  },

  swapOptionButtonActive: {
    borderColor: 'rgba(109,91,208,0.22)',
    backgroundColor: 'rgba(109,91,208,0.08)',
  },

  swapOptionText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },

  swapOptionTextActive: {
    color: '#E2E8F0',
  },
  accTitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    flex: 1,
  },
  accRir: {
    color: '#F59E0B',
  },
  setLabel: {
    color: '#A9A3CF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },

  setTargetInline: {
    color: '#8E84CC',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  logInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(15,20,36,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    paddingHorizontal: 12,
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
  },

  logInputActive: {
    borderColor: 'rgba(109,91,208,0.22)',
    backgroundColor: 'rgba(15,20,36,0.86)',
  },

  logButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(91,79,207,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  logButtonText: {
    color: '#F5F3FF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  coreWheelButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.28)',
    backgroundColor: 'rgba(91,79,207,0.92)',
  },
  coreWheelButtonText: {
    color: '#F5F3FF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  coreRepeatLastButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.24)',
    backgroundColor: 'rgba(91,79,207,0.10)',
  },
  coreRepeatLastButtonText: {
    color: '#C4B5FD',
    fontSize: 12,
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
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.20)',
    backgroundColor: 'rgba(91,79,207,0.09)',
  },
  quickChipText: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '800',
  },
  undoButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.9)',
    backgroundColor: 'transparent',
  },
  undoButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  actionPrimary: {
    backgroundColor: '#6D28D9',
    borderColor: 'rgba(196,181,253,0.32)',
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  actionPrimaryText: {
    color: '#F5F3FF',
  },
  unitTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,20,36,0.32)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
  },

  unitToggleOptionActive: {
    backgroundColor: 'rgba(91,79,207,0.28)',
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  unitToggleText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'lowercase',
  },

  unitToggleTextActive: {
    color: '#E5E7EB',
  },
  timerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,20,36,0.18)',
  },
  timerStopButton: {
    borderColor: 'rgba(239,68,68,0.24)',
    backgroundColor: 'rgba(127,29,29,0.20)',
  },
  timerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  timerWheelText: {
    color: '#B8ACA1',
    fontSize: 18,
    fontWeight: '700',
  },
  timerWheelTextActive: {
    color: '#F5F3FF',
    fontSize: 23,
    fontWeight: '900',
  },
  timerWheelCenterIndicator: {
    position: 'absolute',
    top: 88,
    left: 6,
    right: 6,
    height: 44,
    borderRadius: 13,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
    backgroundColor: 'rgba(91,79,207,0.085)',
    zIndex: 5,
  },
  errorBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    borderRadius: 12,
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
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBannerClose: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.6)',
    backgroundColor: 'rgba(127,29,29,0.6)',
  },
  errorBannerCloseText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  actionSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
    backgroundColor: 'rgba(9,14,25,0.70)',
  },
  actionSecondaryText: {
    color: '#E2E8F0',
  },
  inlineEditButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.35)',
    backgroundColor: 'rgba(129,140,248,0.10)',
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    backgroundColor: 'rgba(9,14,25,0.98)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  coreWheelBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,6,23,0.70)',
  },
  coreWheelBackdropHit: {
    flex: 1,
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
  coreWheelHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
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
    color: '#F8FAFC',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'left',
  },
  coreWheelTitleDot: {
    color: '#8B5CF6',
  },
  coreWheelSubtitle: {
    color: '#A5B4FC',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'left',
    marginTop: 4,
  },
  coreWheelColumns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  coreWheelColumn: {
    flex: 1,
    minWidth: 0,
  },
  coreWheelColumnLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textAlign: 'center',
    marginBottom: 8,
  },
  coreWheelScrollFrame: {
    height: CORE_WHEEL_ROW_HEIGHT * CORE_WHEEL_VISIBLE_ROWS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(5,10,20,0.76)',
    overflow: 'hidden',
  },
  coreWheelCenterBand: {
    position: 'absolute',
    left: 5,
    right: 5,
    top: CORE_WHEEL_ROW_HEIGHT * Math.floor(CORE_WHEEL_VISIBLE_ROWS / 2),
    height: CORE_WHEEL_ROW_HEIGHT,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.76)',
    backgroundColor: 'rgba(109,40,217,0.76)',
    zIndex: 4,
  },
  coreWheelScroll: {
    flex: 1,
  },
  coreWheelScrollContent: {
    paddingHorizontal: 0,
  },
  coreWheelOption: {
    height: CORE_WHEEL_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  coreWheelOptionText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  coreWheelOptionTextActive: {
    color: '#F5F3FF',
    fontSize: 19,
    fontWeight: '900',
  },
  coreWheelActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  failedSetToggle: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.42)',
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  failedSetToggleActive: {
    borderColor: 'rgba(248,113,113,0.72)',
    backgroundColor: 'rgba(127,29,29,0.46)',
  },
  failedSetToggleText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '800',
  },
  failedSetToggleTextActive: {
    color: '#FEE2E2',
  },
  modalSheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.46)',
    marginBottom: 14,
  },
  modalSectionKicker: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 2,
  },
  loggedSummaryPill: {
    minHeight: 52,
    borderRadius: 999,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.76)',
  },
  loggedSummaryIconText: {
    color: '#2DD4BF',
    fontSize: 14,
    fontWeight: '900',
  },
  loggedSummaryLabel: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
  loggedSummaryValue: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  modalValueCard: {
    minHeight: 88,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(5,10,20,0.74)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  modalValueInput: {
    color: '#F8FAFC',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
    padding: 0,
    margin: 0,
  },
  modalValueUnit: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  modalHelperLine: {
    color: '#A78BFA',
    fontSize: 12,
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
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapCloseText: {
    color: '#E5E7EB',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  swapMovementField: {
    minHeight: 54,
    borderRadius: 13,
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
    color: '#CBD5E1',
    fontSize: 24,
    fontWeight: '500',
  },
  swapMovementInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 0,
  },
  swapClearText: {
    color: '#CBD5E1',
    fontSize: 25,
    fontWeight: '400',
  },
  swapPrescriptionCard: {
    minHeight: 88,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(5,10,20,0.74)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  swapPrescriptionInput: {
    color: '#F8FAFC',
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    padding: 0,
    margin: 0,
  },
  swapSummaryCard: {
    marginTop: 16,
    borderRadius: 13,
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
    color: '#2DD4BF',
    fontSize: 25,
    fontWeight: '900',
  },
  swapSummaryCopy: {
    flex: 1,
  },
  swapSummaryTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  swapSummaryText: {
    color: '#C7D2FE',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 3,
  },
  modalTitle: {
    color: '#E2E8F0',
    marginBottom: 6,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: -0.2,
    textAlign: 'left',
  },
  modalBtnDanger: {
    backgroundColor: 'rgba(127,29,29,0.92)',
    borderColor: 'rgba(239,68,68,0.32)',
  },
  modalBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#1f2933',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#CBD5E1',
    fontSize: 14,
    backgroundColor: '#0B0F1A',
  },
  postSessionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 8,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  surveyLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  surveyChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  surveyChipActive: {
    backgroundColor: '#CBD5E1',
    borderColor: '#CBD5E1',
  },
  surveyChipText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
  surveyChipTextActive: {
    color: '#0B0F1A',
  },
  surveyChoiceButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B0F1A',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  surveyChoiceButtonActive: {
    borderColor: '#CBD5E1',
    backgroundColor: '#111c2f',
  },
  surveyChoiceText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
  },
  surveyChoiceTextActive: {
    color: '#E2E8F0',
  },
  actionDanger: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.24)',
    borderWidth: 1,
  },
  actionDangerText: {
    color: '#FECACA',
    fontWeight: '700',
  },
});
