import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import {
  Canvas,
  Circle as SkiaCircle,
  Line as SkiaLine,
  Path as SkiaPath,
  Skia,
  vec,
} from '@shopify/react-native-skia';

import SetVideoPlayerModal, { type SetVideoSummary } from '@/components/SetVideoPlayerModal';
import { ProgrammingMuscleRegionArt } from '@/components/anatomy/ProgrammingMuscleRegionArt';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { ChartAxisModeToggle } from '@/components/charts/ChartAxisModeToggle';
import { Text, TextInput } from '@/components/ui/sl-text';
import { FloatingControlCoordinator, FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { ManufacturerBrandMark } from '@/components/workout-logger/manufacturer-brand-mark';
import { SLColors, SLFontFamilies, SLRadius, SLShadows } from '@/constants/theme';
import { canonicalMovementArtworkSource } from '@/lib/canonical-movement-artwork-assets';
import { API_BASE } from '@/lib/api';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';
import {
  formatCalculatedWeightDeltaFromKg,
  formatCalculatedWeightFromKg,
  formatCompactVolumeValueFromKg,
  formatWeightDeltaFromKg,
  formatWeightFromKg,
  kilogramsToDisplayValue,
  type DisplayWeightUnit,
} from '@/lib/display-units';
import { formatPerformedLoad } from '@/lib/performed-load-semantics';
import {
  SESSION_RECAP_ARCHIVE_ART,
  SESSION_PR_CREST_ART,
  sessionRecapHighlightAsset,
  sessionRecapVideoFixtureAsset,
  type SessionRecapHighlightKind,
} from '@/lib/session-recap-assets';
import { setCompletedSessionRecapOpen } from '@/lib/session-editor-overlay-state';
import { equipmentPresentationLabel, equipmentPresentationParts } from '@/lib/equipment-presentation';
import {
  buildSessionRecapTrendPlot,
  chronologicalTrendPoints,
  formatSessionRecapTrendDelta,
  formatSessionRecapTrendValue,
  trendPointMetricValue,
  type SessionRecapTrendPoint,
} from '@/lib/session-recap-trend';
import {
  buildSessionRecapComparisons,
  filterSessionRecapComparisons,
  sessionRecapTargetGeometry,
  summarizeSessionRecapExecution,
  type SessionRecapComparisonKind,
  type SessionRecapComparisonMovement,
  type SessionRecapSetComparison,
} from '@/lib/session-recap-plan-compare';
import { estimateMovementStrengthKg, strengthMetricForMovementClass } from '@/lib/movement-strength-metric';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import type { AnalyticalXDomainMode } from '@/lib/chart-fidelity';
import {
  formatSessionTimeLabel,
  parseSessionLifecycleInstant,
  resolveSessionTimeZone,
} from '@/lib/post-session-times';
import {
  CANONICAL_PR_EVENT_TYPES,
  accomplishmentMatchesMovement,
  accomplishmentSetLogId,
  buildPersonalBestEvidence,
  finitePrNumber as finiteNumber,
  type PersonalBestEvidence,
  type PersonalBestSetEvidence,
} from '@/lib/post-session-pr-evidence';

export type CompletedRecapSet = {
  id: number;
  set_index?: number | null;
  actual_weight_kg?: number | null;
  actual_reps?: number | null;
  actual_rpe?: number | null;
  actual_rir?: number | null;
  has_pr?: boolean;
  video_attachment_id?: number | null;
  video_id?: number | null;
  video?: SetVideoSummary | null;
};

export type CompletedRecapEquipment = {
  label?: string | null;
  manufacturer?: string | null;
  manufacturer_key?: string | null;
  model?: string | null;
  model_key?: string | null;
  implementation_key?: string | null;
};

type TrendPoint = SessionRecapTrendPoint & {
  date?: string | null;
  workout_id?: number | null;
  set_log_id?: number | null;
  weight_kg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
  score?: number | null;
  metric_value?: number | null;
  volume_kg?: number | null;
  current?: boolean;
};

export type CompletedRecapMovement = {
  item_id?: number | null;
  label: string;
  kind: 'core' | 'accessory';
  lift?: string | null;
  variant?: string | null;
  designation?: string | null;
  superset_group?: string | null;
  superset_pos?: number | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[] | null;
  sets: CompletedRecapSet[];
  equipment?: CompletedRecapEquipment[];
  has_pr?: boolean;
  accomplishment_count?: number;
  accomplishment_ids?: number[];
  measurement?: {
    measurement_type?: string | null;
    load_convention?: string | null;
    equipment_type?: string | null;
    comparison_eligible?: boolean;
    comparison_scope?: string | null;
    canonical_identity_id?: number | null;
    comparison_identity_id?: number | null;
    equipment_configuration_identity_id?: number | null;
  } | null;
  best_set?: {
    set_log_id?: number | null;
    set_index?: number | null;
    weight_kg?: number | null;
    reps?: number | null;
    rpe?: number | null;
    rir?: number | null;
    has_pr?: boolean;
    video_attachment_id?: number | null;
    video?: SetVideoSummary | null;
  } | null;
  trend?: {
    metric?: string | null;
    metric_label?: string | null;
    metric_unit?: string | null;
    direction?: 'higher_is_better' | 'lower_is_better' | null;
    scope?: string | null;
    points?: TrendPoint[];
    delta_value?: number | null;
    delta_kg?: number | null;
    state?: 'trend' | 'limited_history' | 'first_comparable_performance' | 'comparison_unavailable' | null;
    strength_metric?: Record<string, string> | null;
  } | null;
  projection?: {
    metric?: string | null;
    value_kg?: number | null;
    method?: string | null;
    source_set_log_id?: number | null;
    label?: string | null;
    strength_metric?: Record<string, string> | null;
  } | null;
  history_diagnostics?: {
    movement_definition_id?: number | null;
    canonical_key?: string | null;
    comparison_identity_id?: number | null;
    comparison_identity_key?: string | null;
    equipment_configuration_identity_id?: number | null;
    identity_scope?: string | null;
    historical_candidate_count?: number;
    accepted_candidate_count?: number;
    rejected_candidate_count?: number;
    rejected?: { reason?: string; count?: number }[];
  } | null;
};

type ReviewerMovementEvidence = {
  item_id?: number | null;
  previous_best?: {
    weight_kg?: number | null;
    reps?: number | null;
    rpe?: number | null;
    rir?: number | null;
    metric_value?: number | null;
  } | null;
  comparison?: {
    state?: 'improved' | 'stable' | 'declined' | 'not_comparable';
    literal?: string | null;
    metric_delta_percent?: number | null;
  } | null;
  trajectory?: { state?: string | null; label?: string | null; sample_size?: number | null } | null;
  confidence?: { state?: string | null; label?: string | null; sample_size?: number | null; scope?: string | null } | null;
  volume?: {
    current_kg?: number | null;
    previous_kg?: number | null;
    delta_percent?: number | null;
    current_per_set_kg?: number | null;
    previous_per_set_kg?: number | null;
    per_set_delta_percent?: number | null;
  } | null;
};

function normalizeMovementStrengthMetric(movement: CompletedRecapMovement): CompletedRecapMovement {
  const policy = strengthMetricForMovementClass(movement.kind);
  const alreadyGoverned = movement.trend?.metric === policy.metric
    && (!movement.projection || movement.projection.metric === policy.projectionMetric);
  if (alreadyGoverned) return movement;
  const points = (movement.trend?.points || []).map((point) => {
    const value = estimateMovementStrengthKg(policy, point.weight_kg, point.reps, point.rpe, point.rir);
    return value == null ? point : { ...point, score: value, metric_value: value };
  });
  const current = movement.best_set;
  const projectionValue = estimateMovementStrengthKg(
    policy, current?.weight_kg, current?.reps, current?.rpe, current?.rir,
  );
  return {
    ...movement,
    trend: movement.trend ? {
      ...movement.trend,
      metric: policy.metric,
      metric_label: policy.label,
      metric_unit: 'kg',
      points,
      delta_value: points.length > 1
        ? Number(points.at(-1)?.metric_value) - Number(points.at(-2)?.metric_value)
        : null,
      delta_kg: points.length > 1
        ? Number(points.at(-1)?.metric_value) - Number(points.at(-2)?.metric_value)
        : null,
    } : movement.trend,
    projection: movement.projection && projectionValue != null ? {
      ...movement.projection,
      metric: policy.projectionMetric,
      value_kg: projectionValue,
      method: policy.method,
      label: policy.label,
    } : movement.projection,
  };
}

type ReadinessContext = {
  sleep_quality?: number | null;
  sleep_hours?: number | null;
  soreness?: number | null;
  stress?: number | null;
  energy?: number | null;
  readiness_score?: number | null;
  bodyweight_kg?: number | null;
};

export type CompletedSessionRecapPayload = {
  schema_version: string;
  lifecycle_mode: 'completed_recap';
  workout_id: number;
  athlete: { id: number; name: string; sex?: string | null; anatomy_display_preference?: string | null; avatar_url?: string | null };
  session: {
    label: string;
    date?: string | null;
    status: string;
    started_at?: string | null;
    completed_at?: string | null;
    duration_seconds?: number | null;
    set_count: number;
    movement_count: number;
    video_count: number;
    total_volume_kg: number;
    reported_bodyweight?: {
      reported_bodyweight_kg: number;
      reported_at?: string | null;
      training_date?: string | null;
      source: string;
      resolution?: string;
    } | null;
    volume_trend?: {
      scope?: string | null;
      points?: TrendPoint[];
      delta_kg?: number | null;
    } | null;
  };
  highlights?: {
    summary_id?: string | null;
    session_streak?: number | null;
    pr_count?: number | null;
    accomplishment_count?: number | null;
    session_volume_kg?: number | null;
    all_prescribed_work_logged?: boolean;
    prescribed_set_count?: number | null;
    completed_prescribed_set_count?: number | null;
    prescription_completion_percent?: number | null;
    canonical_items?: Record<string, any>[];
    remaining_highlight_count?: number;
  } | null;
  performed_movements: CompletedRecapMovement[];
  muscle_focus?: {
    primary?: { muscle_id: string; score: number }[];
    secondary?: { muscle_id: string; score: number }[];
    source?: string;
  } | null;
  accomplishments: Record<string, any>[];
  reflection: {
    session_rpe?: number | null;
    strength?: string | null;
    fatigue?: string | null;
    note?: string | null;
    submitted_at?: string | null;
  };
  coach_feedback: {
    feedback?: string | null;
    feedback_at?: string | null;
    reviewed?: boolean;
    reviewed_at?: string | null;
    outcome?: string | null;
    author?: { id?: number | null; name?: string | null; avatar_url?: string | null } | null;
  };
  readiness_context?: ReadinessContext | null;
  plan: {
    available?: boolean;
    unavailable_reason?: string | null;
    programming_notes?: string | null;
    movements: Record<string, any>[];
  };
  reviewer_v3?: Record<string, any> | null;
};

export type CompletedRecapImpactSummary = {
  summary_id?: string | null;
  session_streak?: number | null;
  accomplishment_count?: number | null;
  session_volume_kg?: number | null;
  all_prescribed_work_logged?: boolean;
  completed_set_count?: number | null;
  highlights?: Record<string, any>[];
  remaining_highlight_count?: number;
};

export type CoachReviewDraft = {
  coach_feedback: string;
  coach_note: string;
  review_outcome: string;
  review_priority: string;
  followup_adjust_programming: boolean;
  followup_message_athlete: boolean;
  followup_consider_tm: boolean;
  followup_monitor_next: boolean;
  send_feedback_message: boolean;
};

export type CoachReviewContext = {
  draft: CoachReviewDraft;
  outcomes?: { value: string; label: string }[];
  priorities?: { value: string; label: string }[];
  saving?: 'save' | 'complete' | null;
  onDraftChange: (draft: CoachReviewDraft) => void;
  onSave: (draft: CoachReviewDraft, action: 'save' | 'complete') => void;
};

type Props = {
  recap: CompletedSessionRecapPayload;
  impactSummary?: CompletedRecapImpactSummary | null;
  preferredUnits?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onDone?: () => void;
  initialTab?: RecapTab;
  initialToolsOpen?: boolean;
  initialScrollOffsetY?: number;
  initialExpandedItemId?: number;
  viewerMode?: 'athlete' | 'coach';
  sessionTimeZone?: string | null;
  parentProvidesTopSafeArea?: boolean;
  coachReview?: CoachReviewContext | null;
  coachReviewUnavailableReason?: string | null;
  onViewLedger?: () => void;
  onViewCalendar?: () => void;
  onLogNextSession?: () => void;
  onOpenProgramming?: () => void;
  onOpenMovementHistory?: (movement: CompletedRecapMovement) => void;
  onResumeSession?: () => void;
  onCorrectEquipment?: (movement: CompletedRecapMovement) => void;
  onEditSetEvidence?: () => void;
  onEditSessionNotes?: () => void;
  onViewSessionHistory?: () => void;
};

export type RecapTab = 'overview' | 'performed' | 'personal_bests' | 'plan' | 'coach';

function numberLabel(value: unknown, decimals = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'Not recorded';
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(decimals).replace(/\.0$/, '');
}

function durationLabel(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return 'Duration not recorded';
  const minutes = Math.max(0, Math.round(Number(seconds) / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function dateLabel(value?: string | null, includeYear = true) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}),
  }).format(parsed);
}

function absoluteAssetUrl(value?: string | null) {
  const path = String(value || '').trim();
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}

type CanonicalPrEvidence = PersonalBestEvidence<CompletedRecapMovement>;

function completedSetFromRecord(set: PersonalBestSetEvidence | null): CompletedRecapSet | null {
  if (!set) return null;
  return {
    id: set.set_log_id,
    actual_weight_kg: set.weight_kg,
    actual_reps: set.reps,
    actual_rpe: set.rpe,
    actual_rir: set.rir,
  };
}

function prClassification(evidence: CanonicalPrEvidence) {
  const { metric, target_reps: reps } = evidence.record;
  const record = metric === 'rep_max_load' ? `${numberLabel(reps, 0)}RM`
    : metric === 'same_load_reps' ? 'SAME-LOAD REP'
    : metric === 'max_load' ? 'MAX LOAD'
    : metric === 'estimated_1rm' ? 'ESTIMATED 1RM'
    : metric === 'movement_volume' ? 'MOVEMENT VOLUME'
    : metric === 'matched_performance_effort' ? 'MATCHED-PERFORMANCE EFFORT'
    : 'PERSONAL RECORD';
  const scopes = evidence.scopes.includes('career') && evidence.scopes.includes('block')
    ? 'PR · BLOCK BEST'
    : evidence.scopes.includes('block') ? 'BLOCK BEST' : 'PR';
  return `${record} ${scopes}`;
}

function prEvidencePresentation(evidence: CanonicalPrEvidence, unit: DisplayWeightUnit) {
  const { movement, record } = evidence;
  const sourceSet = completedSetFromRecord(record.source_set);
  const priorSet = completedSetFromRecord(record.prior_set);
  const current = record.current_value;
  const prior = record.prior_value;
  const eventDelta = record.delta;
  const percent = current != null && prior != null && Math.abs(prior) > 0.0001 ? ((current - prior) / Math.abs(prior)) * 100 : null;
  const sourceEffort = sourceSet ? effortLabel(sourceSet) : null;
  const priorEffort = priorSet ? effortLabel(priorSet) : null;
  const rawCurrent = movement && sourceSet
    ? `${setResultLabel(sourceSet, movement, unit)}${sourceEffort ? ` · ${sourceEffort}` : ''}`
    : 'Persisted source SetLog unavailable';
  const rawPrior = movement && priorSet
    ? `${setResultLabel(priorSet, movement, unit)}${priorEffort ? ` · ${priorEffort}` : ''}`
    : null;
  let currentLabel = rawCurrent;
  let priorLabel = rawPrior || 'No prior qualifying record';
  let deltaLabel = eventDelta == null ? 'New verified record' : signed(eventDelta) || 'No material change';
  let derivedFromLabel: string | null = null;

  if (record.metric === 'rep_max_load') {
    deltaLabel = eventDelta == null ? `First recorded ${numberLabel(record.target_reps, 0)}RM` : formatCalculatedWeightDeltaFromKg(eventDelta, unit) || signed(eventDelta) || 'No material change';
  } else if (record.metric === 'same_load_reps') {
    deltaLabel = eventDelta == null ? 'First qualifying rep record at this load' : signed(eventDelta, Math.abs(eventDelta) === 1 ? ' rep' : ' reps', 0) || 'No material change';
  } else if (record.metric === 'max_load') {
    deltaLabel = eventDelta == null ? 'First recorded max load' : `${formatCalculatedWeightDeltaFromKg(eventDelta, unit) || signed(eventDelta)}${percent == null ? '' : ` · ${signed(percent, '%')}`}`;
  } else if (record.metric === 'estimated_1rm') {
    currentLabel = formatCalculatedWeightFromKg(current, unit) || 'Estimate unavailable';
    priorLabel = priorSet && prior != null ? formatCalculatedWeightFromKg(prior, unit) || numberLabel(prior) : 'No prior qualifying record';
    derivedFromLabel = sourceSet && movement ? `Derived from ${rawCurrent}` : null;
    deltaLabel = eventDelta == null ? 'First verified estimate' : `${formatCalculatedWeightDeltaFromKg(eventDelta, unit) || signed(eventDelta)}${percent == null ? '' : ` · ${signed(percent, '%')}`}`;
  } else if (record.metric === 'movement_volume') {
    currentLabel = formatCompactVolumeValueFromKg(current, unit) || 'Volume unavailable';
    priorLabel = prior == null ? 'No prior qualifying record' : formatCompactVolumeValueFromKg(prior, unit) || numberLabel(prior);
    deltaLabel = eventDelta == null ? 'First movement-volume record' : formatCalculatedWeightDeltaFromKg(eventDelta, unit) || signed(eventDelta) || 'No material change';
  } else if (record.metric === 'matched_performance_effort') {
    deltaLabel = eventDelta == null ? 'First matched-effort record' : `${signed(eventDelta, ' RPE')} at matched performance`;
  }

  return {
    classification: prClassification(evidence),
    currentLabel,
    priorLabel,
    deltaLabel,
    derivedFromLabel,
    previousDate: record.prior_set?.date || null,
  };
}

function firstRecordChartCopy(evidence: CanonicalPrEvidence) {
  const metric = evidence.record.metric;
  if (metric === 'rep_max_load') return {
    title: `FIRST VERIFIED ${numberLabel(evidence.record.target_reps, 0)}RM`,
    body: 'A second qualifying set is required before a load-progression chart exists.',
  };
  if (metric === 'max_load') return { title: 'FIRST VERIFIED MAX LOAD', body: 'Max-load progression begins with the next qualifying performance.' };
  if (metric === 'estimated_1rm') return { title: 'FIRST VERIFIED ESTIMATE', body: 'Estimated 1RM progression begins with the next qualifying source set.' };
  if (metric === 'movement_volume') return { title: 'FIRST VERIFIED MOVEMENT VOLUME', body: 'Movement-volume progression begins with the next qualifying Session.' };
  return { title: 'FIRST VERIFIED RECORD', body: 'A second qualifying performance is required before progression can be charted.' };
}

function movementRawChange(current: CompletedRecapSet | null, previous: CompletedRecapSet | null, unit: DisplayWeightUnit) {
  const currentWeight = finiteNumber(current?.actual_weight_kg);
  const previousWeight = finiteNumber(previous?.actual_weight_kg);
  if (currentWeight != null && previousWeight != null) {
    const deltaKg = currentWeight - previousWeight;
    const percent = Math.abs(previousWeight) > 0.0001 ? deltaKg / Math.abs(previousWeight) * 100 : null;
    return {
      delta: formatCalculatedWeightDeltaFromKg(deltaKg, unit) || signed(deltaKg) || 'No material change',
      percent: percent == null ? null : signed(percent, '%'),
    };
  }
  const currentReps = finiteNumber(current?.actual_reps);
  const previousReps = finiteNumber(previous?.actual_reps);
  if (currentReps != null && previousReps != null) {
    const deltaReps = currentReps - previousReps;
    const percent = Math.abs(previousReps) > 0.0001 ? deltaReps / Math.abs(previousReps) * 100 : null;
    return { delta: signed(deltaReps, ' reps', 0) || 'No material change', percent: percent == null ? null : signed(percent, '%') };
  }
  return { delta: 'First exact exposure', percent: null };
}

