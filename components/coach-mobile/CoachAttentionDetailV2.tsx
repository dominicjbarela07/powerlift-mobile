import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CoachCardChevron,
  CoachMobileHeader,
  CoachSectionHeading,
  CoachSparkline,
  COACH_V2,
} from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { attentionActionLabel, formatCoachRelativeDate, formatCoachVolume } from '@/lib/coach-mobile-v2';
import { openCoachDestination, type CoachAthleteSummaryResponse, type CoachAttentionReason } from '@/lib/coach-mobile';

function reasonImpact(reason: CoachAttentionReason, athleteName: string) {
  const first = athleteName.split(/\s+/)[0] || 'This athlete';
  if (reason.reason_type === 'programming_gap') return `${first} has no future programmed coverage.`;
  if (reason.reason_type === 'programming_due') return `${first} is approaching the end of programmed coverage.`;
  if (reason.reason_type.includes('review')) return `${reason.count} review item${reason.count === 1 ? ' is' : 's are'} waiting.`;
  if (reason.reason_type === 'unread_message') return `${reason.count} unread message${reason.count === 1 ? ' is' : 's are'} waiting.`;
  if (reason.reason_type === 'check_in_overdue') return `${reason.count} required check-in${reason.count === 1 ? ' is' : 's are'} overdue.`;
  return reason.supporting_text || 'Open the source evidence before taking action.';
}

function detailDate(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', weekday: 'short' }).format(date);
}

