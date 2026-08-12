import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLTrophy } from '@/components/ui/sl-trophy';
import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';
import { SLEasing } from '@/lib/motion';
import { useSLMotionPreviewOverrides } from '@/lib/motion-preview';
import { CANONICAL_RECORD_RECOGNITION_MOTION } from '@/lib/recognition-motion-registry';

export type CanonicalRecordRecognitionPhase =
  | '1 · Former best established'
  | '2 · Challenger approaches'
  | '3 · Displacement impact'
  | '4 · Victory moment'
  | '5 · Settle and breathe'
  | '6 · Evidence reveal begins'
  | '7 · Complete comparison'
  | '8 · Final settled state';

type Props = {
  animationKey: number;
  movementLabel: string;
  previousValue: string | null;
  nextValue: string;
  delta: string | null;
  recordTitle: string;
  formerLabel: string;
  newLabel: string;
  evidenceLabel: string;
  accessibilityLabel: string;
  reduceMotion: boolean;
  playbackRate?: number;
  onPhaseChange?: (phase: CanonicalRecordRecognitionPhase) => void;
  onImpact?: () => void;
  onSettle?: () => void;
};

const RAYS = [-72, -48, -24, 0, 24, 48, 72, 90] as const;
const FRAGMENTS = [
  { left: '11%', top: '49%', size: 5, rotation: '-32deg', driftX: -30, driftY: -24 },
  { left: '18%', top: '63%', size: 3, rotation: '24deg', driftX: -20, driftY: 18 },
  { left: '27%', top: '38%', size: 4, rotation: '52deg', driftX: -16, driftY: -31 },
  { left: '36%', top: '69%', size: 5, rotation: '-18deg', driftX: -9, driftY: 24 },
  { left: '47%', top: '33%', size: 3, rotation: '38deg', driftX: 1, driftY: -35 },
  { left: '57%', top: '67%', size: 4, rotation: '64deg', driftX: 11, driftY: 23 },
  { left: '66%', top: '39%', size: 5, rotation: '-42deg', driftX: 18, driftY: -29 },
  { left: '76%', top: '62%', size: 3, rotation: '16deg', driftX: 23, driftY: 17 },
  { left: '84%', top: '47%', size: 4, rotation: '48deg', driftX: 30, driftY: -20 },
  { left: '89%', top: '71%', size: 3, rotation: '-58deg', driftX: 35, driftY: 21 },
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/** The approved Motion Workshop record-takeover choreography, promoted to production. */
export function CanonicalRecordRecognition({
  animationKey,
  movementLabel,
  previousValue,
  nextValue,
  delta,
  recordTitle,
  formerLabel,
  newLabel,
  evidenceLabel,
  accessibilityLabel,
  reduceMotion,
  playbackRate = 1,
  onPhaseChange,
  onImpact,
  onSettle,
}: Props) {
  const previewMotion = useSLMotionPreviewOverrides();
  const motion = { ...CANONICAL_RECORD_RECOGNITION_MOTION, ...previewMotion, spring: previewMotion?.spring ?? CANONICAL_RECORD_RECOGNITION_MOTION.spring };
  const [recordState, setRecordState] = useState<'Current Best' | 'New Best'>('Current Best');
  const oldTranslateY = useRef(new Animated.Value(0)).current;
  const oldScale = useRef(new Animated.Value(0.97)).current;
  const oldOpacity = useRef(new Animated.Value(reduceMotion ? 0 : 1)).current;
  const newTranslateY = useRef(new Animated.Value(130)).current;
  const newScale = useRef(new Animated.Value(0.88)).current;
  const newOpacity = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(reduceMotion ? 0 : 1)).current;
  const heroTranslateY = useRef(new Animated.Value(0)).current;
  const headerTrophyTranslateY = useRef(new Animated.Value(0)).current;
  const headerTrophyScale = useRef(new Animated.Value(1)).current;
  const trophyOpacity = useRef(new Animated.Value(0)).current;
  const trophyTranslateY = useRef(new Animated.Value(14)).current;
  const trophyScale = useRef(new Animated.Value(0.82)).current;
  const bloomOpacity = useRef(new Animated.Value(0)).current;
  const bloomScale = useRef(new Animated.Value(0.62)).current;
  const rayOpacity = useRef(new Animated.Value(0)).current;
  const fragmentOpacity = useRef(new Animated.Value(0)).current;
  const fragmentProgress = useRef(new Animated.Value(0)).current;
  const groundLineOpacity = useRef(new Animated.Value(0)).current;
  const groundLineScale = useRef(new Animated.Value(0.24)).current;
  const surfaceResponse = useRef(new Animated.Value(0)).current;
  const evidenceOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const evidenceTranslateY = useRef(new Animated.Value(reduceMotion ? 0 : 18)).current;
  const evidenceOldOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const evidenceOldTranslateX = useRef(new Animated.Value(reduceMotion ? 0 : -18)).current;
  const evidenceArrowOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const evidenceArrowScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.15)).current;
  const evidenceNewOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const evidenceNewTranslateX = useRef(new Animated.Value(reduceMotion ? 0 : 22)).current;
  const evidenceDetailsOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  const approachDistance = 112 + clamp(motion.distancePx, 0, 40) * 1.5;
  const displacementDistance = 66 + clamp(motion.distancePx, 0, 40);
  const impactScale = clamp(Math.max(1.055, motion.emphasisScale) + clamp(motion.overshootPx, 0, 16) / 160, 1.055, 1.14);
  const celebrationIntensity = clamp(0.72 + (motion.emphasisScale - 0.99) * 2.3 + (motion.spring.stiffness - 185) / 820, 0.62, 1);
  const formerValue = previousValue ?? 'No prior mark';

  useEffect(() => {
    const values = [
      oldTranslateY, oldScale, oldOpacity, newTranslateY, newScale, newOpacity, heroOpacity, heroTranslateY,
      headerTrophyTranslateY, headerTrophyScale, trophyOpacity, trophyTranslateY, trophyScale, bloomOpacity,
      bloomScale, rayOpacity, fragmentOpacity, fragmentProgress, groundLineOpacity, groundLineScale, surfaceResponse,
      evidenceOpacity, evidenceTranslateY, evidenceOldOpacity, evidenceOldTranslateX, evidenceArrowOpacity,
      evidenceArrowScale, evidenceNewOpacity, evidenceNewTranslateX, evidenceDetailsOpacity,
    ];
    values.forEach((value) => value.stopAnimation());
    const timers: ReturnType<typeof setTimeout>[] = [];
    const atRate = (duration: number) => reduceMotion ? 0 : Math.round(duration / Math.max(0.1, playbackRate));
    const phase = (value: CanonicalRecordRecognitionPhase) => onPhaseChange?.(value);

    if (reduceMotion) {
      setRecordState('New Best');
      oldOpacity.setValue(0); newOpacity.setValue(0); heroOpacity.setValue(0);
      headerTrophyTranslateY.setValue(0); headerTrophyScale.setValue(1); trophyOpacity.setValue(0);
      bloomOpacity.setValue(0); rayOpacity.setValue(0); fragmentOpacity.setValue(0); groundLineOpacity.setValue(0);
      surfaceResponse.setValue(0); evidenceOpacity.setValue(1); evidenceTranslateY.setValue(0);
      evidenceOldOpacity.setValue(1); evidenceOldTranslateX.setValue(0); evidenceArrowOpacity.setValue(1);
      evidenceArrowScale.setValue(1); evidenceNewOpacity.setValue(1); evidenceNewTranslateX.setValue(0);
      evidenceDetailsOpacity.setValue(1); phase('8 · Final settled state');
      return undefined;
    }

    setRecordState('Current Best');
    oldTranslateY.setValue(0); oldScale.setValue(0.97); oldOpacity.setValue(1);
    newTranslateY.setValue(approachDistance); newScale.setValue(0.88); newOpacity.setValue(0);
    heroOpacity.setValue(1); heroTranslateY.setValue(0); headerTrophyTranslateY.setValue(0); headerTrophyScale.setValue(1);
    trophyOpacity.setValue(0); trophyTranslateY.setValue(14); trophyScale.setValue(0.82);
    bloomOpacity.setValue(0); bloomScale.setValue(0.62); rayOpacity.setValue(0); fragmentOpacity.setValue(0);
    fragmentProgress.setValue(0); groundLineOpacity.setValue(0); groundLineScale.setValue(0.24); surfaceResponse.setValue(0);
    evidenceOpacity.setValue(0); evidenceTranslateY.setValue(18); evidenceOldOpacity.setValue(0); evidenceOldTranslateX.setValue(-18);
    evidenceArrowOpacity.setValue(0); evidenceArrowScale.setValue(0.15); evidenceNewOpacity.setValue(0);
    evidenceNewTranslateX.setValue(22); evidenceDetailsOpacity.setValue(0); phase('1 · Former best established');

    const establishMs = atRate(Math.max(420, motion.phaseDelayMs));
    const approachMs = atRate(Math.max(180, motion.entranceMs));
    const impactMs = atRate(Math.max(220, motion.spatialMs));
    const victoryMs = atRate(Math.max(170, motion.stateMs));
    const victoryHoldMs = atRate(Math.max(680, motion.phaseDelayMs + motion.stateMs));
    const breatheMs = atRate(Math.max(520, motion.phaseDelayMs));
    const evidenceTransitionMs = atRate(Math.max(220, motion.spatialMs));
    const evidenceStepMs = atRate(Math.max(140, motion.stateMs));
    const evidenceStaggerMs = atRate(Math.max(30, motion.staggerMs));
    const approachAt = establishMs;
    const impactAt = approachAt + approachMs;
    const victoryAt = impactAt + impactMs;
    const breatheAt = victoryAt + victoryMs + victoryHoldMs;
    const evidenceAt = breatheAt + breatheMs;
    const comparisonAt = evidenceAt + evidenceTransitionMs;
    const settledAt = comparisonAt + evidenceStepMs * 3 + evidenceStaggerMs * 2;

    timers.push(setTimeout(() => phase('2 · Challenger approaches'), approachAt));
    timers.push(setTimeout(() => { phase('3 · Displacement impact'); onImpact?.(); }, impactAt));
    timers.push(setTimeout(() => { setRecordState('New Best'); phase('4 · Victory moment'); }, victoryAt));
    timers.push(setTimeout(() => phase('5 · Settle and breathe'), breatheAt));
    timers.push(setTimeout(() => phase('6 · Evidence reveal begins'), evidenceAt));
    timers.push(setTimeout(() => phase('7 · Complete comparison'), comparisonAt));
    timers.push(setTimeout(() => { phase('8 · Final settled state'); onSettle?.(); }, settledAt));

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(oldScale, { toValue: 1, duration: establishMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.delay(establishMs),
      ]),
      Animated.parallel([
        Animated.timing(newOpacity, { toValue: 0.76, duration: Math.max(1, Math.round(approachMs * 0.42)), easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(newTranslateY, { toValue: 52, duration: approachMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(newScale, { toValue: 0.94, duration: approachMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(bloomOpacity, { toValue: 0.24 * celebrationIntensity, duration: approachMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(bloomScale, { toValue: 0.82, duration: approachMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(groundLineOpacity, { toValue: 0.22, duration: approachMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(groundLineScale, { toValue: 0.48, duration: approachMs, easing: SLEasing.enter, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(oldTranslateY, { toValue: -displacementDistance, duration: impactMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(oldScale, { toValue: 0.7, duration: impactMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(oldOpacity, { toValue: 0.34, duration: impactMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(newTranslateY, { toValue: 0, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(newScale, { toValue: impactScale, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(newOpacity, { toValue: 1, duration: Math.max(1, Math.round(impactMs * 0.38)), easing: SLEasing.enter, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(surfaceResponse, { toValue: celebrationIntensity, duration: Math.max(1, Math.round(impactMs * 0.38)), easing: SLEasing.enter, useNativeDriver: true }),
          Animated.timing(surfaceResponse, { toValue: 0.2, duration: Math.max(1, Math.round(impactMs * 0.62)), easing: SLEasing.exit, useNativeDriver: true }),
        ]),
        Animated.timing(bloomOpacity, { toValue: 0.9 * celebrationIntensity, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(bloomScale, { toValue: 1.18, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(rayOpacity, { toValue: 0.78 * celebrationIntensity, duration: Math.max(1, Math.round(impactMs * 0.38)), easing: SLEasing.enter, useNativeDriver: true }),
          Animated.timing(rayOpacity, { toValue: 0.12, duration: Math.max(1, Math.round(impactMs * 0.62)), easing: SLEasing.exit, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(fragmentOpacity, { toValue: 0.92 * celebrationIntensity, duration: Math.max(1, Math.round(impactMs * 0.26)), easing: SLEasing.enter, useNativeDriver: true }),
          Animated.timing(fragmentOpacity, { toValue: 0.58, duration: Math.max(1, Math.round(impactMs * 0.74)), easing: SLEasing.state, useNativeDriver: true }),
        ]),
        Animated.timing(fragmentProgress, { toValue: 1, duration: impactMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(groundLineOpacity, { toValue: 1, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(groundLineScale, { toValue: 1, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.sequence([
          Animated.parallel([
            Animated.timing(headerTrophyTranslateY, { toValue: -3, duration: Math.max(1, Math.round(impactMs * 0.42)), easing: SLEasing.enter, useNativeDriver: true }),
            Animated.timing(headerTrophyScale, { toValue: 1.11, duration: Math.max(1, Math.round(impactMs * 0.42)), easing: SLEasing.enter, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(headerTrophyTranslateY, { toValue: -1, duration: Math.max(1, Math.round(impactMs * 0.58)), easing: SLEasing.state, useNativeDriver: true }),
            Animated.timing(headerTrophyScale, { toValue: 1.03, duration: Math.max(1, Math.round(impactMs * 0.58)), easing: SLEasing.state, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(trophyOpacity, { toValue: 0.34, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(trophyTranslateY, { toValue: 8, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(trophyScale, { toValue: 0.88, duration: impactMs, easing: SLEasing.enter, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(newScale, { toValue: 1, duration: victoryMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(trophyOpacity, { toValue: 1, duration: victoryMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(trophyTranslateY, { toValue: 0, duration: victoryMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(trophyScale, { toValue: 1, duration: victoryMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(headerTrophyTranslateY, { toValue: 0, duration: victoryMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(headerTrophyScale, { toValue: 1, duration: victoryMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(bloomOpacity, { toValue: 0.56 * celebrationIntensity, duration: victoryMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(bloomScale, { toValue: 1, duration: victoryMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(fragmentOpacity, { toValue: 0.3, duration: victoryMs, easing: SLEasing.exit, useNativeDriver: true }),
      ]),
      Animated.delay(victoryHoldMs),
      Animated.parallel([
        Animated.timing(newScale, { toValue: 0.985, duration: breatheMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(fragmentOpacity, { toValue: 0, duration: breatheMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(rayOpacity, { toValue: 0, duration: breatheMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(bloomOpacity, { toValue: 0.18, duration: breatheMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(groundLineOpacity, { toValue: 0.62, duration: breatheMs, easing: SLEasing.state, useNativeDriver: true }),
        Animated.timing(surfaceResponse, { toValue: 0, duration: breatheMs, easing: SLEasing.exit, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 0, duration: evidenceTransitionMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(heroTranslateY, { toValue: -18, duration: evidenceTransitionMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(trophyOpacity, { toValue: 0.16, duration: evidenceTransitionMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(trophyTranslateY, { toValue: -54, duration: evidenceTransitionMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(trophyScale, { toValue: 0.52, duration: evidenceTransitionMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(headerTrophyTranslateY, { toValue: -1, duration: evidenceTransitionMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(headerTrophyScale, { toValue: 1.06, duration: evidenceTransitionMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(bloomOpacity, { toValue: 0, duration: evidenceTransitionMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(groundLineOpacity, { toValue: 0, duration: evidenceTransitionMs, easing: SLEasing.exit, useNativeDriver: true }),
        Animated.timing(evidenceOpacity, { toValue: 1, duration: evidenceTransitionMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(evidenceTranslateY, { toValue: 0, duration: evidenceTransitionMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(evidenceOldOpacity, { toValue: 1, duration: evidenceTransitionMs, easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(evidenceOldTranslateX, { toValue: 0, duration: evidenceTransitionMs, easing: SLEasing.enter, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(evidenceArrowOpacity, { toValue: 1, duration: evidenceStepMs, easing: SLEasing.enter, useNativeDriver: true }),
          Animated.timing(evidenceArrowScale, { toValue: 1, duration: evidenceStepMs, easing: SLEasing.enter, useNativeDriver: true }),
        ]),
        Animated.delay(evidenceStaggerMs),
        Animated.parallel([
          Animated.timing(evidenceNewOpacity, { toValue: 1, duration: evidenceStepMs, easing: SLEasing.enter, useNativeDriver: true }),
          Animated.timing(evidenceNewTranslateX, { toValue: 0, duration: evidenceStepMs, easing: SLEasing.enter, useNativeDriver: true }),
        ]),
        Animated.delay(evidenceStaggerMs),
        Animated.parallel([
          Animated.timing(evidenceDetailsOpacity, { toValue: 1, duration: evidenceStepMs, easing: SLEasing.enter, useNativeDriver: true }),
          Animated.timing(headerTrophyTranslateY, { toValue: 0, duration: evidenceStepMs, easing: SLEasing.state, useNativeDriver: true }),
          Animated.timing(headerTrophyScale, { toValue: 1, duration: evidenceStepMs, easing: SLEasing.state, useNativeDriver: true }),
        ]),
      ]),
    ]);
    animation.start();
    return () => { animation.stop(); timers.forEach(clearTimeout); };
  }, [animationKey, approachDistance, bloomOpacity, bloomScale, celebrationIntensity, displacementDistance, evidenceArrowOpacity, evidenceArrowScale, evidenceDetailsOpacity, evidenceNewOpacity, evidenceNewTranslateX, evidenceOldOpacity, evidenceOldTranslateX, evidenceOpacity, evidenceTranslateY, fragmentOpacity, fragmentProgress, groundLineOpacity, groundLineScale, headerTrophyScale, headerTrophyTranslateY, heroOpacity, heroTranslateY, impactScale, motion.entranceMs, motion.phaseDelayMs, motion.spatialMs, motion.staggerMs, motion.stateMs, newOpacity, newScale, newTranslateY, oldOpacity, oldScale, oldTranslateY, onImpact, onPhaseChange, onSettle, playbackRate, rayOpacity, reduceMotion, surfaceResponse, trophyOpacity, trophyScale, trophyTranslateY]);

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.stage}>
      <LinearGradient colors={['#05040A', '#10091C', '#08060F']} locations={[0, 0.57, 1]} style={StyleSheet.absoluteFillObject} />
      <Animated.View pointerEvents="none" style={[styles.surfaceResponse, { opacity: surfaceResponse }]} />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.movement}>{movementLabel}</Text>
          <View style={styles.recognitionLabel}>
            <Animated.View style={[styles.headerTrophy, { transform: [{ translateY: headerTrophyTranslateY }, { scale: headerTrophyScale }] }]}><SLTrophy size={24} /></Animated.View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.title}>{recordTitle}</Text>
          </View>
        </View>
        <View style={styles.stateBadge}><Text style={styles.stateBadgeText}>{recordState}</Text></View>
      </View>
      <View style={styles.viewport}>
        <Animated.View pointerEvents="none" style={[styles.bloom, { opacity: bloomOpacity, transform: [{ scale: bloomScale }] }]}><View style={styles.bloomOuter} /><View style={styles.bloomCore} /></Animated.View>
        <Animated.View pointerEvents="none" style={[styles.rays, { opacity: rayOpacity }]}>{RAYS.map((rotation) => <View key={rotation} style={[styles.ray, { transform: [{ rotate: `${rotation}deg` }] }]} />)}</Animated.View>
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>{FRAGMENTS.map((fragment, index) => <Animated.View key={`${fragment.left}-${fragment.top}`} style={[styles.fragment, { left: fragment.left, top: fragment.top, width: fragment.size, height: fragment.size * 1.8, opacity: fragmentOpacity, transform: [{ translateX: fragmentProgress.interpolate({ inputRange: [0, 1], outputRange: [0, fragment.driftX] }) }, { translateY: fragmentProgress.interpolate({ inputRange: [0, 1], outputRange: [0, fragment.driftY] }) }, { rotate: fragment.rotation }, { scale: fragmentProgress.interpolate({ inputRange: [0, 1], outputRange: [0.45 + (index % 2) * 0.08, 1] }) }] }]} />)}</View>
        <Animated.View style={[styles.groundLine, { opacity: groundLineOpacity, transform: [{ scaleX: groundLineScale }] }]}><LinearGradient colors={['transparent', '#8F36EC', '#FAF7FF', '#8F36EC', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} /></Animated.View>
        <Animated.View style={[styles.peakScene, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
          <Animated.View style={[styles.victoryTrophy, { opacity: trophyOpacity, transform: [{ translateY: trophyTranslateY }, { scale: trophyScale }] }]}><SLTrophy size={54} /></Animated.View>
          <Animated.View style={[styles.valueGroup, { opacity: oldOpacity, transform: [{ translateY: oldTranslateY }, { scale: oldScale }] }]}><Text adjustsFontSizeToFit numberOfLines={1} style={styles.formerLabel}>{formerLabel}</Text><Animated.Text adjustsFontSizeToFit numberOfLines={1} style={styles.formerValue}>{formerValue}</Animated.Text></Animated.View>
          <Animated.View style={[styles.valueGroup, { opacity: newOpacity, transform: [{ translateY: newTranslateY }, { scale: newScale }] }]}><Text adjustsFontSizeToFit numberOfLines={1} style={styles.newLabel}>{newLabel}</Text><Animated.Text adjustsFontSizeToFit numberOfLines={1} style={styles.winningValue}>{nextValue}</Animated.Text></Animated.View>
        </Animated.View>
        <Animated.View style={[styles.evidence, { opacity: evidenceOpacity, transform: [{ translateY: evidenceTranslateY }] }]}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.evidenceLabel}>{evidenceLabel}</Text>
          <View style={styles.comparison}><Animated.Text adjustsFontSizeToFit numberOfLines={1} style={[styles.comparisonOld, { opacity: evidenceOldOpacity, transform: [{ translateX: evidenceOldTranslateX }] }]}>{formerValue}</Animated.Text><Animated.View style={{ opacity: evidenceArrowOpacity, transform: [{ scaleX: evidenceArrowScale }] }}><Ionicons name="arrow-forward" size={25} color={SLColors.review} /></Animated.View><Animated.Text adjustsFontSizeToFit numberOfLines={1} style={[styles.comparisonNew, { opacity: evidenceNewOpacity, transform: [{ translateX: evidenceNewTranslateX }] }]}>{nextValue}</Animated.Text></View>
          <Animated.View style={[styles.evidenceDetails, { opacity: evidenceDetailsOpacity }]}>{delta ? <Text style={styles.delta}>{delta}</Text> : null}<Text numberOfLines={1} style={styles.evidenceMovement}>{movementLabel}</Text></Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { minHeight: 376, overflow: 'hidden', borderRadius: SLRadius.radiusControl, backgroundColor: '#08060F', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(177, 132, 238, 0.28)' },
  surfaceResponse: { ...StyleSheet.absoluteFillObject, borderRadius: SLRadius.radiusControl, borderWidth: 2, borderColor: 'rgba(192, 111, 255, 0.92)', backgroundColor: 'rgba(116, 43, 184, 0.08)' },
  header: { minHeight: 68, zIndex: 8, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(177, 132, 238, 0.14)' },
  headerCopy: { flex: 1, gap: 6 }, recognitionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 }, headerTrophy: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  title: { ...SLTypography.micro, color: '#BDA0F4', letterSpacing: 1.25 }, movement: { ...SLTypography.caption, color: SLColors.textStrong }, stateBadge: { borderRadius: SLRadius.pill, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(108, 42, 147, 0.3)' }, stateBadgeText: { ...SLTypography.micro, color: '#C8ADF4' },
  viewport: { flex: 1, minHeight: 306, position: 'relative' }, bloom: { position: 'absolute', width: 250, height: 250, left: '50%', top: '50%', marginLeft: -125, marginTop: -125, alignItems: 'center', justifyContent: 'center' }, bloomOuter: { position: 'absolute', width: 238, height: 180, borderRadius: 120, backgroundColor: 'rgba(100, 25, 175, 0.2)', shadowColor: '#A64CFF', shadowOpacity: 0.72, shadowRadius: 32, elevation: 5 }, bloomCore: { width: 142, height: 112, borderRadius: 72, backgroundColor: 'rgba(176, 75, 255, 0.2)', shadowColor: '#D5A2FF', shadowOpacity: 0.64, shadowRadius: 24, elevation: 4 },
  rays: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, ray: { position: 'absolute', width: 214, height: 1, backgroundColor: 'rgba(173, 92, 255, 0.34)' }, fragment: { position: 'absolute', borderRadius: 1, backgroundColor: '#A64CFF', shadowColor: '#B55CFF', shadowOpacity: 0.7, shadowRadius: 4 }, groundLine: { position: 'absolute', zIndex: 3, left: '10%', right: '10%', bottom: 68, height: 3, shadowColor: '#A64CFF', shadowOpacity: 0.92, shadowRadius: 12, elevation: 4 },
  peakScene: { ...StyleSheet.absoluteFillObject, zIndex: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SLSpacing.md }, victoryTrophy: { position: 'absolute', zIndex: 5, top: 18, alignSelf: 'center' }, valueGroup: { position: 'absolute', left: SLSpacing.md, right: SLSpacing.md, alignItems: 'center', justifyContent: 'center' }, formerLabel: { ...SLTypography.micro, color: SLColors.textMuted, letterSpacing: 1.1, marginBottom: 4 }, newLabel: { ...SLTypography.sectionLabel, color: '#C89BFF', letterSpacing: 1.25, marginBottom: 3 }, formerValue: { ...SLTypography.hero, width: '100%', fontSize: 62, lineHeight: 70, color: '#E8E2F1', textAlign: 'center', letterSpacing: -1.2 }, winningValue: { ...SLTypography.hero, width: '100%', fontSize: 78, lineHeight: 86, color: '#FCFAFF', textAlign: 'center', letterSpacing: -2.2, textShadowColor: 'rgba(167, 72, 255, 0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 },
  evidence: { ...StyleSheet.absoluteFillObject, zIndex: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SLSpacing.md }, evidenceLabel: { ...SLTypography.micro, color: SLColors.textSubtle, letterSpacing: 1.1, marginBottom: SLSpacing.md }, comparison: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, comparisonOld: { ...SLTypography.sectionTitle, flexShrink: 1, color: '#777084', fontSize: 29, lineHeight: 36 }, comparisonNew: { ...SLTypography.sectionTitle, flexShrink: 1, color: '#FAF7FF', fontSize: 35, lineHeight: 42, textShadowColor: 'rgba(157, 71, 236, 0.42)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 7 }, evidenceDetails: { alignItems: 'center' }, delta: { ...SLTypography.cardTitle, color: SLColors.success, marginTop: 8 }, evidenceMovement: { ...SLTypography.caption, color: SLColors.textSubtle, marginTop: SLSpacing.lg },
});
