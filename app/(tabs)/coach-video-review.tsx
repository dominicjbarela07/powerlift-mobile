import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { TextInput } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import RefreshScreen from '@/components/refresh-screen';
import SetVideoPlayerModal, { type SetVideoSummary } from '@/components/SetVideoPlayerModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { fetchJson, getCoachVideoReviewAttachment, getCoachVideoReviewInbox } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { SLColors, SLRadius, SLShadows, SLTypography } from '@/constants/theme';

const REVIEW_TAG_OPTIONS = [
  ['great_set', 'Great Set'],
  ['top_set', 'Top Set'],
  ['technique', 'Technique'],
  ['depth', 'Depth'],
  ['brace', 'Brace'],
  ['bar_path', 'Bar Path'],
  ['fatigue', 'Fatigue'],
  ['needs_followup', 'Needs Follow-Up'],
  ['competition_prep', 'Competition Prep'],
] as const;

const VIDEO_ANGLE_OPTIONS = [
  ['unknown', 'Unknown Angle'],
  ['front', 'Front'],
  ['side', 'Side'],
  ['front_diagonal', 'Front Diagonal'],
  ['rear_diagonal', 'Rear Diagonal'],
  ['rear', 'Rear'],
  ['other', 'Other'],
] as const;

function normalizeReviewTagSlugs(tags: SetVideoSummary['review_tags']) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => {
      if (!tag) return null;
      if (typeof tag === 'string') return tag;
      return tag.slug || null;
    })
    .filter((tag): tag is string => !!tag);
}

function statusLabel(value?: string | null) {
  if (value === 'not_requested' || value === 'archive_only') return 'Saved to Archive';
  if (value === 'reviewed') return 'Reviewed';
  if (value === 'needs_followup') return 'Needs follow-up';
  if (value === 'viewed') return 'Viewed';
  return 'Pending review';
}

