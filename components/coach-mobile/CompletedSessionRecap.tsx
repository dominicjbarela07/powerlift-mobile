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
import { SLColors, SLFontFamilies, SLRadius, SLShadows } from '@/constants/theme';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { accessoryMuscleRegion } from '@/lib/accessory-muscle-group';
import { resolveLoggerLiftIdentity } from '@/lib/logger-visual-context';

export type CompletedRecapSet = {
  id: number;
  set_index?: number | null;
  actual_weight_kg?: number | null;
  actual_reps?: number | null;
  actual_rpe?: number | null;
  actual_rir?: number | null;
  video_attachment_id?: number | null;
  video_id?: number | null;
  video?: SetVideoSummary | null;
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
  equipment?: { label?: string | null }[];
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

type Props = {
  recap: CompletedSessionRecapPayload;
  preferredUnits?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
};

type RecapTab = 'performed' | 'plan';

const LB_PER_KG = 2.2046226218;

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

function durationLabel(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
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

function effortLabel(set: CompletedRecapSet) {
  if (set.actual_rpe != null) return `RPE ${numberLabel(set.actual_rpe)}`;
  if (set.actual_rir != null) return `${numberLabel(set.actual_rir)} RIR`;
  return '—';
}

function MovementArtwork({ movement }: { movement: CompletedRecapMovement }) {
  if (movement.kind === 'accessory') {
    const region = accessoryMuscleRegion({
      movement: movement.label,
      movement_identity: { primary_muscle_group: movement.primary_muscle_group },
    });
    const artwork = accessoryMuscleRegionAsset(region.key);
    return <Image accessibilityIgnoresInvertColors resizeMode="contain" source={artwork.source} style={styles.artworkImage} />;
  }
  const identity = resolveLoggerLiftIdentity({ lift: movement.lift, movement: movement.label });
  if (identity.iconSource) {
    return <Image accessibilityIgnoresInvertColors resizeMode="contain" source={identity.iconSource} style={styles.artworkImage} />;
  }
  return <Ionicons name="barbell-outline" size={28} color={SLColors.accentMuted} />;
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SetHeader() {
  return (
    <View style={styles.setHeader}>
      <Text style={[styles.columnLabel, styles.setNumberColumn]}>SET</Text>
      <Text style={[styles.columnLabel, styles.loadColumn]}>LOAD</Text>
      <Text style={[styles.columnLabel, styles.repsColumn]}>REPS</Text>
      <Text style={[styles.columnLabel, styles.effortColumn]}>EFFORT</Text>
      <View style={styles.videoColumn} />
    </View>
  );
}

function PerformedMovementCard({
  movement,
  unit,
  onVideo,
}: {
  movement: CompletedRecapMovement;
  unit: 'kg' | 'lb';
  onVideo: (set: CompletedRecapSet) => void;
}) {
  const equipment = (movement.equipment || []).map((row) => row.label).filter(Boolean).join(' · ');
  return (
    <View style={styles.movementCard}>
      <View style={styles.movementHeader}>
        <View style={styles.artwork}><MovementArtwork movement={movement} /></View>
        <View style={styles.movementHeaderCopy}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.movementEyebrow}>{movement.kind === 'core' ? 'CORE LIFT' : 'ACCESSORY'}</Text>
            {movement.superset_group ? <Text style={styles.supersetBadge}>SUPERSET {movement.superset_group}</Text> : null}
          </View>
          <Text style={styles.movementTitle}>{movement.label}</Text>
          {equipment ? <Text style={styles.equipmentLine}>{equipment}</Text> : null}
        </View>
      </View>
      <View style={styles.setTable}>
        <SetHeader />
        {movement.sets.map((set, index) => {
          const videoId = set.video_attachment_id || set.video_id || set.video?.id;
          return (
            <View key={set.id || index} style={[styles.setRow, index === movement.sets.length - 1 && styles.setRowLast]}>
              <Text style={[styles.setValue, styles.setNumberColumn]}>{set.set_index || index + 1}</Text>
              <Text style={[styles.setValueStrong, styles.loadColumn]}>{loadLabel(set.actual_weight_kg, unit)}</Text>
              <Text style={[styles.setValue, styles.repsColumn]}>{set.actual_reps === 0 ? 'Fail' : numberLabel(set.actual_reps, 0)}</Text>
              <Text style={[styles.setValue, styles.effortColumn]}>{effortLabel(set)}</Text>
              <View style={styles.videoColumn}>
                {videoId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Play video for set ${set.set_index || index + 1}`}
                    hitSlop={8}
                    onPress={() => onVideo(set)}
                    style={({ pressed }) => [styles.videoButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="play" size={13} color={SLColors.textPrimary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
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
  if (low != null && high != null) {
    parts.push(Number(low) === Number(high) ? loadLabel(low, unit) : `${loadLabel(low, unit)}–${loadLabel(high, unit)}`);
  }
  return parts.join(' · ');
}

function accomplishmentTitle(row: Record<string, any>) {
  return String(row.headline || row.title || row.presentation_title || row.event_label || row.event_type || 'Accomplishment')
    .replace(/^CORE_/, '')
    .replace(/_/g, ' ');
}

export function CompletedSessionRecap({ recap, preferredUnits, refreshing, onRefresh, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const unit: 'kg' | 'lb' = ['lb', 'lbs'].includes(String(preferredUnits || '').toLowerCase()) ? 'lb' : 'kg';
  const [tab, setTab] = useState<RecapTab>('performed');
  const [video, setVideo] = useState<{ id: number; summary?: SetVideoSummary | null } | null>(null);
  const supersetGroups = useMemo(
    () => new Set(recap.performed_movements.map((row) => row.superset_group).filter(Boolean)).size,
    [recap.performed_movements],
  );
  const hasReflection = recap.reflection.session_rpe != null
    || !!recap.reflection.strength
    || !!recap.reflection.fatigue
    || !!String(recap.reflection.note || '').trim();
  const feedback = String(recap.coach_feedback.feedback || '').trim();

  const openVideo = (set: CompletedRecapSet) => {
    const id = Number(set.video_attachment_id || set.video_id || set.video?.id);
    if (Number.isFinite(id) && id > 0) setVideo({ id, summary: set.video || null });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 14) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close completed session recap" onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={SLColors.textPrimary} />
        </Pressable>
        <View style={styles.topBarCopy}>
          <Text style={styles.topKicker}>SESSION RECAP</Text>
          <Text numberOfLines={1} style={styles.topTitle}>{recap.session.label}</Text>
        </View>
        <View style={styles.completeMark}><Ionicons name="checkmark" size={17} color={SLColors.success} /></View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 28 }]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={SLColors.accent} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroAccent} />
          <Text style={styles.heroKicker}>COMPLETED</Text>
          <Text style={styles.heroTitle}>{recap.athlete.name}</Text>
          <Text style={styles.heroMeta}>{dateLabel(recap.session.date)} · {durationLabel(recap.session.duration_seconds)}</Text>
          <View style={styles.metricRow}>
            <Metric value={String(recap.session.movement_count)} label="Movements" />
            <Metric value={String(recap.session.set_count)} label="Sets" />
            <Metric value={loadLabel(recap.session.total_volume_kg, unit)} label="Volume" />
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'performed' }} onPress={() => setTab('performed')} style={[styles.tab, tab === 'performed' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'performed' && styles.tabTextActive]}>Performed</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'plan' }} onPress={() => setTab('plan')} style={[styles.tab, tab === 'plan' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'plan' && styles.tabTextActive]}>Plan / Compare</Text>
          </Pressable>
        </View>

        {tab === 'performed' ? (
          <>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionKicker}>ACTUAL WORK</Text>
                <Text style={styles.sectionTitle}>What was performed</Text>
              </View>
              {supersetGroups ? <Text style={styles.sectionCount}>{supersetGroups} superset{supersetGroups === 1 ? '' : 's'}</Text> : null}
            </View>
            {recap.performed_movements.length ? recap.performed_movements.map((movement, index) => (
              <PerformedMovementCard key={movement.item_id || `${movement.label}-${index}`} movement={movement} unit={unit} onVideo={openVideo} />
            )) : (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={24} color={SLColors.textMuted} />
                <Text style={styles.emptyTitle}>No performed sets were recorded</Text>
                <Text style={styles.emptyBody}>This completed session has no persisted SetLog evidence.</Text>
              </View>
            )}

            {recap.accomplishments.length ? (
              <View style={styles.evidenceCard}>
                <View style={styles.evidenceCardHeading}>
                  <View style={[styles.evidenceIcon, styles.accomplishmentIcon]}><Ionicons name="trophy-outline" size={18} color={SLColors.warning} /></View>
                  <View><Text style={styles.cardKicker}>ACCOMPLISHMENTS</Text><Text style={styles.cardTitle}>Earned this session</Text></View>
                </View>
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
            ) : null}

            {hasReflection ? (
              <View style={styles.evidenceCard}>
                <View style={styles.evidenceCardHeading}>
                  <View style={styles.evidenceIcon}><Ionicons name="pulse-outline" size={18} color={SLColors.accentMuted} /></View>
                  <View><Text style={styles.cardKicker}>ATHLETE REFLECTION</Text><Text style={styles.cardTitle}>How the session felt</Text></View>
                </View>
                <View style={styles.reflectionMetrics}>
                  {recap.reflection.session_rpe != null ? <Metric value={numberLabel(recap.reflection.session_rpe)} label="Session RPE" /> : null}
                  {recap.reflection.strength ? <Metric value={String(recap.reflection.strength)} label="Strength" /> : null}
                  {recap.reflection.fatigue ? <Metric value={String(recap.reflection.fatigue)} label="Fatigue" /> : null}
                </View>
                {recap.reflection.note ? <Text style={styles.quote}>{recap.reflection.note}</Text> : null}
              </View>
            ) : null}

            {feedback ? (
              <View style={styles.evidenceCard}>
                <View style={styles.evidenceCardHeading}>
                  <View style={styles.evidenceIcon}><Ionicons name="chatbubble-ellipses-outline" size={18} color={SLColors.info} /></View>
                  <View><Text style={styles.cardKicker}>COACH FEEDBACK</Text><Text style={styles.cardTitle}>Session review</Text></View>
                </View>
                <Text style={styles.quote}>{feedback}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.sectionHeading}>
              <View><Text style={styles.sectionKicker}>SECONDARY CONTEXT</Text><Text style={styles.sectionTitle}>Original prescription</Text></View>
            </View>
            <View style={styles.planNotice}>
              <Ionicons name="git-compare-outline" size={18} color={SLColors.accentMuted} />
              <Text style={styles.planNoticeText}>The plan is shown for comparison. Performed evidence remains the session record.</Text>
            </View>
            {recap.plan.movements.map((item, index) => (
              <View key={item.item_id || index} style={styles.planRow}>
                <View style={styles.planIndex}><Text style={styles.planIndexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <View style={styles.planCopy}>
                  <Text style={styles.planTitle}>{item.label || 'Movement'}</Text>
                  <Text style={styles.planPrescription}>{planPrescription(item, unit)}</Text>
                  {item.notes ? <Text style={styles.planNotes}>{item.notes}</Text> : null}
                </View>
              </View>
            ))}
            {recap.plan.programming_notes ? (
              <View style={styles.evidenceCard}>
                <Text style={styles.cardKicker}>PROGRAMMING NOTES</Text>
                <Text style={styles.quote}>{recap.plan.programming_notes}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <SetVideoPlayerModal
        visible={!!video}
        videoId={video?.id || null}
        initialVideo={video?.summary || null}
        initialUrl={video?.summary?.url || null}
        onClose={() => setVideo(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SLColors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 78, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderSubtle, backgroundColor: SLColors.canvasRaised },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.object },
  topBarCopy: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  topKicker: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 1.3 },
  topTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 18, marginTop: 2 },
  completeMark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(143,178,154,0.38)', backgroundColor: 'rgba(143,178,154,0.10)' },
  content: { padding: 16, gap: 14 },
  hero: { overflow: 'hidden', padding: 20, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.object, ...SLShadows.level2 },
  heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: SLColors.accent },
  heroKicker: { color: SLColors.success, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 1.6 },
  heroTitle: { marginTop: 6, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 28 },
  heroMeta: { marginTop: 5, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 13 },
  metricRow: { flexDirection: 'row', marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard, paddingTop: 15 },
  metric: { flex: 1, minWidth: 0 },
  metricValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 16, textTransform: 'capitalize' },
  metricLabel: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md },
  tabActive: { backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected },
  tabText: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 },
  tabTextActive: { color: SLColors.textPrimary },
  sectionHeading: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionKicker: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 1.2 },
  sectionTitle: { marginTop: 3, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 20 },
  sectionCount: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11 },
  movementCard: { overflow: 'hidden', borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  movementHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  artwork: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceMedia },
  artworkImage: { width: 52, height: 52 },
  movementHeaderCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  movementEyebrow: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 1.1 },
  supersetBadge: { overflow: 'hidden', color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9, backgroundColor: SLColors.accentSoft },
  movementTitle: { marginTop: 4, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 17 },
  equipmentLine: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 },
  setTable: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderStandard, paddingHorizontal: 12 },
  setHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 31 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle },
  setRowLast: { marginBottom: 4 },
  columnLabel: { color: SLColors.textMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 8, letterSpacing: 0.9 },
  setValue: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12 },
  setValueStrong: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 },
  setNumberColumn: { width: 34 },
  loadColumn: { flex: 1.2 },
  repsColumn: { width: 48 },
  effortColumn: { flex: 1 },
  videoColumn: { width: 34, alignItems: 'flex-end' },
  videoButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.surfaceSelected },
  evidenceCard: { padding: 16, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  evidenceCardHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 13 },
  evidenceIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset },
  accomplishmentIcon: { borderColor: 'rgba(200,171,114,0.32)', backgroundColor: 'rgba(200,171,114,0.08)' },
  cardKicker: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 1.15 },
  cardTitle: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 16 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderSubtle },
  factCopy: { flex: 1, minWidth: 0 },
  factTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12, textTransform: 'capitalize' },
  factMeta: { marginTop: 2, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10 },
  reflectionMetrics: { flexDirection: 'row', marginBottom: 14 },
  quote: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 13, lineHeight: 20 },
  emptyCard: { alignItems: 'center', padding: 28, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  emptyTitle: { marginTop: 10, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 14 },
  emptyBody: { marginTop: 5, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 11, textAlign: 'center' },
  planNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.accentSoft },
  planNoticeText: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 16 },
  planRow: { flexDirection: 'row', padding: 14, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceFlat },
  planIndex: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: SLColors.surfaceInset },
  planIndexText: { color: SLColors.accentMuted, fontFamily: SLFontFamilies.display, fontSize: 10 },
  planCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  planTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 14 },
  planPrescription: { marginTop: 4, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 11 },
  planNotes: { marginTop: 6, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.72 },
});