function formatMuscle(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function movementArtworkSource(movement: CompletedRecapMovement) {
  return canonicalMovementArtworkSource(movement);
}

function MovementArtwork({ movement }: { movement: CompletedRecapMovement }) {
  return <CanonicalMovementArtwork movement={movement} size={72} testID="completed-recap-canonical-movement-artwork" />;
}

function setVideoId(set?: CompletedRecapSet | null) {
  return Number(set?.video_attachment_id || set?.video_id || set?.video?.id || 0);
}

function setResultLabel(set: Pick<CompletedRecapSet, 'actual_weight_kg' | 'actual_reps'>, movement: CompletedRecapMovement, unit: DisplayWeightUnit) {
  const type = String(movement.measurement?.measurement_type || 'load_reps').toLowerCase();
  const load = formatPerformedLoad(set.actual_weight_kg, unit, {
    loadConvention: movement.measurement?.load_convention,
    measurementType: movement.measurement?.measurement_type,
  }) || formatWeightFromKg(set.actual_weight_kg, unit) || null;
  const reps = Number(set.actual_reps);
  const repsLabel = Number.isFinite(reps) && reps > 0 ? numberLabel(reps, 0) : null;
  if (type === 'duration' || type === 'time') return repsLabel ? `${repsLabel} sec` : 'Duration not recorded';
  if (type.includes('distance')) return [load, repsLabel ? `${repsLabel} m` : null].filter(Boolean).join(' · ') || 'Distance not recorded';
  if (!load && repsLabel) return `${repsLabel} reps`;
  if (load && repsLabel) return `${load} × ${repsLabel}`;
  return load || 'Performance unavailable';
}

function effortLabel(set: Pick<CompletedRecapSet, 'actual_rpe' | 'actual_rir'>) {
  if (set.actual_rir != null) return `${numberLabel(set.actual_rir)} RIR`;
  if (set.actual_rpe != null) return `RPE ${numberLabel(set.actual_rpe)}`;
  return null;
}

function MovementTrendChart({
  trend,
  unit,
  compact = false,
  card = false,
  color = '#A865FF',
  axisMode = 'chronological',
}: {
  trend?: CompletedRecapMovement['trend'];
  unit: DisplayWeightUnit;
  compact?: boolean;
  card?: boolean;
  color?: string;
  axisMode?: AnalyticalXDomainMode;
}) {
  if (compact) return <CompactMovementTrendChart compact={!card} trend={trend} unit={unit} color={color} />;
  const points = chronologicalTrendPoints(trend?.points).map((point) => {
    const canonical = trendPointMetricValue(point);
    const value = canonical == null ? null : trend?.metric_unit === 'kg' ? kilogramsToDisplayValue(canonical, unit) : canonical;
    return { date: String(point.date || ''), value, meta: point };
  });
  const isWeight = trend?.metric_unit === 'kg';
  return <AnalyticalTimeSeriesChart
    emptyBody="A real prior comparable exposure is required before this trend is established."
    emptyTitle="Comparison unavailable"
    height={226}
    metric={analyticalMetricDefinition(String(trend?.metric || 'best_set'), { label: trend?.metric_label || 'Best-set performance', kind: isWeight ? 'weight' : 'score', unit: isWeight ? unit : trend?.metric_unit || undefined, axisUnit: isWeight ? unit : trend?.metric_unit || undefined, includeZero: false, maximumFractionDigits: 1 })}
    readableText
    series={[{ key: 'performance', label: trend?.metric_label || 'Best-set performance', color, points }]}
    showLegend={false}
    testID="session-recap-movement-trend-chart"
    xDomainMode={axisMode}
    tooltipRows={(selection) => {
      const point = selection.values[0]?.meta as TrendPoint | undefined;
      const effort = point?.rir != null ? `${numberLabel(point.rir)} RIR` : point?.rpe != null ? `RPE ${numberLabel(point.rpe)}` : null;
      return [point?.current ? 'This Session' : 'Exact comparable exposure', point?.reps ? `${numberLabel(point.reps, 0)} reps${effort ? ` · ${effort}` : ''}` : effort].filter(Boolean) as string[];
    }}
  />;
}

function CompactMovementTrendChart({
  trend,
  unit,
  compact = false,
  color = '#A865FF',
}: {
  trend?: CompletedRecapMovement['trend'];
  unit: DisplayWeightUnit;
  compact?: boolean;
  color?: string;
}) {
  const [measuredWidth, setMeasuredWidth] = useState(compact ? 96 : 280);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const height = compact ? 42 : 118;
  const plot = useMemo(() => buildSessionRecapTrendPlot({
    points: trend?.points,
    width: measuredWidth,
    height,
    insetX: compact ? 5 : 12,
    insetY: compact ? 5 : 13,
  }), [compact, height, measuredWidth, trend?.points]);
  useEffect(() => {
    setSelectedIndex(plot.points.length ? plot.points.length - 1 : null);
  }, [plot.points.length]);
  const path = useMemo(() => {
    const next = Skia.Path.Make();
    plot.points.forEach((point, index) => {
      if (index === 0) next.moveTo(point.x, point.y);
      else next.lineTo(point.x, point.y);
    });
    return next;
  }, [plot.points]);

  if (plot.points.length < 2) {
    return <View style={styles.sparklineEmpty}><Text style={styles.sparklineEmptyText}>{plot.points.length === 1 ? 'FIRST EXACT EXPOSURE' : 'HISTORY BUILDS NEXT TIME'}</Text></View>;
  }
  const selected = selectedIndex == null ? null : plot.points[selectedIndex];
  return (
    <View
      accessibilityLabel={`${plot.points.length} point ${trend?.metric_label || 'best-set'} trend`}
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width);
        if (width > 0 && width !== measuredWidth) setMeasuredWidth(width);
      }}
      style={[styles.trendPlot, compact && styles.trendPlotCompact]}
    >
      <Canvas style={{ width: measuredWidth, height }}>
        {plot.gridY.map((y, index) => <SkiaLine key={index} color={index === plot.gridY.length - 1 ? '#343947' : '#20242E'} p1={vec(0, y)} p2={vec(measuredWidth, y)} strokeWidth={index === plot.gridY.length - 1 ? 1 : 0.6} />)}
        <SkiaPath path={path} color={color} style="stroke" strokeCap="round" strokeJoin="round" strokeWidth={compact ? 2.2 : 2.8} />
        {plot.points.map((point, index) => <SkiaCircle key={`${point.set_log_id || point.date || index}`} cx={point.x} cy={point.y} r={index === selectedIndex ? (compact ? 3.5 : 5) : (compact ? 2.1 : 3.2)} color={point.current ? '#D69BFF' : color} />)}
      </Canvas>
      {!compact ? <>
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { height }]}>{plot.points.map((point, index) => <Pressable key={`${point.set_log_id || point.date || index}-tap`} accessibilityRole="button" accessibilityLabel={`${point.current ? 'This Session' : dateLabel(point.date, false)}, ${formatSessionRecapTrendValue(point.value, trend?.metric_unit, unit)}`} onPress={() => setSelectedIndex(index)} style={[styles.trendPointTarget, { left: Math.max(0, point.x - 17), top: Math.max(0, point.y - 17) }]} />)}</View>
        {selected ? <View style={styles.trendInspection}><Text style={styles.trendInspectionDate}>{selected.current ? 'THIS SESSION' : dateLabel(selected.date, false).toUpperCase()}</Text><Text style={styles.trendInspectionValue}>{formatSessionRecapTrendValue(selected.value, trend?.metric_unit, unit)}</Text>{selected.reps ? <Text style={styles.trendInspectionMeta}>Best set · {numberLabel(selected.reps, 0)} reps</Text> : null}</View> : null}
        <View style={styles.trendAxis}><Text style={styles.trendAxisLabel}>{plot.points[0].current ? 'THIS SESSION' : dateLabel(plot.points[0].date, false)}</Text><Text style={styles.trendAxisLabel}>{plot.points.at(-1)?.current ? 'THIS SESSION' : dateLabel(plot.points.at(-1)?.date, false)}</Text></View>
      </> : null}
    </View>
  );
}

function SummaryMetric({ icon, value, label }: { icon?: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  return <View style={styles.summaryMetric}>{icon ? <Ionicons name={icon} size={18} color={SLColors.accentMuted} /> : null}<View style={styles.summaryMetricCopy}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.summaryMetricValue}>{value}</Text><Text numberOfLines={1} style={styles.summaryMetricLabel}>{label}</Text></View></View>;
}

function HighlightCard({ kind, color, label, value, detail }: { kind: SessionRecapHighlightKind; color: string; label: string; value: string; detail: string }) {
  return <View style={[styles.highlightCard, { borderColor: `${color}66` }]}><LinearGradient colors={[`${color}24`, 'rgba(7,8,13,0.12)', '#07080D']} style={StyleSheet.absoluteFillObject} /><Image accessibilityIgnoresInvertColors resizeMode="contain" source={sessionRecapHighlightAsset(kind)} style={styles.highlightArtwork} /><View style={styles.highlightCopy}><Text style={[styles.highlightLabel, { color }]}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.highlightValue}>{value}</Text><Text numberOfLines={2} style={styles.highlightDetail}>{detail}</Text></View></View>;
}

function videoThumbnailSource(set?: CompletedRecapSet | null, fallbackSource?: ImageSourcePropType | null): ImageSourcePropType | null {
  const fixture = sessionRecapVideoFixtureAsset(set?.video?.thumbnail_url);
  if (fixture) return fixture;
  const thumbnail = absoluteAssetUrl(set?.video?.thumbnail_url);
  if (thumbnail) return { uri: thumbnail };
  return fallbackSource || null;
}

function SetVideoButton({ set, fallbackSource, onPress }: { set: CompletedRecapSet; fallbackSource?: any; onPress: () => void }) {
  const thumbnail = videoThumbnailSource(set, fallbackSource);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Play video for set ${set.set_index || ''}`.trim()} onPress={onPress} style={({ pressed }) => [styles.videoButton, pressed && styles.pressed]}>{thumbnail ? <Image accessibilityIgnoresInvertColors resizeMode="cover" source={thumbnail} style={styles.videoThumbnail} /> : null}<View style={styles.videoPlay}><Ionicons name="play" size={10} color={SLColors.textPrimary} /></View></Pressable>;
}

function VideoEvidencePreview({ set, fallbackSource }: { set: CompletedRecapSet; fallbackSource?: ImageSourcePropType | null }) {
  const thumbnail = videoThumbnailSource(set, fallbackSource);
  return <View style={styles.videoEvidencePreview}>{thumbnail ? <Image accessibilityIgnoresInvertColors resizeMode="cover" source={thumbnail} style={styles.videoThumbnail} /> : null}<LinearGradient colors={['transparent', 'rgba(2,3,6,0.9)']} style={StyleSheet.absoluteFillObject} /><View style={styles.videoEvidencePlay}><Ionicons name="play" size={8} color={SLColors.textPrimary} /></View><Text style={styles.videoEvidenceLabel}>SET {set.set_index || 'RECORDED'}</Text></View>;
}

function ReadinessGauge({ label, value, color, suffix = '/10' }: { label: string; value: number; color: string; suffix?: string }) {
  const safeValue = Math.max(0, Math.min(10, Number(value) || 0));
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * safeValue / 10;
  return <View style={styles.readinessGauge}><View style={styles.readinessGaugeVisual}><Svg width={68} height={68} viewBox="0 0 68 68"><SvgCircle cx={34} cy={34} fill="rgba(4,5,9,0.96)" r={27} stroke={SLColors.borderSubtle} strokeWidth={6} /><SvgCircle cx={34} cy={34} fill="none" origin="34,34" r={radius} rotation={-90} stroke={color} strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round" strokeWidth={6} /></Svg><View style={styles.readinessGaugeValueWrap}><Text style={styles.readinessGaugeValue}>{numberLabel(value)}</Text><Text style={styles.readinessGaugeSuffix}>{suffix}</Text></View></View><Text style={styles.readinessGaugeLabel}>{label}</Text></View>;
}

function VolumeBars({ points }: { points?: TrendPoint[] | null }) {
  const rows = (points || []).filter((point) => Number.isFinite(Number(point.volume_kg)) && Number(point.volume_kg) > 0);
  const max = Math.max(1, ...rows.map((point) => Number(point.volume_kg)));
  return <View style={styles.volumeBars}>{rows.map((point, index) => <View key={`${point.workout_id || point.date || index}`} style={styles.volumeBarColumn}><View style={[styles.volumeBar, { height: `${Math.max(12, Number(point.volume_kg) / max * 100)}%` }, point.current && styles.volumeBarCurrent]} /><Text style={styles.volumeBarDate}>{dateLabel(point.date, false).replace(/\s\d+$/, '')}</Text></View>)}</View>;
}

function equipmentSecondaryLabel(row: CompletedRecapEquipment) {
  const parts = equipmentPresentationParts(row.label).filter((part) => part !== row.manufacturer);
  if (parts.length) return parts.join(' · ');
  if (row.model) return row.model;
  const implementation = String(row.implementation_key || '').split(':').at(-1);
  return equipmentPresentationLabel(implementation, 'Equipment');
}

function EquipmentFooter({ equipment }: { equipment: CompletedRecapEquipment[] }) {
  if (!equipment.length) return null;
  return <View style={styles.equipmentFooter}>{equipment.map((row, index) => <View key={`${row.manufacturer_key || row.manufacturer || 'equipment'}-${row.model_key || row.model || index}`} style={styles.equipmentItem}>{row.manufacturer ? <ManufacturerBrandMark manufacturerName={row.manufacturer} compact /> : null}<View style={styles.equipmentCopy}><Text numberOfLines={1} style={styles.equipmentModel}>{row.manufacturer || 'Equipment'}</Text><Text numberOfLines={1} style={styles.equipmentImplementation}>{equipmentSecondaryLabel(row)}</Text></View></View>)}</View>;
}

function PerformedMovementCard({ movement, analysis, unit, onVideo, onOpenHistory, initialExpanded = false }: { movement: CompletedRecapMovement; analysis?: ReviewerMovementEvidence | null; unit: DisplayWeightUnit; onVideo: (set: CompletedRecapSet) => void; onOpenHistory?: (movement: CompletedRecapMovement) => void; initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [historyAxisMode, setHistoryAxisMode] = useState<AnalyticalXDomainMode>('chronological');
  useEffect(() => setExpanded(initialExpanded), [initialExpanded]);
  const equipment = movement.equipment || [];
  const best = movement.best_set;
  const bestAsSet: CompletedRecapSet | null = best ? {
    id: Number(best.set_log_id || 0), set_index: best.set_index, actual_weight_kg: best.weight_kg,
    actual_reps: best.reps, actual_rpe: best.rpe, actual_rir: best.rir,
    video_attachment_id: best.video_attachment_id, video: best.video,
  } : null;
  const delta = formatSessionRecapTrendDelta(movement.trend, unit);
  const muscleLine = [movement.primary_muscle_group, ...(movement.secondary_muscle_groups || []).slice(0, 1)].filter(Boolean).map((row) => formatMuscle(String(row))).join(' · ');
  const videoSets = movement.sets.filter((set) => setVideoId(set) > 0);
  const previewVideo = videoSets[0] || null;
  const previous = analysis?.previous_best || previousExposureForMovement(movement);
  const previousAsSet: CompletedRecapSet | null = previous ? {
    id: 0,
    actual_weight_kg: previous.weight_kg,
    actual_reps: previous.reps,
    actual_rpe: previous.rpe,
    actual_rir: previous.rir,
  } : null;
  const comparisonState = analysis?.comparison?.state || ((movement.trend?.points?.length || 0) >= 2 ? (Number(movement.trend?.delta_value ?? movement.trend?.delta_kg) > 0 ? 'improved' : Number(movement.trend?.delta_value ?? movement.trend?.delta_kg) < 0 ? 'declined' : 'stable') : 'not_comparable');
  const comparisonColor = comparisonState === 'improved' ? SLColors.success : comparisonState === 'declined' ? SLColors.danger : comparisonState === 'stable' ? '#53CBE8' : SLColors.textMuted;
  const rawChange = movementRawChange(bestAsSet, previousAsSet, unit);
  const interpretation = comparisonState === 'not_comparable' ? 'FIRST EXACT EXPOSURE' : comparisonState.replaceAll('_', ' ').toUpperCase();
  const trendPointCount = movement.trend?.points?.length || 0;
  const trendBadge = trendPointCount >= 2
    ? `${trendPointCount} SESSION TREND`
    : movement.trend?.state === 'first_comparable_performance'
      ? 'FIRST PERFORMANCE'
      : null;
  return (
    <View style={[styles.movementCard, movement.kind === 'core' && styles.coreMovementCard]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${movement.label}`} onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.movementHeader, pressed && styles.pressed]}>
        <View style={styles.movementMedia}><View style={styles.artwork}><LinearGradient colors={['rgba(127,55,208,0.19)', 'rgba(4,5,9,0.04)']} style={StyleSheet.absoluteFillObject} /><MovementArtwork movement={movement} /></View>{previewVideo ? <VideoEvidencePreview set={previewVideo} fallbackSource={movementArtworkSource(movement)} /> : null}</View>
        <View style={styles.movementSummary}>
          <View style={styles.movementTitleRow}><View style={styles.movementTitleCopy}><Text style={styles.movementEyebrow}>{movement.kind === 'core' ? 'CORE LIFT' : 'ACCESSORY'}</Text><Text numberOfLines={1} style={styles.movementTitle}>{movement.label}</Text>{muscleLine ? <Text numberOfLines={1} style={styles.movementMuscles}>{muscleLine}</Text> : null}{equipment[0] ? <Text numberOfLines={1} style={styles.movementEquipment}>{equipment[0].label || equipmentSecondaryLabel(equipment[0])}</Text> : null}</View>{movement.has_pr ? <View style={styles.prBadge}><Image accessibilityIgnoresInvertColors source={sessionRecapHighlightAsset('pr')} style={styles.movementPrArtwork} /><Text style={styles.prBadgeText}>PR</Text></View> : null}<Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color={SLColors.textSecondary} /></View>
          <View style={styles.movementComparisonGrid}>
            <View style={styles.movementComparisonPair}>
              <View style={styles.movementComparisonCell}><Text style={styles.movementComparisonLabel}>THIS SESSION</Text><Text numberOfLines={2} style={styles.movementComparisonValue}>{bestAsSet ? `${setResultLabel(bestAsSet, movement, unit)}${effortLabel(bestAsSet) ? ` · ${effortLabel(bestAsSet)}` : ''}` : `${movement.sets.length} performed set${movement.sets.length === 1 ? '' : 's'}`}</Text></View>
              <View style={styles.movementComparisonCell}><Text style={styles.movementComparisonLabel}>LAST TIME</Text><Text numberOfLines={2} style={styles.movementComparisonValue}>{previousAsSet ? `${setResultLabel(previousAsSet, movement, unit)}${effortLabel(previousAsSet) ? ` · ${effortLabel(previousAsSet)}` : ''}` : 'No prior comparable Session'}</Text></View>
            </View>
            <View style={styles.movementComparisonChange}><View style={styles.movementChangeValues}><Text style={styles.movementComparisonLabel}>CHANGE</Text><Text style={[styles.movementChangeValue, { color: comparisonColor }]}>{rawChange.delta}{rawChange.percent ? ` · ${rawChange.percent}` : ''}</Text></View><View style={[styles.movementStateBadge, { borderColor: `${comparisonColor}77`, backgroundColor: `${comparisonColor}12` }]}><Text numberOfLines={1} style={[styles.movementComparisonState, { color: comparisonColor }]}>{interpretation}</Text></View></View>
          </View>
          <View style={styles.movementTrendPanel}><View style={styles.movementTrendHeading}><Text style={styles.movementComparisonLabel}>{movement.trend?.metric_label?.toUpperCase() || 'PROGRESSION'} · EXACT MOVEMENT</Text>{delta && Number(movement.trend?.delta_value ?? movement.trend?.delta_kg) !== 0 ? <Text style={[styles.trendDeltaValue, delta.startsWith('↑') ? styles.deltaUpText : styles.deltaDownText]}>{delta}</Text> : null}</View><MovementTrendChart compact card trend={movement.trend} unit={unit} /></View>
          <View style={styles.movementMetaRail}>{trendBadge ? <Text style={styles.movementMeta}>{trendBadge}</Text> : null}{videoSets.length ? <Text style={styles.movementMeta}>{videoSets.length} VIDEO{videoSets.length === 1 ? '' : 'S'}</Text> : null}{equipment[0]?.model ? <Text numberOfLines={1} style={styles.movementMeta}>{equipment[0].model.toUpperCase()}</Text> : null}</View>
        </View>
      </Pressable>
      {expanded ? <View style={styles.expandedEvidence}>
        {bestAsSet && setVideoId(bestAsSet) > 0 ? <Pressable accessibilityRole="button" onPress={() => onVideo(bestAsSet)} style={({ pressed }) => [styles.bestVideoCard, pressed && styles.pressed]}><View style={styles.bestVideoMedia}>{videoThumbnailSource(bestAsSet, movementArtworkSource(movement)) ? <Image accessibilityIgnoresInvertColors resizeMode="cover" source={videoThumbnailSource(bestAsSet, movementArtworkSource(movement))!} style={styles.videoThumbnail} /> : null}<LinearGradient colors={['transparent', 'rgba(2,3,6,0.88)']} style={StyleSheet.absoluteFillObject} /><View style={styles.bestVideoPlay}><Ionicons name="play" size={16} color={SLColors.textPrimary} /></View><Text style={styles.bestVideoOverlay}>SET {bestAsSet.set_index || 'RECORDED'}</Text></View><View style={styles.bestVideoCopy}><Text style={styles.detailKicker}>BEST SET VIDEO</Text><Text style={styles.bestVideoValue}>{setResultLabel(bestAsSet, movement, unit)}</Text><Text style={styles.detailMeta}>Exact SetLog evidence · tap to review</Text></View><Ionicons name="expand-outline" size={19} color={SLColors.textSecondary} /></Pressable> : null}
        <View style={styles.setTable}><View style={styles.setHeader}><Text style={[styles.columnLabel, styles.setNumberColumn]}>SET</Text><Text style={[styles.columnLabel, styles.resultColumn]}>RESULT</Text><Text style={[styles.columnLabel, styles.effortColumn]}>EFFORT</Text><View style={styles.videoColumn} /></View>{movement.sets.map((set, index) => <View key={set.id || index} style={styles.setRow}><Text style={[styles.setValue, styles.setNumberColumn]}>{set.set_index || index + 1}</Text><View style={styles.resultColumnRow}><Text numberOfLines={1} style={styles.setValueStrong}>{setResultLabel(set, movement, unit)}</Text>{set.has_pr ? <Text style={styles.setPr}>PR</Text> : null}</View><Text numberOfLines={1} style={[styles.setValue, styles.effortColumn]}>{effortLabel(set) || 'Not logged'}</Text><View style={styles.videoColumn}>{setVideoId(set) > 0 ? <SetVideoButton set={set} fallbackSource={movementArtworkSource(movement)} onPress={() => onVideo(set)} /> : null}</View></View>)}</View>
        {(movement.trend?.points?.length || 0) >= 2 ? <View style={styles.trendDetail}><View style={styles.trendDetailHeader}><View style={styles.trendDetailCopy}><Text style={styles.detailKicker}>{movement.trend?.metric_label?.toUpperCase() || 'BEST SET TREND'} · EXACT MOVEMENT</Text><Text style={styles.detailMeta}>{movement.trend?.state === 'limited_history' ? 'Two comparable Sessions' : `${movement.trend?.points?.length || 0} comparable Sessions`}</Text></View>{delta ? <Text style={[styles.trendDeltaValue, delta.startsWith('↑') ? styles.deltaUpText : styles.deltaDownText]}>{delta}</Text> : null}<ChartAxisModeToggle value={historyAxisMode} onChange={setHistoryAxisMode} testID={`post-session-axis-mode-${movement.item_id || 'movement'}`} /></View><MovementTrendChart trend={movement.trend} unit={unit} axisMode={historyAxisMode} /></View> : <View style={styles.limitedHistoryCard}><Text style={styles.limitedHistoryTitle}>No prior exact comparison yet</Text><Text style={styles.limitedHistoryBody}>This exact performed identity needs another comparable Session before a progression chart can be established.</Text></View>}
        {movement.measurement?.canonical_identity_id && onOpenHistory ? <Pressable accessibilityRole="button" accessibilityLabel={`Open exact Movement History for ${movement.label}`} onPress={() => onOpenHistory(movement)} style={({ pressed }) => [styles.historyAction, pressed && styles.pressed]}><View><Text style={styles.historyActionLabel}>MOVEMENT HISTORY</Text><Text style={styles.historyActionDetail}>{movement.kind === 'core' ? 'Exact governed Core evidence' : 'Canonical exact-movement evidence'}</Text></View><Ionicons name="analytics-outline" size={18} color={SLColors.accentMuted} /></Pressable> : null}
        {typeof __DEV__ !== 'undefined' && __DEV__ && movement.history_diagnostics ? <View style={styles.diagnosticCard}><Text style={styles.detailKicker}>DEV · HISTORY DIAGNOSTICS</Text><Text style={styles.diagnosticLine}>Movement {movement.history_diagnostics.canonical_key || movement.history_diagnostics.movement_definition_id || 'unresolved'} · comparison {movement.history_diagnostics.comparison_identity_key || movement.history_diagnostics.comparison_identity_id || 'unresolved'}</Text><Text style={styles.diagnosticLine}>Equipment configuration {movement.history_diagnostics.equipment_configuration_identity_id || 'none'} · {movement.history_diagnostics.identity_scope || 'no scope'}</Text><Text style={styles.diagnosticLine}>Metric {movement.trend?.metric || 'none'} · delta {movement.trend?.delta_value ?? movement.trend?.delta_kg ?? 'none'}</Text><Text style={styles.diagnosticLine}>{movement.history_diagnostics.historical_candidate_count || 0} candidates · {movement.history_diagnostics.accepted_candidate_count || 0} accepted · {movement.history_diagnostics.rejected_candidate_count || 0} rejected</Text>{movement.history_diagnostics.rejected?.map((row, index) => <Text key={`${row.reason}-${index}`} style={styles.diagnosticReason}>{row.reason || 'unspecified'} · {row.count || 0}</Text>)}</View> : null}
        <EquipmentFooter equipment={equipment} />
      </View> : null}
    </View>
  );
}

