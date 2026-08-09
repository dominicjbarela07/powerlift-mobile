import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Modal, Pressable, StyleSheet, useWindowDimensions, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { SLColors, SLFontFamilies, SLRadius, SLShadows, SLSpacing } from '@/constants/theme';
import { SLEasing, useSLReducedMotion } from '@/lib/motion';
import { volumeAchievementPhoto } from '@/lib/volume-achievement-assets';
import {
  deriveVolumeAchievement,
  deriveVolumeComparisonPresentation,
  formatCompactVolumeLb,
  formatVolumeLb,
  formatVolumeValue,
  poundsToDisplayValue,
  safeVolumeLb,
  volumeSharePercent,
  type VolumeAchievementContextId,
  type VolumeAchievementMilestone,
  type VolumeAchievementProgress,
  type VolumeAchievementState,
  type VolumeComparisonCandidate,
  type VolumeDisplayUnit,
} from '@/lib/volume-achievements';

export type VolumeAchievementEntry = {
  id: VolumeAchievementContextId;
  label: string;
  current: Partial<Record<VolumeDisplayUnit, number | null>>;
  tone: string;
  glow: string;
  iconSource?: ImageSourcePropType;
};

export type VolumeAchievementDataset = {
  total: VolumeAchievementEntry;
  competitionTotal?: {
    label: string;
    current: Partial<Record<VolumeDisplayUnit, number | null>>;
  };
  lifts: VolumeAchievementEntry[];
};

type Selection = {
  contextId: VolumeAchievementContextId;
  contextLabel: string;
  currentLb: number;
  milestone: VolumeAchievementMilestone;
  tone: string;
};

type Props = {
  data: VolumeAchievementDataset;
  unit: VolumeDisplayUnit;
};

const stateLabel = (state: VolumeAchievementState) => state === 'achieved' ? 'ACHIEVED' : state === 'current' ? 'CURRENT TARGET, LOCKED' : 'LOCKED AHEAD';
const stateIcon = (state: VolumeAchievementState) => state === 'achieved' ? 'checkmark' : state === 'current' ? 'flag' : 'lock-closed';

function suppliedDisplayValue(entry: VolumeAchievementEntry, unit: VolumeDisplayUnit) {
  return safeVolumeLb(entry.current[unit]);
}

function CircularProgress({ progress, tone, size }: { progress: number; tone: string; size: number }) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={size} height={size} style={styles.progressRingSvg}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#263244" strokeWidth={strokeWidth} fill="#09111C" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={tone}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - clampedProgress)}
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  </View>;
}

function VolumeComparisonPhoto({
  comparison,
  tone,
  surfaceColor,
  fadeDirection,
  style,
}: {
  comparison: VolumeComparisonCandidate;
  tone: string;
  surfaceColor: string;
  fadeDirection: 'hero' | 'earned' | 'bottom';
  style?: StyleProp<ViewStyle>;
}) {
  if (!comparison.photoId) return null;
  const photo = volumeAchievementPhoto(comparison.photoId);
  return <View style={[styles.photoFrame, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <ExpoImage source={photo.source} contentFit={photo.fitMode} contentPosition={photo.focalPosition} transition={0} style={[StyleSheet.absoluteFill, { transform: [{ scale: photo.imageScale }] }]} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: SLColors.scrim, opacity: photo.overlayStrength === 'medium' ? 0.38 : 0.24 }]} />
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: surfaceColor },
        fadeDirection === 'hero' ? styles.heroPhotoScrim : fadeDirection === 'earned' ? styles.earnedPhotoScrim : styles.detailPhotoScrim,
      ]}
    />
  </View>;
}

