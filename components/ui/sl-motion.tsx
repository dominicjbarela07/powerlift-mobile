import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLMotion, SLOpacity, SLSpacing } from '@/constants/theme';
import { motionDuration, motionPressDuration, SLEasing, useSLReducedMotion } from '@/lib/motion';
import { previewMotionDuration, useSLMotionPreviewOverrides } from '@/lib/motion-preview';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  pressScale?: number;
  pressedOpacity?: number;
  disableNativePressAnimation?: boolean;
};

export function SLMotionPressable({
  style,
  pressScale = SLMotion.pressScale,
  pressedOpacity = 1,
  disableNativePressAnimation = false,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: MotionPressableProps) {
  const reduceMotion = useSLReducedMotion();
  const previewMotion = useSLMotionPreviewOverrides();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const resolvedStyle = typeof style === 'function'
    ? style({ pressed } as PressableStateCallbackType)
    : style;

  const settle = (toValue: number) => {
    if (disableNativePressAnimation) return;
    scale.stopAnimation();
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue,
      duration: motionDuration(previewMotionDuration(previewMotion?.stateMs ?? motionPressDuration(reduceMotion), previewMotion), reduceMotion),
      easing: SLEasing.state,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        settle(pressScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        settle(1);
        onPressOut?.(event);
      }}
      style={[
        resolvedStyle,
        {
          opacity: disabled ? SLOpacity.disabled : pressed ? pressedOpacity : 1,
          transform: disableNativePressAnimation ? undefined : [{ scale }],
        },
      ]}
    />
  );
}

type MotionEntranceProps = {
  children: ReactNode;
  motionKey?: string | number;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

export function SLMotionEntrance({
  children,
  motionKey = 'initial',
  delay = 0,
  distance = SLSpacing.sm,
  style,
}: MotionEntranceProps) {
  const reduceMotion = useSLReducedMotion();
  const previewMotion = useSLMotionPreviewOverrides();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const entranceDuration = motionDuration(previewMotionDuration(previewMotion?.entranceMs ?? SLMotion.componentMs, previewMotion), reduceMotion);

  useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay,
      duration: entranceDuration,
      easing: SLEasing.enter,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, entranceDuration, motionKey, progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function SLAnimatedMetric({
  value,
  children,
  style,
}: {
  value: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useSLReducedMotion();
  const previewMotion = useSLMotionPreviewOverrides();
  const progress = useRef(new Animated.Value(1)).current;
  const metricDuration = previewMotionDuration(previewMotion?.stateMs ?? SLMotion.stateMs, previewMotion);

  useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0.76);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: metricDuration,
      easing: SLEasing.enter,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [metricDuration, progress, reduceMotion, value]);

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.992, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}
