import React, { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type TouchableOpacityProps,
  type View,
  type ViewStyle,
} from 'react-native';

import { SLMotion, SLOpacity, SLSpacing } from '@/constants/theme';
import { motionDuration, motionPressDuration, SLEasing, useSLReducedMotion } from '@/lib/motion';
import { previewMotionDuration, useSLMotionPreviewOverrides } from '@/lib/motion-preview';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionPressableProps = Omit<PressableProps, 'style' | 'onPress'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  onPress?: (event: Parameters<NonNullable<PressableProps['onPress']>>[0]) => unknown | Promise<unknown>;
  onAsyncError?: (error: unknown) => void;
  pressScale?: number;
  pressedOpacity?: number;
  disableNativePressAnimation?: boolean;
  disabledOpacity?: number;
};

export const SLMotionPressable = forwardRef<View, MotionPressableProps>(function SLMotionPressable({
  style,
  pressScale = SLMotion.pressScale,
  pressedOpacity = 0.84,
  disableNativePressAnimation = false,
  disabledOpacity = SLOpacity.disabled,
  onPressIn,
  onPressOut,
  onPress,
  onAsyncError,
  disabled,
  accessibilityState,
  ...props
}: MotionPressableProps, forwardedRef) {
  const reduceMotion = useSLReducedMotion();
  const previewMotion = useSLMotionPreviewOverrides();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const isDisabled = disabled || pending;
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
      accessibilityState={{ ...accessibilityState, busy: pending, disabled: isDisabled }}
      disabled={isDisabled}
      ref={forwardedRef as never}
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
      onPress={(event) => {
        if (!onPress || pendingRef.current) return;
        let result: unknown;
        try {
          result = onPress(event);
        } catch (error) {
          onAsyncError?.(error);
          return;
        }
        if (!result || typeof (result as Promise<unknown>).then !== 'function') return;
        pendingRef.current = true;
        setPending(true);
        void Promise.resolve(result).then(
          () => undefined,
          (error) => {
            if (onAsyncError) onAsyncError(error);
            else if (__DEV__) console.error('[tactile-pressable] async action failed', error);
          },
        ).finally(() => {
          pendingRef.current = false;
          setPending(false);
        });
      }}
      style={[
        resolvedStyle,
        {
          opacity: disabled ? disabledOpacity : pending ? SLOpacity.loading : pressed ? pressedOpacity : 1,
          transform: disableNativePressAnimation ? undefined : [{ scale }],
        },
      ]}
    />
  );
});

/**
 * Migration-compatible tactile replacement for React Native TouchableOpacity.
 * New product code should prefer SLMotionPressable, SLButton, or SLIconButton.
 */
export function SLTactileOpacity({
  activeOpacity = 0.72,
  style,
  ...props
}: Omit<TouchableOpacityProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SLMotionPressable
      {...props}
      pressedOpacity={activeOpacity}
      style={style}
    />
  );
}

type MotionEntranceProps = {
  children: ReactNode;
  disabled?: boolean;
  motionKey?: string | number;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

export function SLMotionEntrance({
  children,
  disabled = false,
  motionKey = 'initial',
  delay = 0,
  distance = SLSpacing.sm,
  style,
}: MotionEntranceProps) {
  const reduceMotion = useSLReducedMotion();
  const previewMotion = useSLMotionPreviewOverrides();
  const motionDisabled = disabled || reduceMotion;
  const progress = useRef(new Animated.Value(motionDisabled ? 1 : 0)).current;
  const entranceDuration = motionDuration(previewMotionDuration(previewMotion?.entranceMs ?? SLMotion.componentMs, previewMotion), reduceMotion);

  useEffect(() => {
    progress.stopAnimation();
    if (motionDisabled) {
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
  }, [delay, entranceDuration, motionDisabled, motionKey, progress]);

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
