import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchJson } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';

type KpiRow = {
  workout_id: number;
  athlete_id: number;
  athlete_name: string;
  date: string | null;
  label: string | null;
  status: string | null;
  // Provided by backend for coach KPI rows
  is_self?: boolean;
  // Optional workout preview (if backend provides it)
  // New shape supports TOP/BK consolidation via variant + parent_item_id
  core_preview?: {
    lift: string;              // display name
    scheme: string;            // e.g. "1x5 @ RPE 7"
    variant?: string | null;   // 'TOP' | 'BK' | 'STRAIGHT' (core only)
    parent_item_id?: number | null;
    item_id?: number | null;
    lift_code?: string | null; // e.g. 'SQ','BN','DL'
  }[];
  accessories_count?: number;
};

type KpiResponse = {
  ok: boolean;
  kind: string;
  title: string;
  rows: KpiRow[];
  error?: string;
};

function statusLabel(s?: string | null) {
  const v = (s || 'assigned').toLowerCase();
  if (v === 'draft') return 'Draft';
  if (v === 'assigned') return 'Assigned';
  if (v === 'in_progress') return 'In progress';
  if (['logged', 'completed', 'done'].includes(v)) return 'Completed';
  return v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(s?: string | null) {
  const v = (s || 'assigned').toLowerCase();
  if (v === 'draft') return '#a78bfa'; // purple
  if (v === 'assigned') return '#f97316'; // warn
  if (v === 'in_progress') return '#22c55e'; // ok
  if (['logged', 'completed', 'done'].includes(v)) return '#38bdf8'; // accent
  return '#e5e7eb';
}

function trimPreview(
  rows?: {
    lift: string;
    scheme: string;
    variant?: string | null;
    parent_item_id?: number | null;
    item_id?: number | null;
    lift_code?: string | null;
  }[],
  max = 3,
) {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.slice(0, max);
}

function consolidatePreview(
  rows?: {
    lift: string;
    scheme: string;
    variant?: string | null;
    parent_item_id?: number | null;
    item_id?: number | null;
    lift_code?: string | null;
  }[],
) {
  const arr = Array.isArray(rows) ? rows : [];
  const out: { lift: string; scheme: string }[] = [];

  // Track BK children we already consumed under a TOP
  const consumed = new Set<number>();

  for (let i = 0; i < arr.length; i++) {
    const r = arr[i];

    const lift = String(r?.lift ?? '').trim();
    const scheme = String(r?.scheme ?? '').trim();
    const variant = (r?.variant ?? '').toString().toUpperCase();
    const itemId = typeof r?.item_id === 'number' ? r.item_id : null;
    const parentId = typeof r?.parent_item_id === 'number' ? r.parent_item_id : null;

    if (!lift || !scheme) continue;

    // Skip BK rows that were already rolled up under a TOP
    if (itemId != null && consumed.has(itemId)) continue;

    // If this is a BK row and it has a parent, don't render it as its own line.
    // It should appear under its TOP parent.
    if (variant === 'BK' && parentId != null) continue;

    // TOP: roll up its BK children into the same line
    if (variant === 'TOP' && itemId != null) {
      const parts: string[] = [scheme];

      // Find BK children for this TOP anywhere in the preview list
      for (const child of arr) {
        const childVariant = (child?.variant ?? '').toString().toUpperCase();
        const childParent = typeof child?.parent_item_id === 'number' ? child.parent_item_id : null;
        const childId = typeof child?.item_id === 'number' ? child.item_id : null;
        const childScheme = String(child?.scheme ?? '').trim();

        if (childVariant === 'BK' && childParent === itemId && childScheme) {
          parts.push(childScheme);
          if (childId != null) consumed.add(childId);
        }
      }

      const line = parts.join(', ');
      out.push({ lift, scheme: line });
      continue;
    }

    // STRAIGHT / other core: merge consecutive identical lifts into one line
    const last = out[out.length - 1];
    if (last && last.lift === lift) {
      if (!last.scheme.includes(scheme)) {
        last.scheme = `${last.scheme}, ${scheme}`;
      }
    } else {
      out.push({ lift, scheme });
    }
  }

  return out;
}

export default function CoachKpiDetailScreen() {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const { token } = useAuth();

  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (data?.title) return data.title;
    if (kind === 'today_assigned') return 'Today Assigned';
    if (kind === 'today_logged') return 'Today Logged';
    if (kind === 'missed_yesterday') return 'Missed Yesterday';
    if (kind === 'drafts') return 'Drafts';
    return 'KPI Detail';
  }, [data?.title, kind]);

  const load = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!token) {
        setError('Not authenticated. Please log in again.');
        setData(null);
        return;
      }

      const res: any = await fetchJson(`/coach/mobile/kpi/${kind}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
        const msg = payload?.error || payload?.message || 'Failed to load KPI detail.';
        setError(String(msg));
        setData(null);
        return;
      }

      setData(payload as KpiResponse);
    } catch (e: any) {
      console.log('KPI detail load error', e);
      const msg = e?.message || String(e);
      setError(`Network/parse error: ${msg}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!kind) return;
    load();
  }, [kind, token]);

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
              <TouchableOpacity
                key={r.workout_id}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/workout/[workoutId]',
                    params: { workoutId: String(r.workout_id) },
                  })
                }
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={`Open workout ${r.label || 'session'} for ${r.athlete_name}${r.is_self ? ' (YOU)' : ''}`}
              >
                <ThemedText variant="h3" style={styles.name}>
                  {r.athlete_name}{r.is_self ? ' (YOU)' : ''}
                </ThemedText>
                <View style={styles.metaRow}>
                  <ThemedText variant="bodyMuted" style={styles.metaDate}>
                    {r.date || 'No date'}
                  </ThemedText>

                  <View style={[styles.statusPill, { borderColor: statusTone(r.status) }]}>
                    <ThemedText
                      variant="badge"
                      style={[styles.statusPillText, { color: statusTone(r.status) }]}
                    >
                      {statusLabel(r.status)}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText variant="body" style={{ marginTop: 2 }}>
                  {r.label && r.label.trim() !== '' ? r.label : 'Unnamed'}
                </ThemedText>

                {trimPreview(consolidatePreview((r as any).core_preview), 3).map((p, idx) => (
                  <ThemedText
                    key={`${r.workout_id}-core-${idx}`}
                    variant="bodyMuted"
                    style={{ marginTop: idx === 0 ? 8 : 4 }}
                  >
                    {p.lift} — {p.scheme}
                  </ThemedText>
                ))}

                {typeof (r as any).accessories_count === 'number' && (
                  <ThemedText variant="bodyMuted" style={{ marginTop: 8 }}>
                    Accessories: {(r as any).accessories_count}
                  </ThemedText>
                )}

                {!r.label && !((r as any).core_preview?.length) && typeof (r as any).accessories_count !== 'number' && (
                  <ThemedText variant="body">Workout</ThemedText>
                )}
              </TouchableOpacity>
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaDate: {
    flexShrink: 1,
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
});