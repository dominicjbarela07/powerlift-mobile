import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import {
  CoachCardChevron,
  CoachMobileHeader,
  CoachProgramArtwork,
  CoachSectionHeading,
  CoachStatusBadge,
  COACH_V2,
} from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLAthleteAvatar, SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import {
  attentionActionLabel,
  formatCoachRelativeDate,
  formatCoachVolume,
  formatCoachWeight,
} from '@/lib/coach-mobile-v2';
import type { CoachAthleteSummaryResponse, CoachRecentTrainingSession } from '@/lib/coach-mobile';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';

export function CoachAthleteHubV2({ previewSummary }: { previewSummary?: CoachAthleteSummaryResponse }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const { user } = useAuth();
  const routeAthleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const athleteId = routeAthleteId || (previewSummary ? String(previewSummary.athlete.id) : undefined);
  const accountKey = user?.email || String(user?.athlete_id || '');
  const requestKey = `${accountKey}:${athleteId || ''}`;
  const requestKeyRef = useRef(requestKey);
  const requestRef = useRef(0);
  const previewMode = Boolean(previewSummary);
  const [summary, setSummary] = useState<CoachAthleteSummaryResponse | null>(previewSummary || null);
  const [loading, setLoading] = useState(!previewSummary);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestKeyRef.current = requestKey;
    requestRef.current += 1;
    if (!previewMode) setSummary(null);
  }, [previewMode, requestKey]);

  useEffect(() => {
    if (previewSummary) {
      setSummary(previewSummary);
      setLoading(false);
    }
  }, [previewSummary]);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (previewMode) return;
    if (!athleteId) {
      setError('Athlete identity is missing.');
      setLoading(false);
      return;
    }
    const activeKey = requestKey;
    const sequence = ++requestRef.current;
    const current = () => requestKeyRef.current === activeKey && requestRef.current === sequence;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetchJson(`/coach/mobile/athletes/${athleteId}/summary`, { method: 'GET' });
      const payload = response.json as CoachAthleteSummaryResponse | null;
      if (!current()) return;
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (response.status === 403) {
        setError('This athlete is not in your active coaching relationships.');
        return;
      }
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || `Could not load athlete context. (${response.status})`);
        return;
      }
      setSummary({
        ...payload,
        athlete: { ...payload.athlete, ...normalizeProfilePhotoPayload(payload.athlete) },
      });
    } catch (loadError) {
      if (!current()) return;
      console.warn('Athlete Hub V2 load failed', loadError);
      setError('Network error. Try again.');
    } finally {
      if (current()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [athleteId, previewMode, requestKey, router]);

  useFocusEffect(useCallback(() => {
    void load({ silent: true });
  }, [load]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load({ silent: true });
    });
    return () => subscription.remove();
  }, [load]);

  const primaryReason = summary?.operational_status.reasons[0];
  const training = summary?.current_training;
  const progress = training?.status === 'active' && training.week_position && training.week_total
    ? Math.min(100, Math.max(0, Math.round((training.week_position / training.week_total) * 100)))
    : null;
  const preferredUnits = user?.preferred_units;

  const openMessage = useCallback(() => {
    if (!summary) return;
    const threadId = summary.unread_messages?.thread_id;
    if (threadId) {
      router.push({ pathname: '/(tabs)/messages/[threadId]', params: { threadId: String(threadId) } } as any);
    } else {
      router.push({ pathname: '/(tabs)/messages', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name } } as any);
    }
  }, [router, summary]);

  const openProgram = useCallback(() => {
    if (!summary) return;
    router.push({ pathname: '/(tabs)/workout', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name } } as any);
  }, [router, summary]);

  const openReview = useCallback(() => {
    if (!summary) return;
    router.push({ pathname: '/(tabs)/coach-videos', params: { athleteId: String(summary.athlete.id) } } as any);
  }, [router, summary]);

  const openMore = useCallback(() => {
    if (!summary) return;
    router.push({ pathname: '/(tabs)/coach-more', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name } } as any);
  }, [router, summary]);

  const actions = useMemo(() => [
    { label: 'Message', icon: 'chatbubble-ellipses-outline' as const, onPress: openMessage },
    { label: 'Program', icon: 'calendar-outline' as const, onPress: openProgram },
    { label: 'Review', icon: 'clipboard-outline' as const, onPress: openReview },
    { label: 'More', icon: 'ellipsis-horizontal' as const, onPress: openMore },
  ], [openMessage, openMore, openProgram, openReview]);

  if (loading && !summary) {
    return <SLScreen edges="top" padded={false}><SLLoadingState message="Building real athlete context." title="Loading Athlete Hub" /></SLScreen>;
  }

  return (
    <SLScreen edges="top" padded={false} style={styles.screen}>
      <CoachMobileHeader
        eyebrow="Athlete Hub"
        onBack={() => router.back()}
        onPrimary={openMore}
        title={summary?.athlete.name || String(params.athleteName || 'Athlete')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={COACH_V2.violet} onRefresh={() => load({ silent: true })} />}
        showsVerticalScrollIndicator={false}
      >
        {error && !summary ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load()} title="Athlete Hub unavailable" /> : null}
        {summary ? (
          <>
            <View style={styles.identity}>
              <SLAthleteAvatar imageUrl={summary.athlete.profilePhotoUrl} imageVersion={summary.athlete.profilePhotoVersion} name={summary.athlete.name} size={70} statusColor={summary.operational_status.tone === 'danger' ? COACH_V2.magenta : COACH_V2.green} />
              <View style={styles.identityCopy}>
                <Text numberOfLines={1} style={styles.athleteName}>{summary.athlete.name}</Text>
                <Text numberOfLines={1} style={styles.trainingLine}>
                  {training?.status === 'active'
                    ? [training.block_name || training.program_name, training.week_position && training.week_total ? `Week ${training.week_position} of ${training.week_total}` : null].filter(Boolean).join(' · ')
                    : training?.label || 'Training position unavailable'}
                </Text>
                <CoachStatusBadge label={summary.operational_status.label} tone={summary.operational_status.tone === 'danger' ? 'danger' : summary.operational_status.tone === 'warning' ? 'warning' : 'success'} />
              </View>
            </View>

            <View style={styles.actionStrip}>
              {actions.map((action) => (
                <Pressable accessibilityLabel={action.label} accessibilityRole="button" key={action.label} onPress={action.onPress} style={({ pressed }) => [styles.action, action.label === 'Program' && styles.actionPrimary, pressed && styles.pressed]}>
                  <Ionicons color={action.label === 'Program' ? COACH_V2.violetBright : COACH_V2.text} name={action.icon} size={20} />
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>

            {primaryReason ? (
              <View style={styles.section}>
                <CoachSectionHeading title="What Needs You" />
                <Pressable
                  accessibilityLabel={`Open attention detail: ${primaryReason.title}`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/(tabs)/coach-attention/[athleteId]', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name, reasonType: primaryReason.reason_type } } as any)}
                  style={({ pressed }) => [styles.attentionCard, pressed && styles.pressed]}
                >
                  <LinearGradient colors={['rgba(255,71,103,0.16)', 'rgba(19,8,15,0.96)']} style={StyleSheet.absoluteFillObject} />
                  <Text style={styles.attentionEyebrow}>What needs you</Text>
                  <Text style={styles.attentionTitle}>{primaryReason.title}</Text>
                  <Text style={styles.attentionText}>{primaryReason.supporting_text || 'Open the evidence and take the canonical action.'}</Text>
                  {summary.operational_status.reasons.length > 1 ? <Text style={styles.supportingReasons}>+{summary.operational_status.reasons.length - 1} supporting reason{summary.operational_status.reasons.length === 2 ? '' : 's'}</Text> : null}
                  <View style={styles.attentionCta}>
                    <Text style={styles.attentionCtaText}>{attentionActionLabel(primaryReason)}</Text>
                    <Ionicons color={COACH_V2.text} name="arrow-forward" size={16} />
                  </View>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.section}>
              <CoachSectionHeading title="Current Training" />
              <View style={styles.trainingCard}>
                <CoachProgramArtwork />
                <Text style={styles.trainingEyebrow}>{training?.program_name || 'Current Training'}</Text>
                <Text style={styles.blockName}>{training?.status === 'active' ? training.block_name || 'Active Block' : training?.label || 'No active program'}</Text>
                {training?.status === 'active' ? <Text style={styles.blockMeta}>Week {training.week_position || '—'} of {training.week_total || '—'}{progress != null ? ` · ${progress}%` : ''}</Text> : null}
                {progress != null ? (
                  <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <CoachSectionHeading title="Recent Signals" />
              <View style={styles.signalGrid}>
                <SignalTile
                  accent={summary.readiness?.score != null && summary.readiness.score < 3 ? COACH_V2.magenta : COACH_V2.cyan}
                  delta={summary.readiness?.delta}
                  icon="pulse-outline"
                  label="Readiness"
                  value={summary.readiness?.score == null ? '—' : summary.readiness.score.toFixed(1)}
                />
                <SignalTile
                  accent={COACH_V2.cyan}
                  icon="scale-outline"
                  label="Reported Bodyweight"
                  value={formatCoachWeight(summary.reported_bodyweight?.latest?.reported_bodyweight_kg, preferredUnits)}
                />
                <SignalTile
                  accent={COACH_V2.green}
                  icon="checkmark-done-outline"
                  label="Sessions"
                  value={summary.week_summary ? `${summary.week_summary.completed_sessions}/${summary.week_summary.scheduled_sessions}` : '—'}
                />
                <SignalTile
                  accent={COACH_V2.gold}
                  icon="star-outline"
                  label="PRs This Week"
                  value={summary.week_summary?.pr_count ?? '—'}
                />
              </View>
            </View>

            <View style={styles.section}>
              <CoachSectionHeading action="View all" onAction={() => router.push({ pathname: '/(tabs)/coach-calendar', params: { athleteId: String(summary.athlete.id) } } as any)} title="Recent Training" />
              {(summary.recent_training || []).length ? (summary.recent_training || []).map((session) => (
                <TrainingRow key={session.workout_id} onPress={() => router.push({ pathname: '/(tabs)/workout/[workoutId]', params: { workoutId: String(session.workout_id) } } as any)} preferredUnits={preferredUnits} session={session} />
              )) : <Text style={styles.emptyTraining}>No recent or upcoming Session evidence is available.</Text>}
            </View>

            {summary.coach_context.pinned_note?.body_preview ? (
              <View style={styles.contextCard}>
                <Ionicons color={COACH_V2.violetBright} name="document-text-outline" size={18} />
                <View style={styles.contextCopy}>
                  <Text style={styles.contextLabel}>Coach Context</Text>
                  <Text style={styles.contextText}>{summary.coach_context.pinned_note.body_preview}</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SLScreen>
  );
}

function SignalTile({ accent, delta, icon, label, value }: { accent: string; delta?: number | null; icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number }) {
  return (
    <View style={styles.signalTile}>
      <Ionicons color={accent} name={icon} size={17} />
      <Text style={styles.signalLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.signalValue}>{value}</Text>
      {delta != null ? <Text style={[styles.signalDelta, { color: delta < 0 ? COACH_V2.magenta : delta > 0 ? COACH_V2.green : COACH_V2.muted }]}>{delta > 0 ? '↑ ' : delta < 0 ? '↓ ' : ''}{Math.abs(delta).toFixed(1)}</Text> : null}
    </View>
  );
}

function TrainingRow({ onPress, preferredUnits, session }: { onPress: () => void; preferredUnits?: string | null; session: CoachRecentTrainingSession }) {
  const performed = session.evidence_mode === 'performed';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.trainingRow, pressed && styles.pressed]}>
      <View style={[styles.sessionIcon, { borderColor: performed ? `${COACH_V2.green}77` : `${COACH_V2.gold}77` }]}>
        <Ionicons color={performed ? COACH_V2.green : COACH_V2.gold} name={performed ? 'checkmark-circle-outline' : 'calendar-outline'} size={20} />
      </View>
      <View style={styles.trainingRowCopy}>
        <Text numberOfLines={1} style={styles.sessionName}>{session.label}</Text>
        <Text style={styles.sessionMeta}>{formatCoachRelativeDate(session.date)} · {performed ? 'Completed' : 'Assigned'}</Text>
        <Text style={styles.sessionEvidence}>
          {performed
            ? [session.set_count ? `${session.set_count} sets` : null, formatCoachVolume(session.total_volume_kg, preferredUnits), session.pr_count ? `${session.pr_count} PR${session.pr_count === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'Performed evidence recorded'
            : [session.movement_count ? `${session.movement_count} movements` : null, session.set_count ? `${session.set_count} planned sets` : null].filter(Boolean).join(' · ') || 'Plan available'}
        </Text>
      </View>
      <CoachCardChevron />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COACH_V2.black },
  content: { gap: 14, paddingTop: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 3 },
  identityCopy: { flex: 1, minWidth: 0, gap: 5 },
  athleteName: { color: COACH_V2.text, fontSize: 23, lineHeight: 27, fontWeight: '700' },
  trainingLine: { color: COACH_V2.muted, fontSize: 12 },
  actionStrip: { flexDirection: 'row', gap: 7 },
  action: { minHeight: 58, flex: 1, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionPrimary: { borderColor: `${COACH_V2.violet}88`, backgroundColor: '#171024' },
  actionLabel: { color: COACH_V2.text, fontSize: 10, fontWeight: '700' },
  section: { gap: 8 },
  attentionCard: { minHeight: 138, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: `${COACH_V2.magenta}77`, padding: 13 },
  attentionEyebrow: { color: COACH_V2.magenta, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  attentionTitle: { marginTop: 7, color: COACH_V2.text, fontSize: 18, fontWeight: '800' },
  attentionText: { marginTop: 5, color: COACH_V2.muted, fontSize: 12 },
  supportingReasons: { marginTop: 6, color: COACH_V2.magenta, fontSize: 10, fontWeight: '700' },
  attentionCta: { position: 'absolute', right: 11, bottom: 11, minHeight: 34, borderRadius: 8, backgroundColor: '#422139', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11 },
  attentionCtaText: { color: COACH_V2.text, fontSize: 11, fontWeight: '800' },
  trainingCard: { minHeight: 128, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 14 },
  trainingEyebrow: { color: COACH_V2.gold, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  blockName: { marginTop: 10, maxWidth: '64%', color: COACH_V2.text, fontSize: 21, fontWeight: '700', textTransform: 'uppercase' },
  blockMeta: { marginTop: 4, color: COACH_V2.muted, fontSize: 12 },
  progressTrack: { marginTop: 13, width: '58%', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: '#292D36' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: COACH_V2.violet },
  signalGrid: { flexDirection: 'row', gap: 6 },
  signalTile: { minHeight: 92, flex: 1, borderRadius: 9, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 8 },
  signalLabel: { marginTop: 7, color: COACH_V2.subtle, fontSize: 8, lineHeight: 10, fontWeight: '800', textTransform: 'uppercase' },
  signalValue: { marginTop: 4, color: COACH_V2.text, fontSize: 16, fontWeight: '700' },
  signalDelta: { marginTop: 2, fontSize: 9, fontWeight: '800' },
  trainingRow: { minHeight: 76, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  sessionIcon: { width: 46, height: 46, borderRadius: 8, borderWidth: 1, backgroundColor: '#080A0F', alignItems: 'center', justifyContent: 'center' },
  trainingRowCopy: { flex: 1, minWidth: 0, gap: 2 },
  sessionName: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  sessionMeta: { color: COACH_V2.muted, fontSize: 10 },
  sessionEvidence: { color: COACH_V2.text, fontSize: 10, fontWeight: '700' },
  emptyTraining: { color: COACH_V2.muted, fontSize: 12, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, padding: 16 },
  contextCard: { minHeight: 72, flexDirection: 'row', gap: 10, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 12 },
  contextCopy: { flex: 1 },
  contextLabel: { color: COACH_V2.violetBright, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  contextText: { marginTop: 4, color: COACH_V2.muted, fontSize: 11, lineHeight: 15 },
  pressed: { opacity: 0.72 },
  bottomSpace: { height: 84 },
});
