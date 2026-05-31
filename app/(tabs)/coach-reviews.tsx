import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import RefreshScreen from '@/components/refresh-screen';
import SetVideoPlayerModal, { type SetVideoReviewTag, type SetVideoSummary } from '@/components/SetVideoPlayerModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getAthleteCoachReviews } from '@/lib/api';

type AthleteReview = Omit<SetVideoSummary, 'review_tags'> & {
  review_tags?: SetVideoReviewTag[] | null;
};

function statusLabel(value?: string | null) {
  if (value === 'not_requested' || value === 'archive_only') return 'Saved to Archive';
  if (value === 'reviewed') return 'Reviewed';
  if (value === 'needs_followup') return 'Needs follow-up';
  if (value === 'viewed') return 'Viewed';
  return 'Pending review';
}

function formatDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function compactDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function feedbackPreview(value?: string | null) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Coach reviewed this set.';
  return text.length > 118 ? `${text.slice(0, 115).trim()}...` : text;
}

function compactActual(video: { context?: SetVideoSummary['context'] | null }) {
  const context = video.context;
  if (!context) return null;
  const load = context.actual_weight_label
    || (context.actual_weight_kg != null ? `${context.actual_weight_kg} kg` : null);
  const reps = context.actual_reps != null ? String(context.actual_reps) : null;
  const rpe = context.actual_rpe != null ? String(context.actual_rpe) : null;
  if (!load && !reps && !rpe) return null;
  let line = load || 'Load ?';
  if (reps) line += ` x ${reps}`;
  if (rpe) line += ` @ RPE ${rpe}`;
  return line;
}

