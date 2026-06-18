import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { CheckInFallbackSurface } from '@/components/AthleteCheckInExperience';
import { SLColors } from '@/constants/theme';

export default function CheckInsScreen() {
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
    backgroundColor: SLColors.shellCanvas,
  },
  scroll: {
    paddingBottom: 42,
  },
});
