import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { StandaloneCheckInFormScreen } from '@/components/AthleteCheckInExperience';
import { useAuth } from '@/context/AuthContext';

export default function CheckInSubmissionScreen() {
  const router = useRouter();
  const { activeMobileMode } = useAuth();
  const params = useLocalSearchParams<{ returnTo?: string; submissionId?: string }>();
  const isIndividual = activeMobileMode === 'individual';

  React.useEffect(() => {
    if (isIndividual) {
      router.replace('/(tabs)/athlete-dashboard' as any);
    }
  }, [isIndividual, router]);

  if (isIndividual) return null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <StandaloneCheckInFormScreen returnTo={params.returnTo} submissionId={params.submissionId} />
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
    paddingTop: 14,
    paddingBottom: 42,
  },
});
