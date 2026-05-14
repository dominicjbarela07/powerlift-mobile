// app/(tabs)/_layout.tsx
import React from 'react';
import { View, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { AppHeader } from '@/components/AppHeader';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import * as Updates from 'expo-updates';

function FilteredTabBar({ state, descriptors, navigation, isCoach }: BottomTabBarProps & { isCoach: boolean }) {
  const allowedNames = isCoach
    ? ['coach-dashboard', 'athlete-dashboard', 'coach-roster', 'workouts']
    : ['athlete-dashboard', 'workouts'];

  const visibleRoutes = allowedNames
    .map((name) => state.routes.find((route) => route.name === name))
    .filter(Boolean) as typeof state.routes;

  const tabConfig: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    'coach-dashboard': { label: 'Dashboard', icon: 'home-outline' },
    'coach-roster': { label: 'Roster', icon: 'people-outline' },
    workouts: { label: 'Session List', icon: 'list-outline' },
    'athlete-dashboard': { label: isCoach ? 'Ath View' : 'Dashboard', icon: 'grid-outline' },
  };

  return (
    <View style={styles.tabBar}>
      {visibleRoutes.map((route) => {
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const isFocused = state.index === routeIndex;
        const color = isFocused ? '#C4B5FD' : '#CBD5E1';
        const cfg = tabConfig[route.name] ?? { label: route.name, icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap };
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
            navigation.navigate(route.name as never);
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
            </View>
            <ThemedText style={[styles.tabBarLabel, { color }]}>{cfg.label}</ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const formatPST = (d?: Date | string | null) => {
    if (!d) return 'unknown time';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const updateLabel = Updates.isEmbeddedLaunch
    ? 'Embedded build'
    : Updates.updateId
    ? `Update ${Updates.updateId.slice(0, 8)} · ${formatPST(Updates.createdAt)} PST`
    : 'Unknown update';

  const firstName =
    user?.user_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Athlete';

  const isCoach = !!user?.is_coach;

  return (
    <SafeAreaView style={styles.safeArea}>
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
                    if (user?.is_coach) {
                      router.replace('/coach-dashboard');
                    } else {
                      router.replace('/(tabs)/athlete-dashboard');
                    }
                  }}
                  style={styles.headerTitleWrap}
                >
                  <ThemedText style={styles.headerBrand}>Strength Ledger</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {}}
                  style={styles.headerSideButton}
                >
                  <Ionicons name="notifications-outline" size={20} color="#E5E7EB" />
                </TouchableOpacity>
              </View>
            </ThemedView>
          ),
          headerShown: true,
          sceneStyle: styles.tabScene,
          tabBarHideOnKeyboard: true,
        }}
        tabBar={(props) => <FilteredTabBar {...props} isCoach={isCoach} />}
      >
        {user?.is_coach && (
          <Tabs.Screen
            name="coach-dashboard"
            options={{
              title: 'Dashboard',
              href: '/coach-dashboard',
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? 'home' : 'home-outline'}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
        )}

        <Tabs.Screen
          name="athlete-dashboard"
          options={{
            title: user?.is_coach ? 'Ath View' : 'Dashboard',
            href: '/(tabs)/athlete-dashboard',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        {user?.is_coach && (
          <Tabs.Screen
            name="coach-roster"
            options={{
              title: 'Roster',
              href: '/coach-roster',
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? 'people' : 'people-outline'}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
        )}

        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Session List',
            href: '/(tabs)/workouts',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? (user?.is_coach ? 'list' : 'barbell') : (user?.is_coach ? 'list-outline' : 'barbell-outline')}
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
    backgroundColor: '#020617',
  },
  headerShell: {
    backgroundColor: '#020617',
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
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  tabBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.18)',
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
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '700',
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