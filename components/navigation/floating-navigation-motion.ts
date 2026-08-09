import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { SLMotion } from '@/constants/theme';
import { SLEasing } from '@/lib/motion';

export function useFloatingNavigationMotion({
  expanded,
  collapsedWidth,
  expandedWidth,
  reduceMotion,
  playbackRate = 1,
  stateDurationMs = SLMotion.stateMs,
}: {
  expanded: boolean;
  collapsedWidth: number;
  expandedWidth: number;
  reduceMotion: boolean;
  playbackRate?: number;
  stateDurationMs?: number;
}) {
  const expansion = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    expansion.stopAnimation();
    if (reduceMotion) {
      expansion.setValue(expanded ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(expansion, {
      toValue: expanded ? 1 : 0,
      duration: Math.round(stateDurationMs / Math.max(0.1, playbackRate)),
      easing: SLEasing.enter,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, expansion, playbackRate, reduceMotion, stateDurationMs]);

  return {
    expansion,
    animatedWidth: expansion.interpolate({ inputRange: [0, 1], outputRange: [collapsedWidth, expandedWidth] }),
    expandedItemsOpacity: expansion.interpolate({ inputRange: [0, 0.32, 1], outputRange: [0, 0, 1] }),
    collapsedAnchorOpacity: expansion.interpolate({ inputRange: [0, 0.58, 1], outputRange: [1, 0, 0] }),
  };
}
