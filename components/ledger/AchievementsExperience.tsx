import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { StrengthSemanticArtwork } from '@/components/ledger/StrengthSemanticArtwork';
import { SLAtmosphericContextHeader, SLCanonicalIcon, SLCompactTabRail, SLScreen, SLTrophy } from '@/components/ui';
import { FloatingControlCoordinator, FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { VolumeAchievementExperience, type VolumeAchievementDataset } from '@/components/volume-achievements/VolumeAchievementExperience';
import { SLFontFamilies, SLLayout, SLMetricTones, SLRadius, SLTypography } from '@/constants/theme';
import { useLedgerLiveData, type LedgerLiveDataFixture } from './use-ledger-live-data';
import { archiveDetailHref } from '@/lib/ledger-archive';
import { fetchLedgerAccomplishmentHistory, type AccomplishmentEvent, type StrengthMetric } from '@/lib/ledger-data';
import {
  canonicalMajorVolumeMedallions,
  canonicalPrHistory,
  resolveLedgerClubsRuntimeState,
  type MajorVolumeMedallionEvidence,
  type StrengthTierState,
} from '@/lib/ledger-rewards';
import { majorVolumeMedallionAsset } from '@/lib/major-volume-medallion-assets';
import { useAuth } from '@/context/AuthContext';
import {
  convertDisplayWeightValue,
  formatWeightFromKg,
  kilogramsToDisplayValue,
  normalizeDisplayWeightUnit,
  parseDisplayWeightUnit,
} from '@/lib/display-units';
import { resolvePlateStackRender } from '@/lib/barbell/plate-stack-render-resolver';
import { MILESTONE_RENDER_ORIENTATION_STYLE } from '@/lib/barbell/milestone-render-assets';
import { canonicalCompetitionLiftKey } from '@/lib/strength-standard-identity';
import { SL_STRENGTH_TIER_ASSETS } from '@/lib/trophy-assets';
import { STRENGTH_LEDGER_ATMOSPHERE_ASSETS } from '@/lib/strength-ledger-visual-assets';
import {
  canRenderGymTotal,
  displayWeightFromCanonicalLb,
} from '@/lib/milestones-layout';
import {
  streakPlatformBaseHeightForWidth,
  streakPlatformDeckHeight,
  streakPlatformHeight,
  streakPlatformRiseForWidth,
} from '@/lib/streak-path-layout';

/**
 * HERO SLEEVE WINDOW TUNING
 *
 * This controls the actual React Native window that contains ONLY the large
 * header hero image resolved from the immutable render catalog.
 *
 * `headerHeight` is the only value that changes the card's reserved header
 * space. `width`/`height` change the capture window only; they do not participate
 * in flex-row sizing, so a taller window cannot create dead space above the
 * identity text.
 *
 * Use `right` and `top` to place the window in the header. Progression / rail
 * sleeves are intentionally untouched.
 */
export const HERO_SLEEVE_WINDOW_TUNING = {
  headerHeight: 142,
  width: 180,
  height: 120,
  right: 10,
  top: 8,
} as const;

/** Static capture window for each smaller progression sleeve. */
export const MILESTONE_SLEEVE_WINDOW_TUNING = {
  width: 94,
  height: 60,
} as const;

type Unit = 'lb' | 'kg';
type MilestoneState = 'completed' | 'progress' | 'locked';
type AchievementSection = 'hub' | 'milestones' | 'clubs' | 'trophies' | 'medallions' | 'volume' | 'prs' | 'streaks';
type Detail = { label: string; value: string; state: MilestoneState; remaining?: string; sourceHref?: string; note?: string; actionLabel?: string } | null;
type LiftKey = Exclude<StrengthMetric, 'total'>;
type ArtifactDetail = { kind: 'trophy'; tierIndex: number } | { kind: 'lift'; liftKey: LiftKey; tierIndex?: number } | null;
type PrFilter = 'all' | LiftKey;
type LiftPresentation = { key: LiftKey; name: string; icon: keyof typeof Ionicons.glyphMap; tone: string; glow: string; softTone: string };
type Lift = LiftPresentation & { canonicalWeightKg: number | null; currentLb: number | null; sourceSetLogId?: number | null; tierState: StrengthTierState | null };
type StreakItem = { id: string; title: string; description: string; value: number; unit: string; thresholds: readonly number[]; icon: keyof typeof Ionicons.glyphMap; tone: string };

const LIFT_PRESENTATIONS: LiftPresentation[] = [
  { key: 'squat', name: 'Squat', icon: 'body-outline', tone: SLMetricTones.squat.solid, glow: '#733ED6', softTone: '#21103F' },
  { key: 'bench', name: 'Bench', icon: 'barbell-outline', tone: SLMetricTones.bench.solid, glow: '#9D2C63', softTone: '#351323' },
  { key: 'deadlift', name: 'Deadlift', icon: 'fitness-outline', tone: SLMetricTones.deadlift.solid, glow: '#B93451', softTone: '#431621' },
];

const PRIMARY_ACHIEVEMENT_SECTIONS = ['hub', 'milestones', 'clubs', 'trophies', 'medallions'] as const satisfies readonly AchievementSection[];

// Seven distinct, lift-specific renderer captures per lift. Threshold text remains
// the exact governed kg value (and exact rounded-lb projection); these images are
// presentation art and never participate in tier qualification.
const LIFT_TIER_ART_ASSETS: Record<LiftKey, readonly ImageSourcePropType[]> = {
  squat: [
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-135.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-225.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-315.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-405.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-495.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-585.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-725.png'),
  ],
  bench: [
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-95.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-175.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-225.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-315.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-405.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-495.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-585.png'),
  ],
  deadlift: [
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-185.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-275.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-365.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-455.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-545.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-675.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-895.png'),
  ],
};

const VOLUME_PRESENTATION: VolumeAchievementDataset = {
  total: { id: 'total', label: 'Complete Training Volume', current: { lb: null, kg: null }, tone: SLMetricTones.total.solid, glow: '#8A2C9E' },
  lifts: [
    { id: 'squat', label: 'Squat', current: { lb: null, kg: null }, tone: SLMetricTones.squat.solid, glow: '#6934A9', iconSource: require('@/assets/images/lift-icons/achievement-material-v2/squat.png') },
    { id: 'bench', label: 'Bench', current: { lb: null, kg: null }, tone: SLMetricTones.bench.solid, glow: '#9D2C63', iconSource: require('@/assets/images/lift-icons/achievement-material-v2/bench.png') },
    { id: 'deadlift', label: 'Deadlift', current: { lb: null, kg: null }, tone: SLMetricTones.deadlift.solid, glow: '#A52E48', iconSource: require('@/assets/images/lift-icons/achievement-material-v2/deadlift.png') },
  ],
};

const STREAK_PRESENTATIONS = [
  { id: 'sessions', title: 'Longest Session Streak', description: 'Consecutive prescribed sessions completed.', unit: 'sessions', thresholds: [5, 10, 15, 25, 50, 75], icon: 'calendar-clear-outline' as const, tone: '#A85CFF' },
  { id: 'weekly', title: 'Longest Weekly Streak', description: 'Consecutive weeks completed as programmed.', unit: 'weeks', thresholds: [4, 8, 12, 16, 20, 26], icon: 'bar-chart-outline' as const, tone: '#50DD7C' },
  { id: 'compliance', title: 'Highest Weekly Compliance', description: 'Best compliance achieved in a single week.', unit: '%', thresholds: [50, 60, 70, 80, 90, 100], icon: 'shield-checkmark-outline' as const, tone: '#3A9CFF' },
  { id: 'perfect-weeks', title: 'Perfect Weeks', description: 'Weeks with 100% compliance.', unit: 'weeks', thresholds: [1, 5, 10, 25, 50, 100], icon: 'trophy-outline' as const, tone: '#F3BE43' },
] as const;

const STRENGTH_TIER_ART_PRESENTATION = [
  { color: '#C7CED7' },
  { color: '#D68B50' },
  { color: '#D5DAE5' },
  { color: '#FFD467' },
  { color: '#A5DDF5' },
  { color: '#8BEAFF' },
  { color: '#C788FF' },
] as const;

const number = (value: number) => value.toLocaleString('en-US');
const nextMilestone = (current: number, values: number[]) => values.find((value) => value > current);
const stateFor = (current: number, target: number, next?: number): MilestoneState => target <= current ? 'completed' : target === next ? 'progress' : 'locked';
function Arc({ progress, color, size = 64, width = 3, trackColor = 'rgba(255,255,255,0.10)' }: { progress: number; color: string; size?: number; width?: number; trackColor?: string }) {
  const radius = (size - width) / 2;
  const circumference = 2 * Math.PI * radius;
  return <View pointerEvents="none" style={[styles.arc, { width: size, height: size }]}><Svg width={size} height={size}><Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={width} fill="none" /><Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress)} rotation="-90" origin={`${size / 2}, ${size / 2}`} /></Svg></View>;
}


function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.sectionHeading}><Ionicons name={icon} size={18} color="#A85CFF" /><ThemedText typographyRole="bodyStrong" style={styles.sectionTitle}>{title}</ThemedText></View>;
}

function StrengthTierTrophy({ tierIndex, state, current = false }: { tierIndex: number; state: MilestoneState; current?: boolean }) {
  const tier = STRENGTH_TIER_ART_PRESENTATION[Math.min(tierIndex, STRENGTH_TIER_ART_PRESENTATION.length - 1)];
  const isEarned = state === 'completed';
  const isProgress = state === 'progress';
  const customTrophy = SL_STRENGTH_TIER_ASSETS[tierIndex];
  const imageStyle = tierIndex === 6 ? styles.totalTierTrophyFinal : styles.totalTierTrophyImage;
  return <View style={[styles.totalTrophy, { borderColor: isEarned || isProgress ? tier.color : '#354050', backgroundColor: '#141922' }, current && styles.totalTrophyCurrent]}>
    <Image source={customTrophy} style={[imageStyle, !isEarned && styles.totalTierTrophyLocked]} resizeMode="contain" />
  </View>;
}

function StreakRow({ item, platformRise, platformBaseHeight }: { item: StreakItem; platformRise: number; platformBaseHeight: number }) {
  const next = nextMilestone(item.value, [...item.thresholds]);
  const bestThreshold = item.thresholds.filter((threshold) => threshold <= item.value).at(-1);
  return <View testID={`streak-card-${item.id}`} style={styles.streakCard}>
    <View style={styles.streakTop}>
      <View style={[styles.streakIcon, { borderColor: `${item.tone}B8` }]}><SLCanonicalIcon name={item.icon} size={25} color={item.tone} /></View>
      <View style={styles.streakCopy}>
        <View style={styles.streakTitleRow}>
          <ThemedText style={styles.streakTitle}>{item.title}</ThemedText>
          <View style={[styles.careerBestBadge, { borderColor: `${item.tone}88` }]}><ThemedText style={[styles.careerBestLabel, { color: item.tone }]}>★ CAREER BEST</ThemedText></View>
        </View>
        <ThemedText numberOfLines={1} style={styles.streakDescription}>{item.description}</ThemedText>
        <View style={styles.streakValueRow}>
          <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.streakValue}>{item.value}</ThemedText>
          <ThemedText style={[styles.streakUnit, item.unit === '%' && styles.streakUnitPercent]}>{item.unit}</ThemedText>
        </View>
      </View>
      <View style={[styles.streakBest, { borderColor: `${item.tone}B8` }]}>
        <ThemedText style={styles.streakBestLabel}>BEST</ThemedText>
        <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} style={styles.streakBestValue}>{item.value}{item.unit === '%' ? '%' : ''}</ThemedText>
      </View>
    </View>
    <View testID={`streak-path-${item.id}`} style={[styles.streakPlatformDeck, { height: streakPlatformDeckHeight(item.thresholds.length, platformBaseHeight, platformRise) }]}>
      {item.thresholds.map((threshold, index) => {
        const state = stateFor(item.value, threshold, next);
        const isBest = threshold === bestThreshold;
        const platformHeight = streakPlatformHeight(index, item.thresholds.length, platformBaseHeight, platformRise);
        return <View key={threshold} testID={`streak-step-${item.id}-${threshold}`} style={[styles.streakPlatform, index > 0 && styles.streakPlatformOverlap, {
          height: platformHeight,
          borderColor: isBest ? item.tone : state === 'locked' ? '#394454' : `${item.tone}72`,
          backgroundColor: isBest ? `${item.tone}18` : state === 'locked' ? '#0B1018' : `${item.tone}0D`,
        }, isBest && { shadowColor: item.tone }]}>
          <ThemedText numberOfLines={1} style={[styles.streakPlatformValue, state === 'locked' && styles.mutedText]}>{threshold}{item.unit === '%' ? '%' : ''}</ThemedText>
          <View style={styles.streakPlatformState}>{state === 'locked' ? <Ionicons name="lock-closed" size={12} color="#748091" /> : isBest ? <Ionicons name="star" size={16} color={item.tone} /> : <Ionicons name="checkmark" size={15} color={item.tone} />}</View>
          <View pointerEvents="none" style={[styles.streakPlatformGround, { backgroundColor: isBest ? `${item.tone}20` : state === 'locked' ? '#121925' : `${item.tone}12` }]} />
        </View>;
      })}
    </View>
  </View>;
}

