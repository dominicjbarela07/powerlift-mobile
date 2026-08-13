import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Easing, type EasingFunction } from 'react-native';

import { SLMotion } from '@/constants/theme';

type NativeSubscription = { remove: () => void };

let reducedMotion = false;
let nativeSubscription: NativeSubscription | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: boolean) {
  if (reducedMotion === next) return;
  reducedMotion = next;
  listeners.forEach((listener) => listener());
}

function startReducedMotionObserver() {
  if (nativeSubscription) return;
  const activeGeneration = ++generation;
  void AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      if (activeGeneration === generation) publish(enabled);
    })
    .catch(() => undefined);
  nativeSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
}

function subscribeReducedMotion(listener: () => void) {
  listeners.add(listener);
  startReducedMotionObserver();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      generation += 1;
      nativeSubscription?.remove();
      nativeSubscription = null;
    }
  };
}

export function useSLReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => reducedMotion, () => reducedMotion);
}

export function motionDuration(durationMs: number, reduceMotion: boolean) {
  return reduceMotion ? 0 : durationMs;
}

export const SLEasing: Record<'enter' | 'exit' | 'state' | 'linear', EasingFunction> = {
  enter: Easing.bezier(0.2, 0.8, 0.2, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
  state: Easing.bezier(0.2, 0, 0, 1),
  linear: Easing.linear,
};

export function motionPressDuration(reduceMotion: boolean) {
  return motionDuration(SLMotion.pressMs, reduceMotion);
}
