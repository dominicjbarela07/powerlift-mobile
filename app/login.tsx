// app/login.tsx
import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginRequest } from '@/lib/api';   
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        if (!res.token) {
          setError('Login succeeded but no auth token was returned. Cannot continue.');
          return;
        }

        // Build the AuthUser object from your Flask response
        const authUser = {
            email: res.email ?? email.trim(),
            user_name: res.user_name ?? null,
            role: (res.role as 'coach' | 'athlete') ||
                    (res.is_coach ? 'coach' : 'athlete'),
            is_coach: !!(res.is_coach || res.role === 'coach'),
            has_linked_athlete: !!res.has_linked_athlete,
            athlete_id: res.athlete_id ?? null,
        };

        // Save into global auth state
        login({ user: authUser, token: res.token });

        // Navigate based on role
        if (!authUser.is_coach && authUser.has_linked_athlete && authUser.athlete_id) {
          // Athlete with a linked profile → dashboard, pass athlete_id in the URL
          router.replace({
            pathname: '/athlete-dashboard',
            params: { athlete_id: String(authUser.athlete_id) },
          });
        } else if (authUser.is_coach) {
          // Coach → mobile coach dashboard
          router.replace('/coach-dashboard');
        } else {
          // Athlete but not linked yet → land on a simple home/start screen for now
          router.replace('/');
        }
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

              <View style={styles.linkRail}>
                <Pressable
                  style={styles.linkButton}
                  onPress={() => {
                    const url = 'https://app.strengthledger.fit/auth/reset_request';
                    Linking.openURL(url).catch(() => {
                      setError('Unable to open password reset page.');
                    });
                  }}
                >
                  <Text style={styles.linkText}>Forgot password?</Text>
                </Pressable>
                <View style={styles.linkDivider} />
                <Pressable
                  style={styles.linkButton}
                  onPress={() => {
                    const url = 'https://app.strengthledger.fit/auth/register';
                    Linking.openURL(url).catch(() => {
                      setError('Unable to open signup page.');
                    });
                  }}
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
