import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLCanonicalIcon, SLTrophy } from '@/components/ui';
import { SLSpacing } from '@/constants/theme';
import { getAthleteVideoArchive } from '@/lib/api';
import {
  canonicalLiftKey,
  displayWeight,
  type AccomplishmentEvent,
  type CurrentBest,
  type LedgerLift,
  type LedgerRequestFailureKind,
  type LedgerUnit,
} from '@/lib/ledger-data';
import { ArchiveRequestError } from '@/lib/ledger-archive';
import { CORE_LIFT_PRESENTATION, type JourneyEvent } from './model';
import { ledgerHrefFor, type LedgerRoom } from './routing';
import { useLedgerLiveData } from './use-ledger-live-data';
import { fetchJourneyArchiveEvents } from './journey-live-events';
import {
  progressToNextMaturity,
  resolveLedgerIndexMaturity,
  selectLedgerDailySignal,
  type LedgerDailySignal,
  type LedgerIndexMaturity,
} from './index-maturity';

const ATMOSPHERIC_GYM = require('@/assets/images/gym_vibe.jpg');

type CanonicalMedia = Readonly<{
  thumbnail: string;
  title: string;
  occurredAt?: string;
  reviewed: boolean;
}>;

type VideoCandidate = Readonly<{
  thumbnail_url?: unknown;
  movement_name?: unknown;
  exercise_name?: unknown;
  workout_date?: unknown;
  created_at?: unknown;
  uploaded_at?: unknown;
  review_status?: unknown;
  reviewed_at?: unknown;
  context?: Readonly<{ movement_name?: unknown }>;
}>;

