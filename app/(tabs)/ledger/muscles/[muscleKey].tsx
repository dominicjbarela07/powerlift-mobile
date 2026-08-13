import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { LedgerFrame } from '@/components/ledger/primitives';
import { LedgerMuscleDetailV2Screen } from '@/components/ledger/v2/muscle-screen';
export default function LedgerMuscleDetailRoute() {
  const { muscleKey } = useLocalSearchParams<{ muscleKey?: string | string[] }>();
  return <LedgerFrame active="muscles"><LedgerMuscleDetailV2Screen muscleKey={Array.isArray(muscleKey) ? muscleKey[0] : muscleKey || ''} /></LedgerFrame>;
}