function VolumeScaleLadder({
  progress,
  tone,
  unit,
  contextLabel,
  contextId,
  onSelect,
}: {
  progress: VolumeAchievementProgress;
  tone: string;
  unit: VolumeDisplayUnit;
  contextLabel: string;
  contextId: VolumeAchievementContextId;
  onSelect: (selection: Selection) => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  return <View style={styles.ladder} accessibilityLabel={`${contextLabel} achievement scale`}>
    <View pointerEvents="none" style={styles.ladderLine} />
    {progress.milestones.map((milestone) => {
      const presentation = deriveVolumeComparisonPresentation(milestone, contextId, progress.currentLb);
      const comparison = presentation.comparison;
      const isCurrent = presentation.isCurrentTarget;
      const isAchieved = presentation.isUnlocked;
      const isElite = milestone.importance === 'elite';
      const threshold = formatVolumeLb(milestone.thresholdLb, unit);
      const accessibilityLabel = isAchieved && comparison
        ? `${threshold}, achieved, ${presentation.visibleTitle}`
        : `${threshold}, ${stateLabel(presentation.state)}, ${formatVolumeLb(Math.max(0, milestone.thresholdLb - progress.currentLb), unit)} remaining`;
      return <Pressable
        key={milestone.thresholdLb}
        accessibilityRole={presentation.visibleDetailAccess ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={presentation.visibleDetailAccess ? 'Shows the earned physical scale comparison' : undefined}
        accessibilityState={{ disabled: !presentation.visibleDetailAccess }}
        disabled={!presentation.visibleDetailAccess}
        onPress={() => comparison && onSelect({ contextId, contextLabel, currentLb: progress.currentLb, milestone, tone })}
        style={({ pressed }) => [styles.ladderStop, pressed && styles.pressed]}
      >
        <View style={[
          styles.ladderNode,
          isElite && styles.ladderNodeElite,
          isAchieved && { borderColor: tone, backgroundColor: `${tone}25` },
          isCurrent && { borderColor: tone, backgroundColor: '#111923' },
          !isAchieved && styles.ladderNodeLocked,
        ]}>
          <Ionicons name={stateIcon(presentation.state)} size={isCurrent ? 14 : 12} color={isAchieved || isCurrent ? tone : '#697586'} />
        </View>
        <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9} style={[styles.ladderLabel, compact && styles.ladderLabelCompact, (isAchieved || isCurrent) && { color: '#E8ECF2' }, isCurrent && { color: tone }]}>
          {formatCompactVolumeLb(milestone.thresholdLb, unit)}
        </ThemedText>
      </Pressable>;
    })}
  </View>;
}

function TotalVolumeAchievement({ entry, unit, onSelect }: { entry: VolumeAchievementEntry; unit: VolumeDisplayUnit; onSelect: (selection: Selection) => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const currentLb = entry.current.lb;
  const progress = useMemo(() => deriveVolumeAchievement(currentLb), [currentLb]);
  const earned = progress.achieved;
  const next = progress.next;
  const earnedPresentation = earned ? deriveVolumeComparisonPresentation(earned, entry.id, progress.currentLb) : null;
  const earnedComparison = earnedPresentation?.comparison ?? null;
  const progressPercent = Math.round(progress.segmentProgress * 100);
  const ringSize = compact ? 92 : 104;

  return <View style={[styles.case, styles.totalCase, { borderColor: `${entry.tone}58` }]}>
    <View style={[styles.totalHeroStage, compact && styles.totalHeroStageCompact]}>
      {earnedComparison ? <VolumeComparisonPhoto comparison={earnedComparison} tone={entry.tone} surfaceColor="#07111D" fadeDirection="hero" style={styles.totalBackdrop} /> : null}
      <View style={styles.totalHeader}>
        <View style={styles.totalMetricCopy}>
          <ThemedText style={styles.eyebrow}>{entry.label.toUpperCase()}</ThemedText>
          <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.totalMetric, compact && styles.totalMetricCompact]}>
            {formatVolumeValue(suppliedDisplayValue(entry, unit))} <ThemedText style={styles.totalUnit}>{unit.toUpperCase()}</ThemedText>
          </ThemedText>
          <ThemedText typographyRole="supportingBody" style={styles.totalCaption}>Every recorded rep, accumulated.</ThemedText>
        </View>
        <View
          accessible
          accessibilityLabel={`${progressPercent} percent toward ${next ? formatVolumeLb(next.thresholdLb, unit) : 'the completed milestone ladder'}`}
          style={styles.progressRing}
        >
          <CircularProgress progress={progress.segmentProgress} tone={entry.tone} size={ringSize} />
          <View pointerEvents="none" style={styles.progressRingCopy}>
            <View style={styles.progressRingValueRow}>
              <ThemedText numberOfLines={1} style={[styles.progressRingValue, compact && styles.progressRingValueCompact]}>{progressPercent}</ThemedText>
              <ThemedText numberOfLines={1} style={[styles.progressRingPercent, compact && styles.progressRingPercentCompact]}>%</ThemedText>
            </View>
            {next ? <View style={styles.progressRingTarget}>
              <ThemedText style={styles.progressRingLabel}>TO</ThemedText>
              <ThemedText style={styles.progressRingThreshold}>{formatCompactVolumeLb(next.thresholdLb, unit)}</ThemedText>
            </View> : <ThemedText style={styles.progressRingLabel}>COMPLETE</ThemedText>}
          </View>
        </View>
      </View>

      {earned && earnedComparison ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Latest landmark at ${formatVolumeLb(earned.thresholdLb, unit)}: ${earnedComparison.title}. ${earnedComparison.achievedCopy}`}
        accessibilityHint="Shows the earned comparison details"
        onPress={() => onSelect({ contextId: entry.id, contextLabel: entry.label, currentLb: progress.currentLb, milestone: earned, tone: entry.tone })}
        style={({ pressed }) => [styles.totalLandmark, pressed && styles.pressed]}
      >
        <View style={styles.storyKickerRow}>
          <ThemedText style={[styles.storyEyebrow, { color: entry.tone }]}>LATEST LANDMARK ·</ThemedText>
          <ThemedText style={[styles.storyThreshold, { color: entry.tone }]}>{earned.compactLabel}</ThemedText>
        </View>
        <ThemedText typographyRole="bodyStrong" numberOfLines={2} style={styles.storyTitle}>{earnedPresentation?.visibleTitle ?? earnedComparison.title}</ThemedText>
        <View style={styles.storyBodyRow}>
          <ThemedText typographyRole="supportingBody" numberOfLines={3} style={styles.storyBody}>{earnedComparison.achievedCopy}</ThemedText>
          <Ionicons name="information-circle-outline" size={19} color="#90A1B7" />
        </View>
      </Pressable> : <View accessible accessibilityLabel={`No physical scale earned. First comparison unlocks at ${formatVolumeLb(progress.milestones[0].thresholdLb, unit)}`} style={styles.totalLandmark}>
        <ThemedText style={[styles.storyEyebrow, { color: entry.tone }]}>FIRST PHYSICAL SCALE</ThemedText>
      </View>}
    </View>

    <View style={styles.totalLadder}>
      <VolumeScaleLadder progress={progress} tone={entry.tone} unit={unit} contextId={entry.id} contextLabel={entry.label} onSelect={onSelect} />
    </View>

  </View>;
}

function LiftVolumeAchievement({ entry, totalLb, unit, onSelect }: { entry: VolumeAchievementEntry; totalLb: number; unit: VolumeDisplayUnit; onSelect: (selection: Selection) => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const currentLb = entry.current.lb;
  const progress = useMemo(() => deriveVolumeAchievement(currentLb), [currentLb]);
  const earned = progress.achieved;
  const next = progress.next;
  const earnedPresentation = earned ? deriveVolumeComparisonPresentation(earned, entry.id, progress.currentLb) : null;
  const earnedComparison = earnedPresentation?.comparison ?? null;
  const stepPercent = Math.round(progress.segmentProgress * 100);
  const remainingValue = formatVolumeValue(poundsToDisplayValue(progress.remainingLb, unit));

  if (!(typeof entry.current.lb === 'number' && entry.current.lb > 0)) {
    return <View testID={`${entry.id}-volume-empty-state`} style={[styles.case, styles.liftEmptyCase, { borderColor: `${entry.tone}48` }]}>
      <View style={styles.liftHeader}>
        {entry.iconSource ? <Image source={entry.iconSource} style={styles.liftIcon} resizeMode="contain" /> : null}
        <View style={styles.liftMetricCopy}>
          <ThemedText numberOfLines={1} style={styles.liftName}>{entry.label.toUpperCase()}</ThemedText>
          <ThemedText style={styles.lifetimeLabel}>LIFETIME VOLUME</ThemedText>
          <ThemedText style={styles.liftEmptyValue}>NO VOLUME YET</ThemedText>
        </View>
      </View>
    </View>;
  }

  return <View style={[styles.case, styles.liftCase, { borderColor: `${entry.tone}48` }]}>
    <View style={styles.liftHeader}>
      {entry.iconSource ? <Image source={entry.iconSource} style={styles.liftIcon} resizeMode="contain" /> : null}
      <View style={styles.liftMetricCopy}>
        <ThemedText numberOfLines={1} style={styles.liftName}>{entry.label.toUpperCase()}</ThemedText>
        <ThemedText style={styles.lifetimeLabel}>LIFETIME VOLUME</ThemedText>
        <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={[styles.liftMetric, compact && styles.liftMetricCompact]}>{formatVolumeValue(suppliedDisplayValue(entry, unit))} <ThemedText style={styles.liftUnit}>{unit.toUpperCase()}</ThemedText></ThemedText>
      </View>
      <View style={[styles.sharePill, { borderColor: `${entry.tone}55` }]}>
        <ThemedText style={[styles.shareValue, { color: entry.tone }]}>{volumeSharePercent(entry.current.lb, totalLb)}%</ThemedText>
        <ThemedText style={styles.shareLabel}>OF TOTAL</ThemedText>
      </View>
    </View>

    <View testID={`${entry.id}-earned-next-row`} style={styles.liftStoryRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={earned && earnedComparison ? `Latest earned, ${formatVolumeLb(earned.thresholdLb, unit)}, ${earnedComparison.title}` : 'No lifetime volume landmark earned yet'}
        accessibilityHint={earned ? 'Shows comparison details' : undefined}
        disabled={!earned}
        onPress={() => earned && earnedComparison && onSelect({ contextId: entry.id, contextLabel: entry.label, currentLb: progress.currentLb, milestone: earned, tone: entry.tone })}
        style={({ pressed }) => [styles.earnedLandmark, { borderColor: `${entry.tone}3A` }, pressed && styles.pressed]}
      >
        {earnedComparison ? <VolumeComparisonPhoto comparison={earnedComparison} tone={entry.tone} surfaceColor="#09101A" fadeDirection="earned" style={styles.earnedComparisonPhoto} /> : null}
        <View style={styles.earnedSummaryCopy}>
          <View style={styles.landmarkKickerRow}>
            <ThemedText style={[styles.landmarkKicker, { color: entry.tone }]}>EARNED ·</ThemedText>
            <ThemedText style={[styles.landmarkThreshold, { color: entry.tone }]}>{earned ? formatCompactVolumeLb(earned.thresholdLb, unit) : '—'}</ThemedText>
          </View>
          <ThemedText typographyRole="bodyStrong" numberOfLines={3} style={styles.earnedObject}>{earnedPresentation?.visibleTitle ?? 'First landmark ahead'}</ThemedText>
        </View>
      </Pressable>
      <View
        accessible
        accessibilityLabel={next
          ? `Next physical scale at ${formatVolumeLb(next.thresholdLb, unit)}, locked, ${formatVolumeLb(progress.remainingLb, unit)} remaining`
          : 'All physical scale comparisons earned'}
        style={[styles.landmarkTarget, { borderColor: `${entry.tone}42` }]}
      >
        <View style={styles.targetText}>
          <ThemedText style={[styles.targetLabel, { color: entry.tone }]}>{next ? 'NEXT' : 'COMPLETE'}</ThemedText>
          {next ? <ThemedText style={[styles.targetThreshold, { color: entry.tone }]}>{formatCompactVolumeLb(next.thresholdLb, unit)}</ThemedText> : null}
        </View>
        <View style={styles.targetLock}><Ionicons name={next ? 'lock-closed' : 'checkmark'} size={14} color={next ? '#697586' : entry.tone} /></View>
      </View>
    </View>

    <View style={styles.liftRemainingRow}>
      <View style={styles.progressPhrase}>
        <ThemedText style={styles.progressNumeric}>{stepPercent}%</ThemedText>
        <ThemedText style={styles.progressWords}>OF STEP</ThemedText>
      </View>
      {next ? <View style={[styles.progressPhrase, styles.remainingPhrase]}>
        <ThemedText numberOfLines={1} style={styles.remainingNumeric}>{remainingValue}</ThemedText>
        <ThemedText numberOfLines={1} style={styles.remainingWords}>{unit.toUpperCase()} TO GO</ThemedText>
      </View> : <ThemedText style={styles.allEarned}>ALL EARNED</ThemedText>}
    </View>

    <View style={styles.liftLadder}>
      <VolumeScaleLadder progress={progress} tone={entry.tone} unit={unit} contextId={entry.id} contextLabel={entry.label} onSelect={onSelect} />
    </View>
  </View>;
}

function VolumeMilestoneDetail({ selection, unit, onClose }: { selection: Selection | null; unit: VolumeDisplayUnit; onClose: () => void }) {
  const reduceMotion = useSLReducedMotion();
  const [factRevealed, setFactRevealed] = useState(false);
  const factRevealProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    factRevealProgress.stopAnimation();
    factRevealProgress.setValue(0);
    setFactRevealed(false);
  }, [factRevealProgress, selection?.milestone.thresholdLb]);

  if (!selection) return null;
  const { milestone, tone } = selection;
  const presentation = deriveVolumeComparisonPresentation(milestone, selection.contextId, selection.currentLb);
  const comparison = presentation.comparison;
  if (!presentation.visibleDetailAccess || !comparison) return null;
  const photo = presentation.visibleImage ? volumeAchievementPhoto(presentation.visibleImage) : null;
  const funFact = presentation.visibleFunFact;
  const revealFunFact = () => {
    if (!funFact || factRevealed) return;
    setFactRevealed(true);
    if (reduceMotion) {
      factRevealProgress.setValue(1);
    } else {
      Animated.timing(factRevealProgress, {
        toValue: 1,
        duration: 180,
        easing: SLEasing.enter,
        useNativeDriver: true,
      }).start();
    }
    AccessibilityInfo.announceForAccessibility(`Fun fact. ${funFact.text}`);
  };

  return <Modal transparent visible animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close achievement details" style={styles.modalScrim} onPress={onClose}>
      <Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={[styles.detailSheet, { borderColor: `${tone}55` }]}>
        <View style={styles.detailHandle} />
        <ThemedText style={[styles.detailState, { color: tone }]}>ACHIEVED · {selection.contextLabel.toUpperCase()}</ThemedText>
        <View style={styles.detailPhotoStage}>
          <VolumeComparisonPhoto comparison={comparison} tone={tone} surfaceColor="#111823" fadeDirection="bottom" style={styles.detailPhoto} />
        </View>
        <ThemedText typographyRole="heroNumeric" style={styles.detailThreshold}>{formatVolumeLb(milestone.thresholdLb, unit)}</ThemedText>
        <ThemedText typographyRole="dynamicName" style={styles.detailTitle}>{comparison.title}</ThemedText>
        <ThemedText typographyRole="modalBody" style={styles.detailBody}>{comparison.achievedCopy}</ThemedText>
        <ThemedText typographyRole="supportingBody" style={styles.detailDescription}>{comparison.description}</ThemedText>
        <ThemedText typographyRole="caption" style={styles.detailFact}>{comparison.perspectiveFact}</ThemedText>
        <View style={styles.perspectiveNote}><Ionicons name="resize-outline" size={16} color="#8E9AAC" /><ThemedText typographyRole="caption" style={styles.perspectiveText}>Perspective comparison. Configurations and operating weights vary.</ThemedText></View>
        {funFact ? <View style={[styles.funFactBlock, { borderColor: `${tone}55` }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={factRevealed ? `Fun fact revealed about ${comparison.title}` : `Reveal fun fact about ${comparison.title}`}
            accessibilityHint={factRevealed ? undefined : 'Reveals one short verified fact'}
            accessibilityState={{ expanded: factRevealed, disabled: factRevealed }}
            disabled={factRevealed}
            onPress={revealFunFact}
            style={({ pressed }) => [styles.funFactReveal, pressed && styles.pressed]}
          >
            <View style={[styles.funFactIcon, { borderColor: `${tone}55` }]}><Ionicons name="sparkles-outline" size={15} color={tone} /></View>
            <ThemedText style={[styles.funFactLabel, { color: tone }]}>FUN FACT</ThemedText>
            <ThemedText style={styles.funFactAction}>{factRevealed ? 'REVEALED' : 'REVEAL'}</ThemedText>
            <Ionicons name={factRevealed ? 'checkmark' : 'chevron-down'} size={15} color={factRevealed ? tone : '#7F8C9D'} />
          </Pressable>
          {factRevealed ? <Animated.View
            accessible
            accessibilityLabel={`Fun fact: ${funFact.text}`}
            accessibilityLiveRegion="polite"
            style={[styles.funFactContent, {
              opacity: factRevealProgress,
              transform: [{ translateY: factRevealProgress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
            }]}
          >
            <ThemedText typographyRole="supportingBody" style={styles.funFactText}>{funFact.text}</ThemedText>
          </Animated.View> : null}
        </View> : null}
        {photo ? <ThemedText typographyRole="caption" style={styles.photoCredit}>{photo.creditLine} · {photo.licenseShort}</ThemedText> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={onClose} style={({ pressed }) => [styles.detailClose, { borderColor: tone }, pressed && styles.pressed]}>
          <ThemedText typographyRole="longButtonLabel" style={styles.detailCloseText}>Done</ThemedText>
        </Pressable>
      </Pressable>
    </Pressable>
  </Modal>;
}

export function VolumeAchievementExperience({ data, unit }: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const totalLb = safeVolumeLb(data.total.current.lb);

  return <View style={styles.experience}>
    <TotalVolumeAchievement entry={data.total} unit={unit} onSelect={setSelection} />
    {data.competitionTotal ? <View testID="competition-total-volume" style={styles.competitionTotalCase}>
      <View style={styles.competitionTotalCopy}>
        <ThemedText style={styles.competitionTotalLabel}>{data.competitionTotal.label.toUpperCase()}</ThemedText>
        <ThemedText style={styles.competitionTotalDetail}>GOVERNED SQUAT · BENCH · DEADLIFT</ThemedText>
      </View>
      <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.competitionTotalValue}>
        {typeof data.competitionTotal.current[unit] === 'number'
          ? formatVolumeValue(safeVolumeLb(data.competitionTotal.current[unit]))
          : '—'}{typeof data.competitionTotal.current[unit] === 'number' ? <ThemedText style={styles.competitionTotalUnit}> {unit.toUpperCase()}</ThemedText> : null}
      </ThemedText>
    </View> : null}
    {data.lifts.map((entry) => <LiftVolumeAchievement key={entry.id} entry={entry} totalLb={totalLb} unit={unit} onSelect={setSelection} />)}
    <VolumeMilestoneDetail selection={selection} unit={unit} onClose={() => setSelection(null)} />
  </View>;
}

const styles = StyleSheet.create({
  experience: { gap: SLSpacing.md, paddingBottom: SLSpacing.xxxl + SLSpacing.xxl },
  case: { overflow: 'hidden', borderRadius: 15, borderWidth: 1, backgroundColor: 'transparent', ...SLShadows.level2 },
  totalCase: { paddingBottom: SLSpacing.md, backgroundColor: 'transparent' },
  totalHeroStage: { minHeight: 282, position: 'relative', overflow: 'hidden' },
  totalHeroStageCompact: { minHeight: 278 },
  totalBackdrop: { ...StyleSheet.absoluteFillObject },
  totalHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 15, paddingHorizontal: 15, zIndex: 2 },
  totalMetricCopy: { flex: 1, minWidth: 0, maxWidth: '67%' },
  eyebrow: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 11, lineHeight: 14, color: '#C2CAD6', letterSpacing: 0.7 },
  totalMetric: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 38, lineHeight: 42, letterSpacing: -1.15, color: '#F6F7F9', marginTop: 3 },
  totalMetricCompact: { fontSize: 34, lineHeight: 38 },
  totalUnit: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 15, lineHeight: 19, color: '#E3E7ED', letterSpacing: 0 },
  totalCaption: { fontFamily: SLFontFamilies.body, fontWeight: '400', fontSize: 13, lineHeight: 18, color: '#E0E4E9', marginTop: 2 },
  progressRing: { position: 'absolute', top: 4, right: 4, alignItems: 'center', justifyContent: 'center', opacity: 0.76 },
  progressRingSvg: { position: 'absolute' },
  progressRingCopy: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  progressRingValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  progressRingValue: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 22, lineHeight: 26, color: '#F4F6F8', textAlign: 'center' },
  progressRingValueCompact: { fontSize: 20, lineHeight: 24 },
  progressRingPercent: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 14, lineHeight: 18, color: '#F4F6F8', marginLeft: 1 },
  progressRingPercentCompact: { fontSize: 12, lineHeight: 16 },
  progressRingTarget: { alignItems: 'center', marginTop: 1 },
  progressRingLabel: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', color: '#CAD1DB', fontSize: 8, lineHeight: 10, textAlign: 'center' },
  progressRingThreshold: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', color: '#E4E9F0', fontSize: 9, lineHeight: 11, letterSpacing: -0.15, textAlign: 'center' },
  totalLandmark: { position: 'absolute', left: 15, bottom: 10, width: '53%', minHeight: 88, justifyContent: 'flex-end', zIndex: 2 },
  photoFrame: { overflow: 'hidden', backgroundColor: '#080D15' },
  heroPhotoScrim: { opacity: 0.62 },
  earnedPhotoScrim: { opacity: 0.54 },
  detailPhotoScrim: { opacity: 0.24 },
  storyKickerRow: { flexDirection: 'row', alignItems: 'baseline', gap: SLSpacing.xs },
  storyEyebrow: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: 0.45 },
  storyThreshold: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: -0.12 },
  storyTitle: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 18, lineHeight: 22, color: '#F4F6F8', marginTop: 4 },
  storyBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  storyBody: { fontFamily: SLFontFamilies.body, fontWeight: '400', flex: 1, color: '#D8DDE5', fontSize: 12, lineHeight: 16 },
  totalLadder: { paddingHorizontal: SLSpacing.sm, paddingTop: SLSpacing.sm },
  ladder: { minHeight: 70, flexDirection: 'row', alignItems: 'flex-start', position: 'relative' },
  ladderLine: { position: 'absolute', left: 24, right: 24, top: 18, height: 1, backgroundColor: '#2B3646' },
  ladderStop: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 66, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 1 },
  ladderNode: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.2, borderColor: '#3D4858', backgroundColor: '#111822' },
  ladderNodeElite: { borderRadius: 8, transform: [{ rotate: '45deg' }] },
  ladderNodeLocked: { borderColor: '#283241', backgroundColor: '#0D131B' },
  ladderLabel: { width: '100%', fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: -0.16, color: '#687486', marginTop: 6, textAlign: 'center' },
  ladderLabelCompact: { fontSize: 9, lineHeight: 12, letterSpacing: -0.2 },
  pressed: { opacity: 0.72 },
  liftCase: { minHeight: 270, paddingTop: SLSpacing.sm, paddingBottom: SLSpacing.sm, backgroundColor: 'transparent' },
  liftEmptyCase: { minHeight: 96, paddingVertical: SLSpacing.sm, justifyContent: 'center', backgroundColor: 'transparent' },
  liftHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SLSpacing.md },
  liftIcon: { width: 54, height: 50, marginRight: SLSpacing.sm },
  liftMetricCopy: { flex: 1, minWidth: 0 },
  liftName: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 17, lineHeight: 21, color: '#E9EDF2', letterSpacing: 0.2 },
  lifetimeLabel: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 10, lineHeight: 13, color: '#8D98A8', letterSpacing: 0.45, marginTop: 1 },
  liftMetric: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 28, lineHeight: 32, letterSpacing: -0.7, color: '#F2F4F7', marginTop: 2 },
  liftMetricCompact: { fontSize: 24, lineHeight: 28 },
  liftEmptyValue: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 15, lineHeight: 20, color: '#778293', marginTop: 5, letterSpacing: 0.4 },
  liftUnit: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 13, lineHeight: 17, color: '#B7C0CC' },
  sharePill: { minWidth: 50, alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: SLColors.plane },
  shareValue: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 17, lineHeight: 20, letterSpacing: -0.25 },
  shareLabel: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', color: '#8591A2', fontSize: 8, lineHeight: 10, letterSpacing: 0.2 },
  competitionTotalCase: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.md, paddingVertical: SLSpacing.sm, borderRadius: 15, borderWidth: 1, borderColor: '#304355', backgroundColor: 'transparent' },
  competitionTotalCopy: { flex: 1, minWidth: 0 },
  competitionTotalLabel: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 14, lineHeight: 18, color: '#92CED8', letterSpacing: 0.45 },
  competitionTotalDetail: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 9, lineHeight: 12, color: '#7E8998', marginTop: 3, letterSpacing: 0.35 },
  competitionTotalValue: { maxWidth: '44%', fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 25, lineHeight: 30, color: '#EEF3F5', letterSpacing: -0.6, textAlign: 'right' },
  competitionTotalUnit: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 12, lineHeight: 16, color: '#92CED8' },
  liftStoryRow: { minHeight: 104, flexDirection: 'row', alignItems: 'stretch', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.md, marginTop: SLSpacing.xs },
  earnedLandmark: { flex: 2, flexBasis: 0, minWidth: 0, overflow: 'hidden', position: 'relative', justifyContent: 'center', borderWidth: 1, borderRadius: 10, backgroundColor: '#09101A' },
  landmarkTarget: { flex: 1, flexBasis: 0, minWidth: 0, overflow: 'hidden', position: 'relative', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, padding: SLSpacing.sm, backgroundColor: SLColors.plane },
  earnedComparisonPhoto: { ...StyleSheet.absoluteFillObject },
  earnedSummaryCopy: { width: '68%', minWidth: 0, zIndex: 1, paddingHorizontal: 10, paddingVertical: 10 },
  landmarkKickerRow: { flexDirection: 'row', alignItems: 'baseline', gap: SLSpacing.xs },
  targetText: { flex: 1, minWidth: 0, zIndex: 1 },
  targetLock: { width: 26, height: 26, borderRadius: 13, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C141F', borderWidth: StyleSheet.hairlineWidth, borderColor: '#283648' },
  landmarkKicker: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 10, lineHeight: 13, color: '#7F8B9C', letterSpacing: 0.35 },
  landmarkThreshold: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: -0.12 },
  earnedObject: { color: '#F1F4F7', marginTop: SLSpacing.sm },
  targetLabel: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: 0.42 },
  targetThreshold: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 15, lineHeight: 19, letterSpacing: -0.2, marginTop: SLSpacing.xs },
  liftRemainingRow: { minHeight: 30, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.md, marginTop: SLSpacing.sm },
  progressPhrase: { flexDirection: 'row', alignItems: 'baseline', gap: SLSpacing.xs, minWidth: 0 },
  progressNumeric: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: -0.14, color: '#AEB8C6' },
  progressWords: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: 0.2, color: '#717E90' },
  remainingPhrase: { flex: 1, justifyContent: 'flex-end' },
  remainingNumeric: { flexShrink: 1, fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: -0.14, color: '#D6DCE4', textAlign: 'right' },
  remainingWords: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: 0.16, color: '#8995A5' },
  allEarned: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 10, lineHeight: 13, color: '#D6DCE4' },
  liftLadder: { paddingHorizontal: SLSpacing.sm, marginTop: SLSpacing.xs },
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.74)' },
  detailSheet: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 35, backgroundColor: SLColors.focus, borderTopLeftRadius: SLRadius.radiusSheet, borderTopRightRadius: SLRadius.radiusSheet, borderWidth: 1, ...SLShadows.level3 },
  detailHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#465264', marginBottom: 17 },
  detailState: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: 0.9 },
  detailPhotoStage: { alignSelf: 'stretch', height: 170, overflow: 'hidden', marginHorizontal: -22, marginTop: 12, backgroundColor: '#111823' },
  detailPhoto: { width: '100%', height: '100%' },
  detailThreshold: { fontFamily: SLFontFamilies.numeric, fontWeight: '400', fontSize: 34, lineHeight: 38, color: '#F5F6F8', marginTop: 2 },
  detailTitle: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 20, lineHeight: 25, color: '#ECEFF3', textAlign: 'center', marginTop: 2 },
  detailBody: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 15, lineHeight: 21, color: '#C2CAD5', textAlign: 'center', marginTop: 8 },
  detailDescription: { fontFamily: SLFontFamilies.body, fontWeight: '400', fontSize: 13, lineHeight: 19, color: '#929EAF', textAlign: 'center', marginTop: 5 },
  detailFact: { fontFamily: SLFontFamilies.body, fontWeight: '400', fontSize: 11, color: '#A7B3C2', textAlign: 'center', lineHeight: 16, marginTop: 7, paddingHorizontal: 8 },
  perspectiveNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13, paddingHorizontal: 10 },
  perspectiveText: { fontFamily: SLFontFamilies.body, fontWeight: '400', fontSize: 11, lineHeight: 15, color: '#8591A1', flex: 1 },
  funFactBlock: { width: '100%', overflow: 'hidden', borderWidth: 1, borderRadius: 11, marginTop: 12, backgroundColor: SLColors.object },
  funFactReveal: { minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 8 },
  funFactIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: SLColors.plane },
  funFactLabel: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 10, lineHeight: 13, letterSpacing: 0.78, flex: 1 },
  funFactAction: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400', color: '#7F8C9D', fontSize: 9, lineHeight: 12, letterSpacing: 0.5 },
  funFactContent: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2B3746', paddingHorizontal: 13, paddingTop: 10, paddingBottom: 12 },
  funFactText: { fontFamily: SLFontFamilies.body, fontWeight: '400', fontSize: 13, lineHeight: 18, color: '#D3DAE4', textAlign: 'left' },
  photoCredit: { fontFamily: SLFontFamilies.body, fontWeight: '400', color: '#707D8F', fontSize: 9, lineHeight: 12, textAlign: 'center', marginTop: 7 },
  detailClose: { minWidth: 132, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.pill, marginTop: 18, borderWidth: 1, backgroundColor: SLColors.focus },
  detailCloseText: { fontFamily: SLFontFamilies.bodySemiBold, fontWeight: '400', fontSize: 15, lineHeight: 19, color: SLColors.textPrimary },
});