function dateLabel(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isAnniversary(event: JourneyEvent, today = new Date()) {
  if (!event.occurredAt) return false;
  const occurred = new Date(event.occurredAt);
  return !Number.isNaN(occurred.getTime())
    && occurred.getFullYear() < today.getFullYear()
    && occurred.getMonth() === today.getMonth()
    && occurred.getDate() === today.getDate();
}

function isMeet(event: JourneyEvent) {
  return event.tags.some((tag) => tag.label === 'MEET');
}

function isRediscovery(event: JourneyEvent, today = new Date()) {
  if (!event.occurredAt) return false;
  const occurred = new Date(event.occurredAt);
  return !Number.isNaN(occurred.getTime()) && today.getTime() - occurred.getTime() >= 180 * 86400000;
}

function StateMessage({ kind, message, onRetry }: { kind: 'loading' | LedgerRequestFailureKind; message: string; onRetry?: () => void }) {
  const icon = kind === 'loading' ? 'hourglass-outline' : kind === 'unauthorized' ? 'lock-closed-outline' : kind === 'unavailable' ? 'unlink-outline' : 'alert-circle-outline';
  return <View testID={`ledger-index-${kind}`} style={styles.stateMessage}>
    <Ionicons name={icon} size={30} color="#B797EE" />
    <Text style={styles.stateMessageText}>{message}</Text>
    {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}
  </View>;
}

function Doorway({ room, icon, title, detail, onPress, quiet = false }: { room: Exclude<LedgerRoom, 'home'>; icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void; quiet?: boolean }) {
  return <Pressable testID={`ledger-${room}-snapshot`} accessibilityRole="button" accessibilityLabel={`Open ${room}: ${title}`} onPress={onPress} style={({ pressed }) => [styles.doorway, quiet && styles.doorwayQuiet, pressed && styles.pressed]}>
    <View style={styles.doorwayIcon}><SLCanonicalIcon name={icon} size={20} color="#BFA4F4" /></View>
    <View style={styles.doorwayCopy}><Text style={styles.doorwayTitle}>{title}</Text><Text style={styles.doorwayDetail}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={17} color="#778190" />
  </Pressable>;
}

function EvidenceImage({ media, compact = false }: { media: CanonicalMedia | null; compact?: boolean }) {
  if (media) return <Image accessibilityLabel={`Athlete evidence: ${media.title}`} source={{ uri: media.thumbnail }} resizeMode="cover" style={[styles.evidenceImage, compact && styles.evidenceImageCompact]} />;
  return <Image accessible={false} accessibilityIgnoresInvertColors source={ATMOSPHERIC_GYM} resizeMode="cover" style={[styles.evidenceImage, styles.decorativeImage, compact && styles.evidenceImageCompact]} />;
}

function formatAccomplishment(eventType?: string) {
  return eventType ? eventType.replace(/^CORE_/, '').replaceAll('_', ' ').toLowerCase() : '';
}

function roomForDailySignal(signal: LedgerDailySignal): Exclude<LedgerRoom, 'home'> {
  if (signal === 'major-pr' || signal === 'achievement' || signal === 'next-milestone') return 'achievements';
  if (signal === 'reviewed-video') return 'archive';
  if (signal === 'strength-change') return 'strength';
  return 'journey';
}

export function LedgerIndexExperience() {
  const router = useRouter();
  const { progression, currentBests, accomplishments, loading, error, errorKind, reload } = useLedgerLiveData('all');
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [media, setMedia] = useState<CanonicalMedia | null>(null);
  const [supportLoading, setSupportLoading] = useState(true);
  const [supportFailure, setSupportFailure] = useState<LedgerRequestFailureKind | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchJourneyArchiveEvents(), getAthleteVideoArchive()])
      .then(([journeyResult, mediaResult]) => {
        if (!active) return;
        if (journeyResult.status === 'fulfilled') setEvents(journeyResult.value);
        else {
          const caught = journeyResult.reason;
          setSupportFailure(caught instanceof ArchiveRequestError && (caught.status === 401 || caught.status === 403) ? 'unauthorized' : caught instanceof ArchiveRequestError && (caught.status === 404 || caught.status === 410) ? 'unavailable' : 'error');
        }
        if (mediaResult.status === 'fulfilled' && mediaResult.value.ok && mediaResult.value.json?.ok && Array.isArray(mediaResult.value.json.videos)) {
          const candidate = (mediaResult.value.json.videos as VideoCandidate[]).find((item) => typeof item.thumbnail_url === 'string' && item.thumbnail_url.length > 0);
          if (candidate) {
            const title = [candidate.movement_name, candidate.exercise_name, candidate.context?.movement_name].find((value): value is string => typeof value === 'string' && value.length > 0) ?? 'Preserved lift video';
            const occurredAt = [candidate.workout_date, candidate.created_at, candidate.uploaded_at].find((value): value is string => typeof value === 'string' && value.length > 0);
            setMedia({ thumbnail: candidate.thumbnail_url as string, title, occurredAt, reviewed: candidate.review_status === 'reviewed' || Boolean(candidate.reviewed_at) });
          }
        }
      })
      .finally(() => { if (active) setSupportLoading(false); });
    return () => { active = false; };
  }, []);

  const model = useMemo(() => {
    const completed = Math.max(0, progression?.consistency?.sessions_completed ?? 0);
    const lifts = progression?.big_three_arc?.lifts ?? [];
    const strongest = [...lifts]
      .filter((lift) => lift.current_e1rm_kg != null)
      .sort((left, right) => (right.current_e1rm_kg ?? 0) - (left.current_e1rm_kg ?? 0))[0];
    const unit: LedgerUnit = progression?.athlete?.preferred_units?.toLowerCase().startsWith('lb') ? 'lb' : 'kg';
    const anniversary = events.find((event) => isAnniversary(event));
    const meet = events.find(isMeet);
    const rediscovery = events.find((event) => isRediscovery(event));
    const recentEvent = events[0];
    const firstEvent = events.at(-1);
    const majorPr = accomplishments.find((event) => event.event_type.includes('_PR'));
    const recentAchievement = accomplishments[0];
    const hasStrengthChange = lifts.some((lift) => Math.abs(lift.change_kg ?? 0) >= 2.5);
    const maturity = resolveLedgerIndexMaturity({
      completedWorkouts: completed,
      hasJourneyEvidence: events.length > 0,
      hasStrengthEvidence: Boolean(strongest),
      hasAchievements: accomplishments.length > 0,
      hasArchiveEvidence: events.length > 0,
      hasMediaEvidence: Boolean(media),
    });
    const dailySignal = selectLedgerDailySignal({
      anniversary: Boolean(anniversary),
      'major-pr': Boolean(majorPr),
      achievement: Boolean(recentAchievement),
      meet: Boolean(meet),
      'reviewed-video': Boolean(media?.reviewed),
      'strength-change': hasStrengthChange,
      rediscovery: Boolean(rediscovery),
      'next-milestone': maturity.nextBoundary !== null,
      'early-action': true,
    });
    const volumeTrend = progression?.metric_trends?.volume;
    const lifetimeVolumeKg = volumeTrend?.complete_training_volume_kg
      ?? (volumeTrend?.points ?? []).reduce((sum, point) => sum + (point.value_kg ?? 0), 0);
    const dailyEvent = dailySignal === 'anniversary'
      ? anniversary
      : dailySignal === 'meet'
        ? meet
        : dailySignal === 'rediscovery'
          ? rediscovery
          : recentEvent;
    const dailyAccomplishment = dailySignal === 'major-pr'
      ? majorPr
      : dailySignal === 'achievement'
        ? recentAchievement
        : undefined;
    return {
      completed,
      lifts,
      strongest,
      unit,
      anniversary,
      meet,
      rediscovery,
      recentEvent,
      firstEvent,
      majorPr,
      recentAchievement,
      currentBests,
      maturity,
      dailySignal,
      dailyEvent,
      dailyAccomplishment,
      lifetimeVolumeKg,
    };
  }, [accomplishments, currentBests, events, media, progression]);

  if (loading || supportLoading) return <View style={styles.page} testID="ledger-home-experience"><StateMessage kind="loading" message="Opening your permanent record." /></View>;
  if (error) return <View style={styles.page} testID="ledger-home-experience"><StateMessage kind={errorKind ?? 'error'} message={error} onRetry={() => void reload()} /></View>;

  const openRoom = (room: Exclude<LedgerRoom, 'home'>) => router.push(ledgerHrefFor(room) as any);
  const openWorkouts = () => router.push('/(tabs)/workouts' as any);
  return <View testID="ledger-home-experience" accessibilityLiveRegion="polite" style={styles.page}>
    {model.maturity.name === 'seedling' ? <Seedling model={model} openRoom={openRoom} openWorkouts={openWorkouts} /> : null}
    {model.maturity.name === 'building' ? <Building model={model} media={media} openRoom={openRoom} /> : null}
    {model.maturity.name === 'established' ? <Established model={model} media={media} supportFailure={supportFailure} openRoom={openRoom} /> : null}
    {model.maturity.name === 'veteran' ? <Veteran model={model} media={media} supportFailure={supportFailure} openRoom={openRoom} /> : null}
  </View>;
}

