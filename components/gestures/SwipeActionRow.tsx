import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  clampSwipeTranslation,
  resolveSwipeRelease,
  SWIPE_ACTION_WIDTH,
  SWIPE_ACTIVATION_DISTANCE,
  SWIPE_VERTICAL_FAILURE_DISTANCE,
} from '@/lib/swipe-action-gesture';

const CLOSED_SPRING = { damping: 22, stiffness: 260, mass: 0.78 };

export function SwipeActionRow({
  action,
  children,
  isOpen,
  onAction,
  onGestureStart,
  onRequestClose,
  onRequestOpen,
  reduceMotion = false,
  foregroundStyle,
  style,
}: {
  action: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onAction: () => void;
  onGestureStart?: () => void;
  onRequestClose: () => void;
  onRequestOpen: () => void;
  reduceMotion?: boolean;
  foregroundStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const translateX = useSharedValue(isOpen ? -SWIPE_ACTION_WIDTH : 0);
  const gestureStartX = useSharedValue(translateX.value);
  const settledOpen = useSharedValue(isOpen ? 1 : 0);
  const reducedMotion = useSharedValue(reduceMotion ? 1 : 0);
  const callbacksRef = useRef({ onAction, onGestureStart, onRequestClose, onRequestOpen });

  useEffect(() => {
    callbacksRef.current = { onAction, onGestureStart, onRequestClose, onRequestOpen };
  }, [onAction, onGestureStart, onRequestClose, onRequestOpen]);

  useEffect(() => {
    settledOpen.value = isOpen ? 1 : 0;
    const target = isOpen ? -SWIPE_ACTION_WIDTH : 0;
    translateX.value = reduceMotion
      ? target
      : withSpring(target, CLOSED_SPRING);
  }, [isOpen, reduceMotion, settledOpen, translateX]);

  useEffect(() => {
    reducedMotion.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reducedMotion]);

  const notifyGestureStart = useCallback(() => callbacksRef.current.onGestureStart?.(), []);
  const requestOpen = useCallback(() => callbacksRef.current.onRequestOpen(), []);
  const requestClose = useCallback(() => callbacksRef.current.onRequestClose(), []);
  const performAction = useCallback(() => callbacksRef.current.onAction(), []);

  const gesture = useMemo(() => Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .activeOffsetX([-SWIPE_ACTIVATION_DISTANCE, SWIPE_ACTIVATION_DISTANCE])
    .failOffsetY([-SWIPE_VERTICAL_FAILURE_DISTANCE, SWIPE_VERTICAL_FAILURE_DISTANCE])
    .cancelsTouchesInView(true)
    .onStart(() => {
      gestureStartX.value = translateX.value;
      runOnJS(notifyGestureStart)();
    })
    .onUpdate((event) => {
      translateX.value = clampSwipeTranslation(gestureStartX.value + event.translationX);
    })
    .onEnd((event) => {
      const resolution = resolveSwipeRelease(translateX.value, event.velocityX);
      if (resolution === 'commit') {
        settledOpen.value = 0;
        translateX.value = withTiming(-620, { duration: reducedMotion.value ? 0 : 180 }, (finished) => {
          if (finished) runOnJS(performAction)();
        });
        return;
      }
      const open = resolution === 'open';
      settledOpen.value = open ? 1 : 0;
      translateX.value = reducedMotion.value
        ? (open ? -SWIPE_ACTION_WIDTH : 0)
        : withSpring(open ? -SWIPE_ACTION_WIDTH : 0, CLOSED_SPRING);
      if (open) runOnJS(requestOpen)();
      else runOnJS(requestClose)();
    })
    .onFinalize((_event, success) => {
      if (success) return;
      const target = settledOpen.value ? -SWIPE_ACTION_WIDTH : 0;
      translateX.value = reducedMotion.value
        ? target
        : withSpring(target, CLOSED_SPRING);
    }), [
      gestureStartX,
      notifyGestureStart,
      performAction,
      reducedMotion,
      requestClose,
      requestOpen,
      settledOpen,
      translateX,
    ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.frame, style]}>
      <View style={styles.action}>{action}</View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.foreground, foregroundStyle, animatedStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  action: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SWIPE_ACTION_WIDTH,
  },
  foreground: {
    width: '100%',
  },
});
