import '@expo/metro-runtime';
import React from 'react';
import { AppRegistry, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LedgerDesignStudy from '@/components/ledger-study/LedgerDesignStudy';
import { LEDGER_STUDY as T } from '@/constants/ledger-study';

function LedgerStudyPreview() {
  const [ready, error] = useFonts({
    'Exo2-Regular': require('@/assets/fonts/Exo2-Regular.ttf'),
    'Exo2-Medium': require('@/assets/fonts/Exo2-Medium.ttf'),
    'Exo2-SemiBold': require('@/assets/fonts/Exo2-SemiBold.ttf'),
    'Exo2-Bold': require('@/assets/fonts/Exo2-Bold.ttf'),
    Michroma: require('@/assets/fonts/Michroma-Regular.ttf'),
  });
  if (!__DEV__) return null;
  if (!ready && !error) return <View style={{ flex: 1, backgroundColor: T.colors.canvas }} />;
  return <SafeAreaProvider><LedgerDesignStudy /></SafeAreaProvider>;
}
if (__DEV__) {
  AppRegistry.registerComponent('LedgerStudy', () => LedgerStudyPreview);
  if (typeof document !== 'undefined') {
    AppRegistry.runApplication('LedgerStudy', { rootTag: document.getElementById('root') });
  }
}
