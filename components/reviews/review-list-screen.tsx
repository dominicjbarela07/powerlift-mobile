import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import RefreshScreen from '@/components/refresh-screen';
import { ReviewFilterRow } from '@/components/reviews/review-filter-row';
import { ReviewItemCard } from '@/components/reviews/review-item-card';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import {
  getCoachReviewHistory,
  getCoachReviewQueue,
  type CoachReviewAthlete,
  type CoachReviewItem,
  type CoachReviewPagination,
  type CoachReviewType,
} from '@/lib/api';
import { createLatestRequestManager } from '@/lib/latest-request';

type Payload = {
  ok: boolean;
  athletes: CoachReviewAthlete[];
  items: CoachReviewItem[];
  pagination: CoachReviewPagination;
};

function openReview(router: ReturnType<typeof useRouter>, item: CoachReviewItem) {
  if (item.review_type === 'video') {
    router.push({ pathname: '/(tabs)/coach-video-review', params: { videoId: String(item.source_id) } } as any);
    return;
  }
  router.push({ pathname: '/(tabs)/coach-session-review', params: { workoutId: String(item.source_id) } } as any);
}

export function ReviewListScreen({ mode }: { mode: 'queue' | 'history' }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string }>();
  const [athleteId, setAthleteId] = useState(params.athleteId || '');
  const [reviewType, setReviewType] = useState<CoachReviewType>('all');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [items, setItems] = useState<CoachReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requests = useRef(createLatestRequestManager<Awaited<ReturnType<typeof getCoachReviewQueue>>>()).current;

  useEffect(() => {
    setAthleteId(params.athleteId || '');
  }, [params.athleteId]);

  useEffect(() => () => requests.cancel(), [requests]);

  const load = useCallback(async (page = 1, append = false, refresh = false) => {
    if (append) setLoadingMore(true);
    else if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const request = mode === 'queue' ? getCoachReviewQueue : getCoachReviewHistory;
    const result = await requests.run((signal) => request({
        athlete_id: athleteId || undefined,
        review_type: reviewType,
        page,
        per_page: 20,
      }, signal));
    if (result.kind === 'cancelled' || result.kind === 'obsolete') return;
    if (result.kind === 'error') {
      setError((result.error as any)?.message || `Could not load review ${mode}.`);
    } else {
      const res = result.value;
      const next = res.json as Payload | null;
      if (!res.ok || !next?.ok) {
        if (res.status === 401) router.replace('/login');
        setError((res.json as any)?.error || `Could not load review ${mode}.`);
      } else {
        setPayload(next);
        setItems((current) => append ? [...current, ...(next.items || [])] : (next.items || []));
      }
    }
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, [athleteId, mode, requests, reviewType, router]);

  useEffect(() => { load(); }, [load]);

  const athleteOptions = useMemo(() => [
    { value: '', label: 'Team' },
    ...(payload?.athletes || []).map((athlete) => ({ value: String(athlete.id), label: athlete.name })),
  ], [payload?.athletes]);

  return (
    <RefreshScreen
      refreshing={refreshing}
      onRefresh={() => load(1, false, true)}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Back to Review Hub">
          <Ionicons name="chevron-back" size={22} color={SLColors.textStrong} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{mode === 'queue' ? 'Review Queue' : 'Past Review Work'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'queue' ? 'Session and video reviews that need attention.' : 'Completed review history across your team.'}
          </Text>
        </View>
      </View>

      <ReviewFilterRow
        options={athleteOptions}
        selected={athleteId}
        onSelect={setAthleteId}
        accessibilityLabel="Filter by athlete"
      />
      <ReviewFilterRow
        options={[
          { value: 'all', label: 'All Reviews' },
          { value: 'session', label: 'Sessions' },
          { value: 'video', label: 'Videos' },
        ]}
        selected={reviewType}
        onSelect={(value) => setReviewType(value as CoachReviewType)}
        accessibilityLabel="Filter by review type"
      />

      {loading && !payload ? (
        <View style={styles.center}><ActivityIndicator color={SLColors.accentViolet} /></View>
      ) : null}
      {error ? (
        <Pressable onPress={() => load()} style={styles.error}>
          <Ionicons name="alert-circle-outline" size={22} color={SLColors.danger} />
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </Pressable>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name={mode === 'queue' ? 'checkmark-circle-outline' : 'time-outline'}
            size={36}
            color={mode === 'queue' ? SLColors.success : SLColors.textMuted}
          />
          <Text style={styles.emptyTitle}>{mode === 'queue' ? 'All caught up' : 'No review history yet'}</Text>
          <Text style={styles.emptyText}>
            {mode === 'queue' ? 'No pending reviews match these filters.' : 'Completed reviews will appear here.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {items.map((item) => (
          <ReviewItemCard key={item.key} item={item} onPress={() => openReview(router, item)} />
        ))}
      </View>

      {payload?.pagination?.has_next ? (
        <Pressable
          disabled={loadingMore}
          onPress={() => load(payload.pagination.page + 1, true)}
          style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}
        >
          {loadingMore ? <ActivityIndicator color={SLColors.accentViolet} /> : <Text style={styles.loadMoreText}>Load More</Text>}
        </Pressable>
      ) : null}
    </RefreshScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: SLSpacing.md, paddingBottom: 120 },
  header: {
    alignItems: 'flex-start', flexDirection: 'row', gap: SLSpacing.sm,
    paddingHorizontal: SLSpacing.lg, paddingTop: SLSpacing.sm,
  },
  backButton: {
    alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.md, borderWidth: 1, height: 42, justifyContent: 'center', width: 42,
  },
  headerCopy: { flex: 1 },
  title: { color: SLColors.textStrong, fontSize: 29, fontWeight: '800' },
  subtitle: { color: SLColors.textMuted, fontSize: 15, lineHeight: 21, marginTop: 3 },
  center: { alignItems: 'center', minHeight: 180, justifyContent: 'center' },
  error: {
    alignItems: 'center', backgroundColor: SLColors.dangerSoft, borderColor: SLColors.danger,
    borderRadius: SLRadius.md, borderWidth: 1, flexDirection: 'row', gap: 8, padding: SLSpacing.md,
  },
  errorText: { color: SLColors.danger, flex: 1, fontSize: 14 },
  empty: {
    alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.lg, borderWidth: 1, gap: 7, padding: SLSpacing.xl,
  },
  emptyTitle: { color: SLColors.textStrong, fontSize: 19, fontWeight: '700' },
  emptyText: { color: SLColors.textMuted, fontSize: 14, textAlign: 'center' },
  list: { gap: SLSpacing.sm },
  loadMore: {
    alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderFocus,
    borderRadius: SLRadius.md, borderWidth: 1, minHeight: 50, justifyContent: 'center',
  },
  loadMoreText: { color: SLColors.accentMuted, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
