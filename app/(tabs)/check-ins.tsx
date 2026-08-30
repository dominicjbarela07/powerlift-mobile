import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { CheckInFallbackSurface } from '@/components/AthleteCheckInExperience';
import { CoachCheckInsV2 } from '@/components/coach-mobile/CoachCheckInsV2';
import { useAuth } from '@/context/AuthContext';

export default function CheckInsScreen() {
  const params = useLocalSearchParams<{ athleteId?: string | string[] }>();
  const { activeMobileMode } = useAuth();
  const isCoachWorkspace = activeMobileMode === 'coach' || activeMobileMode === 'individual';
  const rawAthleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const parsedAthleteId = rawAthleteId ? Number(rawAthleteId) : undefined;
  const initialAthleteId = Number.isFinite(parsedAthleteId) ? parsedAthleteId : undefined;

  if (isCoachWorkspace) return <CoachCheckInsV2 initialAthleteId={initialAthleteId} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <CheckInFallbackSurface />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingBottom: 42,
  },
});
