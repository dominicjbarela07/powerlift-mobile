import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

import { POST_SESSION_LEDGER_ARTWORK } from '@/components/workout-logger/post-session-ledger-ceremony';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLSpacing, SLTypography } from '@/constants/theme';
import type { LoggerRecognitionEvent } from '@/lib/logger-feedback';
import type { LoggerDisplayUnit } from '@/lib/logger-weight-format';
import { majorVolumeMedallionAsset } from '@/lib/major-volume-medallion-assets';
import { SLEasing } from '@/lib/motion';
import { useSLMotionPreviewOverrides } from '@/lib/motion-preview';
import {
  VOLUME_ACHIEVEMENT_THRESHOLDS_LB,
  formatCompactVolumeLb,
  formatVolumeLb,
  formatVolumeValue,
} from '@/lib/volume-achievements';

const KG_PER_LB = 0.45359237;
const MAJOR_VOLUME_TIMING_SCALE = 2;
const MAJOR_VOLUME_SETTLED_HERO_HOLD_MS = 650;
const EARNED_ARTIFACT_PHASE_INDEX = 5;
const MILESTONE_EVENT_TYPES = new Set([
  'CORE_LIFETIME_VOLUME_MILESTONE',
  'TOTAL_LIFETIME_VOLUME_MILESTONE',
]);

export type MajorVolumeMilestonePhase =
  | '1 · Fade to focus'
  | '2 · Landmark system appears'
  | '3 · Accumulation rises'
  | '4 · Threshold crossed'
  | '5 · Landmark becomes hero'
  | '6 · Earned artifact resolves'
  | '7 · Evidence'
  | '8 · Resolve';

export function isMajorVolumeMilestoneEvent(event: LoggerRecognitionEvent | null | undefined) {
  return Boolean(event && MILESTONE_EVENT_TYPES.has(event.event_type));
}

type MilestonePresentation = {
  scope: 'total' | 'lift';
  liftFamily: 'squat' | 'bench' | 'deadlift' | null;
  thresholdLb: number;
  previousTotalKg: number;
  newTotalKg: number;
  accumulatedReps: number;
  nextThresholdLb: number | null;
};

function milestonePresentation(event: LoggerRecognitionEvent): MilestonePresentation {
  const evidence = event.evidence || {};
  const liftFamily = ['squat', 'bench', 'deadlift'].includes(String(evidence.lift_family))
    ? String(evidence.lift_family) as MilestonePresentation['liftFamily']
    : null;
  return {
    scope: evidence.milestone_scope === 'lift' ? 'lift' : 'total',
    liftFamily,
    thresholdLb: Math.max(1, Number(evidence.threshold_lb) || Math.round(Number(event.current_value || 0) / KG_PER_LB)),
    previousTotalKg: Math.max(0, Number(evidence.previous_total_kg ?? event.prior_value) || 0),
    newTotalKg: Math.max(0, Number(evidence.new_total_kg) || Number(event.current_value) || 0),
    accumulatedReps: Math.max(0, Math.round(Number(evidence.accumulated_reps) || 0)),
    nextThresholdLb: Number(evidence.next_threshold_lb) > 0 ? Number(evidence.next_threshold_lb) : null,
  };
}

const LIFT_ACCENT = {
  squat: '#A85CFF',
  bench: '#ED4F91',
  deadlift: '#F05A63',
} as const;

const FRAGMENTS = [
  { left: '13%', top: '30%', rotate: '-22deg' },
  { left: '24%', top: '18%', rotate: '31deg' },
  { left: '73%', top: '20%', rotate: '-37deg' },
  { left: '84%', top: '34%', rotate: '19deg' },
  { left: '18%', top: '68%', rotate: '42deg' },
  { left: '78%', top: '72%', rotate: '-28deg' },
] as const;

export function MajorVolumeMilestoneArtifact({
  thresholdLb,
  unit,
  liftFamily,
  size = 188,
}: {
  thresholdLb: number;
  unit: LoggerDisplayUnit;
  liftFamily: MilestonePresentation['liftFamily'];
  size?: number;
}) {
  const family = liftFamily ?? 'total';
  const threshold = formatCompactVolumeLb(thresholdLb, 'lb');
  return (
    <Image
      accessibilityHint={unit === 'lb' ? undefined : `The surrounding view displays values in ${unit}`}
      accessibilityLabel={`${threshold} pound ${liftFamily ? `${liftFamily} ` : ''}lifetime volume landmark`}
      accessibilityRole="image"
      resizeMode="contain"
      source={majorVolumeMedallionAsset(family, thresholdLb)}
      style={{ width: size, height: size }}
    />
  );
}

