import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

import { API_BASE, fetchJson, getSetVideoDownloadExportsStatus, getSetVideoExportStatus, type SetVideoExportOptions } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { SLColors, SLRadius, SLShadows, SLTypography } from '@/constants/theme';
import { formatWeightFromKg, kilogramsToDisplayValue, normalizeDisplayWeightUnit, type DisplayWeightUnit } from '@/lib/display-units';

const STRENGTH_LEDGER_LOGO = require('@/assets/images/Instagram Profile.png');

const EXPORT_PREVIEW_ASPECT = 9 / 16;
const EXPORT_OVERLAY = {
  logo: {
    top: '1.67%',
    right: '2.96%',
    width: '10.75%',
  },
  topHud: {
    top: '2.29%',
    left: '3.15%',
    width: '71.3%',
  },
  bottomHud: {
    left: '3.15%',
    right: '18.15%',
    bottom: '3.75%',
  },
} as const;

export type SetVideoContext = {
  athlete_name?: string | null;
  session_date?: string | null;
  workout_label?: string | null;
  lift_name?: string | null;
  movement_name?: string | null;
  designation?: string | null;
  set_index?: number | null;
  set_display_label?: string | null;
  set_context_label?: string | null;
  prescription_label?: string | null;
  prescription?: {
    reps?: number | null;
    reps_text?: string | null;
    rpe_target?: number | null;
    rir_target?: number | null;
    pct?: number | null;
    target_kg?: number | null;
    target_low_kg?: number | null;
    target_high_kg?: number | null;
  } | null;
  actual_reps?: number | null;
  actual_weight_kg?: number | null;
  actual_weight_label?: string | null;
  actual_rpe?: number | null;
  preferred_units?: string | null;
};
const MAX_EXPORT_DURATION_SECONDS = 30;

export type SetVideoReviewTag = string | { slug?: string | null; label?: string | null } | null | undefined;

export type SetVideoCoachingFocusCue = {
  id?: number | null;
  text?: string | null;
  sort_order?: number | null;
};

export type SetVideoCoachingFocus = {
  available?: boolean;
  lift?: 'SQ' | 'BN' | 'DL' | string | null;
  label?: string | null;
  cues?: SetVideoCoachingFocusCue[] | null;
  message?: string | null;
};

export type SetVideoSummary = {
  id: number;
  set_log_id?: number | null;
  review_status?: string | null;
  review_status_label?: string | null;
  submitted_for_review?: boolean;
  submission_status?: string | null;
  submission_status_label?: string | null;
  upload_status?: string | null;
  has_feedback?: boolean;
  has_coach_feedback?: boolean;
  url?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  video_angle?: string | null;
  video_angle_label?: string | null;
  thumbnail_url?: string | null;
  coach_feedback?: string | null;
  coach_private_notes?: string | null;
  review_tags?: SetVideoReviewTag[] | null;
  coaching_focus?: SetVideoCoachingFocus | null;
  can_export?: boolean;
  export_permission_error?: string | null;
  download_exports?: {
    state?: 'ready' | 'preparing' | 'failed' | string;
    exports?: Record<string, {
      id?: number;
      status?: string;
      weight_unit?: 'kg' | 'lbs' | string;
      download_url?: string | null;
      url?: string | null;
      error?: string | null;
      error_message?: string | null;
    } | null>;
    ready_units?: string[];
    failed_units?: string[];
    preparing_units?: string[];
  } | null;
  download_exports_status_url?: string | null;
  context?: SetVideoContext | null;
};

type Props = {
  visible: boolean;
  videoId: number | null;
  initialUrl?: string | null;
  initialVideo?: SetVideoSummary | null;
  refreshPath?: string | null;
  showPlaybackSpeedControls?: boolean;
  reviewPanel?: React.ReactNode;
  hasUnsavedChanges?: boolean;
  initialCoachFeedbackOpen?: boolean;
  allowExport?: boolean;
  onClose: () => void;
};

function reviewStatusText(value?: string | null) {
  if (value === 'not_requested' || value === 'archive_only') return 'Saved to Archive';
  if (value === 'reviewed') return 'Reviewed';
  if (value === 'needs_followup') return 'Needs follow-up';
  if (value === 'viewed') return 'Viewed';
  return 'Pending review';
}

function compactJoin(parts: Array<string | null | undefined>) {
  return parts.filter((part) => String(part || '').trim()).join(' · ');
}

function formatHudDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatClipTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeExportWeightUnit(value?: string | null): 'kg' | 'lbs' {
  const unit = String(value || '').trim().toLowerCase();
  return unit === 'kg' || unit === 'kgs' ? 'kg' : 'lbs';
}

function compactNumber(value: number, decimals = 2) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

function defaultExportWeightUnit(viewerPreference?: string | null, context?: SetVideoContext | null): 'kg' | 'lbs' {
  const viewerUnit = String(viewerPreference || '').trim().toLowerCase();
  if (viewerUnit === 'kg' || viewerUnit === 'kgs' || viewerUnit === 'lb' || viewerUnit === 'lbs') {
    return normalizeExportWeightUnit(viewerUnit);
  }
  const label = String(context?.actual_weight_label || '').trim().toLowerCase();
  if (/\b(lb|lbs)\b/.test(label)) return 'lbs';
  if (/\bkg\b/.test(label)) return 'kg';
  return 'lbs';
}

function exportWeightLabel(context: SetVideoContext | null | undefined, unit: 'kg' | 'lbs') {
  if (context?.actual_weight_kg == null) return context?.actual_weight_label || null;
  const kg = Number(context.actual_weight_kg);
  if (!Number.isFinite(kg)) return context.actual_weight_label || null;
  if (unit === 'lbs') return `${Math.round(kilogramsToDisplayValue(kg, 'lb'))} lbs`;
  return `${compactNumber(kg)} kg`;
}

function compactPrescriptionLabel(value?: string | null) {
  if (!value) return null;
  let text = String(value).trim();
  if (!text) return null;
  text = text
    .replace(/(\d+(?:\.\d+)?)\s+reps\b/gi, '$1')
    .replace(/@\s*RPE\s*/gi, '@')
    .replace(/@\s*RIR\s*/gi, '@RIR ')
    .replace(/(\d+(?:\.\d+)?)\s*kg-(\d+(?:\.\d+)?)\s*kg/gi, '$1-$2 kg')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/\s+(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*kg)$/i, ' · $1');
  return text || null;
}

function compactPrescriptionContext(context: SetVideoContext | null | undefined, unit: DisplayWeightUnit) {
  const prescription = context?.prescription;
  if (prescription) {
    const parts: string[] = [];
    if (prescription.reps != null) parts.push(String(prescription.reps));
    else if (prescription.reps_text) parts.push(prescription.reps_text);
    if (prescription.rpe_target != null) parts.push(`@${prescription.rpe_target}`);
    else if (prescription.rir_target != null) parts.push(`@RIR ${prescription.rir_target}`);
    if (prescription.pct != null) parts.push(`${Math.round(prescription.pct * 100)}%`);
    const target = formatWeightFromKg(prescription.target_kg, unit);
    const low = formatWeightFromKg(prescription.target_low_kg, unit);
    const high = formatWeightFromKg(prescription.target_high_kg, unit);
    if (target) parts.push(target);
    else if (low && high && low !== high) parts.push(`${low}–${high}`);
    else if (low || high) parts.push(low || high || '');
    if (parts.length) return parts.join(' ');
  }
  const legacy = compactPrescriptionLabel(context?.prescription_label);
  return legacy && !/\b(?:kg|kgs|lb|lbs)\b/i.test(legacy) ? legacy : null;
}

