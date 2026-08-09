import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { SLColors, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
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
  coach?: {
    id?: number | null;
    name?: string | null;
    email?: string | null;
  } | null;
  athlete?: {
    id?: number | null;
    name?: string | null;
    coach_id?: number | null;
  } | null;
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
  const isCoachAccount = auth.user?.role === 'coach' || auth.user?.is_coach === true;
  const [state, setState] = useState<InviteState>({ alreadyLinked: false, invites: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingInviteId, setWorkingInviteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAccountLinkState = useCallback(async () => {
    const refreshed = await refreshAccountState();
    if (isCoachAccount) return false;
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
  }, [isCoachAccount, refreshAccountState, router]);

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
        coach: payload.coach || null,
        athlete: payload.athlete || null,
      });
      if (alreadyLinked && !isCoachAccount) {
        router.replace('/(tabs)/athlete-dashboard' as any);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not check for coach invites.');
    } finally {
      if (!quiet) setLoading(false);
      setRefreshing(false);
    }
  }, [isCoachAccount, refreshAccountLinkState, router]);

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
              router.replace(isCoachAccount ? '/(tabs)/settings' as any : '/(tabs)/athlete-dashboard' as any);
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
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={checkForInvite}
              tintColor={SLColors.warning}
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
            <Image
              source={require('../../assets/images/app_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
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

          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTopRow}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <ThemedText style={styles.statusPillText}>Account ready</ThemedText>
              </View>
              <View style={styles.iconBadge}>
                <Ionicons name="barbell-outline" size={20} color={SLColors.accentViolet} />
              </View>
            </View>
            <ThemedText variant="h1" numberOfLines={2} style={styles.title}>Pending coach invite</ThemedText>
            <ThemedText style={styles.heroLead}>You’re all set.</ThemedText>
            <ThemedText style={styles.body}>
              Your account has been created successfully. Once your coach sends an invitation, it will appear below and you’ll immediately gain access to your training.
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
          </View>

          {loading ? (
            <View style={styles.panel}>
              <ActivityIndicator size="small" color={SLColors.warning} />
              <ThemedText style={styles.mutedText}>Checking for invites…</ThemedText>
            </View>
          ) : error ? (
            <View style={styles.panel}>
              <Ionicons name="alert-circle-outline" size={22} color={SLColors.danger} />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : state.alreadyLinked ? (
            <View style={styles.panel}>
              <View style={styles.emptyIcon}>
                <Ionicons name="link-outline" size={24} color={SLColors.accentViolet} />
              </View>
              <ThemedText style={styles.emptyTitle}>Coach linked</ThemedText>
              <ThemedText style={styles.mutedText}>
                You’re linked to {state.coach?.name || state.coach?.email || 'your coach'}.
              </ThemedText>
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
                        <ThemedText typographyRole="dynamicName" style={styles.coachName}>{invite.coach_name || 'Coach'}</ThemedText>
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
                        <Ionicons name="close-outline" size={17} color={SLColors.danger} />
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
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SLSpacing.xl,
    paddingTop: SLSpacing.md,
    paddingBottom: 44,
    gap: SLSpacing.lg,
  },
  topBar: {
    minHeight: 76,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 10, 13, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(205, 194, 176, 0.08)',
  },
  logo: {
    width: 178,
    height: 66,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    backgroundColor: 'rgba(12, 13, 17, 0.76)',
    padding: SLSpacing.xl,
    gap: SLSpacing.md,
    ...SLShadows.shadowSheet,
  },
  heroGlow: {
    position: 'absolute',
    top: -70,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
  },
  heroTopRow: {
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
    backgroundColor: 'rgba(126, 166, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(126, 166, 184, 0.24)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: SLRadius.radiusSharp,
    backgroundColor: SLColors.success,
  },
  statusPillText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: SLRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.26)',
  },
  title: {
    color: SLColors.textStrong,
  },
  heroLead: {
    color: SLColors.warning,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 22,
    fontWeight: '800',
  },
  body: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLSpacing.sm,
    paddingTop: SLSpacing.sm,
  },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: SLSpacing.lg,
    borderRadius: SLRadius.radiusControl,
    backgroundColor: SLColors.accentSteel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SLSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(126, 166, 184, 0.92)',
  },
  primaryButtonText: {
    color: SLColors.textInverted,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 46,
    paddingHorizontal: SLSpacing.lg,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: 'rgba(17,24,39,0.74)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SLSpacing.sm,
  },
  secondaryButtonText: {
    color: SLColors.text,
    fontWeight: '700',
  },
  panel: {
    minHeight: 178,
    borderRadius: SLRadius.radiusSheet,
    borderWidth: 1,
    borderColor: 'rgba(205, 194, 176, 0.08)',
    backgroundColor: 'rgba(10, 11, 13, 0.68)',
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
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '800',
    textAlign: 'center',
  },
  mutedText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 21,
    textAlign: 'center',
  },
  errorText: {
    color: SLColors.danger,
    fontSize: SLTypography.rowTitle.fontSize,
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
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
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
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  coachName: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '800',
  },
  coachEmail: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
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
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
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
    color: SLColors.danger,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.86,
  },
});
