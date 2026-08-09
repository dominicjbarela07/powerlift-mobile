import React, { useCallback, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLButton } from '@/components/ui/sl-button';
import { useFocusEffect } from '@react-navigation/native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  devSimulateEmailVerification,
  resendEmailVerificationCode,
  verifyEmailVerificationCode,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLFontFamilies, SLOpacity, SLRadius, SLTypography } from '@/constants/theme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, token, login, logout, refreshAccountState } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [checking, setChecking] = useState(false);

  const refreshVerificationState = useCallback(
    async ({ showMessage = false }: { showMessage?: boolean } = {}) => {
      if (showMessage) setChecking(true);
      if (showMessage) {
        setError(null);
        setMessage(null);
      }
      try {
        const refreshed = await refreshAccountState();
        const stillNeedsVerification =
          refreshed?.account_state === 'EMAIL_VERIFICATION_REQUIRED' ||
          (refreshed?.verification_required === true && refreshed?.email_verified === false);
        if (refreshed && !stillNeedsVerification) {
          router.replace('/');
          return;
        }
        if (showMessage) {
          setMessage('Still waiting for email verification.');
        }
      } catch (err: any) {
        if (showMessage) {
          setError(err?.message || 'Could not check verification status.');
        }
      } finally {
        if (showMessage) setChecking(false);
      }
    },
    [refreshAccountState, router]
  );

  useFocusEffect(
    useCallback(() => {
      void refreshVerificationState();
    }, [refreshVerificationState])
  );

  if (!user) return <Redirect href="/login" />;
  if (!user.verification_required || user.email_verified !== false) return <Redirect href="/" />;

  const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
  const showDevSimulation =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    user.dev_onboarding_simulation_enabled === true;

  const applyVerifiedPayload = async (payload: any = {}) => {
    const payloadUser = payload.user || payload;
    const refreshed = {
      ...user,
      email_verified: true,
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
      verification_required:
        payloadUser.verification_required === true
          ? true
          : payloadUser.verification_required === false
          ? false
          : false,
      verification_url: null,
      billing_required:
        payloadUser.billing_required === true
          ? true
          : payloadUser.billing_required === false
          ? false
          : user.billing_required,
      billing_url: payloadUser.billing_url ?? user.billing_url ?? null,
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
      has_linked_athlete:
        payloadUser.has_linked_athlete === true
          ? true
          : payloadUser.has_linked_athlete === false
          ? false
          : user.has_linked_athlete,
      athlete_id: payloadUser.athlete_id ?? user.athlete_id ?? null,
      dev_onboarding_simulation_enabled:
        payloadUser.dev_onboarding_simulation_enabled === true ||
        user.dev_onboarding_simulation_enabled === true,
    };
    await login({ user: refreshed, token });
    router.replace('/');
  };

  const handleVerify = async () => {
    if (normalizedCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      setMessage(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await verifyEmailVerificationCode(normalizedCode);
      const payload = result.json || {};
      if (!result.ok || payload.ok === false) {
        setError(payload.error || payload.message || 'That code could not be verified.');
        return;
      }
      await applyVerifiedPayload(payload);
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevSimulate = async () => {
    setSimulating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await devSimulateEmailVerification();
      const payload = result.json || {};
      if (!result.ok || payload.ok === false) {
        setError(payload.error || payload.message || 'Could not simulate email verification.');
        return;
      }
      await applyVerifiedPayload(payload);
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      setSimulating(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await resendEmailVerificationCode();
      const payload = result.json || {};
      if (!result.ok || payload.ok === false) {
        setError(payload.error || payload.message || 'Could not send a new code yet.');
        return;
      }
      setMessage('New verification code sent.');
      setCode('');
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Image
              source={require('@/assets/images/16:9.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.panel}>
              <Text style={styles.eyebrow}>Email Verification</Text>
              <Text style={styles.title}>Enter your code</Text>
              <Text style={styles.body}>
                We sent a 6-digit Strength Ledger verification code to {user.email}.
              </Text>

              <TextInput
                value={normalizedCode}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor={SLColors.textSubtle}
                style={styles.codeInput}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}

              <SLButton
                fullWidth
                label="Verify Email"
                loading={submitting}
                onPress={handleVerify}
                size="lg"
              />

              <SLButton
                fullWidth
                label="Resend code"
                loading={resending}
                onPress={handleResend}
                variant="secondary"
              />

              <SLButton
                fullWidth
                label="Check again"
                loading={checking}
                onPress={() => refreshVerificationState({ showMessage: true })}
                variant="secondary"
              />

              {showDevSimulation ? (
                <Pressable
                  style={[styles.devButton, simulating && styles.disabledButton]}
                  onPress={handleDevSimulate}
                  disabled={simulating}
                >
                  <Text style={styles.devButtonText}>
                    {simulating ? 'Simulating...' : 'Dev: Simulate Email Verification'}
                  </Text>
                </Pressable>
              ) : null}

              <SLButton fullWidth label="Log out" onPress={logout} variant="ghost" />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logo: {
    alignSelf: 'center',
    width: 230,
    height: 54,
    marginBottom: 30,
  },
  panel: {
    gap: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.radiusHero,
    backgroundColor: SLColors.surfaceCommand,
  },
  eyebrow: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: SLColors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: SLTypography.title.fontSize,
    lineHeight: SLTypography.title.lineHeight,
    fontWeight: SLTypography.commandTitle.fontWeight,
    color: SLColors.textStrong,
  },
  body: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 22,
    color: SLColors.textMuted,
  },
  codeInput: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.radiusCard,
    paddingHorizontal: 16,
    backgroundColor: SLColors.surfaceInset,
    color: SLColors.text,
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.hero.fontSize,
    fontWeight: '800',
    letterSpacing: 9,
    textAlign: 'center',
  },
  error: {
    color: SLColors.danger,
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
  },
  message: {
    color: SLColors.success,
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
  },
  devButton: {
    minHeight: 46,
    borderRadius: SLRadius.radiusCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.warning,
    backgroundColor: SLColors.warningSoft,
  },
  devButtonText: {
    color: SLColors.warning,
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: SLOpacity.disabled,
  },
});
