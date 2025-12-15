// app/index.tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function IndexGate() {
  const { user } = useAuth();

  // 🔒 Not logged in → go to login
  if (!user) {
    return <Redirect href="/login" />;
  }

  // ✅ Logged in athlete with linked profile → athlete dashboard
  if (!user.is_coach && user.has_linked_athlete && user.athlete_id) {
    return <Redirect href="/(tabs)/athlete-dashboard" />;
  }

  // ✅ Logged in coach → send to tabs home (the file app/(tabs)/index.tsx)
  return <Redirect href="/(tabs)" />;
}