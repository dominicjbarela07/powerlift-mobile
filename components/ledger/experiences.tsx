import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { SLCanonicalIcon, SLTrophy } from '@/components/ui';
import { FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import { getAthleteVideoArchive } from '@/lib/api';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import { canonicalCompetitionLiftKey, canonicalLiftKey, displayCalculatedWeight, displayWeight, kgToDisplay, type LedgerRange, type LedgerRequestFailureKind, type LedgerUnit } from '@/lib/ledger-data';
import { formatCalculatedWeightValue, formatWeightFromKg, kilogramsToDisplayValue, roundCalculatedWeightForDisplay } from '@/lib/display-units';
import { journeyPerformanceDetail } from '@/lib/journey-weight-presentation';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';
import { ArchiveRequestError, archiveDetailHref } from '@/lib/ledger-archive';
import {
  fetchJourneyBootstrap,
  fetchJourneyTimelinePage,
  JourneyRequestError,
  type JourneyBlock,
  type JourneyEntry,
  type JourneyOverview,
} from '@/lib/ledger-journey';
import { resolvePlateStackRender } from '@/lib/barbell/plate-stack-render-resolver';
import { strengthTierState, supportedStrengthStandard } from '@/lib/ledger-rewards';
import { canRenderGymTotal, displayWeightFromCanonicalLb } from '@/lib/milestones-layout';
import { Segmented, ledgerStyles } from './primitives';
import { CORE_LIFT_PRESENTATION, type JourneyEvent, type JourneyEvidenceReference, type JourneyMomentType } from './model';
import { LEDGER_DESTINATION_BY_KEY, type LedgerRoom, type LedgerScreen } from './routing';
import { ArchiveFoundationExperience } from './archive-foundation';
import { useLedgerLiveData } from './use-ledger-live-data';
import { fetchJourneyArchiveEvents } from './journey-live-events';
import { LedgerIndexExperience } from './index-experience';

const PROGRESSION_UNIT_KEY = 'strength-ledger.progression.unit';

type CanonicalLedgerMedia = Readonly<{
  uri: string;
  title: string;
  detail: string;
  occurredAt?: string;
}>;

type CanonicalVideoCandidate = Readonly<{
  thumbnail_url?: unknown;
  movement_name?: unknown;
  exercise_name?: unknown;
  workout_date?: unknown;
  created_at?: unknown;
  uploaded_at?: unknown;
  context?: Readonly<{ movement_name?: unknown }>;
}>;

function useLedgerNavigation() {
  const router = useRouter();
  return (screen: LedgerScreen) => {
    const destination = LEDGER_DESTINATION_BY_KEY[screen as LedgerRoom];
    if (destination) router.push(destination.route as any);
  };
}

function useArchiveNavigation() {
  const router = useRouter();
  return (params: { collection?: 'training' | 'media' | 'competition'; q?: string } = {}) => {
    router.push({
      pathname: LEDGER_DESTINATION_BY_KEY.archive.route,
      params,
    } as never);
  };
}

function Kicker({ children, tone = SLColors.accentMuted }: React.PropsWithChildren<{ tone?: string }>) {
  return <Text typographyRole="shortTechnicalLabel" style={[ledgerStyles.eyebrow, { color: tone }]}>{children}</Text>;
}

function LedgerRoomState({ kind, message, onRetry }: { kind: 'loading' | 'empty' | LedgerRequestFailureKind; message: string; onRetry?: () => void }) {
  const icon = kind === 'loading' ? 'hourglass-outline' : kind === 'empty' ? 'document-text-outline' : kind === 'unauthorized' ? 'lock-closed-outline' : kind === 'unavailable' ? 'unlink-outline' : 'alert-circle-outline';
  return <View testID={`ledger-${kind}-state`} style={styles.ledgerRoomState}>
    <Ionicons name={icon} size={28} color={SLColors.accentMuted} />
    <Text style={styles.ledgerRoomStateTitle}>{message}</Text>
    {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.ledgerRetry}><Text style={styles.ledgerRetryText}>Try again</Text></Pressable> : null}
  </View>;
}

export function HomeExperience() {
  return <LedgerIndexExperience />;
}

/**
 * Retained as an isolated canonical-data study while the maturity-aware Index
 * is validated. It is not registered in runtime Ledger navigation.
 */
export function LegacyCanonicalCuratorExperience() {
  const navigate = useLedgerNavigation();
  const router = useRouter();
  const openArchive = useArchiveNavigation();
  const { progression, currentBests, accomplishments, loading, error, errorKind, reload } = useLedgerLiveData('all');
  const [preservedEvents, setPreservedEvents] = useState<JourneyEvent[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState<LedgerRequestFailureKind | null>(null);
  const [canonicalMedia, setCanonicalMedia] = useState<CanonicalLedgerMedia | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const unit: LedgerUnit = progression?.athlete?.preferred_units?.toLowerCase().startsWith('kg') ? 'kg' : 'lb';
  const lifts = progression?.big_three_arc?.lifts ?? [];
  const primaryKey = canonicalLiftKey(progression?.strength_story?.primary_lift) ?? canonicalLiftKey(lifts[0]?.key);
  const primaryLift = primaryKey
    ? lifts.find((lift) => canonicalLiftKey(lift.key || lift.label) === primaryKey) ?? lifts[0]
    : undefined;
  const currentValue = displayCalculatedWeight(primaryLift?.current_e1rm_kg, unit);
  const changeValue = primaryLift?.change_kg == null ? null : displayCalculatedWeight(Math.abs(primaryLift.change_kg), unit);
  const recentAccomplishment = accomplishments[0];
  const achievementTitle = recentAccomplishment?.movement_label
    ? `${recentAccomplishment.movement_label}: ${recentAccomplishment.event_type.replace(/^CORE_/, '').replaceAll('_', ' ').toLowerCase()}`
    : progression?.milestones?.[0]?.title || 'No earned accomplishment yet.';
  const preservedMoment = preservedEvents[0];
  const primaryPresentation = CORE_LIFT_PRESENTATION.find((item) => canonicalLiftKey(item.key) === primaryKey)
    ?? CORE_LIFT_PRESENTATION[0];

  useEffect(() => {
    let active = true;
    fetchJourneyArchiveEvents(unit)
      .then((events) => {
        if (!active) return;
        setPreservedEvents(events);
        setArchiveError(null);
      })
      .catch((caught) => {
        console.warn('Ledger index archive snapshot request failed', caught);
        if (!active) return;
        setPreservedEvents([]);
        setArchiveError(caught instanceof ArchiveRequestError && (caught.status === 401 || caught.status === 403)
          ? 'unauthorized'
          : caught instanceof ArchiveRequestError && (caught.status === 404 || caught.status === 410)
            ? 'unavailable'
            : 'error');
      })
      .finally(() => { if (active) setArchiveLoading(false); });
    return () => { active = false; };
  }, [unit]);

  useEffect(() => {
    let active = true;
    getAthleteVideoArchive()
      .then((response) => {
        if (!active || !response.ok || !response.json?.ok || !Array.isArray(response.json.videos)) return;
        const videos = response.json.videos as CanonicalVideoCandidate[];
        const video = videos.find((candidate) => typeof candidate.thumbnail_url === 'string' && candidate.thumbnail_url.length > 0);
        if (!video) return;
        const movement = [video.movement_name, video.exercise_name, video.context?.movement_name]
          .find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0)
          ?? 'Preserved lift video';
        const occurredAt = [video.workout_date, video.created_at, video.uploaded_at]
          .find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);
        setCanonicalMedia({
          uri: video.thumbnail_url as string,
          title: movement,
          detail: occurredAt ? `Preserved ${new Date(occurredAt).toLocaleDateString()}` : 'Preserved training evidence',
          occurredAt,
        });
      })
      .catch((caught) => console.warn('Ledger index canonical media request failed', caught))
      .finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || archiveLoading || mediaLoading) {
    return <View style={[styles.page, styles.curatorPage]} testID="ledger-home-experience"><LedgerRoomState kind="loading" message="Loading canonical Ledger evidence." /></View>;
  }
  if (error) {
    return <View style={[styles.page, styles.curatorPage]} testID="ledger-home-experience"><LedgerRoomState kind={errorKind ?? 'error'} message={error} onRetry={() => void reload()} /></View>;
  }

  const heroRoom: LedgerRoom = canonicalMedia
    ? 'archive'
    : recentAccomplishment
      ? 'achievements'
      : currentValue !== '—'
        ? 'strength'
        : 'journey';
  const heroTitle = heroRoom === 'archive'
    ? canonicalMedia?.title || 'Preserved evidence'
    : heroRoom === 'achievements'
      ? achievementTitle
      : heroRoom === 'strength'
        ? progression?.strength_story?.title || `${primaryLift?.label || primaryPresentation.key} strength`
        : preservedMoment?.title || 'Your permanent record starts here.';
  const heroBody = heroRoom === 'archive'
    ? canonicalMedia?.detail || 'Open the preserved source.'
    : heroRoom === 'achievements'
      ? (currentBests.length ? `${currentBests.length} canonical current bests are preserved.` : 'Open the source-backed accomplishment.')
      : heroRoom === 'strength'
        ? progression?.strength_story?.body || 'Open the evidence behind your current capability.'
        : preservedMoment?.detail || 'Complete Training Sessions or competitions to begin building a durable timeline.';
  const openHero = () => heroRoom === 'archive' ? openArchive({ collection: 'media' }) : navigate(heroRoom);

  return (
    <View style={[styles.page, styles.curatorPage]} testID="ledger-home-experience">
      <View style={styles.curatorIntro}>
        <Kicker>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Kicker>
        <Text style={styles.curatorIntroTitle}>What deserves your attention today.</Text>
        <Text style={styles.curatorIntroBody}>A few meaningful things from your strength, history, and evidence.</Text>
      </View>
      <Pressable testID={`ledger-${heroRoom}-snapshot`} accessibilityLabel={`Open curated ${heroRoom} evidence`} onPress={openHero} style={({ pressed }) => [styles.todayHero, pressed && styles.pressed]}>
        {canonicalMedia ? <ImageBackground source={{ uri: canonicalMedia.uri }} resizeMode="cover" style={styles.todayHeroImage} imageStyle={styles.todayHeroImageRadius}>
          <View style={styles.todayHeroScrim} />
          <View style={styles.todayHeroBadge}><Ionicons name="play" size={14} color="#FFFFFF" /><Text style={styles.todayHeroBadgeText}>PRESERVED EVIDENCE</Text></View>
          <View style={styles.todayHeroCopy}>
            <Text style={styles.todayHeroDate}>TODAY’S EXHIBIT · ARCHIVE</Text>
            <Text style={styles.todayHeroTitle}>{heroTitle}</Text>
            <Text style={styles.todayHeroQuote}>{heroBody}</Text>
            <View style={styles.todayHeroFooter}><Text style={styles.todayHeroSource}>OPEN THE SOURCE</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></View>
          </View>
        </ImageBackground> : <View style={styles.todayHeroImage}>
          <View style={styles.heroArtifactMark}>
            {heroRoom === 'strength' ? <Image source={primaryPresentation.image} style={[styles.heroArtifactImage, { tintColor: primaryPresentation.color }]} resizeMode="contain" /> : heroRoom === 'achievements' ? <SLTrophy size={62} /> : <Ionicons name="time-outline" size={62} color="#C7A1FF" />}
          </View>
          <View style={styles.todayHeroCopy}>
            <Text style={styles.todayHeroDate}>TODAY’S EXHIBIT · {heroRoom.toUpperCase()}</Text>
            <Text style={styles.todayHeroTitle}>{heroTitle}</Text>
            <Text style={styles.todayHeroQuote}>{heroBody}</Text>
            <View style={styles.todayHeroFooter}><Text style={styles.todayHeroSource}>OPEN {heroRoom.toUpperCase()}</Text><Ionicons name="arrow-forward" size={18} color="#E9E1F8" /></View>
          </View>
        </View>}
      </Pressable>

      {heroRoom !== 'journey' ? <Pressable testID="ledger-journey-snapshot" accessibilityLabel="Open recent career evidence in Journey" onPress={() => navigate('journey')} style={({ pressed }) => [styles.careerExhibit, pressed && styles.pressed]}>
        <View style={styles.careerExhibitDate}><Text style={styles.careerExhibitDay}>{preservedMoment?.date || '—'}</Text><Text style={styles.careerExhibitYear}>{preservedMoment?.year || 'JOURNEY'}</Text></View>
        <View style={styles.careerExhibitCopy}><Kicker>FROM YOUR JOURNEY</Kicker><Text style={styles.careerExhibitTitle}>{preservedMoment?.title || (archiveError ? 'Career evidence is unavailable.' : 'No recorded career moments yet.')}</Text><Text style={styles.careerExhibitBody}>{preservedMoment?.detail || 'Your first preserved moment will live here.'}</Text></View>
        <Ionicons name="arrow-forward" size={18} color={SLColors.textMuted} />
      </Pressable> : null}

      {heroRoom !== 'strength' ? <Pressable testID="ledger-strength-snapshot" accessibilityLabel="Open current strength" onPress={() => navigate('strength')} style={({ pressed }) => [styles.strengthMoment, pressed && styles.pressed]}>
        <View style={styles.curatorMomentHeader}><Kicker tone="#FF8799">CURRENT STRENGTH</Kicker><Ionicons name="arrow-forward" size={18} color={SLColors.textMuted} /></View>
        <View style={styles.strengthEditorialRow}>
          <View style={styles.strengthEditorialCopy}><Text style={styles.strengthMomentTitle}>{progression?.strength_story?.title || 'Your strength record is still taking shape.'}</Text><Text style={styles.strengthMomentBody}>{progression?.strength_story?.body || 'Log qualifying work to build a trustworthy current estimate.'}</Text></View>
          <Image source={primaryPresentation.image} style={[styles.strengthEditorialImage, { tintColor: primaryPresentation.color }]} resizeMode="contain" />
        </View>
        <View style={styles.strengthMomentEvidence}><View style={styles.valueUnit}><Text style={styles.strengthMomentValue}>{currentValue}</Text><Text style={styles.strengthMomentUnit}>{unit.toUpperCase()}</Text></View>{changeValue ? <View style={styles.strengthMomentDelta}><Ionicons name="trending-up" size={16} color="#53DA92" /><Text style={styles.strengthMomentDeltaText}>{changeValue} {unit} in range</Text></View> : null}</View>
        {primaryLift?.points?.length ? <View style={styles.strengthMomentProof}><Text style={styles.strengthMomentProofText}>{primaryLift.points.length} qualifying weekly estimates · {progression?.range?.label || 'all time'}</Text></View> : null}
      </Pressable> : null}

      {heroRoom !== 'achievements' ? <Pressable testID="ledger-achievements-snapshot" accessibilityLabel="Open earned achievements" onPress={() => navigate('achievements')} style={({ pressed }) => [styles.achievementMoment, pressed && styles.pressed]}>
        <View style={styles.achievementMomentCopy}>
          <Kicker tone="#E7B85F">ACHIEVEMENTS</Kicker>
          <Text style={styles.achievementMomentTitle}>{achievementTitle}</Text>
          <Text style={styles.achievementMomentBody}>{currentBests.length ? `${currentBests.length} canonical current bests are preserved.` : 'Earned accomplishments appear when their source evidence qualifies.'}</Text>
        </View>
        {currentBests.length ? <View style={styles.achievementDisc}><Text style={styles.achievementDiscValue}>{currentBests.length}</Text><Text style={styles.achievementDiscLabel}>BESTS</Text></View> : null}
      </Pressable> : null}

      {heroRoom !== 'archive' ? <Pressable testID="ledger-archive-snapshot" accessibilityLabel="Open preserved source evidence in Archive" onPress={() => preservedMoment?.href ? router.push(preservedMoment.href as any) : openArchive()} style={({ pressed }) => [styles.archiveMoment, pressed && styles.pressed]}>
        {canonicalMedia ? <ImageBackground source={{ uri: canonicalMedia.uri }} resizeMode="cover" style={styles.archiveMomentMedia} imageStyle={styles.archiveMomentMediaRadius}><View style={styles.archiveMomentScrim} /><View style={styles.archivePlay}><Ionicons name="play" size={20} color="#FFFFFF" /></View></ImageBackground> : <View style={styles.archiveMomentMedia}><View style={styles.archiveArtifactStack}><View style={styles.archiveArtifactSheet} /><View style={[styles.archiveArtifactSheet, styles.archiveArtifactSheetFront]}><Ionicons name="archive-outline" size={25} color="#8DCBC0" /></View></View></View>}
        <View style={styles.archiveMomentCopy}>
          <Kicker tone="#55D9CC">PRESERVED EVIDENCE</Kicker>
          <Text style={styles.archiveMomentTitle}>{preservedMoment?.title || (archiveError ? 'Archive evidence is unavailable.' : 'No archived evidence yet.')}</Text>
          <Text style={styles.archiveMomentBody}>{preservedMoment?.detail || (archiveError ? 'Try again when the source record is available.' : 'Training · media · competition')}</Text>
          <View style={styles.archiveMomentFooter}><Text style={styles.archiveMomentAction}>Open the evidence</Text><Ionicons name="arrow-forward" size={16} color="#91A0AE" /></View>
        </View>
      </Pressable> : null}

      {preservedEvents[1] ? <Pressable accessibilityLabel="Open recent career evidence in Journey" onPress={() => navigate('journey')} style={({ pressed }) => [styles.careerMoment, pressed && styles.pressed]}>
        <View style={styles.careerMomentIcon}><Ionicons name="flag-outline" size={20} color="#B993FF" /></View>
        <View style={styles.careerMomentCopy}><Kicker>JOURNEY</Kicker><Text style={styles.careerMomentTitle}>{preservedEvents[1].title}</Text><Text style={styles.careerMomentBody}>{preservedEvents[1].detail}</Text></View>
        <Ionicons name="arrow-forward" size={17} color={SLColors.textMuted} />
      </Pressable> : null}

      {recentAccomplishment ? <Pressable accessibilityLabel="Open recent canonical accomplishment" onPress={() => navigate('achievements')} style={({ pressed }) => [styles.discoveryMoment, pressed && styles.pressed]}>
        <Ionicons name="sparkles-outline" size={20} color="#C6A4FF" />
        <View style={styles.discoveryMomentCopy}><Text style={styles.discoveryMomentLabel}>CANONICAL ACCOMPLISHMENT</Text><Text style={styles.discoveryMomentTitle}>{achievementTitle}</Text><Text style={styles.discoveryMomentBody}>{recentAccomplishment.occurred_at ? new Date(recentAccomplishment.occurred_at).toLocaleDateString() : 'Date unavailable'}</Text></View>
        <Ionicons name="arrow-forward" size={17} color={SLColors.textMuted} />
      </Pressable> : null}
    </View>
  );
}

