// app/index.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { devSimulateStripeActivation, startMobileBillingCheckout } from '@/lib/api';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';

function AccountAccessGate({
  title,
  body,
  actionLabel,
  actionUrl,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionUrl?: string | null;
}) {
  const router = useRouter();
  const { user, token, login, logout, refreshAccountState } = useAuth();
  const [simulating, setSimulating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activationRequired =
    user?.account_state === 'ACTIVATION_REQUIRED' ||
    user?.billing_required === true ||
    (user?.is_coach === true && user?.can_access_product === false);
  const showDevSimulation =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    user?.dev_onboarding_simulation_enabled === true &&
    activationRequired;

  const refreshActivationState = useCallback(
    async ({ showMessage = false }: { showMessage?: boolean } = {}) => {
      if (showMessage) setChecking(true);
      if (showMessage) setError(null);
      try {
        const refreshed = await refreshAccountState();
        const stillActivationRequired =
          refreshed?.account_state === 'ACTIVATION_REQUIRED' ||
          refreshed?.billing_required === true ||
          (refreshed?.is_coach === true && refreshed?.can_access_product === false);
        if (refreshed && !stillActivationRequired) {
          router.replace('/');
          return;
        }
        if (showMessage) {
          setError('Still waiting for activation to complete.');
        }
      } catch (err: any) {
        if (showMessage) {
          setError(err?.message || 'Could not check activation status.');
        }
      } finally {
        if (showMessage) setChecking(false);
      }
    },
    [refreshAccountState, router]
  );

  useFocusEffect(
    useCallback(() => {
      void refreshActivationState();
    }, [refreshActivationState])
  );

  const applyActivationPayload = async (payload: any = {}) => {
    if (!user) return;
    const payloadUser = payload.user || payload;
    const refreshed = {
      ...user,
      account_state: payloadUser.account_state ?? user.account_state ?? null,
      next_url: payloadUser.next_url ?? user.next_url ?? null,
      next_route: payloadUser.next_route ?? user.next_route ?? null,
      can_access_product:
        payloadUser.can_access_product === false
          ? false
          : payloadUser.can_access_product === true
          ? true
          : user.can_access_product,
      link_coach_required:
        payloadUser.link_coach_required === true
          ? true
          : payloadUser.link_coach_required === false
          ? false
          : user.link_coach_required,
      account_state_detail: payloadUser.account_state_detail ?? user.account_state_detail,
      billing_required:
        payloadUser.billing_required === true
          ? true
          : payloadUser.billing_required === false
          ? false
          : user.billing_required,
      billing_url: payloadUser.billing_url ?? user.billing_url ?? null,
      verification_required:
        payloadUser.verification_required === true
          ? true
          : payloadUser.verification_required === false
          ? false
          : user.verification_required,
      workspace_mode: payloadUser.workspace_mode ?? user.workspace_mode,
      is_individual_workspace:
        payloadUser.is_individual_workspace === true
          ? true
          : payloadUser.is_individual_workspace === false
          ? false
          : user.is_individual_workspace,
      is_self_coached:
        payloadUser.is_self_coached === true
          ? true
          : payloadUser.is_self_coached === false
          ? false
          : user.is_self_coached,
      self_athlete_id: payloadUser.self_athlete_id ?? user.self_athlete_id ?? null,
      dev_onboarding_simulation_enabled:
        payloadUser.dev_onboarding_simulation_enabled === true ||
        user.dev_onboarding_simulation_enabled === true,
    };
    await login({ user: refreshed, token });
  };

  const openActivation = async () => {
    setActivating(true);
    setError(null);
    try {
      const result = await startMobileBillingCheckout();
      const payload = result.json || {};
      if (!result.ok || payload.ok === false) {
        setError(payload.error || payload.message || 'Could not start activation. Please try again.');
        return;
      }
      if (payload.active === true && !payload.checkout_url) {
        await refreshActivationState();
        return;
      }
      const checkoutUrl = payload.checkout_url || actionUrl;
      if (!checkoutUrl) {
        setError('Could not start activation. Please try again.');
        return;
      }
      await Linking.openURL(checkoutUrl);
      void refreshActivationState();
    } catch (err: any) {
      console.warn('Could not start activation', err);
      setError(err?.message || 'Could not start activation. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  const openFallbackAction = async () => {
    if (!actionUrl) return;
    try {
      await Linking.openURL(actionUrl);
    } catch (err) {
      console.warn('Could not open account action URL', err);
      setError('Could not open activation. Please try again.');
    }
  };

  const simulateActivation = async () => {
    setSimulating(true);
    setError(null);
    try {
      const result = await devSimulateStripeActivation();
      const payload = result.json || {};
      if (!result.ok || payload.ok === false) {
        setError(payload.error || payload.message || 'Could not simulate Stripe activation.');
        return;
      }
      await applyActivationPayload(payload);
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <View style={styles.gateScreen}>
      <Image
        source={require('@/assets/images/16:9.png')}
        style={styles.gateLogo}
        resizeMode="contain"
      />
      <View style={styles.gatePanel}>
        <Text style={styles.gateEyebrow}>Account Setup</Text>
        <Text style={styles.gateTitle}>{title}</Text>
        <Text style={styles.gateBody}>{body}</Text>
        {error ? <Text style={styles.gateError}>{error}</Text> : null}
        <Pressable
          style={[styles.gatePrimary, (showDevSimulation ? simulating : activating) && styles.disabledButton]}
          onPress={showDevSimulation ? simulateActivation : openActivation}
          disabled={showDevSimulation ? simulating : activating}
        >
          {simulating || activating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.gatePrimaryText}>
              {showDevSimulation ? 'Dev: Simulate Stripe Activation' : actionLabel}
            </Text>
          )}
        </Pressable>
        {showDevSimulation && actionUrl ? (
          <Pressable style={styles.gateOutline} onPress={openFallbackAction} disabled={simulating}>
            <Text style={styles.gateOutlineText}>Open activation URL</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.gateOutline, checking && styles.disabledButton]}
          onPress={() => refreshActivationState({ showMessage: true })}
          disabled={checking}
        >
          <Text style={styles.gateOutlineText}>Check again</Text>
        </Pressable>
        <Pressable style={styles.gateSecondary} onPress={logout}>
          <Text style={styles.gateSecondaryText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function IndexGate() {
  const { user } = useAuth();

  // 🔒 Not logged in → go to login
  if (!user) {
    return <Redirect href="/login" />;
  }

  const isIndividual =
    user.is_coach &&
    (user.workspace_mode === 'individual' ||
      user.is_individual_workspace === true ||
      user.is_self_coached === true);
  const accountState = user.account_state;

  if (
    accountState === 'EMAIL_VERIFICATION_REQUIRED' ||
    (user.verification_required && user.email_verified === false)
  ) {
    return <Redirect href={'/verify-email' as any} />;
  }

  if (
    user.is_coach &&
    (accountState === 'ACTIVATION_REQUIRED' || user.billing_required || user.can_access_product === false)
  ) {
    return (
      <AccountAccessGate
        title={isIndividual ? 'Activate Individual' : 'Activate membership'}
        body="Your account is ready. Activate Stripe membership before entering the mobile app."
        actionLabel="Open activation"
        actionUrl={user.billing_url}
      />
    );
  }

  // ✅ Individual / self-coached users are coach-role accounts.
  if (isIndividual) {
    return <Redirect href="/(tabs)/athlete-dashboard" />;
  }

  // ✅ Logged in athlete with linked profile → athlete dashboard
  if (!user.is_coach && user.has_linked_athlete && user.athlete_id) {
    return <Redirect href="/(tabs)/athlete-dashboard" />;
  }

  if (!user.is_coach) {
    return <Redirect href="/(tabs)/link-coach" />;
  }

  // ✅ Logged in coach → send to tabs home (the file app/(tabs)/index.tsx)
  return <Redirect href="/(tabs)/coach-dashboard" />;
}

const styles = StyleSheet.create({
  gateScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#070707',
  },
  gateLogo: {
    alignSelf: 'center',
    width: 230,
    height: 54,
    marginBottom: 34,
  },
  gatePanel: {
    gap: 14,
    paddingVertical: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
  },
  gateEyebrow: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: '#F0BF63',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  gateTitle: {
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: SLTypography.commandTitle.fontWeight,
    color: '#F8FAFC',
  },
  gateBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
    color: '#B8ACA1',
  },
  gatePrimary: {
    minHeight: 52,
    marginTop: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
    backgroundColor: 'rgba(124, 58, 237, 0.58)',
  },
  gatePrimaryText: {
    fontFamily: SLTypography.buttonLabel.fontFamily,
    fontWeight: SLTypography.buttonLabel.fontWeight,
    color: '#F5F3FF',
  },
  disabledButton: {
    opacity: 0.62,
  },
  gateError: {
    fontFamily: SLFontFamilies.sansSemiBold,
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  gateOutline: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.28)',
  },
  gateOutlineText: {
    fontFamily: SLTypography.buttonLabel.fontFamily,
    fontWeight: SLTypography.buttonLabel.fontWeight,
    color: '#DDD6FE',
  },
  gateSecondary: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryText: {
    fontFamily: SLFontFamilies.sansSemiBold,
    color: SLColors.textMuted,
  },
});
