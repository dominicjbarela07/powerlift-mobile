import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import {
  CoachBrandHeader,
  CoachCardChevron,
  CoachMetricTile,
  CoachSectionHeading,
  CoachStatusBadge,
  COACH_V2,
} from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLAthleteAvatar, SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import {
  athleteTrainingLabel,
  deriveCoachHomeFromRoster,
  formatCoachRelativeDate,
  formatCoachVolume,
} from '@/lib/coach-mobile-v2';
import type { CoachHomeResponse, CoachRosterAthlete, CoachRosterResponse } from '@/lib/coach-mobile';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function normalizeHome(payload: CoachHomeResponse) {
  return {
    ...payload,
    attention_athletes: (payload.attention_athletes || []).map((athlete) => ({
      ...athlete,
      ...normalizeProfilePhotoPayload(athlete),
    })),
    recent_activity: (payload.recent_activity || []).map((activity) => ({
      ...activity,
      athlete: {
        ...activity.athlete,
        ...normalizeProfilePhotoPayload(activity.athlete),
      },
    })),
  };
}

export function CoachHomeV2({ previewCoachName, previewData }: { previewCoachName?: string; previewData?: CoachHomeResponse }) {
  const router = useRouter();
  const { user } = useAuth();
  const accountKey = user?.email || String(user?.athlete_id || '');
  const accountKeyRef = useRef(accountKey);
  const requestRef = useRef(0);
  const previewMode = Boolean(previewData);
  const [data, setData] = useState<CoachHomeResponse | null>(previewData || null);
  const [loading, setLoading] = useState(!previewData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = useMemo(() => {
    const name = String(user?.user_name || '').trim();
    return previewCoachName || name.split(/\s+/)[0] || String(user?.email || '').split('@')[0] || 'Coach';
  }, [previewCoachName, user?.email, user?.user_name]);

  useEffect(() => {
    accountKeyRef.current = accountKey;
    requestRef.current += 1;
    if (!previewMode) setData(null);
  }, [accountKey, previewMode]);

  useEffect(() => {
    if (previewData) {
      setData(previewData);
      setLoading(false);
    }
  }, [previewData]);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (previewMode) return;
    const requestAccount = accountKey;
    const sequence = ++requestRef.current;
    const current = () => accountKeyRef.current === requestAccount && requestRef.current === sequence;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      let response = await fetchJson('/coach/mobile/home', { method: 'GET' });
      let payload = response.json as CoachHomeResponse | null;
      // This fallback keeps DEV/TestFlight functional during a rolling backend
      // deployment. It consumes the same authoritative roster facts and is not
      // a competing attention engine.
      if (response.status === 404) {
        response = await fetchJson('/coach/mobile/roster', { method: 'GET' });
        const roster = response.json as CoachRosterResponse | null;
        payload = response.ok && roster?.ok ? deriveCoachHomeFromRoster(roster) : null;
      }
      if (!current()) return;
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || `Could not load Coach Home. (${response.status})`);
        return;
      }
      setData(normalizeHome(payload));
    } catch (loadError) {
      if (!current()) return;
      console.warn('Coach Home V2 load failed', loadError);
      setError('Network error. Pull to refresh or try again.');
    } finally {
      if (current()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [accountKey, previewMode, router]);

  useFocusEffect(useCallback(() => {
    void load({ silent: true });
  }, [load]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load({ silent: true });
    });
    return () => subscription.remove();
  }, [load]);

  const openAthlete = useCallback((athlete: CoachRosterAthlete) => {
    router.push({
      pathname: '/(tabs)/coach-athlete/[athleteId]',
      params: { athleteId: String(athlete.id), athleteName: athlete.name },
    } as any);
  }, [router]);

  const openAttention = useCallback((athlete: CoachRosterAthlete) => {
    router.push({
      pathname: '/(tabs)/coach-attention/[athleteId]',
      params: {
        athleteId: String(athlete.id),
        athleteName: athlete.name,
        reasonType: athlete.primary_attention_reason?.reason_type || '',
      },
    } as any);
  }, [router]);

  if (loading && !data) {
    return <SLScreen edges="top" padded={false}><SLLoadingState message="Finding the coaching work that matters now." title="Loading Coach Home" /></SLScreen>;
  }

  return (
    <SLScreen edges="top" padded={false} style={styles.screen}>
      <CoachBrandHeader
        onBrief={() => router.push('/coach-team-brief' as any)}
        onSettings={() => router.push('/(tabs)/settings')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={COACH_V2.violet} onRefresh={() => load({ silent: true })} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <SLAthleteAvatar
            imageUrl={user?.profilePhotoUrl}
            imageVersion={user?.profilePhotoVersion}
            name={user?.user_name || firstName}
            size={48}
          />
          <Text style={styles.greeting}>{greeting(new Date())}, {firstName}</Text>
        </View>

        {error ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load()} title="Coach Home unavailable" /> : null}

        {data ? (
          <>
            <View style={styles.metrics}>
              <CoachMetricTile color={COACH_V2.magenta} icon="alert-circle-outline" label="Need You" value={data.summary.needs_you} />
              <CoachMetricTile color={COACH_V2.gold} icon="eye-outline" label="Review" value={data.summary.reviews} />
              <CoachMetricTile color={COACH_V2.cyan} icon="calendar-outline" label="Programming" value={data.summary.programming} />
              <CoachMetricTile color={COACH_V2.violetBright} icon="checkbox-outline" label="Check-In" value={data.summary.check_ins} />
            </View>

            <View style={styles.section}>
              <CoachSectionHeading action={data.attention_total ? `View all ${data.attention_total}` : undefined} onAction={() => router.push({ pathname: '/(tabs)/coach-roster', params: { filter: 'needs_attention' } } as any)} title="Needs Your Attention" />
              {data.attention_athletes.length ? data.attention_athletes.map((athlete) => (
                <AttentionAthleteCard athlete={athlete} key={athlete.id} onAttention={() => openAttention(athlete)} onPress={() => openAthlete(athlete)} />
              )) : (
                <View style={styles.quietCard}>
                  <Ionicons color={COACH_V2.green} name="checkmark-circle-outline" size={24} />
                  <View style={styles.quietCopy}>
                    <Text style={styles.quietTitle}>No active coaching flags</Text>
                    <Text style={styles.quietText}>Recent evidence remains available below.</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <CoachSectionHeading action="View all athletes" onAction={() => router.push('/(tabs)/coach-roster')} title="Recent Activity" />
              {data.recent_activity.length ? data.recent_activity.map((activity) => (
                <Pressable
                  accessibilityLabel={`Open ${activity.athlete.name}`}
                  accessibilityRole="button"
                  key={`${activity.athlete.id}-${activity.session.workout_id}`}
                  onPress={() => router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(activity.athlete.id), athleteName: activity.athlete.name } } as any)}
                  style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}
                >
                  <SLAthleteAvatar imageUrl={(activity.athlete as any).profilePhotoUrl} imageVersion={(activity.athlete as any).profilePhotoVersion} name={activity.athlete.name} size={42} />
                  <View style={styles.activityCopy}>
                    <View style={styles.activityTopline}>
                      <Text numberOfLines={1} style={styles.activityName}>{activity.athlete.name}</Text>
                      <Text style={styles.activityDate}>{formatCoachRelativeDate(activity.session.date)}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.activitySession}>Completed {activity.session.label}</Text>
                    <Text style={styles.activityEvidence}>
                      {[
                        activity.session.set_count ? `${activity.session.set_count} sets` : null,
                        formatCoachVolume(activity.session.total_volume_kg),
                        activity.session.pr_count ? `${activity.session.pr_count} PR${activity.session.pr_count === 1 ? '' : 's'}` : null,
                      ].filter(Boolean).join(' · ') || 'Performed evidence recorded'}
                    </Text>
                  </View>
                  <CoachCardChevron />
                </Pressable>
              )) : <Text style={styles.emptyActivity}>No completed Session activity is available yet.</Text>}
            </View>
          </>
        ) : null}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SLScreen>
  );
}

