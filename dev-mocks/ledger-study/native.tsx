// Explicit-entry local simulator presentation, never imported by the product root.
// Release-style JS is required by the existing simulator shell; product routes
// retain their __DEV__ boundary. No product providers, auth or data writers.
import React from 'react';
import { View } from 'react-native';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LedgerDesignStudy from '@/components/ledger-study/LedgerDesignStudy';
import { LEDGER_STUDY as T } from '@/constants/ledger-study';

function NativeLedgerStudy() {
  const [ready, error] = useFonts({
    'Exo2-Regular': require('@/assets/fonts/Exo2-Regular.ttf'),
    'Exo2-Medium': require('@/assets/fonts/Exo2-Medium.ttf'),
    'Exo2-SemiBold': require('@/assets/fonts/Exo2-SemiBold.ttf'),
    'Exo2-Bold': require('@/assets/fonts/Exo2-Bold.ttf'),
    Michroma: require('@/assets/fonts/Michroma-Regular.ttf'),
  });
  if (!ready && !error) return <View style={{ flex: 1, backgroundColor: T.colors.canvas }} />;
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: T.colors.canvas }}>
    <StatusBar style="light" /><LedgerDesignStudy embedded />
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(NativeLedgerStudy);
