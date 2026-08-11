import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
} from 'expo-audio';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import {
  cueForRestTimerSecond,
  DEFAULT_REST_TIMER_CUE_CONFIG,
  REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS,
} from '@/lib/rest-timer-cues';
import {
  RestTimerAudioSequenceGate,
  RestTimerCompletionGate,
  resolveRestTimerCompletionDelivery,
  restTimerCompletionId,
  type RestTimerCompletionDelivery,
} from '@/lib/rest-timer-runtime';
import {
  clearRestTimerExpiry,
  loadRestTimerExpiry,
  persistRestTimerExpiry,
} from '@/lib/rest-timer-storage';

let Notifications: typeof import('expo-notifications') | null = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}

type ActiveRestTimer = Readonly<{
  workoutId: string;
  endAtMs: number;
  completionId: string;
}>;

export type RestTimerCompletion = Readonly<{
  id: string;
  workoutId: string;
  endAtMs: number;
  delivery: RestTimerCompletionDelivery;
}>;

type RestTimerContextValue = Readonly<{
  activeWorkoutId: string | null;
  endAtMs: number | null;
  remainingSeconds: number;
  active: boolean;
  completion: RestTimerCompletion | null;
  startTimer: (workoutId: string | number, seconds: number) => void;
  cancelTimer: (workoutId?: string | number) => void;
  restoreTimer: (workoutId: string | number) => Promise<void>;
  acknowledgeCompletion: (completionId: string) => void;
}>;

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const activeTimerRef = useRef<ActiveRestTimer | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  const notificationPermissionCheckedRef = useRef(false);
  const lastCueSecondRef = useRef<number | null>(null);
  const audioSequenceGateRef = useRef(new RestTimerAudioSequenceGate());
  const completionGateRef = useRef(new RestTimerCompletionGate());
  const audioActivationRef = useRef<Promise<void> | null>(null);
  const activeAudioCompletionIdRef = useRef<string | null>(null);
  const audioReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTimer, setActiveTimer] = useState<ActiveRestTimer | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [completion, setCompletion] = useState<RestTimerCompletion | null>(null);

  const countdownPlayer = useAudioPlayer(
    require('../assets/audio/rest-countdown-tick.wav'),
    { keepAudioSessionActive: true, updateInterval: 50 },
  );
  const finishPlayer = useAudioPlayer(
    require('../assets/audio/rest-countdown-finish.wav'),
    { keepAudioSessionActive: true, updateInterval: 50 },
  );

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!Notifications) return undefined;
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const isRestEnd = notification.request.content.data?.kind === 'rest_end';
        return {
          shouldShowAlert: !isRestEnd,
          shouldPlaySound: !isRestEnd,
          shouldSetBadge: false,
          shouldShowBanner: !isRestEnd,
          shouldShowList: !isRestEnd,
        };
      },
    });
    return undefined;
  }, []);

  useEffect(() => {
    if (!Notifications) return undefined;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      if (data.kind !== 'rest_end') return;
      const workoutId = data.workout_id ? String(data.workout_id) : '';
      if (!workoutId) return;
      router.push({
        pathname: '/(tabs)/workout/[workoutId]',
        params: { workoutId },
      } as never);
    });
    return () => subscription.remove();
  }, [router]);

  const releaseAudioFocus = useCallback(async (completionId?: string) => {
    const action = audioSequenceGateRef.current.cancel(completionId);
    if (!action.release) return;
    if (audioReleaseTimerRef.current) {
      clearTimeout(audioReleaseTimerRef.current);
      audioReleaseTimerRef.current = null;
    }
    activeAudioCompletionIdRef.current = null;
    try {
      await audioActivationRef.current;
    } catch {
      // The release below is still required if activation partially succeeded.
    }
    audioActivationRef.current = null;
    await setIsAudioActiveAsync(false).catch(() => undefined);
  }, []);

  const acquireAudioFocus = useCallback(async (completionId: string) => {
    activeAudioCompletionIdRef.current = completionId;
    const activation = (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });
      await setIsAudioActiveAsync(true);
    })();
    audioActivationRef.current = activation;
    try {
      await activation;
    } catch (error) {
      console.warn('rest timer audio focus failed', error);
      return false;
    }
    if (
      activeAudioCompletionIdRef.current !== completionId
      || !audioSequenceGateRef.current.isActiveSequence(completionId)
    ) {
      await setIsAudioActiveAsync(false).catch(() => undefined);
      return false;
    }
    return true;
  }, []);

  const deliverCue = useCallback(async (
    timer: ActiveRestTimer,
    remaining: number,
  ) => {
    if (appStateRef.current !== 'active') return;
    const cue = cueForRestTimerSecond(remaining, DEFAULT_REST_TIMER_CUE_CONFIG);
    if (cue.tone) {
      const action = audioSequenceGateRef.current.cue(timer.completionId, cue.tone);
      if (action.acquire) {
        const acquired = await acquireAudioFocus(timer.completionId);
        if (!acquired) {
          await releaseAudioFocus(timer.completionId);
          return;
        }
      } else if (audioActivationRef.current) {
        await audioActivationRef.current.catch(() => undefined);
      }
      if (!audioSequenceGateRef.current.isActiveSequence(timer.completionId)) return;
      const player = action.play === 'finish' ? finishPlayer : countdownPlayer;
      try {
        await player.seekTo(0);
        player.play();
        if (action.play === 'finish') {
          if (audioReleaseTimerRef.current) clearTimeout(audioReleaseTimerRef.current);
          audioReleaseTimerRef.current = setTimeout(() => {
            audioReleaseTimerRef.current = null;
            const completionId = activeAudioCompletionIdRef.current;
            if (!completionId) return;
            const finishAction = audioSequenceGateRef.current.finalToneFinished(completionId);
            if (!finishAction.release) return;
            activeAudioCompletionIdRef.current = null;
            const activation = audioActivationRef.current;
            audioActivationRef.current = null;
            void (async () => {
              await activation?.catch(() => undefined);
              await setIsAudioActiveAsync(false).catch(() => undefined);
            })();
          }, 900);
        }
      } catch (error) {
        console.warn('rest countdown audio failed', error);
        if (action.play === 'finish') {
          await releaseAudioFocus(timer.completionId);
        }
      }
    }
    if (cue.haptic === 'light') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } else if (cue.haptic === 'strong') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    } else if (cue.haptic === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [acquireAudioFocus, countdownPlayer, finishPlayer, releaseAudioFocus]);

  const cancelScheduledNotification = useCallback(async () => {
    if (!Notifications || !notificationIdRef.current) return;
    const notificationId = notificationIdRef.current;
    notificationIdRef.current = null;
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
  }, []);

  const ensureNotificationPermission = useCallback(async () => {
    if (!Notifications) return false;
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    if (notificationPermissionCheckedRef.current) return false;
    notificationPermissionCheckedRef.current = true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  }, []);

  const scheduleNotification = useCallback(async (timer: ActiveRestTimer) => {
    if (!Notifications || !(await ensureNotificationPermission())) return null;
    const seconds = Math.max(1, Math.ceil((timer.endAtMs - Date.now()) / 1000));
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rest complete',
          body: 'Your next set is ready.',
          sound: 'default',
          data: {
            kind: 'rest_end',
            workout_id: timer.workoutId,
            completion_id: timer.completionId,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
    } catch (error) {
      console.warn('rest timer notification scheduling failed', error);
      return null;
    }
  }, [ensureNotificationPermission]);

  const finishTimer = useCallback(async (
    timer: ActiveRestTimer,
    completedWhileBackgrounded = false,
  ) => {
    if (!completionGateRef.current.claim(timer.completionId)) return;
    const delivery = resolveRestTimerCompletionDelivery({
      appState: appStateRef.current,
      pathname: pathnameRef.current,
      workoutId: timer.workoutId,
      completedWhileBackgrounded,
    });
    if (delivery !== 'notification') await cancelScheduledNotification();
    await clearRestTimerExpiry(timer.workoutId).catch(() => undefined);
    activeTimerRef.current = null;
    setActiveTimer(null);
    setRemainingSeconds(0);
    setCompletion({
      id: timer.completionId,
      workoutId: timer.workoutId,
      endAtMs: timer.endAtMs,
      delivery,
    });
  }, [cancelScheduledNotification]);

  const syncTimer = useCallback((completedWhileBackgrounded = false) => {
    const timer = activeTimerRef.current;
    if (!timer) return;
    const remaining = Math.max(0, Math.ceil((timer.endAtMs - Date.now()) / 1000));
    setRemainingSeconds(remaining);
    if (
      appStateRef.current === 'active'
      && remaining <= REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS
      && lastCueSecondRef.current !== remaining
    ) {
      lastCueSecondRef.current = remaining;
      void deliverCue(timer, remaining);
    }
    if (remaining <= 0) {
      void finishTimer(timer, completedWhileBackgrounded);
    }
  }, [deliverCue, finishTimer]);

  useEffect(() => {
    if (!activeTimer) return undefined;
    syncTimer();
    const interval = setInterval(() => syncTimer(), 250);
    return () => clearInterval(interval);
  }, [activeTimer, syncTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== 'active') {
        void releaseAudioFocus(activeAudioCompletionIdRef.current || undefined);
        return;
      }
      const timer = activeTimerRef.current;
      const expiredWhileAway = previousState !== 'active'
        && !!timer
        && timer.endAtMs <= Date.now();
      syncTimer(expiredWhileAway);
    });
    return () => subscription.remove();
  }, [releaseAudioFocus, syncTimer]);

  const cancelTimer = useCallback((workoutId?: string | number) => {
    const timer = activeTimerRef.current;
    if (!timer) return;
    if (workoutId != null && timer.workoutId !== String(workoutId)) return;
    activeTimerRef.current = null;
    setActiveTimer(null);
    setRemainingSeconds(0);
    setCompletion((current) => current?.id === timer.completionId ? null : current);
    lastCueSecondRef.current = null;
    void clearRestTimerExpiry(timer.workoutId).catch(() => undefined);
    void cancelScheduledNotification();
    void releaseAudioFocus(timer.completionId);
  }, [cancelScheduledNotification, releaseAudioFocus]);

  const startTimer = useCallback((workoutId: string | number, seconds: number) => {
    const normalizedSeconds = Math.max(1, Math.trunc(seconds));
    const normalizedWorkoutId = String(workoutId);
    const priorTimer = activeTimerRef.current;
    if (priorTimer) cancelTimer(priorTimer.workoutId);
    const endAtMs = Date.now() + normalizedSeconds * 1000;
    const timer: ActiveRestTimer = {
      workoutId: normalizedWorkoutId,
      endAtMs,
      completionId: restTimerCompletionId(normalizedWorkoutId, endAtMs),
    };
    activeTimerRef.current = timer;
    notificationIdRef.current = null;
    lastCueSecondRef.current = null;
    setCompletion(null);
    setRemainingSeconds(normalizedSeconds);
    setActiveTimer(timer);
    void persistRestTimerExpiry(normalizedWorkoutId, endAtMs).catch(() => undefined);
    void scheduleNotification(timer).then((notificationId) => {
      if (activeTimerRef.current?.completionId !== timer.completionId) {
        if (notificationId && Notifications) {
          void Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
        }
        return;
      }
      notificationIdRef.current = notificationId;
      void persistRestTimerExpiry(normalizedWorkoutId, endAtMs, notificationId).catch(() => undefined);
    });
  }, [cancelTimer, scheduleNotification]);

  const restoreTimer = useCallback(async (workoutId: string | number) => {
    if (activeTimerRef.current) return;
    const stored = await loadRestTimerExpiry(workoutId);
    if (!stored || activeTimerRef.current) return;
    const timer: ActiveRestTimer = {
      workoutId: stored.workoutId,
      endAtMs: stored.endAtMs,
      completionId: restTimerCompletionId(stored.workoutId, stored.endAtMs),
    };
    activeTimerRef.current = timer;
    notificationIdRef.current = stored.notificationId;
    lastCueSecondRef.current = null;
    setRemainingSeconds(Math.max(0, Math.ceil((timer.endAtMs - Date.now()) / 1000)));
    setActiveTimer(timer);
  }, []);

  const acknowledgeCompletion = useCallback((completionId: string) => {
    setCompletion((current) => current?.id === completionId ? null : current);
  }, []);

  const value = useMemo<RestTimerContextValue>(() => ({
    activeWorkoutId: activeTimer?.workoutId || null,
    endAtMs: activeTimer?.endAtMs || null,
    remainingSeconds,
    active: !!activeTimer,
    completion,
    startTimer,
    cancelTimer,
    restoreTimer,
    acknowledgeCompletion,
  }), [
    acknowledgeCompletion,
    activeTimer,
    cancelTimer,
    completion,
    remainingSeconds,
    restoreTimer,
    startTimer,
  ]);

  return (
    <RestTimerContext.Provider value={value}>
      {children}
      {completion?.delivery === 'modal' ? (
        <Modal
          animationType="fade"
          transparent
          visible
          onRequestClose={() => acknowledgeCompletion(completion.id)}
        >
          <View style={styles.modalBackdrop}>
            <View accessibilityViewIsModal style={styles.modalCard}>
              <Text typographyRole="sectionTitle" style={styles.modalTitle}>Rest Complete</Text>
              <Text typographyRole="body" style={styles.modalBody}>
                Your next set is ready.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.modalButton}
                onPress={() => acknowledgeCompletion(completion.id)}
              >
                <Text typographyRole="button" style={styles.modalButtonText}>Got It</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer(): RestTimerContextValue {
  const value = useContext(RestTimerContext);
  if (!value) throw new Error('useRestTimer must be used within RestTimerProvider');
  return value;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SLSpacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: SLRadius.xl,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surfaceRaised,
    padding: SLSpacing.xl,
    gap: SLSpacing.md,
  },
  modalTitle: {
    color: SLColors.textPrimary,
  },
  modalBody: {
    color: SLColors.textMuted,
  },
  modalButton: {
    minHeight: 52,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.accentViolet,
    marginTop: SLSpacing.sm,
  },
  modalButtonText: {
    color: SLColors.textPrimary,
  },
});