function compactContextActualParts(context?: SetVideoContext | null, unit: DisplayWeightUnit = 'lb') {
  if (!context) return { load: null as string | null, reps: null as string | null, rpe: null as string | null };
  const numericLoad = formatWeightFromKg(context.actual_weight_kg, unit);
  const legacyLabel = String(context.actual_weight_label || '').trim();
  const legacyUnitMatches = unit === 'kg'
    ? /\bkg\b/i.test(legacyLabel)
    : /\blbs?\b/i.test(legacyLabel);
  const load = numericLoad || (legacyUnitMatches ? legacyLabel : null);
  const reps = context.actual_reps != null ? String(context.actual_reps) : null;
  const rpe = context.actual_rpe != null ? String(context.actual_rpe) : null;
  return { load, reps, rpe };
}

function compactContextActual(context: SetVideoContext | null | undefined, unit: DisplayWeightUnit) {
  const { load, reps, rpe } = compactContextActualParts(context, unit);
  if (!load && !reps && !rpe) return null;
  const parts: string[] = [];
  if (load) parts.push(load);
  if (reps) parts.push(`x ${reps}`);
  if (rpe) parts.push(`@ ${rpe}`);
  return parts.join(' ');
}

function compactExportActual(context: SetVideoContext | null | undefined, options: SetVideoExportOptions) {
  const { reps, rpe } = compactContextActualParts(context);
  const load = exportWeightLabel(context, normalizeExportWeightUnit(options.weight_unit));
  const parts: string[] = [];
  if (options.show_logged_weight && load) parts.push(load);
  if (options.show_logged_reps && reps) parts.push(`x ${reps}`);
  if (options.show_logged_rpe && rpe) parts.push(`@ ${rpe}`);
  return parts.length ? parts.join(' ') : null;
}

function formatReviewTagSlug(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text
    .split('_')
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase() === 'followup') return 'Follow-Up';
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function reviewTagLabel(tag: SetVideoReviewTag) {
  if (!tag) return null;
  if (typeof tag === 'string') return formatReviewTagSlug(tag);
  const label = String(tag.label || '').trim();
  if (label) return label;
  return formatReviewTagSlug(tag.slug);
}

