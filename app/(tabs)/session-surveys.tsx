

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import RefreshScreen from '@/components/refresh-screen';
import { SLButton, SLErrorState, SLLoadingState, SLScreen, SLStatusPill } from '@/components/ui';
import { SLColors, SLSpacing, SLTypography } from '@/constants/theme';
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
  const params = useLocalSearchParams<{ athleteId?: string | string[]; athleteName?: string | string[]; workoutId?: string | string[] }>();
  const { token } = useAuth();
  const athleteIdParam = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const athleteNameParam = Array.isArray(params.athleteName) ? params.athleteName[0] : params.athleteName;
  const workoutIdParam = Array.isArray(params.workoutId) ? params.workoutId[0] : params.workoutId;

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

        const query = new URLSearchParams();
        const requestedAthleteId = Number(athleteIdParam);
        if (Number.isFinite(requestedAthleteId) && requestedAthleteId > 0) {
          query.set('athlete_id', String(requestedAthleteId));
        }

        const res: any = await fetchJson(`/coach/mobile/session-surveys${query.toString() ? `?${query.toString()}` : ''}`, {
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
    [athleteIdParam, token]
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

  const visiblePendingRows = useMemo(() => {
    const rows = data?.pending_rows || [];
    const requestedWorkoutId = Number(workoutIdParam);
    if (Number.isFinite(requestedWorkoutId) && requestedWorkoutId > 0) {
      return rows.filter((row) => Number(row.workout_id) === requestedWorkoutId);
    }
    return rows;
  }, [data?.pending_rows, workoutIdParam]);
  const visiblePendingCount = visiblePendingRows.length;

  const openWorkout = useCallback(
    (workoutId: number) => {
      router.push({
        pathname: '/workout/[workoutId]',
        params: { workoutId: String(workoutId) },
      });
    },
    [router]
  );

  const openAthlete = useCallback(
    (row: SurveyRow) => {
      router.push({
        pathname: '/(tabs)/coach-athlete/[athleteId]',
        params: { athleteId: String(row.athlete_id), athleteName: row.athlete_name },
      } as any);
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
      <View style={styles.metricCell}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>
          {value ?? '—'}
        </Text>
      </View>
    );
  };

  const renderSurveyCard = (row: SurveyRow, opts?: { pending?: boolean }) => {
    const isPending = !!opts?.pending;
    return (
      <View key={`${isPending ? 'pending' : 'archive'}-${row.workout_id}`} style={[styles.queueRow, !isPending && styles.archiveRow]}>
        <View style={styles.rowRail} />
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleCol}>
            <View style={styles.titleLine}>
              <Text style={styles.athleteName} numberOfLines={1}>{row.athlete_name}</Text>
              <SLStatusPill label="Pending" tone="review" icon="clipboard-outline" />
            </View>
            <Text style={styles.sessionMeta} numberOfLines={1}>
              {row.label} · {formatDate(row.date)}
            </Text>
          </View>
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
          <View style={styles.notesPreview}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesValue} numberOfLines={4}>
              {row.survey.notes.trim()}
            </Text>
          </View>
        ) : null}

        <Text style={styles.submittedText}>
          Submitted: {formatSubmittedAt(row.submitted_at)}
        </Text>

        {isPending ? (
          <View style={styles.cardActionRow}>
            <SLButton
              fullWidth
              iconLeft="checkmark-done-outline"
              label="Mark Reviewed"
              loading={markingId === row.workout_id}
              onPress={() => markReviewed(row.workout_id, row.label)}
            />
            <View style={styles.secondaryActionRow}>
              <SLButton
                fullWidth
                iconLeft="open-outline"
                label="Open Workout"
                onPress={() => openWorkout(row.workout_id)}
                size="sm"
                variant="secondary"
                style={styles.secondaryAction}
              />
              <SLButton
                fullWidth
                iconLeft="person-outline"
                label="Open Athlete"
                onPress={() => openAthlete(row)}
                size="sm"
                variant="secondary"
                style={styles.secondaryAction}
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SLScreen edges="none" padded={false}>
        <RefreshScreen
          contentContainerStyle={styles.scrollContent}
          onRefresh={onRefresh}
          refreshing={refreshing}
          style={styles.scroll}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Session Reviews</Text>
            <View style={styles.headerMetaRow}>
              <SLStatusPill label={`${visiblePendingCount} pending`} tone={visiblePendingCount > 0 ? 'review' : 'success'} />
              {athleteNameParam ? <Text style={styles.contextText} numberOfLines={1}>{athleteNameParam}</Text> : null}
            </View>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <SLLoadingState title="Loading Reviews" />
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <SLErrorState
                actionLabel="Try Again"
                message={error}
                onActionPress={() => loadQueue()}
                title="Could not load reviews"
              />
            </View>
          ) : visiblePendingCount === 0 ? (
            <View style={styles.compactEmpty}>
              <Ionicons name="checkmark-circle-outline" size={18} color={SLColors.success} />
              <Text style={styles.compactEmptyText}>No pending reviews</Text>
            </View>
          ) : (
            <View style={styles.queueStack}>
              {visiblePendingRows.map((row) => renderSurveyCard(row, { pending: true }))}
            </View>
          )}
        </RefreshScreen>
    </SLScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
    paddingTop: SLSpacing.md,
  },
  header: {
    gap: SLSpacing.xs,
    marginBottom: SLSpacing.sm,
    paddingHorizontal: SLSpacing.md,
  },
  title: {
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: SLTypography.title.lineHeight,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLSpacing.sm,
  },
  contextText: {
    color: SLColors.textMuted,
    flexShrink: 1,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    lineHeight: SLTypography.caption.lineHeight,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
  },
  queueStack: {
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
  },
  queueRow: {
    backgroundColor: 'rgba(10,11,11,0.20)',
    borderBottomWidth: 1,
    borderBottomColor: SLColors.shellHairline,
    gap: SLSpacing.sm,
    padding: SLSpacing.md,
    paddingLeft: SLSpacing.lg,
    position: 'relative',
  },
  archiveRow: {
    backgroundColor: 'rgba(10,11,11,0.12)',
  },
  rowRail: {
    backgroundColor: SLColors.railViolet,
    bottom: SLSpacing.md,
    left: 0,
    position: 'absolute',
    top: SLSpacing.md,
    width: 3,
  },
  cardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'space-between',
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  athleteName: {
    color: SLColors.textStrong,
    flex: 1,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '800',
    lineHeight: SLTypography.cardTitle.lineHeight,
  },
  sessionMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  cardActionRow: {
    gap: SLSpacing.sm,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  secondaryAction: {
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.shellHairline,
  },
  metricCell: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: SLSpacing.sm,
    paddingVertical: SLSpacing.sm,
  },
  metricLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '800',
    lineHeight: SLTypography.body.lineHeight,
  },
  notesPreview: {
    backgroundColor: 'rgba(10,11,11,0.22)',
    borderLeftWidth: 2,
    borderLeftColor: SLColors.borderSelected,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  notesLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notesValue: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    lineHeight: SLTypography.body.lineHeight,
  },
  submittedText: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  compactEmpty: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.shellHairline,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 48,
    paddingHorizontal: SLSpacing.md,
  },
  compactEmptyText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
  },
});
