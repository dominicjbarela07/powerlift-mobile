// app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import {
  GeistMono_400Regular,
  GeistMono_600SemiBold,
} from '@expo-google-fonts/geist-mono';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { registerPushToken } from '@/lib/api';
import { bootLog } from '@/lib/bootLogger';
import { OnboardingSupportFooter } from '@/components/OnboardingSupportFooter';

void SplashScreen.preventAutoHideAsync().catch(() => {});
bootLog('app_start', { platform: Platform.OS });

type ExpoNotificationsModule = typeof import('expo-notifications');

const STARTUP_TIMEOUT_MS = 6000;

function StartupLoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.startupScreen}>
      <Text style={styles.startupTitle}>Strength Ledger</Text>
      <ActivityIndicator color="#C4B5FD" style={styles.startupSpinner} />
      <Text style={styles.startupMessage}>{message}</Text>
    </View>
  );
}

function RecoverableAccountStateScreen() {
  const { accountStateRefreshing, logout, refreshAccountState } = useAuth();

  return (
    <View style={styles.startupScreen}>
      <Text style={styles.startupTitle}>Strength Ledger</Text>
      <Text style={styles.recoverableTitle}>We’re having trouble loading your account.</Text>
      <Text style={styles.recoverableBody}>
        Check your connection and try again. If this keeps happening, contact Strength Ledger support.
      </Text>
      <Pressable
        style={[styles.recoverablePrimary, accountStateRefreshing && styles.recoverableDisabled]}
        onPress={() => void refreshAccountState('manual')}
        disabled={accountStateRefreshing}
      >
        <Text style={styles.recoverablePrimaryText}>
          {accountStateRefreshing ? 'Checking...' : 'Try again'}
        </Text>
      </Pressable>
      <Pressable style={styles.recoverableSecondary} onPress={logout}>
        <Text style={styles.recoverableSecondaryText}>Log out</Text>
      </Pressable>
      <OnboardingSupportFooter />
    </View>
  );
}

function RootStack() {
  const { accountStateError, authReady, user } = useAuth();
  const router = useRouter();
  const registeredPushTokenRef = useRef<string | null>(null);
  const [authWaitExpired, setAuthWaitExpired] = useState(false);
  const isIndividual =
    user?.workspace_mode === 'individual' ||
      user?.is_individual_workspace === true ||
      user?.is_self_coached === true;

  const notificationModuleRef = useRef<ExpoNotificationsModule | null>(null);

  useEffect(() => {
    if (authReady) {
      bootLog('navigation_complete', {
        route_state: user
          ? user.verification_required === true && user.email_verified === false
            ? 'verify_email'
            : user.is_coach && user.billing_required === true
            ? 'billing_activation'
            : user.is_coach
            ? 'coach_or_individual'
            : user.has_linked_athlete && user.athlete_id
            ? 'linked_athlete'
            : 'unlinked_athlete'
          : 'logged_out',
      });
      setAuthWaitExpired(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      bootLog('auth_wait_timeout', { timeout_ms: STARTUP_TIMEOUT_MS });
      console.warn('Auth bootstrap timed out; continuing to login shell.');
      setAuthWaitExpired(true);
    }, STARTUP_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user || isIndividual || Platform.OS === 'web') return;

    let cancelled = false;

    async function registerForPushNotifications() {
      bootLog('push_registration_start');
      try {
        const Notifications = await import('expo-notifications');
        const ConstantsModule = await import('expo-constants');
        const Constants = ConstantsModule.default;
        notificationModuleRef.current = Notifications;

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

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
          bootLog('push_registration_done', { status, registered: false });
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
              bootLog('push_registration_done', { registered: true });
              console.log('Push token backend registration response:', res);
              return;
            }

            bootLog('push_registration_done', { registered: false, error: res.error || 'unknown' });
            console.warn('Push token registration skipped:', res.error || 'unknown error');
          })
          .catch((err) => {
            bootLog('push_registration_done', { registered: false, error: 'network' });
            console.warn('Push token registration skipped:', err);
          });
      } catch (err) {
        bootLog('push_registration_done', { registered: false, error: 'exception' });
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

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data || {};
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
            router.push('/(tabs)/reflection' as any);
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
        });
      } catch (err) {
        console.log('Push notification response listener failed', err);
      }
    }

    bindNotificationResponseListener();

    return () => {
      mounted = false;
      if (subscription) subscription.remove();
    };
  }, [isIndividual, router, user?.is_coach]);

  // Prevent login/dashboard flicker while SecureStore rehydrates, but never stay blank forever.
  if (!authReady && !authWaitExpired) {
    return <StartupLoadingScreen message="Preparing your account..." />;
  }

  if (authReady && accountStateError && !user) {
    return <RecoverableAccountStateScreen />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="verify-email" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_600SemiBold,
  });

  useEffect(() => {
    // Fetch available updates, but do not reload during first-launch review interaction.
    if (__DEV__) return;

    (async () => {
      bootLog('updates_check_start');
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          bootLog('updates_check_done', { available: true, fetched: true });
          console.log('EAS update fetched; deferring reload until next cold start.');
        } else {
          bootLog('updates_check_done', { available: false });
        }
      } catch (e) {
        // Don’t crash the app if updates fail; just log.
        bootLog('updates_check_done', { error: 'failed' });
        console.log('EAS update check failed', e);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      bootLog('font_load_timeout', { timeout_ms: STARTUP_TIMEOUT_MS });
      console.warn('Font loading timed out; continuing with fallback fonts.');
      setFontWaitExpired(true);
    }, STARTUP_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || fontWaitExpired) {
      bootLog('font_load_done', {
        loaded: fontsLoaded,
        error: !!fontError,
        timeout: fontWaitExpired,
      });
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontError, fontWaitExpired, fontsLoaded]);

  if (!fontsLoaded && !fontError && !fontWaitExpired) {
    return <StartupLoadingScreen message="Starting Strength Ledger..." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootStack />
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  startupScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    paddingHorizontal: 24,
  },
  startupTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  startupSpinner: {
    marginTop: 18,
  },
  startupMessage: {
    marginTop: 12,
    color: '#B8ACA1',
    fontSize: 14,
    textAlign: 'center',
  },
  recoverableTitle: {
    marginTop: 18,
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  recoverableBody: {
    marginTop: 10,
    maxWidth: 320,
    color: '#B8ACA1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  recoverablePrimary: {
    minWidth: 220,
    minHeight: 50,
    marginTop: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.74)',
  },
  recoverableDisabled: {
    opacity: 0.65,
  },
  recoverablePrimaryText: {
    color: '#F5F3FF',
    fontSize: 15,
    fontWeight: '800',
  },
  recoverableSecondary: {
    minHeight: 44,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoverableSecondaryText: {
    color: '#A3A3A3',
    fontSize: 14,
    fontWeight: '700',
  },
});
