import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLCanonicalIcon, SLTrophy } from '@/components/ui';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import { ledgerHrefFor } from './routing';
import { fetchArchiveDetail, type ArchiveItem, type ArchiveItemType } from '@/lib/ledger-archive';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

type ArchiveDetailItem = ArchiveItem & {
  sets?: ArchiveItem[];
  athlete_reflection?: Record<string, unknown> | null;
  athlete_visible_coach_feedback?: string | null;
  history_url?: string;
  match_scope?: string;
};

const TYPE_META: Record<ArchiveItemType, { label: string; icon: keyof typeof Ionicons.glyphMap; tone: string }> = {
  session: { label: 'Training session', icon: 'barbell-outline', tone: '#A98CFF' },
  set: { label: 'Performed set', icon: 'pulse-outline', tone: '#A98CFF' },
  video: { label: 'Preserved film', icon: 'videocam-outline', tone: '#5ED7CA' },
  meet: { label: 'Competition record', icon: 'trophy-outline', tone: '#D4AD62' },
  movement: { label: 'Movement history', icon: 'git-branch-outline', tone: '#7FA7D8' },
  historical_performance: { label: 'Imported history', icon: 'time-outline', tone: '#7FA7D8' },
};

function readable(key: string): string {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    if (key.endsWith('_kg')) return `${formatted} kg`;
    if (key.endsWith('_seconds')) {
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    return formatted;
  }
  return String(value);
}

function dateLabel(value?: string): string {
  if (!value) return 'Date unavailable';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function ArchiveDetailExperience() {
  const router = useRouter();
  const params = useLocalSearchParams<{ itemType?: string; sourceId?: string; collection?: string; q?: string; athlete_id?: string; date_from?: string; date_to?: string }>();
  const itemType = first(params.itemType) as ArchiveItemType;
  const sourceId = Number(first(params.sourceId));
  const athleteId = Number(first(params.athlete_id)) || undefined;
  const [item, setItem] = useState<ArchiveDetailItem | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'unauthorized' | 'error'>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!itemType || !Number.isInteger(sourceId)) { setState('unavailable'); return; }
    fetchArchiveDetail(itemType, sourceId, athleteId)
      .then((payload) => { setItem(payload.item as ArchiveDetailItem); setState('ready'); })
      .catch((error: Error & { status?: number }) => setState(
        error.status === 401 || error.status === 403
          ? 'unauthorized'
          : error.status === 404 || error.status === 410
            ? 'unavailable'
            : 'error',
      ));
  }, [athleteId, itemType, reloadToken, sourceId]);

  const back = () => router.replace({ pathname: ledgerHrefFor('archive') as never, params: { collection: first(params.collection), q: first(params.q), athlete_id: athleteId ? String(athleteId) : undefined, date_from: first(params.date_from), date_to: first(params.date_to) } } as never);
  const meta = TYPE_META[itemType] || TYPE_META.session;

  return <View style={styles.page} testID="ledger-archive-detail">
    <Pressable accessibilityLabel="Back to Archive results" onPress={back} style={styles.back}><Ionicons name="chevron-back" size={20} color={SLColors.iconPrimary} /><Text typographyRole="shortButtonLabel" style={styles.backText}>Archive</Text></Pressable>
    {state === 'loading' ? <DetailState loading icon="layers-outline" title="Opening source evidence" body="Retrieving the current authorized record…" /> : null}
    {state === 'unauthorized' ? <DetailState icon="lock-closed-outline" title="Archive access unavailable" body="Your session or access to this athlete's Archive could not be verified." /> : null}
    {state === 'unavailable' ? <DetailState icon="unlink-outline" title="Evidence unavailable" body="This source was deleted, invalidated, moved, or is no longer available." /> : null}
    {state === 'error' ? <DetailState icon="alert-circle-outline" title="Evidence could not be loaded" body="The source service did not return usable evidence." action="Try again" onAction={() => { setState('loading'); setReloadToken((value) => value + 1); }} /> : null}
    {state === 'ready' && item ? <View style={styles.detail}>
      <View style={styles.masthead}>
        <View style={[styles.typeSeal, { borderColor: `${meta.tone}70` }]}><SLCanonicalIcon name={meta.icon} size={26} color={meta.tone} trophyTier="bronze" /></View>
        <Text typographyRole="shortTechnicalLabel" style={[styles.kicker, { color: meta.tone }]}>{item.provenance_label || meta.label}</Text>
        <Text typographyRole="pageTitle" style={styles.title}>{item.title || String(item.movement?.name || meta.label)}</Text>
        {item.subtitle ? <Text typographyRole="body" style={styles.body}>{item.subtitle}</Text> : null}
        <View style={styles.metaRow}><MetaPill icon="calendar-outline" label={dateLabel(item.occurred_on)} /><MetaPill icon="shield-checkmark-outline" label={item.status || item.correction_state || 'Current truth'} /></View>
      </View>

      <View style={styles.integrity}><Ionicons name="finger-print-outline" size={21} color={SLColors.accentMuted} /><View style={styles.integrityCopy}><Text typographyRole="bodyStrong" style={styles.integrityTitle}>Preserved source truth</Text><Text typographyRole="caption" style={styles.integrityBody}>{item.invalidation_state === 'valid' || !item.invalidation_state ? 'Current authorized evidence with provenance intact.' : `Evidence state: ${item.invalidation_state}`}</Text></View></View>

      <DetailSection icon="speedometer-outline" title="Performance" value={item.performance} />
      {item.reported_bodyweight ? <DetailSection icon="scale-outline" title="Reported bodyweight" value={{ reported_bodyweight_kg: item.reported_bodyweight.reported_bodyweight_kg, training_date: item.reported_bodyweight.training_date, source: 'Pre-Session readiness' }} /> : null}
      <DetailSection icon="git-branch-outline" title="Movement identity" value={item.movement} />
      <DetailSection icon="albums-outline" title="Program context" value={item.program_context} />
      <MeetSection value={item.meet_context} />
      <DetailSection icon="videocam-outline" title="Media evidence" value={item.media} />
      {item.sets?.length ? <SetEvidence items={item.sets} /> : null}
      <DetailSection icon="create-outline" title="Athlete reflection" value={item.athlete_reflection} />
      {item.athlete_visible_coach_feedback ? <View style={styles.feedback}><View style={styles.feedbackIcon}><Ionicons name="chatbubble-ellipses-outline" size={21} color="#5ED7CA" /></View><View style={styles.feedbackCopy}><Text typographyRole="shortTechnicalLabel" style={styles.feedbackLabel}>ATHLETE-VISIBLE COACH FEEDBACK</Text><Text typographyRole="body" style={styles.feedbackBody}>{item.athlete_visible_coach_feedback}</Text></View></View> : null}
    </View> : null}
  </View>;
}

