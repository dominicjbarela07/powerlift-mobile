import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { movementHistorySheetRouteForCanonicalIdentity } from '@/lib/movement-history-launch';

export default function LedgerMovementDetailRoute() {
  const params = useLocalSearchParams<{ movementId?: string; mode?: string; athleteId?: string }>();
  const movementId = Number(Array.isArray(params.movementId) ? params.movementId[0] : params.movementId);
  const athleteId = Number(Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId);
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  return <Redirect href={movementHistorySheetRouteForCanonicalIdentity({
    athleteId,
    ...(mode === 'variant'
      ? { coreMovementId: movementId }
      : { movementDefinitionId: movementId }),
  }) as never} />;
}
