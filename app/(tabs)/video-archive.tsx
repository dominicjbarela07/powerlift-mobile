import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import SetVideoPlayerModal, { type SetVideoReviewTag, type SetVideoSummary } from '@/components/SetVideoPlayerModal';
import { ThemedView } from '@/components/themed-view';
import { getAthleteVideoArchive } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { formatWeightFromKg, normalizeDisplayWeightUnit } from '@/lib/display-units';

const palette = {
  bg: SLColors.background,
  panel: SLColors.surface,
  panelSoft: SLColors.surfaceRaised,
  border: SLColors.borderSubtle,
  text: SLColors.textStrong,
  muted: SLColors.textMuted,
  green: SLColors.success,
  violet: SLColors.accentViolet,
  amber: SLColors.warning,
  red: SLColors.danger,
};

type ArchiveVideo = SetVideoSummary & {
  review_tags?: SetVideoReviewTag[] | null;
};

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'not_requested', label: 'Saved' },
  { value: 'pending', label: 'Pending' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'needs_followup', label: 'Follow-up' },
];

const angleOptions = [
  { value: '', label: 'Any angle' },
  { value: 'unknown', label: 'Unknown Angle' },
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'front_diagonal', label: 'Front diagonal' },
  { value: 'rear_diagonal', label: 'Rear diagonal' },
  { value: 'rear', label: 'Rear' },
  { value: 'other', label: 'Other' },
];

const liftOptions = [
  { value: '', label: 'All' },
  { value: 'squat', label: 'Squat' },
  { value: 'bench', label: 'Bench' },
  { value: 'deadlift', label: 'Deadlift' },
  { value: 'accessories', label: 'Accessories' },
];

const setTypeOptions = [
  { value: '', label: 'All set types' },
  { value: 'top', label: 'Top set' },
  { value: 'backdown', label: 'Backdown' },
  { value: 'straight', label: 'Straight' },
  { value: 'full_custom', label: 'FC' },
];

function formatDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function statusLabel(value?: string | null) {
  if (value === 'not_requested' || value === 'archive_only') return 'Saved to Archive';
  if (value === 'reviewed') return 'Reviewed';
  if (value === 'needs_followup') return 'Needs follow-up';
  if (value === 'viewed') return 'Viewed';
  return 'Pending review';
}

function compactActual(video: ArchiveVideo, preferredUnits?: string | null) {
  const context = video.context;
  if (!context) return null;
  const load = context.actual_weight_kg != null
    ? formatWeightFromKg(context.actual_weight_kg, normalizeDisplayWeightUnit(preferredUnits))
    : context.actual_weight_label;
  const reps = context.actual_reps != null ? String(context.actual_reps) : null;
  const rpe = context.actual_rpe != null ? String(context.actual_rpe) : null;
  if (!load && !reps && !rpe) return null;
  let line = load || 'Load ?';
  if (reps) line += ` x ${reps}`;
  if (rpe) line += ` @ RPE ${rpe}`;
  return line;
}

function feedbackPreview(value?: string | null) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 80 ? `${text.slice(0, 77).trim()}...` : text;
}

function studyCategory(video: ArchiveVideo) {
  const lift = String(video.context?.lift_name || video.context?.movement_name || '').toLowerCase();
  const rawLift = String((video as any).lift || '').toUpperCase();
  if (rawLift === 'SQ' || lift.includes('squat')) return 'squat';
  if (rawLift === 'BN' || lift.includes('bench')) return 'bench';
  if (rawLift === 'DL' || lift.includes('deadlift')) return 'deadlift';
  return 'accessories';
}

function roomLabel(value: string) {
  return liftOptions.find((option) => option.value === value)?.label || 'All';
}

