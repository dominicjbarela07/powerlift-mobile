import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { SLCanonicalIcon, SLScreen, SLTrophy } from '@/components/ui';
import { VolumeAchievementExperience, type VolumeAchievementDataset } from '@/components/volume-achievements/VolumeAchievementExperience';
import { SLFontFamilies, SLLayout, SLMetricTones, SLRadius, SLTypography } from '@/constants/theme';
import { useLedgerLiveData } from './use-ledger-live-data';
import { archiveDetailHref } from '@/lib/ledger-archive';
import { canonicalLiftKey, fetchLedgerAccomplishmentHistory, type AccomplishmentEvent } from '@/lib/ledger-data';
import {
  canonicalMajorVolumeMedallions,
  canonicalPrHistory,
  canonicalTotal,
  totalClubState,
  TOTAL_TROPHY_TIER_NAMES,
  type MajorVolumeMedallionEvidence,
  type TotalClubState,
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
import {
  MILESTONE_RENDER_ORIENTATION_STYLE,
  resolveMilestoneRenderAsset,
  type PlateClubLiftKey,
} from '@/lib/barbell/milestone-render-assets';
import { SL_TOTAL_TROPHY_ASSETS } from '@/lib/trophy-assets';
import {
  MILESTONE_CELL_GAP,
  MILESTONE_RAIL_INSET,
  canRenderGymTotal,
  displayWeightFromCanonicalLb,
  milestoneCellWidth,
  kgTotalToPlateModelTotalLb,
  plateClubLabel,
  milestoneScrollOffset,
  milestoneWindowStart,
  otherMilestoneWindow,
  progressBetweenMilestones,
  readablePlateClubLabel,
  remainingToMilestone,
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
type UnitLadders = Record<Unit, number[]>;
type LiftPresentation = { name: string; icon: keyof typeof Ionicons.glyphMap; milestones: UnitLadders; tone: string; glow: string; softTone: string };
type Lift = LiftPresentation & { canonicalWeightKg: number | null; currentLb: number | null; sourceSetLogId?: number | null };
type StreakItem = { id: string; title: string; description: string; value: number; unit: string; thresholds: readonly number[]; icon: keyof typeof Ionicons.glyphMap; tone: string };
type OtherMilestoneRow = typeof OTHER[number] & { current: number };

const LIFT_PRESENTATIONS: LiftPresentation[] = [
  { name: 'Squat', icon: 'body-outline', milestones: { lb: [95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585, 635, 675, 725], kg: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340] }, tone: SLMetricTones.squat.solid, glow: '#733ED6', softTone: '#21103F' },
  { name: 'Bench', icon: 'barbell-outline', milestones: { lb: [95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585], kg: [40, 60, 80, 100, 120, 140, 160, 180, 200] }, tone: SLMetricTones.bench.solid, glow: '#9D2C63', softTone: '#351323' },
  { name: 'Deadlift', icon: 'fitness-outline', milestones: { lb: [95, 135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585, 635, 675, 725, 765, 815, 855, 895], kg: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380] }, tone: SLMetricTones.deadlift.solid, glow: '#B93451', softTone: '#431621' },
];

const VOLUME_PRESENTATION: VolumeAchievementDataset = {
  total: { id: 'total', label: 'Complete Training Volume', current: { lb: null, kg: null }, tone: SLMetricTones.total.solid, glow: '#8A2C9E' },
  lifts: [
    { id: 'squat', label: 'Squat', current: { lb: null, kg: null }, tone: SLMetricTones.squat.solid, glow: '#6934A9', iconSource: require('@/assets/images/lift-icons/achievement-material-v2/squat.png') },
    { id: 'bench', label: 'Bench', current: { lb: null, kg: null }, tone: SLMetricTones.bench.solid, glow: '#9D2C63', iconSource: require('@/assets/images/lift-icons/achievement-material-v2/bench.png') },
    { id: 'deadlift', label: 'Deadlift', current: { lb: null, kg: null }, tone: SLMetricTones.deadlift.solid, glow: '#A52E48', iconSource: require('@/assets/images/lift-icons/achievement-material-v2/deadlift.png') },
  ],
};

const OTHER = [
  { id: 'sessions', name: 'Sessions Completed', unit: null, thresholds: [10, 25, 50, 100, 250, 500, 1000], icon: 'calendar-outline' as const, tone: '#4A9CFF' },
  { id: 'training-age', name: 'Training Age', unit: 'YEARS', thresholds: [1, 2, 3, 5, 10, 15], icon: 'time-outline' as const, tone: '#F1A52B' },
];

const STREAK_PRESENTATIONS = [
  { id: 'sessions', title: 'Longest Session Streak', description: 'Consecutive prescribed sessions completed.', unit: 'sessions', thresholds: [5, 10, 15, 25, 50, 75], icon: 'calendar-clear-outline' as const, tone: '#A85CFF' },
  { id: 'weekly', title: 'Longest Weekly Streak', description: 'Consecutive weeks completed as programmed.', unit: 'weeks', thresholds: [4, 8, 12, 16, 20, 26], icon: 'bar-chart-outline' as const, tone: '#50DD7C' },
  { id: 'compliance', title: 'Highest Weekly Compliance', description: 'Best compliance achieved in a single week.', unit: '%', thresholds: [50, 60, 70, 80, 90, 100], icon: 'shield-checkmark-outline' as const, tone: '#3A9CFF' },
  { id: 'perfect-weeks', title: 'Perfect Weeks', description: 'Weeks with 100% compliance.', unit: 'weeks', thresholds: [1, 5, 10, 25, 50, 100], icon: 'trophy-outline' as const, tone: '#F3BE43' },
] as const;

const LB_TOTAL_TROPHY_TIERS = [
  { name: 'Steel', color: '#C7CED7', glow: '#626C79', size: 19 },
  { name: 'Bronze', color: '#D68B50', glow: '#7E3F23', size: 21 },
  { name: 'Silver', color: '#D5DAE5', glow: '#6E7586', size: 22 },
  { name: 'Gold', color: '#FFD467', glow: '#9D6513', size: 24 },
  { name: 'Platinum', color: '#A5DDF5', glow: '#4F7895', size: 25 },
  { name: 'Diamond', color: '#8BEAFF', glow: '#2789B6', size: 27 },
  { name: 'Obsidian', color: '#C788FF', glow: '#6520A7', size: 29 },
] as const;

