import React from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';

/**
 * Temporary concept art boundary. A future production render can replace this
 * one source without changing the ceremony choreography or completion flow.
 */
export const POST_SESSION_LEDGER_ARTWORK = require('@/assets/images/post-session-ledger-concept-v1.png');

export function PostSessionLedgerCeremony({
  progress,
  streak,
  title,
  date,
  durationMinutes,
  setCount,
  movementCount,
  showSessionTitle,
}: {
  progress: Animated.Value;
  streak: number;
  title: string;
  date: string | null;
  durationMinutes: number | null;
  setCount: number;
  movementCount: number;
  showSessionTitle: boolean;
}) {
  const safeStreak = Math.max(1, Math.round(Number(streak) || 1));
  const focusOpacity = progress.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });
  const ledgerOpacity = progress.interpolate({
    inputRange: [0, 0.12, 0.34, 0.76, 0.88, 1],
    outputRange: [0, 0, 1, 1, 0.55, 0.24],
    extrapolate: 'clamp',
  });
  const ledgerScale = progress.interpolate({
    inputRange: [0, 0.12, 0.34, 0.76, 1],
    outputRange: [0.9, 0.9, 1, 1, 0.88],
    extrapolate: 'clamp',
  });
  const ledgerLift = progress.interpolate({
    inputRange: [0, 0.34, 0.76, 1],
    outputRange: [SLSpacing.lg, 0, 0, SLSpacing.lg],
    extrapolate: 'clamp',
  });
  const glowOpacity = progress.interpolate({
    inputRange: [0, 0.16, 0.4, 0.76, 1],
    outputRange: [0, 0, 0.72, 0.5, 0.16],
    extrapolate: 'clamp',
  });
  const streakOpacity = progress.interpolate({
    inputRange: [0, 0.4, 0.54, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });
  const streakRise = progress.interpolate({
    inputRange: [0, 0.4, 0.56, 1],
    outputRange: [SLSpacing.xl, SLSpacing.xl, 0, 0],
    extrapolate: 'clamp',
  });
  const streakScale = progress.interpolate({
    inputRange: [0, 0.4, 0.55, 0.64, 1],
    outputRange: [0.94, 0.94, 1.035, 1, 1],
    extrapolate: 'clamp',
  });
  const labelOpacity = progress.interpolate({
    inputRange: [0, 0.55, 0.66, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });
  const recapOpacity = progress.interpolate({
    inputRange: [0, 0.78, 0.94, 1],
    outputRange: [0, 0, 0.7, 1],
    extrapolate: 'clamp',
  });
  const recapTranslate = progress.interpolate({
    inputRange: [0, 0.78, 1],
    outputRange: [SLSpacing.lg, SLSpacing.lg, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.ceremony, { opacity: focusOpacity }]}>
      <View accessible accessibilityRole="header" style={styles.completionHeader}>
        <View pointerEvents="none" style={styles.completionRule} />
        <Text style={styles.completionLabel}>TRAINING SESSION COMPLETE</Text>
        <View pointerEvents="none" style={styles.completionRule} />
      </View>
      <View pointerEvents="none" style={styles.ledgerStage}>
        <Animated.View style={[styles.ledgerGlow, { opacity: glowOpacity }]} />
        <Animated.View
          style={[
            styles.ledgerArtworkFrame,
            {
              opacity: ledgerOpacity,
              transform: [{ translateY: ledgerLift }, { scale: ledgerScale }],
            },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={POST_SESSION_LEDGER_ARTWORK}
            style={styles.ledgerArtwork}
          />
        </Animated.View>
        <Animated.View
          accessible
          accessibilityLabel={`${safeStreak} session streak`}
          style={[
            styles.streakBadge,
            {
              opacity: streakOpacity,
              transform: [{ translateY: streakRise }, { scale: streakScale }],
            },
          ]}
        >
          <Svg height="158" width="158" style={styles.streakHexagon} viewBox="0 0 158 158">
            <Polygon
              points="79,3 146,42 146,116 79,155 12,116 12,42"
              fill="rgba(8, 5, 13, 0.92)"
              stroke={SLColors.accentViolet}
              strokeWidth="2"
            />
          </Svg>
          <Text style={styles.streakValue}>{safeStreak}</Text>
          <Animated.View style={{ opacity: labelOpacity }}>
            <Text style={styles.streakLabel}>SESSION STREAK</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.recap,
          { opacity: recapOpacity, transform: [{ translateY: recapTranslate }] },
        ]}
      >
        {showSessionTitle ? <Text typographyRole="workoutName" style={styles.sessionTitle}>{title}</Text> : null}
        {showSessionTitle && date ? <Text style={styles.sessionDate}>{formatCompletionDate(date)}</Text> : null}
        <View style={styles.metricsRow}>
          {durationMinutes != null ? <CeremonyMetric value={String(durationMinutes)} label="min" /> : null}
          <CeremonyMetric divider={durationMinutes != null} value={String(setCount)} label="sets" />
          <CeremonyMetric divider value={String(movementCount)} label="movements" />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function formatCompletionDate(value: string) {
  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function CeremonyMetric({ value, label, divider = false }: { value: string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.metric, divider && styles.metricDivider]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ceremony: {
    backgroundColor: 'transparent',
    borderRadius: SLRadius.radiusHero - 1,
    overflow: 'hidden',
    paddingHorizontal: SLSpacing.md,
    paddingTop: SLSpacing.lg,
  },
  completionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'center',
  },
  completionRule: {
    backgroundColor: 'rgba(167, 139, 250, 0.26)',
    height: StyleSheet.hairlineWidth,
    maxWidth: 56,
    width: '12%',
  },
  completionLabel: {
    ...SLTypography.sectionLabel,
    color: SLColors.accentViolet,
    letterSpacing: 1.35,
    textAlign: 'center',
  },
  ledgerStage: {
    alignItems: 'center',
    backgroundColor: SLColors.black,
    height: 360,
    justifyContent: 'center',
  },
  ledgerGlow: {
    backgroundColor: 'rgba(148, 71, 255, 0.30)',
    borderRadius: 180,
    height: 290,
    position: 'absolute',
    shadowColor: '#B968FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 42,
    width: 290,
  },
  ledgerArtworkFrame: {
    alignItems: 'center',
    height: 330,
    justifyContent: 'center',
    position: 'absolute',
    width: 330,
  },
  ledgerArtwork: {
    height: '100%',
    width: '100%',
  },
  streakBadge: {
    alignItems: 'center',
    height: 158,
    justifyContent: 'center',
    position: 'absolute',
    top: 38,
    width: 158,
  },
  streakHexagon: {
    position: 'absolute',
  },
  streakValue: {
    color: '#F7C86A',
    fontSize: 70,
    fontWeight: '700',
    letterSpacing: -2,
    lineHeight: 74,
    textAlign: 'center',
    textShadowColor: 'rgba(247, 200, 106, 0.34)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  streakLabel: {
    ...SLTypography.micro,
    color: SLColors.textStrong,
    letterSpacing: 1,
    textAlign: 'center',
  },
  recap: {
    paddingBottom: SLSpacing.xl,
  },
  sessionTitle: {
    ...SLTypography.commandTitle,
    color: SLColors.textStrong,
    marginTop: SLSpacing.xs,
    textAlign: 'center',
  },
  sessionDate: {
    ...SLTypography.label,
    color: SLColors.textMuted,
    marginTop: SLSpacing.xs,
    textAlign: 'center',
  },
  metricsRow: {
    borderTopColor: 'rgba(225, 221, 240, 0.10)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: SLSpacing.lg,
    paddingTop: SLSpacing.lg,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricDivider: {
    borderLeftColor: 'rgba(225, 221, 240, 0.10)',
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  metricValue: {
    ...SLTypography.commandTitle,
    color: SLColors.textStrong,
    textAlign: 'center',
  },
  metricLabel: {
    ...SLTypography.caption,
    color: SLColors.textMuted,
    textAlign: 'center',
  },
});