function StreakContent({ items }: { items: readonly StreakItem[] }) {
  const { width } = useWindowDimensions();
  const platformRise = streakPlatformRiseForWidth(width);
  const platformBaseHeight = streakPlatformBaseHeightForWidth(width);
  return <View style={styles.streakContent}>
    <View style={styles.streakHeading}><Ionicons name="flame-outline" size={31} color="#AA61FF" /><View><ThemedText typographyRole="sectionTitle" style={styles.streakHeadingTitle}>STREAK ACHIEVEMENTS</ThemedText><ThemedText typographyRole="supportingBody" style={styles.streakHeadingCopy}>Built through consistency. These streaks are earned.</ThemedText></View></View>
    {items.map((item) => <StreakRow key={item.title} item={item} platformRise={platformRise} platformBaseHeight={platformBaseHeight} />)}
  </View>;
}

function AchievementRequestState({
  kind,
  message,
  onRetry,
}: {
  kind: 'loading' | 'empty' | 'unauthorized' | 'unavailable' | 'error';
  message: string;
  onRetry?: () => void;
}) {
  const icon = kind === 'loading'
    ? 'hourglass-outline'
    : kind === 'unauthorized'
      ? 'lock-closed-outline'
      : kind === 'unavailable'
        ? 'unlink-outline'
        : kind === 'error'
          ? 'alert-circle-outline'
          : 'trophy-outline';
  return <View testID={`achievements-${kind}-state`} style={styles.requestState}>
    <SLCanonicalIcon name={icon} size={28} color="#A85CFF" />
    <ThemedText typographyRole="bodyStrong" style={styles.requestStateTitle}>{message}</ThemedText>
    <ThemedText typographyRole="supportingBody" style={styles.requestStateCopy}>
      {kind === 'empty' ? 'Complete Training Sessions to build earned milestones and streak evidence.' : kind === 'loading' ? 'Loading canonical achievement evidence.' : 'The canonical source did not return usable achievement evidence.'}
    </ThemedText>
    {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.requestStateAction}><ThemedText typographyRole="shortButtonLabel">Try again</ThemedText></Pressable> : null}
  </View>;
}

const ACHIEVEMENT_SECTION_LABELS: Record<AchievementSection, string> = {
  hub: 'Overview',
  milestones: 'Milestones',
  clubs: 'Clubs',
  trophies: 'Trophies',
  medallions: 'Medallions',
  volume: 'Volume',
  prs: 'PR History',
  streaks: 'Streaks',
};

const MEDALLION_TONES = {
  total: '#B66CFF',
  squat: SLMetricTones.squat.solid,
  bench: SLMetricTones.bench.solid,
  deadlift: SLMetricTones.deadlift.solid,
} as const;

function requestedAchievementSection(section?: string, legacyTab?: string): AchievementSection {
  if (section && section in ACHIEVEMENT_SECTION_LABELS) return section as AchievementSection;
  if (legacyTab === 'streaks') return 'streaks';
  if (legacyTab === 'milestones') return 'milestones';
  return 'hub';
}

function formatEarnedDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPrEvent(event: AccomplishmentEvent, unit: Unit): { title: string; value: string; detail: string } {
  const title = event.movement_label || event.core_movement_key || 'Movement';
  const sourceUnit = parseDisplayWeightUnit(event.unit) || 'kg';
  const value = typeof event.current_value === 'number'
    ? `${number(Math.round(convertDisplayWeightValue(event.current_value, sourceUnit, unit)))} ${unit}`
    : 'Recorded PR';
  const bodyweight = event.reported_bodyweight?.reported_bodyweight_kg;
  const bodyweightContext = typeof bodyweight === 'number'
    ? ` · Reported BW ${formatWeightFromKg(bodyweight, unit)}${formatEarnedDate(event.reported_bodyweight?.training_date) ? ` · ${formatEarnedDate(event.reported_bodyweight?.training_date)}` : ''}`
    : '';
  if (event.event_type === 'CORE_REP_MAX_PR') {
    const reps = typeof event.evidence?.rep_count === 'number'
      ? event.evidence.rep_count
      : typeof event.evidence?.actual_reps === 'number'
        ? event.evidence.actual_reps
        : null;
    return { title, value, detail: `${reps == null ? 'Rep max PR' : `${reps}-rep max PR`}${bodyweightContext}` };
  }
  return {
    title,
    value,
    detail: `${event.event_type === 'CORE_E1RM_PR' ? 'Estimated 1RM PR' : 'Weight PR'}${bodyweightContext}`,
  };
}

function AchievementFamilyRail({ section, onSelect }: { section: AchievementSection; onSelect: (section: AchievementSection) => void }) {
  return <SLCompactTabRail
    accent="#C89B52"
    items={PRIMARY_ACHIEVEMENT_SECTIONS.map((item) => ({ key: item, label: ACHIEVEMENT_SECTION_LABELS[item] }))}
    onSelect={(item) => onSelect(item as AchievementSection)}
    selectedKey={section}
  />;
}

function AchievementsHub({
  club,
  lifts,
  unit,
  totalComplete,
  prHistory,
  onOpen,
  onOpenLift,
}: {
  club: StrengthTierState;
  lifts: readonly Lift[];
  unit: Unit;
  totalComplete: boolean;
  prHistory: readonly AccomplishmentEvent[];
  onOpen: (section: AchievementSection) => void;
  onOpenLift: (liftKey: LiftKey) => void;
}) {
  const earnedTrophies = club.earnedTierIndex + 1;
  const currentTier = club.earnedTierIndex >= 0 ? club.tiers[club.earnedTierIndex] : null;
  const nextTier = club.nextTierIndex == null ? null : club.tiers[club.nextTierIndex];
  return <View testID="ledger-achievements-hub" style={styles.hub}>
    <View style={styles.hubHero}>
      <LinearGradient colors={['rgba(83,31,120,0.38)', 'rgba(14,11,18,0.10)', '#0E0B12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <View style={styles.hubHeroArtifact}>
        <Image
          source={SL_STRENGTH_TIER_ASSETS[Math.max(0, club.earnedTierIndex)]}
          resizeMode="contain"
          style={[styles.hubHeroTrophy, club.earnedTierIndex < 0 && styles.totalTierTrophyLocked]}
        />
      </View>
      <View style={styles.hubHeroCopy}>
        <ThemedText typographyRole="shortTechnicalLabel" style={styles.hubKicker}>TOTAL STRENGTH</ThemedText>
        <ThemedText typographyRole="sectionTitle" style={styles.hubTitle}>{currentTier == null ? 'Below Tier I' : currentTier.name}</ThemedText>
        <View style={styles.hubTotalRow}><ThemedText typographyRole="heroNumeric" style={styles.hubTotalValue}>{totalComplete ? number(club.current) : '—'}</ThemedText>{totalComplete ? <ThemedText typographyRole="unit" style={styles.hubTotalUnit}>{unit.toUpperCase()}</ThemedText> : null}</View>
        <ThemedText typographyRole="bodyStrong" style={styles.hubPercentile}>{currentTier ? `~P${currentTier.actual_percentile.toFixed(1)}` : 'No total standing yet'}</ThemedText>
        <View style={styles.hubProgressTrack}><View style={[styles.hubProgressFill, { width: `${Math.max(0, Math.min(1, club.progress)) * 100}%` }]} /></View>
        <ThemedText typographyRole="supportingBody" style={styles.hubCopy}>{nextTier ? `${number(club.remaining ?? 0)} ${unit.toUpperCase()} to ${nextTier.name}` : totalComplete ? 'Highest governed tier reached' : 'Requires exact Squat, Bench, and Deadlift PRs.'}</ThemedText>
      </View>
    </View>

    <View style={styles.overviewSectionHeader}><ThemedText typographyRole="shortTechnicalLabel" style={styles.overviewSectionTitle}>CORE LIFT TIERS</ThemedText><Pressable onPress={() => onOpen('clubs')}><ThemedText typographyRole="shortTechnicalLabel" style={styles.overviewSectionAction}>VIEW CLUBS</ThemedText></Pressable></View>
    <View style={styles.overviewLiftGrid}>{lifts.map((lift) => {
      const tierState = lift.tierState;
      const currentLiftTier = tierState && tierState.earnedTierIndex >= 0 ? tierState.tiers[tierState.earnedTierIndex] : null;
      return <Pressable key={lift.key} testID={`achievement-overview-${lift.key}`} onPress={() => onOpenLift(lift.key)} style={({ pressed }) => [styles.overviewLiftCard, { borderColor: `${lift.tone}60` }, pressed && styles.pressed]}>
        <View style={[styles.overviewLiftArtStage, { backgroundColor: `${lift.tone}18` }]}><StrengthSemanticArtwork lift={lift.key} destination="achievement-card" testID={`achievement-overview-art-${lift.key}`} /></View>
        <View style={styles.overviewLiftCopy}><ThemedText typographyRole="shortTechnicalLabel" style={[styles.overviewLiftName, { color: lift.tone }]}>{lift.key === 'bench' ? 'BENCH' : lift.name.toUpperCase()}</ThemedText>
          <ThemedText typographyRole="bodyStrong" style={styles.overviewLiftTier}>{currentLiftTier?.name ?? 'Below I'}</ThemedText>
          <ThemedText typographyRole="milestoneThreshold" style={styles.overviewLiftValue}>{tierState ? number(tierState.current) : '—'} {tierState ? unit.toUpperCase() : ''}</ThemedText>
          <ThemedText typographyRole="caption" style={styles.overviewLiftPercentile}>{currentLiftTier ? `~P${currentLiftTier.actual_percentile.toFixed(1)}` : 'No standing'}</ThemedText>
        </View>
      </Pressable>;
    })}</View>

    <View style={styles.overviewSectionHeader}><ThemedText typographyRole="shortTechnicalLabel" style={styles.overviewSectionTitle}>RECENT ACHIEVEMENTS</ThemedText><Pressable testID="achievement-family-prs" onPress={() => onOpen('prs')}><ThemedText typographyRole="shortTechnicalLabel" style={styles.overviewSectionAction}>PR HISTORY</ThemedText></Pressable></View>
    <View style={styles.recentAchievementList}>{prHistory.slice(0, 3).map((event) => { const summary = formatPrEvent(event, unit); const date = formatEarnedDate(event.occurred_at || event.workout_date); return <Pressable key={event.id} onPress={() => onOpen('prs')} style={({ pressed }) => [styles.recentAchievementRow, pressed && styles.pressed]}><View style={styles.recentPrBadge}><ThemedText typographyRole="shortTechnicalLabel" style={styles.recentPrBadgeText}>PR</ThemedText></View><View style={styles.recentAchievementCopy}><ThemedText typographyRole="bodyStrong" style={styles.recentAchievementTitle}>{summary.title}</ThemedText><ThemedText typographyRole="caption" style={styles.recentAchievementDate}>{date ?? summary.detail}</ThemedText></View><ThemedText typographyRole="milestoneThreshold" style={styles.recentAchievementValue}>{summary.value}</ThemedText><Ionicons name="chevron-forward" size={15} color="#737D8B" /></Pressable>; })}{!prHistory.length ? <View style={styles.recentEmpty}><ThemedText typographyRole="supportingBody" style={styles.hubCopy}>No canonical PR event has been recorded yet.</ThemedText></View> : null}</View>

    <View style={styles.overviewDoorways}>
      <Pressable testID="achievement-family-milestones" onPress={() => onOpen('milestones')} style={({ pressed }) => [styles.overviewDoorway, pressed && styles.pressed]}><Ionicons name="flag-outline" size={21} color="#A85CFF" /><ThemedText typographyRole="bodyStrong" style={styles.overviewDoorwayText}>Milestones</ThemedText><Ionicons name="chevron-forward" size={16} color="#737D8B" /></Pressable>
      <Pressable testID="achievement-family-trophies" onPress={() => onOpen('trophies')} style={({ pressed }) => [styles.overviewDoorway, pressed && styles.pressed]}><Image source={SL_STRENGTH_TIER_ASSETS[Math.max(0, club.earnedTierIndex)]} resizeMode="contain" style={styles.overviewDoorwayTrophy} /><ThemedText typographyRole="bodyStrong" style={styles.overviewDoorwayText}>{earnedTrophies} of 7 trophies</ThemedText><Ionicons name="chevron-forward" size={16} color="#737D8B" /></Pressable>
      <Pressable testID="achievement-family-medallions" onPress={() => onOpen('medallions')} style={({ pressed }) => [styles.overviewDoorway, pressed && styles.pressed]}><Ionicons name="ribbon-outline" size={21} color="#D69A45" /><ThemedText typographyRole="bodyStrong" style={styles.overviewDoorwayText}>Medallions</ThemedText><Ionicons name="chevron-forward" size={16} color="#737D8B" /></Pressable>
    </View>
  </View>;
}

function StrengthTierCabinet({ club, unit, complete, onOpen }: { club: StrengthTierState; unit: Unit; complete: boolean; onOpen: (tierIndex: number) => void }) {
  return <View testID="ledger-strength-tier-cabinet" style={styles.cabinet}>
    <View style={styles.cabinetHeader}><ThemedText typographyRole="sectionTitle" style={styles.cabinetTitle}>STRENGTH TIER CABINET</ThemedText><ThemedText typographyRole="supportingBody" style={styles.cabinetCopy}>Seven sex-specific Total tiers calibrated from the Strength Ledger OpenPowerlifting reference standard. Kilograms are canonical.</ThemedText></View>
    {!complete ? <AchievementRequestState kind="empty" message="A complete canonical total is not available yet" /> : null}
    <View style={styles.cabinetGrid}>{club.thresholds.map((threshold, tierIndex) => {
      const state: MilestoneState = tierIndex <= club.earnedTierIndex ? 'completed' : tierIndex === club.nextTierIndex ? 'progress' : 'locked';
      const tier = club.tiers[tierIndex];
      return <Pressable key={threshold} testID={`total-strength-tier-${tier.tier}`} onPress={() => onOpen(tierIndex)} style={({ pressed }) => [styles.cabinetItem, state === 'progress' && styles.cabinetItemProgress, pressed && styles.pressed]}>
        <Image source={SL_STRENGTH_TIER_ASSETS[tierIndex]} resizeMode="contain" style={[styles.cabinetTrophyImage, state !== 'completed' && styles.totalTierTrophyLocked]} />
        <ThemedText typographyRole="modalTitle" style={styles.cabinetItemTitle}>{tier.name}</ThemedText>
        <ThemedText typographyRole="milestoneThreshold" style={styles.cabinetThreshold}>{number(threshold)} {unit.toUpperCase()}</ThemedText>
        <ThemedText typographyRole="caption" style={styles.cabinetPercentile}>~P{tier.actual_percentile.toFixed(1)}</ThemedText>
        <ThemedText typographyRole="shortTechnicalLabel" style={[styles.cabinetState, state === 'completed' && styles.cabinetStateEarned]}>{state === 'completed' ? 'EARNED' : state === 'progress' ? 'NEXT' : 'LOCKED'}</ThemedText>
      </Pressable>;
    })}</View>
  </View>;
}

function MedallionGallery({ items, onOpen, unit }: { items: readonly MajorVolumeMedallionEvidence[]; onOpen: (label: string, value: string, state: MilestoneState, remaining?: string, sourceHref?: string, note?: string) => void; unit: Unit }) {
  if (!items.length) return <View testID="ledger-medallion-gallery"><AchievementRequestState kind="empty" message="No recorded lifetime-volume medallions yet" /></View>;
  return <View testID="ledger-medallion-gallery" style={styles.medallionGallery}>
    <View style={styles.cabinetHeader}><ThemedText typographyRole="sectionTitle" style={styles.cabinetTitle}>MAJOR VOLUME MEDALLIONS</ThemedText><ThemedText typographyRole="supportingBody" style={styles.cabinetCopy}>Earned only from canonical threshold-crossing events. The engraved artwork is the record.</ThemedText></View>
    <View style={styles.medallionGrid}>{items.map((item) => {
      const tone = MEDALLION_TONES[item.family];
      const date = formatEarnedDate(item.occurredAt);
      const sourceHref = item.sourceSetLogId ? archiveDetailHref('set', item.sourceSetLogId) : undefined;
      const displayThreshold = number(convertDisplayWeightValue(item.thresholdLb, 'lb', unit));
      return <Pressable key={item.event.id} onPress={() => onOpen(`${item.family === 'total' ? 'Total' : item.family[0].toUpperCase() + item.family.slice(1)} Lifetime Volume`, `${displayThreshold} ${unit.toUpperCase()}`, 'completed', undefined, sourceHref, date ? `Earned ${date}.` : undefined)} style={({ pressed }) => [styles.medallionItem, { borderColor: `${tone}52` }, pressed && styles.pressed]}>
        <Image source={majorVolumeMedallionAsset(item.family, item.thresholdLb)} resizeMode="contain" style={styles.medallionImage} />
        <ThemedText typographyRole="shortTechnicalLabel" style={[styles.medallionFamily, { color: tone }]}>{item.family.toUpperCase()}</ThemedText>
        <ThemedText typographyRole="milestoneThreshold" style={styles.medallionThreshold}>{displayThreshold} {unit.toUpperCase()}</ThemedText>
        {date ? <ThemedText typographyRole="caption" style={styles.medallionDate}>{date}</ThemedText> : null}
      </Pressable>;
    })}</View>
  </View>;
}

function PrHistory({ events, onOpen, unit }: { events: readonly AccomplishmentEvent[]; onOpen: (event: AccomplishmentEvent) => void; unit: Unit }) {
  const [filter, setFilter] = useState<PrFilter>('all');
  const filteredEvents = filter === 'all'
    ? events
    : events.filter((event) => canonicalCompetitionLiftKey(event.core_movement_key) === filter);
  if (!events.length) return <View testID="ledger-pr-history"><AchievementRequestState kind="empty" message="No canonical PR history yet" /></View>;
  return <View testID="ledger-pr-history" style={styles.prHistory}>
    <View style={styles.cabinetHeader}><ThemedText typographyRole="sectionTitle" style={styles.cabinetTitle}>PR HISTORY</ThemedText><ThemedText typographyRole="supportingBody" style={styles.cabinetCopy}>Career PR events preserved by the accomplishment platform. Open any qualifying SetLog that is still available.</ThemedText></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prFilterRail}>{(['all', 'squat', 'bench', 'deadlift'] as const).map((item) => <Pressable key={item} testID={`pr-filter-${item}`} accessibilityRole="tab" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.prFilterChip, filter === item && styles.prFilterChipActive]}><ThemedText typographyRole="shortTechnicalLabel" style={[styles.prFilterText, filter === item && styles.prFilterTextActive]}>{item === 'all' ? 'All' : item === 'bench' ? 'Bench' : item[0].toUpperCase() + item.slice(1)}</ThemedText></Pressable>)}</ScrollView>
    {filteredEvents.map((event) => { const summary = formatPrEvent(event, unit); const date = formatEarnedDate(event.occurred_at || event.workout_date); return <Pressable key={event.id} disabled={!event.source_set_log_id} onPress={() => onOpen(event)} style={({ pressed }) => [styles.prHistoryRow, pressed && styles.pressed]}>
      <View style={styles.prHistoryIcon}><Ionicons name={event.event_type === 'CORE_REP_MAX_PR' ? 'repeat-outline' : event.event_type === 'CORE_E1RM_PR' ? 'analytics-outline' : 'barbell-outline'} size={19} color="#B66CFF" /></View>
      <View style={styles.prHistoryCopy}><ThemedText typographyRole="bodyStrong" style={styles.prHistoryTitle}>{summary.title}</ThemedText><ThemedText typographyRole="caption" style={styles.prHistoryMeta}>{summary.detail}{date ? ` · ${date}` : ''}</ThemedText></View>
      <ThemedText typographyRole="milestoneThreshold" style={styles.prHistoryValue}>{summary.value}</ThemedText>
      {event.source_set_log_id ? <Ionicons name="chevron-forward" size={16} color="#788394" /> : null}
    </Pressable>; })}
    {!filteredEvents.length ? <View style={styles.filteredEmpty}><ThemedText typographyRole="supportingBody" style={styles.cabinetCopy}>No {filter} PR evidence is recorded yet.</ThemedText></View> : null}
  </View>;
}

