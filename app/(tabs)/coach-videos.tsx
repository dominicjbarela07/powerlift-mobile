import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import RefreshScreen from '@/components/refresh-screen';
import { ReviewFilterRow } from '@/components/reviews/review-filter-row';
import { ReviewItemCard } from '@/components/reviews/review-item-card';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import {
  getCoachReviewHub,
  type CoachReviewAthlete,
  type CoachReviewItem,
} from '@/lib/api';
import { createLatestRequestManager } from '@/lib/latest-request';

type ReviewHubPayload = {
  ok: boolean;
  athletes: CoachReviewAthlete[];
  selected_athlete_id?: number | null;
  summary: {
    pending_total: number;
    pending_sessions: number;
    pending_videos: number;
    follow_up: number;
    team_pending: number;
    team_follow_up: number;
    team_caught_up: boolean;
  };
  latest_queue: CoachReviewItem[];
  recent_history: CoachReviewItem[];
};

function openReview(router: ReturnType<typeof useRouter>, item: CoachReviewItem) {
  if (item.review_type === 'video') {
    router.push({ pathname: '/(tabs)/coach-video-review', params: { videoId: String(item.source_id) } } as any);
  } else {
    router.push({ pathname: '/(tabs)/coach-session-review', params: { workoutId: String(item.source_id) } } as any);
  }
}

function SummaryCard({
  icon,
  title,
  value,
  detail,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  value: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} color={SLColors.accentViolet} size={23} />
      </View>
      <View style={styles.summaryCopy}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text numberOfLines={2} style={styles.summaryDetail}>{detail}</Text>
      </View>
    </Pressable>
  );
}

