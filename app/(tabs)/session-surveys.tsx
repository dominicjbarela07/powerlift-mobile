

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { fetchJson } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type SurveyRow = {
  workout_id: number;
  athlete_id: number;
  athlete_name: string;
  label: string;
  date?: string | null;
  submitted_at?: string | null;
  reviewed?: boolean;
  reviewed_at?: string | null;
  survey?: {
    rpe?: number | string | null;
    performance?: number | string | null;
    strength?: number | string | null;
    energy?: number | string | null;
    fatigue?: number | string | null;
    soreness?: number | string | null;
    notes?: string | null;
  };
};

type AthleteOption = {
  id: number;
  name: string;
};

type ScreenData = {
  athlete_options: AthleteOption[];
  selected_athlete_id?: number | null;
  pending_rows: SurveyRow[];
  archive_rows: SurveyRow[];
};

export default function SessionSurveysScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const [data, setData] = useState<ScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const loadQueue = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        if (!token) {
          setError('Not authenticated.');
          setData(null);
          return;
        }

        const res: any = await fetchJson('/coach/mobile/session-surveys', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = res?.json ?? res;
        if (res?.ok !== true || payload?.ok !== true) {
          setError(payload?.error || payload?.message || 'Failed to load session feedback.');
          setData(null);
          return;
        }

        setData({
          athlete_options: payload.athlete_options || [],
          selected_athlete_id: payload.selected_athlete_id ?? null,
          pending_rows: payload.pending_rows || [],
          archive_rows: payload.archive_rows || [],
        });
      } catch (err) {
        console.error('session surveys load failed', err);
        setError('Failed to load session feedback.');
        setData(null);
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const onRefresh = useCallback(async () => {
    await loadQueue({ silent: true });
  }, [loadQueue]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return 'Date TBD';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatSubmittedAt = (iso?: string | null) => {
    if (!iso) return 'Unknown submit time';

    const raw = String(iso).trim();
    const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return raw;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatted = d.toLocaleString([], {
      timeZone: tz,
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return formatted;
  };

  const totalPending = useMemo(() => data?.pending_rows?.length || 0, [data?.pending_rows]);

  const openWorkout = useCallback(
    (workoutId: number) => {
      router.push({
        pathname: '/workout/[workoutId]',
        params: { workoutId: String(workoutId) },
      });
    },
    [router]
  );

  const markReviewed = useCallback(
    async (workoutId: number, sessionLabel?: string | null) => {
      try {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Mark as reviewed',
            `Mark ${sessionLabel || 'this'} feedback as reviewed? Can't be undone.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Mark Reviewed', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

        if (!confirmed) return;
        if (!token) return;
        setMarkingId(workoutId);

        const res: any = await fetchJson(`/coach/mobile/session-surveys/${workoutId}/mark-reviewed`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = res?.json ?? res;
        if (res?.ok !== true || payload?.ok !== true) {
          throw new Error(payload?.error || payload?.message || 'Failed to mark reviewed');
        }

        setData((prev) => {
          if (!prev) return prev;
          const row = prev.pending_rows.find((r) => r.workout_id === workoutId);
          if (!row) return prev;
          return {
            ...prev,
            pending_rows: prev.pending_rows.filter((r) => r.workout_id !== workoutId),
            archive_rows: [
              {
                ...row,
                reviewed: true,
                reviewed_at: payload?.reviewed_at || new Date().toISOString(),
              },
              ...prev.archive_rows,
            ],
          };
        });
      } catch (err: any) {
        console.error('mark reviewed failed', err);
        Alert.alert('Could not mark reviewed', err?.message || 'Please try again.');
      } finally {
        setMarkingId(null);
      }
    },
    [token]
  );

  const renderMetric = (label: string, value?: string | number | null) => {
    return (
      <View
        style={[
          styles.metricCard,
          label === 'RPE' && styles.metricCardRpe,
          label === 'Strength' && styles.metricCardStrength,
          label === 'Fatigue' && styles.metricCardFatigue,
        ]}
      >
        <ThemedText variant="bodyMuted" style={styles.metricLabel}>
          {label}
        </ThemedText>
        <ThemedText
          style={[
            styles.metricValue,
            label === 'RPE' && styles.metricValueRpe,
            label === 'Strength' && styles.metricValueStrength,
            label === 'Fatigue' && styles.metricValueFatigue,
          ]}
        >
          {value ?? '—'}
        </ThemedText>
      </View>
    );
  };

  const renderSurveyCard = (row: SurveyRow, opts?: { pending?: boolean }) => {
    const isPending = !!opts?.pending;
    return (
      <View key={`${isPending ? 'pending' : 'archive'}-${row.workout_id}`} style={[styles.card, isPending && styles.cardPending]}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleCol}>
            <ThemedText style={styles.athleteName}>{row.athlete_name}</ThemedText>
            <ThemedText variant="bodyMuted" style={styles.sessionMeta}>
              {row.label} · {formatDate(row.date)}
            </ThemedText>
          </View>
          {isPending && (
            <View style={styles.cardActionRow}>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={() => markReviewed(row.workout_id, row.label)}
                disabled={markingId === row.workout_id}
              >
                {markingId === row.workout_id ? (
                  <ActivityIndicator size="small" color="#E5E7EB" />
                ) : (
                  <ThemedText style={styles.secondaryButtonText}>Review</ThemedText>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={() => openWorkout(row.workout_id)}
              >
                <ThemedText style={styles.secondaryButtonText}>View Session</ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.metricsGrid}>
          {renderMetric(
            'RPE',
            row.survey?.rpe != null
              ? String(row.survey.rpe)
              : row.survey?.performance != null
              ? String(row.survey.performance)
              : '—'
          )}
          {renderMetric(
            'Strength',
            row.survey?.strength != null
              ? String(row.survey.strength)
              : row.survey?.energy != null
              ? String(row.survey.energy)
              : '—'
          )}
          {renderMetric(
            'Fatigue',
            row.survey?.fatigue != null
              ? String(row.survey.fatigue)
              : row.survey?.soreness != null
              ? String(row.survey.soreness)
              : '—'
          )}
        </View>

        {row.survey?.notes?.trim() ? (
          <View style={[styles.notesCard, isPending && styles.notesCardPending]}>
            <ThemedText variant="bodyMuted" style={styles.notesLabel}>
              Athlete Feedback
            </ThemedText>
            <ThemedText style={styles.notesValue}>
              {row.survey.notes.trim()}
            </ThemedText>
          </View>
        ) : null}

        <ThemedText variant="bodyMuted" style={styles.submittedText}>
          Submitted: {formatSubmittedAt(row.submitted_at)}
        </ThemedText>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ThemedView style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#94A3B8" />
          }
        >
          <View style={styles.header}>
            <ThemedText variant="h1" style={styles.title}>
              Post-Session Feedback
            </ThemedText>
            <ThemedText style={styles.headerSubhead}>Needs Review</ThemedText>
            <ThemedText variant="bodyMuted" style={styles.subtitle}>
              Newest submitted post-session surveys awaiting review.
            </ThemedText>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="small" color="#94A3B8" />
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <ThemedText variant="error">{error}</ThemedText>
            </View>
          ) : totalPending === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#86EFAC" />
              <ThemedText style={styles.emptyTitle}>Nothing needs review</ThemedText>
              <ThemedText variant="bodyMuted" style={styles.emptySubtitle}>
                New post-session feedback will appear here when athletes submit it.
              </ThemedText>
            </View>
          ) : (
            (data?.pending_rows || []).map((row) => renderSurveyCard(row, { pending: true }))
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
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  headerSubhead: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#C7BEE8',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 6,
    color: '#8EA0BE',
    fontSize: 14,
    lineHeight: 20,
  },
  centerState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    minHeight: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(8,16,38,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(8,16,38,0.96)',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardPending: {
    borderColor: 'rgba(109,91,208,0.22)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  athleteName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  sessionMeta: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 13,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(109,91,208,0.30)',
    backgroundColor: 'rgba(109,91,208,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(2,8,23,0.52)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricCardRpe: {
    borderColor: 'rgba(109,91,208,0.26)',
    backgroundColor: 'rgba(109,91,208,0.08)',
  },
  metricCardStrength: {
    borderColor: 'rgba(34,197,94,0.22)',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  metricCardFatigue: {
    borderColor: 'rgba(245,158,11,0.22)',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'none',
  },
  metricValueRpe: {
    color: '#D9D0FF',
  },
  metricValueStrength: {
    color: '#BBF7D0',
  },
  metricValueFatigue: {
    color: '#FCD34D',
  },
  notesCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(2,8,23,0.46)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  notesCardPending: {
    borderColor: 'rgba(59,130,246,0.16)',
  },
  notesLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  notesValue: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  submittedText: {
    marginTop: 10,
    color: '#7F91AE',
    fontSize: 12,
  },
});