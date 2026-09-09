import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { CheckInFallbackSurface } from '@/components/AthleteCheckInExperience';
import { CoachCheckInsV2 } from '@/components/coach-mobile/CoachCheckInsV2';
import { useAuth } from '@/context/AuthContext';

export default function CheckInsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    athleteId?: string | string[];
    submissionId?: string | string[];
    returnToWorkspace?: string | string[];
  }>();
  const { activeMobileMode } = useAuth();
  const isCoachWorkspace = activeMobileMode === 'coach' || activeMobileMode === 'individual';
  const rawAthleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const parsedAthleteId = rawAthleteId ? Number(rawAthleteId) : undefined;
  const initialAthleteId = Number.isFinite(parsedAthleteId) ? parsedAthleteId : undefined;
  const rawSubmissionId = Array.isArray(params.submissionId) ? params.submissionId[0] : params.submissionId;
  const parsedSubmissionId = rawSubmissionId ? Number(rawSubmissionId) : undefined;
  const initialSubmissionId = Number.isFinite(parsedSubmissionId) ? parsedSubmissionId : undefined;
  const returnToWorkspace = (Array.isArray(params.returnToWorkspace) ? params.returnToWorkspace[0] : params.returnToWorkspace) === '1';

  if (isCoachWorkspace) return <CoachCheckInsV2
    initialAthleteId={initialAthleteId}
    initialSubmissionId={initialSubmissionId}
    onWorkspaceReturn={returnToWorkspace && initialAthleteId
      ? () => router.replace(`/(tabs)/coach-athlete/${initialAthleteId}/reviews` as any)
      : undefined}
  />;

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