type IndexModel = Readonly<{
  completed: number;
  lifts: LedgerLift[];
  strongest?: LedgerLift;
  unit: LedgerUnit;
  anniversary?: JourneyEvent;
  meet?: JourneyEvent;
  rediscovery?: JourneyEvent;
  recentEvent?: JourneyEvent;
  firstEvent?: JourneyEvent;
  majorPr?: AccomplishmentEvent;
  recentAchievement?: AccomplishmentEvent;
  currentBests: CurrentBest[];
  maturity: LedgerIndexMaturity;
  dailySignal: LedgerDailySignal;
  dailyEvent?: JourneyEvent;
  dailyAccomplishment?: AccomplishmentEvent;
  lifetimeVolumeKg: number;
}>;

function Seedling({ model, openRoom, openWorkouts }: { model: IndexModel; openRoom: (room: Exclude<LedgerRoom, 'home'>) => void; openWorkouts: () => void }) {
  const firstEvent = model.firstEvent;
  const firstLift = model.strongest;
  const next = Math.max(0, 10 - model.completed);
  return <View testID="ledger-index-seedling" style={[styles.statePage, styles.seedlingPage]}>
    <ImageBackground accessible={false} accessibilityIgnoresInvertColors source={ATMOSPHERIC_GYM} resizeMode="cover" style={styles.seedlingHero} imageStyle={styles.heroRadius}>
      <View style={styles.heroScrim} />
      <View style={styles.seedlingHeroCopy}>
        <Text style={styles.seedlingTitle}>{model.completed === 0 ? 'Your Ledger begins today.' : model.completed === 1 ? 'The first page is written.' : 'Your baseline is taking shape.'}</Text>
        <Text style={styles.seedlingBody}>{model.completed === 0 ? 'Your first completed Training Session becomes the opening source in your athletic story.' : `${model.completed} completed Training Session${model.completed === 1 ? '' : 's'} now belong to your permanent record.`}</Text>
      </View>
    </ImageBackground>
    {model.completed === 0 ? <Pressable testID="ledger-first-workout-action" accessibilityRole="button" accessibilityLabel="Open Training Sessions to complete your first Session" onPress={openWorkouts} style={({ pressed }) => [styles.firstWorkoutAction, pressed && styles.pressed]}><View><Text style={styles.microLabel}>FIRST HONEST STEP</Text><Text style={styles.firstWorkoutTitle}>Complete your first Training Session</Text></View><Ionicons name="arrow-forward" size={20} color="#D8C4FA" /></Pressable> : null}
    {model.completed > 0 ? <Pressable accessibilityRole="button" onPress={() => openRoom('archive')} style={({ pressed }) => [styles.firstChapter, pressed && styles.pressed]}>
      <Ionicons name="document-text-outline" size={23} color="#BFA4F4" /><View style={styles.firstChapterCopy}><Text style={styles.microLabel}>CHAPTER ONE</Text><Text style={styles.firstChapterTitle}>{firstEvent?.title || 'Your first Training Session is preserved.'}</Text><Text style={styles.firstChapterBody}>{firstEvent?.detail || 'Open the source record that started your Ledger.'}</Text></View><Ionicons name="chevron-forward" size={17} color="#778190" />
    </Pressable> : null}
    {firstLift ? <Pressable testID="ledger-strength-snapshot" accessibilityRole="button" accessibilityLabel="Open Strength baseline" onPress={() => openRoom('strength')} style={({ pressed }) => [styles.baseline, pressed && styles.pressed]}><View><Text style={styles.microLabel}>FIRST STRENGTH BASELINE</Text><Text style={styles.baselineTitle}>{firstLift.label || 'Current estimate'}</Text></View><View style={styles.valueUnit}><Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.baselineValue}>{displayWeight(firstLift.current_e1rm_kg, model.unit)}</Text><Text style={styles.unit}>{model.unit.toUpperCase()}</Text></View></Pressable> : null}
    <View style={styles.seedlingDoors}>
      <Doorway room="journey" icon="map-outline" title="Journey" detail={model.completed ? 'See where it all begins.' : 'Your story begins with real history.'} onPress={() => openRoom('journey')} quiet />
      {!firstLift ? <Doorway room="strength" icon="barbell-outline" title="Strength" detail="Your baseline starts with qualifying sets." onPress={() => openRoom('strength')} quiet /> : null}
      <Doorway room="achievements" icon="trophy-outline" title="Achievements" detail={next ? `${next} more Training Session${next === 1 ? '' : 's'} until the next Ledger chapter.` : 'Your first earned milestones await.'} onPress={() => openRoom('achievements')} quiet />
      <Doorway room="archive" icon="archive-outline" title="Archive" detail={model.completed ? 'Your source records are being preserved.' : 'Your first Training Session will be preserved here.'} onPress={() => openRoom('archive')} quiet />
    </View>
  </View>;
}

