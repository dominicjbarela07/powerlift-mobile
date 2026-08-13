import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SetVideoPlayerModal, { type SetVideoSummary } from '@/components/SetVideoPlayerModal';
import { Text } from '@/components/ui/sl-text';
import { ManufacturerBrandMark } from '@/components/workout-logger/manufacturer-brand-mark';
import { SLColors, SLFontFamilies, SLRadius, SLShadows } from '@/constants/theme';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { accessoryMuscleRegion } from '@/lib/accessory-muscle-group';
import { API_BASE } from '@/lib/api';
import { resolveLoggerLiftIdentity } from '@/lib/logger-visual-context';
import { setCompletedSessionRecapOpen } from '@/lib/session-editor-overlay-state';

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
  sets: CompletedRecapSet[];
  equipment?: CompletedRecapEquipment[];
  has_pr?: boolean;
  accomplishment_count?: number;
  accomplishment_ids?: number[];
};

export type CompletedSessionRecapPayload = {
  schema_version: string;
  lifecycle_mode: 'completed_recap';
  workout_id: number;
  athlete: { id: number; name: string };
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
  };
  plan: {
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

type Props = {
  recap: CompletedSessionRecapPayload;
  impactSummary?: CompletedRecapImpactSummary | null;
  preferredUnits?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  initialTab?: RecapTab;
  initialShowAllMovements?: boolean;
};

type RecapTab = 'performed' | 'plan';

const LB_PER_KG = 2.2046226218;
const INITIAL_MOVEMENT_COUNT = 3;
const CANONICAL_PR_EVENT_TYPES = new Set([
  'CORE_E1RM_PR',
  'CORE_WEIGHT_PR',
  'CORE_REP_MAX_PR',
  'CORE_RPE_PR',
  'CORE_SAME_WEIGHT_REP_PR',
  'CORE_BLOCK_E1RM_BEST',
  'CORE_BLOCK_WEIGHT_BEST',
  'CORE_BLOCK_REP_MAX_BEST',
  'CORE_BLOCK_SAME_WEIGHT_REP_BEST',
]);

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
  const eventItemId = accomplishmentItemId(row);
  if (eventItemId != null && movement.item_id != null) return eventItemId === Number(movement.item_id);
  const eventLabel = normalizedEvidenceLabel(row.movement_label ?? row.source?.movement_label);
  return !!eventLabel && eventLabel === normalizedEvidenceLabel(movement.label);
}

function numberLabel(value: unknown, decimals = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(decimals).replace(/\.0$/, '');
}

function loadLabel(valueKg: unknown, unit: 'kg' | 'lb') {
  const parsed = Number(valueKg);
  if (!Number.isFinite(parsed)) return '—';
  const converted = unit === 'lb' ? parsed * LB_PER_KG : parsed;
  const rounded = unit === 'lb' ? Math.round(converted * 2) / 2 : Math.round(converted * 4) / 4;
  return `${numberLabel(rounded)} ${unit}`;
}

function compactVolume(valueKg: unknown, unit: 'kg' | 'lb') {
  const parsed = Number(valueKg);
  if (!Number.isFinite(parsed)) return '—';
  const converted = unit === 'lb' ? parsed * LB_PER_KG : parsed;
  if (converted >= 1000) return `${numberLabel(converted / 1000, 1)}K`;
  return numberLabel(converted, 0);
}

