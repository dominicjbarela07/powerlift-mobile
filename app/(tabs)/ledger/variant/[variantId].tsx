import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { VariantDetailExperience } from '@/components/ledger/VariantsExperience';
import { LedgerFrame } from '@/components/ledger/primitives';

export default function LedgerCoreVariantDetailRoute() {
  const params = useLocalSearchParams<{ variantId?: string }>();
  const rawId = Array.isArray(params.variantId) ? params.variantId[0] : params.variantId;
  const coreMovementId = Number(rawId);

  return (
    <LedgerFrame active="variants">
      <VariantDetailExperience coreMovementId={coreMovementId} />
    </LedgerFrame>
  );
}
