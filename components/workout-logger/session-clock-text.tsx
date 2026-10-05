import React, { useEffect, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { restTimerRemainingFraction } from '@/lib/rest-timer-progress';
import { Text } from '@/components/ui/sl-text';
import { createDeadlineDisplayClock } from '@/lib/deadline-display-clock';
import { deriveRestTimerRemainingSeconds, type ActiveRestTimer } from '@/lib/rest-timer-completion-core';
import { deriveSessionElapsedSeconds, formatSessionElapsed } from '@/lib/session-header-metrics';

const clock = createDeadlineDisplayClock({
  now: Date.now,
  schedule: tick => setInterval(tick, 250),
  cancel: handle => clearInterval(handle as ReturnType<typeof setInterval>),
  isForeground: () => AppState.currentState === 'active',
  subscribeForeground: listener => {
    const sub = AppState.addEventListener('change', state => listener(state === 'active'));
    return () => sub.remove();
  },
});

export function RestTimerClockText({ timer, style, onSecond, ring = false }: {
  timer: ActiveRestTimer;
  style?: StyleProp<TextStyle>;
  onSecond?: (seconds: number) => void;
  ring?: boolean;
}) {
  const seconds = useSyncExternalStore(clock.subscribe,
    () => deriveRestTimerRemainingSeconds(timer, clock.getNow()));
  useEffect(() => { onSecond?.(seconds); }, [onSecond, seconds, timer.endAtMs]);
  const countdown = <Text style={[style, ring && ringStyles.time]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} testID="rest-timer-countdown">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Text>;
  if (!ring) return countdown;
  const size = 104, stroke = 6, radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const remaining = restTimerRemainingFraction(timer, seconds);
  return <View style={ringStyles.wrap} testID="rest-timer-progress-ring">
    <Svg width={size} height={size} accessible={false}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#25292e" strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#18e0e7" strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - remaining)} opacity={remaining > 0 ? 1 : 0}
        rotation="-90" origin={`${size / 2}, ${size / 2}`} />
    </Svg>
    <View style={ringStyles.center}>{countdown}</View>
  </View>;
}

const ringStyles = StyleSheet.create({
  wrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  time: { width: 86, textAlign: 'center' },
});

export function SessionElapsedClockText({ startedAt, style }: { startedAt: string | null; style?: StyleProp<TextStyle> }) {
  const seconds = useSyncExternalStore(clock.subscribe,
    () => deriveSessionElapsedSeconds(startedAt, clock.getNow()) ?? 0);
  return <Text style={style}>{formatSessionElapsed(seconds)} elapsed</Text>;
}
