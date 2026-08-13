// app/(tabs)/_layout.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Platform,
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { ThemedView } from '@/components/themed-view';
import { useFloatingNavigationMotion } from '@/components/navigation/floating-navigation-motion';
import {
  SL_TAB_ROW_CONTROL,
  SL_TAB_ROW_FALLBACK_SHEEN,
  SL_TAB_ROW_SELECTED_LENS,
} from '@/components/navigation/sl-tab-row-control';
import { SLCanonicalIcon, SLMotionPressable, SLTrophy } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useDevLiveScreenSession } from '@/lib/release-preview-stubs';
import { getUnreadSummary } from '@/lib/api';
import { SLColors, SLLayout, SLMotion, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
import { useSLReducedMotion } from '@/lib/motion';
import {
  getMobileViewMode,
  subscribeMobileViewModeChanged,
  type MobileViewMode,
} from '@/lib/mobileViewMode';
import { useSessionEditorOverlayOpen } from '@/lib/session-editor-overlay-state';
import { canAccessAccessoryCatalogReview } from '@/lib/accessory-catalog-review';
import {
  SHIPPING_TAB_PRESENTATION,
  shippingTabRouteNames,
} from '@/lib/shipping-navigation';

function supportsNativeLiquidGlass() {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

function FilteredTabBar({
  state,
  descriptors,
  navigation,
  isCoach,
  isIndividual,
  isUnlinkedAthlete,
  viewMode,
  hasMeetDate,
  hasMessageNotifications,
  onMessagesTabPress,
  collapseTabRowRef,
  onTabBarInteractionStart,
  bottomInset,
}: BottomTabBarProps & {
  isCoach: boolean;
  isIndividual: boolean;
  isUnlinkedAthlete: boolean;
  viewMode: MobileViewMode;
  hasMeetDate: boolean;
  hasMessageNotifications: boolean;
  onMessagesTabPress: () => void;
  collapseTabRowRef: React.MutableRefObject<(() => void) | null>;
  onTabBarInteractionStart: () => void;
  bottomInset: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { width: viewportWidth } = useWindowDimensions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const nativeLiquidGlassAvailable = supportsNativeLiquidGlass();
  const usesNativeLiquidGlass = nativeLiquidGlassAvailable && !reduceTransparency;
  const reduceMotion = useSLReducedMotion();
  const sessionEditorOverlayOpen = useSessionEditorOverlayOpen();
  const previousTabIndexRef = useRef(state.index);
  const openedOnPressInRef = useRef(false);
  const allowedNames = shippingTabRouteNames({
    isCoach,
    isIndividual,
    isUnlinkedAthlete,
    viewMode,
    hasMeetDate,
  });

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

  const trainingTabLabel = isIndividual ? 'Programming' : 'Training';
  const tabConfig: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    ...SHIPPING_TAB_PRESENTATION,
    workout: { label: trainingTabLabel, icon: 'barbell-outline' },
    'workout/index': { label: trainingTabLabel, icon: 'barbell-outline' },
    workouts: { label: trainingTabLabel, icon: 'barbell-outline' },
    'athlete-progression': { label: 'Progression', icon: 'trending-up-outline' },
    reflection: { label: 'Reflection', icon: 'sparkles-outline' },
    messages: { label: 'Messages', icon: 'chatbubbles-outline' },
    'check-ins': { label: 'Check-Ins', icon: 'clipboard-outline' },
    'video-archive': { label: 'Video Archive', icon: 'videocam-outline' },
    'athlete-meet-plan': { label: 'Meet', icon: 'trophy-outline' },
    settings: { label: 'Settings', icon: 'settings-outline' },
    'link-coach': { label: 'Invite', icon: 'mail-outline' },
  };

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) setReduceTransparency(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (previousTabIndexRef.current !== state.index) {
      previousTabIndexRef.current = state.index;
      setIsExpanded(false);
    }
  }, [state.index]);

  useEffect(() => {
    setIsExpanded(false);
  }, [pathname]);

  useEffect(() => {
    const collapseTabRow = () => setIsExpanded(false);
    collapseTabRowRef.current = collapseTabRow;

    return () => {
      if (collapseTabRowRef.current === collapseTabRow) {
        collapseTabRowRef.current = null;
      }
    };
  }, [collapseTabRowRef]);

  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const isCalendarPreviewPath = __DEV__ && normalizedPathname.startsWith('/dev-mocks/calendar-');
  const isBottomTabGlassPreviewPath = __DEV__ && normalizedPathname === '/dev-mocks/navigation-bottom-tab-glass';
  const usesCalendarPreviewSelection = isCalendarPreviewPath || isBottomTabGlassPreviewPath;
  const activeRoute = (usesCalendarPreviewSelection
    ? visibleRoutes.find((route) => route.name === 'athlete-calendar')
    : null) ?? visibleRoutes.find((route) => {
    const routeIndex = state.routes.findIndex((candidate) => candidate.key === route.key);
    return routeIndex === state.index;
  }) ?? visibleRoutes[0];
  const activeTopLevelPath = activeRoute
    ? `/${activeRoute.name.replace(/\/index$/, '')}`
    : null;
  const isLedgerDestinationPath = activeRoute?.name === 'ledger'
    && normalizedPathname.startsWith('/ledger/');
  const isActiveTopLevelTab = activeTopLevelPath === normalizedPathname || isLedgerDestinationPath || usesCalendarPreviewSelection;
  const showsExpandedTabRow = isExpanded || isBottomTabGlassPreviewPath;
  const displayedRoutes = showsExpandedTabRow ? visibleRoutes : activeRoute ? [activeRoute] : [];
  const expandedWidth = Math.max(
    SLLayout.collapsedTabWidth,
    viewportWidth - (SLLayout.screenGutter * 2),
  );
  const { animatedWidth, expandedItemsOpacity, collapsedAnchorOpacity } = useFloatingNavigationMotion({
    expanded: showsExpandedTabRow,
    collapsedWidth: SLLayout.collapsedTabWidth,
    expandedWidth,
    reduceMotion,
  });
  const activeRouteCfg = activeRoute
    ? tabConfig[activeRoute.name] ?? { label: activeRoute.name, icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap }
    : null;
  const collapsedAnchorCfg = !isActiveTopLevelTab
    ? { label: 'Open navigation', icon: 'ellipsis-horizontal' as keyof typeof Ionicons.glyphMap }
    : activeRouteCfg;
  const collapsedAnchorIcon = collapsedAnchorCfg?.icon.endsWith('-outline')
    ? collapsedAnchorCfg.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap
    : collapsedAnchorCfg?.icon;
  const usesFlowingNavigationDock = __DEV__ && normalizedPathname === '/dev-mocks/milestones';
  const hidesNavigationForSessionEditor = normalizedPathname.startsWith('/workout/session-workspace/')
    && sessionEditorOverlayOpen;
  const hidesNavigationForCompletedRecap = normalizedPathname.startsWith('/workout/')
    && sessionEditorOverlayOpen;

  if (hidesNavigationForSessionEditor) return null;
  if (hidesNavigationForCompletedRecap) return null;

  return (
    <View
      pointerEvents="box-none"
      onTouchStart={onTabBarInteractionStart}
      style={[
        styles.tabBarDock,
        usesFlowingNavigationDock && styles.tabBarDockFlow,
        { height: 58 + bottomInset, paddingBottom: bottomInset + SLSpacing.xs },
      ]}
    >
      <Animated.View
        style={[
          styles.tabBar,
          usesNativeLiquidGlass && styles.tabBarNativeMaterial,
          showsExpandedTabRow && styles.tabBarExpanded,
          { width: animatedWidth },
        ]}
      >
        <View pointerEvents="none" style={styles.tabBarMaterialClip}>
          {usesNativeLiquidGlass ? (
            <GlassView
              colorScheme="dark"
              glassEffectStyle="regular"
              style={[StyleSheet.absoluteFillObject, styles.tabBarNativeGlass]}
              tintColor="rgba(103, 82, 132, 0.045)"
            />
          ) : Platform.OS === 'ios' && !reduceTransparency ? (
            <BlurView
              intensity={72}
              style={StyleSheet.absoluteFillObject}
              tint="systemThinMaterialDark"
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                reduceTransparency
                  ? styles.tabBarReducedTransparency
                  : styles.tabBarTranslucentFallback,
              ]}
            />
          )}
          {!usesNativeLiquidGlass ? (
            <>
              <View style={styles.tabBarFallbackTint} />
              <LinearGradient
                colors={SL_TAB_ROW_FALLBACK_SHEEN}
                end={{ x: 0.72, y: 1 }}
                locations={[0, 0.48, 1]}
                start={{ x: 0.12, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </>
          ) : null}
        </View>
        {showsExpandedTabRow && collapsedAnchorIcon ? (
          <Animated.View pointerEvents="none" style={[styles.expandingAnchor, { opacity: collapsedAnchorOpacity }]}>
            <SLCanonicalIcon name={collapsedAnchorIcon} size={SL_TAB_ROW_CONTROL.collapsedAnchorIconSize} color={SLColors.textStrong} trophyTier="bronze" />
          </Animated.View>
        ) : null}
        {displayedRoutes.map((route) => {
        const isFocused = route.key === activeRoute?.key;
        const color = isFocused ? SLColors.review : SLColors.textMuted;
        const routeCfg = tabConfig[route.name] ?? { label: route.name, icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap };
        const isNestedMenuTrigger = !showsExpandedTabRow && !isActiveTopLevelTab;
        const cfg = isNestedMenuTrigger
          ? { label: 'Open navigation', icon: 'ellipsis-horizontal' as keyof typeof Ionicons.glyphMap }
          : routeCfg;
        const isMessagesRoute = route.name === 'messages' || route.name === 'messages/index';
        const isTrainingRoute = route.name === 'workout' || route.name === 'workout/index';
        const isLedgerHomeRoute = route.name === 'ledger';
        const iconName = isFocused
          ? (cfg.icon.endsWith('-outline')
              ? (cfg.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap)
              : cfg.icon)
          : cfg.icon;

        const onPressIn = () => {
          openedOnPressInRef.current = !showsExpandedTabRow;
          if (!showsExpandedTabRow) {
            void Haptics.selectionAsync().catch(() => undefined);
            setIsExpanded(true);
          }
        };

        const onPress = () => {
          if (openedOnPressInRef.current) {
            openedOnPressInRef.current = false;
            return;
          }

          void Haptics.selectionAsync().catch(() => undefined);

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (isLedgerHomeRoute && !event.defaultPrevented) {
            router.navigate('/(tabs)/ledger/home' as any);
            setIsExpanded(false);
          } else if (!isFocused && !event.defaultPrevented) {
            if (isTrainingRoute) {
              router.navigate('/(tabs)/workout');
            } else {
              navigation.navigate(route.name as never);
            }
          } else if (isFocused && !event.defaultPrevented) {
            setIsExpanded(false);
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
          <Animated.View
            key={route.key}
            style={[styles.tabBarSlot, showsExpandedTabRow && { opacity: expandedItemsOpacity }]}
          >
            {isFocused ? (
              // Keep one native glass plane. Apple advises that selected
              // content above Liquid Glass use tint/transparency, not a
              // second stacked glass effect.
              <LinearGradient
                colors={SL_TAB_ROW_SELECTED_LENS}
                end={{ x: 1, y: 1 }}
                pointerEvents="none"
                start={{ x: 0, y: 0 }}
                style={styles.activeTabMarker}
              />
            ) : null}
            <SLMotionPressable
              accessibilityLabel={cfg.label}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              hitSlop={SL_TAB_ROW_CONTROL.hitSlop}
              onPress={onPress}
              onPressIn={onPressIn}
              onLongPress={onLongPress}
              style={[styles.tabBarItem, isFocused && styles.tabBarItemActive]}
              pressScale={SLMotion.prominentPressScale}
            >
              <View style={styles.tabBarIconRow}>
              <SLCanonicalIcon name={iconName} size={SL_TAB_ROW_CONTROL.iconSize} color={color} trophyTier="bronze" />
                {isMessagesRoute && hasMessageNotifications && (
                  <View style={styles.messageNotificationDot} />
                )}
              </View>
            </SLMotionPressable>
          </Animated.View>
        );
        })}
      </Animated.View>
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const devPreviewSession = useDevLiveScreenSession();
  const [hasMessageNotifications, setHasMessageNotifications] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('coach');
  const [mobileViewModeLoaded, setMobileViewModeLoaded] = useState(false);
  const unreadPollingRef = useRef(false);
  const collapseTabRowRef = useRef<(() => void) | null>(null);
  const pendingTabRowCollapseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingTabRowCollapse = useCallback(() => {
    if (pendingTabRowCollapseRef.current) {
      clearTimeout(pendingTabRowCollapseRef.current);
      pendingTabRowCollapseRef.current = null;
    }
  }, []);

  const requestTabRowCollapse = useCallback(() => {
    cancelPendingTabRowCollapse();
    pendingTabRowCollapseRef.current = setTimeout(() => {
      pendingTabRowCollapseRef.current = null;
      collapseTabRowRef.current?.();
    }, 0);
  }, [cancelPendingTabRowCollapse]);

  useEffect(() => cancelPendingTabRowCollapse, [cancelPendingTabRowCollapse]);

  const isCoach = !!user?.is_coach;
  const accountState = user?.account_state;
  const isUnlinkedAthlete =
    !!user &&
    !user.is_coach &&
    (accountState === 'LINK_COACH_REQUIRED' ||
      user.link_coach_required === true ||
      !user.has_linked_athlete ||
      !user.athlete_id);
  const isIndividual =
    user?.workspace_mode === 'individual' ||
      user?.is_individual_workspace === true ||
      user?.is_self_coached === true;
  const accessBlocked =
    !!user &&
    (
      accountState === 'EMAIL_VERIFICATION_REQUIRED' ||
      accountState === 'ACTIVATION_REQUIRED' ||
      (user.verification_required === true && user.email_verified === false) ||
      (user.is_coach === true && (user.billing_required === true || user.can_access_product === false))
    );
  const viewMode: MobileViewMode = isIndividual ? 'individual' : isCoach ? mobileViewMode : 'athlete';
  const hasMeetDate = viewMode === 'athlete' && !!(user as any)?.meet_date;
  // A single dev-only mock-library boundary is deliberately allowed alongside
  // Settings for authenticated accounts in every account state. It has no APIs
  // or production product data and is removed from the UI in release builds.
  const isDevMockRoute = __DEV__ && pathname.includes('/dev-mocks');
  const isAccessoryCatalogReviewRoute = pathname.includes('/accessory-catalog-review');
  const canUseAccessoryCatalogReview = canAccessAccessoryCatalogReview(user);
  const isIdealStatePreview = __DEV__ && devPreviewSession?.mode === 'ideal';
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    } else if (accessBlocked && !pathname.includes('/settings') && !isDevMockRoute && !(isAccessoryCatalogReviewRoute && canUseAccessoryCatalogReview)) {
      router.replace('/');
    } else if (isUnlinkedAthlete && !pathname.includes('/settings') && !pathname.includes('/link-coach') && !isDevMockRoute && !(isAccessoryCatalogReviewRoute && canUseAccessoryCatalogReview)) {
      router.replace('/(tabs)/link-coach');
    }
  }, [accessBlocked, canUseAccessoryCatalogReview, isAccessoryCatalogReviewRoute, isDevMockRoute, isUnlinkedAthlete, pathname, router, user]);

  useEffect(() => {
    let mounted = true;
    setMobileViewModeLoaded(false);

    if (isIndividual) {
      setMobileViewMode('individual');
      setMobileViewModeLoaded(true);
      return () => {
        mounted = false;
      };
    }

    getMobileViewMode(isCoach).then((mode) => {
      if (mounted) {
        setMobileViewMode(mode);
        setMobileViewModeLoaded(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isCoach, isIndividual, user?.email]);

  useEffect(() => {
    if (!isCoach || isIndividual) return undefined;

    return subscribeMobileViewModeChanged((mode) => {
      setMobileViewMode(mode);
      setMobileViewModeLoaded(true);
    });
  }, [isCoach, isIndividual]);

  useEffect(() => {
    if (!isCoach || !mobileViewModeLoaded) return;
    if (isUnlinkedAthlete) return;
    if (pathname.includes('/settings') || isDevMockRoute) return;

    if (isIndividual) {
      const isTeamFacingPath =
        pathname.includes('/coach-dashboard') ||
        pathname.includes('/coach-roster') ||
        pathname.includes('/check-ins') ||
        pathname.includes('/check-in/') ||
        pathname.includes('/messages');

      if (isTeamFacingPath) {
        router.replace('/(tabs)/athlete-dashboard');
      }
      return;
    }

    if (pathname.includes('/messages')) return;

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
      pathname.includes('/coach-athlete') ||
      pathname.includes('/coach-calendar') ||
      pathname.includes('/coach-videos') ||
      pathname.includes('/coach-review-queue') ||
      pathname.includes('/coach-review-history') ||
      pathname.includes('/coach-session-review') ||
      pathname.includes('/coach-video-review') ||
      pathname.includes('/coach-video-archive');

    if (viewMode === 'coach' && isAthleteFacingPath) {
      router.replace('/(tabs)/coach-roster');
    } else if (viewMode === 'athlete' && isCoachFacingPath) {
      router.replace('/(tabs)/athlete-dashboard');
    }
  }, [isCoach, isDevMockRoute, isIndividual, isUnlinkedAthlete, mobileViewModeLoaded, pathname, router, viewMode]);

  const refreshMessageNotifications = useCallback(async () => {
    if (!user || isIndividual || isUnlinkedAthlete || unreadPollingRef.current) {
      if (!user) setHasMessageNotifications(false);
      if (isIndividual) setHasMessageNotifications(false);
      if (isUnlinkedAthlete) setHasMessageNotifications(false);
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
  }, [isIndividual, isUnlinkedAthlete, user]);

  useEffect(() => {
    if (!user || accessBlocked || isIndividual || isUnlinkedAthlete) {
      setHasMessageNotifications(false);
      return undefined;
    }

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
  }, [accessBlocked, isIndividual, isUnlinkedAthlete, refreshMessageNotifications, user]);

  if (!user) {
    return null;
  }

  if (((accessBlocked && !pathname.includes('/settings') && !isDevMockRoute) || (isUnlinkedAthlete && !pathname.includes('/settings') && !pathname.includes('/link-coach') && !isDevMockRoute)) && !(isAccessoryCatalogReviewRoute && canUseAccessoryCatalogReview)) {
    return null;
  }

  return (
    <View
      style={styles.safeArea}
      onStartShouldSetResponderCapture={() => {
        requestTabRowCollapse();
        return false;
      }}
    >
      <Tabs
        screenOptions={{
          header: () => (
            <ThemedView style={[styles.headerShell, { paddingTop: insets.top }]}>
              <View style={styles.headerRow}>
                  <TouchableOpacity
                    onPress={() => {
                      router.push('/(tabs)/settings');
                    }}
                    style={styles.headerSideButton}
                  >
                    <Ionicons name="settings-outline" size={22} color={SLColors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (isUnlinkedAthlete) {
                        router.replace('/(tabs)/link-coach');
                      } else if (isIndividual) {
                        router.replace('/(tabs)/athlete-dashboard');
                      } else if (isCoach && viewMode === 'coach') {
                        router.replace('/(tabs)/coach-roster');
                      } else {
                        router.replace('/(tabs)/athlete-dashboard');
                      }
                    }}
                    style={styles.headerTitleWrap}
                  >
                    <Image
                      source={require('@/assets/images/16:9.png')}
                      style={{ width: 110, height: 22, resizeMode: 'contain' }}
                    />
                  </TouchableOpacity>

                  {isIndividual ? (
                    <TouchableOpacity
                      onPress={() => {
                        router.push('/create-workout');
                      }}
                      style={styles.headerSideButton}
                    >
                      <Ionicons name="add-circle-outline" size={23} color={SLColors.text} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      accessibilityLabel={viewMode === 'coach' ? 'Open Team Brief' : 'Open messages'}
                      accessibilityRole="button"
                      onPress={() => {
                        if (viewMode === 'athlete') {
                          refreshMessageNotifications();
                          router.push('/(tabs)/messages');
                        } else if (viewMode === 'coach') {
                          router.push('/coach-team-brief' as any);
                        }
                      }}
                      style={styles.headerSideButton}
                    >
                      <Ionicons
                        name={viewMode === 'athlete' ? 'chatbubbles-outline' : 'reader-outline'}
                        size={viewMode === 'athlete' ? 21 : 20}
                        color={SLColors.text}
                      />
                      {viewMode === 'athlete' && hasMessageNotifications ? (
                        <View style={styles.messageNotificationDot} />
                      ) : null}
                    </TouchableOpacity>
                  )}
              </View>
            </ThemedView>
          ),
          headerShown: !isIdealStatePreview,
          sceneStyle: styles.tabScene,
          tabBarHideOnKeyboard: true,
        }}
        tabBar={(props) => (
          <FilteredTabBar
            {...props}
            isCoach={isCoach}
            isIndividual={isIndividual}
            isUnlinkedAthlete={isUnlinkedAthlete}
            viewMode={viewMode}
            hasMeetDate={hasMeetDate}
            hasMessageNotifications={hasMessageNotifications}
            onMessagesTabPress={refreshMessageNotifications}
            collapseTabRowRef={collapseTabRowRef}
            onTabBarInteractionStart={cancelPendingTabRowCollapse}
            bottomInset={insets.bottom}
          />
        )}
      >
        <Tabs.Screen
          name="coach-dashboard"
          options={{
            title: 'Today',
            href: null,
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
            href: viewMode === 'athlete' || isIndividual ? '/(tabs)/athlete-dashboard' : null,
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
            href: isCoach && !isIndividual && viewMode === 'coach' ? '/coach-roster' : null,
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
          name="coach-athlete/[athleteId]"
          options={{
            href: null,
            title: 'Athlete',
          }}
        />

        <Tabs.Screen
          name="coach-invite-athlete"
          options={{
            href: null,
            title: 'Invite Athlete',
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
          name="check-ins"
          options={{
            title: 'Check-Ins',
            href: null,
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
          name="athlete-calendar"
          options={{
            title: 'Calendar',
            href: viewMode === 'athlete' || isIndividual ? '/(tabs)/athlete-calendar' : null,
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
            href: null,
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
            title: 'Reviews',
            href: isCoach && viewMode === 'coach' ? '/(tabs)/coach-videos' : null,
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
          name="coach-review-queue"
          options={{ href: null, title: 'Review Queue' }}
        />

        <Tabs.Screen
          name="coach-review-history"
          options={{ href: null, title: 'Past Review Work' }}
        />

        <Tabs.Screen
          name="coach-session-review"
          options={{ href: null, title: 'Session Review' }}
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
            href: null,
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
          name="training-focus"
          options={{
            title: 'Training Focus',
            href: null,
          }}
        />

        <Tabs.Screen
          name="workout/index"
          options={{
            title: isIndividual ? 'Programming' : 'Training',
            href: viewMode === 'athlete' || isIndividual ? '/(tabs)/workout' : null,
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
          name="workout/create-program"
          options={{
            href: null,
            title: 'Create Program',
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
            href: isCoach && !isIndividual && viewMode === 'coach' ? '/(tabs)/messages' : null,
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
              <SLTrophy size={22} tier="bronze" muted={!focused} />
            ),
          }}
        />

        <Tabs.Screen
          name="link-coach"
          options={{
            title: 'Pending Invite',
            href: isUnlinkedAthlete ? '/(tabs)/link-coach' : null,
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            href: null,
          }}
        />
        <Tabs.Screen
          name="accessory-catalog-review"
          options={{ href: null, title: 'Accessory Catalog Review' }}
        />
        <Tabs.Screen
          name="ledger"
          options={{
            title: 'The Ledger',
            href: viewMode === 'athlete' || isIndividual ? '/(tabs)/ledger/home' : null,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerShell: {
    backgroundColor: 'transparent',
    borderBottomColor: SLColors.shellHairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SLLayout.screenGutter,
    paddingTop: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  headerSideButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: SLRadius.radiusRow,
    backgroundColor: SLColors.surfaceFlat,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '800',
    color: SLColors.textStrong,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tabScene: {
    backgroundColor: 'transparent',
    // Mobile routes always receive a full-width canvas. Child surfaces own any intentional inset.
    paddingTop: 0,
  },
  tabBarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: SLLayout.screenGutter,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  tabBarDockFlow: {
    position: 'relative',
    flexShrink: 0,
  },
  tabBar: {
    height: SL_TAB_ROW_CONTROL.shellHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderWidth: SL_TAB_ROW_CONTROL.shellBorderWidth,
    borderColor: SL_TAB_ROW_CONTROL.shellBorderColor,
    borderRadius: SL_TAB_ROW_CONTROL.shellRadius,
    padding: SL_TAB_ROW_CONTROL.shellPadding,
    position: 'relative',
    ...SLShadows.level2,
  },
  tabBarMaterialClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SL_TAB_ROW_CONTROL.shellRadius,
    overflow: 'hidden',
  },
  tabBarNativeMaterial: {
    borderColor: 'transparent',
  },
  tabBarNativeGlass: {
    borderRadius: SL_TAB_ROW_CONTROL.shellRadius,
  },
  tabBarFallbackTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SL_TAB_ROW_CONTROL.materialTint,
  },
  tabBarTranslucentFallback: {
    backgroundColor: SL_TAB_ROW_CONTROL.translucentFallback,
  },
  tabBarReducedTransparency: {
    backgroundColor: SL_TAB_ROW_CONTROL.reducedTransparencyFallback,
  },
  tabBarExpanded: {
    paddingHorizontal: SL_TAB_ROW_CONTROL.expandedPaddingHorizontal,
  },
  tabBarItem: {
    width: SL_TAB_ROW_CONTROL.itemSize,
    height: SL_TAB_ROW_CONTROL.itemSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SL_TAB_ROW_CONTROL.itemRadius,
    overflow: 'hidden',
    zIndex: 1,
  },
  tabBarSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarItemActive: {
    backgroundColor: 'transparent',
  },
  activeTabMarker: {
    position: 'absolute',
    width: SL_TAB_ROW_CONTROL.indicatorSize,
    height: SL_TAB_ROW_CONTROL.indicatorSize,
    borderRadius: SL_TAB_ROW_CONTROL.indicatorRadius,
    borderColor: SL_TAB_ROW_CONTROL.indicatorBorderColor,
    borderWidth: SL_TAB_ROW_CONTROL.indicatorBorderWidth,
    ...SLShadows.level1,
  },
  expandingAnchor: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: SL_TAB_ROW_CONTROL.itemSize,
    height: SL_TAB_ROW_CONTROL.itemSize,
    borderRadius: SL_TAB_ROW_CONTROL.shellRadius,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  tabBarIconRow: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  messageNotificationDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.danger,
    borderWidth: 1,
    borderColor: SLColors.shellCanvas,
  },
  menuCard: {
    backgroundColor: SLColors.background,
    borderRadius: SLRadius.lg,
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
    fontSize: SLTypography.rowTitle.fontSize,
    color: SLColors.text,
    fontWeight: '500',
  },
  menuDanger: {
    color: SLColors.danger,
  },
  menuFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  menuFooterText: {
    fontSize: SLTypography.label.fontSize,
    color: SLColors.textMuted,
  },
});
