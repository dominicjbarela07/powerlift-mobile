import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies } from '@/constants/theme';
import type { EducationRole } from '@/lib/mobile-education';

type PreviewMode = EducationRole | 'dual';
type Capture = { label: string; source: number; focus: number };

// Captured from the canonical native DEV app with seeded, saved Session evidence.
// The images are screenshots of real surfaces, not recreated interface artwork.
const CAPTURES: Record<PreviewMode, readonly Capture[]> = {
  individual: [
    { label: 'During your Session', source: require('@/assets/images/mobile-3-education/self-session.png'), focus: 0.055 },
    { label: 'Your Ledger', source: require('@/assets/images/mobile-3-education/self-ledger.png'), focus: 0.14 },
  ],
  athlete: [
    { label: 'Core Lifts', source: require('@/assets/images/mobile-3-education/athlete-ledger-seeded.png'), focus: 0.47 },
    { label: 'Movement History', source: require('@/assets/images/mobile-3-education/athlete-movement-history-seeded.png'), focus: 0.46 },
  ],
  coach: [
    { label: 'Athlete Workspace', source: require('@/assets/images/mobile-3-education/coach-brief.png'), focus: 0.06 },
    { label: 'Programming Manager', source: require('@/assets/images/mobile-3-education/coach-programming.png'), focus: 0.07 },
  ],
  dual: [
    { label: 'Your training', source: require('@/assets/images/mobile-3-education/self-session.png'), focus: 0.10 },
    { label: 'Athlete Workspace', source: require('@/assets/images/mobile-3-education/coach-brief.png'), focus: 0.06 },
  ],
};

const WELCOME_CAPTURES: Record<PreviewMode, readonly Capture[]> = {
  individual: [
    { label: 'Your Session', source: require('@/assets/images/mobile-3-education/self-session.png'), focus: 0.12 },
    { label: 'Your Ledger', source: require('@/assets/images/mobile-3-education/self-ledger.png'), focus: 0.22 },
  ],
  athlete: [
    { label: 'During your Session', source: require('@/assets/images/mobile-3-education/athlete-session-live-seeded.png'), focus: 0.17 },
    { label: 'Your Ledger', source: require('@/assets/images/mobile-3-education/athlete-ledger-seeded.png'), focus: 0.15 },
  ],
  coach: [
    { label: 'Athlete Workspace', source: require('@/assets/images/mobile-3-education/coach-brief.png'), focus: 0.12 },
    { label: 'Programming', source: require('@/assets/images/mobile-3-education/coach-programming.png'), focus: 0.12 },
  ],
  dual: [
    { label: 'Your Session', source: require('@/assets/images/mobile-3-education/self-session.png'), focus: 0.12 },
    { label: 'Athlete Workspace', source: require('@/assets/images/mobile-3-education/coach-brief.png'), focus: 0.12 },
  ],
};

export function MobileEducationWelcomePreview({ role, multipleModes }: { role: EducationRole; multipleModes: boolean }) {
  const mode: PreviewMode = multipleModes ? 'dual' : role;
  const captures = WELCOME_CAPTURES[mode];
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(width - 56, 410);
  const imageHeight = Math.min(390, Math.max(275, height * 0.40));

  return <View style={styles.welcomeScene}>
    <ScrollView
      accessibilityLabel="Preview Strength Ledger 3.0 screens"
      directionalLockEnabled
      horizontal
      onMomentumScrollEnd={(event) => setActive(Math.min(captures.length - 1, Math.round(event.nativeEvent.contentOffset.x / frameWidth)))}
      pagingEnabled
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={{ width: frameWidth }}
    >
      {captures.map((capture) => {
        const image = Image.resolveAssetSource(capture.source);
        const fullImageHeight = frameWidth * image.height / image.width;
        return <View key={capture.label} style={[styles.welcomeCard, { width: frameWidth }]}>
          <View style={{ height: imageHeight, overflow: 'hidden' }}>
            <Image accessible={false} resizeMode="cover" source={capture.source} style={{ position: 'absolute', top: -fullImageHeight * capture.focus, width: frameWidth, height: fullImageHeight }} />
          </View>
          <View style={styles.welcomeCaption}>
            <Text style={styles.welcomeCaptionText}>{capture.label}</Text>
            <Text style={styles.welcomeCaptionCount}>{String(active + 1).padStart(2, '0')} / {String(captures.length).padStart(2, '0')}</Text>
          </View>
        </View>;
      })}
    </ScrollView>
    <View style={styles.welcomeDots}>{captures.map((capture, index) => <Pressable
      accessibilityLabel={`Show ${capture.label}`}
      accessibilityRole="button"
      key={capture.label}
      onPress={() => { setActive(index); scrollRef.current?.scrollTo({ x: frameWidth * index, animated: true }); }}
      style={styles.dotTarget}
    ><View style={[styles.dot, active === index && styles.dotActive]} /></Pressable>)}</View>
  </View>;
}