export default function CoachReviewHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string }>();
  const [selectedAthlete, setSelectedAthlete] = useState(params.athleteId || '');
  const [payload, setPayload] = useState<ReviewHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requests = useRef(createLatestRequestManager<Awaited<ReturnType<typeof getCoachReviewHub>>>()).current;

  useEffect(() => {
    setSelectedAthlete(params.athleteId || '');
  }, [params.athleteId]);

  useEffect(() => () => requests.cancel(), [requests]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    const result = await requests.run((signal) => getCoachReviewHub(
      { athlete_id: selectedAthlete || undefined },
      signal,
    ));
    if (result.kind === 'cancelled' || result.kind === 'obsolete') return;
    if (result.kind === 'error') {
      setError((result.error as any)?.message || 'Could not load the Review Hub.');
    } else {
      const res = result.value;
      const next = res.json as ReviewHubPayload | null;
      if (!res.ok || !next?.ok) {
        if (res.status === 401) router.replace('/login');
        setError((res.json as any)?.error || 'Could not load the Review Hub.');
      } else {
        setPayload(next);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [requests, router, selectedAthlete]);

  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const athleteOptions = useMemo(() => [
    { value: '', label: 'Team' },
    ...(payload?.athletes || []).map((athlete) => ({ value: String(athlete.id), label: athlete.name })),
  ], [payload?.athletes]);

  const routeParams = selectedAthlete ? { athleteId: selectedAthlete } : undefined;
  const summary = payload?.summary;

  return (
    <RefreshScreen
      refreshing={refreshing}
      onRefresh={() => load(true)}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Review Hub</Text>
          <Text style={styles.subtitle}>All reviews in one place.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open video repository"
          onPress={() => router.push('/(tabs)/coach-video-archive' as any)}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Ionicons name="archive-outline" size={20} color={SLColors.accentMuted} />
          <Text style={styles.headerActionText}>Repository</Text>
        </Pressable>
      </View>

      {athleteOptions.length > 1 ? (
        <ReviewFilterRow
          options={athleteOptions}
          selected={selectedAthlete}
          onSelect={setSelectedAthlete}
          accessibilityLabel="Filter reviews by athlete"
        />
      ) : null}

      {loading && !payload ? (
        <View style={styles.centerState}><ActivityIndicator color={SLColors.accentViolet} /></View>
      ) : null}
      {error ? (
        <Pressable onPress={() => load(false)} style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={22} color={SLColors.danger} />
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </Pressable>
      ) : null}

      {summary ? (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard
              icon="file-tray-full-outline"
              title="Review Queue"
              value={String(summary.pending_total)}
              detail={`${summary.pending_sessions} Session · ${summary.pending_videos} video`}
              onPress={() => router.push({ pathname: '/(tabs)/coach-review-queue', params: routeParams } as any)}
            />
            <SummaryCard
              icon="people-outline"
              title="Team Reviews"
              value={summary.team_caught_up ? 'Caught up' : `${summary.team_pending} pending`}
              detail={summary.team_follow_up ? `${summary.team_follow_up} follow-up` : 'No follow-up waiting'}
              onPress={() => { setSelectedAthlete(''); }}
            />
            <SummaryCard
              icon="videocam-outline"
              title="Video Repository"
              value="Browse"
              detail="Search, filter, revisit"
              onPress={() => router.push('/(tabs)/coach-video-archive' as any)}
            />
            <SummaryCard
              icon="time-outline"
              title="Past Work"
              value="History"
              detail="Completed reviews"
              onPress={() => router.push({ pathname: '/(tabs)/coach-review-history', params: routeParams } as any)}
            />
          </View>

          <Pressable
            onPress={() => router.push({ pathname: '/(tabs)/coach-review-queue', params: routeParams } as any)}
            style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}
          >
            <View style={styles.primaryIcon}>
              <Ionicons name="notifications-outline" size={26} color={SLColors.accentViolet} />
            </View>
            <View style={styles.primaryCopy}>
              <Text style={styles.primaryEyebrow}>Needs Review</Text>
              <Text style={styles.primaryTitle}>{summary.pending_total} pending</Text>
              <Text style={styles.primaryDetail}>{summary.follow_up} follow-up · {summary.team_pending} team-wide</Text>
            </View>
            <View style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Open Queue</Text>
              <Ionicons name="chevron-forward" size={18} color={SLColors.white} />
            </View>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Review Queue</Text>
            <Pressable onPress={() => router.push({ pathname: '/(tabs)/coach-review-queue', params: routeParams } as any)}>
              <Text style={styles.sectionLink}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            {(payload?.latest_queue || []).map((item) => (
              <ReviewItemCard key={item.key} item={item} compact onPress={() => openReview(router, item)} />
            ))}
            {!payload?.latest_queue?.length ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={30} color={SLColors.success} />
                <Text style={styles.emptyTitle}>All caught up</Text>
                <Text style={styles.emptyText}>There are no pending reviews in this scope.</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Review History</Text>
            <Pressable onPress={() => router.push({ pathname: '/(tabs)/coach-review-history', params: routeParams } as any)}>
              <Text style={styles.sectionLink}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            {(payload?.recent_history || []).map((item) => (
              <ReviewItemCard key={item.key} item={item} compact onPress={() => openReview(router, item)} />
            ))}
            {!payload?.recent_history?.length ? (
              <Text style={styles.emptyText}>Completed reviews will appear here.</Text>
            ) : null}
          </View>

          <View style={styles.teamCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="people-outline" size={23} color={SLColors.accentViolet} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>Team Reviews</Text>
              <Text style={[styles.summaryValue, summary.team_caught_up && styles.successText]}>
                {summary.team_caught_up ? 'All caught up' : `${summary.team_pending} pending`}
              </Text>
            </View>
            <Ionicons
              name={summary.team_caught_up ? 'checkmark-circle' : 'alert-circle-outline'}
              size={30}
              color={summary.team_caught_up ? SLColors.success : SLColors.warning}
            />
          </View>
        </>
      ) : null}
    </RefreshScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: SLSpacing.lg, paddingBottom: 120 },
  headerRow: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: SLSpacing.lg, paddingTop: SLSpacing.sm,
  },
  heading: { color: SLColors.textStrong, fontSize: 34, fontWeight: '800' },
  subtitle: { color: SLColors.textMuted, fontSize: 16, marginTop: 3 },
  headerAction: {
    alignItems: 'center', borderColor: SLColors.borderFocus, borderRadius: SLRadius.md,
    borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingVertical: 11,
  },
  headerActionText: { color: SLColors.accentMuted, fontSize: 14, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLSpacing.sm },
  summaryCard: {
    alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.lg, borderWidth: 1, flexDirection: 'row', gap: 8,
    minHeight: 112, paddingHorizontal: 12, paddingVertical: SLSpacing.md, width: '48.5%',
  },
  summaryIcon: {
    alignItems: 'center', backgroundColor: SLColors.accentSoft, borderColor: SLColors.borderFocus,
    borderRadius: SLRadius.md, borderWidth: 1, height: 42, justifyContent: 'center', width: 42,
  },
  summaryCopy: { flex: 1, gap: 2, minWidth: 0 },
  summaryTitle: { color: SLColors.textStrong, fontSize: 14, fontWeight: '700' },
  summaryValue: { color: SLColors.accentMuted, fontSize: 15, fontWeight: '700' },
  summaryDetail: { color: SLColors.textMuted, fontSize: 11 },
  primaryCta: {
    alignItems: 'center', backgroundColor: SLColors.focus, borderColor: SLColors.borderFocus,
    borderRadius: SLRadius.lg, borderWidth: 1, flexDirection: 'row', gap: SLSpacing.md, padding: SLSpacing.lg,
  },
  primaryIcon: {
    alignItems: 'center', backgroundColor: SLColors.accentSoft, borderRadius: SLRadius.md,
    height: 58, justifyContent: 'center', width: 58,
  },
  primaryCopy: { flex: 1, gap: 2 },
  primaryEyebrow: { color: SLColors.accentViolet, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  primaryTitle: { color: SLColors.textStrong, fontSize: 23, fontWeight: '800' },
  primaryDetail: { color: SLColors.textMuted, fontSize: 13 },
  primaryButton: {
    alignItems: 'center', backgroundColor: '#6928D0', borderRadius: SLRadius.md,
    flexDirection: 'row', gap: 3, paddingHorizontal: 13, paddingVertical: 12,
  },
  primaryButtonText: { color: SLColors.white, fontSize: 14, fontWeight: '800' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: SLColors.textStrong, fontSize: 20, fontWeight: '800' },
  sectionLink: { color: SLColors.accentViolet, fontSize: 15, fontWeight: '700' },
  list: { gap: SLSpacing.sm },
  emptyState: { alignItems: 'center', gap: 5, paddingVertical: 28 },
  emptyTitle: { color: SLColors.textStrong, fontSize: 18, fontWeight: '700' },
  emptyText: { color: SLColors.textMuted, fontSize: 14, textAlign: 'center' },
  teamCard: {
    alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.lg, borderWidth: 1, flexDirection: 'row', gap: SLSpacing.md, padding: SLSpacing.lg,
  },
  successText: { color: SLColors.success },
  centerState: { alignItems: 'center', paddingVertical: 50 },
  errorState: {
    alignItems: 'center', backgroundColor: SLColors.dangerSoft, borderColor: SLColors.danger,
    borderRadius: SLRadius.md, borderWidth: 1, flexDirection: 'row', gap: 9, padding: SLSpacing.md,
  },
  errorText: { color: SLColors.danger, flex: 1, fontSize: 14 },
  pressed: { opacity: 0.78 },
});
