import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Text } from '@/components/ui/sl-text';
import {
  SLColors,
  SLMotion,
  SLRadius,
  SLShadows,
  SLSpacing,
} from '@/constants/theme';
import {
  REST_TIMER_ANTICIPATION_START_SECONDS,
  REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS,
} from '@/lib/rest-timer-cues';

export type RestTimerHeaderOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const SURFACE_SIZE = 248;
const ENTER_MS = 300;
const EXIT_MS = 250;

function energyForState(seconds: number, ready: boolean) {
  if (ready || seconds <= 0) return 1;
  if (seconds <= 1) return 0.82;
  if (seconds === 2) return 0.62;
  if (seconds <= REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS) return 0.42;
  const anticipationProgress =
    (
      REST_TIMER_ANTICIPATION_START_SECONDS
      - Math.min(REST_TIMER_ANTICIPATION_START_SECONDS, seconds)
    )
    / (
      REST_TIMER_ANTICIPATION_START_SECONDS
      - REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS
    );
  return 0.18 + (anticipationProgress * 0.24);
}

export function RestTimerFocus({
  visible,
  ready,
  seconds,
  reduceMotion,
  headerOrigin,
  onStop,
}: {
  visible: boolean;
  ready: boolean;
  seconds: number;
  reduceMotion: boolean;
  headerOrigin: RestTimerHeaderOrigin | null;
  onStop: () => void;
}) {
  const window = useWindowDimensions();
  const [mounted, setMounted] = React.useState(visible);
  const mountedRef = React.useRef(visible);
  const headerOriginRef = React.useRef(headerOrigin);
  const windowRef = React.useRef(window);
  const backdropOpacity = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  const surfaceOpacity = React.useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateX = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;
  const surfaceScale = React.useRef(new Animated.Value(visible ? 1 : 0.42)).current;
  const contentScale = React.useRef(new Animated.Value(1)).current;
  const energy = React.useRef(
    new Animated.Value(visible ? energyForState(seconds, ready) : 0),
  ).current;

  headerOriginRef.current = headerOrigin;
  windowRef.current = window;
  const anticipating =
    visible
    && !ready
    && seconds > REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS;

  const migrationTransform = React.useCallback(() => {
    const origin = headerOriginRef.current;
    const currentWindow = windowRef.current;
    if (!origin) {
      return {
        x: 0,
        y: -Math.max(150, currentWindow.height * 0.34),
        scale: 0.42,
      };
    }
    return {
      x: origin.x + origin.width / 2 - currentWindow.width / 2,
      y: origin.y + origin.height / 2 - currentWindow.height / 2,
      scale: Math.max(0.3, Math.min(0.56, origin.width / SURFACE_SIZE)),
    };
  }, []);

  React.useEffect(() => {
    if (visible) {
      if (mountedRef.current) return undefined;
      const start = migrationTransform();
      mountedRef.current = true;
      setMounted(true);
      backdropOpacity.setValue(0);
      surfaceOpacity.setValue(reduceMotion ? 1 : 0.32);
      translateX.setValue(reduceMotion ? 0 : start.x);
      translateY.setValue(reduceMotion ? 0 : start.y);
      surfaceScale.setValue(reduceMotion ? 1 : start.scale);

      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: reduceMotion ? SLMotion.immediateMs : ENTER_MS,
            useNativeDriver: true,
          }),
          Animated.timing(surfaceOpacity, {
            toValue: 1,
            duration: reduceMotion ? SLMotion.immediateMs : ENTER_MS,
            useNativeDriver: true,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            damping: 24,
            stiffness: 190,
            mass: 0.86,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 190,
            mass: 0.86,
            useNativeDriver: true,
          }),
          Animated.spring(surfaceScale, {
            toValue: 1,
            damping: 24,
            stiffness: 190,
            mass: 0.86,
            useNativeDriver: true,
          }),
        ]).start();
      });
      return undefined;
    }

    if (!mountedRef.current) return undefined;
    const destination = migrationTransform();
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: reduceMotion ? SLMotion.immediateMs : EXIT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(surfaceOpacity, {
        toValue: reduceMotion ? 0 : 0.28,
        duration: reduceMotion ? SLMotion.immediateMs : EXIT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: reduceMotion ? 0 : destination.x,
        duration: reduceMotion ? SLMotion.immediateMs : EXIT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: reduceMotion ? 0 : destination.y,
        duration: reduceMotion ? SLMotion.immediateMs : EXIT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(surfaceScale, {
        toValue: reduceMotion ? 1 : destination.scale,
        duration: reduceMotion ? SLMotion.immediateMs : EXIT_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      mountedRef.current = false;
      setMounted(false);
    });
    return undefined;
  }, [
    backdropOpacity,
    migrationTransform,
    reduceMotion,
    surfaceOpacity,
    surfaceScale,
    translateX,
    translateY,
    visible,
  ]);

  React.useEffect(() => {
    if (!mounted || !visible) return;
    const targetEnergy = energyForState(seconds, ready);
    Animated.timing(energy, {
      toValue: targetEnergy,
      duration: reduceMotion ? SLMotion.immediateMs : 420,
      useNativeDriver: true,
    }).start();
  }, [energy, mounted, ready, reduceMotion, seconds, visible]);

  React.useEffect(() => {
    if (!mounted || !anticipating) return undefined;
    if (reduceMotion) {
      contentScale.setValue(1);
      return undefined;
    }

    contentScale.setValue(0.99);
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(contentScale, {
          toValue: 1.015,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(contentScale, {
          toValue: 0.99,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    breathing.start();
    return () => breathing.stop();
  }, [anticipating, contentScale, mounted, reduceMotion]);

  React.useEffect(() => {
    if (!mounted || !visible || anticipating) return;
    if (reduceMotion) {
      contentScale.setValue(1);
      return;
    }
    contentScale.setValue(ready ? 0.9 : 0.84);
    Animated.spring(contentScale, {
      toValue: 1,
      damping: ready ? 13 : 16,
      stiffness: ready ? 175 : 210,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [anticipating, contentScale, mounted, ready, reduceMotion, seconds, visible]);

  if (!mounted) return null;

  const haloOpacity = energy.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.5],
  });
  const haloScale = energy.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.16],
  });
  const outerHaloOpacity = energy.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.26],
  });
  const outerHaloScale = energy.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.28],
  });
  const dimOpacity = energy.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.3],
  });

  return (
    <View
      pointerEvents="box-none"
      style={styles.layer}
      accessibilityElementsHidden={!visible}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.backdropLayer, { opacity: backdropOpacity }]}
      >
        <BlurView
          blurReductionFactor={3}
          experimentalBlurMethod="dimezisBlurView"
          intensity={68}
          style={styles.backdrop}
          tint="systemThickMaterialDark"
        />
        <Animated.View style={[styles.progressiveDim, { opacity: dimOpacity }]} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.outerHalo,
          { opacity: outerHaloOpacity, transform: [{ scale: outerHaloScale }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.focusHalo,
          { opacity: haloOpacity, transform: [{ scale: haloScale }] },
        ]}
      />

      <Animated.View
        style={[
          styles.surface,
          ready && styles.surfaceReady,
          {
            opacity: surfaceOpacity,
            transform: [{ translateX }, { translateY }, { scale: surfaceScale }],
          },
        ]}
      >
        <View style={styles.eyebrowRow}>
          <View style={[styles.liveDot, ready && styles.liveDotReady]} />
          <Text typographyRole="shortTechnicalLabel" style={styles.eyebrow}>
            Rest timer
          </Text>
        </View>

        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: contentScale }],
            },
          ]}
        >
          <Text
            accessibilityLiveRegion="assertive"
            accessibilityLabel={
              ready ? 'Rest complete. Ready.' : `${seconds} seconds of rest remaining`
            }
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            typographyRole="heroNumeric"
            style={[styles.countdown, ready && styles.readyText]}
          >
            {ready ? 'READY' : Math.max(0, seconds)}
          </Text>
          <Text typographyRole="caption" style={styles.supporting}>
            {ready ? 'Next set is ready to go.' : 'Next set is almost ready'}
          </Text>
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ready ? 'Dismiss completed rest timer' : 'Stop rest timer'}
          onPress={onStop}
          style={({ pressed }) => [
            styles.stopButton,
            ready && styles.readyCheck,
            pressed && styles.stopButtonPressed,
          ]}
        >
          <Ionicons
            name={ready ? 'checkmark' : 'stop-outline'}
            size={ready ? 21 : 13}
            color={ready ? SLColors.textStrong : SLColors.textSubtle}
          />
          {!ready ? (
            <Text typographyRole="shortButtonLabel" style={styles.stopLabel}>
              Stop
            </Text>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  progressiveDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  outerHalo: {
    position: 'absolute',
    width: 330,
    height: 330,
    borderRadius: 165,
    borderWidth: 1,
    borderColor: 'rgba(151, 106, 255, 0.36)',
    backgroundColor: 'rgba(118, 73, 214, 0.1)',
  },
  focusHalo: {
    position: 'absolute',
    width: 286,
    height: 286,
    borderRadius: 143,
    backgroundColor: 'rgba(151, 106, 255, 0.24)',
  },
  surface: {
    width: SURFACE_SIZE,
    minHeight: SURFACE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SLSpacing.lg,
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: 'rgba(167, 121, 255, 0.72)',
    backgroundColor: 'rgba(20, 13, 29, 0.97)',
    ...SLShadows.level3,
    shadowColor: SLColors.accentViolet,
    shadowOpacity: 0.52,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  surfaceReady: {
    borderColor: 'rgba(185, 147, 255, 0.88)',
    shadowOpacity: 0.68,
    shadowRadius: 42,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SLSpacing.sm,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.accentViolet,
  },
  liveDotReady: {
    backgroundColor: SLColors.success,
  },
  eyebrow: {
    color: SLColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  countdown: {
    marginTop: 8,
    color: SLColors.textStrong,
    fontSize: 66,
    lineHeight: 74,
    fontWeight: '500',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  readyText: {
    width: '100%',
    fontSize: 44,
    lineHeight: 58,
    fontWeight: '500',
    letterSpacing: -1.2,
  },
  supporting: {
    color: SLColors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  stopButton: {
    minHeight: 34,
    marginTop: SLSpacing.lg,
    paddingHorizontal: SLSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SLSpacing.xs,
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    opacity: 0.72,
  },
  stopButtonPressed: {
    opacity: 0.48,
    transform: [{ scale: 0.98 }],
  },
  stopLabel: {
    color: SLColors.textSubtle,
  },
  readyCheck: {
    width: 44,
    height: 44,
    marginTop: SLSpacing.lg,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.accentViolet,
    shadowColor: SLColors.accentViolet,
    shadowOpacity: 0.46,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
});
