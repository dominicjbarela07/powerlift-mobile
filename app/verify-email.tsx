import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resendEmailVerificationCode, verifyEmailVerificationCode } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';
import { OnboardingSupportFooter } from '@/components/OnboardingSupportFooter';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, token, login, logout } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  if (!user) return <Redirect href="/login" />;
  if (!user.verification_required || user.email_verified !== false) return <Redirect href="/" />;

  const normalizedCode = code.replace(/\D/g, '').slice(0, 6);

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
      const refreshed = {
        ...user,
        email_verified: true,
        verification_required: false,
        verification_url: null,
      };
      await login({ user: refreshed, token });
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
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
                placeholderTextColor="rgba(236,230,222,0.32)"
                style={styles.codeInput}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}

              <Pressable
                style={[styles.primaryButton, submitting && styles.disabledButton]}
                onPress={handleVerify}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify Email</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.secondaryButton, resending && styles.disabledButton]}
                onPress={handleResend}
                disabled={resending}
              >
                <Text style={styles.secondaryButtonText}>
                  {resending ? 'Sending...' : 'Resend code'}
                </Text>
              </Pressable>

              <Pressable style={styles.logoutButton} onPress={logout}>
                <Text style={styles.logoutText}>Log out</Text>
              </Pressable>

              <OnboardingSupportFooter />
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
    backgroundColor: '#070707',
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
    borderColor: 'rgba(126, 104, 255, 0.22)',
    borderRadius: 18,
    backgroundColor: 'rgba(12, 10, 18, 0.96)',
  },
  eyebrow: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: '#F0BF63',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: SLTypography.commandTitle.fontWeight,
    color: '#F8FAFC',
  },
  body: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
    color: '#B8ACA1',
  },
  codeInput: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: 'rgba(139, 116, 255, 0.62)',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.035)',
    color: SLColors.text,
    fontFamily: SLFontFamilies.sans,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 9,
    textAlign: 'center',
  },
  error: {
    color: '#FF8B8B',
    fontFamily: SLFontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  message: {
    color: '#9EE6B2',
    fontFamily: SLFontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C2BD9',
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: SLFontFamilies.sans,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 116, 255, 0.42)',
    backgroundColor: 'rgba(139, 116, 255, 0.10)',
  },
  secondaryButtonText: {
    color: '#D9CEFF',
    fontFamily: SLFontFamilies.sans,
    fontSize: 15,
    fontWeight: '800',
  },
  logoutButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#938A9F',
    fontFamily: SLFontFamilies.sans,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.62,
  },
});