function Building({ model, media, openRoom }: { model: IndexModel; media: CanonicalMedia | null; openRoom: (room: Exclude<LedgerRoom, 'home'>) => void }) {
  const accomplishment = model.dailyAccomplishment ?? model.majorPr ?? model.recentAchievement;
  const progress = progressToNextMaturity(model.completed, model.maturity);
  const featuredRoom = roomForDailySignal(model.dailySignal);
  const usesMedia = model.dailySignal === 'reviewed-video';
  const featuredTitle = usesMedia
    ? media?.title || 'Reviewed evidence is ready.'
    : featuredRoom === 'achievements'
      ? accomplishment
        ? `${accomplishment.movement_label || 'Movement'} ${formatAccomplishment(accomplishment.event_type)}`
        : `${model.completed} Training Sessions now belong to your Ledger.`
      : featuredRoom === 'strength'
        ? model.strongest?.label || 'Your current strength is changing.'
        : model.dailyEvent?.title || 'Your history is accumulating.';
  const featuredBody = usesMedia
    ? `${media?.reviewed ? 'Reviewed' : 'Preserved'} ${dateLabel(media?.occurredAt) || 'in your Archive'}`
    : accomplishment?.occurred_at
      ? dateLabel(accomplishment.occurred_at)
      : model.dailyEvent?.detail || `${model.completed} completed Training Sessions preserved.`;
  return <View testID="ledger-index-building" style={styles.statePage}>
    <View style={styles.stateIntro}><Text style={styles.stateTitle}>Keep building.</Text><Text style={styles.stateSubtitle}>Real work is leaving a record that lasts.</Text></View>
    <Pressable testID={`ledger-${featuredRoom}-snapshot`} accessibilityRole="button" accessibilityLabel={`Open today's ${featuredRoom} highlight`} onPress={() => openRoom(featuredRoom)} style={({ pressed }) => [styles.splitFeature, pressed && styles.pressed]}>
      <View style={styles.splitCopy}><Text style={styles.microLabel}>TODAY&apos;S HIGHLIGHT</Text><Text style={styles.featureTitle}>{featuredTitle}</Text><Text style={styles.featureBody}>{featuredBody}</Text></View><EvidenceImage media={usesMedia ? media : null} compact />
    </Pressable>
    {featuredRoom !== 'journey' ? <Doorway room="journey" icon="map-outline" title={model.dailyEvent?.title || 'Your growing Journey'} detail="Open the chronology behind today’s work." onPress={() => openRoom('journey')} /> : null}
    {featuredRoom !== 'strength' ? <StrengthFeature model={model} onPress={() => openRoom('strength')} /> : null}
    {featuredRoom !== 'achievements' ? <Pressable testID="ledger-achievements-snapshot" accessibilityRole="button" accessibilityLabel="Open milestone progress in Achievements" onPress={() => openRoom('achievements')} style={({ pressed }) => [styles.maturityProgress, pressed && styles.pressed]}><View style={styles.maturityHeader}><Text style={styles.microLabel}>MILESTONE PROGRESS</Text><Text style={styles.progressCount}>{model.completed} / {model.maturity.nextBoundary}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View><Text style={styles.progressCaption}>Completed Training Sessions toward an established training record.</Text></Pressable> : null}
    {featuredRoom !== 'archive' ? <Doorway room="archive" icon="archive-outline" title={media?.title || model.recentEvent?.title || 'Preserved evidence'} detail={media ? `Added ${dateLabel(media.occurredAt) || 'to your Archive'}` : 'Open the source material behind the work.'} onPress={() => openRoom('archive')} /> : null}
  </View>;
}

