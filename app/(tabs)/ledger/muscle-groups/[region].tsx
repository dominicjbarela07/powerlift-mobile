import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { MuscleDetailExperience } from '@/components/ledger/exploration-experiences';
import { LedgerFrame } from '@/components/ledger/primitives';
import { canonicalAccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';

export default function LedgerMuscleDetailRoute() {
  const params = useLocalSearchParams<{ region?: string }>();
  const value = Array.isArray(params.region) ? params.region[0] : params.region;
  return <LedgerFrame active="muscle-groups"><MuscleDetailExperience region={canonicalAccessoryMuscleRegionKey(value)} /></LedgerFrame>;
}