const number = (value: number) => value.toLocaleString('en-US');
const nextMilestone = (current: number, values: number[]) => values.find((value) => value > current);
const stateFor = (current: number, target: number, next?: number): MilestoneState => target <= current ? 'completed' : target === next ? 'progress' : 'locked';
const progressFor = (current: number, values: number[], target: number) => {
  const prior = values[Math.max(0, values.indexOf(target) - 1)] ?? 0;
  return Math.max(0, Math.min(1, (current - prior) / (target - prior)));
};
const poundsForMilestoneModel = (weight: number, unit: Unit) => unit === 'lb' ? weight : kgTotalToPlateModelTotalLb(weight);


function Arc({ progress, color, size = 64, width = 3, trackColor = 'rgba(255,255,255,0.10)' }: { progress: number; color: string; size?: number; width?: number; trackColor?: string }) {
  const radius = (size - width) / 2;
  const circumference = 2 * Math.PI * radius;
  return <View pointerEvents="none" style={[styles.arc, { width: size, height: size }]}><Svg width={size} height={size}><Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={width} fill="none" /><Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress)} rotation="-90" origin={`${size / 2}, ${size / 2}`} /></Svg></View>;
}


function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.sectionHeading}><Ionicons name={icon} size={18} color="#A85CFF" /><ThemedText typographyRole="bodyStrong" style={styles.sectionTitle}>{title}</ThemedText></View>;
}

function TotalTierTrophy({ tierIndex, state }: { tierIndex: number; state: MilestoneState }) {
  const tier = LB_TOTAL_TROPHY_TIERS[Math.min(tierIndex, LB_TOTAL_TROPHY_TIERS.length - 1)];
  const isEarned = state === 'completed';
  const isProgress = state === 'progress';
  const customTrophy = SL_TOTAL_TROPHY_ASSETS[tierIndex];
  const imageStyle = tierIndex === 6 ? styles.totalTierTrophyObsidian : styles.totalTierTrophyImage;
  return <View style={[styles.totalTrophy, { borderColor: isEarned || isProgress ? tier.color : '#354050', backgroundColor: '#141922' }]}>
    {customTrophy ? <Image source={customTrophy} style={[imageStyle, !isEarned && styles.totalTierTrophyLocked]} resizeMode="contain" /> : <SLTrophy size={tier.size} tier="steel" muted={!isEarned} />}
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
    ? `${number(convertDisplayWeightValue(event.current_value, sourceUnit, unit))} ${unit}`
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
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyRail} accessibilityRole="tablist">
    {(Object.keys(ACHIEVEMENT_SECTION_LABELS) as AchievementSection[]).map((item) => <Pressable
      key={item}
      accessibilityRole="tab"
      accessibilityState={{ selected: item === section }}
      onPress={() => onSelect(item)}
      style={[styles.familyTab, item === section && styles.familyTabActive]}
    ><ThemedText typographyRole="shortTechnicalLabel" style={[styles.familyTabText, item === section && styles.familyTabTextActive]}>{ACHIEVEMENT_SECTION_LABELS[item]}</ThemedText></Pressable>)}
  </ScrollView>;
}

function AchievementsHub({
  club,
  unit,
  totalComplete,
  plateSource,
  latestMedallion,
  hasVolume,
  prCount,
  onOpen,
}: {
  club: TotalClubState;
  unit: Unit;
  totalComplete: boolean;
  plateSource?: ImageSourcePropType;
  latestMedallion?: MajorVolumeMedallionEvidence;
  hasVolume: boolean;
  prCount: number;
  onOpen: (section: AchievementSection) => void;
}) {
  const earnedTrophies = club.earnedTierIndex + 1;
  const currentClub = club.earnedTierIndex >= 0 ? club.thresholds[club.earnedTierIndex] : null;
  const nextTier = club.nextTierIndex == null ? null : TOTAL_TROPHY_TIER_NAMES[club.nextTierIndex];
  const latestMedallionAsset = latestMedallion
    ? majorVolumeMedallionAsset(latestMedallion.family, latestMedallion.thresholdLb)
    : null;
  return <View testID="ledger-achievements-hub" style={styles.hub}>
    <View style={styles.hubHero}>
      <View style={styles.hubHeroArtifact}>
        <Image
          source={SL_TOTAL_TROPHY_ASSETS[Math.max(0, club.earnedTierIndex)]}
          resizeMode="contain"
          style={[styles.hubHeroTrophy, club.earnedTierIndex < 0 && styles.totalTierTrophyLocked]}
        />
      </View>
      <View style={styles.hubHeroCopy}>
        <ThemedText typographyRole="shortTechnicalLabel" style={styles.hubKicker}>ACHIEVEMENTS</ThemedText>
        <ThemedText typographyRole="sectionTitle" style={styles.hubTitle}>{currentClub == null ? 'Your earned record' : `${number(currentClub)} ${unit.toUpperCase()} Total Club`}</ThemedText>
        <ThemedText typographyRole="supportingBody" style={styles.hubCopy}>{totalComplete ? `${number(club.current)} ${unit.toUpperCase()} total · ${earnedTrophies} ${earnedTrophies === 1 ? 'trophy' : 'trophies'} earned${nextTier ? ` · ${nextTier} is next` : ''}.` : 'A Total Club appears when canonical weight PRs exist for Squat, Bench Press, and Deadlift.'}</ThemedText>
      </View>
    </View>

    <Pressable testID="achievement-family-milestones" onPress={() => onOpen('milestones')} style={({ pressed }) => [styles.milestoneDoorway, pressed && styles.pressed]}>
      <View style={styles.milestoneDoorwayCopy}><ThemedText typographyRole="shortTechnicalLabel" style={styles.hubKicker}>MILESTONE PROGRESSION</ThemedText><ThemedText typographyRole="modalTitle" style={styles.doorwayFeatureTitle}>Core-lift progress, earned in order.</ThemedText><ThemedText typographyRole="supportingBody" style={styles.hubCopy}>Current PR, completed thresholds, next target, and exact plate-stack artwork.</ThemedText></View>
      {plateSource ? <Image source={plateSource} resizeMode="contain" style={styles.hubPlateStack} /> : <Ionicons name="barbell-outline" size={52} color="#5F6B7C" />}
    </Pressable>

    <View style={styles.hubPair}>
      <Pressable testID="achievement-family-clubs" onPress={() => onOpen('clubs')} style={({ pressed }) => [styles.clubDoorway, pressed && styles.pressed]}>
        <ThemedText typographyRole="shortTechnicalLabel" style={styles.hubKicker}>TOTAL CLUBS</ThemedText>
        <ThemedText typographyRole="heroNumeric" style={styles.clubDoorwayValue}>{totalComplete ? number(club.current) : '—'}</ThemedText>
        <ThemedText typographyRole="unit" style={styles.clubDoorwayUnit}>CURRENT TOTAL</ThemedText>
        <View style={styles.clubDoorwayPath}>{club.thresholds.map((threshold, index) => <View key={threshold} style={[styles.clubDoorwayStop, index <= club.earnedTierIndex && styles.clubDoorwayStopEarned, index === club.nextTierIndex && styles.clubDoorwayStopNext]} />)}</View>
      </Pressable>
      <Pressable testID="achievement-family-trophies" onPress={() => onOpen('trophies')} style={({ pressed }) => [styles.trophyDoorway, pressed && styles.pressed]}>
        <ThemedText typographyRole="shortTechnicalLabel" style={styles.hubKicker}>TROPHY CABINET</ThemedText>
        <View style={styles.trophyDoorwayArtifacts}>{[0, 3, 6].map((tierIndex) => <Image key={tierIndex} source={SL_TOTAL_TROPHY_ASSETS[tierIndex]} resizeMode="contain" style={[styles.trophyDoorwayImage, tierIndex > club.earnedTierIndex && styles.totalTierTrophyLocked]} />)}</View>
        <ThemedText typographyRole="supportingBody" style={styles.hubCopy}>{earnedTrophies} of 7 earned</ThemedText>
      </Pressable>
    </View>

    <Pressable testID="achievement-family-medallions" onPress={() => onOpen('medallions')} style={({ pressed }) => [styles.medallionDoorway, pressed && styles.pressed]}>
      <View style={styles.medallionDoorwayArtifact}>{latestMedallionAsset ? <Image source={latestMedallionAsset} resizeMode="contain" style={styles.medallionDoorwayImage} /> : <Ionicons name="ribbon-outline" size={48} color="#6F7784" />}</View>
      <View style={styles.medallionDoorwayCopy}><ThemedText typographyRole="shortTechnicalLabel" style={styles.hubKicker}>MEDALLIONS</ThemedText><ThemedText typographyRole="modalTitle" style={styles.doorwayFeatureTitle}>{latestMedallion ? `${number(convertDisplayWeightValue(latestMedallion.thresholdLb, 'lb', unit))} ${unit} ${latestMedallion.family === 'total' ? 'total' : latestMedallion.family} volume` : 'No recorded volume medallion yet'}</ThemedText><ThemedText typographyRole="supportingBody" style={styles.hubCopy}>{latestMedallion ? `Earned ${formatEarnedDate(latestMedallion.occurredAt) ?? 'from canonical evidence'}.` : 'Only stored lifetime-volume milestone events appear as earned.'}</ThemedText></View>
      <Ionicons name="chevron-forward" size={18} color="#9180A8" />
    </Pressable>

    <View style={styles.hubPair}>
      <Pressable testID="achievement-family-volume" onPress={() => onOpen('volume')} style={({ pressed }) => [styles.volumeDoorway, pressed && styles.pressed]}><Ionicons name="analytics" size={30} color="#B66CFF" /><ThemedText typographyRole="shortTechnicalLabel" style={styles.hubKicker}>VOLUME</ThemedText><ThemedText typographyRole="modalTitle" style={styles.doorwayFeatureTitle}>{hasVolume ? 'Accumulation record' : 'No volume yet'}</ThemedText><View style={styles.volumeDoorwayBars}>{[22, 38, 54, 72, 46].map((height, index) => <View key={index} style={[styles.volumeDoorwayBar, { height }]} />)}</View></Pressable>
      <Pressable testID="achievement-family-prs" onPress={() => onOpen('prs')} style={({ pressed }) => [styles.prDoorway, pressed && styles.pressed]}><Ionicons name="trending-up" size={30} color="#F0B33E" /><ThemedText typographyRole="shortTechnicalLabel" style={styles.hubKicker}>PR HISTORY</ThemedText><ThemedText typographyRole="heroNumeric" style={styles.prDoorwayValue}>{prCount}</ThemedText><ThemedText typographyRole="supportingBody" style={styles.hubCopy}>source-backed career PR events</ThemedText></Pressable>
    </View>
  </View>;
}