function MilestoneFamilyRow({
  icon,
  tone,
  title,
  subtitle,
  count,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
  subtitle: string;
  count: string;
  onPress?: () => void;
}) {
  const content = <><View style={[styles.milestoneFamilyIcon, { borderColor: `${tone}66`, backgroundColor: `${tone}12` }]}><Ionicons name={icon} size={27} color={tone} /></View><View style={styles.milestoneFamilyCopy}><ThemedText typographyRole="bodyStrong" style={styles.milestoneFamilyTitle}>{title}</ThemedText><ThemedText typographyRole="caption" style={styles.milestoneFamilySubtitle}>{subtitle}</ThemedText></View><ThemedText typographyRole="milestoneThreshold" style={styles.milestoneFamilyCount}>{count}</ThemedText>{onPress ? <Ionicons name="chevron-forward" size={17} color="#758091" /> : null}</>;
  return onPress
    ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.milestoneFamilyRow, pressed && styles.pressed]}>{content}</Pressable>
    : <View style={styles.milestoneFamilyRow}>{content}</View>;
}

function MilestonesIndex({
  club,
  sessionCount,
  trainingAge,
  volumeCount,
  streakCount,
  onOpen,
}: {
  club: StrengthTierState;
  sessionCount: number;
  trainingAge: number;
  volumeCount: number;
  streakCount: number;
  onOpen: (section: AchievementSection) => void;
}) {
  const strengthEarned = Math.max(0, club.earnedTierIndex + 1);
  return <View testID="ledger-milestones-index" style={styles.milestonesIndex}>
    <View style={styles.cabinetHeader}><ThemedText typographyRole="sectionTitle" style={styles.cabinetTitle}>MILESTONES</ThemedText><ThemedText typographyRole="supportingBody" style={styles.cabinetCopy}>Strength, consistency, volume, and training longevity—organized by the record they represent.</ThemedText></View>
    <MilestoneFamilyRow icon="trophy-outline" tone="#D6A64A" title="Strength Tiers" subtitle="Total, Squat, Bench, Deadlift" count={`${strengthEarned} / 7`} onPress={() => onOpen('clubs')} />
    <MilestoneFamilyRow icon="calendar-outline" tone="#4A9CFF" title="Session Landmarks" subtitle="Completed Training sessions" count={number(sessionCount)} />
    <MilestoneFamilyRow icon="stats-chart-outline" tone="#A85CFF" title="Volume Milestones" subtitle="Lifetime training volume" count={`${volumeCount} earned`} onPress={() => onOpen('volume')} />
    <MilestoneFamilyRow icon="flame-outline" tone="#F18B43" title="Streaks" subtitle="Consistent training records" count={`${streakCount} active`} onPress={() => onOpen('streaks')} />
    <MilestoneFamilyRow icon="time-outline" tone="#F0C64F" title="Training Age" subtitle="Time under the bar" count={`${trainingAge} yr`} />
    <MilestoneFamilyRow icon="star-outline" tone="#D5A13F" title="Special Achievements" subtitle="Governed accomplishment events" count="Evidence-led" />
  </View>;
}

function TrophyDetailView({
  club,
  lifts,
  tierIndex,
  unit,
  sexLabel,
  onOpenStandards,
}: {
  club: StrengthTierState;
  lifts: readonly Lift[];
  tierIndex: number;
  unit: Unit;
  sexLabel?: string | null;
  onOpenStandards: () => void;
}) {
  const tier = club.tiers[tierIndex];
  const threshold = club.thresholds[tierIndex];
  const state: MilestoneState = tierIndex <= club.earnedTierIndex ? 'completed' : tierIndex === club.nextTierIndex ? 'progress' : 'locked';
  const stateLabel = state === 'completed' ? 'EARNED' : state === 'progress' ? 'NEXT' : 'LOCKED';
  return <View testID="achievement-trophy-detail" style={styles.artifactDetail}>
    <View style={styles.trophyDetailHero}>
      <LinearGradient colors={['#18101F', '#09070D', '#020306']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.trophyDetailAura, { backgroundColor: `${STRENGTH_TIER_ART_PRESENTATION[tierIndex].color}18`, shadowColor: STRENGTH_TIER_ART_PRESENTATION[tierIndex].color }]} />
      <Image source={SL_STRENGTH_TIER_ASSETS[tierIndex]} resizeMode="contain" style={[styles.trophyDetailImage, state === 'locked' && styles.totalTierTrophyLocked]} />
      <View style={styles.trophyDetailIdentity}><ThemedText typographyRole="shortTechnicalLabel" style={[styles.trophyDetailState, { color: STRENGTH_TIER_ART_PRESENTATION[tierIndex].color }]}>{stateLabel}</ThemedText><ThemedText typographyRole="sectionTitle" style={styles.trophyDetailTier}>{tier.name}</ThemedText><View style={styles.trophyDetailMetricRow}><ThemedText typographyRole="heroNumeric" style={styles.trophyDetailMetric}>{number(threshold)}</ThemedText><ThemedText typographyRole="unit" style={styles.trophyDetailUnit}>{unit.toUpperCase()}</ThemedText></View><ThemedText typographyRole="bodyStrong" style={styles.trophyDetailPercentile}>~{tier.actual_percentile.toFixed(1)}th percentile</ThemedText></View>
    </View>
    <ThemedText typographyRole="supportingBody" style={styles.artifactNarrative}>{tier.name} is calibrated to approximately the {tier.actual_percentile.toFixed(1)}th percentile among {sexLabel?.toLowerCase() ?? 'the selected'} raw SBD lifters in the governed OpenPowerlifting reference cohort.</ThemedText>
    <View style={styles.artifactSection}><ThemedText typographyRole="shortTechnicalLabel" style={styles.artifactSectionTitle}>RELATED STRENGTH EVIDENCE</ThemedText>{lifts.map((lift) => { const liftTier = lift.tierState && lift.tierState.earnedTierIndex >= 0 ? lift.tierState.tiers[lift.tierState.earnedTierIndex] : null; return <View key={lift.key} style={styles.evidenceRow}><StrengthSemanticArtwork lift={lift.key} destination="tier-progression" style={styles.evidenceArt} /><View style={styles.evidenceCopy}><ThemedText typographyRole="bodyStrong" style={styles.evidenceTitle}>{lift.key === 'bench' ? 'Bench Press' : lift.name}</ThemedText><ThemedText typographyRole="caption" style={styles.evidenceMeta}>{liftTier?.name ?? 'Below Tier I'}{liftTier ? ` · ~P${liftTier.actual_percentile.toFixed(1)}` : ''}</ThemedText></View><ThemedText typographyRole="milestoneThreshold" style={styles.evidenceValue}>{lift.tierState ? number(lift.tierState.current) : '—'} {lift.tierState ? unit.toUpperCase() : ''}</ThemedText></View>; })}</View>
    <View style={styles.standardContext}><Ionicons name="shield-checkmark-outline" size={21} color="#B987F8" /><View style={styles.standardContextCopy}><ThemedText typographyRole="bodyStrong" style={styles.standardContextTitle}>Governed strength standard</ThemedText><ThemedText typographyRole="caption" style={styles.standardContextBody}>Canonical threshold: {number(tier.threshold_kg)} KG · display conversion: {number(tier.display_lb)} LB · standard {club.standardVersion}</ThemedText></View></View>
    <Pressable testID="trophy-detail-view-standards" onPress={onOpenStandards} style={({ pressed }) => [styles.artifactPrimaryAction, pressed && styles.pressed]}><ThemedText typographyRole="shortButtonLabel" style={styles.detailCloseText}>View Standards</ThemedText><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></Pressable>
  </View>;
}

