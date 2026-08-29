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
import { analyticalMetricDefinition, formatAnalyticalValue } from '@/lib/chart-fidelity';
import type { CoachAnalyticsMetricKey, CoachAnalyticsOutlier, CoachTeamBriefResponse } from '@/lib/coach-mobile';

const LABELS: Record<CoachAnalyticsMetricKey, string> = { max_progression: 'Max progression', dots_progression: 'Estimated DOTS progression', adherence: 'Adherence', pr_rate: 'PR rate' };
type Filter = 'all' | 'below' | 'above';

export default function CoachTeamOutliersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string; metric?: string; period?: string }>();
  const [brief, setBrief] = useState<CoachTeamBriefResponse | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const period = typeof params.period === 'string' ? params.period : '4W';
      const response = await fetchJson<CoachTeamBriefResponse>(`/coach/mobile/team-brief?period=${period}`, { method: 'GET' });
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || `Unable to load outliers (${response.status}).`);
      setBrief(response.json);
    } catch (reason: any) {
      setError(reason?.message || 'Unable to load outlier evidence.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [params.period]);

  React.useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (brief?.outliers || []).filter((row) => filter === 'all' || row.direction === filter), [brief?.outliers, filter]);

  return (
    <SLScreen contentStyle={styles.screen} edges="top" padded={false}>
      <View style={styles.header}><Pressable accessibilityLabel="Back to Team Brief" accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons color={COACH_V2.text} name="chevron-back" size={23} /></Pressable><View style={styles.headerCopy}><Text style={styles.headerTitle}>OUTLIERS</Text><Text style={styles.headerSubtitle}>{brief ? `${brief.period.start || 'All time'} – ${brief.period.end}` : 'Team evidence'}</Text></View><View style={styles.headerSpacer} /></View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COACH_V2.violetBright} />} showsVerticalScrollIndicator={false}>
        <View style={styles.filters}>{(['all', 'below', 'above'] as Filter[]).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={({ pressed }) => [styles.filter, filter === value && styles.filterActive, pressed && styles.pressed]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'all' ? 'All' : value === 'below' ? 'Below Range' : 'Above Range'}</Text></Pressable>)}</View>
        {loading && !brief ? <SLLoadingState message="Comparing normalized athlete evidence." title="Loading outliers" /> : null}
        {error && !brief ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load()} title="Outliers unavailable" /> : null}
        {brief && !brief.data_quality.cohort_band_supported ? <View style={styles.empty}><Ionicons color={COACH_V2.gold} name="people-outline" size={28} /><Text style={styles.emptyTitle}>Cohort too small for outlier claims</Text><Text style={styles.emptyCopy}>Strength Ledger requires at least four comparable athletes before applying robust cohort bands. Individual evidence remains available in Athlete Deep Dive.</Text></View> : null}
        {brief?.data_quality.cohort_band_supported && !rows.length ? <View style={styles.empty}><Ionicons color={COACH_V2.green} name="checkmark-circle-outline" size={28} /><Text style={styles.emptyTitle}>No athletes in this outlier view</Text><Text style={styles.emptyCopy}>No evidence falls outside the selected robust cohort band.</Text></View> : null}
        {rows.map((row) => <OutlierCard brief={brief!} key={`${row.athlete_id}:${row.metric}`} onOpen={() => router.push({ pathname: '/coach-athlete-analytics/[athleteId]', params: { athleteId: String(row.athlete_id), period: brief?.period.key || '4W' } } as any)} row={row} />)}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SLScreen>
  );
}