function TrophyCabinet({ club, unit, complete, onOpen }: { club: TotalClubState; unit: Unit; complete: boolean; onOpen: (label: string, value: string, state: MilestoneState, remaining?: string, sourceHref?: string, note?: string, actionLabel?: string) => void }) {
  return <View testID="ledger-trophy-cabinet" style={styles.cabinet}>
    <View style={styles.cabinetHeader}><ThemedText typographyRole="sectionTitle" style={styles.cabinetTitle}>TROPHY CABINET</ThemedText><ThemedText typographyRole="supportingBody" style={styles.cabinetCopy}>The established seven-tier Total Club trophy family. Requirements are unchanged.</ThemedText></View>
    {!complete ? <AchievementRequestState kind="empty" message="A complete canonical total is not available yet" /> : null}
    <View style={styles.cabinetGrid}>{club.thresholds.map((threshold, tierIndex) => {
      const state: MilestoneState = tierIndex <= club.earnedTierIndex ? 'completed' : tierIndex === club.nextTierIndex ? 'progress' : 'locked';
      const remaining = state === 'progress' && club.remaining != null ? `${number(club.remaining)} ${unit.toUpperCase()} remaining` : undefined;
      return <Pressable key={threshold} testID={`total-trophy-${tierIndex}`} onPress={() => onOpen(`${TOTAL_TROPHY_TIER_NAMES[tierIndex]} Total Club Trophy`, `${number(threshold)} ${unit.toUpperCase()}`, state, remaining, '/(tabs)/ledger/strength', state === 'completed' ? 'Earned state is derived from the current canonical Squat, Bench Press, and Deadlift weight PRs. An earned date is not stored for Total Clubs.' : 'Requirement comes from the approved Total Club ladder.', 'Open Strength evidence')} style={({ pressed }) => [styles.cabinetItem, state === 'progress' && styles.cabinetItemProgress, pressed && styles.pressed]}>
        <Image source={SL_TOTAL_TROPHY_ASSETS[tierIndex]} resizeMode="contain" style={[styles.cabinetTrophyImage, state !== 'completed' && styles.totalTierTrophyLocked]} />
        <ThemedText typographyRole="modalTitle" style={styles.cabinetItemTitle}>{TOTAL_TROPHY_TIER_NAMES[tierIndex]}</ThemedText>
        <ThemedText typographyRole="milestoneThreshold" style={styles.cabinetThreshold}>{number(threshold)} {unit.toUpperCase()}</ThemedText>
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
  if (!events.length) return <View testID="ledger-pr-history"><AchievementRequestState kind="empty" message="No canonical PR history yet" /></View>;
  return <View testID="ledger-pr-history" style={styles.prHistory}>
    <View style={styles.cabinetHeader}><ThemedText typographyRole="sectionTitle" style={styles.cabinetTitle}>PR HISTORY</ThemedText><ThemedText typographyRole="supportingBody" style={styles.cabinetCopy}>Career PR events preserved by the accomplishment platform. Open any qualifying SetLog that is still available.</ThemedText></View>
    {events.map((event) => { const summary = formatPrEvent(event, unit); const date = formatEarnedDate(event.occurred_at || event.workout_date); return <Pressable key={event.id} disabled={!event.source_set_log_id} onPress={() => onOpen(event)} style={({ pressed }) => [styles.prHistoryRow, pressed && styles.pressed]}>
      <View style={styles.prHistoryIcon}><Ionicons name={event.event_type === 'CORE_REP_MAX_PR' ? 'repeat-outline' : event.event_type === 'CORE_E1RM_PR' ? 'analytics-outline' : 'barbell-outline'} size={19} color="#B66CFF" /></View>
      <View style={styles.prHistoryCopy}><ThemedText typographyRole="bodyStrong" style={styles.prHistoryTitle}>{summary.title}</ThemedText><ThemedText typographyRole="caption" style={styles.prHistoryMeta}>{summary.detail}{date ? ` · ${date}` : ''}</ThemedText></View>
      <ThemedText typographyRole="milestoneThreshold" style={styles.prHistoryValue}>{summary.value}</ThemedText>
      {event.source_set_log_id ? <Ionicons name="chevron-forward" size={16} color="#788394" /> : null}
    </Pressable>; })}
  </View>;
}

export default function AchievementsExperience({ onBack, backAccessibilityLabel = 'Back to The Ledger' }: { onBack?: () => void; backAccessibilityLabel?: string } = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { unit: requestedUnit, tab: requestedTab, section: requestedSection } = useLocalSearchParams<{ unit?: string; tab?: string; section?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const [unit, setUnit] = useState<Unit>(() => requestedUnit === 'kg' || requestedUnit === 'lb'
    ? requestedUnit
    : normalizeDisplayWeightUnit(user?.preferred_units));
  const [section, setSection] = useState<AchievementSection>(() => requestedAchievementSection(requestedSection, requestedTab));
  const [detail, setDetail] = useState<Detail>(null);
  const [historyEvents, setHistoryEvents] = useState<AccomplishmentEvent[]>([]);
  const liveData = useLedgerLiveData('all');
  const progression = liveData.progression;
  const currentBests = liveData.currentBests;
  const loading = liveData.loading;
  const error = liveData.error;
  const errorKind = liveData.errorKind;
  const reload = liveData.reload;
  const timelineEvents = historyEvents.length ? historyEvents : liveData.accomplishments;
  const volumeMedallions = canonicalMajorVolumeMedallions(timelineEvents);
  const prHistory = canonicalPrHistory(timelineEvents);
  const liveLifts = LIFT_PRESENTATIONS.map((lift): Lift => {
    const key = canonicalLiftKey(lift.name);
    const canonicalWeightBest = currentBests
      .filter((item) => item.metric === 'weight' && canonicalLiftKey(item.core_movement_key || item.movement_label) === key)
      .sort((left, right) => right.best_value - left.best_value)[0];
    const canonicalWeight = canonicalWeightBest?.best_value;
    return {
      ...lift,
      canonicalWeightKg: canonicalWeight ?? null,
      currentLb: canonicalWeight == null ? null : Math.round(kilogramsToDisplayValue(canonicalWeight, 'lb') / 5) * 5,
      sourceSetLogId: canonicalWeightBest?.event?.source_set_log_id ?? null,
    };
  });
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
  const liveOther = OTHER.flatMap((row): OtherMilestoneRow[] => {
    const current = row.id === 'sessions'
      ? progression?.consistency?.sessions_completed
      : progression?.consistency?.training_age_years;
    return current == null ? [] : [{ ...row, current }];
  });
  const liftsWithCurrentPr = liveLifts.filter((lift): lift is Lift & { currentLb: number; canonicalWeightKg: number } => typeof lift.currentLb === 'number' && lift.currentLb > 0 && typeof lift.canonicalWeightKg === 'number');
  const canonicalStrengthTotal = canonicalTotal(currentBests);
  const club = totalClubState(canonicalStrengthTotal, unit);
  const hasCompleteStrengthTotal = canonicalStrengthTotal.complete;
  const totalMilestones = [...club.thresholds];
  const total = { current: club.current, next: club.next ?? totalMilestones.at(-1) ?? club.current, prior: club.prior };
  const totalProgress = club.progress;
  const remaining = club.remaining ?? 0;
  const highestCompletedTier = Math.max(0, club.earnedTierIndex);
  const hubLift = [...liftsWithCurrentPr].sort((left, right) => right.currentLb - left.currentLb)[0];
  const hubLiftDisplay = hubLift ? displayWeightFromCanonicalLb(hubLift.currentLb, unit) : null;
  const hubPlateSource = hubLiftDisplay != null && canRenderGymTotal(hubLiftDisplay, unit)
    ? resolvePlateStackRender({ weight: hubLiftDisplay, unit })?.imageSource
    : undefined;
  const openDetail = (label: string, value: string, state: MilestoneState, remainingText?: string, sourceHref?: string, note?: string, actionLabel?: string) => setDetail({ label, value, state, remaining: remainingText, sourceHref, note, actionLabel });
  const openSection = (nextSection: AchievementSection) => {
    setSection(nextSection);
    router.setParams({ section: nextSection, tab: undefined } as any);
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  };

  useFocusEffect(useCallback(() => {
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, []));

  useEffect(() => {
    if (requestedUnit === 'lb' || requestedUnit === 'kg') setUnit(requestedUnit);
    else setUnit(normalizeDisplayWeightUnit(user?.preferred_units));
  }, [requestedUnit, user?.preferred_units]);

  useEffect(() => {
    setSection(requestedAchievementSection(requestedSection, requestedTab));
  }, [requestedSection, requestedTab]);

  useEffect(() => {
    let active = true;
    fetchLedgerAccomplishmentHistory()
      .then((items) => { if (active) setHistoryEvents(items); })
      .catch((caught) => { if (__DEV__) console.warn('[LedgerAchievements] Full accomplishment history unavailable; using the recent canonical page.', caught); });
    return () => { active = false; };
  }, []);

  return <SLScreen edges="none" padded={false} style={styles.screen}>
    <View style={styles.canvas}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} contentOffset={{ x: 0, y: 0 }} showsVerticalScrollIndicator={false}>
        <View style={styles.navHeader}><Pressable onPress={section === 'hub' ? onBack ?? (() => router.replace('/(tabs)/ledger/home' as any)) : () => openSection('hub')} style={styles.navButton} accessibilityLabel={section === 'hub' ? backAccessibilityLabel : 'Back to Achievements overview'}><Ionicons name="chevron-back" size={25} color="#F4F6FA" /></Pressable><View style={styles.achievementHeaderTitle}><ThemedText typographyRole="shortTechnicalLabel" style={styles.achievementHeaderKicker}>THE LEDGER</ThemedText><ThemedText typographyRole="modalTitle" style={styles.achievementHeaderText}>{ACHIEVEMENT_SECTION_LABELS[section]}</ThemedText></View>{section !== 'streaks' && section !== 'prs' && section !== 'medallions' ? <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Display unit: ${unit.toUpperCase()}. Switch to ${unit === 'kg' ? 'LB' : 'KG'}`}
          onPress={() => setUnit(unit === 'lb' ? 'kg' : 'lb')}
          style={[styles.navButton, styles.unitControl]}
        ><ThemedText typographyRole="unit" style={styles.unitControlText}>{unit.toUpperCase()}</ThemedText></Pressable> : <Pressable onPress={() => Alert.alert('Achievement evidence', 'Earned states and dates shown here come from canonical accomplishment evidence.')} style={styles.navButton} accessibilityLabel="Achievement evidence information"><Ionicons name="information-circle-outline" size={22} color="#B6BDCB" /></Pressable>}</View>
        <AchievementFamilyRail section={section} onSelect={openSection} />
        {loading ? <AchievementRequestState kind="loading" message="Loading achievements" />
          : error ? <AchievementRequestState kind={errorKind ?? 'error'} message={error} onRetry={() => void reload()} />
            : section === 'hub' ? <AchievementsHub club={club} unit={unit} totalComplete={hasCompleteStrengthTotal} plateSource={hubPlateSource} latestMedallion={volumeMedallions[0]} hasVolume={hasVolumeData} prCount={prHistory.length} onOpen={openSection} />
              : section === 'streaks' ? (liveStreaks.length ? <StreakContent items={liveStreaks} /> : <AchievementRequestState kind="empty" message="No streak evidence yet" />)
                : section === 'trophies' ? <TrophyCabinet club={club} unit={unit} complete={hasCompleteStrengthTotal} onOpen={openDetail} />
                  : section === 'medallions' ? <MedallionGallery items={volumeMedallions} onOpen={openDetail} unit={unit} />
                    : section === 'volume' ? (hasVolumeData ? <VolumeAchievementExperience data={volumeDataset} unit={unit} /> : <AchievementRequestState kind="empty" message="No canonical volume evidence yet" />)
                      : section === 'prs' ? <PrHistory events={prHistory} onOpen={(event) => { if (event.source_set_log_id) router.push(archiveDetailHref('set', event.source_set_log_id) as any); }} unit={unit} />
                        : <>
          {section === 'clubs' && hasCompleteStrengthTotal ? <View testID="ledger-total-clubs" style={[styles.hero, { minHeight: 315 }]}>
            <View style={styles.heroTop}><View style={styles.trophyScene}><View style={styles.trophyPedestal}><Image source={SL_TOTAL_TROPHY_ASSETS[highestCompletedTier]} style={styles.heroTrophyImage} resizeMode="contain" /></View></View><View style={styles.heroCopy}><ThemedText typographyRole="heroNumeric" adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1} style={styles.heroValue}>{number(total.current)} <ThemedText typographyRole="unit" style={styles.heroUnit}>{unit.toUpperCase()}</ThemedText></ThemedText><ThemedText typographyRole="caption" style={styles.heroMeta}>Current Total</ThemedText></View><View style={styles.nextBlock}><ThemedText typographyRole="shortTechnicalLabel" adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={styles.nextLabel}>{club.next == null ? 'MILESTONE LADDER' : 'NEXT MILESTONE'}</ThemedText><ThemedText typographyRole="milestoneThreshold" adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.nextValue}>{club.next == null ? 'COMPLETE' : <>{number(total.next)} <ThemedText typographyRole="unit" style={styles.nextUnit}>{unit.toUpperCase()}</ThemedText></>}</ThemedText><ThemedText typographyRole="caption" style={styles.nextSub}>{club.next == null ? 'Highest approved threshold reached' : `${number(remaining)} ${unit.toUpperCase()} to go`}</ThemedText></View></View>
            <View style={styles.progressRow}><View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${totalProgress * 100}%` }]} /></View><ThemedText typographyRole="percentage" style={styles.progressPercent}>{Math.round(totalProgress * 100)}%</ThemedText></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: Math.max(0, totalMilestones.indexOf(total.next) - 3) * 83, y: 0 }} contentContainerStyle={[styles.totalPath, { paddingBottom: 0 }]}>{totalMilestones.map((value, tierIndex) => { const state = stateFor(total.current, value, total.next); return <Pressable key={value} onPress={() => openDetail('Combined total', `${number(value)} ${unit.toUpperCase()}`, state, state === 'progress' ? `${number(remaining)} ${unit.toUpperCase()} remaining` : undefined)} style={styles.totalStop}><TotalTierTrophy tierIndex={tierIndex} state={state} /><ThemedText typographyRole="milestoneThreshold" style={[styles.totalLabel, state === 'locked' && styles.mutedText]}>{number(value)}</ThemedText></Pressable>; })}</ScrollView>
          </View> : null}
          <SectionHeader title={section === 'clubs' ? 'Core Lift Club Contributions' : 'Strength PR Milestones'} icon="barbell-outline" />
          {liveLifts.map((lift) => <LiftRow key={lift.name} lift={lift} unit={unit} onOpen={openDetail} />)}
          {section === 'milestones' && liveOther.length ? <><SectionHeader title="Other Milestones" icon="star-outline" />{liveOther.map((row) => <OtherRow key={row.id} row={row} />)}</> : null}
        </>}
      </ScrollView>
    </View>
    <Modal transparent visible={!!detail} animationType="fade" onRequestClose={() => setDetail(null)}><Pressable style={styles.modalScrim} onPress={() => setDetail(null)}><Pressable testID="achievement-detail" style={styles.detailSheet} onPress={(event) => event.stopPropagation()}><View style={[styles.detailIcon, detail?.state === 'completed' ? styles.totalEarned : detail?.state === 'progress' ? styles.totalProgress : styles.totalLocked]}>{detail?.state === 'completed' ? <SLTrophy size={21} /> : <Ionicons name={detail?.state === 'progress' ? 'radio-button-on' : 'lock-closed'} size={21} color={detail?.state === 'progress' ? '#B165FF' : '#AEB7C6'} />}</View><ThemedText typographyRole="heroNumeric" style={styles.detailTitle}>{detail?.value}</ThemedText><ThemedText typographyRole="modalTitle" style={styles.detailLabel}>{detail?.label}</ThemedText><ThemedText typographyRole="modalBody" style={styles.detailState}>{detail?.state === 'completed' ? 'Earned' : detail?.state === 'progress' ? detail.remaining ?? 'In progress' : 'Locked · Keep building'}</ThemedText>{detail?.note ? <ThemedText typographyRole="supportingBody" style={styles.detailNote}>{detail.note}</ThemedText> : null}<Pressable onPress={() => { const href = detail?.sourceHref; setDetail(null); if (href) router.push(href as any); }} style={styles.detailClose}><ThemedText typographyRole="shortButtonLabel" style={styles.detailCloseText}>{detail?.sourceHref ? detail.actionLabel ?? 'Open source evidence' : 'Done'}</ThemedText></Pressable></Pressable></Pressable></Modal>
  </SLScreen>;
}

