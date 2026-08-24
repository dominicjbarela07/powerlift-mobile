// app/login.tsx
import React, { ComponentType, useEffect, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { TextInput, Text } from '@/components/ui/sl-text';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginRequest, mobileOAuthRequest, registerMobileRequest, type ApiLoginResponse } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLFontFamilies, SLRadius, SLTypography } from '@/constants/theme';
import { SLButton } from '@/components/ui';

const PASSWORD_RESET_URL = 'https://app.strengthledger.fit/auth/reset_request';

type OAuthProvider = 'google' | 'apple';
type AccountRole = 'coach' | 'athlete' | 'self_coach';
type AuthMode = 'login' | 'signup';

type PendingOAuthSetup = {
  provider: OAuthProvider;
  idToken: string;
  email?: string;
};

type AuthSsoButtonsProps = {
  disabled?: boolean;
  oauthLoading: OAuthProvider | null;
  setOauthLoading: (provider: OAuthProvider | null) => void;
  onOAuthResult: (provider: OAuthProvider, idToken: string, res: ApiLoginResponse) => Promise<void>;
  onError: (message: string | null) => void;
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [pendingOAuth, setPendingOAuth] = useState<PendingOAuthSetup | null>(null);
  const [signupRole, setSignupRole] = useState<AccountRole>('self_coach');
  const [setupRole, setSetupRole] = useState<AccountRole | null>(null);
  const [setupFirstName, setSetupFirstName] = useState('');
  const [setupLastName, setSetupLastName] = useState('');
  const [setupAccessCode, setSetupAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ssoButtonsModule, setSsoButtonsModule] = useState<{ Component: ComponentType<AuthSsoButtonsProps> } | null>(null);

  useEffect(() => {
    let mounted = true;
    import('@/components/AuthSsoButtons')
      .then((module) => {
        if (mounted) setSsoButtonsModule({ Component: module.default });
      })
      .catch((err) => {
        console.warn('SSO buttons unavailable in this build; email login remains enabled.', err);
        if (mounted) setSsoButtonsModule(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const openInfoPage = async (url: string, fallbackMessage: string, label: string) => {
    try {
      try {
        const WebBrowser = await import('expo-web-browser');
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        });
        return;
      } catch (browserErr) {
        console.warn(`${label} WebBrowser unavailable; falling back to Linking`, browserErr);
      }
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error(`Cannot open ${url}`);
      await Linking.openURL(url);
    } catch (err) {
      console.error(`${label} open failed`, { url, err });
      setError(fallbackMessage);
    }
  };

  const openPasswordReset = async () => {
    try {
      const supported = await Linking.canOpenURL(PASSWORD_RESET_URL);
      if (!supported) throw new Error(`Cannot open ${PASSWORD_RESET_URL}`);
      await Linking.openURL(PASSWORD_RESET_URL);
    } catch (err) {
      console.error('Password reset open failed', { url: PASSWORD_RESET_URL, err });
      setError('Unable to open password reset page.');
    }
  };

  const completeLogin = async (res: ApiLoginResponse, fallbackEmail?: string) => {
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
      workspace_mode: res.workspace_mode,
      available_mobile_modes: res.available_mobile_modes,
      mobile_mode: res.mobile_mode,
      can_access_internal_self_coach_mobile_mode: res.can_access_internal_self_coach_mobile_mode,
      is_individual_workspace: res.is_individual_workspace,
      is_self_coached: res.is_self_coached,
      self_athlete_id: res.self_athlete_id ?? null,
      account_state: res.account_state ?? null,
      next_url: res.next_url ?? null,
      next_route: res.next_route ?? null,
      can_access_product: res.can_access_product,
      link_coach_required: res.link_coach_required === true,
      account_state_detail: res.account_state_detail,
      email_verified: res.email_verified !== false,
      verification_required: res.verification_required === true,
      verification_url: res.verification_url ?? null,
      billing_required: res.billing_required === true,
      billing_url: res.billing_url ?? null,
      dev_onboarding_simulation_enabled: res.dev_onboarding_simulation_enabled === true,
      has_linked_athlete: !!res.has_linked_athlete,
      athlete_id: res.athlete_id ?? null,
      preferred_units: res.preferred_units === 'lbs' ? 'lb' : res.preferred_units ?? null,
    };
    await login({ user: authUser, token: res.token });

    if (
      authUser.account_state === 'EMAIL_VERIFICATION_REQUIRED' ||
      (authUser.verification_required && authUser.email_verified === false)
    ) {
      router.replace('/');
    } else if (
      authUser.account_state === 'ACTIVATION_REQUIRED' ||
      (authUser.is_coach && res.billing_required)
    ) {
      router.replace('/');
    } else {
      router.replace('/');
    }
  };

  const handleOAuthResponse = async (provider: OAuthProvider, idToken: string, res: ApiLoginResponse) => {
    if (res.needs_account_setup) {
      setPendingOAuth({ provider, idToken, email: res.email });
      setSetupRole(null);
      setSetupFirstName('');
      setSetupLastName('');
      setSetupAccessCode('');
      setError(res.error || 'Finish account setup to continue.');
      return;
    }

    if (!res.ok) {
      setError(res.error || 'Sign-in failed.');
      return;
    }

    setPendingOAuth(null);
    await completeLogin(res, res.email);
  };

  const finishOAuthSetup = async () => {
    if (!pendingOAuth) return;
    if (!setupRole) {
      setError('Choose Athlete, Coach, or Self-Coach to finish setup.');
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
        first_name: setupFirstName.trim() || undefined,
        last_name: setupLastName.trim() || undefined,
        access_code: setupAccessCode.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error || 'Could not finish account setup.');
        return;
      }
      setPendingOAuth(null);
      await completeLogin(res, pendingOAuth.email);
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

        await completeLogin(res, email.trim());
    } catch (e) {
        console.log('Login error', e);
        setError('Network error. Please try again.');
    } finally {
        setLoading(false);
    }
    };

  useEffect(() => {
    if (authMode === 'signup' && error) {
      setError(null);
    }
  }, [authMode, confirmPassword, email, firstName, lastName, password, setupAccessCode, signupRole]);

  const handleSignup = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('First name, last name, email, password, and confirmation are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (signupRole === 'coach' && !setupAccessCode.trim()) {
      setError('Founder Beta Access Code is required for coach accounts.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await registerMobileRequest({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        role: signupRole,
        access_code: setupAccessCode.trim() || undefined,
      });

      if (!res.ok) {
        setError(res.error || 'Could not create account.');
        return;
      }

      await completeLogin(res, email.trim());
    } catch (e) {
      console.log('Signup error', e);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const SsoButtons = ssoButtonsModule?.Component;
  const passwordStarted = password.length > 0 || confirmPassword.length > 0;
  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordsMatch = password.length >= 8 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = password.length >= 8 && confirmPassword.length > 0 && password !== confirmPassword;
  const signupPasswordMessage = passwordTooShort
    ? 'Password must be at least 8 characters.'
    : passwordsMismatch
    ? 'Passwords do not match.'
    : passwordsMatch
    ? 'Passwords match.'
    : passwordStarted
    ? 'Confirm your password to continue.'
    : '';
  const canSubmitSignup =
    authMode !== 'signup' ||
    (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 8 &&
      confirmPassword.length > 0 &&
      password === confirmPassword &&
      (signupRole !== 'coach' || setupAccessCode.trim().length > 0)
    );

  return (
    <View style={styles.screen}>
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
            <View style={styles.authPane}>
            <View style={styles.brandBlock}>
              <Image
                source={require('../assets/images/16:9.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.header}>
              <Text typographyRole="pageTitle" style={styles.title}>{authMode === 'signup' ? 'Create account' : 'Welcome back'}</Text>
              <Text typographyRole="supportingBody" style={styles.headerSubtitle}>
                {authMode === 'signup' ? 'Build your training space.' : 'Return to the work.'}
              </Text>
            </View>

            <View style={styles.form}>
              {authMode === 'login' && SsoButtons ? (
                <>
                  <SsoButtons
                    disabled={loading || !!pendingOAuth}
                    oauthLoading={oauthLoading}
                    setOauthLoading={setOauthLoading}
                    onOAuthResult={handleOAuthResponse}
                    onError={setError}
                  />
                  <View style={styles.emailDivider}>
                    <View style={styles.emailDividerLine} />
                    <Text style={styles.emailDividerText}>or continue with email</Text>
                    <View style={styles.emailDividerLine} />
                  </View>
                </>
              ) : null}

              {authMode === 'signup' ? (
                <>
                  <View style={styles.setupPanel}>
                    <Text style={styles.setupTitle}>Choose account type</Text>
                    <View style={styles.roleGrid}>
                      <Pressable
                        style={[styles.roleOption, signupRole === 'athlete' && styles.roleOptionActive]}
                        onPress={() => setSignupRole('athlete')}
                      >
                        <Text style={[styles.roleOptionText, signupRole === 'athlete' && styles.roleOptionTextActive]}>
                          Athlete
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.roleOption, signupRole === 'coach' && styles.roleOptionActive]}
                        onPress={() => setSignupRole('coach')}
                      >
                        <Text style={[styles.roleOptionText, signupRole === 'coach' && styles.roleOptionTextActive]}>
                          Coach
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.roleOption, signupRole === 'self_coach' && styles.roleOptionActive]}
                        onPress={() => setSignupRole('self_coach')}
                      >
                        <Text style={[styles.roleOptionText, signupRole === 'self_coach' && styles.roleOptionTextActive]}>
                          Self-Coach
                        </Text>
                      </Pressable>
                    </View>
                    <Text style={styles.setupHint}>
                      {signupRole === 'self_coach'
                        ? 'Self-Coach creates an Individual workspace for your own training.'
                        : signupRole === 'coach'
                        ? 'Coach accounts require a Founder Beta Access Code.'
                        : 'Athlete accounts require a pending coach invite for this email.'}
                    </Text>
                  </View>

                  <View style={styles.nameGrid}>
                    <View style={[styles.field, styles.nameGridItem]}>
                      <Text style={styles.label}>First Name</Text>
                      <TextInput
                        style={styles.input}
                        autoCapitalize="words"
                        textContentType="givenName"
                        placeholder="Alex"
                        placeholderTextColor="rgba(184, 172, 161, 0.48)"
                        value={firstName}
                        onChangeText={setFirstName}
                      />
                    </View>
                    <View style={[styles.field, styles.nameGridItem]}>
                      <Text style={styles.label}>Last Name</Text>
                      <TextInput
                        style={styles.input}
                        autoCapitalize="words"
                        textContentType="familyName"
                        placeholder="Carter"
                        placeholderTextColor="rgba(184, 172, 161, 0.48)"
                        value={lastName}
                        onChangeText={setLastName}
                      />
                    </View>
                  </View>
                </>
              ) : null}

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

              {authMode === 'signup' && signupRole === 'coach' ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Founder Beta Access Code</Text>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="characters"
                    placeholder="Access code"
                    placeholderTextColor="rgba(184, 172, 161, 0.48)"
                    value={setupAccessCode}
                    onChangeText={setSetupAccessCode}
                  />
                </View>
              ) : null}

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

              {authMode === 'signup' ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      secureTextEntry={!showConfirmPassword}
                      textContentType="password"
                      placeholder="Confirm password"
                      placeholderTextColor="rgba(184, 172, 161, 0.48)"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <Pressable
                      style={styles.eyeToggle}
                      onPress={() => setShowConfirmPassword(v => !v)}
                      hitSlop={10}
                    >
                      <Text style={styles.eyeText}>
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {authMode === 'signup' && signupPasswordMessage ? (
                <View
                  style={[
                    styles.passwordCheck,
                    passwordsMatch && styles.passwordCheckOk,
                    (passwordTooShort || passwordsMismatch) && styles.passwordCheckError,
                  ]}
                >
                  <Text
                    style={[
                      styles.passwordCheckText,
                      passwordsMatch && styles.passwordCheckTextOk,
                      (passwordTooShort || passwordsMismatch) && styles.passwordCheckTextError,
                    ]}
                  >
                    {signupPasswordMessage}
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <SLButton
                fullWidth
                label={authMode === 'signup' ? 'Create Account' : 'Sign in'}
                onPress={authMode === 'signup' ? handleSignup : handleLogin}
                disabled={loading || (authMode === 'signup' && !canSubmitSignup)}
                loading={loading}
                size="lg"
                style={styles.authSubmit}
              />

              {authMode === 'login' && pendingOAuth ? (
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
                    <Pressable
                      style={[styles.roleOption, setupRole === 'self_coach' && styles.roleOptionActive]}
                      onPress={() => setSetupRole('self_coach')}
                    >
                      <Text style={[styles.roleOptionText, setupRole === 'self_coach' && styles.roleOptionTextActive]}>
                        Self-Coach
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.nameGrid}>
                    <View style={[styles.field, styles.nameGridItem]}>
                      <Text style={styles.label}>First Name</Text>
                      <TextInput
                        style={styles.input}
                        autoCapitalize="words"
                        textContentType="givenName"
                        placeholder="Alex"
                        placeholderTextColor="rgba(184, 172, 161, 0.48)"
                        value={setupFirstName}
                        onChangeText={setSetupFirstName}
                      />
                    </View>
                    <View style={[styles.field, styles.nameGridItem]}>
                      <Text style={styles.label}>Last Name</Text>
                      <TextInput
                        style={styles.input}
                        autoCapitalize="words"
                        textContentType="familyName"
                        placeholder="Carter"
                        placeholderTextColor="rgba(184, 172, 161, 0.48)"
                        value={setupLastName}
                        onChangeText={setSetupLastName}
                      />
                    </View>
                  </View>
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
                  ) : setupRole === 'self_coach' ? (
                    <Text style={styles.setupHint}>
                      Self-Coach creates an Individual workspace for your own training.
                    </Text>
                  ) : null}
                  <SLButton
                    fullWidth
                    label="Finish setup"
                    onPress={finishOAuthSetup}
                    disabled={!!oauthLoading}
                    loading={!!oauthLoading}
                    variant="secondary"
                  />
                </View>
              ) : null}

              <View style={styles.linkRail}>
                <Pressable
                  style={styles.linkButton}
                  onPress={openPasswordReset}
                >
                  <Text style={styles.linkText}>Forgot password?</Text>
                </Pressable>
                <View style={styles.linkDivider} />
                <Pressable
                  style={styles.linkButton}
                  onPress={() => {
                    setError(null);
                    setPendingOAuth(null);
                    setAuthMode(authMode === 'signup' ? 'login' : 'signup');
                  }}
                >
                  <Text style={styles.linkTextStrong}>{authMode === 'signup' ? 'Sign in' : 'Sign up'}</Text>
                </Pressable>
              </View>
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
    backgroundColor: 'transparent',
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
    paddingTop: 28,
    paddingBottom: 28,
    width: '100%',
  },
  authPane: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 34,
  },
  logo: {
    width: 224,
    height: 50,
  },
  header: {
    marginBottom: 18,
    gap: 5,
  },
  title: {
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: SLTypography.hero.fontSize,
    lineHeight: SLTypography.hero.lineHeight,
    fontWeight: SLTypography.commandTitle.fontWeight,
    color: SLColors.textStrong,
    letterSpacing: SLTypography.hero.letterSpacing,
  },
  headerSubtitle: {
    ...SLTypography.body,
    color: SLColors.textMuted,
  },
  form: {
    gap: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusHero,
    backgroundColor: SLColors.surface,
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
    fontSize: SLTypography.micro.fontSize,
    color: SLColors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  field: {
    gap: 7,
  },
  nameGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  nameGridItem: {
    flex: 1,
  },
  label: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: SLColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  input: {
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusRow,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.body.fontSize,
    color: SLColors.textStrong,
    backgroundColor: SLColors.surfaceInset,
  },
  authSubmit: {
    marginTop: 4,
  },
  setupPanel: {
    gap: 12,
    marginTop: 2,
    padding: 14,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusCard,
    backgroundColor: SLColors.surfaceRaised,
  },
  setupTitle: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: SLTypography.cardTitle.fontSize,
    color: SLColors.textStrong,
  },
  setupCopy: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    color: SLColors.textMuted,
  },
  setupHint: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    color: SLColors.textMuted,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: SLRadius.radiusControl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceInset,
  },
  roleOptionActive: {
    borderColor: SLColors.accent,
    backgroundColor: SLColors.accent,
  },
  roleOptionText: {
    fontFamily: SLFontFamilies.sansSemiBold,
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
  },
  roleOptionTextActive: {
    color: SLColors.textInverted,
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
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(184, 172, 161, 0.42)',
  },
  linkText: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: SLTypography.label.fontSize,
    color: SLColors.textMuted,
  },
  linkTextStrong: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: SLTypography.label.fontSize,
    color: SLColors.textStrong,
  },
  errorBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(232, 137, 137, 0.10)',
  },
  errorText: {
    fontFamily: SLFontFamilies.sans,
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
  },
  passwordCheck: {
    marginTop: -6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  passwordCheckOk: {
    borderLeftColor: SLColors.success,
    backgroundColor: 'rgba(158, 217, 178, 0.08)',
  },
  passwordCheckError: {
    borderLeftColor: SLColors.danger,
    backgroundColor: 'rgba(232, 137, 137, 0.08)',
  },
  passwordCheckText: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 16,
    color: SLColors.accentViolet,
  },
  passwordCheckTextOk: {
    color: SLColors.success,
  },
  passwordCheckTextError: {
    color: SLColors.danger,
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
    fontSize: SLTypography.label.fontSize,
    color: SLColors.textStrong,
  },
});