function AttentionAthleteCard({ athlete, onAttention, onPress }: { athlete: CoachRosterAthlete; onAttention: () => void; onPress: () => void }) {
  const reason = athlete.primary_attention_reason;
  return (
    <View style={styles.attentionCard}>
      <Pressable accessibilityLabel={`Open ${athlete.name} Athlete Hub`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.attentionIdentity, pressed && styles.pressed]}>
        <SLAthleteAvatar imageUrl={athlete.profilePhotoUrl} imageVersion={athlete.profilePhotoVersion} name={athlete.name} size={50} statusColor={COACH_V2.magenta} />
        <View style={styles.attentionNameWrap}>
          <View style={styles.attentionNameLine}>
            <Text numberOfLines={1} style={styles.attentionName}>{athlete.name}</Text>
            <CoachStatusBadge label={athlete.status.label} tone="danger" />
          </View>
          <Text numberOfLines={1} style={styles.attentionReason}>{reason?.title || 'Needs coaching attention'}</Text>
          <Text numberOfLines={1} style={styles.attentionTraining}>{athleteTrainingLabel(athlete)}</Text>
        </View>
        <CoachCardChevron />
      </Pressable>
      <View style={styles.attentionEvidence}>
        <Evidence label="Last Session" value={athlete.last_completed_session ? formatCoachRelativeDate(athlete.last_completed_session.date) : 'No history'} tone={COACH_V2.green} />
        <Evidence label="Readiness" value={athlete.readiness.score == null ? '—' : athlete.readiness.score.toFixed(1)} tone={athlete.readiness.score != null && athlete.readiness.score < 3 ? COACH_V2.magenta : COACH_V2.cyan} />
        <Evidence label="Review" value={String((athlete.pending_video_reviews?.count || 0) + (athlete.pending_session_reviews?.count || 0))} tone={COACH_V2.violetBright} />
      </View>
      <Pressable accessibilityRole="button" onPress={onAttention} style={styles.attentionAction}>
        <Text style={styles.attentionActionText}>Why this needs you</Text>
        <Ionicons color={COACH_V2.violetBright} name="arrow-forward" size={15} />
      </Pressable>
    </View>
  );
}

