// app/(tabs)/_layout.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SLAtmosphere } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { getUnreadSummary } from '@/lib/api';
import { SLColors, SLTypography } from '@/constants/theme';
import {
  getMobileViewMode,
  subscribeMobileViewModeChanged,
  type MobileViewMode,
} from '@/lib/mobileViewMode';

function FilteredTabBar({
  state,
  descriptors,
  navigation,
  isCoach,
  viewMode,
  hasMeetDate,
  hasMessageNotifications,
  onMessagesTabPress,
}: BottomTabBarProps & {
  isCoach: boolean;
  viewMode: MobileViewMode;
  hasMeetDate: boolean;
  hasMessageNotifications: boolean;
  onMessagesTabPress: () => void;
}) {
  const router = useRouter();
  const allowedNames =
    isCoach && viewMode === 'coach'
      ? ['coach-dashboard', 'coach-roster', 'coach-calendar', 'coach-videos', 'messages/index']
      : [
          'athlete-dashboard',
          'workout/index',
          'athlete-calendar',
          'athlete-progression',
          'reflection',
          ...(hasMeetDate ? ['athlete-meet-plan'] : []),
        ];

  const messagesRoute =
    state.routes.find((route) => route.name === 'messages') ||
    state.routes.find((route) => route.name === 'messages/index');
  const trainingRoute =
    state.routes.find((route) => route.name === 'workout/index') ||
    state.routes.find((route) => route.name === 'workout');

  const visibleRoutes = allowedNames.reduce((routes, name) => {
    if ((name === 'messages' || name === 'messages/index') && messagesRoute) {
      if (!routes.some((route) => route.key === messagesRoute.key)) routes.push(messagesRoute);
      return routes;
    }

    if (name === 'workout/index' && trainingRoute) {
      if (!routes.some((route) => route.key === trainingRoute.key)) routes.push(trainingRoute);
      return routes;
    }

    const route = state.routes.find((item) => item.name === name);
    if (route && !routes.some((item) => item.key === route.key)) routes.push(route);
    return routes;
  }, [] as typeof state.routes);

  const tabConfig: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    'coach-dashboard': { label: 'Today', icon: 'home-outline' },
    'coach-roster': { label: 'Roster', icon: 'people-outline' },
    'coach-calendar': { label: 'Calendar', icon: 'calendar-outline' },
    'coach-videos': { label: 'Videos', icon: 'videocam-outline' },
    workout: { label: 'Training', icon: 'barbell-outline' },
    'workout/index': { label: 'Training', icon: 'barbell-outline' },
    workouts: { label: 'Training', icon: 'barbell-outline' },
    'athlete-calendar': { label: 'Calendar', icon: 'calendar-outline' },
    'athlete-progression': { label: 'Progression', icon: 'trending-up-outline' },
    reflection: { label: 'Reflection', icon: 'sparkles-outline' },
    messages: { label: 'Messages', icon: 'chatbubbles-outline' },
    'messages/index': { label: 'Messages', icon: 'chatbubbles-outline' },
    'athlete-dashboard': { label: 'Today', icon: 'home-outline' },
    'video-archive': { label: 'Video Archive', icon: 'videocam-outline' },
    'athlete-meet-plan': { label: 'Meet', icon: 'trophy-outline' },
  };

  return (
    <View style={styles.tabBar}>
      {visibleRoutes.map((route) => {
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const isFocused = state.index === routeIndex;
        const color = isFocused ? SLColors.accentViolet : '#C8D0D8';
        const cfg = tabConfig[route.name] ?? { label: route.name, icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap };
        const isMessagesRoute = route.name === 'messages' || route.name === 'messages/index';
        const isTrainingRoute = route.name === 'workout' || route.name === 'workout/index';
        const iconName = isFocused
          ? (cfg.icon.endsWith('-outline')
              ? (cfg.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap)
              : cfg.icon)
          : cfg.icon;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            if (isTrainingRoute) {
              router.navigate('/(tabs)/workout');
            } else {
              navigation.navigate(route.name as never);
            }
          }

          if (isMessagesRoute) {
            onMessagesTabPress();
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabBarItem}
            activeOpacity={0.85}
          >
            <View style={styles.tabBarIconRow}>
              <Ionicons name={iconName} size={24} color={color} />
              {isMessagesRoute && hasMessageNotifications && (
                <View style={styles.messageNotificationDot} />
              )}
            </View>
            <ThemedText style={[styles.tabBarLabel, { color }]}>{cfg.label}</ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [hasMessageNotifications, setHasMessageNotifications] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('coach');
  const [mobileViewModeLoaded, setMobileViewModeLoaded] = useState(false);
  const unreadPollingRef = useRef(false);

  const isCoach = !!user?.is_coach;
  const viewMode: MobileViewMode = isCoach ? mobileViewMode : 'athlete';
  const hasMeetDate = viewMode === 'athlete' && !!(user as any)?.meet_date;

  useEffect(() => {
    let mounted = true;
    setMobileViewModeLoaded(false);

    getMobileViewMode(isCoach).then((mode) => {
      if (mounted) {
        setMobileViewMode(mode);
        setMobileViewModeLoaded(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isCoach, user?.email]);

  useEffect(() => {
    if (!isCoach) return undefined;

    return subscribeMobileViewModeChanged((mode) => {
      setMobileViewMode(mode);
      setMobileViewModeLoaded(true);
    });
  }, [isCoach]);

  useEffect(() => {
    if (!isCoach || !mobileViewModeLoaded) return;
    if (pathname.includes('/settings') || pathname.includes('/messages')) return;

    const isAthleteFacingPath =
      pathname.includes('/athlete-dashboard') ||
      pathname.includes('/athlete-calendar') ||
      pathname.includes('/athlete-progression') ||
      pathname.includes('/reflection') ||
      pathname.includes('/coach-reviews') ||
      pathname.includes('/video-archive') ||
      pathname.includes('/athlete-meet-plan');
    const isCoachFacingPath =
      pathname.includes('/coach-dashboard') ||
      pathname.includes('/coach-roster') ||
      pathname.includes('/coach-calendar') ||
      pathname.includes('/coach-videos') ||
      pathname.includes('/coach-video-review') ||
      pathname.includes('/coach-video-archive');

    if (viewMode === 'coach' && isAthleteFacingPath) {
      router.replace('/coach-dashboard');
    } else if (viewMode === 'athlete' && isCoachFacingPath) {
      router.replace('/(tabs)/athlete-dashboard');
    }
  }, [isCoach, mobileViewModeLoaded, pathname, router, viewMode]);

  const refreshMessageNotifications = useCallback(async () => {
    if (!user || unreadPollingRef.current) {
      if (!user) setHasMessageNotifications(false);
      return;
    }

    unreadPollingRef.current = true;
    try {
      const res = await getUnreadSummary();
      if (res.ok && res.summary) {
        setHasMessageNotifications(!!res.summary.has_unread);
      }
    } catch (err) {
      console.warn('Message notification refresh failed', err);
    } finally {
      unreadPollingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    refreshMessageNotifications();

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        refreshMessageNotifications();
      }
    }, 20000);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshMessageNotifications();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshMessageNotifications]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SLAtmosphere />
      <Tabs
        screenOptions={{
          header: () => (
            <ThemedView style={styles.headerShell}>
              <View style={styles.headerRow}>
                <TouchableOpacity
                  onPress={() => {
                    router.push('/(tabs)/settings');
                  }}
                  style={styles.headerSideButton}
                >
                  <Ionicons name="settings-outline" size={22} color="#E5E7EB" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (isCoach && viewMode === 'coach') {
                      router.replace('/coach-dashboard');
                    } else {
                      router.replace('/(tabs)/athlete-dashboard');
                    }
                  }}
                  style={styles.headerTitleWrap}
                >
                  <Image
                    source={require('@/assets/images/16:9.png')}
                    style={{ width: 200, height: 32, resizeMode: 'contain' }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (viewMode === 'athlete') {
                      refreshMessageNotifications();
                      router.push('/(tabs)/messages');
                    }
                  }}
                  style={styles.headerSideButton}
                >
                  <Ionicons
                    name={viewMode === 'athlete' ? 'chatbubbles-outline' : 'notifications-outline'}
                    size={viewMode === 'athlete' ? 21 : 20}
                    color="#E5E7EB"
                  />
                  {viewMode === 'athlete' && hasMessageNotifications ? (
                    <View style={styles.messageNotificationDot} />
                  ) : null}
                </TouchableOpacity>
              </View>
            </ThemedView>
          ),
          headerShown: true,
          sceneStyle: styles.tabScene,
          tabBarHideOnKeyboard: true,
        }}
        tabBar={(props) => (
          <FilteredTabBar
            {...props}
            isCoach={isCoach}
            viewMode={viewMode}
            hasMeetDate={hasMeetDate}
            hasMessageNotifications={hasMessageNotifications}
            onMessagesTabPress={refreshMessageNotifications}
          />
        )}
      >
        <Tabs.Screen
          name="coach-dashboard"
          options={{
            title: 'Today',
            href: isCoach && viewMode === 'coach' ? '/coach-dashboard' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="athlete-dashboard"
          options={{
            title: 'Today',
            href: viewMode === 'athlete' ? '/(tabs)/athlete-dashboard' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="coach-roster"
          options={{
            title: 'Roster',
            href: isCoach && viewMode === 'coach' ? '/coach-roster' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="coach-calendar"
          options={{
            title: 'Calendar',
            href: isCoach && viewMode === 'coach' ? '/(tabs)/coach-calendar' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'calendar' : 'calendar-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="athlete-calendar"
          options={{
            title: 'Calendar',
            href: viewMode === 'athlete' ? '/(tabs)/athlete-calendar' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'calendar' : 'calendar-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="athlete-progression"
          options={{
            title: 'Progression',
            href: viewMode === 'athlete' ? '/(tabs)/athlete-progression' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'trending-up' : 'trending-up-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="coach-videos"
          options={{
            title: 'Videos',
            href: isCoach && viewMode === 'coach' ? '/(tabs)/coach-videos' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'videocam' : 'videocam-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="coach-video-review"
          options={{
            href: null,
            title: 'Video Review',
          }}
        />

        <Tabs.Screen
          name="coach-video-archive"
          options={{
            href: null,
            title: 'Video Archive',
          }}
        />

        <Tabs.Screen
          name="coach-reviews"
          options={{
            href: null,
            title: 'Coach Reviews',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'clipboard' : 'clipboard-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="video-archive"
          options={{
            title: 'Video Archive',
            href: null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'videocam' : 'videocam-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="reflection"
          options={{
            title: 'Reflection',
            href: viewMode === 'athlete' ? '/(tabs)/reflection' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'sparkles' : 'sparkles-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="workout/index"
          options={{
            title: 'Training',
            href: viewMode === 'athlete' ? '/(tabs)/workout' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'barbell' : 'barbell-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="workout/[workoutId]"
          options={{
            href: null,
            title: 'Session',
          }}
        />

        <Tabs.Screen
          name="workout/block-details"
          options={{
            href: null,
            title: 'Block Details',
          }}
        />

        <Tabs.Screen
          name="workout/session-history"
          options={{
            href: null,
            title: 'Session History',
          }}
        />

        <Tabs.Screen
          name="workout/movement-history"
          options={{
            href: null,
            title: 'Movement History',
          }}
        />

        <Tabs.Screen
          name="workouts"
          options={{
            href: null,
            title: 'Training',
          }}
        />

        <Tabs.Screen
          name="messages/index"
          options={{
            title: 'Messages',
            href: isCoach && viewMode === 'coach' ? '/(tabs)/messages' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="messages/[threadId]"
          options={{
            href: null,
            title: 'Messages',
          }}
        />

        <Tabs.Screen
          name="messages/announcements"
          options={{
            href: null,
            title: 'Announcements',
          }}
        />

        <Tabs.Screen
          name="athlete-meet-plan"
          options={{
            title: 'Meet',
            href: hasMeetDate ? '/(tabs)/athlete-meet-plan' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'trophy' : 'trophy-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SLColors.shellCanvas,
  },
  headerShell: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  headerSideButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tabScene: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  tabBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: SLColors.shellTabSurface,
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
    paddingTop: 8,
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarIconRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    minHeight: 26,
    position: 'relative',
  },
  messageNotificationDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FB7185',
    borderWidth: 1,
    borderColor: SLColors.shellCanvas,
  },
  tabBarLabel: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 14,
    textAlign: 'center',
  },
  menuCard: {
    backgroundColor: '#020617',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    marginTop: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  menuDanger: {
    color: '#f97373',
  },
  menuFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  menuFooterText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