function LiftRow({ lift, unit, onOpen }: { lift: Lift; unit: Unit; onOpen: (label: string, value: string, state: MilestoneState, remaining?: string, sourceHref?: string) => void }) {
  const { width: windowWidth } = useWindowDimensions();
  const railRef = useRef<ScrollView>(null);
  const [railWidth, setRailWidth] = useState(0);
  const compact = windowWidth < 400;
  const proMax = windowWidth >= 430;
  const canonicalCurrentLb = typeof lift.currentLb === 'number' && Number.isFinite(lift.currentLb) && lift.currentLb > 0
    ? lift.currentLb
    : null;
  const hasCurrent = canonicalCurrentLb !== null;
  const current = displayWeightFromCanonicalLb(canonicalCurrentLb ?? 0, unit);
  const canRenderCanonicalHero = hasCurrent && canRenderGymTotal(current, unit);
  const heroRender = canRenderCanonicalHero
    ? resolvePlateStackRender({ weight: current, unit })
    : null;
  const milestones = lift.milestones[unit];
  const next = nextMilestone(current, milestones);
  const latestClub = milestones.filter((target) => target <= current).at(-1);
  const liftKey = lift.name.toLowerCase() as PlateClubLiftKey;
  const identityAsset = lift.name === 'Squat'
    ? require('@/assets/images/lift-icons/achievement-material-v2/squat.png')
    : lift.name === 'Bench'
      ? require('@/assets/images/lift-icons/achievement-material-v2/bench.png')
      : require('@/assets/images/lift-icons/achievement-material-v2/deadlift.png');
  const initialIndex = milestoneWindowStart(milestones, current);
  const cellWidth = milestoneCellWidth(railWidth);
  const renderedCellWidth = cellWidth || 84;
  const milestoneStageWidth = Math.min(
    MILESTONE_SLEEVE_WINDOW_TUNING.width,
    Math.max(64, renderedCellWidth - 8),
  );
  const milestoneStageHeight = MILESTONE_SLEEVE_WINDOW_TUNING.height
    * (milestoneStageWidth / MILESTONE_SLEEVE_WINDOW_TUNING.width);
  const heroStageWidth = compact ? 150 : HERO_SLEEVE_WINDOW_TUNING.width;
  const heroStageHeight = compact ? 106 : HERO_SLEEVE_WINDOW_TUNING.height;

  const captureRailWidth = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    setRailWidth((priorWidth) => priorWidth === nextWidth ? priorWidth : nextWidth);
  }, []);

  useEffect(() => {
    if (!cellWidth) return;
    const frame = requestAnimationFrame(() => railRef.current?.scrollTo({
      x: milestoneScrollOffset(initialIndex, cellWidth),
      y: 0,
      animated: false,
    }));
    return () => cancelAnimationFrame(frame);
  }, [cellWidth, initialIndex, unit]);

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
      <View style={[styles.liftMetricBlock, proMax && styles.liftMetricBlockProMax]}><ThemedText typographyRole="shortTechnicalLabel" style={[styles.liftName, { color: lift.tone }]}>{lift.name === 'Bench' ? 'BENCH PRESS' : lift.name.toUpperCase()}</ThemedText><ThemedText typographyRole="shortTechnicalLabel" style={styles.liftCurrentLabel}>CURRENT PR</ThemedText><View style={styles.liftHeroMetricRow}><ThemedText typographyRole="heroNumeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={styles.liftHeroMetric}>{hasCurrent ? number(current) : '—'}</ThemedText>{hasCurrent ? <ThemedText typographyRole="unit" numberOfLines={1} style={styles.liftHeroUnit}>{unit.toUpperCase()}</ThemedText> : null}</View></View>
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
    <View style={styles.liftProgressViewport} onLayout={captureRailWidth}>
      <ScrollView ref={railRef} horizontal showsHorizontalScrollIndicator={false} scrollEnabled={milestones.length > 4} decelerationRate="fast" snapToInterval={renderedCellWidth + MILESTONE_CELL_GAP} contentContainerStyle={styles.liftProgressRail}>
        {milestones.map((target) => {
          const milestoneState = stateFor(current, target, next);
          const isLatestClub = target === latestClub;
          const targetInPounds = poundsForMilestoneModel(target, unit);
          const targetRenderAsset = resolveMilestoneRenderAsset(liftKey, targetInPounds);
          const pending = milestoneState === 'progress' || milestoneState === 'locked';
          const markerColor = pending ? '#59677A' : lift.tone;
          const clubTone = milestoneState === 'locked' ? '#758093' : milestoneState === 'progress' ? '#B7C0CC' : lift.tone;
          const sourceHref = isLatestClub && lift.sourceSetLogId
            ? archiveDetailHref('set', lift.sourceSetLogId)
            : undefined;
          return <Pressable key={target} style={[styles.liftMilestoneStop, { width: renderedCellWidth }]} onPress={() => onOpen(lift.name, `${number(target)} ${unit.toUpperCase()}`, milestoneState, milestoneState === 'progress' ? `${number(target - current)} ${unit.toUpperCase()} remaining` : undefined, sourceHref)}>
            {isLatestClub ? <View pointerEvents="none" style={[styles.latestClubFrame, { borderColor: lift.tone }]} /> : null}
            <ThemedText typographyRole="milestoneThreshold" style={[styles.liftMilestoneValue, isLatestClub && { color: lift.tone }]}>{number(target)}</ThemedText>
            <View style={[styles.milestoneSleeveStage, { width: milestoneStageWidth, height: milestoneStageHeight }, !!targetRenderAsset && milestoneState === 'progress' && styles.milestoneSleeveProgress, !!targetRenderAsset && milestoneState === 'locked' && styles.milestoneSleeveLocked]}>
              {targetRenderAsset ? <Image
                source={targetRenderAsset}
                resizeMode="contain"
                testID={`${liftKey}-${targetInPounds}-milestone-image`}
                style={styles.milestoneSleeveImage}
              /> : <View testID={`${liftKey}-${targetInPounds}-milestone-render-unavailable`} style={styles.liftHeroEmpty}><Ionicons name="image-outline" size={22} color="#566173" /></View>}
            </View>
            <View style={[styles.liftStateMarker, milestoneState === 'progress' ? { borderWidth: 0 } : { borderColor: markerColor }, isLatestClub && { backgroundColor: '#111722' }]}>{milestoneState === 'progress' ? <Arc progress={progressFor(current, milestones, target)} color={lift.tone} trackColor="#59677A" size={25} width={2} /> : null}<Ionicons name={isLatestClub ? 'star' : milestoneState === 'completed' ? 'checkmark' : 'lock-closed'} size={isLatestClub ? 15 : 14} color={pending ? '#8D98A7' : lift.tone} /></View>
            <ThemedText typographyRole="caption" numberOfLines={2} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.88} style={[styles.clubLabel, milestoneState === 'locked' && styles.mutedText, { color: clubTone }, isLatestClub && { fontWeight: '800' }]}>{readablePlateClubLabel(plateClubLabel(target, unit))}</ThemedText>
          </Pressable>;
        })}
      </ScrollView>
    </View>
  </View>;
}

