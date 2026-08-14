import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLRadius, SLTypography } from '@/constants/theme';
import {
  parseYmd,
  toYmd,
  type AthleteCalendarAction,
  type AthleteCalendarDay,
  type AthleteCalendarDayDetail,
  type AthleteCalendarDayDetailSession,
  type AthleteCalendarExperienceData,
  type AthleteCalendarMonthSummary,
  type AthleteCalendarPersonalEvent,
  type AthleteCalendarRange,
} from '@/components/calendar/AthleteCalendarExperience';
import { primaryCalendarDayTone, resolveCalendarLensState } from '@/lib/athlete-calendar-lens';
import { resolveCalendarSessionStatus } from '@/lib/calendar-session-status';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TRAINING_ART = require('@/assets/images/gym_vibe.jpg');
const RECOVERY_ART = require('@/assets/images/gym_vibe.jpg');

type FilterId = 'sessions' | 'personal' | 'completed' | 'attention';

type Props = {
  anchorMonth: Date;
  data: AthleteCalendarExperienceData;
  onAction: (action: AthleteCalendarAction) => void;
  onMonthChange: (month: Date) => void;
  onToday: () => string | void;
  canManagePersonalEvents?: boolean;
  onLoadMore?: () => void;
  onLoadPrevious?: () => void;
  loadingMore?: boolean;
  loadingPrevious?: boolean;
  paginationError?: string | null;
  onRetryLoadMore?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  navigationRevision?: number;
  dayDetail?: AthleteCalendarDayDetail | null;
  dayDetailError?: string | null;
  dayDetailLoading?: boolean;
  onRetryDayDetail?: () => void;
  onSelectedDateChange?: (date: string) => void;
  selectedDate: string;
  initialLensVisible?: boolean;
  initialSummaryMonth?: Date | null;
};

export function AthleteCalendarStoryboardV2({
  anchorMonth,
  canManagePersonalEvents = true,
  data,
  dayDetail,
  dayDetailError,
  dayDetailLoading = false,
  loadingMore = false,
  loadingPrevious = false,
  navigationRevision = 0,
  onAction,
  onLoadMore,
  onLoadPrevious,
  onMonthChange,
  onRefresh,
  onRetryDayDetail,
  onRetryLoadMore,
  onSelectedDateChange,
  onToday,
  paginationError,
  refreshing = false,
  selectedDate,
  initialLensVisible = false,
  initialSummaryMonth = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Date>>(null);
  const positionedAnchorRef = useRef('');
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(anchorMonth));
  const [lensVisible, setLensVisible] = useState(initialLensVisible);
  const [summaryMonth, setSummaryMonth] = useState<Date | null>(initialSummaryMonth);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Set<FilterId>>(new Set());
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState(selectedDate);
  const [jumpError, setJumpError] = useState<string | null>(null);

  const months = useMemo(() => monthsForDays(data.days, anchorMonth), [anchorMonth, data.days]);
  const daysByDate = useMemo(() => new Map(data.days.map((day) => [day.date, day])), [data.days]);
  const summariesByMonth = useMemo(
    () => new Map((data.monthSummaries || []).map((summary) => [summary.month, summary])),
    [data.monthSummaries],
  );

  const anchorKey = monthKey(anchorMonth);
  useEffect(() => {
    setVisibleMonth(startOfMonth(anchorMonth));
    if (!months.length || positionedAnchorRef.current === anchorKey) return;
    const index = Math.max(0, months.findIndex((month) => monthKey(month) === anchorKey));
    positionedAnchorRef.current = anchorKey;
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: navigationRevision > 0, viewPosition: 0 }));
  }, [anchorKey, anchorMonth, months, navigationRevision]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 52, minimumViewTime: 80 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Date>[] }) => {
    const first = viewableItems.find((item) => item.isViewable)?.item;
    if (first instanceof Date) setVisibleMonth(startOfMonth(first));
  }).current;

  const selectDate = useCallback((date: string) => {
    onSelectedDateChange?.(date);
    setLensVisible(true);
    void Haptics.selectionAsync();
  }, [onSelectedDateChange]);

  const goToday = useCallback(() => {
    const target = onToday() || data.today;
    const parsed = parseYmd(target) || new Date();
    setVisibleMonth(startOfMonth(parsed));
    positionedAnchorRef.current = '';
    onSelectedDateChange?.(target);
    void Haptics.selectionAsync();
  }, [data.today, onSelectedDateChange, onToday]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return data.days.filter((day) => {
      const values = [
        day.date,
        formatFullDate(day.date),
        ...day.sessions.flatMap((session) => [session.title || '', session.plannedSummary || '', ...(session.primaryLifts || [])]),
        ...(day.personalEvents || []).flatMap((event) => [event.title, event.location || '', event.category || '']),
        ...(day.meets || []).map((meet) => meet.name || ''),
      ];
      return values.some((value) => value.toLowerCase().includes(normalized));
    }).slice(0, 8);
  }, [data.days, query]);

  const jumpToDate = () => {
    const parsed = parseYmd(jumpValue.trim());
    if (!parsed || toYmd(parsed) !== jumpValue.trim()) {
      setJumpError('Use YYYY-MM-DD.');
      return;
    }
    positionedAnchorRef.current = '';
    onSelectedDateChange?.(jumpValue.trim());
    onMonthChange(startOfMonth(parsed));
    setVisibleMonth(startOfMonth(parsed));
    setJumpOpen(false);
    setJumpError(null);
  };

  const activeFilterCount = filters.size;
  const resolvedDetail = dayDetail?.date === selectedDate
    ? dayDetail
    : fallbackDetail(data, selectedDate, canManagePersonalEvents);

  const renderMonth = ({ item }: ListRenderItemInfo<Date>) => (
    <MonthSection
      data={data}
      daysByDate={daysByDate}
      filters={filters}
      month={item}
      onOpenSummary={() => setSummaryMonth(item)}
      onSelectDate={selectDate}
      selectedDate={selectedDate}
      summary={summariesByMonth.get(monthKey(item))}
    />
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(109,42,184,0.10)', 'rgba(2,2,5,0)', 'rgba(2,2,5,0)']} pointerEvents="none" style={StyleSheet.absoluteFillObject} />
      <View style={styles.compactHeader}>
        <Pressable accessibilityRole="button" onPress={() => { setJumpValue(toYmd(visibleMonth)); setJumpOpen(true); }} style={styles.timeHeaderCopy}>
          <Text style={styles.monthTitle}>CALENDAR</Text>
          <Text numberOfLines={1} style={styles.monthContext}>
            {visibleMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase()} · JUMP TO DATE
          </Text>
        </Pressable>
        <View style={styles.headerActions}>
          <UtilityButton icon="search" label="Search Calendar" onPress={() => setSearchOpen((value) => !value)} />
          <UtilityButton badge={activeFilterCount || undefined} icon="options-outline" label="Filter Calendar" onPress={() => setFiltersOpen(true)} />
          {canManagePersonalEvents ? <UtilityButton icon="add" label="Add personal item" onPress={() => onAction({ type: 'add-event', date: selectedDate })} /> : null}
        </View>
      </View>

      {searchOpen ? (
        <View style={styles.searchSurface}>
          <View style={styles.searchInputRow}>
            <Ionicons color={SLColors.iconMuted} name="search" size={18} />
            <TextInput
              autoFocus
              onChangeText={setQuery}
              placeholder="Sessions, dates, movements, personal items"
              placeholderTextColor={SLColors.textMuted}
              style={styles.searchInput}
              value={query}
            />
            <Pressable hitSlop={10} onPress={() => { setQuery(''); setSearchOpen(false); }}>
              <Ionicons color={SLColors.iconMuted} name="close" size={19} />
            </Pressable>
          </View>
          {query.trim() ? (
            <View style={styles.searchResults}>
              {searchResults.length ? searchResults.map((day) => (
                <Pressable key={day.date} onPress={() => { setSearchOpen(false); setQuery(''); selectDate(day.date); }} style={styles.searchResultRow}>
                  <Text style={styles.searchResultDate}>{formatShortDate(day.date)}</Text>
                  <Text numberOfLines={1} style={styles.searchResultTitle}>{searchResultTitle(day)}</Text>
                  <Ionicons color={SLColors.iconMuted} name="chevron-forward" size={17} />
                </Pressable>
              )) : <Text style={styles.emptySearch}>No matching Calendar evidence.</Text>}
            </View>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={months}
        initialNumToRender={3}
        keyExtractor={monthKey}
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 24 }}
        maxToRenderPerBatch={4}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.55}
        onRefresh={onRefresh}
        onScrollToIndexFailed={({ index }) => setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 80)}
        onStartReached={onLoadPrevious}
        onStartReachedThreshold={0.35}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SLColors.accentViolet} /> : undefined}
        ref={listRef}
        renderItem={renderMonth}
        showsVerticalScrollIndicator={false}
        style={styles.monthList}
        viewabilityConfig={viewabilityConfig}
        windowSize={5}
        ListHeaderComponent={loadingPrevious ? <ActivityIndicator color={SLColors.accentViolet} style={styles.pageSpinner} /> : null}
        ListFooterComponent={(
          <View style={styles.listFooter}>
            {loadingMore ? <ActivityIndicator color={SLColors.accentViolet} /> : null}
            {paginationError ? (
              <Pressable onPress={onRetryLoadMore} style={styles.retryRow}>
                <Text style={styles.retryText}>More dates could not load. Tap to retry.</Text>
              </Pressable>
            ) : null}
            <View style={{ height: 148 + insets.bottom }} />
          </View>
        )}
      />

      <View pointerEvents="box-none" style={[styles.floatingControls, { bottom: 70 + insets.bottom }]}>
        <Pressable accessibilityRole="button" onPress={goToday} style={styles.todayButton}>
          <Text style={styles.todayText}>Today</Text>
        </Pressable>
      </View>

      <DayLens
        detail={resolvedDetail}
        error={dayDetailError}
        loading={dayDetailLoading && dayDetail?.date !== selectedDate}
        onAction={onAction}
        onClose={() => setLensVisible(false)}
        onRetry={onRetryDayDetail}
        preferredUnits={data.preferredUnits}
        visible={lensVisible}
      />
      <MonthSummarySheet
        month={summaryMonth}
        onClose={() => setSummaryMonth(null)}
        preferredUnits={data.preferredUnits}
        summary={summaryMonth ? summariesByMonth.get(monthKey(summaryMonth)) : undefined}
      />
      <FilterSheet filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} visible={filtersOpen} />
      <JumpSheet
        error={jumpError}
        onChange={setJumpValue}
        onClose={() => { setJumpOpen(false); setJumpError(null); }}
        onSubmit={jumpToDate}
        value={jumpValue}
        visible={jumpOpen}
      />
    </View>
  );
}

