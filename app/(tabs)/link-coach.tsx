// app/(tabs)/link-coach.tsx
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { API_BASE } from '@/lib/api';

type DashboardData = {
  athlete: any;
  coach: any;
  next_workout: any;
  recent_workouts: any[];
};

export default function LinkCoachScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const resp = await fetch(`${API_BASE}/auth/link-coach/mobile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // If you are relying on cookies/session, you may need this:
          // credentials: 'include',
        });

        if (!resp.ok) {
          const text = await resp.text();
          console.log('link-coach resp not ok:', resp.status, text);
          throw new Error('Failed to load link coach data.');
        }

        const json = await resp.json();

        if (cancelled) return;

        if (!json.ok) {
          setError(json.error || 'Failed to load link coach data.');
          setData(null);
          return;
        }

        setData({
          athlete: json.athlete || null,
          coach: json.coach || null,
          next_workout: null,
          recent_workouts: [],
        });
      } catch (err: any) {
        if (cancelled) return;
        console.log('LinkCoach API error', err);
        setError(err.message || 'Network error while loading coach info.');
        setData(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (error || !data) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText variant={error ? 'error' : 'bodyMuted'}>
          {error || 'No data.'}
        </ThemedText>
      </ThemedView>
    );
  }

  const coach = data.coach;
  const alreadyLinked = !!coach;

  return (
    <ThemedView
      style={{
        flex: 1,
        backgroundColor: '#020617',
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 20 }}
      >
        <ThemedText
          variant="h1"
          style={{
            marginBottom: 12,
          }}
        >
          Link your coach
        </ThemedText>

        {alreadyLinked ? (
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: 'rgba(148,163,184,0.35)',
              padding: 16,
              backgroundColor: '#020617',
            }}
          >
            <ThemedText>
              You’re already linked to{' '}
              <ThemedText variant="body" style={{ fontWeight: '600' }}>
                {coach.name || coach.email || 'Coach'}
              </ThemedText>
              .
            </ThemedText>

            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                marginTop: 12,
              }}
            >
              <Pressable
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: '#3b82f6',
                }}
                onPress={() => router.push('/workouts')}
              >
                <ThemedText variant="small" style={{ fontWeight: '600' }}>
                  Go to My Workouts
                </ThemedText>
              </Pressable>

              <Pressable
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
                onPress={() => router.push('/athlete-dashboard')}
              >
                <ThemedText variant="small" style={{ fontWeight: '600' }}>
                  Home
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <ThemedText variant="bodyMuted">
            Don’t see an invite? Please contact your coach directly.
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}