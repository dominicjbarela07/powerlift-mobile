import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import RefreshScreen from '@/components/refresh-screen';
import { NewCoachExperience, type NewCoachExperiencePayload } from '@/components/NewCoachExperience';
import SetVideoPlayerModal, { type SetVideoSummary } from '@/components/SetVideoPlayerModal';
import { SLErrorState, SLStatusPill } from '@/components/ui';
import { ThemedView } from '@/components/themed-view';
import { fetchJson, getCoachVideoReviewInbox } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { SLColors, SLRadius, SLSpacing, SLTypography, type SLStatusTone } from '@/constants/theme';

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
  if (value === 'not_requested' || value === 'archive_only') return 'Saved';
  if (value === 'reviewed') return 'Reviewed';
  if (value === 'needs_followup') return 'Follow-up';
  if (value === 'viewed') return 'Viewed';
  return 'Pending';
}

function statusTone(value?: string | null): SLStatusTone {
  if (value === 'needs_followup') return 'warning';
  if (value === 'pending') return 'review';
  if (value === 'viewed') return 'info';
  if (value === 'reviewed') return 'success';
  return 'neutral';
}

function priorityRank(video: SetVideoSummary) {
  if (video.review_status === 'needs_followup') return 0;
  if (video.review_status === 'pending') return 1;
  if (video.review_status === 'viewed') return 2;
  if (video.review_status === 'reviewed') return 3;
  return 4;
}

