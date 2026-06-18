// app/login.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { WEB_BASE, loginRequest, mobileOAuthRequest, type ApiLoginResponse } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

const AUTH_WEB_BASE = WEB_BASE.replace(/\/$/, '');
const PASSWORD_RESET_URL = `${AUTH_WEB_BASE}/auth/reset_request`;
const SIGNUP_URL = `${AUTH_WEB_BASE}/auth/register`;

type OAuthProvider = 'google' | 'apple';
type AccountRole = 'coach' | 'athlete';

type PendingOAuthSetup = {
  provider: OAuthProvider;
  idToken: string;
  email?: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pendingOAuth, setPendingOAuth] = useState<PendingOAuthSetup | null>(null);
  const [setupRole, setSetupRole] = useState<AccountRole | null>(null);
  const [setupName, setSetupName] = useState('');
  const [setupAccessCode, setSetupAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const googleClientIds = useMemo(() => ({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  }), []);
  const googleConfigured = Platform.OS === 'ios'
    ? !!(googleClientIds.iosClientId || googleClientIds.webClientId)
    : Platform.OS === 'android'
      ? !!(googleClientIds.androidClientId || googleClientIds.webClientId)
      : !!googleClientIds.webClientId;

  const [googleRequest, , promptGoogleAsync] = Google.useAuthRequest({
    ...googleClientIds,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setAppleAvailable(available);
      })
      .catch(() => {
        if (mounted) setAppleAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const openInfoPage = async (url: string, fallbackMessage: string, label: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });
    } catch (err) {
      console.error(`${label} openBrowserAsync failed`, { url, err });
      setError(fallbackMessage);
    }
  };

  const openSignup = () =>
    openInfoPage(SIGNUP_URL, 'Unable to open signup page. Please try again.', 'Signup');

  const completeLogin = (res: ApiLoginResponse, fallbackEmail?: string) => {
    if (!res.token) {
      setError('Login succeeded but no auth token was returned. Cannot continue.');
      return;
    }

    const authUser = {
      email: res.email ?? fallbackEmail ?? email.trim(),
      user_name: res.user_name ?? null,
      role: (res.role as 'coach' | 'athlete') ||
              (res.is_coach ? 'coach' : 'athlete'),
      is_coach: !!(res.is_coach || res.role === 'coach'),
      has_linked_athlete: !!res.has_linked_athlete,
      athlete_id: res.athlete_id ?? null,
    };

    login({ user: authUser, token: res.token });

    if (!authUser.is_coach && authUser.has_linked_athlete && authUser.athlete_id) {
      router.replace({
        pathname: '/athlete-dashboard',
        params: { athlete_id: String(authUser.athlete_id) },
      });
    } else if (authUser.is_coach) {
      router.replace('/coach-dashboard');
    } else {
      router.replace('/');
    }
  };

  const handleOAuthResponse = (provider: OAuthProvider, idToken: string, res: ApiLoginResponse) => {
    if (res.needs_account_setup) {
      setPendingOAuth({ provider, idToken, email: res.email });
      setSetupRole(null);
      setSetupName('');
      setSetupAccessCode('');
      setError(res.error || 'Finish account setup to continue.');
      return;
    }

    if (!res.ok) {
      setError(res.error || 'Sign-in failed.');
      return;
    }

    setPendingOAuth(null);
    completeLogin(res, res.email);
  };

  const handleGoogleSignIn = async () => {
    if (!googleConfigured || !googleRequest) {
      setError('Google sign-in is not configured for this build.');
      return;
    }

    setError(null);
    setOauthLoading('google');
    try {
      const result = await promptGoogleAsync();
      if (result.type !== 'success') {
        if (result.type !== 'dismiss' && result.type !== 'cancel') {
          setError('Google sign-in did not finish. Please try again.');
        }
        return;
      }
      const idToken =
        (result as any).authentication?.idToken ||
        (result as any).params?.id_token;
      if (!idToken) {
        setError('Google did not return an identity token. Please try again.');
        return;
      }
      const res = await mobileOAuthRequest('google', idToken);
      handleOAuthResponse('google', idToken, res);
    } catch (err) {
      console.error('Google sign-in failed', err);
      setError('Google sign-in failed. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (!appleAvailable) {
      setError('Apple sign-in is not available on this device.');
      return;
    }

    setError(null);
    setOauthLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = credential.identityToken;
      if (!idToken) {
        setError('Apple did not return an identity token. Please try again.');
        return;
      }
      const name = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ].filter(Boolean).join(' ');
      const res = await mobileOAuthRequest('apple', idToken, { name: name || undefined });
      handleOAuthResponse('apple', idToken, res);
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        console.error('Apple sign-in failed', err);
        setError('Apple sign-in failed. Please try again.');
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const finishOAuthSetup = async () => {
    if (!pendingOAuth) return;
    if (!setupRole) {
      setError('Choose Athlete or Coach to finish setup.');
      return;
    }
    if (setupRole === 'coach' && !setupAccessCode.trim()) {
      setError('Founder Beta Access Code is required for coach accounts.');
      return;
    }

    setError(null);
    setOauthLoading(pendingOAuth.provider);
    try {
      const res = await mobileOAuthRequest(pendingOAuth.provider, pendingOAuth.idToken, {
        role: setupRole,
        name: setupName.trim() || undefined,
        access_code: setupAccessCode.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error || 'Could not finish account setup.');
        return;
      }
      setPendingOAuth(null);
      completeLogin(res, pendingOAuth.email);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
        setError('Email and password are required.');
        return;
    }

    setError(null);
    setLoading(true);

    try {
        const res = await loginRequest(email.trim(), password);
        console.log('Login response:', res);

        if (!res.ok) {
        setError(res.error || 'Login failed.');
        return;
        }

        completeLogin(res, email.trim());
    } catch (e) {
        console.log('Login error', e);
        setError('Network error. Please try again.');
    } finally {
        setLoading(false);
    }
    };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#24172F', '#111016', '#070707', '#050505']}
        locations={[0, 0.28, 0.68, 1]}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0.75, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.brandBlock}>
              <Image
                source={require('../assets/images/16:9.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>Welcome back</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.ssoStack}>
                <Pressable
                  style={({ pressed }) => [
                    styles.ssoButton,
                    styles.ssoButtonGoogle,
                    pressed && googleConfigured && styles.ssoButtonPressed,
                    (!googleConfigured || oauthLoading === 'google') && styles.ssoButtonDisabled,
                  ]}
                  onPress={handleGoogleSignIn}
                  disabled={!googleConfigured || !!oauthLoading || loading}
                >
                  {oauthLoading === 'google' ? (
                    <ActivityIndicator color="#111827" />
                  ) : (
                    <>
                      <FontAwesome name="google" size={17} color="#111827" />
                      <Text style={styles.ssoTextGoogle}>Continue with Google</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.ssoButton,
                    styles.ssoButtonApple,
                    pressed && appleAvailable && styles.ssoButtonPressed,
                    (!appleAvailable || oauthLoading === 'apple') && styles.ssoButtonDisabled,
                  ]}
                  onPress={handleAppleSignIn}
                  disabled={!appleAvailable || !!oauthLoading || loading}
                >
                  {oauthLoading === 'apple' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <FontAwesome name="apple" size={20} color="#FFFFFF" />
                      <Text style={styles.ssoTextApple}>Continue with Apple</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <View style={styles.emailDivider}>
                <View style={styles.emailDividerLine} />
                <Text style={styles.emailDividerText}>or continue with email</Text>
                <View style={styles.emailDividerLine} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(184, 172, 161, 0.48)"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    placeholder="Password"
                    placeholderTextColor="rgba(184, 172, 161, 0.48)"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable
                    style={styles.eyeToggle}
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={10}
                  >
                    <Text style={styles.eyeText}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && !loading && styles.btnPrimaryPressed,
                  loading && styles.btnPrimaryLoading,
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#F5F3FF" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Sign in</Text>
                )}
              </Pressable>

              {pendingOAuth ? (
                <View style={styles.setupPanel}>
                  <Text style={styles.setupTitle}>Finish account setup</Text>
                  <Text style={styles.setupCopy}>
                    {pendingOAuth.email ? `${pendingOAuth.email} is ready to connect.` : 'Choose how you use Strength Ledger.'}
                  </Text>
                  <View style={styles.roleGrid}>
                    <Pressable
                      style={[styles.roleOption, setupRole === 'athlete' && styles.roleOptionActive]}
                      onPress={() => setSetupRole('athlete')}
                    >
                      <Text style={[styles.roleOptionText, setupRole === 'athlete' && styles.roleOptionTextActive]}>
                        Athlete
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.roleOption, setupRole === 'coach' && styles.roleOptionActive]}
                      onPress={() => setSetupRole('coach')}
                    >
                      <Text style={[styles.roleOptionText, setupRole === 'coach' && styles.roleOptionTextActive]}>
                        Coach
                      </Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="words"
                    placeholder="Name"
                    placeholderTextColor="rgba(184, 172, 161, 0.48)"
                    value={setupName}
                    onChangeText={setSetupName}
                  />
                  {setupRole === 'coach' ? (
                    <TextInput
                      style={styles.input}
                      autoCapitalize="characters"
                      placeholder="Founder Beta Access Code"
                      placeholderTextColor="rgba(184, 172, 161, 0.48)"
                      value={setupAccessCode}
                      onChangeText={setSetupAccessCode}
                    />
                  ) : setupRole === 'athlete' ? (
                    <Text style={styles.setupHint}>
                      Athlete account creation requires a pending coach invite for this email.
                    </Text>
                  ) : null}
                  <Pressable
                    style={({ pressed }) => [
                      styles.btnSecondary,
                      pressed && !oauthLoading && styles.btnPrimaryPressed,
                      oauthLoading && styles.btnPrimaryLoading,
                    ]}
                    onPress={finishOAuthSetup}
                    disabled={!!oauthLoading}
                  >
                    <Text style={styles.btnSecondaryText}>Finish setup</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.linkRail}>
                <Pressable
                  style={styles.linkButton}
                  onPress={() => openInfoPage(
                    PASSWORD_RESET_URL,
                    'Unable to open password reset page.',
                    'Password reset'
                  )}
                >
                  <Text style={styles.linkText}>Forgot password?</Text>
                </Pressable>
                <View style={styles.linkDivider} />
                <Pressable
                  style={styles.linkButton}
                  onPress={openSignup}
                >
                  <Text style={styles.linkTextStrong}>Sign up</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  safeArea: {
    flex: 1,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 34,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 46,
  },
  logo: {
    width: 240,
    height: 54,
  },
  header: {
    marginBottom: 22,
  },
  title: {
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: SLTypography.commandTitle.fontWeight,
    color: '#F8FAFC',
    letterSpacing: 0,
  },
  form: {
    gap: 15,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.08)',
    backgroundColor: 'rgba(10, 8, 9, 0.24)',
  },
  ssoStack: {
    gap: 10,
  },
  ssoButton: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ssoButtonGoogle: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.72)',
  },
  ssoButtonApple: {
    backgroundColor: '#000000',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ssoButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  ssoButtonDisabled: {
    opacity: 0.46,
  },
  ssoTextGoogle: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 14,
    color: '#111827',
  },
  ssoTextApple: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  emailDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  emailDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(222, 198, 166, 0.10)',
  },
  emailDividerText: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 11,
    color: '#8F857A',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  field: {
    gap: 7,
  },
  label: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: '#A69B8D',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.10)',
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 13,
    fontFamily: SLFontFamilies.sans,
    fontSize: 15,
    color: '#F8FAFC',
    backgroundColor: 'rgba(8, 8, 10, 0.58)',
  },
  btnPrimary: {
    marginTop: 4,
    minHeight: 52,
    backgroundColor: 'rgba(124, 58, 237, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.28)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  btnPrimaryLoading: {
    opacity: 0.72,
  },
  btnPrimaryText: {
    fontFamily: SLTypography.buttonLabel.fontFamily,
    color: '#F5F3FF',
    fontSize: 14,
    fontWeight: SLTypography.buttonLabel.fontWeight,
    letterSpacing: 0,
  },
  btnSecondary: {
    minHeight: 48,
    backgroundColor: 'rgba(28, 24, 20, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.22)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontFamily: SLTypography.buttonLabel.fontFamily,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: SLTypography.buttonLabel.fontWeight,
  },
  setupPanel: {
    gap: 12,
    marginTop: 2,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
    borderRadius: 8,
    backgroundColor: 'rgba(16, 13, 18, 0.72)',
  },
  setupTitle: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 16,
    color: '#F8FAFC',
  },
  setupCopy: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    color: '#A69B8D',
  },
  setupHint: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 12,
    lineHeight: 17,
    color: '#A69B8D',
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(222, 198, 166, 0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 8, 10, 0.58)',
  },
  roleOptionActive: {
    borderColor: 'rgba(196,181,253,0.45)',
    backgroundColor: 'rgba(124, 58, 237, 0.26)',
  },
  roleOptionText: {
    fontFamily: SLFontFamilies.sansSemiBold,
    color: '#A69B8D',
    fontSize: 13,
  },
  roleOptionTextActive: {
    color: '#F8FAFC',
  },
  linkRail: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  linkDivider: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(184, 172, 161, 0.42)',
  },
  linkText: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 13,
    color: '#A69B8D',
  },
  linkTextStrong: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 13,
    color: '#C4B5FD',
  },
  errorBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(232, 137, 137, 0.10)',
    borderLeftWidth: 2,
    borderLeftColor: '#E88989',
  },
  errorText: {
    fontFamily: SLFontFamilies.sans,
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  passwordRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 54,
  },
  eyeToggle: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  eyeText: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 13,
    color: '#C4B5FD',
  },
});