function MonthSection({
  data,
  daysByDate,
  filters,
  month,
  onOpenSummary,
  onSelectDate,
  selectedDate,
  summary,
}: {
  data: AthleteCalendarExperienceData;
  daysByDate: Map<string, AthleteCalendarDay>;
  filters: Set<FilterId>;
  month: Date;
  onOpenSummary: () => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
  summary?: AthleteCalendarMonthSummary;
}) {
  const grid = monthGrid(month);
  const context = contextForDate(data.ranges || [], month, data.today);
  const completion = summary?.completionPercent ?? completionFromDays(data.days, month);
  const completed = summary?.completedCount ?? countCompleted(data.days, month);
  const planned = summary?.plannedCount ?? countPlanned(data.days, month);
  return (
    <View style={styles.monthSection}>
      <View style={styles.monthSectionHeader}>
        <View style={styles.flex}>
          <Text style={styles.sectionMonth}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Text numberOfLines={1} style={styles.sectionContext}>{context}</Text>
        </View>
        <Pressable accessibilityLabel={`Open ${month.toLocaleDateString(undefined, { month: 'long' })} summary`} onPress={onOpenSummary} style={styles.summaryBadge}>
          <Text style={styles.summaryRatio}>{completed}/{planned}</Text>
          <Text style={styles.summaryPercent}>{completion}%</Text>
        </Pressable>
      </View>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((weekday, index) => <Text key={`${weekday}-${index}`} style={styles.weekday}>{weekday}</Text>)}
      </View>
      <View style={styles.monthGrid}>
        {grid.map((date) => {
          const dateKey = toYmd(date);
          const day = daysByDate.get(dateKey);
          const inMonth = date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
          return (
            <DayCell
              day={day}
              filtered={day ? !dayMatchesActiveFilters(day, filters) : false}
              inMonth={inMonth}
              isToday={dateKey === data.today}
              key={dateKey}
              onPress={() => onSelectDate(dateKey)}
              selected={dateKey === selectedDate}
              value={date.getDate()}
            />
          );
        })}
      </View>
      {monthTransitionLabel(data.ranges || [], month) ? (
        <View style={styles.transitionRow}>
          <View style={styles.transitionRule} />
          <Text style={styles.transitionText}>{monthTransitionLabel(data.ranges || [], month)}</Text>
          <View style={styles.transitionRule} />
        </View>
      ) : null}
    </View>
  );
}

