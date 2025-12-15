// app/login.tsx
import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
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

        if (!res.ok) {
        setError(res.error || 'Login failed.');
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
        login({ user: authUser, token: res.token ?? null });

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
      <View style={styles.header}>
        <ThemedText style={styles.title}>Log in</ThemedText>
        <ThemedText style={styles.subtitle}>
          Use the same email and password as the web app.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <ThemedText style={styles.label}>Email</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#667085"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Password</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#667085"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
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
          style={styles.linkRow}
          onPress={() => router.replace('/')}
        >
          <ThemedText style={styles.linkText}>Back to start</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
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
  errorText: {
    color: '#f97373',
    fontSize: 13,
  },
});