function Established({ model, media, supportFailure, openRoom }: { model: IndexModel; media: CanonicalMedia | null; supportFailure: LedgerRequestFailureKind | null; openRoom: (room: Exclude<LedgerRoom, 'home'>) => void }) {
  const history = model.dailyEvent ?? model.anniversary ?? model.rediscovery ?? model.meet ?? model.recentEvent;
  const featuredRoom = roomForDailySignal(model.dailySignal);
  const usesMedia = model.dailySignal === 'reviewed-video';
  return <View testID="ledger-index-established" style={styles.statePage}>
    <View style={styles.stateIntro}><Text style={styles.stateTitle}>The work is showing up.</Text><Text style={styles.stateSubtitle}>There is enough real history now to reveal patterns.</Text></View>
    <Pressable testID={`ledger-${featuredRoom}-snapshot`} accessibilityRole="button" accessibilityLabel={`Open today's ${featuredRoom} evidence`} onPress={() => openRoom(featuredRoom)} style={({ pressed }) => [styles.establishedHero, pressed && styles.pressed]}>
      <EvidenceImage media={usesMedia ? media : null} />
      <View style={styles.establishedOverlay}><Text style={styles.microLabel}>{model.dailySignal === 'anniversary' ? 'ON THIS DAY' : model.dailySignal === 'meet' ? 'CAREER MOMENT' : usesMedia ? 'REVIEWED EVIDENCE' : model.dailySignal === 'strength-change' ? 'CURRENT STRENGTH' : model.dailySignal === 'major-pr' || model.dailySignal === 'achievement' ? 'RECENT ACHIEVEMENT' : 'FROM YOUR HISTORY'}</Text><Text style={styles.establishedTitle}>{usesMedia ? media?.title || 'Reviewed evidence is ready.' : model.dailyAccomplishment ? `${model.dailyAccomplishment.movement_label || 'Movement'} ${formatAccomplishment(model.dailyAccomplishment.event_type)}` : history?.title || (supportFailure ? 'Historical evidence is unavailable.' : 'Your career timeline is ready to explore.')}</Text><Text style={styles.establishedBody}>{usesMedia ? `Preserved ${dateLabel(media?.occurredAt) || 'in your Archive'}` : model.dailyAccomplishment?.occurred_at ? dateLabel(model.dailyAccomplishment.occurred_at) : history?.detail || `${model.completed} completed Training Sessions now shape this record.`}</Text></View>
    </Pressable>
    {featuredRoom !== 'journey' ? <Doorway room="journey" icon="map-outline" title={history?.title || 'Your career timeline'} detail="Open the chronology behind this record." onPress={() => openRoom('journey')} /> : null}
    {featuredRoom !== 'strength' ? <StrengthFeature model={model} onPress={() => openRoom('strength')} layered /> : null}
    {featuredRoom !== 'achievements' ? <Pressable testID="ledger-achievements-snapshot" accessibilityRole="button" accessibilityLabel="Open recent achievement" onPress={() => openRoom('achievements')} style={({ pressed }) => [styles.achievementFeature, pressed && styles.pressed]}><View style={styles.achievementSeal}><SLTrophy size={30} /></View><View style={styles.achievementCopy}><Text style={styles.microLabel}>RECENT ACHIEVEMENT</Text><Text style={styles.featureTitle}>{model.recentAchievement ? `${model.recentAchievement.movement_label || 'Movement'} ${formatAccomplishment(model.recentAchievement.event_type)}` : 'No earned milestone is available yet.'}</Text><Text style={styles.featureBody}>{model.currentBests.length ? `${model.currentBests.length} current canonical best${model.currentBests.length === 1 ? '' : 's'} preserved.` : 'Achievements appear only when source evidence qualifies.'}</Text></View><Ionicons name="chevron-forward" size={17} color="#778190" /></Pressable> : null}
    {featuredRoom !== 'archive' ? <Doorway room="archive" icon={media ? 'play-circle-outline' : 'archive-outline'} title={media?.title || 'Open the source record'} detail={media ? `${media.reviewed ? 'Reviewed' : 'Preserved'} ${dateLabel(media.occurredAt)}` : 'Revisit the sessions, meets, and evidence behind the story.'} onPress={() => openRoom('archive')} /> : null}
  </View>;
}