function DayCell({ day, filtered, inMonth, isToday, onPress, selected, value }: {
  day?: AthleteCalendarDay;
  filtered: boolean;
  inMonth: boolean;
  isToday: boolean;
  onPress: () => void;
  selected: boolean;
  value: number;
}) {
  const state = resolveCalendarLensState({
    sessionStatuses: day?.sessions.map((session) => session.status),
    personalItemCount: day?.personalEvents?.length,
    checkInCount: day?.checkIns?.length,
    meetCount: day?.meets?.length,
  });
  const tone = toneColor(primaryCalendarDayTone({
    sessionStatuses: day?.sessions.map((session) => session.status),
    personalItemCount: day?.personalEvents?.length,
    checkInCount: day?.checkIns?.length,
    meetCount: day?.meets?.length,
  }));
  const session = day?.sessions[0];
  const prCount = (day?.sessions || []).reduce((total, item) => total + Number(item.prCount || 0), 0);
  const label = cellLabel(session?.title, state);
  const hasEvidence = Boolean(day && (day.sessions.length || day.personalEvents?.length || day.meets?.length || day.checkIns?.length));
  return (
    <Pressable
      accessibilityLabel={`${value}. ${label || (hasEvidence ? 'Calendar items' : 'Recovery day')}`}
      onPress={onPress}
      style={[styles.dayCell, selected && styles.dayCellSelected, !inMonth && styles.dayCellOutside, filtered && styles.dayCellFiltered]}
    >
      {selected ? <LinearGradient colors={['rgba(153,82,255,0.28)', 'rgba(41,20,59,0.10)']} style={StyleSheet.absoluteFillObject} /> : null}
      <View style={styles.dayNumberRow}>
        <Text style={[styles.dayNumber, isToday && styles.dayNumberToday, !inMonth && styles.dayNumberOutside]}>{value}</Text>
        {prCount > 0 ? <Text style={styles.prMarker}>✦</Text> : null}
      </View>
      {label && !filtered ? <View style={[styles.cellPill, { borderColor: `${tone}99`, backgroundColor: `${tone}1C` }]}><Text numberOfLines={1} style={[styles.cellPillText, { color: tone }]}>{label}</Text></View> : null}
      {!label && day?.personalEvents?.length && !filtered ? <View style={styles.personalRing} /> : null}
      {!hasEvidence && inMonth ? <View style={styles.recoveryDot} /> : null}
      {day && day.sessions.length > 1 && !filtered ? <View style={styles.multiDot}><Text style={styles.multiDotText}>+{day.sessions.length - 1}</Text></View> : null}
    </Pressable>
  );
}