export function JourneyExperience() {
  const router = useRouter();
  const [view, setView] = useState<'Overview' | 'Blocks' | 'Timeline'>('Overview');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [expanded, setExpanded] = useState('');
  const [includeSessions, setIncludeSessions] = useState(false);
  const [overview, setOverview] = useState<JourneyOverview | null>(null);
  const [blocks, setBlocks] = useState<JourneyBlock[]>([]);
  const [journeyEntries, setJourneyEntries] = useState<JourneyEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [journeyLoading, setJourneyLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [journeyErrorKind, setJourneyErrorKind] = useState<LedgerRequestFailureKind | null>(null);
  const { unit, setUnit } = useSurfaceWeightUnit(overview?.athlete.preferred_units);
  const allMoments = useMemo(() => journeyEntries.map((entry) => journeyMomentFromEntry(entry, unit)), [journeyEntries, unit]);
  const availableYears = useMemo(() => [...new Set(allMoments.map((event) => event.year))].sort().reverse(), [allMoments]);
  const activeYear = selectedYear && availableYears.includes(selectedYear)
    ? selectedYear
    : availableYears[0] ?? String(new Date().getFullYear());
  const moments = useMemo(() => allMoments.filter((event) => event.year === activeYear), [activeYear, allMoments]);
  const combinedError = journeyError;
  const combinedErrorKind = journeyErrorKind || 'error';

  const loadJourney = useCallback(() => {
    let active = true;
    setJourneyLoading(true);
    setSelectedYear(null);
    fetchJourneyBootstrap({ limit: 24, includeSessions })
      .then((bootstrap) => {
        if (!active) return;
        const nextOverview = bootstrap;
        const nextBlocks = bootstrap.blocks.items;
        const page = bootstrap.timeline;
        setOverview(nextOverview);
        setBlocks(nextBlocks);
        setJourneyEntries(page.items);
        setNextCursor(page.next_cursor ?? null);
        setHasMore(page.has_more);
        setJourneyError(null);
        setJourneyErrorKind(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setOverview(null);
        setBlocks([]);
        setJourneyEntries([]);
        console.warn('Journey historical projection request failed', error);
        const kind = error instanceof JourneyRequestError && (error.status === 401 || error.status === 403)
          ? 'unauthorized'
          : error instanceof JourneyRequestError && (error.status === 404 || error.status === 410)
            ? 'unavailable'
            : 'error';
        setJourneyErrorKind(kind);
        setJourneyError(kind === 'unauthorized' ? 'Journey is not available to this account.' : kind === 'unavailable' ? 'Journey history is unavailable.' : 'Journey history could not be loaded.');
      })
      .finally(() => {
        if (active) setJourneyLoading(false);
      });
    return () => { active = false; };
  }, [includeSessions]);

  useEffect(() => loadJourney(), [loadJourney]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchJourneyTimelinePage({ limit: 24, cursor: nextCursor, includeSessions });
      setJourneyEntries((current) => [...current, ...page.items]);
      setNextCursor(page.next_cursor ?? null);
      setHasMore(page.has_more);
    } catch (error) {
      console.warn('Journey continuation request failed', error);
      setJourneyError('More Journey history could not be loaded.');
      setJourneyErrorKind('error');
    } finally {
      setLoadingMore(false);
    }
  }, [includeSessions, loadingMore, nextCursor, unit]);

  if (journeyLoading) return <View style={[styles.page, styles.journeyPage]} testID="ledger-journey-experience"><LedgerRoomState kind="loading" message="Loading preserved career evidence." /></View>;
  if (combinedError && !overview) return <View style={[styles.page, styles.journeyPage]} testID="ledger-journey-experience"><LedgerRoomState kind={combinedErrorKind} message={combinedError} onRetry={() => loadJourney()} /></View>;
  if (!overview?.earliest_record) return <View style={[styles.page, styles.journeyPage]} testID="ledger-journey-experience"><LedgerRoomState kind="empty" message="No recorded career evidence yet." /></View>;

  return (
    <View style={[styles.page, styles.journeyPage]} testID="ledger-journey-experience">
      <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="ledger-journey-unit-toggle" />
      <View style={styles.journeyIntro}>
        <Kicker>YOUR COMPLETE RECORD</Kicker>
        <Text style={styles.journeyIntroTitle}>Journey</Text>
        <Text style={styles.journeyIntroBody}>From {formatJourneyDate(overview.earliest_record.date)} to today. Reconstructed from your preserved Strength Ledger evidence.</Text>
      </View>
      <Segmented values={['Overview', 'Blocks', 'Timeline'] as const} value={view} onChange={setView} />

      {view === 'Overview' ? <JourneyOverviewView overview={overview} unit={unit} /> : null}
      {view === 'Blocks' ? <JourneyBlocksView blocks={blocks} unit={unit} /> : null}
      {view === 'Timeline' ? <>
        <View style={styles.journeyYearRail} accessibilityRole="tablist">
          {(availableYears.length ? availableYears : [activeYear]).map((year) => {
            const selected = year === activeYear;
            return <Pressable key={year} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { setSelectedYear(year); setExpanded(''); }} style={[styles.journeyYearNode, selected && styles.journeyYearNodeActive]}><Text style={[styles.journeyYearText, selected && styles.journeyYearTextActive]}>{year}</Text><View style={[styles.journeyYearDot, selected && styles.journeyYearDotActive]}>{selected ? <View style={styles.journeyYearDotCore} /> : null}</View></Pressable>;
          })}
        </View>

        <View style={styles.journeySectionHeader}>
          <View style={styles.journeySectionLead}><Ionicons name="time-outline" size={17} color={SLColors.accentMuted} /><Text style={styles.journeySectionTitle}>Career timeline</Text></View>
          <Pressable accessibilityLabel="Include every completed Training Session" accessibilityState={{ selected: includeSessions }} onPress={() => setIncludeSessions((value) => !value)} style={({ pressed }) => [styles.journeyFilter, pressed && styles.pressed]}><Ionicons name="filter-outline" size={17} color={SLColors.accentMuted} /><Text style={styles.journeyFilterText}>{includeSessions ? 'All sessions' : 'Major events'}</Text></Pressable>
        </View>

        <View style={styles.journeyTimeline}>
          {combinedError ? <LedgerRoomState kind={combinedErrorKind} message={combinedError} onRetry={() => loadJourney()} /> : null}
          {!combinedError && moments.length === 0 ? <LedgerRoomState kind="empty" message="No career moments match this year." /> : null}
          {moments.map((moment, index) => {
            return <JourneyMoment key={moment.id} event={moment} expanded={expanded === moment.id} isLast={index === moments.length - 1} onPress={() => setExpanded(expanded === moment.id ? '' : moment.id)} onOpenEvidence={(reference) => router.push({ pathname: reference.href as any, params: { displayUnit: unit } } as any)} />;
          })}
          {hasMore ? <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void loadMore()} style={({ pressed }) => [styles.journeyLoadMore, pressed && styles.pressed]}><Text style={styles.journeyLoadMoreText}>{loadingMore ? 'Loading earlier history…' : 'Load earlier history'}</Text><Ionicons name="arrow-down" size={15} color="#B999F1" /></Pressable> : null}
        </View>
      </> : null}

    </View>
  );
}

