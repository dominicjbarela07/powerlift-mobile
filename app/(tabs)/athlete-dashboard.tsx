// app/athlete-dashboard.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchJson } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

type DashboardData = {
  athlete: any;
  coach: any;
  next_workout: any;
  recent_workouts: any[];
};

export default function AthleteDashboard() {
  const router = useRouter();
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!token) {
          setError('Not authenticated. Please log in again.');
          setData(null);
          return;
        }

        const json: unknown = await fetchJson('/athletes/mobile/dashboard', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (cancelled) return;

        const obj = json as any;
        if (!obj || typeof obj !== 'object' || obj.ok !== true) {
          setError(obj?.error || 'Failed to load dashboard.');
          setData(null);
          return;
        }

        setData({
          athlete: obj.athlete,
          coach: obj.coach,
          next_workout: obj.next_workout,
          recent_workouts: obj.recent_workouts || [],
        });
      } catch (err) {
        if (cancelled) return;
        console.log('Dashboard API error', err);
        setError('Network error while loading dashboard.');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]); // 👈 re-run when token changes

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.screen}>
          <ThemedText>Loading dashboard…</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.screen}>
          <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.screen}>
          <ThemedText>No data.</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const a = data.athlete;
  const c = data.coach;
  const next = data.next_workout;
  const recents = data.recent_workouts || [];

  const completedWorkouts = recents.filter(
    (w: any) => (w.status || '').toLowerCase() === 'completed'
  );
  const mostRecentCompleted =
    completedWorkouts.length > 0
      ? completedWorkouts.sort(
          (a: any, b: any) =>
            new Date(b.date as string).getTime() -
            new Date(a.date as string).getTime()
        )[0]
      : recents[0] || null;

  const firstName = a?.name?.split(' ')[0] || 'Athlete';

  return (
      <ThemedView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText variant="h1" style={styles.title}>
              Athlete Dashboard
            </ThemedText>
            {c && (
              <ThemedText variant="bodyMuted" style={styles.subtitle}>
                Coached by {c.name || c.email}
              </ThemedText>
            )}
          </View>

          {/* Next workout card */}
          <View style={styles.card}>
            <ThemedText variant="h3" style={styles.cardTitle}>Next Workout</ThemedText>
            {next ? (
              <Pressable
                style={({ pressed }) => [
                  styles.workoutRow,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                ]}
                onPress={() => {
                  if (!next?.id) return;

                  router.push({
                    pathname: '/workout/[workoutId]',
                    params: { workoutId: String(next.id) },
                  });
                }}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText variant="h3" style={styles.cardMain}>
                    {next.label || 'Unlabeled workout'}
                  </ThemedText>
                  <View style={styles.rowMeta}>
                    <ThemedText variant="badge" style={styles.statusPill}>
                      {next.status || 'assigned'}
                    </ThemedText>
                    <ThemedText variant="small" style={styles.cardMetaRight}>
                      {(next.date as string) || 'Date TBD'}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            ) : (
              <ThemedText variant="bodyMuted" style={styles.cardMeta}>
                No upcoming workouts assigned.
              </ThemedText>
            )}
          </View>

          {/* Recent workout */}
          <View style={styles.card}>
            <ThemedText variant="h3" style={styles.cardTitle}>Most Recent Session</ThemedText>
            {!mostRecentCompleted ? (
              <ThemedText variant="bodyMuted" style={styles.cardMeta}>
                No recent workouts logged yet.
              </ThemedText>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.workoutRow,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                ]}
                onPress={() => {
                  if (!mostRecentCompleted?.id) return;

                  router.push({
                    pathname: '/workout/[workoutId]',
                    params: { workoutId: String(mostRecentCompleted.id) },
                  });
                }}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText variant="h3" style={styles.cardMain}>
                    {mostRecentCompleted.label || 'Workout'}
                  </ThemedText>
                  <View style={styles.rowMeta}>
                    <ThemedText variant="badge" style={styles.badge}>
                      {mostRecentCompleted.status || 'completed'}
                    </ThemedText>
                    <ThemedText variant="small" style={styles.cardMetaRight}>
                      {(mostRecentCompleted.date as string) || 'Unknown date'}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            )}
          </View>

          {/* Your Coach */}
          {c && (
            <View style={styles.card}>
              <ThemedText variant="h3" style={styles.cardTitle}>Your Coach</ThemedText>
              <ThemedText variant="h3" style={styles.coachName}>{c.name || 'Coach'}</ThemedText>
              {c.email && (
                <ThemedText variant="bodyMuted" style={styles.coachEmail}>{c.email}</ThemedText>
              )}
              <View style={styles.coachActions}>
                <Pressable style={styles.contactButton}>
                  <ThemedText variant="small" style={styles.contactButtonText}>Contact</ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </ThemedView>

  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  screen: {
    flex: 1,
    backgroundColor: '#020617',

    paddingTop: 0,
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  welcomeLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#e5e7eb',
  },
  cardMain: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f9fafb',
  },
  cardMeta: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  workoutRow: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.9)',
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusPill: {
    fontSize: 11,
    color: '#BBF7D0',
    backgroundColor: 'rgba(22,163,74,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginRight: 8,
  },
  cardMetaRight: {
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
  },
  listTitle: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  listMeta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  badge: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#38bdf8',
  },
  coachName: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  coachEmail: {
    marginTop: 2,
    fontSize: 13,
    color: '#9CA3AF',
  },
  coachActions: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  contactButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  contactButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  errorText: {
    color: '#f97373',
    fontSize: 13,
  },
});