export function CoachAttentionDetailV2({ previewReasonType, previewSummary }: { previewReasonType?: string; previewSummary?: CoachAthleteSummaryResponse }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string; reasonType?: string }>();
  const { user } = useAuth();
  const routeAthleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const athleteId = routeAthleteId || (previewSummary ? String(previewSummary.athlete.id) : undefined);
  const routeReasonType = Array.isArray(params.reasonType) ? params.reasonType[0] : params.reasonType;
  const reasonType = routeReasonType || previewReasonType;
  const requestKey = `${user?.email || user?.athlete_id || ''}:${athleteId || ''}`;
  const requestKeyRef = useRef(requestKey);
  const requestRef = useRef(0);
  const previewMode = Boolean(previewSummary);
  const [summary, setSummary] = useState<CoachAthleteSummaryResponse | null>(previewSummary || null);
  const [loading, setLoading] = useState(!previewSummary);
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

  const load = useCallback(async () => {
    if (previewMode) return;
    if (!athleteId) {
      setError('Athlete identity is missing.');
      setLoading(false);
      return;
    }
    const key = requestKey;
    const sequence = ++requestRef.current;
    const current = () => requestKeyRef.current === key && requestRef.current === sequence;
    setLoading(true);
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
        setError(payload?.error || `Could not load attention evidence. (${response.status})`);
        return;
      }
      setSummary(payload);
    } catch (loadError) {
      if (!current()) return;
      console.warn('Attention Detail V2 load failed', loadError);
      setError('Network error. Try again.');
    } finally {
      if (current()) setLoading(false);
    }
  }, [athleteId, previewMode, requestKey, router]);

  useEffect(() => { void load(); }, [load]);

  const reason = summary?.operational_status.reasons.find((item) => item.reason_type === reasonType)
    || summary?.operational_status.reasons[0];
  const training = summary?.current_training;
  const progress = training?.status === 'active' && training.week_position && training.week_total
    ? Math.min(100, Math.round((training.week_position / training.week_total) * 100))
    : null;
  const readinessValues = (summary?.readiness?.history || []).map((point) => point.score);
  const lastSession = summary?.recent_training?.find((session) => session.evidence_mode === 'performed');

  if (loading && !summary) {
    return <SLScreen edges="top" padded={false}><SLLoadingState message="Loading the source evidence." title="Loading Attention Detail" /></SLScreen>;
  }

  return (
    <SLScreen edges="top" padded={false} style={styles.screen}>
      <CoachMobileHeader onBack={() => router.back()} title="Needs Attention" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error && !summary ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={load} title="Attention detail unavailable" /> : null}
        {summary && reason ? (
          <>
            <View style={styles.hero}>
              <LinearGradient colors={['rgba(255,71,103,0.18)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.alertIcon}><Ionicons color={COACH_V2.magenta} name="alert" size={25} /></View>
              <Text style={styles.heroTitle}>{reason.title}</Text>
              <Text style={styles.heroSubtitle}>{reasonImpact(reason, summary.athlete.name)}</Text>
            </View>

            {training?.status === 'active' ? (
              <View style={styles.programCard}>
                <Text style={styles.cardEyebrow}>Program Status</Text>
                <Text style={styles.programName}>{training.block_name || training.program_name || 'Current Training'}</Text>
                <View style={styles.progressLine}>
                  <Text style={styles.programMeta}>Week {training.week_position || '—'} of {training.week_total || '—'}</Text>
                  {progress != null ? <Text style={styles.progressValue}>{progress}%</Text> : null}
                </View>
                {progress != null ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View> : null}
              </View>
            ) : null}

            <View style={styles.detailCard}>
              {reason.category === 'programming' ? (
                <>
                  <DetailRow icon="calendar-outline" label="Sessions Remaining" value={String(summary.programming_horizon.sessions_remaining ?? 0)} />
                  <DetailRow icon="time-outline" label="Ends On" value={detailDate(summary.programming_horizon.programmed_through_date || reason.due_at)} />
                </>
              ) : (
                <>
                  <DetailRow icon="layers-outline" label="Evidence Count" value={String(reason.count)} />
                  <DetailRow icon="time-outline" label="Evidence Date" value={detailDate(reason.updated_at || reason.due_at)} />
                </>
              )}
              <DetailRow icon="navigate-outline" label="Recommended Action" value={attentionActionLabel(reason)} />
            </View>

            <View style={styles.section}>
              <CoachSectionHeading action="View all" onAction={() => router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name } } as any)} title="Recent Readiness Trend" />
              <View style={styles.chartCard}>
                {readinessValues.length ? <CoachSparkline values={readinessValues} /> : <Text style={styles.noEvidence}>No readiness history is available.</Text>}
                <View style={styles.chartFooter}>
                  <Text style={styles.chartMeta}>{summary.readiness?.history?.[0]?.date ? formatCoachRelativeDate(summary.readiness.history[0].date) : 'No history'}</Text>
                  <Text style={[styles.chartLatest, { color: summary.readiness?.score != null && summary.readiness.score < 3 ? COACH_V2.magenta : COACH_V2.cyan }]}>{summary.readiness?.score == null ? '—' : `${summary.readiness.score.toFixed(1)} today`}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <CoachSectionHeading title="Last Session" />
              {lastSession ? (
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(tabs)/workout/[workoutId]', params: { workoutId: String(lastSession.workout_id) } } as any)} style={styles.sessionCard}>
                  <View style={styles.sessionArtwork}><Ionicons color={COACH_V2.gold} name="barbell-outline" size={26} /></View>
                  <View style={styles.sessionCopy}>
                    <Text style={styles.sessionName}>{lastSession.label}</Text>
                    <Text style={styles.sessionMeta}>{formatCoachRelativeDate(lastSession.date)} · Completed</Text>
                    <Text style={styles.sessionEvidence}>{[lastSession.set_count ? `${lastSession.set_count} sets` : null, formatCoachVolume(lastSession.total_volume_kg, summary.athlete.preferred_units), lastSession.pr_count ? `${lastSession.pr_count} PR${lastSession.pr_count === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'Performed evidence recorded'}</Text>
                  </View>
                  <CoachCardChevron />
                </Pressable>
              ) : <Text style={styles.noEvidence}>No completed Session evidence is available.</Text>}
            </View>

            <Pressable accessibilityRole="button" onPress={() => openCoachDestination(router, reason.destination)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{attentionActionLabel(reason)}</Text>
              <Ionicons color={COACH_V2.text} name="arrow-forward" size={17} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(summary.athlete.id), athleteName: summary.athlete.name } } as any)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>View Athlete Hub</Text>
            </Pressable>
          </>
        ) : summary ? (
          <View style={styles.resolvedCard}>
            <Ionicons color={COACH_V2.green} name="checkmark-circle-outline" size={30} />
            <Text style={styles.resolvedTitle}>This attention item is resolved</Text>
            <Text style={styles.resolvedText}>The current athlete evidence no longer contains this signal.</Text>
          </View>
        ) : null}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SLScreen>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons color={COACH_V2.muted} name={icon} size={17} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.detailValue}>{value}</Text>
      <CoachCardChevron />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COACH_V2.black },
  content: { gap: 12, paddingTop: 10 },
  hero: { minHeight: 150, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden', padding: 18 },
  alertIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COACH_V2.magenta, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { marginTop: 13, color: COACH_V2.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { marginTop: 5, color: COACH_V2.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  programCard: { borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 13 },
  cardEyebrow: { color: COACH_V2.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  programName: { marginTop: 7, color: COACH_V2.text, fontSize: 17, fontWeight: '800' },
  progressLine: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  programMeta: { color: COACH_V2.muted, fontSize: 11 },
  progressValue: { color: COACH_V2.text, fontSize: 12, fontWeight: '800' },
  progressTrack: { marginTop: 10, height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#272A35' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: COACH_V2.violet },
  detailCard: { overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface },
  detailRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderBottomColor: COACH_V2.border, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { flex: 1, color: COACH_V2.text, fontSize: 12, fontWeight: '700' },
  detailValue: { maxWidth: '43%', color: COACH_V2.muted, fontSize: 11, textAlign: 'right' },
  section: { gap: 7 },
  chartCard: { minHeight: 102, borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 12 },
  chartFooter: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  chartMeta: { color: COACH_V2.subtle, fontSize: 9 },
  chartLatest: { fontSize: 12, fontWeight: '800' },
  sessionCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 10 },
  sessionArtwork: { width: 54, height: 54, borderRadius: 8, backgroundColor: '#111017', borderWidth: 1, borderColor: `${COACH_V2.gold}55`, alignItems: 'center', justifyContent: 'center' },
  sessionCopy: { flex: 1, minWidth: 0, gap: 2 },
  sessionName: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  sessionMeta: { color: COACH_V2.muted, fontSize: 10 },
  sessionEvidence: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '700' },
  noEvidence: { color: COACH_V2.muted, fontSize: 11, borderRadius: 9, borderWidth: 1, borderColor: COACH_V2.border, padding: 14 },
  primaryButton: { minHeight: 48, borderRadius: 9, backgroundColor: '#5A2BA2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: COACH_V2.text, fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: COACH_V2.borderStrong, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: COACH_V2.muted, fontSize: 12, fontWeight: '700' },
  resolvedCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: `${COACH_V2.green}55`, backgroundColor: `${COACH_V2.green}0A`, padding: 20 },
  resolvedTitle: { color: COACH_V2.text, fontSize: 17, fontWeight: '800' },
  resolvedText: { color: COACH_V2.muted, fontSize: 12, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  bottomSpace: { height: 84 },
});