function Veteran({ model, media, supportFailure, openRoom }: { model: IndexModel; media: CanonicalMedia | null; supportFailure: LedgerRequestFailureKind | null; openRoom: (room: Exclude<LedgerRoom, 'home'>) => void }) {
  const latestChapter = model.dailyEvent ?? model.meet ?? model.anniversary ?? model.recentEvent;
  const total = displayWeight(model.lifetimeVolumeKg, model.unit);
  const usesMedia = model.dailySignal === 'reviewed-video';
  const featuredRoom = roomForDailySignal(model.dailySignal);
  const featuredTitle = usesMedia
    ? media?.title || 'Reviewed evidence is ready.'
    : model.dailyAccomplishment
      ? `${model.dailyAccomplishment.movement_label || 'Movement'} ${formatAccomplishment(model.dailyAccomplishment.event_type)}`
      : featuredRoom === 'strength'
        ? `${model.strongest?.label || 'Current'} strength evidence`
        : latestChapter?.title || (supportFailure ? 'Career evidence is unavailable.' : 'Explore the chapters already preserved.');
  const featuredBody = usesMedia
    ? `Preserved ${dateLabel(media?.occurredAt) || 'in your Archive'}`
    : model.dailyAccomplishment?.occurred_at
      ? dateLabel(model.dailyAccomplishment.occurred_at)
      : latestChapter?.detail || `${model.completed} completed Training Sessions belong to this career.`;
  return <View testID="ledger-index-veteran" style={styles.statePage}>
    <ImageBackground accessible={false} accessibilityIgnoresInvertColors source={ATMOSPHERIC_GYM} resizeMode="cover" style={styles.veteranHero} imageStyle={styles.heroRadius}>
      <View style={styles.veteranScrim} /><View style={styles.veteranHeroCopy}><Text style={styles.veteranTitle}>A career built with intent.</Text><Text style={styles.veteranBody}>Every qualifying record adds depth to the career you have built.</Text><View style={styles.careerMetrics}><CareerMetric value={String(model.completed)} label="sessions" /><CareerMetric value={model.lifetimeVolumeKg > 0 ? total : '—'} label={`Complete Training Volume ${model.unit}`} /><CareerMetric value={String(model.currentBests.length)} label="current bests" /></View></View>
    </ImageBackground>
    <Pressable testID={`ledger-${featuredRoom}-snapshot`} accessibilityRole="button" accessibilityLabel={`Open today's ${featuredRoom} career evidence`} onPress={() => openRoom(featuredRoom)} style={({ pressed }) => [styles.veteranChapter, pressed && styles.pressed]}><EvidenceImage media={usesMedia ? media : null} compact /><View style={styles.veteranChapterCopy}><Text style={styles.microLabel}>TODAY&apos;S CAREER SIGNAL</Text><Text style={styles.featureTitle}>{featuredTitle}</Text><Text style={styles.featureBody}>{featuredBody}</Text></View><Ionicons name="chevron-forward" size={17} color="#778190" /></Pressable>
    {featuredRoom !== 'journey' ? <Doorway room="journey" icon="map-outline" title={latestChapter?.title || 'The career timeline'} detail="Open the chronology behind the career." onPress={() => openRoom('journey')} /> : null}
    {featuredRoom !== 'strength' ? <StrengthFeature model={model} onPress={() => openRoom('strength')} layered /> : null}
    {featuredRoom !== 'achievements' ? <Pressable testID="ledger-achievements-snapshot" accessibilityRole="button" accessibilityLabel="Open career achievements" onPress={() => openRoom('achievements')} style={({ pressed }) => [styles.veteranAchievement, pressed && styles.pressed]}><View><Text style={styles.microLabel}>CAREER ACHIEVEMENTS</Text><Text style={styles.veteranAchievementValue}>{model.currentBests.length || '—'}</Text><Text style={styles.featureBody}>canonical current bests backed by valid evidence</Text></View><SLTrophy size={54} /></Pressable> : null}
    {featuredRoom !== 'archive' ? <Doorway room="archive" icon={media ? 'film-outline' : 'archive-outline'} title={media?.title || 'The source archive'} detail={media ? `A preserved artifact from ${dateLabel(media.occurredAt) || 'your training history'}.` : 'Revisit the evidence that made the career visible.'} onPress={() => openRoom('archive')} /> : null}
  </View>;
}

