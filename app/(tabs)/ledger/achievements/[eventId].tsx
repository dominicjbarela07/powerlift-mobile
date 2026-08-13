import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { LedgerFrame } from '@/components/ledger/primitives';
import { LedgerAchievementDetailV2Screen } from '@/components/ledger/v2/achievements-screen';
export default function LedgerAchievementDetailRoute() {
  const { eventId } = useLocalSearchParams<{ eventId?: string | string[] }>();
  return <LedgerFrame active="achievements"><LedgerAchievementDetailV2Screen eventId={Array.isArray(eventId) ? eventId[0] : eventId || ''} /></LedgerFrame>;
}
