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
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  const [state, setState] = useState<InviteState>({ alreadyLinked: false, invites: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingInviteId, setWorkingInviteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvites = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
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
  }, [router]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const checkForInvite = async () => {
    setRefreshing(true);
    await loadInvites({ quiet: true });
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
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ThemedView style={styles.screen}>
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
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="mail-unread-outline" size={24} color="#F5D58A" />
            </View>
            <ThemedText style={styles.title}>Pending coach invite</ThemedText>
            <ThemedText style={styles.body}>
              You’re signed in, but you haven’t been linked to a coach yet. When your coach sends an invite, it will appear here.
            </ThemedText>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={checkForInvite}
              disabled={loading || refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#08111F" />
              ) : (
                <Ionicons name="refresh" size={17} color="#08111F" />
              )}
              <ThemedText style={styles.primaryButtonText}>Check for invite</ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/settings' as any)}
            >
              <Ionicons name="settings-outline" size={17} color="#CBD5E1" />
              <ThemedText style={styles.secondaryButtonText}>Settings</ThemedText>
            </Pressable>
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
              {state.invites.map((invite) => {
                const athleteName = `${invite.athlete_first || ''} ${invite.athlete_last || ''}`.trim() || 'Athlete';
                const isWorking = workingInviteId === invite.id;
                return (
                  <View key={invite.id} style={styles.inviteCard}>
                    <View style={styles.inviteTopRow}>
                      <View style={styles.coachAvatar}>
                        <Ionicons name="person-outline" size={20} color="#F5D58A" />
                      </View>
                      <View style={styles.inviteTitleBlock}>
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
                        <ThemedText style={styles.acceptButtonText}>
                          {isWorking ? 'Working…' : 'Accept'}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}
                        onPress={() => declineInvite(invite)}
                        disabled={isWorking}
                      >
                        <ThemedText style={styles.declineButtonText}>Decline</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.panel}>
              <Ionicons name="time-outline" size={24} color="#94A3B8" />
              <ThemedText style={styles.emptyTitle}>No invite yet</ThemedText>
              <ThemedText style={styles.mutedText}>
                You’re all set on this side. Check again after your coach sends an invite to this email.
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
    backgroundColor: '#020617',
  },
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    flexGrow: 1,
    paddingTop: 28,
    paddingBottom: 48,
    gap: 18,
  },
  header: {
    gap: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(216, 183, 106, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(216, 183, 106, 0.24)',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  body: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 23,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#D8B76A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#08111F',
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(15,23,42,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  panel: {
    minHeight: 190,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.13)',
    backgroundColor: 'rgba(8,16,38,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    gap: 10,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  mutedText: {
    color: '#94A3B8',
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
    gap: 12,
  },
  inviteCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(216, 183, 106, 0.20)',
    backgroundColor: 'rgba(8,16,38,0.96)',
    padding: 16,
    gap: 14,
  },
  inviteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coachAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(216, 183, 106, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(216, 183, 106, 0.28)',
  },
  inviteTitleBlock: {
    flex: 1,
    gap: 2,
  },
  coachName: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  coachEmail: {
    color: '#94A3B8',
    fontSize: 13,
  },
  inviteMeta: {
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.08)',
    padding: 12,
    gap: 3,
  },
  metaLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#D8B76A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#08111F',
    fontWeight: '800',
  },
  declineButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.28)',
    backgroundColor: 'rgba(127,29,29,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    color: '#FCA5A5',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.86,
  },
});