function StrengthFeature({ model, onPress, layered = false }: { model: IndexModel; onPress: () => void; layered?: boolean }) {
  const lift = model.strongest;
  const presentation = CORE_LIFT_PRESENTATION.find((item) => canonicalLiftKey(item.key) === canonicalLiftKey(lift?.key || lift?.label)) ?? CORE_LIFT_PRESENTATION[0];
  const current = displayWeight(lift?.current_e1rm_kg, model.unit);
  const delta = lift?.change_kg == null ? null : displayWeight(Math.abs(lift.change_kg), model.unit);
  return <Pressable testID="ledger-strength-snapshot" accessibilityRole="button" accessibilityLabel="Open current Strength evidence" onPress={onPress} style={({ pressed }) => [styles.strengthFeature, layered && styles.strengthFeatureLayered, pressed && styles.pressed]}>
    <View style={styles.strengthFeatureCopy}><Text style={styles.microLabel}>CURRENT STRENGTH</Text><Text style={styles.featureTitle}>{lift ? `${lift.label || presentation.key} is the strongest current estimate.` : 'Not enough qualifying strength evidence yet.'}</Text>{lift ? <View style={styles.strengthValueRow}><Text adjustsFontSizeToFit minimumFontScale={0.62} numberOfLines={1} style={styles.strengthValue}>{current}</Text><Text style={styles.unit}>{model.unit.toUpperCase()}</Text>{delta ? <Text style={styles.delta}>{(lift.change_kg ?? 0) >= 0 ? '↑' : '↓'} {delta} {model.unit}</Text> : null}</View> : <Text style={styles.featureBody}>Log movement-matched working sets to establish a trustworthy estimate.</Text>}</View>
    <Image accessible={false} source={presentation.image} resizeMode="contain" style={[styles.liftImage, { tintColor: presentation.color }]} />
  </Pressable>;
}

