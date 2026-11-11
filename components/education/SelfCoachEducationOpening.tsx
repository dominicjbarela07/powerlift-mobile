import { educationImage } from '@/lib/mobile-education-images';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/sl-text';
import { AnalyticalHistoryChart } from '@/components/movement-history/AnalyticalHistoryChart';
import type { CanonicalHistoryPoint } from '@/lib/canonical-movement-history';
import { SLFontFamilies } from '@/constants/theme';
const HERO_ART = educationImage('self-coach-hero-20261001.png');

const SCENES = [
  {
    location: 'TRAIN',
    title: 'Start with any exercise.',
    instruction: 'Tap Start session in Train. Search for an exercise, tap Add, then enter your weight and reps.',
    example: 'EXAMPLE · YOUR FIRST SESSION',
  },
  {
    location: 'YOUR SESSION',
    title: 'Log it. Keep moving.',
    instruction: 'Save set records your work. Tap a saved set to edit it, or use Add set and Add exercise as you train. Finish saves the session, with Save as routine ready afterward.',
    example: 'ILLUSTRATIVE EXAMPLE · SET ENTRY',
  },
  {
    location: 'PROGRESS → THE LEDGER',
    title: 'Review your progress.',
    instruction: 'Open Progress to reach The Ledger. Choose a movement to see your saved sets, original sessions and performance over time.',
    example: 'EXAMPLE · SIX WEEKS OF PROGRESS',
  },
] as const;