function DayLens({ detail, error, loading, onAction, onClose, onRetry, preferredUnits = 'kg', visible }: {
  detail: AthleteCalendarDayDetail;
  error?: string | null;
  loading: boolean;
  onAction: (action: AthleteCalendarAction) => void;
  onClose: () => void;
  onRetry?: () => void;
  preferredUnits?: 'kg' | 'lb';
  visible: boolean;
}) {
  const primary = detail.sessions[0];
  const state = detail.state;
  const tone = lensColor(state);
  const isRecovery = !detail.sessions.length && state === 'rest';
  const title = primary?.title || (state === 'personal' ? 'Personal Day' : 'Recovery Day');
  const status = primary ? resolveCalendarSessionStatus(primary.status) : null;
  const blockContext = detail.blockContext;
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityLabel="Close day detail" onPress={onClose} style={StyleSheet.absoluteFillObject} />
        <View accessibilityViewIsModal style={[styles.daySheet, { borderColor: `${tone}77` }]}>
          <View style={styles.sheetHandle} />
          <ScrollView contentContainerStyle={styles.daySheetContent} showsVerticalScrollIndicator={false}>
            <ImageBackground imageStyle={styles.heroImage} source={isRecovery ? RECOVERY_ART : TRAINING_ART} style={styles.dayHero}>
              <LinearGradient colors={['rgba(3,3,7,0.20)', 'rgba(3,3,7,0.78)', SLColors.surfaceInset]} style={StyleSheet.absoluteFillObject} />
              <View style={styles.dayHeroTopRow}>
                <Text style={styles.dayDate}>{formatFullDate(detail.date)}</Text>
                <View style={[styles.statusBadge, { borderColor: `${tone}AA`, backgroundColor: `${tone}22` }]}><Text style={[styles.statusBadgeText, { color: tone }]}>{status?.label || (state === 'personal' ? 'PERSONAL' : 'RECOVERY')}</Text></View>
              </View>
              <View style={styles.dayHeroBottom}>
                <Text style={styles.dayTitle}>{title}</Text>
                {primary?.planned ? <Text style={styles.dayMeta}>{primary.planned.movementCount} movements · {primary.planned.plannedSets} sets</Text> : null}
                {blockContext ? <Text style={styles.dayContext}>{blockContext.name || 'Training block'}{blockContext.weekNumber ? ` · Week ${blockContext.weekNumber}${blockContext.totalWeeks ? ` of ${blockContext.totalWeeks}` : ''}` : ''}</Text> : null}
              </View>
            </ImageBackground>

            {loading ? <View style={styles.loadingPanel}><ActivityIndicator color={SLColors.accentViolet} /><Text style={styles.loadingText}>Loading day evidence…</Text></View> : null}
            {error ? <Pressable onPress={onRetry} style={styles.errorPanel}><Text style={styles.errorText}>{error}</Text><Text style={styles.errorAction}>Retry</Text></Pressable> : null}
            {!loading && !error ? (
              <>
                {isRecovery ? <RecoveryLens detail={detail} onAction={onAction} preferredUnits={preferredUnits} /> : null}
                {primary && status?.lifecycle !== 'completed' ? <TrainingLens onAction={onAction} session={primary} /> : null}
                {primary && status?.lifecycle === 'completed' ? <CompletedLens onAction={onAction} preferredUnits={preferredUnits} session={primary} /> : null}
                {detail.sessions.slice(1).map((session) => <AdditionalSession key={session.id} onAction={onAction} session={session} />)}
                {detail.personalEvents.length ? <PersonalItems events={detail.personalEvents} onAction={onAction} /> : null}
                {!detail.sessions.length && !isRecovery && !detail.personalEvents.length ? <EmptyDay /> : null}
                {detail.capabilities.canAddPersonalItem ? (
                  <Pressable onPress={() => onAction({ type: 'add-event', date: detail.date })} style={styles.secondaryAction}>
                    <Ionicons color={SLColors.iconMuted} name="add" size={18} />
                    <Text style={styles.secondaryActionText}>Add personal item</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RecoveryLens({ detail, onAction, preferredUnits }: { detail: AthleteCalendarDayDetail; onAction: (action: AthleteCalendarAction) => void; preferredUnits: 'kg' | 'lb' }) {
  const readiness = detail.readiness;
  return (
    <>
      <View style={styles.evidenceCard}>
        <Text style={styles.cardEyebrow}>READINESS</Text>
        {readiness ? (
          <>
            <View style={styles.readinessHeadline}>
              <Text style={styles.readinessValue}>{readiness.score != null ? `${Math.round(readiness.score * 10) / 10}/10` : 'RECORDED'}</Text>
              <Text style={styles.readinessState}>TODAY'S CHECK-IN</Text>
            </View>
            <View style={styles.readinessGrid}>
              <EvidenceMetric label="ENERGY" value={scoreLabel(readiness.energy)} />
              <EvidenceMetric label="SORENESS" value={scoreLabel(readiness.soreness, true)} />
              <EvidenceMetric label="STRESS" value={scoreLabel(readiness.stress, true)} />
              {readiness.bodyweightKg != null ? <EvidenceMetric label="BODYWEIGHT" value={formatWeight(readiness.bodyweightKg, preferredUnits)} /> : null}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.notSubmitted}>Not submitted</Text>
            <Text style={styles.cardBody}>How are you feeling today?</Text>
            {detail.isToday ? (
              <Pressable onPress={() => onAction({ type: 'daily-readiness', date: detail.date })} style={styles.readinessAction}>
                <Text style={styles.readinessActionText}>Check In</Text>
                <Ionicons color={SLColors.textStrong} name="arrow-forward" size={18} />
              </Pressable>
            ) : <Text style={styles.historicalNote}>No readiness evidence was recorded for this day.</Text>}
          </>
        )}
      </View>
      {detail.nextUp ? (
        <Pressable onPress={() => onAction({ type: 'session', id: detail.nextUp!.id })} style={styles.nextUpCard}>
          <View style={styles.flex}>
            <Text style={styles.cardEyebrow}>NEXT UP</Text>
            <Text style={styles.nextUpTitle}>{detail.nextUp.title || 'Training Session'}</Text>
            <Text style={styles.cardBody}>{relativeDateLabel(detail.date, detail.nextUp.date || '')}{detail.nextUp.blockName ? ` · ${detail.nextUp.blockName}` : ''}</Text>
          </View>
          <Ionicons color={SLColors.accentMuted} name="arrow-forward" size={22} />
        </Pressable>
      ) : null}
    </>
  );
}

function TrainingLens({ onAction, session }: { onAction: (action: AthleteCalendarAction) => void; session: AthleteCalendarDayDetailSession }) {
  const status = resolveCalendarSessionStatus(session.status);
  const movements = session.planned?.movementLabels || session.primaryLifts || [];
  return (
    <>
      <View style={styles.evidenceCard}>
        <Text style={styles.cardEyebrow}>SESSION PREVIEW</Text>
        {movements.slice(0, 3).map((movement, index) => (
          <View key={`${movement}-${index}`} style={styles.movementPreviewRow}>
            <Text style={styles.movementIndex}>{index + 1}</Text>
            <View style={styles.flex}><Text style={styles.movementName}>{movement}</Text>{index === 0 && session.planned?.label ? <Text numberOfLines={1} style={styles.movementMeta}>{session.planned.label}</Text> : null}</View>
          </View>
        ))}
        {Math.max(0, (session.planned?.movementCount || movements.length) - 3) > 0 ? <Text style={styles.moreMovements}>+ {Math.max(0, (session.planned?.movementCount || movements.length) - 3)} more movements</Text> : null}
      </View>
      {session.programmingNotes ? <View style={styles.notesCard}><Text style={styles.cardEyebrow}>COACH NOTES</Text><Text style={styles.notesText}>{session.programmingNotes}</Text></View> : null}
      <PrimaryAction label={status.lifecycle === 'in_progress' ? 'Resume Session' : 'Open Session'} onPress={() => onAction({ type: 'session', id: session.id })} tone={status.lifecycle === 'in_progress' ? 'violet' : 'gold'} />
    </>
  );
}

function CompletedLens({ onAction, preferredUnits, session }: { onAction: (action: AthleteCalendarAction) => void; preferredUnits: 'kg' | 'lb'; session: AthleteCalendarDayDetailSession }) {
  const performance = session.performance;
  const accomplishment = session.accomplishment;
  const best = performance?.bestSet;
  return (
    <>
      <View style={styles.evidenceCard}>
        <Text style={styles.cardEyebrow}>HIGHLIGHTS</Text>
        <View style={styles.highlightGrid}>
          <EvidenceMetric label="PRS" value={String(accomplishment?.count || 0)} />
          <EvidenceMetric label="RPE" value={session.reflection?.sessionRpe != null ? String(session.reflection.sessionRpe) : '—'} />
          <EvidenceMetric label="SETS" value={String(performance?.completedSets || 0)} />
          <EvidenceMetric label="VOLUME" value={performance?.totalVolumeKg ? formatCompactWeight(performance.totalVolumeKg, preferredUnits) : '—'} />
        </View>
      </View>
      {best ? (
        <View style={styles.evidenceCard}>
          <Text style={styles.cardEyebrow}>TOP LIFT</Text>
          <View style={styles.bestLiftRow}>
            <View style={styles.flex}>
              <Text style={styles.bestLiftName}>{accomplishment?.highestPriority?.movementLabel || session.planned?.movementLabels?.[0] || 'Best Set'}</Text>
              <Text style={styles.bestLiftValue}>{formatWeight(best.weightKg, preferredUnits)} × {best.reps}{best.rpe != null ? ` @ ${best.rpe}` : ''}</Text>
            </View>
            {accomplishment?.count ? <View style={styles.prBadge}><Text style={styles.prBadgeText}>PR</Text></View> : null}
          </View>
        </View>
      ) : null}
      <PrimaryAction label="View Session Recap" onPress={() => onAction({ type: 'session', id: session.id })} tone="green" />
    </>
  );
}

function AdditionalSession({ onAction, session }: { onAction: (action: AthleteCalendarAction) => void; session: AthleteCalendarDayDetailSession }) {
  const status = resolveCalendarSessionStatus(session.status);
  return (
    <Pressable onPress={() => onAction({ type: 'session', id: session.id })} style={styles.additionalSession}>
      <View style={[styles.additionalTone, { backgroundColor: lensColor(status.lifecycle === 'not_started' ? 'assigned' : status.lifecycle as any) }]} />
      <View style={styles.flex}><Text style={styles.additionalTitle}>{session.title || 'Training Session'}</Text><Text style={styles.cardBody}>{status.label}</Text></View>
      <Ionicons color={SLColors.iconMuted} name="chevron-forward" size={19} />
    </Pressable>
  );
}

function PersonalItems({ events, onAction }: { events: AthleteCalendarPersonalEvent[]; onAction: (action: AthleteCalendarAction) => void }) {
  return (
    <View style={styles.evidenceCard}>
      <Text style={styles.cardEyebrow}>PERSONAL</Text>
      {events.map((event) => (
        <Pressable key={event.id} onPress={() => onAction({ type: 'edit-event', event })} style={styles.personalEventRow}>
          <View style={styles.personalEventMark} />
          <View style={styles.flex}>
            <Text style={styles.personalEventTitle}>{event.title}</Text>
            <Text style={styles.cardBody}>{[event.category || 'Personal item', event.location].filter(Boolean).join(' · ')}</Text>
          </View>
          <Ionicons color={SLColors.iconMuted} name="chevron-forward" size={18} />
        </Pressable>
      ))}
    </View>
  );
}

function MonthSummarySheet({ month, onClose, preferredUnits = 'kg', summary }: { month: Date | null; onClose: () => void; preferredUnits?: 'kg' | 'lb'; summary?: AthleteCalendarMonthSummary }) {
  if (!month) return null;
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.modalBackdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} />
        <View accessibilityViewIsModal style={styles.summarySheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.summaryHeader}><Text style={styles.summarySheetTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Pressable onPress={onClose} style={styles.closeButton}><Ionicons color={SLColors.iconPrimary} name="close" size={21} /></Pressable></View>
          {summary ? (
            <ScrollView contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
              <View style={styles.summaryMetricGrid}>
                <SummaryMetric label="SESSIONS" value={summary.sessionCount} />
                <SummaryMetric label="COMPLETED" value={summary.completedCount} />
                <SummaryMetric label="UPCOMING" value={summary.upcomingCount} />
                <SummaryMetric label="COMPLETION" value={`${summary.completionPercent}%`} />
              </View>
              {summary.totalVolumeKg > 0 ? <SummaryFeature label="TOTAL VOLUME" value={formatCompactWeight(summary.totalVolumeKg, preferredUnits)} accent="violet" /> : null}
              {summary.prCount > 0 ? <SummaryFeature label="PERSONAL RECORDS" value={`${summary.prCount}`} accent="gold" /> : null}
              {summary.reportedBodyweight ? (
                <View style={styles.bodyweightSummary}>
                  <Text style={styles.cardEyebrow}>REPORTED BODYWEIGHT</Text>
                  <View style={styles.bodyweightEndpoints}><View><Text style={styles.bodyweightValue}>{formatWeight(summary.reportedBodyweight.startKg, preferredUnits)}</Text><Text style={styles.cardBody}>Start</Text></View><View style={styles.bodyweightRule} /><View style={styles.alignEnd}><Text style={styles.bodyweightValue}>{formatWeight(summary.reportedBodyweight.latestKg, preferredUnits)}</Text><Text style={styles.cardBody}>Latest</Text></View></View>
                </View>
              ) : null}
              {summary.blockNames.length ? <View style={styles.blockSummary}><Text style={styles.cardEyebrow}>TRAINING CONTEXT</Text><Text style={styles.blockSummaryText}>{summary.blockNames.join(' → ')}</Text></View> : null}
            </ScrollView>
          ) : <View style={styles.noSummary}><Text style={styles.emptyTitle}>No monthly evidence yet.</Text><Text style={styles.cardBody}>Summary metrics appear only when canonical Calendar evidence exists.</Text></View>}
        </View>
      </View>
    </Modal>
  );
}

function FilterSheet({ filters, onChange, onClose, visible }: { filters: Set<FilterId>; onChange: (value: Set<FilterId>) => void; onClose: () => void; visible: boolean }) {
  const options: { id: FilterId; label: string; detail: string }[] = [
    { id: 'sessions', label: 'Training Sessions', detail: 'Assigned, active, and completed' },
    { id: 'personal', label: 'Personal', detail: 'Appointments, travel, meets, reminders' },
    { id: 'completed', label: 'Completed', detail: 'Performed training evidence' },
    { id: 'attention', label: 'Needs Attention', detail: 'Missed, incomplete, or tardy Sessions' },
  ];
  const toggle = (id: FilterId) => {
    const next = new Set(filters);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} />
        <View style={styles.utilitySheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.summaryHeader}><View><Text style={styles.utilityEyebrow}>CALENDAR</Text><Text style={styles.utilityTitle}>Filter what you see</Text></View><Pressable onPress={onClose} style={styles.closeButton}><Ionicons color={SLColors.iconPrimary} name="close" size={21} /></Pressable></View>
          <Text style={styles.utilityBody}>The default Calendar shows your whole training life. Filters stay secondary and temporary.</Text>
          <View style={styles.filterOptions}>{options.map((option) => {
            const selected = filters.has(option.id);
            return <Pressable key={option.id} onPress={() => toggle(option.id)} style={[styles.filterOption, selected && styles.filterOptionSelected]}><View style={styles.flex}><Text style={styles.filterLabel}>{option.label}</Text><Text style={styles.cardBody}>{option.detail}</Text></View><View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>{selected ? <Ionicons color={SLColors.textStrong} name="checkmark" size={15} /> : null}</View></Pressable>;
          })}</View>
          <Pressable onPress={() => onChange(new Set())} style={styles.clearFilters}><Text style={styles.clearFiltersText}>Clear Filters</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function JumpSheet({ error, onChange, onClose, onSubmit, value, visible }: { error?: string | null; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void; value: string; visible: boolean }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.centeredBackdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} />
        <View style={styles.jumpCard}>
          <Text style={styles.utilityEyebrow}>JUMP THROUGH TIME</Text>
          <Text style={styles.utilityTitle}>Go to a date</Text>
          <Text style={styles.utilityBody}>Natural scrolling stays primary. Use this for a precise month, year, or day.</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor={SLColors.textMuted} style={styles.jumpInput} value={value} />
          {error ? <Text style={styles.jumpError}>{error}</Text> : null}
          <View style={styles.jumpActions}><Pressable onPress={onClose} style={styles.jumpCancel}><Text style={styles.jumpCancelText}>Cancel</Text></Pressable><Pressable onPress={onSubmit} style={styles.jumpSubmit}><Text style={styles.jumpSubmitText}>Go to Date</Text></Pressable></View>
        </View>
      </View>
    </Modal>
  );
}

function UtilityButton({ badge, icon, label, onPress }: { badge?: number; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.utilityButton}><Ionicons color={SLColors.iconPrimary} name={icon} size={18} />{badge ? <View style={styles.utilityBadge}><Text style={styles.utilityBadgeText}>{badge}</Text></View> : null}</Pressable>;
}

function EvidenceMetric({ label, value }: { label: string; value: string }) { return <View style={styles.evidenceMetric}><Text style={styles.evidenceValue}>{value}</Text><Text style={styles.evidenceLabel}>{label}</Text></View>; }
function SummaryMetric({ label, value }: { label: string; value: number | string }) { return <View style={styles.summaryMetric}><Text style={styles.summaryMetricValue}>{value}</Text><Text style={styles.summaryMetricLabel}>{label}</Text></View>; }
function SummaryFeature({ accent, label, value }: { accent: 'violet' | 'gold'; label: string; value: string }) { const color = accent === 'gold' ? SLColors.warning : SLColors.accentViolet; return <View style={[styles.summaryFeature, { borderColor: `${color}55` }]}><View><Text style={styles.cardEyebrow}>{label}</Text><Text style={[styles.summaryFeatureValue, { color }]}>{value}</Text></View><View style={[styles.featureOrb, { backgroundColor: `${color}22`, borderColor: `${color}88` }]}><Text style={[styles.featureOrbText, { color }]}>{accent === 'gold' ? 'PR' : '∑'}</Text></View></View>; }
function PrimaryAction({ label, onPress, tone }: { label: string; onPress: () => void; tone: 'gold' | 'violet' | 'green' }) { const colors = tone === 'gold' ? ['#76551E', '#D1A94B'] : tone === 'green' ? ['#274A38', '#527A61'] : ['#3C176F', '#722AC3']; return <Pressable onPress={onPress} style={styles.primaryAction}><LinearGradient colors={colors as [string, string]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={styles.primaryActionFill}><Text style={styles.primaryActionText}>{label}</Text><Ionicons color={SLColors.textStrong} name="arrow-forward" size={19} /></LinearGradient></Pressable>; }
function EmptyDay() { return <View style={styles.noSummary}><Text style={styles.emptyTitle}>Open day</Text><Text style={styles.cardBody}>No Training Session or personal item is recorded.</Text></View>; }

function fallbackDetail(data: AthleteCalendarExperienceData, date: string, canManage: boolean): AthleteCalendarDayDetail {
  const day = data.days.find((item) => item.date === date);
  const sessions = day?.sessions || [];
  return {
    date,
    isToday: date === data.today,
    state: resolveCalendarLensState({ sessionStatuses: sessions.map((session) => session.status), personalItemCount: day?.personalEvents?.length, checkInCount: day?.checkIns?.length, meetCount: day?.meets?.length }),
    sessions,
    personalEvents: day?.personalEvents || [],
    conflicts: [],
    capabilities: { canAddPersonalItem: canManage, canCreateSession: false },
  };
}

function dayMatchesActiveFilters(day: AthleteCalendarDay, filters: Set<FilterId>) {
  if (!filters.size) return true;
  const lifecycles = day.sessions.map((session) => resolveCalendarSessionStatus(session.status).lifecycle);
  return [...filters].some((filter) => {
    if (filter === 'sessions') return lifecycles.some((lifecycle) => lifecycle !== 'canceled');
    if (filter === 'personal') return Boolean(day.personalEvents?.length || day.meets?.length);
    if (filter === 'completed') return lifecycles.includes('completed');
    return lifecycles.some((lifecycle) => lifecycle === 'missed');
  });
}

function monthsForDays(days: AthleteCalendarDay[], anchorMonth: Date) {
  if (!days.length) return [startOfMonth(anchorMonth)];
  const first = parseYmd(days[0].date) || anchorMonth;
  const last = parseYmd(days[days.length - 1].date) || anchorMonth;
  const months: Date[] = [];
  for (let cursor = startOfMonth(first); cursor <= startOfMonth(last); cursor = addMonths(cursor, 1)) months.push(cursor);
  return months;
}

function monthGrid(month: Date) {
  const first = startOfMonth(month);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const trailing = 6 - last.getDay();
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + trailing);
  const result: Date[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) result.push(cursor);
  return result;
}

function contextForDate(ranges: AthleteCalendarRange[], date: Date, today: string) {
  const key = toYmd(new Date(date.getFullYear(), date.getMonth(), Math.min(15, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())));
  const range = ranges.find((item) => item.start <= key && item.end >= key) || ranges.find((item) => item.start.startsWith(monthKey(date)));
  if (!range) return 'Training timeline';
  const start = parseYmd(range.start);
  const end = parseYmd(range.end);
  const focusDate = monthKey(parseYmd(today) || date) === monthKey(date) ? parseYmd(today) || date : date;
  const week = start ? Math.max(1, Math.floor((focusDate.getTime() - start.getTime()) / 604800000) + 1) : null;
  const total = start && end ? Math.max(1, Math.floor((end.getTime() - start.getTime()) / 604800000) + 1) : null;
  return `${range.label}${week ? ` · Week ${week}${total ? ` of ${total}` : ''}` : ''}`;
}

function monthTransitionLabel(ranges: AthleteCalendarRange[], month: Date) {
  const key = monthKey(month);
  const starts = ranges.find((range) => range.start.startsWith(key) && Number(range.start.slice(8, 10)) > 1);
  return starts ? `NEW BLOCK · ${starts.label.toUpperCase()}` : null;
}

function cellLabel(title: string | null | undefined, state: string) {
  if (state === 'in_progress') return 'ACTIVE';
  if (state === 'needs_attention') return 'ATTN';
  if (state === 'completed') return compactSessionTitle(title) || 'DONE';
  if (state === 'assigned') return compactSessionTitle(title) || 'TRAIN';
  return '';
}
function compactSessionTitle(value?: string | null) { if (!value) return ''; const words = value.trim().split(/\s+/); return words.length > 2 ? words.slice(0, 2).join(' ') : value; }
function searchResultTitle(day: AthleteCalendarDay) { return day.sessions[0]?.title || day.personalEvents?.[0]?.title || day.meets?.[0]?.name || 'Recovery / open day'; }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date: Date, count: number) { return new Date(date.getFullYear(), date.getMonth() + count, 1); }
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function formatFullDate(value: string) { const date = parseYmd(value); return date ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : value; }
function formatShortDate(value: string) { const date = parseYmd(value); return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : value; }
function countCompleted(days: AthleteCalendarDay[], month: Date) { return days.filter((day) => day.date.startsWith(monthKey(month))).flatMap((day) => day.sessions).filter((session) => resolveCalendarSessionStatus(session.status).lifecycle === 'completed').length; }
function countPlanned(days: AthleteCalendarDay[], month: Date) { return days.filter((day) => day.date.startsWith(monthKey(month))).flatMap((day) => day.sessions).filter((session) => resolveCalendarSessionStatus(session.status).lifecycle !== 'canceled').length; }
function completionFromDays(days: AthleteCalendarDay[], month: Date) { const planned = countPlanned(days, month); return planned ? Math.round((countCompleted(days, month) / planned) * 100) : 0; }
function toneColor(tone: string) { if (tone === 'green') return '#6FC697'; if (tone === 'gold') return '#E2B64E'; if (tone === 'red') return '#E07171'; if (tone === 'pink') return '#D06ADC'; if (tone === 'violet') return '#9A64FF'; return '#718095'; }
function lensColor(state: AthleteCalendarDayDetail['state']) { if (state === 'completed') return '#65B787'; if (state === 'assigned') return '#D7A942'; if (state === 'in_progress') return '#9A64FF'; if (state === 'needs_attention') return '#D66E6E'; if (state === 'personal') return '#C575D8'; return '#72A58F'; }
function scoreLabel(value?: number | null, inverse = false) { if (value == null) return '—'; const rounded = Math.round(value * 10) / 10; if (inverse) return rounded >= 4 ? 'High' : rounded >= 2.5 ? 'Moderate' : 'Low'; return rounded >= 4 ? 'High' : rounded >= 2.5 ? 'Steady' : 'Low'; }
function formatWeight(valueKg: number, unit: 'kg' | 'lb') { const value = unit === 'lb' ? valueKg / 0.45359237 : valueKg; return `${value.toFixed(1).replace(/\.0$/, '')} ${unit}`; }
function formatCompactWeight(valueKg: number, unit: 'kg' | 'lb') { const value = unit === 'lb' ? valueKg / 0.45359237 : valueKg; return `${value >= 10000 ? `${(value / 1000).toFixed(1)}K` : Math.round(value).toLocaleString()} ${unit}`; }
function relativeDateLabel(from: string, to: string) { const a = parseYmd(from); const b = parseYmd(to); if (!a || !b) return formatFullDate(to); const delta = Math.round((b.getTime() - a.getTime()) / 86400000); if (delta === 1) return `Tomorrow · ${formatFullDate(to)}`; if (delta === 0) return `Today · ${formatFullDate(to)}`; return formatFullDate(to); }

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', backgroundColor: SLColors.surfaceCanvas },
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  compactHeader: { minHeight: 54, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline, backgroundColor: 'rgba(2,2,5,0.96)' },
  timeHeaderCopy: { flex: 1, minWidth: 0, paddingVertical: 2 },
  monthTitle: { fontSize: 17, lineHeight: 19, letterSpacing: 0.8, color: SLColors.textStrong, fontFamily: SLFontFamilies.display },
  monthContext: { fontSize: 9, lineHeight: 12, letterSpacing: 0.45, color: SLColors.accentMuted, fontFamily: SLFontFamilies.technical, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 7, marginLeft: 8 },
  utilityButton: { width: 39, height: 39, borderRadius: SLRadius.control, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  utilityBadge: { position: 'absolute', right: -3, top: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: SLColors.accentViolet, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  utilityBadgeText: { fontSize: 10, lineHeight: 12, color: SLColors.textStrong, fontFamily: SLFontFamilies.bodyBold },
  searchSurface: { position: 'absolute', top: 53, left: 8, right: 8, zIndex: 40, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: '#090811', padding: 8 },
  searchInputRow: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: SLRadius.md, backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.borderDefault },
  searchInput: { flex: 1, color: SLColors.textStrong, fontFamily: SLFontFamilies.body, fontSize: 15 },
  searchResults: { marginTop: 6 },
  searchResultRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  searchResultDate: { width: 48, ...SLTypography.caption, color: SLColors.accentMuted },
  searchResultTitle: { flex: 1, ...SLTypography.bodyStrong, color: SLColors.textStrong },
  emptySearch: { ...SLTypography.body, color: SLColors.textMuted, padding: 16, textAlign: 'center' },
  monthList: { flex: 1 },
  pageSpinner: { paddingVertical: 10 },
  monthSection: { paddingTop: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  monthSectionHeader: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionMonth: { ...SLTypography.sectionTitle, color: SLColors.textStrong, fontFamily: SLFontFamilies.display },
  sectionContext: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 2 },
  summaryBadge: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#6D49A2', backgroundColor: '#0C0912' },
  summaryRatio: { fontSize: 13, lineHeight: 15, color: SLColors.textStrong, fontFamily: SLFontFamilies.bodySemiBold },
  summaryPercent: { fontSize: 9, lineHeight: 11, color: SLColors.success, fontFamily: SLFontFamilies.technical },
  weekdayRow: { flexDirection: 'row', paddingHorizontal: 8, marginTop: 8, marginBottom: 3 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, lineHeight: 15, color: SLColors.textMuted, fontFamily: SLFontFamilies.technical },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  dayCell: { width: `${100 / 7}%`, height: 63, paddingHorizontal: 3, paddingTop: 4, borderRadius: 10, overflow: 'hidden', alignItems: 'center' },
  dayCellSelected: { borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: 'rgba(83,36,123,0.18)' },
  dayCellOutside: { opacity: 0.32 },
  dayCellFiltered: { opacity: 0.24 },
  dayNumberRow: { height: 22, alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dayNumber: { fontSize: 15, lineHeight: 19, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodySemiBold },
  dayNumberToday: { color: SLColors.textStrong, textDecorationLine: 'underline', textDecorationColor: SLColors.accentViolet },
  dayNumberOutside: { color: SLColors.textMuted },
  prMarker: { position: 'absolute', right: 1, top: 0, fontSize: 9, lineHeight: 12, color: SLColors.accentViolet },
  cellPill: { maxWidth: '100%', height: 17, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  cellPillText: { maxWidth: '100%', fontSize: 8, lineHeight: 11, fontFamily: SLFontFamilies.technical },
  personalRing: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#C575D8', marginTop: 4 },
  recoveryDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#79649A', opacity: 0.65, marginTop: 5 },
  multiDot: { position: 'absolute', right: 1, bottom: 2 },
  multiDotText: { fontSize: 8, lineHeight: 10, color: SLColors.textMuted },
  transitionRow: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  transitionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(167,139,250,0.30)' },
  transitionText: { fontSize: 9, lineHeight: 12, color: SLColors.accentMuted, fontFamily: SLFontFamilies.technical, letterSpacing: 0.7 },
  listFooter: { minHeight: 20, alignItems: 'center' },
  retryRow: { marginTop: 8, padding: 12 },
  retryText: { ...SLTypography.caption, color: SLColors.accentMuted },
  floatingControls: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  todayButton: { height: 40, paddingHorizontal: 17, borderRadius: 20, backgroundColor: 'rgba(18,15,25,0.96)', borderWidth: 1, borderColor: SLColors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  todayText: { ...SLTypography.buttonLabel, color: SLColors.textStrong },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.66)' },
  centeredBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.78)', paddingHorizontal: 18 },
  daySheet: { maxHeight: '84%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderBottomWidth: 0, backgroundColor: SLColors.surfaceInset, overflow: 'hidden' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: SLColors.borderStrong, alignSelf: 'center', marginTop: 9, marginBottom: 5, zIndex: 2 },
  daySheetContent: { paddingBottom: 42 },
  dayHero: { height: 190, marginTop: -18, paddingHorizontal: 18, paddingTop: 28, paddingBottom: 16, justifyContent: 'space-between' },
  heroImage: { opacity: 0.46 },
  dayHeroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dayDate: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { fontSize: 10, lineHeight: 12, fontFamily: SLFontFamilies.technical, letterSpacing: 0.5 },
  dayHeroBottom: { gap: 3 },
  dayTitle: { ...SLTypography.heroTitle, color: SLColors.textStrong, fontFamily: SLFontFamilies.display },
  dayMeta: { ...SLTypography.body, color: SLColors.textSecondary },
  dayContext: { ...SLTypography.caption, color: SLColors.textMuted },
  loadingPanel: { margin: 14, minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { ...SLTypography.body, color: SLColors.textMuted },
  errorPanel: { margin: 14, padding: 16, borderRadius: SLRadius.md, borderWidth: 1, borderColor: `${SLColors.danger}66`, backgroundColor: SLColors.surfaceDestructive },
  errorText: { ...SLTypography.body, color: SLColors.textStrong },
  errorAction: { ...SLTypography.buttonLabel, color: SLColors.danger, marginTop: 8 },
  evidenceCard: { marginHorizontal: 14, marginTop: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: 'rgba(13,13,20,0.96)', padding: 14 },
  cardEyebrow: { fontSize: 10, lineHeight: 13, color: SLColors.accentMuted, fontFamily: SLFontFamilies.technical, letterSpacing: 0.65 },
  cardBody: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 2 },
  notSubmitted: { ...SLTypography.cardTitle, color: SLColors.textStrong, marginTop: 10 },
  historicalNote: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 12 },
  readinessAction: { height: 46, marginTop: 14, borderRadius: SLRadius.control, backgroundColor: '#542094', borderWidth: 1, borderColor: '#9B61EC', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readinessActionText: { ...SLTypography.buttonLabel, color: SLColors.textStrong },
  readinessHeadline: { marginTop: 9, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  readinessValue: { ...SLTypography.metricValue, color: SLColors.textStrong },
  readinessState: { fontSize: 9, lineHeight: 12, color: SLColors.success, fontFamily: SLFontFamilies.technical },
  readinessGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SLColors.borderHairline },
  evidenceMetric: { width: '50%', minHeight: 58, justifyContent: 'center', paddingTop: 9 },
  evidenceValue: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  evidenceLabel: { fontSize: 9, lineHeight: 12, color: SLColors.textMuted, fontFamily: SLFontFamilies.technical, marginTop: 2 },
  nextUpCard: { marginHorizontal: 14, marginTop: 10, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: 'rgba(13,13,20,0.96)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextUpTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong, marginTop: 5 },
  movementPreviewRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  movementIndex: { width: 22, fontSize: 18, lineHeight: 22, color: SLColors.textMuted, fontFamily: SLFontFamilies.numeric },
  movementName: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  movementMeta: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 1 },
  moreMovements: { ...SLTypography.body, color: SLColors.accentMuted, marginTop: 11 },
  notesCard: { marginHorizontal: 14, marginTop: 10, padding: 14, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat },
  notesText: { ...SLTypography.body, color: SLColors.textSecondary, marginTop: 8 },
  primaryAction: { height: 52, marginHorizontal: 14, marginTop: 13, borderRadius: SLRadius.control, overflow: 'hidden' },
  primaryActionFill: { flex: 1, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryActionText: { ...SLTypography.buttonLabel, color: SLColors.textStrong },
  highlightGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  bestLiftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  bestLiftName: { ...SLTypography.cardTitle, color: SLColors.textStrong },
  bestLiftValue: { ...SLTypography.body, color: SLColors.textSecondary, marginTop: 3 },
  prBadge: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#D7A942', backgroundColor: 'rgba(215,169,66,0.14)', alignItems: 'center', justifyContent: 'center' },
  prBadgeText: { ...SLTypography.chipLabel, color: '#E7C36C' },
  additionalSession: { marginHorizontal: 14, marginTop: 9, minHeight: 62, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11, overflow: 'hidden' },
  additionalTone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  additionalTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  personalEventRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderHairline },
  personalEventMark: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#C575D8' },
  personalEventTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  secondaryAction: { minHeight: 48, marginHorizontal: 14, marginTop: 10, borderRadius: SLRadius.control, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryActionText: { ...SLTypography.buttonLabel, color: SLColors.textSecondary },
  summarySheet: { maxHeight: '78%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderBottomWidth: 0, borderColor: SLColors.borderStrong, backgroundColor: SLColors.surfaceInset },
  summaryHeader: { minHeight: 65, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summarySheetTitle: { ...SLTypography.title, color: SLColors.textStrong, fontFamily: SLFontFamilies.display },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat },
  summaryContent: { paddingHorizontal: 14, paddingBottom: 36 },
  summaryMetricGrid: { flexDirection: 'row', borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderDefault, overflow: 'hidden' },
  summaryMetric: { flex: 1, minHeight: 82, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: SLColors.borderHairline },
  summaryMetricValue: { ...SLTypography.metricValue, color: SLColors.textStrong },
  summaryMetricLabel: { fontSize: 8, lineHeight: 11, color: SLColors.textMuted, fontFamily: SLFontFamilies.technical, marginTop: 4 },
  summaryFeature: { minHeight: 94, marginTop: 10, padding: 14, borderRadius: SLRadius.lg, borderWidth: 1, backgroundColor: SLColors.surfaceFlat, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryFeatureValue: { ...SLTypography.kpiNumber, marginTop: 7 },
  featureOrb: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  featureOrbText: { ...SLTypography.chipLabel },
  bodyweightSummary: { marginTop: 10, padding: 14, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat },
  bodyweightEndpoints: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  bodyweightValue: { ...SLTypography.cardTitle, color: SLColors.textStrong },
  bodyweightRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: SLColors.borderStrong, marginHorizontal: 14 },
  blockSummary: { marginTop: 10, padding: 14, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat },
  blockSummaryText: { ...SLTypography.bodyStrong, color: SLColors.textStrong, marginTop: 8 },
  noSummary: { margin: 14, padding: 22, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat, alignItems: 'center' },
  emptyTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong, marginBottom: 3 },
  utilitySheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderBottomWidth: 0, borderColor: SLColors.borderStrong, backgroundColor: SLColors.surfaceInset, paddingBottom: 34 },
  utilityEyebrow: { fontSize: 10, lineHeight: 13, color: SLColors.accentMuted, fontFamily: SLFontFamilies.technical, letterSpacing: 0.8 },
  utilityTitle: { ...SLTypography.title, color: SLColors.textStrong, marginTop: 3 },
  utilityBody: { ...SLTypography.body, color: SLColors.textMuted, paddingHorizontal: 16, marginBottom: 8 },
  filterOptions: { paddingHorizontal: 12 },
  filterOption: { minHeight: 65, marginTop: 8, paddingHorizontal: 13, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat, flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterOptionSelected: { borderColor: SLColors.borderFocus, backgroundColor: 'rgba(76,35,112,0.22)' },
  filterLabel: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: SLColors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkCircleSelected: { borderColor: SLColors.accentViolet, backgroundColor: '#5D279F' },
  clearFilters: { height: 44, marginHorizontal: 12, marginTop: 12, borderRadius: SLRadius.control, borderWidth: 1, borderColor: SLColors.borderDefault, alignItems: 'center', justifyContent: 'center' },
  clearFiltersText: { ...SLTypography.buttonLabel, color: SLColors.textSecondary },
  jumpCard: { width: '100%', maxWidth: 410, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: '#0B0911', padding: 18 },
  jumpInput: { height: 50, marginTop: 18, borderRadius: SLRadius.control, borderWidth: 1, borderColor: SLColors.borderFocus, backgroundColor: SLColors.surfaceInset, color: SLColors.textStrong, paddingHorizontal: 14, fontSize: 17, fontFamily: SLFontFamilies.numeric },
  jumpError: { ...SLTypography.caption, color: SLColors.danger, marginTop: 7 },
  jumpActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  jumpCancel: { flex: 1, height: 46, borderRadius: SLRadius.control, borderWidth: 1, borderColor: SLColors.borderDefault, alignItems: 'center', justifyContent: 'center' },
  jumpCancelText: { ...SLTypography.buttonLabel, color: SLColors.textSecondary },
  jumpSubmit: { flex: 1.3, height: 46, borderRadius: SLRadius.control, backgroundColor: '#6023A7', alignItems: 'center', justifyContent: 'center' },
  jumpSubmitText: { ...SLTypography.buttonLabel, color: SLColors.textStrong },
});