function formatDate(value?: string | null) {
  if (!value) return 'Date unknown';
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: raw.includes('T') ? 'numeric' : undefined,
    minute: raw.includes('T') ? '2-digit' : undefined,
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

function videoSubmittedAt(video: SetVideoSummary) {
  return video.created_at || video.reviewed_at || video.context?.session_date || null;
}

export default function CoachVideosQueueScreen() {
  const router = useRouter();
  const [videos, setVideos] = useState<SetVideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCoachExperience, setNewCoachExperience] = useState<NewCoachExperiencePayload | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<SetVideoSummary | null>(null);
  const [feedback, setFeedback] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [privateNotesOpen, setPrivateNotesOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [videoAngle, setVideoAngle] = useState('unknown');
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [focusCues, setFocusCues] = useState(['', '', '']);
  const [savingFocus, setSavingFocus] = useState(false);

  const loadQueue = useCallback(async (opts?: { silent?: boolean; showRefreshIndicator?: boolean }) => {
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
        throw new Error(payload.error || `Could not load videos (${res.status})`);
      }
      setVideos(Array.isArray(payload.videos) ? payload.videos : []);
      setNewCoachExperience(payload.new_coach_experience || null);
    } catch (err: any) {
      setVideos([]);
      setNewCoachExperience(null);
      setError(err?.message || 'Could not load videos.');
    } finally {
      if (silent) setRefreshing(false);
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadQueue({ silent: true, showRefreshIndicator: false });
    }, [loadQueue]),
  );

  useEffect(() => {
    if (!selectedVideo) return;
    setFeedback(selectedVideo.coach_feedback || '');
    setPrivateNotes(selectedVideo.coach_private_notes || '');
    setPrivateNotesOpen(false);
    setSelectedTags(normalizeReviewTagSlugs(selectedVideo.review_tags));
    setVideoAngle(selectedVideo.video_angle || 'unknown');
    setSavingAction(null);
    setSavingFocus(false);
    const nextFocusCues = (selectedVideo.coaching_focus?.cues || [])
      .slice(0, 3)
      .map((cue) => String(cue?.text || ''));
    setFocusCues([nextFocusCues[0] || '', nextFocusCues[1] || '', nextFocusCues[2] || '']);
  }, [selectedVideo?.id]);

  const orderedVideos = useMemo(() => {
    return [...videos].sort((a, b) => {
      const rankDelta = priorityRank(a) - priorityRank(b);
      if (rankDelta) return rankDelta;
      const aTime = new Date(videoSubmittedAt(a) || 0).getTime() || 0;
      const bTime = new Date(videoSubmittedAt(b) || 0).getTime() || 0;
      return bTime - aTime;
    });
  }, [videos]);

  const counts = useMemo(() => {
    const followUp = videos.filter((video) => video.review_status === 'needs_followup').length;
    const pending = videos.filter((video) => video.review_status === 'pending').length;
    return { followUp, pending, total: videos.length };
  }, [videos]);

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

  const updateFocusCue = useCallback((idx: number, value: string) => {
    setFocusCues((prev) => prev.map((cue, cueIdx) => (cueIdx === idx ? value : cue)));
  }, []);

  const saveCoachingFocus = useCallback(async () => {
    if (!selectedVideo?.coaching_focus?.available || !selectedVideo.coaching_focus.lift) return;
    try {
      setSavingFocus(true);
      const cues = focusCues.map((cue) => cue.trim()).filter(Boolean);
      const res = await fetchJson(`/video-review/mobile/coach/attachments/${selectedVideo.id}/coaching-focus`, {
        method: 'POST',
        auth: true,
        body: {
          lift: selectedVideo.coaching_focus.lift,
          cues,
        } as any,
      });
      const payload = res.json || {};
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Could not save coaching focus (${res.status})`);
      }
      Keyboard.dismiss();
      const updated = payload.video as SetVideoSummary;
      setSelectedVideo(updated);
      const updatedFocusCues = (updated.coaching_focus?.cues || [])
        .slice(0, 3)
        .map((cue) => String(cue?.text || ''));
      setFocusCues([updatedFocusCues[0] || '', updatedFocusCues[1] || '', updatedFocusCues[2] || '']);
      setVideos((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err: any) {
      setError(err?.message || 'Could not save coaching focus.');
    } finally {
      setSavingFocus(false);
    }
  }, [focusCues, selectedVideo]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedVideo) return false;
    const tagKey = [...selectedTags].sort().join(',');
    const originalTagKey = [...normalizeReviewTagSlugs(selectedVideo.review_tags)].sort().join(',');
    return (
      feedback !== (selectedVideo.coach_feedback || '') ||
      privateNotes !== (selectedVideo.coach_private_notes || '') ||
      tagKey !== originalTagKey ||
      videoAngle !== (selectedVideo.video_angle || 'unknown')
    );
  }, [feedback, privateNotes, selectedTags, selectedVideo, videoAngle]);

  const reviewPanel = selectedVideo ? (
    <View style={styles.reviewPanelStack}>
      <View style={styles.reviewField}>
        <Text style={styles.reviewLabel}>Athlete Feedback</Text>
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
            <Text style={styles.privateNotesTitle}>Private Notes</Text>
            <Text style={styles.privateNotesHelp}>Only visible to you.</Text>
          </View>
          <Text style={styles.privateNotesChevron}>{privateNotesOpen ? '−' : '+'}</Text>
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
        <Text style={styles.reviewLabel}>Tags</Text>
        <View style={styles.chipWrap}>
          {REVIEW_TAG_OPTIONS.map(([slug, label]) => {
            const active = selectedTags.includes(slug);
            return (
              <TouchableOpacity
                key={slug}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.82}
                onPress={() => toggleTag(slug)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.reviewField}>
        <Text style={styles.reviewLabel}>Angle</Text>
        <View style={styles.chipWrap}>
          {VIDEO_ANGLE_OPTIONS.map(([slug, label]) => {
            const active = videoAngle === slug;
            return (
              <TouchableOpacity
                key={slug}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.82}
                onPress={() => setVideoAngle(slug)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectedVideo.coaching_focus?.available ? (
        <View style={styles.focusPanel}>
          <View style={styles.focusHeader}>
            <Text style={styles.focusTitle}>{selectedVideo.coaching_focus.label || 'Lift'} Focus</Text>
            <Text style={styles.focusHelp}>
              Update the cues this athlete should carry into future {(selectedVideo.coaching_focus.label || 'lift').toLowerCase()} work.
            </Text>
          </View>
          <View style={styles.focusInputs}>
            {[0, 1, 2].map((idx) => (
              <TextInput
                key={idx}
                style={styles.focusInput}
                value={focusCues[idx]}
                onChangeText={(value) => updateFocusCue(idx, value)}
                placeholder={`Cue ${idx + 1}`}
                placeholderTextColor={SLColors.textSubtle}
                maxLength={240}
              />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.reviewButton, styles.focusSaveButton]}
            disabled={savingFocus}
            activeOpacity={0.84}
            onPress={saveCoachingFocus}
          >
            <Text style={styles.reviewButtonText}>{savingFocus ? 'Saving...' : `Save ${selectedVideo.coaching_focus.label || 'Lift'} Focus`}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.reviewActions}>
        <TouchableOpacity
          style={[styles.reviewButton, styles.reviewButtonSecondary]}
          disabled={!!savingAction}
          activeOpacity={0.84}
          onPress={() => saveReview('save')}
        >
          <Text style={styles.reviewButtonText}>{savingAction === 'save' ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reviewButton, styles.reviewButtonWarning]}
          disabled={!!savingAction}
          activeOpacity={0.84}
          onPress={() => saveReview('mark_needs_followup')}
        >
          <Text style={styles.reviewButtonText}>
            {savingAction === 'mark_needs_followup' ? 'Saving...' : 'Follow-Up'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.reviewButton}
          disabled={!!savingAction}
          activeOpacity={0.84}
          onPress={() => saveReview('mark_reviewed')}
        >
          <Text style={styles.reviewButtonText}>
            {savingAction === 'mark_reviewed' ? 'Saving...' : 'Reviewed'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <ThemedView style={styles.screen}>
      {loading && !videos.length ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={SLColors.review} />
        </View>
      ) : (
        <RefreshScreen
          style={styles.scroll}
          refreshing={refreshing}
          onRefresh={() => loadQueue({ silent: true })}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Videos</Text>
              <Text style={styles.countLine}>
                {counts.total} active · {counts.followUp} follow-up · {counts.pending} pending
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.archiveButton, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/coach-video-archive' as any)}
            >
              <Ionicons name="albums-outline" size={17} color={SLColors.review} />
              <Text style={styles.archiveButtonText}>Archive</Text>
            </Pressable>
          </View>

          {error ? (
            <SLErrorState
              title="Could not load videos"
              message={error}
              actionLabel="Retry"
              onActionPress={() => loadQueue()}
              style={styles.stateCard}
            />
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Review Queue</Text>
          </View>

          <View style={styles.queueList}>
            {orderedVideos.length ? (
              orderedVideos.map((video, index) => (
                <VideoQueueRow
                  key={video.id}
                  video={video}
                  topPriority={index === 0}
                  onPress={() => setSelectedVideo(video)}
                />
              ))
            ) : newCoachExperience ? (
              <NewCoachExperience experience={newCoachExperience} />
            ) : (
              <View style={styles.inlineEmpty}>
                <Ionicons name="checkmark-circle-outline" size={18} color={SLColors.success} />
                <Text style={styles.inlineEmptyText}>No videos waiting</Text>
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
          loadQueue({ silent: true });
        }}
      />
    </ThemedView>
  );
}

function VideoQueueRow({
  video,
  topPriority,
  onPress,
}: {
  video: SetVideoSummary;
  topPriority: boolean;
  onPress: () => void;
}) {
  const context = video.context || {};
  const movement = simplifyMobileMovementName(context.movement_name || context.lift_name) || 'Movement';
  const setLabel = context.set_display_label || context.set_context_label || (context.set_index != null ? `Set ${context.set_index}` : 'Set');
  const plan = context.prescription_label || 'No planned snapshot';
  const log = compactActual(video) || 'No logged actuals';
  const athlete = context.athlete_name || 'Athlete';
  const dateLine = formatDate(videoSubmittedAt(video));

  return (
    <Pressable
      style={({ pressed }) => [
        styles.videoRow,
        topPriority && styles.videoRowPriority,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.thumbWrap}>
        {video.thumbnail_url ? (
          <Image source={{ uri: video.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="play" size={18} color={SLColors.success} />
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {movement} · {setLabel}
          </Text>
          <SLStatusPill label={statusLabel(video.review_status)} tone={statusTone(video.review_status)} />
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {athlete} · {dateLine}
        </Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          <Text style={styles.rowDetailLabel}>Plan: </Text>
          {plan}
        </Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          <Text style={styles.rowDetailLabel}>Log: </Text>
          {log}
        </Text>
        <View style={styles.rowFooter}>
          <Text style={styles.rowFooterText} numberOfLines={1}>
            {video.video_angle_label || 'Unknown Angle'}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={SLColors.textSubtle} />
        </View>
      </View>
    </Pressable>
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
    gap: SLSpacing.md,
    paddingBottom: 104,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.md,
    justifyContent: 'space-between',
    paddingTop: SLSpacing.sm,
    paddingBottom: SLSpacing.xs,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: SLColors.textStrong,
    fontSize: SLTypography.hero.fontSize,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 32,
  },
  countLine: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  archiveButton: {
    alignItems: 'center',
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 11,
    backgroundColor: SLColors.surfaceEmbedded,
  },
  archiveButtonText: {
    color: SLColors.review,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: SLSpacing.xs,
  },
  sectionTitle: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  queueList: {
    borderTopWidth: 1,
    borderTopColor: SLColors.borderHairline,
  },
  videoRow: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderBottomColor: SLColors.borderHairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 9,
    paddingRight: 4,
  },
  videoRowPriority: {
    backgroundColor: SLColors.accentVioletSoft,
    borderLeftColor: SLColors.borderSelected,
  },
  pressed: {
    opacity: 0.78,
  },
  thumbWrap: {
    backgroundColor: SLColors.surfaceInset,
    borderRadius: SLRadius.sm,
    height: 94,
    overflow: 'hidden',
    width: 70,
  },
  thumbnail: {
    height: '100%',
    width: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceMuted,
    flex: 1,
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  rowTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
  },
  rowTitle: {
    color: SLColors.textStrong,
    flex: 1,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
    minWidth: 0,
  },
  rowMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '600',
  },
  rowDetail: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '600',
  },
  rowDetailLabel: {
    color: SLColors.textMuted,
    fontWeight: '700',
  },
  rowFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 1,
  },
  rowFooterText: {
    color: SLColors.textSubtle,
    flex: 1,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  inlineEmpty: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.borderHairline,
    paddingVertical: 11,
  },
  inlineEmptyText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
  },
  stateCard: {
    marginTop: SLSpacing.xs,
  },
  reviewPanelStack: {
    gap: 14,
  },
  reviewField: {
    gap: 8,
  },
  reviewLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  feedbackInput: {
    minHeight: 92,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surfaceInset,
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 11,
    textAlignVertical: 'top',
  },
  privateNotesSection: {
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.border,
    backgroundColor: SLColors.surfaceEmbedded,
    overflow: 'hidden',
  },
  privateNotesToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  privateNotesTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  privateNotesHelp: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  privateNotesChevron: {
    color: SLColors.review,
    fontSize: SLTypography.title.fontSize,
    fontWeight: '900',
  },
  privateNotesInput: {
    borderWidth: 0,
    borderTopWidth: 1,
    borderTopColor: SLColors.border,
    borderRadius: 0,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surfaceInset,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: {
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.accentVioletSoft,
  },
  chipText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  chipTextActive: {
    color: SLColors.review,
  },
  focusPanel: {
    gap: 11,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surfaceEmbedded,
    paddingVertical: 13,
  },
  focusHeader: {
    gap: 3,
  },
  focusTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  focusHelp: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '600',
    lineHeight: 15,
  },
  focusInputs: {
    gap: 8,
  },
  focusInput: {
    minHeight: 40,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.border,
    backgroundColor: SLColors.surfaceInset,
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  focusSaveButton: {
    flex: 0,
    backgroundColor: SLColors.reviewSoft,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewButton: {
    alignItems: 'center',
    backgroundColor: SLColors.reviewSoft,
    borderRadius: SLRadius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  reviewButtonSecondary: {
    backgroundColor: SLColors.surfaceMuted,
  },
  reviewButtonWarning: {
    backgroundColor: SLColors.warningSoft,
  },
  reviewButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
});