export function MajorVolumeMilestoneMark({
  event,
  displayUnit,
  size = 52,
}: {
  event: LoggerRecognitionEvent;
  displayUnit: LoggerDisplayUnit;
  size?: number;
}) {
  const presentation = milestonePresentation(event);
  return (
    <MajorVolumeMilestoneArtifact
      thresholdLb={presentation.thresholdLb}
      unit={displayUnit}
      liftFamily={presentation.liftFamily}
      size={size}
    />
  );
}

export function MajorVolumeMilestoneRecognition({
  event,
  displayUnit,
  reduceMotion,
  playbackRate = 1,
  onPhaseChange,
  onImpact,
}: {
  event: LoggerRecognitionEvent;
  displayUnit: LoggerDisplayUnit;
  reduceMotion: boolean;
  playbackRate?: number;
  onPhaseChange?: (phase: MajorVolumeMilestonePhase) => void;
  onImpact?: () => void;
}) {
  const previewMotion = useSLMotionPreviewOverrides();
  const presentation = useMemo(() => milestonePresentation(event), [event]);
  const accent = presentation.liftFamily ? LIFT_ACCENT[presentation.liftFamily] : '#D9A84D';
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [risingTotalKg, setRisingTotalKg] = useState(presentation.previousTotalKg);

  const phaseDurations = useMemo(() => {
    const entrance = previewMotion?.entranceMs ?? 360;
    const state = previewMotion?.stateMs ?? 300;
    const spatial = previewMotion?.spatialMs ?? 520;
    const hold = previewMotion?.phaseDelayMs ?? 680;
    const rate = Math.max(0.1, playbackRate);
    return [
      entrance,
      spatial,
      Math.max(spatial, hold),
      spatial,
      Math.max(state, 380),
      spatial,
      hold,
      state,
    ].map((value) => Math.max(1, Math.round((value * MAJOR_VOLUME_TIMING_SCALE) / rate)));
  }, [playbackRate, previewMotion?.entranceMs, previewMotion?.phaseDelayMs, previewMotion?.spatialMs, previewMotion?.stateMs]);
  const settledHeroHoldMs = Math.max(
    1,
    Math.round(MAJOR_VOLUME_SETTLED_HERO_HOLD_MS / Math.max(0.1, playbackRate)),
  );

  useEffect(() => {
    progress.stopAnimation();
    setRisingTotalKg(presentation.previousTotalKg);
    if (reduceMotion) {
      progress.setValue(1);
      onPhaseChange?.('8 · Resolve');
      onImpact?.();
      return undefined;
    }
    progress.setValue(0);
    const phases: MajorVolumeMilestonePhase[] = [
      '1 · Fade to focus',
      '2 · Landmark system appears',
      '3 · Accumulation rises',
      '4 · Threshold crossed',
      '5 · Landmark becomes hero',
      '6 · Earned artifact resolves',
      '7 · Evidence',
      '8 · Resolve',
    ];
    const stops = [0.1, 0.22, 0.39, 0.51, 0.63, 0.76, 0.9, 1];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    phases.forEach((phase, index) => {
      timers.push(setTimeout(() => {
        onPhaseChange?.(phase);
        if (index === 3) onImpact?.();
      }, elapsed));
      elapsed += phaseDurations[index];
      if (index === EARNED_ARTIFACT_PHASE_INDEX) elapsed += settledHeroHoldMs;
    });
    let lastTallyUpdateAt = 0;
    const listener = progress.addListener(({ value }) => {
      const accumulationProgress = Math.max(0, Math.min(1, (value - 0.22) / (0.51 - 0.22)));
      const now = Date.now();
      if (accumulationProgress < 1 && now - lastTallyUpdateAt < 50) return;
      lastTallyUpdateAt = now;
      const thresholdKg = presentation.thresholdLb * KG_PER_LB;
      setRisingTotalKg(presentation.previousTotalKg + (thresholdKg - presentation.previousTotalKg) * accumulationProgress);
    });
    const animation = Animated.sequence(stops.flatMap((toValue, index) => [
      Animated.timing(progress, {
        toValue,
        duration: phaseDurations[index],
        easing: index === 3 ? SLEasing.state : SLEasing.enter,
        useNativeDriver: true,
      }),
      ...(index === EARNED_ARTIFACT_PHASE_INDEX ? [Animated.delay(settledHeroHoldMs)] : []),
    ]));
    animation.start();
    return () => {
      animation.stop();
      progress.removeListener(listener);
      timers.forEach(clearTimeout);
    };
  }, [event.id, onImpact, onPhaseChange, phaseDurations, presentation.previousTotalKg, presentation.thresholdLb, progress, reduceMotion, settledHeroHoldMs]);

  const ledgerOpacity = progress.interpolate({ inputRange: [0, 0.1, 0.22, 0.63, 0.9, 1], outputRange: [0, 0.2, 0.72, 0.32, 0.1, 0] });
  const systemOpacity = progress.interpolate({ inputRange: [0, 0.1, 0.22, 0.51, 0.63], outputRange: [0, 0, 1, 1, 0] });
  const systemTranslate = progress.interpolate({ inputRange: [0, 0.22, 0.51], outputRange: [SLSpacing.lg, 0, -SLSpacing.sm] });
  const railScale = progress.interpolate({ inputRange: [0, 0.22, 0.51, 1], outputRange: [0, 0, 1, 1] });
  const impactOpacity = progress.interpolate({ inputRange: [0, 0.45, 0.51, 0.63, 1], outputRange: [0, 0, 1, 0.28, 0] });
  const artifactOpacity = progress.interpolate({ inputRange: [0, 0.51, 0.63, 0.76, 0.9, 1], outputRange: [0, 0, 0.35, 1, 0.22, 0] });
  const artifactScale = progress.interpolate({ inputRange: [0, 0.51, 0.63, 0.76, 1], outputRange: [0.72, 0.72, 1.08, 1, 0.76] });
  const heroOpacity = progress.interpolate({ inputRange: [0, 0.51, 0.63, 0.76, 0.9], outputRange: [0, 0, 1, 1, 0] });
  const evidenceOpacity = progress.interpolate({ inputRange: [0, 0.76, 0.9, 1], outputRange: [0, 0, 1, 1] });
  const evidenceTranslate = progress.interpolate({ inputRange: [0, 0.76, 1], outputRange: [SLSpacing.lg, SLSpacing.lg, 0] });
  const fragmentOpacity = reduceMotion ? 0 : progress.interpolate({ inputRange: [0, 0.48, 0.53, 0.72, 1], outputRange: [0, 0, 0.7, 0, 0] });
  const thresholdLabel = formatCompactVolumeLb(presentation.thresholdLb, displayUnit);
  const risingDisplay = displayUnit === 'kg' ? risingTotalKg : risingTotalKg / KG_PER_LB;
  const exactDisplay = displayUnit === 'kg' ? presentation.newTotalKg : presentation.newTotalKg / KG_PER_LB;
  const liftLabel = presentation.liftFamily?.toUpperCase() || null;
  const landmarkTitle = liftLabel ? `${liftLabel} LANDMARK` : 'MAJOR LANDMARK';
  const volumeLabel = liftLabel ? `LIFETIME ${liftLabel} VOLUME` : 'LIFETIME VOLUME';

  return (
    <View
      accessible
      accessibilityLabel={`${landmarkTitle}. ${thresholdLabel} ${displayUnit}. ${volumeLabel}. ${formatVolumeValue(exactDisplay)} ${displayUnit} accumulated. ${presentation.accumulatedReps} reps.`}
      style={styles.stage}
    >
      <ExpoLinearGradient colors={['#000000', '#08030F', '#000000']} style={StyleSheet.absoluteFillObject} />
      <Animated.View pointerEvents="none" style={[styles.impactBloom, { opacity: impactOpacity }]} />
      <Animated.Image source={POST_SESSION_LEDGER_ARTWORK} resizeMode="contain" style={[styles.ledger, { opacity: ledgerOpacity }]} />

      <Animated.View style={[styles.system, { opacity: systemOpacity, transform: [{ translateY: systemTranslate }] }]}>
        <Text style={[styles.scopeLabel, { color: accent }]}>{liftLabel || 'LIFETIME VOLUME'}</Text>
        <Text style={styles.runningValue}>{formatVolumeValue(risingDisplay)} <Text style={styles.runningUnit}>{displayUnit.toUpperCase()}</Text></Text>
        <View style={styles.rail}>
          <Animated.View style={[styles.railEnergy, { backgroundColor: accent, transform: [{ scaleX: railScale }] }]} />
          {VOLUME_ACHIEVEMENT_THRESHOLDS_LB.map((threshold) => {
            const current = threshold === presentation.thresholdLb;
            const achieved = threshold <= presentation.thresholdLb;
            return (
              <View key={threshold} style={styles.railStop}>
                <View style={[styles.railNode, achieved && { borderColor: accent }, current && styles.railNodeCurrent]} />
                <Text style={[styles.railLabel, current && { color: '#F5C873' }]}>{formatCompactVolumeLb(threshold, displayUnit)}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fragments, { opacity: fragmentOpacity }]}>
        {FRAGMENTS.map((fragment) => <View key={`${fragment.left}-${fragment.top}`} style={[styles.fragment, { left: fragment.left, top: fragment.top, backgroundColor: accent, transform: [{ rotate: fragment.rotate }] }]} />)}
      </Animated.View>

      <Animated.View style={[styles.hero, { opacity: heroOpacity }]}>
        <Text style={styles.heroEyebrow}>{landmarkTitle}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroThreshold}>{thresholdLabel} <Text style={styles.heroUnit}>{displayUnit.toUpperCase()}</Text></Text>
        <Text style={styles.heroVolumeLabel}>{volumeLabel}</Text>
      </Animated.View>

      <Animated.View style={[styles.artifact, { opacity: artifactOpacity, transform: [{ scale: artifactScale }] }]}>
        <MajorVolumeMilestoneArtifact
          thresholdLb={presentation.thresholdLb}
          unit={displayUnit}
          liftFamily={presentation.liftFamily}
        />
      </Animated.View>

      <Animated.View style={[styles.evidence, { opacity: evidenceOpacity, transform: [{ translateY: evidenceTranslate }] }]}>
        <View style={styles.evidenceArtifact}>
          <MajorVolumeMilestoneArtifact
            thresholdLb={presentation.thresholdLb}
            unit={displayUnit}
            liftFamily={presentation.liftFamily}
            size={76}
          />
        </View>
        <Text style={[styles.evidenceKicker, { color: accent }]}>{landmarkTitle}</Text>
        <Text style={styles.evidenceThreshold}>{thresholdLabel} <Text style={styles.evidenceUnit}>{displayUnit.toUpperCase()}</Text></Text>
        <Text style={styles.evidenceLabel}>{volumeLabel}</Text>
        <View style={styles.evidencePanel}>
          <Text style={styles.evidenceLine}>{formatVolumeValue(exactDisplay)} {displayUnit.toUpperCase()} {presentation.scope === 'total' ? 'recorded' : 'accumulated'}</Text>
          <Text style={styles.evidenceLine}>{presentation.accumulatedReps.toLocaleString('en-US')} {presentation.liftFamily ? `${presentation.liftFamily} ` : ''}reps accumulated</Text>
          {presentation.nextThresholdLb ? (
            <View style={styles.nextRow}>
              <Text style={styles.nextLabel}>NEXT LANDMARK</Text>
              <Text style={styles.nextValue}>{formatVolumeLb(presentation.nextThresholdLb, displayUnit)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.evidenceRail}>
          {VOLUME_ACHIEVEMENT_THRESHOLDS_LB.map((threshold) => (
            <View key={threshold} style={styles.evidenceRailStop}>
              <View
                style={[
                  styles.evidenceRailNode,
                  threshold <= presentation.thresholdLb && { backgroundColor: accent, borderColor: accent },
                ]}
              />
              <Text style={styles.evidenceRailLabel}>{formatCompactVolumeLb(threshold, displayUnit)}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: '#000000',
    minHeight: 520,
    overflow: 'hidden',
    position: 'relative',
  },
  ledger: {
    height: 250,
    left: '50%',
    marginLeft: -125,
    position: 'absolute',
    top: 88,
    width: 250,
  },
  impactBloom: {
    alignSelf: 'center',
    backgroundColor: 'rgba(157, 70, 255, 0.25)',
    borderRadius: 160,
    height: 320,
    position: 'absolute',
    shadowColor: '#B15CFF',
    shadowOpacity: 0.8,
    shadowRadius: 38,
    top: 92,
    width: 320,
  },
  system: {
    left: SLSpacing.lg,
    position: 'absolute',
    right: SLSpacing.lg,
    top: 90,
  },
  scopeLabel: {
    ...SLTypography.sectionLabel,
    letterSpacing: 1,
    textAlign: 'center',
  },
  runningValue: {
    ...SLTypography.hero,
    color: SLColors.textStrong,
    fontSize: 39,
    lineHeight: 46,
    marginTop: SLSpacing.sm,
    textAlign: 'center',
  },
  runningUnit: {
    ...SLTypography.label,
    color: '#E5BD70',
  },
  rail: {
    flexDirection: 'row',
    height: 62,
    marginTop: SLSpacing.xl,
    position: 'relative',
  },
  railEnergy: {
    height: 2,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 11,
  },
  railStop: {
    alignItems: 'center',
    flex: 1,
  },
  railNode: {
    backgroundColor: '#090A0F',
    borderColor: '#394253',
    borderRadius: 8,
    borderWidth: 1.5,
    height: 16,
    width: 16,
  },
  railNodeCurrent: {
    backgroundColor: '#F0B85A',
    borderColor: '#FFF0B7',
    shadowColor: '#F2BE62',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  railLabel: {
    ...SLTypography.micro,
    color: '#707988',
    fontSize: 8,
    marginTop: 6,
  },
  fragments: {
    ...StyleSheet.absoluteFillObject,
  },
  fragment: {
    height: 13,
    position: 'absolute',
    width: 4,
  },
  hero: {
    alignItems: 'center',
    left: SLSpacing.lg,
    position: 'absolute',
    right: SLSpacing.lg,
    top: 76,
  },
  heroEyebrow: {
    ...SLTypography.sectionLabel,
    color: '#F2C77A',
    letterSpacing: 1,
  },
  heroThreshold: {
    ...SLTypography.hero,
    color: '#F5CB78',
    fontSize: 62,
    lineHeight: 70,
    marginTop: SLSpacing.xs,
    textAlign: 'center',
  },
  heroUnit: {
    ...SLTypography.cardTitle,
    color: '#F4DEAA',
  },
  heroVolumeLabel: {
    ...SLTypography.label,
    color: SLColors.textStrong,
    letterSpacing: 1.2,
  },
  artifact: {
    alignSelf: 'center',
    position: 'absolute',
    top: 205,
  },
  evidence: {
    alignItems: 'center',
    left: SLSpacing.lg,
    position: 'absolute',
    right: SLSpacing.lg,
    top: 48,
  },
  evidenceArtifact: {
    height: 76,
    marginBottom: SLSpacing.sm,
    width: 76,
  },
  evidenceKicker: {
    ...SLTypography.sectionLabel,
    letterSpacing: 1,
  },
  evidenceThreshold: {
    ...SLTypography.hero,
    color: '#F1C675',
    fontSize: 44,
    lineHeight: 50,
    marginTop: 2,
  },
  evidenceUnit: {
    ...SLTypography.label,
    color: '#E9D5A9',
  },
  evidenceLabel: {
    ...SLTypography.label,
    color: SLColors.textStrong,
    letterSpacing: 1,
  },
  evidencePanel: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(16, 11, 22, 0.92)',
    borderColor: 'rgba(222, 183, 105, 0.32)',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: SLSpacing.xl,
    padding: SLSpacing.lg,
  },
  evidenceLine: {
    ...SLTypography.body,
    color: SLColors.textStrong,
    marginBottom: SLSpacing.xs,
  },
  evidenceRail: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    marginTop: SLSpacing.lg,
  },
  evidenceRailStop: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  evidenceRailNode: {
    backgroundColor: '#07080C',
    borderColor: '#364052',
    borderRadius: 5,
    borderWidth: 1,
    height: 10,
    width: 10,
  },
  evidenceRailLabel: {
    ...SLTypography.micro,
    color: SLColors.textSubtle,
    fontSize: 7,
  },
  nextRow: {
    borderTopColor: SLColors.borderSubtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SLSpacing.md,
    paddingTop: SLSpacing.md,
  },
  nextLabel: {
    ...SLTypography.micro,
    color: SLColors.textMuted,
    letterSpacing: 0.8,
  },
  nextValue: {
    ...SLTypography.bodyStrong,
    color: '#F1C675',
  },
});
