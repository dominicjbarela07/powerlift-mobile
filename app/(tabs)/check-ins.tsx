import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { CheckInFallbackSurface } from '@/components/AthleteCheckInExperience';
import { useAuth } from '@/context/AuthContext';

export default function CheckInsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isIndividual =
    user?.workspace_mode === 'individual' ||
      user?.is_individual_workspace === true ||
      user?.is_self_coached === true;

  React.useEffect(() => {
    if (isIndividual) {
      router.replace('/(tabs)/athlete-dashboard' as any);
    }
  }, [isIndividual, router]);

  if (isIndividual) return null;

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
