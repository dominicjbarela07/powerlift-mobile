import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
import { MuscleMap } from '@/components/anatomy/MuscleMap';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { Text, TextInput } from '@/components/ui/sl-text';
import { FloatingControlCoordinator, FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { ManufacturerBrandMark } from '@/components/workout-logger/manufacturer-brand-mark';
import { SLColors, SLFontFamilies, SLRadius, SLShadows } from '@/constants/theme';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { CANONICAL_CORE_MOVEMENT_ARTWORK } from '@/lib/canonical-movement-artwork-assets';
import { resolveCanonicalMovementArtwork, type CanonicalMovementArtworkInput } from '@/lib/canonical-movement-artwork';
import { API_BASE } from '@/lib/api';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';
import {
  formatCompactVolumeValueFromKg,
  formatWeightDeltaFromKg,
  formatWeightFromKg,
  type DisplayWeightUnit,
} from '@/lib/display-units';
import {
  SESSION_RECAP_ARCHIVE_ART,
  sessionRecapHighlightAsset,
  sessionRecapVideoFixtureAsset,
  type SessionRecapHighlightKind,
} from '@/lib/session-recap-assets';
import { setCompletedSessionRecapOpen } from '@/lib/session-editor-overlay-state';
import { equipmentPresentationLabel, equipmentPresentationParts } from '@/lib/equipment-presentation';
import {
  buildSessionRecapTrendPlot,
  formatSessionRecapTrendDelta,
  formatSessionRecapTrendValue,
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
  } | null;
  projection?: {
    metric?: string | null;
    value_kg?: number | null;
    method?: string | null;
    source_set_log_id?: number | null;
    label?: string | null;
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
  initialShowAllMovements?: boolean;
  initialScrollOffsetY?: number;
  initialExpandedItemId?: number;
  viewerMode?: 'athlete' | 'coach';
  coachReview?: CoachReviewContext | null;
  coachReviewUnavailableReason?: string | null;
  onViewLedger?: () => void;
  onViewCalendar?: () => void;
  onLogNextSession?: () => void;
  onOpenProgramming?: () => void;
  onOpenMovementHistory?: (movement: CompletedRecapMovement, displayUnit: DisplayWeightUnit) => void;
};

type RecapTab = 'performed' | 'plan';

const INITIAL_MOVEMENT_COUNT = 6;
const CANONICAL_PR_EVENT_TYPES = new Set([
  'CORE_E1RM_PR', 'CORE_WEIGHT_PR', 'CORE_REP_MAX_PR', 'CORE_RPE_PR',
  'CORE_SAME_WEIGHT_REP_PR', 'CORE_BLOCK_E1RM_BEST', 'CORE_BLOCK_WEIGHT_BEST',
  'CORE_BLOCK_REP_MAX_BEST', 'CORE_BLOCK_SAME_WEIGHT_REP_BEST',
]);

function numberLabel(value: unknown, decimals = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(decimals).replace(/\.0$/, '');
}

function durationLabel(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null;
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

function normalizedEvidenceLabel(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function accomplishmentItemId(row: Record<string, any>) {
  const parsed = Number(row.workout_item_id ?? row.source?.workout_item_id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function accomplishmentSetLogId(row: Record<string, any>) {
  const parsed = Number(row.source_set_log_id ?? row.trigger_set_log_id ?? row.source?.set_log_id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function accomplishmentMatchesMovement(row: Record<string, any>, movement: CompletedRecapMovement) {
  const itemId = accomplishmentItemId(row);
  if (itemId != null && movement.item_id != null) return itemId === Number(movement.item_id);
  const label = normalizedEvidenceLabel(row.movement_label ?? row.source?.movement_label);
  return !!label && label === normalizedEvidenceLabel(movement.label);
}

function formatMuscle(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function movementArtworkInput(movement: CompletedRecapMovement): CanonicalMovementArtworkInput {
  return {
    ...movement,
    kind: movement.kind,
    movement_definition_id: movement.history_diagnostics?.movement_definition_id,
  };
}

function movementArtworkSource(movement: CompletedRecapMovement) {
  const resolution = resolveCanonicalMovementArtwork(movementArtworkInput(movement));
  if (resolution.kind === 'accessory') return accessoryMuscleRegionAsset(resolution.regionKey).source;
  if (resolution.kind === 'core' || resolution.kind === 'core_variant') {
    return CANONICAL_CORE_MOVEMENT_ARTWORK[resolution.family];
  }
  return null;
}

function MovementArtwork({ movement }: { movement: CompletedRecapMovement }) {
  return <CanonicalMovementArtwork movement={movementArtworkInput(movement)} size={72} testID="completed-recap-canonical-movement-artwork" />;
}

function setVideoId(set?: CompletedRecapSet | null) {
  return Number(set?.video_attachment_id || set?.video_id || set?.video?.id || 0);
}

function setResultLabel(set: Pick<CompletedRecapSet, 'actual_weight_kg' | 'actual_reps'>, movement: CompletedRecapMovement, unit: DisplayWeightUnit) {
  const type = String(movement.measurement?.measurement_type || 'load_reps').toLowerCase();
  const load = formatWeightFromKg(set.actual_weight_kg, unit) || null;
  const reps = Number(set.actual_reps);
  const repsLabel = Number.isFinite(reps) && reps > 0 ? numberLabel(reps, 0) : '—';
  if (type === 'bodyweight_reps') return `Bodyweight × ${repsLabel}`;
  if (type.includes('assisted')) return `${load || 'Assistance'} assistance × ${repsLabel}`;
  if (type.includes('added_weight') || type.includes('weighted_bodyweight')) return `BW${load ? ` + ${load}` : ''} × ${repsLabel}`;
  if (type === 'duration' || type === 'time') return `${repsLabel} sec`;
  if (type.includes('distance')) return [load, `${repsLabel} m`].filter(Boolean).join(' · ');
  if (!load && repsLabel !== '—') return `${repsLabel} reps`;
  return load ? `${load} × ${repsLabel}` : 'Performance unavailable';
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
    return <View style={styles.sparklineEmpty}><Text style={styles.sparklineEmptyText}>{plot.points.length === 1 ? 'FIRST COMPARABLE PERFORMANCE' : 'COMPARISON UNAVAILABLE'}</Text></View>;
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

function SummaryMetric({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  return <View style={styles.summaryMetric}><Ionicons name={icon} size={18} color={SLColors.accentMuted} /><View style={styles.summaryMetricCopy}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryMetricValue}>{value}</Text><Text style={styles.summaryMetricLabel}>{label}</Text></View></View>;
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
  return <View style={styles.videoEvidencePreview}>{thumbnail ? <Image accessibilityIgnoresInvertColors resizeMode="cover" source={thumbnail} style={styles.videoThumbnail} /> : null}<LinearGradient colors={['transparent', 'rgba(2,3,6,0.9)']} style={StyleSheet.absoluteFillObject} /><View style={styles.videoEvidencePlay}><Ionicons name="play" size={8} color={SLColors.textPrimary} /></View><Text style={styles.videoEvidenceLabel}>SET {set.set_index || '—'}</Text></View>;
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

function PerformedMovementCard({ movement, unit, onVideo, onOpenHistory, initialExpanded = false }: { movement: CompletedRecapMovement; unit: DisplayWeightUnit; onVideo: (set: CompletedRecapSet) => void; onOpenHistory?: (movement: CompletedRecapMovement) => void; initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded);
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
          <View style={styles.movementEvidenceRow}><View style={styles.bestSetCopy}><Text style={styles.bestSetLabel}>{movement.sets.length} SET{movement.sets.length === 1 ? '' : 'S'} · BEST SET</Text><Text numberOfLines={1} style={styles.bestSetValue}>{bestAsSet ? setResultLabel(bestAsSet, movement, unit) : `${movement.sets.length} performed set${movement.sets.length === 1 ? '' : 's'}`}</Text>{bestAsSet && effortLabel(bestAsSet) ? <Text style={styles.bestSetEffort}>{effortLabel(bestAsSet)}</Text> : null}</View><View style={styles.sparklineWrap}><MovementTrendChart compact trend={movement.trend} unit={unit} />{delta && Number(movement.trend?.delta_value ?? movement.trend?.delta_kg) !== 0 ? <Text style={[styles.delta, delta.startsWith('↑') ? styles.deltaUp : styles.deltaDown]}>{delta}</Text> : null}</View></View>
          <View style={styles.movementMetaRail}>{trendBadge ? <Text style={styles.movementMeta}>{trendBadge}</Text> : null}{videoSets.length ? <Text style={styles.movementMeta}>{videoSets.length} VIDEO{videoSets.length === 1 ? '' : 'S'}</Text> : null}{equipment[0]?.model ? <Text numberOfLines={1} style={styles.movementMeta}>{equipment[0].model.toUpperCase()}</Text> : null}</View>
        </View>
      </Pressable>
      {expanded ? <View style={styles.expandedEvidence}>
        {bestAsSet && setVideoId(bestAsSet) > 0 ? <Pressable accessibilityRole="button" onPress={() => onVideo(bestAsSet)} style={({ pressed }) => [styles.bestVideoCard, pressed && styles.pressed]}><View style={styles.bestVideoMedia}>{videoThumbnailSource(bestAsSet, movementArtworkSource(movement)) ? <Image accessibilityIgnoresInvertColors resizeMode="cover" source={videoThumbnailSource(bestAsSet, movementArtworkSource(movement))!} style={styles.videoThumbnail} /> : null}<LinearGradient colors={['transparent', 'rgba(2,3,6,0.88)']} style={StyleSheet.absoluteFillObject} /><View style={styles.bestVideoPlay}><Ionicons name="play" size={16} color={SLColors.textPrimary} /></View><Text style={styles.bestVideoOverlay}>SET {bestAsSet.set_index || '—'}</Text></View><View style={styles.bestVideoCopy}><Text style={styles.detailKicker}>BEST SET VIDEO</Text><Text style={styles.bestVideoValue}>{setResultLabel(bestAsSet, movement, unit)}</Text><Text style={styles.detailMeta}>Exact SetLog evidence · tap to review</Text></View><Ionicons name="expand-outline" size={19} color={SLColors.textSecondary} /></Pressable> : null}
        <View style={styles.setTable}><View style={styles.setHeader}><Text style={[styles.columnLabel, styles.setNumberColumn]}>SET</Text><Text style={[styles.columnLabel, styles.resultColumn]}>RESULT</Text><Text style={[styles.columnLabel, styles.effortColumn]}>EFFORT</Text><View style={styles.videoColumn} /></View>{movement.sets.map((set, index) => <View key={set.id || index} style={styles.setRow}><Text style={[styles.setValue, styles.setNumberColumn]}>{set.set_index || index + 1}</Text><View style={styles.resultColumnRow}><Text numberOfLines={1} style={styles.setValueStrong}>{setResultLabel(set, movement, unit)}</Text>{set.has_pr ? <Text style={styles.setPr}>PR</Text> : null}</View><Text style={[styles.setValue, styles.effortColumn]}>{effortLabel(set) || '—'}</Text><View style={styles.videoColumn}>{setVideoId(set) > 0 ? <SetVideoButton set={set} fallbackSource={movementArtworkSource(movement)} onPress={() => onVideo(set)} /> : null}</View></View>)}</View>
        {(movement.trend?.points?.length || 0) >= 2 ? <View style={styles.trendDetail}><View style={styles.trendDetailHeader}><View><Text style={styles.detailKicker}>{movement.trend?.metric_label?.toUpperCase() || 'BEST SET TREND'} · EXACT MOVEMENT</Text><Text style={styles.detailMeta}>{movement.trend?.state === 'limited_history' ? 'Two comparable Sessions' : `${movement.trend?.points?.length || 0} comparable Sessions`}</Text></View>{delta ? <Text style={[styles.trendDeltaValue, delta.startsWith('↑') ? styles.deltaUpText : styles.deltaDownText]}>{delta}</Text> : null}</View><MovementTrendChart trend={movement.trend} unit={unit} /></View> : null}
        {movement.kind === 'accessory' && movement.measurement?.canonical_identity_id && onOpenHistory ? <Pressable accessibilityRole="button" accessibilityLabel={`Open exact Movement History for ${movement.label}`} onPress={() => onOpenHistory(movement)} style={({ pressed }) => [styles.historyAction, pressed && styles.pressed]}><View><Text style={styles.historyActionLabel}>MOVEMENT HISTORY</Text><Text style={styles.historyActionDetail}>Canonical exact-movement evidence</Text></View><Ionicons name="analytics-outline" size={18} color={SLColors.accentMuted} /></Pressable> : null}
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

function ComparisonFilterBar({ filter, rows, onChange }: { filter: PlanCompareFilter; rows: PlanComparisonRow[]; onChange: (filter: PlanCompareFilter) => void }) {
  const summary = summarizeSessionRecapExecution(rows);
  const filters: { key: PlanCompareFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: rows.length, color: '#B66CFF' },
    { key: 'matched', label: 'Matched', count: summary.matchedSetCount, color: '#32D17C' },
    { key: 'differences', label: 'Differences', count: summary.differenceSetCount, color: '#F4A62A' },
    { key: 'not_logged', label: 'Not Logged', count: summary.notLoggedSetCount, color: '#858895' },
  ];
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compareFilters}>{filters.map((item) => {
    const selected = filter === item.key;
    return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(item.key)} style={({ pressed }) => [styles.compareFilter, selected && styles.compareFilterSelected, pressed && styles.pressed]}><View style={[styles.compareFilterDot, { backgroundColor: item.color }]} /><Text style={[styles.compareFilterText, selected && styles.compareFilterTextSelected]}>{item.label} ({item.count})</Text></Pressable>;
  })}</ScrollView>;
}

function TargetBand({ comparison }: { comparison: SessionRecapSetComparison }) {
  const reps = comparison.performed?.actual_reps == null ? null : Number(comparison.performed.actual_reps);
  const geometry = sessionRecapTargetGeometry(comparison.plan.repLow, comparison.plan.repHigh, reps);
  if (!geometry || !comparison.performed) return <Text style={styles.targetUnavailable}>—</Text>;
  const presentation = COMPARISON_PRESENTATION[comparison.kind];
  return <View style={styles.targetBand}>
    <View style={styles.targetBandRail}>
      <View style={[styles.targetBandRange, { left: `${geometry.targetStart}%`, width: `${geometry.targetWidth}%` }]} />
      <View style={[styles.targetBandMarker, { left: `${geometry.marker}%`, borderColor: presentation.color }]} />
    </View>
    <Ionicons name={presentation.icon} size={18} color={presentation.color} />
  </View>;
}

function PlanComparisonCard({ row, expanded, unit, onToggle, onOpenHistory }: { row: PlanComparisonRow; expanded: boolean; unit: DisplayWeightUnit; onToggle: () => void; onOpenHistory?: (movement: CompletedRecapMovement) => void }) {
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
        <View style={styles.compareMuscleColumn}><Text style={styles.compareColumnKicker}>TRAINING FOCUS</Text><View style={styles.compareLargeArtwork}>{artwork ? <Image accessibilityIgnoresInvertColors resizeMode="contain" source={artwork} style={styles.compareLargeArtworkImage} /> : null}</View>{muscles[0] ? <><Text style={styles.compareMuscleRole}>PRIMARY</Text><Text style={styles.compareMuscleName}>{muscles[0]}</Text></> : null}{muscles[1] ? <><Text style={styles.compareMuscleRole}>SECONDARY</Text><Text style={styles.compareMuscleName}>{muscles[1]}</Text></> : null}</View>
        <View style={styles.compareProgramColumn}><Text style={[styles.compareColumnKicker, { color: '#C26EFF' }]}>PROGRAMMED</Text><Text style={styles.compareProgramValue}>{plan ? `${numberLabel(plan.sets, 0)} sets` : 'No plan row'}</Text><Text style={styles.compareProgramValue}>{row.comparisons[0] ? plannedRepLabel(row.comparisons[0]) : 'Open reps'}</Text>{row.comparisons[0] && plannedEffortLabel(row.comparisons[0]) ? <Text style={styles.compareProgramValue}>{plannedEffortLabel(row.comparisons[0])}</Text> : null}{plan?.notes ? <Text style={styles.comparePlanNotes}>{plan.notes}</Text> : null}</View>
        <View style={styles.comparePerformedColumn}><Text style={[styles.compareColumnKicker, { color: '#38C8F4' }]}>PERFORMED</Text><View style={styles.compareSetHeader}><Text style={[styles.compareTableLabel, styles.compareSetNumber]}>SET</Text><Text style={[styles.compareTableLabel, styles.compareLoad]}>LOAD</Text><Text style={[styles.compareTableLabel, styles.compareReps]}>REPS</Text><Text style={[styles.compareTableLabel, styles.compareEffort]}>EFFORT</Text><Text style={[styles.compareTableLabel, styles.compareTarget]}>COMPARE TO PLAN</Text></View>{row.comparisons.map((comparison) => {
          const performed = comparison.performed;
          const presentation = COMPARISON_PRESENTATION[comparison.kind];
          return <View key={comparison.setIndex} style={styles.compareSetRow}><View style={styles.compareSetNumber}><View style={[styles.compareSetNumberBadge, { borderColor: `${presentation.color}88` }]}><Text style={styles.compareSetNumberText}>{comparison.setIndex}</Text></View></View><Text numberOfLines={1} style={[styles.compareSetValue, styles.compareLoad]}>{performed ? (formatWeightFromKg(performed.actual_weight_kg, unit) || '—') : '—'}</Text><Text style={[styles.compareSetValue, styles.compareReps, comparison.kind === 'matched' && styles.compareSetMatched]}>{performed?.actual_reps ?? '—'}</Text><Text numberOfLines={1} style={[styles.compareSetValue, styles.compareEffort]}>{performed ? (effortLabel(performed) || '—') : '—'}</Text><View style={styles.compareTarget}><TargetBand comparison={comparison} /></View></View>;
        })}<View style={styles.targetLegend}><View style={styles.targetLegendBand} /><Text style={styles.targetLegendText}>Target range</Text><View style={styles.targetLegendMarker} /><Text style={styles.targetLegendText}>Your performance</Text></View></View>
      </View>
      <Pressable disabled={!movement || !onOpenHistory} accessibilityRole="button" accessibilityLabel={`Open exact history for ${title}`} onPress={() => movement && onOpenHistory?.(movement)} style={({ pressed }) => [styles.compareLastTime, pressed && styles.pressed]}><Ionicons name="time-outline" size={21} color={SLColors.accentMuted} /><View style={styles.compareLastTimeCopy}><Text style={styles.compareLastTimeLabel}>LAST TIME</Text><Text numberOfLines={2} style={styles.compareLastTimeValue}>{previous && movement ? `${setResultLabel({ actual_weight_kg: previous.weight_kg, actual_reps: previous.reps }, movement, unit)}${previous.rir != null ? ` @ ${numberLabel(previous.rir)} RIR` : previous.rpe != null ? ` @ RPE ${numberLabel(previous.rpe)}` : ''} · ${dateLabel(previous.date)}` : 'No previous exact exposure'}</Text></View>{movement && onOpenHistory ? <Ionicons name="chevron-forward" size={20} color={SLColors.textSecondary} /> : null}</Pressable>
    </View> : null}
  </View>;
}

function PlanCompareExperience({ recap, performedMovements, unit, onOpenHistory }: { recap: CompletedSessionRecapPayload; performedMovements: CompletedRecapMovement[]; unit: DisplayWeightUnit; onOpenHistory?: (movement: CompletedRecapMovement) => void }) {
  const rows = useMemo(() => buildSessionRecapComparisons(recap.plan.movements, performedMovements) as PlanComparisonRow[], [performedMovements, recap.plan.movements]);
  const [filter, setFilter] = useState<PlanCompareFilter>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(() => rows[0]?.key || null);
  const filtered = useMemo(() => filterSessionRecapComparisons(rows, filter), [filter, rows]);
  useEffect(() => {
    if (expandedKey && !filtered.some((row) => row.key === expandedKey)) setExpandedKey(filtered[0]?.key || null);
  }, [expandedKey, filtered]);
  return <>
    <View style={styles.sectionShell}><ExecutionSummary rows={rows} /></View>
    <ComparisonFilterBar filter={filter} rows={rows} onChange={setFilter} />
    <View style={styles.compareMovementStack}>{filtered.map((row) => <PlanComparisonCard key={row.key} row={row} expanded={expandedKey === row.key} unit={unit} onToggle={() => setExpandedKey((current) => current === row.key ? null : row.key)} onOpenHistory={onOpenHistory} />)}{!filtered.length ? <View style={styles.emptyCard}><Ionicons name="filter-outline" size={25} color={SLColors.textMuted} /><Text style={styles.emptyTitle}>No movements in this filter</Text><Text style={styles.emptyBody}>The selected comparison state does not occur in this Session.</Text></View> : null}</View>
    {recap.plan.programming_notes ? <View style={styles.sectionShell}><View style={styles.detailCard}><Text style={styles.detailKicker}>PROGRAMMING NOTES</Text><Text style={styles.quote}>{recap.plan.programming_notes}</Text></View></View> : null}
    <View style={styles.comparisonLegend}>{(['matched', 'above_target', 'below_target', 'different_load', 'not_logged'] as SessionRecapComparisonKind[]).map((kind) => <View key={kind} style={styles.comparisonLegendItem}><Ionicons name={COMPARISON_PRESENTATION[kind].icon} size={15} color={COMPARISON_PRESENTATION[kind].color} /><Text style={styles.comparisonLegendText}>{COMPARISON_PRESENTATION[kind].label}</Text></View>)}</View>
  </>;
}

function ReviewChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.reviewChoice, selected && styles.reviewChoiceSelected]}><Text style={[styles.reviewChoiceText, selected && styles.reviewChoiceTextSelected]}>{label}</Text></Pressable>;
}

function ReviewToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return <View style={styles.reviewToggle}><Text style={styles.reviewToggleText}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: SLColors.borderStandard, true: SLColors.accentSoft }} thumbColor={value ? SLColors.accentViolet : SLColors.textMuted} /></View>;
}

function CoachTools({ review }: { review: CoachReviewContext }) {
  const [draft, setDraft] = useState(review.draft);
  useEffect(() => setDraft(review.draft), [review.draft]);
  const update = <K extends keyof CoachReviewDraft>(key: K, value: CoachReviewDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <View style={styles.sectionShell}><Text style={styles.sectionLabel}>COACH REVIEW TOOLS</Text><View style={styles.coachToolsCard}><Text style={styles.fieldLabel}>ATHLETE FEEDBACK</Text><TextInput multiline value={draft.coach_feedback} onChangeText={(value) => update('coach_feedback', value)} placeholder="Write actionable feedback…" placeholderTextColor={SLColors.textMuted} style={styles.textarea} /><Text style={styles.fieldLabel}>PRIVATE COACH NOTE</Text><TextInput multiline value={draft.coach_note} onChangeText={(value) => update('coach_note', value)} placeholder="Private programming context…" placeholderTextColor={SLColors.textMuted} style={styles.textarea} />{review.outcomes?.length ? <><Text style={styles.fieldLabel}>OUTCOME</Text><View style={styles.reviewChoices}>{review.outcomes.map((row) => <ReviewChoice key={row.value} label={row.label} selected={draft.review_outcome === row.value} onPress={() => update('review_outcome', draft.review_outcome === row.value ? '' : row.value)} />)}</View></> : null}{review.priorities?.length ? <><Text style={styles.fieldLabel}>PRIORITY</Text><View style={styles.reviewChoices}>{review.priorities.map((row) => <ReviewChoice key={row.value} label={row.label} selected={draft.review_priority === row.value} onPress={() => update('review_priority', draft.review_priority === row.value ? '' : row.value)} />)}</View></> : null}<View style={styles.followupGroup}><ReviewToggle label="Adjust programming" value={draft.followup_adjust_programming} onChange={(value) => update('followup_adjust_programming', value)} /><ReviewToggle label="Message athlete" value={draft.followup_message_athlete} onChange={(value) => update('followup_message_athlete', value)} /><ReviewToggle label="Consider training max update" value={draft.followup_consider_tm} onChange={(value) => update('followup_consider_tm', value)} /><ReviewToggle label="Monitor next Session" value={draft.followup_monitor_next} onChange={(value) => update('followup_monitor_next', value)} /><ReviewToggle label="Send feedback as message" value={draft.send_feedback_message} onChange={(value) => update('send_feedback_message', value)} /></View><View style={styles.reviewActions}><Pressable disabled={!!review.saving} onPress={() => review.onSave(draft, 'save')} style={({ pressed }) => [styles.reviewSecondary, pressed && styles.pressed]}>{review.saving === 'save' ? <ActivityIndicator color={SLColors.accentMuted} /> : <Text style={styles.reviewSecondaryText}>Save Draft</Text>}</Pressable><Pressable disabled={!!review.saving} onPress={() => review.onSave(draft, 'complete')} style={({ pressed }) => [styles.reviewPrimary, pressed && styles.pressed]}>{review.saving === 'complete' ? <ActivityIndicator color={SLColors.white} /> : <><Ionicons name="checkmark" size={20} color={SLColors.white} /><Text style={styles.reviewPrimaryText}>Complete Review</Text></>}</Pressable></View></View></View>;
}

function ActionButton({ icon, label, primary, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; primary?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, primary && styles.actionButtonPrimary, pressed && styles.pressed]}><Ionicons name={icon} size={18} color={primary ? SLColors.white : SLColors.textSecondary} /><Text style={[styles.actionButtonText, primary && styles.actionButtonTextPrimary]}>{label}</Text></Pressable>;
}

export function CompletedSessionRecap({ recap, impactSummary, preferredUnits, refreshing, onRefresh, onClose, onDone, initialTab = 'performed', initialShowAllMovements = false, initialScrollOffsetY = 0, initialExpandedItemId, viewerMode = 'athlete', coachReview, coachReviewUnavailableReason, onViewLedger, onViewCalendar, onLogNextSession, onOpenProgramming, onOpenMovementHistory }: Props) {
  const insets = useSafeAreaInsets();
  const { unit, setUnit } = useSurfaceWeightUnit(preferredUnits);
  const [tab, setTab] = useState<RecapTab>(initialTab);
  const [showAllMovements, setShowAllMovements] = useState(initialShowAllMovements);
  const [showAccomplishments, setShowAccomplishments] = useState(false);
  const [video, setVideo] = useState<{ id: number; summary?: SetVideoSummary | null } | null>(null);
  const canonicalPrEvents = useMemo(() => recap.accomplishments.filter((row) => CANONICAL_PR_EVENT_TYPES.has(String(row.event_type || '').toUpperCase())), [recap.accomplishments]);
  const performedMovements = useMemo(() => recap.performed_movements.map((movement) => {
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
  const shownMovements = showAllMovements ? performedMovements : performedMovements.slice(0, INITIAL_MOVEMENT_COUNT);
  const hiddenMovementCount = Math.max(0, performedMovements.length - INITIAL_MOVEMENT_COUNT);
  const feedback = String(recap.coach_feedback.feedback || '').trim();
  const hasReflection = recap.reflection.session_rpe != null || !!recap.reflection.strength || !!recap.reflection.fatigue || !!String(recap.reflection.note || '').trim();
  const focusRows = useMemo(() => [...(recap.muscle_focus?.primary || []), ...(recap.muscle_focus?.secondary || [])], [recap.muscle_focus]);
  const projections = performedMovements.filter((row) => row.projection?.value_kg);
  const firstPr = canonicalPrEvents[0];
  const firstPrMovement = performedMovements.find((movement) => firstPr && accomplishmentMatchesMovement(firstPr, movement));
  const firstPrBest = firstPrMovement?.best_set ? {
    id: Number(firstPrMovement.best_set.set_log_id || 0),
    actual_weight_kg: firstPrMovement.best_set.weight_kg,
    actual_reps: firstPrMovement.best_set.reps,
  } : null;
  const firstPrValue = firstPrBest && firstPrMovement
    ? setResultLabel(firstPrBest, firstPrMovement, unit)
    : `${numberLabel(highlights.pr_count, 0)} verified PR${Number(highlights.pr_count) === 1 ? '' : 's'}`;
  const firstPrDelta = firstPrMovement?.trend?.delta_kg
    ? formatWeightDeltaFromKg(firstPrMovement.trend.delta_kg, unit)
    : null;
  const hasPerformedEvidence = performedMovements.length > 0 && recap.session.set_count > 0;
  const athleteInitials = recap.athlete.name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const feedbackInitials = String(recap.coach_feedback.author?.name || 'Coach').split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const maxFocusScore = Math.max(1, ...focusRows.map((row) => Number(row.score || 0)));

  useEffect(() => { setCompletedSessionRecapOpen(true); return () => setCompletedSessionRecapOpen(false); }, []);
  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => setShowAllMovements(initialShowAllMovements), [initialShowAllMovements]);

  const openVideo = (set: CompletedRecapSet) => { const id = setVideoId(set); if (id > 0) setVideo({ id, summary: set.video || null }); };
  const meta = [dateLabel(recap.session.date), durationLabel(recap.session.duration_seconds)].filter(Boolean).join(' · ');
  const bodyweight = recap.session.reported_bodyweight?.reported_bodyweight_kg ?? recap.readiness_context?.bodyweight_kg;
  const sessionVolume = formatCompactVolumeValueFromKg(recapHighlights.session_volume_kg ?? impactSummary?.session_volume_kg ?? recap.session.total_volume_kg, unit) || '—';
  const deepActions = [
    onViewLedger ? { icon: 'list-outline' as const, label: 'View in Ledger', onPress: onViewLedger } : null,
    onViewCalendar ? { icon: 'calendar-outline' as const, label: 'View on Calendar', onPress: onViewCalendar } : null,
    viewerMode === 'coach' && onOpenProgramming ? { icon: 'options-outline' as const, label: 'Open Programming', onPress: onOpenProgramming } : null,
    viewerMode === 'athlete' && onLogNextSession ? { icon: 'pulse-outline' as const, label: 'Log Next Session', onPress: onLogNextSession, primary: true } : null,
  ].filter(Boolean) as { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; primary?: boolean }[];

  if (!hasPerformedEvidence) {
    return <SafeAreaView edges={['top']} style={styles.screen}>
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

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <FloatingControlCoordinator context="screen">
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} slot={1} testID="session-recap-unit-toggle" />
    <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Back from Session review" onPress={onClose} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={SLColors.textPrimary} /></Pressable><View style={styles.topBarCopy}><Text numberOfLines={1} style={styles.topTitle}><Text style={styles.topDot}>• </Text>{recap.session.label}</Text><Text style={styles.topSubtitle}>{viewerMode === 'coach' ? 'Coach Session Review' : 'Session Recap'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Done reviewing completed session recap" onPress={onDone || onClose} style={({ pressed }) => [styles.completeMark, pressed && styles.pressed]}><Ionicons name="checkmark" size={23} color={SLColors.textPrimary} /></Pressable></View>
    <ScrollView contentOffset={{ x: 0, y: initialScrollOffsetY }} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 24 }]} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={SLColors.accent} /> : undefined} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionShell}><View style={styles.tabs}><Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'performed' }} onPress={() => setTab('performed')} style={[styles.tab, tab === 'performed' && styles.tabActive]}><Text style={[styles.tabText, tab === 'performed' && styles.tabTextActive]}>Performed</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'plan' }} onPress={() => setTab('plan')} style={[styles.tab, tab === 'plan' && styles.tabActive]}><Text style={[styles.tabText, tab === 'plan' && styles.tabTextActive]}>Plan / Compare</Text></Pressable></View></View>
      {tab === 'performed' ? <>
      <View style={styles.sectionShell}><View style={styles.hero}><LinearGradient colors={['#12091F', '#08070E', '#020306']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} /><LinearGradient colors={['rgba(61,20,112,0.02)', 'rgba(136,47,218,0.18)', 'rgba(224,66,204,0.06)']} end={{ x: 1, y: 0.7 }} start={{ x: 0, y: 0.45 }} style={styles.heroAtmosphere} /><View style={styles.heroAnatomy}>{recap.muscle_focus?.primary?.length ? <MuscleMap athlete={recap.athlete} primary={recap.muscle_focus.primary.map((row) => row.muscle_id)} secondary={(recap.muscle_focus.secondary || []).map((row) => row.muscle_id)} size="hero" view="auto" /> : <Image accessibilityIgnoresInvertColors resizeMode="contain" source={SESSION_RECAP_ARCHIVE_ART} style={styles.heroFallbackArt} />}</View><LinearGradient colors={['rgba(3,3,7,0.98)', 'rgba(3,3,7,0.78)', 'rgba(3,3,7,0.04)']} end={{ x: 1, y: 0.5 }} locations={[0, 0.58, 1]} start={{ x: 0, y: 0.5 }} style={styles.heroCopyShade} /><View style={styles.heroCopy}><Text style={styles.heroKicker}>COMPLETED</Text><Text numberOfLines={2} style={styles.heroTitle}>{recap.session.label}</Text><View style={styles.heroIdentity}><View style={styles.athleteInitials}>{recap.athlete.avatar_url ? <Image accessibilityIgnoresInvertColors source={{ uri: absoluteAssetUrl(recap.athlete.avatar_url)! }} style={styles.athleteAvatar} /> : <Text style={styles.athleteInitialsText}>{athleteInitials || 'SL'}</Text>}</View><View style={styles.heroIdentityCopy}><Text style={styles.heroAthlete}>{recap.athlete.name}</Text><Text style={styles.heroMeta}>{meta}</Text></View></View></View>{hasReflection ? <View style={styles.notesPill}><Ionicons name="document-text-outline" size={16} color={SLColors.textPrimary} /><Text style={styles.notesPillText}>Session Notes</Text></View> : null}<View style={styles.summaryMetricRow}><SummaryMetric icon="barbell-outline" value={String(recap.session.movement_count)} label="Movements" /><SummaryMetric icon="list-outline" value={String(recap.session.set_count)} label="Sets Completed" /><SummaryMetric icon="stats-chart-outline" value={sessionVolume} label="Total Volume" /><SummaryMetric icon="pulse-outline" value={numberLabel(recap.reflection.session_rpe)} label="Session RPE" /></View></View></View>

      {(Number(highlights.pr_count || 0) > 0 || showPerfectPlan || Number(highlights.session_streak || 0) > 0) ? <View style={styles.sectionShell}><View style={styles.sectionHeading}><Text style={styles.sectionLabel}>SESSION HIGHLIGHTS</Text>{recap.accomplishments.length > 3 ? <Pressable onPress={() => setShowAccomplishments((value) => !value)}><Text style={styles.sectionAction}>{showAccomplishments ? 'Show less' : 'View all'}</Text></Pressable> : null}</View><View style={styles.highlightRail}>{Number(highlights.pr_count || 0) > 0 ? <HighlightCard kind="pr" color={SLColors.warning} label={String(firstPr?.event_type || '').includes('REP') ? 'REP PR' : 'PERSONAL RECORD'} value={firstPrValue} detail={[String(firstPrMovement?.label || firstPr?.movement_label || firstPr?.headline || 'Verified performance'), firstPrDelta].filter(Boolean).join(' · ')} /> : null}{showPerfectPlan ? <HighlightCard kind="prescription" color={SLColors.success} label="PERFECT PLAN" value={`${numberLabel(recapHighlights.completed_prescribed_set_count, 0)} / ${numberLabel(recapHighlights.prescribed_set_count, 0)}`} detail={`${numberLabel(highlights.prescription_completion_percent, 0)}% prescribed sets`} /> : null}{Number(highlights.session_streak || 0) > 0 ? <HighlightCard kind="streak" color="#FF6670" label="SESSION STREAK" value={numberLabel(highlights.session_streak, 0)} detail="Completed Sessions in sequence" /> : null}</View>{showAccomplishments ? <View style={styles.accomplishmentList}>{recap.accomplishments.map((row, index) => <View key={row.id || index} style={styles.accomplishmentRow}><Image accessibilityIgnoresInvertColors source={sessionRecapHighlightAsset('pr')} style={styles.archiveAccomplishmentArt} /><View><Text style={styles.accomplishmentTitle}>{String(row.headline || row.title || row.event_type || 'Achievement').replaceAll('_', ' ')}</Text>{row.movement_label ? <Text style={styles.detailMeta}>{row.movement_label}</Text> : null}</View></View>)}</View> : null}</View> : null}
      </> : null}

      {tab === 'performed' ? <>
        {focusRows.length ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>SESSION FOCUS</Text><View style={styles.focusCard}><LinearGradient colors={['rgba(85,29,139,0.22)', 'rgba(6,7,11,0.94)', '#05060A']} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} /><View style={styles.focusChart}><MuscleMap athlete={recap.athlete} primary={(recap.muscle_focus?.primary || []).map((row) => row.muscle_id)} secondary={(recap.muscle_focus?.secondary || []).map((row) => row.muscle_id)} size="hero" style={styles.focusAnatomy} view="auto" /></View><View style={styles.focusBreakdown}><Text style={styles.focusSummary}>Performed muscle emphasis</Text>{focusRows.slice(0, 5).map((row, index) => { const relative = Math.round(Number(row.score || 0) / maxFocusScore * 100); const primaryCount = recap.muscle_focus?.primary?.length || 0; return <View key={row.muscle_id} style={styles.focusRow}><View style={styles.focusRowTop}><Text style={styles.focusName}>{formatMuscle(row.muscle_id)}</Text><Text style={styles.focusRank}>#{index + 1} · {index < primaryCount ? 'PRIMARY' : 'SECONDARY'}</Text></View><View style={styles.focusTrack}><View style={[styles.focusFill, { width: `${Math.max(relative, 7)}%`, backgroundColor: ['#B45CFF', '#E347CF', '#4A9FFF', '#58D68D', '#FF785A'][index % 5] }]} /></View></View>; })}<Text style={styles.evidenceSource}>Performed SetLog targets · relative governed ranking. No invented percentages.</Text></View></View></View> : null}
        <View style={styles.sectionShell}><View style={styles.sectionHeading}><Text style={styles.sectionLabel}>MOVEMENTS <Text style={styles.countBadge}>{performedMovements.length}</Text></Text><Text style={styles.sectionMeta}>Collapsed · tap for full evidence</Text></View></View><View style={styles.movementStack}>{shownMovements.length ? shownMovements.map((movement, index) => <PerformedMovementCard key={movement.item_id || `${movement.label}-${index}`} movement={movement} unit={unit} onVideo={openVideo} onOpenHistory={onOpenMovementHistory ? (row) => onOpenMovementHistory(row, unit) : undefined} initialExpanded={Number(movement.item_id) === Number(initialExpandedItemId)} />) : <View style={styles.emptyCard}><Ionicons name="document-text-outline" size={25} color={SLColors.textMuted} /><Text style={styles.emptyTitle}>No performed sets were recorded</Text><Text style={styles.emptyBody}>This historical Session has no persisted SetLog evidence.</Text></View>}</View>{hiddenMovementCount > 0 ? <View style={styles.sectionShell}><Pressable accessibilityRole="button" accessibilityState={{ expanded: showAllMovements }} onPress={() => setShowAllMovements((value) => !value)} style={({ pressed }) => [styles.moreMovements, pressed && styles.pressed]}><Text style={styles.moreMovementsText}>{showAllMovements ? 'Show fewer movements' : `${hiddenMovementCount} more movement${hiddenMovementCount === 1 ? '' : 's'}`}</Text><Ionicons name={showAllMovements ? 'chevron-up' : 'chevron-down'} size={18} color={SLColors.textSecondary} /></Pressable></View> : null}
        {projections.length ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>PERFORMANCE PROJECTIONS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectionRail}>{projections.map((movement) => <View key={movement.item_id || movement.label} style={styles.projectionCard}><LinearGradient colors={['rgba(105,44,171,0.22)', '#07080D']} style={StyleSheet.absoluteFillObject} /><Text numberOfLines={1} style={styles.projectionName}>{movement.label}</Text><View style={styles.projectionBody}><View><Text style={styles.projectionMetric}>{movement.projection?.label || 'Estimated 1RM'} · PROJECTED</Text><Text style={styles.projectionValue}>{formatWeightFromKg(movement.projection?.value_kg, unit) || '—'}</Text></View><View style={styles.projectionSparkline}><MovementTrendChart compact trend={movement.trend} unit={unit} color="#C06BFF" /></View></View><Text style={styles.projectionBasis}>Canonical best set · {movement.projection?.method === 'epley_rpe_adjusted_v1' ? 'Epley/RPE method' : movement.projection?.method || 'governed method'}</Text></View>)}</ScrollView></View> : null}
        {recap.session.volume_trend?.points?.length ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>VOLUME TREND</Text><View style={styles.volumeTrendCard}><LinearGradient colors={['rgba(55,33,92,0.26)', '#06070B']} style={StyleSheet.absoluteFillObject} /><View style={styles.volumeTrendHeading}><View><Text style={styles.projectionMetric}>CURRENT BLOCK · TOTAL VOLUME</Text><Text style={styles.volumeTrendValue}>{sessionVolume}</Text></View>{recap.session.volume_trend.delta_kg != null ? <View style={styles.volumeDelta}><Text style={styles.volumeDeltaValue}>{formatWeightDeltaFromKg(recap.session.volume_trend.delta_kg, unit)}</Text><Text style={styles.volumeDeltaLabel}>vs previous Session</Text></View> : null}</View><VolumeBars points={recap.session.volume_trend.points} /></View></View> : null}
        {hasReflection ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>ATHLETE REFLECTION</Text><View style={styles.detailCard}><View style={styles.reflectionHeader}><View style={styles.reflectionFacts}>{recap.reflection.session_rpe != null ? <Text style={styles.factPill}>Session RPE {numberLabel(recap.reflection.session_rpe)}</Text> : null}{recap.reflection.strength ? <Text style={styles.factPill}>{recap.reflection.strength}</Text> : null}{recap.reflection.fatigue ? <Text style={styles.factPill}>{recap.reflection.fatigue} fatigue</Text> : null}</View></View>{recap.reflection.note ? <Text style={styles.quote}>{recap.reflection.note}</Text> : null}</View></View> : null}
        {feedback ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>POST SESSION FEEDBACK</Text><View style={styles.feedbackCard}><LinearGradient colors={['rgba(93,42,145,0.19)', '#07080D']} style={StyleSheet.absoluteFillObject} /><View style={styles.feedbackHeader}><View style={styles.feedbackAvatar}>{recap.coach_feedback.author?.avatar_url ? <Image accessibilityIgnoresInvertColors source={{ uri: absoluteAssetUrl(recap.coach_feedback.author.avatar_url)! }} style={styles.feedbackAvatarImage} /> : <Text style={styles.feedbackAvatarText}>{feedbackInitials || 'C'}</Text>}</View><View style={styles.feedbackIdentity}><Text style={styles.feedbackAuthor}>{recap.coach_feedback.author?.name || 'Coach feedback'}</Text><Text style={styles.detailMeta}>{dateLabel(recap.coach_feedback.feedback_at)}</Text></View>{recap.coach_feedback.reviewed ? <View style={styles.reviewedBadge}><Text style={styles.reviewedBadgeText}>REVIEWED</Text></View> : null}</View><Text style={styles.feedbackQuote}>{feedback}</Text></View></View> : null}
        {(recap.readiness_context || bodyweight) ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>READINESS CONTEXT</Text><View style={styles.readinessPanel}><LinearGradient colors={['rgba(15,31,50,0.74)', '#06070B']} style={StyleSheet.absoluteFillObject} /><View style={styles.readinessGaugeRail}>{recap.readiness_context?.readiness_score != null ? <ReadinessGauge label="Readiness" value={recap.readiness_context.readiness_score} color="#58D68D" /> : null}{recap.readiness_context?.sleep_quality != null ? <ReadinessGauge label="Sleep" value={recap.readiness_context.sleep_quality} color="#6E80FF" /> : null}{recap.readiness_context?.stress != null ? <ReadinessGauge label="Stress" value={recap.readiness_context.stress} color="#F4B94F" /> : null}{recap.readiness_context?.energy != null ? <ReadinessGauge label="Energy" value={recap.readiness_context.energy} color="#A865FF" /> : null}</View>{bodyweight ? <View style={styles.bodyweightEvidence}><View><Text style={styles.detailKicker}>REPORTED BODYWEIGHT</Text><Text style={styles.bodyweightValue}>{formatWeightFromKg(bodyweight, unit) || '—'}</Text></View><Ionicons name="scale-outline" size={28} color="#53CBE8" /></View> : null}</View><Text style={styles.contextDisclaimer}>Reported before this Session. Shown as context, not as a causal claim.</Text></View> : null}
        {viewerMode === 'coach' && coachReview ? <CoachTools review={coachReview} /> : viewerMode === 'coach' && coachReviewUnavailableReason ? <View style={styles.sectionShell}><Text style={styles.sectionLabel}>COACH REVIEW TOOLS</Text><View style={styles.planNotice}><Ionicons name="lock-closed-outline" size={19} color={SLColors.textMuted} /><Text style={styles.planNoticeText}>{coachReviewUnavailableReason}</Text></View></View> : null}
      </> : recap.plan.available === false ? <View style={styles.sectionShell}><View style={styles.emptyCard}><Ionicons name="lock-closed-outline" size={25} color={SLColors.textMuted} /><Text style={styles.emptyTitle}>Prescription unavailable</Text><Text style={styles.emptyBody}>This Session’s performed evidence remains visible. Coach-authored prescription details stay with their authoring workspace.</Text></View></View> : <PlanCompareExperience recap={recap} performedMovements={performedMovements} unit={unit} onOpenHistory={onOpenMovementHistory} />}
      {deepActions.length ? <View style={styles.sectionShell}><View style={styles.nextActions}>{deepActions.map((action) => <ActionButton key={action.label} {...action} />)}</View></View> : null}
    </ScrollView>
    <SetVideoPlayerModal visible={!!video} videoId={video?.id || null} initialVideo={video?.summary || null} initialUrl={video?.summary?.url || null} onClose={() => setVideo(null)} />
    </FloatingControlCoordinator>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020306' }, pressed: { opacity: 0.72 }, content: { gap: 13 }, sectionShell: { marginHorizontal: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#020306' }, topButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080A10' }, topBarCopy: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8 }, topTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 17 }, topDot: { color: SLColors.accentMuted }, topSubtitle: { marginTop: 2, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12 }, completeMark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#0B0D14' },
  hero: { position: 'relative', overflow: 'hidden', minHeight: 286, padding: 16, paddingBottom: 0, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#60358A', backgroundColor: '#07080E', ...SLShadows.level2 }, heroAtmosphere: { position: 'absolute', top: 0, right: 0, bottom: 70, width: '58%' }, heroAnatomy: { position: 'absolute', top: -13, right: -16, width: 190, height: 230, alignItems: 'center', justifyContent: 'center', opacity: 1, transform: [{ scale: 0.66 }] }, heroFallbackArt: { width: 220, height: 220, opacity: 0.72 }, heroCopyShade: { position: 'absolute', zIndex: 1, top: 0, bottom: 70, left: 0, width: '78%' }, heroCopy: { zIndex: 2, width: '58%', minHeight: 195, paddingTop: 3 }, heroKicker: { color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 1.2 }, heroTitle: { marginTop: 9, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 29, lineHeight: 32 }, heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }, heroIdentityCopy: { flex: 1, minWidth: 0 }, athleteInitials: { width: 34, height: 34, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: 'rgba(182,112,255,0.55)', backgroundColor: '#1A1024' }, athleteAvatar: { width: '100%', height: '100%' }, athleteInitialsText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, heroAthlete: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, heroMeta: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 }, notesPill: { position: 'absolute', zIndex: 3, top: 146, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: 'rgba(8,10,16,0.88)' }, notesPillText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, summaryMetricRow: { zIndex: 4, flexDirection: 'row', minHeight: 72, marginHorizontal: -16, paddingHorizontal: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(174,104,255,0.28)', backgroundColor: 'rgba(4,5,9,0.94)' }, summaryMetric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 5, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderSubtle }, summaryMetricCopy: { flex: 1, minWidth: 0 }, summaryMetricValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 13 }, summaryMetricLabel: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionLabel: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 1.05 }, sectionAction: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, sectionMeta: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8 }, countBadge: { color: SLColors.textSecondary },
  highlightRail: { flexDirection: 'row', gap: 7, paddingTop: 8 }, highlightCard: { position: 'relative', flex: 1, minWidth: 0, minHeight: 154, overflow: 'hidden', alignItems: 'center', padding: 8, borderRadius: SLRadius.lg, borderWidth: 1, backgroundColor: '#07080D' }, highlightArtwork: { width: 62, height: 62, marginTop: 1 }, highlightCopy: { width: '100%', alignItems: 'center', marginTop: -2 }, highlightLabel: { fontFamily: SLFontFamilies.bodyBold, fontSize: 7, letterSpacing: 0.55, textAlign: 'center' }, highlightValue: { width: '100%', marginTop: 4, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 15, textAlign: 'center' }, highlightDetail: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 7.5, lineHeight: 10, textAlign: 'center' }, accomplishmentList: { marginTop: 8, paddingHorizontal: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, accomplishmentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle }, archiveAccomplishmentArt: { width: 37, height: 37 }, accomplishmentTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11, textTransform: 'capitalize' },
  tabs: { flexDirection: 'row', padding: 3, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080A10' }, tab: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md }, tabActive: { borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: SLColors.surfaceSelected }, tabText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 }, tabTextActive: { color: SLColors.textPrimary },
  focusCard: { position: 'relative', flexDirection: 'row', minHeight: 245, overflow: 'hidden', marginTop: 8, padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#39244F', backgroundColor: '#05060A' }, focusChart: { width: 162, height: 222, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, focusAnatomy: { transform: [{ scale: 0.57 }] }, focusBreakdown: { flex: 1, justifyContent: 'center', gap: 9, marginLeft: -8 }, focusSummary: { marginBottom: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 13 }, focusRow: { gap: 4 }, focusRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, focusName: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, focusRank: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 6.2 }, focusTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: SLColors.surfaceInset }, focusFill: { height: 5, borderRadius: 3 }, evidenceSource: { marginTop: 5, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7, lineHeight: 10 },
  movementStack: { gap: 9, paddingHorizontal: 12 }, movementCard: { overflow: 'hidden', borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#292D38', backgroundColor: '#06070B', ...SLShadows.level1 }, coreMovementCard: { borderLeftWidth: 2, borderLeftColor: SLColors.accent }, movementHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 10 }, movementMedia: { width: 76, alignItems: 'center', gap: 6 }, artwork: { position: 'relative', width: 72, height: 86, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#3B2852', backgroundColor: SLColors.surfaceMedia }, artworkImage: { width: 66, height: 77 }, artworkMap: { transform: [{ scale: 0.92 }] }, videoEvidencePreview: { position: 'relative', width: 72, height: 38, overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: '#3A3D49', backgroundColor: SLColors.surfaceMedia }, videoEvidencePlay: { position: 'absolute', top: 8, left: 26, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.74)', backgroundColor: 'rgba(2,3,6,0.66)' }, videoEvidenceLabel: { position: 'absolute', left: 4, bottom: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 5.8 }, movementSummary: { flex: 1, minWidth: 0, marginLeft: 10 }, movementTitleRow: { flexDirection: 'row', alignItems: 'center' }, movementTitleCopy: { flex: 1, minWidth: 0 }, movementEyebrow: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 7.5, letterSpacing: 0.8 }, movementTitle: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 15 }, movementMuscles: { marginTop: 2, color: '#CA79FF', fontFamily: SLFontFamilies.body, fontSize: 8.5 }, movementEquipment: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5 }, prBadge: { alignItems: 'center', justifyContent: 'center', width: 34, height: 37, marginHorizontal: 4 }, movementPrArtwork: { position: 'absolute', width: 32, height: 32 }, prBadgeText: { position: 'absolute', bottom: -1, color: SLColors.warning, fontFamily: SLFontFamilies.display, fontSize: 7 }, movementEvidenceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }, bestSetCopy: { flex: 1, minWidth: 0 }, bestSetLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 6.8, letterSpacing: 0.55 }, bestSetValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10.5 }, bestSetEffort: { marginTop: 2, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 8 }, sparklineWrap: { width: 96, minHeight: 42, justifyContent: 'flex-end' }, sparklineEmpty: { height: 38, alignItems: 'center', justifyContent: 'center' }, sparklineEmptyText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 5.8, letterSpacing: 0.35, textAlign: 'center' }, trendPlot: { position: 'relative', width: '100%', minHeight: 118 }, trendPlotCompact: { minHeight: 42 }, trendPointTarget: { position: 'absolute', width: 34, height: 34, borderRadius: 17 }, trendInspection: { position: 'absolute', top: 2, right: 5, alignItems: 'flex-end', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: '#624081', backgroundColor: 'rgba(7,8,13,0.92)' }, trendInspectionDate: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 5.8, letterSpacing: 0.45 }, trendInspectionValue: { marginTop: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 11 }, trendInspectionMeta: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 6.5 }, trendAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }, trendAxisLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 6.5 }, delta: { position: 'absolute', right: 0, bottom: -2, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, fontFamily: SLFontFamilies.bodyBold, fontSize: 7 }, deltaUp: { color: SLColors.success, backgroundColor: 'rgba(39,190,104,0.12)' }, deltaDown: { color: SLColors.danger, backgroundColor: 'rgba(255,84,104,0.12)' }, deltaUpText: { color: SLColors.success }, deltaDownText: { color: SLColors.danger }, movementMetaRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 }, movementMeta: { overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, color: SLColors.textMuted, backgroundColor: '#10121A', fontFamily: SLFontFamilies.bodyBold, fontSize: 5.8, letterSpacing: 0.35 }, expandedEvidence: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard },
  bestVideoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 10, padding: 9, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#694096', backgroundColor: '#0A0C13' }, bestVideoMedia: { position: 'relative', width: 118, height: 76, overflow: 'hidden', borderRadius: 9, backgroundColor: SLColors.surfaceMedia }, bestVideoPlay: { position: 'absolute', top: 24, left: 45, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.78)', backgroundColor: 'rgba(2,3,6,0.64)' }, bestVideoOverlay: { position: 'absolute', left: 7, bottom: 5, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 7 }, bestVideoCopy: { flex: 1, minWidth: 0 }, bestVideoValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 }, detailKicker: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.8 }, detailMeta: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8 }, setTable: { paddingHorizontal: 10 }, setHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 28 }, setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 47, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle }, columnLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 7.5, letterSpacing: 0.65 }, setValue: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 9 }, setValueStrong: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, setNumberColumn: { width: 28 }, resultColumn: { flex: 1.4 }, resultColumnRow: { flex: 1.4, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }, effortColumn: { width: 65 }, videoColumn: { width: 54, alignItems: 'flex-end' }, setPr: { overflow: 'hidden', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 5, color: SLColors.warning, backgroundColor: 'rgba(255,181,32,0.12)', fontFamily: SLFontFamilies.bodyBold, fontSize: 6.5 }, videoButton: { width: 50, height: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceMedia }, videoThumbnail: { ...StyleSheet.absoluteFillObject }, videoPlay: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(3,4,8,0.72)' }, trendDetail: { margin: 10, padding: 10, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: '#05070B' }, trendDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }, trendDeltaValue: { fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, historyAction: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 10, marginTop: 0, paddingHorizontal: 11, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: SLColors.accentSoft }, historyActionLabel: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.7 }, historyActionDetail: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8 }, diagnosticCard: { margin: 10, marginTop: 0, padding: 10, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#315D79', backgroundColor: '#07101A' }, diagnosticLine: { marginTop: 5, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 8, lineHeight: 12 }, diagnosticReason: { marginTop: 3, color: SLColors.warning, fontFamily: SLFontFamilies.body, fontSize: 7.5 }, equipmentFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard }, equipmentItem: { flexDirection: 'row', alignItems: 'center', flexGrow: 1, gap: 8 }, equipmentCopy: { flex: 1, minWidth: 70 }, equipmentModel: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, equipmentImplementation: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5 },
  moreMovements: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset }, moreMovementsText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, emptyCard: { alignItems: 'center', marginHorizontal: 12, padding: 26, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, emptyTitle: { marginTop: 9, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, emptyBody: { marginTop: 5, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10, textAlign: 'center' },
  projectionRail: { gap: 8, paddingTop: 8 }, projectionCard: { position: 'relative', width: 238, minHeight: 124, overflow: 'hidden', padding: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: '#39264E', backgroundColor: '#07090E' }, projectionName: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, projectionBody: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 9 }, projectionMetric: { marginTop: 8, color: SLColors.accentMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5 }, projectionValue: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 22 }, projectionSparkline: { width: 94, height: 43 }, projectionBasis: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5, lineHeight: 11 },
  volumeTrendCard: { position: 'relative', overflow: 'hidden', marginTop: 8, padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#342647', backgroundColor: '#07090E' }, volumeTrendHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, volumeTrendValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 22 }, volumeDelta: { alignItems: 'flex-end' }, volumeDeltaValue: { color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, volumeDeltaLabel: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7 }, volumeBars: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12, paddingTop: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderSubtle }, volumeBarColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }, volumeBar: { width: '70%', minHeight: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#514E5E' }, volumeBarCurrent: { backgroundColor: '#924CE3' }, volumeBarDate: { marginTop: 4, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 6.5 },
  detailCard: { marginTop: 8, padding: 13, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, reflectionHeader: { flexDirection: 'row', justifyContent: 'space-between' }, reflectionFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 9 }, factPill: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, color: SLColors.textSecondary, backgroundColor: SLColors.surfaceInset, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, textTransform: 'capitalize' }, quote: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 17 }, feedbackCard: { position: 'relative', overflow: 'hidden', marginTop: 8, padding: 14, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#4C316B', backgroundColor: '#07090E' }, feedbackHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, feedbackAvatar: { width: 43, height: 43, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#7248A0', backgroundColor: SLColors.accentSoft }, feedbackAvatarImage: { width: '100%', height: '100%' }, feedbackAvatarText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.display, fontSize: 11 }, feedbackIdentity: { flex: 1, marginLeft: 10 }, feedbackAuthor: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, feedbackQuote: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 }, reviewedBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(39,190,104,0.45)', backgroundColor: 'rgba(39,190,104,0.10)' }, reviewedBadgeText: { color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 7 },
  readinessPanel: { position: 'relative', overflow: 'hidden', marginTop: 8, padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#273647', backgroundColor: '#06070B' }, readinessGaugeRail: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 8 }, readinessGauge: { width: 72, alignItems: 'center' }, readinessGaugeVisual: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }, readinessGaugeValueWrap: { position: 'absolute', flexDirection: 'row', alignItems: 'baseline' }, readinessGaugeValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 14 }, readinessGaugeSuffix: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 6 }, readinessGaugeLabel: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 8 }, bodyweightEvidence: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard }, bodyweightValue: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 19 }, contextDisclaimer: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5, lineHeight: 11 },
  sparseHero: { position: 'relative', minHeight: 220, overflow: 'hidden', padding: 18, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#49305F', backgroundColor: '#07080E' }, sparseHeroArt: { position: 'absolute', right: -25, bottom: -22, width: 220, height: 220, opacity: 0.5 }, sparseHeroCopy: { zIndex: 2, width: '67%' }, sparseHeroTitle: { marginTop: 10, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 28, lineHeight: 32 }, sparseAthleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }, sparseEvidence: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, sparseEvidenceIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: SLColors.accentSoft }, sparseEvidenceCopy: { flex: 1 }, sparseEvidenceTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, sparseEvidenceBody: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 9, lineHeight: 14 },
  executionCard: { overflow: 'hidden', padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#30343E', backgroundColor: '#06080C' }, executionHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 }, executionHeadingText: { color: '#C36CFF', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.8 }, executionBody: { flexDirection: 'row', alignItems: 'center', marginTop: 12 }, executionMetrics: { flex: 1, minWidth: 0, flexDirection: 'row' }, executionMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', minHeight: 72, paddingHorizontal: 3, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#30333C' }, executionMetricValue: { fontFamily: SLFontFamilies.display, fontSize: 21 }, executionMetricLabel: { marginTop: 5, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 6.5, letterSpacing: 0.35, textAlign: 'center' }, executionDonut: { position: 'relative', width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, executionDonutCopy: { position: 'absolute', alignItems: 'center' }, executionDonutValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 19 }, executionDonutLabel: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 5.5, lineHeight: 7, textAlign: 'center' }, executionRail: { height: 7, flexDirection: 'row', overflow: 'hidden', marginTop: 9, borderRadius: 4, backgroundColor: '#242731' }, executionRailSegment: { minWidth: 0 }, executionFootnote: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8.5 },
  compareFilters: { gap: 7, paddingHorizontal: 12 }, compareFilter: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#30333D', backgroundColor: '#06080C' }, compareFilterSelected: { borderColor: '#A854E8', backgroundColor: '#251033' }, compareFilterDot: { width: 7, height: 7, borderRadius: 4 }, compareFilterText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, compareFilterTextSelected: { color: SLColors.textPrimary }, compareMovementStack: { gap: 8, paddingHorizontal: 12 },
  compareMovementCard: { overflow: 'hidden', borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#30343E', backgroundColor: '#06080C', ...SLShadows.level1 }, compareMovementCardExpanded: { borderColor: '#4B2A65' }, compareMovementHeader: { minHeight: 91, flexDirection: 'row', alignItems: 'center', padding: 9 }, compareArtwork: { width: 66, height: 70, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#372643', backgroundColor: '#100A16' }, compareArtworkImage: { width: 64, height: 68 }, compareManufacturer: { width: 68, height: 42, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginLeft: 6, borderRadius: 9, backgroundColor: '#080A0F' }, compareMovementCopy: { flex: 1, minWidth: 0, marginLeft: 8 }, compareMovementTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12, lineHeight: 16 }, compareEquipment: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8 }, comparePrescription: { alignSelf: 'flex-start', marginTop: 5, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, color: '#CE7FFF', backgroundColor: '#21102D', fontFamily: SLFontFamilies.bodyBold, fontSize: 7.2 }, compareStateWrap: { width: 66, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 4 }, compareStateBadge: { maxWidth: 66, paddingHorizontal: 5, paddingVertical: 5, borderRadius: 11, borderWidth: 1 }, compareStateText: { fontFamily: SLFontFamilies.bodyBold, fontSize: 6.2, letterSpacing: 0.25, textAlign: 'center' }, compareExpanded: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#292D36' },
  compareContextGrid: { flexDirection: 'row', padding: 8 }, compareMuscleColumn: { width: 76, paddingRight: 7, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#292D36' }, compareProgramColumn: { width: 72, paddingHorizontal: 7, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#292D36' }, comparePerformedColumn: { flex: 1, minWidth: 0, paddingLeft: 7 }, compareColumnKicker: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 6.8, letterSpacing: 0.5 }, compareLargeArtwork: { width: 67, height: 78, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderRadius: 10, backgroundColor: '#100A16' }, compareLargeArtworkImage: { width: 65, height: 76 }, compareMuscleRole: { marginTop: 9, color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 6.2, letterSpacing: 0.45 }, compareMuscleName: { marginTop: 2, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 8.2 }, compareProgramValue: { marginTop: 7, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 8.8 }, comparePlanNotes: { marginTop: 8, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.2, lineHeight: 10 },
  compareSetHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 27, marginTop: 5 }, compareSetRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#262A33' }, compareTableLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 6.2, letterSpacing: 0.2 }, compareSetValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 8.2 }, compareSetMatched: { color: '#32D17C', fontFamily: SLFontFamilies.bodyBold }, compareSetNumber: { width: 25 }, compareSetNumberBadge: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 }, compareSetNumberText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 8 }, compareLoad: { width: 45 }, compareReps: { width: 28 }, compareEffort: { width: 39 }, compareTarget: { flex: 1, minWidth: 58 }, targetBand: { flexDirection: 'row', alignItems: 'center', gap: 4 }, targetBandRail: { position: 'relative', flex: 1, height: 14, overflow: 'hidden', borderRadius: 4, backgroundColor: '#20232A' }, targetBandRange: { position: 'absolute', top: 2, bottom: 2, borderRadius: 3, borderWidth: 1, borderColor: '#9846D1', backgroundColor: '#35134B' }, targetBandMarker: { position: 'absolute', top: 1, width: 10, height: 12, marginLeft: -5, borderRadius: 6, borderWidth: 2, backgroundColor: '#F3F1F7' }, targetUnavailable: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 9 }, targetLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }, targetLegendBand: { width: 17, height: 8, borderRadius: 3, borderWidth: 1, borderColor: '#9846D1', backgroundColor: '#35134B' }, targetLegendMarker: { width: 9, height: 9, marginLeft: 4, borderRadius: 5, borderWidth: 2, borderColor: SLColors.textPrimary, backgroundColor: '#F3F1F7' }, targetLegendText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 6.2 },
  compareLastTime: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#292D36' }, compareLastTimeCopy: { flex: 1, minWidth: 0 }, compareLastTimeLabel: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 7, letterSpacing: 0.65 }, compareLastTimeValue: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 8.5 }, comparisonLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginHorizontal: 12, marginBottom: 4, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#272A32' }, comparisonLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, comparisonLegendText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 7.5 },
  planNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.accentSoft }, planNoticeText: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10, lineHeight: 15 }, planStack: { gap: 9, marginTop: 10, marginBottom: 10 }, planRow: { flexDirection: 'row', padding: 13, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#07090E' }, planIndex: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: SLColors.surfaceInset }, planIndexText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.display, fontSize: 9 }, planCopy: { flex: 1, minWidth: 0, marginLeft: 10 }, planTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 }, substitutionLabel: { marginTop: 4, color: SLColors.warning, fontFamily: SLFontFamilies.bodyBold, fontSize: 7.5 }, compareLabel: { marginTop: 8, color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 7, letterSpacing: 0.8 }, planPrescription: { marginTop: 2, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 }, performedPrescription: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, lineHeight: 15 }, planNotes: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 9, lineHeight: 14 },
  coachToolsCard: { marginTop: 8, padding: 12, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: '#315D79', backgroundColor: '#07101A' }, fieldLabel: { marginTop: 8, marginBottom: 5, color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.75 }, textarea: { minHeight: 82, padding: 11, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderStandard, color: SLColors.textPrimary, backgroundColor: '#05080E', fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 16, textAlignVertical: 'top' }, reviewChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, reviewChoice: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset }, reviewChoiceSelected: { borderColor: SLColors.borderSelected, backgroundColor: SLColors.accentSoft }, reviewChoiceText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 8 }, reviewChoiceTextSelected: { color: SLColors.accentMuted }, followupGroup: { marginTop: 8 }, reviewToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle }, reviewToggleText: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 }, reviewActions: { flexDirection: 'row', gap: 8, marginTop: 10 }, reviewSecondary: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.surfaceInset }, reviewSecondaryText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, reviewPrimary: { flex: 1.4, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: SLRadius.md, backgroundColor: SLColors.accentViolet }, reviewPrimaryText: { color: SLColors.white, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 },
  nextActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, actionButton: { flexGrow: 1, minWidth: 105, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: '#080A10' }, actionButtonPrimary: { borderColor: SLColors.accentViolet, backgroundColor: SLColors.accentViolet }, actionButtonText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, actionButtonTextPrimary: { color: SLColors.white },
});