function durationLabel(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null;
  const total = Math.max(0, Math.round(Number(seconds) / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function dateLabel(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function absoluteAssetUrl(value?: string | null) {
  const path = String(value || '').trim();
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}

function effortLabel(set: CompletedRecapSet) {
  if (set.actual_rpe != null) return numberLabel(set.actual_rpe);
  if (set.actual_rir != null) return numberLabel(set.actual_rir);
  return '—';
}

function movementEffortHeading(movement: CompletedRecapMovement) {
  return movement.sets.some((row) => row.actual_rir != null) ? 'RIR' : 'RPE';
}

function movementArtworkSource(movement: CompletedRecapMovement) {
  if (movement.kind === 'accessory') {
    const region = accessoryMuscleRegion({
      movement: movement.label,
      movement_identity: { primary_muscle_group: movement.primary_muscle_group },
    });
    const artwork = accessoryMuscleRegionAsset(region.key);
    return artwork.source;
  }
  const identity = resolveLoggerLiftIdentity({ lift: movement.lift, movement: movement.label });
  return identity.iconSource || null;
}

function MovementArtwork({ movement }: { movement: CompletedRecapMovement }) {
  const source = movementArtworkSource(movement);
  if (source) return <Image accessibilityIgnoresInvertColors resizeMode="contain" source={source} style={styles.artworkImage} />;
  return <Ionicons name="barbell-outline" size={28} color={SLColors.accentMuted} />;
}

function SummaryMetric({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Ionicons name={icon} size={19} color={SLColors.accentMuted} />
      <View style={styles.summaryMetricCopy}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryMetricValue}>{value}</Text>
        <Text style={styles.summaryMetricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function HighlightMetric({ icon, color, value, label, caption }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  value: string;
  label: string;
  caption: string;
}) {
  return (
    <View style={styles.highlightMetric}>
      <View style={styles.highlightTopLine}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={styles.highlightValue}>{value}</Text>
      </View>
      <Text style={styles.highlightLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.highlightCaption, { color }]}>{caption}</Text>
    </View>
  );
}

function SetVideoButton({ set, fallbackSource, onPress }: { set: CompletedRecapSet; fallbackSource?: any; onPress: () => void }) {
  const thumbnail = absoluteAssetUrl(set.video?.thumbnail_url);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play video for set ${set.set_index || ''}`.trim()}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.videoButton, pressed && styles.pressed]}
    >
      {thumbnail ? <Image accessibilityIgnoresInvertColors source={{ uri: thumbnail }} style={styles.videoThumbnail} /> : fallbackSource ? <Image accessibilityIgnoresInvertColors source={fallbackSource} style={styles.videoThumbnail} /> : null}
      <View style={styles.videoPlay}><Ionicons name="play" size={10} color={SLColors.textPrimary} /></View>
    </Pressable>
  );
}

function EquipmentFooter({ equipment }: { equipment: CompletedRecapEquipment[] }) {
  if (!equipment.length) return null;
  return (
    <View style={styles.equipmentFooter}>
      {equipment.map((row, index) => (
        <View key={`${row.manufacturer_key || row.manufacturer || 'equipment'}-${row.model_key || row.model || index}`} style={styles.equipmentItem}>
          {row.manufacturer ? <ManufacturerBrandMark manufacturerName={row.manufacturer} compact /> : null}
          <View style={styles.equipmentCopy}>
            {row.model ? <Text numberOfLines={1} style={styles.equipmentModel}>{row.model}</Text> : null}
            {row.implementation_key ? <Text numberOfLines={1} style={styles.equipmentImplementation}>{row.implementation_key.replace(/[-_]/g, ' ')}</Text> : null}
            {!row.model && !row.implementation_key ? <Text numberOfLines={1} style={styles.equipmentModel}>{row.label || 'Equipment'}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function PerformedMovementCard({
  movement,
  unit,
  initiallyExpanded,
  onVideo,
}: {
  movement: CompletedRecapMovement;
  unit: 'kg' | 'lb';
  initiallyExpanded: boolean;
  onVideo: (set: CompletedRecapSet) => void;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const equipment = movement.equipment || [];
  const equipmentLine = equipment.map((row) => row.label).filter(Boolean).join(' · ');
  const effortHeading = movementEffortHeading(movement);
  return (
    <View style={[styles.movementCard, movement.kind === 'core' && styles.coreMovementCard]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${movement.label}`}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.movementHeader, pressed && styles.pressed]}
      >
        <View style={styles.artwork}><MovementArtwork movement={movement} /></View>
        <View style={styles.movementHeaderCopy}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.movementEyebrow}>{movement.kind === 'core' ? 'CORE LIFT' : 'ACCESSORY'}</Text>
            {movement.superset_group ? <Text style={styles.supersetBadge}>SUPERSET {movement.superset_group}</Text> : null}
          </View>
          <Text numberOfLines={2} style={styles.movementTitle}>{movement.label}</Text>
          {equipmentLine ? <Text numberOfLines={1} style={styles.equipmentLine}>{equipmentLine}</Text> : null}
        </View>
        {movement.has_pr ? <View style={styles.prBadge}><Text style={styles.prBadgeText}>PR</Text></View> : null}
        <View style={styles.collapseButton}><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={SLColors.textSecondary} /></View>
      </Pressable>
      {expanded ? (
        <>
          <View style={styles.setTable}>
            <View style={styles.setHeader}>
              <Text style={[styles.columnLabel, styles.setNumberColumn]}>SET</Text>
              <Text style={[styles.columnLabel, styles.loadColumn]}>LOAD</Text>
              <Text style={[styles.columnLabel, styles.repsColumn]}>REPS</Text>
              <Text style={[styles.columnLabel, styles.effortColumn]}>{effortHeading}</Text>
              <View style={styles.videoColumn} />
            </View>
            {movement.sets.map((set, index) => {
              const videoId = set.video_attachment_id || set.video_id || set.video?.id;
              return (
                <View key={set.id || index} style={styles.setRow}>
                  <Text style={[styles.setValue, styles.setNumberColumn]}>{set.set_index || index + 1}</Text>
                  <View style={styles.loadColumnRow}>
                    <Text numberOfLines={1} style={styles.setValueStrong}>{loadLabel(set.actual_weight_kg, unit)}</Text>
                    {set.has_pr ? <Text style={styles.setPr}>PR</Text> : null}
                  </View>
                  <Text style={[styles.setValue, styles.repsColumn]}>{set.actual_reps === 0 ? 'Fail' : numberLabel(set.actual_reps, 0)}</Text>
                  <Text style={[styles.setValue, styles.effortColumn]}>{effortLabel(set)}</Text>
                  <View style={styles.videoColumn}>{videoId ? <SetVideoButton set={set} fallbackSource={movementArtworkSource(movement)} onPress={() => onVideo(set)} /> : null}</View>
                </View>
              );
            })}
          </View>
          <EquipmentFooter equipment={equipment} />
        </>
      ) : null}
    </View>
  );
}

