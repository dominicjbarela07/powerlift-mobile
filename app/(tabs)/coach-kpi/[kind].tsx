import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { API_BASE } from '@/lib/api';
import { colors } from '@/theme';

type KpiRow = {
  workout_id: number;
  athlete_id: number;
  athlete_name: string;
  date: string | null;
  label: string | null;
  status: string | null;
};

type KpiResponse = {
  ok: boolean;
  kind: string;
  title: string;
  rows: KpiRow[];
  error?: string;
};

function statusLabel(s?: string | null) {
  const v = (s || '').toLowerCase();
  if (!v) return 'assigned';
  return v.replaceAll('_', ' ');
}

export default function CoachKpiDetailScreen() {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind: string }>();

  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (data?.title) return data.title;
    if (kind === 'today_assigned') return 'Today Assigned';
    if (kind === 'today_logged') return 'Today Logged';
    if (kind === 'missed_yesterday') return 'Missed Yesterday';
    return 'KPI Detail';
  }, [data?.title, kind]);

  const load = async () => {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch(`${API_BASE}/coach/mobile/kpi/${kind}`, {
        method: 'GET',
        credentials: 'include',
      });

      const json = (await res.json()) as KpiResponse;

      if (!res.ok || !json.ok) {
        setError((json as any)?.error || 'Failed to load KPI detail.');
        setData(null);
        return;
      }

      setData(json);
    } catch (e) {
      console.log('KPI detail load error', e);
      setError('Network error. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!kind) return;
    load();
  }, [kind]);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText variant="h1">{title}</ThemedText>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <ThemedText variant="bodyMuted">Loading…</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText variant="error">{error}</ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {data?.rows?.length ? (
            data.rows.map((r) => (
              <View key={r.workout_id} style={styles.card}>
                <ThemedText variant="h3" style={styles.name}>{r.athlete_name}</ThemedText>
                <ThemedText variant="bodyMuted" style={styles.meta}>
                  {r.date || 'No date'} • {statusLabel(r.status)}
                </ThemedText>
                <ThemedText variant="body">
                  {r.label || 'Workout'}
                </ThemedText>
              </View>
            ))
          ) : (
            <View style={styles.card}>
              <ThemedText variant="bodyMuted">No workouts in this KPI.</ThemedText>
            </View>
          )}
        </ScrollView>
      )}

      <View style={{ marginTop: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText variant="small">Back</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: colors.bg,
  },
  header: {
    marginBottom: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  name: {
    marginBottom: 2,
  },
  meta: {
    marginBottom: 8,
  },
});