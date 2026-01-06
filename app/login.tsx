// app/login.tsx
import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, ActivityIndicator, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { loginRequest } from '@/lib/api';   
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);   // 👈 NEW
  const [error, setError] = useState<string | null>(null);  // 👈 NEW

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
    <ThemedView style={styles.screen}>
      <View style={styles.topHeader}>
        <ThemedText style={styles.topHeaderLeft} />
        <View style={styles.topHeaderCenter}>
          <Image
            source={require('../assets/images/app_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
      <View style={styles.header}>
        <ThemedText style={styles.titleMuted}>Log in</ThemedText>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <ThemedText style={styles.label}>Email</ThemedText>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Password</ThemedText>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, paddingRight: 40 }]}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              style={styles.eyeToggle}
              onPress={() => setShowPassword(v => !v)}
              hitSlop={10}
            >
              <ThemedText style={styles.eyeText}>
                {showPassword ? 'Hide' : 'Show'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {error && (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        )}

        <Pressable
          style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#020617" />
          ) : (
            <ThemedText style={styles.btnPrimaryText}>Sign in</ThemedText>
          )}
        </Pressable>

        <Pressable
          style={styles.forgotRow}
          onPress={() => {
            // Keep this dead-simple for now: open the web app login page where users can reset.
            // If you later add a dedicated /forgot-password page, swap this URL.
            const url = 'https://strength-coach-ui.onrender.com/auth/reset_request';
            Linking.openURL(url).catch(() => {
              setError('Unable to open password reset page.');
            });
          }}
        >
          <ThemedText style={styles.forgotText}>Forgot password?</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 24,
    backgroundColor: '#020617',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#9CA3AF',
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#F9FAFB',
    backgroundColor: '#020617',
  },
  btnPrimary: {
    marginTop: 8,
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#020617',
    fontWeight: '600',
    fontSize: 16,
  },
  linkRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
  forgotRow: {
    marginTop: 6,
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#f97373',
    fontSize: 13,
  },
  passwordRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeToggle: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 12,
    marginTop: 8,
  },
  topHeaderLeft: {
    width: 60,
  },
  topHeaderCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  topHeaderRight: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  titleMuted: {
    fontSize: 22,
    fontWeight: '600',
    color: '#E5E7EB',
  },
    logo: {
    height: 60,
    width:60,
  },
});