function planPrescription(item: Record<string, any>, unit: DisplayWeightUnit) {
  const parts = [`${numberLabel(item.sets, 0)} × ${String(item.reps_text || numberLabel(item.reps, 0))}`];
  if (item.rpe_target != null) parts.push(`@ RPE ${numberLabel(item.rpe_target)}`);
  else if (item.rir_target != null) parts.push(`@ ${numberLabel(item.rir_target)} RIR`);
  else if (item.pct != null) parts.push(`@ ${numberLabel(Number(item.pct) <= 1 ? Number(item.pct) * 100 : item.pct, 0)}%`);
  const low = item.coach_prescribed_low_kg ?? item.target_low_kg;
  const high = item.coach_prescribed_high_kg ?? item.target_high_kg;
  const lowLabel = formatWeightFromKg(low, unit);
  const highLabel = formatWeightFromKg(high, unit);
  if (lowLabel && highLabel) parts.push(Number(low) === Number(high) ? lowLabel : `${lowLabel}–${highLabel}`);
  return parts.join(' · ');
}

type PlanComparisonRow = SessionRecapComparisonMovement<Record<string, any>, CompletedRecapMovement>;
type PlanCompareFilter = 'all' | 'matched' | 'differences' | 'not_logged';

const COMPARISON_PRESENTATION: Record<SessionRecapComparisonKind, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  matched: { label: 'Matched', color: '#32D17C', icon: 'checkmark-circle-outline' },
  above_target: { label: 'Above target', color: '#F4B43C', icon: 'arrow-up-circle-outline' },
  below_target: { label: 'Below target', color: '#F4B43C', icon: 'arrow-down-circle-outline' },
  different_load: { label: 'Different load', color: '#38C8F4', icon: 'swap-horizontal-outline' },
  not_logged: { label: 'Not logged', color: '#858895', icon: 'remove-circle-outline' },
};

function comparisonMovementState(row: PlanComparisonRow) {
  const counts = row.comparisons.reduce<Record<SessionRecapComparisonKind, number>>((result, comparison) => {
    result[comparison.kind] += 1;
    return result;
  }, { matched: 0, above_target: 0, below_target: 0, different_load: 0, not_logged: 0 });
  if (counts.not_logged === row.comparisons.length) return { ...COMPARISON_PRESENTATION.not_logged, label: 'Not logged' };
  const differenceCount = counts.above_target + counts.below_target + counts.different_load;
  if (differenceCount) {
    const primary = counts.above_target ? 'above_target' : counts.below_target ? 'below_target' : 'different_load';
    return { ...COMPARISON_PRESENTATION[primary], label: `${differenceCount} difference${differenceCount === 1 ? '' : 's'}` };
  }
  return { ...COMPARISON_PRESENTATION.matched, label: `${counts.matched} / ${row.comparisons.length} matched` };
}

function plannedRepLabel(comparison: SessionRecapSetComparison) {
  const low = comparison.plan.repLow;
  const high = comparison.plan.repHigh;
  if (low == null || high == null) return 'Open target';
  return low === high ? `${numberLabel(low, 0)} reps` : `${numberLabel(low, 0)}–${numberLabel(high, 0)} reps`;
}

function plannedEffortLabel(comparison: SessionRecapSetComparison) {
  if (comparison.plan.rirTarget != null) return `@ ${numberLabel(comparison.plan.rirTarget)} RIR`;
  if (comparison.plan.rpeTarget != null) return `@ RPE ${numberLabel(comparison.plan.rpeTarget)}`;
  return null;
}

function previousExposureForMovement(movement?: CompletedRecapMovement | null) {
  return [...(movement?.trend?.points || [])].filter((point) => !point.current).at(-1) || null;
}

function ExecutionDonut({ percent }: { percent: number }) {
  const size = 90;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, percent));
  return <View style={styles.executionDonut}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#242731" strokeWidth={stroke} />
      <SvgCircle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#32D17C" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress / 100)} strokeLinecap="round" strokeWidth={stroke} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
    <View style={styles.executionDonutCopy}><Text style={styles.executionDonutValue}>{progress}%</Text><Text style={styles.executionDonutLabel}>OF PLAN{`\n`}LOGGED</Text></View>
  </View>;
}

function ExecutionSummary({ rows }: { rows: PlanComparisonRow[] }) {
  const summary = summarizeSessionRecapExecution(rows);
  const denominator = Math.max(1, summary.plannedSetCount);
  const plannedDifferences = Math.min(summary.differenceSetCount, Math.max(0, summary.plannedSetCount - summary.matchedSetCount - summary.notLoggedSetCount));
  return <View style={styles.executionCard}>
    <View style={styles.executionHeading}><Text style={styles.executionHeadingText}>SESSION EXECUTION</Text><Ionicons name="information-circle-outline" size={16} color={SLColors.textMuted} /></View>
    <View style={styles.executionBody}>
      <View style={styles.executionMetrics}>
        {[
          { value: summary.plannedSetCount, label: 'PLANNED SETS', color: '#B66CFF' },
          { value: summary.loggedSetCount, label: 'LOGGED SETS', color: '#32D17C' },
          { value: summary.differenceSetCount, label: 'DIFFERENCES', color: '#F4A62A' },
          { value: summary.notLoggedSetCount, label: 'NOT LOGGED', color: '#858895' },
        ].map((metric) => <View key={metric.label} style={styles.executionMetric}><Text style={[styles.executionMetricValue, { color: metric.color }]}>{metric.value}</Text><Text style={styles.executionMetricLabel}>{metric.label}</Text></View>)}
      </View>
      <ExecutionDonut percent={summary.completionPercent} />
    </View>
    <View style={styles.executionRail}>
      <View style={[styles.executionRailSegment, { flex: summary.matchedSetCount / denominator, backgroundColor: '#24C773' }]} />
      <View style={[styles.executionRailSegment, { flex: plannedDifferences / denominator, backgroundColor: '#F29C22' }]} />
      <View style={[styles.executionRailSegment, { flex: summary.notLoggedSetCount / denominator, backgroundColor: '#555863' }]} />
    </View>
    <Text style={styles.executionFootnote}>{summary.loggedPlannedSetCount} of {summary.plannedSetCount} planned sets contain persisted SetLog evidence.</Text>
  </View>;
}

function ComparisonFilterBar({ filter, rows, onChange, edgeToEdge = false }: { filter: PlanCompareFilter; rows: PlanComparisonRow[]; onChange: (filter: PlanCompareFilter) => void; edgeToEdge?: boolean }) {
  const summary = summarizeSessionRecapExecution(rows);
  const filters: { key: PlanCompareFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: rows.length, color: '#B66CFF' },
    { key: 'matched', label: 'Matched', count: summary.matchedSetCount, color: '#32D17C' },
    { key: 'differences', label: 'Differences', count: summary.differenceSetCount, color: '#F4A62A' },
    { key: 'not_logged', label: 'Not Logged', count: summary.notLoggedSetCount, color: '#858895' },
  ];
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.compareFilters, edgeToEdge && styles.edgeToEdge]}>{filters.map((item) => {
    const selected = filter === item.key;
    return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(item.key)} style={({ pressed }) => [styles.compareFilter, selected && styles.compareFilterSelected, pressed && styles.pressed]}><View style={[styles.compareFilterDot, { backgroundColor: item.color }]} /><Text style={[styles.compareFilterText, selected && styles.compareFilterTextSelected]}>{item.label} ({item.count})</Text></Pressable>;
  })}</ScrollView>;
}

function TargetBand({ comparison }: { comparison: SessionRecapSetComparison }) {
  const reps = comparison.performed?.actual_reps == null ? null : Number(comparison.performed.actual_reps);
  const geometry = sessionRecapTargetGeometry(comparison.plan.repLow, comparison.plan.repHigh, reps);
  if (!geometry || !comparison.performed) return <Text style={styles.targetUnavailable}>{comparison.performed ? 'Open target' : 'Not logged'}</Text>;
  const presentation = COMPARISON_PRESENTATION[comparison.kind];
  return <View style={styles.targetBand}>
    <View style={styles.targetBandRail}>
      <View style={[styles.targetBandRange, { left: `${geometry.targetStart}%`, width: `${geometry.targetWidth}%` }]} />
      <View style={[styles.targetBandMarker, { left: `${geometry.marker}%`, borderColor: presentation.color }]} />
    </View>
    <Ionicons name={presentation.icon} size={18} color={presentation.color} />
  </View>;
}

