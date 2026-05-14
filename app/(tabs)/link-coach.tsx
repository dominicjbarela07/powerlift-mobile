// app/(tabs)/link-coach.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';

type DashboardData = {
  athlete: any;
  coach: any;
  next_workout: any;
  recent_workouts: any[];
};

export default function LinkCoachScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (!token) {
          setError('Not authenticated. Please log in again.');
          return;
        }

        const res: any = await fetchJson('/auth/link-coach/mobile', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const status = Number(res?.status ?? 0);
        const payload = res?.json ?? res;

        if (res?.ok !== true) {
          console.log('link-coach resp not ok:', status, res?.raw);
          const msg = payload?.error || payload?.message || `Request failed (${status || 'unknown'})`;
          setError(String(msg));

          if (status === 401) {
            router.replace('/login');
          }
          setData(null);
          return;
        }

        if (cancelled) return;

        if (!payload || typeof payload !== 'object') {
          setError('Bad response (non-object).');
          setData(null);
          return;
        }

        if (payload.ok !== true) {
          setError(payload.error || 'Failed to load link coach data.');
          setData(null);
          return;
        }

        setData({
          athlete: payload.athlete || null,
          coach: payload.coach || null,
          next_workout: null,
          recent_workouts: [],
        });
      } catch (err: any) {
        if (cancelled) return;
        console.log('LinkCoach API error', err);
        setError(err.message || 'Network error while loading coach info.');
        setData(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ThemedView style={styles.screenCentered}>
          <ActivityIndicator size="small" color="#B8B0DA" />
          <ThemedText variant="bodyMuted" style={styles.loadingText}>Loading…</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ThemedView style={styles.screen}>
          <View style={styles.header}>
            <ThemedText variant="h1" style={styles.title}>Link Coach</ThemedText>
            <ThemedText variant="bodyMuted" style={styles.subtitle}>
              Connect your account to a coach when an invite is available.
            </ThemedText>
          </View>

          <View style={styles.centerCard}>
            <ThemedText variant={error ? 'error' : 'bodyMuted'}>
              {error || 'No data.'}
            </ThemedText>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const coach = data.coach;
  const alreadyLinked = !!coach;

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ThemedView style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <ThemedText variant="h1" style={styles.title}>Link Coach</ThemedText>
            <ThemedText variant="bodyMuted" style={styles.subtitle}>
              Connect your athlete account to a coach and unlock assigned training.
            </ThemedText>
          </View>

          {alreadyLinked ? (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.titleRow}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="link" size={22} color="#C4B5FD" />
                  </View>
                  <ThemedText variant="h3" style={styles.cardTitle}>Coach Linked</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.bodyText}>
                You’re already linked to{' '}
                <ThemedText style={styles.coachName}>
                  {coach.name || coach.email || 'Coach'}
                </ThemedText>
                .
              </ThemedText>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.titleRow}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="mail-open-outline" size={22} color="#94A3B8" />
                  </View>
                  <ThemedText variant="h3" style={styles.cardTitle}>No Invite Found</ThemedText>
                </View>
              </View>

              <ThemedText variant="bodyMuted" style={styles.emptyText}>
                Don’t see an invite? Please contact your coach directly.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
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
    paddingTop: 12,
    paddingBottom: 24,
  },
  screenCentered: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  loadingText: {
    color: '#94A3B8',
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#94A3B8',
  },
  centerCard: {
    minHeight: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(8,16,38,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(8,16,38,0.96)',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardHeaderRow: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#F8FAFC',
  },
  bodyText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  coachName: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#5B4FCF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
    backgroundColor: 'rgba(148,163,184,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
});