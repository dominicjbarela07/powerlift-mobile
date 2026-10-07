import { educationImage } from '@/lib/mobile-education-images';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
    location: 'PROGRAMMING → TODAY',
    title: 'Build your next Session.',
    instruction: 'Open Programming and create a Session. Add movements, Sets, reps and effort targets. Tap Ready to train to find it in Today.',
    example: 'EXAMPLE · SESSION WORKSPACE',
    image: educationImage('self-coach-programming-20261006.png'),
  },
  {
    location: 'ACTIVE SESSION',
    title: 'Adjust the plan as you train.',
    instruction: 'Tap the edit icon beside Prescribed to change Sets, reps or effort. Use Swap beside the title to change the movement.',
    example: 'EXAMPLE · SESSION LOGGER',
    image: educationImage('self-coach-logger-20261006.png'),
  },
  {
    location: 'LEDGER → MOVEMENT HISTORY',
    title: 'Review your progress.',
    instruction: 'Open Ledger and choose a movement. Movement History shows your saved Sets and how your performance changes over time.',
    example: 'EXAMPLE · SIX WEEKS OF PROGRESS',
    image: educationImage('athlete-movement-history-seeded.png'),
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
          {step === 0 ? <>
            <EducationCapture source={scene.image} width={width - 54} from={0.455} to={0.566} label="Example movement row: tap the movement to edit its prescription." />
            <View style={styles.controlHint}><Ionicons name="create-outline" size={17} color="#C6A0F4" /><Text style={styles.controlHintText}>Tap a movement to edit its prescription.</Text></View>
            <EducationCapture source={scene.image} width={width - 54} from={0.900} to={0.971} label="Example Add and Ready to train controls." />
          </> : step === 1 ? <>
            <EducationCapture source={scene.image} width={width - 54} from={0.177} to={0.443} label="Example movement title with Swap and the edit icon beside Prescribed." />
            <View style={styles.controlHint}><Ionicons name="checkmark-circle-outline" size={17} color="#7BD9C6" /><Text style={styles.controlHintText}>Completed Sets stay in your record.</Text></View>
          </> : <EducationHistoryExample />}
        </View>
      </ScrollView>}

    </Animated.View>

    <View style={[styles.footer, isOpening ? styles.openingFooter : styles.lessonFooter, { paddingBottom: Math.max(insets.bottom, 14) + 55 }]}>
      {!isOpening && <Pressable accessibilityRole="button" onPress={onBack} style={styles.lessonBack}>
        <Text style={styles.secondaryText}>Back</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => [styles.primary, !isOpening && styles.lessonPrimary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{isOpening ? 'Show me how' : step === 2 ? 'Go to Today' : 'Continue'}</Text>
        <Ionicons color="#FFF" name="arrow-forward" size={20} />
      </Pressable>
      {isOpening && <Pressable accessibilityRole="button" onPress={onGoToday} style={styles.secondary}>
        <Text style={styles.secondaryText}>Go to Today</Text>
      </Pressable>}
    </View>
  </View>;
}

/** Show only the relevant controls from an unchanged, real DEV capture. */
function EducationCapture({ source, width, from, to, label }: {
  source: ReturnType<typeof educationImage>; width: number; from: number; to: number; label: string;
}) {
  const asset = Image.resolveAssetSource(source);
  const imageHeight = asset.height * width / asset.width;
  return <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.capture, { width, height: imageHeight * (to - from) }]}>
    <Image accessible={false} source={source} style={{ position: 'absolute', top: -from * imageHeight, width, height: imageHeight }} />
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