function Evidence({ label, tone, value }: { label: string; tone: string; value: string }) {
  return (
    <View style={styles.evidence}>
      <Text style={styles.evidenceLabel}>{label}</Text>
      <Text style={[styles.evidenceValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COACH_V2.black },
  content: { gap: 14, paddingTop: 14 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  greeting: { color: COACH_V2.text, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  metrics: { flexDirection: 'row', gap: 7 },
  section: { gap: 8 },
  attentionCard: { borderRadius: 12, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, overflow: 'hidden' },
  attentionIdentity: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingTop: 10 },
  attentionNameWrap: { flex: 1, minWidth: 0, gap: 3 },
  attentionNameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  attentionName: { flexShrink: 1, color: COACH_V2.text, fontSize: 15, fontWeight: '800' },
  attentionReason: { color: COACH_V2.text, fontSize: 13, fontWeight: '700' },
  attentionTraining: { color: COACH_V2.muted, fontSize: 11 },
  attentionEvidence: { margin: 8, marginTop: 4, flexDirection: 'row', borderRadius: 8, backgroundColor: '#0C0F16', borderWidth: 1, borderColor: '#1C202A' },
  evidence: { flex: 1, minHeight: 47, paddingHorizontal: 9, paddingVertical: 7, borderRightColor: COACH_V2.border, borderRightWidth: StyleSheet.hairlineWidth },
  evidenceLabel: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  evidenceValue: { marginTop: 4, fontSize: 12, fontWeight: '800' },
  attentionAction: { minHeight: 36, paddingHorizontal: 11, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COACH_V2.border },
  attentionActionText: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '700' },
  quietCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 11, borderWidth: 1, borderColor: `${COACH_V2.green}55`, backgroundColor: `${COACH_V2.green}0C`, padding: 14 },
  quietCopy: { flex: 1 },
  quietTitle: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  quietText: { marginTop: 3, color: COACH_V2.muted, fontSize: 11 },
  activityCard: { minHeight: 72, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  activityCopy: { flex: 1, minWidth: 0, gap: 2 },
  activityTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  activityName: { flex: 1, color: COACH_V2.text, fontSize: 13, fontWeight: '800' },
  activityDate: { color: COACH_V2.subtle, fontSize: 10 },
  activitySession: { color: COACH_V2.muted, fontSize: 12 },
  activityEvidence: { color: COACH_V2.green, fontSize: 10, fontWeight: '700' },
  emptyActivity: { color: COACH_V2.muted, fontSize: 12, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, padding: 16 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
  bottomSpace: { height: 84 },
});
