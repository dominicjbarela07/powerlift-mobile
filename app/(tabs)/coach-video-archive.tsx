import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';

import SetVideoPlayerModal, { type SetVideoReviewTag, type SetVideoSummary } from '@/components/SetVideoPlayerModal';
import { SLScreen } from '@/components/ui';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { getCoachVideoArchive } from '@/lib/api';
import { createLatestRequestManager } from '@/lib/latest-request';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';

const palette = {
  border: SLColors.borderHairline,
  text: SLColors.textStrong,
  muted: SLColors.textMuted,
  green: SLColors.success,
  violet: SLColors.accentViolet,
  amber: SLColors.warning,
};

type ArchiveVideo = SetVideoSummary & {
  athlete_id?: number | null;
  athlete_name?: string | null;
  review_tags?: SetVideoReviewTag[] | null;
  upload_date?: string | null;
  reviewed_date?: string | null;
  pinned?: boolean;
};

type ArchivePagination = {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
};

type AthleteOption = {
  id: number;
  name: string;
};

const statusOptions = [
  { value: '', label: 'All statuses' },
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
  { value: '', label: 'All lifts' },
  { value: 'squat', label: 'Squat' },
  { value: 'bench', label: 'Bench' },
  { value: 'deadlift', label: 'Deadlift' },
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
  if (value === 'not_requested' || value === 'archive_only') return 'Saved';
  if (value === 'reviewed') return 'Reviewed';
  if (value === 'needs_followup') return 'Follow-up';
  if (value === 'viewed') return 'Viewed';
  return 'Pending';
}

function compactActual(video: ArchiveVideo) {
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

function tagLabels(tags?: ArchiveVideo['review_tags']) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => {
      if (!tag) return null;
      if (typeof tag === 'string') return tag.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
      return tag.label || tag.slug?.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || null;
    })
    .filter((label): label is string => !!label);
}

