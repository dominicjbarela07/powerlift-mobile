// app/index.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';
import { startMobileBillingCheckout } from '@/lib/api';

function AccountAccessGate({
  title,
  body,
  actionLabel,
  actionUrl,
  mode = 'link',
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionUrl?: string | null;
  mode?: 'link' | 'billing';
}) {
  const { logout, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);

  const refreshBillingState = useCallback(async (options?: { silent?: boolean }) => {
    if (mode !== 'billing' || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setRefreshing(true);
    if (!options?.silent) setError(null);
    try {
      await refreshUser();
    } catch (err) {
      console.warn('Could not refresh billing status', err);
      if (!options?.silent) {
        setError('Could not refresh activation status. Please try again.');
      }
    } finally {
      refreshInFlightRef.current = false;
      setRefreshing(false);
    }
  }, [mode, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      if (mode === 'billing') {
        refreshBillingState({ silent: true });
      }
      return undefined;
    }, [mode, refreshBillingState])
  );

  useEffect(() => {
    if (mode !== 'billing') return undefined;

    refreshBillingState({ silent: true });
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshBillingState({ silent: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [mode, refreshBillingState]);

  const openAction = async () => {
    if (busy || refreshing) return;
    setError(null);
    try {
      setBusy(true);
      if (mode === 'billing') {
        const checkout = await startMobileBillingCheckout();
        if (!checkout.ok) {
          setError(checkout.error || 'Unable to start activation.');
          return;
        }
        if (checkout.active) {
          await refreshUser();
          return;
        }
        if (!checkout.checkout_url) {
          setError('Stripe Checkout did not return a URL.');
          return;
        }
        try {
          const WebBrowser = await import('expo-web-browser');
          await WebBrowser.openBrowserAsync(checkout.checkout_url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
          });
        } catch (browserErr) {
          console.warn('Stripe WebBrowser unavailable; falling back to Linking', browserErr);
          await Linking.openURL(checkout.checkout_url);
        }
        await refreshBillingState({ silent: true });
        return;
      }

      if (!actionUrl) return;
      await Linking.openURL(actionUrl);
    } catch (err) {
      console.warn('Could not open account action URL', err);
      setError((err as any)?.message || 'Unable to open activation.');
    } finally {
      setBusy(false);
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
          style={[styles.gatePrimary, busy || refreshing ? styles.gatePrimaryDisabled : null]}
          onPress={openAction}
          disabled={busy || refreshing || (mode === 'link' && !actionUrl)}
        >
          <Text style={styles.gatePrimaryText}>
            {busy ? 'Opening Stripe...' : refreshing ? 'Checking status...' : actionLabel}
          </Text>
        </Pressable>
        {mode === 'billing' ? (
          <Pressable
            style={[styles.gateSecondary, refreshing ? styles.gateSecondaryDisabled : null]}
            onPress={() => refreshBillingState()}
            disabled={refreshing || busy}
          >
            <Text style={styles.gateSecondaryText}>{refreshing ? 'Checking...' : 'Refresh status'}</Text>
          </Pressable>
        ) : null}
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

  if (user.verification_required && user.email_verified === false) {
    return (
      <AccountAccessGate
        title="Verify your email"
        body="Check your inbox and verify your email before entering Strength Ledger."
        actionLabel="Open verification"
        actionUrl={user.verification_url}
      />
    );
  }

  if (user.is_coach && user.billing_required) {
    return (
      <AccountAccessGate
        title={isIndividual ? 'Activate Individual' : 'Activate membership'}
        body="Your account is ready. Activate Stripe membership before entering the mobile app."
        actionLabel="Open activation"
        mode="billing"
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
  gatePrimaryDisabled: {
    opacity: 0.62,
  },
  gatePrimaryText: {
    fontFamily: SLTypography.buttonLabel.fontFamily,
    fontWeight: SLTypography.buttonLabel.fontWeight,
    color: '#F5F3FF',
  },
  gateError: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 13,
    lineHeight: 19,
    color: '#FCA5A5',
  },
  gateSecondary: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryDisabled: {
    opacity: 0.65,
  },
  gateSecondaryText: {
    fontFamily: SLFontFamilies.sansSemiBold,
    color: SLColors.textMuted,
  },
});