function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return <View style={styles.metaPill}><Ionicons name={icon} size={14} color={SLColors.iconMuted} /><Text typographyRole="caption" style={styles.metaText}>{label}</Text></View>;
}

function DetailState({ icon, title, body, loading = false, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; loading?: boolean; action?: string; onAction?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator color={SLColors.accent} /> : <View style={styles.stateIcon}><Ionicons name={icon} size={31} color={SLColors.accentMuted} /></View>}<Text typographyRole="emptyStateTitle" style={styles.stateTitle}>{title}</Text><Text typographyRole="emptyStateBody" style={styles.stateBody}>{body}</Text>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.stateAction}><Text typographyRole="shortButtonLabel" style={styles.stateActionText}>{action}</Text></Pressable> : null}</View>;
}

function DetailSection({ icon, title, value }: { icon: keyof typeof Ionicons.glyphMap; title: string; value?: Record<string, unknown> | null }) {
  const entries = Object.entries(value || {}).filter(([, entry]) => entry !== null && entry !== undefined && typeof entry !== 'object');
  if (!entries.length) return null;
  return <View style={styles.block}><View style={styles.blockHeading}><View style={styles.blockIcon}><Ionicons name={icon} size={18} color={SLColors.accentMuted} /></View><Text typographyRole="sectionTitle" style={styles.blockTitle}>{title}</Text></View><View style={styles.fields}>{entries.map(([key, entry]) => <View key={key} style={styles.field}><Text typographyRole="caption" style={styles.fieldName}>{readable(key)}</Text><Text typographyRole="bodyStrong" style={styles.fieldValue}>{displayValue(key, entry)}</Text></View>)}</View></View>;
}

function MeetSection({ value }: { value?: Record<string, unknown> | null }) {
  if (!value) return null;
  const basic = Object.fromEntries(Object.entries(value).filter(([key, entry]) => !['attempts', 'result_summary'].includes(key) && entry !== null && entry !== undefined));
  const summary = value.result_summary && typeof value.result_summary === 'object' ? value.result_summary as Record<string, unknown> : null;
  const attempts = Array.isArray(value.attempts) ? value.attempts as Record<string, unknown>[] : [];
  return <View style={styles.block}><View style={styles.blockHeading}><View style={[styles.blockIcon, styles.meetBlockIcon]}><SLTrophy size={18} tier="bronze" /></View><Text typographyRole="sectionTitle" style={styles.blockTitle}>Competition evidence</Text></View><DetailFields value={basic} />{summary ? <View style={styles.summaryBand}><Text typographyRole="shortTechnicalLabel" style={styles.summaryLabel}>RESULT SUMMARY</Text><DetailFields value={summary} compact /></View> : null}{attempts.length ? <View style={styles.attempts}><Text typographyRole="shortTechnicalLabel" style={styles.summaryLabel}>ATTEMPTS</Text>{attempts.map((attempt, index) => <View key={String(attempt.id || index)} style={styles.attempt}><Text typographyRole="bodyStrong" style={styles.attemptLift}>{String(attempt.lift || 'Attempt')} {String(attempt.attempt_number || index + 1)}</Text><Text typographyRole="bodyStrong" style={styles.attemptWeight}>{displayValue('weight_kg', attempt.weight_kg)}</Text><Text typographyRole="caption" style={[styles.attemptResult, attempt.result === 'good' && styles.attemptGood]}>{String(attempt.result || 'recorded')}</Text></View>)}</View> : null}</View>;
}

