import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SLAtmosphere } from '@/components/ui';
import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';
import { useAuth, type AuthUser } from '@/context/AuthContext';
import {
  acceptPendingCoachInvite,
  declinePendingCoachInvite,
  getPendingCoachInvites,
  type PendingCoachInvite,
} from '@/lib/api';

type InviteState = {
  alreadyLinked: boolean;
  invites: PendingCoachInvite[];
};

function authUserFromPayload(payload: any, fallbackEmail: string): AuthUser {
  return {
    email: String(payload?.email || fallbackEmail || ''),
    user_name: payload?.user_name ?? null,
    role: payload?.role === 'coach' ? 'coach' : 'athlete',
    is_coach: payload?.is_coach === true || payload?.role === 'coach',
    workspace_mode: payload?.workspace_mode,
    is_individual_workspace: payload?.is_individual_workspace === true,
    is_self_coached: payload?.is_self_coached === true,
    self_athlete_id: payload?.self_athlete_id ?? null,
    email_verified: payload?.email_verified !== false,
    verification_required: payload?.verification_required === true,
    verification_url: payload?.verification_url ?? null,
    billing_required: payload?.billing_required === true,
    billing_url: payload?.billing_url ?? null,
    has_linked_athlete: payload?.has_linked_athlete === true || !!payload?.athlete_id,
    athlete_id: payload?.athlete_id ?? payload?.athlete?.id ?? null,
  };
}

