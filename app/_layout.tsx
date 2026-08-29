// app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import type { NotificationResponse } from 'expo-notifications';
import { ActivityIndicator, Alert, AppState, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { API_BASE, registerPushToken } from '@/lib/api';
import { isUpdateReloadSafe, subscribeUpdateSafety } from '@/lib/updateSafety';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import { Text } from '@/components/ui/sl-text';
import { AppShell } from '@/components/AppShell';
import { RestTimerCompletionPresenter } from '@/components/rest-timer-completion-presenter';
import { isRestTimerNotification } from '@/lib/rest-timer-completion-core';
import { acknowledgeGlobalRestTimerCompletion } from '@/lib/rest-timer-completion';
import { initializeSessionTimingTelemetry } from '@/lib/session-timing-telemetry';

void SplashScreen.preventAutoHideAsync().catch(() => {});

type ExpoNotificationsModule = typeof import('expo-notifications');

const STARTUP_TIMEOUT_MS = 6000;
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const UPDATE_PROMPT_DELAY_MS = 15 * 60 * 1000;

function OtaUpdateController() {
  const isTestFlightRelease =
    (Constants.expoConfig?.extra as { releaseTrack?: string } | undefined)?.releaseTrack === 'testflight';
  const [updateReady, setUpdateReady] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [requiredError, setRequiredError] = useState<string | null>(null);
  const [safetyVersion, setSafetyVersion] = useState(0);
  const lastCheckRef = useRef(0);
  const checkingRef = useRef(false);
  const promptOpenRef = useRef(false);
  const promptAfterRef = useRef(0);

  const checkForUpdates = useCallback(async (ignoreThrottle = false) => {
    if (__DEV__ || checkingRef.current) return;
    const now = Date.now();
    if (!ignoreThrottle && now - lastCheckRef.current < UPDATE_CHECK_INTERVAL_MS) return;
    checkingRef.current = true;
    lastCheckRef.current = now;
    setRequiredError(null);

    let policyForce = false;
    try {
      const revision = Number((Constants.expoConfig?.extra as any)?.appRevision || 0);
      try {
        const policyResponse = await fetch(`${API_BASE}/mobile/release-policy`, {
          headers: { 'X-Strength-Ledger-Client-Revision': String(revision) },
        });
        if (policyResponse.ok) {
          const policy = await policyResponse.json();
          policyForce = policy.force_update === true;
          setForceUpdate(policyForce);
        }
      } catch (policyError) {
        console.log('Release policy check failed', policyError);
      }

      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        setUpdateReady(true);
      } else if (policyForce) {
        setRequiredError('The required update is not available yet. Please try again.');
      }
    } catch (error) {
      setRequiredError('Could not download the update. Check your connection and try again.');
      console.log('EAS update check failed', error);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void checkForUpdates(true);
    const safetySubscription = subscribeUpdateSafety(() => setSafetyVersion((value) => value + 1));
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdates(false);
    });
    return () => {
      safetySubscription();
      appStateSubscription.remove();
    };
  }, [checkForUpdates]);

  useEffect(() => {
    if (
      !updateReady ||
      forceUpdate ||
      isTestFlightRelease ||
      !isUpdateReloadSafe() ||
      promptOpenRef.current
    ) return;
    const delay = Math.max(0, promptAfterRef.current - Date.now());
    const timer = setTimeout(() => {
      if (!isUpdateReloadSafe() || promptOpenRef.current) return;
      promptOpenRef.current = true;
      Alert.alert(
        'Update ready',
        'A new version of Strength Ledger is ready.',
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => {
              promptAfterRef.current = Date.now() + UPDATE_PROMPT_DELAY_MS;
              promptOpenRef.current = false;
              setSafetyVersion((value) => value + 1);
            },
          },
          {
            text: 'Update Now',
            onPress: () => {
              promptOpenRef.current = false;
              if (isUpdateReloadSafe()) void Updates.reloadAsync();
            },
          },
        ],
        { cancelable: false },
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [forceUpdate, isTestFlightRelease, safetyVersion, updateReady]);

  useEffect(() => {
    if ((!forceUpdate && !isTestFlightRelease) || !updateReady || !isUpdateReloadSafe()) return;
    void Updates.reloadAsync().catch(() => {
      setRequiredError('The update could not be applied. Please try again.');
    });
  }, [forceUpdate, isTestFlightRelease, safetyVersion, updateReady]);

  const showRequiredGate = forceUpdate && isUpdateReloadSafe();
  return (
    <Modal visible={showRequiredGate} animationType="fade" presentationStyle="fullScreen">
      <View style={styles.updateGate}>
        <Text typographyRole="pageTitle" style={styles.updateGateTitle}>Update Required</Text>
        <Text typographyRole="supportingBody" style={styles.updateGateBody}>
          {requiredError || (updateReady ? 'Restarting Strength Ledger…' : 'Downloading the latest version…')}
        </Text>
        {!updateReady ? <ActivityIndicator color={SLColors.accentViolet} style={styles.updateGateSpinner} /> : null}
        {requiredError ? (
          <TouchableOpacity
            style={styles.updateGateButton}
            onPress={() => {
              if (updateReady) {
                void Updates.reloadAsync().catch(() => {
                  setRequiredError('The update could not be applied. Please try again.');
                });
              } else {
                void checkForUpdates(true);
              }
            }}
          >
            <Text typographyRole="buttonLabel" style={styles.updateGateButtonText}>Try Again</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}

const appNavigationFonts = {
  regular: { fontFamily: SLFontFamilies.body, fontWeight: '400' as const },
  medium: { fontFamily: SLFontFamilies.bodyMedium, fontWeight: '400' as const },
  bold: { fontFamily: SLFontFamilies.bodyBold, fontWeight: '400' as const },
  heavy: { fontFamily: SLFontFamilies.bodyBold, fontWeight: '400' as const },
};

const appOLEDTheme = {
  ...DarkTheme,
  fonts: appNavigationFonts,
  colors: {
    ...DarkTheme.colors,
    primary: SLColors.accent,
    background: SLColors.canvas,
    card: SLColors.plane,
    text: SLColors.textPrimary,
    border: SLColors.borderSubtle,
    notification: SLColors.accentMagenta,
  },
};

function StartupLoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.startupScreen}>
      <Text typographyRole="pageTitle" style={styles.startupTitle}>Strength Ledger</Text>
      <ActivityIndicator color={SLColors.accentViolet} style={styles.startupSpinner} />
      <Text typographyRole="supportingBody" style={styles.startupMessage}>{message}</Text>
    </View>
  );
}

function RootStack() {
  const { authReady, user, activeMobileMode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const registeredPushTokenRef = useRef<string | null>(null);
  const [authWaitExpired, setAuthWaitExpired] = useState(false);
  const isIndividual = activeMobileMode === 'individual';
  const isDevSessionRecapCertification =
    __DEV__ && pathname === '/dev-session-recap-certification';

  const notificationModuleRef = useRef<ExpoNotificationsModule | null>(null);

  useEffect(() => {
    if (authReady) {
      setAuthWaitExpired(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      console.warn('Auth bootstrap timed out; continuing to login shell.');
      setAuthWaitExpired(true);
    }, STARTUP_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [authReady]);

  useEffect(() => {
    if (!authReady || !user || isIndividual || Platform.OS === 'web') return;

    let cancelled = false;

    async function registerForPushNotifications() {
      try {
        const Notifications = await import('expo-notifications');
        const ConstantsModule = await import('expo-constants');
        const Constants = ConstantsModule.default;
        notificationModuleRef.current = Notifications;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        console.log('Push permission existing status:', status);
        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
          console.log('Push permission requested status:', status);
        }

        if (status !== 'granted' || cancelled) {
          console.log('Push notification permission not granted');
          return;
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ||
          Constants.easConfig?.projectId;
        if (!projectId) {
          console.log('Expo push projectId missing; token request may fail in EAS builds');
        }
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        const expoPushToken = tokenResult.data;
        console.log(
          'Expo push token received:',
          expoPushToken ? `${expoPushToken.slice(0, 18)}...${expoPushToken.slice(-6)}` : 'empty'
        );

        if (!expoPushToken || registeredPushTokenRef.current === expoPushToken || cancelled) {
          return;
        }

        void registerPushToken(expoPushToken, Platform.OS)
          .then((res) => {
            if (cancelled) return;
            if (res.ok) {
              registeredPushTokenRef.current = expoPushToken;
              console.log('Push token backend registration response:', res);
              return;
            }

            console.warn('Push token registration skipped:', res.error || 'unknown error');
          })
          .catch((err) => {
            console.warn('Push token registration skipped:', err);
          });
      } catch (err) {
        console.warn('Push notification registration skipped:', err);
      }
    }

    registerForPushNotifications();

    return () => {
      cancelled = true;
    };
  }, [authReady, isIndividual, user]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let mounted = true;
    let subscription: { remove: () => void } | null = null;

    async function bindNotificationResponseListener() {
      try {
        const Notifications = notificationModuleRef.current || await import('expo-notifications');
        if (!mounted) return;
        notificationModuleRef.current = Notifications;

        const handleNotificationResponse = (response: NotificationResponse) => {
          const data = response.notification.request.content.data || {};
          if (isRestTimerNotification(data)) {
            const workoutId = data.workout_id ? String(data.workout_id) : '';
            const timerId = data.timer_id ? String(data.timer_id) : '';
            const ownerUserId = data.owner_user_id ? String(data.owner_user_id) : '';
            const currentUserId = String(user?.id ?? user?.user_id ?? '');
            if (ownerUserId && ownerUserId !== currentUserId) return;
            void acknowledgeGlobalRestTimerCompletion(timerId || undefined);
            if (workoutId) {
              router.push({
                pathname: '/(tabs)/workout/[workoutId]',
                params: { workoutId },
              } as any);
            }
            return;
          }
          if (
            isIndividual &&
            (data.type === 'announcement' ||
              data.type === 'message' ||
              data.type === 'video_submission' ||
              data.type === 'check_in_due')
          ) {
            router.push('/(tabs)/athlete-dashboard' as any);
            return;
          }

          if (data.type === 'announcement') {
            router.push('/(tabs)/messages/announcements' as any);
            return;
          }

          if (data.type === 'video_feedback') {
            router.push('/(tabs)/coach-reviews' as any);
            return;
          }

          if (data.type === 'video_submission') {
            router.push('/(tabs)/coach-video-review' as any);
            return;
          }

          if (data.type === 'check_in_due') {
            const submissionId = data.submission_id ? String(data.submission_id) : '';
            if (submissionId) {
              router.push({
                pathname: '/(tabs)/check-in/[submissionId]',
                params: { submissionId, returnTo: 'today' },
              } as any);
              return;
            }
            router.push('/(tabs)/check-ins' as any);
            return;
          }

          if (data.type === 'session_feedback') {
            const workoutId = data.workout_id ? String(data.workout_id) : '';
            if (workoutId) {
              router.push({
                pathname: '/(tabs)/workout/[workoutId]',
                params: { workoutId },
              } as any);
              return;
            }
            router.push('/(tabs)/ledger/archive' as any);
            return;
          }

          if (data.type !== 'message') return;

          const threadId = data.threadId ? String(data.threadId) : '';
          if (user?.is_coach && threadId) {
            router.push({
              pathname: '/(tabs)/messages/[threadId]',
              params: { threadId },
            } as any);
            return;
          }

          router.push('/(tabs)/messages/index' as any);
        };

        subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
        const initialResponse = await Notifications.getLastNotificationResponseAsync();
        if (mounted && initialResponse) {
          handleNotificationResponse(initialResponse);
          Notifications.clearLastNotificationResponse();
        }
      } catch (err) {
        console.log('Push notification response listener failed', err);
      }
    }

    bindNotificationResponseListener();

    return () => {
      mounted = false;
      if (subscription) subscription.remove();
    };
  }, [isIndividual, router, user?.id, user?.is_coach, user?.user_id]);

  // Prevent login/dashboard flicker while SecureStore rehydrates, but never stay blank forever.
  if (!authReady && !authWaitExpired && !isDevSessionRecapCertification) {
    return <StartupLoadingScreen message="Preparing your account..." />;
  }

  return (
    <>
      <Stack screenOptions={{ contentStyle: styles.transparentScene }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="movement-history-sheet"
          options={{
            animation: 'none',
            contentStyle: styles.transparentScene,
            gestureEnabled: false,
            headerShown: false,
            presentation: 'transparentModal',
          }}
        />
        <Stack.Screen
          name="coach-team-brief"
          options={{
            animation: 'slide_from_bottom',
            contentStyle: styles.modalScene,
            gestureEnabled: true,
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="coach-team-outliers"
          options={{
            animation: 'slide_from_right',
            contentStyle: styles.modalScene,
            gestureEnabled: true,
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="coach-athlete-analytics/[athleteId]"
          options={{
            animation: 'slide_from_right',
            contentStyle: styles.modalScene,
            gestureEnabled: true,
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="coach-team-methodology"
          options={{
            animation: 'slide_from_bottom',
            contentStyle: styles.modalScene,
            gestureEnabled: true,
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
      </Stack>
      <RestTimerCompletionPresenter userId={user?.id ?? user?.user_id} />
    </>
  );
}

export default function RootLayout() {
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Michroma: require('@/assets/fonts/Michroma-Regular.ttf'),
    'Exo2-Regular': require('@/assets/fonts/Exo2-Regular.ttf'),
    'Exo2-Medium': require('@/assets/fonts/Exo2-Medium.ttf'),
    'Exo2-SemiBold': require('@/assets/fonts/Exo2-SemiBold.ttf'),
    'Exo2-Bold': require('@/assets/fonts/Exo2-Bold.ttf'),
  });

  useEffect(() => {
    void initializeSessionTimingTelemetry();
  }, []);

  useEffect(() => {
    if (__DEV__ && fontError) {
      console.warn('Bundled Strength Ledger font loading failed; continuing with platform fallback.', fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) return undefined;

    const timer = setTimeout(() => {
      console.warn('Font loading timed out; continuing with fallback fonts.');
      setFontWaitExpired(true);
    }, STARTUP_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded || fontError || fontWaitExpired) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontError, fontWaitExpired, fontsLoaded]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <AppShell>
        {!fontsLoaded && !fontError && !fontWaitExpired ? (
          <StartupLoadingScreen message="Starting Strength Ledger..." />
        ) : (
          <AuthProvider>
            <ThemeProvider value={appOLEDTheme}>
              <RootStack />
              <OtaUpdateController />
              <StatusBar style="light" />
            </ThemeProvider>
          </AuthProvider>
        )}
      </AppShell>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  updateGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.canvas,
    paddingHorizontal: 28,
  },
  updateGateTitle: {
    color: SLColors.textStrong,
    textAlign: 'center',
  },
  updateGateBody: {
    marginTop: 12,
    color: SLColors.textMuted,
    textAlign: 'center',
  },
  updateGateSpinner: {
    marginTop: 24,
  },
  updateGateButton: {
    minWidth: 180,
    minHeight: 50,
    marginTop: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.accentViolet,
  },
  updateGateButtonText: {
    color: SLColors.textStrong,
  },
  gestureRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  transparentScene: {
    backgroundColor: 'transparent',
  },
  modalScene: {
    backgroundColor: SLColors.canvas,
  },
  startupScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  startupTitle: {
    color: SLColors.textStrong,
    textAlign: 'center',
  },
  startupSpinner: {
    marginTop: 18,
  },
  startupMessage: {
    marginTop: 12,
    color: SLColors.textMuted,
    textAlign: 'center',
  },
});
