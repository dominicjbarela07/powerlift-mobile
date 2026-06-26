// app/index.tsx
import React, { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';
import { startMobileBillingCheckout } from '@/lib/api';
import { OnboardingSupportFooter } from '@/components/OnboardingSupportFooter';

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
  const { logout } = useAuth();

  const openAction = async () => {
    if (!actionUrl) return;
    try {
      await Linking.openURL(actionUrl);
    } catch (err) {
      console.warn('Could not open account action URL', err);
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
        <Pressable style={styles.gatePrimary} onPress={openAction} disabled={!actionUrl}>
          <Text style={styles.gatePrimaryText}>{actionLabel}</Text>
        </Pressable>
        <Pressable style={styles.gateSecondary} onPress={logout}>
          <Text style={styles.gateSecondaryText}>Log out</Text>
        </Pressable>
        <OnboardingSupportFooter />
      </View>
    </View>
  );
}

function BillingActivationGate({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const { logout } = useAuth();
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCheckout = async () => {
    if (isOpeningCheckout) return;
    setIsOpeningCheckout(true);
    setError(null);
    try {
      const response = await startMobileBillingCheckout();
      const payload: {
        ok?: boolean;
        active?: boolean;
        checkout_url?: string | null;
        error?: string;
      } = response.json || {};
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Unable to start checkout (HTTP ${response.status}).`);
      }
      if (payload.checkout_url) {
        await Linking.openURL(payload.checkout_url);
        return;
      }
      if (payload.active) {
        setError('Membership is already active. Close and reopen Strength Ledger to continue.');
        return;
      }
      throw new Error('Checkout is not available for this account yet.');
    } catch (err) {
      setError((err as Error)?.message || 'Unable to start Stripe Checkout.');
    } finally {
      setIsOpeningCheckout(false);
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
          style={[styles.gatePrimary, isOpeningCheckout && styles.gatePrimaryDisabled]}
          onPress={openCheckout}
          disabled={isOpeningCheckout}
        >
          <Text style={styles.gatePrimaryText}>
            {isOpeningCheckout ? 'Opening Stripe...' : 'Start activation'}
          </Text>
        </Pressable>
        <Pressable style={styles.gateSecondary} onPress={logout}>
          <Text style={styles.gateSecondaryText}>Log out</Text>
        </Pressable>
        <OnboardingSupportFooter />
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
    return <Redirect href={'/verify-email' as any} />;
  }

  if (user.is_coach && user.billing_required) {
    return (
      <BillingActivationGate
        title={isIndividual ? 'Activate Individual' : 'Activate membership'}
        body="Your account is ready. Activate Stripe membership before entering the mobile app."
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
  gatePrimaryDisabled: {
    opacity: 0.68,
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
  gateSecondaryText: {
    fontFamily: SLFontFamilies.sansSemiBold,
    color: SLColors.textMuted,
  },
});