function JourneyOverviewView({ overview, unit }: { overview: JourneyOverview; unit: LedgerUnit }) {
  const summary = overview.lifetime;
  const reported = overview.bodyweight_context;
  const latestReportedKg = reported.latest?.reported_bodyweight_kg ?? reported.latest?.weight_kg;
  const latestReportedDate = reported.latest?.training_date ?? reported.latest?.date;
  const recentReportedObservations = reported.recent_observations?.length
    ? reported.recent_observations
    : reported.latest && latestReportedKg != null
      ? [{ ...reported.latest, reported_bodyweight_kg: latestReportedKg, training_date: latestReportedDate }]
      : [];
  return <View testID="ledger-journey-overview" style={styles.journeyOverview}>
    <View style={styles.journeyMetricGrid}>
      {[
        [String(summary.sessions_completed), 'SESSIONS'],
        [String(summary.total_sets), 'SETS'],
        [String(summary.pr_count), 'HISTORICAL PRS'],
        [String(summary.block_count), 'BLOCKS'],
      ].map(([value, label]) => <View key={label} style={styles.journeyMetricCard}><Text style={styles.journeyMetricValue}>{value}</Text><Text style={styles.journeyMetricLabel}>{label}</Text></View>)}
    </View>
    <View style={styles.journeyRecordCard}>
      <Kicker>EARLIEST TRUSTWORTHY RECORD</Kicker>
      <Text style={styles.journeyRecordDate}>{formatJourneyDate(overview.earliest_record?.date)}</Text>
      <Text style={styles.journeyRecordBody}>Your lifetime summary uses the complete preserved record—not a feature-launch date.</Text>
    </View>
    <View testID="ledger-reported-bodyweight-history" style={styles.journeyRecordCard}>
      <Kicker tone="#76CBD0">REPORTED BODYWEIGHT</Kicker>
      <Text style={styles.journeyRecordDate}>{latestReportedKg != null ? `${formatJourneyWeight(latestReportedKg, unit)} ${unit.toUpperCase()}` : 'No reports yet'}</Text>
      <Text style={styles.journeyRecordBody}>{latestReportedKg != null ? `Latest reported · ${formatJourneyDate(latestReportedDate)} · pre-Session evidence` : 'No profile weight is substituted.'}</Text>
      {reported.comparison ? <Text style={styles.journeyBodyweightTrend}>{formatJourneyWeight(reported.comparison.start.reported_bodyweight_kg, unit)} → {formatJourneyWeight(reported.comparison.end.reported_bodyweight_kg, unit)} {unit.toUpperCase()} · {formatJourneyDate(reported.comparison.start.training_date)} – {formatJourneyDate(reported.comparison.end.training_date)}</Text> : null}
      {recentReportedObservations.map((observation) => <View key={observation.id} style={styles.journeyBodyweightObservation}><Text style={styles.journeyBodyweightDate}>{formatJourneyDate(observation.training_date)}</Text><Text style={styles.journeyBodyweightValue}>{formatJourneyWeight(observation.reported_bodyweight_kg, unit)} {unit.toUpperCase()}</Text><Text style={styles.journeyBodyweightSession}>{observation.session?.label || 'Readiness report'}</Text></View>)}
    </View>
    {overview.current_block ? <View style={styles.journeyCurrentBlock}><View><Kicker>CURRENT BLOCK</Kicker><Text style={styles.journeyCurrentBlockTitle}>{overview.current_block.name}</Text></View><Text style={styles.journeyCurrentBlockDate}>{formatJourneyRange(overview.current_block.start_date, overview.current_block.end_date)}</Text></View> : null}
  </View>;
}

function JourneyBlocksView({ blocks, unit }: { blocks: JourneyBlock[]; unit: LedgerUnit }) {
  if (!blocks.length) return <LedgerRoomState kind="empty" message="No recoverable program blocks are recorded yet." />;
  return <View testID="ledger-journey-blocks" style={styles.journeyBlocks}>
    {blocks.map((block) => <View key={block.id} style={[styles.journeyBlockCard, block.state === 'current' && styles.journeyBlockCardCurrent]}>
      <View style={styles.journeyBlockHeader}><View style={styles.journeyBlockCopy}><Kicker tone={block.state === 'current' ? '#B993FF' : '#7F8999'}>{block.state === 'current' ? 'CURRENT BLOCK' : block.program?.name?.toUpperCase() || 'TRAINING BLOCK'}</Kicker><Text style={styles.journeyBlockTitle}>{block.name}</Text></View><Ionicons name="layers-outline" size={22} color={block.state === 'current' ? '#B993FF' : '#7F8999'} /></View>
      <Text style={styles.journeyBlockRange}>{formatJourneyRange(block.start_date, block.end_date)}</Text>
      <View style={styles.journeyBlockStats}><Text style={styles.journeyBlockStat}>{block.session_count} Sessions</Text><Text style={styles.journeyBlockStat}>{block.pr_count} PRs</Text><Text style={styles.journeyBlockStat}>{block.state === 'historical_range' ? 'Historical range' : block.state}</Text></View>
      {block.reported_bodyweight?.start && block.reported_bodyweight.end_or_latest && block.reported_bodyweight.change_kg != null ? <Text style={styles.journeyBlockBodyweight}>Reported BW · {formatJourneyWeight(block.reported_bodyweight.start.reported_bodyweight_kg, unit)} → {formatJourneyWeight(block.reported_bodyweight.end_or_latest.reported_bodyweight_kg, unit)} {unit.toUpperCase()} · observations within {block.reported_bodyweight.boundary_window_days} days of boundaries</Text> : null}
    </View>)}
  </View>;
}

function formatJourneyDate(value?: string | null): string {
  if (!value) return 'Date unavailable';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatJourneyRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Dates unavailable';
  if (!end) return `Started ${formatJourneyDate(start)}`;
  return `${formatJourneyDate(start)} – ${formatJourneyDate(end)}`;
}

function formatJourneyWeight(valueKg: number, unit: LedgerUnit): string {
  return formatWeightFromKg(valueKg, unit)?.replace(/ (?:kg|lb)$/, '') ?? '—';
}

function journeyMomentFromEntry(entry: JourneyEntry, unit: LedgerUnit): JourneyEvent {
  const persistedSource = entry.source_kind === 'persisted';
  const date = new Date(`${entry.occurred_on}T12:00:00`);
  const presentation: Record<string, { type: JourneyMomentType; icon: keyof typeof Ionicons.glyphMap; tone: string; label: string }> = {
    FIRST_WORKOUT: { type: 'first-workout', icon: 'barbell-outline', tone: '#A86BFF', label: 'FIRST SESSION' },
    SESSION_COMPLETED: { type: 'session-completed', icon: 'checkmark-circle-outline', tone: '#7F8999', label: 'SESSION' },
    SESSION_SUMMARY: { type: 'session-completed', icon: 'reader-outline', tone: '#7F8999', label: 'SESSION SUMMARY' },
    PERFORMANCE: { type: 'major-pr', icon: 'barbell-outline', tone: '#A86BFF', label: 'PERFORMANCE' },
    PROGRAM_STARTED: { type: 'program-started', icon: 'map-outline', tone: '#42D5C2', label: 'PROGRAM' },
    PROGRAM_COMPLETED: { type: 'program-completed', icon: 'flag-outline', tone: '#42D5C2', label: 'PROGRAM COMPLETE' },
    BLOCK_STARTED: { type: 'block-started', icon: 'layers-outline', tone: '#B993FF', label: 'BLOCK' },
    COMPETITION: { type: 'competition', icon: 'trophy-outline', tone: '#E4A624', label: 'MEET' },
    VOLUME_MILESTONE: { type: 'volume-milestone', icon: 'ribbon-outline', tone: '#E4A624', label: 'MILESTONE' },
    IMPORTED_HISTORY: { type: 'imported-history', icon: 'time-outline', tone: '#7FA7D8', label: 'HISTORICAL' },
    SIGNIFICANT_VIDEO: { type: 'significant-video', icon: 'videocam-outline', tone: '#55D9CC', label: 'COACH REVIEW' },
    MOVEMENT_ADDED: { type: 'movement-added', icon: 'add-circle-outline', tone: '#55D9CC', label: 'ACCESSORY' },
    VARIANT_INTRODUCED: { type: 'variant-introduced', icon: 'git-branch-outline', tone: '#FF8799', label: 'VARIANT' },
    WEIGHT_PR: { type: 'major-pr', icon: 'trophy-outline', tone: '#A86BFF', label: 'WEIGHT PR' },
    REP_PR: { type: 'major-pr', icon: 'trophy-outline', tone: '#C289FF', label: 'REP PR' },
    E1RM_PR: { type: 'major-pr', icon: 'trending-up-outline', tone: '#FF8799', label: 'E1RM PR' },
    ACHIEVEMENT_EARNED: { type: 'volume-milestone', icon: 'ribbon-outline', tone: '#E4A624', label: 'ACHIEVEMENT' },
  };
  const visual = presentation[entry.event_type] ?? presentation.IMPORTED_HISTORY;
  const performance = entry.performance;
  const detail = journeyPerformanceDetail(entry.event_type, performance, unit, entry.detail);
  const contextualEvidence = (entry.evidence ?? {}) as Record<string, any>;
  const reportedBodyweight = contextualEvidence.reported_bodyweight;
  const accomplishmentTags = Array.isArray(contextualEvidence.accomplishments)
    ? contextualEvidence.accomplishments.map((row: any) => ({ label: String(row.label || 'Achievement').toUpperCase(), tone: '#C289FF' }))
    : [];
  const completion = contextualEvidence.completion;
  const sourceHref = entry.source.href;
  const sourceKind: JourneyEvidenceReference['kind'] = entry.source.type === 'set_video_attachment'
    ? 'video'
    : entry.source.type === 'meet_plan'
    ? 'meet'
    : entry.source.type === 'historical_performance'
      ? 'historical-performance'
      : entry.source.set_log_id
        ? 'set'
        : 'workout';
  return {
    id: entry.id,
    type: visual.type,
    importance: entry.importance,
    presentationPriority: entry.importance === 'landmark' ? 300 : entry.importance === 'major' ? 200 : 100,
    year: String(date.getFullYear()),
    date: date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase(),
    occurredAt: entry.occurred_at || entry.occurred_on,
    title: entry.title,
    detail,
    expandedDetail: [
      detail,
      completion?.completed_set_count != null ? `${completion.completed_set_count}${completion.prescribed_set_count ? `/${completion.prescribed_set_count}` : ''} prescribed sets completed` : null,
      reportedBodyweight?.reported_bodyweight_kg != null ? `Reported BW ${formatJourneyWeight(reportedBodyweight.reported_bodyweight_kg, unit)} ${unit}` : null,
      contextualEvidence.session?.label ? `${contextualEvidence.session.label} · ${formatJourneyDate(entry.occurred_on)}` : formatJourneyDate(entry.occurred_on),
      contextualEvidence.equipment?.manufacturer || contextualEvidence.equipment?.model ? [contextualEvidence.equipment.manufacturer, contextualEvidence.equipment.model].filter(Boolean).join(' · ') : null,
      contextualEvidence.video?.attached ? 'Video attached' : null,
      persistedSource ? 'Persisted canonical evidence' : 'Deterministically reconstructed historical evidence',
    ].filter(Boolean).join('\n'),
    icon: visual.icon,
    tone: visual.tone,
    tags: [{ label: visual.label, tone: visual.tone }, ...accomplishmentTags, { label: entry.source_kind.toUpperCase(), tone: '#8D98A9' }],
    evidence: sourceHref ? [{ id: `source:${entry.source.type}:${entry.source.id}`, kind: sourceKind, label: 'Open source evidence', href: sourceHref }] : [],
    href: sourceHref ?? undefined,
  };
}

