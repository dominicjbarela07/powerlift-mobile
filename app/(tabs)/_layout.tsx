import { useFocusedSession } from '@/lib/session-logger-focus';
// app/(tabs)/_layout.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  View,
  StyleSheet,
} from 'react-native';
import { Tabs, useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { StrengthLedgerAppHeader } from '@/components/navigation/StrengthLedgerAppHeader';
import {
  CoachMoreNavigationProvider,
  useCoachMoreNavigation,
} from '@/components/navigation/CoachMoreNavigationSheet';
import {
  SLFloatingNavigationDock,
} from '@/components/navigation/sl-tab-row-control';
import { SLTrophy } from '@/components/ui';
import { useAuth, type AuthUser } from '@/context/AuthContext';
import { useDevLiveScreenSession } from '@/lib/release-preview-stubs';
import { fetchJson, getUnreadSummary } from '@/lib/api';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import type { MobileViewMode } from '@/lib/mobileViewMode';
import { useSessionEditorOverlayOpen } from '@/lib/session-editor-overlay-state';
import { canAccessAccessoryCatalogReview } from '@/lib/accessory-catalog-review';
import {
  SHIPPING_TAB_PRESENTATION,
  shippingTabRouteNames,
} from '@/lib/shipping-navigation';

const DEV_STRENGTH_TIER_CERTIFICATION_USER: AuthUser = {
  id: 99001,
  user_id: 99001,
  email: 'strength-tier-certification@dev.invalid',
  user_name: 'Strength Tier Certification',
  role: 'coach',
  is_coach: true,
  workspace_mode: 'individual',
  available_mobile_modes: ['individual'],
  mobile_mode: 'individual',
  can_access_internal_self_coach_mobile_mode: true,
  is_individual_workspace: true,
  is_self_coached: true,
  self_athlete_id: 99001,
  account_state: 'READY',
  can_access_product: true,
  link_coach_required: false,
  email_verified: true,
  verification_required: false,
  billing_required: false,
  has_linked_athlete: true,
  athlete_id: 99001,
  preferred_units: 'kg',
};

function FilteredTabBar({
  state,
  descriptors,
  navigation,
  isCoach,
  isIndividual,
  isUnlinkedAthlete,
  viewMode,
  hasMeetPlan,
  hasMessageNotifications,
  onMessagesTabPress,
  bottomInset,
}: BottomTabBarProps & {
  isCoach: boolean;
  isIndividual: boolean;
  isUnlinkedAthlete: boolean;
  viewMode: MobileViewMode;
  hasMeetPlan: boolean;
  hasMessageNotifications: boolean;
  onMessagesTabPress: () => void;
  bottomInset: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const focusedParams = useGlobalSearchParams<{ returnToWorkspace?: string }>();
  const { isOpen: isMoreOpen, open: openMore } = useCoachMoreNavigation();
  const sessionEditorOverlayOpen = useSessionEditorOverlayOpen();
  const focusedSession = useFocusedSession();
  const allowedNames = shippingTabRouteNames({
    isCoach,
    isIndividual,
    isUnlinkedAthlete,
    viewMode,
    hasMeetPlan,
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

  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const isImmersiveMeetMode = normalizedPathname === '/athlete-meet-plan'
    || normalizedPathname.startsWith('/athlete-meet-plan/');
  const isCalendarPreviewPath = __DEV__ && normalizedPathname.startsWith('/dev-mocks/calendar-');
  const usesCalendarPreviewSelection = isCalendarPreviewPath;
  const usesCoachHomeSelection = normalizedPathname.startsWith('/coach-roster')
    || normalizedPathname.startsWith('/coach-athlete/')
    || normalizedPathname.startsWith('/coach-attention/');
  const activeRoute = (usesCoachHomeSelection
    ? visibleRoutes.find((route) => route.name === 'coach-dashboard')
    : usesCalendarPreviewSelection
    ? visibleRoutes.find((route) => route.name === 'athlete-calendar')
    : null) ?? visibleRoutes.find((route) => {
    const routeIndex = state.routes.findIndex((candidate) => candidate.key === route.key);
    return routeIndex === state.index;
  }) ?? visibleRoutes[0];
  // The global shell is navigation, not a disclosure control. Every normal app
  // destination stays visible; only explicit focused experiences may suppress it.
  const displayedRoutes = visibleRoutes;
  const usesFlowingNavigationDock = __DEV__ && normalizedPathname === '/dev-mocks/milestones';
  const hidesNavigationForSessionEditor = normalizedPathname.startsWith('/workout/session-workspace/')
    && sessionEditorOverlayOpen;
  const hidesNavigationForCompletedRecap = normalizedPathname.startsWith('/workout/')
    && sessionEditorOverlayOpen;

  if (focusedSession) return null;
  if (isImmersiveMeetMode) return null;
  if (normalizedPathname.startsWith('/coach-athlete/')) return null;
  if (normalizedPathname.startsWith('/ledger') && focusedParams.returnToWorkspace === '1') return null;
  if (focusedParams.returnToWorkspace === '1'
    && ['/coach-session-review', '/coach-video-review', '/check-ins'].includes(normalizedPathname)) return null;
  if (hidesNavigationForSessionEditor) return null;
  if (hidesNavigationForCompletedRecap) return null;

  return (
    <SLFloatingNavigationDock
      bottomInset={bottomInset}
      flow={usesFlowingNavigationDock}
      items={displayedRoutes.map((route) => {
        const isMoreRoute = route.name === 'coach-more';
        const isFocused = isMoreRoute ? isMoreOpen : route.key === activeRoute?.key;
        const isStateFocused = route.key === state.routes[state.index]?.key;
        const cfg = tabConfig[route.name]
          ?? { label: route.name, icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap };
        const isMessagesRoute = route.name === 'messages' || route.name === 'messages/index';
        const isTrainingRoute = route.name === 'workout' || route.name === 'workout/index';
        const isLedgerHomeRoute = route.name === 'ledger';
        const isMeetModeRoute = route.name === 'athlete-meet-plan';

        return {
          accessibilityLabel: cfg.label,
          badge: isMessagesRoute && hasMessageNotifications ? 'dot' as const : undefined,
          icon: cfg.icon,
          key: route.key,
          selected: isFocused,
          onPress: () => {
            if (isMoreRoute) {
              openMore();
              return;
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (isMeetModeRoute && !event.defaultPrevented) {
              router.push({
                pathname: '/(tabs)/athlete-meet-plan',
                params: { returnTo: normalizedPathname },
              } as any);
            } else if (isLedgerHomeRoute && !event.defaultPrevented) {
              router.navigate('/(tabs)/ledger/home' as any);
            } else if (!isStateFocused && !event.defaultPrevented) {
              if (isTrainingRoute) router.navigate('/(tabs)/workout');
              else navigation.navigate(route.name as never);
            }

            if (isMessagesRoute) onMessagesTabPress();
          },
          onLongPress: () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          },
        };
      })}
    />
  );
}

export default function TabsLayout() {
  const {
    user: authenticatedUser,
    activeMobileMode: authenticatedMobileMode,
    workspaceKey: authenticatedWorkspaceKey,
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isDevStrengthTierCertification =
    __DEV__
    && pathname.endsWith('/ledger/dev-strength-tier-certification');
  const user = authenticatedUser
    ?? (isDevStrengthTierCertification ? DEV_STRENGTH_TIER_CERTIFICATION_USER : null);
  const activeMobileMode = !authenticatedUser && isDevStrengthTierCertification
    ? 'individual'
    : authenticatedMobileMode;
  const workspaceKey = !authenticatedUser && isDevStrengthTierCertification
    ? 'dev-strength-tier-certification:individual'
    : authenticatedWorkspaceKey;
  const insets = useSafeAreaInsets();
  const devPreviewSession = useDevLiveScreenSession();
  const [hasMessageNotifications, setHasMessageNotifications] = useState(false);
  const [hasMeetPlan, setHasMeetPlan] = useState(false);
  const unreadPollingRef = useRef(false);
  const meetPlanPollingRef = useRef(false);

  const isCoach = !!user?.is_coach;
  const accountState = user?.account_state;
  const isUnlinkedAthlete =
    !!user &&
    !user.is_coach &&
    (accountState === 'LINK_COACH_REQUIRED' ||
      user.link_coach_required === true ||
      !user.has_linked_athlete ||
      !user.athlete_id);
  const isIndividual = activeMobileMode === 'individual';
  const accessBlocked =
    !!user &&
    (
      accountState === 'EMAIL_VERIFICATION_REQUIRED' ||
      accountState === 'ACTIVATION_REQUIRED' ||
      (user.verification_required === true && user.email_verified === false) ||
      (user.is_coach === true && (user.billing_required === true || user.can_access_product === false))
    );
  const viewMode: MobileViewMode = activeMobileMode;
  const refreshMeetPlanAvailability = useCallback(async () => {
    if (!user || accessBlocked || isIndividual || isUnlinkedAthlete || viewMode !== 'athlete') {
      setHasMeetPlan(false);
      return;
    }
    if (meetPlanPollingRef.current) return;

    meetPlanPollingRef.current = true;
    try {
      const response = await fetchJson<{ has_meet_plan?: boolean }>(
        '/meet-planner/mobile/athlete/current',
        { method: 'GET' },
      );
      if (response.ok && response.json) {
        setHasMeetPlan(response.json.has_meet_plan === true);
      }
    } catch (err) {
      console.warn('Meet plan availability refresh failed', err);
    } finally {
      meetPlanPollingRef.current = false;
    }
  }, [accessBlocked, isIndividual, isUnlinkedAthlete, user, viewMode]);
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
    if (!isCoach) return;
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
      pathname.includes('/coach-attention') ||
      pathname.includes('/coach-more') ||
      pathname.includes('/coach-calendar') ||
      pathname.includes('/coach-videos') ||
      pathname.includes('/coach-review-queue') ||
      pathname.includes('/coach-review-history') ||
      pathname.includes('/coach-session-review') ||
      pathname.includes('/coach-video-review') ||
      pathname.includes('/coach-video-archive');

    if (viewMode === 'coach' && isAthleteFacingPath) {
      router.replace('/(tabs)/coach-dashboard');
    } else if (viewMode === 'athlete' && isCoachFacingPath) {
      router.replace('/(tabs)/athlete-dashboard');
    }
  }, [isCoach, isDevMockRoute, isIndividual, isUnlinkedAthlete, pathname, router, viewMode]);

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

  useEffect(() => {
    refreshMeetPlanAvailability();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshMeetPlanAvailability();
      }
    });

    return () => subscription.remove();
  }, [pathname, refreshMeetPlanAvailability]);

  if (!user) {
    return null;
  }

  if (((accessBlocked && !pathname.includes('/settings') && !isDevMockRoute) || (isUnlinkedAthlete && !pathname.includes('/settings') && !pathname.includes('/link-coach') && !isDevMockRoute)) && !(isAccessoryCatalogReviewRoute && canUseAccessoryCatalogReview)) {
    return null;
  }

  return (
    <CoachMoreNavigationProvider enabled={isCoach && !isIndividual && viewMode === 'coach'}>
      <View style={styles.safeArea}>
        <Tabs
        key={workspaceKey}
        screenOptions={{
          header: () => (
            <StrengthLedgerAppHeader
              brandAccessibilityLabel="Open Home"
              leftAction={{
                accessibilityLabel: 'Open Settings',
                icon: 'settings-outline',
                onPress: () => router.push('/(tabs)/settings'),
                size: 22,
              }}
              onBrandPress={() => {
                if (isUnlinkedAthlete) {
                  router.replace('/(tabs)/link-coach');
                } else if (isIndividual) {
                  router.replace('/(tabs)/athlete-dashboard');
                } else if (isCoach && viewMode === 'coach') {
                  router.replace('/(tabs)/coach-dashboard');
                } else {
                  router.replace('/(tabs)/athlete-dashboard');
                }
              }}
              rightAction={viewMode === 'coach' ? {
                accessibilityLabel: 'Open Team Brief',
                icon: 'reader-outline',
                onPress: () => router.push('/coach-team-brief' as any),
                size: 20,
              } : isIndividual ? {
                accessibilityLabel: 'Create Session',
                icon: 'add-circle-outline',
                onPress: () => router.push('/create-workout'),
                size: 23,
              } : {
                accessibilityLabel: 'Open messages',
                icon: 'chatbubbles-outline',
                onPress: () => {
                  refreshMessageNotifications();
                  router.push('/(tabs)/messages');
                },
                showNotificationDot: hasMessageNotifications,
                size: 21,
              }}
              topInset={insets.top}
            />
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
            hasMeetPlan={hasMeetPlan}
            hasMessageNotifications={hasMessageNotifications}
            onMessagesTabPress={refreshMessageNotifications}
            bottomInset={insets.bottom}
          />
        )}
      >
        <Tabs.Screen
          name="coach-dashboard"
          options={{
            title: 'Home',
            href: isCoach && !isIndividual && viewMode === 'coach' ? '/coach-dashboard' : null,
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
            title: 'Coach Home',
            headerShown: false,
            href: null,
          }}
        />

        <Tabs.Screen
          name="coach-athlete/[athleteId]"
          options={{
            href: null,
            headerShown: false,
            title: 'Athlete',
          }}
        />

        <Tabs.Screen
          name="coach-attention/[athleteId]"
          options={{
            href: null,
            headerShown: false,
            title: 'Needs Attention',
          }}
        />

        <Tabs.Screen
          name="coach-more"
          options={{
            title: 'More',
            headerShown: false,
            href: null,
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
            href: isCoach && !isIndividual && viewMode === 'coach' ? '/(tabs)/coach-calendar' : null,
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
          options={{ href: null, headerShown: false, title: 'Session Review' }}
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
          name="workout/program-timeline"
          options={{
            href: null,
            title: 'Program Timeline',
            headerShown: false,
            tabBarStyle: { display: 'none' },
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
            href: hasMeetPlan ? '/(tabs)/athlete-meet-plan' : null,
            headerShown: false,
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
          name="dev-mocks/anatomy-system"
          options={{ href: null, headerShown: false, title: 'Dynamic Anatomy QA' }}
        />
        <Tabs.Screen
          name="dev-mocks/text-layout"
          options={{ href: null, headerShown: false, title: 'Text Layout QA' }}
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
    </CoachMoreNavigationProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tabScene: {
    backgroundColor: 'transparent',
    // Mobile routes always receive a full-width canvas. Child surfaces own any intentional inset.
    paddingTop: 0,
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
