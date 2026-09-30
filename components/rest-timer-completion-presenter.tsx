import {
  useGlobalSearchParams,
  useRouter,
  useSegments } from 'expo-router';
import React,
  { useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import { AppState,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import { Asset } from 'expo-asset';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import {
  canPresentRestTimerCompletion,
  isCanonicalSessionLoggerRoute,
  isRestTimerCompletionOwnedByCurrentLogger,
  isRestTimerNotification,
  type ActiveRestTimer,
  type RestTimerCompletionState,
  type RestTimerPresentationRoute,
} from '@/lib/rest-timer-completion-core';
import { RestTimerSignalGate, restTimerSignalForExpiry } from '@/lib/rest-timer-signal';
import {
  acknowledgeGlobalRestTimerCompletion,
  getRestTimerCompletionState,
  hydrateRestTimerCompletion,
  reconcileGlobalRestTimerCompletion,
  subscribeRestTimerCompletion,
} from '@/lib/rest-timer-completion';

type Props = Readonly<{ userId: string | number | null | undefined }>;
const REST_COMPLETION_BEEP = require('../assets/audio/rest-completion-beep.wav');

async function cancelCompletionNotification(notificationId: string | null): Promise<void> {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // The foreground handler is the authoritative duplicate-notification guard.
  }
}

export function RestTimerCompletionPresenter({ userId }: Props) {
  const router = useRouter();
  const segments = useSegments() as readonly string[];
  const { workoutId: routeWorkoutId } = useGlobalSearchParams<{
    workoutId?: string | string[];
  }>();
  const [snapshot, setSnapshot] = useState<RestTimerCompletionState>(
    getRestTimerCompletionState(),
  );
  const activeTimerId = snapshot.active?.timerId;
  const [applicationState, setApplicationState] = useState(AppState.currentState);
  const signalGate = useRef(new RestTimerSignalGate()).current;
  const beepPlayer = useAudioPlayer(REST_COMPLETION_BEEP, {
    keepAudioSessionActive: false,
  });
  const audioModeReadyRef = useRef(false);
  const beepResetReadyRef = useRef(true);
  const foregroundSinceRef = useRef<number | null>(
    AppState.currentState === 'active' ? Date.now() : null,
  );
  const loggerVisibleSinceRef = useRef<number | null>(null);
  const visibleLoggerKeyRef = useRef<string | null>(null);
  const route: RestTimerPresentationRoute = { segments, workoutId: routeWorkoutId };
  const loggerKey = isCanonicalSessionLoggerRoute(route)
    ? String(Array.isArray(routeWorkoutId) ? routeWorkoutId[0] : routeWorkoutId ?? '')
    : null;
  if (loggerKey !== visibleLoggerKeyRef.current) {
    visibleLoggerKeyRef.current = loggerKey;
    loggerVisibleSinceRef.current = loggerKey ? Date.now() : null;
  }
  const contextRef = useRef({ route, userId: String(userId ?? '') });
  contextRef.current = { route, userId: String(userId ?? '') };
  const signalAtExpiryRef = useRef<(timer: ActiveRestTimer) => 'beep' | 'notification'>(() => 'notification');
  signalAtExpiryRef.current = (timer) => {
    const existing = signalGate.get(timer.timerId);
    if (existing) return existing;
    const current = getRestTimerCompletionState();
    if (current.active?.timerId !== timer.timerId
      && current.pending?.timerId !== timer.timerId) return 'notification';
    if (current.active && current.active.endAtMs !== timer.endAtMs) return 'notification';
    const signal = restTimerSignalForExpiry({
      timerId: timer.timerId,
      workoutId: timer.workoutId,
      ownerUserId: timer.ownerUserId,
      endAtMs: timer.endAtMs,
      nowMs: Date.now(),
      appState: AppState.currentState,
      foregroundSinceMs: foregroundSinceRef.current,
      loggerVisibleSinceMs: loggerVisibleSinceRef.current,
      currentUserId: contextRef.current.userId,
      route: contextRef.current.route,
    });
    if (signal === 'beep') {
      // The native player is prepared while the timer runs. If it is unavailable,
      // retain the scheduled notification instead of silently losing the alert.
      if (!audioModeReadyRef.current || !beepPlayer.isLoaded || !beepResetReadyRef.current) {
        console.warn('rest completion using notification: app audio unavailable', {
          audioModeReady: audioModeReadyRef.current,
          playerLoaded: beepPlayer.isLoaded,
          playerReset: beepResetReadyRef.current,
        });
        return signalGate.claim(timer.timerId, 'notification');
      }
      signalGate.claim(timer.timerId, 'beep');
      try {
        beepPlayer.play();
        void cancelCompletionNotification(timer.notificationId);
      } catch (error) {
        signalGate.replace(timer.timerId, 'notification');
        console.warn('rest completion beep failed', error);
        return 'notification';
      }
      return 'beep';
    }
    return signalGate.claim(timer.timerId, 'notification');
  };

  const configureCompletionAudio = useCallback(async () => {
    // expo-audio maps this to AVAudioSession.Category.playback with duckOthers.
    // The category permits app audio in Silent Mode; the one-shot player
    // deactivates the session afterward and notifies other audio apps.
    audioModeReadyRef.current = false;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: false,
      });
      audioModeReadyRef.current = true;
    } catch (error) {
      console.warn('rest completion audio mode unavailable', error);
    }
  }, []);

  useEffect(() => {
    void configureCompletionAudio();
    // Give AVPlayer a source immediately, then replace it with the local asset
    // once Expo has materialized the bundled WAV (including OTA assets).
    let cancelled = false;
    const asset = Asset.fromModule(REST_COMPLETION_BEEP);
    void asset.downloadAsync().then(() => {
      if (!cancelled && asset.localUri && !beepPlayer.playing) {
        beepPlayer.replace({ uri: asset.localUri });
      }
    }).catch((error) => {
      console.warn('rest completion local beep preload failed', error);
    });
    const subscription = beepPlayer.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      beepResetReadyRef.current = false;
      void beepPlayer.seekTo(0).then(() => {
        beepResetReadyRef.current = true;
      }).catch((error) => {
        console.warn('rest completion beep reset failed', error);
      });
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [beepPlayer, configureCompletionAudio]);

  useEffect(() => {
    if (!activeTimerId) return;
    // Other media surfaces can change the shared iOS session after app launch.
    // Reassert playback category before each timer's deadline.
    void configureCompletionAudio();
  }, [activeTimerId, configureCompletionAudio]);

  useEffect(() => subscribeRestTimerCompletion(setSnapshot), []);

  useEffect(() => {
    void hydrateRestTimerCompletion().then(setSnapshot);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      foregroundSinceRef.current = nextState === 'active' ? Date.now() : null;
      setApplicationState(nextState);
      if (nextState === 'active') void reconcileGlobalRestTimerCompletion();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const active = snapshot.active;
    if (!active) return undefined;
    const delay = Math.max(0, active.endAtMs - Date.now());
    const timer = setTimeout(() => {
      signalAtExpiryRef.current(active);
      void reconcileGlobalRestTimerCompletion();
    }, Math.min(delay, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [snapshot.active]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let cancelled = false;
    void import('expo-notifications').then((Notifications) => {
      if (cancelled) return;
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const data = notification.request.content.data;
          let suppressRestEnd = false;
          if (isRestTimerNotification(data)) {
            const timerId = String(data?.timer_id ?? '');
            const existing = signalGate.get(timerId);
            const state = getRestTimerCompletionState();
            const active = state.active?.timerId === timerId ? state.active : null;
            if (existing === 'beep') suppressRestEnd = true;
            else if (active) suppressRestEnd = signalAtExpiryRef.current(active) === 'beep';
            else if (state.active && timerId && state.active.timerId !== timerId) {
              // A cancelled deadline from an extended/replaced timer is stale.
              suppressRestEnd = true;
            }
          }
          return {
            shouldShowAlert: !suppressRestEnd,
            shouldShowBanner: !suppressRestEnd,
            shouldShowList: !suppressRestEnd,
            shouldPlaySound: !suppressRestEnd,
            shouldSetBadge: false,
          };
        },
      });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [signalGate]);

  const presentationRoute = {
    segments,
    workoutId: routeWorkoutId,
  } as const;
  const loggerOwnsCompletion = isRestTimerCompletionOwnedByCurrentLogger(
    snapshot.pending,
    presentationRoute,
  );
  const visible = canPresentRestTimerCompletion(
    snapshot,
    userId,
    applicationState,
    presentationRoute,
  );
  const pending = visible ? snapshot.pending : null;

  useEffect(() => {
    const completedTimer = snapshot.pending;
    if (!completedTimer || !loggerOwnsCompletion) return;
    void cancelCompletionNotification(completedTimer.notificationId);
    void acknowledgeGlobalRestTimerCompletion(completedTimer.timerId);
  }, [loggerOwnsCompletion, snapshot.pending?.notificationId, snapshot.pending?.timerId]);

  useEffect(() => {
    if (!pending) return;
    void cancelCompletionNotification(pending.notificationId);
  }, [pending]);

  const originatingSessionRoute = useMemo(() => pending
    ? {
        pathname: '/(tabs)/workout/[workoutId]' as const,
        params: { workoutId: pending.workoutId },
      }
    : null, [pending]);

  const dismiss = useCallback(() => {
    if (!pending) return;
    void acknowledgeGlobalRestTimerCompletion(pending.timerId);
  }, [pending]);

  const returnToSession = useCallback(() => {
    if (!pending || !originatingSessionRoute) return;
    void acknowledgeGlobalRestTimerCompletion(pending.timerId);
    router.push(originatingSessionRoute as any);
  }, [originatingSessionRoute, pending, router]);

  if (!pending) return null;

  return (
    <View style={styles.layer} accessibilityViewIsModal>
      <View style={styles.scrim} />
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.eyebrow}>REST TIMER</Text>
        <Text style={styles.title}>Rest Timer Complete</Text>
        <Text style={styles.body}>Your rest period is over.</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss rest timer completion"
            onPress={dismiss}
            style={({ pressed }) => [styles.action, styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Dismiss</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to originating training session"
            onPress={returnToSession}
            style={({ pressed }) => [styles.action, styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Return to Session</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 10_000,
    elevation: 10_000,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SLColors.scrim,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: SLColors.borderFocus,
    backgroundColor: SLColors.surfaceFloating,
    padding: 24,
  },
  eyebrow: {
    color: SLColors.accentMuted,
    fontFamily: SLFontFamilies.bodyBold,
    fontSize: 13,
    letterSpacing: 1.5,
  },
  title: {
    color: SLColors.textPrimary,
    fontFamily: SLFontFamilies.bodyBold,
    fontSize: 26,
    lineHeight: 32,
    marginTop: 8,
  },
  body: {
    color: SLColors.textSecondary,
    fontFamily: SLFontFamilies.body,
    fontSize: 18,
    lineHeight: 25,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  action: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 12,
  },
  secondary: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderStandard,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: SLColors.accent,
  },
  secondaryText: {
    color: SLColors.textPrimary,
    fontFamily: SLFontFamilies.bodyBold,
    fontSize: 16,
  },
  primaryText: {
    color: SLColors.textInverted,
    fontFamily: SLFontFamilies.bodyBold,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
