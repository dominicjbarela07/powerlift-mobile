import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLCanonicalIcon } from '@/components/ui/sl-trophy';
import { SLScreen } from '@/components/ui/sl-screen';
import { SLColors, SLLayout, SLRadius, SLSpacing } from '@/constants/theme';
import { useSLReducedMotion } from '@/lib/motion';
import { type LedgerRoom } from './routing';

export function LedgerFrame({ active, children }: React.PropsWithChildren<{ active: LedgerRoom }>) {
  const pathname = usePathname();
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), [pathname]);
  return (
    <SLScreen edges="none" padded={false} style={styles.screen}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AnimatedEntrance key={active}>{children}</AnimatedEntrance>
      </ScrollView>
    </SLScreen>
  );
}

function AnimatedEntrance({ children }: React.PropsWithChildren) {
  const reduceMotion = useSLReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translate.setValue(0);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, damping: 22, stiffness: 250, mass: 0.72, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion, translate]);
  return <Animated.View style={{ opacity, transform: [{ translateY: translate }] }}>{children}</Animated.View>;
}

export function MediaHero({ image, eyebrow, title, body, children, height = 290, align = 'bottom' }: React.PropsWithChildren<{
  image: ImageSourcePropType;
  eyebrow: string;
  title: string;
  body?: string;
  height?: number;
  align?: 'top' | 'bottom';
}>) {
  return (
    <ImageBackground source={image} resizeMode="cover" style={[styles.mediaHero, { minHeight: height }]} imageStyle={styles.mediaHeroImage}>
      <View style={styles.mediaScrim} />
      <View style={[styles.mediaCopy, align === 'top' ? styles.mediaCopyTop : styles.mediaCopyBottom]}>
        <Text typographyRole="shortTechnicalLabel" style={styles.eyebrow}>{eyebrow}</Text>
        <Text typographyRole="modalTitle" style={styles.mediaTitle}>{title}</Text>
        {body ? <Text typographyRole="body" style={styles.mediaBody}>{body}</Text> : null}
        {children}
      </View>
    </ImageBackground>
  );
}

export function SectionLabel({ icon, children, action }: React.PropsWithChildren<{ icon?: keyof typeof Ionicons.glyphMap; action?: string }>) {
  return (
    <View style={styles.sectionLabel}>
      <View style={styles.sectionLabelLead}>{icon ? <SLCanonicalIcon name={icon} size={17} color={SLColors.accent} trophyTier="bronze" /> : null}<Text typographyRole="sectionTitle" style={styles.sectionLabelText}>{children}</Text></View>
      {action ? <Text typographyRole="caption" style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function Metric({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return <View style={styles.metric}><Text typographyRole="numeric" adjustsFontSizeToFit minimumFontScale={0.58} style={[styles.metricValue, accent ? { color: accent } : null]}>{value}</Text><Text typographyRole="caption" style={styles.metricLabel}>{label}</Text></View>;
}

export function Segmented<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.segmented}>
      {values.map((option) => {
        const selected = option === value;
        return <Pressable key={option} onPress={() => onChange(option)} style={({ pressed }) => [styles.segment, selected && styles.segmentActive, pressed && styles.pressed]}><Text typographyRole="tabLabel" style={[styles.segmentText, selected && styles.segmentTextActive]}>{option}</Text></Pressable>;
      })}
    </View>
  );
}

export function ProgressBar({ value, color = SLColors.accent }: { value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }} style={styles.track}><View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} /></View>;
}

export function Action({ label, icon = 'arrow-forward', onPress, quiet = false, style }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; quiet?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.action, quiet && styles.actionQuiet, style, pressed && styles.pressed]}><Text typographyRole="shortButtonLabel" style={[styles.actionText, quiet && styles.actionTextQuiet]}>{label}</Text><Ionicons name={icon} size={17} color={quiet ? SLColors.textSecondary : SLColors.textInverted} /></Pressable>;
}

export function EvidenceRow({ icon, title, detail, value, tone = SLColors.accent }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; value?: string; tone?: string }) {
  return (
    <View style={styles.evidenceRow}>
      <View style={[styles.evidenceIcon, { borderColor: `${tone}66` }]}><SLCanonicalIcon name={icon} size={18} color={tone} trophyTier="bronze" /></View>
      <View style={styles.evidenceCopy}><Text typographyRole="bodyStrong" style={styles.evidenceTitle}>{title}</Text><Text typographyRole="caption" style={styles.evidenceDetail}>{detail}</Text></View>
      {value ? <Text typographyRole="numeric" style={[styles.evidenceValue, { color: tone }]}>{value}</Text> : null}
    </View>
  );
}

export const ledgerStyles = StyleSheet.create({
  surface: { backgroundColor: SLColors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, borderRadius: SLRadius.radiusCard },
  inset: { backgroundColor: SLColors.surfaceInset, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, borderRadius: SLRadius.radiusControl },
  eyebrow: { color: SLColors.accentMuted, letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: SLColors.textStrong },
  body: { color: SLColors.textSecondary, lineHeight: 21 },
  caption: { color: SLColors.textMuted },
  number: { color: SLColors.textStrong },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020204' },
  content: { paddingBottom: SLLayout.tabBarClearance + 34 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  mediaHero: { overflow: 'hidden', justifyContent: 'flex-end', borderRadius: SLRadius.radiusCard, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceInset },
  mediaHeroImage: { borderRadius: SLRadius.radiusCard },
  mediaScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 6, 10, 0.58)' },
  mediaCopy: { padding: 20, gap: 7 },
  mediaCopyTop: { flex: 1, justifyContent: 'flex-start' },
  mediaCopyBottom: { justifyContent: 'flex-end' },
  eyebrow: { color: '#CBAEFF', letterSpacing: 1.2 },
  mediaTitle: { color: '#F7F7F5', maxWidth: 430 },
  mediaBody: { color: '#D5DAE0', lineHeight: 21, maxWidth: 460 },
  sectionLabel: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 8 },
  sectionLabelLead: { minWidth: 0, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabelText: { color: SLColors.textStrong },
  sectionAction: { maxWidth: '42%', flexShrink: 1, color: SLColors.textMuted, textAlign: 'right' },
  metric: { flex: 1, minWidth: 0, gap: 3 },
  metricValue: { color: SLColors.textStrong },
  metricLabel: { color: SLColors.textMuted },
  segmented: { flexDirection: 'row', gap: 3, padding: 3, backgroundColor: SLColors.surfaceFlat, borderRadius: SLRadius.radiusControl, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.radiusControl - 3 },
  segmentActive: { backgroundColor: SLColors.surfaceSelected },
  segmentText: { color: SLColors.textMuted },
  segmentTextActive: { color: SLColors.textStrong },
  track: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: SLColors.focus },
  fill: { height: '100%', borderRadius: 3 },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: SLSpacing.lg, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.textPrimary },
  actionQuiet: { backgroundColor: SLColors.object, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderDefault },
  actionText: { color: SLColors.textInverted },
  actionTextQuiet: { color: SLColors.textPrimary },
  evidenceRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.divider },
  evidenceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceFlat, borderWidth: 1 },
  evidenceCopy: { flex: 1, minWidth: 0, gap: 3 },
  evidenceTitle: { color: SLColors.textStrong },
  evidenceDetail: { color: SLColors.textMuted },
  evidenceValue: { color: SLColors.textStrong },
});