export function MobileEducationRolePreview({ role, multipleModes }: { role: EducationRole; multipleModes: boolean }) {
  const mode: PreviewMode = multipleModes ? 'dual' : role;
  const captures = CAPTURES[mode];
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - 56, 410);
  const maxCaptureHeight = mode === 'individual' ? 290 : mode === 'coach' ? 320 : 338;
  const captureHeight = Math.min(maxCaptureHeight, Math.max(280, height - 568));

  return <View style={styles.scene}>
    <View style={styles.heading}>
      <Text style={styles.headingLabel}>A LOOK INSIDE</Text>
      <Text style={styles.headingCount}>{String(active + 1).padStart(2, '0')} / {String(captures.length).padStart(2, '0')}</Text>
    </View>
    <ScrollView
      accessibilityLabel="Explore actual Strength Ledger screens"
      directionalLockEnabled
      horizontal
      onMomentumScrollEnd={(event) => setActive(Math.min(captures.length - 1, Math.round(event.nativeEvent.contentOffset.x / cardWidth)))}
      pagingEnabled
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={{ width: cardWidth }}
    >
      {captures.map((capture, index) => {
        const image = Image.resolveAssetSource(capture.source);
        const imageHeight = cardWidth * image.height / image.width;
        return <View key={capture.label} style={[styles.card, { width: cardWidth }]}>
          <View style={[styles.capture, { height: captureHeight }]}>
            <Image accessible={false} resizeMode="cover" source={capture.source} style={{ position: 'absolute', top: -imageHeight * capture.focus, width: cardWidth, height: imageHeight }} />
          </View>
          <View style={styles.caption}>
            <View style={styles.captionRule} />
            <Text style={styles.captionText}>{capture.label}</Text>
            <Text style={styles.captionIndex}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
        </View>;
      })}
    </ScrollView>
    <View style={styles.foot}>
      <View style={styles.dots}>{captures.map((capture, index) => <Pressable
        accessibilityLabel={`Show ${capture.label}`}
        accessibilityRole="button"
        key={capture.label}
        onPress={() => { setActive(index); scrollRef.current?.scrollTo({ x: cardWidth * index, animated: true }); }}
        style={styles.dotTarget}
      ><View style={[styles.dot, active === index && styles.dotActive]} /></Pressable>)}</View>
      <Text style={styles.swipe}>SWIPE TO EXPLORE</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  welcomeScene: { marginTop: 22, width: '100%' },
  welcomeCard: { borderRadius: 20, borderWidth: 1, borderColor: '#6A4B7E', backgroundColor: '#08050E', overflow: 'hidden' },
  welcomeCaption: { height: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#674C78' },
  welcomeCaptionText: { color: '#F4EAFB', fontFamily: SLFontFamilies.bodyBold, fontSize: 14 },
  welcomeCaptionCount: { color: '#AA8BC4', fontFamily: SLFontFamilies.bodyBold, fontSize: 11, letterSpacing: 1 },
  welcomeDots: { flexDirection: 'row', justifyContent: 'center', paddingTop: 6 },
  scene: { marginTop: 25 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headingLabel: { color: '#BC8AEA', fontFamily: SLFontFamilies.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  headingCount: { color: '#8F839D', fontFamily: SLFontFamilies.bodyBold, fontSize: 11, letterSpacing: 1.2 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#4B385E', backgroundColor: '#0A0710', overflow: 'hidden' },
  capture: { overflow: 'hidden', backgroundColor: '#07050C' },
  caption: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#554363' },
  captionRule: { width: 3, height: 21, borderRadius: 2, backgroundColor: '#B16CEE', marginRight: 11 },
  captionText: { flex: 1, color: '#F5EDFC', fontFamily: SLFontFamilies.bodyBold, fontSize: 15 },
  captionIndex: { color: '#927FA3', fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  dots: { flexDirection: 'row', gap: 2 },
  dotTarget: { minWidth: 27, height: 27, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#5C4A6B' },
  dotActive: { width: 22, backgroundColor: '#BD79F3' },
  swipe: { color: '#82758F', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 1.3 },
});