function JourneyMoment({ event, expanded, isLast, onPress, onOpenEvidence }: { event: JourneyEvent; expanded: boolean; isLast: boolean; onPress: () => void; onOpenEvidence: (reference: JourneyEvidenceReference) => void }) {
  const tone = event.tone ?? SLColors.accent;
  return (
    <View style={styles.journeyMoment}>
      <View style={styles.journeyMomentDate}><Text style={styles.journeyDateText}>{event.date}</Text><Text style={styles.journeyDateYear}>{event.year}</Text></View>
      <View style={styles.journeyAxis}><View style={[styles.journeySpine, isLast && styles.journeySpineLast]} /><View style={[styles.journeyDot, { backgroundColor: tone }]} /></View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={({ pressed }) => [styles.journeyCard, expanded && { borderColor: `${tone}82` }, pressed && styles.pressed]}>
        <View style={[styles.journeyIcon, { borderColor: `${tone}4F`, backgroundColor: `${tone}0D` }]}><SLCanonicalIcon name={event.icon as keyof typeof Ionicons.glyphMap} size={20} color={tone} trophyTier={event.tags.some((tag) => tag.label === 'MEET') ? 'bronze' : 'gold'} /></View>
        <View style={styles.journeyCardBody}>
          <Text numberOfLines={1} style={styles.journeyCardTitle}>{event.title}</Text>
          <Text numberOfLines={expanded ? undefined : 2} style={styles.journeyCardDetail}>{expanded && event.expandedDetail ? event.expandedDetail : event.detail}</Text>
          <View style={styles.journeyTags}>{event.tags.map((tag) => <View key={`${event.id}-${tag.label}`} style={[styles.journeyTag, { borderColor: `${tag.tone ?? tone}7A` }]}><Text style={[styles.journeyTagText, { color: tag.tone ?? tone }]}>{tag.label}</Text></View>)}</View>
          {expanded ? <View style={styles.journeyEvidenceList}>{event.evidence.map((reference) => { const icon = reference.kind === 'video' ? 'videocam-outline' : reference.kind === 'meet' ? 'trophy-outline' : reference.kind === 'strength' ? 'trending-up-outline' : reference.kind === 'achievement' ? 'ribbon-outline' : 'document-text-outline'; return <Pressable key={reference.id} accessibilityRole="link" accessibilityLabel={`Open ${reference.label}`} onPress={() => onOpenEvidence(reference)} style={({ pressed }) => [styles.journeyEvidenceLink, pressed && styles.pressed]}><SLCanonicalIcon name={icon} size={13} color={tone} trophyTier={reference.kind === 'meet' ? 'bronze' : 'gold'} /><Text style={styles.journeyEvidenceText}>{reference.label}</Text><Ionicons name="arrow-forward" size={12} color="#8D98A9" /></Pressable>; })}</View> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color="#8D98A9" style={styles.journeyChevron} />
      </Pressable>
    </View>
  );
}

function CanonicalStrengthTrendPlot({ points, dates, color, label, unit }: { points: readonly number[]; dates: readonly string[]; color: string; label: string; unit: LedgerUnit }) {
  return <AnalyticalTimeSeriesChart
    emptyBody="At least two qualifying estimated-strength observations are required."
    emptyTitle="Not enough qualifying evidence"
    height={220}
    metric={analyticalMetricDefinition('estimated_1rm', { label, kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 0 })}
    series={[{ key: 'estimated_strength', label: 'Estimated strength', color, points: points.map((value, index) => ({ date: dates[index] || '', value })) }]}
    showLegend={false}
    testID="ledger-estimated-strength-chart"
  />;
}

export function StrengthExperience() {
  const router = useRouter();
  const openArchive = useArchiveNavigation();
  const [focusLiftIndex, setFocusLiftIndex] = useState(2);
  const [proofExpanded, setProofExpanded] = useState(false);
  const [range, setRange] = useState<LedgerRange>('90d');
  const [unit, setUnit] = useState<LedgerUnit>('lb');
  const [unitPreferenceLoaded, setUnitPreferenceLoaded] = useState(false);
  const [hasStoredUnitPreference, setHasStoredUnitPreference] = useState(false);
  const { progression, currentBests, accomplishments, loading, error, errorKind, reload } = useLedgerLiveData(range);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PROGRESSION_UNIT_KEY)
      .then((stored) => {
        if (!active || (stored !== 'kg' && stored !== 'lb')) return;
        setUnit(stored);
        setHasStoredUnitPreference(true);
      })
      .catch(() => {})
      .finally(() => { if (active) setUnitPreferenceLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!unitPreferenceLoaded || hasStoredUnitPreference) return;
    setUnit(progression?.athlete?.preferred_units?.toLowerCase().startsWith('kg') ? 'kg' : 'lb');
  }, [hasStoredUnitPreference, progression?.athlete?.preferred_units, unitPreferenceLoaded]);

  const changeUnit = useCallback((next: LedgerUnit) => {
    setUnit(next);
    setHasStoredUnitPreference(true);
    void AsyncStorage.setItem(PROGRESSION_UNIT_KEY, next);
  }, []);
  const baseProfile = useMemo(() => CORE_LIFT_PRESENTATION.map((lift) => ({ ...lift })), []);
  const profile = useMemo(() => baseProfile.map((base) => {
    const key = canonicalLiftKey(base.key);
    const live = progression?.big_three_arc?.lifts?.find((lift) => canonicalLiftKey(lift.key || lift.label) === key);
    const e1rmBest = currentBests
      .filter((item) => canonicalLiftKey(item.core_movement_key || item.movement_label) === key && item.metric === 'e1rm')
      .sort((left, right) => right.best_value - left.best_value)[0];
    const weightBest = currentBests
      .filter((item) => canonicalCompetitionLiftKey(item.core_movement_key) === key && item.metric === 'weight')
      .sort((left, right) => right.best_value - left.best_value)[0];
    const currentKg = live?.current_e1rm_kg ?? e1rmBest?.best_value;
    const peakKg = live?.best_e1rm_kg ?? e1rmBest?.best_value;
    const livePoints = (live?.points ?? [])
      .map((point) => point.value_kg)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value) => kgToDisplay(value, unit));
    const pointDates = (live?.points ?? [])
      .filter((point) => typeof point.value_kg === 'number' && Number.isFinite(point.value_kg))
      .map((point) => point.date ?? null);
    const current = currentKg == null ? null : kgToDisplay(currentKg, unit);
    const peak = peakKg == null ? null : kgToDisplay(peakKg, unit);
    const points = livePoints;
    const best = current == null ? null : roundCalculatedWeightForDisplay(current, unit);
    const peakValue = peak == null ? best : roundCalculatedWeightForDisplay(peak, unit);
    const delta = live?.change_kg == null ? null : roundCalculatedWeightForDisplay(Math.abs(kgToDisplay(live.change_kg, unit)), unit);
    const retention = peakValue != null && peakValue > 0 && best != null ? Math.min(100, Math.round((best / peakValue) * 100)) : null;
    const liftEvents = accomplishments.filter((event) => canonicalLiftKey(event.core_movement_key || event.movement_label) === key);
    const bodyweightEvent = liftEvents.find((event) => event.reported_bodyweight?.reported_bodyweight_kg != null);
    const repEvent = liftEvents.find((event) => event.event_type.includes('SAME_WEIGHT_REP'));
    const weightEvents = liftEvents.filter((event) => event.event_type === 'CORE_WEIGHT_PR' || event.event_type === 'CORE_BLOCK_WEIGHT_BEST');
    const evidence = (repEvent?.evidence ?? {}) as Record<string, unknown>;
    const comparisonKg = typeof evidence.actual_weight_kg === 'number' ? evidence.actual_weight_kg : null;
    const topHistory = weightEvents
      .map((event) => typeof event.current_value === 'number' ? displayWeight(event.current_value, unit) : null)
      .filter((value): value is string => !!value)
      .slice(0, 4)
      .reverse();
    return {
      ...base,
      best,
      peak: peakValue,
      delta,
      retention,
      points,
      pointDates,
      sameWeight: comparisonKg == null ? null : `${displayWeight(comparisonKg, unit)} ${unit.toUpperCase()}`,
      priorReps: typeof repEvent?.prior_value === 'number' ? repEvent.prior_value : null,
      currentReps: typeof repEvent?.current_value === 'number' ? repEvent.current_value : null,
      topHistory,
      canonicalWeightBestKg: weightBest?.best_value ?? null,
      sourceSetLogId: weightBest?.event?.source_set_log_id ?? e1rmBest?.event?.source_set_log_id ?? repEvent?.source_set_log_id ?? weightEvents[0]?.source_set_log_id ?? null,
      reportedBodyweight: bodyweightEvent?.reported_bodyweight ?? null,
    };
  }), [accomplishments, baseProfile, currentBests, progression, unit]);
  const focusLift = profile[focusLiftIndex];
  const focusedProfile = profile[focusLiftIndex];
  const exactEvidenceHref = focusedProfile.sourceSetLogId ? archiveDetailHref('set', focusedProfile.sourceSetLogId) : null;
  const liftKey = canonicalLiftKey(focusLift.key);
  const strengthStandard = supportedStrengthStandard(progression?.strength_standard);
  const strengthTier = strengthStandard && liftKey
    ? strengthTierState(focusedProfile.canonicalWeightBestKg ?? 0, liftKey, strengthStandard, unit)
    : null;
  const currentStrengthTier = strengthTier && strengthTier.earnedTierIndex >= 0
    ? strengthTier.tiers[strengthTier.earnedTierIndex]
    : null;
  const nextStrengthTier = strengthTier?.nextTierIndex == null
    ? null
    : strengthTier.tiers[strengthTier.nextTierIndex];
  const canonicalWeightLb = focusedProfile.canonicalWeightBestKg == null
    ? null
    : Math.round(kilogramsToDisplayValue(focusedProfile.canonicalWeightBestKg, 'lb') / 5) * 5;
  const milestoneCurrent = canonicalWeightLb == null ? null : displayWeightFromCanonicalLb(canonicalWeightLb, unit);
  const strengthPlateRender = milestoneCurrent != null && canRenderGymTotal(milestoneCurrent, unit)
    ? resolvePlateStackRender({ weight: milestoneCurrent, unit })
    : null;
  const topWeightKg = progression?.metric_trends?.top_weight?.summary?.current;
  const avgRpe = progression?.metric_trends?.avg_rpe?.summary?.current;
  const liftVolumeKg = liftKey ? progression?.metric_trends?.volume?.by_lift_kg?.[liftKey] : null;
  const readiness = progression?.readiness?.average;
  const supportingSignals = [
    ['Recent estimate', focusLift.best == null ? '—' : `${focusLift.best} ${unit.toUpperCase()}`, progression?.range?.label || range],
    ['Top weight', topWeightKg == null ? '—' : `${displayWeight(topWeightKg, unit)} ${unit.toUpperCase()}`, 'logged set load in range'],
    ['Average RPE', avgRpe == null ? '—' : Number(avgRpe).toFixed(1), 'logged effort in range'],
    ['Core-lift volume', liftVolumeKg == null ? '—' : `${Math.round(kgToDisplay(liftVolumeKg, unit)).toLocaleString()} ${unit.toUpperCase()}`, `${focusLift.key.toLowerCase()} performed volume`],
    ['Readiness', readiness == null ? '—' : Number(readiness).toFixed(1), progression?.readiness?.trend || 'check-in context'],
    ['Qualifying trend', `${focusLift.points.length} POINTS`, 'source-backed estimates'],
    ['Estimate confidence', progression?.strength_story?.confidence?.toUpperCase() || '—', 'movement identity matched'],
    ['Canonical bests', String(currentBests.filter((item) => canonicalCompetitionLiftKey(item.core_movement_key) === liftKey).length), 'exact competition-lift projections'],
  ];
  const trendDateLabels = focusedProfile.pointDates.length >= 2
    ? [focusedProfile.pointDates[0], focusedProfile.pointDates[Math.floor((focusedProfile.pointDates.length - 1) / 2)], focusedProfile.pointDates.at(-1)]
        .map((value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '—')
    : [];
  const establishedProfiles = profile.filter((item) => item.best != null);
  const strongestProfile = [...establishedProfiles].sort((left, right) => (right.best ?? 0) - (left.best ?? 0))[0];
  const maxBest = Math.max(1, ...establishedProfiles.map((item) => item.best ?? 0));

  if (loading) return <View style={[styles.page, styles.strengthPage]} testID="ledger-strength-experience"><LedgerRoomState kind="loading" message="Loading qualifying strength evidence." /></View>;
  if (error) return <View style={[styles.page, styles.strengthPage]} testID="ledger-strength-experience"><LedgerRoomState kind={errorKind ?? 'error'} message={error} onRetry={() => void reload()} /></View>;
  if (establishedProfiles.length === 0) return <View style={[styles.page, styles.strengthPage]} testID="ledger-strength-experience"><LedgerRoomState kind="empty" message="Not enough qualifying evidence yet." /></View>;

  return (
    <View style={[styles.page, styles.strengthPage]} testID="ledger-strength-experience">
      <FloatingDisplayUnitRegistration unit={unit} onChange={changeUnit} testID="ledger-strength-unit-toggle" />
      <View style={styles.strengthControls}>
        <Segmented values={['30d', '90d', '180d', '1y', 'all'] as const} value={range} onChange={setRange} />
      </View>
      <View style={styles.strengthLiftRail} accessibilityRole="tablist">
        {profile.map((item, index) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: index === focusLiftIndex }} onPress={() => setFocusLiftIndex(index)} style={[styles.strengthLiftTab, index === focusLiftIndex && { borderColor: item.color, backgroundColor: `${item.color}13` }]}><Image source={item.image} resizeMode="contain" style={[styles.strengthLiftTabImage, { tintColor: item.color }]} /><Text style={[styles.strengthLiftTabText, index === focusLiftIndex && { color: item.color }]}>{item.key}</Text></Pressable>)}
      </View>

      <View style={styles.strengthCurrent}>
        <View style={styles.strengthCurrentHeader}><View><Kicker tone={focusedProfile.color}>CURRENT STRENGTH · {focusLift.key.toUpperCase()}</Kicker><View style={styles.strengthCurrentValueRow}><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.strengthCurrentValue}>{focusLift.best ?? '—'}</Text>{focusLift.best != null ? <Text style={styles.strengthCurrentUnit}>{unit.toUpperCase()}</Text> : null}</View><Text style={styles.strengthCurrentMetric}>estimated 1RM · {progression?.range?.label || range}</Text></View><View style={[styles.strengthDirection, { borderColor: `${focusedProfile.color}70` }]}><Ionicons name="trending-up" size={18} color={focusedProfile.color} /><Text style={[styles.strengthDirectionValue, { color: focusedProfile.color }]}>{focusedProfile.delta != null ? `+${focusedProfile.delta}` : '—'}</Text><Text style={styles.strengthDirectionLabel}>IN RANGE</Text></View></View>
        <CanonicalStrengthTrendPlot points={focusLift.points} dates={focusedProfile.pointDates.map((date) => date || '')} color={focusedProfile.color} label={`${focusLift.key} estimated strength`} unit={unit} />
        {trendDateLabels.length ? <View style={styles.strengthCurrentDates}>{trendDateLabels.map((label, index) => <Text key={`${label}-${index}`} style={[styles.strengthCurrentDate, index === trendDateLabels.length - 1 && { color: focusedProfile.color }]}>{label}</Text>)}</View> : null}
        <View style={styles.strengthCurrentRead}><View style={[styles.strengthStatusDot, { backgroundColor: focusedProfile.color }]} /><Text style={styles.strengthCurrentReadText}>{focusLift.points.length >= 2 ? `${focusLift.points.length} source-backed estimates define this range.` : 'More qualifying sets are needed before a trustworthy trend is available.'}</Text></View>
      </View>

      <Pressable
        testID="ledger-strength-milestone-link"
        accessibilityRole="link"
        onPress={() => router.push(`/(tabs)/ledger/achievements?section=milestones&unit=${unit}` as any)}
        style={({ pressed }) => [styles.strengthMilestoneLink, { borderColor: `${focusedProfile.color}66` }, pressed && styles.pressed]}
      >
        <View style={styles.strengthMilestoneCopy}>
          <Kicker tone={focusedProfile.color}>CURRENT STRENGTH TIER</Kicker>
          <Text style={styles.strengthMilestoneTitle}>{!strengthStandard ? 'Verified sex-specific standard unavailable.' : currentStrengthTier ? `${currentStrengthTier.name} · Tier ${currentStrengthTier.tier}` : 'No tier earned yet.'}</Text>
          <Text style={styles.strengthMilestoneMeta}>{!strengthStandard ? 'A supported male or female identity is required; Strength Ledger will not guess.' : focusedProfile.canonicalWeightBestKg == null ? 'An exact governed competition-lift Weight PR establishes tier progress.' : nextStrengthTier == null ? `${strengthTier?.current} ${unit.toUpperCase()} current PR · Obsidian threshold reached` : `${strengthTier?.current} ${unit.toUpperCase()} current PR · ${strengthTier?.remaining} ${unit.toUpperCase()} to ${nextStrengthTier.name} (${strengthTier?.next} ${unit.toUpperCase()}, P${nextStrengthTier.actual_percentile.toFixed(1)})`}</Text>
          <View style={styles.strengthMilestoneAction}><Text style={[styles.strengthMilestoneActionText, { color: focusedProfile.color }]}>Open seven-tier progression</Text><Ionicons name="arrow-forward" size={14} color={focusedProfile.color} /></View>
        </View>
        <View style={styles.strengthMilestoneArtifact}>{strengthPlateRender?.imageSource ? <Image source={strengthPlateRender.imageSource} resizeMode="contain" style={styles.strengthMilestonePlate} /> : <Ionicons name="barbell-outline" size={37} color="#596371" />}</View>
      </Pressable>

      <View style={styles.strengthSectionLead}><Kicker>PROGRESSION</Kicker><Text style={styles.strengthSectionTitle}>The same weight feels different now.</Text></View>
      <View style={styles.strengthEffortStory}><Text style={styles.strengthEffortConclusion}>RPE-at-fixed-task progression is shown only when two identity-matched source sets carry comparable load, reps, and effort. This range does not yet expose that complete comparison.</Text></View>

      <View style={styles.strengthProgressionPair}>
        <View style={styles.strengthRepProgress}><Kicker tone={focusedProfile.color}>SAME-WEIGHT REP PROGRESSION</Kicker>{focusedProfile.sameWeight && focusedProfile.priorReps != null && focusedProfile.currentReps != null ? <><Text style={styles.strengthRepWeight}>{focusedProfile.sameWeight}</Text><View style={styles.strengthRepChange}><Text style={styles.strengthRepOld}>{focusedProfile.priorReps} reps</Text><Ionicons name="arrow-forward" size={16} color={focusedProfile.color} /><Text style={[styles.strengthRepNew, { color: focusedProfile.color }]}>{focusedProfile.currentReps} reps</Text></View><Text style={styles.strengthRepMeta}>canonical same-load evidence</Text></> : <Text style={styles.strengthRepMeta}>No qualified same-weight rep comparison in this evidence window.</Text>}</View>
        <View style={styles.strengthTopProgress}><Kicker>TOP SET PROGRESSION</Kicker>{focusedProfile.topHistory.length ? <View style={styles.strengthTopSequence}>{focusedProfile.topHistory.map((value, index) => <React.Fragment key={`${value}-${index}`}><View style={styles.strengthTopStep}><Text style={[styles.strengthTopValue, index === focusedProfile.topHistory.length - 1 && { color: focusedProfile.color }]}>{value}</Text><View style={[styles.strengthTopDot, index === focusedProfile.topHistory.length - 1 && { backgroundColor: focusedProfile.color }]} /></View>{index < focusedProfile.topHistory.length - 1 ? <View style={styles.strengthTopLine} /> : null}</React.Fragment>)}</View> : null}<Text style={styles.strengthRepMeta}>{focusedProfile.topHistory.length ? `canonical weight records · ${unit}` : 'No canonical weight records yet.'}</Text></View>
      </View>

      <View style={styles.strengthSectionLead}><Kicker>EVIDENCE</Kicker><Text style={styles.strengthSectionTitle}>Follow the estimate back to the bar.</Text></View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: proofExpanded }} onPress={() => {
        if (proofExpanded && exactEvidenceHref) {
          router.push(exactEvidenceHref as any);
          return;
        }
        setProofExpanded((value) => !value);
      }} style={({ pressed }) => [styles.strengthEvidence, pressed && styles.pressed]}>
        <View style={styles.strengthEvidenceMedia}>
          <View style={styles.strengthEvidencePlay}><Ionicons name="archive-outline" size={23} color="#FFFFFF" /></View><View style={styles.strengthEvidenceMediaCopy}><Text style={styles.strengthEvidenceSet}>{focusLift.best != null ? `${focusLift.best} ${unit.toUpperCase()} ESTIMATE` : 'INSUFFICIENT EVIDENCE'}</Text><Text style={styles.strengthEvidenceDate}>{progression?.range?.label || range} · SOURCE RECORD</Text></View>
        </View>
        <View style={styles.strengthEvidenceChain}>
          <View style={styles.strengthEvidenceNode}><Ionicons name="time-outline" size={18} color="#929CAA" /><View><Text style={styles.strengthEvidenceNodeLabel}>SOURCE RANGE</Text><Text style={styles.strengthEvidenceNodeValue}>{progression?.range?.label || range}</Text></View></View>
          <View style={[styles.strengthEvidenceConnector, { backgroundColor: focusedProfile.color }]} />
          <View style={styles.strengthEvidenceNode}><Ionicons name="shield-checkmark-outline" size={18} color={focusedProfile.color} /><View><Text style={[styles.strengthEvidenceNodeLabel, { color: focusedProfile.color }]}>IDENTITY MATCHED</Text><Text style={styles.strengthEvidenceNodeValue}>canonical core movement evidence</Text></View></View>
          <View style={[styles.strengthEvidenceConnector, { backgroundColor: focusedProfile.color }]} />
          <View style={styles.strengthEvidenceNode}><Ionicons name="analytics-outline" size={18} color={focusedProfile.color} /><View><Text style={[styles.strengthEvidenceNodeLabel, { color: focusedProfile.color }]}>USED IN ESTIMATE</Text><Text style={styles.strengthEvidenceNodeValue}>{focusLift.points.length} weekly estimates in range</Text></View></View>
          {focusedProfile.reportedBodyweight ? <><View style={[styles.strengthEvidenceConnector, { backgroundColor: '#76CBD0' }]} /><View style={styles.strengthEvidenceNode}><Ionicons name="scale-outline" size={18} color="#76CBD0" /><View><Text style={[styles.strengthEvidenceNodeLabel, { color: '#76CBD0' }]}>REPORTED BODYWEIGHT</Text><Text style={styles.strengthEvidenceNodeValue}>{formatJourneyWeight(focusedProfile.reportedBodyweight.reported_bodyweight_kg, unit)} {unit.toUpperCase()} · {formatJourneyDate(focusedProfile.reportedBodyweight.training_date)}</Text></View></View></> : null}
          {proofExpanded ? <Text style={styles.strengthEvidenceExpanded}>The estimate weights recent movement-matched sets, recorded load, reps, and bounded RPE. Older or lower-confidence evidence contributes less.</Text> : null}
          <View style={styles.strengthEvidenceAction}><Text style={styles.strengthEvidenceActionText}>{proofExpanded && exactEvidenceHref ? 'Open exact source set' : proofExpanded ? 'Hide method' : 'See why this qualifies'}</Text><Ionicons name={proofExpanded && exactEvidenceHref ? 'arrow-forward' : proofExpanded ? 'chevron-up' : 'chevron-down'} size={15} color="#CDBBFF" /></View>
        </View>
      </Pressable>

      <View style={styles.strengthSectionLead}><Kicker>CURRENT IDENTITY</Kicker><Text style={styles.strengthSectionTitle}>{strongestProfile ? `${strongestProfile.key} is the strongest current estimate.` : 'Current strength identity needs more evidence.'}</Text><Text style={styles.strengthSectionBody}>{strongestProfile ? 'This comparison uses the current canonical estimates shown below.' : 'Log qualifying sets across the core lifts to establish a profile.'}</Text></View>
      <View style={styles.strengthIdentityProfile}>{profile.map((item) => <View key={item.key} style={styles.strengthIdentityLift}><View style={styles.strengthIdentityLiftLabel}><Image source={item.image} resizeMode="contain" style={[styles.strengthIdentityLiftImage, { tintColor: item.color }]} /><Text style={styles.strengthIdentityLiftName}>{item.key.toUpperCase()}</Text><Text style={styles.strengthIdentityLiftValue}>{item.best ?? '—'}</Text></View><View style={styles.strengthIdentityTrack}>{item.best != null ? <View style={[styles.strengthIdentityFill, { width: `${Math.round((item.best / maxBest) * 100)}%`, backgroundColor: item.color }]} /> : null}</View><Text style={styles.strengthIdentityLiftMeta}>{item.best != null && item.retention != null ? `${item.retention}% of historical peak` : 'insufficient evidence'}</Text></View>)}</View>

      <View style={styles.strengthSectionLead}><Kicker>CURRENT MOMENTUM</Kicker><Text style={styles.strengthSectionTitle}>Current evidence signals.</Text></View>
      <View style={styles.strengthMomentum}>
        {[["barbell-outline", focusedProfile.delta != null ? `+${focusedProfile.delta} ${unit.toUpperCase()}` : '—', 'estimated change in range', 'weight trend'], ['repeat-outline', focusedProfile.currentReps != null && focusedProfile.priorReps != null ? `+${focusedProfile.currentReps - focusedProfile.priorReps} REPS` : '—', focusedProfile.sameWeight ? `at ${focusedProfile.sameWeight}` : 'no qualified comparison', 'rep strength'], ['pulse-outline', String(focusLift.points.length), 'weekly estimate points', 'heavy exposure evidence']].map(([icon, value, detail, label], index) => <View key={label} style={styles.strengthMomentumRow}><View style={[styles.strengthMomentumIcon, { borderColor: index === 2 ? '#506B83' : `${focusedProfile.color}70` }]}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={index === 2 ? '#78A9D1' : focusedProfile.color} /></View><View style={styles.strengthMomentumCopy}><Text style={styles.strengthMomentumLabel}>{label.toUpperCase()}</Text><View style={styles.strengthMomentumSentence}><Text style={styles.strengthMomentumValue}>{value}</Text><Text style={styles.strengthMomentumDetail}>{detail}</Text></View></View><Ionicons name="trending-up" size={18} color="#49D98D" /></View>)}
      </View>

      <View style={styles.strengthHistory}>
        <Kicker>HISTORICAL CONTEXT</Kicker><Text style={styles.strengthHistoryTitle}>{focusLift.best != null && focusedProfile.retention != null ? `${focusedProfile.retention}% of the observed peak is retained.` : 'A historical peak is not established yet.'}</Text>
        <View style={styles.strengthHistoryScale}><View style={styles.strengthHistoryPoint}><Text style={styles.strengthHistoryValue}>{focusLift.points.length ? formatCalculatedWeightValue(Math.min(...focusLift.points), unit) : '—'}</Text><Text style={styles.strengthHistoryLabel}>RANGE LOW</Text></View><View style={styles.strengthHistoryRail}>{focusLift.best != null ? <><View style={[styles.strengthHistoryFill, { backgroundColor: focusedProfile.color }]} /><View style={[styles.strengthHistoryCurrent, { borderColor: focusedProfile.color }]} /></> : null}</View><View style={styles.strengthHistoryPoint}><Text style={styles.strengthHistoryValue}>{focusedProfile.peak == null ? '—' : formatCalculatedWeightValue(focusedProfile.peak, unit)}</Text><Text style={styles.strengthHistoryLabel}>OBSERVED PEAK</Text></View></View>
        <Text style={styles.strengthHistoryBody}>{focusLift.best != null && focusedProfile.peak != null ? `Today’s ${formatCalculatedWeightValue(focusLift.best, unit)} ${unit} estimate is ${formatCalculatedWeightValue(Math.max(0, focusedProfile.peak - focusLift.best), unit)} ${unit} below the observed peak.` : 'Log qualifying movement-matched sets to establish current and historical estimates.'} Open the source evidence before treating any estimate as a tested max.</Text>
      </View>

      <View style={styles.strengthSupporting}><View style={styles.strengthSectionLead}><Kicker>SUPPORTING SIGNALS</Kicker><Text style={styles.strengthSectionTitle}>What else the ledger sees.</Text></View>{supportingSignals.map(([label, value, detail]) => <View key={label} style={styles.strengthSupportingRow}><Text style={styles.strengthSupportingLabel}>{label}</Text><View style={styles.strengthSupportingValueWrap}><Text style={styles.strengthSupportingValue}>{value}</Text><Text style={styles.strengthSupportingDetail}>{detail}</Text></View></View>)}</View>

      <Pressable onPress={() => openArchive({ collection: 'training', q: focusLift.key })} style={({ pressed }) => [styles.strengthClosing, pressed && styles.pressed]}><View><Text style={styles.strengthClosingTitle}>See the evidence move.</Text><Text style={styles.strengthClosingBody}>Open the sets behind this strength profile.</Text></View><Ionicons name="play-circle-outline" size={30} color={SLColors.accentMuted} /></Pressable>
    </View>
  );
}