export default function CoachVideoArchiveScreen() {
  const router = useRouter();
  const [videos, setVideos] = useState<ArchiveVideo[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState<ArchivePagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [lift, setLift] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [videoAngle, setVideoAngle] = useState('');
  const [setType, setSetType] = useState('');
  const [needsFollowupOnly, setNeedsFollowupOnly] = useState(false);
  const [hasFeedback, setHasFeedback] = useState('');
  const [pinned, setPinned] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftAthleteId, setDraftAthleteId] = useState('');
  const [draftLift, setDraftLift] = useState('');
  const [draftReviewStatus, setDraftReviewStatus] = useState('');
  const [draftVideoAngle, setDraftVideoAngle] = useState('');
  const [draftSetType, setDraftSetType] = useState('');
  const [draftNeedsFollowupOnly, setDraftNeedsFollowupOnly] = useState(false);
  const [draftHasFeedback, setDraftHasFeedback] = useState('');
  const [draftPinned, setDraftPinned] = useState('');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [athleteSelectOpen, setAthleteSelectOpen] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<ArchiveVideo | null>(null);
  const requests = useRef(createLatestRequestManager<Awaited<ReturnType<typeof getCoachVideoArchive>>>()).current;

  useEffect(() => () => requests.cancel(), [requests]);

  const loadArchive = useCallback(async (opts?: {
    silent?: boolean;
    showRefreshIndicator?: boolean;
    page?: number;
    append?: boolean;
    filters?: {
      query?: string;
      athleteId?: string;
      lift?: string;
      reviewStatus?: string;
      videoAngle?: string;
      setType?: string;
      needsFollowupOnly?: boolean;
      hasFeedback?: string;
      pinned?: string;
      dateFrom?: string;
      dateTo?: string;
    };
  }) => {
    const silent = !!opts?.silent;
    const append = !!opts?.append;
    const page = opts?.page || 1;
    const nextQuery = opts?.filters?.query ?? query;
    const nextAthleteId = opts?.filters?.athleteId ?? athleteId;
    const nextLift = opts?.filters?.lift ?? lift;
    const nextReviewStatus = opts?.filters?.reviewStatus ?? reviewStatus;
    const nextVideoAngle = opts?.filters?.videoAngle ?? videoAngle;
    const nextSetType = opts?.filters?.setType ?? setType;
    const nextNeedsFollowupOnly = opts?.filters?.needsFollowupOnly ?? needsFollowupOnly;
    const nextHasFeedback = opts?.filters?.hasFeedback ?? hasFeedback;
    const nextPinned = opts?.filters?.pinned ?? pinned;
    const nextDateFrom = opts?.filters?.dateFrom ?? dateFrom;
    const nextDateTo = opts?.filters?.dateTo ?? dateTo;
    if (append) setLoadingMore(true);
    else if (silent && opts?.showRefreshIndicator !== false) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const result = await requests.run((signal) => getCoachVideoArchive({
        q: nextQuery,
        athlete_id: nextAthleteId,
        lift: nextLift,
        review_status: nextNeedsFollowupOnly ? 'needs_followup' : nextReviewStatus,
        video_angle: nextVideoAngle,
        set_type: nextSetType,
        needs_followup: nextNeedsFollowupOnly ? 'yes' : '',
        has_feedback: nextHasFeedback,
        pinned: nextPinned,
        date_from: nextDateFrom,
        date_to: nextDateTo,
        page,
        per_page: 25,
      }, signal));
    if (result.kind === 'cancelled' || result.kind === 'obsolete') return;
    if (result.kind === 'error') {
      setError((result.error as any)?.message || 'Could not load coach video archive.');
    } else {
      const res = result.value;
      const payload = res.json || {};
      if (!res.ok || !payload.ok) {
        if (res.status === 401) router.replace('/login');
        setError(payload.error || `Could not load coach video archive (${res.status})`);
      } else {
        const nextVideos = Array.isArray(payload.videos) ? payload.videos : [];
        setVideos((current) => append
          ? [...current, ...nextVideos.filter((row: ArchiveVideo) => !current.some((existing) => existing.id === row.id))]
          : nextVideos);
        setAthletes(Array.isArray(payload.athletes) ? payload.athletes : []);
        setPagination(payload.pagination || null);
      }
    }
    if (append) setLoadingMore(false);
    else if (silent) setRefreshing(false);
    setLoading(false);
  }, [athleteId, dateFrom, dateTo, hasFeedback, lift, needsFollowupOnly, pinned, query, requests, reviewStatus, router, setType, videoAngle]);

  useFocusEffect(
    useCallback(() => {
      loadArchive({ silent: true, showRefreshIndicator: false });
    }, [loadArchive]),
  );

  const followupCount = useMemo(
    () => videos.filter((video) => video.review_status === 'needs_followup').length,
    [videos],
  );

  const activeFilterCount = useMemo(
    () => [athleteId, lift, reviewStatus, videoAngle, setType, needsFollowupOnly ? 'needs_followup' : '', hasFeedback, pinned, dateFrom, dateTo].filter(Boolean).length,
    [athleteId, dateFrom, dateTo, hasFeedback, lift, needsFollowupOnly, pinned, reviewStatus, setType, videoAngle],
  );

  const filterSummary = useMemo(() => {
    const parts = [
      athletes.find((athlete) => String(athlete.id) === athleteId)?.name || null,
      liftOptions.find((option) => option.value === lift)?.value ? liftOptions.find((option) => option.value === lift)?.label : null,
      needsFollowupOnly
        ? 'Needs follow-up'
        : statusOptions.find((option) => option.value === reviewStatus)?.value
          ? statusOptions.find((option) => option.value === reviewStatus)?.label
          : null,
      angleOptions.find((option) => option.value === videoAngle)?.value ? angleOptions.find((option) => option.value === videoAngle)?.label : null,
      setTypeOptions.find((option) => option.value === setType)?.value ? setTypeOptions.find((option) => option.value === setType)?.label : null,
      hasFeedback === 'yes' ? 'Has feedback' : hasFeedback === 'no' ? 'No feedback' : null,
      pinned === 'pinned' ? 'Pinned' : pinned === 'unpinned' ? 'Not pinned' : null,
      dateFrom || dateTo ? `${dateFrom || 'Any date'}–${dateTo || 'Today'}` : null,
    ].filter(Boolean);
    return parts.length ? `Filters: ${parts.join(' · ')}` : '';
  }, [athleteId, athletes, dateFrom, dateTo, hasFeedback, lift, needsFollowupOnly, pinned, reviewStatus, setType, videoAngle]);

  const draftAthleteLabel = useMemo(() => {
    if (!draftAthleteId) return 'All Athletes';
    return athletes.find((athlete) => String(athlete.id) === draftAthleteId)?.name || 'Selected athlete';
  }, [athletes, draftAthleteId]);

  const filteredAthleteOptions = useMemo(() => {
    const needle = athleteSearch.trim().toLowerCase();
    const allOption = { id: 0, name: 'All Athletes' };
    const filtered = needle
      ? athletes.filter((athlete) => athlete.name.toLowerCase().includes(needle))
      : athletes;
    return [allOption, ...filtered];
  }, [athleteSearch, athletes]);

  const openFilters = useCallback(() => {
    setDraftAthleteId(athleteId);
    setDraftLift(lift);
    setDraftReviewStatus(reviewStatus);
    setDraftVideoAngle(videoAngle);
    setDraftSetType(setType);
    setDraftNeedsFollowupOnly(needsFollowupOnly);
    setDraftHasFeedback(hasFeedback);
    setDraftPinned(pinned);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setAthleteSearch('');
    setAthleteSelectOpen(false);
    setFilterSheetOpen(true);
  }, [athleteId, dateFrom, dateTo, hasFeedback, lift, needsFollowupOnly, pinned, reviewStatus, setType, videoAngle]);

  const resetDraftFilters = useCallback(() => {
    setDraftAthleteId('');
    setDraftLift('');
    setDraftReviewStatus('');
    setDraftVideoAngle('');
    setDraftSetType('');
    setDraftNeedsFollowupOnly(false);
    setDraftHasFeedback('');
    setDraftPinned('');
    setDraftDateFrom('');
    setDraftDateTo('');
    setAthleteSearch('');
    setAthleteSelectOpen(false);
  }, []);

  const applyFilters = useCallback(() => {
    const nextReviewStatus = draftNeedsFollowupOnly ? '' : draftReviewStatus;
    setAthleteId(draftAthleteId);
    setLift(draftLift);
    setReviewStatus(nextReviewStatus);
    setVideoAngle(draftVideoAngle);
    setSetType(draftSetType);
    setNeedsFollowupOnly(draftNeedsFollowupOnly);
    setHasFeedback(draftHasFeedback);
    setPinned(draftPinned);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setFilterSheetOpen(false);
    loadArchive({
      silent: true,
      filters: {
        athleteId: draftAthleteId,
        lift: draftLift,
        reviewStatus: nextReviewStatus,
        videoAngle: draftVideoAngle,
        setType: draftSetType,
        needsFollowupOnly: draftNeedsFollowupOnly,
        hasFeedback: draftHasFeedback,
        pinned: draftPinned,
        dateFrom: draftDateFrom,
        dateTo: draftDateTo,
      },
    });
  }, [draftAthleteId, draftDateFrom, draftDateTo, draftHasFeedback, draftLift, draftNeedsFollowupOnly, draftPinned, draftReviewStatus, draftSetType, draftVideoAngle, loadArchive]);

  return (
    <SLScreen edges="none" padded={false} style={styles.screen}>
      {loading && !videos.length ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={palette.violet} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          stickyHeaderIndices={[1]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadArchive({ silent: true })} tintColor={palette.muted} />}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Archive</Text>
              <Text style={styles.subtitle}>{pagination?.total ?? videos.length} clip{(pagination?.total ?? videos.length) === 1 ? '' : 's'} · {followupCount} follow-up on this page</Text>
            </View>
            <Pressable style={styles.headerIcon} onPress={() => loadArchive({ silent: true })}>
              <Ionicons name="albums-outline" size={24} color={palette.violet} />
            </Pressable>
          </View>

          <View style={styles.filterPanel}>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={17} color={palette.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => loadArchive({ silent: true })}
                  placeholder="Search athlete, lift, session..."
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
            {activeFilterCount ? <Text style={styles.filterSummary} numberOfLines={1}>{filterSummary}</Text> : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.list}>
            {videos.length ? (
              videos.map((video) => {
                const context = video.context || {};
                const movementName = simplifyMobileMovementName(context.movement_name || context.lift_name) || 'Movement';
                const setLabel = context.set_display_label || context.set_context_label || (context.set_index != null ? `Set ${context.set_index}` : 'Set');
                const isFollowup = video.review_status === 'needs_followup';
                const tags = tagLabels(video.review_tags).slice(0, 3);
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
                        <Text style={styles.cardTitle} numberOfLines={1}>{movementName} · {setLabel}</Text>
                        <View style={[styles.statusPill, isFollowup && styles.followupPill]}>
                          <Text style={[styles.statusText, isFollowup && styles.followupStatusText]}>{statusLabel(video.review_status)}</Text>
                        </View>
                      </View>
                      <Text typographyRole="caption" style={styles.cardMeta} numberOfLines={1}>
                        {video.athlete_name || context.athlete_name || 'Athlete'} · {formatDate(context.session_date)}
                      </Text>
                      <Text style={styles.detailLine} numberOfLines={1}>
                        <Text style={styles.detailLabel}>Plan: </Text>
                        {context.prescription_label || 'No planned snapshot'}
                      </Text>
                      <Text style={styles.detailLine} numberOfLines={1}>
                        <Text style={styles.detailLabel}>Log: </Text>
                        {compactActual(video) || 'No logged actuals'}
                      </Text>
                      <View style={styles.cardFooter}>
                        <Text style={styles.footerText} numberOfLines={1}>
                          {video.pinned ? 'Pinned · ' : ''}{video.video_angle_label || 'Unknown Angle'}{tags.length ? ` · ${tags.join(' · ')}` : ''}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={palette.muted} />
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="albums-outline" size={24} color={palette.muted} />
                <Text style={styles.emptyTitle}>No roster videos found</Text>
                <Text style={styles.emptyBody}>Submitted athlete videos will appear here for archive browsing.</Text>
              </View>
            )}
            {pagination?.has_next ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load more videos"
                disabled={loadingMore}
                onPress={() => loadArchive({ silent: true, append: true, page: pagination.page + 1 })}
                style={({ pressed }) => [styles.loadMoreButton, pressed && styles.cardPressed]}
              >
                {loadingMore ? <ActivityIndicator color={palette.violet} /> : <Text style={styles.loadMoreText}>Load More</Text>}
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      )}

      <Modal visible={filterSheetOpen} transparent animationType="slide" onRequestClose={() => setFilterSheetOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalScrim} onPress={() => setFilterSheetOpen(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>Filters</Text>
              </View>
              <Pressable style={styles.sheetCloseButton} onPress={() => setFilterSheetOpen(false)}>
                <Ionicons name="close" size={18} color={palette.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.filterSheetScroll} contentContainerStyle={styles.filterSheetContent}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Athlete</Text>
                <Pressable
                  style={styles.athleteSelect}
                  onPress={() => setAthleteSelectOpen((value) => !value)}
                >
                  <View style={styles.athleteSelectCopy}>
                    <Text style={styles.athleteSelectLabel}>Roster filter</Text>
                    <Text style={styles.athleteSelectValue} numberOfLines={1}>{draftAthleteLabel}</Text>
                  </View>
                  <Ionicons name={athleteSelectOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.violet} />
                </Pressable>
                {athleteSelectOpen ? (
                  <View style={styles.athleteDropdown}>
                    <View style={styles.athleteSearchBox}>
                      <Ionicons name="search" size={15} color={palette.muted} />
                      <TextInput
                        value={athleteSearch}
                        onChangeText={setAthleteSearch}
                        placeholder="Search athletes"
                        placeholderTextColor={SLColors.textSubtle}
                        style={styles.athleteSearchInput}
                      />
                    </View>
                    <ScrollView
                      style={styles.athleteOptionList}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredAthleteOptions.map((athlete) => {
                        const value = athlete.id ? String(athlete.id) : '';
                        const active = draftAthleteId === value;
                        return (
                          <Pressable
                            key={value || 'all-athletes'}
                            style={[styles.athleteOption, active && styles.athleteOptionActive]}
                            onPress={() => {
                              setDraftAthleteId(value);
                              setAthleteSelectOpen(false);
                              setAthleteSearch('');
                            }}
                          >
                            <Text typographyRole="dynamicName" style={[styles.athleteOptionText, active && styles.athleteOptionTextActive]} numberOfLines={1}>
                              {athlete.name}
                            </Text>
                            {active ? <Ionicons name="checkmark" size={16} color={palette.green} /> : null}
                          </Pressable>
                        );
                      })}
                      {filteredAthleteOptions.length === 1 && athleteSearch.trim() ? (
                        <View style={styles.athleteOptionEmpty}>
                          <Text style={styles.athleteOptionEmptyText}>No athletes found</Text>
                        </View>
                      ) : null}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
              <FilterGroup title="Lift">
                {liftOptions.map((option) => (
                  <FilterChip key={option.value || 'all-lifts'} label={option.label} active={draftLift === option.value} onPress={() => setDraftLift(option.value)} />
                ))}
              </FilterGroup>
              <FilterGroup title="Review status">
                {statusOptions.map((option) => (
                  <FilterChip
                    key={option.value || 'all-statuses'}
                    label={option.label}
                    active={!draftNeedsFollowupOnly && draftReviewStatus === option.value}
                    onPress={() => {
                      setDraftNeedsFollowupOnly(false);
                      setDraftReviewStatus(option.value);
                    }}
                  />
                ))}
              </FilterGroup>
              <FilterGroup title="Video angle">
                {angleOptions.map((option) => (
                  <FilterChip key={option.value || 'any-angle'} label={option.label} active={draftVideoAngle === option.value} onPress={() => setDraftVideoAngle(option.value)} />
                ))}
              </FilterGroup>
              <FilterGroup title="Set type">
                {setTypeOptions.map((option) => (
                  <FilterChip key={option.value || 'all-set-types'} label={option.label} active={draftSetType === option.value} onPress={() => setDraftSetType(option.value)} />
                ))}
              </FilterGroup>
              <FilterGroup title="Feedback">
                {[
                  { value: '', label: 'Any feedback state' },
                  { value: 'yes', label: 'Has feedback' },
                  { value: 'no', label: 'No feedback' },
                ].map((option) => (
                  <FilterChip key={option.value || 'any-feedback'} label={option.label} active={draftHasFeedback === option.value} onPress={() => setDraftHasFeedback(option.value)} />
                ))}
              </FilterGroup>
              <FilterGroup title="Evidence">
                {[
                  { value: '', label: 'Any evidence' },
                  { value: 'pinned', label: 'Pinned' },
                  { value: 'unpinned', label: 'Not pinned' },
                ].map((option) => (
                  <FilterChip key={option.value || 'any-evidence'} label={option.label} active={draftPinned === option.value} onPress={() => setDraftPinned(option.value)} />
                ))}
              </FilterGroup>
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Session date</Text>
                <View style={styles.dateRow}>
                  <TextInput
                    accessibilityLabel="Session date from"
                    value={draftDateFrom}
                    onChangeText={setDraftDateFrom}
                    placeholder="From YYYY-MM-DD"
                    placeholderTextColor={SLColors.textSubtle}
                    autoCapitalize="none"
                    style={styles.dateInput}
                  />
                  <TextInput
                    accessibilityLabel="Session date to"
                    value={draftDateTo}
                    onChangeText={setDraftDateTo}
                    placeholder="To YYYY-MM-DD"
                    placeholderTextColor={SLColors.textSubtle}
                    autoCapitalize="none"
                    style={styles.dateInput}
                  />
                </View>
              </View>
              <FilterGroup title="Priority">
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
                    <Text style={[styles.followupToggleTitle, draftNeedsFollowupOnly && styles.followupToggleTitleActive]}>Needs follow-up only</Text>
                  </View>
                </Pressable>
              </FilterGroup>
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
        refreshPath={selectedVideo ? `/video-review/mobile/coach/attachments/${selectedVideo.id}` : null}
        showPlaybackSpeedControls
        onClose={() => setSelectedVideo(null)}
      />
    </SLScreen>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.modalChipGrid}>{children}</View>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 110 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: { color: palette.violet, fontSize: SLTypography.micro.fontSize, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: {
    color: palette.text,
    fontFamily: SLTypography.title.fontFamily,
    fontSize: SLTypography.title.fontSize,
    lineHeight: SLTypography.title.lineHeight,
    fontWeight: '700',
    marginTop: 0,
  },
  subtitle: { color: palette.muted, fontSize: SLTypography.caption.fontSize, fontWeight: '600', marginTop: 2 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.accentVioletSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPanel: {
    borderBottomWidth: 1,
    borderColor: SLColors.shellHairline,
    backgroundColor: SLColors.surfaceEmbedded,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 4,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  searchBox: {
    flex: 1,
    minHeight: 36,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surfaceEmbedded,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: palette.text, fontSize: SLTypography.rowTitle.fontSize, paddingVertical: 6 },
  filtersButton: {
    width: 36,
    height: 36,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.accentVioletSoft,
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
    borderColor: SLColors.shellCanvas,
    backgroundColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: SLColors.textInverted, fontSize: 10, fontWeight: '900' },
  filterSummary: { color: palette.muted, fontSize: SLTypography.micro.fontSize, fontWeight: '700' },
  errorText: { color: SLColors.danger, fontSize: SLTypography.label.fontSize, fontWeight: '700', marginTop: 10 },
  list: { borderTopWidth: 1, borderTopColor: SLColors.shellHairline, paddingTop: 0 },
  card: {
    flexDirection: 'row',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.shellHairline,
    backgroundColor: 'rgba(10,11,11,0.18)',
    paddingVertical: 10,
    paddingLeft: 9,
    paddingRight: 4,
    position: 'relative',
  },
  cardPressed: { opacity: 0.78 },
  followupCard: { backgroundColor: SLColors.warningSoft },
  rowRail: {
    backgroundColor: SLColors.railViolet,
    bottom: 12,
    left: 0,
    position: 'absolute',
    top: 12,
    width: 3,
  },
  followupRail: {
    backgroundColor: SLColors.railWarning,
  },
  thumbWrap: { width: 70, height: 94, borderRadius: SLRadius.radiusControl, overflow: 'hidden', backgroundColor: SLColors.surfaceInset },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceInset },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardTitle: { flex: 1, minWidth: 0, color: palette.text, fontSize: SLTypography.rowTitle.fontSize, fontWeight: '700' },
  statusPill: { borderRadius: SLRadius.radiusSharp, backgroundColor: SLColors.accentVioletSoft, paddingHorizontal: 7, paddingVertical: 3 },
  followupPill: { backgroundColor: SLColors.warningSoft },
  statusText: { color: palette.violet, fontSize: 10, fontWeight: '700' },
  followupStatusText: { color: palette.amber },
  cardMeta: { color: palette.muted, fontSize: SLTypography.caption.fontSize, fontWeight: '600' },
  detailLine: { color: SLColors.text, fontSize: SLTypography.caption.fontSize, fontWeight: '600' },
  detailLabel: { color: palette.muted, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  footerText: { flex: 1, color: palette.muted, fontSize: SLTypography.micro.fontSize, fontWeight: '700' },
  emptyCard: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: SLColors.shellHairline,
    backgroundColor: 'transparent',
    paddingVertical: 11,
    gap: 9,
  },
  emptyTitle: { color: palette.muted, fontSize: SLTypography.label.fontSize, fontWeight: '600' },
  emptyBody: { display: 'none', color: palette.muted, fontSize: SLTypography.label.fontSize, textAlign: 'center' },
  loadMoreButton: {
    minHeight: 48,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.accentVioletSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { color: palette.text, fontSize: SLTypography.label.fontSize, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: SLColors.surfaceScrim },
  filterSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: SLRadius.radiusCard,
    borderTopRightRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surfaceCommand,
    paddingTop: 8,
  },
  filterSheetHandle: {
    width: 42,
    height: 4,
    borderRadius: SLRadius.radiusSharp,
    backgroundColor: SLColors.borderStrong,
    alignSelf: 'center',
    marginBottom: 10,
  },
  filterSheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterSheetTitle: { color: palette.text, fontSize: SLTypography.cardTitle.fontSize, fontWeight: '900' },
  filterSheetSubtitle: { color: palette.muted, fontSize: SLTypography.caption.fontSize, marginTop: 2 },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSheetScroll: { maxHeight: 520 },
  filterSheetContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  filterGroup: { gap: 8 },
  filterGroupTitle: { color: SLColors.text, fontSize: SLTypography.caption.fontSize, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  athleteSelect: {
    minHeight: 48,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: SLColors.surfaceEmbedded,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  athleteSelectCopy: {
    flex: 1,
    minWidth: 0,
  },
  athleteSelectLabel: {
    color: palette.muted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  athleteSelectValue: {
    color: palette.text,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
    marginTop: 2,
  },
  athleteDropdown: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surfaceEmbedded,
    padding: 8,
    gap: 8,
  },
  athleteSearchBox: {
    minHeight: 38,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surfaceInset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  athleteSearchInput: {
    flex: 1,
    color: palette.text,
    fontSize: SLTypography.label.fontSize,
    paddingVertical: 6,
  },
  athleteOptionList: {
    maxHeight: 210,
  },
  athleteOption: {
    minHeight: 42,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  athleteOptionActive: {
    backgroundColor: SLColors.accentVioletSoft,
  },
  athleteOptionText: {
    flex: 1,
    minWidth: 0,
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  athleteOptionTextActive: {
    color: palette.text,
  },
  athleteOptionEmpty: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  athleteOptionEmptyText: {
    color: palette.muted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  modalChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: SLColors.surfaceEmbedded,
    color: palette.text,
    fontSize: SLTypography.caption.fontSize,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterChip: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: SLColors.surfaceEmbedded,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  filterChipActive: { borderColor: SLColors.borderSelected, backgroundColor: SLColors.accentVioletSoft },
  filterChipText: { color: palette.muted, fontSize: SLTypography.caption.fontSize, fontWeight: '800' },
  filterChipTextActive: { color: palette.text },
  followupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: SLColors.surfaceEmbedded,
    padding: 10,
  },
  followupToggleActive: { borderColor: SLColors.warning, backgroundColor: SLColors.warningSoft },
  followupToggleIcon: {
    width: 22,
    height: 22,
    borderRadius: SLRadius.radiusSharp,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followupToggleIconActive: { backgroundColor: palette.amber, borderColor: palette.amber },
  followupToggleTextWrap: { flex: 1 },
  followupToggleTitle: { color: palette.text, fontSize: SLTypography.label.fontSize, fontWeight: '900' },
  followupToggleTitleActive: { color: palette.amber },
  followupToggleBody: { display: 'none', color: palette.muted, fontSize: SLTypography.caption.fontSize, marginTop: 2 },
  filterSheetActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
    padding: 16,
    paddingBottom: 24,
  },
  resetButton: {
    flex: 1,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  resetButtonText: { color: palette.text, fontSize: SLTypography.label.fontSize, fontWeight: '900' },
  applyFiltersButton: {
    flex: 1.4,
    borderRadius: SLRadius.radiusControl,
    backgroundColor: SLColors.reviewSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  applyFiltersText: { color: SLColors.textStrong, fontSize: SLTypography.label.fontSize, fontWeight: '900' },
});
