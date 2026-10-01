import { useGlobalSearchParams, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

import {
  isRestTimerNotification,
  type ActiveRestTimer,
  type RestTimerCompletionState,
  type RestTimerPresentationRoute,
} from '@/lib/rest-timer-completion-core';
import { RestTimerExpiryRouter } from '@/lib/rest-timer-expiry-router';
import { restTimerSignalForExpiry, type RestTimerSignalContext } from '@/lib/rest-timer-signal';
import { focusedSessionSince } from '@/lib/session-logger-focus';
import {
  getRestTimerCompletionState,
  hydrateRestTimerCompletion,
  reconcileGlobalRestTimerCompletion,
  subscribeRestTimerCompletion,
} from '@/lib/rest-timer-completion';

type Props = Readonly<{ userId: string | number | null | undefined }>;
const REST_COMPLETION_BEEP = require('../assets/audio/rest-completion-beep.wav');

function cancelCompletionNotification(notificationId: string | null): void {
  if (!notificationId || Platform.OS === 'web') return;
  void import('expo-notifications')
    .then((Notifications) => Notifications.cancelScheduledNotificationAsync(notificationId))
    .catch((error) => console.warn('rest completion notification cancellation failed', error));
}

/** Global lifetime keeps the media player and notification arbiter alive across Logger navigation. */
export function RestTimerCompletionPresenter({ userId }: Props) {
  const segments = useSegments() as readonly string[];
  const { workoutId: routeWorkoutId } = useGlobalSearchParams<{ workoutId?: string | string[] }>();
  const [snapshot, setSnapshot] = useState<RestTimerCompletionState>(getRestTimerCompletionState());
  const beepPlayer = useAudioPlayer(REST_COMPLETION_BEEP, {
    keepAudioSessionActive: false,
  });
  const foregroundSinceRef = useRef<number | null>(AppState.currentState === 'active' ? Date.now() : null);
  const presentationRef = useRef<{ route: RestTimerPresentationRoute; userId: string }>({
    route: { segments, workoutId: routeWorkoutId }, userId: String(userId ?? ''),
  });
  presentationRef.current = {
    route: { segments, workoutId: routeWorkoutId }, userId: String(userId ?? ''),
  };
  const audioPreparationRef = useRef<Promise<void> | null>(null);
  const playRef = useRef<(timer: ActiveRestTimer) => void>(() => undefined);
  const contextRef = useRef<(timer: ActiveRestTimer) => RestTimerSignalContext>(() => {
    throw new Error('Rest Timer context not ready');
  });

  contextRef.current = (timer) => ({
    timerId: timer.timerId,
    workoutId: timer.workoutId,
    ownerUserId: timer.ownerUserId,
    endAtMs: timer.endAtMs,
    nowMs: Date.now(),
    appState: AppState.currentState,
    foregroundSinceMs: foregroundSinceRef.current,
    loggerVisibleSinceMs: focusedSessionSince(`logger:${timer.workoutId}`),
    currentUserId: presentationRef.current.userId,
    route: presentationRef.current.route,
  });

  const configureCompletionAudio = useCallback(() => {
    // expo-audio maps this to AVAudioSession.Category.playback. AudioPlayer.play()
    // activates that session before AVPlayer starts playback.
    const preparation = setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    audioPreparationRef.current = preparation;
    return preparation;
  }, []);

  playRef.current = (timer) => {
    void (audioPreparationRef.current ?? configureCompletionAudio())
      .then(async () => {
        // Async preparation cannot turn a background expiry into a late beep.
        if (restTimerSignalForExpiry(contextRef.current(timer)) !== 'beep') return;
        if (beepPlayer.currentTime > 0) await beepPlayer.seekTo(0);
        if (restTimerSignalForExpiry(contextRef.current(timer)) !== 'beep') return;
        beepPlayer.play();
      })
      .catch((error) => console.warn('rest completion media playback failed', error));
  };

  const routerRef = useRef<RestTimerExpiryRouter | null>(null);
  if (!routerRef.current) {
    routerRef.current = new RestTimerExpiryRouter({
      readState: getRestTimerCompletionState,
      context: (timer) => contextRef.current(timer),
      cancelNotification: cancelCompletionNotification,
      playBeep: (timer) => playRef.current(timer),
    });
  }
  const expiryRouter = routerRef.current;

  useEffect(() => {
    void configureCompletionAudio().catch((error) => console.warn('rest completion audio mode unavailable', error));
  }, [configureCompletionAudio]);
  useEffect(() => {
    if (!snapshot.active) return;
    // Other media surfaces may have changed the shared iOS audio category.
    void configureCompletionAudio().catch((error) => console.warn('rest completion audio mode unavailable', error));
  }, [snapshot.active?.timerId, configureCompletionAudio]);
  useEffect(() => {
    const subscription = beepPlayer.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        void beepPlayer.seekTo(0).catch((error) => console.warn('rest completion beep reset failed', error));
      }
    });
    return () => subscription.remove();
  }, [beepPlayer]);

  useEffect(() => subscribeRestTimerCompletion(setSnapshot), []);
  useEffect(() => { void hydrateRestTimerCompletion().then(setSnapshot); }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      foregroundSinceRef.current = nextState === 'active' ? Date.now() : null;
      if (nextState === 'active') void reconcileGlobalRestTimerCompletion();
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const active = snapshot.active;
    if (!active) return undefined;
    const delay = Math.max(0, Math.ceil(active.endAtMs - Date.now()));
    const timer = setTimeout(() => {
      expiryRouter.route(active);
      void reconcileGlobalRestTimerCompletion();
    }, Math.min(delay, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [snapshot.active, expiryRouter]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let cancelled = false;
    void import('expo-notifications').then((Notifications) => {
      if (cancelled) return;
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const data = notification.request.content.data;
          if (!isRestTimerNotification(data)) {
            return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
          }
          const timerId = String(data?.timer_id ?? '');
          const scheduledEndAtMs = Number(data?.scheduled_end_at_ms);
          const active = getRestTimerCompletionState().active;
          // iOS can call the foreground handler just before its date trigger.
          if (active?.timerId === timerId && active.endAtMs > Date.now()
              && active.endAtMs - Date.now() <= 500) {
            await new Promise((resolve) => setTimeout(resolve, Math.max(0, active.endAtMs - Date.now())));
          }
          const result = expiryRouter.routeNotification(
            timerId,
            Number.isFinite(scheduledEndAtMs) && scheduledEndAtMs > 0 ? scheduledEndAtMs : null,
            notification.request.identifier,
            Date.now(),
          );
          const present = result === 'notification';
          return {
            shouldShowBanner: present,
            shouldShowList: present,
            shouldPlaySound: present,
            shouldSetBadge: false,
          };
        },
      });
    }).catch((error) => console.warn('rest completion notification handler unavailable', error));
    return () => { cancelled = true; };
  }, [expiryRouter]);

  // A non-Logger expiry uses its pre-scheduled local notification, without a second alert.
  return null;
}