function reviewTagLabels(tags?: AthleteReview['review_tags']) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => {
      if (!tag) return null;
      if (typeof tag === 'string') {
        return tag
          .split('_')
          .filter(Boolean)
          .map((part) => (part === 'followup' ? 'Follow-Up' : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
          .join(' ');
      }
      return tag.label || tag.slug
        ?.split('_')
        .filter(Boolean)
        .map((part) => (part === 'followup' ? 'Follow-Up' : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
        .join(' ');
    })
    .filter(Boolean)
    .slice(0, 3);
}

export default function CoachReviewsScreen() {
  const router = useRouter();
  const [reviews, setReviews] = useState<AthleteReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<AthleteReview | null>(null);

  const loadReviews = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await getAthleteCoachReviews();
      const payload = res.json || {};
      if (!res.ok || !payload.ok) {
        if (res.status === 401) router.replace('/login');
        throw new Error(payload.error || `Could not load coach reviews (${res.status})`);
      }
      setReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load coach reviews.');
      setReviews([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadReviews({ silent: true });
    }, [loadReviews]),
  );

  const followupCount = useMemo(
    () => reviews.filter((review) => review.review_status === 'needs_followup').length,
    [reviews],
  );

  return (
    <ThemedView style={styles.screen}>
      {loading && !reviews.length ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#A7F3D0" />
        </View>
      ) : (
        <RefreshScreen
          style={styles.scroll}
          refreshing={refreshing}
          onRefresh={() => loadReviews({ silent: true })}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText style={styles.kicker}>Coach Reviews</ThemedText>
              <ThemedText style={styles.title}>Reviewed Training</ThemedText>
              <ThemedText style={styles.subtitle}>
                {reviews.length} review{reviews.length === 1 ? '' : 's'} · {followupCount} needs follow-up
              </ThemedText>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="sparkles-outline" size={24} color="#A7F3D0" />
            </View>
          </View>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <View style={styles.list}>
            {reviews.length > 0 ? (
              reviews.map((review) => {
                const context = review.context || {};
                const isFollowup = review.review_status === 'needs_followup';
                const movement = context.movement_name || context.lift_name || 'Movement';
                const setLabel = context.set_display_label || context.set_context_label || (context.set_index != null ? `Set ${context.set_index}` : 'Set');
                const planned = context.prescription_label || 'No planned snapshot';
                const logged = compactActual(review) || 'No logged actuals';
                const tags = reviewTagLabels(review.review_tags);

                return (
                  <TouchableOpacity
                    key={review.id}
                    style={[styles.card, isFollowup && styles.followupCard]}
                    activeOpacity={0.86}
                    onPress={() => setSelectedReview(review)}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={[styles.playBadge, isFollowup && styles.followupPlayBadge]}>
                        <Ionicons name={isFollowup ? 'alert' : 'play'} size={15} color={isFollowup ? '#FEF3C7' : '#DCFCE7'} />
                      </View>
                      <View style={styles.cardTitleBlock}>
                        <ThemedText style={styles.cardTitle}>{movement} · {setLabel}</ThemedText>
                        <ThemedText style={styles.cardMeta}>
                          {formatDate(context.session_date)}
                          {review.reviewed_at ? ` · Reviewed ${compactDate(review.reviewed_at)}` : ''}
                        </ThemedText>
                      </View>
                      <View style={[styles.statusPill, isFollowup && styles.followupPill]}>
                        <ThemedText style={[styles.statusText, isFollowup && styles.followupStatusText]}>
                          {statusLabel(review.review_status)}
                        </ThemedText>
                      </View>
                    </View>

                    <ThemedText style={styles.feedbackPreview} numberOfLines={3}>
                      {feedbackPreview(review.coach_feedback)}
                    </ThemedText>

                    <View style={styles.detailRows}>
                      <ThemedText style={styles.detailLine} numberOfLines={1}>
                        <ThemedText style={styles.detailLabel}>Plan: </ThemedText>
                        {planned}
                      </ThemedText>
                      <ThemedText style={styles.detailLine} numberOfLines={1}>
                        <ThemedText style={styles.detailLabel}>Log: </ThemedText>
                        {logged}
                      </ThemedText>
                      {review.video_angle_label ? (
                        <ThemedText style={styles.detailLine} numberOfLines={1}>
                          <ThemedText style={styles.detailLabel}>Angle: </ThemedText>
                          {review.video_angle_label}
                        </ThemedText>
                      ) : null}
                    </View>

                    {tags.length ? (
                      <View style={styles.tagRow}>
                        {tags.map((label) => (
                          <View key={String(label)} style={styles.tagPill}>
                            <ThemedText style={styles.tagText}>{label}</ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <ThemedText style={styles.emptyTitle}>No coach reviews yet</ThemedText>
                <ThemedText style={styles.emptyBody}>
                  When your coach reviews training and leaves feedback, it will land here.
                </ThemedText>
              </View>
            )}
          </View>
        </RefreshScreen>
      )}

      <SetVideoPlayerModal
        visible={!!selectedReview}
        videoId={selectedReview?.id ?? null}
        initialVideo={selectedReview as SetVideoSummary | null}
        initialUrl={selectedReview?.url || null}
        initialCoachFeedbackOpen
        onClose={() => {
          setSelectedReview(null);
          loadReviews({ silent: true });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
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
    paddingBottom: 96,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.24)',
    backgroundColor: 'rgba(20,184,166,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(15,23,42,0.78)',
    padding: 14,
  },
  followupCard: {
    borderColor: 'rgba(251,191,36,0.34)',
    backgroundColor: 'rgba(69,40,12,0.42)',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.28)',
    backgroundColor: 'rgba(22,101,52,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followupPlayBadge: {
    borderColor: 'rgba(251,191,36,0.36)',
    backgroundColor: 'rgba(180,83,9,0.36)',
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  cardMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.28)',
    backgroundColor: 'rgba(91,79,207,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  followupPill: {
    borderColor: 'rgba(251,191,36,0.38)',
    backgroundColor: 'rgba(180,83,9,0.30)',
  },
  statusText: {
    color: '#DDD6FE',
    fontSize: 10,
    fontWeight: '900',
  },
  followupStatusText: {
    color: '#FEF3C7',
  },
  feedbackPreview: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 12,
  },
  detailRows: {
    marginTop: 12,
    gap: 5,
  },
  detailLine: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  detailLabel: {
    color: '#A7F3D0',
    fontWeight: '900',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tagPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,23,42,0.52)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.62)',
    padding: 18,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyBody: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
});
