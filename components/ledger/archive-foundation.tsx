import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/ui/sl-text';
import { SLCanonicalIcon, SLTrophy } from '@/components/ui';
import { SLColors, SLFontFamilies, SLRadius, SLSpacing } from '@/constants/theme';
import { getAthleteVideoArchive } from '@/lib/api';
import {
  ArchiveRequestError,
  archiveDetailHref,
  fetchArchiveCollection,
  fetchArchiveLanding,
  searchArchive,
  type ArchiveCollection,
  type ArchiveItem,
  type ArchiveLanding,
  type ArchivePage,
  type ArchiveQuery,
} from '@/lib/ledger-archive';
import { SectionLabel } from './primitives';
import { useAuth } from '@/context/AuthContext';
import {
  convertDisplayWeightValue,
  formatCompactVolumeValueFromKg,
  formatWeightFromKg,
  normalizeDisplayWeightUnit,
  type DisplayWeightUnit,
} from '@/lib/display-units';

const COLLECTIONS: ArchiveCollection[] = ['training', 'media', 'competition'];
const RECENT_SEARCHES_KEY = 'strength-ledger:ledger-archive:recent-searches:v1';
const ArchiveDisplayUnitContext = React.createContext<DisplayWeightUnit>('lb');
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

type ArchiveScope = 'overview' | ArchiveCollection;
type PreviewPages = Record<ArchiveCollection, ArchivePage | null>;
type ArchiveFailure = { status?: number; detail: string };
type NaturalAlbum = { key: string; label: string; programId?: number; blockId?: number; programName?: string };
type CanonicalVideoPreview = {
  id?: unknown;
  thumbnail_url?: unknown;
};
type Filters = {
  dateFrom: string;
  dateTo: string;
  classification: '' | 'core' | 'accessory';
  hasVideo: '' | 'true';
  sourceType: '' | 'session' | 'historical';
  weightMin: string;
  repsMin: string;
  rpeMin: string;
  reviewStatus: '' | 'pending' | 'reviewed';
  hasFeedback: '' | 'true';
  dateField: 'performed' | 'uploaded';
  federation: string;
  weightClass: string;
  meetStatus: '' | 'completed' | 'archived';
};

const EMPTY_FILTERS: Filters = {
  dateFrom: '',
  dateTo: '',
  classification: '',
  hasVideo: '',
  sourceType: '',
  weightMin: '',
  repsMin: '',
  rpeMin: '',
  reviewStatus: '',
  hasFeedback: '',
  dateField: 'performed',
  federation: '',
  weightClass: '',
  meetStatus: '',
};

const COLLECTION_META: Record<ArchiveCollection, { label: string; singular: string; icon: keyof typeof Ionicons.glyphMap; tone: string; description: string }> = {
  training: { label: 'Training history', singular: 'training record', icon: 'barbell-outline', tone: '#A98CFF', description: 'Sessions, performed sets, programs, and imported history.' },
  media: { label: 'Film & review', singular: 'video', icon: 'videocam-outline', tone: '#5ED7CA', description: 'Preserved lift footage and athlete-visible review.' },
  competition: { label: 'Competition book', singular: 'meet', icon: 'trophy-outline', tone: '#D4AD62', description: 'Meet records, attempts, totals, and federation context.' },
};