export function ArchiveExperience() {
  return <ArchiveFoundationExperience />;
}

export function ExperienceForScreen({ screen }: { screen: LedgerScreen }) {
  switch (screen) {
    case 'home': return <HomeExperience />;
    case 'journey': return <JourneyExperience />;
    case 'strength': return <StrengthExperience />;
    case 'achievements': return null;
    case 'accessories': return null;
    case 'variants': return null;
    case 'muscle-groups': return null;
    case 'filters': return null;
    case 'archive': return <ArchiveExperience />;
    default: return assertUnreachable(screen);
  }
}

function assertUnreachable(value: never): never {
  throw new Error(`Unregistered Ledger experience: ${String(value)}`);
}

const styles = StyleSheet.create({
  ledgerRoomState: { marginVertical: 22, paddingVertical: 28, paddingHorizontal: 18, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#242B37', borderRadius: SLRadius.lg, backgroundColor: '#0C1119' },
  ledgerRoomStateTitle: { color: SLColors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  page: { gap: SLSpacing.md },
  journeyPage: { gap: 0 },
  journeyIntro: { gap: 6, paddingTop: 2, paddingBottom: 18 },
  journeyIntroTitle: { color: '#F7F5FA', fontSize: 34, lineHeight: 39, fontWeight: '700', letterSpacing: -0.8 },
  journeyIntroBody: { maxWidth: 430, color: '#929AA7', fontSize: 13, lineHeight: 19 },
  journeyOverview: { gap: 14, paddingTop: 18 },
  journeyMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  journeyMetricCard: { width: '48%', minHeight: 94, justifyContent: 'center', gap: 4, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#30283D', backgroundColor: '#0B0D13' },
  journeyMetricValue: { color: '#F6F2FA', fontSize: 31, lineHeight: 35, fontWeight: '500', letterSpacing: -0.5 },
  journeyMetricLabel: { color: '#A98ACF', fontSize: 8.5, lineHeight: 11, fontWeight: '700', letterSpacing: 0.8 },
  journeyRecordCard: { minHeight: 164, justifyContent: 'center', gap: 9, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#49355F', backgroundColor: '#0D0B12' },
  journeyRecordDate: { color: '#F5F0FA', fontSize: 28, lineHeight: 33, fontWeight: '700', letterSpacing: -0.45 },
  journeyRecordBody: { maxWidth: 410, color: '#9E96A8', fontSize: 12.5, lineHeight: 18 },
  journeyBodyweightTrend: { color: '#76CBD0', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  journeyBodyweightObservation: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#28313C' },
  journeyBodyweightDate: { width: 92, color: '#7F8999', fontSize: 9, lineHeight: 12 },
  journeyBodyweightValue: { minWidth: 72, color: '#E9F6F7', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  journeyBodyweightSession: { flex: 1, color: '#818B98', fontSize: 9, lineHeight: 12, textAlign: 'right' },
  journeyCurrentBlock: { minHeight: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 17, borderRadius: 16, borderWidth: 1, borderColor: '#2C4B46', backgroundColor: '#0A1011' },
  journeyCurrentBlockTitle: { marginTop: 5, color: '#F0F5F4', fontSize: 18, lineHeight: 23, fontWeight: '600' },
  journeyCurrentBlockDate: { maxWidth: '42%', color: '#8FA49F', fontSize: 10, lineHeight: 14, textAlign: 'right' },
  journeyBlocks: { gap: 10, paddingTop: 18 },
  journeyBlockCard: { gap: 10, padding: 17, borderRadius: 17, borderWidth: 1, borderColor: '#2C333E', backgroundColor: '#0A0D12' },
  journeyBlockCardCurrent: { borderColor: '#62458A', backgroundColor: '#0E0B14' },
  journeyBlockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  journeyBlockCopy: { flex: 1, minWidth: 0, gap: 4 },
  journeyBlockTitle: { color: '#F3F1F5', fontSize: 19, lineHeight: 24, fontWeight: '600' },
  journeyBlockRange: { color: '#939BA8', fontSize: 11, lineHeight: 15 },
  journeyBlockStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#303640' },
  journeyBlockStat: { color: '#AFA6BC', fontSize: 9.5, lineHeight: 13, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: '#12151B' },
  journeyBlockBodyweight: { color: '#76BFC6', fontSize: 9.5, lineHeight: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#29343B' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  mediaBody: { color: '#D7DDE5', lineHeight: 21 },
  darkScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 7, 11, 0.57)' },
  roundedImage: { borderRadius: SLRadius.radiusCard },
  curatorPage: { gap: 22, paddingBottom: 12 },
  curatorIntro: { gap: 7, paddingTop: 5, paddingHorizontal: 3 },
  curatorIntroTitle: { maxWidth: 430, color: '#F7F5FA', fontSize: 28, lineHeight: 33, fontWeight: '700', letterSpacing: -0.6 },
  curatorIntroBody: { maxWidth: 430, color: '#8E97A5', fontSize: 13, lineHeight: 19 },
  todayHero: { minHeight: 410, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#3A3445', backgroundColor: '#080A0F' },
  todayHeroImage: { minHeight: 410, justifyContent: 'space-between', padding: 20 },
  todayHeroImageRadius: { borderRadius: 23 },
  todayHeroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 5, 9, 0.51)' },
  todayHeroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(216,195,255,0.44)', backgroundColor: 'rgba(10,8,15,0.64)' },
  todayHeroBadgeText: { color: '#D8C3FF', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1 },
  todayHeroCopy: { gap: 10 },
  todayHeroDate: { color: '#C9ADFF', fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 1.2 },
  todayHeroTitle: { maxWidth: 400, color: '#FFFFFF', fontSize: 32, lineHeight: 37, fontWeight: '700', letterSpacing: -0.7 },
  todayHeroQuote: { maxWidth: 380, color: '#E0DCE5', fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  todayHeroFooter: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.24)' },
  todayHeroSource: { color: '#C7C0D0', fontSize: 9, lineHeight: 12, fontWeight: '600', letterSpacing: 0.75 },
  heroArtifactMark: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.88 },
  heroArtifactImage: { width: 210, height: 170 },
  careerExhibit: { minHeight: 164, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#30343C' },
  careerExhibitDate: { width: 76, minHeight: 108, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 38, borderWidth: 1, borderColor: '#4A4059', backgroundColor: '#0D0B12' },
  careerExhibitDay: { color: '#E9E2F3', fontSize: 18, lineHeight: 22, fontWeight: '600', textTransform: 'uppercase' },
  careerExhibitYear: { color: '#91889E', fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.8 },
  careerExhibitCopy: { flex: 1, minWidth: 0, gap: 6 },
  careerExhibitTitle: { color: '#F3F0F6', fontSize: 21, lineHeight: 26, fontWeight: '600' },
  careerExhibitBody: { color: '#8F98A5', fontSize: 12.5, lineHeight: 18 },
  curatorMomentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  strengthMoment: { gap: 12, paddingHorizontal: 5, paddingVertical: 16 },
  strengthEditorialRow: { minHeight: 126, flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthEditorialCopy: { flex: 1, minWidth: 0, gap: 8 },
  strengthEditorialImage: { width: 118, height: 102, opacity: 0.9 },
  strengthMomentTitle: { maxWidth: 420, color: '#F7F5FA', fontSize: 27, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  strengthMomentBody: { maxWidth: 430, color: '#9CA5B2', fontSize: 13.5, lineHeight: 20 },
  strengthMomentEvidence: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 4 },
  strengthMomentValue: { color: '#F7F5FA', fontSize: 66, lineHeight: 70, fontWeight: '400', letterSpacing: -2.5 },
  strengthMomentUnit: { color: '#A9B0BB', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  strengthMomentDelta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10 },
  strengthMomentDeltaText: { color: '#53DA92', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  strengthMomentProof: { minHeight: 39, justifyContent: 'center', marginTop: 2, paddingHorizontal: 2, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#303640' },
  strengthMomentProofText: { color: '#AAB2BE', fontSize: 10.5, lineHeight: 14, letterSpacing: 0.2 },
  achievementMoment: { minHeight: 172, flexDirection: 'row', alignItems: 'center', gap: 18, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#504324', backgroundColor: '#0D0E10' },
  achievementMomentCopy: { flex: 1, minWidth: 0, gap: 8 },
  achievementMomentTitle: { color: '#F5F2EA', fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3 },
  achievementMomentBody: { color: '#9D9B94', fontSize: 12.5, lineHeight: 17 },
  achievementProgress: { height: 5, overflow: 'hidden', marginTop: 3, borderRadius: 3, backgroundColor: '#26251F' },
  achievementProgressFill: { width: '84%', height: '100%', borderRadius: 3, backgroundColor: '#E7B85F' },
  achievementDisc: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center', borderRadius: 46, borderWidth: 2, borderColor: '#E7B85F', backgroundColor: '#1D1810' },
  achievementDiscValue: { color: '#F5CB76', fontSize: 37, lineHeight: 40, fontWeight: '500' },
  achievementDiscLabel: { color: '#BA9A5E', fontSize: 7.5, lineHeight: 10, fontWeight: '700', letterSpacing: 0.8 },
  archiveMoment: { minHeight: 178, flexDirection: 'row', overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#274841', backgroundColor: '#0A0F10' },
  archiveMomentMedia: { width: '43%', minHeight: 176, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C1314' },
  archiveMomentMediaRadius: { borderTopLeftRadius: 19, borderBottomLeftRadius: 19 },
  archiveMomentScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,7,8,0.33)' },
  archiveArtifactStack: { width: 82, height: 92, alignItems: 'center', justifyContent: 'center' },
  archiveArtifactSheet: { position: 'absolute', width: 58, height: 72, borderRadius: 7, borderWidth: 1, borderColor: '#304944', backgroundColor: '#111B1A', transform: [{ rotate: '-7deg' }] },
  archiveArtifactSheetFront: { alignItems: 'center', justifyContent: 'center', borderColor: '#48766D', backgroundColor: '#12201E', transform: [{ translateX: 10 }, { rotate: '5deg' }] },
  archivePlay: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.48)' },
  archiveDuration: { position: 'absolute', right: 7, bottom: 7, color: '#FFFFFF', fontSize: 9, lineHeight: 12, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.72)' },
  archiveMomentCopy: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 8, padding: 16 },
  archiveMomentTitle: { color: '#F4F7F6', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  archiveMomentBody: { color: '#92A49F', fontSize: 12, lineHeight: 16 },
  archiveMomentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#263C37' },
  archiveMomentAction: { color: '#C7D2CF', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  careerMoment: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2A2E37' },
  careerMomentIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: '#62458A', backgroundColor: '#15101E' },
  careerMomentCopy: { flex: 1, minWidth: 0, gap: 4 },
  careerMomentTitle: { color: '#F1EEF4', fontSize: 18, lineHeight: 22, fontWeight: '600' },
  careerMomentBody: { color: '#929AA7', fontSize: 11.5, lineHeight: 16 },
  discoveryMoment: { minHeight: 145, flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 18, borderRadius: 20, backgroundColor: '#121019' },
  discoveryMomentCopy: { flex: 1, minWidth: 0, gap: 6 },
  discoveryMomentLabel: { color: '#B993FF', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1 },
  discoveryMomentTitle: { color: '#F2EFF6', fontSize: 19, lineHeight: 24, fontWeight: '600' },
  discoveryMomentBody: { color: '#8F97A4', fontSize: 12, lineHeight: 16 },
  ledgerRetry: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#5C466F' },
  ledgerRetryText: { color: '#CBB4ED', fontSize: 12, fontWeight: '600' },
  inlineLink: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider, marginTop: 6 },
  inlineLinkText: { flex: 1, color: SLColors.textPrimary },
  archiveRoom: { minHeight: 360, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 18 },
  archiveTitle: { color: SLColors.textStrong },
  archiveBody: { maxWidth: 430, color: SLColors.textSecondary },
  journeyYearRail: { minHeight: 54, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', marginTop: 14, marginHorizontal: -10, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#333B48' },
  journeyYearNode: { flex: 1, minWidth: 64, alignItems: 'center', justifyContent: 'center', gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  journeyYearNodeActive: { borderBottomColor: '#A86BFF' },
  journeyYearText: { color: '#768193', fontSize: 13.5, lineHeight: 17, fontWeight: '500' },
  journeyYearTextActive: { color: '#C9A8FF' },
  journeyYearDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A86BFF', borderWidth: 1, borderColor: '#D8C7FF' },
  journeyYearDotActive: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,107,255,0.36)', borderColor: '#A86BFF', shadowColor: '#A86BFF', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  journeyYearDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B99AFF', borderWidth: 1, borderColor: '#E7DDFF' },
  journeySectionHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  journeySectionLead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  journeySectionTitle: { color: '#F3F0F7', fontSize: 12.5, lineHeight: 16, fontWeight: '600' },
  journeyFilter: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  journeyFilterText: { color: '#B999F1', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  journeyTimeline: { marginHorizontal: 0 },
  journeyState: { marginHorizontal: 12, marginVertical: 18, color: '#8F98A6', fontSize: 11, lineHeight: 16 },
  journeyMoment: { minHeight: 67, flexDirection: 'row' },
  journeyMomentDate: { width: 51, alignItems: 'flex-start', paddingTop: 12, paddingLeft: 8 },
  journeyDateText: { color: '#7F8999', fontSize: 9.5, lineHeight: 12, letterSpacing: 0.35 },
  journeyDateYear: { color: '#7F8999', fontSize: 9.5, lineHeight: 12, letterSpacing: 0.35 },
  journeyAxis: { width: 15, position: 'relative', alignItems: 'center' },
  journeySpine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#3B4350' },
  journeySpineLast: { bottom: 2 },
  journeyDot: { position: 'absolute', top: 13, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#E0D4FF', shadowColor: '#A86BFF', shadowOpacity: 0.55, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
  journeyCard: { flex: 1, minWidth: 0, minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, paddingHorizontal: 7, overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: '#29313D', backgroundColor: '#0B0F15' },
  journeyIcon: { width: 32, height: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1 },
  journeyCardBody: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 1.5, paddingVertical: 6 },
  journeyCardTitle: { color: '#F5F3F7', fontSize: 11.5, lineHeight: 14, fontWeight: '600' },
  journeyCardDetail: { color: '#9199A8', fontSize: 9.5, lineHeight: 12 },
  journeyTags: { minHeight: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  journeyTag: { minHeight: 13, justifyContent: 'center', paddingHorizontal: 4, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, backgroundColor: '#0D1118' },
  journeyTagText: { fontSize: 6.8, lineHeight: 8.5, letterSpacing: 0.25, fontWeight: '500' },
  journeyEvidenceList: { gap: 5, marginTop: 7 },
  journeyEvidenceLink: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: '#303846', backgroundColor: '#0F141C' },
  journeyEvidenceText: { flex: 1, color: '#C5CBD5', fontSize: 9, lineHeight: 12, fontWeight: '500' },
  journeyChevron: { flexShrink: 0, marginLeft: 1 },
  journeyLoadMore: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#4B3A5F', backgroundColor: '#0C0A11' },
  journeyLoadMoreText: { color: '#B999F1', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  journeyMedia: { width: 76, height: 54, flexShrink: 0, overflow: 'hidden', borderRadius: 5, backgroundColor: '#141922' },
  journeyMediaImage: { width: '100%', height: '100%' },
  journeyPlay: { position: 'absolute', left: 25, top: 14, width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,5,8,0.62)', borderWidth: 1, borderColor: '#FFFFFF' },
  journeyDuration: { position: 'absolute', right: 3, bottom: 2, color: '#FFFFFF', fontSize: 8, lineHeight: 10, paddingHorizontal: 2, backgroundColor: 'rgba(0,0,0,0.66)' },
  journeyTransition: { width: 98, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyTransitionMetric: { alignItems: 'center' },
  journeyTransitionValue: { fontSize: 16, lineHeight: 19, fontWeight: '500' },
  journeyTransitionUnit: { color: '#8B95A5', fontSize: 7.5, lineHeight: 9 },
  journeyMeetTotal: { width: 76, flexShrink: 0, gap: 1, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5, borderWidth: 1, backgroundColor: '#0A0D13' },
  journeyMeetLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyMeetLabel: { color: '#939BA8', fontSize: 6.5, lineHeight: 8, fontWeight: '500' },
  journeyMeetValue: { color: '#F0F1F3', fontSize: 9.5, lineHeight: 11, fontWeight: '600' },
  journeyMeetDivider: { height: StyleSheet.hairlineWidth, marginVertical: 1, backgroundColor: '#414858' },
  journeyRecord: { width: 71, height: 52, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  journeyRecordStar: { position: 'absolute', width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  journeyRecordText: { position: 'absolute', bottom: 0, fontSize: 6.5, lineHeight: 8 },
  journeyStat: { width: 83, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  journeyStatValue: { fontSize: 22, lineHeight: 25, fontWeight: '500' },
  journeyStatUnit: { fontSize: 7.5, lineHeight: 9, fontWeight: '500' },
  journeyPersonalDivider: { height: 27, flexDirection: 'row', alignItems: 'center', gap: 10 },
  journeyPersonalLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#333B48' },
  journeyPersonalLabel: { color: '#B99BEB', fontSize: 9, lineHeight: 11, letterSpacing: 0.55, fontWeight: '500' },
  journeyAdd: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginHorizontal: 8, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: '#7652A7', backgroundColor: '#0C1016' },
  journeyAddText: { color: '#B99BEB', fontSize: 12, lineHeight: 15, fontWeight: '500' },
  statementTitle: { color: SLColors.textStrong, lineHeight: 32 },
  valueUnit: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  strengthPage: { gap: 25 },
  strengthLiftRail: { flexDirection: 'row', gap: 8 },
  strengthLiftTab: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 15, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: '#0B0E13' },
  strengthLiftTabImage: { width: 30, height: 25 },
  strengthLiftTabText: { color: SLColors.textMuted, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  strengthControls: { gap: 8 },
  strengthLiveStatus: { color: '#7F8995', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  strengthLiveError: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#7B3D49', backgroundColor: '#190E12' },
  strengthLiveErrorText: { color: '#F19AA7', fontSize: 10.5, lineHeight: 14, textAlign: 'center' },
  strengthCurrent: { overflow: 'hidden', gap: 2, paddingHorizontal: 19, paddingTop: 21, paddingBottom: 17, borderRadius: 23, borderWidth: 1, borderColor: '#3A304D', backgroundColor: '#0A0C12' },
  strengthMilestoneLink: { minHeight: 142, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 18, borderWidth: 1, backgroundColor: '#0A0C11' },
  strengthMilestoneCopy: { flex: 1, minWidth: 0, gap: 5, paddingVertical: 17, paddingLeft: 17 },
  strengthMilestoneTitle: { color: '#EFF0F3', fontSize: 17, lineHeight: 21, fontWeight: '600' },
  strengthMilestoneMeta: { color: '#9099A6', fontSize: 10, lineHeight: 14 },
  strengthMilestoneAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  strengthMilestoneActionText: { fontSize: 10, lineHeight: 13, fontWeight: '600' },
  strengthMilestoneArtifact: { width: 148, height: 134, alignItems: 'center', justifyContent: 'center', marginRight: -7 },
  strengthMilestonePlate: { width: 154, height: 124 },
  strengthCurrentHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  strengthCurrentValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  strengthCurrentValue: { color: '#F9F7FC', fontSize: 69, lineHeight: 74, fontWeight: '400', letterSpacing: -3 },
  strengthCurrentUnit: { color: '#D5CFDC', fontSize: 17, lineHeight: 21, fontWeight: '600' },
  strengthCurrentMetric: { marginTop: -5, color: '#8A94A2', fontSize: 10, lineHeight: 13 },
  strengthDirection: { minWidth: 76, alignItems: 'center', gap: 1, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 13, borderWidth: 1, backgroundColor: '#0D1017' },
  strengthDirectionValue: { fontSize: 18, lineHeight: 21, fontWeight: '700' },
  strengthDirectionLabel: { color: '#717B88', fontSize: 7, lineHeight: 9, fontWeight: '700', letterSpacing: 0.55 },
  strengthTrendPlot: { width: '100%', height: 118, marginTop: 8 },
  strengthCurrentDates: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  strengthCurrentDate: { color: '#67717E', fontSize: 8, lineHeight: 10, fontWeight: '600', letterSpacing: 0.55 },
  strengthCurrentRead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#2D3340' },
  strengthStatusDot: { width: 7, height: 7, borderRadius: 4 },
  strengthCurrentReadText: { flex: 1, color: '#C6CCD4', fontSize: 11, lineHeight: 16 },
  strengthSectionLead: { gap: 5, paddingHorizontal: 3 },
  strengthSectionTitle: { maxWidth: 348, color: SLColors.textStrong, fontSize: 24, lineHeight: 29, fontWeight: '600', letterSpacing: -0.4 },
  strengthSectionBody: { maxWidth: 340, color: SLColors.textMuted, fontSize: 11.5, lineHeight: 16 },
  strengthEffortStory: { overflow: 'hidden', borderRadius: 21, borderWidth: 1, borderColor: '#343B47', backgroundColor: '#0A0D12' },
  strengthEffortSet: { alignItems: 'center', gap: 4, paddingHorizontal: 18, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#343B47' },
  strengthEffortLoad: { color: '#F6F4F8', fontSize: 37, lineHeight: 42, fontWeight: '500', letterSpacing: -1.2 },
  strengthEffortCaption: { color: '#747E8B', fontSize: 7.5, lineHeight: 10, fontWeight: '700', letterSpacing: 0.85 },
  strengthEffortComparison: { minHeight: 132, flexDirection: 'row', alignItems: 'stretch' },
  strengthEffortSide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 9 },
  strengthEffortSideNow: { backgroundColor: 'rgba(167,139,250,0.045)' },
  strengthEffortWhen: { color: '#7F8995', fontSize: 8, lineHeight: 10, fontWeight: '700', letterSpacing: 0.65 },
  strengthEffortRpe: { color: '#F5F2F8', fontSize: 35, lineHeight: 39, fontWeight: '500', letterSpacing: -1 },
  strengthEffortMeaning: { color: '#929BA6', fontSize: 10, lineHeight: 13 },
  strengthEffortArrow: { width: 78, alignItems: 'center', justifyContent: 'center', gap: 6 },
  strengthEffortDelta: { fontSize: 9, lineHeight: 11, fontWeight: '700', letterSpacing: 0.35, textAlign: 'center' },
  strengthEffortConclusion: { color: '#C9CED5', fontSize: 11.5, lineHeight: 17, paddingHorizontal: 17, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#343B47' },
  strengthProgressionPair: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  strengthRepProgress: { flex: 1, minHeight: 152, gap: 6, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: '#323946', backgroundColor: '#0A0D12' },
  strengthRepWeight: { color: '#F0EDF4', fontSize: 27, lineHeight: 31, fontWeight: '500' },
  strengthRepChange: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  strengthRepOld: { color: '#8993A0', fontSize: 13, lineHeight: 16, textDecorationLine: 'line-through' },
  strengthRepNew: { fontSize: 16, lineHeight: 19, fontWeight: '700' },
  strengthRepMeta: { marginTop: 'auto', color: '#6E7885', fontSize: 8.5, lineHeight: 11 },
  strengthTopProgress: { flex: 1.15, minHeight: 152, gap: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: '#323946', backgroundColor: '#0A0D12' },
  strengthTopSequence: { flexDirection: 'row', alignItems: 'center' },
  strengthTopStep: { alignItems: 'center', gap: 6 },
  strengthTopValue: { color: '#8F99A5', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  strengthTopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#525C68' },
  strengthTopLine: { flex: 1, height: 1, marginHorizontal: 1, marginTop: 20, backgroundColor: '#3B434F' },
  strengthEvidence: { overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#3B3150', backgroundColor: '#090C12' },
  strengthEvidenceMedia: { minHeight: 225, justifyContent: 'space-between', padding: 17 },
  strengthEvidenceRadius: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  strengthEvidenceScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,6,9,0.58)' },
  strengthEvidencePlay: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'rgba(3,5,8,0.64)' },
  strengthEvidenceMediaCopy: { gap: 3 },
  strengthEvidenceSet: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: '600' },
  strengthEvidenceDate: { color: '#C4BBCF', fontSize: 8.5, lineHeight: 11, fontWeight: '700', letterSpacing: 0.7 },
  strengthEvidenceChain: { gap: 0, paddingHorizontal: 17, paddingVertical: 16 },
  strengthEvidenceNode: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 11 },
  strengthEvidenceNodeLabel: { color: '#8993A0', fontSize: 7.5, lineHeight: 10, fontWeight: '700', letterSpacing: 0.65 },
  strengthEvidenceNodeValue: { marginTop: 2, color: '#E3E0E7', fontSize: 11.5, lineHeight: 15, fontWeight: '500' },
  strengthEvidenceConnector: { width: 1, height: 17, marginLeft: 8.5, opacity: 0.55 },
  strengthEvidenceExpanded: { color: '#9BA4AF', fontSize: 10.5, lineHeight: 16, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#303744' },
  strengthEvidenceAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 12 },
  strengthEvidenceActionText: { color: '#CDBBFF', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  strengthIdentityProfile: { gap: 17, paddingVertical: 4 },
  strengthIdentityLift: { gap: 7 },
  strengthIdentityLiftLabel: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  strengthIdentityLiftImage: { width: 39, height: 31 },
  strengthIdentityLiftName: { flex: 1, color: '#B7BFC9', fontSize: 9, lineHeight: 11, fontWeight: '700', letterSpacing: 0.75 },
  strengthIdentityLiftValue: { color: '#F1EFF4', fontSize: 20, lineHeight: 23, fontWeight: '500' },
  strengthIdentityTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: '#252B34' },
  strengthIdentityFill: { height: '100%', borderRadius: 3 },
  strengthIdentityLiftMeta: { color: '#747E8B', fontSize: 8.5, lineHeight: 11, textAlign: 'right' },
  strengthMomentum: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#313844' },
  strengthMomentumRow: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#313844' },
  strengthMomentumIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 1, backgroundColor: '#0C1016' },
  strengthMomentumCopy: { flex: 1, minWidth: 0, gap: 4 },
  strengthMomentumLabel: { color: '#7C8693', fontSize: 7.5, lineHeight: 10, fontWeight: '700', letterSpacing: 0.65 },
  strengthMomentumSentence: { flexDirection: 'row', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' },
  strengthMomentumValue: { color: '#F1EFF4', fontSize: 18, lineHeight: 21, fontWeight: '700' },
  strengthMomentumDetail: { color: '#9BA4AF', fontSize: 10.5, lineHeight: 14 },
  strengthHistory: { gap: 16, paddingHorizontal: 18, paddingVertical: 21, borderRadius: 21, borderWidth: 1, borderColor: '#343A47', backgroundColor: '#0B0E13' },
  strengthHistoryTitle: { maxWidth: 320, color: '#F3F1F5', fontSize: 26, lineHeight: 31, fontWeight: '600' },
  strengthHistoryScale: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthHistoryPoint: { width: 63, gap: 2 },
  strengthHistoryValue: { color: '#E9E6ED', fontSize: 18, lineHeight: 21, fontWeight: '600' },
  strengthHistoryLabel: { color: '#707A87', fontSize: 6.5, lineHeight: 8, fontWeight: '700', letterSpacing: 0.5 },
  strengthHistoryRail: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#282E38' },
  strengthHistoryFill: { width: '83%', height: '100%', borderRadius: 3, opacity: 0.78 },
  strengthHistoryCurrent: { position: 'absolute', left: '81%', top: -5, width: 16, height: 16, borderRadius: 8, borderWidth: 3, backgroundColor: '#0B0E13' },
  strengthHistoryBody: { color: '#A8B0BA', fontSize: 11, lineHeight: 17 },
  strengthSupporting: { gap: 0 },
  strengthSupportingRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#303742' },
  strengthSupportingLabel: { color: '#A8B1BC', fontSize: 11, lineHeight: 14 },
  strengthSupportingValueWrap: { alignItems: 'flex-end', gap: 2 },
  strengthSupportingValue: { color: '#F1EEF4', fontSize: 14, lineHeight: 17, fontWeight: '700' },
  strengthSupportingDetail: { color: '#6F7986', fontSize: 8, lineHeight: 10 },
  strengthClosing: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider },
  strengthClosingTitle: { color: SLColors.textStrong, fontSize: 17, lineHeight: 21, fontWeight: '600' },
  strengthClosingBody: { marginTop: 3, color: SLColors.textMuted, fontSize: 10.5, lineHeight: 14 },
  achievementHero: { minHeight: 235, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', ...ledgerStyles.surface },
  trophyImage: { width: '40%', height: 205 },
  achievementHeroCopy: { flex: 1, gap: 8, paddingRight: 18 },
  achievementTitle: { color: SLColors.textStrong },
  collectionCount: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  collectionNumber: { color: SLColors.accentMuted },
  collectionCopy: { flex: 1, gap: 4 },
  collectionTitle: { color: SLColors.textStrong },
  nextLandmark: { padding: 16, gap: 11, ...ledgerStyles.surface },
  nextLandmarkTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nextTitle: { color: SLColors.textStrong },
  nextPercent: { color: SLColors.accentMuted },
  nextNarrative: { color: SLColors.textSecondary },
  artifactRail: { gap: 9, paddingBottom: 4 },
  artifact: { width: 118, minHeight: 145, alignItems: 'center', justifyContent: 'center', gap: 6, ...ledgerStyles.inset },
  artifactActive: { borderColor: SLColors.accent, backgroundColor: '#171123' },
  artifactSeal: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: SLColors.surfaceRaised },
  artifactValue: { color: SLColors.textStrong },
  artifactName: { color: SLColors.textMuted, textAlign: 'center' },
  artifactEvidence: { minHeight: 96, justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider },
  artifactDetail: { color: SLColors.textStrong },
  developmentHeader: { minHeight: 170, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, ...ledgerStyles.surface },
  developmentSummary: { flex: 1, minWidth: 0, gap: 5, paddingRight: 12 },
  developmentWeight: { color: SLColors.textStrong },
  developmentUnit: { color: '#55D99A' },
  weightOrbit: { width: 80, height: 80, flexShrink: 0, borderRadius: 40, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: '#397B5B', backgroundColor: '#10241A' },
  orbitText: { color: '#8BE2B5' },
  bodyMap: { minHeight: 310, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, ...ledgerStyles.surface },
  bodyFigure: { width: '35%', alignItems: 'center', justifyContent: 'center' },
  bodyPulse: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(85,217,154,0.22)', borderWidth: 1, borderColor: '#55D99A' },
  bodyPulseLower: { bottom: 64 },
  bodyPulseUpper: { top: 56 },
  bodyPulseLowerRear: { bottom: 86, right: 23 },
  bodyMeasurements: { flex: 1, gap: 10 },
  devMeasure: { gap: 5 },
  devMeasureTop: { flexDirection: 'row', justifyContent: 'space-between' },
  devName: { color: SLColors.textMuted },
  devNameActive: { color: '#8BE2B5' },
  devValue: { color: SLColors.textSecondary },
  selectedDevelopment: { paddingVertical: 12, gap: 6 },
  selectedDevelopmentTitle: { color: '#8BE2B5' },
  selectedDevelopmentValue: { color: SLColors.textStrong },
  metricStrip: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider },
  legacyScale: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, maxWidth: 320 },
  legacyScaleCopy: { flex: 1, color: '#E2D6C0' },
  legacyMetrics: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  yearRail: { gap: 7, paddingBottom: 2 },
  yearNode: { minWidth: 75, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat },
  yearNodeActive: { backgroundColor: '#352C1D', borderColor: '#D4B36E' },
  yearText: { color: SLColors.textMuted },
  yearTextActive: { color: '#F1D494' },
  yearStory: { padding: 16, gap: 10, ...ledgerStyles.surface },
  yearStoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearVolume: { color: '#E4C985' },
  recordRow: { borderRadius: SLRadius.radiusControl },
  recordRowActive: { backgroundColor: '#17150F' },
  recordMeaning: { gap: 6, paddingVertical: 12 },
  heroAction: { alignSelf: 'flex-start', minWidth: 164, marginTop: 8 },
  filmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  filmTile: { width: '48.6%', minHeight: 185, overflow: 'hidden', ...ledgerStyles.surface },
  filmVisual: { height: 116, justifyContent: 'center', alignItems: 'center' },
  filmImage: { borderTopLeftRadius: SLRadius.radiusCard, borderTopRightRadius: SLRadius.radiusCard },
  filmScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,6,10,0.38)' },
  playSeal: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,10,14,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  reviewed: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(18,13,27,0.82)' },
  reviewedText: { color: '#D9C5FF' },
  filmTitle: { color: SLColors.textStrong, paddingHorizontal: 10, paddingTop: 9 },
  filmMeta: { color: SLColors.textMuted, paddingHorizontal: 10, paddingTop: 3, paddingBottom: 10 },
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' },
  filmSheet: { gap: 9, padding: 18, paddingBottom: 32, backgroundColor: SLColors.surfaceRaised, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: SLColors.borderStandard },
  sheetMedia: { height: 210, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: SLRadius.radiusCard },
  sheetMediaImage: { borderRadius: SLRadius.radiusCard },
  sheetPlay: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,10,14,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.58)' },
  sheetTitle: { color: SLColors.textStrong },
  sheetLoad: { color: SLColors.accentMuted },
  sheetBody: { color: SLColors.textSecondary },
  perspectiveIntro: { paddingVertical: 12, gap: 8 },
  comparisonRail: { gap: 7 },
  comparisonChip: { minWidth: 84, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 19, backgroundColor: SLColors.surfaceFlat, borderWidth: 1, borderColor: SLColors.borderDefault },
  comparisonChipActive: { backgroundColor: '#17263B', borderColor: '#75B4FF' },
  comparisonChipText: { color: SLColors.textMuted },
  comparisonChipTextActive: { color: '#BBD7FF' },
  percentileScene: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 18, ...ledgerStyles.surface },
  percentileValue: { color: '#75B4FF' },
  percentileTitle: { color: SLColors.textSecondary, textAlign: 'center', maxWidth: 270 },
  percentileLoad: { color: SLColors.textStrong, marginTop: 4 },
  percentileUnit: { color: SLColors.textMuted },
  dotField: { width: 250, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  contextDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: SLColors.focus },
  contextDotActive: { backgroundColor: '#75B4FF' },
  scaleScene: { minHeight: 210, overflow: 'hidden', justifyContent: 'flex-end', borderRadius: SLRadius.radiusCard, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  scaleSceneCopy: { padding: 17, gap: 6 },
  scaleTitle: { color: '#F3F7FB' },
  memoryHero: { minHeight: 390, overflow: 'hidden', justifyContent: 'flex-end', borderRadius: SLRadius.radiusCard, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  memoryHeroCopy: { padding: 20, gap: 8 },
  memoryTitle: { color: '#FFF7F0' },
  memoryDate: { color: '#F2C89D' },
  saveMemory: { alignSelf: 'flex-start', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, paddingHorizontal: 13, borderRadius: 21, backgroundColor: 'rgba(13,12,11,0.76)', borderWidth: 1, borderColor: 'rgba(240,190,126,0.46)' },
  saveMemoryText: { color: '#F1E6D8' },
  memoryRail: { gap: 8, paddingBottom: 3 },
  memoryThumb: { width: 118, overflow: 'hidden', borderRadius: SLRadius.radiusControl, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceFlat },
  memoryThumbActive: { borderColor: '#E7B985' },
  memoryThumbImage: { width: '100%', height: 82 },
  memoryThumbDate: { color: SLColors.textMuted, padding: 8 },
  memoryNote: { flexDirection: 'row', gap: 12, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider },
  memoryNoteCopy: { flex: 1, gap: 6 },
  memoryQuote: { color: '#E8DED3', lineHeight: 21 },
  identityHero: { minHeight: 350, overflow: 'hidden', justifyContent: 'flex-end', borderRadius: SLRadius.radiusCard, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  identityScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,5,13,0.54)' },
  identityCopy: { padding: 20, gap: 9 },
  identityName: { color: '#F8F1FF' },
  focusList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider },
  focusRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider },
  focusRowActive: { backgroundColor: SLColors.surfaceFlat },
  focusIndex: { color: SLColors.textMuted, width: 34 },
  focusIndexActive: { color: SLColors.accentMuted },
  focusLabel: { flex: 1, color: SLColors.textSecondary },
  focusLabelActive: { color: SLColors.textStrong },
  philosophy: { paddingVertical: 22, gap: 9 },
  philosophyQuote: { color: SLColors.textStrong, lineHeight: 32 },
});