export default function PendingCoachInviteScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { refreshAccountState } = auth;
  const [state, setState] = useState<InviteState>({ alreadyLinked: false, invites: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingInviteId, setWorkingInviteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAccountLinkState = useCallback(async () => {
    const refreshed = await refreshAccountState();
    if (
      refreshed &&
      refreshed.account_state !== 'LINK_COACH_REQUIRED' &&
      refreshed.link_coach_required !== true &&
      (refreshed.is_coach || (refreshed.has_linked_athlete && refreshed.athlete_id))
    ) {
      router.replace('/' as any);
      return true;
    }
    return false;
  }, [refreshAccountState, router]);

  const loadInvites = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const accountReady = await refreshAccountLinkState();
      if (accountReady) return;
      const res = await getPendingCoachInvites();
      const payload = res.json;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || `Could not check invites (${res.status})`);
      }
      const alreadyLinked = payload.already_linked === true || !!payload.athlete?.coach_id;
      setState({
        alreadyLinked,
        invites: Array.isArray(payload.pending_invites) ? payload.pending_invites : [],
      });
      if (alreadyLinked) {
        router.replace('/(tabs)/athlete-dashboard' as any);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not check for coach invites.');
    } finally {
      if (!quiet) setLoading(false);
      setRefreshing(false);
    }
  }, [refreshAccountLinkState, router]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  useFocusEffect(
    useCallback(() => {
      void loadInvites({ quiet: true });
    }, [loadInvites])
  );

  const checkForInvite = async () => {
    setRefreshing(true);
    await loadInvites({ quiet: true });
  };

  const openPendingMessagesNotice = () => {
    Alert.alert(
      'Messages unlock with your coach',
      'Once your coach invitation is accepted, coach messages and announcements will appear in Strength Ledger.',
    );
  };

  const acceptInvite = (invite: PendingCoachInvite) => {
    Alert.alert(
      'Accept coach invite?',
      'This will link your account to this coach and give them access to your training logs and videos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept invite',
          onPress: async () => {
            setWorkingInviteId(invite.id);
            try {
              const res = await acceptPendingCoachInvite(invite.id);
              const payload = res.json;
              if (!res.ok || !payload?.ok) {
                throw new Error(payload?.error || `Could not accept invite (${res.status})`);
              }
              await auth.login({
                token: payload.token || auth.token,
                user: authUserFromPayload(payload, auth.user?.email || ''),
              });
              router.replace('/(tabs)/athlete-dashboard' as any);
            } catch (err: any) {
              Alert.alert('Invite not accepted', err?.message || 'Please try again.');
            } finally {
              setWorkingInviteId(null);
            }
          },
        },
      ],
    );
  };

  const declineInvite = (invite: PendingCoachInvite) => {
    Alert.alert(
      'Decline coach invite?',
      'This invite will be removed. You can only join this coach later if they send a new invite.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline invite',
          style: 'destructive',
          onPress: async () => {
            setWorkingInviteId(invite.id);
            try {
              const res = await declinePendingCoachInvite(invite.id);
              const payload = res.json;
              if (!res.ok || !payload?.ok) {
                throw new Error(payload?.error || `Could not decline invite (${res.status})`);
              }
              await loadInvites({ quiet: true });
            } catch (err: any) {
              Alert.alert('Invite not declined', err?.message || 'Please try again.');
            } finally {
              setWorkingInviteId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ThemedView style={styles.screen}>
        <SLAtmosphere />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={checkForInvite}
              tintColor="#D8B76A"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="Open Settings"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/(tabs)/settings' as any)}
              style={({ pressed }) => [styles.topIconButton, pressed && styles.pressed]}
            >
              <Ionicons name="settings-outline" size={25} color={SLColors.text} />
            </Pressable>
            <View style={styles.wordmark} accessibilityLabel="Strength Ledger">
              <ThemedText style={styles.wordmarkTop}>STRENGTH</ThemedText>
              <View style={styles.wordmarkBottomRow}>
                <View style={styles.wordmarkRule} />
                <ThemedText style={styles.wordmarkBottom}>LEDGER</ThemedText>
                <View style={styles.wordmarkRule} />
              </View>
            </View>
            <Pressable
              accessibilityLabel="Messages unlock after coach invite"
              accessibilityRole="button"
              hitSlop={8}
              onPress={openPendingMessagesNotice}
              style={({ pressed }) => [styles.topIconButton, pressed && styles.pressed]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={25} color={SLColors.text} />
            </Pressable>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusTopRow}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <ThemedText style={styles.statusPillText}>Account ready</ThemedText>
              </View>
              <View style={styles.statusIcon}>
                <Ionicons name="mail-unread-outline" size={19} color={SLColors.accentViolet} />
              </View>
            </View>
            <ThemedText style={styles.title}>Pending coach invite</ThemedText>
            <ThemedText style={styles.body}>
              We’ve created your athlete account. Once your coach sends an invitation, you’ll be able to immediately begin training.
            </ThemedText>

            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={checkForInvite}
                disabled={loading || refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={SLColors.textInverted} />
                ) : (
                  <Ionicons name="refresh" size={17} color={SLColors.textInverted} />
                )}
                <ThemedText style={styles.primaryButtonText}>Check for Invite</ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={() => router.push('/(tabs)/settings' as any)}
              >
                <Ionicons name="settings-outline" size={17} color={SLColors.text} />
                <ThemedText style={styles.secondaryButtonText}>Settings</ThemedText>
              </Pressable>
            </View>

            <View style={styles.workflowCard} accessibilityLabel="How coach invites work">
              <View style={styles.workflowStep}>
                <View style={styles.workflowIndex}>
                  <ThemedText style={styles.workflowIndexText}>1</ThemedText>
                </View>
                <ThemedText style={styles.workflowText}>Coach invites you</ThemedText>
              </View>
              <Ionicons name="chevron-down" size={14} color={SLColors.textSubtle} />
              <View style={styles.workflowStep}>
                <View style={styles.workflowIndex}>
                  <ThemedText style={styles.workflowIndexText}>2</ThemedText>
                </View>
                <ThemedText style={styles.workflowText}>Accept invitation</ThemedText>
              </View>
              <Ionicons name="chevron-down" size={14} color={SLColors.textSubtle} />
              <View style={styles.workflowStep}>
                <View style={styles.workflowIndex}>
                  <ThemedText style={styles.workflowIndexText}>3</ThemedText>
                </View>
                <ThemedText style={styles.workflowText}>Training unlocks</ThemedText>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.panel}>
              <ActivityIndicator size="small" color="#D8B76A" />
              <ThemedText style={styles.mutedText}>Checking for invites…</ThemedText>
            </View>
          ) : error ? (
            <View style={styles.panel}>
              <Ionicons name="alert-circle-outline" size={22} color="#FCA5A5" />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : state.invites.length ? (
            <View style={styles.inviteList}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionKicker}>Coach connection</ThemedText>
                <ThemedText style={styles.sectionTitle}>Invitation waiting</ThemedText>
              </View>
              {state.invites.map((invite) => {
                const athleteName = `${invite.athlete_first || ''} ${invite.athlete_last || ''}`.trim() || 'Athlete';
                const isWorking = workingInviteId === invite.id;
                return (
                  <View key={invite.id} style={styles.inviteCard}>
                    <View style={styles.inviteTopRow}>
                      <View style={styles.coachAvatar}>
                        <Ionicons name="person" size={24} color={SLColors.textStrong} />
                      </View>
                      <View style={styles.inviteTitleBlock}>
                        <ThemedText style={styles.inviteKicker}>Coach invite</ThemedText>
                        <ThemedText style={styles.coachName}>{invite.coach_name || 'Coach'}</ThemedText>
                        {invite.coach_email ? (
                          <ThemedText style={styles.coachEmail}>{invite.coach_email}</ThemedText>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.inviteMeta}>
                      <ThemedText style={styles.metaLabel}>Athlete name</ThemedText>
                      <ThemedText style={styles.metaValue}>{athleteName}</ThemedText>
                    </View>
                    <View style={styles.inviteActions}>
                      <Pressable
                        style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
                        onPress={() => acceptInvite(invite)}
                        disabled={isWorking}
                      >
                        <Ionicons name="checkmark-circle-outline" size={17} color={SLColors.textInverted} />
                        <ThemedText style={styles.acceptButtonText}>
                          {isWorking ? 'Working…' : 'Accept'}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}
                        onPress={() => declineInvite(invite)}
                        disabled={isWorking}
                      >
                        <Ionicons name="close-outline" size={17} color="#FCA5A5" />
                        <ThemedText style={styles.declineButtonText}>Decline</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.panel}>
              <View style={styles.emptyIcon}>
                <Ionicons name="pulse-outline" size={24} color={SLColors.accentViolet} />
              </View>
              <ThemedText style={styles.emptyTitle}>Your account is ready.</ThemedText>
              <ThemedText style={styles.mutedText}>
                Your coach hasn’t sent an invitation yet. Once they do, it’ll appear here automatically.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SLColors.shellCanvas,
  },
  screen: {
    flex: 1,
    backgroundColor: SLColors.shellCanvas,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SLSpacing.lg,
    paddingTop: SLSpacing.sm,
    paddingBottom: 104,
    gap: SLSpacing.md,
  },
  topBar: {
    minHeight: 74,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 10, 13, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(205, 194, 176, 0.10)',
  },
  wordmark: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 184,
  },
  wordmarkTop: {
    color: SLColors.textStrong,
    fontSize: 29,
    lineHeight: 31,
    fontFamily: SLTypography.title.fontFamily,
    fontWeight: '800',
    letterSpacing: 4,
  },
  wordmarkBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: -1,
  },
  wordmarkBottom: {
    color: SLColors.accentViolet,
    fontSize: 18,
    lineHeight: 20,
    fontFamily: SLTypography.title.fontFamily,
    fontWeight: '800',
    letterSpacing: 5,
  },
  wordmarkRule: {
    width: 34,
    height: 2,
    borderRadius: 999,
    backgroundColor: SLColors.accentViolet,
  },
  statusCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
    backgroundColor: 'rgba(18,18,30,0.62)',
    padding: SLSpacing.xl,
    gap: SLSpacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  statusTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusPill: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: SLRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.22)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SLColors.success,
  },
  statusPillText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
  },
  title: {
    color: SLColors.textStrong,
    fontSize: 34,
    lineHeight: 39,
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontWeight: '900',
    letterSpacing: 0,
  },
  body: {
    color: '#B8ACA1',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: SLSpacing.sm,
    paddingTop: SLSpacing.sm,
  },
  primaryButton: {
    flex: 1.2,
    minHeight: 46,
    paddingHorizontal: SLSpacing.md,
    borderRadius: SLRadius.radiusControl,
    backgroundColor: '#A69B8D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SLSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(214, 167, 94, 0.20)',
  },
  primaryButtonText: {
    color: SLColors.textInverted,
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButton: {
    flex: 0.85,
    minHeight: 46,
    paddingHorizontal: SLSpacing.md,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
    backgroundColor: 'rgba(24,16,15,0.48)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SLSpacing.sm,
  },
  secondaryButtonText: {
    color: SLColors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  workflowCard: {
    marginTop: SLSpacing.xs,
    borderRadius: SLRadius.radiusRow,
    borderWidth: 1,
    borderColor: 'rgba(205, 194, 176, 0.07)',
    backgroundColor: 'rgba(10, 11, 13, 0.42)',
    padding: SLSpacing.md,
    gap: SLSpacing.xs,
  },
  workflowStep: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SLSpacing.sm,
  },
  workflowIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.20)',
  },
  workflowIndexText: {
    color: SLColors.accentViolet,
    fontSize: 12,
    fontWeight: '900',
  },
  workflowText: {
    color: SLColors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  panel: {
    minHeight: 142,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(205, 194, 176, 0.07)',
    backgroundColor: 'rgba(10, 11, 13, 0.50)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SLSpacing.xl,
    gap: SLSpacing.sm,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
  },
  emptyTitle: {
    color: SLColors.textStrong,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  mutedText: {
    color: '#B8AEA1',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  inviteList: {
    gap: SLSpacing.md,
  },
  sectionHeader: {
    gap: 2,
    paddingHorizontal: 2,
  },
  sectionKicker: {
    color: SLColors.accentViolet,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    color: SLColors.textStrong,
    fontSize: 18,
    fontWeight: '800',
  },
  inviteCard: {
    borderRadius: SLRadius.radiusSheet,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.24)',
    backgroundColor: 'rgba(12, 13, 17, 0.82)',
    padding: SLSpacing.lg,
    gap: SLSpacing.md,
  },
  inviteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SLSpacing.md,
  },
  coachAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(126, 166, 184, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(126, 166, 184, 0.38)',
  },
  inviteTitleBlock: {
    flex: 1,
    gap: 3,
  },
  inviteKicker: {
    color: SLColors.textSubtle,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  coachName: {
    color: SLColors.textStrong,
    fontSize: 20,
    fontWeight: '800',
  },
  coachEmail: {
    color: '#B8AEA1',
    fontSize: 13,
  },
  inviteMeta: {
    borderRadius: SLRadius.radiusRow,
    backgroundColor: 'rgba(205, 194, 176, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(205, 194, 176, 0.07)',
    padding: SLSpacing.md,
    gap: 3,
  },
  metaLabel: {
    color: SLColors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: SLColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  acceptButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: SLRadius.radiusControl,
    backgroundColor: SLColors.accentSteel,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(126, 166, 184, 0.92)',
  },
  acceptButtonText: {
    color: SLColors.textInverted,
    fontWeight: '800',
  },
  declineButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.28)',
    backgroundColor: 'rgba(127,29,29,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SLSpacing.xs,
  },
  declineButtonText: {
    color: '#FCA5A5',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.86,
  },
});
