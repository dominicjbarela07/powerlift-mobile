import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import {
  SLFloatingNavigationDock,
  SL_TAB_ROW_CONTROL,
} from '@/components/navigation/sl-tab-row-control';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLAthleteAvatar, SLErrorState, SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLLayout, SLRadius, SLSpacing } from '@/constants/theme';

import { useCoachAthleteWorkspace, type WorkspaceDestination } from './CoachAthleteWorkspaceContext';

const DESTINATIONS: Array<{
  key: WorkspaceDestination;
  label: string;
  suffix: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'brief', label: 'Brief', suffix: '', icon: 'pulse-outline' },
  { key: 'training', label: 'Training', suffix: '/training', icon: 'barbell-outline' },
  { key: 'performance', label: 'Performance', suffix: '/performance', icon: 'analytics-outline' },
  { key: 'reviews', label: 'Reviews', suffix: '/reviews', icon: 'checkmark-done-outline' },
  { key: 'messages', label: 'Messages', suffix: '/messages', icon: 'chatbubbles-outline' },
];

function workspaceDestination(pathname: string): WorkspaceDestination | null {
  if (pathname.includes('/performance')) return 'performance';
  if (pathname.includes('/training')) return 'training';
  if (pathname.includes('/reviews')) return 'reviews';
  if (pathname.includes('/messages')) return 'messages';
  if (pathname.endsWith('/brief') || /\/coach-athlete\/[^/]+\/?$/.test(pathname)) return 'brief';
  return null;
}

