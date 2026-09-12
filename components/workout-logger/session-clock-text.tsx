import React, { useEffect, useSyncExternalStore } from 'react';
import { AppState, type StyleProp, type TextStyle } from 'react-native';
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

export function RestTimerClockText({ timer, style, onSecond }: {
  timer: ActiveRestTimer;
  style?: StyleProp<TextStyle>;
  onSecond?: (seconds: number) => void;
}) {
  const seconds = useSyncExternalStore(clock.subscribe,
    () => deriveRestTimerRemainingSeconds(timer, clock.getNow()));
  useEffect(() => { onSecond?.(seconds); }, [onSecond, seconds, timer.endAtMs]);
  return <Text style={style} testID="rest-timer-countdown">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Text>;
}

export function SessionElapsedClockText({ startedAt, style }: { startedAt: string | null; style?: StyleProp<TextStyle> }) {
  const seconds = useSyncExternalStore(clock.subscribe,
    () => deriveSessionElapsedSeconds(startedAt, clock.getNow()) ?? 0);
  return <Text style={style}>{formatSessionElapsed(seconds)} elapsed</Text>;
}