function reviewTimestamp(video: ArchiveVideo) {
  const value = video.reviewed_at || video.created_at || video.context?.session_date || null;
  if (!value) return 0;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function AthleteVideoArchiveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ lift?: string }>();
  const initialLift = typeof params.lift === 'string' ? params.lift : '';
  const [videos, setVideos] = useState<ArchiveVideo[]>([]);
  const [allVideos, setAllVideos] = useState<ArchiveVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movement, setMovement] = useState('');
  const [lift, setLift] = useState(initialLift);
  const [reviewStatus, setReviewStatus] = useState('');
  const [videoAngle, setVideoAngle] = useState('');
  const [setType, setSetType] = useState('');
  const [needsFollowupOnly, setNeedsFollowupOnly] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftReviewStatus, setDraftReviewStatus] = useState('');
  const [draftVideoAngle, setDraftVideoAngle] = useState('');
  const [draftSetType, setDraftSetType] = useState('');
  const [draftNeedsFollowupOnly, setDraftNeedsFollowupOnly] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ArchiveVideo | null>(null);

  const loadArchive = useCallback(async (opts?: {
    silent?: boolean;
    showRefreshIndicator?: boolean;
    filters?: {
      movement?: string;
      lift?: string;
      reviewStatus?: string;
      videoAngle?: string;
      setType?: string;
      needsFollowupOnly?: boolean;
    };
  }) => {
    const silent = !!opts?.silent;
    const nextMovement = opts?.filters?.movement ?? movement;
    const nextLift = opts?.filters?.lift ?? lift;
    const nextReviewStatus = opts?.filters?.reviewStatus ?? reviewStatus;
    const nextVideoAngle = opts?.filters?.videoAngle ?? videoAngle;
    const nextSetType = opts?.filters?.setType ?? setType;
    const nextNeedsFollowupOnly = opts?.filters?.needsFollowupOnly ?? needsFollowupOnly;
    try {
      if (silent && opts?.showRefreshIndicator !== false) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const requestLift = nextLift === 'accessories' ? '' : nextLift;
      const res = await getAthleteVideoArchive({
        movement: nextMovement,
        lift: requestLift,
        review_status: nextNeedsFollowupOnly ? 'needs_followup' : nextReviewStatus,
        video_angle: nextVideoAngle,
        set_type: nextSetType,
        needs_followup: nextNeedsFollowupOnly ? 'yes' : '',
      });
      const payload = res.json || {};
      if (!res.ok || !payload.ok) {
        if (res.status === 401) router.replace('/login');
        throw new Error(payload.error || `Could not load video archive (${res.status})`);
      }
      const loadedVideos = Array.isArray(payload.videos) ? payload.videos : [];
      setVideos(nextLift === 'accessories'
        ? loadedVideos.filter((video: ArchiveVideo) => studyCategory(video) === 'accessories')
        : loadedVideos);
    } catch (err: any) {
      setVideos([]);
      setError(err?.message || 'Could not load video archive.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [lift, movement, needsFollowupOnly, reviewStatus, router, setType, videoAngle]);

  const loadFilmRoomSource = useCallback(async () => {
    const res = await getAthleteVideoArchive();
    const payload = res.json || {};
    if (res.ok && payload.ok && Array.isArray(payload.videos)) {
      setAllVideos(payload.videos);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const routeLift = typeof params.lift === 'string' ? params.lift : '';
      if (routeLift && routeLift !== lift) {
        setLift(routeLift);
        loadArchive({ silent: true, showRefreshIndicator: false, filters: { lift: routeLift } });
        loadFilmRoomSource();
        return;
      }
      loadArchive({ silent: true, showRefreshIndicator: false });
      loadFilmRoomSource();
    }, [lift, loadArchive, loadFilmRoomSource, params.lift]),
  );

  const movementRooms = useMemo(() => {
    const rooms = new Map<string, { count: number; latest?: ArchiveVideo }>();
    allVideos.forEach((video) => {
      const key = studyCategory(video);
      const current = rooms.get(key) || { count: 0, latest: undefined };
      const latest = !current.latest || reviewTimestamp(video) > reviewTimestamp(current.latest) ? video : current.latest;
      rooms.set(key, { count: current.count + 1, latest });
    });
    return ['squat', 'bench', 'deadlift', 'accessories']
      .filter((key) => (rooms.get(key)?.count || 0) > 0)
      .map((key) => ({
        key,
        label: roomLabel(key),
        count: rooms.get(key)?.count || 0,
        latest: rooms.get(key)?.latest,
        active: lift === key,
      }));
  }, [allVideos, lift]);
  const selectedRoom = useMemo(
    () => movementRooms.find((room) => room.key === lift) || (movementRooms.length === 1 ? movementRooms[0] : null),
    [lift, movementRooms],
  );
  const signalSourceVideos = useMemo(
    () => selectedRoom
      ? allVideos.filter((video) => studyCategory(video) === selectedRoom.key)
      : allVideos,
    [allVideos, selectedRoom],
  );
  const latestSignals = useMemo(
    () => signalSourceVideos
      .filter((video) => video.review_status === 'needs_followup' || video.review_status === 'reviewed' || !!feedbackPreview(video.coach_feedback))
      .sort((a, b) => reviewTimestamp(b) - reviewTimestamp(a))
      .slice(0, 2),
    [signalSourceVideos],
  );
  const activeFilterCount = useMemo(
    () => [reviewStatus, videoAngle, setType, needsFollowupOnly ? 'needs_followup' : ''].filter(Boolean).length,
    [needsFollowupOnly, reviewStatus, setType, videoAngle],
  );
  const filterSummary = useMemo(() => {
    const parts = [
      needsFollowupOnly
        ? 'Needs follow-up'
        : statusOptions.find((option) => option.value === reviewStatus)?.value
          ? statusOptions.find((option) => option.value === reviewStatus)?.label
          : null,
      angleOptions.find((option) => option.value === videoAngle)?.value
        ? angleOptions.find((option) => option.value === videoAngle)?.label
        : null,
      setTypeOptions.find((option) => option.value === setType)?.value
        ? setTypeOptions.find((option) => option.value === setType)?.label
        : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'No secondary filters';
  }, [needsFollowupOnly, reviewStatus, setType, videoAngle]);

  const openFilters = useCallback(() => {
    setDraftReviewStatus(reviewStatus);
    setDraftVideoAngle(videoAngle);
    setDraftSetType(setType);
    setDraftNeedsFollowupOnly(needsFollowupOnly);
    setFilterSheetOpen(true);
  }, [needsFollowupOnly, reviewStatus, setType, videoAngle]);

  const resetDraftFilters = useCallback(() => {
    setDraftReviewStatus('');
    setDraftVideoAngle('');
    setDraftSetType('');
    setDraftNeedsFollowupOnly(false);
  }, []);

  const applyFilters = useCallback(() => {
    const nextReviewStatus = draftNeedsFollowupOnly ? '' : draftReviewStatus;
    setReviewStatus(nextReviewStatus);
    setVideoAngle(draftVideoAngle);
    setSetType(draftSetType);
    setNeedsFollowupOnly(draftNeedsFollowupOnly);
    setFilterSheetOpen(false);
    loadArchive({
      silent: true,
      filters: {
        reviewStatus: nextReviewStatus,
        lift,
        videoAngle: draftVideoAngle,
        setType: draftSetType,
        needsFollowupOnly: draftNeedsFollowupOnly,
      },
    });
  }, [draftNeedsFollowupOnly, draftReviewStatus, draftSetType, draftVideoAngle, lift, loadArchive]);

  const selectStudyFilter = useCallback((nextLift: string) => {
    const resolvedLift = lift === nextLift ? '' : nextLift;
    setLift(resolvedLift);
    setReviewStatus('');
    setVideoAngle('');
    setSetType('');
    setNeedsFollowupOnly(false);
    loadArchive({ silent: true, filters: { lift: resolvedLift, reviewStatus: '', videoAngle: '', setType: '', needsFollowupOnly: false } });
  }, [lift, loadArchive]);

  const refreshFilmRoom = useCallback(() => {
    loadArchive({ silent: true });
    loadFilmRoomSource();
  }, [loadArchive, loadFilmRoomSource]);

  return (
    <ThemedView style={styles.screen}>
      {loading && !videos.length ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={palette.green} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFilmRoom} tintColor={palette.muted} />}
        >
          <View style={styles.header}>
            <View>
              <Text typographyRole="pageTitle" style={styles.title}>Film Room</Text>
              <Text typographyRole="supportingBody" style={styles.subtitle}>
                Review movement. Study feedback.
              </Text>
            </View>
          </View>

          {movementRooms.length > 1 ? (
            <View style={styles.studySection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Movement Rooms</Text>
                {lift ? (
                  <Pressable onPress={() => selectStudyFilter(lift)}>
                    <Text style={styles.sectionAction}>All film</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.roomGrid}>
                {movementRooms.map((room) => (
                  <Pressable
                    key={room.key}
                    style={({ pressed }) => [styles.roomTile, room.active && styles.roomTileActive, pressed && styles.cardPressed]}
                    onPress={() => selectStudyFilter(room.key)}
                  >
                    <Text style={[styles.roomTitle, room.active && styles.roomTitleActive]}>{room.label}</Text>
                    <Text style={styles.roomMeta}>{room.count} clip{room.count === 1 ? '' : 's'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : selectedRoom ? (
            <View style={styles.singleRoomContext}>
              <View style={styles.singleRoomCopy}>
                <Text style={styles.singleRoomTitle}>
                  Studying {selectedRoom.label} · {selectedRoom.count} clip{selectedRoom.count === 1 ? '' : 's'}
                </Text>
                <Text style={styles.singleRoomMeta} numberOfLines={1}>
                  {feedbackPreview(selectedRoom.latest?.coach_feedback) || statusLabel(selectedRoom.latest?.review_status) || 'Film ready for study'}
                </Text>
              </View>
            </View>
          ) : null}

          {latestSignals.length ? (
            <View style={styles.signalSection}>
              <Text style={styles.sectionTitle}>Latest coach signal</Text>
              <View style={styles.reviewRail}>
                {latestSignals.map((video) => {
                  const context = video.context || {};
                  const movementName = simplifyMobileMovementName(context.movement_name || context.lift_name) || 'Movement';
                  const feedback = feedbackPreview(video.coach_feedback);
                  return (
                    <Pressable
                      key={`review-${video.id}`}
                      style={({ pressed }) => [styles.reviewRow, pressed && styles.cardPressed]}
                      onPress={() => setSelectedVideo(video)}
                    >
                      <View style={styles.reviewCopy}>
                        <View style={styles.reviewTopline}>
                          <Text style={styles.reviewTitle} numberOfLines={1}>
                            {video.review_status === 'needs_followup'
                              ? `Follow-up for ${movementName.toLowerCase()}`
                              : `Coach reviewed your ${movementName.toLowerCase()}`}
                          </Text>
                          <Text style={styles.reviewDate}>{formatDate(video.reviewed_at || context.session_date)}</Text>
                        </View>
                        <Text style={styles.reviewBody} numberOfLines={1}>
                          {feedback || statusLabel(video.review_status)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.filterPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Clips</Text>
              {activeFilterCount ? <Text style={styles.sectionMeta}>{filterSummary}</Text> : null}
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={17} color={palette.muted} />
                <TextInput
                  value={movement}
                  onChangeText={setMovement}
                  onSubmitEditing={() => loadArchive({ silent: true })}
                  placeholder="Search film"
                  placeholderTextColor={SLColors.textSubtle}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
              </View>
              <Pressable style={styles.filtersButton} onPress={openFilters}>
                <Ionicons name="options-outline" size={19} color={palette.violet} />
                {activeFilterCount ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.list}>
            {videos.length ? (
              videos.map((video) => {
                const context = video.context || {};
                const movementName = simplifyMobileMovementName(context.movement_name || context.lift_name) || 'Movement';
                const setLabel = context.set_display_label || context.set_context_label || (context.set_index != null ? `Set ${context.set_index}` : 'Set');
                const isFollowup = video.review_status === 'needs_followup';
                const feedback = feedbackPreview(video.coach_feedback);
                const currentRoomKey = lift || (movementRooms.length === 1 ? movementRooms[0].key : '');
                const title = currentRoomKey && studyCategory(video) === currentRoomKey
                  ? setLabel
                  : `${movementName} · ${setLabel}`;
                const actual = compactActual(video, user?.preferred_units);
                const status = isFollowup ? 'Needs follow-up' : feedback ? 'Coach feedback' : statusLabel(video.review_status);
                return (
                  <Pressable
                    key={video.id}
                    style={({ pressed }) => [styles.card, isFollowup && styles.followupCard, pressed && styles.cardPressed]}
                    onPress={() => setSelectedVideo(video)}
                  >
                    <View style={styles.thumbWrap}>
                      {video.thumbnail_url ? (
                        <Image source={{ uri: video.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
                      ) : (
                        <View style={styles.thumbnailPlaceholder}>
                          <Ionicons name="play" size={20} color={palette.green} />
                        </View>
                      )}
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
                        <View style={[styles.statusPill, isFollowup && styles.followupPill]}>
                          <Text style={[styles.statusText, isFollowup && styles.followupStatusText]}>
                            {status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {formatDate(context.session_date)}
                        {video.video_angle_label ? ` · ${video.video_angle_label}` : ''}
                      </Text>
                      {actual ? <Text style={styles.detailLine} numberOfLines={1}>{actual}</Text> : null}
                      <View style={styles.cardFooter}>
                        {feedback ? <Text style={styles.feedbackPreviewText} numberOfLines={1}>{feedback}</Text> : <View />}
                        <Ionicons name="chevron-forward" size={16} color={palette.muted} />
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="videocam-outline" size={24} color={palette.muted} />
                <Text style={styles.emptyTitle}>No film found</Text>
                <Text style={styles.emptyBody}>Saved and submitted set videos will appear here for study.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalScrim} onPress={() => setFilterSheetOpen(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>Study Filters</Text>
                <Text style={styles.filterSheetSubtitle}>Narrow the film library.</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setFilterSheetOpen(false)}>
                <Ionicons name="close" size={18} color={palette.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.filterSheetScroll} contentContainerStyle={styles.filterSheetContent}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Review status</Text>
                <View style={styles.modalChipGrid}>
                  {statusOptions.map((option) => {
                    const active = !draftNeedsFollowupOnly && draftReviewStatus === option.value;
                    return (
                      <Pressable
                        key={option.value || 'all-statuses'}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => {
                          setDraftNeedsFollowupOnly(false);
                          setDraftReviewStatus(option.value);
                        }}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {option.value ? option.label : 'All statuses'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Video angle</Text>
                <View style={styles.modalChipGrid}>
                  {angleOptions.map((option) => {
                    const active = draftVideoAngle === option.value;
                    return (
                      <Pressable
                        key={option.value || 'any-angle'}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => setDraftVideoAngle(option.value)}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Set type</Text>
                <View style={styles.modalChipGrid}>
                  {setTypeOptions.map((option) => {
                    const active = draftSetType === option.value;
                    return (
                      <Pressable
                        key={option.value || 'all-set-types'}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => setDraftSetType(option.value)}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Priority</Text>
                <Pressable
                  style={[styles.followupToggle, draftNeedsFollowupOnly && styles.followupToggleActive]}
                  onPress={() => {
                    setDraftNeedsFollowupOnly((value) => !value);
                    if (!draftNeedsFollowupOnly) setDraftReviewStatus('');
                  }}
                >
                  <View style={[styles.followupToggleIcon, draftNeedsFollowupOnly && styles.followupToggleIconActive]}>
                    {draftNeedsFollowupOnly ? <Ionicons name="checkmark" size={14} color={SLColors.textInverted} /> : null}
                  </View>
                  <View style={styles.followupToggleTextWrap}>
                    <Text style={[styles.followupToggleTitle, draftNeedsFollowupOnly && styles.followupToggleTitleActive]}>
                      Needs follow-up only
                    </Text>
                    <Text style={styles.followupToggleBody}>Show videos your coach flagged for follow-up.</Text>
                  </View>
                </Pressable>
              </View>
            </ScrollView>
            <View style={styles.filterSheetActions}>
              <Pressable style={styles.resetButton} onPress={resetDraftFilters}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.applyFiltersButton} onPress={applyFilters}>
                <Text style={styles.applyFiltersText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SetVideoPlayerModal
        visible={!!selectedVideo}
        videoId={selectedVideo?.id ?? null}
        initialVideo={selectedVideo as SetVideoSummary | null}
        initialUrl={selectedVideo?.url || null}
        initialCoachFeedbackOpen={!!selectedVideo?.coach_feedback || selectedVideo?.review_status === 'needs_followup'}
        onClose={() => setSelectedVideo(null)}
      />
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
    paddingBottom: 110,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    color: palette.green,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    marginTop: 4,
  },
  subtitle: {
    color: palette.muted,
    marginTop: 6,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.24)',
    backgroundColor: 'rgba(6,6,8,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studySection: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.08)',
    gap: 8,
  },
  signalSection: {
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.08)',
    gap: 7,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  sectionMeta: {
    color: palette.muted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  sectionAction: {
    color: palette.violet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  singleRoomContext: {
    minHeight: 54,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(185,176,163,0.08)',
    backgroundColor: 'rgba(6,6,8,0.2)',
    paddingVertical: 9,
  },
  singleRoomRail: {
    width: 2,
    alignSelf: 'stretch',
    backgroundColor: palette.violet,
  },
  singleRoomCopy: {
    flex: 1,
    gap: 3,
  },
  singleRoomTitle: {
    color: palette.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  singleRoomMeta: {
    color: palette.muted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 16,
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roomTile: {
    width: '48.5%',
    minHeight: 58,
    backgroundColor: 'rgba(6,6,8,0.28)',
    paddingHorizontal: 11,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  roomTileActive: {
    borderLeftColor: 'rgba(196,181,253,0.76)',
    backgroundColor: 'rgba(124,58,237,0.16)',
  },
  roomTitle: {
    color: palette.text,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  roomTitleActive: {
    color: palette.violet,
  },
  roomMeta: {
    color: palette.muted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reviewRail: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(185,176,163,0.09)',
    backgroundColor: 'rgba(6,6,8,0.2)',
  },
  reviewRow: {
    minHeight: 54,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,176,163,0.08)',
  },
  reviewRailMark: {
    width: 2,
    backgroundColor: palette.violet,
  },
  reviewRailMarkFollowup: {
    backgroundColor: palette.amber,
  },
  reviewCopy: {
    flex: 1,
    gap: 3,
  },
  reviewTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewTitle: {
    flex: 1,
    color: palette.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  reviewDate: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  reviewBody: {
    color: palette.muted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 16,
  },
  filterPanel: {
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderColor: 'rgba(185,176,163,0.1)',
    backgroundColor: 'rgba(6,6,8,0.26)',
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 7,
    gap: 8,
  },
  libraryContext: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'rgba(124,58,237,0.1)',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  libraryContextText: {
    color: palette.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  libraryContextAction: {
    color: palette.violet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.14)',
    backgroundColor: 'rgba(6,6,8,0.38)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: SLTypography.rowTitle.fontSize,
    paddingVertical: 6,
  },
  filtersButton: {
    width: 38,
    height: 38,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
    backgroundColor: 'rgba(20,16,28,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.background,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: SLColors.successSoft,
    fontSize: 10,
    fontWeight: '900',
  },
  filterSummary: {
    color: palette.muted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  filterChip: {
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(15,23,42,0.54)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: 'rgba(196,181,253,0.46)',
    backgroundColor: 'rgba(124,58,237,0.24)',
  },
  followupChipActive: {
    borderColor: 'rgba(251,191,36,0.5)',
    backgroundColor: 'rgba(251,191,36,0.18)',
  },
  filterChipText: {
    color: palette.muted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: palette.violet,
  },
  followupChipText: {
    color: palette.amber,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,2,3,0.66)',
  },
  filterSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.16)',
    backgroundColor: 'rgba(7,7,9,0.95)',
    overflow: 'hidden',
    paddingBottom: 14,
  },
  filterSheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(148,163,184,0.38)',
    marginTop: 9,
  },
  filterSheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.13)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterSheetTitle: {
    color: palette.text,
    fontSize: 19,
    fontWeight: '900',
  },
  filterSheetSubtitle: {
    color: palette.muted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginTop: 3,
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSheetScroll: {
    maxHeight: 480,
  },
  filterSheetContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 18,
  },
  filterGroup: {
    gap: 9,
  },
  filterGroupTitle: {
    color: palette.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  modalChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  followupToggle: {
    minHeight: 58,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(15,23,42,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  followupToggleActive: {
    borderColor: 'rgba(251,191,36,0.5)',
    backgroundColor: 'rgba(251,191,36,0.16)',
  },
  followupToggleIcon: {
    width: 24,
    height: 24,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followupToggleIconActive: {
    borderColor: 'rgba(251,191,36,0.7)',
    backgroundColor: palette.amber,
  },
  followupToggleTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  followupToggleTitle: {
    color: palette.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  followupToggleTitleActive: {
    color: palette.amber,
  },
  followupToggleBody: {
    color: palette.muted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  filterSheetActions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.13)',
    flexDirection: 'row',
    gap: 10,
  },
  resetButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(6,6,8,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: palette.muted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  applyFiltersButton: {
    flex: 1.4,
    minHeight: 42,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.34)',
    backgroundColor: 'rgba(20,184,166,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFiltersText: {
    color: palette.green,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  errorText: {
    color: palette.red,
    fontSize: SLTypography.label.fontSize,
    marginHorizontal: 0,
    marginTop: 12,
  },
  list: {
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
    paddingHorizontal: 0,
    paddingTop: 12,
  },
  card: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,176,163,0.1)',
    backgroundColor: 'rgba(6,6,8,0.3)',
    paddingVertical: 10,
    paddingLeft: 9,
    paddingRight: 4,
    flexDirection: 'row',
    gap: 9,
  },
  followupCard: {
    borderLeftColor: 'rgba(251,191,36,0.5)',
    backgroundColor: 'rgba(69,26,3,0.2)',
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  thumbWrap: {
    width: 76,
    height: 102,
    borderRadius: SLRadius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(6,6,8,0.52)',
    flexShrink: 0,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.18)',
    backgroundColor: 'rgba(6,6,8,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardTitle: {
    flex: 1,
    minWidth: 112,
    color: palette.text,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 19,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: SLRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
    backgroundColor: 'rgba(124,58,237,0.17)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 1,
  },
  followupPill: {
    borderColor: 'rgba(251,191,36,0.42)',
    backgroundColor: 'rgba(251,191,36,0.18)',
  },
  statusText: {
    color: palette.violet,
    fontSize: 10,
    fontWeight: '700',
  },
  followupStatusText: {
    color: palette.amber,
  },
  cardMeta: {
    color: palette.muted,
    fontSize: SLTypography.caption.fontSize,
    marginTop: 3,
    marginBottom: 5,
  },
  detailLine: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
  },
  detailLabel: {
    color: palette.muted,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  feedbackPreviewText: {
    flex: 1,
    color: palette.muted,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 15,
  },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: SLRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(6,6,8,0.38)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  feedbackPillActive: {
    borderColor: 'rgba(167,243,208,0.28)',
    backgroundColor: 'rgba(20,184,166,0.13)',
  },
  feedbackText: {
    color: palette.muted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  feedbackTextActive: {
    color: palette.green,
  },
  emptyCard: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,176,163,0.1)',
    backgroundColor: 'transparent',
    paddingVertical: 11,
    gap: 9,
  },
  emptyTitle: {
    color: palette.muted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
    marginTop: 0,
  },
  emptyBody: {
    color: palette.muted,
    display: 'none',
    textAlign: 'center',
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    marginTop: 6,
  },
});
