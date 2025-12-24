// app/(tabs)/workouts.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchJson } from '@/lib/api';

export default function WorkoutsScreen() {
  const router = useRouter(); 
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const rosterAthleteId = params.athleteId ? String(params.athleteId) : null;
  const rosterAthleteName = params.athleteName ? String(params.athleteName) : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<any | null>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [pendingMap, setPendingMap] = useState<Record<string, any[]>>({});
  const [completedMap, setCompletedMap] = useState<Record<string, any[]>>({});
  const [unassignedPending, setUnassignedPending] = useState<any[]>([]);
  const [unassignedCompleted, setUnassignedCompleted] = useState<any[]>([]);
  const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const endpoint = rosterAthleteId
        ? `/workouts/my_list/mobile/${rosterAthleteId}`
        : `/workouts/my_list/mobile`;

      const resp = await fetchJson(endpoint, { method: 'GET' });
      const res: any = resp.json;

      // Normalize errors
      if (!resp.ok) {
        const msg = res?.error || res?.message || `HTTP ${resp.status}`;
        if (cancelled) return;
        if (resp.status === 401 || msg === 'auth required') {
          setError('Session expired. Please log in again.');
        } else {
          setError(msg || 'Failed to load workouts.');
        }
        setAthlete(null);
        setBlocks([]);
        setPendingMap({});
        setCompletedMap({});
        setUnassignedPending([]);
        setUnassignedCompleted([]);
        setLoading(false);
        return;
      }

      if (!res?.ok) {
        const msg = res?.error || 'Failed to load workouts.';
        setError(msg);
        setAthlete(null);
        setBlocks([]);
        setPendingMap({});
        setCompletedMap({});
        setUnassignedPending([]);
        setUnassignedCompleted([]);
      } else {
        // Expecting my-list style payload from /workouts/my_list/mobile
        setAthlete(res.athlete || null);
        setBlocks(res.blocks || []);
        setPendingMap(res.pending_map || {});
        setCompletedMap(res.completed_map || {});
        setUnassignedPending(res.unassigned_pending || []);
        setUnassignedCompleted(res.unassigned_completed || []);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [rosterAthleteId]);

  const firstName =
    athlete?.name?.split(' ')[0] || 'Athlete';

  const statusLabel = (s?: string | null) => {
    const v = (s || 'assigned').toLowerCase();
    if (v === 'assigned') return 'Assigned';
    if (v === 'in_progress') return 'In progress';
    if (['logged', 'completed', 'done'].includes(v)) return 'Completed';
    return v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const statusTone = (s?: string | null) => {
    const v = (s || 'assigned').toLowerCase();
    if (v === 'assigned') return '#f97316'; // warn
    if (v === 'in_progress') return '#22c55e'; // ok
    if (['logged', 'completed', 'done'].includes(v)) return '#38bdf8'; // accent
    return '#e5e7eb';
  };

  const toggleCollapse = useCallback((id: string) => {
    setCollapseState((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const hasAnyWorkouts =
    (blocks && blocks.length > 0) ||
    unassignedPending.length > 0 ||
    unassignedCompleted.length > 0;

  const renderWorkoutRow = (w: any) => {
    return (
      <Pressable
        key={w.id}
        style={styles.row}
        onPress={() =>
          router.push({
            pathname: '/workout/[workoutId]',
            params: { workoutId: String(w.id) },
          })
        }
      >
        <View>
          <ThemedText variant="body" style={styles.rowTitle}>
            {w.label || 'Workout'}
          </ThemedText>
          <ThemedText variant="small" style={styles.rowMeta}>
            {w.date || 'Unknown date'}
          </ThemedText>
        </View>
        <View
          style={[
            styles.statusPill,
            { borderColor: statusTone(w.status) },
          ]}
        >
          <ThemedText
            variant="badge"
            style={[
              styles.statusPillText,
              { color: statusTone(w.status) },
            ]}
          >
            {statusLabel(w.status)}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  return (

      <ThemedView style={styles.screen}>

        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText variant="h1" style={styles.pageTitle}>
            {rosterAthleteName ? `Workouts · ${rosterAthleteName}` : 'My Workouts'}
          </ThemedText>

          {loading && (
            <ThemedText variant="bodyMuted" style={styles.metaText}>Loading workouts…</ThemedText>
          )}

          {error && !loading && (
            <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
          )}

          {!loading && !error && !hasAnyWorkouts && (
            <View style={styles.card}>
              <ThemedText variant="h3" style={styles.cardTitle}>No workouts yet</ThemedText>
              <ThemedText variant="bodyMuted" style={styles.metaText}>
                Your coach hasn’t assigned any workouts.
              </ThemedText>
            </View>
          )}

          {/* Training blocks */}
          {!loading && !error && blocks.length > 0 && (
            <View style={{ gap: 12 }}>
              {blocks.map((b) => {
                const collapseId = `completed-block-${b.id}`;
                const collapsed = collapseState[collapseId] ?? true;
                const pending = (pendingMap as any)[b.id] || [];
                const completed = (completedMap as any)[b.id] || [];

                return (
                  <View key={b.name} style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <ThemedText variant="h3" style={styles.cardTitle}>
                        {b.name}
                      </ThemedText>
                    </View>

                    {/* Pending */}
                    <ThemedText variant="h3" style={styles.sectionHeader}>
                      Pending
                    </ThemedText>
                    {pending.length > 0 ? (
                      <View style={{ marginTop: 4 }}>
                        {pending.map(renderWorkoutRow)}
                      </View>
                    ) : (
                      <ThemedText variant="bodyMuted" style={styles.metaText}>
                        No pending workouts.
                      </ThemedText>
                    )}

                    {/* Completed (collapsible) */}
                    {completed.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <View style={styles.collapsibleHeaderRow}>
                          <ThemedText variant="h3" style={styles.sectionHeader}>
                            Completed{' '}
                            <ThemedText variant="bodyMuted" style={styles.metaText}>
                              ({completed.length})
                            </ThemedText>
                          </ThemedText>
                          <Pressable
                            style={styles.collapseBtn}
                            onPress={() => toggleCollapse(collapseId)}
                          >
                            <ThemedText variant="h3" style={styles.collapseBtnText}>
                              {collapsed ? '+' : '–'}
                            </ThemedText>
                          </Pressable>
                        </View>
                        {!collapsed && (
                          <View style={{ marginTop: 6 }}>
                            {completed.map(renderWorkoutRow)}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Unassigned workouts card */}
          {!loading &&
            !error &&
            (unassignedPending.length > 0 || unassignedCompleted.length > 0) && (
              <View style={[styles.card, { marginTop: 12 }]}>
                <View style={styles.cardHeaderRow}>
                  <ThemedText variant="h3" style={styles.cardTitle}>
                    No Assigned Block
                  </ThemedText>
                  {unassignedPending.length === 0 &&
                    unassignedCompleted.length === 0 && (
                      <ThemedText variant="bodyMuted" style={styles.metaText}>
                        No unassigned workouts
                      </ThemedText>
                    )}
                </View>

                <ThemedText variant="h3" style={styles.sectionHeader}>Pending</ThemedText>
                {unassignedPending.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    {unassignedPending.map(renderWorkoutRow)}
                  </View>
                ) : (
                  <ThemedText variant="bodyMuted" style={styles.metaText}>
                    No pending unassigned workouts.
                  </ThemedText>
                )}

                {unassignedCompleted.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    {(() => {
                      const collapseId = 'completed-unassigned';
                      const collapsed = !!collapseState[collapseId];
                      return (
                        <View>
                          <View style={styles.collapsibleHeaderRow}>
                            <ThemedText variant="h3" style={styles.sectionHeader}>
                              Completed{' '}
                              <ThemedText variant="bodyMuted" style={styles.metaText}>
                                ({unassignedCompleted.length})
                              </ThemedText>
                            </ThemedText>
                            <Pressable
                              style={styles.collapseBtn}
                              onPress={() => toggleCollapse(collapseId)}
                            >
                              <ThemedText variant="h3" style={styles.collapseBtnText}>
                                {collapsed ? '+' : '–'}
                              </ThemedText>
                            </Pressable>
                          </View>
                          {!collapsed && (
                            <View style={{ marginTop: 6 }}>
                              {unassignedCompleted.map(renderWorkoutRow)}
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                )}
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
  },
  scroll: {
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    color: '#FFFFFF',
  },
  card: {
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
  },
  rowTitle: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  rowMeta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#f97373',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  collapsibleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapseBtn: {
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtnText: {
    fontSize: 16,
    color: '#E5E7EB',
  },
});