function formatDate(value?: string | null) {
  if (!value) return 'Session date unknown';
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

function compactActual(video: SetVideoSummary) {
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

export default function CoachVideoReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ videoId?: string }>();
  const requestedVideoId = Number(params.videoId);
  const [videos, setVideos] = useState<SetVideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<SetVideoSummary | null>(null);
  const [feedback, setFeedback] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [privateNotesOpen, setPrivateNotesOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [videoAngle, setVideoAngle] = useState('unknown');
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!selectedVideo) return;
    setFeedback(selectedVideo.coach_feedback || '');
    setPrivateNotes(selectedVideo.coach_private_notes || '');
    setPrivateNotesOpen(false);
    setSelectedTags(normalizeReviewTagSlugs(selectedVideo.review_tags));
    setVideoAngle(selectedVideo.video_angle || 'unknown');
    setSavingAction(null);
  }, [selectedVideo?.id]);

  const loadInbox = useCallback(async (opts?: { silent?: boolean; showRefreshIndicator?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      if (silent) {
        if (opts?.showRefreshIndicator !== false) setRefreshing(true);
      } else setLoading(true);
      setError(null);
      const res = await getCoachVideoReviewInbox();
      const payload = res.json || {};
      if (!res.ok || !payload.ok) {
        if (res.status === 401) router.replace('/login');
        throw new Error(payload.error || `Could not load video review (${res.status})`);
      }
      setVideos(Array.isArray(payload.videos) ? payload.videos : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load video review.');
      setVideos([]);
    } finally {
      if (silent) setRefreshing(false);
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadInbox({ silent: true, showRefreshIndicator: false });
    }, [loadInbox]),
  );

  useEffect(() => {
    if (!Number.isFinite(requestedVideoId) || requestedVideoId <= 0) return;
    let active = true;
    getCoachVideoReviewAttachment(requestedVideoId)
      .then((res) => {
        if (!active) return;
        const payload = res.json || {};
        if (!res.ok || !payload.ok || !payload.video) {
          throw new Error(payload.error || 'Could not open this video review.');
        }
        setSelectedVideo(payload.video as SetVideoSummary);
      })
      .catch((caught: any) => {
        if (active) setError(caught?.message || 'Could not open this video review.');
      });
    return () => { active = false; };
  }, [requestedVideoId]);

  const pendingCount = useMemo(
    () => videos.filter((video) => video.review_status === 'pending').length,
    [videos],
  );

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    ));
  }, []);

  const saveReview = useCallback(async (action: 'save' | 'mark_needs_followup' | 'mark_reviewed') => {
    if (!selectedVideo) return;
    try {
      setSavingAction(action);
      const res = await fetchJson(`/video-review/mobile/coach/attachments/${selectedVideo.id}/feedback`, {
        method: 'POST',
        auth: true,
        body: {
          coach_feedback: feedback,
          coach_private_notes: privateNotes,
          review_tags: selectedTags,
          video_angle: videoAngle,
          action,
        } as any,
      });
      const payload = res.json || {};
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Could not save review (${res.status})`);
      }
      Keyboard.dismiss();
      const updated = payload.video as SetVideoSummary;
      setSelectedVideo(updated);
      setFeedback(updated.coach_feedback || '');
      setPrivateNotes(updated.coach_private_notes || '');
      setSelectedTags(normalizeReviewTagSlugs(updated.review_tags));
      setVideoAngle(updated.video_angle || 'unknown');
      setVideos((prev) => {
        if (updated.review_status === 'reviewed') {
          return prev.filter((item) => item.id !== updated.id);
        }
        return prev.map((item) => (item.id === updated.id ? updated : item));
      });
    } catch (err: any) {
      setError(err?.message || 'Could not save review.');
    } finally {
      setSavingAction(null);
    }
  }, [feedback, privateNotes, selectedTags, selectedVideo, videoAngle]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedVideo) return false;
    const originalFeedback = selectedVideo.coach_feedback || '';
    const originalPrivateNotes = selectedVideo.coach_private_notes || '';
    const originalTags = normalizeReviewTagSlugs(selectedVideo.review_tags);
    const originalAngle = selectedVideo.video_angle || 'unknown';
    const tagKey = [...selectedTags].sort().join(',');
    const originalTagKey = [...originalTags].sort().join(',');
    return (
      feedback !== originalFeedback ||
      privateNotes !== originalPrivateNotes ||
      tagKey !== originalTagKey ||
      videoAngle !== originalAngle
    );
  }, [feedback, privateNotes, selectedTags, selectedVideo, videoAngle]);

  const reviewPanel = selectedVideo ? (
    <View style={styles.reviewPanelStack}>
      <View style={styles.reviewField}>
        <ThemedText style={styles.reviewLabel}>Athlete Feedback</ThemedText>
        <TextInput
          style={styles.feedbackInput}
          value={feedback}
          onChangeText={setFeedback}
          placeholder="Leave a quick coaching cue..."
          placeholderTextColor={SLColors.textSubtle}
          multiline
        />
      </View>

      <View style={styles.privateNotesSection}>
        <TouchableOpacity
          style={styles.privateNotesToggle}
          activeOpacity={0.82}
          onPress={() => setPrivateNotesOpen((value) => !value)}
        >
          <View>
            <ThemedText style={styles.privateNotesTitle}>Private Coach Notes</ThemedText>
            <ThemedText style={styles.privateNotesHelp}>Only visible to you.</ThemedText>
          </View>
          <ThemedText style={styles.privateNotesChevron}>{privateNotesOpen ? '−' : '+'}</ThemedText>
        </TouchableOpacity>
        {privateNotesOpen ? (
          <TextInput
            style={[styles.feedbackInput, styles.privateNotesInput]}
            value={privateNotes}
            onChangeText={setPrivateNotes}
            placeholder="Private programming thoughts..."
            placeholderTextColor={SLColors.textSubtle}
            multiline
          />
        ) : null}
      </View>

      <View style={styles.reviewField}>
        <ThemedText style={styles.reviewLabel}>Review Tags</ThemedText>
        <View style={styles.chipWrap}>
          {REVIEW_TAG_OPTIONS.map(([slug, label]) => {
            const active = selectedTags.includes(slug);
            return (
              <TouchableOpacity
                key={slug}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleTag(slug)}
              >
                <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                  {label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.reviewField}>
        <ThemedText style={styles.reviewLabel}>Video Angle</ThemedText>
        <View style={styles.chipWrap}>
          {VIDEO_ANGLE_OPTIONS.map(([slug, label]) => {
            const active = videoAngle === slug;
            return (
              <TouchableOpacity
                key={slug}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setVideoAngle(slug)}
              >
                <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                  {label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.reviewActions}>
        <TouchableOpacity
          style={[styles.reviewButton, styles.reviewButtonSecondary]}
          disabled={!!savingAction}
          onPress={() => saveReview('save')}
        >
          <ThemedText style={styles.reviewButtonText}>
            {savingAction === 'save' ? 'Saving...' : 'Save'}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reviewButton, styles.reviewButtonWarning]}
          disabled={!!savingAction}
          onPress={() => saveReview('mark_needs_followup')}
        >
          <ThemedText style={styles.reviewButtonText}>
            {savingAction === 'mark_needs_followup' ? 'Saving...' : 'Needs Follow-Up'}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.reviewButton}
          disabled={!!savingAction}
          onPress={() => saveReview('mark_reviewed')}
        >
          <ThemedText style={styles.reviewButtonText}>
            {savingAction === 'mark_reviewed' ? 'Saving...' : 'Mark Reviewed'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <ThemedView style={styles.screen}>
      {loading && !videos.length ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={SLColors.accentViolet} />
        </View>
      ) : (
        <RefreshScreen
          style={styles.scroll}
          refreshing={refreshing}
          onRefresh={() => loadInbox({ silent: true })}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <View>
              <ThemedText style={styles.kicker}>Coach Review</ThemedText>
              <ThemedText style={styles.title}>Set Videos</ThemedText>
              <ThemedText style={styles.subtitle}>
                {videos.length} active review{videos.length === 1 ? '' : 's'} · {pendingCount} pending
              </ThemedText>
            </View>
            <TouchableOpacity
              style={styles.headerIcon}
              activeOpacity={0.84}
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open video review menu"
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={SLColors.accentViolet} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.archiveActionCard}
            activeOpacity={0.86}
            onPress={() => router.push('/(tabs)/coach-video-archive' as any)}
          >
            <View style={styles.archiveActionIcon}>
              <Ionicons name="albums-outline" size={19} color={SLColors.accentViolet} />
            </View>
            <View style={styles.archiveActionCopy}>
              <ThemedText style={styles.archiveActionTitle}>Video Archive</ThemedText>
              <ThemedText style={styles.archiveActionBody}>Search roster video history</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={17} color={SLColors.textMuted} />
          </TouchableOpacity>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <View style={styles.list}>
            {videos.length > 0 ? (
              videos.map((video) => {
                const context = video.context || {};
                const movement = simplifyMobileMovementName(context.movement_name || context.lift_name) || 'Movement';
                const setLabel = context.set_display_label || context.set_context_label || (context.set_index != null ? `Set ${context.set_index}` : 'Set');
                const planned = context.prescription_label || 'No planned snapshot';
                const logged = compactActual(video) || 'No logged actuals';
                return (
                  <TouchableOpacity
                    key={video.id}
                    style={styles.card}
                    activeOpacity={0.86}
                    onPress={() => setSelectedVideo(video)}
                  >
                    <View style={styles.cardContentRow}>
                      <View style={styles.thumbWrap}>
                        {video.thumbnail_url ? (
                          <Image source={{ uri: video.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
                        ) : (
                          <View style={styles.thumbnailPlaceholder}>
                            <Ionicons name="play" size={18} color={SLColors.success} />
                          </View>
                        )}
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                          <View style={styles.cardTitleBlock}>
                            <ThemedText style={styles.cardTitle} numberOfLines={1}>{movement} · {setLabel}</ThemedText>
                            <ThemedText typographyRole="caption" style={styles.cardMeta} numberOfLines={1}>
                              {context.athlete_name || 'Athlete'} · {formatDate(context.session_date)}
                            </ThemedText>
                          </View>
                          <View style={styles.statusPill}>
                            <ThemedText style={styles.statusText}>{statusLabel(video.review_status)}</ThemedText>
                          </View>
                        </View>
                        <View style={styles.detailRows}>
                          <ThemedText style={styles.detailLine} numberOfLines={1}>
                            <ThemedText style={styles.detailLabel}>Plan: </ThemedText>
                            {planned}
                          </ThemedText>
                          <ThemedText style={styles.detailLine} numberOfLines={1}>
                            <ThemedText style={styles.detailLabel}>Log: </ThemedText>
                            {logged}
                          </ThemedText>
                          {video.video_angle_label ? (
                            <ThemedText style={styles.detailLine} numberOfLines={1}>
                              <ThemedText style={styles.detailLabel}>Angle: </ThemedText>
                              {video.video_angle_label}
                            </ThemedText>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <ThemedText style={styles.emptyTitle}>No set videos waiting</ThemedText>
                <ThemedText style={styles.emptyBody}>
                  Submitted athlete videos will show here when they need review.
                </ThemedText>
              </View>
            )}
          </View>
        </RefreshScreen>
      )}

      <SetVideoPlayerModal
        visible={!!selectedVideo}
        videoId={selectedVideo?.id ?? null}
        initialVideo={selectedVideo}
        initialUrl={selectedVideo?.url || null}
        refreshPath={selectedVideo ? `/video-review/mobile/coach/attachments/${selectedVideo.id}` : null}
        showPlaybackSpeedControls
        reviewPanel={reviewPanel}
        hasUnsavedChanges={hasUnsavedChanges}
        onClose={() => {
          setSelectedVideo(null);
          loadInbox({ silent: true });
        }}
      />

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.82}
              onPress={() => setMenuOpen(false)}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="list-outline" size={18} color={SLColors.success} />
              </View>
              <View style={styles.menuCopy}>
                <ThemedText style={styles.menuTitle}>Review Queue</ThemedText>
                <ThemedText style={styles.menuBody}>Pending and follow-up submissions</ThemedText>
              </View>
              <Ionicons name="checkmark" size={17} color={SLColors.success} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.82}
              onPress={() => {
                setMenuOpen(false);
                router.push('/(tabs)/coach-video-archive' as any);
              }}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="albums-outline" size={18} color={SLColors.accentViolet} />
              </View>
              <View style={styles.menuCopy}>
                <ThemedText style={styles.menuTitle}>Video Archive</ThemedText>
                <ThemedText style={styles.menuBody}>Search roster video history</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={17} color={SLColors.textMuted} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
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
  kicker: {
    color: SLColors.success,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: SLColors.textStrong,
    fontSize: SLTypography.hero.fontSize,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.24)',
    backgroundColor: 'rgba(91,79,207,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveActionCard: {
    minHeight: 58,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.2)',
    backgroundColor: 'rgba(91,79,207,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  archiveActionIcon: {
    width: 36,
    height: 36,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.22)',
    backgroundColor: 'rgba(15,23,42,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  archiveActionTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  archiveActionBody: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.38)',
    paddingTop: 84,
    paddingHorizontal: 14,
    alignItems: 'flex-end',
  },
  menuCard: {
    width: 286,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.16)',
    backgroundColor: 'rgba(8,12,22,0.96)',
    padding: 8,
    gap: 4,
    ...SLShadows.shadowSheet,
  },
  menuItem: {
    minHeight: 58,
    borderRadius: SLRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(15,23,42,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  menuBody: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  errorText: {
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  card: {
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(15,23,42,0.78)',
    padding: 8,
  },
  cardContentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  thumbWrap: {
    width: 76,
    height: 102,
    borderRadius: SLRadius.md,
    overflow: 'hidden',
    backgroundColor: SLColors.background,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.72)',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
  },
  cardMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.28)',
    backgroundColor: 'rgba(91,79,207,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusText: {
    color: SLColors.review,
    fontSize: 10,
    fontWeight: '900',
  },
  detailRows: {
    marginTop: 12,
    gap: 5,
  },
  detailLine: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  detailLabel: {
    color: SLColors.success,
    fontWeight: '900',
  },
  emptyCard: {
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.62)',
    padding: 18,
  },
  emptyTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
  },
  emptyBody: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  reviewPanelStack: {
    gap: 12,
  },
  reviewField: {
    gap: 7,
  },
  reviewLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  feedbackInput: {
    minHeight: 88,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,23,42,0.82)',
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  privateNotesSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.12)',
    paddingTop: 10,
    gap: 8,
  },
  privateNotesToggle: {
    minHeight: 42,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.48)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  privateNotesTitle: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  privateNotesHelp: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  privateNotesChevron: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
  },
  privateNotesInput: {
    minHeight: 76,
    backgroundColor: 'rgba(15,23,42,0.58)',
    borderColor: 'rgba(148,163,184,0.14)',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 30,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,23,42,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  chipActive: {
    borderColor: 'rgba(196,181,253,0.46)',
    backgroundColor: 'rgba(91,79,207,0.34)',
  },
  chipText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  chipTextActive: {
    color: SLColors.textStrong,
  },
  reviewActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewButton: {
    minHeight: 36,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.36)',
    backgroundColor: SLColors.railViolet,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reviewButtonSecondary: {
    backgroundColor: 'rgba(15,23,42,0.82)',
  },
  reviewButtonWarning: {
    borderColor: 'rgba(251,191,36,0.34)',
    backgroundColor: 'rgba(180,83,9,0.26)',
  },
  reviewButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
});
