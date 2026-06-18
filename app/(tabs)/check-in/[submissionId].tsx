import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { StandaloneCheckInFormScreen } from '@/components/AthleteCheckInExperience';

export default function CheckInSubmissionScreen() {
  const params = useLocalSearchParams<{ returnTo?: string; submissionId?: string }>();
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