function DetailFields({ value, compact = false }: { value: Record<string, unknown>; compact?: boolean }) {
  return <View style={[styles.fields, compact && styles.fieldsCompact]}>{Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined && typeof entry !== 'object' && entry !== false).map(([key, entry]) => <View key={key} style={styles.field}><Text typographyRole="caption" style={styles.fieldName}>{readable(key)}</Text><Text typographyRole="bodyStrong" style={styles.fieldValue}>{displayValue(key, entry)}</Text></View>)}</View>;
}

function SetEvidence({ items }: { items: ArchiveItem[] }) {
  return <View style={styles.block}><View style={styles.blockHeading}><View style={styles.blockIcon}><Ionicons name="pulse-outline" size={18} color={SLColors.accentMuted} /></View><Text typographyRole="sectionTitle" style={styles.blockTitle}>Performed sets</Text><Text typographyRole="caption" style={styles.setCount}>{items.length}</Text></View><View style={styles.sets}>{items.map((item) => <View key={item.source_id} style={styles.setRow}><Text typographyRole="numeric" style={styles.setIndex}>{String(item.performance?.set_index || '—')}</Text><View style={styles.setCopy}><Text typographyRole="bodyStrong" style={styles.setTitle}>{item.title}</Text><Text typographyRole="caption" style={styles.setDetail}>{setPerformance(item)}</Text></View>{item.media?.video_count ? <Ionicons name="videocam-outline" size={17} color="#5ED7CA" /> : null}</View>)}</View></View>;
}

function setPerformance(item: ArchiveItem): string {
  const weight = item.performance?.weight_kg;
  const reps = item.performance?.reps;
  const rpe = item.performance?.rpe;
  const rir = item.performance?.rir;
  return [typeof weight === 'number' ? `${displayValue('weight_kg', weight)}` : null, typeof reps === 'number' ? `${reps} reps` : null, typeof rpe === 'number' ? `RPE ${rpe}` : typeof rir === 'number' ? `${rir} RIR` : null].filter(Boolean).join(' · ') || 'Performed evidence';
}

const styles = StyleSheet.create({
  page: { gap: SLSpacing.lg },
  back: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10 },
  backText: { color: SLColors.textPrimary },
  state: { minHeight: 340, alignItems: 'center', justifyContent: 'center', gap: 11, padding: 28 },
  stateIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected },
  stateTitle: { color: SLColors.textStrong, textAlign: 'center' },
  stateBody: { maxWidth: 430, color: SLColors.textSecondary, textAlign: 'center' },
  stateAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected },
  stateActionText: { color: SLColors.textStrong },
  detail: { gap: 14 },
  masthead: { alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  typeSeal: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceInset, borderWidth: 1 },
  kicker: { color: SLColors.accentMuted, textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: SLColors.textStrong, textAlign: 'center' },
  body: { maxWidth: 500, color: SLColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  metaPill: { minHeight: 33, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 17, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  metaText: { color: SLColors.textMuted },
  integrity: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceSelected, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSelected },
  integrityCopy: { flex: 1, minWidth: 0, gap: 3 },
  integrityTitle: { color: SLColors.textStrong },
  integrityBody: { color: SLColors.textSecondary },
  block: { overflow: 'hidden', borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  blockHeading: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider },
  blockIcon: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceSelected },
  meetBlockIcon: { backgroundColor: 'rgba(212,173,98,0.09)' },
  blockTitle: { flex: 1, color: SLColors.textStrong },
  fields: { paddingHorizontal: 15 },
  fieldsCompact: { paddingHorizontal: 0 },
  field: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider },
  fieldName: { flex: 1, color: SLColors.textMuted },
  fieldValue: { maxWidth: '56%', color: SLColors.textStrong, textAlign: 'right' },
  summaryBand: { gap: 4, margin: 12, marginTop: 0, padding: 13, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(212,173,98,0.30)' },
  summaryLabel: { color: '#D4AD62', letterSpacing: 0.8 },
  attempts: { gap: 0, marginHorizontal: 14, paddingBottom: 10 },
  attempt: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider },
  attemptLift: { flex: 1, color: SLColors.textStrong, textTransform: 'capitalize' },
  attemptWeight: { color: SLColors.textPrimary },
  attemptResult: { minWidth: 55, color: SLColors.textMuted, textAlign: 'right', textTransform: 'capitalize' },
  attemptGood: { color: SLColors.success },
  feedback: { minHeight: 94, flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: 'rgba(94,215,202,0.28)' },
  feedbackIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(94,215,202,0.08)' },
  feedbackCopy: { flex: 1, minWidth: 0, gap: 5 },
  feedbackLabel: { color: '#5ED7CA' },
  feedbackBody: { color: SLColors.textPrimary, lineHeight: 22 },
  setCount: { color: SLColors.textMuted },
  sets: { paddingHorizontal: 14 },
  setRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider },
  setIndex: { width: 27, color: SLColors.accentMuted, fontSize: 16 },
  setCopy: { flex: 1, minWidth: 0, gap: 2 },
  setTitle: { color: SLColors.textStrong },
  setDetail: { color: SLColors.textMuted },
});
