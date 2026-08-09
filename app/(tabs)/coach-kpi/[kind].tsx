import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchJson } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { NewCoachExperience, type NewCoachExperiencePayload } from '@/components/NewCoachExperience';
import { SLColors, SLRadius, SLShadows, SLTypography } from '@/constants/theme';

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
  new_coach_experience?: NewCoachExperiencePayload | null;
  error?: string;
};

function statusLabel(s?: string | null) {
  const v = (s || 'assigned').toLowerCase();
  if (v === 'draft') return 'Draft';
  if (v === 'assigned') return 'Assigned';
  if (v === 'in_progress') return 'In progress';
  if (['logged', 'completed', 'done'].includes(v)) return 'Completed';
  if (v === 'missed') return 'Missed';
  if (v === 'missed_excused') return 'Excused';
  if (v === 'incomplete') return 'Incomplete';
  return v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(s?: string | null) {
  const v = (s || 'assigned').toLowerCase();
  if (v === 'draft') return SLColors.accentViolet;
  if (v === 'assigned') return SLColors.warning;
  if (v === 'in_progress') return SLColors.success;
  if (['logged', 'completed', 'done'].includes(v)) return SLColors.info;
  if (v === 'missed') return SLColors.danger;
  if (v === 'missed_excused') return SLColors.textMuted;
  if (v === 'incomplete') return SLColors.warning;
  return SLColors.text;
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
        <ThemedText variant="h1" style={styles.title}>{title}</ThemedText>
        <ThemedText variant="bodyMuted" style={styles.subtitle}>
          Tap a Session to open its details.
        </ThemedText>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={SLColors.accentViolet} />
          <ThemedText variant="bodyMuted" style={styles.centerText}>Loading…</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.centerCard}>
          <ThemedText variant="error">{error}</ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {data?.rows?.length ? (
            data.rows.map((r) => (
              <TouchableOpacity
                key={r.workout_id}
                activeOpacity={0.88}
                onPress={() =>
                  router.push({
                    pathname: '/workout/[workoutId]',
                    params: { workoutId: String(r.workout_id) },
                  })
                }
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={`Open Session ${r.label || 'session'} for ${r.athlete_name}${r.is_self ? ' (YOU)' : ''}`}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleCol}>
                    <ThemedText typographyRole="dynamicName" variant="h3" style={styles.name}>
                      {r.athlete_name}{r.is_self ? ' (YOU)' : ''}
                    </ThemedText>
                    <ThemedText variant="body" style={styles.sessionLabel}>
                      {r.label && r.label.trim() !== '' ? r.label : 'Unnamed'}
                    </ThemedText>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: `${statusTone(r.status)}18`, borderColor: `${statusTone(r.status)}55` }]}>
                    <ThemedText
                      variant="badge"
                      style={[styles.statusPillText, { color: statusTone(r.status) }]}
                    >
                      {statusLabel(r.status)}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText variant="bodyMuted" style={styles.metaDate}>
                  {r.date || 'No date'}
                </ThemedText>

                {trimPreview(consolidatePreview((r as any).core_preview), 3).length > 0 ? (
                  <View style={styles.previewBlock}>
                    {trimPreview(consolidatePreview((r as any).core_preview), 3).map((p, idx) => (
                      <ThemedText
                        key={`${r.workout_id}-core-${idx}`}
                        variant="bodyMuted"
                        style={styles.previewLine}
                      >
                        {p.lift} · {p.scheme}
                      </ThemedText>
                    ))}
                  </View>
                ) : null}

                {typeof (r as any).accessories_count === 'number' && (
                  <View style={styles.accessoryPill}>
                    <ThemedText variant="bodyMuted" style={styles.accessoryPillText}>
                      {(r as any).accessories_count} accessories
                    </ThemedText>
                  </View>
                )}

                {!r.label && !((r as any).core_preview?.length) && typeof (r as any).accessories_count !== 'number' && (
                  <ThemedText variant="body" style={styles.sessionLabel}>Training Session</ThemedText>
                )}
              </TouchableOpacity>
            ))
          ) : data?.new_coach_experience ? (
            <NewCoachExperience experience={data.new_coach_experience} />
          ) : (
            <View style={styles.emptyCard}>
              <ThemedText variant="bodyMuted" style={styles.emptyText}>No Training Sessions in this KPI.</ThemedText>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.footerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText variant="small" style={styles.backBtnText}>Back</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: SLColors.textStrong,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    ...SLTypography.label,
    color: SLColors.textMuted,
  },
  backBtn: {
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surface,
  },
  backBtnText: {
    color: SLColors.text,
  },
  footerRow: {
    marginTop: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  centerText: {
    color: SLColors.textMuted,
  },
  centerCard: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.radiusHero,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surface,
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  card: {
    width: '100%',
    backgroundColor: SLColors.surface,
    borderRadius: SLRadius.radiusHero,
    padding: 16,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    marginBottom: 12,
    ...SLShadows.card,
  },
  name: {
    color: SLColors.textStrong,
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
    marginTop: 8,
    ...SLTypography.label,
    color: SLColors.textMuted,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  sessionLabel: {
    marginTop: 1,
    color: SLColors.text,
    fontWeight: '600',
  },
  previewBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SLColors.borderHairline,
    gap: 6,
  },
  previewLine: {
    ...SLTypography.label,
    color: SLColors.textMuted,
  },
  accessoryPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.surfaceMuted,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  accessoryPillText: {
    ...SLTypography.caption,
    color: SLColors.textMuted,
  },
  emptyCard: {
    borderRadius: SLRadius.radiusHero,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyText: {
    color: SLColors.textMuted,
  },
});
