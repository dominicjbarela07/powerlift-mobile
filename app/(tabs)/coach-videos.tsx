import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import RefreshScreen from '@/components/refresh-screen';
import { ReviewFilterRow } from '@/components/reviews/review-filter-row';
import { ReviewItemCard } from '@/components/reviews/review-item-card';
import { AthleteCoachingScratchpadTrigger } from '@/components/coach-mobile/AthleteCoachingScratchpad';
import { SLMotionPressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import {
  getCoachReviewHub,
  type CoachReviewAthlete,
  type CoachReviewItem,
} from '@/lib/api';
import { createLatestRequestManager } from '@/lib/latest-request';
import {
  buildCoachVideoReviewReturnParams,
  type CoachVideoReviewReturnContext,
} from '@/lib/coach-video-review-return';

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

function openReview(
  router: ReturnType<typeof useRouter>,
  item: CoachReviewItem,
  returnContext: Extract<CoachVideoReviewReturnContext, { kind: 'hub' }>,
) {
  if (item.review_type === 'video') {
    router.push({
      pathname: '/(tabs)/coach-video-review',
      params: {
        videoId: String(item.source_id),
        ...buildCoachVideoReviewReturnParams(returnContext),
      },
    } as any);
  } else {
    router.push({ pathname: '/(tabs)/coach-session-review', params: { workoutId: String(item.source_id) } } as any);
  }
}

export default function CoachReviewHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string; reviewScrollY?: string }>();
  const [selectedAthlete, setSelectedAthlete] = useState(params.athleteId || '');
  const [payload, setPayload] = useState<ReviewHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialScrollY = Number(params.reviewScrollY);
  const scrollYRef = useRef(Number.isFinite(initialScrollY) && initialScrollY >= 0 ? initialScrollY : 0);
  const requests = useRef(createLatestRequestManager<Awaited<ReturnType<typeof getCoachReviewHub>>>()).current;

  useEffect(() => {
    setSelectedAthlete(params.athleteId || '');
  }, [params.athleteId]);

  useEffect(() => () => requests.cancel(), [requests]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
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
  const scratchpadAthlete = selectedAthlete
    ? payload?.athletes.find((athlete) => String(athlete.id) === selectedAthlete) || null
    : null;
  const summary = payload?.summary;
  const queueRoute = { pathname: '/(tabs)/coach-review-queue', params: routeParams } as any;
  const historyRoute = { pathname: '/(tabs)/coach-review-history', params: routeParams } as any;

  return (
    <RefreshScreen
      refreshing={refreshing}
      onRefresh={() => load(true)}
      contentContainerStyle={styles.screen}
      contentOffset={{ x: 0, y: scrollYRef.current }}
      onScroll={(event) => { scrollYRef.current = event.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={120}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>COACH / REVIEWS</Text>
          <Text style={styles.heading}>Review Hub</Text>
          <Text style={styles.subtitle}>Sessions and videos to review.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open video repository"
          onPress={() => router.push('/(tabs)/coach-video-archive' as any)}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Ionicons name="archive-outline" size={21} color={SLColors.textStrong} />
        </Pressable>
      </View>

      {athleteOptions.length > 1 ? (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>{selectedAthlete ? 'ATHLETE REVIEWS' : 'TEAM REVIEWS'}</Text>
          <ReviewFilterRow
            options={athleteOptions}
            selected={selectedAthlete}
            onSelect={setSelectedAthlete}
            accessibilityLabel="Filter reviews by athlete"
          />
        </View>
      ) : null}

      {scratchpadAthlete ? (
        <AthleteCoachingScratchpadTrigger
          athleteId={scratchpadAthlete.id}
          athleteName={scratchpadAthlete.name}
          variant="compact"
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
          <View style={styles.overview}>
            <LinearGradient
              colors={['#20122D', '#100D19', '#090A10']}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.overviewTop}>
              <View style={styles.overviewCopy}>
                <Text style={styles.overviewEyebrow}>NEEDS REVIEW</Text>
                <Text style={styles.overviewTitle}>
                  {summary.pending_total ? `${summary.pending_total} waiting` : 'All caught up'}
                </Text>
                <Text style={styles.overviewDetail}>
                  {summary.pending_total
                    ? 'Sessions and videos ready for feedback.'
                    : 'Nothing needs a review right now.'}
                </Text>
              </View>
              <View style={[styles.overviewSymbol, !summary.pending_total && styles.overviewSymbolDone]}>
                <Ionicons
                  name={summary.pending_total ? 'file-tray-full-outline' : 'checkmark'}
                  size={29}
                  color={summary.pending_total ? SLColors.accentMuted : SLColors.success}
                />
              </View>
            </View>
            <View style={styles.overviewMetrics}>
                <View style={styles.overviewMetric}>
                  <Text style={styles.metricNumber}>{summary.pending_sessions}</Text>
                  <Text style={styles.metricLabel}>SESSIONS</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.overviewMetric}>
                  <Text style={styles.metricNumber}>{summary.pending_videos}</Text>
                  <Text style={styles.metricLabel}>VIDEOS</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.overviewMetric}>
                  <Text style={styles.metricNumber}>{summary.follow_up}</Text>
                  <Text style={styles.metricLabel}>FOLLOW-UP</Text>
                </View>
            </View>
            {selectedAthlete ? (
              <Text style={styles.teamContext}>
                Team Reviews · {summary.team_pending} pending · {summary.team_follow_up} follow-up
              </Text>
            ) : null}
            <SLMotionPressable
              accessibilityLabel="Open Review Queue"
              accessibilityRole="button"
              onPress={() => router.push(queueRoute)}
              style={[styles.overviewAction, !summary.pending_total && styles.overviewActionQuiet]}
            >
              <Text style={[styles.overviewActionText, !summary.pending_total && styles.overviewActionTextQuiet]}>
                Open Review Queue
              </Text>
              <Ionicons name="arrow-forward" size={19} color={summary.pending_total ? SLColors.textStrong : SLColors.accentMuted} />
            </SLMotionPressable>
          </View>

          <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Review Queue</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push(queueRoute)}>
                  <Text style={styles.sectionLink}>View all</Text>
                </Pressable>
              </View>
              <View style={styles.list}>
                {(payload?.latest_queue || []).map((item, index) => (
                  <ReviewItemCard
                    key={item.key}
                    item={item}
                    compact
                    onPress={() => openReview(router, item, {
                      kind: 'hub',
                      athleteId: selectedAthlete ? Number(selectedAthlete) : undefined,
                      section: 'queue',
                      scrollY: scrollYRef.current,
                      queuePosition: index,
                    })}
                  />
                ))}
                {!payload?.latest_queue?.length ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="checkmark-circle-outline" size={30} color={SLColors.success} />
                    <Text style={styles.emptyTitle}>All caught up</Text>
                    <Text style={styles.emptyText}>There are no pending reviews in this scope.</Text>
                  </View>
                ) : null}
              </View>
            </>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Review History</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push(historyRoute)}>
              <Text style={styles.sectionLink}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            {(payload?.recent_history || []).map((item, index) => (
              <ReviewItemCard
                key={item.key}
                item={item}
                compact
                onPress={() => openReview(router, item, {
                  kind: 'hub',
                  athleteId: selectedAthlete ? Number(selectedAthlete) : undefined,
                  section: 'history',
                  scrollY: scrollYRef.current,
                  queuePosition: index,
                })}
              />
            ))}
            {!payload?.recent_history?.length ? (
              <Text style={styles.emptyText}>Completed reviews will appear here.</Text>
            ) : null}
          </View>

          <View style={styles.destinations}>
            <Text style={styles.destinationsLabel}>MORE REVIEW WORK</Text>
            <SLMotionPressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/coach-video-archive' as any)}
              style={styles.destinationRow}
            >
              <Ionicons name="videocam-outline" size={21} color={SLColors.accentMuted} />
              <View style={styles.destinationCopy}>
                <Text style={styles.destinationTitle}>Video Repository</Text>
                <Text style={styles.destinationDetail}>Search and revisit submitted videos</Text>
              </View>
              <Ionicons name="arrow-forward" size={19} color={SLColors.textMuted} />
            </SLMotionPressable>
            <SLMotionPressable
              accessibilityRole="button"
              onPress={() => router.push(historyRoute)}
              style={styles.destinationRow}
            >
              <Ionicons name="time-outline" size={21} color={SLColors.accentMuted} />
              <View style={styles.destinationCopy}>
                <Text style={styles.destinationTitle}>Past Work</Text>
                <Text style={styles.destinationDetail}>All completed reviews</Text>
              </View>
              <Ionicons name="arrow-forward" size={19} color={SLColors.textMuted} />
            </SLMotionPressable>
          </View>
        </>
      ) : null}
    </RefreshScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 22, paddingHorizontal: 20, paddingBottom: 132 },
  headerRow: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 18,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: SLColors.accentViolet, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  heading: { color: SLColors.textStrong, fontSize: 37, fontWeight: '800', letterSpacing: -1.5, marginTop: 7 },
  subtitle: { color: SLColors.textMuted, fontSize: 14, marginTop: 1 },
  headerAction: {
    alignItems: 'center', backgroundColor: '#13101A', borderColor: SLColors.borderStandard,
    borderRadius: 14, borderWidth: 1, height: 44, justifyContent: 'center', width: 44,
  },
  filterSection: { gap: 9 },
  filterLabel: { color: SLColors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  overview: {
    backgroundColor: '#100D19', borderColor: '#4B365E', borderRadius: 20,
    borderWidth: 1, overflow: 'hidden', padding: 20,
  },
  overviewTop: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  overviewCopy: { flex: 1, minWidth: 0 },
  overviewEyebrow: { color: SLColors.accentMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  overviewTitle: { color: SLColors.textStrong, fontSize: 31, fontWeight: '800', letterSpacing: -0.8, marginTop: 7 },
  overviewDetail: { color: SLColors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 },
  overviewSymbol: {
    alignItems: 'center', backgroundColor: 'rgba(170, 98, 255, 0.10)',
    borderColor: 'rgba(170, 98, 255, 0.34)', borderRadius: 17, borderWidth: 1,
    height: 52, justifyContent: 'center', width: 52,
  },
  overviewSymbolDone: { backgroundColor: 'rgba(143, 178, 154, 0.08)', borderColor: 'rgba(143, 178, 154, 0.28)' },
  overviewMetrics: {
    alignItems: 'center', borderBottomColor: SLColors.borderSubtle, borderBottomWidth: 1,
    borderTopColor: SLColors.borderSubtle, borderTopWidth: 1, flexDirection: 'row',
    marginTop: 21, paddingVertical: 15,
  },
  overviewMetric: { flex: 1, gap: 4 },
  metricNumber: { color: SLColors.textStrong, fontSize: 21, fontWeight: '800' },
  metricLabel: { color: SLColors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  metricDivider: { backgroundColor: SLColors.borderSubtle, height: 29, marginRight: 16, width: 1 },
  teamContext: { color: SLColors.textMuted, fontSize: 12, marginTop: 10 },
  overviewAction: {
    alignItems: 'center', backgroundColor: '#7030CC', borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 16,
    minHeight: 48, paddingHorizontal: 16,
  },
  overviewActionQuiet: {
    backgroundColor: 'rgba(170, 98, 255, 0.08)',
    borderColor: 'rgba(170, 98, 255, 0.22)', borderWidth: 1,
  },
  overviewActionText: { color: SLColors.textStrong, fontSize: 15, fontWeight: '800' },
  overviewActionTextQuiet: { color: SLColors.accentMuted },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  sectionTitle: { color: SLColors.textStrong, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionLink: { color: SLColors.accentMuted, fontSize: 13, fontWeight: '700' },
  list: { gap: 9, marginTop: -10 },
  emptyState: { alignItems: 'center', gap: 5, paddingVertical: 20 },
  emptyTitle: { color: SLColors.textStrong, fontSize: 16, fontWeight: '700' },
  emptyText: { color: SLColors.textMuted, fontSize: 13 },
  destinations: { borderTopColor: SLColors.borderSubtle, borderTopWidth: 1, marginTop: 8 },
  destinationsLabel: { color: SLColors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 20, marginBottom: 5 },
  destinationRow: {
    alignItems: 'center', borderBottomColor: SLColors.borderSubtle, borderBottomWidth: 1,
    flexDirection: 'row', gap: 14, minHeight: 73,
  },
  destinationCopy: { flex: 1, gap: 3 },
  destinationTitle: { color: SLColors.textStrong, fontSize: 15, fontWeight: '700' },
  destinationDetail: { color: SLColors.textMuted, fontSize: 12 },
  centerState: { alignItems: 'center', paddingVertical: 50 },
  errorState: {
    alignItems: 'center', backgroundColor: SLColors.dangerSoft, borderColor: SLColors.danger,
    borderRadius: SLRadius.md, borderWidth: 1, flexDirection: 'row', gap: 9, padding: SLSpacing.md,
  },
  errorText: { color: SLColors.danger, flex: 1, fontSize: 14 },
  pressed: { opacity: 0.78 },
});
