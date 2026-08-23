import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AthleteProgramTimeline } from '@/components/training-hub/AthleteProgramTimeline';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLTypography } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import { buildProgramTimelinePayload, type ProgramTimelinePayload, type ProgramTimelineSession } from '@/lib/program-timeline';

export default function ProgramTimelineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ programId?: string; athleteId?: string }>();
  const programId = Number(params.programId || 0);
  const athleteId = params.athleteId ? String(params.athleteId) : null;
  const [payload, setPayload] = useState<ProgramTimelinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const endpoint = athleteId ? `/workouts/my_list/mobile/${athleteId}` : '/workouts/my_list/mobile';
      const response = await fetchJson(endpoint, { method: 'GET' });
      const body: any = response.json || {};
      if (!response.ok || !body.ok) throw new Error(body.error || body.message || `HTTP ${response.status}`);
      const mapped = buildProgramTimelinePayload(body);
      if (!mapped || (programId && mapped.program.id !== programId)) {
        throw new Error('This active Program Timeline is no longer available.');
      }
      setPayload(mapped);
    } catch (reason: any) {
      setError(reason?.message || 'Program Timeline could not load.');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId, programId]);

  useFocusEffect(useCallback(() => {
    void load(false);
  }, [load]));

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/workout' as any);
  }, [router]);

  const openSession = useCallback((session: ProgramTimelineSession) => {
    router.push({
      pathname: '/workout/[workoutId]',
      params: {
        workoutId: String(session.id),
        returnTo: 'program-timeline',
        programId: String(programId || payload?.program.id || ''),
        ...(athleteId ? { athleteView: 'coach-preview', coachAthleteId: athleteId } : {}),
      },
    });
  }, [athleteId, payload?.program.id, programId, router]);

  if (payload) {
    return (
      <AthleteProgramTimeline
        onBack={goBack}
        onOpenSession={openSession}
        onRefresh={() => void load(true)}
        payload={payload}
        refreshing={refreshing}
      />
    );
  }

  return (
    <View style={[styles.stateScreen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={goBack} style={styles.backButton}>
        <Ionicons color={SLColors.textStrong} name="chevron-back" size={25} />
      </Pressable>
      <View style={styles.stateBody}>
        {loading ? <ActivityIndicator color={SLColors.accentViolet} size="large" /> : <Ionicons color={SLColors.textMuted} name="map-outline" size={42} />}
        <Text style={styles.stateTitle}>{loading ? 'Building Program Timeline' : 'Program Timeline unavailable'}</Text>
        <Text style={styles.stateMessage}>{loading ? 'Mapping Blocks, Weeks, and Sessions.' : error}</Text>
        {!loading ? <Pressable accessibilityRole="button" onPress={() => void load(false)} style={styles.retry}><Text style={styles.retryText}>Try Again</Text></Pressable> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stateScreen: { flex: 1, backgroundColor: '#000', paddingHorizontal: 18 },
  backButton: { width: 50, height: 50, borderRadius: 16, backgroundColor: SLColors.surfaceInset, borderColor: SLColors.borderStandard, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stateBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
  stateTitle: { ...SLTypography.screenTitle, color: SLColors.textStrong, textAlign: 'center' },
  stateMessage: { ...SLTypography.body, color: SLColors.textMuted, textAlign: 'center' },
  retry: { minHeight: 46, paddingHorizontal: 22, borderRadius: 15, backgroundColor: SLColors.accentViolet, justifyContent: 'center', marginTop: 8 },
  retryText: { ...SLTypography.label, color: SLColors.canvas },
});