function planPrescription(item: Record<string, any>, unit: 'kg' | 'lb') {
  const sets = numberLabel(item.sets, 0);
  const reps = String(item.reps_text || numberLabel(item.reps, 0));
  const parts = [`${sets} × ${reps}`];
  if (item.rpe_target != null) parts.push(`@ RPE ${numberLabel(item.rpe_target)}`);
  else if (item.rir_target != null) parts.push(`@ ${numberLabel(item.rir_target)} RIR`);
  else if (item.pct != null) parts.push(`@ ${numberLabel(Number(item.pct) <= 1 ? Number(item.pct) * 100 : item.pct, 0)}%`);
  const low = item.coach_prescribed_low_kg ?? item.target_low_kg;
  const high = item.coach_prescribed_high_kg ?? item.target_high_kg;
  if (low != null && high != null) parts.push(Number(low) === Number(high) ? loadLabel(low, unit) : `${loadLabel(low, unit)}–${loadLabel(high, unit)}`);
  return parts.join(' · ');
}

function performedPrescription(movement: CompletedRecapMovement | undefined, unit: 'kg' | 'lb') {
  if (!movement?.sets.length) return 'No performed SetLog evidence';
  const setDescriptions = movement.sets.map((row) => `${loadLabel(row.actual_weight_kg, unit)} × ${numberLabel(row.actual_reps, 0)}`);
  return setDescriptions.join(' · ');
}

function accomplishmentTitle(row: Record<string, any>) {
  return String(row.headline || row.title || row.presentation_title || row.event_label || row.event_type || 'Accomplishment')
    .replace(/^CORE_/, '')
    .replace(/_/g, ' ');
}