function LiftTierDetailView({
  lift,
  unit,
  requestedTierIndex,
  sexLabel,
  onOpenEvidence,
}: {
  lift: Lift;
  unit: Unit;
  requestedTierIndex?: number;
  sexLabel?: string | null;
  onOpenEvidence: () => void;
}) {
  const state = lift.tierState;
  const initialTier = requestedTierIndex ?? Math.max(0, state?.earnedTierIndex ?? 0);
  const [selectedTierIndex, setSelectedTierIndex] = useState(initialTier);
  useEffect(() => setSelectedTierIndex(initialTier), [initialTier, lift.key]);
  if (!state) return <AchievementRequestState kind="empty" message={`No canonical ${lift.name} strength evidence yet`} />;
  const currentTier = state.earnedTierIndex >= 0 ? state.tiers[state.earnedTierIndex] : null;
  const selectedTier = state.tiers[selectedTierIndex];
  const nextTier = state.nextTierIndex == null ? null : state.tiers[state.nextTierIndex];
  return <View testID={`achievement-lift-tier-detail-${lift.key}`} style={styles.artifactDetail}>
    <View style={[styles.liftDetailHero, { borderColor: `${lift.tone}72` }]}>
      <View style={[styles.liftDetailHeroArtStage, { backgroundColor: `${lift.tone}18` }]}><StrengthSemanticArtwork lift={lift.key} destination="detail-hero" testID={`achievement-detail-art-${lift.key}`} /></View>
      <View style={styles.liftDetailHeroCopy}><ThemedText typographyRole="shortTechnicalLabel" style={[styles.liftDetailKicker, { color: lift.tone }]}>{lift.key === 'bench' ? 'BENCH PRESS' : lift.name.toUpperCase()}</ThemedText><ThemedText typographyRole="bodyStrong" style={styles.liftDetailTier}>{currentTier?.name ?? 'Below Tier I'}</ThemedText><View style={styles.liftDetailMetricRow}><ThemedText typographyRole="heroNumeric" style={styles.liftDetailMetric}>{number(state.current)}</ThemedText><ThemedText typographyRole="unit" style={styles.liftDetailUnit}>{unit.toUpperCase()}</ThemedText></View><ThemedText typographyRole="bodyStrong" style={styles.liftDetailPercentile}>{currentTier ? `~${currentTier.actual_percentile.toFixed(1)}th percentile` : `Tier I begins at ${number(state.thresholds[0])} ${unit.toUpperCase()}`}</ThemedText>{nextTier ? <ThemedText typographyRole="supportingBody" style={styles.liftDetailNext}>{number(state.remaining ?? 0)} {unit.toUpperCase()} to {nextTier.name}</ThemedText> : <ThemedText typographyRole="supportingBody" style={styles.liftDetailNext}>Highest governed tier reached</ThemedText>}</View>
    </View>
    <View style={styles.progressRow}><View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${state.progress * 100}%`, backgroundColor: lift.tone }]} /></View><ThemedText typographyRole="milestoneThreshold" style={styles.progressPercent}>{Math.round(state.progress * 100)}%</ThemedText></View>
    <ThemedText typographyRole="shortTechnicalLabel" style={styles.artifactSectionTitle}>FULL SEVEN-TIER PROGRESSION</ThemedText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liftDetailTierRail}>{state.tiers.map((tier, tierIndex) => { const tierState: MilestoneState = tierIndex <= state.earnedTierIndex ? 'completed' : tierIndex === state.nextTierIndex ? 'progress' : 'locked'; const selected = tierIndex === selectedTierIndex; return <Pressable key={tier.tier} testID={`${lift.key}-detail-tier-${tier.tier}`} onPress={() => setSelectedTierIndex(tierIndex)} style={[styles.liftDetailTierCard, selected && { borderColor: lift.tone, backgroundColor: `${lift.tone}12` }]}><Image source={LIFT_TIER_ART_ASSETS[lift.key][tierIndex]} resizeMode="contain" style={[styles.liftDetailTierArt, MILESTONE_RENDER_ORIENTATION_STYLE, tierState === 'locked' && styles.totalTierTrophyLocked]} /><ThemedText typographyRole="shortTechnicalLabel" style={[styles.liftDetailTierName, selected && { color: lift.tone }]}>{tier.name}</ThemedText><ThemedText typographyRole="milestoneThreshold" style={styles.liftDetailTierThreshold}>{number(state.thresholds[tierIndex])} {unit.toUpperCase()}</ThemedText><ThemedText typographyRole="caption" style={styles.liftDetailTierPercentile}>~P{tier.actual_percentile.toFixed(1)}</ThemedText><ThemedText typographyRole="shortTechnicalLabel" style={[styles.liftDetailTierStatus, tierState === 'completed' && { color: lift.tone }]}>{tierState === 'completed' ? 'EARNED' : tierState === 'progress' ? 'NEXT' : 'LOCKED'}</ThemedText></Pressable>; })}</ScrollView>
    <View style={styles.selectedStandard}><ThemedText typographyRole="shortTechnicalLabel" style={[styles.selectedStandardKicker, { color: lift.tone }]}>{selectedTier.name} STANDARD</ThemedText><View style={styles.selectedStandardRow}><ThemedText typographyRole="heroNumeric" style={styles.selectedStandardValue}>{number(state.thresholds[selectedTierIndex])}</ThemedText><ThemedText typographyRole="unit" style={styles.selectedStandardUnit}>{unit.toUpperCase()}</ThemedText><ThemedText typographyRole="bodyStrong" style={styles.selectedStandardPercentile}>~{selectedTier.actual_percentile.toFixed(1)}th percentile</ThemedText></View><ThemedText typographyRole="caption" style={styles.selectedStandardCopy}>Canonical {number(selectedTier.threshold_kg)} KG threshold for {sexLabel?.toLowerCase() ?? 'the selected'} raw lifters · {state.standardVersion}</ThemedText></View>
    <View style={styles.standardsTable}><View style={styles.standardsTableHeader}><ThemedText typographyRole="shortTechnicalLabel" style={styles.standardsTableHeaderText}>TIER</ThemedText><ThemedText typographyRole="shortTechnicalLabel" style={styles.standardsTableHeaderText}>STANDARD</ThemedText><ThemedText typographyRole="shortTechnicalLabel" style={styles.standardsTableHeaderText}>COHORT</ThemedText></View>{state.tiers.map((tier, tierIndex) => <Pressable key={tier.tier} onPress={() => setSelectedTierIndex(tierIndex)} style={[styles.standardsTableRow, tierIndex === selectedTierIndex && styles.standardsTableRowActive]}><ThemedText typographyRole="bodyStrong" style={styles.standardsTableCell}>{tier.name}</ThemedText><ThemedText typographyRole="milestoneThreshold" style={styles.standardsTableCell}>{number(state.thresholds[tierIndex])} {unit.toUpperCase()}</ThemedText><ThemedText typographyRole="caption" style={styles.standardsTableCell}>~P{tier.actual_percentile.toFixed(1)}</ThemedText></Pressable>)}</View>
    {lift.sourceSetLogId ? <Pressable testID="lift-tier-open-evidence" onPress={onOpenEvidence} style={({ pressed }) => [styles.artifactPrimaryAction, { backgroundColor: lift.tone }, pressed && styles.pressed]}><ThemedText typographyRole="shortButtonLabel" style={styles.detailCloseText}>Open Current PR Evidence</ThemedText><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></Pressable> : null}
  </View>;
}

export default function AchievementsExperience({ onBack, backAccessibilityLabel = 'Back to The Ledger', devFixture }: { onBack?: () => void; backAccessibilityLabel?: string; devFixture?: LedgerLiveDataFixture } = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { unit: requestedUnit, tab: requestedTab, section: requestedSection } = useLocalSearchParams<{ unit?: string; tab?: string; section?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const [unit, setUnit] = useState<Unit>(() => requestedUnit === 'kg' || requestedUnit === 'lb'
    ? requestedUnit
    : normalizeDisplayWeightUnit(user?.preferred_units));
  const [section, setSection] = useState<AchievementSection>(() => requestedAchievementSection(requestedSection, requestedTab));
  const [detail, setDetail] = useState<Detail>(null);
  const [artifactDetail, setArtifactDetail] = useState<ArtifactDetail>(null);
  const [historyEvents, setHistoryEvents] = useState<AccomplishmentEvent[]>([]);
  const liveData = useLedgerLiveData('all', { fixture: devFixture });
  const progression = liveData.progression;
  const currentBests = liveData.currentBests;
  const loading = liveData.loading;
  const error = liveData.error;
  const errorKind = liveData.errorKind;
  const reload = liveData.reload;
  const timelineEvents = historyEvents.length ? historyEvents : liveData.accomplishments;
  const volumeMedallions = canonicalMajorVolumeMedallions(timelineEvents);
  const prHistory = canonicalPrHistory(timelineEvents);
  const clubsRuntime = resolveLedgerClubsRuntimeState(
    currentBests,
    liveData.strengthStandard ?? progression?.strength_standard,
    liveData.strengthStanding,
    unit,
  );
  const strengthStandard = clubsRuntime.standard;
  const liveLifts = LIFT_PRESENTATIONS.map((lift): Lift => ({
    ...lift,
    ...clubsRuntime.lifts.find((candidate) => candidate.key === lift.key)!,
  }));
  const weeks = progression?.consistency?.weeks ?? [];
  const weeklyRates = weeks
    .filter((week) => (week.assigned ?? 0) > 0)
    .map((week) => Math.round(((week.completed ?? 0) / Math.max(1, week.assigned ?? 0)) * 100));
  let runningWeeklyStreak = 0;
  let longestWeeklyStreak = 0;
  weeklyRates.forEach((rate) => {
    runningWeeklyStreak = rate >= 100 ? runningWeeklyStreak + 1 : 0;
    longestWeeklyStreak = Math.max(longestWeeklyStreak, runningWeeklyStreak);
  });
  const perfectWeeks = weeklyRates.filter((rate) => rate >= 100).length;
  const liveStreaks = STREAK_PRESENTATIONS.flatMap((item): StreakItem[] => {
    if (item.id === 'sessions') {
      const value = progression?.consistency?.best_streak;
      return value == null ? [] : [{ ...item, value }];
    }
    if (!weeklyRates.length) return [];
    if (item.id === 'weekly') return [{ ...item, value: longestWeeklyStreak }];
    if (item.id === 'compliance') return [{ ...item, value: Math.max(...weeklyRates) }];
    return [{ ...item, value: perfectWeeks }];
  });
  const volumePoints = progression?.metric_trends?.volume?.points ?? [];
  const volumeTrend = progression?.metric_trends?.volume;
  const pointDerivedCompleteVolumeKg = volumePoints.reduce((sum, point) => sum + (point.value_kg ?? 0), 0);
  const totalVolumeKg = volumeTrend?.complete_training_volume_kg ?? pointDerivedCompleteVolumeKg;
  const byLiftKg = volumeTrend?.competition_by_lift_kg ?? volumeTrend?.by_lift_kg ?? {};
  const pointDerivedCompetitionVolumeKg = Object.values(byLiftKg).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const competitionTotalVolumeKg = volumeTrend?.competition_total_volume_kg ?? pointDerivedCompetitionVolumeKg;
  const hasVolumeData = totalVolumeKg > 0 || competitionTotalVolumeKg > 0;
  const volumeDataset: VolumeAchievementDataset = {
    ...VOLUME_PRESENTATION,
    total: { ...VOLUME_PRESENTATION.total, current: { kg: Math.round(totalVolumeKg), lb: Math.round(kilogramsToDisplayValue(totalVolumeKg, 'lb')) } },
    competitionTotal: {
      label: 'Competition Total Volume',
      current: competitionTotalVolumeKg > 0
        ? { kg: Math.round(competitionTotalVolumeKg), lb: Math.round(kilogramsToDisplayValue(competitionTotalVolumeKg, 'lb')) }
        : { kg: null, lb: null },
    },
    lifts: VOLUME_PRESENTATION.lifts.map((lift) => {
      const kg = byLiftKg[lift.id as 'squat' | 'bench' | 'deadlift'];
      return typeof kg === 'number' && kg > 0
        ? { ...lift, current: { kg: Math.round(kg), lb: Math.round(kilogramsToDisplayValue(kg, 'lb')) } }
        : { ...lift, current: { kg: null, lb: null } };
    }),
  };
  const canonicalStrengthTotal = clubsRuntime.total;
  const club = clubsRuntime.totalState;
  const hasCompleteStrengthTotal = canonicalStrengthTotal.complete;
  const totalMilestones = [...(club?.thresholds ?? [])];
  const total = { current: club?.current ?? 0, next: club?.next ?? totalMilestones.at(-1) ?? club?.current ?? 0, prior: club?.prior ?? 0 };
  const totalProgress = club?.progress ?? 0;
  const remaining = club?.remaining ?? 0;
  const highestCompletedTier = Math.max(0, club?.earnedTierIndex ?? -1);
  const currentTotalTier = club && club.earnedTierIndex >= 0 ? club.tiers[club.earnedTierIndex] : null;
  const nextTotalTier = club?.nextTierIndex == null ? null : club.tiers[club.nextTierIndex];
  const openDetail = (label: string, value: string, state: MilestoneState, remainingText?: string, sourceHref?: string, note?: string, actionLabel?: string) => setDetail({ label, value, state, remaining: remainingText, sourceHref, note, actionLabel });
  const openLiftDetail = (liftKey: LiftKey, tierIndex?: number) => {
    setArtifactDetail({ kind: 'lift', liftKey, tierIndex });
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  };
  const openSection = (nextSection: AchievementSection) => {
    setArtifactDetail(null);
    setSection(nextSection);
    router.setParams({ section: nextSection, tab: undefined } as any);
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  };

  useFocusEffect(useCallback(() => {
    void reload();
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [reload]));

  useEffect(() => {
    if (requestedUnit === 'lb' || requestedUnit === 'kg') setUnit(requestedUnit);
    else setUnit(normalizeDisplayWeightUnit(user?.preferred_units));
  }, [requestedUnit, user?.preferred_units]);

  useEffect(() => {
    setSection(requestedAchievementSection(requestedSection, requestedTab));
  }, [requestedSection, requestedTab]);

  useEffect(() => {
    if (__DEV__ && devFixture) {
      setHistoryEvents([...(devFixture.accomplishments ?? [])]);
      return undefined;
    }
    let active = true;
    fetchLedgerAccomplishmentHistory()
      .then((items) => { if (active) setHistoryEvents(items); })
      .catch((caught) => { if (__DEV__) console.warn('[LedgerAchievements] Full accomplishment history unavailable; using the recent canonical page.', caught); });
    return () => { active = false; };
  }, [devFixture]);

  const activeArtifactLift = artifactDetail?.kind === 'lift'
    ? liveLifts.find((lift) => lift.key === artifactDetail.liftKey) ?? null
    : null;
  const artifactTitle = artifactDetail?.kind === 'trophy'
    ? 'Trophy Detail'
    : activeArtifactLift
      ? `${activeArtifactLift.key === 'bench' ? 'Bench Press' : activeArtifactLift.name} Tiers`
      : null;
  const headerTitle = artifactTitle ?? 'Achievements';
  const headerAccent = activeArtifactLift?.tone ?? '#C89B52';
  const headerAtmosphere = activeArtifactLift
    ? STRENGTH_LEDGER_ATMOSPHERE_ASSETS.strength
    : STRENGTH_LEDGER_ATMOSPHERE_ASSETS.achievements;
  const headerContext = activeArtifactLift
    ? 'ACHIEVEMENT STANDARD'
    : artifactDetail?.kind === 'trophy'
      ? 'STRENGTH TIER CABINET'
      : 'YOUR PROGRESS, EARNED';
  const goBack = artifactDetail
    ? () => setArtifactDetail(null)
    : section === 'hub'
      ? onBack ?? (() => router.replace('/(tabs)/ledger/home' as any))
      : () => openSection('hub');

  return <SLScreen disableEntranceMotion={Boolean(__DEV__ && devFixture)} edges="none" padded={false} style={styles.screen}>
    <FloatingControlCoordinator context="tab-screen">
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="ledger-achievements-unit-toggle" />
    <View style={styles.canvas}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} contentOffset={{ x: 0, y: 0 }} showsVerticalScrollIndicator={false}>
        <SLAtmosphericContextHeader
          accent={headerAccent}
          atmosphereSource={headerAtmosphere}
          artwork={activeArtifactLift ? <StrengthSemanticArtwork lift={activeArtifactLift.key} destination="context-header" /> : undefined}
          backAccessibilityLabel={artifactDetail ? 'Back to Achievements' : section === 'hub' ? backAccessibilityLabel : 'Back to Achievements overview'}
          contextLabel={headerContext}
          onBack={goBack}
          subtitle={artifactDetail ? undefined : 'Milestones, strength tiers, and recorded proof.'}
          testID="achievements-contextual-header"
          title={headerTitle}
        >
          {!artifactDetail ? <AchievementFamilyRail section={section} onSelect={openSection} /> : null}
        </SLAtmosphericContextHeader>
        {loading ? <AchievementRequestState kind="loading" message="Loading achievements" />
          : error ? <AchievementRequestState kind={errorKind ?? 'error'} message={error} onRetry={() => void reload()} />
            : !strengthStandard && (artifactDetail != null || section === 'hub' || section === 'milestones' || section === 'clubs' || section === 'trophies') ? <AchievementRequestState kind="unavailable" message="A verified male or female strength standard is required before strength tiers can be shown" />
              : artifactDetail?.kind === 'trophy' && club ? <TrophyDetailView club={club} lifts={liveLifts} tierIndex={artifactDetail.tierIndex} unit={unit} sexLabel={strengthStandard?.sex_label} onOpenStandards={() => router.push('/(tabs)/ledger/strength' as any)} />
                : artifactDetail?.kind === 'lift' && activeArtifactLift ? <LiftTierDetailView lift={activeArtifactLift} unit={unit} requestedTierIndex={artifactDetail.tierIndex} sexLabel={strengthStandard?.sex_label} onOpenEvidence={() => { if (activeArtifactLift.sourceSetLogId) router.push(archiveDetailHref('set', activeArtifactLift.sourceSetLogId) as any); }} />
                  : section === 'hub' && club ? <AchievementsHub club={club} lifts={liveLifts} unit={unit} totalComplete={hasCompleteStrengthTotal} prHistory={prHistory} onOpen={openSection} onOpenLift={openLiftDetail} />
                    : section === 'milestones' && club ? <MilestonesIndex club={club} sessionCount={progression?.consistency?.sessions_completed ?? 0} trainingAge={progression?.consistency?.training_age_years ?? 0} volumeCount={volumeMedallions.length} streakCount={liveStreaks.length} onOpen={openSection} />
                      : section === 'streaks' ? (liveStreaks.length ? <StreakContent items={liveStreaks} /> : <AchievementRequestState kind="empty" message="No streak evidence yet" />)
                        : section === 'trophies' && club ? <StrengthTierCabinet club={club} unit={unit} complete={hasCompleteStrengthTotal} onOpen={(tierIndex) => { setArtifactDetail({ kind: 'trophy', tierIndex }); scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false }); }} />
                          : section === 'medallions' ? <MedallionGallery items={volumeMedallions} onOpen={openDetail} unit={unit} />
                            : section === 'volume' ? (hasVolumeData ? <VolumeAchievementExperience data={volumeDataset} unit={unit} /> : <AchievementRequestState kind="empty" message="No canonical volume evidence yet" />)
                              : section === 'prs' ? <PrHistory events={prHistory} onOpen={(event) => { if (event.source_set_log_id) router.push(archiveDetailHref('set', event.source_set_log_id) as any); }} unit={unit} />
                                : section === 'clubs' && club ? <>
          {hasCompleteStrengthTotal ? <View testID="ledger-total-clubs" style={[styles.hero, { minHeight: 386 }]}>
            <View style={styles.heroTop}><View style={styles.trophyScene}><View style={styles.trophyPedestal}><Image source={SL_STRENGTH_TIER_ASSETS[highestCompletedTier]} style={[styles.heroTrophyImage, currentTotalTier == null && styles.totalTierTrophyLocked]} resizeMode="contain" /></View></View><View style={styles.heroCopy}><ThemedText typographyRole="shortTechnicalLabel" style={styles.eyebrow}>STRENGTH CLUB</ThemedText><ThemedText typographyRole="sectionTitle" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.heroTierTitle}>{currentTotalTier?.name ?? 'Below Tier I'}</ThemedText><ThemedText typographyRole="heroNumeric" adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1} style={styles.heroValue}>{number(total.current)} <ThemedText typographyRole="unit" style={styles.heroUnit}>{unit.toUpperCase()}</ThemedText></ThemedText><ThemedText typographyRole="bodyStrong" style={styles.heroPercentileReadable}>{currentTotalTier ? `~${currentTotalTier.actual_percentile.toFixed(1)}th percentile` : `Tier I begins at ${number(club.thresholds[0])} ${unit.toUpperCase()}`}</ThemedText><ThemedText typographyRole="shortTechnicalLabel" numberOfLines={nextTotalTier ? 1 : 2} style={styles.clubNextReadable}>{nextTotalTier ? `NEXT · ${nextTotalTier.name} · ${number(remaining)} ${unit.toUpperCase()} TO GO` : 'TIER VII COMPLETE'}</ThemedText></View></View>
            <ThemedText typographyRole="supportingBody" style={styles.percentileContext}>{nextTotalTier ? `${nextTotalTier.name} · ${number(total.next)} ${unit.toUpperCase()} · ${number(remaining)} to go. Governed ${strengthStandard?.sex_label?.toLowerCase()} raw SBD cohort.` : `Highest tier reached in the governed ${strengthStandard?.sex_label?.toLowerCase()} raw SBD cohort.`}</ThemedText>
            <View style={styles.progressRow}><View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${totalProgress * 100}%` }]} /></View><ThemedText typographyRole="milestoneThreshold" style={styles.progressPercent}>{Math.round(totalProgress * 100)}%</ThemedText></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: Math.max(0, totalMilestones.indexOf(total.next) - 2) * 103, y: 0 }} contentContainerStyle={[styles.totalPath, { paddingBottom: 0 }]}>{totalMilestones.map((value, tierIndex) => { const state = stateFor(total.current, value, total.next); const tier = club.tiers[tierIndex]; const isCurrent = tierIndex === club.earnedTierIndex; return <Pressable key={value} testID={`total-strength-tier-${tier.tier}`} onPress={() => { setArtifactDetail({ kind: 'trophy', tierIndex }); scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false }); }} style={styles.totalStop}><StrengthTierTrophy tierIndex={tierIndex} state={state} current={isCurrent} /><ThemedText typographyRole="shortTechnicalLabel" style={[styles.totalTierName, state === 'locked' && styles.mutedText, isCurrent && styles.totalTierNameCurrent]}>{tier.name}</ThemedText><ThemedText typographyRole="milestoneThreshold" style={[styles.totalLabel, state === 'locked' && styles.mutedText]}>{number(value)} {unit.toUpperCase()}</ThemedText><ThemedText typographyRole="caption" style={[styles.totalPercentile, state === 'locked' && styles.mutedText]}>~P{tier.actual_percentile.toFixed(1)}</ThemedText></Pressable>; })}</ScrollView>
          </View> : <AchievementRequestState kind="empty" message="A complete canonical total is not available yet" />}
          <SectionHeader title="Core Lift Tier Contributions" icon="barbell-outline" />
          {liveLifts.map((lift) => <LiftRow key={lift.name} lift={lift} unit={unit} onOpen={openLiftDetail} />)}
        </> : null}
      </ScrollView>
    </View>
    <Modal transparent visible={!!detail} animationType="fade" onRequestClose={() => setDetail(null)}><Pressable style={styles.modalScrim} onPress={() => setDetail(null)}><Pressable testID="achievement-detail" style={styles.detailSheet} onPress={(event) => event.stopPropagation()}><View style={[styles.detailIcon, detail?.state === 'completed' ? styles.totalEarned : detail?.state === 'progress' ? styles.totalProgress : styles.totalLocked]}>{detail?.state === 'completed' ? <SLTrophy size={21} /> : <Ionicons name={detail?.state === 'progress' ? 'radio-button-on' : 'lock-closed'} size={21} color={detail?.state === 'progress' ? '#B165FF' : '#AEB7C6'} />}</View><ThemedText typographyRole="heroNumeric" style={styles.detailTitle}>{detail?.value}</ThemedText><ThemedText typographyRole="modalTitle" style={styles.detailLabel}>{detail?.label}</ThemedText><ThemedText typographyRole="modalBody" style={styles.detailState}>{detail?.state === 'completed' ? 'Earned' : detail?.state === 'progress' ? detail.remaining ?? 'In progress' : 'Locked · Keep building'}</ThemedText>{detail?.note ? <ThemedText typographyRole="supportingBody" style={styles.detailNote}>{detail.note}</ThemedText> : null}<Pressable onPress={() => { const href = detail?.sourceHref; setDetail(null); if (href) router.push(href as any); }} style={styles.detailClose}><ThemedText typographyRole="shortButtonLabel" style={styles.detailCloseText}>{detail?.sourceHref ? detail.actionLabel ?? 'Open source evidence' : 'Done'}</ThemedText></Pressable></Pressable></Pressable></Modal>
    </FloatingControlCoordinator>
  </SLScreen>;
}

