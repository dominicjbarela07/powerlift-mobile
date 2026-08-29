import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { CoachAnalyticsTrend } from '@/components/coach-mobile/CoachAnalyticsTrend';
import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { fetchJson } from '@/lib/api';
import type { CoachAnalyticsMetricKey, CoachAthleteTeamRelativeResponse } from '@/lib/coach-mobile';

const METRICS: CoachAnalyticsMetricKey[] = ['max_progression', 'dots_progression', 'adherence', 'pr_rate'];
const LABELS: Record<CoachAnalyticsMetricKey, string> = { max_progression: 'Max Progression', dots_progression: 'Estimated DOTS', adherence: 'Adherence', pr_rate: 'PR Rate' };

function valueText(value?: number | null) { return value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`; }

export default function CoachAthleteAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string; period?: string }>();
  const athleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const period = Array.isArray(params.period) ? params.period[0] : params.period || '4W';
  const [payload, setPayload] = useState<CoachAthleteTeamRelativeResponse | null>(null);
  const [metric, setMetric] = useState<CoachAnalyticsMetricKey>('max_progression');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!athleteId) { setError('Athlete identity is missing.'); setLoading(false); return; }
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<CoachAthleteTeamRelativeResponse>(`/coach/mobile/athletes/${athleteId}/team-relative-analytics?period=${period}`, { method: 'GET' });
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || `Unable to load athlete analytics (${response.status}).`);
      setPayload(response.json);
    } catch (reason: any) { setError(reason?.message || 'Unable to load athlete analytics.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [athleteId, period]);
  React.useEffect(() => { void load(); }, [load]);

  const selectedMetric = payload?.athlete.metrics[metric];
  const factors = useMemo(() => payload?.outliers.flatMap((row) => row.potential_factors) || [], [payload?.outliers]);
  return (
    <SLScreen contentStyle={styles.screen} edges="top" padded={false}>
      <View style={styles.header}><Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons color={COACH_V2.text} name="chevron-back" size={23} /></Pressable><View style={styles.headerCopy}><Text numberOfLines={1} style={styles.headerTitle}>{payload?.athlete.name || 'ATHLETE DEEP DIVE'}</Text><Text style={styles.headerSubtitle}>Progress vs Team · {period}</Text></View><View style={styles.headerSpacer} /></View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COACH_V2.violetBright} />} showsVerticalScrollIndicator={false}>
        {loading && !payload ? <SLLoadingState message="Reconciling athlete and team evidence." title="Loading deep dive" /> : null}
        {error && !payload ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load()} title="Athlete analytics unavailable" /> : null}
        {payload ? <>
          <View style={styles.contextCard}><View style={styles.avatar}><Text style={styles.avatarText}>{payload.athlete.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</Text></View><View style={styles.flexOne}><Text style={styles.name}>{payload.athlete.name}</Text><Text style={styles.context}>{payload.athlete.block?.name || payload.athlete.program?.name || 'No active program context'}</Text></View><Text style={styles.period}>{payload.period.key}</Text></View>
          <Text style={styles.sectionTitle}>SUMMARY</Text><View style={styles.metricGrid}>{METRICS.map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: metric === key }} onPress={() => setMetric(key)} style={({ pressed }) => [styles.metricCard, metric === key && styles.metricCardActive, pressed && styles.pressed]}><Text style={[styles.metricValue, payload.athlete.metrics[key].cohort_state === 'below' ? styles.negative : payload.athlete.metrics[key].cohort_state === 'above' ? styles.positive : null]}>{valueText(payload.athlete.metrics[key].value)}</Text><Text style={styles.metricLabel}>{LABELS[key]}</Text><Text style={styles.teamValue}>Team {valueText(payload.athlete.metrics[key].team_average)}</Text></Pressable>)}</View>
          <Text style={styles.sectionTitle}>PROGRESS VS TEAM</Text><View style={styles.chartCard}><View style={styles.chartHeader}><View><Text style={styles.chartTitle}>{LABELS[metric]}</Text><Text style={styles.chartSubtitle}>Athlete evidence against the selected team period</Text></View><Text style={[styles.chartValue, selectedMetric?.cohort_state === 'below' ? styles.negative : styles.positive]}>{valueText(selectedMetric?.value)}</Text></View><CoachAnalyticsTrend athlete={payload.progress.athlete_series_by_metric[metric] || []} team={payload.progress.team_series_by_metric[metric] || []} /><View style={styles.bandRow}><Text style={styles.bandLabel}>COHORT BAND</Text><Text style={styles.bandValue}>{payload.bands[metric]?.n && payload.bands[metric]!.n >= 4 ? `${payload.bands[metric]?.low}% – ${payload.bands[metric]?.high}%` : 'Small cohort · no outlier claim'}</Text></View></View>
          <Text style={styles.sectionTitle}>EVIDENCE & CONTEXT</Text><View style={styles.evidenceCard}><EvidenceRow label="Current program" value={payload.athlete.program?.name || '—'} /><EvidenceRow label="Current block" value={payload.athlete.block?.name || '—'} /><EvidenceRow label="Evidence" value={`${selectedMetric?.evidence.observations || 0} observations · ${selectedMetric?.evidence.level || 'insufficient'}`} /><EvidenceRow label="Interpretation" value={payload.outliers.find((row) => row.metric === metric)?.interpretation || 'Review alongside athlete history and program context.'} />{factors.length ? <View style={styles.factorBlock}><Text style={styles.factorTitle}>Potential factors</Text>{[...new Set(factors)].map((factor) => <Text key={factor} style={styles.factor}>• {factor}</Text>)}</View> : null}</View>
          <Pressable accessibilityLabel={`Open ${payload.athlete.name} Athlete Workspace`} accessibilityRole="button" onPress={() => router.push({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(payload.athlete.athlete_id), athleteName: payload.athlete.name } } as any)} style={({ pressed }) => [styles.workspaceButton, pressed && styles.pressed]}><Text style={styles.workspaceButtonText}>Open Athlete Workspace</Text><Ionicons color={COACH_V2.violetBright} name="chevron-forward" size={19} /></Pressable>
          <Text style={styles.limit}>This surface identifies evidence-backed associations, not causal effects of coaching.</Text>
        </> : null}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SLScreen>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) { return <View style={styles.evidenceRow}><Text style={styles.evidenceLabel}>{label}</Text><Text style={styles.evidenceValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000' }, header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#20232B' }, iconButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#0E0A15', borderWidth: 1, borderColor: '#30283A', alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, alignItems: 'center' }, headerTitle: { color: COACH_V2.text, fontSize: 15, fontWeight: '900' }, headerSubtitle: { color: COACH_V2.violetBright, fontSize: 10, marginTop: 3 }, headerSpacer: { width: 44 }, content: { padding: 14, gap: 10 }, contextCard: { minHeight: 77, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#2B2E38', backgroundColor: '#090B10', flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: COACH_V2.violet, backgroundColor: '#191023', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: COACH_V2.text, fontSize: 13, fontWeight: '900' }, flexOne: { flex: 1, minWidth: 0 }, name: { color: COACH_V2.text, fontSize: 17, fontWeight: '900' }, context: { color: COACH_V2.muted, fontSize: 10, marginTop: 3 }, period: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900' }, sectionTitle: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 0.4, marginTop: 7 }, metricGrid: { flexDirection: 'row', gap: 6 }, metricCard: { flex: 1, minHeight: 90, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#252934', backgroundColor: '#090B10' }, metricCardActive: { borderColor: COACH_V2.violet, backgroundColor: '#160D20' }, metricValue: { color: COACH_V2.text, fontSize: 17, fontWeight: '900' }, metricLabel: { color: COACH_V2.muted, fontSize: 7, lineHeight: 10, fontWeight: '800', marginTop: 5, textTransform: 'uppercase' }, teamValue: { color: COACH_V2.subtle, fontSize: 7, marginTop: 'auto' }, negative: { color: COACH_V2.magenta }, positive: { color: COACH_V2.green }, chartCard: { borderRadius: 14, borderWidth: 1, borderColor: '#292D37', backgroundColor: '#090B10', padding: 12 }, chartHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, chartTitle: { color: COACH_V2.text, fontSize: 14, fontWeight: '900' }, chartSubtitle: { color: COACH_V2.muted, fontSize: 9, marginTop: 3 }, chartValue: { fontSize: 20, fontWeight: '900' }, bandRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#262A34' }, bandLabel: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '800' }, bandValue: { color: COACH_V2.text, fontSize: 9, fontWeight: '700' }, evidenceCard: { borderRadius: 14, borderWidth: 1, borderColor: '#292D37', backgroundColor: '#090B10', paddingHorizontal: 12 }, evidenceRow: { minHeight: 48, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#242832', gap: 12 }, evidenceLabel: { width: 100, color: COACH_V2.subtle, fontSize: 9, textTransform: 'uppercase' }, evidenceValue: { flex: 1, color: COACH_V2.text, fontSize: 10, lineHeight: 15 }, factorBlock: { paddingVertical: 11 }, factorTitle: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '900' }, factor: { color: COACH_V2.text, fontSize: 10, lineHeight: 15, marginTop: 5 }, workspaceButton: { minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: COACH_V2.violet, backgroundColor: '#130B1C', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, workspaceButtonText: { color: COACH_V2.text, fontSize: 13, fontWeight: '900' }, limit: { color: COACH_V2.subtle, fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 18 }, pressed: { opacity: 0.74, transform: [{ scale: 0.987 }] }, bottomSpace: { height: 44 },
});