function EvidenceButton({ icon, color, value, label, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; color: string; value: number; label: string; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} onPress={onPress} style={({ pressed }) => [styles.evidenceButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={color} />
      <View><Text style={styles.evidenceValue}>{value}</Text><Text style={styles.evidenceLabel}>{label}</Text></View>
    </Pressable>
  );
}

export function CompletedSessionRecap({ recap, impactSummary, preferredUnits, refreshing, onRefresh, onClose, initialTab = 'performed', initialShowAllMovements = false }: Props) {
  const insets = useSafeAreaInsets();
  const unit: 'kg' | 'lb' = ['lb', 'lbs'].includes(String(preferredUnits || '').toLowerCase()) ? 'lb' : 'kg';
  const [tab, setTab] = useState<RecapTab>(initialTab);
  const [showAllMovements, setShowAllMovements] = useState(initialShowAllMovements);
  const [showAccomplishments, setShowAccomplishments] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [video, setVideo] = useState<{ id: number; summary?: SetVideoSummary | null } | null>(null);
  const canonicalPrEvents = useMemo(
    () => recap.accomplishments.filter((row) => CANONICAL_PR_EVENT_TYPES.has(String(row.event_type || '').toUpperCase())),
    [recap.accomplishments],
  );
  const performedMovements = useMemo(
    () => recap.performed_movements.map((movement) => {
      const movementPrEvents = canonicalPrEvents.filter((row) => accomplishmentMatchesMovement(row, movement));
      const prSetLogIds = new Set(movementPrEvents.map(accomplishmentSetLogId).filter((id): id is number => id != null));
      return {
        ...movement,
        has_pr: movement.has_pr || movementPrEvents.length > 0,
        sets: movement.sets.map((set) => ({ ...set, has_pr: set.has_pr || prSetLogIds.has(Number(set.id)) })),
      };
    }),
    [canonicalPrEvents, recap.performed_movements],
  );
  const recapHighlights = recap.highlights || {};
  const highlights = {
    ...recapHighlights,
    summary_id: recapHighlights.summary_id ?? impactSummary?.summary_id,
    session_streak: recapHighlights.session_streak ?? impactSummary?.session_streak,
    pr_count: recapHighlights.pr_count ?? canonicalPrEvents.length,
    accomplishment_count: recapHighlights.accomplishment_count ?? impactSummary?.accomplishment_count ?? recap.accomplishments.length,
    session_volume_kg: recapHighlights.session_volume_kg ?? impactSummary?.session_volume_kg ?? recap.session.total_volume_kg,
    all_prescribed_work_logged: recapHighlights.all_prescribed_work_logged ?? impactSummary?.all_prescribed_work_logged,
    completed_prescribed_set_count: recapHighlights.completed_prescribed_set_count ?? impactSummary?.completed_set_count,
    prescription_completion_percent: recapHighlights.prescription_completion_percent
      ?? (impactSummary?.all_prescribed_work_logged ? 100 : null),
    canonical_items: recapHighlights.canonical_items ?? impactSummary?.highlights ?? [],
    remaining_highlight_count: recapHighlights.remaining_highlight_count ?? impactSummary?.remaining_highlight_count ?? 0,
  };
  const feedback = String(recap.coach_feedback.feedback || '').trim();
  const hasReflection = recap.reflection.session_rpe != null
    || !!recap.reflection.strength
    || !!recap.reflection.fatigue
    || !!String(recap.reflection.note || '').trim();
  const firstVideoSet = useMemo(
    () => performedMovements.flatMap((movement) => movement.sets).find((set) => set.video_attachment_id || set.video_id || set.video?.id),
    [performedMovements],
  );
  const shownMovements = showAllMovements ? performedMovements : performedMovements.slice(0, INITIAL_MOVEMENT_COUNT);
  const hiddenMovementCount = Math.max(0, performedMovements.length - INITIAL_MOVEMENT_COUNT);
  const prCount = Number(highlights.pr_count || 0);

  React.useEffect(() => {
    setCompletedSessionRecapOpen(true);
    return () => setCompletedSessionRecapOpen(false);
  }, []);
  React.useEffect(() => setTab(initialTab), [initialTab]);
  React.useEffect(() => setShowAllMovements(initialShowAllMovements), [initialShowAllMovements]);

  const openVideo = (set: CompletedRecapSet) => {
    const id = Number(set.video_attachment_id || set.video_id || set.video?.id);
    if (Number.isFinite(id) && id > 0) setVideo({ id, summary: set.video || null });
  };

  const meta = [dateLabel(recap.session.date), durationLabel(recap.session.duration_seconds)].filter(Boolean).join(' · ');

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close completed session recap" onPress={onClose} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={24} color={SLColors.textPrimary} />
        </Pressable>
        <View style={styles.topBarCopy}>
          <Text numberOfLines={1} style={styles.topTitle}><Text style={styles.topDot}>• </Text>{recap.session.label}</Text>
          <Text style={styles.topSubtitle}>Session Recap</Text>
        </View>
        <View style={styles.completeMark}><Ionicons name="checkmark" size={24} color={SLColors.textPrimary} /></View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 24 }]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={SLColors.accent} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionShell}>
          <View style={styles.hero}>
            <View style={styles.heroHeading}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>COMPLETED</Text>
                <Text style={styles.heroTitle}>{recap.athlete.name}</Text>
                <Text style={styles.heroMeta}>{meta}</Text>
              </View>
              {hasReflection ? (
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: showReflection }} onPress={() => setShowReflection((value) => !value)} style={({ pressed }) => [styles.notesButton, pressed && styles.pressed]}>
                  <Ionicons name="document-text-outline" size={18} color={SLColors.textPrimary} />
                  <Text style={styles.notesButtonText}>Session Notes</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.summaryMetricRow}>
              <SummaryMetric icon="barbell-outline" value={String(recap.session.movement_count)} label="Movements" />
              <SummaryMetric icon="list-outline" value={String(recap.session.set_count)} label="Sets" />
              <SummaryMetric icon="stats-chart-outline" value={`${compactVolume(recap.session.total_volume_kg, unit)} ${unit}`} label="Volume" />
              <SummaryMetric icon="pulse-outline" value={numberLabel(recap.reflection.session_rpe)} label="Session RPE" />
            </View>
          </View>
        </View>

        {showReflection ? (
          <View style={styles.sectionShell}>
            <View style={styles.detailCard}>
              <Text style={styles.cardKicker}>ATHLETE REFLECTION</Text>
              <View style={styles.reflectionFacts}>
                {recap.reflection.session_rpe != null ? <Text style={styles.factPill}>RPE {numberLabel(recap.reflection.session_rpe)}</Text> : null}
                {recap.reflection.strength ? <Text style={styles.factPill}>{recap.reflection.strength}</Text> : null}
                {recap.reflection.fatigue ? <Text style={styles.factPill}>{recap.reflection.fatigue} fatigue</Text> : null}
              </View>
              {recap.reflection.note ? <Text style={styles.quote}>{recap.reflection.note}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionShell}>
          <Text style={styles.sectionLabel}>SESSION HIGHLIGHTS</Text>
          <View style={styles.highlightsBoard}>
            {Number(highlights.session_streak || 0) > 0 ? <HighlightMetric icon="flame" color="#FF6670" value={String(highlights.session_streak)} label="Streak" caption="Keep it going!" /> : null}
            {prCount > 0 ? <HighlightMetric icon="ribbon-outline" color={SLColors.warning} value={String(prCount)} label="PRs" caption="New records!" /> : null}
            {Number(recap.session.total_volume_kg || 0) > 0 ? <HighlightMetric icon="trending-up" color={SLColors.success} value={`${compactVolume(recap.session.total_volume_kg, unit)} ${unit}`} label="Total Volume" caption="Work recorded" /> : null}
            {highlights.prescription_completion_percent != null ? <HighlightMetric icon="radio-button-on-outline" color={SLColors.info} value={`${numberLabel(highlights.prescription_completion_percent, 0)}%`} label="Planned Sets" caption={highlights.all_prescribed_work_logged ? 'Hit the plan' : 'Completed work'} /> : null}
          </View>
        </View>

        <View style={styles.sectionShell}>
          <View style={styles.tabs}>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'performed' }} onPress={() => setTab('performed')} style={[styles.tab, tab === 'performed' && styles.tabActive]}>
              <Text style={[styles.tabText, tab === 'performed' && styles.tabTextActive]}>Performed</Text>
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'plan' }} onPress={() => setTab('plan')} style={[styles.tab, tab === 'plan' && styles.tabActive]}>
              <Text style={[styles.tabText, tab === 'plan' && styles.tabTextActive]}>Plan / Compare</Text>
            </Pressable>
          </View>
        </View>

        {tab === 'performed' ? (
          <>
            <View style={styles.movementStack}>
              {shownMovements.length ? shownMovements.map((movement, index) => (
                <PerformedMovementCard key={movement.item_id || `${movement.label}-${index}`} movement={movement} unit={unit} initiallyExpanded onVideo={openVideo} />
              )) : (
                <View style={[styles.emptyCard, styles.sectionShell]}>
                  <Ionicons name="document-text-outline" size={24} color={SLColors.textMuted} />
                  <Text style={styles.emptyTitle}>No performed sets were recorded</Text>
                  <Text style={styles.emptyBody}>This historical session has no persisted SetLog evidence.</Text>
                </View>
              )}
            </View>

            {hiddenMovementCount > 0 ? (
              <View style={styles.sectionShell}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAllMovements }} onPress={() => setShowAllMovements((value) => !value)} style={({ pressed }) => [styles.moreMovements, pressed && styles.pressed]}>
                  <Text style={styles.moreMovementsText}>{showAllMovements ? 'Show fewer movements' : `${hiddenMovementCount} more movement${hiddenMovementCount === 1 ? '' : 's'}`}</Text>
                  <Ionicons name={showAllMovements ? 'chevron-up' : 'chevron-down'} size={18} color={SLColors.textSecondary} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.sectionShell}>
              <View style={styles.evidenceSummary}>
                {recap.session.video_count > 0 && firstVideoSet ? <EvidenceButton icon="videocam-outline" color={SLColors.accentMuted} value={recap.session.video_count} label="Videos" onPress={() => openVideo(firstVideoSet)} /> : null}
                {prCount > 0 ? <EvidenceButton icon="flash-outline" color={SLColors.warning} value={prCount} label="PRs" onPress={() => setShowAccomplishments((value) => !value)} /> : null}
                {recap.accomplishments.length > 0 ? <EvidenceButton icon="trophy-outline" color="#FF9F42" value={recap.accomplishments.length} label="Achievements" onPress={() => setShowAccomplishments((value) => !value)} /> : null}
                {feedback ? <EvidenceButton icon="chatbox-ellipses-outline" color={SLColors.info} value={1} label="Feedback" onPress={() => setShowFeedback((value) => !value)} /> : null}
              </View>
            </View>

            {showAccomplishments && recap.accomplishments.length ? (
              <View style={styles.sectionShell}>
                <View style={styles.detailCard}>
                  <Text style={styles.cardKicker}>ACCOMPLISHMENTS</Text>
                  <Text style={styles.cardTitle}>Earned this session</Text>
                  {recap.accomplishments.map((row, index) => (
                    <View key={row.id || index} style={styles.factRow}>
                      <Ionicons name="sparkles" size={15} color={SLColors.accentMuted} />
                      <View style={styles.factCopy}>
                        <Text style={styles.factTitle}>{accomplishmentTitle(row)}</Text>
                        {row.movement_label ? <Text style={styles.factMeta}>{row.movement_label}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {showFeedback && feedback ? (
              <View style={styles.sectionShell}>
                <View style={styles.detailCard}>
                  <Text style={styles.cardKicker}>COACH FEEDBACK</Text>
                  <Text style={styles.cardTitle}>Session review</Text>
                  <Text style={styles.quote}>{feedback}</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.sectionShell}>
            <View style={styles.planNotice}>
              <Ionicons name="git-compare-outline" size={18} color={SLColors.accentMuted} />
              <Text style={styles.planNoticeText}>Planned work is comparison context. Persisted SetLogs remain the session record.</Text>
            </View>
            <View style={styles.planStack}>
              {recap.plan.movements.map((item, index) => {
                const performed = performedMovements.find((movement) => movement.item_id === item.item_id);
                return (
                  <View key={item.item_id || index} style={styles.planRow}>
                    <View style={styles.planIndex}><Text style={styles.planIndexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                    <View style={styles.planCopy}>
                      <Text style={styles.planTitle}>{item.label || 'Movement'}</Text>
                      <Text style={styles.compareLabel}>PLANNED</Text>
                      <Text style={styles.planPrescription}>{planPrescription(item, unit)}</Text>
                      <Text style={styles.compareLabel}>PERFORMED</Text>
                      <Text style={styles.performedPrescription}>{performedPrescription(performed, unit)}</Text>
                      {item.notes ? <Text style={styles.planNotes}>{item.notes}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
            {recap.plan.programming_notes ? (
              <View style={styles.detailCard}>
                <Text style={styles.cardKicker}>PROGRAMMING NOTES</Text>
                <Text style={styles.quote}>{recap.plan.programming_notes}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <SetVideoPlayerModal visible={!!video} videoId={video?.id || null} initialVideo={video?.summary || null} initialUrl={video?.summary?.url || null} onClose={() => setVideo(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SLColors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 80, paddingHorizontal: 14, paddingBottom: 10, backgroundColor: SLColors.canvas },
  topButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.object },
  topBarCopy: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8 },
  topTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 17 },
  topDot: { color: SLColors.accentMuted },
  topSubtitle: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12 },
  completeMark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceInset },
  content: { gap: 12 },
  sectionShell: { marginHorizontal: 12 },
  hero: { overflow: 'hidden', padding: 16, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.object, ...SLShadows.level2 },
  heroHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 1.4 },
  heroTitle: { marginTop: 5, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 24 },
  heroMeta: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12 },
  notesButton: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingHorizontal: 11, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset },
  notesButtonText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 },
  summaryMetricRow: { flexDirection: 'row', marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard },
  summaryMetric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 5, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderSubtle },
  summaryMetricCopy: { flex: 1, minWidth: 0 },
  summaryMetricValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 14 },
  summaryMetricLabel: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8 },
  sectionLabel: { marginBottom: 8, color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 1.15 },
  highlightsBoard: { flexDirection: 'row', overflow: 'hidden', borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  highlightMetric: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 13, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderStandard },
  highlightTopLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  highlightValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 15 },
  highlightLabel: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 9 },
  highlightCaption: { marginTop: 6, fontFamily: SLFontFamilies.body, fontSize: 8 },
  tabs: { flexDirection: 'row', padding: 3, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset },
  tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md },
  tabActive: { backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected },
  tabText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  tabTextActive: { color: SLColors.textPrimary },
  movementStack: { gap: 10, paddingHorizontal: 12 },
  movementCard: { overflow: 'hidden', borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  coreMovementCard: { borderLeftWidth: 2, borderLeftColor: SLColors.accent },
  movementHeader: { flexDirection: 'row', alignItems: 'center', padding: 11 },
  artwork: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceMedia },
  artworkImage: { width: 44, height: 44 },
  movementHeaderCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  movementEyebrow: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.9 },
  supersetBadge: { overflow: 'hidden', color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 7, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: SLColors.accentSoft },
  movementTitle: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 16 },
  equipmentLine: { marginTop: 3, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 9 },
  prBadge: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(55, 199, 113, 0.5)', backgroundColor: 'rgba(31, 170, 92, 0.12)' },
  prBadgeText: { color: SLColors.success, fontFamily: SLFontFamilies.display, fontSize: 11 },
  collapseButton: { width: 34, height: 34, marginLeft: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: SLColors.surfaceInset },
  setTable: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard, paddingHorizontal: 10 },
  setHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 27 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 45, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle },
  columnLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.7 },
  setValue: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 11 },
  setValueStrong: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  setNumberColumn: { width: 34 },
  loadColumn: { flex: 1.25 },
  loadColumnRow: { flex: 1.25, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  repsColumn: { width: 45 },
  effortColumn: { width: 45 },
  videoColumn: { width: 58, alignItems: 'flex-end' },
  setPr: { overflow: 'hidden', color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 7, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(31, 170, 92, 0.12)' },
  videoButton: { width: 54, height: 34, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceMedia },
  videoThumbnail: { ...StyleSheet.absoluteFillObject },
  videoPlay: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(4,5,9,0.7)' },
  equipmentFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard },
  equipmentItem: { flexDirection: 'row', alignItems: 'center', flexGrow: 1, gap: 8 },
  equipmentCopy: { flex: 1, minWidth: 70 },
  equipmentModel: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 },
  equipmentImplementation: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8, textTransform: 'capitalize' },
  moreMovements: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset },
  moreMovementsText: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  evidenceSummary: { flexDirection: 'row', overflow: 'hidden', borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  evidenceButton: { flex: 1, minWidth: 0, minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderStandard },
  evidenceValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 13 },
  evidenceLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 8 },
  detailCard: { padding: 14, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  cardKicker: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 1.1 },
  cardTitle: { marginTop: 3, marginBottom: 10, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 16 },
  reflectionFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10, marginBottom: 10 },
  factPill: { overflow: 'hidden', color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: SLColors.surfaceInset, textTransform: 'capitalize' },
  quote: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle },
  factCopy: { flex: 1, minWidth: 0 },
  factTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11, textTransform: 'capitalize' },
  factMeta: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 9 },
  emptyCard: { alignItems: 'center', padding: 26, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  emptyTitle: { marginTop: 9, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 },
  emptyBody: { marginTop: 5, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10, textAlign: 'center' },
  planNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.accentSoft },
  planNoticeText: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10, lineHeight: 15 },
  planStack: { gap: 9, marginTop: 10, marginBottom: 10 },
  planRow: { flexDirection: 'row', padding: 13, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  planIndex: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: SLColors.surfaceInset },
  planIndexText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.display, fontSize: 9 },
  planCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  planTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 13 },
  compareLabel: { marginTop: 8, color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 7, letterSpacing: 0.8 },
  planPrescription: { marginTop: 2, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 },
  performedPrescription: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, lineHeight: 15 },
  planNotes: { marginTop: 7, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 9, lineHeight: 14 },
  pressed: { opacity: 0.72 },
});
