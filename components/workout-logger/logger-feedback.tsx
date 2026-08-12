import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { SLTrophy } from '@/components/ui/sl-trophy';
import { Ionicons } from '@expo/vector-icons';

import {
  isMajorVolumeMilestoneEvent,
  MajorVolumeMilestoneRecognition,
  type MajorVolumeMilestonePhase,
} from '@/components/workout-logger/major-volume-milestone-recognition';
import {
  CanonicalRecordRecognition,
  type CanonicalRecordRecognitionPhase,
} from '@/components/workout-logger/canonical-record-recognition';
import { SLColors, SLIconSize, SLLayout, SLMotion, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
import { feedbackMotionDuration, recognitionPresentation, recognitionVisibleDuration, type LoggerRecognitionEvent } from '@/lib/logger-feedback';
import {
  triggerMajorVolumeMilestoneHaptic,
  triggerRecognitionImpactHaptic,
  triggerRecognitionSettleHaptic,
} from '@/lib/logger-feedback-haptics';
import type { LoggerDisplayUnit } from '@/lib/logger-weight-format';
import { SLEasing } from '@/lib/motion';
import { useSLMotionPreviewOverrides } from '@/lib/motion-preview';
import { recognitionMotionConfig } from '@/lib/recognition-motion-registry';

type LoggerFeedbackSurfaceProps = {
  saveConfirmationVisible: boolean;
  statusMessage?: string | null;
  event: LoggerRecognitionEvent | null;
  secondaryHighlightCount: number;
  reduceMotion: boolean;
  displayUnit: LoggerDisplayUnit;
  onPresentationStarted: (event: LoggerRecognitionEvent) => void;
  onDismissEvent: () => void;
  embedded?: boolean;
  playbackRate?: number;
  onRecognitionPhaseChange?: (phase: RecognitionReplacementPhase) => void;
};

export type RecognitionReplacementPhase =
  | MajorVolumeMilestonePhase
  | CanonicalRecordRecognitionPhase
  | 'Current Best'
  | 'Displacement'
  | 'New Best'
  | 'Evidence'
  | '1 · Former effort'
  | '2 · New attempt'
  | '3 · Better execution takes over'
  | '4 · More efficient'
  | '5 · Victory hold'
  | '6 · Evidence transition'
  | '7 · Final evidence'
  | '8 · Complete';

function atPlaybackRate(duration: number, playbackRate = 1) {
  return Math.max(0, Math.round(duration / Math.max(0.1, playbackRate)));
}

export function FeedbackLifetimeBar({
  animationKey,
  duration,
  reduceMotion,
  playbackRate = 1,
  paused = false,
}: {
  animationKey: string | number | null;
  duration: number;
  reduceMotion: boolean;
  playbackRate?: number;
  paused?: boolean;
}) {
  const lifetimeProgress = useRef(new Animated.Value(1)).current;
  const remainingProgress = useRef(1);
  const previousAnimationKey = useRef<string | number | null>(null);

  useEffect(() => {
    lifetimeProgress.stopAnimation((value) => { remainingProgress.current = value; });
    if (previousAnimationKey.current !== animationKey) {
      previousAnimationKey.current = animationKey;
      remainingProgress.current = 1;
      lifetimeProgress.setValue(1);
    }
    if (animationKey == null || reduceMotion) {
      lifetimeProgress.setValue(1);
      remainingProgress.current = 1;
      return undefined;
    }
    if (paused) return undefined;

    const remaining = animationKey == null ? 1 : remainingProgress.current;
    if (remaining >= 0.999) lifetimeProgress.setValue(1);

    const animation = Animated.timing(lifetimeProgress, {
      toValue: 0,
      duration: atPlaybackRate(duration * remaining, playbackRate),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animationKey, duration, lifetimeProgress, paused, playbackRate, reduceMotion]);

  return (
    <View style={styles.lifetimeTrack} pointerEvents="none">
      <Animated.View
        style={[
          styles.lifetimeFill,
          { width: lifetimeProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

/**
 * Evidence-first record replacement. The outgoing record is deliberately
 * displaced rather than faded so the athlete can see history being revised.
 * The primitive accepts generic record strings so future record types can opt
 * in without changing the recognition lifecycle.
 */
export function RecordReplacementHero({
  animationKey,
  eyebrow,
  movementLabel,
  previousValue,
  nextValue,
  progression,
  delta,
  recordCategory,
  reduceMotion,
  playbackRate = 1,
  onPhaseChange,
  onImpact,
  onSettle,
}: {
  animationKey: number;
  eyebrow: string;
  movementLabel: string;
  previousValue: string | null;
  nextValue: string;
  progression: string | null;
  delta: string | null;
  recordCategory?: string | null;
  reduceMotion: boolean;
  playbackRate?: number;
  onPhaseChange?: (phase: RecognitionReplacementPhase) => void;
  onImpact?: () => void;
  onSettle?: () => void;
}) {
  return (
    <CanonicalRecordRecognition
      animationKey={animationKey}
      movementLabel={movementLabel}
      previousValue={previousValue}
      nextValue={nextValue}
      delta={delta}
      recordTitle={eyebrow}
      formerLabel={recordCategory ? `FORMER ${recordCategory}` : 'CURRENT BEST'}
      newLabel={recordCategory ? `NEW ${recordCategory}` : 'NEW BEST'}
      evidenceLabel={progression || recordCategory || 'RECORD REPLACED'}
      accessibilityLabel={`${eyebrow}. ${movementLabel}. ${previousValue ? `Previous ${previousValue}.` : 'No prior mark.'} New ${nextValue}.`}
      reduceMotion={reduceMotion}
      playbackRate={playbackRate}
      onPhaseChange={onPhaseChange}
      onImpact={onImpact}
      onSettle={onSettle}
    />
  );
}
export function RpeEfficiencyHero({
  animationKey,
  movementLabel,
  workload,
  previousRpe,
  nextRpe,
  delta,
  reduceMotion,
  playbackRate = 1,
  onPhaseChange,
  onImpact,
  onSettle,
}: {
  animationKey: number;
  movementLabel: string;
  workload: string;
  previousRpe: string;
  nextRpe: string;
  delta: string;
  reduceMotion: boolean;
  playbackRate?: number;
  onPhaseChange?: (phase: RecognitionReplacementPhase) => void;
  onImpact?: () => void;
  onSettle?: () => void;
}) {
  const previewMotion = useSLMotionPreviewOverrides();
  const [phaseLabel, setPhaseLabel] = React.useState('FORMER EFFORT');
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const formerOpacity = useRef(new Animated.Value(1)).current;
  const formerTranslateY = useRef(new Animated.Value(0)).current;
  const challengerOpacity = useRef(new Animated.Value(0)).current;
  const challengerTranslateY = useRef(new Animated.Value(96)).current;
  const challengerScale = useRef(new Animated.Value(0.9)).current;
  const atmosphereOpacity = useRef(new Animated.Value(0)).current;
  const groundOpacity = useRef(new Animated.Value(0)).current;
  const groundScale = useRef(new Animated.Value(0.3)).current;
  const trophyTranslateY = useRef(new Animated.Value(0)).current;
  const trophyScale = useRef(new Animated.Value(1)).current;
  const evidenceOpacity = useRef(new Animated.Value(0)).current;
  const evidenceTranslateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const values = [
      heroOpacity, formerOpacity, formerTranslateY, challengerOpacity, challengerTranslateY,
      challengerScale, atmosphereOpacity, groundOpacity, groundScale, trophyTranslateY,
      trophyScale, evidenceOpacity, evidenceTranslateY,
    ];
    values.forEach((value) => value.stopAnimation());
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (reduceMotion) {
      setPhaseLabel('MOVEMENT EFFICIENCY');
      heroOpacity.setValue(0);
      formerOpacity.setValue(0);
      challengerOpacity.setValue(0);
      atmosphereOpacity.setValue(0);
      groundOpacity.setValue(0);
      trophyTranslateY.setValue(0);
      trophyScale.setValue(1);
      evidenceOpacity.setValue(1);
      evidenceTranslateY.setValue(0);
      onPhaseChange?.('8 · Complete');
      return undefined;
    }

    const stateMs = atPlaybackRate(previewMotion?.stateMs ?? SLMotion.stateMs, playbackRate);
    const entranceMs = atPlaybackRate(previewMotion?.entranceMs ?? SLMotion.feedbackEnterMs, playbackRate);
    const spatialMs = atPlaybackRate(previewMotion?.spatialMs ?? SLMotion.componentMs, playbackRate);
    const holdMs = atPlaybackRate(Math.max(520, previewMotion?.phaseDelayMs ?? 520), playbackRate);
    const establishMs = atPlaybackRate(Math.max(420, previewMotion?.phaseDelayMs ?? 420), playbackRate);
    const approachAt = establishMs;
    const displacementAt = approachAt + entranceMs;
    const victoryAt = displacementAt + spatialMs;
    const holdAt = victoryAt + stateMs;
    const transitionAt = holdAt + holdMs;
    const evidenceAt = transitionAt + spatialMs;
    const completeAt = evidenceAt + stateMs;

    setPhaseLabel('FORMER EFFORT');
    heroOpacity.setValue(1);
    formerOpacity.setValue(1);
    formerTranslateY.setValue(0);
    challengerOpacity.setValue(0);
    challengerTranslateY.setValue(96);
    challengerScale.setValue(0.9);
    atmosphereOpacity.setValue(0);
    groundOpacity.setValue(0);
    groundScale.setValue(0.3);
    trophyTranslateY.setValue(0);
    trophyScale.setValue(1);
    evidenceOpacity.setValue(0);
    evidenceTranslateY.setValue(14);
    onPhaseChange?.('1 · Former effort');

    timers.push(setTimeout(() => {
      setPhaseLabel('NEW ATTEMPT');
      onPhaseChange?.('2 · New attempt');
    }, approachAt));
    timers.push(setTimeout(() => {
      onPhaseChange?.('3 · Better execution takes over');
      onImpact?.();
    }, displacementAt));
    timers.push(setTimeout(() => {
      setPhaseLabel('MORE EFFICIENT');
      onPhaseChange?.('4 · More efficient');
    }, victoryAt));
    timers.push(setTimeout(() => onPhaseChange?.('5 · Victory hold'), holdAt));
    timers.push(setTimeout(() => {
      setPhaseLabel('MOVEMENT EFFICIENCY');
      onPhaseChange?.('6 · Evidence transition');
    }, transitionAt));
    timers.push(setTimeout(() => onPhaseChange?.('7 · Final evidence'), evidenceAt));
    timers.push(setTimeout(() => {
      onPhaseChange?.('8 · Complete');
      onSettle?.();
    }, completeAt));

    const sequence = Animated.sequence([
      Animated.delay(establishMs),
      Animated.parallel([
        Animated.timing(challengerOpacity, { toValue: 0.72, duration: entranceMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(challengerTranslateY, { toValue: 44, duration: entranceMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(challengerScale, { toValue: 0.96, duration: entranceMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(atmosphereOpacity, { toValue: 0.2, duration: entranceMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(groundOpacity, { toValue: 0.3, duration: entranceMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(groundScale, { toValue: 0.55, duration: entranceMs, easing: SLEasing.enter, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formerOpacity, { toValue: 0.18, duration: spatialMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(formerTranslateY, { toValue: 76, duration: spatialMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(challengerOpacity, { toValue: 1, duration: stateMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(challengerTranslateY, { toValue: 0, duration: spatialMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(challengerScale, { toValue: 1.055, duration: spatialMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(atmosphereOpacity, { toValue: 0.5, duration: spatialMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(groundOpacity, { toValue: 0.8, duration: spatialMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(groundScale, { toValue: 1, duration: spatialMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.sequence([
          Animated.parallel([
            Animated.timing(trophyTranslateY, { toValue: -3, duration: Math.max(1, Math.round(spatialMs * 0.45)), easing: SLEasing.enter, useNativeDriver: true }),
            Animated.timing(trophyScale, { toValue: 1.08, duration: Math.max(1, Math.round(spatialMs * 0.45)), easing: SLEasing.enter, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(trophyTranslateY, { toValue: 0, duration: Math.max(1, Math.round(spatialMs * 0.55)), easing: SLEasing.state, useNativeDriver: true }),
            Animated.timing(trophyScale, { toValue: 1, duration: Math.max(1, Math.round(spatialMs * 0.55)), easing: SLEasing.state, useNativeDriver: true }),
          ]),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(challengerScale, { toValue: 1, duration: stateMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(atmosphereOpacity, { toValue: 0.28, duration: stateMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(groundOpacity, { toValue: 0.58, duration: stateMs, easing: SLEasing.state, useNativeDriver: true }),
      ]),
      Animated.delay(holdMs),
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 0, duration: spatialMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(atmosphereOpacity, { toValue: 0, duration: spatialMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(groundOpacity, { toValue: 0, duration: spatialMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(evidenceOpacity, { toValue: 1, duration: spatialMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(evidenceTranslateY, { toValue: 0, duration: spatialMs, easing: SLEasing.enter, useNativeDriver: true }),
      ]),
      Animated.delay(stateMs),
    ]);
    sequence.start();
    return () => {
      sequence.stop();
      timers.forEach(clearTimeout);
    };
  }, [animationKey, atmosphereOpacity, challengerOpacity, challengerScale, challengerTranslateY, evidenceOpacity, evidenceTranslateY, formerOpacity, formerTranslateY, groundOpacity, groundScale, heroOpacity, onImpact, onPhaseChange, onSettle, playbackRate, previewMotion?.entranceMs, previewMotion?.phaseDelayMs, previewMotion?.spatialMs, previewMotion?.stateMs, reduceMotion, trophyScale, trophyTranslateY]);

  return (
    <View style={styles.rpeBody}>
      <View style={styles.rpeHeader}>
        <Animated.View style={{ transform: [{ translateY: trophyTranslateY }, { scale: trophyScale }] }}>
          <SLTrophy size={32} />
        </Animated.View>
        <View style={styles.rpeHeaderCopy}>
          <Text style={styles.rpeEyebrow}>{phaseLabel}</Text>
          <Text typographyRole="movementName" style={styles.rpeMovement}>{movementLabel}</Text>
        </View>
      </View>
      <View style={styles.rpeViewport}>
        <Animated.View pointerEvents="none" style={[styles.rpeAtmosphere, { opacity: atmosphereOpacity }]} />
        <Animated.View pointerEvents="none" style={[styles.rpeGroundLine, { opacity: groundOpacity, transform: [{ scaleX: groundScale }] }]} />
        <Animated.View style={[styles.rpeHero, { opacity: heroOpacity }]}>
          <Text style={styles.rpeWorkload}>{workload}</Text>
          <Animated.Text style={[styles.rpeFormer, { opacity: formerOpacity, transform: [{ translateY: formerTranslateY }] }]}>
            {previousRpe}
          </Animated.Text>
          <Animated.Text style={[styles.rpeWinner, { opacity: challengerOpacity, transform: [{ translateY: challengerTranslateY }, { scale: challengerScale }] }]}>
            {nextRpe}
          </Animated.Text>
        </Animated.View>
        <Animated.View style={[styles.rpeEvidence, { opacity: evidenceOpacity, transform: [{ translateY: evidenceTranslateY }] }]}>
          <Text style={styles.rpeEvidenceTitle}>MOVEMENT EFFICIENCY</Text>
          <Text style={styles.rpeEvidenceWorkload}>{workload}</Text>
          <View style={styles.rpeComparison}>
            <Text style={styles.rpeComparisonOld}>{previousRpe}</Text>
            <Text style={styles.rpeArrow}>→</Text>
            <Text style={styles.rpeComparisonNew}>{nextRpe}</Text>
          </View>
          <Text style={styles.rpeDelta}>{delta}</Text>
          <Text style={styles.rpeEvidenceMovement}>{movementLabel}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

function CompletionEvidenceRecognition({
  presentation,
  movementLabel,
}: {
  presentation: NonNullable<ReturnType<typeof recognitionPresentation>>;
  movementLabel?: string | null;
}) {
  return (
    <View style={styles.completionBody} accessibilityLabel={presentation.accessibilityLabel}>
      <View style={styles.completionMark}>
        <Ionicons name="checkmark" size={SLIconSize.prominent} color={SLColors.success} />
      </View>
      <View style={styles.completionCopy}>
        <Text style={styles.completionEyebrow}>{presentation.eyebrow}</Text>
        {movementLabel ? <Text typographyRole="movementName" style={styles.completionMovement}>{movementLabel}</Text> : null}
        <Text style={styles.completionValue}>{presentation.value}</Text>
      </View>
    </View>
  );
}

export function LoggerFeedbackSurface({
  saveConfirmationVisible,
  statusMessage,
  event,
  secondaryHighlightCount,
  reduceMotion,
  displayUnit,
  onPresentationStarted,
  onDismissEvent,
  embedded = false,
  playbackRate = 1,
  onRecognitionPhaseChange,
}: LoggerFeedbackSurfaceProps) {
  const previewMotion = useSLMotionPreviewOverrides();
  const entranceMs = previewMotion?.entranceMs ?? SLMotion.feedbackEnterMs;
  const stateMs = previewMotion?.stateMs ?? SLMotion.stateMs;
  const spatialMs = previewMotion?.spatialMs ?? SLMotion.componentMs;
  const staggerMs = previewMotion?.staggerMs ?? SLMotion.staggerMs;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-SLSpacing.sm)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const valueOpacity = useRef(new Animated.Value(0)).current;
  const evidenceOpacity = useRef(new Animated.Value(0)).current;
  const valueTranslateY = useRef(new Animated.Value(SLSpacing.sm)).current;
  const trophyOpacity = useRef(new Animated.Value(0)).current;
  const trophyScale = useRef(new Animated.Value(0.72)).current;
  const trophyRotate = useRef(new Animated.Value(-1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const surfaceScale = useRef(new Animated.Value(0.985)).current;
  const activeAnimationEventId = useRef<number | null>(null);
  const presentation = useMemo(() => event ? recognitionPresentation(event, displayUnit) : null, [displayUnit, event]);
  const motionConfig = recognitionMotionConfig(event?.event_type);
  const repCount = Number(event?.evidence?.rep_count ?? event?.evidence?.actual_reps ?? String(event?.comparison_bucket || '').replace(/^reps:/, ''));
  const recordCategory = event?.event_type === 'CORE_REP_MAX_PR' && Number.isInteger(repCount) && repCount > 0
    ? `${repCount} REP MAX`
    : null;
  const isStrengthPrReplacement = motionConfig?.primitive === 'record-takeover' && presentation != null;
  const isRpeEfficiency = motionConfig?.primitive === 'movement-efficiency' && presentation != null;
  const isMajorVolumeMilestone = motionConfig?.primitive === 'major-volume' && isMajorVolumeMilestoneEvent(event);
  const isKnownCompletion = motionConfig?.primitive === 'completion-evidence';
  const visible = saveConfirmationVisible || !!statusMessage || !!presentation;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(-SLSpacing.sm);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: atPlaybackRate(feedbackMotionDuration(entranceMs, reduceMotion), playbackRate),
        easing: SLEasing.enter,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: atPlaybackRate(feedbackMotionDuration(entranceMs, reduceMotion), playbackRate),
        easing: SLEasing.enter,
        useNativeDriver: true,
      }),
      Animated.timing(surfaceScale, {
        toValue: 1,
        duration: atPlaybackRate(feedbackMotionDuration(entranceMs, reduceMotion), playbackRate),
        easing: SLEasing.enter,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [entranceMs, opacity, playbackRate, reduceMotion, surfaceScale, translateY, visible]);

  useEffect(() => {
    labelOpacity.stopAnimation();
    valueOpacity.stopAnimation();
    evidenceOpacity.stopAnimation();
    valueTranslateY.stopAnimation();
    trophyOpacity.stopAnimation();
    trophyScale.stopAnimation();
    trophyRotate.stopAnimation();
    contentOpacity.stopAnimation();

    if (!presentation || !event) {
      activeAnimationEventId.current = null;
      trophyOpacity.setValue(0);
      contentOpacity.setValue(1);
      return;
    }

    if (isStrengthPrReplacement || isRpeEfficiency || isMajorVolumeMilestone || isKnownCompletion) {
      activeAnimationEventId.current = event.id;
      trophyOpacity.setValue(0);
      trophyScale.setValue(1);
      trophyRotate.setValue(0);
      contentOpacity.setValue(1);
      labelOpacity.setValue(1);
      valueOpacity.setValue(1);
      evidenceOpacity.setValue(1);
      valueTranslateY.setValue(0);
      return () => {
        activeAnimationEventId.current = null;
      };
    }

    const eventId = event.id;
    activeAnimationEventId.current = eventId;

    if (reduceMotion) {
      labelOpacity.setValue(1);
      valueOpacity.setValue(1);
      evidenceOpacity.setValue(1);
      valueTranslateY.setValue(0);
      trophyOpacity.setValue(0);
      trophyScale.setValue(1);
      trophyRotate.setValue(0);
      contentOpacity.setValue(1);
      return;
    }

    labelOpacity.setValue(0);
    valueOpacity.setValue(0);
    evidenceOpacity.setValue(0);
    valueTranslateY.setValue(SLSpacing.sm);
    trophyOpacity.setValue(1);
    trophyScale.setValue(0.72);
    trophyRotate.setValue(-1);
    contentOpacity.setValue(0);

    const reveal = Animated.sequence([
      Animated.parallel([
        Animated.spring(trophyScale, {
          toValue: 1,
          ...(previewMotion?.spring ?? SLMotion.settleSpring),
          useNativeDriver: true,
        }),
        Animated.timing(trophyRotate, {
          toValue: 0,
          duration: atPlaybackRate(spatialMs, playbackRate),
          easing: SLEasing.enter,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(atPlaybackRate(spatialMs, playbackRate)),
      Animated.parallel([
        Animated.timing(trophyOpacity, {
          toValue: 0,
          duration: atPlaybackRate(stateMs, playbackRate),
          easing: SLEasing.exit,
          useNativeDriver: true,
        }),
        Animated.timing(trophyScale, {
          toValue: 0.82,
          duration: atPlaybackRate(stateMs, playbackRate),
          easing: SLEasing.exit,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: atPlaybackRate(spatialMs, playbackRate),
          easing: SLEasing.enter,
          useNativeDriver: true,
        }),
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: atPlaybackRate(stateMs, playbackRate),
          easing: SLEasing.enter,
          useNativeDriver: true,
        }),
        Animated.timing(valueOpacity, {
          toValue: 1,
          duration: atPlaybackRate(spatialMs, playbackRate),
          easing: SLEasing.enter,
          useNativeDriver: true,
        }),
        Animated.timing(valueTranslateY, {
          toValue: 0,
          duration: atPlaybackRate(spatialMs, playbackRate),
          easing: SLEasing.enter,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(atPlaybackRate(staggerMs, playbackRate)),
      Animated.timing(evidenceOpacity, {
        toValue: 1,
        duration: atPlaybackRate(stateMs, playbackRate),
        easing: SLEasing.enter,
        useNativeDriver: true,
      }),
    ]);
    reveal.start();

    return () => {
      activeAnimationEventId.current = null;
      reveal.stop();
    };
  }, [contentOpacity, evidenceOpacity, event, isKnownCompletion, isMajorVolumeMilestone, isRpeEfficiency, isStrengthPrReplacement, labelOpacity, playbackRate, presentation, previewMotion?.spring, reduceMotion, spatialMs, staggerMs, stateMs, trophyOpacity, trophyRotate, trophyScale, valueOpacity, valueTranslateY]);

  useEffect(() => {
    if (presentation && event) onPresentationStarted(event);
  }, [event, onPresentationStarted, presentation]);

  useEffect(() => {
    if (presentation) AccessibilityInfo.announceForAccessibility(presentation.accessibilityLabel);
    else if (statusMessage) AccessibilityInfo.announceForAccessibility(statusMessage);
    else if (saveConfirmationVisible) AccessibilityInfo.announceForAccessibility('Set logged');
  }, [presentation, saveConfirmationVisible, statusMessage]);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={embedded ? styles.embeddedHost : styles.host}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[styles.surface, { opacity, transform: [{ translateY }, { scale: surfaceScale }] }]}
      >
        {presentation ? (
          <View style={styles.celebrationShell}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dismiss accomplishment"
              hitSlop={SLSpacing.md}
              onPress={onDismissEvent}
              style={styles.dismiss}
            >
              <Ionicons name="close" size={SLIconSize.standard} color={SLColors.textMuted} />
            </TouchableOpacity>

            {!motionConfig ? <Animated.View
              pointerEvents="none"
              style={[
                styles.trophyIntro,
                {
                  opacity: trophyOpacity,
                  transform: [
                    { scale: trophyScale },
                    { rotate: trophyRotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-8deg', '0deg', '8deg'] }) },
                  ],
                },
              ]}
            >
              <View style={styles.trophyIntroMark}>
                <SLTrophy size={72} />
              </View>
              <Text style={styles.trophyIntroLabel}>Achievement unlocked</Text>
            </Animated.View> : null}
            {isMajorVolumeMilestone && event ? (
              <MajorVolumeMilestoneRecognition
                event={event}
                displayUnit={displayUnit}
                reduceMotion={reduceMotion}
                playbackRate={playbackRate}
                onPhaseChange={onRecognitionPhaseChange}
                onImpact={motionConfig.haptics[0] === 'heavy-impact' ? () => { void triggerMajorVolumeMilestoneHaptic(); } : undefined}
              />
            ) : isStrengthPrReplacement && event ? (
              <RecordReplacementHero
                animationKey={event.id}
                eyebrow={presentation.eyebrow}
                movementLabel={event.movement_label || 'Core movement'}
                previousValue={presentation.detail?.replace(/^Previous\s+/, '') ?? null}
                nextValue={presentation.value}
                progression={presentation.progression}
                delta={presentation.delta}
                recordCategory={recordCategory}
                reduceMotion={reduceMotion}
                playbackRate={playbackRate}
                onPhaseChange={onRecognitionPhaseChange}
                onImpact={motionConfig.haptics[0] === 'medium-impact' ? () => { void triggerRecognitionImpactHaptic(); } : undefined}
                onSettle={motionConfig.haptics[1] === 'success-settle' ? () => { void triggerRecognitionSettleHaptic(); } : undefined}
              />
            ) : isRpeEfficiency && event ? (
              <RpeEfficiencyHero
                animationKey={event.id}
                movementLabel={event.movement_label || 'Core movement'}
                workload={presentation.workload ?? presentation.progression ?? 'Matched workload'}
                previousRpe={presentation.detail?.replace(/^Previous\s+/, '') ?? 'Previous effort'}
                nextRpe={presentation.value}
                delta={presentation.delta ?? 'Improved efficiency'}
                reduceMotion={reduceMotion}
                playbackRate={playbackRate}
                onPhaseChange={onRecognitionPhaseChange}
                onImpact={motionConfig.haptics[0] === 'medium-impact' ? () => { void triggerRecognitionImpactHaptic(); } : undefined}
                onSettle={motionConfig.haptics[1] === 'success-settle' ? () => { void triggerRecognitionSettleHaptic(); } : undefined}
              />
            ) : isKnownCompletion || motionConfig ? (
              <CompletionEvidenceRecognition
                presentation={presentation}
                movementLabel={event?.movement_label}
              />
            ) : <Animated.View style={[styles.celebrationBody, { opacity: contentOpacity }]}>
                <Animated.View style={[styles.headerRow, { opacity: labelOpacity }]}>
                  <View style={styles.trophyMark}>
                    <SLTrophy size={40} />
                  </View>
                  <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>{presentation.eyebrow}</Text>
                    <Text typographyRole="movementName" style={styles.movement}>{event?.movement_label}</Text>
                  </View>
                </Animated.View>
                <View style={styles.metricPanel}>
                  <Animated.Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={[styles.primaryValue, { opacity: valueOpacity, transform: [{ translateY: valueTranslateY }] }]}
                  >
                    {presentation.value}
                  </Animated.Text>
                  <Animated.View style={[styles.evidenceRow, { opacity: evidenceOpacity }]}>
                    {presentation.detail ? <Text style={styles.detail}>{presentation.detail}</Text> : null}
                    {presentation.delta ? <Text style={styles.delta}>{presentation.delta}</Text> : null}
                  </Animated.View>
                  {presentation.progression ? (
                    <Animated.Text style={[styles.progression, { opacity: evidenceOpacity }]}>
                      {presentation.progression}
                    </Animated.Text>
                  ) : null}
                  {secondaryHighlightCount > 0 ? (
                    <Animated.Text style={[styles.remaining, { opacity: evidenceOpacity }]}>
                      +{secondaryHighlightCount} more highlight{secondaryHighlightCount === 1 ? '' : 's'}
                    </Animated.Text>
                  ) : null}
                </View>
            </Animated.View>}
            <FeedbackLifetimeBar
              animationKey={event?.id ?? null}
              duration={recognitionVisibleDuration(event)}
              reduceMotion={reduceMotion}
              playbackRate={playbackRate}
            />
          </View>
        ) : (
          <View style={styles.savedRow}>
            <Ionicons name="checkmark" size={SLIconSize.standard} color={SLColors.success} />
            <Text style={styles.savedText}>{statusMessage || 'Set logged'}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = {
  host: {
    position: 'absolute' as const,
    top: SLLayout.feedbackOverlayTop,
    left: SLSpacing.sm,
    right: SLSpacing.sm,
    zIndex: 50,
  },
  embeddedHost: { position: 'relative' as const, zIndex: 1 },
  surface: {
    backgroundColor: SLColors.surfaceCommand,
    borderColor: SLColors.borderSelected,
    borderWidth: 1,
    borderRadius: SLRadius.radiusCard,
    overflow: 'hidden' as const,
    ...SLShadows.card,
  },
  celebrationShell: { minHeight: 206, backgroundColor: SLColors.surfaceCommand },
  trophyIntro: { ...StyleSheet.absoluteFillObject, zIndex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  trophyIntroMark: { width: 84, height: 84, alignItems: 'center' as const, justifyContent: 'center' as const },
  trophyIntroLabel: { ...SLTypography.sectionLabel, color: SLColors.warning, textTransform: 'uppercase' as const, letterSpacing: 1, marginTop: SLSpacing.md },
  celebrationBody: { flex: 1, paddingHorizontal: SLSpacing.lg, paddingTop: SLSpacing.xl, paddingBottom: SLSpacing.lg },
  recordReplacementBody: { flex: 1, paddingHorizontal: SLSpacing.lg, paddingTop: SLSpacing.xl, paddingBottom: SLSpacing.lg },
  savedRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SLSpacing.sm, paddingHorizontal: SLSpacing.lg, paddingVertical: SLSpacing.md },
  savedText: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  completionBody: { minHeight: 206, flexDirection: 'row' as const, alignItems: 'center' as const, gap: SLSpacing.md, paddingHorizontal: SLSpacing.lg, paddingVertical: SLSpacing.xl },
  completionMark: { width: 52, height: 52, borderRadius: 26, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(73, 201, 127, 0.12)', borderWidth: 1, borderColor: 'rgba(73, 201, 127, 0.34)' },
  completionCopy: { flex: 1, gap: SLSpacing.xs },
  completionEyebrow: { ...SLTypography.sectionLabel, color: SLColors.success, textTransform: 'uppercase' as const },
  completionMovement: { ...SLTypography.caption, color: SLColors.textMuted },
  completionValue: { ...SLTypography.sectionTitle, color: SLColors.textStrong },
  headerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingRight: SLSpacing.xl, gap: SLSpacing.md },
  trophyMark: { width: 46, height: 46, alignItems: 'center' as const, justifyContent: 'center' as const },
  headerCopy: { flex: 1 },
  eyebrow: { ...SLTypography.sectionLabel, color: SLColors.review, textTransform: 'uppercase' as const },
  repMaxEyebrow: { ...SLTypography.cardTitle, color: SLColors.review, fontWeight: '700' as const, letterSpacing: 0.9 },
  movement: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: SLSpacing.xs },
  dismiss: { position: 'absolute' as const, zIndex: 2, top: SLSpacing.sm, right: SLSpacing.sm, minWidth: 44, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  metricPanel: { flex: 1, alignItems: 'flex-start' as const, justifyContent: 'center' as const, marginTop: SLSpacing.lg, paddingTop: SLSpacing.md, borderTopWidth: 1, borderTopColor: SLColors.borderSelected },
  recordMetricPanel: { flex: 1, alignItems: 'flex-start' as const, justifyContent: 'center' as const, marginTop: SLSpacing.lg, paddingTop: SLSpacing.md, borderTopWidth: 1, borderTopColor: SLColors.borderSelected },
  recordContextViewport: { height: 22, alignSelf: 'stretch' as const, justifyContent: 'center' as const, marginBottom: SLSpacing.xs },
  recordContext: { ...SLTypography.caption, color: SLColors.textMuted },
  recordContextIncoming: { position: 'absolute' as const, left: 0, color: SLColors.review },
  repMaxRecordContext: { ...SLTypography.label, color: SLColors.textMuted, letterSpacing: 0.7 },
  repMaxRecordContextIncoming: { ...SLTypography.label, color: SLColors.review, letterSpacing: 0.7 },
  recordHeroViewport: { alignSelf: 'stretch' as const, height: 72, justifyContent: 'center' as const, overflow: 'hidden' as const },
  recordHeroValue: { position: 'absolute' as const, left: 0, right: 0 },
  recordHeroIncoming: { position: 'absolute' as const, left: 0, right: 0 },
  recordEvidence: { alignSelf: 'stretch' as const, flexDirection: 'row' as const, alignItems: 'baseline' as const, justifyContent: 'space-between' as const, marginTop: SLSpacing.sm },
  repMaxRecordEvidence: { flexDirection: 'column' as const, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: SLSpacing.lg },
  repMaxEvidenceTitle: { ...SLTypography.sectionTitle, width: '100%' as const, color: SLColors.review, fontWeight: '700' as const, letterSpacing: 1, textAlign: 'center' as const },
  repMaxProgression: { ...SLTypography.cardTitle, width: '100%' as const, color: SLColors.textStrong, textAlign: 'center' as const, marginTop: SLSpacing.md },
  repMaxEvidenceMovement: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: SLSpacing.md, textAlign: 'center' as const },
  rpeBody: { flex: 1, minHeight: 260, backgroundColor: '#000000' },
  rpeHeader: { minHeight: 62, flexDirection: 'row' as const, alignItems: 'center' as const, gap: SLSpacing.sm, paddingHorizontal: SLSpacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(177, 132, 238, 0.14)' },
  rpeHeaderCopy: { flex: 1 },
  rpeEyebrow: { ...SLTypography.sectionLabel, color: '#BDA0F4', letterSpacing: 1.1 },
  rpeMovement: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 3 },
  rpeViewport: { minHeight: 198, position: 'relative' as const, overflow: 'hidden' as const },
  rpeAtmosphere: { position: 'absolute' as const, width: 190, height: 140, left: '50%' as const, top: 24, marginLeft: -95, borderRadius: 95, backgroundColor: 'rgba(100, 25, 175, 0.12)', shadowColor: '#A64CFF', shadowOpacity: 0.24, shadowRadius: 20, elevation: 2 },
  rpeGroundLine: { position: 'absolute' as const, left: '18%' as const, right: '18%' as const, bottom: 24, height: 2, borderRadius: 2, backgroundColor: 'rgba(173, 92, 255, 0.42)', shadowColor: '#A64CFF', shadowOpacity: 0.3, shadowRadius: 7, elevation: 2 },
  rpeHero: { ...StyleSheet.absoluteFillObject, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: SLSpacing.lg },
  rpeWorkload: { ...SLTypography.cardTitle, color: SLColors.textStrong, marginBottom: SLSpacing.sm },
  rpeFormer: { ...SLTypography.hero, position: 'absolute' as const, top: 76, color: '#A9A8B3', fontSize: 58, lineHeight: 66 },
  rpeWinner: { ...SLTypography.hero, color: '#FAF7FF', fontSize: 68, lineHeight: 76, textShadowColor: 'rgba(157, 71, 236, 0.34)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  rpeEvidence: { ...StyleSheet.absoluteFillObject, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: SLSpacing.lg },
  rpeEvidenceTitle: { ...SLTypography.sectionLabel, color: '#BDA0F4', letterSpacing: 1.15 },
  rpeEvidenceWorkload: { ...SLTypography.cardTitle, color: SLColors.textStrong, marginTop: SLSpacing.sm },
  rpeComparison: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: SLSpacing.md, marginTop: SLSpacing.md },
  rpeComparisonOld: { ...SLTypography.sectionTitle, color: '#777985' },
  rpeArrow: { ...SLTypography.sectionTitle, color: '#9D7FC7' },
  rpeComparisonNew: { ...SLTypography.hero, color: '#FAF7FF', fontSize: 44, lineHeight: 50, textShadowColor: 'rgba(157, 71, 236, 0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  rpeDelta: { ...SLTypography.label, color: '#C89BFF', marginTop: SLSpacing.xs },
  rpeEvidenceMovement: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: SLSpacing.sm },
  primaryValue: { ...SLTypography.hero, color: SLColors.textStrong, fontWeight: '400' as const, letterSpacing: -0.6 },
  evidenceRow: { flexDirection: 'row' as const, alignItems: 'baseline' as const, justifyContent: 'space-between' as const, alignSelf: 'stretch' as const, marginTop: SLSpacing.sm },
  detail: { ...SLTypography.caption, color: SLColors.textMuted },
  delta: { ...SLTypography.label, color: SLColors.success },
  progression: { ...SLTypography.caption, color: SLColors.textStrong, marginTop: SLSpacing.sm },
  remaining: { ...SLTypography.micro, color: SLColors.textSubtle, marginTop: SLSpacing.sm },
  lifetimeTrack: { height: 4, backgroundColor: SLColors.borderSubtle },
  lifetimeFill: { height: 4, backgroundColor: SLColors.review },
};