export function CoachAthleteWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const workspace = useCoachAthleteWorkspace();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const selected = workspaceDestination(pathname);
  const athlete = workspace.bootstrap?.athlete;
  const basePath = `/(tabs)/coach-athlete/${workspace.athleteId}`;
  const pendingReviewCount = Number(workspace.summary?.pending_session_reviews.count || 0)
    + Number(workspace.summary?.pending_video_reviews.count || 0)
    + Number(workspace.bootstrap?.check_ins.submitted_unreviewed_count || 0);
  const destinationBadges = useMemo<Record<WorkspaceDestination, number>>(() => ({
    brief: (workspace.summary?.operational_status.reasons.length || 0)
      + Number(workspace.bootstrap?.check_ins.submitted_unreviewed_count || 0),
    training: 0,
    performance: 0,
    reviews: pendingReviewCount,
    messages: Number(workspace.summary?.unread_messages?.count || 0),
  }), [pendingReviewCount, workspace.bootstrap?.check_ins.submitted_unreviewed_count, workspace.summary]);

  const navigate = (destination: WorkspaceDestination) => {
    const suffix = DESTINATIONS.find((item) => item.key === destination)?.suffix || '';
    router.navigate({
      pathname: `${basePath}${suffix}` as any,
      params: { workspaceSubjectKey: workspace.subjectKey },
    });
  };
  const exitWorkspace = useCallback(() => {
    router.navigate('/(tabs)/coach-dashboard' as any);
  }, [router]);

  if (workspace.loading && !workspace.bootstrap) {
    return (
      <SLScreen edges="top" padded={false} style={styles.screen}>
        <View style={styles.state}>
          <ActivityIndicator color={COACH_V2.violetBright} size="large" />
          <Text style={styles.stateTitle}>Opening athlete workspace</Text>
          <Text style={styles.stateBody}>Resolving the active coaching relationship.</Text>
        </View>
      </SLScreen>
    );
  }

  if (workspace.error && !workspace.bootstrap) {
    return (
      <SLScreen edges="top" padded={false} style={styles.screen}>
        <View style={styles.errorWrap}>
          <SLErrorState
            actionLabel="Try Again"
            message={workspace.error}
            onActionPress={() => workspace.reload(false)}
            title="Athlete workspace unavailable"
          />
          <Pressable
            accessibilityRole="button"
            onPress={exitWorkspace}
            style={styles.exitLink}
          >
            <Text style={styles.exitLinkText}>Return to Coach Home</Text>
          </Pressable>
        </View>
      </SLScreen>
    );
  }

  if (!athlete) return null;

  const openProgramming = () => router.navigate({
    pathname: `${basePath}/training`,
    params: {
      athleteId: String(athlete.id),
      athleteName: athlete.name,
      workspaceReturn: 'training',
      workspaceSubjectKey: workspace.subjectKey,
    },
  } as any);

  return (
    <SLScreen edges="top" padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to previous Coach context"
          accessibilityRole="button"
          onPress={exitWorkspace}
          style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}
        >
          <Ionicons color={COACH_V2.text} name="chevron-back" size={20} />
          <Text style={styles.headerBackLabel}>Coach</Text>
        </Pressable>
        <SLAthleteAvatar
          imageUrl={athlete.profilePhotoUrl}
          imageVersion={athlete.profilePhotoVersion}
          name={athlete.name}
          size={42}
          statusColor={COACH_V2.green}
        />
        <View style={styles.identity}>
          <Text numberOfLines={1} style={styles.eyebrow}>ATHLETE WORKSPACE</Text>
          <Text numberOfLines={1} style={styles.athleteName}>{athlete.name}</Text>
        </View>
        <Pressable
          accessibilityLabel="Open athlete workspace options"
          accessibilityRole="button"
          onPress={() => setOverflowOpen(true)}
          style={({ pressed }) => [styles.headerControl, pressed && styles.pressed]}
        >
          <Ionicons color={COACH_V2.text} name="ellipsis-horizontal" size={23} />
        </Pressable>
      </View>

      <View key={workspace.subjectKey} style={styles.content}>{children}</View>

      {!keyboardVisible ? <Pressable
        accessibilityLabel="Open athlete actions"
        accessibilityRole="button"
        onPress={() => setToolkitOpen(true)}
        style={({ pressed }) => [
          styles.floatingToolkit,
          { bottom: SL_TAB_ROW_CONTROL.dockFrameHeight + insets.bottom + SLSpacing.md },
          pressed && styles.floatingToolkitPressed,
        ]}
      >
        <Ionicons color={COACH_V2.text} name="add" size={26} />
      </Pressable> : null}

      {!keyboardVisible ? <SLFloatingNavigationDock
        bottomInset={insets.bottom}
        items={DESTINATIONS.map((destination) => ({
          accessibilityLabel: destination.label,
          badge: destinationBadges[destination.key] || undefined,
          icon: destination.icon,
          key: destination.key,
          onPress: () => navigate(destination.key),
          selected: selected === destination.key,
        }))}
      /> : null}

      <StrengthLedgerBottomSheet
        accessibilityLabel="Athlete workspace options"
        heightFraction={0.56}
        onDismiss={() => setOverflowOpen(false)}
        visible={overflowOpen}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetEyebrow}>ATHLETE CONTEXT</Text>
          <Text style={styles.sheetTitle}>{athlete.name}</Text>
          <SheetAction icon="person-circle-outline" label="Context & relationship" onPress={() => { setOverflowOpen(false); router.push(`${basePath}/context` as any); }} />
          <SheetAction icon="create-outline" label="Coach notes & scratchpad" onPress={() => { setOverflowOpen(false); router.push(`${basePath}/notes` as any); }} />
          <SheetAction icon="book-outline" label="Evidence & Ledger" onPress={() => { setOverflowOpen(false); router.push(`${basePath}/evidence` as any); }} />
          <SheetAction icon="arrow-back-outline" label="Back to Coach context" onPress={() => { setOverflowOpen(false); exitWorkspace(); }} />
        </View>
      </StrengthLedgerBottomSheet>

      <StrengthLedgerBottomSheet
        accessibilityLabel="Athlete actions"
        heightFraction={0.68}
        onDismiss={() => setToolkitOpen(false)}
        visible={toolkitOpen}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetEyebrow}>COACH TOOLKIT</Text>
          <Text style={styles.sheetTitle}>Act for {athlete.name}</Text>
          <View style={styles.actionGrid}>
            <ToolkitAction icon="add-circle-outline" label="New Session" onPress={() => {
              setToolkitOpen(false);
              router.push({ pathname: '/(tabs)/create-workout', params: {
                athleteId: String(athlete.id), athleteName: athlete.name,
                ...(workspace.trainingState.selectedDate ? { date: workspace.trainingState.selectedDate } : {}),
              } } as any);
            }} />
            <ToolkitAction icon="chatbubble-ellipses-outline" label="Message Athlete" onPress={() => { setToolkitOpen(false); navigate('messages'); }} />
            <ToolkitAction icon="create-outline" label="Add Coach Note" onPress={() => { setToolkitOpen(false); router.push(`${basePath}/notes` as any); }} />
            <ToolkitAction icon="calendar-outline" label="Adjust Program" onPress={() => { setToolkitOpen(false); openProgramming(); }} />
            {workspace.summary?.next_assigned_session?.workout_id ? (
              <ToolkitAction icon="barbell-outline" label="Edit Next Session" onPress={() => {
                setToolkitOpen(false);
                router.push({
                  pathname: '/(tabs)/workout/session-workspace/[workoutId]',
                  params: {
                    workoutId: String(workspace.summary?.next_assigned_session?.workout_id),
                    athleteId: String(athlete.id),
                    workspaceReturn: 'training',
                  },
                } as any);
              }} />
            ) : null}
            {pendingReviewCount > 0 ? <ToolkitAction icon="checkmark-done-outline" label="Review Next Item" onPress={() => { setToolkitOpen(false); navigate('reviews'); }} /> : null}
          </View>
        </View>
      </StrengthLedgerBottomSheet>
    </SLScreen>
  );
}

function SheetAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sheetAction, pressed && styles.pressed]}>
      <View style={styles.sheetIcon}><Ionicons color={COACH_V2.violetBright} name={icon} size={20} /></View>
      <Text style={styles.sheetActionLabel}>{label}</Text>
      <Ionicons color={COACH_V2.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function ToolkitAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.toolkitAction, pressed && styles.pressed]}>
      <Ionicons color={COACH_V2.violetBright} name={icon} size={23} />
      <Text style={styles.toolkitLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000', flex: 1 },
  state: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 28 },
  stateTitle: { color: COACH_V2.text, fontSize: 20, fontWeight: '800', marginTop: 18 },
  stateBody: { color: COACH_V2.muted, fontSize: 15, marginTop: 7, textAlign: 'center' },
  errorWrap: { flex: 1, justifyContent: 'center', padding: SLLayout.screenGutter },
  exitLink: { alignSelf: 'center', marginTop: 12, padding: 12 },
  exitLinkText: { color: COACH_V2.violetBright, fontSize: 15, fontWeight: '700' },
  header: {
    alignItems: 'center',
    borderBottomColor: 'rgba(157,92,255,0.16)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 66,
    paddingHorizontal: SLLayout.screenGutter,
    paddingVertical: 8,
  },
  headerControl: {
    alignItems: 'center',
    backgroundColor: COACH_V2.surface,
    borderColor: COACH_V2.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerBack: {
    alignItems: 'center',
    backgroundColor: COACH_V2.surface,
    borderColor: COACH_V2.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 1,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  headerBackLabel: { color: COACH_V2.text, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  identity: { flex: 1, minWidth: 0 },
  eyebrow: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  athleteName: { color: COACH_V2.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  content: { flex: 1 },
  floatingToolkit: {
    alignItems: 'center',
    backgroundColor: COACH_V2.violet,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 25,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    position: 'absolute',
    right: SLLayout.screenGutter,
    shadowColor: COACH_V2.violet,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    width: 50,
  },
  floatingToolkitPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  sheet: { paddingBottom: SLSpacing.xl, paddingHorizontal: SLLayout.screenGutter, paddingTop: 4 },
  sheetEyebrow: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  sheetTitle: { color: COACH_V2.text, fontSize: 25, fontWeight: '800', marginBottom: 16, marginTop: 5 },
  sheetAction: { alignItems: 'center', borderBottomColor: COACH_V2.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 58 },
  sheetIcon: { alignItems: 'center', backgroundColor: 'rgba(157,92,255,0.12)', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  sheetActionLabel: { color: COACH_V2.text, flex: 1, fontSize: 15, fontWeight: '700' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolkitAction: { alignItems: 'flex-start', backgroundColor: COACH_V2.surface, borderColor: COACH_V2.border, borderRadius: SLRadius.md, borderWidth: 1, gap: 12, minHeight: 104, padding: 15, width: '48.5%' },
  toolkitLabel: { color: SLColors.textStrong, fontSize: 14, fontWeight: '800' },
});
