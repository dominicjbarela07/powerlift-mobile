import { useSetupStatusRefresh } from '@/hooks/useSetupStatusRefresh';
import { validSupportEmail } from '@/lib/recovery-support';
import { onboardingMessage } from '@/lib/onboarding-message';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingSupport } from '@/components/onboarding/OnboardingSupport';
import { KeyboardAvoidingView, KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Platform, Pressable, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLButton } from '@/components/ui/sl-button';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  devSimulateEmailVerification,
  correctOnboardingEmail,
  resendEmailVerificationCode,
  verifyEmailVerificationCode,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLFontFamilies, SLOpacity, SLRadius, SLTypography } from '@/constants/theme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, applyAccountStatePayload, logout, refreshAccountState } = useAuth();
  const actionInFlight = useRef(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const changeEmail = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setSavingEmail(true); setError(null);
    try {
      const result = await correctOnboardingEmail(newEmail);
      if (!result.ok) throw new Error(result.json?.error || 'We could not update that email. Please retry.');
      if (result.json?.email) await applyAccountStatePayload(result.json);
      setCode(''); setCorrecting(false); setResendWait(60);
      void refreshAccountState().catch(() => undefined);
      setMessage('Email updated. Enter the new code we sent you.');
    } catch (err: any) { setError(err?.message || 'Could not connect. Your account is saved; please retry.'); }
    finally { actionInFlight.current = false; setSavingEmail(false); }
  };
  useEffect(() => {
    if (!resendWait) return;
    const timer = setTimeout(() => setResendWait(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendWait]);

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

  useSetupStatusRefresh(refreshVerificationState);

  if (!user) return <Redirect href="/login" />;
  if (!user.verification_required || user.email_verified !== false) return <Redirect href="/" />;

  const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
  const showDevSimulation =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    user.dev_onboarding_simulation_enabled === true;

  const applyVerifiedPayload = async (payload: any = {}) => {
    const refreshed = await applyAccountStatePayload(payload);
    if (refreshed?.email_verified !== true || refreshed.account_state === 'EMAIL_VERIFICATION_REQUIRED') {
      setError('We could not confirm email verification. Check status or retry your code.');
      return;
    }
    router.replace('/');
  };

  const handleVerify = async () => {
    if (actionInFlight.current) return;
    if (normalizedCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      setMessage(null);
      return;
    }
    actionInFlight.current = true;
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
      actionInFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleDevSimulate = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
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
      actionInFlight.current = false;
      setSimulating(false);
    }
  };

  const handleResend = async () => {
    if (resendWait || actionInFlight.current) return;
    actionInFlight.current = true;
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await resendEmailVerificationCode();
      const payload = result.json || {};
      setResendWait(payload.retry_after_seconds || (result.ok ? 60 : 0));
      if (!result.ok || payload.ok === false) {
        setError(payload.error || payload.message || 'Could not send a new code yet.');
        return;
      }
      setMessage('New verification code sent.');
      setCode('');
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      actionInFlight.current = false;
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
            <View style={styles.verificationPane}>
            <Image
              source={require('@/assets/images/16:9.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.panel}>
              {user.is_coach ? <OnboardingProgress step={2} /> : null}
              <Text style={styles.eyebrow}>Keep your account secure</Text>
              <Text style={styles.title}>Enter your code</Text>
              <Text style={styles.body}>
                We sent a 6-digit Strength Ledger verification code to {user.email}.
              </Text>

              <TextInput
                accessibilityLabel="6-digit email verification code"
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

              {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{onboardingMessage(error)}</Text> : null}
              {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}

              <SLButton
                fullWidth
                label="Verify email and continue"
                variant="secondary"
                style={{ backgroundColor: SLColors.accentVioletSoft, borderColor: SLColors.accentViolet }}
                disabled={resending || savingEmail || simulating}
                loading={submitting}
                onPress={handleVerify}
                size="lg"
              />

              <SLButton
                fullWidth
                label={resendWait ? `Resend code in ${resendWait}s` : 'Resend code'}
                disabled={resendWait > 0 || resending || submitting || savingEmail || simulating}
                loading={resending}
                onPress={handleResend}
                variant="secondary"
              />

              <SLButton
                fullWidth
                label="Already verified? Check status"
                loading={checking}
                onPress={() => refreshVerificationState({ showMessage: true })}
                variant="ghost"
              />

              {user.is_coach ? <>
                <SLButton label="Wrong email address?" variant="ghost" onPress={() => setCorrecting(!correcting)} />
                {correcting && <View style={{ gap: 12 }}>
                  <Text style={styles.body}>Correct your email. We will send a new code for this account.</Text>
                  <TextInput accessibilityLabel="Correct email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={newEmail} onChangeText={setNewEmail} placeholder="Your correct email" placeholderTextColor={SLColors.textMuted} style={{ minHeight: 48, padding: 12, borderRadius: SLRadius.radiusControl, borderWidth: 1, borderColor: SLColors.borderDefault, color: SLColors.textStrong }} />
                  <SLButton label="Update email and send code" variant="secondary" loading={savingEmail} onPress={changeEmail} disabled={!validSupportEmail(newEmail) || savingEmail} />
                </View>}
              </> : null}
              <OnboardingSupport step="verify" />
              {showDevSimulation ? (
                <Pressable
                  accessibilityRole="button"
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
    paddingVertical: 20,
  },
  verificationPane: {
    width: '100%',
    paddingHorizontal: 24,
  },
  logo: {
    alignSelf: 'center',
    width: 190,
    height: 44,
    marginBottom: 18,
  },
  panel: {
    gap: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: SLColors.borderDefault,
    borderRadius: SLRadius.radiusCard,
    backgroundColor: SLColors.surfaceInset,
  },
  eyebrow: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: SLColors.accentViolet,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: SLTypography.title.fontSize,
    lineHeight: 33,
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
    minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  devButtonText: {
    color: SLColors.textMuted, fontSize: SLTypography.micro.fontSize,
  },
  disabledButton: {
    opacity: SLOpacity.disabled,
  },
});
