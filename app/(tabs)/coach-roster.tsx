// app/coach-roster.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchJson } from '@/lib/api';
import { useRouter } from 'expo-router';

type CoachRosterAthlete = {
  id: number;
  name: string;
  sex: string | null;
  bodyweight: number | null;
  squat_tm: number | null;
  bench_tm: number | null;
  deadlift_tm: number | null;
  dots: number;
  is_self: boolean;
};

type CoachRosterResponse = {
  ok: boolean;
  athletes: CoachRosterAthlete[];
  error?: string;
};

export default function CoachRosterScreen() {
  const [data, setData] = useState<CoachRosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const loadRoster = async () => {
    try {
      setError(null);
      const resp = await fetchJson('/coach/mobile/roster', { method: 'GET' });
      const json = resp.json as CoachRosterResponse | null;

      if (!resp.ok || !json?.ok) {
        setError(json?.error || `Failed to load roster. (${resp.status})`);
        return;
      }

      setData(json.athletes || []);
    } catch (e) {
      console.log('Coach roster load error', e);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRoster();
  };

  const formatKg = (v: number | null) =>
    v == null ? '—' : `${v.toFixed(1)} kg`;

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText variant="h1" style={styles.title}>Coach Roster</ThemedText>
        <ThemedText variant="bodyMuted" style={styles.subtitle}>
          {data.length} {data.length === 1 ? 'athlete' : 'athletes'}
        </ThemedText>
      </View>

      {loading && !refreshing && (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      )}

      {!loading && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9CA3AF"
            />
          }
        >
          {error && (
            <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
          )}

          {data.length === 0 && !error && (
            <ThemedText variant="bodyMuted" style={styles.emptyText}>
              No athletes yet. Add athletes from the web coach dashboard.
            </ThemedText>
          )}

          {data
            .slice()
            .sort((a, b) => {
              // Put "self" athlete at the bottom
              if (a.is_self && !b.is_self) return 1;
              if (!a.is_self && b.is_self) return -1;
              return 0;
            })
            .map((a) => (
              <Pressable
                key={a.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/workouts',
                    params: { athleteId: String(a.id), athleteName: a.name },
                  })
                }
              >
                {/* Name row */}
                <View style={styles.row}>
                  <ThemedText variant="h3" style={styles.nameText}>{a.name}</ThemedText>
                  {a.is_self && (
                    <View style={styles.badge}>
                      <ThemedText variant="badge" style={styles.badgeText}>You</ThemedText>
                    </View>
                  )}
                </View>

                {/* Line 2: sex + bodyweight (lightweight reference only) */}
                <ThemedText variant="bodyMuted" style={styles.metaText}>
                  {a.sex || '—'} • BW {formatKg(a.bodyweight)}
                </ThemedText>
              </Pressable>
            ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: '#020617',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#9CA3AF',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  errorText: {
    color: '#f97373',
    fontSize: 14,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  badgeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaText: {
    fontSize: 15,
    color: '#9CA3AF',
    marginBottom: 2,
  },
});