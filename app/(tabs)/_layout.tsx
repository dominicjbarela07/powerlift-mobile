// app/(tabs)/_layout.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';

export default function TabsLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const firstName =
    user?.user_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Athlete';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.screen}>
        {/* 🔹 Always show the header bar */}
        <AppHeader
          firstName={firstName}
          onPressMenu={() => setMenuOpen((v) => !v)}
          onPressLogo={() => {
            setMenuOpen(false);
            if (user?.is_coach) {
              router.replace('/coach-dashboard');
            } else {
              router.replace('/(tabs)/athlete-dashboard');
            }
          }}
        />

        {/* 🔹 Menu dropdown (still controlled by state) */}
        {menuOpen && (
          <View style={styles.menuCard}>
            {user?.is_coach ? (
              <>
                {/* Coach Dashboard */}
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push('/coach-dashboard');
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Coach Dashboard</ThemedText>
                </Pressable>

                {/* Roster */}
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push('/coach-roster');
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Roster</ThemedText>
                </Pressable>

                {/* My Workouts */}
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push('/(tabs)/workouts');
                  }}
                >
                  <ThemedText style={styles.menuItemText}>My Workouts</ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                {/* Athlete Dashboard */}
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push('/(tabs)/athlete-dashboard');
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Athlete Dashboard</ThemedText>
                </Pressable>

                {/* My Workouts */}
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push('/(tabs)/workouts');
                  }}
                >
                  <ThemedText style={styles.menuItemText}>My Workouts</ThemedText>
                </Pressable>

                {/* Link your coach (athletes only) */}
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push('/link-coach');
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Link your coach</ThemedText>
                </Pressable>
              </>
            )}

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                logout();            // clear auth state
                router.replace('/login');  // send back to login screen
              }}
            >
              <ThemedText style={styles.menuItemText}>Logout</ThemedText>
            </Pressable>

            {/* keep Link Coach / Delete / Logout same as before */}
          </View>
        )}

        {/* Page content */}
        <Slot />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  screen: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  menuCard: {
    backgroundColor: '#020617',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    marginTop: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  menuDanger: {
    color: '#f97373',
  },
  menuFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  menuFooterText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});