function OutlierCard({ brief, onOpen, row }: { brief: CoachTeamBriefResponse; onOpen: () => void; row: CoachAnalyticsOutlier }) {
  const athleteSeries = brief.progress.athlete_series_by_metric?.[row.metric]?.[String(row.athlete_id)] || [];
  const teamSeries = brief.progress.series_by_metric?.[row.metric] || [];
  const color = row.direction === 'below' ? COACH_V2.magenta : COACH_V2.green;
  const definition = analyticalMetricDefinition(row.metric);
  return <Pressable accessibilityLabel={`Open ${row.name} athlete deep dive`} accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.card, { borderColor: `${color}66` }, pressed && styles.pressed]}><View style={styles.cardTop}><View style={[styles.avatar, { borderColor: color }]}><Text style={styles.avatarText}>{row.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</Text></View><View style={styles.cardTitle}><Text style={[styles.direction, { color }]}>{row.direction === 'below' ? 'BELOW NORMAL RANGE' : 'ABOVE NORMAL RANGE'}</Text><Text style={styles.name}>{row.name}</Text><Text style={styles.metric}>{LABELS[row.metric]}</Text></View><Text style={[styles.value, { color }]}>{formatAnalyticalValue(row.value, definition)}</Text><Ionicons color={COACH_V2.muted} name="chevron-forward" size={19} /></View><CoachAnalyticsTrend athlete={athleteSeries} metric={row.metric} team={teamSeries} /><View style={styles.bandRow}><Text style={styles.bandLabel}>ROBUST BAND</Text><Text style={styles.bandValue}>{formatAnalyticalValue(row.band.low, definition)} – {formatAnalyticalValue(row.band.high, definition)}</Text></View><View style={styles.factors}><Text style={styles.factorsTitle}>Potential factors</Text>{row.potential_factors.map((factor) => <Text key={factor} style={styles.factor}>• {factor}</Text>)}<Text style={styles.caution}>{row.interpretation}</Text></View></Pressable>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000' }, header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#20232B' }, iconButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#0E0A15', borderWidth: 1, borderColor: '#30283A', alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, alignItems: 'center' }, headerTitle: { color: COACH_V2.text, fontSize: 16, fontWeight: '900' }, headerSubtitle: { color: COACH_V2.muted, fontSize: 10, marginTop: 3 }, headerSpacer: { width: 44 }, content: { padding: 14, gap: 12 }, filters: { flexDirection: 'row', padding: 3, borderRadius: 20, backgroundColor: '#080A0F', borderWidth: 1, borderColor: '#232631' }, filter: { flex: 1, minHeight: 37, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, filterActive: { backgroundColor: '#261537' }, filterText: { color: COACH_V2.muted, fontSize: 10, fontWeight: '700' }, filterTextActive: { color: COACH_V2.violetBright }, empty: { minHeight: 220, borderRadius: 15, borderWidth: 1, borderColor: '#282C35', backgroundColor: '#090B10', alignItems: 'center', justifyContent: 'center', padding: 24 }, emptyTitle: { color: COACH_V2.text, fontSize: 16, fontWeight: '800', marginTop: 10, textAlign: 'center' }, emptyCopy: { color: COACH_V2.muted, fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: 'center' }, card: { borderRadius: 15, borderWidth: 1, backgroundColor: '#090B10', padding: 13 }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 39, height: 39, borderRadius: 20, borderWidth: 1, backgroundColor: '#17111F', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: COACH_V2.text, fontSize: 11, fontWeight: '800' }, cardTitle: { flex: 1, minWidth: 0 }, direction: { fontSize: 8, fontWeight: '900', letterSpacing: 0.45 }, name: { color: COACH_V2.text, fontSize: 14, fontWeight: '800', marginTop: 3 }, metric: { color: COACH_V2.muted, fontSize: 9, marginTop: 2 }, value: { fontSize: 20, fontWeight: '900' }, bandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#252833' }, bandLabel: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '800' }, bandValue: { color: COACH_V2.text, fontSize: 10, fontWeight: '800' }, factors: { marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: '#0D0A12' }, factorsTitle: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }, factor: { color: COACH_V2.text, fontSize: 10, lineHeight: 15, marginTop: 5 }, caution: { color: COACH_V2.subtle, fontSize: 9, fontStyle: 'italic', marginTop: 8 }, pressed: { opacity: 0.74, transform: [{ scale: 0.987 }] }, bottomSpace: { height: 40 },
});
