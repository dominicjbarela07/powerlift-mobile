// app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useRef } from 'react';
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
import { Platform } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { registerPushToken } from '@/lib/api';

void SplashScreen.preventAutoHideAsync().catch(() => {});

type ExpoNotificationsModule = typeof import('expo-notifications');

function RootStack() {
  const { authReady, user } = useAuth();
  const router = useRouter();
  const registeredPushTokenRef = useRef<string | null>(null);

  const notificationModuleRef = useRef<ExpoNotificationsModule | null>(null);

  useEffect(() => {
    if (!authReady || !user || Platform.OS === 'web') return;

    let cancelled = false;

    async function registerForPushNotifications() {
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
  }, [authReady, user]);

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
  }, [router, user?.is_coach]);

  // Prevent login/dashboard flicker while SecureStore rehydrates
  if (!authReady) return null;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_600SemiBold,
  });

  useEffect(() => {
    // Force EAS Updates check on launch for TestFlight builds.
    // If your embedded updates config is conservative, this ensures OTA actually applies.
    if (__DEV__) return;

    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        // Don’t crash the app if updates fail; just log.
        console.log('EAS update check failed', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

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
