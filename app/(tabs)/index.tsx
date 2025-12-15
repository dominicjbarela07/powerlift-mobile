import React, { useState } from 'react';
import { StyleSheet, View, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { loginRequest } from '@/lib/api';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loggedUser, setLoggedUser] = useState<null | {
    name: string;
    role: string;
  }>(null);

  async function handleLogin() {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await loginRequest(email.trim(), password);

      if (!res.ok) {
        setError(res.error || 'Login failed.');
        return;
      }

      // pull info from the API response
      const role =
        res.role ||
        (res.is_coach ? 'coach' : 'athlete');

      const displayName =
        res.user_name ||
        res.email ||
        'Athlete';

      if (role === 'athlete') {
        // ✅ Athlete → go to native athlete dashboard
        router.replace('/athlete-dashboard');
        return;
      }

      // ✅ Coach (or other) → stay on home & show welcome
      setLoggedUser({ name: displayName, role });
      setPassword('');
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Strength Coach UI</ThemedText>
        <ThemedText style={styles.subtitle}>Train. Log. Progress.</ThemedText>
      </View>

      <View style={styles.card}>
        {loggedUser ? (
          <>
            <ThemedText style={styles.cardText}>
              Welcome back, {loggedUser.name}.
            </ThemedText>
            <ThemedText style={styles.cardSubText}>
              You’re signed in as {loggedUser.role}.
            </ThemedText>
          </>
        ) : (
          <ThemedText style={styles.cardText}>
            Your mobile companion for logging workouts, tracking progress,
            and staying connected with your coach.
          </ThemedText>
        )}
      </View>

      {!loggedUser && (
        <View style={styles.actions}>
          <Pressable style={styles.btnPrimary} onPress={() => setShowLogin((v) => !v)}>
            <ThemedText style={styles.btnPrimaryText}>
              {showLogin ? 'Close Login' : 'Log In'}
            </ThemedText>
          </Pressable>

          <Pressable style={styles.btnSecondary} onPress={() => { /* later: signup / deep link */ }}>
            <ThemedText style={styles.btnSecondaryText}>Create Account</ThemedText>
          </Pressable>
        </View>
      )}

      {showLogin && !loggedUser && (
        <View style={styles.loginCard}>
          <ThemedText style={styles.loginTitle}>Log in to your account</ThemedText>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

          <Pressable
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <ThemedText style={styles.btnPrimaryText}>Sign In</ThemedText>
            )}
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#9ca3af',
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    marginBottom: 16,
  },
  cardText: {
    fontSize: 15,
    color: '#e5e7eb',
  },
  cardSubText: {
    marginTop: 6,
    fontSize: 13,
    color: '#9ca3af',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontWeight: '600',
    color: '#020617',
  },
  btnSecondary: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  btnSecondaryText: {
    color: '#e5e7eb',
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  loginCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    backgroundColor: '#020617',
    gap: 8,
  },
  loginTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#e5e7eb',
    fontSize: 14,
  },
  errorText: {
    color: '#f97373',
    fontSize: 13,
  },
});