function movementName(item: ArchiveItem): string | null {
  const name = item.movement?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function movementId(item: ArchiveItem): number | null {
  const id = item.movement?.id;
  return typeof id === 'number' && Number.isInteger(id) ? id : null;
}

function performanceNumber(item: ArchiveItem, key: string): number | null {
  const value = item.performance?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cleanNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${cleanNumber(value / 1_000_000)}M`;
  if (value >= 1_000) return `${cleanNumber(value / 1_000)}K`;
  return String(value);
}

function dateLabel(value?: string): string {
  if (!value) return 'Date unavailable';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function yearLabel(value?: string): string {
  return value?.slice(0, 4) || 'Undated';
}

function itemTone(item: ArchiveItem): string {
  if (item.archive_item_type === 'video') return COLLECTION_META.media.tone;
  if (item.archive_item_type === 'meet') return COLLECTION_META.competition.tone;
  if (item.archive_item_type === 'historical_performance') return '#7FA7D8';
  return COLLECTION_META.training.tone;
}

function itemIcon(item: ArchiveItem): keyof typeof Ionicons.glyphMap {
  if (item.archive_item_type === 'video') return 'play';
  if (item.archive_item_type === 'meet') return 'trophy-outline';
  if (item.archive_item_type === 'set') return 'pulse-outline';
  if (item.archive_item_type === 'historical_performance') return 'time-outline';
  if (item.archive_item_type === 'movement') return 'git-branch-outline';
  return 'barbell-outline';
}

function itemEvidence(item: ArchiveItem, unit: DisplayWeightUnit): string {
  const weight = performanceNumber(item, 'weight_kg');
  const reps = performanceNumber(item, 'reps');
  const setCount = performanceNumber(item, 'set_count');
  const movementCount = performanceNumber(item, 'movement_count');
  const volume = performanceNumber(item, 'total_volume_kg');
  const rpe = performanceNumber(item, 'rpe');
  const rir = performanceNumber(item, 'rir');
  if (weight !== null || reps !== null) {
    const effort = rpe !== null ? ` @${cleanNumber(rpe)} RPE` : rir !== null ? ` @${cleanNumber(rir)} RIR` : '';
    return `${weight !== null ? formatWeightFromKg(weight, unit) : 'Load unrecorded'}${reps !== null ? ` × ${cleanNumber(reps)}` : ''}${effort}`;
  }
  if (setCount !== null || movementCount !== null) {
    const parts = [];
    if (setCount !== null) parts.push(`${setCount} ${setCount === 1 ? 'set' : 'sets'}`);
    if (movementCount !== null) parts.push(`${movementCount} ${movementCount === 1 ? 'movement' : 'movements'}`);
    if (volume) parts.push(`${formatCompactVolumeValueFromKg(volume, unit)} moved`);
    return parts.join(' · ');
  }
  if (item.archive_item_type === 'video') {
    const feedback = item.media?.has_athlete_visible_feedback === true;
    return feedback ? 'Coach feedback preserved' : 'Set footage preserved';
  }
  const summary = item.meet_context?.result_summary;
  if (summary && typeof summary === 'object') {
    const total = (summary as Record<string, unknown>).total_kg;
    if (typeof total === 'number') return `${formatWeightFromKg(total, unit)} total`;
  }
  return item.provenance_label || item.source_type || 'Preserved evidence';
}

function activeFilterCount(filters: Filters, movement: { id: number; name: string } | null, album: NaturalAlbum | null): number {
  return [
    filters.dateFrom,
    filters.dateTo,
    filters.classification,
    filters.hasVideo,
    filters.sourceType,
    filters.weightMin,
    filters.repsMin,
    filters.rpeMin,
    filters.reviewStatus,
    filters.hasFeedback,
    filters.federation,
    filters.weightClass,
    filters.meetStatus,
    movement?.id,
    album?.key,
  ].filter(Boolean).length;
}

export function ArchiveFoundationExperience() {
  const params = useLocalSearchParams<{ collection?: string; q?: string; athlete_id?: string; date_from?: string; date_to?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const displayUnit = normalizeDisplayWeightUnit(user?.preferred_units);
  const requestedCollection = first(params.collection) as ArchiveCollection | undefined;
  const initialScope: ArchiveScope = COLLECTIONS.includes(requestedCollection as ArchiveCollection) ? requestedCollection! : 'overview';
  const initialQuery = first(params.q) || '';
  const athleteId = Number(first(params.athlete_id)) || undefined;
  const [scope, setScope] = useState<ArchiveScope>(initialScope);
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [committedQuery, setCommittedQuery] = useState(initialQuery.trim());
  const [filtersOpen, setFiltersOpen] = useState(Boolean(first(params.date_from) || first(params.date_to)));
  const [toolsOpen, setToolsOpen] = useState(Boolean(initialQuery || initialScope !== 'overview' || first(params.date_from) || first(params.date_to)));
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, dateFrom: first(params.date_from) || '', dateTo: first(params.date_to) || '' });
  const [movementFilter, setMovementFilter] = useState<{ id: number; name: string } | null>(null);
  const [naturalAlbumFilter, setNaturalAlbumFilter] = useState<NaturalAlbum | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});
  const [landing, setLanding] = useState<ArchiveLanding | null>(null);
  const [previews, setPreviews] = useState<PreviewPages>({ training: null, media: null, competition: null });
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ArchiveFailure | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const filterCount = activeFilterCount(filters, movementFilter, naturalAlbumFilter);
  const browsingResults = scope !== 'overview' || Boolean(committedQuery) || filterCount > 0;

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((raw) => setRecentSearches(raw ? (JSON.parse(raw) as string[]).slice(0, 5) : []))
      .catch(() => setRecentSearches([]));
  }, []);

  const requestFilters = useMemo<ArchiveQuery>(() => ({
    athlete_id: athleteId,
    q: committedQuery || undefined,
    date_from: filters.dateFrom.trim() || undefined,
    date_to: filters.dateTo.trim() || undefined,
    movement_id: movementFilter?.id,
    program_id: naturalAlbumFilter?.programId,
    block_id: naturalAlbumFilter?.blockId,
    classification: filters.classification || undefined,
    has_video: filters.hasVideo || undefined,
    source_type: filters.sourceType || undefined,
    weight_min: archiveFilterWeightKg(filters.weightMin, displayUnit),
    reps_min: filters.repsMin.trim() || undefined,
    rpe_min: filters.rpeMin.trim() || undefined,
    review_status: filters.reviewStatus || undefined,
    has_feedback: filters.hasFeedback || undefined,
    date_field: filters.dateField,
    federation: filters.federation.trim() || undefined,
    weight_class: filters.weightClass.trim() || undefined,
    status: filters.meetStatus || undefined,
  }), [athleteId, committedQuery, displayUnit, filters, movementFilter, naturalAlbumFilter]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [[nextLanding, training, media, competition], videoResponse] = await Promise.all([
        Promise.all([
          fetchArchiveLanding({ athlete_id: athleteId }),
          fetchArchiveCollection('training', { athlete_id: athleteId, limit: 12 }),
          fetchArchiveCollection('media', { athlete_id: athleteId, limit: 12 }),
          fetchArchiveCollection('competition', { athlete_id: athleteId, limit: 8 }),
        ]),
        getAthleteVideoArchive().catch(() => null),
      ]);
      setLanding(nextLanding);
      setPreviews({ training, media, competition });
      setItems([]);
      setCursor(null);
      const videos = videoResponse?.ok && videoResponse.json?.ok && Array.isArray(videoResponse.json.videos)
        ? videoResponse.json.videos as CanonicalVideoPreview[]
        : [];
      setThumbnailUrls(Object.fromEntries(videos.flatMap((video) => (
        typeof video.id === 'number' && typeof video.thumbnail_url === 'string' && video.thumbnail_url
          ? [[video.id, video.thumbnail_url] as const]
          : []
      ))));
    } catch (caught) {
      const failure = archiveFailure(caught);
      if (__DEV__) console.warn('[Ledger Archive] overview request failed', failure);
      setError(failure);
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  const loadResults = useCallback(async (nextCursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const request = { ...requestFilters, cursor: nextCursor, limit: 24 };
      const page = scope === 'overview'
        ? await searchArchive(request)
        : await fetchArchiveCollection(scope, request);
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setCursor(page.next_cursor);
    } catch (caught) {
      const failure = archiveFailure(caught);
      if (__DEV__) console.warn('[Ledger Archive] results request failed', failure);
      setError(failure);
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [requestFilters, scope]);

  useEffect(() => {
    if (!browsingResults) void loadOverview();
    else void loadResults();
  }, [browsingResults, loadOverview, loadResults]);

  const allPreviewItems = useMemo(() => [
    ...(landing?.recent || []),
    ...(previews.training?.items || []),
    ...(previews.media?.items || []),
    ...(previews.competition?.items || []),
  ], [landing, previews]);
  const movementSuggestions = useMemo(() => {
    const found = new Map<number, string>();
    allPreviewItems.forEach((item) => {
      const id = movementId(item);
      const name = movementName(item);
      if (id !== null && name) found.set(id, name);
    });
    return [...found].slice(0, 6).map(([id, name]) => ({ id, name }));
  }, [allPreviewItems]);

  const rememberSearch = useCallback((value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    setRecentSearches((current) => {
      const next = [normalized, ...current.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
      void AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const submitSearch = useCallback((value = queryInput) => {
    const normalized = value.trim();
    if (!normalized) return;
    setQueryInput(normalized);
    setCommittedQuery(normalized);
    rememberSearch(normalized);
  }, [queryInput, rememberSearch]);

  const clearSearch = useCallback(() => {
    setQueryInput('');
    setCommittedQuery('');
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setMovementFilter(null);
    setNaturalAlbumFilter(null);
  }, []);

  const openCollection = useCallback((collection: ArchiveCollection) => {
    setScope(collection);
    clearSearch();
    resetFilters();
  }, [clearSearch, resetFilters]);

  const openNaturalAlbum = useCallback((album: NaturalAlbum) => {
    setScope('training');
    clearSearch();
    setFilters(EMPTY_FILTERS);
    setMovementFilter(null);
    setNaturalAlbumFilter(album);
    setToolsOpen(true);
  }, [clearSearch]);

  const openItem = useCallback((item: ArchiveItem) => {
    router.push(archiveDetailHref(item.archive_item_type, item.source_id, {
      collection: scope === 'overview' ? undefined : scope,
      q: committedQuery || undefined,
      athleteId,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }) as never);
  }, [athleteId, committedQuery, filters.dateFrom, filters.dateTo, router, scope]);

  const chooseMovement = useCallback((movement: { id: number; name: string }) => {
    setScope('training');
    setMovementFilter(movement);
    clearSearch();
  }, [clearSearch]);

  const goOverview = useCallback(() => {
    setScope('overview');
    clearSearch();
    resetFilters();
    setFiltersOpen(false);
    setToolsOpen(false);
  }, [clearSearch, resetFilters]);

  return <ArchiveDisplayUnitContext.Provider value={displayUnit}><View style={styles.page} testID="ledger-archive-experience">
    <ArchiveHeading />
    {browsingResults || toolsOpen ? <SearchBar
      filterCount={filterCount}
      filtersOpen={filtersOpen}
      onClear={clearSearch}
      onFilters={() => setFiltersOpen((open) => !open)}
      onSubmit={() => submitSearch()}
      query={queryInput}
      setQuery={setQueryInput}
    /> : null}
    {filtersOpen ? <FilterPanel scope={scope} filters={filters} setFilters={setFilters} onClear={resetFilters} /> : null}
    {movementFilter ? <View style={styles.activeChips}><ActiveChip label={movementFilter.name} onClear={() => setMovementFilter(null)} /></View> : null}
    {naturalAlbumFilter ? <View style={styles.activeChips}><ActiveChip label={naturalAlbumFilter.label} onClear={goOverview} /></View> : null}
    {!browsingResults && toolsOpen && recentSearches.length ? <SuggestionRail label="Recent searches" values={recentSearches} onPress={submitSearch} /> : null}
    {!browsingResults && toolsOpen && movementSuggestions.length ? <MovementRail movements={movementSuggestions} onPress={chooseMovement} /> : null}

    {loading ? <ArchiveState icon="layers-outline" title="Opening your history" body="Gathering preserved training, media, and competition evidence…" loading /> : null}
    {!loading && error ? <ArchiveState
      icon={error.status === 401 || error.status === 403 ? 'lock-closed-outline' : error.status === 404 || error.status === 410 ? 'unlink-outline' : 'alert-circle-outline'}
      title={error.status === 401 || error.status === 403 ? 'Archive access required' : error.status === 404 || error.status === 410 ? 'Archive source unavailable' : 'Archive could not be loaded'}
      body={error.status === 401 || error.status === 403
        ? 'Your session or Archive access could not be verified.'
        : error.status === 404 || error.status === 410
          ? 'The requested source was deleted, invalidated, moved, or is no longer available.'
          : 'We could not load your preserved history. Try again.'}
      action="Try again"
      onAction={() => browsingResults ? void loadResults() : void loadOverview()}
    /> : null}
    {!loading && !error && !browsingResults && landing ? <ArchiveOverview
      landing={landing}
      previews={previews}
      thumbnailUrls={thumbnailUrls}
      onAlbum={openNaturalAlbum}
      onCollection={openCollection}
      onItem={openItem}
      onSearch={() => setToolsOpen((open) => {
        if (open) setFiltersOpen(false);
        return !open;
      })}
    /> : null}
    {!loading && !error && browsingResults ? <ArchiveResults
      collection={scope === 'overview' ? null : scope}
      count={scope === 'overview' ? items.length : landing?.collection_summaries[scope]}
      items={items}
      onBack={goOverview}
      onItem={openItem}
      query={committedQuery}
      thumbnailUrls={thumbnailUrls}
    /> : null}
    {!loading && !error && browsingResults && cursor ? <Pressable disabled={loadingMore} onPress={() => void loadResults(cursor, true)} style={styles.loadMore}>{loadingMore ? <ActivityIndicator color={SLColors.accent} /> : <><Text typographyRole="shortButtonLabel" style={styles.loadMoreText}>Continue through history</Text><Ionicons name="arrow-down" size={16} color={SLColors.accentMuted} /></>}</Pressable> : null}
  </View></ArchiveDisplayUnitContext.Provider>;
}

function archiveFilterWeightKg(value: string, unit: DisplayWeightUnit): string | undefined {
  const input = value.trim();
  if (!input) return undefined;
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return String(convertDisplayWeightValue(parsed, unit, 'kg'));
}

function ArchiveEvidence({ item }: { item: ArchiveItem }) {
  const unit = React.useContext(ArchiveDisplayUnitContext);
  return <>{itemEvidence(item, unit)}</>;
}

function ArchiveHeading() {
  return <View style={styles.heading}>
    <View style={styles.headingSeal}><Ionicons name="archive-outline" size={25} color={SLColors.accentMuted} /></View>
    <View style={styles.headingCopy}>
      <Text typographyRole="pageTitle" style={styles.headingTitle}>Archive</Text>
      <Text typographyRole="body" style={styles.headingBody}>Your training history, kept in context.</Text>
    </View>
  </View>;
}

function SearchBar({ query, setQuery, onSubmit, onClear, filtersOpen, onFilters, filterCount }: {
  query: string;
  setQuery: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  filtersOpen: boolean;
  onFilters: () => void;
  filterCount: number;
}) {
  return <View style={styles.searchShell}>
    <View style={styles.searchRow}>
      <Ionicons name="search" size={19} color={SLColors.iconMuted} />
      <TextInput accessibilityLabel="Search Archive" autoCapitalize="none" onChangeText={setQuery} onSubmitEditing={onSubmit} placeholder="Movement, session, meet, evidence…" placeholderTextColor={SLColors.textMuted} returnKeyType="search" style={styles.searchInput} value={query} />
      {query ? <Pressable accessibilityLabel="Clear Archive search" onPress={onClear} hitSlop={8}><Ionicons name="close-circle" size={20} color={SLColors.iconMuted} /></Pressable> : null}
      <View style={styles.searchDivider} />
      <Pressable accessibilityLabel="Archive filters" accessibilityState={{ expanded: filtersOpen }} onPress={onFilters} style={[styles.filterTrigger, filtersOpen && styles.filterTriggerActive]}>
        <Ionicons name="options-outline" size={19} color={filtersOpen || filterCount ? SLColors.accentMuted : SLColors.iconMuted} />
        {filterCount ? <View style={styles.filterCount}><Text style={styles.filterCountText}>{filterCount}</Text></View> : null}
      </Pressable>
    </View>
  </View>;
}

function SuggestionRail({ label, values, onPress }: { label: string; values: string[]; onPress: (value: string) => void }) {
  return <View style={styles.suggestionBlock}><Text typographyRole="shortTechnicalLabel" style={styles.suggestionLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>{values.map((value) => <Pressable key={value} onPress={() => onPress(value)} style={styles.suggestionChip}><Ionicons name="time-outline" size={14} color={SLColors.iconMuted} /><Text style={styles.suggestionText}>{value}</Text></Pressable>)}</ScrollView></View>;
}

function MovementRail({ movements, onPress }: { movements: { id: number; name: string }[]; onPress: (movement: { id: number; name: string }) => void }) {
  return <View style={styles.suggestionBlock}><Text typographyRole="shortTechnicalLabel" style={styles.suggestionLabel}>Move through your history</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>{movements.map((movement) => <Pressable key={movement.id} onPress={() => onPress(movement)} style={styles.movementChip}><Ionicons name="barbell-outline" size={14} color={SLColors.accentMuted} /><Text style={styles.movementChipText}>{movement.name}</Text></Pressable>)}</ScrollView></View>;
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return <Pressable accessibilityLabel={`Clear ${label} filter`} onPress={onClear} style={styles.activeChip}><Text style={styles.activeChipText}>{label}</Text><Ionicons name="close" size={14} color={SLColors.accentMuted} /></Pressable>;
}

function FilterPanel({ scope, filters, setFilters, onClear }: { scope: ArchiveScope; filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>>; onClear: () => void }) {
  const displayUnit = React.useContext(ArchiveDisplayUnitContext);
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  return <View style={styles.filterPanel} testID="archive-filter-panel">
    <View style={styles.filterPanelHeader}><View><Text typographyRole="cardTitle" style={styles.filterPanelTitle}>Narrow the evidence</Text><Text typographyRole="caption" style={styles.filterPanelCaption}>Filters combine without changing source truth.</Text></View><Pressable onPress={onClear}><Text typographyRole="shortButtonLabel" style={styles.clearFilters}>Clear all</Text></Pressable></View>
    <View style={styles.filterFields}><FilterInput label="From" value={filters.dateFrom} placeholder="YYYY-MM-DD" onChange={(value) => update('dateFrom', value)} /><FilterInput label="To" value={filters.dateTo} placeholder="YYYY-MM-DD" onChange={(value) => update('dateTo', value)} /></View>
    {scope === 'training' ? <>
      <FilterChoice label="Training" values={[['', 'All'], ['core', 'Core'], ['accessory', 'Accessory']]} value={filters.classification} onChange={(value) => update('classification', value as Filters['classification'])} />
      <View style={styles.filterFields}><FilterInput label={`Min ${displayUnit}`} value={filters.weightMin} placeholder="Any" keyboard="decimal-pad" onChange={(value) => update('weightMin', value)} /><FilterInput label="Min reps" value={filters.repsMin} placeholder="Any" keyboard="number-pad" onChange={(value) => update('repsMin', value)} /><FilterInput label="Min RPE" value={filters.rpeMin} placeholder="Any" keyboard="decimal-pad" onChange={(value) => update('rpeMin', value)} /></View>
      <View style={styles.inlineChoices}><ToggleChip label="Has video" active={filters.hasVideo === 'true'} onPress={() => update('hasVideo', filters.hasVideo ? '' : 'true')} /><ToggleChip label="Imported source" active={filters.sourceType === 'historical'} onPress={() => update('sourceType', filters.sourceType ? '' : 'historical')} /></View>
    </> : null}
    {scope === 'media' ? <><FilterChoice label="Media date" values={[["performed", 'Performed'], ["uploaded", 'Uploaded']]} value={filters.dateField} onChange={(value) => update('dateField', value as Filters['dateField'])} /><View style={styles.inlineChoices}><ToggleChip label="Reviewed" active={filters.reviewStatus === 'reviewed'} onPress={() => update('reviewStatus', filters.reviewStatus ? '' : 'reviewed')} /><ToggleChip label="Has feedback" active={filters.hasFeedback === 'true'} onPress={() => update('hasFeedback', filters.hasFeedback ? '' : 'true')} /></View></> : null}
    {scope === 'competition' ? <><View style={styles.filterFields}><FilterInput label="Federation" value={filters.federation} placeholder="Any" onChange={(value) => update('federation', value)} /><FilterInput label="Weight class" value={filters.weightClass} placeholder="Any" onChange={(value) => update('weightClass', value)} /></View><FilterChoice label="Meet status" values={[["", 'All'], ["completed", 'Completed'], ["archived", 'Archived']]} value={filters.meetStatus} onChange={(value) => update('meetStatus', value as Filters['meetStatus'])} /></> : null}
    {scope === 'overview' ? <Text typographyRole="caption" style={styles.filterPanelCaption}>Global search supports date and text here. Open Training, Film, or Competition for source-specific filters.</Text> : null}
  </View>;
}

function FilterInput({ label, value, placeholder, onChange, keyboard = 'default' }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; keyboard?: 'default' | 'decimal-pad' | 'number-pad' }) {
  return <View style={styles.filterField}><Text typographyRole="shortTechnicalLabel" style={styles.filterFieldLabel}>{label}</Text><TextInput accessibilityLabel={`Archive ${label} filter`} keyboardType={keyboard} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={SLColors.textMuted} style={styles.filterInput} value={value} /></View>;
}

function FilterChoice({ label, values, value, onChange }: { label: string; values: [string, string][]; value: string; onChange: (value: string) => void }) {
  return <View style={styles.filterChoice}><Text typographyRole="shortTechnicalLabel" style={styles.filterFieldLabel}>{label}</Text><View style={styles.inlineChoices}>{values.map(([key, text]) => <ToggleChip key={key || 'all'} label={text} active={value === key} onPress={() => onChange(key)} />)}</View></View>;
}

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityState={{ selected: active }} onPress={onPress} style={[styles.toggleChip, active && styles.toggleChipActive]}><Text style={[styles.toggleChipText, active && styles.toggleChipTextActive]}>{label}</Text></Pressable>;
}

function ArchiveOverview({ landing, previews, thumbnailUrls, onAlbum, onCollection, onItem, onSearch }: {
  landing: ArchiveLanding;
  previews: PreviewPages;
  thumbnailUrls: Record<number, string>;
  onAlbum: (album: NaturalAlbum) => void;
  onCollection: (collection: ArchiveCollection) => void;
  onItem: (item: ArchiveItem) => void;
  onSearch: () => void;
}) {
  const sessions = (previews.training?.items || []).filter((item) => item.archive_item_type === 'session');
  const videos = previews.media?.items || [];
  const lead = sessions[0] || landing.recent[0];
  const supportingSessions = sessions.filter((item) => item.source_id !== lead?.source_id).slice(0, 5);
  const rediscovered = landing.rediscovery[0];
  const albums = naturalAlbumsFromSessions(sessions);
  const leadVideo = lead?.archive_item_type === 'session'
    ? videos.find((video) => Number(video.media?.workout_id) === lead.source_id)
    : lead?.archive_item_type === 'video' ? lead : undefined;
  const leadThumbnail = leadVideo ? thumbnailUrls[leadVideo.source_id] : undefined;
  return <View style={styles.overview}>
    {lead ? <>
      <SectionLabel icon="time-outline" action={dateLabel(lead.occurred_on)}>Latest from your record</SectionLabel>
      <FeaturedEvidence item={lead} thumbnailUrl={leadThumbnail} onPress={() => onItem(lead)} />
    </> : null}
    {supportingSessions.length ? <>
      <SectionLabel icon="calendar-outline" action="All sessions">Recent sessions</SectionLabel>
      <SessionShelf items={supportingSessions} onItem={onItem} onAll={() => onCollection('training')} />
    </> : null}
    {videos.length ? <>
      <SectionLabel icon="film-outline" action="Watch all">Lift film</SectionLabel>
      <MediaShelf items={videos} thumbnailUrls={thumbnailUrls} onItem={onItem} onAll={() => onCollection('media')} />
    </> : null}
    {albums.length ? <>
      <SectionLabel icon="albums-outline" action="Program → block → session">Training albums</SectionLabel>
      <NaturalAlbumShelf albums={albums} onPress={onAlbum} />
    </> : null}
    {rediscovered ? <>
      <SectionLabel icon="compass-outline" action="From deeper in your history">Rediscovered</SectionLabel>
      <RediscoveredEvidence item={rediscovered} onPress={() => onItem(rediscovered)} />
    </> : null}
    {previews.competition?.items.length ? <>
      <SectionLabel icon="trophy-outline" action="Open competition book">Competition book</SectionLabel>
      <CompetitionShelf items={previews.competition.items} onItem={onItem} onAll={() => onCollection('competition')} />
    </> : null}
    {!lead && !previews.training?.items.length && !previews.media?.items.length && !previews.competition?.items.length ? <ArchiveState icon="archive-outline" title="Your history starts here" body="Completed training, preserved video, and competition evidence will collect here without becoming a loose file pile." /> : null}
    <ArchiveTools summaries={landing.collection_summaries} onCollection={onCollection} onSearch={onSearch} />
  </View>;
}

function ArchiveTools({ summaries, onCollection, onSearch }: { summaries: Record<ArchiveCollection, number>; onCollection: (collection: ArchiveCollection) => void; onSearch: () => void }) {
  return <View style={styles.archiveTools}>
    <SectionLabel icon="options-outline" action="Secondary tools">Find something specific</SectionLabel>
    <Pressable accessibilityRole="button" onPress={onSearch} style={({ pressed }) => [styles.searchTool, pressed && styles.pressed]}>
      <Ionicons name="search" size={20} color={SLColors.iconPrimary} />
      <View style={styles.searchToolCopy}><Text typographyRole="bodyStrong" style={styles.searchToolTitle}>Search your Archive</Text><Text typographyRole="caption" style={styles.searchToolBody}>Movement, date, meet, load, or preserved evidence</Text></View>
      <Ionicons name="chevron-down" size={17} color={SLColors.iconMuted} />
    </Pressable>
    <CollectionIndex summaries={summaries} onPress={onCollection} />
  </View>;
}

function naturalAlbumsFromSessions(sessions: ArchiveItem[]): NaturalAlbum[] {
  const albums = new Map<string, NaturalAlbum>();
  sessions.forEach((session) => {
    const blockId = Number(session.program_context?.block_id);
    const programId = Number(session.program_context?.program_id);
    const blockName = session.program_context?.block_name;
    const programName = session.program_context?.program_name;
    if (Number.isInteger(blockId) && typeof blockName === 'string' && blockName.trim()) {
      albums.set(`block:${blockId}`, {
        key: `block:${blockId}`,
        label: blockName.trim(),
        blockId,
        programId: Number.isInteger(programId) ? programId : undefined,
        programName: typeof programName === 'string' ? programName : undefined,
      });
    } else if (Number.isInteger(programId) && typeof programName === 'string' && programName.trim()) {
      albums.set(`program:${programId}`, { key: `program:${programId}`, label: programName.trim(), programId });
    }
  });
  return [...albums.values()].slice(0, 6);
}

function NaturalAlbumShelf({ albums, onPress }: { albums: NaturalAlbum[]; onPress: (album: NaturalAlbum) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumRail}>
    {albums.map((album) => <Pressable key={album.key} onPress={() => onPress(album)} style={({ pressed }) => [styles.album, pressed && styles.pressed]}>
      <View style={styles.albumCover}><Ionicons name="albums-outline" size={25} color={SLColors.accentMuted} /></View>
      <Text typographyRole="bodyStrong" numberOfLines={2} style={styles.albumTitle}>{album.label}</Text>
      <Text typographyRole="caption" numberOfLines={1} style={styles.albumMeta}>{album.programName || 'Training program'}</Text>
    </Pressable>)}
  </ScrollView>;
}

function CollectionIndex({ summaries, onPress }: { summaries: Record<ArchiveCollection, number>; onPress: (collection: ArchiveCollection) => void }) {
  return <View style={styles.collectionIndex}>
    <View style={styles.collectionIndexCopy}><Text typographyRole="sectionTitle" style={styles.collectionIndexTitle}>Collections</Text><Text typographyRole="caption" style={styles.collectionIndexBody}>Browse the source record by type.</Text></View>
    <View style={styles.collectionLanes}>{COLLECTIONS.map((collection) => { const meta = COLLECTION_META[collection]; return <Pressable key={collection} onPress={() => onPress(collection)} style={({ pressed }) => [styles.collectionLane, pressed && styles.pressed]}><View style={[styles.collectionLaneIcon, { borderColor: `${meta.tone}66` }]}><SLCanonicalIcon name={meta.icon} size={17} color={meta.tone} trophyTier="bronze" /></View><View style={styles.collectionLaneCopy}><Text typographyRole="bodyStrong" style={styles.collectionLaneTitle}>{meta.label}</Text><Text typographyRole="caption" style={styles.collectionLaneDescription}>{meta.description}</Text></View><Text typographyRole="numeric" style={[styles.collectionLaneCount, { color: meta.tone }]}>{compactNumber(summaries[collection])}</Text><Ionicons name="chevron-forward" size={16} color={SLColors.iconMuted} /></Pressable>; })}</View>
  </View>;
}

function FeaturedEvidence({ item, thumbnailUrl, onPress }: { item: ArchiveItem; thumbnailUrl?: string; onPress: () => void }) {
  const tone = itemTone(item);
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.featured, pressed && styles.pressed]}>
    {thumbnailUrl ? <View style={styles.featuredMedia}>
      <Image accessibilityIgnoresInvertColors source={{ uri: thumbnailUrl }} resizeMode="cover" style={styles.featuredImage} />
      <View style={styles.featuredScrim} />
      <View style={styles.featuredMediaBadge}><Ionicons name="play" size={18} color={SLColors.textStrong} /></View>
    </View> : null}
    <View style={styles.featuredTop}><View style={[styles.featuredIcon, { borderColor: `${tone}77` }]}><SLCanonicalIcon name={itemIcon(item)} size={24} color={tone} trophyTier="bronze" /></View><View style={styles.featuredCopy}><Text typographyRole="shortTechnicalLabel" style={[styles.provenance, { color: tone }]}>{item.provenance_label || item.source_type}</Text><Text typographyRole="modalTitle" style={styles.featuredTitle}>{item.title}</Text>{item.subtitle ? <Text typographyRole="body" style={styles.featuredSubtitle}>{item.subtitle}</Text> : null}</View><Ionicons name="arrow-forward" size={20} color={SLColors.iconMuted} /></View>
    <View style={styles.featuredBottom}><Text typographyRole="bodyStrong" style={styles.featuredEvidence}><ArchiveEvidence item={item} /></Text><Text typographyRole="caption" style={styles.featuredDate}>{dateLabel(item.occurred_on)}</Text></View>
  </Pressable>;
}

function sessionContext(item: ArchiveItem): string | null {
  const program = item.program_context?.program_name;
  const block = item.program_context?.block_name;
  const values = [program, block].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  return values.length ? values.join(' · ') : null;
}

function videoCount(item: ArchiveItem): number {
  const count = item.media?.video_count;
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

function SessionShelf({ items, onItem, onAll }: { items: ArchiveItem[]; onItem: (item: ArchiveItem) => void; onAll: () => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionRail}>
    {items.map((item) => {
      const context = sessionContext(item);
      const videos = videoCount(item);
      return <Pressable key={item.source_id} onPress={() => onItem(item)} style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}>
        <View style={styles.sessionCardTop}><Text typographyRole="shortTechnicalLabel" style={styles.sessionDate}>{dateLabel(item.occurred_on)}</Text><Ionicons name="arrow-forward" size={17} color={SLColors.iconMuted} /></View>
        <Text typographyRole="cardTitle" numberOfLines={2} style={styles.sessionTitle}>{item.title}</Text>
        {item.subtitle ? <Text typographyRole="caption" numberOfLines={2} style={styles.sessionSubtitle}>{item.subtitle}</Text> : null}
        <View style={styles.sessionEvidence}><Text typographyRole="bodyStrong" style={styles.sessionEvidenceText}><ArchiveEvidence item={item} /></Text>{videos ? <View style={styles.sessionVideoCount}><Ionicons name="videocam-outline" size={14} color={COLLECTION_META.media.tone} /><Text typographyRole="caption" style={styles.sessionVideoCountText}>{videos}</Text></View> : null}</View>
        {context ? <Text typographyRole="caption" numberOfLines={1} style={styles.sessionContext}>{context}</Text> : null}
      </Pressable>;
    })}
    <Pressable onPress={onAll} style={[styles.shelfMore, styles.sessionMore]}><Ionicons name="arrow-forward" size={23} color={COLLECTION_META.training.tone} /><Text typographyRole="bodyStrong" style={styles.shelfMoreText}>All sessions</Text></Pressable>
  </ScrollView>;
}

function CompactEvidence({ item, onPress }: { item: ArchiveItem; onPress: () => void }) {
  const tone = itemTone(item);
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.compactEvidence, pressed && styles.pressed]}><View style={[styles.compactDot, { backgroundColor: tone }]} /><View style={styles.compactCopy}><Text typographyRole="bodyStrong" style={styles.compactTitle}>{item.title}</Text><Text typographyRole="caption" style={styles.compactMeta}><ArchiveEvidence item={item} /> · {dateLabel(item.occurred_on)}</Text></View><Ionicons name="chevron-forward" size={16} color={SLColors.iconMuted} /></Pressable>;
}

function MediaStage({ item, thumbnailUrl, grid = false }: { item: ArchiveItem; thumbnailUrl?: string; grid?: boolean }) {
  return <View style={grid ? styles.mediaGridStage : styles.mediaStage}>
    {thumbnailUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: thumbnailUrl }} resizeMode="cover" style={styles.mediaImage} /> : <View style={styles.mediaUnavailable}><Ionicons name="videocam-outline" size={25} color={SLColors.iconMuted} /><Text typographyRole="caption" style={styles.mediaUnavailableText}>Preview unavailable</Text></View>}
    {thumbnailUrl ? <View style={styles.mediaImageScrim} /> : null}
    <View style={grid ? styles.mediaGridPlay : styles.mediaPlay}><Ionicons name="play" size={grid ? 18 : 20} color={SLColors.textStrong} /></View>
    <Text typographyRole="shortTechnicalLabel" style={grid ? styles.mediaGridBadge : styles.mediaStageLabel}>{item.status || 'preserved'}</Text>
  </View>;
}

function MediaShelf({ items, thumbnailUrls, onItem, onAll }: { items: ArchiveItem[]; thumbnailUrls: Record<number, string>; onItem: (item: ArchiveItem) => void; onAll: () => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRail}>{items.slice(0, 6).map((item) => <Pressable key={item.source_id} onPress={() => onItem(item)} style={({ pressed }) => [styles.mediaTile, pressed && styles.pressed]}><MediaStage item={item} thumbnailUrl={thumbnailUrls[item.source_id]} /><Text typographyRole="bodyStrong" style={styles.mediaTitle}>{item.title}</Text><Text typographyRole="caption" style={styles.mediaMeta}><ArchiveEvidence item={item} /></Text>{item.subtitle ? <Text typographyRole="caption" numberOfLines={1} style={styles.mediaSession}>{item.subtitle}</Text> : null}<Text typographyRole="caption" style={styles.mediaDate}>{dateLabel(item.occurred_on)}</Text></Pressable>)}<Pressable onPress={onAll} style={styles.shelfMore}><Ionicons name="arrow-forward" size={23} color={COLLECTION_META.media.tone} /><Text typographyRole="bodyStrong" style={styles.shelfMoreText}>All film</Text></Pressable></ScrollView>;
}

function YearChronology({ items, onItem }: { items: ArchiveItem[]; onItem: (item: ArchiveItem) => void }) {
  const groups = groupByYear(items);
  return <View style={styles.chronology}>{groups.map(([year, yearItems]) => <View key={year} style={styles.yearGroup}><View style={styles.yearMarker}><Text typographyRole="milestoneThreshold" style={styles.yearText}>{year}</Text><View style={styles.yearLine} /></View><View style={styles.yearItems}>{yearItems.map((item) => <TrainingRecord key={`${item.archive_item_type}:${item.source_id}`} item={item} onPress={() => onItem(item)} />)}</View></View>)}</View>;
}

function TrainingRecord({ item, onPress }: { item: ArchiveItem; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.trainingRecord, pressed && styles.pressed]}><View style={styles.trainingDate}><Text typographyRole="shortTechnicalLabel" style={styles.trainingMonth}>{dateLabel(item.occurred_on).split(' ')[0]}</Text><Text typographyRole="numeric" style={styles.trainingDay}>{item.occurred_on?.slice(8, 10).replace(/^0/, '') || '—'}</Text></View><View style={styles.trainingCopy}><Text typographyRole="bodyStrong" style={styles.trainingTitle}>{item.title}</Text><Text typographyRole="caption" style={styles.trainingMeta}><ArchiveEvidence item={item} /></Text>{item.program_context?.program_name ? <Text typographyRole="caption" style={styles.trainingContext}>{String(item.program_context.program_name)}</Text> : null}</View><Ionicons name="arrow-forward" size={16} color={SLColors.iconMuted} /></Pressable>;
}

function CompetitionShelf({ items, onItem, onAll }: { items: ArchiveItem[]; onItem: (item: ArchiveItem) => void; onAll: () => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.competitionRail}>{items.slice(0, 5).map((item) => <Pressable key={item.source_id} onPress={() => onItem(item)} style={({ pressed }) => [styles.meetCard, pressed && styles.pressed]}><View style={styles.meetTop}><View style={styles.meetSeal}><SLTrophy size={20} tier="bronze" /></View><Text typographyRole="shortTechnicalLabel" style={styles.meetStatus}>{item.status}</Text></View><Text typographyRole="cardTitle" style={styles.meetTitle}>{item.title}</Text>{item.subtitle ? <Text typographyRole="caption" style={styles.meetSubtitle}>{item.subtitle}</Text> : null}<View style={styles.meetBottom}><Text typographyRole="bodyStrong" style={styles.meetEvidence}><ArchiveEvidence item={item} /></Text><Text typographyRole="caption" style={styles.meetDate}>{dateLabel(item.occurred_on)}</Text></View></Pressable>)}<Pressable onPress={onAll} style={styles.shelfMore}><Ionicons name="arrow-forward" size={23} color={COLLECTION_META.competition.tone} /><Text typographyRole="bodyStrong" style={styles.shelfMoreText}>All meets</Text></Pressable></ScrollView>;
}

function RediscoveredEvidence({ item, onPress }: { item: ArchiveItem; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.rediscovered, pressed && styles.pressed]}><View style={styles.rediscoveredDate}><Text typographyRole="numeric" style={styles.rediscoveredYear}>{yearLabel(item.occurred_on)}</Text><Text typographyRole="shortTechnicalLabel" style={styles.rediscoveredLabel}>from the archive</Text></View><View style={styles.rediscoveredCopy}><Text typographyRole="cardTitle" style={styles.rediscoveredTitle}>{item.title}</Text><Text typographyRole="body" style={styles.rediscoveredBody}><ArchiveEvidence item={item} /></Text><Text typographyRole="caption" style={styles.rediscoveredMeta}>{dateLabel(item.occurred_on)} · {item.provenance_label}</Text></View><Ionicons name="arrow-forward" size={18} color={SLColors.iconMuted} /></Pressable>;
}

function ArchiveResults({ collection, count, items, query, thumbnailUrls, onBack, onItem }: { collection: ArchiveCollection | null; count?: number; items: ArchiveItem[]; query: string; thumbnailUrls: Record<number, string>; onBack: () => void; onItem: (item: ArchiveItem) => void }) {
  const meta = collection ? COLLECTION_META[collection] : null;
  return <View style={styles.results}>
    <View style={styles.resultsHeader}><Pressable accessibilityLabel="Back to Archive overview" onPress={onBack} style={styles.resultsBack}><Ionicons name="chevron-back" size={18} color={SLColors.iconPrimary} /></Pressable><View style={styles.resultsHeaderCopy}><Text typographyRole="sectionTitle" style={styles.resultsTitle}>{query ? `“${query}”` : meta?.label || 'All evidence'}</Text><Text typographyRole="caption" style={styles.resultsCaption}>{items.length ? `${count ?? items.length} ${collection ? meta?.singular : 'matching sources'}${(count ?? items.length) === 1 ? '' : 's'}` : 'No matching source evidence'}</Text></View>{meta ? <View style={[styles.resultsIcon, { borderColor: `${meta.tone}55` }]}><SLCanonicalIcon name={meta.icon} size={19} color={meta.tone} trophyTier="bronze" /></View> : null}</View>
    {!items.length ? <ArchiveState icon="search-outline" title="Nothing matches yet" body="Clear a filter, widen the date range, or search another movement. The Archive will not invent evidence that is not present." /> : null}
    {items.length && collection === 'media' ? <MediaGrid items={items} thumbnailUrls={thumbnailUrls} onItem={onItem} /> : null}
    {items.length && collection === 'competition' ? <CompetitionList items={items} onItem={onItem} /> : null}
    {items.length && collection === 'training' ? <YearChronology items={items} onItem={onItem} /> : null}
    {items.length && !collection ? <GroupedSearchResults items={items} onItem={onItem} /> : null}
  </View>;
}

function MediaGrid({ items, thumbnailUrls, onItem }: { items: ArchiveItem[]; thumbnailUrls: Record<number, string>; onItem: (item: ArchiveItem) => void }) {
  return <View style={styles.mediaGrid}>{items.map((item) => <Pressable key={item.source_id} onPress={() => onItem(item)} style={({ pressed }) => [styles.mediaGridItem, pressed && styles.pressed]}><MediaStage item={item} thumbnailUrl={thumbnailUrls[item.source_id]} grid /><Text typographyRole="bodyStrong" style={styles.mediaGridTitle}>{item.title}</Text><Text typographyRole="caption" style={styles.mediaGridMeta}><ArchiveEvidence item={item} /></Text>{item.subtitle ? <Text typographyRole="caption" numberOfLines={1} style={styles.mediaSession}>{item.subtitle}</Text> : null}<Text typographyRole="caption" style={styles.mediaGridDate}>{dateLabel(item.occurred_on)}</Text></Pressable>)}</View>;
}

function CompetitionList({ items, onItem }: { items: ArchiveItem[]; onItem: (item: ArchiveItem) => void }) {
  return <View style={styles.competitionList}>{items.map((item) => <Pressable key={item.source_id} onPress={() => onItem(item)} style={({ pressed }) => [styles.competitionRecord, pressed && styles.pressed]}><View style={styles.competitionDate}><Text typographyRole="numeric" style={styles.competitionYear}>{yearLabel(item.occurred_on)}</Text><Text typographyRole="caption" style={styles.competitionMonth}>{dateLabel(item.occurred_on).replace(` ${yearLabel(item.occurred_on)}`, '')}</Text></View><View style={styles.competitionSpine}><View style={styles.competitionDot} /><View style={styles.competitionLine} /></View><View style={styles.competitionCopy}><Text typographyRole="shortTechnicalLabel" style={styles.meetStatus}>{item.status || 'recorded'}</Text><Text typographyRole="cardTitle" style={styles.competitionTitle}>{item.title}</Text>{item.subtitle ? <Text typographyRole="caption" style={styles.competitionSubtitle}>{item.subtitle}</Text> : null}<Text typographyRole="bodyStrong" style={styles.competitionEvidence}><ArchiveEvidence item={item} /></Text></View><Ionicons name="chevron-forward" size={17} color={SLColors.iconMuted} /></Pressable>)}</View>;
}

function GroupedSearchResults({ items, onItem }: { items: ArchiveItem[]; onItem: (item: ArchiveItem) => void }) {
  const groups = groupByType(items);
  return <View style={styles.searchGroups}>{groups.map(([type, groupItems]) => <View key={type} style={styles.searchGroup}><View style={styles.searchGroupHeading}><Text typographyRole="shortTechnicalLabel" style={styles.searchGroupTitle}>{type}</Text><Text typographyRole="caption" style={styles.searchGroupCount}>{groupItems.length}</Text></View>{groupItems.map((item) => <CompactEvidence key={`${item.archive_item_type}:${item.source_id}`} item={item} onPress={() => onItem(item)} />)}</View>)}</View>;
}

function ArchiveState({ icon, title, body, loading = false, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; loading?: boolean; action?: string; onAction?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator color={SLColors.accent} /> : <View style={styles.stateIcon}><Ionicons name={icon} size={27} color={SLColors.accentMuted} /></View>}<Text typographyRole="emptyStateTitle" style={styles.stateTitle}>{title}</Text><Text typographyRole="emptyStateBody" style={styles.stateBody}>{body}</Text>{action && onAction ? <Pressable onPress={onAction} style={styles.stateAction}><Text typographyRole="shortButtonLabel" style={styles.stateActionText}>{action}</Text></Pressable> : null}</View>;
}

function archiveFailure(caught: unknown): ArchiveFailure {
  if (caught instanceof ArchiveRequestError) return { status: caught.status, detail: caught.message };
  if (caught instanceof Error) return { detail: caught.message };
  return { detail: 'Archive could not be loaded.' };
}

function groupByYear(items: ArchiveItem[]): [string, ArchiveItem[]][] {
  const groups = new Map<string, ArchiveItem[]>();
  items.forEach((item) => { const year = yearLabel(item.occurred_on); groups.set(year, [...(groups.get(year) || []), item]); });
  return [...groups.entries()];
}

function groupByType(items: ArchiveItem[]): [string, ArchiveItem[]][] {
  const label: Record<ArchiveItem['archive_item_type'], string> = { session: 'Sessions', set: 'Performed sets', video: 'Film', meet: 'Competition', movement: 'Movements', historical_performance: 'Imported history' };
  const groups = new Map<string, ArchiveItem[]>();
  items.forEach((item) => { const key = label[item.archive_item_type]; groups.set(key, [...(groups.get(key) || []), item]); });
  return [...groups.entries()];
}

const styles = StyleSheet.create({
  page: { gap: SLSpacing.lg, paddingBottom: SLSpacing.xl },
  heading: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingSeal: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected },
  headingCopy: { flex: 1, minWidth: 0, gap: 3 },
  headingTitle: { color: SLColors.textStrong },
  headingBody: { color: SLColors.textSecondary },
  searchShell: { borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.borderDefault, overflow: 'hidden' },
  searchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 7 },
  searchInput: { flex: 1, minHeight: 50, color: SLColors.textPrimary, fontSize: 15 },
  searchDivider: { width: StyleSheet.hairlineWidth, height: 25, backgroundColor: SLColors.borderDefault },
  filterTrigger: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterTriggerActive: { backgroundColor: SLColors.surfaceSelected },
  filterCount: { position: 'absolute', right: 1, top: 1, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.accent },
  filterCountText: { color: SLColors.textInverted, fontSize: 9, fontFamily: SLFontFamilies.bodySemiBold },
  suggestionBlock: { gap: 7 },
  suggestionLabel: { color: SLColors.textMuted, textTransform: 'uppercase', letterSpacing: 0.9 },
  chipRail: { gap: 8, paddingRight: 16 },
  suggestionChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 18, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  suggestionText: { color: SLColors.textSecondary, fontSize: 13 },
  movementChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 19, backgroundColor: SLColors.surfaceSelected, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSelected },
  movementChipText: { color: SLColors.textPrimary, fontSize: 13 },
  activeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activeChip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 17, backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected },
  activeChipText: { color: SLColors.accentMuted, fontSize: 12 },
  filterPanel: { gap: 14, padding: 16, borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  filterPanelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  filterPanelTitle: { color: SLColors.textStrong },
  filterPanelCaption: { color: SLColors.textMuted },
  clearFilters: { color: SLColors.accentMuted },
  filterFields: { flexDirection: 'row', gap: 10 },
  filterField: { flex: 1, minWidth: 0, gap: 5 },
  filterFieldLabel: { color: SLColors.textMuted, textTransform: 'uppercase' },
  filterInput: { minHeight: 42, borderRadius: SLRadius.radiusControl, paddingHorizontal: 11, backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, color: SLColors.textPrimary },
  filterChoice: { gap: 7 },
  inlineChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  toggleChip: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 18, backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  toggleChipActive: { backgroundColor: SLColors.surfaceSelected, borderColor: SLColors.borderSelected },
  toggleChipText: { color: SLColors.textMuted, fontSize: 12 },
  toggleChipTextActive: { color: SLColors.accentMuted },
  overview: { gap: SLSpacing.md },
  archiveTools: { gap: 10, marginTop: SLSpacing.sm, paddingTop: SLSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.divider },
  searchTool: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  searchToolCopy: { flex: 1, minWidth: 0, gap: 2 },
  searchToolTitle: { color: SLColors.textStrong },
  searchToolBody: { color: SLColors.textMuted },
  collectionIndex: { overflow: 'hidden', borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  collectionIndexCopy: { gap: 3, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 10 },
  collectionIndexTitle: { color: SLColors.textStrong },
  collectionIndexBody: { color: SLColors.textMuted },
  collectionLanes: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.divider },
  collectionLane: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider },
  collectionLaneIcon: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceFlat, borderWidth: 1 },
  collectionLaneCopy: { flex: 1, minWidth: 0, gap: 2 },
  collectionLaneTitle: { color: SLColors.textStrong },
  collectionLaneDescription: { color: SLColors.textMuted },
  collectionLaneCount: { color: SLColors.textStrong, fontSize: 17 },
  featured: { overflow: 'hidden', borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceRaised, borderWidth: 1, borderColor: SLColors.borderDefault },
  featuredMedia: { height: 192, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceInset },
  featuredImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  featuredScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,7,12,0.22)' },
  featuredMediaBadge: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,8,13,0.74)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.48)' },
  featuredTop: { minHeight: 132, flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 18 },
  featuredIcon: { width: 49, height: 49, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceInset, borderWidth: 1 },
  featuredCopy: { flex: 1, minWidth: 0, gap: 5 },
  provenance: { color: SLColors.accentMuted, textTransform: 'uppercase', letterSpacing: 0.9 },
  featuredTitle: { color: SLColors.textStrong },
  featuredSubtitle: { color: SLColors.textSecondary },
  featuredBottom: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.divider, backgroundColor: SLColors.surfaceInset },
  featuredEvidence: { flex: 1, minWidth: 0, color: SLColors.textPrimary },
  featuredDate: { color: SLColors.textMuted },
  sessionRail: { gap: 11, paddingRight: 18 },
  sessionCard: { width: 260, minHeight: 184, gap: 7, padding: 16, borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  sessionCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sessionDate: { color: SLColors.accentMuted, textTransform: 'uppercase' },
  sessionTitle: { color: SLColors.textStrong },
  sessionSubtitle: { color: SLColors.textSecondary },
  sessionEvidence: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.divider },
  sessionEvidenceText: { flex: 1, minWidth: 0, color: SLColors.textPrimary },
  sessionVideoCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionVideoCountText: { color: COLLECTION_META.media.tone },
  sessionContext: { color: SLColors.textMuted },
  sessionMore: { minHeight: 184 },
  compactEvidence: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, backgroundColor: SLColors.surfaceInset, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider },
  compactDot: { width: 7, height: 7, borderRadius: 4 },
  compactCopy: { flex: 1, minWidth: 0, gap: 3 },
  compactTitle: { color: SLColors.textStrong },
  compactMeta: { color: SLColors.textMuted },
  mediaRail: { gap: 11, paddingRight: 18 },
  mediaTile: { width: 214, gap: 5 },
  mediaStage: { height: 138, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderRadius: SLRadius.radiusControl, backgroundColor: '#101821', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(94,215,202,0.35)' },
  mediaImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  mediaImageScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,12,0.16)' },
  mediaUnavailable: { alignItems: 'center', gap: 6 },
  mediaUnavailableText: { color: SLColors.textMuted },
  mediaPlay: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,10,14,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  mediaStageLabel: { position: 'absolute', left: 10, bottom: 8, color: '#A7DDD7', textTransform: 'uppercase' },
  mediaTitle: { color: SLColors.textStrong },
  mediaMeta: { color: SLColors.textSecondary },
  mediaSession: { color: SLColors.textMuted },
  mediaDate: { color: SLColors.textMuted },
  shelfMore: { width: 88, minHeight: 116, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  shelfMoreText: { color: SLColors.textSecondary, textAlign: 'center' },
  albumRail: { gap: 11, paddingRight: 18 },
  album: { width: 164, minHeight: 166, gap: 7, padding: 13, borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  albumCover: { flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceSelected, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSelected },
  albumTitle: { color: SLColors.textStrong },
  albumMeta: { color: SLColors.textMuted },
  chronology: { gap: 20 },
  yearGroup: { gap: 10 },
  yearMarker: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearText: { color: SLColors.textSecondary },
  yearLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: SLColors.divider },
  yearItems: { overflow: 'hidden', borderRadius: SLRadius.radiusControl, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  trainingRecord: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, backgroundColor: SLColors.surfaceInset, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider },
  trainingDate: { width: 43, alignItems: 'center', gap: 0 },
  trainingMonth: { color: SLColors.accentMuted, textTransform: 'uppercase' },
  trainingDay: { color: SLColors.textStrong, fontSize: 19 },
  trainingCopy: { flex: 1, minWidth: 0, gap: 3 },
  trainingTitle: { color: SLColors.textStrong },
  trainingMeta: { color: SLColors.textSecondary },
  trainingContext: { color: SLColors.textMuted },
  competitionRail: { gap: 11, paddingRight: 18 },
  meetCard: { width: 232, minHeight: 190, gap: 7, padding: 15, borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(212,173,98,0.40)' },
  meetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meetSeal: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,173,98,0.08)', borderWidth: 1, borderColor: 'rgba(212,173,98,0.45)' },
  meetStatus: { color: COLLECTION_META.competition.tone, textTransform: 'uppercase' },
  meetTitle: { color: SLColors.textStrong },
  meetSubtitle: { color: SLColors.textSecondary },
  meetBottom: { marginTop: 'auto', gap: 3, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.divider },
  meetEvidence: { color: SLColors.textPrimary },
  meetDate: { color: SLColors.textMuted },
  rediscovered: { minHeight: 120, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  rediscoveredDate: { width: 73, gap: 3 },
  rediscoveredYear: { color: SLColors.accentMuted, fontSize: 20 },
  rediscoveredLabel: { color: SLColors.textMuted, textTransform: 'uppercase' },
  rediscoveredCopy: { flex: 1, minWidth: 0, gap: 4 },
  rediscoveredTitle: { color: SLColors.textStrong },
  rediscoveredBody: { color: SLColors.textSecondary },
  rediscoveredMeta: { color: SLColors.textMuted },
  results: { gap: 15 },
  resultsHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 },
  resultsBack: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  resultsHeaderCopy: { flex: 1, minWidth: 0 },
  resultsTitle: { color: SLColors.textStrong },
  resultsCaption: { color: SLColors.textMuted },
  resultsIcon: { width: 41, height: 41, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceInset, borderWidth: 1 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mediaGridItem: { flexBasis: '47%', flexGrow: 1, maxWidth: '50%', gap: 5 },
  mediaGridStage: { height: 112, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.radiusControl, backgroundColor: '#101821', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(94,215,202,0.34)' },
  mediaGridPlay: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,8,12,0.74)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  mediaGridBadge: { position: 'absolute', left: 8, bottom: 7, color: '#9FDAD3', textTransform: 'uppercase' },
  mediaGridTitle: { color: SLColors.textStrong },
  mediaGridMeta: { color: SLColors.textSecondary },
  mediaGridDate: { color: SLColors.textMuted },
  competitionList: { gap: 0 },
  competitionRecord: { minHeight: 126, flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  competitionDate: { width: 58, paddingTop: 16, alignItems: 'flex-end' },
  competitionYear: { color: SLColors.textSecondary, fontSize: 15 },
  competitionMonth: { color: SLColors.textMuted, textAlign: 'right' },
  competitionSpine: { width: 15, alignItems: 'center' },
  competitionDot: { zIndex: 1, width: 11, height: 11, marginTop: 22, borderRadius: 6, backgroundColor: COLLECTION_META.competition.tone, borderWidth: 2, borderColor: SLColors.canvas },
  competitionLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(212,173,98,0.32)' },
  competitionCopy: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider },
  competitionTitle: { color: SLColors.textStrong },
  competitionSubtitle: { color: SLColors.textSecondary },
  competitionEvidence: { color: SLColors.textPrimary },
  searchGroups: { gap: 20 },
  searchGroup: { gap: 8 },
  searchGroupHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  searchGroupTitle: { color: SLColors.accentMuted, textTransform: 'uppercase' },
  searchGroupCount: { color: SLColors.textMuted },
  state: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 26, borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  stateIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceSelected, borderWidth: 1, borderColor: SLColors.borderSelected },
  stateTitle: { color: SLColors.textStrong, textAlign: 'center' },
  stateBody: { maxWidth: 420, color: SLColors.textSecondary, textAlign: 'center' },
  stateAction: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceSelected },
  stateActionText: { color: SLColors.accentMuted },
  loadMore: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: SLRadius.radiusControl, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat },
  loadMoreText: { color: SLColors.accentMuted },
  pressed: { opacity: 0.74, transform: [{ scale: 0.988 }] },
});
