import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { MovementDetailExperience } from '@/components/ledger/exploration-experiences';
import { LedgerFrame } from '@/components/ledger/primitives';

export default function LedgerMovementDetailRoute() {
  const params = useLocalSearchParams<{ movementId?: string; mode?: string }>();
  const movementId = Number(Array.isArray(params.movementId) ? params.movementId[0] : params.movementId);
  const mode = (Array.isArray(params.mode) ? params.mode[0] : params.mode) === 'variant' ? 'variant' : 'accessory';
  return <LedgerFrame active={mode === 'variant' ? 'variants' : 'accessories'}><MovementDetailExperience movementId={movementId} mode={mode} /></LedgerFrame>;
}
