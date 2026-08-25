import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef } from 'react';

import { CanonicalMovementHistoryScreen } from '@/components/movement-history/CanonicalMovementHistoryScreen';
import {
  StrengthLedgerBottomSheet,
  type StrengthLedgerBottomSheetHandle,
} from '@/components/sheets/StrengthLedgerBottomSheet';

function numericParam(value?: string | string[]) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function MovementHistorySheetRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    athleteId?: string | string[];
    equipmentContextDefinitionId?: string | string[];
    equipmentDefinitionId?: string | string[];
    movementDefinitionId?: string | string[];
    displayUnit?: string | string[];
  }>();
  const sheetRef = useRef<StrengthLedgerBottomSheetHandle>(null);
  const movementDefinitionId = numericParam(params.movementDefinitionId);
  const athleteId = numericParam(params.athleteId);
  const equipmentContextDefinitionId = numericParam(
    params.equipmentContextDefinitionId ?? params.equipmentDefinitionId,
  );
  const requestClose = useCallback(() => sheetRef.current?.dismiss(), []);
  const displayUnitParam = Array.isArray(params.displayUnit) ? params.displayUnit[0] : params.displayUnit;
  const initialDisplayUnit = displayUnitParam === 'lb' || displayUnitParam === 'kg' ? displayUnitParam : null;

  return (
    <StrengthLedgerBottomSheet
      ref={sheetRef}
      accessibilityLabel="Movement History"
      heightFraction={0.93}
      motionPreset="deliberate"
      onDismiss={() => router.back()}
      testID="canonical-movement-history-sheet"
      visible
    >
      {movementDefinitionId ? (
        <CanonicalMovementHistoryScreen
          athleteId={athleteId}
          initialEquipmentContextDefinitionId={equipmentContextDefinitionId}
          initialDisplayUnit={initialDisplayUnit}
          movementDefinitionId={movementDefinitionId}
          onRequestClose={requestClose}
          presentation="sheet"
        />
      ) : null}
    </StrengthLedgerBottomSheet>
  );
}
