import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { fetchJson } from '@/lib/api';
import type { CoachTeamBriefResponse } from '@/lib/coach-mobile';

const TITLES: Record<string, string> = { max_progression: 'Max Progression', dots_progression: 'Estimated DOTS Progression', adherence: 'Adherence', pr_rate: 'PR Rate', normal_band: 'Normal Range', strength_score: 'Strength Score' };

export default function CoachTeamMethodologyScreen() {
  const router = useRouter();
  const [brief, setBrief] = useState<CoachTeamBriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetchJson<CoachTeamBriefResponse>('/coach/mobile/team-brief?period=4W', { method: 'GET' });
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Unable to load methodology.');
      setBrief(response.json);
    } catch (reason: any) { setError(reason?.message || 'Unable to load methodology.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <SLScreen contentStyle={styles.screen} edges="top" padded={false}><View style={styles.grabber} /><View style={styles.header}><View><Text style={styles.title}>TEAM BRIEF METHODOLOGY</Text><Text style={styles.subtitle}>How the Coach&apos;s Ledger interprets evidence</Text></View><Pressable accessibilityLabel="Close methodology" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Ionicons color={COACH_V2.text} name="close" size={25} /></Pressable></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{loading ? <SLLoadingState message="Loading metric definitions." title="Methodology" /> : null}{error ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={load} title="Methodology unavailable" /> : null}{brief ? <><View style={styles.principle}><Ionicons color={COACH_V2.violetBright} name="shield-checkmark-outline" size={24} /><View style={styles.flexOne}><Text style={styles.principleTitle}>Evidence first</Text><Text style={styles.principleCopy}>Stable athlete and canonical competition-Core identities define the analytical subject. Display names and unresolved historical text never do.</Text></View></View>{Object.entries(brief.methodology).map(([key, copy]) => <View key={key} style={styles.method}><Text style={styles.methodTitle}>{TITLES[key] || key}</Text><Text style={styles.methodCopy}>{copy}</Text></View>)}<View style={styles.quality}><Text style={styles.qualityTitle}>CURRENT DATA QUALITY</Text>{brief.data_quality.notes.map((note) => <Text key={note} style={styles.qualityCopy}>• {note}</Text>)}</View><Text style={styles.caution}>Team Brief reports associations and operational evidence. It does not attribute athlete outcomes causally to coaching.</Text></> : null}<View style={styles.bottomSpace} /></ScrollView></SLScreen>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#030408', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }, grabber: { width: 76, height: 5, borderRadius: 3, backgroundColor: '#626779', alignSelf: 'center', marginTop: 9 }, header: { minHeight: 78, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#242731' }, title: { color: COACH_V2.text, fontSize: 16, fontWeight: '900' }, subtitle: { color: COACH_V2.violetBright, fontSize: 10, marginTop: 4 }, close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#4F3964', backgroundColor: '#171020', alignItems: 'center', justifyContent: 'center' }, content: { padding: 15, gap: 10 }, principle: { minHeight: 105, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#593B78', backgroundColor: '#120B1B', flexDirection: 'row', alignItems: 'center', gap: 12 }, flexOne: { flex: 1 }, principleTitle: { color: COACH_V2.text, fontSize: 15, fontWeight: '900' }, principleCopy: { color: COACH_V2.muted, fontSize: 11, lineHeight: 17, marginTop: 4 }, method: { padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#292D37', backgroundColor: '#090B10' }, methodTitle: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, methodCopy: { color: COACH_V2.text, fontSize: 11, lineHeight: 17, marginTop: 6 }, quality: { padding: 13, borderRadius: 12, backgroundColor: '#0C1015', borderWidth: 1, borderColor: '#26303A' }, qualityTitle: { color: COACH_V2.cyan, fontSize: 11, fontWeight: '900' }, qualityCopy: { color: COACH_V2.muted, fontSize: 10, lineHeight: 16, marginTop: 5 }, caution: { color: COACH_V2.subtle, fontSize: 10, lineHeight: 16, textAlign: 'center', padding: 12 }, pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] }, bottomSpace: { height: 40 },
});