function CareerMetric({ value, label }: { value: string; label: string }) {
  return <View style={styles.careerMetric}><Text adjustsFontSizeToFit minimumFontScale={0.62} numberOfLines={1} style={styles.careerMetricValue}>{value}</Text><Text style={styles.careerMetricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { gap: SLSpacing.md, paddingBottom: 16 },
  statePage: { gap: 16 },
  seedlingPage: { minHeight: 640 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.988 }] },
  stateMessage: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  stateMessageText: { maxWidth: 330, color: '#A8B0BC', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: '#594672' },
  retryText: { color: '#CFB7F8', fontSize: 13, fontWeight: '600' },
  stateIntro: { gap: 7, paddingHorizontal: 4, paddingTop: 10, paddingBottom: 2 },
  stateTitle: { maxWidth: 370, color: '#F7F5F9', fontSize: 31, lineHeight: 36, fontWeight: '700', letterSpacing: -0.7 },
  stateSubtitle: { maxWidth: 360, color: '#959EAA', fontSize: 13, lineHeight: 19 },
  seedlingHero: { minHeight: 360, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#302A3A' },
  heroRadius: { borderRadius: 23 },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,5,10,0.54)' },
  seedlingHeroCopy: { gap: 10, padding: 24 },
  seedlingTitle: { maxWidth: 330, color: '#D4B8FF', fontSize: 34, lineHeight: 39, fontWeight: '600', letterSpacing: -0.8 },
  seedlingBody: { maxWidth: 330, color: '#D8D4DC', fontSize: 15, lineHeight: 22 },
  firstChapter: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2D323B' },
  firstWorkoutAction: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: '#4D3A67', backgroundColor: '#0D0F16' },
  firstWorkoutTitle: { marginTop: 4, color: '#F3EFF8', fontSize: 16, lineHeight: 20, fontWeight: '600' },
  firstChapterCopy: { flex: 1, minWidth: 0, gap: 4 },
  firstChapterTitle: { color: '#F1EEF4', fontSize: 17, lineHeight: 21, fontWeight: '600' },
  firstChapterBody: { color: '#8C96A3', fontSize: 11.5, lineHeight: 16 },
  microLabel: { color: '#A98AE0', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  baseline: { minHeight: 112, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, borderRadius: 17, borderWidth: 1, borderColor: '#292F39', backgroundColor: '#0B0F15' },
  baselineTitle: { marginTop: 5, color: '#F3F1F5', fontSize: 17, lineHeight: 21, fontWeight: '600' },
  baselineValue: { maxWidth: 150, color: '#F7F4FA', fontSize: 36, lineHeight: 40, fontWeight: '400', letterSpacing: -1 },
  valueUnit: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  unit: { color: '#A2AAB6', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  seedlingDoors: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#252B34' },
  doorway: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#29303A' },
  doorwayQuiet: { minHeight: 76 },
  doorwayIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#111620', borderWidth: 1, borderColor: '#262E39' },
  doorwayCopy: { flex: 1, minWidth: 0, gap: 3 },
  doorwayTitle: { color: '#F0EDF3', fontSize: 16, lineHeight: 20, fontWeight: '600' },
  doorwayDetail: { color: '#8993A0', fontSize: 10.5, lineHeight: 15 },
  splitFeature: { minHeight: 145, flexDirection: 'row', overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#2E3540', backgroundColor: '#0A0E14' },
  splitCopy: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 7, padding: 16 },
  featureTitle: { color: '#F4F1F6', fontSize: 18, lineHeight: 23, fontWeight: '600' },
  featureBody: { color: '#929BA7', fontSize: 11.5, lineHeight: 16 },
  evidenceImage: { width: '100%', height: 250, backgroundColor: '#10151B' },
  evidenceImageCompact: { width: '38%', height: '100%' },
  decorativeImage: { opacity: 0.72 },
  strengthFeature: { minHeight: 170, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', padding: 17, borderRadius: 19, borderWidth: 1, borderColor: '#353041', backgroundColor: '#0B0E14' },
  strengthFeatureLayered: { minHeight: 205 },
  strengthFeatureCopy: { flex: 1, minWidth: 0, gap: 7 },
  strengthValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  strengthValue: { maxWidth: 190, color: '#F7F5FA', fontSize: 48, lineHeight: 52, fontWeight: '400', letterSpacing: -1.8 },
  delta: { color: '#52D894', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  liftImage: { width: 118, height: 102, opacity: 0.92 },
  maturityProgress: { gap: 10, paddingVertical: 16, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2D333C' },
  maturityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressCount: { color: '#CAC3D5', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: '#242B35' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#9B70DE' },
  progressCaption: { color: '#7E8895', fontSize: 9.5, lineHeight: 13 },
  establishedHero: { minHeight: 305, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#343A45', backgroundColor: '#090C11' },
  establishedOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 6, padding: 18, paddingTop: 60, backgroundColor: 'rgba(4,6,9,0.68)' },
  establishedTitle: { maxWidth: 360, color: '#FFFFFF', fontSize: 25, lineHeight: 30, fontWeight: '700' },
  establishedBody: { maxWidth: 360, color: '#D0D4DA', fontSize: 12, lineHeight: 17 },
  achievementFeature: { minHeight: 135, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#34312B' },
  achievementSeal: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', borderRadius: 33, borderWidth: 1, borderColor: '#886C31', backgroundColor: '#19150D' },
  achievementCopy: { flex: 1, minWidth: 0, gap: 5 },
  veteranHero: { minHeight: 395, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#34313B' },
  veteranScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,4,8,0.48)' },
  veteranHeroCopy: { gap: 10, padding: 22, backgroundColor: 'rgba(4,5,8,0.42)' },
  veteranTitle: { maxWidth: 350, color: '#F8F5F0', fontSize: 34, lineHeight: 39, fontWeight: '700', letterSpacing: -0.8 },
  veteranBody: { maxWidth: 350, color: '#D5D2D0', fontSize: 13, lineHeight: 19 },
  careerMetrics: { flexDirection: 'row', alignItems: 'stretch', gap: 1, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  careerMetric: { flex: 1, minWidth: 0, gap: 3, paddingTop: 13 },
  careerMetricValue: { color: '#FFFFFF', fontSize: 27, lineHeight: 31, fontWeight: '400', letterSpacing: -0.8 },
  careerMetricLabel: { color: '#B6B2B4', fontSize: 8.5, lineHeight: 11, textTransform: 'uppercase' },
  veteranChapter: { minHeight: 155, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', borderRadius: 19, borderWidth: 1, borderColor: '#303741', backgroundColor: '#090D12' },
  veteranChapterCopy: { flex: 1, minWidth: 0, alignSelf: 'center', gap: 6, padding: 15 },
  veteranAchievement: { minHeight: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#4B4027', backgroundColor: '#0E0D0A' },
  veteranAchievementValue: { marginTop: 4, color: '#F5CB76', fontSize: 44, lineHeight: 48, fontWeight: '400' },
});
