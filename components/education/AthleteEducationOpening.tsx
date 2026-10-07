import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies } from '@/constants/theme';
import { fetchLedgerRecordSummary, type LedgerRecordSummary } from '@/lib/ledger-journey';

const HERO_ART = require('@/assets/images/post-session-ledger-concept-v1.png');

const SCENES = [
  {
    title: 'Last time, every Set.',
    image: require('@/assets/images/mobile-3-education/athlete-session-20261001.png'),
    focusY: 360,
  },
  {
    title: 'Follow the lift over time.',
    image: require('@/assets/images/mobile-3-education/athlete-history-20261001.png'),
    focusY: 1350,
  },
  {
    title: 'See what you’ve earned.',
    image: require('@/assets/images/mobile-3-education/athlete-ledger-20261001.png'),
    focusY: 1300,
  },
] as const;

function useOwnRecord() {
  const [record, setRecord] = useState<LedgerRecordSummary | null>(null);
  useEffect(() => {
    let mounted = true;
    fetchLedgerRecordSummary().then((result) => {
      if (mounted) setRecord(result);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  return record;
}

export function AthleteEducationExperience({
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
  const record = useOwnRecord();
  const opacity = useRef(new Animated.Value(0)).current;
  const artEntrance = useRef(new Animated.Value(0)).current;
  const isOpening = step < 0;
  const scene = isOpening ? null : SCENES[Math.min(step, SCENES.length - 1)];
  const asset = scene ? Image.resolveAssetSource(scene.image) : null;
  const imageHeight = asset ? asset.height * width / asset.width : 0;
  const topOffset = scene && asset ? -scene.focusY * width / asset.width : 0;
  const artSize = Math.min(width * 1.5, height * 0.68);

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
          resizeMode="contain"
          style={[
            styles.heroArt,
            {
              width: artSize,
              height: artSize,
              left: (width - artSize) / 2,
              top: -Math.min(height * 0.1, 95),
              opacity: artEntrance,
              transform: [
                { translateY: artEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                { scale: artEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            },
          ]}
        />
        <LinearGradient
          colors={['transparent', 'transparent', '#000']}
          locations={[0, 0.72, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.openingSpace} />
        <View style={styles.openingCopy}>
          <Text style={styles.version}>3.0</Text>
          <Text style={styles.openingTitle}>Today’s work and the record behind it.</Text>
          {record && <Text style={styles.personalRecord}>
            {record.lifetime.sessions_completed > 0
              ? `${record.lifetime.sessions_completed.toLocaleString()} Sessions already in your record`
              : 'Your record starts with your first saved Set.'}
          </Text>}
        </View>
      </> : scene && <>
        <View style={styles.sceneHeading}>
          <Text style={[styles.sceneTitle, { fontSize: Math.min(34, width * 0.081), lineHeight: Math.min(39, width * 0.093) }]}>{scene.title}</Text>
        </View>
        <View style={styles.screenWindow}>
          <Image
            accessible={false}
            source={scene.image}
            style={{ position: 'absolute', top: topOffset, width, height: imageHeight }}
          />
          <LinearGradient
            colors={['#05030A', 'transparent', 'transparent', '#05030A']}
            locations={[0, 0.035, 0.82, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          {step === 0 && <LinearGradient
            colors={['transparent', '#05030A', '#05030A']}
            locations={[0, 0.2, 1]}
            style={styles.sessionFootFade}
          />}
          {step === 1 && <LinearGradient
            colors={['transparent', '#05030A', '#05030A']}
            locations={[0, 0.3, 1]}
            style={styles.historyFootFade}
          />}
          {step === 2 && <LinearGradient
            colors={['transparent', '#05030A', '#05030A']}
            locations={[0, 0.24, 1]}
            style={styles.ledgerFootFade}
          />}
        </View>
      </>}
    </Animated.View>

    <View style={[styles.footer, isOpening && styles.openingFooter, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}>
      <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{isOpening ? 'See what’s new' : step === 2 ? 'Go to Today' : 'Continue'}</Text>
        <Ionicons color="#FFF" name="arrow-forward" size={20} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={isOpening ? onGoToday : onBack} style={styles.secondary}>
        <Text style={styles.secondaryText}>{isOpening ? 'Go to Today' : 'Back'}</Text>
      </Pressable>
    </View>
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
  personalRecord: { color: '#B8A8C4', fontFamily: SLFontFamilies.body, fontSize: 14, marginTop: 17 },
  sceneHeading: { paddingHorizontal: 27, paddingTop: 30, paddingBottom: 27 },
  sceneTitle: { color: '#F8F3FC', fontFamily: SLFontFamilies.bodyBold, fontSize: 34, lineHeight: 39, letterSpacing: -1.1 },
  screenWindow: { flex: 1, width: '100%', overflow: 'hidden', backgroundColor: '#000' },
  sessionFootFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%' },
  historyFootFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '14%' },
  ledgerFootFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%' },
  footer: { paddingHorizontal: 27, paddingTop: 10, backgroundColor: '#05030A' },
  openingFooter: { backgroundColor: '#000' },
  primary: { minHeight: 58, borderRadius: 17, backgroundColor: '#8E4CDD', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  primaryText: { color: '#FFF', fontFamily: SLFontFamilies.bodyBold, fontSize: 17 },
  secondary: { minHeight: 45, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#AB9CB6', fontFamily: SLFontFamilies.body, fontSize: 14 },
  pressed: { opacity: 0.76 },
});