function PlanComparisonCard({ row, expanded, unit, onToggle, onOpenHistory }: { row: PlanComparisonRow; expanded: boolean; unit: DisplayWeightUnit; onToggle: () => void; onOpenHistory?: (movement: CompletedRecapMovement, displayUnit: DisplayWeightUnit) => void }) {
  const movement = row.performed;
  const plan = row.plan;
  const state = comparisonMovementState(row);
  const equipment = movement?.equipment || [];
  const muscles = [movement?.primary_muscle_group, ...(movement?.secondary_muscle_groups || []).slice(0, 1)].filter(Boolean).map((value) => formatMuscle(String(value)));
  const previous = previousExposureForMovement(movement);
  const artwork = movement ? movementArtworkSource(movement) : null;
  const title = String(movement?.label || plan?.label || 'Movement');
  const prescription = plan ? planPrescription(plan, unit) : 'No matching prescription';
  return <View style={[styles.compareMovementCard, expanded && styles.compareMovementCardExpanded]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title} comparison`} onPress={onToggle} style={({ pressed }) => [styles.compareMovementHeader, pressed && styles.pressed]}>
      <View style={styles.compareArtwork}>{artwork ? <Image accessibilityIgnoresInvertColors resizeMode="contain" source={artwork} style={styles.compareArtworkImage} /> : <Ionicons name="barbell-outline" size={30} color={SLColors.accentMuted} />}</View>
      {equipment[0]?.manufacturer ? <View style={styles.compareManufacturer}><ManufacturerBrandMark compact manufacturerName={equipment[0].manufacturer} /></View> : null}
      <View style={styles.compareMovementCopy}><Text numberOfLines={2} style={styles.compareMovementTitle}>{title}</Text>{equipment[0] ? <Text numberOfLines={1} style={styles.compareEquipment}>{equipment[0].label || equipmentSecondaryLabel(equipment[0])}</Text> : muscles.length ? <Text numberOfLines={1} style={styles.compareEquipment}>{muscles.join(' · ')}</Text> : null}<Text numberOfLines={1} style={styles.comparePrescription}>{prescription}</Text></View>
      <View style={styles.compareStateWrap}><View style={[styles.compareStateBadge, { borderColor: `${state.color}88`, backgroundColor: `${state.color}12` }]}><Text style={[styles.compareStateText, { color: state.color }]}>{state.label.toUpperCase()}</Text></View><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={SLColors.textSecondary} /></View>
    </Pressable>
    {expanded ? <View style={styles.compareExpanded}>
      <View style={styles.compareContextGrid}>
        <View style={styles.compareMuscleColumn}><Text style={styles.compareColumnKicker}>TRAINING FOCUS</Text>{muscles[0] ? <><Text style={styles.compareMuscleRole}>PRIMARY</Text><Text style={styles.compareMuscleName}>{muscles[0]}</Text></> : null}{muscles[1] ? <><Text style={styles.compareMuscleRole}>SECONDARY</Text><Text style={styles.compareMuscleName}>{muscles[1]}</Text></> : null}</View>
        <View style={styles.compareProgramColumn}><Text style={[styles.compareColumnKicker, { color: '#C26EFF' }]}>PROGRAMMED</Text><Text style={styles.compareProgramValue}>{plan ? `${numberLabel(plan.sets, 0)} sets` : 'No plan row'}</Text><Text style={styles.compareProgramValue}>{row.comparisons[0] ? plannedRepLabel(row.comparisons[0]) : 'Open reps'}</Text>{row.comparisons[0] && plannedEffortLabel(row.comparisons[0]) ? <Text style={styles.compareProgramValue}>{plannedEffortLabel(row.comparisons[0])}</Text> : null}{plan?.notes ? <Text style={styles.comparePlanNotes}>{plan.notes}</Text> : null}</View>
        <View style={styles.comparePerformedColumn}><Text style={[styles.compareColumnKicker, { color: '#38C8F4' }]}>PERFORMED</Text><View style={styles.compareSetHeader}><Text style={[styles.compareTableLabel, styles.compareSetNumber]}>SET</Text><Text style={[styles.compareTableLabel, styles.compareLoad]}>LOAD</Text><Text style={[styles.compareTableLabel, styles.compareReps]}>REPS</Text><Text style={[styles.compareTableLabel, styles.compareEffort]}>EFFORT</Text><Text style={[styles.compareTableLabel, styles.compareTarget]}>COMPARE TO PLAN</Text></View>{row.comparisons.map((comparison) => {
          const performed = comparison.performed;
          const presentation = COMPARISON_PRESENTATION[comparison.kind];
          return <View key={comparison.setIndex} style={styles.compareSetRow}><View style={styles.compareSetNumber}><View style={[styles.compareSetNumberBadge, { borderColor: `${presentation.color}88` }]}><Text style={styles.compareSetNumberText}>{comparison.setIndex}</Text></View></View><Text numberOfLines={1} style={[styles.compareSetValue, styles.compareLoad]}>{performed ? (formatWeightFromKg(performed.actual_weight_kg, unit) || 'Bodyweight') : 'Not logged'}</Text><Text style={[styles.compareSetValue, styles.compareReps, comparison.kind === 'matched' && styles.compareSetMatched]}>{performed?.actual_reps ?? 'Not logged'}</Text><Text numberOfLines={1} style={[styles.compareSetValue, styles.compareEffort]}>{performed ? (effortLabel(performed) || 'Not recorded') : 'Not logged'}</Text><View style={styles.compareTarget}><TargetBand comparison={comparison} /></View></View>;
        })}<View style={styles.targetLegend}><View style={styles.targetLegendBand} /><Text style={styles.targetLegendText}>Target range</Text><View style={styles.targetLegendMarker} /><Text style={styles.targetLegendText}>Your performance</Text></View></View>
      </View>
      <Pressable disabled={!movement || !onOpenHistory} accessibilityRole="button" accessibilityLabel={`Open exact history for ${title}`} onPress={() => movement && onOpenHistory?.(movement, unit)} style={({ pressed }) => [styles.compareLastTime, pressed && styles.pressed]}><Ionicons name="time-outline" size={21} color={SLColors.accentMuted} /><View style={styles.compareLastTimeCopy}><Text style={styles.compareLastTimeLabel}>LAST TIME</Text><Text numberOfLines={2} style={styles.compareLastTimeValue}>{previous && movement ? `${setResultLabel({ actual_weight_kg: previous.weight_kg, actual_reps: previous.reps }, movement, unit)}${previous.rir != null ? ` @ ${numberLabel(previous.rir)} RIR` : previous.rpe != null ? ` @ RPE ${numberLabel(previous.rpe)}` : ''} · ${dateLabel(previous.date)}` : 'No previous exact exposure'}</Text></View>{movement && onOpenHistory ? <Ionicons name="chevron-forward" size={20} color={SLColors.textSecondary} /> : null}</Pressable>
    </View> : null}
  </View>;
}

export function PlanCompareExperience({ recap, performedMovements, unit, onOpenHistory, edgeToEdge = false }: { recap: CompletedSessionRecapPayload; performedMovements: CompletedRecapMovement[]; unit: DisplayWeightUnit; onOpenHistory?: (movement: CompletedRecapMovement, displayUnit: DisplayWeightUnit) => void; edgeToEdge?: boolean }) {
  const rows = useMemo(() => buildSessionRecapComparisons(recap.plan.movements, performedMovements) as PlanComparisonRow[], [performedMovements, recap.plan.movements]);
  const [filter, setFilter] = useState<PlanCompareFilter>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(() => rows[0]?.key || null);
  const filtered = useMemo(() => filterSessionRecapComparisons(rows, filter), [filter, rows]);
  useEffect(() => {
    if (expandedKey && !filtered.some((row) => row.key === expandedKey)) setExpandedKey(filtered[0]?.key || null);
  }, [expandedKey, filtered]);
  return <>
    <View style={[styles.sectionShell, edgeToEdge && styles.edgeToEdge]}><ExecutionSummary rows={rows} /></View>
    <ComparisonFilterBar edgeToEdge={edgeToEdge} filter={filter} rows={rows} onChange={setFilter} />
    <View style={[styles.compareMovementStack, edgeToEdge && styles.edgeToEdge]}>{filtered.map((row) => <PlanComparisonCard key={row.key} row={row} expanded={expandedKey === row.key} unit={unit} onToggle={() => setExpandedKey((current) => current === row.key ? null : row.key)} onOpenHistory={onOpenHistory} />)}{!filtered.length ? <View style={[styles.emptyCard, edgeToEdge && styles.edgeToEdge]}><Ionicons name="filter-outline" size={25} color={SLColors.textMuted} /><Text style={styles.emptyTitle}>No movements in this filter</Text><Text style={styles.emptyBody}>The selected comparison state does not occur in this Session.</Text></View> : null}</View>
    {recap.plan.programming_notes ? <View style={[styles.sectionShell, edgeToEdge && styles.edgeToEdge]}><View style={styles.detailCard}><Text style={styles.detailKicker}>PROGRAMMING NOTES</Text><Text style={styles.quote}>{recap.plan.programming_notes}</Text></View></View> : null}
    <View style={[styles.comparisonLegend, edgeToEdge && styles.edgeToEdge]}>{(['matched', 'above_target', 'below_target', 'different_load', 'not_logged'] as SessionRecapComparisonKind[]).map((kind) => <View key={kind} style={styles.comparisonLegendItem}><Ionicons name={COMPARISON_PRESENTATION[kind].icon} size={15} color={COMPARISON_PRESENTATION[kind].color} /><Text style={styles.comparisonLegendText}>{COMPARISON_PRESENTATION[kind].label}</Text></View>)}</View>
  </>;
}

function ReviewChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.reviewChoice, selected && styles.reviewChoiceSelected, pressed && styles.pressed]}><Text style={[styles.reviewChoiceText, selected && styles.reviewChoiceTextSelected]}>{label}</Text></Pressable>;
}

function ReviewToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return <View style={styles.reviewToggle}><Text style={styles.reviewToggleText}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: SLColors.borderStandard, true: SLColors.accentSoft }} thumbColor={value ? SLColors.accentViolet : SLColors.textMuted} /></View>;
}

export function CoachTools({ review }: { review: CoachReviewContext }) {
  const draft = review.draft;
  const update = <K extends keyof CoachReviewDraft>(key: K, value: CoachReviewDraft[K]) => review.onDraftChange({ ...draft, [key]: value });
  return <View style={styles.sectionShell}><Text style={styles.sectionLabel}>COACH REVIEW TOOLS</Text><View style={styles.coachToolsCard}><Text style={styles.fieldLabel}>ATHLETE FEEDBACK</Text><TextInput multiline value={draft.coach_feedback} onChangeText={(value) => update('coach_feedback', value)} placeholder="Write actionable feedback…" placeholderTextColor={SLColors.textMuted} style={styles.textarea} /><Text style={styles.fieldLabel}>PRIVATE COACH NOTE</Text><TextInput multiline value={draft.coach_note} onChangeText={(value) => update('coach_note', value)} placeholder="Private programming context…" placeholderTextColor={SLColors.textMuted} style={styles.textarea} />{review.outcomes?.length ? <><Text style={styles.fieldLabel}>OUTCOME</Text><View style={styles.reviewChoices}>{review.outcomes.map((row) => <ReviewChoice key={row.value} label={row.label} selected={draft.review_outcome === row.value} onPress={() => update('review_outcome', draft.review_outcome === row.value ? '' : row.value)} />)}</View></> : null}{review.priorities?.length ? <><Text style={styles.fieldLabel}>PRIORITY</Text><View style={styles.reviewChoices}>{review.priorities.map((row) => <ReviewChoice key={row.value} label={row.label} selected={draft.review_priority === row.value} onPress={() => update('review_priority', draft.review_priority === row.value ? '' : row.value)} />)}</View></> : null}<View style={styles.followupGroup}><ReviewToggle label="Adjust programming" value={draft.followup_adjust_programming} onChange={(value) => update('followup_adjust_programming', value)} /><ReviewToggle label="Message athlete" value={draft.followup_message_athlete} onChange={(value) => update('followup_message_athlete', value)} /><ReviewToggle label="Consider training max update" value={draft.followup_consider_tm} onChange={(value) => update('followup_consider_tm', value)} /><ReviewToggle label="Monitor next Session" value={draft.followup_monitor_next} onChange={(value) => update('followup_monitor_next', value)} /><ReviewToggle label="Send feedback as message" value={draft.send_feedback_message} onChange={(value) => update('send_feedback_message', value)} /></View><View style={styles.reviewActions}><Pressable disabled={!!review.saving} onPress={() => review.onSave(draft, 'save')} style={({ pressed }) => [styles.reviewSecondary, pressed && styles.pressed]}>{review.saving === 'save' ? <ActivityIndicator color={SLColors.accentMuted} /> : <Text style={styles.reviewSecondaryText}>Save Draft</Text>}</Pressable><Pressable disabled={!!review.saving} onPress={() => review.onSave(draft, 'complete')} style={({ pressed }) => [styles.reviewPrimary, pressed && styles.pressed]}>{review.saving === 'complete' ? <ActivityIndicator color={SLColors.white} /> : <><Ionicons name="checkmark" size={20} color={SLColors.white} /><Text style={styles.reviewPrimaryText}>Complete Review</Text></>}</Pressable></View></View></View>;
}

function ActionButton({ icon, label, primary, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; primary?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, primary && styles.actionButtonPrimary, pressed && styles.pressed]}><Ionicons name={icon} size={18} color={primary ? SLColors.white : SLColors.textSecondary} /><Text style={[styles.actionButtonText, primary && styles.actionButtonTextPrimary]}>{label}</Text></Pressable>;
}

type ReviewerMetric = {
  value?: number | null;
  baseline?: number | null;
  delta?: number | null;
  sample_size?: number;
};

type ReviewerAnalytics = {
  schema_version?: string;
  comparator?: { workout_id?: number; label?: string; date?: string; matched_movement_count?: number } | null;
  session_read?: {
    performance?: { state?: string; label?: string; counts?: Record<string, number>; comparable_count?: number };
    execution?: { logged_sets?: number; planned_sets?: number | null; completion_percent?: number | null };
    recovery?: { state?: string; label?: string };
    reflection?: { state?: string; label?: string };
    synthesis?: string;
  };
  what_changed?: {
    movement_outcomes?: Record<string, number>;
    volume?: { current_kg?: number; previous_kg?: number | null; delta_percent?: number | null };
    normalized_volume_per_set?: { current_kg?: number | null; previous_kg?: number | null; delta_percent?: number | null };
    logged_sets?: { current?: number; previous?: number | null; delta?: number | null };
    average_effort_rpe_equivalent?: { current?: number | null; previous?: number | null; delta?: number | null };
    pr_count?: number;
    session_rpe?: { current?: number | null; previous?: number | null; delta?: number | null };
  };
  duration?: {
    current_seconds?: number | null;
    baseline_seconds?: number | null;
    delta_seconds?: number | null;
    delta_percent?: number | null;
    sample_size?: number;
    comparison_label?: string | null;
  };
  movements?: ReviewerMovementEvidence[];
  recovery?: {
    state?: string;
    label?: string;
    summary?: string;
    sample_size?: number;
    metrics?: Record<string, ReviewerMetric>;
    trend?: Record<string, any>[];
  };
  reflection?: {
    state?: string;
    label?: string;
    sample_size?: number;
    session_rpe?: ReviewerMetric;
    fatigue?: { value?: string | null; higher_than_prior_count?: number; prior_count?: number };
    strength?: string | null;
    note?: string;
  };
  coach_read?: {
    performance?: string;
    recovery?: string;
    reflection?: string;
    execution?: string;
    takeaways?: string[];
    attention?: { kind?: string; label?: string; item_id?: number }[];
  };
};

type RecoveryMetricKey = 'readiness' | 'sleep' | 'stress' | 'energy' | 'soreness';

const RECOVERY_PRESENTATION: Record<RecoveryMetricKey, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name']; suffix: string; maximum: number }> = {
  readiness: { label: 'Readiness', color: '#38D381', icon: 'pulse-outline', suffix: ' / 10', maximum: 10 },
  sleep: { label: 'Sleep', color: '#5AAEFF', icon: 'moon-outline', suffix: ' h', maximum: 12 },
  stress: { label: 'Stress', color: '#FF9A42', icon: 'flame-outline', suffix: ' / 10', maximum: 10 },
  energy: { label: 'Energy', color: '#E05BD8', icon: 'flash-outline', suffix: ' / 10', maximum: 10 },
  soreness: { label: 'Soreness', color: '#F3AC33', icon: 'body-outline', suffix: ' / 10', maximum: 10 },
};

function humanize(value?: string | null) {
  const text = String(value || '').trim().replaceAll('_', ' ');
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not reported';
}

function signed(value: number | null | undefined, suffix = '', digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const numeric = Number(value);
  if (Math.abs(numeric) < 0.05) return `No material change${suffix}`;
  return `${numeric > 0 ? '+' : '−'}${Math.abs(numeric).toFixed(digits).replace(/\.0$/, '')}${suffix}`;
}

function fallbackReviewerAnalytics(recap: CompletedSessionRecapPayload): ReviewerAnalytics {
  const states = recap.performed_movements.map((movement) => {
    const delta = Number(movement.trend?.delta_value ?? movement.trend?.delta_kg);
    if (!Number.isFinite(delta) || (movement.trend?.points?.length || 0) < 2) return 'not_comparable';
    if (Math.abs(delta) < 0.01) return 'stable';
    return delta > 0 ? 'improved' : 'declined';
  });
  const counts = states.reduce<Record<string, number>>((result, state) => ({ ...result, [state]: (result[state] || 0) + 1 }), {});
  const comparable = (counts.improved || 0) + (counts.stable || 0) + (counts.declined || 0);
  const planned = Number(recap.highlights?.prescribed_set_count || 0) || null;
  const recovery = recap.readiness_context || {};
  const currentVolume = Number(recap.session.total_volume_kg || 0);
  const previousVolume = recap.session.volume_trend?.points?.filter((row) => !row.current).at(-1)?.volume_kg;
  const reflectionAvailable = recap.reflection.session_rpe != null || !!recap.reflection.strength || !!recap.reflection.fatigue || !!recap.reflection.note;
  const strongest = recap.performed_movements.find((movement) => Number(movement.trend?.delta_value ?? movement.trend?.delta_kg) > 0);
  const synthesis = comparable
    ? `${counts.improved || 0} of ${comparable} comparable movements improved${strongest ? `, led by ${strongest.label}` : ''}. ${recap.session.set_count} persisted sets define this completed Session.`
    : `This Session contains ${recap.session.set_count} persisted sets. Exact progression will become more specific as comparable performed identities accumulate.`;
  const movements = recap.performed_movements.map((movement) => {
    const points = movement.trend?.points || [];
    const previous = [...points].reverse().find((point) => !point.current) || null;
    const delta = Number(movement.trend?.delta_value ?? movement.trend?.delta_kg);
    const state = !previous || !Number.isFinite(delta) ? 'not_comparable' : Math.abs(delta) < 0.01 ? 'stable' : delta > 0 ? 'improved' : 'declined';
    return {
      item_id: movement.item_id,
      previous_best: previous,
      comparison: {
        state,
        literal: previous
          ? state === 'stable' ? 'Governed best-set performance remained within normal variance.' : `Governed best-set performance ${delta > 0 ? 'improved' : 'declined'} from the prior exact exposure.`
          : 'No reliable prior exact comparison.',
      },
      confidence: { state: previous ? 'limited' : 'unavailable', label: previous ? 'Exact comparison available' : 'No reliable comparison', sample_size: points.length, scope: movement.measurement?.comparison_scope },
    } satisfies ReviewerMovementEvidence;
  });
  return {
    session_read: {
      performance: { state: comparable ? 'mixed' : 'insufficient_evidence', label: comparable ? 'Mixed' : 'Building history', counts, comparable_count: comparable },
      execution: { logged_sets: recap.session.set_count, planned_sets: planned, completion_percent: recap.highlights?.prescription_completion_percent },
      recovery: { state: recap.readiness_context ? 'recorded' : 'unavailable', label: recap.readiness_context ? 'Recorded' : 'Not submitted' },
      reflection: { state: reflectionAvailable ? 'recorded' : 'unavailable', label: reflectionAvailable ? 'Recorded' : 'Not submitted' },
      synthesis,
    },
    what_changed: {
      movement_outcomes: counts,
      volume: { current_kg: currentVolume, previous_kg: previousVolume, delta_percent: previousVolume ? ((currentVolume - previousVolume) / previousVolume) * 100 : null },
      logged_sets: { current: recap.session.set_count, previous: null, delta: null },
      pr_count: recap.highlights?.pr_count || 0,
      session_rpe: { current: recap.reflection.session_rpe, previous: null, delta: null },
    },
    duration: { current_seconds: recap.session.duration_seconds, baseline_seconds: null, sample_size: 0 },
    movements,
    recovery: {
      state: recap.readiness_context ? 'recorded' : 'insufficient_history',
      label: recap.readiness_context ? 'Session context recorded' : 'Readiness not submitted',
      summary: recap.readiness_context ? 'Current readiness values are shown without implying causation. A recent baseline will appear when enough prior observations are available.' : 'The athlete did not submit pre-Session readiness context. Future check-ins can establish a reliable comparison.',
      sample_size: 0,
      metrics: {
        readiness: { value: recovery.readiness_score }, sleep: { value: recovery.sleep_hours ?? recovery.sleep_quality }, stress: { value: recovery.stress }, energy: { value: recovery.energy }, soreness: { value: recovery.soreness },
      },
      trend: [],
    },
    reflection: {
      state: reflectionAvailable ? 'recorded' : 'unavailable', label: reflectionAvailable ? 'Athlete reflection recorded' : 'Reflection not submitted', sample_size: 0,
      session_rpe: { value: recap.reflection.session_rpe }, strength: recap.reflection.strength, fatigue: { value: recap.reflection.fatigue, prior_count: 0 }, note: recap.reflection.note || undefined,
    },
    coach_read: {
      performance: comparable ? `${counts.improved || 0} improved · ${counts.stable || 0} stable · ${counts.declined || 0} declined` : 'Exact comparison is still building',
      recovery: recap.readiness_context ? 'Current context recorded' : 'Readiness not submitted',
      reflection: reflectionAvailable ? 'Athlete reflection recorded' : 'Reflection not submitted',
      execution: planned ? `${recap.session.set_count} / ${planned} sets` : `${recap.session.set_count} logged sets`,
      attention: [],
    },
  };
}

function PostSessionSection({ title, meta, children }: { title: string; meta?: string | null; children: React.ReactNode }) {
  return <View style={styles.canonicalSection}><View style={styles.canonicalSectionHeading}><Text style={styles.canonicalSectionTitle}>{title}</Text>{meta ? <Text numberOfLines={2} style={styles.canonicalSectionMeta}>{meta}</Text> : null}</View>{children}</View>;
}

function PostSessionMetricTile({ icon, label, value, detail, tone = '#B46CFF' }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; detail?: string | null; tone?: string }) {
  return <View style={styles.canonicalMetricTile}><View style={[styles.canonicalMetricIcon, { backgroundColor: `${tone}18` }]}><Ionicons name={icon} color={tone} size={17} /></View><View style={styles.canonicalMetricCopy}><Text style={styles.canonicalMetricLabel}>{label}</Text><Text style={[styles.canonicalMetricValue, { color: tone }]}>{value}</Text>{detail ? <Text style={styles.canonicalMetricDetail}>{detail}</Text> : null}</View></View>;
}

function formatDurationComparison(analytics: ReviewerAnalytics, recap: CompletedSessionRecapPayload) {
  const duration = analytics.duration || {};
  const current = duration.current_seconds ?? recap.session.duration_seconds;
  if (current == null) return { value: 'Not recorded', detail: 'Start and end times missing' };
  const baseline = duration.baseline_seconds;
  const deltaSeconds = duration.delta_seconds ?? (baseline == null ? null : Number(current) - Number(baseline));
  if (baseline == null || deltaSeconds == null) return { value: durationLabel(current) || 'Duration recorded', detail: 'First comparable Session' };
  const deltaMinutes = Math.max(1, Math.round(Math.abs(deltaSeconds) / 60));
  const direction = deltaSeconds < 0 ? 'faster' : deltaSeconds > 0 ? 'slower' : 'in line';
  return {
    value: durationLabel(current) || 'Duration recorded',
    detail: direction === 'in line' ? 'In line with recent Sessions' : `${deltaMinutes} min ${direction} vs recent`,
  };
}

function SessionReadOverview({ analytics, recap }: { analytics: ReviewerAnalytics; recap: CompletedSessionRecapPayload }) {
  const read = analytics.session_read || {};
  const performance = read.performance || {};
  const counts = performance.counts || {};
  const execution = read.execution || {};
  const duration = formatDurationComparison(analytics, recap);
  const executionValue = execution.planned_sets
    ? `${execution.logged_sets ?? recap.session.set_count} / ${execution.planned_sets}`
    : `${execution.logged_sets ?? recap.session.set_count} logged`;
  return <>
    <PostSessionSection title="SESSION READ" meta={analytics.comparator ? `vs ${analytics.comparator.label || 'comparable Session'} · ${dateLabel(analytics.comparator.date)}` : 'Point-in-time evidence'}>
      <View style={styles.sessionReadCard}><LinearGradient colors={['rgba(119,62,177,0.18)', '#07090E']} style={StyleSheet.absoluteFillObject} /><View style={styles.canonicalMetricGrid}>
        <PostSessionMetricTile icon="trending-up-outline" label="Performance" value={`${counts.improved || 0} improved · ${counts.stable || 0} stable · ${counts.declined || 0} declined`} detail={performance.comparable_count ? `${performance.comparable_count} exact comparisons` : 'History building'} tone={counts.declined ? '#62B7FF' : '#38D381'} />
        <PostSessionMetricTile icon="clipboard-outline" label="Execution" value={executionValue} detail={execution.planned_sets ? `${Math.max(0, Number(execution.planned_sets) - Number(execution.logged_sets ?? recap.session.set_count))} missed · ${Math.max(0, Number(execution.logged_sets ?? recap.session.set_count) - Number(execution.planned_sets))} unplanned · ${numberLabel(execution.completion_percent)}%` : 'Persisted SetLogs'} tone="#B46CFF" />
        <PostSessionMetricTile icon="pulse-outline" label="Recovery" value={read.recovery?.label || 'Context unavailable'} detail={read.recovery?.state ? 'Compared with recent readiness' : 'Baseline building'} tone={read.recovery?.state === 'below_baseline' ? '#FF9A42' : '#38D381'} />
        <PostSessionMetricTile icon="chatbubble-ellipses-outline" label="Reflection" value={read.reflection?.label || 'Not submitted'} detail="Athlete-reported context" tone="#E05BD8" />
      </View><View style={styles.durationRead}><View style={styles.durationReadIcon}><Ionicons name="time-outline" size={19} color="#53CBE8" /></View><View style={styles.durationReadCopy}><Text style={styles.durationReadValue}>{duration.value}</Text><Text style={styles.durationReadDetail}>{duration.detail}</Text></View></View><Text style={styles.sessionNarrative}>{read.synthesis || fallbackReviewerAnalytics(recap).session_read?.synthesis}</Text></View>
    </PostSessionSection>
  </>;
}

function WhatChangedOverview({ analytics, recap, unit }: { analytics: ReviewerAnalytics; recap: CompletedSessionRecapPayload; unit: DisplayWeightUnit }) {
  const changed = analytics.what_changed || {};
  const volume = changed.volume || {};
  const normalized = changed.normalized_volume_per_set || {};
  const sets = changed.logged_sets || {};
  const effort = changed.average_effort_rpe_equivalent || {};
  const sessionRpe = changed.session_rpe || { current: recap.reflection.session_rpe };
  const duration = formatDurationComparison(analytics, recap);
  const currentVolume = formatCompactVolumeValueFromKg(volume.current_kg ?? recap.session.total_volume_kg, unit) || 'Volume not recorded';
  const previousVolume = formatCompactVolumeValueFromKg(volume.previous_kg, unit);
  const currentPerSet = normalized.current_kg ?? ((volume.current_kg ?? recap.session.total_volume_kg) / Math.max(1, recap.session.set_count));
  const rows = [
    { label: 'Movement outcomes', value: `${changed.movement_outcomes?.improved || 0} improved · ${changed.movement_outcomes?.stable || 0} stable · ${changed.movement_outcomes?.declined || 0} declined` },
    { label: 'Total volume', value: previousVolume ? `${currentVolume} vs ${previousVolume}${signed(volume.delta_percent, '%') ? ` · ${signed(volume.delta_percent, '%')}` : ''}` : `${currentVolume} · Baseline building` },
    { label: 'Normalized volume / set', value: normalized.previous_kg != null ? `${formatWeightFromKg(currentPerSet, unit)} vs ${formatWeightFromKg(normalized.previous_kg, unit)}${signed(normalized.delta_percent, '%') ? ` · ${signed(normalized.delta_percent, '%')}` : ''}` : `${formatWeightFromKg(currentPerSet, unit) || 'Not recorded'} · Baseline building` },
    { label: 'Logged sets', value: sets.previous != null ? `${sets.current ?? recap.session.set_count} vs ${sets.previous}${sets.delta != null ? ` · ${sets.delta > 0 ? '+' : ''}${sets.delta}` : ''}` : `${sets.current ?? recap.session.set_count} this Session · Baseline building` },
    { label: 'Average effort', value: effort.previous != null ? `${numberLabel(effort.current)} vs ${numberLabel(effort.previous)} RPE-equivalent${signed(effort.delta) ? ` · ${signed(effort.delta)}` : ''}` : effort.current != null ? `${numberLabel(effort.current)} RPE-equivalent · Baseline building` : 'Not enough SetLog effort evidence' },
    { label: 'Session RPE', value: sessionRpe.current != null ? sessionRpe.previous != null ? `${numberLabel(sessionRpe.current)} vs ${numberLabel(sessionRpe.previous)}${signed(sessionRpe.delta) ? ` · ${signed(sessionRpe.delta)}` : ''}` : `${numberLabel(sessionRpe.current)} / 10 · Baseline building` : 'Not recorded' },
    { label: 'Session duration', value: `${duration.value} · ${duration.detail}` },
    { label: 'Recovery context', value: analytics.recovery?.summary || 'A reliable recovery baseline is not available yet.' },
    { label: 'PR evidence', value: `${changed.pr_count ?? recap.highlights?.pr_count ?? 0} verified record${Number(changed.pr_count ?? recap.highlights?.pr_count ?? 0) === 1 ? '' : 's'} in this Session` },
  ];
  return <PostSessionSection title="WHAT CHANGED SINCE LAST COMPARABLE SESSION"><View style={styles.changedCard}>{rows.map((row) => <View key={row.label} style={styles.changedRow}><Text style={styles.changedLabel}>{row.label}</Text><Text style={styles.changedValue}>{row.value}</Text></View>)}</View></PostSessionSection>;
}

function RecoveryOverview({ analytics, recap }: { analytics: ReviewerAnalytics; recap: CompletedSessionRecapPayload }) {
  const recovery = analytics.recovery || {};
  const metrics = recovery.metrics || {};
  const fallback = recap.readiness_context || {};
  const hydrated: Record<RecoveryMetricKey, ReviewerMetric> = {
    readiness: metrics.readiness || { value: fallback.readiness_score },
    sleep: metrics.sleep || { value: fallback.sleep_hours ?? fallback.sleep_quality },
    stress: metrics.stress || { value: fallback.stress },
    energy: metrics.energy || { value: fallback.energy },
    soreness: metrics.soreness || { value: fallback.soreness },
  };
  const available = (Object.keys(RECOVERY_PRESENTATION) as RecoveryMetricKey[]).filter((key) => hydrated[key].value != null || (recovery.trend || []).some((row) => row[key] != null));
  const [selected, setSelected] = useState<RecoveryMetricKey>(available[0] || 'readiness');
  useEffect(() => {
    if (!available.includes(selected) && available[0]) setSelected(available[0]);
  }, [available, selected]);
  const presentation = RECOVERY_PRESENTATION[selected];
  const selectedMetric = hydrated[selected];
  const points = (recovery.trend || []).flatMap((row, index) => {
    const value = Number(row[selected]);
    return Number.isFinite(value) ? [{ id: `${row.date || 'observation'}:${index}`, date: String(row.date || ''), value, meta: row }] : [];
  });
  const band = selectedMetric.baseline != null && points.length ? points.map((point) => ({ date: point.date, low: Number(selectedMetric.baseline) - 0.04, high: Number(selectedMetric.baseline) + 0.04 })) : [];
  const recoveryDeltas = available.flatMap((key) => {
    const item = hydrated[key];
    const row = RECOVERY_PRESENTATION[key];
    const delta = signed(item.delta, row.suffix.trim());
    return delta && !delta.startsWith('No material') ? [`${row.label} ${delta}`] : [];
  });
  const observationLabel = points.length ? `${points.length} ${presentation.label.toLowerCase()} observation${points.length === 1 ? '' : 's'}` : 'Current Session context';
  return <PostSessionSection title="CONTEXT & RECOVERY" meta={observationLabel}><View style={styles.recoveryCard}><Text style={styles.recoveryReadLabel}>{recovery.label || 'Recovery read'}</Text><Text style={styles.recoverySummary}>{recoveryDeltas.slice(0, 3).join(' · ') || (recovery.summary ? recovery.summary.split('.')[0] : 'Baseline building')}</Text>{available.length ? <><View style={styles.canonicalMetricGrid}>{available.map((key) => {
    const item = hydrated[key];
    const row = RECOVERY_PRESENTATION[key];
    return <PostSessionMetricTile key={key} icon={row.icon} label={row.label} value={item.value == null ? 'Not recorded' : `${numberLabel(item.value)}${row.suffix}`} detail={item.baseline == null ? 'Baseline building' : `${signed(item.delta, row.suffix.trim()) || 'In line'} vs ${numberLabel(item.baseline)}${row.suffix} recent`} tone={row.color} />;
  })}</View><View style={styles.recoverySelector}>{available.map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: selected === key }} onPress={() => setSelected(key)} style={({ pressed }) => [styles.recoverySelectorButton, selected === key && styles.recoverySelectorButtonActive, pressed && styles.pressed]}><Text style={[styles.recoverySelectorText, selected === key && styles.recoverySelectorTextActive]}>{RECOVERY_PRESENTATION[key].label}</Text></Pressable>)}</View><AnalyticalTimeSeriesChart band={band} bandLabel={band.length ? 'Recent baseline' : undefined} emptyTitle={`${presentation.label} history is still building`} emptyBody={`The current ${presentation.label.toLowerCase()} value is shown above. Another dated observation will establish a trend.`} formatSeriesValue={(_key, value) => `${numberLabel(value)}${presentation.suffix}`} height={228} metric={analyticalMetricDefinition(`post_session_${selected}`, { label: presentation.label, kind: selected === 'sleep' ? 'hours' : 'score', unit: selected === 'sleep' ? 'h' : '/10', axisUnit: selected === 'sleep' ? 'h' : undefined, minimum: 0, maximum: presentation.maximum, maximumFractionDigits: 1 })} readableText series={[{ key: selected, label: presentation.label, color: presentation.color, points }]} showLegend={false} testID="canonical-post-session-recovery-chart" tooltipRows={(selection) => [(selection.values[0]?.meta as any)?.current ? 'This Session' : 'Prior readiness observation', selectedMetric.baseline != null ? `Recent baseline ${numberLabel(selectedMetric.baseline)}${presentation.suffix}` : 'Baseline not yet established']} /></> : <View style={styles.premiumEmpty}><Ionicons name="moon-outline" size={25} color={SLColors.textMuted} /><View style={styles.premiumEmptyCopy}><Text style={styles.premiumEmptyTitle}>Readiness context was not submitted</Text><Text style={styles.premiumEmptyBody}>Sleep, stress, energy, soreness, and readiness comparisons will become available after future pre-Session check-ins.</Text></View></View>}</View></PostSessionSection>;
}

function ReflectionOverview({ analytics, recap }: { analytics: ReviewerAnalytics; recap: CompletedSessionRecapPayload }) {
  const reflection = analytics.reflection || {};
  const rpe = reflection.session_rpe || { value: recap.reflection.session_rpe };
  const strength = reflection.strength ?? recap.reflection.strength;
  const fatigue = reflection.fatigue || { value: recap.reflection.fatigue };
  const note = reflection.note || recap.reflection.note;
  const hasReflection = rpe.value != null || !!strength || !!fatigue.value || !!note;
  return <PostSessionSection title="ATHLETE REFLECTION" meta={reflection.label || (hasReflection ? 'Athlete-reported context' : 'Not submitted')}><View style={styles.recoveryCard}>{hasReflection ? <><View style={styles.reflectionMetricRail}><PostSessionMetricTile icon="speedometer-outline" label="Session RPE" value={rpe.value == null ? 'Not recorded' : `${numberLabel(rpe.value)} / 10`} detail={rpe.baseline == null ? 'A comparable effort baseline is not available yet.' : `${numberLabel(rpe.baseline)} recent average${signed(rpe.delta) ? ` · ${signed(rpe.delta)}` : ''}`} tone="#F3AC33" /><PostSessionMetricTile icon="body-outline" label="Session Feel" value={humanize(strength)} detail={strength ? 'Athlete-reported Session feel.' : 'No Session feel was submitted.'} tone="#38D381" /><PostSessionMetricTile icon="battery-half-outline" label="Fatigue" value={humanize(fatigue.value)} detail={fatigue.prior_count ? `Higher than ${fatigue.higher_than_prior_count || 0} of the prior ${fatigue.prior_count} comparable reflections.` : 'A fatigue ranking will appear as comparable reflections accumulate.'} tone="#E05BD8" /></View>{note ? <View style={styles.athleteReflectionNote}><Ionicons name="chatbox-ellipses-outline" color="#E05BD8" size={19} /><Text style={styles.athleteReflectionNoteText}>{note}</Text></View> : null}</> : <View style={styles.premiumEmpty}><Ionicons name="chatbubble-ellipses-outline" size={25} color={SLColors.textMuted} /><View style={styles.premiumEmptyCopy}><Text style={styles.premiumEmptyTitle}>Athlete reflection was not submitted</Text><Text style={styles.premiumEmptyBody}>Session RPE, feel, fatigue, and comments can be added during the post-Session check-in on a future completion.</Text></View></View>}</View></PostSessionSection>;
}

function CoachReadOverview({ analytics }: { analytics: ReviewerAnalytics }) {
  const read = analytics.coach_read || {};
  const attention = read.attention || [];
  const rows = [
    ['Performance', read.performance || 'Exact comparison is still building', '#38D381', 'trending-up-outline'],
    ['Recovery', read.recovery || 'Readiness context unavailable', '#FF9A42', 'bed-outline'],
    ['Reflection', read.reflection || 'Athlete reflection unavailable', '#E05BD8', 'chatbox-outline'],
    ['Execution', read.execution || 'Execution summary unavailable', '#B46CFF', 'clipboard-outline'],
  ] as const;
  return <><PostSessionSection title="COACH READ"><View style={styles.coachReadCard}>{rows.map(([label, value, color, icon]) => <View key={label} style={styles.coachReadRow}><Ionicons name={icon} color={color} size={18} /><Text style={styles.coachReadLabel}>{label}</Text><Text style={[styles.coachReadValue, { color }]}>{value}</Text></View>)}</View></PostSessionSection><PostSessionSection title="COACH ATTENTION" meta="Actionable evidence only"><View style={styles.coachAttentionCard}>{attention.length ? attention.map((row, index) => <View key={`${row.kind || 'attention'}-${index}`} style={styles.coachAttentionRow}><View style={styles.coachAttentionIcon}><Ionicons name="alert-circle-outline" size={17} color="#FF6A55" /></View><Text style={styles.coachAttentionText}>{row.label}</Text></View>) : <View style={styles.premiumEmpty}><Ionicons name="checkmark-circle-outline" size={25} color={SLColors.success} /><View style={styles.premiumEmptyCopy}><Text style={styles.premiumEmptyTitle}>No material coaching exception detected</Text><Text style={styles.premiumEmptyBody}>The evidence does not currently require an attention item. Review the shared Session truth before choosing an outcome.</Text></View></View>}</View></PostSessionSection></>;
}

function CompactHighlight({ kind, label, value, detail, tone }: { kind: SessionRecapHighlightKind; label: string; value: string; detail: string; tone: string }) {
  return <View style={styles.compactHighlight}><Image accessibilityIgnoresInvertColors resizeMode="contain" source={sessionRecapHighlightAsset(kind)} style={styles.compactHighlightArt} /><View style={styles.compactHighlightCopy}><Text style={[styles.compactHighlightLabel, { color: tone }]}>{label}</Text><Text style={styles.compactHighlightValue}>{value}</Text><Text numberOfLines={2} style={styles.compactHighlightDetail}>{detail}</Text></View></View>;
}

function PersonalBestsExperience({ evidence, unit }: { evidence: CanonicalPrEvidence[]; unit: DisplayWeightUnit }) {
  return <>
    <View style={styles.personalBestHero}>
      <LinearGradient colors={['rgba(91,50,8,0.12)', 'rgba(91,43,139,0.24)', '#050609']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <Image accessibilityIgnoresInvertColors resizeMode="contain" source={SESSION_PR_CREST_ART} style={styles.personalBestHeroArt} />
      <View style={styles.personalBestHeroCopy}><Text style={styles.personalBestHeroKicker}>VERIFIED SESSION EVIDENCE</Text><Text style={styles.personalBestHeroValue}>{evidence.length}</Text><Text style={styles.personalBestHeroTitle}>new personal best{evidence.length === 1 ? '' : 's'}</Text><Text style={styles.personalBestHeroDetail}>Persisted records from exact governed movement evidence.</Text></View>
    </View>
    <PostSessionSection title="PERSONAL BESTS" meta={`${evidence.length} verified record${evidence.length === 1 ? '' : 's'}`}>
      <View style={styles.personalBestStack}>{evidence.map((row, index) => {
        const presentation = prEvidencePresentation(row, unit);
        const equipment = row.movement?.equipment?.[0];
        const progression = row.record.progression;
        const progressionPointCount = progression?.points?.length || 0;
        const firstRecordCopy = firstRecordChartCopy(row);
        return <View key={row.event.id || `${row.event.event_type}-${index}`} style={styles.personalBestCard}>
          <LinearGradient colors={['rgba(126,72,13,0.11)', 'rgba(78,31,117,0.11)', '#07090E']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          <View style={styles.personalBestHeader}>
            <View style={styles.personalBestArtwork}>{row.movement ? <MovementArtwork movement={row.movement} /> : <Image accessibilityIgnoresInvertColors resizeMode="contain" source={SESSION_PR_CREST_ART} style={styles.personalBestFallbackArt} />}</View>
            <View style={styles.personalBestIdentity}><Text numberOfLines={2} style={styles.personalBestMovement}>{row.movement?.label || row.event.movement_label || 'Verified movement'}</Text><Text style={styles.personalBestType}>{presentation.classification}</Text>{equipment ? <Text numberOfLines={1} style={styles.personalBestEquipment}>{equipment.manufacturer || equipment.label} · {equipmentSecondaryLabel(equipment)}</Text> : null}</View>
            <Image accessibilityIgnoresInvertColors resizeMode="contain" source={SESSION_PR_CREST_ART} style={styles.personalBestMiniCrest} />
          </View>
          <View style={styles.personalBestResult}><Text style={styles.personalBestResultLabel}>THIS SESSION</Text><Text style={styles.personalBestResultValue}>{presentation.currentLabel}</Text>{presentation.derivedFromLabel ? <Text style={styles.personalBestDerivedFrom}>{presentation.derivedFromLabel}</Text> : null}</View>
          <View style={styles.personalBestPriorRail}><View style={styles.personalBestPriorCopy}><Text style={styles.personalBestPriorLabel}>PREVIOUS</Text><Text style={styles.personalBestPriorValue}>{presentation.priorLabel}</Text>{presentation.previousDate ? <Text style={styles.personalBestPriorDate}>{dateLabel(presentation.previousDate)}</Text> : null}</View><Text style={styles.personalBestDelta}>{presentation.deltaLabel}</Text></View>
          {progression && progressionPointCount >= 2 ? <View style={styles.personalBestTrend}><Text style={styles.personalBestTrendLabel}>{String(progression.metric_label || 'RECORD PROGRESSION').toUpperCase()}</Text><MovementTrendChart compact card trend={{ ...progression, state: progressionPointCount >= 3 ? 'trend' : 'limited_history', points: progression.points || [] }} unit={unit} color="#D786FF" /></View> : <View style={styles.personalBestFirstInstance}><Ionicons name="sparkles-outline" size={19} color="#D7A245" /><View style={styles.personalBestFirstInstanceCopy}><Text style={styles.personalBestFirstInstanceTitle}>{firstRecordCopy.title}</Text><Text style={styles.personalBestFirstInstanceBody}>{firstRecordCopy.body}</Text></View></View>}
        </View>;
      })}</View>
    </PostSessionSection>
  </>;
}

function PostSessionToolsSheet({ visible, movements, onClose, onResumeSession, onCorrectEquipment, onEditSetEvidence, onEditSessionNotes, onOpenMovementHistory, onViewSessionHistory }: { visible: boolean; movements: CompletedRecapMovement[]; onClose: () => void; onResumeSession?: () => void; onCorrectEquipment?: (movement: CompletedRecapMovement) => void; onEditSetEvidence?: () => void; onEditSessionNotes?: () => void; onOpenMovementHistory?: (movement: CompletedRecapMovement) => void; onViewSessionHistory?: () => void }) {
  const equipmentMovements = movements.filter((movement) => movement.kind === 'accessory' && movement.equipment?.length);
  const run = (action?: () => void) => { onClose(); requestAnimationFrame(() => action?.()); };
  return <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}><View style={styles.toolsBackdrop}><TouchableWithoutFeedback onPress={onClose}><View style={StyleSheet.absoluteFillObject} /></TouchableWithoutFeedback><View style={styles.toolsSheet}><View style={styles.toolsHandle} /><View style={styles.toolsHeader}><Text style={styles.toolsTitle}>Post-Session Tools</Text><Pressable accessibilityRole="button" accessibilityLabel="Close post-Session tools" onPress={onClose} style={({ pressed }) => [styles.toolsClose, pressed && styles.pressed]}><Ionicons name="close" size={21} color={SLColors.textPrimary} /></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.toolsContent}>{onResumeSession ? <Pressable accessibilityRole="button" onPress={() => run(onResumeSession)} style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}><View style={styles.toolIcon}><Ionicons name="play-circle-outline" size={19} color="#A96CFF" /></View><View style={styles.toolCopy}><Text style={styles.toolLabel}>Resume Session</Text><Text style={styles.toolDetail}>Return this exact Session to Active. No duplicate Session is created.</Text></View><Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} /></Pressable> : null}{onEditSetEvidence ? <Pressable accessibilityRole="button" onPress={() => run(onEditSetEvidence)} style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}><View style={styles.toolIcon}><Ionicons name="create-outline" size={19} color="#53CBE8" /></View><View style={styles.toolCopy}><Text style={styles.toolLabel}>Edit Set Evidence</Text><Text style={styles.toolDetail}>Resume the same Session to amend permitted load, reps, effort, or video evidence.</Text></View><Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} /></Pressable> : null}{onEditSessionNotes ? <Pressable accessibilityRole="button" onPress={() => run(onEditSessionNotes)} style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}><View style={styles.toolIcon}><Ionicons name="document-text-outline" size={19} color="#E05BD8" /></View><View style={styles.toolCopy}><Text style={styles.toolLabel}>Session Notes</Text><Text style={styles.toolDetail}>Return to the Session check-in to revise athlete-authorized reflection evidence.</Text></View><Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} /></Pressable> : null}{onViewSessionHistory ? <Pressable accessibilityRole="button" onPress={() => run(onViewSessionHistory)} style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}><View style={styles.toolIcon}><Ionicons name="time-outline" size={19} color="#B7C0CF" /></View><View style={styles.toolCopy}><Text style={styles.toolLabel}>Full Session History</Text><Text style={styles.toolDetail}>Open the athlete-owned completed Session archive.</Text></View><Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} /></Pressable> : null}{onCorrectEquipment ? <View style={styles.toolSubsection}><Text style={styles.toolSubsectionTitle}>CORRECT EQUIPMENT</Text>{equipmentMovements.length ? equipmentMovements.map((movement) => <Pressable key={movement.item_id || movement.label} accessibilityRole="button" onPress={() => run(() => onCorrectEquipment(movement))} style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}><ManufacturerBrandMark compact manufacturerName={movement.equipment?.[0]?.manufacturer || 'Equipment'} /><View style={styles.toolCopy}><Text style={styles.toolLabel}>{movement.label}</Text><Text style={styles.toolDetail}>{movement.equipment?.map((row) => row.label).filter(Boolean).join(' · ') || 'Choose the performed manufacturer and setup.'}</Text></View><Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} /></Pressable>) : <View style={styles.premiumEmpty}><Ionicons name="barbell-outline" size={24} color={SLColors.textMuted} /><View style={styles.premiumEmptyCopy}><Text style={styles.premiumEmptyTitle}>No equipment-specific movement to correct</Text><Text style={styles.premiumEmptyBody}>This Session did not record a governed machine or equipment identity.</Text></View></View>}</View> : null}{onOpenMovementHistory ? <View style={styles.toolSubsection}><Text style={styles.toolSubsectionTitle}>MOVEMENT HISTORY</Text>{movements.slice(0, 8).map((movement) => <Pressable key={`history-${movement.item_id || movement.label}`} accessibilityRole="button" onPress={() => run(() => onOpenMovementHistory(movement))} style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}><CanonicalMovementArtwork movement={movement} size={42} /><View style={styles.toolCopy}><Text style={styles.toolLabel}>{movement.label}</Text><Text style={styles.toolDetail}>Open exact governed history and comparable exposures.</Text></View><Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} /></Pressable>)}</View> : null}</ScrollView></View></View></Modal>;
}

export function CompletedSessionRecap({ recap, impactSummary, preferredUnits, refreshing, onRefresh, onClose, onDone, initialTab = 'overview', initialToolsOpen = false, initialScrollOffsetY = 0, initialExpandedItemId, viewerMode = 'athlete', sessionTimeZone, parentProvidesTopSafeArea = false, coachReview, coachReviewUnavailableReason, onViewLedger, onViewCalendar, onLogNextSession, onOpenProgramming, onOpenMovementHistory, onResumeSession, onCorrectEquipment, onEditSetEvidence, onEditSessionNotes, onViewSessionHistory }: Props) {
  const insets = useSafeAreaInsets();
  const contentScrollRef = useRef<ScrollView>(null);
  const tabsScrollRef = useRef<ScrollView>(null);
  const priorTabRef = useRef<RecapTab>(initialTab);
  const { unit, setUnit } = useSurfaceWeightUnit(preferredUnits);
  const [tab, setTab] = useState<RecapTab>(initialTab);
  const [showAccomplishments, setShowAccomplishments] = useState(false);
  const [video, setVideo] = useState<{ id: number; summary?: SetVideoSummary | null } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(initialToolsOpen);
  const canonicalPrEvents = useMemo(() => recap.accomplishments.filter((row) => CANONICAL_PR_EVENT_TYPES.has(String(row.event_type || '').toUpperCase())), [recap.accomplishments]);
  const performedMovements = useMemo(() => recap.performed_movements.map((rawMovement) => {
    const movement = normalizeMovementStrengthMetric(rawMovement);
    const events = canonicalPrEvents.filter((row) => accomplishmentMatchesMovement(row, movement));
    const prSetIds = new Set(events.map(accomplishmentSetLogId).filter((id): id is number => id != null));
    return { ...movement, has_pr: movement.has_pr || events.length > 0, sets: movement.sets.map((set) => ({ ...set, has_pr: set.has_pr || prSetIds.has(Number(set.id)) })) };
  }), [canonicalPrEvents, recap.performed_movements]);
  const recapHighlights = recap.highlights || {};
  const highlights = {
    session_streak: recapHighlights.session_streak ?? impactSummary?.session_streak,
    pr_count: recapHighlights.pr_count ?? canonicalPrEvents.length,
    prescription_completion_percent: recapHighlights.prescription_completion_percent ?? (impactSummary?.all_prescribed_work_logged ? 100 : null),
    all_prescribed_work_logged: recapHighlights.all_prescribed_work_logged ?? impactSummary?.all_prescribed_work_logged,
  };
  const showPerfectPlan = Number(recapHighlights.prescribed_set_count || 0) > 0
    && Number(recapHighlights.completed_prescribed_set_count || 0) >= 0
    && Number(highlights.prescription_completion_percent || 0) > 0;
  const personalBestEvidence = useMemo<CanonicalPrEvidence[]>(
    () => buildPersonalBestEvidence(canonicalPrEvents, performedMovements),
    [canonicalPrEvents, performedMovements],
  );
  const feedback = String(recap.coach_feedback.feedback || '').trim();
  const hasReflection = recap.reflection.session_rpe != null || !!recap.reflection.strength || !!recap.reflection.fatigue || !!String(recap.reflection.note || '').trim();
  const focusRows = useMemo(() => [...(recap.muscle_focus?.primary || []), ...(recap.muscle_focus?.secondary || [])], [recap.muscle_focus]);
  const projections = performedMovements.filter((row) => row.projection?.value_kg);
  const firstPrEvidence = personalBestEvidence[0];
  const firstPrMovement = firstPrEvidence?.movement || null;
  const firstPrPresentation = firstPrEvidence ? prEvidencePresentation(firstPrEvidence, unit) : null;
  const firstPrValue = firstPrPresentation
    ? firstPrPresentation.currentLabel
    : `${numberLabel(highlights.pr_count, 0)} verified PR${Number(highlights.pr_count) === 1 ? '' : 's'}`;
  const firstPrDelta = firstPrPresentation?.deltaLabel || null;
  const hasPerformedEvidence = performedMovements.length > 0 && recap.session.set_count > 0;
  const athleteInitials = recap.athlete.name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const feedbackInitials = String(recap.coach_feedback.author?.name || 'Coach').split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const maxFocusScore = Math.max(1, ...focusRows.map((row) => Number(row.score || 0)));

  useEffect(() => { setCompletedSessionRecapOpen(true); return () => setCompletedSessionRecapOpen(false); }, []);
  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => setToolsOpen(initialToolsOpen), [initialToolsOpen]);
  useEffect(() => {
    if (priorTabRef.current === tab) return;
    priorTabRef.current = tab;
    const resetScrollOwners = () => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: false });
      if (tab === 'overview' || tab === 'performed') tabsScrollRef.current?.scrollTo({ x: 0, animated: false });
      else tabsScrollRef.current?.scrollToEnd({ animated: false });
    };
    resetScrollOwners();
    const frame = requestAnimationFrame(resetScrollOwners);
    return () => cancelAnimationFrame(frame);
  }, [tab]);
  useEffect(() => {
    if (tab === 'personal_bests' && !personalBestEvidence.length) setTab('overview');
  }, [personalBestEvidence.length, tab]);

  const openVideo = (set: CompletedRecapSet) => { const id = setVideoId(set); if (id > 0) setVideo({ id, summary: set.video || null }); };
  const meta = [dateLabel(recap.session.date), durationLabel(recap.session.duration_seconds)].filter(Boolean).join(' · ');
  const bodyweight = recap.session.reported_bodyweight?.reported_bodyweight_kg ?? recap.readiness_context?.bodyweight_kg;
  const sessionVolume = formatCompactVolumeValueFromKg(recapHighlights.session_volume_kg ?? impactSummary?.session_volume_kg ?? recap.session.total_volume_kg, unit) || 'Volume not recorded';
  const analytics = useMemo(() => ({ ...fallbackReviewerAnalytics(recap), ...((recap.reviewer_v3 || {}) as ReviewerAnalytics) }), [recap]);
  const movementOutcomes = analytics.session_read?.performance?.counts || {};
  const primaryTimeZone = resolveSessionTimeZone(sessionTimeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const startedAt = parseSessionLifecycleInstant(recap.session.started_at);
  const explicitCompletedAt = parseSessionLifecycleInstant(recap.session.completed_at);
  const completedAt = recap.session.duration_seconds != null
    ? (explicitCompletedAt || (startedAt ? new Date(startedAt.getTime() + Number(recap.session.duration_seconds) * 1000) : null))
    : null;
  const primaryStart = startedAt ? formatSessionTimeLabel(startedAt, { sessionDate: recap.session.date, timeZone: primaryTimeZone }) : null;
  const primaryEnd = completedAt ? formatSessionTimeLabel(completedAt, { sessionDate: recap.session.date, timeZone: primaryTimeZone }) : null;
  const easternStart = primaryTimeZone === 'America/Los_Angeles' && startedAt ? formatSessionTimeLabel(startedAt, { sessionDate: recap.session.date, timeZone: 'America/New_York' }) : null;
  const easternEnd = primaryTimeZone === 'America/Los_Angeles' && completedAt ? formatSessionTimeLabel(completedAt, { sessionDate: recap.session.date, timeZone: 'America/New_York' }) : null;
  const sessionTimeLine = primaryStart && primaryEnd
    ? `${primaryStart}–${primaryEnd}${easternStart && easternEnd ? ` PT (${easternStart}–${easternEnd} ET)` : ''}`
    : 'Duration not recorded';
  const deepActions = [
    onViewLedger ? { icon: 'list-outline' as const, label: 'View in Ledger', onPress: onViewLedger } : null,
    onViewCalendar ? { icon: 'calendar-outline' as const, label: 'View on Calendar', onPress: onViewCalendar } : null,
    viewerMode === 'coach' && onOpenProgramming ? { icon: 'options-outline' as const, label: 'Open Programming', onPress: onOpenProgramming } : null,
    viewerMode === 'athlete' && onLogNextSession ? { icon: 'pulse-outline' as const, label: 'Log Next Session', onPress: onLogNextSession, primary: true } : null,
  ].filter(Boolean) as { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; primary?: boolean }[];

  const visibleTabs: { key: RecapTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'performed', label: 'Performed' },
    ...(personalBestEvidence.length ? [{ key: 'personal_bests' as const, label: 'Personal Bests' }] : []),
    { key: 'plan', label: 'Plan / Compare' },
    ...(viewerMode === 'coach' ? [{ key: 'coach' as const, label: 'Coach' }] : []),
  ];
  const equipmentCorrectionAvailable = viewerMode === 'athlete' && !!onCorrectEquipment;
  const hasAthleteTools = viewerMode === 'athlete' && Boolean(onResumeSession || onEditSetEvidence || onEditSessionNotes || onViewSessionHistory || onOpenMovementHistory || equipmentCorrectionAvailable);

  return <SafeAreaView edges={parentProvidesTopSafeArea ? [] : ['top']} style={styles.screen}>
    <FloatingControlCoordinator context="screen">
      <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} slot={1} testID="canonical-post-session-unit-toggle" />
      <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Back from post-Session review" onPress={onClose} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={SLColors.textPrimary} /></Pressable><View style={styles.topBarCopy}><Text numberOfLines={1} style={styles.topTitle}>{recap.session.label}</Text><Text style={styles.topSubtitle}>{viewerMode === 'coach' ? 'Coach Post-Session' : 'Post-Session'}</Text></View>{hasAthleteTools ? <Pressable accessibilityRole="button" accessibilityLabel="Open post-Session tools" onPress={() => setToolsOpen(true)} style={({ pressed }) => [styles.completeMark, pressed && styles.pressed]}><Ionicons name="ellipsis-horizontal" size={22} color={SLColors.textPrimary} /></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Done reviewing completed Session" onPress={onDone || onClose} style={({ pressed }) => [styles.completeMark, pressed && styles.pressed]}><Ionicons name="checkmark" size={23} color={SLColors.textPrimary} /></Pressable>}</View>
      <ScrollView ref={contentScrollRef} contentOffset={{ x: 0, y: initialScrollOffsetY }} contentContainerStyle={[styles.canonicalContent, { paddingBottom: Math.max(insets.bottom, 18) + 94 }]} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={SLColors.accent} /> : undefined} showsVerticalScrollIndicator={false}>
        <View style={styles.canonicalHero}><LinearGradient colors={['#140A20', '#07080E', '#020306']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} /><LinearGradient colors={['rgba(61,20,112,0.02)', 'rgba(136,47,218,0.2)', 'rgba(224,66,204,0.05)']} end={{ x: 1, y: 0.7 }} start={{ x: 0, y: 0.45 }} style={styles.heroAtmosphere} />{focusRows.length ? <View style={styles.canonicalHeroAnatomy}><ProgrammingMuscleRegionArt level="session" primary={(recap.muscle_focus?.primary || []).map((row) => row.muscle_id)} secondary={(recap.muscle_focus?.secondary || []).map((row) => row.muscle_id)} /></View> : <Image accessibilityIgnoresInvertColors resizeMode="contain" source={SESSION_RECAP_ARCHIVE_ART} style={styles.canonicalHeroArchiveArt} />}<LinearGradient colors={['rgba(3,3,7,0.99)', 'rgba(3,3,7,0.8)', 'rgba(3,3,7,0.04)']} end={{ x: 1, y: 0.5 }} locations={[0, 0.6, 1]} start={{ x: 0, y: 0.5 }} style={styles.canonicalHeroShade} /><View style={styles.canonicalHeroCopy}><View style={styles.completedBadge}><Ionicons name="checkmark-circle" size={12} color={SLColors.success} /><Text style={styles.completedBadgeText}>COMPLETED</Text></View><Text numberOfLines={2} style={styles.canonicalHeroTitle}>{recap.session.label}</Text><View style={styles.heroIdentity}><View style={styles.athleteInitials}>{recap.athlete.avatar_url ? <Image accessibilityIgnoresInvertColors source={{ uri: absoluteAssetUrl(recap.athlete.avatar_url)! }} style={styles.athleteAvatar} /> : <Text style={styles.athleteInitialsText}>{athleteInitials || 'SL'}</Text>}</View><View style={styles.heroIdentityCopy}><Text style={styles.heroAthlete}>{recap.athlete.name}</Text><Text style={styles.heroMeta}>{dateLabel(recap.session.date)}</Text></View></View><Text style={styles.sessionTimes}>{sessionTimeLine}</Text></View><View style={styles.canonicalHeroMetrics}><SummaryMetric value={String(recap.session.movement_count)} label="Movements" /><SummaryMetric value={String(recap.session.set_count)} label="Sets" /><SummaryMetric value={sessionVolume} label="Volume" /><SummaryMetric value={recap.reflection.session_rpe == null ? 'Not logged' : numberLabel(recap.reflection.session_rpe)} label="Session RPE" /><SummaryMetric value={durationLabel(recap.session.duration_seconds) || 'Building'} label="Duration" /><SummaryMetric value={Number(highlights.session_streak || 0) > 0 ? numberLabel(highlights.session_streak, 0) : 'Building'} label="Session Streak" /></View></View>

        <View style={styles.compactHighlightRail}>{Number(highlights.session_streak || 0) > 0 ? <CompactHighlight kind="streak" tone="#FF746F" label="SESSION STREAK" value={numberLabel(highlights.session_streak, 0)} detail="Completed Sessions in sequence" /> : null}{personalBestEvidence.length ? <CompactHighlight kind="pr" tone={SLColors.warning} label="PR EVIDENCE" value={numberLabel(personalBestEvidence.length, 0)} detail={`${firstPrMovement?.label || 'Verified performance'}${firstPrDelta ? ` · ${firstPrDelta}` : ''}`} /> : null}<CompactHighlight kind="prescription" tone={showPerfectPlan ? SLColors.success : '#53CBE8'} label="EXECUTION" value={recapHighlights.prescribed_set_count ? `${numberLabel(recapHighlights.completed_prescribed_set_count, 0)} / ${numberLabel(recapHighlights.prescribed_set_count, 0)}` : `${recap.session.set_count} logged`} detail={recapHighlights.prescribed_set_count ? `${numberLabel(highlights.prescription_completion_percent, 0)}% of persisted plan` : 'Persisted SetLog evidence'} /></View>

        <ScrollView ref={tabsScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{visibleTabs.map((row) => <Pressable key={row.key} accessibilityRole="tab" accessibilityState={{ selected: tab === row.key }} onPress={() => setTab(row.key)} style={({ pressed }) => [styles.tab, tab === row.key && styles.tabActive, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.tabText, tab === row.key && styles.tabTextActive]}>{row.label}</Text></Pressable>)}</ScrollView>

        {tab === 'overview' ? <><SessionReadOverview analytics={analytics} recap={recap} /><WhatChangedOverview analytics={analytics} recap={recap} unit={unit} /><RecoveryOverview analytics={analytics} recap={recap} />{bodyweight ? <PostSessionSection title="BODYWEIGHT CONTEXT"><View style={styles.bodyweightContextCard}><View><Text style={styles.bodyweightContextValue}>{formatWeightFromKg(bodyweight, unit) || 'Bodyweight value unavailable'}</Text><Text style={styles.bodyweightContextDetail}>Reported for this Session · context only</Text></View><Ionicons name="scale-outline" size={28} color="#53CBE8" /></View></PostSessionSection> : null}<ReflectionOverview analytics={analytics} recap={recap} />{feedback ? <PostSessionSection title="COACH FEEDBACK" meta={recap.coach_feedback.reviewed ? 'Reviewed' : 'Athlete-visible'}><View style={styles.feedbackCard}><LinearGradient colors={['rgba(93,42,145,0.19)', '#07080D']} style={StyleSheet.absoluteFillObject} /><View style={styles.feedbackHeader}><View style={styles.feedbackAvatar}>{recap.coach_feedback.author?.avatar_url ? <Image accessibilityIgnoresInvertColors source={{ uri: absoluteAssetUrl(recap.coach_feedback.author.avatar_url)! }} style={styles.feedbackAvatarImage} /> : <Text style={styles.feedbackAvatarText}>{feedbackInitials || 'C'}</Text>}</View><View style={styles.feedbackIdentity}><Text style={styles.feedbackAuthor}>{recap.coach_feedback.author?.name || 'Coach feedback'}</Text><Text style={styles.detailMeta}>{dateLabel(recap.coach_feedback.feedback_at)}</Text></View></View><Text style={styles.feedbackQuote}>{feedback}</Text></View></PostSessionSection> : null}</> : null}

        {tab === 'performed' ? <><PostSessionSection title="PERFORMED MUSCLE EMPHASIS" meta="Actual persisted SetLogs">{focusRows.length ? <View style={styles.focusCard}><LinearGradient colors={['rgba(85,29,139,0.22)', 'rgba(6,7,11,0.94)', '#05060A']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} /><View style={styles.focusChart}><ProgrammingMuscleRegionArt level="session" primary={(recap.muscle_focus?.primary || []).map((row) => row.muscle_id)} secondary={(recap.muscle_focus?.secondary || []).map((row) => row.muscle_id)} style={styles.focusAnatomy} /></View><View style={styles.focusBreakdown}><Text style={styles.focusSummary}>Ranked performed emphasis</Text>{focusRows.slice(0, 5).map((row, index) => { const relative = Math.round(Number(row.score || 0) / maxFocusScore * 100); const primaryCount = recap.muscle_focus?.primary?.length || 0; return <View key={row.muscle_id} style={styles.focusRow}><View style={styles.focusRowTop}><Text style={styles.focusName}>{formatMuscle(row.muscle_id)}</Text><Text style={styles.focusRank}>#{index + 1} · {index < primaryCount ? 'PRIMARY' : 'SECONDARY'}</Text></View><View style={styles.focusTrack}><View style={[styles.focusFill, { width: `${Math.max(relative, 7)}%`, backgroundColor: ['#B45CFF', '#E347CF', '#4A9FFF', '#58D68D', '#FF785A'][index % 5] }]} /></View></View>; })}</View></View> : <View style={styles.premiumEmpty}><Ionicons name="body-outline" size={25} color={SLColors.textMuted} /><View style={styles.premiumEmptyCopy}><Text style={styles.premiumEmptyTitle}>Performed muscle emphasis is unavailable</Text><Text style={styles.premiumEmptyBody}>Historical SetLogs do not contain enough governed muscle taxonomy to rank this Session.</Text></View></View>}</PostSessionSection><PostSessionSection title="MOVEMENT PROGRESSION" meta={`${performedMovements.length} performed movement${performedMovements.length === 1 ? '' : 's'} · all shown`}><View style={styles.movementStack}>{performedMovements.length ? performedMovements.map((movement, index) => <PerformedMovementCard key={movement.item_id || `${movement.label}-${index}`} movement={movement} analysis={(analytics.movements || []).find((row) => Number(row.item_id) === Number(movement.item_id))} unit={unit} onVideo={openVideo} onOpenHistory={onOpenMovementHistory} initialExpanded={Number(movement.item_id) === Number(initialExpandedItemId)} />) : <View style={styles.premiumEmpty}><Ionicons name="document-text-outline" size={25} color={SLColors.textMuted} /><View style={styles.premiumEmptyCopy}><Text style={styles.premiumEmptyTitle}>No performed SetLog evidence was recorded</Text><Text style={styles.premiumEmptyBody}>This historical Session preserves its identity and reflection, but movement analytics require persisted set evidence.</Text></View></View>}</View></PostSessionSection></> : null}

        {tab === 'personal_bests' && personalBestEvidence.length ? <PersonalBestsExperience evidence={personalBestEvidence} unit={unit} /> : null}

        {tab === 'plan' ? recap.plan.available === false ? <PostSessionSection title="PLAN / COMPARE"><View style={styles.premiumEmpty}><Ionicons name="lock-closed-outline" size={25} color={SLColors.textMuted} /><View style={styles.premiumEmptyCopy}><Text style={styles.premiumEmptyTitle}>Prescription details are unavailable in this workspace</Text><Text style={styles.premiumEmptyBody}>Performed evidence remains visible. Coach-authored prescription details stay with their authorized coaching workspace.</Text></View></View></PostSessionSection> : <PlanCompareExperience edgeToEdge recap={recap} performedMovements={performedMovements} unit={unit} onOpenHistory={onOpenMovementHistory} /> : null}

        {tab === 'coach' && viewerMode === 'coach' ? <><CoachReadOverview analytics={analytics} />{onOpenProgramming ? <Pressable accessibilityRole="button" onPress={onOpenProgramming} style={({ pressed }) => [styles.programmingAction, pressed && styles.pressed]}><Ionicons name="options-outline" size={19} color={SLColors.accentMuted} /><View style={styles.programmingActionCopy}><Text style={styles.programmingActionTitle}>Open Programming</Text><Text style={styles.programmingActionDetail}>Use the evidence above to adjust the athlete’s next plan.</Text></View><Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} /></Pressable> : null}{coachReview ? <CoachTools review={coachReview} /> : <PostSessionSection title="COACH REVIEW TOOLS"><View style={styles.premiumEmpty}><Ionicons name="lock-closed-outline" size={24} color={SLColors.textMuted} /><View style={styles.premiumEmptyCopy}><Text style={styles.premiumEmptyTitle}>Review controls are unavailable</Text><Text style={styles.premiumEmptyBody}>{coachReviewUnavailableReason || 'This review cannot be edited from the current coaching workspace.'}</Text></View></View></PostSessionSection>}</> : null}

        {deepActions.length ? <View style={styles.nextActions}>{deepActions.map((action) => <ActionButton key={action.label} {...action} />)}</View> : null}
      </ScrollView>
      <SetVideoPlayerModal visible={!!video} videoId={video?.id || null} initialVideo={video?.summary || null} initialUrl={video?.summary?.url || null} onClose={() => setVideo(null)} />
      <PostSessionToolsSheet visible={toolsOpen} movements={performedMovements} onClose={() => setToolsOpen(false)} onResumeSession={onResumeSession} onCorrectEquipment={equipmentCorrectionAvailable ? onCorrectEquipment : undefined} onEditSetEvidence={onEditSetEvidence} onEditSessionNotes={onEditSessionNotes} onOpenMovementHistory={onOpenMovementHistory} onViewSessionHistory={onViewSessionHistory} />
    </FloatingControlCoordinator>
  </SafeAreaView>;

  /* Retired athlete-recap renderer retained as non-executable source during
     contract migration. The canonical role-aware return above is the only
     post-Session runtime. This block is removed after downstream source-only
     assertions finish migrating to the canonical contract.
  if (!hasPerformedEvidence) {
    return <SafeAreaView edges={parentProvidesTopSafeArea ? [] : ['top']} style={styles.screen}>
      <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Back from Session review" onPress={onClose} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={SLColors.textPrimary} /></Pressable><View style={styles.topBarCopy}><Text numberOfLines={1} style={styles.topTitle}><Text style={styles.topDot}>• </Text>{recap.session.label}</Text><Text style={styles.topSubtitle}>{viewerMode === 'coach' ? 'Coach Session Review' : 'Session Recap'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Done reviewing completed session recap" onPress={onDone || onClose} style={({ pressed }) => [styles.completeMark, pressed && styles.pressed]}><Ionicons name="checkmark" size={23} color={SLColors.textPrimary} /></Pressable></View>
      <ScrollView contentOffset={{ x: 0, y: initialScrollOffsetY }} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 24 }]} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={SLColors.accent} /> : undefined} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionShell}><View style={styles.sparseHero}><LinearGradient colors={['#13091F', '#07070C', '#020306']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} /><Image accessibilityIgnoresInvertColors resizeMode="contain" source={SESSION_RECAP_ARCHIVE_ART} style={styles.sparseHeroArt} /><View style={styles.sparseHeroCopy}><Text style={styles.heroKicker}>COMPLETED · HISTORICAL</Text><Text numberOfLines={2} style={styles.sparseHeroTitle}>{recap.session.label}</Text><View style={styles.sparseAthleteRow}><View style={styles.athleteInitials}><Text style={styles.athleteInitialsText}>{athleteInitials || 'SL'}</Text></View><View><Text style={styles.heroAthlete}>{recap.athlete.name}</Text><Text style={styles.heroMeta}>{meta}</Text></View></View></View></View></View>
        <View style={styles.sectionShell}><View style={styles.sparseEvidence}><View style={styles.sparseEvidenceIcon}><Ionicons name="archive-outline" size={24} color={SLColors.accentMuted} /></View><View style={styles.sparseEvidenceCopy}><Text style={styles.sparseEvidenceTitle}>Historical evidence is limited</Text><Text style={styles.sparseEvidenceBody}>Detailed set evidence was not recorded for this historical Session. Only surviving canonical records are shown.</Text></View></View></View>
        {recap.accomplishments.length ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>SURVIVING ACCOMPLISHMENT RECORDS</Text><View style={styles.accomplishmentList}>{recap.accomplishments.map((row, index) => <View key={row.id || index} style={styles.accomplishmentRow}><Image accessibilityIgnoresInvertColors source={sessionRecapHighlightAsset('pr')} style={styles.archiveAccomplishmentArt} /><View><Text style={styles.accomplishmentTitle}>{String(row.headline || row.title || row.event_type || 'Achievement').replaceAll('_', ' ')}</Text>{row.movement_label ? <Text style={styles.detailMeta}>{row.movement_label} · archived canonical record</Text> : null}</View></View>)}</View></View> : null}
        {hasReflection ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>ATHLETE REFLECTION</Text><View style={styles.detailCard}>{recap.reflection.session_rpe != null ? <Text style={styles.factPill}>Session RPE {numberLabel(recap.reflection.session_rpe)}</Text> : null}{recap.reflection.note ? <Text style={[styles.quote, { marginTop: 10 }]}>{recap.reflection.note}</Text> : null}</View></View> : null}
        {feedback ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>POST SESSION FEEDBACK</Text><View style={styles.feedbackCard}><View style={styles.feedbackHeader}><View style={styles.feedbackAvatar}><Text style={styles.feedbackAvatarText}>{feedbackInitials || 'C'}</Text></View><View style={styles.feedbackIdentity}><Text style={styles.feedbackAuthor}>{recap.coach_feedback.author?.name || 'Coach feedback'}</Text><Text style={styles.detailMeta}>{dateLabel(recap.coach_feedback.feedback_at)}</Text></View>{recap.coach_feedback.reviewed ? <View style={styles.reviewedBadge}><Text style={styles.reviewedBadgeText}>REVIEWED</Text></View> : null}</View><Text style={styles.quote}>{feedback}</Text></View></View> : null}
        {viewerMode === 'coach' && coachReview ? <CoachTools review={coachReview} /> : null}
        {deepActions.length ? <View style={styles.sectionShell}><View style={styles.nextActions}>{deepActions.map((action) => <ActionButton key={action.label} {...action} />)}</View></View> : null}
      </ScrollView>
      <SetVideoPlayerModal visible={!!video} videoId={video?.id || null} initialVideo={video?.summary || null} initialUrl={video?.summary?.url || null} onClose={() => setVideo(null)} />
    </SafeAreaView>;
  }

  return <SafeAreaView edges={parentProvidesTopSafeArea ? [] : ['top']} style={styles.screen}>
    <FloatingControlCoordinator context="screen">
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} slot={1} testID="session-recap-unit-toggle" />
    <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Back from Session review" onPress={onClose} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={SLColors.textPrimary} /></Pressable><View style={styles.topBarCopy}><Text numberOfLines={1} style={styles.topTitle}><Text style={styles.topDot}>• </Text>{recap.session.label}</Text><Text style={styles.topSubtitle}>{viewerMode === 'coach' ? 'Coach Session Review' : 'Session Recap'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Done reviewing completed session recap" onPress={onDone || onClose} style={({ pressed }) => [styles.completeMark, pressed && styles.pressed]}><Ionicons name="checkmark" size={23} color={SLColors.textPrimary} /></Pressable></View>
    <ScrollView contentOffset={{ x: 0, y: initialScrollOffsetY }} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 24 }]} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={SLColors.accent} /> : undefined} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionShell}><View style={styles.tabs}><Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'performed' }} onPress={() => setTab('performed')} style={({ pressed }) => [styles.tab, tab === 'performed' && styles.tabActive, pressed && styles.pressed]}><Text style={[styles.tabText, tab === 'performed' && styles.tabTextActive]}>Performed</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'plan' }} onPress={() => setTab('plan')} style={({ pressed }) => [styles.tab, tab === 'plan' && styles.tabActive, pressed && styles.pressed]}><Text style={[styles.tabText, tab === 'plan' && styles.tabTextActive]}>Plan / Compare</Text></Pressable></View></View>
      {tab === 'performed' ? <>
      <View style={styles.sectionShell}><View style={styles.hero}><LinearGradient colors={['#12091F', '#08070E', '#020306']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} /><LinearGradient colors={['rgba(61,20,112,0.02)', 'rgba(136,47,218,0.18)', 'rgba(224,66,204,0.06)']} end={{ x: 1, y: 0.7 }} start={{ x: 0, y: 0.45 }} style={styles.heroAtmosphere} /><View style={styles.heroAnatomy}><ProgrammingMuscleRegionArt level="session" primary={(recap.muscle_focus?.primary || []).map((row) => row.muscle_id)} secondary={(recap.muscle_focus?.secondary || []).map((row) => row.muscle_id)} /></View><LinearGradient colors={['rgba(3,3,7,0.98)', 'rgba(3,3,7,0.78)', 'rgba(3,3,7,0.04)']} end={{ x: 1, y: 0.5 }} locations={[0, 0.58, 1]} start={{ x: 0, y: 0.5 }} style={styles.heroCopyShade} /><View style={styles.heroCopy}><Text style={styles.heroKicker}>COMPLETED</Text><Text numberOfLines={2} style={styles.heroTitle}>{recap.session.label}</Text><View style={styles.heroIdentity}><View style={styles.athleteInitials}>{recap.athlete.avatar_url ? <Image accessibilityIgnoresInvertColors source={{ uri: absoluteAssetUrl(recap.athlete.avatar_url)! }} style={styles.athleteAvatar} /> : <Text style={styles.athleteInitialsText}>{athleteInitials || 'SL'}</Text>}</View><View style={styles.heroIdentityCopy}><Text style={styles.heroAthlete}>{recap.athlete.name}</Text><Text style={styles.heroMeta}>{meta}</Text></View></View></View>{hasReflection ? <View style={styles.notesPill}><Ionicons name="document-text-outline" size={16} color={SLColors.textPrimary} /><Text style={styles.notesPillText}>Session Notes</Text></View> : null}<View style={styles.summaryMetricRow}><SummaryMetric icon="barbell-outline" value={String(recap.session.movement_count)} label="Movements" /><SummaryMetric icon="list-outline" value={String(recap.session.set_count)} label="Sets Completed" /><SummaryMetric icon="stats-chart-outline" value={sessionVolume} label="Total Volume" /><SummaryMetric icon="pulse-outline" value={numberLabel(recap.reflection.session_rpe)} label="Session RPE" /></View></View></View>

      {(Number(highlights.pr_count || 0) > 0 || showPerfectPlan || Number(highlights.session_streak || 0) > 0) ? <View style={styles.sectionShell}><View style={styles.sectionHeading}><Text style={styles.sectionLabel}>SESSION HIGHLIGHTS</Text>{recap.accomplishments.length > 3 ? <Pressable onPress={() => setShowAccomplishments((value) => !value)}><Text style={styles.sectionAction}>{showAccomplishments ? 'Show less' : 'View all'}</Text></Pressable> : null}</View><View style={styles.highlightRail}>{Number(highlights.pr_count || 0) > 0 ? <HighlightCard kind="pr" color={SLColors.warning} label={String(firstPr?.event_type || '').includes('REP') ? 'REP PR' : 'PERSONAL RECORD'} value={firstPrValue} detail={[String(firstPrMovement?.label || firstPr?.movement_label || firstPr?.headline || 'Verified performance'), firstPrDelta].filter(Boolean).join(' · ')} /> : null}{showPerfectPlan ? <HighlightCard kind="prescription" color={SLColors.success} label="PERFECT PLAN" value={`${numberLabel(recapHighlights.completed_prescribed_set_count, 0)} / ${numberLabel(recapHighlights.prescribed_set_count, 0)}`} detail={`${numberLabel(highlights.prescription_completion_percent, 0)}% prescribed sets`} /> : null}{Number(highlights.session_streak || 0) > 0 ? <HighlightCard kind="streak" color="#FF6670" label="SESSION STREAK" value={numberLabel(highlights.session_streak, 0)} detail="Completed Sessions in sequence" /> : null}</View>{showAccomplishments ? <View style={styles.accomplishmentList}>{recap.accomplishments.map((row, index) => <View key={row.id || index} style={styles.accomplishmentRow}><Image accessibilityIgnoresInvertColors source={sessionRecapHighlightAsset('pr')} style={styles.archiveAccomplishmentArt} /><View><Text style={styles.accomplishmentTitle}>{String(row.headline || row.title || row.event_type || 'Achievement').replaceAll('_', ' ')}</Text>{row.movement_label ? <Text style={styles.detailMeta}>{row.movement_label}</Text> : null}</View></View>)}</View> : null}</View> : null}
      </> : null}

      {tab === 'performed' ? <>
        {focusRows.length ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>SESSION FOCUS</Text><View style={styles.focusCard}><LinearGradient colors={['rgba(85,29,139,0.22)', 'rgba(6,7,11,0.94)', '#05060A']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} /><View style={styles.focusChart}><ProgrammingMuscleRegionArt level="session" primary={(recap.muscle_focus?.primary || []).map((row) => row.muscle_id)} secondary={(recap.muscle_focus?.secondary || []).map((row) => row.muscle_id)} style={styles.focusAnatomy} /></View><View style={styles.focusBreakdown}><Text style={styles.focusSummary}>Performed muscle emphasis</Text>{focusRows.slice(0, 5).map((row, index) => { const relative = Math.round(Number(row.score || 0) / maxFocusScore * 100); const primaryCount = recap.muscle_focus?.primary?.length || 0; return <View key={row.muscle_id} style={styles.focusRow}><View style={styles.focusRowTop}><Text style={styles.focusName}>{formatMuscle(row.muscle_id)}</Text><Text style={styles.focusRank}>#{index + 1} · {index < primaryCount ? 'PRIMARY' : 'SECONDARY'}</Text></View><View style={styles.focusTrack}><View style={[styles.focusFill, { width: `${Math.max(relative, 7)}%`, backgroundColor: ['#B45CFF', '#E347CF', '#4A9FFF', '#58D68D', '#FF785A'][index % 5] }]} /></View></View>; })}<Text style={styles.evidenceSource}>Performed SetLog targets · relative governed ranking. No invented percentages.</Text></View></View></View> : null}
        <View style={styles.sectionShell}><View style={styles.sectionHeading}><Text style={styles.sectionLabel}>MOVEMENTS <Text style={styles.countBadge}>{performedMovements.length}</Text></Text><Text style={styles.sectionMeta}>Collapsed · tap for full evidence</Text></View></View><View style={styles.movementStack}>{shownMovements.length ? shownMovements.map((movement, index) => <PerformedMovementCard key={movement.item_id || `${movement.label}-${index}`} movement={movement} unit={unit} onVideo={openVideo} onOpenHistory={onOpenMovementHistory} initialExpanded={Number(movement.item_id) === Number(initialExpandedItemId)} />) : <View style={styles.emptyCard}><Ionicons name="document-text-outline" size={25} color={SLColors.textMuted} /><Text style={styles.emptyTitle}>No performed sets were recorded</Text><Text style={styles.emptyBody}>This historical Session has no persisted SetLog evidence.</Text></View>}</View>{hiddenMovementCount > 0 ? <View style={styles.sectionShell}><Pressable accessibilityRole="button" accessibilityState={{ expanded: showAllMovements }} onPress={() => setShowAllMovements((value) => !value)} style={({ pressed }) => [styles.moreMovements, pressed && styles.pressed]}><Text style={styles.moreMovementsText}>{showAllMovements ? 'Show fewer movements' : `${hiddenMovementCount} more movement${hiddenMovementCount === 1 ? '' : 's'}`}</Text><Ionicons name={showAllMovements ? 'chevron-up' : 'chevron-down'} size={18} color={SLColors.textSecondary} /></Pressable></View> : null}
        {projections.length ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>PERFORMANCE PROJECTIONS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectionRail}>{projections.map((movement) => <View key={movement.item_id || movement.label} style={styles.projectionCard}><LinearGradient colors={['rgba(105,44,171,0.22)', '#07080D']} style={StyleSheet.absoluteFillObject} /><Text numberOfLines={1} style={styles.projectionName}>{movement.label}</Text><View style={styles.projectionBody}><View><Text style={styles.projectionMetric}>{movement.projection?.label || strengthMetricForMovementClass(movement.kind).label} · PROJECTED</Text><Text style={styles.projectionValue}>{formatCalculatedWeightFromKg(movement.projection?.value_kg, unit) || '—'}</Text></View><View style={styles.projectionSparkline}><MovementTrendChart compact trend={movement.trend} unit={unit} color="#C06BFF" /></View></View><Text style={styles.projectionBasis}>Canonical best set · {movement.projection?.method?.startsWith('epley_rpe_adjusted') ? 'Epley/RPE method' : movement.projection?.method || 'governed method'}</Text></View>)}</ScrollView></View> : null}
        {recap.session.volume_trend?.points?.length ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>VOLUME TREND</Text><View style={styles.volumeTrendCard}><LinearGradient colors={['rgba(55,33,92,0.26)', '#06070B']} style={StyleSheet.absoluteFillObject} /><View style={styles.volumeTrendHeading}><View><Text style={styles.projectionMetric}>CURRENT BLOCK · TOTAL VOLUME</Text><Text style={styles.volumeTrendValue}>{sessionVolume}</Text></View>{recap.session.volume_trend.delta_kg != null ? <View style={styles.volumeDelta}><Text style={styles.volumeDeltaValue}>{formatWeightDeltaFromKg(recap.session.volume_trend.delta_kg, unit)}</Text><Text style={styles.volumeDeltaLabel}>vs previous Session</Text></View> : null}</View><VolumeBars points={recap.session.volume_trend.points} /></View></View> : null}
        {hasReflection ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>ATHLETE REFLECTION</Text><View style={styles.detailCard}><View style={styles.reflectionHeader}><View style={styles.reflectionFacts}>{recap.reflection.session_rpe != null ? <Text style={styles.factPill}>Session RPE {numberLabel(recap.reflection.session_rpe)}</Text> : null}{recap.reflection.strength ? <Text style={styles.factPill}>{recap.reflection.strength}</Text> : null}{recap.reflection.fatigue ? <Text style={styles.factPill}>{recap.reflection.fatigue} fatigue</Text> : null}</View></View>{recap.reflection.note ? <Text style={styles.quote}>{recap.reflection.note}</Text> : null}</View></View> : null}
        {feedback ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>POST SESSION FEEDBACK</Text><View style={styles.feedbackCard}><LinearGradient colors={['rgba(93,42,145,0.19)', '#07080D']} style={StyleSheet.absoluteFillObject} /><View style={styles.feedbackHeader}><View style={styles.feedbackAvatar}>{recap.coach_feedback.author?.avatar_url ? <Image accessibilityIgnoresInvertColors source={{ uri: absoluteAssetUrl(recap.coach_feedback.author.avatar_url)! }} style={styles.feedbackAvatarImage} /> : <Text style={styles.feedbackAvatarText}>{feedbackInitials || 'C'}</Text>}</View><View style={styles.feedbackIdentity}><Text style={styles.feedbackAuthor}>{recap.coach_feedback.author?.name || 'Coach feedback'}</Text><Text style={styles.detailMeta}>{dateLabel(recap.coach_feedback.feedback_at)}</Text></View>{recap.coach_feedback.reviewed ? <View style={styles.reviewedBadge}><Text style={styles.reviewedBadgeText}>REVIEWED</Text></View> : null}</View><Text style={styles.feedbackQuote}>{feedback}</Text></View></View> : null}
        {(recap.readiness_context || bodyweight) ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>READINESS CONTEXT</Text><View style={styles.readinessPanel}><LinearGradient colors={['rgba(15,31,50,0.74)', '#06070B']} style={StyleSheet.absoluteFillObject} /><View style={styles.readinessGaugeRail}>{recap.readiness_context?.readiness_score != null ? <ReadinessGauge label="Readiness" value={recap.readiness_context.readiness_score} color="#58D68D" /> : null}{recap.readiness_context?.sleep_quality != null ? <ReadinessGauge label="Sleep" value={recap.readiness_context.sleep_quality} color="#6E80FF" /> : null}{recap.readiness_context?.stress != null ? <ReadinessGauge label="Stress" value={recap.readiness_context.stress} color="#F4B94F" /> : null}{recap.readiness_context?.energy != null ? <ReadinessGauge label="Energy" value={recap.readiness_context.energy} color="#A865FF" /> : null}</View>{bodyweight ? <View style={styles.bodyweightEvidence}><View><Text style={styles.detailKicker}>REPORTED BODYWEIGHT</Text><Text style={styles.bodyweightValue}>{formatWeightFromKg(bodyweight, unit) || '—'}</Text></View><Ionicons name="scale-outline" size={28} color="#53CBE8" /></View> : null}</View><Text style={styles.contextDisclaimer}>Reported before this Session. Shown as context, not as a causal claim.</Text></View> : null}
      </> : recap.plan.available === false ? <View style={styles.sectionShell}><View style={styles.emptyCard}><Ionicons name="lock-closed-outline" size={25} color={SLColors.textMuted} /><Text style={styles.emptyTitle}>Prescription unavailable</Text><Text style={styles.emptyBody}>This Session’s performed evidence remains visible. Coach-authored prescription details stay with their authoring workspace.</Text></View></View> : <PlanCompareExperience recap={recap} performedMovements={performedMovements} unit={unit} onOpenHistory={onOpenMovementHistory} />}
      {viewerMode === 'coach' && coachReview ? <CoachTools review={coachReview} /> : viewerMode === 'coach' && coachReviewUnavailableReason ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>COACH REVIEW TOOLS</Text><View style={styles.planNotice}><Ionicons name="lock-closed-outline" size={19} color={SLColors.textMuted} /><Text style={styles.planNoticeText}>{coachReviewUnavailableReason}</Text></View></View> : null}
      {deepActions.length ? <View style={styles.sectionShell}><View style={styles.nextActions}>{deepActions.map((action) => <ActionButton key={action.label} {...action} />)}</View></View> : null}
    </ScrollView>
    <SetVideoPlayerModal visible={!!video} videoId={video?.id || null} initialVideo={video?.summary || null} initialUrl={video?.summary?.url || null} onClose={() => setVideo(null)} />
    </FloatingControlCoordinator>
  </SafeAreaView>;
  */
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020306' }, pressed: { opacity: 0.72 }, content: { gap: 13 }, sectionShell: {}, edgeToEdge: { marginHorizontal: 0, paddingHorizontal: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#020306' }, topButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080A10' }, topBarCopy: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8 }, topTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 17 }, topDot: { color: SLColors.accentMuted }, topSubtitle: { marginTop: 2, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12 }, completeMark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#0B0D14' },
  hero: { position: 'relative', overflow: 'hidden', minHeight: 286, padding: 16, paddingBottom: 0, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#60358A', backgroundColor: '#07080E', ...SLShadows.level2 }, heroAtmosphere: { position: 'absolute', top: 0, right: 0, bottom: 70, width: '58%' }, heroAnatomy: { position: 'absolute', top: -13, right: -16, width: 190, height: 230, alignItems: 'center', justifyContent: 'center', opacity: 1, transform: [{ scale: 0.66 }] }, heroFallbackArt: { width: 220, height: 220, opacity: 0.72 }, heroCopyShade: { position: 'absolute', zIndex: 1, top: 0, bottom: 70, left: 0, width: '78%' }, heroCopy: { zIndex: 2, width: '58%', minHeight: 195, paddingTop: 3 }, heroKicker: { color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 1.2 }, heroTitle: { marginTop: 9, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 29, lineHeight: 32 }, heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }, heroIdentityCopy: { flex: 1, minWidth: 0 }, athleteInitials: { width: 34, height: 34, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: 'rgba(182,112,255,0.55)', backgroundColor: '#1A1024' }, athleteAvatar: { width: '100%', height: '100%' }, athleteInitialsText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, heroAthlete: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, heroMeta: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 }, notesPill: { position: 'absolute', zIndex: 3, top: 146, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: 'rgba(8,10,16,0.88)' }, notesPillText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, summaryMetricRow: { zIndex: 4, flexDirection: 'row', minHeight: 72, marginHorizontal: -16, paddingHorizontal: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(174,104,255,0.28)', backgroundColor: 'rgba(4,5,9,0.94)' }, summaryMetric: { width: '33.333%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderSubtle }, summaryMetricCopy: { flex: 1, minWidth: 0 }, summaryMetricValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 16 }, summaryMetricLabel: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10.5 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionLabel: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 1.05 }, sectionAction: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, sectionMeta: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8 }, countBadge: { color: SLColors.textSecondary },
  highlightRail: { flexDirection: 'row', gap: 7, paddingTop: 8 }, highlightCard: { position: 'relative', flex: 1, minWidth: 0, minHeight: 154, overflow: 'hidden', alignItems: 'center', padding: 8, borderRadius: SLRadius.lg, borderWidth: 1, backgroundColor: '#07080D' }, highlightArtwork: { width: 62, height: 62, marginTop: 1 }, highlightCopy: { width: '100%', alignItems: 'center', marginTop: -2 }, highlightLabel: { fontFamily: SLFontFamilies.bodyBold, fontSize: 7, letterSpacing: 0.55, textAlign: 'center' }, highlightValue: { width: '100%', marginTop: 4, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 15, textAlign: 'center' }, highlightDetail: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 7.5, lineHeight: 10, textAlign: 'center' }, accomplishmentList: { marginTop: 8, paddingHorizontal: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, accomplishmentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle }, archiveAccomplishmentArt: { width: 37, height: 37 }, accomplishmentTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11, textTransform: 'capitalize' },
  tabs: { minHeight: 48, flexDirection: 'row', gap: 4, padding: 3, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080A10' }, tab: { minWidth: 108, minHeight: 42, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md }, tabActive: { borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: SLColors.surfaceSelected }, tabText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, tabTextActive: { color: SLColors.textPrimary },
  focusCard: { position: 'relative', flexDirection: 'row', minHeight: 245, overflow: 'hidden', marginTop: 8, padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#39244F', backgroundColor: '#05060A' }, focusChart: { width: 162, height: 222, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, focusAnatomy: { transform: [{ scale: 0.57 }] }, focusBreakdown: { flex: 1, justifyContent: 'center', gap: 9, marginLeft: -8 }, focusSummary: { marginBottom: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 13 }, focusRow: { gap: 4 }, focusRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, focusName: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, focusRank: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 6.2 }, focusTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: SLColors.surfaceInset }, focusFill: { height: 5, borderRadius: 3 }, evidenceSource: { marginTop: 5, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7, lineHeight: 10 },
  movementStack: { gap: 10 }, movementCard: { overflow: 'hidden', borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#292D38', backgroundColor: '#06070B', ...SLShadows.level1 }, coreMovementCard: { borderLeftWidth: 2, borderLeftColor: SLColors.accent }, movementHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 11 }, movementMedia: { width: 76, alignItems: 'center', gap: 6 }, artwork: { position: 'relative', width: 72, height: 86, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#3B2852', backgroundColor: SLColors.surfaceMedia }, artworkImage: { width: 66, height: 77 }, artworkMap: { transform: [{ scale: 0.92 }] }, videoEvidencePreview: { position: 'relative', width: 72, height: 38, overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: '#3A3D49', backgroundColor: SLColors.surfaceMedia }, videoEvidencePlay: { position: 'absolute', top: 8, left: 26, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.74)', backgroundColor: 'rgba(2,3,6,0.66)' }, videoEvidenceLabel: { position: 'absolute', left: 4, bottom: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, movementSummary: { flex: 1, minWidth: 0, marginLeft: 10 }, movementTitleRow: { flexDirection: 'row', alignItems: 'center' }, movementTitleCopy: { flex: 1, minWidth: 0 }, movementEyebrow: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.8 }, movementTitle: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 18, lineHeight: 22 }, movementMuscles: { marginTop: 3, color: '#CA79FF', fontFamily: SLFontFamilies.body, fontSize: 12 }, movementEquipment: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 }, prBadge: { alignItems: 'center', justifyContent: 'center', width: 39, height: 42, marginHorizontal: 4 }, movementPrArtwork: { position: 'absolute', width: 38, height: 38 }, prBadgeText: { position: 'absolute', bottom: -1, color: SLColors.warning, fontFamily: SLFontFamilies.display, fontSize: 10 }, movementEvidenceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }, bestSetCopy: { flex: 1, minWidth: 0 }, bestSetLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.55 }, bestSetValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 14 }, bestSetEffort: { marginTop: 2, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12 }, sparklineWrap: { width: 96, minHeight: 42, justifyContent: 'flex-end' }, sparklineEmpty: { height: 76, alignItems: 'center', justifyContent: 'center' }, sparklineEmptyText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.35, textAlign: 'center' }, trendPlot: { position: 'relative', width: '100%', minHeight: 118 }, trendPlotCompact: { minHeight: 42 }, trendPointTarget: { position: 'absolute', width: 34, height: 34, borderRadius: 17 }, trendInspection: { position: 'absolute', top: 2, right: 5, alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: '#624081', backgroundColor: 'rgba(7,8,13,0.92)' }, trendInspectionDate: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 0.45 }, trendInspectionValue: { marginTop: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 14 }, trendInspectionMeta: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 }, trendAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, trendAxisLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10 }, delta: { position: 'absolute', right: 0, bottom: -2, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, deltaUp: { color: SLColors.success, backgroundColor: 'rgba(39,190,104,0.12)' }, deltaDown: { color: SLColors.danger, backgroundColor: 'rgba(255,84,104,0.12)' }, deltaUpText: { color: SLColors.success }, deltaDownText: { color: SLColors.danger }, movementMetaRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }, movementMeta: { overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, color: SLColors.textMuted, backgroundColor: '#10121A', fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 0.35 }, expandedEvidence: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard },
  movementComparisonGrid: { overflow: 'hidden', marginTop: 11, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#303440', backgroundColor: '#080A10' }, movementComparisonPair: { flexDirection: 'row' }, movementComparisonCell: { flex: 1, minWidth: 0, minHeight: 70, justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 8, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#282C35' }, movementComparisonLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.65 }, movementComparisonValue: { marginTop: 5, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13, lineHeight: 18 }, movementComparisonChange: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 9, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#282C35' }, movementChangeValues: { flex: 1, minWidth: 0 }, movementChangeValue: { marginTop: 4, fontFamily: SLFontFamilies.display, fontSize: 15 }, movementStateBadge: { maxWidth: '48%', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9, borderWidth: 1 }, movementComparisonState: { fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.55, textAlign: 'center' }, movementComparisonLiteral: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 15 }, movementTrendPanel: { marginTop: 9, padding: 9, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2D3140', backgroundColor: '#05070B' }, movementTrendHeading: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bestVideoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 10, padding: 9, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#694096', backgroundColor: '#0A0C13' }, bestVideoMedia: { position: 'relative', width: 118, height: 76, overflow: 'hidden', borderRadius: 9, backgroundColor: SLColors.surfaceMedia }, bestVideoPlay: { position: 'absolute', top: 24, left: 45, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.78)', backgroundColor: 'rgba(2,3,6,0.64)' }, bestVideoOverlay: { position: 'absolute', left: 7, bottom: 5, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, bestVideoCopy: { flex: 1, minWidth: 0 }, bestVideoValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 14 }, detailKicker: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.8 }, detailMeta: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 15 }, setTable: { paddingHorizontal: 10 }, setHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 34 }, setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle }, columnLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.65 }, setValue: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12 }, setValueStrong: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, setNumberColumn: { width: 28 }, resultColumn: { flex: 1.4 }, resultColumnRow: { flex: 1.4, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }, effortColumn: { width: 75 }, videoColumn: { width: 54, alignItems: 'flex-end' }, setPr: { overflow: 'hidden', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 5, color: SLColors.warning, backgroundColor: 'rgba(255,181,32,0.12)', fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, videoButton: { width: 50, height: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceMedia }, videoThumbnail: { ...StyleSheet.absoluteFillObject }, videoPlay: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(3,4,8,0.72)' }, trendDetail: { margin: 10, padding: 10, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: '#05070B' }, trendDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }, trendDeltaValue: { fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, historyAction: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 10, marginTop: 0, paddingHorizontal: 11, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: SLColors.accentSoft }, historyActionLabel: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.7 }, historyActionDetail: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 }, diagnosticCard: { margin: 10, marginTop: 0, padding: 10, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#315D79', backgroundColor: '#07101A' }, diagnosticLine: { marginTop: 5, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10, lineHeight: 14 }, diagnosticReason: { marginTop: 3, color: SLColors.warning, fontFamily: SLFontFamilies.body, fontSize: 10 }, equipmentFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard }, equipmentItem: { flexDirection: 'row', alignItems: 'center', flexGrow: 1, gap: 8 }, equipmentCopy: { flex: 1, minWidth: 70 }, equipmentModel: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, equipmentImplementation: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 },
  moreMovements: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset }, moreMovementsText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, emptyCard: { alignItems: 'center', padding: 26, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, emptyTitle: { marginTop: 9, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, emptyBody: { marginTop: 5, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10, textAlign: 'center' },
  projectionRail: { gap: 8, paddingTop: 8 }, projectionCard: { position: 'relative', width: 238, minHeight: 124, overflow: 'hidden', padding: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: '#39264E', backgroundColor: '#07090E' }, projectionName: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, projectionBody: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 9 }, projectionMetric: { marginTop: 8, color: SLColors.accentMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5 }, projectionValue: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 22 }, projectionSparkline: { width: 94, height: 43 }, projectionBasis: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5, lineHeight: 11 },
  volumeTrendCard: { position: 'relative', overflow: 'hidden', marginTop: 8, padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#342647', backgroundColor: '#07090E' }, volumeTrendHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, volumeTrendValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 22 }, volumeDelta: { alignItems: 'flex-end' }, volumeDeltaValue: { color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, volumeDeltaLabel: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7 }, volumeBars: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12, paddingTop: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderSubtle }, volumeBarColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }, volumeBar: { width: '70%', minHeight: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#514E5E' }, volumeBarCurrent: { backgroundColor: '#924CE3' }, volumeBarDate: { marginTop: 4, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 6.5 },
  detailCard: { marginTop: 8, padding: 13, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, reflectionHeader: { flexDirection: 'row', justifyContent: 'space-between' }, reflectionFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 9 }, factPill: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, color: SLColors.textSecondary, backgroundColor: SLColors.surfaceInset, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, textTransform: 'capitalize' }, quote: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 17 }, feedbackCard: { position: 'relative', overflow: 'hidden', marginTop: 8, padding: 14, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#4C316B', backgroundColor: '#07090E' }, feedbackHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, feedbackAvatar: { width: 43, height: 43, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#7248A0', backgroundColor: SLColors.accentSoft }, feedbackAvatarImage: { width: '100%', height: '100%' }, feedbackAvatarText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.display, fontSize: 11 }, feedbackIdentity: { flex: 1, marginLeft: 10 }, feedbackAuthor: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, feedbackQuote: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 }, reviewedBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(39,190,104,0.45)', backgroundColor: 'rgba(39,190,104,0.10)' }, reviewedBadgeText: { color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 7 },
  readinessPanel: { position: 'relative', overflow: 'hidden', marginTop: 8, padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#273647', backgroundColor: '#06070B' }, readinessGaugeRail: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 8 }, readinessGauge: { width: 72, alignItems: 'center' }, readinessGaugeVisual: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }, readinessGaugeValueWrap: { position: 'absolute', flexDirection: 'row', alignItems: 'baseline' }, readinessGaugeValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 14 }, readinessGaugeSuffix: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 6 }, readinessGaugeLabel: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 8 }, bodyweightEvidence: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard }, bodyweightValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 19 }, contextDisclaimer: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5, lineHeight: 11 },
  sparseHero: { position: 'relative', minHeight: 220, overflow: 'hidden', padding: 18, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#49305F', backgroundColor: '#07080E' }, sparseHeroArt: { position: 'absolute', right: -25, bottom: -22, width: 220, height: 220, opacity: 0.5 }, sparseHeroCopy: { zIndex: 2, width: '67%' }, sparseHeroTitle: { marginTop: 10, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 28, lineHeight: 32 }, sparseAthleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }, sparseEvidence: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, sparseEvidenceIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: SLColors.accentSoft }, sparseEvidenceCopy: { flex: 1 }, sparseEvidenceTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, sparseEvidenceBody: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 9, lineHeight: 14 },
  executionCard: { overflow: 'hidden', padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#30343E', backgroundColor: '#06080C' }, executionHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 }, executionHeadingText: { color: '#C36CFF', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.8 }, executionBody: { flexDirection: 'row', alignItems: 'center', marginTop: 12 }, executionMetrics: { flex: 1, minWidth: 0, flexDirection: 'row' }, executionMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', minHeight: 72, paddingHorizontal: 3, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#30333C' }, executionMetricValue: { fontFamily: SLFontFamilies.display, fontSize: 21 }, executionMetricLabel: { marginTop: 5, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 6.5, letterSpacing: 0.35, textAlign: 'center' }, executionDonut: { position: 'relative', width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, executionDonutCopy: { position: 'absolute', alignItems: 'center' }, executionDonutValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 19 }, executionDonutLabel: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 5.5, lineHeight: 7, textAlign: 'center' }, executionRail: { height: 7, flexDirection: 'row', overflow: 'hidden', marginTop: 9, borderRadius: 4, backgroundColor: '#242731' }, executionRailSegment: { minWidth: 0 }, executionFootnote: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8.5 },
  compareFilters: { gap: 7 }, compareFilter: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#30333D', backgroundColor: '#06080C' }, compareFilterSelected: { borderColor: '#A854E8', backgroundColor: '#251033' }, compareFilterDot: { width: 7, height: 7, borderRadius: 4 }, compareFilterText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, compareFilterTextSelected: { color: SLColors.textPrimary }, compareMovementStack: { gap: 8 },
  compareMovementCard: { overflow: 'hidden', borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#30343E', backgroundColor: '#06080C', ...SLShadows.level1 }, compareMovementCardExpanded: { borderColor: '#4B2A65' }, compareMovementHeader: { minHeight: 106, flexDirection: 'row', alignItems: 'center', padding: 10 }, compareArtwork: { width: 66, height: 76, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#372643', backgroundColor: '#100A16' }, compareArtworkImage: { width: 64, height: 72 }, compareManufacturer: { width: 62, height: 46, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginLeft: 6, borderRadius: 9, backgroundColor: '#080A0F' }, compareMovementCopy: { flex: 1, minWidth: 0, marginLeft: 8 }, compareMovementTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 15, lineHeight: 20 }, compareEquipment: { marginTop: 4, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 }, comparePrescription: { alignSelf: 'flex-start', marginTop: 6, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, color: '#CE7FFF', backgroundColor: '#21102D', fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, compareStateWrap: { width: 78, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 4 }, compareStateBadge: { maxWidth: 78, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 11, borderWidth: 1 }, compareStateText: { fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 0.25, textAlign: 'center' }, compareExpanded: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#292D36' },
  compareContextGrid: { padding: 11 }, compareMuscleColumn: { minHeight: 66, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292D36' }, compareProgramColumn: { minHeight: 78, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292D36' }, comparePerformedColumn: { minWidth: 0, paddingTop: 10 }, compareColumnKicker: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.5 }, compareMuscleRole: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.45 }, compareMuscleName: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12 }, compareProgramValue: { marginTop: 7, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 12 }, comparePlanNotes: { marginTop: 8, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 16 },
  compareSetHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 34, marginTop: 5 }, compareSetRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#262A33' }, compareTableLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 0.2 }, compareSetValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 11 }, compareSetMatched: { color: '#32D17C', fontFamily: SLFontFamilies.bodyBold }, compareSetNumber: { width: 30 }, compareSetNumberBadge: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1 }, compareSetNumberText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 }, compareLoad: { width: 70 }, compareReps: { width: 42 }, compareEffort: { width: 62 }, compareTarget: { flex: 1, minWidth: 64 }, targetBand: { flexDirection: 'row', alignItems: 'center', gap: 4 }, targetBandRail: { position: 'relative', flex: 1, height: 14, overflow: 'hidden', borderRadius: 4, backgroundColor: '#20232A' }, targetBandRange: { position: 'absolute', top: 2, bottom: 2, borderRadius: 3, borderWidth: 1, borderColor: '#9846D1', backgroundColor: '#35134B' }, targetBandMarker: { position: 'absolute', top: 1, width: 10, height: 12, marginLeft: -5, borderRadius: 6, borderWidth: 2, backgroundColor: '#F3F1F7' }, targetUnavailable: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 }, targetLegend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 }, targetLegendBand: { width: 17, height: 8, borderRadius: 3, borderWidth: 1, borderColor: '#9846D1', backgroundColor: '#35134B' }, targetLegendMarker: { width: 9, height: 9, marginLeft: 4, borderRadius: 5, borderWidth: 2, borderColor: SLColors.textPrimary, backgroundColor: '#F3F1F7' }, targetLegendText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10 },
  compareLastTime: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#292D36' }, compareLastTimeCopy: { flex: 1, minWidth: 0 }, compareLastTimeLabel: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.65 }, compareLastTimeValue: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 17 }, comparisonLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 4, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#272A32' }, comparisonLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, comparisonLegendText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10 },
  planNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.accentSoft }, planNoticeText: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10, lineHeight: 15 }, planStack: { gap: 9, marginTop: 10, marginBottom: 10 }, planRow: { flexDirection: 'row', padding: 13, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, planIndex: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: SLColors.surfaceInset }, planIndexText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.display, fontSize: 9 }, planCopy: { flex: 1, minWidth: 0, marginLeft: 10 }, planTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, substitutionLabel: { marginTop: 4, color: SLColors.warning, fontFamily: SLFontFamilies.bodyBold, fontSize: 7.5 }, compareLabel: { marginTop: 8, color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 7, letterSpacing: 0.8 }, planPrescription: { marginTop: 2, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 }, performedPrescription: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, lineHeight: 15 }, planNotes: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 9, lineHeight: 14 },
  coachToolsCard: { marginTop: 8, padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#315D79', backgroundColor: '#07101A' }, fieldLabel: { marginTop: 8, marginBottom: 5, color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.75 }, textarea: { minHeight: 96, padding: 11, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderStandard, color: SLColors.textPrimary, backgroundColor: '#05080E', fontFamily: SLFontFamilies.body, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' }, reviewChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, reviewChoice: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset }, reviewChoiceSelected: { borderColor: SLColors.borderSelected, backgroundColor: SLColors.accentSoft }, reviewChoiceText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 }, reviewChoiceTextSelected: { color: SLColors.accentMuted }, followupGroup: { marginTop: 8 }, reviewToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle }, reviewToggleText: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 13 }, reviewActions: { flexDirection: 'row', gap: 8, marginTop: 10 }, reviewSecondary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.surfaceInset }, reviewSecondaryText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, reviewPrimary: { flex: 1.4, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: SLRadius.md, backgroundColor: SLColors.accentViolet }, reviewPrimaryText: { color: SLColors.white, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 },
  canonicalContent: { gap: 12 },
  canonicalHero: { position: 'relative', minHeight: 326, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: '#4D286B', backgroundColor: '#07080E' },
  canonicalHeroAnatomy: { position: 'absolute', top: -24, right: -18, width: 205, height: 222, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 0.67 }] },
  canonicalHeroArchiveArt: { position: 'absolute', top: -8, right: -18, width: 205, height: 205, opacity: 0.58 },
  canonicalHeroShade: { position: 'absolute', top: 0, left: 0, bottom: 124, width: '82%' },
  canonicalHeroCopy: { zIndex: 2, width: '66%', minHeight: 202, padding: 15 },
  completedBadge: { alignSelf: 'flex-start', minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(47,203,115,0.42)', backgroundColor: 'rgba(24,122,70,0.14)' },
  completedBadgeText: { color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.8 },
  canonicalHeroTitle: { marginTop: 10, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 28, lineHeight: 31 },
  sessionTimes: { marginTop: 9, color: '#B4BAC5', fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 17 },
  canonicalHeroMetrics: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 124, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(174,104,255,0.28)', backgroundColor: 'rgba(4,5,9,0.95)' },
  compactHighlightRail: { flexDirection: 'row', gap: 6 },
  compactHighlight: { flex: 1, minWidth: 0, minHeight: 110, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 8, borderRadius: 13, borderWidth: 1, borderColor: '#2F3340', backgroundColor: '#07090E' },
  compactHighlightArt: { width: 44, height: 44, marginBottom: 4 }, compactHighlightCopy: { minWidth: 0, alignItems: 'center' }, compactHighlightLabel: { fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 0.45, textAlign: 'center' }, compactHighlightValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 16, textAlign: 'center' }, compactHighlightDetail: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 9.5, lineHeight: 13, textAlign: 'center' },
  personalBestHero: { position: 'relative', minHeight: 196, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#705017', backgroundColor: '#07080C' },
  personalBestHeroArt: { width: '48%', height: 186, marginLeft: -6 },
  personalBestHeroCopy: { flex: 1, minWidth: 0, paddingVertical: 18, paddingRight: 16 },
  personalBestHeroKicker: { color: '#E4AD37', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.9 },
  personalBestHeroValue: { marginTop: 6, color: '#FFD263', fontFamily: SLFontFamilies.display, fontSize: 36, lineHeight: 38 },
  personalBestHeroTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 20, lineHeight: 24 },
  personalBestHeroDetail: { marginTop: 7, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 17 },
  personalBestStack: { gap: 10 },
  personalBestCard: { position: 'relative', overflow: 'hidden', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#5A4320', backgroundColor: '#07090E' },
  personalBestHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personalBestArtwork: { width: 82, height: 82, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#4B315D', backgroundColor: '#0B0C12' },
  personalBestFallbackArt: { width: 72, height: 72 },
  personalBestIdentity: { flex: 1, minWidth: 0 },
  personalBestMovement: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 18, lineHeight: 22 },
  personalBestType: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, color: '#FFD263', backgroundColor: 'rgba(214,151,38,0.12)', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.65 },
  personalBestEquipment: { marginTop: 6, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 },
  personalBestMiniCrest: { width: 42, height: 42 },
  personalBestResult: { marginTop: 12, padding: 12, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#654A20', backgroundColor: 'rgba(111,73,13,0.11)' },
  personalBestResultLabel: { color: '#D5A644', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.7 },
  personalBestResultValue: { marginTop: 5, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 22, lineHeight: 27 },
  personalBestDerivedFrom: { marginTop: 5, color: '#C9B1DA', fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 16 },
  personalBestPriorRail: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4, paddingTop: 10 },
  personalBestPriorCopy: { flex: 1, minWidth: 0 },
  personalBestPriorLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.65 },
  personalBestPriorValue: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 },
  personalBestPriorDate: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 },
  personalBestDelta: { maxWidth: '48%', color: SLColors.success, fontFamily: SLFontFamilies.display, fontSize: 16, lineHeight: 21, textAlign: 'right' },
  personalBestTrend: { marginTop: 4, padding: 9, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#31283D', backgroundColor: '#05070B' },
  personalBestTrendLabel: { marginBottom: 5, color: '#C37BFF', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.65 },
  personalBestFirstInstance: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#5A4320', backgroundColor: 'rgba(111,73,13,0.09)' },
  personalBestFirstInstanceCopy: { flex: 1, minWidth: 0 },
  personalBestFirstInstanceTitle: { color: '#E2B55A', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.65 },
  personalBestFirstInstanceBody: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 15 },
  canonicalSection: { gap: 8 }, canonicalSectionHeading: { minHeight: 30, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, paddingHorizontal: 5 }, canonicalSectionTitle: { color: '#C378FF', fontFamily: SLFontFamilies.bodyBold, fontSize: 12, letterSpacing: 0.8 }, canonicalSectionMeta: { flex: 1, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 14, textAlign: 'right' },
  sessionReadCard: { overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#343846', backgroundColor: '#07090E', padding: 9 }, canonicalMetricGrid: { flexDirection: 'row', flexWrap: 'wrap' }, canonicalMetricTile: { width: '50%', minHeight: 112, flexDirection: 'row', gap: 8, padding: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252936' }, canonicalMetricIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, canonicalMetricCopy: { flex: 1, minWidth: 0 }, canonicalMetricLabel: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' }, canonicalMetricValue: { marginTop: 4, fontFamily: SLFontFamilies.bodyBold, fontSize: 13, lineHeight: 18 }, canonicalMetricDetail: { marginTop: 5, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 15 },
  durationRead: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: '#26475A', backgroundColor: 'rgba(20,72,92,0.14)' }, durationReadIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(83,203,232,0.12)' }, durationReadCopy: { flex: 1 }, durationReadValue: { color: '#EAFBFF', fontFamily: SLFontFamilies.display, fontSize: 18 }, durationReadDetail: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 17 }, sessionNarrative: { marginTop: 9, padding: 12, borderRadius: 11, backgroundColor: 'rgba(119,62,177,0.12)', color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 14, lineHeight: 20 },
  changedCard: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F' }, changedRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#272B34' }, changedLabel: { width: 108, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, changedValue: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 17, textAlign: 'right' },
  recoveryCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F', padding: 10 }, recoveryReadLabel: { color: '#FF9A42', fontFamily: SLFontFamilies.display, fontSize: 20, lineHeight: 24 }, recoverySummary: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 13, lineHeight: 18 }, recoverySelector: { flexDirection: 'row', gap: 5, marginTop: 10, marginBottom: 8 }, recoverySelectorButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#2C303B', backgroundColor: '#080A0F' }, recoverySelectorButtonActive: { borderColor: '#8B47C1', backgroundColor: '#241132' }, recoverySelectorText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, recoverySelectorTextActive: { color: '#E7CCFF' }, reflectionMetricRail: { flexDirection: 'row', flexWrap: 'wrap' }, athleteReflectionNote: { marginTop: 9, padding: 11, borderRadius: 11, backgroundColor: 'rgba(224,91,216,0.1)', flexDirection: 'row', gap: 8 }, athleteReflectionNoteText: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 13, lineHeight: 19 },
  bodyweightContextCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#26475A', backgroundColor: '#071018' }, bodyweightContextValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 20 }, bodyweightContextDetail: { maxWidth: 280, marginTop: 4, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 15 },
  premiumEmpty: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#2B2E38', backgroundColor: '#07090E' }, premiumEmptyCopy: { flex: 1 }, premiumEmptyTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, premiumEmptyBody: { marginTop: 4, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 16 },
  coachReadCard: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F' }, coachReadRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292D36' }, coachReadLabel: { width: 76, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 12 }, coachReadValue: { flex: 1, fontFamily: SLFontFamilies.bodyBold, fontSize: 12, lineHeight: 17, textAlign: 'right' }, coachAttentionCard: { borderRadius: 14, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F', padding: 7 }, coachAttentionRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 7 }, coachAttentionIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: 'rgba(255,92,83,0.12)', alignItems: 'center', justifyContent: 'center' }, coachAttentionText: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 13, lineHeight: 18 }, programmingAction: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: '#6C3A92', backgroundColor: '#0A0810' }, programmingActionCopy: { flex: 1 }, programmingActionTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, programmingActionDetail: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 },
  trendDetailCopy: { flex: 1, minWidth: 0 }, limitedHistoryCard: { margin: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2B2F3A', backgroundColor: '#07090E' }, limitedHistoryTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, limitedHistoryBody: { marginTop: 4, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8, lineHeight: 12 },
  toolsBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' }, toolsSheet: { width: '100%', maxHeight: '84%', overflow: 'hidden', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: '#3A3E49', backgroundColor: '#0A0C12' }, toolsHandle: { alignSelf: 'center', width: 42, height: 4, marginTop: 9, borderRadius: 2, backgroundColor: '#5B5F6B' }, toolsHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B2F38' }, toolsTitle: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 17 }, toolsClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#12151C' }, toolsContent: { paddingBottom: 28 }, toolRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#262A33' }, toolIcon: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#343846', backgroundColor: '#11141B' }, toolCopy: { flex: 1, minWidth: 0 }, toolLabel: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, toolDetail: { marginTop: 4, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8, lineHeight: 12 }, toolSubsection: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#343843' }, toolSubsectionTitle: { paddingHorizontal: 13, paddingTop: 13, paddingBottom: 4, color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.8 },
  nextActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, actionButton: { flexGrow: 1, minWidth: 105, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080A10' }, actionButtonPrimary: { borderColor: SLColors.accentViolet, backgroundColor: SLColors.accentViolet }, actionButtonText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, actionButtonTextPrimary: { color: SLColors.white },
});