function OtherRow({ row }: { row: OtherMilestoneRow }) {
  const next = nextMilestone(row.current, row.thresholds);
  const visibleThresholds = otherMilestoneWindow(row.thresholds, row.current);
  const remaining = remainingToMilestone(row.current, next);
  return <View testID={`other-milestone-${row.id}`} style={styles.otherCase}>
    <View style={styles.otherTopRow}>
      <View style={styles.otherIdentity}>
        <View style={[styles.otherIcon, { borderColor: `${row.tone}88` }]}><Ionicons name={row.icon} size={22} color={row.tone} /></View>
        <View style={styles.otherIdentityCopy}>
          <ThemedText typographyRole="shortTechnicalLabel" numberOfLines={2} style={styles.otherName}>{row.name}</ThemedText>
          <View style={styles.otherCurrentRow}>
            <ThemedText typographyRole="heroNumeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.otherCurrentValue}>{number(row.current)}</ThemedText>
            {row.unit ? <ThemedText typographyRole="unit" style={styles.otherCurrentUnit}>{row.unit}</ThemedText> : null}
          </View>
        </View>
      </View>
      <View style={styles.otherNextBlock}>
        <ThemedText typographyRole="shortTechnicalLabel" numberOfLines={1} style={styles.otherNextLabel}>NEXT MILESTONE</ThemedText>
        <View style={styles.otherRemainingRow}>
          <ThemedText typographyRole="milestoneThreshold" numberOfLines={1} style={[styles.otherRemainingValue, { color: row.tone }]}>{number(remaining)}</ThemedText>
          <ThemedText typographyRole="shortTechnicalLabel" numberOfLines={1} style={[styles.otherRemainingWords, { color: row.tone }]}>TO GO</ThemedText>
        </View>
      </View>
    </View>
    <View testID={`other-milestone-${row.id}-rail`} style={styles.otherRail}>
      <View pointerEvents="none" style={styles.otherConnector} />
      {visibleThresholds.map((target) => {
        const milestoneState = stateFor(row.current, target, next);
        const progress = milestoneState === 'progress' ? progressBetweenMilestones(row.current, row.thresholds, target) : 0;
        const percent = Math.round(progress * 100);
        return <View key={target} testID={`other-milestone-${row.id}-marker`} style={styles.otherRailCell} accessibilityLabel={`${row.name}, ${number(target)}, ${milestoneState}${milestoneState === 'progress' ? `, ${percent} percent complete` : ''}`}>
          <View style={[styles.otherMarker, milestoneState === 'locked' ? styles.otherMarkerLocked : { borderColor: row.tone, backgroundColor: `${row.tone}10` }, milestoneState === 'progress' && styles.otherMarkerCurrent]}>
            {milestoneState === 'progress' ? <Arc progress={progress} color={row.tone} trackColor="#263241" size={38} width={2.5} /> : null}
            {milestoneState === 'completed' ? <Ionicons name="checkmark" size={20} color={row.tone} /> : milestoneState === 'locked' ? <Ionicons name="lock-closed-outline" size={15} color="#778293" /> : <ThemedText typographyRole="milestoneThreshold" adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={[styles.otherMarkerTarget, { color: row.tone }]}>{number(target)}</ThemedText>}
          </View>
          <ThemedText typographyRole="milestoneThreshold" adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.otherThreshold, milestoneState === 'locked' && styles.otherThresholdLocked, milestoneState !== 'locked' && { color: row.tone }]}>{number(target)}</ThemedText>
        </View>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  achievementHeaderTitle: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  achievementHeaderKicker: { color: '#8E79AF', fontSize: 8, lineHeight: 10, letterSpacing: 1.1 },
  achievementHeaderText: { color: '#F1EDF8', fontSize: 17, lineHeight: 21 },
  familyRail: { gap: 7, paddingVertical: 8, paddingRight: 10 },
  familyTab: { minHeight: 34, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#242A35', backgroundColor: '#0B0E14' },
  familyTabActive: { borderColor: '#7541B8', backgroundColor: '#25133D' },
  familyTabText: { color: '#7F8794', fontSize: 9, lineHeight: 11, letterSpacing: 0.5 },
  familyTabTextActive: { color: '#E4D4FF' },
  hub: { gap: 11, paddingTop: 5 },
  hubHero: { minHeight: 190, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#40334C', backgroundColor: '#0E0B12' },
  hubHeroArtifact: { width: '43%', height: 184, alignItems: 'center', justifyContent: 'center', backgroundColor: '#141019' },
  hubHeroTrophy: { width: 154, height: 164 },
  hubHeroCopy: { flex: 1, minWidth: 0, paddingVertical: 18, paddingRight: 16, gap: 7 },
  hubKicker: { color: '#B987F8', fontSize: 9, lineHeight: 11, letterSpacing: 0.8 },
  hubTitle: { color: '#F4F0F8', fontSize: 23, lineHeight: 27 },
  hubCopy: { color: '#9FA5B0', fontSize: 10.5, lineHeight: 15 },
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
  prHistoryRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#292E37' },
  prHistoryIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: '#4A2B69', backgroundColor: '#130B1C' },
  prHistoryCopy: { flex: 1, minWidth: 0, gap: 2 },
  prHistoryTitle: { color: '#EDEEF1', fontSize: 12.5, lineHeight: 16 },
  prHistoryMeta: { color: '#868F9D' },
  prHistoryValue: { maxWidth: 91, color: '#E2C6FF', fontSize: 13, lineHeight: 16, textAlign: 'right' },
  requestState: { marginTop: 18, minHeight: 180, paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#242D3B', backgroundColor: 'transparent' },
  requestStateTitle: { color: '#F1F3F7', textAlign: 'center' },
  requestStateCopy: { maxWidth: 330, color: '#9DA7B6', textAlign: 'center' },
  requestStateAction: { marginTop: 6, minHeight: 42, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#7340AE', backgroundColor: '#1C1130' },
  milestoneSleeveStage: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  milestoneSleeveImage: { width: '100%', height: '100%', ...MILESTONE_RENDER_ORIENTATION_STYLE },
  milestoneSleeveProgress: { opacity: 0.26 },
  milestoneSleeveLocked: { opacity: 0.18 },
  screen: { backgroundColor: 'transparent' }, canvas: { flex: 1, backgroundColor: 'transparent' }, content: { paddingTop: SLLayout.screenTop, paddingBottom: SLLayout.tabBarClearance + SLLayout.floatingUtilityClearance, gap: 8 },
  navHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, navButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#0D121B', borderWidth: 1, borderColor: '#202936' }, headerSelector: { flex: 1, height: 44, flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: '#10151F', borderWidth: 1, borderColor: '#202836' }, headerSelectorOption: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 9 }, headerSelectorActive: { backgroundColor: '#28124B', borderWidth: 1, borderColor: '#7D38C6', shadowColor: '#9D55FF', shadowOpacity: 0.34, shadowRadius: 9, shadowOffset: { width: 0, height: 2 } }, headerSelectorText: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 12, lineHeight: 16, color: '#939BA8' }, headerSelectorTextActive: { color: '#F2EDFF' },
  introRow: { flexDirection: 'row', alignItems: 'center', marginTop: 11, marginBottom: 6 }, intro: { ...SLTypography.rowMeta, color: '#B7BFCD', flex: 1 }, unitControl: { backgroundColor: '#171123', borderColor: '#8D4BE4' }, unitControlText: { ...SLTypography.label, color: '#F5EFFF', letterSpacing: 0.5 },
  hero: { minHeight: 380, overflow: 'hidden', paddingTop: 19, paddingBottom: 13, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, borderColor: '#293245', shadowColor: '#000000', shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }, heroTop: { flexDirection: 'row', alignItems: 'center', minHeight: 122 }, trophyScene: { width: 104, alignItems: 'center', justifyContent: 'center' }, trophyGlow: { position: 'absolute', width: 102, height: 70, borderRadius: 51, backgroundColor: 'rgba(255,176,33,0.18)', shadowColor: '#CE8B19', shadowOpacity: 0.75, shadowRadius: 18 }, trophyAura: { position: 'absolute', left: -20, top: -15 }, trophyPedestal: { width: 98, height: 110, alignItems: 'center', justifyContent: 'center' }, heroTrophyImage: { width: 108, height: 118 }, heroCopy: { flex: 1, marginLeft: 4, alignSelf: 'center' }, eyebrow: { ...SLTypography.utilityLabel, color: '#B9C0CE', letterSpacing: 0.7 }, heroValue: { fontFamily: SLTypography.hero.fontFamily, fontSize: 38, lineHeight: 43, color: '#F7F8FB', letterSpacing: -1.1, marginTop: 3 }, heroUnit: { ...SLTypography.cardTitle, color: '#BB70FF', letterSpacing: 0 }, heroMeta: { ...SLTypography.rowMeta, color: '#9AA4B3', marginTop: 1 }, nextBlock: { width: 102, alignSelf: 'center', paddingLeft: 12, borderLeftWidth: 1, borderColor: '#2B3445' }, nextLabel: { ...SLTypography.micro, color: '#8D98AA', letterSpacing: 0.45 }, nextValue: { ...SLTypography.sectionTitle, color: '#F3F4F7', marginTop: 3 }, nextUnit: { ...SLTypography.label, color: '#B86DFF' }, nextSub: { ...SLTypography.micro, color: '#A5AFBE', marginTop: 3 }, progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 7 }, progressTrack: { flex: 1, height: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: '#202735', borderWidth: 1, borderColor: '#2C3545' }, progressBar: { height: '100%', borderRadius: 7, shadowColor: '#A14FFF', shadowOpacity: 0.8, shadowRadius: 7 }, progressPercent: { ...SLTypography.label, color: '#ECEDF2' }, totalPath: { paddingTop: 20, paddingBottom: 5, gap: 15, paddingRight: 18 }, totalStop: { minWidth: 68, alignItems: 'center' }, totalTrophy: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 }, totalTrophyInset: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, totalTierTrophyImage: { width: 70, height: 76, marginTop: -6 }, totalTierTrophyObsidian: { width: 80, height: 88, marginTop: -12 }, totalTierTrophyLocked: { opacity: 0.42 }, totalEarned: { backgroundColor: '#141922', borderColor: '#E2B64C', shadowColor: '#E5A51B', shadowOpacity: 0.63, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, totalProgress: { backgroundColor: '#201B34', borderColor: '#A961FF' }, totalLocked: { backgroundColor: '#141922', borderColor: '#354050' }, totalLabel: { ...SLTypography.label, color: '#E4E7EC', marginTop: 11 }, totalUnit: { ...SLTypography.micro, color: '#929CAC', marginTop: 1 },
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
  liftHeroMetricRow: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 1 },
  liftHeroMetric: { flex: 1, flexShrink: 1, minWidth: 0, color: '#F5F6F8', paddingRight: 2 },
  liftHeroUnit: { ...SLTypography.cardTitle, flexShrink: 0, color: '#BBC3CF', letterSpacing: 0 },
  heroSleeveStage: { flex: 1, minWidth: 0, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 3 },
  liftHeroEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.72 },
  liftHeroEmptyText: { ...SLTypography.micro, color: '#778293', letterSpacing: 0.65 },
  heroRenderImage: { position: 'absolute', left: 0, top: 0 },
  heroRenderTint: { opacity: 0.18 },
  liftProgressViewport: { height: 154, overflow: 'hidden', borderTopWidth: 1, borderTopColor: '#182130' },
  liftProgressRail: { alignItems: 'flex-start', gap: MILESTONE_CELL_GAP, paddingHorizontal: MILESTONE_RAIL_INSET, paddingTop: 8, paddingBottom: 8 },
  liftMilestoneStop: { alignItems: 'center', position: 'relative' },
  latestClubFrame: { position: 'absolute', left: 1, right: 1, top: 0, bottom: 0, borderWidth: 1.5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.018)', shadowOpacity: 0.92, shadowRadius: 12, shadowOffset: { width: 0, height: 1 }, elevation: 7 },
  liftMilestoneValue: { ...SLTypography.cardTitle, color: '#D7DDE6', marginBottom: 1 },
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
