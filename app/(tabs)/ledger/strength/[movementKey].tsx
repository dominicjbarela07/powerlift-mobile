import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { LedgerFrame } from '@/components/ledger/primitives';
import { LedgerLiftDetailV2Screen } from '@/components/ledger/v2/strength-screen';
export default function LedgerLiftDetailRoute() {
  const { movementKey } = useLocalSearchParams<{ movementKey?: string | string[] }>();
  return <LedgerFrame active="strength"><LedgerLiftDetailV2Screen movementKey={Array.isArray(movementKey) ? movementKey[0] : movementKey || ''} /></LedgerFrame>;
}