function LiftRow({ lift, unit, onOpen }: { lift: Lift; unit: Unit; onOpen: (liftKey: LiftKey, tierIndex?: number) => void }) {
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 400;
  const proMax = windowWidth >= 430;
  const canonicalCurrentLb = typeof lift.currentLb === 'number' && Number.isFinite(lift.currentLb) && lift.currentLb > 0
    ? lift.currentLb
    : null;
  const hasCurrent = lift.canonicalWeightKg != null && lift.canonicalWeightKg > 0;
  const tierCurrent = lift.tierState?.current ?? 0;
  const current = displayWeightFromCanonicalLb(canonicalCurrentLb ?? 0, unit);
  const canRenderCanonicalHero = hasCurrent && canRenderGymTotal(current, unit);
  const heroRender = canRenderCanonicalHero
    ? resolvePlateStackRender({ weight: current, unit })
    : null;
  const tierState = lift.tierState;
  const currentTier = tierState && tierState.earnedTierIndex >= 0 ? tierState.tiers[tierState.earnedTierIndex] : null;
  const renderedCellWidth = Math.max(88, Math.min(106, (windowWidth - 52) / 3.45));
  const liftKey = lift.key;
  const identityAsset = lift.name === 'Squat'
    ? require('@/assets/images/lift-icons/achievement-material-v2/squat.png')
    : lift.name === 'Bench'
      ? require('@/assets/images/lift-icons/achievement-material-v2/bench.png')
      : require('@/assets/images/lift-icons/achievement-material-v2/deadlift.png');
  const heroStageWidth = compact ? 150 : HERO_SLEEVE_WINDOW_TUNING.width;
  const heroStageHeight = compact ? 106 : HERO_SLEEVE_WINDOW_TUNING.height;

  useEffect(() => {
    if (!__DEV__ || !canRenderCanonicalHero || heroRender) return;
    console.warn('[PlateStackRenderCatalog] Missing canonical hero asset', {
      lift: liftKey,
      weight: current,
      unit,
    });
  }, [canRenderCanonicalHero, current, heroRender, liftKey, unit]);

  return <View style={styles.liftCase}>
    <View style={[styles.liftSummary, compact && styles.liftSummaryCompact, { height: compact ? 132 : HERO_SLEEVE_WINDOW_TUNING.headerHeight, minHeight: compact ? 132 : HERO_SLEEVE_WINDOW_TUNING.headerHeight }]}>
      <View style={[styles.liftIdentityColumn, compact && styles.liftIdentityColumnCompact]}><View style={[styles.liftIdentityArtwork, compact && styles.liftIdentityArtworkCompact]}><Image source={identityAsset} style={[styles.liftIdentityImage, compact && styles.liftIdentityImageCompact]} resizeMode="contain" /></View></View>
      <View style={[styles.liftMetricBlock, proMax && styles.liftMetricBlockProMax]}><ThemedText typographyRole="shortTechnicalLabel" style={[styles.liftName, { color: lift.tone }]}>{lift.name === 'Bench' ? 'BENCH PRESS' : lift.name.toUpperCase()}</ThemedText><ThemedText typographyRole="shortTechnicalLabel" style={styles.liftCurrentLabel}>{currentTier?.name.toUpperCase() ?? (hasCurrent ? 'BELOW TIER I' : 'CURRENT PR')}</ThemedText><View style={styles.liftHeroMetricRow}><ThemedText typographyRole="heroNumeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={styles.liftHeroMetric}>{hasCurrent ? number(tierCurrent) : '—'}</ThemedText>{hasCurrent ? <ThemedText typographyRole="unit" numberOfLines={1} style={styles.liftHeroUnit}>{unit.toUpperCase()}</ThemedText> : null}</View>{tierState?.next != null && hasCurrent ? <ThemedText typographyRole="caption" style={styles.liftTierMeta}>{number(tierState.remaining ?? 0)} {unit.toUpperCase()} to {tierState.tiers[tierState.nextTierIndex ?? 0].name}</ThemedText> : null}</View>
      <View style={[styles.heroSleeveStage, {
        position: 'absolute',
        right: compact ? 8 : HERO_SLEEVE_WINDOW_TUNING.right,
        top: compact ? 13 : HERO_SLEEVE_WINDOW_TUNING.top,
        width: heroStageWidth,
        height: heroStageHeight,
        overflow: 'hidden',
      }]}>
        {!canRenderCanonicalHero ? (
          <View testID={`${liftKey}-pr-empty-state`} style={styles.liftHeroEmpty}>
            <Ionicons name="barbell-outline" size={29} color="#566173" />
            <ThemedText typographyRole="shortTechnicalLabel" style={styles.liftHeroEmptyText}>{hasCurrent ? 'NO PLATE LOAD' : 'NO PR YET'}</ThemedText>
          </View>
        ) : heroRender?.imageSource ? (
          <>
            <Image
              source={heroRender.imageSource}
              resizeMode="contain"
              style={[styles.heroRenderImage, { width: heroStageWidth, height: heroStageHeight }]}
              testID={`${liftKey}-pr-hero-image`}
            />
            <Image
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              source={heroRender.imageSource}
              resizeMode="contain"
              style={[
                styles.heroRenderImage,
                styles.heroRenderTint,
                { width: heroStageWidth, height: heroStageHeight, tintColor: lift.tone },
              ]}
              testID={`${liftKey}-pr-hero-tint`}
            />
          </>
        ) : (
          <View testID={`${liftKey}-pr-render-unavailable`} style={styles.liftHeroEmpty}>
            <Ionicons name="image-outline" size={29} color="#566173" />
            <ThemedText typographyRole="shortTechnicalLabel" style={styles.liftHeroEmptyText}>RENDER UNAVAILABLE</ThemedText>
          </View>
        )}
      </View>
    </View>
    <View style={styles.liftProgressViewport}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={(tierState?.tiers.length ?? 0) > 4} decelerationRate="fast" snapToInterval={renderedCellWidth + 10} contentContainerStyle={styles.liftProgressRail}>
        {(tierState?.tiers ?? []).map((tier, tierIndex) => {
          const target = tierState?.thresholds[tierIndex] ?? 0;
          const milestoneState: MilestoneState = tierIndex <= (tierState?.earnedTierIndex ?? -1) ? 'completed' : tierIndex === tierState?.nextTierIndex ? 'progress' : 'locked';
          const isLatestClub = tierIndex === tierState?.earnedTierIndex;
          const pending = milestoneState === 'progress' || milestoneState === 'locked';
          const markerColor = pending ? '#59677A' : lift.tone;
          const clubTone = milestoneState === 'locked' ? '#758093' : milestoneState === 'progress' ? '#B7C0CC' : lift.tone;
          return <Pressable key={tier.tier} testID={`${liftKey}-strength-tier-${tier.tier}`} style={[styles.liftMilestoneStop, { width: renderedCellWidth }]} onPress={() => onOpen(liftKey, tierIndex)}>
            {isLatestClub ? <View pointerEvents="none" style={[styles.latestClubFrame, { borderColor: lift.tone }]} /> : null}
            <ThemedText typographyRole="milestoneThreshold" style={[styles.liftMilestoneValue, isLatestClub && { color: lift.tone }]}>{number(target)}</ThemedText>
            <Image source={LIFT_TIER_ART_ASSETS[liftKey][tierIndex]} resizeMode="contain" style={[styles.liftTierTrophy, MILESTONE_RENDER_ORIENTATION_STYLE, milestoneState === 'locked' && styles.totalTierTrophyLocked]} />
            <View style={[styles.liftStateMarker, milestoneState === 'progress' ? { borderWidth: 0 } : { borderColor: markerColor }, isLatestClub && { backgroundColor: '#111722' }]}>{milestoneState === 'progress' ? <Arc progress={tierState?.progress ?? 0} color={lift.tone} trackColor="#59677A" size={25} width={2} /> : null}<Ionicons name={isLatestClub ? 'star' : milestoneState === 'completed' ? 'checkmark' : 'lock-closed'} size={isLatestClub ? 15 : 14} color={pending ? '#8D98A7' : lift.tone} /></View>
            <ThemedText typographyRole="caption" numberOfLines={2} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.clubLabel, milestoneState === 'locked' && styles.mutedText, { color: clubTone }, isLatestClub && { fontWeight: '800' }]}>{tier.name}{'\n'}P{tier.actual_percentile.toFixed(1)}</ThemedText>
          </Pressable>;
        })}
      </ScrollView>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  hub: { gap: 11, paddingTop: 5 },
  hubHero: { minHeight: 190, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#40334C', backgroundColor: '#0E0B12' },
  hubHeroArtifact: { width: '43%', height: 184, alignItems: 'center', justifyContent: 'center', backgroundColor: '#141019' },
  hubHeroTrophy: { width: 154, height: 164 },
  hubHeroCopy: { flex: 1, minWidth: 0, paddingVertical: 18, paddingRight: 16, gap: 7 },
  hubKicker: { color: '#B987F8', fontSize: 9, lineHeight: 11, letterSpacing: 0.8 },
  hubTitle: { color: '#F4F0F8', fontSize: 23, lineHeight: 27 },
  hubCopy: { color: '#9FA5B0', fontSize: 10.5, lineHeight: 15 },
  hubTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  hubTotalValue: { color: '#F6F3F8', fontSize: 34, lineHeight: 39 },
  hubTotalUnit: { color: '#C7A7E9', fontSize: 12, lineHeight: 15 },
  hubPercentile: { color: '#D7B8FF', fontSize: 13, lineHeight: 17 },
  hubProgressTrack: { width: '100%', height: 8, overflow: 'hidden', borderRadius: 5, backgroundColor: '#282431' },
  hubProgressFill: { height: '100%', borderRadius: 5, backgroundColor: '#A14FFF' },
  overviewSectionHeader: { minHeight: 34, marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overviewSectionTitle: { color: '#C7CCD5', fontSize: 10, lineHeight: 13, letterSpacing: 0.9 },
  overviewSectionAction: { color: '#B987F8', fontSize: 9, lineHeight: 12, letterSpacing: 0.6 },
  overviewLiftGrid: { flexDirection: 'row', gap: 8 },
  overviewLiftCard: { flex: 1, minWidth: 0, height: 190, overflow: 'hidden', borderRadius: 15, borderWidth: 1, backgroundColor: '#080A0E' },
  overviewLiftArtStage: { height: 96, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#272C34' },
  overviewLiftCopy: { flex: 1, padding: 10 },
  overviewLiftName: { fontSize: 8, lineHeight: 10, letterSpacing: 0.7 },
  overviewLiftTier: { color: '#F0EDF4', fontSize: 12, lineHeight: 15, marginTop: 2 },
  overviewLiftValue: { color: '#D9DDE5', fontSize: 11, lineHeight: 14, marginTop: 2 },
  overviewLiftPercentile: { color: '#929BA9', fontSize: 9, lineHeight: 12, marginTop: 1 },
  recentAchievementList: { overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#252C37', backgroundColor: '#090C11' },
  recentAchievementRow: { minHeight: 69, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#262C35' },
  recentPrBadge: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#8C691F', backgroundColor: '#201807' },
  recentPrBadgeText: { color: '#F1C65C', fontSize: 9, lineHeight: 11 },
  recentAchievementCopy: { flex: 1, minWidth: 0, gap: 2 },
  recentAchievementTitle: { color: '#ECEEF2', fontSize: 12, lineHeight: 15 },
  recentAchievementDate: { color: '#858F9D', fontSize: 9, lineHeight: 12 },
  recentAchievementValue: { maxWidth: 86, color: '#E0E2E8', fontSize: 11, lineHeight: 14, textAlign: 'right' },
  recentEmpty: { minHeight: 68, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  overviewDoorways: { gap: 8, marginTop: 4 },
  overviewDoorway: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: '#242B36', backgroundColor: '#0A0D12' },
  overviewDoorwayText: { flex: 1, color: '#D9DCE2', fontSize: 12, lineHeight: 15 },
  overviewDoorwayTrophy: { width: 24, height: 32 },
  milestoneDoorway: { minHeight: 154, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', paddingLeft: 17, borderRadius: 16, borderWidth: 1, borderColor: '#2C3441', backgroundColor: '#0B1016' },
  milestoneDoorwayCopy: { flex: 1, minWidth: 0, gap: 5, paddingVertical: 16 },
  doorwayFeatureTitle: { color: '#EEEFF3', fontSize: 15, lineHeight: 19 },
  hubPlateStack: { width: 155, height: 124, marginRight: -10 },
  hubPair: { flexDirection: 'row', gap: 10 },
  clubDoorway: { flex: 1.1, minHeight: 165, overflow: 'hidden', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#5D4521', backgroundColor: '#120F0A' },
  clubDoorwayValue: { color: '#F1D28B', fontSize: 35, lineHeight: 40, marginTop: 10 },
  clubDoorwayUnit: { color: '#AA946A', fontSize: 8, lineHeight: 10, letterSpacing: 0.8 },
  clubDoorwayPath: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 19 },
  clubDoorwayStop: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#302B25' },
  clubDoorwayStopEarned: { backgroundColor: '#C8953E' },
  clubDoorwayStopNext: { height: 8, borderWidth: 1, borderColor: '#D9AC5B', backgroundColor: '#4B391D' },
  trophyDoorway: { flex: 0.9, minHeight: 165, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#303039', backgroundColor: '#0F0F13' },
  trophyDoorwayArtifacts: { height: 86, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginVertical: 4 },
  trophyDoorwayImage: { width: 49, height: 77, marginHorizontal: -6 },
  medallionDoorway: { minHeight: 123, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#433052', backgroundColor: '#100C15' },
  medallionDoorwayArtifact: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  medallionDoorwayImage: { width: 102, height: 102 },
  medallionDoorwayCopy: { flex: 1, minWidth: 0, gap: 4 },
  volumeDoorway: { flex: 1, minHeight: 178, padding: 15, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#39284B', backgroundColor: '#0E0A14' },
  volumeDoorwayBars: { height: 72, flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 7 },
  volumeDoorwayBar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: '#7438A8' },
  prDoorway: { flex: 1, minHeight: 178, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#4A3920', backgroundColor: '#120F0A' },
  prDoorwayValue: { color: '#F0B33E', fontSize: 41, lineHeight: 46, marginTop: 11 },
  cabinet: { paddingTop: 8 },
  cabinetHeader: { gap: 5, paddingVertical: 13 },
  cabinetTitle: { color: '#F1EEF5', fontSize: 17, lineHeight: 21, letterSpacing: 0.5 },
  cabinetCopy: { color: '#989FAC', fontSize: 10.5, lineHeight: 15 },
  cabinetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cabinetItem: { width: '48.5%', minHeight: 222, alignItems: 'center', justifyContent: 'flex-end', padding: 13, borderRadius: 15, borderWidth: 1, borderColor: '#2B303A', backgroundColor: '#0D0F13' },
  cabinetItemProgress: { borderColor: '#7345A3', backgroundColor: '#120D19' },
  cabinetTrophyImage: { width: 132, height: 138 },
  cabinetItemTitle: { color: '#EAEBEF', fontSize: 14, lineHeight: 18 },
  cabinetThreshold: { color: '#AEB4BE', fontSize: 12, lineHeight: 15, marginTop: 2 },
  cabinetPercentile: { color: '#8E98A8', fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  cabinetState: { color: '#717A88', fontSize: 8, lineHeight: 10, letterSpacing: 0.7, marginTop: 6 },
  cabinetStateEarned: { color: '#E5B854' },
  medallionGallery: { paddingTop: 8 },
  medallionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  medallionItem: { width: '48.5%', minHeight: 232, alignItems: 'center', padding: 11, borderRadius: 15, borderWidth: 1, backgroundColor: '#0C0D11' },
  medallionImage: { width: 142, height: 148 },
  medallionFamily: { fontSize: 8, lineHeight: 10, letterSpacing: 0.8 },
  medallionThreshold: { color: '#ECECF0', fontSize: 13, lineHeight: 16, marginTop: 3 },
  medallionDate: { color: '#858D99', textAlign: 'center', marginTop: 5 },
  prHistory: { paddingTop: 8 },
  prFilterRail: { gap: 8, paddingBottom: 10 },
  prFilterChip: { minWidth: 72, minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: '#2A313D', backgroundColor: '#0C1017' },
  prFilterChipActive: { borderColor: '#8248C6', backgroundColor: '#291440' },
  prFilterText: { color: '#8993A1', fontSize: 9.5, lineHeight: 12, letterSpacing: 0.35 },
  prFilterTextActive: { color: '#E7D8FF' },
  filteredEmpty: { minHeight: 96, alignItems: 'center', justifyContent: 'center' },
  prHistoryRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#292E37' },
  prHistoryIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: '#4A2B69', backgroundColor: '#130B1C' },
  prHistoryCopy: { flex: 1, minWidth: 0, gap: 2 },
  prHistoryTitle: { color: '#EDEEF1', fontSize: 12.5, lineHeight: 16 },
  prHistoryMeta: { color: '#868F9D' },
  prHistoryValue: { maxWidth: 91, color: '#E2C6FF', fontSize: 13, lineHeight: 16, textAlign: 'right' },
  milestonesIndex: { gap: 9, paddingTop: 5 },
  milestoneFamilyRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#252D38', backgroundColor: '#0A0E14' },
  milestoneFamilyIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  milestoneFamilyCopy: { flex: 1, minWidth: 0, gap: 3 },
  milestoneFamilyTitle: { color: '#ECEEF2', fontSize: 13, lineHeight: 16 },
  milestoneFamilySubtitle: { color: '#8E98A6', fontSize: 9.5, lineHeight: 12 },
  milestoneFamilyCount: { color: '#CDD2DA', fontSize: 11, lineHeight: 14 },
  artifactDetail: { gap: 15, paddingTop: 7 },
  trophyDetailHero: { minHeight: 465, overflow: 'hidden', justifyContent: 'flex-end', borderRadius: 20, borderWidth: 1, borderColor: '#44314E', backgroundColor: '#08070A' },
  trophyDetailAura: { position: 'absolute', left: '15%', right: '15%', top: 42, height: 220, borderRadius: 120, shadowOpacity: 0.9, shadowRadius: 45 },
  trophyDetailImage: { position: 'absolute', left: '6%', right: '6%', top: 15, width: '88%', height: 315 },
  trophyDetailIdentity: { paddingHorizontal: 22, paddingBottom: 23, gap: 4 },
  trophyDetailState: { fontSize: 9, lineHeight: 12, letterSpacing: 1.2 },
  trophyDetailTier: { color: '#F2EEF5', fontSize: 22, lineHeight: 26 },
  trophyDetailMetricRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  trophyDetailMetric: { color: '#F6F4F8', fontSize: 38, lineHeight: 44 },
  trophyDetailUnit: { color: '#C4A7DE', fontSize: 13, lineHeight: 17 },
  trophyDetailPercentile: { color: '#D2B5F0', fontSize: 14, lineHeight: 18 },
  artifactNarrative: { color: '#B3BBC7', fontSize: 12.5, lineHeight: 19, paddingHorizontal: 3 },
  artifactSection: { overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#28303B', backgroundColor: '#090D12' },
  artifactSectionTitle: { color: '#BFA0E2', fontSize: 9.5, lineHeight: 12, letterSpacing: 0.85, marginTop: 3 },
  evidenceRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#27303B' },
  evidenceArt: { width: 58, height: 48, borderRadius: 8, backgroundColor: '#0D1118' },
  evidenceCopy: { flex: 1, minWidth: 0, gap: 3 },
  evidenceTitle: { color: '#ECEEF2', fontSize: 12, lineHeight: 15 },
  evidenceMeta: { color: '#909AA8', fontSize: 9, lineHeight: 12 },
  evidenceValue: { color: '#D7DCE4', fontSize: 11, lineHeight: 14 },
  standardContext: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#392A48', backgroundColor: '#100B16' },
  standardContextCopy: { flex: 1, minWidth: 0, gap: 4 },
  standardContextTitle: { color: '#E8E2EE', fontSize: 12, lineHeight: 15 },
  standardContextBody: { color: '#A49AAC', fontSize: 9.5, lineHeight: 14 },
  artifactPrimaryAction: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 13, backgroundColor: '#7032AF' },
  liftDetailHero: { minHeight: 356, overflow: 'hidden', borderRadius: 20, borderWidth: 1, backgroundColor: '#06080C' },
  liftDetailHeroArtStage: { height: 174, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292E36' },
  liftDetailHeroCopy: { minHeight: 180, justifyContent: 'center', gap: 3, paddingHorizontal: 21, paddingVertical: 18 },
  liftDetailKicker: { fontSize: 9.5, lineHeight: 12, letterSpacing: 1 },
  liftDetailTier: { color: '#F1EEF4', fontSize: 15, lineHeight: 19 },
  liftDetailMetricRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  liftDetailMetric: { color: '#F7F5F8', fontSize: 40, lineHeight: 45 },
  liftDetailUnit: { color: '#CCD0D8', fontSize: 13, lineHeight: 17 },
  liftDetailPercentile: { color: '#D4BFEA', fontSize: 14, lineHeight: 18 },
  liftDetailNext: { color: '#AEB6C2', fontSize: 10.5, lineHeight: 15 },
  liftDetailTierRail: { gap: 9, paddingRight: 10 },
  liftDetailTierCard: { width: 132, minHeight: 177, alignItems: 'center', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#29313D', backgroundColor: '#0A0E14' },
  liftDetailTierArt: { width: 110, height: 71 },
  liftDetailTierName: { color: '#D6DAE1', fontSize: 9, lineHeight: 12, marginTop: 5 },
  liftDetailTierThreshold: { color: '#F0F1F4', fontSize: 11, lineHeight: 14, marginTop: 3 },
  liftDetailTierPercentile: { color: '#929CA9', fontSize: 9.5, lineHeight: 12, marginTop: 2 },
  liftDetailTierStatus: { color: '#6F7B8B', fontSize: 7.5, lineHeight: 10, letterSpacing: 0.55, marginTop: 5 },
  selectedStandard: { gap: 5, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#34303B', backgroundColor: '#0C0C11' },
  selectedStandardKicker: { fontSize: 9, lineHeight: 12, letterSpacing: 0.8 },
  selectedStandardRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  selectedStandardValue: { color: '#F3F2F5', fontSize: 30, lineHeight: 35 },
  selectedStandardUnit: { color: '#B6BDC7', fontSize: 11, lineHeight: 14 },
  selectedStandardPercentile: { marginLeft: 'auto', color: '#D1B7EB', fontSize: 12, lineHeight: 15 },
  selectedStandardCopy: { color: '#929BA8', fontSize: 9.5, lineHeight: 14 },
  standardsTable: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#28303B', backgroundColor: '#090D12' },
  standardsTableHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#111720' },
  standardsTableHeaderText: { flex: 1, color: '#818C9B', fontSize: 8, lineHeight: 10, letterSpacing: 0.7 },
  standardsTableRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#252D37' },
  standardsTableRowActive: { backgroundColor: '#1A1024' },
  standardsTableCell: { flex: 1, color: '#D5DAE2', fontSize: 10, lineHeight: 13 },
  requestState: { marginTop: 18, minHeight: 180, paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#242D3B', backgroundColor: 'transparent' },
  requestStateTitle: { color: '#F1F3F7', textAlign: 'center' },
  requestStateCopy: { maxWidth: 330, color: '#9DA7B6', textAlign: 'center' },
  requestStateAction: { marginTop: 6, minHeight: 42, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#7340AE', backgroundColor: '#1C1130' },
  screen: { backgroundColor: 'transparent' }, canvas: { flex: 1, backgroundColor: 'transparent' }, content: { paddingTop: SLLayout.screenTop, paddingBottom: SLLayout.tabBarClearance + SLLayout.floatingUtilityClearance, gap: 8 },
  introRow: { flexDirection: 'row', alignItems: 'center', marginTop: 11, marginBottom: 6 }, intro: { ...SLTypography.rowMeta, color: '#B7BFCD', flex: 1 }, unitControl: { backgroundColor: '#171123', borderColor: '#8D4BE4' }, unitControlText: { ...SLTypography.label, color: '#F5EFFF', letterSpacing: 0.5 },
  hero: { minHeight: 380, overflow: 'hidden', paddingTop: 19, paddingBottom: 13, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, borderColor: '#293245', shadowColor: '#000000', shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }, heroTop: { flexDirection: 'row', alignItems: 'center', minHeight: 132 }, trophyScene: { width: 108, alignItems: 'center', justifyContent: 'center' }, trophyGlow: { position: 'absolute', width: 102, height: 70, borderRadius: 51, backgroundColor: 'rgba(255,176,33,0.18)', shadowColor: '#CE8B19', shadowOpacity: 0.75, shadowRadius: 18 }, trophyAura: { position: 'absolute', left: -20, top: -15 }, trophyPedestal: { width: 110, height: 130, alignItems: 'center', justifyContent: 'center' }, heroTrophyImage: { width: 126, height: 136 }, heroCopy: { flex: 1, minWidth: 0, marginLeft: 8, alignSelf: 'center' }, eyebrow: { ...SLTypography.utilityLabel, color: '#B9C0CE', letterSpacing: 0.7 }, heroTierTitle: { color: '#F2D188', fontSize: 18, lineHeight: 22, marginTop: 3 }, heroValue: { fontFamily: SLTypography.hero.fontFamily, fontSize: 34, lineHeight: 40, color: '#F7F8FB', letterSpacing: -1.1, marginTop: 1 }, heroUnit: { ...SLTypography.cardTitle, color: '#BB70FF', letterSpacing: 0 }, heroMeta: { ...SLTypography.rowMeta, color: '#9AA4B3', marginTop: 1 }, heroPercentileReadable: { color: '#DEC1FF', fontSize: 13, lineHeight: 17, marginTop: 3 }, clubNextReadable: { color: '#BFA4D8', fontSize: 8.5, lineHeight: 12, letterSpacing: 0.45, marginTop: 6 }, nextBlock: { width: 116, alignSelf: 'center', paddingLeft: 10, borderLeftWidth: 1, borderColor: '#2B3445' }, nextLabel: { ...SLTypography.micro, color: '#B596D8', letterSpacing: 0.35 }, nextValue: { ...SLTypography.sectionTitle, color: '#F3F4F7', marginTop: 3, fontSize: 11, lineHeight: 15 }, nextUnit: { ...SLTypography.label, color: '#B86DFF' }, nextSub: { ...SLTypography.micro, color: '#A5AFBE', marginTop: 3 }, percentileContext: { color: '#A9B0BC', fontSize: 10.5, lineHeight: 15, marginTop: 2 }, progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }, progressTrack: { flex: 1, height: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: '#202735', borderWidth: 1, borderColor: '#2C3545' }, progressBar: { height: '100%', borderRadius: 7, backgroundColor: '#A14FFF', shadowColor: '#A14FFF', shadowOpacity: 0.8, shadowRadius: 7 }, progressPercent: { ...SLTypography.label, color: '#ECEDF2' }, totalPath: { paddingTop: 16, paddingBottom: 5, gap: 12, paddingRight: 18 }, totalStop: { minWidth: 92, alignItems: 'center' }, totalTrophy: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 }, totalTrophyCurrent: { borderWidth: 2.5, shadowColor: '#B86DFF', shadowOpacity: 0.85, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, totalTrophyInset: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, totalTierTrophyImage: { width: 70, height: 76, marginTop: -6 }, totalTierTrophyFinal: { width: 80, height: 88, marginTop: -12 }, totalTierTrophyLocked: { opacity: 0.42 }, totalEarned: { backgroundColor: '#141922', borderColor: '#E2B64C', shadowColor: '#E5A51B', shadowOpacity: 0.63, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, totalProgress: { backgroundColor: '#201B34', borderColor: '#A961FF' }, totalLocked: { backgroundColor: '#141922', borderColor: '#354050' }, totalTierName: { color: '#BFC5CF', fontSize: 8, lineHeight: 10, marginTop: 8, textAlign: 'center' }, totalTierNameCurrent: { color: '#E9C8FF' }, totalLabel: { ...SLTypography.label, color: '#E4E7EC', marginTop: 2 }, totalPercentile: { color: '#939DAC', fontSize: 8.5, lineHeight: 11, marginTop: 1 }, totalUnit: { ...SLTypography.micro, color: '#929CAC', marginTop: 1 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 17, marginBottom: 7 }, sectionTitle: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 14, lineHeight: 18, color: '#C8CED9', letterSpacing: 0.55, textTransform: 'uppercase' },
  liftCase: { overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#222D3F', shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 9, shadowOffset: { width: 0, height: 5 } },
  liftSummary: { minHeight: 124, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 14, paddingVertical: 10 },
  liftSummaryCompact: { paddingLeft: 6, paddingRight: 8 },
  liftIdentityColumn: { width: 80, height: 98, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  liftIdentityColumnCompact: { width: 72 },
  liftIdentityArtwork: { width: 78, height: 76, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  liftIdentityArtworkCompact: { width: 70, height: 68 },
  liftIdentityImage: { width: 82, height: 74 },
  liftIdentityImageCompact: { width: 72, height: 66 },
  liftMetricBlock: { width: 132, minWidth: 132, justifyContent: 'center' },
  liftMetricBlockProMax: { width: 156, minWidth: 156 },
  liftName: { ...SLTypography.label, letterSpacing: 0.7 },
  liftCurrentLabel: { ...SLTypography.micro, color: '#98A2B1', letterSpacing: 0.85, marginTop: 3 },
  liftTierMeta: { ...SLTypography.micro, color: '#AAB3C0', marginTop: 1 },
  liftHeroMetricRow: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 1 },
  liftHeroMetric: { flex: 1, flexShrink: 1, minWidth: 0, color: '#F5F6F8', paddingRight: 2 },
  liftHeroUnit: { ...SLTypography.cardTitle, flexShrink: 0, color: '#BBC3CF', letterSpacing: 0 },
  heroSleeveStage: { flex: 1, minWidth: 0, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 3 },
  liftHeroEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.72 },
  liftHeroEmptyText: { ...SLTypography.micro, color: '#778293', letterSpacing: 0.65 },
  heroRenderImage: { position: 'absolute', left: 0, top: 0 },
  heroRenderTint: { opacity: 0.18 },
  liftProgressViewport: { height: 154, overflow: 'hidden', borderTopWidth: 1, borderTopColor: '#182130' },
  liftProgressRail: { alignItems: 'flex-start', gap: 10, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  liftMilestoneStop: { alignItems: 'center', position: 'relative' },
  latestClubFrame: { position: 'absolute', left: 1, right: 1, top: 0, bottom: 0, borderWidth: 1.5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.018)', shadowOpacity: 0.92, shadowRadius: 12, shadowOffset: { width: 0, height: 1 }, elevation: 7 },
  liftMilestoneValue: { ...SLTypography.cardTitle, color: '#D7DDE6', marginBottom: 1 },
  liftTierTrophy: { width: 53, height: 55, marginVertical: -2 },
  liftStateMarker: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginTop: 2 },
  clubLabel: { width: '100%', minHeight: 26, textAlign: 'center', letterSpacing: 0, lineHeight: 12, marginTop: 4 },
  otherCase: { minHeight: 154, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 11, overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: '#202938', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 7, shadowOffset: { width: 0, height: 4 } },
  otherTopRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  otherIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  otherIcon: { width: 46, height: 46, borderRadius: 23, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: '#0B111A' },
  otherIdentityCopy: { flex: 1, minWidth: 0 },
  otherName: { ...SLTypography.label, color: '#B8C0CC', letterSpacing: 0.55, textTransform: 'uppercase' },
  otherCurrentRow: { minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 1 },
  otherCurrentValue: { flexShrink: 1, color: '#F1F4F8', fontSize: 29, lineHeight: 34, letterSpacing: -0.65 },
  otherCurrentUnit: { flexShrink: 0, ...SLTypography.micro, color: '#AEB7C5', letterSpacing: 0.65 },
  otherNextBlock: { width: 116, minWidth: 104, alignItems: 'flex-end', justifyContent: 'center' },
  otherNextLabel: { ...SLTypography.micro, color: '#AEB6C3', letterSpacing: 0.5 },
  otherRemainingRow: { maxWidth: '100%', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  otherRemainingValue: { flexShrink: 1, fontSize: 14, lineHeight: 18 },
  otherRemainingWords: { ...SLTypography.micro, flexShrink: 0, letterSpacing: 0.42 },
  otherRail: { height: 61, marginTop: 9, flexDirection: 'row', alignItems: 'flex-start', position: 'relative' },
  otherConnector: { position: 'absolute', left: '10%', right: '10%', top: 18, height: 1, backgroundColor: '#222C39' },
  otherRailCell: { flex: 1, minWidth: 0, alignItems: 'center', zIndex: 1 },
  otherMarker: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.25, backgroundColor: '#0B1119' },
  otherMarkerCurrent: { borderWidth: 0, backgroundColor: '#0B1119' },
  otherMarkerLocked: { borderColor: '#344050', backgroundColor: '#0A0F16' },
  otherMarkerTarget: { maxWidth: 27, fontSize: 9, lineHeight: 12 },
  otherThreshold: { width: '100%', marginTop: 4, textAlign: 'center', fontSize: 10, lineHeight: 13 },
  otherThresholdLocked: { color: '#778293' },
  arc: { position: 'absolute', left: 0, top: 0 },
  mutedText: { color: '#657084' },
  streakContent: { gap: 18, paddingTop: 14 },
  streakHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 7 },
  streakHeadingTitle: { ...SLTypography.sectionTitle, fontSize: 14, lineHeight: 17, color: '#F2F3F6', letterSpacing: 0.25 },
  streakHeadingCopy: { ...SLTypography.rowMeta, fontSize: 10.5, lineHeight: 13, color: '#99A3B2', marginTop: 2 },
  streakCard: { borderRadius: 12, borderWidth: 1, borderColor: '#20293A', paddingTop: 16, paddingBottom: 12, overflow: 'hidden', backgroundColor: 'transparent' },
  streakTop: { zIndex: 2, minHeight: 78, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12 },
  streakIcon: { width: 44, height: 44, borderRadius: 22, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1.25, backgroundColor: '#0D131C' },
  streakCopy: { flex: 1, minWidth: 0 },
  streakTitleRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 7, rowGap: 3 },
  streakTitle: { ...SLTypography.bodyStrong, fontSize: 13, lineHeight: 16, color: '#F1F2F6', flexShrink: 1 },
  streakDescription: { ...SLTypography.caption, fontSize: 9.5, lineHeight: 12, color: '#99A3B3', marginTop: 2 },
  careerBestBadge: { flexShrink: 0, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: '#0B1018' },
  careerBestLabel: { ...SLTypography.micro, fontSize: 7, lineHeight: 9, letterSpacing: 0.25 },
  streakValueRow: { minWidth: 0, flexDirection: 'row', alignItems: 'baseline', marginTop: 1 },
  streakValue: { flexShrink: 1, fontFamily: SLFontFamilies.numeric, fontSize: 27, lineHeight: 29, color: '#F3F5F8' },
  streakUnit: { ...SLTypography.rowMeta, marginLeft: 5, fontSize: 9, lineHeight: 11, color: '#A8B1BE', letterSpacing: 0 },
  streakUnitPercent: { marginLeft: 2 },
  streakBest: { width: 46, minHeight: 43, marginLeft: 4, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 6, backgroundColor: '#0B1018' },
  streakBestLabel: { ...SLTypography.micro, fontSize: 7, lineHeight: 9, color: '#AEB6C4', letterSpacing: 0.35 },
  streakBestValue: { width: 41, textAlign: 'center', fontFamily: SLFontFamilies.numeric, fontSize: 18, lineHeight: 21, color: '#EEF1F6' },
  streakPlatformDeck: { zIndex: 1, marginTop: 7, marginHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end' },
  streakPlatform: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 5, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden' },
  streakPlatformOverlap: { marginLeft: -1 },
  streakPlatformValue: { width: '92%', textAlign: 'center', fontFamily: SLFontFamilies.numeric, fontSize: 9.5, lineHeight: 12, color: '#E4E8EF' },
  streakPlatformState: { zIndex: 2, height: 17, justifyContent: 'center', alignItems: 'center' },
  streakPlatformGround: { position: 'absolute', left: 4, right: 4, bottom: -4, height: 13, borderTopLeftRadius: 12, borderTopRightRadius: 8, opacity: 0.8 },
  placeholder: { alignItems: 'center', gap: 10, paddingVertical: 90 }, placeholderTitle: { ...SLTypography.sectionTitle, color: '#F0F2F6' }, placeholderCopy: { ...SLTypography.body, color: '#9BA5B4' }, modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }, detailSheet: { alignItems: 'center', gap: 7, padding: 25, paddingBottom: 38, backgroundColor: '#121823', borderTopLeftRadius: SLRadius.radiusSheet, borderTopRightRadius: SLRadius.radiusSheet, borderWidth: 1, borderColor: '#30394B' }, detailIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }, detailTitle: { ...SLTypography.title, color: '#F5F6F9' }, detailLabel: { ...SLTypography.bodyStrong, color: '#AEB7C5' }, detailState: { ...SLTypography.rowMeta, color: '#C7A7FF', textAlign: 'center', marginTop: 3 }, detailNote: { maxWidth: 340, color: '#9BA4B1', textAlign: 'center', marginTop: 4 }, detailClose: { marginTop: 16, minWidth: 120, minHeight: 43, justifyContent: 'center', alignItems: 'center', borderRadius: SLRadius.pill, backgroundColor: '#8E49E3' }, detailCloseText: { ...SLTypography.buttonLabel, color: '#FFFFFF' },
});
