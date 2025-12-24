// app/coach-dashboard.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';

type CoachDashboardResponse = {
  ok: boolean;
  total: number;
  today_assigned: number;
  today_logged: number;
  missed_yesterday: number;
  pending_approvals: number;
  pending_reviews: number;
  no_log_3plus: { id: number; name: string }[];
};

export default function CoachDashboardScreen() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [data, setData] = useState<CoachDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setError(null);
      if (!token) {
        setError('Not authenticated. Please log in again.');
        return;
      }

      const res: any = await fetchJson('/coach/mobile/dashboard', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Coach dashboard raw response:', res);

      // fetchJson returns a wrapper: { ok, status, raw, json }
      const status = Number(res?.status ?? 0);
      const payload = res?.json ?? res;

      if (res?.ok !== true) {
        const msg = payload?.error || payload?.message || `Request failed (${status || 'unknown'})`;
        setError(String(msg));

        // If token is missing/invalid, bounce back to login
        if (status === 401) {
          router.replace('/login');
        }
        return;
      }

      if (!payload || typeof payload !== 'object') {
        setError('Bad response (non-object).');
        return;
      }

      if (payload.ok !== true) {
        const msg = payload?.error || payload?.message || 'Failed to load coach dashboard.';
        setError(String(msg));
        return;
      }

      setData(payload as CoachDashboardResponse);
    } catch (e) {
      console.log('Coach dashboard load error', e);
      const msg = (e as any)?.message || String(e);
      setError(`Network/parse error: ${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText variant="h1" style={styles.title}>Coach Dashboard</ThemedText>
      </View>

      {loading && !data ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />
          }
        >
          {error && (
            <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
          )}

          {/* KPI cards */}
          {data && (
            <>
              <View style={styles.kpiGrid}>
                <TouchableOpacity
                  style={styles.kpiCard}
                  onPress={() => {
                    router.push('/coach-roster');
                  }}
                >
                  <ThemedText variant="label" style={styles.kpiLabel}>Total Athletes</ThemedText>
                  <ThemedText variant="kpi" style={styles.kpiValue}>{data.total}</ThemedText>
                  <ThemedText variant="small" style={styles.kpiHint}>View roster</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.kpiCard}
                  onPress={() => {
                    router.push('/coach-kpi/today_assigned');
                  }}
                >
                  <ThemedText variant="label" style={styles.kpiLabel}>Today Assigned</ThemedText>
                  <ThemedText variant="kpi" style={styles.kpiValue}>{data.today_assigned}</ThemedText>
                  <ThemedText variant="small" style={styles.kpiHint}>Scheduled for today</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.kpiCard}
                  onPress={() => {
                    router.push('/coach-kpi/today_logged');
                  }}
                >
                  <ThemedText variant="label" style={styles.kpiLabel}>Today Logged</ThemedText>
                  <ThemedText variant="kpi" style={styles.kpiValue}>{data.today_logged}</ThemedText>
                  <ThemedText variant="small" style={styles.kpiHint}>Completed today</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.kpiCard}
                  onPress={() => {
                    router.push('/coach-kpi/missed_yesterday');
                  }}
                >
                  <ThemedText variant="label" style={styles.kpiLabel}>Missed Yesterday</ThemedText>
                  <ThemedText variant="kpi" style={[styles.kpiValue, styles.dangerValue]}>
                    {data.missed_yesterday}
                  </ThemedText>
                  <ThemedText variant="small" style={styles.kpiHint}>Unlogged from yesterday</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Needs Attention */}
              <View style={styles.section}>
                <ThemedText variant="h2" style={styles.sectionTitle}>Needs Attention</ThemedText>

                <View style={styles.card}>
                  <ThemedText variant="h3" style={styles.cardTitle}>No log in 3+ days</ThemedText>
                  {data.no_log_3plus && data.no_log_3plus.length > 0 ? (
                    data.no_log_3plus.map((a) => (
                      <View key={a.id} style={styles.listRow}>
                        <ThemedText variant="body" style={styles.listText}>• {a.name}</ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText variant="bodyMuted" style={styles.mutedText}>— none yet</ThemedText>
                  )}
                </View>

                <View style={styles.card}>
                  <ThemedText variant="h3" style={styles.cardTitle}>Injury / Issues</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.mutedText}>— placeholder for later</ThemedText>
                </View>
              </View>

              {/* Work Queue */}
              <View style={styles.section}>
                <ThemedText variant="h2" style={styles.sectionTitle}>Work Queue</ThemedText>

                <View style={styles.card}>
                  <ThemedText variant="h3" style={styles.cardTitle}>Pending Load Approvals</ThemedText>
                  <ThemedText variant="kpi" style={styles.kpiValue}>{data.pending_approvals}</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.mutedText}>— placeholder</ThemedText>
                </View>

                <View style={styles.card}>
                  <ThemedText variant="h3" style={styles.cardTitle}>Video Reviews</ThemedText>
                  <ThemedText variant="kpi" style={styles.kpiValue}>{data.pending_reviews}</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.mutedText}>— placeholder</ThemedText>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: '#020617',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
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
    fontSize: 13,
    marginBottom: 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    width: '100%',
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  dangerValue: {
    color: '#f97373',
  },
  kpiHint: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#E5E7EB',
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#E5E7EB',
  },
  listRow: {
    paddingVertical: 4,
  },
  listText: {
    fontSize: 15,
    color: '#E5E7EB',
  },
  mutedText: {
    fontSize: 14,
    color: '#6B7280',
  },
});