export default function SetVideoPlayerModal({
  visible,
  videoId,
  initialUrl,
  initialVideo,
  refreshPath,
  showPlaybackSpeedControls,
  reviewPanel,
  hasUnsavedChanges,
  initialCoachFeedbackOpen,
  allowExport,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [video, setVideo] = useState<SetVideoSummary | null>(initialVideo || null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [feedbackSheetOpen, setFeedbackSheetOpen] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportUnitChoiceOpen, setExportUnitChoiceOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportJobId, setExportJobId] = useState<number | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'queued' | 'processing' | 'ready' | 'failed'>('idle');
  const [exportStartSeconds, setExportStartSeconds] = useState(0);
  const [exportTimelineWidth, setExportTimelineWidth] = useState(1);
  const [exportTrimDragging, setExportTrimDragging] = useState(false);
  const [exportStartPreviewUri, setExportStartPreviewUri] = useState<string | null>(null);
  const [exportStartPreviewLoading, setExportStartPreviewLoading] = useState(false);
  const [currentPlaybackSeconds, setCurrentPlaybackSeconds] = useState(0);
  const [exportOptions, setExportOptions] = useState<SetVideoExportOptions>({
    show_date: true,
    show_movement: true,
    show_logged_set: true,
    show_logged_weight: true,
    show_logged_reps: true,
    show_logged_rpe: true,
  });
  const loadedRequestKeyRef = useRef<string | null>(null);
  const trimStartDragXRef = useRef(0);
  const exportStartPreviewCacheRef = useRef<Map<number, string>>(new Map());
  const videoSource = useMemo(
    () => (videoUrl ? { uri: videoUrl, useCaching: false } : null),
    [videoUrl],
  );
  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = false;
    instance.staysActiveInBackground = false;
  });
  const playerStatus = useEvent(player, 'statusChange', { status: player.status, error: null as any });
  const isLoading = loadingUrl || (visible && !videoUrl && !urlError);
  const playbackError = playerStatus?.status === 'error'
    ? (playerStatus?.error?.message || 'Video playback failed.')
    : null;

  const refreshVideoUrl = useCallback(async () => {
    if (!videoId) {
      setVideoUrl(null);
      setUrlError('Video is unavailable.');
      return;
    }
    try {
      setLoadingUrl(true);
      setUrlError(null);
      const path = refreshPath || `/video-review/mobile/attachments/${videoId}/url`;
      const { ok, status, json } = await fetchJson<{ ok?: boolean; error?: string; video?: SetVideoSummary }>(
        path.startsWith('http') ? path : `${API_BASE}${path}`,
        { method: 'GET', auth: true },
      );
      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Could not load video (HTTP ${status})`);
      }
      const nextVideo = json?.video || null;
      const nextUrl = nextVideo?.url;
      if (!nextUrl) throw new Error('Video URL is unavailable.');
      setVideoUrl(nextUrl);
      setVideo(nextVideo);
    } catch (err: any) {
      setVideoUrl(initialUrl || null);
      setVideo(initialVideo || null);
      setUrlError(err?.message || 'Could not load video.');
    } finally {
      setLoadingUrl(false);
    }
  }, [initialUrl, initialVideo, refreshPath, videoId]);

  const requestKey = visible && videoId
    ? `${videoId}:${refreshPath || `/video-review/mobile/attachments/${videoId}/url`}`
    : null;

  useEffect(() => {
    if (!visible) {
      try {
        player.pause();
      } catch {}
      loadedRequestKeyRef.current = null;
      exportStartPreviewCacheRef.current.clear();
      setVideoUrl(null);
      setVideo(null);
      setUrlError(null);
      setLoadingUrl(false);
      setReviewSheetOpen(false);
      setKeyboardVisible(false);
      setFeedbackSheetOpen(false);
      setToolMenuOpen(false);
      setExportSheetOpen(false);
      setExportUnitChoiceOpen(false);
      setExporting(false);
      setExportError(null);
      setExportUrl(null);
      setExportJobId(null);
      setExportStatus('idle');
      setExportStartSeconds(0);
      setExportStartPreviewUri(null);
      setExportStartPreviewLoading(false);
      setCurrentPlaybackSeconds(0);
      setExportOptions({
        show_date: true,
        show_movement: true,
        show_logged_set: true,
        show_logged_weight: true,
        show_logged_reps: true,
        show_logged_rpe: true,
      });
      return;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !requestKey) return;
    if (loadedRequestKeyRef.current === requestKey) return;
    loadedRequestKeyRef.current = requestKey;
    setVideoUrl(initialUrl || null);
    setVideo(initialVideo || null);
    setFeedbackSheetOpen(!reviewPanel && !!initialCoachFeedbackOpen);
    refreshVideoUrl();
  }, [initialCoachFeedbackOpen, initialUrl, initialVideo, refreshVideoUrl, requestKey, reviewPanel, visible]);

  useEffect(() => {
    if (!visible || playerStatus?.status !== 'readyToPlay') return;
    try {
      player.play();
    } catch {}
  }, [player, playerStatus?.status, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const closePlayer = useCallback(() => {
    try {
      player.pause();
    } catch {}
    onClose();
  }, [onClose, player]);

  const setSpeed = useCallback((speed: number) => {
    setPlaybackRate(speed);
    try {
      (player as any).playbackRate = speed;
    } catch {}
  }, [player]);

  const context = video?.context || null;
  const viewerDisplayUnit = normalizeDisplayWeightUnit(user?.preferred_units);
  const hudTop = Math.max(8, (insets.top || 0) + 4);
  const sessionLine = compactJoin([
    context?.athlete_name,
    formatHudDate(context?.session_date),
    video?.video_angle_label,
  ]);
  const movementTitle = simplifyMobileMovementName(context?.movement_name || context?.lift_name) || 'Movement unavailable';
  const setLabel = context?.set_display_label || context?.set_context_label || (context?.set_index != null ? `Set ${context.set_index}` : null);
  const planLine = compactPrescriptionContext(context, viewerDisplayUnit);
  const logLine = compactContextActual(context, viewerDisplayUnit);
  const coachFeedback = (video?.coach_feedback || '').trim();
  const showCoachFeedback =
    !reviewPanel &&
    (coachFeedback ||
      video?.review_status === 'reviewed' ||
      video?.review_status === 'needs_followup');
  const reviewedLine = compactJoin([
    video?.reviewed_by_name ? `By ${video.reviewed_by_name}` : null,
    video?.reviewed_at ? formatHudDate(video.reviewed_at) : null,
  ]);
  const canExport = allowExport ?? (typeof video?.can_export === 'boolean' ? video.can_export : true);
  const canOpenReviewTools = !!(showPlaybackSpeedControls || reviewPanel);
  const canOpenCoachFeedback = !!showCoachFeedback;
  const availableToolCount = [canOpenReviewTools, canOpenCoachFeedback, canExport].filter(Boolean).length;
  const hasActivePlayerPanel = reviewSheetOpen || exportSheetOpen || feedbackSheetOpen || toolMenuOpen;
  const canShowFloatingPlayerActions = !hasActivePlayerPanel && !keyboardVisible;
  const hasMovementForExport = !!(context?.movement_name || context?.lift_name);
  const hasDateForExport = !!context?.session_date;
  const defaultWeightUnit = defaultExportWeightUnit(user?.preferred_units, context);
  const selectedWeightUnit = normalizeExportWeightUnit(exportOptions.weight_unit || defaultWeightUnit);
  const actualParts = compactContextActualParts(context, viewerDisplayUnit);
  const hasLoggedWeightForExport = !!actualParts.load;
  const hasLoggedRepsForExport = !!actualParts.reps;
  const hasLoggedRpeForExport = !!actualParts.rpe;
  const hasLoggedSetForExport = hasLoggedWeightForExport || hasLoggedRepsForExport || hasLoggedRpeForExport;
  const downloadExports = video?.download_exports || null;
  const readyDownloadUnits = (['kg', 'lbs'] as const).filter((unit) => {
    const row = downloadExports?.exports?.[unit];
    return row?.status === 'ready' && !!(row.download_url || row.url);
  });
  const downloadPreparing = canExport && !readyDownloadUnits.length && downloadExports?.state !== 'failed';
  const downloadFailed = canExport && !readyDownloadUnits.length && downloadExports?.state === 'failed';
  const downloadArtifactForUnit = useCallback((unit: 'kg' | 'lbs') => {
    const row = video?.download_exports?.exports?.[unit];
    return row?.download_url || row?.url || null;
  }, [video?.download_exports]);
  const effectiveExportOptions = useMemo<SetVideoExportOptions>(() => ({
    show_date: !!exportOptions.show_date && hasDateForExport,
    show_movement: !!exportOptions.show_movement && hasMovementForExport,
    show_logged_set: hasLoggedSetForExport,
    show_logged_weight: !!exportOptions.show_logged_weight && hasLoggedWeightForExport,
    show_logged_reps: !!exportOptions.show_logged_reps && hasLoggedRepsForExport,
    show_logged_rpe: !!exportOptions.show_logged_rpe && hasLoggedRpeForExport,
    weight_unit: selectedWeightUnit,
  }), [
    exportOptions,
    hasDateForExport,
    hasLoggedRepsForExport,
    hasLoggedRpeForExport,
    hasLoggedSetForExport,
    hasLoggedWeightForExport,
    hasMovementForExport,
    selectedWeightUnit,
  ]);
  const exportOptionRows = useMemo<Array<[keyof SetVideoExportOptions, string]>>(() => {
    const rows: Array<[keyof SetVideoExportOptions, string] | null> = [
      hasDateForExport ? ['show_date', 'Date'] : null,
      hasMovementForExport ? ['show_movement', 'Lift'] : null,
      hasLoggedWeightForExport ? ['show_logged_weight', 'Logged Weight'] : null,
      hasLoggedRepsForExport ? ['show_logged_reps', 'Logged Reps'] : null,
      hasLoggedRpeForExport ? ['show_logged_rpe', 'Logged RPE'] : null,
    ];
    return rows.filter(Boolean) as Array<[keyof SetVideoExportOptions, string]>;
  }, [
    hasDateForExport,
    hasLoggedRepsForExport,
    hasLoggedRpeForExport,
    hasLoggedWeightForExport,
    hasMovementForExport,
  ]);
  const exportTitle = compactJoin([
    effectiveExportOptions.show_movement ? movementTitle : null,
    effectiveExportOptions.show_date ? formatHudDate(context?.session_date) : null,
  ]);
  const exportLogLine = compactExportActual(context, effectiveExportOptions);
  const rawVideoDuration = Number((player as any)?.duration || 0);
  const hasKnownExportDuration = Number.isFinite(rawVideoDuration) && rawVideoDuration > 0;
  const sourceUnderExportLimit = hasKnownExportDuration && rawVideoDuration <= MAX_EXPORT_DURATION_SECONDS;
  const showExportTrimTool = false;
  const maxExportStartSeconds = hasKnownExportDuration
    ? Math.max(0, Math.floor(rawVideoDuration - MAX_EXPORT_DURATION_SECONDS))
    : 0;
  const clampedExportStartSeconds = showExportTrimTool
    ? clampNumber(exportStartSeconds, 0, maxExportStartSeconds)
    : 0;
  const exportRequestStartSeconds = sourceUnderExportLimit ? 0 : clampedExportStartSeconds;
  const exportRequestEndSeconds = hasKnownExportDuration
    ? Math.min(rawVideoDuration, exportRequestStartSeconds + MAX_EXPORT_DURATION_SECONDS)
    : exportRequestStartSeconds + MAX_EXPORT_DURATION_SECONDS;
  const exportTimelineDuration = Math.max(
    MAX_EXPORT_DURATION_SECONDS,
    Math.ceil(rawVideoDuration || 0),
    Math.ceil(currentPlaybackSeconds || 0),
  );
  const exportDurationSeconds = Math.max(0, exportRequestEndSeconds - exportRequestStartSeconds);
  const startX = (exportRequestStartSeconds / exportTimelineDuration) * exportTimelineWidth;
  const endX = (exportRequestEndSeconds / exportTimelineDuration) * exportTimelineWidth;
  const selectionWidth = Math.max(1, endX - startX);
  const handleCenterMin = 24;
  const handleCenterMax = Math.max(handleCenterMin, exportTimelineWidth - 24);
  const startHandleX = clampNumber(startX, handleCenterMin, handleCenterMax);
  const previewBubbleHalfWidth = 58;
  const previewBubbleX = clampNumber(startX, previewBubbleHalfWidth, Math.max(previewBubbleHalfWidth, exportTimelineWidth - previewBubbleHalfWidth));
  const timelineFrames = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);
  const exportStartLabel = `Export starts at ${formatClipTime(exportRequestStartSeconds)}`;
  const exportClipLabel = `Clip: ${formatClipTime(exportRequestStartSeconds)}-${formatClipTime(exportRequestEndSeconds)}`;
  const exportTrimError = sourceUnderExportLimit
    ? null
    : !hasKnownExportDuration
      ? 'Video duration is still loading.'
      : exportDurationSeconds <= 0
        ? 'Choose a valid start point.'
        : null;
  useEffect(() => {
    if (!showExportTrimTool || !videoUrl) {
      setExportStartPreviewUri(null);
      setExportStartPreviewLoading(false);
      return undefined;
    }
    const roundedSecond = Math.max(0, Math.round(exportRequestStartSeconds));
    const cached = exportStartPreviewCacheRef.current.get(roundedSecond);
    if (cached) {
      setExportStartPreviewUri(cached);
      setExportStartPreviewLoading(false);
      return undefined;
    }
    let cancelled = false;
    setExportStartPreviewLoading(true);
    const timer = setTimeout(() => {
      VideoThumbnails.getThumbnailAsync(videoUrl, { time: roundedSecond * 1000 })
        .then((result) => {
          if (cancelled) return;
          exportStartPreviewCacheRef.current.set(roundedSecond, result.uri);
          setExportStartPreviewUri(result.uri);
        })
        .catch(() => {
          if (!cancelled) {
            setExportStartPreviewUri(video?.thumbnail_url || null);
          }
        })
        .finally(() => {
          if (!cancelled) setExportStartPreviewLoading(false);
        });
    }, exportTrimDragging ? 180 : 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [exportRequestStartSeconds, exportTrimDragging, showExportTrimTool, video?.thumbnail_url, videoUrl]);

  const canStartExport = readyDownloadUnits.length > 1 && !exporting;
  const resetExportJob = useCallback(() => {
    setExportUrl(null);
    setExportJobId(null);
    setExportStatus('idle');
  }, []);
  const updateExportStartFromX = useCallback((x: number) => {
    const raw = (x / Math.max(1, exportTimelineWidth)) * exportTimelineDuration;
    const next = Math.round(clampNumber(raw, 0, maxExportStartSeconds));
    setExportStartSeconds(next);
    resetExportJob();
  }, [exportTimelineDuration, exportTimelineWidth, maxExportStartSeconds, resetExportJob]);
  const finishTrimDrag = useCallback(() => setExportTrimDragging(false), []);
  const startSelectorResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (event) => {
      setExportTrimDragging(true);
      const x = clampNumber(event.nativeEvent.locationX, 0, exportTimelineWidth);
      trimStartDragXRef.current = x;
      updateExportStartFromX(x);
    },
    onPanResponderMove: (_, gesture) => updateExportStartFromX(trimStartDragXRef.current + gesture.dx),
    onPanResponderRelease: finishTrimDrag,
    onPanResponderTerminate: finishTrimDrag,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [exportTimelineWidth, finishTrimDrag, updateExportStartFromX]);
  const setExportStartFromPlayer = useCallback(() => {
    const duration = Number((player as any)?.duration || 0);
    const current = Math.max(0, Math.floor(Number((player as any)?.currentTime || 0)));
    if (Number.isFinite(duration) && duration > 0 && duration <= MAX_EXPORT_DURATION_SECONDS) {
      setExportStartSeconds(0);
    } else {
      setExportStartSeconds(clampNumber(current, 0, Math.max(0, Math.floor(duration - MAX_EXPORT_DURATION_SECONDS))));
    }
    resetExportJob();
  }, [player, resetExportJob]);
  const syncReadyDownloadUrl = useCallback((exportsPayload?: SetVideoSummary['download_exports'] | null) => {
    const payload = exportsPayload || video?.download_exports || null;
    const readyUnits = (['kg', 'lbs'] as const).filter((unit) => {
      const row = payload?.exports?.[unit];
      return row?.status === 'ready' && !!(row.download_url || row.url);
    });
    if (readyUnits.length === 1) {
      const row = payload?.exports?.[readyUnits[0]];
      setExportUrl(row?.download_url || row?.url || null);
      setExportStatus('ready');
    } else if (readyUnits.length > 1) {
      setExportUrl(null);
      setExportStatus('ready');
    } else if (payload?.state === 'failed') {
      setExportUrl(null);
      setExportStatus('failed');
      setExportError("We couldn't prepare this video yet. Please try again later.");
    } else {
      setExportUrl(null);
      setExportStatus('queued');
      setExportError(null);
    }
  }, [video?.download_exports]);

  const refreshDownloadExportsStatus = useCallback(async () => {
    if (!videoId) return null;
    const res = await getSetVideoDownloadExportsStatus(videoId);
    const payload = res.json || {};
    if (!res.ok || !payload.ok) {
      throw new Error(payload.error || `Could not check download (${res.status})`);
    }
    const nextExports = payload.download_exports || null;
    setVideo((current) => current ? ({ ...current, download_exports: nextExports }) : current);
    syncReadyDownloadUrl(nextExports);
    return nextExports;
  }, [syncReadyDownloadUrl, videoId]);

  const openExportSheet = useCallback(() => {
    Keyboard.dismiss();
    setToolMenuOpen(false);
    setReviewSheetOpen(false);
    setFeedbackSheetOpen(false);
    try {
      player.pause();
    } catch {}
    const duration = Number((player as any)?.duration || 0);
    const current = Math.max(0, Math.floor(Number((player as any)?.currentTime || 0)));
    if (Number.isFinite(duration) && duration > 0 && duration <= MAX_EXPORT_DURATION_SECONDS) {
      setExportStartSeconds(0);
    } else {
      setExportStartSeconds(clampNumber(current, 0, Math.max(0, Math.floor(duration - MAX_EXPORT_DURATION_SECONDS))));
    }
    resetExportJob();
    setExportError(null);
    syncReadyDownloadUrl();
    setExportSheetOpen(true);
    refreshDownloadExportsStatus().catch((err: any) => {
      setExportStatus('failed');
      setExportError(err?.message || 'Could not check download status.');
    });
  }, [player, refreshDownloadExportsStatus, resetExportJob, syncReadyDownloadUrl]);

  const openReviewSheet = useCallback(() => {
    Keyboard.dismiss();
    setToolMenuOpen(false);
    setExportSheetOpen(false);
    setFeedbackSheetOpen(false);
    setReviewSheetOpen(true);
  }, []);

  const openCoachFeedbackSheet = useCallback(() => {
    Keyboard.dismiss();
    setToolMenuOpen(false);
    setExportSheetOpen(false);
    setReviewSheetOpen(false);
    setFeedbackSheetOpen(true);
  }, []);

  const pollExportStatus = useCallback(async (exportId: number) => {
    const res = await getSetVideoExportStatus(exportId);
    const payload = res.json || {};
    if (!res.ok || !payload.ok || !payload.export) {
      throw new Error(payload.error || `Could not check export (${res.status})`);
    }
    const status = String(payload.export.status || 'failed') as typeof exportStatus;
    setExportStatus(status);
    if (status === 'ready' && payload.export.download_url) {
      setExportUrl(payload.export.download_url);
    }
    if (status === 'failed') {
      setExportError(payload.export.error || payload.export.error_message || 'Export failed.');
    }
    return payload.export;
  }, []);

  const startExport = useCallback(async (unitOverride?: 'kg' | 'lbs') => {
    if (!videoId) {
      setExportError('Video is unavailable.');
      return null;
    }
    try {
      setExporting(true);
      setExportError(null);
      const unit = unitOverride || selectedWeightUnit || 'lbs';
      const url = downloadArtifactForUnit(unit);
      if (!url) {
        const payload = await refreshDownloadExportsStatus();
        const row = payload?.exports?.[unit];
        const refreshedUrl = row?.download_url || row?.url || null;
        if (!refreshedUrl) {
          throw new Error('Download is still preparing.');
        }
        setExportUrl(refreshedUrl);
      } else {
        setExportUrl(url);
      }
      setExportStatus('ready');
      return null;
    } catch (err: any) {
      setExportError(err?.message || 'Could not prepare download.');
      return null;
    } finally {
      setExporting(false);
    }
  }, [downloadArtifactForUnit, refreshDownloadExportsStatus, selectedWeightUnit, videoId]);

  const startExportWithUnit = useCallback((unit: 'kg' | 'lbs') => {
    resetExportJob();
    setExportOptions((current) => ({ ...current, weight_unit: unit }));
    setExportUnitChoiceOpen(false);
    startExport(unit);
  }, [resetExportJob, startExport]);

  const toggleExportOption = useCallback((key: keyof SetVideoExportOptions) => {
    resetExportJob();
    setExportOptions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, [resetExportJob]);

  const downloadExport = useCallback(async (purpose: 'save' | 'share') => {
    if (!exportUrl) {
      setExportError('Download is not ready yet.');
      return null;
    }
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    const exportPart = exportJobId ? `export-${exportJobId}` : 'export';
    const filename = `strength-ledger-${purpose}-video-${videoId || 'clip'}-${exportPart}-${stamp}-${random}.mp4`;
    const target = new File(Paths.cache, filename);
    const result = await File.downloadFileAsync(exportUrl, target, { idempotent: false });
    return result.uri;
  }, [exportJobId, exportUrl, videoId]);

  const shareExport = useCallback(async () => {
    try {
      setExporting(true);
      setExportError(null);
      const localUri = await downloadExport('share');
      if (!localUri) return;
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setExportError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(localUri, {
        mimeType: 'video/mp4',
        UTI: 'public.mpeg-4',
      });
    } catch (err: any) {
      setExportError(err?.message || 'Could not share export.');
    } finally {
      setExporting(false);
    }
  }, [downloadExport]);

  const saveExport = useCallback(async () => {
    try {
      setExporting(true);
      setExportError(null);
      const localUri = await downloadExport('save');
      if (!localUri) return;
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        setExportError('Photos permission is required to save the export.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(localUri);
      setExportError('Saved to Photos.');
    } catch (err: any) {
      setExportError(err?.message || 'Could not save export.');
    } finally {
      setExporting(false);
    }
  }, [downloadExport]);

  useEffect(() => {
    if (!exportSheetOpen) return;
    const update = () => {
      setCurrentPlaybackSeconds(Math.max(0, Number((player as any)?.currentTime || 0)));
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [exportSheetOpen, player]);

  useEffect(() => {
    if (!exportSheetOpen || readyDownloadUnits.length || downloadFailed) {
      return;
    }
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        if (!cancelled) {
          await refreshDownloadExportsStatus();
        }
      } catch (err: any) {
        if (!cancelled) {
          setExportStatus('failed');
          setExportError(err?.message || 'Could not check download status.');
        }
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [downloadFailed, exportSheetOpen, readyDownloadUnits.length, refreshDownloadExportsStatus]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closePlayer}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.frame}>
            {videoUrl ? (
              <VideoView
                style={styles.video}
                player={player}
                nativeControls
                contentFit="contain"
              />
            ) : null}
            <View style={[styles.hudTopLeft, { top: hudTop }]} pointerEvents="none">
              <View style={styles.hudHeaderRow}>
                <Text style={styles.hudKicker}>SET VIDEO</Text>
                <Text style={styles.hudStatusText}>{reviewStatusText(video?.review_status)}</Text>
              </View>
              <Text style={styles.hudTitle} numberOfLines={1}>
                {compactJoin([movementTitle, setLabel])}
              </Text>
              {sessionLine ? (
                <Text style={styles.hudSubtext} numberOfLines={1}>
                  {sessionLine}
                </Text>
              ) : null}
            </View>
            <View style={styles.hudBottomLeft} pointerEvents="none">
              {planLine ? (
                <Text style={styles.hudLine} numberOfLines={1}>
                  <Text style={styles.hudLabel}>Plan: </Text>
                  {planLine}
                </Text>
              ) : null}
              {logLine ? (
                <Text style={styles.hudLine} numberOfLines={1}>
                  <Text style={styles.hudLabel}>Log: </Text>
                  {logLine}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={[styles.closeButton, { top: hudTop }]} onPress={closePlayer}>
              <Text style={styles.closeText}>X</Text>
            </TouchableOpacity>
            {isLoading ? (
              <View style={styles.overlay}>
                <ActivityIndicator size="large" color={SLColors.text} />
                <Text style={styles.overlayText}>Loading video...</Text>
              </View>
            ) : null}
            {!isLoading && (urlError || playbackError) ? (
              <View style={styles.overlay}>
                <Text style={styles.errorText}>{urlError || playbackError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={refreshVideoUrl}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {(canShowFloatingPlayerActions && availableToolCount > 0) ? (
              <View style={styles.playerActionRail}>
                {availableToolCount > 1 ? (
                  <TouchableOpacity
                    style={styles.toolLauncherButton}
                    activeOpacity={0.88}
                    onPress={() => setToolMenuOpen(true)}
                  >
                    <Text style={styles.toolLauncherText}>Tools</Text>
                    {hasUnsavedChanges ? <Text style={styles.reviewToolsUnsaved}>Unsaved review</Text> : null}
                  </TouchableOpacity>
                ) : canOpenReviewTools ? (
                  <TouchableOpacity
                    style={styles.toolLauncherButton}
                    activeOpacity={0.88}
                    onPress={openReviewSheet}
                  >
                    <Text style={styles.toolLauncherText}>Review</Text>
                    {hasUnsavedChanges ? <Text style={styles.reviewToolsUnsaved}>Unsaved review</Text> : null}
                  </TouchableOpacity>
                ) : canOpenCoachFeedback ? (
                  <TouchableOpacity
                    style={styles.toolLauncherButton}
                    activeOpacity={0.88}
                    onPress={openCoachFeedbackSheet}
                  >
                    <Text style={styles.toolLauncherText}>Feedback</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.toolLauncherButton}
                    activeOpacity={0.88}
                    onPress={openExportSheet}
                  >
                    <Text style={styles.toolLauncherText}>Download</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
            {toolMenuOpen ? (
              <View style={styles.toolMenuSheet}>
                <View style={styles.toolMenuHeader}>
                  <Text style={styles.toolMenuTitle}>Tools</Text>
                  <TouchableOpacity style={styles.toolMenuClose} onPress={() => setToolMenuOpen(false)}>
                    <Text style={styles.toolMenuCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.toolMenuActions}>
                  {canOpenReviewTools ? (
                    <TouchableOpacity style={styles.toolMenuAction} activeOpacity={0.84} onPress={openReviewSheet}>
                      <Text style={styles.toolMenuActionText}>Review Tools</Text>
                      {hasUnsavedChanges ? <Text style={styles.toolMenuActionMeta}>Unsaved review</Text> : null}
                    </TouchableOpacity>
                  ) : null}
                  {canOpenCoachFeedback ? (
                    <TouchableOpacity style={styles.toolMenuAction} activeOpacity={0.84} onPress={openCoachFeedbackSheet}>
                      <Text style={styles.toolMenuActionText}>Coach Feedback</Text>
                      <Text style={styles.toolMenuActionMeta}>{reviewStatusText(video?.review_status)}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {canExport ? (
                    <TouchableOpacity style={styles.toolMenuAction} activeOpacity={0.84} onPress={openExportSheet}>
                      <Text style={styles.toolMenuActionText}>Download</Text>
                      <Text style={styles.toolMenuActionMeta}>Download video</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
            {canExport && exportSheetOpen ? (
              <View style={styles.exportSheet}>
                <View style={styles.reviewSheetHeader}>
                  <View>
                    <Text style={styles.reviewSheetTitle}>Download Video</Text>
                    <Text style={styles.exportSheetMeta}>Strength Ledger HUD video</Text>
                  </View>
                  <TouchableOpacity style={styles.reviewSheetClose} onPress={() => setExportSheetOpen(false)}>
                    <Text style={styles.reviewSheetCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.exportComposerScroll}
                  contentContainerStyle={styles.exportComposerContent}
                  scrollEnabled={!exportTrimDragging}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.exportPreviewFrame}>
                    {video?.thumbnail_url ? (
                      <Image source={{ uri: video.thumbnail_url }} style={styles.exportPreviewImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.exportPreviewFallback}>
                        <Text style={styles.exportPreviewFallbackText}>Preview</Text>
                      </View>
                    )}
                    <View style={styles.exportPreviewShade} />
                    <View style={styles.exportPreviewLogo}>
                      <Image source={STRENGTH_LEDGER_LOGO} style={styles.exportPreviewLogoImage} resizeMode="contain" />
                    </View>
                    {(exportTitle || exportLogLine) ? (
                      <View style={styles.exportPreviewTopHud}>
                        {exportTitle ? <Text style={styles.exportPreviewTitle} numberOfLines={1}>{exportTitle}</Text> : null}
                        {exportLogLine ? (
                          <Text style={styles.exportPreviewLog} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{exportLogLine}</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                  {false ? (
                    <View style={styles.exportUnitRow}>
                      <Text style={styles.exportUnitLabel}>Weight unit</Text>
                      <View style={styles.exportUnitToggle}>
                        {(['kg', 'lbs'] as const).map((unit) => {
                          const active = selectedWeightUnit === unit;
                          return (
                            <TouchableOpacity
                              key={unit}
                              style={[styles.exportUnitButton, active && styles.exportUnitButtonActive]}
                              activeOpacity={0.82}
                              onPress={() => {
                                resetExportJob();
                                setExportOptions((current) => ({ ...current, weight_unit: unit }));
                              }}
                            >
                              <Text style={[styles.exportUnitButtonText, active && styles.exportUnitButtonTextActive]}>{unit}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  {false ? <View style={styles.exportOptionList}>
                    {exportOptionRows.map(([optionKey, label]) => {
                      const active = !!effectiveExportOptions[optionKey];
                      return (
                        <TouchableOpacity
                          key={optionKey}
                          style={styles.exportOptionRow}
                          activeOpacity={0.82}
                          onPress={() => toggleExportOption(optionKey)}
                        >
                          <View style={[styles.exportOptionCheck, active && styles.exportOptionCheckActive]}>
                            {active ? <Text style={styles.exportOptionCheckText}>✓</Text> : null}
                          </View>
                          <Text style={styles.exportOptionText}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View> : null}
                  <View style={styles.exportDurationBlock}>
                    {showExportTrimTool ? (
                      <>
                        <View style={styles.exportTrimHeader}>
                          <View style={styles.exportTrimTitleBlock}>
                            <Text style={styles.exportDurationTitle}>Choose start</Text>
                            <Text style={styles.exportDurationHint}>Drag or tap the timeline. Export is capped at 30 seconds.</Text>
                          </View>
                          <View style={styles.exportDurationBadge}>
                            <Text style={styles.exportDurationBadgeText}>Max 30s</Text>
                          </View>
                        </View>
                        <View style={styles.exportTrimSummary}>
                          <Text style={styles.exportStartText}>{exportStartLabel}</Text>
                          <Text style={styles.exportClipText}>{exportClipLabel}</Text>
                        </View>
                        <View
                          style={styles.exportTimelineEditor}
                          onLayout={(event) => setExportTimelineWidth(Math.max(1, event.nativeEvent.layout.width))}
                          {...startSelectorResponder.panHandlers}
                        >
                          <View pointerEvents="none" style={[styles.exportStartPreviewBubble, { left: previewBubbleX }]}>
                            <View style={styles.exportStartPreviewFrame}>
                              {exportStartPreviewLoading ? (
                                <ActivityIndicator color={SLColors.textStrong} size="small" />
                              ) : exportStartPreviewUri ? (
                                <Image source={{ uri: exportStartPreviewUri }} style={styles.exportStartPreviewImage} resizeMode="cover" />
                              ) : (
                                <Text style={styles.exportStartPreviewFallback}>Frame</Text>
                              )}
                            </View>
                            <Text style={styles.exportStartPreviewText}>Start {formatClipTime(exportRequestStartSeconds)}</Text>
                          </View>
                          <View style={styles.exportTimelineFilmstrip} pointerEvents="none">
                            {timelineFrames.map((frame) => (
                              <View key={frame} style={styles.exportTimelineFrame}>
                                {video?.thumbnail_url ? (
                                  <Image source={{ uri: video.thumbnail_url }} style={styles.exportTimelineFrameImage} resizeMode="cover" />
                                ) : null}
                              </View>
                            ))}
                          </View>
                          <View pointerEvents="none" style={[styles.exportTimelineMuted, { left: 0, width: startX }]} />
                          <View pointerEvents="none" style={[styles.exportTimelineMuted, { left: endX, right: 0 }]} />
                          <View pointerEvents="none" style={[styles.exportTimelineSelection, { left: startX, width: selectionWidth }]} />
                          <View pointerEvents="none" style={[styles.exportTimelineStartMarker, { left: startHandleX }]}>
                            <Text style={styles.exportTimelineStartLabel}>Start</Text>
                            <View style={styles.exportTimelineStartLine} />
                            <View style={styles.exportTimelineStartKnob} />
                          </View>
                        </View>
                        <Text style={styles.exportTrimHint}>Tap or drag to choose the start frame · Max 30 seconds</Text>
                        {exportTrimError ? <Text style={styles.exportErrorText}>{exportTrimError}</Text> : null}
                      </>
                    ) : (
                      <View style={styles.exportReadyNotice}>
                        <Text style={styles.exportDurationTitle}>{readyDownloadUnits.length ? 'Download ready' : downloadFailed ? 'Download unavailable' : 'Preparing download'}</Text>
                        <Text style={styles.exportDurationHint}>
                          {readyDownloadUnits.length
                            ? 'Your branded video is ready.'
                            : downloadFailed
                              ? "We couldn't prepare this video yet. Please try again later."
                              : "We're getting this video ready. Check back shortly."}
                        </Text>
                        <Text style={styles.exportTrimTimeText}>Duration {formatClipTime(exportDurationSeconds)}</Text>
                      </View>
                    )}
                  </View>
                  {exportStatus !== 'idle' ? (
                    <View style={styles.exportStatusBox}>
                      {['queued', 'processing'].includes(exportStatus) ? <ActivityIndicator color={SLColors.success} /> : null}
                      <Text style={styles.exportStatusText}>
                        {downloadFailed ? 'Download unavailable' : readyDownloadUnits.length ? 'Ready' : 'Preparing download'}
                      </Text>
                    </View>
                  ) : null}
                  {exporting ? (
                    <View style={styles.exportLoadingRow}>
                      <ActivityIndicator color={SLColors.success} />
                      <Text style={styles.exportLoadingText}>Preparing download...</Text>
                    </View>
                  ) : null}
                  {exportError ? <Text style={styles.exportErrorText}>{exportError}</Text> : null}
                  {exportStatus === 'ready' && exportUrl ? (
                    <View style={styles.exportActions}>
                      <TouchableOpacity style={styles.exportActionButton} onPress={saveExport} disabled={exporting}>
                        <Text style={styles.exportActionText}>Save Video</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.exportActionButton, styles.exportActionButtonPrimary]} onPress={shareExport} disabled={exporting}>
                        <Text style={[styles.exportActionText, styles.exportActionTextPrimary]}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.exportActionButton, styles.exportActionButtonPrimary, !canStartExport && styles.exportActionButtonDisabled]} onPress={() => setExportUnitChoiceOpen(true)} disabled={!canStartExport}>
                      <Text style={[styles.exportActionText, styles.exportActionTextPrimary]}>
                        {readyDownloadUnits.length > 1 ? 'Choose Unit' : downloadFailed ? 'Download unavailable' : 'Preparing download'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            ) : null}
            {exportUnitChoiceOpen ? (
              <View style={styles.exportUnitChoiceBackdrop}>
                <View style={styles.exportUnitChoiceCard}>
                  <Text style={styles.exportUnitChoiceKicker}>Download video</Text>
                  <Text style={styles.exportUnitChoiceTitle}>Choose the ready unit shown on the branded video.</Text>
                  <View style={styles.exportUnitChoiceActions}>
                    {readyDownloadUnits.includes('kg') ? (
                      <TouchableOpacity style={styles.exportUnitChoiceButton} onPress={() => startExportWithUnit('kg')} disabled={exporting}>
                        <Text style={styles.exportUnitChoiceButtonText}>Download in kg</Text>
                      </TouchableOpacity>
                    ) : null}
                    {readyDownloadUnits.includes('lbs') ? (
                      <TouchableOpacity style={styles.exportUnitChoiceButton} onPress={() => startExportWithUnit('lbs')} disabled={exporting}>
                        <Text style={styles.exportUnitChoiceButtonText}>Download in lbs</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <TouchableOpacity style={styles.exportUnitChoiceCancel} onPress={() => setExportUnitChoiceOpen(false)} disabled={exporting}>
                    <Text style={styles.exportUnitChoiceCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            {showCoachFeedback && feedbackSheetOpen ? (
              <View style={styles.coachFeedbackSheet}>
                <View style={styles.reviewSheetHeader}>
                  <View>
                    <Text style={styles.reviewSheetTitle}>Coach Feedback</Text>
                    <Text style={styles.coachFeedbackStatus}>{reviewStatusText(video?.review_status)}</Text>
                  </View>
                  <TouchableOpacity style={styles.reviewSheetClose} onPress={() => setFeedbackSheetOpen(false)}>
                    <Text style={styles.reviewSheetCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.reviewPanel} contentContainerStyle={styles.reviewPanelContent}>
                  {reviewedLine ? (
                    <Text style={styles.coachFeedbackMeta}>{reviewedLine}</Text>
                  ) : null}
                  {coachFeedback ? (
                    <Text style={styles.coachFeedbackBody}>{coachFeedback}</Text>
                  ) : (
                    <Text style={styles.coachFeedbackBodyMuted}>
                      This video has been reviewed. No written feedback was added.
                    </Text>
                  )}
                </ScrollView>
              </View>
            ) : null}
            {(showPlaybackSpeedControls || reviewPanel) && reviewSheetOpen ? (
              <KeyboardAvoidingView
                pointerEvents="box-none"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) : 0}
                style={styles.reviewKeyboardAvoider}
              >
                <View style={[styles.reviewSheet, keyboardVisible && styles.reviewSheetKeyboardOpen]}>
                  <View style={styles.reviewSheetHeader}>
                    <View>
                      <Text style={styles.reviewSheetTitle}>Review Tools</Text>
                      {hasUnsavedChanges ? <Text style={styles.reviewSheetUnsaved}>Unsaved review</Text> : null}
                    </View>
                    <View style={styles.reviewSheetHeaderActions}>
                      {keyboardVisible ? (
                        <TouchableOpacity style={styles.reviewSheetKeyboardButton} onPress={() => Keyboard.dismiss()}>
                          <Text style={styles.reviewSheetKeyboardButtonText}>Hide Keyboard</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.reviewSheetClose}
                        onPress={() => {
                          Keyboard.dismiss();
                          setReviewSheetOpen(false);
                        }}
                      >
                        <Text style={styles.reviewSheetCloseText}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <ScrollView
                    style={[styles.reviewPanel, keyboardVisible && styles.reviewPanelKeyboardOpen]}
                    contentContainerStyle={[
                      styles.reviewPanelContent,
                      keyboardVisible && { paddingBottom: Math.max(insets.bottom, 16) + 72 },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                  >
                    {showPlaybackSpeedControls ? (
                      <View style={styles.speedSection}>
                        <Text style={styles.sectionLabel}>Playback Speed</Text>
                        <View style={styles.speedButtons}>
                          {[0.25, 0.5, 0.75, 1].map((speed) => (
                            <TouchableOpacity
                              key={speed}
                              style={[
                                styles.speedButton,
                                playbackRate === speed && styles.speedButtonActive,
                              ]}
                              onPress={() => setSpeed(speed)}
                            >
                              <Text
                                style={[
                                  styles.speedButtonText,
                                  playbackRate === speed && styles.speedButtonTextActive,
                                ]}
                              >
                                {speed}x
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {reviewPanel}
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const mediaObject = {
  borderRadius: SLRadius.radiusRow,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: SLColors.borderStandard,
  backgroundColor: SLColors.surfaceFloating,
  ...SLShadows.level2,
} as const;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: SLColors.surfaceScrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 760,
    height: '92%',
    maxHeight: 860,
    borderRadius: SLRadius.radiusHero,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    borderTopColor: SLColors.borderFocus,
    backgroundColor: SLColors.surfaceFloating,
    ...SLShadows.level3,
    overflow: 'hidden',
  },
  frame: {
    width: '100%',
    height: '100%',
    backgroundColor: SLColors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPanel: {
    maxHeight: 360,
  },
  reviewPanelContent: {
    paddingHorizontal: 14,
    paddingBottom: 18,
    gap: 12,
  },
  playerActionRail: {
    position: 'absolute',
    right: 12,
    bottom: 66,
    alignItems: 'flex-end',
    maxWidth: 124,
    zIndex: 14,
    elevation: 14,
  },
  toolLauncherButton: {
    minHeight: 36,
    borderRadius: SLRadius.radiusRow,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.focus,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    ...SLShadows.shadowCommand,
  },
  toolLauncherText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textAlign: 'center',
  },
  toolMenuSheet: {
    position: 'absolute',
    right: 10,
    bottom: 110,
    width: 188,
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceCommand,
    overflow: 'hidden',
    ...SLShadows.shadowSheet,
    zIndex: 16,
  },
  toolMenuHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 11,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.borderSubtle,
  },
  toolMenuTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  toolMenuClose: {
    paddingVertical: 6,
    paddingLeft: 8,
  },
  toolMenuCloseText: {
    color: SLColors.text,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
  },
  toolMenuActions: {
    paddingVertical: 4,
  },
  toolMenuAction: {
    minHeight: 44,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.08)',
  },
  toolMenuActionText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  toolMenuActionMeta: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  reviewToolsButton: {
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
    backgroundColor: 'rgba(8,12,22,0.76)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...SLShadows.shadowCommand,
  },
  reviewToolsButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textAlign: 'center',
  },
  coachFeedbackButton: {
    position: 'absolute',
    left: 12,
    bottom: 78,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.32)',
    backgroundColor: 'rgba(8,12,22,0.76)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...SLShadows.shadowCommand,
  },
  coachFeedbackButtonText: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  exportButton: {
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
    backgroundColor: 'rgba(8,12,22,0.76)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...SLShadows.shadowCommand,
  },
  exportButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  reviewToolsUnsaved: {
    color: SLColors.warning,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'center',
  },
  coachFeedbackSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    maxHeight: '46%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.18)',
    backgroundColor: 'rgba(8,12,22,0.82)',
    overflow: 'hidden',
    ...SLShadows.shadowSheet,
  },
  coachFeedbackStatus: {
    color: SLColors.success,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    marginTop: 2,
  },
  coachFeedbackMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  coachFeedbackBody: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
    lineHeight: 20,
  },
  coachFeedbackBodyMuted: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    lineHeight: 19,
  },
  exportSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    maxHeight: '78%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.18)',
    backgroundColor: 'rgba(8,12,22,0.84)',
    overflow: 'hidden',
    ...SLShadows.shadowSheet,
    paddingBottom: 14,
  },
  exportSheetMeta: {
    color: SLColors.success,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    marginTop: 2,
  },
  exportSheetBody: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 18,
    fontWeight: '700',
  },
  exportComposerScroll: {
    maxHeight: 560,
  },
  exportComposerContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  exportPreviewFrame: {
    alignSelf: 'center',
    width: 212,
    aspectRatio: EXPORT_PREVIEW_ASPECT,
    borderRadius: SLRadius.radiusHero,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.background,
  },
  exportPreviewImage: {
    width: '100%',
    height: '100%',
  },
  exportPreviewFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceCommand,
  },
  exportPreviewFallbackText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  exportPreviewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.08)',
  },
  exportPreviewLogo: {
    position: 'absolute',
    top: EXPORT_OVERLAY.logo.top,
    right: EXPORT_OVERLAY.logo.right,
    width: EXPORT_OVERLAY.logo.width,
    aspectRatio: 1,
    opacity: 0.96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,12,22,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
    borderRadius: SLRadius.md,
    padding: 3,
  },
  exportPreviewLogoImage: {
    width: '100%',
    height: '100%',
  },
  exportPreviewTopHud: {
    position: 'absolute',
    bottom: '6.7%',
    left: EXPORT_OVERLAY.topHud.left,
    width: EXPORT_OVERLAY.topHud.width,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(8,12,22,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.16)',
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  exportPreviewTitle: {
    color: SLColors.textStrong,
    fontSize: 9,
    fontWeight: '900',
  },
  exportPreviewLog: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    marginTop: 3,
  },
  exportPreviewBottomHud: {
    position: 'absolute',
    left: EXPORT_OVERLAY.bottomHud.left,
    right: EXPORT_OVERLAY.bottomHud.right,
    bottom: EXPORT_OVERLAY.bottomHud.bottom,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(8,12,22,0.44)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.14)',
    paddingHorizontal: 7,
    paddingVertical: 6,
    gap: 3,
  },
  exportPreviewMeta: {
    color: SLColors.textStrong,
    fontSize: 9,
    fontWeight: '800',
  },
  exportUnitRow: {
    gap: 8,
  },
  exportUnitLabel: {
    color: SLColors.text,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  exportUnitToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  exportUnitButton: {
    minWidth: 58,
    alignItems: 'center',
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    backgroundColor: 'rgba(15,23,42,0.68)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  exportUnitButtonActive: {
    borderColor: 'rgba(167,243,208,0.72)',
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  exportUnitButtonText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  exportUnitButtonTextActive: {
    color: SLColors.success,
  },
  exportOptionList: {
    gap: 8,
  },
  exportOptionRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  exportOptionCheck: {
    width: 22,
    height: 22,
    borderRadius: SLRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.32)',
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportOptionCheckActive: {
    borderColor: 'rgba(167,243,208,0.5)',
    backgroundColor: 'rgba(20,184,166,0.22)',
  },
  exportOptionCheckText: {
    color: SLColors.success,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  exportOptionText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  exportLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  exportLoadingText: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  exportErrorText: {
    color: SLColors.warning,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    lineHeight: 17,
  },
  exportComingSoon: {
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.24)',
    backgroundColor: 'rgba(250,204,21,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  exportComingSoonTitle: {
    color: SLColors.warning,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  exportComingSoonText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    lineHeight: 17,
  },
  exportDurationBlock: {
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,23,42,0.64)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  exportReadyNotice: {
    gap: 6,
  },
  exportDurationTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  exportDurationHint: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    lineHeight: 15,
  },
  exportTrimHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  exportTrimTitleBlock: {
    flex: 1,
    gap: 3,
  },
  exportDurationBadge: {
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.42)',
    backgroundColor: 'rgba(124,58,237,0.24)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  exportDurationBadgeText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  exportTrimSummary: {
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(2,6,23,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  exportStartText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  exportClipText: {
    color: SLColors.success,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  exportTrimTimeText: {
    color: SLColors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  exportTimelineEditor: {
    height: 154,
    justifyContent: 'center',
    marginTop: 2,
    overflow: 'visible',
  },
  exportTimelineFilmstrip: {
    height: 42,
    marginTop: 72,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(15,23,42,0.92)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  exportTimelineFrame: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: 'rgba(15,23,42,0.72)',
    backgroundColor: 'rgba(30,41,59,0.92)',
  },
  exportTimelineFrameImage: {
    width: '100%',
    height: '100%',
    opacity: 0.72,
  },
  exportStartPreviewBubble: {
    position: 'absolute',
    top: 0,
    width: 116,
    marginLeft: -58,
    alignItems: 'center',
    zIndex: 24,
    elevation: 24,
  },
  exportStartPreviewFrame: {
    width: 108,
    height: 58,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.58)',
    backgroundColor: 'rgba(15,23,42,0.96)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportStartPreviewImage: {
    width: '100%',
    height: '100%',
  },
  exportStartPreviewFallback: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  exportStartPreviewText: {
    marginTop: 3,
    color: SLColors.textStrong,
    fontSize: 10,
    fontWeight: '900',
    textShadowColor: 'rgba(2,6,23,0.9)',
    textShadowRadius: 4,
  },
  exportTimelineMuted: {
    position: 'absolute',
    top: 92,
    height: 42,
    backgroundColor: 'rgba(2,6,23,0.68)',
  },
  exportTimelineSelection: {
    position: 'absolute',
    top: 90,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.78)',
    backgroundColor: 'rgba(124,58,237,0.18)',
    ...SLShadows.level2,
  },
  exportTimelineStartMarker: {
    position: 'absolute',
    top: 74,
    width: 56,
    height: 78,
    marginLeft: -28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    elevation: 30,
  },
  exportTimelineStartLabel: {
    position: 'absolute',
    top: 0,
    color: SLColors.textStrong,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  exportTimelineStartLine: {
    position: 'absolute',
    top: 19,
    width: 3,
    height: 44,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.review,
  },
  exportTimelineStartKnob: {
    position: 'absolute',
    top: 55,
    width: 18,
    height: 18,
    borderRadius: SLRadius.pill,
    borderWidth: 2,
    borderColor: SLColors.textStrong,
    backgroundColor: SLColors.review,
    ...SLShadows.level2,
  },
  exportTrimHint: {
    color: SLColors.review,
    fontSize: 10,
    fontWeight: '800',
  },
  exportStatusBox: {
    minHeight: 40,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.22)',
    backgroundColor: 'rgba(20,184,166,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  exportStatusText: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  exportActions: {
    flexDirection: 'row',
    gap: 10,
  },
  exportActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(15,23,42,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  exportActionButtonPrimary: {
    borderColor: 'rgba(167,243,208,0.34)',
    backgroundColor: 'rgba(20,184,166,0.18)',
  },
  exportActionButtonDisabled: {
    opacity: 0.45,
  },
  exportActionText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  exportActionTextPrimary: {
    color: SLColors.success,
  },
  reviewKeyboardAvoider: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    paddingBottom: 10,
    zIndex: 16,
    elevation: 16,
  },
  reviewSheet: {
    width: '100%',
    maxHeight: '56%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceCommand,
    overflow: 'hidden',
    ...SLShadows.shadowSheet,
  },
  reviewSheetKeyboardOpen: {
    maxHeight: '76%',
  },
  reviewPanelKeyboardOpen: {
    maxHeight: 520,
  },
  reviewSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.14)',
  },
  reviewSheetTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  reviewSheetUnsaved: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    marginTop: 2,
  },
  reviewSheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewSheetKeyboardButton: {
    minHeight: 32,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.24)',
    backgroundColor: 'rgba(20,184,166,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reviewSheetKeyboardButtonText: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  reviewSheetClose: {
    minHeight: 32,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,23,42,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reviewSheetCloseText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  speedSection: {
    gap: 8,
  },
  sectionLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  speedButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  speedButton: {
    minHeight: 32,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: SLColors.borderStandard,
    backgroundColor: SLColors.object,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  speedButtonActive: {
    borderColor: SLColors.borderFocus,
    backgroundColor: SLColors.surfaceSelected,
  },
  speedButtonText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  speedButtonTextActive: {
    color: SLColors.textStrong,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  hudTopLeft: {
    position: 'absolute',
    left: 10,
    maxWidth: '62%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...mediaObject,
  },
  hudBottomLeft: {
    position: 'absolute',
    left: 10,
    bottom: 66,
    maxWidth: '72%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
    ...mediaObject,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...mediaObject,
    borderRadius: SLRadius.lg,
  },
  closeText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  hudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hudKicker: {
    color: SLColors.success,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  hudTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
    marginTop: 3,
    lineHeight: 17,
  },
  hudSubtext: {
    color: SLColors.text,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    marginTop: 2,
    lineHeight: 14,
  },
  hudStatusText: {
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
  hudLine: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    lineHeight: 15,
  },
  hudLabel: {
    color: SLColors.success,
    fontWeight: '900',
  },
  exportUnitChoiceBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    backgroundColor: 'rgba(2,6,23,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  exportUnitChoiceCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: SLRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.26)',
    backgroundColor: 'rgba(15,23,42,0.97)',
    padding: 18,
  },
  exportUnitChoiceKicker: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  exportUnitChoiceTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
    lineHeight: 22,
    marginBottom: 14,
  },
  exportUnitChoiceActions: {
    gap: 10,
  },
  exportUnitChoiceButton: {
    minHeight: 46,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.36)',
    backgroundColor: 'rgba(124,58,237,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportUnitChoiceButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  exportUnitChoiceCancel: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  exportUnitChoiceCancelText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  overlayText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    marginTop: 10,
  },
  errorText: {
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
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
  retryText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
});
