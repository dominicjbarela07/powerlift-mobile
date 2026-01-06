// app/athlete-dashboard.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Text } from 'react-native';
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

        const res: any = await fetchJson('/athletes/mobile/dashboard', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (cancelled) return;

        // fetchJson returns a wrapper: { ok, status, raw, json }
        const status = Number(res?.status ?? 0);
        const payload = res?.json ?? res;

        if (res?.ok !== true) {
          const msg = payload?.error || payload?.message || `Request failed (${status || 'unknown'})`;
          setError(String(msg));
          setData(null);

          if (status === 401) {
            router.replace('/login');
          }
          return;
        }

        if (!payload || typeof payload !== 'object') {
          setError('Bad response (non-object).');
          setData(null);
          return;
        }

        if (payload.ok !== true) {
          const msg = (payload as any)?.error || (payload as any)?.message || 'Failed to load dashboard.';
          setError(String(msg));
          setData(null);
          return;
        }

        setData({
          athlete: (payload as any).athlete,
          coach: (payload as any).coach,
          next_workout: (payload as any).next_workout,
          recent_workouts: (payload as any).recent_workouts || [],
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
  }, [token, router]); // 👈 re-run when token changes

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

  const statusLabel = (s?: string | null) => {
    const v = String(s || 'assigned').toLowerCase();
    if (v === 'assigned') return 'Assigned';
    if (v === 'in_progress') return 'In progress';
    if (['logged', 'completed', 'done'].includes(v)) return 'Completed';
    return v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const statusTone = (s?: string | null) => {
    const v = String(s || 'assigned').toLowerCase();
    if (v === 'assigned') return '#f97316'; // warn
    if (v === 'in_progress') return '#22c55e'; // ok
    if (['logged', 'completed', 'done'].includes(v)) return '#38bdf8'; // accent
    return '#e5e7eb';
  };

  const workoutPreview = (w: any) => {
    if (!w) return null;

    // Prefer NEW payload shape: w.preview.{core_lines, accessory_count, core_items}
    const p = (w && typeof w === 'object' ? (w as any).preview : null) || {};

    // NEW: array of already-formatted strings
    const coreLinesFromPreview: any[] =
      (Array.isArray(p.core_lines) && p.core_lines) ||
      (Array.isArray(p.core_preview_lines) && p.core_preview_lines) ||
      [];

    // OLD: top-level fallbacks
    const coreLinesFromTopLevel: any[] =
      (Array.isArray(w.core_preview_lines) && w.core_preview_lines) ||
      (Array.isArray(w.core_preview) && w.core_preview) ||
      (typeof w.core_preview === 'string' ? [w.core_preview] : []) ||
      (typeof w.core_lifts_preview === 'string' ? [w.core_lifts_preview] : []);

    const coreLinesRaw: any[] =
      coreLinesFromPreview.length > 0 ? coreLinesFromPreview : coreLinesFromTopLevel;

    // Normalize to pure strings (some backends may send objects like {lift, scheme, variant})
    let coreLines = (coreLinesRaw || [])
      .map((x: any) => {
        if (x == null) return null;
        if (typeof x === 'string') return x;
        if (typeof x === 'number' || typeof x === 'boolean') return String(x);
        if (typeof x === 'object') {
          const lift = x.lift_name || x.lift || x.movement || null;
          const scheme = x.scheme || x.sets_reps || null;
          const out = [lift, scheme].filter(Boolean).join(' ');
          return out || null;
        }
        return null;
      })
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

    // Accessory count (NEW then OLD)
    const accessoryCount =
      typeof p.accessory_count === 'number'
        ? p.accessory_count
        : typeof w.accessory_count === 'number'
        ? w.accessory_count
        : typeof w.accessories_count === 'number'
        ? w.accessories_count
        : typeof w.num_accessories === 'number'
        ? w.num_accessories
        : null;

    // If backend sends structured core items in preview, build a simple line if no strings exist yet
    if (coreLines.length === 0) {
      const items = Array.isArray(p.core_items)
        ? p.core_items
        : Array.isArray((w as any).core_items_preview)
        ? (w as any).core_items_preview
        : [];

      if (items.length > 0) {
        const built = items
          .map((it: any) => {
            const lift = it?.lift_name || it?.lift || it?.movement || null;
            const scheme = it?.scheme || it?.sets_reps || null;
            if (!lift && !scheme) return null;
            return [lift, scheme].filter(Boolean).join(' ');
          })
          .filter(Boolean);

        if (built.length) coreLines = [...coreLines, ...built];
      }
    }

    // Nothing to show
    if (coreLines.length === 0 && accessoryCount == null) return null;

    return {
      coreLines,
      accessoryCount,
    };
  };

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
                    {next.label || 'Unnamed'}
                  </ThemedText>
                  <View style={styles.rowMeta}>
                    <View
                      style={[
                        styles.statusPillBox,
                        { borderColor: statusTone(next.status) },
                      ]}
                    >
                      <ThemedText
                        variant="badge"
                        style={[
                          styles.statusPillText,
                          { color: statusTone(next.status) },
                        ]}
                      >
                        {statusLabel(next.status)}
                      </ThemedText>
                    </View>
                    <ThemedText variant="small" style={styles.cardMetaRight}>
                      {(next.date as string) || 'Date TBD'}
                    </ThemedText>
                  </View>
                  {(() => {
                    const p = workoutPreview(next);
                    if (!p) return null;

                    return (
                      <View style={styles.previewBlock}>
                        {p.coreLines.length > 0 && (
                          <ThemedText variant="bodyMuted" style={styles.previewText}>
                            {p.coreLines[0]}
                          </ThemedText>
                        )}
                        {p.accessoryCount != null && (
                          <ThemedText variant="bodyMuted" style={styles.previewText}>
                            {p.accessoryCount} {p.accessoryCount === 1 ? 'accessory' : 'accessories'}
                          </ThemedText>
                        )}
                      </View>
                    );
                  })()}
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
                    <View
                      style={[
                        styles.statusPillBox,
                        { borderColor: statusTone(mostRecentCompleted.status) },
                      ]}
                    >
                      <ThemedText
                        variant="badge"
                        style={[
                          styles.statusPillText,
                          { color: statusTone(mostRecentCompleted.status) },
                        ]}
                      >
                        {statusLabel(mostRecentCompleted.status)}
                      </ThemedText>
                    </View>
                    <ThemedText variant="small" style={styles.cardMetaRight}>
                      {(mostRecentCompleted.date as string) || 'Unknown date'}
                    </ThemedText>
                  </View>
                  {(() => {
                    const p = workoutPreview(mostRecentCompleted);
                    if (!p) return null;

                    return (
                      <View style={styles.previewBlock}>
                        {p.coreLines.length > 0 && (
                          <ThemedText variant="bodyMuted" style={styles.previewText}>
                            {p.coreLines[0]}
                          </ThemedText>
                        )}
                        {p.accessoryCount != null && (
                          <ThemedText variant="bodyMuted" style={styles.previewText}>
                            {p.accessoryCount} {p.accessoryCount === 1 ? 'accessory' : 'accessories'}
                          </ThemedText>
                        )}
                      </View>
                    );
                  })()}
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
                  <Text style={styles.contactButtonText}>Contact</Text>
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
    paddingHorizontal: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  previewBlock: {
    marginTop: 8,
    gap: 4,
  },
  previewText: {
    fontSize: 12,
    color: '#9ca3af',
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
  statusPillBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
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
    backgroundColor: '#38bdf8',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  contactButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#020617',
  },
  errorText: {
    color: '#f97373',
    fontSize: 13,
  },
});