export function SelfCoachEducationExperience({
  step,
  onNext,
  onBack,
  onClose,
  onGoToday,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onGoToday: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const artEntrance = useRef(new Animated.Value(0)).current;
  const isOpening = step < 0;
  const scene = isOpening ? null : SCENES[Math.min(step, SCENES.length - 1)];
  const artHeight = Math.min(width * 1.5, height * 0.76);

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [opacity, step]);

  useEffect(() => {
    if (!isOpening) return;
    artEntrance.setValue(0);
    Animated.timing(artEntrance, {
      toValue: 1,
      duration: 780,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [artEntrance, isOpening]);

  return <View style={[styles.root, isOpening && styles.openingRoot]}>
    <View style={[styles.mast, isOpening && styles.openingMast, { paddingTop: Math.max(insets.top, 20) + 10 }]}>
      {!isOpening && <Text style={styles.sceneProgress}>{String(step + 1).padStart(2, '0')} / 03</Text>}
      <Pressable accessibilityLabel="Skip introduction" accessibilityRole="button" hitSlop={12} onPress={onClose} style={styles.close}>
        <Ionicons color="#D1C7D9" name="close" size={25} />
      </Pressable>
    </View>

    <Animated.View style={[styles.main, { opacity }]}>
      {isOpening ? <>
        <Animated.Image
          accessible={false}
          source={HERO_ART}
          resizeMode="cover"
          style={[
            styles.heroArt,
            {
              width,
              height: artHeight,
              left: 0,
              top: -Math.min(height * 0.06, 60),
              opacity: artEntrance,
              transform: [
                { translateY: artEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                { scale: artEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            },
          ]}
        />
        <LinearGradient
          colors={['transparent', 'transparent', '#000', '#000']}
          locations={[0, 0.4, 0.77, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.openingSpace} />
        <View style={styles.openingCopy}>
          <Text style={styles.version}>3.0</Text>
          <Text style={styles.openingTitle}>Your training comes first.</Text>
        </View>
      </> : scene && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lessonContent}>
        <View style={styles.sceneHeading}>
          <Text style={styles.location}>{scene.location}</Text>
          <Text accessibilityRole="header" style={[styles.sceneTitle, { fontSize: Math.min(34, width * 0.081), lineHeight: Math.min(39, width * 0.093) }]}>{scene.title}</Text>
          <Text style={styles.instruction}>{scene.instruction}</Text>
        </View>
        <View style={styles.example}>
          <Text style={styles.exampleLabel}>{scene.example}</Text>
          {step === 0 ? <View style={styles.quickExample} accessible accessibilityRole="image" accessibilityLabel="Start session, add an exercise, enter your first set.">
            <View style={styles.exampleAction}><Ionicons name="barbell-outline" size={23} color="#170D25" /><Text style={styles.exampleActionText}>Start session</Text><Ionicons name="arrow-forward" size={20} color="#170D25" /></View>
            <Text style={styles.quickStep}>01  Choose an exercise</Text><Text style={styles.quickStep}>02  Enter weight and reps</Text><Text style={styles.quickStep}>03  Save set</Text>
          </View> : step === 1 ? <View style={styles.quickExample} accessible accessibilityRole="image" accessibilityLabel="Illustrative set. 100 pounds for 5 reps, saved. Add set is below it.">
            <Text style={styles.quickExercise}>Competition Bench</Text><View style={styles.exampleSet}><Text style={styles.quickStep}>1</Text><Text style={styles.quickStep}>100 lb × 5</Text><Ionicons name="checkmark-circle" color="#96D9AE" size={24} /></View>
            <View style={styles.exampleSet}><Ionicons name="add" color="#C09AF6" size={21} /><Text style={styles.quickStep}>Add set</Text></View>
          </View> : <EducationHistoryExample />}
        </View>
      </ScrollView>}

    </Animated.View>

    <View style={[styles.footer, isOpening ? styles.openingFooter : styles.lessonFooter, { paddingBottom: Math.max(insets.bottom, 14) + 55 }]}>
      {!isOpening && <Pressable accessibilityRole="button" onPress={onBack} style={styles.lessonBack}>
        <Text style={styles.secondaryText}>Back</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => [styles.primary, !isOpening && styles.lessonPrimary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{isOpening ? 'Show me how' : step === 2 ? 'Go to Train' : 'Continue'}</Text>
        <Ionicons color="#FFF" name="arrow-forward" size={20} />
      </Pressable>
      {isOpening && <Pressable accessibilityRole="button" onPress={onGoToday} style={styles.secondary}>
        <Text style={styles.secondaryText}>Go to Train</Text>
      </Pressable>}
    </View>
  </View>;
}

// Illustrative examples live only in Education. They never enter account history.
const EXAMPLE_HISTORY: CanonicalHistoryPoint[] = [
  ['2026-08-24', 285, 340], ['2026-08-31', 290, 346],
  ['2026-09-07', 295, 351], ['2026-09-14', 295, 353],
  ['2026-09-21', 300, 358], ['2026-09-28', 305, 363],
].map(([date, weight, strength], index) => ({
  exposure_id: `education-example-${index}`, workout_id: -1,
  equipment: { id: -1, key: 'education-barbell', label: 'Barbell' },
  date: String(date), weight_kg: Number(weight) / 2.20462262185, strength_metric_kg: Number(strength) / 2.20462262185, reps: 5, rpe: 8,
}));

function EducationHistoryExample() {
  return <View style={styles.historyExample}>
    <Text style={styles.historyTitle}>Competition Squat</Text>
    <Text style={styles.historySubtitle}>Estimated strength · 6 exposures</Text>
    <View pointerEvents="none"><AnalyticalHistoryChart points={EXAMPLE_HISTORY} metric="strength" metricLabel="e1RM" unit="lb" color="#B678F2" onOpenExposure={() => {}} /></View>
    <Text style={styles.historyFootnote}>Illustrative training record.</Text>
  </View>;
}

const styles = StyleSheet.create({
  quickExample: { paddingVertical: 18, gap: 12 },
  exampleAction: { backgroundColor: '#C09AF6', minHeight: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  exampleActionText: { color: '#170D25', fontSize: 17, fontFamily: SLFontFamilies.sansSemiBold },
  quickStep: { color: '#D7CFDF', fontSize: 16, lineHeight: 25 },
  quickExercise: { color: '#F7F3FB', fontSize: 22, fontFamily: SLFontFamilies.sansSemiBold },
  exampleSet: { flexDirection: 'row', alignItems: 'center', gap: 20, minHeight: 52, borderBottomWidth: 1, borderBottomColor: '#372A43' },

  root: { flex: 1, backgroundColor: '#05030A', overflow: 'hidden' },
  openingRoot: { backgroundColor: '#000' },
  heroArt: { position: 'absolute' },
  mast: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, paddingBottom: 12, zIndex: 2 },
  openingMast: { justifyContent: 'flex-end' },
  sceneProgress: { color: '#B68CD9', fontFamily: SLFontFamilies.bodyBold, fontSize: 12, letterSpacing: 2.1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1 },
  openingSpace: { flex: 1 },
  openingCopy: { paddingHorizontal: 27, paddingBottom: 25 },
  version: { color: '#F9F3FC', fontFamily: SLFontFamilies.bodyBold, fontSize: 112, lineHeight: 118, letterSpacing: -8, marginLeft: -6 },
  openingTitle: { color: '#F4EBF8', fontFamily: SLFontFamilies.bodyBold, fontSize: 27, lineHeight: 32, letterSpacing: -0.6, maxWidth: 350, marginTop: 4 },
  lessonContent: { flexGrow: 1, paddingBottom: 24 },
  sceneHeading: { paddingHorizontal: 27, paddingTop: 16, paddingBottom: 27 },
  location: { color: '#B68CD9', fontFamily: SLFontFamilies.bodyBold, fontSize: 12, letterSpacing: 1.2, marginBottom: 12 },
  sceneTitle: { color: '#F8F3FC', fontFamily: SLFontFamilies.bodyBold, fontSize: 34, lineHeight: 39, letterSpacing: -1.1 },
  instruction: { color: '#BEB4C8', fontFamily: SLFontFamilies.body, fontSize: 16, lineHeight: 23, marginTop: 15 },
  example: { marginHorizontal: 27, gap: 12 },
  exampleLabel: { color: '#95889F', fontFamily: SLFontFamilies.bodyBold, fontSize: 12, letterSpacing: 1 },
  capture: { overflow: 'hidden', borderRadius: 14, backgroundColor: '#000', borderWidth: 1, borderColor: '#2C2239' },
  historyExample: { borderRadius: 16, borderWidth: 1, borderColor: '#2C2239', padding: 15, backgroundColor: '#07090E', gap: 8 },
  historyTitle: { fontFamily: SLFontFamilies.bodyBold, fontSize: 19, color: '#F8F3FC' },
  historySubtitle: { fontSize: 12, color: '#95889F', marginBottom: 9 },
  historyFootnote: { fontSize: 12, lineHeight: 16, color: '#95889F', marginTop: 6 },
  controlHint: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 2 },
  controlHintText: { flex: 1, color: '#BEB4C8', fontFamily: SLFontFamilies.body, fontSize: 13, lineHeight: 19 },
  footer: { paddingHorizontal: 27, paddingTop: 10, backgroundColor: '#05030A' },
  openingFooter: { backgroundColor: '#000' },
  lessonFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  lessonPrimary: { flex: 1 },
  lessonBack: { minHeight: 58, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 58, borderRadius: 17, backgroundColor: '#8E4CDD', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  primaryText: { color: '#FFF', fontFamily: SLFontFamilies.bodyBold, fontSize: 17 },
  secondary: { minHeight: 45, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#AB9CB6', fontFamily: SLFontFamilies.body, fontSize: 14 },
  pressed: { opacity: 0.76 },
});
