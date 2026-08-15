import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/ui/sl-text';

export const COACH_V2 = {
  black: '#000000',
  surface: '#090B11',
  surfaceRaised: '#0E1119',
  border: '#242834',
  borderStrong: '#353A48',
  violet: '#9D5CFF',
  violetBright: '#B978FF',
  magenta: '#FF4767',
  gold: '#F3B83E',
  green: '#55D68A',
  cyan: '#48C7FF',
  text: '#F6F4FA',
  muted: '#A5A8B5',
  subtle: '#747989',
};

export function CoachMobileHeader({
  title,
  eyebrow,
  onBack,
  onPrimary,
  primaryIcon = 'ellipsis-horizontal',
  primaryLabel = 'More actions',
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  onPrimary?: () => void;
  primaryIcon?: keyof typeof Ionicons.glyphMap;
  primaryLabel?: string;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={10} onPress={onBack} style={styles.headerButton}>
          <Ionicons color={COACH_V2.text} name="chevron-back" size={23} />
        </Pressable>
      ) : <View style={styles.headerSpacer} />}
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.headerEyebrow}>{eyebrow}</Text> : null}
        <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      </View>
      {onPrimary ? (
        <Pressable accessibilityLabel={primaryLabel} accessibilityRole="button" hitSlop={10} onPress={onPrimary} style={styles.headerButton}>
          <Ionicons color={COACH_V2.text} name={primaryIcon} size={22} />
        </Pressable>
      ) : <View style={styles.headerSpacer} />}
    </View>
  );
}

export function CoachBrandHeader({
  onBrief,
  onSettings,
  briefIcon = 'reader-outline',
  briefLabel = 'Open coaching brief',
}: {
  onBrief: () => void;
  onSettings: () => void;
  briefIcon?: keyof typeof Ionicons.glyphMap;
  briefLabel?: string;
}) {
  return (
    <View style={styles.brandHeader}>
      <Pressable accessibilityLabel="Open Settings" onPress={onSettings} style={styles.headerButton}>
        <Ionicons color={COACH_V2.text} name="settings-outline" size={21} />
      </Pressable>
      <Image source={require('@/assets/images/16:9.png')} style={styles.brand} />
      <Pressable accessibilityLabel={briefLabel} onPress={onBrief} style={styles.headerButton}>
        <Ionicons color={COACH_V2.text} name={briefIcon} size={20} />
      </Pressable>
    </View>
  );
}

export function CoachSectionHeading({ action, onAction, title }: { action?: string; onAction?: () => void; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CoachStatusBadge({ label, tone = 'danger' }: { label: string; tone?: 'danger' | 'warning' | 'success' | 'cyan' | 'violet' }) {
  const color = tone === 'danger'
    ? COACH_V2.magenta
    : tone === 'warning'
      ? COACH_V2.gold
      : tone === 'success'
        ? COACH_V2.green
        : tone === 'cyan'
          ? COACH_V2.cyan
          : COACH_V2.violetBright;
  return (
    <View style={[styles.badge, { borderColor: `${color}99`, backgroundColor: `${color}15` }]}>
      <Text numberOfLines={1} style={[styles.badgeText, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function CoachMetricTile({ color, icon, label, onPress, value }: { color: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; value: string | number }) {
  const content = (
    <>
      <LinearGradient colors={[`${color}18`, 'rgba(5,7,11,0.98)']} style={StyleSheet.absoluteFillObject} />
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
      <Ionicons color={`${color}B8`} name={icon} size={15} style={styles.metricIcon} />
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={`Open ${label}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.metricTile, pressed && styles.metricPressed]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={styles.metricTile}>
      {content}
    </View>
  );
}

export function CoachProgramArtwork() {
  return (
    <View pointerEvents="none" style={styles.programArtwork}>
      <Image
        resizeMode="contain"
        source={require('@/assets/images/logger-renders/plate-stack-studio-v2/mobile-hero-240x160@3x/squat-405.png')}
        style={styles.programImage}
      />
      <LinearGradient
        colors={['rgba(9,11,17,1)', 'rgba(9,11,17,0.22)', 'rgba(9,11,17,0)']}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

export function CoachSparkline({ color = COACH_V2.cyan, values }: { color?: string; values: number[] }) {
  const geometry = useMemo(() => {
    if (!values.length) return { path: '', points: [] as { x: number; y: number }[] };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.5, max - min);
    const points = values.map((value, index) => ({
      x: values.length === 1 ? 50 : (index / (values.length - 1)) * 100,
      y: 31 - ((value - min) / span) * 24,
    }));
    return {
      path: points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '),
      points,
    };
  }, [values]);
  if (!values.length) return <View style={styles.sparklineEmpty} />;
  return (
    <Svg accessibilityLabel="Readiness trend" height={36} viewBox="0 0 100 36" width="100%">
      <Path d={geometry.path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      {geometry.points.map((point, index) => (
        <Circle cx={point.x} cy={point.y} fill={index === geometry.points.length - 1 ? COACH_V2.text : color} key={`${point.x}-${index}`} r={index === geometry.points.length - 1 ? 3 : 2} />
      ))}
    </Svg>
  );
}

export function CoachCardChevron() {
  return <Ionicons color={COACH_V2.muted} name="chevron-forward" size={20} />;
}

const styles = StyleSheet.create({
  header: { height: 58, flexDirection: 'row', alignItems: 'center', borderBottomColor: COACH_V2.border, borderBottomWidth: StyleSheet.hairlineWidth },
  brandHeader: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: COACH_V2.border, borderBottomWidth: StyleSheet.hairlineWidth },
  headerButton: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 42 },
  headerCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerEyebrow: { color: COACH_V2.violetBright, fontSize: 9, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  headerTitle: { color: COACH_V2.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  brand: { width: 126, height: 28, resizeMode: 'contain' },
  sectionHeading: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  sectionTitle: { color: COACH_V2.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  sectionAction: { color: COACH_V2.violetBright, fontSize: 12, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', borderRadius: 5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, maxWidth: '100%' },
  badgeText: { fontSize: 9, lineHeight: 11, fontWeight: '900', letterSpacing: 0.25 },
  metricTile: { minHeight: 66, flex: 1, overflow: 'hidden', borderRadius: 9, borderWidth: 1, borderColor: COACH_V2.border, paddingHorizontal: 9, paddingVertical: 10 },
  metricValue: { fontSize: 22, lineHeight: 24, fontWeight: '800' },
  metricLabel: { marginTop: 4, color: COACH_V2.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  metricIcon: { position: 'absolute', right: 8, top: 8 },
  metricPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  programArtwork: { ...StyleSheet.absoluteFillObject, left: '46%', overflow: 'hidden' },
  programImage: { position: 'absolute', right: -28, top: -14, width: 190, height: 150, opacity: 0.76 },
  sparklineEmpty: { height: 36, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COACH_V2.borderStrong },
});
